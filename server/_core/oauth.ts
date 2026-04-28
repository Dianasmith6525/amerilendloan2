import { SESSION_COOKIE_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { sdk } from "./sdk";
import { sendLoginNotificationEmail } from "./email";
import { getClientIP } from "./ipUtils";
import { getEnv } from "./env";
import { logger } from "./logger";
import { createSessionCode } from "./session-code";

// Redirect via /api/auth/session so the Set-Cookie header is applied on a
// direct browser navigation (Vercel's rewrite proxy may strip Set-Cookie from
// proxied 302 responses when the cookie is set on the callback redirect).
function redirectWithSessionHandoff(res: Response, sessionToken: string, target = "/dashboard") {
  const handoffCode = createSessionCode(sessionToken);
  const redirectParam = encodeURIComponent(target);
  res.redirect(302, `/api/auth/session?code=${encodeURIComponent(handoffCode)}&redirect=${redirectParam}`);
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

// Get the base URL from request (handles both www and non-www)
function getBaseUrl(req: Request): string {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'amerilendloan.com';
  return `${protocol}://${host}`;
}

// Helper to exchange OAuth code for user info
async function exchangeGoogleCode(code: string, redirectUri: string): Promise<any> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = getEnv();

  logger.debug("[Google OAuth] Exchanging code");

  const tokenResponse = await (global.fetch as typeof fetch)("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID || "",
      client_secret: GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  const tokenData = (await tokenResponse.json()) as any;
  if (!tokenData.access_token) {
    logger.error("[Google OAuth] Token exchange failed");
    throw new Error(`Failed to get Google access token: ${tokenData.error_description || tokenData.error || 'Unknown error'}`);
  }

  const userResponse = await (global.fetch as typeof fetch)("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userData = (await userResponse.json()) as any;
  return {
    openId: userData.id,
    email: userData.email,
    name: userData.name,
    picture: userData.picture,
    platform: "google",
  };
}

async function exchangeGitHubCode(code: string, redirectUri: string): Promise<any> {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = getEnv();

  logger.debug("[GitHub OAuth] Exchanging code");

  const tokenResponse = await (global.fetch as typeof fetch)("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      code,
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = (await tokenResponse.json()) as any;
  if (!tokenData.access_token) {
    logger.error("[GitHub OAuth] Token exchange failed");
    throw new Error(`Failed to get GitHub access token: ${tokenData.error_description || tokenData.error || 'Unknown error'}`);
  }

  const userResponse = await (global.fetch as typeof fetch)("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  const userData = (await userResponse.json()) as any;

  // GitHub doesn't always provide email in user endpoint, get it separately if needed
  let email = userData.email;
  if (!email) {
    const emailResponse = await (global.fetch as typeof fetch)("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    const emails = (await emailResponse.json()) as any[];
    const primaryEmail = emails.find((e: any) => e.primary);
    email = primaryEmail?.email || emails[0]?.email;
  }

  return {
    openId: userData.id.toString(),
    email,
    name: userData.name || userData.login,
    picture: userData.avatar_url,
    platform: "github",
  };
}

async function exchangeMicrosoftCode(code: string, redirectUri: string): Promise<any> {
  const { MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET } = getEnv();

  logger.debug("[Microsoft OAuth] Exchanging code");

  const tokenResponse = await (global.fetch as typeof fetch)("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: MICROSOFT_CLIENT_ID || "",
      client_secret: MICROSOFT_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  const tokenData = (await tokenResponse.json()) as any;
  if (!tokenData.access_token) {
    logger.error("[Microsoft OAuth] Token exchange failed");
    throw new Error(`Failed to get Microsoft access token: ${tokenData.error_description || tokenData.error || 'Unknown error'}`);
  }

  const userResponse = await (global.fetch as typeof fetch)("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userData = (await userResponse.json()) as any;
  return {
    openId: userData.id,
    email: userData.userPrincipalName || userData.mail,
    name: userData.displayName,
    picture: null,
    platform: "microsoft",
  };
}

export function registerOAuthRoutes(app: Express) {
  // GitHub OAuth start route (server-side URL generation).
  // This avoids relying on VITE_GITHUB_CLIENT_ID in the browser.
  app.get("/auth/github/start", async (req: Request, res: Response) => {
    try {
      const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = getEnv();
      if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
        res.redirect(302, "/login?error=github_not_configured");
        return;
      }

      const purpose = getQueryParam(req, "purpose") === "signup" ? "signup" : "login";
      const redirectUri = `${getBaseUrl(req)}/auth/github/callback`;
      const state = Buffer.from(JSON.stringify({
        purpose,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).slice(2),
      })).toString("base64");

      const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: redirectUri,
        scope: "read:user user:email",
        state,
        allow_signup: purpose === "signup" ? "true" : "false",
      });

      res.redirect(302, `https://github.com/login/oauth/authorize?${params.toString()}`);
    } catch (error) {
      logger.error("[GitHub OAuth] Start route failed", error);
      res.redirect(302, "/login?error=github_start_failed");
    }
  });

  // Original Manus OAuth callback
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Determine admin role from ADMIN_EMAIL env var
      const adminEmail = process.env.ADMIN_EMAIL || "admin@amerilendloan.com";
      const userRole = userInfo.email === adminEmail ? "admin" : undefined;
      
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
        role: userRole as any, // Explicitly set admin role
      });

      // Send login notification email
      if (userInfo.email && userInfo.name) {
        const ipAddress = getClientIP(req);
        const userAgent = req.headers['user-agent'];
        sendLoginNotificationEmail(
          userInfo.email,
          userInfo.name,
          new Date(),
          ipAddress,
          userAgent
        ).catch(err => logger.warn('Failed to send login notification:', err));
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: SESSION_COOKIE_MS,
      });

      redirectWithSessionHandoff(res, sessionToken);
    } catch (error) {
      logger.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  // Google OAuth callback
  app.get("/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const error = getQueryParam(req, "error");

    logger.debug("[Google OAuth] Callback received, code exists:", !!code);

    if (error) {
      logger.warn("[Google OAuth] Error:", error);
      res.redirect(302, `/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code not provided" });
      return;
    }

    try {
      // Build redirect URI from request to match what client sent
      const redirectUri = `${getBaseUrl(req)}/auth/google/callback`;
      const userInfo = await exchangeGoogleCode(code, redirectUri);

      // Generate a unique openId if needed (Google id prefixed with 'google_')
      const uniqueOpenId = `google_${userInfo.openId}`;
      
      // Determine admin role from ADMIN_EMAIL env var
      const adminEmail = process.env.ADMIN_EMAIL || "admin@amerilendloan.com";
      const userRoleGoogle = userInfo.email === adminEmail ? "admin" : undefined;

      await db.upsertUser({
        openId: uniqueOpenId,
        name: userInfo.name || null,
        email: userInfo.email || null,
        loginMethod: "google",
        lastSignedIn: new Date(),
        role: userRoleGoogle as any,
      });

      // Send login notification email
      if (userInfo.email && userInfo.name) {
        const ipAddress = getClientIP(req);
        const userAgent = req.headers['user-agent'];
        sendLoginNotificationEmail(
          userInfo.email,
          userInfo.name,
          new Date(),
          ipAddress,
          userAgent
        ).catch(err => logger.warn('Failed to send login notification:', err));
      }

      const sessionToken = await sdk.createSessionToken(uniqueOpenId, {
        name: userInfo.name || "",
        expiresInMs: SESSION_COOKIE_MS,
      });

      redirectWithSessionHandoff(res, sessionToken);
    } catch (error) {
      logger.error("[Google OAuth] Callback failed", error);
      res.redirect(302, "/login?error=google_auth_failed");
    }
  });

  // GitHub OAuth callback
  app.get("/auth/github/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const error = getQueryParam(req, "error");

    logger.debug("[GitHub OAuth] Callback received, code exists:", !!code);

    if (error) {
      logger.warn("[GitHub OAuth] Error:", error);
      res.redirect(302, `/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code not provided" });
      return;
    }

    try {
      // Build redirect URI from request to match what client sent
      const redirectUri = `${getBaseUrl(req)}/auth/github/callback`;
      const userInfo = await exchangeGitHubCode(code, redirectUri);

      // Generate a unique openId (GitHub id prefixed with 'github_')
      const uniqueOpenId = `github_${userInfo.openId}`;
      
      // Determine admin role from ADMIN_EMAIL env var
      const adminEmail = process.env.ADMIN_EMAIL || "admin@amerilendloan.com";
      const userRoleGitHub = userInfo.email === adminEmail ? "admin" : undefined;

      await db.upsertUser({
        openId: uniqueOpenId,
        name: userInfo.name || null,
        email: userInfo.email || null,
        loginMethod: "github",
        lastSignedIn: new Date(),
        role: userRoleGitHub as any,
      });

      // Send login notification email
      if (userInfo.email && userInfo.name) {
        const ipAddress = getClientIP(req);
        const userAgent = req.headers['user-agent'];
        sendLoginNotificationEmail(
          userInfo.email,
          userInfo.name,
          new Date(),
          ipAddress,
          userAgent
        ).catch(err => logger.warn('Failed to send login notification:', err));
      }

      const sessionToken = await sdk.createSessionToken(uniqueOpenId, {
        name: userInfo.name || "",
        expiresInMs: SESSION_COOKIE_MS,
      });

      redirectWithSessionHandoff(res, sessionToken);
    } catch (error) {
      logger.error("[GitHub OAuth] Callback failed", error);
      res.redirect(302, "/login?error=github_auth_failed");
    }
  });

  // Microsoft OAuth callback
  app.get("/auth/microsoft/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const error = getQueryParam(req, "error");

    logger.debug("[Microsoft OAuth] Callback received, code exists:", !!code);

    if (error) {
      logger.warn("[Microsoft OAuth] Error:", error);
      res.redirect(302, `/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code not provided" });
      return;
    }

    try {
      // Build redirect URI from request to match what client sent
      const redirectUri = `${getBaseUrl(req)}/auth/microsoft/callback`;
      const userInfo = await exchangeMicrosoftCode(code, redirectUri);

      // Generate a unique openId (Microsoft id prefixed with 'microsoft_')
      const uniqueOpenId = `microsoft_${userInfo.openId}`;
      
      // Determine admin role from ADMIN_EMAIL env var
      const adminEmail = process.env.ADMIN_EMAIL || "admin@amerilendloan.com";
      const userRoleMicrosoft = userInfo.email === adminEmail ? "admin" : undefined;

      await db.upsertUser({
        openId: uniqueOpenId,
        name: userInfo.name || null,
        email: userInfo.email || null,
        loginMethod: "microsoft",
        lastSignedIn: new Date(),
        role: userRoleMicrosoft as any,
      });

      // Send login notification email
      if (userInfo.email && userInfo.name) {
        const ipAddress = getClientIP(req);
        const userAgent = req.headers['user-agent'];
        sendLoginNotificationEmail(
          userInfo.email,
          userInfo.name,
          new Date(),
          ipAddress,
          userAgent
        ).catch(err => logger.warn('Failed to send login notification:', err));
      }

      const sessionToken = await sdk.createSessionToken(uniqueOpenId, {
        name: userInfo.name || "",
        expiresInMs: SESSION_COOKIE_MS,
      });

      redirectWithSessionHandoff(res, sessionToken);
    } catch (error) {
      logger.error("[Microsoft OAuth] Callback failed", error);
      res.redirect(302, "/login?error=microsoft_auth_failed");
    }
  });
}
