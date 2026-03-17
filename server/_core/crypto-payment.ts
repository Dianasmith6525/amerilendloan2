/**
 * Cryptocurrency payment integration
 * Supports BTC, ETH, USDT, USDC payments via manual wallet transfers
 * Admin can update wallet addresses anytime from the dashboard
 */

import crypto from 'crypto';
import { verifyCryptoTransactionWeb3, getNetworkStatus, TxVerificationResult } from "./web3-verification";

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
      console.error(`CoinGecko API error: ${response.status}`);
      throw new Error(`Unable to fetch live ${currency} exchange rate (API status ${response.status}). Cannot process crypto payment with stale data.`);
    }

    const data = await response.json();
    const rate = data[coinId]?.usd;

    if (!rate) {
      throw new Error(`No rate found for ${currency}`);
    }

    return rate;
  } catch (error) {
    console.error(`Error fetching ${currency} exchange rate:`, error);
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
    console.error("Crypto payment error:", error);
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
      const response = await fetch(
        `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${etherscanKey}`
      );
      const data = await response.json();
      
      if (data.result && data.result.blockNumber) {
        const currentBlockRes = await fetch(
          `https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=${etherscanKey}`
        );
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
    }
    
    return {
      status: "pending",
      txHash,
    };
  } catch (error) {
    console.error("[CryptoPayment] Status check failed:", error);
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

    // Validate required API keys for Ethereum-based currencies
    if (["ETH", "USDT", "USDC"].includes(currency)) {
      if (!process.env.ETHEREUM_RPC_URL && !process.env.ALCHEMY_API_KEY) {
        return {
          valid: false,
          confirmed: false,
          confirmations: 0,
          message: "Blockchain verification is not configured. Please contact support.",
        };
      }
    }

    // Use Web3 to verify transaction on blockchain
    const result = await verifyCryptoTransactionWeb3(
      currency as any,
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
  if (!["ETH", "BTC"].includes(currency)) {
    return {
      online: false,
      currentBlock: 0,
      message: `Currency ${currency} network check not supported`,
    };
  }

  return getNetworkStatus(currency as any);
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
