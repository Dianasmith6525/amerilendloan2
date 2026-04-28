import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Cookie, X } from "lucide-react";

const COOKIE_CONSENT_KEY = "amerilend_cookie_consent";

type CookiePreference = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  updatedAt: string;
};

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [preferences, setPreferences] = useState(true);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  function savePreference(next: Omit<CookiePreference, "updatedAt">) {
    const payload: CookiePreference = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("cookie-consent-updated", { detail: payload }));
  }

  function acceptAll() {
    savePreference({ essential: true, analytics: true, marketing: true, preferences: true });
    setVisible(false);
  }

  function rejectOptional() {
    savePreference({ essential: true, analytics: false, marketing: false, preferences: false });
    setVisible(false);
  }

  function saveSelected() {
    savePreference({ essential: true, analytics, marketing, preferences });
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="mx-auto max-w-4xl bg-white border border-gray-200 rounded-xl shadow-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Cookie className="w-8 h-8 text-[#C9A227] flex-shrink-0 hidden sm:block" />
        <div className="flex-1 text-sm text-gray-600 space-y-3">
          <p>
            We use cookies to enhance your experience, analyze site traffic, and personalize content.
            You can choose which optional cookies to allow.{" "}
            <Link href="/legal/privacy-policy" className="text-[#0A2540] underline hover:text-[#C9A227]">
              Privacy Policy
            </Link>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 bg-gray-50">
              <span className="text-xs font-medium text-gray-700">Essential (required)</span>
              <input type="checkbox" checked disabled className="accent-[#0A2540]" />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <span className="text-xs font-medium text-gray-700">Analytics</span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="accent-[#0A2540]"
              />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <span className="text-xs font-medium text-gray-700">Preferences</span>
              <input
                type="checkbox"
                checked={preferences}
                onChange={(e) => setPreferences(e.target.checked)}
                className="accent-[#0A2540]"
              />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <span className="text-xs font-medium text-gray-700">Marketing</span>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="accent-[#0A2540]"
              />
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto flex-wrap">
          <button
            onClick={rejectOptional}
            className="flex-1 sm:flex-none px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg transition-colors"
          >
            Reject Optional
          </button>
          <button
            onClick={saveSelected}
            className="flex-1 sm:flex-none px-4 py-2 text-sm text-[#0A2540] hover:text-[#C9A227] border border-[#0A2540] rounded-lg transition-colors"
          >
            Save Preferences
          </button>
          <button
            onClick={acceptAll}
            className="flex-1 sm:flex-none px-5 py-2 text-sm font-semibold text-white bg-[#0A2540] hover:bg-[#0d3158] rounded-lg transition-colors"
          >
            Accept All
          </button>
        </div>
        <button
          onClick={rejectOptional}
          className="absolute top-2 right-2 sm:static text-gray-400 hover:text-gray-600"
          aria-label="Close cookie banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
