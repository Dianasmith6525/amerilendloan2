import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

export interface Notification {
  id: number;
  type: "application" | "payment" | "ticket" | "document" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll for new notifications every 30 seconds
  const { data: stats } = trpc.loans.adminStatistics.useQuery(undefined, {
    refetchInterval: 30000, // 30 seconds
  });

  const { data: tickets } = trpc.supportTickets.adminGetAll.useQuery(
    { status: "open" },
    { refetchInterval: 30000 }
  );

  const { data: applications } = trpc.loans.adminList.useQuery(undefined, {
    refetchInterval: 30000,
  });

  useEffect(() => {
    const newNotifications: Notification[] = [];
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Check for new pending applications
    if (applications) {
      const recentPending = applications.filter(
        app =>
          app.status === "pending" &&
          new Date(app.createdAt) > fiveMinutesAgo
      );

      recentPending.forEach(app => {
        newNotifications.push({
          id: app.id,
          type: "application",
          title: "New Loan Application",
          message: `${app.fullName} applied for $${(
            app.requestedAmount / 100
          ).toFixed(2)}`,
          read: false,
          createdAt: new Date(app.createdAt),
          actionUrl: `/admin`,
        });
      });
    }

    // Check for new support tickets
    if (tickets?.data) {
      const recentTickets = tickets.data.filter(
        ticket => new Date(ticket.createdAt) > fiveMinutesAgo
      );

      recentTickets.forEach(ticket => {
        newNotifications.push({
          id: ticket.id + 10000, // Offset to avoid ID conflicts
          type: "ticket",
          title: "New Support Ticket",
          message: `#${ticket.id}: ${ticket.subject}`,
          read: false,
          createdAt: new Date(ticket.createdAt),
          actionUrl: `/admin`,
        });
      });
    }

    // Check for pending fee verifications
    if (applications) {
      const feePending = applications.filter(
        app =>
          app.status === "fee_pending" &&
          !app.feePaymentVerified
      );

      if (feePending.length > 0) {
        newNotifications.push({
          id: 99999,
          type: "payment",
          title: "Fee Payments Pending",
          message: `${feePending.length} applications waiting for fee verification`,
          read: false,
          createdAt: now,
          actionUrl: `/admin`,
        });
      }
    }

    // Check for missing documents (placeholder - needs backend support)
    // Note: Document tracking not yet available in API
    const missingDocs: any[] = [];

    if (missingDocs.length > 0) {
      newNotifications.push({
        id: 99998,
        type: "document",
        title: "Documents Missing",
        message: `${missingDocs.length} applications missing documents`,
        read: false,
        createdAt: now,
        actionUrl: `/admin`,
      });
    }

    setNotifications(newNotifications);
    setUnreadCount(newNotifications.filter(n => !n.read).length);
  }, [applications, tickets, stats]);

  const markAsRead = (id: number) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
