/**
 * Security utility functions for input validation and sanitization
 * Helps prevent injection attacks and data corruption
 */

import { z } from "zod";

/**
 * Common validation schemas to prevent injection attacks
 */

// Email validation
export const emailSchema = z
  .string()
  .email()
  .toLowerCase()
  .trim()
  .max(255);

// Username validation - no special characters that could be SQL
export const usernameSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscore, and hyphen");

// Full name validation
export const fullNameSchema = z
  .string()
  .min(2)
  .max(200)
  .trim()
  .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes");

// Loan amount validation - must be number within range
export const loanAmountSchema = z
  .number()
  .int()
  .min(1000, "Minimum loan amount is $10.00")
  .max(500000, "Maximum loan amount is $5,000.00");

// Phone number validation
export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s()-]+$/, "Invalid phone number format")
  .transform(val => val.replace(/\D/g, ''))
  .pipe(z.string().length(10, "Phone number must be 10 digits"));

// Bank routing number validation (9 digits, numbers only)
export const routingNumberSchema = z
  .string()
  .regex(/^\d{9}$/, "Routing number must be 9 digits");

// Bank account number validation (numbers and hyphens only)
export const accountNumberSchema = z
  .string()
  .regex(/^[\d-]{8,17}$/, "Invalid account number format")
  .transform(val => val.replace(/-/g, ''));

// SSN validation (9 digits, no special chars in database)
export const ssnSchema = z
  .string()
  .regex(/^\d{3}-?\d{2}-?\d{4}$/, "Invalid SSN format")
  .transform(val => val.replace(/-/g, ''));

// URLs - prevent javascript: and data: URIs
export const urlSchema = z
  .string()
  .url()
  .refine(url => !url.startsWith('javascript:') && !url.startsWith('data:'), {
    message: "Invalid URL protocol"
  });

// Search query - limit length and characters
export const searchQuerySchema = z
  .string()
  .min(1)
  .max(100)
  .trim()
  .regex(/^[a-zA-Z0-9\s%-]*$/, "Search query contains invalid characters");

/**
 * Sanitization functions
 */

/**
 * Remove potentially dangerous characters from strings
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>\"'%\\]/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
}

/**
 * Validate that a string is not a SQL injection attempt
 */
export function isSafeString(input: string): boolean {
  const dangerousPatterns = [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|SCRIPT)\b)/i,
    /(-{2}|\/\*|\*\/|;|\||&&)/,  // SQL comments and terminators
    /(['"`].*['"`])/,  // Quoted strings
  ];

  return !dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Escape HTML to prevent XSS attacks (in addition to SQL injection)
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validate array of IDs (prevent injection in IN clauses)
 */
export const idArraySchema = z
  .array(z.number().int().positive())
  .min(1)
  .max(1000);

/**
 * Input Validation Middleware
 */

/**
 * Create a safe database query from user input
 */
export function createSafeSearchQuery(input: string): { isValid: boolean; sanitized: string } {
  try {
    const sanitized = searchQuerySchema.parse(input);
    return { isValid: true, sanitized };
  } catch (error) {
    return { isValid: false, sanitized: '' };
  }
}

/**
 * Validate all common user inputs
 */
export const userInputSchema = z.object({
  firstName: fullNameSchema.optional(),
  lastName: fullNameSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  username: usernameSchema.optional(),
});

/**
 * Application input schema
 */
export const loanApplicationSchema = z.object({
  loanAmount: loanAmountSchema,
  loanTerm: z.number().int().min(3).max(60),
  employerName: fullNameSchema,
  employmentStatus: z.enum(['employed', 'self-employed', 'retired', 'student', 'other']),
  monthlyIncome: z.number().positive(),
});

/**
 * Log suspicious activity
 */
export function logSecurityEvent(
  eventType: 'injection_attempt' | 'xss_attempt' | 'auth_failure' | 'unauthorized_access',
  userId: string | null,
  details: string,
  timestamp: Date = new Date()
): void {
  console.warn(`[SECURITY] ${eventType.toUpperCase()} - User: ${userId || 'unknown'} - ${timestamp.toISOString()} - ${details}`);
  
  // In production, send to security monitoring service
  // await sendToSecurityMonitoring({ eventType, userId, details, timestamp });
}

/**
 * Rate limiting for sensitive operations
 */
const attemptTracker = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now();
  const attempt = attemptTracker.get(key);

  if (!attempt) {
    attemptTracker.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (now > attempt.resetTime) {
    // Window expired, reset
    attemptTracker.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (attempt.count >= maxAttempts) {
    logSecurityEvent('auth_failure', null, `Rate limit exceeded for key: ${key}`);
    return false;
  }

  attempt.count++;
  return true;
}

/**
 * Validate number is within safe range (prevent overflow attacks)
 */
export function isSafeNumber(num: number, min: number = -2147483648, max: number = 2147483647): boolean {
  return !isNaN(num) && isFinite(num) && num >= min && num <= max;
}

/**
 * Hash sensitive data for logging (never log actual values)
 */
import crypto from 'crypto';

export function hashForLogging(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 8);
}

/**
 * Validate JSON to prevent injection in JSON fields
 */
export function validateJSON(input: unknown): boolean {
  if (typeof input === 'string') {
    try {
      JSON.parse(input);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}
