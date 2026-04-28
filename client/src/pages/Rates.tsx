import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import ComplianceFooter from "@/components/ComplianceFooter";
import SEOHead from "@/components/SEOHead";
import {
  APR_MAX,
  APR_MIN,
  APR_RANGE_TEXT,
  COMPANY_PHONE_DISPLAY_SHORT,
  COMPANY_PHONE_RAW,
  ILLUSTRATIVE_APR,
  LOAN_MAX_AMOUNT,
  LOAN_MIN_AMOUNT,
  LOAN_RANGE_TEXT,
  PROCESSING_FEE_RATE,
  PROCESSING_FEE_TEXT,
  TERM_RANGE_TEXT,
} from "@/const";

const loanTiers = [
  {
    name: "Standard",
    range: "$500 – $3,000",
    apr: "24.99% – 35.99%",
    term: "6 – 18 months",
    highlight: false,
  },
  {
    name: "Plus",
    range: "$3,000 – $7,500",
    apr: "14.99% – 24.99%",
    term: "12 – 24 months",
    highlight: true,
  },
  {
    name: "Premium",
    range: "$7,500 – $15,000",
    apr: "5.99% – 14.99%",
    term: "12 – 36 months",
    highlight: false,
  },
];

const faqs = [
  {
    q: "Does checking my rate affect my credit score?",
    a: "No. When you check your offers with AmeriLend, we perform a soft credit inquiry that does not affect your credit score. A hard inquiry only occurs if you accept a loan offer and proceed with a full application.",
  },
  {
    q: "What determines my APR?",
    a: "Your rate is based on several factors including your credit history, income, debt-to-income ratio, and state of residence. Better credit profiles generally receive lower rates.",
  },
  {
    q: "Are there any hidden fees?",
    a: "No. AmeriLend is committed to full transparency. All fees, including the disclosed processing fee and any state-specific charges, are clearly shown before you sign your loan agreement. There are no prepayment penalties.",
  },
  {
    q: "Can I pay off my loan early?",
    a: "Yes! You can pay off your loan early at any time with no prepayment penalties. Early payoff can help you save on interest charges.",
  },
  {
    q: "How fast can I receive funds?",
    a: "Once your loan is approved and you sign your agreement, funds can be deposited into your bank account as fast as the same business day.",
  },
];

