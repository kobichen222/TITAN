/**
 * Ed25519 verification for TITAN signed licenses.
 *
 * Two callers exist in the codebase today:
 *   - public/legacy/app.js  (renderer, gates premium features)
 *   - app/office/page.tsx   (admin panel, validates pasted JSON)
 *
 * Both used to carry their own copy of the same crypto.subtle dance.
 * Phase 2 of the refactor consolidates that into this module so the
 * pubkey hex, the JSON-canonicalisation rule, and the expiry check
 * live in exactly one place.  The legacy file still has its inline
 * copy until Phase 3 wires it up via ES-module loading.
 *
 * Security notes:
 *   - Client-side verify is *optimistic* — it lets the renderer decide
 *     whether to enable a feature without a round-trip.  The
 *     authoritative check happens server-side (Supabase Edge Function
 *     verify-license).  Never trust a client-only success result for
 *     anything that touches paid resources.
 *   - The pubkey is shipped in the bundle by design.  The signing
 *     private key lives only on the operator's machine.
 */

/**
 * Ed25519 public key (32 bytes, hex).  Must match SP_LICENSE_PUBKEY_HEX
 * in public/legacy/app.js and app/office/page.tsx.
 */
export const LICENSE_PUBKEY_HEX =
  'a1263d3bdc8c59791c47c017a4f7e2b34580d61d4a3b97fa12a9fd744e1b60af';

export interface LicensePayload {
  tier: string;
  email: string;
  /** Epoch milliseconds, or null for a perpetual license. */
  expiresAt: number | null;
  /** Epoch milliseconds when the license was issued (optional). */
  issuedAt?: number;
}

export interface SignedLicense {
  payload: LicensePayload;
  /** Hex-encoded Ed25519 signature over JSON.stringify(payload). */
  sig: string;
  /** Optional algorithm tag — only "ed25519" is accepted. */
  alg?: string;
}

function hexToBytes(hex: string): Uint8Array {
  const m = hex.match(/.{2}/g);
  if (!m) return new Uint8Array(0);
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = parseInt(m[i] as string, 16);
  return out;
}

/** Lazily import the public key once per page (CryptoKey is reusable). */
let pubkeyPromise: Promise<CryptoKey> | null = null;
function importPubkey(subtle: SubtleCrypto): Promise<CryptoKey> {
  if (pubkeyPromise) return pubkeyPromise;
  pubkeyPromise = subtle.importKey(
    'raw',
    hexToBytes(LICENSE_PUBKEY_HEX) as BufferSource,
    { name: 'Ed25519' },
    false,
    ['verify'],
  );
  return pubkeyPromise;
}

/**
 * Returns true when the license signature checks out *and* it has not
 * expired.  Returns false on missing/malformed payload, mismatched alg,
 * tampered signature, or past expiresAt.  Never throws.
 *
 * @param subtle - Defaults to globalThis.crypto.subtle. Pass an explicit
 *   SubtleCrypto in tests; pass undefined in browsers and Electron.
 */
export async function verifySignedLicense(
  lic: SignedLicense | null | undefined,
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle,
): Promise<boolean> {
  try {
    if (!subtle) return false;
    if (!lic || !lic.payload || !lic.sig) return false;
    if (lic.alg && lic.alg !== 'ed25519') return false;

    const pubkey = await importPubkey(subtle);
    const text = new TextEncoder().encode(JSON.stringify(lic.payload));
    const sig = hexToBytes(lic.sig);
    const ok = await subtle.verify(
      { name: 'Ed25519' },
      pubkey,
      sig as BufferSource,
      text as BufferSource,
    );
    if (!ok) return false;

    if (lic.payload.expiresAt != null && lic.payload.expiresAt < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Reset the cached pubkey promise.  Tests that swap the SubtleCrypto
 * implementation between cases should call this in beforeEach so the
 * cached CryptoKey from a previous mock is not reused.
 */
export function _resetPubkeyCache(): void {
  pubkeyPromise = null;
}
