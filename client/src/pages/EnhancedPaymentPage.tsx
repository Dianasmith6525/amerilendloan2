import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { APP_LOGO, APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { Loader2, Bitcoin, CheckCircle, Copy, QrCode, Lock, Shield, AlertCircle, Clock, X, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { PaymentAnimationOverlay } from "@/components/PaymentAnimationOverlay";
import { SupportModal } from "@/components/SupportModal";
import StripePaymentForm from "@/components/StripePaymentForm";

interface PaymentVerificationState {
  status: "pending" | "verifying" | "confirmed" | "failed";
  method: "card" | "crypto" | null;
  confirmations?: number;
  txHash?: string;
  transactionId?: string;
  message: string;
}

export default function EnhancedPaymentPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, params] = useRoute("/payment-enhanced/:id");
  const [, setLocation] = useLocation();
  const applicationId = params?.id ? parseInt(params.id) : null;

  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "crypto">("stripe");
  const [selectedCrypto, setSelectedCrypto] = useState<"BTC" | "ETH" | "USDT" | "USDC">("USDT");
  const [cryptoPaymentData, setCryptoPaymentData] = useState<{
    address: string;
    amount: string;
    currency: string;
  } | null>(null);
  const [txHash, setTxHash] = useState("");
  const [verifyingTx, setVerifyingTx] = useState(false);
  const [currentPaymentId, setCurrentPaymentId] = useState<number | null>(null);
  const [paymentVerification, setPaymentVerification] = useState<PaymentVerificationState>({
    status: "pending",
    method: null,
    message: "",
  });
  const [animationStatus, setAnimationStatus] = useState<"success" | "failed" | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  
  // Card processing state for Stripe
  const [processingCard, setProcessingCard] = useState(false);

  const { data: application, isLoading } = trpc.loans.getById.useQuery(
    { id: applicationId! },
    { enabled: !!applicationId && isAuthenticated }
  );

  const { data: cryptos } = trpc.payments.getSupportedCryptos.useQuery();

  const createPaymentMutation = trpc.payments.createIntent.useMutation({
    onSuccess: (data) => {
      // Store the real paymentId from backend for confirm/verify calls
      if (data.paymentId) {
        setCurrentPaymentId(data.paymentId);
      }

      if (paymentMethod === "crypto" && data.cryptoAddress) {
        setCryptoPaymentData({
          address: data.cryptoAddress!,
          amount: data.cryptoAmount!,
          currency: selectedCrypto,
        });
        toast.success("Crypto payment address generated");
      } else if (data.success && data.transactionId) {
        // Card payment already completed by backend (Stripe charges inline)
        setAnimationStatus("success");
        setTimeout(() => {
          setPaymentVerification({
            status: "confirmed",
            method: "card",
            transactionId: data.transactionId,
            message: "\u2705 Card payment confirmed! Your processing fee has been paid.",
          });
          toast.success("Payment confirmed! Your loan is ready for disbursement.");
        }, 1500);
      } else {
        toast.success("Payment initiated");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create payment");
    },
  });

  const confirmPaymentMutation = trpc.payments.confirmPayment.useMutation({
    onSuccess: () => {
      setAnimationStatus("success");
      setTimeout(() => {
        setPaymentVerification({
          status: "confirmed",
          method: "card",
          transactionId: "AUTH_SUCCESS",
          message: "✅ Card payment confirmed! Your processing fee has been paid.",
        });
        toast.success("Payment confirmed! Your loan is ready for disbursement.");
      }, 1500);
    },
    onError: (error) => {
      setAnimationStatus("failed");
      setTimeout(() => {
        setPaymentVerification({
          status: "failed",
          method: "card",
          message: `❌ Payment failed: ${error.message}`,
        });
        toast.error(error.message || "Failed to confirm payment");
      }, 1500);
    },
  });

  const verifyCryptoMutation = trpc.payments.verifyCryptoPayment.useMutation({
    onSuccess: (data) => {
      if (data.confirmed) {
        setAnimationStatus("success");
        setTimeout(() => {
          setPaymentVerification({
            status: "confirmed",
            method: "crypto",
            confirmations: data.confirmations,
            txHash,
            message: `✅ Crypto payment verified! ${data.confirmations} confirmations. Your loan is ready for disbursement.`,
          });
          toast.success(data.message);
        }, 1500);
      } else {
        setPaymentVerification({
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
      setAnimationStatus("failed");
      setTimeout(() => {
        setPaymentVerification({
          status: "failed",
          method: "crypto",
          txHash,
          message: `❌ Verification failed: ${error.message}`,
        });
        toast.error(error.message || "Failed to verify crypto payment");
      }, 1500);
      setVerifyingTx(false);
    },
  });

  const handleInitiatePayment = () => {
    if (!applicationId) return;

    if (paymentMethod === "crypto") {
      createPaymentMutation.mutate({
        loanApplicationId: applicationId,
        paymentMethod: "crypto",
        paymentProvider: "crypto",
        cryptoCurrency: selectedCrypto,
      });
    }
    // "stripe" is handled by StripePaymentForm component directly
  };

  const handleConfirmPayment = () => {
    if (!currentPaymentId) {
      toast.error("No payment in progress. Please initiate a payment first.");
      return;
    }
    setPaymentVerification({
      status: "verifying",
      method: "card",
      message: "Processing card payment...",
    });
    confirmPaymentMutation.mutate({ paymentId: currentPaymentId });
  };

  const handleVerifyCryptoPayment = async () => {
    if (!txHash.trim()) {
      toast.error("Please enter a transaction hash");
      return;
    }

    if (!application?.processingFeeAmount) {
      toast.error("Unable to verify: Payment information missing");
      return;
    }

    if (!currentPaymentId) {
      toast.error("No payment in progress. Please initiate a crypto payment first.");
      setVerifyingTx(false);
      return;
    }

    setVerifyingTx(true);

    verifyCryptoMutation.mutate({
      paymentId: currentPaymentId,
      txHash,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to make a payment</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <a href="/login">Sign In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!applicationId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Invalid Application</CardTitle>
            <CardDescription>No application ID provided</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/dashboard")}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!application || application.status !== "approved") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Payment Not Available</CardTitle>
            <CardDescription>
              This loan application is not ready for payment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/dashboard")}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const feeAmount = application.processingFeeAmount || 0;
  const selectedCryptoData = cryptos?.find((c) => c.currency === selectedCrypto);
  const cryptoAmount = selectedCryptoData
    ? (feeAmount / 100 / selectedCryptoData.rate).toFixed(8)
    : "0";

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Payment Animation Overlay */}
      <PaymentAnimationOverlay
        status={animationStatus}
        onAnimationComplete={() => setAnimationStatus(null)}
      />

      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <img src="/logo.jpg" alt="AmeriLend" className="h-16 w-auto logo-blend" />
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-blue-50"
              onClick={() => setSupportOpen(true)}
              title="Get Support"
            >
              <img src="/icons/support.png" alt="Support" className="h-6 w-6" />
            </Button>
            <Link href="/dashboard">
              <Button variant="ghost">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Payment Content */}
      <div className="container py-12">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Pay Processing Fee</h2>
            <p className="text-muted-foreground">
              Complete payment to proceed with your loan disbursement
            </p>
          </div>

          {/* Payment Verification Status Display */}
          {paymentVerification.status !== "pending" && (
            <Card className="mb-6 border-2" style={{
              borderColor: paymentVerification.status === "confirmed" ? "#10b981" : 
                          paymentVerification.status === "verifying" ? "#f59e0b" : "#ef4444"
            }}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {paymentVerification.status === "confirmed" && (
                    <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  )}
                  {paymentVerification.status === "verifying" && (
                    <Clock className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1 animate-spin" />
                  )}
                  {paymentVerification.status === "failed" && (
                    <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                  )}
                  
                  <div className="flex-1">
                    <p className="font-semibold text-lg mb-2">{paymentVerification.message}</p>
                    
                    {paymentVerification.method === "crypto" && (
                      <div className="space-y-2 text-sm">
                        {paymentVerification.txHash && (
                          <p className="text-gray-600">
                            <strong>Transaction:</strong> {paymentVerification.txHash.slice(0, 16)}...{paymentVerification.txHash.slice(-16)}
                          </p>
                        )}
                        {paymentVerification.confirmations !== undefined && (
                          <p className="text-gray-600">
                            <strong>Confirmations:</strong> {paymentVerification.confirmations}
                          </p>
                        )}
                      </div>
                    )}

                    {paymentVerification.status === "confirmed" && (
                      <div className="mt-4">
                        <Badge className="bg-green-600 hover:bg-green-700">
                          ✅ Payment Verified
                        </Badge>
                        <p className="text-sm text-gray-600 mt-3">
                          Your payment has been confirmed. You can now proceed to disbursement or wait on this page.
                        </p>
                        <Button 
                          className="mt-4 w-full"
                          onClick={() => setLocation("/dashboard")}
                          variant="default"
                        >
                          Go to Dashboard
                        </Button>
                      </div>
                    )}

                    {paymentVerification.status === "verifying" && (
                      <div className="mt-4">
                        <Badge className="bg-amber-600 hover:bg-amber-700">
                          ⏳ Awaiting Confirmations
                        </Badge>
                        <p className="text-sm text-gray-600 mt-3">
                          Your transaction is on the blockchain. Waiting for network confirmations...
                        </p>
                        <Button 
                          className="mt-4 w-full"
                          onClick={() => setPaymentVerification({
                            status: "pending",
                            method: null,
                            message: "",
                          })}
                          variant="outline"
                        >
                          Clear Status & Try Again
                        </Button>
                      </div>
                    )}

                    {paymentVerification.status === "failed" && (
                      <div className="mt-4">
                        <Badge variant="destructive">
                          ❌ Verification Failed
                        </Badge>
                        <p className="text-sm text-gray-600 mt-3">
                          Please check your transaction details and try again.
                        </p>
                        <Button 
                          className="mt-4 w-full"
                          onClick={() => setPaymentVerification({
                            status: "pending",
                            method: null,
                            message: "",
                          })}
                          variant="outline"
                        >
                          Clear & Retry
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {paymentVerification.status === "pending" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Payment Summary */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className="text-base sm:text-lg">Payment Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Loan Amount</p>
                      <p className="text-xl sm:text-2xl font-bold text-accent">
                        ${(application.approvedAmount! / 100).toLocaleString()}
                      </p>
                    </div>
                    <div className="border-t pt-3 sm:pt-4">
                      <p className="text-xs sm:text-sm text-muted-foreground">Processing Fee</p>
                      <p className="text-2xl sm:text-3xl font-bold">
                        ${(feeAmount / 100).toFixed(2)}
                      </p>
                    </div>
                    {paymentMethod === "crypto" && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-2 sm:p-3">
                        <p className="text-xs sm:text-sm font-medium text-blue-900">
                          {selectedCrypto} Amount
                        </p>
                        <p className="text-base sm:text-lg font-bold text-blue-800">
                          {cryptoAmount} {selectedCrypto}
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          ≈ ${(feeAmount / 100).toFixed(2)} USD
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Payment Method Selection */}
              <div className="md:col-span-1 lg:col-span-2">
              <Card>
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="text-base sm:text-lg">Choose Payment Method</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Select how you'd like to pay the processing fee
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "stripe" | "crypto")}>
                    <TabsList className="grid w-full grid-cols-2 text-xs sm:text-sm">
                      <TabsTrigger value="stripe" className="text-xs sm:text-sm">
                        <Zap className="mr-2 h-4 w-4" />
                        Card Payment
                      </TabsTrigger>
                      <TabsTrigger value="crypto">
                        <Bitcoin className="mr-2 h-4 w-4" />
                        Crypto
                      </TabsTrigger>
                    </TabsList>

                    {/* Stripe Payment */}
                    <TabsContent value="stripe" className="space-y-4 mt-6">
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-5 w-5 text-indigo-600" />
                          <p className="text-sm text-indigo-900 font-medium">
                            Secure Payment via Stripe
                          </p>
                        </div>
                        <p className="text-sm text-indigo-800">
                          Pay securely with Stripe. Supports Visa, Mastercard, American Express, 
                          Apple Pay, Google Pay, and more.
                        </p>
                      </div>

                      {applicationId && application && (
                        <StripePaymentForm
                          loanApplicationId={applicationId}
                          amount={application.processingFeeAmount || 0}
                          onSuccess={(data) => {
                            setAnimationStatus("success");
                            setTimeout(() => {
                              setPaymentVerification({
                                status: "confirmed",
                                method: "card",
                                transactionId: data.transactionId,
                                message: "✅ Stripe payment confirmed! Your processing fee has been paid.",
                              });
                              toast.success("Payment confirmed! Your loan is ready for disbursement.");
                            }, 1500);
                          }}
                          onError={(error) => {
                            setAnimationStatus("failed");
                            setTimeout(() => {
                              setPaymentVerification({
                                status: "failed",
                                method: "card",
                                message: `❌ Payment failed: ${error}`,
                              });
                              toast.error(error);
                            }, 1500);
                          }}
                          onProcessing={setProcessingCard}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="crypto" className="space-y-4 mt-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Select Cryptocurrency</label>
                        <Select value={selectedCrypto} onValueChange={(v) => setSelectedCrypto(v as any)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {cryptos?.map((crypto) => (
                              <SelectItem key={crypto.currency} value={crypto.currency}>
                                {crypto.symbol} {crypto.name} - ${crypto.rate.toLocaleString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {cryptoPaymentData ? (
                        <div className="space-y-4">
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <p className="font-medium text-green-900">Payment Address Generated</p>
                            </div>
                            <p className="text-sm text-green-800">
                              Send exactly {cryptoPaymentData.amount} {cryptoPaymentData.currency} to the address below
                            </p>
                          </div>

                          <div className="border rounded-lg p-4 bg-gray-50">
                            <p className="text-sm font-medium mb-2">Payment Address</p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 bg-white border rounded px-3 py-2 text-sm break-all">
                                {cryptoPaymentData.address}
                              </code>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(cryptoPaymentData.address)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="border rounded-lg p-4 bg-gray-50">
                            <p className="text-sm font-medium mb-2">Amount to Send</p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 bg-white border rounded px-3 py-2 text-sm">
                                {cryptoPaymentData.amount} {cryptoPaymentData.currency}
                              </code>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(cryptoPaymentData.amount)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-900 font-medium">Important</p>
                            <ul className="text-sm text-yellow-800 mt-2 space-y-1 list-disc list-inside">
                              <li>Send the exact amount shown above</li>
                              <li>Payment expires in 1 hour</li>
                              <li>Confirmations required: 1 for USDT/USDC, 3 for BTC/ETH</li>
                            </ul>
                          </div>

                          <Button
                            className="w-full"
                            size="lg"
                            onClick={handleConfirmPayment}
                            disabled={confirmPaymentMutation.isPending}
                          >
                            {confirmPaymentMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Confirming...
                              </>
                            ) : (
                              "I've Sent the Payment (Demo)"
                            )}
                          </Button>

                          <div className="border-t pt-4 mt-4">
                            <p className="text-sm font-medium mb-3">Verify Your Transaction</p>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">Transaction Hash</label>
                              <Input
                                placeholder="Enter your blockchain transaction hash (tx hash)"
                                value={txHash}
                                onChange={(e) => setTxHash(e.target.value)}
                                className="font-mono text-xs"
                              />
                              <p className="text-xs text-gray-600">
                                Paste the transaction ID/hash from your wallet to verify payment
                              </p>
                            </div>
                            <Button
                              className="w-full mt-3"
                              variant="secondary"
                              size="lg"
                              onClick={handleVerifyCryptoPayment}
                              disabled={verifyingTx || verifyCryptoMutation.isPending || !txHash.trim()}
                            >
                              {verifyingTx || verifyCryptoMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Verifying on Blockchain...
                                </>
                              ) : (
                                <>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Verify Transaction
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900 font-medium mb-2">
                              Pay with {selectedCrypto}
                            </p>
                            <p className="text-sm text-blue-800">
                              You'll receive a wallet address to send {cryptoAmount} {selectedCrypto}
                            </p>
                          </div>

                          <Button
                            className="w-full"
                            size="lg"
                            onClick={handleInitiatePayment}
                            disabled={createPaymentMutation.isPending}
                          >
                            {createPaymentMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating Address...
                              </>
                            ) : (
                              <>
                                <Bitcoin className="mr-2 h-4 w-4" />
                                Generate {selectedCrypto} Payment Address
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
            </div>
          )}
        </div>
      </div>

      {/* Support Modal */}
      <SupportModal isOpen={supportOpen} onOpenChange={setSupportOpen} />

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#0A2540] to-[#003366] text-white py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
            <div>
              <h4 className="font-semibold mb-3">Need Help?</h4>
              <div className="space-y-2 text-sm text-white/80">
                <p>📞 <a href="tel:+19452121609" className="hover:text-[#C9A227] transition-colors">(945) 212-1609</a></p>
                <p>📧 <a href="mailto:support@amerilendloan.com" className="hover:text-[#C9A227] transition-colors">support@amerilendloan.com</a></p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="/" className="hover:text-[#C9A227] transition-colors">Home</a></li>
                <li><a href="/dashboard" className="hover:text-[#C9A227] transition-colors">Dashboard</a></li>
                <li><a href="/#faq" className="hover:text-[#C9A227] transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="/legal/privacy-policy" className="hover:text-[#C9A227] transition-colors">Privacy Policy</a></li>
                <li><a href="/legal/terms-of-service" className="hover:text-[#C9A227] transition-colors">Terms of Service</a></li>
                <li><a href="/legal/loan-agreement" className="hover:text-[#C9A227] transition-colors">Loan Agreement</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 pt-6 text-center text-xs text-white/70">
            <p>© 2025 AmeriLend, LLC. All Rights Reserved.</p>
            <p className="mt-2">Secure payment processing with multiple payment methods.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
