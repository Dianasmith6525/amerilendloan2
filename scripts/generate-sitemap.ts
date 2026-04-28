/**
 * Sitemap generator.
 *
 * Produces client/public/sitemap.xml from a single source of truth so the file
 * doesn't drift each time we add or rename a public route. Runs automatically
 * before `vite build` via the `prebuild` npm script.
 *
 * Anything behind auth (dashboard, /admin/*, /profile, /payment/:id, etc.) is
 * intentionally excluded — those should not be in the public sitemap.
 *
 * Legal documents are discovered by reading client/public/legal/*.md so adding
 * a new policy file automatically makes it crawlable.
 */

import { readdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, resolve, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const LEGAL_DIR = resolve(REPO_ROOT, "client/public/legal");
const OUT_FILE = resolve(REPO_ROOT, "client/public/sitemap.xml");

const SITE_ORIGIN = process.env.SITEMAP_ORIGIN ?? "https://amerilendloan.com";

type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

interface SitemapEntry {
  path: string;
  changefreq: ChangeFreq;
  priority: number;
}

// Hand-curated list of public, indexable routes. Order matters: most important
// first. Keep this in sync with the public routes registered in
// client/src/App.tsx — anything that requires auth or is admin-only stays out.
const PUBLIC_ROUTES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: 1.0 },
  { path: "/apply", changefreq: "monthly", priority: 0.9 },
  { path: "/check-offers", changefreq: "monthly", priority: 0.8 },
  { path: "/about", changefreq: "monthly", priority: 0.8 },
  { path: "/how-it-works", changefreq: "monthly", priority: 0.8 },
  { path: "/rates", changefreq: "monthly", priority: 0.8 },
  { path: "/contact", changefreq: "monthly", priority: 0.7 },
  { path: "/resources", changefreq: "weekly", priority: 0.7 },
  { path: "/careers", changefreq: "monthly", priority: 0.6 },
  { path: "/support", changefreq: "monthly", priority: 0.6 },
  { path: "/login", changefreq: "yearly", priority: 0.3 },
];

function readLegalDocSlugs(): string[] {
  let entries: string[];
  try {
    entries = readdirSync(LEGAL_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((f) => extname(f).toLowerCase() === ".md")
    .map((f) => basename(f, ".md"))
    .sort();
}

function legalDocLastMod(slug: string): string {
  // Use the file mtime so /legal/* lastmod values change when we update copy.
  // Falls back to today's date if the stat fails for any reason.
  try {
    const stat = statSync(resolve(LEGAL_DIR, `${slug}.md`));
    return stat.mtime.toISOString().slice(0, 10);
  } catch {
    return today();
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderEntry(loc: string, lastmod: string, changefreq: ChangeFreq, priority: number): string {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    "  </url>",
  ].join("\n");
}

function build(): string {
  const buildDate = today();
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const route of PUBLIC_ROUTES) {
    lines.push(renderEntry(`${SITE_ORIGIN}${route.path}`, buildDate, route.changefreq, route.priority));
  }

  for (const slug of readLegalDocSlugs()) {
    lines.push(
      renderEntry(
        `${SITE_ORIGIN}/legal/${slug}`,
        legalDocLastMod(slug),
        "yearly",
        0.4,
      ),
    );
  }

  lines.push("</urlset>", "");
  return lines.join("\n");
}

function main() {
  const xml = build();
  writeFileSync(OUT_FILE, xml, "utf8");
  // eslint-disable-next-line no-console
  console.log(`[sitemap] wrote ${OUT_FILE} (${xml.split("\n").filter((l) => l.includes("<loc>")).length} URLs)`);
}

main();
