/**
 * Local case-summary generator — renders a markdown export of the SD38180 seed
 * data as it would be handed to an appellate clerk or civil-rights attorney.
 *
 * Run with: npx ts-node scripts/generate-case-summary.ts
 * Output:   exports/case-summary-sd38180-DRAFT.md
 *
 * Pulls structured data from src/infra/seed/sd38180-data.ts. This script has NO
 * React Native imports, so it runs cleanly under plain Node.
 */
import * as fs from 'fs';
import * as path from 'path';
import { SD38180_EVENTS, SD38180_FLAGS, type SeedEvent, type SeedFlag } from '../src/infra/seed/sd38180-data';

// ---------------------------------------------------------------------------
// Case metadata (mirrors what `seedSD38180IfFirstRun` writes into the case
// record / party repo). Hand-maintained here so the markdown export is
// self-contained.
// ---------------------------------------------------------------------------
const CASE = {
  title: 'In the Interest of K.C.G. — Appeal No. SD38180 (22AO-JU00288)',
  jurisdiction: 'Missouri Court of Appeals, Southern District (lower court: Jasper County, MO)',
  lowerCourt: '22AO-JU00288 (sibling case: 22AO-JU00287)',
  judge: 'Hon. Angela Austin Vorhees (paternity 2019 → TPR 2023)',
  tprTrial: '6/27/2023 · 10:03am–3:24pm · Joplin Juvenile Justice Center · transcribed by Sharon K. Rogers (Holliday Reporting, 131 pp.)',
  appellant: 'Matthew Preston Goodman (M.P.G.) — 8681 SE 71st St., Baxter Springs, KS 66713',
  child: 'K.C.G. ("Kody"), b. 10/13/2018',
  sibling: 'T.R.A. ("Trace") — case 22AO-JU00287',
  mother: 'B.L.M. ("Dawndee")',
};

const PARTIES = [
  ['Appellant (Father)', 'Matthew Preston Goodman (M.P.G.) — 8681 SE 71st St., Baxter Springs, KS 66713'],
  ['Child', 'K.C.G. ("Kody") — b. 10/13/2018'],
  ['Sibling', 'T.R.A. ("Trace") — separate case 22AO-JU00287'],
  ['Mother', 'B.L.M. ("Dawndee")'],
  ['Trial / Paternity Judge', 'Hon. Angela Austin Vorhees'],
  ['Attorney — pro bono (withdrew)', 'Kathleen Wolf Miller — later took prosecutorial role in Lawrence Co., MO'],
  ['Attorney — court-appointed (covertly)', 'Ron Sparling — appointed 2/23/2021; discovery 6/6/2022'],
  ['Attorney — appointed for trial', 'Spellman Robertson — appointed 10/26/2022; first met appellant day before trial'],
  ['DSS Supervisor', 'Jennifer Emmons — Children\u2019s Division, Jasper Co.'],
  ['DSS Specialist', 'Shania Riley — Children\u2019s Division, Jasper Co. (601 Commercial St., Joplin)'],
  ['DSS Circuit Manager', 'Brian Garrity, MSW — 29th Circuit'],
  ['DSS Specialist (Financials)', 'Shannon R. "Shay" Ewing — FSD, Rolla MO'],
  ['DSS Caseworker', 'Mellisa Holcomb'],
];

// ---------------------------------------------------------------------------
// Sorting + formatting helpers
// ---------------------------------------------------------------------------
const SEVERITY_RANK: Record<string, number> = { serious: 0, watch: 1, info: 2 };

function fmtDate(iso: string): string {
  // events are stored as 'YYYY-MM-DD'
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}

function eventTypeLabel(t: string): string {
  const map: Record<string, string> = {
    other: 'Event',
    report: 'Report',
    home_visit: 'Home Visit',
    removal: 'Removal',
    shelter_hearing: 'Shelter Hearing',
    adjudication: 'Adjudication',
    review_hearing: 'Review Hearing',
    permanency_hearing: 'Permanency Hearing',
    service_plan: 'Service Plan',
    drug_test: 'Drug Test',
    visit: 'Visit',
    tpr_petition: 'TPR Petition',
    tpr_trial: 'TPR Trial',
    tpr_judgment: 'TPR Judgment',
    appeal: 'Appeal',
    meeting: 'Meeting',
  };
  return map[t] ?? t;
}

function issueTypeLabel(t: string): string {
  const map: Record<string, string> = {
    notice: 'Notice / Service',
    counsel: 'Right to Counsel',
    hearing_delay: 'Hearing Delay',
    reasonable_efforts: 'Reasonable Efforts',
    chemical_dependency: 'Chemical Dependency',
    evidence_quality: 'Evidence Quality',
    service_access: 'Service Access',
    visitation: 'Visitation',
    placement: 'Placement',
    other: 'Other',
  };
  return map[t] ?? t;
}

