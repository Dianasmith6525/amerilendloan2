/**
 * Cryptocurrency payment integration
 * Supports BTC, ETH, USDT, USDC payments via manual wallet transfers
 * Admin can update wallet addresses anytime from the dashboard
 */

import crypto from 'crypto';
import { verifyCryptoTransactionWeb3, getNetworkStatus, TxVerificationResult } from "./web3-verification";
import { logger } from "./logger";

/**
 * Supported cryptocurrencies
 */
export type CryptoCurrency = "BTC" | "ETH" | "USDT" | "USDC";

/**
 * Crypto payment configuration (manual wallet-based)
 */
export interface CryptoPaymentConfig {
  environment: "sandbox" | "production";
}

/**
 * Get crypto payment configuration from environment
 */
export function getCryptoPaymentConfig(): CryptoPaymentConfig {
  return {
    environment: (process.env.CRYPTO_PAYMENT_ENVIRONMENT as "sandbox" | "production") || "production",
  };
}

/**
 * Get current exchange rate for a cryptocurrency using CoinGecko API (free, no API key required)
 */
export async function getCryptoExchangeRate(currency: CryptoCurrency): Promise<number> {
  try {
    // Map currency to CoinGecko IDs
    const coinGeckoIds: Record<CryptoCurrency, string> = {
      BTC: "bitcoin",
      ETH: "ethereum",
      USDT: "tether",
      USDC: "usd-coin",
    };

    const coinId = coinGeckoIds[currency];
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      logger.error(`CoinGecko API error: ${response.status}`);
      throw new Error(`Unable to fetch live ${currency} exchange rate (API status ${response.status}). Cannot process crypto payment with stale data.`);
    }

    const data = await response.json();
    const rate = data[coinId]?.usd;

    if (!rate) {
      throw new Error(`No rate found for ${currency}`);
    }

    return rate;
  } catch (error) {
    logger.error(`Error fetching ${currency} exchange rate:`, error);
    // Only allow stablecoins to use fallback rate (always ~$1)
    if (currency === "USDT" || currency === "USDC") {
      return 1;
    }
    throw new Error(`Unable to fetch live ${currency} exchange rate. Cannot process crypto payment without current pricing.`);
  }
}

/**
 * Convert USD cents to cryptocurrency amount
 */
export async function convertUSDToCrypto(
  usdCents: number,
  currency: CryptoCurrency
): Promise<string> {
  const usdAmount = usdCents / 100;
  const rate = await getCryptoExchangeRate(currency);
  const cryptoAmount = usdAmount / rate;

  // Format with appropriate decimals
  const decimals = currency === "BTC" ? 8 : currency === "ETH" ? 6 : 2;
  return cryptoAmount.toFixed(decimals);
}

/**
 * Create a cryptocurrency payment charge
 */
