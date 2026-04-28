/**
 * Global Error Handler Middleware
 * Handles all errors and returns standardized JSON responses
 */

import { Request, Response, NextFunction } from "express";
import { TRPCError } from "@trpc/server";
import { logger } from "./logger";

export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
  };
}

/**
 * Error codes mapping
 */
export const ERROR_CODES = {
  // Client Errors (4xx)
  BAD_REQUEST: "BAD_REQUEST",
  MALFORMED_JSON: "MALFORMED_JSON",
  INVALID_JSON: "INVALID_JSON",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
  RATE_LIMITED: "RATE_LIMITED",
  
  // Server Errors (5xx)
  INTERNAL_ERROR: "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  GATEWAY_ERROR: "GATEWAY_ERROR",
  
  // Auth Errors
  INVALID_OTP: "INVALID_OTP",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  
  // Business Logic Errors
  PASSWORD_WEAK: "PASSWORD_WEAK",
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
} as const;

/**
 * Parse error details from different error types
 */
function parseErrorDetails(error: any): { code: string; message: string; details?: Record<string, any> } {
  // SyntaxError (malformed JSON)
  if (error instanceof SyntaxError) {
    return {
      code: ERROR_CODES.MALFORMED_JSON,
      message: "Malformed JSON in request body",
      details: {
        expected: "Valid JSON",
        received: "Invalid JSON format",
        parseError: error.message,
      },
    };
  }

  // zod validation errors
  if (error.name === "ZodError") {
    const issues = error.issues || [];
    const missing_fields: string[] = [];
    const invalid_fields: any[] = [];

    // Separate missing fields from validation errors
    for (const issue of issues) {
      const fieldPath = issue.path.join(".");
      if (issue.code === "invalid_type" && (issue as any).received === "undefined") {
        missing_fields.push(fieldPath);
      } else {
        invalid_fields.push({
          field: fieldPath,
          message: issue.message,
          code: issue.code,
          received: (issue as any).received,
          expected: (issue as any).expected,
        });
      }
    }

    // Build comprehensive field errors map
    const field_errors: Record<string, string[]> = {};
    for (const issue of issues) {
      const fieldPath = issue.path.join(".");
      if (!field_errors[fieldPath]) {
        field_errors[fieldPath] = [];
      }
      field_errors[fieldPath].push(issue.message);
    }

    const details: Record<string, any> = {
      field_errors,
    };

    // Add missing_fields if any exist
    if (missing_fields.length > 0) {
      details.missing_fields = missing_fields;
    }

    // Add invalid_fields if any exist
    if (invalid_fields.length > 0) {
      details.invalid_fields = invalid_fields;
    }

    // Determine appropriate error message
    let message = "Validation failed";
    if (missing_fields.length > 0 && invalid_fields.length === 0) {
      message = `Missing required field${missing_fields.length > 1 ? "s" : ""}: ${missing_fields.join(", ")}`;
    } else if (missing_fields.length > 0 && invalid_fields.length > 0) {
      message = `Missing ${missing_fields.length} required field${missing_fields.length > 1 ? "s" : ""} and ${invalid_fields.length} invalid field${invalid_fields.length > 1 ? "s" : ""}`;
    } else if (invalid_fields.length > 0) {
      message = `${invalid_fields.length} field${invalid_fields.length > 1 ? "s" : ""} failed validation`;
    }

    return {
      code: missing_fields.length > 0 ? ERROR_CODES.MISSING_REQUIRED_FIELD : ERROR_CODES.VALIDATION_ERROR,
      message,
      details,
    };
  }

  // tRPC errors
  if (error instanceof TRPCError) {
    return {
      code: error.code.toUpperCase(),
      message: error.message,
    };
  }

  // TypeError (e.g., null reference)
  if (error instanceof TypeError) {
    return {
      code: ERROR_CODES.INVALID_INPUT,
      message: error.message,
      details: {
        type: "TypeError",
      },
    };
  }

  // Generic Error
  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: error.message || "An unexpected error occurred",
  };
}

/**
 * Map error codes to HTTP status codes
 */
