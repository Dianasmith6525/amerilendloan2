CREATE TYPE "public"."two_factor_method" AS ENUM('totp', 'sms', 'email');--> statement-breakpoint
CREATE TABLE "trustedDevices" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"deviceName" varchar(255) NOT NULL,
	"deviceFingerprint" varchar(255) NOT NULL,
	"userAgent" text,
	"ipAddress" varchar(45),
	"isTrusted" boolean DEFAULT true NOT NULL,
	"lastUsedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trustedDevices_deviceFingerprint_unique" UNIQUE("deviceFingerprint")
);
--> statement-breakpoint
CREATE TABLE "twoFactorAuthentication" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"method" "two_factor_method" DEFAULT 'totp' NOT NULL,
	"totpSecret" varchar(255),
	"totpEnabled" boolean DEFAULT false NOT NULL,
	"phoneNumber" varchar(20),
	"smsEnabled" boolean DEFAULT false NOT NULL,
	"backupCodes" text,
	"backupCodesUsed" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp,
	CONSTRAINT "twoFactorAuthentication_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "userProfiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"firstName" varchar(100),
	"lastName" varchar(100),
	"phoneNumber" varchar(20),
	"dateOfBirth" varchar(10),
	"street" varchar(255),
	"city" varchar(100),
	"state" varchar(2),
	"zipCode" varchar(10),
	"country" varchar(100) DEFAULT 'United States',
	"employmentStatus" varchar(50),
	"employer" varchar(255),
	"jobTitle" varchar(255),
	"monthlyIncome" integer,
	"profilePictureUrl" varchar(500),
	"bio" text,
	"preferredLanguage" varchar(10) DEFAULT 'en',
	"timezone" varchar(50) DEFAULT 'UTC',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userProfiles_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "firstName" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lastName" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phoneNumber" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ssn" varchar(11);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dateOfBirth" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferredLanguage" varchar(10) DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "street" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "state" varchar(2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "zipCode" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" varchar(50) DEFAULT 'UTC';