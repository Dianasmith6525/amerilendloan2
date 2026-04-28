# Secrets rotation runbook

This document gives the exact procedure to rotate every secret used by
amerilendloan.com. Rotate all secrets quarterly, or **immediately** on any
of these triggers:

- Suspected leak (secret committed to git, pasted in chat, screenshot, etc.)
- Employee or contractor with access departs
- Vendor publishes a CVE affecting their auth flow
- Unexpected billing spikes or unauthorized API calls in vendor dashboard

For each secret below: severity, downtime impact, exact steps, and verify
command. **Always rotate one secret at a time** so you can correlate any
incident to the exact change.

---

## JWT_SECRET

**Severity:** High &nbsp; **Downtime impact:** All users logged out instantly.

Used to sign session cookies (`server/_core/cookies.ts`). Rotating
invalidates every existing session.

1. **Schedule** for low-traffic window (Sunday 03:00 ET).
2. Generate new secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
3. Railway → service → **Variables** → update `JWT_SECRET` → click **Deploy**.
4. Wait for new container to be healthy (`/health` returns 200).
5. Verify: log in as a test user, confirm session cookie works.
6. Notify support: expect a temporary increase in "I'm logged out" tickets.

---

## ENCRYPTION_KEY

**Severity:** Critical &nbsp; **Downtime impact:** Read-mostly window required;
write operations on encrypted fields must pause until re-encryption completes.

Used to encrypt SSN and bank-account fields at rest. Rotating naively bricks
decryption of every existing encrypted row.

**Procedure (envelope re-encryption):**

1. Generate new key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
2. Add `ENCRYPTION_KEY_NEW` to Railway alongside the existing `ENCRYPTION_KEY`.
   Deploy.
3. Patch the encryption module to **decrypt with old, encrypt with new**.
   (One-time migration mode — leave old key as fallback for decryption.)
4. Run a re-encryption migration script that iterates every encrypted column
   (kycVerification, bankingTransactions, userAddresses) and rewrites each row.
5. Verify a known-encrypted record decrypts correctly.
6. Promote: rename `ENCRYPTION_KEY_NEW` → `ENCRYPTION_KEY`, remove the old
   value, redeploy.
7. Keep the previous key archived in 1Password for 90 days in case a restore
   from an older backup is needed.

**If you do not yet have a re-encryption script, do not rotate this key.**
Write the script first; treat the rotation as a planned project, not a fire
drill.

---

## STRIPE_SECRET_KEY

**Severity:** High &nbsp; **Downtime impact:** Zero, if procedure followed.

Stripe supports multiple active restricted keys, so rotation is graceful.

1. Stripe Dashboard → **Developers → API keys → Create restricted key**.
   Match permissions of the current key (Charges, PaymentIntents, Webhook
   Endpoints, Refunds — read/write).
2. Copy the new `rk_live_...` key.
3. Railway → update `STRIPE_SECRET_KEY` → Deploy.
4. Verify: `/health/detailed` shows `integrations.stripe: true`. Run a
   $0.50 test charge in production with a real card and refund it.
5. Stripe Dashboard → **Developers → API keys** → revoke the old key.
6. Watch Stripe logs for ~1 hour to confirm no 401s.

---

## STRIPE_WEBHOOK_SECRET

**Severity:** High &nbsp; **Downtime impact:** ~5 minutes of webhook signature
failures during cutover.

1. Stripe Dashboard → **Developers → Webhooks** → your endpoint → **Roll
   secret**. Stripe will accept signatures from both the old and new secret
   for 24 hours.
2. Copy the new `whsec_...`.
3. Railway → update `STRIPE_WEBHOOK_SECRET` → Deploy.
4. Verify: trigger a test event from Stripe → "Send test webhook" → confirm
   200 response in your application logs.

---

## SENDGRID_API_KEY

**Severity:** Medium &nbsp; **Downtime impact:** Zero (multiple keys allowed).

1. SendGrid → **Settings → API Keys → Create API Key**. Name it with the
   rotation date, e.g. `prod-2026-q2`. Permissions: Mail Send only (least
   privilege).
