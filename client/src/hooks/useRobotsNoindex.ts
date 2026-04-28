import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Path prefixes that should never be indexed by search engines.
 * Keep in sync with the Disallow list in client/public/robots.txt.
 *
 * robots.txt only *requests* crawlers not to visit; it does NOT prevent
 * indexing of URLs discovered via inbound links. The only reliable signal
 * is a <meta name="robots" content="noindex"> on the page itself, which
 * this hook installs route-by-route.
 */
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
  "/api/",
  "/404",
];

function isPrivatePath(path: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) =>
      path === prefix || path === prefix.replace(/\/$/, "") || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`),
  );
}

const META_ID = "robots-noindex-private-route";

/**
 * Installs / removes a <meta name="robots" content="noindex,nofollow"> tag
 * whenever the user navigates between public and private routes.
 *
 * Place a single instance high in the tree (App root). It writes directly
 * to document.head and respects per-page SEOHead overrides because it
 * uses a unique element id, so SEOHead's own noindex tag (which has no id)
 * never collides with this one.
 */
export default function useRobotsNoindex(): void {
  const [location] = useLocation();

  useEffect(() => {
    const shouldNoindex = isPrivatePath(location);
    let meta = document.getElementById(META_ID) as HTMLMetaElement | null;

    if (shouldNoindex) {
      if (!meta) {
        meta = document.createElement("meta");
        meta.id = META_ID;
        meta.name = "robots";
        meta.content = "noindex,nofollow";
        document.head.appendChild(meta);
      }
    } else if (meta) {
      meta.parentNode?.removeChild(meta);
    }
  }, [location]);
}

export { isPrivatePath, PRIVATE_PREFIXES };
