import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Import markdown files as raw text
import loanAgreementRaw from "@/legal/loan-agreement.md?raw";
import privacyPolicyRaw from "@/legal/privacy-policy.md?raw";
import termsOfServiceRaw from "@/legal/terms-of-service.md?raw";
import esignConsentRaw from "@/legal/esign-consent.md?raw";

interface MarkdownFile {
  content: string;
  title: string;
  description: string;
}

const legalDocuments: Record<string, MarkdownFile> = {
  "loan-agreement": {
    title: "Loan Agreement",
    description: "Official loan agreement document with terms and conditions",
    content: loanAgreementRaw,
  },
  "privacy-policy": {
    title: "Privacy Policy",
    description: "Our commitment to protecting your personal information",
    content: privacyPolicyRaw,
  },
  "terms-of-service": {
    title: "Terms of Service",
    description: "Terms and conditions for using AmeriLend services",
    content: termsOfServiceRaw,
  },
  "esign-consent": {
    title: "E-Signature Consent",
    description: "Your consent to use electronic signatures for legal documents",
    content: esignConsentRaw,
  },
};

export default function LegalDocuments() {
  const [match, params] = useRoute("/public/legal/:document");

  const documentKey = params?.document || "";
  const documentData = legalDocuments[documentKey];

  if (!documentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef] flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-gray-600">Document not found</p>
        </Card>
      </div>
    );
  }

  const handleDownload = () => {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      `data:text/plain;charset=utf-8,${encodeURIComponent(documentData.content)}`
    );
    element.setAttribute("download", `${documentKey}.md`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0033A0] to-[#002070] text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleDownload}
                variant="outline"
                className="bg-white/20 border-white/30 text-white hover:bg-white/30 gap-2"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
              <Button
                onClick={handlePrint}
                variant="outline"
                className="bg-white/20 border-white/30 text-white hover:bg-white/30 gap-2"
              >
                🖨️
                <span className="hidden sm:inline">Print</span>
              </Button>
            </div>
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              {documentData.title}
            </h1>
            <p className="text-blue-100">{documentData.description}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Card className="bg-white shadow-2xl overflow-hidden border-0">
          <div className="p-8 sm:p-12 bg-gradient-to-b from-white via-white to-blue-50">
            <div className="markdown-content space-y-6 text-gray-800 prose-headings:font-bold prose-headings:mb-4">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, children, ...props }) => (
                    <h1
                      className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#0033A0] to-[#FFA500] bg-clip-text text-transparent mb-6 border-b-4 border-gradient-to-r from-[#0033A0] to-[#FFA500] pb-4 mt-8"
                      {...props}
                    >
                      {children}
                    </h1>
                  ),
                  h2: ({ node, children, ...props }) => (
                    <h2
                      className="text-3xl md:text-4xl font-bold text-[#0033A0] mt-10 mb-4 pl-4 border-l-4 border-[#FFA500] bg-gradient-to-r from-blue-50 to-transparent py-2"
                      {...props}
                    >
                      {children}
                    </h2>
                  ),
                  h3: ({ node, children, ...props }) => (
                    <h3
                      className="text-2xl md:text-3xl font-bold text-[#002070] mt-8 mb-3 pl-4 border-l-4 border-[#003399]"
                      {...props}
                    >
                      {children}
                    </h3>
                  ),
                  h4: ({ node, children, ...props }) => (
                    <h4
                      className="text-xl md:text-2xl font-semibold text-[#003399] mt-6 mb-2"
                      {...props}
                    >
                      {children}
                    </h4>
                  ),
                  h5: ({ node, children, ...props }) => (
                    <h5
                      className="text-lg font-semibold text-[#005acc] mt-4 mb-2"
                      {...props}
                    >
                      {children}
                    </h5>
                  ),
                  h6: ({ node, children, ...props }) => (
                    <h6
                      className="text-base font-semibold text-[#0066ff] mt-4 mb-2"
                      {...props}
                    >
                      {children}
                    </h6>
                  ),
                  p: ({ node, children, ...props }) => (
                    <p
                      className="text-gray-700 leading-relaxed mb-4 text-base md:text-lg"
                      {...props}
                    >
                      {children}
                    </p>
                  ),
                  strong: ({ node, children, ...props }) => (
                    <strong
                      className="font-bold text-[#0033A0] bg-gradient-to-r from-blue-100 to-orange-100 px-2 py-1 rounded shadow-sm"
                      {...props}
                    >
                      {children}
                    </strong>
                  ),
                  em: ({ node, children, ...props }) => (
                    <em className="italic text-[#003399] font-semibold" {...props}>
                      {children}
                    </em>
                  ),
                  ul: ({ node, children, ...props }) => (
                    <ul
                      className="list-disc list-outside space-y-3 my-6 ml-8 text-gray-700 bg-gradient-to-b from-blue-50/50 to-transparent p-4 rounded-lg"
                      {...props}
                    >
                      {children}
                    </ul>
                  ),
                  ol: ({ node, children, ...props }) => (
                    <ol
                      className="list-decimal list-outside space-y-3 my-6 ml-8 text-gray-700 bg-gradient-to-b from-orange-50/50 to-transparent p-4 rounded-lg"
                      {...props}
                    >
                      {children}
                    </ol>
                  ),
                  li: ({ node, children, ...props }) => (
                    <li className="text-gray-700 text-base md:text-lg leading-relaxed" {...props}>
                      {children}
                    </li>
                  ),
                  blockquote: ({ node, children, ...props }) => (
                    <blockquote
                      className="border-l-4 border-[#FFA500] bg-gradient-to-r from-blue-50 via-orange-50 to-blue-50 italic pl-6 py-4 my-6 text-gray-800 rounded-r-lg shadow-md font-semibold"
                      {...props}
                    >
                      {children}
                    </blockquote>
                  ),
                  table: ({ node, children, ...props }) => (
                    <div className="overflow-x-auto my-6 rounded-lg shadow-lg border-2 border-[#0033A0]">
                      <table
                        className="w-full border-collapse"
                        {...props}
                      >
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ node, children, ...props }) => (
                    <thead
                      className="bg-gradient-to-r from-[#0033A0] via-[#002070] to-[#003399] text-white font-bold"
                      {...props}
                    >
                      {children}
                    </thead>
                  ),
                  tbody: ({ node, children, ...props }) => (
                    <tbody className="bg-white" {...props}>
                      {children}
                    </tbody>
                  ),
                  tr: ({ node, children, ...props }) => (
                    <tr className="border-b-2 border-blue-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-orange-50 transition-all duration-200" {...props}>
                      {children}
                    </tr>
                  ),
                  th: ({ node, children, ...props }) => (
                    <th
                      className="border-b-2 border-white px-4 py-4 text-left font-bold text-white"
                      {...props}
                    >
                      {children}
                    </th>
                  ),
                  td: ({ node, children, ...props }) => (
                    <td
                      className="border-r border-blue-200 px-4 py-3 text-gray-700"
                      {...props}
                    >
                      {children}
                    </td>
                  ),
                  code: ({ node, inline, children, ...props }) =>
                    inline ? (
                      <code
                        className="bg-gradient-to-r from-orange-100 to-blue-100 text-[#0033A0] px-2 py-1 rounded font-mono text-sm font-semibold shadow-sm"
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <pre className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-green-400 px-4 py-4 rounded-lg font-mono text-sm block my-6 overflow-x-auto shadow-xl border-l-4 border-[#FFA500]">
                        <code {...props}>
                          {children}
                        </code>
                      </pre>
                    ),
                  a: ({ node, href, children, ...props }) => (
                    <a
                      href={href}
                      className="text-[#0033A0] font-semibold underline hover:text-[#FFA500] hover:no-underline transition-all duration-200 hover:shadow-sm hover:bg-blue-50 px-1 rounded"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {children}
                    </a>
                  ),
                  hr: ({ node, ...props }) => (
                    <hr
                      className="border-0 h-1 bg-gradient-to-r from-[#0033A0] via-[#FFA500] to-[#0033A0] my-8 rounded shadow-md"
                      {...props}
                    />
                  ),
                }}
              >
                {documentData.content}
              </ReactMarkdown>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-12 text-center bg-gradient-to-r from-[#0033A0]/10 to-[#FFA500]/10 p-6 rounded-lg">
          <p className="text-sm text-gray-600 font-semibold">
            © 2025 AmeriLend. All rights reserved. This document is confidential
            and for authorized use only.
          </p>
          <p className="text-xs mt-2 text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white;
          }
          .no-print {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
