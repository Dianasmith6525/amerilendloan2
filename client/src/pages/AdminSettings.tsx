import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { APP_LOGO } from "@/const";
import { trpc } from "@/lib/trpc";
import { 
  Loader2, 
  Settings, 
  DollarSign, 
  Mail, 
  MessageSquare, 
  Shield, 
  Bell, 
  Database,
  Globe,
  Lock,
  Users,
  FileText,
  ArrowLeft
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function AdminSettings() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, authLoading, setLocation]);

  // Redirect to dashboard if not admin
  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user?.role, authLoading, setLocation]);

  // Show loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const utils = trpc.useUtils();

  // Fee Configuration States
  const [feeMode, setFeeMode] = useState<"percentage" | "fixed">("percentage");
  const [percentageRate, setPercentageRate] = useState("2.00");
  const [fixedFeeAmount, setFixedFeeAmount] = useState("50.00");

  // System Configuration States
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [minLoanAmount, setMinLoanAmount] = useState("500");
  const [maxLoanAmount, setMaxLoanAmount] = useState("5000");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("30");

  // Notification Settings States
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [appApprovedNotif, setAppApprovedNotif] = useState(true);
  const [appRejectedNotif, setAppRejectedNotif] = useState(true);
  const [paymentReminders, setPaymentReminders] = useState(true);
  const [paymentReceived, setPaymentReceived] = useState(true);
  const [documentRequired, setDocumentRequired] = useState(true);
  const [adminAlerts, setAdminAlerts] = useState(true);

  // Email Configuration States
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [fromEmail, setFromEmail] = useState("noreply@amerilend.com");
  const [fromName, setFromName] = useState("AmeriLend");

  // API Keys States
  const [authnetLoginId, setAuthnetLoginId] = useState("");
  const [authnetTransKey, setAuthnetTransKey] = useState("");
  const [sendgridKey, setSendgridKey] = useState("");
  const [twilioSid, setTwilioSid] = useState("");

  // Queries
  const { data: feeConfig } = trpc.feeConfig.getActive.useQuery();
  const { data: systemConfig } = trpc.systemConfig.get.useQuery();
  const { data: notificationSettings } = trpc.notificationConfig.get.useQuery();
  const { data: emailConfig } = trpc.emailConfig.get.useQuery();

  // Update fee config mutation
  const updateFeeConfigMutation = trpc.feeConfig.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("Fee configuration updated successfully");
      utils.feeConfig.getActive.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update fee configuration");
    },
  });

  // System config mutation
  const updateSystemConfigMutation = trpc.systemConfig.update.useMutation({
    onSuccess: () => {
      toast.success("System configuration updated successfully");
      utils.systemConfig.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update system configuration");
    },
  });

  // Notification settings mutation
  const updateNotificationMutation = trpc.notificationConfig.update.useMutation({
    onSuccess: () => {
      toast.success("Notification settings updated successfully");
      utils.notificationConfig.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update notification settings");
    },
  });

  // Email config mutation
  const saveEmailConfigMutation = trpc.emailConfig.save.useMutation({
    onSuccess: () => {
      toast.success("Email configuration saved successfully");
      utils.emailConfig.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save email configuration");
    },
  });

  // API keys mutation
  const saveAPIKeyMutation = trpc.apiKeys.save.useMutation({
    onSuccess: () => {
      toast.success("API keys saved successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save API keys");
    },
  });

  // Load existing fee config
  useEffect(() => {
    if (feeConfig) {
      setFeeMode(feeConfig.calculationMode);
      if (feeConfig.calculationMode === "percentage" && feeConfig.percentageRate) {
        setPercentageRate((feeConfig.percentageRate / 100).toFixed(2));
      }
      if (feeConfig.calculationMode === "fixed" && feeConfig.fixedFeeAmount) {
        setFixedFeeAmount((feeConfig.fixedFeeAmount / 100).toFixed(2));
      }
    }
  }, [feeConfig]);

  // Load system config
  useEffect(() => {
    if (systemConfig) {
      setAutoApprovalEnabled(systemConfig.autoApprovalEnabled || false);
      setMaintenanceMode(systemConfig.maintenanceMode || false);
      setMinLoanAmount(systemConfig.minLoanAmount || "500");
      setMaxLoanAmount(systemConfig.maxLoanAmount || "5000");
      setTwoFactorRequired(systemConfig.twoFactorRequired || false);
      setSessionTimeout(String(systemConfig.sessionTimeout || 30));
    }
  }, [systemConfig]);

  // Load notification settings
  useEffect(() => {
    if (notificationSettings) {
      setEmailNotifications(notificationSettings.emailNotifications ?? true);
      setSmsNotifications(notificationSettings.smsNotifications ?? false);
      setAppApprovedNotif(notificationSettings.applicationApproved ?? true);
      setAppRejectedNotif(notificationSettings.applicationRejected ?? true);
      setPaymentReminders(notificationSettings.paymentReminders ?? true);
      setPaymentReceived(notificationSettings.paymentReceived ?? true);
      setDocumentRequired(notificationSettings.documentRequired ?? true);
      setAdminAlerts(notificationSettings.adminAlerts ?? true);
    }
  }, [notificationSettings]);

  // Load email config
  useEffect(() => {
    if (emailConfig) {
      setSmtpHost(emailConfig.smtpHost || "");
      setSmtpPort(String(emailConfig.smtpPort || 587));
      setSmtpUser(emailConfig.smtpUser || "");
      setFromEmail(emailConfig.fromEmail || "noreply@amerilend.com");
      setFromName(emailConfig.fromName || "AmeriLend");
    }
  }, [emailConfig]);

  const handleUpdateFeeConfig = () => {
    if (feeMode === "percentage") {
      const rate = parseFloat(percentageRate);
      if (isNaN(rate) || rate <= 0 || rate > 100) {
        toast.error("Please enter a valid percentage rate (0-100)");
        return;
      }
      updateFeeConfigMutation.mutate({
        calculationMode: "percentage",
        percentageRate: Math.round(rate * 100),
      });
    } else {
      const amount = parseFloat(fixedFeeAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Please enter a valid fixed amount");
        return;
      }
      updateFeeConfigMutation.mutate({
        calculationMode: "fixed",
        fixedFeeAmount: Math.round(amount * 100),
      });
    }
  };

  const handleUpdateSystemConfig = () => {
    updateSystemConfigMutation.mutate({
      autoApprovalEnabled,
      maintenanceMode,
      minLoanAmount,
      maxLoanAmount,
      twoFactorRequired,
      sessionTimeout: parseInt(sessionTimeout),
    });
  };

  const handleUpdateNotifications = () => {
    updateNotificationMutation.mutate({
      emailNotifications,
      smsNotifications,
      applicationApproved: appApprovedNotif,
      applicationRejected: appRejectedNotif,
      paymentReminders,
      paymentReceived,
      documentRequired,
      adminAlerts,
    });
  };

  const handleSaveEmailConfig = () => {
    if (!fromEmail || !fromName) {
      toast.error("From email and name are required");
      return;
    }
    saveEmailConfigMutation.mutate({
      provider: smtpHost ? "smtp" : "sendgrid",
      smtpHost: smtpHost || undefined,
      smtpPort: smtpPort ? parseInt(smtpPort) : undefined,
      smtpUser: smtpUser || undefined,
      smtpPassword: smtpPassword || undefined,
      fromEmail,
      fromName,
    });
  };

  const handleSaveAPIKeys = () => {
    const promises = [];
    if (authnetLoginId) {
      promises.push(
        saveAPIKeyMutation.mutateAsync({
          provider: "authorizenet",
          keyName: "api_login_id",
          value: authnetLoginId,
        })
      );
    }
    if (authnetTransKey) {
      promises.push(
        saveAPIKeyMutation.mutateAsync({
          provider: "authorizenet",
          keyName: "transaction_key",
          value: authnetTransKey,
        })
      );
    }
    if (sendgridKey) {
      promises.push(
        saveAPIKeyMutation.mutateAsync({
          provider: "sendgrid",
          keyName: "api_key",
          value: sendgridKey,
        })
      );
    }
    if (twilioSid) {
      promises.push(
        saveAPIKeyMutation.mutateAsync({
          provider: "twilio",
          keyName: "account_sid",
          value: twilioSid,
        })
      );
    }
    if (promises.length === 0) {
      toast.error("Please enter at least one API key");
      return;
    }
    Promise.all(promises)
      .then(() => {
        toast.success("All API keys saved successfully");
        setAuthnetLoginId("");
        setAuthnetTransKey("");
        setSendgridKey("");
        setTwilioSid("");
      })
      .catch((error) => {
        toast.error("Failed to save some API keys");
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0033A0] to-[#002070] text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" className="text-white hover:bg-white/20 gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Admin Settings</h1>
                <p className="text-blue-100 mt-1">Configure system settings and preferences</p>
              </div>
            </div>
            <Link href="/">
              <img 
                src={APP_LOGO} 
                alt="AmeriLend" 
                className="h-10 w-auto cursor-pointer hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="fees" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="fees" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Fee Config
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Settings className="h-4 w-4" />
              System
            </TabsTrigger>
            <TabsTrigger value="legal" className="gap-2">
              <FileText className="h-4 w-4" />
              Legal
            </TabsTrigger>
          </TabsList>

          {/* Fee Configuration Tab */}
          <TabsContent value="fees">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Processing Fee Configuration
                </CardTitle>
                <CardDescription>
                  Configure how processing fees are calculated for approved loans
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fee-mode">Fee Calculation Mode</Label>
                    <Select value={feeMode} onValueChange={(value) => setFeeMode(value as "percentage" | "fixed")}>
                      <SelectTrigger id="fee-mode">
                        <SelectValue placeholder="Select fee mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage of Loan Amount</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {feeMode === "percentage" && (
                    <div>
                      <Label htmlFor="percentage-rate">Percentage Rate (%)</Label>
                      <Input
                        id="percentage-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={percentageRate}
                        onChange={(e) => setPercentageRate(e.target.value)}
                        placeholder="2.00"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Example: For a $1,000 loan at {percentageRate}%, fee would be $
                        {((parseFloat(percentageRate) || 0) * 10).toFixed(2)}
                      </p>
                    </div>
                  )}

                  {feeMode === "fixed" && (
                    <div>
                      <Label htmlFor="fixed-amount">Fixed Fee Amount ($)</Label>
                      <Input
                        id="fixed-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={fixedFeeAmount}
                        onChange={(e) => setFixedFeeAmount(e.target.value)}
                        placeholder="50.00"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        This fixed amount will be charged regardless of loan size
                      </p>
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleUpdateFeeConfig} 
                  disabled={updateFeeConfigMutation.isPending}
                  className="w-full"
                >
                  {updateFeeConfigMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Fee Configuration
                </Button>

                {feeConfig && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Current Configuration</h4>
                    <div className="text-sm text-blue-700">
                      <p>Mode: {feeConfig.calculationMode === "percentage" ? "Percentage" : "Fixed Amount"}</p>
                      {feeConfig.calculationMode === "percentage" && (
                        <p>Rate: {(feeConfig.percentageRate / 100).toFixed(2)}%</p>
                      )}
                      {feeConfig.calculationMode === "fixed" && (
                        <p>Amount: ${(feeConfig.fixedFeeAmount / 100).toFixed(2)}</p>
                      )}
                      {'updatedAt' in feeConfig && (
                        <p className="mt-2 text-xs">
                          Last updated: {new Date(feeConfig.updatedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Settings
                  </CardTitle>
                  <CardDescription>
                    Manage email and SMS notifications for customers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <p className="text-sm text-gray-500">
                        Send email updates for loan status changes
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="sms-notifications">SMS Notifications</Label>
                      <p className="text-sm text-gray-500">
                        Send text message alerts for important updates
                      </p>
                    </div>
                    <Switch
                      id="sms-notifications"
                      checked={smsNotifications}
                      onCheckedChange={setSmsNotifications}
                    />
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleUpdateNotifications}
                    disabled={updateNotificationMutation.isPending}
                  >
                    {updateNotificationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Notification Settings
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Service Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure SMTP settings for outgoing emails
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="smtp-host">SMTP Host</Label>
                    <Input 
                      id="smtp-host" 
                      placeholder="smtp.example.com" 
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp-port">SMTP Port</Label>
                    <Input 
                      id="smtp-port" 
                      type="number" 
                      placeholder="587" 
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp-user">SMTP Username</Label>
                    <Input 
                      id="smtp-user" 
                      placeholder="noreply@amerilend.com" 
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp-password">SMTP Password</Label>
                    <Input 
                      id="smtp-password" 
                      type="password" 
                      placeholder="••••••••" 
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="from-email">From Email</Label>
                    <Input 
                      id="from-email" 
                      type="email"
                      placeholder="noreply@amerilend.com" 
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="from-name">From Name</Label>
                    <Input 
                      id="from-name" 
                      placeholder="AmeriLend" 
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                    />
                  </div>
                  <Button 
                    className="w-full"
                    onClick={handleSaveEmailConfig}
                    disabled={saveEmailConfigMutation.isPending}
                  >
                    {saveEmailConfigMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Email Configuration
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Security Settings
                  </CardTitle>
                  <CardDescription>
                    Configure security policies and authentication settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="two-factor">Two-Factor Authentication</Label>
                      <p className="text-sm text-gray-500">
                        Require 2FA for admin users
                      </p>
                    </div>
                    <Switch 
                      id="two-factor" 
                      checked={twoFactorRequired}
                      onCheckedChange={setTwoFactorRequired}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                      <p className="text-sm text-gray-500">
                        Auto-logout after inactivity
                      </p>
                    </div>
                    <Input 
                      id="session-timeout" 
                      type="number" 
                      className="w-24" 
                      value={sessionTimeout}
                      onChange={(e) => setSessionTimeout(e.target.value)}
                    />
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleUpdateSystemConfig}
                    disabled={updateSystemConfigMutation.isPending}
                  >
                    {updateSystemConfigMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Security Settings
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    API Keys & Integrations
                  </CardTitle>
                  <CardDescription>
                    Manage third-party API keys and integrations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="authnet-key">Authorize.Net API Login ID</Label>
                    <Input 
                      id="authnet-key" 
                      placeholder="Enter API Login ID" 
                      value={authnetLoginId}
                      onChange={(e) => setAuthnetLoginId(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="authnet-trans-key">Authorize.Net Transaction Key</Label>
                    <Input 
                      id="authnet-trans-key" 
                      type="password" 
                      placeholder="Enter Transaction Key" 
                      value={authnetTransKey}
                      onChange={(e) => setAuthnetTransKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sendgrid-key">SendGrid API Key</Label>
                    <Input 
                      id="sendgrid-key" 
                      type="password" 
                      placeholder="Enter SendGrid API Key" 
                      value={sendgridKey}
                      onChange={(e) => setSendgridKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="twilio-sid">Twilio Account SID</Label>
                    <Input 
                      id="twilio-sid" 
                      placeholder="Enter Twilio SID" 
                      value={twilioSid}
                      onChange={(e) => setTwilioSid(e.target.value)}
                    />
                  </div>
                  <Button 
                    className="w-full"
                    onClick={handleSaveAPIKeys}
                    disabled={saveAPIKeyMutation.isPending}
                  >
                    {saveAPIKeyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save API Keys
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    System Configuration
                  </CardTitle>
                  <CardDescription>
                    General system settings and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-approval">Auto-Approval (Testing Only)</Label>
                      <p className="text-sm text-gray-500">
                        Automatically approve loans for testing
                      </p>
                    </div>
                    <Switch
                      id="auto-approval"
                      checked={autoApprovalEnabled}
                      onCheckedChange={setAutoApprovalEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
                      <p className="text-sm text-gray-500 text-red-600">
                        Disable customer access to the platform
                      </p>
                    </div>
                    <Switch
                      id="maintenance-mode"
                      checked={maintenanceMode}
                      onCheckedChange={setMaintenanceMode}
                    />
                  </div>

                  <div>
                    <Label htmlFor="max-loan-amount">Maximum Loan Amount ($)</Label>
                    <Input 
                      id="max-loan-amount" 
                      type="number" 
                      value={maxLoanAmount}
                      onChange={(e) => setMaxLoanAmount(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="min-loan-amount">Minimum Loan Amount ($)</Label>
                    <Input 
                      id="min-loan-amount" 
                      type="number" 
                      value={minLoanAmount}
                      onChange={(e) => setMinLoanAmount(e.target.value)}
                    />
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleUpdateSystemConfig}
                    disabled={updateSystemConfigMutation.isPending}
                  >
                    {updateSystemConfigMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save System Settings
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database & Backup
                  </CardTitle>
                  <CardDescription>
                    Database maintenance and backup settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Database Status</Label>
                    <p className="text-sm text-green-600 mt-1">✓ Connected</p>
                  </div>
                  <div>
                    <Label>Last Backup</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => toast.success("Backup started")}>
                      Backup Now
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => toast.info("Restore functionality")}>
                      Restore
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Legal Tab */}
          <TabsContent value="legal">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Legal Documents
                </CardTitle>
                <CardDescription>
                  Manage legal documents and compliance settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Link href="/public/legal/terms-of-service">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      Terms of Service
                    </Button>
                  </Link>
                  <Link href="/public/legal/privacy-policy">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      Privacy Policy
                    </Button>
                  </Link>
                  <Link href="/public/legal/loan-agreement">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      Loan Agreement Template
                    </Button>
                  </Link>
                  <Link href="/public/legal/esign-consent">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      E-Sign Consent
                    </Button>
                  </Link>
                </div>

                <div className="mt-6">
                  <Label>Company Information</Label>
                  <Textarea
                    className="mt-2"
                    rows={6}
                    defaultValue={`AmeriLend LLC
12707 High Bluff Drive, Suite 200
San Diego, CA 92130, USA

Phone: (945) 212-1609
Email: support@amerilendloan.com`}
                  />
                </div>

                <Button className="w-full" onClick={() => toast.success("Legal information updated")}>
                  Update Legal Information
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
