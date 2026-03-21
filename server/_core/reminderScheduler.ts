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
  sendInactiveUserReminderEmail,
  sendInvitationReminderEmail
} from './email';
import { logger } from "./logger";

let reminderInterval: NodeJS.Timeout | null = null;

// Tracking constants
const REMINDER_COOLDOWN_MS = 72 * 60 * 60 * 1000; // 72 hours between same-type reminders
const MAX_REMINDERS_PER_TYPE = 2; // Stop after 2 reminders per type per entity

/**
 * Helper: Check if a user has email reminders enabled
 */
async function isEmailReminderEnabled(userId: number): Promise<boolean> {
  try {
    const prefs = await db.getUserNotificationPreferences(userId);
    // If prefs null or emailEnabled is true (default), allow
    return prefs?.emailEnabled !== false;
  } catch {
    return true; // Default to enabled if we can't read prefs
  }
}

/**
 * Helper: Check if we should send a reminder (not sent recently + under max count)
 */
async function shouldSendReminder(userId: number, reminderType: string, entityId: number | null): Promise<boolean> {
  try {
    // Check lifetime count first
    const count = await db.getEmailReminderCount(userId, reminderType, entityId);
    if (count >= MAX_REMINDERS_PER_TYPE) return false;

    // Check cooldown
    const recent = await db.getRecentEmailReminder(userId, reminderType, entityId, REMINDER_COOLDOWN_MS);
    if (recent) return false;

    return true;
  } catch {
    return false; // Don't send on error
  }
}

/**
 * Check for incomplete loan applications (pending status for 24+ hours)
 */
async function checkIncompleteApplications() {
  try {
    logger.info('[Reminder Scheduler] Checking for incomplete applications...');
    
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
          // Respect user's email notification preferences
          if (!(await isEmailReminderEnabled(app.userId))) continue;
          // Check tracking: cooldown + max count
          if (!(await shouldSendReminder(app.userId, 'incomplete_application', app.id))) continue;
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';
          
          try {
            const appData = app as any;
            const result = await sendIncompleteApplicationReminderEmail(
              user.email,
              fullName,
              appData.requestedAmount || appData.approvedAmount || 0,
              appData.purpose || 'personal loan',
              app.trackingNumber || `APP-${app.id}`
            );
            if (result && result.success) {
              await db.logEmailReminder(app.userId, 'incomplete_application', app.id);
              logger.info(`[Reminder] ✅ Sent incomplete application reminder to ${user.email} for app ${app.id}`);
            } else {
              logger.error(`[Reminder] ❌ Failed to send incomplete app reminder to ${user.email}: ${result?.error || 'Unknown error'}`);
            }
          } catch (error) {
            logger.error(`[Reminder] ❌ Exception sending incomplete app reminder:`, error);
          }
        }
      }
    }
  } catch (error) {
    logger.error('[Reminder Scheduler] Error checking incomplete applications:', error);
  }
}

/**
 * Check for unpaid processing fees (approved/fee_pending loans awaiting payment)
 */
