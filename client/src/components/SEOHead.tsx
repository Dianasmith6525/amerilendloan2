import { useEffect } from "react";
import { useLocation } from "wouter";

interface SEOHeadProps {
  title: string;
  description: string;
  path?: string; // Override for canonical path (defaults to current route)
  noindex?: boolean;
}

const BASE_URL = "https://amerilendloan.com";

/**
 * Manages document <head> SEO tags per-route.
 * Sets title, meta description, canonical URL, og:title, og:description, og:url.
 * Cleans up dynamic tags on unmount to avoid stale meta from previous pages.
 */
export default function SEOHead({ title, description, path, noindex }: SEOHeadProps) {
  const [location] = useLocation();
  const canonicalPath = path ?? location;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const fullTitle = title.includes("AmeriLend") ? title : `${title} | AmeriLend`;

  useEffect(() => {
    document.title = fullTitle;

    const tags: HTMLElement[] = [];

    const setMeta = (attr: string, attrValue: string, content: string) => {
      // Update existing tag or create a new one
      let el = document.querySelector(`meta[${attr}="${attrValue}"]`) as HTMLMetaElement | null;
      if (el) {
        el.setAttribute("content", content);
      } else {
        el = document.createElement("meta");
        el.setAttribute(attr, attrValue);
        el.setAttribute("content", content);
        document.head.appendChild(el);
        tags.push(el);
      }
    };

    // Core meta
    setMeta("name", "description", description);

    // Open Graph
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonicalUrl);

    // Canonical link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      canonical.href = canonicalUrl;
    } else {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      canonical.href = canonicalUrl;
      document.head.appendChild(canonical);
      tags.push(canonical);
    }

    // Robots noindex (only if requested)
    if (noindex) {
      const robotsMeta = document.createElement("meta");
      robotsMeta.name = "robots";
      robotsMeta.content = "noindex";
      document.head.appendChild(robotsMeta);
      tags.push(robotsMeta);
    }

    return () => {
      // Remove only tags we created (not pre-existing ones we updated)
      tags.forEach((tag) => {
        if (tag.parentNode) tag.parentNode.removeChild(tag);
      });
    };
  }, [fullTitle, description, canonicalUrl, noindex]);

  return null;
}
