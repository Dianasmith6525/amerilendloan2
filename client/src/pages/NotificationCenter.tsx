import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, CheckCircle, AlertCircle, Info, Trash2, Archive } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { useState } from "react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export function NotificationCenter() {
  const [filter, setFilter] = useState<"all" | "unread">("all");

  // Fetch real notifications from backend
  const { data: notificationsData = [], isLoading } = trpc.userFeatures.notifications.list.useQuery({ 
    limit: 50 
  });

  // Map database fields to component interface
  const allNotifications = notificationsData.map((n: any) => ({
    id: String(n.id),
    title: n.title,
    message: n.message,
    type: mapNotificationType(n.type),
    read: n.isRead,
    createdAt: n.createdAt,
    actionUrl: n.actionUrl,
  }));

  const notifications = filter === "unread" 
    ? allNotifications.filter(n => !n.read)
    : allNotifications;

  const unreadCount = allNotifications.filter(n => !n.read).length;

  // Map backend notification types to UI types
  function mapNotificationType(dbType: string): "info" | "warning" | "error" | "success" {
    switch (dbType) {
      case "payment_confirmation":
      case "approval_notice":
        return "success";
      case "payment_failure":
      case "denial_notice":
      case "delinquency_notice":
        return "error";
      case "payment_due":
      case "payment_reminder":
      case "document_request":
        return "warning";
      default:
        return "info";
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "info":
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "success":
        return "default";
      case "error":
        return "destructive";
      case "warning":
        return "secondary";
      case "info":
      default:
        return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">Notifications</h1>
          </div>
          <p className="text-slate-400">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>

        {/* Notifications Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle>All Notifications</CardTitle>
            <CardDescription>Manage your notifications and stay updated</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full" onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="all">All Notifications</TabsTrigger>
                <TabsTrigger value="unread">
                  Unread {unreadCount > 0 && `(${unreadCount})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-3">
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading notifications...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
                    <p className="text-slate-400">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-lg border transition-all ${
                        notification.read
                          ? "bg-slate-700/50 border-slate-600 opacity-75"
                          : "bg-slate-700 border-slate-600 shadow-lg"
                      } hover:bg-slate-700 hover:border-slate-500`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-1">{getIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-white font-semibold">{notification.title}</h3>
                            <Badge variant={getTypeBadgeVariant(notification.type) as any}>
                              {notification.type}
                            </Badge>
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-blue-500 ml-auto"></div>
                            )}
                          </div>
                          <p className="text-slate-300 text-sm mb-3">{notification.message}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>{formatDate(notification.createdAt)}</span>
                            {notification.actionUrl && (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto text-blue-400 hover:text-blue-300"
                                onClick={() => window.location.href = notification.actionUrl!}
                              >
                                View Details →
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-slate-300"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="unread" className="space-y-3">
                {filter === "unread" && notifications.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <p className="text-slate-400">No unread notifications</p>
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card className="bg-slate-800 border-slate-700 mt-6">
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>Customize how you receive notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <div>
                  <p className="font-medium text-white">Email Notifications</p>
                  <p className="text-sm text-slate-400">Receive updates via email</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <div>
                  <p className="font-medium text-white">SMS Notifications</p>
                  <p className="text-sm text-slate-400">Receive critical alerts via SMS</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <div>
                  <p className="font-medium text-white">In-App Notifications</p>
                  <p className="text-sm text-slate-400">Show notifications in your dashboard</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5" />
              </div>
              <Button className="w-full mt-4">Save Preferences</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default NotificationCenter;
