/**
 * Payment notification helpers
 * Centralized payment notification logic for email and SMS
 * Respects user preferences for notification channels
 */

import { getUserById, getUserNotificationPreferences } from "../db";
import {
  sendPaymentDueReminderEmail,
  sendPaymentOverdueAlertEmail,
  sendPaymentReceivedEmail,
  sendPaymentFailedEmail,
} from "./email";
import {
  sendPaymentOverdueAlertSMS,
  sendDelinquencyAlertSMS,
  sendPaymentReceivedSMS,
  sendPaymentFailedSMS,
} from "./sms";
import { logger } from "./logger";

/**
 * Send payment due reminder (7 days before due date)
 * Only sends email - SMS not needed for non-urgent reminders
 */
export async function notifyPaymentDueReminder(
  userId: number,
  loanNumber: string,
  dueAmount: number,
  dueDate: Date
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    const user = await getUserById(userId);
    if (!user || !user.email) {
      logger.warn(`[Payment Notification] User ${userId} not found or has no email`);
      return { success: false, errors: ["User not found or has no email"] };
    }

    const errors: string[] = [];

    // Check email notification preferences
    try {
      const prefs = await getUserNotificationPreferences(userId);
      const emailEnabled = prefs?.emailEnabled ?? true;
      const paymentRemindersOn = prefs?.paymentReminders ?? true;
      
      // Send email if both email channel and payment reminders are enabled
      if (emailEnabled && paymentRemindersOn) {
        const daysUntilDue = Math.max(0, Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        await sendPaymentDueReminderEmail(
          user.email,
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Valued Customer",
          loanNumber,
          dueAmount,
          daysUntilDue
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error(`[Payment Notification] Email error for payment reminder:`, errorMsg);
      errors.push(`Email: ${errorMsg}`);
    }

    return { success: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Payment Notification] Error sending payment due reminder:`, errorMsg);
    return { success: false, errors: [errorMsg] };
  }
}

/**
 * Send payment overdue alert (when payment is past due)
 * Sends both email and SMS to maximize chance of customer attention
 */
export async function notifyPaymentOverdue(
  userId: number,
  loanNumber: string,
  dueAmount: number,
  daysOverdue: number,
  dueDate: Date
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    const user = await getUserById(userId);
    if (!user || !user.email) {
      logger.warn(`[Payment Notification] User ${userId} not found or has no email`);
      return { success: false, errors: ["User not found or has no email"] };
    }

    const errors: string[] = [];
    
    // Get notification preferences
    const prefs = await getUserNotificationPreferences(userId);
    const emailEnabled = prefs?.emailEnabled ?? true;
    const smsEnabled = prefs?.smsEnabled ?? false;

    // Send email
    try {
      if (emailEnabled) {
        await sendPaymentOverdueAlertEmail(
          user.email,
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Valued Customer",
          loanNumber,
          dueAmount,
          daysOverdue,
          dueDate,
          `https://amerilendloan.com/make-payment`
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error(`[Payment Notification] Email error for overdue alert:`, errorMsg);
      errors.push(`Email: ${errorMsg}`);
    }

    // Send SMS (only if enabled and phone available)
    if (user.phoneNumber && smsEnabled) {
      try {
        await sendPaymentOverdueAlertSMS(
          user.phoneNumber,
          loanNumber,
          daysOverdue,
          dueAmount
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[Payment Notification] SMS error for overdue alert:`, errorMsg);
        errors.push(`SMS: ${errorMsg}`);
      }
    }

    return { success: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Payment Notification] Error sending payment overdue alert:`, errorMsg);
    return { success: false, errors: [errorMsg] };
  }
}

/**
 * Send critical delinquency alert (30+ days overdue)
 * More aggressive - sends both email and SMS
 */
export async function notifyDelinquency(
  userId: number,
  loanNumber: string,
  dueAmount: number,
  daysOverdue: number
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    const user = await getUserById(userId);
    if (!user || !user.email) {
      logger.warn(`[Payment Notification] User ${userId} not found or has no email`);
      return { success: false, errors: ["User not found or has no email"] };
    }

    const errors: string[] = [];
    
    // Get notification preferences
    const prefs = await getUserNotificationPreferences(userId);
    const emailEnabled = prefs?.emailEnabled ?? true;
    const smsEnabled = prefs?.smsEnabled ?? false;

    // Send email - even more urgent
    try {
      if (emailEnabled) {
        await sendPaymentOverdueAlertEmail(
          user.email,
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Valued Customer",
          loanNumber,
          dueAmount,
          daysOverdue,
          new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000), // Calculate original due date
          `https://amerilendloan.com/support`
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error(`[Payment Notification] Email error for delinquency alert:`, errorMsg);
      errors.push(`Email: ${errorMsg}`);
    }

    // Send SMS - more aggressive for critical situation (even if SMS pref disabled)
    if (user.phoneNumber) {
      try {
        await sendDelinquencyAlertSMS(
          user.phoneNumber,
          loanNumber,
          daysOverdue,
          dueAmount
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[Payment Notification] Error sending delinquency SMS:`, errorMsg);
        errors.push(`SMS: ${errorMsg}`);
      }
    }

    return { success: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Payment Notification] Error sending delinquency notification:`, errorMsg);
    return { success: false, errors: [errorMsg] };
  }
}

/**
 * Send payment received confirmation
 * Respects email preference; optional SMS for confirmations
 */
export async function notifyPaymentReceived(
  userId: number,
  loanNumber: string,
  paymentAmount: number,
  paymentDate: Date,
  paymentMethod: string,
  newBalance?: number
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    const user = await getUserById(userId);
    if (!user || !user.email) {
      logger.warn(`[Payment Notification] User ${userId} not found or has no email`);
      return { success: false, errors: ["User not found or has no email"] };
    }

    const errors: string[] = [];
    
    // Get notification preferences
    const prefs = await getUserNotificationPreferences(userId);
    const emailEnabled = prefs?.emailEnabled ?? true;
    const smsEnabled = prefs?.smsEnabled ?? false;
    const confirmationsOn = prefs?.paymentConfirmations ?? true;

    // Send email
    try {
      if (emailEnabled && confirmationsOn) {
        await sendPaymentReceivedEmail(
          user.email,
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Valued Customer",
          loanNumber,
          paymentAmount,
          paymentDate,
          paymentMethod,
          newBalance
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error(`[Payment Notification] Email error for payment confirmation:`, errorMsg);
      errors.push(`Email: ${errorMsg}`);
    }

    // Send SMS if user opted in for confirmation SMS (less common)
    if (user.phoneNumber && smsEnabled) {
      try {
        await sendPaymentReceivedSMS(
          user.phoneNumber,
          loanNumber,
          paymentAmount
        );
      } catch (error) {
        logger.warn(`[Payment Notification] Error sending confirmation SMS:`, error);
        // Don't add to errors - confirmations are not critical
      }
    }

    return { success: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Payment Notification] Error sending payment received notification:`, errorMsg);
    return { success: false, errors: [errorMsg] };
  }
}

/**
 * Send payment failed alert
 * Sends both email and SMS to ensure customer knows to retry
 */
export async function notifyPaymentFailed(
  userId: number,
  loanNumber: string,
  paymentAmount: number,
  failureReason: string
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    const user = await getUserById(userId);
    if (!user || !user.email) {
      logger.warn(`[Payment Notification] User ${userId} not found or has no email`);
      return { success: false, errors: ["User not found or has no email"] };
    }

    const errors: string[] = [];
    
    // Get notification preferences
    const prefs = await getUserNotificationPreferences(userId);
    const emailEnabled = prefs?.emailEnabled ?? true;
    const smsEnabled = prefs?.smsEnabled ?? false;

    // Send email
    try {
      if (emailEnabled) {
        await sendPaymentFailedEmail(
          user.email,
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Valued Customer",
          loanNumber,
          paymentAmount,
          failureReason,
          `https://amerilendloan.com/payment-history`
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error(`[Payment Notification] Email error for payment failed alert:`, errorMsg);
      errors.push(`Email: ${errorMsg}`);
    }

    // Send SMS if phone available and SMS alerts enabled
    if (user.phoneNumber && smsEnabled) {
      try {
        await sendPaymentFailedSMS(
          user.phoneNumber,
          loanNumber,
          paymentAmount,
          failureReason
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[Payment Notification] Error sending payment failed SMS:`, errorMsg);
        errors.push(`SMS: ${errorMsg}`);
      }
    }

    return { success: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Payment Notification] Error sending payment failed notification:`, errorMsg);
    return { success: false, errors: [errorMsg] };
  }
}

/**
 * Batch process payment due reminders for all upcoming payments
 */
export async function sendBatchPaymentDueReminders(): Promise<{
  total: number;
  succeeded: number;
  failed: number;
}> {
  const results = { total: 0, succeeded: 0, failed: 0 };

  try {
    const { getUpcomingPayments } = await import("../db");
    const upcomingPayments = await getUpcomingPayments(7);
    
    if (!upcomingPayments?.length) {
      return results;
    }
    
    results.total = upcomingPayments.length;
    
    for (const payment of upcomingPayments) {
      try {
        const notifyResult = await notifyPaymentDueReminder(
          payment.userId,
          payment.loanNumber || `LOAN-${payment.loanApplicationId}`,
          payment.amount,
          new Date(payment.dueDate)
        );
        
        if (notifyResult.success) {
          results.succeeded++;
        } else {
          results.failed++;
        }
      } catch (err) {
        results.failed++;
      }
    }
    
    return results;
  } catch (error) {
    logger.error("[PaymentNotifications] Batch reminder error:", error);
    return results;
  }
}

/**
 * Batch process overdue payment alerts
 */
export async function sendBatchPaymentOverdueAlerts(): Promise<{
  total: number;
  succeeded: number;
  failed: number;
}> {
  const results = { total: 0, succeeded: 0, failed: 0 };

  try {
    const { getOverduePayments } = await import("../db");
    const overduePayments = await getOverduePayments();
    
    if (!overduePayments?.length) {
      return results;
    }
    
    results.total = overduePayments.length;
    
    for (const payment of overduePayments) {
      try {
        const daysOverdue = Math.floor(
          (Date.now() - new Date(payment.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        const notifyResult = await notifyPaymentOverdue(
          payment.userId,
          `LOAN-${payment.loanApplicationId}`,
          payment.dueAmount,
          daysOverdue,
          new Date(payment.dueDate)
        );
        
        if (notifyResult.success) {
          results.succeeded++;
        } else {
          results.failed++;
        }
      } catch (err) {
        results.failed++;
      }
    }
    
    return results;
  } catch (error) {
    logger.error("[PaymentNotifications] Batch overdue alert error:", error);
    return results;
  }
}
