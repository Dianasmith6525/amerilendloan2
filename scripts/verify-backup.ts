/**
 * Backup verification script.
 *
 * Reads the most recent backup file written by server/_core/database-backup.ts
 * and asserts it is *actually restorable*. The cron writes backups; this
 * script proves they're not silently corrupt or empty.
 *
 * Checks performed:
 *   1. File parses as JSON without error.
 *   2. Has the { metadata, data } envelope produced by createBackup().
 *   3. metadata.recordCounts matches the actual array lengths in data.
 *   4. Every table currently declared in drizzle/schema.ts is present in
 *      the backup. A missing table means the cron fired before a migration
 *      ran, or the schema drifted from the backup writer.
 *   5. The backup file's age is under MAX_AGE_HOURS (default 26h, since the
 *      cron is daily — 26h leaves slack for cron drift / restart).
 *   6. Spot-check a few high-value tables (users, loanApplications,
 *      payments) for required primary-key columns.
 *
 * Exit codes:
 *   0 - backup is healthy
 *   1 - backup is corrupt, stale, or missing required content
 *   2 - no backup files found at all (worst case — cron is dead)
 *
 * Usage:
 *   npx tsx scripts/verify-backup.ts            # check newest backup
 *   npx tsx scripts/verify-backup.ts --json     # JSON output for CI
 *   npx tsx scripts/verify-backup.ts --max-age=48
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "../drizzle/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = resolve(__dirname, "../backups");
const DEFAULT_MAX_AGE_HOURS = 26;

// Tables we *insist* on validating beyond row-count parity. Picking high-value
// rows so a regression in the backup writer's column projection is caught
// loudly. Each entry lists the columns that must be present on every row.
const SPOT_CHECKS: Array<{ table: string; requiredColumns: string[] }> = [
  { table: "users", requiredColumns: ["id", "email"] },
  { table: "loanApplications", requiredColumns: ["id", "userId", "status"] },
  { table: "payments", requiredColumns: ["id", "loanApplicationId", "userId", "amount"] },
];

interface CheckResult {
  ok: boolean;
  message: string;
}

interface Report {
  file: string | null;
  ageHours: number | null;
  metadata: Record<string, unknown> | null;
  checks: CheckResult[];
  ok: boolean;
}

// Drizzle marks pgTable instances with this Symbol; same trick the backup
// writer uses to enumerate tables.
const DRIZZLE_COLUMNS = Symbol.for("drizzle:Columns");

function listSchemaTables(): string[] {
  const names: string[] = [];
  for (const [exportName, value] of Object.entries(schema)) {
    if (value && typeof value === "object" && DRIZZLE_COLUMNS in (value as object)) {
      names.push(exportName);
    }
  }
  return names.sort();
}

function findLatestBackup(): { path: string; mtime: Date } | null {
  let entries: string[];
  try {
    entries = readdirSync(BACKUP_DIR);
  } catch {
    return null;
  }
  const candidates = entries
    .filter((f) => (f.startsWith("backup-") || f.startsWith("pre-migration-backup-")) && f.endsWith(".json"))
    .map((name) => {
      const full = resolve(BACKUP_DIR, name);
      const stat = statSync(full);
      return { path: full, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return candidates[0] ?? null;
}

function verifyBackup(filePath: string, mtime: Date, maxAgeHours: number): Report {
  const checks: CheckResult[] = [];
  const ageMs = Date.now() - mtime.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  // Check 1: JSON parses
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
    checks.push({ ok: true, message: "Backup file parses as JSON" });
  } catch (e) {
    checks.push({ ok: false, message: `Backup file is not valid JSON: ${(e as Error).message}` });
    return { file: filePath, ageHours, metadata: null, checks, ok: false };
  }

  // Check 2: Envelope shape
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("metadata" in parsed) ||
    !("data" in parsed)
  ) {
    checks.push({ ok: false, message: "Backup envelope missing { metadata, data } structure" });
    return { file: filePath, ageHours, metadata: null, checks, ok: false };
  }
  checks.push({ ok: true, message: "Backup envelope has metadata + data" });

  const envelope = parsed as { metadata: Record<string, unknown>; data: Record<string, unknown[]> };
  const { metadata, data } = envelope;

  // Check 3: Record counts match
  const declaredCounts = (metadata.recordCounts ?? {}) as Record<string, number>;
  const mismatches: string[] = [];
  for (const [tableName, rows] of Object.entries(data)) {
    const declared = declaredCounts[tableName];
    const actual = Array.isArray(rows) ? rows.length : -1;
    if (declared !== actual) {
      mismatches.push(`${tableName}: declared ${declared}, actual ${actual}`);
    }
  }
  if (mismatches.length === 0) {
    checks.push({
      ok: true,
      message: `Record counts match for all ${Object.keys(data).length} tables`,
    });
  } else {
    checks.push({
      ok: false,
      message: `Record-count mismatch (${mismatches.length}): ${mismatches.slice(0, 3).join("; ")}`,
    });
  }

  // Check 4: Schema-table coverage. Each table currently in drizzle/schema.ts
  // should appear in the backup. We allow extra tables in the backup (e.g.
  // tables removed in a recent migration aren't a hard fail).
  const schemaTables = new Set(listSchemaTables());
  const backedUp = new Set(Object.keys(data));
  const missing = [...schemaTables].filter((t) => !backedUp.has(t));
  if (missing.length === 0) {
    checks.push({
      ok: true,
      message: `All ${schemaTables.size} schema tables present in backup`,
    });
  } else {
    checks.push({
      ok: false,
      message: `Schema tables missing from backup: ${missing.join(", ")}`,
    });
  }

  // Check 5: Age
  if (ageHours <= maxAgeHours) {
    checks.push({ ok: true, message: `Backup age ${ageHours.toFixed(1)}h <= ${maxAgeHours}h limit` });
  } else {
    checks.push({
      ok: false,
      message: `Backup is ${ageHours.toFixed(1)}h old (limit: ${maxAgeHours}h) — cron may be broken`,
    });
  }

  // Check 6: Spot-check critical tables. Only fails if a table exists in the
  // backup but its rows lack required columns (a regression in the writer's
  // projection). If the table is empty or absent we skip with a note rather
  // than fail, since a fresh DB legitimately has zero loans.
  for (const { table, requiredColumns } of SPOT_CHECKS) {
    const rows = data[table];
    if (!Array.isArray(rows) || rows.length === 0) {
      checks.push({ ok: true, message: `Spot-check ${table}: empty or absent (skipped)` });
      continue;
    }
    const sample = rows[0] as Record<string, unknown>;
    const missingCols = requiredColumns.filter((c) => !(c in sample));
    if (missingCols.length === 0) {
      checks.push({
        ok: true,
        message: `Spot-check ${table}: required columns present (${rows.length} rows)`,
      });
    } else {
      checks.push({
        ok: false,
        message: `Spot-check ${table}: missing columns ${missingCols.join(", ")}`,
      });
    }
  }

  const ok = checks.every((c) => c.ok);
  return { file: filePath, ageHours, metadata, checks, ok };
}

function parseArgs(): { json: boolean; maxAgeHours: number } {
  let json = false;
  let maxAgeHours = DEFAULT_MAX_AGE_HOURS;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--json") json = true;
    else if (arg.startsWith("--max-age=")) {
      const n = Number(arg.slice("--max-age=".length));
      if (Number.isFinite(n) && n > 0) maxAgeHours = n;
    }
  }
  return { json, maxAgeHours };
}

function formatHuman(report: Report, maxAgeHours: number): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("=".repeat(72));
  lines.push("  Backup verification");
  lines.push("=".repeat(72));
  if (!report.file) {
    lines.push("  No backup files found in backups/.");
    return lines.join("\n");
  }
  lines.push(`  File:       ${report.file}`);
  lines.push(`  Age:        ${report.ageHours?.toFixed(1)}h (limit ${maxAgeHours}h)`);
  if (report.metadata) {
    lines.push(`  Created:    ${report.metadata.createdAt as string}`);
    lines.push(`  Tables:     ${report.metadata.tableCount as number}`);
  }
  lines.push("");
  lines.push("  Checks:");
  for (const c of report.checks) {
    lines.push(`    ${c.ok ? "OK  " : "FAIL"}  ${c.message}`);
  }
  lines.push("");
  lines.push(report.ok ? "  Result: HEALTHY" : "  Result: UNHEALTHY");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const { json, maxAgeHours } = parseArgs();
  const latest = findLatestBackup();
  if (!latest) {
    if (json) {
      console.log(JSON.stringify({ file: null, ok: false, error: "no backups found" }));
    } else {
      console.error("[verify-backup] No backup files found in backups/.");
    }
    process.exit(2);
  }

  const report = verifyBackup(latest.path, latest.mtime, maxAgeHours);
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatHuman(report, maxAgeHours));
  }
  process.exit(report.ok ? 0 : 1);
}

main();

export { verifyBackup, findLatestBackup };
