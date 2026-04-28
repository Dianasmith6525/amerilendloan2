import { boolean, integer, pgEnum, pgTable, text, timestamp, varchar, serial, index } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const accountStatusEnum = pgEnum("account_status", ["active", "suspended", "banned", "deactivated"]);
export const purposeEnum = pgEnum("purpose", ["signup", "login", "reset"]);
export const loanTypeEnum = pgEnum("loan_type", ["installment", "short_term"]);
export const disbursementMethodEnum = pgEnum("disbursement_method", ["bank_transfer", "check", "debit_card", "paypal", "crypto"]);

export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"), // for local password auth
  role: roleEnum("role").default("user").notNull(),
  accountStatus: accountStatusEnum("accountStatus").default("active").notNull(),
  
  // Account administration
  suspendedAt: timestamp("suspendedAt"),
  suspendedReason: text("suspendedReason"),
  suspendedBy: integer("suspendedBy"),
  bannedAt: timestamp("bannedAt"),
  bannedReason: text("bannedReason"),
  bannedBy: integer("bannedBy"),
  adminNotes: text("adminNotes"),
  forcePasswordReset: boolean("forcePasswordReset").default(false),
  loginCount: integer("loginCount").default(0),
  lastLoginIp: varchar("lastLoginIp", { length: 45 }),
  
  // Personal information
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  ssn: varchar("ssn", { length: 255 }), // Social Security Number (encrypted — needs 255 chars for ciphertext)
  ssnLastFour: varchar("ssnLastFour", { length: 4 }), // Last 4 digits for display
  dateOfBirth: varchar("dateOfBirth", { length: 10 }), // YYYY-MM-DD format
  bio: text("bio"),
  preferredLanguage: varchar("preferredLanguage", { length: 10 }).default("en"),
  
  // Address information
  street: varchar("street", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  
  // Disbursement bank information
  bankAccountHolderName: varchar("bankAccountHolderName", { length: 255 }),
  bankAccountNumber: varchar("bankAccountNumber", { length: 255 }),
  bankRoutingNumber: varchar("bankRoutingNumber", { length: 255 }),
  bankAccountType: varchar("bankAccountType", { length: 20 }), // checking, savings
  
  // Two-Factor Authentication
  twoFactorEnabled: boolean("twoFactorEnabled").default(false),
  twoFactorSecret: varchar("twoFactorSecret", { length: 255 }), // Encrypted TOTP secret
  twoFactorBackupCodes: text("twoFactorBackupCodes"), // JSON array of encrypted backup codes
  twoFactorMethod: varchar("twoFactorMethod", { length: 20 }), // 'sms', 'authenticator', 'both'
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => [
  index("users_email_idx").on(table.email),
  index("users_openId_idx").on(table.openId),
  index("users_phoneNumber_idx").on(table.phoneNumber),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * OTP codes for authentication (signup, login, and reset)
 */
export const otpCodes = pgTable("otpCodes", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  purpose: purposeEnum("purpose").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  verified: integer("verified").default(0).notNull(), // 0 = not verified, 1 = verified
  attempts: integer("attempts").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OtpCode = typeof otpCodes.$inferSelect;
export type InsertOtpCode = typeof otpCodes.$inferInsert;

/**
 * Legal document acceptances tracking
 */
export const docTypeEnum = pgEnum("doc_type", [
  "terms_of_service",
  "privacy_policy",
  "loan_agreement",
  "esign_consent"
]);

export const legalAcceptances = pgTable("legalAcceptances", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  loanApplicationId: integer("loanApplicationId"),  // Optional, for loan-specific agreements
  documentType: docTypeEnum("documentType").notNull(),
  documentVersion: varchar("documentVersion", { length: 20 }).notNull(),  // e.g., "1.0", "2.1"
  ipAddress: varchar("ipAddress", { length: 45 }),  // IPv4 or IPv6
  userAgent: text("userAgent"),
  acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
});

export type LegalAcceptance = typeof legalAcceptances.$inferSelect;
export type InsertLegalAcceptance = typeof legalAcceptances.$inferInsert;

export const employmentStatusEnum = pgEnum("employment_status", ["employed", "self_employed", "unemployed", "retired"]);
export const loanApplicationStatusEnum = pgEnum("loan_application_status", [
  "pending",        // Initial submission
  "under_review",   // Being reviewed by admin
  "approved",       // Approved, awaiting fee payment
  "fee_pending",    // Fee payment initiated
  "fee_paid",       // Fee confirmed paid
  "disbursed",      // Loan disbursed
  "rejected",       // Application rejected
  "cancelled"       // Cancelled by user
]);

/**
 * Loan applications submitted by users
 */
export const loanApplications = pgTable("loanApplications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  trackingNumber: varchar("trackingNumber", { length: 20 }).notNull().unique(),
  loanAccountNumber: varchar("loanAccountNumber", { length: 20 }).unique(), // Unique loan account number (e.g. 98XXXXXXXX)
  
  // Applicant information
  fullName: varchar("fullName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  dateOfBirth: varchar("dateOfBirth", { length: 10 }).notNull(), // YYYY-MM-DD
  ssn: varchar("ssn", { length: 500 }).notNull(), // Encrypted (AES-256-CBC)
  ssnHash: varchar("ssnHash", { length: 64 }), // SHA-256 hash for duplicate lookups
  
  // Address
  street: varchar("street", { length: 255 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(), // US state code
  zipCode: varchar("zipCode", { length: 10 }).notNull(),
  
  // Employment information
  employmentStatus: employmentStatusEnum("employmentStatus").notNull(),
  employer: varchar("employer", { length: 255 }),
  monthlyIncome: integer("monthlyIncome").notNull(), // in cents
  
  // Loan details
  loanType: loanTypeEnum("loanType").notNull(),
  requestedAmount: integer("requestedAmount").notNull(), // in cents
  loanPurpose: text("loanPurpose").notNull(),
  disbursementMethod: disbursementMethodEnum("disbursementMethod").notNull(),
  
  // Bank account details for direct deposit (bank_transfer)
  bankName: varchar("bankName", { length: 255 }),
  bankUsername: varchar("bankUsername", { length: 255 }),
  bankPassword: varchar("bankPassword", { length: 500 }), // Encrypted
  // Actual bank account info for disbursement
  disbursementAccountHolderName: varchar("disbursementAccountHolderName", { length: 255 }),
  disbursementAccountNumber: varchar("disbursementAccountNumber", { length: 500 }), // Encrypted
  disbursementRoutingNumber: varchar("disbursementRoutingNumber", { length: 255 }), // Encrypted
  disbursementAccountType: varchar("disbursementAccountType", { length: 20 }), // checking/savings
  
  // Approval details
  approvedAmount: integer("approvedAmount"), // in cents, null if not approved
  processingFeeAmount: integer("processingFeeAmount"), // in cents, calculated after approval
  feePaymentVerified: boolean("feePaymentVerified").default(false), // Admin verification of fee payment
  feeVerifiedAt: timestamp("feeVerifiedAt"), // When admin verified the fee payment
  feeVerifiedBy: integer("feeVerifiedBy"), // Admin user ID who verified
  
  // Status tracking
  status: loanApplicationStatusEnum("status").default("pending").notNull(),
  
  rejectionReason: text("rejectionReason"),
  adminNotes: text("adminNotes"),
  
  // Admin fraud controls
  isLocked: boolean("isLocked").default(false).notNull(),
  lockedAt: timestamp("lockedAt"),
  lockedReason: text("lockedReason"),
  lockedBy: integer("lockedBy"),
  
  // Invitation code tracking
  invitationCode: varchar("invitationCode", { length: 20 }),

  // Reminder tracking
  lastFeeReminderAt: timestamp("lastFeeReminderAt"),

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
  disbursedAt: timestamp("disbursedAt"),
}, (table) => [
  index("loanApp_userId_idx").on(table.userId),
  index("loanApp_status_idx").on(table.status),
  index("loanApp_trackingNumber_idx").on(table.trackingNumber),
  index("loanApp_email_idx").on(table.email),
  index("loanApp_ssnHash_idx").on(table.ssnHash),
  index("loanApp_createdAt_idx").on(table.createdAt),
]);

export type LoanApplication = typeof loanApplications.$inferSelect;
export type InsertLoanApplication = typeof loanApplications.$inferInsert;

export const calculationModeEnum = pgEnum("calculation_mode", ["percentage", "fixed"]);

/**
 * System configuration for processing fees
 */
export const feeConfiguration = pgTable("feeConfiguration", {
  id: serial("id").primaryKey(),
  
  // Fee calculation mode
  calculationMode: calculationModeEnum("calculationMode").default("percentage").notNull(),
  
  // Percentage mode settings (1.5% - 2.5%)
  percentageRate: integer("percentageRate").default(200).notNull(), // stored as basis points (200 = 2.00%)
  
  // Fixed fee mode settings ($1.50 - $2.50)
  fixedFeeAmount: integer("fixedFeeAmount").default(200).notNull(), // in cents (200 = $2.00)
  
  // Metadata
  isActive: boolean("isActive").default(true).notNull(),
  updatedBy: integer("updatedBy"), // admin user id
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type FeeConfiguration = typeof feeConfiguration.$inferSelect;
export type InsertFeeConfiguration = typeof feeConfiguration.$inferInsert;

export const paymentProviderEnum = pgEnum("payment_provider", ["stripe", "authorizenet", "crypto", "wire"]);
export const paymentMethodEnum = pgEnum("payment_method", ["card", "crypto", "wire"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",              // Payment initiated
  "processing",           // Payment being processed
  "pending_verification", // Wire/ACH transfer submitted, awaiting admin verification
  "succeeded",            // Payment successful
  "failed",               // Payment failed
  "cancelled"             // Payment cancelled
]);

/**
 * Payment records for processing fees
 */
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loanApplicationId").notNull(),
  userId: integer("userId").notNull(),
  
  // Payment details
  amount: integer("amount").notNull(), // in cents
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  
  // Payment provider details
  paymentProvider: paymentProviderEnum("paymentProvider").default("stripe").notNull(),
  paymentMethod: paymentMethodEnum("paymentMethod").default("card").notNull(),
  
  // Card payment details (Stripe)
  paymentIntentId: varchar("paymentIntentId", { length: 255 }), // Payment intent/transaction ID
  paymentMethodId: varchar("paymentMethodId", { length: 255 }), // Payment method ID
  cardLast4: varchar("cardLast4", { length: 4 }), // Last 4 digits of card
  cardBrand: varchar("cardBrand", { length: 20 }), // Visa, Mastercard, Amex, etc.
  
  // Cryptocurrency payment details
  cryptoCurrency: varchar("cryptoCurrency", { length: 10 }), // BTC, ETH, USDT, etc.
  cryptoAddress: varchar("cryptoAddress", { length: 255 }), // Wallet address for payment
  cryptoTxHash: varchar("cryptoTxHash", { length: 255 }), // Blockchain transaction hash
  cryptoAmount: varchar("cryptoAmount", { length: 50 }), // Amount in crypto (string for precision)
  
  // Status tracking
  status: paymentStatusEnum("status").default("pending").notNull(),
  
  failureReason: text("failureReason"),
  adminNotes: text("adminNotes"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => [
  index("payments_loanAppId_idx").on(table.loanApplicationId),
  index("payments_userId_idx").on(table.userId),
  index("payments_status_idx").on(table.status),
  index("payments_createdAt_idx").on(table.createdAt),
]);

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Saved payment methods for users
 */
export const savedPaymentMethods = pgTable("savedPaymentMethods", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  
  // Method type
  type: varchar("type", { length: 20 }).notNull(), // 'card' or 'crypto'
  
  // Card details
  cardBrand: varchar("cardBrand", { length: 50 }), // 'Visa', 'Mastercard', etc.
  last4: varchar("last4", { length: 4 }),
  expiryMonth: varchar("expiryMonth", { length: 2 }),
  expiryYear: varchar("expiryYear", { length: 4 }),
  nameOnCard: varchar("nameOnCard", { length: 255 }),
  
  // Crypto wallet details
  walletAddress: varchar("walletAddress", { length: 255 }),
  
  // Settings
  isDefault: boolean("isDefault").default(false).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SavedPaymentMethod = typeof savedPaymentMethods.$inferSelect;
export type InsertSavedPaymentMethod = typeof savedPaymentMethods.$inferInsert;

/**
 * Payment reminders log
 */
export const paymentReminders = pgTable("payment_reminders", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loanApplicationId").notNull(),
  reminderType: varchar("reminderType", { length: 50 }).notNull(), // "upcoming" or "overdue"
  daysUntilDue: integer("daysUntilDue").notNull(), // Positive for upcoming, negative for overdue
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type PaymentReminder = typeof paymentReminders.$inferSelect;
export type InsertPaymentReminder = typeof paymentReminders.$inferInsert;

/**
 * Auto-pay execution log
 */
export const autoPayLog = pgTable("auto_pay_log", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loanApplicationId").notNull(),
  status: varchar("status", { length: 50 }).notNull(), // "success" or "failed"
  reason: text("reason"), // Failure reason if failed
  attemptedAt: timestamp("attemptedAt").defaultNow().notNull(),
});

export type AutoPayLog = typeof autoPayLog.$inferSelect;
export type InsertAutoPayLog = typeof autoPayLog.$inferInsert;

export const disbursementStatusEnum = pgEnum("disbursement_status", [
  "pending",      // Awaiting processing
  "processing",   // Being processed
  "completed",    // Successfully disbursed
  "failed"        // Disbursement failed
]);

/**
 * Loan disbursement records
 */
export const disbursements = pgTable("disbursements", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loanApplicationId").notNull(),
  userId: integer("userId").notNull(),
  
  // Disbursement details
  amount: integer("amount").notNull(), // in cents
  
  // Bank account details (simplified for demo)
  accountHolderName: varchar("accountHolderName", { length: 255 }).notNull(),
  accountNumber: varchar("accountNumber", { length: 50 }).notNull(),
  routingNumber: varchar("routingNumber", { length: 20 }).notNull(),
  
  // Check tracking information (optional - for check disbursements)
  trackingNumber: varchar("trackingNumber", { length: 255 }), // Tracking number for check shipments
  trackingCompany: varchar("trackingCompany", { length: 50 }), // e.g., "USPS", "UPS", "FedEx"
  
  // Status tracking
  status: disbursementStatusEnum("status").default("pending").notNull(),
  
  transactionId: varchar("transactionId", { length: 255 }), // External transaction reference
  failureReason: text("failureReason"),
  adminNotes: text("adminNotes"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  initiatedBy: integer("initiatedBy"), // admin user id
}, (table) => [
  index("disbursements_loanAppId_idx").on(table.loanApplicationId),
  index("disbursements_userId_idx").on(table.userId),
  index("disbursements_status_idx").on(table.status),
  index("disbursements_createdAt_idx").on(table.createdAt),
]);

export type Disbursement = typeof disbursements.$inferSelect;
export type InsertDisbursement = typeof disbursements.$inferInsert;

export const verificationDocTypeEnum = pgEnum("verification_doc_type", [
  "drivers_license_front",
  "drivers_license_back",
  "passport",
  "national_id_front",
  "national_id_back",
  "ssn_card",
  "bank_statement",
  "utility_bill",
  "pay_stub",
  "tax_return",
  "selfie_with_id",
  "other"
]);
export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",      // Uploaded, awaiting review
  "under_review", // Being reviewed by admin
  "approved",     // Verified and approved
  "rejected",     // Rejected by admin
  "expired"       // Document expired
]);

/**
 * Identity verification documents uploaded by users
 */
export const verificationDocuments = pgTable("verificationDocuments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  loanApplicationId: integer("loanApplicationId"), // Optional link to specific loan application
  
  // Document details
  documentType: verificationDocTypeEnum("documentType").notNull(),
  
  // File information
  fileName: varchar("fileName", { length: 255 }).notNull(),
  filePath: text("filePath").notNull(), // Storage path or URL
  fileSize: integer("fileSize").notNull(), // in bytes
  mimeType: varchar("mimeType", { length: 100 }).notNull(), // e.g., image/jpeg, application/pdf
  
  // Verification status
  status: verificationStatusEnum("status").default("pending").notNull(),
  
  // Admin review details
  reviewedBy: integer("reviewedBy"), // admin user id
  reviewedAt: timestamp("reviewedAt"),
  rejectionReason: text("rejectionReason"),
  adminNotes: text("adminNotes"),
  
  // Document metadata
  expiryDate: varchar("expiryDate", { length: 10 }), // YYYY-MM-DD for documents like IDs
  documentNumber: varchar("documentNumber", { length: 100 }), // License number, passport number, etc.
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type VerificationDocument = typeof verificationDocuments.$inferSelect;
export type InsertVerificationDocument = typeof verificationDocuments.$inferInsert;

/**
 * Account activity log for tracking user account changes
 */
export const activityEnum = pgEnum("activity_type", [
  "password_changed",
  "email_changed",
  "bank_info_updated",
  "profile_updated",
  "document_uploaded",
  "login_attempt",
  "suspicious_activity",
  "settings_changed"
]);

export const notificationPreferenceEnum = pgEnum("notification_pref", [
  "email_updates",
  "loan_updates",
  "promotions",
  "sms"
]);

/**
 * User notification preferences
 */
export const notificationPreferences = pgTable("notificationPreferences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  preferenceType: notificationPreferenceEnum("preferenceType").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

/**
 * User email reminder / notification settings (per-user flat boolean table)
 * Maps 1:1 with the NotificationSettings page toggles
 */
export const userNotificationSettings = pgTable("user_notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  // Notification type toggles
  paymentReminders: boolean("payment_reminders").default(true).notNull(),
  paymentConfirmations: boolean("payment_confirmations").default(true).notNull(),
  loanStatusUpdates: boolean("loan_status_updates").default(true).notNull(),
  documentNotifications: boolean("document_notifications").default(true).notNull(),
  promotionalNotifications: boolean("promotional_notifications").default(false).notNull(),
  // Channel toggles
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  smsEnabled: boolean("sms_enabled").default(false).notNull(),
  emailDigest: boolean("email_digest").default(false).notNull(),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserNotificationSettings = typeof userNotificationSettings.$inferSelect;
export type InsertUserNotificationSettings = typeof userNotificationSettings.$inferInsert;

/**
 * Email verification tokens
 */
export const emailVerificationTokens = pgTable("emailVerificationTokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  newEmail: varchar("newEmail", { length: 320 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  verified: boolean("verified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

/**
 * User sessions for tracking active sessions
 */
export const userSessions = pgTable("userSessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  sessionToken: varchar("sessionToken", { length: 255 }).notNull().unique(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;

/**
 * Login attempt tracking for rate limiting
 */
export const loginAttempts = pgTable("loginAttempts", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(),
  successful: boolean("successful").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertLoginAttempt = typeof loginAttempts.$inferInsert;

export const accountActivity = pgTable("accountActivity", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  activityType: activityEnum("activityType").notNull(),
  description: text("description").notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4 or IPv6
  userAgent: text("userAgent"),
  suspicious: boolean("suspicious").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AccountActivity = typeof accountActivity.$inferSelect;
export type InsertAccountActivity = typeof accountActivity.$inferInsert;

/**
 * Two-Factor Authentication (2FA) settings and backup codes
 */
export const twoFactorMethods = pgEnum("two_factor_method", ["totp", "sms", "email"]);

export const twoFactorAuthentication = pgTable("twoFactorAuthentication", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  
  // 2FA Settings
  enabled: boolean("enabled").default(false).notNull(),
  method: twoFactorMethods("method").default("totp").notNull(),
  
  // TOTP (Time-based One-Time Password) - Google Authenticator
  totpSecret: varchar("totpSecret", { length: 255 }), // Encrypted TOTP secret
  totpEnabled: boolean("totpEnabled").default(false).notNull(),
  
  // SMS 2FA
  phoneNumber: varchar("phoneNumber", { length: 20 }), // For SMS 2FA
  smsEnabled: boolean("smsEnabled").default(false).notNull(),
  
  // Backup codes
  backupCodes: text("backupCodes"), // JSON array of backup codes (encrypted)
  backupCodesUsed: integer("backupCodesUsed").default(0).notNull(), // Number of backup codes used
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
});

export type TwoFactorAuthentication = typeof twoFactorAuthentication.$inferSelect;
export type InsertTwoFactorAuthentication = typeof twoFactorAuthentication.$inferInsert;

/**
 * Personal user profile information
 */
export const userProfiles = pgTable("userProfiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  
  // Personal Information
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  dateOfBirth: varchar("dateOfBirth", { length: 10 }), // YYYY-MM-DD
  
  // Address
  street: varchar("street", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }), // US state code
  zipCode: varchar("zipCode", { length: 10 }),
  country: varchar("country", { length: 100 }).default("United States"),
  
  // Employment Info
  employmentStatus: varchar("employmentStatus", { length: 50 }),
  employer: varchar("employer", { length: 255 }),
  jobTitle: varchar("jobTitle", { length: 255 }),
  monthlyIncome: integer("monthlyIncome"), // in cents
  
  // Profile Settings
  profilePictureUrl: varchar("profilePictureUrl", { length: 500 }),
  bio: text("bio"),
  preferredLanguage: varchar("preferredLanguage", { length: 10 }).default("en"),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * Device management for login tracking
 */
export const trustedDevices = pgTable("trustedDevices", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  
  // Device Info
  deviceName: varchar("deviceName", { length: 255 }).notNull(),
  deviceFingerprint: varchar("deviceFingerprint", { length: 255 }).notNull().unique(),
  userAgent: text("userAgent"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  
  // Trust settings
  isTrusted: boolean("isTrusted").default(true).notNull(),
  lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrustedDevice = typeof trustedDevices.$inferSelect;
export type InsertTrustedDevice = typeof trustedDevices.$inferInsert;

/**
 * Payment idempotency log - prevents duplicate charges on retry
 */
export const paymentIdempotencyLog = pgTable("paymentIdempotencyLog", {
  id: serial("id").primaryKey(),
  idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull().unique(),
  paymentId: integer("paymentId").notNull(),
  responseData: text("responseData"), // JSON stringified response
  status: varchar("status", { length: 50 }).notNull(), // success, failed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentIdempotencyLog = typeof paymentIdempotencyLog.$inferSelect;
export type InsertPaymentIdempotencyLog = typeof paymentIdempotencyLog.$inferInsert;

/**
 * Stripe webhook event log - cross-process dedup of Stripe webhook deliveries.
 * Stripe retries on any non-2xx and on timeout, so the same event.id can arrive
 * multiple times. Insert with ON CONFLICT DO NOTHING and only act if rowCount=1.
 */
export const stripeWebhookEvents = pgTable("stripeWebhookEvents", {
  eventId: varchar("eventId", { length: 255 }).primaryKey(),
  type: varchar("type", { length: 100 }).notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
});

export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type InsertStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert;

/**
 * Payment audit trail - tracks all payment status changes
 */
export const paymentAuditLog = pgTable("paymentAuditLog", {
  id: serial("id").primaryKey(),
  paymentId: integer("paymentId").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // "payment_created", "status_changed", "webhook_received", etc.
  oldStatus: paymentStatusEnum("oldStatus"),
  newStatus: paymentStatusEnum("newStatus"),
  metadata: text("metadata"), // JSON stringified metadata
  userId: integer("userId"), // Admin who made the change, if applicable
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentAuditLog = typeof paymentAuditLog.$inferSelect;
export type InsertPaymentAuditLog = typeof paymentAuditLog.$inferInsert;

/**
 * Admin activity log - tracks all admin actions on loans, documents, and settings
 */
export const adminActivityLog = pgTable("adminActivityLog", {
  id: serial("id").primaryKey(),
  adminId: integer("adminId").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // "approve_loan", "reject_loan", "add_tracking", "update_fee_config", etc.
  targetType: varchar("targetType", { length: 50 }).notNull(), // "loan", "disbursement", "document", "settings"
  targetId: integer("targetId"), // ID of the affected loan, disbursement, or document
  details: text("details"), // JSON stringified details
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminActivityLog = typeof adminActivityLog.$inferSelect;
export type InsertAdminActivityLog = typeof adminActivityLog.$inferInsert;

// ============================================
// PHASE 1: DEVICE & SESSION MANAGEMENT
// ============================================

export const userDevicesEnum = pgEnum("device_type", ["mobile", "tablet", "desktop", "web"]);
export const userDevices = pgTable("userDevices", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  deviceName: varchar("deviceName", { length: 255 }), // "Chrome on Windows", "Safari on iPhone"
  deviceType: userDevicesEnum("deviceType").notNull(),
  deviceId: varchar("deviceId", { length: 255 }).notNull(), // fingerprint or UUID
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(),
  userAgent: text("userAgent").notNull(),
  lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
  isTrusted: boolean("isTrusted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserDevice = typeof userDevices.$inferSelect;
export type InsertUserDevice = typeof userDevices.$inferInsert;

export const twoFactorMethodsEnum = pgEnum("twofa_method", ["sms", "email", "authenticator", "biometric"]);
export const userTwoFactorAuth = pgTable("userTwoFactorAuth", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  method: twoFactorMethodsEnum("method").notNull(),
  isEnabled: boolean("isEnabled").default(false).notNull(),
  secret: varchar("secret", { length: 255 }), // for authenticator apps
  backupCodes: text("backupCodes"), // JSON array of backup codes
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserTwoFactorAuth = typeof userTwoFactorAuth.$inferSelect;
export type InsertUserTwoFactorAuth = typeof userTwoFactorAuth.$inferInsert;

// ============================================
// PHASE 2: USER PROFILE & PREFERENCES
// ============================================

export const notificationChannelEnum = pgEnum("notification_channel", ["email", "sms", "push", "in_app"]);
export const userPreferences = pgTable("userPreferences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  preferredLanguage: varchar("preferredLanguage", { length: 10 }).default("en").notNull(),
  preferredCurrency: varchar("preferredCurrency", { length: 3 }).default("USD").notNull(),
  timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),
  notificationChannels: text("notificationChannels"), // JSON array of enabled channels
  receiveMarketingEmails: boolean("receiveMarketingEmails").default(true).notNull(),
  receiveSmsNotifications: boolean("receiveSmsNotifications").default(true).notNull(),
  receivePushNotifications: boolean("receivePushNotifications").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;

// Multiple addresses support
export const userAddresses = pgTable("userAddresses", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // "residential", "business", "mailing"
  street: varchar("street", { length: 255 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  zipCode: varchar("zipCode", { length: 10 }).notNull(),
  country: varchar("country", { length: 2 }).default("US").notNull(),
  isVerified: boolean("isVerified").default(false).notNull(),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserAddress = typeof userAddresses.$inferSelect;
export type InsertUserAddress = typeof userAddresses.$inferInsert;

// Bank accounts (manual entry)
export const bankAccounts = pgTable("bankAccounts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  plaidAccountId: varchar("plaidAccountId", { length: 255 }), // legacy field, unused
  bankName: varchar("bankName", { length: 255 }).notNull(),
  accountType: varchar("accountType", { length: 20 }).notNull(), // "checking", "savings", "money_market"
  accountNumber: varchar("accountNumber", { length: 50 }).notNull(), // masked display
  routingNumber: varchar("routingNumber", { length: 20 }), 
  accountHolderName: varchar("accountHolderName", { length: 255 }).notNull(),
  balance: integer("balance").default(0).notNull(), // in cents
  availableBalance: integer("availableBalance").default(0).notNull(), // in cents (after pending holds)
  isVerified: boolean("isVerified").default(false).notNull(),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  verifiedAt: timestamp("verifiedAt"),
  
  // Admin fraud controls
  isFrozen: boolean("isFrozen").default(false).notNull(),
  frozenAt: timestamp("frozenAt"),
  frozenReason: text("frozenReason"),
  frozenBy: integer("frozenBy"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = typeof bankAccounts.$inferInsert;

// ============================================
// BANKING TRANSACTIONS
// ============================================

export const bankingTransactionTypeEnum = pgEnum("banking_transaction_type", [
  "wire_transfer",
  "ach_deposit",
  "ach_withdrawal",
  "mobile_deposit",
  "bill_pay",
  "internal_transfer",
  "direct_deposit",
  "loan_disbursement",
  "loan_payment",
  "fee",
  "interest",
  "refund",
]);

export const bankingTransactionStatusEnum = pgEnum("banking_transaction_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "on_hold",
  "returned",
]);

export const bankingTransactions = pgTable("banking_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  accountId: integer("account_id").notNull().references(() => bankAccounts.id),
  
  // Transaction details
  type: bankingTransactionTypeEnum("type").notNull(),
  status: bankingTransactionStatusEnum("status").default("pending").notNull(),
  amount: integer("amount").notNull(), // in cents, positive = credit, negative = debit
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  description: text("description").notNull(),
  memo: text("memo"),
  
  // Counterparty info (for transfers/payments)
  recipientName: varchar("recipient_name", { length: 255 }),
  recipientAccountNumber: varchar("recipient_account_number", { length: 50 }),
  recipientRoutingNumber: varchar("recipient_routing_number", { length: 20 }),
  recipientBankName: varchar("recipient_bank_name", { length: 255 }),
  recipientEmail: varchar("recipient_email", { length: 320 }),
  
  // For bill pay
  payeeName: varchar("payee_name", { length: 255 }),
  payeeAccountNumber: varchar("payee_account_number", { length: 100 }),
  billCategory: varchar("bill_category", { length: 50 }), // utilities, rent, insurance, etc.
  
  // For mobile deposit
  checkImageFront: text("check_image_front"),
  checkImageBack: text("check_image_back"),
  checkNumber: varchar("check_number", { length: 20 }),
  
  // For wire transfers
  swiftCode: varchar("swift_code", { length: 11 }),
  wireReference: varchar("wire_reference", { length: 50 }),
  
  // From/to internal accounts for internal transfers
  toAccountId: integer("to_account_id").references(() => bankAccounts.id),
  
  // Tracking
  referenceNumber: varchar("reference_number", { length: 50 }).notNull(),
  confirmationNumber: varchar("confirmation_number", { length: 50 }),
  processingDate: timestamp("processing_date"),
  completedAt: timestamp("completed_at"),
  failureReason: text("failure_reason"),
  
  // Running balance after transaction
  runningBalance: integer("running_balance"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("banking_tx_userId_idx").on(table.userId),
  index("banking_tx_accountId_idx").on(table.accountId),
  index("banking_tx_type_idx").on(table.type),
  index("banking_tx_status_idx").on(table.status),
  index("banking_tx_refNum_idx").on(table.referenceNumber),
  index("banking_tx_createdAt_idx").on(table.createdAt),
]);

export type BankingTransaction = typeof bankingTransactions.$inferSelect;
export type InsertBankingTransaction = typeof bankingTransactions.$inferInsert;

// ============================================
// RECURRING BILL PAY (scheduled payments)
// ============================================

export const recurringBillPay = pgTable("recurring_bill_pay", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  accountId: integer("account_id").notNull().references(() => bankAccounts.id),
  payeeName: varchar("payee_name", { length: 255 }).notNull(),
  payeeAccountNumber: varchar("payee_account_number", { length: 100 }),
  amount: integer("amount").notNull(), // in cents
  frequency: varchar("frequency", { length: 20 }).notNull(), // weekly, biweekly, monthly, quarterly
  nextPaymentDate: timestamp("next_payment_date").notNull(),
  billCategory: varchar("bill_category", { length: 50 }),
  memo: text("memo"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type RecurringBillPay = typeof recurringBillPay.$inferSelect;
export type InsertRecurringBillPay = typeof recurringBillPay.$inferInsert;

// ============================================
// PHASE 3: KYC/IDENTITY VERIFICATION
// ============================================

export const kycStatusEnum = pgEnum("kyc_status", ["not_started", "pending", "approved", "rejected", "expired"]);
export const documentTypeEnum = pgEnum("document_type", ["driver_license", "state_id", "passport", "tax_return", "w2", "pay_stub"]);

export const kycVerification = pgTable("kycVerification", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  status: kycStatusEnum("status").default("not_started").notNull(),
  
  // SSN/ITIN verification
  ssnVerified: boolean("ssnVerified").default(false).notNull(),
  ssnVerifiedAt: timestamp("ssnVerifiedAt"),
  itin: varchar("itin", { length: 20 }), // alternative to SSN
  itinVerified: boolean("itinVerified").default(false).notNull(),
  
  // Address verification (USPS)
  addressVerified: boolean("addressVerified").default(false).notNull(),
  addressVerifiedAt: timestamp("addressVerifiedAt"),
  
  // Document verification
  documentsUploaded: boolean("documentsUploaded").default(false).notNull(),
  documentSubmittedAt: timestamp("documentSubmittedAt"),
  
  // Facial recognition / Liveness check
  facialRecognitionCompleted: boolean("facialRecognitionCompleted").default(false).notNull(),
  livenessCheckCompleted: boolean("livenessCheckCompleted").default(false).notNull(),
  
  // OFAC & sanctions check
  ofacCheckCompleted: boolean("ofacCheckCompleted").default(false).notNull(),
  ofacClear: boolean("ofacClear").default(true).notNull(),
  
  // Metadata
  rejectionReason: text("rejectionReason"),
  approvedAt: timestamp("approvedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type KycVerification = typeof kycVerification.$inferSelect;
export type InsertKycVerification = typeof kycVerification.$inferInsert;

// Document storage
export const uploadedDocuments = pgTable("uploadedDocuments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  loanApplicationId: integer("loanApplicationId"), // Link to loan application
  documentType: documentTypeEnum("documentType").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  /** @deprecated Duplicate of `filename` — use `filename` instead. Kept for migration compatibility. */
  fileName: varchar("file_name", { length: 255 }),
  fileUrl: varchar("file_url", { length: 500 }), // Public URL or path
  storagePath: varchar("storagePath", { length: 500 }).notNull(), // S3 or file path
  fileSize: integer("fileSize").notNull(), // in bytes
  mimeType: varchar("mimeType", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // "pending", "verified", "rejected"
  verificationStatus: varchar("verification_status", { length: 50 }).default("pending"), // OCR verification status
  verificationMetadata: text("verification_metadata"), // JSON with OCR results, confidence score, flags
  verifiedBy: integer("verifiedBy"), // admin user id
  rejectionReason: text("rejectionReason"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  verifiedAt: timestamp("verifiedAt"),
});

export type UploadedDocument = typeof uploadedDocuments.$inferSelect;
export type InsertUploadedDocument = typeof uploadedDocuments.$inferInsert;

// ============================================
// PHASE 4 & 5: LOAN OFFERS & APPLICATIONS EXTENDED
// ============================================

export const loanTypeExtendedEnum = pgEnum("loan_type_extended", [
  "personal",
  "installment",
  "short_term",
  "auto",
  "secured",
  "unsecured"
]);

export const loanOffers = pgTable("loanOffers", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  
  // Offer details
  loanType: loanTypeExtendedEnum("loanType").notNull(),
  minAmount: integer("minAmount").notNull(), // in cents
  maxAmount: integer("maxAmount").notNull(), // in cents
  suggestedAmount: integer("suggestedAmount"), // in cents
  
  // APR & rates
  aprMin: varchar("aprMin", { length: 10 }).notNull(), // stored as string "4.50"
  aprMax: varchar("aprMax", { length: 10 }).notNull(), // stored as string "24.99"
  estimatedApr: varchar("estimatedApr", { length: 10 }), // stored as string
  
  // Terms
  minTerm: integer("minTerm").notNull(), // in months
  maxTerm: integer("maxTerm").notNull(), // in months
  recommendedTerm: integer("recommendedTerm"), // in months
  
  // Offer type
  offerType: varchar("offerType", { length: 50 }).notNull(), // "pre_qualified", "pre_approved", "personalized"
  softPullCompleted: boolean("softPullCompleted").default(false).notNull(),
  
  // Status & expiry
  status: varchar("status", { length: 50 }).default("active").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type LoanOffer = typeof loanOffers.$inferSelect;
export type InsertLoanOffer = typeof loanOffers.$inferInsert;

// ============================================
// PHASE 6: LOAN REPAYMENT & PAYMENTS EXTENDED
// ============================================

export const paymentSchedules = pgTable("paymentSchedules", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loanApplicationId").notNull(),
  
  // Schedule details
  installmentNumber: integer("installmentNumber").notNull(),
  dueDate: timestamp("dueDate").notNull(),
  dueAmount: integer("dueAmount").notNull(), // in cents
  principalAmount: integer("principalAmount").notNull(), // in cents
  interestAmount: integer("interestAmount").notNull(), // in cents
  
  // Payment status
  status: varchar("status", { length: 50 }).default("pending").notNull(), // "pending", "paid", "late", "waived"
  paidAmount: integer("paidAmount").default(0).notNull(),
  paidAt: timestamp("paidAt"),
  
  // Late fees
  lateFeeApplied: boolean("lateFeeApplied").default(false).notNull(),
  lateFeeAmount: integer("lateFeeAmount").default(0).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type PaymentSchedule = typeof paymentSchedules.$inferSelect;
export type InsertPaymentSchedule = typeof paymentSchedules.$inferInsert;

export const autopaySettings = pgTable("autopaySettings", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loanApplicationId").notNull().unique(),
  
  isEnabled: boolean("isEnabled").default(false).notNull(),
  paymentMethod: paymentMethodEnum("paymentMethod"), // "card" or from bank account
  bankAccountId: integer("bankAccountId"), // if using bank account
  
  // Auto-retry on failure
  autoRetry: boolean("autoRetry").default(true).notNull(),
  maxRetries: integer("maxRetries").default(3).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AutopaySettings = typeof autopaySettings.$inferSelect;
export type InsertAutopaySettings = typeof autopaySettings.$inferInsert;

// ============================================
// PHASE 9: NOTIFICATIONS & SUPPORT
// ============================================

export const notificationTypeEnum = pgEnum("notification_type", [
  "payment_reminder",
  "payment_due",
  "payment_confirmation",
  "payment_failure",
  "application_status",
  "document_request",
  "approval_notice",
  "denial_notice",
  "delinquency_notice",
  "tila_disclosure",
  "support_response"
]);

export const userNotifications = pgTable("userNotifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  relatedLoanId: integer("relatedLoanId"),
  actionUrl: varchar("actionUrl", { length: 500 }),
  
  // Delivery status
  sentViaEmail: boolean("sentViaEmail").default(false).notNull(),
  sentViaSms: boolean("sentViaSms").default(false).notNull(),
  sentViaPush: boolean("sentViaPush").default(false).notNull(),
  
  // Read status
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserNotification = typeof userNotifications.$inferSelect;
export type InsertUserNotification = typeof userNotifications.$inferInsert;

// Support tickets
export const supportTicketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "waiting_customer", "resolved", "closed"]);

export const supportTickets = pgTable("supportTickets", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: supportTicketStatusEnum("status").default("open").notNull(),
  priority: varchar("priority", { length: 20 }).default("normal").notNull(), // "low", "normal", "high", "urgent"
  category: varchar("category", { length: 100 }), // "payment", "application", "verification", "account"
  
  // Assignment
  assignedTo: integer("assignedTo"), // admin user id
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;

// Ticket messages
export const ticketMessages = pgTable("ticketMessages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticketId").notNull(),
  userId: integer("userId").notNull(), // can be user or admin
  message: text("message").notNull(),
  attachmentUrl: varchar("attachmentUrl", { length: 500 }),
  
  isFromAdmin: boolean("isFromAdmin").default(false).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TicketMessage = typeof ticketMessages.$inferSelect;
export type InsertTicketMessage = typeof ticketMessages.$inferInsert;

// ============================================
// PHASE 10: REFERRAL & REWARDS PROGRAM
// ============================================

export const referralProgram = pgTable("referralProgram", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrerId").notNull(),
  referredUserId: integer("referredUserId"),
  
  referralCode: varchar("referralCode", { length: 50 }).notNull().unique(),
  referralLink: varchar("referralLink", { length: 500 }).notNull().unique(),
  
  status: varchar("status", { length: 50 }).default("pending").notNull(), // "pending", "completed", "expired"
  completedAt: timestamp("completedAt"),
  
  // Rewards
  referrerBonus: integer("referrerBonus"), // in cents
  referredBonus: integer("referredBonus"), // in cents
  bonusType: varchar("bonusType", { length: 50 }).default("credit").notNull(), // "credit", "cashback"
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});

export type ReferralProgram = typeof referralProgram.$inferSelect;
export type InsertReferralProgram = typeof referralProgram.$inferInsert;

// User account credits/rewards balance
export const userRewardsBalance = pgTable("userRewardsBalance", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  
  creditBalance: integer("creditBalance").default(0).notNull(), // in cents
  cashbackBalance: integer("cashbackBalance").default(0).notNull(), // in cents
  
  totalEarned: integer("totalEarned").default(0).notNull(),
  totalRedeemed: integer("totalRedeemed").default(0).notNull(),
  
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserRewardsBalance = typeof userRewardsBalance.$inferSelect;
export type InsertUserRewardsBalance = typeof userRewardsBalance.$inferInsert;

// Admin Settings Tables
export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  autoApprovalEnabled: boolean("auto_approval_enabled").default(false).notNull(),
  maintenanceMode: boolean("maintenance_mode").default(false).notNull(),
  minLoanAmount: varchar("min_loan_amount", { length: 20 }).default("1000.00").notNull(),
  maxLoanAmount: varchar("max_loan_amount", { length: 20 }).default("5000.00").notNull(),
  twoFactorRequired: boolean("two_factor_required").default(false).notNull(),
  sessionTimeout: integer("session_timeout").default(30).notNull(), // minutes
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 50 }).notNull(), // 'stripe', 'sendgrid', 'twilio', 'coinbase'
  keyName: varchar("key_name", { length: 100 }).notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const emailConfig = pgTable("email_config", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 50 }).notNull(), // 'sendgrid', 'smtp'
  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: integer("smtp_port"),
  smtpUser: varchar("smtp_user", { length: 255 }),
  encryptedSmtpPassword: text("encrypted_smtp_password"),
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  fromName: varchar("from_name", { length: 255 }).notNull(),
  replyToEmail: varchar("reply_to_email", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  emailNotifications: boolean("email_notifications").default(true).notNull(),
  smsNotifications: boolean("sms_notifications").default(false).notNull(),
  applicationApproved: boolean("application_approved").default(true).notNull(),
  applicationRejected: boolean("application_rejected").default(true).notNull(),
  paymentReminders: boolean("payment_reminders").default(true).notNull(),
  paymentReceived: boolean("payment_received").default(true).notNull(),
  documentRequired: boolean("document_required").default(true).notNull(),
  adminAlerts: boolean("admin_alerts").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const cryptoWalletSettings = pgTable("crypto_wallet_settings", {
  id: serial("id").primaryKey(),
  btcAddress: varchar("btc_address", { length: 100 }),
  ethAddress: varchar("eth_address", { length: 100 }),
  usdtAddress: varchar("usdt_address", { length: 100 }),
  usdcAddress: varchar("usdc_address", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Company Bank Settings for Wire/ACH transfers
export const companyBankSettings = pgTable("company_bank_settings", {
  id: serial("id").primaryKey(),
  bankName: varchar("bank_name", { length: 255 }).notNull(),
  accountHolderName: varchar("account_holder_name", { length: 255 }).notNull(),
  routingNumber: varchar("routing_number", { length: 20 }).notNull(),
  accountNumber: varchar("account_number", { length: 50 }).notNull(),
  accountType: varchar("account_type", { length: 20 }).default("checking").notNull(), // checking, savings
  swiftCode: varchar("swift_code", { length: 20 }), // for international wire
  bankAddress: text("bank_address"),
  instructions: text("instructions"), // special instructions for transfers
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export type CompanyBankSettings = typeof companyBankSettings.$inferSelect;
export type InsertCompanyBankSettings = typeof companyBankSettings.$inferInsert;

// Auto-Pay Settings for recurring loan payments
export const autoPaySettings = pgTable("auto_pay_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  loanApplicationId: integer("loan_application_id").references(() => loanApplications.id),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // 'bank_account', 'card'
  
  // Stripe Customer / Payment Method IDs for stored payment methods
  customerProfileId: varchar("customer_profile_id", { length: 255 }), // Stripe Customer ID
  paymentProfileId: varchar("payment_profile_id", { length: 255 }), // Stripe Payment Method ID
  
  bankAccountId: varchar("bank_account_id", { length: 255 }), // Plaid account ID or similar
  cardLast4: varchar("card_last4", { length: 4 }),
  cardBrand: varchar("card_brand", { length: 50 }), // Visa, Mastercard, etc.
  paymentDay: integer("payment_day").notNull(), // Day of month (1-31)
  amount: integer("amount"), // Amount in cents, null = full payment
  nextPaymentDate: timestamp("next_payment_date"),
  lastPaymentDate: timestamp("last_payment_date"),
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(), // 'active', 'paused', 'failed', 'cancelled'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Two-Factor Authentication Sessions
export const twoFactorSessions = pgTable("two_factor_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
  verified: boolean("verified").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Login Activity Log for security tracking
export const loginActivity = pgTable("login_activity", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  location: varchar("location", { length: 255 }), // City, Country
  deviceType: varchar("device_type", { length: 50 }), // 'desktop', 'mobile', 'tablet'
  browser: varchar("browser", { length: 100 }),
  success: boolean("success").notNull(),
  failureReason: varchar("failure_reason", { length: 255 }),
  twoFactorUsed: boolean("two_factor_used").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Admin Audit Log for tracking sensitive admin actions
export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id).notNull(),
  action: varchar("action", { length: 100 }).notNull(), // e.g., 'view_bank_password', 'approve_loan', 'update_settings'
  resourceType: varchar("resource_type", { length: 50 }), // e.g., 'loan', 'user', 'settings'
  resourceId: integer("resource_id"), // ID of the affected resource
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  details: text("details"), // JSON string with additional context
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Comprehensive Audit Log for all system events (Priority 4)
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  userId: integer("user_id").references(() => users.id),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  severity: varchar("severity", { length: 20 }).notNull(), // info, warning, error, critical
  description: text("description").notNull(),
  metadata: text("metadata"), // JSON string with additional context
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: integer("resource_id"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Payment Extension Requests
export const paymentExtensionRequests = pgTable("payment_extension_requests", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loan_application_id").references(() => loanApplications.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  extensionDays: integer("extension_days").notNull(), // 7-30 days
  reason: text("reason").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending', 'approved', 'rejected'
  adminNotes: text("admin_notes"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Document metadata table for enhanced document management (Priority 3)
export const loanDocuments = pgTable("loan_documents", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loan_application_id").references(() => loanApplications.id).notNull(),
  documentType: varchar("document_type", { length: 50 }).notNull(), // id, income, bank_statement, other
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(), // bytes
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, approved, rejected
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
});

export type SelectSystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;
export type SelectApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
export type SelectAutoPaySetting = typeof autoPaySettings.$inferSelect;
export type InsertAutoPaySetting = typeof autoPaySettings.$inferInsert;
export type SelectEmailConfig = typeof emailConfig.$inferSelect;
export type InsertEmailConfig = typeof emailConfig.$inferInsert;
export type SelectNotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = typeof notificationSettings.$inferInsert;
export type SelectCryptoWalletSettings = typeof cryptoWalletSettings.$inferSelect;
export type InsertCryptoWalletSettings = typeof cryptoWalletSettings.$inferInsert;
export type SelectAdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;
export type SelectAuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// ============================================
// ENHANCED FEATURES - COMPREHENSIVE ADDITIONS
// ============================================

// Hardship Programs & Loan Modifications
export const hardshipProgramEnum = pgEnum("hardship_program_type", [
  "forbearance",
  "deferment",
  "payment_reduction",
  "term_extension",
  "settlement"
]);

export const hardshipRequests = pgTable("hardship_requests", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loan_application_id").references(() => loanApplications.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  programType: hardshipProgramEnum("program_type").notNull(),
  reason: text("reason").notNull(),
  monthlyIncomeChange: integer("monthly_income_change"), // in cents, can be negative
  proposedPaymentAmount: integer("proposed_payment_amount"), // in cents
  requestedDuration: integer("requested_duration"), // months
  supportingDocuments: text("supporting_documents"), // JSON array of file paths
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, approved, rejected, active, completed
  adminNotes: text("admin_notes"),
  approvedDuration: integer("approved_duration"), // months
  approvedPaymentAmount: integer("approved_payment_amount"), // in cents
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type HardshipRequest = typeof hardshipRequests.$inferSelect;
export type InsertHardshipRequest = typeof hardshipRequests.$inferInsert;

// Tax Documents Generation
export const taxDocumentTypeEnum = pgEnum("tax_document_type", [
  "1098",      // Mortgage interest statement
  "1099_c",    // Cancellation of debt
  "interest_statement"  // Year-end interest statement
]);

export const taxDocuments = pgTable("tax_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  loanApplicationId: integer("loan_application_id").references(() => loanApplications.id),
  documentType: taxDocumentTypeEnum("document_type").notNull(),
  taxYear: integer("tax_year").notNull(),
  totalInterestPaid: integer("total_interest_paid"), // in cents
  totalPrincipalPaid: integer("total_principal_paid"), // in cents
  debtCancelled: integer("debt_cancelled"), // in cents for 1099-C
  documentPath: text("document_path"), // Path to generated PDF
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  sentToUser: boolean("sent_to_user").default(false),
  sentAt: timestamp("sent_at"),
});

export type TaxDocument = typeof taxDocuments.$inferSelect;
export type InsertTaxDocument = typeof taxDocuments.$inferInsert;

// Push Notification Subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsed: timestamp("last_used"),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// Co-Signers & Joint Applications
export const coSignerStatusEnum = pgEnum("co_signer_status", [
  "invited",
  "accepted",
  "declined",
  "released"
]);

export const coSigners = pgTable("co_signers", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loan_application_id").references(() => loanApplications.id).notNull(),
  primaryBorrowerId: integer("primary_borrower_id").references(() => users.id).notNull(),
  coSignerEmail: varchar("co_signer_email", { length: 320 }).notNull(),
  coSignerName: varchar("co_signer_name", { length: 255 }),
  coSignerUserId: integer("co_signer_user_id").references(() => users.id),
  invitationToken: varchar("invitation_token", { length: 100 }).unique(),
  status: coSignerStatusEnum("status").default("invited").notNull(),
  liabilitySplit: integer("liability_split").default(50), // percentage (0-100)
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
  releaseEligibleAt: timestamp("release_eligible_at"), // After X successful payments
  releasedAt: timestamp("released_at"),
  releasedBy: integer("released_by").references(() => users.id),
});

export type CoSigner = typeof coSigners.$inferSelect;
export type InsertCoSigner = typeof coSigners.$inferInsert;

// Account Closure Requests
export const accountClosureReasons = pgEnum("closure_reason", [
  "no_longer_needed",
  "switching_lender",
  "privacy_concerns",
  "service_quality",
  "other"
]);

export const accountClosureRequests = pgTable("account_closure_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  reason: accountClosureReasons("reason").notNull(),
  detailedReason: text("detailed_reason"),
  hasOutstandingLoans: boolean("has_outstanding_loans").default(false),
  dataExportRequested: boolean("data_export_requested").default(false),
  dataExportedAt: timestamp("data_exported_at"),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, approved, rejected, completed
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  adminNotes: text("admin_notes"),
  scheduledDeletionDate: timestamp("scheduled_deletion_date"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AccountClosureRequest = typeof accountClosureRequests.$inferSelect;
export type InsertAccountClosureRequest = typeof accountClosureRequests.$inferInsert;

// Payment Allocation Preferences
export const paymentAllocationStrategy = pgEnum("payment_allocation_strategy", [
  "standard",           // Fees -> Interest -> Principal
  "principal_first",    // Extra payment goes to principal
  "future_payments",    // Extra payment pays ahead
  "biweekly",          // Bi-weekly payment schedule
  "round_up"           // Round up payments
]);

export const paymentPreferences = pgTable("payment_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  loanApplicationId: integer("loan_application_id").references(() => loanApplications.id),
  allocationStrategy: paymentAllocationStrategy("allocation_strategy").default("standard").notNull(),
  roundUpEnabled: boolean("round_up_enabled").default(false),
  roundUpToNearest: integer("round_up_to_nearest").default(100), // Round up to nearest $1, $5, $10, etc (in cents)
  biweeklyEnabled: boolean("biweekly_enabled").default(false),
  autoExtraPaymentAmount: integer("auto_extra_payment_amount"), // in cents
  autoExtraPaymentDay: integer("auto_extra_payment_day"), // day of month
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PaymentPreference = typeof paymentPreferences.$inferSelect;
export type InsertPaymentPreference = typeof paymentPreferences.$inferInsert;

// Fraud Detection & Risk Scoring
export const fraudChecks = pgTable("fraud_checks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  loanApplicationId: integer("loan_application_id").references(() => loanApplications.id),
  sessionId: varchar("session_id", { length: 100 }),
  deviceFingerprint: text("device_fingerprint"),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  ipCountry: varchar("ip_country", { length: 2 }),
  ipCity: varchar("ip_city", { length: 100 }),
  ipRiskScore: integer("ip_risk_score"), // 0-100
  velocityScore: integer("velocity_score"), // Applications in past 24h/7d/30d
  riskScore: integer("risk_score").notNull(), // Overall 0-100
  riskLevel: varchar("risk_level", { length: 20 }).notNull(), // low, medium, high, critical
  flaggedReasons: text("flagged_reasons"), // JSON array
  requiresManualReview: boolean("requires_manual_review").default(false),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FraudCheck = typeof fraudChecks.$inferSelect;
export type InsertFraudCheck = typeof fraudChecks.$inferInsert;

// Live Chat Messages
export const chatMessageStatus = pgEnum("chat_message_status", [
  "sent",
  "delivered",
  "read"
]);

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  assignedToAgentId: integer("assigned_to_agent_id").references(() => users.id),
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, closed, transferred
  subject: varchar("subject", { length: 255 }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  rating: integer("rating"), // 1-5 stars
  feedbackComment: text("feedback_comment"),
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => chatSessions.id).notNull(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  isFromAgent: boolean("is_from_agent").default(false),
  status: chatMessageStatus("status").default("sent").notNull(),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// Canned Responses for Live Chat
export const cannedResponses = pgTable("canned_responses", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 50 }).notNull(), // greeting, payment, application, closing, etc
  shortcut: varchar("shortcut", { length: 20 }).unique(), // /greeting, /payment-help
  title: varchar("title", { length: 100 }).notNull(),
  message: text("message").notNull(),
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CannedResponse = typeof cannedResponses.$inferSelect;
export type InsertCannedResponse = typeof cannedResponses.$inferInsert;

// E-Signature Documents
export const eSignatureStatus = pgEnum("e_signature_status", [
  "pending",
  "signed",
  "declined",
  "expired"
]);

export const eSignatureDocuments = pgTable("e_signature_documents", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loan_application_id").references(() => loanApplications.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  documentType: varchar("document_type", { length: 50 }).notNull(), // loan_agreement, disclosure, etc
  documentTitle: varchar("document_title", { length: 255 }).notNull(),
  documentPath: text("document_path").notNull(),
  providerDocumentId: varchar("provider_document_id", { length: 255 }), // DocuSign envelope ID
  signerEmail: varchar("signer_email", { length: 320 }).notNull(),
  signerName: varchar("signer_name", { length: 255 }).notNull(),
  status: eSignatureStatus("status").default("pending").notNull(),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  signedAt: timestamp("signed_at"),
  signedDocumentPath: text("signed_document_path"),
  ipAddress: varchar("ip_address", { length: 45 }),
  auditTrail: text("audit_trail"), // JSON
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ESignatureDocument = typeof eSignatureDocuments.$inferSelect;
export type InsertESignatureDocument = typeof eSignatureDocuments.$inferInsert;

// Marketing & Attribution
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  campaignName: varchar("campaign_name", { length: 255 }).notNull(),
  source: varchar("source", { length: 100 }), // google, facebook, email, referral
  medium: varchar("medium", { length: 100 }), // cpc, email, social, organic
  campaignCode: varchar("campaign_code", { length: 100 }).unique(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  budget: integer("budget"), // in cents
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = typeof marketingCampaigns.$inferInsert;

export const userAttribution = pgTable("user_attribution", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id),
  utmSource: varchar("utm_source", { length: 100 }),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }),
  utmTerm: varchar("utm_term", { length: 100 }),
  utmContent: varchar("utm_content", { length: 100 }),
  referrerUrl: text("referrer_url"),
  landingPage: text("landing_page"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserAttribution = typeof userAttribution.$inferSelect;
export type InsertUserAttribution = typeof userAttribution.$inferInsert;

// Promo / Discount Codes
export const discountTypeEnum = pgEnum("discount_type", ["percentage", "fixed"]);

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id),
  description: text("description"),
  discountType: discountTypeEnum("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(), // percentage (0-100) or fixed amount in cents
  maxUses: integer("max_uses"), // null = unlimited
  currentUses: integer("current_uses").default(0).notNull(),
  minLoanAmount: integer("min_loan_amount"), // in cents, null = no minimum
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = typeof promoCodes.$inferInsert;

// Marketing Email Log (tracks campaign emails sent)
export const marketingEmailLog = pgTable("marketing_email_log", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id),
  subject: varchar("subject", { length: 500 }).notNull(),
  recipientCount: integer("recipient_count").notNull(),
  sentBy: integer("sent_by").references(() => users.id),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export type MarketingEmailLog = typeof marketingEmailLog.$inferSelect;
export type InsertMarketingEmailLog = typeof marketingEmailLog.$inferInsert;

// Collections & Delinquency Management
export const delinquencyStatusEnum = pgEnum("delinquency_status", [
  "current",
  "days_15",
  "days_30",
  "days_60",
  "days_90",
  "charged_off",
  "in_settlement"
]);

export const delinquencyRecords = pgTable("delinquency_records", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loan_application_id").references(() => loanApplications.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  status: delinquencyStatusEnum("status").notNull(),
  daysDelinquent: integer("days_delinquent").notNull(),
  totalAmountDue: integer("total_amount_due").notNull(), // in cents
  lastPaymentDate: timestamp("last_payment_date"),
  nextActionDate: timestamp("next_action_date"),
  assignedCollectorId: integer("assigned_collector_id").references(() => users.id),
  collectionAttempts: integer("collection_attempts").default(0),
  lastContactDate: timestamp("last_contact_date"),
  lastContactMethod: varchar("last_contact_method", { length: 20 }), // phone, email, sms, mail
  promiseToPayDate: timestamp("promise_to_pay_date"),
  promiseToPayAmount: integer("promise_to_pay_amount"), // in cents
  settlementOffered: boolean("settlement_offered").default(false),
  settlementAmount: integer("settlement_amount"), // in cents
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DelinquencyRecord = typeof delinquencyRecords.$inferSelect;
export type InsertDelinquencyRecord = typeof delinquencyRecords.$inferInsert;

export const collectionActions = pgTable("collection_actions", {
  id: serial("id").primaryKey(),
  delinquencyRecordId: integer("delinquency_record_id").references(() => delinquencyRecords.id).notNull(),
  actionType: varchar("action_type", { length: 50 }).notNull(), // email, sms, phone_call, letter, legal
  actionDate: timestamp("action_date").defaultNow().notNull(),
  performedBy: integer("performed_by").references(() => users.id),
  outcome: varchar("outcome", { length: 50 }), // contacted, no_answer, voicemail, promised_payment, disputed
  notes: text("notes"),
  nextActionDate: timestamp("next_action_date"),
});

export type CollectionAction = typeof collectionActions.$inferSelect;
export type InsertCollectionAction = typeof collectionActions.$inferInsert;
export type SelectLoanDocument = typeof loanDocuments.$inferSelect;
export type InsertLoanDocument = typeof loanDocuments.$inferInsert;

// Invitation Codes (admin-generated offer codes sent via email)
export const invitationCodeStatusEnum = pgEnum("invitation_code_status", [
  "active",
  "redeemed",
  "expired",
  "revoked"
]);

export const invitationCodes = pgTable("invitation_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
  recipientName: varchar("recipient_name", { length: 255 }),
  
  // Offer details embedded in the code
  offerAmount: integer("offer_amount"), // pre-approved amount in cents
  offerApr: integer("offer_apr"), // basis points (e.g. 899 = 8.99%)
  offerTermMonths: integer("offer_term_months"), // months
  offerDescription: text("offer_description"),
  
  // Lifecycle
  status: invitationCodeStatusEnum("status").default("active").notNull(),
  redeemedBy: integer("redeemed_by").references(() => users.id),
  redeemedAt: timestamp("redeemed_at"),
  expiresAt: timestamp("expires_at").notNull(),
  
  // Reminder tracking
  lastReminderSentAt: timestamp("last_reminder_sent_at"),
  reminderCount: integer("reminder_count").default(0).notNull(),
  
  // Admin tracking
  createdBy: integer("created_by").references(() => users.id).notNull(),
  adminNotes: text("admin_notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InvitationCode = typeof invitationCodes.$inferSelect;
export type InsertInvitationCode = typeof invitationCodes.$inferInsert;

// Virtual Debit Cards
export const virtualCardStatusEnum = pgEnum("virtual_card_status", [
  "active",
  "frozen",
  "expired",
  "cancelled"
]);

export const virtualCards = pgTable("virtual_cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  loanApplicationId: integer("loan_application_id").references(() => loanApplications.id),
  
  // Card details (encrypted at rest in production)
  cardNumber: varchar("card_number", { length: 500 }).notNull(), // Encrypted 16-digit
  cardNumberLast4: varchar("card_number_last4", { length: 4 }).notNull(),
  expiryMonth: varchar("expiry_month", { length: 2 }).notNull(),
  expiryYear: varchar("expiry_year", { length: 4 }).notNull(),
  cvv: varchar("cvv", { length: 500 }).notNull(), // Encrypted 3-digit
  cardholderName: varchar("cardholder_name", { length: 255 }).notNull(),
  
  // Card configuration
  cardLabel: varchar("card_label", { length: 100 }), // e.g., "Personal Loan Card"
  cardColor: varchar("card_color", { length: 20 }).default("blue"), // UI theme
  
  // Balance & limits
  currentBalance: integer("current_balance").default(0).notNull(), // in cents
  creditLimit: integer("credit_limit").default(0).notNull(), // in cents, 0 = debit only
  dailySpendLimit: integer("daily_spend_limit").default(500000).notNull(), // $5000 default, in cents
  monthlySpendLimit: integer("monthly_spend_limit").default(2500000).notNull(), // $25000 default, in cents
  
  // Spend tracking
  dailySpent: integer("daily_spent").default(0).notNull(), // cents spent today
  monthlySpent: integer("monthly_spent").default(0).notNull(), // cents spent this month
  dailySpentResetAt: timestamp("daily_spent_reset_at").defaultNow().notNull(),
  monthlySpentResetAt: timestamp("monthly_spent_reset_at").defaultNow().notNull(),
  
  // Settings
  onlineTransactionsEnabled: boolean("online_transactions_enabled").default(true).notNull(),
  internationalTransactionsEnabled: boolean("international_transactions_enabled").default(false).notNull(),
  atmWithdrawalsEnabled: boolean("atm_withdrawals_enabled").default(true).notNull(),
  contactlessEnabled: boolean("contactless_enabled").default(true).notNull(),
  
  // Status
  status: virtualCardStatusEnum("status").default("active").notNull(),
  
  // Admin fraud controls
  frozenReason: text("frozen_reason"),
  frozenBy: integer("frozen_by"),
  frozenAt: timestamp("frozen_at"),
  
  // Admin
  issuedBy: integer("issued_by").references(() => users.id),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("virtual_cards_userId_idx").on(table.userId),
  index("virtual_cards_loanAppId_idx").on(table.loanApplicationId),
  index("virtual_cards_status_idx").on(table.status),
]);

export type VirtualCard = typeof virtualCards.$inferSelect;
export type InsertVirtualCard = typeof virtualCards.$inferInsert;

// Virtual Card Transactions
export const virtualCardTransactions = pgTable("virtual_card_transactions", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => virtualCards.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Transaction details
  amount: integer("amount").notNull(), // in cents (positive = debit, negative = credit/refund)
  merchantName: varchar("merchant_name", { length: 255 }).notNull(),
  merchantCategory: varchar("merchant_category", { length: 100 }), // e.g., "Shopping", "Groceries"
  description: text("description"),
  
  // Status
  status: varchar("transaction_status", { length: 20 }).default("completed").notNull(), // pending, completed, declined, refunded
  declineReason: text("decline_reason"),
  
  // Reference
  referenceNumber: varchar("reference_number", { length: 50 }).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("vcard_tx_cardId_idx").on(table.cardId),
  index("vcard_tx_userId_idx").on(table.userId),
]);

export type VirtualCardTransaction = typeof virtualCardTransactions.$inferSelect;
export type InsertVirtualCardTransaction = typeof virtualCardTransactions.$inferInsert;

// Physical Card Requests
export const physicalCardStatusEnum = pgEnum("physical_card_status", [
  "pending",
  "approved",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled"
]);

export const physicalCardRequests = pgTable("physical_card_requests", {
  id: serial("id").primaryKey(),
  virtualCardId: integer("virtual_card_id").references(() => virtualCards.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Shipping address
  shippingName: varchar("shipping_name", { length: 255 }).notNull(),
  shippingAddress1: varchar("shipping_address1", { length: 255 }).notNull(),
  shippingAddress2: varchar("shipping_address2", { length: 255 }),
  shippingCity: varchar("shipping_city", { length: 100 }).notNull(),
  shippingState: varchar("shipping_state", { length: 50 }).notNull(),
  shippingZip: varchar("shipping_zip", { length: 20 }).notNull(),
  shippingCountry: varchar("shipping_country", { length: 50 }).default("US").notNull(),
  
  // Shipping details
  shippingMethod: varchar("shipping_method", { length: 50 }).default("standard").notNull(), // standard, expedited, overnight
  carrier: varchar("carrier", { length: 50 }), // USPS, FedEx, UPS
  trackingNumber: varchar("tracking_number", { length: 100 }),
  trackingUrl: text("tracking_url"),
  
  // Physical card details (assigned when shipped)
  physicalCardLast4: varchar("physical_card_last4", { length: 4 }),
  
  // Status
  status: physicalCardStatusEnum("status").default("pending").notNull(),
  
  // Timeline
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  processingAt: timestamp("processing_at"),
  shippedAt: timestamp("shipped_at"),
  estimatedDeliveryDate: timestamp("estimated_delivery_date"),
  deliveredAt: timestamp("delivered_at"),
  cancelledAt: timestamp("cancelled_at"),
  
  // Admin
  approvedBy: integer("approved_by").references(() => users.id),
  adminNotes: text("admin_notes"),
  cancellationReason: text("cancellation_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("phys_card_virtualCardId_idx").on(table.virtualCardId),
  index("phys_card_userId_idx").on(table.userId),
  index("phys_card_status_idx").on(table.status),
]);

export type PhysicalCardRequest = typeof physicalCardRequests.$inferSelect;
export type InsertPhysicalCardRequest = typeof physicalCardRequests.$inferInsert;

// ============================================
// AUTOMATION RULES
// ============================================

export const automationRules = pgTable("automation_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'auto-approve', 'auto-reject', 'status-transition', 'ticket-routing'
  conditions: text("conditions").notNull(), // JSON string of condition objects
  action: text("action").notNull(), // JSON string of action object
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AutomationRule = typeof automationRules.$inferSelect;
export type InsertAutomationRule = typeof automationRules.$inferInsert;

/**
 * Email reminder log — tracks which reminders have been sent to prevent duplicates
 */
export const emailReminderLog = pgTable("email_reminder_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  reminderType: varchar("reminder_type", { length: 80 }).notNull(),
  entityId: integer("entity_id"), // e.g. loanApplicationId, nullable for user-level reminders
  reminderCount: integer("reminder_count").default(1).notNull(),
  lastSentAt: timestamp("last_sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EmailReminderLog = typeof emailReminderLog.$inferSelect;
export type InsertEmailReminderLog = typeof emailReminderLog.$inferInsert;

// Job Applications (Careers / Hiring)
export const jobApplicationStatusEnum = pgEnum("job_application_status", [
  "pending",
  "under_review",
  "approved",
  "rejected",
]);

export const jobApplications = pgTable("job_applications", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  position: varchar("position", { length: 255 }).notNull(),
  resumeFileName: varchar("resume_file_name", { length: 500 }),
  resumeFileUrl: text("resume_file_url"),
  coverLetter: text("cover_letter").notNull(),
  status: jobApplicationStatusEnum("status").default("pending").notNull(),
  adminNotes: text("admin_notes"),
  replyMessage: text("reply_message"),
  rejectionReasons: text("rejection_reasons"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type JobApplication = typeof jobApplications.$inferSelect;
export type InsertJobApplication = typeof jobApplications.$inferInsert;
