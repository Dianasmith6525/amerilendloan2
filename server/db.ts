import { desc, eq, or, and, sql, ilike } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
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
  InsertTicketMessage
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

const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || '0'.repeat(64)).substring(0, 32); // 32 bytes for AES-256

function encryptBankData(data: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8').subarray(0, 32), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptBankData(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8').subarray(0, 32), iv);
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
      console.warn("[Database] Connection lost, attempting to reconnect...");
      _db = null;
      _client = null;
      _connectionStartTime = null;
    }
  }

  // Create new connection
  if (!_db && process.env.DATABASE_URL) {
    try {
      console.log("[Database] Attempting to connect to database...");
      _connectionStartTime = new Date();
      
      const postgresModule = await import("postgres");
      const postgres = postgresModule.default;
      
      // Connection options
      const sslEnabled = process.env.NODE_ENV === 'production';
      console.log(`[Database] SSL mode: ${sslEnabled ? 'ENABLED' : 'DISABLED'}`);
      
      _client = postgres(process.env.DATABASE_URL, {
        ssl: sslEnabled ? 'require' : false,
        idle_timeout: 30, // 30 seconds
        max_lifetime: 60 * 60, // 1 hour
        connect_timeout: 10, // 10 seconds
      });

      // Test connection with timeout
      try {
        await Promise.race([
          _client`SELECT 1`,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Connection test timeout (15s)")), 15000)
          )
        ]);
      } catch (testError) {
        // Connection test failed, but don't fail startup - database might come online later
        const testErrorMsg = testError instanceof Error ? testError.message : String(testError);
        console.warn(`[Database] Connection test failed: ${testErrorMsg} (server will continue)`);
      }
      
      _db = drizzle(_client);
      _lastError = null;
      
      const uptime = new Date().getTime() - _connectionStartTime.getTime();
      console.log(`[Database] ✅ Successfully connected to database (${uptime}ms)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      _lastError = errorMsg;
      console.error("[Database] ❌ Failed to connect:", errorMsg);
      
      // Log detailed error info for debugging
      if (errorMsg.includes('SSL')) {
        console.error("[Database] Tip: SSL error detected. Check your DATABASE_URL format.");
      } else if (errorMsg.includes('ECONNREFUSED')) {
        console.error("[Database] Tip: Connection refused. Is the database server running?");
      } else if (errorMsg.includes('authentication')) {
        console.error("[Database] Tip: Authentication failed. Check database credentials.");
      }
      
      _db = null;
      _client = null;
      _connectionStartTime = null;
    }
  }
  
  if (!process.env.DATABASE_URL) {
    console.warn("[Database] DATABASE_URL not set - database operations will fail");
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
    console.warn("[Database] Cannot upsert user: database not available");
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
      console.log(`✅ [Database] Auto-promoted ${user.email || user.openId} to admin role`);
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
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  try {
    const result = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0];
  } catch (error) {
    console.error("[Database] Error in getUserByEmail:", error instanceof Error ? error.message : error);
    return undefined;
  }
}

export async function createUser(email: string, fullName?: string) {
  const db = await getDb();
  if (!db) {
    console.error("[Database] createUser: Database connection not available");
    throw new Error("Database connection not available");
  }

  try {
    console.log("[Database] createUser: Starting user creation for", email);
    
    // Check if user with this email already exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    if (existingUser.length > 0) {
      console.warn(`[Database] createUser: User with email ${email} already exists`);
      throw new Error(`User with email ${email} already exists`);
    }
    
    // Generate a unique openId for email-based auth (format: email_timestamp_random)
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const openId = `email_${timestamp}_${random}`;
    console.log("[Database] createUser: Generated openId:", openId);

    // Extract first and last name from full name
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
    }
    console.log("[Database] createUser: Names extracted - firstName:", firstName, "lastName:", lastName);

    console.log("[Database] createUser: Inserting user into database...");
    
    // Check if email is admin email - if so, assign admin role
    const userRole = email === COMPANY_INFO.admin.email ? "admin" : "user";
    if (email === COMPANY_INFO.admin.email) {
      console.log(`✅ [Database] Admin email detected - assigning admin role to ${email}`);
    }

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

    console.log("[Database] createUser: User created successfully with ID:", result[0]?.id);
    return result[0];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Database] createUser failed:", errorMessage);
    console.error("[Database] Full error:", error);
    throw error;
  }
}

export async function getUserByEmailOrPhone(identifier: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  // Try to find by email first, or by loginMethod (phone for OTP users)
  const result = await db.select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.loginMethod, identifier)))
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
  
  // Check for existing applications with same DOB and SSN
  const existingApplications = await db.select()
    .from(loanApplications)
    .where(
      and(
        eq(loanApplications.dateOfBirth, dateOfBirth),
        eq(loanApplications.ssn, ssn)
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
      ).catch(err => console.error('[Database] Failed to send application submitted email:', err));
    }
    
    return { ...result, trackingNumber };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error in createLoanApplication";
    console.error("[Database] createLoanApplication error:", errorMsg);
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
          await sendLoanApplicationApprovedEmail(
            application.email,
            application.fullName,
            application.trackingNumber,
            additionalData.approvedAmount,
            additionalData.processingFeeAmount
          );
        }
        break;
      
      case "rejected":
        await sendLoanApplicationRejectedEmail(
          application.email,
          application.fullName,
          application.trackingNumber
        );
        break;
      
      case "fee_pending":
        if (additionalData?.processingFeeAmount) {
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
    console.error('Failed to send status update email:', emailError);
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
    ).catch(err => console.warn("[Audit] Failed to log payment status change:", err));
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
        eq(users.role, "admin"),
        and(
          or(
            sql`LOWER(${users.name}) LIKE ${searchTerm}`,
            sql`LOWER(${users.email}) LIKE ${searchTerm}`
          )
        )
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
  
  // Calculate approval rate
  const totalApps = Number(apps[0]?.count || 0);
  const approvedApps = Number(approved[0]?.count || 0);
  const approvalRate = totalApps > 0 ? (approvedApps / totalApps) * 100 : 0;
  
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
    avgProcessingTime: 24, // Placeholder - would need timestamps to calculate
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
    console.error('Failed to decrypt bank data:', error);
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

export async function removeBankAccount(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { bankAccounts } = await import("../drizzle/schema");
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

export async function deleteAddress(addressId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userAddresses } = await import("../drizzle/schema");
  return db.delete(userAddresses).where(eq(userAddresses.id, addressId));
}

// ============================================
// PHASE 3: KYC/IDENTITY VERIFICATION
// ============================================

export async function getKycVerification(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { kycVerification } = await import("../drizzle/schema");
  const result = await db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateKycVerification(userId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { kycVerification } = await import("../drizzle/schema");
  
  const existing = await getKycVerification(userId);
  
  if (existing) {
    return db.update(kycVerification).set(data).where(eq(kycVerification.userId, userId));
  }
  
  return db.insert(kycVerification).values({
    userId,
    ...data,
  });
}

export async function uploadDocument(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { uploadedDocuments } = await import("../drizzle/schema");
  return db.insert(uploadedDocuments).values(data);
}

export async function getUserDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { uploadedDocuments } = await import("../drizzle/schema");
  return db.select().from(uploadedDocuments).where(eq(uploadedDocuments.userId, userId)).orderBy(desc(uploadedDocuments.createdAt));
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

export async function createDelinquencyRecord(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { delinquencyRecords } = await import("../drizzle/schema");
  
  const existing = await db.select().from(delinquencyRecords)
    .where(eq(delinquencyRecords.loanApplicationId, data.loanApplicationId)).limit(1);
  
  if (existing.length > 0) {
    return db.update(delinquencyRecords).set(data)
      .where(eq(delinquencyRecords.loanApplicationId, data.loanApplicationId));
  }
  
  return db.insert(delinquencyRecords).values(data);
}

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
            sql`DATE(${paymentSchedules.dueDate}) >= ${sql.raw(`'${targetDateStr}'`)}`
          ),
          and(
            sql`DATE(${paymentSchedules.dueDate}) < ${sql.raw(`'${nextDayStr}'`)}`
          ),
          or(
            sql`${loanApplications.status} != 'delinquent'`,
            sql`${loanApplications.status} != 'defaulted'`
          )
        )
      );
    
    return result;
  } catch (error) {
    console.error("[db.getPaymentsDueReminder] Error:", error);
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
      daysOverdue: sql<number>`EXTRACT(DAY FROM (${sql.raw(`'${today}'::date`)} - DATE(${paymentSchedules.dueDate})))`,
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
          sql`DATE(${paymentSchedules.dueDate}) < ${sql.raw(`'${today}'::date`)}`
        )
      );
    
    // Filter in memory for day range (since SQL filtering requires complex date arithmetic)
    return result.filter((r: any) => {
      const daysOverdue = r.daysOverdue || 0;
      return daysOverdue >= minDays && daysOverdue <= maxDays;
    });
  } catch (error) {
    console.error("[db.getOverduePayments] Error:", error);
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
      daysOverdue: sql<number>`EXTRACT(DAY FROM (${sql.raw(`'${today}'::date`)} - DATE(${paymentSchedules.dueDate})))`,
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
          sql`DATE(${paymentSchedules.dueDate}) < ${sql.raw(`'${today}'::date`)}`
        )
      );
    
    // Filter in memory for days (since SQL filtering requires complex date arithmetic)
    return result.filter((r: any) => {
      const daysOverdue = r.daysOverdue || 0;
      return daysOverdue >= minDays;
    });
  } catch (error) {
    console.error("[db.getDelinquentPayments] Error:", error);
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
    console.error("[db.markLoanAsDelinquent] Error:", error);
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
    console.error("[db.getSystemConfig] Error:", error);
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
    console.error("[db.updateSystemConfig] Error:", error);
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
    console.error("[db.saveAPIKey] Error:", error);
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
    console.error("[db.getAPIKey] Error:", error);
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
    console.error("[db.getAPIKeysByProvider] Error:", error);
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
    console.error("[db.saveEmailConfig] Error:", error);
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
    console.error("[db.getEmailConfig] Error:", error);
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
    console.error("[db.getNotificationSettings] Error:", error);
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
    console.error("[db.updateNotificationSettings] Error:", error);
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
    console.error("[db.getCryptoWalletSettings] Error:", error);
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
    console.error("[db.updateCryptoWalletSettings] Error:", error);
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
  bankAccountId: string | null;
  cardLast4: string | null;
  paymentDay: number;
  amount: number;
  nextPaymentDate: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const { autoPaySettings } = await import("../drizzle/schema");

  const result = await db.insert(autoPaySettings).values({
    ...data,
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