export async function createCryptoCharge(
  amount: number, // in USD cents
  currency: CryptoCurrency,
  description: string,
  metadata: Record<string, any>
): Promise<{
  success: boolean;
  chargeId?: string;
  cryptoAmount?: string;
  paymentAddress?: string;
  qrCodeUrl?: string;
  expiresAt?: Date;
  error?: string;
}> {
  const config = getCryptoPaymentConfig();

  try {
    // Convert USD to crypto
    const cryptoAmount = await convertUSDToCrypto(amount, currency);

    // Get real wallet address for this cryptocurrency (from DB or env)
    const paymentAddress = getCryptoWalletAddress(currency);
    const chargeId = `charge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Return payment data with admin-configured wallet address
    // User sends crypto manually, admin verifies on blockchain and approves
    return {
      success: true,
      chargeId,
      cryptoAmount,
      paymentAddress,
      qrCodeUrl: `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${currency}:${paymentAddress}?amount=${cryptoAmount}`,
      expiresAt,
    };
  } catch (error) {
    logger.error("Crypto payment error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Check payment status from blockchain or payment processor
 */
export async function checkCryptoPaymentStatus(
  chargeId: string,
  txHash?: string
): Promise<{
  status: "pending" | "confirmed" | "failed" | "expired";
  txHash?: string;
  confirmations?: number;
  blockNumber?: number;
  timestamp?: Date;
}> {
  if (!txHash) {
    return { status: "pending" };
  }

  try {
    const etherscanKey = process.env.ETHERSCAN_API_KEY;
    
    if (etherscanKey && txHash.startsWith("0x")) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(
          `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionReceipt&txhash=${encodeURIComponent(txHash)}&apikey=${encodeURIComponent(etherscanKey)}`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!response.ok) {
          logger.warn(`[CryptoPayment] Etherscan returned status ${response.status}`);
          return { status: "pending", txHash };
        }

        const data = await response.json();

        // Handle Etherscan rate-limit or error responses
        if (data.status === "0" || data.message === "NOTOK") {
          logger.warn("[CryptoPayment] Etherscan rate limit or error:", data.result);
          return { status: "pending", txHash };
        }
        
        if (data.result && data.result.blockNumber) {
          const controller2 = new AbortController();
          const timeout2 = setTimeout(() => controller2.abort(), 15000);

          const currentBlockRes = await fetch(
            `https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=${encodeURIComponent(etherscanKey)}`,
            { signal: controller2.signal }
          );
          clearTimeout(timeout2);
          const currentBlockData = await currentBlockRes.json();
          const currentBlock = parseInt(currentBlockData.result, 16);
          const txBlock = parseInt(data.result.blockNumber, 16);
          const confirmations = currentBlock - txBlock;
          
          return {
            status: confirmations >= 12 ? "confirmed" : "pending",
            txHash,
            confirmations,
            blockNumber: txBlock,
            timestamp: new Date(),
          };
        }
      } catch (fetchErr) {
        clearTimeout(timeout);
        if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
          logger.warn("[CryptoPayment] Etherscan request timed out");
        } else {
          logger.error("[CryptoPayment] Etherscan fetch error:", fetchErr);
        }
        return { status: "pending", txHash };
      }
    }
    
    return {
      status: "pending",
      txHash,
    };
  } catch (error) {
    logger.error("[CryptoPayment] Status check failed:", error);
    return {
      status: "pending",
      txHash,
    };
  }
}

/**
 * Verify crypto payment by transaction hash using Web3
 */
export async function verifyCryptoPaymentByTxHash(
  currency: CryptoCurrency,
  txHash: string,
  expectedAmount: string,
  expectedAddress: string
): Promise<{
  valid: boolean;
  confirmed: boolean;
  confirmations: number;
  message: string;
}> {
  try {
    // Support ETH, BTC, USDT, USDC
    if (!["ETH", "BTC", "USDT", "USDC"].includes(currency)) {
      return {
        valid: false,
        confirmed: false,
        confirmations: 0,
        message: `Currency ${currency} not supported for Web3 verification`,
      };
    }

    // Use Web3 to verify transaction on blockchain
    // ETH/USDT/USDC use public RPC fallbacks when no API key is configured
    const result = await verifyCryptoTransactionWeb3(
      currency,
      txHash,
      expectedAddress,
      expectedAmount
    );

    return {
      valid: result.valid,
      confirmed: result.confirmed,
      confirmations: result.confirmations,
      message: result.message,
    };
  } catch (error) {
    return {
      valid: false,
      confirmed: false,
      confirmations: 0,
      message: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Check network status
 */
export async function checkNetworkStatus(
  currency: CryptoCurrency
): Promise<{
  online: boolean;
  currentBlock: number;
  message: string;
}> {
  if (currency !== "ETH" && currency !== "BTC") {
    return {
      online: false,
      currentBlock: 0,
      message: `Currency ${currency} network check not supported`,
    };
  }

  return getNetworkStatus(currency);
}

/**
 * Validate crypto payment webhook (unused — admin manually verifies)
 */
export function validateCryptoWebhook(
  signature: string,
  payload: string
): boolean {
  const secret = process.env.CRYPTO_WEBHOOK_SECRET;
  
  if (!secret) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const computedSignature = hmac.digest("hex");

  return signature === computedSignature;
}

/**
 * Get cryptocurrency wallet address from environment or DB
 * Admin can change these anytime from the admin dashboard
 */
function getCryptoWalletAddress(currency: CryptoCurrency): string {
  // Use wallet addresses from environment variables (DB override happens in router)
  const walletAddresses: Record<CryptoCurrency, string> = {
    BTC: process.env.CRYPTO_BTC_ADDRESS || "",
    ETH: process.env.CRYPTO_ETH_ADDRESS || "",
    USDT: process.env.CRYPTO_USDT_ADDRESS || process.env.CRYPTO_ETH_ADDRESS || "",
    USDC: process.env.CRYPTO_USDC_ADDRESS || process.env.CRYPTO_ETH_ADDRESS || "",
  };

  const address = walletAddresses[currency];
  
  if (!address) {
    throw new Error(`No wallet address configured for ${currency}. Please ask the admin to set wallet addresses in the dashboard.`);
  }

  // Basic address format validation
  if ((currency === "ETH" || currency === "USDT" || currency === "USDC") && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid ${currency} wallet address format. Expected a 42-character hex address starting with 0x.`);
  }
  if (currency === "BTC" && !/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address)) {
    throw new Error(`Invalid BTC wallet address format.`);
  }
  
  return address;
}

/**
 * Get supported cryptocurrencies with current rates
 */
export async function getSupportedCryptos(): Promise<
  Array<{
    currency: CryptoCurrency;
    name: string;
    rate: number;
    symbol: string;
  }>
> {
  return [
    {
      currency: "BTC",
      name: "Bitcoin",
      rate: await getCryptoExchangeRate("BTC"),
      symbol: "₿",
    },
    {
      currency: "ETH",
      name: "Ethereum",
      rate: await getCryptoExchangeRate("ETH"),
      symbol: "Ξ",
    },
    {
      currency: "USDT",
      name: "Tether",
      rate: await getCryptoExchangeRate("USDT"),
      symbol: "₮",
    },
    {
      currency: "USDC",
      name: "USD Coin",
      rate: await getCryptoExchangeRate("USDC"),
      symbol: "$",
    },
  ];
}
