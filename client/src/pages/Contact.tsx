import { Button } from "@/components/ui/button";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageCircle,
  Send,
  Menu,
  X,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import ComplianceFooter from "@/components/ComplianceFooter";
import SEOHead from "@/components/SEOHead";
import { useTurnstile } from "@/components/TurnstileWidget";
import {
  COMPANY_PHONE_DISPLAY_SHORT,
  COMPANY_SUPPORT_EMAIL,
  SUPPORT_HOURS_WEEKDAY,
} from "@/const";

const contactMethods = [
  {
    icon: Phone,
    title: "Call Us",
    detail: COMPANY_PHONE_DISPLAY_SHORT,
    sub: SUPPORT_HOURS_WEEKDAY,
  },
  {
    icon: Mail,
    title: "Email Us",
    detail: COMPANY_SUPPORT_EMAIL,
    sub: "We respond within 24 hours",
  },
  {
    icon: MessageCircle,
    title: "Live Chat",
    detail: "Chat with our team",
    sub: "Available during business hours",
  },
  {
    icon: MapPin,
    title: "Headquarters",
    detail: "12707 High Bluff Dr, Suite 200",
    sub: "San Diego, CA 92130",
  },
];

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sendEmail = trpc.contact.sendEmail.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send message. Please try again.");
      // Turnstile tokens are single-use; reset so the user can retry.
      turnstile.reset();
    },
  });

  const turnstile = useTurnstile({ action: "contact" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!turnstile.isReady) {
      toast.error("Please complete the verification challenge.");
      return;
    }
    sendEmail.mutate({
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      message: formData.message,
      turnstileToken: turnstile.token ?? undefined,
    });
  };

  return (
    <div className="min-h-screen bg-white text-gray-800">
      <SEOHead
        title="Contact Us"
        description={`Get in touch with AmeriLend. Call us at ${COMPANY_PHONE_DISPLAY_SHORT}, email ${COMPANY_SUPPORT_EMAIL}, or submit a message. We're here to help with your loan questions.`}
        path="/contact"
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
            Get in <span className="text-[#C9A227]">Touch</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Have a question or need help? Our team is here for you.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 w-full pointer-events-none">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="block w-full h-16 md:h-24">
            <path d="M0,40 C480,100 960,0 1440,40 L1440,100 L0,100 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {contactMethods.map((m) => (
              <div key={m.title} className="bg-gray-50 rounded-2xl p-6 text-center hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-[#0A2540]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <m.icon className="w-6 h-6 text-[#0A2540]" />
                </div>
                <h3 className="font-bold text-[#0A2540] mb-1">{m.title}</h3>
                <p className="text-sm font-medium text-gray-700">{m.detail}</p>
                <p className="text-xs text-gray-400 mt-1">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Contact Form */}
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">Send Us a Message</h2>
              <p className="text-gray-500 text-lg">
                Fill out the form below and we'll get back to you as soon as possible.
              </p>
            </div>

            {submitted ? (
              <div className="bg-[#00875A]/10 border border-[#00875A]/30 rounded-2xl p-10 text-center">
                <div className="w-16 h-16 bg-[#00875A] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-[#0A2540] mb-2">Message Sent!</h3>
                <p className="text-gray-600">
                  Thank you for reaching out. Our team will respond within 24 hours.
                </p>
                <Button
                  className="mt-6 bg-[#0A2540] hover:bg-[#0d3a5c] text-white rounded-full px-8"
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
                  }}
                >
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0A2540] focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@example.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0A2540] focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone (Optional)</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0A2540] focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-subject" className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                    <select
                      id="contact-subject"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0A2540] focus:border-transparent outline-none transition bg-white"
                    >
                      <option value="">Select a topic</option>
                      <option value="general">General Inquiry</option>
                      <option value="loan">Loan Question</option>
                      <option value="application">Application Status</option>
                      <option value="payment">Payment Issue</option>
                      <option value="technical">Technical Support</option>
                      <option value="complaint">File a Complaint</option>
                      <option value="partnership">Partnership</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="How can we help you?"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0A2540] focus:border-transparent outline-none transition resize-none"
                  />
                </div>

                {turnstile.widget}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-[#0A2540] hover:bg-[#0d3a5c] text-white font-semibold rounded-xl py-3"
                  disabled={sendEmail.isPending || !turnstile.isReady}
                >
                  {sendEmail.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Hours */}
      <section className="bg-gray-50 py-14">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Clock className="w-6 h-6 text-[#C9A227]" />
            <h2 className="text-2xl font-bold text-[#0A2540]">Business Hours</h2>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm max-w-md mx-auto">
            <div className="space-y-3 text-sm">
              {[
                { day: "Monday – Friday", hours: "8:00 AM – 8:00 PM EST" },
                { day: "Saturday", hours: "9:00 AM – 5:00 PM EST" },
                { day: "Sunday", hours: "Closed" },
              ].map((h) => (
                <div key={h.day} className="flex justify-between">
                  <span className="font-medium text-gray-700">{h.day}</span>
                  <span className="text-gray-500">{h.hours}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ComplianceFooter />
    </div>
  );
}
