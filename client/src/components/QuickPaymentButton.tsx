import { useState, useRef } from "react";
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
import { Bitcoin, Loader2, Copy, Check, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getPersistentIdempotencyKey } from "@/lib/idempotency";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import StripePaymentForm from "@/components/StripePaymentForm";

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
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "crypto">("stripe");
  const [processing, setProcessing] = useState(false);
  
  // Crypto payment fields
  const [selectedCrypto, setSelectedCrypto] = useState<"BTC" | "ETH" | "USDT" | "USDC">("USDT");
  const [addressCopied, setAddressCopied] = useState(false);
  const cryptoIdempotencyKeyRef = useRef(getPersistentIdempotencyKey(applicationId, "crypto"));

  const utils = trpc.useUtils();
  
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
      
      onPaymentComplete?.();
    },
    onError: (error) => {
      toast.error(error.message || "Payment failed - please try again");
      setProcessing(false);
    },
  });

  const handleStripeSuccess = async () => {
    toast.success("Payment successful! Processing fee paid.");
    setProcessing(false);
    setOpen(false);
    
    await utils.loans.myLoans.invalidate();
    await utils.loans.getById.invalidate({ id: applicationId });
    
    onPaymentComplete?.();
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
        paymentMethod: "crypto",
        cryptoCurrency: selectedCrypto,
        idempotencyKey: cryptoIdempotencyKeyRef.current,
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

          <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "stripe" | "crypto")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stripe" className="flex items-center gap-2">
                💳 Card Payment (Stripe)
              </TabsTrigger>
              <TabsTrigger value="crypto" className="flex items-center gap-2">
                <Bitcoin className="w-4 h-4" />
                Cryptocurrency
              </TabsTrigger>
            </TabsList>

            {/* Stripe Card Payment Tab */}
            <TabsContent value="stripe" className="space-y-4 mt-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-muted-foreground">Processing Fee</span>
                      <span className="text-xl font-bold">{formatCurrency(processingFeeAmount)}</span>
                    </div>
                  </div>
                  <StripePaymentForm
                    loanApplicationId={applicationId}
                    amount={processingFeeAmount}
                    onSuccess={handleStripeSuccess}
                    onError={(msg) => toast.error(msg)}
                    onProcessing={setProcessing}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Crypto Payment Tab */}
            <TabsContent value="crypto" className="space-y-4 mt-6">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Select Cryptocurrency</p>
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
