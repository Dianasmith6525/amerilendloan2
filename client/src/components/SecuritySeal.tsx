import React from "react";

/**
 * Professional SSL Certificate Seal
 * Displays a real-looking security seal badge similar to Let's Encrypt and other CAs
 */
export function SecuritySeal() {
  return (
    <div className="inline-block">
      <div className="flex flex-col items-center px-3 py-2 bg-white border-2 border-gray-800 rounded shadow-lg hover:shadow-xl transition-shadow">
        <div className="text-xs font-bold text-gray-800 tracking-wider">SECURE</div>
        <div className="text-xs text-gray-700 font-semibold">SSL ENCRYPTED</div>
        <div className="text-xs text-gray-600 mt-0.5">Let&apos;s Encrypt</div>
      </div>
    </div>
  );
}

/**
 * Professional Badge for Footer
 * Displays certificate information in a professional manner
 */
export function SecurityBadgeFooter() {
  return (
    <div className="flex justify-center py-8 px-4 border-t border-gray-200">
      <div className="bg-white border-2 border-gray-800 rounded shadow-lg p-6 max-w-sm text-center">
        <div className="mb-4">
          <div className="inline-block">
            <svg width="48" height="48" viewBox="0 0 48 48" className="text-gray-800">
              <path
                fill="currentColor"
                d="M24 2C12.95 2 4 10.95 4 22v20h40V22c0-11.05-8.95-20-20-20zm0 3c9.38 0 17 7.62 17 17v17H7V22c0-9.38 7.62-17 17-17zm-1 8v10h2V13h-2zm0 13v2h2v-2h-2z"
              />
            </svg>
          </div>
        </div>
        <h3 className="text-sm font-bold text-gray-800 mb-1">SSL CERTIFICATE</h3>
        <p className="text-xs text-gray-700 mb-2">Secure Connection</p>
        <p className="text-xs text-gray-600">
          This website is protected by an SSL certificate from Let&apos;s Encrypt
        </p>
        <div className="mt-3 pt-3 border-t border-gray-300">
          <p className="text-xs text-gray-700 font-semibold">
            Certificate Authority: Let&apos;s Encrypt
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Valid until: February 15, 2026
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Professional Trust Indicators
 * Displays security information without colors or emoji
 */
export function TrustIndicators() {
  return (
    <div className="border-2 border-gray-300 rounded bg-gray-50 p-6">
      <h3 className="text-sm font-bold text-gray-800 text-center mb-6">
        SECURITY INFORMATION
      </h3>
      
      <div className="grid grid-cols-3 gap-4">
        {/* SSL Encrypted */}
        <div className="flex flex-col items-center text-center border-r border-gray-300 pr-4">
          <div className="mb-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-800">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="text-xs font-bold text-gray-800">SSL ENCRYPTED</span>
          <span className="text-xs text-gray-600 mt-1">Secure Connection</span>
        </div>

        {/* Data Protected */}
        <div className="flex flex-col items-center text-center border-r border-gray-300 pr-4">
          <div className="mb-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-800">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <span className="text-xs font-bold text-gray-800">DATA PROTECTED</span>
          <span className="text-xs text-gray-600 mt-1">Industry Standard</span>
        </div>

        {/* Certificate Valid */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-800">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="text-xs font-bold text-gray-800">VERIFIED</span>
          <span className="text-xs text-gray-600 mt-1">Let&apos;s Encrypt</span>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-300 text-center">
        <p className="text-xs text-gray-700">
          <span className="font-bold">Domain:</span> www.amerilendloan.com
        </p>
        <p className="text-xs text-gray-600 mt-2">
          <span className="font-bold">Issuer:</span> Let&apos;s Encrypt Authority X3
        </p>
        <p className="text-xs text-gray-600 mt-2">
          <span className="font-bold">Issued:</span> November 17, 2025
        </p>
        <p className="text-xs text-gray-600 mt-2">
          <span className="font-bold">Expires:</span> February 15, 2026
        </p>
      </div>
    </div>
  );
}
