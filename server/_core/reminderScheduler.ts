/**
 * Automated Email Reminder Scheduler
 * 
 * Sends automated reminders for:
 * - Incomplete loan applications
 * - Unpaid processing fees
 * - Pending disbursement method updates
 * - Incomplete document uploads
 * - Inactive users
 */

import * as db from '../db';
import {
  sendIncompleteApplicationReminderEmail,
  sendUnpaidFeeReminderEmail,
  sendPendingDisbursementReminderEmail,
  sendIncompleteDocumentsReminderEmail,
  sendInactiveUserReminderEmail
} from './email';

let reminderInterval: NodeJS.Timeout | null = null;

/**
 * Check for incomplete loan applications (pending status for 24+ hours)
 */
async function checkIncompleteApplications() {
  try {
    console.log('[Reminder Scheduler] Checking for incomplete applications...');
    
    const allApplications = await db.getAllLoanApplications();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const app of allApplications) {
      // Only check pending applications
      if (app.status !== 'pending') continue;
      
      const createdAt = new Date(app.createdAt);
      
      // Send reminder if application is pending and created 24+ hours ago
      if (createdAt < twentyFourHoursAgo) {
        const user = await db.getUserById(app.userId);
        if (user && user.email) {
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';
          
          try {
            const appData = app as any;
            await sendIncompleteApplicationReminderEmail(
              user.email,
              fullName,
              appData.requestedAmount || appData.approvedAmount || 0,
              appData.purpose || 'personal loan',
              app.trackingNumber || `APP-${app.id}`
            );
            console.log(`[Reminder] Sent incomplete application reminder to ${user.email} for app ${app.id}`);
          } catch (error) {
            console.error(`[Reminder] Failed to send incomplete app reminder:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Reminder Scheduler] Error checking incomplete applications:', error);
  }
}

/**
 * Check for unpaid processing fees (approved/fee_pending loans awaiting payment)
 */
async function checkUnpaidFees() {
  try {
    console.log('[Reminder Scheduler] Checking for unpaid fees...');
    
    const allApplications = await db.getAllLoanApplications();
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    for (const app of allApplications) {
      // Only check approved or fee_pending applications
      if (app.status !== 'approved' && app.status !== 'fee_pending') continue;
      
      // Check if processing fee is paid
      const payments = await db.getPaymentsByLoanApplicationId(app.id);
      const feePayment = payments.find(p => {
        const payment = p as any;
        return payment.type === 'processing_fee' && p.status === 'succeeded';
      });
      
      if (!feePayment) {
        const approvedAt = app.approvedAt ? new Date(app.approvedAt) : new Date(app.updatedAt);
        
        // Send reminder if approved 6+ hours ago and no fee payment
        if (approvedAt < sixHoursAgo) {
          const user = await db.getUserById(app.userId);
          if (user && user.email) {
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';
            
            try {
              const appData = app as any;
              await sendUnpaidFeeReminderEmail(
                user.email,
                fullName,
                appData.approvedAmount || appData.requestedAmount || 0,
                appData.processingFee || 0,
                app.trackingNumber || `APP-${app.id}`
              );
              console.log(`[Reminder] Sent unpaid fee reminder to ${user.email} for app ${app.id}`);
            } catch (error) {
              console.error(`[Reminder] Failed to send unpaid fee reminder:`, error);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Reminder Scheduler] Error checking unpaid fees:', error);
  }
}

/**
 * Check for pending disbursement method updates (fee paid but no disbursement setup)
 */
async function checkPendingDisbursements() {
  try {
    console.log('[Reminder Scheduler] Checking for pending disbursement setups...');
    
    const allApplications = await db.getAllLoanApplications();
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    for (const app of allApplications) {
      // Only check fee_paid applications
      if (app.status !== 'fee_paid') continue;
      
      // Check if processing fee is paid
      const payments = await db.getPaymentsByLoanApplicationId(app.id);
      const feePayment = payments.find(p => {
        const payment = p as any;
        return payment.type === 'processing_fee' && p.status === 'succeeded';
      });
      
      if (feePayment) {
        // Check if disbursement is set up
        const disbursement = await db.getDisbursementByLoanApplicationId(app.id);
        
        if (!disbursement || disbursement.status === 'pending') {
          const feePaidAt = new Date(feePayment.createdAt);
          
          // Send reminder if fee paid 12+ hours ago and no disbursement
          if (feePaidAt < twelveHoursAgo) {
            const user = await db.getUserById(app.userId);
            if (user && user.email) {
              const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';
              
              try {
                const appData = app as any;
                await sendPendingDisbursementReminderEmail(
                  user.email,
                  fullName,
                  appData.approvedAmount || appData.requestedAmount || 0,
                  app.trackingNumber || `APP-${app.id}`
                );
                console.log(`[Reminder] Sent pending disbursement reminder to ${user.email} for app ${app.id}`);
              } catch (error) {
                console.error(`[Reminder] Failed to send disbursement reminder:`, error);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Reminder Scheduler] Error checking pending disbursements:', error);
  }
}

/**
 * Check for incomplete document uploads (pending/under_review but missing required docs)
 */
async function checkIncompleteDocuments() {
  try {
    console.log('[Reminder Scheduler] Checking for incomplete document uploads...');
    
    const allApplications = await db.getAllLoanApplications();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const app of allApplications) {
      // Check applications that are pending or under review
      if (app.status !== 'pending' && app.status !== 'under_review') continue;
      
      const createdAt = new Date(app.createdAt);
      
      // Check if user has uploaded required documents
      const documents = await db.getVerificationDocumentsByUserId(app.userId);
      
      // Minimum required: ID and proof of address
      const hasID = documents.some(d => 
        ['drivers_license_front', 'passport', 'national_id_front'].includes(d.documentType)
      );
      const hasProofOfAddress = documents.some(d => 
        ['bank_statement', 'utility_bill'].includes(d.documentType)
      );
      
      if (!hasID || !hasProofOfAddress) {
        // Send reminder if application created 24+ hours ago
        if (createdAt < twentyFourHoursAgo) {
          const user = await db.getUserById(app.userId);
          if (user && user.email) {
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';
            
            const missingDocs = [];
            if (!hasID) missingDocs.push('Government-issued ID');
            if (!hasProofOfAddress) missingDocs.push('Proof of Address');
            
            try {
              await sendIncompleteDocumentsReminderEmail(
                user.email,
                fullName,
                missingDocs,
                app.trackingNumber || `APP-${app.id}`
              );
              console.log(`[Reminder] Sent incomplete documents reminder to ${user.email} for app ${app.id}`);
            } catch (error) {
              console.error(`[Reminder] Failed to send incomplete docs reminder:`, error);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Reminder Scheduler] Error checking incomplete documents:', error);
  }
}

/**
 * Check for inactive users (registered but no application in 7 days)
 */
async function checkInactiveUsers() {
  try {
    console.log('[Reminder Scheduler] Checking for inactive users...');
    
    const database = await db.getDb();
    if (!database) return;
    
    const { users } = await import('../../drizzle/schema');
    const allUsers = await database.select().from(users);
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const user of allUsers) {
      const createdAt = new Date(user.createdAt);
      
      // Skip recently created users
      if (createdAt > sevenDaysAgo) continue;
      
      // Check if user has any loan applications
      const applications = await db.getAllLoanApplications();
      const userApps = applications.filter(app => app.userId === user.id);
      
      if (userApps.length === 0 && createdAt < sevenDaysAgo && createdAt > thirtyDaysAgo) {
        // User registered 7+ days ago but no application yet
        if (user.email) {
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';
          
          try {
            await sendInactiveUserReminderEmail(
              user.email,
              fullName
            );
            console.log(`[Reminder] Sent inactive user reminder to ${user.email}`);
          } catch (error) {
            console.error(`[Reminder] Failed to send inactive user reminder:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Reminder Scheduler] Error checking inactive users:', error);
  }
}

/**
 * Run all reminder checks
 */
async function runAllReminderChecks() {
  console.log('[Reminder Scheduler] Running all reminder checks...');
  
  try {
    await Promise.allSettled([
      checkIncompleteApplications(),
      checkUnpaidFees(),
      checkPendingDisbursements(),
      checkIncompleteDocuments(),
      checkInactiveUsers()
    ]);
    
    console.log('[Reminder Scheduler] All reminder checks completed');
  } catch (error) {
    console.error('[Reminder Scheduler] Error running reminder checks:', error);
  }
}

/**
 * Initialize the reminder scheduler
 * Runs every 6 hours
 */
export function initializeReminderScheduler() {
  console.log('[Reminder Scheduler] Initializing automated reminder scheduler...');
  
  // Run immediately on startup
  runAllReminderChecks();
  
  // Then run every 6 hours (6 * 60 * 60 * 1000 ms)
  reminderInterval = setInterval(runAllReminderChecks, 6 * 60 * 60 * 1000);
  
  console.log('[Reminder Scheduler] Reminder scheduler initialized (runs every 6 hours)');
}

/**
 * Shutdown the reminder scheduler
 */
export function shutdownReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    console.log('[Reminder Scheduler] Reminder scheduler shut down');
  }
}

/**
 * Manually trigger reminder checks (for testing or admin action)
 */
export async function triggerManualReminderCheck() {
  console.log('[Reminder Scheduler] Manual reminder check triggered');
  await runAllReminderChecks();
  return { success: true, message: 'Reminder checks completed' };
}
