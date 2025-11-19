import React from "react";
import { Shield, Lock } from "lucide-react";

export function SecuritySeal() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg hover:shadow-md transition-shadow">
      <div className="relative">
        <Shield className="w-6 h-6 text-green-600 fill-green-600" />
        <Lock className="w-3 h-3 text-white absolute bottom-0.5 right-0.5" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-bold text-green-700">Secure Site</span>
        <span className="text-xs text-gray-600">SSL Encrypted</span>
      </div>
    </div>
  );
}

export function SecurityBadgeFooter() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 px-4 bg-gradient-to-b from-transparent to-gray-50 border-t border-gray-200">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-3 bg-white border-2 border-green-200 rounded-lg shadow-sm">
          <Shield className="w-5 h-5 text-green-600 fill-green-600" />
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold text-green-700">SSL Secured</span>
            <span className="text-xs text-gray-600">Let's Encrypt Certificate</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 text-center max-w-xs">
        This website is protected by an SSL certificate issued by Let's Encrypt, 
        ensuring all data transmitted is encrypted and secure.
      </p>
    </div>
  );
}

export function TrustIndicators() {
  return (
    <div className="grid grid-cols-3 gap-4 py-6 px-4 bg-gray-50 rounded-lg">
      <div className="flex flex-col items-center text-center">
        <Shield className="w-8 h-8 text-green-600 mb-2" />
        <span className="text-xs font-semibold text-gray-700">SSL Encrypted</span>
        <span className="text-xs text-gray-500">Secure Connection</span>
      </div>
      <div className="flex flex-col items-center text-center">
        <Lock className="w-8 h-8 text-blue-600 mb-2" />
        <span className="text-xs font-semibold text-gray-700">Data Protected</span>
        <span className="text-xs text-gray-500">Industry Standard</span>
      </div>
      <div className="flex flex-col items-center text-center">
        <svg
          className="w-8 h-8 text-amber-600 mb-2"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span className="text-xs font-semibold text-gray-700">Trusted</span>
        <span className="text-xs text-gray-500">Let's Encrypt</span>
      </div>
    </div>
  );
}
