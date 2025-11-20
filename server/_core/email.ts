/**
 * Email module using SendGrid
 * Handles sending emails including OTP codes
 */

import { ENV } from "./env";
import { getEmailHeader, getEmailFooter, COMPANY_INFO } from "./companyConfig";
import { getLocationFromIP } from "./geolocation";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Send email using SendGrid API
 */
export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  if (!ENV.sendGridApiKey) {
    console.error("SendGrid API key not configured");
    return { success: false, error: "Email service not configured" };
  }

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
          email: "noreply@amerilendloan.com",
          name: "AmeriLend",
        },
        reply_to: {
          email: "support@amerilendloan.com",
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("SendGrid API error:", errorData);
      return { success: false, error: errorData.errors?.[0]?.message || "Failed to send email" };
    }

    console.log(`Email sent successfully to ${payload.to}`);
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Send OTP code via email using SendGrid
 */
export async function sendOTPEmail(email: string, code: string, purpose: "signup" | "login" | "reset"): Promise<void> {
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
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #0033A0; margin-top: 0;">${title}</h2>
          <p>${message}</p>
          <div style="background-color: #0033A0; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; font-size: 14px;">Your verification code is:</p>
            <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 2px;">${code}</p>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center;">This code will expire in 10 minutes.</p>
          <p style="color: #999; font-size: 12px; text-align: center;">If you didn't request this code, please ignore this email.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    console.error(`[Email] Failed to send OTP verification email to ${email}:`, result.error);
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
  const formattedAmount = (requestedAmount / 100).toFixed(2);
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
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <h2 style="color: #0033A0; margin-top: 0;">Application Received!</h2>
          <p>Dear ${fullName},</p>
          <p>Thank you for submitting your loan application to AmeriLend. We've received your application and our team is reviewing it.</p>
          
          <div style="background-color: white; border-left: 4px solid #0033A0; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0033A0;">Application Details</h3>
            <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
            <p style="margin: 5px 0;"><strong>Requested Amount:</strong> $${formattedAmount}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Under Review</p>
          </div>

          <h3 style="color: #0033A0;">What's Next?</h3>
          <ul style="padding-left: 20px;">
            <li>Our team will review your application within 24 hours</li>
            <li>You'll receive an email notification once a decision is made</li>
            <li>You can track your application status in your dashboard</li>
          </ul>

          <p style="margin-top: 30px;">If you have any questions, please don't hesitate to contact our support team at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or call us at ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
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
  const formattedAmount = (approvedAmount / 100).toFixed(2);
  const formattedFee = (processingFee / 100).toFixed(2);
  const subject = "Congratulations! Your Loan Application is Approved - AmeriLend";
  const text = `Dear ${fullName},\n\nGreat news! Your loan application has been approved!\n\nApplication Details:\nTracking Number: ${trackingNumber}\nApproved Amount: $${formattedAmount}\nProcessing Fee: $${formattedFee}\n\nNext Steps:\n1. Log in to your dashboard to review the loan agreement\n2. Pay the processing fee to proceed with disbursement\n3. Once the fee is paid, your funds will be disbursed within 1-2 business days\n\nPlease log in to your account to complete the next steps.\n\nBest regards,\nThe AmeriLend Team`;
  
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
          <h2 style="color: #0033A0; margin-top: 0;">Congratulations, ${fullName}!</h2>
          <p>Your loan application has been approved! We're excited to help you with your financial needs.</p>
          
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
  const formattedFee = (processingFee / 100).toFixed(2);
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
          <p>Your loan application is currently being processed and we're almost ready to disburse your funds!</p>
          
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
 * Send login notification email
 */
export async function sendLoginNotificationEmail(
  email: string,
  fullName: string,
  loginTime: Date,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
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
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0;">
        ${getEmailHeader()}
        <div style="background-color: #f9f9f9; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
          <div style="background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin-bottom: 20px;">
            <h2 style="color: #0c5460; margin-top: 0; font-size: 18px;">
              🔒 Security Alert: New Login Detected
            </h2>
          </div>
          
          <p>Dear ${fullName},</p>
          <p>We detected a new login to your AmeriLend account. Please review the details below:</p>
          
          <div style="background-color: white; border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0; font-size: 16px;">Login Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>Time:</strong></td>
                <td style="padding: 8px 0;">${formattedTime} EST</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Location:</strong></td>
                <td style="padding: 8px 0;">📍 ${locationInfo}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>IP Address:</strong></td>
                <td style="padding: 8px 0;">${ipAddress || 'Unknown'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Device:</strong></td>
                <td style="padding: 8px 0;">${deviceInfo}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Browser:</strong></td>
                <td style="padding: 8px 0;">${browserInfo}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #155724;">
              <strong>✓ Was this you?</strong> No action needed. You're all set!
            </p>
          </div>

          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #721c24;">
              <strong>⚠️ Wasn't you?</strong> Secure your account immediately!
            </p>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">Protect Your Account</h3>
          <ul style="padding-left: 20px;">
            <li>Never share your OTP codes with anyone</li>
            <li>Use a strong, unique password</li>
            <li>Log out after each session on shared devices</li>
            <li>Contact us immediately if you notice suspicious activity</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <p style="margin-bottom: 10px;">Need help? Contact our security team:</p>
            <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0; text-decoration: none; font-weight: bold;">${COMPANY_INFO.contact.email}</a>
            <br>
            <span style="color: #0033A0; font-weight: bold;">${COMPANY_INFO.contact.phone}</span>
          </div>
        </div>
        ${getEmailFooter()}
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
            ${ipAddress ? `<p style="margin: 5px 0;"><strong>IP Address:</strong> ${ipAddress}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
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
  const formattedAmount = (approvedAmount / 100).toFixed(2);
  const formattedFee = (processingFee / 100).toFixed(2);
  const subject = "✓ Loan Application Approved - Action Required - AmeriLend";
  
  const text = `Dear ${fullName},\n\nGreat news! Your loan application has been approved!\n\nApplication Details:\nTracking Number: ${trackingNumber}\nApproved Amount: $${formattedAmount}\nProcessing Fee: $${formattedFee}\n\n${adminNotes ? `Admin Notes: ${adminNotes}\n\n` : ''}Next Steps:\n1. Log in to your dashboard\n2. Review and sign the loan agreement\n3. Pay the processing fee ($${formattedFee})\n4. Once fee is paid, funds will be disbursed within 1-2 business days\n\nPlease complete these steps to proceed with your loan.\n\nBest regards,\nThe AmeriLend Team`;

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
          <h2 style="color: #0033A0; margin-top: 10px;">Congratulations, ${fullName}!</h2>
          <p style="font-size: 16px; color: #555;">Your loan application has been approved and we're ready to move forward!</p>
          
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
  const formattedAmount = (disbursedAmount / 100).toFixed(2);
  const subject = "🎉 Your Loan Has Been Disbursed! - AmeriLend";
  
  const text = `Dear ${fullName},\n\nExciting news! Your loan funds have been disbursed and are on their way to your account!\n\nDisbursement Details:\nTracking Number: ${trackingNumber}\nDisbursed Amount: $${formattedAmount}\nEstimated Arrival: ${estimatedArrivalDate}\n\nYour funds should appear in your bank account within 1-2 business days. Please note that your bank may take an additional day to process the deposit.\n\nWhat's Next:\n- Monitor your bank account for the deposit\n- Contact us if you don't receive the funds within 2 business days\n- Log in to your dashboard to view your loan details and payment schedule\n\nThank you for choosing AmeriLend!\n\nBest regards,\nThe AmeriLend Team`;

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
              🎉 FUNDS DISBURSED!
            </div>
          </div>
          <h2 style="color: #0033A0; margin-top: 10px;">Your Loan Has Been Disbursed!</h2>
          <p style="font-size: 16px; color: #555;">Dear ${fullName}, we're excited to let you know that your loan funds have been sent to your bank account!</p>
          
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
            <h4 style="margin-top: 0; color: #0033A0;">Thank You for Choosing AmeriLend!</h4>
            <p style="margin-bottom: 0; color: #555;">We're committed to supporting your financial goals. If you have any questions about your loan or need assistance, our support team is always here to help.</p>
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
  employmentStatus: string
): Promise<void> {
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(requestedAmount / 100);

  const subject = `New Loan Application - AmeriLend [${trackingNumber}]`;
  const text = `A new loan application has been submitted.\n\nApplicant Information:\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone}\nTracking Number: ${trackingNumber}\n\nApplication Details:\nLoan Type: ${loanType}\nRequested Amount: ${formattedAmount}\nEmployment Status: ${employmentStatus}\n\nAction Required:\nPlease review this application in your admin dashboard.`;

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
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { text-align: left; padding: 10px; border-bottom: 1px solid #ddd; }
          th { background-color: #f5f5f5; font-weight: bold; color: #0033A0; }
          .cta-button { display: inline-block; background-color: #0033A0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
        </style>
      </head>
      <body>
        ${getEmailHeader()}
        <div class="container">
          <div class="header">
            <h1 style="color: #0033A0; margin: 0;">New Loan Application Received</h1>
            <p style="color: #666; margin-top: 5px;">Action required from administration</p>
          </div>

          <div class="alert">
            <strong>⚠️ A new loan application has been submitted and requires review.</strong>
          </div>

          <div class="section">
            <h2 style="color: #0033A0; border-bottom: 2px solid #0033A0; padding-bottom: 10px;">Applicant Information</h2>
            <table>
              <tr>
                <td><span class="label">Name:</span></td>
                <td>${fullName}</td>
              </tr>
              <tr>
                <td><span class="label">Email:</span></td>
                <td>${email}</td>
              </tr>
              <tr>
                <td><span class="label">Phone:</span></td>
                <td>${phone}</td>
              </tr>
              <tr>
                <td><span class="label">Tracking Number:</span></td>
                <td><strong>${trackingNumber}</strong></td>
              </tr>
            </table>
          </div>

          <div class="section">
            <h2 style="color: #0033A0; border-bottom: 2px solid #0033A0; padding-bottom: 10px;">Loan Application Details</h2>
            <table>
              <tr>
                <td><span class="label">Loan Type:</span></td>
                <td>${loanType.replace("_", " ").charAt(0).toUpperCase() + loanType.slice(1).replace("_", " ")}</td>
              </tr>
              <tr>
                <td><span class="label">Requested Amount:</span></td>
                <td><strong>${formattedAmount}</strong></td>
              </tr>
              <tr>
                <td><span class="label">Employment Status:</span></td>
                <td>${employmentStatus.replace("_", " ")}</td>
              </tr>
            </table>
          </div>

          <div class="section" style="background-color: #f9f9f9; padding: 20px; border-radius: 4px; margin-top: 20px;">
            <h3 style="margin-top: 0; color: #0033A0;">Next Steps:</h3>
            <ol style="color: #555;">
              <li>Review the applicant's information and documentation</li>
              <li>Conduct credit and employment verification</li>
              <li>Make an approval/rejection decision</li>
              <li>Notify the applicant of the decision</li>
            </ol>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <p>
              <a href="${COMPANY_INFO.website}/admin" class="cta-button">Review in Admin Dashboard</a>
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
  const subject = "Welcome to AmeriLend - Let's Get You a Loan!";
  const text = `Dear ${fullName},\n\nWelcome to AmeriLend! We're excited to have you on board.\n\nYour account has been successfully created and you're ready to apply for a loan.\n\nNext Steps:\n1. Log in to your dashboard\n2. Complete your application\n3. Upload required documents\n4. Await approval decision\n\nIf you have any questions, feel free to contact our support team at support@amerilendloan.com or call (945) 212-1609.\n\nBest regards,\nThe AmeriLend Team`;

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
              🎉 Welcome to AmeriLend!
            </div>
          </div>

          <h2 style="color: #0033A0; margin-top: 10px;">Welcome, ${fullName}!</h2>
          <p style="font-size: 16px; color: #555;">Your account has been successfully created and you're ready to get started. We're excited to help you achieve your financial goals!</p>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">Why Choose AmeriLend?</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Quick and easy application process</li>
              <li>Fast loan decisions</li>
              <li>Flexible repayment terms</li>
              <li>Competitive rates</li>
              <li>Dedicated customer support</li>
            </ul>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">Get Started in 3 Steps:</h3>
          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <ol style="margin: 0; padding-left: 20px; line-height: 2;">
              <li style="margin: 10px 0;"><strong>Complete Your Application</strong> - Tell us about yourself and how much you need</li>
              <li style="margin: 10px 0;"><strong>Upload Documents</strong> - Provide identification and income verification</li>
              <li style="margin: 10px 0;"><strong>Get Approved</strong> - Receive your decision and start using your funds</li>
            </ol>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.amerilendloan.com/dashboard" style="background-color: #FFA500; color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Go to Your Dashboard</a>
          </div>

          <div style="background-color: #fff9e6; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #856404;"><strong>💡 Tip:</strong> Complete your application today to get faster processing. The sooner you apply, the sooner you can get approved!</p>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">Questions?</h3>
          <p style="color: #555;">Our support team is here to help! You can reach us at:</p>
          <ul style="padding-left: 20px;">
            <li>📧 Email: <a href="mailto:support@amerilendloan.com" style="color: #0033A0;">support@amerilendloan.com</a></li>
            <li>📞 Phone: <span style="color: #0033A0; font-weight: bold;">(945) 212-1609</span></li>
            <li>🕐 Hours: Monday-Friday 8am-8pm CT, Saturday-Sunday 9am-5pm CT</li>
          </ul>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">Thank you for choosing AmeriLend. We look forward to serving you!</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    console.error(`[Email] Failed to send signup welcome email to ${email}:`, result.error);
    throw new Error(`Failed to send signup welcome email: ${result.error}`);
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
  const subject = "Job Application Received - AmeriLend Careers";
  const text = `Dear ${fullName},\n\nThank you for applying for the ${position} position at AmeriLend!\n\nWe have received your application and it is now being reviewed by our HR team. We appreciate your interest in joining our company.\n\nWhat's Next:\n- Our HR team will review your application carefully\n- If your qualifications match our needs, we will contact you for an interview\n- You can expect to hear from us within 5-7 business days\n\nIn the meantime, if you have any questions, feel free to reach out to us at careers@amerilendloan.com.\n\nBest regards,\nThe AmeriLend Team`;

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
              ✓ Application Received
            </div>
          </div>

          <h2 style="color: #0033A0; margin-top: 10px;">Thank You for Applying!</h2>
          <p style="font-size: 16px; color: #555;">Dear ${fullName},</p>
          <p style="font-size: 16px; color: #555;">We're excited to have received your application for the <strong>${position}</strong> position. Thank you for your interest in joining the AmeriLend team!</p>

          <div style="background-color: white; border-left: 4px solid #0033A0; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">Position Applied For</h3>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #0033A0;">${position}</p>
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
            <p style="margin: 0; color: #856404;"><strong>📌 Keep an Eye on Your Email</strong> - Make sure to check your inbox and spam folder for updates from our team.</p>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">Questions About Your Application?</h3>
          <p style="color: #555;">We're here to help! Feel free to reach out to our HR team:</p>
          <ul style="padding-left: 20px;">
            <li>📧 Email: <a href="mailto:careers@amerilendloan.com" style="color: #0033A0;">careers@amerilendloan.com</a></li>
            <li>📧 Admin Email: <a href="mailto:admin@amerilendloan.com" style="color: #0033A0;">admin@amerilendloan.com</a></li>
          </ul>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">Thank you for considering AmeriLend as your next opportunity!</p>
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
  const subject = `New Job Application - ${position} [${applicantName}]`;
  const text = `A new job application has been submitted.\n\nApplicant Information:\nName: ${applicantName}\nEmail: ${applicantEmail}\nPhone: ${applicantPhone}\nPosition: ${position}\n\nCover Letter:\n${coverLetter}\n\nResume: ${resumeFileName}\n\nAction Required:\nPlease review this application and contact the applicant if you wish to proceed.`;

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
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${applicantName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #0033A0;">Email:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><a href="mailto:${applicantEmail}" style="color: #0033A0;">${applicantEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #0033A0;">Phone:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${applicantPhone}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #0033A0;">Position:</td>
                <td style="padding: 10px 0;"><strong>${position}</strong></td>
              </tr>
            </table>
          </div>

          <div style="background-color: #e7f3ff; border-left: 4px solid #0033A0; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #0033A0;">Cover Letter</h3>
            <p style="margin: 0; line-height: 1.8; color: #555; white-space: pre-wrap;">${coverLetter}</p>
          </div>

          <div style="background-color: #f0f8ff; border: 1px solid #b3d9ff; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h4 style="margin-top: 0; color: #0033A0;">📎 Attached Documents</h4>
            <p style="margin: 0; color: #555;"><strong>Resume:</strong> ${resumeFileName}</p>
          </div>

          <div style="background-color: #fff9e6; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; color: #856404;"><strong>Next Steps:</strong> Review the application and contact the applicant to schedule an interview if interested.</p>
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
    console.error(`[Email] Failed to send admin signup notification for ${email}:`, result.error);
    throw new Error(`Failed to send admin signup notification: ${result.error}`);
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
    console.error(`[Email] Failed to send password change confirmation to ${email}:`, result.error);
    throw new Error(`Failed to send password change confirmation: ${result.error}`);
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
    console.error(`[Email] Failed to send profile update confirmation to ${email}:`, result.error);
    throw new Error(`Failed to send profile update confirmation: ${result.error}`);
  }
}

/**
 * Send Authorize.net payment confirmation email to user
 */
export async function sendAuthorizeNetPaymentConfirmedEmail(
  email: string,
  fullName: string,
  trackingNumber: string,
  amount: number,
  cardLast4: string,
  cardBrand: string,
  transactionId: string
): Promise<void> {
  const formattedAmount = (amount / 100).toFixed(2);
  const subject = "✓ Payment Confirmed - Authorize.net - AmeriLend";
  const text = `Dear ${fullName},\n\nYour payment has been successfully processed!\n\nPayment Details:\nTracking Number: ${trackingNumber}\nAmount: $${formattedAmount}\nCard: ${cardBrand} ending in ${cardLast4}\nTransaction ID: ${transactionId}\n\nYour loan application is now being processed. You will receive updates via email as your application progresses.\n\nIf you have any questions, please contact our support team.\n\nBest regards,\nThe AmeriLend Team`;

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
              ✓ PAYMENT CONFIRMED
            </div>
          </div>
          <h2 style="color: #0033A0; margin-top: 10px;">Payment Successfully Processed</h2>
          <p>Dear ${fullName},</p>
          <p>Thank you! Your payment has been successfully processed. Your loan processing fee is now paid and we're moving forward with your application.</p>
          
          <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #28a745;">Payment Confirmation</h3>
            <table style="width: 100%; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>Tracking Number:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right; font-family: monospace;">${trackingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>Amount Paid:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right; color: #28a745;"><strong>$${formattedAmount}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>Card:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right;">${cardBrand} •••• ${cardLast4}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Transaction ID:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${transactionId}</td>
              </tr>
            </table>
          </div>

          <h3 style="color: #0033A0; margin-top: 30px;">What's Next?</h3>
          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <ul style="margin: 0; padding-left: 20px; line-height: 2;">
              <li>Your payment has been recorded in our system</li>
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
            <p style="margin-bottom: 0; color: #555;">Please keep this email for your records. Your transaction ID may be needed for future reference.</p>
          </div>

          <p style="margin-top: 30px;">If you have any questions about your payment or application, please contact our support team at <a href="mailto:${COMPANY_INFO.contact.email}" style="color: #0033A0;">${COMPANY_INFO.contact.email}</a> or ${COMPANY_INFO.contact.phone}.</p>
        </div>
        ${getEmailFooter()}
      </body>
    </html>
  `;

  const result = await sendEmail({ to: email, subject, text, html });
  if (!result.success) {
    console.error(`[Email] Failed to send Authorize.net payment confirmation to ${email}:`, result.error);
    throw new Error(`Failed to send Authorize.net payment confirmation: ${result.error}`);
  }
}

/**
 * Send Authorize.net payment notification to admin
 */
export async function sendAdminAuthorizeNetPaymentNotification(
  paymentId: string,
  userName: string,
  userEmail: string,
  amount: number,
  cardBrand: string,
  cardLast4: string,
  transactionId: string
): Promise<void> {
  const formattedAmount = (amount / 100).toFixed(2);
  const subject = `Payment Received - Authorize.net - ${userName} [${paymentId}]`;
  const text = `A new payment has been received via Authorize.net.\n\nPayment Details:\nPayment ID: ${paymentId}\nTransaction ID: ${transactionId}\nAmount: $${formattedAmount}\nCard: ${cardBrand} ending in ${cardLast4}\n\nUser Information:\nName: ${userName}\nEmail: ${userEmail}\n\nAction: Review payment in admin dashboard and process application accordingly.`;

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
              💳 PAYMENT RECEIVED
            </div>
          </div>
          <h2 style="color: #0033A0; margin-top: 10px;">New Authorize.net Payment Received</h2>
          <p>A new payment has been successfully received via Authorize.net card processing.</p>
          
          <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #28a745;">Payment Information</h3>
            <table style="width: 100%; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>Payment ID:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right; font-family: monospace; font-size: 12px;">${paymentId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>Transaction ID:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right; font-family: monospace; font-size: 12px;">${transactionId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;"><strong>Amount:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; text-align: right; font-size: 18px; font-weight: bold; color: #28a745;">$${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Card:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${cardBrand} •••• ${cardLast4}</td>
              </tr>
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
            <p style="margin: 0; color: #856404;"><strong>📌 Action Required:</strong> Review the payment and process the user's application accordingly in your admin dashboard.</p>
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
  const formattedAmount = (usdAmount / 100).toFixed(2);
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
    console.error(`[Email] Failed to send crypto payment confirmation to ${email}:`, result.error);
    throw new Error(`Failed to send crypto payment confirmation: ${result.error}`);
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
  const formattedAmount = (usdAmount / 100).toFixed(2);
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

  const formattedAmount = amount.toFixed(2);
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

Great news! Your ${docLabel} has been successfully verified and approved.

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



