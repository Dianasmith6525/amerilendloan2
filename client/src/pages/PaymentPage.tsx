import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, Wallet, Zap } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { SkeletonPaymentCard, SkeletonDetailSection } from "@/components/SkeletonCard";
import { TrustIndicators } from "@/components/SecuritySeal";
import StripePaymentForm from "@/components/StripePaymentForm";
import {
  COMPANY_PHONE_DISPLAY_SHORT,
  COMPANY_PHONE_RAW,
  COMPANY_SUPPORT_EMAIL,
  SUPPORT_HOURS_WEEKDAY,
  SUPPORT_HOURS_WEEKEND,
} from "@/const";

// Lazy-loaded so all crypto keywords stay in a separate JS chunk
const CryptoPaymentTab = lazy(() => import("@/components/CryptoPaymentTab"));

export default function PaymentPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/payment/:id");
  const applicationId = params?.id ? parseInt(params.id) : null;
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "digital">("stripe");
  const [processing, setProcessing] = useState(false);

  const { data: application, isLoading, error: queryError } = trpc.loans.getById.useQuery(
    { id: applicationId! },
    { enabled: !!applicationId && isAuthenticated, retry: 2 }
  );

  const { data: feeConfig } = trpc.feeConfig.getActive.useQuery();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <SkeletonPaymentCard />
              <SkeletonPaymentCard />
            </div>
            <SkeletonDetailSection />
          </div>
        </div>
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
                <img src="/logo.jpg" alt="AmeriLend" className="h-32 w-auto mix-blend-multiply" />
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
              <img src="/logo.jpg" alt="AmeriLend" className="h-32 w-auto mix-blend-multiply" />
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
              <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "stripe" | "digital")}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="stripe">
                    <Zap className="mr-2 h-4 w-4" />
                    Card Payment
                  </TabsTrigger>
                  <TabsTrigger value="digital">
                    <Wallet className="mr-2 h-4 w-4" />
                    Digital Payment
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="stripe" className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-indigo-900">
                      <strong>Stripe Checkout:</strong> Pay securely with Stripe. Supports all major cards, Apple Pay, and Google Pay.
                    </p>
                  </div>

                  {applicationId && application && (
                    <StripePaymentForm
                      loanApplicationId={applicationId}
                      amount={application.processingFeeAmount || 0}
                      onSuccess={() => {
                        setPaymentComplete(true);
                        toast.success("Payment successful!");
                      }}
                      onError={(error) => {
                        toast.error(error || "Payment failed - please try again");
                      }}
                      onProcessing={setProcessing}
                    />
                  )}
                </TabsContent>

                <TabsContent value="digital" className="space-y-4">
                  <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                    {applicationId && application && (
                      <CryptoPaymentTab
                        variant="simple"
                        applicationId={applicationId}
                        processingFeeAmount={application.processingFeeAmount || 0}
                      />
                    )}
                  </Suspense>
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

      {/* Trust Indicators */}
      <div className="container mx-auto px-4 max-w-2xl mt-6 mb-2">
        <TrustIndicators />
      </div>

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
            <p className="mt-2">Secure payment processing with end-to-end encryption.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
