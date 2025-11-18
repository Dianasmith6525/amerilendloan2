CREATE TYPE "public"."activity_type" AS ENUM('password_changed', 'email_changed', 'bank_info_updated', 'profile_updated', 'document_uploaded', 'login_attempt', 'suspicious_activity', 'settings_changed');--> statement-breakpoint
CREATE TYPE "public"."notification_pref" AS ENUM('email_updates', 'loan_updates', 'promotions', 'sms');--> statement-breakpoint
CREATE TABLE "accountActivity" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"activityType" "activity_type" NOT NULL,
	"description" text NOT NULL,
	"ipAddress" varchar(45),
	"userAgent" text,
	"suspicious" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emailVerificationTokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"newEmail" varchar(320) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "emailVerificationTokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "loginAttempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"ipAddress" varchar(45) NOT NULL,
	"successful" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificationPreferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"preferenceType" "notification_pref" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userSessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"sessionToken" varchar(255) NOT NULL,
	"ipAddress" varchar(45),
	"userAgent" text,
	"lastActivityAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userSessions_sessionToken_unique" UNIQUE("sessionToken")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "passwordHash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bankAccountHolderName" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bankAccountNumber" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bankRoutingNumber" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bankAccountType" varchar(20);