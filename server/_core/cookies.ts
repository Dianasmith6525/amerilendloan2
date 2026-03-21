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
  const hostname = req.hostname;
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
