CREATE TABLE "auto_pay_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"loan_application_id" integer,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"bank_account_id" varchar(255),
	"card_last4" varchar(4),
	"payment_day" integer NOT NULL,
	"amount" integer,
	"next_payment_date" timestamp,
	"last_payment_date" timestamp,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"location" varchar(255),
	"device_type" varchar(50),
	"browser" varchar(100),
	"success" boolean NOT NULL,
	"failure_reason" varchar(255),
	"two_factor_used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_factor_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "two_factor_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "bankName" varchar(255);--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "bankUsername" varchar(255);--> statement-breakpoint
ALTER TABLE "loanApplications" ADD COLUMN "bankPassword" varchar(500);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twoFactorEnabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twoFactorSecret" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twoFactorBackupCodes" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twoFactorMethod" varchar(20);--> statement-breakpoint
ALTER TABLE "auto_pay_settings" ADD CONSTRAINT "auto_pay_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_pay_settings" ADD CONSTRAINT "auto_pay_settings_loan_application_id_loanApplications_id_fk" FOREIGN KEY ("loan_application_id") REFERENCES "public"."loanApplications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_activity" ADD CONSTRAINT "login_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor_sessions" ADD CONSTRAINT "two_factor_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;