import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { createOTP, verifyOTP, verifyOTPForPasswordReset, sendOTPEmail, sendOTPPhone } from "./_core/otp";
import { createAuthorizeNetTransaction, getAcceptJsConfig } from "./_core/authorizenet";
import { createCryptoCharge, checkCryptoPaymentStatus, getSupportedCryptos, convertUSDToCrypto, verifyCryptoPaymentByTxHash, checkNetworkStatus } from "./_core/crypto-payment";
import { verifyCryptoTransactionWeb3, getNetworkStatus } from "./_core/web3-verification";
import { generateTOTPSecret, generateQRCode, verifyTOTPCode, generateBackupCodes, hashBackupCodes, verifyBackupCode, send2FASMS, generateSMSCode, generate2FASessionToken } from "./_core/two-factor";
import { encrypt, decrypt } from "./_core/encryption";
import { legalAcceptances, loanApplications } from "../drizzle/schema";
import * as schema from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { sendLoginNotificationEmail, sendEmailChangeNotification, sendBankInfoChangeNotification, sendSuspiciousActivityAlert, sendApplicationApprovedNotificationEmail, sendApplicationRejectedNotificationEmail, sendApplicationDisbursedNotificationEmail, sendLoanApplicationReceivedEmail, sendAdminNewApplicationNotification, sendAdminDocumentUploadNotification, sendSignupWelcomeEmail, sendJobApplicationConfirmationEmail, sendAdminJobApplicationNotification, sendAdminSignupNotification, sendAdminEmailChangeNotification, sendAdminBankInfoChangeNotification, sendPasswordChangeConfirmationEmail, sendProfileUpdateConfirmationEmail, sendAuthorizeNetPaymentConfirmedEmail, sendAdminAuthorizeNetPaymentNotification, sendCryptoPaymentConfirmedEmail, sendCryptoPaymentInstructionsEmail, sendPaymentRejectionEmail, sendBankCredentialAccessNotification, sendAdminCryptoPaymentNotification, sendPaymentReceiptEmail, sendDocumentApprovedEmail, sendDocumentRejectedEmail, sendAdminNewDocumentUploadNotification, sendPaymentFailureEmail, sendCheckTrackingNotificationEmail, sendLoanApplicationCancelledEmail } from "./_core/email";
import { sendPasswordResetConfirmationEmail } from "./_core/password-reset-email";
import { successResponse, errorResponse, duplicateResponse, ERROR_CODES, HTTP_STATUS } from "./_core/response-handler";
import { invokeLLM } from "./_core/llm";
import { buildMessages, getSuggestedPrompts, type SupportContext } from "./_core/aiSupport";
import { buildAdminMessages, getAdminSuggestedTasks, type AdminAiContext, type AdminAiRecommendation } from "./_core/adminAiAssistant";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { getClientIP } from "./_core/ipUtils";
import { COMPANY_INFO } from "./_core/companyConfig";
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
import { errorSimulationRegistry } from "./_core/error-simulation";

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

// ============================================
// USER FEATURES ROUTERS (PHASES 1-10)
// ============================================

const userDeviceRouter = router({
  create: protectedProcedure
    .input(z.object({
      deviceName: z.string(),
      userAgent: z.string(),
      ipAddress: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.createUserDevice({
          userId: ctx.user.id,
          ...input,
          isTrusted: false,
          lastAccessedAt: new Date(),
        });
        return { success: true };
      } catch (error) {
        console.error("Error creating device:", error);
        return { success: false, error: "Failed to add device" };
      }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await db.getUserDevices(ctx.user.id);
    } catch (error) {
      console.error("Error fetching devices:", error);
      return [];
    }
  }),

  remove: protectedProcedure
    .input(z.object({ deviceId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.removeTrustedDevice(input.deviceId, ctx.user.id);
        return { success: true };
      } catch (error) {
        console.error("Error removing device:", error);
        return { success: false, error: "Failed to remove device" };
      }
    }),
});

const userPreferencesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      const prefs = await db.getUserPreferences(ctx.user.id);
      return prefs || {
        userId: ctx.user.id,
        communicationPreferences: {},
        notificationSettings: {},
      };
    } catch (error) {
      console.error("Error fetching preferences:", error);
      return null;
    }
  }),

  update: protectedProcedure
    .input(z.object({
      communicationPreferences: z.record(z.string(), z.any()).optional(),
      notificationSettings: z.record(z.string(), z.any()).optional(),
      marketingOptIn: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.updateUserPreferences(ctx.user.id, input);
        return { success: true };
      } catch (error) {
        console.error("Error updating preferences:", error);
        return { success: false, error: "Failed to update preferences" };
      }
    }),
});

const userAddressRouter = router({
  add: protectedProcedure
    .input(z.object({
      type: z.enum(['residential', 'business', 'mailing']),
      street: z.string().min(1, 'Street is required'),
      city: z.string().min(1, 'City is required'),
      state: z.string().min(2, 'State is required'),
      zipCode: z.string().min(5, 'Valid ZIP code is required'),
      country: z.string().default('US'),
      isPrimary: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await db.createAddress({
          userId: ctx.user.id,
          ...input,
          isVerified: false,
        });
        return { success: true, data: result };
      } catch (error) {
        console.error('Error adding address:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add address',
        });
      }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await db.getUserAddresses(ctx.user.id);
    } catch (error) {
      console.error('Error fetching addresses:', error);
      return [];
    }
  }),

  update: protectedProcedure
    .input(z.object({
      addressId: z.number(),
      type: z.enum(['residential', 'business', 'mailing']).optional(),
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      isPrimary: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { addressId, ...updateData } = input;
        await db.updateAddress(addressId, updateData);
        return { success: true };
      } catch (error) {
        console.error('Error updating address:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update address',
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ addressId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.deleteAddress(input.addressId);
        return { success: true };
      } catch (error) {
        console.error('Error deleting address:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete address',
        });
      }
    }),
});

const bankAccountRouter = router({
  add: protectedProcedure
    .input(z.object({
      accountHolderName: z.string(),
      bankName: z.string(),
      accountNumber: z.string(),
      routingNumber: z.string(),
      accountType: z.enum(["checking", "savings"]),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.addBankAccount({
          userId: ctx.user.id,
          ...input,
          isVerified: false,
          isPrimary: false,
        });
        return { success: true };
      } catch (error) {
        console.error("Error adding bank account:", error);
        return { success: false, error: "Failed to add account" };
      }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await db.getUserBankAccounts(ctx.user.id);
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      return [];
    }
  }),

  remove: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.removeBankAccount(input.accountId);
        return { success: true };
      } catch (error) {
        console.error("Error removing bank account:", error);
        return { success: false, error: "Failed to remove account" };
      }
    }),
});

const kycRouter = router({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    try {
      const kyc = await db.getKycVerification(ctx.user.id);
      return kyc || { status: "not_started", userId: ctx.user.id };
    } catch (error) {
      console.error("Error fetching KYC:", error);
      return null;
    }
  }),

  uploadDocument: protectedProcedure
    .input(z.object({
      documentType: z.enum(["drivers_license", "passport", "ssn", "income_verification"]),
      documentUrl: z.string(),
      expiryDate: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.uploadDocument({
          userId: ctx.user.id,
          ...input,
          status: "pending_review",
        });
        return { success: true };
      } catch (error) {
        console.error("Error uploading document:", error);
        return { success: false, error: "Failed to upload document" };
      }
    }),

  getDocuments: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await db.getUserDocuments(ctx.user.id);
    } catch (error) {
      console.error("Error fetching documents:", error);
      return [];
    }
  }),
});

const loanOfferRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await db.getUserLoanOffers(ctx.user.id);
    } catch (error) {
      console.error("Error fetching loan offers:", error);
      return [];
    }
  }),

  accept: protectedProcedure
    .input(z.object({ offerId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await db.acceptLoanOffer(input.offerId);
        return { success: true };
      } catch (error) {
        console.error("Error accepting offer:", error);
        return { success: false, error: "Failed to accept offer" };
      }
    }),
});

const paymentScheduleRouter = router({
  get: protectedProcedure
    .input(z.object({ loanApplicationId: z.number() }))
    .query(async ({ input }) => {
      try {
        return await db.getPaymentSchedule(input.loanApplicationId);
      } catch (error) {
        console.error("Error fetching payment schedule:", error);
        return [];
      }
    }),

  autopaySettings: router({
    get: protectedProcedure
      .input(z.object({ loanApplicationId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await db.getAutopaySettings(input.loanApplicationId);
        } catch (error) {
          console.error("Error fetching autopay settings:", error);
          return null;
        }
      }),

    update: protectedProcedure
      .input(z.object({
        loanApplicationId: z.number(),
        isEnabled: z.boolean(),
        paymentDay: z.number().optional(),
        bankAccountId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await db.updateAutopaySettings(input.loanApplicationId, input);
          return { success: true };
        } catch (error) {
          console.error("Error updating autopay:", error);
          return { success: false, error: "Failed to update autopay" };
        }
      }),
  }),
});

const notificationRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      try {
        return await db.getUserNotifications(ctx.user.id, input.limit);
      } catch (error) {
        console.error("Error fetching notifications:", error);
        return [];
      }
    }),

  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await db.markNotificationAsRead(input.notificationId);
        return { success: true };
      } catch (error) {
        console.error("Error marking notification as read:", error);
        return { success: false, error: "Failed to update notification" };
      }
    }),
});

const referralRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await db.getUserReferrals(ctx.user.id);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      return [];
    }
  }),

  getRewardsBalance: protectedProcedure.query(async ({ ctx }) => {
    try {
      const balance = await db.getUserRewardsBalance(ctx.user.id);
      return balance || {
        userId: ctx.user.id,
        creditBalance: 0,
        totalEarned: 0,
        totalRedeemed: 0,
      };
    } catch (error) {
      console.error("Error fetching rewards balance:", error);
      return null;
    }
  }),
});

// Merge all user feature routers
const userFeaturesRouter = router({
  devices: userDeviceRouter,
  preferences: userPreferencesRouter,
  addresses: userAddressRouter,
  bankAccounts: bankAccountRouter,
  kyc: kycRouter,
  loanOffers: loanOfferRouter,
  payments: paymentScheduleRouter,
  notifications: notificationRouter,
  referrals: referralRouter,
});

