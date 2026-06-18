#!/usr/bin/env tsx
/**
 * integrate-eml-batch.ts
 * Parse .eml files from a source dir, extract plain-text + attachment metadata,
 * and write normalized .txt files into assets/seed-case-sd38180/extracted-text/.
 *
 * Stays pure Node — no external email parser dep.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = process.argv[2];
const DEST = path.join(
  __dirname,
  '..',
  'assets',
  'seed-case-sd38180',
  'extracted-text',
);
const ORIG_DEST = path.join(
  __dirname,
  '..',
  'assets',
  'seed-case-sd38180',
  'emails-original',
);

if (!SRC) {
  console.error('Usage: tsx integrate-eml-batch.ts <source-dir>');
  process.exit(1);
}

fs.mkdirSync(DEST, { recursive: true });
fs.mkdirSync(ORIG_DEST, { recursive: true });

function decodeQuotedPrintable(s: string): string {
  return s
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function decodeBase64(s: string): string {
  try {
    return Buffer.from(s.replace(/\s+/g, ''), 'base64').toString('utf8');
  } catch {
    return s;
  }
}

interface ParsedEml {
  headers: Record<string, string>;
  bodyText: string;
  attachments: { filename: string; contentType: string; sizeBytes: number }[];
}

function parseEml(raw: string): ParsedEml {
  const headerEnd = raw.indexOf('\r\n\r\n') !== -1
    ? raw.indexOf('\r\n\r\n')
    : raw.indexOf('\n\n');
  const headerBlock = raw.slice(0, headerEnd);
  const body = raw.slice(headerEnd).replace(/^\s+/, '');

  // Unfold headers (RFC 5322 line folding)
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, ' ');
  const headers: Record<string, string> = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z\-]+):\s*(.*)$/);
    if (m) headers[m[1].toLowerCase()] = m[2];
  }

  const contentType = headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);

  let bodyText = '';
  const attachments: ParsedEml['attachments'] = [];

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?`));
    for (const part of parts) {
      if (!part.trim()) continue;
      const partHeaderEnd = part.indexOf('\r\n\r\n') !== -1
        ? part.indexOf('\r\n\r\n')
        : part.indexOf('\n\n');
      if (partHeaderEnd === -1) continue;
      const partHeaderBlock = part.slice(0, partHeaderEnd).replace(/\r?\n[ \t]+/g, ' ');
      const partBody = part.slice(partHeaderEnd).replace(/^\s+/, '');
      const partHeaders: Record<string, string> = {};
      for (const line of partHeaderBlock.split(/\r?\n/)) {
        const m = line.match(/^([A-Za-z\-]+):\s*(.*)$/);
        if (m) partHeaders[m[1].toLowerCase()] = m[2];
      }
      const ctype = partHeaders['content-type'] || '';
      const disp = partHeaders['content-disposition'] || '';
      const encoding = (partHeaders['content-transfer-encoding'] || '').toLowerCase();

      const filenameMatch = disp.match(/filename="?([^";]+)"?/i) || ctype.match(/name="?([^";]+)"?/i);
      if (filenameMatch || /attachment/i.test(disp)) {
        const fname = filenameMatch ? filenameMatch[1] : 'unnamed-attachment';
        const sizeBytes = encoding === 'base64'
          ? Math.floor((partBody.replace(/\s+/g, '').length * 3) / 4)
          : partBody.length;
        attachments.push({
          filename: fname,
          contentType: ctype.split(';')[0].trim(),
          sizeBytes,
        });
        continue;
      }

      if (/text\/plain/i.test(ctype) && !bodyText) {
        if (encoding === 'base64') bodyText = decodeBase64(partBody);
        else if (encoding === 'quoted-printable') bodyText = decodeQuotedPrintable(partBody);
        else bodyText = partBody;
      } else if (/text\/html/i.test(ctype) && !bodyText) {
        let html = partBody;
        if (encoding === 'base64') html = decodeBase64(html);
        else if (encoding === 'quoted-printable') html = decodeQuotedPrintable(html);
        // Crude HTML → text
        bodyText = html
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n{3,}/g, '\n\n');
      }
    }
  } else {
    const encoding = (headers['content-transfer-encoding'] || '').toLowerCase();
    if (encoding === 'base64') bodyText = decodeBase64(body);
    else if (encoding === 'quoted-printable') bodyText = decodeQuotedPrintable(body);
    else bodyText = body;
  }

  return { headers, bodyText: bodyText.trim(), attachments };
}

const emlFiles = fs.readdirSync(SRC).filter(f => f.endsWith('.eml'));
console.log(`Found ${emlFiles.length} .eml files in ${SRC}\n`);

const results: { src: string; outTxt: string; subject: string; attachmentCount: number }[] = [];

for (const f of emlFiles) {
  const srcPath = path.join(SRC, f);
  const raw = fs.readFileSync(srcPath, 'utf8');
  const parsed = parseEml(raw);

  const baseName = f.replace(/\.eml$/, '');
  const outName = `${baseName}.txt`;
  const outPath = path.join(DEST, outName);

  // Copy original .eml to assets/seed-case-sd38180/emails-original/ for archival
  fs.copyFileSync(srcPath, path.join(ORIG_DEST, f));

  const lines: string[] = [];
  lines.push(`Source file: ${f}`);
  lines.push(`From: ${parsed.headers['from'] || ''}`);
  lines.push(`To: ${parsed.headers['to'] || ''}`);
  lines.push(`Date: ${parsed.headers['date'] || ''}`);
  lines.push(`Subject: ${parsed.headers['subject'] || ''}`);
  if (parsed.attachments.length > 0) {
    lines.push(`Attachments (${parsed.attachments.length}):`);
    for (const a of parsed.attachments) {
      lines.push(`  - ${a.filename} (${a.contentType}, ${a.sizeBytes} bytes)`);
    }
  }
  lines.push('');
  lines.push('---- BODY ----');
  lines.push(parsed.bodyText);

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  results.push({
    src: f,
    outTxt: outName,
    subject: parsed.headers['subject'] || '',
    attachmentCount: parsed.attachments.length,
  });

  console.log(`✓ ${f}`);
  console.log(`    → ${outName}`);
  console.log(`    Subject: ${parsed.headers['subject'] || ''}`);
  console.log(`    Attachments: ${parsed.attachments.length}`);
}

console.log('\nDone.');
console.table(results);
