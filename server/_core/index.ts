import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./static";
import { ENV } from "./env";
import { storagePut } from "../storage";
import { sdk } from "./sdk";
import { errorHandlerMiddleware, malformedJsonHandler, notFoundHandler, healthCheckHandler, validateJsonRequest } from "./error-handler";
import { ensureJsonHeaders } from "./response-formatter";
import { validatePayload, validateContentLength } from "./payload-validator";
import { initializePaymentNotificationScheduler, shutdownPaymentNotificationScheduler } from "./paymentScheduler";
import { startAutoPayScheduler } from "./auto-pay-scheduler";
import { initializeReminderScheduler, shutdownReminderScheduler } from "./reminderScheduler";
import { initializeCronJobs, stopAllCronJobs } from "./cron-jobs";
import { initSentry, sentryErrorHandler } from "./monitoring";
import { startBackupScheduler, stopBackupScheduler, createPreMigrationBackup } from "./database-backup";
import { healthCheck, readinessCheck, livenessCheck, metricsEndpoint } from "./health-checks";
import { apiLimiter, authLimiter, contactLimiter, paymentLimiter, uploadLimiter, adminLimiter } from "./rate-limiting";
import { handleFileUpload, handleFileDownload, upload } from "./upload-handler";
import { registerAdminEmailActionRoutes } from "./admin-email-actions";
import { logger } from "./logger";
import { getSessionCookieOptions } from "./cookies";
import { COOKIE_NAME, SESSION_COOKIE_MS } from "../../shared/const";
import { redeemSessionCode } from "./session-code";

