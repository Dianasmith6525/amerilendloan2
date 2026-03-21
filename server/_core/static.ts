import express, { type Express, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import { logger } from "./logger";

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    logger.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (SPA routing)
  // BUT exclude /api/* and /auth/* routes - they should 404 if not handled
  app.use("*", (req: Request, res: Response, next: NextFunction) => {
    const reqPath = req.originalUrl || req.path;
    
    // Don't serve index.html for API or auth routes - let them 404
    if (reqPath.startsWith('/api/') || reqPath.startsWith('/auth/')) {
      return next();
    }
    
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
