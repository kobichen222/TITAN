#!/usr/bin/env node
/* DJ TITAN — bundle size budget gate.
   Runs in CI (and locally via `npm run budget`). Fails the build if
   any tracked asset exceeds its budget. Bytes are measured on the raw
   file; gzip is what users actually pay for, but raw bytes are easier
   to reason about and correlate 1:1 with parse cost. */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');

/* Budgets are intentionally a touch above current sizes so a small
   addition doesn't trip CI, but a 10%+ regression does. Bump
   deliberately when you genuinely need more room. */
const BUDGETS = [
  { file: 'public/index.html',                  raw: 250_000, gzip:  55_000 },
  { file: 'public/legacy/app.js',               raw: 700_000, gzip: 185_000 },
  { file: 'public/legacy/styles.css',           raw: 720_000, gzip: 135_000 },
  { file: 'public/legacy/error-reporter.js',    raw:   8_000, gzip:   3_000 },
  { file: 'public/legacy/radio.js',             raw:  20_000, gzip:   6_000 },
  { file: 'public/legacy/clock.js',             raw:   2_000, gzip:   1_000 },
  { file: 'public/legacy/support.js',           raw:  10_000, gzip:   4_000 },
  { file: 'public/legacy/discover.js',          raw:  18_000, gzip:   6_000 },
  { file: 'public/legacy/downloads.js',         raw:  16_000, gzip:   6_000 },
  { file: 'public/sw.js',                       raw:   8_000, gzip:   3_000 },
];

let failed = 0;
const rows = [];

for (const b of BUDGETS) {
  const abs = path.join(ROOT, b.file);
  if (!fs.existsSync(abs)) {
    rows.push({ file: b.file, status: 'MISSING', raw: '-', gzip: '-' });
    failed++;
    continue;
  }
  const data = fs.readFileSync(abs);
  const raw = data.length;
  const gzip = zlib.gzipSync(data).length;
  const rawOver = raw > b.raw;
  const gzOver  = gzip > b.gzip;
  const status = rawOver || gzOver ? 'OVER' : 'OK';
  if (status === 'OVER') failed++;
  rows.push({
    file: b.file,
    status,
    raw: `${raw}/${b.raw}`,
    gzip: `${gzip}/${b.gzip}`,
  });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('FILE', 38), pad('STATUS', 8), pad('RAW (b/budget)', 20), pad('GZIP (b/budget)', 20));
console.log('-'.repeat(86));
for (const r of rows) {
  console.log(pad(r.file, 38), pad(r.status, 8), pad(r.raw, 20), pad(r.gzip, 20));
}

if (failed) {
  console.error(`\n${failed} asset(s) over budget. Trim or update tools/check-bundle-budget.js.`);
  process.exit(1);
}
console.log('\nAll assets within budget.');
