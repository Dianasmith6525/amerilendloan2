import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { CreditCard, Wallet, ArrowLeft, CheckCircle2, XCircle, Loader2, DollarSign } from "lucide-react";
import { toast } from "sonner";

// Declare Accept.js types
declare global {
  interface Window {
    Accept?: {
      dispatchData: (secureData: any, callback: (response: any) => void) => void;
    };
  }
}

export default function PayFee() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<"card" | "crypto">("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Card payment fields
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardholderName, setCardholderName] = useState("");

  // Crypto payment fields
  const [cryptoCurrency, setCryptoCurrency] = useState<"BTC" | "ETH" | "USDT">("USDT");
  const [acceptJsLoaded, setAcceptJsLoaded] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, authLoading, setLocation]);

  // Get Authorize.Net config
  const { data: authorizeNetConfig } = trpc.payments.getAuthorizeNetConfig.useQuery();

  // Load Authorize.Net Accept.js script
  useEffect(() => {
    if (!authorizeNetConfig) return;
    
    const script = document.createElement('script');
    script.src = authorizeNetConfig.environment === 'production'
      ? 'https://js.authorize.net/v1/Accept.js'
      : 'https://jstest.authorize.net/v1/Accept.js';
    script.async = true;
    script.onload = () => setAcceptJsLoaded(true);
    document.body.appendChild(script);
    
    return () => {
      if (script && document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [authorizeNetConfig]);

  // Get user's pending loans with fees
  const { data: loans, isLoading: loansLoading } = trpc.loans.myApplications.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Filter loans that need fee payment - ensure loans is an array
  const feePendingLoans = Array.isArray(loans) ? loans.filter(
    (loan) => loan.status === "approved" || loan.status === "fee_pending"
  ) : [];

  const [selectedLoan, setSelectedLoan] = useState<number | null>(null);
  const selectedLoanData = feePendingLoans.find((loan) => loan.id === selectedLoan);

  // Card payment mutation
  const cardPaymentMutation = trpc.payments.createIntent.useMutation({
    onSuccess: () => {
      setPaymentSuccess(true);
      toast.success("Payment Successful!", {
        description: "Your processing fee has been paid. Your loan will be disbursed shortly.",
      });
      setTimeout(() => setLocation("/dashboard"), 3000);
    },
    onError: (error: any) => {
      toast.error("Payment Failed", {
        description: error.message || "An error occurred while processing your payment.",
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

  const handleCardPayment = async () => {
    if (!selectedLoan || !selectedLoanData) {
      toast.error("Please select a loan to pay for.");
      return;
    }

    if (!cardNumber || !expiryDate || !cvv || !cardholderName) {
      toast.error("Please fill in all card details.");
      return;
    }

    if (!window.Accept) {
      toast.error("Payment system not loaded. Please refresh the page.");
      return;
    }

    setIsProcessing(true);

    const [expiryMonth, expiryYear] = expiryDate.split("/");

    const secureData = {
      authData: {
        clientKey: authorizeNetConfig?.clientKey || "",
        apiLoginID: authorizeNetConfig?.apiLoginId || "",
      },
      cardData: {
        cardNumber: cardNumber.replace(/\s/g, ""),
        month: expiryMonth?.trim() || "",
        year: expiryYear?.trim() || "",
        cardCode: cvv,
      },
    };

    window.Accept.dispatchData(secureData, (response: any) => {
      if (response.messages.resultCode === "Error") {
        toast.error("Card Validation Failed", {
          description: response.messages.message[0].text,
        });
        setIsProcessing(false);
        return;
      }

      const opaqueData = response.opaqueData;

      cardPaymentMutation.mutate({
        loanApplicationId: selectedLoan,
        paymentMethod: "card",
        opaqueData: {
          dataDescriptor: opaqueData.dataDescriptor,
          dataValue: opaqueData.dataValue,
        },
      });
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
                  <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "card" | "crypto")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="card">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Credit/Debit Card
                      </TabsTrigger>
                      <TabsTrigger value="crypto">
                        <Wallet className="h-4 w-4 mr-2" />
                        Cryptocurrency
                      </TabsTrigger>
                    </TabsList>

                    {/* Card Payment */}
                    <TabsContent value="card" className="space-y-4 mt-6">
                      <div className="space-y-2">
                        <Label htmlFor="cardholderName">Cardholder Name</Label>
                        <Input
                          id="cardholderName"
                          placeholder="John Doe"
                          value={cardholderName}
                          onChange={(e) => setCardholderName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <Input
                          id="cardNumber"
                          placeholder="1234 5678 9012 3456"
                          maxLength={19}
                          value={cardNumber}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\s/g, "");
                            const formatted = value.match(/.{1,4}/g)?.join(" ") || value;
                            setCardNumber(formatted);
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="expiry">Expiry Date</Label>
                          <Input
                            id="expiry"
                            placeholder="MM/YY"
                            maxLength={5}
                            value={expiryDate}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, "");
                              if (value.length >= 2) {
                                value = value.slice(0, 2) + "/" + value.slice(2, 4);
                              }
                              setExpiryDate(value);
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cvv">CVV</Label>
                          <Input
                            id="cvv"
                            placeholder="123"
                            maxLength={4}
                            type="password"
                            value={cvv}
                            onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))}
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleCardPayment}
                        disabled={isProcessing}
                        className="w-full"
                        size="lg"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-4 w-4 mr-2" />
                            Pay ${((selectedLoanData?.processingFeeAmount || 0) / 100).toFixed(2)}
                          </>
                        )}
                      </Button>
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
