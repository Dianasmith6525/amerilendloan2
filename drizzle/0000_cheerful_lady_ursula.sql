CREATE TYPE "public"."calculation_mode" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."disbursement_method" AS ENUM('bank_transfer', 'check', 'debit_card', 'paypal', 'crypto');--> statement-breakpoint
CREATE TYPE "public"."disbursement_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('terms_of_service', 'privacy_policy', 'loan_agreement', 'esign_consent');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('employed', 'self_employed', 'unemployed', 'retired');--> statement-breakpoint
CREATE TYPE "public"."loan_application_status" AS ENUM('pending', 'under_review', 'approved', 'fee_pending', 'fee_paid', 'disbursed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."loan_type" AS ENUM('installment', 'short_term');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'crypto');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'authorizenet', 'crypto');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."purpose" AS ENUM('signup', 'login', 'reset');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_doc_type" AS ENUM('drivers_license_front', 'drivers_license_back', 'passport', 'national_id_front', 'national_id_back', 'ssn_card', 'bank_statement', 'utility_bill', 'pay_stub', 'tax_return', 'other');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'under_review', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TABLE "disbursements" (
	"id" serial PRIMARY KEY NOT NULL,
	"loanApplicationId" integer NOT NULL,
	"userId" integer NOT NULL,
	"amount" integer NOT NULL,
	"accountHolderName" varchar(255) NOT NULL,
	"accountNumber" varchar(50) NOT NULL,
	"routingNumber" varchar(20) NOT NULL,
	"status" "disbursement_status" DEFAULT 'pending' NOT NULL,
	"transactionId" varchar(255),
	"failureReason" text,
	"adminNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"initiatedBy" integer
);
--> statement-breakpoint
CREATE TABLE "feeConfiguration" (
	"id" serial PRIMARY KEY NOT NULL,
	"calculationMode" "calculation_mode" DEFAULT 'percentage' NOT NULL,
	"percentageRate" integer DEFAULT 200 NOT NULL,
	"fixedFeeAmount" integer DEFAULT 200 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"updatedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legalAcceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"loanApplicationId" integer,
	"documentType" "doc_type" NOT NULL,
	"documentVersion" varchar(20) NOT NULL,
	"ipAddress" varchar(45),
	"userAgent" text,
	"acceptedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loanApplications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"trackingNumber" varchar(20) NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"dateOfBirth" varchar(10) NOT NULL,
	"ssn" varchar(11) NOT NULL,
	"street" varchar(255) NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(2) NOT NULL,
	"zipCode" varchar(10) NOT NULL,
	"employmentStatus" "employment_status" NOT NULL,
	"employer" varchar(255),
	"monthlyIncome" integer NOT NULL,
	"loanType" "loan_type" NOT NULL,
	"requestedAmount" integer NOT NULL,
	"loanPurpose" text NOT NULL,
	"disbursementMethod" "disbursement_method" NOT NULL,
	"approvedAmount" integer,
	"processingFeeAmount" integer,
	"status" "loan_application_status" DEFAULT 'pending' NOT NULL,
	"rejectionReason" text,
	"adminNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"approvedAt" timestamp,
	"disbursedAt" timestamp,
	CONSTRAINT "loanApplications_trackingNumber_unique" UNIQUE("trackingNumber")
);
--> statement-breakpoint
CREATE TABLE "otpCodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"code" varchar(6) NOT NULL,
	"purpose" "purpose" NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"verified" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"loanApplicationId" integer NOT NULL,
	"userId" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"paymentProvider" "payment_provider" DEFAULT 'stripe' NOT NULL,
	"paymentMethod" "payment_method" DEFAULT 'card' NOT NULL,
	"paymentIntentId" varchar(255),
	"paymentMethodId" varchar(255),
	"cardLast4" varchar(4),
	"cardBrand" varchar(20),
	"cryptoCurrency" varchar(10),
	"cryptoAddress" varchar(255),
	"cryptoTxHash" varchar(255),
	"cryptoAmount" varchar(50),
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"failureReason" text,
	"adminNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "verificationDocuments" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"loanApplicationId" integer,
	"documentType" "verification_doc_type" NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"filePath" text NOT NULL,
	"fileSize" integer NOT NULL,
	"mimeType" varchar(100) NOT NULL,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"reviewedBy" integer,
	"reviewedAt" timestamp,
	"rejectionReason" text,
	"adminNotes" text,
	"expiryDate" varchar(10),
	"documentNumber" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
