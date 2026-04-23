#!/usr/bin/env node
/* TITAN LAB — license signer (Ed25519)
 *
 * Signs a license payload with your Ed25519 private key so the TITAN LAB
 * client (browser / Electron) can verify authenticity with only the public
 * key embedded in its source.  The private key NEVER touches the client.
 *
 * Usage:
 *   node tools/gen-license.js \
 *     --key   path/to/titan-private.pem \
 *     --email buyer@example.com \
 *     --tier  pro \
 *     [--days 365]
 *
 * Output: a JSON blob that the buyer pastes into TITAN LAB ▸ LICENSE.
 *
 * If you don't have a keypair yet, run `node tools/gen-keypair.js` first.
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  return process.argv[i + 1];
}

const keyPath = arg('key');
const email   = arg('email');
const tier    = arg('tier', 'pro');
const days    = parseInt(arg('days', '0'), 10);

if (!keyPath || !email) {
  console.error('Usage: node tools/gen-license.js --key <private.pem> --email <buyer@example.com> [--tier pro] [--days 365]');
  process.exit(1);
}

let privateKey;
try {
  privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath));
} catch (e) {
  console.error('Could not load private key from ' + keyPath + ': ' + e.message);
  process.exit(2);
}

if (privateKey.asymmetricKeyType !== 'ed25519') {
  console.error('Expected an Ed25519 key, got: ' + privateKey.asymmetricKeyType);
  console.error('Generate a fresh one with: node tools/gen-keypair.js');
  process.exit(3);
}

const payload = {
  tier,
  email,
  expiresAt: days > 0 ? Date.now() + days * 24 * 3600 * 1000 : null,
  issuedAt: Date.now(),
};
const text = JSON.stringify(payload);
// Ed25519 determines its hash (SHA-512) from the key itself; algorithm arg is null.
const sig = crypto.sign(null, Buffer.from(text), privateKey).toString('hex');

const license = { payload, sig, alg: 'ed25519' };

console.log('--- TITAN LAB license ---');
console.log(JSON.stringify(license, null, 2));
console.log('--- end ---');
console.log('');
console.log('Email this JSON to the buyer. They paste it into:');
console.log('  TITAN LAB tab → ⚡/○ tier badge → ACTIVATE');
