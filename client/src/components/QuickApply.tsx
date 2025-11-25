import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, DollarSign, Calendar, Briefcase, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QuickApplyProps {
  existingUserData?: {
    name: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    employmentStatus?: string;
    annualIncome?: number;
  };
}

export default function QuickApply({ existingUserData }: QuickApplyProps) {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    loanAmount: "",
    loanType: "installment",
    loanPurpose: "debt_consolidation",
    ...existingUserData,
  });

  const submitMutation = trpc.loans.submit.useMutation({
    onSuccess: () => {
      toast.success("Application submitted successfully!");
      setLocation("/dashboard");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit application");
    },
  });

  const handleQuickApply = () => {
    if (!formData.loanAmount || parseFloat(formData.loanAmount) < 1000) {
      toast.error("Please enter a loan amount of at least $1,000");
      return;
    }

    // Pre-filled data from existing user info, only need loan-specific details
    submitMutation.mutate({
      // Loan details
      loanAmount: parseFloat(formData.loanAmount) * 100, // Convert to cents
      loanType: formData.loanType as "installment" | "payday",
      loanPurpose: formData.loanPurpose,
      
      // Pre-filled user info
      fullName: formData.name || "",
      email: formData.email || "",
      phoneNumber: formData.phone || "",
      dateOfBirth: "1990-01-01", // Would be pre-filled from profile
      ssn: "000000000", // Would be pre-filled from profile (masked)
      address: formData.address || "",
      city: formData.city || "",
      state: formData.state || "",
      zipCode: formData.zipCode || "",
      employmentStatus: formData.employmentStatus || "employed",
      annualIncome: formData.annualIncome || 0,
      disbursementMethod: "bank_transfer",
    } as any);
  };

  return (
    <Card className="border-2 border-[#FFA500]">
      <CardHeader className="bg-gradient-to-r from-[#FFA500]/10 to-[#FF8C00]/10">
        <CardTitle className="text-2xl text-[#0033A0] flex items-center gap-2">
          <Zap className="w-6 h-6 text-[#FFA500]" />
          Quick Apply for Additional Loan
        </CardTitle>
        <CardDescription>
          Fast-track application using your existing profile information
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Benefits Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Why Quick Apply?
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✅ Most fields already filled with your information</li>
            <li>✅ Faster approval for existing customers in good standing</li>
            <li>✅ No need to re-upload verification documents</li>
            <li>✅ Apply in under 2 minutes</li>
          </ul>
        </div>

        {/* Loan Amount */}
        <div className="space-y-2">
          <Label htmlFor="quick-loan-amount" className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Loan Amount
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
              $
            </span>
            <Input
              id="quick-loan-amount"
              type="number"
              placeholder="5,000"
              className="pl-8 text-lg font-semibold"
              value={formData.loanAmount}
              onChange={(e) => setFormData({ ...formData, loanAmount: e.target.value })}
              min="1000"
              max="50000"
              step="100"
            />
          </div>
          <p className="text-xs text-gray-500">Minimum: $1,000 • Maximum: $50,000</p>
        </div>

        {/* Loan Type */}
        <div className="space-y-2">
          <Label htmlFor="quick-loan-type" className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Loan Type
          </Label>
          <Select value={formData.loanType} onValueChange={(value) => setFormData({ ...formData, loanType: value })}>
            <SelectTrigger id="quick-loan-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="installment">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Installment Loan</span>
                  <span className="text-xs text-gray-500">12 months • Lower APR</span>
                </div>
              </SelectItem>
              <SelectItem value="payday">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Payday Loan</span>
                  <span className="text-xs text-gray-500">6 months • Quick funding</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loan Purpose */}
        <div className="space-y-2">
          <Label htmlFor="quick-loan-purpose" className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Loan Purpose
          </Label>
          <Select value={formData.loanPurpose} onValueChange={(value) => setFormData({ ...formData, loanPurpose: value })}>
            <SelectTrigger id="quick-loan-purpose">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debt_consolidation">Debt Consolidation</SelectItem>
              <SelectItem value="home_improvement">Home Improvement</SelectItem>
              <SelectItem value="medical_expenses">Medical Expenses</SelectItem>
              <SelectItem value="car_repair">Car Repair</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Pre-filled Info Notice */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            <strong>✨ Already on file:</strong> Your personal information, contact details, employment
            status, and verification documents are pre-filled from your profile.
          </p>
        </div>

        {/* Estimated Terms Preview */}
        {formData.loanAmount && parseFloat(formData.loanAmount) >= 1000 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-gray-900 mb-3">Estimated Loan Terms</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Loan Amount</p>
                <p className="font-bold text-[#0033A0]">
                  ${parseFloat(formData.loanAmount).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Term Length</p>
                <p className="font-bold text-[#0033A0]">
                  {formData.loanType === "installment" ? "12 months" : "6 months"}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Estimated APR</p>
                <p className="font-bold text-[#0033A0]">
                  {formData.loanType === "installment" ? "24.99%" : "35.99%"}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Monthly Payment</p>
                <p className="font-bold text-green-600">
                  $
                  {Math.ceil(
                    (parseFloat(formData.loanAmount) * 1.25) /
                      (formData.loanType === "installment" ? 12 : 6)
                  ).toLocaleString()}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              * Final terms subject to approval and may vary based on creditworthiness
            </p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleQuickApply}
          disabled={!formData.loanAmount || parseFloat(formData.loanAmount) < 1000 || submitMutation.isPending}
          className="w-full bg-[#FFA500] hover:bg-[#FF8C00] text-white text-lg py-6"
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Submitting Application...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-2" />
              Submit Quick Application
            </>
          )}
        </Button>

        <p className="text-xs text-center text-gray-500">
          By submitting, you agree to our Terms of Service and Privacy Policy
        </p>
      </CardContent>
    </Card>
  );
}
