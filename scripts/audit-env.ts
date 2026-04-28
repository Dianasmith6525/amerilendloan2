/**
 * Environment audit script.
 *
 * Reads the Zod schema from server/_core/env.ts and reports which keys are
 * declared, which are populated at runtime, and which integrations are
 * effectively disabled because their secrets are missing.
 *
 * Usage:
 *   npx tsx scripts/audit-env.ts                  # human-readable report
 *   npx tsx scripts/audit-env.ts --json           # machine-readable JSON
 *   npx tsx scripts/audit-env.ts --strict         # exit non-zero if any
 *                                                 # required-for-production
 *                                                 # key is missing
 *
 * Designed to be cheap to run in CI: no DB connections, no network calls,
 * just process.env introspection.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_SCHEMA_PATH = resolve(__dirname, "../server/_core/env.ts");

// ---------------------------------------------------------------------------
// Group keys into "integration buckets" so the report tells operators *what
// breaks* when a value is missing, not just which env-var name is empty.
// Each bucket lists the env-var names the integration needs in order to be
// considered "configured".
// ---------------------------------------------------------------------------
const INTEGRATION_BUCKETS: Array<{
  name: string;
  description: string;
  requires: string[];
  /** True if this integration must be configured for production. */
  productionRequired: boolean;
}> = [
  {
    name: "core",
    description: "App, JWT signing, database",
    requires: ["VITE_APP_ID", "JWT_SECRET", "DATABASE_URL"],
    productionRequired: true,
  },
  {
    name: "stripe",
    description: "Card payments + webhook signature verification",
    requires: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"],
    productionRequired: true,
  },
  {
    name: "supabase",
    description: "Auth + realtime",
    requires: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
    productionRequired: false,
  },
  {
    name: "sendgrid",
    description: "Transactional email",
    requires: ["SENDGRID_API_KEY", "SENDGRID_VERIFIED_EMAIL"],
    productionRequired: true,
  },
  {
    name: "twilio",
    description: "SMS / phone OTP",
    requires: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
    productionRequired: false,
  },
  {
    name: "encryption",
    description: "AES-256 encryption for SSN / bank credentials at rest",
    requires: ["ENCRYPTION_KEY"],
    productionRequired: true,
  },
  {
    name: "turnstile",
    description: "Cloudflare bot verification on public forms",
    requires: ["TURNSTILE_SECRET_KEY", "VITE_TURNSTILE_SITE_KEY"],
    productionRequired: false,
  },
  {
    name: "oauth-google",
    description: "Sign in with Google",
    requires: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    productionRequired: false,
  },
  {
    name: "oauth-github",
    description: "Sign in with GitHub",
    requires: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
    productionRequired: false,
  },
  {
    name: "oauth-microsoft",
    description: "Sign in with Microsoft",
    requires: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
    productionRequired: false,
  },
  {
    name: "forge-storage",
    description: "Durable backup storage (falls back to local disk if unset)",
    requires: ["BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY"],
    productionRequired: false,
  },
  {
    name: "openai",
    description: "AI features (admin assistant, etc.)",
    requires: ["OPENAI_API_KEY"],
    productionRequired: false,
  },
];

// ---------------------------------------------------------------------------
// Extract declared keys from env.ts by parsing the file textually. Importing
// env.ts directly would trigger its validate-and-exit side effect, which is
// undesirable for a tool that's meant to *report* on missing values.
// ---------------------------------------------------------------------------
function extractDeclaredKeys(): string[] {
  const source = readFileSync(ENV_SCHEMA_PATH, "utf8");
  const schemaStart = source.indexOf("const envSchema = z.object({");
  const schemaEnd = source.indexOf("});", schemaStart);
  if (schemaStart < 0 || schemaEnd < 0) {
    throw new Error("Could not locate envSchema block in env.ts. Has the file been refactored?");
  }
  const block = source.slice(schemaStart, schemaEnd);
  // Match identifiers that look like env-var keys (uppercase + underscores +
  // optional digits) followed by a colon. Avoids matching code on inner lines.
  const matches = block.match(/^\s*([A-Z][A-Z0-9_]+):/gm) ?? [];
  return Array.from(new Set(matches.map((m) => m.trim().replace(":", ""))));
}

