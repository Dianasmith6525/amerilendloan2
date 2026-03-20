import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import * as fs from "fs";
import * as path from "path";

// Backup configuration
const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 50; // Keep last 50 backups (more than before since frequency is higher)

// Track last backup status for health monitoring
let lastBackupStatus: {
  timestamp: string | null;
  success: boolean;
  tableCount: number;
  totalRecords: number;
  filename: string | null;
  error: string | null;
} = {
  timestamp: null,
  success: false,
  tableCount: 0,
  totalRecords: 0,
  filename: null,
  error: null,
};

export function getBackupHealth() {
  return { ...lastBackupStatus };
}

// Ensure backup directory exists
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`[Backup] Created backup directory: ${BACKUP_DIR}`);
  }
}

// Get timestamp for backup filename
function getBackupTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

// Clean up old backups (keep only MAX_BACKUPS)
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => (f.startsWith("backup-") || f.startsWith("pre-migration-backup-")) && f.endsWith(".json"))
      .sort()
      .reverse();

    if (files.length > MAX_BACKUPS) {
      const filesToDelete = files.slice(MAX_BACKUPS);
      for (const file of filesToDelete) {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
        console.log(`[Backup] Deleted old backup: ${file}`);
      }
    }
  } catch (error) {
    console.error("[Backup] Error cleaning up old backups:", error);
  }
}

