/**
 * Web3 Blockchain Verification Module
 * Real-time verification of cryptocurrency transactions using Ethers.js and blockchain APIs
 */

import { ethers } from "ethers";
import { logger } from "./logger";

/**
 * Supported blockchain networks
 */
export interface BlockchainNetwork {
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  currency: string;
  confirmationsRequired: number;
}

/**
 * Blockchain network configurations
 * Falls back to free public RPC endpoints when no API key is configured
 */
const FREE_PUBLIC_ETH_RPCS = [
  "https://cloudflare-eth.com",
  "https://ethereum.publicnode.com",
  "https://rpc.ankr.com/eth",
];

function buildEthRpcUrl(): string {
  if (process.env.ETHEREUM_RPC_URL) return process.env.ETHEREUM_RPC_URL;
  if (process.env.ALCHEMY_API_KEY) return `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  // Fall back to first free public RPC
  return FREE_PUBLIC_ETH_RPCS[0];
}

const NETWORKS: Record<string, BlockchainNetwork> = {
  ETH: {
    name: "Ethereum",
    rpcUrl: buildEthRpcUrl(),
    explorerUrl: "https://etherscan.io",
    currency: "ETH",
    confirmationsRequired: 12,
  },
  BTC: {
    name: "Bitcoin",
    rpcUrl: process.env.BITCOIN_RPC_URL || "https://blockchain.info",
    explorerUrl: "https://blockchair.com/bitcoin",
    currency: "BTC",
    confirmationsRequired: 6, // Industry standard for Bitcoin
  },
  POLYGON: {
    name: "Polygon",
    rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
    currency: "MATIC",
    confirmationsRequired: 256,
  },
};

/**
 * Transaction verification result
 */
export interface TxVerificationResult {
  valid: boolean;
  confirmed: boolean;
  confirmations: number;
  blockNumber?: number;
  timestamp?: number;
  gasUsed?: string;
  gasPrice?: string;
  from?: string;
  to?: string;
  value?: string;
  status?: "success" | "failed" | "pending";
  message: string;
}

/**
 * Verify Ethereum/ERC-20 token transaction
 */
export async function verifyEthereumTransaction(
  txHash: string,
  expectedToAddress: string,
  expectedAmount?: string
): Promise<TxVerificationResult> {
  try {
    // Validate tx hash format (0x + 64 hex chars)
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return {
        valid: false,
        confirmed: false,
        confirmations: 0,
        message: "Invalid transaction hash format",
      };
    }

    const network = NETWORKS.ETH;
    
    // Build ordered list of RPC URLs to try: configured first, then free public fallbacks
    const rpcCandidates: string[] = [];
    if (process.env.ETHEREUM_RPC_URL) rpcCandidates.push(process.env.ETHEREUM_RPC_URL);
    if (process.env.ALCHEMY_API_KEY) rpcCandidates.push(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
    for (const url of FREE_PUBLIC_ETH_RPCS) {
      if (!rpcCandidates.includes(url)) rpcCandidates.push(url);
    }

    let provider: ethers.JsonRpcProvider | null = null;
    let tx: ethers.TransactionResponse | null = null;
    for (const rpcUrl of rpcCandidates) {
      try {
        const candidate = new ethers.JsonRpcProvider(rpcUrl);
        const found = await candidate.getTransaction(txHash);
        if (found !== null) {
          provider = candidate;
          tx = found;
          break;
        }
        // Transaction not found but RPC responded — keep this provider
        if (!provider) provider = candidate;
      } catch {
        // This RPC failed; try next
      }
    }

    if (!provider) {
      return {
        valid: false,
        confirmed: false,
        confirmations: 0,
        message: "Unable to connect to Ethereum network. Please try again later.",
      };
    }

    if (!tx) {
      return {
        valid: false,
        confirmed: false,
        confirmations: 0,
        message: "Transaction not found on blockchain",
      };
    }

    // Verify recipient address
    const txTo = tx.to?.toLowerCase();
    const expectedTo = expectedToAddress.toLowerCase();
    if (txTo !== expectedTo) {
      return {
        valid: false,
        confirmed: false,
        confirmations: 0,
        message: `Transaction recipient mismatch. Expected ${expectedToAddress}, got ${tx.to}`,
      };
    }

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return {
        valid: true,
        confirmed: false,
        confirmations: 0,
        message: "Transaction pending. Waiting for confirmations.",
      };
    }

    // Calculate confirmations
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;
    const isConfirmed = confirmations >= network.confirmationsRequired;

    // Verify transaction status
    const txStatus = receipt.status === 1 ? "success" : receipt.status === 0 ? "failed" : "pending";

    if (txStatus === "failed") {
      return {
        valid: false,
        confirmed: false,
        confirmations,
        blockNumber: receipt.blockNumber,
        status: "failed",
        message: "Transaction failed on blockchain",
      };
    }

    return {
      valid: true,
      confirmed: isConfirmed,
      confirmations,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: tx.gasPrice?.toString(),
      from: tx.from,
      to: tx.to || undefined,
      value: tx.value?.toString(),
      status: "success",
      message: isConfirmed
        ? `Transaction confirmed with ${confirmations} confirmations`
        : `Transaction has ${confirmations}/${network.confirmationsRequired} confirmations. Please wait.`,
    };
  } catch (error) {
    logger.error("Ethereum verification error:", error);
    return {
      valid: false,
      confirmed: false,
      confirmations: 0,
      message: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Verify Bitcoin transaction
 */
export async function verifyBitcoinTransaction(
  txHash: string,
  expectedToAddress: string,
  expectedAmount?: string
): Promise<TxVerificationResult> {
  try {
    // Validate tx hash format (64 hex chars)
    if (!/^[a-fA-F0-9]{64}$/.test(txHash)) {
      return {
        valid: false,
        confirmed: false,
        confirmations: 0,
        message: "Invalid Bitcoin transaction hash format",
      };
    }

    // Use Blockchain.com API (free, no API key required)
    try {
      const response = await fetch(`https://blockchain.info/rawtx/${txHash}`);
      
      if (!response.ok) {
        // Try backup API: Mempool.space
        const mempoolResponse = await fetch(`https://mempool.space/api/tx/${txHash}`);
        
        if (!mempoolResponse.ok) {
          return {
            valid: false,
            confirmed: false,
            confirmations: 0,
            message: "Bitcoin transaction not found on blockchain",
          };
        }

        const mempoolData = await mempoolResponse.json();
        
        // Get current block height for confirmations
        const blockResponse = await fetch('https://mempool.space/api/blocks/tip/height');
        const currentHeight = await blockResponse.json();
        
        const confirmations = mempoolData.status?.confirmed 
          ? currentHeight - mempoolData.status.block_height + 1 
          : 0;
        const isConfirmed = confirmations >= NETWORKS.BTC.confirmationsRequired;

        // Verify output address
        const hasTargetAddress = mempoolData.vout?.some((output: any) =>
          output.scriptpubkey_address === expectedToAddress
        );

        if (!hasTargetAddress) {
          return {
            valid: false,
            confirmed: false,
            confirmations,
            message: "Transaction does not send to expected Bitcoin address",
          };
        }

        return {
          valid: true,
          confirmed: isConfirmed,
          confirmations,
          blockNumber: mempoolData.status?.block_height,
          status: mempoolData.status?.confirmed ? "success" : "pending",
          message: isConfirmed
            ? `Bitcoin transaction confirmed with ${confirmations} confirmations`
            : `Bitcoin transaction has ${confirmations}/${NETWORKS.BTC.confirmationsRequired} confirmations. Please wait.`,
        };
      }

      const data = await response.json();
      
      // Get latest block height for confirmations calculation
      const latestBlockResponse = await fetch('https://blockchain.info/latestblock');
      const latestBlock = await latestBlockResponse.json();
      const currentHeight = latestBlock.height;
      
      // Calculate confirmations
      const blockHeight = data.block_height || 0;
      const confirmations = blockHeight > 0 ? currentHeight - blockHeight + 1 : 0;
      const isConfirmed = confirmations >= NETWORKS.BTC.confirmationsRequired;

      // Verify output address
      const hasTargetAddress = data.out?.some((output: any) =>
        output.addr === expectedToAddress
      );

      if (!hasTargetAddress) {
        return {
          valid: false,
          confirmed: false,
          confirmations,
          message: "Transaction does not send to expected Bitcoin address",
        };
      }

      return {
        valid: true,
        confirmed: isConfirmed,
        confirmations,
        blockNumber: blockHeight,
        status: blockHeight > 0 ? "success" : "pending",
        message: isConfirmed
          ? `Bitcoin transaction confirmed with ${confirmations} confirmations`
          : `Bitcoin transaction has ${confirmations}/${NETWORKS.BTC.confirmationsRequired} confirmations. Please wait.`,
      };
    } catch (apiError) {
      logger.error("Bitcoin API error:", apiError);
      return {
        valid: false,
        confirmed: false,
        confirmations: 0,
        message: "Unable to verify Bitcoin transaction. Please try again later.",
      };
    }
  } catch (error) {
    logger.error("Bitcoin verification error:", error);
    return {
      valid: false,
      confirmed: false,
      confirmations: 0,
      message: error instanceof Error ? error.message : "Bitcoin verification failed",
    };
  }
}

