// Exports — generate PDFs on-device using expo-print, persist locally, and
// upload to the generated-exports bucket so the user has a durable copy.
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { Query, ID } from 'react-native-appwrite';
import { format } from 'date-fns';
import { ExportRepository } from '@domain/repositories';
import { CaseEvent, CaseRecord, DocumentRecord, IssueFlag } from '@domain/entities';
import { account, databases, storage, DATABASE, COLLECTIONS, BUCKETS } from '@infra/appwrite/client';
import { ownerOnly } from '@infra/appwrite/permissions';
import { mapCase, mapDocument, mapEvent, mapIssue } from '@infra/appwrite/mappers';
import { EXPORT_FOOTER, PRIMARY_DISCLAIMER, PATTERN_DISCLAIMER } from '@shared/constants/disclaimers';

const esc = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function header(title: string, caseRecord: CaseRecord) {
  return `
  <div style="border-bottom:2px solid #0E1A2B;padding-bottom:8px;margin-bottom:16px;">
    <div style="font-size:10px;color:#666;">FAMILY RIGHTS APP \u2014 MACHINE-ASSISTED EXPORT</div>
    <h1 style="margin:4px 0;font-size:20px;">${esc(title)}</h1>
    <div style="font-size:11px;">${esc(caseRecord.title)}</div>
    <div style="font-size:11px;">Jurisdiction: ${esc(caseRecord.jurisdictionState)}${caseRecord.jurisdictionCounty ? ' \u2014 ' + esc(caseRecord.jurisdictionCounty) + ' County' : ''}</div>
    <div style="font-size:11px;">Generated: ${esc(format(new Date(), 'PPpp'))}</div>
  </div>`;
}

const footer = () => `
  <div style="border-top:1px solid #ccc;margin-top:24px;padding-top:8px;font-size:9px;color:#555;">
    <p><strong>DISCLAIMER:</strong> ${esc(PRIMARY_DISCLAIMER)}</p>
    <p>${esc(EXPORT_FOOTER)}</p>
  </div>`;

async function loadCase(caseId: string) {
  const [c, events, docs, flags] = await Promise.all([
    databases.getDocument(DATABASE, COLLECTIONS.cases, caseId),
    databases.listDocuments(DATABASE, COLLECTIONS.case_events, [
      Query.equal('caseId', caseId),
      Query.orderAsc('occurredAt'),
      Query.limit(500),
    ]),
    databases.listDocuments(DATABASE, COLLECTIONS.documents, [
      Query.equal('caseId', caseId),
      Query.orderDesc('$createdAt'),
      Query.limit(500),
    ]),
    databases.listDocuments(DATABASE, COLLECTIONS.issue_flags, [
      Query.equal('caseId', caseId),
      Query.orderDesc('$createdAt'),
      Query.limit(500),
    ]),
  ]);
  return {
    record: mapCase(c as any),
    events: events.documents.map((d) => mapEvent(d as any)),
    documents: docs.documents.map((d) => mapDocument(d as any)),
    flags: flags.documents.map((d) => mapIssue(d as any)),
  };
}

async function generatePdfAndUpload(html: string, fileName: string, ownerUserId: string): Promise<{ id: string; uri: string }> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  // Upload a copy to the exports bucket.
  try {
    const upload = await storage.createFile(
      BUCKETS.exports,
      ID.unique(),
      { uri, name: fileName, type: 'application/pdf' } as any,
      ownerOnly(ownerUserId)
    );
    const exp = await databases.createDocument(
      DATABASE,
      COLLECTIONS.exports,
      ID.unique(),
      {
        ownerUserId,
        fileName,
        bucketId: BUCKETS.exports,
        fileId: upload.$id,
        generatedAt: new Date().toISOString(),
        kind: fileName.split('-')[0],
      },
      ownerOnly(ownerUserId)
    );
    return { id: (exp as any).$id, uri };
  } catch (err) {
    console.warn('[export] cloud upload failed, returning local uri', err);
    return { id: 'local-only', uri };
  }
}

