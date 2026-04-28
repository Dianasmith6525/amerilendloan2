/**
 * Auto-Pay Execution System
 * Automatically charges saved payment methods on due dates
 */

import { 
  getAutoPayEnabledLoans,
  wasPaymentAttemptedToday,
  getDefaultPaymentMethod,
  logAutoPayFailure,
  createPayment,
  getUserById,
  getLoanApplicationById
} from "../db";
import { processStripePayment } from "./stripe";
import { sendPaymentConfirmationEmail, sendPaymentFailedEmail } from "./email";
import { logger } from "./logger";

/**
 * Process all auto-pay scheduled payments
 * Should run daily via cron job
 */
export async function processAutoPay() {
  logger.info("[Auto-Pay] Starting auto-pay execution...");
  
  try {
    const now = new Date();
    
    // Get all loans with auto-pay enabled
    const autoPayLoans = await getAutoPayEnabledLoans();
    
    if (!autoPayLoans || autoPayLoans.length === 0) {
      logger.info("[Auto-Pay] No auto-pay enabled loans found");
      return { success: true, processed: 0, successful: 0, failed: 0 };
    }

    let processed = 0;
    let successful = 0;
    let failed = 0;
    
    for (const loan of autoPayLoans) {
      try {
        // Calculate next payment due
        const schedule = calculatePaymentSchedule(loan);
        const nextPayment = schedule.find(p => {
          const dueDate = new Date(p.dueDate);
          return dueDate <= now && !p.paid;
        });
        
        if (!nextPayment) {
          logger.info(`[Auto-Pay] No payment due for loan ${loan.id}`);
          continue;
        }
        
        // Check if payment was already attempted today
        const alreadyAttempted = await wasPaymentAttemptedToday(loan.id);
        if (alreadyAttempted) {
          logger.info(`[Auto-Pay] Payment already attempted today for loan ${loan.id}`);
          continue;
        }
        
        // Get user's default payment method
        const paymentMethod = await getDefaultPaymentMethod(loan.userId);
        if (!paymentMethod) {
          logger.info(`[Auto-Pay] No default payment method for loan ${loan.id}`);
          await logAutoPayFailure(loan.id, "No payment method");
          continue;
        }
        
        // Get user details
        const user = await getUserById(loan.userId);
        if (!user?.email) {
          logger.info(`[Auto-Pay] No user found for loan ${loan.id}`);
          continue;
        }
        
        processed++;
        
        // Execute payment based on method type
        let paymentResult;
        
        if (paymentMethod.type === 'card') {
          // Process card payment
          paymentResult = await processCardAutoPayment(
            loan,
            paymentMethod,
            nextPayment.amount,
            user
          );
        } else {
          logger.error(`[Auto-Pay] Unknown payment method type: ${paymentMethod.type}`);
          await logAutoPayFailure(loan.id, "Unknown payment method type");
          failed++;
          continue;
        }
        
        if (paymentResult.success) {
          successful++;
          logger.info(`[Auto-Pay] ✅ Successfully processed payment for loan ${loan.id}`);
          
          // Send confirmation email
          await sendPaymentConfirmationEmail(
            user.email,
            user.name || user.email,
            loan.trackingNumber,
            nextPayment.amount,
            paymentMethod.type === 'card' ? `${paymentMethod.cardBrand} ****${paymentMethod.last4}` : 'Payment Method'
          );
        } else {
          failed++;
          logger.info(`[Auto-Pay] ❌ Failed to process payment for loan ${loan.id}: ${paymentResult.error}`);
          
          // Log failure
          await logAutoPayFailure(loan.id, paymentResult.error || "Payment failed");
          
          // Send failure notification
          await sendPaymentFailedEmail(
            user.email,
            user.name || user.email,
            loan.trackingNumber,
            nextPayment.amount,
            paymentResult.error || "Payment processing failed"
          );
        }
        
      } catch (loanError) {
        logger.error(`[Auto-Pay] Error processing loan ${loan.id}:`, loanError);
        failed++;
        await logAutoPayFailure(loan.id, loanError instanceof Error ? loanError.message : "Unknown error");
      }
    }
    
    logger.info(`[Auto-Pay] Completed. Processed: ${processed}, Successful: ${successful}, Failed: ${failed}`);
    return { success: true, processed, successful, failed };
    
  } catch (error) {
    logger.error("[Auto-Pay] Fatal error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      processed: 0,
      successful: 0,
      failed: 0
    };
  }
}

/**
 * Process card auto-payment via Stripe
 */
async function processCardAutoPayment(
  loan: any,
  paymentMethod: any,
  amount: number,
  user: any
) {
  try {
    const amountDollars = amount / 100;
    
    // Use Stripe to process the payment
    // paymentMethod.token stores the Stripe payment method ID
    // paymentMethod.customerProfileId stores the Stripe customer ID (stored in customerProfileId field)
    const customerId = paymentMethod.customerProfileId || paymentMethod.token;
    const paymentMethodId = paymentMethod.paymentProfileId || paymentMethod.token;
    
    if (!customerId || !paymentMethodId) {
      return { success: false, error: "No Stripe payment method configured for auto-pay" };
    }

    // Idempotency key scoped to loan + day so retries cannot double-charge.
    const idempotencyKey = `autopay-exec:loan:${loan.id}:${new Date().toISOString().slice(0, 10)}`;
    const result = await processStripePayment(
      amountDollars,
      customerId,
      paymentMethodId,
      {
        userId: String(user.id),
        loanApplicationId: String(loan.id),
        type: "auto_payment",
      },
      idempotencyKey,
    );
    
    if (result.success) {
      // Record payment in database
      await createPayment({
        userId: user.id,
        loanApplicationId: loan.id,
        amount: amount,
        paymentMethod: 'card',
        status: 'succeeded',
        paymentIntentId: result.paymentIntentId || result.transactionId,
        cardLast4: paymentMethod.last4 || paymentMethod.cardLast4,
        cardBrand: paymentMethod.cardBrand
      });
      
      return { success: true, transactionId: result.paymentIntentId || result.transactionId };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    logger.error("[Auto-Pay] Stripe payment error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Card payment failed" 
    };
  }
}

// Removed processCryptoAutoPayment - crypto auto-pay not yet implemented

/**
 * Calculate payment schedule for a loan
 */
function calculatePaymentSchedule(loan: any) {
  if (!loan.approvedAmount || !loan.disbursedAt) return [];
  
  const loanAmount = loan.approvedAmount / 100;
  const interestRate = loan.interestRate || 5.5; // APR
  const loanTermYears = loan.termYears || 5;
  
  const monthlyRate = (interestRate / 100) / 12;
  const numPayments = loanTermYears * 12;
  
  // Monthly payment calculation (amortization)
  const monthlyPayment = loanAmount * 
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const schedule = [];
  const disbursedDate = new Date(loan.disbursedAt);
  
  for (let i = 1; i <= numPayments; i++) {
    const dueDate = new Date(disbursedDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    schedule.push({
      month: i,
      dueDate: dueDate.toISOString(),
      amount: Math.round(monthlyPayment * 100), // Convert to cents
      paid: false, // Would check against payment records in production
    });
  }
  
  return schedule;
}

export async function triggerAutoPayForLoan(loanId: number) {
  const loan = await getLoanApplicationById(loanId);
  if (!loan) throw new Error("Loan not found");
  
  const result = await processAutoPay();
  return { success: true, result };
}
