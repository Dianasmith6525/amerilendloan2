import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

interface Notification {
  id: string;
  type: "loan_status" | "payment" | "message" | "document" | "alert";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

export function useUserNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

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
    if (loans) {
      loans.forEach((loan) => {
        const loanDate = new Date(loan.updatedAt);
        
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
    if (supportTicketsData?.data) {
      supportTicketsData.data.forEach((ticket: any) => {
        // Check if ticket was recently updated by admin
        const updatedDate = new Date(ticket.updatedAt);
        if (updatedDate > lastCheck && ticket.lastMessageFromAdmin) {
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
    if (paymentsData) {
      paymentsData.forEach((payment: any) => {
        const paymentDate = new Date(payment.createdAt);
        
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

  // Update last check timestamp every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastCheck(new Date());
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
