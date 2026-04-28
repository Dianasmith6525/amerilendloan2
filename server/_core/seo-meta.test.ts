import { describe, it, expect } from "vitest";
import { injectRouteMeta, lookupMeta } from "./seo-meta";

const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="default description" />
    <meta property="og:title" content="default og title" />
    <meta property="og:description" content="default og description" />
    <meta property="og:url" content="https://amerilendloan.com/" data-default="true" />
    <meta property="og:image" content="/images/logo-new.jpg" />
    <link rel="canonical" href="https://amerilendloan.com/" data-default="true" />
    <title>%VITE_APP_TITLE%</title>
  </head>
  <body><div id="root"></div></body>
</html>`;

describe("seo-meta", () => {
  it("rewrites title, description, canonical, og:url for the homepage", () => {
    const out = injectRouteMeta(SHELL, "/");
    expect(out).toContain("<title>AmeriLend — Personal Loans Made Easy</title>");
    expect(out).toContain('rel="canonical" href="https://amerilendloan.com/"');
    expect(out).toContain('property="og:url" content="https://amerilendloan.com/"');
    expect(out).toMatch(/<meta name="description" content="Apply online in minutes/);
  });

  it("injects FAQPage JSON-LD on the homepage", () => {
    const out = injectRouteMeta(SHELL, "/");
    expect(out).toContain('<script type="application/ld+json">');
    expect(out).toContain('"@type":"FAQPage"');
  });

  it("rewrites canonical for non-root public route", () => {
    const out = injectRouteMeta(SHELL, "/rates");
    expect(out).toContain('href="https://amerilendloan.com/rates"');
    expect(out).toContain("Rates &amp; Terms");
  });

  it("adds noindex meta for private routes", () => {
    const out = injectRouteMeta(SHELL, "/dashboard");
    expect(out).toContain('<meta name="robots" content="noindex,nofollow" />');
  });

  it("treats unknown private prefix as noindex", () => {
    const out = injectRouteMeta(SHELL, "/admin/settings/secret");
    expect(out).toContain("noindex,nofollow");
  });

  it("falls back to homepage meta for unknown public path", () => {
    const meta = lookupMeta("/some-random-marketing-url");
    expect(meta.noindex).toBeFalsy();
    expect(meta.title).toContain("AmeriLend");
  });

  it("escapes script close tags in JSON-LD payload", () => {
    const out = injectRouteMeta(SHELL, "/");
    // Ensure no literal "</script" appears inside the JSON-LD body
    const ldStart = out.indexOf('application/ld+json">');
    const ldEnd = out.indexOf("</script>", ldStart);
    const ldBody = out.slice(ldStart + 'application/ld+json">'.length, ldEnd);
    expect(ldBody).not.toMatch(/<\/script/i);
  });

  it("strips trailing slashes when looking up routes", () => {
    const meta = lookupMeta("/rates/");
    expect(meta.title).toContain("Rates");
  });
});
