/**
 * Email module using SendGrid
 * Handles sending emails including OTP codes
 */

import { ENV } from "./env";
import { getEmailHeader, getEmailFooter, COMPANY_INFO } from "./companyConfig";
import { getLocationFromIP } from "./geolocation";
import { logger } from "./logger";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Format currency amount with thousand separators
 * @param cents - Amount in cents
 * @returns Formatted string like "$10,000.00"
 */
function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Escape HTML special characters to prevent injection in email templates */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * In-memory 24-hour email deduplication.
 * Prevents sending the same email (same recipient + same subject) within 24 hours.
 * Key: "to|subject" → timestamp of last send.
 * 
 * NOTE: This cache is in-memory only and resets on server restart.
 * For production, consider backing with Redis (if REDIS_URL is set) for persistence.
 */
const recentEmails = new Map<string, number>();
const EMAIL_DEDUP_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Prune expired entries from the dedup cache */
function pruneEmailCache() {
  const now = Date.now();
  for (const [key, ts] of Array.from(recentEmails)) {
    if (now - ts > EMAIL_DEDUP_MS) recentEmails.delete(key);
  }
}

/**
 * Send email using SendGrid API
 */
export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  if (!ENV.sendGridApiKey) {
    logger.error("SendGrid API key not configured");
    logger.error("ENV.emailTestMode:", ENV.emailTestMode);
    logger.error("ENV.sendGridApiKey:", ENV.sendGridApiKey ? "SET (hidden)" : "NOT SET");
    return { success: false, error: "Email service not configured" };
  }

  // 24-hour deduplication: skip if same email+subject was sent recently
  // (skip dedup for OTP/verification codes — they have unique codes in the body, not subject)
  const isOTP = payload.subject.includes("Verification") || payload.subject.includes("Login Code") || payload.subject.includes("Reset Your Password");
  if (!isOTP) {
    const dedupKey = `${payload.to}|${payload.subject}`;
    const now = Date.now();
    const lastSent = recentEmails.get(dedupKey);
    if (lastSent && now - lastSent < EMAIL_DEDUP_MS) {
      const hoursAgo = ((now - lastSent) / (1000 * 60 * 60)).toFixed(1);
      logger.info(`[Email] Skipping duplicate email to ${payload.to} subject="${payload.subject}" (sent ${hoursAgo}h ago)`);
      return { success: true }; // Return success to avoid error handling upstream
    }
    // Prune old entries periodically
    if (recentEmails.size > 200) pruneEmailCache();
    recentEmails.set(dedupKey, now);
  }

  logger.info("Sending email via SendGrid", { to: payload.to });

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ENV.sendGridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: payload.to }],
            subject: payload.subject,
          },
        ],
        from: {
          email: ENV.sendGridVerifiedEmail,
          name: "AmeriLend",
        },
        reply_to: {
          email: ENV.sendGridVerifiedEmail,
          name: "AmeriLend Support",
        },
        content: [
          {
            type: "text/plain",
            value: payload.text,
          },
          {
            type: "text/html",
            value: payload.html,
          },
        ],
      }),
    });

    // Log full response details for debugging
    const messageId = response.headers.get('x-message-id');
    logger.info(`[SendGrid] Response: status=${response.status} statusText=${response.statusText} messageId=${messageId} to=${payload.to} from=${ENV.sendGridVerifiedEmail}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { errors: [{ message: errorText }] };
      }
      
      logger.error("SendGrid API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      // Provide helpful error messages based on status code
      if (response.status === 401) {
        logger.error("❌ SENDGRID AUTHENTICATION FAILED");
        logger.error("   Your SendGrid API key is invalid or not set");
        logger.error("   Check environment variable: SENDGRID_API_KEY");
        logger.error("   Get your API key from: https://app.sendgrid.com/settings/api_keys");
        return { success: false, error: "SendGrid API key is invalid. Please check your configuration." };
      }
      
      const errorMessage = errorData.errors?.[0]?.message || "Failed to send email";
      
      if (errorMessage.includes("not a verified sender") || errorMessage.includes("sender identity")) {
        logger.error("⚠️  SENDER NOT VERIFIED: You need to verify 'noreply@amerilendloan.com' in SendGrid");
        logger.error("   Go to: https://app.sendgrid.com/settings/sender_auth/senders");
        return { success: false, error: "Sender email not verified in SendGrid. Please verify noreply@amerilendloan.com" };
      }
      
      if (errorMessage.includes("Maximum credits exceeded") || errorMessage.includes("credits")) {
        logger.error("⚠️  SENDGRID CREDITS EXCEEDED: Check your SendGrid account billing");
        logger.error("   Go to: https://app.sendgrid.com/settings/billing");
      }
      
      return { success: false, error: errorMessage };
    }

    logger.info("Email sent successfully", { to: payload.to, messageId, status: response.status });
    return { success: true };
  } catch (error) {
    logger.error("Error sending email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Send OTP code via email using SendGrid
 */
export async function sendOTPEmail(email: string, code: string, purpose: "signup" | "login" | "reset"): Promise<void> {
  // Dev fallback: when EMAIL_TEST_MODE=true OR (NODE_ENV=development AND no SendGrid key),
  // log the OTP code to the server console instead of attempting an email send.
  // This lets developers exercise the full OTP login flow locally without SendGrid.
  const isDev = process.env.NODE_ENV !== "production";
  if (ENV.emailTestMode || (isDev && !ENV.sendGridApiKey)) {
    logger.info(
      `[OTP DEV MODE] purpose=${purpose} email=${email} code=${code} (email send skipped — set EMAIL_TEST_MODE=false and configure SENDGRID_API_KEY to send real emails)`,
    );
    return;
  }

  const purposes = {
    signup: {
      subject: "Verify Your Email - AmeriLend",
      title: "Email Verification",
      message: "Use this code to verify your email and complete your signup.",
    },
    login: {
      subject: "Your Login Code - AmeriLend",
      title: "Login Verification",
      message: "Use this code to login to your AmeriLend account.",
    },
    reset: {
      subject: "Reset Your Password - AmeriLend",
      title: "Password Reset",
      message: "Use this code to reset your password.",
    },
  };

  const { subject, title, message } = purposes[purpose];

  const text = `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f0f2f5;">
        <div style="background-color: #ffffff; overflow: hidden; box-shadow: 0 2px 20px rgba(0,0,0,0.08);">
          ${getEmailHeader()}
          <div style="padding: 35px 30px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #0033A0; margin: 0 0 8px 0; font-size: 22px; font-weight: 700;">${title}</h2>
              <p style="color: #666; margin: 0; font-size: 14px;">${message}</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #001a4d 0%, #0033A0 100%); color: white; padding: 28px; border-radius: 14px; text-align: center; margin: 24px 0; box-shadow: 0 4px 15px rgba(0,51,160,0.3);">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px;">Your verification code</p>
              <p style="margin: 0; font-size: 40px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</p>
            </div>
            
            <div style="text-align: center; margin: 20px 0;">
              <p style="color: #6b7280; font-size: 13px; margin: 0;">⏱ This code expires in <strong>10 minutes</strong></p>
            </div>
            
            <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; padding: 14px 18px; margin-top: 24px; text-align: center;">
              <p style="margin: 0; color: #92400e; font-size: 13px;">🔒 If you didn't request this code, you can safely ignore this email.</p>
            </div>
          </div>
          ${getEmailFooter()}
        </div>
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    logger.error(`[Email] Failed to send OTP verification email to ${email}:`, result.error);
    throw new Error(`Failed to send OTP verification email: ${result.error}`);
  }
}

/**
 * Send loan application received confirmation email
 */
export async function sendLoanApplicationReceivedEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  requestedAmount: number
): Promise<void> {
  const formattedAmount = formatCurrency(requestedAmount);
  const subject = "Loan Application Received - AmeriLend";
  const text = `Dear ${fullName},\n\nThank you for submitting your loan application to AmeriLend!\n\nYour application has been received and is now under review.\n\nApplication Details:\nTracking Number: ${trackingNumber}\nRequested Amount: $${formattedAmount}\n\nWhat's Next?\n- Our team will review your application within 24 hours\n- You'll receive an email notification once a decision is made\n- You can track your application status in your dashboard\n\nIf you have any questions, please contact our support team.\n\nBest regards,\nThe AmeriLend Team`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f0f2f5;">
        <div style="background-color: #ffffff; overflow: hidden; box-shadow: 0 2px 20px rgba(0,0,0,0.08);">
          ${getEmailHeader()}
          <div style="padding: 35px 30px;">
            <!-- Success Icon -->
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="display: inline-block; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 50%; width: 64px; height: 64px; line-height: 64px; font-size: 28px;">📋</div>
              <h2 style="color: #0033A0; margin: 12px 0 5px 0; font-size: 22px; font-weight: 700;">Application Received</h2>
              <p style="color: #888; margin: 0; font-size: 13px;">Your loan application is now under review</p>
            </div>

            <p style="color: #444; font-size: 15px;">Hi <strong>${fullName}</strong>,</p>
            <p style="color: #555; font-size: 14px;">Thank you for applying with AmeriLend. We've received your application and our underwriting team is reviewing it.</p>
            
            <!-- Application Details Card -->
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Tracking Number</td>
                  <td style="padding: 10px 0; color: #0033A0; font-size: 16px; font-weight: 700; font-family: 'Courier New', monospace; text-align: right;">${trackingNumber}</td>
                </tr>
                <tr><td colspan="2" style="border-bottom: 1px solid #e2e8f0;"></td></tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Requested Amount</td>
                  <td style="padding: 10px 0; color: #1e293b; font-size: 16px; font-weight: 700; text-align: right;">$${formattedAmount}</td>
                </tr>
                <tr><td colspan="2" style="border-bottom: 1px solid #e2e8f0;"></td></tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Status</td>
                  <td style="padding: 10px 0; text-align: right;">
                    <span style="background-color: #FFA500; color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;">Under Review</span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Next Steps -->
            <div style="margin: 24px 0;">
              <p style="color: #0033A0; font-weight: 700; font-size: 15px; margin: 0 0 14px 0;">What happens next?</p>
              <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                <div style="min-width: 28px; height: 28px; background: #0033A0; color: #fff; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px; font-weight: 700; margin-right: 12px;">1</div>
                <p style="margin: 4px 0 0 0; color: #555; font-size: 14px;">Our team reviews your application within <strong>24 hours</strong></p>
              </div>
              <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                <div style="min-width: 28px; height: 28px; background: #0033A0; color: #fff; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px; font-weight: 700; margin-right: 12px;">2</div>
                <p style="margin: 4px 0 0 0; color: #555; font-size: 14px;">You'll receive an email with our decision</p>
              </div>
              <div style="display: flex; align-items: flex-start;">
                <div style="min-width: 28px; height: 28px; background: #0033A0; color: #fff; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px; font-weight: 700; margin-right: 12px;">3</div>
                <p style="margin: 4px 0 0 0; color: #555; font-size: 14px;">Track real-time status on your <a href="${COMPANY_INFO.website}/dashboard" style="color: #0033A0; font-weight: 600; text-decoration: none;">dashboard</a></p>
              </div>
            </div>

            <p style="color: #888; font-size: 13px; margin-top: 24px; text-align: center;">Questions? Contact us at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0; text-decoration: none; font-weight: 600;">${COMPANY_INFO.contact.email}</a> or <a href="tel:${COMPANY_INFO.contact.phoneFormatted.replace(/\D/g, '')}" style="color: #0033A0; text-decoration: none; font-weight: 600;">${COMPANY_INFO.contact.phone}</a></p>
          </div>
          ${getEmailFooter()}
        </div>
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send loan application approved email
 */
export async function sendLoanApplicationApprovedEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  approvedAmount: number,
  processingFee: number
): Promise<void> {
  logger.debug("sendLoanApplicationApprovedEmail", { approvedAmount, processingFee });
  const formattedAmount = formatCurrency(approvedAmount);
  const formattedFee = formatCurrency(processingFee);
  const subject = "Your Loan Application Has Been Approved – AmeriLend";
  const text = `Dear ${fullName},\n\nYour loan application has been approved.\n\nApplication Details:\nTracking Number: ${trackingNumber}\nApproved Amount: $${formattedAmount}\nProcessing Fee: $${formattedFee}\n\nNext Steps:\n1. Sign in to your dashboard to review the loan agreement.\n2. Pay the processing fee to authorize disbursement.\n3. Funds are typically disbursed within 1\u20132 business days after the fee is received.\n\nIf you have any questions, contact our support team.\n\nRegards,\nThe AmeriLend Team`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #28a745; color: white; display: inline-block; padding: 10px 20px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              ✓ APPROVED
            </div>
          </div>
          <h2 style="color: #0033A0; margin-top: 0;">Your loan has been approved</h2>
          <p>Dear ${fullName},</p>
          <p>We are pleased to confirm that your loan application has been approved. Please review the details below and complete the next steps to release your funds.</p>
          
          <div style="background-color: white; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0033A0;">Approval Details</h3>
            <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
            <p style="margin: 5px 0;"><strong>Approved Amount:</strong> $${formattedAmount}</p>
            <p style="margin: 5px 0;"><strong>Processing Fee:</strong> $${formattedFee}</p>
          </div>

          <h3 style="color: #0033A0;">Next Steps</h3>
          <ol style="padding-left: 20px;">
            <li>Log in to your dashboard to review the loan agreement</li>
            <li>Pay the processing fee to proceed with disbursement</li>
            <li>Once the fee is paid, your funds will be disbursed within 1-2 business days</li>
          </ol>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.amerilendloan.com/dashboard" style="background-color: #FFA500; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Go to Dashboard</a>
          </div>

          <p style="margin-top: 30px;">Questions? Contact us at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send loan application rejected email
 */
export async function sendLoanApplicationRejectedEmail(
  email: string,
  fullName: string,
  trackingNumber: string
): Promise<void> {
  const subject = "Loan Application Update - AmeriLend";
  const text = `Dear ${fullName},\n\nThank you for your interest in AmeriLend.\n\nAfter careful review of your application (Tracking #${trackingNumber}), we regret to inform you that we are unable to approve your loan request at this time.\n\nThis decision was based on our standard lending criteria and does not reflect negatively on you personally.\n\nYou may reapply after 30 days or explore our other loan products that might better suit your current situation.\n\nIf you have questions about this decision, please contact our support team.\n\nBest regards,\nThe AmeriLend Team`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #0033A0; margin-top: 0;">Application Update</h2>
          <p>Dear ${fullName},</p>
          <p>Thank you for your interest in AmeriLend and for taking the time to submit your loan application.</p>
          
          <div style="background-color: white; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
            <p style="margin: 10px 0 0 0;">After careful review, we regret to inform you that we are unable to approve your loan request at this time.</p>
          </div>

          <p>This decision was based on our standard lending criteria and does not reflect negatively on you personally. Factors such as credit history, income verification, and debt-to-income ratio are considered in our review process.</p>

          <h3 style="color: #0033A0;">What You Can Do</h3>
          <ul style="padding-left: 20px;">
            <li>You may reapply after 30 days</li>
            <li>Explore our other loan products that might better suit your current situation</li>
            <li>Work on improving your credit profile and financial standing</li>
          </ul>

          <p style="margin-top: 30px;">If you have questions about this decision or would like to discuss alternative options, please contact our support team at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or call ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send loan application processing email (fee payment pending)
 */
export async function sendLoanApplicationProcessingEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  processingFee: number
): Promise<void> {
  const formattedFee = formatCurrency(processingFee);
  const subject = "Action Required: Complete Your Loan Processing - AmeriLend";
  const text = `Dear ${fullName},\n\nYour loan application (${trackingNumber}) is currently being processed!\n\nTo complete the disbursement process, please pay the processing fee of $${formattedFee}.\n\nProcessing Fee: $${formattedFee}\n\nOnce we receive your payment, your loan funds will be disbursed within 1-2 business days using your selected disbursement method.\n\nPlease log in to your dashboard to complete the payment.\n\nBest regards,\nThe AmeriLend Team`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #0033A0; margin-top: 0;">Action Required: Complete Payment</h2>
          <p>Dear ${fullName},</p>
          <p>Your loan application has been processed and is ready for disbursement once the processing fee is paid.</p>
          
          <div style="background-color: white; border-left: 4px solid #FFA500; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0033A0;">Processing Details</h3>
            <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
            <p style="margin: 5px 0;"><strong>Processing Fee:</strong> $${formattedFee}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Awaiting Payment</p>
          </div>

          <h3 style="color: #0033A0;">Next Steps</h3>
          <p>To complete the disbursement process, please pay the processing fee. Once we receive your payment, your loan funds will be disbursed within 1-2 business days using your selected disbursement method.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.amerilendloan.com/dashboard" style="background-color: #FFA500; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Pay Processing Fee</a>
          </div>

          <p style="margin-top: 30px;">Questions? Contact us at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send loan application cancelled/withdrawn email
 */
export async function sendLoanApplicationCancelledEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  requestedAmount: number
): Promise<void> {
  const formattedAmount = formatCurrency(requestedAmount * 100);
  const subject = "Application Withdrawn - AmeriLend";
  const text = `Dear ${fullName},\n\nYour loan application (Tracking #${trackingNumber}) for $${formattedAmount} has been successfully withdrawn at your request.\n\nIf you decide to apply again in the future, we'll be happy to assist you. Simply visit our website and submit a new application.\n\nIf this withdrawal was made in error or you have any questions, please contact our support team immediately.\n\nBest regards,\nThe AmeriLend Team`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #0033A0; margin-top: 0;">Application Withdrawn</h2>
          <p>Dear ${fullName},</p>
          <p>This confirms that your loan application has been successfully withdrawn at your request.</p>
          
          <div style="background-color: white; border-left: 4px solid #6c757d; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
            <p style="margin: 10px 0 0 0;"><strong>Requested Amount:</strong> $${formattedAmount}</p>
            <p style="margin: 10px 0 0 0;"><strong>Status:</strong> Cancelled</p>
          </div>

          <h3 style="color: #0033A0;">What This Means</h3>
          <p>Your application has been removed from our system and will not be processed further. No fees will be charged, and this withdrawal will not affect your credit score.</p>

          <h3 style="color: #0033A0;">Future Applications</h3>
          <p>If you decide to apply again in the future, we'll be happy to assist you. Simply visit our website and submit a new application whenever you're ready.</p>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Important:</strong> If this withdrawal was made in error or you have any questions, please contact our support team immediately at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
          </div>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * In-memory deduplication for login notification emails.
 * Prevents sending multiple login alerts to the same user within 2 minutes.
 */
const recentLoginNotifications = new Map<string, number>();

/**
 * Send login notification email (deduplicated — max once per 2 minutes per user)
 */
export async function sendLoginNotificationEmail(
  email: string,
  fullName: string,
  loginTime: Date,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  // Deduplicate: skip if we sent a login notification to this email in the last 2 minutes
  const now = Date.now();
  const lastSent = recentLoginNotifications.get(email);
  if (lastSent && now - lastSent < 120_000) {
    logger.info(`[Email] Skipping duplicate login notification for ${email} (sent ${Math.round((now - lastSent) / 1000)}s ago)`);
    return;
  }
  recentLoginNotifications.set(email, now);
  // Prune old entries every 50 entries to prevent memory leak
  if (recentLoginNotifications.size > 50) {
    for (const [key, ts] of Array.from(recentLoginNotifications)) {
      if (now - ts > 120_000) recentLoginNotifications.delete(key);
    }
  }
  const formattedTime = loginTime.toLocaleString('en-US', { 
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York'
  });

  // Get location from IP address
  let locationInfo = 'Unknown';
  if (ipAddress && ipAddress !== 'Unknown') {
    locationInfo = await getLocationFromIP(ipAddress);
  }
  
  // Parse user agent for device/browser info
  let deviceInfo = 'Unknown device';
  let browserInfo = 'Unknown browser';
  
  if (userAgent) {
    if (userAgent.includes('Windows')) deviceInfo = 'Windows PC';
    else if (userAgent.includes('Mac')) deviceInfo = 'Mac';
    else if (userAgent.includes('iPhone')) deviceInfo = 'iPhone';
    else if (userAgent.includes('iPad')) deviceInfo = 'iPad';
    else if (userAgent.includes('Android')) deviceInfo = 'Android device';
    
    if (userAgent.includes('Chrome')) browserInfo = 'Chrome';
    else if (userAgent.includes('Firefox')) browserInfo = 'Firefox';
    else if (userAgent.includes('Safari')) browserInfo = 'Safari';
    else if (userAgent.includes('Edge')) browserInfo = 'Edge';
  }
  
  const subject = "New Login to Your AmeriLend Account";
  const text = `Dear ${fullName},\n\nWe detected a new login to your AmeriLend account.\n\nLogin Details:\nTime: ${formattedTime} EST\nLocation: ${locationInfo}\nIP Address: ${ipAddress || 'Unknown'}\nDevice: ${deviceInfo}\nBrowser: ${browserInfo}\n\nIf this was you, no action is needed.\n\nIf you did not log in, please secure your account immediately by contacting our support team at support@amerilendloan.com or +1 (945) 212-1609.\n\nBest regards,\nThe AmeriLend Security Team`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f0f2f5;">
        <div style="background-color: #ffffff; border-radius: 0; overflow: hidden; box-shadow: 0 2px 20px rgba(0,0,0,0.08);">
          ${getEmailHeader()}
          
          <div style="padding: 35px 30px;">
            <!-- Security Badge -->
            <div style="text-align: center; margin-bottom: 25px;">
              <div style="display: inline-block; background: linear-gradient(135deg, #e8f4fd 0%, #d1ecf1 100%); border-radius: 50%; width: 64px; height: 64px; line-height: 64px; font-size: 28px; margin-bottom: 10px;">🔒</div>
              <h2 style="color: #0033A0; margin: 10px 0 5px 0; font-size: 22px; font-weight: 700;">New Login Detected</h2>
              <p style="color: #888; margin: 0; font-size: 13px;">We noticed a new sign-in to your account</p>
            </div>
            
            <p style="color: #444; font-size: 15px;">Hi <strong>${fullName}</strong>,</p>
            <p style="color: #555; font-size: 14px;">A new login was recorded on your AmeriLend account. Here are the details:</p>
            
            <!-- Login Details Card -->
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 13px; width: 110px; vertical-align: top;">
                    <span style="display: inline-block; width: 20px;">🕐</span> Time
                  </td>
                  <td style="padding: 10px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${formattedTime} EST</td>
                </tr>
                <tr><td colspan="2" style="border-bottom: 1px solid #e2e8f0;"></td></tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 13px; vertical-align: top;">
                    <span style="display: inline-block; width: 20px;">📍</span> Location
                  </td>
                  <td style="padding: 10px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${locationInfo}</td>
                </tr>
                <tr><td colspan="2" style="border-bottom: 1px solid #e2e8f0;"></td></tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 13px; vertical-align: top;">
                    <span style="display: inline-block; width: 20px;">💻</span> Device
                  </td>
                  <td style="padding: 10px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${deviceInfo} · ${browserInfo}</td>
                </tr>
                <tr><td colspan="2" style="border-bottom: 1px solid #e2e8f0;"></td></tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 13px; vertical-align: top;">
                    <span style="display: inline-block; width: 20px;">🌐</span> IP
                  </td>
                  <td style="padding: 10px 0; color: #1e293b; font-size: 14px; font-family: 'Courier New', monospace;">${ipAddress || 'Unknown'}</td>
                </tr>
              </table>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; gap: 12px; margin: 28px 0;">
              <div style="flex: 1; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #a7f3d0; border-radius: 10px; padding: 16px; text-align: center;">
                <p style="margin: 0; font-size: 15px; font-weight: 700; color: #065f46;">✓ Was this you?</p>
                <p style="margin: 6px 0 0 0; color: #047857; font-size: 13px;">No action needed!</p>
              </div>
            </div>
            
            <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 1px solid #fecaca; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 15px; font-weight: 700; color: #991b1b;">⚠ Didn't recognize this?</p>
              <p style="margin: 6px 0 0 0; color: #b91c1c; font-size: 13px;">
                Contact us immediately at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #b91c1c; font-weight: 600;">${COMPANY_INFO.contact.email}</a>
                or call <a href="tel:${COMPANY_INFO.contact.phoneFormatted.replace(/\D/g, '')}" style="color: #b91c1c; font-weight: 600;">${COMPANY_INFO.contact.phone}</a>
              </p>
            </div>

            <!-- Security Tips -->
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
              <p style="color: #0033A0; font-weight: 700; font-size: 14px; margin: 0 0 12px 0;">🛡 Security Tips</p>
              <table style="width: 100%;">
                <tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">• Never share your verification codes with anyone</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">• Use a strong, unique password for your account</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">• Always log out on shared or public devices</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">• Report suspicious activity immediately</td></tr>
              </table>
            </div>
          </div>
          
          ${getEmailFooter()}
        </div>
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}
export async function sendLoanApplicationMoreInfoEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  infoNeeded: string
): Promise<void> {
  const subject = "Additional Information Required - AmeriLend";
  const text = `Dear ${fullName},\n\nWe're reviewing your loan application (${trackingNumber}) and need some additional information to proceed.\n\nInformation Needed:\n${infoNeeded}\n\nPlease log in to your dashboard to provide the requested information. This will help us process your application more quickly.\n\nIf you have any questions, please contact our support team.\n\nBest regards,\nThe AmeriLend Team`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #0033A0; margin-top: 0;">Additional Information Required</h2>
          <p>Dear ${fullName},</p>
          <p>We're reviewing your loan application and need some additional information to proceed with the approval process.</p>
          
          <div style="background-color: white; border-left: 4px solid #FFA500; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0033A0;">Application Details</h3>
            <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Additional Information Needed</p>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #856404;">Information Needed:</h3>
            <p style="margin: 0; white-space: pre-line;">${infoNeeded}</p>
          </div>

          <p>Please log in to your dashboard to provide the requested information. This will help us process your application more quickly and efficiently.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.amerilendloan.com/dashboard" style="background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Go to Dashboard</a>
          </div>

          <p style="margin-top: 30px;">If you have any questions or need clarification, please contact our support team at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or call ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <p>${message.replace(/\n/g, "<br>")}</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;
  
  return sendEmail({
    to,
    subject,
    text: message,
    html,
  });
}

/**
 * Send email change notification
 */
export async function sendEmailChangeNotification(
  oldEmail: string,
  newEmail: string,
  userName: string
): Promise<void> {
  const subject = "Email Address Change Notification";
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #0033A0; margin-top: 0;">Email Address Change</h2>
          <p>Dear ${userName},</p>
          <p>Your email address on your AmeriLend account has been successfully changed.</p>
          
          <div style="background-color: white; border-left: 4px solid #0033A0; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Previous Email:</strong> ${oldEmail}</p>
            <p style="margin: 5px 0;"><strong>New Email:</strong> ${newEmail}</p>
            <p style="margin: 5px 0; font-size: 12px; color: #666;">This change was made on ${new Date().toLocaleDateString()}</p>
          </div>

          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #155724;"><strong>If you did not make this change,</strong> please contact our support team immediately at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #155724;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
          </div>

          <p>This is a security notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const text = `Email Address Changed\n\nPrevious Email: ${oldEmail}\nNew Email: ${newEmail}\n\nIf you did not make this change, please contact support immediately.`;

  // Send to old email
  await sendEmail({
    to: oldEmail,
    subject,
    text,
    html,
  });

  // Send to new email
  await sendEmail({
    to: newEmail,
    subject,
    text,
    html,
  });
}

/**
 * Send bank info change notification
 */
export async function sendBankInfoChangeNotification(
  email: string,
  userName: string
): Promise<void> {
  const subject = "Bank Account Information Updated";
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #0033A0; margin-top: 0;">Bank Account Information Updated</h2>
          <p>Dear ${userName},</p>
          <p>Your bank account information has been successfully updated for loan disbursement.</p>
          
          <div style="background-color: white; border-left: 4px solid #FFA500; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0033A0;">Account Update Details</h3>
            <p style="margin: 5px 0;">Your new bank account information is now active and will be used for any future loan disbursements.</p>
            <p style="margin: 5px 0; font-size: 12px; color: #666;">Update time: ${new Date().toLocaleDateString()}</p>
          </div>

          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #155724;"><strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #155724;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
          </div>

          <p>This is a security notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const text = `Bank Account Information Updated\n\nYour bank account information has been successfully updated. If you did not make this change, please contact support immediately.`;

  await sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}

/**
 * Send suspicious activity alert
 */
export async function sendSuspiciousActivityAlert(
  email: string,
  userName: string,
  activityDescription: string,
  ipAddress?: string
): Promise<void> {
  const subject = "Security Alert: Unusual Account Activity";
  
  // Resolve location from IP address
  let locationInfo = 'Unknown Location';
  if (ipAddress && ipAddress !== 'Unknown') {
    locationInfo = await getLocationFromIP(ipAddress);
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">⚠️ Security Alert</h1>
        </div>
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #dc3545; margin-top: 0;">Unusual Account Activity Detected</h2>
          <p>Dear ${userName},</p>
          <p>We detected unusual activity on your AmeriLend account. Please review the details below:</p>
          
          <div style="background-color: #ffe6e6; border: 2px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #dc3545;">Activity Details</h3>
            <p style="margin: 5px 0;"><strong>Activity:</strong> ${activityDescription}</p>
            <p style="margin: 5px 0;"><strong>📍 Location:</strong> ${locationInfo}</p>
            ${ipAddress ? `<p style="margin: 5px 0;"><strong>🌐 IP Address:</strong> ${ipAddress}</p>` : ''}
            <p style="margin: 5px 0;"><strong>🕐 Time:</strong> ${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })} EST</p>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #856404;">What Should You Do?</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
              <li>Review your recent account activity</li>
              <li>If this wasn't you, change your password immediately</li>
              <li>Contact our support team if you have concerns</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.amerilendloan.com/settings" style="background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Review Account Settings</a>
          </div>

          <p>If you believe this activity is unauthorized, please contact our support team immediately at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const text = `Security Alert: Unusual Account Activity\n\n${activityDescription}\n\nIf this wasn't you, please change your password and contact support immediately.`;

  await sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}

