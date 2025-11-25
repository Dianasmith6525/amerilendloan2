import speakeasy from "speakeasy";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { ENV } from "./env";
import twilio from "twilio";

const twilioClient = ENV.twilioAccountSid && ENV.twilioAuthToken 
  ? twilio(ENV.twilioAccountSid, ENV.twilioAuthToken)
  : null;

/**
 * Generate a TOTP secret for authenticator apps
 */
export function generateTOTPSecret(userEmail: string) {
  const secret = speakeasy.generateSecret({
    name: `AmeriLend (${userEmail})`,
    issuer: "AmeriLend",
    length: 32,
  });

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
  };
}

/**
 * Generate QR code as data URL for TOTP setup
 */
export async function generateQRCode(otpauthUrl: string): Promise<string> {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return qrCodeDataUrl;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code");
  }
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTPCode(secret: string, code: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: code,
    window: 2, // Allow 2 time steps before/after for clock drift
  });
}

/**
 * Generate backup codes for account recovery
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding similar chars

  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < 10; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    codes.push(code);
  }

  return codes;
}

/**
 * Hash backup codes before storing
 */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  const hashedCodes = await Promise.all(
    codes.map(code => bcrypt.hash(code, 10))
  );
  return hashedCodes;
}

/**
 * Verify a backup code against stored hashes
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; usedIndex: number }> {
  for (let i = 0; i < hashedCodes.length; i++) {
    const isValid = await bcrypt.compare(code, hashedCodes[i]);
    if (isValid) {
      return { valid: true, usedIndex: i };
    }
  }
  return { valid: false, usedIndex: -1 };
}

/**
 * Send 2FA code via SMS using Twilio
 */
export async function send2FASMS(phoneNumber: string, code: string): Promise<boolean> {
  if (!twilioClient || !ENV.twilioPhoneNumber) {
    console.error("Twilio not configured");
    return false;
  }

  try {
    await twilioClient.messages.create({
      body: `Your AmeriLend verification code is: ${code}`,
      from: ENV.twilioPhoneNumber,
      to: phoneNumber,
    });
    return true;
  } catch (error) {
    console.error("Error sending 2FA SMS:", error);
    return false;
  }
}

/**
 * Generate a random 6-digit code for SMS 2FA
 */
export function generateSMSCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Encrypt sensitive 2FA data before storage
 */
export async function encrypt2FASecret(secret: string): Promise<string> {
  // Using bcrypt for encryption (one-way hash)
  // In production, use AES encryption with a secure key
  return await bcrypt.hash(secret, 10);
}

/**
 * Generate session token for 2FA verification
 */
export function generate2FASessionToken(): string {
  const buffer = Buffer.from(
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))
  );
  return buffer.toString("base64url");
}
