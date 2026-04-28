import { z } from "zod";
import { logger } from "./logger";

// Define validation schema for critical environment variables
const envSchema = z.object({
  // Core — required for the app to function at all
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters for security"),
  VITE_APP_ID: z.string().min(1, "VITE_APP_ID is required"),

  // OAuth
  OAUTH_SERVER_URL: z.string().optional().default(""),
  OWNER_OPEN_ID: z.string().optional().default(""),

  // Forge
  BUILT_IN_FORGE_API_URL: z.string().optional().default(""),
  BUILT_IN_FORGE_API_KEY: z.string().optional().default(""),

  // OpenAI
  OPENAI_API_KEY: z.string().optional().default(""),

  // Groq (free tier, OpenAI-compatible — used as primary LLM when set)
  GROQ_API_KEY: z.string().optional().default(""),

  // Google Gemini (free tier — used as fallback when Groq/OpenAI not set)
  GEMINI_API_KEY: z.string().optional().default(""),

  // Twilio (SMS)
  TWILIO_ACCOUNT_SID: z.string().optional().default(""),
  TWILIO_AUTH_TOKEN: z.string().optional().default(""),
  TWILIO_PHONE_NUMBER: z.string().optional().default(""),

  // SendGrid (email)
  SENDGRID_API_KEY: z.string().optional().default(""),
  SENDGRID_VERIFIED_EMAIL: z.string().email().optional().default("noreply@amerilendloan.com"),
  EMAIL_TEST_MODE: z.string().optional().default("false"),

  // Supabase
  VITE_SUPABASE_URL: z.string().optional().default(""),
  VITE_SUPABASE_ANON_KEY: z.string().optional().default(""),

  // OAuth Social
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GITHUB_CLIENT_ID: z.string().optional().default(""),
  GITHUB_CLIENT_SECRET: z.string().optional().default(""),
  MICROSOFT_CLIENT_ID: z.string().optional().default(""),
  MICROSOFT_CLIENT_SECRET: z.string().optional().default(""),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be at least 32 characters").optional().default(""),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),

  // Admin
  ADMIN_EMAIL: z.string().optional().default("admin@amerilendloan.com"),

  // Cloudflare Turnstile (bot verification on public forms)
  TURNSTILE_SECRET_KEY: z.string().optional().default(""),
  VITE_TURNSTILE_SITE_KEY: z.string().optional().default(""),

  // Node env
  NODE_ENV: z.string().optional().default("development"),
});

// Parse and validate env vars at startup
function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const missing = Object.entries(errors)
      .map(([key, msgs]) => `  - ${key}: ${(msgs ?? []).join(", ")}`)
      .join("\n");
    logger.error(`\n[env] Missing or invalid environment variables:\n${missing}\n`);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
  return result.success ? result.data : null;
}

const validated = validateEnv();

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER ?? "",
  sendGridApiKey: process.env.SENDGRID_API_KEY ?? "",
  sendGridVerifiedEmail: process.env.SENDGRID_VERIFIED_EMAIL ?? "noreply@amerilendloan.com",
  emailTestMode: process.env.EMAIL_TEST_MODE === "true",
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  microsoftClientId: process.env.MICROSOFT_CLIENT_ID ?? "",
  microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@amerilendloan.com",
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? "",
  turnstileSiteKey: process.env.VITE_TURNSTILE_SITE_KEY ?? "",
  viteAppUrl: process.env.VITE_APP_URL ?? "",
  // When running multiple replicas, set RUN_SCHEDULERS=false on all but one
  // instance to prevent duplicate cron executions (auto-pay charges, reminders,
  // backups, KYC expiry sweeps). Defaults to true for single-instance deploys.
  runSchedulers: (process.env.RUN_SCHEDULERS ?? "true").toLowerCase() !== "false",
};

export function getEnv() {
  return {
    GOOGLE_CLIENT_ID: ENV.googleClientId,
    GOOGLE_CLIENT_SECRET: ENV.googleClientSecret,
    GITHUB_CLIENT_ID: ENV.githubClientId,
    GITHUB_CLIENT_SECRET: ENV.githubClientSecret,
    MICROSOFT_CLIENT_ID: ENV.microsoftClientId,
    MICROSOFT_CLIENT_SECRET: ENV.microsoftClientSecret,
  };
}
