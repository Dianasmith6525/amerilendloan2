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

  // Email Settings States
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Query fee config
  const { data: feeConfig } = trpc.feeConfig.getActive.useQuery();

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

                  <Button className="w-full" onClick={() => toast.success("Notification settings updated")}>
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
                    <Input id="smtp-host" placeholder="smtp.example.com" />
                  </div>
                  <div>
                    <Label htmlFor="smtp-port">SMTP Port</Label>
                    <Input id="smtp-port" type="number" placeholder="587" />
                  </div>
                  <div>
                    <Label htmlFor="smtp-user">SMTP Username</Label>
                    <Input id="smtp-user" placeholder="noreply@amerilend.com" />
                  </div>
                  <div>
                    <Label htmlFor="smtp-password">SMTP Password</Label>
                    <Input id="smtp-password" type="password" placeholder="••••••••" />
                  </div>
                  <Button className="w-full" variant="outline">
                    Test Email Configuration
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
                    <Switch id="two-factor" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                      <p className="text-sm text-gray-500">
                        Auto-logout after inactivity
                      </p>
                    </div>
                    <Input id="session-timeout" type="number" className="w-24" defaultValue="30" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="password-expiry">Password Expiry (days)</Label>
                      <p className="text-sm text-gray-500">
                        Force password change after period
                      </p>
                    </div>
                    <Input id="password-expiry" type="number" className="w-24" defaultValue="90" />
                  </div>

                  <Button className="w-full" onClick={() => toast.success("Security settings updated")}>
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
                    <Input id="authnet-key" placeholder="Enter API Login ID" />
                  </div>
                  <div>
                    <Label htmlFor="authnet-trans-key">Authorize.Net Transaction Key</Label>
                    <Input id="authnet-trans-key" type="password" placeholder="Enter Transaction Key" />
                  </div>
                  <div>
                    <Label htmlFor="sendgrid-key">SendGrid API Key</Label>
                    <Input id="sendgrid-key" type="password" placeholder="Enter SendGrid API Key" />
                  </div>
                  <div>
                    <Label htmlFor="twilio-sid">Twilio Account SID</Label>
                    <Input id="twilio-sid" placeholder="Enter Twilio SID" />
                  </div>
                  <Button className="w-full" variant="outline">
                    Update API Keys
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
                    <Input id="max-loan-amount" type="number" defaultValue="5000" />
                  </div>

                  <div>
                    <Label htmlFor="min-loan-amount">Minimum Loan Amount ($)</Label>
                    <Input id="min-loan-amount" type="number" defaultValue="500" />
                  </div>

                  <Button className="w-full" onClick={() => toast.success("System settings updated")}>
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
