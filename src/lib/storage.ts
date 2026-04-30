/**
 * Centralised localStorage keys and safe JSON wrappers.
 *
 * Inventoried from public/legacy/app.js + app/office/page.tsx during
 * Phase 2 of the refactor.  Keeping every key in one place stops the
 * "what's in localStorage?" detective work and makes future migrations
 * (clearing on uninstall, exporting state, schema bumps) trivial.
 *
 * The legacy file still spells the strings inline; once it migrates
 * to ES module loading in Phase 3 the inline literals can be replaced
 * with imports from this module.
 */

export const STORAGE_KEYS = Object.freeze({
  /** main app deck/library/UI state — persisted by the rAF tick. */
  appState: 'djMaxAi_v1',
  /** crates + smart-crates + tag dictionary. */
  crates: 'titan_crates_v1',
  /** office admin unlock flag (session vs persistent — see UNLOCK_KEY usage). */
  officeUnlocked: 'titan_office_unlocked_v1',
  /** signed Ed25519 license payload for the active user. */
  licensePayload: 'titanlab_license_v1',
  /** server-cached entitlement check result (TTL-backed). */
  entitlement: 'titan_entitlement_v1',
  /** TITAN LAB project list. */
  labProjects: 'titanlab_projects_v1',
  /** First-run product tour completion flag. */
  tourDone: 'titan_tour_done_v1',
  /** 24-h clock toggle in the header. */
  clock24h: 'djtitan_clock_24h',
  /** Active MIDI mapping table (cc/note → target). */
  midiMap: 'djpro_midi_map',
  /** Saved live-recording session metadata. */
  recordingSessions: 'djpro_sessions',
  /** Last selected deck-focus pair (AB/CD/AC/BD/ALL). */
  deckPair: 'titan_deck_pair',
  /** Deprecated language code — actively cleaned up on boot. */
  legacyLang: 'djmaxai_lang_v1',
  /** Supabase project URL + anon key (per-browser config). */
  supabaseConfig: 'djmaxai_supa_v1',
  /** External music search API credentials (Spotify, YT data). */
  musicCreds: 'djpro_music_creds_v1',
  /** Academy XP / progress tracking. */
  learnProgress: 'titan_learn_progress_v1',
  /** Academy first-run onboarding banner dismissal. */
  learnOnboarded: 'titan_learn_onboarded_v1',
} as const);

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function pickStorage(custom?: StorageLike): StorageLike | null {
  if (custom) return custom;
  if (typeof globalThis !== 'undefined' && (globalThis as { localStorage?: Storage }).localStorage) {
    return (globalThis as { localStorage: Storage }).localStorage;
  }
  return null;
}

/** Read a JSON value. Returns `fallback` on missing / invalid / unavailable. */
export function readJSON<T>(key: StorageKey, fallback: T, storage?: StorageLike): T {
  const ls = pickStorage(storage);
  if (!ls) return fallback;
  try {
    const raw = ls.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Write a JSON value. Returns true on success, false on quota / serialise / unavailable. */
export function writeJSON(key: StorageKey, value: unknown, storage?: StorageLike): boolean {
  const ls = pickStorage(storage);
  if (!ls) return false;
  try {
    ls.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Read a raw string. Returns `fallback` (default null) when missing or unavailable. */
export function readString(
  key: StorageKey,
  fallback: string | null = null,
  storage?: StorageLike,
): string | null {
  const ls = pickStorage(storage);
  if (!ls) return fallback;
  try {
    const v = ls.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

/** Write a raw string. Returns true on success. */
export function writeString(key: StorageKey, value: string, storage?: StorageLike): boolean {
  const ls = pickStorage(storage);
  if (!ls) return false;
  try {
    ls.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Remove a key. Returns true on success. */
export function remove(key: StorageKey, storage?: StorageLike): boolean {
  const ls = pickStorage(storage);
  if (!ls) return false;
  try {
    ls.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
