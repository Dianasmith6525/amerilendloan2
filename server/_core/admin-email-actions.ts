/**
 * Admin Email Actions — Approve/Reject loan applications directly from email
 * 
 * Uses HMAC-signed tokens so only admin email recipients can execute actions.
 * Tokens expire after 72 hours for security.
 */
import crypto from "crypto";
import { Router, Request, Response } from "express";
import * as db from "../db";
import { ENV } from "./env";
import { COMPANY_INFO } from "./companyConfig";
import { sendApplicationRejectedNotificationEmail } from "./email";

const TOKEN_EXPIRY_MS = 72 * 60 * 60 * 1000; // 72 hours

function getSecret(): string {
  const secret = ENV.cookieSecret;
  if (!secret) {
    throw new Error("JWT_SECRET / cookieSecret must be configured for admin email action tokens");
  }
  return secret;
}

/**
 * Generate a signed token for admin email actions
 */
export function generateAdminActionToken(
  applicationId: number,
  action: "approve" | "reject"
): string {
  const payload = {
    id: applicationId,
    action,
    exp: Date.now() + TOKEN_EXPIRY_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Verify and decode a signed admin action token
 */
function verifyAdminActionToken(
  token: string
): { id: number; action: "approve" | "reject" } | null {
  try {
    const [data, signature] = token.split(".");
    if (!data || !signature) return null;

    const expectedSig = crypto
      .createHmac("sha256", getSecret())
      .update(data)
      .digest("base64url");

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    );

    if (payload.exp < Date.now()) return null;

    return { id: payload.id, action: payload.action };
  } catch {
    return null;
  }
}

/**
 * Build an HTML response page for admin actions
 */
function buildResultPage(
  title: string,
  message: string,
  success: boolean,
  trackingNumber?: string
): string {
  const statusColor = success ? "#059669" : "#DC2626";
  const statusIcon = success ? "✅" : "❌";
  const bgGradient = success
    ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
    : "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - AmeriLend Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f3f4f6; }
    .card { max-width: 520px; width: 90%; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #001a4d 0%, #0050d4 100%); padding: 30px; text-align: center; }
    .header img { height: 50px; margin-bottom: 10px; }
    .header h2 { color: white; font-size: 18px; font-weight: 500; }
    .body { padding: 40px 30px; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    .status-badge { display: inline-block; padding: 6px 20px; border-radius: 20px; font-weight: 600; font-size: 14px; background: ${bgGradient}; color: ${statusColor}; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 12px; }
    .message { color: #6B7280; font-size: 15px; line-height: 1.6; margin-bottom: 20px; }
    .tracking { font-family: monospace; font-size: 14px; background: #f3f4f6; padding: 8px 16px; border-radius: 8px; display: inline-block; color: #374151; }
    .action-link { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #0033A0; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .action-link:hover { background: #002580; }
    .footer { padding: 16px 30px; background: #f9fafb; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <img src="${COMPANY_INFO.logo.url}" alt="${COMPANY_INFO.logo.alt}">
      <h2>Admin Action Center</h2>
    </div>
    <div class="body">
      <div class="icon">${statusIcon}</div>
      <div class="status-badge">${success ? "ACTION COMPLETED" : "ACTION FAILED"}</div>
      <h1 class="title">${title}</h1>
      <p class="message">${message}</p>
      ${trackingNumber ? `<div class="tracking">Tracking: ${trackingNumber}</div>` : ""}
      <br>
      <a href="${COMPANY_INFO.website}/admin" class="action-link">Open Admin Dashboard</a>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${COMPANY_INFO.name}. Secure admin action.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Register admin email action routes on the Express app
 */
export function registerAdminEmailActionRoutes(app: ReturnType<typeof Router> | any): void {
  // Approve application from email
  app.get("/api/admin-action/approve/:token", async (req: Request, res: Response) => {
    try {
      const decoded = verifyAdminActionToken(req.params.token);

      if (!decoded || decoded.action !== "approve") {
        return res.status(400).send(
          buildResultPage(
            "Invalid or Expired Link",
            "This approval link has expired or is invalid. Please log into the admin dashboard to take action.",
            false
          )
        );
      }

      const application = await db.getLoanApplicationById(decoded.id);
      if (!application) {
        return res.status(404).send(
          buildResultPage("Application Not Found", "This loan application could not be found.", false)
        );
      }

      if (application.status === "approved") {
        return res.send(
          buildResultPage(
            "Already Approved",
            "This application has already been approved. No further action is needed.",
            true,
            application.trackingNumber
          )
        );
      }

      if (application.status !== "pending" && application.status !== "under_review") {
        return res.status(400).send(
          buildResultPage(
            "Cannot Approve",
            `This application is currently "${application.status}" and cannot be approved via email. Please use the admin dashboard.`,
            false,
            application.trackingNumber
          )
        );
      }

      // Calculate processing fee
      const feeConfig = await db.getActiveFeeConfiguration();
      let processingFeeAmount: number;
      const approvedAmount = application.requestedAmount; // approve for full requested amount

      if (feeConfig?.calculationMode === "percentage") {
        processingFeeAmount = Math.round((approvedAmount * feeConfig.percentageRate) / 10000);
      } else if (feeConfig?.calculationMode === "fixed") {
        processingFeeAmount = feeConfig.fixedFeeAmount;
      } else {
        processingFeeAmount = Math.round((approvedAmount * 200) / 10000); // 2% default
      }

      await db.updateLoanApplicationStatus(decoded.id, "approved", {
        approvedAmount,
        processingFeeAmount,
        adminNotes: "Approved via admin email action",
        approvedAt: new Date(),
      });

      // Log the admin activity  
      await db.logAdminActivity({
        adminId: 0, // email action — no specific admin session
        action: "approve_loan",
        targetType: "loan",
        targetId: decoded.id,
        details: JSON.stringify({ approvedAmount, source: "email_action" }),
      });

      console.log(`[Admin Email Action] Application ${decoded.id} APPROVED via email link`);

      return res.send(
        buildResultPage(
          "Application Approved!",
          `The loan application for ${application.fullName} has been approved for ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(approvedAmount / 100)}. The applicant will be notified automatically.`,
          true,
          application.trackingNumber
        )
      );
    } catch (error) {
      console.error("[Admin Email Action] Approve error:", error);
      return res.status(500).send(
        buildResultPage("Server Error", "Something went wrong processing this action. Please try the admin dashboard.", false)
      );
    }
  });

  // Reject application from email — shows a confirmation page with reason input
  app.get("/api/admin-action/reject/:token", async (req: Request, res: Response) => {
    try {
      const decoded = verifyAdminActionToken(req.params.token);

      if (!decoded || decoded.action !== "reject") {
        return res.status(400).send(
          buildResultPage(
            "Invalid or Expired Link",
            "This rejection link has expired or is invalid. Please log into the admin dashboard to take action.",
            false
          )
        );
      }

      const application = await db.getLoanApplicationById(decoded.id);
      if (!application) {
        return res.status(404).send(
          buildResultPage("Application Not Found", "This loan application could not be found.", false)
        );
      }

      if (application.status === "rejected") {
        return res.send(
          buildResultPage(
            "Already Rejected",
            "This application has already been rejected.",
            true,
            application.trackingNumber
          )
        );
      }

      if (application.status !== "pending" && application.status !== "under_review") {
        return res.status(400).send(
          buildResultPage(
            "Cannot Reject",
            `This application is currently "${application.status}" and cannot be rejected via email. Please use the admin dashboard.`,
            false,
            application.trackingNumber
          )
        );
      }

      // Show rejection form
      return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reject Application - AmeriLend Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f3f4f6; }
    .card { max-width: 520px; width: 90%; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #001a4d 0%, #0050d4 100%); padding: 30px; text-align: center; }
    .header img { height: 50px; margin-bottom: 10px; }
    .header h2 { color: white; font-size: 18px; font-weight: 500; }
    .body { padding: 40px 30px; }
    .icon { font-size: 36px; text-align: center; margin-bottom: 12px; }
    .title { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; text-align: center; }
    .subtitle { color: #6B7280; font-size: 14px; text-align: center; margin-bottom: 24px; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .info-label { color: #6B7280; }
    .info-value { color: #111827; font-weight: 600; }
    label { display: block; font-weight: 600; color: #374151; margin-bottom: 8px; margin-top: 20px; font-size: 14px; }
    textarea { width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-family: inherit; resize: vertical; min-height: 100px; }
    textarea:focus { outline: none; border-color: #DC2626; }
    .btn-row { display: flex; gap: 12px; margin-top: 24px; }
    .btn { flex: 1; padding: 12px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; text-align: center; }
    .btn-danger { background: #DC2626; color: white; }
    .btn-danger:hover { background: #B91C1C; }
    .btn-secondary { background: #f3f4f6; color: #374151; }
    .btn-secondary:hover { background: #e5e7eb; }
    .footer { padding: 16px 30px; background: #f9fafb; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <img src="${COMPANY_INFO.logo.url}" alt="${COMPANY_INFO.logo.alt}">
      <h2>Admin Action Center</h2>
    </div>
    <div class="body">
      <div class="icon">⚠️</div>
      <h1 class="title">Reject Loan Application</h1>
      <p class="subtitle">Please provide a reason for rejecting this application</p>
      
      <div class="info-row">
        <span class="info-label">Applicant</span>
        <span class="info-value">${application.fullName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Email</span>
        <span class="info-value">${application.email}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Tracking #</span>
        <span class="info-value" style="font-family: monospace;">${application.trackingNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Amount</span>
        <span class="info-value">${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(application.requestedAmount / 100)}</span>
      </div>

      <form method="POST" action="/api/admin-action/reject/${req.params.token}">
        <label for="reason">Rejection Reason <span style="color: #DC2626;">*</span></label>
        <textarea id="reason" name="reason" placeholder="e.g., Insufficient income documentation, credit score below threshold..." required></textarea>
        <div class="btn-row">
          <a href="${COMPANY_INFO.website}/admin" class="btn btn-secondary">Cancel</a>
          <button type="submit" class="btn btn-danger">Confirm Rejection</button>
        </div>
      </form>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${COMPANY_INFO.name}. Secure admin action.
    </div>
  </div>
</body>
</html>`);
    } catch (error) {
      console.error("[Admin Email Action] Reject page error:", error);
      return res.status(500).send(
        buildResultPage("Server Error", "Something went wrong. Please try the admin dashboard.", false)
      );
    }
  });

  // Process rejection form submission
  app.post("/api/admin-action/reject/:token", async (req: Request, res: Response) => {
    try {
      const decoded = verifyAdminActionToken(req.params.token);

      if (!decoded || decoded.action !== "reject") {
        return res.status(400).send(
          buildResultPage("Invalid or Expired Link", "This rejection link has expired or is invalid.", false)
        );
      }

      const reason = req.body?.reason?.trim();
      if (!reason) {
        return res.status(400).send(
          buildResultPage("Reason Required", "Please provide a rejection reason. Use the back button and try again.", false)
        );
      }

      const application = await db.getLoanApplicationById(decoded.id);
      if (!application) {
        return res.status(404).send(
          buildResultPage("Application Not Found", "This loan application could not be found.", false)
        );
      }

      if (application.status === "rejected") {
        return res.send(
          buildResultPage("Already Rejected", "This application has already been rejected.", true, application.trackingNumber)
        );
      }

      if (application.status !== "pending" && application.status !== "under_review") {
        return res.status(400).send(
          buildResultPage(
            "Cannot Reject",
            `This application is currently "${application.status}" and cannot be rejected via email.`,
            false,
            application.trackingNumber
          )
        );
      }

      await db.updateLoanApplicationStatus(decoded.id, "rejected", {
        rejectionReason: reason,
      });

      // Log the admin activity
      await db.logAdminActivity({
        adminId: 0,
        action: "reject_loan",
        targetType: "loan",
        targetId: decoded.id,
        details: JSON.stringify({ reason, source: "email_action" }),
      });

      // Send rejection notification to applicant
      const user = await db.getUserById(application.userId);
      if (user?.email) {
        sendApplicationRejectedNotificationEmail(
          user.email,
          user.name || user.email,
          application.trackingNumber || `APP-${decoded.id}`,
          reason
        ).catch(err => console.error("[Admin Email Action] Failed to send rejection email:", err));
      }

      console.log(`[Admin Email Action] Application ${decoded.id} REJECTED via email link. Reason: ${reason}`);

      return res.send(
        buildResultPage(
          "Application Rejected",
          `The loan application for ${application.fullName} has been rejected. The applicant will be notified with the reason provided.`,
          true,
          application.trackingNumber
        )
      );
    } catch (error) {
      console.error("[Admin Email Action] Reject error:", error);
      return res.status(500).send(
        buildResultPage("Server Error", "Something went wrong processing this action.", false)
      );
    }
  });
}
