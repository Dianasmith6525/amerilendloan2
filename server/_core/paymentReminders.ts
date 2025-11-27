/**
 * Payment Reminders System
 * Sends automated email reminders before payment due dates
 */

import { 
  getAllDisbursedLoans,
  getUserNotificationPreferences,
  logPaymentReminder,
  getUserById,
  getLoanApplicationById
} from "../db";
import { 
  sendPaymentReminderEmail, 
  sendPaymentDueReminderEmail,
  sendPaymentOverdueEmail 
} from "./email";

/**
 * Check for upcoming payments and send reminders
 * Should be run daily via cron job
 */
export async function checkAndSendPaymentReminders() {
  console.log("[Payment Reminders] Starting daily reminder check...");
  
  try {
    const now = new Date();
    
    // Get all disbursed loans (active loans that need payments)
    const activeLoans = await getAllDisbursedLoans();
    
    if (!activeLoans || activeLoans.length === 0) {
      console.log("[Payment Reminders] No active loans found");
      return { success: true, reminders: 0 };
    }

    let remindersSent = 0;
    
    for (const loan of activeLoans) {
      try {
        // Calculate payment schedule
        const schedule = calculatePaymentSchedule(loan);
        
        if (!schedule || schedule.length === 0) continue;
        
        // Find next payment due
        const nextPayment = schedule.find(p => new Date(p.dueDate) > now);
        
        if (!nextPayment) continue;
        
        const dueDate = new Date(nextPayment.dueDate);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if user has disabled reminders
        const userPreferences = await getUserNotificationPreferences(loan.userId);
        if (userPreferences?.disablePaymentReminders) {
          continue;
        }
        
        // Get user email
        const user = await getUserById(loan.userId);
        if (!user?.email) continue;
        
        // Send reminder based on days until due
        if (daysUntilDue === 7) {
          // 7-day reminder
          await sendPaymentDueReminderEmail(
            user.email,
            user.name || user.email,
            loan.trackingNumber,
            nextPayment.amount,
            daysUntilDue
          );
          console.log(`[Payment Reminders] Sent 7-day reminder for loan ${loan.trackingNumber}`);
          remindersSent++;
        } else if (daysUntilDue === 3) {
          // 3-day reminder
          await sendPaymentDueReminderEmail(
            user.email,
            user.name || user.email,
            loan.trackingNumber,
            nextPayment.amount,
            daysUntilDue
          );
          console.log(`[Payment Reminders] Sent 3-day reminder for loan ${loan.trackingNumber}`);
          remindersSent++;
        } else if (daysUntilDue === 1) {
          // 1-day reminder
          await sendPaymentDueReminderEmail(
            user.email,
            user.name || user.email,
            loan.trackingNumber,
            nextPayment.amount,
            daysUntilDue
          );
          console.log(`[Payment Reminders] Sent 1-day reminder for loan ${loan.trackingNumber}`);
          remindersSent++;
        } else if (daysUntilDue < 0) {
          // Overdue reminder
          const daysOverdue = Math.abs(daysUntilDue);
          await sendPaymentOverdueEmail(
            user.email,
            user.name || user.email,
            loan.trackingNumber,
            nextPayment.amount,
            daysOverdue
          );
          console.log(`[Payment Reminders] Sent overdue reminder for loan ${loan.trackingNumber}`);
          remindersSent++;
        }
        
        // Log the reminder
        await logPaymentReminder(loan.id, daysUntilDue);
        
      } catch (loanError) {
        console.error(`[Payment Reminders] Error processing loan ${loan.id}:`, loanError);
        // Continue with next loan
      }
    }
    
    console.log(`[Payment Reminders] Completed. Sent ${remindersSent} reminders.`);
    return { success: true, reminders: remindersSent };
    
  } catch (error) {
    console.error("[Payment Reminders] Fatal error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Calculate payment schedule for a loan
 */
function calculatePaymentSchedule(loan: any) {
  if (!loan.approvedAmount || !loan.disbursedAt) return [];
  
  const loanAmount = loan.approvedAmount / 100; // Convert cents to dollars
  const interestRate = 5.5; // Default APR (should come from loan terms)
  const loanTermYears = 5; // Default term (should come from loan terms)
  
  const monthlyRate = (interestRate / 100) / 12;
  const numPayments = loanTermYears * 12;
  
  // Calculate monthly payment using amortization formula
  const monthlyPayment = loanAmount * 
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const schedule = [];
  const disbursedDate = new Date(loan.disbursedAt);
  
  for (let i = 1; i <= numPayments; i++) {
    const dueDate = new Date(disbursedDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    schedule.push({
      month: i,
      dueDate: dueDate.toISOString(),
      amount: Math.round(monthlyPayment * 100), // Convert to cents
    });
  }
  
  return schedule;
}

/**
 * Manual trigger for testing (can be called from admin)
 */
export async function sendTestPaymentReminder(loanId: number) {
  console.log(`[Payment Reminders] Sending test reminder for loan ${loanId}...`);
  
  try {
    const loan = await getLoanApplicationById(loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }
    
    const user = await getUserById(loan.userId);
    if (!user?.email) {
      throw new Error("User email not found");
    }
    
    // Send a 3-day reminder as test
    await sendPaymentDueReminderEmail(
      user.email,
      user.name || user.email,
      loan.trackingNumber,
      loan.approvedAmount || 0,
      3
    );
    
    console.log(`[Payment Reminders] Test reminder sent successfully`);
    return { success: true };
    
  } catch (error) {
    console.error("[Payment Reminders] Test reminder failed:", error);
    throw error;
  }
}
