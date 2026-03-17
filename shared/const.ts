export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const SESSION_COOKIE_MS = 1000 * 60 * 60 * 48; // 48 hours - used for cookie maxAge
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// Company contact info — single source of truth
export const SUPPORT_EMAIL = "support@amerilendloan.com";
export const SUPPORT_PHONE = "(945) 212-1609";
export const COMPANY_DOMAIN = "www.amerilendloan.com";

// ===== Admin Fraud Control — Predefined Reasons =====

export const BANK_FREEZE_REASONS = [
  "Suspected fraudulent activity",
  "Unauthorized transactions detected",
  "Identity verification failure",
  "Account under investigation",
  "Suspicious deposit activity",
  "Multiple failed login attempts",
  "Reported stolen credentials",
  "AML/KYC compliance hold",
  "Court order / Legal hold",
  "Chargeback dispute pending",
  "Other (specify below)",
] as const;

export const CARD_FREEZE_REASONS = [
  "Suspected fraudulent transactions",
  "Unauthorized card usage",
  "Card compromise / Data breach",
  "Suspicious spending pattern",
  "Identity verification failure",
  "Account under investigation",
  "Reported lost or stolen",
  "Multiple declined transactions",
  "Merchant dispute pending",
  "AML/KYC compliance hold",
  "Other (specify below)",
] as const;

export const LOAN_LOCK_REASONS = [
  "Suspected fraudulent application",
  "Identity theft reported",
  "Inconsistent documentation",
  "Duplicate application detected",
  "Income verification failure",
  "Suspicious activity on linked account",
  "Under regulatory investigation",
  "Court order / Legal hold",
  "Address verification failure",
  "Employer verification failure",
  "Other (specify below)",
] as const;
