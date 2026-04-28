import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toTitleCase } from "@shared/format";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  CheckCircle2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Shield,
  Clock,
  DollarSign,
  Star,
  Sparkles,
  BadgeCheck,
  AlertCircle,
  Ticket,
  Gift,
  Phone,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import SEOHead from "@/components/SEOHead";
import {
  APR_MAX,
  APR_MIN,
  COMPANY_PHONE_DISPLAY_SHORT,
  COMPANY_PHONE_RAW,
  LOAN_MAX_AMOUNT,
  LOAN_MIN_AMOUNT,
} from "@/const";

/* ─── offer generation helpers ─── */
interface LoanOffer {
  id: string;
  name: string;
  amount: number;
  apr: number;
  term: number; // months
  monthlyPayment: number;
  totalCost: number;
  badge?: string;
}

function generateOffers(income: number, creditScore: number, requestedAmount: number): LoanOffer[] {
  // Base APR determined by credit score
  let baseApr = 24.99;
  if (creditScore >= 750) baseApr = 6.49;
  else if (creditScore >= 700) baseApr = 11.49;
  else if (creditScore >= 650) baseApr = 14.99;
  else if (creditScore >= 600) baseApr = 18.99;
  else if (creditScore >= 550) baseApr = 21.99;

  baseApr = Math.min(Math.max(baseApr, APR_MIN), APR_MAX);

  // Max loan based on income & credit
  let maxLoan = Math.min(requestedAmount, income * 0.4, LOAN_MAX_AMOUNT);
  if (creditScore >= 700) maxLoan = Math.min(requestedAmount, income * 0.6);
  else if (creditScore >= 650) maxLoan = Math.min(requestedAmount, income * 0.5);
  maxLoan = Math.round(maxLoan / 500) * 500; // Round to nearest $500
  if (maxLoan < LOAN_MIN_AMOUNT) maxLoan = LOAN_MIN_AMOUNT;

  const pmt = (principal: number, annualRate: number, months: number) => {
    const r = annualRate / 100 / 12;
    if (r === 0) return principal / months;
    return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  };

  const offers: LoanOffer[] = [];

  // Offer 1 — Recommended (medium term)
  const amt1 = maxLoan;
  const apr1 = baseApr;
  const term1 = 36;
  const mp1 = pmt(amt1, apr1, term1);
  offers.push({
    id: "offer-1",
    name: "Recommended",
    amount: amt1,
    apr: apr1,
    term: term1,
    monthlyPayment: Math.round(mp1 * 100) / 100,
    totalCost: Math.round(mp1 * term1 * 100) / 100,
    badge: "Best Value",
  });

  // Offer 2 — Lower payment (longer term, slightly higher APR)
  const amt2 = maxLoan;
  const apr2 = Math.min(baseApr + 1.5, 29.99);
  const term2 = 36;
  const mp2 = pmt(amt2, apr2, term2);
  offers.push({
    id: "offer-2",
    name: "Lower Payment",
    amount: amt2,
    apr: apr2,
    term: term2,
    monthlyPayment: Math.round(mp2 * 100) / 100,
    totalCost: Math.round(mp2 * term2 * 100) / 100,
  });

  // Offer 3 — Fast payoff (shorter term, lower APR)
  if (creditScore >= 580) {
    const amt3 = Math.min(maxLoan, Math.round((income * 0.3) / 500) * 500, LOAN_MAX_AMOUNT);
    const apr3 = Math.max(baseApr - 1.0, APR_MIN);
    const term3 = 24;
    const mp3 = pmt(Math.max(amt3, LOAN_MIN_AMOUNT), apr3, term3);
    offers.push({
      id: "offer-3",
      name: "Fast Payoff",
      amount: Math.max(amt3, LOAN_MIN_AMOUNT),
      apr: apr3,
      term: term3,
      monthlyPayment: Math.round(mp3 * 100) / 100,
      totalCost: Math.round(mp3 * term3 * 100) / 100,
      badge: "Lowest Rate",
    });
  }

  return offers;
}

