import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, CreditCard } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";

export default function PaymentPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/payment/:id");
  const applicationId = params?.id ? parseInt(params.id) : null;
  const [paymentComplete, setPaymentComplete] = useState(false);

  const { data: application, isLoading } = trpc.loans.getById.useQuery(
    { id: applicationId! },
    { enabled: !!applicationId && isAuthenticated }
  );

  const { data: feeConfig } = trpc.feeConfig.getActive.useQuery();

  const createPaymentMutation = trpc.payments.createIntent.useMutation({
    onSuccess: (data) => {
      toast.success("Payment initiated");
      // In production, this would redirect to Stripe checkout
      // For demo, we'll simulate payment confirmation
      confirmPaymentMutation.mutate({ paymentId: data.amount }); // Using amount as placeholder
    },
    onError: (error) => {
      toast.error(error.message || "Failed to initiate payment");
    },
  });

  const confirmPaymentMutation = trpc.payments.confirmPayment.useMutation({
    onSuccess: () => {
      setPaymentComplete(true);
      toast.success("Payment confirmed successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Payment confirmation failed");
    },
  });

  const handlePayment = () => {
    if (!applicationId) return;
    
    // In production, this would:
    // 1. Create payment intent
    // 2. Redirect to Stripe checkout
    // 3. Handle webhook for confirmation
    // For demo purposes, we simulate the full flow
    createPaymentMutation.mutate({ loanApplicationId: applicationId });
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
                <CreditCard className="h-5 w-5" />
                Payment Information
              </CardTitle>
              <CardDescription>
                Demo Mode: Click the button below to simulate payment processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-900">
                  <strong>Demo Notice:</strong> In production, this page would integrate with Stripe for secure payment processing. 
                  For demonstration purposes, clicking "Pay Now" will simulate a successful payment.
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={handlePayment}
                  disabled={createPaymentMutation.isPending || confirmPaymentMutation.isPending}
                >
                  {createPaymentMutation.isPending || confirmPaymentMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pay ${((application.processingFeeAmount || 0) / 100).toFixed(2)}
                    </>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setLocation("/dashboard")}
                >
                  Cancel
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
