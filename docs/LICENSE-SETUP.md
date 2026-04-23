# License setup (Ed25519)

DJ TITAN PRO licenses are signed with **Ed25519** — the private key lives only on the operator's machine, and the client embeds only a 32-byte public key. Anyone reading the client source cannot forge licenses.

---

## One-time setup (once per product)

```bash
node tools/gen-keypair.js
# ↓ writes titan-private.pem (chmod 600, gitignored)
# ↓ prints the public key hex — copy it
```

Paste the public key hex into **two** places:

1. `public/index.html` — constant `SP_LICENSE_PUBKEY_HEX`
2. `app/office/page.tsx` — constant `SP_LICENSE_PUBKEY_HEX`

Commit the change. **Do not commit `titan-private.pem`.** Back it up somewhere safe (password manager, hardware token, offline drive). If it's lost, every license you've ever issued becomes unverifiable.

## Issuing a license per sale

```bash
node tools/gen-license.js \
  --key   titan-private.pem \
  --email buyer@example.com \
  --tier  pro \
  --days  365
```

Output is a JSON blob. Email it to the buyer. They paste it into TITAN LAB ▸ LICENSE ▸ ACTIVATE.

## Registering in the office panel (optional)

Open `/office`, paste the same JSON into **LICENSE REGISTRY ▸ SIGNED LICENSE JSON**, hit **VERIFY + REGISTER**. The panel:
- Re-verifies the Ed25519 signature with the embedded public key
- Writes the license to the Supabase `licenses` table (for audit trail + revocation)
- Adds an entry to `admin_audit`

Registration is optional — an unregistered license still activates in the client, since the client only checks the signature. Registration enables revocation via the office panel.

## Revocation

Mark a license revoked in the office panel → `licenses.revoked = true` in Supabase. **The client does not check this field** (it only validates the signature and expiry). If you need active revocation enforcement, add an online deny-list check to `spLoadLicense` that pings Supabase on app start. Not implemented yet.

## Rotating the signing key

If `titan-private.pem` is ever exposed:

1. Generate a new keypair: `node tools/gen-keypair.js --out titan-private-v2.pem`
2. Swap `SP_LICENSE_PUBKEY_HEX` in both files to the new public key
3. Ship a new client release
4. Re-issue licenses to all active customers with the new key

Old licenses stop verifying automatically once the public key changes, so stolen keys become worthless after a client update.

## What the license JSON looks like

```json
{
  "payload": {
    "tier": "pro",
    "email": "buyer@example.com",
    "expiresAt": 1779562752963,
    "issuedAt": 1776970752963
  },
  "sig": "51cc1a5b...04",
  "alg": "ed25519"
}
```

- `payload.expiresAt = null` → lifetime license
- `sig` is a 64-byte Ed25519 signature, hex-encoded
- `alg` is always `"ed25519"` (the client refuses other algs)

## Security notes

- The public key is **not secret**. It's safe to embed in client JS, ship in the installer, and commit to the repo.
- The private key **is secret**. Treat it like a credential.
- Ed25519 signatures are deterministic and constant-time; no nonce management required.
- The client verifies with the browser's native Web Crypto `Ed25519` primitive — no dependencies.
