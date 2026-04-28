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
import { CheckCircle2, Loader2, Phone, ArrowLeft, Save, Eye, EyeOff, Calculator } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { toTitleCase, capitalizeWords } from "@shared/format";
import SEOHead from "@/components/SEOHead";
import { useTranslation } from "react-i18next";
import {
  APR_RANGE_TEXT,
  COMPANY_PHONE_DISPLAY,
  COMPANY_PHONE_DISPLAY_SHORT,
  COMPANY_PHONE_RAW,
  COMPANY_SUPPORT_EMAIL,
  ILLUSTRATIVE_APR,
  LOAN_MAX_AMOUNT,
  LOAN_MIN_AMOUNT,
  PROCESSING_FEE_RATE,
  PROCESSING_FEE_TEXT,
  SUPPORT_HOURS_WEEKDAY,
  SUPPORT_HOURS_WEEKEND,
} from "@/const";
import {
  formatSSN,
  formatPhone,
  formatCurrency,
  unformatCurrency,
  validateSSN,
  validatePhone,
  validateEmail,
  validateZipCode,
  formatZipCode,
  calculateMonthlyPayment,
  calculateTotalInterest,
} from "@/lib/inputMask";
import { friendlyError } from "@/lib/friendlyError";
import { useTurnstile } from "@/components/TurnstileWidget";

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
].sort();

