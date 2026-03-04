import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
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
import { startBackupScheduler, stopBackupScheduler } from "./database-backup";
import { healthCheck, readinessCheck, livenessCheck, metricsEndpoint } from "./health-checks";
import { apiLimiter, authLimiter, paymentLimiter, uploadLimiter } from "./rate-limiting";
import { handleFileUpload, handleFileDownload, upload } from "./upload-handler";
import { registerAdminEmailActionRoutes } from "./admin-email-actions";
import { logger } from "./logger";

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
  
  logger.info("Global error handlers installed");
  
  const app = express();
  const server = createServer(app);
  
  // Initialize Sentry for error monitoring (Priority 5)
  initSentry(app);
  
  // Server error handler
  server.on('error', (error) => {
    logger.error('Server error', error);
  });
  
  // Configure body parser with size limit for file uploads (10MB max)
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

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
    ].filter(Boolean);
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
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
  
  // Security headers middleware
  app.use((req, res, next) => {
    // Content Security Policy
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://js.stripe.com; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; connect-src 'self' https: https://api.stripe.com;"
    );
    
    // XSS Protection
    res.setHeader("X-XSS-Protection", "1; mode=block");
    
    // Prevent clickjacking
    res.setHeader("X-Frame-Options", "DENY");
    
    // Prevent MIME type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");
    
    // Strict Transport Security (HTTPS only)
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    
    // Referrer Policy
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    
    // Permissions Policy (disable unused browser features)
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    
    next();
  });

  // Rate limiting configurations
  // General API rate limit (100 requests per 15 minutes)
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });

  // Strict rate limit for authentication endpoints (5 attempts per 15 minutes)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: { error: "Too many authentication attempts, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
  });

  // Payment endpoint rate limit (10 requests per 5 minutes)
  const paymentLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 payment requests per windowMs
    message: { error: "Too many payment requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply general rate limit to all API routes
  app.use("/api/trpc", apiLimiter);

  // Apply strict auth limiter to OAuth routes
  app.use("/api/oauth", authLimiter);
  
  // Apply upload limiter to upload endpoints
  app.use("/api/upload", uploadLimiter);
  
  // Health check endpoints (Priority 5)
  app.get("/health", healthCheck);
  app.get("/health/readiness", readinessCheck);
  app.get("/health/liveness", livenessCheck);
  app.get("/metrics", metricsEndpoint);

  // Stripe webhook endpoint (must use raw body parser for signature verification)
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return res.status(400).json({ error: "Webhook not configured" });
    }

    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
        apiVersion: "2025-11-17.clover",
      });

      const event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as any;
        const paymentId = paymentIntent.metadata?.paymentId;
        const loanApplicationId = paymentIntent.metadata?.loanApplicationId;

        if (paymentId) {
          const db = await import("../db");
          const existingPayment = await db.getPaymentById(Number(paymentId));

          if (existingPayment && existingPayment.status !== "succeeded") {
            await db.updatePaymentStatus(Number(paymentId), "succeeded", {
              paymentIntentId: paymentIntent.id,
              completedAt: new Date(),
            });

            if (loanApplicationId) {
              await db.updateLoanApplicationStatus(Number(loanApplicationId), "fee_paid");
            }

            console.log(`[Stripe Webhook] Payment ${paymentId} confirmed via webhook`);
          }
        }
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object as any;
        const paymentId = paymentIntent.metadata?.paymentId;

        if (paymentId) {
          const db = await import("../db");
          await db.updatePaymentStatus(Number(paymentId), "failed", {
            failureReason: paymentIntent.last_payment_error?.message || "Payment failed",
          });
          console.log(`[Stripe Webhook] Payment ${paymentId} failed via webhook`);
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error("[Stripe Webhook] Error:", err.message);
      res.status(400).json({ error: `Webhook error: ${err.message}` });
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
  
  // Document upload endpoint (Priority 3)
  app.post("/api/upload", upload.single('file'), handleFileUpload);
  app.get("/api/download/:id", handleFileDownload);
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    try {
      logger.info("Setting up Vite dev server...");
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
  
  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}/`);
    
    // Initialize background job schedulers
    try {
      initializePaymentNotificationScheduler();
      startAutoPayScheduler();
      initializeReminderScheduler();
      cronJobs = initializeCronJobs();
      startBackupScheduler(24);
      logger.info("All schedulers initialized successfully");
    } catch (error) {
      logger.warn("Failed to initialize schedulers", error);
    }
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
      logger.info("All schedulers shut down");
    } catch (error) {
      logger.warn("Error shutting down schedulers", error);
    }
    process.exit(0);
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
