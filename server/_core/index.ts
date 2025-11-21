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

// Validate critical environment variables at startup
function validateEnvironment() {
  const missing: string[] = [];
  
  // Log the DATABASE_URL for debugging
  console.log("[Environment] DATABASE_URL is " + (ENV.databaseUrl ? "configured" : "NOT SET"));
  if (ENV.databaseUrl) {
    // Show only the first 50 chars and last 10 chars to protect credentials
    const masked = ENV.databaseUrl.substring(0, 30) + "..." + ENV.databaseUrl.substring(ENV.databaseUrl.length - 10);
    console.log("[Environment] DATABASE_URL starts with:", masked);
  }
  
  if (!ENV.databaseUrl) {
    missing.push("DATABASE_URL");
  }
  if (!ENV.cookieSecret) {
    missing.push("JWT_SECRET");
  }
  if (!ENV.appId) {
    missing.push("VITE_APP_ID");
  }
  
  if (missing.length > 0) {
    console.warn(`[Environment] Missing critical environment variables: ${missing.join(", ")}`);
    console.warn("[Environment] Some features may not work correctly.");
  } else {
    console.log("[Environment] All critical environment variables configured ✓");
  }
  
  if (ENV.databaseUrl) {
    console.log("[Environment] DATABASE_URL is configured ✓");
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
    console.error('[Server] Unhandled Rejection:', reason);
    // Don't exit - keep server running
  });
  
  process.on('uncaughtException', (error) => {
    console.error('[Server] Uncaught Exception:', error);
    // Don't exit - keep server running
  });

  // Validate environment variables first
  validateEnvironment();
  
  console.log("[Server] Global error handlers installed");
  
  const app = express();
  const server = createServer(app);
  
  // Server error handler
  server.on('error', (error) => {
    console.error('[Server] Server error:', error);
  });
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // Ensure all responses are properly formatted as JSON
  app.use(ensureJsonHeaders);
  
  // Malformed JSON handler - must be before bodyParser to catch parse errors
  app.use(malformedJsonHandler);
  
  // Validate JSON requests
  app.use(validateJsonRequest);
  
  // Validate content length (min 1 byte, max 50MB)
  app.use(validateContentLength(1, 50 * 1024 * 1024));
  
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
      "default-src 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https:;"
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
  app.use("/api/trpc", generalLimiter);

  // Apply strict auth limiter to OAuth routes
  app.use("/api/oauth", authLimiter);

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

  // Document upload endpoint
  app.post("/api/upload-document", upload.single("file"), async (req, res) => {
    try {
      console.log("[Upload] Endpoint called");

      // Authenticate user from request
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch (authError) {
        console.warn("[Upload] Authentication failed:", authError instanceof Error ? authError.message : "");
        return res.status(401).json({ error: "Unauthorized - please log in again" });
      }

      if (!user) {
        console.warn("[Upload] No user after authentication");
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log("[Upload] User authenticated:", user.id);

      if (!req.file) {
        console.warn("[Upload] No file provided in request");
        return res.status(400).json({ error: "No file provided" });
      }

      console.log("[Upload] File received:", { name: req.file.originalname, size: req.file.size, mime: req.file.mimetype });

      let url: string;
      
      // Try to use external storage if configured, otherwise use base64 URL
      if (ENV.forgeApiUrl && ENV.forgeApiKey) {
        try {
          const key = `verification-documents/${user.id}/${Date.now()}-${req.file.originalname}`;
          console.log("[Upload] Uploading to storage:", key);
          
          const { url: storageUrl } = await storagePut(
            key,
            req.file.buffer,
            req.file.mimetype
          );
          url = storageUrl;
          console.log("[Upload] Storage upload successful, URL length:", url.length);
        } catch (storageError) {
          const errorMsg = storageError instanceof Error ? storageError.message : String(storageError);
          console.warn("[Upload] Storage failed, using fallback:", errorMsg);
          // Fallback: convert to base64 data URL
          url = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
          console.log("[Upload] Using base64 fallback, URL length:", url.length);
        }
      } else {
        // No external storage configured, use base64 data URL as fallback
        console.warn("[Upload] Storage not configured (missing FORGE_API_URL or FORGE_API_KEY), using base64 fallback");
        url = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      }

      const response = { 
        success: true,
        url, 
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      };

      console.log("[Upload] Sending response with URL");
      res.json(response);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Upload] Document upload error:", errorMsg, error);
      res.status(500).json({
        error: errorMsg || "Upload failed",
      });
    }
  });
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Health check endpoint
  app.get("/health", healthCheckHandler);
  
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
      console.log("[Server] Setting up Vite dev server...");
      await setupVite(app, server);
      console.log("[Server] Vite setup complete");
    } catch (error) {
      console.error("[Vite] Failed to setup:", error);
      throw error;
    }
  } else {
    serveStatic(app);
  }
  
  // 404 handler - must be after all other routes
  app.use(notFoundHandler);
  
  // Global error handler - must be last
  app.use(errorHandlerMiddleware);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  console.log("[Server] About to start listening...");
  
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log("[Server] ✅ Server is ready to accept connections");
    
    // Initialize background job schedulers
    try {
      initializePaymentNotificationScheduler();
    } catch (error) {
      console.warn("[Server] Failed to initialize payment notification scheduler:", error);
      // Don't exit - scheduler is optional
    }
  });

  // Keep the process alive
  process.on('exit', (code) => {
    console.log(`[Server] Process exiting with code ${code}`);
    // Shutdown schedulers
    try {
      shutdownPaymentNotificationScheduler();
    } catch (error) {
      console.warn("[Server] Error shutting down payment scheduler:", error);
    }
  });
}

startServer().catch(error => {
  console.error("[Server] Fatal error during startup:", error);
  // Don't exit - let it stay alive
});
