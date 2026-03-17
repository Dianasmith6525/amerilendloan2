/**
 * Security utility functions for input validation and sanitization
 * Helps prevent injection attacks and data corruption
 */

import { z } from "zod";
import rateLimit from 'express-rate-limit';
import geoip from 'geoip-lite';
import { Request } from 'express';
import * as db from '../db';
import { sendSuspiciousActivityAlert } from './email';
import { getIPLocation, formatLocation } from './geolocation';

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
  .min(1000, "Minimum loan amount is $1,000.00")
  .max(500000, "Maximum loan amount is $500,000.00");

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
  // Only flag multi-keyword injection patterns, not standalone common words
  const dangerousPatterns = [
    /\bUNION\s+(ALL\s+)?SELECT\b/i,
    /\bSELECT\s+.*\bFROM\b/i,
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+.*\bSET\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bDROP\s+(TABLE|DATABASE|INDEX)\b/i,
    /\bALTER\s+TABLE\b/i,
    /\bEXEC(UTE)?\s*\(/i,
    /<script\b/i,
    /(-{2})/,              // SQL line comments
    /(\/\*|\*\/)/,        // SQL block comments
    /(;\s*(DROP|DELETE|UPDATE|INSERT|ALTER))/i,  // Chained SQL statements
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

/**
 * Rate Limiting Configuration
 */

// Login rate limiter - 5 attempts per 15 minutes per IP
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// 2FA rate limiter - 3 attempts per 10 minutes per IP
export const twoFactorRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // 3 requests per window
  message: 'Too many 2FA verification attempts. Please try again in 10 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset rate limiter - 3 requests per hour per IP
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  message: 'Too many password reset requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * IP Geolocation Utilities
 */

export function getIpAddress(req: Request): string {
  // Try to get real IP from various headers (for proxies/load balancers)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp;
  }
  
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export interface GeoLocation {
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export function getGeoLocation(ipAddress: string): GeoLocation {
  const geo = geoip.lookup(ipAddress);
  
  if (!geo) {
    return { ip: ipAddress };
  }
  
  return {
    ip: ipAddress,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    latitude: geo.ll?.[0],
    longitude: geo.ll?.[1],
    timezone: geo.timezone,
  };
}

/**
 * Check if login is from a suspicious location
 * Returns true if this is a new country/region for this user
 */
export async function isSuspiciousLocation(
  userId: number,
  currentLocation: GeoLocation
): Promise<{ suspicious: boolean; reason?: string }> {
  // Get user's recent login history
  const recentLogins = await db.getLoginActivity(userId, 10);
  
  if (recentLogins.length === 0) {
    // First login - not suspicious
    return { suspicious: false };
  }
  
  // Parse location string from existing records (City, Country format)
  const loginCountries = new Set(
    recentLogins
      .map((login: any) => {
        if (!login.location) return null;
        const parts = login.location.split(',').map((p: string) => p.trim());
        return parts[parts.length - 1]; // Last part is country
      })
      .filter((country: string | null) => country)
  );
  
  if (currentLocation.country && !loginCountries.has(currentLocation.country)) {
    return {
      suspicious: true,
      reason: `Login from new country: ${currentLocation.country}`,
    };
  }
  
  // Check if user has logged in from this city recently (within 30 days)
  const recentCities = new Set(
    recentLogins
      .filter((login: any) => {
        const loginDate = new Date(login.createdAt);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return loginDate >= thirtyDaysAgo;
      })
      .map((login: any) => login.location)
      .filter((location: string | null) => location)
  );
  
  const currentLocationString = currentLocation.city && currentLocation.country
    ? `${currentLocation.city}, ${currentLocation.country}`
    : currentLocation.country || '';
    
  if (currentLocationString && !recentCities.has(currentLocationString)) {
    return {
      suspicious: true,
      reason: `Login from new location: ${currentLocationString}`,
    };
  }
  
  return { suspicious: false };
}

/**
 * Log login activity with geolocation
 */
export async function logLoginActivity(
  userId: number,
  ipAddress: string,
  success: boolean,
  userAgent?: string
): Promise<void> {
  // Use the async IP geolocation API for accurate location
  const ipLocationData = await getIPLocation(ipAddress);
  const location: GeoLocation = {
    ip: ipAddress,
    country: ipLocationData.country,
    region: ipLocationData.state,
    city: ipLocationData.city,
    latitude: ipLocationData.latitude,
    longitude: ipLocationData.longitude,
    timezone: ipLocationData.timezone,
  };
  
  // Format location as "City, State, Country" for storage
  const locationString = formatLocation(ipLocationData);
  
  await db.logLoginActivity(
    userId,
    ipAddress,
    userAgent || '',
    success,
    undefined, // failureReason
    false, // twoFactorUsed
    locationString // location with geolocation
  );
  
  // Check for suspicious location
  if (success) {
    const suspiciousCheck = await isSuspiciousLocation(userId, location);
    if (suspiciousCheck.suspicious) {
      console.log(`[Security] ⚠️ Suspicious login for user ${userId}: ${suspiciousCheck.reason}`);
      // Send email notification to user about suspicious login
      try {
        const user = await db.getUserById(userId);
        if (user?.email) {
          const locationStr = location.city && location.country
            ? `${location.city}, ${location.country}`
            : location.country || 'Unknown location';
          await sendSuspiciousActivityAlert(
            user.email,
            user.name || user.email,
            `Suspicious login detected from ${locationStr}. Reason: ${suspiciousCheck.reason}`,
            ipAddress
          );
        }
      } catch (emailErr) {
        console.error('[Security] Failed to send suspicious login alert email:', emailErr);
      }
    }
  }
}
