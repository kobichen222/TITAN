#!/usr/bin/env node
/* TITAN LAB — one-time Ed25519 keypair generator
 *
 * Run this ONCE when you set up the product.  It produces:
 *   - A private key PEM file — you sign every license JSON with it.
 *     KEEP THIS FILE SAFE.  NEVER COMMIT.  If you lose it, every license
 *     you've ever issued becomes unverifiable and you must re-issue them.
 *   - A 32-byte public key in hex — you paste it into SP_LICENSE_PUBKEY_HEX
 *     in public/index.html and app/office/page.tsx.
 *
 * Usage:
 *   node tools/gen-keypair.js [--out titan-private.pem]
 *
 * The generated file is chmod 600 and *.pem is in .gitignore.
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  return process.argv[i + 1];
}

const outPath = path.resolve(arg('out', 'titan-private.pem'));

if (fs.existsSync(outPath)) {
  console.error('Refusing to overwrite existing file: ' + outPath);
  console.error('Pass a different --out path, or delete the old file first.');
  process.exit(2);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const privPem = privateKey.export({ format: 'pem', type: 'pkcs8' });
const pubSpki = publicKey.export({ format: 'der', type: 'spki' });
// Ed25519 SPKI is a fixed-size 12-byte ASN.1 header followed by the 32-byte
// raw Edwards-curve public key; strip the header for a clean hex blob.
const pubHex = pubSpki.slice(-32).toString('hex');

fs.writeFileSync(outPath, privPem, { mode: 0o600 });

console.log('--- TITAN LAB keypair ---');
console.log('Private key: ' + outPath + ' (chmod 600, gitignored)');
console.log('');
console.log('Public key (paste into SP_LICENSE_PUBKEY_HEX in');
console.log('  public/index.html  and');
console.log('  app/office/page.tsx ):');
console.log('');
console.log('  ' + pubHex);
console.log('');
console.log('Next:');
console.log('  1. Commit the public key change (NEVER commit the .pem).');
console.log('  2. Back up ' + outPath + ' to a password manager or cold storage.');
console.log('  3. Issue licenses with:');
console.log('     node tools/gen-license.js --key ' + outPath + ' --email buyer@example.com --tier pro --days 365');
