/**
 * Pure URL parsers for the YouTube + Spotify track sources.
 *
 * Extracted from public/legacy/app.js (Phase 2). The legacy file
 * still has inline copies; both implementations are pinned together
 * by the parity tests.
 */

const YT_PATTERNS: readonly RegExp[] = [
  /youtube\.com\/watch\?v=([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
  /youtube\.com\/embed\/([\w-]{11})/,
  /youtube\.com\/shorts\/([\w-]{11})/,
];

const YT_BARE_ID = /^[\w-]{11}$/;

/**
 * Resolve a URL or bare 11-character ID to a YouTube video ID.
 * Returns null when the input is not recognisable as a YouTube reference.
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  if (YT_BARE_ID.test(url)) return url;
  for (const pat of YT_PATTERNS) {
    const m = url.match(pat);
    if (m) return m[1] ?? null;
  }
  return null;
}

const SPOTIFY_TRACK_RE = /open\.spotify\.com\/(intl-[\w-]+\/)?track\/[a-zA-Z0-9]+/;
const SPOTIFY_TRACK_ID_RE = /track\/([a-zA-Z0-9]+)/;

/** True when the URL points to a single Spotify track (any locale prefix). */
export function isSpotifyTrackUrl(url: string): boolean {
  return SPOTIFY_TRACK_RE.test(url);
}

/** Pull the Spotify track ID out of a track URL, or null if the shape is wrong. */
export function extractSpotifyTrackId(url: string): string | null {
  const m = url.match(SPOTIFY_TRACK_ID_RE);
  return m ? (m[1] ?? null) : null;
}