function severityBadge(s: string): string {
  if (s === 'serious') return '🟥 SERIOUS';
  if (s === 'watch') return '🟧 WATCH';
  return '🟦 INFO';
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const now = new Date().toISOString().replace('T', ' ').replace(/\..+/, '') + ' UTC';

const eventsSorted = [...SD38180_EVENTS].sort((a, b) => a.at.localeCompare(b.at));
const flagsSorted = [...SD38180_FLAGS].sort((a, b) => {
  const sr = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
  if (sr !== 0) return sr;
  return a.type.localeCompare(b.type);
});

const lines: string[] = [];

lines.push(`# Case Summary — ${CASE.title}`);
lines.push('');
lines.push(`> **Draft export generated locally for review.**`);
lines.push(`> Source: \`src/infra/seed/sd38180-data.ts\` · Rendered: ${now}`);
lines.push('');
lines.push('---');
lines.push('');

// ----- Case header -----
lines.push('## 1. Case Header');
lines.push('');
lines.push(`- **Appellate cause:** ${CASE.title}`);
lines.push(`- **Jurisdiction:** ${CASE.jurisdiction}`);
lines.push(`- **Lower-court cause:** ${CASE.lowerCourt}`);
lines.push(`- **Judge:** ${CASE.judge}`);
lines.push(`- **TPR trial:** ${CASE.tprTrial}`);
lines.push('');

// ----- Parties -----
lines.push('## 2. Parties & Participants');
lines.push('');
for (const [role, who] of PARTIES) {
  lines.push(`- **${role}:** ${who}`);
}
lines.push('');

// ----- Issue flags summary -----
lines.push('## 3. Issue Flags — Possible Concerns to Review');
lines.push('');
lines.push(`> Each flag is phrased as a **possible … to review** finding. None of these are legal conclusions; they are pattern signals derived from the evidentiary record for attorney review.`);
lines.push('');
lines.push(`Total flags: **${flagsSorted.length}** (` +
  `serious: ${flagsSorted.filter(f => f.severity === 'serious').length}, ` +
  `watch: ${flagsSorted.filter(f => f.severity === 'watch').length}, ` +
  `info: ${flagsSorted.filter(f => f.severity === 'info').length}` +
  `)`);
lines.push('');

for (const f of flagsSorted) {
  lines.push(`### ${severityBadge(f.severity)} · ${issueTypeLabel(f.type)}`);
  lines.push('');
  lines.push(`**${f.summary}**`);
  lines.push('');
  lines.push(f.explanation);
  lines.push('');
  if (f.sourceRefs.length) {
    lines.push(`*Source refs:* ${f.sourceRefs.map(r => '`' + r + '`').join(', ')}`);
    lines.push('');
  }
}

// ----- Timeline -----
lines.push('## 4. Timeline of Events');
lines.push('');
lines.push(`Total events: **${eventsSorted.length}** (chronological).`);
lines.push('');
lines.push('| Date | Type | Description | Tags |');
lines.push('| --- | --- | --- | --- |');
for (const e of eventsSorted) {
  const tags = (e.tags ?? []).map(t => '`' + t + '`').join(' ');
  const desc = e.desc.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  lines.push(`| ${fmtDate(e.at)} | ${eventTypeLabel(e.type)} | ${desc} | ${tags} |`);
}
lines.push('');

// ----- Counts / index -----
lines.push('## 5. Index Counts');
lines.push('');
const tagCounts: Record<string, number> = {};
for (const e of eventsSorted) {
  for (const t of e.tags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
}
const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 25);
lines.push('**Top 25 timeline tags by frequency:**');
lines.push('');
for (const [t, n] of topTags) {
  lines.push(`- \`${t}\` — ${n}`);
}
lines.push('');

// ----- Disclaimer -----
lines.push('---');
lines.push('');
lines.push('## Disclaimer');
lines.push('');
lines.push('> This document is a machine-assisted export of structured case data. It does not constitute legal advice and is not a substitute for review by qualified counsel. Every issue flag is phrased as a possible concern to review — none of the flags are legal conclusions. Underlying evidentiary documents (correspondence, .eml exhibits, court filings) are wired into the seed module and not embedded inline here.');
lines.push('');
lines.push(`Generated by \`scripts/generate-case-summary.ts\` at ${now}.`);
lines.push('');

// Write to file
const outDir = path.resolve(__dirname, '../exports');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'case-summary-sd38180-DRAFT.md');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

console.log(`Wrote ${outPath}`);
console.log(`  ${eventsSorted.length} events, ${flagsSorted.length} flags`);