/**
 * Send admin decision notification - Application Approved
 */
export async function sendApplicationApprovedNotificationEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  approvedAmount: number,
  processingFee: number,
  adminNotes?: string
): Promise<void> {
  const formattedAmount = formatCurrency(approvedAmount);
  const formattedFee = formatCurrency(processingFee);
  const subject = "✓ Loan Application Approved – Action Required – AmeriLend";
  
  const text = `Dear ${fullName},\n\nYour loan application has been approved.\n\nApplication Details:\nTracking Number: ${trackingNumber}\nApproved Amount: $${formattedAmount}\nProcessing Fee: $${formattedFee}\n\n${adminNotes ? `Notes from our team: ${adminNotes}\n\n` : ''}Next Steps:\n1. Sign in to your dashboard.\n2. Review and sign the loan agreement.\n3. Pay the processing fee ($${formattedFee}).\n4. Once the fee is received, funds are typically disbursed within 1\u20132 business days.\n\nPlease complete these steps within 7 days to keep your approval valid.\n\nRegards,\nThe AmeriLend Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #28a745; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 20px; font-weight: bold;">
              ✓ APPLICATION APPROVED
            </div>
          </div>
          <h2 style="color: #0033A0; margin-top: 10px;">Your loan has been approved, ${fullName}</h2>
          <p style="font-size: 16px; color: #555;">We are pleased to confirm that your loan application has been approved. Please review the details below and complete the next steps to release your funds.</p>
          
          <div style="background-color: white; border-left: 6px solid #28a745; padding: 20px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #0033A0; border-bottom: 2px solid #0033A0; padding-bottom: 10px;">Approval Details</h3>
            <table style="width: 100%; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Tracking Number:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-family: monospace;">${trackingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Approved Amount:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; color: #28a745;"><strong>$${formattedAmount}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Processing Fee:</strong></td>
                <td style="padding: 8px 0; text-align: right;">$${formattedFee}</td>
              </tr>
            </table>
          </div>

          ${adminNotes ? `<div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 15px; margin: 20px 0;">
            <p style="margin-top: 0; color: #0033A0;"><strong>Admin Notes:</strong></p>
            <p style="margin-bottom: 0; color: #555;">${adminNotes}</p>
          </div>` : ''}

          <h3 style="color: #0033A0; margin-top: 30px;">What's Next?</h3>
          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <ol style="margin: 0; padding-left: 20px; line-height: 2;">
              <li style="margin: 10px 0;"><strong>Log in to your dashboard</strong> to review your loan details</li>
              <li style="margin: 10px 0;"><strong>Review and sign</strong> the loan agreement</li>
              <li style="margin: 10px 0;"><strong>Pay the processing fee</strong> of $${formattedFee}</li>
              <li style="margin: 10px 0;"><strong>Wait for disbursement</strong> - funds will arrive in 1-2 business days</li>
            </ol>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.amerilendloan.com/dashboard" style="background-color: #FFA500; color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Go to Dashboard</a>
          </div>

          <div style="background-color: #fff9e6; border: 1px solid #ffe680; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #856404; font-size: 14px;">⏰ <strong>Time-sensitive:</strong> Please complete the payment within 7 days to maintain this approval.</p>
          </div>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">Questions? Contact us at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send admin decision notification - Application Rejected
 */
export async function sendApplicationRejectedNotificationEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  rejectionReason: string
): Promise<void> {
  const subject = "Loan Application Decision - AmeriLend";
  
  const text = `Dear ${fullName},\n\nThank you for your interest in AmeriLend.\n\nAfter careful review of your application (Tracking #${trackingNumber}), we regret to inform you that we are unable to approve your loan request at this time.\n\nReason:\n${rejectionReason}\n\nNext Steps:\n- You may reapply after 30 days\n- Consider addressing the issues mentioned above before reapplying\n- Explore our other loan products that might better suit your current situation\n\nIf you have questions about this decision or would like to discuss alternative options, please contact our support team.\n\nBest regards,\nThe AmeriLend Team`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #dc3545; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              APPLICATION DECISION
            </div>
          </div>
          <h2 style="color: #0033A0; margin-top: 10px;">Application Decision Update</h2>
          <p>Dear ${fullName},</p>
          <p>Thank you for your interest in AmeriLend and for submitting your loan application. We appreciate the opportunity to review your request.</p>
          
          <div style="background-color: #f8d7da; border-left: 6px solid #dc3545; padding: 20px; margin: 30px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #dc3545;">Application Tracking Number</h3>
            <p style="margin: 0; font-family: monospace; font-size: 18px; font-weight: bold;">${trackingNumber}</p>
          </div>

          <div style="background-color: white; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #dc3545;">Decision Reason</h3>
            <p style="margin: 0; line-height: 1.8; color: #555;">${rejectionReason}</p>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">What You Can Do</h3>
          <ul style="padding-left: 20px; line-height: 1.8;">
            <li><strong>Reapply after 30 days</strong> - You may submit a new application after this period</li>
            <li><strong>Address the issues</strong> mentioned above before your next application</li>
            <li><strong>Explore alternatives</strong> - We have other loan products that may be suitable for you</li>
            <li><strong>Build your profile</strong> - Work on improving your credit score and financial standing</li>
          </ul>

          <div style="background-color: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h4 style="margin-top: 0; color: #0033A0;">We Value Your Business</h4>
            <p style="margin-bottom: 0; color: #555;">We'd love to help you in the future. Our support team is here if you'd like to discuss your options or have questions about our other loan products.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.amerilendloan.com/loans" style="background-color: #0033A0; color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Explore Our Products</a>
          </div>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">Have questions? Contact our support team at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send admin decision notification - Loan Disbursed
 */
export async function sendApplicationDisbursedNotificationEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  disbursedAmount: number,
  estimatedArrivalDate: string
): Promise<void> {
  const formattedAmount = formatCurrency(disbursedAmount);
  const subject = "Your Loan Has Been Disbursed – AmeriLend";
  
  const text = `Dear ${fullName},\n\nYour loan funds have been disbursed.\n\nDisbursement Details:\nTracking Number: ${trackingNumber}\nDisbursed Amount: $${formattedAmount}\nEstimated Arrival: ${estimatedArrivalDate}\n\nFunds typically appear in your bank account within 1\u20132 business days. Some banks may take an additional day to post the deposit.\n\nWhat to do next:\n- Check your bank account for the deposit.\n- Sign in to your dashboard to view your loan details and payment schedule.\n- Contact us if you have not received the funds within 2 business days.\n\nRegards,\nThe AmeriLend Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #28a745; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 20px; font-weight: bold;">
              FUNDS DISBURSED
            </div>
          </div>
          <h2 style="color: #0033A0; margin-top: 10px;">Your loan has been disbursed</h2>
          <p style="font-size: 16px; color: #555;">Dear ${fullName}, your loan funds have been sent to your bank account.</p>
          
          <div style="background-color: #d4edda; border-left: 6px solid #28a745; padding: 20px; margin: 30px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #28a745;">Disbursement Confirmed</h3>
            <table style="width: 100%; margin-top: 15px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #c3e6cb;"><strong>Tracking Number:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #c3e6cb; text-align: right; font-family: monospace;">${trackingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #c3e6cb;"><strong>Amount Disbursed:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #c3e6cb; text-align: right; font-size: 18px; font-weight: bold; color: #28a745;">$${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0;"><strong>Estimated Arrival:</strong></td>
                <td style="padding: 10px 0; text-align: right;">${estimatedArrivalDate}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #856404;"><strong>📌 Important:</strong> Your funds should appear in your bank account within 1-2 business days. Some banks may take an additional day to process deposits.</p>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">What You Should Know</h3>
          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <ul style="margin: 0; padding-left: 20px; line-height: 2;">
              <li><strong>Monitor your account</strong> - Check your bank account for the deposit</li>
              <li><strong>Payment schedule</strong> - Your loan payments will begin according to your agreement</li>
              <li><strong>View your dashboard</strong> - Log in to see your payment schedule and account details</li>
              <li><strong>Contact us</strong> - If funds don't arrive within 2 business days, reach out immediately</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.amerilendloan.com/dashboard" style="background-color: #FFA500; color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">View Your Account</a>
          </div>

          <div style="background-color: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h4 style="margin-top: 0; color: #0033A0;">Thank you for choosing AmeriLend</h4>
            <p style="margin-bottom: 0; color: #555;">If you have any questions about your loan or need assistance, our support team is available during business hours.</p>
          </div>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">Need help? Contact us at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send admin notification for new loan application submission
 */
export async function sendAdminNewApplicationNotification(
  fullName: string,
  email: string,
  trackingNumber: string,
  requestedAmount: number,
  loanType: string,
  phone: string,
  employmentStatus: string,
  applicationId?: number
): Promise<void> {
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(requestedAmount / 100);

  const subject = `🆕 New Loan Application - ${fullName} - ${formattedAmount} [${trackingNumber}]`;
  const text = `A new loan application has been submitted.\n\nApplicant: ${fullName}\nEmail: ${email}\nPhone: ${phone}\nTracking: ${trackingNumber}\nLoan Type: ${loanType}\nAmount: ${formattedAmount}\nEmployment: ${employmentStatus}\n\nPlease review and take action.`;

  // Generate approve/reject action tokens if applicationId is available
  let approveUrl = "";
  let rejectUrl = "";
  if (applicationId) {
    try {
      const { generateAdminActionToken } = await import("./admin-email-actions");
      const approveToken = generateAdminActionToken(applicationId, "approve");
      const rejectToken = generateAdminActionToken(applicationId, "reject");
      const baseUrl = COMPANY_INFO.website;
      approveUrl = `${baseUrl}/api/admin-action/approve/${approveToken}`;
      rejectUrl = `${baseUrl}/api/admin-action/reject/${rejectToken}`;
    } catch (err) {
      logger.error("[Email] Failed to generate admin action tokens:", err);
    }
  }

  const actionButtonsHtml = approveUrl && rejectUrl ? `
          <!-- Quick Action Buttons -->
          <div style="margin: 30px 0; padding: 24px; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-radius: 12px; border: 1px solid #bbf7d0; text-align: center;">
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #166534; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">⚡ Quick Actions from Email</p>
            <p style="margin: 0 0 18px 0; font-size: 13px; color: #6B7280;">Take action instantly — no dashboard login required</p>
            <div style="display: inline-block;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${approveUrl}" style="height:44px;v-text-anchor:middle;width:180px;" arcsize="18%" strokecolor="#059669" fillcolor="#059669">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">✅ Approve</center>
              </v:roundrect>
              <![endif]-->
              <a href="${approveUrl}" style="display: inline-block; padding: 12px 32px; background-color: #059669; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; margin: 0 8px;">✅ Approve Application</a>
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${rejectUrl}" style="height:44px;v-text-anchor:middle;width:180px;" arcsize="18%" strokecolor="#DC2626" fillcolor="#DC2626">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">❌ Reject</center>
              </v:roundrect>
              <![endif]-->
              <a href="${rejectUrl}" style="display: inline-block; padding: 12px 32px; background-color: #DC2626; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; margin: 0 8px;">❌ Reject Application</a>
            </div>
            <p style="margin: 14px 0 0 0; font-size: 11px; color: #9CA3AF;">Links expire in 72 hours. Rejection will prompt for a reason.</p>
          </div>
  ` : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Alert Banner -->
          <div style="background: linear-gradient(135deg, #FFA500 0%, #FF8C00 100%); padding: 16px 24px; text-align: center;">
            <p style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 700;">🔔 NEW APPLICATION REQUIRES YOUR REVIEW</p>
          </div>

          <div style="padding: 30px;">
            <!-- Application Summary Card -->
            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #bfdbfe;">
              <div style="text-align: center; margin-bottom: 16px;">
                <span style="display: inline-block; background-color: #0033A0; color: #ffffff; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">TRACKING: ${trackingNumber}</span>
              </div>
              <div style="text-align: center;">
                <p style="margin: 0 0 4px 0; font-size: 32px; font-weight: 800; color: #0033A0;">${formattedAmount}</p>
                <p style="margin: 0; font-size: 14px; color: #6B7280;">${loanType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} Loan</p>
              </div>
            </div>

            <!-- Applicant Details -->
            <h2 style="margin: 0 0 16px 0; font-size: 16px; color: #111827; border-bottom: 2px solid #0033A0; padding-bottom: 8px;">👤 Applicant Information</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #6B7280; font-size: 13px; width: 140px;">Full Name</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #111827; font-size: 14px; font-weight: 600;">${fullName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #6B7280; font-size: 13px;">Email</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #111827; font-size: 14px;"><a href="mailto:${email}" style="color: #0033A0; text-decoration: none;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #6B7280; font-size: 13px;">Phone</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #111827; font-size: 14px;"><a href="tel:${phone}" style="color: #0033A0; text-decoration: none;">${phone}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #6B7280; font-size: 13px;">Employment</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #111827; font-size: 14px;">${employmentStatus.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; color: #6B7280; font-size: 13px;">Submitted</td>
                <td style="padding: 10px 12px; color: #111827; font-size: 14px;">${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
              </tr>
            </table>

            ${actionButtonsHtml}

            <!-- Dashboard Link -->
            <div style="text-align: center; margin: 24px 0;">
              <a href="${COMPANY_INFO.website}/admin" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #0033A0 0%, #0050d4 100%); color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px;">📊 Open Admin Dashboard</a>
            </div>

            <!-- Next Steps -->
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-top: 20px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">📋 Review Checklist</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #6B7280; vertical-align: top; width: 24px;">1.</td>
                  <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Verify applicant identity and documentation</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #6B7280; vertical-align: top;">2.</td>
                  <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Review credit history and employment status</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #6B7280; vertical-align: top;">3.</td>
                  <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">Approve or reject using buttons above or via dashboard</td>
                </tr>
              </table>
            </div>

            <p style="margin: 24px 0 0 0; color: #9CA3AF; font-size: 12px; text-align: center;">This is an automated admin notification. Do not forward this email — it contains secure action links.</p>
          </div>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: COMPANY_INFO.admin.email, subject, text, html });
}

export async function sendAdminDocumentUploadNotification(
  userName: string,
  userEmail: string,
  documentType: string,
  fileName: string,
  uploadedAt: Date
): Promise<void> {
  const documentTypeLabels: Record<string, string> = {
    "drivers_license_front": "Driver's License (Front)",
    "drivers_license_back": "Driver's License (Back)",
    "passport": "Passport",
    "national_id_front": "National ID (Front)",
    "national_id_back": "National ID (Back)",
    "ssn_card": "Social Security Card",
    "bank_statement": "Bank Statement",
    "utility_bill": "Utility Bill",
    "pay_stub": "Pay Stub",
    "tax_return": "Tax Return",
    "other": "Other Document",
  };

  const documentLabel = documentTypeLabels[documentType] || documentType;
  const formattedDate = uploadedAt.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  const subject = `New Document Uploaded - ${documentLabel} [${userName}]`;
  const text = `A new verification document has been uploaded by ${userName}.\n\nUser Information:\nName: ${userName}\nEmail: ${userEmail}\n\nDocument Details:\nType: ${documentLabel}\nFile Name: ${fileName}\nUploaded: ${formattedDate}\n\nAction Required:\nPlease review this document in your admin dashboard for verification.`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f9f9f9; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .section { margin: 20px 0; }
          .label { color: #0033A0; font-weight: bold; }
          .alert { background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 15px; margin: 20px 0; border-radius: 4px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { text-align: left; padding: 10px; border-bottom: 1px solid #ddd; }
          th { background-color: #f5f5f5; font-weight: bold; color: #0033A0; }
          .cta-button { display: inline-block; background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
          .badge { display: inline-block; background-color: #28a745; color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        ${getEmailHeader()}
        <div class="container">
          <div class="header">
            <h1 style="color: #0033A0; margin: 0;">New Document Uploaded</h1>
            <p style="color: #666; margin-top: 5px;">Review and verification required</p>
          </div>

          <div class="alert">
            <strong>📄 A new verification document has been submitted by ${userName}.</strong>
          </div>

          <div class="section">
            <h2 style="color: #0033A0; border-bottom: 2px solid #0033A0; padding-bottom: 10px;">User Information</h2>
            <table>
              <tr>
                <td><span class="label">Name:</span></td>
                <td>${userName}</td>
              </tr>
              <tr>
                <td><span class="label">Email:</span></td>
                <td>${userEmail}</td>
              </tr>
            </table>
          </div>

          <div class="section">
            <h2 style="color: #0033A0; border-bottom: 2px solid #0033A0; padding-bottom: 10px;">Document Details</h2>
            <table>
              <tr>
                <td><span class="label">Document Type:</span></td>
                <td><span class="badge">${documentLabel}</span></td>
              </tr>
              <tr>
                <td><span class="label">File Name:</span></td>
                <td>${fileName}</td>
              </tr>
              <tr>
                <td><span class="label">Uploaded At:</span></td>
                <td>${formattedDate}</td>
              </tr>
            </table>
          </div>

          <div class="section" style="background-color: #f9f9f9; padding: 20px; border-radius: 4px; margin-top: 20px;">
            <h3 style="margin-top: 0; color: #0033A0;">Verification Checklist:</h3>
            <ul style="color: #555;">
              <li>Check document authenticity and clarity</li>
              <li>Verify document matches applicant information</li>
              <li>Ensure document is current and valid</li>
              <li>Approve or reject with appropriate feedback</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <p>
              <a href="${COMPANY_INFO.website}/admin/verification" class="cta-button">Review Documents</a>
            </p>
          </div>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">This is an automated notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: COMPANY_INFO.admin.email, subject, text, html });
}

/**
 * Send signup welcome email to new users
 */
export async function sendSignupWelcomeEmail(
  email: string,
  fullName: string
): Promise<void> {
  const subject = "Welcome to AmeriLend";
  const text = `Dear ${fullName},\n\nThank you for creating an AmeriLend account.\n\nYou can now sign in to your dashboard and submit a loan application.\n\nNext Steps:\n1. Sign in to your dashboard.\n2. Complete your loan application.\n3. Upload the required identification and income documents.\n4. Wait for your approval decision.\n\nIf you need help at any point, contact our support team at support@amerilendloan.com or call (945) 212-1609.\n\nRegards,\nThe AmeriLend Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #0033A0; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              Welcome to AmeriLend
            </div>
          </div>

          <h2 style="color: #0033A0; margin-top: 10px;">Welcome, ${fullName}</h2>
          <p style="font-size: 16px; color: #555;">Your AmeriLend account has been created. You can now sign in to your dashboard and apply for a loan.</p>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">What you can do with your account</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Apply for an installment or short-term loan</li>
              <li>Track the status of your application in real time</li>
              <li>Upload identification and income documents securely</li>
              <li>Manage payments and view your repayment schedule</li>
              <li>Reach our customer support team during business hours</li>
            </ul>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">Next steps</h3>
          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <ol style="margin: 0; padding-left: 20px; line-height: 2;">
              <li style="margin: 10px 0;"><strong>Complete your application</strong> – tell us about yourself and how much you need.</li>
              <li style="margin: 10px 0;"><strong>Upload your documents</strong> – a government-issued ID and proof of income.</li>
              <li style="margin: 10px 0;"><strong>Receive your decision</strong> – most applications are reviewed within 24 hours.</li>
            </ol>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.amerilendloan.com/dashboard" style="background-color: #FFA500; color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Go to your dashboard</a>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">Need help?</h3>
          <p style="color: #555;">Our support team is available during business hours. You can reach us at:</p>
          <ul style="padding-left: 20px;">
            <li>Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a></li>
            <li>Phone: <span style="color: #0033A0; font-weight: bold;">(945) 212-1609</span></li>
            <li>Hours: Monday–Friday 8am–8pm CT, Saturday–Sunday 9am–5pm CT</li>
          </ul>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">Thank you for choosing AmeriLend.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    logger.warn(`[Email] Failed to send signup welcome email to ${email}`, { error: result.error });
  }
}

