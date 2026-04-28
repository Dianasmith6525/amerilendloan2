import express, { type Express, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import { logger } from "./logger";
import { injectRouteMeta } from "./seo-meta";

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

  // Cache the index.html template once at boot — it doesn't change at runtime.
  // Falls back to per-request reads only if the boot-time read failed (e.g.
  // the file appears later in dev). NODE_ENV=development always re-reads to
  // pick up Vite changes.
  const indexHtmlPath = path.resolve(distPath, "index.html");
  let cachedShell: string | null = null;
  try {
    cachedShell = fs.readFileSync(indexHtmlPath, "utf8");
  } catch {
    cachedShell = null;
  }

  // fall through to index.html if the file doesn't exist (SPA routing)
  // BUT exclude /api/* and /auth/* routes - they should 404 if not handled
  app.use("*", (req: Request, res: Response, next: NextFunction) => {
    const reqPath = req.originalUrl || req.path;

    // Don't serve index.html for API or auth routes - let them 404
    if (reqPath.startsWith('/api/') || reqPath.startsWith('/auth/')) {
      return next();
    }

    // Read fresh in dev so HMR/index edits show up; cached in prod.
    let html = cachedShell;
    if (!html || process.env.NODE_ENV === "development") {
      try {
        html = fs.readFileSync(indexHtmlPath, "utf8");
      } catch (err) {
        logger.error("Failed to read index.html for SPA fallback", { err });
        return res.sendFile(indexHtmlPath);
      }
    }

    // Inject per-route <title>, description, canonical, og:*, twitter:*, and
    // JSON-LD. This is what Googlebot/Bingbot/Facebook/Twitter scrapers see;
    // SEOHead.tsx handles client-side updates after hydration.
    const pathOnly = reqPath.split("?")[0]!;
    const rendered = injectRouteMeta(html, pathOnly);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(rendered);
  });
}
