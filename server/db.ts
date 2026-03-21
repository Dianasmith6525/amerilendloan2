import crypto from 'crypto';
import { asc, desc, eq, or, and, sql, ilike, inArray, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { logger } from "./_core/logger";
import type postgres from "postgres";
import { 
  InsertUser, 
  users,
  loanApplications,
  LoanApplication,
  InsertLoanApplication,
  feeConfiguration,
  FeeConfiguration,
  InsertFeeConfiguration,
  payments,
  Payment,
  InsertPayment,
  disbursements,
  Disbursement,
  InsertDisbursement,
  verificationDocuments,
  VerificationDocument,
  InsertVerificationDocument,
  adminActivityLog,
  AdminActivityLog,
  InsertAdminActivityLog,
  supportTickets,
  SupportTicket,
  InsertSupportTicket,
  ticketMessages,
  TicketMessage,
  InsertTicketMessage,
  automationRules,
  kycVerification,
  KycVerification,
  InsertKycVerification,
  uploadedDocuments,
  UploadedDocument,
  InsertUploadedDocument
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { COMPANY_INFO } from './_core/companyConfig';
import { 
  sendLoanApplicationReceivedEmail,
  sendLoanApplicationApprovedEmail,
  sendLoanApplicationRejectedEmail,
  sendLoanApplicationProcessingEmail,
  sendLoanApplicationMoreInfoEmail
} from "./_core/email";

// Bank account encryption utilities
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

// Encryption key for bank data — ENCRYPTION_KEY is preferred; JWT_SECRET is accepted as fallback
// but operators should set a dedicated ENCRYPTION_KEY in production
const ENCRYPTION_KEY = (() => {
  const dedicatedKey = process.env.ENCRYPTION_KEY;
  if (dedicatedKey) return crypto.createHash('sha256').update(dedicatedKey).digest();

  const fallback = process.env.JWT_SECRET;
  if (fallback) {
    if (process.env.NODE_ENV === 'production') {
      // Log loudly — operators must set ENCRYPTION_KEY in production
      logger.error('[SECURITY WARNING] Using JWT_SECRET for bank data encryption. Set a dedicated ENCRYPTION_KEY environment variable immediately.');
    }
    return crypto.createHash('sha256').update(fallback).digest();
  }

  throw new Error('[Security] No ENCRYPTION_KEY or JWT_SECRET configured — cannot encrypt bank data');
})();

function encryptBankData(data: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptBankData(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

let _db: ReturnType<typeof drizzle> | null = null;
let _client: any = null;
let _connectionStartTime: Date | null = null;
let _lastError: string | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  // If we have a db instance, try to verify it's still connected
  if (_db && _client) {
    try {
      // Quick validation query to ensure connection is still alive
      await _client`SELECT 1`;
      return _db;
    } catch (error) {
      logger.warn("[Database] Connection lost, attempting to reconnect...");
      _db = null;
      _client = null;
      _connectionStartTime = null;
    }
  }

  // Create new connection
  if (!_db && process.env.DATABASE_URL) {
    try {
      logger.info("[Database] Attempting to connect to database...");
      _connectionStartTime = new Date();
      
      const postgresModule = await import("postgres");
      const postgres = postgresModule.default;
      
      // Connection options — enable SSL for any remote database (Supabase, Railway, Neon, etc.)
      // SSL behavior:
      //   Local DB (localhost/127.0.0.1) → SSL disabled
      //   Remote DB → SSL enabled, with auto-detection of certificate verification:
      //     • Set DB_SSL_REJECT_UNAUTHORIZED=true/false to override manually
      //     • Cloud providers (Supabase, Neon, Railway) default to rejectUnauthorized=false
      //     • If SSL verification fails at connect time, auto-retries with rejectUnauthorized=false
      const dbUrl = process.env.DATABASE_URL;
      const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
      const sslEnabled = !isLocalDb;
      
      // Determine SSL certificate verification:
      // 1. Explicit env var override takes priority
      // 2. If DATABASE_URL contains sslmode=no-verify or sslmode=require, disable verification
      // 3. Cloud providers (Supabase, Neon, Railway) commonly use poolers with
      //    certificates not in the default trust store, so default to false for remote DBs
      const urlDisablesVerify = dbUrl.includes('sslmode=no-verify') ||
                                dbUrl.includes('sslmode=require') ||
                                dbUrl.includes('sslmode=prefer') ||
                                dbUrl.includes('supabase.com') ||
                                dbUrl.includes('neon.tech') ||
                                dbUrl.includes('railway.app');
      const envSslSetting = process.env.DB_SSL_REJECT_UNAUTHORIZED;
      const rejectUnauthorized = envSslSetting !== undefined
        ? envSslSetting === 'true'
        : !urlDisablesVerify;
      logger.info(`[Database] SSL mode: ${sslEnabled ? `ENABLED (verify=${rejectUnauthorized})` : 'DISABLED (local)'}`);
      
      _client = postgres(process.env.DATABASE_URL, {
        ssl: sslEnabled ? { rejectUnauthorized } : false,
        idle_timeout: 30, // 30 seconds
        max_lifetime: 60 * 60, // 1 hour
        connect_timeout: 10, // 10 seconds
      });

      // Test connection with timeout
      let connectionTestPassed = false;
      try {
        await Promise.race([
          _client`SELECT 1`,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Connection test timeout (15s)")), 15000)
          )
        ]);
        connectionTestPassed = true;
      } catch (testError) {
        const testErrorMsg = testError instanceof Error ? testError.message : String(testError);
        
        // If SSL verification failed, automatically retry without verification
        if (testErrorMsg.includes('self-signed') || testErrorMsg.includes('certificate') || testErrorMsg.includes('SSL')) {
          logger.warn(`[Database] SSL verification failed, retrying with rejectUnauthorized=false...`);
          try {
            // Close the broken client
            await _client.end({ timeout: 3 }).catch(() => {});
          } catch { /* ignore close errors */ }
          
          _client = postgres(process.env.DATABASE_URL, {
            ssl: sslEnabled ? { rejectUnauthorized: false } : false,
            idle_timeout: 30,
            max_lifetime: 60 * 60,
            connect_timeout: 10,
          });
          
          try {
            await _client`SELECT 1`;
            connectionTestPassed = true;
            logger.info(`[Database] SSL retry successful with rejectUnauthorized=false`);
          } catch (retryError) {
            const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
            logger.warn(`[Database] Connection test failed after SSL retry: ${retryMsg} (server will continue)`);
          }
        } else {
          logger.warn(`[Database] Connection test failed: ${testErrorMsg} (server will continue)`);
        }
      }
      
      _db = drizzle(_client);
      _lastError = null;
      
      const uptime = new Date().getTime() - _connectionStartTime.getTime();
      logger.info(`[Database] ✅ Successfully connected to database (${uptime}ms)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      _lastError = errorMsg;
      logger.error("[Database] ❌ Failed to connect:", errorMsg);
      
      // Log detailed error info for debugging
      if (errorMsg.includes('SSL')) {
        logger.error("[Database] Tip: SSL error detected. Check your DATABASE_URL format.");
      } else if (errorMsg.includes('ECONNREFUSED')) {
        logger.error("[Database] Tip: Connection refused. Is the database server running?");
      } else if (errorMsg.includes('authentication')) {
        logger.error("[Database] Tip: Authentication failed. Check database credentials.");
      }
      
      _db = null;
      _client = null;
      _connectionStartTime = null;
    }
  }
  
  if (!process.env.DATABASE_URL) {
    logger.warn("[Database] DATABASE_URL not set - database operations will fail");
  }
  
  return _db;
}

/**
 * Get database connection status
 */
export async function getDbStatus() {
  const db = await getDb();
  return {
    connected: !!db,
    connectionTime: _connectionStartTime ? new Date().getTime() - _connectionStartTime.getTime() : null,
    lastError: _lastError,
    hasUrl: !!process.env.DATABASE_URL,
  };
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId || user.email === COMPANY_INFO.admin.email) {
      // Auto-assign admin role if openId matches OWNER_OPEN_ID or email is admin email
      values.role = 'admin';
      updateSet.role = 'admin';
      logger.info(`✅ [Database] Auto-promoted ${user.email || user.openId} to admin role`);
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // PostgreSQL: Use onConflictDoUpdate for upsert
    await db.insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.openId,
        set: updateSet,
      });
  } catch (error) {
    logger.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  try {
    const result = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0];
  } catch (error) {
    logger.error("[Database] Error in getUserByEmail:", error instanceof Error ? error.message : error);
    return undefined;
  }
}

export async function getUserByName(name: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  try {
    const result = await db.select()
      .from(users)
      .where(eq(users.name, name))
      .limit(1);

    return result[0];
  } catch (error) {
    logger.error("[Database] Error in getUserByName:", error instanceof Error ? error.message : error);
    return undefined;
  }
}

export async function createUser(email: string, fullName?: string) {
  const db = await getDb();
  if (!db) {
    logger.error("[Database] createUser: Database connection not available");
    throw new Error("Database connection not available");
  }

  try {
    // Check if user with this email already exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    if (existingUser.length > 0) {
      throw new Error(`User with email ${email} already exists`);
    }
    
    // Generate a unique openId for email-based auth (format: email_timestamp_random)
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const openId = `email_${timestamp}_${random}`;

    // Extract first and last name from full name
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
    }

    // Check if email is admin email - if so, assign admin role
    const userRole = email === COMPANY_INFO.admin.email ? "admin" : "user";

    const result = await db.insert(users).values({
      openId,
      email,
      name: fullName,
      firstName,
      lastName,
      loginMethod: "email",
      role: userRole,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }).returning();

    return result[0];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("[Database] createUser failed:", errorMessage);
    logger.error("[Database] Full error:", error);
    throw error;
  }
}

export async function getUserByEmailOrPhone(identifier: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  // Try to find by email first, then by phone number
  const result = await db.select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.phoneNumber, identifier)))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// Loan Application Queries
// ============================================

/**
 * Generate a unique tracking number in format: AL-YYYYMMDD-XXXXX
 * AL = AmeriLend prefix
 * YYYYMMDD = Application date
 * XXXXX = 5-character alphanumeric code
 */
function generateTrackingNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  // Generate 5-character alphanumeric code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `AL-${dateStr}-${code}`;
}

/**
 * Check if a user with the same DOB and SSN has an existing account or pending application
 * Returns the existing user/application info or null if none found
 */
export async function checkDuplicateAccount(dateOfBirth: string, ssn: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Hash the SSN for lookup (matches the hash stored during submission)
  const ssnHash = crypto.createHash('sha256').update(ssn).digest('hex');
  
  // Check for existing applications with same DOB and SSN hash
  // Fall back to plain SSN check for legacy records that haven't been migrated
  const existingApplications = await db.select()
    .from(loanApplications)
    .where(
      and(
        eq(loanApplications.dateOfBirth, dateOfBirth),
        or(
          eq(loanApplications.ssnHash, ssnHash),
          eq(loanApplications.ssn, ssn) // Legacy fallback for unencrypted records
        )
      )
    );
  
  if (existingApplications.length > 0) {
    const app = existingApplications[0];
    return {
      type: 'application',
      status: app.status,
      trackingNumber: app.trackingNumber,
      email: app.email,
      createdAt: app.createdAt,
      message: `An application with this DOB and SSN already exists with status: ${app.status}. Tracking Number: ${app.trackingNumber}`
    };
  }
  
  return null;
}

export async function createLoanApplication(data: InsertLoanApplication) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection not available - DATABASE_URL environment variable may not be configured");
    }
    
    // Check for duplicate accounts/applications
    const duplicate = await checkDuplicateAccount(data.dateOfBirth, data.ssn);
    if (duplicate) {
      throw new Error(`Duplicate account detected: ${duplicate.message}`);
    }
    
    // Use provided tracking number or generate new one
    let trackingNumber = data.trackingNumber || generateTrackingNumber();
    
    // Ensure uniqueness (retry if collision)
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const existing = await db.select()
        .from(loanApplications)
        .where(eq(loanApplications.trackingNumber, trackingNumber))
        .limit(1);
      
      if (existing.length === 0) {
        isUnique = true;
      } else {
        trackingNumber = generateTrackingNumber();
        attempts++;
      }
    }
    
    if (!isUnique) {
      throw new Error("Failed to generate unique tracking number after 10 attempts");
    }
    
    const result = await db.insert(loanApplications).values({
      ...data,
      trackingNumber,
    }).returning();
    
    // Send confirmation email asynchronously
    const insertedApplication = result[0];
    if (insertedApplication) {
      sendLoanApplicationReceivedEmail(
        insertedApplication.email,
        insertedApplication.fullName,
        insertedApplication.trackingNumber,
        insertedApplication.requestedAmount
      ).catch(err => logger.error('[Database] Failed to send application submitted email:', err));
    }
    
    return { ...result, trackingNumber };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error in createLoanApplication";
    logger.error("[Database] createLoanApplication error:", errorMsg);
    throw error; // Re-throw so caller can handle it
  }
}

export async function getLoanApplicationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(loanApplications).where(eq(loanApplications.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLoanApplicationsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(loanApplications).where(eq(loanApplications.userId, userId)).orderBy(desc(loanApplications.createdAt));
}

export async function getAllLoanApplications() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(loanApplications).orderBy(desc(loanApplications.createdAt));
}

export async function getLoanApplicationByTrackingNumber(trackingNumber: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(loanApplications)
    .where(sql`UPPER(${loanApplications.trackingNumber}) = UPPER(${trackingNumber})`)
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Atomically transition a loan application from one status to another.
 * Returns true if the transition succeeded (row was in expectedStatus), false otherwise.
 * Prevents race conditions in payment processing.
 */
export async function atomicStatusTransition(
  id: number,
  expectedStatus: string | string[],
  newStatus: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  const conditions = statuses.map(s => eq(loanApplications.status, s as any));

  // Use .returning() so we get the updated rows back — .length > 0 is the
  // most reliable way to know whether the WHERE matched, regardless of which
  // Postgres driver property exposes the affected-row count.
  const rows = await db.update(loanApplications)
    .set({ status: newStatus as any, updatedAt: new Date() })
    .where(and(eq(loanApplications.id, id), or(...conditions)))
    .returning({ id: loanApplications.id });
  
  return rows.length > 0;
}

export async function updateLoanApplicationStatus(
  id: number,
  status: LoanApplication["status"],
  additionalData?: Partial<LoanApplication> & { infoNeeded?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get application details before update for email notifications
  const application = await getLoanApplicationById(id);
  if (!application) throw new Error("Application not found");
  
  await db.update(loanApplications)
    .set({ status, ...additionalData, updatedAt: new Date() })
    .where(eq(loanApplications.id, id));
  
  // Send email notifications based on status change
  try {
    switch (status) {
      case "approved":
        if (additionalData?.approvedAmount && additionalData?.processingFeeAmount) {
          const { sendLoanApplicationApprovedEmail } = await import("./_core/email");
          await sendLoanApplicationApprovedEmail(
            application.email,
            application.fullName,
            application.trackingNumber,
            additionalData.approvedAmount,
            additionalData.processingFeeAmount
          );
          
          // Send SMS notification for loan approval
          try {
            const { sendLoanApprovedSMS } = await import("./_core/sms");
            await sendLoanApprovedSMS(
              application.phone,
              application.trackingNumber,
              additionalData.approvedAmount
            );
          } catch (smsError) {
            logger.error('Failed to send approval SMS:', smsError);
          }
        }
        break;
      
      case "rejected":
        const { sendLoanApplicationRejectedEmail } = await import("./_core/email");
        await sendLoanApplicationRejectedEmail(
          application.email,
          application.fullName,
          application.trackingNumber
        );
        break;
      
      case "fee_pending":
        if (additionalData?.processingFeeAmount) {
          const { sendLoanApplicationProcessingEmail } = await import("./_core/email");
          await sendLoanApplicationProcessingEmail(
            application.email,
            application.fullName,
            application.trackingNumber,
            additionalData.processingFeeAmount
          );
        }
        break;
      
      case "under_review":
        if (additionalData?.infoNeeded) {
          const { sendLoanApplicationMoreInfoEmail } = await import("./_core/email");
          await sendLoanApplicationMoreInfoEmail(
            application.email,
            application.fullName,
            application.trackingNumber,
            additionalData.infoNeeded
          );
        }
        break;
    }
  } catch (emailError) {
    logger.error('Failed to send status update email:', emailError);
  }
}

/**
 * Update loan application fields (for admin use)
 */
export async function updateLoanApplication(
  id: number,
  data: Partial<LoanApplication>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(loanApplications)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(loanApplications.id, id));
}

// ============================================
// Fee Configuration Queries
// ============================================

export async function getActiveFeeConfiguration() {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(feeConfiguration)
    .where(eq(feeConfiguration.isActive, true))
    .orderBy(desc(feeConfiguration.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function createFeeConfiguration(data: InsertFeeConfiguration) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Deactivate all existing configurations
  await db.update(feeConfiguration).set({ isActive: false });
  
  // Insert new active configuration
  const result = await db.insert(feeConfiguration).values({ ...data, isActive: true }).returning();
  return result;
}

export async function updateFeeConfiguration(id: number, data: Partial<FeeConfiguration>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(feeConfiguration)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(feeConfiguration.id, id));
}

// ============================================
// Payment Queries
// ============================================

export async function createPayment(data: InsertPayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(payments).values(data).returning();
  return result.length > 0 ? result[0] : null;
}

export async function getPaymentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPaymentsByLoanApplicationId(loanApplicationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(payments)
    .where(eq(payments.loanApplicationId, loanApplicationId))
    .orderBy(desc(payments.createdAt));
}

export async function getUserPayments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { payments, loanApplications } = await import("../drizzle/schema");
  
  // Get all payments for user's loan applications
  const result = await db.select({
    payment: payments,
    loan: loanApplications,
  })
    .from(payments)
    .leftJoin(loanApplications, eq(payments.loanApplicationId, loanApplications.id))
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt));
  
  return result.map((r) => ({
    ...r.payment,
    loanTrackingNumber: r.loan?.trackingNumber,
    loanAmount: r.loan?.approvedAmount,
  }));
}

export async function getAllPayments() {
  const db = await getDb();
  if (!db) return [];
  
  const { payments } = await import("../drizzle/schema");
  
  const result = await db.select()
    .from(payments)
    .orderBy(desc(payments.createdAt));
  
  return result;
}

export async function updatePaymentStatus(
  id: number,
  status: Payment["status"],
  additionalData?: Partial<Payment>,
  auditContext?: { userId?: number; ipAddress?: string; userAgent?: string; action?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get current payment to log status change
  const currentPayment = await getPaymentById(id);
  const oldStatus = currentPayment?.status;
  
  // Update payment status
  const result = await db.update(payments)
    .set({ status, ...additionalData, updatedAt: new Date() })
    .where(eq(payments.id, id))
    .returning();
  
  // Log to audit trail if status changed
  if (oldStatus && oldStatus !== status) {
    await logPaymentAudit(
      id,
      auditContext?.action || "payment_status_changed",
      oldStatus,
      status,
      { reason: additionalData?.failureReason || additionalData?.adminNotes },
      auditContext?.userId,
      auditContext?.ipAddress,
      auditContext?.userAgent
    ).catch(err => logger.warn("[Audit] Failed to log payment status change:", err));
  }
  
  return result;
}

// ============================================
// Disbursement Queries
// ============================================

export async function createDisbursement(data: InsertDisbursement) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(disbursements).values(data);
  return result;
}

export async function getDisbursementById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(disbursements).where(eq(disbursements.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDisbursementByLoanApplicationId(loanApplicationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(disbursements)
    .where(eq(disbursements.loanApplicationId, loanApplicationId))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function updateDisbursementStatus(
  id: number,
  status: Disbursement["status"],
  additionalData?: Partial<Disbursement>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(disbursements)
    .set({ status, ...additionalData, updatedAt: new Date() })
    .where(eq(disbursements.id, id));
}

export async function updateDisbursementTracking(
  id: number,
  trackingNumber: string,
  trackingCompany: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(disbursements)
    .set({ trackingNumber, trackingCompany, updatedAt: new Date() })
    .where(eq(disbursements.id, id));
}

// Payment Method Management
export async function getSavedPaymentMethods(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { savedPaymentMethods } = await import("../drizzle/schema");
  
  return db.select()
    .from(savedPaymentMethods)
    .where(eq(savedPaymentMethods.userId, userId))
    .orderBy(desc(savedPaymentMethods.createdAt));
}

export async function getSavedPaymentMethodById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const { savedPaymentMethods } = await import("../drizzle/schema");
  
  const result = await db.select()
    .from(savedPaymentMethods)
    .where(eq(savedPaymentMethods.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function addSavedPaymentMethod(userId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { savedPaymentMethods } = await import("../drizzle/schema");
  
  const result = await db.insert(savedPaymentMethods).values({
    userId,
    ...data,
    isDefault: false,
    createdAt: new Date(),
  }).returning();
  
  return result[0];
}

export async function deleteSavedPaymentMethod(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { savedPaymentMethods } = await import("../drizzle/schema");
  
  return db.delete(savedPaymentMethods).where(eq(savedPaymentMethods.id, id));
}

export async function setDefaultPaymentMethod(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { savedPaymentMethods } = await import("../drizzle/schema");
  
  // First, set all methods to non-default
  await db.update(savedPaymentMethods)
    .set({ isDefault: false })
    .where(eq(savedPaymentMethods.userId, userId));
  
  // Then set the selected method as default
  return db.update(savedPaymentMethods)
    .set({ isDefault: true })
    .where(eq(savedPaymentMethods.id, id));
}

export async function getAllDisbursements() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(disbursements)
    .orderBy(desc(disbursements.createdAt));
}

// ============================================
// Verification Documents Queries
// ============================================

export async function createVerificationDocument(data: InsertVerificationDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(verificationDocuments).values(data);
  return result;
}

export async function getVerificationDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(verificationDocuments)
    .where(eq(verificationDocuments.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function getVerificationDocumentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(verificationDocuments)
    .where(eq(verificationDocuments.userId, userId))
    .orderBy(desc(verificationDocuments.createdAt));
}

export async function getAllVerificationDocuments() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(verificationDocuments)
    .orderBy(desc(verificationDocuments.createdAt));
}

export async function updateVerificationDocumentStatus(
  id: number,
  status: VerificationDocument["status"],
  reviewedBy: number,
  additionalData?: Partial<VerificationDocument>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(verificationDocuments)
    .set({ 
      status, 
      reviewedBy,
      reviewedAt: new Date(),
      ...additionalData, 
      updatedAt: new Date() 
    })
    .where(eq(verificationDocuments.id, id));
}

export async function deleteVerificationDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.delete(verificationDocuments)
    .where(eq(verificationDocuments.id, id));
}

// Admin user management functions
export async function promoteUserToAdmin(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function demoteAdminToUser(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ role: "user", updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getAllAdmins() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(users)
    .where(eq(users.role, "admin"))
    .orderBy(desc(users.createdAt));
}

export async function getAdminStats() {
  const db = await getDb();
  if (!db) {
    return {
      totalAdmins: 0,
      totalUsers: 0,
      totalApplications: 0,
      pendingApplications: 0,
      approvedApplications: 0,
      rejectedApplications: 0,
    };
  }

  const admins = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.role, "admin"));
  const allUsers = await db.select({ count: sql`count(*)` }).from(users);
  const apps = await db.select({ count: sql`count(*)` }).from(loanApplications);
  const pending = await db.select({ count: sql`count(*)` }).from(loanApplications).where(eq(loanApplications.status, "pending"));
  const approved = await db.select({ count: sql`count(*)` }).from(loanApplications).where(eq(loanApplications.status, "approved"));
  const rejected = await db.select({ count: sql`count(*)` }).from(loanApplications).where(eq(loanApplications.status, "rejected"));

  return {
    totalAdmins: Number(admins[0]?.count || 0),
    totalUsers: Number(allUsers[0]?.count || 0),
    totalApplications: Number(apps[0]?.count || 0),
    pendingApplications: Number(pending[0]?.count || 0),
    approvedApplications: Number(approved[0]?.count || 0),
    rejectedApplications: Number(rejected[0]?.count || 0),
  };
}

// User management functions for admins
export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  return db.select().from(users).where(eq(users.id, userId)).then(rows => rows[0] || null);
}

export async function searchUsers(query: string, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  
  const searchTerm = `%${query.toLowerCase()}%`;
  return db.select()
    .from(users)
    .where(
      or(
        sql`LOWER(${users.name}) LIKE ${searchTerm}`,
        sql`LOWER(${users.email}) LIKE ${searchTerm}`
      )
    )
    .limit(limit);
}

export async function updateUserProfile(userId: number, updates: { name?: string; email?: string; phone?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = { updatedAt: new Date() };
  if (updates.name !== undefined) updateData.name = updates.name || null;
  if (updates.email !== undefined) updateData.email = updates.email || null;
  
  await db.update(users)
    .set(updateData)
    .where(eq(users.id, userId));
}

export async function getAdvancedStats() {
  const db = await getDb();
  if (!db) {
    return {
      totalAdmins: 0,
      totalUsers: 0,
      totalApplications: 0,
      pendingApplications: 0,
      approvedApplications: 0,
      rejectedApplications: 0,
      totalApprovedAmount: 0,
      averageLoanAmount: 0,
      approvalRate: 0,
      avgProcessingTime: 0,
    };
  }

  const admins = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.role, "admin"));
  const allUsers = await db.select({ count: sql`count(*)` }).from(users);
  const apps = await db.select({ count: sql`count(*)` }).from(loanApplications);
  const pending = await db.select({ count: sql`count(*)` }).from(loanApplications).where(eq(loanApplications.status, "pending"));
  const approved = await db.select({ count: sql`count(*)` }).from(loanApplications).where(eq(loanApplications.status, "approved"));
  const rejected = await db.select({ count: sql`count(*)` }).from(loanApplications).where(eq(loanApplications.status, "rejected"));
  
  // Get total approved amounts
  const totalApprovedResult = await db.select({ total: sql`SUM(${loanApplications.approvedAmount})` })
    .from(loanApplications)
    .where(eq(loanApplications.status, "approved"));
  
  const totalApprovedAmount = totalApprovedResult[0]?.total ? Number(totalApprovedResult[0].total) : 0;
  
  // Get average loan amount (from approved amounts only)
  const avgAmountResult = await db.select({ avg: sql`AVG(${loanApplications.approvedAmount})` })
    .from(loanApplications)
    .where(eq(loanApplications.status, "approved"));
  
  const averageLoanAmount = avgAmountResult[0]?.avg ? Number(avgAmountResult[0].avg) : 0;
  
  const totalApps = Number(apps[0]?.count || 0);
  const approvedApps = Number(approved[0]?.count || 0);
  const approvalRate = totalApps > 0 ? (approvedApps / totalApps) * 100 : 0;
  
  // Calculate average processing time from approved applications
  let avgProcessingTime = 0;
  try {
    const processingTimeResult = await db.select({
      avgHours: sql<number>`AVG(EXTRACT(EPOCH FROM (${loanApplications.updatedAt} - ${loanApplications.createdAt})) / 3600)`
    })
      .from(loanApplications)
      .where(eq(loanApplications.status, "approved"));
    avgProcessingTime = Math.round(processingTimeResult[0]?.avgHours || 24);
  } catch {
    avgProcessingTime = 24;
  }
  
  return {
    totalAdmins: Number(admins[0]?.count || 0),
    totalUsers: Number(allUsers[0]?.count || 0),
    totalApplications: totalApps,
    pendingApplications: Number(pending[0]?.count || 0),
    approvedApplications: approvedApps,
    rejectedApplications: Number(rejected[0]?.count || 0),
    totalApprovedAmount,
    averageLoanAmount,
    approvalRate: Math.round(approvalRate * 100) / 100,
    avgProcessingTime,
  };
}

// ============= Account Management Functions =============

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateUserEmail(userId: number, email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ email, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateUserBankInfo(userId: number, data: {
  bankAccountHolderName: string;
  bankAccountNumber: string;
  bankRoutingNumber: string;
  bankAccountType: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Encrypt sensitive bank data
  const encryptedAccountNumber = encryptBankData(data.bankAccountNumber);
  const encryptedRoutingNumber = encryptBankData(data.bankRoutingNumber);
  
  await db.update(users)
    .set({ 
      bankAccountHolderName: data.bankAccountHolderName,
      bankAccountNumber: encryptedAccountNumber,
      bankRoutingNumber: encryptedRoutingNumber,
      bankAccountType: data.bankAccountType,
      updatedAt: new Date() 
    })
    .where(eq(users.id, userId));
}

export async function logAccountActivity(data: {
  userId: number;
  activityType: 'password_changed' | 'email_changed' | 'bank_info_updated' | 'profile_updated' | 'document_uploaded' | 'login_attempt' | 'suspicious_activity' | 'settings_changed';
  description: string;
  ipAddress?: string;
  userAgent?: string;
  suspicious?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { accountActivity } = await import("../drizzle/schema");
  
  await db.insert(accountActivity).values({
    userId: data.userId,
    activityType: data.activityType,
    description: data.description,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    suspicious: data.suspicious || false,
  });
}

export async function getAccountActivity(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { accountActivity } = await import("../drizzle/schema");
  
  const activities = await db.select()
    .from(accountActivity)
    .where(eq(accountActivity.userId, userId))
    .orderBy(desc(accountActivity.createdAt))
    .limit(limit);
  
  return activities;
}

export async function getUserBankInfo(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const user = await db.select({
    bankAccountHolderName: users.bankAccountHolderName,
    bankAccountNumber: users.bankAccountNumber,
    bankRoutingNumber: users.bankRoutingNumber,
    bankAccountType: users.bankAccountType,
  })
    .from(users)
    .where(eq(users.id, userId));
  
  if (!user.length || !user[0].bankAccountNumber) {
    return null;
  }
  
  // Decrypt sensitive bank data
  try {
    return {
      bankAccountHolderName: user[0].bankAccountHolderName,
      bankAccountNumber: decryptBankData(user[0].bankAccountNumber || ''),
      bankRoutingNumber: decryptBankData(user[0].bankRoutingNumber || ''),
      bankAccountType: user[0].bankAccountType,
    };
  } catch (error) {
    logger.error('Failed to decrypt bank data:', error);
    return null;
  }
}

// ============= Notification Preferences =============

export async function setNotificationPreference(userId: number, preferenceType: string, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { notificationPreferences } = await import("../drizzle/schema");
  
  await db.delete(notificationPreferences)
    .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.preferenceType, preferenceType as any)));
  
  if (enabled) {
    await db.insert(notificationPreferences).values({
      userId,
      preferenceType: preferenceType as any,
      enabled: true,
    });
  }
}

export async function getNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { notificationPreferences } = await import("../drizzle/schema");
  
  const prefs = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  
  return prefs;
}

// ============= Email Verification =============

export async function createEmailVerificationToken(userId: number, newEmail: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { emailVerificationTokens } = await import("../drizzle/schema");
  const crypto = await import("crypto");
  
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  await db.insert(emailVerificationTokens).values({
    userId,
    token,
    newEmail,
    expiresAt,
    verified: false,
  });
  
  return token;
}

export async function verifyEmailToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { emailVerificationTokens } = await import("../drizzle/schema");
  
  const tokenRecord = await db.select()
    .from(emailVerificationTokens)
    .where(and(eq(emailVerificationTokens.token, token), eq(emailVerificationTokens.verified, false)))
    .limit(1);
  
  if (!tokenRecord.length) return null;
  
  const record = tokenRecord[0];
  
  // Check if expired
  if (new Date() > record.expiresAt) {
    return null;
  }
  
  // Mark as verified
  await db.update(emailVerificationTokens)
    .set({ verified: true })
    .where(eq(emailVerificationTokens.id, record.id));
  
  return record;
}

// ============= Session Management =============

export async function createUserSession(userId: number, sessionToken: string, ipAddress?: string, userAgent?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userSessions } = await import("../drizzle/schema");
  
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  await db.insert(userSessions).values({
    userId,
    sessionToken,
    ipAddress,
    userAgent,
    expiresAt,
  });
}

export async function getUserSessions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userSessions } = await import("../drizzle/schema");
  
  return await db.select()
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), sql`${userSessions.expiresAt} > NOW()`))
    .orderBy(desc(userSessions.lastActivityAt));
}

export async function deleteUserSession(sessionToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userSessions } = await import("../drizzle/schema");
  
  await db.delete(userSessions).where(eq(userSessions.sessionToken, sessionToken));
}

// ============= Login Attempt Tracking =============

export async function recordLoginAttempt(email: string, ipAddress: string, successful: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { loginAttempts } = await import("../drizzle/schema");
  
  await db.insert(loginAttempts).values({
    email,
    ipAddress,
    successful,
  });
}

export async function checkLoginAttempts(email: string, ipAddress: string, windowMinutes: number = 15) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { loginAttempts } = await import("../drizzle/schema");
  
  const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);
  
  const attempts = await db.select()
    .from(loginAttempts)
    .where(and(
      eq(loginAttempts.email, email),
      eq(loginAttempts.ipAddress, ipAddress),
      eq(loginAttempts.successful, false),
      sql`${loginAttempts.createdAt} > ${cutoffTime}`
    ));
  
  return attempts.length;
}

// ============= User Profile Management =============

export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userProfiles } = await import("../drizzle/schema");
  
  const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
  return profile[0] || null;
}

// ============= Two-Factor Authentication =============

export async function get2FASettings(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { twoFactorAuthentication } = await import("../drizzle/schema");
  
  const settings = await db.select()
    .from(twoFactorAuthentication)
    .where(eq(twoFactorAuthentication.userId, userId));
  
  return settings[0] || null;
}

// ============= Trusted Devices =============

export async function getTrustedDevices(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { trustedDevices } = await import("../drizzle/schema");
  
  return await db.select()
    .from(trustedDevices)
    .where(eq(trustedDevices.userId, userId));
}

export async function addTrustedDevice(userId: number, data: {
  deviceName: string;
  deviceFingerprint: string;
  userAgent?: string;
  ipAddress?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { trustedDevices } = await import("../drizzle/schema");
  
  await db.insert(trustedDevices).values({
    userId,
    ...data,
  });
}

export async function removeTrustedDevice(deviceId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { trustedDevices } = await import("../drizzle/schema");
  
  await db.delete(trustedDevices)
    .where(and(
      eq(trustedDevices.id, deviceId),
      eq(trustedDevices.userId, userId)
    ));
}

// ============================================
// Payment Idempotency Queries
// ============================================

export async function getPaymentByIdempotencyKey(idempotencyKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const { paymentIdempotencyLog } = await import("../drizzle/schema");
  
  const result = await db.select()
    .from(paymentIdempotencyLog)
    .where(eq(paymentIdempotencyLog.idempotencyKey, idempotencyKey))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function storeIdempotencyResult(
  idempotencyKey: string,
  paymentId: number,
  responseData: any,
  status: "success" | "failed"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { paymentIdempotencyLog } = await import("../drizzle/schema");
  
  await db.insert(paymentIdempotencyLog).values({
    idempotencyKey,
    paymentId,
    responseData: JSON.stringify(responseData),
    status,
  });
}

// ============================================
// Payment Audit Trail Queries
// ============================================

export async function logPaymentAudit(
  paymentId: number,
  action: string,
  oldStatus?: string,
  newStatus?: string,
  metadata?: any,
  userId?: number,
  ipAddress?: string,
  userAgent?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { paymentAuditLog } = await import("../drizzle/schema");
  
  await db.insert(paymentAuditLog).values({
    paymentId,
    action,
    oldStatus: oldStatus as any,
    newStatus: newStatus as any,
    metadata: JSON.stringify(metadata),
    userId,
    ipAddress,
    userAgent,
  });
}

export async function getPaymentAuditLog(paymentId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { paymentAuditLog } = await import("../drizzle/schema");
  
  return db.select()
    .from(paymentAuditLog)
    .where(eq(paymentAuditLog.paymentId, paymentId))
    .orderBy(desc(paymentAuditLog.createdAt));
}

/**
 * Update user fields by openId (used during signup to add password)
 */
export async function updateUserByOpenId(openId: string, data: Partial<{ passwordHash: string; loginMethod: string; name: string; email: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
  if (data.loginMethod !== undefined) updateData.loginMethod = data.loginMethod;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  
  return db.update(users)
    .set(updateData)
    .where(eq(users.openId, openId));
}

// ============================================
// Admin Activity Log Queries
// ============================================

export async function logAdminActivity(data: InsertAdminActivityLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(adminActivityLog).values(data);
}

export async function getAdminActivityLog(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(adminActivityLog)
    .orderBy(desc(adminActivityLog.createdAt))
    .limit(limit);
}

export async function searchLoanApplications(searchTerm: string, status?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  const searchLower = `%${searchTerm.toLowerCase()}%`;
  
  // Search by email, phone, name, or tracking number
  conditions.push(
    or(
      ilike(loanApplications.email, searchLower),
      ilike(loanApplications.phone, searchLower),
      ilike(loanApplications.fullName, searchLower),
      ilike(loanApplications.trackingNumber, searchLower)
    )
  );
  
  if (status) {
    conditions.push(eq(loanApplications.status, status as any));
  }
  
  return db.select()
    .from(loanApplications)
    .where(and(...conditions))
    .orderBy(desc(loanApplications.createdAt));
}

// ============================================
// PHASE 1: DEVICE & SESSION MANAGEMENT
// ============================================

export async function createUserDevice(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userDevices } = await import("../drizzle/schema");
  return db.insert(userDevices).values(data);
}

export async function getUserDevices(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { userDevices } = await import("../drizzle/schema");
  return db.select().from(userDevices).where(eq(userDevices.userId, userId));
}



// 2FA Functions
export async function enableTwoFactor(userId: number, method: string, secret?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userTwoFactorAuth } = await import("../drizzle/schema");
  
  const existing = await db.select().from(userTwoFactorAuth).where(eq(userTwoFactorAuth.userId, userId)).limit(1);
  
  if (existing.length > 0) {
    return db.update(userTwoFactorAuth)
      .set({ method: method as any, isEnabled: true, secret, verifiedAt: new Date() })
      .where(eq(userTwoFactorAuth.userId, userId));
  }
  
  return db.insert(userTwoFactorAuth).values({
    userId,
    method: method as any,
    isEnabled: true,
    secret,
    verifiedAt: new Date(),
  });
}

export async function disableTwoFactor(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userTwoFactorAuth } = await import("../drizzle/schema");
  return db.update(userTwoFactorAuth)
    .set({ isEnabled: false, verifiedAt: null })
    .where(eq(userTwoFactorAuth.userId, userId));
}

// ============================================
// PHASE 2: USER PROFILE & PREFERENCES
// ============================================

export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { userPreferences } = await import("../drizzle/schema");
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateUserPreferences(userId: number, prefs: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userPreferences } = await import("../drizzle/schema");
  
  const existing = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  
  if (existing.length > 0) {
    return await db.update(userPreferences).set(prefs).where(eq(userPreferences.userId, userId));
  }
  
  return await db.insert(userPreferences).values({
    userId,
    ...prefs,
  });
}

// Bank accounts
export async function addBankAccount(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { bankAccounts } = await import("../drizzle/schema");
  return db.insert(bankAccounts).values(data);
}

export async function getUserBankAccounts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { bankAccounts } = await import("../drizzle/schema");
  return db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId));
}

export async function removeBankAccount(accountId: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { bankAccounts } = await import("../drizzle/schema");
  if (userId) {
    return db.delete(bankAccounts).where(and(eq(bankAccounts.id, accountId), eq(bankAccounts.userId, userId)));
  }
  return db.delete(bankAccounts).where(eq(bankAccounts.id, accountId));
}

// User addresses
export async function createAddress(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userAddresses } = await import("../drizzle/schema");
  const result = await db.insert(userAddresses).values(data).returning();
  return result[0];
}

export async function getUserAddresses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { userAddresses } = await import("../drizzle/schema");
  return db.select().from(userAddresses).where(eq(userAddresses.userId, userId));
}

export async function updateAddress(addressId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userAddresses } = await import("../drizzle/schema");
  return db.update(userAddresses).set(data).where(eq(userAddresses.id, addressId));
}

export async function deleteAddress(addressId: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userAddresses } = await import("../drizzle/schema");
  if (userId) {
    return db.delete(userAddresses).where(and(eq(userAddresses.id, addressId), eq(userAddresses.userId, userId)));
  }
  return db.delete(userAddresses).where(eq(userAddresses.id, addressId));
}

// ============================================
// PHASE 3: KYC/IDENTITY VERIFICATION
// ============================================

export async function getKycVerification(userId: number): Promise<KycVerification | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateKycVerification(
  userId: number,
  data: Partial<Omit<InsertKycVerification, 'userId'>>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getKycVerification(userId);
  
  if (existing) {
    return db.update(kycVerification).set({ ...data, updatedAt: new Date() }).where(eq(kycVerification.userId, userId));
  }
  
  return db.insert(kycVerification).values({
    userId,
    ...data,
  });
}

export async function uploadDocument(data: InsertUploadedDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(uploadedDocuments).values(data);
}

export async function getUserDocuments(userId: number): Promise<UploadedDocument[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(uploadedDocuments).where(eq(uploadedDocuments.userId, userId)).orderBy(desc(uploadedDocuments.createdAt));
}

/**
 * Get all KYC verifications that are expiring within the given number of days.
 */
export async function getExpiringKycVerifications(withinDays: number): Promise<KycVerification[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  return db.select().from(kycVerification)
    .where(
      and(
        eq(kycVerification.status, 'approved'),
        gt(kycVerification.expiresAt, now),
        sql`${kycVerification.expiresAt} <= ${futureDate}`
      )
    );
}

/**
 * Get all KYC verifications that have expired (expiresAt < now and still marked approved).
 */
export async function getExpiredKycVerifications(): Promise<KycVerification[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();

  return db.select().from(kycVerification)
    .where(
      and(
        eq(kycVerification.status, 'approved'),
        sql`${kycVerification.expiresAt} IS NOT NULL AND ${kycVerification.expiresAt} <= ${now}`
      )
    );
}

// ============================================
// PHASE 4 & 5: LOAN OFFERS
// ============================================

export async function createLoanOffer(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { loanOffers } = await import("../drizzle/schema");
  return db.insert(loanOffers).values(data);
}

export async function getUserLoanOffers(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { loanOffers } = await import("../drizzle/schema");
  return db.select().from(loanOffers)
    .where(eq(loanOffers.userId, userId))
    .orderBy(desc(loanOffers.createdAt));
}

export async function acceptLoanOffer(offerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { loanOffers } = await import("../drizzle/schema");
  return db.update(loanOffers).set({ acceptedAt: new Date() }).where(eq(loanOffers.id, offerId));
}

// ============================================
// PHASE 6: LOAN REPAYMENT & PAYMENTS
// ============================================

export async function createPaymentSchedule(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { paymentSchedules } = await import("../drizzle/schema");
  return db.insert(paymentSchedules).values(data);
}

export async function getPaymentSchedule(loanApplicationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { paymentSchedules } = await import("../drizzle/schema");
  return db.select().from(paymentSchedules)
    .where(eq(paymentSchedules.loanApplicationId, loanApplicationId))
    .orderBy((t) => t.installmentNumber);
}

export async function updatePaymentScheduleStatus(scheduleId: number, status: string, paidAt?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { paymentSchedules } = await import("../drizzle/schema");
  return db.update(paymentSchedules)
    .set({ status, paidAt: paidAt || null })
    .where(eq(paymentSchedules.id, scheduleId));
}

// Autopay settings
export async function getAutopaySettings(loanApplicationId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { autopaySettings } = await import("../drizzle/schema");
  const result = await db.select().from(autopaySettings)
    .where(eq(autopaySettings.loanApplicationId, loanApplicationId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateAutopaySettings(loanApplicationId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { autopaySettings } = await import("../drizzle/schema");
  
  const existing = await getAutopaySettings(loanApplicationId);
  
  if (existing) {
    return db.update(autopaySettings).set(data).where(eq(autopaySettings.loanApplicationId, loanApplicationId));
  }
  
  return db.insert(autopaySettings).values({
    loanApplicationId,
    ...data,
  });
}

// ============================================
// PHASE 7: DELINQUENCY & COLLECTIONS
// ============================================

export async function getDelinquencyRecord(loanApplicationId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { delinquencyRecords } = await import("../drizzle/schema");
  const result = await db.select().from(delinquencyRecords)
    .where(eq(delinquencyRecords.loanApplicationId, loanApplicationId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============================================
// PHASE 9: NOTIFICATIONS & SUPPORT
// ============================================

export async function createNotification(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userNotifications } = await import("../drizzle/schema");
  return db.insert(userNotifications).values(data);
}

export async function getUserNotifications(userId: number, limitCount?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { userNotifications } = await import("../drizzle/schema");
  const query = db.select().from(userNotifications)
    .where(eq(userNotifications.userId, userId))
    .orderBy(desc(userNotifications.createdAt));
  
  if (limitCount) {
    return query.limit(limitCount);
  }
  
  return query;
}

export async function markNotificationAsRead(notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userNotifications } = await import("../drizzle/schema");
  return db.update(userNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(userNotifications.id, notificationId));
}

// ============================================
// PHASE 10: REFERRAL & REWARDS
// ============================================

export async function createReferral(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { referralProgram } = await import("../drizzle/schema");
  return db.insert(referralProgram).values(data);
}

export async function getUserReferrals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { referralProgram } = await import("../drizzle/schema");
  return db.select().from(referralProgram)
    .where(eq(referralProgram.referrerId, userId))
    .orderBy(desc(referralProgram.createdAt));
}

// ============================================
// REFERRAL PROGRAM FUNCTIONS
// ============================================

/**
 * Create or get referral code for user
 */
export async function getOrCreateReferralCode(userId: number, baseUrl?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { referralProgram } = await import("../drizzle/schema");
  const { generateReferralCode, createReferralLink, calculateExpirationDate } = await import("./_core/referrals");
  
  // Check if user already has active referral code
  const existing = await db.select().from(referralProgram)
    .where(eq(referralProgram.referrerId, userId))
    .limit(1);
  
  if (existing.length > 0 && existing[0].status === "pending") {
    return existing[0];
  }
  
  // Generate new referral code
  const referralCode = generateReferralCode();
  const referralLink = createReferralLink(referralCode, baseUrl);
  const expiresAt = calculateExpirationDate();
  
  const [newReferral] = await db.insert(referralProgram).values({
    referrerId: userId,
    referralCode,
    referralLink,
    status: "pending",
    expiresAt,
  }).returning();
  
  return newReferral;
}

/**
 * Find referral by code
 */
export async function getReferralByCode(referralCode: string) {
  const db = await getDb();
  if (!db) return null;
  
  const { referralProgram } = await import("../drizzle/schema");
  const result = await db.select().from(referralProgram)
    .where(eq(referralProgram.referralCode, referralCode))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Link referred user to referral
 */
export async function linkReferredUser(referralId: number, referredUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { referralProgram } = await import("../drizzle/schema");
  
  await db.update(referralProgram).set({
    referredUserId,
  }).where(eq(referralProgram.id, referralId));
}

/**
 * Complete referral and distribute rewards
 */
export async function completeReferral(referralId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { referralProgram } = await import("../drizzle/schema");
  const { REFERRAL_CONFIG } = await import("./_core/referrals");
  
  // Get referral details
  const [referral] = await db.select().from(referralProgram)
    .where(eq(referralProgram.id, referralId))
    .limit(1);
  
  if (!referral || referral.status !== "pending") {
    return;
  }
  
  // Update referral status
  await db.update(referralProgram).set({
    status: "completed",
    completedAt: new Date(),
    referrerBonus: REFERRAL_CONFIG.REFERRER_BONUS,
    referredBonus: REFERRAL_CONFIG.REFERRED_BONUS,
    bonusType: REFERRAL_CONFIG.BONUS_TYPE,
  }).where(eq(referralProgram.id, referralId));
  
  // Add rewards to both users
  await updateRewardsBalance(referral.referrerId, REFERRAL_CONFIG.REFERRER_BONUS, 0);
  if (referral.referredUserId) {
    await updateRewardsBalance(referral.referredUserId, REFERRAL_CONFIG.REFERRED_BONUS, 0);
  }
}

/**
 * Get all referrals by referrer
 */
export async function getReferralsByReferrer(referrerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { referralProgram, users } = await import("../drizzle/schema");
  
  const referrals = await db.select({
    id: referralProgram.id,
    referralCode: referralProgram.referralCode,
    referralLink: referralProgram.referralLink,
    status: referralProgram.status,
    referrerBonus: referralProgram.referrerBonus,
    referredBonus: referralProgram.referredBonus,
    createdAt: referralProgram.createdAt,
    completedAt: referralProgram.completedAt,
    expiresAt: referralProgram.expiresAt,
    referredUserId: referralProgram.referredUserId,
    referredUserName: users.name,
    referredUserEmail: users.email,
  })
  .from(referralProgram)
  .leftJoin(users, eq(referralProgram.referredUserId, users.id))
  .where(eq(referralProgram.referrerId, referrerId));
  
  return referrals;
}

/**
 * Get referral statistics for user
 */
export async function getReferralStats(userId: number) {
  const db = await getDb();
  if (!db) return {
    totalReferrals: 0,
    completedReferrals: 0,
    pendingReferrals: 0,
    totalEarned: 0,
  };
  
  const { referralProgram } = await import("../drizzle/schema");
  
  const allReferrals = await db.select().from(referralProgram)
    .where(eq(referralProgram.referrerId, userId));
  
  const completed = allReferrals.filter(r => r.status === "completed");
  const pending = allReferrals.filter(r => r.status === "pending");
  const totalEarned = completed.reduce((sum, r) => sum + (r.referrerBonus || 0), 0);
  
  return {
    totalReferrals: allReferrals.length,
    completedReferrals: completed.length,
    pendingReferrals: pending.length,
    totalEarned,
  };
}

export async function getUserRewardsBalance(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { userRewardsBalance } = await import("../drizzle/schema");
  const result = await db.select().from(userRewardsBalance)
    .where(eq(userRewardsBalance.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateRewardsBalance(userId: number, creditAmount: number, redeemed: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userRewardsBalance } = await import("../drizzle/schema");
  
  const existing = await getUserRewardsBalance(userId);
  
  if (existing) {
    return db.update(userRewardsBalance).set({
      creditBalance: existing.creditBalance + creditAmount,
      totalEarned: existing.totalEarned + creditAmount,
      totalRedeemed: existing.totalRedeemed + redeemed,
    }).where(eq(userRewardsBalance.userId, userId));
  }
  
    return db.insert(userRewardsBalance).values({
    userId,
    creditBalance: creditAmount,
    totalEarned: creditAmount,
    totalRedeemed: redeemed,
  });
}

// ============================================
// PHASE 4: PAYMENT NOTIFICATION QUERIES
// ============================================

/**
 * Get payments coming due within N days
 */
export async function getUpcomingPayments(daysAhead: number = 7) {
  const db = await getDb();
  if (!db) return [];
  
  const { paymentSchedules, loanApplications, users } = await import("../drizzle/schema");
  
  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);
    
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];
    
    const result = await db.select({
      id: paymentSchedules.id,
      loanApplicationId: paymentSchedules.loanApplicationId,
      installmentNumber: paymentSchedules.installmentNumber,
      dueDate: paymentSchedules.dueDate,
      amount: paymentSchedules.dueAmount,
      status: paymentSchedules.status,
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      phoneNumber: users.phoneNumber,
      loanNumber: loanApplications.trackingNumber,
    })
      .from(paymentSchedules)
      .innerJoin(loanApplications, eq(paymentSchedules.loanApplicationId, loanApplications.id))
      .innerJoin(users, eq(loanApplications.userId, users.id))
      .where(
        and(
          or(
            eq(paymentSchedules.status, "pending"),
            eq(paymentSchedules.status, "not_paid")
          ),
          sql`DATE(${paymentSchedules.dueDate}) BETWEEN ${todayStr} AND ${futureStr}`
        )
      );
    
    return result;
  } catch (error) {
    logger.error("[db.getUpcomingPayments] Error:", error);
    return [];
  }
}

/**
 * Get payments due in N days (e.g., 7 days)
 * Used for payment reminder notifications
 */
export async function getPaymentsDueReminder(daysFromNow: number = 7) {
  const db = await getDb();
  if (!db) return [];
  
  const { paymentSchedules, loanApplications, users } = await import("../drizzle/schema");
  
  try {
    // Calculate target date (today + daysFromNow)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysFromNow);
    const targetDateStr = targetDate.toISOString().split('T')[0];
    const nextDayStr = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const result = await db.select({
      paymentId: paymentSchedules.id,
      loanApplicationId: paymentSchedules.loanApplicationId,
      installmentNumber: paymentSchedules.installmentNumber,
      dueDate: paymentSchedules.dueDate,
      dueAmount: paymentSchedules.dueAmount,
      principalAmount: paymentSchedules.principalAmount,
      interestAmount: paymentSchedules.interestAmount,
      status: paymentSchedules.status,
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneNumber: users.phoneNumber,
      trackingNumber: loanApplications.trackingNumber,
      loanStatus: loanApplications.status,
    })
      .from(paymentSchedules)
      .innerJoin(loanApplications, eq(paymentSchedules.loanApplicationId, loanApplications.id))
      .innerJoin(users, eq(loanApplications.userId, users.id))
      .where(
        and(
          or(
            eq(paymentSchedules.status, "pending"),
            eq(paymentSchedules.status, "not_paid"),
            eq(paymentSchedules.status, "late")
          ),
          and(
            sql`DATE(${paymentSchedules.dueDate}) >= ${targetDateStr}`
          ),
          and(
            sql`DATE(${paymentSchedules.dueDate}) < ${nextDayStr}`
          )
        )
      );
    
    return result;
  } catch (error) {
    logger.error("[db.getPaymentsDueReminder] Error:", error);
    return [];
  }
}

/**
 * Get overdue payments (X to Y days)
 * Used for overdue alert notifications (1-29 days)
 */
export async function getOverduePayments(minDays: number = 1, maxDays: number = 29) {
  const db = await getDb();
  if (!db) return [];
  
  const { paymentSchedules, loanApplications, users } = await import("../drizzle/schema");
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await db.select({
      paymentId: paymentSchedules.id,
      loanApplicationId: paymentSchedules.loanApplicationId,
      installmentNumber: paymentSchedules.installmentNumber,
      dueDate: paymentSchedules.dueDate,
      dueAmount: paymentSchedules.dueAmount,
      principalAmount: paymentSchedules.principalAmount,
      interestAmount: paymentSchedules.interestAmount,
      status: paymentSchedules.status,
      daysOverdue: sql<number>`(${today}::date - ${paymentSchedules.dueDate}::date)`,
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneNumber: users.phoneNumber,
      trackingNumber: loanApplications.trackingNumber,
      loanStatus: loanApplications.status,
    })
      .from(paymentSchedules)
      .innerJoin(loanApplications, eq(paymentSchedules.loanApplicationId, loanApplications.id))
      .innerJoin(users, eq(loanApplications.userId, users.id))
      .where(
        and(
          or(
            eq(paymentSchedules.status, "pending"),
            eq(paymentSchedules.status, "not_paid"),
            eq(paymentSchedules.status, "late")
          ),
          sql`${paymentSchedules.dueDate}::date < ${today}::date`
        )
      );
    
    // Filter in memory for day range (since SQL filtering requires complex date arithmetic)
    return result.filter((r: any) => {
      const daysOverdue = r.daysOverdue || 0;
      return daysOverdue >= minDays && daysOverdue <= maxDays;
    });
  } catch (error) {
    logger.error("[db.getOverduePayments] Error:", error);
    return [];
  }
}

/**
 * Get delinquent payments (30+ days overdue)
 * Used for critical delinquency alerts and loan status updates
 */
export async function getDelinquentPayments(minDays: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const { paymentSchedules, loanApplications, users } = await import("../drizzle/schema");
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await db.select({
      paymentId: paymentSchedules.id,
      loanApplicationId: paymentSchedules.loanApplicationId,
      installmentNumber: paymentSchedules.installmentNumber,
      dueDate: paymentSchedules.dueDate,
      dueAmount: paymentSchedules.dueAmount,
      principalAmount: paymentSchedules.principalAmount,
      interestAmount: paymentSchedules.interestAmount,
      status: paymentSchedules.status,
      daysOverdue: sql<number>`(${today}::date - ${paymentSchedules.dueDate}::date)`,
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneNumber: users.phoneNumber,
      trackingNumber: loanApplications.trackingNumber,
      loanId: loanApplications.id,
      loanStatus: loanApplications.status,
    })
      .from(paymentSchedules)
      .innerJoin(loanApplications, eq(paymentSchedules.loanApplicationId, loanApplications.id))
      .innerJoin(users, eq(loanApplications.userId, users.id))
      .where(
        and(
          or(
            eq(paymentSchedules.status, "pending"),
            eq(paymentSchedules.status, "not_paid"),
            eq(paymentSchedules.status, "late")
          ),
          sql`${paymentSchedules.dueDate}::date < ${today}::date`
        )
      );
    
    // Filter in memory for days (since SQL filtering requires complex date arithmetic)
    return result.filter((r: any) => {
      const daysOverdue = r.daysOverdue || 0;
      return daysOverdue >= minDays;
    });
  } catch (error) {
    logger.error("[db.getDelinquentPayments] Error:", error);
    return [];
  }
}

/**
 * Update loan application status to delinquent
 * Called when a payment becomes 30+ days overdue
 */
export async function markLoanAsDelinquent(loanApplicationId: number) {
  const db = await getDb();
  if (!db) return false;
  
  const { loanApplications } = await import("../drizzle/schema");
  
  try {
    await db.update(loanApplications)
      .set({
        status: "delinquent" as any,
        updatedAt: new Date(),
      })
      .where(eq(loanApplications.id, loanApplicationId));
    
    return true;
  } catch (error) {
    logger.error("[db.markLoanAsDelinquent] Error:", error);
    return false;
  }
}

// ========================
// Admin Settings Functions
// ========================

/**
 * Get current system configuration
 */
export async function getSystemConfig() {
  const db = await getDb();
  if (!db) return null;
  
  const { systemConfig } = await import("../drizzle/schema");
  
  try {
    const configs = await db.select().from(systemConfig).limit(1);
    return configs[0] || null;
  } catch (error) {
    logger.error("[db.getSystemConfig] Error:", error);
    return null;
  }
}

/**
 * Update system configuration
 */
export async function updateSystemConfig(data: {
  autoApprovalEnabled?: boolean;
  maintenanceMode?: boolean;
  minLoanAmount?: string;
  maxLoanAmount?: string;
  twoFactorRequired?: boolean;
  sessionTimeout?: number;
  updatedBy: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const { systemConfig } = await import("../drizzle/schema");
  
  try {
    const existing = await getSystemConfig();
    
    if (existing) {
      await db.update(systemConfig)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(systemConfig.id, existing.id));
      
      return await getSystemConfig();
    } else {
      const result = await db.insert(systemConfig).values({
        autoApprovalEnabled: data.autoApprovalEnabled ?? false,
        maintenanceMode: data.maintenanceMode ?? false,
        minLoanAmount: data.minLoanAmount ?? "1000.00",
        maxLoanAmount: data.maxLoanAmount ?? "5000.00",
        twoFactorRequired: data.twoFactorRequired ?? false,
        sessionTimeout: data.sessionTimeout ?? 30,
        updatedBy: data.updatedBy,
      });
      
      return await getSystemConfig();
    }
  } catch (error) {
    logger.error("[db.updateSystemConfig] Error:", error);
    return null;
  }
}

/**
 * Save encrypted API key
 */
export async function saveAPIKey(data: {
  provider: string;
  keyName: string;
  value: string;
  updatedBy: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const { apiKeys } = await import("../drizzle/schema");
  
  try {
    const encryptedValue = encryptBankData(data.value);
    
    // Check if key already exists
    const existing = await db.select().from(apiKeys)
      .where(and(
        eq(apiKeys.provider, data.provider),
        eq(apiKeys.keyName, data.keyName)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(apiKeys)
        .set({
          encryptedValue,
          updatedAt: new Date(),
          updatedBy: data.updatedBy,
        })
        .where(eq(apiKeys.id, existing[0].id));
      
      return existing[0].id;
    } else {
      const result = await db.insert(apiKeys).values({
        provider: data.provider,
        keyName: data.keyName,
        encryptedValue,
        isActive: true,
        updatedBy: data.updatedBy,
      }).returning({ id: apiKeys.id });
      
      return result[0]?.id || null;
    }
  } catch (error) {
    logger.error("[db.saveAPIKey] Error:", error);
    return null;
  }
}

/**
 * Get decrypted API key
 */
export async function getAPIKey(provider: string, keyName: string) {
  const db = await getDb();
  if (!db) return null;
  
  const { apiKeys } = await import("../drizzle/schema");
  
  try {
    const result = await db.select().from(apiKeys)
      .where(and(
        eq(apiKeys.provider, provider),
        eq(apiKeys.keyName, keyName),
        eq(apiKeys.isActive, true)
      ))
      .limit(1);
    
    if (result.length === 0) return null;
    
    const decryptedValue = decryptBankData(result[0].encryptedValue);
    
    return {
      ...result[0],
      value: decryptedValue,
    };
  } catch (error) {
    logger.error("[db.getAPIKey] Error:", error);
    return null;
  }
}

/**
 * Get all API keys for a provider (masked)
 */
export async function getAPIKeysByProvider(provider: string) {
  const db = await getDb();
  if (!db) return [];
  
  const { apiKeys } = await import("../drizzle/schema");
  
  try {
    const result = await db.select().from(apiKeys)
      .where(and(
        eq(apiKeys.provider, provider),
        eq(apiKeys.isActive, true)
      ));
    
    // Return with masked values (show last 4 chars only)
    return result.map(key => {
      const decrypted = decryptBankData(key.encryptedValue);
      const masked = decrypted.length > 4 
        ? '•'.repeat(decrypted.length - 4) + decrypted.slice(-4)
        : '•'.repeat(decrypted.length);
      
      return {
        ...key,
        value: masked,
        encryptedValue: undefined,
      };
    });
  } catch (error) {
    logger.error("[db.getAPIKeysByProvider] Error:", error);
    return [];
  }
}

/**
 * Save email configuration
 */
export async function saveEmailConfig(data: {
  provider: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
  updatedBy: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const { emailConfig } = await import("../drizzle/schema");
  
  try {
    const encryptedPassword = data.smtpPassword ? encryptBankData(data.smtpPassword) : null;
    
    const existing = await db.select().from(emailConfig)
      .where(eq(emailConfig.isActive, true))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(emailConfig)
        .set({
          provider: data.provider,
          smtpHost: data.smtpHost,
          smtpPort: data.smtpPort,
          smtpUser: data.smtpUser,
          encryptedSmtpPassword: encryptedPassword,
          fromEmail: data.fromEmail,
          fromName: data.fromName,
          replyToEmail: data.replyToEmail,
          updatedAt: new Date(),
          updatedBy: data.updatedBy,
        })
        .where(eq(emailConfig.id, existing[0].id));
      
      return existing[0].id;
    } else {
      const result = await db.insert(emailConfig).values({
        provider: data.provider,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpUser: data.smtpUser,
        encryptedSmtpPassword: encryptedPassword,
        fromEmail: data.fromEmail,
        fromName: data.fromName,
        replyToEmail: data.replyToEmail,
        isActive: true,
        updatedBy: data.updatedBy,
      }).returning({ id: emailConfig.id });
      
      return result[0]?.id || null;
    }
  } catch (error) {
    logger.error("[db.saveEmailConfig] Error:", error);
    return null;
  }
}

/**
 * Get active email configuration
 */
export async function getEmailConfig() {
  const db = await getDb();
  if (!db) return null;
  
  const { emailConfig } = await import("../drizzle/schema");
  
  try {
    const configs = await db.select().from(emailConfig)
      .where(eq(emailConfig.isActive, true))
      .limit(1);
    
    if (configs.length === 0) return null;
    
    const config = configs[0];
    
    // Decrypt SMTP password if present
    if (config.encryptedSmtpPassword) {
      return {
        ...config,
        smtpPassword: decryptBankData(config.encryptedSmtpPassword),
        encryptedSmtpPassword: undefined,
      };
    }
    
    return config;
  } catch (error) {
    logger.error("[db.getEmailConfig] Error:", error);
    return null;
  }
}

/**
 * Get notification settings
 */
export async function getNotificationSettings() {
  const db = await getDb();
  if (!db) return null;
  
  const { notificationSettings } = await import("../drizzle/schema");
  
  try {
    const settings = await db.select().from(notificationSettings).limit(1);
    return settings[0] || null;
  } catch (error) {
    logger.error("[db.getNotificationSettings] Error:", error);
    return null;
  }
}

/**
 * Update notification settings
 */
export async function updateNotificationSettings(data: {
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  applicationApproved?: boolean;
  applicationRejected?: boolean;
  paymentReminders?: boolean;
  paymentReceived?: boolean;
  documentRequired?: boolean;
  adminAlerts?: boolean;
  updatedBy: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const { notificationSettings } = await import("../drizzle/schema");
  
  try {
    const existing = await getNotificationSettings();
    
    if (existing) {
      await db.update(notificationSettings)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(notificationSettings.id, existing.id));
      
      return await getNotificationSettings();
    } else {
      await db.insert(notificationSettings).values({
        emailNotifications: data.emailNotifications ?? true,
        smsNotifications: data.smsNotifications ?? false,
        applicationApproved: data.applicationApproved ?? true,
        applicationRejected: data.applicationRejected ?? true,
        paymentReminders: data.paymentReminders ?? true,
        paymentReceived: data.paymentReceived ?? true,
        documentRequired: data.documentRequired ?? true,
        adminAlerts: data.adminAlerts ?? true,
        updatedBy: data.updatedBy,
      });
      
      return await getNotificationSettings();
    }
  } catch (error) {
    logger.error("[db.updateNotificationSettings] Error:", error);
    return null;
  }
}

/**
 * Crypto Wallet Settings Management
 */
export async function getCryptoWalletSettings() {
  const db = await getDb();
  if (!db) return null;
  
  const { cryptoWalletSettings } = await import("../drizzle/schema");
  
  try {
    const [settings] = await db.select().from(cryptoWalletSettings).where(eq(cryptoWalletSettings.isActive, true)).limit(1);
    return settings || null;
  } catch (error) {
    logger.error("[db.getCryptoWalletSettings] Error:", error);
    return null;
  }
}

export async function updateCryptoWalletSettings(data: {
  btcAddress?: string;
  ethAddress?: string;
  usdtAddress?: string;
  usdcAddress?: string;
  updatedBy?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const { cryptoWalletSettings } = await import("../drizzle/schema");
  
  try {
    const existing = await getCryptoWalletSettings();
    
    if (existing) {
      await db.update(cryptoWalletSettings)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(cryptoWalletSettings.id, existing.id));
      
      return await getCryptoWalletSettings();
    } else {
      await db.insert(cryptoWalletSettings).values({
        btcAddress: data.btcAddress || null,
        ethAddress: data.ethAddress || null,
        usdtAddress: data.usdtAddress || null,
        usdcAddress: data.usdcAddress || null,
        isActive: true,
        updatedBy: data.updatedBy,
      });
      
      return await getCryptoWalletSettings();
    }
  } catch (error) {
    logger.error("[db.updateCryptoWalletSettings] Error:", error);
    return null;
  }
}

/**
 * Company Bank Settings Management (for Wire/ACH transfers)
 */
export async function getCompanyBankSettings() {
  const db = await getDb();
  if (!db) return null;
  
  const { companyBankSettings } = await import("../drizzle/schema");
  
  try {
    const [settings] = await db.select().from(companyBankSettings).where(eq(companyBankSettings.isActive, true)).limit(1);
    return settings || null;
  } catch (error) {
    logger.error("[db.getCompanyBankSettings] Error:", error);
    return null;
  }
}

export async function updateCompanyBankSettings(data: {
  bankName: string;
  accountHolderName: string;
  routingNumber: string;
  accountNumber: string;
  accountType?: string;
  swiftCode?: string;
  bankAddress?: string;
  instructions?: string;
  updatedBy?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const { companyBankSettings } = await import("../drizzle/schema");
  
  try {
    const existing = await getCompanyBankSettings();
    
    if (existing) {
      await db.update(companyBankSettings)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(companyBankSettings.id, existing.id));
      
      return await getCompanyBankSettings();
    } else {
      await db.insert(companyBankSettings).values({
        bankName: data.bankName,
        accountHolderName: data.accountHolderName,
        routingNumber: data.routingNumber,
        accountNumber: data.accountNumber,
        accountType: data.accountType || "checking",
        swiftCode: data.swiftCode || null,
        bankAddress: data.bankAddress || null,
        instructions: data.instructions || null,
        isActive: true,
        updatedBy: data.updatedBy,
      });
      
      return await getCompanyBankSettings();
    }
  } catch (error) {
    logger.error("[db.updateCompanyBankSettings] Error:", error);
    return null;
  }
}

// ============================================================================
// Support Tickets Functions
// ============================================================================

export async function createSupportTicket(data: {
  userId: number;
  subject: string;
  description: string;
  category?: string;
  priority?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  const { supportTickets } = await import("../drizzle/schema");
  
  const [ticket] = await db.insert(supportTickets).values({
    userId: data.userId,
    subject: data.subject,
    description: data.description,
    category: data.category as any,
    priority: data.priority as any,
    status: 'open',
  }).returning();
  
  return ticket;
}

export async function getUserSupportTickets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { supportTickets } = await import("../drizzle/schema");
  
  return await db.select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.createdAt));
}

export async function getSupportTicketById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { supportTickets } = await import("../drizzle/schema");
  
  const [ticket] = await db.select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id));
  
  return ticket || null;
}

export async function getTicketMessages(ticketId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { ticketMessages, users } = await import("../drizzle/schema");
  
  const messages = await db.select({
    id: ticketMessages.id,
    ticketId: ticketMessages.ticketId,
    userId: ticketMessages.userId,
    message: ticketMessages.message,
    attachmentUrl: ticketMessages.attachmentUrl,
    isFromAdmin: ticketMessages.isFromAdmin,
    createdAt: ticketMessages.createdAt,
    userName: users.name,
    userEmail: users.email,
  })
    .from(ticketMessages)
    .leftJoin(users, eq(ticketMessages.userId, users.id))
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(ticketMessages.createdAt);
  
  return messages;
}

export async function addTicketMessage(data: {
  ticketId: number;
  userId: number;
  message: string;
  attachmentUrl?: string;
  isFromAdmin: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  const { ticketMessages, supportTickets } = await import("../drizzle/schema");
  
  const [message] = await db.insert(ticketMessages).values({
    ticketId: data.ticketId,
    userId: data.userId,
    message: data.message,
    attachmentUrl: data.attachmentUrl,
    isFromAdmin: data.isFromAdmin,
  }).returning();
  
  // Update ticket's updatedAt timestamp
  await db.update(supportTickets)
    .set({ updatedAt: new Date() })
    .where(eq(supportTickets.id, data.ticketId));
  
  return message;
}

export async function getAllSupportTickets(status?: string, priority?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const { supportTickets, users } = await import("../drizzle/schema");
  
  let query = db.select({
    id: supportTickets.id,
    userId: supportTickets.userId,
    subject: supportTickets.subject,
    description: supportTickets.description,
    category: supportTickets.category,
    priority: supportTickets.priority,
    status: supportTickets.status,
    assignedTo: supportTickets.assignedTo,
    resolvedAt: supportTickets.resolvedAt,
    createdAt: supportTickets.createdAt,
    updatedAt: supportTickets.updatedAt,
    userName: users.name,
    userEmail: users.email,
  })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .$dynamic();
  
  const conditions = [];
  if (status) {
    conditions.push(eq(supportTickets.status, status as any));
  }
  if (priority) {
    conditions.push(eq(supportTickets.priority, priority as any));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  
  const tickets = await query.orderBy(desc(supportTickets.createdAt));
  return tickets;
}

export async function updateSupportTicketStatus(
  id: number, 
  status: string, 
  resolution?: string,
  resolvedBy?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  const { supportTickets } = await import("../drizzle/schema");
  
  const updateData: any = {
    status: status as any,
    updatedAt: new Date(),
  };
  
  if (status === 'resolved' || status === 'closed') {
    updateData.resolvedAt = new Date();
    if (resolvedBy) {
      updateData.resolvedBy = resolvedBy;
    }
    if (resolution) {
      updateData.resolution = resolution;
    }
  }
  
  await db.update(supportTickets)
    .set(updateData)
    .where(eq(supportTickets.id, id));
}

export async function assignSupportTicket(id: number, assignedTo: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  const { supportTickets } = await import("../drizzle/schema");
  
  await db.update(supportTickets)
    .set({ 
      assignedTo,
      updatedAt: new Date(),
      status: 'in_progress' as any,
    })
    .where(eq(supportTickets.id, id));
}

// =====================
// Two-Factor Authentication Functions
// =====================

export async function enable2FA(
  userId: number,
  secret: string,
  method: string,
  backupCodes: string[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { users } = await import("../drizzle/schema");

  await db.update(users)
    .set({
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorMethod: method,
      twoFactorBackupCodes: JSON.stringify(backupCodes),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function disable2FA(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { users } = await import("../drizzle/schema");

  await db.update(users)
    .set({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorMethod: null,
      twoFactorBackupCodes: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function update2FABackupCodes(userId: number, backupCodes: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { users } = await import("../drizzle/schema");

  await db.update(users)
    .set({
      twoFactorBackupCodes: JSON.stringify(backupCodes),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function create2FASession(
  userId: number,
  sessionToken: string,
  ipAddress: string,
  userAgent: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { twoFactorSessions } = await import("../drizzle/schema");

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiry

  await db.insert(twoFactorSessions).values({
    userId,
    sessionToken,
    verified: false,
    expiresAt,
    ipAddress,
    userAgent,
    createdAt: new Date(),
  });
}

export async function verify2FASession(sessionToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { twoFactorSessions } = await import("../drizzle/schema");

  await db.update(twoFactorSessions)
    .set({ verified: true })
    .where(eq(twoFactorSessions.sessionToken, sessionToken));
}

export async function logLoginActivity(
  userId: number,
  ipAddress: string,
  userAgent: string,
  success: boolean,
  failureReason?: string,
  twoFactorUsed?: boolean,
  location?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { loginActivity } = await import("../drizzle/schema");

  await db.insert(loginActivity).values({
    userId,
    ipAddress,
    userAgent,
    location: location || null, // Enhanced with IP geolocation
    deviceType: null, // Can be parsed from userAgent
    browser: null, // Can be parsed from userAgent
    success,
    failureReason: failureReason || null,
    twoFactorUsed: twoFactorUsed || false,
    createdAt: new Date(),
  });
}

export async function getLoginActivity(userId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { loginActivity } = await import("../drizzle/schema");
  const { desc } = await import("drizzle-orm");

  const activities = await db.select()
    .from(loginActivity)
    .where(eq(loginActivity.userId, userId))
    .orderBy(desc(loginActivity.createdAt))
    .limit(limit);

  return activities;
}

// =====================
// Auto-Pay Functions
// =====================

export async function createAutoPaySetting(data: {
  userId: number;
  loanApplicationId: number | null;
  isEnabled: boolean;
  paymentMethod: string;
  customerProfileId?: string | null;
  paymentProfileId?: string | null;
  bankAccountId?: string | null;
  cardLast4?: string | null;
  cardBrand?: string | null;
  paymentDay: number;
  amount: number;
  nextPaymentDate: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { autoPaySettings } = await import("../drizzle/schema");

  const result = await db.insert(autoPaySettings).values({
    userId: data.userId,
    loanApplicationId: data.loanApplicationId,
    isEnabled: data.isEnabled,
    paymentMethod: data.paymentMethod,
    customerProfileId: data.customerProfileId || null,
    paymentProfileId: data.paymentProfileId || null,
    bankAccountId: data.bankAccountId || null,
    cardLast4: data.cardLast4 || null,
    cardBrand: data.cardBrand || null,
    paymentDay: data.paymentDay,
    amount: data.amount,
    nextPaymentDate: data.nextPaymentDate,
    status: "active",
    failedAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return result[0];
}

export async function getAutoPaySettings(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { autoPaySettings } = await import("../drizzle/schema");

  const settings = await db.select()
    .from(autoPaySettings)
    .where(eq(autoPaySettings.userId, userId));

  return settings;
}

export async function updateAutoPaySetting(
  id: number,
  data: Partial<{
    isEnabled: boolean;
    paymentMethod: string;
    paymentDay: number;
    amount: number;
    nextPaymentDate: Date;
    status: string;
    failedAttempts: number;
    lastPaymentDate: Date;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { autoPaySettings } = await import("../drizzle/schema");

  await db.update(autoPaySettings)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(autoPaySettings.id, id));
}

export async function deleteAutoPaySetting(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { autoPaySettings } = await import("../drizzle/schema");

  await db.delete(autoPaySettings)
    .where(eq(autoPaySettings.id, id));
}

export async function recordAutoPayFailure(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { autoPaySettings } = await import("../drizzle/schema");
  const { sql } = await import("drizzle-orm");

  await db.update(autoPaySettings)
    .set({
      failedAttempts: sql`${autoPaySettings.failedAttempts} + 1`,
      status: "failed",
      updatedAt: new Date(),
    })
    .where(eq(autoPaySettings.id, id));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { users } = await import("../drizzle/schema");
  return await db.select().from(users);
}

export async function getAutoPaySettingsDueToday(dayOfMonth: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { autoPaySettings, loanApplications } = await import("../drizzle/schema");

  // Get all enabled auto-pay settings where payment day matches and loan is disbursed
  const settings = await db.select({
    id: autoPaySettings.id,
    userId: autoPaySettings.userId,
    loanId: autoPaySettings.loanApplicationId,
    amount: autoPaySettings.amount,
    paymentMethod: autoPaySettings.paymentMethod,
    bankAccountId: autoPaySettings.bankAccountId,
    paymentDay: autoPaySettings.paymentDay,
    nextPaymentDate: autoPaySettings.nextPaymentDate,
    failedAttempts: autoPaySettings.failedAttempts,
    isEnabled: autoPaySettings.isEnabled,
  })
    .from(autoPaySettings)
    .innerJoin(loanApplications, eq(autoPaySettings.loanApplicationId, loanApplications.id))
    .where(
      and(
        eq(autoPaySettings.isEnabled, true),
        eq(autoPaySettings.paymentDay, dayOfMonth),
        eq(loanApplications.status, 'disbursed')
      )
    );

  return settings;
}

// =====================
// Admin Audit Log Functions
// =====================

export async function createAdminAuditLog(data: {
  adminId: number;
  action: string;
  resourceType?: string;
  resourceId?: number;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { adminAuditLog } = await import("../drizzle/schema");

  const result = await db.insert(adminAuditLog).values({
    ...data,
    createdAt: new Date(),
  }).returning();

  return result[0];
}

export async function getAdminAuditLogs(options?: {
  adminId?: number;
  action?: string;
  resourceType?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { adminAuditLog } = await import("../drizzle/schema");

  let query = db.select().from(adminAuditLog);

  if (options?.adminId) {
    query = query.where(eq(adminAuditLog.adminId, options.adminId)) as any;
  }

  if (options?.action) {
    query = query.where(eq(adminAuditLog.action, options.action)) as any;
  }

  if (options?.resourceType) {
    query = query.where(eq(adminAuditLog.resourceType, options.resourceType)) as any;
  }

  query = query.orderBy(desc(adminAuditLog.createdAt)) as any;

  if (options?.limit) {
    query = query.limit(options.limit) as any;
  }

  if (options?.offset) {
    query = query.offset(options.offset) as any;
  }

  return query;
}

// =====================
// Document Verification Functions
// =====================

export async function updateDocumentVerificationStatus(
  loanApplicationId: number,
  status: 'pending' | 'verified' | 'rejected' | 'pending_review',
  metadata?: {
    confidenceScore?: number;
    flags?: string;
    extractedData?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { uploadedDocuments } = await import("../drizzle/schema");

  // Update all driver license and ID documents for this loan application
  await db
    .update(uploadedDocuments)
    .set({
      verificationStatus: status,
      verificationMetadata: metadata ? JSON.stringify(metadata) : null,
      updatedAt: new Date(),
    })
    .where(eq(uploadedDocuments.loanApplicationId, loanApplicationId));

  return { success: true };
}

export async function getDocumentByLoanId(
  loanApplicationId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { uploadedDocuments } = await import("../drizzle/schema");

  const docs = await db
    .select()
    .from(uploadedDocuments)
    .where(eq(uploadedDocuments.loanApplicationId, loanApplicationId));

  return docs;
}

/**
 * Get all disbursed loans (active loans)
 */
export async function getAllDisbursedLoans() {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { loanApplications } = await import("../drizzle/schema");

  const loans = await db
    .select()
    .from(loanApplications)
    .where(eq(loanApplications.status, "disbursed"));

  return loans;
}

/**
 * Get user notification preferences from user_notification_settings table
 * Returns flat boolean object matching the NotificationSettings page fields
 */
export async function getUserNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { userNotificationSettings } = await import("../drizzle/schema");

  const result = await db
    .select()
    .from(userNotificationSettings)
    .where(eq(userNotificationSettings.userId, userId))
    .limit(1);

  if (result && result.length > 0) {
    const s = result[0];
    return {
      paymentReminders: s.paymentReminders,
      paymentConfirmations: s.paymentConfirmations,
      loanStatusUpdates: s.loanStatusUpdates,
      documentNotifications: s.documentNotifications,
      promotionalNotifications: s.promotionalNotifications,
      emailEnabled: s.emailEnabled,
      smsEnabled: s.smsEnabled,
      emailDigest: s.emailDigest,
    };
  }

  // Create default row and return defaults
  try {
    await db.insert(userNotificationSettings).values({ userId } as any);
  } catch {
    // Row may already exist from race condition — ignore
  }

  return {
    paymentReminders: true,
    paymentConfirmations: true,
    loanStatusUpdates: true,
    documentNotifications: true,
    promotionalNotifications: false,
    emailEnabled: true,
    smsEnabled: false,
    emailDigest: false,
  };
}

/**
 * Log a payment reminder
 */
export async function logPaymentReminder(loanId: number, daysUntilDue: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { paymentReminders } = await import("../drizzle/schema");

  try {
    await db.insert(paymentReminders).values({
      loanApplicationId: loanId,
      reminderType: daysUntilDue < 0 ? "overdue" : "upcoming",
      daysUntilDue: daysUntilDue,
      sentAt: new Date(),
    });

    return { success: true };
  } catch (error) {
    logger.error("Error logging payment reminder:", error);
    return { success: false };
  }
}

/**
 * Get all loans with auto-pay enabled
 */
export async function getAutoPayEnabledLoans() {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { loanApplications } = await import("../drizzle/schema");

  const loans = await db
    .select()
    .from(loanApplications)
    .where(eq(loanApplications.status, "disbursed"));
  
  // Filter for auto-pay enabled (would need a column in production)
  // For now, return all disbursed loans
  return loans;
}

/**
 * Check if payment was already attempted today for a loan
 */
export async function wasPaymentAttemptedToday(loanId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { payments } = await import("../drizzle/schema");
  const { gte } = await import("drizzle-orm");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const result = await db
    .select()
    .from(payments)
    .where(and(
      eq(payments.loanApplicationId, loanId),
      gte(payments.createdAt, todayStart)
    ))
    .limit(1);

  return result && result.length > 0;
}

/**
 * Get user's default payment method
 */
export async function getDefaultPaymentMethod(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { savedPaymentMethods } = await import("../drizzle/schema");
  const { and } = await import("drizzle-orm");

  const result = await db
    .select()
    .from(savedPaymentMethods)
    .where(
      and(
        eq(savedPaymentMethods.userId, userId),
        eq(savedPaymentMethods.isDefault, true)
      )
    )
    .limit(1);

  return result && result.length > 0 ? result[0] : null;
}

/**
 * Log auto-pay failure
 */
export async function logAutoPayFailure(loanId: number, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { autoPayLog } = await import("../drizzle/schema");

  try {
    await db.insert(autoPayLog).values({
      loanApplicationId: loanId,
      status: "failed",
      reason: reason,
      attemptedAt: new Date(),
    });

    return { success: true };
  } catch (error) {
    logger.error("Error logging auto-pay failure:", error);
    return { success: false };
  }
}

// ============================================
// AUDIT LOGGING FUNCTIONS (Priority 4)
// ============================================

export async function createAuditLog(data: {
  eventType: string;
  userId?: number;
  ipAddress?: string;
  userAgent?: string;
  severity: string;
  description: string;
  metadata?: string | null;
  resourceType?: string;
  resourceId?: number;
  timestamp: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { auditLog } = await import("../drizzle/schema");

  try {
    const result = await db.insert(auditLog).values(data).returning();
    return result[0];
  } catch (error) {
    logger.error("Error creating audit log:", error);
    throw error;
  }
}

export async function getAuditLogs(filters?: {
  userId?: number;
  eventType?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { auditLog } = await import("../drizzle/schema");

  try {
    let query = db.select().from(auditLog);
    
    const conditions: any[] = [];
    if (filters?.userId) {
      conditions.push(eq(auditLog.userId, filters.userId));
    }
    if (filters?.eventType) {
      conditions.push(eq(auditLog.eventType, filters.eventType));
    }
    if (filters?.severity) {
      conditions.push(eq(auditLog.severity, filters.severity));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(auditLog.timestamp)) as any;

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    return await query;
  } catch (error) {
    logger.error("Error fetching audit logs:", error);
    throw error;
  }
}

export async function query(sql: string) {
  if (_client) {
    return await _client.unsafe(sql);
  }
  throw new Error("Database client not initialized");
}

// ============================================
// DOCUMENT MANAGEMENT FUNCTIONS (Priority 3)
// ============================================

export async function addLoanDocument(data: {
  loanApplicationId: number;
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { loanDocuments } = await import("../drizzle/schema");

  try {
    const result = await db.insert(loanDocuments).values({
      ...data,
      uploadedAt: new Date(),
      status: 'pending',
    }).returning();

    return result[0];
  } catch (error) {
    logger.error("Error adding loan document:", error);
    throw error;
  }
}

export async function getLoanDocuments(loanApplicationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { loanDocuments } = await import("../drizzle/schema");

  try {
    return await db
      .select()
      .from(loanDocuments)
      .where(eq(loanDocuments.loanApplicationId, loanApplicationId))
      .orderBy(desc(loanDocuments.uploadedAt));
  } catch (error) {
    logger.error("Error fetching loan documents:", error);
    throw error;
  }
}

export async function getLoanDocument(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { loanDocuments } = await import("../drizzle/schema");

  try {
    const results = await db
      .select()
      .from(loanDocuments)
      .where(eq(loanDocuments.id, documentId))
      .limit(1);

    return results[0] || null;
  } catch (error) {
    logger.error("Error fetching loan document:", error);
    throw error;
  }
}

export async function updateDocumentStatus(
  documentId: number,
  status: string,
  reviewedBy: number,
  reviewNotes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { loanDocuments } = await import("../drizzle/schema");

  try {
    const result = await db
      .update(loanDocuments)
      .set({
        status,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes,
      })
      .where(eq(loanDocuments.id, documentId))
      .returning();

    return result[0];
  } catch (error) {
    logger.error("Error updating document status:", error);
    throw error;
  }
}

// ============================================
// ENHANCED FEATURES - DATABASE FUNCTIONS
// ============================================

// ========== Hardship Programs ==========

export async function createHardshipRequest(data: {
  loanApplicationId: number;
  userId: number;
  programType: string;
  reason: string;
  monthlyIncomeChange?: number;
  proposedPaymentAmount?: number;
  requestedDuration?: number;
  supportingDocuments?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { hardshipRequests } = await import("../drizzle/schema");

  const result = await db.insert(hardshipRequests).values({
    loanApplicationId: data.loanApplicationId,
    userId: data.userId,
    programType: data.programType as any,
    reason: data.reason,
    monthlyIncomeChange: data.monthlyIncomeChange,
    proposedPaymentAmount: data.proposedPaymentAmount,
    requestedDuration: data.requestedDuration,
    supportingDocuments: data.supportingDocuments,
    status: "pending",
  }).returning();

  return result[0];
}

export async function getUserHardshipRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const { hardshipRequests, loanApplications } = await import("../drizzle/schema");

  return await db
    .select({
      id: hardshipRequests.id,
      loanApplicationId: hardshipRequests.loanApplicationId,
      trackingNumber: loanApplications.trackingNumber,
      programType: hardshipRequests.programType,
      reason: hardshipRequests.reason,
      status: hardshipRequests.status,
      requestedDuration: hardshipRequests.requestedDuration,
      approvedDuration: hardshipRequests.approvedDuration,
      approvedPaymentAmount: hardshipRequests.approvedPaymentAmount,
      startDate: hardshipRequests.startDate,
      endDate: hardshipRequests.endDate,
      createdAt: hardshipRequests.createdAt,
    })
    .from(hardshipRequests)
    .leftJoin(loanApplications, eq(hardshipRequests.loanApplicationId, loanApplications.id))
    .where(eq(hardshipRequests.userId, userId))
    .orderBy(desc(hardshipRequests.createdAt));
}

export async function getAllHardshipRequests(status?: string) {
  const db = await getDb();
  if (!db) return [];
  const { hardshipRequests, loanApplications, users } = await import("../drizzle/schema");

  let query = db
    .select({
      id: hardshipRequests.id,
      loanApplicationId: hardshipRequests.loanApplicationId,
      trackingNumber: loanApplications.trackingNumber,
      userId: hardshipRequests.userId,
      userName: users.name,
      userEmail: users.email,
      programType: hardshipRequests.programType,
      reason: hardshipRequests.reason,
      status: hardshipRequests.status,
      requestedDuration: hardshipRequests.requestedDuration,
      proposedPaymentAmount: hardshipRequests.proposedPaymentAmount,
      monthlyIncomeChange: hardshipRequests.monthlyIncomeChange,
      createdAt: hardshipRequests.createdAt,
    })
    .from(hardshipRequests)
    .leftJoin(loanApplications, eq(hardshipRequests.loanApplicationId, loanApplications.id))
    .leftJoin(users, eq(hardshipRequests.userId, users.id))
    .$dynamic();

  if (status) {
    query = query.where(eq(hardshipRequests.status, status));
  }

  return await query.orderBy(desc(hardshipRequests.createdAt));
}

export async function updateHardshipRequest(
  id: number,
  data: {
    status?: string;
    approvedDuration?: number;
    approvedPaymentAmount?: number;
    startDate?: Date;
    endDate?: Date;
    adminNotes?: string;
    reviewedBy?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { hardshipRequests } = await import("../drizzle/schema");

  const result = await db
    .update(hardshipRequests)
    .set({
      ...data,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(hardshipRequests.id, id))
    .returning();

  return result[0];
}

// ========== Tax Documents ==========

export async function createTaxDocument(data: {
  userId: number;
  loanApplicationId?: number;
  documentType: string;
  taxYear: number;
  totalInterestPaid?: number;
  totalPrincipalPaid?: number;
  debtCancelled?: number;
  documentPath?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { taxDocuments } = await import("../drizzle/schema");

  const result = await db.insert(taxDocuments).values({
    userId: data.userId,
    loanApplicationId: data.loanApplicationId,
    documentType: data.documentType as any,
    taxYear: data.taxYear,
    totalInterestPaid: data.totalInterestPaid,
    totalPrincipalPaid: data.totalPrincipalPaid,
    debtCancelled: data.debtCancelled,
    documentPath: data.documentPath,
  }).returning();

  return result[0];
}

export async function getUserTaxDocuments(userId: number, taxYear?: number) {
  const db = await getDb();
  if (!db) return [];
  const { taxDocuments } = await import("../drizzle/schema");

  let query = db
    .select()
    .from(taxDocuments)
    .where(eq(taxDocuments.userId, userId))
    .$dynamic();

  if (taxYear) {
    query = query.where(eq(taxDocuments.taxYear, taxYear));
  }

  return await query.orderBy(desc(taxDocuments.taxYear));
}

export async function markTaxDocumentSent(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { taxDocuments } = await import("../drizzle/schema");

  await db
    .update(taxDocuments)
    .set({ sentToUser: true, sentAt: new Date() })
    .where(eq(taxDocuments.id, documentId));
}

// ========== Push Notifications ==========

export async function createPushSubscription(data: {
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { pushSubscriptions } = await import("../drizzle/schema");

  const result = await db.insert(pushSubscriptions).values(data).returning();
  return result[0];
}

export async function getUserPushSubscriptions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const { pushSubscriptions } = await import("../drizzle/schema");

  return await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

export async function deletePushSubscription(endpoint: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { pushSubscriptions } = await import("../drizzle/schema");

  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function deleteAllUserPushSubscriptions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { pushSubscriptions } = await import("../drizzle/schema");

  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

export async function updatePushSubscriptionLastUsed(endpoint: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { pushSubscriptions } = await import("../drizzle/schema");

  await db
    .update(pushSubscriptions)
    .set({ lastUsed: new Date() })
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

// ========== Co-Signers ==========

export async function createCoSignerInvitation(data: {
  loanApplicationId: number;
  primaryBorrowerId: number;
  coSignerEmail: string;
  coSignerName?: string;
  liabilitySplit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { coSigners } = await import("../drizzle/schema");
  const crypto = await import("crypto");

  const invitationToken = crypto.randomBytes(32).toString("hex");

  const result = await db.insert(coSigners).values({
    loanApplicationId: data.loanApplicationId,
    primaryBorrowerId: data.primaryBorrowerId,
    coSignerEmail: data.coSignerEmail,
    coSignerName: data.coSignerName,
    invitationToken,
    liabilitySplit: data.liabilitySplit || 50,
    status: "invited",
  }).returning();

  return result[0];
}

export async function getCoSignerByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const { coSigners } = await import("../drizzle/schema");

  const results = await db
    .select()
    .from(coSigners)
    .where(eq(coSigners.invitationToken, token))
    .limit(1);

  return results[0] || null;
}

export async function updateCoSignerStatus(
  id: number,
  status: string,
  coSignerUserId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { coSigners } = await import("../drizzle/schema");

  const result = await db
    .update(coSigners)
    .set({
      status: status as any,
      coSignerUserId,
      respondedAt: new Date(),
    })
    .where(eq(coSigners.id, id))
    .returning();

  return result[0];
}

export async function getLoanCoSigners(loanApplicationId: number) {
  const db = await getDb();
  if (!db) return [];
  const { coSigners } = await import("../drizzle/schema");

  return await db
    .select()
    .from(coSigners)
    .where(eq(coSigners.loanApplicationId, loanApplicationId));
}

// ========== Account Closure ==========

export async function createAccountClosureRequest(data: {
  userId: number;
  reason: string;
  detailedReason?: string;
  hasOutstandingLoans: boolean;
  dataExportRequested: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { accountClosureRequests } = await import("../drizzle/schema");

  const result = await db.insert(accountClosureRequests).values({
    userId: data.userId,
    reason: data.reason as any,
    detailedReason: data.detailedReason,
    hasOutstandingLoans: data.hasOutstandingLoans,
    dataExportRequested: data.dataExportRequested,
    status: "pending",
  }).returning();

  return result[0];
}

export async function getUserAccountClosureRequest(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const { accountClosureRequests } = await import("../drizzle/schema");

  const results = await db
    .select()
    .from(accountClosureRequests)
    .where(eq(accountClosureRequests.userId, userId))
    .orderBy(desc(accountClosureRequests.createdAt))
    .limit(1);

  return results[0] || null;
}

export async function getAllAccountClosureRequests(status?: string) {
  const db = await getDb();
  if (!db) return [];
  const { accountClosureRequests, users } = await import("../drizzle/schema");

  let query = db
    .select({
      id: accountClosureRequests.id,
      userId: accountClosureRequests.userId,
      userName: users.name,
      userEmail: users.email,
      reason: accountClosureRequests.reason,
      detailedReason: accountClosureRequests.detailedReason,
      hasOutstandingLoans: accountClosureRequests.hasOutstandingLoans,
      dataExportRequested: accountClosureRequests.dataExportRequested,
      status: accountClosureRequests.status,
      createdAt: accountClosureRequests.createdAt,
    })
    .from(accountClosureRequests)
    .leftJoin(users, eq(accountClosureRequests.userId, users.id))
    .$dynamic();

  if (status) {
    query = query.where(eq(accountClosureRequests.status, status));
  }

  return await query.orderBy(desc(accountClosureRequests.createdAt));
}

export async function updateAccountClosureRequest(
  id: number,
  data: {
    status?: string;
    reviewedBy?: number;
    adminNotes?: string;
    scheduledDeletionDate?: Date;
    dataExportedAt?: Date;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { accountClosureRequests } = await import("../drizzle/schema");

  const result = await db
    .update(accountClosureRequests)
    .set({
      ...data,
      reviewedAt: new Date(),
    })
    .where(eq(accountClosureRequests.id, id))
    .returning();

  return result[0];
}

// ========== Payment Preferences ==========

type AllocationStrategy = "standard" | "principal_first" | "future_payments" | "biweekly" | "round_up";

export async function createOrUpdatePaymentPreference(data: {
  userId: number;
  loanApplicationId?: number;
  allocationStrategy?: AllocationStrategy;
  roundUpEnabled?: boolean;
  roundUpToNearest?: number;
  biweeklyEnabled?: boolean;
  autoExtraPaymentAmount?: number;
  autoExtraPaymentDay?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { paymentPreferences } = await import("../drizzle/schema");

  // Check if preference exists
  const existing = await db
    .select()
    .from(paymentPreferences)
    .where(eq(paymentPreferences.userId, data.userId))
    .limit(1);

  if (existing.length > 0) {
    // Update
    const result = await db
      .update(paymentPreferences)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(paymentPreferences.userId, data.userId))
      .returning();
    return result[0];
  } else {
    // Insert
    const result = await db.insert(paymentPreferences).values(data).returning();
    return result[0];
  }
}

export async function getUserPaymentPreference(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const { paymentPreferences } = await import("../drizzle/schema");

  const results = await db
    .select()
    .from(paymentPreferences)
    .where(eq(paymentPreferences.userId, userId))
    .limit(1);

  return results[0] || null;
}

// ========== Fraud Detection ==========

export async function createFraudCheck(data: {
  userId?: number;
  loanApplicationId?: number;
  sessionId?: string;
  deviceFingerprint?: string;
  ipAddress: string;
  ipCountry?: string;
  ipCity?: string;
  ipRiskScore?: number;
  velocityScore?: number;
  riskScore: number;
  riskLevel: string;
  flaggedReasons?: string;
  requiresManualReview?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { fraudChecks } = await import("../drizzle/schema");

  const result = await db.insert(fraudChecks).values(data).returning();
  return result[0];
}

export async function getFraudChecksByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const { fraudChecks } = await import("../drizzle/schema");

  return await db
    .select()
    .from(fraudChecks)
    .where(eq(fraudChecks.userId, userId))
    .orderBy(desc(fraudChecks.createdAt));
}

export async function getPendingFraudReviews() {
  const db = await getDb();
  if (!db) return [];
  const { fraudChecks } = await import("../drizzle/schema");

  return await db
    .select()
    .from(fraudChecks)
    .where(eq(fraudChecks.requiresManualReview, true))
    .orderBy(desc(fraudChecks.createdAt));
}

export async function updateFraudCheckReview(
  id: number,
  reviewedBy: number,
  reviewNotes: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { fraudChecks } = await import("../drizzle/schema");

  await db
    .update(fraudChecks)
    .set({
      reviewedBy,
      reviewedAt: new Date(),
      reviewNotes,
    })
    .where(eq(fraudChecks.id, id));
}

// ========== Live Chat ==========

export async function createChatSession(userId: number, subject?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { chatSessions } = await import("../drizzle/schema");

  const result = await db.insert(chatSessions).values({
    userId,
    subject,
    status: "active",
  }).returning();

  return result[0];
}

export async function getChatSession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const { chatSessions } = await import("../drizzle/schema");

  const results = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);

  return results[0] || null;
}

export async function getUserActiveChatSession(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const { chatSessions } = await import("../drizzle/schema");

  const results = await db
    .select()
    .from(chatSessions)
    .where(and(
      eq(chatSessions.userId, userId),
      eq(chatSessions.status, "active")
    ))
    .orderBy(desc(chatSessions.startedAt))
    .limit(1);

  return results[0] || null;
}

export async function assignChatToAgent(sessionId: number, agentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { chatSessions } = await import("../drizzle/schema");

  await db
    .update(chatSessions)
    .set({ assignedToAgentId: agentId })
    .where(eq(chatSessions.id, sessionId));
}

export async function closeChatSession(
  sessionId: number,
  rating?: number,
  feedbackComment?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { chatSessions } = await import("../drizzle/schema");

  await db
    .update(chatSessions)
    .set({
      status: "closed",
      closedAt: new Date(),
      rating,
      feedbackComment,
    })
    .where(eq(chatSessions.id, sessionId));
}

export async function createChatMessage(data: {
  sessionId: number;
  senderId: number;
  message: string;
  isFromAgent: boolean;
  attachmentUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { chatMessages } = await import("../drizzle/schema");

  const result = await db.insert(chatMessages).values(data).returning();
  return result[0];
}

export async function getChatMessages(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  const { chatMessages, users } = await import("../drizzle/schema");

  return await db
    .select({
      id: chatMessages.id,
      sessionId: chatMessages.sessionId,
      senderId: chatMessages.senderId,
      senderName: users.name,
      message: chatMessages.message,
      isFromAgent: chatMessages.isFromAgent,
      status: chatMessages.status,
      attachmentUrl: chatMessages.attachmentUrl,
      createdAt: chatMessages.createdAt,
      readAt: chatMessages.readAt,
    })
    .from(chatMessages)
    .leftJoin(users, eq(chatMessages.senderId, users.id))
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);
}

export async function markChatMessageAsRead(messageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { chatMessages } = await import("../drizzle/schema");

  await db
    .update(chatMessages)
    .set({ status: "read", readAt: new Date() })
    .where(eq(chatMessages.id, messageId));
}

export async function getActiveChatSessions() {
  const db = await getDb();
  if (!db) return [];
  const { chatSessions, users } = await import("../drizzle/schema");

  return await db
    .select({
      id: chatSessions.id,
      userId: chatSessions.userId,
      userName: users.name,
      userEmail: users.email,
      assignedToAgentId: chatSessions.assignedToAgentId,
      subject: chatSessions.subject,
      startedAt: chatSessions.startedAt,
    })
    .from(chatSessions)
    .leftJoin(users, eq(chatSessions.userId, users.id))
    .where(eq(chatSessions.status, "active"))
    .orderBy(desc(chatSessions.startedAt));
}

// ========== Canned Responses ==========

export async function createCannedResponse(data: {
  category: string;
  shortcut: string;
  title: string;
  message: string;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { cannedResponses } = await import("../drizzle/schema");

  const result = await db.insert(cannedResponses).values(data).returning();
  return result[0];
}

export async function getAllCannedResponses(category?: string) {
  const db = await getDb();
  if (!db) return [];
  const { cannedResponses } = await import("../drizzle/schema");

  let query = db
    .select()
    .from(cannedResponses)
    .where(eq(cannedResponses.isActive, true))
    .$dynamic();

  if (category) {
    query = query.where(eq(cannedResponses.category, category));
  }

  return await query.orderBy(cannedResponses.category, cannedResponses.title);
}

export async function getCannedResponseByShortcut(shortcut: string) {
  const db = await getDb();
  if (!db) return null;
  const { cannedResponses } = await import("../drizzle/schema");

  const results = await db
    .select()
    .from(cannedResponses)
    .where(and(
      eq(cannedResponses.shortcut, shortcut),
      eq(cannedResponses.isActive, true)
    ))
    .limit(1);

  return results[0] || null;
}

// ========== E-Signatures ==========

export async function createESignatureDocument(data: {
  loanApplicationId: number;
  userId: number;
  documentType: string;
  documentTitle: string;
  documentPath: string;
  signerEmail: string;
  signerName: string;
  expiresAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { eSignatureDocuments } = await import("../drizzle/schema");

  const result = await db.insert(eSignatureDocuments).values({
    ...data,
    status: "pending",
  }).returning();

  return result[0];
}

export async function getESignatureDocument(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { eSignatureDocuments } = await import("../drizzle/schema");

  const results = await db
    .select()
    .from(eSignatureDocuments)
    .where(eq(eSignatureDocuments.id, id))
    .limit(1);

  return results[0] || null;
}

export async function updateESignatureStatus(
  id: number,
  status: string,
  signedDocumentPath?: string,
  ipAddress?: string,
  auditTrail?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { eSignatureDocuments } = await import("../drizzle/schema");

  const updateData: any = {
    status: status as any,
  };

  if (status === "signed") {
    updateData.signedAt = new Date();
    updateData.signedDocumentPath = signedDocumentPath;
    updateData.ipAddress = ipAddress;
    updateData.auditTrail = auditTrail;
  }

  await db
    .update(eSignatureDocuments)
    .set(updateData)
    .where(eq(eSignatureDocuments.id, id));
}

export async function getLoanESignatureDocuments(loanApplicationId: number) {
  const db = await getDb();
  if (!db) return [];
  const { eSignatureDocuments } = await import("../drizzle/schema");

  return await db
    .select()
    .from(eSignatureDocuments)
    .where(eq(eSignatureDocuments.loanApplicationId, loanApplicationId))
    .orderBy(desc(eSignatureDocuments.createdAt));
}

// ========== Marketing & Attribution ==========

export async function createMarketingCampaign(data: {
  campaignName: string;
  source?: string;
  medium?: string;
  campaignCode?: string;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { marketingCampaigns } = await import("../drizzle/schema");

  const result = await db.insert(marketingCampaigns).values(data).returning();
  return result[0];
}

export async function createUserAttribution(data: {
  userId: number;
  campaignId?: number;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrerUrl?: string;
  landingPage?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { userAttribution } = await import("../drizzle/schema");

  const result = await db.insert(userAttribution).values(data).returning();
  return result[0];
}

export async function getUserAttribution(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const { userAttribution } = await import("../drizzle/schema");

  const results = await db
    .select()
    .from(userAttribution)
    .where(eq(userAttribution.userId, userId))
    .limit(1);

  return results[0] || null;
}

export async function getCampaignPerformance(campaignId: number) {
  const db = await getDb();
  if (!db) return null;
  const { userAttribution, users, loanApplications } = await import("../drizzle/schema");

  const attributions = await db
    .select({
      userId: userAttribution.userId,
      createdAt: userAttribution.createdAt,
    })
    .from(userAttribution)
    .where(eq(userAttribution.campaignId, campaignId));

  const userIds = attributions.map(a => a.userId);
  
  if (userIds.length === 0) {
    return {
      totalUsers: 0,
      totalApplications: 0,
      totalApproved: 0,
      conversionRate: 0,
    };
  }

  const applications = await db
    .select()
    .from(loanApplications)
    .where(inArray(loanApplications.userId, userIds));

  return {
    totalUsers: attributions.length,
    totalApplications: applications.length,
    totalApproved: applications.filter(a => a.status === "approved" || a.status === "disbursed").length,
    conversionRate: applications.length / attributions.length,
  };
}

// ========== Delinquency & Collections ==========

export async function createDelinquencyRecord(data: {
  loanApplicationId: number;
  userId: number;
  status: string;
  daysDelinquent: number;
  totalAmountDue: number;
  lastPaymentDate?: Date;
  nextActionDate?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { delinquencyRecords } = await import("../drizzle/schema");

  const result = await db.insert(delinquencyRecords).values({
    ...data,
    status: data.status as any,
  }).returning();

  return result[0];
}

export async function updateDelinquencyRecord(
  id: number,
  data: {
    status?: string;
    daysDelinquent?: number;
    totalAmountDue?: number;
    assignedCollectorId?: number;
    collectionAttempts?: number;
    lastContactDate?: Date;
    lastContactMethod?: string;
    promiseToPayDate?: Date;
    promiseToPayAmount?: number;
    settlementOffered?: boolean;
    settlementAmount?: number;
    notes?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { delinquencyRecords } = await import("../drizzle/schema");

  const updateData: any = { ...data };
  if (data.status) {
    updateData.status = data.status as any;
  }

  const result = await db
    .update(delinquencyRecords)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(delinquencyRecords.id, id))
    .returning();

  return result[0];
}

export async function getActiveDelinquencies() {
  const db = await getDb();
  if (!db) return [];
  const { delinquencyRecords, loanApplications, users } = await import("../drizzle/schema");

  return await db
    .select({
      id: delinquencyRecords.id,
      loanApplicationId: delinquencyRecords.loanApplicationId,
      trackingNumber: loanApplications.trackingNumber,
      userId: delinquencyRecords.userId,
      userName: users.name,
      userEmail: users.email,
      status: delinquencyRecords.status,
      daysDelinquent: delinquencyRecords.daysDelinquent,
      totalAmountDue: delinquencyRecords.totalAmountDue,
      lastContactDate: delinquencyRecords.lastContactDate,
      nextActionDate: delinquencyRecords.nextActionDate,
      assignedCollectorId: delinquencyRecords.assignedCollectorId,
    })
    .from(delinquencyRecords)
    .leftJoin(loanApplications, eq(delinquencyRecords.loanApplicationId, loanApplications.id))
    .leftJoin(users, eq(delinquencyRecords.userId, users.id))
    .orderBy(desc(delinquencyRecords.daysDelinquent));
}

export async function createCollectionAction(data: {
  delinquencyRecordId: number;
  actionType: string;
  performedBy?: number;
  outcome?: string;
  notes?: string;
  nextActionDate?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { collectionActions } = await import("../drizzle/schema");

  const result = await db.insert(collectionActions).values(data).returning();
  return result[0];
}

export async function getCollectionActions(delinquencyRecordId: number) {
  const db = await getDb();
  if (!db) return [];
  const { collectionActions } = await import("../drizzle/schema");

  return await db
    .select()
    .from(collectionActions)
    .where(eq(collectionActions.delinquencyRecordId, delinquencyRecordId))
    .orderBy(desc(collectionActions.actionDate));
}

// ============= Notification Preferences =============

export async function getOrCreateNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { userNotificationSettings } = await import("../drizzle/schema");

  // Try to get existing preferences
  const existing = await db
    .select()
    .from(userNotificationSettings)
    .where(eq(userNotificationSettings.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create default row with all defaults from schema
  const row = await db
    .insert(userNotificationSettings)
    .values({ userId })
    .returning();

  return row[0];
}

export async function updateNotificationPreferences(
  userId: number,
  updates: Partial<{
    paymentReminders: boolean;
    paymentConfirmations: boolean;
    loanStatusUpdates: boolean;
    documentNotifications: boolean;
    promotionalNotifications: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    emailDigest: boolean;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { userNotificationSettings } = await import("../drizzle/schema");

  // Ensure a row exists for this user
  const existing = await db
    .select()
    .from(userNotificationSettings)
    .where(eq(userNotificationSettings.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    // Insert row with updates applied
    const row = await db
      .insert(userNotificationSettings)
      .values({
        userId,
        ...updates,
        updatedAt: new Date(),
      })
      .returning();
    return row[0];
  }

  // Update the existing row
  const result = await db
    .update(userNotificationSettings)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(userNotificationSettings.userId, userId))
    .returning();

  return result[0];
}

// ========== Missing Router Functions ==========

export async function reviewHardshipRequest(
  requestId: number,
  data: {
    status: string;
    approvedDuration?: number;
    approvedPaymentAmount?: number;
    startDate?: Date;
    endDate?: Date;
    adminNotes?: string;
    reviewedBy: number;
  }
) {
  return updateHardshipRequest(requestId, data);
}

/**
 * Check whether a reminder of a given type was already sent recently.
 * Returns the existing log row (with reminderCount) or null.
 */
export async function getRecentEmailReminder(
  userId: number,
  reminderType: string,
  entityId: number | null,
  cooldownMs: number
): Promise<{ id: number; reminderCount: number } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { emailReminderLog } = await import("../drizzle/schema");

  const cutoff = new Date(Date.now() - cooldownMs);

  let rows;
  if (entityId != null) {
    rows = await db
      .select()
      .from(emailReminderLog)
      .where(
        and(
          eq(emailReminderLog.userId, userId),
          eq(emailReminderLog.reminderType, reminderType),
          eq(emailReminderLog.entityId, entityId),
          gt(emailReminderLog.lastSentAt, cutoff)
        )
      )
      .limit(1);
  } else {
    rows = await db
      .select()
      .from(emailReminderLog)
      .where(
        and(
          eq(emailReminderLog.userId, userId),
          eq(emailReminderLog.reminderType, reminderType),
          gt(emailReminderLog.lastSentAt, cutoff)
        )
      )
      .limit(1);
  }

  if (rows && rows.length > 0) {
    return { id: rows[0].id, reminderCount: rows[0].reminderCount };
  }
  return null;
}

/**
 * Get the total reminder count for a user+type+entity combo (lifetime, not just recent).
 */
export async function getEmailReminderCount(
  userId: number,
  reminderType: string,
  entityId: number | null
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { emailReminderLog } = await import("../drizzle/schema");

  let rows;
  if (entityId != null) {
    rows = await db
      .select()
      .from(emailReminderLog)
      .where(
        and(
          eq(emailReminderLog.userId, userId),
          eq(emailReminderLog.reminderType, reminderType),
          eq(emailReminderLog.entityId, entityId)
        )
      )
      .limit(1);
  } else {
    rows = await db
      .select()
      .from(emailReminderLog)
      .where(
        and(
          eq(emailReminderLog.userId, userId),
          eq(emailReminderLog.reminderType, reminderType)
        )
      )
      .limit(1);
  }

  return rows && rows.length > 0 ? rows[0].reminderCount : 0;
}

/**
 * Log or update a sent reminder. Upserts: inserts on first send, bumps count on subsequent.
 */
export async function logEmailReminder(
  userId: number,
  reminderType: string,
  entityId: number | null
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { emailReminderLog } = await import("../drizzle/schema");

  // Check for existing row (any age — lifetime tracking)
  let rows;
  if (entityId != null) {
    rows = await db
      .select()
      .from(emailReminderLog)
      .where(
        and(
          eq(emailReminderLog.userId, userId),
          eq(emailReminderLog.reminderType, reminderType),
          eq(emailReminderLog.entityId, entityId)
        )
      )
      .limit(1);
  } else {
    rows = await db
      .select()
      .from(emailReminderLog)
      .where(
        and(
          eq(emailReminderLog.userId, userId),
          eq(emailReminderLog.reminderType, reminderType)
        )
      )
      .limit(1);
  }

  const now = new Date();

  if (rows && rows.length > 0) {
    // Update existing row
    await db
      .update(emailReminderLog)
      .set({
        reminderCount: rows[0].reminderCount + 1,
        lastSentAt: now,
      })
      .where(eq(emailReminderLog.id, rows[0].id));
  } else {
    // Insert new row
    await db.insert(emailReminderLog).values({
      userId,
      reminderType,
      entityId,
      reminderCount: 1,
      lastSentAt: now,
    });
  }
}

export async function generateTaxDocument(data: {
  userId: number;
  taxYear: number;
  documentType: string;
  loanApplicationId?: number;
}) {
  return createTaxDocument(data);
}

export async function getAllTaxDocuments(taxYear?: number, userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const { taxDocuments } = await import("../drizzle/schema");
  const { and } = await import("drizzle-orm");

  let conditions: any[] = [];
  if (taxYear) conditions.push(eq(taxDocuments.taxYear, taxYear));
  if (userId) conditions.push(eq(taxDocuments.userId, userId));

  if (conditions.length > 0) {
    return db.select().from(taxDocuments).where(and(...conditions));
  }
  return db.select().from(taxDocuments);
}

export async function updateUserNotificationPreferences(
  userId: number,
  updates: Partial<{
    paymentReminders: boolean;
    paymentConfirmations: boolean;
    loanStatusUpdates: boolean;
    documentNotifications: boolean;
    promotionalNotifications: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    emailDigest: boolean;
  }>
) {
  // Delegate to the unified function that uses user_notification_settings table
  return updateNotificationPreferences(userId, updates);
}

export async function getCoSignerInvitationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const { coSigners } = await import("../drizzle/schema");
  const { or } = await import("drizzle-orm");

  return db.select().from(coSigners).where(
    or(
      eq(coSigners.primaryBorrowerId, userId),
      eq(coSigners.coSignerUserId, userId)
    )
  );
}

export async function respondToCoSignerInvitation(
  invitationToken: string,
  accept: boolean,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { coSigners } = await import("../drizzle/schema");

  const result = await db
    .update(coSigners)
    .set({
      status: accept ? ("accepted" as any) : ("declined" as any),
      coSignerUserId: userId,
      respondedAt: new Date(),
    })
    .where(eq(coSigners.invitationToken, invitationToken))
    .returning();

  return result[0];
}

export async function cancelCoSignerInvitation(invitationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { coSigners } = await import("../drizzle/schema");

  await db.delete(coSigners).where(eq(coSigners.id, invitationId));
}

export async function releaseCoSigner(coSignerId: number, releasedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { coSigners } = await import("../drizzle/schema");

  const result = await db
    .update(coSigners)
    .set({
      status: "released" as any,
      releasedAt: new Date(),
      releasedBy,
    })
    .where(eq(coSigners.id, coSignerId))
    .returning();

  return result[0];
}

export async function getUserClosureRequest(userId: number) {
  return getUserAccountClosureRequest(userId);
}

export async function getAllClosureRequests(status?: string) {
  return getAllAccountClosureRequests(status);
}

export async function reviewClosureRequest(
  requestId: number,
  data: {
    status: string;
    adminNotes?: string;
    scheduledDeletionDate?: Date;
    reviewedBy: number;
  }
) {
  return updateAccountClosureRequest(requestId, data);
}

export async function getPaymentPreferences(userId: number, loanApplicationId?: number) {
  return getUserPaymentPreference(userId);
}

export async function updatePaymentPreferences(userId: number, data: {
  loanApplicationId?: number;
  allocationStrategy?: AllocationStrategy;
  roundUpEnabled?: boolean;
  roundUpToNearest?: number;
  biweeklyEnabled?: boolean;
  autoExtraPaymentAmount?: number;
  autoExtraPaymentDay?: number;
}) {
  return createOrUpdatePaymentPreference({ ...data, userId });
}

export async function getPendingFraudChecks() {
  return getPendingFraudReviews();
}

export async function reviewFraudCheck(
  fraudCheckId: number,
  data: { reviewNotes: string; reviewedBy: number }
) {
  return updateFraudCheckReview(fraudCheckId, data.reviewedBy, data.reviewNotes);
}

export async function getLatestFraudCheck(userId: number) {
  const checks = await getFraudChecksByUser(userId);
  return checks.length > 0 ? checks[0] : null;
}

export async function getOrCreateChatSession(userId: number) {
  const existing = await getUserActiveChatSession(userId);
  if (existing) return existing;
  return createChatSession(userId);
}

export async function assignChatSession(sessionId: number, agentId: number) {
  return assignChatToAgent(sessionId, agentId);
}

export async function getCannedResponses() {
  const db = await getDb();
  if (!db) return [];
  const { cannedResponses } = await import("../drizzle/schema");

  return db.select().from(cannedResponses).where(eq(cannedResponses.isActive, true));
}

export async function getUserESignatureDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const { eSignatureDocuments } = await import("../drizzle/schema");

  return db.select().from(eSignatureDocuments).where(eq(eSignatureDocuments.userId, userId));
}

export async function signESignatureDocument(
  documentId: number,
  data: { ipAddress?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { eSignatureDocuments } = await import("../drizzle/schema");

  const result = await db
    .update(eSignatureDocuments)
    .set({
      status: "signed" as any,
      signedAt: new Date(),
      ipAddress: data.ipAddress,
    })
    .where(eq(eSignatureDocuments.id, documentId))
    .returning();

  return result[0];
}

export async function getAllESignatureDocuments(status?: string) {
  const db = await getDb();
  if (!db) return [];
  const { eSignatureDocuments } = await import("../drizzle/schema");

  if (status) {
    return db
      .select()
      .from(eSignatureDocuments)
      .where(eq(eSignatureDocuments.status, status as any));
  }
  return db.select().from(eSignatureDocuments);
}

export async function getAllMarketingCampaigns() {
  const db = await getDb();
  if (!db) return [];
  const { marketingCampaigns } = await import("../drizzle/schema");

  return db.select().from(marketingCampaigns);
}

export async function updateDelinquencyPromise(
  delinquencyRecordId: number,
  data: { promiseToPayDate: Date; promiseToPayAmount: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const { delinquencyRecords } = await import("../drizzle/schema");

  const result = await db
    .update(delinquencyRecords)
    .set({
      promiseToPayDate: data.promiseToPayDate,
      promiseToPayAmount: data.promiseToPayAmount,
      updatedAt: new Date(),
    })
    .where(eq(delinquencyRecords.id, delinquencyRecordId))
    .returning();

  return result[0];
}

// =====================
// Comprehensive Admin User Management Functions
// =====================

export async function listAllUsersWithPagination(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  accountStatus?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  const conditions: any[] = [];
  
  if (params.search) {
    const searchTerm = `%${params.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${users.name}) LIKE ${searchTerm}`,
        sql`LOWER(${users.email}) LIKE ${searchTerm}`,
        sql`LOWER(${users.firstName}) LIKE ${searchTerm}`,
        sql`LOWER(${users.lastName}) LIKE ${searchTerm}`,
        sql`LOWER(${users.phoneNumber}) LIKE ${searchTerm}`
      )
    );
  }

  if (params.role && params.role !== "all") {
    conditions.push(eq(users.role, params.role as any));
  }

  if (params.accountStatus && params.accountStatus !== "all") {
    conditions.push(eq(users.accountStatus, params.accountStatus as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ count: sql`count(*)` }).from(users).where(whereClause);
  const totalCount = Number(countResult[0]?.count || 0);

  // Determine sort column and direction
  const sortColumn = params.sortBy === "name" ? users.name
    : params.sortBy === "email" ? users.email
    : params.sortBy === "role" ? users.role
    : params.sortBy === "lastSignedIn" ? users.lastSignedIn
    : users.createdAt;
  
  const orderFn = params.sortOrder === "asc" ? asc : desc;

  const results = await db.select().from(users).where(whereClause).orderBy(orderFn(sortColumn)).limit(limit).offset(offset);

  return {
    users: results,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  };
}

export async function getUserFullProfile(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const user = await db.select().from(users).where(eq(users.id, userId)).then(rows => rows[0] || null);
  if (!user) return null;

  const { userSessions, loginAttempts } = await import("../drizzle/schema");

  // Run all independent queries in parallel to avoid N+1 sequential roundtrips
  const [loans, userPayments, userDisbursements, sessions, recentLogins, userDocuments, userTickets] = await Promise.all([
    db.select().from(loanApplications).where(eq(loanApplications.userId, userId)).orderBy(desc(loanApplications.createdAt)),
    db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt)),
    db.select().from(disbursements).where(eq(disbursements.userId, userId)).orderBy(desc(disbursements.createdAt)),
    db.select().from(userSessions).where(eq(userSessions.userId, userId)).orderBy(desc(userSessions.lastActivityAt)),
    db.select().from(loginAttempts).where(eq(loginAttempts.email, user.email || "")).orderBy(desc(loginAttempts.createdAt)).limit(20),
    db.select().from(verificationDocuments).where(eq(verificationDocuments.userId, userId)),
    db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.createdAt)),
  ]);

  return {
    ...user,
    loans,
    payments: userPayments,
    disbursements: userDisbursements,
    sessions,
    recentLogins,
    documents: userDocuments,
    supportTickets: userTickets,
  };
}

export async function adminUpdateUserFull(userId: number, updates: {
  name?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  role?: "user" | "admin";
  accountStatus?: "active" | "suspended" | "banned" | "deactivated";
  adminNotes?: string;
  forcePasswordReset?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { updatedAt: new Date() };
  
  if (updates.name !== undefined) updateData.name = updates.name || null;
  if (updates.email !== undefined) updateData.email = updates.email || null;
  if (updates.firstName !== undefined) updateData.firstName = updates.firstName || null;
  if (updates.lastName !== undefined) updateData.lastName = updates.lastName || null;
  if (updates.phoneNumber !== undefined) updateData.phoneNumber = updates.phoneNumber || null;
  if (updates.dateOfBirth !== undefined) updateData.dateOfBirth = updates.dateOfBirth || null;
  if (updates.street !== undefined) updateData.street = updates.street || null;
  if (updates.city !== undefined) updateData.city = updates.city || null;
  if (updates.state !== undefined) updateData.state = updates.state || null;
  if (updates.zipCode !== undefined) updateData.zipCode = updates.zipCode || null;
  if (updates.role !== undefined) updateData.role = updates.role;
  if (updates.accountStatus !== undefined) updateData.accountStatus = updates.accountStatus;
  if (updates.adminNotes !== undefined) updateData.adminNotes = updates.adminNotes;
  if (updates.forcePasswordReset !== undefined) updateData.forcePasswordReset = updates.forcePasswordReset;

  await db.update(users).set(updateData).where(eq(users.id, userId));
}

export async function suspendUser(userId: number, adminId: number, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({
      accountStatus: "suspended",
      suspendedAt: new Date(),
      suspendedReason: reason,
      suspendedBy: adminId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function activateUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({
      accountStatus: "active",
      suspendedAt: null,
      suspendedReason: null,
      suspendedBy: null,
      bannedAt: null,
      bannedReason: null,
      bannedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function banUser(userId: number, adminId: number, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({
      accountStatus: "banned",
      bannedAt: new Date(),
      bannedReason: reason,
      bannedBy: adminId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function deactivateUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ accountStatus: "deactivated", updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function forceLogoutUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { userSessions } = await import("../drizzle/schema");
  await db.delete(userSessions).where(eq(userSessions.userId, userId));
}

export async function setForcePasswordReset(userId: number, force: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ forcePasswordReset: force, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function adminDeleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { userSessions } = await import("../drizzle/schema");
  await db.delete(userSessions).where(eq(userSessions.userId, userId));
  
  const userTickets = await db.select({ id: supportTickets.id }).from(supportTickets).where(eq(supportTickets.userId, userId));
  for (const ticket of userTickets) {
    await db.delete(ticketMessages).where(eq(ticketMessages.ticketId, ticket.id));
  }
  await db.delete(supportTickets).where(eq(supportTickets.userId, userId));
  await db.delete(verificationDocuments).where(eq(verificationDocuments.userId, userId));
  await db.delete(payments).where(eq(payments.userId, userId));
  await db.delete(disbursements).where(eq(disbursements.userId, userId));
  await db.delete(loanApplications).where(eq(loanApplications.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

export async function getUserLoginHistory(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];

  const user = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).then(r => r[0]);
  if (!user?.email) return [];

  const { loginAttempts } = await import("../drizzle/schema");
  return db.select().from(loginAttempts)
    .where(eq(loginAttempts.email, user.email))
    .orderBy(desc(loginAttempts.createdAt))
    .limit(limit);
}

export async function updateAdminNotes(userId: number, notes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ adminNotes: notes, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function resetUserPassword(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ passwordHash: null, forcePasswordReset: true, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

// ============================================
// AUTOMATION RULES
// ============================================

export async function getAutomationRules() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(automationRules).orderBy(automationRules.createdAt);
}

export async function createAutomationRule(data: {
  name: string;
  enabled: boolean;
  type: string;
  conditions: string;
  action: string;
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [rule] = await db.insert(automationRules).values({
    name: data.name,
    enabled: data.enabled,
    type: data.type,
    conditions: data.conditions,
    action: data.action,
    createdBy: data.createdBy || null,
  }).returning();
  return rule;
}

export async function updateAutomationRule(id: number, data: Partial<{
  name: string;
  enabled: boolean;
  type: string;
  conditions: string;
  action: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(automationRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(automationRules.id, id));
}

export async function deleteAutomationRule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(automationRules).where(eq(automationRules.id, id));
}

// ============================================
// DOCUMENT GENERATION HELPERS
// ============================================

export async function getLoanApplicationForDocument(loanId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [loan] = await db.select().from(loanApplications)
    .where(eq(loanApplications.id, loanId));
  
  if (!loan) return null;
  if (loan.userId !== userId) return null;
  
  // Get user info
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  
  return { loan, user };
}

// ============================================
// Job Applications
// ============================================

export async function createJobApplication(data: {
  fullName: string;
  email: string;
  phone: string;
  position: string;
  resumeFileName?: string;
  resumeFileUrl?: string;
  coverLetter: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { jobApplications } = await import("../drizzle/schema");

  const [app] = await db.insert(jobApplications).values({
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    position: data.position,
    resumeFileName: data.resumeFileName,
    resumeFileUrl: data.resumeFileUrl,
    coverLetter: data.coverLetter,
    status: "pending",
  }).returning();

  return app;
}

export async function getAllJobApplications() {
  const db = await getDb();
  if (!db) throw new Error("Database connection unavailable");

  const { jobApplications } = await import("../drizzle/schema");

  return await db.select()
    .from(jobApplications)
    .orderBy(desc(jobApplications.createdAt));
}

export async function getJobApplicationById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const { jobApplications } = await import("../drizzle/schema");

  const [app] = await db.select()
    .from(jobApplications)
    .where(eq(jobApplications.id, id));

  return app || null;
}

export async function updateJobApplicationStatus(
  id: number,
  status: "pending" | "under_review" | "approved" | "rejected",
  adminId: number,
  adminNotes?: string,
  replyMessage?: string,
  rejectionReasons?: string[],
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { jobApplications } = await import("../drizzle/schema");

  const [updated] = await db.update(jobApplications)
    .set({
      status: status as any,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      adminNotes: adminNotes ?? null,
      replyMessage: replyMessage ?? null,
      rejectionReasons: rejectionReasons && rejectionReasons.length > 0 ? JSON.stringify(rejectionReasons) : null,
      updatedAt: new Date(),
    })
    .where(eq(jobApplications.id, id))
    .returning();

  return updated;
}