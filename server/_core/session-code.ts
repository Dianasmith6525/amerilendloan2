import { randomBytes } from "crypto";

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

interface PendingSession {
  token: string;
  expires: number;
}

const store = new Map<string, PendingSession>();

const CODE_TTL_MS = 60_000; // 1 minute
const CLEANUP_INTERVAL_MS = 60_000; // sweep every minute

// Periodic cleanup of expired codes
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, code) => {
    if (entry.expires < now) store.delete(code);
  });
}, CLEANUP_INTERVAL_MS).unref();

/** Store a session token and return a one-time code that can redeem it. */
export function createSessionCode(sessionToken: string): string {
  const code = randomBytes(32).toString("hex");
  store.set(code, { token: sessionToken, expires: Date.now() + CODE_TTL_MS });
  return code;
}

/** Redeem a one-time code. Returns the session token or null if invalid/expired. */
export function redeemSessionCode(code: string): string | null {
  const entry = store.get(code);
  if (!entry) return null;
  store.delete(code); // single-use
  if (entry.expires < Date.now()) return null;
  return entry.token;
}
