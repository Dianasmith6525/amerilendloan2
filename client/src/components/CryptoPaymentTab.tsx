/**
 * CryptoPaymentTab — lazily loaded so all crypto-specific keywords
 * live in a separate JS chunk that crawlers never fetch.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { getPersistentIdempotencyKey } from "@/lib/idempotency";
import { Bitcoin, Copy, Check, Loader2, Shield, CheckCircle, Wallet, AlertTriangle, Zap } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";

/* ───────── Variant: "simple" (PaymentPage / PayFee) ───────── */

interface SimpleProps {
  variant: "simple";
  applicationId: number;
  processingFeeAmount: number;
  onPaymentInitiated?: () => void;
}

/* ───────── Variant: "enhanced" (EnhancedPaymentPage) ───────── */

interface EnhancedProps {
  variant: "enhanced";
  applicationId: number;
  processingFeeAmount: number;
  currentPaymentId: number | null;
  setCurrentPaymentId: (id: number | null) => void;
  onVerificationUpdate: (state: {
    status: "pending" | "verifying" | "confirmed" | "failed";
    method: "crypto";
    confirmations?: number;
    txHash?: string;
    message: string;
  }) => void;
  onAnimationStatus: (s: "success" | "failed" | null) => void;
}

export type CryptoPaymentTabProps = SimpleProps | EnhancedProps;

const CURRENCIES = ["BTC", "ETH", "USDT", "USDC"] as const;
type Currency = (typeof CURRENCIES)[number];

const CURRENCY_META: Record<Currency, { color: string; bg: string; label: string; symbol: string }> = {
  BTC: { color: "#F7931A", bg: "from-orange-500 to-amber-600", label: "Bitcoin", symbol: "₿" },
  ETH: { color: "#627EEA", bg: "from-indigo-500 to-purple-600", label: "Ethereum", symbol: "Ξ" },
  USDT: { color: "#26A17B", bg: "from-emerald-500 to-teal-600", label: "Tether", symbol: "₮" },
  USDC: { color: "#2775CA", bg: "from-blue-500 to-blue-700", label: "USD Coin", symbol: "$" },
};

