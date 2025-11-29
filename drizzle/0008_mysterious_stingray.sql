CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"user_id" integer,
	"ip_address" varchar(45),
	"user_agent" text,
	"severity" varchar(20) NOT NULL,
	"description" text NOT NULL,
	"metadata" text,
	"resource_type" varchar(50),
	"resource_id" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_pay_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"loanApplicationId" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"reason" text,
	"attemptedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_application_id" integer NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"uploaded_by" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text
);
--> statement-breakpoint
CREATE TABLE "payment_extension_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_application_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"extension_days" integer NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"loanApplicationId" integer NOT NULL,
	"reminderType" varchar(50) NOT NULL,
	"daysUntilDue" integer NOT NULL,
	"sentAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savedPaymentMethods" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"cardBrand" varchar(50),
	"last4" varchar(4),
	"expiryMonth" varchar(2),
	"expiryYear" varchar(4),
	"nameOnCard" varchar(255),
	"walletAddress" varchar(255),
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "uploadedDocuments" ADD COLUMN "loanApplicationId" integer;--> statement-breakpoint
ALTER TABLE "uploadedDocuments" ADD COLUMN "file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "uploadedDocuments" ADD COLUMN "file_url" varchar(500);--> statement-breakpoint
ALTER TABLE "uploadedDocuments" ADD COLUMN "verification_status" varchar(50) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "uploadedDocuments" ADD COLUMN "verification_metadata" text;--> statement-breakpoint
ALTER TABLE "uploadedDocuments" ADD COLUMN "uploaded_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "uploadedDocuments" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_documents" ADD CONSTRAINT "loan_documents_loan_application_id_loanApplications_id_fk" FOREIGN KEY ("loan_application_id") REFERENCES "public"."loanApplications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_documents" ADD CONSTRAINT "loan_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_documents" ADD CONSTRAINT "loan_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_extension_requests" ADD CONSTRAINT "payment_extension_requests_loan_application_id_loanApplications_id_fk" FOREIGN KEY ("loan_application_id") REFERENCES "public"."loanApplications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_extension_requests" ADD CONSTRAINT "payment_extension_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_extension_requests" ADD CONSTRAINT "payment_extension_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;