import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Derive the apex (root) domain from a hostname.
 * e.g.  "www.amerilendloan.com" → "amerilendloan.com"
 *       "amerilendloan.com"     → "amerilendloan.com"
 * Returns the hostname unchanged when it has two or fewer labels
 * (e.g. "localhost", "example.com") so we never accidentally strip a
 * meaningful part.
 */
function getApexDomain(hostname: string): string {
  const parts = hostname.replace(/^\./, "").split(".");
  // For "www.amerilendloan.com" → ["www","amerilendloan","com"] → take last 2
  if (parts.length > 2) {
    return parts.slice(-2).join(".");
  }
  return parts.join(".");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // Determine the real client-facing hostname.
  // Behind Vercel rewrites, req.hostname may be the Railway internal hostname
  // (e.g. "amerilendloan-production.up.railway.app") instead of the user-facing
  // domain. Check X-Forwarded-Host, then Origin/Referer to get the actual domain.
  const hostname = getClientHostname(req);
  const secure = isSecureRequest(req);
  const shouldSetDomain =
    hostname &&
    !LOCAL_HOSTS.has(hostname) &&
    !isIpAddress(hostname);

  // Always use the apex domain so that cookies set on "www.example.com"
  // and "example.com" share the same cookie jar and can be cleared reliably.
  const apex = shouldSetDomain ? getApexDomain(hostname) : undefined;
  const domain = apex ? `.${apex}` : undefined;

  // Important: Browsers require Secure=true when SameSite=None.
  // Use SameSite=Lax for same-site requests (cookie is on the same domain as the page).
  // Only use SameSite=None when the cookie needs to be sent cross-site.
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    ...(domain ? { domain } : {}),
  };
}

/**
 * Get the real client-facing hostname, even behind reverse proxies.
 *
 * Priority (most → least trustworthy on a Vercel→Railway hop):
 *   1. COOKIE_DOMAIN env var — hard override, e.g. ".amerilendloan.com"
 *   2. VITE_APP_URL env var
 *   3. Origin header — always set by the browser on cross-origin/POST and
 *      cannot be forged by an intermediate proxy without the browser noticing
 *   4. Referer header
 *   5. X-Forwarded-Host — proxies SHOULD set this to the public hostname, but
 *      Vercel's rewrite-to-external-URL feature sets it to the *destination*
 *      hostname (the railway.app one), which is wrong for cookie scoping
 *   6. Express req.hostname (Host header)
 *
 * The reason Origin/Referer are placed above X-Forwarded-Host: in our setup
 * Vercel rewrites /api/* to Railway and forwards X-Forwarded-Host as the
 * Railway internal hostname, which would scope the session cookie to
 * `.railway.app` and the browser would refuse to store it on
 * `www.amerilendloan.com`. The browser-supplied Origin/Referer carry the
 * actual user-facing domain.
 */
function getClientHostname(req: Request): string {
  // If the actual request is from a local host, return it directly.
  // VITE_APP_URL may point to the production domain which would cause
  // cookie domain mismatches (e.g. domain=.amerilendloan.com on localhost).
  const actualHost = req.hostname;
  if (LOCAL_HOSTS.has(actualHost)) {
    return actualHost;
  }

  // 1. Hard override — strip any leading dot, the apex helper will normalize.
  const cookieDomain = process.env.COOKIE_DOMAIN?.replace(/^\./, "").trim();
  if (cookieDomain) {
    return cookieDomain;
  }

  // 2. VITE_APP_URL env var — most reliable, explicitly configured by the operator
  const appUrl = process.env.VITE_APP_URL;
  if (appUrl) {
    try {
      return new URL(appUrl).hostname;
    } catch { /* ignore parse errors */ }
  }

  // 3. Origin header (always present on POST/mutation requests from browsers,
  //    and on top-level navigations triggered cross-site). Trustworthy because
  //    browsers set it directly and proxies don't usually rewrite it.
  const origin = req.headers["origin"];
  if (origin) {
    try {
      const host = new URL(origin).hostname;
      if (host && !isIpAddress(host) && !LOCAL_HOSTS.has(host)) {
        return host;
      }
    } catch { /* ignore parse errors */ }
  }

  // 4. Referer header (set on most navigations by the browser).
  const referer = req.headers["referer"];
  if (referer) {
    try {
      const host = new URL(referer).hostname;
      if (host && !isIpAddress(host) && !LOCAL_HOSTS.has(host)) {
        return host;
      }
    } catch { /* ignore parse errors */ }
  }

  // 5. X-Forwarded-Host (proxies SHOULD set this to the public hostname).
  //    Last resort because Vercel rewrites set it to the destination's
  //    internal hostname instead of the user-facing one.
  const xfh = req.headers["x-forwarded-host"];
  if (xfh) {
    const host = (Array.isArray(xfh) ? xfh[0] : xfh).split(",")[0].trim();
    return host.replace(/:\d+$/, "");
  }

  // 6. Fallback to Express req.hostname (which reads Host header / trust proxy)
  return req.hostname;
}
