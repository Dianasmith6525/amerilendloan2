import { useState, useEffect, useRef } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Shield, Lock } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getPersistentIdempotencyKey, clearPersistentIdempotencyKey } from "@/lib/idempotency";

// Cache the Stripe promise so it's only loaded once
let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise(publishableKey: string) {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

interface StripeCheckoutFormProps {
  clientSecret: string;
  paymentId: number;
  paymentIntentId: string;
  amount: number; // in cents
  onSuccess: (data: { transactionId: string; cardLast4?: string; cardBrand?: string }) => void;
  onError: (error: string) => void;
  onProcessing?: (processing: boolean) => void;
}

/**
 * Inner form rendered inside <Elements> provider.
 * Uses Stripe's PaymentElement for PCI-compliant card collection.
 */
function StripeCheckoutForm({
  clientSecret: _clientSecret,
  paymentId,
  paymentIntentId,
  amount,
  onSuccess,
  onError,
  onProcessing,
}: StripeCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);

  const confirmMutation = trpc.payments.confirmStripePaymentIntent.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        onSuccess({
          transactionId: data.transactionId || paymentIntentId,
          cardLast4: data.cardLast4 || undefined,
          cardBrand: data.cardBrand || undefined,
        });
      } else if (data.requiresAction) {
        onError("Payment requires additional authentication. Please try again.");
      } else {
        onError(data.error || "Payment confirmation failed");
      }
      setProcessing(false);
      onProcessing?.(false);
    },
    onError: (err) => {
      onError(err.message || "Payment confirmation failed");
      setProcessing(false);
      onProcessing?.(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      toast.error("Payment system not ready. Please wait a moment.");
      return;
    }

    setProcessing(true);
    onProcessing?.(true);

    // Confirm the payment on the client side with Stripe.js
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "/dashboard",
      },
      redirect: "if_required", // Don't redirect unless 3D Secure is required
    });

    if (error) {
      onError(error.message || "Payment failed");
      setProcessing(false);
      onProcessing?.(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      // Tell our server the payment succeeded so it updates DB
      confirmMutation.mutate({
        paymentIntentId: paymentIntent.id,
        paymentId,
      });
    } else if (paymentIntent && paymentIntent.status === "requires_action") {
      onError("Payment requires additional authentication");
      setProcessing(false);
      onProcessing?.(false);
    } else {
      onError(`Unexpected payment status: ${paymentIntent?.status}`);
      setProcessing(false);
      onProcessing?.(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        onReady={() => setReady(true)}
        options={{
          layout: "tabs",
        }}
      />

      {/* Security indicators */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          <span>256-bit SSL</span>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          <span>PCI DSS Compliant</span>
        </div>
        <div className="flex items-center gap-1">
          <CreditCard className="h-3 w-3" />
          <span>Powered by Stripe</span>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!stripe || !ready || processing}
        className="w-full"
        size="lg"
      >
        {processing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Pay ${(amount / 100).toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
}

// ─── Public wrapper ────────────────────────────────────────────

export interface StripePaymentFormProps {
  loanApplicationId: number;
  amount: number; // cents
  onSuccess: (data: { transactionId: string; cardLast4?: string; cardBrand?: string }) => void;
  onError: (error: string) => void;
  onProcessing?: (processing: boolean) => void;
}

/**
 * Full Stripe payment form.
 *
 * 1. Fetches Stripe config (publishable key)
 * 2. Creates a PaymentIntent via tRPC
 * 3. Renders Stripe Elements with PaymentElement
 * 4. On submit → confirms with Stripe.js → tells our server
 */
export default function StripePaymentForm({
  loanApplicationId,
  amount,
  onSuccess,
  onError,
  onProcessing,
}: StripePaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const intentCreatedRef = useRef(false);
  // Persistent across remounts/refreshes for the same loan + method, so a
  // refresh or back-nav reuses the same payment intent instead of creating
  // a duplicate row.
  const idempotencyKeyRef = useRef(getPersistentIdempotencyKey(loanApplicationId, "card"));

  // Fetch the Stripe publishable key
  const { data: stripeConfig, isLoading: configLoading } = trpc.payments.getStripeConfig.useQuery();

  // Create payment intent mutation
  const createIntentMutation = trpc.payments.createIntent.useMutation({
    onSuccess: (data) => {
      if (data.success && data.clientSecret) {
        setClientSecret(data.clientSecret);
        setPaymentId(data.paymentId);
        setPaymentIntentId(data.paymentIntentId);
        setLoading(false);
      } else {
        setInitError(data.error || "Failed to initialize Stripe payment");
        setLoading(false);
      }
    },
    onError: (err) => {
      setInitError(err.message || "Failed to create payment intent");
      setLoading(false);
    },
  });

  // Create the payment intent when component mounts (once only)
  useEffect(() => {
    if (configLoading) return;
    
    if (!stripeConfig?.enabled) {
      setLoading(false);
      return;
    }

    // Prevent duplicate payment intent creation on re-renders
    if (intentCreatedRef.current) return;
    intentCreatedRef.current = true;

    createIntentMutation.mutate({
      loanApplicationId,
      paymentMethod: "card",
      paymentProvider: "stripe",
      idempotencyKey: idempotencyKeyRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripeConfig?.enabled, configLoading, loanApplicationId]);

  // Show disabled message early if config is loaded and Stripe is not available
  if (!configLoading && !stripeConfig?.enabled) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p>Card payments are not currently available.</p>
        <p className="text-sm mt-1">Please use another payment method.</p>
      </div>
    );
  }

  if (configLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-muted-foreground">Initializing secure payment...</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="text-center py-6 space-y-3">
        <p className="text-destructive font-medium">{initError}</p>
        <Button
          variant="outline"
          onClick={() => {
            setInitError(null);
            setLoading(true);
            intentCreatedRef.current = false;
            // Force a brand-new key on retry — the previous one is now poisoned.
            clearPersistentIdempotencyKey(loanApplicationId, "card");
            idempotencyKeyRef.current = getPersistentIdempotencyKey(loanApplicationId, "card");
            createIntentMutation.mutate({
              loanApplicationId,
              paymentMethod: "card",
              paymentProvider: "stripe",
              idempotencyKey: idempotencyKeyRef.current,
            });
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!clientSecret || paymentId === null || !paymentIntentId) {
    return null;
  }

  if (!stripeConfig?.publishableKey) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p>Card payments are not properly configured.</p>
        <p className="text-sm mt-1">Please contact support or use another payment method.</p>
      </div>
    );
  }

  const stripePromise = getStripePromise(stripeConfig.publishableKey);

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#2563eb",
            borderRadius: "8px",
            fontFamily: "Inter, system-ui, sans-serif",
          },
        },
      }}
    >
      <StripeCheckoutForm
        clientSecret={clientSecret}
        paymentId={paymentId}
        paymentIntentId={paymentIntentId}
        amount={amount}
        onSuccess={onSuccess}
        onError={onError}
        onProcessing={onProcessing}
      />
    </Elements>
  );
}
