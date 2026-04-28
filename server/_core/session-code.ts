import { createHmac, timingSafeEqual } from "crypto";
import { ENV } from "./env";

/**
 * One-time session codes for secure cookie establishment.
 *
 * When a tRPC mutation sets a session cookie, Vercel's rewrite proxy may strip
 * the Set-Cookie header from the fetch response. To work around this, login
 * mutations return a short-lived, single-use code. The client then navigates to
 * /api/auth/session?code=... (a direct browser navigation), where the server
 * exchanges the code for a real session cookie via Set-Cookie—which IS preserved
 * on direct navigations.
 */

const CODE_TTL_MS = 60_000; // 1 minute

type SessionCodePayload = {
  token: string;
  expires: number;
};

function getSessionCodeSecret(): string {
  // Reuse the auth cookie secret so codes can be validated by any app instance.
  // (Critical for multi-instance deployments behind a load balancer.)
  return ENV.cookieSecret || process.env.JWT_SECRET || "dev-insecure-session-code-secret";
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payloadBase64Url: string): string {
  return createHmac("sha256", getSessionCodeSecret())
    .update(payloadBase64Url)
    .digest("base64url");
}

/**
 * Create a short-lived signed code that can redeem a session token.
 *
 * This is intentionally stateless so it works across multiple instances.
 */
export function createSessionCode(sessionToken: string): string {
  const payload: SessionCodePayload = {
    token: sessionToken,
    expires: Date.now() + CODE_TTL_MS,
  };
  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signaturePart = signPayload(payloadPart);
  return `${payloadPart}.${signaturePart}`;
}

/** Redeem a short-lived signed code. Returns the session token or null if invalid/expired. */
export function redeemSessionCode(code: string): string | null {
  if (!code || !code.includes(".")) return null;

  const [payloadPart, signaturePart] = code.split(".");
  if (!payloadPart || !signaturePart) return null;

  const expectedSignature = signPayload(payloadPart);
  const sigBuffer = Buffer.from(signaturePart, "base64url");
  const expectedBuffer = Buffer.from(expectedSignature, "base64url");

  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payloadPart)) as SessionCodePayload;
    if (!parsed?.token || !parsed?.expires) return null;
    if (parsed.expires < Date.now()) return null;
    return parsed.token;
  } catch {
    return null;
  }
}
