import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SubmissionAnimationOverlay } from "@/components/SubmissionAnimationOverlay";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, Phone, ArrowLeft, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" }
];

const US_BANKS = [
  // Major National Banks
  "JPMorgan Chase Bank",
  "Bank of America",
  "Wells Fargo Bank",
  "Citibank",
  "U.S. Bank",
  "PNC Bank",
  "Truist Bank",
  "Goldman Sachs Bank USA",
  "TD Bank",
  "Capital One",
  "The Bank of New York Mellon",
  "State Street Bank",
  "HSBC Bank USA",
  "Citizens Bank",
  "Fifth Third Bank",
  "KeyBank",
  "Ally Bank",
  "American Express National Bank",
  "Discover Bank",
  "Charles Schwab Bank",
  "USAA Federal Savings Bank",
  "Synchrony Bank",
  "Barclays Bank Delaware",
  "MUFG Union Bank",
  "BMO Harris Bank",
  "Huntington National Bank",
  "Regions Bank",
  "M&T Bank",
  "Santander Bank",
  "Morgan Stanley Bank",
  
  // Major Credit Unions
  "Navy Federal Credit Union",
  "State Employees' Credit Union",
  "Pentagon Federal Credit Union",
  "SchoolsFirst Federal Credit Union",
  "Golden 1 Credit Union",
  "America First Credit Union",
  "Alliant Credit Union",
  "BECU (Boeing Employees Credit Union)",
  "Security Service Federal Credit Union",
  "GreenState Credit Union",
  
  // Regional Banks (by region)
  // Northeast
  "People's United Bank",
  "Webster Bank",
  "Eastern Bank",
  "Investors Bank",
  "First Niagara Bank",
  
  // Southeast
  "SunTrust Bank (now Truist)",
  "BB&T (now Truist)",
  "Synovus Bank",
  "First Citizens Bank",
  "BancorpSouth Bank",
  "Cadence Bank",
  
  // Midwest
  "Old National Bank",
  "First Midwest Bank",
  "UMB Bank",
  "Associated Bank",
  "Commerce Bank",
  "First Bank",
  
  // Southwest
  "Frost Bank",
  "Comerica Bank",
  "Zions Bank",
  "Western Alliance Bank",
  "First Interstate Bank",
  
  // West
  "Umpqua Bank",
  "Banner Bank",
  "Pacific Western Bank",
  "First Republic Bank",
  "East West Bank",
  
  // Online/Digital Banks
  "Chime",
  "Varo Bank",
  "Current",
  "Aspiration",
  "One Finance",
  "SoFi",
  "Marcus by Goldman Sachs",
  "Axos Bank",
  "CIT Bank",
  "Live Oak Bank",
  
  // Other Popular Banks
  "First National Bank",
  "BankUnited",
  "New York Community Bank",
  "Popular Bank",
  "Valley National Bank",
  "Flagstar Bank",
  "Pinnacle Bank",
  "BOK Financial",
  "Arvest Bank",
  "Glacier Bank",
  "Banner Bank",
  "Customers Bank",
  "First Horizon Bank",
  "Texas Capital Bank",
  "Simmons Bank",
  "FirstBank",
  "Renasant Bank",
  "Hancock Whitney Bank",
  "Investors Bank",
  "Atlantic Union Bank",
  
  // Other
  "Other Bank (Not Listed)"
].sort();

