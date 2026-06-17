// Bundles assets/seed-case-sd38180/extracted-text/*.txt into a single JSON
// keyed by basename. Run before commit / CI so the seed module ships with
// extracted text for the prejudicial-language scanner.

import fs from 'node:fs';
import path from 'node:path';

const TEXT_DIR = path.resolve(__dirname, '..', 'assets', 'seed-case-sd38180', 'extracted-text');
const OUT = path.resolve(__dirname, '..', 'src', 'infra', 'seed', 'sd38180-extracted-text.generated.json');

function main() {
  const entries: Record<string, string> = {};
  if (!fs.existsSync(TEXT_DIR)) {
    console.warn('[build] no extracted-text dir at', TEXT_DIR);
    fs.writeFileSync(OUT, '{}');
    return;
  }
  for (const f of fs.readdirSync(TEXT_DIR)) {
    if (!f.endsWith('.txt')) continue;
    const key = f.replace(/\.txt$/, '');
    const body = fs.readFileSync(path.join(TEXT_DIR, f), 'utf8');
    entries[key] = body;
  }
  fs.writeFileSync(OUT, JSON.stringify(entries, null, 2));
  console.log(`[build] wrote ${OUT} with ${Object.keys(entries).length} sidecar entries`);
}

main();
