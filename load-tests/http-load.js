#!/usr/bin/env node
/*
 * DJ TITAN — HTTP load test
 * Zero-dependency Node script. Hammers one or more URLs with a fixed level of
 * concurrency for a fixed duration and reports throughput, latency
 * percentiles, bytes/s and a status-code histogram.
 *
 *   node load-tests/http-load.js \
 *     --url http://localhost:3000/ \
 *     --url http://localhost:3000/pioneer-dj-pro-max-v2.html \
 *     --concurrency 20 --duration 20
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

function parseArgs(argv) {
  const args = { urls: [], concurrency: 10, duration: 15, timeout: 10000, warmup: 1 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i], next = argv[i+1];
    switch (a) {
      case '--url':         args.urls.push(next); i++; break;
      case '--concurrency':
      case '-c':            args.concurrency = +next; i++; break;
      case '--duration':
      case '-d':            args.duration = +next; i++; break;
      case '--timeout':     args.timeout = +next; i++; break;
      case '--warmup':      args.warmup = +next; i++; break;
      case '-h':
      case '--help':
        console.log('usage: http-load.js --url <u> [--url <u2>] [-c N] [-d SEC] [--timeout MS] [--warmup SEC]');
        process.exit(0);
    }
  }
  if (!args.urls.length) args.urls.push('http://localhost:3000/');
  return args;
}

function request(rawUrl, timeoutMs) {
  return new Promise((resolve) => {
    const url = new URL(rawUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const start = process.hrtime.bigint();
    const req = mod.request({
      method: 'GET',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: { 'user-agent': 'titan-load/1.0', 'accept': '*/*', 'connection': 'keep-alive' },
      agent: agentFor(url),
    }, (res) => {
      let bytes = 0;
      res.on('data', (c) => { bytes += c.length; });
      res.on('end', () => {
        const ns = Number(process.hrtime.bigint() - start);
        resolve({ ok: true, status: res.statusCode, bytes, ms: ns / 1e6, url: rawUrl });
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')); });
    req.on('error', (err) => {
      const ns = Number(process.hrtime.bigint() - start);
      resolve({ ok: false, status: 0, bytes: 0, ms: ns / 1e6, url: rawUrl, err: err.message });
    });
    req.end();
  });
}

const agents = new Map();
function agentFor(url) {
  const key = url.protocol + '//' + url.hostname + ':' + (url.port || '');
  if (!agents.has(key)) {
    const mod = url.protocol === 'https:' ? https : http;
    agents.set(key, new mod.Agent({ keepAlive: true, maxSockets: 1024 }));
  }
  return agents.get(key);
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function fmtMs(v)    { return v.toFixed(1) + ' ms'; }
function fmtBytes(v) { return v > 1e6 ? (v/1e6).toFixed(2)+' MB' : v > 1e3 ? (v/1e3).toFixed(1)+' KB' : v+' B'; }

async function runWorker(state, args) {
  let idx = 0;
  while (!state.stop) {
    const url = args.urls[idx++ % args.urls.length];
    const r = await request(url, args.timeout);
    if (state.recording) {
      state.latencies.push(r.ms);
      state.bytes += r.bytes;
      state.reqs++;
      state.byUrl[r.url] = (state.byUrl[r.url]||0) + 1;
      const bucket = r.ok ? String(r.status) : ('ERR:' + (r.err || 'unknown'));
      state.statuses[bucket] = (state.statuses[bucket]||0) + 1;
      if (!r.ok || r.status >= 400) state.errors++;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const state = { stop: false, recording: false, latencies: [], bytes: 0, reqs: 0, errors: 0, statuses: {}, byUrl: {} };

  console.log('──────────────────────────────────────────────');
  console.log(' DJ TITAN · HTTP LOAD TEST');
  console.log('──────────────────────────────────────────────');
  console.log(' targets     : ' + args.urls.join(', '));
  console.log(' concurrency : ' + args.concurrency);
  console.log(' duration    : ' + args.duration + 's (+ ' + args.warmup + 's warmup)');
  console.log(' timeout     : ' + args.timeout + 'ms');
  console.log('──────────────────────────────────────────────');

  const workers = Array.from({ length: args.concurrency }, () => runWorker(state, args));

  if (args.warmup > 0) await new Promise(r => setTimeout(r, args.warmup * 1000));
  state.recording = true;
  const t0 = Date.now();

  const tickInterval = setInterval(() => {
    const elapsed = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  t=${elapsed.toFixed(0).padStart(3)}s  reqs=${state.reqs.toString().padStart(6)}  errs=${state.errors}  rps=${(state.reqs/Math.max(elapsed,.001)).toFixed(0)}   `);
  }, 500);

  await new Promise(r => setTimeout(r, args.duration * 1000));
  state.recording = false;
  state.stop = true;
  clearInterval(tickInterval);
  process.stdout.write('\n');
  await Promise.all(workers);

  const elapsed = args.duration;
  const sorted = state.latencies.slice().sort((a,b)=>a-b);
  const sum = sorted.reduce((a,b)=>a+b,0);
  const mean = sum / (sorted.length || 1);

  console.log('');
  console.log(' RESULTS');
  console.log('──────────────────────────────────────────────');
  console.log(' total requests  : ' + state.reqs);
  console.log(' errors          : ' + state.errors + ' (' + (100*state.errors/Math.max(state.reqs,1)).toFixed(2) + '%)');
  console.log(' throughput      : ' + (state.reqs/elapsed).toFixed(1) + ' req/s');
  console.log(' data transfer   : ' + fmtBytes(state.bytes) + '  (' + fmtBytes(state.bytes/elapsed) + '/s)');
  console.log('');
  console.log(' latency         : mean ' + fmtMs(mean));
  console.log('                   p50  ' + fmtMs(pct(sorted,50)));
  console.log('                   p90  ' + fmtMs(pct(sorted,90)));
  console.log('                   p95  ' + fmtMs(pct(sorted,95)));
  console.log('                   p99  ' + fmtMs(pct(sorted,99)));
  console.log('                   max  ' + fmtMs(sorted[sorted.length-1] || 0));
  console.log('');
  console.log(' status codes    :');
  for (const [s,n] of Object.entries(state.statuses).sort((a,b)=>b[1]-a[1])) {
    console.log('   ' + s.padEnd(16) + n);
  }
  if (args.urls.length > 1) {
    console.log('');
    console.log(' per-URL hits    :');
    for (const [u,n] of Object.entries(state.byUrl).sort((a,b)=>b[1]-a[1])) {
      console.log('   ' + u.padEnd(48) + n);
    }
  }
  console.log('──────────────────────────────────────────────');

  const grade =
    state.errors / Math.max(state.reqs,1) > 0.01 ? 'FAIL (error rate > 1%)' :
    pct(sorted, 95) > 1000 ? 'WARN (p95 > 1s)' : 'OK';
  console.log(' grade           : ' + grade);
  process.exit(state.errors / Math.max(state.reqs,1) > 0.01 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
