export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "AmeriLend";

export const APP_LOGO =
  import.meta.env.VITE_APP_LOGO ||
  "https://www.amerilendloan.com/images/logo-new.jpg";

export const COMPANY_PHONE_RAW = "+19452121609";
export const COMPANY_PHONE_DISPLAY = "+1 945 212-1609";
export const COMPANY_PHONE_DISPLAY_SHORT = "(945) 212-1609";
export const COMPANY_SUPPORT_EMAIL = "support@amerilendloan.com";
export const COMPANY_HARDSHIP_EMAIL = "hardship@amerilendloan.com";

export const SUPPORT_HOURS_WEEKDAY = "Mon–Fri: 8am–8pm CT";
export const SUPPORT_HOURS_WEEKEND = "Sat–Sun: 9am–5pm CT";

export const LOAN_MIN_AMOUNT = 500;
export const LOAN_MAX_AMOUNT = 15000;
export const LOAN_TERM_MIN_MONTHS = 6;
export const LOAN_TERM_MAX_MONTHS = 36;
export const APR_MIN = 5.99;
export const APR_MAX = 35.99;
export const ILLUSTRATIVE_APR = 24.99;
export const PROCESSING_FEE_RATE = 0.035;

export const LOAN_RANGE_TEXT = `$${LOAN_MIN_AMOUNT.toLocaleString()} – $${LOAN_MAX_AMOUNT.toLocaleString()}`;
export const APR_RANGE_TEXT = `${APR_MIN.toFixed(2)}% – ${APR_MAX.toFixed(2)}%`;
export const TERM_RANGE_TEXT = `${LOAN_TERM_MIN_MONTHS} – ${LOAN_TERM_MAX_MONTHS} months`;
export const PROCESSING_FEE_TEXT = `${(PROCESSING_FEE_RATE * 100).toFixed(1)}%`;

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL || "https://www.amerilendloan.com";
  const appId = import.meta.env.VITE_APP_ID || "amerilend";
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};