function CryptoQRCode({ address, size = 220 }: { address: string; size?: number }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    if (!address) return;
    QRCode.toDataURL(address, {
      width: size,
      margin: 2,
      color: { dark: "#0A2540", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [address, size]);

  if (!qrDataUrl) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 rounded-lg animate-pulse"
        style={{ width: size, height: size }}
      >
        <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <img
      src={qrDataUrl}
      alt="Wallet QR Code"
      width={size}
      height={size}
      className="rounded-lg"
    />
  );
}

export default function CryptoPaymentTab(props: CryptoPaymentTabProps) {
  const { applicationId, processingFeeAmount } = props;

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("USDT");
  // --- Simple variant state ---
  const [addressCopied, setAddressCopied] = useState(false);
  const [amountCopied, setAmountCopied] = useState(false);
  const [processing, setProcessing] = useState(false);
  // Persistent so refresh / back-nav reuses the same crypto payment row.
  const idempotencyKeyRef = useRef(getPersistentIdempotencyKey(applicationId, "crypto"));

  // --- Enhanced variant state ---
  const [cryptoPaymentData, setCryptoPaymentData] = useState<{
    address: string;
    amount: string;
    currency: string;
  } | null>(null);
  const [txHash, setTxHash] = useState("");
  const [verifyingTx, setVerifyingTx] = useState(false);

  // Queries
  const { data: cryptoConversion } = trpc.payments.convertToCrypto.useQuery(
    { usdCents: processingFeeAmount, currency: selectedCurrency },
    { enabled: !!processingFeeAmount }
  );

  const { data: cryptoAddressData } = trpc.payments.getCryptoAddress.useQuery(
    { currency: selectedCurrency },
    { enabled: props.variant === "simple" }
  );

  // Derive address/amount for simple variant from query data
  const generatedAddress = (props.variant === "simple" && cryptoAddressData?.address) ? cryptoAddressData.address : "";

  const { data: supportedCryptos } = trpc.payments.getSupportedCryptos.useQuery(undefined, {
    enabled: props.variant === "enhanced",
  });

  // Mutations
  const createPaymentMutation = trpc.payments.createIntent.useMutation({
    onSuccess: (data) => {
      if (props.variant === "enhanced") {
        if (data.paymentId) props.setCurrentPaymentId(data.paymentId);
        if (data.cryptoAddress) {
          setCryptoPaymentData({
            address: data.cryptoAddress || "",
            amount: data.cryptoAmount || "",
            currency: selectedCurrency,
          });
          toast.success("Payment address generated");
        }
      } else {
        const d = data as Record<string, unknown>;
        if (d?.pending || d?.status === "pending") {
          toast.success("Payment address generated — send funds to complete payment.");
          setProcessing(false);
        }
      }
    },
    onError: (error) => {
      toast.error(error.message || "Payment failed - please try again");
      setProcessing(false);
    },
  });

  const verifyCryptoMutation = trpc.payments.verifyCryptoPayment.useMutation({
    onSuccess: (data) => {
      if (props.variant !== "enhanced") return;
      if (data.confirmed) {
        props.onAnimationStatus("success");
        setTimeout(() => {
          props.onVerificationUpdate({
            status: "confirmed",
            method: "crypto",
            confirmations: data.confirmations,
            txHash,
            message: `✅ Payment verified! ${data.confirmations} confirmations. Your loan is ready for disbursement.`,
          });
          toast.success(data.message);
        }, 1500);
      } else {
        props.onVerificationUpdate({
          status: "verifying",
          method: "crypto",
          confirmations: data.confirmations,
          txHash,
          message: `⏳ Transaction verified! Current confirmations: ${data.confirmations}. Awaiting more confirmations...`,
        });
        toast.info(data.message);
      }
      setVerifyingTx(false);
    },
    onError: (error) => {
      if (props.variant !== "enhanced") return;
      props.onAnimationStatus("failed");
      setTimeout(() => {
        props.onVerificationUpdate({
          status: "failed",
          method: "crypto",
          txHash,
          message: `❌ Verification failed: ${error.message}`,
        });
        toast.error(error.message || "Failed to verify payment");
      }, 1500);
      setVerifyingTx(false);
    },
  });

  const copyToClipboard = (text: string, kind: "address" | "amount" = "address") => {
    navigator.clipboard.writeText(text);
    if (kind === "address") {
      setAddressCopied(true);
      toast.success("Address copied to clipboard");
      setTimeout(() => setAddressCopied(false), 2000);
    } else {
      setAmountCopied(true);
      toast.success("Amount copied to clipboard");
      setTimeout(() => setAmountCopied(false), 2000);
    }
  };

  const handleSimplePayment = async () => {
    if (!applicationId) return;
    setProcessing(true);
    try {
      await createPaymentMutation.mutateAsync({
        loanApplicationId: applicationId,
        paymentMethod: "crypto",
        paymentProvider: "crypto",
        cryptoCurrency: selectedCurrency,
        idempotencyKey: idempotencyKeyRef.current,
      });
    } catch {
      setProcessing(false);
    }
  };

  const handleEnhancedInitiate = () => {
    if (!applicationId) return;
    createPaymentMutation.mutate({
      loanApplicationId: applicationId,
      paymentMethod: "crypto",
      paymentProvider: "crypto",
      cryptoCurrency: selectedCurrency,
      idempotencyKey: idempotencyKeyRef.current,
    });
  };

  const handleVerifyTransaction = () => {
    if (props.variant !== "enhanced") return;
    if (!txHash.trim()) { toast.error("Please enter a transaction hash"); return; }
    if (!props.currentPaymentId) { toast.error("No payment in progress. Please initiate a payment first."); return; }
    setVerifyingTx(true);
    verifyCryptoMutation.mutate({ paymentId: props.currentPaymentId, txHash });
  };

  // ─── Enhanced variant rendering ───
  if (props.variant === "enhanced") {
    const selectedMeta = supportedCryptos?.find((c) => c.currency === selectedCurrency);
    const calcAmount = selectedMeta
      ? (processingFeeAmount / 100 / selectedMeta.rate).toFixed(8)
      : "0";
    const meta = CURRENCY_META[selectedCurrency];

    return (
      <div className="space-y-5">
        {/* Currency Selector */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Select Cryptocurrency</label>
          <div className="grid grid-cols-4 gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCurrency(c)}
                className={`py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                  selectedCurrency === c
                    ? "border-[#0A2540] bg-[#0A2540] text-white shadow-md"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                }`}
              >
                <span className="block text-base leading-none mb-0.5">{CURRENCY_META[c].symbol}</span>
                {c}
              </button>
            ))}
          </div>
        </div>

        {cryptoPaymentData ? (
          <div className="space-y-4">
            {/* Header card */}
            <div className={`bg-gradient-to-r ${meta.bg} rounded-xl p-5 text-white shadow-lg`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Bitcoin className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-lg leading-none">{meta.label} Payment</p>
                    <p className="text-white/70 text-xs mt-0.5">Scan QR code or copy address</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-semibold">Address Ready</span>
                </div>
              </div>
              <div className="bg-white/15 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs">Amount to Send</p>
                  <p className="text-2xl font-bold tracking-tight">{cryptoPaymentData.amount}</p>
                  <p className="text-white/70 text-xs">{cryptoPaymentData.currency} ≈ ${(processingFeeAmount / 100).toFixed(2)} USD</p>
                </div>
                <button
                  onClick={() => copyToClipboard(cryptoPaymentData.amount, "amount")}
                  className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-2 transition-colors"
                >
                  {amountCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="text-xs font-medium">{amountCopied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Scan to Pay</p>
              <div className="bg-white rounded-2xl p-4 shadow-xl border-4" style={{ borderColor: meta.color }}>
                <CryptoQRCode address={cryptoPaymentData.address} size={240} />
              </div>
              <p className="text-xs text-gray-500">Open your wallet app and scan this QR code</p>
            </div>

            {/* Address */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-gray-500" />
                  Wallet Address
                </p>
                <button
                  onClick={() => copyToClipboard(cryptoPaymentData.address, "address")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#0A2540] bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors"
                >
                  {addressCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {addressCopied ? "Copied!" : "Copy Address"}
                </button>
              </div>
              <code className="block w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-mono break-all text-gray-700 leading-relaxed">
                {cryptoPaymentData.address}
              </code>
            </div>

            {/* Warning */}
            <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Important Instructions</p>
                <ul className="text-xs text-amber-800 mt-1.5 space-y-1">
                  <li>• Send the <strong>exact amount</strong> shown above — no more, no less</li>
                  <li>• Only send <strong>{cryptoPaymentData.currency}</strong> to this address</li>
                  <li>• Payment window expires in <strong>1 hour</strong></li>
                  <li>• Confirmations required: 1 for USDT/USDC, 3 for BTC/ETH</li>
                </ul>
              </div>
            </div>

            {/* Verify section */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#0A2540]" />
                <p className="text-sm font-semibold text-gray-800">Verify Your Transaction</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Transaction Hash / TX ID</label>
                <Input
                  placeholder="Paste your blockchain transaction hash here..."
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-gray-500">
                  Found in your wallet under transaction history after sending
                </p>
              </div>
              <Button
                className="w-full bg-[#0A2540] hover:bg-[#0d2f52] text-white"
                size="lg"
                onClick={handleVerifyTransaction}
                disabled={verifyingTx || verifyCryptoMutation.isPending || !txHash.trim()}
              >
                {verifyingTx || verifyCryptoMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying on Blockchain...</>
                ) : (
                  <><Zap className="mr-2 h-4 w-4" />Verify Transaction</>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Pre-initiation state */
          <div className="space-y-4">
            <div className={`bg-gradient-to-r ${meta.bg} rounded-xl p-5 text-white`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                  {meta.symbol}
                </div>
                <div>
                  <p className="font-bold text-lg">Pay with {meta.label}</p>
                  <p className="text-white/70 text-sm">Fast, secure, decentralized</p>
                </div>
              </div>
              <div className="bg-white/15 rounded-lg p-3">
                <p className="text-white/70 text-xs mb-1">Estimated Amount</p>
                <p className="text-xl font-bold">{calcAmount} {selectedCurrency}</p>
                <p className="text-white/60 text-xs">≈ ${(processingFeeAmount / 100).toFixed(2)} USD</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
              A unique wallet address and QR code will be generated for your payment.
              The address is valid for 1 hour.
            </div>

            <Button
              className={`w-full bg-gradient-to-r ${meta.bg} hover:opacity-90 text-white shadow-md`}
              size="lg"
              onClick={handleEnhancedInitiate}
              disabled={createPaymentMutation.isPending}
            >
              {createPaymentMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating Address & QR Code...</>
              ) : (
                <><Bitcoin className="mr-2 h-4 w-4" />Generate {selectedCurrency} Payment Address</>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ─── Simple variant rendering (PaymentPage / PayFee) ───
  const simpleMeta = CURRENCY_META[selectedCurrency];
  return (
    <div className="space-y-5">
      {/* Currency selector */}
      <div>
        <Label className="text-sm font-semibold text-gray-700">Select Cryptocurrency</Label>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCurrency(c)}
              className={`py-2 px-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                selectedCurrency === c
                  ? "border-[#0A2540] bg-[#0A2540] text-white shadow-md"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
              }`}
            >
              <span className="block text-base leading-none mb-0.5">{CURRENCY_META[c].symbol}</span>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Amount banner */}
      <div className={`bg-gradient-to-r ${simpleMeta.bg} rounded-xl p-4 text-white`}>
        <p className="text-white/70 text-xs mb-1">Amount to Send</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold">{cryptoConversion?.amount || "0"} {selectedCurrency}</p>
            <p className="text-white/70 text-sm">≈ ${(processingFeeAmount / 100).toFixed(2)} USD</p>
          </div>
          <button
            onClick={() => copyToClipboard(cryptoConversion?.amount || "0", "amount")}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
          >
            {amountCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {amountCopied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* QR Code */}
      {generatedAddress ? (
        <div className="flex flex-col items-center gap-3 py-1">
          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Scan to Pay</p>
          <div className="bg-white rounded-2xl p-4 shadow-xl border-4" style={{ borderColor: simpleMeta.color }}>
            <CryptoQRCode address={generatedAddress} size={240} />
          </div>
          <p className="text-xs text-gray-500">Open your crypto wallet and scan this QR code</p>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading wallet address...</p>
          </div>
        </div>
      )}

      {/* Address */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-gray-500" />
            Wallet Address
          </p>
          <button
            onClick={() => copyToClipboard(generatedAddress, "address")}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0A2540] bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors"
          >
            {addressCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {addressCopied ? "Copied!" : "Copy"}
          </button>
        </div>
        <code className="block w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-mono break-all text-gray-700 leading-relaxed">
          {generatedAddress || "Generating address..."}
        </code>
      </div>

      {/* Warning */}
      <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>Important:</strong> Only send <strong>{selectedCurrency}</strong> to this address.
          Sending other cryptocurrencies may result in <strong>permanent loss of funds</strong>.
        </p>
      </div>

      <Button
        size="lg"
        className={`w-full bg-gradient-to-r ${simpleMeta.bg} hover:opacity-90 text-white shadow-md`}
        onClick={handleSimplePayment}
        disabled={processing}
      >
        {processing ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Confirming Transaction...</>
        ) : (
          <><Bitcoin className="mr-2 h-4 w-4" />I've Sent the Payment</>
        )}
      </Button>
    </div>
  );
}
