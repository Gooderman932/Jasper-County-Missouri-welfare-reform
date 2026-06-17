// Dry-run the prejudicial-language scanner against the bundled SD38180
// extracted-text corpus and print a summary. Doesn't write anything.
//
// Usage: npx ts-node --transpile-only scripts/dry-run-prejudicial-scan.ts

import fs from 'node:fs';
import path from 'node:path';
import { scanDocument } from '../src/domain/services/prejudicialLanguage';
import type { DocumentCategory } from '../src/domain/entities';

function inferCategory(key: string): DocumentCategory {
  const k = key.toLowerCase();
  if (k.includes('motion') || k.includes('petition')) return 'petition';
  if (k.includes('order') || k.includes('judgment')) return 'court_order';
  if (k.includes('transcript')) return 'transcript';
  if (k.includes('service-plan') || k.includes('written-service')) return 'service_plan';
  if (k.includes('drug') || k.includes('hair-follicle')) return 'drug_test';
  if (k.includes('school') || k.includes('enrollment')) return 'school';
  if (k.includes('medical') || k.includes('evaluation')) return 'medical';
  return 'correspondence';
}

const DIR = path.resolve(__dirname, '..', 'assets', 'seed-case-sd38180', 'extracted-text');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.txt'));

let totalFindings = 0;
let totalHits = 0;
const bySev: Record<string, number> = { info: 0, watch: 0, serious: 0 };
const byRule: Record<string, number> = {};
const topFlagged: Array<{ key: string; n: number }> = [];

for (const f of files) {
  const key = f.replace(/\.txt$/, '');
  const text = fs.readFileSync(path.join(DIR, f), 'utf8');
  const result = scanDocument({
    documentId: key,
    documentTitle: key,
    category: inferCategory(key),
    extractedText: text,
  });
  totalHits += result.hits.length;
  totalFindings += result.findings.length;
  for (const finding of result.findings) {
    bySev[finding.severity] = (bySev[finding.severity] ?? 0) + 1;
    byRule[finding.ruleId] = (byRule[finding.ruleId] ?? 0) + 1;
  }
  if (result.findings.length > 0) topFlagged.push({ key, n: result.findings.length });
}

topFlagged.sort((a, b) => b.n - a.n);

console.log('='.repeat(72));
console.log('SD38180 prejudicial-language scan — dry run');
console.log('='.repeat(72));
console.log(`Documents scanned:           ${files.length}`);
console.log(`Documents with >=1 finding:  ${topFlagged.length}`);
console.log(`Total raw hits:              ${totalHits}`);
console.log(`Total findings:              ${totalFindings}`);
console.log(`  serious: ${bySev.serious}   watch: ${bySev.watch}   info: ${bySev.info}`);
console.log('');
console.log('Top documents by finding count:');
for (const t of topFlagged.slice(0, 15)) {
  console.log(`  ${String(t.n).padStart(3)}  ${t.key}`);
}
console.log('');
console.log('Hits per rule:');
for (const [r, n] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${r}`);
}