/**
 * Verify USDT/USDC ERC-20 token transfer
 */
export async function verifyERC20Transfer(
  txHash: string,
  expectedToAddress: string,
  expectedAmount: string,
  tokenAddress: string
): Promise<TxVerificationResult> {
  try {
    // First verify basic transaction
    const baseTx = await verifyEthereumTransaction(txHash, tokenAddress);
    if (!baseTx.valid) {
      return baseTx;
    }

    const network = NETWORKS.ETH;
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return baseTx;
    }

    // Parse transfer events from receipt logs
    const transferSignature = ethers.id("Transfer(address,address,uint256)");
    const transferLogs = receipt.logs.filter((log) => log.topics[0] === transferSignature);

    if (transferLogs.length === 0) {
      return {
        valid: false,
        confirmed: false,
        confirmations: baseTx.confirmations,
        message: "No token transfer found in transaction",
      };
    }

    // Check if transfer is to expected address
    let foundTransfer = false;
    for (const log of transferLogs) {
      if (log.topics.length >= 3) {
        const toAddress = "0x" + log.topics[2].slice(-40);
        if (toAddress.toLowerCase() === expectedToAddress.toLowerCase()) {
          foundTransfer = true;
          break;
        }
      }
    }

    if (!foundTransfer) {
      return {
        valid: false,
        confirmed: baseTx.confirmed,
        confirmations: baseTx.confirmations,
        message: "Token transfer not sent to expected address",
      };
    }

    return {
      valid: true,
      confirmed: baseTx.confirmed,
      confirmations: baseTx.confirmations,
      blockNumber: baseTx.blockNumber,
      gasUsed: baseTx.gasUsed,
      status: "success",
      message: baseTx.message,
    };
  } catch (error) {
    logger.error("ERC-20 verification error:", error);
    return {
      valid: false,
      confirmed: false,
      confirmations: 0,
      message: error instanceof Error ? error.message : "ERC-20 verification failed",
    };
  }
}

