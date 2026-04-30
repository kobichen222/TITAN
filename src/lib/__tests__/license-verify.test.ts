import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LICENSE_PUBKEY_HEX,
  type SignedLicense,
  _resetPubkeyCache,
  verifySignedLicense,
} from '../license-verify';

function makeSubtle(opts: {
  importKey?: () => Promise<CryptoKey>;
  verify?: (..._args: unknown[]) => Promise<boolean>;
}): SubtleCrypto {
  return {
    importKey: opts.importKey ?? (async () => ({} as CryptoKey)),
    verify: opts.verify ?? (async () => true),
  } as unknown as SubtleCrypto;
}

const baseLic = (overrides: Partial<SignedLicense['payload']> = {}): SignedLicense => ({
  payload: { tier: 'pro', email: 'a@b.c', expiresAt: null, ...overrides },
  sig: 'aabbccdd',
  alg: 'ed25519',
});

beforeEach(() => _resetPubkeyCache());
afterEach(() => vi.restoreAllMocks());

describe('LICENSE_PUBKEY_HEX', () => {
  it('is a 64-character hex string (32 bytes)', () => {
    expect(LICENSE_PUBKEY_HEX).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifySignedLicense — happy path', () => {
  it('returns true on valid signature with no expiry', async () => {
    const subtle = makeSubtle({ verify: async () => true });
    expect(await verifySignedLicense(baseLic(), subtle)).toBe(true);
  });

  it('returns true on valid signature with future expiry', async () => {
    const subtle = makeSubtle({ verify: async () => true });
    const lic = baseLic({ expiresAt: Date.now() + 1000 * 60 * 60 });
    expect(await verifySignedLicense(lic, subtle)).toBe(true);
  });

  it('accepts the license when alg is omitted (legacy payloads)', async () => {
    const subtle = makeSubtle({ verify: async () => true });
    const lic: SignedLicense = { ...baseLic() };
    delete lic.alg;
    expect(await verifySignedLicense(lic, subtle)).toBe(true);
  });
});

describe('verifySignedLicense — rejects', () => {
  it('rejects null / undefined / empty inputs', async () => {
    const subtle = makeSubtle({});
    expect(await verifySignedLicense(null, subtle)).toBe(false);
    expect(await verifySignedLicense(undefined, subtle)).toBe(false);
    expect(await verifySignedLicense({} as SignedLicense, subtle)).toBe(false);
  });

  it('rejects payloads missing payload or sig', async () => {
    const subtle = makeSubtle({});
    expect(
      await verifySignedLicense(
        { sig: 'aa' } as unknown as SignedLicense,
        subtle,
      ),
    ).toBe(false);
    expect(
      await verifySignedLicense(
        { payload: baseLic().payload } as unknown as SignedLicense,
        subtle,
      ),
    ).toBe(false);
  });

  it('rejects an unknown algorithm tag', async () => {
    const subtle = makeSubtle({ verify: async () => true });
    const lic = { ...baseLic(), alg: 'rsa' };
    expect(await verifySignedLicense(lic, subtle)).toBe(false);
  });

  it('rejects when crypto.subtle.verify returns false', async () => {
    const subtle = makeSubtle({ verify: async () => false });
    expect(await verifySignedLicense(baseLic(), subtle)).toBe(false);
  });

  it('rejects an expired license even if signature is valid', async () => {
    const subtle = makeSubtle({ verify: async () => true });
    const lic = baseLic({ expiresAt: Date.now() - 1000 });
    expect(await verifySignedLicense(lic, subtle)).toBe(false);
  });

  it('returns false (does not throw) when verify rejects', async () => {
    const subtle = makeSubtle({
      verify: async () => {
        throw new Error('subtle exploded');
      },
    });
    expect(await verifySignedLicense(baseLic(), subtle)).toBe(false);
  });

  it('returns false when no SubtleCrypto is provided and global is missing', async () => {
    expect(await verifySignedLicense(baseLic(), undefined)).toBe(false);
  });
});

describe('verifySignedLicense — canonicalisation', () => {
  it('signs the JSON.stringify of payload, not the wire bytes', async () => {
    let signedText = '';
    const subtle = makeSubtle({
      verify: async (
        _alg: unknown,
        _key: unknown,
        _sig: unknown,
        data: ArrayBufferView,
      ) => {
        signedText = new TextDecoder().decode(data);
        return true;
      },
    });
    const lic = baseLic({ tier: 'pro', email: 'x@y' });
    await verifySignedLicense(lic, subtle);
    expect(signedText).toBe(JSON.stringify(lic.payload));
  });
});
