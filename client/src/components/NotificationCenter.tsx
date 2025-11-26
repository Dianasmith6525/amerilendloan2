import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, Mail, MessageSquare, CheckCircle2, Clock, CreditCard, FileText } from "lucide-react";
import { toast } from "sonner";
import { useUserNotifications } from "@/hooks/useUserNotifications";
import { useLocation } from "wouter";

export default function NotificationCenter() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [, setLocation] = useLocation();

  // Use real notifications from hook
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useUserNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "loan_status":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "payment":
        return <CreditCard className="w-5 h-5 text-blue-600" />;
      case "message":
        return <MessageSquare className="w-5 h-5 text-purple-600" />;
      case "document":
        return <FileText className="w-5 h-5 text-orange-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    switch (notification.type) {
      case "loan_status":
        setLocation("/dashboard#applications");
        break;
      case "payment":
        setLocation("/dashboard#payments");
        break;
      case "message":
        setLocation("/dashboard#messages");
        break;
      case "document":
        setLocation("/dashboard#documents");
        break;
      default:
        setLocation("/dashboard");
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
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead}>
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear all
                </Button>
              )}
            </div>
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
                        {new Date(notification.timestamp).toLocaleString()}
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

      {/* Auto-Pay Reminder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-[#0033A0]">Payment Reminders</CardTitle>
          <CardDescription>Stay on top of your payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 mb-3">
              💡 <strong>Never miss a payment!</strong>
            </p>
            <p className="text-xs text-blue-800 mb-4">
              Enable auto-pay in the Auto-Pay tab to automatically process your loan payments and avoid late fees.
            </p>
            <Button size="sm" variant="outline" className="border-blue-600 text-blue-600" asChild>
              <a href="/dashboard#auto-pay">Set Up Auto-Pay</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
