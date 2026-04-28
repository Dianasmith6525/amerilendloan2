CREATE TYPE "public"."closure_reason" AS ENUM('no_longer_needed', 'switching_lender', 'privacy_concerns', 'service_quality', 'other');--> statement-breakpoint
CREATE TYPE "public"."chat_message_status" AS ENUM('sent', 'delivered', 'read');--> statement-breakpoint
CREATE TYPE "public"."co_signer_status" AS ENUM('invited', 'accepted', 'declined', 'released');--> statement-breakpoint
CREATE TYPE "public"."e_signature_status" AS ENUM('pending', 'signed', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."hardship_program_type" AS ENUM('forbearance', 'deferment', 'payment_reduction', 'term_extension', 'settlement');--> statement-breakpoint
CREATE TYPE "public"."payment_allocation_strategy" AS ENUM('standard', 'principal_first', 'future_payments', 'biweekly', 'round_up');--> statement-breakpoint
CREATE TYPE "public"."tax_document_type" AS ENUM('1098', '1099_c', 'interest_statement');--> statement-breakpoint
CREATE TABLE "account_closure_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"reason" "closure_reason" NOT NULL,
	"detailed_reason" text,
	"has_outstanding_loans" boolean DEFAULT false,
	"data_export_requested" boolean DEFAULT false,
	"data_exported_at" timestamp,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"admin_notes" text,
	"scheduled_deletion_date" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canned_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(50) NOT NULL,
	"shortcut" varchar(20),
	"title" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "canned_responses_shortcut_unique" UNIQUE("shortcut")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"message" text NOT NULL,
	"is_from_agent" boolean DEFAULT false,
	"status" "chat_message_status" DEFAULT 'sent' NOT NULL,
	"attachment_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"assigned_to_agent_id" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"subject" varchar(255),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"rating" integer,
	"feedback_comment" text
);
--> statement-breakpoint
CREATE TABLE "co_signers" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_application_id" integer NOT NULL,
	"primary_borrower_id" integer NOT NULL,
	"co_signer_email" varchar(320) NOT NULL,
	"co_signer_name" varchar(255),
	"co_signer_user_id" integer,
	"invitation_token" varchar(100),
	"status" "co_signer_status" DEFAULT 'invited' NOT NULL,
	"liability_split" integer DEFAULT 50,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"release_eligible_at" timestamp,
	"released_at" timestamp,
	"released_by" integer,
	CONSTRAINT "co_signers_invitation_token_unique" UNIQUE("invitation_token")
);
--> statement-breakpoint
CREATE TABLE "collection_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"delinquency_record_id" integer NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"action_date" timestamp DEFAULT now() NOT NULL,
	"performed_by" integer,
	"outcome" varchar(50),
	"notes" text,
	"next_action_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "delinquency_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_application_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" "delinquency_status" NOT NULL,
	"days_delinquent" integer NOT NULL,
	"total_amount_due" integer NOT NULL,
	"last_payment_date" timestamp,
	"next_action_date" timestamp,
	"assigned_collector_id" integer,
	"collection_attempts" integer DEFAULT 0,
	"last_contact_date" timestamp,
	"last_contact_method" varchar(20),
	"promise_to_pay_date" timestamp,
	"promise_to_pay_amount" integer,
	"settlement_offered" boolean DEFAULT false,
	"settlement_amount" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "e_signature_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_application_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"document_title" varchar(255) NOT NULL,
	"document_path" text NOT NULL,
	"provider_document_id" varchar(255),
	"signer_email" varchar(320) NOT NULL,
	"signer_name" varchar(255) NOT NULL,
	"status" "e_signature_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"signed_document_path" text,
	"ip_address" varchar(45),
	"audit_trail" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fraud_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"loan_application_id" integer,
	"session_id" varchar(100),
	"device_fingerprint" text,
	"ip_address" varchar(45) NOT NULL,
	"ip_country" varchar(2),
	"ip_city" varchar(100),
	"ip_risk_score" integer,
	"velocity_score" integer,
	"risk_score" integer NOT NULL,
	"risk_level" varchar(20) NOT NULL,
	"flagged_reasons" text,
	"requires_manual_review" boolean DEFAULT false,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hardship_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_application_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"program_type" "hardship_program_type" NOT NULL,
	"reason" text NOT NULL,
	"monthly_income_change" integer,
	"proposed_payment_amount" integer,
	"requested_duration" integer,
	"supporting_documents" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"approved_duration" integer,
	"approved_payment_amount" integer,
	"start_date" timestamp,
	"end_date" timestamp,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_name" varchar(255) NOT NULL,
	"source" varchar(100),
	"medium" varchar(100),
	"campaign_code" varchar(100),
	"start_date" timestamp,
	"end_date" timestamp,
	"budget" integer,
	"is_active" boolean DEFAULT true,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_campaigns_campaign_code_unique" UNIQUE("campaign_code")
);
--> statement-breakpoint
CREATE TABLE "payment_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"loan_application_id" integer,
	"allocation_strategy" "payment_allocation_strategy" DEFAULT 'standard' NOT NULL,
	"round_up_enabled" boolean DEFAULT false,
	"round_up_to_nearest" integer DEFAULT 100,
	"biweekly_enabled" boolean DEFAULT false,
	"auto_extra_payment_amount" integer,
	"auto_extra_payment_day" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used" timestamp,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "tax_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"loan_application_id" integer,
	"document_type" "tax_document_type" NOT NULL,
	"tax_year" integer NOT NULL,
	"total_interest_paid" integer,
	"total_principal_paid" integer,
	"debt_cancelled" integer,
	"document_path" text,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"sent_to_user" boolean DEFAULT false,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_attribution" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"campaign_id" integer,
	"utm_source" varchar(100),
	"utm_medium" varchar(100),
	"utm_campaign" varchar(100),
	"utm_term" varchar(100),
	"utm_content" varchar(100),
	"referrer_url" text,
	"landing_page" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "delinquencyRecords" CASCADE;--> statement-breakpoint
