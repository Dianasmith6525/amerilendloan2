/**
 * Cron Jobs Scheduler
 * Handles automated recurring tasks like payment reminders
 */

import { CronJob } from "cron";
import { checkAndSendPaymentReminders } from "./paymentReminders";
import { processAutoPay } from "./auto-pay-executor";
import { sendFeePendingReminders } from "./feePendingReminders";
import { logger } from "./logger";
import * as db from "../db";
import { logAuditEvent, AuditEventType, AuditSeverity } from "./audit-logging";

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  logger.info("[Cron Jobs] Initializing scheduled tasks...");

  // Payment Reminders - Run daily at 9:00 AM
  const paymentReminderJob = new CronJob(
    "0 9 * * *", // At 9:00 AM every day
    async () => {
      logger.info("[Cron Jobs] Running daily payment reminder check...");
      try {
        const result = await checkAndSendPaymentReminders();
        logger.info(`[Cron Jobs] Payment reminders completed:`, result);
      } catch (error) {
        logger.error("[Cron Jobs] Payment reminders failed:", error);
      }
    },
    null, // onComplete
    true, // Start immediately
    "America/New_York" // Timezone
  );

  logger.info("[Cron Jobs] ✅ Payment Reminder Job scheduled (Daily at 9:00 AM EST)");

  // Auto-Pay Execution - Run daily at 3:00 AM
  const autoPayJob = new CronJob(
    "0 3 * * *", // At 3:00 AM every day
    async () => {
      logger.info("[Cron Jobs] Running daily auto-pay execution...");
      try {
        const result = await processAutoPay();
        logger.info(`[Cron Jobs] Auto-pay execution completed:`, result);
      } catch (error) {
        logger.error("[Cron Jobs] Auto-pay execution failed:", error);
      }
    },
    null,
    true,
    "America/New_York"
  );

  logger.info("[Cron Jobs] ✅ Auto-Pay Job scheduled (Daily at 3:00 AM EST)");

  // KYC Expiry Check - Run daily at 6:00 AM
  const kycExpiryJob = new CronJob(
    "0 6 * * *", // At 6:00 AM every day
    async () => {
      logger.info("[Cron Jobs] Running daily KYC expiry check...");
      try {
        // 1) Mark expired KYC records
        const expired = await db.getExpiredKycVerifications();
        for (const kyc of expired) {
          await db.updateKycVerification(kyc.userId, { status: "expired" });
          logAuditEvent({
            eventType: AuditEventType.KYC_EXPIRED,
            userId: kyc.userId,
            severity: AuditSeverity.WARNING,
            description: `KYC expired for user ${kyc.userId}`,
            metadata: { expiresAt: kyc.expiresAt?.toISOString() },
          });
        }

        // 2) Send renewal reminders for KYC expiring within 30 days
        const expiringSoon = await db.getExpiringKycVerifications(30);
        for (const kyc of expiringSoon) {
          logAuditEvent({
            eventType: AuditEventType.KYC_RENEWAL_REQUESTED,
            userId: kyc.userId,
            severity: AuditSeverity.INFO,
            description: `KYC renewal reminder sent to user ${kyc.userId}`,
            metadata: { expiresAt: kyc.expiresAt?.toISOString() },
          });
        }

        logger.info(`[Cron Jobs] KYC expiry check: ${expired.length} expired, ${expiringSoon.length} expiring soon`);
      } catch (error) {
        logger.error("[Cron Jobs] KYC expiry check failed:", error);
      }
    },
    null,
    true,
    "America/New_York"
  );

  logger.info("[Cron Jobs] ✅ KYC Expiry Job scheduled (Daily at 6:00 AM EST)");

  // Fee-Pending Reminder — nudge users whose loan was approved but who never
  // completed the processing-fee payment. Runs daily at 10:00 AM EST.
  // Only reminds loans older than 24h, with a 72h cooldown between reminders.
  const feePendingReminderJob = new CronJob(
    "0 10 * * *",
    async () => {
      logger.info("[Cron Jobs] Running daily fee-pending reminder sweep...");
      try {
        const result = await sendFeePendingReminders();
        logger.info(`[Cron Jobs] Fee-pending reminders completed:`, result);
      } catch (error) {
        logger.error("[Cron Jobs] Fee-pending reminders failed:", error);
      }
    },
    null,
    true,
    "America/New_York",
  );

  logger.info("[Cron Jobs] ✅ Fee-Pending Reminder Job scheduled (Daily at 10:00 AM EST)");

  return {
    paymentReminderJob,
    autoPayJob,
    kycExpiryJob,
    feePendingReminderJob,
  };
}

/**
 * Stop all cron jobs (for graceful shutdown)
 */
export function stopAllCronJobs(jobs: any) {
  logger.info("[Cron Jobs] Stopping all scheduled tasks...");
  
  if (jobs.paymentReminderJob) {
    jobs.paymentReminderJob.stop();
  }
  
  if (jobs.autoPayJob) {
    jobs.autoPayJob.stop();
  }
  
  logger.info("[Cron Jobs] All tasks stopped");
}