export default function Rates() {
  const [loanAmount, setLoanAmount] = useState(5000);
  const [loanTerm, setLoanTerm] = useState(24);
  const [apr, setApr] = useState(ILLUSTRATIVE_APR);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Use tRPC server-side loan calculator
  const calcQuery = trpc.loanCalculator.calculatePayment.useQuery(
    { amount: loanAmount * 100, term: loanTerm, interestRate: apr },
  );

  // Server result or fallback to local calculation
  const serverData = calcQuery.data?.success ? calcQuery.data.data : null;
  const localRate = (apr / 100) / 12;
  const localPayment = (loanAmount * localRate) / (1 - Math.pow(1 + localRate, -loanTerm));
  const monthlyPayment = serverData?.monthlyPaymentDollars ?? localPayment;
  const totalInterest = serverData?.totalInterestDollars ?? (localPayment * loanTerm - loanAmount);
  const totalPayment = serverData?.totalPaymentDollars ?? (localPayment * loanTerm);

  return (
    <div className="min-h-screen bg-white text-gray-800">
      <SEOHead
        title="Rates & Terms"
        description={`Competitive personal loan rates from ${APR_MIN.toFixed(2)}% APR. Transparent terms, no hidden fees, and flexible repayment options from ${TERM_RANGE_TEXT}.`}
        path="/rates"
      />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/images/logo-new.jpg" alt="AmeriLend" className="h-9 w-auto rounded" />
            <span className="text-xl font-bold text-[#0A2540] hidden sm:inline">AmeriLend</span>
          </Link>
          <a
            href={`tel:${COMPANY_PHONE_RAW}`}
            className="hidden lg:flex items-center text-xs text-gray-600 hover:text-[#0A2540]"
          >
            {COMPANY_PHONE_DISPLAY_SHORT}
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <Link href="/" className="hover:text-[#0A2540] transition-colors">Home</Link>
            <Link href="/about" className="hover:text-[#0A2540] transition-colors">About</Link>
            <Link href="/how-it-works" className="hover:text-[#0A2540] transition-colors">How It Works</Link>
            <Link href="/rates" className="hover:text-[#0A2540] transition-colors">Rates</Link>
            <Link href="/resources" className="hover:text-[#0A2540] transition-colors">Resources</Link>
            <Link href="/contact" className="hover:text-[#0A2540] transition-colors">Contact</Link>
            <Link href="/check-offers">
              <Button size="sm" className="bg-[#C9A227] hover:bg-[#b8922a] text-white rounded-full px-6">
                See My Loan Offers
              </Button>
            </Link>
          </nav>
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3 shadow-lg">
            <Link href="/" className="block py-2 text-gray-700 hover:text-[#0A2540]" onClick={() => setMobileMenuOpen(false)}>Home</Link>
            <Link href="/about" className="block py-2 text-gray-700 hover:text-[#0A2540]" onClick={() => setMobileMenuOpen(false)}>About</Link>
            <Link href="/how-it-works" className="block py-2 text-gray-700 hover:text-[#0A2540]" onClick={() => setMobileMenuOpen(false)}>How It Works</Link>
            <Link href="/rates" className="block py-2 text-gray-700 hover:text-[#0A2540]" onClick={() => setMobileMenuOpen(false)}>Rates</Link>
            <Link href="/resources" className="block py-2 text-gray-700 hover:text-[#0A2540]" onClick={() => setMobileMenuOpen(false)}>Resources</Link>
            <Link href="/contact" className="block py-2 text-gray-700 hover:text-[#0A2540]" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
            <Link href="/check-offers">
              <Button className="w-full bg-[#C9A227] hover:bg-[#b8922a] text-white rounded-full">See My Loan Offers</Button>
            </Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative bg-[#0A2540] text-white py-20 md:py-28 overflow-hidden">
        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            Rates & <span className="text-[#C9A227]">Terms</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Transparent pricing with no surprises. See our loan tiers and estimate your monthly payment.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 w-full pointer-events-none">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="block w-full h-16 md:h-24">
            <path d="M0,40 C480,100 960,0 1440,40 L1440,100 L0,100 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Loan Tiers */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">Loan Options</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Choose the loan that fits your needs. Current disclosed ranges: {LOAN_RANGE_TEXT}, {APR_RANGE_TEXT}, {TERM_RANGE_TEXT}.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {loanTiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl p-8 text-center border-2 transition-shadow ${
                  tier.highlight
                    ? "border-[#C9A227] bg-[#C9A227]/5 shadow-lg"
                    : "border-gray-200 bg-white shadow-sm hover:shadow-md"
                }`}
              >
                {tier.highlight && (
                  <span className="inline-block bg-[#C9A227] text-white text-xs font-bold px-3 py-1 rounded-full mb-4">
                    MOST POPULAR
                  </span>
                )}
                <h3 className="text-2xl font-bold text-[#0A2540] mb-2">{tier.name}</h3>
                <div className="text-3xl font-extrabold text-[#0A2540] mb-1">{tier.range}</div>
                <div className="text-sm text-gray-500 mb-6">Loan amount</div>

                <div className="space-y-3 text-left mb-8">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">APR Range</span>
                    <span className="font-semibold text-[#0A2540]">{tier.apr}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Loan Term</span>
                    <span className="font-semibold text-[#0A2540]">{tier.term}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Prepayment Penalty</span>
                    <span className="font-semibold text-[#00875A]">None</span>
                  </div>
                </div>

                <Link href="/check-offers">
                  <Button
                    className={`w-full rounded-full font-semibold ${
                      tier.highlight
                        ? "bg-[#C9A227] hover:bg-[#b8922a] text-white"
                        : "bg-[#0A2540] hover:bg-[#0d3a5c] text-white"
                    }`}
                  >
                    Check My Rate
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Loan Calculator */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-[#0A2540]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calculator className="w-7 h-7 text-[#0A2540]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-3">Payment Estimator</h2>
            <p className="text-gray-500 text-lg">
              Estimate your monthly payment. For illustration only — your actual rate may vary.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-md">
            {/* Amount Slider */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="loan-amount-slider" className="text-sm font-medium text-gray-700">Loan Amount</label>
                <span className="text-2xl font-extrabold text-[#0A2540]">
                  ${loanAmount.toLocaleString()}
                </span>
              </div>
              <input
                id="loan-amount-slider"
                type="range"
                min={LOAN_MIN_AMOUNT}
                max={LOAN_MAX_AMOUNT}
                step={250}
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#C9A227]"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>${LOAN_MIN_AMOUNT.toLocaleString()}</span>
                <span>${LOAN_MAX_AMOUNT.toLocaleString()}</span>
              </div>
            </div>

            {/* APR Slider */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="apr-slider" className="text-sm font-medium text-gray-700">APR (illustrative)</label>
                <span className="text-lg font-bold text-[#0A2540]">{apr.toFixed(2)}%</span>
              </div>
              <input
                id="apr-slider"
                type="range"
                min={APR_MIN}
                max={APR_MAX}
                step={0.1}
                value={apr}
                onChange={(e) => setApr(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#0A2540]"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{APR_MIN.toFixed(2)}%</span>
                <span>{APR_MAX.toFixed(2)}%</span>
              </div>
            </div>

            {/* Term Selector */}
            <div className="mb-8">
              <label className="text-sm font-medium text-gray-700 mb-3 block">Loan Term</label>
              <div className="flex gap-3 flex-wrap">
                {[6, 12, 18, 24, 36].map((t) => (
                  <button
                    key={t}
                    onClick={() => setLoanTerm(t)}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${
                      loanTerm === t
                        ? "bg-[#0A2540] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {t} months
                  </button>
                ))}
              </div>
            </div>

            {/* Result */}
            <div className="bg-[#0A2540] rounded-xl p-6 text-center text-white">
              <p className="text-sm text-gray-300 mb-1">Estimated Monthly Payment</p>
              <div className="text-4xl font-extrabold text-[#C9A227]">
                ${monthlyPayment.toFixed(2)}
              </div>
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <div>
                  <p className="text-gray-400">Total Interest</p>
                  <p className="font-bold text-white">${totalInterest.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Total Repayment</p>
                  <p className="font-bold text-white">${totalPayment.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Based on illustrative APR selection. Processing fee disclosure: {PROCESSING_FEE_TEXT} due at approval before disbursement.
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Payment examples are estimates only and exclude any optional or state-specific charges.
              Final terms are shown before you sign. Range disclosures: {LOAN_RANGE_TEXT}, APR {APR_RANGE_TEXT}, terms {TERM_RANGE_TEXT}.
            </p>
          </div>
        </div>
      </section>

      {/* Rate FAQ */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">
              Common Questions About Rates
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-[#0A2540] pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-gray-600 leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0A2540] py-16">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            See your personalized rate
          </h2>
          <p className="text-gray-300 text-lg mb-8">
            Checking your rate is free and won't impact your credit score.
          </p>
          <Link href="/check-offers">
            <Button size="lg" className="bg-[#C9A227] hover:bg-[#b8922a] text-white font-semibold rounded-full px-10 text-base shadow-md">
              Check My Rate <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <ComplianceFooter />
    </div>
  );
}