export function getHttpStatusCode(code: string): number {
  const statusMap: Record<string, number> = {
    [ERROR_CODES.BAD_REQUEST]: 400,
    [ERROR_CODES.MALFORMED_JSON]: 400,
    [ERROR_CODES.INVALID_JSON]: 400,
    [ERROR_CODES.MISSING_REQUIRED_FIELD]: 422,
    [ERROR_CODES.VALIDATION_ERROR]: 422,
    [ERROR_CODES.INVALID_INPUT]: 400,
    [ERROR_CODES.UNAUTHORIZED]: 401,
    [ERROR_CODES.FORBIDDEN]: 403,
    [ERROR_CODES.NOT_FOUND]: 404,
    [ERROR_CODES.CONFLICT]: 409,
    [ERROR_CODES.DUPLICATE_ENTRY]: 409,
    [ERROR_CODES.UNPROCESSABLE_ENTITY]: 422,
    [ERROR_CODES.RATE_LIMITED]: 429,
    [ERROR_CODES.INTERNAL_ERROR]: 500,
    [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
    [ERROR_CODES.GATEWAY_ERROR]: 502,
    [ERROR_CODES.INVALID_OTP]: 400,
    [ERROR_CODES.INVALID_CREDENTIALS]: 401,
    [ERROR_CODES.ACCOUNT_LOCKED]: 403,
    [ERROR_CODES.SESSION_EXPIRED]: 401,
    [ERROR_CODES.PASSWORD_WEAK]: 422,
    [ERROR_CODES.EMAIL_ALREADY_EXISTS]: 409,
    [ERROR_CODES.ACCOUNT_NOT_FOUND]: 404,
  };

  return statusMap[code] || 500;
}

/**
 * Global error handler middleware for Express
 */
export function errorHandlerMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error("[Error Handler]", {
    path: req.path,
    method: req.method,
    error: err.message,
    code: err.code,
    timestamp: new Date().toISOString(),
  });

  const { code, message, details } = parseErrorDetails(err);
  const statusCode = getHttpStatusCode(code);

  const response: StandardErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      timestamp: new Date().toISOString(),
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Malformed JSON handler middleware
 * Must be placed before bodyParser to catch JSON parse errors
 */
export function malformedJsonHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof SyntaxError && "body" in err) {
    const errorResponse: StandardErrorResponse = {
      success: false,
      error: {
        code: ERROR_CODES.MALFORMED_JSON,
        message: "Invalid JSON in request body",
        details: {
          expected: "Valid JSON format",
          error: err.message,
          body_preview: req.body ? JSON.stringify(req.body).substring(0, 100) : "empty",
        },
        timestamp: new Date().toISOString(),
      },
    };

    res.status(400).json(errorResponse);
    return;
  }

  next(err);
}

/**
 * Catch-all 404 handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const errorResponse: StandardErrorResponse = {
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Route not found: ${req.method} ${req.path}`,
      details: {
        method: req.method,
        path: req.path,
        available_routes: [
          "POST /api/trpc/*",
          "GET /health",
          "GET /dist/public/*",
        ],
      },
      timestamp: new Date().toISOString(),
    },
  };

  res.status(404).json(errorResponse);
}

/**
 * Health check endpoint
 */
export function healthCheckHandler(req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Validate JSON request wrapper
 */
export function validateJsonRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip validation for file upload endpoints or multipart/form-data
  if (
    req.path.includes("/upload") ||
    req.headers["content-type"]?.includes("multipart/form-data")
  ) {
    return next();
  }

  // Check Content-Type header
  if (
    req.method !== "GET" &&
    req.method !== "HEAD" &&
    req.headers["content-type"]
  ) {
    const contentType = req.headers["content-type"].split(";")[0];
    if (!contentType.includes("application/json")) {
      const errorResponse: StandardErrorResponse = {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_INPUT,
          message: "Content-Type must be application/json",
          details: {
            expected: "application/json",
            received: contentType,
          },
          timestamp: new Date().toISOString(),
        },
      };

      res.status(400).json(errorResponse);
      return;
    }
  }

  next();
}
