import { describe, it, expect } from "vitest";
import {
  formatSSN,
  formatPhone,
  formatCurrency,
  unformatCurrency,
  validateSSN,
  validatePhone,
  validateEmail,
  validateZipCode,
  formatZipCode,
  calculateMonthlyPayment,
  calculateTotalInterest,
} from "./inputMask";

describe("formatSSN", () => {
  it("formats partial SSN (3 digits)", () => {
    expect(formatSSN("123")).toBe("123");
  });
  it("formats partial SSN (5 digits)", () => {
    expect(formatSSN("12345")).toBe("123-45");
  });
  it("formats full SSN (9 digits)", () => {
    expect(formatSSN("123456789")).toBe("123-45-6789");
  });
  it("strips non-digit characters", () => {
    expect(formatSSN("123-45-6789")).toBe("123-45-6789");
  });
  it("truncates beyond 9 digits", () => {
    expect(formatSSN("1234567890")).toBe("123-45-6789");
  });
});

describe("formatPhone", () => {
  it("returns empty for empty input", () => {
    expect(formatPhone("")).toBe("");
  });
  it("formats 3 digits", () => {
    expect(formatPhone("123")).toBe("123");
  });
  it("formats 6 digits", () => {
    expect(formatPhone("123456")).toBe("(123) 456");
  });
  it("formats full 10-digit phone", () => {
    expect(formatPhone("1234567890")).toBe("(123) 456-7890");
  });
  it("strips non-digit characters", () => {
    expect(formatPhone("(123) 456-7890")).toBe("(123) 456-7890");
  });
});

describe("formatCurrency", () => {
  it("returns empty for empty input", () => {
    expect(formatCurrency("")).toBe("");
  });
  it("formats a dollar amount", () => {
    expect(formatCurrency("5000")).toBe("$5,000");
  });
  it("strips non-digit characters", () => {
    expect(formatCurrency("$5,000")).toBe("$5,000");
  });
});

describe("unformatCurrency", () => {
  it("returns 0 for empty input", () => {
    expect(unformatCurrency("")).toBe(0);
  });
  it("extracts number from currency string", () => {
    expect(unformatCurrency("$5,000")).toBe(5000);
  });
});

describe("validateSSN", () => {
  it("accepts valid 9-digit SSN", () => {
    expect(validateSSN("123-45-6789")).toBe(true);
  });
  it("rejects short SSN", () => {
    expect(validateSSN("12345678")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(validateSSN("")).toBe(false);
  });
});

describe("validatePhone", () => {
  it("accepts valid 10-digit phone", () => {
    expect(validatePhone("(123) 456-7890")).toBe(true);
  });
  it("rejects short phone", () => {
    expect(validatePhone("123456789")).toBe(false);
  });
});

describe("validateEmail", () => {
  it("accepts valid email", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });
  it("rejects missing @", () => {
    expect(validateEmail("userexample.com")).toBe(false);
  });
  it("rejects missing domain", () => {
    expect(validateEmail("user@")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(validateEmail("")).toBe(false);
  });
});

describe("validateZipCode", () => {
  it("accepts valid 5-digit zip", () => {
    expect(validateZipCode("92130")).toBe(true);
  });
  it("rejects short zip", () => {
    expect(validateZipCode("9213")).toBe(false);
  });
});

describe("formatZipCode", () => {
  it("strips non-digits and truncates to 5", () => {
    expect(formatZipCode("92130-1234")).toBe("92130");
  });
});

describe("calculateMonthlyPayment", () => {
  it("calculates correctly for 0% interest", () => {
    expect(calculateMonthlyPayment(12000, 0, 12)).toBe(1000);
  });
  it("calculates correctly for non-zero interest", () => {
    const payment = calculateMonthlyPayment(10000, 12, 12);
    // ~$888.49 for $10k at 12% APR over 12 months
    expect(payment).toBeCloseTo(888.49, 0);
  });
});

describe("calculateTotalInterest", () => {
  it("returns 0 for 0% interest", () => {
    expect(calculateTotalInterest(12000, 0, 12)).toBeCloseTo(0);
  });
  it("calculates total interest paid", () => {
    const interest = calculateTotalInterest(10000, 12, 12);
    // ~$661.85 total interest
    expect(interest).toBeGreaterThan(0);
    expect(interest).toBeLessThan(2000);
  });
});