/**
 * Send job application notification email to user
 */
export async function sendJobApplicationConfirmationEmail(
  email: string,
  fullName: string,
  position: string
): Promise<void> {
  const safeName = escapeHtml(fullName);
  const safePosition = escapeHtml(position);
  const subject = "Job Application Received – AmeriLend Careers";
  const text = `Dear ${fullName},\n\nThank you for applying for the ${position} position at AmeriLend.\n\nWe have received your application and our HR team is reviewing it.\n\nWhat happens next:\n- Our HR team will review your application against the requirements for the role.\n- If your background is a match, we will contact you to arrange an interview.\n- You can typically expect to hear back within 5\u20137 business days.\n\nIf you have any questions in the meantime, you can reach us at careers@amerilendloan.com.\n\nRegards,\nThe AmeriLend Recruiting Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #0033A0; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              ✓ Application Received
            </div>
          </div>

          <h2 style="color: #0033A0; margin-top: 10px;">Thank you for applying</h2>
          <p style="font-size: 16px; color: #555;">Dear ${safeName},</p>
          <p style="font-size: 16px; color: #555;">Thank you for your interest in joining AmeriLend. We have received your application for the <strong>${safePosition}</strong> position and our HR team is reviewing it.</p>

          <div style="background-color: white; border-left: 4px solid #0033A0; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">Position Applied For</h3>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #0033A0;">${safePosition}</p>
          </div>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">What Happens Next?</h3>
            <ol style="margin: 0; padding-left: 20px; line-height: 2;">
              <li style="margin: 10px 0;">Our HR team will carefully review your application</li>
              <li style="margin: 10px 0;">If your qualifications match our needs, we will contact you for an interview</li>
              <li style="margin: 10px 0;">You can expect to hear from us within <strong>5-7 business days</strong></li>
            </ol>
          </div>

          <div style="background-color: #fff9e6; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #856404;"><strong>Please monitor your email</strong> – future updates from our recruiting team will arrive at this address. Check your spam or promotions folder if you do not see them.</p>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">Questions about your application</h3>
          <p style="color: #555;">You can reach our HR team at:</p>
          <ul style="padding-left: 20px;">
            <li>Email: <a href="mailto:careers@amerilendloan.com" style="color: #0033A0;">careers@amerilendloan.com</a></li>
            <li>Admin: <a href="mailto:admin@amerilendloan.com" style="color: #0033A0;">admin@amerilendloan.com</a></li>
          </ul>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">Thank you again for your interest in AmeriLend.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send job application notification to admin
 */
export async function sendAdminJobApplicationNotification(
  applicantName: string,
  applicantEmail: string,
  applicantPhone: string,
  position: string,
  coverLetter: string,
  resumeFileName: string
): Promise<void> {
  const safeName = escapeHtml(applicantName);
  const safeEmail = escapeHtml(applicantEmail);
  const safePhone = escapeHtml(applicantPhone);
  const safePosition = escapeHtml(position);
  const safeCoverLetter = escapeHtml(coverLetter);
  const safeResume = escapeHtml(resumeFileName);
  const subject = `New Job Application - ${position} [${applicantName}]`;
  const text = `A new job application has been submitted.\n\nApplicant Information:\nName: ${applicantName}\nEmail: ${applicantEmail}\nPhone: ${applicantPhone}\nPosition: ${position}\n\nCover Letter:\n${coverLetter}\n\nResume: ${resumeFileName}\n\nAction Required:\nReview and respond to this application here:\nhttps://amerilendloan.com/admin?view=job_applications`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #0033A0; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              📋 New Job Application
            </div>
          </div>

          <h2 style="color: #0033A0; margin-top: 10px;">New Job Application Received</h2>
          <p style="font-size: 16px; color: #555;">A new job application has been submitted for review.</p>

          <div style="background-color: white; border-left: 4px solid #0033A0; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">Applicant Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #0033A0; width: 120px;">Name:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${safeName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #0033A0;">Email:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><a href="mailto:${safeEmail}" style="color: #0033A0;">${safeEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #0033A0;">Phone:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${safePhone}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #0033A0;">Position:</td>
                <td style="padding: 10px 0;"><strong>${safePosition}</strong></td>
              </tr>
            </table>
          </div>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">Cover Letter</h3>
            <p style="margin: 0; line-height: 1.8; color: #555; white-space: pre-wrap;">${safeCoverLetter}</p>
          </div>

          <div style="background-color: #f0f8ff; border: 1px solid #b3d9ff; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h4 style="margin-top: 0; color: #0033A0;">📎 Attached Documents</h4>
            <p style="margin: 0; color: #555;"><strong>Resume:</strong> ${safeResume}</p>
          </div>

          <div style="background-color: #fff9e6; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #856404;"><strong>Next Steps:</strong> Review the application and contact the applicant to schedule an interview if interested.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://amerilendloan.com/admin?view=job_applications" style="display: inline-block; background-color: #0033A0; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Review Application in Dashboard</a>
          </div>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">This is an automated notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: COMPANY_INFO.admin.email, subject, text, html });
}

/**
 * Send job application decision email to the applicant
 */
export async function sendJobApplicationDecisionEmail(
  email: string,
  fullName: string,
  position: string,
  status: "pending" | "under_review" | "approved" | "rejected",
  replyMessage: string,
  rejectionReasons?: string[]
): Promise<void> {
  const safeName = escapeHtml(fullName);
  const safePosition = escapeHtml(position);
  const safeMessage = escapeHtml(replyMessage);

  const statusLabels: Record<string, string> = {
    pending: "Pending Review",
    under_review: "Under Review",
    approved: "Approved",
    rejected: "Not Selected",
  };
  const statusColors: Record<string, string> = {
    pending: "#f59e0b",
    under_review: "#3b82f6",
    approved: "#10b981",
    rejected: "#ef4444",
  };
  const statusIcons: Record<string, string> = {
    pending: "⏳",
    under_review: "🔍",
    approved: "✅",
    rejected: "❌",
  };

  const label = statusLabels[status] || status;
  const color = statusColors[status] || "#0033A0";
  const icon = statusIcons[status] || "📋";

  const subject = `Job Application Update: ${label} — ${position}`;
  const text = `Dear ${fullName},\n\nThank you for your interest in the ${position} position at AmeriLend.\n\nYour application status has been updated to: ${label}\n\nMessage from our team:\n${replyMessage}\n\nIf you have any questions, feel free to contact us at ${COMPANY_INFO.contact.email}.\n\nBest regards,\nThe AmeriLend HR Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: ${color}; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              ${icon} Application ${label}
            </div>
          </div>

          <h2 style="color: #0033A0; margin-top: 10px;">Application Status Update</h2>
          <p style="font-size: 16px; color: #555;">Dear ${safeName},</p>
          <p style="font-size: 16px; color: #555;">Thank you for your interest in the <strong>${safePosition}</strong> position at AmeriLend. We have an update on your application.</p>

          <div style="background-color: white; border-left: 4px solid ${color}; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">Current Status</h3>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${color};">${icon} ${label}</p>
            <p style="margin: 5px 0 0; color: #666; font-size: 14px;">Position: ${safePosition}</p>
          </div>

          <div style="background-color: #f0f9ff; border-left: 4px solid #0033A0; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">Message from Our Team</h3>
            <p style="margin: 0; color: #555; line-height: 1.8; white-space: pre-wrap;">${safeMessage}</p>
          </div>

          ${status === "pending" ? `
          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #92400e;"><strong>📋 Application Received!</strong> Our hiring team will review your application within 5-7 business days. We will notify you of any updates via email.</p>
          </div>
          ` : status === "approved" ? `
          <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0 0 10px; color: #065f46;"><strong>Welcome to the AmeriLend team.</strong> Please review the onboarding steps below.</p>
          </div>

          <div style="background-color: white; border: 1px solid #d1fae5; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <h3 style="margin: 0 0 15px; color: #065f46; font-size: 16px;">📌 Onboarding — Next Steps</h3>
            <p style="margin: 0 0 15px; color: #555; font-size: 14px;">Please complete the following within <strong>5 business days</strong>:</p>

            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="background-color: #ecfdf5;">
                <td style="padding: 10px; border-bottom: 1px solid #d1fae5; color: #065f46; font-weight: bold;">1. Identity Verification</td>
              </tr>
              <tr>
                <td style="padding: 10px 10px 10px 25px; border-bottom: 1px solid #f0f0f0; color: #555;">• Government-issued photo ID (Passport or Driver's License)<br>• Social Security Number confirmation</td>
              </tr>
              <tr style="background-color: #ecfdf5;">
                <td style="padding: 10px; border-bottom: 1px solid #d1fae5; color: #065f46; font-weight: bold;">2. Employment Documents</td>
              </tr>
              <tr>
                <td style="padding: 10px 10px 10px 25px; border-bottom: 1px solid #f0f0f0; color: #555;">• Signed offer letter (will be sent separately)<br>• Completed W-4 tax form<br>• Completed I-9 Employment Eligibility Verification<br>• Direct deposit authorization form</td>
              </tr>
              <tr style="background-color: #ecfdf5;">
                <td style="padding: 10px; border-bottom: 1px solid #d1fae5; color: #065f46; font-weight: bold;">3. Background &amp; Reference Check</td>
              </tr>
              <tr>
                <td style="padding: 10px 10px 10px 25px; border-bottom: 1px solid #f0f0f0; color: #555;">• Consent form for background check<br>• Contact information for 2–3 professional references</td>
              </tr>
              <tr style="background-color: #ecfdf5;">
                <td style="padding: 10px; border-bottom: 1px solid #d1fae5; color: #065f46; font-weight: bold;">4. Additional Requirements</td>
              </tr>
              <tr>
                <td style="padding: 10px 10px 10px 25px; border-bottom: 1px solid #f0f0f0; color: #555;">• Proof of eligibility to work in the United States<br>• Educational certificates or transcripts (if applicable)<br>• Professional licenses or certifications relevant to the role<br>• Signed confidentiality/NDA agreement</td>
              </tr>
              <tr style="background-color: #ecfdf5;">
                <td style="padding: 10px; border-bottom: 1px solid #d1fae5; color: #065f46; font-weight: bold;">5. IT &amp; Access Setup</td>
              </tr>
              <tr>
                <td style="padding: 10px 10px 10px 25px; color: #555;">• Complete new hire registration form (link will be emailed)<br>• Upload a professional headshot for your company profile</td>
              </tr>
            </table>

            <p style="margin: 15px 0 0; color: #065f46; font-size: 13px;">📧 Our HR team will email you the required forms and detailed instructions shortly.</p>
          </div>
          ` : status === "rejected" ? `
          ${rejectionReasons && rejectionReasons.length > 0 ? `
          <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h4 style="margin: 0 0 10px; color: #9a3412;">Reason(s) for Decision:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #9a3412;">
              ${rejectionReasons.map(r => `<li style="margin-bottom: 4px;">${escapeHtml(r)}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #991b1b;">We appreciate the time and effort you put into your application. We encourage you to apply again in the future for positions that match your skills and experience.</p>
          </div>
          ` : ""}

          <h3 style="color: #0033A0; margin-top: 30px;">Questions?</h3>
          <p style="color: #555;">Feel free to reach out to our team:</p>
          <ul style="padding-left: 20px;">
            <li>📧 Email: <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a></li>
            <li>📞 Phone: <a href="tel:${COMPANY_INFO.contact.phoneFormatted?.replace(/\\D/g, '') || ''}" style="color: #0033A0;">${COMPANY_INFO.contact.phone || ''}</a></li>
          </ul>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">Thank you for considering AmeriLend!</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send admin notification for new user signup
 */
export async function sendAdminSignupNotification(
  userName: string,
  email: string,
  phone: string
): Promise<void> {
  const subject = `New User Signup - ${userName}`;
  const text = `A new user has signed up.\n\nUser Information:\nName: ${userName}\nEmail: ${email}\nPhone: ${phone}\nSignup Time: ${new Date().toLocaleString()}\n\nAction: Review user profile in admin dashboard if needed.`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f9f9f9; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .section { margin: 20px 0; }
          .label { color: #0033A0; font-weight: bold; }
          .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
          th { background-color: #f5f5f5; font-weight: bold; color: #0033A0; }
          .timestamp { background-color: #e8f4f8; border-left: 4px solid #0033A0; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        ${getEmailHeader()}
        <div class="container">
          <div class="header">
            <h1 style="color: #0033A0; margin: 0;">New User Registration</h1>
            <p style="color: #666; margin-top: 5px;">A new user has joined AmeriLend</p>
          </div>

          <div class="section">
            <h2 style="color: #0033A0; border-bottom: 2px solid #0033A0; padding-bottom: 10px;">User Information</h2>
            <table class="info-table">
              <tr>
                <td><span class="label">Name:</span></td>
                <td>${userName}</td>
              </tr>
              <tr>
                <td><span class="label">Email:</span></td>
                <td>${email}</td>
              </tr>
              <tr>
                <td><span class="label">Phone:</span></td>
                <td>${phone || 'Not provided'}</td>
              </tr>
            </table>
          </div>

          <div class="timestamp">
            <strong>Signup Time:</strong> ${new Date().toLocaleString()}
          </div>

          <p style="color: #666; font-size: 14px;">This is an automated notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: COMPANY_INFO.admin.email, subject, text, html });
  if (!result.success) {
    logger.warn(`[Email] Failed to send admin signup notification for ${email}`, { error: result.error });
  }
}

/**
 * Send admin notification for email change
 */
export async function sendAdminEmailChangeNotification(
  userName: string,
  oldEmail: string,
  newEmail: string
): Promise<void> {
  const subject = `User Email Changed - ${userName}`;
  const text = `A user has changed their email address.\n\nUser: ${userName}\nOld Email: ${oldEmail}\nNew Email: ${newEmail}\nChange Time: ${new Date().toLocaleString()}\n\nAction: Verify if this change was authorized.`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f9f9f9; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .section { margin: 20px 0; }
          .label { color: #0033A0; font-weight: bold; }
          .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
          th { background-color: #f5f5f5; font-weight: bold; color: #0033A0; }
        </style>
      </head>
      <body>
        ${getEmailHeader()}
        <div class="container">
          <div class="header">
            <h1 style="color: #0033A0; margin: 0;">User Email Address Changed</h1>
            <p style="color: #666; margin-top: 5px;">Security notification - requires verification</p>
          </div>

          <div class="warning">
            <strong>⚠️ A user email has been changed. Please verify this was authorized.</strong>
          </div>

          <div class="section">
            <h2 style="color: #0033A0; border-bottom: 2px solid #0033A0; padding-bottom: 10px;">Change Details</h2>
            <table class="info-table">
              <tr>
                <td><span class="label">User Name:</span></td>
                <td>${userName}</td>
              </tr>
              <tr>
                <td><span class="label">Previous Email:</span></td>
                <td>${oldEmail}</td>
              </tr>
              <tr>
                <td><span class="label">New Email:</span></td>
                <td><strong>${newEmail}</strong></td>
              </tr>
              <tr>
                <td><span class="label">Change Time:</span></td>
                <td>${new Date().toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <p style="color: #666; font-size: 14px;">This is a security notification. If this change was not authorized, please contact the user immediately.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: COMPANY_INFO.admin.email, subject, text, html });
}

/**
 * Send admin notification for bank info change
 */
export async function sendAdminBankInfoChangeNotification(
  userName: string,
  email: string
): Promise<void> {
  const subject = `User Bank Information Changed - ${userName}`;
  const text = `A user has changed their bank account information.\n\nUser: ${userName}\nEmail: ${email}\nChange Time: ${new Date().toLocaleString()}\n\nAction: Verify the updated bank account information if needed.`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f9f9f9; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .section { margin: 20px 0; }
          .label { color: #0033A0; font-weight: bold; }
          .alert { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
          th { background-color: #f5f5f5; font-weight: bold; color: #0033A0; }
        </style>
      </head>
      <body>
        ${getEmailHeader()}
        <div class="container">
          <div class="header">
            <h1 style="color: #0033A0; margin: 0;">User Bank Account Updated</h1>
            <p style="color: #666; margin-top: 5px;">Notification for audit and verification purposes</p>
          </div>

          <div class="alert">
            <strong>⚠️ A user has updated their bank account information.</strong>
          </div>

          <div class="section">
            <h2 style="color: #0033A0; border-bottom: 2px solid #0033A0; padding-bottom: 10px;">Update Details</h2>
            <table class="info-table">
              <tr>
                <td><span class="label">User Name:</span></td>
                <td>${userName}</td>
              </tr>
              <tr>
                <td><span class="label">User Email:</span></td>
                <td>${email}</td>
              </tr>
              <tr>
                <td><span class="label">Update Time:</span></td>
                <td>${new Date().toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #0033A0;">Action Items:</h3>
            <ul style="color: #555; margin-bottom: 0;">
              <li>Verify the bank information change if needed</li>
              <li>Review pending disbursements for this user</li>
              <li>Monitor for suspicious account activity</li>
            </ul>
          </div>

          <p style="color: #666; font-size: 14px;">This is an automated notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: COMPANY_INFO.admin.email, subject, text, html });
}

/**
 * Send password change confirmation email to user
 */
export async function sendPasswordChangeConfirmationEmail(
  email: string,
  userName: string
): Promise<void> {
  const subject = "Password Changed Successfully - AmeriLend";
  const text = `Dear ${userName},\n\nYour password has been successfully changed. If you did not make this change, please contact us immediately at support@amerilendloan.com.\n\nFor security reasons, we recommend:\n- Using a strong, unique password\n- Never sharing your password with anyone\n- Logging out of all devices if you suspect unauthorized access\n\nBest regards,\nThe AmeriLend Security Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #28a745; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              ✓ Password Changed
            </div>
          </div>

          <h2 style="color: #0033A0; margin-top: 10px;">Your Password Has Been Changed</h2>
          <p style="font-size: 16px; color: #555;">Hi ${userName},</p>
          <p style="font-size: 16px; color: #555;">Your password was successfully changed on your AmeriLend account. If you did not make this change, please secure your account immediately.</p>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #856404;">⚠️ Security Reminder</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
              <li>Use a strong, unique password (at least 8 characters with numbers and special characters)</li>
              <li>Never share your password with anyone</li>
              <li>If you notice suspicious activity, change your password immediately</li>
              <li>Log out of all devices if you suspect unauthorized access</li>
            </ul>
          </div>

          <div style="background-color: #e3f2fd; border-left: 4px solid #0033A0; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #1565c0;">
              <strong>Questions?</strong> Contact our support team at <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a> or call <strong>(945) 212-1609</strong>
            </p>
          </div>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">This is an automated security notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    logger.warn(`[Email] Failed to send password change confirmation to ${email}`, { error: result.error });
  }
}

/**
 * Send profile update confirmation email to user
 */
export async function sendProfileUpdateConfirmationEmail(
  email: string,
  userName: string,
  changesDescription: string
): Promise<void> {
  const subject = "Profile Information Updated - AmeriLend";
  const text = `Dear ${userName},\n\nYour profile information has been successfully updated:\n\n${changesDescription}\n\nIf you did not make this change, please contact us immediately at support@amerilendloan.com.\n\nBest regards,\nThe AmeriLend Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #0033A0; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              ✓ Profile Updated
            </div>
          </div>

          <h2 style="color: #0033A0; margin-top: 10px;">Your Profile Has Been Updated</h2>
          <p style="font-size: 16px; color: #555;">Hi ${userName},</p>
          <p style="font-size: 16px; color: #555;">Your profile information was successfully updated. Here are the changes:</p>

          <div style="background-color: #f0f8ff; border-left: 4px solid #0033A0; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #1565c0; white-space: pre-wrap;">${changesDescription}</p>
          </div>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Unauthorized changes?</strong> If you didn't make these changes, please <a href="https://www.amerilendloan.com/contact" style="color: #856404; text-decoration: underline;">contact us immediately</a>.
            </p>
          </div>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">This is an automated notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    logger.warn(`[Email] Failed to send profile update confirmation to ${email}`, { error: result.error });
  }
}

/**
 * Send crypto payment confirmation email to user
 */
export async function sendCryptoPaymentConfirmedEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  usdAmount: number,
  cryptoAmount: string,
  cryptoCurrency: string,
  walletAddress: string,
  transactionHash?: string
): Promise<void> {
  const formattedAmount = formatCurrency(usdAmount);
  const subject = `✓ Cryptocurrency Payment Received - AmeriLend`;
  const text = `Dear ${fullName},\n\nYour cryptocurrency payment has been successfully received and confirmed!\n\nPayment Details:\nTracking Number: ${trackingNumber}\nUSD Equivalent: $${formattedAmount}\nAmount: ${cryptoAmount} ${cryptoCurrency}\nWallet: ${walletAddress}${transactionHash ? `\nTransaction Hash: ${transactionHash}` : ''}\n\nYour loan application is now being processed. You will receive updates via email as your application progresses.\n\nIf you have any questions, please contact our support team.\n\nBest regards,\nThe AmeriLend Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #28a745; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              ✓ PAYMENT RECEIVED
            </div>
          </div>
          <h2 style="color: #0033A0; margin-top: 10px;">Cryptocurrency Payment Confirmed</h2>
          <p>Dear ${fullName},</p>
          <p>Thank you! Your cryptocurrency payment has been successfully received and confirmed on the blockchain. Your loan processing fee is now paid.</p>
          
          <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #28a745;">Payment Confirmation</h3>
            <table style="width: 100%; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>Tracking Number:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right; font-family: monospace;">${trackingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>USD Equivalent:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right; color: #28a745;"><strong>$${formattedAmount}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>Crypto Amount:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right;"><strong>${cryptoAmount} ${cryptoCurrency}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>Wallet Address:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right; font-family: monospace; font-size: 11px; word-break: break-all;">${walletAddress}</td>
              </tr>
              ${transactionHash ? `<tr>
                <td style="padding: 8px 0;"><strong>Transaction Hash:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 11px; word-break: break-all;">${transactionHash}</td>
              </tr>` : ''}
            </table>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">What's Next?</h3>
          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <ul style="margin: 0; padding-left: 20px; line-height: 2;">
              <li>Your payment has been confirmed on the blockchain</li>
              <li>Your loan application will move to the next processing stage</li>
              <li>You'll receive updates via email as your application progresses</li>
              <li>Expected funds disbursement: 1-2 business days after approval</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.amerilendloan.com/dashboard" style="background-color: #FFA500; color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">View Your Application</a>
          </div>

          <div style="background-color: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h4 style="margin-top: 0; color: #0033A0;">Keep Your Confirmation</h4>
            <p style="margin-bottom: 0; color: #555;">Please keep this email for your records. Your transaction hash and wallet address may be needed for future reference.</p>
          </div>

          <p style="margin-top: 30px;">If you have any questions about your payment or application, please contact our support team at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    logger.warn(`[Email] Failed to send crypto payment confirmation to ${email}`, { error: result.error });
  }
}

/**
 * Send crypto payment instructions email to user (when payment address is created)
 */
export async function sendCryptoPaymentInstructionsEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  usdAmount: number,
  cryptoAmount: string,
  cryptoCurrency: string,
  walletAddress: string
): Promise<void> {
  const formattedAmount = formatCurrency(usdAmount);
  const subject = `💰 Complete Your Crypto Payment - AmeriLend [${trackingNumber}]`;
  const text = `Dear ${fullName},\n\nYour crypto payment address has been generated! Please send your payment to complete your loan application.\n\nPayment Details:\nTracking Number: ${trackingNumber}\nUSD Amount: $${formattedAmount}\nCrypto Amount: ${cryptoAmount} ${cryptoCurrency}\nWallet Address: ${walletAddress}\n\nIMPORTANT INSTRUCTIONS:\n1. Send EXACTLY ${cryptoAmount} ${cryptoCurrency} to the address above\n2. After sending, submit your transaction hash in your dashboard\n3. Wait for blockchain confirmation (6-12 confirmations)\n4. You'll receive a confirmation email once verified\n\nNeed help? Contact our support team.\n\nBest regards,\nThe AmeriLend Team`;

  const qrCodeUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${cryptoCurrency}:${walletAddress}?amount=${cryptoAmount}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #FFA500; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              💰 PAYMENT INSTRUCTIONS
            </div>
          </div>
          <h2 style="color: #0033A0; margin-top: 10px;">Complete Your Crypto Payment</h2>
          <p>Dear ${fullName},</p>
          <p>Your cryptocurrency payment address has been generated! Follow the instructions below to complete your payment.</p>
          
          <div style="background-color: #fff3cd; border-left: 4px solid #FFA500; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #FFA500;">Payment Details</h3>
            <table style="width: 100%; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ffeeba;"><strong>Tracking Number:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ffeeba; text-align: right; font-family: monospace;">${trackingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ffeeba;"><strong>USD Amount:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ffeeba; text-align: right; color: #FFA500;"><strong>$${formattedAmount}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ffeeba;"><strong>Send Exactly:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ffeeba; text-align: right;"><strong style="font-size: 18px; color: #d63384;">${cryptoAmount} ${cryptoCurrency}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>To Address:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 11px; word-break: break-all;">${walletAddress}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <img src="${qrCodeUrl}" alt="QR Code" style="border: 2px solid #ddd; border-radius: 10px; padding: 10px; background: white;" />
            <p style="margin-top: 10px; color: #666; font-size: 14px;">Scan this QR code with your crypto wallet</p>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">📋 Step-by-Step Instructions</h3>
          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <ol style="margin: 0; padding-left: 20px; line-height: 2;">
              <li><strong>Open your crypto wallet</strong> (Trust Wallet, MetaMask, etc.)</li>
              <li><strong>Send EXACTLY ${cryptoAmount} ${cryptoCurrency}</strong> to the address above</li>
              <li><strong>Copy your transaction hash</strong> after sending</li>
              <li><strong>Submit the transaction hash</strong> in your dashboard</li>
              <li><strong>Wait for confirmation</strong> (6-12 blockchain confirmations)</li>
            </ol>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h4 style="margin-top: 0; color: #856404;">⚠️ Important Notes</h4>
            <ul style="margin: 0; padding-left: 20px; color: #856404;">
              <li>Send the <strong>exact amount</strong> shown above</li>
              <li>Use the correct <strong>${cryptoCurrency} network</strong></li>
              <li>Double-check the wallet address before sending</li>
              <li>Payment expires in 24 hours</li>
              <li>Contact support if you need assistance</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.amerilendloan.com/dashboard" style="background-color: #0033A0; color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Go to Dashboard</a>
          </div>

          <p style="margin-top: 30px;">If you have any questions, please contact our support team at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    logger.warn(`[Email] Failed to send crypto payment instructions to ${email}`, { error: result.error });
  }
}

