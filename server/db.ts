import { desc, eq, or, and, sql } from "drizzle-orm";
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
  InsertVerificationDocument
} from "../drizzle/schema";
import { ENV } from './_core/env';
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
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
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
    const result = await db.insert(users).values({
      openId,
      email,
      name: fullName,
      firstName,
      lastName,
      loginMethod: "email",
      role: "user",
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
  
  const result = await db.insert(payments).values(data);
  return result;
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
  
  // Get average loan amount
  const avgAmountResult = await db.select({ avg: sql`AVG(${loanApplications.requestedAmount})` })
    .from(loanApplications);
  
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

export async function enable2FA(userId: number, data: {
  method: string;
  totpSecret?: string | null;
  phoneNumber?: string;
  backupCodes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { twoFactorAuthentication } = await import("../drizzle/schema");
  
  const existing = await get2FASettings(userId);
  
  if (!existing) {
    await db.insert(twoFactorAuthentication).values({
      userId,
      enabled: true,
      method: data.method as any,
      totpSecret: data.totpSecret,
      totpEnabled: data.method === 'totp',
      phoneNumber: data.phoneNumber,
      smsEnabled: data.method === 'sms',
      backupCodes: data.backupCodes,
    });
  } else {
    await db.update(twoFactorAuthentication)
      .set({
        enabled: true,
        method: data.method as any,
        totpSecret: data.totpSecret,
        totpEnabled: data.method === 'totp',
        phoneNumber: data.phoneNumber,
        smsEnabled: data.method === 'sms',
        backupCodes: data.backupCodes,
        updatedAt: new Date(),
      })
      .where(eq(twoFactorAuthentication.userId, userId));
  }
}

export async function disable2FA(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { twoFactorAuthentication } = await import("../drizzle/schema");
  
  await db.update(twoFactorAuthentication)
    .set({
      enabled: false,
      totpEnabled: false,
      smsEnabled: false,
      updatedAt: new Date(),
    })
    .where(eq(twoFactorAuthentication.userId, userId));
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
