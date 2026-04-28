import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCryptoPaymentConfig,
  convertUSDToCrypto,
  getCryptoExchangeRate,
} from "./crypto-payment";

describe("getCryptoPaymentConfig", () => {
  it("returns production by default", () => {
    const config = getCryptoPaymentConfig();
    expect(config.environment).toBe("production");
  });

  it("reads CRYPTO_PAYMENT_ENVIRONMENT", () => {
    process.env.CRYPTO_PAYMENT_ENVIRONMENT = "sandbox";
    const config = getCryptoPaymentConfig();
    expect(config.environment).toBe("sandbox");
    delete process.env.CRYPTO_PAYMENT_ENVIRONMENT;
  });
});

describe("getCryptoExchangeRate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 1 for stablecoins when API is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const usdtRate = await getCryptoExchangeRate("USDT");
    expect(usdtRate).toBe(1);
    const usdcRate = await getCryptoExchangeRate("USDC");
    expect(usdcRate).toBe(1);
  });

  it("throws for BTC/ETH when API is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    await expect(getCryptoExchangeRate("BTC")).rejects.toThrow("Unable to fetch live BTC exchange rate");
    await expect(getCryptoExchangeRate("ETH")).rejects.toThrow("Unable to fetch live ETH exchange rate");
  });

  it("parses a valid CoinGecko response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ bitcoin: { usd: 50000 } }),
    } as Response);

    const rate = await getCryptoExchangeRate("BTC");
    expect(rate).toBe(50000);
  });
});

describe("convertUSDToCrypto", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("converts USD cents to crypto amount", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ bitcoin: { usd: 50000 } }),
    } as Response);

    const amount = await convertUSDToCrypto(10000, "BTC"); // $100
    expect(parseFloat(amount)).toBeCloseTo(0.002, 4);
  });

  it("uses 2 decimals for stablecoins", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ tether: { usd: 1 } }),
    } as Response);

    const amount = await convertUSDToCrypto(10000, "USDT"); // $100
    expect(amount).toBe("100.00");
  });
});
