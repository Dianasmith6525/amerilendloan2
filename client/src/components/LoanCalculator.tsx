import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function LoanCalculator() {
  const [loanAmount, setLoanAmount] = useState(2000);
  const [loanTerm, setLoanTerm] = useState(12);

  // Simple calculation: APR of ~15% for demonstration
  const calculateMonthlyPayment = () => {
    const apr = 0.15; // 15% APR for example
    const monthlyRate = apr / 12;
    const payment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) / (Math.pow(1 + monthlyRate, loanTerm) - 1);
    return Math.round(payment);
  };

  const monthlyPayment = calculateMonthlyPayment();

  return (
    <section className="bg-gradient-to-br from-gray-50 to-blue-50 py-8 md:py-12 border-b">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0033A0] mb-4">
            Calculate Your Loan
          </h2>
          <p className="text-gray-600 mb-6 text-sm md:text-base">
            Get an estimate of your monthly payment
          </p>

          <div className="bg-white rounded-lg p-6 md:p-8 shadow-lg">
            {/* Loan Amount Slider */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Loan Amount
              </label>
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="w-full mb-2"
                title="Loan Amount Slider"
                aria-label="Loan Amount"
              />
              <div className="text-center text-2xl font-bold text-[#0033A0]">
                ${loanAmount.toLocaleString()}
              </div>
            </div>

            {/* Loan Term Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Loan Term
              </label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md"
                value={loanTerm}
                onChange={(e) => setLoanTerm(Number(e.target.value))}
                title="Select Loan Term"
                aria-label="Loan Term"
              >
                <option value="6">6 months</option>
                <option value="12">12 months</option>
                <option value="18">18 months</option>
                <option value="24">24 months</option>
              </select>
            </div>

            {/* Estimated Payment */}
            <div className="bg-[#0033A0] text-white rounded-lg p-4">
              <p className="text-sm mb-1">Estimated Monthly Payment</p>
              <p className="text-sm mb-2">
                <span className="text-2xl font-bold">${monthlyPayment}</span>
                <span className="text-xs ml-1">per month</span>
              </p>
              <p className="text-xs opacity-90">
                *This is an estimate. Actual rates and terms may vary.
              </p>
            </div>

            <Link href="/apply">
              <Button className="mt-6 bg-[#FFA500] hover:bg-[#FF8C00] text-white font-semibold w-full py-6 text-lg">
                Apply Now
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