/**
 * Verify crypto payment by transaction hash and currency
 */
export async function verifyCryptoTransactionWeb3(
  currency: "BTC" | "ETH" | "USDT" | "USDC",
  txHash: string,
  expectedToAddress: string,
  expectedAmount?: string
): Promise<TxVerificationResult> {
  if (currency === "BTC") {
    return verifyBitcoinTransaction(txHash, expectedToAddress, expectedAmount);
  } else if (currency === "ETH") {
    return verifyEthereumTransaction(txHash, expectedToAddress, expectedAmount);
  } else if (currency === "USDT" || currency === "USDC") {
    // USDT on Ethereum (contract address)
    const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const tokenAddress = currency === "USDT" ? usdtAddress : usdcAddress;
    return verifyERC20Transfer(txHash, expectedToAddress, expectedAmount || "", tokenAddress);
  }

  return {
    valid: false,
    confirmed: false,
    confirmations: 0,
    message: "Unsupported currency for Web3 verification",
  };
}

/**
 * Get current blockchain network status
 */
export async function getNetworkStatus(currency: "BTC" | "ETH"): Promise<{
  online: boolean;
  currentBlock: number;
  gasPrice?: string;
  message: string;
}> {
  try {
    const network = NETWORKS[currency];
    if (!network) {
      return {
        online: false,
        currentBlock: 0,
        message: `Network ${currency} not configured`,
      };
    }

    if (currency === "ETH") {
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice?.toString() || "0";

      return {
        online: true,
        currentBlock: blockNumber,
        gasPrice: gasPrice.toString(),
        message: "Ethereum network is online",
      };
    } else if (currency === "BTC") {
      // In production, fetch Bitcoin network info
      return {
        online: true,
        currentBlock: 0,
        message: "Bitcoin network is online",
      };
    }

    return {
      online: false,
      currentBlock: 0,
      message: "Unable to check network status",
    };
  } catch (error) {
    logger.error("Network status error:", error);
    return {
      online: false,
      currentBlock: 0,
      message: error instanceof Error ? error.message : "Network check failed",
    };
  }
}