// Validate critical environment variables at startup
// (Zod validation in env.ts handles the detailed checks;
//  this logs a quick summary for operators)
function validateEnvironment() {
  const missing: string[] = [];

  if (!ENV.databaseUrl) missing.push("DATABASE_URL");
  if (!ENV.cookieSecret) missing.push("JWT_SECRET");
  if (!ENV.appId) missing.push("VITE_APP_ID");

  if (missing.length > 0) {
    logger.warn("Missing critical environment variables", { missing });
  } else {
    logger.info("All critical environment variables configured");
  }

  // Integration sanity checks — warn loudly on misconfigurations that we have
  // hit in production (Stripe publishable key set but secret/webhook empty).
  // These don't crash the server (some deploys legitimately disable Stripe)
  // but they will be obvious in logs and surfaced via /health/detailed.
  if (ENV.stripePublishableKey && !ENV.stripeSecretKey) {
    logger.error(
      "[Startup] STRIPE MISCONFIGURED: STRIPE_PUBLISHABLE_KEY is set but " +
      "STRIPE_SECRET_KEY is empty. Card payments will fail server-side.",
    );
  }
  if (ENV.stripeSecretKey && !ENV.stripeWebhookSecret) {
    logger.error(
      "[Startup] STRIPE MISCONFIGURED: STRIPE_SECRET_KEY is set but " +
      "STRIPE_WEBHOOK_SECRET is empty. Webhook deliveries will be rejected.",
    );
  }
  if (ENV.isProduction && ENV.cookieSecret.length < 32) {
    logger.error("[Startup] JWT_SECRET is too short for production (<32 chars).");
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Setup global error handlers FIRST (before anything can fail)
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason: String(reason) });
  });
  
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
  });

  // Validate environment variables first
  validateEnvironment();
  
  // Run database migrations on startup to ensure schema is up-to-date
  if (process.env.DATABASE_URL) {
    try {
      // Create a safety backup BEFORE running migrations
      logger.info("Creating pre-migration safety backup...");
      await createPreMigrationBackup();
    } catch (backupError) {
      logger.warn("Pre-migration backup failed (continuing with migration)", backupError);
    }

    try {
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        // Use process.cwd() to resolve migrations folder relative to where the server runs
        const migrationsPath = path.resolve(process.cwd(), "drizzle");
        await migrate(db, { migrationsFolder: migrationsPath });
        logger.info("Database migrations applied successfully");
      }
    } catch (migrationError) {
      logger.warn("Database migration failed (non-fatal, tables may already exist)", migrationError);
    }

    // Safety net: ensure critical columns exist even if migrations failed
    try {
      const { getDb } = await import("../db");
      const { sql: rawSql } = await import("drizzle-orm");
      const safetyDb = await getDb();
      if (safetyDb) {
        await safetyDb.execute(rawSql`ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "resume_file_url" text`);
        await safetyDb.execute(rawSql`ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "reply_message" text`);
        await safetyDb.execute(rawSql`ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "rejection_reasons" text`);
        await safetyDb.execute(rawSql`ALTER TABLE "loanApplications" ADD COLUMN IF NOT EXISTS "lastFeeReminderAt" timestamp`);
        logger.info("Critical column safety check passed");
      }
    } catch (safetyError) {
      logger.warn("Column safety check failed (non-fatal)", safetyError);
    }
  }
  
  logger.info("Global error handlers installed");
  
  const app = express();
  const server = createServer(app);
  
  // Initialize Sentry for error monitoring (Priority 5)
  initSentry(app);
  
  // Server error handler
  server.on('error', (error) => {
    logger.error('Server error', error);
  });
  
  // Configure body parser with size limit for file uploads (10MB max).
  // Skip JSON parsing for the Stripe webhook so the raw body is preserved
  // for signature verification (Stripe.webhooks.constructEvent requires Buffer).
  app.use((req, res, next) => {
    if (req.originalUrl === "/api/stripe/webhook") return next();
    return express.json({ limit: "10mb" })(req, res, next);
  });
  app.use((req, res, next) => {
    if (req.originalUrl === "/api/stripe/webhook") return next();
    return express.urlencoded({ limit: "10mb", extended: true })(req, res, next);
  });

  // Trust proxy for correct IP behind reverse proxies (Railway, Vercel)
  app.set('trust proxy', 1);
  
  // CORS headers for API routes
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
      `http://localhost:${process.env.PORT || 3000}`,
      'http://localhost:5173',
      process.env.VITE_APP_URL,
      process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '',
      'https://amerilendloan.com',
      'https://www.amerilendloan.com',
      // Additional origins from env (comma-separated)
      ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || []),
    ].filter(Boolean);
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24h
      return res.sendStatus(204);
    }
    next();
  });

  // Ensure all responses are properly formatted as JSON
  app.use(ensureJsonHeaders);
  
  // Malformed JSON handler - must be before bodyParser to catch parse errors
  app.use(malformedJsonHandler);
  
  // Validate JSON requests
  app.use(validateJsonRequest);
  
  // Validate content length (min 1 byte, max 10MB)
  app.use(validateContentLength(1, 10 * 1024 * 1024));
  
  // Validate payload structure (ensure POST/PUT/PATCH have non-empty payloads)
  // Allows empty objects and arrays by default, can be configured per route
  app.use(validatePayload({
    allowEmpty: false,
    allowEmptyArrays: true, // Most API endpoints allow empty arrays
    allowEmptyObjects: true, // Most API endpoints allow empty objects like {}
    excludePaths: ["/api/trpc", "/api/oauth", "/health"],
    excludeMethods: ["GET", "HEAD", "DELETE", "OPTIONS"],
  }));
  
  // Security headers via helmet
  // CSP connect-src is an explicit allowlist (no `https:` wildcard) so that
  // exfiltration via injected scripts is constrained to known integrations.
  // Additional hosts can be added via CSP_CONNECT_SRC_EXTRA (comma-separated).
  const extraConnectSrc = (process.env.CSP_CONNECT_SRC_EXTRA || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // In development, Vite injects an inline preamble script for React Fast Refresh
  // and uses `eval` plus a websocket for HMR. Production CSP stays strict.
  const isDev = process.env.NODE_ENV !== "production";
  const devScriptSrc: string[] = isDev ? ["'unsafe-inline'", "'unsafe-eval'"] : [];
  const devConnectSrc: string[] = isDev ? ["ws://localhost:*", "ws://127.0.0.1:*", "http://localhost:*"] : [];
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: [
          "'self'",
          "https://js.stripe.com",
          // Google Translate widget loads scripts from several subdomains as it
          // initializes. Allow the full translate + gstatic origins so the
          // widget can actually swap page text after the user picks a language.
          "https://translate.google.com",
          "https://translate.googleapis.com",
          "https://translate-pa.googleapis.com",
          "https://www.gstatic.com",
          "https://www.google.com",
          // Cloudflare Turnstile bot-verification widget
          "https://challenges.cloudflare.com",
          ...devScriptSrc,
        ],
        frameSrc: [
          "'self'",
          "https://js.stripe.com",
          "https://hooks.stripe.com",
          // Turnstile renders its challenge inside an iframe
          "https://challenges.cloudflare.com",
        ],
        connectSrc: [
          "'self'",
          // Stripe
          "https://api.stripe.com",
          "https://maps.stripe.com",
          "https://q.stripe.com",
          // Supabase (REST + Realtime websockets)
          "https://*.supabase.co",
          "wss://*.supabase.co",
          // Sentry error reporting
          "https://*.sentry.io",
          "https://*.ingest.sentry.io",
          // Google Translate widget — loads translation payloads from
          // translate.googleapis.com and translate-pa.googleapis.com, plus
          // fetches font/asset metadata from www.gstatic.com.
          "https://translate.googleapis.com",
          "https://translate-pa.googleapis.com",
          "https://www.gstatic.com",
          "https://www.google.com",
          ...extraConnectSrc,
          ...devConnectSrc,
        ],
        workerSrc: ["'self'", "blob:"],
        // Defense-in-depth against clickjacking. Same as X-Frame-Options: SAMEORIGIN
        // but enforced via the modern CSP3 directive (browsers prefer this when both
        // are set).
        frameAncestors: ["'self'"],
        // Block mixed content and force HTTPS subresources.
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow cross-origin resources (Stripe, fonts)
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }));

  // Permissions-Policy: explicitly deny browser features the site does not use.
  // Reduces blast radius of any future XSS by preventing access to camera, mic,
  // geolocation, USB, payment APIs (we use Stripe.js iframes, not the W3C
  // Payment Request API), etc. Listing only what's denied keeps this readable
  // and avoids accidentally allowlisting a third-party origin.
  app.use((_req, res, next) => {
    res.setHeader(
      "Permissions-Policy",
      [
        // Allow first-party use of the camera for KYC selfie capture.
        // Third-party iframes are still denied by omitting any allowlist beyond self.
        "camera=(self)",
        "microphone=()",
        "geolocation=()",
        "payment=()",
        "usb=()",
        "magnetometer=()",
        "accelerometer=()",
        "gyroscope=()",
        "interest-cohort=()",
      ].join(", "),
    );
    next();
  });

  // Rate limiting (configured in rate-limiting.ts with optional Redis backing)
  app.use("/api/trpc", apiLimiter);

  // Apply strict auth limiter to OAuth routes
  app.use("/api/oauth", authLimiter);

  // Apply upload limiter to upload endpoints
  app.use("/api/upload", uploadLimiter);

  // Apply strict limiter to contact form endpoints (prevent email spam)
  app.use("/api/trpc/contact.sendEmail", contactLimiter);
  app.use("/api/trpc/contact.sendJobApplication", contactLimiter);

  // Payment endpoints — tighter limit (20/h/IP) on top of the generic apiLimiter.
  // Defends against payment-flow probing, fraudulent card-testing, and accidental
  // duplicate submissions that survive client-side dedup.
  app.use("/api/trpc/payments", paymentLimiter);
  app.use("/api/stripe/webhook", paymentLimiter);

  // Public unauthenticated POSTs that are the highest abuse-risk endpoints on a
  // publicly-indexed site: anonymous loan submission, OTP code requests (which
  // send real emails/SMS that cost money), and duplicate-account probes.
  // authLimiter = 5 attempts / 15 min / IP, with successful requests excluded
  // so legitimate users are unaffected.
  app.use("/api/trpc/loans.submit", authLimiter);
  app.use("/api/trpc/loans.checkDuplicate", authLimiter);
  app.use("/api/trpc/otp.requestCode", authLimiter);
  app.use("/api/trpc/otp.requestPhoneCode", authLimiter);
  app.use("/api/trpc/otp.verifyCode", authLimiter);
  
  // Apply admin limiter to admin-facing tRPC endpoints
  app.use("/api/trpc/admin", adminLimiter);
  app.use("/api/trpc/system", adminLimiter);
  
  // Simple health check for Railway/container orchestration (always 200 if process is alive)
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) });
  });
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) });
  });
  // Detailed health check (includes DB/Redis status, may return 503)
  app.get("/health/detailed", healthCheck);
  app.get("/health/readiness", readinessCheck);
  app.get("/health/liveness", livenessCheck);
  app.get("/metrics", metricsEndpoint);

  // Stripe webhook endpoint (must use raw body parser for signature verification)
  // In-process LRU dedup of recently-seen Stripe event IDs. Stripe retries on
  // any non-2xx and on timeout, so the same event.id can arrive multiple times
  // within seconds. Database-level guards (status checks below) handle cross-
  // process dedup; this LRU short-circuits same-process retries fast.
  const recentStripeEvents = new Set<string>();
  const STRIPE_EVENT_LRU_MAX = 1000;
  const rememberStripeEvent = (id: string) => {
    recentStripeEvents.add(id);
    if (recentStripeEvents.size > STRIPE_EVENT_LRU_MAX) {
      const oldest = recentStripeEvents.values().next().value;
      if (oldest) recentStripeEvents.delete(oldest);
    }
  };

  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.warn("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return res.status(400).json({ error: "Webhook not configured" });
    }

    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
        apiVersion: "2026-02-25.clover",
      });

      const event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);

      // Dedup replays: ack 200 immediately so Stripe stops retrying.
      // 1) In-process LRU short-circuits same-process retries fast.
      if (recentStripeEvents.has(event.id)) {
        logger.info(`[Stripe Webhook] Duplicate event ${event.id} ignored (in-process)`);
        return res.json({ received: true, duplicate: true });
      }
      rememberStripeEvent(event.id);

      // 2) Cross-process dedup via DB primary-key insert. If another replica
      //    already inserted the row, we get false and skip side effects.
      const db = await import("../db");
      const isFirstDelivery = await db.tryRecordStripeWebhookEvent(event.id, event.type);
      if (!isFirstDelivery) {
        logger.info(`[Stripe Webhook] Duplicate event ${event.id} ignored (cross-process)`);
        return res.json({ received: true, duplicate: true });
      }

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as any;
        const paymentId = paymentIntent.metadata?.paymentId;
        const loanApplicationId = paymentIntent.metadata?.loanApplicationId;

        if (paymentId) {
          const existingPayment = await db.getPaymentById(Number(paymentId));

          if (existingPayment && existingPayment.status !== "succeeded") {
            await db.updatePaymentStatus(Number(paymentId), "succeeded", {
              paymentIntentId: paymentIntent.id,
              completedAt: new Date(),
            });

            if (loanApplicationId) {
              await db.updateLoanApplicationStatus(Number(loanApplicationId), "fee_paid");
            }

            logger.info(`[Stripe Webhook] Payment ${paymentId} confirmed via webhook`);
          }
        }
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object as any;
        const paymentId = paymentIntent.metadata?.paymentId;

        if (paymentId) {
          const existingPayment = await db.getPaymentById(Number(paymentId));

          // Never overwrite a succeeded payment with a stale failure event.
          if (existingPayment && existingPayment.status !== "succeeded" && existingPayment.status !== "failed") {
            await db.updatePaymentStatus(Number(paymentId), "failed", {
              failureReason: paymentIntent.last_payment_error?.message || "Payment failed",
            });
            logger.info(`[Stripe Webhook] Payment ${paymentId} failed via webhook`);
          }
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      // Distinguish signature verification failures from processing errors
      if (err.type === 'StripeSignatureVerificationError') {
        logger.error("[Stripe Webhook] Signature verification failed");
        return res.status(400).json({ error: "Webhook signature verification failed" });
      }
      logger.error("[Stripe Webhook] Processing error:", err.message);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (req, file, cb) => {
      // Only allow images and PDFs
      const allowedMimes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
      ];

      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type"));
      }
    },
  });

  // Admin email action routes (approve/reject from email)
  registerAdminEmailActionRoutes(app);

  // Document upload endpoint
  app.post("/api/upload-document", upload.single("file"), async (req, res) => {
    try {
      logger.debug("Upload endpoint called");

      // Authenticate user from request
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch (authError) {
        logger.warn("Upload authentication failed", authError);
        return res.status(401).json({ error: "Unauthorized - please log in again" });
      }

      if (!user) {
        logger.warn("Upload: no user after authentication");
        return res.status(401).json({ error: "Unauthorized" });
      }

      logger.info("Upload: user authenticated", { userId: user.id });

      if (!req.file) {
        logger.warn("Upload: no file provided");
        return res.status(400).json({ error: "No file provided" });
      }

      logger.info("Upload: file received", { name: req.file.originalname, size: req.file.size, mime: req.file.mimetype });

      let url: string;
      
      // Try to use external storage if configured, otherwise use base64 URL
      if (ENV.forgeApiUrl && ENV.forgeApiKey) {
        try {
          const key = `verification-documents/${user.id}/${Date.now()}-${req.file.originalname}`;
          logger.debug("Upload: uploading to storage", { key });
          
          const { url: storageUrl } = await storagePut(
            key,
            req.file.buffer,
            req.file.mimetype
          );
          url = storageUrl;
          logger.info("Upload: storage upload successful");
        } catch (storageError) {
          logger.warn("Upload: storage failed, using base64 fallback", storageError);
          url = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        }
      } else {
        logger.warn("Upload: storage not configured, using base64 fallback");
        url = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      }

      const response = { 
        success: true,
        url, 
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      };

      res.json(response);
    } catch (error) {
      logger.error("Document upload error", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  });
  
  // Admin document viewing endpoint - resolves fresh download URLs
  app.get("/api/view-document/:id", async (req, res) => {
    try {
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const docId = parseInt(req.params.id, 10);
      if (isNaN(docId)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const db = await import("../db");
      const document = await db.getVerificationDocumentById(docId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      const filePath = document.filePath;

      // If it's a base64 data URL, return it directly
      if (filePath.startsWith("data:")) {
        return res.json({ url: filePath });
      }

      // Try to resolve a fresh download URL from storage
      if (ENV.forgeApiUrl && ENV.forgeApiKey) {
        try {
          // Extract storage key from the original upload path pattern
          const keyMatch = filePath.match(/verification-documents\/\d+\/[^?#]+/);
          if (keyMatch) {
            const { storageGet } = await import("../storage");
            const { url: freshUrl } = await storageGet(keyMatch[0]);
            return res.json({ url: freshUrl });
          }
        } catch (storageErr) {
          logger.warn("Failed to resolve fresh storage URL, falling back to stored URL", storageErr);
        }
      }

      // Fall back to the stored URL
      return res.json({ url: filePath });
    } catch (error) {
      logger.error("View document error", error);
      return res.status(500).json({ error: "Failed to load document" });
    }
  });

  // Document upload endpoint (Priority 3)
  app.post("/api/upload", upload.single('file'), handleFileUpload);
  app.get("/api/download/:id", handleFileDownload);

  // Public resume upload endpoint for job applications (no auth required)
  const resumeUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for resumes
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type. Only PDF and Word documents are allowed."));
      }
    },
  });

  app.post("/api/upload-resume", uploadLimiter, resumeUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      logger.info("Resume upload: file received", { name: req.file.originalname, size: req.file.size, mime: req.file.mimetype });

      let url: string;

      if (ENV.forgeApiUrl && ENV.forgeApiKey) {
        try {
          const key = `job-resumes/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const { url: storageUrl } = await storagePut(key, req.file.buffer, req.file.mimetype);
          url = storageUrl;
          logger.info("Resume upload: storage upload successful");
        } catch (storageError) {
          logger.warn("Resume upload: storage failed, using base64 fallback", storageError);
          url = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        }
      } else {
        logger.warn("Resume upload: storage not configured, using base64 fallback");
        url = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      }

      res.json({
        success: true,
        url,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      });
    } catch (error) {
      logger.error("Resume upload error", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  });

  // Admin-only endpoint to view a job applicant's resume.
  // Modern browsers block top-level navigation to base64 data: URLs,
  // so when storage isn't configured (resume saved as data URL) the raw
  // <a href> link silently fails. This endpoint decodes data URLs and
  // streams them with proper Content-Type, or redirects to real URLs.
  app.get("/api/view-resume/:id", async (req, res) => {
    try {
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const appId = parseInt(req.params.id, 10);
      if (isNaN(appId)) {
        return res.status(400).json({ error: "Invalid application ID" });
      }

      const db = await import("../db");
      const application = await db.getJobApplicationById(appId);
      if (!application || !application.resumeFileUrl) {
        return res.status(404).json({ error: "Resume not found" });
      }

      const url = application.resumeFileUrl;
      const fileName = application.resumeFileName || "resume";
      const disposition = req.query.download === "1" ? "attachment" : "inline";
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

      // Base64 data URL — decode and stream
      if (url.startsWith("data:")) {
        const match = url.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          return res.status(500).json({ error: "Malformed resume data" });
        }
        const mime = match[1];
        const buffer = Buffer.from(match[2], "base64");
        res.setHeader("Content-Type", mime);
        res.setHeader("Content-Length", buffer.length.toString());
        res.setHeader(
          "Content-Disposition",
          `${disposition}; filename="${safeName}"`
        );
        res.setHeader("Cache-Control", "private, no-store");
        return res.end(buffer);
      }

      // Real URL — redirect (browser will fetch directly)
      return res.redirect(302, url);
    } catch (error) {
      logger.error("View resume error", error);
      return res.status(500).json({ error: "Failed to load resume" });
    }
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ── Session establishment endpoint ─────────────────────────────────────
  // Vercel's rewrite proxy may strip Set-Cookie headers from tRPC/fetch
  // responses. Login mutations return a one-time session code; the client
  // then navigates here (direct GET) to set the session cookie reliably.
  app.get("/api/auth/session", (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const redirect = typeof req.query.redirect === "string" ? req.query.redirect : "/dashboard";
    const safeRedirect =
      redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/dashboard";

    const sessionToken = redeemSessionCode(code);
    if (!sessionToken) {
      logger.warn("[Auth] Invalid or expired session code");
      return res.redirect(302, "/login?error=session_expired");
    }

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_COOKIE_MS });
    logger.info("[Auth] Session cookie set via /api/auth/session redirect", {
      domain: cookieOptions.domain,
      sameSite: cookieOptions.sameSite,
      secure: cookieOptions.secure,
      forwardedHost: req.headers["x-forwarded-host"],
      origin: req.headers["origin"],
      referer: req.headers["referer"],
      hostname: req.hostname,
    });
    res.redirect(302, safeRedirect);
  });

  // ── Diagnostic endpoint ────────────────────────────────────────────────
  // Echoes the cookie attributes that *would* be applied to a session cookie
  // for the current request, plus the proxy headers Railway sees from Vercel.
  // Used to verify the Vercel→Railway proxy is forwarding the public hostname
  // (so Set-Cookie carries the correct Domain attribute). No secrets exposed.
  app.get("/api/auth/_debug/cookie", (req, res) => {
    const opts = getSessionCookieOptions(req);
    res.json({
      cookieOptions: {
        domain: opts.domain ?? null,
        sameSite: opts.sameSite,
        secure: opts.secure,
        path: opts.path,
        httpOnly: opts.httpOnly,
      },
      derived: {
        reqHostname: req.hostname,
        protocol: req.protocol,
      },
      headers: {
        host: req.headers["host"],
        "x-forwarded-host": req.headers["x-forwarded-host"] ?? null,
        "x-forwarded-proto": req.headers["x-forwarded-proto"] ?? null,
        origin: req.headers["origin"] ?? null,
        referer: req.headers["referer"] ?? null,
      },
    });
  });

  // ── Dedicated logout endpoint ──────────────────────────────────────────
  // Uses a direct GET route so the browser navigates here (not via tRPC/fetch).
  // This guarantees the Set-Cookie header is processed by the browser,
  // avoiding issues with Vercel's rewrite proxy stripping Set-Cookie from
  // tRPC JSON responses.
  app.get("/api/logout", (req, res) => {
    const cookieOptions = getSessionCookieOptions(req);

    // Clear the session cookie with matching attributes
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 });

    // Belt-and-suspenders: also set it to empty with immediate expiry
    res.cookie(COOKIE_NAME, "", {
      ...cookieOptions,
      maxAge: 0,
      expires: new Date(0),
    });

    // Clear-Site-Data tells the browser to wipe cookies, storage, and cache
    // for this origin. Supported by Chrome, Edge, Firefox.
    res.setHeader("Clear-Site-Data", '"cookies", "storage"');

    logger.info("[Auth] User logged out via /api/logout – cookies cleared");

    // Redirect to home page after clearing the cookie
    const redirectTo = typeof req.query.redirect === "string" ? req.query.redirect : "/";
    // Only allow relative redirects to prevent open-redirect attacks
    const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/";
    res.redirect(302, safeRedirect);
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // Serve sitemap.xml with correct content type
  app.get("/sitemap.xml", (_req, res) => {
    const sitemapPath = process.env.NODE_ENV === "development"
      ? path.resolve(process.cwd(), "client/public/sitemap.xml")
      : path.resolve(process.cwd(), "dist/public/sitemap.xml");
    if (fs.existsSync(sitemapPath)) {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.sendFile(sitemapPath);
    } else {
      res.status(404).send("Sitemap not found");
    }
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    try {
      logger.info("Setting up Vite dev server...");
      const { setupVite } = await import("./vite");
      await setupVite(app, server);
      logger.info("Vite setup complete");
    } catch (error) {
      logger.error("Vite setup failed", error);
      throw error;
    }
  } else {
    serveStatic(app);
  }
  
  // 404 handler - must be after all other routes
  app.use(notFoundHandler);
  
  // Sentry error handler - must be before global error handler (Priority 5)
  app.use(sentryErrorHandler());
  
  // Global error handler - must be last
  app.use(errorHandlerMiddleware);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.info(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  logger.info("About to start listening...");
  
  // Store cron jobs reference for cleanup
  let cronJobs: any = null;
  let dbKeepAliveTimer: ReturnType<typeof setInterval> | null = null;
  
  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}/`);
    
    // Initialize background job schedulers (single-leader; gated by RUN_SCHEDULERS).
    // On multi-instance deploys (e.g. Railway scaling, blue/green), set
    // RUN_SCHEDULERS=false on every replica except the designated leader to
    // prevent duplicate Stripe charges, duplicate reminder emails, duplicate
    // KYC audit events, and duplicate database backups.
    if (ENV.runSchedulers) {
      try {
        initializePaymentNotificationScheduler();
        startAutoPayScheduler();
        initializeReminderScheduler();
        cronJobs = initializeCronJobs();
        startBackupScheduler(6);
        logger.info("All schedulers initialized successfully");
      } catch (error) {
        logger.warn("Failed to initialize schedulers", error);
      }
    } else {
      logger.info("[Schedulers] RUN_SCHEDULERS=false — skipping cron, auto-pay, reminders, and backups on this replica");
    }

    // Database keep-alive: ping DB every 4 hours to prevent Supabase free-tier pause (7-day inactivity timeout)
    const DB_KEEPALIVE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in ms
    const dbKeepAlive = setInterval(async () => {
      try {
        const { getDb } = await import("../db");
        await getDb(); // getDb() runs SELECT 1 internally to validate the connection
        logger.info("[DB Keep-Alive] Database ping successful");
      } catch (error) {
        logger.warn("[DB Keep-Alive] Database ping failed", error);
      }
    }, DB_KEEPALIVE_INTERVAL);
    dbKeepAlive.unref(); // Don't prevent process exit
    dbKeepAliveTimer = dbKeepAlive;
    logger.info(`[DB Keep-Alive] Scheduled every ${DB_KEEPALIVE_INTERVAL / 3600000}h to prevent Supabase pause`);
  });

  // Graceful shutdown handlers (async operations allowed in SIGTERM/SIGINT, not in 'exit')
  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    try {
      shutdownPaymentNotificationScheduler();
      shutdownReminderScheduler();
      if (cronJobs) {
        stopAllCronJobs(cronJobs);
      }
      stopBackupScheduler();
      if (dbKeepAliveTimer) {
        clearInterval(dbKeepAliveTimer);
      }
      logger.info("All schedulers shut down");
    } catch (error) {
      logger.warn("Error shutting down schedulers", error);
    }
    // Close HTTP server to stop accepting new connections
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
    // Force exit after 10s if server hasn't drained
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('exit', (code) => {
    logger.info(`Process exiting with code ${code}`);
  });
}

startServer().catch(error => {
  logger.error("Fatal error during startup", error);
});
