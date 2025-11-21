import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_LOGO, APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, CreditCard, Bitcoin, Wallet, Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";

// Declare Accept.js types
declare global {
  interface Window {
    Accept?: {
      dispatchData: (secureData: any, callback: (response: any) => void) => void;
    };
  }
}

export default function PaymentPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/payment/:id");
  const applicationId = params?.id ? parseInt(params.id) : null;
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "crypto">("card");
  const [processing, setProcessing] = useState(false);
  
  // Card payment fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  
  // Crypto payment fields
  const [selectedCrypto, setSelectedCrypto] = useState<"BTC" | "ETH" | "USDT" | "USDC">("USDT");
  const [cryptoAddress, setCryptoAddress] = useState("");
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [addressCopied, setAddressCopied] = useState(false);

  const { data: application, isLoading } = trpc.loans.getById.useQuery(
    { id: applicationId! },
    { enabled: !!applicationId && isAuthenticated }
  );

  const { data: feeConfig } = trpc.feeConfig.getActive.useQuery();
  
  const { data: authorizeNetConfig } = trpc.payments.getAuthorizeNetConfig.useQuery();
  
  const { data: cryptoConversion } = trpc.payments.convertToCrypto.useQuery(
    { usdCents: application?.processingFeeAmount || 0, currency: selectedCrypto },
    { enabled: !!application?.processingFeeAmount && paymentMethod === "crypto" }
  );

  const createPaymentMutation = trpc.payments.createIntent.useMutation({
    onSuccess: (data) => {
      setPaymentComplete(true);
      toast.success("Payment successful!");
    },
    onError: (error) => {
      toast.error(error.message || "Payment failed - please try again");
      setProcessing(false);
    },
  });

  // Load Authorize.Net Accept.js script
  useEffect(() => {
    if (paymentMethod === "card" && authorizeNetConfig && !window.Accept) {
      const script = document.createElement("script");
      script.src = authorizeNetConfig.environment === "production"
        ? "https://js.authorize.net/v1/Accept.js"
        : "https://jstest.authorize.net/v1/Accept.js";
      script.async = true;
      document.body.appendChild(script);
      
      return () => {
        document.body.removeChild(script);
      };
    }
  }, [paymentMethod, authorizeNetConfig]);

  // Generate crypto payment address when switching to crypto
  useEffect(() => {
    if (paymentMethod === "crypto" && application?.processingFeeAmount) {
      // Generate deterministic address based on application ID
      const mockAddress = generateCryptoAddress(selectedCrypto, applicationId!);
      setCryptoAddress(mockAddress);
      setCryptoAmount(cryptoConversion?.amount || "0");
    }
  }, [paymentMethod, selectedCrypto, application, applicationId, cryptoConversion]);

  const handleCardPayment = async () => {
    if (!applicationId || !authorizeNetConfig) return;
    
    // Validate card fields
    if (!cardNumber || !cardExpiry || !cardCvc || !cardName) {
      toast.error("Please fill in all card details");
      return;
    }
    
    setProcessing(true);
    
    try {
      // Tokenize card data with Accept.js
      const secureData = {
        cardData: {
          cardNumber: cardNumber.replace(/\s/g, ""),
          month: cardExpiry.split("/")[0],
          year: "20" + cardExpiry.split("/")[1],
          cardCode: cardCvc,
        },
        authData: {
          clientKey: authorizeNetConfig.clientKey,
          apiLoginID: authorizeNetConfig.apiLoginId,
        },
      };

      // @ts-ignore - Accept.js is loaded dynamically
      window.Accept.dispatchData(secureData, async (response: any) => {
        if (response.messages.resultCode === "Error") {
          toast.error(response.messages.message[0].text);
          setProcessing(false);
          return;
        }

        // Send opaque data to server
        await createPaymentMutation.mutateAsync({
          loanApplicationId: applicationId,
          paymentMethod: "card",
          paymentProvider: "authorizenet",
          opaqueData: {
            dataDescriptor: response.opaqueData.dataDescriptor,
            dataValue: response.opaqueData.dataValue,
          },
        });
      });
    } catch (error) {
      console.error("Card payment error:", error);
      toast.error("Payment processing failed");
      setProcessing(false);
    }
  };

  const handleCryptoPayment = async () => {
    if (!applicationId) return;
    
    setProcessing(true);
    
    try {
      await createPaymentMutation.mutateAsync({
        loanApplicationId: applicationId,
        paymentMethod: "crypto",
        paymentProvider: "crypto",
        cryptoCurrency: selectedCrypto,
      });
    } catch (error) {
      console.error("Crypto payment error:", error);
      setProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setAddressCopied(true);
    toast.success("Address copied to clipboard");
    setTimeout(() => setAddressCopied(false), 2000);
  };

  function generateCryptoAddress(currency: string, appId: number): string {
    const prefixes: Record<string, string> = {
      BTC: "bc1q",
      ETH: "0x",
      USDT: "0x",
      USDC: "0x",
    };
    const length = currency === "BTC" ? 42 : 40;
    const chars = "0123456789abcdef";
    let address = prefixes[currency] || "0x";
    const seed = appId.toString();
    for (let i = 0; i < length - address.length; i++) {
      const index = (parseInt(seed + i) % chars.length);
      address += chars[index];
    }
    return address;
  }

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
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>Please sign in to continue</CardDescription>
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

  if (!application) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Application Not Found</CardTitle>
            <CardDescription>The requested application could not be found</CardDescription>
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

  if (application.status !== "approved" && application.status !== "fee_pending") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Payment Not Available</CardTitle>
            <CardDescription>
              This application is not ready for payment (Status: {application.status})
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

  if (paymentComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <header className="border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between h-32">
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer">
                <img src="/logo.jpg" alt="AmeriLend" className="h-32 w-auto" style={{ mixBlendMode: 'multiply' }} />
              </div>
            </Link>
          </div>
        </header>

        <div className="container py-12">
          <div className="max-w-2xl mx-auto">
            <Card className="border-2 border-accent">
              <CardContent className="pt-12 pb-12 text-center">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-10 w-10 text-accent" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Payment Confirmed!</h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Your processing fee has been successfully paid. Your loan is now being processed for disbursement.
                </p>
                <div className="bg-muted/50 rounded-lg p-6 mb-8">
                  <div className="grid md:grid-cols-2 gap-4 text-left">
                    <div>
                      <p className="text-sm text-muted-foreground">Loan Amount</p>
                      <p className="text-xl font-semibold">
                        ${((application.approvedAmount || 0) / 100).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Processing Fee Paid</p>
                      <p className="text-xl font-semibold">
                        ${((application.processingFeeAmount || 0) / 100).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  You will receive a notification once the funds have been disbursed to your account.
                </p>
                <Button size="lg" onClick={() => setLocation("/dashboard")}>
                  Return to Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between h-32">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <img src="/logo.jpg" alt="AmeriLend" className="h-32 w-auto" style={{ mixBlendMode: 'multiply' }} />
            </div>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost">Dashboard</Button>
          </Link>
        </div>
      </header>

      {/* Payment Content */}
      <div className="container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Processing Fee Payment</h2>
            <p className="text-muted-foreground">
              Complete your payment to proceed with loan disbursement
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Loan Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">Loan Type</span>
                <span className="font-semibold">
                  {application.loanType === "installment" ? "Installment Loan" : "Short-Term Loan"}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">Approved Amount</span>
                <span className="font-semibold text-lg">
                  ${((application.approvedAmount || 0) / 100).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">Processing Fee</span>
                <span className="font-semibold text-lg text-primary">
                  ${((application.processingFeeAmount || 0) / 100).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Fee Calculation Details */}
              {feeConfig && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-blue-900 mb-2">Fee Calculation:</p>
                  <div className="text-xs text-blue-800 space-y-1">
                    {feeConfig.calculationMode === "percentage" ? (
                      <>
                        <p>Loan Amount: ${((application.approvedAmount || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p>Fee Rate: {(feeConfig.percentageRate / 100).toFixed(2)}%</p>
                        <p className="font-semibold text-blue-900">Fee Amount: ${((application.processingFeeAmount || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </>
                    ) : (
                      <>
                        <p>Fixed Fee Amount: ${((feeConfig.fixedFeeAmount || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Important:</strong> This processing fee must be paid before your loan can be disbursed. 
                  The fee covers administrative costs and loan processing.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Payment Method
              </CardTitle>
              <CardDescription>
                Choose your preferred payment method
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "card" | "crypto")}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="card">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Credit/Debit Card
                  </TabsTrigger>
                  <TabsTrigger value="crypto">
                    <Bitcoin className="mr-2 h-4 w-4" />
                    Cryptocurrency
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="card" className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-900">
                      <strong>Secure Payment:</strong> Your card information is encrypted and processed securely through Authorize.Net.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="cardName">Cardholder Name</Label>
                      <Input
                        id="cardName"
                        placeholder="John Doe"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <Input
                        id="cardNumber"
                        placeholder="1234 5678 9012 3456"
                        value={cardNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\s/g, "");
                          const formatted = value.match(/.{1,4}/g)?.join(" ") || value;
                          setCardNumber(formatted);
                        }}
                        maxLength={19}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="cardExpiry">Expiry Date</Label>
                        <Input
                          id="cardExpiry"
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            if (value.length <= 2) {
                              setCardExpiry(value);
                            } else {
                              setCardExpiry(value.slice(0, 2) + "/" + value.slice(2, 4));
                            }
                          }}
                          maxLength={5}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cardCvc">CVC</Label>
                        <Input
                          id="cardCvc"
                          placeholder="123"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ""))}
                          maxLength={4}
                          type="password"
                        />
                      </div>
                    </div>

                    <Button
                      size="lg"
                      className="w-full"
                      onClick={handleCardPayment}
                      disabled={processing}
                    >
                      {processing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing Payment...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Pay ${((application.processingFeeAmount || 0) / 100).toFixed(2)}
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="crypto" className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-900">
                      <strong>Crypto Payment:</strong> Send the exact amount to the address below. Payment is confirmed automatically.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Select Cryptocurrency</Label>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {(["BTC", "ETH", "USDT", "USDC"] as const).map((crypto) => (
                          <Button
                            key={crypto}
                            variant={selectedCrypto === crypto ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedCrypto(crypto)}
                          >
                            {crypto}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-100 rounded-lg p-4 space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Amount to Send</Label>
                        <p className="text-2xl font-bold">
                          {cryptoConversion?.amount || "0"} {selectedCrypto}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ≈ ${((application.processingFeeAmount || 0) / 100).toFixed(2)} USD
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Payment Address</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={cryptoAddress}
                            readOnly
                            className="font-mono text-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(cryptoAddress)}
                          >
                            {addressCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs text-yellow-900">
                        <strong>Important:</strong> Send only {selectedCrypto} to this address. 
                        Sending other cryptocurrencies may result in permanent loss of funds.
                      </p>
                    </div>

                    <Button
                      size="lg"
                      className="w-full"
                      onClick={handleCryptoPayment}
                      disabled={processing}
                    >
                      {processing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Confirming Transaction...
                        </>
                      ) : (
                        <>
                          <Bitcoin className="mr-2 h-4 w-4" />
                          I've Sent the Payment
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-6 text-center">
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/dashboard")}
                >
                  Cancel Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#0033A0] to-[#003366] text-white py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
            <div>
              <h4 className="font-semibold mb-3">Need Help?</h4>
              <div className="space-y-2 text-sm text-white/80">
                <p>📞 <a href="tel:+19452121609" className="hover:text-[#FFA500] transition-colors">(945) 212-1609</a></p>
                <p>📧 <a href="mailto:support@amerilendloan.com" className="hover:text-[#FFA500] transition-colors">support@amerilendloan.com</a></p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="/" className="hover:text-[#FFA500] transition-colors">Home</a></li>
                <li><a href="/dashboard" className="hover:text-[#FFA500] transition-colors">Dashboard</a></li>
                <li><a href="/#faq" className="hover:text-[#FFA500] transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="/public/legal/privacy-policy" className="hover:text-[#FFA500] transition-colors">Privacy Policy</a></li>
                <li><a href="/public/legal/terms-of-service" className="hover:text-[#FFA500] transition-colors">Terms of Service</a></li>
                <li><a href="/public/legal/loan-agreement" className="hover:text-[#FFA500] transition-colors">Loan Agreement</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 pt-6 text-center text-xs text-white/70">
            <p>© 2025 AmeriLend, LLC. All Rights Reserved.</p>
            <p className="mt-2">Secure payment processing with end-to-end encryption.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
