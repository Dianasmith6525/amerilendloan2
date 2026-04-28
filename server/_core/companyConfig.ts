/**
 * Company Information Configuration
 * Used in email templates and footer
 */

export const COMPANY_INFO = {
  name: "AmeriLend",
  logo: {
    url: "https://www.amerilendloan.com/images/logo-new.jpg",
    alt: "AmeriLend Logo",
  },
  contact: {
    email: "support@amerilendloan.com",
    phone: "+1 (945) 212-1609",
    phoneFormatted: "+1 945 212-1609",
    supportHoursWeekday: "Mon–Fri: 8am–8pm CT",
    supportHoursWeekend: "Sat–Sun: 9am–5pm CT",
    supportHoursShort: "M-F 8am-8pm CT, Sat-Sun 9am-5pm CT",
    whatsapp: "+1 (945) 212-1609",
    telegram: "@amerilendloans",
  },
  admin: {
    email: "admin@amerilendloan.com",
  },
  address: {
    street: "12707 High Bluff Drive, Suite 200",
    city: "San Diego",
    state: "CA",
    zip: "92130",
    country: "USA",
    formatted: "12707 High Bluff Drive, Suite 200, San Diego, CA 92130, USA",
  },
  website: "https://www.amerilendloan.com",
  social: {
    facebook: "https://facebook.com/amerilend",
    twitter: "https://twitter.com/amerilend",
    instagram: "https://instagram.com/amerilend",
    linkedin: "https://linkedin.com/company/amerilend",
  },
  images: {
    whatsappIcon: "https://www.amerilendloan.com/images/whatsapp-logo.png",
    telegramIcon: "https://www.amerilendloan.com/images/telegram-logo.png",
    emailIcon: "https://cdn-icons-png.flaticon.com/512/561/561127.png",
    trustpilotLogo: "https://www.amerilendloan.com/images/trustpilot-logo.svg",
    lendingTreeLogo: "https://www.amerilendloan.com/images/lending-tree-logo.svg",
    bbbLogo: "https://www.amerilendloan.com/images/bbb.png",
  },
};

/**
 * AmeriLend brand palette — used across all email components
 */
export const EMAIL_THEME = {
  brandPrimary: "#0033A0",   // navy
  brandPrimaryDark: "#001a4d",
  brandPrimaryMid: "#012b7d",
  brandAccent: "#FFA500",    // gold
  brandAccentDark: "#cc8400",
  surface: "#ffffff",
  canvas: "#f3f4f8",
  border: "#e5e7eb",
  text: "#0f172a",
  textMuted: "#475569",
  textSubtle: "#64748b",
  success: "#0f7b3a",
  successBg: "#e8f6ee",
  successBorder: "#bce0c5",
  danger: "#b91c1c",
  dangerBg: "#fdecec",
  dangerBorder: "#f3b6b6",
  warning: "#a15c00",
  warningBg: "#fff5e0",
  warningBorder: "#f6d99a",
  info: "#0033A0",
  infoBg: "#eaf1ff",
  infoBorder: "#cbdcff",
} as const;

const FONT_STACK = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`;

/**
 * Generate the gradient masthead used at the top of every email.
 * `tagline` defaults to the standard descriptor.
 */
export function getEmailHeader(tagline?: string): string {
  const t = tagline || "Trusted Lending Solutions";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:linear-gradient(135deg,${EMAIL_THEME.brandPrimaryDark} 0%,${EMAIL_THEME.brandPrimary} 55%,#0d4ac8 100%);">
      <tr>
        <td align="center" style="padding:36px 24px 28px;">
          <img src="${COMPANY_INFO.logo.url}" alt="${COMPANY_INFO.logo.alt}" width="72" height="72" style="display:block;margin:0 auto 14px;height:72px;width:auto;border-radius:14px;background:#ffffff;padding:6px;border:1px solid rgba(255,255,255,0.25);" />
          <div style="font-family:${FONT_STACK};color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;line-height:1.2;">${COMPANY_INFO.name}</div>
          <div style="font-family:${FONT_STACK};color:${EMAIL_THEME.brandAccent};font-size:11px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;margin-top:6px;">${t}</div>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Build a compact hero band that sits directly under the header.
 * Use it to set the email's primary message tone (e.g., "Application Received").
 */
export function buildHero(opts: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  icon?: string; // single emoji or short text
}): string {
  const tone = opts.tone || "default";
  const palette: Record<string, { bg: string; accent: string; border: string }> = {
    default: { bg: "#f8fafc", accent: EMAIL_THEME.brandPrimary, border: "#e2e8f0" },
    success: { bg: EMAIL_THEME.successBg, accent: EMAIL_THEME.success, border: EMAIL_THEME.successBorder },
    warning: { bg: EMAIL_THEME.warningBg, accent: EMAIL_THEME.warning, border: EMAIL_THEME.warningBorder },
    danger: { bg: EMAIL_THEME.dangerBg, accent: EMAIL_THEME.danger, border: EMAIL_THEME.dangerBorder },
    info: { bg: EMAIL_THEME.infoBg, accent: EMAIL_THEME.info, border: EMAIL_THEME.infoBorder },
  };
  const c = palette[tone];
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${c.bg};border-bottom:1px solid ${c.border};">
      <tr>
        <td align="left" style="padding:36px 36px 32px;font-family:${FONT_STACK};">
          ${opts.icon ? `<div style="font-size:32px;line-height:1;margin-bottom:14px;">${opts.icon}</div>` : ""}
          ${opts.eyebrow ? `<div style="color:${c.accent};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:10px;">${opts.eyebrow}</div>` : ""}
          <div style="color:${EMAIL_THEME.text};font-size:24px;font-weight:700;line-height:1.3;margin:0;">${opts.title}</div>
          ${opts.subtitle ? `<div style="color:${EMAIL_THEME.textMuted};font-size:14px;line-height:1.6;margin-top:12px;">${opts.subtitle}</div>` : ""}
        </td>
      </tr>
    </table>
  `;
}