/**
 * Send payment rejection notification to user
 */
export async function sendPaymentRejectionEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  paymentAmount: number,
  rejectionReason: string
): Promise<void> {
  const formattedAmount = formatCurrency(paymentAmount);
  const subject = `Payment Update Required - AmeriLend [${trackingNumber}]`;
  const text = `Dear ${fullName},\n\nWe were unable to process your payment for application ${trackingNumber}.\n\nPayment Amount: $${formattedAmount}\nReason: ${rejectionReason}\n\nPlease submit a new payment or contact our support team for assistance.\n\nBest regards,\nThe AmeriLend Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #dc3545; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              ⚠️ PAYMENT ACTION REQUIRED
            </div>
          </div>
          <h2 style="color: #0033A0; margin-top: 10px;">Payment Update Needed</h2>
          <p>Dear ${fullName},</p>
          <p>We were unable to process your recent payment for application <strong>${trackingNumber}</strong>. Please review the details below and take action.</p>
          
          <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #dc3545;">Payment Information</h3>
            <table style="width: 100%; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f5c6cb;"><strong>Tracking Number:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f5c6cb; text-align: right; font-family: monospace;">${trackingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f5c6cb;"><strong>Payment Amount:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f5c6cb; text-align: right;"><strong>$${formattedAmount}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Reason:</strong></td>
                <td style="padding: 8px 0; text-align: right; color: #721c24;">${rejectionReason}</td>
              </tr>
            </table>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">What's Next?</h3>
          <div style="background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p style="margin: 0; color: #0c5460;"><strong>Option 1:</strong> Submit a new payment using a different payment method</p>
            <p style="margin: 10px 0 0 0; color: #0c5460;"><strong>Option 2:</strong> Contact our support team for assistance</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.amerilendloan.com/dashboard" style="background-color: #0033A0; color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">View Your Application</a>
          </div>

          <p style="margin-top: 30px;">If you have questions or need assistance, please contact us at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    logger.warn(`[Email] Failed to send payment rejection email to ${email}`, { error: result.error });
  }
}

/**
 * Send bank credential access notification to user (security alert)
 */
export async function sendBankCredentialAccessNotification(
  email: string,
  fullName: string,
  trackingNumber: string,
  adminName: string,
  accessTime: Date
): Promise<void> {
  const formattedTime = accessTime.toLocaleString('en-US', { 
    dateStyle: 'long', 
    timeStyle: 'short' 
  });
  const subject = `🔒 Security Alert: Bank Credentials Accessed - AmeriLend [${trackingNumber}]`;
  const text = `Dear ${fullName},\n\nThis is a security notification. Your bank account credentials were accessed by our admin team for loan disbursement processing.\n\nAccess Details:\nTracking Number: ${trackingNumber}\nAccessed By: ${adminName}\nAccess Time: ${formattedTime}\nPurpose: Loan disbursement verification\n\nFor your security, we recommend changing your online banking password after your loan is disbursed.\n\nIf you did not authorize this loan application, please contact us immediately.\n\nBest regards,\nThe AmeriLend Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #17a2b8; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              🔒 SECURITY NOTIFICATION
            </div>
          </div>
          <h2 style="color: #0033A0; margin-top: 10px;">Bank Credentials Accessed</h2>
          <p>Dear ${fullName},</p>
          <p>This is an automated security notification. Your bank account credentials were accessed by our authorized admin team as part of the loan disbursement process.</p>
          
          <div style="background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0c5460;">Access Details</h3>
            <table style="width: 100%; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #bee5eb;"><strong>Tracking Number:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #bee5eb; text-align: right; font-family: monospace;">${trackingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #bee5eb;"><strong>Accessed By:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #bee5eb; text-align: right;">${adminName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #bee5eb;"><strong>Access Time:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #bee5eb; text-align: right;">${formattedTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Purpose:</strong></td>
                <td style="padding: 8px 0; text-align: right;">Loan disbursement verification</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h4 style="margin-top: 0; color: #856404;">🔐 Security Recommendation</h4>
            <p style="margin: 0; color: #856404;">For your security, we recommend <strong>changing your online banking password</strong> after your loan has been disbursed to your account.</p>
          </div>

          <div style="background-color: #f8d7da; border: 1px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h4 style="margin-top: 0; color: #721c24;">⚠️ Did Not Authorize This?</h4>
            <p style="margin: 0; color: #721c24;">If you did not apply for a loan with AmeriLend, please contact us immediately at <strong>${COMPANY_INFO.contact.phone}</strong>.</p>
          </div>

          <p style="margin-top: 30px;">This access was logged for security purposes. All credential access is monitored and audited.</p>
          
          <p>If you have any questions or concerns, please contact our security team at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a>.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    logger.error(`[Email] Failed to send bank credential access notification to ${email}:`, result.error);
    // Don't throw - this is a non-critical notification
  }
}

/**
 * Send crypto payment notification to admin
 */
