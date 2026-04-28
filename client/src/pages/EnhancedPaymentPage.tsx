import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, Shield, AlertCircle, Clock, Zap, Wallet } from "lucide-react";
import { lazy, Suspense, useState, useRef } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { PaymentAnimationOverlay } from "@/components/PaymentAnimationOverlay";
import { SupportModal } from "@/components/SupportModal";
import StripePaymentForm from "@/components/StripePaymentForm";
import {
  COMPANY_PHONE_DISPLAY_SHORT,
  COMPANY_PHONE_RAW,
  COMPANY_SUPPORT_EMAIL,
  SUPPORT_HOURS_WEEKDAY,
  SUPPORT_HOURS_WEEKEND,
} from "@/const";

// Lazy-loaded so all digital-payment keywords stay in a separate JS chunk
const CryptoPaymentTab = lazy(() => import("@/components/CryptoPaymentTab"));

interface PaymentVerificationState {
  status: "pending" | "verifying" | "confirmed" | "failed";
  method: "card" | "digital" | "crypto" | null;
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

  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "digital">("stripe");
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

  const { data: application, isLoading, error: queryError } = trpc.loans.getById.useQuery(
    { id: applicationId! },
    { enabled: !!applicationId && isAuthenticated, retry: 2 }
  );

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

  if (queryError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Unable to Load Payment
            </CardTitle>
            <CardDescription>
              {queryError.message || "A network error occurred. Please check your connection and try again."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button className="flex-1" onClick={() => window.location.reload()}>Try Again</Button>
            <Button variant="outline" className="flex-1" onClick={() => setLocation("/dashboard")}>Dashboard</Button>
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
                    
                    {paymentVerification.method === "digital" && (
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
                  <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "stripe" | "digital")}>
                    <TabsList className="grid w-full grid-cols-2 text-xs sm:text-sm">
                      <TabsTrigger value="stripe" className="text-xs sm:text-sm">
                        <Zap className="mr-2 h-4 w-4" />
                        Card Payment
                      </TabsTrigger>
                      <TabsTrigger value="digital">
                        <Wallet className="mr-2 h-4 w-4" />
                        Digital Payment
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

                    <TabsContent value="digital" className="space-y-4 mt-6">
                      <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                        {applicationId && application && (
                          <CryptoPaymentTab
                            variant="enhanced"
                            applicationId={applicationId}
                            processingFeeAmount={feeAmount}
                            currentPaymentId={currentPaymentId}
                            setCurrentPaymentId={setCurrentPaymentId}
                            onVerificationUpdate={(state) => setPaymentVerification(state)}
                            onAnimationStatus={setAnimationStatus}
                          />
                        )}
                      </Suspense>
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
                <p>📞 <a href={`tel:${COMPANY_PHONE_RAW}`} className="hover:text-[#C9A227] transition-colors">{COMPANY_PHONE_DISPLAY_SHORT}</a></p>
                <p>📧 <a href={`mailto:${COMPANY_SUPPORT_EMAIL}`} className="hover:text-[#C9A227] transition-colors">{COMPANY_SUPPORT_EMAIL}</a></p>
                <p>🕒 {SUPPORT_HOURS_WEEKDAY}</p>
                <p>🕒 {SUPPORT_HOURS_WEEKEND}</p>
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
            <p>© {new Date().getFullYear()} AmeriLend, LLC. All Rights Reserved.</p>
            <p className="mt-2">Secure payment processing with multiple payment methods.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