/**
 * Primary action button (table-based for Outlook compatibility).
 */
export function buildButton(opts: {
  label: string;
  href: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  fullWidth?: boolean;
}): string {
  const variant = opts.variant || "primary";
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    primary: { bg: EMAIL_THEME.brandPrimary, color: "#ffffff", border: EMAIL_THEME.brandPrimary },
    secondary: { bg: EMAIL_THEME.brandAccent, color: "#1a1a1a", border: EMAIL_THEME.brandAccent },
    danger: { bg: EMAIL_THEME.danger, color: "#ffffff", border: EMAIL_THEME.danger },
    ghost: { bg: "#ffffff", color: EMAIL_THEME.brandPrimary, border: EMAIL_THEME.brandPrimary },
  };
  const s = styles[variant];
  const widthAttr = opts.fullWidth ? `width="100%"` : "";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" ${widthAttr} style="border-collapse:separate;${opts.fullWidth ? "width:100%;" : ""}">
      <tr>
        <td align="center" style="border-radius:8px;background:${s.bg};">
          <a href="${opts.href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT_STACK};font-size:14px;font-weight:700;color:${s.color};text-decoration:none;border-radius:8px;border:1px solid ${s.border};letter-spacing:0.3px;">${opts.label}</a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Build a key/value details card (e.g., login details, application summary).
 * `rows` is an array of [label, value, optional icon]. Values can be HTML.
 */
