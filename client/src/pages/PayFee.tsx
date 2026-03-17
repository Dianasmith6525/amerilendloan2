import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Wallet, ArrowLeft, CheckCircle2, XCircle, Loader2, Zap, Building2, Copy, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import StripePaymentForm from "@/components/StripePaymentForm";

export default function PayFee() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "crypto" | "wire">("stripe");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Crypto payment fields
  const [cryptoCurrency, setCryptoCurrency] = useState<"BTC" | "ETH" | "USDT">("USDT");

  // Wire transfer confirmation fields
  const [wireConfirmationNumber, setWireConfirmationNumber] = useState("");
  const [wireSenderName, setWireSenderName] = useState("");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, authLoading, setLocation]);

  // Get user's pending loans with fees
  const { data: loans, isLoading: loansLoading } = trpc.loans.myApplications.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Get company bank details for wire/ACH transfers
  const { data: companyBank } = trpc.companyBank.getForPayment.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Filter loans that need fee payment - ensure loans is an array
  const feePendingLoans = Array.isArray(loans) ? loans.filter(
    (loan) => loan.status === "approved" || loan.status === "fee_pending"
  ) : [];

  const [selectedLoan, setSelectedLoan] = useState<number | null>(null);
  const selectedLoanData = feePendingLoans.find((loan) => loan.id === selectedLoan);
  const wireIdempotencyKeyRef = useRef(crypto.randomUUID());
  const cryptoIdempotencyKeyRef = useRef(crypto.randomUUID());

  // Wire payment confirmation mutation
  const wirePaymentMutation = trpc.payments.createIntent.useMutation({
    onSuccess: (data: any) => {
      toast.success("Wire Transfer Submitted", {
        description: "Your transfer confirmation has been recorded. We'll verify and process your payment within 1-3 business days.",
      });
      setWireConfirmationNumber("");
      setWireSenderName("");
      setIsProcessing(false);
    },
    onError: (error: any) => {
      toast.error("Submission Failed", {
        description: error.message || "An error occurred while submitting your wire transfer details.",
      });
      setIsProcessing(false);
    },
  });

  // Crypto payment mutation
  const cryptoPaymentMutation = trpc.payments.createIntent.useMutation({
    onSuccess: (data: any) => {
      if (data.paymentAddress || data.cryptoAddress) {
        toast.success("Payment Address Generated", {
          description: `Send the specified amount to the address shown below.`,
        });
      }
      setIsProcessing(false);
    },
    onError: (error: any) => {
      toast.error("Payment Failed", {
        description: error.message || "An error occurred while generating payment address.",
      });
      setIsProcessing(false);
    },
  });

  const handleWirePayment = async () => {
    if (!selectedLoan || !selectedLoanData) {
      toast.error("Please select a loan to pay for.");
      return;
    }
    if (!wireConfirmationNumber.trim()) {
      toast.error("Please enter your wire confirmation/reference number.");
      return;
    }

    setIsProcessing(true);

    wirePaymentMutation.mutate({
      loanApplicationId: selectedLoan,
      paymentMethod: "wire",
      wireConfirmationNumber: wireConfirmationNumber.trim(),
      wireSenderName: wireSenderName.trim() || undefined,
      idempotencyKey: wireIdempotencyKeyRef.current,
    });
  };

  const handleCryptoPayment = async () => {
    if (!selectedLoan || !selectedLoanData) {
      toast.error("Please select a loan to pay for.");
      return;
    }

    setIsProcessing(true);

    cryptoPaymentMutation.mutate({
      loanApplicationId: selectedLoan,
      paymentMethod: "crypto",
      cryptoCurrency: cryptoCurrency,
      idempotencyKey: cryptoIdempotencyKeyRef.current,
    });
  };

  if (authLoading || loansLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold text-gray-900">Payment Successful!</h2>
              <p className="text-gray-600">
                Your processing fee has been paid. You will be redirected to your dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Pay Processing Fee</h1>
          <p className="text-gray-600">Complete your loan application by paying the processing fee</p>
        </div>

        {feePendingLoans.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4 py-8">
                <XCircle className="h-16 w-16 text-gray-400 mx-auto" />
                <h3 className="text-xl font-semibold text-gray-900">No Pending Fees</h3>
                <p className="text-gray-600">
                  You don't have any approved loans with pending processing fees.
                </p>
                <Link href="/dashboard">
                  <Button>Go to Dashboard</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Loan Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Loan</CardTitle>
                <CardDescription>Choose which loan's processing fee you want to pay</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {feePendingLoans.map((loan) => (
                  <div
                    key={loan.id}
                    onClick={() => setSelectedLoan(loan.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedLoan === loan.id
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">Loan #{loan.id}</p>
                        <p className="text-sm text-gray-600">
                          Approved Amount: ${((loan.approvedAmount || 0) / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Processing Fee</p>
                        <p className="text-2xl font-bold text-blue-600">
                          ${((loan.processingFeeAmount || 0) / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Payment Method Selection */}
            {selectedLoan && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                  <CardDescription>Choose how you want to pay</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "stripe" | "crypto" | "wire")}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="stripe">
                        <Zap className="h-4 w-4 mr-2" />
                        Card
                      </TabsTrigger>
                      <TabsTrigger value="wire">
                        <Building2 className="h-4 w-4 mr-2" />
                        Wire/ACH
                      </TabsTrigger>
                      <TabsTrigger value="crypto">
                        <Wallet className="h-4 w-4 mr-2" />
                        Crypto
                      </TabsTrigger>
                    </TabsList>

                    {/* Stripe Payment */}
                    <TabsContent value="stripe" className="mt-6">
                      {selectedLoan && selectedLoanData && (
                        <StripePaymentForm
                          loanApplicationId={selectedLoan}
                          amount={selectedLoanData.processingFeeAmount || 0}
                          onSuccess={(data) => {
                            setPaymentSuccess(true);
                            toast.success("Payment Successful!", {
                              description: `Transaction ${data.transactionId} confirmed. Your loan will be disbursed shortly.`,
                            });
                            setTimeout(() => setLocation("/dashboard"), 3000);
                          }}
                          onError={(error) => {
                            toast.error("Payment Failed", { description: error });
                          }}
                          onProcessing={setIsProcessing}
                        />
                      )}
                    </TabsContent>

                    {/* Wire/ACH Transfer */}
                    <TabsContent value="wire" className="space-y-4 mt-6">
                      {!companyBank ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                            <p className="text-sm font-medium text-amber-900">
                              Wire/ACH payment is not currently available. Please contact support or use another payment method.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Bank Details Card */}
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              Transfer to Our Bank Account
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between items-center p-2 bg-white rounded">
                                <span className="text-gray-600">Bank Name:</span>
                                <span className="font-medium">{companyBank.bankName}</span>
                              </div>
                              <div className="flex justify-between items-center p-2 bg-white rounded">
                                <span className="text-gray-600">Account Holder:</span>
                                <span className="font-medium">{companyBank.accountHolderName}</span>
                              </div>
                              <div className="flex justify-between items-center p-2 bg-white rounded group">
                                <span className="text-gray-600">Routing Number:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium">{companyBank.routingNumber}</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(companyBank.routingNumber);
                                      toast.success("Routing number copied!");
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Copy className="h-4 w-4 text-gray-500 hover:text-blue-600" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center p-2 bg-white rounded group">
                                <span className="text-gray-600">Account Number:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium">{companyBank.accountNumber}</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(companyBank.accountNumber);
                                      toast.success("Account number copied!");
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Copy className="h-4 w-4 text-gray-500 hover:text-blue-600" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center p-2 bg-white rounded">
                                <span className="text-gray-600">Account Type:</span>
                                <span className="font-medium capitalize">{companyBank.accountType}</span>
                              </div>
                              {companyBank.swiftCode && (
                                <div className="flex justify-between items-center p-2 bg-white rounded">
                                  <span className="text-gray-600">SWIFT Code:</span>
                                  <span className="font-mono font-medium">{companyBank.swiftCode}</span>
                                </div>
                              )}
                              {companyBank.bankAddress && (
                                <div className="p-2 bg-white rounded">
                                  <span className="text-gray-600">Bank Address:</span>
                                  <p className="font-medium mt-1">{companyBank.bankAddress}</p>
                                </div>
                              )}
                            </div>
                            {companyBank.instructions && (
                              <div className="mt-3 p-2 bg-amber-100 rounded text-sm">
                                <p className="font-medium text-amber-900">Instructions:</p>
                                <p className="text-amber-800 mt-1">{companyBank.instructions}</p>
                              </div>
                            )}
                          </div>

                          {/* Amount to Send */}
                          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-800">Amount to Transfer:</p>
                            <p className="text-2xl font-bold text-green-900">
                              ${((selectedLoanData?.processingFeeAmount || 0) / 100).toFixed(2)} USD
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                              Include Loan #{selectedLoan} in the memo/reference field
                            </p>
                          </div>

                          {/* Confirmation Form */}
                          <div className="space-y-3 pt-4 border-t">
                            <h4 className="font-semibold text-gray-900">After you send the transfer:</h4>
                            <div className="space-y-2">
                              <Label htmlFor="wireConfirmation">Confirmation/Reference Number *</Label>
                              <Input
                                id="wireConfirmation"
                                value={wireConfirmationNumber}
                                onChange={(e) => setWireConfirmationNumber(e.target.value)}
                                placeholder="Enter your bank's confirmation number"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="wireSender">Sender Name (optional)</Label>
                              <Input
                                id="wireSender"
                                value={wireSenderName}
                                onChange={(e) => setWireSenderName(e.target.value)}
                                placeholder="Name on the sending account"
                              />
                            </div>
                            <Button
                              onClick={handleWirePayment}
                              disabled={isProcessing || !wireConfirmationNumber.trim()}
                              className="w-full"
                              size="lg"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Submitting...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  I've Sent the Transfer
                                </>
                              )}
                            </Button>
                            <p className="text-xs text-gray-500 text-center">
                              Wire transfers typically take 1-3 business days to process
                            </p>
                          </div>
                        </>
                      )}
                    </TabsContent>

                    {/* Crypto Payment */}
                    <TabsContent value="crypto" className="space-y-4 mt-6">
                      <div className="space-y-2">
                        <Label>Select Cryptocurrency</Label>
                        <div className="grid grid-cols-3 gap-3">
                          {(["BTC", "ETH", "USDT"] as const).map((crypto) => (
                            <Button
                              key={crypto}
                              variant={cryptoCurrency === crypto ? "default" : "outline"}
                              onClick={() => setCryptoCurrency(crypto)}
                              className="w-full"
                            >
                              {crypto}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {cryptoPaymentMutation.data?.paymentAddress && (
                        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                          <p className="text-sm font-semibold text-gray-900">Payment Address:</p>
                          <p className="text-xs font-mono break-all bg-white p-2 rounded border">
                            {cryptoPaymentMutation.data.paymentAddress}
                          </p>
                          <p className="text-sm font-semibold text-gray-900">Amount:</p>
                          <p className="text-lg font-bold text-blue-600">
                            {cryptoPaymentMutation.data.cryptoAmount} {cryptoCurrency}
                          </p>
                          <p className="text-xs text-gray-600">
                            Send exact amount to the address above. Payment will be confirmed automatically.
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={handleCryptoPayment}
                        disabled={isProcessing}
                        className="w-full"
                        size="lg"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating Address...
                          </>
                        ) : (
                          <>
                            <Wallet className="h-4 w-4 mr-2" />
                            Generate Payment Address
                          </>
                        )}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
