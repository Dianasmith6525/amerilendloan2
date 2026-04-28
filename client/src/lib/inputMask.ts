/**
 * Input masking utilities for formatting user input in real-time
 */

export const formatSSN = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 9);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
};

export const formatPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 10);
  if (cleaned.length === 0) return "";
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
};

export const formatCurrency = (value: string): string => {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned === "") return "";
  const num = parseInt(cleaned, 10);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export const unformatCurrency = (value: string): number => {
  const cleaned = value.replace(/\D/g, "");
  return cleaned === "" ? 0 : parseInt(cleaned, 10);
};

export const validateSSN = (value: string): boolean => {
  const ssn = value.replace(/\D/g, "");
  return ssn.length === 9;
};

export const validatePhone = (value: string): boolean => {
  const phone = value.replace(/\D/g, "");
  return phone.length === 10;
};

export const validateEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export const validateZipCode = (value: string): boolean => {
  const zip = value.replace(/\D/g, "");
  return zip.length === 5;
};

export const formatZipCode = (value: string): string => {
  return value.replace(/\D/g, "").slice(0, 5);
};

export const calculateMonthlyPayment = (
  principal: number,
  annualRate: number,
  months: number
): number => {
  if (annualRate === 0) {
    return principal / months;
  }
  const monthlyRate = annualRate / 100 / 12;
  return (
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
};

export const calculateTotalInterest = (
  principal: number,
  annualRate: number,
  months: number
): number => {
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, months);
  return monthlyPayment * months - principal;
};
