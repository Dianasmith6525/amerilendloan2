import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CreditCard, 
  Building2, 
  Calendar, 
  DollarSign, 
  CheckCircle2,
  AlertCircle,
  Info,
  Zap,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface AutoPaySettingsProps {
  loans?: Array<{
    id: number;
    trackingNumber: string;
    status: string;
    approvedAmount: number | null;
  }>;
}

export default function AutoPaySettings({ loans = [] }: AutoPaySettingsProps) {
  const [selectedLoan, setSelectedLoan] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank_account" | "card">("bank_account");
  const [paymentDay, setPaymentDay] = useState("1");

  const activeLoans = loans.filter(
    loan => loan.status === "disbursed"
  );

  // Fetch existing auto-pay settings
  const { data: settingsData, isLoading: settingsLoading, refetch: refetchSettings } =
    trpc.autoPay.getSettings.useQuery();

  const existingSettings: any[] = (settingsData as any)?.data || settingsData || [];
  
  // Find setting for selected loan
  const currentSetting = selectedLoan
    ? existingSettings.find((s: any) => String(s.loanApplicationId) === selectedLoan)
    : null;

  const autoPayEnabled = currentSetting?.isEnabled ?? false;

  // Sync form state when a setting is loaded
  useEffect(() => {
    if (currentSetting) {
      setPaymentMethod(currentSetting.paymentMethod || "bank_account");
      setPaymentDay(String(currentSetting.paymentDay || 1));
    }
  }, [currentSetting?.id]);

  // Fetch bank info
  const { data: bankData } = trpc.auth.getBankInfo.useQuery(undefined, {
    retry: false,
  });
  const bankInfo = (bankData as any)?.data || bankData;
  const hasBankAccount = !!(bankInfo?.bankName && bankInfo?.bankAccountNumber);

  // Update settings mutation
  const updateSettings = trpc.autoPay.updateSettings.useMutation({
    onSuccess: () => {
      refetchSettings();
      toast.success("Auto-pay settings updated!");
    },
    onError: (err) => toast.error(err.message || "Failed to update auto-pay"),
  });

  const handleEnableAutoPay = () => {
    if (!selectedLoan) {
      toast.error("Please select a loan");
      return;
    }
    if (paymentMethod === "bank_account" && !hasBankAccount) {
      toast.error("Please add a bank account in your profile first");
      return;
    }

    updateSettings.mutate({
      id: currentSetting?.id,
      loanApplicationId: parseInt(selectedLoan),
      isEnabled: true,
      paymentMethod,
      paymentDay: parseInt(paymentDay),
      amount: 0, // 0 = full payment
    });
  };

  const handleDisableAutoPay = () => {
    if (!selectedLoan || !currentSetting) return;
    updateSettings.mutate({
      id: currentSetting.id,
      loanApplicationId: parseInt(selectedLoan),
      isEnabled: false,
      paymentMethod: currentSetting.paymentMethod,
      paymentDay: currentSetting.paymentDay,
      amount: 0,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-[#0033A0] flex items-center gap-2">
            <Zap className="w-6 h-6" />
            Auto-Pay Settings
          </CardTitle>
          <CardDescription>
            Set up automatic monthly payments for your loans
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Banner */}
          <div className={`p-4 rounded-lg border-2 ${
            autoPayEnabled 
              ? "bg-green-50 border-green-300" 
              : "bg-amber-50 border-amber-300"
          }`}>
            <div className="flex items-start gap-3">
              {autoPayEnabled ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-semibold ${
                  autoPayEnabled ? "text-green-900" : "text-amber-900"
                }`}>
                  {autoPayEnabled ? "Auto-Pay is Active" : "Auto-Pay is Not Enabled"}
                </p>
                <p className={`text-sm mt-1 ${
                  autoPayEnabled ? "text-green-700" : "text-amber-700"
                }`}>
                  {autoPayEnabled 
                    ? `Your payment will be automatically processed on the ${paymentDay}${getOrdinalSuffix(parseInt(paymentDay))} of each month`
                    : "Enable Auto-Pay to never miss a payment and avoid late fees"}
                </p>
              </div>
            </div>
          </div>

          {activeLoans.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No active loans</p>
              <p className="text-sm text-gray-500 mt-1">
                Auto-pay will be available once you have a disbursed loan
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-[#FFA500]" />
                  <div>
                    <Label className="font-medium cursor-pointer">
                      Enable Auto-Pay
                    </Label>
                    <p className="text-sm text-gray-500">
                      Automatically pay your monthly loan payment
                    </p>
                  </div>
                </div>
                <Switch
                  checked={autoPayEnabled}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleEnableAutoPay();
                    } else {
                      handleDisableAutoPay();
                    }
                  }}
                  disabled={!selectedLoan || updateSettings.isPending}
                />
              </div>

              {/* Loan Selection */}
              <div className="space-y-2">
                <Label htmlFor="loan-select" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Select Loan
                </Label>
                <Select value={selectedLoan} onValueChange={setSelectedLoan}>
                  <SelectTrigger id="loan-select">
                    <SelectValue placeholder="Choose a loan for auto-pay" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeLoans.map((loan) => (
                      <SelectItem key={loan.id} value={loan.id.toString()}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{loan.trackingNumber}</span>
                          <span className="text-xs text-gray-500">
                            ${((loan.approvedAmount || 0) / 100).toLocaleString()} - {loan.status}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Payment Method
                </Label>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod("bank_account")}
                    className={`p-4 border-2 rounded-lg transition-colors ${
                      paymentMethod === "bank_account"
                        ? "border-[#0033A0] bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Building2 className="w-6 h-6 mx-auto mb-2 text-[#0033A0]" />
                    <p className="font-semibold text-sm">Bank Account</p>
                    <p className="text-xs text-gray-600 mt-1">ACH Transfer</p>
                  </button>

                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`p-4 border-2 rounded-lg transition-colors ${
                      paymentMethod === "card"
                        ? "border-[#0033A0] bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <CreditCard className="w-6 h-6 mx-auto mb-2 text-[#0033A0]" />
                    <p className="font-semibold text-sm">Debit Card</p>
                    <p className="text-xs text-gray-600 mt-1">Instant</p>
                  </button>
                </div>

                {/* Bank Account Status */}
                {paymentMethod === "bank_account" && !hasBankAccount && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <p className="text-sm font-medium text-amber-900">
                        No bank account on file. Please add one in your profile settings.
                      </p>
                    </div>
                  </div>
                )}

                {paymentMethod === "bank_account" && hasBankAccount && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <p className="text-sm font-medium text-green-900">
                        {bankInfo.bankName} ****{bankInfo.bankAccountNumber?.slice(-4)} ({bankInfo.accountType || "Checking"})
                      </p>
                    </div>
                  </div>
                )}

                {/* Card Status */}
                {paymentMethod === "card" && currentSetting?.cardLast4 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <p className="text-sm font-medium text-green-900">
                        {currentSetting.cardBrand || "Card"} ****{currentSetting.cardLast4}
                      </p>
                    </div>
                  </div>
                )}

                {paymentMethod === "card" && !currentSetting?.cardLast4 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <p className="text-sm font-medium text-amber-900">
                        Card will be saved when you enable auto-pay via the payment page.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Day Selection */}
              <div className="space-y-2">
                <Label htmlFor="payment-day" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Payment Day
                </Label>
                <Select value={paymentDay} onValueChange={setPaymentDay}>
                  <SelectTrigger id="payment-day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1st of month</SelectItem>
                    <SelectItem value="5">5th of month</SelectItem>
                    <SelectItem value="10">10th of month</SelectItem>
                    <SelectItem value="15">15th of month</SelectItem>
                    <SelectItem value="20">20th of month</SelectItem>
                    <SelectItem value="25">25th of month</SelectItem>
                    <SelectItem value="28">Last day of month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Benefits */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Auto-Pay Benefits
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✅ Never miss a payment or incur late fees</li>
                  <li>✅ Build better credit with consistent on-time payments</li>
                  <li>✅ Save time - no manual payments needed</li>
                  <li>✅ Can cancel or modify anytime</li>
                </ul>
              </div>

              {/* Auto-Pay Schedule Preview */}
              {autoPayEnabled && currentSetting && (
                <div className="border-t pt-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Upcoming Auto-Payments</h4>
                  <div className="space-y-2">
                    {[0, 1, 2].map((month) => {
                      const date = new Date();
                      date.setMonth(date.getMonth() + month);
                      date.setDate(currentSetting.paymentDay || parseInt(paymentDay));
                      
                      return (
                        <div key={month} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-gray-600" />
                            <div>
                              <p className="font-medium text-sm">{date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                              <p className="text-xs text-gray-600">{currentSetting.paymentMethod === "bank_account" ? "Bank Account" : "Debit Card"}</p>
                            </div>
                          </div>
                          <p className="font-bold text-green-600">
                            {currentSetting.amount ? `$${(currentSetting.amount / 100).toFixed(2)}` : "Full Payment"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Important Notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-900 font-semibold mb-1">
          ⚠️ Important Information
        </p>
        <ul className="text-xs text-amber-700 space-y-1">
          <li>• Ensure sufficient funds are available before the payment date</li>
          <li>• Failed payments may result in late fees and service interruption</li>
          <li>• You'll receive an email confirmation after each automatic payment</li>
          <li>• You can pause or cancel auto-pay at any time without penalty</li>
        </ul>
      </div>
    </div>
  );
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
