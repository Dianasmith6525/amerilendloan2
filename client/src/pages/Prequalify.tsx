import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Prequalify() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Prevent admins from accessing prequalification
  if (!authLoading && isAuthenticated && user?.role === "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardContent className="pt-6 space-y-4 text-center">
            <h2 className="text-lg font-semibold">Admin Account</h2>
            <p className="text-sm text-muted-foreground">
              Administrators cannot use the prequalification form. Please use the admin dashboard instead.
            </p>
            <Link href="/dashboard">
              <Button className="w-full">Go to Admin Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [step, setStep] = useState<"form" | "result">("form");
  const [loading, setLoading] = useState(false);
  const [qualifyResult, setQualifyResult] = useState<{
    qualified: boolean;
    message: string;
    loanAmount?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    age: "",
    annualIncome: "",
    creditScore: "",
    employmentStatus: "employed",
    state: "TX",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      toast.error("Please enter your full name");
      return false;
    }
    if (!formData.email.trim()) {
      toast.error("Please enter your email");
      return false;
    }
    if (!formData.phone.trim()) {
      toast.error("Please enter your phone number");
      return false;
    }
    if (!formData.age) {
      toast.error("Please enter your age");
      return false;
    }
    const ageNum = parseInt(formData.age);
    if (ageNum < 18) {
      toast.error("You must be at least 18 years old");
      return false;
    }
    if (!formData.annualIncome) {
      toast.error("Please enter your annual income");
      return false;
    }
    if (!formData.creditScore) {
      toast.error("Please enter your credit score");
      return false;
    }
    return true;
  };

  const handlePrequalify = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Simulate prequalification check
      const age = parseInt(formData.age);
      const income = parseInt(formData.annualIncome);
      const creditScore = parseInt(formData.creditScore);

      // Basic qualification logic
      const isQualified =
        age >= 18 &&
        income >= 20000 && // At least $20k annual income
        creditScore >= 300; // Credit score of 300 or higher (we accept lower scores)

      if (isQualified) {
        // Determine loan amount based on income and credit
        let loanAmount = "$5,000";
        if (income >= 50000 && creditScore >= 650) {
          loanAmount = "$25,000";
        } else if (income >= 40000 && creditScore >= 600) {
          loanAmount = "$15,000";
        } else if (income >= 30000 && creditScore >= 550) {
          loanAmount = "$10,000";
        }

        setQualifyResult({
          qualified: true,
          message: "Great news! You appear to qualify for a personal loan.",
          loanAmount,
        });
      } else {
        let reason = "";
        if (age < 18) {
          reason = "You must be at least 18 years old";
        } else if (income < 20000) {
          reason = "Your annual income is below our minimum requirement of $20,000";
        } else if (creditScore < 300) {
          reason = "Your credit score is below our minimum requirement";
        }

        setQualifyResult({
          qualified: false,
          message: `Unfortunately, you don't appear to qualify at this time. ${reason}`,
        });
      }

      setStep("result");
    } catch (error) {
      toast.error("An error occurred during prequalification");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyNow = () => {
    // Store prequalification data in localStorage
    localStorage.setItem('prequalificationData', JSON.stringify(formData));
    // Redirect to full application
    setLocation("/apply");
  };

  if (step === "result") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0033A0]/5 to-[#FFA500]/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            {qualifyResult?.qualified ? (
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="w-16 h-16 text-green-600" />
              </div>
            ) : null}
            <CardTitle className={qualifyResult?.qualified ? "text-green-600" : "text-orange-600"}>
              {qualifyResult?.qualified ? "Pre-Qualification Approved!" : "Pre-Qualification Result"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-center text-gray-700 mb-4">
                {qualifyResult?.message}
              </p>
              {qualifyResult?.qualified && qualifyResult?.loanAmount && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600">Estimated Loan Amount</p>
                  <p className="text-2xl font-bold text-green-600">{qualifyResult.loanAmount}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {qualifyResult?.qualified && (
                <Button
                  onClick={handleApplyNow}
                  className="w-full bg-[#FFA500] hover:bg-[#FF8C00] text-white font-semibold py-3"
                >
                  Apply Now
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className="w-full"
              >
                Return Home
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              {qualifyResult?.qualified
                ? "Pre-qualification is not a guarantee of loan approval. Final approval depends on a complete application review."
                : "You may still be eligible. Contact us to discuss your options."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0033A0]/5 to-[#FFA500]/5 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <a className="flex items-center gap-2 text-[#0033A0] hover:text-[#002080] mb-4 text-sm">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </a>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Get Pre-Qualified</h1>
          <p className="text-gray-600 mt-2">
            Take 2 minutes to see if you qualify for a personal loan
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Pre-Qualification Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>

            {/* Financial Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Information</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      name="age"
                      type="number"
                      min="18"
                      placeholder="25"
                      value={formData.age}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Select value={formData.state} onValueChange={(value) => handleSelectChange('state', value)}>
                      <SelectTrigger id="state">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AL">Alabama</SelectItem>
                        <SelectItem value="AK">Alaska</SelectItem>
                        <SelectItem value="AZ">Arizona</SelectItem>
                        <SelectItem value="AR">Arkansas</SelectItem>
                        <SelectItem value="CA">California</SelectItem>
                        <SelectItem value="CO">Colorado</SelectItem>
                        <SelectItem value="CT">Connecticut</SelectItem>
                        <SelectItem value="DE">Delaware</SelectItem>
                        <SelectItem value="FL">Florida</SelectItem>
                        <SelectItem value="GA">Georgia</SelectItem>
                        <SelectItem value="HI">Hawaii</SelectItem>
                        <SelectItem value="ID">Idaho</SelectItem>
                        <SelectItem value="IL">Illinois</SelectItem>
                        <SelectItem value="IN">Indiana</SelectItem>
                        <SelectItem value="IA">Iowa</SelectItem>
                        <SelectItem value="KS">Kansas</SelectItem>
                        <SelectItem value="KY">Kentucky</SelectItem>
                        <SelectItem value="LA">Louisiana</SelectItem>
                        <SelectItem value="ME">Maine</SelectItem>
                        <SelectItem value="MD">Maryland</SelectItem>
                        <SelectItem value="MA">Massachusetts</SelectItem>
                        <SelectItem value="MI">Michigan</SelectItem>
                        <SelectItem value="MN">Minnesota</SelectItem>
                        <SelectItem value="MS">Mississippi</SelectItem>
                        <SelectItem value="MO">Missouri</SelectItem>
                        <SelectItem value="MT">Montana</SelectItem>
                        <SelectItem value="NE">Nebraska</SelectItem>
                        <SelectItem value="NV">Nevada</SelectItem>
                        <SelectItem value="NH">New Hampshire</SelectItem>
                        <SelectItem value="NJ">New Jersey</SelectItem>
                        <SelectItem value="NM">New Mexico</SelectItem>
                        <SelectItem value="NY">New York</SelectItem>
                        <SelectItem value="NC">North Carolina</SelectItem>
                        <SelectItem value="ND">North Dakota</SelectItem>
                        <SelectItem value="OH">Ohio</SelectItem>
                        <SelectItem value="OK">Oklahoma</SelectItem>
                        <SelectItem value="OR">Oregon</SelectItem>
                        <SelectItem value="PA">Pennsylvania</SelectItem>
                        <SelectItem value="RI">Rhode Island</SelectItem>
                        <SelectItem value="SC">South Carolina</SelectItem>
                        <SelectItem value="SD">South Dakota</SelectItem>
                        <SelectItem value="TN">Tennessee</SelectItem>
                        <SelectItem value="TX">Texas</SelectItem>
                        <SelectItem value="UT">Utah</SelectItem>
                        <SelectItem value="VT">Vermont</SelectItem>
                        <SelectItem value="VA">Virginia</SelectItem>
                        <SelectItem value="WA">Washington</SelectItem>
                        <SelectItem value="WV">West Virginia</SelectItem>
                        <SelectItem value="WI">Wisconsin</SelectItem>
                        <SelectItem value="WY">Wyoming</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="annualIncome">Annual Income ($)</Label>
                  <Input
                    id="annualIncome"
                    name="annualIncome"
                    type="number"
                    placeholder="50000"
                    value={formData.annualIncome}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <Label htmlFor="creditScore">Credit Score (Optional)</Label>
                  <Input
                    id="creditScore"
                    name="creditScore"
                    type="number"
                    min="300"
                    max="850"
                    placeholder="650"
                    value={formData.creditScore}
                    onChange={handleInputChange}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Don't know your score? We can estimate it. Enter 650 if unsure.
                  </p>
                </div>

                <div>
                  <Label htmlFor="employmentStatus">Employment Status</Label>
                  <Select value={formData.employmentStatus} onValueChange={(value) => handleSelectChange('employmentStatus', value)}>
                    <SelectTrigger id="employmentStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employed">Employed</SelectItem>
                      <SelectItem value="self-employed">Self-Employed</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Link href="/">
                <Button variant="outline" className="flex-1">
                  Cancel
                </Button>
              </Link>
              <Button
                onClick={handlePrequalify}
                disabled={loading}
                className="flex-1 bg-[#FFA500] hover:bg-[#FF8C00] text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Check Qualification"
                )}
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              This pre-qualification takes less than 2 minutes and won't affect your credit.
            </p>
          </CardContent>
        </Card>
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
                <li><a href="/apply" className="hover:text-[#FFA500] transition-colors">Apply for Loan</a></li>
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
            <p className="mt-2">Pre-qualification does not guarantee approval. Actual terms depend on credit evaluation.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
