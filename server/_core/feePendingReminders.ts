/**
 * Fee-Pending Reminder
 *
 * Sweeps loans stuck in `fee_pending` state — loans the admin has approved
 * but where the user never completed the processing-fee payment. Sends an
 * email nudge no more often than every 72 hours per loan.
 *
 * Wired into the daily cron in cron-jobs.ts.
 */

import { logger } from "./logger";
import {
  getFeePendingLoansNeedingReminder,
  markFeeReminderSent,
  getUserById,
} from "../db";
import { sendUnpaidFeeReminderEmail } from "./email";

export interface FeePendingReminderResult {
  success: boolean;
  scanned: number;
  sent: number;
  skipped: number;
  errors: number;
}

export async function sendFeePendingReminders(): Promise<FeePendingReminderResult> {
  let scanned = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Loans older than 24h, no reminder in last 72h
    const loans = await getFeePendingLoansNeedingReminder(24, 72);
    scanned = loans.length;

    if (scanned === 0) {
      logger.info("[FeePending] No loans need reminders");
      return { success: true, scanned, sent, skipped, errors };
    }

    logger.info(`[FeePending] ${scanned} loan(s) need fee-payment reminder`);

    for (const loan of loans) {
      try {
        const user = await getUserById(loan.userId);
        if (!user?.email) {
          logger.warn(`[FeePending] Loan ${loan.id} has no user email; skipping`);
          skipped++;
          continue;
        }

        if (!loan.processingFeeAmount || !loan.approvedAmount) {
          logger.warn(`[FeePending] Loan ${loan.id} missing fee/amount; skipping`);
          skipped++;
          continue;
        }

        const fullName = (
          (user.firstName ? `${user.firstName} ` : "") +
          (user.lastName ?? "")
        ).trim() || user.email;

        const result = await sendUnpaidFeeReminderEmail(
          user.email,
          fullName,
          loan.approvedAmount,
          loan.processingFeeAmount,
          loan.trackingNumber,
        );

        if (result.success) {
          await markFeeReminderSent(loan.id);
          sent++;
          logger.info(`[FeePending] Reminded loan ${loan.trackingNumber} (user ${user.email})`);
        } else {
          errors++;
          logger.warn(`[FeePending] Failed to send reminder for loan ${loan.id}: ${result.error}`);
        }
      } catch (loanErr) {
        errors++;
        logger.error(`[FeePending] Error processing loan ${loan.id}:`, loanErr);
      }
    }

    return { success: true, scanned, sent, skipped, errors };
  } catch (error) {
    logger.error("[FeePending] Fatal error:", error);
    return { success: false, scanned, sent, skipped, errors: errors + 1 };
  }
}
