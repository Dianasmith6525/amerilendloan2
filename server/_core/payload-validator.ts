/**
 * Payload Validation Middleware
 * Validates request payloads and ensures they're not empty
 * Returns proper error responses for empty or missing payloads
 */

import { Request, Response, NextFunction } from "express";

export interface PayloadValidationOptions {
  allowEmpty?: boolean; // Allow empty payloads (default: false)
  allowEmptyArrays?: boolean; // Allow empty arrays (default: false)
  allowEmptyObjects?: boolean; // Allow empty objects (default: false)
  minSize?: number; // Minimum payload size in bytes (default: 1)
  excludePaths?: string[]; // Paths to exclude from validation
  excludeMethods?: string[]; // HTTP methods to exclude (default: ["GET", "HEAD", "DELETE"])
}

export interface ValidationError {
  code: string;
  message: string;
  details?: {
    reason: string;
    received?: string;
    expected?: string;
  };
}

const DEFAULT_EXCLUDE_METHODS = ["GET", "HEAD", "DELETE", "OPTIONS"];

/**
 * Check if payload is empty
 */
export function isEmptyPayload(
  body: any,
  options: PayloadValidationOptions = {}
): { isEmpty: boolean; reason?: string } {
  // Check for undefined or null
  if (body === undefined || body === null) {
    return { isEmpty: true, reason: "Payload is null or undefined" };
  }

  // Check for empty strings
  if (typeof body === "string" && body.trim() === "") {
    return { isEmpty: true, reason: "Payload is an empty string" };
  }

  // Check for empty objects
  if (
    typeof body === "object" &&
    !Array.isArray(body) &&
    Object.keys(body).length === 0 &&
    !options.allowEmptyObjects
  ) {
    return { isEmpty: true, reason: "Payload is an empty object" };
  }

  // Check for empty arrays
  if (
    Array.isArray(body) &&
    body.length === 0 &&
    !options.allowEmptyArrays
  ) {
    return { isEmpty: true, reason: "Payload is an empty array" };
  }

  // Check for minimum size if specified
  if (options.minSize && options.minSize > 0) {
    const size = JSON.stringify(body).length;
    if (size < options.minSize) {
      return {
        isEmpty: true,
        reason: `Payload size (${size} bytes) is below minimum (${options.minSize} bytes)`,
      };
    }
  }

  return { isEmpty: false };
}

/**
 * Create a standardized empty payload error response
 */
