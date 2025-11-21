import { boolean, integer, pgEnum, pgTable, text, timestamp, varchar, serial } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */

export const roleEnum = pgEnum("role", ["user", "admin"]);
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
  
  // Personal information
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  ssn: varchar("ssn", { length: 11 }), // Social Security Number (encrypted in practice)
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
  bankAccountNumber: varchar("bankAccountNumber", { length: 50 }),
  bankRoutingNumber: varchar("bankRoutingNumber", { length: 20 }),
  bankAccountType: varchar("bankAccountType", { length: 20 }), // checking, savings
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

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
  
  // Applicant information
  fullName: varchar("fullName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  dateOfBirth: varchar("dateOfBirth", { length: 10 }).notNull(), // YYYY-MM-DD
  ssn: varchar("ssn", { length: 11 }).notNull(), // XXX-XX-XXXX
  
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
  
  // Approval details
  approvedAmount: integer("approvedAmount"), // in cents, null if not approved
  processingFeeAmount: integer("processingFeeAmount"), // in cents, calculated after approval
  
  // Status tracking
  status: loanApplicationStatusEnum("status").default("pending").notNull(),
  
  rejectionReason: text("rejectionReason"),
  adminNotes: text("adminNotes"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
  disbursedAt: timestamp("disbursedAt"),
});

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

export const paymentProviderEnum = pgEnum("payment_provider", ["stripe", "authorizenet", "crypto"]);
export const paymentMethodEnum = pgEnum("payment_method", ["card", "crypto"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",      // Payment initiated
  "processing",   // Payment being processed
  "succeeded",    // Payment successful
  "failed",       // Payment failed
  "cancelled"     // Payment cancelled
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
  
  // Card payment details (Authorize.net or Stripe)
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
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

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
});

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

// Bank accounts (Plaid/MX integration)
export const bankAccounts = pgTable("bankAccounts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  plaidAccountId: varchar("plaidAccountId", { length: 255 }), // from Plaid
  bankName: varchar("bankName", { length: 255 }).notNull(),
  accountType: varchar("accountType", { length: 20 }).notNull(), // "checking", "savings", "money_market"
  accountNumber: varchar("accountNumber", { length: 50 }).notNull(), // masked display
  routingNumber: varchar("routingNumber", { length: 20 }), 
  accountHolderName: varchar("accountHolderName", { length: 255 }).notNull(),
  isVerified: boolean("isVerified").default(false).notNull(),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = typeof bankAccounts.$inferInsert;

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
  documentType: documentTypeEnum("documentType").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  storagePath: varchar("storagePath", { length: 500 }).notNull(), // S3 or file path
  fileSize: integer("fileSize").notNull(), // in bytes
  mimeType: varchar("mimeType", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // "pending", "verified", "rejected"
  verifiedBy: integer("verifiedBy"), // admin user id
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
// PHASE 7: DELINQUENCY & COLLECTIONS
// ============================================

export const delinquencyStatusEnum = pgEnum("delinquency_status", ["current", "1_to_30_days", "31_to_60_days", "61_to_90_days", "90_plus_days", "charged_off"]);

export const delinquencyRecords = pgTable("delinquencyRecords", {
  id: serial("id").primaryKey(),
  loanApplicationId: integer("loanApplicationId").notNull(),
  
  status: delinquencyStatusEnum("status").notNull(),
  daysOverdue: integer("daysOverdue").default(0).notNull(),
  totalOutstanding: integer("totalOutstanding").notNull(), // in cents
  lastPaymentDate: timestamp("lastPaymentDate"),
  
  // Collections
  collectionAttempts: integer("collectionAttempts").default(0).notNull(),
  lastCollectionAttempt: timestamp("lastCollectionAttempt"),
  
  // Hardship programs
  hardshipProgram: varchar("hardshipProgram", { length: 100 }), // "forbearance", "extension", "modification"
  hardshipStartDate: timestamp("hardshipStartDate"),
  hardshipEndDate: timestamp("hardshipEndDate"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type DelinquencyRecord = typeof delinquencyRecords.$inferSelect;
export type InsertDelinquencyRecord = typeof delinquencyRecords.$inferInsert;

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
  provider: varchar("provider", { length: 50 }).notNull(), // 'authorizenet', 'sendgrid', 'twilio', 'coinbase'
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

export type SelectSystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;
export type SelectApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
export type SelectEmailConfig = typeof emailConfig.$inferSelect;
export type InsertEmailConfig = typeof emailConfig.$inferInsert;
export type SelectNotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = typeof notificationSettings.$inferInsert;