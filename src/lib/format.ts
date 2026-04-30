/**
 * Display-string helpers used across the studio UI.
 *
 * These were extracted from public/legacy/app.js (Phase 2 of the
 * refactor). The legacy file still carries inline copies; once the
 * React Studio in Phase 3 starts consuming these directly, the
 * duplicates can be removed. Until then, the parity tests in
 * src/lib/__tests__/format.test.ts assert that both implementations
 * agree byte-for-byte on the cases the legacy code actually emits.
 */

/** mm:ss.d — playback time, used by deck displays and waveform cursors. */
export function fmtTime(sec: number): string {
  const v = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const m = Math.floor(v / 60);
  const s = Math.floor(v % 60);
  const ds = Math.floor((v - Math.floor(v)) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ds}`;
}

/** mm:ss — short variant used by the vinyl page and library rows. */
export function fmtTimeShort(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Locale date formatter, with optional time, used by the office panel. */
export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return withTime ? d.toLocaleString() : d.toLocaleDateString();
}

const HTML_ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

/** Escape a string for safe insertion into HTML text or attribute values. */
export function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}
