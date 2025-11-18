import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import multer from "multer";
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
  
  // Add CSP headers to allow favicons and images
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https:;"
    );
    next();
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

  // Document upload endpoint
  app.post("/api/upload-document", upload.single("file"), async (req, res) => {
    try {
      // Authenticate user from request
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      let url: string;
      
      // Try to use external storage if configured, otherwise use base64 URL
      if (ENV.forgeApiUrl && ENV.forgeApiKey) {
        try {
          const key = `verification-documents/${user.id}/${Date.now()}-${req.file.originalname}`;
          const { url: storageUrl } = await storagePut(
            key,
            req.file.buffer,
            req.file.mimetype
          );
          url = storageUrl;
        } catch (storageError) {
          console.warn("[Upload] Storage failed, using fallback:", storageError instanceof Error ? storageError.message : "");
          // Fallback: convert to base64 data URL
          url = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        }
      } else {
        // No external storage configured, use base64 data URL as fallback
        console.warn("[Upload] Storage not configured, using base64 fallback");
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
      console.error("[Upload] Document upload error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Upload failed",
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
  
  // 404 handler - must be after all other routes
  app.use(notFoundHandler);
  
  // Global error handler - must be last
  app.use(errorHandlerMiddleware);
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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  console.log("[Server] About to start listening...");
  
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log("[Server] ✅ Server is ready to accept connections");
  });

  // Keep the process alive
  process.on('exit', (code) => {
    console.log(`[Server] Process exiting with code ${code}`);
  });
}

startServer().catch(error => {
  console.error("[Server] Fatal error during startup:", error);
  // Don't exit - let it stay alive
});
