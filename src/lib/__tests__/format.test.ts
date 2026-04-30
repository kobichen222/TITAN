import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  fmtClock,
  fmtDate,
  fmtTime,
  fmtTimeShort,
} from '../format';

describe('fmtTime — mm:ss.d (deck display)', () => {
  it('formats whole minutes', () => {
    expect(fmtTime(0)).toBe('00:00.0');
    expect(fmtTime(60)).toBe('01:00.0');
    expect(fmtTime(3600)).toBe('60:00.0');
  });

  it('truncates fractional seconds to deci-seconds', () => {
    expect(fmtTime(12.34)).toBe('00:12.3');
    expect(fmtTime(12.39)).toBe('00:12.3');
    expect(fmtTime(59.99)).toBe('00:59.9');
  });

  it('clamps negative values to zero', () => {
    expect(fmtTime(-1)).toBe('00:00.0');
    expect(fmtTime(-Infinity)).toBe('00:00.0');
  });

  it('handles NaN and Infinity safely', () => {
    expect(fmtTime(Number.NaN)).toBe('00:00.0');
    expect(fmtTime(Number.POSITIVE_INFINITY)).toBe('00:00.0');
  });

  it('parity with the legacy inline implementation', () => {
    // The legacy formula: max(0,sec) → m=floor(sec/60), s=floor(sec%60),
    // ds=floor((sec-floor(sec))*10).  Sample drawn from realistic deck
    // playback values to lock behaviour byte-for-byte.
    const samples = [0, 0.5, 1.499, 9.99, 60.001, 125.7, 599.95];
    for (const v of samples) {
      const legacy = (() => {
        const sec = Math.max(0, v);
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        const ds = Math.floor((sec - Math.floor(sec)) * 10);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ds}`;
      })();
      expect(fmtTime(v)).toBe(legacy);
    }
  });
});

describe('fmtTimeShort — mm:ss (vinyl page)', () => {
  it('returns 00:00 for invalid input', () => {
    expect(fmtTimeShort(Number.NaN)).toBe('00:00');
    expect(fmtTimeShort(-1)).toBe('00:00');
    expect(fmtTimeShort(Number.POSITIVE_INFINITY)).toBe('00:00');
  });

  it('formats valid seconds', () => {
    expect(fmtTimeShort(0)).toBe('00:00');
    expect(fmtTimeShort(65)).toBe('01:05');
    expect(fmtTimeShort(3599)).toBe('59:59');
  });
});

describe('fmtDate — ISO → locale', () => {
  it('returns em-dash for null/empty/invalid', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate('')).toBe('—');
    expect(fmtDate(undefined)).toBe('—');
    expect(fmtDate('not a date')).toBe('—');
  });

  it('renders a valid ISO string as a non-empty locale string', () => {
    const out = fmtDate('2024-01-15T10:00:00Z');
    expect(out).not.toBe('—');
    expect(out.length).toBeGreaterThan(0);
  });

  it('withTime toggles between short and long variants', () => {
    const iso = '2024-01-15T10:00:00Z';
    const short = fmtDate(iso, false);
    const long = fmtDate(iso, true);
    expect(long.length).toBeGreaterThanOrEqual(short.length);
  });
});

describe('fmtClock — HH:MM:SS wall clock', () => {
  it('formats a deterministic Date with zero-padding', () => {
    // Note: getHours/Minutes/Seconds are local-tz; pick a fixed UTC time and
    // verify the parts match what new Date() returns in the runner's tz.
    const d = new Date(2024, 0, 1, 9, 5, 7);
    expect(fmtClock(d)).toBe('09:05:07');
  });

  it('handles midnight + the second before', () => {
    expect(fmtClock(new Date(2024, 0, 1, 0, 0, 0))).toBe('00:00:00');
    expect(fmtClock(new Date(2024, 0, 1, 23, 59, 59))).toBe('23:59:59');
  });

  it('returns 00:00:00 for invalid input rather than throwing', () => {
    expect(fmtClock(new Date('not a date'))).toBe('00:00:00');
    expect(fmtClock(undefined as unknown as Date)).toBe('00:00:00');
    expect(fmtClock(null as unknown as Date)).toBe('00:00:00');
  });
});

describe('escapeHtml — XSS-safe text', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('escapes a real-world track title with quotes and ampersands', () => {
    const evil = `<script>alert("xss")</script> & 'co.'`;
    expect(escapeHtml(evil)).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;co.&#39;',
    );
  });

  it('coerces non-string input via String()', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('null');
    expect(escapeHtml(undefined)).toBe('undefined');
  });

  it('parity with the legacy inline implementation', () => {
    const legacy = (s: unknown) =>
      String(s).replace(
        /[&<>"']/g,
        (c) =>
          ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
      );
    const samples = ['', 'plain', '<b>x</b>', `"quoted"`, "it's", 'a&b', '🎧 mix'];
    for (const v of samples) expect(escapeHtml(v)).toBe(legacy(v));
  });
});
