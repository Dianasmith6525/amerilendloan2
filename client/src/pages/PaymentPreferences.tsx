import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, DollarSign, Calendar, TrendingUp, Info } from "lucide-react";
import { useState, useEffect } from "react";

export default function PaymentPreferences() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [allocationStrategy, setAllocationStrategy] = useState<string>("standard");
  const [enableBiweekly, setEnableBiweekly] = useState(false);
  const [biweeklyAmount, setBiweeklyAmount] = useState("");
  const [enableRoundUp, setEnableRoundUp] = useState(false);
  const [roundUpTarget, setRoundUpTarget] = useState("");
  const [autoExtraPayment, setAutoExtraPayment] = useState(false);
  const [extraPaymentAmount, setExtraPaymentAmount] = useState("");
  const [extraPaymentDay, setExtraPaymentDay] = useState("");

  // Fetch current preferences
  const { data: preferencesData, isLoading } = trpc.paymentPreferences.getPreferences.useQuery({});
  const preferences = (preferencesData as any)?.data;

  // Update form when preferences load
  useEffect(() => {
    if (preferences) {
      setAllocationStrategy(preferences.allocationStrategy);
      setEnableBiweekly(preferences.biweeklyPayments);
      setBiweeklyAmount(preferences.biweeklyAmount ? (preferences.biweeklyAmount / 100).toString() : "");
      setEnableRoundUp(preferences.roundUpPayments);
      setRoundUpTarget(preferences.roundUpTarget ? preferences.roundUpTarget.toString() : "");
      setAutoExtraPayment(preferences.autoExtraPayment);
      setExtraPaymentAmount(preferences.extraPaymentAmount ? (preferences.extraPaymentAmount / 100).toString() : "");
      setExtraPaymentDay(preferences.extraPaymentDay ? preferences.extraPaymentDay.toString() : "");
    }
  }, [preferences]);

  // Update preferences mutation
  const updateMutation = trpc.paymentPreferences.updatePreferences.useMutation({
    onSuccess: () => {
      utils.paymentPreferences.getPreferences.invalidate();
      toast.success("Your payment preferences have been saved successfully.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update payment preferences.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      allocationStrategy: allocationStrategy as any,
      biweeklyPayments: enableBiweekly,
      biweeklyAmount: enableBiweekly && biweeklyAmount ? Math.round(parseFloat(biweeklyAmount) * 100) : undefined,
      roundUpPayments: enableRoundUp,
      roundUpTarget: enableRoundUp && roundUpTarget ? parseInt(roundUpTarget) : undefined,
      autoExtraPayment,
      extraPaymentAmount: autoExtraPayment && extraPaymentAmount ? Math.round(parseFloat(extraPaymentAmount) * 100) : undefined,
      extraPaymentDay: autoExtraPayment && extraPaymentDay ? parseInt(extraPaymentDay) : undefined,
    } as any);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Payment Preferences</h1>
        <p className="text-muted-foreground">
          Customize how your payments are allocated and set up automatic extra payments.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment Allocation Strategy */}
        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <DollarSign className="h-5 w-5 text-primary mt-1" />
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2">Payment Allocation</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Choose how your payments are applied to interest and principal.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="allocation">Allocation Strategy</Label>
            <Select value={allocationStrategy} onValueChange={setAllocationStrategy}>
              <SelectTrigger id="allocation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (Interest First)</SelectItem>
                <SelectItem value="principal_first">Principal First</SelectItem>
                <SelectItem value="interest_first">Interest First</SelectItem>
                <SelectItem value="split_evenly">Split Evenly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {allocationStrategy === "standard" && "Interest is paid first, then principal (standard amortization)"}
              {allocationStrategy === "principal_first" && "Extra payments go toward principal first"}
              {allocationStrategy === "interest_first" && "Extra payments go toward interest first"}
              {allocationStrategy === "split_evenly" && "Extra payments split 50/50 between interest and principal"}
              {allocationStrategy === "custom" && "Set custom allocation percentages"}
            </p>
          </div>
        </Card>

        {/* Bi-weekly Payments */}
        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Calendar className="h-5 w-5 text-primary mt-1" />
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2">Bi-weekly Payments</h2>
              <p className="text-sm text-muted-foreground">
                Make payments every two weeks instead of monthly to pay off your loan faster.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="biweekly">Enable Bi-weekly Payments</Label>
              <Switch
                id="biweekly"
                checked={enableBiweekly}
                onCheckedChange={setEnableBiweekly}
              />
            </div>

            {enableBiweekly && (
              <div className="space-y-2">
                <Label htmlFor="biweeklyAmount">Bi-weekly Payment Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                  <Input
                    id="biweeklyAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={biweeklyAmount}
                    onChange={(e) => setBiweeklyAmount(e.target.value)}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  <Info className="inline h-3 w-3 mr-1" />
                  Bi-weekly payments result in 26 payments per year (equivalent to 13 monthly payments)
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Round-Up Payments */}
        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <TrendingUp className="h-5 w-5 text-primary mt-1" />
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2">Round-Up Payments</h2>
              <p className="text-sm text-muted-foreground">
                Automatically round up your payments to the nearest dollar amount.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="roundup">Enable Round-Up</Label>
              <Switch
                id="roundup"
                checked={enableRoundUp}
                onCheckedChange={setEnableRoundUp}
              />
            </div>

            {enableRoundUp && (
              <div className="space-y-2">
                <Label htmlFor="roundUpTarget">Round Up To Nearest</Label>
                <Select value={roundUpTarget} onValueChange={setRoundUpTarget}>
                  <SelectTrigger id="roundUpTarget">
                    <SelectValue placeholder="Select amount" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">$1</SelectItem>
                    <SelectItem value="5">$5</SelectItem>
                    <SelectItem value="10">$10</SelectItem>
                    <SelectItem value="25">$25</SelectItem>
                    <SelectItem value="50">$50</SelectItem>
                    <SelectItem value="100">$100</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Example: If your payment is $342.67, rounding to $10 would make it $350.00
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Automatic Extra Payments */}
        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <DollarSign className="h-5 w-5 text-primary mt-1" />
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2">Automatic Extra Payments</h2>
              <p className="text-sm text-muted-foreground">
                Set up recurring extra payments to pay off your loan faster.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="autoExtra">Enable Auto Extra Payments</Label>
              <Switch
                id="autoExtra"
                checked={autoExtraPayment}
                onCheckedChange={setAutoExtraPayment}
              />
            </div>

            {autoExtraPayment && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="extraAmount">Extra Payment Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                    <Input
                      id="extraAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={extraPaymentAmount}
                      onChange={(e) => setExtraPaymentAmount(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                      required={autoExtraPayment}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="extraDay">Payment Day (1-28)</Label>
                  <Input
                    id="extraDay"
                    type="number"
                    min="1"
                    max="28"
                    value={extraPaymentDay}
                    onChange={(e) => setExtraPaymentDay(e.target.value)}
                    placeholder="15"
                    required={autoExtraPayment}
                  />
                  <p className="text-xs text-muted-foreground">
                    Day of the month when the extra payment will be automatically processed
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Impact Estimate */}
        {(enableBiweekly || enableRoundUp || autoExtraPayment) && (
          <Card className="p-6 bg-primary/5 border-primary/20">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Estimated Impact
            </h3>
            <p className="text-sm text-muted-foreground">
              Based on your settings, these extra payments could help you:
            </p>
            <ul className="text-sm space-y-1 mt-2 ml-4 list-disc">
              {enableBiweekly && <li>Pay off your loan approximately 3-5 years earlier</li>}
              {enableRoundUp && <li>Save hundreds in interest over the life of the loan</li>}
              {autoExtraPayment && <li>Reduce total interest paid significantly</li>}
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Note: Actual results depend on your loan terms and payment consistency.
            </p>
          </Card>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex-1"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </div>
      </form>

      {/* Help Information */}
      <Card className="p-6 mt-6 bg-muted/50">
        <h3 className="font-semibold mb-2">Need Help?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Have questions about payment preferences or want personalized advice on the best strategy for your situation?
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate('/support')}>
          Contact Support
        </Button>
      </Card>
    </div>
  );
}
