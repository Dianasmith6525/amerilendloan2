/**
 * Cryptocurrency payment integration
 * Supports BTC, ETH, USDT payments via Coinbase Commerce or similar gateway
 */

import { verifyCryptoTransactionWeb3, getNetworkStatus, TxVerificationResult } from "./web3-verification";

/**
 * Supported cryptocurrencies
 */
export type CryptoCurrency = "BTC" | "ETH" | "USDT" | "USDC";

/**
 * Crypto payment configuration
 */
export interface CryptoPaymentConfig {
  apiKey: string;
  webhookSecret: string;
  environment: "sandbox" | "production";
}

/**
 * Get crypto payment configuration from environment
 */
export function getCryptoPaymentConfig(): CryptoPaymentConfig {
  return {
    apiKey: process.env.COINBASE_COMMERCE_API_KEY || "",
    webhookSecret: process.env.COINBASE_COMMERCE_WEBHOOK_SECRET || "",
    environment: (process.env.CRYPTO_PAYMENT_ENVIRONMENT as "sandbox" | "production") || "sandbox",
  };
}

/**
 * Cryptocurrency exchange rates (mock data for demo)
 * In production, fetch from real-time API like CoinGecko or CoinMarketCap
 */
const MOCK_EXCHANGE_RATES: Record<CryptoCurrency, number> = {
  BTC: 65000, // 1 BTC = $65,000
  ETH: 3200,  // 1 ETH = $3,200
  USDT: 1,    // 1 USDT = $1
  USDC: 1,    // 1 USDC = $1
};

/**
 * Get current exchange rate for a cryptocurrency
 */
export async function getCryptoExchangeRate(currency: CryptoCurrency): Promise<number> {
  // In production, fetch from API:
  /*
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${currency.toLowerCase()}&vs_currencies=usd`
  );
  const data = await response.json();
  return data[currency.toLowerCase()].usd;
  */

  // For demo, return mock rates
  return MOCK_EXCHANGE_RATES[currency];
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

  if (!config.apiKey) {
    return {
      success: false,
      error: "Cryptocurrency payment gateway not configured",
    };
  }

  try {
    // Convert USD to crypto
    const cryptoAmount = await convertUSDToCrypto(amount, currency);

    // Get real wallet address for this cryptocurrency
    const paymentAddress = getCryptoWalletAddress(currency);
    const chargeId = `charge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    /*
    // Production implementation with Coinbase Commerce:
    const response = await fetch("https://api.commerce.coinbase.com/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": config.apiKey,
        "X-CC-Version": "2018-03-22",
      },
      body: JSON.stringify({
        name: description,
        description,
        pricing_type: "fixed_price",
        local_price: {
          amount: (amount / 100).toFixed(2),
          currency: "USD",
        },
        metadata,
      }),
    });

    const data = await response.json();
    
    if (data.data) {
      const charge = data.data;
      const selectedCrypto = charge.pricing[currency];
      
      return {
        success: true,
        chargeId: charge.id,
        cryptoAmount: selectedCrypto.amount,
        paymentAddress: charge.addresses[currency],
        qrCodeUrl: `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${currency}:${charge.addresses[currency]}?amount=${selectedCrypto.amount}`,
        expiresAt: new Date(charge.expires_at),
      };
    }
    */

    // Return real payment data with your wallet address
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
 * Check payment status from blockchain
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
  // In production, would verify against blockchain:
  // - For BTC: Use blockchain.com API or Blockchair
  // - For ETH: Use etherscan.io API or alchemy
  // - For USDT/USDC: Use token contract verification
  
  /*
  if (!txHash) {
    return { status: "pending" };
  }

  try {
    // Example: Check Ethereum transaction
    const response = await fetch(
      `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${process.env.ETHERSCAN_API_KEY}`
    );
    const data = await response.json();
    
    if (data.result) {
      const blockConfirmations = data.result.blockNumber ? 
        Math.floor(Math.random() * 20) + 1 : 0; // Mock confirmations
      
      return {
        status: blockConfirmations >= 12 ? "confirmed" : "pending",
        txHash,
        confirmations: blockConfirmations,
        blockNumber: parseInt(data.result.blockNumber || "0"),
        timestamp: new Date(parseInt(data.result.timeStamp || "0") * 1000),
      };
    }
  } catch (error) {
    console.error("Error checking tx status:", error);
  }
  */

  // For demo, return mock status
  return {
    status: "pending",
    txHash,
  };
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
 * Validate crypto payment webhook
 */
export function validateCryptoWebhook(
  signature: string,
  payload: string
): boolean {
  const config = getCryptoPaymentConfig();
  
  if (!config.webhookSecret) {
    return false;
  }

  const crypto = require("crypto");
  const hmac = crypto.createHmac("sha256", config.webhookSecret);
  hmac.update(payload);
  const computedSignature = hmac.digest("hex");

  return signature === computedSignature;
}

/**
 * Get real cryptocurrency wallet address from environment
 */
function getCryptoWalletAddress(currency: CryptoCurrency): string {
  // Use real wallet addresses from environment variables
  const walletAddresses: Record<CryptoCurrency, string> = {
    BTC: process.env.CRYPTO_BTC_ADDRESS || "",
    ETH: process.env.CRYPTO_ETH_ADDRESS || "",
    USDT: process.env.CRYPTO_USDT_ADDRESS || process.env.CRYPTO_ETH_ADDRESS || "", // USDT is ERC-20
    USDC: process.env.CRYPTO_USDC_ADDRESS || process.env.CRYPTO_ETH_ADDRESS || "", // USDC is ERC-20
  };

  const address = walletAddresses[currency];
  
  if (!address) {
    throw new Error(`No wallet address configured for ${currency}`);
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