/* ─── US state options ─── */
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];
const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",
  KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",
  MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",
  NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",
  NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",
  OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

/* ═══════════════════ COMPONENT ═══════════════════ */
export default function CheckOffers() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Prevent admin access
  if (!authLoading && isAuthenticated && user?.role === "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardContent className="pt-6 space-y-4 text-center">
            <h2 className="text-lg font-semibold">Admin Account</h2>
            <p className="text-sm text-muted-foreground">
              Administrators cannot check offers. Please use the admin dashboard.
            </p>
            <Link href="/admin">
              <Button className="w-full">Go to Admin Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  type Step = "form" | "checking" | "offers" | "no-offers" | "code-offer";
  const [step, setStep] = useState<Step>("form");
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);

  // "Have a code?" state
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeOffer, setCodeOffer] = useState<any>(null);

  const utils = trpc.useUtils();

  // Auto-validate invitation code from URL ?code= param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code");
    if (!codeParam) return;
    const normalized = codeParam.trim().toUpperCase();
    setInviteCode(normalized);
    setShowCodeInput(true);
    setCodeValidating(true);
    utils.invitations.validate
      .fetch({ code: normalized })
      .then((result) => {
        if (result?.valid && result.invitation) {
          setCodeOffer(result.invitation);
          setStep("code-offer");
          toast.success("Code verified! Here's your personalized offer.");
        } else {
          toast.error(result?.message || "Invalid invitation code");
        }
      })
      .catch(() => toast.error("Could not validate code. Please try again."))
      .finally(() => setCodeValidating(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const redeemCodeMutation = trpc.invitations.redeem.useMutation({
    onSuccess: () => {},
    onError: () => {},
  });

  const handleValidateCode = async () => {
    const code = inviteCode.trim();
    if (!code) {
      toast.error("Please enter an invitation code");
      return;
    }
    setCodeValidating(true);
    try {
      // Use fetch() with explicit input to avoid stale query key issues
      const result = await utils.invitations.validate.fetch({ code });
      if (result?.valid && result.invitation) {
        setCodeOffer(result.invitation);
        setStep("code-offer");
        toast.success("Code verified! Here's your personalized offer.");
      } else {
        toast.error(result?.message || "Invalid code");
      }
    } catch {
      toast.error("Could not validate code. Please try again.");
    } finally {
      setCodeValidating(false);
    }
  };

  const handleAcceptCodeOffer = async () => {
    try {
      await redeemCodeMutation.mutateAsync({ code: inviteCode.trim() });
    } catch {
      // non-blocking — code is already validated
    }
    localStorage.setItem(
      "prequalificationData",
      JSON.stringify({
        fullName: codeOffer.recipientName || "",
        invitationCode: codeOffer.code,
        selectedOffer: {
          amount: codeOffer.offerAmount ? codeOffer.offerAmount / 100 : undefined,
          apr: codeOffer.offerApr ? codeOffer.offerApr / 100 : undefined,
          term: codeOffer.offerTermMonths,
          description: codeOffer.offerDescription,
        },
      })
    );
    setLocation("/apply");
  };

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    loanPurpose: "debt_consolidation",
    desiredAmount: 10000,
    annualIncome: "",
    creditScore: "",
    employmentStatus: "employed",
    state: "TX",
  });

  const nameFields = new Set(["firstName", "lastName"]);
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = nameFields.has(e.target.name) ? toTitleCase(e.target.value) : e.target.value;
    setFormData((p) => ({ ...p, [e.target.name]: val }));
  };
  const handleSelect = (name: string, value: string) => {
    setFormData((p) => ({ ...p, [name]: value }));
  };

  /* ── Validation ── */
  const validate = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error("Please enter your full name");
      return false;
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Please enter a valid email");
      return false;
    }
    if (!formData.annualIncome || Number(formData.annualIncome) < 1000) {
      toast.error("Please enter your annual income");
      return false;
    }
    if (!formData.creditScore || Number(formData.creditScore) < 300 || Number(formData.creditScore) > 850) {
      toast.error("Please enter a valid credit score (300-850)");
      return false;
    }
    return true;
  };

  /* ── Check offers ── */
  const handleCheckOffers = async () => {
    if (!validate()) return;

    setStep("checking");

    // Simulate API delay (soft pull)
    await new Promise((r) => setTimeout(r, 2400));

    const income = Number(formData.annualIncome);
    const score = Number(formData.creditScore);

    // Deny offers for high-risk profiles: very low income or very poor credit
    if (income < 15000 || score < 450) {
      setStep("no-offers");
      return;
    }

    const generated = generateOffers(income, score, formData.desiredAmount);
    setOffers(generated);
    setSelectedOffer(generated[0]?.id || null);
    setStep("offers");
  };

  /* ── Accept offer → apply ── */
  const handleAcceptOffer = () => {
    const offer = offers.find((o) => o.id === selectedOffer);
    localStorage.setItem(
      "prequalificationData",
      JSON.stringify({
        fullName: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        annualIncome: formData.annualIncome,
        creditScore: formData.creditScore,
        employmentStatus: formData.employmentStatus,
        state: formData.state,
        loanPurpose: formData.loanPurpose,
        selectedOffer: offer,
      })
    );
    setLocation("/apply");
  };

  /* ════════════════════════════════════
     STEP: Checking animation
     ════════════════════════════════════ */
  if (step === "checking") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f0f7f6] to-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-[#0A2540]/10" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[#C9A227] animate-spin" />
            <Shield className="absolute inset-0 m-auto w-10 h-10 text-[#0A2540]" />
          </div>
          <h2 className="text-2xl font-bold text-[#0A2540] mb-3">Checking your offers…</h2>
          <p className="text-gray-500 mb-6">
            We're doing a soft credit check. This <strong>will not</strong> affect your credit score.
          </p>
          <div className="space-y-3 text-left max-w-xs mx-auto">
            {["Verifying identity", "Checking credit profile", "Generating personalized offers"].map(
              (label, i) => (
                <div key={label} className="flex items-center gap-3 text-sm text-gray-600">
                  <Loader2 className={`w-4 h-4 animate-spin ${i < 2 ? "text-green-500" : "text-[#C9A227]"}`} />
                  {label}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════
     STEP: No offers
     ════════════════════════════════════ */
  if (step === "no-offers") {
    return (
      <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl border border-slate-200/60">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-16 h-16 text-amber-500" />
            </div>
            <CardTitle className="text-amber-600">No Pre-Qualified Offers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-slate-700">
              Unfortunately, we have no pre-qualified offers for you at this time. This could be due to income or credit requirements.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-800">We suggest the following steps:</p>
              <ul className="text-sm text-blue-700 space-y-1 list-disc pl-4">
                <li>Improve your credit score and check again</li>
                <li>Add a co-signer to strengthen your application</li>
                <li>Try again in 30 days — your situation may change</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("form")} className="flex-1 rounded-lg">
                <ArrowLeft className="w-4 h-4 mr-2" /> Try Again
              </Button>
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full rounded-lg">Return Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ════════════════════════════════════
     STEP: Offer cards
     ════════════════════════════════════ */
  if (step === "offers") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f0f7f6] to-white">
        {/* Header bar */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/">
              <span className="text-xl font-bold text-[#0A2540]">
                Ameri<span className="text-[#C9A227]">Lend</span>
              </span>
            </Link>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Shield className="w-4 h-4 text-green-600" />
              Soft inquiry — no impact on your credit
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
          {/* Success banner */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 rounded-full px-5 py-2 text-sm font-medium mb-4">
              <CheckCircle2 className="w-4 h-4" />
              Great news! You're pre-qualified
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-2">
              Your Personalized Loan Offers
            </h1>
            <p className="text-gray-500 text-lg">
              {formData.firstName}, choose the offer that works best for you.
            </p>
          </div>

          {/* Offer cards */}
          <div className="grid md:grid-cols-3 gap-5 mb-10">
            {offers.map((offer) => {
              const isSelected = selectedOffer === offer.id;
              return (
                <button
                  key={offer.id}
                  onClick={() => setSelectedOffer(offer.id)}
                  className={`text-left rounded-2xl border-2 p-5 transition-all relative ${
                    isSelected
                      ? "border-[#C9A227] bg-white shadow-lg ring-2 ring-[#C9A227]/20 scale-[1.02]"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
                  }`}
                >
                  {offer.badge && (
                    <span className="absolute -top-3 left-4 bg-[#C9A227] text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      {offer.badge === "Best Value" ? <Star className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                      {offer.badge}
                    </span>
                  )}

                  <p className="text-sm font-semibold text-gray-500 mb-1 mt-1">{offer.name}</p>
                  <p className="text-3xl font-bold text-[#0A2540] mb-1">
                    ${offer.amount.toLocaleString()}
                  </p>

                  <div className="space-y-2 mt-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">APR</span>
                      <span className="font-semibold text-[#0A2540]">{offer.apr.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Term</span>
                      <span className="font-semibold text-[#0A2540]">{offer.term} months</span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between">
                      <span className="text-gray-500">Monthly Payment</span>
                      <span className="font-bold text-lg text-[#00875A]">
                        ${offer.monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Total repayment</span>
                      <span>${offer.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-[#C9A227] text-sm font-semibold">
                      <BadgeCheck className="w-4 h-4" /> Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Accept CTA */}
          <div className="text-center space-y-4">
            <Button
              size="lg"
              onClick={handleAcceptOffer}
              disabled={!selectedOffer}
              className="bg-[#C9A227] hover:bg-[#b8922a] text-white font-semibold rounded-full px-12 text-base shadow-lg"
            >
              Continue with Selected Offer <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Continuing will take you to the full application. Final approval requires identity verification and may involve a hard credit inquiry.
            </p>
          </div>

          {/* Trust bar */}
          <div className="mt-12 border-t pt-8 grid grid-cols-3 gap-4 text-center text-sm text-gray-500">
            <div className="flex flex-col items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              <span>256-bit encryption</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>Funds as fast as same day</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#C9A227]" />
              <span>No hidden fees</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════
     STEP: Code Offer (invitation code redeemed)
     ════════════════════════════════════ */
  if (step === "code-offer" && codeOffer) {
    const amt = codeOffer.offerAmount ? codeOffer.offerAmount / 100 : null;
    const apr = codeOffer.offerApr ? codeOffer.offerApr / 100 : null;
    const term = codeOffer.offerTermMonths;
    const monthly = amt && apr && term
      ? (() => {
          const r = apr / 100 / 12;
          return r > 0 ? (amt * r) / (1 - Math.pow(1 + r, -term)) : amt / term;
        })()
      : null;

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f0f7f6] to-white">
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/">
              <span className="text-xl font-bold text-[#0A2540]">
                Ameri<span className="text-[#C9A227]">Lend</span>
              </span>
            </Link>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Shield className="w-4 h-4 text-green-600" />
              Invitation verified
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 md:py-12 max-w-lg">
          {/* Success banner */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 rounded-full px-5 py-2 text-sm font-medium mb-4">
              <CheckCircle2 className="w-4 h-4" />
              Invitation Code Verified
            </div>
            <h1 className="text-3xl font-bold text-[#0A2540] mb-2">
              {codeOffer.recipientName ? `Welcome, ${codeOffer.recipientName}!` : "Your Exclusive Offer"}
            </h1>
            <p className="text-gray-500">
              {codeOffer.offerDescription || "You've been invited with a personalized loan offer from AmeriLend."}
            </p>
          </div>

          {/* Offer card */}
          <Card className="shadow-xl border-2 border-[#C9A227]/40 bg-white mb-8">
            <CardHeader className="text-center pb-2">
              <div className="inline-flex items-center gap-1 bg-[#C9A227] text-white text-xs font-bold px-3 py-1 rounded-full mx-auto mb-2">
                <Star className="w-3 h-3" /> Exclusive Offer
              </div>
              <CardTitle className="text-[#0A2540]">Your Pre-Approved Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {amt && (
                <div className="text-center">
                  <p className="text-sm text-gray-500">Loan Amount</p>
                  <p className="text-4xl font-bold text-[#0A2540]">${amt.toLocaleString()}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 py-4 border-y">
                {apr && (
                  <div className="text-center">
                    <p className="text-sm text-gray-500">APR</p>
                    <p className="text-xl font-bold text-[#0A2540]">{apr.toFixed(2)}%</p>
                  </div>
                )}
                {term && (
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Term</p>
                    <p className="text-xl font-bold text-[#0A2540]">{term} months</p>
                  </div>
                )}
              </div>

              {monthly && (
                <div className="text-center bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600">Estimated Monthly Payment</p>
                  <p className="text-3xl font-bold text-[#00875A]">
                    ${monthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}

              {!amt && !apr && !term && (
                <div className="text-center py-4">
                  <Gift className="w-10 h-10 mx-auto text-[#C9A227] mb-2" />
                  <p className="text-gray-600">
                    You have a special invitation to apply. Complete your application to see your personalized terms.
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">
                Code: <span className="font-mono font-bold">{codeOffer.code}</span>
                {codeOffer.expiresAt && (
                  <> · Expires {new Date(codeOffer.expiresAt).toLocaleDateString()}</>
                )}
              </p>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center space-y-4">
            <Button
              size="lg"
              onClick={handleAcceptCodeOffer}
              className="w-full bg-[#C9A227] hover:bg-[#b8922a] text-white font-semibold rounded-lg text-base h-12"
            >
              Continue to Application <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={() => { setStep("form"); setShowCodeInput(false); }}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Check Offers Without Code
            </Button>
          </div>

          {/* Trust bar */}
          <div className="mt-10 border-t pt-6 grid grid-cols-3 gap-4 text-center text-xs text-gray-400">
            <div className="flex flex-col items-center gap-1">
              <Shield className="w-4 h-4 text-green-600" />
              <span>256-bit encryption</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Funds as fast as same day</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <DollarSign className="w-4 h-4 text-[#C9A227]" />
              <span>No hidden fees</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════
     STEP: Form
     ════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f7f6] to-white">
      <SEOHead
        title="Check Your Loan Offers"
        description="See personalized loan offers in minutes with no impact on your credit score. Compare rates, terms, and monthly payments from AmeriLend."
        path="/check-offers"
      />
      {/* Header bar */}
      <header className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <span className="text-xl font-bold text-[#0A2540]">
              Ameri<span className="text-[#C9A227]">Lend</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="hidden sm:flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              No impact on your credit score
            </div>
            <a href={`tel:${COMPANY_PHONE_RAW}`} className="flex items-center gap-1 hover:text-[#0A2540]">
              <Phone className="w-4 h-4" />
              {COMPANY_PHONE_DISPLAY_SHORT}
            </a>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-2xl">
        {/* Back link */}
        <Link href="/">
          <a className="inline-flex items-center gap-2 text-[#0A2540] hover:text-[#0A2540]/80 mb-6 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </a>
        </Link>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-2">
            Check Your Loan Offers
          </h1>
          <p className="text-gray-500 text-lg">
            Answer a few quick questions and see personalized offers in under 2 minutes.
          </p>
        </div>

        {/* ─── Have a Code? Section ─── */}
        <div className="mb-6">
          <button
            onClick={() => setShowCodeInput(!showCodeInput)}
            className="flex items-center gap-2 text-sm font-semibold text-[#C9A227] hover:text-[#b8922a] transition-colors"
          >
            <Ticket className="w-4 h-4" />
            Have an invitation code?
          </button>

          {showCodeInput && (
            <Card className="mt-3 border-[#C9A227]/30 bg-amber-50/50 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="w-5 h-5 text-[#C9A227]" />
                  <p className="text-sm text-gray-700">
                    Enter the code from your AmeriLend invitation email to see your personalized offer.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. AL-XXXXXXXX"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="font-mono text-center tracking-wider uppercase"
                    maxLength={20}
                    onKeyDown={(e) => e.key === "Enter" && handleValidateCode()}
                  />
                  <Button
                    onClick={handleValidateCode}
                    disabled={codeValidating || !inviteCode.trim()}
                    className="bg-[#C9A227] hover:bg-[#b8922a] text-white px-6 shrink-0"
                  >
                    {codeValidating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Apply Code"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Form card */}
        <Card className="shadow-xl border border-slate-200/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#0A2540] text-lg">Tell us about yourself</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="firstName" placeholder="First name" value={formData.firstName} onChange={handleInput} autoComplete="given-name" />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" name="lastName" placeholder="Last name" value={formData.lastName} onChange={handleInput} autoComplete="family-name" />
              </div>
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleInput} />
            </div>

            {/* Loan purpose */}
            <div>
              <Label htmlFor="loanPurpose">What's this loan for?</Label>
              <Select value={formData.loanPurpose} onValueChange={(v) => handleSelect("loanPurpose", v)}>
                <SelectTrigger id="loanPurpose"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debt_consolidation">Debt Consolidation</SelectItem>
                  <SelectItem value="home_improvement">Home Improvement</SelectItem>
                  <SelectItem value="major_purchase">Major Purchase</SelectItem>
                  <SelectItem value="medical">Medical Expenses</SelectItem>
                  <SelectItem value="auto">Auto Expenses</SelectItem>
                  <SelectItem value="moving">Moving / Relocation</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desired amount slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>How much would you like?</Label>
                <span className="text-lg font-bold text-[#0A2540]">
                  ${formData.desiredAmount.toLocaleString()}
                </span>
              </div>
              <Slider
                min={LOAN_MIN_AMOUNT}
                max={LOAN_MAX_AMOUNT}
                step={500}
                value={[formData.desiredAmount]}
                onValueChange={([v]) => setFormData((p) => ({ ...p, desiredAmount: v }))}
                className="py-2"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>${LOAN_MIN_AMOUNT.toLocaleString()}</span>
                <span>${LOAN_MAX_AMOUNT.toLocaleString()}</span>
              </div>
            </div>

            {/* Income + Credit Score */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="annualIncome">Annual Income ($)</Label>
                <Input id="annualIncome" name="annualIncome" type="number" placeholder="50000" value={formData.annualIncome} onChange={handleInput} />
              </div>
              <div>
                <Label htmlFor="creditScore">Estimated Credit Score</Label>
                <Input id="creditScore" name="creditScore" type="number" min={300} max={850} placeholder="650" value={formData.creditScore} onChange={handleInput} />
                <p className="text-xs text-gray-400 mt-1">Not sure? Enter 650.</p>
              </div>
            </div>

            {/* Employment + State */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employmentStatus">Employment</Label>
                <Select value={formData.employmentStatus} onValueChange={(v) => handleSelect("employmentStatus", v)}>
                  <SelectTrigger id="employmentStatus"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employed">Employed</SelectItem>
                    <SelectItem value="self-employed">Self-Employed</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Select value={formData.state} onValueChange={(v) => handleSelect("state", v)}>
                  <SelectTrigger id="state"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{STATE_NAMES[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Submit */}
            <Button
              size="lg"
              onClick={handleCheckOffers}
              className="w-full bg-[#C9A227] hover:bg-[#b8922a] text-white font-semibold rounded-lg text-base h-12"
            >
              Check My Offers <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-6 text-xs text-gray-400 pt-2">
              <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-green-500" /> No credit impact</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-blue-500" /> Takes 2 min</span>
              <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-[#C9A227]" /> No fees</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