export function buildInfoCard(opts: {
  title?: string;
  rows: Array<[string, string] | [string, string, string]>;
  emphasis?: "default" | "subtle";
}): string {
  const subtle = opts.emphasis === "subtle";
  const tableRows = opts.rows
    .map(([label, value, icon], i) => {
      const isLast = i === opts.rows.length - 1;
      return `
        <tr>
          <td style="padding:14px 6px 14px 18px;font-family:${FONT_STACK};color:${EMAIL_THEME.textSubtle};font-size:12px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;width:38%;vertical-align:top;${isLast ? "" : `border-bottom:1px solid ${EMAIL_THEME.border};`}">
            ${icon ? `<span style="margin-right:6px;">${icon}</span>` : ""}${label}
          </td>
          <td style="padding:14px 18px 14px 6px;font-family:${FONT_STACK};color:${EMAIL_THEME.text};font-size:14px;font-weight:600;line-height:1.5;${isLast ? "" : `border-bottom:1px solid ${EMAIL_THEME.border};`}">${value}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;background:${subtle ? "#f8fafc" : "#ffffff"};border:1px solid ${EMAIL_THEME.border};border-radius:12px;margin:28px 0;">
      ${
        opts.title
          ? `<tr><td colspan="2" style="padding:16px 18px;font-family:${FONT_STACK};color:${EMAIL_THEME.brandPrimary};font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;border-bottom:1px solid ${EMAIL_THEME.border};">${opts.title}</td></tr>`
          : ""
      }
      ${tableRows}
    </table>
  `;
}

/**
 * Inline alert/callout — info / success / warning / danger
 */
export function buildAlert(opts: {
  tone: "info" | "success" | "warning" | "danger";
  title?: string;
  body: string; // HTML allowed
  icon?: string;
}): string {
  const palette = {
    info: { bg: EMAIL_THEME.infoBg, border: EMAIL_THEME.infoBorder, color: EMAIL_THEME.info, icon: opts.icon || "ℹ" },
    success: { bg: EMAIL_THEME.successBg, border: EMAIL_THEME.successBorder, color: EMAIL_THEME.success, icon: opts.icon || "✓" },
    warning: { bg: EMAIL_THEME.warningBg, border: EMAIL_THEME.warningBorder, color: EMAIL_THEME.warning, icon: opts.icon || "⚠" },
    danger: { bg: EMAIL_THEME.dangerBg, border: EMAIL_THEME.dangerBorder, color: EMAIL_THEME.danger, icon: opts.icon || "⚠" },
  } as const;
  const c = palette[opts.tone];
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${c.bg};border:1px solid ${c.border};border-left:4px solid ${c.color};border-radius:10px;margin:24px 0;">
      <tr>
        <td style="padding:16px 20px;font-family:${FONT_STACK};">
          ${opts.title ? `<div style="color:${c.color};font-size:13px;font-weight:700;margin:0 0 8px;letter-spacing:0.3px;"><span style="margin-right:6px;">${c.icon}</span>${opts.title}</div>` : ""}
          <div style="color:${EMAIL_THEME.text};font-size:13.5px;line-height:1.6;">${opts.body}</div>
        </td>
      </tr>
    </table>
  `;
}

/** Section divider with optional centered label */
export function buildDivider(label?: string): string {
  if (!label) {
    return `<div style="height:1px;background:${EMAIL_THEME.border};margin:32px 0;line-height:1px;font-size:1px;">&nbsp;</div>`;
  }
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;border-collapse:collapse;">
      <tr>
        <td style="border-bottom:1px solid ${EMAIL_THEME.border};width:42%;line-height:1px;">&nbsp;</td>
        <td style="padding:0 14px;font-family:${FONT_STACK};color:${EMAIL_THEME.textSubtle};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;white-space:nowrap;text-align:center;">${label}</td>
        <td style="border-bottom:1px solid ${EMAIL_THEME.border};width:42%;line-height:1px;">&nbsp;</td>
      </tr>
    </table>
  `;
}

/** Trust badges row — Trustpilot, BBB etc. */
export function buildTrustRow(): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:32px 0 8px;">
      <tr>
        <td align="center" style="padding:18px;background:#f8fafc;border:1px solid ${EMAIL_THEME.border};border-radius:10px;font-family:${FONT_STACK};">
          <div style="color:${EMAIL_THEME.textSubtle};font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:10px;">Trusted by 50,000+ borrowers</div>
          <div style="color:${EMAIL_THEME.brandPrimary};font-size:13px;font-weight:600;line-height:1.7;">★ ★ ★ ★ ★ &nbsp;<span style="color:${EMAIL_THEME.textMuted};">4.8 / 5</span> &nbsp;·&nbsp; <span style="color:${EMAIL_THEME.textMuted};">BBB A+ Rated</span> &nbsp;·&nbsp; <span style="color:${EMAIL_THEME.textMuted};">256-bit Encryption</span></div>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Wrap arbitrary inner HTML into a polished email shell:
 *   header → optional hero → body → footer.
 * Use this for new templates instead of hand-writing the boilerplate.
 */
export function buildEmailShell(opts: {
  subject: string;
  preheader?: string; // hidden inbox preview text
  hero?: Parameters<typeof buildHero>[0];
  body: string; // raw HTML for the content block
}): string {
  const preheader = opts.preheader || "";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${opts.subject}</title>
    <style>
      body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
      img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; display:block; }
      body { margin:0 !important; padding:0 !important; width:100% !important; }
      .body-content p { margin:0 0 16px; line-height:1.65; }
      .body-content p:last-child { margin-bottom:0; }
      .body-content ul, .body-content ol { margin:16px 0; padding-left:22px; line-height:1.75; }
      .body-content ul li, .body-content ol li { margin-bottom:8px; }
      .body-content h2, .body-content h3 { margin:24px 0 12px; line-height:1.35; }
      @media (prefers-color-scheme: dark) {
        body, .canvas { background:${EMAIL_THEME.canvas} !important; }
      }
      @media only screen and (max-width: 620px) {
        .container { width:100% !important; border-radius:0 !important; }
        .px { padding-left:22px !important; padding-right:22px !important; }
        .hero-px { padding:28px 22px 24px !important; }
      }
    </style>
  </head>
  <body class="canvas" style="margin:0;padding:0;background:${EMAIL_THEME.canvas};-webkit-font-smoothing:antialiased;">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${EMAIL_THEME.canvas};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;border-collapse:collapse;background:${EMAIL_THEME.surface};border-radius:16px;overflow:hidden;box-shadow:0 6px 30px rgba(15,23,42,0.08);">
            <tr><td style="padding:0;">${getEmailHeader()}</td></tr>
            ${opts.hero ? `<tr><td style="padding:0;">${buildHero(opts.hero)}</td></tr>` : ""}
            <tr>
              <td class="px body-content" style="padding:36px 36px 40px;font-family:${FONT_STACK};color:${EMAIL_THEME.text};font-size:14.5px;line-height:1.65;">
                ${opts.body}
              </td>
            </tr>
            <tr><td style="padding:0;">${getEmailFooter()}</td></tr>
          </table>
          <div style="font-family:${FONT_STACK};color:${EMAIL_THEME.textSubtle};font-size:11px;line-height:1.6;margin-top:22px;text-align:center;max-width:560px;padding:0 12px;">
            You're receiving this email because you have an account with ${COMPANY_INFO.name}.<br>
            ${COMPANY_INFO.address.formatted} · NMLS-registered lender · Equal Housing Opportunity
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Generate email footer HTML with company info
 */
export function getEmailFooter(): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:linear-gradient(135deg,${EMAIL_THEME.brandPrimaryDark} 0%,${EMAIL_THEME.brandPrimary} 100%);">
      <tr>
        <td align="center" style="padding:32px 28px 28px;font-family:${FONT_STACK};color:#ffffff;">
          <!-- Wordmark -->
          <div style="font-size:18px;font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">${COMPANY_INFO.name}</div>
          <div style="color:${EMAIL_THEME.brandAccent};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:18px;">Trusted Lending Solutions</div>

          <!-- Quick links -->
          <div style="margin-bottom:18px;">
            <a href="${COMPANY_INFO.website}/dashboard" style="color:#ffffff;text-decoration:none;font-size:12px;font-weight:600;margin:0 10px;">Dashboard</a>
            <span style="color:rgba(255,255,255,0.25);">·</span>
            <a href="${COMPANY_INFO.website}/loan-calculator" style="color:#ffffff;text-decoration:none;font-size:12px;font-weight:600;margin:0 10px;">Loan Calculator</a>
            <span style="color:rgba(255,255,255,0.25);">·</span>
            <a href="${COMPANY_INFO.website}/support" style="color:#ffffff;text-decoration:none;font-size:12px;font-weight:600;margin:0 10px;">Support</a>
          </div>

          <!-- Contact -->
          <div style="margin-bottom:14px;">
            <a href="mailto:${COMPANY_INFO.contact.email}" style="color:${EMAIL_THEME.brandAccent};text-decoration:none;font-weight:600;font-size:13px;">${COMPANY_INFO.contact.email}</a>
            <span style="margin:0 10px;color:rgba(255,255,255,0.25);">|</span>
            <a href="tel:${COMPANY_INFO.contact.phoneFormatted.replace(/\D/g, "")}" style="color:${EMAIL_THEME.brandAccent};text-decoration:none;font-weight:600;font-size:13px;">${COMPANY_INFO.contact.phone}</a>
          </div>

          <!-- Hours / Address -->
          <p style="margin:0 0 6px 0;color:rgba(255,255,255,0.7);font-size:11.5px;line-height:1.6;">${COMPANY_INFO.contact.supportHoursWeekday} &nbsp;·&nbsp; ${COMPANY_INFO.contact.supportHoursWeekend}</p>
          <p style="margin:0 0 18px 0;color:rgba(255,255,255,0.7);font-size:11.5px;line-height:1.6;">${COMPANY_INFO.address.formatted}</p>

          <!-- Legal divider -->
          <div style="border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;">
            <p style="margin:0 0 6px 0;color:rgba(255,255,255,0.55);font-size:10.5px;line-height:1.6;">
              © ${new Date().getFullYear()} ${COMPANY_INFO.name}. All rights reserved. NMLS-registered. Equal Housing Opportunity Lender.
            </p>
            <p style="margin:0;font-size:11px;">
              <a href="${COMPANY_INFO.website}/legal/privacy-policy" style="color:rgba(255,255,255,0.65);text-decoration:none;">Privacy</a>
              <span style="margin:0 6px;color:rgba(255,255,255,0.25);">·</span>
              <a href="${COMPANY_INFO.website}/legal/terms-of-service" style="color:rgba(255,255,255,0.65);text-decoration:none;">Terms</a>
              <span style="margin:0 6px;color:rgba(255,255,255,0.25);">·</span>
              <a href="${COMPANY_INFO.website}/legal/responsible-lending" style="color:rgba(255,255,255,0.65);text-decoration:none;">Responsible Lending</a>
              <span style="margin:0 6px;color:rgba(255,255,255,0.25);">·</span>
              <a href="${COMPANY_INFO.website}" style="color:rgba(255,255,255,0.65);text-decoration:none;">Website</a>
            </p>
          </div>
        </td>
      </tr>
    </table>
  `;
}
