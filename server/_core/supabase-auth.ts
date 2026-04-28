/**
 * Supabase Authentication Integration
 * Handles user authentication via Supabase Auth while maintaining SendGrid for emails
 */

import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";
import { sendEmail } from "./email";
import * as db from "../db";
import { logger } from "./logger";

// Initialize Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

/**
 * Resolve the public-facing app URL used for email-link redirects (OAuth /
 * password reset / OTP confirmation). Prefer VITE_APP_URL, then
 * RAILWAY_PUBLIC_DOMAIN, then fall back to localhost only in development —
 * never silently hand a localhost link to a real user in production.
 */
function getAppUrl(): string {
  if (ENV.viteAppUrl) return ENV.viteAppUrl.replace(/\/+$/, "");
  if (process.env.VITE_APP_URL) return process.env.VITE_APP_URL.replace(/\/+$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (process.env.NODE_ENV === "production") {
    logger.warn(
      "[Supabase] VITE_APP_URL is not configured in production — email redirect links will be unusable",
    );
  }
  return "http://localhost:3000";
}

export function getSupabaseClient() {
  if (!supabaseClient && ENV.supabaseUrl && ENV.supabaseAnonKey) {
    try {
      supabaseClient = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
        },
      });
      logger.info("✅ Supabase client initialized successfully");
    } catch (error) {
      logger.error("❌ Failed to initialize Supabase client:", error);
      supabaseClient = null;
    }
  }
  return supabaseClient;
}

/**
 * Sign up user with email and password
 */
export async function signUpWithEmail(email: string, password: string, fullName?: string) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase not configured");
    }

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      // Map Supabase errors to user-friendly messages
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        return { success: false, error: "This email is already registered. Please sign in instead." };
      }
      if (error.message.includes('invalid email')) {
        return { success: false, error: "Please enter a valid email address" };
      }
      if (error.message.includes('password') && error.message.includes('weak')) {
        return { success: false, error: "Password is too weak. Please use a stronger password with at least 8 characters." };
      }
      if (error.message.includes('password') && error.message.includes('short')) {
        return { success: false, error: "Password must be at least 8 characters long" };
      }
      
      throw error;
    }

    return { success: true, user: data.user };
  } catch (error: any) {
    logger.error("Supabase signup error:", error);
    
    // Provide a more specific error message
    const errorMessage = error.message || "Unable to create account. Please try again.";
    return { success: false, error: errorMessage };
  }
}

/**
 * Sign in user with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase not configured");
    }

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Map Supabase errors to user-friendly messages
      if (error.message.includes('Invalid login credentials') || error.message.includes('invalid credentials')) {
        return { success: false, error: "Invalid email or password. Please try again." };
      }
      if (error.message.includes('Email not confirmed')) {
        return { success: false, error: "Please verify your email address before signing in." };
      }
      if (error.message.includes('User not found')) {
        return { success: false, error: "No account found with this email. Please sign up first." };
      }
      
      throw error;
    }

    return { success: true, user: data.user, session: data.session };
  } catch (error: any) {
    logger.error("Supabase signin error:", error);
    
    // Provide a more specific error message
    const errorMessage = error.message || "Unable to sign in. Please try again.";
    return { success: false, error: errorMessage };
  }
}

/**
 * Sign in with OTP (still uses Supabase for management but your SendGrid for emails)
 */
export async function signInWithOTP(email: string) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase not configured");
    }

    const { data, error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error: any) {
    logger.error("Supabase OTP error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify OTP token (custom - uses your database for audit trail)
 */
export async function verifyOTPToken(email: string, token: string) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase not configured");
    }

    const { data, error } = await client.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      throw error;
    }

    // Get or create user in your database
    const user = await db.getUserByEmail(email);
    if (!user && data.user) {
      await db.upsertUser({
        openId: data.user.id,
        email: data.user.email || undefined,
        name: data.user.user_metadata?.full_name,
        loginMethod: "otp",
        lastSignedIn: new Date(),
      });
    }

    return { success: true, user: data.user, session: data.session };
  } catch (error: any) {
    logger.error("Supabase OTP verification error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset email (uses your SendGrid template)
 */
export async function sendPasswordResetEmail(email: string) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase not configured");
    }

    // Generate reset link via Supabase
    const { data, error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppUrl()}/auth/reset-password`,
    });

    if (error) {
      throw error;
    }

    // Send via your SendGrid template (optional - Supabase sends its own)
    // You can add custom email logic here if desired

    return { success: true };
  } catch (error: any) {
    logger.error("Password reset error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Sign out user
 */
export async function signOut() {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase not configured");
    }

    const { error } = await client.auth.signOut();

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error: any) {
    logger.error("Sign out error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current session
 */
export async function getCurrentSession() {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase not configured");
    }

    const { data, error } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    return { success: true, session: data.session };
  } catch (error: any) {
    logger.error("Get session error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase not configured");
    }

    const { data, error } = await client.auth.getUser();

    if (error) {
      throw error;
    }

    return { success: true, user: data.user };
  } catch (error: any) {
    logger.error("Get user error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(updates: {
  email?: string;
  password?: string;
  data?: Record<string, any>;
}) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase not configured");
    }

    const { data, error } = await client.auth.updateUser(updates);

    if (error) {
      throw error;
    }

    return { success: true, user: data.user };
  } catch (error: any) {
    logger.error("Update profile error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  const configured = Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);
  if (!configured) {
    logger.warn("⚠️  Supabase not configured - VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing");
  }
  return configured;
}