ALTER TABLE "delinquency_records" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."delinquency_status";--> statement-breakpoint
CREATE TYPE "public"."delinquency_status" AS ENUM('current', 'days_15', 'days_30', 'days_60', 'days_90', 'charged_off', 'in_settlement');--> statement-breakpoint
ALTER TABLE "delinquency_records" ALTER COLUMN "status" SET DATA TYPE "public"."delinquency_status" USING "status"::"public"."delinquency_status";--> statement-breakpoint
ALTER TABLE "account_closure_requests" ADD CONSTRAINT "account_closure_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_closure_requests" ADD CONSTRAINT "account_closure_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_assigned_to_agent_id_users_id_fk" FOREIGN KEY ("assigned_to_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_signers" ADD CONSTRAINT "co_signers_loan_application_id_loanApplications_id_fk" FOREIGN KEY ("loan_application_id") REFERENCES "public"."loanApplications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_signers" ADD CONSTRAINT "co_signers_primary_borrower_id_users_id_fk" FOREIGN KEY ("primary_borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_signers" ADD CONSTRAINT "co_signers_co_signer_user_id_users_id_fk" FOREIGN KEY ("co_signer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_signers" ADD CONSTRAINT "co_signers_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_actions" ADD CONSTRAINT "collection_actions_delinquency_record_id_delinquency_records_id_fk" FOREIGN KEY ("delinquency_record_id") REFERENCES "public"."delinquency_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_actions" ADD CONSTRAINT "collection_actions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_records" ADD CONSTRAINT "delinquency_records_loan_application_id_loanApplications_id_fk" FOREIGN KEY ("loan_application_id") REFERENCES "public"."loanApplications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_records" ADD CONSTRAINT "delinquency_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delinquency_records" ADD CONSTRAINT "delinquency_records_assigned_collector_id_users_id_fk" FOREIGN KEY ("assigned_collector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e_signature_documents" ADD CONSTRAINT "e_signature_documents_loan_application_id_loanApplications_id_fk" FOREIGN KEY ("loan_application_id") REFERENCES "public"."loanApplications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e_signature_documents" ADD CONSTRAINT "e_signature_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_checks" ADD CONSTRAINT "fraud_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_checks" ADD CONSTRAINT "fraud_checks_loan_application_id_loanApplications_id_fk" FOREIGN KEY ("loan_application_id") REFERENCES "public"."loanApplications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_checks" ADD CONSTRAINT "fraud_checks_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardship_requests" ADD CONSTRAINT "hardship_requests_loan_application_id_loanApplications_id_fk" FOREIGN KEY ("loan_application_id") REFERENCES "public"."loanApplications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardship_requests" ADD CONSTRAINT "hardship_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardship_requests" ADD CONSTRAINT "hardship_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_preferences" ADD CONSTRAINT "payment_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_preferences" ADD CONSTRAINT "payment_preferences_loan_application_id_loanApplications_id_fk" FOREIGN KEY ("loan_application_id") REFERENCES "public"."loanApplications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_loan_application_id_loanApplications_id_fk" FOREIGN KEY ("loan_application_id") REFERENCES "public"."loanApplications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_attribution" ADD CONSTRAINT "user_attribution_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_attribution" ADD CONSTRAINT "user_attribution_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE no action ON UPDATE no action;