export function createEmptyPayloadErrorResponse(
  reason: string,
  statusCode: number = 400
): {
  success: false;
  error: ValidationError;
  meta: { timestamp: string };
} {
  return {
    success: false,
    error: {
      code: "EMPTY_PAYLOAD",
      message: "Invalid input: Empty or missing payload",
      details: {
        reason,
        expected: "Non-empty JSON object or array",
        received: "Empty or missing payload",
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Check if request path should be validated
 */
function shouldValidatePath(
  path: string,
  excludePaths: string[] = []
): boolean {
  // Health check endpoint should be excluded
  if (path === "/health") return false;

  // Static files should be excluded
  if (path.startsWith("/dist") || path.startsWith("/public")) return false;

  // OAuth routes should be excluded
  if (path.startsWith("/api/oauth")) return false;

  // Check custom exclude patterns
  for (const pattern of excludePaths) {
    if (path.startsWith(pattern)) {
      return false;
    }
  }

  return true;
}

/**
 * Payload validation middleware
 * Validates that POST/PUT/PATCH requests have non-empty payloads
 */
export function validatePayload(
  userOptions: PayloadValidationOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const options: Required<PayloadValidationOptions> = {
    allowEmpty: userOptions.allowEmpty ?? false,
    allowEmptyArrays: userOptions.allowEmptyArrays ?? false,
    allowEmptyObjects: userOptions.allowEmptyObjects ?? false,
    minSize: userOptions.minSize ?? 1,
    excludePaths: userOptions.excludePaths ?? [],
    excludeMethods: userOptions.excludeMethods ?? DEFAULT_EXCLUDE_METHODS,
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip validation for excluded methods
    if (options.excludeMethods.includes(req.method)) {
      next();
      return;
    }

    // Skip validation for excluded paths
    if (!shouldValidatePath(req.path, options.excludePaths)) {
      next();
      return;
    }

    // If allowEmpty is true, skip validation
    if (options.allowEmpty) {
      next();
      return;
    }

    // Check if payload is empty
    const { isEmpty, reason } = isEmptyPayload(req.body, options);

    if (isEmpty && reason) {
      console.warn(`[Payload Validation] Empty payload on ${req.method} ${req.path}: ${reason}`);

      const errorResponse = createEmptyPayloadErrorResponse(reason);

      res.status(400).json(errorResponse);
      return;
    }

    next();
  };
}

/**
 * Advanced payload validator with custom rules
 */
export class PayloadValidator {
  private rules: Map<string, (body: any) => { valid: boolean; error?: string }> = new Map();
  private excludePaths: Set<string> = new Set();
  private excludeMethods: Set<string> = new Set(DEFAULT_EXCLUDE_METHODS);

  constructor() {
    // Register default rules
    this.rules.set("not-empty", (body) => {
      if (body === undefined || body === null) {
        return { valid: false, error: "Payload is required" };
      }
      return { valid: true };
    });

    this.rules.set("has-required-fields", (body) => {
      if (typeof body !== "object" || body === null) {
        return { valid: false, error: "Payload must be an object" };
      }
      return { valid: true };
    });
  }

  /**
   * Add a custom validation rule
   */
  addRule(
    name: string,
    validator: (body: any) => { valid: boolean; error?: string }
  ): this {
    this.rules.set(name, validator);
    return this;
  }

  /**
   * Exclude a path from validation
   */
  excludePath(path: string): this {
    this.excludePaths.add(path);
    return this;
  }

  /**
   * Exclude a method from validation
   */
  excludeMethod(method: string): this {
    this.excludeMethods.add(method);
    return this;
  }

  /**
   * Validate payload against rules
   */
  validate(body: any, ruleNames: string[] = ["not-empty"]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const ruleName of ruleNames) {
      const rule = this.rules.get(ruleName);
      if (!rule) {
        errors.push(`Unknown rule: ${ruleName}`);
        continue;
      }

      const result = rule(body);
      if (!result.valid && result.error) {
        errors.push(result.error);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get middleware function
   */
  middleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Skip validation for excluded methods
      if (this.excludeMethods.has(req.method)) {
        next();
        return;
      }

      // Skip validation for excluded paths
      if (this.excludePaths.has(req.path)) {
        next();
        return;
      }

      // Validate payload
      const { valid, errors } = this.validate(req.body);

      if (!valid) {
        const errorResponse = {
          success: false,
          error: {
            code: "INVALID_PAYLOAD",
            message: "Payload validation failed",
            details: {
              errors,
            },
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        };

        res.status(400).json(errorResponse);
        return;
      }

      next();
    };
  }
}

/**
 * Create a pre-configured validator for common use cases
 */
export function createCommonPayloadValidator(): PayloadValidator {
  const validator = new PayloadValidator();

  // Exclude common non-payload endpoints
  validator
    .excludePath("/health")
    .excludePath("/dist")
    .excludePath("/public")
    .excludePath("/api/oauth");

  // Add common validation rules
  validator.addRule("min-object-keys", (body) => {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return { valid: true }; // Skip if not an object
    }
    if (Object.keys(body).length === 0) {
      return { valid: false, error: "Object must have at least one key" };
    }
    return { valid: true };
  });

  validator.addRule("valid-json", (body) => {
    try {
      JSON.stringify(body);
      return { valid: true };
    } catch {
      return { valid: false, error: "Payload is not valid JSON-serializable" };
    }
  });

  return validator;
}

/**
 * Strict payload validator that enforces strict validation rules
 */
export class StrictPayloadValidator extends PayloadValidator {
  constructor() {
    super();

    // Add strict rules
    this.addRule("strict-non-empty-object", (body) => {
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return { valid: false, error: "Payload must be a non-empty object" };
      }
      if (Object.keys(body).length === 0) {
        return { valid: false, error: "Object cannot be empty" };
      }
      return { valid: true };
    });

    this.addRule("strict-non-empty-array", (body) => {
      if (!Array.isArray(body)) {
        return { valid: false, error: "Payload must be an array" };
      }
      if (body.length === 0) {
        return { valid: false, error: "Array cannot be empty" };
      }
      return { valid: true };
    });

    this.addRule("no-null-values", (body) => {
      if (typeof body === "object" && body !== null) {
        for (const [key, value] of Object.entries(body)) {
          if (value === null) {
            return {
              valid: false,
              error: `Field '${key}' cannot be null`,
            };
          }
        }
      }
      return { valid: true };
    });
  }
}

/**
 * Content length validator middleware
 * Checks request body size before validation
 */
export function validateContentLength(
  minBytes: number = 1,
  maxBytes: number = 50 * 1024 * 1024 // 50MB default
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers["content-length"];

    if (contentLength) {
      const length = parseInt(contentLength, 10);

      if (length < minBytes) {
        const errorResponse = {
          success: false,
          error: {
            code: "CONTENT_TOO_SMALL",
            message: "Request body is too small",
            details: {
              min: minBytes,
              received: length,
            },
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        };
        res.status(400).json(errorResponse);
        return;
      }

      if (length > maxBytes) {
        const errorResponse = {
          success: false,
          error: {
            code: "CONTENT_TOO_LARGE",
            message: "Request body is too large",
            details: {
              max: maxBytes,
              received: length,
            },
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        };
        res.status(413).json(errorResponse);
        return;
      }
    }

    next();
  };
}

/**
 * Utility to check if body has specific required fields
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  if (!body || typeof body !== "object") {
    return { valid: false, missing: requiredFields };
  }

  const missing = requiredFields.filter(field => {
    const value = body[field];
    return value === undefined || value === null || value === "";
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Create error response for missing required fields
 */
export function createMissingFieldsErrorResponse(
  missingFields: string[]
): {
  success: false;
  error: ValidationError;
  meta: { timestamp: string };
} {
  return {
    success: false,
    error: {
      code: "MISSING_REQUIRED_FIELDS",
      message: `Missing required field${missingFields.length > 1 ? "s" : ""}: ${missingFields.join(", ")}`,
      details: {
        reason: "One or more required fields are missing",
        received: `Provided: unknown`,
        expected: missingFields.join(", "),
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}
