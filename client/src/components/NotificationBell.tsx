import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, FileText, MessageSquare, CreditCard, Upload, AlertCircle, X } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const getIcon = (type: string) => {
    switch (type) {
      case "application":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "ticket":
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case "payment":
        return <CreditCard className="h-4 w-4 text-green-500" />;
      case "document":
        return <Upload className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 max-h-[80vh] z-50">
          <Card className="shadow-2xl border-2">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
              <div>
                <h3 className="font-bold text-lg">Notifications</h3>
                <p className="text-xs text-gray-600">
                  {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex space-x-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs"
                  >
                    Mark all read
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearAll}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No new notifications</p>
                  <p className="text-xs text-gray-400 mt-1">
                    You're all caught up!
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.read ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="mt-1">{getIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm truncate">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <Badge className="bg-blue-500 text-white text-xs ml-2">
                                New
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t bg-gray-50 text-center">
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs text-blue-600"
                  onClick={() => {
                    setLocation("/admin");
                    setOpen(false);
                  }}
                >
                  View All Activity
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
