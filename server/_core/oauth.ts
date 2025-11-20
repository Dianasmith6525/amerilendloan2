import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { sendLoginNotificationEmail } from "./email";
import { getEnv } from "./env";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

// Helper to exchange OAuth code for user info
async function exchangeGoogleCode(code: string): Promise<any> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = getEnv();
  const redirectUri = `${process.env.PUBLIC_URL || "https://amerilendloan.com"}/auth/google/callback`;

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
  if (!tokenData.access_token) throw new Error("Failed to get Google access token");

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

async function exchangeGitHubCode(code: string): Promise<any> {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = getEnv();
  const redirectUri = `${process.env.PUBLIC_URL || "https://amerilendloan.com"}/auth/github/callback`;

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
  if (!tokenData.access_token) throw new Error("Failed to get GitHub access token");

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

async function exchangeMicrosoftCode(code: string): Promise<any> {
  const { MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET } = getEnv();
  const redirectUri = `${process.env.PUBLIC_URL || "https://amerilendloan.com"}/auth/microsoft/callback`;

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
  if (!tokenData.access_token) throw new Error("Failed to get Microsoft access token");

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

      // Log admin login for debugging OWNER_OPEN_ID
      console.log(`[OAuth] Login attempt - Email: ${userInfo.email}`);
      
      if (userInfo.email === "admin@amerilendloan.com") {
        console.log(`🔐 ADMIN LOGIN: admin@amerilendloan.com with openId: ${userInfo.openId}`);
        console.log(`✅ Set OWNER_OPEN_ID environment variable to: ${userInfo.openId}`);
      }

      // Explicitly set admin role if email is admin
      const userRole = userInfo.email === "admin@amerilendloan.com" ? "admin" : undefined;
      
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
        const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || 'Unknown';
        const userAgent = req.headers['user-agent'];
        sendLoginNotificationEmail(
          userInfo.email,
          userInfo.name,
          new Date(),
          ipAddress,
          userAgent
        ).catch(err => console.error('Failed to send login notification:', err));
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/dashboard");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  // Google OAuth callback
  app.get("/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const error = getQueryParam(req, "error");

    if (error) {
      console.error("[Google OAuth] Error:", error);
      res.redirect(302, `/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code not provided" });
      return;
    }

    try {
      const userInfo = await exchangeGoogleCode(code);

      // Generate a unique openId if needed (Google id prefixed with 'google_')
      const uniqueOpenId = `google_${userInfo.openId}`;
      
      // Explicitly set admin role if email is admin
      const userRoleGoogle = userInfo.email === "admin@amerilendloan.com" ? "admin" : undefined;
      if (userRoleGoogle === "admin") {
        console.log(`🔐 ADMIN LOGIN via Google: ${userInfo.email}`);
      }

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
        const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || 'Unknown';
        const userAgent = req.headers['user-agent'];
        sendLoginNotificationEmail(
          userInfo.email,
          userInfo.name,
          new Date(),
          ipAddress,
          userAgent
        ).catch(err => console.error('Failed to send login notification:', err));
      }

      const sessionToken = await sdk.createSessionToken(uniqueOpenId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/login");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      res.redirect(302, "/login?error=google_auth_failed");
    }
  });

  // GitHub OAuth callback
  app.get("/auth/github/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const error = getQueryParam(req, "error");

    if (error) {
      console.error("[GitHub OAuth] Error:", error);
      res.redirect(302, `/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code not provided" });
      return;
    }

    try {
      const userInfo = await exchangeGitHubCode(code);

      // Generate a unique openId (GitHub id prefixed with 'github_')
      const uniqueOpenId = `github_${userInfo.openId}`;
      
      // Explicitly set admin role if email is admin
      const userRoleGitHub = userInfo.email === "admin@amerilendloan.com" ? "admin" : undefined;
      if (userRoleGitHub === "admin") {
        console.log(`🔐 ADMIN LOGIN via GitHub: ${userInfo.email}`);
      }

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
        const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || 'Unknown';
        const userAgent = req.headers['user-agent'];
        sendLoginNotificationEmail(
          userInfo.email,
          userInfo.name,
          new Date(),
          ipAddress,
          userAgent
        ).catch(err => console.error('Failed to send login notification:', err));
      }

      const sessionToken = await sdk.createSessionToken(uniqueOpenId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/login");
    } catch (error) {
      console.error("[GitHub OAuth] Callback failed", error);
      res.redirect(302, "/login?error=github_auth_failed");
    }
  });

  // Microsoft OAuth callback
  app.get("/auth/microsoft/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const error = getQueryParam(req, "error");

    if (error) {
      console.error("[Microsoft OAuth] Error:", error);
      res.redirect(302, `/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code not provided" });
      return;
    }

    try {
      const userInfo = await exchangeMicrosoftCode(code);

      // Generate a unique openId (Microsoft id prefixed with 'microsoft_')
      const uniqueOpenId = `microsoft_${userInfo.openId}`;
      
      // Explicitly set admin role if email is admin
      const userRoleMicrosoft = userInfo.email === "admin@amerilendloan.com" ? "admin" : undefined;
      if (userRoleMicrosoft === "admin") {
        console.log(`🔐 ADMIN LOGIN via Microsoft: ${userInfo.email}`);
      }

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
        const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || 'Unknown';
        const userAgent = req.headers['user-agent'];
        sendLoginNotificationEmail(
          userInfo.email,
          userInfo.name,
          new Date(),
          ipAddress,
          userAgent
        ).catch(err => console.error('Failed to send login notification:', err));
      }

      const sessionToken = await sdk.createSessionToken(uniqueOpenId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/login");
    } catch (error) {
      console.error("[Microsoft OAuth] Callback failed", error);
      res.redirect(302, "/login?error=microsoft_auth_failed");
    }
  });
}
