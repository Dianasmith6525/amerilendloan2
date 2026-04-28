DO $$ BEGIN CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"subject" varchar(500) NOT NULL,
	"recipient_count" integer NOT NULL,
	"sent_by" integer,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"campaign_id" integer,
	"description" text,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" integer NOT NULL,
	"max_uses" integer,
	"current_uses" integer DEFAULT 0 NOT NULL,
	"min_loan_amount" integer,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "resume_file_url" text;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "reply_message" text;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "rejection_reasons" text;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "marketing_email_log" ADD CONSTRAINT "marketing_email_log_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "marketing_email_log" ADD CONSTRAINT "marketing_email_log_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disbursements_createdAt_idx" ON "disbursements" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loanApp_createdAt_idx" ON "loanApplications" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_createdAt_idx" ON "payments" USING btree ("createdAt");