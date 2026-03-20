import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Search,
  FileCheck,
  Banknote,
  Clock,
  ShieldCheck,
  Smartphone,
  CreditCard,
  CheckCircle2,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import ComplianceFooter from "@/components/ComplianceFooter";
import SEOHead from "@/components/SEOHead";

const steps = [
  {
    icon: Search,
    number: "01",
    title: "Check Your Offers",
    description:
      "Fill out our simple online form in just a few minutes. We'll show you personalized loan offers based on your information — with no impact to your credit score.",
    details: ["Takes less than 5 minutes", "No hard credit pull", "See real rates and terms"],
  },
  {
    icon: FileCheck,
    number: "02",
    title: "Choose Your Loan",
    description:
      "Review your offers and pick the loan amount, term, and monthly payment that fits your budget. Everything is transparent — no hidden fees or surprises.",
    details: ["Compare multiple offers", "Flexible terms from 6–36 months", "Clear fee breakdown"],
  },
  {
    icon: Banknote,
    number: "03",
    title: "Get Your Funds",
    description:
      "Once approved, sign your agreement electronically and receive your funds as fast as the same business day. It's that simple.",
    details: ["E-sign from any device", "Same-day funding available", "Direct deposit to your bank"],
  },
];

const features = [
  { icon: Clock, title: "Fast Decisions", text: "Get a decision in minutes, not days." },
  { icon: ShieldCheck, title: "Secure & Private", text: "256-bit encryption protects your data." },
  { icon: Smartphone, title: "100% Online", text: "Apply, sign, and manage from any device." },
  { icon: CreditCard, title: "No Hidden Fees", text: "Transparent pricing with no origination fee surprises." },
];

export default function HowItWorks() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-white text-gray-800">
      <SEOHead
        title="How It Works"
        description="See how easy it is to get a personal loan with AmeriLend. Check your rate in minutes, choose your offer, and get funded as fast as the same business day."
        path="/how-it-works"
      />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/images/logo-new.jpg" alt="AmeriLend" className="h-9 w-auto rounded" />
            <span className="text-xl font-bold text-[#0A2540] hidden sm:inline">AmeriLend</span>
          </Link>
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
            How It <span className="text-[#C9A227]">Works</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Three simple steps between you and the funds you need. No complicated paperwork, no long waits.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 w-full pointer-events-none">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="block w-full h-16 md:h-24">
            <path d="M0,40 C480,100 960,0 1440,40 L1440,100 L0,100 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="space-y-20">
            {steps.map((step, i) => (
              <div
                key={step.number}
                className={`flex flex-col ${i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-10 md:gap-16`}
              >
                {/* Illustration / Number */}
                <div className="flex-shrink-0">
                  <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-[#0A2540] to-[#0d3a5c] rounded-3xl flex flex-col items-center justify-center shadow-lg">
                    <step.icon className="w-10 h-10 text-[#C9A227] mb-2" />
                    <span className="text-3xl font-extrabold text-white">{step.number}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl md:text-3xl font-bold text-[#0A2540] mb-3">{step.title}</h3>
                  <p className="text-gray-600 text-lg leading-relaxed mb-5">{step.description}</p>
                  <ul className="space-y-2">
                    {step.details.map((d) => (
                      <li key={d} className="flex items-center gap-3 text-gray-700 justify-center md:justify-start">
                        <CheckCircle2 className="w-5 h-5 text-[#00875A] flex-shrink-0" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">
              Built for your convenience
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Every part of the process is designed to save you time and give you peace of mind.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-[#C9A227]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <f.icon className="w-6 h-6 text-[#C9A227]" />
                </div>
                <h3 className="font-bold text-[#0A2540] mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">
            Ready to see your offers?
          </h2>
          <p className="text-gray-500 text-lg mb-8">
            It only takes a few minutes. No commitment, no credit impact.
          </p>
          <Link href="/check-offers">
            <Button size="lg" className="bg-[#C9A227] hover:bg-[#b8922a] text-white font-semibold rounded-full px-10 text-base shadow-md">
              Check My Offers <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <ComplianceFooter />
    </div>
  );
}
