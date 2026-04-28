import { describe, it, expect } from "vitest";
import {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "./_core/errors";

describe("shared/errors", () => {
  it("HttpError stores statusCode and message", () => {
    const err = new HttpError(418, "I'm a teapot");
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(418);
    expect(err.message).toBe("I'm a teapot");
    expect(err.name).toBe("HttpError");
  });

  it("BadRequestError returns 400", () => {
    const err = BadRequestError("bad input");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("bad input");
  });

  it("UnauthorizedError returns 401", () => {
    const err = UnauthorizedError("no auth");
    expect(err.statusCode).toBe(401);
  });

  it("ForbiddenError returns 403", () => {
    const err = ForbiddenError("forbidden");
    expect(err.statusCode).toBe(403);
  });

  it("NotFoundError returns 404", () => {
    const err = NotFoundError("missing");
    expect(err.statusCode).toBe(404);
  });
});