export async function sendAdminCryptoPaymentNotification(
  paymentId: string,
  userName: string,
  userEmail: string,
  usdAmount: number,
  cryptoAmount: string,
  cryptoCurrency: string,
  transactionHash: string | undefined,
  walletAddress: string
): Promise<void> {
  const formattedAmount = formatCurrency(usdAmount);
  const subject = `Payment Received - Cryptocurrency - ${userName} [${paymentId}]`;
  const text = `A new cryptocurrency payment has been received.\n\nPayment Details:\nPayment ID: ${paymentId}\n${transactionHash ? `Transaction Hash: ${transactionHash}\n` : ""}USD Amount: $${formattedAmount}\nCrypto Amount: ${cryptoAmount} ${cryptoCurrency}\nWallet: ${walletAddress}\n\nUser Information:\nName: ${userName}\nEmail: ${userEmail}\n\nAction: ${transactionHash ? "Verify payment on blockchain and process application accordingly." : "Awaiting transaction hash - user has generated payment address."}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="background-color: #28a745; color: white; display: inline-block; padding: 15px 25px; border-radius: 5px; font-size: 18px; font-weight: bold;">
              ₿ CRYPTO PAYMENT RECEIVED
            </div>
          </div>
          <h2 style="color: #0033A0; margin-top: 10px;">New Cryptocurrency Payment Received</h2>
          <p>A new cryptocurrency payment has been successfully received and confirmed on the blockchain.</p>
          
          <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #28a745;">Payment Information</h3>
            <table style="width: 100%; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>Payment ID:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right; font-family: monospace; font-size: 12px;">${paymentId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>USD Amount:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right; font-size: 18px; font-weight: bold; color: #28a745;">$${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>Crypto Amount:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right;"><strong>${cryptoAmount} ${cryptoCurrency}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>Wallet Address:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right; font-family: monospace; font-size: 11px; word-break: break-all;">${walletAddress}</td>
              </tr>
              ${transactionHash ? `<tr>
                <td style="padding: 8px 0;"><strong>Transaction Hash:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 11px; word-break: break-all;">${transactionHash}</td>
              </tr>` : `<tr>
                <td style="padding: 8px 0;"><strong>Status:</strong></td>
                <td style="padding: 8px 0; text-align: right; color: #ffc107;"><strong>⏳ Awaiting Transaction Hash</strong></td>
              </tr>`}
            </table>
          </div>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">User Information</h3>
            <table style="width: 100%; margin-top: 10px;">
              <tr>
                <td style="padding: 8px 0;"><strong>Name:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${userName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Email:</strong></td>
                <td style="padding: 8px 0; text-align: right;"><a href="mailto:${userEmail}" style="color: #0033A0;">${userEmail}</a></td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #856404;"><strong>📌 ${transactionHash ? "Verification Required" : "Awaiting Payment"}:</strong> ${transactionHash ? "Please verify the transaction on the blockchain using the hash above, then process the user's application accordingly." : "The user has generated a payment address. They will send the cryptocurrency and provide the transaction hash for verification."}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/admin/payments" style="background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Review Payment</a>
          </div>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">This is an automated notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: COMPANY_INFO.admin.email, subject, text, html });
}

/**
 * Send professional payment receipt for successful fee payments
 */
export async function sendPaymentReceiptEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  amount: number,
  paymentMethod: "card" | "crypto",
  cardLast4?: string,
  cardBrand?: string,
  transactionId?: string,
  cryptoCurrency?: string,
  cryptoAmount?: string,
  walletAddress?: string
): Promise<void> {
  const receiptDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const receiptTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  const subject = `Payment Receipt #${receiptNumber} - AmeriLend Processing Fee`;

  const text = `
Dear ${fullName},

Thank you for your payment! Your processing fee payment has been successfully received and processed.

PAYMENT RECEIPT
================

Receipt Number: ${receiptNumber}
Date: ${receiptDate} at ${receiptTime}
Loan Tracking #: ${trackingNumber}
Amount: $${formattedAmount}
Payment Method: ${paymentMethod === 'card' ? 'Credit/Debit Card' : 'Cryptocurrency'}
${paymentMethod === 'card' ? `Card: ${cardBrand} ending in ${cardLast4}\nTransaction ID: ${transactionId}` : `Cryptocurrency: ${cryptoCurrency}\nCrypto Amount: ${cryptoAmount}\nWallet Address: ${walletAddress}`}

Your loan application is now processing. You can track the status using your loan tracking number: ${trackingNumber}

If you have any questions about your payment or loan application, please contact our support team.

Best regards,
AmeriLend Support Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #0033A0; font-size: 28px;">✓ Payment Received</h1>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">Your processing fee has been successfully received</p>
          </div>

          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #0033A0; font-size: 20px;">Receipt Details</h2>
            <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px 0; color: #666;"><strong>Receipt Number:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-family: monospace; color: #0033A0; font-weight: bold;">${receiptNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px 0; color: #666;"><strong>Date & Time:</strong></td>
                <td style="padding: 12px 0; text-align: right;">${receiptDate} at ${receiptTime}</td>
              </tr>
              <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px 0; color: #666;"><strong>Loan Tracking #:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-family: monospace; font-weight: bold;">${trackingNumber}</td>
              </tr>
              <tr style="border-bottom: 2px solid #28a745;">
                <td style="padding: 12px 0; color: #666;"><strong>Amount Paid:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-size: 20px; font-weight: bold; color: #28a745;">$${formattedAmount}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #0033A0;">Payment Method</h3>
            ${paymentMethod === 'card' 
              ? `<table style="width: 100%; margin-top: 10px;">
                  <tr style="border-bottom: 1px solid #b3d9ff;">
                    <td style="padding: 8px 0;"><strong>Card Type:</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${cardBrand}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #b3d9ff;">
                    <td style="padding: 8px 0;"><strong>Card Number:</strong></td>
                    <td style="padding: 8px 0; text-align: right;">•••• •••• •••• ${cardLast4}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Transaction ID:</strong></td>
                    <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${transactionId}</td>
                  </tr>
                </table>`
              : `<table style="width: 100%; margin-top: 10px;">
                  <tr style="border-bottom: 1px solid #b3d9ff;">
                    <td style="padding: 8px 0;"><strong>Cryptocurrency:</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${cryptoCurrency}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #b3d9ff;">
                    <td style="padding: 8px 0;"><strong>Crypto Amount:</strong></td>
                    <td style="padding: 8px 0; text-align: right;"><strong>${cryptoAmount} ${cryptoCurrency}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Wallet Address:</strong></td>
                    <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 11px; word-break: break-all;">${walletAddress}</td>
                  </tr>
                </table>`
            }
          </div>

          <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #155724;">What's Next?</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #155724;">
              <li style="margin-bottom: 8px;">Your loan application is now processing</li>
              <li style="margin-bottom: 8px;">You'll receive updates via email as your application progresses</li>
              <li>You can track your application status using your loan tracking number</li>
            </ul>
          </div>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #856404;">💡 Important Information</h3>
            <p style="margin: 0; color: #856404; font-size: 14px;">Please save this receipt for your records. Your receipt number and tracking number can be used to reference this transaction.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/dashboard" style="background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">View Your Application</a>
          </div>

          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #333;">Application Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background-color: #e7e7e7;">
                <td style="padding: 10px; font-weight: bold;">Item</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">Amount</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">Processing Fee</td>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: bold;">$${formattedAmount}</td>
              </tr>
            </table>
          </div>

          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #666; font-size: 13px;">
              <strong>Contact Us:</strong><br>
              Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a><br>
              Website: <a href="${COMPANY_INFO.website}" style="color: #0033A0;">${COMPANY_INFO.website}</a>
            </p>
          </div>

          <p style="margin-top: 20px; color: #999; font-size: 12px; text-align: center;">This is an automated receipt. Please do not reply to this email. For inquiries, contact our support team.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send payment failure notification to user
 */
export async function sendPaymentFailureEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  amount: number,
  failureReason: string,
  paymentMethod: "card" | "crypto" = "card"
): Promise<void> {
  const formattedAmount = formatCurrency(amount);
  const subject = `Payment Failed - Action Required - AmeriLend Loan #${trackingNumber}`;
  
  const failureReasons: Record<string, { title: string; instructions: string }> = {
    "insufficient_funds": {
      title: "Insufficient Funds",
      instructions: "Your account doesn't have enough funds to process this payment. Please ensure your account has at least $" + formattedAmount + " available."
    },
    "card_expired": {
      title: "Card Expired",
      instructions: "Your card has expired. Please update your payment method with a valid, non-expired card."
    },
    "invalid_card": {
      title: "Invalid Card Information",
      instructions: "The card information provided is invalid or doesn't match our records. Please verify all card details are correct."
    },
    "card_declined": {
      title: "Card Declined",
      instructions: "Your card was declined by your financial institution. Please contact your bank or try a different payment method."
    },
    "processor_error": {
      title: "Payment Processor Error",
      instructions: "A temporary error occurred while processing your payment. Please try again in a few moments."
    },
  };

  const errorInfo = failureReasons[failureReason] || {
    title: "Payment Processing Failed",
    instructions: failureReason || "An error occurred while processing your payment. Please try again or contact support."
  };

  const text = `
Payment Failed Notification

Hello ${fullName},

Unfortunately, your recent payment of $${formattedAmount} for loan application #${trackingNumber} could not be processed.

Failure Reason: ${errorInfo.title}
Details: ${errorInfo.instructions}

What You Should Do:
1. Review the failure details above
2. Update your payment method if needed
3. Try processing the payment again from your dashboard
4. Contact our support team if you need assistance

Your loan application will remain in "fee_pending" status until the processing fee payment is completed successfully.

Important: Your application cannot proceed to disbursement until this fee payment is processed.

For questions or assistance, contact us at:
Email: support@amerilendloan.com
Phone: Available through your dashboard

Thank you for your business.
AmeriLend Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px 30px; border-radius: 8px;">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background-color: #dc3545; color: white; display: inline-block; padding: 15px 25px; border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 32px;">
              ✕
            </div>
          </div>

          <h1 style="color: #dc3545; text-align: center; margin: 20px 0 10px;">Payment Failed</h1>
          <p style="text-align: center; color: #666; margin-bottom: 30px; font-size: 16px;">
            We were unable to process your payment for loan application <strong>#${trackingNumber}</strong>
          </p>

          <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 20px; margin: 30px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #721c24; font-size: 16px;">Failure Reason</h3>
            <p style="margin: 10px 0 0 0; color: #721c24;"><strong>${errorInfo.title}</strong></p>
            <p style="margin: 10px 0 0 0; color: #721c24; font-size: 14px;">${errorInfo.instructions}</p>
          </div>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin: 30px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #0033A0;">Payment Details</h3>
            <table style="width: 100%; margin-top: 10px;">
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Amount:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #dc3545;">$${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Application:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">#${trackingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Payment Method:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${paymentMethod === "card" ? "Credit/Debit Card" : "Cryptocurrency"}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f9f9f9; padding: 20px; margin: 30px 0; border-radius: 4px; border: 1px solid #e0e0e0;">
            <h3 style="margin-top: 0; color: #333; font-size: 16px;">What You Should Do Next</h3>
            <ol style="margin: 10px 0; padding-left: 20px; color: #555;">
              <li style="margin-bottom: 10px;">Review the failure reason above</li>
              <li style="margin-bottom: 10px;">Update your payment method if needed (e.g., renew expired card)</li>
              <li style="margin-bottom: 10px;">Try processing the payment again from your dashboard</li>
              <li style="margin-bottom: 0;">Contact support if the issue persists</li>
            </ol>
          </div>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
            <p style="margin: 0; color: #856404;"><strong>⚠️ Important:</strong> Your loan application cannot proceed to funding until this processing fee is successfully paid. Your application will remain in pending status.</p>
          </div>

          <div style="text-align: center; margin: 40px 0;">
            <a href="${COMPANY_INFO.website}/dashboard/payments" style="background-color: #0033A0; color: white; padding: 14px 32px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Retry Payment</a>
          </div>

          <hr style="border: none; border-top: 2px solid #f0f0f0; margin: 40px 0;">

          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 4px;">
            <h4 style="margin-top: 0; color: #0033A0; font-size: 14px;">Need Help?</h4>
            <p style="margin: 5px 0; color: #666; font-size: 13px;">
              If you have questions or need assistance:
            </p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #666; font-size: 13px;">
              <li><strong>Email Support:</strong> <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a></li>
              <li><strong>Visit Dashboard:</strong> <a href="${COMPANY_INFO.website}/dashboard" style="color: #0033A0;">Your Dashboard</a></li>
              <li><strong>Payment Help:</strong> <a href="${COMPANY_INFO.website}/help/payments" style="color: #0033A0;">Payment FAQ</a></li>
            </ul>
          </div>

          <p style="margin-top: 30px; color: #999; font-size: 12px; text-align: center;">
            This is an automated notification. Please do not reply to this email. For inquiries, contact our support team using the links above.
          </p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send a single consolidated email when ALL documents for a user are approved at once.
 * Prevents flooding the user with one email per document.
 */
export async function sendBulkDocumentsApprovedEmail(
  email: string,
  fullName: string,
  documentTypes: string[],
  trackingNumber?: string
): Promise<void> {
  const documentLabels: Record<string, string> = {
    drivers_license_front: "Driver's License (Front)",
    drivers_license_back: "Driver's License (Back)",
    passport: "Passport",
    national_id_front: "National ID (Front)",
    national_id_back: "National ID (Back)",
    ssn_card: "Social Security Card",
    bank_statement: "Bank Statement",
    utility_bill: "Utility Bill",
    pay_stub: "Pay Stub",
    tax_return: "Tax Return",
    other: "Document"
  };

  const docLabels = documentTypes.map(dt => documentLabels[dt] || dt.replace(/_/g, ' '));
  const docListText = docLabels.map(d => `  • ${d}`).join('\n');
  const docListHtml = docLabels
    .map(d => `<tr><td style="padding: 8px 12px; color: #155724;">✓ ${d}</td><td style="padding: 8px 12px; text-align: right; color: #28a745; font-weight: bold;">Approved</td></tr>`)
    .join('');
  const verifiedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const subject = `All Documents Verified & Approved - AmeriLend`;

  const text = `
Dear ${fullName},

All ${documentTypes.length} of your submitted documents have been verified and approved.

Approved Documents:
${docListText}

Verification Date: ${verifiedDate}
${trackingNumber ? `Loan Tracking #: ${trackingNumber}\n` : ''}
Your documents are now on file with AmeriLend and your loan application will continue processing.

Best regards,
AmeriLend Verification Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #28a745; font-size: 28px;">✓ All Documents Approved</h1>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">
              All ${documentTypes.length} document${documentTypes.length > 1 ? 's have' : ' has'} been verified and approved
            </p>
          </div>

          <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin-top: 0; color: #155724;">Verification Summary</h2>
            <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
              <tr style="border-bottom: 2px solid #b8e6c9;">
                <td style="padding: 8px 12px; color: #155724; font-weight: bold;">Document</td>
                <td style="padding: 8px 12px; text-align: right; color: #155724; font-weight: bold;">Status</td>
              </tr>
              ${docListHtml}
              <tr style="border-top: 2px solid #b8e6c9;">
                <td style="padding: 12px; color: #155724;"><strong>Verified On:</strong></td>
                <td style="padding: 12px; text-align: right;">${verifiedDate}</td>
              </tr>
            </table>
          </div>

          ${trackingNumber ? `<div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #0033A0;">Your Application</h3>
            <p style="margin: 10px 0;">All documents are on file and your loan application will progress accordingly.</p>
            <p style="margin: 10px 0; color: #666;"><strong>Loan Tracking #:</strong> ${trackingNumber}</p>
          </div>` : ''}

          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #333;">What Happens Next?</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
              <li style="margin-bottom: 8px;">All your documents have been verified and approved</li>
              <li style="margin-bottom: 8px;">Your loan application will continue processing</li>
              <li>You will receive updates via email as your application progresses</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/dashboard" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">View Your Application</a>
          </div>

          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #666; font-size: 13px;">
              <strong>Questions?</strong><br>
              Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a>
            </p>
          </div>

          <p style="margin-top: 20px; color: #999; font-size: 12px; text-align: center;">This is an automated notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send a single consolidated email when ALL documents for a user are rejected at once.
 */
export async function sendBulkDocumentsRejectedEmail(
  email: string,
  fullName: string,
  documentTypes: string[],
  rejectionReason: string,
  trackingNumber?: string
): Promise<void> {
  const documentLabels: Record<string, string> = {
    drivers_license_front: "Driver's License (Front)",
    drivers_license_back: "Driver's License (Back)",
    passport: "Passport",
    national_id_front: "National ID (Front)",
    national_id_back: "National ID (Back)",
    ssn_card: "Social Security Card",
    bank_statement: "Bank Statement",
    utility_bill: "Utility Bill",
    pay_stub: "Pay Stub",
    tax_return: "Tax Return",
    other: "Document"
  };

  const docLabels = documentTypes.map(dt => documentLabels[dt] || dt.replace(/_/g, ' '));
  const docListText = docLabels.map(d => `  • ${d}`).join('\n');
  const docListHtml = docLabels
    .map(d => `<tr><td style="padding: 8px 12px; color: #721c24;">✗ ${d}</td><td style="padding: 8px 12px; text-align: right; color: #dc3545; font-weight: bold;">Rejected</td></tr>`)
    .join('');
  const subject = `Document Verification Update - Action Required - AmeriLend`;

  const text = `
Dear ${fullName},

We've reviewed your submitted documents and unfortunately they could not be approved at this time.

Documents Requiring Attention:
${docListText}

Reason: ${rejectionReason}

${trackingNumber ? `Loan Tracking #: ${trackingNumber}\n` : ''}
Please log in to your account and re-upload the required documents. If you have questions, contact our support team.

Best regards,
AmeriLend Verification Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #dc3545; font-size: 28px;">Documents Need Attention</h1>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">
              ${documentTypes.length} document${documentTypes.length > 1 ? 's require' : ' requires'} re-submission
            </p>
          </div>

          <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin-top: 0; color: #721c24;">Review Details</h2>
            <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
              <tr style="border-bottom: 2px solid #e8b4b8;">
                <td style="padding: 8px 12px; color: #721c24; font-weight: bold;">Document</td>
                <td style="padding: 8px 12px; text-align: right; color: #721c24; font-weight: bold;">Status</td>
              </tr>
              ${docListHtml}
            </table>
            <div style="margin-top: 15px; padding: 12px; background-color: rgba(255,255,255,0.5); border-radius: 4px;">
              <strong style="color: #721c24;">Reason:</strong>
              <p style="margin: 5px 0 0 0; color: #721c24;">${rejectionReason}</p>
            </div>
          </div>

          ${trackingNumber ? `<div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <p style="margin: 0; color: #666;"><strong>Loan Tracking #:</strong> ${trackingNumber}</p>
          </div>` : ''}

          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #333;">What To Do Next</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
              <li style="margin-bottom: 8px;">Log in to your AmeriLend account</li>
              <li style="margin-bottom: 8px;">Navigate to your document uploads</li>
              <li style="margin-bottom: 8px;">Re-upload clear, legible copies of the required documents</li>
              <li>Our team will review them as quickly as possible</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/dashboard" style="background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Re-Upload Documents</a>
          </div>

          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #666; font-size: 13px;">
              <strong>Need help?</strong><br>
              Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a>
            </p>
          </div>

          <p style="margin-top: 20px; color: #999; font-size: 12px; text-align: center;">This is an automated notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send document approval notification to user
 */
export async function sendDocumentApprovedEmail(
  email: string,
  fullName: string,
  documentType: string,
  trackingNumber?: string
): Promise<void> {
  const documentLabels: Record<string, string> = {
    drivers_license_front: "Driver's License (Front)",
    drivers_license_back: "Driver's License (Back)",
    passport: "Passport",
    national_id_front: "National ID (Front)",
    national_id_back: "National ID (Back)",
    ssn_card: "Social Security Card",
    bank_statement: "Bank Statement",
    utility_bill: "Utility Bill",
    pay_stub: "Pay Stub",
    tax_return: "Tax Return",
    other: "Document"
  };

  const docLabel = documentLabels[documentType] || "Document";
  const subject = `Document Verification Complete - AmeriLend`;

  const text = `
Dear ${fullName},

Your ${docLabel} has been verified and approved.

Document Type: ${docLabel}
Status: ✓ Approved
Verification Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

${trackingNumber ? `Loan Tracking #: ${trackingNumber}\n` : ''}

Your document has met all verification requirements and is now on file with AmeriLend. This helps us process your loan application faster.

If you have any questions about your document verification or application, please contact our support team.

Best regards,
AmeriLend Verification Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #28a745; font-size: 28px;">✓ Document Approved</h1>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">Your document has been verified and approved</p>
          </div>

          <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin-top: 0; color: #155724;">Document Verification Details</h2>
            <table style="width: 100%; margin-top: 15px;">
              <tr style="border-bottom: 1px solid #b8e6c9;">
                <td style="padding: 12px 0; color: #155724;"><strong>Document Type:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold;">${docLabel}</td>
              </tr>
              <tr style="border-bottom: 1px solid #b8e6c9;">
                <td style="padding: 12px 0; color: #155724;"><strong>Status:</strong></td>
                <td style="padding: 12px 0; text-align: right; color: #28a745;"><strong>✓ Approved</strong></td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #155724;"><strong>Verified On:</strong></td>
                <td style="padding: 12px 0; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>
            </table>
          </div>

          ${trackingNumber ? `<div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #0033A0;">Your Application</h3>
            <p style="margin: 10px 0;">Your document is now on file and your loan application will progress accordingly.</p>
            <p style="margin: 10px 0; color: #666;"><strong>Loan Tracking #:</strong> ${trackingNumber}</p>
          </div>` : ''}

          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #333;">What Happens Next?</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
              <li style="margin-bottom: 8px;">Your document has been verified and approved</li>
              <li style="margin-bottom: 8px;">Your loan application will continue processing</li>
              <li>You will receive updates via email as your application progresses</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/dashboard" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">View Your Application</a>
          </div>

          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #666; font-size: 13px;">
              <strong>Questions?</strong><br>
              Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a>
            </p>
          </div>

          <p style="margin-top: 20px; color: #999; font-size: 12px; text-align: center;">This is an automated notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send document re-verification request notification to user
 */
export async function sendDocumentReverificationRequestEmail(
  email: string,
  fullName: string,
  documentType: string,
  requestReason: string,
  trackingNumber?: string
): Promise<void> {
  const documentLabels: Record<string, string> = {
    drivers_license_front: "Driver's License (Front)",
    drivers_license_back: "Driver's License (Back)",
    passport: "Passport",
    national_id_front: "National ID (Front)",
    national_id_back: "National ID (Back)",
    ssn_card: "Social Security Card",
    bank_statement: "Bank Statement",
    utility_bill: "Utility Bill",
    pay_stub: "Pay Stub",
    tax_return: "Tax Return",
    w2: "W-2 Form",
    other: "Document"
  };

  const docLabel = documentLabels[documentType] || "Document";
  const subject = `Action Required: Document Re-verification Requested - AmeriLend`;

  const text = `
Dear ${fullName},

Our verification team has requested that you resubmit your ${docLabel} for re-verification.

Document Type: ${docLabel}
Status: 🔄 Re-verification Requested
Request Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Reason for Request:
${requestReason}

${trackingNumber ? `Loan Tracking #: ${trackingNumber}\n` : ''}

Please submit a new copy of your ${docLabel} through your dashboard. Make sure:
- The document is clear and all text is readable
- The document is current and has not expired (if applicable)
- All corners and edges are visible
- The document matches the information in your application

You can upload your document through your dashboard at any time. This helps us process your application faster.

If you have any questions or need assistance, please contact our support team.

Best regards,
AmeriLend Verification Team

Phone: (945) 212-1609
Email: support@amerilendloan.com
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #ff9800; font-size: 28px;">🔄 Re-verification Requested</h1>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">We need an updated copy of your document</p>
          </div>

          <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin-top: 0; color: #e65100;">Document Re-verification Details</h2>
            <table style="width: 100%; margin-top: 15px;">
              <tr style="border-bottom: 1px solid #ffe0b2;">
                <td style="padding: 12px 0; color: #e65100;"><strong>Document Type:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold;">${docLabel}</td>
              </tr>
              <tr style="border-bottom: 1px solid #ffe0b2;">
                <td style="padding: 12px 0; color: #e65100;"><strong>Status:</strong></td>
                <td style="padding: 12px 0; text-align: right; color: #f57c00;"><strong>🔄 Re-verification Required</strong></td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #e65100;"><strong>Requested On:</strong></td>
                <td style="padding: 12px 0; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #333;">Why We Need This Document Again</h3>
            <p style="margin: 0; color: #555; font-size: 15px; line-height: 1.8;">${requestReason}</p>
          </div>

          ${trackingNumber ? `<div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #0033A0;">Your Application</h3>
            <p style="margin: 10px 0; color: #666;"><strong>Loan Tracking #:</strong> ${trackingNumber}</p>
            <p style="margin: 10px 0; color: #666;">Uploading your document quickly will help us process your application faster.</p>
          </div>` : ''}

          <div style="background-color: #e8f5e9; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #2e7d32;">Document Requirements</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #1b5e20;">
              <li style="margin-bottom: 8px;">Document must be clear and all text readable</li>
              <li style="margin-bottom: 8px;">Document must be current and not expired</li>
              <li style="margin-bottom: 8px;">All four corners must be visible</li>
              <li style="margin-bottom: 8px;">Information must match your application details</li>
              <li>Accepted formats: JPEG, PNG, PDF (max 10MB)</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/dashboard" style="background-color: #ff9800; color: white; padding: 14px 35px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Upload Document Now</a>
          </div>

          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #666; font-size: 13px;">
              <strong>Need Help?</strong><br>
              Phone: <a href="tel:+19452121609" style="color: #0033A0;">(945) 212-1609</a><br>
              Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a>
            </p>
          </div>

          <p style="margin-top: 20px; color: #999; font-size: 12px; text-align: center;">This is an automated notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send incomplete application reminder email
 */
export async function sendIncompleteApplicationReminderEmail(
  email: string,
  fullName: string,
  loanAmount: number,
  loanPurpose: string,
  trackingNumber: string
): Promise<{ success: boolean; error?: string }> {
  const formattedAmount = formatCurrency(loanAmount);
  const subject = `Complete Your Loan Application - ${trackingNumber}`;

  const text = `
Dear ${fullName},

We noticed you started a loan application but haven't completed it yet. We're here to help you finish!

Application Details:
Tracking Number: ${trackingNumber}
Loan Amount: $${formattedAmount}
Purpose: ${loanPurpose}

Complete your application today to:
✓ Get instant approval decision
✓ Access competitive rates
✓ Receive funds within 24-48 hours

Your application is saved and waiting for you. It only takes 5-10 minutes to complete.

Need help? Our support team is ready to assist you:
Phone: (945) 212-1609
Email: support@amerilendloan.com

Best regards,
The AmeriLend Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #0033A0; font-size: 28px;">⏰ Your Application is Waiting!</h1>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">Let's finish what you started</p>
          </div>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin-top: 0; color: #0033A0;">Application Details</h2>
            <table style="width: 100%; margin-top: 15px;">
              <tr style="border-bottom: 1px solid #b3d9ff;">
                <td style="padding: 12px 0; color: #0033A0;"><strong>Tracking Number:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold;">${trackingNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #b3d9ff;">
                <td style="padding: 12px 0; color: #0033A0;"><strong>Loan Amount:</strong></td>
                <td style="padding: 12px 0; text-align: right;">$${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #0033A0;"><strong>Purpose:</strong></td>
                <td style="padding: 12px 0; text-align: right; text-transform: capitalize;">${loanPurpose}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #333;">Why Complete Your Application?</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
              <li style="margin-bottom: 10px;">✓ <strong>Instant Decision:</strong> Get approved in minutes</li>
              <li style="margin-bottom: 10px;">✓ <strong>Fast Funding:</strong> Receive funds within 24-48 hours</li>
              <li style="margin-bottom: 10px;">✓ <strong>Competitive Rates:</strong> Best rates for qualified applicants</li>
              <li style="margin-bottom: 10px;">✓ <strong>Simple Process:</strong> Only 5-10 minutes to complete</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/dashboard" style="background-color: #0033A0; color: white; padding: 14px 35px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Complete Application Now</a>
          </div>

          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #666; font-size: 13px;">
              <strong>Need Help?</strong><br>
              Phone: <a href="tel:+19452121609" style="color: #0033A0;">(945) 212-1609</a><br>
              Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a>
            </p>
          </div>

          <p style="margin-top: 20px; color: #999; font-size: 12px; text-align: center;">This is an automated reminder. If you've already completed your application, please disregard this message.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  return await sendEmail({ to: email, subject, text, html });
}

/**
 * Send unpaid processing fee reminder email
 */
export async function sendUnpaidFeeReminderEmail(
  email: string,
  fullName: string,
  loanAmount: number,
  processingFee: number,
  trackingNumber: string
): Promise<{ success: boolean; error?: string }> {
  const formattedAmount = formatCurrency(loanAmount);
  const formattedFee = formatCurrency(processingFee);
  const subject = `Payment Required: Processing Fee for Loan ${trackingNumber}`;

  const text = `
Dear ${fullName},

Congratulations! Your loan application has been approved. To proceed with disbursement, please pay the processing fee.

Loan Details:
Tracking Number: ${trackingNumber}
Approved Amount: $${formattedAmount}
Processing Fee: $${formattedFee}

Pay your processing fee now to receive your loan funds within 24-48 hours.

Payment Methods Available:
- Credit/Debit Card
- Cryptocurrency (Bitcoin, Ethereum, USDT)

Once payment is confirmed, we'll proceed with disbursement immediately.

Best regards,
The AmeriLend Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #28a745; font-size: 28px;">✅ Loan Approved!</h1>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">One final step to receive your funds</p>
          </div>

          <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin-top: 0; color: #155724;">Your Loan is Approved!</h2>
            <p style="margin: 0; color: #155724;">Pay the processing fee below to receive your funds within 24-48 hours.</p>
          </div>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #856404;">Payment Required</h3>
            <table style="width: 100%; margin-top: 15px;">
              <tr style="border-bottom: 1px solid #ffeaa7;">
                <td style="padding: 12px 0; color: #856404;"><strong>Tracking Number:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold;">${trackingNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #ffeaa7;">
                <td style="padding: 12px 0; color: #856404;"><strong>Approved Amount:</strong></td>
                <td style="padding: 12px 0; text-align: right;">$${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #856404;"><strong>Processing Fee:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-size: 18px; font-weight: bold; color: #d39e00;">$${formattedFee}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #333;">Payment Methods</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
              <li style="margin-bottom: 8px;">💳 Credit/Debit Card (Instant)</li>
              <li style="margin-bottom: 8px;">₿ Bitcoin</li>
              <li style="margin-bottom: 8px;">Ξ Ethereum</li>
              <li style="margin-bottom: 8px;">💵 USDT (Tether)</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/dashboard" style="background-color: #ffc107; color: #000; padding: 14px 35px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Pay Processing Fee Now</a>
          </div>

          <div style="background-color: #e7f3ff; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #0033A0; font-size: 14px;">
              <strong>⚡ Fast Processing:</strong> Once payment is confirmed, your loan will be disbursed within 24-48 hours!
            </p>
          </div>

          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #666; font-size: 13px;">
              <strong>Questions?</strong><br>
              Phone: <a href="tel:+19452121609" style="color: #0033A0;">(945) 212-1609</a><br>
              Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a>
            </p>
          </div>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  return await sendEmail({ to: email, subject, text, html });
}

/**
 * Send pending disbursement method reminder email
 */
export async function sendPendingDisbursementReminderEmail(
  email: string,
  fullName: string,
  loanAmount: number,
  trackingNumber: string
): Promise<{ success: boolean; error?: string }> {
  const formattedAmount = formatCurrency(loanAmount);
  const subject = `Action Required: Choose Disbursement Method - ${trackingNumber}`;

  const text = `
Dear ${fullName},

Your processing fee has been received. To release your loan funds, please choose how you would like to receive them.

Loan Details:
Tracking Number: ${trackingNumber}
Loan Amount: $${formattedAmount}

Choose how you want to receive your funds:
- Bank Transfer (ACH) - 1-2 business days
- Cryptocurrency Wallet - Instant

Set up your disbursement method now to receive your funds as soon as possible.

Best regards,
The AmeriLend Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #0033A0; font-size: 28px;">💰 Ready to Receive Your Funds!</h1>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">Choose your disbursement method</p>
          </div>

          <div style="background-color: #d1ecf1; border-left: 4px solid #17a2b8; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin-top: 0; color: #0c5460;">Payment Received!</h2>
            <p style="margin: 0; color: #0c5460;">Your processing fee has been confirmed. Now choose how you want to receive your loan.</p>
          </div>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #0033A0;">Loan Details</h3>
            <table style="width: 100%; margin-top: 15px;">
              <tr style="border-bottom: 1px solid #b3d9ff;">
                <td style="padding: 12px 0; color: #0033A0;"><strong>Tracking Number:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold;">${trackingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #0033A0;"><strong>Loan Amount:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-size: 18px; font-weight: bold; color: #28a745;">$${formattedAmount}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #333;">Choose Your Disbursement Method</h3>
            <div style="margin: 15px 0;">
              <div style="padding: 15px; background-color: white; border: 2px solid #0033A0; border-radius: 8px; margin-bottom: 10px;">
                <h4 style="margin: 0 0 5px 0; color: #0033A0;">🏦 Bank Transfer (ACH)</h4>
                <p style="margin: 0; color: #666; font-size: 14px;">Receive funds in 1-2 business days</p>
              </div>
              <div style="padding: 15px; background-color: white; border: 2px solid #ffc107; border-radius: 8px;">
                <h4 style="margin: 0 0 5px 0; color: #856404;">₿ Cryptocurrency Wallet</h4>
                <p style="margin: 0; color: #666; font-size: 14px;">Instant transfer (Bitcoin, Ethereum, USDT)</p>
              </div>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/dashboard" style="background-color: #0033A0; color: white; padding: 14px 35px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Set Up Disbursement Now</a>
          </div>

          <div style="background-color: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>⏰ Quick Action Needed:</strong> Set up your disbursement method to receive your funds as soon as possible!
            </p>
          </div>

          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #666; font-size: 13px;">
              <strong>Need Help?</strong><br>
              Phone: <a href="tel:+19452121609" style="color: #0033A0;">(945) 212-1609</a><br>
              Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a>
            </p>
          </div>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  return await sendEmail({ to: email, subject, text, html });
}

/**
 * Send incomplete documents reminder email
 */
export async function sendIncompleteDocumentsReminderEmail(
  email: string,
  fullName: string,
  missingDocuments: string[],
  trackingNumber: string
): Promise<{ success: boolean; error?: string }> {
  const subject = `Action Required: Upload Missing Documents - ${trackingNumber}`;
  const docList = missingDocuments.join(', ');

  const text = `
Dear ${fullName},

To process your loan application, we need you to upload the following required documents:

Missing Documents:
${missingDocuments.map(doc => `- ${doc}`).join('\n')}

Application Tracking Number: ${trackingNumber}

Upload your documents today to move your application forward. We can't proceed without these required documents.

Accepted formats: JPEG, PNG, PDF (max 10MB each)

Best regards,
The AmeriLend Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #ff9800; font-size: 28px;">📄 Documents Required</h1>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">We need a few documents to process your application</p>
          </div>

          <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin-top: 0; color: #e65100;">Missing Documents</h2>
            <p style="margin: 10px 0; color: #e65100;"><strong>Application #:</strong> ${trackingNumber}</p>
            <ul style="margin: 15px 0; padding-left: 20px; color: #e65100;">
              ${missingDocuments.map(doc => `<li style="margin-bottom: 8px;"><strong>${doc}</strong></li>`).join('')}
            </ul>
          </div>

          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #333;">Document Requirements</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
              <li style="margin-bottom: 8px;">✓ Clear and readable images</li>
              <li style="margin-bottom: 8px;">✓ All four corners visible</li>
              <li style="margin-bottom: 8px;">✓ Current and not expired</li>
              <li style="margin-bottom: 8px;">✓ Formats: JPEG, PNG, or PDF</li>
              <li style="margin-bottom: 8px;">✓ Maximum size: 10MB per file</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/dashboard" style="background-color: #ff9800; color: white; padding: 14px 35px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Upload Documents Now</a>
          </div>

          <div style="background-color: #e7f3ff; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #0033A0; font-size: 14px;">
              <strong>⚡ Fast Processing:</strong> Upload your documents today and get approved faster!
            </p>
          </div>

          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #666; font-size: 13px;">
              <strong>Need Help?</strong><br>
              Phone: <a href="tel:+19452121609" style="color: #0033A0;">(945) 212-1609</a><br>
              Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a>
            </p>
          </div>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  return await sendEmail({ to: email, subject, text, html });
}

/**
 * Send inactive user re-engagement reminder email
 */
export async function sendInactiveUserReminderEmail(
  email: string,
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  const subject = `We Miss You! Quick Loan Approval Waiting - AmeriLend`;

  const text = `
Dear ${fullName},

We noticed you created an account with AmeriLend but haven't applied for a loan yet. We're here to help!

Why Choose AmeriLend?
✓ Fast approval in minutes
✓ Competitive interest rates
✓ Flexible loan amounts
✓ Simple application process
✓ Funds within 24-48 hours

Start your loan application today and get the financial assistance you need.

Need help getting started? Our support team is ready to assist you:
Phone: (945) 212-1609
Email: support@amerilendloan.com

Best regards,
The AmeriLend Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #0033A0; font-size: 28px;">👋 We Miss You!</h1>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">Ready to get the funds you need?</p>
          </div>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin-top: 0; color: #0033A0;">Your Account is Ready!</h2>
            <p style="margin: 0; color: #0033A0;">Start your loan application and get approved in minutes.</p>
          </div>

          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #333;">Why AmeriLend?</h3>
            <div style="margin: 15px 0;">
              <div style="padding: 12px; background-color: white; border-radius: 6px; margin-bottom: 10px;">
                <strong style="color: #0033A0;">⚡ Fast Approval</strong>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Get approved in minutes, not days</p>
              </div>
              <div style="padding: 12px; background-color: white; border-radius: 6px; margin-bottom: 10px;">
                <strong style="color: #0033A0;">💰 Competitive Rates</strong>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Best rates for qualified applicants</p>
              </div>
              <div style="padding: 12px; background-color: white; border-radius: 6px; margin-bottom: 10px;">
                <strong style="color: #0033A0;">📱 Simple Process</strong>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Apply online in just 5-10 minutes</p>
              </div>
              <div style="padding: 12px; background-color: white; border-radius: 6px;">
                <strong style="color: #0033A0;">Quick Funding</strong>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Receive funds within 24-48 hours</p>
              </div>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/apply" style="background-color: #0033A0; color: white; padding: 14px 35px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Start Application Now</a>
          </div>

          <div style="background-color: #d4edda; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #155724; font-size: 14px; text-align: center;">
              <strong>💚 Special Offer:</strong> Apply now and get our lowest rates!
            </p>
          </div>

          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #666; font-size: 13px;">
              <strong>Questions? We're Here to Help!</strong><br>
              Phone: <a href="tel:+19452121609" style="color: #0033A0;">(945) 212-1609</a><br>
              Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a>
            </p>
          </div>

          <p style="margin-top: 20px; color: #999; font-size: 12px; text-align: center;">
            If you no longer wish to receive these emails, you can <a href="${COMPANY_INFO.website}/unsubscribe" style="color: #999;">unsubscribe here</a>.
          </p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  return await sendEmail({ to: email, subject, text, html });
}

/**
 * Send document rejection notification to user
 */
export async function sendDocumentRejectedEmail(
  email: string,
  fullName: string,
  documentType: string,
  rejectionReason: string,
  trackingNumber?: string
): Promise<void> {
  const documentLabels: Record<string, string> = {
    drivers_license_front: "Driver's License (Front)",
    drivers_license_back: "Driver's License (Back)",
    passport: "Passport",
    national_id_front: "National ID (Front)",
    national_id_back: "National ID (Back)",
    ssn_card: "Social Security Card",
    bank_statement: "Bank Statement",
    utility_bill: "Utility Bill",
    pay_stub: "Pay Stub",
    tax_return: "Tax Return",
    other: "Document"
  };

  const docLabel = documentLabels[documentType] || "Document";
  const subject = `Document Review - Resubmission Required - AmeriLend`;

  const text = `
Dear ${fullName},

Thank you for submitting your ${docLabel} for verification. After review, we were unable to approve this document.

Document Type: ${docLabel}
Status: ⚠ Rejected
Review Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Reason for Rejection:
${rejectionReason}

${trackingNumber ? `Loan Tracking #: ${trackingNumber}\n` : ''}

Please review the reason above and resubmit a clear, readable image or document. Make sure:
- The document is not blurry or partially cut off
- All text is clearly visible
- The document has not expired (if applicable)
- The document is the correct type

You can resubmit your document through your dashboard at any time.

If you need assistance, please contact our support team.

Best regards,
AmeriLend Verification Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #ffc107; font-size: 28px;">⚠ Document Review</h1>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">We need you to resubmit your document</p>
          </div>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin-top: 0; color: #856404;">Document Review Details</h2>
            <table style="width: 100%; margin-top: 15px;">
              <tr style="border-bottom: 1px solid #ffeaa7;">
                <td style="padding: 12px 0; color: #856404;"><strong>Document Type:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold;">${docLabel}</td>
              </tr>
              <tr style="border-bottom: 1px solid #ffeaa7;">
                <td style="padding: 12px 0; color: #856404;"><strong>Status:</strong></td>
                <td style="padding: 12px 0; text-align: right; color: #d39e00;"><strong>⚠ Needs Resubmission</strong></td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #856404;"><strong>Reviewed On:</strong></td>
                <td style="padding: 12px 0; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #333;">Reason for Rejection</h3>
            <p style="margin: 0; color: #555; font-size: 15px; line-height: 1.8;">${rejectionReason}</p>
          </div>

          ${trackingNumber ? `<div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #0033A0;">Your Application</h3>
            <p style="margin: 10px 0; color: #666;"><strong>Loan Tracking #:</strong> ${trackingNumber}</p>
            <p style="margin: 10px 0; color: #666;">Once you resubmit the document, we will review it again and get back to you as soon as possible.</p>
          </div>` : ''}

          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #333;">How to Resubmit</h3>
            <ol style="margin: 10px 0; padding-left: 20px; color: #666;">
              <li style="margin-bottom: 8px;">Go to your dashboard</li>
              <li style="margin-bottom: 8px;">Find the "Documents" section</li>
              <li style="margin-bottom: 8px;">Upload a clear, readable image of your ${docLabel}</li>
              <li>Submit for verification</li>
            </ol>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/dashboard" style="background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Go to Dashboard</a>
          </div>

          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #666; font-size: 13px;">
              <strong>Need Help?</strong><br>
              Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a>
            </p>
          </div>

          <p style="margin-top: 20px; color: #999; font-size: 12px; text-align: center;">This is an automated notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send admin notification when new document is uploaded (already exists - just documenting)
 */
export async function sendAdminNewDocumentUploadNotification(
  userName: string,
  userEmail: string,
  documentType: string,
  fileName: string
): Promise<void> {
  const documentLabels: Record<string, string> = {
    drivers_license_front: "Driver's License (Front)",
    drivers_license_back: "Driver's License (Back)",
    passport: "Passport",
    national_id_front: "National ID (Front)",
    national_id_back: "National ID (Back)",
    ssn_card: "Social Security Card",
    bank_statement: "Bank Statement",
    utility_bill: "Utility Bill",
    pay_stub: "Pay Stub",
    tax_return: "Tax Return",
    other: "Document"
  };

  const docLabel = documentLabels[documentType] || "Document";
  const subject = `New Document Upload - Review Required - AmeriLend Admin`;

  const text = `
Admin Alert: New document uploaded for verification

User: ${userName}
Email: ${userEmail}
Document Type: ${docLabel}
File Name: ${fileName}
Upload Time: ${new Date().toLocaleString('en-US')}

Please review this document in the admin dashboard and approve or reject it accordingly.

The user will be notified once you take action.

AmeriLend Admin System
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #0033A0; font-size: 24px;">📄 New Document Upload</h1>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">Document pending review</p>
          </div>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin-top: 0; color: #0033A0;">Upload Details</h2>
            <table style="width: 100%; margin-top: 10px;">
              <tr style="border-bottom: 1px solid #b3d9ff;">
                <td style="padding: 8px 0; color: #0033A0;"><strong>User:</strong></td>
                <td style="padding: 8px 0; text-align: right;"><strong>${userName}</strong></td>
              </tr>
              <tr style="border-bottom: 1px solid #b3d9ff;">
                <td style="padding: 8px 0; color: #0033A0;"><strong>Email:</strong></td>
                <td style="padding: 8px 0; text-align: right;"><a href="mailto:${userEmail}" style="color: #0033A0;">${userEmail}</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #b3d9ff;">
                <td style="padding: 8px 0; color: #0033A0;"><strong>Document Type:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${docLabel}</td>
              </tr>
              <tr style="border-bottom: 1px solid #b3d9ff;">
                <td style="padding: 8px 0; color: #0033A0;"><strong>File Name:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${fileName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #0033A0;"><strong>Upload Time:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleString('en-US')}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #856404;"><strong>Action Required:</strong> Please review this document in the admin dashboard and approve or reject it. The user will be notified of your decision.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${COMPANY_INFO.website}/admin/documents" style="background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Review in Dashboard</a>
          </div>

          <p style="margin-top: 30px; color: #999; font-size: 12px; text-align: center;">This is an automated notification. Please do not reply to this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: COMPANY_INFO.admin.email, subject, text, html });
}

/**
 * Send check disbursement tracking notification to user
 */
export async function sendCheckTrackingNotificationEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  trackingCompany: string,
  checkTrackingNumber: string,
  loanAmount: number,
  street?: string,
  city?: string,
  state?: string,
  zipCode?: string
): Promise<void> {
  // Generate tracking links based on carrier
  const trackingLinks: Record<string, { name: string; url: (tn: string) => string }> = {
    "USPS": {
      name: "United States Postal Service",
      url: (tn: string) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tn}`
    },
    "UPS": {
      name: "United Parcel Service",
      url: (tn: string) => `https://www.ups.com/track?tracknum=${tn}`
    },
    "FedEx": {
      name: "Federal Express",
      url: (tn: string) => `https://tracking.fedex.com/en/tracking/${tn}`
    },
    "DHL": {
      name: "DHL Express",
      url: (tn: string) => `https://www.dhl.com/en/en/home/tracking.html?tracking-id=${tn}`
    },
    "Other": {
      name: "Your Tracking Company",
      url: (tn: string) => `#`
    }
  };

  const carrier = trackingLinks[trackingCompany] || trackingLinks["Other"];
  const trackingUrl = trackingCompany !== "Other" ? carrier.url(checkTrackingNumber) : undefined;
  const formattedAmount = formatCurrency(loanAmount);
  
  // Format delivery address
  const deliveryAddress = street && city && state && zipCode
    ? `${street}, ${city}, ${state} ${zipCode}`
    : "Address on file";

  const subject = `Check Disbursement Tracking – AmeriLend Loan #${trackingNumber}`;
  const text = `
Dear ${fullName},

Your check has been sent and is now in transit. The tracking details are below.

CHECK DISBURSEMENT TRACKING INFORMATION
========================================

Recipient Information:
Name: ${fullName}
Delivery Address: ${deliveryAddress}

Loan Tracking #: ${trackingNumber}
Disbursement Amount: $${formattedAmount}
Shipping Carrier: ${carrier.name}
Tracking Number: ${checkTrackingNumber}
Status: In Transit

TRACK YOUR CHECK ONLINE:
${trackingUrl ? `Visit: ${trackingUrl}` : `Enter your tracking number "${checkTrackingNumber}" on ${carrier.name}'s website`}

IMPORTANT INFORMATION:
- Your check is being shipped via ${carrier.name}
- Tracking updates are provided in real-time by ${carrier.name}
- Typical delivery time: 3-7 business days
- Please sign for delivery when it arrives
- If you don't receive your check within 7 business days, please contact us immediately

For questions or concerns about your disbursement, please contact our support team:
Email: support@amerilendloan.com
Phone: (945) 212-1609

Thank you for choosing AmeriLend!

Best regards,
The AmeriLend Disbursement Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background-color: #28a745; color: white; display: inline-block; padding: 15px 25px; border-radius: 8px; font-size: 20px; font-weight: bold;">
              📦 Check In Transit
            </div>
          </div>

          <h1 style="margin: 0 0 10px 0; color: #0033A0; text-align: center; font-size: 28px;">Your Check Has Been Shipped</h1>
          <p style="text-align: center; color: #666; margin-bottom: 30px; font-size: 16px;">
            Track your disbursement using the tracking information below
          </p>

          <div style="background-color: #f0f8ff; border-left: 4px solid #0033A0; padding: 25px; margin-bottom: 30px; border-radius: 5px;">
            <h2 style="margin-top: 0; color: #0033A0; font-size: 18px;">👤 Recipient Information</h2>
            <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #b3d9ff;">
                <td style="padding: 12px 0; color: #0033A0;"><strong>Name:</strong></td>
                <td style="padding: 12px 0; text-align: right;">${fullName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #0033A0;"><strong>Delivery Address:</strong></td>
                <td style="padding: 12px 0; text-align: right;">${deliveryAddress}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 25px; margin-bottom: 30px; border-radius: 5px;">
            <h2 style="margin-top: 0; color: #155724; font-size: 18px;">📋 Tracking Details</h2>
            <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #b8e6c9;">
                <td style="padding: 12px 0; color: #155724;"><strong>Loan Tracking #:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-family: monospace; font-weight: bold; color: #0033A0;">${trackingNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #b8e6c9;">
                <td style="padding: 12px 0; color: #155724;"><strong>Disbursement Amount:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-size: 18px; font-weight: bold; color: #28a745;">$${formattedAmount}</td>
              </tr>
              <tr style="border-bottom: 1px solid #b8e6c9;">
                <td style="padding: 12px 0; color: #155724;"><strong>Shipping Carrier:</strong></td>
                <td style="padding: 12px 0; text-align: right;"><strong>${carrier.name}</strong></td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #155724;"><strong>Status:</strong></td>
                <td style="padding: 12px 0; text-align: right; color: #28a745;"><strong>✓ In Transit</strong></td>
              </tr>
            </table>
          </div>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 25px; margin-bottom: 30px; border-radius: 5px;">
            <h2 style="margin-top: 0; color: #0033A0; font-size: 18px;">🔍 Your Tracking Number</h2>
            <div style="background-color: white; border: 2px dashed #0033A0; padding: 20px; text-align: center; border-radius: 5px; margin: 15px 0;">
              <p style="margin: 0; color: #666; font-size: 12px; font-weight: bold; text-transform: uppercase;">${trackingCompany} Tracking Number</p>
              <p style="margin: 8px 0 0 0; color: #0033A0; font-size: 28px; font-family: monospace; font-weight: bold; word-break: break-all;">${checkTrackingNumber}</p>
            </div>
            <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.6;">
              Save this tracking number to monitor your check's delivery status. You can use it to track your package online or contact ${carrier.name} customer service if you have any questions.
            </p>
          </div>

          ${trackingUrl ? `
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${trackingUrl}" style="background-color: #FFA500; color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
              Track Your Check Online →
            </a>
          </div>
          ` : `
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 30px; border-radius: 5px;">
            <p style="margin: 0; color: #856404;"><strong>📌 How to Track:</strong> Visit ${carrier.name}'s website and enter your tracking number "<strong>${checkTrackingNumber}</strong>" to monitor delivery status.</p>
          </div>
          `}

          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
            <h3 style="margin-top: 0; color: #0033A0; font-size: 18px;">ℹ️ Important Information</h3>
            <ul style="margin: 15px 0; padding-left: 20px; color: #555; line-height: 2;">
              <li><strong>Delivery Time:</strong> Typically 3-7 business days from shipment</li>
              <li><strong>Signature Required:</strong> Please be present to sign for delivery</li>
              <li><strong>Real-Time Updates:</strong> ${carrier.name} will provide tracking updates automatically</li>
              <li><strong>Delivery Confirmation:</strong> You will receive an email once delivered</li>
              <li><strong>Issues?:</strong> Contact us within 7 days if you don't receive your check</li>
            </ul>
          </div>

          <div style="background-color: #f0f8ff; border: 1px solid #b3d9ff; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">✓ What to Expect</h3>
            <ol style="margin: 10px 0; padding-left: 20px; color: #555; line-height: 1.8;">
              <li>Check is picked up by ${carrier.name}</li>
              <li>Tracking information becomes available (may take 24 hours)</li>
              <li>Check moves through ${carrier.name}'s distribution network</li>
              <li>Delivery attempt to your address</li>
              <li>You receive and sign for the check</li>
            </ol>
          </div>

          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #856404;">⚠️ Important</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #856404; line-height: 1.8;">
              <li>Be sure to sign for the check upon delivery</li>
              <li>Do not leave the check unattended</li>
              <li>If you're not home, ${carrier.name} will leave a notice with delivery instructions</li>
              <li>Contact support immediately if delivery address is incorrect</li>
              <li>If the check is not received within 7 business days, please notify us</li>
            </ul>
          </div>

          <hr style="border: none; border-top: 2px solid #eee; margin: 30px 0;">

          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0; font-size: 16px;">Need Help?</h3>
            <p style="margin: 5px 0; color: #666; font-size: 14px;">
              If you have questions about your disbursement or tracking:
            </p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #666; font-size: 13px;">
              <li><strong>AmeriLend Support:</strong> <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a></li>
              <li><strong>Phone:</strong> (945) 212-1609</li>
              <li><strong>Carrier Support:</strong> Contact ${carrier.name} with your tracking number for shipping questions</li>
              <li><strong>Dashboard:</strong> <a href="${COMPANY_INFO.website}/dashboard" style="color: #0033A0;">View Your Loan</a></li>
            </ul>
          </div>

          <p style="margin-top: 30px; color: #999; font-size: 12px; text-align: center;">
            This is an automated notification from AmeriLend. Please do not reply to this email. For inquiries, contact our support team using the information above.
          </p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    logger.warn(`[Email] Failed to send check tracking notification to ${email}`, { error: result.error });
  }
}

/**
 * Send payment overdue alert email (when payment is past due)
 */
export async function sendPaymentOverdueAlertEmail(
  email: string,
  fullName: string,
  loanNumber: string,
  dueAmount: number,
  daysOverdue: number,
  originalDueDate: Date,
  paymentLink?: string
): Promise<void> {
  const originalDueDateFormatted = originalDueDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dueAmountFormatted = formatCurrency(dueAmount);

  const subject = `⚠️ URGENT: Payment Overdue - ${loanNumber}`;
  const text = `Dear ${fullName},\n\nYour loan payment is now ${daysOverdue} days overdue.\n\nPayment Details:\nLoan Number: ${loanNumber}\nAmount Due: $${dueAmountFormatted}\nOriginal Due Date: ${originalDueDateFormatted}\nDays Overdue: ${daysOverdue}\n\nIMPORTANT: Please make payment immediately to avoid:\n- Additional late fees\n- Delinquency on your credit report\n- Potential legal action\n\n${
    paymentLink ? `Make Payment: ${paymentLink}\n\n` : ""
  }If you are experiencing financial hardship, please contact our support team immediately.\n\nBest regards,\nThe AmeriLend Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #d32f2f; margin-top: 0;">⚠️ URGENT: Payment Overdue</h2>
          <p>Dear ${fullName},</p>
          <p style="color: #d32f2f; font-weight: bold;">Your loan payment is <strong>${daysOverdue} days overdue</strong>.</p>

          <div style="background-color: #ffebee; padding: 20px; border-left: 4px solid #d32f2f; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 5px 0;"><strong>Loan Number:</strong> ${loanNumber}</p>
            <p style="margin: 5px 0;"><strong>Amount Due:</strong> $${dueAmountFormatted}</p>
            <p style="margin: 5px 0;"><strong>Original Due Date:</strong> ${originalDueDateFormatted}</p>
            <p style="margin: 5px 0;"><strong>Days Overdue:</strong> ${daysOverdue}</p>
          </div>

          <p style="color: #d32f2f;"><strong>⚠️ Immediate Action Required</strong></p>
          <p>Please make payment immediately to avoid:</p>
          <ul style="color: #d32f2f;">
            <li>Additional late fees and penalties</li>
            <li>Negative impact on your credit score</li>
            <li>Delinquency status on your account</li>
            <li>Potential legal action</li>
          </ul>

          ${
            paymentLink
              ? `<p style="text-align: center; margin: 30px 0;">
            <a href="${paymentLink}" style="background-color: #d32f2f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Pay Now</a>
          </p>`
              : ""
          }

          <p style="background-color: #fff3e0; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <strong>Experiencing Financial Hardship?</strong><br>
            If you're unable to make a full payment, please <a href="https://amerilendloan.com/support" style="color: #0033A0;">contact our support team</a> to discuss payment options or hardship programs.
          </p>

          <p style="margin-top: 30px; color: #999; font-size: 12px; text-align: center;">
            This is an automated notification from AmeriLend. Please do not reply to this email. For urgent inquiries, contact our support team.
          </p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    logger.warn(`[Email] Failed to send payment overdue alert to ${email}`, { error: result.error });
  }
}

/**
 * Send payment received confirmation email
 */
export async function sendPaymentReceivedEmail(
  email: string,
  fullName: string,
  loanNumber: string,
  paymentAmount: number,
  paymentDate: Date,
  paymentMethod: string,
  newBalance?: number
): Promise<void> {
  const paymentDateFormatted = paymentDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const paymentAmountFormatted = formatCurrency(paymentAmount);
  const newBalanceFormatted = newBalance ? formatCurrency(newBalance) : "N/A";

  const subject = `Payment Received - ${loanNumber}`;
  const text = `Dear ${fullName},\n\nWe have received your payment.\n\nPayment Details:\nLoan Number: ${loanNumber}\nAmount Paid: $${paymentAmountFormatted}\nPayment Date: ${paymentDateFormatted}\nPayment Method: ${paymentMethod}\nNew Balance: $${newBalanceFormatted}\n\nThank you for your on-time payment.\n\nBest regards,\nThe AmeriLend Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #28a745; margin-top: 0;">✓ Payment Received</h2>
          <p>Dear ${fullName},</p>
          <p>Thank you! We have successfully received your payment.</p>

          <div style="background-color: #e8f5e9; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 5px 0;"><strong>Loan Number:</strong> ${loanNumber}</p>
            <p style="margin: 5px 0;"><strong>Amount Paid:</strong> $${paymentAmountFormatted}</p>
            <p style="margin: 5px 0;"><strong>Payment Date:</strong> ${paymentDateFormatted}</p>
            <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${paymentMethod}</p>
            <p style="margin: 5px 0;"><strong>New Balance:</strong> $${newBalanceFormatted}</p>
          </div>

          <p>Your payment has been applied to your account. You can view your updated payment schedule and account balance in your dashboard.</p>

          <p style="text-align: center; margin: 30px 0;">
            <a href="https://amerilendloan.com/payment-history" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">View Payment History</a>
          </p>

          <p><strong>Next Payment:</strong> Check your dashboard or next reminder email for your next payment due date.</p>
          <p>Thank you for choosing AmeriLend and for your on-time payment!</p>

          <p style="margin-top: 30px; color: #999; font-size: 12px; text-align: center;">
            This is an automated notification from AmeriLend. Please do not reply to this email. For inquiries, contact our support team.
          </p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    logger.warn(`[Email] Failed to send payment received confirmation to ${email}`, { error: result.error });
  }
}

/**
 * Send payment failed alert email
 */
export async function sendPaymentFailedEmail(
  email: string,
  fullName: string,
  loanNumber: string,
  paymentAmount: number,
  failureReason: string,
  paymentLink?: string
): Promise<void> {
  const paymentAmountFormatted = formatCurrency(paymentAmount);

  const subject = `Payment Failed - Action Required - ${loanNumber}`;
  const text = `Dear ${fullName},\n\nYour payment attempt failed.\n\nPayment Details:\nLoan Number: ${loanNumber}\nAttempted Amount: $${paymentAmountFormatted}\nReason: ${failureReason}\n\nPlease try again or use a different payment method.\n\n${
    paymentLink ? `Retry Payment: ${paymentLink}\n\n` : ""
  }If the problem persists, please contact our support team.\n\nBest regards,\nThe AmeriLend Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #ff9800; margin-top: 0;">⚠️ Payment Failed</h2>
          <p>Dear ${fullName},</p>
          <p>Unfortunately, your payment attempt was unsuccessful.</p>

          <div style="background-color: #fff3e0; padding: 20px; border-left: 4px solid #ff9800; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 5px 0;"><strong>Loan Number:</strong> ${loanNumber}</p>
            <p style="margin: 5px 0;"><strong>Attempted Amount:</strong> $${paymentAmountFormatted}</p>
            <p style="margin: 5px 0;"><strong>Reason:</strong> ${failureReason}</p>
          </div>

          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>Check your payment method for sufficient funds</li>
            <li>Verify your card or bank account is not expired</li>
            <li>Try again with a different payment method</li>
            <li>Contact your bank if you think the decline was a mistake</li>
          </ul>

          ${
            paymentLink
              ? `<p style="text-align: center; margin: 30px 0;">
            <a href="${paymentLink}" style="background-color: #ff9800; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Retry Payment</a>
          </p>`
              : ""
          }

          <p style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <strong>Need Help?</strong><br>
            If the issue persists, please <a href="https://amerilendloan.com/support" style="color: #0033A0;">contact our support team</a> for assistance.
          </p>

          <p style="margin-top: 30px; color: #999; font-size: 12px; text-align: center;">
            This is an automated notification from AmeriLend. Please do not reply to this email.
          </p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    logger.warn(`[Email] Failed to send payment failure notification to ${email}`, { error: result.error });
  }
}

/**
 * Send reminder email for fee payment
 */
export async function sendFeePaymentReminderEmail(
  email: string,
  fullName: string,
  applicationId: number,
  approvedAmount: number,
  feeAmount: number
): Promise<void> {
  const formattedAmount = formatCurrency(approvedAmount);
  const formattedFee = formatCurrency(feeAmount);
  const subject = "Payment Reminder: Complete Your Loan Processing - AmeriLend";
  const text = `Dear ${fullName},\n\nThis is a friendly reminder that your loan application (#${applicationId}) has been approved for $${formattedAmount}, but we're still waiting for your processing fee payment of $${formattedFee}.\n\nTo complete your loan and receive your funds:\n1. Log in to your dashboard\n2. Navigate to your application\n3. Complete the fee payment\n\nOnce your fee is paid, we'll process your disbursement within 1-2 business days.\n\nIf you have any questions or need assistance, please contact our support team.\n\nBest regards,\nThe AmeriLend Team`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #0033A0; margin-top: 0;">⏰ Payment Reminder</h2>
          <p>Dear ${fullName},</p>
          <p>This is a friendly reminder about your approved loan application.</p>
          
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #856404;">Action Required</h3>
            <p style="margin: 5px 0;"><strong>Application ID:</strong> #${applicationId}</p>
            <p style="margin: 5px 0;"><strong>Approved Amount:</strong> $${formattedAmount}</p>
            <p style="margin: 5px 0;"><strong>Processing Fee:</strong> $${formattedFee}</p>
            <p style="margin: 5px 0; color: #856404;"><strong>Status:</strong> Awaiting Fee Payment</p>
          </div>

          <h3 style="color: #0033A0;">Complete Your Loan Process</h3>
          <ol style="padding-left: 20px;">
            <li>Log in to your AmeriLend dashboard</li>
            <li>Navigate to your loan application</li>
            <li>Complete the processing fee payment</li>
            <li>Receive your funds within 1-2 business days</li>
          </ol>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://amerilendloan.com/dashboard" style="display: inline-block; background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Pay Fee Now</a>
          </div>

          <p style="margin-top: 30px;">If you have any questions or need assistance, please contact our support team at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a>.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send reminder email for document upload
 */
export async function sendDocumentUploadReminderEmail(
  email: string,
  fullName: string,
  applicationId: number,
  missingDocuments: string[]
): Promise<void> {
  const subject = "Action Required: Upload Missing Documents - AmeriLend";
  const docList = missingDocuments.join(", ");
  const text = `Dear ${fullName},\n\nWe noticed that your loan application (#${applicationId}) is missing some required documents.\n\nMissing Documents:\n${missingDocuments.map(doc => `- ${doc}`).join('\n')}\n\nTo proceed with your application:\n1. Log in to your dashboard\n2. Navigate to your application\n3. Upload the required documents\n\nUploading these documents will help us process your application faster.\n\nIf you have any questions, please contact our support team.\n\nBest regards,\nThe AmeriLend Team`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #0033A0; margin-top: 0;">📄 Documents Required</h2>
          <p>Dear ${fullName},</p>
          <p>We're reviewing your loan application (#${applicationId}) and noticed that some required documents are missing.</p>
          
          <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #721c24;">Missing Documents</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${missingDocuments.map(doc => `<li>${doc}</li>`).join('')}
            </ul>
          </div>

          <h3 style="color: #0033A0;">How to Upload Documents</h3>
          <ol style="padding-left: 20px;">
            <li>Log in to your AmeriLend dashboard</li>
            <li>Navigate to your loan application</li>
            <li>Click on "Upload Documents"</li>
            <li>Select and upload the required files</li>
          </ol>

          <div style="background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #0c5460;"><strong>💡 Tip:</strong> Uploading clear, legible copies of your documents will help us process your application faster!</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://amerilendloan.com/dashboard" style="display: inline-block; background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Upload Documents</a>
          </div>

          <p style="margin-top: 30px;">If you have any questions about which documents to upload, please contact our support team at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a>.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Payment Due Reminder Email (7, 3, or 1 day before due date)
 */
export async function sendPaymentDueReminderEmail(
  email: string,
  userName: string,
  trackingNumber: string,
  paymentAmount: number,
  daysUntilDue: number
) {
  const formattedAmount = formatCurrency(paymentAmount);
  const urgencyClass = daysUntilDue === 1 ? 'urgent' : 'warning';
  
  const subject = `⏰ Payment Reminder: ${daysUntilDue} Day${daysUntilDue > 1 ? 's' : ''} Until Due - Loan #${trackingNumber}`;
  
  const text = `
Hello ${userName},

This is a friendly reminder that your loan payment is due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}.

Loan Details:
- Tracking Number: ${trackingNumber}
- Payment Amount: $${formattedAmount}
- Due Date: ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''} from today

To avoid late fees, please make your payment before the due date.

You can make a payment by:
1. Card Payment (Stripe) - Pay securely with Visa, Mastercard, Amex, Apple Pay, or Google Pay
2. Cryptocurrency - Pay with Bitcoin (BTC), Ethereum (ETH), USDT, or USDC

Visit https://amerilendloan.com/pay-fee to make your payment now.

Thank you for being a valued AmeriLend customer!

Best regards,
The AmeriLend Team
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        ${getEmailHeader()}
        <div style="padding: 20px;">
          <h2 style="color: #0033A0; margin-bottom: 20px;">⏰ Payment Reminder</h2>

          <p>Hello <strong>${userName}</strong>,</p>

          <p>This is a friendly reminder that your loan payment is due in <strong>${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}</strong>.</p>

          <div style="background-color: ${daysUntilDue === 1 ? '#fff3cd' : '#f8f9fa'}; border-left: 4px solid ${daysUntilDue === 1 ? '#ffc107' : '#0033A0'}; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">Payment Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0;"><strong>Tracking Number:</strong></td>
                <td style="padding: 8px 0;">${trackingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Payment Amount:</strong></td>
                <td style="padding: 8px 0; font-size: 20px; color: #0033A0; font-weight: bold;">$${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Due Date:</strong></td>
                <td style="padding: 8px 0;">${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''} from today</td>
              </tr>
            </table>
          </div>

          ${daysUntilDue === 1 ? `
            <div style="background-color: #dc3545; color: white; padding: 15px; margin: 20px 0; border-radius: 5px; text-align: center;">
              <strong>⚠️ URGENT: Payment due tomorrow!</strong><br>
              Please make your payment today to avoid late fees.
            </div>
          ` : ''}

          <h3 style="color: #0033A0; margin-top: 30px;">How to Make a Payment</h3>
          <p style="margin-bottom: 15px;">Choose your preferred payment method below:</p>

          <!-- Payment Methods Section -->
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; text-align: center; width: 50%; vertical-align: top;">
                  <div style="background-color: white; border: 2px solid #635BFF; border-radius: 8px; padding: 15px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">💳</div>
                    <h4 style="color: #635BFF; margin: 0 0 8px 0; font-size: 16px;">Card Payment</h4>
                    <p style="color: #666; font-size: 12px; margin: 0 0 12px 0;">Pay securely with Visa, Mastercard, Amex, Apple Pay, or Google Pay via Stripe</p>
                    <a href="https://amerilendloan.com/pay-fee" style="display: inline-block; background-color: #635BFF; color: white; padding: 10px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">Pay with Card</a>
                  </div>
                </td>
                <td style="padding: 10px; text-align: center; width: 50%; vertical-align: top;">
                  <div style="background-color: white; border: 2px solid #F7931A; border-radius: 8px; padding: 15px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">🪙</div>
                    <h4 style="color: #F7931A; margin: 0 0 8px 0; font-size: 16px;">Cryptocurrency</h4>
                    <p style="color: #666; font-size: 12px; margin: 0 0 12px 0;">Pay with Bitcoin (BTC), Ethereum (ETH), USDT, or USDC</p>
                    <a href="https://amerilendloan.com/pay-fee" style="display: inline-block; background-color: #F7931A; color: white; padding: 10px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">Pay with Crypto</a>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://amerilendloan.com/dashboard" style="display: inline-block; background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Dashboard</a>
          </div>

          <div style="background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #0c5460;"><strong>💡 Pro Tip:</strong> Set up auto-pay in your dashboard to never miss a payment again!</p>
          </div>

          <p style="margin-top: 30px;">If you've already made this payment, please disregard this reminder. If you have any questions, contact us at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a>.</p>

          <p>Thank you for being a valued AmeriLend customer!</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Overdue Payment Email
 */
export async function sendPaymentOverdueEmail(
  email: string,
  userName: string,
  trackingNumber: string,
  paymentAmount: number,
  daysOverdue: number
) {
  const formattedAmount = formatCurrency(paymentAmount);
  const lateFee = Math.round(paymentAmount * 0.05); // 5% late fee
  const formattedLateFee = formatCurrency(lateFee);
  const totalDue = paymentAmount + lateFee;
  const formattedTotal = formatCurrency(totalDue);
  
  const subject = `🚨 URGENT: Payment Overdue - Loan #${trackingNumber}`;
  
  const text = `
URGENT: Payment Overdue

Hello ${userName},

Your loan payment is now ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue.

Loan Details:
- Tracking Number: ${trackingNumber}
- Original Payment Amount: $${formattedAmount}
- Late Fee (5%): $${formattedLateFee}
- Total Amount Due: $${formattedTotal}
- Days Overdue: ${daysOverdue}

IMMEDIATE ACTION REQUIRED

Please make your payment immediately to avoid additional fees and potential impact to your credit score.

To make a payment:
1. Card Payment (Stripe) - Pay securely with Visa, Mastercard, Amex, Apple Pay, or Google Pay
2. Cryptocurrency - Pay with Bitcoin (BTC), Ethereum (ETH), USDT, or USDC

Visit https://amerilendloan.com/pay-fee to make your payment now.

If you're experiencing financial difficulties, please contact us immediately to discuss payment options.

Contact: ${COMPANY_INFO.contact.email} or ${COMPANY_INFO.contact.phone}

The AmeriLend Team
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        ${getEmailHeader()}
        <div style="padding: 20px;">
          <div style="background-color: #dc3545; color: white; padding: 20px; margin: 0 -20px 20px -20px; text-align: center;">
            <h2 style="margin: 0;">🚨 URGENT: Payment Overdue</h2>
          </div>

          <p>Hello <strong>${userName}</strong>,</p>

          <p style="font-size: 16px; color: #dc3545;"><strong>Your loan payment is now ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue.</strong></p>

          <div style="background-color: #fff3cd; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #dc3545;">Payment Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0;"><strong>Tracking Number:</strong></td>
                <td style="padding: 8px 0;">${trackingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Original Payment:</strong></td>
                <td style="padding: 8px 0;">$${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Late Fee (5%):</strong></td>
                <td style="padding: 8px 0; color: #dc3545;">$${formattedLateFee}</td>
              </tr>
              <tr style="border-top: 2px solid #dc3545;">
                <td style="padding: 8px 0;"><strong>Total Amount Due:</strong></td>
                <td style="padding: 8px 0; font-size: 24px; color: #dc3545; font-weight: bold;">$${formattedTotal}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Days Overdue:</strong></td>
                <td style="padding: 8px 0; color: #dc3545; font-weight: bold;">${daysOverdue} day${daysOverdue > 1 ? 's' : ''}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #dc3545; color: white; padding: 20px; margin: 20px 0; border-radius: 5px; text-align: center;">
            <h3 style="margin-top: 0;">⚠️ IMMEDIATE ACTION REQUIRED</h3>
            <p style="margin-bottom: 0; font-size: 16px;">Please make your payment immediately to avoid:</p>
            <ul style="text-align: left; margin: 10px auto; max-width: 400px;">
              <li>Additional late fees</li>
              <li>Potential credit score impact</li>
              <li>Collection proceedings</li>
              <li>Legal action</li>
            </ul>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">Make Payment Now</h3>
          <p style="margin-bottom: 15px;">Choose your preferred payment method:</p>

          <!-- Payment Methods Section -->
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; text-align: center; width: 50%; vertical-align: top;">
                  <div style="background-color: white; border: 2px solid #635BFF; border-radius: 8px; padding: 15px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">💳</div>
                    <h4 style="color: #635BFF; margin: 0 0 8px 0; font-size: 16px;">Card Payment</h4>
                    <p style="color: #666; font-size: 12px; margin: 0 0 12px 0;">Visa, Mastercard, Amex, Apple Pay, Google Pay via Stripe</p>
                    <a href="https://amerilendloan.com/pay-fee" style="display: inline-block; background-color: #635BFF; color: white; padding: 10px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">Pay with Card</a>
                  </div>
                </td>
                <td style="padding: 10px; text-align: center; width: 50%; vertical-align: top;">
                  <div style="background-color: white; border: 2px solid #F7931A; border-radius: 8px; padding: 15px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">🪙</div>
                    <h4 style="color: #F7931A; margin: 0 0 8px 0; font-size: 16px;">Cryptocurrency</h4>
                    <p style="color: #666; font-size: 12px; margin: 0 0 12px 0;">Bitcoin (BTC), Ethereum (ETH), USDT, or USDC</p>
                    <a href="https://amerilendloan.com/pay-fee" style="display: inline-block; background-color: #F7931A; color: white; padding: 10px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">Pay with Crypto</a>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://amerilendloan.com/dashboard" style="display: inline-block; background-color: #dc3545; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 18px;">PAY NOW</a>
          </div>

          <div style="background-color: #f8f9fa; border-left: 4px solid #0033A0; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #0033A0;">Need Help?</h4>
            <p style="margin-bottom: 0;">If you're experiencing financial difficulties, please contact us immediately to discuss payment options or hardship programs.</p>
            <p style="margin-top: 10px; margin-bottom: 0;">
              📧 <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a><br>
              📞 ${COMPANY_INFO.contact.phone}
            </p>
          </div>

          <p style="margin-top: 30px; font-size: 14px; color: #666;">If you've already made this payment, please disregard this notice and allow 2-3 business days for processing.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Payment Confirmation Email (Auto-Pay Success)
 */
export async function sendPaymentConfirmationEmail(
  email: string,
  userName: string,
  trackingNumber: string,
  paymentAmount: number,
  paymentMethod: string
) {
  const formattedAmount = formatCurrency(paymentAmount);
  
  const subject = `✅ Payment Processed Successfully - Loan #${trackingNumber}`;
  
  const text = `
Hello ${userName},

Your automatic payment has been processed successfully!

Payment Details:
- Tracking Number: ${trackingNumber}
- Amount Paid: $${formattedAmount}
- Payment Method: ${paymentMethod}
- Status: Completed

This payment was automatically charged to your saved payment method.

You can view your payment history and manage auto-pay settings in your AmeriLend dashboard.

Thank you for your payment!

Best regards,
The AmeriLend Team
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        ${getEmailHeader()}
        <div style="padding: 20px;">
          <div style="background-color: #10b981; color: white; padding: 20px; margin: 0 -20px 20px -20px; text-align: center; border-radius: 5px;">
            <h2 style="margin: 0;">✅ Payment Processed Successfully</h2>
          </div>

          <p>Hello <strong>${userName}</strong>,</p>

          <p style="font-size: 16px;">Your automatic payment has been processed successfully!</p>

          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #10b981;">Payment Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0;"><strong>Tracking Number:</strong></td>
                <td style="padding: 8px 0;">${trackingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Amount Paid:</strong></td>
                <td style="padding: 8px 0; font-size: 20px; color: #10b981; font-weight: bold;">$${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Payment Method:</strong></td>
                <td style="padding: 8px 0;">${paymentMethod}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Status:</strong></td>
                <td style="padding: 8px 0;"><span style="background-color: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">Completed</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Processed:</strong></td>
                <td style="padding: 8px 0;">${new Date().toLocaleDateString()}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #0c4a6e;"><strong>ℹ️ Auto-Pay Information:</strong> This payment was automatically charged to your saved payment method. You can manage your auto-pay settings anytime in your dashboard.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://amerilendloan.com/dashboard" style="display: inline-block; background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Dashboard</a>
          </div>

          <p style="margin-top: 30px;">If you have any questions about this payment, please contact us at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a>.</p>

          <p>Thank you for being a valued AmeriLend customer!</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send invitation code email to potential borrower
 */
export async function sendInvitationCodeEmail(
  email: string,
  recipientName: string,
  code: string,
  offer: {
    amount?: number;
    apr?: number;
    termMonths?: number;
    description?: string;
    expiresAt: Date;
  }
): Promise<void> {
  const subject = `You're Invited! Your Exclusive AmeriLend Offer Code: ${code}`;

  const offerDetailsHtml = offer.amount
    ? `
      <div style="background: linear-gradient(135deg, #C9A227 0%, #e6c84d 100%); padding: 25px; margin: 20px 0; border-radius: 12px; color: white; text-align: center;">
        <p style="margin: 0 0 5px; font-size: 14px; opacity: 0.9;">Pre-Approved Amount</p>
        <p style="margin: 0; font-size: 36px; font-weight: bold;">$${offer.amount.toLocaleString()}</p>
        ${offer.apr ? `<p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">As low as ${offer.apr.toFixed(2)}% APR</p>` : ""}
        ${offer.termMonths ? `<p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">${offer.termMonths}-month term</p>` : ""}
      </div>
    `
    : "";

  const redeemUrl = `https://amerilendloan.com/check-offers?code=${encodeURIComponent(code)}`;
  const text = `Hello ${recipientName}, you've been invited to apply at AmeriLend with code: ${code}. Visit ${redeemUrl} to redeem. Expires ${offer.expiresAt.toLocaleDateString()}.`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background-color: #0A2540; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; color: #C9A227; font-size: 28px;">Ameri<span style="color: white;">Lend</span></h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Your Exclusive Invitation</p>
      </div>

      <div style="padding: 30px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 18px;">Hello <strong>${recipientName}</strong>,</p>

        <p>You've been personally invited to explore a loan offer from AmeriLend. Use your exclusive invitation code below to see your personalized terms.</p>

        <div style="background-color: #f8f9fa; border: 2px dashed #C9A227; padding: 20px; margin: 20px 0; border-radius: 10px; text-align: center;">
          <p style="margin: 0 0 5px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666;">Your Invitation Code</p>
          <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #0A2540; font-family: monospace;">${code}</p>
        </div>

        ${offerDetailsHtml}

        ${offer.description ? `<p style="background: #f0f7f6; padding: 15px; border-radius: 8px; color: #0A2540; font-style: italic;">${offer.description}</p>` : ""}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${redeemUrl}" style="display: inline-block; background-color: #C9A227; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Redeem Your Code</a>
        </div>

        <p style="font-size: 13px; color: #888; text-align: center;">
          This code expires on <strong>${offer.expiresAt.toLocaleDateString()}</strong>.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />

        <p style="font-size: 12px; color: #999; text-align: center;">
          AmeriLend | <a href="https://amerilendloan.com" style="color: #C9A227;">amerilendloan.com</a><br />
          Questions? Email us at support@amerilendloan.com or call (945) 212-1609
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send daily reminder email to invited users who haven't registered yet
 */
export async function sendInvitationReminderEmail(
  email: string,
  recipientName: string,
  code: string,
  offer: {
    amount?: number;
    apr?: number;
    termMonths?: number;
    expiresAt: Date;
  },
  reminderCount: number
): Promise<{ success: boolean; error?: string }> {
  const daysLeft = Math.max(0, Math.ceil((offer.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const urgency = daysLeft <= 3 ? "⏰ Expiring Soon!" : daysLeft <= 7 ? "⏳ Don't Miss Out!" : "🎁 Reminder";

  const subject = `${urgency} Your Exclusive AmeriLend Offer Code ${code} is Waiting`;

  const offerLine = offer.amount
    ? `$${offer.amount.toLocaleString()}${offer.apr ? ` at ${offer.apr.toFixed(2)}% APR` : ""}${offer.termMonths ? ` for ${offer.termMonths} months` : ""}`
    : "a personalized loan offer";

  const redeemUrl = `https://amerilendloan.com/check-offers?code=${encodeURIComponent(code)}`;
  const text = `
Hello ${recipientName},

This is a friendly reminder that your exclusive AmeriLend invitation code ${code} is still available!

Your offer: ${offerLine}
Days remaining: ${daysLeft}

Visit ${redeemUrl} to redeem your code and see your personalized terms.

This offer expires on ${offer.expiresAt.toLocaleDateString()}.

Questions? Contact us:
Phone: (945) 212-1609
Email: support@amerilendloan.com

The AmeriLend Team
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background-color: #0A2540; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; color: #C9A227; font-size: 28px;">Ameri<span style="color: white;">Lend</span></h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Friendly Reminder</p>
      </div>

      <div style="padding: 30px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 18px;">Hello <strong>${recipientName}</strong>,</p>

        <p>Just a friendly reminder — your exclusive invitation code is still waiting for you! Don't miss your chance to take advantage of this personalized offer.</p>

        <div style="background-color: #f8f9fa; border: 2px dashed #C9A227; padding: 20px; margin: 20px 0; border-radius: 10px; text-align: center;">
          <p style="margin: 0 0 5px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666;">Your Invitation Code</p>
          <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #0A2540; font-family: monospace;">${code}</p>
        </div>

        ${offer.amount ? `
        <div style="background: linear-gradient(135deg, #C9A227 0%, #e6c84d 100%); padding: 25px; margin: 20px 0; border-radius: 12px; color: white; text-align: center;">
          <p style="margin: 0 0 5px; font-size: 14px; opacity: 0.9;">Pre-Approved Amount</p>
          <p style="margin: 0; font-size: 36px; font-weight: bold;">$${offer.amount.toLocaleString()}</p>
          ${offer.apr ? `<p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">As low as ${offer.apr.toFixed(2)}% APR</p>` : ""}
          ${offer.termMonths ? `<p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">${offer.termMonths}-month term</p>` : ""}
        </div>
        ` : ""}

        <div style="background-color: ${daysLeft <= 3 ? "#fff3cd" : "#e7f3ff"}; border-left: 4px solid ${daysLeft <= 3 ? "#ffc107" : "#0033A0"}; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: ${daysLeft <= 3 ? "#856404" : "#0033A0"}; font-weight: bold;">
            ${daysLeft <= 3 ? "⏰ Only " + daysLeft + " day" + (daysLeft !== 1 ? "s" : "") + " left!" : "📅 " + daysLeft + " days remaining"}
          </p>
          <p style="margin: 5px 0 0; color: #666; font-size: 14px;">
            This code expires on <strong>${offer.expiresAt.toLocaleDateString()}</strong>.
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${redeemUrl}" style="display: inline-block; background-color: #C9A227; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Redeem Your Code Now</a>
        </div>

        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0A2540; font-size: 15px;">Why Choose AmeriLend?</h3>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">✓ Fast approval in minutes</p>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">✓ Competitive rates personalized for you</p>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">✓ Funds within 24-48 hours</p>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">✓ No hidden fees or surprises</p>
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />

        <p style="font-size: 12px; color: #999; text-align: center;">
          AmeriLend | <a href="https://amerilendloan.com" style="color: #C9A227;">amerilendloan.com</a><br />
          Questions? Email us at support@amerilendloan.com or call (945) 212-1609
        </p>
        <p style="font-size: 11px; color: #bbb; text-align: center; margin-top: 10px;">
          You received this because an AmeriLend administrator sent you an invitation. If you don't wish to receive further reminders, simply ignore this email — your code will expire on ${offer.expiresAt.toLocaleDateString()}.
        </p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({ to: email, subject, text, html });
}

/**
 * Send account deletion request confirmation email
 */
export async function sendAccountDeletionRequestEmail(
  email: string,
  userName: string,
  reason?: string,
  ipAddress?: string
): Promise<void> {
  const subject = "Account Deletion Request Received";
  const requestDate = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York'
  });

  const text = `
Hello ${userName},

We received your account deletion request on ${requestDate}.

${reason ? `Reason: ${reason}` : ''}
${ipAddress ? `Request IP: ${ipAddress}` : ''}

If you did not request this, please contact support immediately at support@amerilendloan.com or call (945) 212-1609.

Your account and associated data will be reviewed and processed according to our data retention policy.

AmeriLend Team
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #C9A227; margin-top: 0;">Account Deletion Request</h2>
          <p>Dear ${userName},</p>
          <p>We have received your account deletion request. Here are the details:</p>

          <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 5px 0;"><strong>Date:</strong> ${requestDate}</p>
            ${reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
            ${ipAddress ? `<p style="margin: 5px 0;"><strong>IP Address:</strong> ${ipAddress}</p>` : ''}
          </div>

          <p><strong>If you did not make this request</strong>, please contact our support team immediately:</p>
          <ul>
            <li>Email: <a href="mailto:support@amerilendloan.com">support@amerilendloan.com</a></li>
            <li>Phone: (945) 212-1609</li>
          </ul>

          <p>Your account and associated data will be reviewed and processed according to our data retention policy. Any outstanding loan obligations will still need to be fulfilled.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: email, subject, text, html });
}

// ============================================
// SUPPORT TICKET EMAIL NOTIFICATIONS
// ============================================

/**
 * Send email notification to admin when a new support ticket is created
 */
export async function sendNewSupportTicketNotificationEmail(
  ticketId: number,
  userName: string,
  userEmail: string,
  subject: string,
  description: string,
  category: string,
  priority: string
): Promise<void> {
  const adminEmail = "support@amerilendloan.com";
  const emailSubject = `🎫 New Support Ticket #${ticketId} - ${subject}`;
  const text = `New support ticket submitted.\n\nTicket #${ticketId}\nFrom: ${userName} (${userEmail})\nCategory: ${category}\nPriority: ${priority}\nSubject: ${subject}\n\n${description}\n\nPlease log in to the admin dashboard to respond.`;

  const priorityColor = priority === 'high' || priority === 'urgent' ? '#DC2626' : priority === 'normal' ? '#F59E0B' : '#6B7280';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px;">
          <h2 style="color: #1e3a5f; margin-top: 0;">🎫 New Support Ticket</h2>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Ticket ID:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">#${ticketId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">From:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${userName} (<a href="mailto:${userEmail}" style="color: #2563eb;">${userEmail}</a>)</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Category:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${category}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Priority:</td>
                <td style="padding: 8px 0;"><span style="background-color: ${priorityColor}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${priority.toUpperCase()}</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Subject:</td>
                <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${subject}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #92400e; font-weight: 600;">MESSAGE</p>
            <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${description}</p>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${COMPANY_INFO.website}/admin/support" style="display: inline-block; padding: 12px 32px; background-color: #1e3a5f; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">View in Dashboard →</a>
          </div>

          <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">
            You can reply directly to the user from the admin support dashboard.
          </p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: adminEmail, subject: emailSubject, text, html });
}

/**
 * Send email notification to user when admin replies to their support ticket
 */
export async function sendSupportTicketReplyEmail(
  userEmail: string,
  userName: string,
  ticketId: number,
  ticketSubject: string,
  replyMessage: string
): Promise<void> {
  const emailSubject = `Re: Support Ticket #${ticketId} - ${ticketSubject}`;
  const text = `Hi ${userName},\n\nOur support team has replied to your ticket #${ticketId} ("${ticketSubject}"):\n\n${replyMessage}\n\nYou can view the full conversation and reply in your account at ${COMPANY_INFO.website}/support\n\nThank you,\nAmeriLend Support Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        ${getEmailHeader()}
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px;">
          <h2 style="color: #1e3a5f; margin-top: 0;">Support Team Reply</h2>

          <p style="color: #374151; font-size: 15px;">Hi ${userName},</p>
          <p style="color: #374151; font-size: 15px;">Our support team has responded to your ticket:</p>

          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #0369a1; font-weight: 600;">TICKET #${ticketId} — ${ticketSubject}</p>
          </div>

          <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; font-weight: 600;">REPLY FROM SUPPORT</p>
            <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${replyMessage}</p>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${COMPANY_INFO.website}/support" style="display: inline-block; padding: 12px 32px; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">View Conversation & Reply →</a>
          </div>

          <p style="color: #64748b; font-size: 13px; margin-top: 20px;">
            If you have additional questions, you can reply through your support center or contact us directly at 
            <a href="mailto:support@amerilendloan.com" style="color: #2563eb;">support@amerilendloan.com</a>.
          </p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  await sendEmail({ to: userEmail, subject: emailSubject, text, html });
}

/**
 * Send notification when admin freezes/unfreezes a bank account
 */
export async function sendBankAccountFrozenEmail(
  email: string,
  userName: string,
  accountType: string,
  reason: string,
  isFrozen: boolean
): Promise<void> {
  const escapedName = escapeHtml(userName);
  const escapedReason = escapeHtml(reason);
  const escapedType = escapeHtml(accountType);

  if (isFrozen) {
    const subject = "Important: Your Bank Account Has Been Frozen — AmeriLend";
    const text = `Dear ${userName},\n\nYour ${accountType} bank account at AmeriLend has been frozen.\n\nReason: ${reason}\n\nWhat you need to do:\n1. Contact our support team to discuss this matter\n2. Provide any requested documentation to verify your identity and recent transactions\n3. Cooperate with our compliance team's review process\n\nWhile your account is frozen, you will not be able to make withdrawals, transfers, bill payments, or deposits.\n\nPlease contact us at ${COMPANY_INFO.contact.email} or ${COMPANY_INFO.contact.phone} for assistance.\n\nBest regards,\nThe AmeriLend Compliance Team`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
          <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">🔒 Account Frozen</h1>
          </div>
          ${getEmailHeader()}
          <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
            <p>Dear ${escapedName},</p>
            <p>We are writing to inform you that your <strong>${escapedType}</strong> bank account at AmeriLend has been <strong style="color: #dc3545;">frozen</strong> pending review.</p>

            <div style="background-color: #ffe6e6; border: 2px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h3 style="margin-top: 0; color: #dc3545;">Reason for Freeze</h3>
              <p style="margin: 5px 0;">${escapedReason}</p>
            </div>

            <div style="background-color: #e8f4fd; border: 2px solid #0033A0; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h3 style="margin-top: 0; color: #0033A0;">What You Need To Do</h3>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Contact our support team</strong> — Reach out to discuss the reason for the freeze and next steps.</li>
                <li><strong>Provide requested documentation</strong> — You may be asked to verify your identity, provide proof of recent transactions, or submit additional compliance documents.</li>
                <li><strong>Cooperate with our review</strong> — Our compliance team will review your account and work with you to resolve any concerns.</li>
              </ol>
            </div>

            <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h3 style="margin-top: 0; color: #856404;">⚠️ Restrictions While Frozen</h3>
              <p style="margin: 5px 0;">While your account is frozen, the following operations are suspended:</p>
              <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
                <li>Wire transfers</li>
                <li>Internal transfers</li>
                <li>Bill payments</li>
                <li>Mobile check deposits</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="mailto:${COMPANY_INFO.contact.email}" style="background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Contact Support</a>
            </div>

            <p>You may also reach us by phone at <strong>${COMPANY_INFO.contact.phone}</strong> during business hours.</p>
          </div>
          ${getEmailFooter()}
        </body>
      </html>
    `;

    await sendEmail({ to: email, subject, text, html });
  } else {
    const subject = "Good News: Your Bank Account Has Been Unfrozen — AmeriLend";
    const text = `Dear ${userName},\n\nWe are pleased to inform you that your ${accountType} bank account at AmeriLend has been unfrozen. All account operations have been restored.\n\nIf you have any questions, please contact us at ${COMPANY_INFO.contact.email}.\n\nBest regards,\nThe AmeriLend Team`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
          <div style="background-color: #28a745; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">✅ Account Restored</h1>
          </div>
          ${getEmailHeader()}
          <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
            <p>Dear ${escapedName},</p>
            <p>We are pleased to inform you that your <strong>${escapedType}</strong> bank account has been <strong style="color: #28a745;">unfrozen</strong>. All account operations have been fully restored.</p>

            <div style="background-color: #d4edda; border: 1px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0; color: #155724;">You may now resume normal banking activities including transfers, bill payments, and deposits.</p>
            </div>

            <p>If you have any questions, please contact us at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
          </div>
          ${getEmailFooter()}
        </body>
      </html>
    `;

    await sendEmail({ to: email, subject, text, html });
  }
}

/**
 * Send notification when admin freezes/unfreezes a virtual card
 */
export async function sendVirtualCardFrozenEmail(
  email: string,
  userName: string,
  cardLastFour: string,
  reason: string,
  isFrozen: boolean
): Promise<void> {
  const escapedName = escapeHtml(userName);
  const escapedReason = escapeHtml(reason);

  if (isFrozen) {
    const subject = "Important: Your Virtual Card Has Been Frozen — AmeriLend";
    const text = `Dear ${userName},\n\nYour virtual card ending in ${cardLastFour} at AmeriLend has been frozen.\n\nReason: ${reason}\n\nWhat you need to do:\n1. Contact our support team to discuss this matter\n2. Provide any requested documentation to verify your identity and recent card activity\n3. Cooperate with our fraud prevention team's review\n\nWhile your card is frozen, all transactions will be declined.\n\nPlease contact us at ${COMPANY_INFO.contact.email} or ${COMPANY_INFO.contact.phone} for assistance.\n\nBest regards,\nThe AmeriLend Compliance Team`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
          <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">🔒 Card Frozen</h1>
          </div>
          ${getEmailHeader()}
          <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
            <p>Dear ${escapedName},</p>
            <p>Your virtual card ending in <strong>****${cardLastFour}</strong> has been <strong style="color: #dc3545;">frozen</strong> by our compliance team.</p>

            <div style="background-color: #ffe6e6; border: 2px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h3 style="margin-top: 0; color: #dc3545;">Reason for Freeze</h3>
              <p style="margin: 5px 0;">${escapedReason}</p>
            </div>

            <div style="background-color: #e8f4fd; border: 2px solid #0033A0; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h3 style="margin-top: 0; color: #0033A0;">What You Need To Do</h3>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Contact our support team</strong> — Reach out to discuss the reason for the freeze.</li>
                <li><strong>Verify your identity</strong> — You may be asked to confirm recent card transactions or provide additional identification.</li>
                <li><strong>Cooperate with the review</strong> — Our fraud prevention team will review the activity and work to resolve the issue.</li>
              </ol>
            </div>

            <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h3 style="margin-top: 0; color: #856404;">⚠️ While Your Card Is Frozen</h3>
              <p style="margin: 5px 0; color: #856404;">All card transactions will be declined until the freeze is lifted. You will not be able to unfreeze this card yourself — it must be reviewed and restored by our team.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="mailto:${COMPANY_INFO.contact.email}" style="background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Contact Support</a>
            </div>

            <p>You may also reach us by phone at <strong>${COMPANY_INFO.contact.phone}</strong> during business hours.</p>
          </div>
          ${getEmailFooter()}
        </body>
      </html>
    `;

    await sendEmail({ to: email, subject, text, html });
  } else {
    const subject = "Good News: Your Virtual Card Has Been Restored — AmeriLend";
    const text = `Dear ${userName},\n\nYour virtual card ending in ${cardLastFour} has been unfrozen. You may now use your card for transactions.\n\nIf you have any questions, please contact us at ${COMPANY_INFO.contact.email}.\n\nBest regards,\nThe AmeriLend Team`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
          <div style="background-color: #28a745; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">✅ Card Restored</h1>
          </div>
          ${getEmailHeader()}
          <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
            <p>Dear ${escapedName},</p>
            <p>Your virtual card ending in <strong>****${cardLastFour}</strong> has been <strong style="color: #28a745;">unfrozen</strong> and is now active again.</p>

            <div style="background-color: #d4edda; border: 1px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0; color: #155724;">You may now resume using your card for all transactions.</p>
            </div>

            <p>If you have any questions, please contact us at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
          </div>
          ${getEmailFooter()}
        </body>
      </html>
    `;

    await sendEmail({ to: email, subject, text, html });
  }
}

/**
 * Send notification when admin locks/unlocks a loan application
 */
export async function sendLoanLockedEmail(
  email: string,
  userName: string,
  trackingNumber: string,
  reason: string,
  isLocked: boolean
): Promise<void> {
  const escapedName = escapeHtml(userName);
  const escapedReason = escapeHtml(reason);
  const escapedTracking = escapeHtml(trackingNumber);

  if (isLocked) {
    const subject = "Important: Your Loan Application Has Been Locked — AmeriLend";
    const text = `Dear ${userName},\n\nYour loan application (Tracking #${trackingNumber}) at AmeriLend has been locked for review.\n\nReason: ${reason}\n\nWhat you need to do:\n1. Contact our support team to discuss this matter\n2. Provide any requested documentation (proof of income, identity verification, etc.)\n3. Respond to any verification requests from our compliance team\n\nWhile your loan is locked, it cannot be approved or processed. The lock will be lifted once the review is complete.\n\nPlease contact us at ${COMPANY_INFO.contact.email} or ${COMPANY_INFO.contact.phone} for assistance.\n\nBest regards,\nThe AmeriLend Compliance Team`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
          <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">🔒 Loan Application Locked</h1>
          </div>
          ${getEmailHeader()}
          <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
            <p>Dear ${escapedName},</p>
            <p>Your loan application <strong>(Tracking #${escapedTracking})</strong> has been <strong style="color: #dc3545;">locked</strong> and placed under review by our compliance team.</p>

            <div style="background-color: #ffe6e6; border: 2px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h3 style="margin-top: 0; color: #dc3545;">Reason for Lock</h3>
              <p style="margin: 5px 0;">${escapedReason}</p>
            </div>

            <div style="background-color: #e8f4fd; border: 2px solid #0033A0; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h3 style="margin-top: 0; color: #0033A0;">What You Need To Do</h3>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Contact our support team</strong> — Reach out to discuss the reason for the lock and what is needed.</li>
                <li><strong>Provide requested documentation</strong> — You may be asked for proof of income, identity verification, employment verification, or other supporting documents.</li>
                <li><strong>Respond to verification requests</strong> — Our compliance team may need to verify information on your application. Please respond promptly to expedite the review.</li>
              </ol>
            </div>

            <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h3 style="margin-top: 0; color: #856404;">⚠️ What This Means</h3>
              <p style="margin: 5px 0; color: #856404;">While your loan application is locked, it cannot be approved, processed, or disbursed. The lock will be lifted once our review is complete and any outstanding issues are resolved.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="mailto:${COMPANY_INFO.contact.email}" style="background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Contact Support</a>
            </div>

            <p>You may also reach us by phone at <strong>${COMPANY_INFO.contact.phone}</strong> during business hours.</p>
          </div>
          ${getEmailFooter()}
        </body>
      </html>
    `;

    await sendEmail({ to: email, subject, text, html });
  } else {
    const subject = "Good News: Your Loan Application Lock Has Been Lifted — AmeriLend";
    const text = `Dear ${userName},\n\nYour loan application (Tracking #${trackingNumber}) has been unlocked. Processing of your application will now continue as normal.\n\nIf you have any questions, please contact us at ${COMPANY_INFO.contact.email}.\n\nBest regards,\nThe AmeriLend Team`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
          <div style="background-color: #28a745; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">✅ Loan Application Unlocked</h1>
          </div>
          ${getEmailHeader()}
          <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
            <p>Dear ${escapedName},</p>
            <p>Your loan application <strong>(Tracking #${escapedTracking})</strong> has been <strong style="color: #28a745;">unlocked</strong>. Processing of your application will now continue as normal.</p>

            <div style="background-color: #d4edda; border: 1px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0; color: #155724;">Your application is back in the review pipeline and will be processed according to its current status.</p>
            </div>

            <p>If you have any questions, please contact us at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
          </div>
          ${getEmailFooter()}
        </body>
      </html>
    `;

    await sendEmail({ to: email, subject, text, html });
  }
}

/**
 * Send a marketing/campaign email to a single recipient.
 * Used by the mass email system to send to each eligible user.
 */
export async function sendCampaignEmail(
  email: string,
  recipientName: string,
  subject: string,
  bodyHtml: string,
): Promise<{ success: boolean; error?: string }> {
  const safeName = escapeHtml(recipientName);
  const safeSubject = escapeHtml(subject);

  const text = `Dear ${recipientName},\n\n${subject}\n\nTo unsubscribe from marketing emails, update your notification preferences in your AmeriLend dashboard.\n\nBest regards,\nThe AmeriLend Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${safeSubject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <p style="font-size: 16px; color: #555;">Dear ${safeName},</p>
          ${bodyHtml}
          <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 15px;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              You are receiving this email because you opted in to marketing communications from AmeriLend.<br/>
              To unsubscribe, <a href="https://amerilendloan.com/settings" style="color: #0033A0;">update your notification preferences</a>.
            </p>
          </div>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  return await sendEmail({ to: email, subject, text, html });
}