// ---------------------------------------------------------------------------
// Report builders
// ---------------------------------------------------------------------------
interface KeyStatus {
  key: string;
  set: boolean;
  /** Length of the value if set. Helps spot "set to empty string" bugs. */
  length: number;
  /** True if this key is declared in env.ts. */
  declared: boolean;
}

interface IntegrationStatus {
  name: string;
  description: string;
  configured: boolean;
  productionRequired: boolean;
  missingKeys: string[];
}

function buildReport() {
  const declared = extractDeclaredKeys();
  const declaredSet = new Set(declared);

  const keys: KeyStatus[] = declared
    .map((key) => {
      const raw = process.env[key];
      const value = typeof raw === "string" ? raw.trim() : "";
      return {
        key,
        set: value.length > 0,
        length: value.length,
        declared: true,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  // Catch keys referenced by integration buckets but not declared in env.ts —
  // these are typos waiting to happen.
  const orphanRequires: string[] = [];
  for (const bucket of INTEGRATION_BUCKETS) {
    for (const required of bucket.requires) {
      if (!declaredSet.has(required)) orphanRequires.push(`${bucket.name}:${required}`);
    }
  }

  const integrations: IntegrationStatus[] = INTEGRATION_BUCKETS.map((bucket) => {
    const missing = bucket.requires.filter((k) => {
      const v = process.env[k];
      return !(typeof v === "string" && v.trim().length > 0);
    });
    return {
      name: bucket.name,
      description: bucket.description,
      configured: missing.length === 0,
      productionRequired: bucket.productionRequired,
      missingKeys: missing,
    };
  });

  const productionGaps = integrations.filter(
    (i) => i.productionRequired && !i.configured,
  );

  return { keys, integrations, productionGaps, orphanRequires };
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
function formatHuman(report: ReturnType<typeof buildReport>): string {
  const lines: string[] = [];
  const env = process.env.NODE_ENV ?? "(unset)";
  lines.push("");
  lines.push("=".repeat(72));
  lines.push(`  Environment audit  -  NODE_ENV=${env}`);
  lines.push("=".repeat(72));

  // Per-key table
  lines.push("");
  lines.push("Declared env keys:");
  const keyCol = Math.max(...report.keys.map((k) => k.key.length));
  for (const k of report.keys) {
    const status = k.set ? `set  (len=${k.length})` : "missing";
    const marker = k.set ? "✓" : "✗";
    lines.push(`  ${marker} ${k.key.padEnd(keyCol)}  ${status}`);
  }

  // Integration table
  lines.push("");
  lines.push("Integrations:");
  for (const i of report.integrations) {
    const marker = i.configured ? "✓" : i.productionRequired ? "✗" : "·";
    const flag = i.productionRequired ? " [required-in-prod]" : "";
    lines.push(`  ${marker} ${i.name.padEnd(18)} ${i.configured ? "configured" : "DISABLED"}${flag}`);
    lines.push(`      ${i.description}`);
    if (i.missingKeys.length > 0) {
      lines.push(`      missing: ${i.missingKeys.join(", ")}`);
    }
  }

  if (report.orphanRequires.length > 0) {
    lines.push("");
    lines.push("⚠  Integration buckets reference undeclared env keys (likely typo):");
    for (const o of report.orphanRequires) lines.push(`    - ${o}`);
  }

  lines.push("");
  if (report.productionGaps.length === 0) {
    lines.push("✓  All production-required integrations are configured.");
  } else {
    lines.push(`✗  ${report.productionGaps.length} production-required integration(s) DISABLED:`);
    for (const g of report.productionGaps) lines.push(`    - ${g.name} (missing: ${g.missingKeys.join(", ")})`);
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function main() {
  const args = new Set(process.argv.slice(2));
  const json = args.has("--json");
  const strict = args.has("--strict");

  const report = buildReport();

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatHuman(report));
  }

  if (strict && (report.productionGaps.length > 0 || report.orphanRequires.length > 0)) {
    process.exit(1);
  }
}

main();

// Re-exported for use in /health/detailed or admin UI tooling later. Kept at
// the bottom so this file can be executed directly without side effects from
// the schema (we never import env.ts).
export { buildReport, INTEGRATION_BUCKETS };
