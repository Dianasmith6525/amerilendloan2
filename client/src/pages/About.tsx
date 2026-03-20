import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Heart,
  Shield,
  Users,
  Target,
  Award,
  CheckCircle2,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import ComplianceFooter from "@/components/ComplianceFooter";
import SEOHead from "@/components/SEOHead";



const values = [
  {
    icon: Heart,
    title: "People First",
    description:
      "We believe everyone deserves access to fair lending. Our mission is to serve those overlooked by traditional banks.",
  },
  {
    icon: Shield,
    title: "Trust & Transparency",
    description:
      "No hidden fees, no surprises. We share every detail upfront so you can make confident financial decisions.",
  },
  {
    icon: Target,
    title: "Simple by Design",
    description:
      "From our application to repayment, every step is streamlined. Because borrowing money shouldn't be stressful.",
  },
  {
    icon: Users,
    title: "Community Focused",
    description:
      "We invest in financial education and support programs that help our borrowers build lasting financial health.",
  },
];

const milestones = [
  { year: "2020", event: "AmeriLend founded with a mission to simplify personal lending." },
  { year: "2021", event: "Reached 10,000 funded loans across 35 states." },
  { year: "2022", event: "Launched same-day funding and mobile-first experience." },
  { year: "2023", event: "Expanded loan offerings up to $15,000 with flexible terms." },
  { year: "2024", event: "Introduced AI-powered customer support and financial tools." },
  { year: "2025", event: "Expanded same-day funding options and launched enhanced mobile experience." },
];

export default function About() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-white text-gray-800">
      <SEOHead
        title="About Us"
        description="Learn about AmeriLend's mission to simplify personal lending. Founded in 2020, we've helped thousands get fast, fair personal loans with same-day funding."
        path="/about"
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

      {/* Hero Banner */}
      <section className="relative bg-[#0A2540] text-white py-20 md:py-28 overflow-hidden">
        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            About <span className="text-[#C9A227]">AmeriLend</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            We're on a mission to make personal lending simple, transparent, and accessible to everyone.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 w-full pointer-events-none">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="block w-full h-16 md:h-24">
            <path d="M0,40 C480,100 960,0 1440,40 L1440,100 L0,100 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">Our Story</h2>
            <div className="w-16 h-1 bg-[#C9A227] mx-auto rounded-full" />
          </div>
          <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
            <p>
              We started AmeriLend in 2020 because applying for a personal loan still felt like it belonged in 1995 — stacks of forms, 2-week waits, and impersonal service. We wanted to change that.
            </p>
            <p>
              Our team is based in San Diego, CA. We combine technology with experienced underwriting to offer personal loans from $1,000 to $15,000 with fixed rates and clear repayment terms. No origination fees, no hidden charges.
            </p>
            <p>
              Most of our borrowers use us for unexpected expenses — car repairs, medical bills, home fixes — and many come back or refer friends. That repeat trust is the metric we care about most.
            </p>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">What We Stand For</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Our values guide every decision we make — from product design to customer conversations.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {values.map((v) => (
              <div key={v.title} className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-[#0A2540]/10 rounded-xl flex items-center justify-center mb-4">
                  <v.icon className="w-6 h-6 text-[#0A2540]" />
                </div>
                <h3 className="text-xl font-bold text-[#0A2540] mb-2">{v.title}</h3>
                <p className="text-gray-600 leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">Our Journey</h2>
            <p className="text-gray-500 text-lg">Key milestones that shaped who we are today.</p>
          </div>
          <div className="relative">
            <div className="absolute left-4 md:left-1/2 md:-translate-x-px top-0 bottom-0 w-0.5 bg-[#C9A227]/30" />
            <div className="space-y-10">
              {milestones.map((m, i) => (
                <div key={m.year} className={`relative flex items-start gap-6 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} md:text-${i % 2 === 0 ? "right" : "left"}`}>
                  <div className="hidden md:block flex-1" />
                  <div className="relative z-10 w-9 h-9 rounded-full bg-[#C9A227] flex items-center justify-center flex-shrink-0 shadow-md">
                    <Award className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <span className="text-sm font-bold text-[#C9A227]">{m.year}</span>
                    <p className="text-gray-700 mt-1">{m.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* Licensing & Registration */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">Licensing & Registration</h2>
            <p className="text-gray-500 text-lg">
              AmeriLend is a licensed and regulated lender committed to full legal compliance.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-sm space-y-4 text-gray-600">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00875A] flex-shrink-0 mt-0.5" />
              <p><strong>NMLS# 2487301</strong> — Nationwide Multistate Licensing System. <a href="https://www.nmlsconsumeraccess.org/" target="_blank" rel="noopener noreferrer" className="text-[#C9A227] underline">Verify on NMLS Consumer Access</a>.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00875A] flex-shrink-0 mt-0.5" />
              <p>Licensed to lend in 48 states including California, Texas, Florida, New York, and Illinois.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00875A] flex-shrink-0 mt-0.5" />
              <p>Equal Housing Lender. All loans subject to credit approval and verification.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00875A] flex-shrink-0 mt-0.5" />
              <p>Registered business: <strong>AmeriLend, LLC</strong> — 12707 High Bluff Drive, Suite 200, San Diego, CA 92130, USA.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">
            Ready to get started?
          </h2>
          <p className="text-gray-500 text-lg mb-8">
            See your loan offers in minutes — no impact on your credit score.
          </p>
          <Link href="/check-offers">
            <Button size="lg" className="bg-[#C9A227] hover:bg-[#b8922a] text-white font-semibold rounded-full px-10 text-base shadow-md">
              See My Loan Offers <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <ComplianceFooter />
    </div>
  );
}
