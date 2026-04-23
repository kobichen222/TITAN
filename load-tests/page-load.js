#!/usr/bin/env node
/*
 * DJ TITAN — page-load weight analyzer
 * Zero-dependency Node script. Measures:
 *   - HTML TTFB and total download time
 *   - HTML size, gzipped size
 *   - All linked/embedded asset URLs + individual sizes and latencies
 *   - Total page weight and byte breakdown (html/js/css/images/other)
 *   - Embedded-asset cost (<script>/<style> inline blocks)
 *
 * The DJ app is a single giant HTML file, so "bundle size" here really means
 * the weight of pioneer-dj-pro-max-v2.html and everything it references.
 *
 *   node load-tests/page-load.js --url http://localhost:3000/
 *   node load-tests/page-load.js --url http://localhost:3000/pioneer-dj-pro-max-v2.html
 */

const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { url: 'http://localhost:3000/', runs: 1, json: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i], next = argv[i+1];
    if (a === '--url') { args.url = next; i++; }
    else if (a === '--runs' || a === '-n') { args.runs = +next; i++; }
    else if (a === '--json') { args.json = next; i++; }
    else if (a === '-h' || a === '--help') {
      console.log('usage: page-load.js --url <URL> [--runs N] [--json OUT]'); process.exit(0);
    }
  }
  return args;
}

