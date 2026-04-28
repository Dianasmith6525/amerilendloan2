import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

export interface Notification {
  id: string;
  type: "loan_status" | "payment" | "message" | "document" | "alert";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, unknown>;
}

export function useUserNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const stored = localStorage.getItem('userNotifications');
      if (stored) {
        const parsed = JSON.parse(stored) as Notification[];
        return parsed.map(n => ({ ...n, timestamp: new Date(n.timestamp) }));
      }
    } catch { /* ignore invalid data */ }
    return [];
  });
  
  // Initialize lastCheck from localStorage or use current time for first visit
  const [lastCheck, setLastCheck] = useState<Date>(() => {
    const stored = localStorage.getItem('notificationsLastCheck');
    return stored ? new Date(stored) : new Date();
  });

  // Fetch real data from tRPC queries
  const { data: loans } = trpc.loans.myApplications.useQuery(undefined, {
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: supportTicketsData } = trpc.supportTickets.getUserTickets.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: paymentsData } = trpc.payments.getHistory.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Generate notifications from real data
  useEffect(() => {
    const newNotifications: Notification[] = [];

    // Check for loan status changes
    if (Array.isArray(loans)) {
      loans.forEach((loan) => {
        if (!loan.updatedAt) return; // Skip if no updatedAt
        const loanDate = new Date(loan.updatedAt);
        if (isNaN(loanDate.getTime())) return; // Skip invalid dates
        
        // Loan approved
        if (loan.status === "approved" && loanDate > lastCheck) {
          newNotifications.push({
            id: `loan-approved-${loan.id}`,
            type: "loan_status",
            title: "Loan Approved! 🎉",
            message: `Your ${loan.loanType} loan application for $${(loan.approvedAmount || 0) / 100} has been approved. Pay the processing fee to continue.`,
            timestamp: loanDate,
            read: false,
            data: { loanId: loan.id },
          });
        }

        // Loan disbursed
        if (loan.status === "disbursed" && loanDate > lastCheck) {
          newNotifications.push({
            id: `loan-disbursed-${loan.id}`,
            type: "loan_status",
            title: "Funds Disbursed! 💰",
            message: `Your loan of $${(loan.approvedAmount || 0) / 100} has been disbursed. Check your bank account.`,
            timestamp: loanDate,
            read: false,
            data: { loanId: loan.id },
          });
        }

        // Loan rejected
        if (loan.status === "rejected" && loanDate > lastCheck) {
          newNotifications.push({
            id: `loan-rejected-${loan.id}`,
            type: "loan_status",
            title: "Application Update",
            message: `Your loan application has been reviewed. Please contact support for details.`,
            timestamp: loanDate,
            read: false,
            data: { loanId: loan.id },
          });
        }

        // Fee payment required
        if (loan.status === "approved" && loan.processingFeeAmount && !loan.feePaymentVerified) {
          const isNew = loanDate > new Date(Date.now() - 24 * 60 * 60 * 1000); // Within 24 hours
          if (isNew) {
            newNotifications.push({
              id: `fee-required-${loan.id}`,
              type: "payment",
              title: "Payment Required",
              message: `Processing fee of $${loan.processingFeeAmount / 100} is required for loan #${loan.trackingNumber}.`,
              timestamp: loanDate,
              read: false,
              data: { loanId: loan.id },
            });
          }
        }
      });
    }

    // Check for new support ticket messages
    if (Array.isArray(supportTicketsData?.data)) {
      supportTicketsData.data.forEach((ticket) => {
        if (!ticket.updatedAt) return; // Skip if no updatedAt
        // Check if ticket was recently updated by admin
        const updatedDate = new Date(ticket.updatedAt);
        if (isNaN(updatedDate.getTime())) return; // Skip invalid dates
        if (updatedDate > lastCheck && (ticket as Record<string, unknown>).lastMessageFromAdmin) {
          newNotifications.push({
            id: `ticket-reply-${ticket.id}`,
            type: "message",
            title: "New Support Message",
            message: `Support team replied to your ticket: "${ticket.subject}"`,
            timestamp: updatedDate,
            read: false,
            data: { ticketId: ticket.id },
          });
        }

        // Ticket resolved
        if (ticket.status === "resolved" && updatedDate > lastCheck) {
          newNotifications.push({
            id: `ticket-resolved-${ticket.id}`,
            type: "message",
            title: "Ticket Resolved",
            message: `Your support ticket "${ticket.subject}" has been resolved.`,
            timestamp: updatedDate,
            read: false,
            data: { ticketId: ticket.id },
          });
        }
      });
    }

    // Check for payment confirmations
    if (Array.isArray(paymentsData)) {
      paymentsData.forEach((payment) => {
        if (!payment.createdAt) return; // Skip if no createdAt
        const paymentDate = new Date(payment.createdAt);
        if (isNaN(paymentDate.getTime())) return; // Skip invalid dates
        
        if (payment.status === "succeeded" && paymentDate > lastCheck) {
          newNotifications.push({
            id: `payment-success-${payment.id}`,
            type: "payment",
            title: "Payment Confirmed ✓",
            message: `Your payment of $${payment.amount / 100} has been processed successfully.`,
            timestamp: paymentDate,
            read: false,
            data: { paymentId: payment.id },
          });
        }

        if (payment.status === "failed" && paymentDate > lastCheck) {
          newNotifications.push({
            id: `payment-failed-${payment.id}`,
            type: "payment",
            title: "Payment Failed",
            message: `Your payment of $${payment.amount / 100} could not be processed. Please try again.`,
            timestamp: paymentDate,
            read: false,
            data: { paymentId: payment.id },
          });
        }
      });
    }

    // Merge with existing notifications (preserving read status)
    setNotifications((prev) => {
      const existingIds = new Set(prev.map(n => n.id));
      const merged = [...prev];
      
      newNotifications.forEach(newNotif => {
        if (!existingIds.has(newNotif.id)) {
          merged.unshift(newNotif);
        }
      });

      // Sort by timestamp (newest first) and limit to 50
      return merged
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);
    });

  }, [loans, supportTicketsData, paymentsData, lastCheck]);

  // Persist notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('userNotifications', JSON.stringify(notifications));
    } catch { /* ignore quota errors */ }
  }, [notifications]);

  // Update last check timestamp every 30 seconds and persist to localStorage
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setLastCheck(now);
      localStorage.setItem('notificationsLastCheck', now.toISOString());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
