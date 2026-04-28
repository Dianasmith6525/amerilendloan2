/**
 * Per-route SEO meta injection for the SPA fallback handler.
 *
 * The React app sets meta tags client-side via SEOHead, but search-engine
 * crawlers and social-media scrapers (Facebook, Twitter, LinkedIn, Slack,
 * iMessage previews, older Bingbot) often don't execute JS. Without this
 * module, every URL would share the homepage's <title> and og:image,
 * destroying SERP click-through and social previews.
 *
 * On every SPA request we read dist/public/index.html, look up the path in
 * the route table, and rewrite the head's <title>, description, canonical,
 * and Open Graph tags before responding. We also inject a per-page JSON-LD
 * <script> for richer SERP results.
 */

const SITE_URL = "https://amerilendloan.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/logo-new.jpg`;

export interface RouteMeta {
  title: string;
  description: string;
  ogImage?: string;
  noindex?: boolean;
  /**
   * Optional JSON-LD payload(s) to inject as <script type="application/ld+json">.
   * Use this for FAQPage on the homepage, BreadcrumbList on article pages, etc.
   */
  jsonLd?: object[];
}

const HOMEPAGE_FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What are the eligibility requirements?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You must be at least 18 years old, have a valid email address, a verifiable source of income, and an active checking account.",
      },
    },
    {
      "@type": "Question",
      name: "How much can I borrow?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Personal loans range from $500 to $15,000. The amount you qualify for depends on your credit profile and verified income.",
      },
    },
    {
      "@type": "Question",
      name: "How quickly will I receive my funds?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "If your application is approved before 12:00 PM CT and verification is complete, funds can be deposited the same business day.",
      },
    },
    {
      "@type": "Question",
      name: "Will applying affect my credit score?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Checking your loan offers uses a soft credit pull, which does not affect your FICO score. A hard inquiry only happens if you accept a loan offer.",
      },
    },
    {
      "@type": "Question",
      name: "What can I use a personal loan for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Common uses include debt consolidation, medical bills, home improvement, auto repairs, moving costs, and emergency expenses.",
      },
    },
  ],
};

