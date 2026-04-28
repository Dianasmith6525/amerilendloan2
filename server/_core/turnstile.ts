import { TRPCError } from "@trpc/server";
import { logger } from "./logger";

/**
 * Cloudflare Turnstile verification.
 *
 * Why Turnstile? Free, privacy-respecting (no GDPR overhead), invisible-by-default,
 * and effective against headless-browser bot floods on public form endpoints.
 *
 * Setup:
 *   1. Create a site at https://dash.cloudflare.com/?to=/:account/turnstile
 *   2. Set TURNSTILE_SECRET_KEY (server) and VITE_TURNSTILE_SITE_KEY (client)
 *   3. Deploy. With both keys present, verification is enforced. With either
 *      missing, this module logs once and fails open so the site still works
 *      while operators are mid-rollout.
 *
 * Soft-fail rationale: the alternative (hard-fail when secret is missing) would
 * brick every public form on the first deploy after this code lands. The
 * tradeoff is that misconfiguration is silent — the /health/detailed endpoint
 * exposes turnstile status so operators can verify enforcement is on.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let warnedAboutMissingSecret = false;

export type TurnstileVerifyResult =
  | { success: true; mode: "enforced" | "disabled" }
  | { success: false; mode: "enforced"; error: string };

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      logger.warn(
        "[turnstile] TURNSTILE_SECRET_KEY not set; bot verification is disabled. " +
          "Public forms (loan submit, contact, OTP request) are unprotected against bot floods. " +
          "See server/_core/turnstile.ts for setup instructions.",
      );
    }
    return { success: true, mode: "disabled" };
  }

  if (!token || typeof token !== "string") {
    return { success: false, mode: "enforced", error: "missing-input-response" };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (remoteIp) body.set("remoteip", remoteIp);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let response: Response;
    try {
      response = await fetch(SITEVERIFY_URL, {
        method: "POST",
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      logger.error(`[turnstile] siteverify returned HTTP ${response.status}`);
      // Fail closed on 4xx/5xx from Cloudflare — treat as a failed challenge
      // rather than letting requests through unverified.
      return { success: false, mode: "enforced", error: "siteverify-http-error" };
    }

    const data = (await response.json()) as {
      success: boolean;
      "error-codes"?: string[];
      hostname?: string;
      action?: string;
    };

    if (data.success) {
      return { success: true, mode: "enforced" };
    }

    const errorCode = data["error-codes"]?.[0] ?? "verification-failed";
    logger.warn(`[turnstile] verification failed: ${data["error-codes"]?.join(",") ?? "unknown"}`);
    return { success: false, mode: "enforced", error: errorCode };
  } catch (err) {
    // Network error / timeout. Fail closed: an attacker could otherwise force
    // failures by jamming the egress path to Cloudflare. Operators get a clear
    // log line and can flip TURNSTILE_SECRET_KEY off in an emergency.
    logger.error("[turnstile] siteverify request failed:", err);
    return { success: false, mode: "enforced", error: "siteverify-unreachable" };
  }
}

/**
 * Convenience wrapper: verify and throw a TRPCError on failure. Use inside
 * tRPC mutations to gate form submissions.
 */
export async function requireTurnstile(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<void> {
  const result = await verifyTurnstileToken(token, remoteIp);
  if (!result.success) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        result.error === "missing-input-response"
          ? "Please complete the verification challenge and try again."
          : "Bot verification failed. Please refresh the page and try again.",
    });
  }
}
