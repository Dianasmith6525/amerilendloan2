# Cloudflare proxy + WAF setup runbook

This guide hardens amerilendloan.com by putting Railway behind Cloudflare's
edge. Once complete you get DDoS mitigation, WAF rules, bot management, an
extra TLS layer, free analytics, and your origin IP is hidden from the public
internet.

## Why bother

The site already enforces Cloudflare Turnstile on public forms (see
`server/_core/turnstile.ts`). Cloudflare in front of Railway extends that
protection to **every request**, not just form submissions, and stops abusive
traffic before it ever reaches the Node process or eats Railway bandwidth.

## Prerequisites

- A Cloudflare account (free plan is sufficient to start; Pro $20/mo unlocks
  more WAF rules + image optimization).
- Access to your DNS registrar to change nameservers.
- Railway CLI or dashboard access to add a custom domain.

## Step 1 — add the site to Cloudflare

1. Cloudflare dashboard → **Add a site** → enter `amerilendloan.com` → choose
   the Free plan.
2. Cloudflare scans your existing DNS records. Verify the apex (`@`) and `www`
   records point at your Railway domain (e.g.
   `amerilendloan-production.up.railway.app`).
3. **Important:** the apex record should be a `CNAME` flattening (Cloudflare
   handles this automatically) or an `ALIAS` to the Railway hostname — never
   a hardcoded Railway IP, which can rotate.

## Step 2 — set up the Railway custom domain

In Railway:

1. Project → Service → **Settings → Domains → Add custom domain**.
2. Add both `amerilendloan.com` and `www.amerilendloan.com`.
3. Railway will display the CNAME target. Copy it.

In Cloudflare → DNS:

1. Edit the existing `@` and `www` records to point at the Railway CNAME
   target.
2. **Toggle the orange cloud ON** for both records. This is what enables
   the proxy. Grey cloud = DNS-only, no protection.

## Step 3 — switch nameservers

Cloudflare gives you two nameservers (e.g. `xena.ns.cloudflare.com`).
Update your domain registrar to use those instead of the existing
nameservers. Propagation usually completes in 5–30 minutes.

## Step 4 — SSL/TLS configuration

Cloudflare → **SSL/TLS**:

1. Mode: **Full (strict)**. This requires Railway to present a valid
   certificate (it does, automatically). *Do not use Flexible* — it allows
   plaintext HTTP from Cloudflare to origin and breaks our HSTS policy.
2. **Edge Certificates → Always Use HTTPS** — ON.
3. **Edge Certificates → Minimum TLS Version** — TLS 1.2 (1.3 if you can
   confirm no legacy clients).
4. **HTTP Strict Transport Security (HSTS)** — Enable. Match the value our
   server sends (`max-age=31536000; includeSubDomains; preload`).

## Step 5 — firewall + bot rules

Cloudflare → **Security**:

1. **Bot Fight Mode** — ON (free). Blocks the worst of the scraper traffic
   without a JS challenge for normal users.
2. **WAF → Managed Rules** — Enable the Cloudflare Free Managed Ruleset
   (covers OWASP top 10 patterns). On Pro, also enable the Cloudflare
   Specials and OWASP Core rulesets.
3. **WAF → Custom rules**, add:
   - `(http.request.uri.path eq "/api/trpc/payments.create" and not cf.bot_management.verified_bot and cf.threat_score gt 20)` → **Managed Challenge**
   - `(http.request.uri.path contains "/.git" or http.request.uri.path contains "/.env" or http.request.uri.path contains "wp-admin" or http.request.uri.path contains "wp-login")` → **Block**
   - `(http.request.method eq "POST" and not http.request.uri.path matches "^/api/" and not http.request.uri.path matches "^/login")` → **Block** (no public POST surface outside API/auth)
4. **Rate limiting → Create rule** (free tier allows 1):
   - Match: `http.request.uri.path matches "^/api/trpc/.*"`
   - Threshold: 60 requests per minute per IP
   - Action: Managed Challenge

## Step 6 — origin lockdown (critical)

Once Cloudflare is in front, the Railway URL still works directly and bypasses
all WAF rules. Lock it down:

1. Cloudflare → **SSL/TLS → Origin Server → Create Certificate** → 15-year cert
   for `amerilendloan.com, *.amerilendloan.com`. Save both PEM blocks.
2. Railway doesn't currently support upstream-cert-pinning, so the practical
   mitigation is:
   - In `server/_core/index.ts`, add an Express middleware that 444s any
     request whose `Host` header is the raw Railway hostname (not your
     custom domain). Cloudflare always sets `Host: amerilendloan.com`.
   - Alternatively, set the `cf-connecting-ip` header check: refuse requests
     where this header is missing AND `Host` is the public domain.

Suggested middleware (place before tRPC mount in `server/_core/index.ts`):

```ts
app.use((req, res, next) => {
  const host = req.headers.host ?? "";
  const cfIp = req.headers["cf-connecting-ip"];
  if (host.includes("up.railway.app") && process.env.NODE_ENV === "production") {
    return res.status(403).send("Direct origin access denied");
  }
  if (host.includes("amerilendloan.com") && !cfIp && process.env.NODE_ENV === "production") {
    return res.status(403).send("Cloudflare-only");
  }
  next();
});
```

## Step 7 — update CSP and Turnstile config

The Turnstile script source `https://challenges.cloudflare.com` is already in
the CSP (see `server/_core/index.ts`). After enabling Cloudflare proxy,
double-check your `connect-src` allowlist still includes your own origin —
Cloudflare may rewrite some response headers, so test all dashboard tRPC
calls in a private window after switching DNS.

## Step 8 — verify

1. `curl -I https://amerilendloan.com/` should show `server: cloudflare`.
2. `dig amerilendloan.com` should resolve to a Cloudflare IP (104.x.x.x or
   172.x.x.x), **not** a Railway IP.
3. Visit `https://your-app.up.railway.app/` directly — should 403 once the
   middleware from Step 6 is deployed.
4. Cloudflare dashboard → **Analytics → Security** should show requests
   being challenged or blocked within an hour.
5. Check `/health/detailed` — `integrations.turnstile` should still be
   `true`. Confirm Stripe webhooks still arrive (Stripe IPs are not on
   Cloudflare's bot-fight blocklist, but verify in Stripe dashboard).

## Rollback

If something breaks:

1. Cloudflare → DNS → toggle the orange cloud to grey for `@` and `www`.
   Traffic now goes direct to Railway. Takes effect in ~1 minute.
2. If DNS itself is misconfigured, revert nameservers at the registrar
   (propagation back to old nameservers can take longer — up to 24h).
3. Remove the origin-lockdown middleware deployed in Step 6 if it's
   blocking legitimate traffic.

## Ongoing operation

- Review Cloudflare → **Security → Events** weekly. False positives go in
  WAF → Custom rules → exception clause.
- Audit log for the `cf-ray` header in Sentry / your logger so every server
  log line can be correlated with a Cloudflare request.
- Re-evaluate Pro plan ($20/mo) if you start hitting the free tier's WAF
  rule limits or need image optimization for the resources/blog pages.
