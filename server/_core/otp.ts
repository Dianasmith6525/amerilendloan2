/**
 * OTP (One-Time Password) authentication module
 * Handles OTP generation, validation, and delivery for signup/login
 */

import { getDb } from "../db";
import { otpCodes } from "../../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";
import { sendOTPSMS } from "./sms";
import { sendOTPEmail as sendEmailViaSendGrid } from "./email";

/**
 * In-memory rate limiter for OTP requests
 * Limits each identifier (email/phone) to MAX_REQUESTS_PER_WINDOW requests per TIME_WINDOW_MS
 */
const otpRequestTracker = new Map<string, { count: number; windowStart: number }>();
const MAX_REQUESTS_PER_WINDOW = 5; // max 5 OTP requests per window
const TIME_WINDOW_MS = 15 * 60 * 1000; // 15-minute window

function checkOTPRateLimit(identifier: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const key = identifier.toLowerCase().trim();
  const tracker = otpRequestTracker.get(key);

  if (!tracker || (now - tracker.windowStart) > TIME_WINDOW_MS) {
    // New window
    otpRequestTracker.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (tracker.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((tracker.windowStart + TIME_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds: retryAfter };
  }

  tracker.count++;
  return { allowed: true };
}

// Clean up stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(otpRequestTracker.entries());
  for (const [key, tracker] of entries) {
    if (now - tracker.windowStart > TIME_WINDOW_MS * 2) {
      otpRequestTracker.delete(key);
    }
  }
}, 30 * 60 * 1000);

/**
 * Generate a 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create and store an OTP code for email or phone verification
 */
export async function createOTP(
  identifier: string, // email or phone
  purpose: "signup" | "login" | "reset",
  type: "email" | "phone" = "email"
): Promise<string> {
  // Rate limit check
  const rateCheck = checkOTPRateLimit(identifier);
  if (!rateCheck.allowed) {
    throw new Error(`Too many code requests. Please wait ${rateCheck.retryAfterSeconds} seconds before requesting another code.`);
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate any existing OTP codes for this identifier/purpose
  await db
    .update(otpCodes)
    .set({ verified: 1 }) // Mark as verified to prevent reuse
    .where(
      and(
        eq(otpCodes.email, identifier),
        eq(otpCodes.purpose, purpose),
        eq(otpCodes.verified, 0)
      )
    );

  // Create new OTP
  await db.insert(otpCodes).values({
    email: identifier, // Store phone in email field for now
    code,
    purpose,
    expiresAt,
    verified: 0,
    attempts: 0,
  });

  return code;
}

/**
 * Verify an OTP code
 */
export async function verifyOTP(
  identifier: string, // email or phone
  code: string,
  purpose: "signup" | "login" | "reset"
): Promise<{ valid: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { valid: false, error: "Database not available" };
  }

  // Find the most recent unverified OTP for this identifier/purpose
  const results = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, identifier),
        eq(otpCodes.purpose, purpose),
        eq(otpCodes.verified, 0),
        gt(otpCodes.expiresAt, new Date())
      )
    )
    .orderBy(otpCodes.createdAt)
    .limit(1);

  if (results.length === 0) {
    return { valid: false, error: "No valid OTP found or OTP expired" };
  }

  const otpRecord = results[0];

  // Check if too many attempts
  if (otpRecord.attempts >= 5) {
    return { valid: false, error: "Too many failed attempts. Please request a new code." };
  }

  // Increment attempts
  await db
    .update(otpCodes)
    .set({ attempts: otpRecord.attempts + 1 })
    .where(eq(otpCodes.id, otpRecord.id));

  // Verify code
  if (otpRecord.code !== code) {
    return { valid: false, error: "Invalid code" };
  }

  // Mark as verified
  await db
    .update(otpCodes)
    .set({ verified: 1 })
    .where(eq(otpCodes.id, otpRecord.id));

  return { valid: true };
}

/**
 * Verify OTP for password reset - accepts already-verified codes from the previous verification step
 * This is needed because the password reset flow has two steps:
 * 1. Verify code (calls verifyCode which marks as verified)
 * 2. Submit new password (calls resetPasswordWithOTP which needs to validate the same code)
 */
export async function verifyOTPForPasswordReset(
  identifier: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { valid: false, error: "Database not available" };
  }

  // For password reset, find the most recent OTP (verified or unverified) that matches
  // This allows the code to be checked after it's already been verified in the verify step
  const results = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, identifier),
        eq(otpCodes.purpose, "reset"),
        gt(otpCodes.expiresAt, new Date())
      )
    )
    .orderBy(otpCodes.createdAt)
    .limit(1);

  if (results.length === 0) {
    return { valid: false, error: "No valid OTP found or OTP expired" };
  }

  const otpRecord = results[0];

  // Check if code matches
  if (otpRecord.code !== code) {
    return { valid: false, error: "Invalid code" };
  }

  return { valid: true };
}

/**
 * Send OTP via email using SendGrid
 */
export async function sendOTPEmail(email: string, code: string, purpose: "signup" | "login" | "reset"): Promise<void> {
  await sendEmailViaSendGrid(email, code, purpose);
}

/**
 * Send OTP via phone (SMS using Twilio)
 */
export async function sendOTPPhone(phone: string, code: string, purpose: "signup" | "login" | "reset"): Promise<void> {
  await sendOTPSMS(phone, code, purpose);
  // sendOTPSMS logs the code to console as a dev fallback even if Twilio isn't configured
}

/**
 * Clean up expired OTP codes (should be run periodically)
 */
export async function cleanupExpiredOTPs(): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  // Mark OTPs older than 1 hour as verified to prevent reuse
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  await db
    .update(otpCodes)
    .set({ verified: 1 })
    .where(
      and(
        eq(otpCodes.verified, 0),
        gt(otpCodes.expiresAt, oneHourAgo)
      )
    );
}
