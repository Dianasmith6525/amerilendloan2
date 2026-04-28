/**
 * Reconcile Stripe payments stuck in `processing` or `pending` by querying
 * Stripe directly and updating local DB to match Stripe's source of truth.
 *
 * SAFE BY DEFAULT — runs in dry-run mode unless --apply is passed.
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/reconcile-stripe-payments.ts
 *   node --env-file=.env --import tsx scripts/reconcile-stripe-payments.ts --apply
 *   node --env-file=.env --import tsx scripts/reconcile-stripe-payments.ts --apply --loan 15
 */

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import Stripe from "stripe";
import { getDb, updatePaymentStatus, updateLoanApplicationStatus } from "../server/db";
import { payments, loanApplications } from "../drizzle/schema";

const APPLY = process.argv.includes("--apply");
const loanArgIdx = process.argv.indexOf("--loan");
const LOAN_FILTER = loanArgIdx >= 0 ? Number(process.argv[loanArgIdx + 1]) : null;

const STRIPE_SUCCESS = new Set(["succeeded"]);
const STRIPE_FAILED = new Set(["canceled", "requires_payment_method"]);

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.error("[reconcile] STRIPE_SECRET_KEY not set");
    process.exit(1);
  }
  const stripe = new Stripe(secret, { apiVersion: "2025-11-17.clover" });

  const db = await getDb();
  if (!db) {
    console.error("[reconcile] DB unavailable");
    process.exit(1);
  }

  const conditions = [
    eq(payments.paymentProvider, "stripe"),
    isNotNull(payments.paymentIntentId),
    inArray(payments.status, ["pending", "processing"] as any),
  ];
  if (LOAN_FILTER) conditions.push(eq(payments.loanApplicationId, LOAN_FILTER));

  const stuck = await db
    .select()
    .from(payments)
    .where(and(...conditions));

  console.log(
    `\n[reconcile] Found ${stuck.length} stuck Stripe payment(s)${LOAN_FILTER ? ` for loan #${LOAN_FILTER}` : ""}. Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`,
  );

  let succeededCount = 0;
  let failedCount = 0;
  let unchanged = 0;
  let errors = 0;

  for (const p of stuck) {
    try {
      const pi = await stripe.paymentIntents.retrieve(p.paymentIntentId!);
      const stripeStatus = pi.status;

      if (STRIPE_SUCCESS.has(stripeStatus)) {
        console.log(
          `payment#${p.id} loan#${p.loanApplicationId} (${p.paymentIntentId}) Stripe=succeeded local=${p.status} → would mark SUCCEEDED`,
        );
        if (APPLY) {
          await updatePaymentStatus(p.id, "succeeded", {
            completedAt: new Date(pi.created * 1000),
          }, { action: "reconciled_from_stripe" });
          // If this is a processing fee payment, also flip the loan to fee_paid
          const [loan] = await db
            .select()
            .from(loanApplications)
            .where(eq(loanApplications.id, p.loanApplicationId))
            .limit(1);
          if (loan && loan.status === "fee_pending") {
            await updateLoanApplicationStatus(p.loanApplicationId, "fee_paid");
            console.log(`  └─ loan#${p.loanApplicationId} flipped fee_pending → fee_paid`);
          }
        }
        succeededCount++;
      } else if (STRIPE_FAILED.has(stripeStatus)) {
        const reason =
          pi.last_payment_error?.message ||
          (stripeStatus === "canceled" ? "Canceled by user" : "Payment failed");
        console.log(
          `payment#${p.id} loan#${p.loanApplicationId} (${p.paymentIntentId}) Stripe=${stripeStatus} local=${p.status} → would mark FAILED (${reason})`,
        );
        if (APPLY) {
          await updatePaymentStatus(p.id, "failed", {
            failureReason: reason,
          }, { action: "reconciled_from_stripe" });
        }
        failedCount++;
      } else {
        console.log(
          `payment#${p.id} loan#${p.loanApplicationId} (${p.paymentIntentId}) Stripe=${stripeStatus} local=${p.status} → no action (still in flight)`,
        );
        unchanged++;
      }
    } catch (err: any) {
      console.error(`payment#${p.id} (${p.paymentIntentId}) ERROR: ${err.message}`);
      errors++;
    }
  }

  console.log(
    `\n[reconcile] ${APPLY ? "Applied" : "Dry-run"}: ${succeededCount} succeeded, ${failedCount} failed, ${unchanged} unchanged, ${errors} errors`,
  );
  if (!APPLY && (succeededCount > 0 || failedCount > 0)) {
    console.log(`[reconcile] Re-run with --apply to commit changes.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[reconcile] Failed:", err);
  process.exit(1);
});