2. Railway → update `SENDGRID_API_KEY` → Deploy.
3. Verify: trigger a password-reset email to a test address; confirm it
   arrives within 30 seconds.
4. SendGrid → revoke the old API key.

---

## TWILIO_AUTH_TOKEN

**Severity:** High &nbsp; **Downtime impact:** A 30-second window during the
"primary token swap" step.

Twilio supports a primary + secondary auth token to enable zero-downtime
rotation.

1. Twilio Console → **Account → Auth tokens → Create secondary token**.
2. Railway → update `TWILIO_AUTH_TOKEN` → Deploy. Application now signs
   requests with the secondary.
3. Verify: send an OTP to a test phone number, confirm receipt.
4. Twilio Console → **Promote secondary to primary**, then **revoke old
   primary**.

---

## TURNSTILE_SECRET_KEY + VITE_TURNSTILE_SITE_KEY

**Severity:** Low &nbsp; **Downtime impact:** Zero. CAPTCHA soft-fails on
verification errors (logs warning, allows request).

These are paired — site key is public (rendered in client bundle), secret key
validates the response server-side. Both must rotate together.

1. Cloudflare Dashboard → **Turnstile → your site → Settings → Rotate keys**.
2. Copy both new values.
3. Railway → update both `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY`
   → Deploy. (Note: `VITE_*` vars require a fresh **build**, not just a
   restart, because they're inlined at build time.)
4. Verify: load the loan application form in a private window, complete the
   Turnstile challenge, submit. Check logs for "Turnstile verified".

---

## DATABASE_URL

**Severity:** Critical &nbsp; **Downtime impact:** Full outage of seconds to
minutes.

Only rotate when (a) the database is being migrated to a new host or (b) the
password is suspected leaked.

**Password-only rotation (preferred):**

1. Railway → Postgres service → **Connect → Reset password**.
2. Railway automatically updates the `DATABASE_URL` reference variable for any
   service that imports it via `${{Postgres.DATABASE_URL}}`.
3. If the application imports it as a literal value, update manually and
   deploy.
4. Verify: `/health` returns 200 within 60 seconds.

---

## OAuth secrets (OAUTH_SERVER_URL, OWNER_OPEN_ID, etc.)

**Severity:** Medium &nbsp; **Downtime impact:** Login button broken until
deploy completes.

Coordinate with the OAuth provider (Forge / your IdP). The provider issues a
new client_id/client_secret pair; update both atomically in Railway and
deploy.

---

## Backup encryption key (when applicable)

If you encrypt backups before uploading off-site, rotate that key on the same
cadence as `ENCRYPTION_KEY`. **Never** rotate without first decrypting and
re-encrypting at least the last 30 days of backups, otherwise a
disaster-recovery restore will fail.

---

## Quarterly rotation checklist

- [ ] JWT_SECRET
- [ ] STRIPE_SECRET_KEY
- [ ] STRIPE_WEBHOOK_SECRET
- [ ] SENDGRID_API_KEY
- [ ] TWILIO_AUTH_TOKEN
- [ ] TURNSTILE_SECRET_KEY + VITE_TURNSTILE_SITE_KEY
- [ ] OAuth client secret
- [ ] Update last-rotated dates in 1Password
- [ ] Note rotation in `CHANGELOG.md` (Operations section)

`ENCRYPTION_KEY` and `DATABASE_URL` rotate **annually** or on incident, not
quarterly, due to their higher operational cost.

---

## Emergency rotation (suspected leak)

1. Identify the leaked secret (git log, screenshots, public dashboards).
2. Follow the per-secret procedure above, but skip the "schedule for
   low-traffic" step — rotate now.
3. Audit access logs for the leaked secret. For Stripe and SendGrid, their
   dashboards have an audit log. For your own DB, use
   `auditLog` / `adminAuditLog` tables.
4. File a brief post-mortem in `docs/incidents/` describing scope, blast
   radius, timeline, and prevention steps. Do not skip this even for "minor"
   leaks.
