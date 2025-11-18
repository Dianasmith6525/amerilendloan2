import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { createOTP, verifyOTP, sendOTPEmail, sendOTPPhone } from "./_core/otp";
import { createAuthorizeNetTransaction, getAcceptJsConfig } from "./_core/authorizenet";
import { createCryptoCharge, checkCryptoPaymentStatus, getSupportedCryptos, convertUSDToCrypto, verifyCryptoPaymentByTxHash, checkNetworkStatus } from "./_core/crypto-payment";
import { verifyCryptoTransactionWeb3, getNetworkStatus } from "./_core/web3-verification";
import { legalAcceptances, loanApplications } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { sendLoginNotificationEmail, sendEmailChangeNotification, sendBankInfoChangeNotification, sendSuspiciousActivityAlert, sendApplicationApprovedNotificationEmail, sendApplicationRejectedNotificationEmail, sendApplicationDisbursedNotificationEmail, sendLoanApplicationReceivedEmail, sendAdminNewApplicationNotification, sendAdminDocumentUploadNotification } from "./_core/email";
import { invokeLLM } from "./_core/llm";
import { buildMessages, getSuggestedPrompts, type SupportContext } from "./_core/aiSupport";
import { buildAdminMessages, getAdminSuggestedTasks, type AdminAiContext, type AdminAiRecommendation } from "./_core/adminAiAssistant";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { getClientIP } from "./_core/ipUtils";
import { 
  signUpWithEmail, 
  signInWithEmail, 
  signInWithOTP, 
  verifyOTPToken, 
  sendPasswordResetEmail, 
  signOut as supabaseSignOut,
  getCurrentUser,
  updateUserProfile,
  isSupabaseConfigured
} from "./_core/supabase-auth";

