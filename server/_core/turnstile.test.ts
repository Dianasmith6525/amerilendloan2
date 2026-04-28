import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

import { isTurnstileEnabled, requireTurnstile, verifyTurnstileToken } from "./turnstile";

describe("turnstile", () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("when TURNSTILE_SECRET_KEY is missing", () => {
    beforeEach(() => {
      delete process.env.TURNSTILE_SECRET_KEY;
    });

    it("reports disabled", () => {
      expect(isTurnstileEnabled()).toBe(false);
    });

    it("returns success with mode=disabled and never calls fetch", async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;

      const result = await verifyTurnstileToken("anything");

      expect(result).toEqual({ success: true, mode: "disabled" });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("requireTurnstile does not throw", async () => {
      await expect(requireTurnstile(undefined)).resolves.toBeUndefined();
    });
  });

  describe("when TURNSTILE_SECRET_KEY is set", () => {
    beforeEach(() => {
      process.env.TURNSTILE_SECRET_KEY = "test-secret";
    });

    it("rejects missing token without calling Cloudflare", async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;

      const result = await verifyTurnstileToken(undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("missing-input-response");
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns success when Cloudflare confirms the token", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }) as unknown as typeof fetch;

      const result = await verifyTurnstileToken("good-token", "1.2.3.4");

      expect(result).toEqual({ success: true, mode: "enforced" });
    });

    it("returns failure when Cloudflare rejects the token", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
      }) as unknown as typeof fetch;

      const result = await verifyTurnstileToken("bad-token");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("invalid-input-response");
      }
    });

    it("fails closed when siteverify is unreachable", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

      const result = await verifyTurnstileToken("any-token");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("siteverify-unreachable");
      }
    });

    it("requireTurnstile throws TRPCError(FORBIDDEN) on failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, "error-codes": ["timeout-or-duplicate"] }),
      }) as unknown as typeof fetch;

      await expect(requireTurnstile("expired-token")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      // Sanity check it really is a TRPCError
      await expect(requireTurnstile("expired-token")).rejects.toBeInstanceOf(TRPCError);
    });
  });
});
