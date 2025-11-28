/**
 * Script to check recent crypto payments and verify their authenticity
 * Run with: npx tsx scripts/check-crypto-payments.ts
 */

import { config } from "dotenv";
import { getDb } from "../server/db";
import { payments } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { verifyCryptoPaymentByTxHash } from "../server/_core/crypto-payment";
import { verifyCryptoTransactionWeb3 } from "../server/_core/web3-verification";

// Load environment variables
config();

async function checkRecentCryptoPayments() {
  console.log("🔍 Checking recent crypto payments...\n");
  
  try {
    const dbInstance = await getDb();
    
    if (!dbInstance) {
      console.error("❌ Failed to get database instance");
      return;
    }
    
    // Get recent crypto payments
    const recentPayments = await dbInstance
      .select()
      .from(payments)
      .where(eq(payments.paymentMethod, "crypto"))
      .orderBy(desc(payments.createdAt))
      .limit(20);

  if (recentPayments.length === 0) {
    console.log("❌ No crypto payments found");
    return;
  }

  console.log(`📊 Found ${recentPayments.length} crypto payment(s)\n`);
  console.log("=" .repeat(100));

  for (const payment of recentPayments) {
    console.log(`\n💰 Payment ID: ${payment.id}`);
    console.log(`   User ID: ${payment.userId}`);
    console.log(`   Amount: $${(payment.amount / 100).toFixed(2)} USD`);
    console.log(`   Crypto: ${payment.cryptoAmount} ${payment.cryptoCurrency}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Address: ${payment.cryptoAddress}`);
    console.log(`   TX Hash: ${payment.cryptoTxHash || "NOT PROVIDED YET"}`);
    console.log(`   Created: ${payment.createdAt}`);
    console.log(`   Completed: ${payment.completedAt || "PENDING"}`);

    // If there's a transaction hash, verify it
    if (payment.cryptoTxHash && payment.cryptoCurrency && payment.cryptoAmount && payment.cryptoAddress) {
      console.log(`\n   🔍 VERIFYING TRANSACTION...`);
      
      try {
        // Verify using Web3
        const web3Verification = await verifyCryptoTransactionWeb3(
          payment.cryptoCurrency as any,
          payment.cryptoTxHash,
          payment.cryptoAmount,
          payment.cryptoAddress
        );

        console.log(`\n   ✅ WEB3 VERIFICATION RESULTS:`);
        console.log(`      Valid: ${web3Verification.valid ? "✅ YES" : "❌ NO"}`);
        console.log(`      Confirmed: ${web3Verification.confirmed ? "✅ YES" : "⏳ PENDING"}`);
        console.log(`      Confirmations: ${web3Verification.confirmations || 0}`);
        console.log(`      Message: ${web3Verification.message}`);

        // Also verify using crypto-payment service
        const serviceVerification = await verifyCryptoPaymentByTxHash(
          payment.cryptoCurrency as any,
          payment.cryptoTxHash,
          payment.cryptoAmount,
          payment.cryptoAddress
        );

        console.log(`\n   ✅ SERVICE VERIFICATION:`);
        console.log(`      Valid: ${serviceVerification.valid ? "✅ YES" : "❌ NO"}`);
        console.log(`      Confirmed: ${serviceVerification.confirmed ? "✅ YES" : "⏳ PENDING"}`);
        console.log(`      Message: ${serviceVerification.message}`);

        // Final verdict
        if (web3Verification.valid && serviceVerification.valid) {
          console.log(`\n   🎉 VERDICT: REAL PAYMENT ✅`);
          if (web3Verification.confirmed) {
            console.log(`      Status: FULLY CONFIRMED ON BLOCKCHAIN`);
          } else {
            console.log(`      Status: PENDING CONFIRMATIONS (${web3Verification.confirmations || 0} confirmations)`);
          }
        } else {
          console.log(`\n   ⚠️  VERDICT: SUSPICIOUS/FAKE PAYMENT ❌`);
          console.log(`      Reason: Transaction hash not found or invalid`);
        }

      } catch (error) {
        console.error(`\n   ❌ VERIFICATION FAILED:`, error instanceof Error ? error.message : error);
        console.log(`   ⚠️  VERDICT: UNABLE TO VERIFY - TREAT AS SUSPICIOUS`);
      }
    } else {
      console.log(`\n   ⏳ Transaction hash not submitted yet - waiting for user to provide it`);
    }

    console.log("\n" + "=".repeat(100));
  }

  console.log(`\n✅ Verification complete!`);
  console.log(`\n📝 SUMMARY:`);
  console.log(`   Total payments checked: ${recentPayments.length}`);
  console.log(`   With transaction hash: ${recentPayments.filter((p: any) => p.cryptoTxHash).length}`);
  console.log(`   Pending verification: ${recentPayments.filter((p: any) => !p.cryptoTxHash).length}`);
  console.log(`   Completed: ${recentPayments.filter((p: any) => p.status === "succeeded").length}`);
  console.log(`   Failed: ${recentPayments.filter((p: any) => p.status === "failed").length}`);
  console.log(`   Processing: ${recentPayments.filter((p: any) => p.status === "processing").length}`);
  } catch (error) {
    console.error("\n❌ Database query failed:", error);
    throw error;
  }
}

// Run the script
checkRecentCryptoPayments()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