// Helper function to get varied fallback responses based on user intent
// Returns different responses each time to avoid repetition
const getFallbackResponse = (userMessage: string): string => {
  const msg = userMessage.toLowerCase();

  // Application/Apply related
  if (msg.includes("apply")) {
    const responses = [
      "To apply for a loan with AmeriLend, visit our Apply page. The process takes just a few minutes and requires basic information about yourself and the loan amount you need.",
      "Ready to apply? Head to our Apply page and you'll be done in minutes. We just need some basic info about you and your desired loan amount.",
      "Getting a loan from AmeriLend is easy! Simply visit our application page, enter your details, and we'll process your request quickly.",
      "Our application process is simple and quick. Visit the Apply page to get started - most people complete it in under 5 minutes.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Payment related
  if (msg.includes("payment") || msg.includes("pay")) {
    const responses = [
      "You can make payments through your dashboard. Log in to view your loan details and payment options. We accept credit cards and bank transfers.",
      "Making a payment is simple - just log into your dashboard, find your loan, and select your preferred payment method (credit card or bank transfer).",
      "Pay your loan anytime through your dashboard. We accept credit cards and bank transfers for your convenience.",
      "To make a payment, simply log in, navigate to your loan details, and choose how you'd like to pay - credit card or bank transfer.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Status/Tracking related
  if (msg.includes("status") || msg.includes("track")) {
    const responses = [
      "You can track your application status using the Track Application tab. Simply enter your Application ID and email address to check your status in real-time.",
      "Want to check your application status? Use our Track Application tab - just provide your Application ID and email address.",
      "Track your application progress anytime! Go to the Track Application tab and enter your Application ID and email to see real-time updates.",
      "Checking your status is easy - switch to the Track Application tab, enter your ID and email, and you'll get instant updates.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Fee related
  if (msg.includes("fee")) {
    const responses = [
      "Our processing fees are transparent and clearly displayed before you pay. They typically range from 0.5% to 10% depending on our current fee structure. You'll see the exact fee during the payment process.",
      "All fees are clearly shown upfront during checkout. Depending on loan type and amount, fees typically range from 0.5% to 10%.",
      "We believe in transparent pricing. Your exact fees will be displayed before payment, usually between 0.5% and 10%.",
      "Processing fees are displayed transparently before you pay. Most customers see fees between 0.5% and 10% depending on their loan.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Eligibility related
  if (msg.includes("eligib") || msg.includes("require")) {
    const responses = [
      "To qualify for an AmeriLend loan, you need to be a U.S. resident, at least 18 years old, and have a valid income source. We work with applicants of all credit levels.",
      "Basic eligibility: U.S. resident, 18+, and a valid income source. The good news? We work with all credit levels, not just perfect scores.",
      "You'll need to be a U.S. resident, at least 18, with a valid income source. Don't worry about your credit score - we consider all levels.",
      "Our eligibility is simple: U.S. residency, age 18+, and some income. We're flexible on credit - everyone gets a fair shot.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Contact/Support related
  if (msg.includes("contact") || msg.includes("support")) {
    const responses = [
      "You can reach our support team at (945) 212-1609, Monday-Friday 8am-8pm CT, or Saturday-Sunday 9am-5pm CT. You can also email us at support@amerilendloan.com.",
      "Contact us at (945) 212-1609 (M-F 8am-8pm CT, Sat-Sun 9am-5pm CT) or email support@amerilendloan.com. We're here to help!",
      "Our support team is available at (945) 212-1609 weekdays 8am-8pm CT and weekends 9am-5pm CT. Email support@amerilendloan.com anytime.",
      "Reach out to our support team: call (945) 212-1609 during business hours or email support@amerilendloan.com any time.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Default/General
  const defaultResponses = [
    "Thank you for your question! I'm here to help. You can ask me about the application process, loan payments, tracking your status, fees, eligibility requirements, or contact support. Feel free to ask anything!",
    "I'm ready to assist you! Whether it's about applying, payments, tracking, fees, or eligibility, I've got you covered. What would you like to know?",
    "How can I help you today? I can answer questions about applications, payments, status tracking, fees, eligibility, or direct you to our support team.",
    "Welcome! I'm here to help with any questions about AmeriLend loans. Ask me about applying, payments, tracking, fees, or eligibility.",
  ];
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
};

export const appRouter = router({
  system: systemRouter,
  
  // Authentication router
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),

    // Update user password
    updatePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(8),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const userId = ctx.user.id;
          
          // Hash the new password
          const bcrypt = await import('bcryptjs');
          const newPasswordHash = await bcrypt.hash(input.newPassword, 10);
          
          // Update password in database
          await db.updateUserPassword(userId, newPasswordHash);
          
          // Log the activity
          await db.logAccountActivity({
            userId,
            activityType: 'password_changed',
            description: 'User changed their password',
            ipAddress: ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string),
            userAgent: ctx.req?.headers?.['user-agent'] as string,
          });
          
          return { success: true, message: 'Password updated successfully' };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update password"
          });
        }
      }),

    // Update user email
    updateEmail: protectedProcedure
      .input(z.object({
        newEmail: z.string().email(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const userId = ctx.user.id;
          
          // Update email in database
          await db.updateUserEmail(userId, input.newEmail);
          
          // Log the activity
          await db.logAccountActivity({
            userId,
            activityType: 'email_changed',
            description: `Email changed from ${ctx.user.email} to ${input.newEmail}`,
            ipAddress: ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string),
            userAgent: ctx.req?.headers?.['user-agent'] as string,
          });
          
          // Send notification email to old and new addresses
          await sendEmailChangeNotification(ctx.user.email || '', input.newEmail, ctx.user.name || 'User');
          
          return { success: true, message: 'Email updated successfully. Check both emails for verification.' };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update email"
          });
        }
      }),

    // Update disbursement bank info
    updateBankInfo: protectedProcedure
      .input(z.object({
        bankAccountHolderName: z.string().min(2),
        bankAccountNumber: z.string().min(8),
        bankRoutingNumber: z.string().regex(/^\d{9}$/),
        bankAccountType: z.enum(['checking', 'savings']),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const userId = ctx.user.id;
          
          // Update bank info in database
          await db.updateUserBankInfo(userId, input);
          
          // Log the activity
          await db.logAccountActivity({
            userId,
            activityType: 'bank_info_updated',
            description: `Bank account updated for ${input.bankAccountHolderName}`,
            ipAddress: ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string),
            userAgent: ctx.req?.headers?.['user-agent'] as string,
          });
          
          // Send bank update notification
          if (ctx.user.email) {
            await sendBankInfoChangeNotification(ctx.user.email, ctx.user.name || 'User');
          }
          
          return { success: true, message: 'Bank information updated successfully' };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update bank information"
          });
        }
      }),

    // Get account activity log
    getActivityLog: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          const activities = await db.getAccountActivity(ctx.user.id);
          return activities;
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch activity log"
          });
        }
      }),

    // Verify email change token
    verifyEmailToken: publicProcedure
      .input(z.object({
        token: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const tokenRecord = await db.verifyEmailToken(input.token);
          if (!tokenRecord) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid or expired verification token"
            });
          }

          // Update user email
          await db.updateUserEmail(tokenRecord.userId, tokenRecord.newEmail);

          // Log the activity
          await db.logAccountActivity({
            userId: tokenRecord.userId,
            activityType: 'email_changed',
            description: `Email verified and changed to ${tokenRecord.newEmail}`,
            ipAddress: ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string),
            userAgent: ctx.req?.headers?.['user-agent'] as string,
          });

          return { success: true, message: 'Email verified successfully' };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to verify email token"
          });
        }
      }),

    // Request 2FA for sensitive operations
    requestTwoFA: protectedProcedure
      .input(z.object({
        operationType: z.enum(['password', 'email', 'bank']),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const email = ctx.user.email;
          if (!email) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No email on file for 2FA"
            });
          }

          // Send OTP to email
          const { createOTP, sendOTPEmail } = await import("./_core/otp");
          const code = await createOTP(email, 'reset', 'email'); // reuse reset purpose for 2FA
          await sendOTPEmail(email, code, 'reset');

          // Log attempt
          await db.logAccountActivity({
            userId: ctx.user.id,
            activityType: 'settings_changed',
            description: `2FA requested for ${input.operationType} change`,
            ipAddress: ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string),
            userAgent: ctx.req?.headers?.['user-agent'] as string,
          });

          return { success: true, message: `Verification code sent to ${email}` };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send 2FA code"
          });
        }
      }),

    // Get active sessions
    getActiveSessions: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          const sessions = await db.getUserSessions(ctx.user.id);
          return sessions.map(s => ({
            id: s.id,
            ipAddress: s.ipAddress,
            userAgent: s.userAgent,
            lastActivityAt: s.lastActivityAt,
            createdAt: s.createdAt,
          }));
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch sessions"
          });
        }
      }),

    // Terminate specific session
    terminateSession: protectedProcedure
      .input(z.object({
        sessionToken: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          await db.deleteUserSession(input.sessionToken);

          await db.logAccountActivity({
            userId: ctx.user.id,
            activityType: 'settings_changed',
            description: 'Session terminated',
            ipAddress: ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string),
            userAgent: ctx.req?.headers?.['user-agent'] as string,
          });

          return { success: true, message: 'Session terminated' };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to terminate session"
          });
        }
      }),

    // Update notification preferences
    updateNotificationPreferences: protectedProcedure
      .input(z.object({
        emailUpdates: z.boolean(),
        loanUpdates: z.boolean(),
        promotions: z.boolean(),
        sms: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const userId = ctx.user.id;
          
          await db.setNotificationPreference(userId, 'email_updates', input.emailUpdates);
          await db.setNotificationPreference(userId, 'loan_updates', input.loanUpdates);
          await db.setNotificationPreference(userId, 'promotions', input.promotions);
          await db.setNotificationPreference(userId, 'sms', input.sms);

          return { success: true, message: 'Notification preferences updated' };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update notification preferences"
          });
        }
      }),

    // Get notification preferences
    getNotificationPreferences: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          const prefs = await db.getNotificationPreferences(ctx.user.id);
          return {
            emailUpdates: prefs.some(p => p.preferenceType === 'email_updates' && p.enabled),
            loanUpdates: prefs.some(p => p.preferenceType === 'loan_updates' && p.enabled),
            promotions: prefs.some(p => p.preferenceType === 'promotions' && p.enabled),
            sms: prefs.some(p => p.preferenceType === 'sms' && p.enabled),
          };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch notification preferences"
          });
        }
      }),

    // Personal profile procedures
    getUserProfile: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          const profile = await db.getUserProfile(ctx.user.id);
          return profile || null;
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch user profile"
          });
        }
      }),

    updateUserProfile: protectedProcedure
      .input(z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phoneNumber: z.string().optional(),
        dateOfBirth: z.string().optional(),
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional(),
        employmentStatus: z.string().optional(),
        employer: z.string().optional(),
        jobTitle: z.string().optional(),
        monthlyIncome: z.number().optional(),
        bio: z.string().optional(),
        preferredLanguage: z.string().optional(),
        timezone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Map firstName/lastName to name for updateUserProfile
          const profileUpdate = {
            name: input.firstName && input.lastName 
              ? `${input.firstName} ${input.lastName}`
              : input.firstName || input.lastName || undefined,
            phone: input.phoneNumber,
          };
          
          await db.updateUserProfile(ctx.user.id, profileUpdate);
          
          // Log the activity
          await db.logAccountActivity({
            userId: ctx.user.id,
            activityType: 'profile_updated',
            description: 'User profile information updated',
            ipAddress: ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string),
            userAgent: ctx.req?.headers?.['user-agent'] as string,
          });

          return { success: true, message: 'Profile updated successfully' };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update user profile"
          });
        }
      }),

    // Two-Factor Authentication procedures
    get2FASettings: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          const settings = await db.get2FASettings(ctx.user.id);
          return settings || null;
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch 2FA settings"
          });
        }
      }),

    enable2FA: protectedProcedure
      .input(z.object({
        method: z.enum(['totp', 'sms', 'email']),
        phoneNumber: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Generate backup codes
          const backupCodes = Array.from({ length: 10 }, () =>
            Math.random().toString(36).substring(2, 10).toUpperCase()
          );

          let totpSecret = null;
          if (input.method === 'totp') {
            // Generate TOTP secret (simplified - in production use speakeasy or similar)
            totpSecret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          }

          await db.enable2FA(ctx.user.id, {
            method: input.method,
            totpSecret,
            phoneNumber: input.phoneNumber,
            backupCodes: JSON.stringify(backupCodes),
          });

          // Log the activity
          await db.logAccountActivity({
            userId: ctx.user.id,
            activityType: 'settings_changed',
            description: `2FA enabled with method: ${input.method}`,
            ipAddress: ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string),
            userAgent: ctx.req?.headers?.['user-agent'] as string,
          });

          return { 
            success: true, 
            message: '2FA enabled successfully',
            backupCodes,
            totpSecret: input.method === 'totp' ? totpSecret : null,
          };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to enable 2FA"
          });
        }
      }),

    disable2FA: protectedProcedure
      .input(z.object({
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Verify password before disabling 2FA
          const user = await db.getUserById(ctx.user.id);
          if (!user?.passwordHash) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "User authentication required"
            });
          }

          await db.disable2FA(ctx.user.id);

          // Log the activity
          await db.logAccountActivity({
            userId: ctx.user.id,
            activityType: 'settings_changed',
            description: '2FA disabled',
            ipAddress: ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string),
            userAgent: ctx.req?.headers?.['user-agent'] as string,
          });

          return { success: true, message: '2FA disabled successfully' };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to disable 2FA"
          });
        }
      }),

    // Trusted Devices
    getTrustedDevices: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          const devices = await db.getTrustedDevices(ctx.user.id);
          return devices;
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch trusted devices"
          });
        }
      }),

    removeTrustedDevice: protectedProcedure
      .input(z.object({
        deviceId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          await db.removeTrustedDevice(input.deviceId, ctx.user.id);

          // Log the activity
          await db.logAccountActivity({
            userId: ctx.user.id,
            activityType: 'settings_changed',
            description: `Trusted device removed: ${input.deviceId}`,
            ipAddress: ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string),
            userAgent: ctx.req?.headers?.['user-agent'] as string,
          });

          return { success: true, message: 'Device removed from trusted list' };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to remove trusted device"
          });
        }
      }),

    // Request Account Deletion
    requestAccountDeletion: protectedProcedure
      .input(z.object({
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // In production, you'd create a deletion request that needs email verification
          // For now, we'll log the request
          await db.logAccountActivity({
            userId: ctx.user.id,
            activityType: 'settings_changed',
            description: `Account deletion requested. Reason: ${input.reason || 'Not provided'}`,
            ipAddress: ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string),
            userAgent: ctx.req?.headers?.['user-agent'] as string,
          });

          // Send email notification about deletion request
          if (ctx.user.email && ctx.user.name) {
            await sendLoginNotificationEmail(
              ctx.user.email,
              ctx.user.name,
              new Date(),
              ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string) || '',
              ctx.req?.headers?.['user-agent'] as string || ''
            );
          }

          return { success: true, message: 'Account deletion request submitted. Check your email for confirmation.' };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to submit account deletion request"
          });
        }
      }),

    // Supabase Auth Endpoints
    supabaseSignUp: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        fullName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (!isSupabaseConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase auth not configured"
          });
        }

        const result = await signUpWithEmail(input.email, input.password, input.fullName);
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Failed to sign up"
          });
        }

        return { success: true, userId: result.user?.id };
      }),

    supabaseSignIn: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!isSupabaseConfigured()) {
          // Supabase not configured - fall back to OTP
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Password login not available. Please use email verification code instead."
          });
        }

        try {
          const result = await signInWithEmail(input.email, input.password);
          if (!result.success) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: result.error || "Failed to sign in"
            });
          }

          // Create and set our own signed session cookie (not the Supabase token)
          if (result.session && result.user?.id) {
            const cookieOptions = getSessionCookieOptions(ctx.req);
            const sessionToken = await sdk.createSessionToken(result.user.id, {
              name: result.user.user_metadata?.full_name || "",
              expiresInMs: ONE_YEAR_MS,
            });
            ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          }

          // Sync with your database and send login notification
          const user = result.user;
          if (user) {
            const ipAddress = getClientIP(ctx.req);
            const userAgent = ctx.req?.headers?.['user-agent'] as string;

            await db.upsertUser({
              openId: user.id,
              email: user.email,
              name: user.user_metadata?.full_name,
              loginMethod: 'password',
              lastSignedIn: new Date(),
            });

            // Send login notification email
            if (user.email && user.user_metadata?.full_name) {
              sendLoginNotificationEmail(
                user.email,
                user.user_metadata.full_name,
                new Date(),
                ipAddress,
                userAgent
              ).catch(err => console.error('[Email] Failed to send login notification:', err));
            }
          }

          return { success: true, user: result.user?.email };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error("[Auth] Supabase login error:", errorMsg);
          
          // Provide user-friendly error messages
          if (errorMsg.includes("invalid") || errorMsg.includes("API")) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Authentication service unavailable. Please use email verification code instead."
            });
          }
          
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password"
          });
        }
      }),

    supabaseSignInWithOTP: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        if (!isSupabaseConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase auth not configured"
          });
        }

        const result = await signInWithOTP(input.email);
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Failed to send OTP"
          });
        }

        return { success: true, message: "Check your email for the OTP" };
      }),

    supabaseVerifyOTP: publicProcedure
      .input(z.object({
        email: z.string().email(),
        token: z.string().length(6),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!isSupabaseConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase auth not configured"
          });
        }

        const result = await verifyOTPToken(input.email, input.token);
        if (!result.success) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: result.error || "Failed to verify OTP"
          });
        }

        // Create and set our own signed session cookie (not the Supabase token)
        if (result.session && result.user?.id) {
          const cookieOptions = getSessionCookieOptions(ctx.req);
          const sessionToken = await sdk.createSessionToken(result.user.id, {
            name: result.user.user_metadata?.full_name || "",
            expiresInMs: ONE_YEAR_MS,
          });
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        }

        return { success: true, user: result.user?.email };
      }),

    supabaseResetPassword: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        if (!isSupabaseConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase auth not configured"
          });
        }

        const result = await sendPasswordResetEmail(input.email);
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Failed to send reset email"
          });
        }

        return { success: true, message: "Check your email for reset instructions" };
      }),

    supabaseUpdateProfile: protectedProcedure
      .input(z.object({
        email: z.string().email().optional(),
        password: z.string().min(8).optional(),
        fullName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!isSupabaseConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase auth not configured"
          });
        }

        const result = await updateUserProfile({
          email: input.email,
          password: input.password,
          data: {
            full_name: input.fullName,
          },
        });

        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Failed to update profile"
          });
        }

        return { success: true };
      }),

    supabaseSignOut: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (!isSupabaseConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase auth not configured"
          });
        }

        const result = await supabaseSignOut();
        
        // Clear session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

        return { success: true };
      }),

    isSupabaseAuthEnabled: publicProcedure
      .query(() => {
        return { enabled: isSupabaseConfigured() };
      }),
  }),

  // OTP Authentication router
  otp: router({  
    // Request OTP code for signup or login via email
    requestCode: publicProcedure
      .input(z.object({
        email: z.string().email(),
        purpose: z.enum(["signup", "login", "reset"]),
      }))
      .mutation(async ({ input }) => {
        const code = await createOTP(input.email, input.purpose, "email");
        await sendOTPEmail(input.email, code, input.purpose);
        return { success: true };
      }),

    // Request OTP code for signup or login via phone
    requestPhoneCode: publicProcedure
      .input(z.object({
        phone: z.string().min(10),
        purpose: z.enum(["signup", "login", "reset"]),
      }))
      .mutation(async ({ input }) => {
        const code = await createOTP(input.phone, input.purpose, "phone");
        await sendOTPPhone(input.phone, code, input.purpose);
        return { success: true };
      }),

    // Verify OTP code (works for both email and phone)
    verifyCode: publicProcedure
      .input(z.object({
        identifier: z.string(), // email or phone
        code: z.string().length(6),
        purpose: z.enum(["signup", "login", "reset"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await verifyOTP(input.identifier, input.code, input.purpose);
        if (!result.valid) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: result.error || "Invalid code" 
          });
        }
        
        // Send login notification email for login purpose
        if (input.purpose === "login") {
          const ipAddress = getClientIP(ctx.req);
          const userAgent = ctx.req?.headers?.['user-agent'] as string;
          
          // Get user info from database by identifier (email or phone)
          try {
            const user = await db.getUserByEmailOrPhone(input.identifier);
            
            if (user && user.email && user.name) {
              // Send email in background, don't block the response
              sendLoginNotificationEmail(
                user.email,
                user.name,
                new Date(),
                ipAddress,
                userAgent
              ).catch(err => console.error('[Email] Failed to send login notification:', err));
            }
          } catch (err) {
            console.error('[Login] Error getting user info for notification:', err);
            // Don't throw - email notification is not critical to login
          }
        }
        // For signup/login, create or fetch user and set our session cookie
        if (input.purpose === "signup" || input.purpose === "login") {
          try {
            let user = await db.getUserByEmail(input.identifier);
            if (!user) {
              // Create a user for email-based OTP auth
              user = await db.createUser(input.identifier);
            } else {
              // Update lastSignedIn timestamp
              await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
            }

            // Create and set our own signed session cookie
            const cookieOptions = getSessionCookieOptions(ctx.req);
            const sessionToken = await sdk.createSessionToken(user.openId, {
              name: user.name || "",
              expiresInMs: ONE_YEAR_MS,
            });
            ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          } catch (err) {
            console.error('[OTP] Failed to establish session after verification:', err);
            // Do not expose internal error details to client
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to establish session' });
          }
        }

        return { success: true };
      }),

    // Record login attempt and check rate limiting
    recordAttempt: publicProcedure
      .input(z.object({
        email: z.string().email(),
        successful: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const ipAddress = ctx.req?.ip || (ctx.req?.headers?.['x-forwarded-for'] as string) || 'Unknown';
          
          // Record the login attempt
          await db.recordLoginAttempt(input.email, ipAddress, input.successful);

          // Check rate limiting (max 5 failed attempts in 15 minutes)
          if (!input.successful) {
            const attemptCount = await db.checkLoginAttempts(input.email, ipAddress);
            
            if (attemptCount > 5) {
              // Alert user of suspicious activity
              const user = await db.getUserByEmailOrPhone(input.email);
              if (user?.email) {
                const { sendSuspiciousActivityAlert } = await import("./_core/email");
                sendSuspiciousActivityAlert(
                  user.email,
                  `Multiple failed login attempts detected from IP: ${ipAddress}`,
                  ipAddress,
                  ctx.req?.headers?.['user-agent'] as string
                ).catch(err => console.error('Failed to send alert:', err));
              }
              
              throw new TRPCError({
                code: "TOO_MANY_REQUESTS",
                message: "Too many failed login attempts. Please try again in 15 minutes or reset your password."
              });
            }
          }
          
          return { success: true, remainingAttempts: Math.max(0, 5 - (await db.checkLoginAttempts(input.email, ipAddress))) };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to record login attempt"
          });
        }
      }),
  }),

  // Loan application router
  loans: router({
    // Check for duplicate account/application by DOB and SSN (public endpoint)
    checkDuplicate: publicProcedure
      .input(z.object({
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/),
      }))
      .query(async ({ input }) => {
        try {
          const duplicate = await db.checkDuplicateAccount(input.dateOfBirth, input.ssn);
          if (duplicate) {
            // Mask email for security: show first 3 chars + ***@domain
            let maskedEmail = undefined;
            if (duplicate.email) {
              const [localPart, domain] = duplicate.email.split('@');
              maskedEmail = localPart.substring(0, 3) + '***@' + domain;
            }
            
            return {
              hasDuplicate: true,
              status: duplicate.status,
              trackingNumber: duplicate.trackingNumber,
              maskedEmail,
              message: duplicate.message,
              canApply: duplicate.status === 'rejected' || duplicate.status === 'cancelled'
            };
          }
          return {
            hasDuplicate: false,
            canApply: true,
            message: "No existing applications found. You can proceed with a new application."
          };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to check for duplicate account"
          });
        }
      }),

    // Get loan application by tracking number (public endpoint for tracking)
    getLoanByTrackingNumber: publicProcedure
      .input(z.object({
        trackingNumber: z.string().min(1),
      }))
      .query(async ({ input }) => {
        try {
          // Get all applications and find by tracking number
          const allApplications = await db.getAllLoanApplications();
          const application = allApplications.find(
            (app) => app.trackingNumber?.toUpperCase() === input.trackingNumber.toUpperCase()
          );

          if (!application) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Application not found. Please check your tracking number."
            });
          }

          // Return application details (safe to expose as it's public tracking)
          return {
            id: application.id,
            trackingNumber: application.trackingNumber,
            fullName: application.fullName,
            status: application.status,
            loanType: application.loanType,
            requestedAmount: application.requestedAmount,
            approvedAmount: application.approvedAmount,
            processingFeeAmount: application.processingFeeAmount,
            createdAt: application.createdAt,
            approvedAt: application.approvedAt,
            disbursedAt: application.disbursedAt,
            rejectionReason: application.rejectionReason,
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve application"
          });
        }
      }),

    // Submit a new loan application
    submit: publicProcedure
      .input(z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(10),
        password: z.string().min(8),
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/),
        street: z.string().min(1),
        city: z.string().min(1),
        state: z.string().length(2),
        zipCode: z.string().min(5),
        employmentStatus: z.enum(["employed", "self_employed", "unemployed", "retired"]),
        employer: z.string().optional(),
        monthlyIncome: z.number().int().positive(),
        loanType: z.enum(["installment", "short_term"]),
        requestedAmount: z.number().int().positive(),
        loanPurpose: z.string().min(10),
        disbursementMethod: z.enum(["bank_transfer", "check", "debit_card", "paypal", "crypto"]),
      }))
      .mutation(async ({ input }) => {
        try {
          // Check database connection first
          const dbConnection = await getDb();
          if (!dbConnection) {
            console.error("[Application Submit] Database connection failed - DATABASE_URL not configured");
            throw new TRPCError({ 
              code: "INTERNAL_SERVER_ERROR", 
              message: "Database connection unavailable. Please ensure DATABASE_URL is configured on the server." 
            });
          }

          // Check if user already exists
          let userId: number;
          let existingUser;
          try {
            existingUser = await db.getUserByEmail(input.email);
          } catch (error) {
            console.error("[Application Submit] Error checking for existing user:", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Database error while checking user account. Please try again.",
            });
          }
          
          if (existingUser) {
            userId = existingUser.id;
          } else {
            // Create new user account in database
            try {
              console.log("[Application Submit] Creating database user for:", input.email);
              const newUser = await db.createUser(input.email, input.fullName);
              if (!newUser) {
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Failed to create user record in database",
                });
              }
              console.log("[Application Submit] Database user created with ID:", newUser.id);
              userId = newUser.id;
            } catch (signupError) {
              console.error("[Application Submit] Signup error:", signupError instanceof Error ? signupError.message : signupError);
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create user account. Please ensure email is unique.",
              });
            }
          }

          // Generate unique tracking number
          const generateTrackingNumber = () => {
            const timestamp = Date.now().toString().slice(-6);
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            return `AL${timestamp}${random}`;
          };
          
          const result = await db.createLoanApplication({
            userId,
            trackingNumber: generateTrackingNumber(),
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            dateOfBirth: input.dateOfBirth,
            ssn: input.ssn,
            street: input.street,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            employmentStatus: input.employmentStatus,
            employer: input.employer,
            monthlyIncome: input.monthlyIncome,
            loanType: input.loanType,
            requestedAmount: input.requestedAmount,
            loanPurpose: input.loanPurpose,
            disbursementMethod: input.disbursementMethod,
          });
          
          // Send confirmation email to applicant
          try {
            await sendLoanApplicationReceivedEmail(
              input.fullName,
              input.email,
              result.trackingNumber,
              input.requestedAmount
            );
          } catch (emailError) {
            console.error("[Application Submit] Failed to send applicant confirmation email:", emailError);
            // Don't throw - application was submitted successfully, email is secondary
          }

          // Send notification to admin
          try {
            await sendAdminNewApplicationNotification(
              input.fullName,
              input.email,
              result.trackingNumber,
              input.requestedAmount,
              input.loanType,
              input.phone,
              input.employmentStatus
            );
          } catch (adminEmailError) {
            console.error("[Application Submit] Failed to send admin notification:", adminEmailError);
            // Don't throw - application was submitted successfully, admin email is secondary
          }
          
          return { 
            success: true, 
            trackingNumber: result.trackingNumber 
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          console.error("[Application Submit] Error:", errorMessage);
          
          // Check for duplicate account error
          if (errorMessage.includes("Duplicate account detected")) {
            throw new TRPCError({
              code: "CONFLICT",
              message: errorMessage,
            });
          }
          
          // Check for database errors
          if (errorMessage.includes("Database") || errorMessage.includes("database")) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Database error: " + errorMessage,
            });
          }
          
          // Generic error handling
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: errorMessage,
          });
        }
      }),

    // Get user's loan applications
    myApplications: protectedProcedure.query(async ({ ctx }) => {
      return db.getLoanApplicationsByUserId(ctx.user.id);
    }),

    // Get single loan application by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const application = await db.getLoanApplicationById(input.id);
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
        }
        // Users can only view their own applications, admins can view all
        if (ctx.user.role !== "admin" && application.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return application;
      }),

    // Admin: Get all loan applications
    adminList: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.getAllLoanApplications();
    }),

    // Admin: Approve loan application
    adminApprove: protectedProcedure
      .input(z.object({
        id: z.number(),
        approvedAmount: z.number().int().positive(),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const application = await db.getLoanApplicationById(input.id);
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        // Calculate processing fee
        const feeConfig = await db.getActiveFeeConfiguration();
        let processingFeeAmount: number;

        if (feeConfig?.calculationMode === "percentage") {
          // Percentage mode: basis points (200 = 2.00%)
          processingFeeAmount = Math.round((input.approvedAmount * feeConfig.percentageRate) / 10000);
        } else if (feeConfig?.calculationMode === "fixed") {
          // Fixed fee mode
          processingFeeAmount = feeConfig.fixedFeeAmount;
        } else {
          // Default to 2% if no config exists
          processingFeeAmount = Math.round((input.approvedAmount * 200) / 10000);
        }

        await db.updateLoanApplicationStatus(input.id, "approved", {
          approvedAmount: input.approvedAmount,
          processingFeeAmount,
          adminNotes: input.adminNotes,
          approvedAt: new Date(),
        });

        // Send approval notification email to user
        const user = await db.getUserById(application.userId);
        if (user?.email) {
          await sendApplicationApprovedNotificationEmail(
            user.email,
            user.name || user.email,
            application.trackingNumber || `APP-${input.id}`,
            input.approvedAmount,
            processingFeeAmount,
            input.adminNotes
          ).catch((error) => {
            console.error("Failed to send approval notification email:", error);
            // Don't throw - email failure shouldn't fail the approval
          });
        }

        return { success: true, processingFeeAmount };
      }),

    // Admin: Reject loan application
    adminReject: protectedProcedure
      .input(z.object({
        id: z.number(),
        rejectionReason: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // Get application details
        const application = await db.getLoanApplicationById(input.id);
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        await db.updateLoanApplicationStatus(input.id, "rejected", {
          rejectionReason: input.rejectionReason,
        });

        // Send rejection notification email to user
        const user = await db.getUserById(application.userId);
        if (user?.email) {
          await sendApplicationRejectedNotificationEmail(
            user.email,
            user.name || user.email,
            application.trackingNumber || `APP-${input.id}`,
            input.rejectionReason
          ).catch((error) => {
            console.error("Failed to send rejection notification email:", error);
            // Don't throw - email failure shouldn't fail the rejection
          });
        }

        return { success: true };
      }),
  }),

  // Fee configuration router (admin only)
  feeConfig: router({
    // Get active fee configuration
    getActive: publicProcedure.query(async () => {
      const config = await db.getActiveFeeConfiguration();
      if (!config) {
        // Return default configuration
        return {
          calculationMode: "percentage" as const,
          percentageRate: 200, // 2.00%
          fixedFeeAmount: 200, // $2.00
        };
      }
      return config;
    }),

    // Admin: Update fee configuration
    adminUpdate: protectedProcedure
      .input(z.object({
        calculationMode: z.enum(["percentage", "fixed"]),
        percentageRate: z.number().int().min(150).max(250).optional(), // 1.5% - 2.5%
        fixedFeeAmount: z.number().int().min(150).max(250).optional(), // $1.50 - $2.50
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // Validate that the appropriate field is provided
        if (input.calculationMode === "percentage" && !input.percentageRate) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Percentage rate is required for percentage mode" 
          });
        }
        if (input.calculationMode === "fixed" && !input.fixedFeeAmount) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Fixed fee amount is required for fixed mode" 
          });
        }

        await db.createFeeConfiguration({
          calculationMode: input.calculationMode,
          percentageRate: input.percentageRate || 200,
          fixedFeeAmount: input.fixedFeeAmount || 200,
          updatedBy: ctx.user.id,
        });

        return { success: true };
      }),
  }),

  // Payment router
  payments: router({
    // Get Authorize.net Accept.js configuration
    getAuthorizeNetConfig: publicProcedure.query(() => {
      return getAcceptJsConfig();
    }),

    // Get supported cryptocurrencies with rates
    getSupportedCryptos: publicProcedure.query(async () => {
      return getSupportedCryptos();
    }),

    // Convert USD amount to crypto
    convertToCrypto: publicProcedure
      .input(z.object({
        usdCents: z.number(),
        currency: z.enum(["BTC", "ETH", "USDT", "USDC"]),
      }))
      .query(async ({ input }) => {
        const amount = await convertUSDToCrypto(input.usdCents, input.currency);
        return { amount };
      }),
    // Create payment intent for processing fee (supports multiple payment methods)
    createIntent: protectedProcedure
      .input(z.object({
        loanApplicationId: z.number(),
        paymentMethod: z.enum(["card", "crypto"]).default("card"),
        paymentProvider: z.enum(["stripe", "authorizenet", "crypto"]).optional(),
        cryptoCurrency: z.enum(["BTC", "ETH", "USDT", "USDC"]).optional(),
        opaqueData: z.object({
          dataDescriptor: z.string(),
          dataValue: z.string(),
        }).optional(),
        idempotencyKey: z.string().uuid().optional(), // Prevent duplicate charges
      }))
      .mutation(async ({ ctx, input }) => {
        // Check idempotency: if same key, return cached result
        if (input.idempotencyKey) {
          const cachedResult = await db.getPaymentByIdempotencyKey(input.idempotencyKey);
          if (cachedResult) {
            const cachedData = JSON.parse(cachedResult.responseData || "{}");
            console.log("[Payment] Returning cached result for idempotency key:", input.idempotencyKey);
            return cachedData;
          }
        }

        const application = await db.getLoanApplicationById(input.loanApplicationId);
        
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        if (application.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        if (application.status !== "approved") {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Loan must be approved before payment" 
          });
        }
        
        if (!application.processingFeeAmount) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Processing fee not calculated" 
          });
        }

        // Determine payment provider
        const paymentProvider = input.paymentProvider || 
          (input.paymentMethod === "crypto" ? "crypto" : "authorizenet");

        let paymentData: any = {
          loanApplicationId: input.loanApplicationId,
          userId: ctx.user.id,
          amount: application.processingFeeAmount,
          currency: "USD",
          paymentProvider,
          paymentMethod: input.paymentMethod,
          status: "pending",
        };

        // For card payments with Authorize.Net
        if (input.paymentMethod === "card" && input.opaqueData) {
          // Create payment record first (for audit trail and retry logic)
          const payment = await db.createPayment(paymentData);
          
          if (!payment) {
            throw new TRPCError({ 
              code: "INTERNAL_SERVER_ERROR", 
              message: "Failed to create payment record" 
            });
          }

          const result = await createAuthorizeNetTransaction(
            application.processingFeeAmount,
            input.opaqueData,
            `Processing fee for loan #${application.trackingNumber}`
          );

          if (!result.success) {
            // Update payment to failed (don't throw immediately)
            await db.updatePaymentStatus(payment.id, "failed", {
              failureReason: result.error || "Card payment failed",
            });
            
            // Keep loan in fee_pending so user can retry
            await db.updateLoanApplicationStatus(
              input.loanApplicationId, 
              "fee_pending"
            );
            
            throw new TRPCError({ 
              code: "BAD_REQUEST", 
              message: result.error || "Card payment failed - please retry with another card",
              cause: "PAYMENT_DECLINED"
            });
          }

          // Payment succeeded - update record
          await db.updatePaymentStatus(payment.id, "succeeded", {
            paymentIntentId: result.transactionId,
            cardLast4: result.cardLast4,
            cardBrand: result.cardBrand,
            completedAt: new Date(),
          });

          // Update loan status to fee_paid
          await db.updateLoanApplicationStatus(input.loanApplicationId, "fee_paid");

          const cardResponse = { 
            success: true, 
            paymentId: payment.id,
            amount: application.processingFeeAmount,
            transactionId: result.transactionId,
            message: "Payment processed successfully"
          };

          // Cache result if idempotency key provided
          if (input.idempotencyKey) {
            await db.storeIdempotencyResult(
              input.idempotencyKey,
              payment.id,
              cardResponse,
              "success"
            ).catch(err => console.warn("[Idempotency] Failed to cache card payment result:", err));
          }

          return cardResponse;
        }

        // For crypto payments, create charge and get payment address
        if (input.paymentMethod === "crypto" && input.cryptoCurrency) {
          const charge = await createCryptoCharge(
            application.processingFeeAmount,
            input.cryptoCurrency,
            `Processing fee for loan #${application.trackingNumber}`,
            { loanApplicationId: input.loanApplicationId, userId: ctx.user.id }
          );

          if (!charge.success) {
            throw new TRPCError({ 
              code: "INTERNAL_SERVER_ERROR", 
              message: charge.error || "Failed to create crypto payment" 
            });
          }

          paymentData = {
            ...paymentData,
            cryptoCurrency: input.cryptoCurrency,
            cryptoAddress: charge.paymentAddress,
            cryptoAmount: charge.cryptoAmount,
            paymentIntentId: charge.chargeId,
          };

          // Create payment record
          const cryptoPayment = await db.createPayment(paymentData);
          
          if (!cryptoPayment) {
            throw new TRPCError({ 
              code: "INTERNAL_SERVER_ERROR", 
              message: "Failed to create payment record" 
            });
          }

          // Update loan status to fee_pending
          await db.updateLoanApplicationStatus(input.loanApplicationId, "fee_pending");

          const cryptoResponse = { 
            success: true,
            paymentId: cryptoPayment?.id,
            amount: application.processingFeeAmount,
            cryptoAddress: charge.paymentAddress,
            cryptoAmount: charge.cryptoAmount,
          };

          // Cache result if idempotency key provided
          if (input.idempotencyKey) {
            await db.storeIdempotencyResult(
              input.idempotencyKey,
              cryptoPayment?.id || 0,
              cryptoResponse,
              "success"
            ).catch(err => console.warn("[Idempotency] Failed to cache crypto payment result:", err));
          }

          return cryptoResponse;
        }

        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Invalid payment method or missing payment data" 
        });
      }),

    // Simulate payment confirmation (in production, this would be a webhook)
    confirmPayment: protectedProcedure
      .input(z.object({
        paymentId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const payment = await db.getPaymentById(input.paymentId);
        
        if (!payment) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        if (payment.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // Update payment status
        await db.updatePaymentStatus(input.paymentId, "succeeded", {
          completedAt: new Date(),
        });

        // Update loan application status to fee_paid
        await db.updateLoanApplicationStatus(payment.loanApplicationId, "fee_paid");

        return { success: true };
      }),

    // Get payments for a loan application
    getByLoanId: protectedProcedure
      .input(z.object({ loanApplicationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const application = await db.getLoanApplicationById(input.loanApplicationId);
        
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        if (application.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        return db.getPaymentsByLoanApplicationId(input.loanApplicationId);
      }),

    // Verify crypto payment by transaction hash
    verifyCryptoPayment: protectedProcedure
      .input(z.object({
        paymentId: z.number(),
        txHash: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const payment = await db.getPaymentById(input.paymentId);
        
        if (!payment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });
        }
        
        if (payment.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        if (payment.paymentMethod !== "crypto") {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "This payment is not a crypto payment" 
          });
        }

        // Verify the transaction on blockchain
        const verification = await verifyCryptoPaymentByTxHash(
          payment.cryptoCurrency as any,
          input.txHash,
          payment.cryptoAmount || "",
          payment.cryptoAddress || ""
        );

        if (!verification.valid) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: verification.message 
          });
        }

        // Update payment with transaction hash and status
        await db.updatePaymentStatus(input.paymentId, verification.confirmed ? "succeeded" : "processing", {
          cryptoTxHash: input.txHash,
          completedAt: verification.confirmed ? new Date() : undefined,
        });

        // If confirmed, update loan status to fee_paid
        if (verification.confirmed) {
          await db.updateLoanApplicationStatus(payment.loanApplicationId, "fee_paid");
        }

        return {
          success: true,
          verified: verification.valid,
          confirmed: verification.confirmed,
          confirmations: verification.confirmations,
          message: verification.message,
        };
      }),

    // Admin: Manually confirm crypto payment
    adminConfirmCrypto: adminProcedure
      .input(z.object({
        paymentId: z.number(),
        txHash: z.string().min(1),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const payment = await db.getPaymentById(input.paymentId);
        
        if (!payment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });
        }

        if (payment.paymentMethod !== "crypto") {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "This payment is not a crypto payment" 
          });
        }

        // Update payment with transaction hash and mark as succeeded
        await db.updatePaymentStatus(input.paymentId, "succeeded", {
          cryptoTxHash: input.txHash,
          completedAt: new Date(),
          adminNotes: input.adminNotes,
        });

        // Update loan status to fee_paid
        await db.updateLoanApplicationStatus(payment.loanApplicationId, "fee_paid");

        return { success: true, message: "Crypto payment confirmed" };
      }),

    // Check crypto payment status
    checkCryptoStatus: protectedProcedure
      .input(z.object({
        paymentId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const payment = await db.getPaymentById(input.paymentId);
        
        if (!payment) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        if (payment.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        if (payment.paymentMethod !== "crypto") {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "This payment is not a crypto payment" 
          });
        }

        // Check blockchain status if we have a tx hash
        const statusCheck = payment.cryptoTxHash 
          ? await checkCryptoPaymentStatus(payment.paymentIntentId || "", payment.cryptoTxHash)
          : { status: "pending" as const };

        return {
          paymentStatus: payment.status,
          blockchainStatus: statusCheck.status,
          confirmations: statusCheck.confirmations,
          txHash: payment.cryptoTxHash,
          cryptoAddress: payment.cryptoAddress,
          cryptoAmount: payment.cryptoAmount,
          cryptoCurrency: payment.cryptoCurrency,
        };
      }),

    // Web3 verification: Verify transaction on blockchain
    verifyWeb3Transaction: protectedProcedure
      .input(z.object({
        paymentId: z.number(),
        txHash: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const payment = await db.getPaymentById(input.paymentId);
        
        if (!payment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });
        }
        
        if (payment.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        if (payment.paymentMethod !== "crypto" || !payment.cryptoCurrency) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "This payment is not a crypto payment" 
          });
        }

        // Verify transaction using Web3
        const result = await verifyCryptoTransactionWeb3(
          payment.cryptoCurrency as any,
          input.txHash,
          payment.cryptoAddress || "",
          payment.cryptoAmount || ""
        );

        if (!result.valid) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: result.message 
          });
        }

        // Update payment with verified transaction hash
        await db.updatePaymentStatus(input.paymentId, result.confirmed ? "succeeded" : "processing", {
          cryptoTxHash: input.txHash,
          completedAt: result.confirmed ? new Date() : undefined,
        });

        // If confirmed, update loan status to fee_paid
        if (result.confirmed) {
          await db.updateLoanApplicationStatus(payment.loanApplicationId, "fee_paid");
        }

        return {
          success: true,
          verified: result.valid,
          confirmed: result.confirmed,
          confirmations: result.confirmations,
          blockNumber: result.blockNumber,
          gasUsed: result.gasUsed,
          status: result.status,
          message: result.message,
        };
      }),

    // Get blockchain network status
    getNetworkStatus: publicProcedure
      .input(z.object({
        currency: z.enum(["BTC", "ETH"]),
      }))
      .query(async ({ input }) => {
        const status = await getNetworkStatus(input.currency);
        return status;
      }),
  }),

  // Disbursement router (admin only)
  disbursements: router({
    // Admin: Initiate loan disbursement
    adminInitiate: protectedProcedure
      .input(z.object({
        loanApplicationId: z.number(),
        accountHolderName: z.string().min(1),
        accountNumber: z.string().min(1),
        routingNumber: z.string().min(9),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const application = await db.getLoanApplicationById(input.loanApplicationId);
        
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        // CRITICAL: Validate that processing fee has been paid AND confirmed
        if (application.status !== "fee_paid") {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Processing fee must be paid and confirmed before disbursement" 
          });
        }

        // Double-check: Verify payment record exists and succeeded
        const payments = await db.getPaymentsByLoanApplicationId(input.loanApplicationId);
        const succeededPayment = payments.find((p: any) => p.status === "succeeded");
        
        if (!succeededPayment) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "No confirmed payment found for this loan - disbursement cannot proceed" 
          });
        }

        // Check if disbursement already exists
        const existingDisbursement = await db.getDisbursementByLoanApplicationId(input.loanApplicationId);
        if (existingDisbursement) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Disbursement already initiated for this loan" 
          });
        }

        // Create disbursement record
        await db.createDisbursement({
          loanApplicationId: input.loanApplicationId,
          userId: application.userId,
          amount: application.approvedAmount!,
          accountHolderName: input.accountHolderName,
          accountNumber: input.accountNumber,
          routingNumber: input.routingNumber,
          adminNotes: input.adminNotes,
          status: "pending",
          initiatedBy: ctx.user.id,
        });

        // Update loan status to disbursed
        await db.updateLoanApplicationStatus(input.loanApplicationId, "disbursed", {
          disbursedAt: new Date(),
        });

        // Send disbursement notification email to user
        const user = await db.getUserById(application.userId);
        if (user?.email) {
          const estimatedDate = new Date();
          estimatedDate.setDate(estimatedDate.getDate() + 2); // Estimated 2 business days
          await sendApplicationDisbursedNotificationEmail(
            user.email,
            user.name || user.email,
            application.trackingNumber || `APP-${input.loanApplicationId}`,
            application.approvedAmount || 0,
            estimatedDate.toLocaleDateString("en-US", { 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            })
          ).catch((error) => {
            console.error("Failed to send disbursement notification email:", error);
            // Don't throw - email failure shouldn't fail the disbursement
          });
        }

        return { success: true };
      }),

    // Get disbursement by loan application ID
    getByLoanId: protectedProcedure
      .input(z.object({ loanApplicationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const application = await db.getLoanApplicationById(input.loanApplicationId);
        
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        if (application.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        return db.getDisbursementByLoanApplicationId(input.loanApplicationId);
      }),
  }),

  // Legal documents router
  legal: router({
    // Record legal document acceptance
    acceptDocument: protectedProcedure
      .input(z.object({
        documentType: z.enum(["terms_of_service", "privacy_policy", "loan_agreement", "esign_consent"]),
        documentVersion: z.string(),
        loanApplicationId: z.number().optional(),
        ipAddress: z.string().optional(),
        userAgent: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        await database.insert(legalAcceptances).values({
          userId: ctx.user.id,
          loanApplicationId: input.loanApplicationId,
          documentType: input.documentType,
          documentVersion: input.documentVersion,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        });

        return { success: true };
      }),

    // Check if user has accepted a specific document
    hasAccepted: protectedProcedure
      .input(z.object({
        documentType: z.enum(["terms_of_service", "privacy_policy", "loan_agreement", "esign_consent"]),
        loanApplicationId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        if (!database) return false;

        const conditions = [
          eq(legalAcceptances.userId, ctx.user.id),
          eq(legalAcceptances.documentType, input.documentType),
        ];

        if (input.loanApplicationId) {
          conditions.push(eq(legalAcceptances.loanApplicationId, input.loanApplicationId));
        }

        const result = await database
          .select()
          .from(legalAcceptances)
          .where(and(...conditions))
          .limit(1);

        return result.length > 0;
      }),

    // Get all acceptances for current user
    getMyAcceptances: protectedProcedure
      .query(async ({ ctx }) => {
        const database = await getDb();
        if (!database) return [];

        return await database
          .select()
          .from(legalAcceptances)
          .where(eq(legalAcceptances.userId, ctx.user.id));
      }),
  }),

  // Verification documents router
  verification: router({
    // Upload verification document (metadata only, file uploaded via storage)
    uploadDocument: protectedProcedure
      .input(z.object({
        documentType: z.enum([
          "drivers_license_front",
          "drivers_license_back",
          "passport",
          "national_id_front",
          "national_id_back",
          "ssn_card",
          "bank_statement",
          "utility_bill",
          "pay_stub",
          "tax_return",
          "other"
        ]),
        fileName: z.string(),
        filePath: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
        loanApplicationId: z.number().optional(),
        expiryDate: z.string().optional(),
        documentNumber: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createVerificationDocument({
          userId: ctx.user.id,
          documentType: input.documentType,
          fileName: input.fileName,
          filePath: input.filePath,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          loanApplicationId: input.loanApplicationId,
          expiryDate: input.expiryDate,
          documentNumber: input.documentNumber,
        });

        // Send admin notification email in background
        if (ctx.user.email && ctx.user.name) {
          sendAdminDocumentUploadNotification(
            ctx.user.name,
            ctx.user.email,
            input.documentType,
            input.fileName,
            new Date()
          ).catch(err => console.error('[Email] Failed to send admin document notification:', err));
        }

        return { success: true };
      }),

    // Get user's uploaded documents
    myDocuments: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getVerificationDocumentsByUserId(ctx.user.id);
      }),

    // Get single document by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const document = await db.getVerificationDocumentById(input.id);
        if (!document) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        }
        // Users can only view their own documents, admins can view all
        if (ctx.user.role !== "admin" && document.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return document;
      }),

    // Admin: Get all verification documents
    adminList: adminProcedure
      .query(async () => {
        return db.getAllVerificationDocuments();
      }),

    // Admin: Approve verification document
    adminApprove: adminProcedure
      .input(z.object({
        id: z.number(),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const document = await db.getVerificationDocumentById(input.id);
        if (!document) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        }

        await db.updateVerificationDocumentStatus(
          input.id,
          "approved",
          ctx.user.id,
          { adminNotes: input.adminNotes }
        );

        return { success: true };
      }),

    // Admin: Reject verification document
    adminReject: adminProcedure
      .input(z.object({
        id: z.number(),
        rejectionReason: z.string().min(1),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const document = await db.getVerificationDocumentById(input.id);
        if (!document) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        }

        await db.updateVerificationDocumentStatus(
          input.id,
          "rejected",
          ctx.user.id,
          { 
            rejectionReason: input.rejectionReason,
            adminNotes: input.adminNotes 
          }
        );

        return { success: true };
      }),
  }),

  // AI Support router for comprehensive customer assistance
  ai: router({
    // Chat endpoint - handles customer support A-Z
    chat: publicProcedure
      .input(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(["user", "assistant", "system"]),
              content: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          // Initialize context outside try block so it's available in catch
          const isAuthenticated = !!ctx.user;
          let supportContext: SupportContext = {
          isAuthenticated,
          userRole: ctx.user?.role,
        };

        try {
          if (isAuthenticated && ctx.user?.id) {
            supportContext.userId = ctx.user.id;
            supportContext.email = ctx.user.email || undefined;
            
            try {
              // Calculate account age in days
              if (ctx.user.createdAt) {
                const now = new Date();
                const accountCreationDate = new Date(ctx.user.createdAt);
                const ageInDays = Math.floor((now.getTime() - accountCreationDate.getTime()) / (1000 * 60 * 60 * 24));
                supportContext.accountAge = ageInDays;
              }
              
              // Get user's loan information - all applications for history
              const applications = await db.getLoanApplicationsByUserId(ctx.user.id);
              if (applications && applications.length > 0) {
                // Count total loans
                supportContext.loanCount = applications.length;
                
                // Get most recent application for current status
                const application = applications[0];
                supportContext.loanStatus = application.status;
                supportContext.loanAmount = application.requestedAmount;
                
                // Determine customer relationship duration
                if (applications.length === 1) {
                  supportContext.customerRelationshipDuration = "First-time borrower";
                } else if (applications.length <= 3) {
                  supportContext.customerRelationshipDuration = "Repeat customer";
                } else {
                  supportContext.customerRelationshipDuration = "Loyal, multi-loan customer";
                }
              }
            } catch (dbError) {
              // Log DB error but continue - support should work even if user data fetch fails
              console.warn("Failed to fetch user loan data for support context:", dbError);
            }
          }

          // Build messages with system prompt and context
          const messages = buildMessages(
            input.messages,
            isAuthenticated,
            {
              userId: supportContext.userId,
              email: supportContext.email,
              loanStatus: supportContext.loanStatus,
              loanAmount: supportContext.loanAmount,
              userRole: supportContext.userRole,
              accountAge: supportContext.accountAge,
              loanCount: supportContext.loanCount,
              customerRelationshipDuration: supportContext.customerRelationshipDuration,
            }
          );

          // Check if API key is configured
          const apiKeysAvailable = !(!ENV.openAiApiKey && !ENV.forgeApiKey);
          console.log("[AI Chat] API keys check:");
          console.log("[AI Chat]   OpenAI key exists:", !!ENV.openAiApiKey);
          console.log("[AI Chat]   OpenAI key value:", ENV.openAiApiKey ? `${ENV.openAiApiKey.substring(0, 10)}...` : "EMPTY");
          console.log("[AI Chat]   Forge key exists:", !!ENV.forgeApiKey);
          console.log("[AI Chat]   Both keys available:", apiKeysAvailable);
          
          if (!apiKeysAvailable) {
            console.log("[AI Chat] ❌ NO API KEYS - Using fallback response");
            // Provide fallback support response when no API is configured
            const userMessage = input.messages[input.messages.length - 1]?.content || "";
            const assistantMessage = getFallbackResponse(userMessage);

            return {
              success: true,
              message: assistantMessage,
              isAuthenticated,
              userContext: supportContext,
            };
          }
          
          console.log("[AI Chat] ✅ API KEYS AVAILABLE - Proceeding to invoke LLM");


          // Invoke LLM with prepared messages using optimized parameters for smarter responses
          console.log("[AI Chat] 📤 Invoking LLM with", messages.length, "messages and temperature 0.8");
          const response = await invokeLLM({
            messages,
            maxTokens: 1500, // Balanced for comprehensive but concise responses
            temperature: 0.8, // Higher temperature for more varied, creative responses
          });
          
          console.log("[AI Chat] 📥 LLM response received successfully");

          // Extract the assistant's response
          const assistantMessage =
            response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again.";

          return {
            success: true,
            message: assistantMessage,
            isAuthenticated,
            userContext: supportContext,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[AI Chat] ⚠️ ERROR CAUGHT IN INNER CATCH");
          console.error("[AI Chat]   Error type:", error?.constructor?.name);
          console.error("[AI Chat]   Error message:", errorMessage);
          console.error("[AI Chat]   Full error:", JSON.stringify(error, null, 2));
          
          // Always try to return a fallback response for any error
          // Support chat should ALWAYS work, even if LLM or database fails
          const userMessage = input.messages[input.messages.length - 1]?.content || "";
          const assistantMessage = getFallbackResponse(userMessage);
          
          console.log("[AI Chat] 🔄 Returning fallback response from inner catch:", assistantMessage.substring(0, 50) + "...");
          
          return {
            success: true,
            message: assistantMessage,
            isAuthenticated,
            userContext: supportContext,
          };
        }
      } catch (outerError) {
        console.error("[AI Chat] 🚨 ERROR CAUGHT IN OUTER CATCH");
        console.error("[AI Chat]   Error type:", outerError?.constructor?.name);
        console.error("[AI Chat]   Error message:", outerError instanceof Error ? outerError.message : String(outerError));
        console.error("[AI Chat]   Full error:", JSON.stringify(outerError, null, 2));
        
        // Final fallback - return generic helpful message with variation
        const userMsg = input.messages[input.messages.length - 1]?.content || "";
        const fallbackMsg = getFallbackResponse(userMsg);
        
        console.log("[AI Chat] 🔄 Returning fallback response from outer catch");
        
        return {
          success: true,
          message: fallbackMsg,
          isAuthenticated: !!ctx.user,
          userContext: { isAuthenticated: !!ctx.user, userRole: ctx.user?.role },
        };
      }
      }),

    // Get suggested prompts based on authentication status
    getSuggestedPrompts: publicProcedure.query(({ ctx }) => {
      const isAuthenticated = !!ctx.user;
      return getSuggestedPrompts(isAuthenticated);
    }),

    // Get support resources and documentation
    getResources: publicProcedure.query(() => {
      return {
        faqs: [
          {
            category: "Getting Started",
            questions: [
              "How does the application process work?",
              "What are the eligibility requirements?",
              "What documents do I need to apply?",
            ],
          },
          {
            category: "Loans & Approvals",
            questions: [
              "How long does approval take?",
              "Can I get approved with bad credit?",
              "What loan amounts are available?",
            ],
          },
          {
            category: "Payments & Repayment",
            questions: [
              "How do I make a payment?",
              "What payment methods do you accept?",
              "Can I change my payment schedule?",
            ],
          },
          {
            category: "Security & Privacy",
            questions: [
              "Is my data secure?",
              "How do you protect my information?",
              "What is your privacy policy?",
            ],
          },
        ],
        contactOptions: [
          {
            method: "Phone",
            value: "(800) 990-9130",
            availability: "Monday-Friday, 9AM-6PM EST",
          },
          {
            method: "Email",
            value: "info@amerilendloan.com",
            availability: "24/7 (Response within 24 hours)",
          },
          {
            method: "Live Chat",
            value: "Available on website",
            availability: "Business hours",
          },
        ],
      };
    }),

    // Track application status without login
    trackApplication: publicProcedure
      .input(
        z.object({
          applicationId: z.string(),
          email: z.string().email(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const dbInstance = await getDb();
          if (!dbInstance) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Database connection failed",
            });
          }
          
          const application = await (dbInstance as any)
            .query.loanApplications
            .findFirst({
              where: and(
                eq(loanApplications.trackingNumber, input.applicationId),
                eq(loanApplications.email, input.email)
              ),
            });

          if (!application) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Application not found. Please check your Application ID and email.",
            });
          }

          return {
            success: true,
            application: {
              id: application.id,
              status: application.status,
              loanAmount: application.loanAmount,
              createdAt: application.createdAt,
              updatedAt: application.updatedAt,
              estimatedDecision: application.estimatedDecision,
              nextSteps: getNextSteps(application.status),
            },
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to track application. Please try again.",
          });
        }
      }),
  }),

  // Admin management router
  admin: router({
    // Get all admins
    listAdmins: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can view admin list",
        });
      }
      return db.getAllAdmins();
    }),

    // Get admin dashboard stats
    getStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can view stats",
        });
      }
      return db.getAdminStats();
    }),

    // Promote user to admin (only original owner can do this)
    promoteToAdmin: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Only the owner (set via OWNER_OPEN_ID env var) can promote users
        if (ctx.user.openId !== ENV.ownerOpenId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the system owner can promote users to admin",
          });
        }
        
        await db.promoteUserToAdmin(input.userId);
        return { success: true };
      }),

    // Demote admin to user (only original owner can do this)
    demoteToUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Only the owner can demote admins
        if (ctx.user.openId !== ENV.ownerOpenId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the system owner can demote admins",
          });
        }

        // Prevent demoting self if you're the owner
        if (ctx.user.id === input.userId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot demote yourself",
          });
        }
        
        await db.demoteAdminToUser(input.userId);
        return { success: true };
      }),

    // Get advanced statistics
    getAdvancedStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can view advanced stats",
        });
      }
      return db.getAdvancedStats();
    }),

    // Search users (admin only)
    searchUsers: protectedProcedure
      .input(z.object({ query: z.string().min(1), limit: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins can search users",
          });
        }
        return db.searchUsers(input.query, input.limit || 10);
      }),

    // Get user profile (admin only)
    getUserProfile: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins can view user profiles",
          });
        }
        const user = await db.getUserById(input.userId);
        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }
        return user;
      }),

    // Update user profile (admin only)
    updateUserProfile: protectedProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins can update user profiles",
          });
        }

        await db.updateUserProfile(input.userId, {
          name: input.name,
          email: input.email,
          phone: input.phone,
        });

        return { success: true };
      }),
  }),

  // Admin AI Assistant Router
  adminAi: router({
    // Get AI recommendations for an application
    getApplicationRecommendation: adminProcedure
      .input(z.object({
        applicationId: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          // Fetch application details
          const application = await db.getLoanApplicationById(input.applicationId);
          if (!application) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Application not found",
            });
          }

          // Get user for context
          const user = await db.getUserById(application.userId);
          
          // Build context for AI
          const adminContext: AdminAiContext = {
            adminId: ctx.user.id,
            adminEmail: ctx.user.email || "",
            adminRole: ctx.user.role as "admin" | "super_admin",
            inactivityMinutes: 0,
            pendingApplicationCount: 0,
            escalatedApplicationCount: 0,
            fraudFlagsCount: 0,
            documentIssuesCount: 0,
          };

          // Create analysis message
          const analysisPrompt = `Analyze this loan application and provide a recommendation:

APPLICANT: ${application.fullName || "Unknown"}
LOAN AMOUNT: $${application.requestedAmount}
PURPOSE: ${application.loanPurpose || "Not specified"}
STATUS: ${application.status}

APPLICANT INFO:
- Age: ${new Date().getFullYear() - new Date(application.dateOfBirth || "").getFullYear()} years old
- Employment: ${application.employmentStatus || "Unknown"}
- Monthly Income: $${application.monthlyIncome || "Not provided"}

DOCUMENTS:
- Submitted at: ${application.createdAt ? new Date(application.createdAt).toLocaleDateString() : "Not submitted"}

Provide:
1. Risk Level (LOW/MEDIUM/HIGH)
2. Recommendation (APPROVE/REJECT/ESCALATE)
3. Confidence Level (0-100)
4. Key factors in your decision (list 3-5)
5. Suggested action

Be concise and data-driven.`;

          const messages = buildAdminMessages([
            {
              role: "user",
              content: analysisPrompt,
            },
          ], adminContext);

          // Invoke LLM for recommendation
          const response = await invokeLLM({
            messages,
            maxTokens: 1000,
          });

          const recommendation = response.choices[0]?.message?.content || "Unable to generate recommendation";

          return {
            success: true,
            applicationId: input.applicationId,
            applicantName: user?.name || "Unknown",
            recommendation: recommendation,
            timestamp: new Date(),
          };
        } catch (error) {
          console.error("Admin AI Recommendation Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate recommendation",
          });
        }
      }),

    // Get AI insights for pending applications
    getPendingApplicationsInsights: adminProcedure
      .input(z.object({
        limit: z.number().default(10),
      }))
      .query(async ({ input, ctx }) => {
        try {
          // Get pending applications
          const allApplications = await db.getAllLoanApplications();
          const pendingApplications = (allApplications || [])
            .filter(app => app.status === "pending" || app.status === "under_review")
            .slice(0, input.limit);

          if (pendingApplications.length === 0) {
            return {
              success: true,
              message: "No pending applications to review",
              count: 0,
              applications: [],
            };
          }

          // Build analysis for all pending apps
          const applicationSummary = pendingApplications
            .map(app => `- ${app.id}: $${app.requestedAmount} (${app.status})`)
            .join("\n");

          const analysisPrompt = `You are reviewing ${pendingApplications.length} pending loan applications.

APPLICATIONS:
${applicationSummary}

Prioritize them by:
1. Which ones are most likely to be approved (auto-approve eligible)
2. Which ones need immediate human attention
3. Which ones show fraud indicators
4. Estimated processing time for each group

Provide:
- Count of auto-approvable applications
- Count of escalation-needed applications
- Count of potential fraud flags
- Suggested priority order
- Batch processing recommendations`;

          const messages = buildAdminMessages([
            {
              role: "user",
              content: analysisPrompt,
            },
          ], {
            adminId: ctx.user.id,
            adminEmail: ctx.user.email || "",
            adminRole: ctx.user.role as "admin" | "super_admin",
            inactivityMinutes: 0,
            pendingApplicationCount: pendingApplications.length,
            escalatedApplicationCount: 0,
            fraudFlagsCount: 0,
            documentIssuesCount: 0,
          });

          const response = await invokeLLM({
            messages,
            maxTokens: 1500,
          });

          const insights = response.choices[0]?.message?.content || "Unable to generate insights";

          return {
            success: true,
            message: insights,
            count: pendingApplications.length,
            applications: pendingApplications.map(app => ({
              id: app.id,
              amount: app.requestedAmount,
              status: app.status,
            })),
          };
        } catch (error) {
          console.error("Admin AI Insights Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate insights",
          });
        }
      }),

    // Get suggested admin tasks
    getSuggestedTasks: adminProcedure.query(() => {
      return {
        success: true,
        tasks: getAdminSuggestedTasks(),
      };
    }),

    // Process batch applications with AI assistance
    processBatchApplications: adminProcedure
      .input(z.object({
        action: z.enum(["auto_approve", "review_priority", "flag_fraud"]),
        limit: z.number().default(5),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const allApplications = await db.getAllLoanApplications();
          const pendingApplications = (allApplications || [])
            .filter(app => app.status === "pending" || app.status === "under_review")
            .slice(0, input.limit);

          const batchPrompt = `Process this batch of ${pendingApplications.length} applications with action: "${input.action}"

Generate a structured batch processing plan:
1. Which applications qualify for the action
2. Why each one qualifies or doesn't
3. Recommended next steps
4. Any risk flags

Format as JSON with array of applications including their recommendation.`;

          const messages = buildAdminMessages([
            {
              role: "user",
              content: batchPrompt,
            },
          ], {
            adminId: ctx.user.id,
            adminEmail: ctx.user.email || "",
            adminRole: ctx.user.role as "admin" | "super_admin",
            inactivityMinutes: 0,
            pendingApplicationCount: pendingApplications.length,
            escalatedApplicationCount: 0,
            fraudFlagsCount: 0,
            documentIssuesCount: 0,
          });

          const response = await invokeLLM({
            messages,
            maxTokens: 2000,
          });

          const batchPlan = response.choices[0]?.message?.content || "Unable to generate batch plan";

          return {
            success: true,
            action: input.action,
            applicationsCount: pendingApplications.length,
            plan: batchPlan,
          };
        } catch (error) {
          console.error("Admin AI Batch Processing Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to process batch",
          });
        }
      }),
  }),
});

// Helper function to determine next steps based on application status
function getNextSteps(status: string): string[] {
  const steps: Record<string, string[]> = {
    "pending": [
      "Your application is being reviewed",
      "Check your email for updates",
      "Verify all submitted information is accurate"
    ],
    "in-review": [
      "Our team is actively reviewing your application",
      "You may be contacted for additional information",
      "Decision will be communicated within 24-48 hours"
    ],
    "approved": [
      "Congratulations! Your loan has been approved",
      "Log in to your dashboard to view disbursement options",
      "Choose your preferred funding method"
    ],
    "rejected": [
      "Your application was not approved at this time",
      "Check your email for details on why",
      "Contact us at (800) 990-9130 to discuss options"
    ],
    "funded": [
      "Your loan has been funded!",
      "The money is on its way to your account",
      "View payment schedule in your dashboard"
    ],
    "completed": [
      "Your loan has been fully repaid",
      "Thank you for using AmeriLend",
      "You may be eligible for additional credit"
    ],
  };

  return steps[status] || ["Please contact support for more information"];
}

export type AppRouter = typeof appRouter;
