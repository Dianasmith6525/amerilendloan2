import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("server/logger", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalEnv;
    // Clear module cache so the logger re-evaluates isProduction
    vi.resetModules();
  });

  it("logger.info calls console.log", async () => {
    process.env.NODE_ENV = "development";
    const { logger } = await import("./logger");
    logger.info("hello world");
    expect(console.log).toHaveBeenCalled();
  });

  it("logger.error calls console.error", async () => {
    process.env.NODE_ENV = "development";
    const { logger } = await import("./logger");
    logger.error("oops", new Error("test"));
    expect(console.error).toHaveBeenCalled();
  });

  it("logger.warn calls console.warn", async () => {
    process.env.NODE_ENV = "development";
    const { logger } = await import("./logger");
    logger.warn("caution");
    expect(console.warn).toHaveBeenCalled();
  });

  it("logger.info with metadata includes the meta object", async () => {
    process.env.NODE_ENV = "development";
    const { logger } = await import("./logger");
    logger.info("with meta", { userId: 42 });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[INFO]"),
      expect.objectContaining({ userId: 42 })
    );
  });

  it("logger redacts sensitive fields like password and ssn", async () => {
    process.env.NODE_ENV = "development";
    const { logger } = await import("./logger");
    logger.info("user action", { userId: 1, password: "secret123", ssn: "123-45-6789" });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[INFO]"),
      expect.objectContaining({ userId: 1, password: "[REDACTED]", ssn: "[REDACTED]" })
    );
  });

  it("logger redacts nested sensitive fields", async () => {
    process.env.NODE_ENV = "development";
    const { logger } = await import("./logger");
    logger.info("nested", { user: { name: "John", token: "abc123" } });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[INFO]"),
      expect.objectContaining({ user: { name: "John", token: "[REDACTED]" } })
    );
  });
});
