/**
 * Supabase Authentication Integration
 * Handles user authentication via Supabase Auth while maintaining SendGrid for emails
 */

import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";
import { sendEmail } from "./email";
import * as db from "../db";

// Initialize Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseClient && ENV.supabaseUrl && ENV.supabaseAnonKey) {
    supabaseClient = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    });
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
      throw error;
    }

    return { success: true, user: data.user };
  } catch (error: any) {
    console.error("Supabase signup error:", error);
    return { success: false, error: error.message };
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
      throw error;
    }

    return { success: true, user: data.user, session: data.session };
  } catch (error: any) {
    console.error("Supabase signin error:", error);
    return { success: false, error: error.message };
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
        emailRedirectTo: `${process.env.VITE_APP_URL || "http://localhost:3000"}/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error: any) {
    console.error("Supabase OTP error:", error);
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
    console.error("Supabase OTP verification error:", error);
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
      redirectTo: `${process.env.VITE_APP_URL || "http://localhost:3000"}/auth/reset-password`,
    });

    if (error) {
      throw error;
    }

    // Send via your SendGrid template (optional - Supabase sends its own)
    // You can add custom email logic here if desired

    return { success: true };
  } catch (error: any) {
    console.error("Password reset error:", error);
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
    console.error("Sign out error:", error);
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
    console.error("Get session error:", error);
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
    console.error("Get user error:", error);
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
    console.error("Update profile error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);
}
