import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("server/env validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("exports ENV with expected shape", async () => {
    // Set minimum required vars
    process.env.DATABASE_URL = "postgres://localhost:5432/test";
    process.env.JWT_SECRET = "test-secret-key-long-enough";
    process.env.VITE_APP_ID = "test-app";

    const { ENV } = await import("./env");

    expect(ENV).toHaveProperty("databaseUrl");
    expect(ENV).toHaveProperty("cookieSecret");
    expect(ENV).toHaveProperty("appId");
    expect(ENV).toHaveProperty("isProduction");
    expect(typeof ENV.isProduction).toBe("boolean");
  });

  it("ENV.isProduction reflects NODE_ENV", async () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/test";
    process.env.JWT_SECRET = "test-secret-key-long-enough-for-production-32chars!!";
    process.env.VITE_APP_ID = "test-app";
    process.env.NODE_ENV = "production";

    const { ENV } = await import("./env");
    expect(ENV.isProduction).toBe(true);
  });

  it("logs warnings when required vars are missing", async () => {
    // Don't set required vars — validation should log errors
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.VITE_APP_ID;
    process.env.NODE_ENV = "development"; // don't exit

    await import("./env");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Missing or invalid environment variables")
    );
  });
});