export class ExportRepositoryLocalPdf implements ExportRepository {
  async exportTimelinePdf(caseId: string): Promise<{ id: string; uri: string }> {
    const me = await account.get();
    const { record, events, documents } = await loadCase(caseId);
    const html = `
      <html><body style="font-family:Helvetica,Arial,sans-serif;color:#111;">
        ${header('Timeline Summary', record)}
        <h2 style="font-size:14px;">Chronological events (${events.length})</h2>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="background:#f0f0f0;"><th style="text-align:left;padding:4px;">Date</th><th style="text-align:left;padding:4px;">Type</th><th style="text-align:left;padding:4px;">Description</th></tr></thead>
          <tbody>
            ${events
              .map(
                (e) => `<tr>
                  <td style="padding:4px;border-bottom:1px solid #eee;white-space:nowrap;">${esc(format(new Date(e.occurredAt), 'yyyy-MM-dd'))}</td>
                  <td style="padding:4px;border-bottom:1px solid #eee;">${esc(e.eventType)}</td>
                  <td style="padding:4px;border-bottom:1px solid #eee;">${esc(e.description)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
        <h2 style="font-size:14px;margin-top:16px;">Linked documents (${documents.length})</h2>
        <ul style="font-size:11px;">
          ${documents.map((d) => `<li>${esc(d.title)} \u2014 <em>${esc(d.category)}</em></li>`).join('')}
        </ul>
        ${footer()}
      </body></html>`;
    return generatePdfAndUpload(html, `timeline-${caseId}.pdf`, me.$id);
  }

  async exportIssueSummaryPdf(caseId: string): Promise<{ id: string; uri: string }> {
    const me = await account.get();
    const { record, flags } = await loadCase(caseId);
    const groups: Record<string, IssueFlag[]> = {};
    for (const f of flags) (groups[f.type] ??= []).push(f);
    const html = `
      <html><body style="font-family:Helvetica,Arial,sans-serif;color:#111;">
        ${header('Issue Summary', record)}
        <p style="font-size:11px;color:#444;">Each item below is a <strong>possible issue to review</strong> with a licensed attorney. None of these are legal conclusions.</p>
        ${Object.entries(groups)
          .map(
            ([type, items]) => `
            <h2 style="font-size:13px;margin-top:14px;text-transform:uppercase;">${esc(type)} (${items.length})</h2>
            <ul style="font-size:11px;">
              ${items
                .map(
                  (i) => `<li style="margin-bottom:6px;">
                    <strong>[${esc(i.severity)}]</strong> ${esc(i.summary)}<br/>
                    <span style="color:#444;">${esc(i.explanation)}</span>
                  </li>`
                )
                .join('')}
            </ul>`
          )
          .join('')}
        ${footer()}
      </body></html>`;
    return generatePdfAndUpload(html, `issues-${caseId}.pdf`, me.$id);
  }

  async exportAttorneyPacket(caseId: string): Promise<{ id: string; uri: string }> {
    const me = await account.get();
    const { record, events, documents, flags } = await loadCase(caseId);
    const html = `
      <html><body style="font-family:Helvetica,Arial,sans-serif;color:#111;">
        ${header('Attorney Review Packet', record)}
        <h2 style="font-size:14px;">Case Posture</h2>
        <p style="font-size:11px;">Type: ${esc(record.caseType)} \u2014 Status: ${esc(record.status)}</p>
        <h2 style="font-size:14px;margin-top:14px;">Chronological narrative</h2>
        <ol style="font-size:11px;">
          ${events
            .map(
              (e) => `<li><strong>${esc(format(new Date(e.occurredAt), 'yyyy-MM-dd'))}</strong> \u2014 ${esc(e.eventType)} \u2014 ${esc(e.description)}</li>`
            )
            .join('')}
        </ol>
        <h2 style="font-size:14px;margin-top:14px;">Issue clusters</h2>
        <ul style="font-size:11px;">
          ${flags.map((f) => `<li><strong>[${esc(f.severity)}] ${esc(f.type)}:</strong> ${esc(f.summary)}<br/><em>${esc(f.explanation)}</em></li>`).join('')}
        </ul>
        <h2 style="font-size:14px;margin-top:14px;">Supporting documents</h2>
        <ul style="font-size:11px;">
          ${documents.map((d) => `<li>${esc(d.title)} \u2014 ${esc(d.category)}</li>`).join('')}
        </ul>
        <h2 style="font-size:14px;margin-top:14px;">Consent</h2>
        <p style="font-size:11px;">This packet was generated at the user\u2019s request for handoff to a licensed attorney or advocate for independent review.</p>
        <p style="font-size:10px;color:#555;">${esc(PATTERN_DISCLAIMER)}</p>
        ${footer()}
      </body></html>`;
    return generatePdfAndUpload(html, `attorney-packet-${caseId}.pdf`, me.$id);
  }

  async exportCalendarIcs(caseId: string): Promise<{ id: string; uri: string }> {
    const me = await account.get();
    const { record, events } = await loadCase(caseId);

    const escIcs = (s: string) =>
      (s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

    const toIcsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const vevent = (e: CaseEvent) =>
      [
        'BEGIN:VEVENT',
        `UID:${e.id}@family-rights-app`,
        `DTSTART:${toIcsDate(e.occurredAt)}`,
        `DTEND:${toIcsDate(e.occurredAt)}`,
        `SUMMARY:${escIcs(e.eventType.replace(/_/g, ' '))}`,
        `DESCRIPTION:${escIcs(e.description)}`,
        'END:VEVENT',
      ].join('\r\n');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//Family Rights App//${escIcs(record.title)}//EN`,
      `X-WR-CALNAME:${escIcs(record.title)}`,
      ...events.map(vevent),
      'END:VCALENDAR',
    ].join('\r\n');

    const fileName = `timeline-${caseId}.ics`;
    const localUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(localUri, icsContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    try {
      const upload = await storage.createFile(
        BUCKETS.exports,
        ID.unique(),
        { uri: localUri, name: fileName, type: 'text/calendar' } as any,
        ownerOnly(me.$id)
      );
      const exp = await databases.createDocument(
        DATABASE,
        COLLECTIONS.exports,
        ID.unique(),
        {
          ownerUserId: me.$id,
          fileName,
          bucketId: BUCKETS.exports,
          fileId: upload.$id,
          generatedAt: new Date().toISOString(),
          kind: 'calendar',
        },
        ownerOnly(me.$id)
      );
      return { id: (exp as any).$id, uri: localUri };
    } catch (err) {
      console.warn('[export] calendar cloud upload failed, returning local uri', err);
      return { id: 'local-only', uri: localUri };
    }
  }

  async exportDocumentZip(): Promise<{ id: string; uri: string }> {
    // ZIP creation on-device is heavy; we leave this as a server function in v1.
    // Returning a placeholder PDF that lists the documents and instructs the user.
    throw new Error('Document ZIP export is performed server-side. Trigger from web/admin portal.');
  }
}
