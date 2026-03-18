import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Cookie, X } from "lucide-react";

const COOKIE_CONSENT_KEY = "amerilend_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept() {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="mx-auto max-w-4xl bg-white border border-gray-200 rounded-xl shadow-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Cookie className="w-8 h-8 text-[#C9A227] flex-shrink-0 hidden sm:block" />
        <div className="flex-1 text-sm text-gray-600">
          <p>
            We use cookies to enhance your experience, analyze site traffic, and personalize content.
            By continuing to use our site, you consent to our use of cookies.{" "}
            <Link href="/legal/privacy-policy" className="text-[#0A2540] underline hover:text-[#C9A227]">
              Privacy Policy
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
          <button
            onClick={decline}
            className="flex-1 sm:flex-none px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="flex-1 sm:flex-none px-5 py-2 text-sm font-semibold text-white bg-[#0A2540] hover:bg-[#0d3158] rounded-lg transition-colors"
          >
            Accept All
          </button>
        </div>
        <button
          onClick={decline}
          className="absolute top-2 right-2 sm:static text-gray-400 hover:text-gray-600"
          aria-label="Close cookie banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
