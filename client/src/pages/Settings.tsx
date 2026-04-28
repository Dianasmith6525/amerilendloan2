import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Lock, Bell, Shield, Eye, EyeOff, AlertTriangle, User, Smartphone, Trash2, LogOut, Download, Globe } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { toTitleCase } from "@shared/format";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  COMPANY_PHONE_DISPLAY_SHORT,
  COMPANY_PHONE_RAW,
  COMPANY_SUPPORT_EMAIL,
  SUPPORT_HOURS_WEEKDAY,
  SUPPORT_HOURS_WEEKEND,
} from "@/const";

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, authLoading, setLocation]);

  // NOTE: do not early-return here. React requires the same number of hooks
  // on every render, and dozens of useState/useQuery/useMutation calls live
  // below. Returning before them flipped the hook count whenever auth state
  // resolved and produced "Rendered more hooks than during the previous
  // render". The loading/unauthenticated UI is rendered further down after
  // every hook has been called.
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFactorCode: "",
  });
  const [emailForm, setEmailForm] = useState({
    newEmail: user?.email || "",
    twoFactorCode: "",
  });
  const [bankForm, setBankForm] = useState({
    bankAccountHolderName: "",
    bankAccountNumber: "",
    bankRoutingNumber: "",
    bankAccountType: "checking" as "checking" | "savings",
  });
  const [notifications, setNotifications] = useState({
    emailUpdates: true,
    loanUpdates: true,
    promotions: false,
    sms: true,
  });
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    dateOfBirth: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    bio: "",
    preferredLanguage: "en",
    timezone: "UTC",
  });
  // 2FA state removed - now managed in Dashboard > Security tab
  const [deleteReason, setDeleteReason] = useState("");
  const [activeTab, setActiveTab] = useState<"password" | "email" | "bank" | "notifications" | "profile" | "language" | "2fa" | "devices" | "activity" | "privacy">("password");
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<any[]>([]);

  // tRPC mutations
  const updatePasswordMutation = trpc.auth.updatePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "", twoFactorCode: "" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update password");
    },
  });

  const updateEmailMutation = trpc.auth.updateEmail.useMutation({
    onSuccess: () => {
      toast.success("Email updated successfully! Check both emails for verification.");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update email");
    },
  });

  const updateBankInfoMutation = trpc.auth.updateBankInfo.useMutation({
    onSuccess: () => {
      toast.success("Bank information updated successfully!");
      setBankForm({
        bankAccountHolderName: "",
        bankAccountNumber: "",
        bankRoutingNumber: "",
        bankAccountType: "checking",
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update bank information");
    },
  });

  const updateNotificationMutation = trpc.auth.updateNotificationPreferences.useMutation({
    onSuccess: () => {
      toast.success("Notification preferences saved!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save notification preferences");
    },
  });

  const updateProfileMutation = trpc.auth.updateUserProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  // 2FA is managed in the Dashboard > Security tab
  // These mutations are kept for backwards compatibility but not actively used

  const getTrustedDevicesQuery = trpc.auth.getTrustedDevices.useQuery(undefined, {
    enabled: isAuthenticated && activeTab === "devices",
  });

  const removeTrustedDeviceMutation = trpc.auth.removeTrustedDevice.useMutation({
    onSuccess: () => {
      toast.success("Device removed successfully!");
      getTrustedDevicesQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove device");
    },
  });

  const requestDeleteMutation = trpc.auth.requestAccountDeletion.useMutation({
    onSuccess: () => {
      toast.success("Account deletion request submitted! Check your email for confirmation.");
      setDeleteReason("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to request account deletion");
    },
  });

  const getActivityLogQuery = trpc.auth.getActivityLog.useQuery(undefined, {
    enabled: isAuthenticated && activeTab === "activity",
  });

  // Bank info fetched from user profile
  const getUserBankInfoQuery = trpc.auth.getBankInfo.useQuery(undefined, {
    enabled: isAuthenticated && activeTab === "bank",
  });

  // Email fetched from user auth context
  const getUserEmailQuery = { data: user ? { email: user.email } : null as any };

  const getNotificationPreferencesQuery = trpc.auth.getNotificationPreferences.useQuery(undefined, {
    enabled: isAuthenticated && activeTab === "notifications",
  });

  const getUserProfileQuery = trpc.auth.getUserProfile.useQuery(undefined, {
    enabled: isAuthenticated && activeTab === "profile",
  });

  const get2FAQuery = trpc.auth.get2FASettings.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const twoFactorEnabled = Boolean((get2FAQuery.data as any)?.enabled);

  // Update forms when queries succeed - using useEffect to avoid render loops
  useEffect(() => {
    if (getTrustedDevicesQuery.data) {
      setTrustedDevices(getTrustedDevicesQuery.data);
    }
  }, [getTrustedDevicesQuery.data]);

  useEffect(() => {
    if (getNotificationPreferencesQuery.data && activeTab === "notifications") {
      setNotifications(getNotificationPreferencesQuery.data);
    }
  }, [getNotificationPreferencesQuery.data, activeTab]);

  useEffect(() => {
    if (getUserProfileQuery.data && activeTab === "profile") {
      setProfileForm(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(getUserProfileQuery.data || {}).filter(([key]) => key in prev)
        ),
      } as typeof profileForm));
    }
  }, [getUserProfileQuery.data, activeTab]);

  useEffect(() => {
    if (getUserBankInfoQuery.data && activeTab === "bank") {
      setBankForm(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(getUserBankInfoQuery.data || {}).filter(([key]) => key in prev)
        ),
      } as typeof bankForm));
    }
  }, [getUserBankInfoQuery.data, activeTab]);

  useEffect(() => {
    if (getUserEmailQuery.data && activeTab === "email") {
      setEmailForm({ newEmail: getUserEmailQuery.data.email || user?.email || "", twoFactorCode: "" });
    }
  }, [getUserEmailQuery.data, activeTab, user?.email]);

  // Auto-load devices when tab is opened
  useEffect(() => {
    if (activeTab === "devices" && !trustedDevices.length) {
      getTrustedDevicesQuery.refetch();
    }
  }, [activeTab]);

  // 2FA query removed - now managed in Dashboard

  // Render guards live AFTER every hook so the hook count stays stable.
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 mb-4">Please log in to access settings.</p>
            <Button
              onClick={() => setLocation("/login")}
              className="bg-[#0A2540] hover:bg-[#002080] text-white w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm({
      ...passwordForm,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordSubmit = () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (twoFactorEnabled && !passwordForm.twoFactorCode.trim()) {
      toast.error("Enter your two-factor verification code to confirm this change");
      return;
    }
    updatePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
      twoFactorCode: passwordForm.twoFactorCode || undefined,
    });
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailForm({
      ...emailForm,
      newEmail: e.target.value,
    });
  };

  const handleEmailSubmit = () => {
    if (!emailForm.newEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (twoFactorEnabled && !emailForm.twoFactorCode.trim()) {
      toast.error("Enter your two-factor verification code to confirm this change");
      return;
    }
    updateEmailMutation.mutate({
      newEmail: emailForm.newEmail,
      twoFactorCode: emailForm.twoFactorCode || undefined,
    });
  };

  const handleBankFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setBankForm({
      ...bankForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleBankSubmit = () => {
    if (!bankForm.bankAccountHolderName.trim()) {
      toast.error("Please enter account holder name");
      return;
    }
    if (bankForm.bankAccountNumber.length < 8) {
      toast.error("Please enter a valid account number");
      return;
    }
    if (!/^\d{9}$/.test(bankForm.bankRoutingNumber)) {
      toast.error("Routing number must be 9 digits");
      return;
    }
    updateBankInfoMutation.mutate(bankForm);
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    let value = e.target.value;
    
    // Apply formatting for phone number
    if (e.target.name === "phoneNumber") {
      value = formatPhoneNumber(value);
    }
    
    // Auto-capitalize name fields
    if (e.target.name === "firstName" || e.target.name === "lastName") {
      value = toTitleCase(value);
    }

    setProfileForm({
      ...profileForm,
      [e.target.name]: value,
    });
  };

  const handleProfileSubmit = () => {
    updateProfileMutation.mutate(profileForm);
  };

  const handleNotificationChange = (key: keyof typeof notifications) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    // Actually persist the change. Without this call the toggle only flipped
    // local state and the toast was misleading.
    updateNotificationMutation.mutate(next);
  };

  const handleEnable2FA = () => {
    toast.info("Please use the Security tab in your Dashboard to manage 2FA");
  };

  const handleDisable2FA = () => {
    toast.info("Please use the Security tab in your Dashboard to manage 2FA");
  };

  // handleCopyBackupCodes removed - 2FA now managed in Dashboard

  const handleLogoutClick = () => {
    logout();
    window.location.href = "/";
  };

  const handleRemoveDeviceClick = (deviceId: string, deviceName: string) => {
    if (window.confirm(`Are you sure you want to remove "${deviceName}" from trusted devices? You'll need to verify your identity again when logging in from this device.`)) {
      removeTrustedDeviceMutation.mutate({ deviceId: parseInt(deviceId) });
    }
  };

  const handleRequestAccountDeletion = () => {
    if (!deleteReason.trim()) {
      toast.error("Please provide a reason for account deletion");
      return;
    }
    if (window.confirm("WARNING: Account deletion is permanent and cannot be undone. All your data, loans, and payment history will be deleted. Are you sure?")) {
      requestDeleteMutation.mutate({ reason: deleteReason });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => setLocation("/dashboard")}
              className="flex items-center gap-2 text-[#0A2540] hover:opacity-75"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-xl font-bold text-[#0A2540]">{t('settings.title')}</h1>
            <div className="w-24" />
          </div>
        </div>
      </header>

      <div className="py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b flex-wrap">
            {["password", "email", "bank", "profile", "language", "notifications", "privacy"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-3 font-medium transition-colors border-b-2 capitalize text-sm ${
                  activeTab === tab
                    ? "border-[#0A2540] text-[#0A2540]"
                    : "border-transparent text-gray-600 hover:text-[#0A2540]"
                }`}
              >
                {tab === "password" && <Lock className="w-4 h-4 inline mr-2" />}
                {tab === "email" && <Bell className="w-4 h-4 inline mr-2" />}
                {tab === "bank" && <Shield className="w-4 h-4 inline mr-2" />}
                {tab === "profile" && <User className="w-4 h-4 inline mr-2" />}
                {tab === "language" && <Globe className="w-4 h-4 inline mr-2" />}
                {tab === "notifications" && <Bell className="w-4 h-4 inline mr-2" />}
                {tab === "privacy" && <Download className="w-4 h-4 inline mr-2" />}
                {tab === "2fa" ? "2FA" : tab === "privacy" ? "Privacy & Data" : tab}
              </button>
            ))}
          </div>

          {/* Password Tab */}
          {activeTab === "password" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#0A2540]">Change Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-800">Current Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-800">New Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                    placeholder="Enter new password (min 8 characters)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-800">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-600 hover:text-gray-800"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Password must be at least 8 characters long
                  </p>
                </div>

                {twoFactorEnabled && (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">Two-Factor Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      name="twoFactorCode"
                      value={passwordForm.twoFactorCode}
                      onChange={handlePasswordChange}
                      placeholder="6-digit code or backup code"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    />
                    <p className="text-xs text-gray-500">
                      Required because you have two-factor authentication enabled.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handlePasswordSubmit}
                  disabled={updatePasswordMutation.isPending}
                  className="bg-[#C9A227] hover:bg-[#B8922A] text-white w-full"
                >
                  {updatePasswordMutation.isPending ? "Updating..." : "Update Password"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Email Tab */}
          {activeTab === "email" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#0A2540]">Update Email Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Current Email:</strong> {user?.email}
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-800">New Email Address</label>
                  <input
                    type="email"
                    value={emailForm.newEmail}
                    onChange={handleEmailChange}
                    placeholder="Enter your new email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  />
                  <p className="text-xs text-gray-500">
                    We'll send a verification email to both your old and new addresses
                  </p>
                </div>

                {twoFactorEnabled && (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">Two-Factor Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={emailForm.twoFactorCode}
                      onChange={(e) => setEmailForm({ ...emailForm, twoFactorCode: e.target.value })}
                      placeholder="6-digit code or backup code"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    />
                    <p className="text-xs text-gray-500">
                      Required because you have two-factor authentication enabled.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleEmailSubmit}
                  disabled={updateEmailMutation.isPending || emailForm.newEmail === user?.email}
                  className="bg-[#C9A227] hover:bg-[#B8922A] text-white w-full"
                >
                  {updateEmailMutation.isPending ? "Updating..." : "Update Email"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Bank Info Tab */}
          {activeTab === "bank" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#0A2540]">Disbursement Bank Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Security:</strong> This information is used only for loan disbursement. Your account data is encrypted and secure.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-800">Account Holder Name</label>
                  <input
                    type="text"
                    name="bankAccountHolderName"
                    value={bankForm.bankAccountHolderName}
                    onChange={handleBankFormChange}
                    placeholder="Full name on bank account"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">Account Number</label>
                    <input
                      type="text"
                      name="bankAccountNumber"
                      value={bankForm.bankAccountNumber}
                      onChange={handleBankFormChange}
                      placeholder="Account number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">Routing Number</label>
                    <input
                      type="text"
                      name="bankRoutingNumber"
                      value={bankForm.bankRoutingNumber}
                      onChange={handleBankFormChange}
                      placeholder="9-digit routing number"
                      maxLength={9}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label htmlFor="bankAccountType" className="text-sm font-semibold text-gray-800">Account Type</label>
                  <select
                    id="bankAccountType"
                    name="bankAccountType"
                    value={bankForm.bankAccountType}
                    onChange={handleBankFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>

                <Button
                  onClick={handleBankSubmit}
                  disabled={updateBankInfoMutation.isPending}
                  className="bg-[#C9A227] hover:bg-[#B8922A] text-white w-full"
                >
                  {updateBankInfoMutation.isPending ? "Updating..." : "Save Bank Information"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#0A2540]">Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Security notifications are mandatory</strong> to protect your account. You can customize optional notifications below.
                  </p>
                </div>

                {/* Mandatory Security Notifications */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    Security Notifications (Always Active)
                  </h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                    {[
                      { label: "New Login Alerts", description: "Notifies you when someone logs into your account with location, IP address, device, and browser details" },
                      { label: "Password Changes", description: "Immediate notification when your password is changed" },
                      { label: "Email Changes", description: "Alert when your email address is updated" },
                      { label: "Bank Account Changes", description: "Notification when bank account information is modified" },
                      { label: "Suspicious Activity", description: "Alerts for unusual account activity" },
                    ].map(({ label, description }) => (
                      <div key={label} className="flex items-start gap-3 p-3 bg-white rounded border border-green-300">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 text-sm">{label}</p>
                          <p className="text-xs text-gray-600 mt-1">{description}</p>
                        </div>
                        <span className="flex-shrink-0 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                          REQUIRED
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optional Notifications */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 text-lg">Optional Notifications</h3>
                  {[
                    { key: "emailUpdates" as const, label: "Account & Loan Updates via Email", description: "Receive emails about account changes and loan status" },
                    { key: "loanUpdates" as const, label: "Loan Application Updates", description: "Get notified when your loan status changes" },
                    { key: "promotions" as const, label: "Promotional Offers", description: "Receive information about special offers" },
                    { key: "sms" as const, label: "SMS Notifications", description: "Get text messages for urgent updates" },
                  ].map(({ key, label, description }) => (
                    <div key={key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{label}</p>
                        <p className="text-sm text-gray-600">{description}</p>
                      </div>
                      <label htmlFor={key} className="flex items-center cursor-pointer gap-2">
                        <input
                          id={key}
                          type="checkbox"
                          checked={notifications[key]}
                          onChange={() => {
                            const newNotifications = {
                              ...notifications,
                              [key]: !notifications[key],
                            };
                            setNotifications(newNotifications);
                          }}
                          className="w-5 h-5 rounded border-gray-300 text-[#0A2540] focus:ring-2 focus:ring-[#0A2540]"
                          aria-label={label}
                        />
                        <span className="sr-only">{label}</span>
                      </label>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => {
                    updateNotificationMutation.mutate(notifications);
                  }}
                  disabled={updateNotificationMutation.isPending}
                  className="bg-[#C9A227] hover:bg-[#B8922A] text-white w-full"
                >
                  {updateNotificationMutation.isPending ? "Saving..." : "Save Notification Preferences"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Personal Profile Tab */}
          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#0A2540]">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={profileForm.firstName}
                      onChange={handleProfileChange}
                      placeholder="First name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={profileForm.lastName}
                      onChange={handleProfileChange}
                      placeholder="Last name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">Phone Number</label>
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={profileForm.phoneNumber}
                      onChange={handleProfileChange}
                      placeholder="(XXX) XXX-XXXX"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    />
                    <p className="text-xs text-gray-500">Automatically formatted as (XXX) XXX-XXXX</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label htmlFor="dateOfBirth" className="text-sm font-semibold text-gray-800">Date of Birth</label>
                  <input
                    id="dateOfBirth"
                    type="date"
                    name="dateOfBirth"
                    value={profileForm.dateOfBirth}
                    onChange={handleProfileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-800">Address</label>
                  <input
                    type="text"
                    name="street"
                    value={profileForm.street}
                    onChange={handleProfileChange}
                    placeholder="Street address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">City</label>
                    <input
                      type="text"
                      name="city"
                      value={profileForm.city}
                      onChange={handleProfileChange}
                      placeholder="City"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">State</label>
                    <input
                      type="text"
                      name="state"
                      value={profileForm.state}
                      onChange={handleProfileChange}
                      placeholder="State code (e.g., TX)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">Zip Code</label>
                    <input
                      type="text"
                      name="zipCode"
                      value={profileForm.zipCode}
                      onChange={handleProfileChange}
                      placeholder="Zip code"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-800">Bio</label>
                  <textarea
                    name="bio"
                    value={profileForm.bio}
                    onChange={handleProfileChange}
                    placeholder="Tell us about yourself (optional)"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label htmlFor="preferredLanguage" className="text-sm font-semibold text-gray-800">Preferred Language</label>
                    <select
                      id="preferredLanguage"
                      name="preferredLanguage"
                      value={profileForm.preferredLanguage}
                      onChange={handleProfileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label htmlFor="timezone" className="text-sm font-semibold text-gray-800">Timezone</label>
                    <select
                      id="timezone"
                      name="timezone"
                      value={profileForm.timezone}
                      onChange={handleProfileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                    >
                      <option value="UTC">UTC</option>
                      <option value="EST">Eastern Time</option>
                      <option value="CST">Central Time</option>
                      <option value="MST">Mountain Time</option>
                      <option value="PST">Pacific Time</option>
                    </select>
                  </div>
                </div>

                <Button
                  onClick={handleProfileSubmit}
                  disabled={updateProfileMutation.isPending}
                  className="bg-[#C9A227] hover:bg-[#B8922A] text-white w-full"
                >
                  {updateProfileMutation.isPending ? "Updating..." : "Save Profile"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Trusted Devices Tab */}
          {activeTab === "devices" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#0A2540]">Trusted Devices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Manage devices you've authorized to access your account without additional verification.
                  </p>
                </div>

                <Button
                  onClick={() => getTrustedDevicesQuery.refetch()}
                  variant="outline"
                  className="w-full"
                >
                  Load Devices
                </Button>

                {trustedDevices.length > 0 ? (
                  <div className="space-y-3">
                    {trustedDevices.map((device) => (
                      <div key={device.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">{device.deviceName}</p>
                            <p className="text-sm text-gray-600">{device.userAgent}</p>
                            {device.ipAddress && (
                              <p className="text-xs text-gray-500 mt-1">IP: {device.ipAddress}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              Last used: {new Date(device.lastUsedAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            onClick={() => handleRemoveDeviceClick(device.id, device.deviceName || "Device")}
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-8">No trusted devices found</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Language Tab */}
          {activeTab === "language" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#0A2540]">{t('settings.language')}</CardTitle>
                <CardDescription>
                  Choose your preferred language for the application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-800 mb-3 block">
                      Select Language / Seleccionar Idioma
                    </label>
                    <LanguageSwitcher />
                  </div>
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mt-6">
                    <h3 className="font-semibold text-[#0A2540] mb-2">Available Languages</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600">🇺🇸</span>
                        <span><strong>English</strong> - Full support</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600">🇪🇸</span>
                        <span><strong>Español (Spanish)</strong> - Full support</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <strong>Note:</strong> Your language preference is saved automatically and will be applied across all pages. 
                      Some legal documents may only be available in English.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Privacy & Data Tab */}
          {activeTab === "privacy" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#0A2540]">Privacy & Data</CardTitle>
                <CardDescription>Manage your personal data and privacy preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* GDPR Data Export */}
                <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-[#0A2540] mb-2 flex items-center gap-2">
                    <Download className="w-5 h-5" /> Export Your Data
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Download a complete copy of your personal data including your profile, loan applications, payment history, rewards, and referrals. This is provided in compliance with GDPR and data portability regulations.
                  </p>
                  <Button
                    onClick={async () => {
                      try {
                        toast.info("Preparing your data export...");
                        const res = await fetch("/api/trpc/dataExport.exportMyData", { credentials: "include" });
                        const json = await res.json();
                        const exportData = json?.result?.data?.json ?? json?.result?.data ?? json;
                        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `amerilend-data-export-${new Date().toISOString().split("T")[0]}.json`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        toast.success("Data exported successfully!");
                      } catch (err) {
                        toast.error("Failed to export data. Please try again.");
                      }
                    }}
                    className="bg-[#0A2540] hover:bg-[#0d3a5c] text-white"
                  >
                    <Download className="w-4 h-4 mr-2" /> Download My Data (JSON)
                  </Button>
                </div>

                {/* Privacy Links */}
                <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
                  <h3 className="font-semibold text-[#0A2540] mb-3">Privacy Documents</h3>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <a href="/legal/privacy-policy" target="_blank" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </li>
                    <li>
                      <a href="/legal/terms-of-service" target="_blank" className="text-blue-600 hover:underline">Terms of Service</a>
                    </li>
                    <li>
                      <a href="/legal/truth-in-lending" target="_blank" className="text-blue-600 hover:underline">Truth in Lending Disclosure</a>
                    </li>
                  </ul>
                </div>

                {/* Account Closure */}
                <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> Close Account
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    If you wish to close your account and have your data deleted, you can submit a closure request. Outstanding loans must be resolved first.
                  </p>
                  <Link href="/account-closure">
                    <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                      <Trash2 className="w-4 h-4 mr-2" /> Request Account Closure
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#0A2540] to-[#003366] text-white py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
            <div>
              <h4 className="font-semibold mb-3">Need Help?</h4>
              <div className="space-y-2 text-sm text-white/80">
                <p>📞 <a href={`tel:${COMPANY_PHONE_RAW}`} className="hover:text-[#C9A227] transition-colors">{COMPANY_PHONE_DISPLAY_SHORT}</a></p>
                <p>📧 <a href={`mailto:${COMPANY_SUPPORT_EMAIL}`} className="hover:text-[#C9A227] transition-colors">{COMPANY_SUPPORT_EMAIL}</a></p>
                <p>🕒 {SUPPORT_HOURS_WEEKDAY}</p>
                <p>🕒 {SUPPORT_HOURS_WEEKEND}</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="/" className="hover:text-[#C9A227] transition-colors">Home</a></li>
                <li><a href="/dashboard" className="hover:text-[#C9A227] transition-colors">Dashboard</a></li>
                <li><a href="/#faq" className="hover:text-[#C9A227] transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="/legal/privacy-policy" className="hover:text-[#C9A227] transition-colors">Privacy Policy</a></li>
                <li><a href="/legal/terms-of-service" className="hover:text-[#C9A227] transition-colors">Terms of Service</a></li>
                <li><a href="/legal/loan-agreement" className="hover:text-[#C9A227] transition-colors">Loan Agreement</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 pt-6 text-center text-xs text-white/70">
            <p>© {new Date().getFullYear()} AmeriLend, LLC. All Rights Reserved.</p>
            <p className="mt-2">Your trusted partner for consumer loans.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