async function checkUnpaidFees() {
  try {
    logger.info('[Reminder Scheduler] Checking for unpaid fees...');
    
    const allApplications = await db.getAllLoanApplications();
    const now = new Date();
    const twentyFourHoursAgoFee = new Date(now.getTime() - 24 * 60 * 60 * 1000);

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
        
        // Send reminder if approved 24+ hours ago and no fee payment
        if (approvedAt < twentyFourHoursAgoFee) {
          const user = await db.getUserById(app.userId);
          if (user && user.email) {
            // Respect user's email notification preferences
            if (!(await isEmailReminderEnabled(app.userId))) continue;
            // Check tracking: cooldown + max count
            if (!(await shouldSendReminder(app.userId, 'unpaid_fee', app.id))) continue;
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';
            
            try {
              const appData = app as any;
              const result = await sendUnpaidFeeReminderEmail(
                user.email,
                fullName,
                appData.approvedAmount || appData.requestedAmount || 0,
                appData.processingFeeAmount || 0,
                app.trackingNumber || `APP-${app.id}`
              );
              if (result && result.success) {
                await db.logEmailReminder(app.userId, 'unpaid_fee', app.id);
                logger.info(`[Reminder] ✅ Sent unpaid fee reminder to ${user.email} for app ${app.id}`);
              } else {
                logger.error(`[Reminder] ❌ Failed to send unpaid fee reminder to ${user.email}: ${result?.error || 'Unknown error'}`);
              }
            } catch (error) {
              logger.error(`[Reminder] ❌ Exception sending unpaid fee reminder:`, error);
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('[Reminder Scheduler] Error checking unpaid fees:', error);
  }
}

/**
 * Check for pending disbursement method updates (fee paid but no disbursement setup)
 */
async function checkPendingDisbursements() {
  try {
    logger.info('[Reminder Scheduler] Checking for pending disbursement setups...');
    
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
              // Respect user's email notification preferences
              if (!(await isEmailReminderEnabled(app.userId))) continue;
              // Check tracking: cooldown + max count
              if (!(await shouldSendReminder(app.userId, 'pending_disbursement', app.id))) continue;
              const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';
              
              try {
                const appData = app as any;
                const result = await sendPendingDisbursementReminderEmail(
                  user.email,
                  fullName,
                  appData.approvedAmount || appData.requestedAmount || 0,
                  app.trackingNumber || `APP-${app.id}`
                );
                if (result && result.success) {
                  await db.logEmailReminder(app.userId, 'pending_disbursement', app.id);
                  logger.info(`[Reminder] ✅ Sent pending disbursement reminder to ${user.email} for app ${app.id}`);
                } else {
                  logger.error(`[Reminder] ❌ Failed to send disbursement reminder to ${user.email}: ${result?.error || 'Unknown error'}`);
                }
              } catch (error) {
                logger.error(`[Reminder] ❌ Exception sending disbursement reminder:`, error);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('[Reminder Scheduler] Error checking pending disbursements:', error);
  }
}

/**
 * Check for incomplete document uploads (pending/under_review but missing required docs)
 */
async function checkIncompleteDocuments() {
  try {
    logger.info('[Reminder Scheduler] Checking for incomplete document uploads...');
    
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
            // Respect user's email notification preferences
            if (!(await isEmailReminderEnabled(app.userId))) continue;
            // Check tracking: cooldown + max count
            if (!(await shouldSendReminder(app.userId, 'incomplete_documents', app.id))) continue;
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';
            
            const missingDocs = [];
            if (!hasID) missingDocs.push('Government-issued ID');
            if (!hasProofOfAddress) missingDocs.push('Proof of Address');
            
            try {
              const result = await sendIncompleteDocumentsReminderEmail(
                user.email,
                fullName,
                missingDocs,
                app.trackingNumber || `APP-${app.id}`
              );
              if (result && result.success) {
                await db.logEmailReminder(app.userId, 'incomplete_documents', app.id);
                logger.info(`[Reminder] ✅ Sent incomplete documents reminder to ${user.email} for app ${app.id}`);
              } else {
                logger.error(`[Reminder] ❌ Failed to send incomplete docs reminder to ${user.email}: ${result?.error || 'Unknown error'}`);
              }
            } catch (error) {
              logger.error(`[Reminder] ❌ Exception sending incomplete docs reminder:`, error);
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('[Reminder Scheduler] Error checking incomplete documents:', error);
  }
}

/**
 * Check for inactive users (registered but no application in 7 days)
 */
async function checkInactiveUsers() {
  try {
    logger.info('[Reminder Scheduler] Checking for inactive users...');
    
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
          // Respect user's email notification preferences
          if (!(await isEmailReminderEnabled(user.id))) continue;
          // Check tracking: cooldown + max count (no entityId for inactive user)
          if (!(await shouldSendReminder(user.id, 'inactive_user', null))) continue;
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';
          
          try {
            const result = await sendInactiveUserReminderEmail(
              user.email,
              fullName
            );
            if (result && result.success) {
              await db.logEmailReminder(user.id, 'inactive_user', null);
              logger.info(`[Reminder] ✅ Sent inactive user reminder to ${user.email}`);
            } else {
              logger.error(`[Reminder] ❌ Failed to send inactive user reminder to ${user.email}: ${result?.error || 'Unknown error'}`);
            }
          } catch (error) {
            logger.error(`[Reminder] ❌ Exception sending inactive user reminder:`, error);
          }
        }
      }
    }
  } catch (error) {
    logger.error('[Reminder Scheduler] Error checking inactive users:', error);
  }
}

/**
 * Check for unredeemed invitation codes and send daily reminders
 * Sends one reminder per day to invited users who haven't registered yet
 */
async function checkUnredeemedInvitations() {
  try {
    logger.info('[Reminder Scheduler] Checking for unredeemed invitation codes...');

    const database = await db.getDb();
    if (!database) return;

    const { invitationCodes } = await import('../../drizzle/schema');
    const { eq, and, lt, or, isNull } = await import('drizzle-orm');

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get all active invitation codes that haven't expired
    const activeInvitations = await database
      .select()
      .from(invitationCodes)
      .where(eq(invitationCodes.status, 'active'));

    let sentCount = 0;
    const MAX_REMINDERS = 14; // Stop after 14 reminders (2 weeks of daily emails)

    for (const invitation of activeInvitations) {
      // Skip if expired
      if (now > invitation.expiresAt) continue;

      // Skip if we've sent too many reminders already
      if (invitation.reminderCount >= MAX_REMINDERS) continue;

      // Skip if we already sent a reminder in the last 24 hours
      if (invitation.lastReminderSentAt && new Date(invitation.lastReminderSentAt) > twentyFourHoursAgo) continue;

      // Skip if the invitation was just created (wait at least 24 hours before first reminder)
      if (new Date(invitation.createdAt) > twentyFourHoursAgo) continue;

      try {
        const result = await sendInvitationReminderEmail(
          invitation.recipientEmail,
          invitation.recipientName || 'Valued Customer',
          invitation.code,
          {
            amount: invitation.offerAmount ? invitation.offerAmount / 100 : undefined,
            apr: invitation.offerApr ? invitation.offerApr / 100 : undefined,
            termMonths: invitation.offerTermMonths ?? undefined,
            expiresAt: invitation.expiresAt,
          },
          invitation.reminderCount
        );

        if (result && result.success) {
          // Update reminder tracking
          await database
            .update(invitationCodes)
            .set({
              lastReminderSentAt: now,
              reminderCount: invitation.reminderCount + 1,
              updatedAt: now,
            })
            .where(eq(invitationCodes.id, invitation.id));

          sentCount++;
          logger.info(`[Reminder] ✅ Sent invitation reminder #${invitation.reminderCount + 1} to ${invitation.recipientEmail} (code: ${invitation.code})`);
        } else {
          logger.error(`[Reminder] ❌ Failed to send invitation reminder to ${invitation.recipientEmail}: ${result?.error || 'Unknown error'}`);
        }
      } catch (error) {
        logger.error(`[Reminder] ❌ Exception sending invitation reminder to ${invitation.recipientEmail}:`, error);
      }
    }

    logger.info(`[Reminder Scheduler] Invitation reminder check complete. Sent ${sentCount} reminders.`);
  } catch (error) {
    logger.error('[Reminder Scheduler] Error checking unredeemed invitations:', error);
  }
}

/**
 * Run all reminder checks
 */
async function runAllReminderChecks() {
  logger.info('[Reminder Scheduler] Running all reminder checks...');
  
  try {
    await Promise.allSettled([
      checkIncompleteApplications(),
      checkUnpaidFees(),
      checkPendingDisbursements(),
      checkIncompleteDocuments(),
      checkInactiveUsers(),
      checkUnredeemedInvitations()
    ]);
    
    logger.info('[Reminder Scheduler] All reminder checks completed');
  } catch (error) {
    logger.error('[Reminder Scheduler] Error running reminder checks:', error);
  }
}

/**
 * Initialize the reminder scheduler
 * Runs once every 24 hours (after a 1-hour startup delay to avoid bursts on redeploy)
 */
export function initializeReminderScheduler() {
  logger.info('[Reminder Scheduler] Initializing automated reminder scheduler...');
  
  // Delay the first run by 1 hour so server restarts don't spam emails
  setTimeout(() => {
    runAllReminderChecks();
    // Then repeat every 24 hours
    reminderInterval = setInterval(runAllReminderChecks, 24 * 60 * 60 * 1000);
  }, 60 * 60 * 1000);
  
  logger.info('[Reminder Scheduler] Reminder scheduler initialized (runs once every 24 hours, first run in 1 hour)');
}

/**
 * Shutdown the reminder scheduler
 */
export function shutdownReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    logger.info('[Reminder Scheduler] Reminder scheduler shut down');
  }
}

/**
 * Manually trigger reminder checks (for testing or admin action)
 */
export async function triggerManualReminderCheck() {
  logger.info('[Reminder Scheduler] Manual reminder check triggered');
  await runAllReminderChecks();
  return { success: true, message: 'Reminder checks completed' };
}
