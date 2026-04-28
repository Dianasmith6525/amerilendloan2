import cron from 'node-cron';
import * as db from '../db';
import { 
  sendPaymentReceiptEmail, 
  sendPaymentFailureEmail 
} from './email';
import { processStripePayment } from './stripe';
import { logger } from "./logger";

/**
 * Auto-Pay Scheduler
 * Runs daily at 2:00 AM to process scheduled automatic payments
 */

let isProcessing = false;
let lastRunTime: Date | null = null;
let processedCount = 0;
let failedCount = 0;

export function startAutoPayScheduler() {
  logger.info('[Auto-Pay Scheduler] Initializing auto-pay scheduler...');
  
  // Run every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('[Auto-Pay Scheduler] Starting scheduled auto-pay processing...');
    await processAutoPayments();
  });

  // Also allow manual trigger for testing
  logger.info('[Auto-Pay Scheduler] ✅ Scheduler started (runs daily at 2:00 AM)');
}

export async function processAutoPayments() {
  if (isProcessing) {
    logger.info('[Auto-Pay Scheduler] Already processing, skipping...');
    return {
      success: false,
      message: 'Auto-pay processing already in progress',
    };
  }

  isProcessing = true;
  lastRunTime = new Date();
  processedCount = 0;
  failedCount = 0;

  try {
    logger.info('[Auto-Pay Scheduler] Fetching auto-pay settings due today...');
    
    // Get all active auto-pay settings where today is the payment day
    const today = new Date();
    const currentDay = today.getDate();
    
    const autoPaySettings = await db.getAutoPaySettingsDueToday(currentDay);
    logger.info(`[Auto-Pay Scheduler] Found ${autoPaySettings.length} auto-pay settings due today`);

    for (const setting of autoPaySettings) {
      try {
        await processIndividualAutoPay(setting);
        processedCount++;
      } catch (error) {
        logger.error(`[Auto-Pay Scheduler] Error processing auto-pay ${setting.id}:`, error);
        failedCount++;
        
        // Record failure
        await db.recordAutoPayFailure(setting.id);
        
        // Send failure notification
        const user = await db.getUserById(setting.userId);
        if (!setting.loanId) {
          logger.error(`[Auto-Pay Scheduler] ❌ Loan ID missing for auto-pay ${setting.id}`);
          return;
        }
        const loan = await db.getLoanApplicationById(setting.loanId);
        
        if (user && loan) {
          await sendPaymentFailureEmail(
            user.email || '',
            user.firstName || 'User',
            loan.trackingNumber,
            setting.amount || 0,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }

        // Disable auto-pay after 3 consecutive failures
        if (setting.failedAttempts >= 2) { // This will be the 3rd failure
          await db.updateAutoPaySetting(setting.id, { isEnabled: false });
          logger.info(`[Auto-Pay Scheduler] Disabled auto-pay ${setting.id} after 3 consecutive failures`);
        }
      }
    }

    logger.info(`[Auto-Pay Scheduler] ✅ Processing complete: ${processedCount} succeeded, ${failedCount} failed`);
    
    return {
      success: true,
      processedCount,
      failedCount,
      totalSettings: autoPaySettings.length,
    };
  } catch (error) {
    logger.error('[Auto-Pay Scheduler] Fatal error during auto-pay processing:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    isProcessing = false;
  }
}

async function processIndividualAutoPay(setting: any) {
  logger.info(`[Auto-Pay Scheduler] Processing auto-pay ${setting.id} for user ${setting.userId}`);
  
  // Get user and loan details
  const user = await db.getUserById(setting.userId);
  if (!setting.loanId) {
    throw new Error('Loan ID is missing from auto-pay setting');
  }
  const loan = await db.getLoanApplicationById(setting.loanId);
  
  if (!user || !loan) {
    throw new Error('User or loan not found');
  }

  if (loan.status !== 'disbursed') {
    throw new Error('Loan is not in disbursed status');
  }

  // Validate saved payment method exists (Stripe customer + payment method)
  if (!setting.customerProfileId || !setting.paymentProfileId) {
    throw new Error('No saved payment method found for auto-pay');
  }

  const stripeCustomerId = setting.customerProfileId;
  const stripePaymentMethodId = setting.paymentProfileId;

  // Charge using Stripe (idempotency key bound to loan + day prevents
  // duplicate charges if the scheduler retries within the same UTC day).
  const idempotencyKey = `autopay:loan:${loan.id}:${new Date().toISOString().slice(0, 10)}`;
  const chargeResult = await processStripePayment(
    setting.amount || 0,
    stripeCustomerId,
    stripePaymentMethodId,
    {
      loanId: String(loan.id),
      trackingNumber: loan.trackingNumber,
      type: 'auto-pay',
    },
    idempotencyKey,
  );

  if (!chargeResult.success) {
    throw new Error(`Payment failed: ${chargeResult.error}`);
  }

  // Record payment in database
  const payment = await db.createPayment({
    loanApplicationId: loan.id,
    userId: user.id,
    amount: setting.amount,
    currency: 'USD',
    paymentProvider: 'stripe',
    paymentMethod: 'card',
    paymentIntentId: chargeResult.paymentIntentId || '',
    cardLast4: null,
    cardBrand: null,
    status: 'succeeded',
  });

  // Update auto-pay next payment date and reset failure count
  const nextPaymentDate = new Date();
  nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
  
  await db.updateAutoPaySetting(setting.id, {
    nextPaymentDate,
    failedAttempts: 0, // Reset failure count on success
  });

  // Send success email
  await sendPaymentReceiptEmail(
    user.email || '',
    user.firstName || 'User',
    loan.trackingNumber,
    setting.amount || 0,
    'card',
    undefined,
    undefined,
    chargeResult.paymentIntentId || ''
  );

  if (payment) {
    logger.info(`[Auto-Pay Scheduler] ✅ Successfully processed auto-pay ${setting.id}, payment ID: ${payment.id}, transaction: ${chargeResult.paymentIntentId}`);
  }
}

export function getSchedulerStatus() {
  return {
    isProcessing,
    lastRunTime,
    processedCount,
    failedCount,
  };
}

// Manual trigger for testing
export async function triggerManualAutoPayProcessing() {
  logger.info('[Auto-Pay Scheduler] Manual trigger requested');
  return await processAutoPayments();
}
