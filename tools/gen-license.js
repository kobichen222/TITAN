#!/usr/bin/env node
/* TITAN LAB — license key generator
 *
 * Usage:
 *   node tools/gen-license.js \
 *     --secret "YOUR_LONG_RANDOM_SECRET" \
 *     --email  "buyer@example.com" \
 *     --tier   pro \
 *     [--days  365]
 *
 * Output: a JSON blob that the buyer pastes into TITAN LAB ▸ LICENSE.
 *
 * The --secret value MUST match SP_LICENSE_SECRET inside public/index.html.
 * Anyone who reads the client source could in theory generate fake keys
 * with that secret, so this is "soft DRM" — fine for a paid creative tool.
 *
 * For real DRM, switch to public-key signatures (Ed25519 / RSA-PSS) and
 * keep the private key server-side; the client only verifies. Drop us a
 * line if you want a server-validated upgrade path.
 */

'use strict';
const crypto = require('crypto');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  return process.argv[i + 1];
}

const secret = arg('secret');
const email  = arg('email');
const tier   = arg('tier', 'pro');
const days   = parseInt(arg('days', '0'), 10);

if (!secret || !email) {
  console.error('Usage: node tools/gen-license.js --secret <SECRET> --email <buyer@example.com> [--tier pro] [--days 365]');
  process.exit(1);
}

const payload = {
  tier,
  email,
  expiresAt: days > 0 ? Date.now() + days * 24 * 3600 * 1000 : null,
};

const text = JSON.stringify(payload);
const sig = crypto.createHmac('sha256', secret).update(text).digest('hex');

const license = { payload, sig };

// Pretty print so it's easy to email
console.log('--- TITAN LAB license ---');
console.log(JSON.stringify(license, null, 2));
console.log('--- end ---');
console.log('\nEmail this JSON to the buyer. They paste it into:');
console.log('  TITAN LAB tab → ⚡/○ tier badge → ACTIVATE');
