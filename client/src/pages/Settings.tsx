import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Lock, Bell, Shield, Eye, EyeOff, AlertTriangle, User, Smartphone, Trash2, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// Format phone number as (XXX) XXX-XXXX
const formatPhoneNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length === 0) return "";
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
};

// Format SSN as XXX-XX-XXXX
const formatSSN = (value: string): string => {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length === 0) return "";
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 9)}`;
};

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, authLoading, setLocation]);
  
  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }
  
  // Don't render if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [emailForm, setEmailForm] = useState({
    newEmail: user?.email || "",
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
    ssn: "",
    dateOfBirth: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    bio: "",
    preferredLanguage: "en",
    timezone: "UTC",
  });
  const [twoFAForm, setTwoFAForm] = useState({
    method: "totp" as "totp" | "sms" | "email",
    phoneNumber: "",
  });
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [activeTab, setActiveTab] = useState<"password" | "email" | "bank" | "notifications" | "profile" | "2fa" | "devices" | "activity" | "danger">("password");
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [trustedDevices, setTrustedDevices] = useState<any[]>([]);

  // tRPC mutations
  const updatePasswordMutation = trpc.auth.updatePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
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

  const enable2FAMutation = trpc.auth.enable2FA.useMutation({
    onSuccess: (data) => {
      toast.success("2FA enabled successfully!");
      setBackupCodes(data.backupCodes);
      setShowBackupCodes(true);
      setTwoFAEnabled(true);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to enable 2FA");
    },
  });

  const disable2FAMutation = trpc.auth.disable2FA.useMutation({
    onSuccess: () => {
      toast.success("2FA disabled successfully!");
      setTwoFAEnabled(false);
      setBackupCodes([]);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to disable 2FA");
    },
  });

  const getTrustedDevicesQuery = trpc.auth.getTrustedDevices.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Update trusted devices when query succeeds
  if (getTrustedDevicesQuery.data) {
    setTrustedDevices(getTrustedDevicesQuery.data);
  }

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

  const getNotificationPreferencesQuery = trpc.auth.getNotificationPreferences.useQuery(undefined, {
    enabled: isAuthenticated && activeTab === "notifications",
  });

  const getUserProfileQuery = trpc.auth.getUserProfile.useQuery(undefined, {
    enabled: isAuthenticated && activeTab === "profile",
  });

  const get2FAQuery = trpc.auth.get2FASettings.useQuery(undefined, {
    enabled: isAuthenticated && activeTab === "2fa",
  });

  // Update forms when queries succeed
  if (getNotificationPreferencesQuery.data && activeTab === "notifications") {
    setNotifications(getNotificationPreferencesQuery.data);
  }

  if (getUserProfileQuery.data && activeTab === "profile") {
    setProfileForm(prev => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(getUserProfileQuery.data || {}).filter(([key]) => key in prev)
      ),
    } as typeof profileForm));
  }

  if (get2FAQuery.data && activeTab === "2fa") {
    setTwoFAEnabled(get2FAQuery.data?.enabled || false);
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 mb-4">Please log in to access settings.</p>
            <Link href="/login">
              <Button className="bg-[#0033A0] hover:bg-[#002080] text-white w-full">
                Go to Login
              </Button>
            </Link>
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
    updatePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailForm({
      newEmail: e.target.value,
    });
  };

  const handleEmailSubmit = () => {
    if (!emailForm.newEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    updateEmailMutation.mutate({
      newEmail: emailForm.newEmail,
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
    
    // Apply formatting for SSN
    if (e.target.name === "ssn") {
      value = formatSSN(value);
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
    setNotifications({
      ...notifications,
      [key]: !notifications[key],
    });
    toast.success("Notification preference updated");
  };

  const handleEnable2FA = () => {
    enable2FAMutation.mutate({
      method: twoFAForm.method,
      phoneNumber: twoFAForm.phoneNumber,
    });
  };

  const handleDisable2FA = () => {
    if (confirm("Are you sure you want to disable 2FA? This will make your account less secure.")) {
      disable2FAMutation.mutate({ password: "" });
    }
  };

  const handleCopyBackupCodes = () => {
    const text = backupCodes.join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Backup codes copied to clipboard!");
  };

  const handleLogoutClick = () => {
    logout();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard">
              <a className="flex items-center gap-2 text-[#0033A0] hover:opacity-75">
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Dashboard</span>
              </a>
            </Link>
            <h1 className="text-xl font-bold text-[#0033A0]">Settings & Security</h1>
            <div className="w-24" />
          </div>
        </div>
      </header>

      <div className="py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b flex-wrap">
            {["password", "email", "bank", "profile", "2fa", "devices", "notifications", "danger"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-3 font-medium transition-colors border-b-2 capitalize text-sm ${
                  activeTab === tab
                    ? "border-[#0033A0] text-[#0033A0]"
                    : "border-transparent text-gray-600 hover:text-[#0033A0]"
                }`}
              >
                {tab === "password" && <Lock className="w-4 h-4 inline mr-2" />}
                {tab === "email" && <Bell className="w-4 h-4 inline mr-2" />}
                {tab === "bank" && <Shield className="w-4 h-4 inline mr-2" />}
                {tab === "profile" && <User className="w-4 h-4 inline mr-2" />}
                {tab === "2fa" && <Smartphone className="w-4 h-4 inline mr-2" />}
                {tab === "devices" && <Shield className="w-4 h-4 inline mr-2" />}
                {tab === "notifications" && <Bell className="w-4 h-4 inline mr-2" />}
                {tab === "danger" && <AlertTriangle className="w-4 h-4 inline mr-2" />}
                {tab === "2fa" ? "2FA" : tab}
              </button>
            ))}
          </div>

          {/* Password Tab */}
          {activeTab === "password" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#0033A0]">Change Password</CardTitle>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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

                <Button
                  onClick={handlePasswordSubmit}
                  disabled={updatePasswordMutation.isPending}
                  className="bg-[#FFA500] hover:bg-[#FF8C00] text-white w-full"
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
                <CardTitle className="text-2xl text-[#0033A0]">Update Email Address</CardTitle>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                  />
                  <p className="text-xs text-gray-500">
                    We'll send a verification email to both your old and new addresses
                  </p>
                </div>

                <Button
                  onClick={handleEmailSubmit}
                  disabled={updateEmailMutation.isPending || emailForm.newEmail === user?.email}
                  className="bg-[#FFA500] hover:bg-[#FF8C00] text-white w-full"
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
                <CardTitle className="text-2xl text-[#0033A0]">Disbursement Bank Account</CardTitle>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>

                <Button
                  onClick={handleBankSubmit}
                  disabled={updateBankInfoMutation.isPending}
                  className="bg-[#FFA500] hover:bg-[#FF8C00] text-white w-full"
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
                <CardTitle className="text-2xl text-[#0033A0]">Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Control how you receive updates about your loan applications, payments, and promotions.
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    { key: "emailUpdates" as const, label: "Account & Loan Updates via Email", description: "Receive emails about account changes and loan status" },
                    { key: "loanUpdates" as const, label: "Loan Application Updates", description: "Get notified when your loan status changes" },
                    { key: "promotions" as const, label: "Promotional Offers", description: "Receive information about special offers" },
                    { key: "sms" as const, label: "SMS Notifications", description: "Get text messages for urgent updates" },
                  ].map(({ key, label, description }) => (
                    <div key={key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
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
                          className="w-5 h-5 rounded border-gray-300 text-[#0033A0]"
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
                  className="bg-[#FFA500] hover:bg-[#FF8C00] text-white w-full"
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
                <CardTitle className="text-2xl text-[#0033A0]">Personal Information</CardTitle>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                    />
                    <p className="text-xs text-gray-500">Automatically formatted as (XXX) XXX-XXXX</p>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">Social Security Number</label>
                    <input
                      type="text"
                      name="ssn"
                      value={profileForm.ssn || ""}
                      onChange={handleProfileChange}
                      placeholder="XXX-XX-XXXX"
                      maxLength={11}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                    />
                    <p className="text-xs text-gray-500">Automatically formatted as XXX-XX-XXXX</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-800">Date of Birth</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={profileForm.dateOfBirth}
                    onChange={handleProfileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">Preferred Language</label>
                    <select
                      name="preferredLanguage"
                      value={profileForm.preferredLanguage}
                      onChange={handleProfileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">Timezone</label>
                    <select
                      name="timezone"
                      value={profileForm.timezone}
                      onChange={handleProfileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
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
                  className="bg-[#FFA500] hover:bg-[#FF8C00] text-white w-full"
                >
                  {updateProfileMutation.isPending ? "Updating..." : "Save Profile"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Two-Factor Authentication Tab */}
          {activeTab === "2fa" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#0033A0]">Two-Factor Authentication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Enhanced Security:</strong> Two-factor authentication adds an extra layer of security to your account.
                  </p>
                </div>

                {!twoFAEnabled ? (
                  <>
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-800">Select 2FA Method</label>
                        <select
                          value={twoFAForm.method}
                          onChange={(e) => setTwoFAForm({...twoFAForm, method: e.target.value as any})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                        >
                          <option value="totp">Authenticator App (TOTP)</option>
                          <option value="sms">SMS Text Message</option>
                          <option value="email">Email</option>
                        </select>
                      </div>

                      {twoFAForm.method === "sms" && (
                        <div className="space-y-3">
                          <label className="text-sm font-semibold text-gray-800">Phone Number</label>
                          <input
                            type="tel"
                            value={twoFAForm.phoneNumber}
                            onChange={(e) => setTwoFAForm({...twoFAForm, phoneNumber: e.target.value})}
                            placeholder="Enter phone number for SMS codes"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleEnable2FA}
                      disabled={enable2FAMutation.isPending}
                      className="bg-[#FFA500] hover:bg-[#FF8C00] text-white w-full"
                    >
                      {enable2FAMutation.isPending ? "Enabling..." : "Enable 2FA"}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                      <p className="text-sm text-green-800">
                        ✓ <strong>2FA is Enabled</strong> - Your account is protected with two-factor authentication
                      </p>
                    </div>

                    {backupCodes.length > 0 && showBackupCodes && (
                      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg space-y-3">
                        <p className="text-sm font-semibold text-yellow-800">Backup Codes</p>
                        <p className="text-xs text-yellow-700">
                          Save these backup codes in a safe place. Use them if you lose access to your 2FA device.
                        </p>
                        <div className="bg-white p-3 rounded border border-yellow-300 font-mono text-sm space-y-1 max-h-40 overflow-y-auto">
                          {backupCodes.map((code, idx) => (
                            <div key={idx}>{code}</div>
                          ))}
                        </div>
                        <Button
                          onClick={handleCopyBackupCodes}
                          variant="outline"
                          className="w-full text-sm"
                        >
                          Copy Backup Codes
                        </Button>
                      </div>
                    )}

                    <Button
                      onClick={handleDisable2FA}
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 w-full"
                    >
                      Disable 2FA
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Trusted Devices Tab */}
          {activeTab === "devices" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#0033A0]">Trusted Devices</CardTitle>
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
                            onClick={() => removeTrustedDeviceMutation.mutate({ deviceId: device.id })}
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

          {/* Danger Zone Tab */}
          {activeTab === "danger" && (
            <Card className="border-red-300 bg-red-50">
              <CardHeader>
                <CardTitle className="text-2xl text-red-800">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-red-100 border border-red-300 p-4 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Warning:</strong> Actions in this section are permanent and cannot be undone. Please proceed with caution.
                  </p>
                </div>

                <div className="space-y-4 border border-red-300 p-4 rounded-lg">
                  <h3 className="font-semibold text-red-800">Request Account Deletion</h3>
                  <p className="text-sm text-gray-700">
                    Permanently delete your account and all associated data. You will receive a confirmation email.
                  </p>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">Why are you leaving? (optional)</label>
                    <textarea
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="Your feedback helps us improve..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <Button
                    onClick={() => requestDeleteMutation.mutate({ reason: deleteReason })}
                    disabled={requestDeleteMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white w-full"
                  >
                    {requestDeleteMutation.isPending ? "Processing..." : "Request Account Deletion"}
                  </Button>
                </div>

                <div className="space-y-3 border border-gray-300 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-800">Log Out All Sessions</h3>
                  <p className="text-sm text-gray-700">
                    Immediately log out from all devices and sessions.
                  </p>
                  <Button
                    onClick={handleLogoutClick}
                    variant="outline"
                    className="border-gray-400 w-full"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Log Out From All Sessions
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity Log Tab */}
          {activeTab === "activity" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#0033A0]">Account Activity Log</CardTitle>
              </CardHeader>
              <CardContent>
                {getActivityLogQuery.isLoading ? (
                  <p className="text-gray-600">Loading activity log...</p>
                ) : getActivityLogQuery.data && getActivityLogQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {getActivityLogQuery.data.map((activity: any) => (
                      <div
                        key={activity.id}
                        className={`border rounded-lg p-4 ${
                          activity.suspicious
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-gray-800 capitalize">
                              {activity.activityType.replace(/_/g, " ")}
                            </p>
                            <p className="text-sm text-gray-600">{activity.description}</p>
                            {activity.ipAddress && (
                              <p className="text-xs text-gray-500 mt-1">IP: {activity.ipAddress}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">
                              {new Date(activity.createdAt).toLocaleDateString()} {new Date(activity.createdAt).toLocaleTimeString()}
                            </p>
                            {activity.suspicious && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Suspicious
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-8">No activity recorded yet</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#0033A0] to-[#003366] text-white py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
            <div>
              <h4 className="font-semibold mb-3">Need Help?</h4>
              <div className="space-y-2 text-sm text-white/80">
                <p>📞 <a href="tel:+19452121609" className="hover:text-[#FFA500] transition-colors">(945) 212-1609</a></p>
                <p>📧 <a href="mailto:support@amerilendloan.com" className="hover:text-[#FFA500] transition-colors">support@amerilendloan.com</a></p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="/" className="hover:text-[#FFA500] transition-colors">Home</a></li>
                <li><a href="/dashboard" className="hover:text-[#FFA500] transition-colors">Dashboard</a></li>
                <li><a href="/#faq" className="hover:text-[#FFA500] transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="/public/legal/privacy-policy" className="hover:text-[#FFA500] transition-colors">Privacy Policy</a></li>
                <li><a href="/public/legal/terms-of-service" className="hover:text-[#FFA500] transition-colors">Terms of Service</a></li>
                <li><a href="/public/legal/loan-agreement" className="hover:text-[#FFA500] transition-colors">Loan Agreement</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 pt-6 text-center text-xs text-white/70">
            <p>© 2025 AmeriLend, LLC. All Rights Reserved.</p>
            <p className="mt-2">Your trusted partner for consumer loans.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
