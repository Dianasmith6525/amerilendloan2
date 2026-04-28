import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
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

const READ_IDS_KEY = "adminNotificationsReadIds";
const CLEARED_IDS_KEY = "adminNotificationsClearedIds";

function loadIdSet(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch { /* ignore */ }
  return new Set<number>();
}

function saveIdSet(key: string, set: Set<number>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch { /* ignore */ }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readIds, setReadIds] = useState<Set<number>>(() => loadIdSet(READ_IDS_KEY));
  const [clearedIds, setClearedIds] = useState<Set<number>>(() => loadIdSet(CLEARED_IDS_KEY));

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
          message: `${app.fullName} applied for ${formatCurrency(app.requestedAmount)}`,
          read: false,
          createdAt: new Date(app.createdAt),
          actionUrl: `/admin/application/${app.id}`,
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
          actionUrl: `/admin?view=support`,
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
          actionUrl: `/admin?view=payments`,
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
        actionUrl: `/admin?view=verification`,
      });
    }

    // Filter out cleared and apply persisted read state
    const filtered = newNotifications
      .filter(n => !clearedIds.has(n.id))
      .map(n => (readIds.has(n.id) ? { ...n, read: true } : n));

    setNotifications(filtered);
    setUnreadCount(filtered.filter(n => !n.read).length);
  }, [applications, tickets, stats, readIds, clearedIds]);

  const markAsRead = (id: number) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveIdSet(READ_IDS_KEY, next);
      return next;
    });
  };

  const markAllAsRead = () => {
    setReadIds(prev => {
      const next = new Set(prev);
      notifications.forEach(n => next.add(n.id));
      saveIdSet(READ_IDS_KEY, next);
      return next;
    });
  };

  const clearAll = () => {
    setClearedIds(prev => {
      const next = new Set(prev);
      notifications.forEach(n => next.add(n.id));
      saveIdSet(CLEARED_IDS_KEY, next);
      return next;
    });
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
