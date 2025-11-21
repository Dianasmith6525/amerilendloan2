import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  Clock,
  Shield,
  FileText,
  Headphones,
  TrendingUp,
  ChevronDown,
  Menu,
  Phone,
  MessageCircle,
  Star,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { AISupport } from "@/components/AISupport";
import TestimonialsSection from "@/components/TestimonialsSection";
import { ApplicationTracking } from "@/components/ApplicationTracking";


export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' });
    }
  };

  const testimonials = [
    { name: "Sarah M.", location: "Austin, TX", rating: 5, text: "AmeriLend saved me when I needed emergency car repairs. The application was so easy and I got approved within hours!" },
    { name: "James T.", location: "Phoenix, AZ", rating: 5, text: "Best lending experience I've ever had. Transparent fees, quick approval, and amazing customer service." },
    { name: "Maria G.", location: "Miami, FL", rating: 5, text: "I was worried about my credit score, but AmeriLend worked with me. They truly care about helping people." },
    { name: "David R.", location: "Seattle, WA", rating: 5, text: "Fast, easy, and professional. Got the funds I needed for my medical bills without any hassle." },
    { name: "Jennifer L.", location: "Chicago, IL", rating: 5, text: "The mobile app makes everything so convenient. I can manage my loan payments right from my phone!" },
    { name: "Michael P.", location: "Dallas, TX", rating: 5, text: "Excellent rates and flexible payment options. AmeriLend really understands their customers' needs." },
    { name: "Lisa K.", location: "Atlanta, GA", rating: 5, text: "Customer support is top-notch. They answered all my questions and made me feel comfortable throughout the process." },
    { name: "Robert H.", location: "Denver, CO", rating: 5, text: "I've used other lenders before, but AmeriLend is by far the best. No hidden fees and very straightforward." },
    { name: "Amanda S.", location: "Portland, OR", rating: 5, text: "Got approved even with less than perfect credit. The team was understanding and helpful every step of the way." },
    { name: "Christopher B.", location: "Boston, MA", rating: 5, text: "Quick turnaround time and competitive rates. Highly recommend for anyone needing a personal loan." },
    { name: "Patricia D.", location: "Las Vegas, NV", rating: 5, text: "The online application took less than 10 minutes. Money was in my account the next business day!" },
    { name: "Daniel W.", location: "San Diego, CA", rating: 5, text: "Professional, reliable, and trustworthy. AmeriLend helped me consolidate my debt and save money." },
    { name: "Jessica F.", location: "Nashville, TN", rating: 5, text: "Great experience from start to finish. The loan officer explained everything clearly and patiently." },
    { name: "Thomas A.", location: "Charlotte, NC", rating: 5, text: "I needed funds urgently and AmeriLend delivered. Fast approval and same-day funding!" },
    { name: "Michelle C.", location: "Minneapolis, MN", rating: 5, text: "Very impressed with how smooth the process was. No unnecessary paperwork or delays." },
    { name: "Kevin J.", location: "Tampa, FL", rating: 5, text: "The interest rates are reasonable and the payment plans are flexible. Perfect for my situation." },
    { name: "Rachel N.", location: "Philadelphia, PA", rating: 5, text: "AmeriLend treats you like a person, not just a number. Refreshing customer service!" },
    { name: "Brian M.", location: "San Antonio, TX", rating: 5, text: "Straightforward process with no surprises. Everything was exactly as promised." },
    { name: "Nicole V.", location: "Columbus, OH", rating: 5, text: "I was skeptical at first, but AmeriLend exceeded my expectations. Highly recommended!" },
    { name: "Steven E.", location: "Indianapolis, IN", rating: 5, text: "Great communication throughout the entire process. Always kept me informed of the status." },
    { name: "Kimberly R.", location: "Sacramento, CA", rating: 5, text: "The best part? No prepayment penalties! I can pay off my loan early without extra fees." },
    { name: "Joseph L.", location: "Kansas City, MO", rating: 5, text: "Needed money for home repairs and AmeriLend came through. Simple, fast, and reliable." },
    { name: "Angela W.", location: "Baltimore, MD", rating: 5, text: "Customer service team is incredibly helpful and friendly. They made everything stress-free." },
    { name: "Charles T.", location: "Milwaukee, WI", rating: 5, text: "I've recommended AmeriLend to all my friends. Best online lending platform I've used." },
    { name: "Melissa H.", location: "Albuquerque, NM", rating: 5, text: "The transparency is what I appreciate most. No hidden fees or fine print surprises." },
    { name: "Richard K.", location: "Louisville, KY", rating: 5, text: "Got my loan approved despite having had financial troubles in the past. Very grateful!" },
    { name: "Laura P.", location: "Oklahoma City, OK", rating: 5, text: "Fast, efficient, and professional service. Everything I needed in a lender." },
    { name: "Eric S.", location: "Raleigh, NC", rating: 5, text: "The mobile app is fantastic. Managing my loan has never been easier." },
    { name: "Stephanie B.", location: "Memphis, TN", rating: 5, text: "AmeriLend helped me during a tough financial situation. Forever grateful for their support." },
    { name: "Gregory M.", location: "Richmond, VA", rating: 5, text: "Competitive rates and excellent customer service. What more could you ask for?" },
    { name: "Heather D.", location: "New Orleans, LA", rating: 5, text: "The approval process was incredibly quick. Had my funds within 24 hours!" },
    { name: "Andrew F.", location: "Salt Lake City, UT", rating: 5, text: "Very professional team and easy-to-understand loan terms. No confusion whatsoever." },
    { name: "Christina G.", location: "Birmingham, AL", rating: 5, text: "I was nervous about applying for a loan online, but AmeriLend made it so easy and secure." },
    { name: "Jason R.", location: "Rochester, NY", rating: 5, text: "Great experience! The whole process was seamless from application to funding." },
    { name: "Samantha L.", location: "Grand Rapids, MI", rating: 5, text: "AmeriLend gave me a second chance when other lenders turned me down. Truly appreciate it!" },
    { name: "Matthew W.", location: "Tucson, AZ", rating: 5, text: "Flexible payment options made it easy to fit the loan into my budget. Highly recommend!" },
    { name: "Elizabeth T.", location: "Fresno, CA", rating: 5, text: "The customer support team went above and beyond to help me. Excellent service!" },
    { name: "Ryan C.", location: "Mesa, AZ", rating: 5, text: "Quick approval, fair rates, and great customer service. Everything you need in a lender." },
    { name: "Rebecca N.", location: "Virginia Beach, VA", rating: 5, text: "I love how transparent they are about all fees and terms. No surprises at all!" },
    { name: "Justin H.", location: "Omaha, NE", rating: 5, text: "AmeriLend helped me consolidate my credit card debt. Now I'm on track to being debt-free!" },
    { name: "Katherine M.", location: "Colorado Springs, CO", rating: 5, text: "The application process was so simple, even my tech-challenged dad could do it!" },
    { name: "Brandon S.", location: "Arlington, TX", rating: 5, text: "Fast funding and reasonable terms. Exactly what I needed for my business expenses." },
    { name: "Vanessa P.", location: "Wichita, KS", rating: 5, text: "Outstanding service from start to finish. The team really knows what they're doing." },
    { name: "Timothy J.", location: "St. Louis, MO", rating: 5, text: "I was approved within minutes and had my money the same day. Incredible service!" },
    { name: "Brittany K.", location: "Santa Ana, CA", rating: 5, text: "AmeriLend is legit! No scams, no hidden fees, just honest lending." },
    { name: "Aaron D.", location: "Corpus Christi, TX", rating: 5, text: "The interest rates are very competitive. Saved me money compared to other lenders." },
    { name: "Danielle R.", location: "Lexington, KY", rating: 5, text: "Great for emergencies! Got approved quickly when I needed money for unexpected expenses." },
    { name: "Kenneth L.", location: "Henderson, NV", rating: 5, text: "Professional, courteous, and efficient. AmeriLend sets the standard for online lending." },
    { name: "Amber W.", location: "Plano, TX", rating: 5, text: "The process was painless and the funds arrived exactly when promised. A+ service!" },
    { name: "Derek M.", location: "Lincoln, NE", rating: 5, text: "I've used AmeriLend twice now and both times the experience was excellent." },
    { name: "Courtney F.", location: "Orlando, FL", rating: 5, text: "They worked with my budget to create a payment plan I could actually afford. So helpful!" },
    { name: "Travis B.", location: "Irvine, CA", rating: 5, text: "Best online loan experience ever. Fast, easy, and completely stress-free." },
    { name: "Allison H.", location: "Boise, ID", rating: 5, text: "AmeriLend treated me with respect and dignity. They really care about their customers." },
    { name: "Marcus G.", location: "Spokane, WA", rating: 5, text: "The transparency and honesty of this company is refreshing. Highly recommend!" },
    { name: "Tiffany S.", location: "Des Moines, IA", rating: 5, text: "Got my loan approved even though I'm self-employed. Very flexible and understanding!" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header/Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-2 sm:py-2.5 md:py-3">
          <div className="flex items-center justify-between gap-4 sm:gap-6">
            {/* Logo */}
            <Link href="/">
              <a className="flex items-center flex-shrink-0">
                <img
                  src="/logo.jpg"
                  alt="AmeriLend"
                  className="h-24 sm:h-28 md:h-32 w-auto object-contain"
                  style={{ filter: 'contrast(1.1) brightness(1.05)' }}
                />
              </a>
            </Link>

            {/* Desktop Navigation - Hidden on Mobile */}
            <nav className="hidden md:flex items-center gap-4 flex-1">
              <Link href="/apply">
                <a className="text-sm text-gray-700 hover:text-[#0033A0] whitespace-nowrap font-medium">Loans</a>
              </Link>
              <a href="#about" className="text-sm text-gray-700 hover:text-[#0033A0] whitespace-nowrap font-medium">About Us</a>
              <a href="#faq" className="text-sm text-gray-700 hover:text-[#0033A0] whitespace-nowrap font-medium">Help</a>
              <a href="tel:+19452121609" className="text-sm text-gray-700 hover:text-[#0033A0] whitespace-nowrap font-medium flex items-center gap-1">
                <Phone className="w-4 h-4" />
                +1 945 212-1609
              </a>
            </nav>



            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-1.5">
              {isAuthenticated ? (
                <>
                  <Link href="/apply">
                    <Button className="bg-[#FFA500] hover:bg-[#FF8C00] text-white font-semibold px-3 py-1.5 text-xs whitespace-nowrap">
                      Apply Now
                    </Button>
                  </Link>
                  <Link href="/dashboard">
                    <Button variant="outline" className="border-[#0033A0] text-[#0033A0] hover:bg-[#0033A0] hover:text-white px-3 py-1.5 text-xs whitespace-nowrap">
                      Dashboard
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/apply">
                    <Button className="bg-[#FFA500] hover:bg-[#FF8C00] text-white font-semibold px-3 py-1.5 text-xs whitespace-nowrap">
                      Apply Now
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="border-[#0033A0] text-[#0033A0] hover:bg-[#0033A0] hover:text-white px-3 py-1.5 text-xs whitespace-nowrap"
                    asChild
                  >
                    <a href="/login">Log In</a>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t mt-4">
              <nav className="flex flex-col gap-4">
                <Link href="/apply">
                  <a className="text-gray-700 hover:text-[#0033A0] text-base font-medium">Loans</a>
                </Link>
                <a href="#about" className="text-gray-700 hover:text-[#0033A0] text-base font-medium">
                  About Us
                </a>
                <a href="#faq" className="text-gray-700 hover:text-[#0033A0] text-base font-medium">
                  Help
                </a>
                <a href="tel:+19452121609" className="text-gray-700 hover:text-[#0033A0] text-base font-medium flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  +1 945 212-1609
                </a>
                <div className="border-t pt-4 mt-4 flex flex-col gap-3">
                  <Link href="/apply">
                    <Button className="bg-[#FFA500] hover:bg-[#FF8C00] text-white w-full text-base font-semibold py-3">
                      Apply Now
                    </Button>
                  </Link>
                  {isAuthenticated ? (
                    <Link href="/dashboard">
                      <Button variant="outline" className="w-full border-[#0033A0] text-[#0033A0] text-base font-semibold py-3">
                        Dashboard
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full border-[#0033A0] text-[#0033A0] text-base font-semibold py-3"
                      asChild
                    >
                      <a href="/login">Log In</a>
                    </Button>
                  )}
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section - OppLoans Style */}
      <section className="relative bg-gradient-to-br from-[#0033A0] via-[#0044BB] to-[#0055CC] py-16 sm:py-24 md:py-32 overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        
        {/* Content */}
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 sm:mb-8 leading-tight">
              Online Loans
              <br />
              Designed for You
            </h1>

            <ul className="space-y-3 mb-8 sm:mb-10 text-white/95 max-w-2xl mx-auto">
              <li className="flex items-start gap-3 text-left">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" />
                <span className="text-base sm:text-lg">
                  Same-day funding available.<sup className="text-sm">1</sup>
                </span>
              </li>
              <li className="flex items-start gap-3 text-left">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" />
                <span className="text-base sm:text-lg">
                  Applying does NOT affect your FICO® credit score.<sup className="text-sm">2</sup>
                </span>
              </li>
              <li className="flex items-start gap-3 text-left">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" />
                <span className="text-base sm:text-lg">No hidden fees.</span>
              </li>
            </ul>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
              <Link href="/apply">
                <Button size="lg" className="bg-[#FFA500] hover:bg-[#FF8C00] text-white font-bold px-10 py-6 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all w-full sm:w-auto">
                  Apply Now
                </Button>
              </Link>
            </div>

            <p className="text-sm text-white/90">
              Applying does NOT affect your FICO® credit score.<sup className="text-xs">2</sup>
            </p>
            
            <p className="text-sm text-white/80 mt-4">
              Did you receive a code in the mail?{" "}
              <Link href="/tracking">
                <a className="text-white underline hover:text-white/80 font-medium">
                  Click here
                </a>
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Process Section - Blue Background */}
      <section className="bg-[#0033A0] text-white py-12 sm:py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
            {/* Process Steps */}
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
                Simple Loan Application Process
              </h2>
              <p className="text-sm sm:text-base text-white/90 mb-6 sm:mb-8">
                Working with trusted financial partners, the AmeriLend platform offers personal loans designed to fit your needs. The process is simple and built around you:
              </p>

              <div className="space-y-4 sm:space-y-6">
                {/* Step 1 */}
                <div className="flex gap-3 sm:gap-4">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white text-[#0033A0] flex items-center justify-center text-lg sm:text-xl font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-bold text-base sm:text-lg mb-1">Apply Online</h3>
                    <p className="text-xs sm:text-sm text-white/90">
                      The application process is quick and easy, with decisions often made in minutes.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3 sm:gap-4">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white text-[#0033A0] flex items-center justify-center text-lg sm:text-xl font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold text-base sm:text-lg mb-1">Approval Process</h3>
                    <p className="text-xs sm:text-sm text-white/90">
                      We consider more than just your credit score, so even if you've been turned down by others, you may still qualify.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3 sm:gap-4">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white text-[#0033A0] flex items-center justify-center text-lg sm:text-xl font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-bold text-base sm:text-lg mb-1">Same-Day Funding Available</h3>
                    <p className="text-xs sm:text-sm text-white/90">
                      If approved, you may receive money in your account as soon as the same business day!<sup>1</sup>
                    </p>
                  </div>
                </div>
              </div>

              <Link href="/apply">
                <Button className="bg-[#FFA500] hover:bg-[#FF8C00] text-white font-semibold px-6 sm:px-8 py-3 sm:py-6 text-sm sm:text-base md:text-lg mt-6 sm:mt-8 w-full sm:w-auto">
                  Apply Now
                </Button>
              </Link>

              <p className="text-xs sm:text-sm text-white/80 mt-2 sm:mt-4">
                Applying does NOT affect your FICO® credit score.<sup>2</sup>
              </p>
            </div>

            {/* Eligibility Requirements Card - Right Column */}
            <div className="bg-white text-gray-800 rounded-lg p-4 sm:p-6 md:p-8 shadow-xl h-fit">
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-[#0033A0] mb-4 sm:mb-6">
                Before you get started, let's review our eligibility requirements.
              </h3>

              <ul className="space-y-3 sm:space-y-4">
                <li className="flex items-start gap-2 sm:gap-3">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-[#0033A0]" />
                  </div>
                  <span className="text-xs sm:text-sm md:text-base">Be at least 18 years old</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#0033A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-sm md:text-base">Reside in the United States</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-[#0033A0]" />
                  </div>
                  <span className="text-sm md:text-base">Have a regular source of income</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#0033A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="text-sm md:text-base">Have a checking or savings account</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#0033A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm md:text-base">Receive paychecks through direct deposit</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Loan Types Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0033A0] mb-4">
              Loan Options for Every Need
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Choose from our wide range of loan products designed to meet your specific financial needs
            </p>
            <div className="mt-4 p-4 bg-[#FFA500]/10 rounded-lg max-w-3xl mx-auto">
              <p className="text-sm text-[#0033A0] font-semibold">
                Processing fee: 3.5% (paid upfront via credit/debit card or crypto before loan disbursement)
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Accepted: Visa, Mastercard, American Express, Bitcoin, Ethereum, USDT
              </p>
            </div>
          </div>

          <div className="flex overflow-x-auto scroll-smooth gap-4 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Personal Loan */}
            <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white flex-shrink-0 w-full sm:w-96">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">Quick</span>
                </div>
                <h3 className="text-base font-bold text-[#0033A0] mb-2">Personal Loan</h3>
                <p className="text-sm text-gray-600 mb-3 flex-grow">Flexible loans for any need</p>
                <div className="flex gap-3 text-xs text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded">$1K-$50K</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">12-60mo</span>
                </div>
                <Link href="/apply?type=personal">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 text-sm">Apply Now</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Debt Consolidation */}
            <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white flex-shrink-0 w-full sm:w-96">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-1 rounded">Save</span>
                </div>
                <h3 className="text-base font-bold text-[#0033A0] mb-2">Debt Consolidation</h3>
                <p className="text-sm text-gray-600 mb-3 flex-grow">Combine debts into one payment</p>
                <div className="flex gap-3 text-xs text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded">$2K-$100K</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">24-84mo</span>
                </div>
                <Link href="/apply?type=debt-consolidation">
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 text-sm">Apply Now</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Medical Loan */}
            <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 to-white flex-shrink-0 w-full sm:w-96">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36c-.5-.63-1.5-.69-2.12-.12-.63.5-.69 1.49-.12 2.12l3.5 4.21c.5.63 1.5.69 2.12.12l4.25-5.13c.56-.67.48-1.66-.19-2.22-.67-.56-1.66-.48-2.22.19z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded">Care</span>
                </div>
                <h3 className="text-base font-bold text-[#0033A0] mb-2">Medical Loan</h3>
                <p className="text-sm text-gray-600 mb-3 flex-grow">Cover healthcare procedures</p>
                <div className="flex gap-3 text-xs text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded">$500-$50K</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">12-72mo</span>
                </div>
                <Link href="/apply?type=medical">
                  <Button className="w-full bg-red-600 hover:bg-red-700 text-white py-2 text-sm">Apply Now</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Home Improvement */}
            <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-white flex-shrink-0 w-full sm:w-96">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V9l-7-7z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-1 rounded">Build</span>
                </div>
                <h3 className="text-base font-bold text-[#0033A0] mb-2">Home Improvement</h3>
                <p className="text-sm text-gray-600 mb-3 flex-grow">Renovate and upgrade your home</p>
                <div className="flex gap-3 text-xs text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded">$3K-$100K</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">24-120mo</span>
                </div>
                <Link href="/apply?type=home-improvement">
                  <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 text-sm">Apply Now</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Auto Loan */}
            <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white flex-shrink-0 w-full sm:w-96">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm11 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM5 11l1.5-4.5h11L19 11H5z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">Drive</span>
                </div>
                <h3 className="text-base font-bold text-[#0033A0] mb-2">Auto Loan</h3>
                <p className="text-sm text-gray-600 mb-3 flex-grow">Finance your next vehicle</p>
                <div className="flex gap-3 text-xs text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded">$5K-$75K</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">24-84mo</span>
                </div>
                <Link href="/apply?type=auto">
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 text-sm">Apply Now</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Business Loan */}
            <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50 to-white flex-shrink-0 w-full sm:w-96">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S15.33 8 14.5 8 13 8.67 13 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S8.33 8 7.5 8 6 8.67 6 9.5 6.67 11 7.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">Grow</span>
                </div>
                <h3 className="text-base font-bold text-[#0033A0] mb-2">Business Loan</h3>
                <p className="text-sm text-gray-600 mb-3 flex-grow">Fuel business growth</p>
                <div className="flex gap-3 text-xs text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded">$10K-$500K</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">12-120mo</span>
                </div>
                <Link href="/apply?type=business">
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 text-sm">Apply Now</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Emergency Loan */}
            <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-white flex-shrink-0 w-full sm:w-96">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-1 rounded">Urgent</span>
                </div>
                <h3 className="text-base font-bold text-[#0033A0] mb-2">Emergency Loan</h3>
                <p className="text-sm text-gray-600 mb-3 flex-grow">Fast cash when you need it</p>
                <div className="flex gap-3 text-xs text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded">$500-$10K</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">6-36mo</span>
                </div>
                <Link href="/apply?type=emergency">
                  <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 text-sm">Apply Now</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Wedding Loan */}
            <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-pink-500 bg-gradient-to-br from-pink-50 to-white flex-shrink-0 w-full sm:w-96">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-pink-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-pink-600 bg-pink-100 px-2 py-1 rounded">Dream</span>
                </div>
                <h3 className="text-base font-bold text-[#0033A0] mb-2">Wedding Loan</h3>
                <p className="text-sm text-gray-600 mb-3 flex-grow">Make your day special</p>
                <div className="flex gap-3 text-xs text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded">$2K-$50K</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">12-60mo</span>
                </div>
                <Link href="/apply?type=wedding">
                  <Button className="w-full bg-pink-600 hover:bg-pink-700 text-white py-2 text-sm">Apply Now</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Vacation Loan */}
            <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-white flex-shrink-0 w-full sm:w-96">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 6h-8l-1-1h-2l-1 1H4c-1.1 0-1.99.9-1.99 2L2 19c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 13H4V8h16v11zm-5.04-6.71l-2.75 3.54-1.96-2.36c-.5-.63-1.5-.69-2.12-.12-.63.5-.69 1.49-.12 2.12l3.5 4.21c.5.63 1.5.69 2.12.12l4.25-5.13c.56-.67.48-1.66-.19-2.22-.67-.56-1.66-.48-2.22.19z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-cyan-600 bg-cyan-100 px-2 py-1 rounded">Escape</span>
                </div>
                <h3 className="text-base font-bold text-[#0033A0] mb-2">Vacation Loan</h3>
                <p className="text-sm text-gray-600 mb-3 flex-grow">Travel without worry</p>
                <div className="flex gap-3 text-xs text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded">$1K-$25K</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">12-48mo</span>
                </div>
                <Link href="/apply?type=vacation">
                  <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2 text-sm">Apply Now</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Student Loan Refinance */}
            <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-teal-500 bg-gradient-to-br from-teal-50 to-white flex-shrink-0 w-full sm:w-96">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S15.33 8 14.5 8 13 8.67 13 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S8.33 8 7.5 8 6 8.67 6 9.5 6.67 11 7.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-teal-600 bg-teal-100 px-2 py-1 rounded">Learn</span>
                </div>
                <h3 className="text-base font-bold text-[#0033A0] mb-2">Student Loan Refinance</h3>
                <p className="text-sm text-gray-600 mb-3 flex-grow">Lower your education debt</p>
                <div className="flex gap-3 text-xs text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded">$5K-$150K</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">60-240mo</span>
                </div>
                <Link href="/apply?type=student-refinance">
                  <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 text-sm">Apply Now</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Moving/Relocation Loan */}
            <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-rose-500 bg-gradient-to-br from-rose-50 to-white flex-shrink-0 w-full sm:w-96">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-rose-600 bg-rose-100 px-2 py-1 rounded">Move</span>
                </div>
                <h3 className="text-base font-bold text-[#0033A0] mb-2">Moving/Relocation Loan</h3>
                <p className="text-sm text-gray-600 mb-3 flex-grow">Relocation made easy</p>
                <div className="flex gap-3 text-xs text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded">$1K-$20K</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">12-48mo</span>
                </div>
                <Link href="/apply?type=moving">
                  <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2 text-sm">Apply Now</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Green Energy Loan */}
            <Card className="hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-lime-500 bg-gradient-to-br from-lime-50 to-white flex-shrink-0 w-full sm:w-96">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-lime-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.41 1.41c1.04 1.04 1.68 2.48 1.68 4.08 0 3.09-2.51 5.6-5.6 5.6s-5.6-2.51-5.6-5.6c0-1.6.64-3.04 1.68-4.08l-1.41-1.41C2.82 5.75 2 7.6 2 9.66c0 5.02 4.08 9.1 9.1 9.1s9.1-4.08 9.1-9.1c0-2.06-.82-3.91-2.17-5.49z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-lime-600 bg-lime-100 px-2 py-1 rounded">Green</span>
                </div>
                <h3 className="text-base font-bold text-[#0033A0] mb-2">Green Energy Loan</h3>
                <p className="text-sm text-gray-600 mb-3 flex-grow">Go eco-friendly</p>
                <div className="flex gap-3 text-xs text-gray-600 mb-4">
                  <span className="bg-gray-100 px-2 py-1 rounded">$5K-$100K</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">36-240mo</span>
                </div>
                <Link href="/apply?type=green-energy">
                  <Button className="w-full bg-lime-600 hover:bg-lime-700 text-white py-2 text-sm">Apply Now</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Why AmeriLend Section - OppLoans Style */}
      <section className="bg-gray-50 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#0033A0] text-center mb-4">
            Why AmeriLend Is Right For You
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            We're committed to providing accessible, transparent, and customer-focused financial solutions
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
            {/* Easy to Apply */}
            <Card className="border-t-4 border-t-[#FFA500] hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="w-14 h-14 rounded-full bg-[#FFA500]/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-7 h-7 text-[#FFA500]" />
                </div>
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Easy to Apply</h3>
                <p className="text-gray-600 leading-relaxed">
                  Our online application process is convenient and only requires personal and employment information for quick and easy completion.
                </p>
              </CardContent>
            </Card>

            {/* Same-Day Funding */}
            <Card className="border-t-4 border-t-[#0033A0] hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="w-14 h-14 rounded-full bg-[#0033A0]/10 flex items-center justify-center mb-4">
                  <Clock className="w-7 h-7 text-[#0033A0]" />
                </div>
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Same-Day Funding Available</h3>
                <p className="text-gray-600 leading-relaxed">
                  If approved, you may receive money in your account as soon as the same business day!<sup className="text-xs">1</sup>
                </p>
              </CardContent>
            </Card>

            {/* Loan Support */}
            <Card className="border-t-4 border-t-green-500 hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <Headphones className="w-7 h-7 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Loan Support At Every Step</h3>
                <p className="text-gray-600 leading-relaxed">
                  Our top-rated Loan Advocates are available to provide support at every step of the application process. We succeed when you do!
                </p>
              </CardContent>
            </Card>

            {/* Safe and Secure */}
            <Card className="border-t-4 border-t-blue-500 hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                  <Shield className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Safe and Secure</h3>
                <p className="text-gray-600 leading-relaxed">
                  We are dedicated to protecting your information and communications with advanced 256-bit encryption technology.
                </p>
              </CardContent>
            </Card>

            {/* Transparent Process */}
            <Card className="border-t-4 border-t-purple-500 hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                  <FileText className="w-7 h-7 text-purple-500" />
                </div>
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Transparent Process</h3>
                <p className="text-gray-600 leading-relaxed">
                  We supply you with an easy-to-read schedule with predictable payments and the ability to set up automatic payments.
                </p>
              </CardContent>
            </Card>

            {/* Build Credit History */}
            <Card className="border-t-4 border-t-teal-500 hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="w-14 h-14 rounded-full bg-teal-500/10 flex items-center justify-center mb-4">
                  <TrendingUp className="w-7 h-7 text-teal-500" />
                </div>
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Build Credit History</h3>
                <p className="text-gray-600 leading-relaxed">
                  We report your payment history to the three major credit bureaus, so every on-time payment you make may help boost your credit history.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0033A0] text-center mb-12">
            About AmeriLend
          </h2>

          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div>
              <h3 className="text-2xl font-bold text-[#0033A0] mb-6">
                Making Personal Loans Accessible to Everyone
              </h3>
              <p className="text-gray-600 mb-6">
                AmeriLend is committed to providing fast, fair, and transparent personal loans to help you achieve your financial goals. We understand that life can be unpredictable, and we're here to support you every step of the way.
              </p>
              <p className="text-gray-600 mb-6">
                Our mission is to democratize access to credit by using innovative technology and a customer-first approach. We partner with trusted financial institutions to offer competitive rates and flexible terms that work for you.
              </p>
              <p className="text-gray-600">
                With years of experience in the financial services industry, we've helped thousands of customers secure the funding they need for emergencies, debt consolidation, home improvements, and more.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-8">
              <h4 className="text-xl font-bold text-[#0033A0] mb-6">Our Values</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700"><strong>Transparency:</strong> Clear terms, no hidden fees</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700"><strong>Speed:</strong> Fast approvals and funding</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700"><strong>Support:</strong> Dedicated loan advocates</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700"><strong>Innovation:</strong> Using technology for better service</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* States We Service Section */}
      <section id="states" className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0033A0] text-center mb-12">
            States We Service
          </h2>

          <div className="max-w-6xl mx-auto">
            <p className="text-center text-gray-600 mb-8">
              AmeriLend is proud to serve customers in all 50 states across the United States.
            </p>

            <div className="relative">
              {/* Left Scroll Button */}
              <button
                onClick={scrollLeft}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-3 hover:bg-gray-100 transition-colors"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-6 h-6 text-[#0033A0]" />
              </button>

              {/* Scrollable States Container */}
              <div
                ref={scrollContainerRef}
                className="flex gap-3 overflow-x-auto scroll-smooth px-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Alabama</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Alaska</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Arizona</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Arkansas</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">California</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Colorado</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Connecticut</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Delaware</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Florida</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Georgia</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Hawaii</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Idaho</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Illinois</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Indiana</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Iowa</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Kansas</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Kentucky</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Louisiana</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Maine</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Maryland</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Massachusetts</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Michigan</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Minnesota</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Mississippi</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Missouri</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Montana</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Nebraska</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Nevada</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">New Hampshire</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">New Jersey</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">New Mexico</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">New York</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">North Carolina</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">North Dakota</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Ohio</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Oklahoma</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Oregon</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Pennsylvania</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Rhode Island</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">South Carolina</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">South Dakota</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Tennessee</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Texas</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Utah</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Vermont</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Virginia</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Washington</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">West Virginia</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Wisconsin</div>
                <div className="bg-white px-6 py-3 rounded shadow-sm text-gray-700 whitespace-nowrap flex-shrink-0">Wyoming</div>
              </div>

              {/* Right Scroll Button */}
              <button
                onClick={scrollRight}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-3 hover:bg-gray-100 transition-colors"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-6 h-6 text-[#0033A0]" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Careers Section */}
      <section id="careers" className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0033A0] text-center mb-12">
            Join Our Team
          </h2>

          <div className="max-w-4xl mx-auto text-center mb-12">
            <p className="text-gray-600 text-lg">
              We're always looking for talented individuals who are passionate about helping people achieve their financial goals. Join our growing team and make a difference in people's lives.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 rounded-full bg-[#0033A0] flex items-center justify-center mx-auto mb-4">
                  <Headphones className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Loan Advocate</h3>
                <p className="text-gray-600 mb-4">
                  Help customers navigate their loan applications and provide exceptional support throughout the process.
                </p>
                <Button asChild className="border-[#0033A0] text-[#0033A0] hover:bg-[#0033A0] hover:text-white" variant="outline">
                  <a href="/careers" className="no-underline">
                    Learn More
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 rounded-full bg-[#0033A0] flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Risk Analyst</h3>
                <p className="text-gray-600 mb-4">
                  Analyze loan applications and ensure responsible lending practices while helping qualified applicants.
                </p>
                <Button asChild className="border-[#0033A0] text-[#0033A0] hover:bg-[#0033A0] hover:text-white" variant="outline">
                  <a href="/careers" className="no-underline">
                    Learn More
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 rounded-full bg-[#0033A0] flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Marketing Specialist</h3>
                <p className="text-gray-600 mb-4">
                  Develop strategies to reach customers and educate them about responsible borrowing options.
                </p>
                <Button asChild className="border-[#0033A0] text-[#0033A0] hover:bg-[#0033A0] hover:text-white" variant="outline">
                  <a href="/careers" className="no-underline">
                    Learn More
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 mb-6">
              Don't see a position that matches your skills? We're always interested in hearing from talented individuals.
            </p>
            <Button asChild className="bg-[#FFA500] hover:bg-[#FF8C00] text-white font-semibold px-8">
              <a href="/careers">
                View All Openings
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits Section - Blue Background */}
      <section className="bg-[#0033A0] text-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Why AmeriLend Is Right For You
          </h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Benefit 1 */}
            <Card className="bg-white text-gray-800 relative pt-8">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-full bg-[#0033A0] flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <CardContent className="pt-8 pb-6 text-center">
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Easy to Apply</h3>
                <p className="text-gray-600">
                  Our online application process is convenient and only requires personal and employment information for quick and easy completion.
                </p>
              </CardContent>
            </Card>

            {/* Benefit 2 */}
            <Card className="bg-white text-gray-800 relative pt-8">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-full bg-[#0033A0] flex items-center justify-center">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <CardContent className="pt-8 pb-6 text-center">
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Same-Day Funding Available</h3>
                <p className="text-gray-600">
                  If approved, you may receive money in your account as soon as the same business day!<sup>1</sup>
                </p>
              </CardContent>
            </Card>

            {/* Benefit 3 */}
            <Card className="bg-white text-gray-800 relative pt-8">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-full bg-[#0033A0] flex items-center justify-center">
                <Headphones className="w-8 h-8 text-white" />
              </div>
              <CardContent className="pt-8 pb-6 text-center">
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Loan Support At Every Step</h3>
                <p className="text-gray-600">
                  Our top-rated Loan Advocates are available to provide support at every step of the application process. We succeed when you do!
                </p>
              </CardContent>
            </Card>



            {/* Benefit 5 */}
            <Card className="bg-white text-gray-800 relative pt-8">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-full bg-[#0033A0] flex items-center justify-center">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <CardContent className="pt-8 pb-6 text-center">
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Transparent Process</h3>
                <p className="text-gray-600">
                  We supply you with an easy-to-read schedule with predictable payments and the ability to set up automatic payments.
                </p>
              </CardContent>
            </Card>

            {/* Benefit 6 */}
            <Card className="bg-white text-gray-800 relative pt-8">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-full bg-[#0033A0] flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <CardContent className="pt-8 pb-6 text-center">
                <h3 className="text-xl font-bold text-[#0033A0] mb-3">Build Credit History</h3>
                <p className="text-gray-600">
                  We report your payment history to the three major credit bureaus, so every on-time payment you make may help boost your credit history.<sup>6</sup>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Trusted By Section with Logos */}
        </div>
      </section>

      {/* Trusted By Section - White Background */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="mt-0 pt-0">
            <p className="text-center text-gray-700 text-lg mb-8">Trusted by leading platforms</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-16">
              {/* LendingTree Logo */}
              <div className="flex items-center justify-center">
                <img 
                  src="/lending-tree-logo.svg" 
                  alt="LendingTree" 
                  className="h-12 md:h-14 w-auto"
                />
              </div>

              {/* Trustpilot Logo */}
              <div className="flex items-center justify-center">
                <img 
                  src="/trustpilot-logo.svg" 
                  alt="Trustpilot" 
                  className="h-12 md:h-14 w-auto"
                />
              </div>

              {/* BBB Logo */}
              <div className="flex items-center justify-center">
                <img 
                  src="/images/bbb.png" 
                  alt="Better Business Bureau" 
                  className="h-12 md:h-14 w-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* FAQ Section */}
      <section id="faq" className="bg-gray-50 py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0033A0] text-center mb-12">
            FAQs
          </h2>

          <div className="space-y-4">
            {[
              {
                question: "What are the eligibility requirements to apply for a loan?",
                answer:
                  "To apply, you must be at least 18 years old, reside in one of our serviced states, have a regular source of income, maintain a checking or savings account, and receive paychecks through direct deposit.",
                color: "border-l-orange-500",
              },
              {
                question: "How much money can I apply for?",
                answer:
                  "Loan amounts vary based on your state of residence, income, and creditworthiness. Typically, you can apply for loans ranging from $500 to $10,000.",
                color: "border-l-purple-500",
              },
              {
                question: "How are AmeriLend loans different?",
                answer:
                  "We consider more than just your credit score during the approval process. Our transparent fee structure, same-day funding options, and dedicated loan advocates set us apart from traditional lenders.",
                color: "border-l-teal-500",
              },
              {
                question: "What can you use a personal loan for?",
                answer:
                  "Personal loans can be used for various purposes including debt consolidation, emergency expenses, home improvements, medical bills, or unexpected costs. However, they cannot be used for illegal activities or speculative investments.",
                color: "border-l-pink-500",
              },
              {
                question: "How does repayment of a personal loan work?",
                answer:
                  "Repayment is structured with fixed installments over a predetermined period. You'll receive a clear repayment schedule showing all payment dates and amounts. We offer automatic payment options for your convenience.",
                color: "border-l-blue-500",
              },
            ].map((faq, index) => (
              <div
                key={index}
                className={`bg-white border-l-4 ${faq.color} rounded-r-lg shadow-sm overflow-hidden`}
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-800">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-500 transition-transform ${
                      openFaq === index ? "transform rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4 text-gray-600">{faq.answer}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Educational Content Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0033A0] text-center mb-12">
            Making Personal Finance Approachable
          </h2>

          <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
            {/* Article 1 */}
            <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow flex flex-col h-full">
              <CardContent className="p-6 flex flex-col items-center">
                <div className="w-48 h-48 rounded-full bg-[#0033A0]/10 mx-auto mb-4 flex items-center justify-center overflow-hidden border-4 border-[#0033A0]/20 flex-shrink-0">
                  <img 
                    src="/images/financial-guide.jpg" 
                    alt="Financial Guide" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg font-bold text-[#0033A0] mb-2">
                  The AmeriLend Money Guide: A Financial Management Tool
                </h3>
                <p className="text-gray-600 text-sm">
                  Pick up best practices for managing finances, from budgeting for all types of households to dealing with income challenges.
                </p>
              </CardContent>
            </Card>

            {/* Article 2 */}
            <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow flex flex-col h-full">
              <CardContent className="p-6 flex flex-col items-center">
                <div className="w-48 h-48 rounded-full bg-[#FFA500]/10 mx-auto mb-4 flex items-center justify-center overflow-hidden border-4 border-[#FFA500]/20 flex-shrink-0">
                  <img 
                    src="/images/budget-tight.jpg" 
                    alt="Budget Management" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg font-bold text-[#0033A0] mb-2">
                  How to Survive and Budget When Money Is Tight
                </h3>
                <p className="text-gray-600 text-sm">
                  Finding extra money to put aside isn't easy when finances are tight, but that doesn't mean you can't do it.
                </p>
              </CardContent>
            </Card>

            {/* Article 3 */}
            <Card className="border-l-4 border-l-red-500 hover:shadow-lg transition-shadow flex flex-col h-full">
              <CardContent className="p-6 flex flex-col items-center">
                <div className="w-48 h-48 rounded-full bg-red-500/10 mx-auto mb-4 flex items-center justify-center overflow-hidden border-4 border-red-500/20 flex-shrink-0">
                  <img 
                    src="/images/smart-spending.jpg" 
                    alt="Smart Spending" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg font-bold text-[#0033A0] mb-2">
                  'Should I Buy This?' A Financial Flowchart for Smart Spending
                </h3>
                <p className="text-gray-600 text-sm">
                  Are you a smart spender? These 5 questions will make you one.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          {/* Contact Section */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-8 mb-12 pb-8 border-b border-gray-800">
            <div>
              <h4 className="font-semibold mb-3">Contact Us</h4>
              <p className="text-sm text-gray-400">Need help? Reach out to our team.</p>
              <div className="mt-3 space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <a href="tel:+19452121609" className="hover:text-white">(945) 212-1609</a>
                </p>
                <p className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  <a href="mailto:support@amerilendloan.com" className="hover:text-white">support@amerilendloan.com</a>
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Hours</h4>
              <div className="text-sm text-gray-400 space-y-1">
                <p>Mon-Fri: 8am - 8pm CT</p>
                <p>Sat-Sun: 9am - 5pm CT</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/" className="hover:text-white cursor-pointer">Home</a></li>
                <li><a href="/apply" className="hover:text-white cursor-pointer">Apply Now</a></li>
                <li><a href="#faq" className="hover:text-white cursor-pointer">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#about" className="hover:text-white cursor-pointer">About Us</a></li>
                <li><a href="tel:+19452121609" className="hover:text-white cursor-pointer">Contact Support</a></li>
                <li><a href="mailto:support@amerilendloan.com" className="hover:text-white cursor-pointer">Email Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#faq" className="hover:text-white cursor-pointer">FAQ</a></li>
                <li><a href="/dashboard" className="hover:text-white cursor-pointer">Dashboard</a></li>
                <li><a href="mailto:support@amerilendloan.com" className="hover:text-white cursor-pointer">Help Center</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/public/legal/privacy-policy" className="hover:text-[#FFA500] cursor-pointer transition-colors">Privacy Policy</a></li>
                <li><a href="/public/legal/terms-of-service" className="hover:text-[#FFA500] cursor-pointer transition-colors">Terms of Service</a></li>
                <li><a href="/public/legal/loan-agreement" className="hover:text-[#FFA500] cursor-pointer transition-colors">Loan Agreement</a></li>
                <li><a href="/public/legal/esign-consent" className="hover:text-[#FFA500] cursor-pointer transition-colors">E-Sign Consent</a></li>
              </ul>
            </div>
          </div>


          {/* Track Application Section */}
          <div className="flex justify-center py-6 mb-6">
            <div className="w-fit">
              <ApplicationTracking />
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-xs space-y-4 max-w-4xl mx-auto">
            <p>
              © 2025 AmeriLend, LLC. All Rights Reserved. Use of AmeriLend, LLC is subject to our{" "}
              <a href="/public/legal/terms-of-service" className="text-[#FFA500] hover:text-orange-300 underline cursor-pointer transition-colors font-medium">
                Terms of Use
              </a>{" "}
              and{" "}
              <a href="/public/legal/privacy-policy" className="text-[#FFA500] hover:text-orange-300 underline cursor-pointer transition-colors font-medium">
                Privacy Policy
              </a>
              .
            </p>

            <p>
              California Consumers can opt-out of the sale of personal information by contacting us at{" "}
              <a href="mailto:support@amerilendloan.com" className="text-white hover:underline cursor-pointer">
                support@amerilendloan.com
              </a>
              {" "}or calling{" "}
              <a href="tel:+19452121609" className="text-white hover:underline">
                (945) 212-1609
              </a>
              .
            </p>

            <p>
              Applications submitted on the AmeriLend platform will be originated by one of our bank partners and serviced by AmeriLend. Please see the Rates and Terms for details regarding the availability of products in your state of residence.
            </p>

            <div className="space-y-3 text-left">
              <p>
                <sup>1</sup>Subject to credit approval and verification. Actual approved loan amount and terms are dependent on our bank partners' standard underwriting guidelines and credit policies. Funds may be deposited for delivery to your bank via ACH as soon as the same business day if verification is completed and final approval occurs before 12:00 PM CT on a business day. If approval occurs after 12:00 PM CT on a business day or on a non-business day, funds may be delivered as soon as the next business day. Availability of the funds is dependent on how quickly your bank processes the transaction.
              </p>

              <p>
                <sup>2</sup>AmeriLend's Bank Partners may use credit report information provided by Clarity Services and Experian as part of the application process to determine your creditworthiness. Neither credit inquiry will appear as a hard credit inquiry on your Experian credit report and therefore they will not affect your FICO score.
              </p>

              <p>
                <sup>5</sup>According to the Consumer Federation of America, a non-profit consumer advocacy group, payday loans range in size from $100 to $1,000, depending on state legal maximums, and carry an average annual percentage rate (APR) of 400%. The maximum APR for a loan offered through and serviced by AmeriLend is 195% and loan sizes range from $500 to $5,000. <a href="https://paydayloaninfo.org/how-payday-loans-work/" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">https://paydayloaninfo.org/how-payday-loans-work/</a>
              </p>

              <p>
                <sup>6</sup>AmeriLend and its Bank Partners report customer payment history to the three major credit bureaus. On-time payments may improve credit score.
              </p>
            </div>

            <div className="border-t border-gray-800 pt-4 space-y-3">
              <p className="font-semibold">USA PATRIOT ACT NOTICE: IMPORTANT INFORMATION ABOUT PROCEDURES FOR OPENING A NEW ACCOUNT</p>

              <p>
                To help the government fight the funding of terrorism and money laundering activities, Federal law requires all financial institutions to obtain, verify, and record information that identifies each person who opens an account. What this means for you: When you open an account, we will ask for your name, address, date of birth, and other information that will allow us to identify you. We may also ask to see your driver's license or other identifying documents.
              </p>

              <p>
                If you have questions or concerns, please contact the AmeriLend Customer Support Team by phone at{" "}
                <a href="tel:+19452121609" className="text-white hover:underline">
                  (945) 212-1609
                </a>
                , Monday – Friday, 8 a.m. – 8:00 p.m. and Saturday and Sunday between 9 a.m. – 5:00 p.m. Eastern Time, or by sending an email to{" "}
                <a href="mailto:support@amerilendloan.com" className="text-white hover:underline">
                  support@amerilendloan.com
                </a>
                .
              </p>

              <p>LCR-6161</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Support Chat Button */}
      {/* AI Support Chat Button */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-[#0033A0] hover:bg-[#002080] text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-50"
        title="Open Support Chat"
      >
        <img src="/customer-service.png" alt="Support Chat" className="w-8 h-8" />
      </button>

      {/* Enhanced AI Support with Chat & Tracking */}
      {chatOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-h-96 rounded-lg shadow-2xl overflow-hidden">
          <div className="relative bg-white">
            <button
              onClick={() => setChatOpen(false)}
              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm z-10"
              title="Close Support"
            >
              ✕
            </button>
            <div className="overflow-y-auto max-h-96">
              <AISupport />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
