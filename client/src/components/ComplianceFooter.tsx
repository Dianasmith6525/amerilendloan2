import { Link } from "wouter";
import { Phone, Mail, Clock, MapPin, Shield, Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import {
  APR_RANGE_TEXT,
  COMPANY_PHONE_DISPLAY_SHORT,
  COMPANY_PHONE_RAW,
  COMPANY_SUPPORT_EMAIL,
  LOAN_RANGE_TEXT,
  SUPPORT_HOURS_WEEKDAY,
  SUPPORT_HOURS_WEEKEND,
  TERM_RANGE_TEXT,
} from "@/const";

/**
 * Shared compliance footer for all public-facing pages.
 * Includes company identity, licensing, legal links, contact info, and regulatory disclosures.
 */
export default function ComplianceFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Top row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand & Company Identity */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/images/logo-new.jpg" alt="AmeriLend" className="h-8 w-auto rounded" />
              <span className="text-white font-bold text-lg">AmeriLend</span>
            </div>
            <p className="text-sm leading-relaxed mb-3">
              Personal loans made simple. Fast approvals, clear terms, and dedicated support.
            </p>
            <div className="text-xs space-y-1 text-gray-500">
              <p className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                12707 High Bluff Dr, Suite 200
              </p>
              <p className="pl-[18px]">San Diego, CA 92130</p>
              <p className="mt-2 text-gray-500">NMLS# 2487301</p>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <a href="https://facebook.com/amerilend" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" aria-label="Facebook"><Facebook className="w-4 h-4" /></a>
              <a href="https://twitter.com/amerilend" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" aria-label="Twitter"><Twitter className="w-4 h-4" /></a>
              <a href="https://instagram.com/amerilend" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" aria-label="Instagram"><Instagram className="w-4 h-4" /></a>
              <a href="https://linkedin.com/company/amerilend" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" aria-label="LinkedIn"><Linkedin className="w-4 h-4" /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/apply" className="hover:text-white transition-colors">Apply Now</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
              <li><Link href="/rates" className="hover:text-white transition-colors">Rates & Terms</Link></li>
              <li><Link href="/resources" className="hover:text-white transition-colors">Resources</Link></li>
              <li><Link href="/careers" className="hover:text-white transition-colors">Careers</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/legal/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/legal/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/legal/truth-in-lending" className="hover:text-white transition-colors">Truth in Lending</Link></li>
              <li><Link href="/legal/loan-agreement" className="hover:text-white transition-colors">Loan Agreement</Link></li>
              <li><Link href="/legal/esign-consent" className="hover:text-white transition-colors">E-Sign Consent</Link></li>
              <li><Link href="/legal/accessibility" className="hover:text-white transition-colors">Accessibility</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <a href={`tel:${COMPANY_PHONE_RAW}`} className="hover:text-white transition-colors">{COMPANY_PHONE_DISPLAY_SHORT}</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <a href={`mailto:${COMPANY_SUPPORT_EMAIL}`} className="hover:text-white transition-colors">{COMPANY_SUPPORT_EMAIL}</a>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>{SUPPORT_HOURS_WEEKDAY}</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>{SUPPORT_HOURS_WEEKEND}</span>
              </li>
              <li className="flex items-center gap-2">
                <Shield className="w-4 h-4 flex-shrink-0" />
                <span>256-bit SSL Encrypted</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Licensing & Registration */}
        <div className="border-t border-gray-800 pt-6 mb-6">
          <div className="text-xs text-center space-y-2 max-w-4xl mx-auto">
            <p className="text-gray-300 font-semibold">Licensing & Disclosures</p>
            <p>
              AmeriLend, LLC is a licensed lender. NMLS# 2487301. Licensed to lend in AL, AZ, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WI, WY.
            </p>
            <p>
              California: Loans made or arranged pursuant to a California Finance Lenders Law. |
              Texas: Licensed by the Office of Consumer Credit Commissioner.
            </p>
            <p>
              Loan amounts range from {LOAN_RANGE_TEXT}. APR ranges from {APR_RANGE_TEXT}. Terms from {TERM_RANGE_TEXT}.
              All loan terms are subject to credit approval and verification. Rates and terms may vary by state.
            </p>
          </div>
        </div>

        {/* Disclaimers */}
        <div className="border-t border-gray-800 pt-6 text-xs space-y-4">
          <p className="text-center">
            © {new Date().getFullYear()} AmeriLend, LLC. All Rights Reserved.{" "}
            <a href="/legal/terms-of-service" className="text-[#C9A227] hover:text-[#e0b83a] underline">Terms of Use</a>{" "}
            and{" "}
            <a href="/legal/privacy-policy" className="text-[#C9A227] hover:text-[#e0b83a] underline">Privacy Policy</a>.
          </p>

          <p className="text-center">
            Applications submitted on the AmeriLend platform will be originated by one of our bank partners and serviced by AmeriLend.
          </p>

          <div className="space-y-3 text-left max-w-4xl mx-auto">
            <p>
              <sup>1</sup> Subject to credit approval and verification. Funds may be deposited as soon as the same business day if verification is completed and final approval occurs before 12:00 PM CT. Availability depends on how quickly your bank processes the transaction.
            </p>
            <p>
              <sup>2</sup> AmeriLend's bank partners use soft credit inquiries during the application process that will not affect your FICO score.
            </p>
            <p>
              <sup>3</sup> AmeriLend and its bank partners report payment history to the three major credit bureaus. On-time payments may improve your credit score.
            </p>
          </div>

          <div className="border-t border-gray-800 pt-4 space-y-3 max-w-4xl mx-auto">
            <p className="font-semibold text-center text-gray-300">
              USA PATRIOT ACT NOTICE
            </p>
            <p className="text-center">
              Federal law requires all financial institutions to obtain, verify, and record information that identifies each person who opens an account.
            </p>
          </div>

          <div className="border-t border-gray-800 pt-4 text-center">
            <p>
              Questions? Call{" "}
              <a href={`tel:${COMPANY_PHONE_RAW}`} className="text-white hover:underline">{COMPANY_PHONE_DISPLAY_SHORT}</a>{" "}
              or email{" "}
              <a href={`mailto:${COMPANY_SUPPORT_EMAIL}`} className="text-white hover:underline">{COMPANY_SUPPORT_EMAIL}</a>.
            </p>
            <p className="mt-2 text-gray-500">
              Equal Housing Lender. All loans subject to credit approval.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