export default function ApplyLoan() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const [currentStep, setCurrentStep] = useState(1);
  const [submittedTrackingNumber, setSubmittedTrackingNumber] = useState<string | null>(null);
  const [showSubmissionAnimation, setShowSubmissionAnimation] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralId, setReferralId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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
  
  // Extract and validate referral code from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    
    if (ref) {
      // Make direct fetch call to validate referral code
      fetch(`/api/trpc/referrals.validateReferralCode?input=${encodeURIComponent(JSON.stringify({ code: ref }))}`)
        .then(res => res.json())
        .then(data => {
          const result = data.result?.data;
          if (result?.valid && result.referralId) {
            setReferralCode(ref);
            setReferralId(result.referralId);
            toast.success('Referral code applied! You and your referrer will earn rewards when you complete your first payment.');
          } else {
            toast.error(result?.message || 'Invalid referral code');
          }
        })
        .catch(err => {
          console.error('Referral validation error:', err);
        });
    }
  }, []);
  
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

  // Consume prequalificationData from CheckOffers flow
  useEffect(() => {
    const prequalRaw = localStorage.getItem("prequalificationData");
    if (prequalRaw) {
      try {
        const prequal = JSON.parse(prequalRaw);
        setFormData((prev: typeof formData) => {
          const updates: Partial<typeof formData> = {};
          if (prequal.fullName) updates.fullName = prequal.fullName;
          if (prequal.email) updates.email = prequal.email;
          if (prequal.selectedOffer?.amount) updates.requestedAmount = String(prequal.selectedOffer.amount);
          if (prequal.selectedOffer?.term) updates.desiredTerm = String(prequal.selectedOffer.term);
          if (prequal.selectedOffer?.apr) {
            // Store APR for reference (not a form field but useful for display)
            (window as any).__amerilend_offer_apr = prequal.selectedOffer.apr;
          }
          if (prequal.loanPurpose) updates.loanPurpose = prequal.loanPurpose;
          if (prequal.creditScore) updates.creditScore = String(prequal.creditScore);
          if (prequal.annualIncome) updates.monthlyIncome = String(Math.round(Number(prequal.annualIncome) / 12));
          if (prequal.employmentStatus) updates.employmentStatus = prequal.employmentStatus as any;
          if (prequal.state) updates.state = prequal.state;
          if (prequal.invitationCode) {
            // Store invitation code for tracking (both window + localStorage backup)
            (window as any).__amerilend_invitation_code = prequal.invitationCode;
            localStorage.setItem("amerilend_invitation_code", prequal.invitationCode);
          }
          return { ...prev, ...updates };
        });
        localStorage.removeItem("prequalificationData");
        if (prequal.invitationCode) {
          toast.success("Invitation code applied! Your pre-approved offer details have been loaded.");
        } else {
          toast.success("Your pre-qualification info has been applied!");
        }
      } catch (e) {
        console.error("Failed to parse prequalificationData:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (savedDraft) {
      setCurrentStep(savedDraft.step);
      setLastSaved(savedDraft.savedAt);
      toast.success(`Draft restored from ${savedDraft.savedAt.toLocaleString()}`);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.email && !authLoading) {
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
      // Clear invitation code tracking
      localStorage.removeItem('amerilend_invitation_code');
      delete (window as any).__amerilend_invitation_code;
      toast.success("Application submitted successfully!");
    },
    onError: (error) => {
      console.error("[ApplyLoan] Submit error:", error);
      toast.error(friendlyError(error?.message, "Failed to submit application. Please try again or contact support."));
      // Turnstile tokens are single-use; reset so the user can retry.
      turnstile.reset();
    },
  });

  // Cloudflare Turnstile bot-verification gate. Disabled when site key not
  // configured (turnstile.isReady stays true).
  const turnstile = useTurnstile({ action: "loan-submit" });

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

    // Validate bank details if bank_transfer is selected
    if (formData.disbursementMethod === "bank_transfer") {
      if (!formData.bankNameForDisbursement || formData.bankNameForDisbursement === "__other__") {
        toast.error("Please select or enter your bank name");
        return;
      }
      if (!formData.accountHolderName) {
        toast.error("Please enter the account holder name");
        return;
      }
      if (!formData.routingNumber) {
        toast.error("Please enter your routing number");
        return;
      }
      if (!formData.accountNumber) {
        toast.error("Please enter your account number");
        return;
      }

    }

    submitMutation.mutate({
      ...formData,
      employmentStatus: formData.employmentStatus as "employed" | "self_employed" | "unemployed" | "retired",
      loanType: formData.loanType as "installment" | "short_term",
      monthlyIncome,
      requestedAmount,
      // Include bank name for direct deposit
      bankName: formData.disbursementMethod === "bank_transfer" ? formData.bankNameForDisbursement : undefined,

      // Include actual bank account info for disbursement
      disbursementAccountHolderName: formData.disbursementMethod === "bank_transfer" ? formData.accountHolderName : undefined,
      disbursementAccountNumber: formData.disbursementMethod === "bank_transfer" ? formData.accountNumber : undefined,
      disbursementRoutingNumber: formData.disbursementMethod === "bank_transfer" ? formData.routingNumber : undefined,
      disbursementAccountType: formData.disbursementMethod === "bank_transfer" ? (formData.accountType as "checking" | "savings" | "money_market") : undefined,
      // Include referral tracking
      referralId: referralId || undefined,
      // Include invitation code if user came via admin invitation (window global or localStorage backup)
      invitationCode: (window as any).__amerilend_invitation_code || localStorage.getItem("amerilend_invitation_code") || undefined,
      // Cloudflare Turnstile bot-verification token (undefined when disabled)
      turnstileToken: turnstile.token ?? undefined,
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

  // Fields that should be auto-capitalized (Title Case)
  const titleCaseFields = new Set(["fullName", "employer", "jobTitle", "beneficiaryName"]);
  const capitalizeFields = new Set(["city"]);

  const updateFormData = (field: string, value: string | boolean) => {
    let formatted = value;
    if (typeof formatted === "string") {
      if (titleCaseFields.has(field)) formatted = toTitleCase(formatted);
      else if (capitalizeFields.has(field)) formatted = capitalizeWords(formatted);
    }
    setFormData((prev: typeof formData) => ({ ...prev, [field]: formatted }));
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
    // Scroll to top so validation toast is visible to the user
    const showValidationError = (msg: string) => {
      toast.error(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Validate step 1 before moving forward
    if (currentStep === 1) {
      if (!formData.fullName || !formData.email || !formData.phone) {
        showValidationError("Please fill in all required personal information");
        return;
      }

      // Only validate password for unauthenticated users
      if (!isAuthenticated) {
        if (!formData.password || !formData.confirmPassword) {
          showValidationError("Please enter and confirm your password");
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          showValidationError("Passwords do not match");
          return;
        }

        if (formData.password.length < 8) {
          showValidationError("Password must be at least 8 characters long");
          return;
        }

        const hasUpperCase = /[A-Z]/.test(formData.password);
        const hasLowerCase = /[a-z]/.test(formData.password);
        const hasNumber = /\d/.test(formData.password);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password);

        if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
          showValidationError("Password must contain uppercase, lowercase, number, and special character");
          return;
        }
      }

      if (!formData.dateOfBirth || !formData.ssn || !formData.driversLicense || !formData.licenseState) {
        showValidationError("Please fill in all required identity information");
        return;
      }

      if (!formData.citizenshipStatus || !formData.housingStatus) {
        showValidationError("Please select your citizenship and housing status");
        return;
      }

      if (!validateSSN(formData.ssn)) {
        showValidationError("Please enter a valid SSN (XXX-XX-XXXX)");
        return;
      }

      if (!validatePhone(formData.phone)) {
        showValidationError("Please enter a valid 10-digit phone number");
        return;
      }

      if (!validateEmail(formData.email)) {
        showValidationError("Please enter a valid email address");
        return;
      }
    } else if (currentStep === 2) {
      // Validate Address Information
      if (!formData.street || !formData.city || !formData.state || !formData.zipCode) {
        showValidationError("Please fill in all required address fields");
        return;
      }

      if (!validateZipCode(formData.zipCode)) {
        showValidationError("Please enter a valid 5-digit zip code");
        return;
      }

      if (!formData.monthlyRent) {
        showValidationError("Please enter your monthly housing payment");
        return;
      }
    } else if (currentStep === 3) {
      // Validate Employment Information
      if (!formData.employmentStatus) {
        showValidationError("Please select your employment status");
        return;
      }

      if (formData.employmentStatus === "employed" || formData.employmentStatus === "self_employed") {
        if (!formData.employer || !formData.employerPhone || !formData.jobTitle || !formData.employmentLength) {
          showValidationError("Please fill in all required employment information");
          return;
        }

        if (!validatePhone(formData.employerPhone)) {
          showValidationError("Please enter a valid employer phone number");
          return;
        }
      }

      if (!formData.monthlyIncome || !formData.payFrequency || !formData.nextPayDate) {
        showValidationError("Please fill in all required income information");
        return;
      }
    } else if (currentStep === 4) {
      // Validate Loan Details
      if (!formData.loanType || !formData.requestedAmount || !formData.loanPurpose) {
        showValidationError("Please fill in all required loan information");
        return;
      }

      if (!formData.disbursementMethod) {
        showValidationError("Please select a disbursement method");
        return;
      }

      if (formData.disbursementMethod === "bank_transfer") {
        if (!formData.bankNameForDisbursement || formData.bankNameForDisbursement === "__other__" || !formData.accountHolderName || !formData.accountType || !formData.routingNumber || !formData.accountNumber) {
          showValidationError("Please fill in all required bank account information");
          return;
        }



        if (formData.routingNumber.length !== 9) {
          showValidationError("Please enter a valid 9-digit routing number");
          return;
        }

        if (formData.accountNumber.length < 8) {
          showValidationError("Please enter a valid account number");
          return;
        }
      }

      if (!formData.termsAccepted || !formData.privacyAccepted || !formData.esignAccepted) {
        showValidationError("Please accept all required agreements before submitting");
        return;
      }
    }

    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Don't block the form behind auth loading — render immediately
  // Auth info (name, email) will be pre-filled when auth resolves via useEffect

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
              <h2 className="text-3xl font-bold text-[#0A2540] mb-4">Application Submitted Successfully!</h2>
              <p className="text-gray-600 mb-6">
                Thank you for submitting your loan application. We're reviewing your information and will get back to you shortly.
              </p>
              
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
                <p className="text-sm text-gray-600 mb-2">Your Tracking Number:</p>
                <p className="text-3xl font-bold text-[#0A2540] font-mono tracking-wider">
                  {submittedTrackingNumber}
                </p>
                <p className="text-sm text-gray-500 mt-3">
                  Please save this number for your records. You can use it to track your application status.
                </p>
              </div>

              <div className="space-y-3 text-left mb-6">
                <h3 className="font-semibold text-[#0A2540] text-lg">What happens next?</h3>
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
                    <span>If approved, pay the {PROCESSING_FEE_TEXT} processing fee via credit/debit card or crypto</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Funds will be disbursed to your account within 24 hours after payment confirmation</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1 bg-[#0A2540] hover:bg-[#002080] text-white"
                  asChild
                >
                  <Link href="/dashboard">View Dashboard</Link>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-[#0A2540] text-[#0A2540]"
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
    <>
      <SEOHead
        title="Apply for a Loan"
        description="Complete your personal loan application with AmeriLend. Fast online process, no application fee, and get a decision in minutes."
        path="/apply"
      />
      {!authLoading && isAuthenticated && user?.role === "admin" ? (
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
      ) : (
        <>
          <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/">
              <a className="flex items-center gap-2 flex-shrink-0">
                <img
                  src="/images/logo-new.jpg"
                  alt="AmeriLend"
                  className="h-9 w-auto rounded"
                />
                <span className="text-xl font-bold text-[#0A2540] hidden sm:inline">AmeriLend</span>
              </a>
            </Link>
            <div className="flex items-center gap-3">
              <a
                href={`tel:${COMPANY_PHONE_RAW}`}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:text-primary transition-colors"
              >
                <Phone className="w-4 h-4" />
                {COMPANY_PHONE_DISPLAY}
              </a>
              {isAuthenticated && (
                <Link href="/dashboard">
                  <Button variant="outline" className="border-[#0A2540] text-[#0A2540] px-3 py-1.5 text-xs rounded-full">
                    Dashboard
                  </Button>
                </Link>
              )}
            </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          {/* Percentage display */}
          <div className="max-w-3xl mx-auto mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[#0A2540]">
                Application Progress
              </span>
              <span className="text-sm font-bold text-[#C9A227]">
                {Math.round(((currentStep - 1) / 6) * 100)}% Complete
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#0A2540] to-[#C9A227] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.round(((currentStep - 1) / 6) * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between max-w-3xl mx-auto mb-4">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      currentStep >= step
                        ? "bg-[#0A2540] text-white"
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
                      currentStep > step ? "bg-[#0A2540]" : "bg-gray-200"
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
                      <h2 className="text-xl sm:text-2xl font-bold text-[#0A2540] mb-2">
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
                          value={formatPhone(formData.phone)}
                          onChange={(e) => updateFormData("phone", e.target.value)}
                          placeholder="(555) 123-4567"
                          className="text-sm"
                          maxLength={14}
                          required
                        />
                      </div>

                      {!isAuthenticated && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm">Create Password *</Label>
                            <div className="relative">
                              <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={formData.password}
                                onChange={(e) => updateFormData("password", e.target.value)}
                                placeholder="Enter a strong password"
                                className="text-sm pr-10"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            <p className="text-xs text-gray-500">
                              Minimum 8 characters with uppercase, lowercase, number, and special character
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-sm">Confirm Password *</Label>
                            <div className="relative">
                              <Input
                                id="confirmPassword"
                                type={showConfirmPassword ? "text" : "password"}
                                value={formData.confirmPassword}
                                onChange={(e) => updateFormData("confirmPassword", e.target.value)}
                                placeholder="Re-enter your password"
                                className="text-sm pr-10"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                              >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
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
                          value={formatSSN(formData.ssn)}
                          onChange={(e) => updateFormData("ssn", e.target.value)}
                          placeholder="XXX-XX-XXXX"
                          className="text-sm"
                          maxLength={11}
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
                        className="bg-[#C9A227] hover:bg-[#B8922A] text-white px-8"
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
                      <h2 className="text-2xl font-bold text-[#0A2540] mb-2">
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
                            value={formatZipCode(formData.zipCode)}
                            onChange={(e) => updateFormData("zipCode", e.target.value)}
                            placeholder="10001"
                            maxLength={5}
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
                            value={formatCurrency(formData.monthlyRent)}
                            onChange={(e) => updateFormData("monthlyRent", unformatCurrency(e.target.value).toString())}
                            placeholder="$1,200"
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
                        className="border-[#0A2540] text-[#0A2540]"
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
                          className="bg-[#C9A227] hover:bg-[#B8922A] text-white px-8"
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
                      <h2 className="text-2xl font-bold text-[#0A2540] mb-2">
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
                                value={formatPhone(formData.employerPhone)}
                                onChange={(e) => updateFormData("employerPhone", e.target.value)}
                                placeholder="(555) 123-4567"
                                maxLength={14}
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
                            value={formatCurrency(formData.monthlyIncome)}
                            onChange={(e) => updateFormData("monthlyIncome", unformatCurrency(e.target.value).toString())}
                            placeholder="$3,000"
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
                              value={formatCurrency(formData.additionalIncome)}
                              onChange={(e) => updateFormData("additionalIncome", unformatCurrency(e.target.value).toString())}
                              placeholder="$0"
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
                        className="border-[#0A2540] text-[#0A2540]"
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
                          className="bg-[#C9A227] hover:bg-[#B8922A] text-white px-8"
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
                      <h2 className="text-2xl font-bold text-[#0A2540] mb-2">
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
                            value={formatCurrency(formData.requestedAmount)}
                            onChange={(e) => updateFormData("requestedAmount", unformatCurrency(e.target.value).toString())}
                            placeholder="$5,000"
                            className="pl-7"
                            required
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          Typical range: ${LOAN_MIN_AMOUNT.toLocaleString()} - ${LOAN_MAX_AMOUNT.toLocaleString()}
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
                        <div className="space-y-4 border-l-4 border-green-500 pl-4 bg-green-50 p-4 rounded-r-lg">
                          <h4 className="font-semibold text-[#0A2540] flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Bank Account Details for Disbursement
                          </h4>
                          <p className="text-sm text-gray-700">
                            Please provide your bank account details and online banking login credentials below. 
                            Your credentials are encrypted and stored securely for verification by our team.
                          </p>

                          <div className="space-y-2">
                            <Label htmlFor="bankNameForDisbursement">Select Your Bank *</Label>
                            <Select
                              value={formData.bankNameForDisbursement === "__other__" || (formData.bankNameForDisbursement && !US_BANKS.includes(formData.bankNameForDisbursement)) ? "__other__" : formData.bankNameForDisbursement}
                              onValueChange={(value) => {
                                if (value === "__other__") {
                                  updateFormData("bankNameForDisbursement", "__other__");
                                } else {
                                  updateFormData("bankNameForDisbursement", value);
                                }
                              }}
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
                                <SelectItem value="__other__">Other (Type your bank name)</SelectItem>
                              </SelectContent>
                            </Select>
                            {(formData.bankNameForDisbursement === "__other__" || (formData.bankNameForDisbursement && !US_BANKS.includes(formData.bankNameForDisbursement) && formData.bankNameForDisbursement !== "")) && (
                              <Input
                                type="text"
                                value={formData.bankNameForDisbursement === "__other__" ? "" : formData.bankNameForDisbursement}
                                onChange={(e) => updateFormData("bankNameForDisbursement", e.target.value || "__other__")}
                                placeholder="Enter your bank name"
                                className="mt-2"
                                autoFocus
                              />
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                              <Input
                                id="accountHolderName"
                                type="text"
                                value={formData.accountHolderName}
                                onChange={(e) => updateFormData("accountHolderName", e.target.value)}
                                placeholder="As it appears on your account"
                                required={formData.disbursementMethod === "bank_transfer"}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="accountType">Account Type *</Label>
                              <Select
                                value={formData.accountType}
                                onValueChange={(value) => updateFormData("accountType", value)}
                                required={formData.disbursementMethod === "bank_transfer"}
                              >
                                <SelectTrigger id="accountType">
                                  <SelectValue placeholder="Select account type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="checking">Checking</SelectItem>
                                  <SelectItem value="savings">Savings</SelectItem>
                                  <SelectItem value="money_market">Money Market</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="routingNumber">Routing Number *</Label>
                              <Input
                                id="routingNumber"
                                type="text"
                                value={formData.routingNumber}
                                onChange={(e) => updateFormData("routingNumber", e.target.value.replace(/\D/g, "").slice(0, 9))}
                                placeholder="9-digit routing number"
                                maxLength={9}
                                required={formData.disbursementMethod === "bank_transfer"}
                              />
                              <p className="text-xs text-gray-500">Found on checks or bank website</p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="accountNumber">Account Number *</Label>
                              <Input
                                id="accountNumber"
                                type="password"
                                value={formData.accountNumber}
                                onChange={(e) => updateFormData("accountNumber", e.target.value)}
                                placeholder="Your account number"
                                required={formData.disbursementMethod === "bank_transfer"}
                                autoComplete="off"
                              />
                              <p className="text-xs text-gray-500">Last 4 digits will be visible only</p>
                            </div>
                          </div>

                          <div className="bg-green-100 border border-green-400 rounded-lg p-3">
                            <p className="text-xs text-green-800 flex items-start gap-2">
                              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span>
                                <strong>Your information is secure.</strong> Bank account details are encrypted using AES-256 encryption 
                                and verified through secure ACH protocols. We never store online banking login credentials.
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-[#0A2540] mb-4 flex items-center gap-2">
                        <Calculator className="w-5 h-5" />
                        Loan Calculator
                      </h4>
                      
                      {formData.requestedAmount && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Loan Amount</p>
                              <p className="text-lg font-semibold text-[#0A2540]">${Number(formData.requestedAmount).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Processing Fee ({PROCESSING_FEE_TEXT})</p>
                              <p className="text-lg font-semibold text-[#B8922A]">${(Number(formData.requestedAmount) * PROCESSING_FEE_RATE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">Choose a repayment term</p>
                            <div className="flex gap-2 flex-wrap">
                              {[12, 24, 36].map((term) => (
                                <Button
                                  key={term}
                                  type="button"
                                  size="sm"
                                  variant={Number(formData.desiredTerm || 24) === term ? "default" : "outline"}
                                  onClick={() => updateFormData("desiredTerm", String(term))}
                                  className={Number(formData.desiredTerm || 24) === term ? "bg-[#0A2540] hover:bg-[#0d3158]" : ""}
                                >
                                  {term} months
                                </Button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="border-t pt-4">
                            <p className="text-sm font-semibold text-gray-700 mb-3">Estimated Monthly Payment</p>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center p-3 bg-white rounded-lg border">
                                <span className="text-sm text-gray-600">{Number(formData.desiredTerm || 24)}-Month Term ({ILLUSTRATIVE_APR.toFixed(2)}% APR example)</span>
                                <span className="font-semibold text-[#0A2540]">${calculateMonthlyPayment(Number(formData.requestedAmount), ILLUSTRATIVE_APR, Number(formData.desiredTerm || 24)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo</span>
                              </div>
                              <p className="text-xs text-gray-500">Estimated total interest: ${calculateTotalInterest(Number(formData.requestedAmount), ILLUSTRATIVE_APR, Number(formData.desiredTerm || 24)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-3">*Actual APR and terms depend on credit approval ({APR_RANGE_TEXT}). Processing fee ({PROCESSING_FEE_TEXT}) is due before disbursement.</p>
                          </div>
                        </div>
                      )}
                      {!formData.requestedAmount && (
                        <p className="text-sm text-gray-600 italic">Enter a loan amount above to see estimated payments</p>
                      )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-[#0A2540] mb-2">Before You Submit</h4>
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
                          <span>{PROCESSING_FEE_TEXT} processing fee applies upon approval (paid via card or crypto before disbursement)</span>
                        </li>
                      </ul>
                    </div>

                    {/* Terms and Conditions */}
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="font-semibold text-[#0A2540]">Required Agreements</h4>
                      
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
                            href="/legal/terms-of-service"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0A2540] underline hover:text-[#B8922A]"
                          >
                            Terms of Service
                          </a>{" "}
                          and{" "}
                          <a
                            href="/legal/loan-agreement"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0A2540] underline hover:text-[#B8922A]"
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
                            href="/legal/privacy-policy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0A2540] underline hover:text-[#B8922A]"
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
                            href="/legal/esign-consent"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0A2540] underline hover:text-[#B8922A]"
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
                        className="border-[#0A2540] text-[#0A2540]"
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
                        <div className="flex flex-col gap-3 sm:items-end">
                          {turnstile.widget}
                          {turnstile.isEnabled && !turnstile.isReady && (
                            <p className="text-xs text-amber-700 sm:text-right max-w-xs">
                              Verification is still loading. If the widget does not appear, you can still submit your application.
                            </p>
                          )}
                          <Button
                            type="submit"
                            disabled={submitMutation.isPending}
                            className="bg-[#C9A227] hover:bg-[#B8922A] text-white px-8"
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
                href={`tel:${COMPANY_PHONE_RAW}`}
                className="flex items-center gap-2 text-[#0A2540] hover:underline"
              >
                <Phone className="w-4 h-4" />
                {COMPANY_PHONE_DISPLAY}
              </a>
              <span className="text-gray-400">|</span>
              <a href="#faq" className="text-[#0A2540] hover:underline">
                View FAQs
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#0A2540] to-[#003366] text-white py-8">
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
                <li><a href="/login" className="hover:text-[#C9A227] transition-colors">Sign In</a></li>
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
            <p className="mt-2">Loans subject to approval. {PROCESSING_FEE_TEXT} processing fee paid via credit/debit card or cryptocurrency before disbursement.</p>
          </div>
        </div>
      </footer>
          </div>
        </>
      )}
    </>
  );
}
