/**
 * SMS notification module using Twilio
 * Handles sending SMS messages including OTP codes
 */

import { ENV } from "./env";
import { logger } from "./logger";

/**
 * Send SMS using Twilio
 */
export async function sendSMS(to: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!ENV.twilioAccountSid || !ENV.twilioAuthToken || !ENV.twilioPhoneNumber) {
    logger.error("Twilio credentials not configured");
    return { success: false, error: "SMS service not configured" };
  }

  try {
    const auth = Buffer.from(`${ENV.twilioAccountSid}:${ENV.twilioAuthToken}`).toString('base64');
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ENV.twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: ENV.twilioPhoneNumber,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Twilio API error:', errorData);
      return { success: false, error: errorData.message || 'Failed to send SMS' };
    }

    const data = await response.json();
    logger.info(`SMS sent successfully to ${to}. SID: ${data.sid}`);
    return { success: true };
  } catch (error) {
    logger.error('Error sending SMS:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send OTP code via SMS
 */
export async function sendOTPSMS(phone: string, code: string, purpose: "signup" | "login" | "reset"): Promise<{ success: boolean; error?: string }> {
  const purposeText = purpose === "reset" ? "account recovery" : purpose;
  const message = `Your AmeriLend ${purposeText} verification code is: ${code}. This code will expire in 10 minutes.`;
  
  const result = await sendSMS(phone, message);
  
  if (!result.success) {
    logger.error(`Failed to send OTP SMS to ${phone}:`, result.error);
  }
  
  // Log OTP delivery (code redacted for security)
  if (process.env.NODE_ENV === "development") {
    logger.info(`[OTP] Code sent to ${phone.slice(0, 3)}****${phone.slice(-2)} for ${purposeText}`);
  }

  return result;
}

/**
 * Send notification SMS
 */
export async function sendNotificationSMS(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  return sendSMS(phone, message);
}

/**
 * Send payment overdue alert SMS (only SMS alert - more immediate than email)
 * NOTE: We only send SMS for critical alerts (overdue) to avoid SMS fatigue
 */
export async function sendPaymentOverdueAlertSMS(
  phone: string,
  loanNumber: string,
  daysOverdue: number,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const amountFormatted = (amount / 100).toFixed(2);
  const message = `URGENT: Your AmeriLend loan ${loanNumber} payment is ${daysOverdue} days overdue. Amount due: $${amountFormatted}. Act now to avoid fees. https://amerilendloan.com/payment-history`;
  
  return sendSMS(phone, message);
}

/**
 * Send critical delinquency alert SMS (30+ days overdue)
 */
export async function sendDelinquencyAlertSMS(
  phone: string,
  loanNumber: string,
  daysOverdue: number,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const amountFormatted = (amount / 100).toFixed(2);
  const message = `CRITICAL: Your AmeriLend loan ${loanNumber} is ${daysOverdue} days delinquent. Amount due: $${amountFormatted}. Contact support immediately: https://amerilendloan.com/support`;
  
  return sendSMS(phone, message);
}

/**
 * Send payment received confirmation SMS
 * NOTE: Only if user has SMS notifications enabled for confirmations
 */
export async function sendPaymentReceivedSMS(
  phone: string,
  loanNumber: string,
  paymentAmount: number
): Promise<{ success: boolean; error?: string }> {
  const amountFormatted = (paymentAmount / 100).toFixed(2);
  const message = `Your AmeriLend payment of $${amountFormatted} for loan ${loanNumber} has been received. Thank you!`;
  
  return sendSMS(phone, message);
}

/**
 * Send payment failed alert SMS
 */
export async function sendPaymentFailedSMS(
  phone: string,
  loanNumber: string,
  amount: number,
  failureReason: string
): Promise<{ success: boolean; error?: string }> {
  const amountFormatted = (amount / 100).toFixed(2);
  const message = `Payment failed for AmeriLend loan ${loanNumber}. Amount: $${amountFormatted}. Reason: ${failureReason}. Retry: https://amerilendloan.com/payment-history`;
  
  return sendSMS(phone, message);
}

/**
 * Send loan application approved SMS
 */
export async function sendLoanApprovedSMS(
  phone: string,
  loanNumber: string,
  approvedAmount: number
): Promise<{ success: boolean; error?: string }> {
  const amountFormatted = (approvedAmount / 100).toFixed(2);
  const message = `Good news! Your AmeriLend loan #${loanNumber} for $${amountFormatted} has been approved! Log in to complete next steps: https://amerilendloan.com/dashboard`;
  
  return sendSMS(phone, message);
}

/**
 * Send loan disbursement notification SMS
 */
export async function sendLoanDisbursedSMS(
  phone: string,
  loanNumber: string,
  disbursedAmount: number,
  disbursementMethod: string
): Promise<{ success: boolean; error?: string }> {
  const amountFormatted = (disbursedAmount / 100).toFixed(2);
  const methodText = disbursementMethod === "bank_transfer" ? "bank transfer" : 
                      disbursementMethod === "check" ? "check" :
                      disbursementMethod;
  const message = `Your AmeriLend loan #${loanNumber} of $${amountFormatted} has been disbursed via ${methodText}. Funds should arrive soon!`;
  
  return sendSMS(phone, message);
}

/**
 * Send payment reminder SMS (3 days before due)
 */
export async function sendPaymentReminderSMS(
  phone: string,
  loanNumber: string,
  amount: number,
  dueDate: string
): Promise<{ success: boolean; error?: string }> {
  const amountFormatted = (amount / 100).toFixed(2);
  const message = `Reminder: AmeriLend loan #${loanNumber} payment of $${amountFormatted} is due on ${dueDate}. Pay now: https://amerilendloan.com/payment-history`;
  
  return sendSMS(phone, message);
}