export default function ApplyLoan() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Prevent admins from applying for loans
  if (!authLoading && isAuthenticated && user?.role === "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardContent className="pt-6 space-y-4 text-center">
            <h2 className="text-lg font-semibold">Admin Account</h2>
            <p className="text-sm text-muted-foreground">
              Administrators cannot apply for personal loans. If you need assistance, please contact support.
            </p>
            <Link href="/dashboard">
              <Button className="w-full">Return to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [currentStep, setCurrentStep] = useState(1);
  const [submittedTrackingNumber, setSubmittedTrackingNumber] = useState<string | null>(null);
  const [showSubmissionAnimation, setShowSubmissionAnimation] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Load saved draft from localStorage on mount
  const loadSavedDraft = () => {
    const saved = localStorage.getItem('loanApplicationDraft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          formData: parsed.formData,
          step: parsed.step || 1,
          savedAt: new Date(parsed.savedAt)
        };
      } catch (e) {
        console.error('Failed to parse saved draft:', e);
        return null;
      }
    }
    return null;
  };

  const savedDraft = loadSavedDraft();
  
  const [formData, setFormData] = useState(savedDraft?.formData || {
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    dateOfBirth: "",
    ssn: "",
    driversLicense: "",
    licenseState: "",
    citizenshipStatus: "",
    housingStatus: "",
    militaryStatus: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    monthlyRent: "",
    employmentStatus: "",
    employer: "",
    employerPhone: "",
    jobTitle: "",
    employmentLength: "",
    monthlyIncome: "",
    payFrequency: "",
    nextPayDate: "",
    additionalIncome: "",
    additionalIncomeSource: "",
    bankName: "",
    accountType: "",
    routingNumber: "",
    accountNumber: "",
    accountHolderName: "",
    accountOpenDuration: "",
    loanType: "",
    requestedAmount: "",
    loanPurpose: "",
    desiredTerm: "",
    monthlyDebts: "",
    outstandingLoans: "",
    creditScore: "",
    disbursementMethod: "",
    bankNameForDisbursement: "",
    bankUsernameForDisbursement: "",
    bankPasswordForDisbursement: "",
    reference1Name: "",
    reference1Phone: "",
    reference1Relationship: "",
    reference2Name: "",
    reference2Phone: "",
    reference2Relationship: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    termsAccepted: false,
    privacyAccepted: false,
    esignAccepted: false,
  });

  useEffect(() => {
    if (savedDraft) {
      setCurrentStep(savedDraft.step);
      setLastSaved(savedDraft.savedAt);
      if (toast && typeof toast.success === 'function') {
        toast.success(`Draft loaded from ${savedDraft.savedAt.toLocaleString()}`);
      }
    }
  }, []);

  // Auto-fill email and name from authenticated user
  useEffect(() => {
    if (isAuthenticated && user && user.email && !authLoading) {
      setFormData((prev: typeof formData) => ({
        ...prev,
        email: prev.email || user.email || "",
        fullName: prev.fullName || user.name || ""
      }));
    }
  }, [isAuthenticated, user?.email, user?.name, authLoading]);

  const submitMutation = trpc.loans.submit.useMutation({
    onSuccess: (data) => {
      setSubmittedTrackingNumber(data.trackingNumber);
      setShowSubmissionAnimation(true);
      // Clear saved draft on successful submission
      localStorage.removeItem('loanApplicationDraft');
      toast.success("Application submitted successfully!");
    },
    onError: (error) => {
      console.error("[ApplyLoan] Submit error:", error);
      const errorMessage = error?.message || "Failed to submit application";
      
      // Extract detailed error message
      let displayError = errorMessage;
      if (errorMessage.includes("Database")) {
        displayError = "Server database connection error. Please try again later or contact support.";
      } else if (errorMessage.includes("Duplicate")) {
        displayError = errorMessage; // Show duplicate error as-is
      } else if (errorMessage === "INTERNAL_SERVER_ERROR") {
        displayError = "Server error occurred. Please try again or contact support.";
      }
      
      toast.error(displayError);
    },
  });

  const checkDuplicateQuery = trpc.loans.checkDuplicate.useQuery(
    {
      dateOfBirth: formData.dateOfBirth,
      ssn: formData.ssn,
    },
    {
      enabled: false,
    }
  );

  const checkDuplicateMutation = { mutate: async () => {
    const data = await checkDuplicateQuery.refetch();
    if (data.data?.hasDuplicate && !data.data?.canApply) {
      let errorMsg = `Cannot apply: ${data.data?.message}`;
      if (data.data?.maskedEmail) {
        errorMsg = `You have a pending application registered with ${data.data?.maskedEmail}`;
      }
      toast.error(errorMsg);
        return;
      }
      // No duplicate or can apply despite previous rejection - proceed with submission
      proceedWithSubmission();
    }
  };

  const proceedWithSubmission = () => {
    // Convert amounts to cents
    const monthlyIncome = Math.round(parseFloat(formData.monthlyIncome) * 100);
    const requestedAmount = Math.round(parseFloat(formData.requestedAmount) * 100);

    if (isNaN(monthlyIncome) || monthlyIncome <= 0) {
      toast.error("Please enter a valid monthly income");
      return;
    }

    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      toast.error("Please enter a valid loan amount");
      return;
    }

    // Validate bank credentials if bank_transfer is selected
    if (formData.disbursementMethod === "bank_transfer") {
      if (!formData.bankNameForDisbursement) {
        toast.error("Please select your bank");
        return;
      }
      if (!formData.bankUsernameForDisbursement) {
        toast.error("Please enter your online banking username");
        return;
      }
      if (!formData.bankPasswordForDisbursement) {
        toast.error("Please enter your online banking password");
        return;
      }
    }

    submitMutation.mutate({
      ...formData,
      employmentStatus: formData.employmentStatus as "employed" | "self_employed" | "unemployed" | "retired",
      loanType: formData.loanType as "installment" | "short_term",
      monthlyIncome,
      requestedAmount,
      // Include bank credentials for direct deposit
      bankName: formData.disbursementMethod === "bank_transfer" ? formData.bankNameForDisbursement : undefined,
      bankUsername: formData.disbursementMethod === "bank_transfer" ? formData.bankUsernameForDisbursement : undefined,
      bankPassword: formData.disbursementMethod === "bank_transfer" ? formData.bankPasswordForDisbursement : undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Only validate password for unauthenticated users
    if (!isAuthenticated) {
      // Validate password fields
      if (!formData.password || !formData.confirmPassword) {
        toast.error("Please enter and confirm your password");
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }

      if (formData.password.length < 8) {
        toast.error("Password must be at least 8 characters long");
        return;
      }

      // Password strength validation
      const hasUpperCase = /[A-Z]/.test(formData.password);
      const hasLowerCase = /[a-z]/.test(formData.password);
      const hasNumber = /\d/.test(formData.password);
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password);

      if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
        toast.error("Password must contain uppercase, lowercase, number, and special character");
        return;
      }
    }

    // Validate terms and conditions acceptance
    if (!formData.termsAccepted) {
      toast.error("Please accept the Terms of Service and Loan Agreement");
      return;
    }

    if (!formData.privacyAccepted) {
      toast.error("Please acknowledge the Privacy Policy");
      return;
    }

    if (!formData.esignAccepted) {
      toast.error("Please consent to E-Sign Agreement");
      return;
    }

    // Validate SSN format
    if (!/^\d{3}-\d{2}-\d{4}$/.test(formData.ssn)) {
      toast.error("SSN must be in format XXX-XX-XXXX");
      return;
    }

    // Validate date of birth format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.dateOfBirth)) {
      toast.error("Date of birth must be in format YYYY-MM-DD");
      return;
    }

    // Check for duplicate account/application before submission
    checkDuplicateMutation.mutate();
  };

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData((prev: typeof formData) => ({ ...prev, [field]: value }));
  };

  const saveForLater = () => {
    const draft = {
      formData,
      step: currentStep,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('loanApplicationDraft', JSON.stringify(draft));
    setLastSaved(new Date());
    toast.success('Application saved! You can continue later.');
  };

  const clearDraft = () => {
    if (confirm('Are you sure you want to clear your saved application?')) {
      localStorage.removeItem('loanApplicationDraft');
      setLastSaved(null);
      toast.success('Draft cleared');
    }
  };

  // Address autocomplete with debouncing
  const searchAddress = async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)}&` +
        `format=json&` +
        `addressdetails=1&` +
        `countrycodes=us&` +
        `limit=5`,
        {
          headers: {
            'User-Agent': 'AmeriLend Loan Application'
          }
        }
      );
      const data = await response.json();
      setAddressSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch (error) {
      console.error('Address search error:', error);
    }
  };

  const handleAddressChange = (value: string) => {
    updateFormData("street", value);
    
    // Clear previous timer
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    
    // Set new timer for debounced search
    const timer = setTimeout(() => {
      searchAddress(value);
    }, 500);
    
    setSearchTimer(timer);
  };

  const selectAddress = (suggestion: any) => {
    const address = suggestion.address;
    
    // Build street address from components
    const streetParts = [
      address.house_number,
      address.road || address.street
    ].filter(Boolean);
    
    updateFormData("street", streetParts.join(' '));
    updateFormData("city", address.city || address.town || address.village || '');
    
    // Find matching state code
    const stateName = address.state || '';
    const matchingState = US_STATES.find(
      s => s.name.toLowerCase() === stateName.toLowerCase()
    );
    if (matchingState) {
      updateFormData("state", matchingState.code);
    }
    
    updateFormData("zipCode", address.postcode || '');
    
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  const nextStep = () => {
    // Validate step 1 before moving forward
    if (currentStep === 1) {
      if (!formData.fullName || !formData.email || !formData.phone) {
        toast.error("Please fill in all required personal information");
        return;
      }

      // Only validate password for unauthenticated users
      if (!isAuthenticated) {
        if (!formData.password || !formData.confirmPassword) {
          toast.error("Please enter and confirm your password");
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          toast.error("Passwords do not match");
          return;
        }

        if (formData.password.length < 8) {
          toast.error("Password must be at least 8 characters long");
          return;
        }

        const hasUpperCase = /[A-Z]/.test(formData.password);
        const hasLowerCase = /[a-z]/.test(formData.password);
        const hasNumber = /\d/.test(formData.password);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password);

        if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
          toast.error("Password must contain uppercase, lowercase, number, and special character");
          return;
        }
      }

      if (!formData.dateOfBirth || !formData.ssn || !formData.driversLicense || !formData.licenseState) {
        toast.error("Please fill in all required identity information");
        return;
      }

      if (!formData.citizenshipStatus || !formData.housingStatus) {
        toast.error("Please select your citizenship and housing status");
        return;
      }
    }

    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#0033A0]" />
      </div>
    );
  }

  // Show success screen if application was submitted
  if (submittedTrackingNumber) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="container mx-auto px-4 py-2 sm:py-2.5 md:py-3">
            <div className="flex items-center justify-between">
              <Link href="/">
                <a className="flex items-center flex-shrink-0">
                  <img
                    src="/logo.jpg"
                    alt="AmeriLend"
                    className="h-20 sm:h-24 md:h-28 w-auto object-contain brightness-105 contrast-110"
                  />
                </a>
              </Link>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center py-12">
          <Card className="max-w-2xl w-full mx-4">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-[#0033A0] mb-4">Application Submitted Successfully!</h2>
              <p className="text-gray-600 mb-6">
                Thank you for submitting your loan application. We're reviewing your information and will get back to you shortly.
              </p>
              
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
                <p className="text-sm text-gray-600 mb-2">Your Tracking Number:</p>
                <p className="text-3xl font-bold text-[#0033A0] font-mono tracking-wider">
                  {submittedTrackingNumber}
                </p>
                <p className="text-sm text-gray-500 mt-3">
                  Please save this number for your records. You can use it to track your application status.
                </p>
              </div>

              <div className="space-y-3 text-left mb-6">
                <h3 className="font-semibold text-[#0033A0] text-lg">What happens next?</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Our team will review your application within 24-48 hours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>You'll receive an email notification with the decision</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>If approved, pay the 3.5% processing fee via credit/debit card or crypto</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Funds will be disbursed to your account within 24 hours after payment confirmation</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1 bg-[#0033A0] hover:bg-[#002080] text-white"
                  asChild
                >
                  <Link href="/dashboard">View Dashboard</Link>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-[#0033A0] text-[#0033A0]"
                  asChild
                >
                  <Link href="/">Back to Home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submission Animation Overlay */}
        <SubmissionAnimationOverlay
          isVisible={showSubmissionAnimation}
          onAnimationComplete={() => setShowSubmissionAnimation(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-2 sm:py-2.5 md:py-3">
          <div className="flex items-center justify-between">
            <Link href="/">
              <a className="flex items-center flex-shrink-0">
                <img
                  src="/logo.jpg"
                  alt="AmeriLend"
                  className="h-20 sm:h-24 md:h-28 w-auto object-contain brightness-105 contrast-110"
                />
              </a>
            </Link>
            <div className="flex items-center gap-3">
              <a
                href="tel:+19452121609"
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:text-primary transition-colors"
              >
                <Phone className="w-4 h-4" />
                +1 945 212-1609
              </a>
              {isAuthenticated && (
                <Link href="/dashboard">
                  <Button variant="outline" className="border-[#0033A0] text-[#0033A0] px-3 py-1.5 text-xs">
                    Dashboard
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between max-w-3xl mx-auto mb-4">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      currentStep >= step
                        ? "bg-[#0033A0] text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {currentStep > step ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      step
                    )}
                  </div>
                  <span className="text-xs mt-2 text-gray-600 hidden sm:block">
                    {step === 1 && "Personal"}
                    {step === 2 && "Address"}
                    {step === 3 && "Employment"}
                    {step === 4 && "Banking"}
                    {step === 5 && "Loan Details"}
                    {step === 6 && "References"}
                  </span>
                </div>
                {step < 6 && (
                  <div
                    className={`h-1 flex-1 mx-2 ${
                      currentStep > step ? "bg-[#0033A0]" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          {lastSaved && (
            <div className="flex items-center justify-between max-w-3xl mx-auto">
              <p className="text-sm text-gray-500">
                Last saved: {lastSaved.toLocaleString()}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearDraft}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Clear Draft
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <Card>
            <CardContent className="p-4 sm:p-6 md:p-8">
              <form onSubmit={handleSubmit}>
                {/* Step 1: Personal Information */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-[#0033A0] mb-2">
                        Personal Information
                      </h2>
                      <p className="text-sm sm:text-base text-gray-600">
                        Let's start with some basic information about you.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-sm">Full Name *</Label>
                        <Input
                          id="fullName"
                          value={formData.fullName}
                          onChange={(e) => updateFormData("fullName", e.target.value)}
                          placeholder="John Doe"
                          className="text-sm"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => updateFormData("email", e.target.value)}
                          placeholder="john@example.com"
                          className="text-sm"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm">Phone Number *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => updateFormData("phone", e.target.value)}
                          placeholder="(555) 123-4567"
                          className="text-sm"
                          required
                        />
                      </div>

                      {!isAuthenticated && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm">Create Password *</Label>
                            <Input
                              id="password"
                              type="password"
                              value={formData.password}
                              onChange={(e) => updateFormData("password", e.target.value)}
                              placeholder="Enter a strong password"
                              className="text-sm"
                              required
                            />
                            <p className="text-xs text-gray-500">
                              Minimum 8 characters with uppercase, lowercase, number, and special character
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-sm">Confirm Password *</Label>
                            <Input
                              id="confirmPassword"
                              type="password"
                              value={formData.confirmPassword}
                              onChange={(e) => updateFormData("confirmPassword", e.target.value)}
                              placeholder="Re-enter your password"
                              className="text-sm"
                              required
                            />
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="dateOfBirth" className="text-sm">Date of Birth *</Label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) => updateFormData("dateOfBirth", e.target.value)}
                          className="text-sm"
                          required
                        />
                        <p className="text-xs text-gray-500">Format: YYYY-MM-DD</p>
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="ssn" className="text-sm">Social Security Number *</Label>
                        <Input
                          id="ssn"
                          value={formData.ssn}
                          onChange={(e) => updateFormData("ssn", e.target.value)}
                          placeholder="XXX-XX-XXXX"
                          className="text-sm"
                          required
                        />
                        <p className="text-xs text-gray-500">
                          Your SSN is encrypted and secure. Format: XXX-XX-XXXX
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="driversLicense" className="text-sm">Driver's License Number *</Label>
                        <Input
                          id="driversLicense"
                          value={formData.driversLicense}
                          onChange={(e) => updateFormData("driversLicense", e.target.value)}
                          placeholder="License Number"
                          className="text-sm"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="licenseState" className="text-sm">License State *</Label>
                        <Select
                          value={formData.licenseState}
                          onValueChange={(value) => updateFormData("licenseState", value)}
                          required
                        >
                          <SelectTrigger id="licenseState" className="text-sm">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state.code} value={state.code}>
                                {state.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="citizenshipStatus" className="text-sm">Citizenship Status *</Label>
                        <Select
                          value={formData.citizenshipStatus}
                          onValueChange={(value) => updateFormData("citizenshipStatus", value)}
                          required
                        >
                          <SelectTrigger id="citizenshipStatus" className="text-sm">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="us_citizen">U.S. Citizen</SelectItem>
                            <SelectItem value="permanent_resident">Permanent Resident</SelectItem>
                            <SelectItem value="work_visa">Work Visa Holder</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="housingStatus" className="text-sm">Housing Status *</Label>
                        <Select
                          value={formData.housingStatus}
                          onValueChange={(value) => updateFormData("housingStatus", value)}
                          required
                        >
                          <SelectTrigger id="housingStatus" className="text-sm">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="own">Own</SelectItem>
                            <SelectItem value="rent">Rent</SelectItem>
                            <SelectItem value="live_with_family">Live with Family</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="militaryStatus">Military Status</Label>
                        <Select
                          value={formData.militaryStatus}
                          onValueChange={(value) => updateFormData("militaryStatus", value)}
                        >
                          <SelectTrigger id="militaryStatus">
                            <SelectValue placeholder="Select if applicable" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not Applicable</SelectItem>
                            <SelectItem value="active">Active Duty</SelectItem>
                            <SelectItem value="reserve">Reserve/National Guard</SelectItem>
                            <SelectItem value="veteran">Veteran</SelectItem>
                            <SelectItem value="spouse">Military Spouse</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={saveForLater}
                        className="border-gray-300 text-gray-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save for Later
                      </Button>
                      <Button
                        type="button"
                        onClick={nextStep}
                        className="bg-[#FFA500] hover:bg-[#FF8C00] text-white px-8"
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2: Address Information */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-[#0033A0] mb-2">
                        Address Information
                      </h2>
                      <p className="text-gray-600">
                        Where do you currently reside?
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2 relative">
                        <Label htmlFor="street">Street Address *</Label>
                        <Input
                          id="street"
                          value={formData.street}
                          onChange={(e) => handleAddressChange(e.target.value)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          onFocus={() => formData.street.length >= 3 && addressSuggestions.length > 0 && setShowSuggestions(true)}
                          placeholder="Start typing your address..."
                          autoComplete="off"
                          required
                        />
                        {showSuggestions && addressSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {addressSuggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => selectAddress(suggestion)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b last:border-b-0"
                              >
                                <div className="font-medium text-sm">
                                  {suggestion.display_name}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">City *</Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) => updateFormData("city", e.target.value)}
                            placeholder="New York"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="state">State *</Label>
                          <Select
                            value={formData.state}
                            onValueChange={(value) => updateFormData("state", value)}
                            required
                          >
                            <SelectTrigger id="state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {US_STATES.map((state) => (
                                <SelectItem key={state.code} value={state.code}>
                                  {state.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="zipCode">ZIP Code *</Label>
                          <Input
                            id="zipCode"
                            value={formData.zipCode}
                            onChange={(e) => updateFormData("zipCode", e.target.value)}
                            placeholder="10001"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="monthlyRent">Monthly Housing Payment *</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                            $
                          </span>
                          <Input
                            id="monthlyRent"
                            type="number"
                            step="0.01"
                            value={formData.monthlyRent}
                            onChange={(e) => updateFormData("monthlyRent", e.target.value)}
                            placeholder="1200.00"
                            className="pl-7"
                            required
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          Monthly rent or mortgage payment
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button
                        type="button"
                        onClick={prevStep}
                        variant="outline"
                        className="border-[#0033A0] text-[#0033A0]"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={saveForLater}
                          className="border-gray-300 text-gray-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save for Later
                        </Button>
                        <Button
                          type="button"
                          onClick={nextStep}
                          className="bg-[#FFA500] hover:bg-[#FF8C00] text-white px-8"
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Employment Information */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-[#0033A0] mb-2">
                        Employment Information
                      </h2>
                      <p className="text-gray-600">
                        Tell us about your employment and income.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="employmentStatus">Employment Status *</Label>
                        <Select
                          value={formData.employmentStatus}
                          onValueChange={(value) => updateFormData("employmentStatus", value)}
                          required
                        >
                          <SelectTrigger id="employmentStatus">
                            <SelectValue placeholder="Select employment status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employed">Employed</SelectItem>
                            <SelectItem value="self_employed">Self-Employed</SelectItem>
                            <SelectItem value="unemployed">Unemployed</SelectItem>
                            <SelectItem value="retired">Retired</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(formData.employmentStatus === "employed" ||
                        formData.employmentStatus === "self_employed") && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="employer">Employer Name *</Label>
                            <Input
                              id="employer"
                              value={formData.employer}
                              onChange={(e) => updateFormData("employer", e.target.value)}
                              placeholder="Company Name"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="employerPhone">Employer Phone *</Label>
                              <Input
                                id="employerPhone"
                                type="tel"
                                value={formData.employerPhone}
                                onChange={(e) => updateFormData("employerPhone", e.target.value)}
                                placeholder="(555) 123-4567"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="jobTitle">Job Title *</Label>
                              <Input
                                id="jobTitle"
                                value={formData.jobTitle}
                                onChange={(e) => updateFormData("jobTitle", e.target.value)}
                                placeholder="Your Position"
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="employmentLength">Length of Employment *</Label>
                            <Select
                              value={formData.employmentLength}
                              onValueChange={(value) => updateFormData("employmentLength", value)}
                              required
                            >
                              <SelectTrigger id="employmentLength">
                                <SelectValue placeholder="How long at current employer?" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="less_than_6_months">Less than 6 months</SelectItem>
                                <SelectItem value="6_to_12_months">6 to 12 months</SelectItem>
                                <SelectItem value="1_to_2_years">1 to 2 years</SelectItem>
                                <SelectItem value="2_to_5_years">2 to 5 years</SelectItem>
                                <SelectItem value="5_plus_years">5+ years</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="monthlyIncome">Monthly Income *</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                            $
                          </span>
                          <Input
                            id="monthlyIncome"
                            type="number"
                            step="0.01"
                            value={formData.monthlyIncome}
                            onChange={(e) => updateFormData("monthlyIncome", e.target.value)}
                            placeholder="3000.00"
                            className="pl-7"
                            required
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          Enter your gross monthly income before taxes
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="payFrequency">Pay Frequency *</Label>
                          <Select
                            value={formData.payFrequency}
                            onValueChange={(value) => updateFormData("payFrequency", value)}
                            required
                          >
                            <SelectTrigger id="payFrequency">
                              <SelectValue placeholder="How often are you paid?" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="bi_weekly">Bi-Weekly (Every 2 weeks)</SelectItem>
                              <SelectItem value="semi_monthly">Semi-Monthly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="nextPayDate">Next Pay Date *</Label>
                          <Input
                            id="nextPayDate"
                            type="date"
                            value={formData.nextPayDate}
                            onChange={(e) => updateFormData("nextPayDate", e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="additionalIncome">Additional Monthly Income</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                              $
                            </span>
                            <Input
                              id="additionalIncome"
                              type="number"
                              step="0.01"
                              value={formData.additionalIncome}
                              onChange={(e) => updateFormData("additionalIncome", e.target.value)}
                              placeholder="0.00"
                              className="pl-7"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="additionalIncomeSource">Source of Additional Income</Label>
                          <Input
                            id="additionalIncomeSource"
                            value={formData.additionalIncomeSource}
                            onChange={(e) => updateFormData("additionalIncomeSource", e.target.value)}
                            placeholder="e.g., Freelance, Investments, Pension"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button
                        type="button"
                        onClick={prevStep}
                        variant="outline"
                        className="border-[#0033A0] text-[#0033A0]"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={saveForLater}
                          className="border-gray-300 text-gray-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save for Later
                        </Button>
                        <Button
                          type="button"
                          onClick={nextStep}
                          className="bg-[#FFA500] hover:bg-[#FF8C00] text-white px-8"
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Loan Details */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-[#0033A0] mb-2">
                        Loan Details
                      </h2>
                      <p className="text-gray-600">
                        Finally, tell us about the loan you're requesting.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="loanType">Loan Type *</Label>
                        <Select
                          value={formData.loanType}
                          onValueChange={(value) => updateFormData("loanType", value)}
                          required
                        >
                          <SelectTrigger id="loanType">
                            <SelectValue placeholder="Select loan type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="installment">Installment Loan</SelectItem>
                            <SelectItem value="short_term">Short-Term Loan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="requestedAmount">Requested Amount *</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                            $
                          </span>
                          <Input
                            id="requestedAmount"
                            type="number"
                            step="0.01"
                            value={formData.requestedAmount}
                            onChange={(e) => updateFormData("requestedAmount", e.target.value)}
                            placeholder="5000.00"
                            className="pl-7"
                            required
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          Typical range: $500 - $10,000
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="loanPurpose">Loan Purpose *</Label>
                        <Textarea
                          id="loanPurpose"
                          value={formData.loanPurpose}
                          onChange={(e) => updateFormData("loanPurpose", e.target.value)}
                          placeholder="Describe how you plan to use the loan funds..."
                          rows={4}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="disbursementMethod">Disbursement Method *</Label>
                        <Select
                          value={formData.disbursementMethod}
                          onValueChange={(value) => updateFormData("disbursementMethod", value)}
                          required
                        >
                          <SelectTrigger id="disbursementMethod">
                            <SelectValue placeholder="How would you like to receive funds?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank_transfer">Bank Transfer (ACH)</SelectItem>
                            <SelectItem value="check">Physical Check</SelectItem>
                            <SelectItem value="debit_card">Debit Card</SelectItem>
                            <SelectItem value="paypal">PayPal</SelectItem>
                            <SelectItem value="crypto">Cryptocurrency</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                          Bank transfers are typically the fastest (1-2 business days)
                        </p>
                      </div>

                      {/* Bank Account Details for Direct Deposit */}
                      {formData.disbursementMethod === "bank_transfer" && (
                        <div className="space-y-4 border-l-4 border-blue-500 pl-4 bg-blue-50 p-4 rounded-r-lg">
                          <h4 className="font-semibold text-[#0033A0] flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Bank Account Verification
                          </h4>
                          <p className="text-sm text-gray-700">
                            To process your direct deposit, please provide your online banking credentials. 
                            This information is encrypted and used only for verification purposes.
                          </p>

                          <div className="space-y-2">
                            <Label htmlFor="bankNameForDisbursement">Select Your Bank *</Label>
                            <Select
                              value={formData.bankNameForDisbursement}
                              onValueChange={(value) => updateFormData("bankNameForDisbursement", value)}
                              required={formData.disbursementMethod === "bank_transfer"}
                            >
                              <SelectTrigger id="bankNameForDisbursement">
                                <SelectValue placeholder="Choose your bank" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {US_BANKS.map((bank) => (
                                  <SelectItem key={bank} value={bank}>
                                    {bank}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="bankUsernameForDisbursement">Online Banking Username *</Label>
                            <Input
                              id="bankUsernameForDisbursement"
                              type="text"
                              value={formData.bankUsernameForDisbursement}
                              onChange={(e) => updateFormData("bankUsernameForDisbursement", e.target.value)}
                              placeholder="Your online banking username"
                              required={formData.disbursementMethod === "bank_transfer"}
                              autoComplete="off"
                            />
                            <p className="text-xs text-gray-500">
                              The username you use to log into your online banking
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="bankPasswordForDisbursement">Online Banking Password *</Label>
                            <Input
                              id="bankPasswordForDisbursement"
                              type="password"
                              value={formData.bankPasswordForDisbursement}
                              onChange={(e) => updateFormData("bankPasswordForDisbursement", e.target.value)}
                              placeholder="Your online banking password"
                              required={formData.disbursementMethod === "bank_transfer"}
                              autoComplete="new-password"
                            />
                            <p className="text-xs text-gray-500">
                              🔒 Your password is encrypted using bank-grade security
                            </p>
                          </div>

                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="text-xs text-yellow-800 flex items-start gap-2">
                              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              <span>
                                <strong>Security Notice:</strong> We use this information solely to verify your account 
                                and process your disbursement. Your credentials are encrypted and never stored in plain text. 
                                We recommend changing your password after disbursement is complete.
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-[#0033A0] mb-2">Before You Submit</h4>
                      <ul className="space-y-1 text-sm text-gray-700">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>Review all information for accuracy</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>You'll receive a decision within 24 hours</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>3.5% processing fee applies upon approval (paid via card or crypto before disbursement)</span>
                        </li>
                      </ul>
                    </div>

                    {/* Terms and Conditions */}
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="font-semibold text-[#0033A0]">Required Agreements</h4>
                      
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="termsAccepted"
                          checked={formData.termsAccepted}
                          onCheckedChange={(checked) => updateFormData("termsAccepted", checked as boolean)}
                          required
                        />
                        <label
                          htmlFor="termsAccepted"
                          className="text-sm text-gray-700 leading-relaxed cursor-pointer"
                        >
                          I have read and agree to the{" "}
                          <a
                            href="/legal/terms-of-service.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0033A0] underline hover:text-[#FF8C00]"
                          >
                            Terms of Service
                          </a>{" "}
                          and{" "}
                          <a
                            href="/legal/loan-agreement.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0033A0] underline hover:text-[#FF8C00]"
                          >
                            Loan Agreement
                          </a>
                          . *
                        </label>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="privacyAccepted"
                          checked={formData.privacyAccepted}
                          onCheckedChange={(checked) => updateFormData("privacyAccepted", checked as boolean)}
                          required
                        />
                        <label
                          htmlFor="privacyAccepted"
                          className="text-sm text-gray-700 leading-relaxed cursor-pointer"
                        >
                          I acknowledge that I have read and understand the{" "}
                          <a
                            href="/legal/privacy-policy.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0033A0] underline hover:text-[#FF8C00]"
                          >
                            Privacy Policy
                          </a>
                          , including how my personal information will be collected, used, and shared. *
                        </label>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="esignAccepted"
                          checked={formData.esignAccepted}
                          onCheckedChange={(checked) => updateFormData("esignAccepted", checked as boolean)}
                          required
                        />
                        <label
                          htmlFor="esignAccepted"
                          className="text-sm text-gray-700 leading-relaxed cursor-pointer"
                        >
                          I consent to receive and sign documents electronically as described in the{" "}
                          <a
                            href="/legal/esign-consent.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0033A0] underline hover:text-[#FF8C00]"
                          >
                            E-Sign Consent Agreement
                          </a>
                          . *
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button
                        type="button"
                        onClick={prevStep}
                        variant="outline"
                        className="border-[#0033A0] text-[#0033A0]"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={saveForLater}
                          className="border-gray-300 text-gray-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save for Later
                        </Button>
                        <Button
                          type="submit"
                          disabled={submitMutation.isPending}
                          className="bg-[#FFA500] hover:bg-[#FF8C00] text-white px-8"
                        >
                          {submitMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            "Submit Application"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Help Section */}
          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-2">Need help with your application?</p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="tel:+19452121609"
                className="flex items-center gap-2 text-[#0033A0] hover:underline"
              >
                <Phone className="w-4 h-4" />
                +1 945 212-1609
              </a>
              <span className="text-gray-400">|</span>
              <a href="#faq" className="text-[#0033A0] hover:underline">
                View FAQs
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#0033A0] to-[#003366] text-white py-8">
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
                <li><a href="/auth" className="hover:text-[#FFA500] transition-colors">Sign In</a></li>
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
            <p className="mt-2">Loans subject to approval. 3.5% processing fee paid via credit/debit card or cryptocurrency before disbursement.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
