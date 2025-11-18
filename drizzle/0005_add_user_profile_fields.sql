-- Add personal information fields to users table
ALTER TABLE "users" ADD COLUMN "firstName" varchar(100);
ALTER TABLE "users" ADD COLUMN "lastName" varchar(100);
ALTER TABLE "users" ADD COLUMN "phoneNumber" varchar(20);
ALTER TABLE "users" ADD COLUMN "ssn" varchar(11);
ALTER TABLE "users" ADD COLUMN "dateOfBirth" varchar(10);
ALTER TABLE "users" ADD COLUMN "bio" text;
ALTER TABLE "users" ADD COLUMN "preferredLanguage" varchar(10) DEFAULT 'en';

-- Add address fields to users table
ALTER TABLE "users" ADD COLUMN "street" varchar(255);
ALTER TABLE "users" ADD COLUMN "city" varchar(100);
ALTER TABLE "users" ADD COLUMN "state" varchar(2);
ALTER TABLE "users" ADD COLUMN "zipCode" varchar(10);
ALTER TABLE "users" ADD COLUMN "timezone" varchar(50) DEFAULT 'UTC';