function breadcrumbList(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

const ROUTES: Record<string, RouteMeta> = {
  "/": {
    title: "AmeriLend — Personal Loans Made Easy",
    description:
      "Apply online in minutes with no application fee. Fast approvals, fixed rates from 5.99% APR, and same-day funding for qualifying applicants.",
    jsonLd: [HOMEPAGE_FAQ_LD],
  },
  "/about": {
    title: "About AmeriLend | Personal Loan Lender",
    description:
      "AmeriLend is a licensed personal loan lender (NMLS# 2487301) headquartered in San Diego, CA. Learn about our mission and the team behind the loans.",
    jsonLd: [
      breadcrumbList([
        { name: "Home", url: `${SITE_URL}/` },
        { name: "About", url: `${SITE_URL}/about` },
      ]),
    ],
  },
  "/how-it-works": {
    title: "How It Works | AmeriLend Personal Loans",
    description:
      "Three simple steps: complete an online application, choose your loan amount and terms, and get funds deposited as soon as the same business day.",
    jsonLd: [
      breadcrumbList([
        { name: "Home", url: `${SITE_URL}/` },
        { name: "How It Works", url: `${SITE_URL}/how-it-works` },
      ]),
    ],
  },
  "/rates": {
    title: "Rates & Terms | AmeriLend Personal Loans",
    description:
      "AmeriLend personal loans offer fixed APRs from 5.99% to 35.99%, loan amounts from $500 to $15,000, and terms from 6 to 36 months. No hidden fees.",
    jsonLd: [
      breadcrumbList([
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Rates", url: `${SITE_URL}/rates` },
      ]),
    ],
  },
  "/check-offers": {
    title: "Check Your Loan Offers | AmeriLend",
    description:
      "See your personalized loan offers in minutes with no impact on your credit score. Soft credit check only.",
  },
  "/apply": {
    title: "Apply for a Personal Loan | AmeriLend",
    description:
      "Complete your AmeriLend personal loan application in minutes. No paperwork, no application fee.",
  },
  "/contact": {
    title: "Contact AmeriLend Support",
    description:
      "Reach AmeriLend customer support by phone at (945) 212-1609 or email support@amerilendloan.com. Mon–Fri 8am–8pm ET.",
    jsonLd: [
      breadcrumbList([
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Contact", url: `${SITE_URL}/contact` },
      ]),
    ],
  },
  "/resources": {
    title: "Personal Finance Resources | AmeriLend",
    description:
      "Articles and guides on personal loans, debt consolidation, credit scores, and managing your finances.",
    jsonLd: [
      breadcrumbList([
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Resources", url: `${SITE_URL}/resources` },
      ]),
    ],
  },
  "/careers": {
    title: "Careers at AmeriLend",
    description:
      "Join the AmeriLend team. We're hiring across engineering, customer support, compliance, and operations.",
    jsonLd: [
      breadcrumbList([
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Careers", url: `${SITE_URL}/careers` },
      ]),
    ],
  },
  "/support": {
    title: "Help & Support Center | AmeriLend",
    description:
      "Get answers to common questions about your AmeriLend personal loan, payments, account, and more.",
  },
  "/legal/privacy-policy": {
    title: "Privacy Policy | AmeriLend",
    description: "How AmeriLend collects, uses, and protects your personal information.",
  },
  "/legal/terms-of-service": {
    title: "Terms of Service | AmeriLend",
    description: "Terms and conditions for using AmeriLend's website and services.",
  },
  "/legal/truth-in-lending": {
    title: "Truth in Lending Disclosure | AmeriLend",
    description: "Federal Truth in Lending Act disclosures for AmeriLend personal loans.",
  },
  "/legal/loan-agreement": {
    title: "Loan Agreement | AmeriLend",
    description: "Standard loan agreement terms for AmeriLend personal loans.",
  },
  "/legal/esign-consent": {
    title: "Electronic Signature Consent | AmeriLend",
    description: "Consent to use electronic signatures and records with AmeriLend.",
  },
  "/legal/accessibility": {
    title: "Accessibility Statement | AmeriLend",
    description:
      "AmeriLend is committed to providing an accessible website that meets WCAG 2.1 Level AA standards.",
  },
};

// Path prefixes for routes that should always carry noindex even though
// they share the SPA shell. Mirrors useRobotsNoindex on the client.
const PRIVATE_PREFIXES = [
  "/admin",
  "/dashboard",
  "/user-dashboard",
  "/profile",
  "/user-profile",
  "/settings",
  "/notifications",
  "/notification-settings",
  "/payment-history",
  "/payment-preferences",
  "/payment/",
  "/payment-enhanced/",
  "/pay-fee",
  "/bank-accounts",
  "/hardship",
  "/tax-documents",
  "/account-closure",
  "/chat",
  "/co-signers",
  "/financial-tools",
  "/virtual-card",
  "/e-signatures",
  "/referrals",
  "/loans/",
  "/otp-login",
  "/login",
  "/signup",
  "/register",
];

function isPrivatePath(p: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => p === prefix.replace(/\/$/, "") || p.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

export function lookupMeta(path: string): RouteMeta {
  // Strip query string and trailing slash (except for "/").
  const normalized = path.split("?")[0]!.replace(/\/+$/, "") || "/";
  const exact = ROUTES[normalized];
  if (exact) {
    return isPrivatePath(normalized) ? { ...exact, noindex: true } : exact;
  }
  if (isPrivatePath(normalized)) {
    return {
      title: "AmeriLend",
      description: "Account area — please sign in to continue.",
      noindex: true,
    };
  }
  // Unknown public path: use homepage defaults but don't make claims about content.
  return ROUTES["/"]!;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Rewrites the index.html shell to carry per-route meta tags before serving
 * to crawlers. Idempotent — relies on existing default tags being marked
 * `data-default="true"` so we know which to replace vs which to leave.
 */
export function injectRouteMeta(html: string, urlPath: string): string {
  const meta = lookupMeta(urlPath);
  const canonicalUrl = `${SITE_URL}${urlPath === "/" ? "/" : urlPath.replace(/\/+$/, "")}`;
  const ogImage = meta.ogImage ?? DEFAULT_OG_IMAGE;
  const fullTitle = meta.title;
  const desc = escapeHtml(meta.description);
  const titleEsc = escapeHtml(fullTitle);

  let out = html;

  // Replace <title>...</title> (Vite leaves %VITE_APP_TITLE% baked in here).
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${titleEsc}</title>`);

  // Description
  out = out.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${desc}" />`,
  );

  // og:title
  out = out.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${titleEsc}" />`,
  );

  // og:description
  out = out.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${desc}" />`,
  );

  // og:url (only the default-marked one — leaves any per-page client tags alone)
  out = out.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s+data-default="true"\s*\/?>/i,
    `<meta property="og:url" content="${canonicalUrl}" />`,
  );

  // canonical
  out = out.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s+data-default="true"\s*\/?>/i,
    `<link rel="canonical" href="${canonicalUrl}" />`,
  );

  // og:image (keep existing if a per-route image isn't specified)
  if (meta.ogImage) {
    out = out.replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:image" content="${escapeHtml(ogImage)}" />`,
    );
  }

  // Inject extras (noindex + JSON-LD + twitter:title/description/image)
  const extras: string[] = [];
  if (meta.noindex) {
    extras.push('<meta name="robots" content="noindex,nofollow" />');
  }
  extras.push(`<meta name="twitter:title" content="${titleEsc}" />`);
  extras.push(`<meta name="twitter:description" content="${desc}" />`);
  extras.push(`<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`);
  if (meta.jsonLd && meta.jsonLd.length > 0) {
    for (const ld of meta.jsonLd) {
      // JSON.stringify is safe inside <script type="application/ld+json">
      // as long as we escape `</` to prevent script tag breakouts.
      const json = JSON.stringify(ld).replace(/<\/(script)/gi, "<\\/$1");
      extras.push(`<script type="application/ld+json">${json}<\/script>`);
    }
  }

  out = out.replace("</head>", `${extras.join("\n    ")}\n  </head>`);

  return out;
}

export const __testing = { ROUTES, lookupMeta, isPrivatePath };
