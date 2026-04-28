import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Bell, BellOff, CheckCircle, XCircle, AlertCircle, Smartphone } from "lucide-react";
import {
  isPushNotificationSupported,
  getNotificationPermissionState,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getCurrentSubscription,
  sendTestNotification,
  registerServiceWorker,
} from "@/lib/notifications";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// VAPID public key (should be in environment variables)
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

export default function NotificationSettings() {
  const [isSupported, setIsSupported] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user preferences from user_notification_settings table
  const { data: rawPreferences, refetch } = trpc.notifications.getPreferences.useQuery();
  const preferences = rawPreferences?.data;

  // Update preferences mutation
  const updatePreferencesMutation = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Your notification preferences have been saved.");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Subscribe mutation
  const subscribeMutation = trpc.pushNotifications.subscribe.useMutation({
    onSuccess: () => {
      toast.success("You will now receive push notifications.");
      setIsSubscribed(true);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Subscription failed");
    },
  });

  // Unsubscribe mutation
  const unsubscribeMutation = trpc.pushNotifications.unsubscribe.useMutation({
    onSuccess: () => {
      toast.success("You will no longer receive push notifications.");
      setIsSubscribed(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to unsubscribe");
    },
  });

  // Check notification support and permission on mount
  useEffect(() => {
    checkNotificationState();
    
    // Register service worker
    if (isPushNotificationSupported()) {
      registerServiceWorker().catch(console.error);
    }
  }, []);

  const checkNotificationState = async () => {
    setIsLoading(true);
    try {
      const state = await getNotificationPermissionState();
      setIsSupported(state.supported);
      setPermissionState(state.permission);
      setIsSubscribed(state.subscribed);
    } catch (error) {
      console.error("Error checking notification state:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      setIsLoading(true);

      // Subscribe to push notifications
      const subscription = await subscribeToPushNotifications(VAPID_PUBLIC_KEY);

      // Send subscription to server
      const subscriptionJSON = subscription.toJSON();
      await subscribeMutation.mutateAsync({
        endpoint: subscriptionJSON.endpoint!,
        p256dh: subscriptionJSON.keys!.p256dh,
        auth: subscriptionJSON.keys!.auth,
      });

      await checkNotificationState();
    } catch (error: any) {
      toast.error(error.message || "Failed to enable notifications");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    try {
      setIsLoading(true);

      // Unsubscribe from push notifications
      await unsubscribeFromPushNotifications();

      // Remove subscription from server
      const currentSub = await getCurrentSubscription();
      if (currentSub) {
        await unsubscribeMutation.mutateAsync({ endpoint: currentSub.endpoint });
      }

      await checkNotificationState();
    } catch (error: any) {
      toast.error(error.message || "Failed to disable notifications");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await sendTestNotification(
        "Test Notification",
        "This is a test notification from AmeriLend"
      );
      toast.success("Check your notifications!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handlePreferenceChange = (key: string, value: boolean) => {
    updatePreferencesMutation.mutate({
      [key]: value,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Notification Settings</h1>
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Notification Settings</h1>
          <p className="text-muted-foreground">
            Manage how you receive notifications from AmeriLend
          </p>
        </div>

        {/* Browser Support Warning */}
        {!isSupported && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Push Notifications Not Supported</AlertTitle>
            <AlertDescription>
              Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Edge.
            </AlertDescription>
          </Alert>
        )}

        {/* Push Notification Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Push Notifications
            </CardTitle>
            <CardDescription>
              Receive real-time notifications on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  {isSubscribed ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <Badge variant="default">Enabled</Badge>
                    </>
                  ) : permissionState === "denied" ? (
                    <>
                      <XCircle className="h-4 w-4 text-red-600" />
                      <Badge variant="destructive">Blocked</Badge>
                    </>
                  ) : (
                    <>
                      <BellOff className="h-4 w-4 text-yellow-600" />
                      <Badge variant="secondary">Disabled</Badge>
                    </>
                  )}
                </div>
              </div>

              {isSupported && (
                <div className="flex gap-2">
                  {!isSubscribed ? (
                    <Button
                      onClick={handleEnableNotifications}
                      disabled={permissionState === "denied"}
                    >
                      <Bell className="h-4 w-4 mr-2" />
                      Enable Notifications
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleTestNotification}
                      >
                        Test
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDisableNotifications}
                      >
                        Disable
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {permissionState === "denied" && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Notifications Blocked</AlertTitle>
                <AlertDescription>
                  You have blocked notifications for this site. To enable them, please update your browser settings.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>
              Choose which notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="payment-due">Payment Due Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified before your payment is due
                </p>
              </div>
              <Switch
                id="payment-due"
                checked={preferences?.paymentReminders ?? true}
                onCheckedChange={(checked) => handlePreferenceChange("paymentReminders", checked)}
                disabled={!isSubscribed || updatePreferencesMutation.isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="payment-received">Payment Confirmations</Label>
                <p className="text-sm text-muted-foreground">
                  Receive confirmation when payments are processed
                </p>
              </div>
              <Switch
                id="payment-received"
                checked={preferences?.paymentConfirmations ?? true}
                onCheckedChange={(checked) => handlePreferenceChange("paymentConfirmations", checked)}
                disabled={!isSubscribed || updatePreferencesMutation.isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="loan-updates">Loan Status Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when your loan status changes
                </p>
              </div>
              <Switch
                id="loan-updates"
                checked={preferences?.loanStatusUpdates ?? true}
                onCheckedChange={(checked) => handlePreferenceChange("loanStatusUpdates", checked)}
                disabled={!isSubscribed || updatePreferencesMutation.isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="document-ready">Document Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Alerts when new documents are available
                </p>
              </div>
              <Switch
                id="document-ready"
                checked={preferences?.documentNotifications ?? true}
                onCheckedChange={(checked) => handlePreferenceChange("documentNotifications", checked)}
                disabled={!isSubscribed || updatePreferencesMutation.isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="promotional">Promotional Offers</Label>
                <p className="text-sm text-muted-foreground">
                  Receive updates about special offers and promotions
                </p>
              </div>
              <Switch
                id="promotional"
                checked={preferences?.promotionalNotifications ?? false}
                onCheckedChange={(checked) => handlePreferenceChange("promotionalNotifications", checked)}
                disabled={!isSubscribed || updatePreferencesMutation.isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="security-alerts">Security Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Important security notifications (always enabled)
                </p>
              </div>
              <Switch
                id="security-alerts"
                checked={true}
                disabled={true}
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>
              Email notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-enabled">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
              <Switch
                id="email-enabled"
                checked={preferences?.emailEnabled ?? true}
                onCheckedChange={(checked) => handlePreferenceChange("emailEnabled", checked)}
                disabled={updatePreferencesMutation.isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-digest">Daily Digest</Label>
                <p className="text-sm text-muted-foreground">
                  Receive a daily summary of notifications
                </p>
              </div>
              <Switch
                id="email-digest"
                checked={preferences?.emailDigest ?? false}
                onCheckedChange={(checked) => handlePreferenceChange("emailDigest", checked)}
                disabled={!preferences?.emailEnabled || updatePreferencesMutation.isPending}
              />
            </div>
          </CardContent>
        </Card>

        {/* SMS Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>SMS Notifications</CardTitle>
            <CardDescription>
              Text message notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sms-enabled">SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive critical alerts via SMS
                </p>
              </div>
              <Switch
                id="sms-enabled"
                checked={preferences?.smsEnabled ?? false}
                onCheckedChange={(checked) => handlePreferenceChange("smsEnabled", checked)}
                disabled={updatePreferencesMutation.isPending}
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Standard SMS rates may apply. Only critical payment and security alerts will be sent via SMS.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
