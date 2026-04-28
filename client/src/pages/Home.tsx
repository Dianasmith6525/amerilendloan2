import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronDown,
  Menu,
  X,
  Mail,
  Clock,
  DollarSign,
  Users,
  Shield,
  FileText,
  ArrowRight,
  Heart,
  Hammer,
  Wrench,
  Package,
  Zap,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import TestimonialsSection from "@/components/TestimonialsSection";
import ComplianceFooter from "@/components/ComplianceFooter";
import SEOHead from "@/components/SEOHead";
import {
  APR_MIN,
  COMPANY_PHONE_DISPLAY_SHORT,
  COMPANY_PHONE_RAW,
  LOAN_MAX_AMOUNT,
  LOAN_MIN_AMOUNT,
  PROCESSING_FEE_TEXT,
} from "@/const";

/* ─── FAQ Data ─── */
const faqs = [
  {
    question: "What are the eligibility requirements?",
    answer:
      "To apply, you must be at least 18 years old, have a valid email address, a verifiable source of income, and a checking account for direct deposit.",
  },
  {
    question: "How much can I borrow?",
    answer:
      `Loan amounts typically range from $${LOAN_MIN_AMOUNT.toLocaleString()} to $${LOAN_MAX_AMOUNT.toLocaleString()}, depending on your state of residence, income, and creditworthiness.`,
  },
  {
    question: "How quickly will I receive my funds?",
    answer:
      "If approved before 12:00 PM CT on a business day, funds can be deposited as soon as the same day. Otherwise, expect next business day delivery.",
  },
  {
    question: "Will applying affect my credit score?",
    answer:
      "Checking your loan offers will not affect your FICO score. We use a soft credit inquiry during the initial application process.",
  },
  {
    question: "What can I use a personal loan for?",
    answer:
      "Personal loans can be used for debt consolidation, emergency expenses, home improvements, medical bills, auto repairs, and other personal needs.",
  },
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const { isAuthenticated } = useAuth();

  const toggleFaq = (index: number) =>
    setOpenFaq(openFaq === index ? null : index);

  return (
    <div className="min-h-screen bg-white text-gray-800">
      <SEOHead
        title="AmeriLend — Personal Loans Made Easy"
        description={`Apply online in minutes with no application fee. Fast approvals, transparent terms, and same-day funding. Personal loans from $${LOAN_MIN_AMOUNT.toLocaleString()} to $${LOAN_MAX_AMOUNT.toLocaleString()}.`}
        path="/"
      />
      {/* ════════════════════════════════════════════════════
          HEADER / NAV
         ════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <img
              src="/images/logo-new.jpg"
              alt="AmeriLend"
              className="h-12 md:h-14 w-auto rounded object-contain"
            />
            <span className="text-2xl font-bold text-[#0A2540] hidden lg:inline">
              AmeriLend
            </span>
          </Link>

          <a
            href={`tel:${COMPANY_PHONE_RAW}`}
            className="hidden xl:flex items-center text-xs text-gray-600 hover:text-[#0A2540]"
          >
            {COMPANY_PHONE_DISPLAY_SHORT}
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-medium text-gray-600">
            <Link href="/about" className="hover:text-[#0A2540] transition-colors">
              About
            </Link>
            <Link href="/how-it-works" className="hover:text-[#0A2540] transition-colors">
              How It Works
            </Link>
            <Link href="/rates" className="hover:text-[#0A2540] transition-colors">
              Rates
            </Link>
            <Link href="/resources" className="hover:text-[#0A2540] transition-colors">
              Resources
            </Link>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm" className="bg-[#0A2540] hover:bg-[#0d3a5c] text-white rounded-full px-6">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="sm" variant="outline" className="border-[#0A2540] text-[#0A2540] hover:bg-[#0A2540] hover:text-white rounded-full px-6">
                  Sign In
                </Button>
              </Link>
            )}
            <Link href="/check-offers">
              <Button size="sm" className="bg-[#C9A227] hover:bg-[#b8922a] text-white rounded-full px-6">
                See My Loan Offers
              </Button>
            </Link>
          </nav>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3 shadow-lg">
            <Link href="/about" className="block py-2 text-gray-700 hover:text-[#0A2540]" onClick={() => setMobileMenuOpen(false)}>
              About
            </Link>
            <Link href="/how-it-works" className="block py-2 text-gray-700 hover:text-[#0A2540]" onClick={() => setMobileMenuOpen(false)}>
              How It Works
            </Link>
            <Link href="/rates" className="block py-2 text-gray-700 hover:text-[#0A2540]" onClick={() => setMobileMenuOpen(false)}>
              Rates
            </Link>
            <Link href="/resources" className="block py-2 text-gray-700 hover:text-[#0A2540]" onClick={() => setMobileMenuOpen(false)}>
              Resources
            </Link>
            <div className="flex flex-col gap-2 pt-2">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button className="w-full bg-[#0A2540] text-white rounded-full">Dashboard</Button>
                </Link>
              ) : (
                <Link href="/login">
                  <Button variant="outline" className="w-full border-[#0A2540] text-[#0A2540] rounded-full">
                    Sign In
                  </Button>
                </Link>
              )}
              <Link href="/check-offers">
                <Button className="w-full bg-[#C9A227] hover:bg-[#b8922a] text-white rounded-full">
                  See My Loan Offers
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ════════════════════════════════════════════════════
          HERO
         ════════════════════════════════════════════════════ */}
      <section className="relative bg-gradient-to-br from-[#f0f7f6] to-white pb-0 pt-16 md:pt-24 overflow-hidden">
        <div className="container mx-auto px-4 relative z-20">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-10 md:gap-16">
            {/* Left – Copy */}
            <div className="flex-1 text-center md:text-left pb-16 md:pb-24">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#0A2540] leading-tight mb-6">
                Personal loans,{" "}
                <span className="text-[#C9A227]">made easy</span> for you.
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                Stress-free, fast cash deposits — apply online in minutes with no application fee.
              </p>

              <ul className="space-y-3 mb-8 text-gray-700 text-base md:text-lg">
                <li className="flex items-center gap-3 justify-center md:justify-start">
                  <CheckCircle2 className="w-5 h-5 text-[#00875A] flex-shrink-0" />
                  Easy online application
                </li>
                <li className="flex items-center gap-3 justify-center md:justify-start">
                  <CheckCircle2 className="w-5 h-5 text-[#00875A] flex-shrink-0" />
                  No application fee
                </li>
                <li className="flex items-center gap-3 justify-center md:justify-start">
                  <CheckCircle2 className="w-5 h-5 text-[#00875A] flex-shrink-0" />
                  See offers in minutes
                </li>
              </ul>

              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start relative z-30">
                <Link href="/check-offers">
                  <Button size="lg" className="bg-[#C9A227] hover:bg-[#b8922a] text-white font-semibold rounded-full px-8 text-base shadow-md w-full sm:w-auto">
                    See My Loan Offers <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#0A2540] text-[#0A2540] hover:bg-[#0A2540] hover:text-white rounded-full px-8 text-base w-full sm:w-auto"
                  onClick={() => setShowCodeModal(true)}
                >
                  Have an Invitation Code?
                </Button>
              </div>
            </div>

            {/* Right – Hero Image */}
            <div className="flex-1 flex justify-center relative z-20">
              <img
                src="/images/hero-woman.png"
                alt="Smiling woman viewing a mobile notification that she was approved for a $2,500 loan"
                className="w-80 md:w-[28rem] lg:w-[32rem] h-auto object-contain drop-shadow-2xl"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* Full-width curved divider — edge to edge, overlaps bottom of hero image */}
        <div className="absolute bottom-0 left-0 w-full z-10 pointer-events-none">
          <svg
            viewBox="0 0 1440 160"
            preserveAspectRatio="none"
            className="block w-full h-24 md:h-32 lg:h-40"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,80 C360,160 1080,0 1440,80 L1440,160 L0,160 Z"
              fill="#0A2540"
            />
          </svg>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          HOW IT WORKS — 3 Steps
         ════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-10 md:py-24 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-2xl md:text-4xl font-bold text-[#0A2540] text-center mb-2 sm:mb-4">
            We simplified personal loans
          </h2>
          <p className="text-center text-gray-500 mb-8 sm:mb-14 text-sm sm:text-lg max-w-2xl mx-auto">
            Getting a loan shouldn't be complicated. Here's how it works.
          </p>

          <div className="grid grid-cols-3 gap-4 md:gap-10 relative">
            {/* Connecting line between steps */}
            <div className="hidden md:block absolute top-8 left-[20%] right-[20%] border-t-2 border-dashed border-[#C9A227]/30" />
            {[
              {
                step: "1",
                title: "Answer a few questions",
                desc: "Complete a simple online application in minutes — no paperwork needed.",
                icon: <FileText className="w-5 h-5 sm:w-7 sm:h-7 text-white" />,
              },
              {
                step: "2",
                title: "Personalize your offer",
                desc: "Choose the loan amount and terms that work best for your budget.",
                icon: <DollarSign className="w-5 h-5 sm:w-7 sm:h-7 text-white" />,
              },
              {
                step: "3",
                title: "Get your money",
                desc: "Once approved, funds can be deposited as soon as the same day.¹",
                icon: <Clock className="w-5 h-5 sm:w-7 sm:h-7 text-white" />,
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-[#0A2540] flex items-center justify-center mx-auto mb-2 sm:mb-5">
                  {item.icon}
                </div>
                <span className="text-[10px] sm:text-sm font-semibold text-[#C9A227] tracking-wide uppercase mb-1 sm:mb-2 block">
                  Step {item.step}
                </span>
                <h3 className="text-sm sm:text-xl font-bold text-[#0A2540] mb-1 sm:mb-3">{item.title}</h3>
                <p className="text-xs sm:text-base text-gray-600 leading-relaxed hidden sm:block">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          YOUR LOAN, YOUR WAY
         ════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 bg-[#f8f9fa]">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] text-center mb-4">
            Your loan, your way
          </h2>
          <p className="text-center text-gray-500 mb-10 sm:mb-14 text-lg max-w-2xl mx-auto">
            Choose the amount, pick the terms, and review everything before you commit. No surprises.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
            {[
              {
                icon: <Shield className="w-6 h-6" />,
                title: "No hidden fees",
                desc: `What you see is what you get — no hidden charges and no prepayment penalties. Processing fee disclosure: ${PROCESSING_FEE_TEXT} at approval before disbursement.`,
              },
              {
                icon: <Clock className="w-6 h-6" />,
                title: "Same-day funding",
                desc: "Apply before noon CT and get approved funds deposited the same business day.¹",
              },
              {
                icon: <DollarSign className="w-6 h-6" />,
                title: `Fixed rates from ${APR_MIN.toFixed(2)}%`,
                desc: "Lock in a rate that won't change. Budget with confidence over your full loan term.",
              },
              {
                icon: <CheckCircle2 className="w-6 h-6" />,
                title: "No credit score impact",
                desc: "Checking your offers uses a soft pull — your FICO score stays completely untouched.²",
              },
            ].map((feature, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 md:p-8 flex gap-5 items-start shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-[#0A2540]/5 text-[#0A2540] flex items-center justify-center flex-shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-bold text-[#0A2540] text-lg mb-1">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/check-offers">
              <Button size="lg" className="bg-[#C9A227] hover:bg-[#b8922a] text-white font-semibold rounded-full px-10 text-base shadow-md">
                Check My Offers <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          REQUIREMENTS
         ════════════════════════════════════════════════════ */}
      <section id="requirements" className="py-10 md:py-24 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-2xl md:text-4xl font-bold text-[#0A2540] text-center mb-2 sm:mb-4">
            What do I need?
          </h2>
          <p className="text-center text-gray-500 mb-6 sm:mb-14 text-sm sm:text-lg">
            Just four simple requirements to get started.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
            {[
              { icon: <Users className="w-5 h-5 sm:w-7 sm:h-7" />, label: "Be at least 18 years old" },
              { icon: <Mail className="w-5 h-5 sm:w-7 sm:h-7" />, label: "Have a valid email address" },
              { icon: <DollarSign className="w-5 h-5 sm:w-7 sm:h-7" />, label: "Verifiable source of income" },
              { icon: <Shield className="w-5 h-5 sm:w-7 sm:h-7" />, label: "Active checking account" },
            ].map((req, i) => (
              <div key={i} className="flex flex-col items-center text-center p-3 sm:p-6 rounded-2xl bg-[#f8f9fa] hover:shadow-md transition-shadow">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-[#0A2540] text-white flex items-center justify-center mb-2 sm:mb-4">
                  {req.icon}
                </div>
                <p className="text-xs sm:text-base font-semibold text-[#0A2540]">{req.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          USE YOUR LOAN FOR
         ════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 bg-[#f8f9fa]">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] text-center mb-4">
            What you can use it for
          </h2>
          <p className="text-center text-gray-500 mb-10 sm:mb-14 text-lg max-w-2xl mx-auto">
            From planned projects to unexpected expenses — a personal loan gives you flexibility.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {[
              { icon: <Wallet className="w-6 h-6" />, title: "Debt Consolidation", desc: "Combine multiple payments into one with a lower rate." },
              { icon: <Heart className="w-6 h-6" />, title: "Medical Bills", desc: "Cover healthcare costs without the high-interest credit card." },
              { icon: <Hammer className="w-6 h-6" />, title: "Home Improvement", desc: "Fund repairs, renovations, or upgrades to your home." },
              { icon: <Wrench className="w-6 h-6" />, title: "Auto Repairs", desc: "Get back on the road without draining your savings." },
              { icon: <Package className="w-6 h-6" />, title: "Moving Costs", desc: "Relocate without the financial stress of upfront expenses." },
              { icon: <Zap className="w-6 h-6" />, title: "Emergency Expenses", desc: "Handle the unexpected with fast, reliable funding." },
            ].map((useCase, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 md:p-6 text-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                <div className="w-12 h-12 rounded-full bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center mx-auto mb-4 group-hover:bg-[#C9A227]/20 transition-colors">
                  {useCase.icon}
                </div>
                <h3 className="font-bold text-[#0A2540] mb-1.5">{useCase.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{useCase.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          WHY AMERILEND
         ════════════════════════════════════════════════════ */}
      <section id="why-amerilend" className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] text-center mb-14">
            Why AmeriLend?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center mb-12">
            {/* Left – Quote */}
            <div className="relative">
              <div className="absolute -top-4 -left-2 text-6xl text-[#C9A227]/20 font-serif leading-none select-none" aria-hidden="true">&ldquo;</div>
              <blockquote className="text-xl md:text-2xl text-[#0A2540] font-medium leading-relaxed pl-6 border-l-4 border-[#C9A227]">
                We believe personal loans should be simple, transparent, and built around you — because your financial story is bigger than a number.
              </blockquote>
            </div>

            {/* Right – Benefits list */}
            <div className="space-y-4">
              {[
                "Fast approvals — often within minutes",
                "Same-day funding for qualifying applicants",
                "Clear terms with no hidden fees",
                "No prepayment penalties, ever",
                "Dedicated U.S.-based support team",
              ].map((benefit, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00875A] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trust Badges */}
          <div className="border-t border-gray-100 pt-10">
            <p className="text-center text-gray-500 text-sm font-medium uppercase tracking-wide mb-8">
              Trusted & Verified
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
              <a href="https://www.bbb.org/us/ca/san-diego/profile/loans/amerilend-1126-1000000" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity">
                <img src="/images/bbb.png" alt="BBB A+ Rating" className="h-12 w-auto" loading="lazy" />
                <span className="text-xs text-gray-500 font-medium">A+ Rating</span>
              </a>
              <a href="https://www.trustpilot.com/review/amerilendloan.com" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity">
                <img src="/trustpilot-logo.svg" alt="Trustpilot" className="h-10 w-auto" loading="lazy" />
                <span className="text-xs text-gray-500 font-medium">4.8 / 5</span>
              </a>
              <a href="https://www.lendingtree.com" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity">
                <img src="/lending-tree-logo.svg" alt="LendingTree" className="h-10 w-auto" loading="lazy" />
                <span className="text-xs text-gray-500 font-medium">Partner</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          FAQ
         ════════════════════════════════════════════════════ */}
      <section id="faq" className="py-16 md:py-24 bg-[#f8f9fa]">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] text-center mb-12">
            Answers to your questions
          </h2>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  aria-expanded={openFaq === index}
                >
                  <span className="font-semibold text-[#0A2540] pr-4">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                      openFaq === index ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-5 text-gray-600 leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          TESTIMONIALS
         ════════════════════════════════════════════════════ */}
      <TestimonialsSection />

      {/* ════════════════════════════════════════════════════
          BOTTOM CTA + STATS
         ════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-20 bg-[#0A2540] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Check your loan offers now
          </h2>
          <p className="text-gray-300 text-lg mb-8 max-w-xl mx-auto">
            Checking your offers won't affect your credit score. Apply in minutes and get a decision fast.
          </p>
          <Link href="/check-offers">
            <Button size="lg" className="bg-[#C9A227] hover:bg-[#b8922a] text-white font-semibold rounded-full px-10 text-base shadow-lg">
              See My Loan Offers <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>

          {/* Stats */}
          <div className="mt-16 pt-12 border-t border-white/10 max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: "4.8★", label: "Customer Rating" },
                { value: "48", label: "States Licensed" },
                { value: "Same-Day", label: "Funding Available" },
                { value: "$0", label: "Origination Fees" },
              ].map((stat, i) => (
                <div key={i}>
                  <p className="text-3xl md:text-4xl font-extrabold text-[#C9A227] mb-2">{stat.value}</p>
                  <p className="text-sm md:text-base text-gray-300">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ComplianceFooter />


      {/* ════════════════════════════════════════════════════
          CODE ENTRY MODAL
         ════════════════════════════════════════════════════ */}
      {showCodeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#0A2540]">Enter Your Code</h2>
              <button
                onClick={() => { setShowCodeModal(false); setVerificationCode(""); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-gray-600 mb-6">
              Enter your invitation code from AmeriLend to prefill your offer experience.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (verificationCode.trim()) {
                  window.location.href = `/check-offers?code=${encodeURIComponent(verificationCode.trim())}`;
                }
              }}
              className="space-y-4"
            >
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-lg font-semibold tracking-wider focus:ring-2 focus:ring-[#0A2540] focus:border-transparent outline-none"
                autoFocus
                maxLength={20}
              />
              <Button
                type="submit"
                disabled={!verificationCode.trim()}
                className="w-full bg-[#0A2540] hover:bg-[#0d3a5c] disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl"
              >
                Verify
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => { setShowCodeModal(false); setVerificationCode(""); }}
              >
                Cancel
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
