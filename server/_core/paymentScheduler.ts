/**
 * Payment notification scheduler
 * Runs periodic checks for:
 * - Payments due in 7 days (send reminders)
 * - Overdue payments (send alerts)
 * - Delinquencies (send critical alerts)
 */

import {
  getPaymentsDueReminder,
  getOverduePayments,
  getDelinquentPayments,
} from "../db";
import {
  notifyPaymentDueReminder,
  notifyPaymentOverdue,
  notifyDelinquency,
} from "./paymentNotifications";
import { logger } from "./logger";

interface ScheduleOptions {
  intervalMs?: number; // Check interval in milliseconds (default: 1 hour)
  enablePaymentDueReminders?: boolean; // 7 days before due (default: true)
  enablePaymentOverdueAlerts?: boolean; // 1+ days overdue (default: true)
  enableDelinquencyAlerts?: boolean; // 30+ days overdue (default: true)
}

class PaymentNotificationScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private options: Required<ScheduleOptions> = {
    intervalMs: 60 * 60 * 1000, // 1 hour default
    enablePaymentDueReminders: true,
    enablePaymentOverdueAlerts: true,
    enableDelinquencyAlerts: true,
  };

  constructor(options?: ScheduleOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("[Payment Scheduler] Scheduler already running");
      return;
    }

    logger.info(
      "[Payment Scheduler] Starting payment notification scheduler",
      `(interval: ${this.options.intervalMs}ms)`
    );

    this.isRunning = true;

    // Run immediately on start
    this.runCheck().catch((error) => {
      logger.error("[Payment Scheduler] Error on initial check:", error);
    });

    // Then set up recurring interval
    this.intervalId = setInterval(
      () => {
        this.runCheck().catch((error) => {
          logger.error("[Payment Scheduler] Error in scheduled check:", error);
        });
      },
      this.options.intervalMs
    );
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn("[Payment Scheduler] Scheduler not running");
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info("[Payment Scheduler] Payment notification scheduler stopped");
  }

  /**
   * Perform a single check
   */
  private async runCheck(): Promise<void> {
    try {
      logger.info("[Payment Scheduler] Running payment notification check...");

      let totalProcessed = 0;
      let totalErrors = 0;

      // Check for payments due in 7 days
      if (this.options.enablePaymentDueReminders) {
        try {
          const result = await this.checkPaymentDueReminders();
          totalProcessed += result.processed;
          totalErrors += result.errors;
        } catch (error) {
          logger.error("[Payment Scheduler] Error checking payment due reminders:", error);
          totalErrors++;
        }
      }

      // Check for overdue payments
      if (this.options.enablePaymentOverdueAlerts) {
        try {
          const result = await this.checkPaymentOverdue();
          totalProcessed += result.processed;
          totalErrors += result.errors;
        } catch (error) {
          logger.error("[Payment Scheduler] Error checking overdue payments:", error);
          totalErrors++;
        }
      }

      // Check for delinquencies
      if (this.options.enableDelinquencyAlerts) {
        try {
          const result = await this.checkDelinquencies();
          totalProcessed += result.processed;
          totalErrors += result.errors;
        } catch (error) {
          logger.error("[Payment Scheduler] Error checking delinquencies:", error);
          totalErrors++;
        }
      }

      logger.info(
        `[Payment Scheduler] Check complete: ${totalProcessed} notifications sent, ${totalErrors} errors`
      );
    } catch (error) {
      logger.error("[Payment Scheduler] Fatal error in runCheck:", error);
    }
  }

  /**
   * Check for payments due in 7 days and send reminders
   */
  private async checkPaymentDueReminders(): Promise<{
    processed: number;
    errors: number;
  }> {
    logger.info("[Payment Scheduler] Checking for payment due reminders (7 days)...");

    let processed = 0;
    let errors = 0;

    try {
      // Query payments due in approximately 7 days
      const paymentsDue = await getPaymentsDueReminder(7);

      for (const payment of paymentsDue) {
        try {
          const result = await notifyPaymentDueReminder(
            payment.userId,
            payment.trackingNumber,
            payment.dueAmount,
            payment.dueDate
          );

          if (result.success) {
            processed++;
          } else {
            errors++;
            logger.warn(
              `[Payment Scheduler] Due reminder errors for payment ${payment.paymentId}:`,
              result.errors
            );
          }
        } catch (error) {
          logger.error(
            `[Payment Scheduler] Failed to send due reminder for payment ${payment.paymentId}:`,
            error
          );
          errors++;
        }
      }
    } catch (error) {
      logger.error("[Payment Scheduler] Error in checkPaymentDueReminders:", error);
      errors++;
    }

    logger.info(
      `[Payment Scheduler] Payment due reminders: ${processed} sent, ${errors} errors`
    );
    return { processed, errors };
  }

  /**
   * Check for overdue payments and send alerts
   */
  private async checkPaymentOverdue(): Promise<{
    processed: number;
    errors: number;
  }> {
    logger.info("[Payment Scheduler] Checking for overdue payments...");

    let processed = 0;
    let errors = 0;

    try {
      // Query payments 1-29 days overdue
      const overduePayments = await getOverduePayments(1, 29);

      for (const payment of overduePayments) {
        try {
          const daysOverdue = payment.daysOverdue || 0;
          const result = await notifyPaymentOverdue(
            payment.userId,
            payment.trackingNumber,
            payment.dueAmount,
            daysOverdue,
            payment.dueDate
          );

          if (result.success) {
            processed++;
          } else {
            errors++;
            logger.warn(
              `[Payment Scheduler] Overdue alert errors for payment ${payment.paymentId}:`,
              result.errors
            );
          }
        } catch (error) {
          logger.error(
            `[Payment Scheduler] Failed to send overdue alert for payment ${payment.paymentId}:`,
            error
          );
          errors++;
        }
      }
    } catch (error) {
      logger.error("[Payment Scheduler] Error in checkPaymentOverdue:", error);
      errors++;
    }

    logger.info(
      `[Payment Scheduler] Overdue payment alerts: ${processed} sent, ${errors} errors`
    );
    return { processed, errors };
  }

  /**
   * Check for delinquent payments and send critical alerts
   */
  private async checkDelinquencies(): Promise<{
    processed: number;
    errors: number;
  }> {
    logger.info("[Payment Scheduler] Checking for delinquencies (30+ days)...");

    let processed = 0;
    let errors = 0;

    try {
      // Query payments 30+ days overdue
      const delinquentPayments = await getDelinquentPayments(30);

      for (const payment of delinquentPayments) {
        try {
          // Send delinquency notification
          // Note: Actual loan status update would happen in the payments router
          // based on business logic for marking loans as delinquent

          const daysOverdue = payment.daysOverdue || 0;
          const result = await notifyDelinquency(
            payment.userId,
            payment.trackingNumber,
            payment.dueAmount,
            daysOverdue
          );

          if (result.success) {
            processed++;
          } else {
            errors++;
            logger.warn(
              `[Payment Scheduler] Delinquency alert errors for payment ${payment.paymentId}:`,
              result.errors
            );
          }
        } catch (error) {
          logger.error(
            `[Payment Scheduler] Failed to send delinquency alert for payment ${payment.paymentId}:`,
            error
          );
          errors++;
        }
      }
    } catch (error) {
      logger.error("[Payment Scheduler] Error in checkDelinquencies:", error);
      errors++;
    }

    logger.info(
      `[Payment Scheduler] Delinquency alerts: ${processed} sent, ${errors} errors`
    );
    return { processed, errors };
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    intervalMs: number;
    options: Required<ScheduleOptions>;
  } {
    return {
      isRunning: this.isRunning,
      intervalMs: this.options.intervalMs,
      options: this.options,
    };
  }

  /**
   * Update scheduler options
   */
  updateOptions(options: Partial<ScheduleOptions>): void {
    const wasRunning = this.isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.options = { ...this.options, ...options };

    if (wasRunning) {
      this.start();
    }

    logger.info("[Payment Scheduler] Options updated:", this.options);
  }
}

