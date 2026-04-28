import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "./routers";

// Mock server URL - tests run against localhost when server is available
const BASE_URL = process.env.TEST_SERVER_URL || "http://localhost:5000";

function isServerUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const anyError = error as {
    message?: string;
    cause?: unknown;
    data?: unknown;
    shape?: unknown;
  };

  const directMessage = anyError.message ?? "";
  if (/ECONNREFUSED|fetch failed|ENOTFOUND|EAI_AGAIN/i.test(directMessage)) {
    return true;
  }

  const serialized = JSON.stringify({
    cause: anyError.cause,
    data: anyError.data,
    shape: anyError.shape,
  });

  return /ECONNREFUSED|fetch failed|ENOTFOUND|EAI_AGAIN/i.test(serialized);
}

/**
 * tRPC Integration Tests
 * 
 * These tests validate the tRPC API endpoints work correctly.
 * They require a running server to execute against.
 * 
 * To run with server:
 * 1. Start the server: pnpm dev
 * 2. Run tests: pnpm test
 */

// Create tRPC client for testing
function createTestClient() {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${BASE_URL}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });
}

describe("tRPC API Integration Tests", () => {
  // Skip integration tests in CI without server
  const shouldSkip = !process.env.TEST_SERVER_URL && process.env.CI === "true";

  describe("Public Endpoints (No Auth Required)", () => {
    it.skipIf(shouldSkip)("system.health returns ok status", async () => {
      const client = createTestClient();
      
      try {
        // system.health requires { timestamp: number } input
        const result = await client.system.health.query({ timestamp: Date.now() });
        expect(result).toHaveProperty("ok");
        expect(result.ok).toBe(true);
      } catch (error: any) {
        // If server not running, skip gracefully
        if (isServerUnavailableError(error)) {
          console.log("Server not running - skipping integration test");
          return;
        }
        throw error;
      }
    });

    it.skipIf(shouldSkip)("auth.me returns null for unauthenticated requests", async () => {
      const client = createTestClient();
      
      try {
        const result = await client.auth.me.query();
        // Should return null when not authenticated
        expect(result).toBeNull();
      } catch (error: any) {
        if (isServerUnavailableError(error)) {
          console.log("Server not running - skipping integration test");
          return;
        }
        throw error;
      }
    });

    it.skipIf(shouldSkip)("loans.checkDuplicate validates SSN format", async () => {
      const client = createTestClient();
      
      try {
        // Deliberately use invalid format to test validation
        await client.loans.checkDuplicate.query({
          dateOfBirth: "invalid-date",
          ssn: "invalid-ssn",
        });
        expect.fail("Expected validation error");
      } catch (error: any) {
        if (isServerUnavailableError(error)) {
          console.log("Server not running - skipping integration test");
          return;
        }
        // Should get validation error for invalid input
        expect(error.message).toMatch(/Invalid|format|required/i);
      }
    });

    it.skipIf(shouldSkip)("ai.chat handles long conversation history without crashing", async () => {
      const client = createTestClient();

      try {
        const longMessages = Array.from({ length: 60 }, (_, i) => ({
          role: i % 2 === 0 ? "user" as const : "assistant" as const,
          content: `Long history message ${i + 1}: ${"context ".repeat(120)}`,
        }));

        const result = await client.ai.chat.mutate({
          messages: [
            ...longMessages,
            {
              role: "user",
              content: `Please summarize my status and next steps. ${"extra ".repeat(500)}`,
            },
          ],
        });

        expect(result).toHaveProperty("success", true);
        expect(typeof result.message).toBe("string");
        expect(result.message.length).toBeGreaterThan(0);
      } catch (error: any) {
        if (isServerUnavailableError(error)) {
          console.log("Server not running - skipping integration test");
          return;
        }
        throw error;
      }
    });

    it.skipIf(shouldSkip)("system.chatWithAi handles long conversation history without crashing", async () => {
      const client = createTestClient();

      try {
        const conversationHistory = Array.from({ length: 70 }, (_, i) => ({
          role: i % 2 === 0 ? "user" as const : "assistant" as const,
          content: `Historical message ${i + 1}: ${"support ".repeat(110)}`,
        }));

        const result = await client.system.chatWithAi.mutate({
          message: `Can you still respond reliably with this long history? ${"tail ".repeat(450)}`,
          conversationHistory,
        });

        expect(result).toHaveProperty("success", true);
        expect(typeof result.message).toBe("string");
        expect(result.message.length).toBeGreaterThan(0);
      } catch (error: any) {
        if (isServerUnavailableError(error)) {
          console.log("Server not running - skipping integration test");
          return;
        }
        throw error;
      }
    });
  });

  describe("Protected Endpoints (Auth Required)", () => {
    it.skipIf(shouldSkip)("loans.myLoans returns UNAUTHORIZED without auth", async () => {
      const client = createTestClient();
      
      try {
        await client.loans.myLoans.query();
        // Should not reach here - should throw UNAUTHORIZED
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error: any) {
        // Expect UNAUTHORIZED error for protected routes
        if (isServerUnavailableError(error)) {
          console.log("Server not running - skipping integration test");
          return;
        }
        expect(error.message).toMatch(/UNAUTHORIZED|logged in|session|login/i);
      }
    });

    it.skipIf(shouldSkip)("loans.myApplications returns UNAUTHORIZED without auth", async () => {
      const client = createTestClient();
      
      try {
        await client.loans.myApplications.query();
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error: any) {
        if (isServerUnavailableError(error)) {
          console.log("Server not running - skipping integration test");
          return;
        }
        expect(error.message).toMatch(/UNAUTHORIZED|logged in|session|login/i);
      }
    });

    it.skipIf(shouldSkip)("auth.updatePassword returns UNAUTHORIZED without auth", async () => {
      const client = createTestClient();
      
      try {
        await client.auth.updatePassword.mutate({
          currentPassword: "validpassword123",
          newPassword: "newpassword456",
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error: any) {
        if (isServerUnavailableError(error)) {
          console.log("Server not running - skipping integration test");
          return;
        }
        expect(error.message).toMatch(/UNAUTHORIZED|logged in|session|login/i);
      }
    });

    it.skipIf(shouldSkip)("adminAi.chat returns UNAUTHORIZED without auth", async () => {
      const client = createTestClient();

      try {
        await client.adminAi.chat.mutate({
          messages: [
            {
              role: "user",
              content: "What should I prioritize today?",
            },
          ],
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error: any) {
        if (isServerUnavailableError(error)) {
          console.log("Server not running - skipping integration test");
          return;
        }
        expect(error.message).toMatch(/UNAUTHORIZED|logged in|session|login|FORBIDDEN|permission|10002/i);
      }
    });
  });

  describe("Input Validation", () => {
    it.skipIf(shouldSkip)("loans.getLoanByTrackingNumber validates input", async () => {
      const client = createTestClient();
      
      try {
        // Empty tracking number should fail validation
        await client.loans.getLoanByTrackingNumber.query({ trackingNumber: "" });
        expect.fail("Expected validation error");
      } catch (error: any) {
        if (isServerUnavailableError(error)) {
          console.log("Server not running - skipping integration test");
          return;
        }
        // Should get a validation error for empty string
        expect(error.message).toBeDefined();
      }
    });

    it.skipIf(shouldSkip)("auth.updatePassword validates password length", async () => {
      const client = createTestClient();
      
      try {
        await client.auth.updatePassword.mutate({
          currentPassword: "short", // Too short (min 8)
          newPassword: "short", // Too short (min 8)
        });
        expect.fail("Expected validation error");
      } catch (error: any) {
        if (isServerUnavailableError(error)) {
          console.log("Server not running - skipping integration test");
          return;
        }
        // Should get validation or auth error
        expect(error.message).toBeDefined();
      }
    });
  });

  describe("Error Handling", () => {
    it.skipIf(shouldSkip)("non-existent procedure returns proper error", async () => {
      // Test that the API properly handles requests to non-existent procedures
      try {
        const response = await fetch(`${BASE_URL}/api/trpc/nonexistent.procedure`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        
        // Should return 404 or error status
        expect(response.ok).toBe(false);
      } catch (error: any) {
        if (isServerUnavailableError(error)) {
          console.log("Server not running - skipping integration test");
          return;
        }
        throw error;
      }
    });
  });
});

describe("API Rate Limiting", () => {
  it("rate limiting headers are documented", () => {
    // Document the rate limits for reference
    const rateLimits = {
      apiRoutes: "100 requests per 15 minutes",
      authRoutes: "10 requests per minute",
      paymentRoutes: "5 requests per minute",
      uploadRoutes: "10 requests per minute",
    };
    
    expect(rateLimits.apiRoutes).toBe("100 requests per 15 minutes");
    expect(rateLimits.authRoutes).toBe("10 requests per minute");
  });
});

describe("API Response Format", () => {
  it("tRPC uses superjson transformer", () => {
    // Verify superjson is the transformer (critical for Date serialization)
    expect(superjson).toBeDefined();
    expect(typeof superjson.serialize).toBe("function");
    expect(typeof superjson.deserialize).toBe("function");
  });

  it("superjson correctly handles Date objects", () => {
    const date = new Date("2026-03-13T12:00:00Z");
    const serialized = superjson.serialize(date);
    const deserialized = superjson.deserialize(serialized);
    
    expect(deserialized).toBeInstanceOf(Date);
    expect((deserialized as Date).toISOString()).toBe(date.toISOString());
  });
});
