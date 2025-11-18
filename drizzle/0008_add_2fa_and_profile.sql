-- Create 2FA method enum
CREATE TYPE "public"."two_factor_method" AS ENUM('totp', 'sms', 'email');

-- Create Two-Factor Authentication table
CREATE TABLE IF NOT EXISTS "public"."twoFactorAuthentication" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL UNIQUE,
	"enabled" boolean DEFAULT false NOT NULL,
	"method" "public"."two_factor_method" DEFAULT 'totp' NOT NULL,
	"totpSecret" varchar(255),
	"totpEnabled" boolean DEFAULT false NOT NULL,
	"phoneNumber" varchar(20),
	"smsEnabled" boolean DEFAULT false NOT NULL,
	"backupCodes" text,
	"backupCodesUsed" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp
);

-- Create User Profiles table
CREATE TABLE IF NOT EXISTS "public"."userProfiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL UNIQUE,
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
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

-- Create Trusted Devices table
CREATE TABLE IF NOT EXISTS "public"."trustedDevices" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"deviceName" varchar(255) NOT NULL,
	"deviceFingerprint" varchar(255) NOT NULL UNIQUE,
	"userAgent" text,
	"ipAddress" varchar(45),
	"isTrusted" boolean DEFAULT true NOT NULL,
	"lastUsedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "twoFactorAuth_userId_idx" ON "public"."twoFactorAuthentication" ("userId");
CREATE INDEX IF NOT EXISTS "userProfiles_userId_idx" ON "public"."userProfiles" ("userId");
CREATE INDEX IF NOT EXISTS "trustedDevices_userId_idx" ON "public"."trustedDevices" ("userId");
