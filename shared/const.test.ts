import { describe, it, expect } from "vitest";
import {
  COOKIE_NAME,
  ONE_YEAR_MS,
  SESSION_COOKIE_MS,
  AXIOS_TIMEOUT_MS,
  UNAUTHED_ERR_MSG,
  NOT_ADMIN_ERR_MSG,
} from "./const";

describe("shared/const", () => {
  it("COOKIE_NAME is a non-empty string", () => {
    expect(COOKIE_NAME).toBe("app_session_id");
  });

  it("ONE_YEAR_MS is approximately 365 days in ms", () => {
    expect(ONE_YEAR_MS).toBe(1000 * 60 * 60 * 24 * 365);
  });

  it("SESSION_COOKIE_MS is 48 hours", () => {
    expect(SESSION_COOKIE_MS).toBe(1000 * 60 * 60 * 48);
  });

  it("AXIOS_TIMEOUT_MS is 30 seconds", () => {
    expect(AXIOS_TIMEOUT_MS).toBe(30_000);
  });

  it("auth error messages contain error codes", () => {
    expect(UNAUTHED_ERR_MSG).toContain("10001");
    expect(NOT_ADMIN_ERR_MSG).toContain("10002");
  });
});
