/**
 * Inspect a stuck loan application: dump payments, audit log, fee status.
 * Run with: node --env-file=.env --import tsx scripts/inspect-loan.ts <loanId>
 */

import { desc, eq } from "drizzle-orm";
import { getDb } from "../server/db";
import {
  loanApplications,
  payments,
  paymentAuditLog,
} from "../drizzle/schema";

async function main() {
  const loanId = Number(process.argv[2]);
  if (!loanId) {
    console.error("Usage: node --env-file=.env --import tsx scripts/inspect-loan.ts <loanId>");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.error("[inspect] DB unavailable");
    process.exit(1);
  }

  const [loan] = await db
    .select()
    .from(loanApplications)
    .where(eq(loanApplications.id, loanId))
    .limit(1);

  if (!loan) {
    console.error(`[inspect] Loan #${loanId} not found`);
    process.exit(1);
  }

  console.log(`\n=== Loan #${loan.id} (${loan.trackingNumber}) ===`);
  console.log(`Applicant:        ${loan.fullName} <${loan.email}> ${loan.phone}`);
  console.log(`Status:           ${loan.status}`);
  console.log(`Requested:        $${(loan.requestedAmount / 100).toLocaleString()}`);
  console.log(
    `Approved amount:  ${loan.approvedAmount ? "$" + (loan.approvedAmount / 100).toLocaleString() : "(not approved)"}`,
  );
  console.log(
    `Processing fee:   ${loan.processingFeeAmount ? "$" + (loan.processingFeeAmount / 100).toLocaleString() : "(not set)"}`,
  );
  console.log(`Fee verified:     ${loan.feePaymentVerified ? "yes @ " + loan.feeVerifiedAt?.toISOString() : "no"}`);
  console.log(`Created:          ${loan.createdAt.toISOString()}`);
  console.log(`Approved at:      ${loan.approvedAt ? loan.approvedAt.toISOString() : "(n/a)"}`);
  console.log(`Disbursed at:     ${loan.disbursedAt ? loan.disbursedAt.toISOString() : "(n/a)"}`);
  console.log(`Disbursement:     ${loan.disbursementMethod}`);
  console.log(`Locked:           ${loan.isLocked ? "YES — " + loan.lockedReason : "no"}`);

  const pays = await db
    .select()
    .from(payments)
    .where(eq(payments.loanApplicationId, loanId))
    .orderBy(desc(payments.createdAt));

  console.log(`\n--- Payments (${pays.length}) ---`);
  if (pays.length === 0) {
    console.log("(none — user never started checkout)");
  } else {
    for (const p of pays) {
      console.log(
        `#${p.id}  ${p.status.padEnd(12)}  ${p.paymentProvider}/${p.paymentMethod}  $${(p.amount / 100).toLocaleString()}  PI=${p.paymentIntentId || "(none)"}  ${p.createdAt.toISOString()}${p.failureReason ? "  FAIL: " + p.failureReason : ""}`,
      );
    }
  }

  if (pays.length > 0) {
    const paymentIds = pays.map((p) => p.id);
    const audit = await db
      .select()
      .from(paymentAuditLog)
      .orderBy(desc(paymentAuditLog.createdAt))
      .limit(50);
    const relevant = audit.filter((a) => paymentIds.includes(a.paymentId));
    console.log(`\n--- Payment audit (${relevant.length}) ---`);
    for (const a of relevant) {
      console.log(
        `[${a.createdAt.toISOString()}] payment#${a.paymentId} ${a.action}  ${a.oldStatus || "-"} → ${a.newStatus || "-"}`,
      );
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[inspect] Failed:", err);
  process.exit(1);
});
