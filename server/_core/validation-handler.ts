/**
 * Validation Error Handler
 * Provides comprehensive validation error handling with detailed field-level reporting
 */

import { z } from "zod";
import { errorResponse, ERROR_CODES } from "./response-handler";

export type ValidationErrorDetails = {
  missing_fields?: string[];
  invalid_fields?: {
    field: string;
    message: string;
    code: string;
    expected?: string;
    received?: string;
  }[];
  field_errors?: Record<string, string[]>;
};

/**
 * Parse Zod validation errors and extract missing fields
 */
export function parseValidationError(error: z.ZodError): {
  code: string;
  message: string;
  details: ValidationErrorDetails;
  missing_count: number;
  invalid_count: number;
} {
  const missing_fields: string[] = [];
  const invalid_fields: ValidationErrorDetails["invalid_fields"] = [];
  const field_errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const fieldPath = issue.path.join(".");

    // Identify missing required fields
    if (issue.code === "invalid_type" && (issue as any).received === "undefined") {
      missing_fields.push(fieldPath);
      if (!field_errors[fieldPath]) {
        field_errors[fieldPath] = [];
      }
      field_errors[fieldPath].push("Required field is missing");
    } else {
      // Collect other validation errors
      invalid_fields.push({
        field: fieldPath,
        message: issue.message,
        code: issue.code,
        expected: (issue as any).expected?.toString(),
        received: (issue as any).received?.toString?.(),
      });
      if (!field_errors[fieldPath]) {
        field_errors[fieldPath] = [];
      }
      field_errors[fieldPath].push(issue.message);
    }
  }

  const details: ValidationErrorDetails = {};

  // Only include missing_fields if there are any
  if (missing_fields.length > 0) {
    details.missing_fields = missing_fields;
  }

  // Only include invalid_fields if there are any
  if (invalid_fields.length > 0) {
    details.invalid_fields = invalid_fields;
  }

  // Always include field_errors for complete error mapping
  details.field_errors = field_errors;

  const missing_count = missing_fields.length;
  const invalid_count = invalid_fields.length;

  let message = "Validation failed";
  if (missing_count > 0 && invalid_count === 0) {
    message = `Missing required field${missing_count > 1 ? "s" : ""}: ${missing_fields.join(", ")}`;
  } else if (missing_count > 0 && invalid_count > 0) {
    message = `Missing ${missing_count} required field${missing_count > 1 ? "s" : ""} and ${invalid_count} invalid field${invalid_count > 1 ? "s" : ""}`;
  } else if (invalid_count > 0) {
    message = `${invalid_count} field${invalid_count > 1 ? "s" : ""} failed validation`;
  }

  return {
    code: ERROR_CODES.VALIDATION_ERROR,
    message,
    details,
    missing_count,
    invalid_count,
  };
}

/**
 * Create a standardized validation error response
 */
export function validationErrorResponse(error: z.ZodError) {
  const { code, message, details } = parseValidationError(error);
  return errorResponse(code, message, details);
}

/**
 * Check if all required fields are present in input
 */
export function checkRequiredFields(
  input: Record<string, any>,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  const missing = requiredFields.filter(field => {
    const value = input[field];
    return value === undefined || value === null || value === "";
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Create a quick validation error for missing fields
 */
export function missingFieldsErrorResponse(missingFields: string[]) {
  return errorResponse(
    ERROR_CODES.VALIDATION_ERROR,
    `Missing required field${missingFields.length > 1 ? "s" : ""}: ${missingFields.join(", ")}`,
    {
      missing_fields: missingFields,
      field_errors: missingFields.reduce((acc, field) => {
        acc[field] = ["Required field is missing"];
        return acc;
      }, {} as Record<string, string[]>),
    }
  );
}

/**
 * Example Zod schemas for common endpoints
 */
export const AUTH_SCHEMAS = {
  signUp: z.object({
    email: z.string().email("Invalid email format").min(1, "Email is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
  }),

  signIn: z.object({
    email: z.string().email("Invalid email format").min(1, "Email is required"),
    password: z.string().min(1, "Password is required"),
  }),

  resetPassword: z.object({
    email: z.string().email("Invalid email format").min(1, "Email is required"),
  }),

  resetPasswordWithOTP: z.object({
    email: z.string().email("Invalid email format").min(1, "Email is required"),
    code: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  }),
};

export const LOAN_SCHEMAS = {
  checkDuplicate: z.object({
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
    ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, "SSN must be XXX-XX-XXXX format"),
  }),

  createApplication: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email format"),
    loanAmount: z.number().positive("Loan amount must be positive"),
    loanPurpose: z.string().min(1, "Loan purpose is required"),
    employment: z.string().min(1, "Employment status is required"),
  }),

  updateApplication: z.object({
    applicationId: z.string().min(1, "Application ID is required"),
    status: z.enum(["pending", "approved", "rejected", "cancelled"]),
  }),
};

export const PAYMENT_SCHEMAS = {
  createPayment: z.object({
    amount: z.number().positive("Amount must be positive").min(0.01, "Minimum amount is $0.01"),
    paymentMethod: z.enum(["card", "bank", "crypto"]),
    loanId: z.string().min(1, "Loan ID is required"),
  }),
};

/**
 * Middleware to validate request with Zod schema and return proper error
 */
export async function validateInput<T>(
  input: unknown,
  schema: z.ZodSchema<T>
): Promise<{ valid: true; data: T } | { valid: false; error: any }> {
  try {
    const result = schema.parse(input);
    return { valid: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: validationErrorResponse(error) };
    }
    throw error;
  }
}

/**
 * Extract field names from validation errors
 */
export function extractFieldNames(error: z.ZodError): string[] {
  const fields = new Set<string>();
  for (const issue of error.issues) {
    const fieldName = issue.path[0] as string;
    if (fieldName) fields.add(fieldName);
  }
  return Array.from(fields);
}

/**
 * Check if validation error contains missing required fields
 */
export function hasMissingRequiredFields(error: z.ZodError): boolean {
  return error.issues.some(issue => issue.code === "invalid_type" && (issue as any).received === "undefined");
}

/**
 * Get list of missing required fields
 */
export function getMissingFields(error: z.ZodError): string[] {
  return error.issues
    .filter(issue => issue.code === "invalid_type" && (issue as any).received === "undefined")
    .map(issue => issue.path.join("."));
}
