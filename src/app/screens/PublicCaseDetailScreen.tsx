import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScrollView, RefreshControl, View } from 'react-native';
import { format } from 'date-fns';
import { Body, Button, Card, H1, H2, Screen, SeverityBadge } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import {
  CaseEvent,
  CaseParty,
  CaseRecord,
  DocumentRecord,
  IssueFlag,
  RedactionPolicy,
} from '@domain/entities';
import {
  RedactionContext,
  redactDocument,
  redactEvent,
  redactIssueFlag,
  redactParty,
  isDocumentPublicUnderPolicy,
} from '@domain/services/redaction';
import { makeSd38180RedactionContext } from '@infra/seed/sd38180-redaction';

/**
 * Read-only view of a public case.
 *
 * Defense-in-depth: even though the case data was redacted at publish time,
 * we re-apply the redaction context client-side using whatever policy is
 * attached to the case. For the SD38180 reference case we use its hardcoded
 * identity rules; for other public cases we fall back to a "scrub-only"
 * context that still removes phones / emails / addresses / SSNs.
 */
export function PublicCaseDetailScreen({ route, navigation }: any) {
  const { caseId, slug } = route.params ?? {};
  const { container, user } = useApp();
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [parties, setParties] = useState<CaseParty[]>([]);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [flags, setFlags] = useState<IssueFlag[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      let r: CaseRecord | null = null;
      if (slug) {
        r = await container.cases.getPublicCaseBySlug(slug);
      } else if (caseId) {
        r = await container.cases.getCaseById(caseId);
      }
      setRecord(r);
      if (!r) return;
      const [p, e, d, f] = await Promise.all([
        container.parties.listParties(r.id),
        container.events.listEvents(r.id),
        container.documents.listDocuments(r.id),
        container.issues.listIssueFlags(r.id),
      ]);
      // Filter to only public-visibility items in case the back-end returns mixed.
      setParties(p);
      setEvents(e.filter((x) => x.visibility !== 'private'));
      setDocuments(
        d.filter(
          (x) => x.visibility !== 'private' && isDocumentPublicUnderPolicy(x, r!.redactionPolicy ?? defaultPolicy()),
        ),
      );
      setFlags(f.filter((x) => x.visibility !== 'private'));
    } finally {
      setRefreshing(false);
    }
  }, [container, caseId, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const ctx: RedactionContext = useMemo(() => {
    if (!record) return scrubOnlyContext();
    // SD38180 reference case uses its hardcoded identity rules.
    if (record.isReferenceCase && record.publicSlug?.startsWith('sd38180')) {
      return makeSd38180RedactionContext();
    }
    return {
      policy: record.redactionPolicy ?? defaultPolicy(),
      identities: [],
      minorDobs: [],
    };
  }, [record]);

  if (!record) {
    return (
      <Screen>
        <Body>Loading…</Body>
      </Screen>
    );
  }

  const redactedParties = parties.map((p) => redactParty(p, ctx));
  const redactedEvents = events.map((e) => redactEvent(e, ctx));
  const redactedDocs = documents.map((d) => redactDocument(d, ctx));
  const redactedFlags = flags.map((f) => redactIssueFlag(f, ctx));

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <View
          style={{
            padding: 12,
            backgroundColor: '#1f2937',
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <Body style={{ color: '#e5e7eb', fontWeight: '600' }}>
            Public reference case · read-only
          </Body>
          <Body style={{ color: '#9ca3af' }}>
            Identifying information about minors and private parties has been redacted under the
            case publisher's redaction policy. This page is for education and advocacy, not legal
            advice.
          </Body>
        </View>

        <H1>{record.publicTitle ?? record.title}</H1>
        <Body muted>
          {record.caseType} · {record.jurisdictionState}
          {record.jurisdictionCounty ? ` · ${record.jurisdictionCounty}` : ''} · {record.status}
        </Body>
        {record.publicSummary ? <Body>{record.publicSummary}</Body> : null}

        <H2>Parties</H2>
        {redactedParties.length === 0 ? (
          <Body muted>No parties listed.</Body>
        ) : (
          redactedParties.map((p) => (
            <Card key={p.id}>
              <Body style={{ fontWeight: '600' }}>{p.displayLabel}</Body>
              <Body muted>{p.role}</Body>
            </Card>
          ))
        )}

        <H2>Timeline ({redactedEvents.length})</H2>
        {redactedEvents.map((e) => (
          <Card key={e.id}>
            <Body style={{ fontWeight: '600' }}>
              {format(new Date(e.occurredAt), 'yyyy-MM-dd')} — {e.eventType}
            </Body>
            <Body>{e.description}</Body>
            {e.tags.length > 0 && <Body muted>Tags: {e.tags.join(', ')}</Body>}
          </Card>
        ))}

        <H2>Documents ({redactedDocs.length})</H2>
        {redactedDocs.map((d) => (
          <Card key={d.id}>
            <Body style={{ fontWeight: '600' }}>{d.title}</Body>
            <Body muted>
              {d.category} · {d.mimeType}
            </Body>
          </Card>
        ))}

        <H2>Issue flags ({redactedFlags.length})</H2>
        {redactedFlags.map((f) => (
          <Card key={f.id}>
            <SeverityBadge severity={f.severity} />
            <Body style={{ fontWeight: '600', marginTop: 4 }}>{f.summary}</Body>
            <Body muted>{f.explanation}</Body>
          </Card>
        ))}

        {user ? (
          <Button
            label="Report content"
            variant="secondary"
            onPress={() => navigation.navigate('ReportContent', { caseId: record.id })}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function defaultPolicy(): RedactionPolicy {
  return {
    childPii: 'initials_birthyear',
    ownerPii: 'initials_city',
    thirdParties: 'public_full_private_initials',
    documents: 'all_visible',
  };
}

function scrubOnlyContext(): RedactionContext {
  return {
    policy: defaultPolicy(),
    identities: [],
    minorDobs: [],
  };
}
