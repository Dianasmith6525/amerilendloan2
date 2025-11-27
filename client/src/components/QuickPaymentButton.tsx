import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Bitcoin, Loader2, Copy, Check, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

// Declare Accept.js types
declare global {
  interface Window {
    Accept?: {
      dispatchData: (secureData: any, callback: (response: any) => void) => void;
    };
  }
}

interface QuickPaymentButtonProps {
  applicationId: number;
  processingFeeAmount: number;
  onPaymentComplete?: () => void;
}

export function QuickPaymentButton({ 
  applicationId, 
  processingFeeAmount,
  onPaymentComplete 
}: QuickPaymentButtonProps) {
  const [open, setOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "crypto">("card");
  const [processing, setProcessing] = useState(false);
  
  // Card payment fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  
  // Crypto payment fields
  const [selectedCrypto, setSelectedCrypto] = useState<"BTC" | "ETH" | "USDT" | "USDC">("USDT");
  const [addressCopied, setAddressCopied] = useState(false);

  const utils = trpc.useUtils();

  const { data: authorizeNetConfig } = trpc.payments.getAuthorizeNetConfig.useQuery();
  
  const { data: cryptoConversion } = trpc.payments.convertToCrypto.useQuery(
    { usdCents: processingFeeAmount, currency: selectedCrypto },
    { enabled: paymentMethod === "crypto" }
  );

  const { data: cryptoAddressData } = trpc.payments.getCryptoAddress.useQuery(
    { currency: selectedCrypto },
    { enabled: paymentMethod === "crypto" }
  );

  const createPaymentMutation = trpc.payments.createIntent.useMutation({
    onSuccess: async () => {
      toast.success("Payment successful! Processing fee paid.");
      setProcessing(false);
      setOpen(false);
      
      // Invalidate queries to refresh data
      await utils.loans.myLoans.invalidate();
      await utils.loans.getById.invalidate({ id: applicationId });
      
      // Reset form
      setCardNumber("");
      setCardExpiry("");
      setCardCvc("");
      setCardName("");
      
      onPaymentComplete?.();
    },
    onError: (error) => {
      toast.error(error.message || "Payment failed - please try again");
      setProcessing(false);
    },
  });

  // Load Authorize.Net Accept.js script
  useEffect(() => {
    if (open && paymentMethod === "card" && authorizeNetConfig && !window.Accept) {
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
  }, [open, paymentMethod, authorizeNetConfig]);

  const handleCardPayment = async () => {
    if (!authorizeNetConfig) {
      toast.error("Payment configuration error");
      return;
    }
    
    if (!cardNumber || !cardExpiry || !cardCvc || !cardName) {
      toast.error("Please fill in all card details");
      return;
    }

    setProcessing(true);

    const [expMonth, expYear] = cardExpiry.split("/").map(s => s.trim());
    
    const secureData = {
      authData: {
        clientKey: authorizeNetConfig.clientKey,
        apiLoginID: authorizeNetConfig.apiLoginId,
      },
      cardData: {
        cardNumber: cardNumber.replace(/\s/g, ""),
        month: expMonth,
        year: expYear.length === 2 ? `20${expYear}` : expYear,
        cardCode: cardCvc,
      },
    };

    if (!window.Accept) {
      toast.error("Payment system not ready. Please try again.");
      setProcessing(false);
      return;
    }

    window.Accept.dispatchData(secureData, async (response) => {
      if (response.messages.resultCode === "Error") {
        toast.error(response.messages.message[0].text);
        setProcessing(false);
        return;
      }

      try {
        await createPaymentMutation.mutateAsync({
          loanApplicationId: applicationId,
          amount: processingFeeAmount,
          paymentMethodNonce: response.opaqueData.dataValue,
          paymentMethod: "card",
          description: `Processing fee payment for loan application #${applicationId}`,
        });
      } catch (error) {
        console.error("Payment error:", error);
      }
    });
  };

  const handleCryptoPayment = async () => {
    if (!cryptoAddressData?.address) {
      toast.error("Crypto address not available");
      return;
    }

    setProcessing(true);

    try {
      await createPaymentMutation.mutateAsync({
        loanApplicationId: applicationId,
        amount: processingFeeAmount,
        paymentMethod: "crypto",
        cryptoCurrency: selectedCrypto,
        cryptoAmount: cryptoConversion?.amount || "0",
        cryptoAddress: cryptoAddressData.address,
        description: `Processing fee payment (${selectedCrypto}) for loan application #${applicationId}`,
      });
    } catch (error) {
      console.error("Crypto payment error:", error);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setAddressCopied(true);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, "");
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(" ");
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  return (
    <>
      <Button 
        onClick={() => setOpen(true)}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
        size="lg"
      >
        <Zap className="w-5 h-5 mr-2" />
        Quick Pay Processing Fee
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Pay Processing Fee</DialogTitle>
            <DialogDescription>
              Complete your processing fee payment of {formatCurrency(processingFeeAmount)}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "card" | "crypto")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="card" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Credit/Debit Card
              </TabsTrigger>
              <TabsTrigger value="crypto" className="flex items-center gap-2">
                <Bitcoin className="w-4 h-4" />
                Cryptocurrency
              </TabsTrigger>
            </TabsList>

            {/* Card Payment Tab */}
            <TabsContent value="card" className="space-y-4 mt-6">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardName">Cardholder Name</Label>
                    <Input
                      id="cardName"
                      placeholder="John Doe"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      disabled={processing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      maxLength={19}
                      disabled={processing}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardExpiry">Expiry (MM/YY)</Label>
                      <Input
                        id="cardExpiry"
                        placeholder="12/25"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                        maxLength={5}
                        disabled={processing}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cardCvc">CVV</Label>
                      <Input
                        id="cardCvc"
                        placeholder="123"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ""))}
                        maxLength={4}
                        disabled={processing}
                        type="password"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-muted-foreground">Processing Fee</span>
                      <span className="text-xl font-bold">{formatCurrency(processingFeeAmount)}</span>
                    </div>

                    <Button
                      onClick={handleCardPayment}
                      disabled={processing || !cardNumber || !cardExpiry || !cardCvc || !cardName}
                      className="w-full"
                      size="lg"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing Payment...
                        </>
                      ) : (
                        <>
                          Pay {formatCurrency(processingFeeAmount)}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Crypto Payment Tab */}
            <TabsContent value="crypto" className="space-y-4 mt-6">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Select Cryptocurrency</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["BTC", "ETH", "USDT", "USDC"] as const).map((crypto) => (
                        <Button
                          key={crypto}
                          variant={selectedCrypto === crypto ? "default" : "outline"}
                          onClick={() => setSelectedCrypto(crypto)}
                          disabled={processing}
                          className="h-12"
                        >
                          {crypto}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Amount to Send</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                          {cryptoConversion?.amount || "0"} {selectedCrypto}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          ≈ {formatCurrency(processingFeeAmount)} USD
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(cryptoConversion?.amount || "0", "Amount")}
                      >
                        {addressCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 mr-2">
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">Send to Address</p>
                        <p className="text-sm font-mono break-all text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 p-2 rounded border">
                          {cryptoAddressData?.address || "Loading..."}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(cryptoAddressData?.address || "", "Address")}
                        disabled={!cryptoAddressData?.address}
                      >
                        {addressCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Important:</strong> Send exactly {cryptoConversion?.amount} {selectedCrypto} to the address above. 
                      After sending, click the button below to verify your payment.
                    </p>
                  </div>

                  <div className="pt-4 border-t">
                    <Button
                      onClick={handleCryptoPayment}
                      disabled={processing || !cryptoAddressData?.address}
                      className="w-full"
                      size="lg"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verifying Payment...
                        </>
                      ) : (
                        <>
                          I've Sent the Crypto
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
