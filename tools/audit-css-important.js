#!/usr/bin/env node
/* DJ TITAN — CSS !important audit.
   We have ~1,144 !important rules across legacy/styles.css. Removing
   them blindly will break the cascade in unpredictable ways. This
   tool ranks selectors by !important density so you can pick the
   highest-leverage clusters to refactor first.

   Usage:
     node tools/audit-css-important.js          # top 30 by count
     node tools/audit-css-important.js --all    # full list
     node tools/audit-css-important.js -n 50    # top N */

const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', 'public/legacy/styles.css');
if (!fs.existsSync(file)) {
  console.error('Missing', file);
  process.exit(1);
}
const css = fs.readFileSync(file, 'utf8');

/* Strip /* ... *​/ comments so they don't pollute the count. */
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

/* Walk top-level rule blocks. We don't need a full CSS parser —
   a brace counter that respects @media nesting is enough for an audit. */
const blocks = [];
let depth = 0;
let buf = '';
let selector = '';
for (let i = 0; i < stripped.length; i++) {
  const ch = stripped[i];
  if (ch === '{') {
    if (depth === 0) {
      selector = buf.trim();
      buf = '';
    } else {
      buf += ch;
    }
    depth++;
  } else if (ch === '}') {
    depth--;
    if (depth === 0) {
      blocks.push({ selector, body: buf });
      buf = '';
      selector = '';
    } else {
      buf += ch;
    }
  } else {
    buf += ch;
  }
}

/* For each rule block, count !important declarations. We aggregate
   by *normalized* selector (lowercase, single-spaced, comma-list
   sorted) so .foo, .bar and .bar, .foo collapse to one line. */
const tally = new Map();
let total = 0;
for (const b of blocks) {
  if (!b.selector) continue;
  const importants = (b.body.match(/!important/g) || []).length;
  if (!importants) continue;
  total += importants;
  const norm = b.selector
    .toLowerCase()
    .split(',')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .sort()
    .join(', ');
  const cur = tally.get(norm) || { count: 0, blocks: 0 };
  cur.count += importants;
  cur.blocks += 1;
  tally.set(norm, cur);
}

const sorted = [...tally.entries()].sort((a, b) => b[1].count - a[1].count);

const args = process.argv.slice(2);
const all = args.includes('--all');
const nIdx = args.indexOf('-n');
const N = all ? sorted.length : nIdx >= 0 ? +args[nIdx + 1] || 30 : 30;

console.log(`!important declarations: ${total} across ${tally.size} unique selectors`);
console.log(`Top ${Math.min(N, sorted.length)}:\n`);
console.log('  COUNT  BLOCKS  SELECTOR');
console.log('  -----  ------  ' + '-'.repeat(70));
for (let i = 0; i < Math.min(N, sorted.length); i++) {
  const [sel, info] = sorted[i];
  const trimmed = sel.length > 80 ? sel.slice(0, 77) + '...' : sel;
  console.log(
    '  ' +
      String(info.count).padStart(5) +
      '  ' +
      String(info.blocks).padStart(6) +
      '  ' +
      trimmed,
  );
}

if (!all) {
  console.log(`\n(showing ${N} of ${sorted.length}; pass --all for full list)`);
}
