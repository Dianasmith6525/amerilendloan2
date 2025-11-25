import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, Mail, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

interface Notification {
  id: number;
  type: "payment_due" | "payment_confirmed" | "status_change" | "document_required" | "general";
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  loanId?: number;
}

export default function NotificationCenter() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);

  // Mock notifications - in production, fetch from backend
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      type: "payment_due",
      title: "Payment Due Soon",
      message: "Your loan payment of $250.00 is due in 5 days",
      read: false,
      createdAt: new Date(),
      loanId: 1,
    },
    {
      id: 2,
      type: "status_change",
      title: "Application Approved",
      message: "Great news! Your loan application has been approved",
      read: false,
      createdAt: new Date(Date.now() - 86400000),
      loanId: 2,
    },
    {
      id: 3,
      type: "document_required",
      title: "Document Upload Required",
      message: "Please upload your bank statement to complete verification",
      read: true,
      createdAt: new Date(Date.now() - 172800000),
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "payment_due":
        return <Clock className="w-5 h-5 text-orange-600" />;
      case "payment_confirmed":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "status_change":
        return <Bell className="w-5 h-5 text-blue-600" />;
      case "document_required":
        return <Mail className="w-5 h-5 text-purple-600" />;
      default:
        return <MessageSquare className="w-5 h-5 text-gray-600" />;
    }
  };

  const markAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    // Navigate to relevant page based on notification type
    if (notification.loanId) {
      // Could navigate to loan details
      console.log("Navigate to loan:", notification.loanId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-[#0033A0] flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose how you'd like to receive updates about your loans
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-blue-600" />
              <div>
                <Label htmlFor="email-notifications" className="font-medium cursor-pointer">
                  Email Notifications
                </Label>
                <p className="text-sm text-gray-500">Receive updates via email</p>
              </div>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={(checked) => {
                setEmailNotifications(checked);
                toast.success(`Email notifications ${checked ? "enabled" : "disabled"}`);
              }}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-green-600" />
              <div>
                <Label htmlFor="sms-notifications" className="font-medium cursor-pointer">
                  SMS Notifications
                </Label>
                <p className="text-sm text-gray-500">Get text message alerts</p>
              </div>
            </div>
            <Switch
              id="sms-notifications"
              checked={smsNotifications}
              onCheckedChange={(checked) => {
                setSmsNotifications(checked);
                toast.success(`SMS notifications ${checked ? "enabled" : "disabled"}`);
              }}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-purple-600" />
              <div>
                <Label htmlFor="push-notifications" className="font-medium cursor-pointer">
                  Push Notifications
                </Label>
                <p className="text-sm text-gray-500">Browser push notifications</p>
              </div>
            </div>
            <Switch
              id="push-notifications"
              checked={pushNotifications}
              onCheckedChange={(checked) => {
                setPushNotifications(checked);
                toast.success(`Push notifications ${checked ? "enabled" : "disabled"}`);
              }}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> Important security and legal notifications will always be sent
              via email, regardless of your preferences.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Notifications Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-[#0033A0]">Recent Notifications</CardTitle>
              <CardDescription>
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "You're all caught up!"}
              </CardDescription>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                Mark all as read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left p-4 rounded-lg border transition-all hover:shadow-md ${
                    notification.read
                      ? "bg-white border-gray-200"
                      : "bg-blue-50 border-blue-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4
                          className={`font-semibold text-sm ${
                            notification.read ? "text-gray-700" : "text-blue-900"
                          }`}
                        >
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <p
                        className={`text-sm mb-2 ${
                          notification.read ? "text-gray-600" : "text-blue-800"
                        }`}
                      >
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BellOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No notifications yet</p>
              <p className="text-sm text-gray-500 mt-1">
                We'll notify you about important updates
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-[#0033A0]">Upcoming Payment Reminders</CardTitle>
          <CardDescription>Never miss a payment date</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="font-medium text-sm text-gray-900">Next Payment Due</p>
                  <p className="text-xs text-gray-600">December 1, 2025 - $250.00</p>
                </div>
              </div>
              <Button size="sm" variant="outline">
                Pay Now
              </Button>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                💡 <strong>Tip:</strong> Enable auto-pay to never miss a payment and avoid late fees!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
