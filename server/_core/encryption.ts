import crypto from 'crypto';
import { ENV } from './env';

/**
 * Simple AES-256-CBC encryption/decryption for sensitive data like bank passwords
 * Uses cookieSecret (JWT_SECRET) as the encryption key
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Derive a 32-byte key from cookieSecret
function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(ENV.cookieSecret).digest();
}

/**
 * Encrypt sensitive data (like bank passwords)
 * Returns encrypted string in format: iv:encryptedData
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 * Takes encrypted string in format: iv:encryptedData
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = parts[1];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