// Create singleton instance
export const paymentNotificationScheduler = new PaymentNotificationScheduler({
  intervalMs: process.env.PAYMENT_SCHEDULER_INTERVAL_MS
    ? parseInt(process.env.PAYMENT_SCHEDULER_INTERVAL_MS)
    : 60 * 60 * 1000, // 1 hour default
  enablePaymentDueReminders:
    process.env.PAYMENT_SCHEDULER_DUE_REMINDERS !== "false",
  enablePaymentOverdueAlerts:
    process.env.PAYMENT_SCHEDULER_OVERDUE_ALERTS !== "false",
  enableDelinquencyAlerts:
    process.env.PAYMENT_SCHEDULER_DELINQUENCY_ALERTS !== "false",
});

/**
 * Initialize the scheduler (should be called during app startup)
 */
export function initializePaymentNotificationScheduler(): void {
  if (process.env.DISABLE_PAYMENT_SCHEDULER === "true") {
    logger.info(
      "[Payment Scheduler] Scheduler disabled via DISABLE_PAYMENT_SCHEDULER env var"
    );
    return;
  }

  paymentNotificationScheduler.start();
}

/**
 * Shutdown the scheduler (should be called during app shutdown)
 */
export function shutdownPaymentNotificationScheduler(): void {
  paymentNotificationScheduler.stop();
}

export default paymentNotificationScheduler;
