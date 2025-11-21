CREATE TYPE "public"."delinquency_status" AS ENUM('current', '1_to_30_days', '31_to_60_days', '61_to_90_days', '90_plus_days', 'charged_off');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('driver_license', 'state_id', 'passport', 'tax_return', 'w2', 'pay_stub');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('not_started', 'pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."loan_type_extended" AS ENUM('personal', 'installment', 'short_term', 'auto', 'secured', 'unsecured');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'push', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('payment_reminder', 'payment_due', 'payment_confirmation', 'payment_failure', 'application_status', 'document_request', 'approval_notice', 'denial_notice', 'delinquency_notice', 'tila_disclosure', 'support_response');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."twofa_method" AS ENUM('sms', 'email', 'authenticator', 'biometric');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('mobile', 'tablet', 'desktop', 'web');--> statement-breakpoint
CREATE TABLE "adminActivityLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"adminId" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"targetType" varchar(50) NOT NULL,
	"targetId" integer,
	"details" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autopaySettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"loanApplicationId" integer NOT NULL,
	"isEnabled" boolean DEFAULT false NOT NULL,
	"paymentMethod" "payment_method",
	"bankAccountId" integer,
	"autoRetry" boolean DEFAULT true NOT NULL,
	"maxRetries" integer DEFAULT 3 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "autopaySettings_loanApplicationId_unique" UNIQUE("loanApplicationId")
);
--> statement-breakpoint
CREATE TABLE "bankAccounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"plaidAccountId" varchar(255),
	"bankName" varchar(255) NOT NULL,
	"accountType" varchar(20) NOT NULL,
	"accountNumber" varchar(50) NOT NULL,
	"routingNumber" varchar(20),
	"accountHolderName" varchar(255) NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"isPrimary" boolean DEFAULT false NOT NULL,
	"verifiedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delinquencyRecords" (
	"id" serial PRIMARY KEY NOT NULL,
	"loanApplicationId" integer NOT NULL,
	"status" "delinquency_status" NOT NULL,
	"daysOverdue" integer DEFAULT 0 NOT NULL,
	"totalOutstanding" integer NOT NULL,
	"lastPaymentDate" timestamp,
	"collectionAttempts" integer DEFAULT 0 NOT NULL,
	"lastCollectionAttempt" timestamp,
	"hardshipProgram" varchar(100),
	"hardshipStartDate" timestamp,
	"hardshipEndDate" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kycVerification" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"status" "kyc_status" DEFAULT 'not_started' NOT NULL,
	"ssnVerified" boolean DEFAULT false NOT NULL,
	"ssnVerifiedAt" timestamp,
	"itin" varchar(20),
	"itinVerified" boolean DEFAULT false NOT NULL,
	"addressVerified" boolean DEFAULT false NOT NULL,
	"addressVerifiedAt" timestamp,
	"documentsUploaded" boolean DEFAULT false NOT NULL,
	"documentSubmittedAt" timestamp,
	"facialRecognitionCompleted" boolean DEFAULT false NOT NULL,
	"livenessCheckCompleted" boolean DEFAULT false NOT NULL,
	"ofacCheckCompleted" boolean DEFAULT false NOT NULL,
	"ofacClear" boolean DEFAULT true NOT NULL,
	"rejectionReason" text,
	"approvedAt" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kycVerification_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "loanOffers" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"loanType" "loan_type_extended" NOT NULL,
	"minAmount" integer NOT NULL,
	"maxAmount" integer NOT NULL,
	"suggestedAmount" integer,
	"aprMin" varchar(10) NOT NULL,
	"aprMax" varchar(10) NOT NULL,
	"estimatedApr" varchar(10),
	"minTerm" integer NOT NULL,
	"maxTerm" integer NOT NULL,
	"recommendedTerm" integer,
	"offerType" varchar(50) NOT NULL,
	"softPullCompleted" boolean DEFAULT false NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"acceptedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paymentAuditLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"paymentId" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"oldStatus" "payment_status",
	"newStatus" "payment_status",
	"metadata" text,
	"userId" integer,
	"ipAddress" varchar(45),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paymentIdempotencyLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"idempotencyKey" varchar(255) NOT NULL,
	"paymentId" integer NOT NULL,
	"responseData" text,
	"status" varchar(50) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "paymentIdempotencyLog_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "paymentSchedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"loanApplicationId" integer NOT NULL,
	"installmentNumber" integer NOT NULL,
	"dueDate" timestamp NOT NULL,
	"dueAmount" integer NOT NULL,
	"principalAmount" integer NOT NULL,
	"interestAmount" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"paidAmount" integer DEFAULT 0 NOT NULL,
	"paidAt" timestamp,
	"lateFeeApplied" boolean DEFAULT false NOT NULL,
	"lateFeeAmount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referralProgram" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrerId" integer NOT NULL,
	"referredUserId" integer,
	"referralCode" varchar(50) NOT NULL,
	"referralLink" varchar(500) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"completedAt" timestamp,
	"referrerBonus" integer,
	"referredBonus" integer,
	"bonusType" varchar(50) DEFAULT 'credit' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp,
	CONSTRAINT "referralProgram_referralCode_unique" UNIQUE("referralCode"),
	CONSTRAINT "referralProgram_referralLink_unique" UNIQUE("referralLink")
);
--> statement-breakpoint
CREATE TABLE "supportTickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"subject" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"category" varchar(100),
	"assignedTo" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "ticketMessages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"userId" integer NOT NULL,
	"message" text NOT NULL,
	"attachmentUrl" varchar(500),
	"isFromAdmin" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploadedDocuments" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"documentType" "document_type" NOT NULL,
	"filename" varchar(255) NOT NULL,
	"storagePath" varchar(500) NOT NULL,
	"fileSize" integer NOT NULL,
	"mimeType" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"verifiedBy" integer,
	"rejectionReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"verifiedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "userAddresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"street" varchar(255) NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(2) NOT NULL,
	"zipCode" varchar(10) NOT NULL,
	"country" varchar(2) DEFAULT 'US' NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"isPrimary" boolean DEFAULT false NOT NULL,
	"verifiedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userDevices" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"deviceName" varchar(255),
	"deviceType" "device_type" NOT NULL,
	"deviceId" varchar(255) NOT NULL,
	"ipAddress" varchar(45) NOT NULL,
	"userAgent" text NOT NULL,
	"lastUsedAt" timestamp DEFAULT now() NOT NULL,
	"isTrusted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userNotifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"relatedLoanId" integer,
	"actionUrl" varchar(500),
	"sentViaEmail" boolean DEFAULT false NOT NULL,
	"sentViaSms" boolean DEFAULT false NOT NULL,
	"sentViaPush" boolean DEFAULT false NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"readAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userPreferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"preferredLanguage" varchar(10) DEFAULT 'en' NOT NULL,
	"preferredCurrency" varchar(3) DEFAULT 'USD' NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"notificationChannels" text,
	"receiveMarketingEmails" boolean DEFAULT true NOT NULL,
	"receiveSmsNotifications" boolean DEFAULT true NOT NULL,
	"receivePushNotifications" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userPreferences_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "userRewardsBalance" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"creditBalance" integer DEFAULT 0 NOT NULL,
	"cashbackBalance" integer DEFAULT 0 NOT NULL,
	"totalEarned" integer DEFAULT 0 NOT NULL,
	"totalRedeemed" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userRewardsBalance_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "userTwoFactorAuth" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"method" "twofa_method" NOT NULL,
	"isEnabled" boolean DEFAULT false NOT NULL,
	"secret" varchar(255),
	"backupCodes" text,
	"verifiedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userTwoFactorAuth_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "disbursements" ADD COLUMN "trackingNumber" varchar(255);--> statement-breakpoint
ALTER TABLE "disbursements" ADD COLUMN "trackingCompany" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");