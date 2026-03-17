import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BookOpen,
  TrendingUp,
  PiggyBank,
  CreditCard,
  Shield,
  Lightbulb,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { articles } from "./ArticlePage";
import FinancialNewsTicker from "@/components/FinancialNewsTicker";

const tips = [
  "Always read the full loan agreement before signing.",
  "Set up autopay to avoid late fees and potentially lower your rate.",
  "Check your credit report for free at AnnualCreditReport.com.",
  "Only borrow what you need and can comfortably repay.",
  "Build a 3-month emergency fund to reduce reliance on credit.",
];

export default function Resources() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  document.title = "Financial Resources | AmeriLend";
  return (
    <div className="min-h-screen bg-white text-gray-800">
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
            Financial <span className="text-[#C9A227]">Resources</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Tips, guides, and articles to help you make smarter financial decisions.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 w-full pointer-events-none">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="block w-full h-16 md:h-24">
            <path d="M0,40 C480,100 960,0 1440,40 L1440,100 L0,100 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">Learn & Grow</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Financial literacy is the foundation of financial freedom. Start here.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/resources/${article.slug}`}
                className="block"
              >
                <article
                  className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow group cursor-pointer h-full"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-[#C9A227]/10 rounded-xl flex items-center justify-center">
                      <article.icon className="w-5 h-5 text-[#C9A227]" />
                    </div>
                    <span className="text-xs font-bold text-[#C9A227] uppercase tracking-wider">
                      {article.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#0A2540] mb-2 group-hover:text-[#C9A227] transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">{article.excerpt}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{article.readTime}</span>
                    <span className="text-sm font-medium text-[#0A2540] flex items-center gap-1 group-hover:text-[#C9A227] transition-colors">
                      Read More <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Live Financial News */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4 max-w-5xl">
          <FinancialNewsTicker />
        </div>
      </section>

      {/* Quick Tips */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">Quick Money Tips</h2>
            <p className="text-gray-500 text-lg">Simple habits that make a big difference.</p>
          </div>
          <div className="space-y-4">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div className="w-8 h-8 bg-[#00875A] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">{i + 1}</span>
                </div>
                <p className="text-gray-700 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0A2540] py-16">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Need funds while you build?
          </h2>
          <p className="text-gray-300 text-lg mb-8">
            Check your loan offers — fast, easy, and no impact on your credit score.
          </p>
          <Link href="/check-offers">
            <Button size="lg" className="bg-[#C9A227] hover:bg-[#b8922a] text-white font-semibold rounded-full px-10 text-base shadow-md">
              See My Loan Offers <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-10">
        <div className="container mx-auto px-4 text-center text-sm text-gray-400">
          <p>© {new Date().getFullYear()} AmeriLend Financial. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-3">
            <Link href="/legal/privacy-policy" className="hover:text-gray-600">Privacy Policy</Link>
            <Link href="/legal/terms-of-service" className="hover:text-gray-600">Terms of Service</Link>
            <Link href="/contact" className="hover:text-gray-600">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