// Export all tables to a backup file
export async function createBackup(): Promise<string | null> {
  console.log("[Backup] Starting database backup...");
  
  try {
    ensureBackupDir();
    
    const db = await getDb();
    if (!db) {
      console.error("[Backup] Database connection not available");
      return null;
    }
    const backupData: Record<string, any[]> = {};
    
    // Dynamically export ALL tables from schema
    // Uses Drizzle's internal Symbol to identify pgTable objects vs enums/types
    const DrizzleColumns = Symbol.for('drizzle:Columns');
    for (const [tableName, tableValue] of Object.entries(schema)) {
      if (tableValue && typeof tableValue === 'object' && DrizzleColumns in (tableValue as any)) {
        try {
          console.log(`[Backup] Exporting ${tableName}...`);
          backupData[tableName] = await db.select().from(tableValue as any);
        } catch (e) {
          console.warn(`[Backup] Failed to export ${tableName}:`, (e as Error).message);
        }
      }
    }

    // Add metadata
    const metadata = {
      createdAt: new Date().toISOString(),
      version: "1.0",
      tableCount: Object.keys(backupData).length,
      recordCounts: Object.fromEntries(
        Object.entries(backupData).map(([table, records]) => [table, records.length])
      ),
    };

    const fullBackup = {
      metadata,
      data: backupData,
    };

    // Save backup file
    const timestamp = getBackupTimestamp();
    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(fullBackup, null, 2));
    
    // Verify backup file is valid by re-reading and parsing it
    const verifyContent = fs.readFileSync(filepath, "utf-8");
    const verifyData = JSON.parse(verifyContent);
    if (!verifyData.metadata || !verifyData.data || verifyData.metadata.tableCount !== metadata.tableCount) {
      throw new Error("Backup verification failed: file contents don't match expected data");
    }
    
    const totalRecords = Object.values(backupData).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[Backup] ✅ Backup created and verified: ${filename}`);
    console.log(`[Backup] Tables: ${metadata.tableCount}, Total records: ${totalRecords}`);
    
    // Update health status
    lastBackupStatus = {
      timestamp: metadata.createdAt,
      success: true,
      tableCount: metadata.tableCount,
      totalRecords,
      filename,
      error: null,
    };
    
    // Cleanup old backups
    cleanupOldBackups();
    
    return filepath;
  } catch (error) {
    const errMsg = (error as Error).message;
    console.error("[Backup] ❌ Backup failed:", error);
    lastBackupStatus = {
      timestamp: new Date().toISOString(),
      success: false,
      tableCount: 0,
      totalRecords: 0,
      filename: null,
      error: errMsg,
    };
    return null;
  }
}

// Create a pre-migration backup (tagged differently for easy identification)
export async function createPreMigrationBackup(): Promise<string | null> {
  console.log("[Backup] Creating pre-migration safety backup...");
  try {
    ensureBackupDir();
    const result = await createBackup();
    if (result) {
      // Rename to indicate it's a pre-migration backup
      const preMigrationName = result.replace("backup-", "pre-migration-backup-");
      fs.renameSync(result, preMigrationName);
      console.log(`[Backup] ✅ Pre-migration backup: ${path.basename(preMigrationName)}`);
      return preMigrationName;
    }
    return null;
  } catch (error) {
    console.error("[Backup] ❌ Pre-migration backup failed:", error);
    return null;
  }
}

// Restore from a backup file
export async function restoreBackup(backupFilePath: string): Promise<boolean> {
  console.log(`[Restore] Starting restore from: ${backupFilePath}`);
  
  try {
    if (!fs.existsSync(backupFilePath)) {
      console.error("[Restore] Backup file not found:", backupFilePath);
      return false;
    }
    
    const db = await getDb();
    if (!db) {
      console.error("[Restore] Database connection not available");
      return false;
    }
    const backupContent = fs.readFileSync(backupFilePath, "utf-8");
    const backup = JSON.parse(backupContent);
    
    console.log("[Restore] Backup metadata:", backup.metadata);
    
    const data = backup.data;
    
    // Restore in order (respecting foreign key constraints)
    // Users first (no dependencies)
    if (data.users?.length > 0) {
      console.log(`[Restore] Restoring ${data.users.length} users...`);
      for (const user of data.users) {
        try {
          await db.insert(schema.users).values(user).onConflictDoNothing();
        } catch (e) {
          console.warn(`[Restore] Skipping user ${user.id}:`, (e as Error).message);
        }
      }
    }
    
    // Fee configuration (no dependencies)
    if (data.feeConfiguration?.length > 0) {
      console.log(`[Restore] Restoring ${data.feeConfiguration.length} fee configs...`);
      for (const config of data.feeConfiguration) {
        try {
          await db.insert(schema.feeConfiguration).values(config).onConflictDoNothing();
        } catch (e) {
          console.warn(`[Restore] Skipping fee config:`, (e as Error).message);
        }
      }
    }
    
    // Loan applications (depends on users)
    if (data.loanApplications?.length > 0) {
      console.log(`[Restore] Restoring ${data.loanApplications.length} loan applications...`);
      for (const app of data.loanApplications) {
        try {
          await db.insert(schema.loanApplications).values(app).onConflictDoNothing();
        } catch (e) {
          console.warn(`[Restore] Skipping loan app ${app.id}:`, (e as Error).message);
        }
      }
    }
    
    // Payment schedules (depends on loan applications)
    if (data.paymentSchedules?.length > 0) {
      console.log(`[Restore] Restoring ${data.paymentSchedules.length} payment schedules...`);
      for (const schedule of data.paymentSchedules) {
        try {
          await db.insert(schema.paymentSchedules).values(schedule).onConflictDoNothing();
        } catch (e) {
          console.warn(`[Restore] Skipping payment schedule:`, (e as Error).message);
        }
      }
    }
    
    // Payments (depends on loan applications)
    if (data.payments?.length > 0) {
      console.log(`[Restore] Restoring ${data.payments.length} payments...`);
      for (const payment of data.payments) {
        try {
          await db.insert(schema.payments).values(payment).onConflictDoNothing();
        } catch (e) {
          console.warn(`[Restore] Skipping payment:`, (e as Error).message);
        }
      }
    }
    
    // Disbursements (depends on loan applications)
    if (data.disbursements?.length > 0) {
      console.log(`[Restore] Restoring ${data.disbursements.length} disbursements...`);
      for (const disbursement of data.disbursements) {
        try {
          await db.insert(schema.disbursements).values(disbursement).onConflictDoNothing();
        } catch (e) {
          console.warn(`[Restore] Skipping disbursement:`, (e as Error).message);
        }
      }
    }
    
    // Support tickets (depends on users)
    if (data.supportTickets?.length > 0) {
      console.log(`[Restore] Restoring ${data.supportTickets.length} support tickets...`);
      for (const ticket of data.supportTickets) {
        try {
          await db.insert(schema.supportTickets).values(ticket).onConflictDoNothing();
        } catch (e) {
          console.warn(`[Restore] Skipping ticket:`, (e as Error).message);
        }
      }
    }
    
    // Ticket messages (depends on tickets)
    if (data.ticketMessages?.length > 0) {
      console.log(`[Restore] Restoring ${data.ticketMessages.length} ticket messages...`);
      for (const msg of data.ticketMessages) {
        try {
          await db.insert(schema.ticketMessages).values(msg).onConflictDoNothing();
        } catch (e) {
          console.warn(`[Restore] Skipping ticket message:`, (e as Error).message);
        }
      }
    }
    
    // Uploaded documents (depends on users/loan applications)
    if (data.uploadedDocuments?.length > 0) {
      console.log(`[Restore] Restoring ${data.uploadedDocuments.length} uploaded documents...`);
      for (const doc of data.uploadedDocuments) {
        try {
          await db.insert(schema.uploadedDocuments).values(doc).onConflictDoNothing();
        } catch (e) {
          console.warn(`[Restore] Skipping document:`, (e as Error).message);
        }
      }
    }
    
    // Bank accounts (depends on users)
    if (data.bankAccounts?.length > 0) {
      console.log(`[Restore] Restoring ${data.bankAccounts.length} bank accounts...`);
      for (const account of data.bankAccounts) {
        try {
          await db.insert(schema.bankAccounts).values(account).onConflictDoNothing();
        } catch (e) {
          console.warn(`[Restore] Skipping bank account:`, (e as Error).message);
        }
      }
    }
    
    // Notifications
    if (data.userNotifications?.length > 0) {
      console.log(`[Restore] Restoring ${data.userNotifications.length} notifications...`);
      for (const notification of data.userNotifications) {
        try {
          await db.insert(schema.userNotifications).values(notification).onConflictDoNothing();
        } catch (e) {
          console.warn(`[Restore] Skipping notification:`, (e as Error).message);
        }
      }
    }
    
    // Dynamically restore ALL remaining tables from the backup
    const alreadyRestored = new Set([
      'users', 'feeConfiguration', 'loanApplications', 'paymentSchedules',
      'payments', 'disbursements', 'supportTickets', 'ticketMessages',
      'uploadedDocuments', 'bankAccounts', 'userNotifications',
    ]);

    // Build a map of schema table name -> Drizzle table object
    const DrizzleColumns = Symbol.for('drizzle:Columns');
    const schemaTableMap: Record<string, any> = {};
    for (const [name, value] of Object.entries(schema)) {
      if (value && typeof value === 'object' && DrizzleColumns in (value as any)) {
        schemaTableMap[name] = value;
      }
    }

    for (const tableName of Object.keys(data)) {
      if (alreadyRestored.has(tableName)) continue;
      if (!data[tableName]?.length) continue;
      if (!schemaTableMap[tableName]) {
        console.warn(`[Restore] Unknown table in backup: ${tableName}, skipping`);
        continue;
      }

      console.log(`[Restore] Restoring ${data[tableName].length} ${tableName}...`);
      for (const record of data[tableName]) {
        try {
          await db.insert(schemaTableMap[tableName]).values(record).onConflictDoNothing();
        } catch (e) {
          // Skip individual record failures (FK constraints, etc.)
        }
      }
    }
    
    console.log("[Restore] ✅ Restore completed successfully!");
    return true;
  } catch (error) {
    console.error("[Restore] ❌ Restore failed:", error);
    return false;
  }
}

// List available backups
export function listBackups(): { filename: string; createdAt: string; size: number }[] {
  ensureBackupDir();
  
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => (f.startsWith("backup-") || f.startsWith("pre-migration-backup-")) && f.endsWith(".json"))
      .sort()
      .reverse();

    return files.map(filename => {
      const filepath = path.join(BACKUP_DIR, filename);
      const stats = fs.statSync(filepath);
      
      // Extract date from filename
      const dateMatch = filename.match(/backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
      const createdAt = dateMatch 
        ? dateMatch[1].replace(/-/g, (m, i) => i > 9 ? ":" : "-").replace("T", " ")
        : stats.mtime.toISOString();
      
      return {
        filename,
        createdAt,
        size: stats.size,
      };
    });
  } catch (error) {
    console.error("[Backup] Error listing backups:", error);
    return [];
  }
}

// Backup scheduler - runs daily
let backupInterval: NodeJS.Timeout | null = null;

export function startBackupScheduler(intervalHours: number = 6) {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  
  console.log(`[Backup Scheduler] Starting automated backups every ${intervalHours} hours`);
  
  // Run first backup after 1 minute (to let the server fully start)
  setTimeout(async () => {
    console.log("[Backup Scheduler] Running initial backup...");
    await createBackup();
  }, 60 * 1000);
  
  // Schedule recurring backups
  backupInterval = setInterval(async () => {
    console.log("[Backup Scheduler] Running scheduled backup...");
    await createBackup();
  }, intervalMs);
  
  console.log(`[Backup Scheduler] ✅ Scheduler started`);
}

export function stopBackupScheduler() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
    console.log("[Backup Scheduler] Stopped");
  }
}
