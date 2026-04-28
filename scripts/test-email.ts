/**
 * Quick email test script
 * Usage: npx tsx scripts/test-email.ts <recipient-email>
 *
 * Sends a simple test email via SendGrid to verify the integration works.
 * Reads SENDGRID_API_KEY and SENDGRID_VERIFIED_EMAIL from .env.
 */

import "dotenv/config";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_VERIFIED_EMAIL || "noreply@amerilendloan.com";
const TO_EMAIL = process.argv[2];

if (!TO_EMAIL) {
  console.error("Usage: npx tsx scripts/test-email.ts <recipient-email>");
  process.exit(1);
}

if (!SENDGRID_API_KEY) {
  console.error("❌ SENDGRID_API_KEY is not set. Add it to your .env file.");
  process.exit(1);
}

console.log("========================================");
console.log("  AmeriLend Email Test");
console.log("========================================");
console.log(`From:    ${FROM_EMAIL}`);
console.log(`To:      ${TO_EMAIL}`);
console.log(`API Key: ${SENDGRID_API_KEY.slice(0, 10)}...${SENDGRID_API_KEY.slice(-4)}`);
console.log("========================================\n");

async function sendTestEmail() {
  const payload = {
    personalizations: [
      {
        to: [{ email: TO_EMAIL }],
        subject: "✅ AmeriLend Email Test - SendGrid Working!",
      },
    ],
    from: {
      email: FROM_EMAIL,
      name: "AmeriLend",
    },
    reply_to: {
      email: "support@amerilendloan.com",
      name: "AmeriLend Support",
    },
    content: [
      {
        type: "text/plain",
        value: `This is a test email from AmeriLend.\n\nIf you received this, your SendGrid email integration is working correctly.\n\nSent at: ${new Date().toISOString()}\n\n- AmeriLend System`,
      },
      {
        type: "text/html",
        value: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f7f7f7; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 30px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .header p { color: #bfdbfe; margin: 8px 0 0; font-size: 14px; }
    .body { padding: 30px; }
    .success-badge { display: inline-block; background: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; margin-bottom: 20px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .info-table td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .info-table td:first-child { font-weight: bold; color: #374151; width: 120px; }
    .info-table td:last-child { color: #6b7280; }
    .footer { background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { color: #9ca3af; font-size: 12px; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AmeriLend</h1>
      <p>Email System Test</p>
    </div>
    <div class="body">
      <span class="success-badge">✅ Email Working</span>
      <p>Your SendGrid email integration is configured correctly and working.</p>
      <table class="info-table">
        <tr><td>From</td><td>${FROM_EMAIL}</td></tr>
        <tr><td>To</td><td>${TO_EMAIL}</td></tr>
        <tr><td>Provider</td><td>SendGrid</td></tr>
        <tr><td>Timestamp</td><td>${new Date().toLocaleString()}</td></tr>
        <tr><td>Environment</td><td>${process.env.NODE_ENV || "development"}</td></tr>
      </table>
      <p style="color: #6b7280; font-size: 13px;">This email confirms that your AmeriLend application can successfully send emails through SendGrid. All notification emails (OTP, application updates, payment reminders, etc.) should work correctly.</p>
    </div>
    <div class="footer">
      <p>AmeriLend Financial Services</p>
      <p>www.amerilendloan.com | support@amerilendloan.com</p>
    </div>
  </div>
</body>
</html>`,
      },
    ],
  };

  console.log("📧 Sending test email...\n");

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log("✅ SUCCESS! Email sent to", TO_EMAIL);
      console.log("   Status:", response.status, response.statusText);
      console.log("\n   Check your inbox (and spam folder) for the test email.");
    } else {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = errorText;
      }
      console.error("❌ FAILED to send email");
      console.error("   Status:", response.status, response.statusText);
      console.error("   Error:", JSON.stringify(errorData, null, 2));

      if (response.status === 401) {
        console.error("\n   → Your SENDGRID_API_KEY is invalid. Get a new key at:");
        console.error("     https://app.sendgrid.com/settings/api_keys");
      }
      if (response.status === 403) {
        console.error("\n   → Sender email may not be verified. Verify at:");
        console.error("     https://app.sendgrid.com/settings/sender_auth/senders");
      }
    }
  } catch (error) {
    console.error("❌ Network error:", error instanceof Error ? error.message : error);
  }
}

sendTestEmail();
