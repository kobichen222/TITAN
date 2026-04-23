# DJ TITAN — Load Tests

Three independent load tests, all zero-dependency. Run any of them
individually.

| # | Test                 | File                  | Runtime       | Measures                                           |
|---|----------------------|-----------------------|---------------|----------------------------------------------------|
| 1 | Browser perf         | `browser-perf.html`   | Any browser   | FPS, long tasks, JS heap, audio latency under load |
| 2 | HTTP load            | `http-load.js`        | Node (stdlib) | req/s, latency p50/p90/p95/p99, error rate        |
| 3 | Page-weight / TTFB   | `page-load.js`        | Node (stdlib) | HTML size, gzip ratio, linked assets, total weight |

---

## 1 · Browser performance load (`browser-perf.html`)

Drives the real DJ app through its public API (`loadTrackToDeck`, `playDeck`,
`decks`) from inside an iframe. Synthesises audio buffers, loads 1–4 decks and
plays them all in parallel while sampling FPS, long-task count and JS heap.

Start a local server (anything works), then open the test page:

```bash
npx next dev
# in another tab, open:
#   http://localhost:3000/pioneer-dj-pro-max-v2.html   ← app itself
#   file:///…/TITAN/load-tests/browser-perf.html        ← test harness
```

Or use any static server:

```bash
npx serve -p 4173 public
# then open load-tests/browser-perf.html (adjust "Target URL" to
# http://localhost:4173/pioneer-dj-pro-max-v2.html)
```

Tunables in the left panel: duration, active deck count, tone length.
Grade heuristic: `OK` if avg FPS ≥ 55 and long tasks < 20, `WARN` if ≥ 40.

---

## 2 · HTTP load (`http-load.js`)

Keep-alive GET storm against one or more URLs.

```bash
# single URL
node load-tests/http-load.js --url http://localhost:3000/ -c 20 -d 20

# multiple URLs, round-robined per worker
node load-tests/http-load.js \
  --url http://localhost:3000/ \
  --url http://localhost:3000/pioneer-dj-pro-max-v2.html \
  --concurrency 50 --duration 30 --warmup 2
```

| flag              | default | meaning                             |
|-------------------|---------|-------------------------------------|
| `--url`           | `localhost:3000/` | repeatable, round-robined |
| `-c --concurrency`| 10      | in-flight requests                  |
| `-d --duration`   | 15      | measurement window (s)              |
| `--warmup`        | 1       | pre-measurement ramp (s)            |
| `--timeout`       | 10000   | per-request timeout (ms)            |

Exits non-zero if error rate > 1 %. Grades `WARN` at p95 > 1 s.

---

## 3 · Page-weight / TTFB (`page-load.js`)

Fetches the HTML, measures TTFB + total, gzips it locally, scans for linked
assets (`<link>`, `<script src>`, `<img>`, `<source>`, `<audio>`, `<video>`,
`<iframe>`), fetches each, and prints a weight breakdown by kind.

```bash
node load-tests/page-load.js --url http://localhost:3000/pioneer-dj-pro-max-v2.html
node load-tests/page-load.js --url http://localhost:3000/ --runs 5 --json out.json
```

Grade heuristic: `FAIL` above 10 MB total weight, `WARN` above 3 MB or median
total load > 1.5 s.

---

## Quick one-shot (all three against a local server)

```bash
# terminal 1
npx next dev                                        # or: npx serve -p 3000 public

# terminal 2
node load-tests/http-load.js --url http://localhost:3000/pioneer-dj-pro-max-v2.html -c 20 -d 20
node load-tests/page-load.js --url http://localhost:3000/pioneer-dj-pro-max-v2.html --runs 3

# browser
open load-tests/browser-perf.html
```
