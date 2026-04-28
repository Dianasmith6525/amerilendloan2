/**
 * Snapshot of recent loan applications + job applications.
 * Run with: npx tsx scripts/check-recent-applications.ts [limit]
 */

import { config } from "dotenv";
import path from "path";
import { desc } from "drizzle-orm";
import { getDb } from "../server/db";
import { loanApplications, jobApplications } from "../drizzle/schema";

config({ path: path.resolve(process.cwd(), ".env") });
config({ path: path.resolve(process.cwd(), ".env.local"), override: false });

async function main() {
  const limit = Number(process.argv[2]) || 10;
  const db = await getDb();
  if (!db) {
    console.error("[check] Database not available — is DATABASE_URL set?");
    process.exit(1);
  }

  const loans = await db
    .select({
      id: loanApplications.id,
      tracking: loanApplications.trackingNumber,
      fullName: loanApplications.fullName,
      email: loanApplications.email,
      requestedAmount: loanApplications.requestedAmount,
      status: loanApplications.status,
      createdAt: loanApplications.createdAt,
    })
    .from(loanApplications)
    .orderBy(desc(loanApplications.createdAt))
    .limit(limit);

  const jobs = await db
    .select({
      id: jobApplications.id,
      fullName: jobApplications.fullName,
      email: jobApplications.email,
      position: jobApplications.position,
      status: jobApplications.status,
      createdAt: jobApplications.createdAt,
    })
    .from(jobApplications)
    .orderBy(desc(jobApplications.createdAt))
    .limit(limit);

  console.log(`\n=== Recent Loan Applications (top ${limit}) ===`);
  if (loans.length === 0) {
    console.log("(none)");
  } else {
    for (const l of loans) {
      const amount = (l.requestedAmount / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
      console.log(
        `#${l.id} ${l.tracking}  ${l.status.padEnd(15)}  ${amount.padStart(12)}  ${l.fullName}  <${l.email}>  ${l.createdAt.toISOString()}`,
      );
    }
  }

  console.log(`\n=== Recent Job Applications (top ${limit}) ===`);
  if (jobs.length === 0) {
    console.log("(none)");
  } else {
    for (const j of jobs) {
      console.log(
        `#${j.id}  ${j.status.padEnd(13)}  ${j.position.padEnd(30)}  ${j.fullName}  <${j.email}>  ${j.createdAt.toISOString()}`,
      );
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[check] Failed:", err);
  process.exit(1);
});