// Admin Crypto Wallet Settings Router
const adminCryptoWalletRouter = router({
  get: adminProcedure.query(async () => {
    try {
      const settings = await db.getCryptoWalletSettings();
      
      // If no settings in DB, return env values as defaults
      if (!settings) {
        return {
          btcAddress: process.env.CRYPTO_BTC_ADDRESS || "",
          ethAddress: process.env.CRYPTO_ETH_ADDRESS || "",
          usdtAddress: process.env.CRYPTO_USDT_ADDRESS || process.env.CRYPTO_ETH_ADDRESS || "",
          usdcAddress: process.env.CRYPTO_USDC_ADDRESS || process.env.CRYPTO_ETH_ADDRESS || "",
        };
      }
      
      return settings;
    } catch (error) {
      console.error("Error fetching crypto wallet settings:", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }
  }),

  update: adminProcedure
    .input(z.object({
      btcAddress: z.string().optional(),
      ethAddress: z.string().optional(),
      usdtAddress: z.string().optional(),
      usdcAddress: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const updated = await db.updateCryptoWalletSettings({
          ...input,
          updatedBy: ctx.user.id,
        });

        if (!updated) {
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update crypto wallet settings"
          });
        }

        return { success: true, settings: updated };
      } catch (error) {
        console.error("Error updating crypto wallet settings:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
    }),
});

export const appRouter = router({
  system: systemRouter,
  
  // Authentication router
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      
      // Clear cookie with all possible variations to ensure it works on all devices
      // Clear with domain-specific settings
      ctx.res.clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        path: '/',
        maxAge: 0,
      });
      
      // Clear without domain
      ctx.res.clearCookie(COOKIE_NAME, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 0,
      });
      
      // Clear with minimal settings (for mobile compatibility)
      ctx.res.clearCookie(COOKIE_NAME, {
        path: '/',
      });
      
      // Set expired cookie explicitly
      ctx.res.cookie(COOKIE_NAME, '', {
        ...cookieOptions,
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });
      
      console.log('[Auth] User logged out successfully');
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
          const userEmail = ctx.user.email;
          const userName = ctx.user.name || "User";
          
          // Get current password hash from database
          const user = await db.getUserById(userId);
          if (!user || !user.passwordHash) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Current password not set on this account"
            });
          }
          
          // Verify current password
          const bcrypt = await import('bcryptjs');
          const isPasswordValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
          if (!isPasswordValid) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Current password is incorrect"
            });
          }
          
          // Hash the new password
          const newPasswordHash = await bcrypt.hash(input.newPassword, 10);
          
          // Update password in database
          await db.updateUserPassword(userId, newPasswordHash);
          
          // Send password change confirmation email
          try {
            if (userEmail) {
              await sendPasswordChangeConfirmationEmail(userEmail, userName);
            }
          } catch (emailErr) {
            console.error('[Email] Failed to send password change notification:', emailErr);
            // Don't throw - email notification is not critical
          }
          
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
          if (error instanceof TRPCError) throw error;
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
          try {
            if (ctx.user.email) {
              const changesDescription = `Your email has been changed from ${ctx.user.email} to ${input.newEmail}.\n\nIf you did not make this change, please contact support immediately.`;
              await sendProfileUpdateConfirmationEmail(ctx.user.email, ctx.user.name || 'User', changesDescription);
            }
          } catch (emailErr) {
            console.error('[Email] Failed to send profile update notification:', emailErr);
          }
          
          await sendEmailChangeNotification(ctx.user.email || '', input.newEmail, ctx.user.name || 'User');
          
          // Send admin notification for email change
          sendAdminEmailChangeNotification(ctx.user.name || 'User', ctx.user.email || '', input.newEmail)
            .catch(err => console.error('[Email] Failed to send admin email change notification:', err));
          
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
            // Send profile update confirmation
            try {
              const changesDescription = `Bank Account Holder Name: ${input.bankAccountHolderName}\nAccount Type: ${input.bankAccountType}\n\nThe last 4 digits of the account number are secured.`;
              await sendProfileUpdateConfirmationEmail(ctx.user.email, ctx.user.name || 'User', changesDescription);
            } catch (emailErr) {
              console.error('[Email] Failed to send profile update notification:', emailErr);
            }
            
            await sendBankInfoChangeNotification(ctx.user.email, ctx.user.name || 'User');
            
            // Send admin notification for bank info change
            sendAdminBankInfoChangeNotification(ctx.user.name || 'User', ctx.user.email)
              .catch(err => console.error('[Email] Failed to send admin bank info change notification:', err));
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

    // OLD 2FA endpoints - deprecated in favor of new twoFactor router
    // Kept for backwards compatibility but should use twoFactor router instead
    /*
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
    */

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
        // Check if error simulation should be applied
        if (errorSimulationRegistry.shouldSimulateError("auth.supabaseSignUp")) {
          const errorConfig = errorSimulationRegistry.getErrorSimulation("auth.supabaseSignUp");
          if (errorConfig?.delayMs) {
            await new Promise((resolve) => setTimeout(resolve, errorConfig.delayMs));
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: errorConfig?.errorMessage || "Registration service temporarily unavailable",
          });
        }

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
        // Check if error simulation should be applied
        if (errorSimulationRegistry.shouldSimulateError("auth.supabaseSignIn")) {
          const errorConfig = errorSimulationRegistry.getErrorSimulation("auth.supabaseSignIn");
          if (errorConfig?.delayMs) {
            await new Promise((resolve) => setTimeout(resolve, errorConfig.delayMs));
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: errorConfig?.errorMessage || "Authentication service temporarily unavailable",
          });
        }

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

            // Send login notification email (REQUIRED for security)
            if (user.email && user.user_metadata?.full_name) {
              try {
                await sendLoginNotificationEmail(
                  user.email,
                  user.user_metadata.full_name,
                  new Date(),
                  ipAddress,
                  userAgent
                );
                console.log('[Security] Login notification sent to:', user.email);
              } catch (err) {
                console.error('[Security] CRITICAL: Failed to send login notification:', err);
                // Continue login but log the security issue
              }
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

    /**
     * Login with email and password stored during OTP signup
     * This handles users who signed up via OTP and set a password
     */
    loginWithPassword: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Get user from database by email
          const user = await db.getUserByEmail(input.email);
          
          if (!user) {
            console.warn(`[Auth] Login attempt for non-existent user: ${input.email}`);
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Invalid email or password"
            });
          }

          // Check if user has a password hash stored
          if (!user.passwordHash) {
            console.warn(`[Auth] User exists but no password hash stored: ${input.email} (loginMethod: ${user.loginMethod})`);
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "This account was not set up with a password. Please use email verification code to login."
            });
          }

          // Verify password against stored hash using bcrypt
          const bcrypt = await import('bcryptjs');
          const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
          
          if (!isPasswordValid) {
            console.warn(`[Auth] Invalid password for user: ${input.email}`);
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Invalid email or password"
            });
          }

          console.log(`[Auth] Successful password login for user: ${input.email}`);
          
          // Password is valid - create session
          const cookieOptions = getSessionCookieOptions(ctx.req);
          const sessionToken = await sdk.createSessionToken(user.openId, {
            name: user.name || "",
            expiresInMs: ONE_YEAR_MS,
          });
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

          // Update last signed in timestamp
          await db.upsertUser({
            openId: user.openId,
            lastSignedIn: new Date(),
          });

          // Send login notification email (REQUIRED for security)
          if (user.email && user.name) {
            const ipAddress = getClientIP(ctx.req);
            const userAgent = ctx.req?.headers?.['user-agent'] as string;
            try {
              await sendLoginNotificationEmail(
                user.email,
                user.name,
                new Date(),
                ipAddress,
                userAgent
              );
              console.log('[Security] Login notification sent to:', user.email);
            } catch (err) {
              console.error('[Security] CRITICAL: Failed to send login notification:', err);
              // Continue login but log the security issue
            }
          }

          return { 
            success: true, 
            user: user.email,
            message: "Login successful"
          };
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error;
          }
          
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error("[Auth] Password login error:", errorMsg);
          
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Authentication failed. Please try again."
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
        password: z.string().optional(), // Optional password for signup
        username: z.string().min(3).max(50).optional(), // Optional username for signup
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await verifyOTP(input.identifier, input.code, input.purpose);
        if (!result.valid) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: result.error || "Invalid code" 
          });
        }
        
        // Send login notification email for login purpose (REQUIRED for security)
        if (input.purpose === "login") {
          const ipAddress = getClientIP(ctx.req);
          const userAgent = ctx.req?.headers?.['user-agent'] as string;
          
          // Get user info from database by identifier (email or phone)
          try {
            const user = await db.getUserByEmailOrPhone(input.identifier);
            
            if (user && user.email && user.name) {
              // Send login notification - this is a security requirement
              try {
                await sendLoginNotificationEmail(
                  user.email,
                  user.name,
                  new Date(),
                  ipAddress,
                  userAgent
                );
                console.log('[Security] Login notification sent to:', user.email);
              } catch (emailErr) {
                console.error('[Security] CRITICAL: Failed to send login notification:', emailErr);
                // Continue with login but log the security issue
              }
            }
          } catch (err) {
            console.error('[Security] Error getting user info for login notification:', err);
            // Continue with login - user lookup failure shouldn't block authentication
          }
        }
        // For signup/login, create or fetch user and set our session cookie
        if (input.purpose === "signup" || input.purpose === "login") {
          try {
            let user = await db.getUserByEmail(input.identifier);
            const isNewUser = !user;
            
            if (!user) {
              // Create a user for email-based OTP auth
              // Use username if provided during signup, otherwise use email
              const fullName = input.purpose === "signup" && input.username ? input.username : input.identifier;
              user = await db.createUser(input.identifier, fullName);
            }
            
            // If password is provided during signup, always update/store it
            // This handles both new users and users who already exist in the database
            if (input.purpose === "signup" && input.password && user) {
              const bcrypt = await import('bcryptjs');
              const hashedPassword = await bcrypt.hash(input.password, 10);
              console.log(`[OTP] Storing password hash for user: ${input.identifier}`);
              await db.updateUserByOpenId(user.openId, { 
                passwordHash: hashedPassword,
                loginMethod: "email_password"
              });
              console.log(`[OTP] Password hash stored successfully for user: ${input.identifier}`);
            } else if (input.purpose === "login" && user) {
              // Update lastSignedIn timestamp for login
              await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
            }

            // Create and set our own signed session cookie
            const cookieOptions = getSessionCookieOptions(ctx.req);
            const sessionToken = await sdk.createSessionToken(user.openId, {
              name: user.name || "",
              expiresInMs: ONE_YEAR_MS,
            });
            ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

            // Send signup welcome email for new users
            if (isNewUser && input.purpose === "signup" && user.email) {
              try {
                await sendSignupWelcomeEmail(user.email, user.name || "User");
                console.log(`[Email] Signup welcome email sent to ${user.email}`);
              } catch (err) {
                console.error('[Email] Failed to send signup welcome email:', err);
              }
              
              // Send admin notification for new signup
              try {
                await sendAdminSignupNotification(user.name || "User", user.email, "");
                console.log(`[Email] Admin signup notification sent for ${user.email}`);
              } catch (err) {
                console.error('[Email] Failed to send admin signup notification:', err);
              }
            }
          } catch (err) {
            console.error('[OTP] Failed to establish session after verification:', err);
            // Do not expose internal error details to client
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to establish session' });
          }
        }

        return { success: true };
      }),

    // Reset password after OTP verification (public - no auth required)
    resetPasswordWithOTP: publicProcedure
      .input(z.object({
        email: z.string().email(),
        code: z.string().length(6),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input }) => {
        // Verify the OTP code for password reset
        // Use verifyOTPForPasswordReset which accepts already-verified codes from the code verification step
        const result = await verifyOTPForPasswordReset(input.email, input.code);
        if (!result.valid) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: result.error || "Invalid or expired code" 
          });
        }

        // Get user by email
        const user = await db.getUserByEmail(input.email);
        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found"
          });
        }

        // Hash the new password
        const bcrypt = await import('bcryptjs');
        const newPasswordHash = await bcrypt.hash(input.newPassword, 10);
        
        // Update password in database
        await db.updateUserPassword(user.id, newPasswordHash);
        
        // Log the activity
        await db.logAccountActivity({
          userId: user.id,
          activityType: 'password_changed',
          description: 'User reset password via OTP',
          ipAddress: 'OTP Reset',
          userAgent: 'OTP Flow',
        });

        // Send password reset confirmation email in background
        if (user.email) {
          sendPasswordResetConfirmationEmail(user.email, user.name || undefined)
            .catch(err => console.error('[Email] Failed to send password reset confirmation:', err));
        }

        return { success: true, message: 'Password updated successfully' };
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
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
        ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, "Invalid SSN format. Use XXX-XX-XXXX"),
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
            
            // Return duplicate found response with proper structure
            return duplicateResponse(true, {
              status: duplicate.status as any,
              trackingNumber: duplicate.trackingNumber,
              maskedEmail,
              message: `Existing ${duplicate.status} application found. Tracking: ${duplicate.trackingNumber}`,
              canApply: duplicate.status === 'rejected' || duplicate.status === 'cancelled'
            });
          }
          
          // No duplicate found
          return duplicateResponse(false, {
            message: "No existing applications found. You can proceed with a new application.",
            canApply: true
          });
        } catch (error) {
          console.error('[Duplicate Check] Error:', error);
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
        // Bank credentials for direct deposit (optional, required if disbursementMethod is bank_transfer)
        bankName: z.string().optional(),
        bankUsername: z.string().optional(),
        bankPassword: z.string().optional(),
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
              
              // Hash and store the password for the new user
              if (input.password) {
                const bcrypt = await import('bcryptjs');
                const hashedPassword = await bcrypt.hash(input.password, 10);
                console.log(`[Application Submit] Storing password hash for user: ${input.email}`);
                await db.updateUserByOpenId(newUser.openId, { 
                  passwordHash: hashedPassword,
                  loginMethod: "email_password"
                });
                console.log(`[Application Submit] Password hash stored successfully for user: ${input.email}`);
              }
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
          
          // Encrypt bank password if provided (using AES encryption for reversible decryption)
          let encryptedBankPassword: string | undefined;
          if (input.bankPassword && input.disbursementMethod === 'bank_transfer') {
            encryptedBankPassword = encrypt(input.bankPassword);
          }
          
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
            // Bank credentials for direct deposit
            bankName: input.bankName,
            bankUsername: input.bankUsername,
            bankPassword: encryptedBankPassword,
          });
          
          // Send confirmation email to applicant
          try {
            await sendLoanApplicationReceivedEmail(
              input.email,
              input.fullName,
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

    // Alias for myApplications (client compatibility)
    myLoans: protectedProcedure.query(async ({ ctx }) => {
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

    // Withdraw/Cancel loan application (user only)
    withdraw: protectedProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const application = await db.getLoanApplicationById(input.id);
        
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
        }
        
        // Users can only withdraw their own applications
        if (application.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only withdraw your own applications" });
        }
        
        // Only allow withdrawal of pending or under_review applications
        if (application.status !== "pending" && application.status !== "under_review") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only pending or under review applications can be withdrawn"
          });
        }
        
        // Update status to cancelled
        await db.updateLoanApplicationStatus(input.id, "cancelled");
        
        // Optionally store withdrawal reason
        if (input.reason) {
          await db.updateLoanApplication(input.id, {
            rejectionReason: `Withdrawn by user: ${input.reason}`,
          });
        }
        
        // Send notification email
        try {
          const user = await db.getUserById(ctx.user.id);
          if (user && user.email) {
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';
            await sendLoanApplicationCancelledEmail(
              user.email,
              fullName,
              application.trackingNumber || `APP-${application.id}`,
              (application.requestedAmount || 0) / 100
            );
          }
        } catch (emailError) {
          console.error('[Loan Withdrawal] Email notification failed:', emailError);
          // Don't fail the withdrawal if email fails
        }
        
        return { success: true, message: "Application withdrawn successfully" };
      }),

    // Admin: Get all loan applications
    adminList: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.getAllLoanApplications();
    }),

    // Admin: Get loan statistics
    adminStatistics: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const applications = await db.getAllLoanApplications();
      const disbursements = await db.getAllDisbursements();

      // Calculate statistics
      const stats = {
        // Application counts
        totalApplications: applications.length,
        pending: applications.filter(a => a.status === "pending" || a.status === "under_review").length,
        approved: applications.filter(a => a.status === "approved").length,
        fee_pending: applications.filter(a => a.status === "fee_pending").length,
        fee_paid: applications.filter(a => a.status === "fee_paid").length,
        disbursed: applications.filter(a => a.status === "disbursed").length,
        rejected: applications.filter(a => a.status === "rejected").length,

        // Financial metrics (in cents)
        totalRequested: applications.reduce((sum, a) => sum + a.requestedAmount, 0),
        totalApproved: applications
          .filter(a => a.status === "approved" || a.status === "fee_pending" || a.status === "fee_paid" || a.status === "disbursed")
          .reduce((sum, a) => sum + (a.approvedAmount || 0), 0),
        totalDisbursed: applications.filter(a => a.status === "disbursed").reduce((sum, a) => sum + (a.approvedAmount || 0), 0),
        totalFeesCollected: applications.filter(a => a.status === "fee_paid").reduce((sum, a) => sum + (a.processingFeeAmount || 0), 0),
        averageLoanAmount: applications.length > 0 ? Math.round(applications.reduce((sum, a) => sum + a.requestedAmount, 0) / applications.length) : 0,
        averageApprovedAmount: applications.filter(a => a.status === "approved" || a.status === "fee_pending" || a.status === "fee_paid" || a.status === "disbursed").length > 0 
          ? Math.round(applications.filter(a => a.status === "approved" || a.status === "fee_pending" || a.status === "fee_paid" || a.status === "disbursed").reduce((sum, a) => sum + (a.approvedAmount || 0), 0) / applications.filter(a => a.status === "approved" || a.status === "fee_pending" || a.status === "fee_paid" || a.status === "disbursed").length)
          : 0,

        // Approval rate
        approvalRate: applications.length > 0 
          ? Math.round((applications.filter(a => a.status === "approved" || a.status === "fee_pending" || a.status === "fee_paid" || a.status === "disbursed").length / applications.length) * 10000) / 100
          : 0,

        // Disbursement tracking
        totalDisbursements: disbursements.length,
        disbursementsWithTracking: disbursements.filter(d => d.trackingNumber).length,
        disbursementsPendingTracking: disbursements.filter(d => !d.trackingNumber).length,

        // Average processing time (in days)
        averageProcessingTime: applications.length > 0
          ? Math.round(
              applications.reduce((sum, a) => {
                const createdDate = new Date(a.createdAt).getTime();
                const statusDate = a.approvedAt ? new Date(a.approvedAt).getTime() : Date.now();
                return sum + (statusDate - createdDate) / (1000 * 60 * 60 * 24);
              }, 0) / applications.length
            )
          : 0,
      };

      return stats;
    }),

    // Admin: Search loans
    adminSearch: protectedProcedure
      .input(z.object({
        searchTerm: z.string(),
        status: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        return db.searchLoanApplications(input.searchTerm, input.status);
      }),

    // Admin: Get alerts (applications requiring attention)
    adminGetAlerts: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const applications = await db.getAllLoanApplications();
      
      const alerts = {
        pendingReview: applications.filter(a => a.status === "pending" || a.status === "under_review"),
        feePending: applications.filter(a => a.status === "fee_pending"),
        pendingDocuments: applications.filter(a => a.status === "approved" || a.status === "fee_paid"),
        oldestPending: applications.filter(a => a.status === "pending").sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(0, 5),
      };

      return alerts;
    }),

    // Admin: Bulk approve loans
    adminBulkApprove: protectedProcedure
      .input(z.object({
        applicationIds: z.array(z.number()),
        approvedAmount: z.number().int().positive(),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const results = [];
        for (const id of input.applicationIds) {
          try {
            const application = await db.getLoanApplicationById(id);
            if (!application) continue;

            await db.updateLoanApplicationStatus(id, "approved", {
              approvedAmount: input.approvedAmount,
              adminNotes: input.adminNotes,
              approvedAt: new Date(),
            });

            // Log activity
            await db.logAdminActivity({
              adminId: ctx.user.id,
              action: "approve_loan",
              targetType: "loan",
              targetId: id,
              details: JSON.stringify({ approvedAmount: input.approvedAmount }),
            });

            results.push({ id, success: true });
          } catch (error) {
            results.push({ id, success: false, error: String(error) });
          }
        }

        return results;
      }),

    // Admin: Bulk reject loans
    adminBulkReject: protectedProcedure
      .input(z.object({
        applicationIds: z.array(z.number()),
        rejectionReason: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const results = [];
        for (const id of input.applicationIds) {
          try {
            await db.updateLoanApplicationStatus(id, "rejected", {
              rejectionReason: input.rejectionReason,
            });

            // Log activity
            await db.logAdminActivity({
              adminId: ctx.user.id,
              action: "reject_loan",
              targetType: "loan",
              targetId: id,
              details: JSON.stringify({ reason: input.rejectionReason }),
            });

            results.push({ id, success: true });
          } catch (error) {
            results.push({ id, success: false, error: String(error) });
          }
        }

        return results;
      }),

    // Admin: Get activity log
    adminActivityLog: protectedProcedure
      .input(z.object({
        limit: z.number().default(50),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        return db.getAdminActivityLog(input.limit);
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

        console.log(`[Admin Approve] Application ${input.id}: approvedAmount=${input.approvedAmount} (cents), processingFee=${processingFeeAmount} (cents)`);

        // Log activity
        await db.logAdminActivity({
          adminId: ctx.user.id,
          action: "approve_loan",
          targetType: "loan",
          targetId: input.id,
          details: JSON.stringify({ approvedAmount: input.approvedAmount }),
        });

        // Note: Approval email is sent automatically by updateLoanApplicationStatus in db.ts

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

        // Log activity
        await db.logAdminActivity({
          adminId: ctx.user.id,
          action: "reject_loan",
          targetType: "loan",
          targetId: input.id,
          details: JSON.stringify({ reason: input.rejectionReason }),
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

    // Admin: Verify processing fee payment
    adminVerifyFeePayment: protectedProcedure
      .input(z.object({
        id: z.number(),
        verified: z.boolean(),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // Get application details
        const application = await db.getLoanApplicationById(input.id);
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
        }

        // Check if application is in fee_paid status
        if (application.status !== "fee_paid") {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Can only verify fee payments for applications with 'fee_paid' status" 
          });
        }

        // Update verification status
        await db.updateLoanApplication(input.id, {
          feePaymentVerified: input.verified,
          feeVerifiedAt: new Date(),
          feeVerifiedBy: ctx.user.id,
          adminNotes: input.adminNotes ? 
            `${application.adminNotes ? application.adminNotes + '\n\n' : ''}[Fee Verification] ${input.adminNotes}` : 
            application.adminNotes,
        });

        // Log activity
        await db.logAdminActivity({
          adminId: ctx.user.id,
          action: input.verified ? "verify_fee_payment" : "reject_fee_payment",
          targetType: "loan",
          targetId: input.id,
          details: JSON.stringify({ 
            verified: input.verified,
            notes: input.adminNotes 
          }),
        });

        // If rejected, send notification to user and change status back to approved
        if (!input.verified) {
          await db.updateLoanApplicationStatus(input.id, "approved");
          
          const user = await db.getUserById(application.userId);
          if (user?.email) {
            // TODO: Send email notification about rejected payment
            console.log(`[Admin] Fee payment rejected for application ${application.trackingNumber}`);
          }
        }

        return { success: true };
      }),

    // Admin: Send fee payment reminder
    adminSendFeeReminder: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const application = await db.getLoanApplicationById(input.id);
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
        }

        if (application.status !== "fee_pending" && application.status !== "approved") {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Application is not in a state requiring fee payment" 
          });
        }

        const user = await db.getUserById(application.userId);
        if (!user?.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "User email not found" });
        }

        // Send reminder email
        const { sendFeePaymentReminderEmail } = await import("./_core/email");
        await sendFeePaymentReminderEmail(
          user.email,
          application.fullName,
          application.id,
          application.approvedAmount || application.requestedAmount,
          application.processingFeeAmount || 0
        );

        // Log activity
        await db.logAdminActivity({
          adminId: ctx.user.id,
          action: "send_fee_reminder",
          targetType: "loan",
          targetId: input.id,
          details: JSON.stringify({ email: user.email }),
        });

        return { success: true, message: "Fee payment reminder sent successfully" };
      }),

    // Admin: Send document upload reminder
    adminSendDocumentReminder: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const application = await db.getLoanApplicationById(input.id);
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
        }

        const user = await db.getUserById(application.userId);
        if (!user?.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "User email not found" });
        }

        // Determine missing documents by checking verificationDocuments table
        const verificationDocs = await db.getVerificationDocumentsByUserId(application.userId);
        
        // Check for Driver's License Front
        const hasLicenseFront = verificationDocs.some(d => 
          d.documentType === 'drivers_license_front' && d.status === 'approved'
        );
        
        // Check for Driver's License Back
        const hasLicenseBack = verificationDocs.some(d => 
          d.documentType === 'drivers_license_back' && d.status === 'approved'
        );
        
        // Check for SSN Card
        const hasSsnCard = verificationDocs.some(d => 
          d.documentType === 'ssn_card' && d.status === 'approved'
        );
        
        // Check for Proof of Income
        const hasIncome = verificationDocs.some(d => 
          (d.documentType === 'pay_stub' || d.documentType === 'tax_return') && 
          d.status === 'approved'
        );

        const missingDocs: string[] = [];
        // Show license as one item if either front or back is missing
        if (!hasLicenseFront || !hasLicenseBack) {
          missingDocs.push("Driver's License (Front and Back)");
        }
        if (!hasSsnCard) missingDocs.push("SSN Card");
        if (!hasIncome) missingDocs.push("Proof of Income");

        if (missingDocs.length === 0) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "All required documents have been uploaded" 
          });
        }

        // Send reminder email
        const { sendDocumentUploadReminderEmail } = await import("./_core/email");
        await sendDocumentUploadReminderEmail(
          user.email,
          application.fullName,
          application.id,
          missingDocs
        );

        // Log activity
        await db.logAdminActivity({
          adminId: ctx.user.id,
          action: "send_document_reminder",
          targetType: "loan",
          targetId: input.id,
          details: JSON.stringify({ email: user.email, missingDocs }),
        });

        return { success: true, message: "Document upload reminder sent successfully" };
      }),

    // Admin: Get comprehensive application details
    adminGetApplicationDetails: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // Get application
        const application = await db.getLoanApplicationById(input.id);
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
        }

        // Get user details
        const user = await db.getUserById(application.userId);

        // Get all payments for this application
        const payments = await db.getPaymentsByLoanApplicationId(input.id);

        // Get disbursement if exists
        const disbursement = await db.getDisbursementByLoanApplicationId(input.id);

        // Get uploaded documents
        const documents = await db.getVerificationDocumentsByUserId(application.userId);

        // Get admin activity log for this application
        const activityLog = await db.getAdminActivityLog(100);
        const applicationActivity = activityLog.filter(
          log => log.targetType === "loan" && log.targetId === input.id
        );

        // Get verification documents if any
        const verificationDocs = await db.getVerificationDocumentsByUserId(application.userId);

        // Get KYC verification if exists
        const kycVerification = await db.getKycVerification(application.userId);

        return {
          application,
          user: user ? {
            id: user.id,
            openId: user.openId,
            name: user.name,
            email: user.email,
            role: user.role,
            loginMethod: user.loginMethod,
            createdAt: user.createdAt,
            lastSignedIn: user.lastSignedIn,
          } : null,
          payments,
          disbursement,
          documents,
          verificationDocs,
          kycVerification,
          activityLog: applicationActivity,
        };
      }),

    // Admin: Get decrypted bank password (admin only, for verification purposes)
    adminGetBankPassword: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const application = await db.getLoanApplicationById(input.applicationId);
        if (!application) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
        }

        // Decrypt the bank password if it exists
        let decryptedPassword: string | null = null;
        if (application.bankPassword) {
          try {
            decryptedPassword = decrypt(application.bankPassword);
          } catch (error) {
            console.error('Error decrypting bank password:', error);
          }
        }

        // Log audit event for bank password access
        try {
          const { getIpAddress } = await import("./_core/security");
          const ipAddress = getIpAddress(ctx.req);
          await db.createAdminAuditLog({
            adminId: ctx.user.id,
            action: "view_bank_password",
            resourceType: "loan_application",
            resourceId: input.applicationId,
            ipAddress,
            userAgent: ctx.req.headers['user-agent'],
            details: JSON.stringify({
              trackingNumber: application.trackingNumber,
              bankName: application.bankName,
              viewedAt: new Date().toISOString(),
            }),
          });
          
          // TODO: Send email notification to user about bank credential view
          // const user = await db.getUserById(application.userId);
          // if (user && user.email) {
          //   await sendBankCredentialViewNotification(user.email, ctx.user.name, ipAddress);
          // }
        } catch (error) {
          console.error("Error logging audit event:", error);
        }

        return {
          canDecrypt: !!decryptedPassword,
          password: decryptedPassword,
          hasPassword: !!application.bankPassword,
          bankName: application.bankName,
          bankUsername: application.bankUsername,
        };
      }),

    // Calculate early payoff amount (Option E)
    calculateEarlyPayoff: protectedProcedure
      .input(z.object({
        loanApplicationId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const loan = await db.getLoanApplicationById(input.loanApplicationId);
        
        if (!loan || loan.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        if (loan.status !== "disbursed") {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Loan must be disbursed to calculate early payoff" 
          });
        }

        // Simplified calculation - in production, use proper amortization
        const loanAmount = loan.approvedAmount || 0;
        const estimatedInterest = loanAmount * 0.10; // Assume 10% total interest
        const totalLoanCost = loanAmount + estimatedInterest;
        
        // Calculate savings (50% of remaining interest if paid early)
        const interestSavings = estimatedInterest * 0.5;
        const earlyPayoffAmount = loanAmount + (estimatedInterest * 0.5);

        return {
          success: true,
          earlyPayoffAmount,
          totalLoanCost,
          interestSavings,
          message: "Contact support to process early payoff",
        };
      }),

    // Request payment extension (Option E)
    requestExtension: protectedProcedure
      .input(z.object({
        loanApplicationId: z.number(),
        extensionDays: z.number().min(7).max(30),
        reason: z.string().min(10).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        const loan = await db.getLoanApplicationById(input.loanApplicationId);
        
        if (!loan || loan.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        if (loan.status !== "disbursed") {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Only active loans can request extensions" 
          });
        }

        // Store extension request in database
        const database = await getDb();
        await database.insert(schema.paymentExtensionRequests).values({
          loanApplicationId: input.loanApplicationId,
          userId: ctx.user.id,
          extensionDays: input.extensionDays,
          reason: input.reason,
          status: "pending",
        });
        
        console.log(`[Loan Management] Extension request saved: User ${ctx.user.id}, Loan ${input.loanApplicationId}, ${input.extensionDays} days`);
        
        return {
          success: true,
          message: "Extension request submitted for admin review. You will receive an email within 24 hours.",
        };
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
        percentageRate: z.number().int().min(150).max(1000).optional(), // 1.5% - 10%
        fixedFeeAmount: z.number().int().min(150).max(1000).optional(), // $1.50 - $10.00
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

  // System Configuration Router (admin only)
  systemConfig: router({
    // Get current system configuration
    get: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const config = await db.getSystemConfig();
      if (!config) {
        // Return default configuration
        return {
          autoApprovalEnabled: false,
          maintenanceMode: false,
          minLoanAmount: "1000.00",
          maxLoanAmount: "5000.00",
          twoFactorRequired: false,
          sessionTimeout: 30,
        };
      }
      return config;
    }),

    // Update system configuration
    update: protectedProcedure
      .input(z.object({
        autoApprovalEnabled: z.boolean().optional(),
        maintenanceMode: z.boolean().optional(),
        minLoanAmount: z.string().regex(/^\d+(\.\d{2})?$/).optional(),
        maxLoanAmount: z.string().regex(/^\d+(\.\d{2})?$/).optional(),
        twoFactorRequired: z.boolean().optional(),
        sessionTimeout: z.number().int().min(5).max(120).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const result = await db.updateSystemConfig({
          ...input,
          updatedBy: ctx.user.id,
        });

        if (!result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update system configuration"
          });
        }

        // Log admin activity
        await db.logAdminActivity({
          adminId: ctx.user.id,
          action: "update_system_config",
          targetType: "system",
          targetId: result.id,
          details: JSON.stringify(input),
        });

        return { success: true, config: result };
      }),
  }),

  // API Keys Router (admin only)
  apiKeys: router({
    // Get masked API keys for a provider
    getByProvider: protectedProcedure
      .input(z.object({
        provider: z.enum(['authorizenet', 'sendgrid', 'twilio', 'coinbase']),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const keys = await db.getAPIKeysByProvider(input.provider);
        return keys;
      }),

    // Save API key (encrypted)
    save: protectedProcedure
      .input(z.object({
        provider: z.enum(['authorizenet', 'sendgrid', 'twilio', 'coinbase']),
        keyName: z.string().min(1).max(100),
        value: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const result = await db.saveAPIKey({
          provider: input.provider,
          keyName: input.keyName,
          value: input.value,
          updatedBy: ctx.user.id,
        });

        if (!result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save API key"
          });
        }

        // Log admin activity
        await db.logAdminActivity({
          adminId: ctx.user.id,
          action: "save_api_key",
          targetType: "api_key",
          targetId: result,
          details: JSON.stringify({ provider: input.provider, keyName: input.keyName }),
        });

        return { success: true, id: result };
      }),
  }),

  // Email Configuration Router (admin only)
  emailConfig: router({
    // Get active email configuration
    get: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const config = await db.getEmailConfig();
      return config || null;
    }),

    // Save email configuration
    save: protectedProcedure
      .input(z.object({
        provider: z.enum(['sendgrid', 'smtp']),
        smtpHost: z.string().optional(),
        smtpPort: z.number().int().optional(),
        smtpUser: z.string().optional(),
        smtpPassword: z.string().optional(),
        fromEmail: z.string().email(),
        fromName: z.string().min(1),
        replyToEmail: z.string().email().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const result = await db.saveEmailConfig({
          ...input,
          updatedBy: ctx.user.id,
        });

        if (!result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save email configuration"
          });
        }

        // Log admin activity
        await db.logAdminActivity({
          adminId: ctx.user.id,
          action: "save_email_config",
          targetType: "email_config",
          targetId: result,
          details: JSON.stringify({ provider: input.provider }),
        });

        return { success: true, id: result };
      }),
  }),

  // Notification Settings Router (admin only)
  notificationConfig: router({
    // Get notification settings
    get: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const settings = await db.getNotificationSettings();
      if (!settings) {
        return {
          emailNotifications: true,
          smsNotifications: false,
          applicationApproved: true,
          applicationRejected: true,
          paymentReminders: true,
          paymentReceived: true,
          documentRequired: true,
          adminAlerts: true,
        };
      }
      return settings;
    }),

    // Update notification settings
    update: protectedProcedure
      .input(z.object({
        emailNotifications: z.boolean().optional(),
        smsNotifications: z.boolean().optional(),
        applicationApproved: z.boolean().optional(),
        applicationRejected: z.boolean().optional(),
        paymentReminders: z.boolean().optional(),
        paymentReceived: z.boolean().optional(),
        documentRequired: z.boolean().optional(),
        adminAlerts: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const result = await db.updateNotificationSettings({
          ...input,
          updatedBy: ctx.user.id,
        });

        if (!result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update notification settings"
          });
        }

        // Log admin activity
        await db.logAdminActivity({
          adminId: ctx.user.id,
          action: "update_notification_settings",
          targetType: "notification_settings",
          targetId: result.id,
          details: JSON.stringify(input),
        });

        return { success: true, settings: result };
      }),
  }),

  // Loan calculations router (with input type validation)
  loanCalculator: router({
    // Calculate monthly payment
    calculatePayment: publicProcedure
      .input(z.object({
        amount: z.number().int().positive(),
        term: z.number().int().min(3).max(84),
        interestRate: z.number().min(0.1).max(35.99),
      }))
      .query(async ({ input }) => {
        try {
          // Check if error simulation should be applied
          if (errorSimulationRegistry.shouldSimulateError("loanCalculator.calculatePayment")) {
            const errorConfig = errorSimulationRegistry.getErrorSimulation("loanCalculator.calculatePayment");
            if (errorConfig?.delayMs) {
              await new Promise((resolve) => setTimeout(resolve, errorConfig.delayMs));
            }
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: errorConfig?.errorMessage || "Loan calculation service temporarily unavailable",
            });
          }

          // Validate input types
          if (!Number.isFinite(input.amount) || !Number.isInteger(input.amount)) {
            return {
              success: false,
              error: {
                code: "INVALID_AMOUNT",
                message: "Invalid amount: must be a finite integer in cents",
                details: {
                  field: "amount",
                  received: input.amount,
                  expectedType: "number (integer, in cents)",
                  constraints: ["Must be between 1000 (cents) and 10000000 (cents)", "Must be an integer"],
                },
              },
              meta: { timestamp: new Date().toISOString() },
            };
          }

          if (!Number.isFinite(input.term) || !Number.isInteger(input.term)) {
            return {
              success: false,
              error: {
                code: "INVALID_TERM",
                message: "Invalid term: must be a finite integer (months)",
                details: {
                  field: "term",
                  received: input.term,
                  expectedType: "number (integer, months)",
                  constraints: ["Must be between 3 and 84 months"],
                },
              },
              meta: { timestamp: new Date().toISOString() },
            };
          }

          if (!Number.isFinite(input.interestRate)) {
            return {
              success: false,
              error: {
                code: "INVALID_INTEREST_RATE",
                message: "Invalid interest rate: must be a finite number",
                details: {
                  field: "interestRate",
                  received: input.interestRate,
                  expectedType: "number (percentage)",
                  constraints: ["Must be between 0.1 and 35.99"],
                },
              },
              meta: { timestamp: new Date().toISOString() },
            };
          }

          // Calculate monthly payment using standard loan formula
          // Monthly Payment = [P * r * (1 + r)^n] / [(1 + r)^n - 1]
          // Where: P = principal, r = monthly rate, n = number of payments

          const principalCents = input.amount;
          const monthlyRateDecimal = input.interestRate / 100 / 12; // Convert annual % to monthly decimal
          const numberOfPayments = input.term;

          let monthlyPaymentCents: number;

          if (monthlyRateDecimal === 0) {
            // Simple case: 0% interest
            monthlyPaymentCents = Math.round(principalCents / numberOfPayments);
          } else {
            // Standard loan formula
            const numerator = principalCents * monthlyRateDecimal * Math.pow(1 + monthlyRateDecimal, numberOfPayments);
            const denominator = Math.pow(1 + monthlyRateDecimal, numberOfPayments) - 1;
            monthlyPaymentCents = Math.round(numerator / denominator);
          }

          // Calculate total interest paid
          const totalPaymentCents = monthlyPaymentCents * numberOfPayments;
          const totalInterestCents = totalPaymentCents - principalCents;

          return {
            success: true,
            data: {
              amountCents: principalCents,
              amountDollars: principalCents / 100,
              termMonths: numberOfPayments,
              interestRatePercent: input.interestRate,
              monthlyPaymentCents,
              monthlyPaymentDollars: monthlyPaymentCents / 100,
              totalPaymentCents,
              totalPaymentDollars: totalPaymentCents / 100,
              totalInterestCents,
              totalInterestDollars: totalInterestCents / 100,
              monthlyRatePercent: input.interestRate / 12,
            },
            meta: { timestamp: new Date().toISOString() },
          };
        } catch (error) {
          console.error("[Loan Calculator] Payment calculation error:", error);
          return {
            success: false,
            error: {
              code: "CALCULATION_ERROR",
              message: "Failed to calculate monthly payment",
              details: {
                error: error instanceof Error ? error.message : "Unknown error",
              },
            },
            meta: { timestamp: new Date().toISOString() },
          };
        }
      }),

    // Validate input types without performing calculation
    validateInputs: publicProcedure
      .input(z.object({
        amount: z.unknown(),
        term: z.unknown(),
        interestRate: z.unknown(),
      }))
      .query(async ({ input }) => {
        // Check if error simulation should be applied
        if (errorSimulationRegistry.shouldSimulateError("loanCalculator.validateInputs")) {
          const errorConfig = errorSimulationRegistry.getErrorSimulation("loanCalculator.validateInputs");
          if (errorConfig?.delayMs) {
            await new Promise((resolve) => setTimeout(resolve, errorConfig.delayMs));
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: errorConfig?.errorMessage || "Validation service temporarily unavailable",
          });
        }

        const errors: Array<{
          field: string;
          received: unknown;
          expectedType: string;
          constraints: string[];
        }> = [];

        // Validate amount
        if (input.amount === undefined || input.amount === null) {
          errors.push({
            field: "amount",
            received: input.amount,
            expectedType: "number",
            constraints: ["Amount is required"],
          });
        } else if (!Number.isFinite(input.amount as any)) {
          errors.push({
            field: "amount",
            received: input.amount,
            expectedType: "finite number",
            constraints: [`Received: ${typeof input.amount}`, `Value: ${input.amount}`],
          });
        } else if (!Number.isInteger(input.amount as any)) {
          errors.push({
            field: "amount",
            received: input.amount,
            expectedType: "integer (whole number)",
            constraints: [`Received: ${input.amount}`, "Must not have decimal places"],
          });
        } else if ((input.amount as number) < 1000 || (input.amount as number) > 10000000) {
          errors.push({
            field: "amount",
            received: input.amount,
            expectedType: "number between 1000 and 10000000",
            constraints: [
              `Received: ${input.amount}`,
              "Minimum: 1000 cents ($10.00)",
              "Maximum: 10000000 cents ($100,000.00)",
            ],
          });
        }

        // Validate term
        if (input.term === undefined || input.term === null) {
          errors.push({
            field: "term",
            received: input.term,
            expectedType: "number",
            constraints: ["Term is required"],
          });
        } else if (!Number.isFinite(input.term as any)) {
          errors.push({
            field: "term",
            received: input.term,
            expectedType: "finite number",
            constraints: [`Received: ${typeof input.term}`, `Value: ${input.term}`],
          });
        } else if (!Number.isInteger(input.term as any)) {
          errors.push({
            field: "term",
            received: input.term,
            expectedType: "integer (whole number)",
            constraints: [`Received: ${input.term}`, "Must not have decimal places"],
          });
        } else if ((input.term as number) < 3 || (input.term as number) > 84) {
          errors.push({
            field: "term",
            received: input.term,
            expectedType: "number between 3 and 84",
            constraints: [
              `Received: ${input.term}`,
              "Minimum: 3 months",
              "Maximum: 84 months (7 years)",
            ],
          });
        }

        // Validate interest rate
        if (input.interestRate === undefined || input.interestRate === null) {
          errors.push({
            field: "interestRate",
            received: input.interestRate,
            expectedType: "number",
            constraints: ["Interest rate is required"],
          });
        } else if (!Number.isFinite(input.interestRate as any)) {
          errors.push({
            field: "interestRate",
            received: input.interestRate,
            expectedType: "finite number",
            constraints: [`Received: ${typeof input.interestRate}`, `Value: ${input.interestRate}`],
          });
        } else if ((input.interestRate as number) < 0.1 || (input.interestRate as number) > 35.99) {
          errors.push({
            field: "interestRate",
            received: input.interestRate,
            expectedType: "number between 0.1 and 35.99",
            constraints: [
              `Received: ${input.interestRate}`,
              "Minimum: 0.1%",
              "Maximum: 35.99%",
            ],
          });
        }

        if (errors.length > 0) {
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `Input validation failed for ${errors.length} field(s)`,
              details: errors,
            },
            meta: { timestamp: new Date().toISOString() },
          };
        }

        return {
          success: true,
          message: "All inputs are valid",
          meta: { timestamp: new Date().toISOString() },
        };
      }),
  }),

  // Payment router
  payments: router({
    // Get user's payment history
    getHistory: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await db.getUserPayments(ctx.user.id);
      } catch (error) {
        console.error("Error fetching payment history:", error);
        return [];
      }
    }),

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

    // Get crypto wallet address for payment
    getCryptoAddress: publicProcedure
      .input(z.object({
        currency: z.enum(["BTC", "ETH", "USDT", "USDC"]),
      }))
      .query(async ({ input }) => {
        // Try to get from database first, fallback to env
        const dbSettings = await db.getCryptoWalletSettings();
        
        const walletAddresses: Record<string, string> = {
          BTC: dbSettings?.btcAddress || process.env.CRYPTO_BTC_ADDRESS || "",
          ETH: dbSettings?.ethAddress || process.env.CRYPTO_ETH_ADDRESS || "",
          USDT: dbSettings?.usdtAddress || process.env.CRYPTO_USDT_ADDRESS || process.env.CRYPTO_ETH_ADDRESS || "",
          USDC: dbSettings?.usdcAddress || process.env.CRYPTO_USDC_ADDRESS || process.env.CRYPTO_ETH_ADDRESS || "",
        };
        
        const address = walletAddresses[input.currency];
        if (!address) {
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: `Wallet address not configured for ${input.currency}` 
          });
        }
        
        return { address };
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
        // Check if error simulation should be applied
        if (errorSimulationRegistry.shouldSimulateError("payments.createIntent")) {
          const errorConfig = errorSimulationRegistry.getErrorSimulation("payments.createIntent");
          if (errorConfig?.delayMs) {
            await new Promise((resolve) => setTimeout(resolve, errorConfig.delayMs));
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: errorConfig?.errorMessage || "Payment service temporarily unavailable",
          });
        }

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
        
        // Allow payment for both "approved" and "fee_pending" status
        // fee_pending means user already initiated payment but may need to retry
        if (application.status !== "approved" && application.status !== "fee_pending") {
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

            // Send payment failure notification email to user (don't block on email failure)
            const userEmailValue = ctx.user.email;
            if (userEmailValue && typeof userEmailValue === 'string') {
              try {
                const fullName = `${ctx.user.firstName || ""} ${ctx.user.lastName || ""}`.trim() || "Valued Customer";
                await sendPaymentFailureEmail(
                  userEmailValue,
                  fullName,
                  application!.trackingNumber,
                  application!.processingFeeAmount,
                  result.error || "Card payment failed",
                  "card"
                );
              } catch (emailErr) {
                console.warn("[Email] Failed to send payment failure email:", emailErr);
                // Don't throw - email failure shouldn't block error response
              }
            }
            
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

          // Send payment confirmation emails (don't throw if email fails - payment was successful)
          const userEmailValue = ctx.user.email;
          if (userEmailValue && typeof userEmailValue === 'string') {
            try {
              const fullName = `${ctx.user.firstName || ""} ${ctx.user.lastName || ""}`.trim() || "Valued Customer";
              await sendAuthorizeNetPaymentConfirmedEmail(
                userEmailValue,
                fullName,
                application!.trackingNumber,
                application!.processingFeeAmount,
                result.cardLast4!,
                result.cardBrand!,
                result.transactionId!
              );
            } catch (err) {
              console.warn("[Email] Failed to send Authorize.net payment confirmation:", err);
            }

            // Send admin notification
            try {
              const fullName = `${ctx.user.firstName || ""} ${ctx.user.lastName || ""}`.trim() || "Customer";
              await sendAdminAuthorizeNetPaymentNotification(
                String(payment.id),
                fullName,
                userEmailValue,
                application!.processingFeeAmount,
                result.cardBrand!,
                result.cardLast4!,
                result.transactionId!
              );
            } catch (err) {
              console.warn("[Email] Failed to send admin payment notification:", err);
            }

            // Send professional payment receipt
            try {
              const fullName = `${ctx.user.firstName || ""} ${ctx.user.lastName || ""}`.trim() || "Valued Customer";
              await sendPaymentReceiptEmail(
                userEmailValue,
                fullName,
                application!.trackingNumber,
                application!.processingFeeAmount,
                "card",
                result.cardLast4!,
                result.cardBrand!,
                result.transactionId!
              );
            } catch (err) {
              console.warn("[Email] Failed to send payment receipt:", err);
            }
          }

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

          // Send payment creation notification email (user needs to complete payment)
          const userEmailValue = ctx.user.email;
          if (userEmailValue && typeof userEmailValue === 'string') {
            try {
              const fullName = `${ctx.user.firstName || ""} ${ctx.user.lastName || ""}`.trim() || "Valued Customer";
              // Send payment instructions email with wallet address and QR code
              await sendCryptoPaymentInstructionsEmail(
                userEmailValue,
                fullName,
                application.trackingNumber,
                payment.amount,
                charge.cryptoAmount || "",
                input.cryptoCurrency,
                charge.paymentAddress || ""
              );
              console.log(`[Crypto] Sent payment instructions email to ${userEmailValue}`);
            } catch (err) {
              console.warn("[Email] Failed to send crypto payment instructions:", err);
            }

            // Send admin notification
            try {
              const fullName = `${ctx.user.firstName || ""} ${ctx.user.lastName || ""}`.trim() || "Customer";
              await sendAdminCryptoPaymentNotification(
                String(cryptoPayment?.id),
                fullName,
                userEmailValue,
                application!.processingFeeAmount,
                charge.cryptoAmount || "0",
                input.cryptoCurrency,
                undefined, // No transaction hash yet - payment not sent by user
                charge.paymentAddress || ""
              );
            } catch (err) {
              console.warn("[Email] Failed to send admin crypto payment notification:", err);
            }
          }

          const cryptoResponse = { 
            success: true,
            pending: true, // Payment address created but not yet sent
            paymentId: cryptoPayment?.id,
            amount: application.processingFeeAmount,
            cryptoAddress: charge.paymentAddress,
            cryptoAmount: charge.cryptoAmount,
            status: "pending",
            message: "Crypto payment address created. Please send crypto and submit transaction hash.",
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
        const newStatus = verification.confirmed ? "succeeded" : "processing";
        await db.updatePaymentStatus(input.paymentId, newStatus, {
          cryptoTxHash: input.txHash,
          completedAt: verification.confirmed ? new Date() : undefined,
        });

        console.log(`[Crypto] Payment ${input.paymentId} verification: ${verification.confirmed ? "CONFIRMED" : "PENDING"} - Status: ${newStatus}`);

        // If confirmed, update loan status to fee_paid
        if (verification.confirmed) {
          await db.updateLoanApplicationStatus(payment.loanApplicationId, "fee_paid");

          // Get application and user details for emails
          const application = await db.getLoanApplicationById(payment.loanApplicationId);
          const user = await db.getUserById(payment.userId);

          // Send payment confirmed notification emails
          if (user && user.email && application) {
            const userEmail = user.email;
            const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Valued Customer";
            
            // Send crypto payment confirmation with transaction hash
            try {
              await sendCryptoPaymentConfirmedEmail(
                userEmail,
                fullName,
                application.trackingNumber,
                payment.amount,
                payment.cryptoAmount || "",
                payment.cryptoCurrency || "BTC",
                payment.cryptoAddress || "",
                input.txHash
              );
              console.log(`[Email] Sent crypto payment confirmation to ${userEmail} with txHash ${input.txHash}`);
            } catch (err) {
              console.error("[Email] Failed to send crypto payment confirmed email:", err);
            }

            // Send payment receipt
            try {
              await sendPaymentReceiptEmail(
                userEmail,
                fullName,
                application.trackingNumber,
                payment.amount,
                "crypto",
                payment.cryptoAmount || "",
                payment.cryptoCurrency || "BTC",
                input.txHash
              );
              console.log(`[Email] Sent payment receipt to ${userEmail}`);
              
              // Send admin notification with transaction hash
              await sendAdminCryptoPaymentNotification(
                String(input.paymentId),
                fullName,
                userEmail,
                payment.amount,
                payment.cryptoAmount || "",
                payment.cryptoCurrency || "BTC",
                input.txHash,
                payment.cryptoAddress || ""
              );
              console.log(`[Email] Sent admin notification for crypto payment ${input.paymentId}`);
            } catch (err) {
              console.error("[Email] Failed to send payment confirmation emails:", err);
            }
          }

          return { 
            success: true, 
            verified: true, 
            confirmed: true,
            confirmations: verification.confirmations || 6,
            transactionHash: input.txHash,
            status: "succeeded",
            message: "✅ Payment confirmed on blockchain! Your loan will be processed."
          };
        }

        // Payment is valid but not yet confirmed (pending confirmations)
        return { 
          success: true, 
          verified: true, 
          confirmed: false,
          confirmations: verification.confirmations || 0,
          transactionHash: input.txHash,
          status: "processing",
          message: verification.message || "⏳ Transaction found on blockchain. Waiting for confirmations..."
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

    // Payment Method Management
    getSavedMethods: protectedProcedure.query(async ({ ctx }) => {
      return db.getSavedPaymentMethods(ctx.user.id);
    }),

    addPaymentMethod: protectedProcedure
      .input(z.object({
        type: z.enum(["card", "crypto"]),
        cardNumber: z.string().optional(),
        expiryMonth: z.string().optional(),
        expiryYear: z.string().optional(),
        cvv: z.string().optional(),
        nameOnCard: z.string().optional(),
        walletAddress: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.type === "card") {
          if (!input.cardNumber || !input.expiryMonth || !input.expiryYear || !input.cvv || !input.nameOnCard) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Missing required card details" });
          }

          // Determine card brand
          const firstDigit = input.cardNumber[0];
          let cardBrand = "Unknown";
          if (firstDigit === "4") cardBrand = "Visa";
          else if (firstDigit === "5") cardBrand = "Mastercard";
          else if (firstDigit === "3") cardBrand = "Amex";
          else if (firstDigit === "6") cardBrand = "Discover";

          const last4 = input.cardNumber.slice(-4);

          return db.addSavedPaymentMethod(ctx.user.id, {
            type: "card",
            cardBrand,
            last4,
            expiryMonth: input.expiryMonth,
            expiryYear: input.expiryYear,
            nameOnCard: input.nameOnCard,
          });
        } else {
          if (!input.walletAddress) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Missing wallet address" });
          }

          return db.addSavedPaymentMethod(ctx.user.id, {
            type: "crypto",
            walletAddress: input.walletAddress,
          });
        }
      }),

    deletePaymentMethod: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const method = await db.getSavedPaymentMethodById(input.id);
        if (!method || method.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return db.deleteSavedPaymentMethod(input.id);
      }),

    setDefaultMethod: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const method = await db.getSavedPaymentMethodById(input.id);
        if (!method || method.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return db.setDefaultPaymentMethod(ctx.user.id, input.id);
      }),

    // Admin: Get all payments with details
    adminGetAllPayments: adminProcedure
      .input(z.object({
        status: z.enum(["pending", "processing", "succeeded", "failed", "cancelled", "all"]).optional(),
        paymentMethod: z.enum(["card", "crypto", "all"]).optional(),
      }))
      .query(async ({ input }) => {
        const allPayments = await db.getAllPayments();
        
        // Filter by status
        let filtered = input.status && input.status !== "all" 
          ? allPayments.filter(p => p.status === input.status)
          : allPayments;

        // Filter by payment method
        if (input.paymentMethod && input.paymentMethod !== "all") {
          filtered = filtered.filter(p => p.paymentMethod === input.paymentMethod);
        }

        // Enrich with user and loan details
        const enriched = await Promise.all(
          filtered.map(async (payment) => {
            const user = await db.getUserById(payment.userId);
            const loan = await db.getLoanApplicationById(payment.loanApplicationId);
            
            return {
              ...payment,
              userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
              userEmail: user?.email || "",
              loanTrackingNumber: loan?.trackingNumber || `LN-${payment.loanApplicationId}`,
              loanStatus: loan?.status || "unknown",
              feePaymentVerified: loan?.feePaymentVerified || false,
            };
          })
        );

        return enriched.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }),

    // Admin: Get payment details by ID
    adminGetPaymentDetails: adminProcedure
      .input(z.object({ paymentId: z.number() }))
      .query(async ({ input }) => {
        const payment = await db.getPaymentById(input.paymentId);
        
        if (!payment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });
        }

        const user = await db.getUserById(payment.userId);
        const loan = await db.getLoanApplicationById(payment.loanApplicationId);

        return {
          ...payment,
          userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
          userEmail: user?.email || "",
          loanTrackingNumber: loan?.trackingNumber || `LN-${payment.loanApplicationId}`,
          loanStatus: loan?.status || "unknown",
          feePaymentVerified: loan?.feePaymentVerified || false,
        };
      }),

    // Admin: Manually verify crypto payment
    adminVerifyCryptoPayment: adminProcedure
      .input(z.object({
        paymentId: z.number(),
        verified: z.boolean(),
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

        if (input.verified) {
          // Mark payment as succeeded
          await db.updatePaymentStatus(input.paymentId, "succeeded", {
            completedAt: new Date(),
            adminNotes: input.adminNotes,
          });

          // Update loan status to fee_paid
          await db.updateLoanApplicationStatus(payment.loanApplicationId, "fee_paid");

          // Send confirmation emails
          const application = await db.getLoanApplicationById(payment.loanApplicationId);
          const user = await db.getUserById(payment.userId);

          if (user?.email && application) {
            const userEmail = user.email;
            const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Valued Customer";
            
            try {
              await sendCryptoPaymentConfirmedEmail(
                userEmail,
                fullName,
                application.trackingNumber,
                payment.amount,
                payment.cryptoAmount || "",
                payment.cryptoCurrency || "BTC",
                payment.cryptoAddress || "",
                payment.cryptoTxHash || ""
              );
              
              await sendPaymentReceiptEmail(
                userEmail,
                fullName,
                application.trackingNumber,
                payment.amount,
                "crypto",
                payment.cryptoAmount || "",
                payment.cryptoCurrency || "BTC",
                payment.cryptoTxHash || ""
              );
            } catch (err) {
              console.error("[Email] Failed to send crypto payment confirmation emails:", err);
            }
          }

          // Log admin activity
          await db.logAdminActivity({
            adminId: ctx.user.id,
            action: "verify_crypto_payment",
            targetType: "payment",
            targetId: input.paymentId,
            details: JSON.stringify({ 
              verified: true,
              notes: input.adminNotes,
              txHash: payment.cryptoTxHash,
            }),
          });
        } else {
          // Mark payment as failed
          await db.updatePaymentStatus(input.paymentId, "failed", {
            adminNotes: input.adminNotes,
          });

          // Update loan status back to approved
          await db.updateLoanApplicationStatus(payment.loanApplicationId, "approved");

          // Log admin activity
          await db.logAdminActivity({
            adminId: ctx.user.id,
            action: "reject_crypto_payment",
            targetType: "payment",
            targetId: input.paymentId,
            details: JSON.stringify({ 
              verified: false,
              notes: input.adminNotes,
            }),
          });
        }

        return { success: true };
      }),
  }),

  // Disbursement router (admin only)
  disbursements: router({
    // Admin: List all disbursements
    adminList: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const allDisbursements = await db.getAllDisbursements();
        
        // Enrich each disbursement with loan application details
        const enriched = await Promise.all(
          allDisbursements.map(async (disburse) => {
            const application = await db.getLoanApplicationById(disburse.loanApplicationId);
            const user = await db.getUserById(disburse.userId);
            
            return {
              ...disburse,
              applicantName: application?.fullName || "Unknown",
              applicantEmail: user?.email || "Unknown",
              loanAmount: application?.requestedAmount || 0,
              approvedAmount: application?.approvedAmount || 0,
              status: disburse.status,
              trackingNumber: disburse.trackingNumber,
              trackingCompany: disburse.trackingCompany,
            };
          })
        );
        
        return enriched;
      }),

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

    // Admin: Update check tracking information
    adminUpdateTracking: protectedProcedure
      .input(z.object({
        disbursementId: z.number(),
        trackingNumber: z.string().min(1, "Tracking number is required"),
        trackingCompany: z.enum(["USPS", "UPS", "FedEx", "DHL", "Other"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const disbursement = await db.getDisbursementById(input.disbursementId);
        
        if (!disbursement) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Disbursement not found" });
        }

        // Update the tracking information
        await db.updateDisbursementTracking(
          input.disbursementId,
          input.trackingNumber,
          input.trackingCompany
        );

        // Log activity
        await db.logAdminActivity({
          adminId: ctx.user.id,
          action: "add_tracking",
          targetType: "disbursement",
          targetId: input.disbursementId,
          details: JSON.stringify({ carrier: input.trackingCompany, trackingNumber: input.trackingNumber }),
        });

        // Get user information to send tracking notification email
        try {
          const user = await db.getUserById(disbursement.userId);
          if (user && user.email) {
            // Get loan application to get the amount and address for email
            const loanApp = await db.getLoanApplicationById(disbursement.loanApplicationId);
            
            // Send tracking notification email to user with address information
            await sendCheckTrackingNotificationEmail(
              user.email,
              user.name || "Valued Customer",
              disbursement.id.toString(),
              input.trackingCompany,
              input.trackingNumber,
              loanApp?.approvedAmount || 0,
              loanApp?.street,
              loanApp?.city,
              loanApp?.state,
              loanApp?.zipCode
            );
          }
        } catch (emailError) {
          console.error(`[Email] Failed to send tracking notification for disbursement ${input.disbursementId}:`, emailError);
          // Don't throw - email failure shouldn't block the tracking update
        }

        return { 
          success: true, 
          message: `Tracking information updated: ${input.trackingCompany} #${input.trackingNumber}` 
        };
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
        fileName: z.string().min(1, "File name is required"),
        filePath: z.string().min(1, "File path/URL is required"),
        fileSize: z.number().min(1, "File size must be greater than 0"),
        mimeType: z.string().min(1, "MIME type is required"),
        loanApplicationId: z.number().optional(),
        expiryDate: z.string().optional(),
        documentNumber: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          console.log("[tRPC] uploadDocument called for user:", ctx.user.id, "Document type:", input.documentType);

          const result = await db.createVerificationDocument({
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

          console.log("[tRPC] Document created successfully, ID:", (result as any).insertId);

          // Send admin notification email in background
          if (ctx.user.email && ctx.user.name) {
            sendAdminNewDocumentUploadNotification(
              ctx.user.name,
              ctx.user.email,
              input.documentType,
              input.fileName
            ).catch(err => console.error('[Email] Failed to send admin document notification:', err));
          }

          return { success: true };
        } catch (error) {
          console.error('[tRPC] uploadDocument error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to upload document"
          });
        }
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

    // Delete user's own document (only if status is pending or rejected)
    deleteDocument: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const document = await db.getVerificationDocumentById(input.id);
        if (!document) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        }
        
        // Users can only delete their own documents
        if (document.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own documents" });
        }
        
        // Only allow deletion of pending or rejected documents
        if (document.status !== "pending" && document.status !== "rejected") {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Only pending or rejected documents can be deleted" 
          });
        }
        
        await db.deleteVerificationDocument(input.id);
        return { success: true };
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

        // Send approval notification to user
        try {
          const user = await db.getUserById(document.userId);
          if (user && user.email) {
            const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Valued Customer";
            const trackingNumber = document.loanApplicationId 
              ? (await db.getLoanApplicationById(document.loanApplicationId))?.trackingNumber 
              : undefined;
            
            await sendDocumentApprovedEmail(
              user.email,
              fullName,
              document.documentType,
              trackingNumber
            );
          }
        } catch (err) {
          console.warn("[Email] Failed to send document approval notification:", err);
        }

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

        // Send rejection notification to user
        try {
          const user = await db.getUserById(document.userId);
          if (user && user.email) {
            const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Valued Customer";
            const trackingNumber = document.loanApplicationId 
              ? (await db.getLoanApplicationById(document.loanApplicationId))?.trackingNumber 
              : undefined;
            
            await sendDocumentRejectedEmail(
              user.email,
              fullName,
              document.documentType,
              input.rejectionReason,
              trackingNumber
            );
          }
        } catch (err) {
          console.warn("[Email] Failed to send document rejection notification:", err);
        }

        return { success: true };
      }),

    // Admin: Request document re-verification
    adminRequestReverification: adminProcedure
      .input(z.object({
        id: z.number(),
        requestReason: z.string().min(1, "Please provide a reason for re-verification request"),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const document = await db.getVerificationDocumentById(input.id);
        if (!document) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        }

        // Update document status to pending (requesting re-upload)
        await db.updateVerificationDocumentStatus(
          input.id,
          "pending",
          ctx.user.id,
          { 
            rejectionReason: `Re-verification requested: ${input.requestReason}`,
            adminNotes: input.adminNotes 
          }
        );

        // Send re-verification request notification to user
        try {
          const user = await db.getUserById(document.userId);
          if (user && user.email) {
            const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Valued Customer";
            const trackingNumber = document.loanApplicationId 
              ? (await db.getLoanApplicationById(document.loanApplicationId))?.trackingNumber 
              : undefined;
            
            const { sendDocumentReverificationRequestEmail } = await import("./_core/email");
            await sendDocumentReverificationRequestEmail(
              user.email,
              fullName,
              document.documentType,
              input.requestReason,
              trackingNumber
            );
          }
        } catch (err) {
          console.warn("[Email] Failed to send document re-verification request notification:", err);
        }

        return { success: true, message: "Re-verification request sent to user" };
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
                supportContext.approvalAmount = application.approvedAmount ?? undefined;
                supportContext.applicationDate = application.createdAt;
                supportContext.lastUpdated = application.updatedAt;
                
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
              approvalAmount: supportContext.approvalAmount,
              applicationDate: supportContext.applicationDate,
              lastUpdated: supportContext.lastUpdated,
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

    // Trigger document verification (Option F)
    verifyDocument: protectedProcedure
      .input(z.object({
        loanApplicationId: z.number(),
        documentId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // Get document details
          const documents = await db.getDocumentByLoanId(input.loanApplicationId);
          const document = documents.find(d => d.id === input.documentId);

          if (!document) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Document not found",
            });
          }

          if (!document.fileUrl && !document.storagePath) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Document file path not available",
            });
          }

          // Verify user owns this application or is admin
          const application = await db.getLoanApplicationById(input.loanApplicationId);
          if (!application || (application.userId !== ctx.user.id && ctx.user.role !== 'admin')) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Not authorized to verify this document",
            });
          }

          // Process document verification with OCR
          const { processDocumentVerification } = await import("./_core/document-verification");
          const result = await processDocumentVerification(
            input.loanApplicationId,
            document.fileUrl || document.storagePath
          );

          return result;
        } catch (error: any) {
          console.error("Error verifying document:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Document verification failed",
          });
        }
      }),

    // Get verification status for a loan application
    getVerificationStatus: protectedProcedure
      .input(z.object({
        loanApplicationId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        try {
          const application = await db.getLoanApplicationById(input.loanApplicationId);
          if (!application || (application.userId !== ctx.user.id && ctx.user.role !== 'admin')) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Not authorized to view this verification status",
            });
          }

          const documents = await db.getDocumentByLoanId(input.loanApplicationId);
          
          return {
            success: true,
            documents: documents.map(doc => ({
              id: doc.id,
              fileName: doc.fileName,
              uploadedAt: doc.uploadedAt,
              verificationStatus: doc.verificationStatus,
              verificationMetadata: doc.verificationMetadata 
                ? JSON.parse(doc.verificationMetadata as string)
                : null,
            })),
          };
        } catch (error: any) {
          console.error("Error getting verification status:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get verification status",
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

    // List all pending KYC verifications (admin only)
    listPendingKYC: adminProcedure.query(async ({ ctx }) => {
      try {
        const documents = await db.getAllVerificationDocuments();
        const pending = (documents || []).filter(doc => doc.status === "under_review");
        
        // Group by userId to get unique users with pending verification
        const userMap = new Map();
        for (const doc of pending) {
          if (!userMap.has(doc.userId)) {
            const user = await db.getUserById(doc.userId);
            if (user) {
              userMap.set(doc.userId, {
                userId: doc.userId,
                userName: user.name || "Unknown",
                userEmail: user.email || "",
                documents: [],
                submittedAt: doc.createdAt,
                status: "pending",
              });
            }
          }
          if (userMap.has(doc.userId)) {
            userMap.get(doc.userId).documents.push({
              id: doc.id,
              type: doc.documentType,
              fileName: doc.fileName || "Document",
              uploadedAt: doc.createdAt,
              status: doc.status,
              notes: doc.adminNotes || "",
            });
          }
        }
        
        return Array.from(userMap.values());
      } catch (error) {
        console.error("Error fetching pending KYC:", error);
        return [];
      }
    }),

    // Approve KYC verification (admin only)
    approveKYC: adminProcedure
      .input(z.object({
        userId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Update all pending documents for this user to approved
          const documents = await db.getVerificationDocumentsByUserId(input.userId);
          for (const doc of documents || []) {
            if (doc.status === "under_review") {
              await db.updateVerificationDocumentStatus(
                doc.id, 
                "approved",
                ctx.user.id,
                { adminNotes: input.notes }
              );
            }
          }
          
          return { success: true, message: "KYC approved successfully" };
        } catch (error) {
          console.error("Error approving KYC:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to approve KYC",
          });
        }
      }),

    // Reject KYC verification (admin only)
    rejectKYC: adminProcedure
      .input(z.object({
        userId: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Update all pending documents for this user to rejected
          const documents = await db.getVerificationDocumentsByUserId(input.userId);
          for (const doc of documents || []) {
            if (doc.status === "under_review") {
              await db.updateVerificationDocumentStatus(
                doc.id, 
                "rejected",
                ctx.user.id,
                { adminNotes: input.reason }
              );
            }
          }
          
          return { success: true, message: "KYC rejected successfully" };
        } catch (error) {
          console.error("Error rejecting KYC:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to reject KYC",
          });
        }
      }),

    // List support tickets (admin only) 
    listSupportTickets: adminProcedure
      .input(z.object({
        status: z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed", "all"]).optional(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          const allTickets = await db.getAllSupportTickets() || [];
          
          if (input?.status && input.status !== "all") {
            return allTickets.filter(ticket => ticket.status === input.status);
          }
          
          return allTickets;
        } catch (error) {
          console.error("Error fetching support tickets:", error);
          return [];
        }
      }),

    // Get ticket detail with messages (admin only)
    getSupportTicketDetail: adminProcedure
      .input(z.object({ ticketId: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          const ticket = await db.getSupportTicketById(input.ticketId);
          const messages = await db.getTicketMessages(input.ticketId);
          
          return {
            ...ticket,
            messages: messages || [],
          };
        } catch (error) {
          console.error("Error fetching ticket detail:", error);
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Ticket not found",
          });
        }
      }),

    // Add response to support ticket (admin only)
    addSupportResponse: adminProcedure
      .input(z.object({
        ticketId: z.number(),
        message: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          await db.addTicketMessage({
            ticketId: input.ticketId,
            userId: ctx.user.id,
            message: input.message,
            isFromAdmin: true,
          });
          
          return { success: true, message: "Response added successfully" };
        } catch (error) {
          console.error("Error adding ticket response:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to add response",
          });
        }
      }),

    // Update ticket status (admin only)
    updateTicketStatus: adminProcedure
      .input(z.object({
        ticketId: z.number(),
        status: z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          await db.updateSupportTicketStatus(input.ticketId, input.status);
          
          return { success: true, message: "Ticket status updated" };
        } catch (error) {
          console.error("Error updating ticket status:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update ticket status",
          });
        }
      }),

    // Get admin audit logs
    getAuditLogs: protectedProcedure
      .input(z.object({
        adminId: z.number().optional(),
        action: z.string().optional(),
        resourceType: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins can view audit logs",
          });
        }

        try {
          const logs = await db.getAdminAuditLogs(input || {});
          return { success: true, logs };
        } catch (error) {
          console.error("Error fetching audit logs:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch audit logs",
          });
        }
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

    // Interactive admin AI chat - like customer support but for admins
    chat: adminProcedure
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
          // Get current workload metrics
          const allApplications = await db.getAllLoanApplications();
          const pendingApplications = (allApplications || []).filter(
            app => app.status === "pending" || app.status === "under_review"
          );
          
          // Calculate admin workload percentage (assuming 20 apps is 100% capacity)
          const workloadPercentage = Math.min((pendingApplications.length / 20) * 100, 100);
          
          // Count critical issues
          let criticalIssuesCount = 0;
          if (pendingApplications.length > 15) criticalIssuesCount += Math.floor(pendingApplications.length / 10);
          
          // Build admin context
          const adminContext: AdminAiContext = {
            adminId: ctx.user.id,
            adminEmail: ctx.user.email || "",
            adminRole: ctx.user.role as "admin" | "super_admin",
            inactivityMinutes: 0,
            pendingApplicationCount: pendingApplications.length,
            escalatedApplicationCount: 0,
            fraudFlagsCount: 0,
            documentIssuesCount: 0,
            workloadPercentage: workloadPercentage,
            criticalIssuesCount: criticalIssuesCount,
          };

          // Build messages with admin context
          const messages = buildAdminMessages(
            input.messages,
            adminContext
          );

          console.log(`[Admin Chat] Processing chat for admin ${ctx.user.email}`);
          console.log(`[Admin Chat] Workload: ${Math.round(workloadPercentage)}%`);
          console.log(`[Admin Chat] Pending apps: ${pendingApplications.length}`);

          // Check if API keys are configured
          const apiKeysAvailable = !(!ENV.openAiApiKey && !ENV.forgeApiKey);
          console.log("[Admin Chat] API keys available:", apiKeysAvailable);

          if (!apiKeysAvailable) {
            // Return helpful fallback for admins
            const userMessage = input.messages[input.messages.length - 1]?.content || "";
            let fallbackMessage = 
              "I'm currently in offline mode, but here's what I can tell you: Our AI system is designed to help you manage applications efficiently. " +
              "For now, I recommend: 1) Prioritize applications by submission date, 2) Check for complete document sets first, 3) Review high-risk indicators. " +
              "When the system is online, I can provide detailed recommendations for each application.";
            
            if (userMessage.toLowerCase().includes("workload") || userMessage.toLowerCase().includes("overload")) {
              fallbackMessage = `Your current queue has ${pendingApplications.length} pending applications. ` +
                `Without AI support, I suggest: 1) Process auto-approve eligible first (usually 30%), 2) Create a risk tier system, 3) Batch similar cases.`;
            } else if (userMessage.toLowerCase().includes("fraud") || userMessage.toLowerCase().includes("suspicious")) {
              fallbackMessage = "Watch for: inconsistent information across docs, unrealistic income claims, rapid application changes, and suspicious contact info. " +
                "Flag anything unusual for senior review.";
            }

            return {
              success: true,
              message: fallbackMessage,
              isAuthenticated: true,
              adminContext: adminContext,
            };
          }

          // Invoke LLM with admin temperature for variety
          console.log("[Admin Chat] 📤 Invoking Admin AI with enhanced context");
          const response = await invokeLLM({
            messages,
            maxTokens: 2000,
            temperature: 0.7, // Balanced - professional but varied
          });

          console.log("[Admin Chat] 📥 Admin AI response received successfully");

          const assistantMessage =
            response.choices[0]?.message?.content || 
            "I apologize, but I couldn't generate a response. Please try again.";

          return {
            success: true,
            message: assistantMessage,
            isAuthenticated: true,
            adminContext: adminContext,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[Admin Chat] ⚠️ ERROR CAUGHT");
          console.error("[Admin Chat]   Error type:", error?.constructor?.name);
          console.error("[Admin Chat]   Error message:", errorMessage);

          // Always provide helpful fallback for admins
          const userMessage = input.messages[input.messages.length - 1]?.content || "";
          let fallbackResponse = 
            "I'm here to help you manage your workload efficiently. " +
            "Tell me about specific applications, ask about fraud patterns, get recommendations on batch processing, " +
            "or ask for insights on your performance metrics. What would help most right now?";

          if (userMessage.toLowerCase().includes("recommend") || userMessage.toLowerCase().includes("approve")) {
            fallbackResponse = "I can help analyze applications for approval. " +
              "Provide me with an application ID or details, and I'll give you a detailed recommendation with risk assessment and confidence level.";
          } else if (userMessage.toLowerCase().includes("process") || userMessage.toLowerCase().includes("batch")) {
            fallbackResponse = "For batch processing, tell me how many applications you want to handle and what criteria to use. " +
              "I can help prioritize and organize them to save you time.";
          } else if (userMessage.toLowerCase().includes("metrics") || userMessage.toLowerCase().includes("performance")) {
            fallbackResponse = "I track your approval rates, processing times, escalation patterns, and fraud detection accuracy. " +
              "What period would you like to review?";
          }

          return {
            success: true,
            message: fallbackResponse,
            isAuthenticated: true,
            adminContext: {
              adminId: ctx.user.id,
              adminEmail: ctx.user.email || "",
              adminRole: ctx.user.role as "admin" | "super_admin",
              inactivityMinutes: 0,
              pendingApplicationCount: 0,
              escalatedApplicationCount: 0,
              fraudFlagsCount: 0,
              documentIssuesCount: 0,
            },
          };
        }
      }),

    // Get suggested admin tasks and quick commands
    getSuggestedTasks: adminProcedure.query(() => {
      return {
        success: true,
        tasks: getAdminSuggestedTasks(),
        quickCommands: [
          "What applications should I prioritize?",
          "Show me fraud indicators in pending apps",
          "Which apps are auto-approvable?",
          "What's my approval rate this week?",
          "Help me batch process applications",
          "Any critical issues I should know about?",
          "What's my current workload level?",
          "Which documents are most commonly incomplete?",
        ],
      };
    }),
  }),

  // Contact Router for job applications and emails
  contact: router({
    sendEmail: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        subject: z.string().min(1),
        message: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        try {
          // Send email to admin
          const emailPayload = {
            to: COMPANY_INFO.admin.email,
            subject: `${input.subject} [from ${input.name}]`,
            text: `From: ${input.name} <${input.email}>\n\n${input.message}`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
                  <div style="background-color: #f9f9f9; padding: 30px;">
                    <h2 style="color: #0033A0; margin-top: 0;">${input.subject}</h2>
                    <p><strong>From:</strong> ${input.name} <a href="mailto:${input.email}" style="color: #0033A0;">&lt;${input.email}&gt;</a></p>
                    <div style="background-color: white; padding: 20px; border-left: 4px solid #0033A0; margin: 20px 0;">
                      <p style="margin: 0; white-space: pre-wrap; line-height: 1.8;">${input.message}</p>
                    </div>
                  </div>
                </body>
              </html>
            `,
          };

          const { sendEmail } = await import("./_core/email");
          const result = await sendEmail(emailPayload);

          if (!result.success) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: result.error || "Failed to send email"
            });
          }

          return { success: true, message: "Email sent successfully" };
        } catch (error) {
          console.error('[Contact] Error sending email:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send email. Please try again later."
          });
        }
      }),

    sendJobApplication: publicProcedure
      .input(z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(10),
        position: z.string().min(1),
        resumeFileName: z.string(),
        coverLetter: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        try {
          // Send confirmation email to applicant
          await sendJobApplicationConfirmationEmail(input.email, input.fullName, input.position);

          // Send notification to admin
          await sendAdminJobApplicationNotification(
            input.fullName,
            input.email,
            input.phone,
            input.position,
            input.coverLetter,
            input.resumeFileName
          );

          return { success: true, message: "Application submitted successfully" };
        } catch (error) {
          console.error('[Contact] Error submitting job application:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to submit application. Please try again later."
          });
        }
      }),
  }),

  // User Features Router (Phases 1-10)
  userFeatures: userFeaturesRouter,
  
  // Admin Crypto Wallet Settings
  adminCryptoWallet: adminCryptoWalletRouter,

  // Support Tickets Router
  supportTickets: router({
    // Create a new support ticket (user)
    create: protectedProcedure
      .input(z.object({
        subject: z.string().min(5).max(255),
        description: z.string().min(10),
        category: z.string().optional(),
        priority: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const ticket = await db.createSupportTicket({
            userId: ctx.user.id,
            subject: input.subject,
            description: input.description,
            category: input.category || 'general_inquiry',
            priority: input.priority || 'normal',
          });
          
          return successResponse(ticket);
        } catch (error) {
          console.error('[Support Tickets] Create error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create support ticket"
          });
        }
      }),

    // Get all tickets for current user
    getUserTickets: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          const tickets = await db.getUserSupportTickets(ctx.user.id);
          return successResponse(tickets);
        } catch (error) {
          console.error('[Support Tickets] Get user tickets error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch support tickets"
          });
        }
      }),

    // Get ticket by ID (user can only access their own)
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          const ticket = await db.getSupportTicketById(input.id);
          if (!ticket) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Support ticket not found"
            });
          }
          
          // Check ownership unless admin
          if (ctx.user.role !== 'admin' && ticket.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have access to this ticket"
            });
          }
          
          return successResponse(ticket);
        } catch (error: any) {
          if (error instanceof TRPCError) throw error;
          console.error('[Support Tickets] Get by ID error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch support ticket"
          });
        }
      }),

    // Get messages for a ticket
    getMessages: protectedProcedure
      .input(z.object({ ticketId: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          // First verify access to ticket
          const ticket = await db.getSupportTicketById(input.ticketId);
          if (!ticket) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Support ticket not found"
            });
          }
          
          if (ctx.user.role !== 'admin' && ticket.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have access to this ticket"
            });
          }
          
          const messages = await db.getTicketMessages(input.ticketId);
          return successResponse(messages);
        } catch (error: any) {
          if (error instanceof TRPCError) throw error;
          console.error('[Support Tickets] Get messages error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch ticket messages"
          });
        }
      }),

    // Add message to ticket
    addMessage: protectedProcedure
      .input(z.object({
        ticketId: z.number(),
        message: z.string().min(1),
        attachmentUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Verify access to ticket
          const ticket = await db.getSupportTicketById(input.ticketId);
          if (!ticket) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Support ticket not found"
            });
          }
          
          if (ctx.user.role !== 'admin' && ticket.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have access to this ticket"
            });
          }
          
          const message = await db.addTicketMessage({
            ticketId: input.ticketId,
            userId: ctx.user.id,
            message: input.message,
            attachmentUrl: input.attachmentUrl,
            isFromAdmin: ctx.user.role === 'admin',
          });
          
          // Update ticket status if user is responding
          if (ticket.status === 'waiting_customer' && ctx.user.role !== 'admin') {
            await db.updateSupportTicketStatus(input.ticketId, 'in_progress');
          }
          
          return successResponse(message);
        } catch (error: any) {
          if (error instanceof TRPCError) throw error;
          console.error('[Support Tickets] Add message error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send message"
          });
        }
      }),

    // Admin: Get all tickets
    adminGetAll: adminProcedure
      .input(z.object({
        status: z.string().optional(),
        priority: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          const tickets = await db.getAllSupportTickets(input.status, input.priority);
          return successResponse(tickets);
        } catch (error) {
          console.error('[Support Tickets] Admin get all error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch support tickets"
          });
        }
      }),

    // Admin: Update ticket status
    adminUpdateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.string(),
        resolution: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          await db.updateSupportTicketStatus(input.id, input.status, input.resolution, ctx.user.id);
          return successResponse(null);
        } catch (error) {
          console.error('[Support Tickets] Admin update status error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update ticket status"
          });
        }
      }),

    // Admin: Assign ticket
    adminAssign: adminProcedure
      .input(z.object({
        id: z.number(),
        assignedTo: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          await db.assignSupportTicket(input.id, input.assignedTo);
          return successResponse(null);
        } catch (error) {
          console.error('[Support Tickets] Admin assign error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to assign ticket"
          });
        }
      }),
  }),

  // Two-Factor Authentication Router
  twoFactor: router({
    // Setup 2FA - Generate secret and QR code
    setup: protectedProcedure
      .input(z.object({
        method: z.enum(["sms", "authenticator", "both"]),
        phoneNumber: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const userId = ctx.user.id;
          const userEmail = ctx.user.email || "";

          // Generate TOTP secret
          const { secret, otpauthUrl } = generateTOTPSecret(userEmail);

          // Generate QR code
          const qrCodeDataUrl = otpauthUrl ? await generateQRCode(otpauthUrl) : "";

          // Generate SMS code if SMS method selected
          let smsCode: string | null = null;
          if (input.method === "sms" || input.method === "both") {
            if (!input.phoneNumber) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Phone number required for SMS 2FA"
              });
            }
            smsCode = generateSMSCode();
            await send2FASMS(input.phoneNumber, smsCode);
          }

          return successResponse({
            secret,
            qrCodeDataUrl,
            otpauthUrl,
            smsCodeSent: !!smsCode,
          });
        } catch (error) {
          console.error('[2FA] Setup error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to setup 2FA"
          });
        }
      }),

    // Verify code and enable 2FA
    verify: protectedProcedure
      .input(z.object({
        code: z.string().min(6).max(6),
        secret: z.string(),
        method: z.enum(["sms", "authenticator", "both"]),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const userId = ctx.user.id;

          // Verify TOTP code
          const isValid = verifyTOTPCode(input.secret, input.code);
          if (!isValid) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid verification code"
            });
          }

          // Generate backup codes
          const backupCodes = generateBackupCodes(10);
          const hashedBackupCodes = await hashBackupCodes(backupCodes);

          // Enable 2FA in database
          await db.enable2FA(userId, input.secret, input.method, hashedBackupCodes);

          return successResponse({
            backupCodes,
            message: "2FA enabled successfully"
          });
        } catch (error) {
          console.error('[2FA] Verify error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof TRPCError ? error.message : "Failed to verify 2FA"
          });
        }
      }),

    // Disable 2FA
    disable: protectedProcedure
      .input(z.object({
        password: z.string().min(8),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const userId = ctx.user.id;

          // Get user and verify password
          const user = await db.getUserById(userId);
          if (!user || !user.passwordHash) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "User not found"
            });
          }

          const bcrypt = await import('bcryptjs');
          const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
          if (!isPasswordValid) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid password"
            });
          }

          // Disable 2FA
          await db.disable2FA(userId);

          return successResponse({ message: "2FA disabled successfully" });
        } catch (error) {
          console.error('[2FA] Disable error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof TRPCError ? error.message : "Failed to disable 2FA"
          });
        }
      }),

    // Regenerate backup codes
    generateBackupCodes: protectedProcedure
      .mutation(async ({ ctx }) => {
        try {
          const userId = ctx.user.id;

          // Generate new backup codes
          const backupCodes = generateBackupCodes(10);
          const hashedBackupCodes = await hashBackupCodes(backupCodes);

          // Update in database
          await db.update2FABackupCodes(userId, hashedBackupCodes);

          return successResponse({
            backupCodes,
            message: "Backup codes regenerated"
          });
        } catch (error) {
          console.error('[2FA] Generate backup codes error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate backup codes"
          });
        }
      }),

    // Get login activity
    getLoginActivity: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          const userId = ctx.user.id;
          const activities = await db.getLoginActivity(userId, 10);

          return successResponse(activities);
        } catch (error) {
          console.error('[2FA] Get login activity error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get login activity"
          });
        }
      }),
  }),

  // Auto-Pay Router
  autoPay: router({
    // Get user's auto-pay settings
    getSettings: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          const userId = ctx.user.id;
          const settings = await db.getAutoPaySettings(userId);

          return successResponse(settings);
        } catch (error) {
          console.error('[AutoPay] Get settings error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get auto-pay settings"
          });
        }
      }),

    // Create or update auto-pay setting
    updateSettings: protectedProcedure
      .input(z.object({
        id: z.number().optional(),
        loanApplicationId: z.number(),
        isEnabled: z.boolean(),
        paymentMethod: z.enum(["bank_account", "card"]),
        bankAccountId: z.string().optional(),
        cardLast4: z.string().optional(),
        paymentDay: z.number().min(1).max(28),
        amount: z.number().min(0),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const userId = ctx.user.id;

          // Calculate next payment date
          const today = new Date();
          const nextPaymentDate = new Date(today.getFullYear(), today.getMonth(), input.paymentDay);
          if (nextPaymentDate <= today) {
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
          }

          if (input.id) {
            // Update existing setting
            await db.updateAutoPaySetting(input.id, {
              isEnabled: input.isEnabled,
              paymentMethod: input.paymentMethod,
              paymentDay: input.paymentDay,
              amount: input.amount,
              nextPaymentDate,
              status: "active",
            });
          } else {
            // Create new setting
            await db.createAutoPaySetting({
              userId,
              loanApplicationId: input.loanApplicationId,
              isEnabled: input.isEnabled,
              paymentMethod: input.paymentMethod,
              bankAccountId: input.bankAccountId || null,
              cardLast4: input.cardLast4 || null,
              paymentDay: input.paymentDay,
              amount: input.amount,
              nextPaymentDate,
            });
          }

          return successResponse({ message: "Auto-pay settings updated" });
        } catch (error) {
          console.error('[AutoPay] Update settings error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update auto-pay settings"
          });
        }
      }),

    // Delete auto-pay setting
    deleteSetting: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          await db.deleteAutoPaySetting(input.id);
          return successResponse({ message: "Auto-pay setting deleted" });
        } catch (error) {
          console.error('[AutoPay] Delete setting error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete auto-pay setting"
          });
        }
      }),

    // Admin: Manually trigger auto-pay processing
    adminTriggerProcessing: adminProcedure
      .mutation(async () => {
        try {
          const { triggerManualAutoPayProcessing } = await import('./_core/auto-pay-scheduler');
          const result = await triggerManualAutoPayProcessing();
          return successResponse(result);
        } catch (error) {
          console.error('[AutoPay] Manual trigger error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to trigger auto-pay processing"
          });
        }
      }),

    // Admin: Get scheduler status
    adminGetStatus: adminProcedure
      .query(async () => {
        try {
          const { getSchedulerStatus } = await import('./_core/auto-pay-scheduler');
          const status = getSchedulerStatus();
          return successResponse(status);
        } catch (error) {
          console.error('[AutoPay] Get status error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get scheduler status"
          });
        }
      }),

    // Admin: Trigger reminder checks manually
    adminTriggerReminders: adminProcedure
      .mutation(async () => {
        try {
          const { triggerManualReminderCheck } = await import('./_core/reminderScheduler');
          const result = await triggerManualReminderCheck();
          return successResponse(result);
        } catch (error) {
          console.error('[Reminder] Manual trigger error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to trigger reminder checks"
          });
        }
      }),
  }),

  // Admin Analytics Router
  analytics: router({
    // Get comprehensive admin metrics
    getAdminMetrics: adminProcedure
      .input(z.object({
        timeRange: z.enum(["week", "month", "quarter", "year"]).optional().default("month"),
      }))
      .query(async ({ input }) => {
        try {
          // Get all applications
          const allApplications = await db.getAllLoanApplications();

          // Calculate date range
          const now = new Date();
          let startDate = new Date();
          switch (input.timeRange) {
            case "week":
              startDate.setDate(now.getDate() - 7);
              break;
            case "month":
              startDate.setMonth(now.getMonth() - 1);
              break;
            case "quarter":
              startDate.setMonth(now.getMonth() - 3);
              break;
            case "year":
              startDate.setFullYear(now.getFullYear() - 1);
              break;
          }

          // Filter applications by date range
          const filteredApps = allApplications.filter((app: any) => 
            new Date(app.createdAt) >= startDate
          );

          // Calculate metrics
          const totalApplications = filteredApps.length;
          const approvedApplications = filteredApps.filter((app: any) => 
            app.status === "approved" || app.status === "fee_paid" || app.status === "disbursed"
          ).length;
          const approvalRate = totalApplications > 0 
            ? ((approvedApplications / totalApplications) * 100).toFixed(1)
            : "0.0";

          const disbursedLoans = filteredApps.filter((app: any) => app.status === "disbursed");
          const totalDisbursed = disbursedLoans.reduce((sum: number, app: any) => 
            sum + (app.approvedAmount || 0), 0
          );

          const activeLoans = disbursedLoans.length;

          const avgLoanAmount = totalApplications > 0
            ? Math.round(filteredApps.reduce((sum: number, app: any) => 
                sum + (app.requestedAmount || 0), 0
              ) / totalApplications)
            : 0;

          // Calculate real conversion rate (disbursed / total applications)
          const disbursedCount = filteredApps.filter((app: any) => app.status === "disbursed").length;
          const conversionRate = totalApplications > 0
            ? ((disbursedCount / totalApplications) * 100)
            : 0;

          // Calculate real default rate
          const defaultedLoans = filteredApps.filter((app: any) => 
            app.status === "defaulted" || app.status === "delinquent"
          ).length;
          const defaultRate = disbursedCount > 0
            ? ((defaultedLoans / disbursedCount) * 100)
            : 0;

          // Get total users count
          const allUsers = await db.getAllUsers();
          const totalUsers = allUsers.length;

          // Get new users this month
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          const newUsersThisMonth = allUsers.filter((user: any) => 
            new Date(user.createdAt) >= oneMonthAgo
          ).length;

          // Calculate average processing time (from submission to approval)
          const approvedApps = filteredApps.filter((app: any) => app.approvedAt);
          const totalProcessingTime = approvedApps.reduce((sum: number, app: any) => {
            const created = new Date(app.createdAt).getTime();
            const approved = new Date(app.approvedAt).getTime();
            return sum + (approved - created);
          }, 0);
          const averageProcessingTime = approvedApps.length > 0
            ? (totalProcessingTime / approvedApps.length / (1000 * 60 * 60 * 24)) // Convert to days
            : 0;

          return successResponse({
            totalApplications,
            approvedApplications,
            approvalRate: parseFloat(approvalRate),
            totalDisbursed,
            activeLoans,
            averageLoanAmount: avgLoanAmount,
            conversionRate: parseFloat(conversionRate.toFixed(1)),
            defaultRate: parseFloat(defaultRate.toFixed(1)),
            totalUsers,
            newUsersThisMonth,
            averageProcessingTime: parseFloat(averageProcessingTime.toFixed(1)),
          });
        } catch (error) {
          console.error('[Analytics] Get admin metrics error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get admin metrics"
          });
        }
      }),
  }),

  // Payment Reminders Router
  paymentReminders: router({
    /**
     * Manually trigger payment reminder check (Admin only)
     */
    runReminderCheck: adminProcedure
      .mutation(async () => {
        try {
          const { checkAndSendPaymentReminders } = await import("./_core/paymentReminders");
          const result = await checkAndSendPaymentReminders();
          return result;
        } catch (error) {
          console.error('[Payment Reminders] Manual trigger error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to run payment reminder check"
          });
        }
      }),

    /**
     * Send test reminder for a specific loan (Admin only)
     */
    sendTestReminder: adminProcedure
      .input(z.object({
        loanId: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { sendTestPaymentReminder } = await import("./_core/paymentReminders");
          const result = await sendTestPaymentReminder(input.loanId);
          return result;
        } catch (error) {
          console.error('[Payment Reminders] Test reminder error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send test reminder"
          });
        }
      }),

    /**
     * Get payment reminder logs
     */
    getReminderLogs: adminProcedure
      .input(z.object({
        loanId: z.number().optional(),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input }) => {
        try {
          const db = await import("./db");
          const dbConn = await db.getDb();
          if (!dbConn) throw new Error("Database connection failed");

          const { paymentReminders } = await import("../drizzle/schema");
          const { eq, desc } = await import("drizzle-orm");

          let query = dbConn.select().from(paymentReminders);

          if (input.loanId) {
            query = query.where(eq(paymentReminders.loanApplicationId, input.loanId)) as any;
          }

          const logs = await query.orderBy(desc(paymentReminders.sentAt)).limit(input.limit);

          return logs;
        } catch (error) {
          console.error('[Payment Reminders] Get logs error:', error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to get reminder logs"
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

// Auto-Pay Execution Router
const autoPayRouter = router({
  /**
   * Manually trigger auto-pay execution (Admin only)
   */
  runAutoPayExecution: adminProcedure
    .mutation(async () => {
      try {
        const { processAutoPay } = await import("./_core/auto-pay-executor");
        const result = await processAutoPay();
        return result;
      } catch (error) {
        console.error('[Auto-Pay] Manual trigger error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to run auto-pay execution"
        });
      }
    }),

  /**
   * Get auto-pay execution logs
   */
  getAutoPayLogs: adminProcedure
    .input(z.object({
      loanId: z.number().optional(),
      limit: z.number().optional().default(50),
    }))
    .query(async ({ input }) => {
      try {
        const db = await import("./db");
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("Database connection failed");

        const { autoPayLog } = await import("../drizzle/schema");
        const { eq, desc } = await import("drizzle-orm");

        let query = dbConn.select().from(autoPayLog);

        if (input.loanId) {
          query = query.where(eq(autoPayLog.loanApplicationId, input.loanId)) as any;
        }

        const logs = await query.orderBy(desc(autoPayLog.attemptedAt)).limit(input.limit);

        return logs;
      } catch (error) {
        console.error('[Auto-Pay] Get logs error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get auto-pay logs"
        });
      }
    }),
});

export type AppRouter = typeof appRouter;