function fetch(rawUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(rawUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const t0 = process.hrtime.bigint();
    let ttfbNs = null;
    const req = mod.request({
      method: 'GET',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: { 'accept-encoding': 'gzip, deflate, br', 'user-agent': 'titan-pageload/1.0' },
    }, (res) => {
      ttfbNs = Number(process.hrtime.bigint() - t0);
      const chunks = [];
      let raw = 0;
      res.on('data', c => { chunks.push(c); raw += c.length; });
      res.on('end', () => {
        const totalNs = Number(process.hrtime.bigint() - t0);
        let body = Buffer.concat(chunks);
        const enc = (res.headers['content-encoding']||'').toLowerCase();
        try {
          if (enc === 'gzip')     body = zlib.gunzipSync(body);
          else if (enc === 'br')  body = zlib.brotliDecompressSync(body);
          else if (enc === 'deflate') body = zlib.inflateSync(body);
        } catch (_) { /* leave raw */ }
        resolve({
          status: res.statusCode, headers: res.headers, url: rawUrl,
          body, rawBytes: raw, decodedBytes: body.length,
          ttfbMs: ttfbNs/1e6, totalMs: totalNs/1e6,
          encoding: enc || 'identity',
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Cheap HTML scanner that captures linked + embedded assets. Doesn't need to
// be a real parser — good enough for static <link>/<script>/<img>/<source>.
function scanAssets(html, baseUrl) {
  const linked = [];
  const inlineScriptBytes = [];
  const inlineStyleBytes = [];
  const urlFrom = (u) => {
    // reject obvious non-URLs: template-literal placeholders, whitespace,
    // data:/blob:/javascript: schemes, or anything that doesn't look like a path
    if (!u || /[${}<>\s`]/.test(u)) return null;
    if (/^(data|blob|javascript|about|mailto|tel):/i.test(u)) return null;
    try { return new URL(u, baseUrl).toString(); } catch { return null; }
  };

  const linkRe   = /<link\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const styleRe  = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const imgRe    = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;
  const srcRe    = /<(source|audio|video|iframe)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;

  let m;
  while ((m = linkRe.exec(html))) {
    const u = urlFrom(m[1]); if (u) linked.push({ type: 'link', url: u });
  }
  while ((m = scriptRe.exec(html))) {
    const attrs = m[1], body = m[2];
    const srcMatch = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (srcMatch) { const u = urlFrom(srcMatch[1]); if (u) linked.push({ type: 'script', url: u }); }
    else if (body.trim().length) inlineScriptBytes.push(Buffer.byteLength(body,'utf8'));
  }
  while ((m = styleRe.exec(html))) {
    const body = m[1]; if (body.trim().length) inlineStyleBytes.push(Buffer.byteLength(body,'utf8'));
  }
  while ((m = imgRe.exec(html))) { const u = urlFrom(m[1]); if (u) linked.push({ type: 'img', url: u }); }
  while ((m = srcRe.exec(html))) { const u = urlFrom(m[2]); if (u) linked.push({ type: m[1], url: u }); }

  return { linked, inlineScriptBytes, inlineStyleBytes };
}

function classify(url, type) {
  const ext = (url.split('?')[0].match(/\.[a-z0-9]+$/i)||[''])[0].toLowerCase();
  if (type === 'script' || ext === '.js' || ext === '.mjs') return 'js';
  if (type === 'link' && /\.css/.test(url)) return 'css';
  if (/\.(css)$/.test(ext)) return 'css';
  if (/\.(png|jpg|jpeg|gif|webp|svg|avif|ico)$/.test(ext)) return 'img';
  if (/\.(woff2?|ttf|otf)$/.test(ext)) return 'font';
  if (/\.(mp3|wav|ogg|m4a|flac)$/.test(ext)) return 'audio';
  if (/\.(json|wasm|map)$/.test(ext)) return 'other';
  return 'other';
}

function fmtBytes(v) {
  return v >= 1e6 ? (v/1e6).toFixed(2)+' MB' : v >= 1e3 ? (v/1e3).toFixed(1)+' KB' : v+' B';
}
function fmtMs(v) { return v.toFixed(1) + ' ms'; }

async function runOnce(url) {
  const page = await fetch(url);
  if (page.status >= 400) throw new Error('page returned ' + page.status + ' for ' + url);
  const html = page.body.toString('utf8');
  const gzHtml = zlib.gzipSync(page.body).length;
  const { linked, inlineScriptBytes, inlineStyleBytes } = scanAssets(html, url);

  const assetResults = [];
  for (const a of linked) {
    try {
      const r = await fetch(a.url);
      assetResults.push({
        url: a.url, type: a.type, kind: classify(a.url, a.type),
        status: r.status, bytes: r.decodedBytes, rawBytes: r.rawBytes,
        ttfbMs: r.ttfbMs, totalMs: r.totalMs, encoding: r.encoding,
      });
    } catch (e) {
      assetResults.push({ url: a.url, type: a.type, kind: classify(a.url, a.type), status: 0, err: e.message });
    }
  }

  return { page, htmlGz: gzHtml, inlineScriptBytes, inlineStyleBytes, assetResults };
}

async function main() {
  const args = parseArgs(process.argv);
  console.log('──────────────────────────────────────────────');
  console.log(' DJ TITAN · PAGE LOAD TEST');
  console.log('──────────────────────────────────────────────');
  console.log(' target : ' + args.url);
  console.log(' runs   : ' + args.runs);
  console.log('──────────────────────────────────────────────');

  const runs = [];
  for (let i = 0; i < args.runs; i++) {
    process.stdout.write('  run ' + (i+1) + '/' + args.runs + '… ');
    const r = await runOnce(args.url);
    process.stdout.write('done (ttfb ' + fmtMs(r.page.ttfbMs) + ', total ' + fmtMs(r.page.totalMs) + ')\n');
    runs.push(r);
  }
  const last = runs[runs.length-1];

  // Aggregate sizes from last run (assets identical across runs)
  const inlineScript = last.inlineScriptBytes.reduce((a,b)=>a+b,0);
  const inlineStyle  = last.inlineStyleBytes.reduce((a,b)=>a+b,0);
  const byKind = { html:0, js:0, css:0, img:0, font:0, audio:0, other:0 };
  byKind.html = last.page.decodedBytes;
  for (const a of last.assetResults) if (a.bytes) byKind[a.kind] += a.bytes;
  const totalWeight = Object.values(byKind).reduce((a,b)=>a+b,0);
  const totalAssetMs = last.assetResults.reduce((a,b)=>a + (b.totalMs||0), 0);

  const ttfbs  = runs.map(r => r.page.ttfbMs).sort((a,b)=>a-b);
  const totals = runs.map(r => r.page.totalMs).sort((a,b)=>a-b);
  const med = (a) => a.length % 2 ? a[(a.length-1)>>1] : (a[a.length/2-1]+a[a.length/2])/2;

  console.log('');
  console.log(' HTML document');
  console.log('──────────────────────────────────────────────');
  console.log(' status            : ' + last.page.status + '  (' + last.page.encoding + ')');
  console.log(' ttfb     (median) : ' + fmtMs(med(ttfbs)));
  console.log(' total    (median) : ' + fmtMs(med(totals)));
  console.log(' size              : ' + fmtBytes(last.page.decodedBytes) + '  (over wire ' + fmtBytes(last.page.rawBytes) + ')');
  console.log(' gzip              : ' + fmtBytes(last.htmlGz) + '  (' + (100*last.htmlGz/last.page.decodedBytes).toFixed(1) + '% of raw)');
  console.log(' inline <script>   : ' + fmtBytes(inlineScript) + '  (' + last.inlineScriptBytes.length + ' blocks)');
  console.log(' inline <style>    : ' + fmtBytes(inlineStyle)  + '  (' + last.inlineStyleBytes.length + ' blocks)');

  console.log('');
  console.log(' Linked assets (' + last.assetResults.length + ')');
  console.log('──────────────────────────────────────────────');
  if (last.assetResults.length === 0) {
    console.log('   (no external assets — everything inlined in the HTML)');
  } else {
    for (const a of last.assetResults.sort((a,b) => (b.bytes||0) - (a.bytes||0))) {
      const short = a.url.length > 58 ? '…' + a.url.slice(-57) : a.url;
      const size = a.bytes ? fmtBytes(a.bytes) : '—';
      const ms   = a.totalMs ? fmtMs(a.totalMs) : (a.err||'err');
      console.log('   [' + a.kind.padEnd(5) + '] ' + short.padEnd(60) + size.padStart(9) + '  ' + ms);
    }
  }

  console.log('');
  console.log(' Weight breakdown');
  console.log('──────────────────────────────────────────────');
  for (const [k,v] of Object.entries(byKind)) {
    const pct = totalWeight ? (100*v/totalWeight).toFixed(1) : '0.0';
    console.log('   ' + k.padEnd(6) + fmtBytes(v).padStart(10) + '   ' + pct + '%');
  }
  console.log('   ' + '─'.repeat(32));
  console.log('   ' + 'total'.padEnd(6) + fmtBytes(totalWeight).padStart(10));
  console.log('   asset wall time (serialized): ' + fmtMs(totalAssetMs));

  console.log('');
  console.log(' Verdict');
  console.log('──────────────────────────────────────────────');
  const grade =
    totalWeight > 10 * 1048576 ? 'FAIL (> 10 MB page weight)' :
    totalWeight >  3 * 1048576 ? 'WARN (> 3 MB page weight)' :
    med(totals)  > 1500        ? 'WARN (slow total load)'   :
    'OK';
  console.log('   ' + grade);

  if (args.json) {
    fs.writeFileSync(path.resolve(args.json), JSON.stringify({
      target: args.url, runs: runs.length,
      html: { status: last.page.status, bytes: last.page.decodedBytes, gzip: last.htmlGz,
              ttfbMsMedian: med(ttfbs), totalMsMedian: med(totals) },
      assets: last.assetResults, byKind, totalWeight, grade,
    }, null, 2));
    console.log(' wrote ' + args.json);
  }
  console.log('──────────────────────────────────────────────');
}

main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
