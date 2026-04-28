CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended', 'banned', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."banking_transaction_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'on_hold', 'returned');--> statement-breakpoint
CREATE TYPE "public"."banking_transaction_type" AS ENUM('wire_transfer', 'ach_deposit', 'ach_withdrawal', 'mobile_deposit', 'bill_pay', 'internal_transfer', 'direct_deposit', 'loan_disbursement', 'loan_payment', 'fee', 'interest', 'refund');--> statement-breakpoint
CREATE TYPE "public"."invitation_code_status" AS ENUM('active', 'redeemed', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."job_application_status" AS ENUM('pending', 'under_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."physical_card_status" AS ENUM('pending', 'approved', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."virtual_card_status" AS ENUM('active', 'frozen', 'expired', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'wire';--> statement-breakpoint
ALTER TYPE "public"."payment_provider" ADD VALUE 'wire';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'pending_verification' BEFORE 'succeeded';--> statement-breakpoint
ALTER TYPE "public"."verification_doc_type" ADD VALUE 'selfie_with_id' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"type" varchar(50) NOT NULL,
	"conditions" text NOT NULL,
	"action" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banking_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"type" "banking_transaction_type" NOT NULL,
	"status" "banking_transaction_status" DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"description" text NOT NULL,
	"memo" text,
	"recipient_name" varchar(255),
	"recipient_account_number" varchar(50),
	"recipient_routing_number" varchar(20),
	"recipient_bank_name" varchar(255),
	"recipient_email" varchar(320),
	"payee_name" varchar(255),
	"payee_account_number" varchar(100),
	"bill_category" varchar(50),
	"check_image_front" text,
	"check_image_back" text,
	"check_number" varchar(20),
	"swift_code" varchar(11),
	"wire_reference" varchar(50),
	"to_account_id" integer,
	"reference_number" varchar(50) NOT NULL,
	"confirmation_number" varchar(50),
	"processing_date" timestamp,
	"completed_at" timestamp,
	"failure_reason" text,
	"running_balance" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_bank_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_name" varchar(255) NOT NULL,
	"account_holder_name" varchar(255) NOT NULL,
	"routing_number" varchar(20) NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"account_type" varchar(20) DEFAULT 'checking' NOT NULL,
	"swift_code" varchar(20),
	"bank_address" text,
	"instructions" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "email_reminder_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"reminder_type" varchar(80) NOT NULL,
	"entity_id" integer,
	"reminder_count" integer DEFAULT 1 NOT NULL,
	"last_sent_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"recipient_email" varchar(320) NOT NULL,
	"recipient_name" varchar(255),
	"offer_amount" integer,
	"offer_apr" integer,
	"offer_term_months" integer,
	"offer_description" text,
	"status" "invitation_code_status" DEFAULT 'active' NOT NULL,
	"redeemed_by" integer,
	"redeemed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"last_reminder_sent_at" timestamp,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"created_by" integer NOT NULL,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"position" varchar(255) NOT NULL,
	"resume_file_name" varchar(500),
	"cover_letter" text NOT NULL,
	"status" "job_application_status" DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "physical_card_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"virtual_card_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"shipping_name" varchar(255) NOT NULL,
	"shipping_address1" varchar(255) NOT NULL,
	"shipping_address2" varchar(255),
	"shipping_city" varchar(100) NOT NULL,
	"shipping_state" varchar(50) NOT NULL,
	"shipping_zip" varchar(20) NOT NULL,
	"shipping_country" varchar(50) DEFAULT 'US' NOT NULL,
	"shipping_method" varchar(50) DEFAULT 'standard' NOT NULL,
	"carrier" varchar(50),
	"tracking_number" varchar(100),
	"tracking_url" text,
	"physical_card_last4" varchar(4),
	"status" "physical_card_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"processing_at" timestamp,
	"shipped_at" timestamp,
	"estimated_delivery_date" timestamp,
	"delivered_at" timestamp,
	"cancelled_at" timestamp,
	"approved_by" integer,
	"admin_notes" text,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_bill_pay" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"payee_name" varchar(255) NOT NULL,
	"payee_account_number" varchar(100),
	"amount" integer NOT NULL,
	"frequency" varchar(20) NOT NULL,
	"next_payment_date" timestamp NOT NULL,
	"bill_category" varchar(50),
	"memo" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"payment_reminders" boolean DEFAULT true NOT NULL,
	"payment_confirmations" boolean DEFAULT true NOT NULL,
	"loan_status_updates" boolean DEFAULT true NOT NULL,
	"document_notifications" boolean DEFAULT true NOT NULL,
	"promotional_notifications" boolean DEFAULT false NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"email_digest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "virtual_card_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"merchant_name" varchar(255) NOT NULL,
	"merchant_category" varchar(100),
	"description" text,
	"transaction_status" varchar(20) DEFAULT 'completed' NOT NULL,
	"decline_reason" text,
	"reference_number" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "virtual_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"loan_application_id" integer,
	"card_number" varchar(500) NOT NULL,
	"card_number_last4" varchar(4) NOT NULL,
	"expiry_month" varchar(2) NOT NULL,
	"expiry_year" varchar(4) NOT NULL,
	"cvv" varchar(500) NOT NULL,
	"cardholder_name" varchar(255) NOT NULL,
	"card_label" varchar(100),
	"card_color" varchar(20) DEFAULT 'blue',
	"current_balance" integer DEFAULT 0 NOT NULL,
	"credit_limit" integer DEFAULT 0 NOT NULL,
	"daily_spend_limit" integer DEFAULT 500000 NOT NULL,
	"monthly_spend_limit" integer DEFAULT 2500000 NOT NULL,
	"daily_spent" integer DEFAULT 0 NOT NULL,
	"monthly_spent" integer DEFAULT 0 NOT NULL,
	"daily_spent_reset_at" timestamp DEFAULT now() NOT NULL,
	"monthly_spent_reset_at" timestamp DEFAULT now() NOT NULL,
	"online_transactions_enabled" boolean DEFAULT true NOT NULL,
	"international_transactions_enabled" boolean DEFAULT false NOT NULL,
	"atm_withdrawals_enabled" boolean DEFAULT true NOT NULL,
	"contactless_enabled" boolean DEFAULT true NOT NULL,
	"status" "virtual_card_status" DEFAULT 'active' NOT NULL,
	"frozen_reason" text,
	"frozen_by" integer,
	"frozen_at" timestamp,
	"issued_by" integer,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loanApplications" ALTER COLUMN "ssn" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "ssn" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "bankAccountNumber" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "bankRoutingNumber" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "bankAccounts" ADD COLUMN "balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bankAccounts" ADD COLUMN "availableBalance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bankAccounts" ADD COLUMN "isFrozen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bankAccounts" ADD COLUMN "frozenAt" timestamp;--> statement-breakpoint
ALTER TABLE "bankAccounts" ADD COLUMN "frozenReason" text;--> statement-breakpoint
ALTER TABLE "bankAccounts" ADD COLUMN "frozenBy" integer;--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "loanAccountNumber" varchar(20);--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "ssnHash" varchar(64);--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "disbursementAccountHolderName" varchar(255);--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "disbursementAccountNumber" varchar(500);--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "disbursementRoutingNumber" varchar(255);--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "disbursementAccountType" varchar(20);--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "isLocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "lockedAt" timestamp;--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "lockedReason" text;--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "lockedBy" integer;--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "invitationCode" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accountStatus" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspendedAt" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspendedReason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspendedBy" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bannedAt" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bannedReason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bannedBy" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "adminNotes" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "forcePasswordReset" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "loginCount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lastLoginIp" varchar(45);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ssnLastFour" varchar(4);--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banking_transactions" ADD CONSTRAINT "banking_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banking_transactions" ADD CONSTRAINT "banking_transactions_account_id_bankAccounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bankAccounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banking_transactions" ADD CONSTRAINT "banking_transactions_to_account_id_bankAccounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."bankAccounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_bank_settings" ADD CONSTRAINT "company_bank_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_card_requests" ADD CONSTRAINT "physical_card_requests_virtual_card_id_virtual_cards_id_fk" FOREIGN KEY ("virtual_card_id") REFERENCES "public"."virtual_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_card_requests" ADD CONSTRAINT "physical_card_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_card_requests" ADD CONSTRAINT "physical_card_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill_pay" ADD CONSTRAINT "recurring_bill_pay_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill_pay" ADD CONSTRAINT "recurring_bill_pay_account_id_bankAccounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bankAccounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_card_transactions" ADD CONSTRAINT "virtual_card_transactions_card_id_virtual_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."virtual_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_card_transactions" ADD CONSTRAINT "virtual_card_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_cards" ADD CONSTRAINT "virtual_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_cards" ADD CONSTRAINT "virtual_cards_loan_application_id_loanApplications_id_fk" FOREIGN KEY ("loan_application_id") REFERENCES "public"."loanApplications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_cards" ADD CONSTRAINT "virtual_cards_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "banking_tx_userId_idx" ON "banking_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "banking_tx_accountId_idx" ON "banking_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "banking_tx_type_idx" ON "banking_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "banking_tx_status_idx" ON "banking_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "banking_tx_refNum_idx" ON "banking_transactions" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "banking_tx_createdAt_idx" ON "banking_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "phys_card_virtualCardId_idx" ON "physical_card_requests" USING btree ("virtual_card_id");--> statement-breakpoint
CREATE INDEX "phys_card_userId_idx" ON "physical_card_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "phys_card_status_idx" ON "physical_card_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vcard_tx_cardId_idx" ON "virtual_card_transactions" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "vcard_tx_userId_idx" ON "virtual_card_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "virtual_cards_userId_idx" ON "virtual_cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "virtual_cards_loanAppId_idx" ON "virtual_cards" USING btree ("loan_application_id");--> statement-breakpoint
CREATE INDEX "virtual_cards_status_idx" ON "virtual_cards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disbursements_loanAppId_idx" ON "disbursements" USING btree ("loanApplicationId");--> statement-breakpoint
CREATE INDEX "disbursements_userId_idx" ON "disbursements" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "disbursements_status_idx" ON "disbursements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loanApp_userId_idx" ON "loanApplications" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "loanApp_status_idx" ON "loanApplications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loanApp_trackingNumber_idx" ON "loanApplications" USING btree ("trackingNumber");--> statement-breakpoint
CREATE INDEX "loanApp_email_idx" ON "loanApplications" USING btree ("email");--> statement-breakpoint
CREATE INDEX "loanApp_ssnHash_idx" ON "loanApplications" USING btree ("ssnHash");--> statement-breakpoint
CREATE INDEX "payments_loanAppId_idx" ON "payments" USING btree ("loanApplicationId");--> statement-breakpoint
CREATE INDEX "payments_userId_idx" ON "payments" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_openId_idx" ON "users" USING btree ("openId");--> statement-breakpoint
CREATE INDEX "users_phoneNumber_idx" ON "users" USING btree ("phoneNumber");--> statement-breakpoint
ALTER TABLE "loanApplications" ADD CONSTRAINT "loanApplications_loanAccountNumber_unique" UNIQUE("loanAccountNumber");