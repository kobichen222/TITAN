# TITAN LAB PRO — owner setup guide

This is a one-time setup so you can sell **TITAN LAB PRO** licenses with Stripe and deliver them to buyers automatically.

## 1. Generate your license secret

Pick a long random string and store it somewhere only you know (1Password, etc.).

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output. It must look like 96 hex chars.

## 2. Embed the secret in the client

Open `public/index.html` and find the line:

```js
const SP_LICENSE_SECRET='titanlab-2026-replace-this-with-a-real-server-side-secret';
```

Replace the value with your secret from step 1.

> ⚠️ **Soft DRM only.** Anyone who reads the source can technically forge keys with that secret. This is intentional — the friction is enough that legit customers will pay. For real DRM (server-side validation, revocation), open `tools/gen-license.js` for the upgrade notes.

## 3. Set up the Stripe Payment Link

1. Sign in to <https://dashboard.stripe.com/payment-links>.
2. Create a new product, e.g. **TITAN LAB PRO** at $39.
3. Copy the URL — it looks like `https://buy.stripe.com/abcdef`.
4. Open `public/index.html` and replace:
   ```js
   const SP_STRIPE_CHECKOUT_URL='https://buy.stripe.com/test_REPLACE_WITH_REAL_LINK';
   ```
   with your real URL.

You can also use a Checkout Session URL if you want subscriptions.

## 4. Generate a license for a buyer

When Stripe notifies you of a payment (set up an email webhook or watch the dashboard):

```bash
node tools/gen-license.js \
  --secret "<the same secret you embedded>" \
  --email  "buyer@example.com" \
  --tier   pro \
  --days   365
```

Output:

```json
--- TITAN LAB license ---
{
  "payload": {
    "tier": "pro",
    "email": "buyer@example.com",
    "expiresAt": 1893456000000
  },
  "sig": "a8f2…"
}
--- end ---
```

Email the entire `--- TITAN LAB license ---` block (or just the JSON) to the buyer.

## 5. Buyer activates

The buyer:

1. Opens your TITAN LAB tab.
2. Clicks the **○ FREE** badge in the transport row.
3. Pastes the JSON into the textarea, hits **💾 ACTIVATE**.
4. The badge flips to **⚡ PRO** with their email.

That's it — they now have RENDER, STEMS, and unlimited project saves unlocked.

## 6. Optional: automate with a serverless webhook

Once volumes grow, add a Vercel/Netlify serverless function that:

1. Receives Stripe `checkout.session.completed` webhooks.
2. Runs the `gen-license.js` logic in JS.
3. Sends the JSON to the buyer via Postmark / Sendgrid.

Skeleton lives in `tools/gen-license.js` — port the HMAC line into the webhook handler and you're done.

## 7. Revoke a license

Currently licenses are offline-validated. Two ways to "revoke":

- **Time-bomb**: issue licenses with `--days 30` and re-issue monthly (effectively a subscription).
- **Block-list rebuild**: bump `SP_LICENSE_SECRET` in a release; all old keys stop validating. Then re-issue keys to legitimate customers.

For real per-key revocation you need a server endpoint the client hits to confirm — open an issue if you'd like that built.
