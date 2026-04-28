import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDb, getDbStatus } from "../db";
import { buildMessages, getSuggestedPrompts as getAiSuggestedPrompts } from "./aiSupport";
import { extractMessageText, invokeLLM } from "./llm";
import { createBackup, restoreBackup, listBackups, getBackupHealth } from "./database-backup";
import * as db from "../db";
import * as path from "path";
import { logger } from "./logger";

// Helper function to get varied fallback responses based on user intent
const getFallbackResponse = (userMessage: string): string => {
  const msg = userMessage.toLowerCase();

  if (msg.includes("apply")) {
    const responses = [
      "To apply for a loan with AmeriLend, visit our Apply page. The process takes just a few minutes and requires basic information about yourself and the loan amount you need.",
      "Ready to apply? Head to our Apply page and you'll be done in minutes. We just need some basic info about you and your desired loan amount.",
      "Getting a loan from AmeriLend is easy! Simply visit our application page, enter your details, and we'll process your request quickly.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (msg.includes("rate") || msg.includes("interest") || msg.includes("apr")) {
    const responses = [
      "Our loan rates start at competitive APRs and vary based on your credit profile and loan amount. Visit our Rates page to see current offers, or apply to get a personalized rate quote.",
      "Interest rates depend on several factors including credit history and loan amount. Check our Rates page for current ranges, or apply to receive your custom rate.",
      "We offer competitive rates tailored to your situation. For the most accurate rate information, I recommend visiting our Rates page or submitting an application.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (msg.includes("payment") || msg.includes("pay")) {
    const responses = [
      "You can make payments using credit/debit cards or cryptocurrency. Log in to your dashboard to view your payment schedule and make payments securely.",
      "We accept both traditional card payments and crypto payments. Access your dashboard to see your balance and payment options.",
      "Making a payment is easy! Just log in to your account dashboard where you'll find your payment schedule and can choose between card or crypto payment methods.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (msg.includes("document") || msg.includes("upload") || msg.includes("verification")) {
    const responses = [
      "You can upload required documents directly through your dashboard. We accept PDF, JPG, and PNG files. Common documents include ID, proof of income, and bank statements.",
      "Document upload is simple through your account dashboard. Make sure files are clear and readable - we accept PDF and image formats.",
      "Upload your verification documents in your dashboard under the Documents section. Our team will review them within 24 hours.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (msg.includes("status") || msg.includes("application") || msg.includes("track")) {
    const responses = [
      "You can check your loan application status anytime by logging into your dashboard. Your tracking number (e.g., APP-XXXXXX) is provided when you apply — use it in the chat or Application Tracker to check progress.",
      "Track your application progress in real-time through your account dashboard or by providing your tracking number here. You'll receive notifications as your application moves through each stage.",
      "Your application status is always available in your dashboard. Just share your tracking number (from your confirmation email) and I can look it up for you right away.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (msg.includes("contact") || msg.includes("support") || msg.includes("help")) {
    return "You can reach our support team at support@amerilendloan.com or call us at (945) 212-1609. We're here to help Monday through Friday, 9 AM to 6 PM EST.";
  }

  // Default responses
  const defaults = [
    "I'm here to help! You can ask me about our loan application process, rates, payment options, or anything else related to AmeriLend services.",
    "I can assist you with questions about applying for loans, checking rates, making payments, uploading documents, or tracking your application status. What would you like to know?",
    "Feel free to ask me about loan applications, interest rates, payment methods, document requirements, or contact information. How can I help you today?",
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
};

const SUPPORT_MAX_HISTORY_MESSAGES = 18;
const SUPPORT_MAX_MESSAGE_CHARS = 2000;

function normalizeSupportHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>
): Array<{ role: "user" | "assistant"; content: string }> {
  return history
    .filter((msg) => typeof msg.content === "string" && msg.content.trim().length > 0)
    .slice(-SUPPORT_MAX_HISTORY_MESSAGES)
    .map((msg) => ({
      role: msg.role,
      content: msg.content.slice(0, SUPPORT_MAX_MESSAGE_CHARS),
    }));
}

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(async () => ({
      ok: true,
      timestamp: new Date().toISOString(),
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // AI Chat Support
  chatWithAi: publicProcedure
    .input(z.object({
      message: z.string().min(1, "Message cannot be empty"),
      conversationHistory: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional().default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const isAuthenticated = !!ctx.user;
        let userContext: Record<string, any> = isAuthenticated ? {
          isAuthenticated: true,
          userRole: ctx.user?.role,
          userId: ctx.user?.id,
        } : {
          isAuthenticated: false,
        };

        // For authenticated users, fetch their loan data + tracking numbers
        if (isAuthenticated && ctx.user?.id) {
          try {
            const applications = await db.getLoanApplicationsByUserId(ctx.user.id);
            if (applications && applications.length > 0) {
              userContext.loanCount = applications.length;
              userContext.allApplications = applications.map(app => ({
                trackingNumber: app.trackingNumber || `LOAN-${app.id}`,
                status: app.status,
                requestedAmount: app.requestedAmount,
                approvedAmount: app.approvedAmount,
                loanType: app.loanType,
                createdAt: app.createdAt,
              }));

              const latest = applications[0];
              userContext.trackingNumber = latest.trackingNumber || undefined;
              userContext.loanStatus = latest.status;
              userContext.loanAmount = latest.requestedAmount;
              userContext.approvalAmount = latest.approvedAmount ?? undefined;
              userContext.applicationDate = latest.createdAt;
              userContext.lastUpdated = latest.updatedAt;
              userContext.email = ctx.user.email || undefined;

              if (ctx.user.createdAt) {
                const ageInDays = Math.floor(
                  (Date.now() - new Date(ctx.user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                );
                userContext.accountAge = ageInDays;
              }
            }
          } catch (dbError) {
            logger.warn('[AI Support] Failed to fetch user loans for context:', dbError);
          }
        }

        // Build conversation history with the new message
        const conversationMessages: Array<{ role: "user" | "assistant"; content: string }> = [
          ...normalizeSupportHistory(input.conversationHistory),
          { role: "user", content: input.message.slice(0, SUPPORT_MAX_MESSAGE_CHARS) }
        ];

        // Build messages with context
        const messages = buildMessages(conversationMessages, isAuthenticated, userContext);

        // Try to get AI response
        try {
          const aiResponse = await invokeLLM({
            messages,
            maxTokens: 1500,
            temperature: 0.8,
          });
          const responseContent = aiResponse.choices[0]?.message?.content;
          const messageText = extractMessageText(responseContent);

          if (!messageText) {
            const fallbackMsg = getFallbackResponse(input.message);
            return {
              success: true,
              message: fallbackMsg,
              isAuthenticated,
              userContext,
            };
          }
              
          return {
            success: true,
            message: messageText,
            isAuthenticated,
            userContext,
          };
        } catch (llmError) {
          logger.error('[AI Support] LLM error, using fallback:', llmError);
          // Use fallback response if LLM fails
          const fallbackMsg = getFallbackResponse(input.message);
          return {
            success: true,
            message: fallbackMsg,
            isAuthenticated,
            userContext,
          };
        }
      } catch (error) {
        logger.error('[AI Support] Error:', error);
        return {
          success: false,
          message: "I apologize, but I'm having trouble connecting right now. Please try again or contact support at support@amerilendloan.com or (945) 212-1609.",
          isAuthenticated: !!ctx.user,
          userContext: { isAuthenticated: !!ctx.user },
        };
      }
    }),

  // Get suggested prompts based on authentication status
  getSuggestedPrompts: publicProcedure.query(({ ctx }) => {
    const isAuthenticated = !!ctx.user;
    return getAiSuggestedPrompts(isAuthenticated);
  }),

  // System Health & Monitoring (Admin Only)
  getSystemHealth: adminProcedure
    .query(async () => {
      try {
        const dbStatus = getDbStatus();
        const backupHealth = getBackupHealth();
        const memoryUsage = process.memoryUsage();
        const uptimeSeconds = process.uptime();

        // Check database connectivity
        let dbConnected = false;
        let dbResponseTime = 0;
        try {
          const start = Date.now();
          const testDb = await getDb();
          dbConnected = !!testDb;
          dbResponseTime = Date.now() - start;
        } catch {
          dbConnected = false;
        }

        return {
          database: {
            connected: dbConnected,
            responseTimeMs: dbResponseTime,
            status: dbStatus,
          },
          backup: {
            lastBackupTime: backupHealth.timestamp,
            lastBackupSuccess: backupHealth.success,
            lastBackupTables: backupHealth.tableCount,
            lastBackupRecords: backupHealth.totalRecords,
            lastBackupFile: backupHealth.filename,
            lastBackupError: backupHealth.error,
            backupFrequencyHours: 6,
          },
          server: {
            uptimeSeconds: Math.floor(uptimeSeconds),
            uptimeFormatted: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`,
            memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            memoryTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || "development",
          },
        };
      } catch (error) {
        logger.error("[System Health] Error:", error);
        return {
          database: { connected: false, responseTimeMs: 0, status: "error" },
          backup: { lastBackupTime: null, lastBackupSuccess: false, lastBackupTables: 0, lastBackupRecords: 0, lastBackupFile: null, lastBackupError: "Health check failed", backupFrequencyHours: 6 },
          server: { uptimeSeconds: 0, uptimeFormatted: "0h 0m", memoryUsageMB: 0, memoryTotalMB: 0, nodeVersion: process.version, environment: process.env.NODE_ENV || "development" },
        };
      }
    }),

  // Database Backup Management (Admin Only)
  createBackup: adminProcedure
    .mutation(async () => {
      try {
        const backupPath = await createBackup();
        if (backupPath) {
          return {
            success: true,
            message: "Backup created successfully",
            backupPath: path.basename(backupPath),
          };
        } else {
          return {
            success: false,
            message: "Failed to create backup",
            backupPath: null,
          };
        }
      } catch (error) {
        logger.error("[Backup] Error creating backup:", error);
        return {
          success: false,
          message: `Backup failed: ${(error as Error).message}`,
          backupPath: null,
        };
      }
    }),

  listBackups: adminProcedure
    .query(async () => {
      try {
        const backups = listBackups();
        return {
          success: true,
          backups: backups.map(b => ({
            ...b,
            sizeFormatted: formatBytes(b.size),
          })),
        };
      } catch (error) {
        logger.error("[Backup] Error listing backups:", error);
        return {
          success: false,
          backups: [],
        };
      }
    }),

  restoreBackup: adminProcedure
    .input(z.object({
      filename: z.string().min(1, "Filename is required"),
    }))
    .mutation(async ({ input }) => {
      try {
        const backupDir = path.join(process.cwd(), "backups");
        const backupPath = path.join(backupDir, input.filename);
        
        // Security check - ensure filename doesn't contain path traversal
        if (input.filename.includes("..") || input.filename.includes("/") || input.filename.includes("\\")) {
          return {
            success: false,
            message: "Invalid filename",
          };
        }
        
        const success = await restoreBackup(backupPath);
        return {
          success,
          message: success ? "Backup restored successfully" : "Failed to restore backup",
        };
      } catch (error) {
        logger.error("[Backup] Error restoring backup:", error);
        return {
          success: false,
          message: `Restore failed: ${(error as Error).message}`,
        };
      }
    }),
});

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
