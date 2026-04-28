import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Search, Users, Shield, ShieldOff,
  UserCheck, Ban, LogOut, Key, Trash2, Edit,
  Eye, ChevronLeft, ChevronRight, Loader2, AlertTriangle,
  FileText, CreditCard, DollarSign, Clock, Activity,
  StickyNote, RefreshCw, Mail, Phone, MapPin,
  Calendar, Globe, Lock, Unlock, Snowflake
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { BANK_FREEZE_REASONS, LOAN_LOCK_REASONS } from "@shared/const";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-300",
  suspended: "bg-yellow-100 text-yellow-800 border-yellow-300",
  banned: "bg-red-100 text-red-800 border-red-300",
  deactivated: "bg-gray-100 text-gray-800 border-gray-300",
};

const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800 border-purple-300",
  user: "bg-blue-100 text-blue-800 border-blue-300",
};

export default function AdminUserManagement() {
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();

  // List state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Selected user state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Dialog state
  const [editDialog, setEditDialog] = useState(false);
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [banDialog, setBanDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [notesDialog, setNotesDialog] = useState(false);

  // Form state
  const [editForm, setEditForm] = useState<Record<string, string | number | undefined>>({});
  const [suspendReason, setSuspendReason] = useState("");
  const [banReason, setBanReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // Bank freeze state
  const [freezeBankDialog, setFreezeBankDialog] = useState<{ open: boolean; accountId: number | null; isFrozen: boolean }>({ open: false, accountId: null, isFrozen: false });
  const [freezeBankReason, setFreezeBankReason] = useState("");
  const [freezeBankCustomReason, setFreezeBankCustomReason] = useState("");

  // Loan lock state
  const [lockLoanDialog, setLockLoanDialog] = useState<{ open: boolean; loanId: number | null; isLocked: boolean }>({ open: false, loanId: null, isLocked: false });
  const [lockLoanReason, setLockLoanReason] = useState("");
  const [lockLoanCustomReason, setLockLoanCustomReason] = useState("");

  // Queries
  const usersQuery = trpc.admin.listAllUsers.useQuery({
    page,
    limit: 20,
    search: searchQuery || undefined,
    role: roleFilter !== "all" ? roleFilter : undefined,
    accountStatus: statusFilter !== "all" ? statusFilter : undefined,
    sortBy,
    sortOrder,
  }, {
    placeholderData: (prev) => prev,
  });

  const userProfileQuery = trpc.admin.getUserFullProfile.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );

  const userSessionsQuery = trpc.admin.getUserSessions.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId && activeTab === "sessions" }
  );

  const loginHistoryQuery = trpc.admin.getUserLoginHistory.useQuery(
    { userId: selectedUserId!, limit: 50 },
    { enabled: !!selectedUserId && activeTab === "activity" }
  );

  // Admin Banking Access queries
  const userBankAccountsQuery = trpc.adminBanking.getUserAccounts.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId && activeTab === "banking" }
  );

  const userTransactionsQuery = trpc.adminBanking.getUserTransactions.useQuery(
    { userId: selectedUserId!, limit: 50 },
    { enabled: !!selectedUserId && activeTab === "banking" }
  );

  // Saved cards query for auto-pay
  const savedCardsQuery = trpc.autoPay.adminGetUserSavedCards.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId && activeTab === "payments" }
  );

  // Manual charge state
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<{ id: number; cardBrand?: string; cardLast4?: string; isEnabled?: boolean; paymentDay?: number; loanApplicationId?: number } | null>(null);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");

  // Manual charge mutation
  const chargeSavedCardMutation = trpc.autoPay.adminChargeSavedCard.useMutation({
    onSuccess: (data) => {
      toast.success(`Payment of $${chargeAmount} processed successfully`, {
        description: `Transaction: ${(data as { data?: { transactionId?: string } }).data?.transactionId || 'N/A'}`
      });
      setChargeDialogOpen(false);
      setSelectedCard(null);
      setChargeAmount("");
      setChargeDescription("");
      utils.admin.getUserFullProfile.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to process payment"),
  });

  // Mobile deposit review state
  const [reviewingDepositId, setReviewingDepositId] = useState<number | null>(null);
  const [depositImages, setDepositImages] = useState<{ front: string | null; back: string | null } | null>(null);

  const depositImagesQuery = trpc.adminBanking.getMobileDepositImages.useQuery(
    { transactionId: reviewingDepositId! },
    { enabled: !!reviewingDepositId }
  );

  const reviewDepositMutation = trpc.adminBanking.reviewMobileDeposit.useMutation({
    onSuccess: (data) => {
      toast.success(`Deposit ${data.status === "completed" ? "approved" : "rejected"}`);
      setReviewingDepositId(null);
      setDepositImages(null);
      utils.adminBanking.getUserTransactions.invalidate();
      utils.adminBanking.getUserAccounts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Bank freeze mutation
  const freezeAccountMutation = trpc.adminBanking.freezeAccount.useMutation({
    onSuccess: (data) => {
      toast.success(`Bank account ${data.frozen ? "frozen" : "unfrozen"} successfully`);
      setFreezeBankDialog({ open: false, accountId: null, isFrozen: false });
      setFreezeBankReason("");
      setFreezeBankCustomReason("");
      utils.adminBanking.getUserAccounts.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to update account"),
  });

  // Loan lock mutation
  const lockLoanMutation = trpc.loans.adminLockLoan.useMutation({
    onSuccess: (data) => {
      toast.success(`Loan ${data.locked ? "locked" : "unlocked"} successfully`);
      setLockLoanDialog({ open: false, loanId: null, isLocked: false });
      setLockLoanReason("");
      setLockLoanCustomReason("");
      utils.admin.getUserFullProfile.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to update loan"),
  });

  // Mutations
  const utils = trpc.useUtils();

  const updateUserMutation = trpc.admin.updateUserFull.useMutation({
    onSuccess: () => {
      toast.success("User profile updated");
      setEditDialog(false);
      utils.admin.listAllUsers.invalidate();
      utils.admin.getUserFullProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const suspendMutation = trpc.admin.suspendUser.useMutation({
    onSuccess: () => {
      toast.success("User suspended");
      setSuspendDialog(false);
      setSuspendReason("");
      utils.admin.listAllUsers.invalidate();
      utils.admin.getUserFullProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const activateMutation = trpc.admin.activateUser.useMutation({
    onSuccess: () => {
      toast.success("User activated");
      utils.admin.listAllUsers.invalidate();
      utils.admin.getUserFullProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const banMutation = trpc.admin.banUser.useMutation({
    onSuccess: () => {
      toast.success("User banned");
      setBanDialog(false);
      setBanReason("");
      utils.admin.listAllUsers.invalidate();
      utils.admin.getUserFullProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivateMutation = trpc.admin.deactivateUser.useMutation({
    onSuccess: () => {
      toast.success("User deactivated");
      utils.admin.listAllUsers.invalidate();
      utils.admin.getUserFullProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const forceLogoutMutation = trpc.admin.forceLogout.useMutation({
    onSuccess: () => {
      toast.success("User sessions cleared");
      utils.admin.getUserSessions.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const forcePasswordResetMutation = trpc.admin.forcePasswordReset.useMutation({
    onSuccess: () => {
      toast.success("Password reset forced");
      utils.admin.getUserFullProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("User permanently deleted");
      setDeleteDialog(false);
      setSelectedUserId(null);
      utils.admin.listAllUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateNotesMutation = trpc.admin.updateAdminNotes.useMutation({
    onSuccess: () => {
      toast.success("Admin notes updated");
      setNotesDialog(false);
      utils.admin.getUserFullProfile.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleOpenEdit = (user: Record<string, unknown>) => {
    setEditForm({
      userId: user.id as number,
      name: (user.name as string) || "",
      email: (user.email as string) || "",
      firstName: (user.firstName as string) || "",
      lastName: (user.lastName as string) || "",
      phoneNumber: (user.phoneNumber as string) || "",
      dateOfBirth: (user.dateOfBirth as string) || "",
      street: (user.street as string) || "",
      city: (user.city as string) || "",
      state: (user.state as string) || "",
      zipCode: (user.zipCode as string) || "",
      role: (user.role as string),
      accountStatus: (user.accountStatus as string) || "active",
    });
    setEditDialog(true);
  };

  const handleSaveEdit = () => {
    updateUserMutation.mutate(editForm as { userId: number; [key: string]: string | number | boolean | undefined });
  };

  const profile = userProfileQuery.data;
  const usersData = usersQuery.data;

  // =====================
  // USER DETAIL VIEW
  // =====================
  if (selectedUserId && profile) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => setSelectedUserId(null)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Users
          </Button>
        </div>

        {/* User Header Card */}
        <Card className="mb-6 shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                  {(profile.name || profile.email || "?")[0]?.toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">
                    {profile.firstName && profile.lastName
                      ? `${profile.firstName} ${profile.lastName}`
                      : profile.name || "Unnamed User"}
                  </h1>
                  <p className="text-gray-500">{profile.email || "No email"}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge className={roleColors[profile.role] || ""}>{profile.role}</Badge>
                    <Badge className={statusColors[profile.accountStatus || "active"] || ""}>
                      {profile.accountStatus || "active"}
                    </Badge>
                    <Badge variant="outline">ID: {profile.id}</Badge>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleOpenEdit(profile)} className="gap-1">
                  <Edit className="w-3 h-3" /> Edit
                </Button>
                {(profile.accountStatus === "suspended" || profile.accountStatus === "banned" || profile.accountStatus === "deactivated") ? (
                  <Button size="sm" variant="outline" onClick={() => activateMutation.mutate({ userId: profile.id })} className="gap-1 text-green-600 hover:text-green-700">
                    <UserCheck className="w-3 h-3" /> Activate
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setSuspendDialog(true)} className="gap-1 text-yellow-600 hover:text-yellow-700">
                    <ShieldOff className="w-3 h-3" /> Suspend
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setBanDialog(true)} className="gap-1 text-red-600 hover:text-red-700">
                  <Ban className="w-3 h-3" /> Ban
                </Button>
                <Button size="sm" variant="outline" onClick={() => forceLogoutMutation.mutate({ userId: profile.id })} className="gap-1">
                  <LogOut className="w-3 h-3" /> Force Logout
                </Button>
                <Button size="sm" variant="outline" onClick={() => forcePasswordResetMutation.mutate({ userId: profile.id })} className="gap-1">
                  <Key className="w-3 h-3" /> Reset Password
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setAdminNotes(profile.adminNotes || ""); setNotesDialog(true); }} className="gap-1">
                  <StickyNote className="w-3 h-3" /> Notes
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteDialog(true)} className="gap-1">
                  <Trash2 className="w-3 h-3" /> Delete
                </Button>
              </div>
            </div>

            {/* Suspension/Ban info */}
            {profile.accountStatus === "suspended" && profile.suspendedReason && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">Suspended: {profile.suspendedReason}</p>
                <p className="text-xs text-yellow-600">
                  Since {profile.suspendedAt ? new Date(profile.suspendedAt).toLocaleDateString() : "Unknown"}
                </p>
              </div>
            )}
            {profile.accountStatus === "banned" && profile.bannedReason && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-800">Banned: {profile.bannedReason}</p>
                <p className="text-xs text-red-600">
                  Since {profile.bannedAt ? new Date(profile.bannedAt).toLocaleDateString() : "Unknown"}
                </p>
              </div>
            )}

            {/* Admin Notes */}
            {profile.adminNotes && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-medium text-blue-600 mb-1">Admin Notes</p>
                <p className="text-sm text-blue-800">{profile.adminNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="loans">Loans ({profile.loans?.length || 0})</TabsTrigger>
            <TabsTrigger value="payments">Payments ({profile.payments?.length || 0})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({profile.documents?.length || 0})</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="banking">Banking</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personal Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-4 h-4" /> Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Full Name" value={`${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.name || "Not set"} />
                  <InfoRow label="Email" value={profile.email || "Not set"} icon={<Mail className="w-3 h-3" />} />
                  <InfoRow label="Phone" value={profile.phoneNumber || "Not set"} icon={<Phone className="w-3 h-3" />} />
                  <InfoRow label="Date of Birth" value={profile.dateOfBirth || "Not set"} icon={<Calendar className="w-3 h-3" />} />
                  <InfoRow label="SSN" value={profile.ssn ? "***-**-" + profile.ssn.slice(-4) : "Not set"} icon={<Lock className="w-3 h-3" />} />
                  <InfoRow label="Language" value={profile.preferredLanguage || "en"} icon={<Globe className="w-3 h-3" />} />
                </CardContent>
              </Card>

              {/* Address Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Street" value={profile.street || "Not set"} />
                  <InfoRow label="City" value={profile.city || "Not set"} />
                  <InfoRow label="State" value={profile.state || "Not set"} />
                  <InfoRow label="Zip Code" value={profile.zipCode || "Not set"} />
                  <InfoRow label="Timezone" value={profile.timezone || "UTC"} />
                </CardContent>
              </Card>

              {/* Account Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Account Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="User ID" value={String(profile.id)} />
                  <InfoRow label="Open ID" value={profile.openId || "N/A"} />
                  <InfoRow label="Login Method" value={profile.loginMethod || "Not set"} />
                  <InfoRow label="Role" value={profile.role} />
                  <InfoRow label="Account Status" value={profile.accountStatus || "active"} />
                  <InfoRow label="2FA Enabled" value={profile.twoFactorEnabled ? "Yes" : "No"} />
                  <InfoRow label="2FA Method" value={profile.twoFactorMethod || "Not configured"} />
                  <InfoRow label="Password Set" value={profile.passwordHash ? "Yes" : "No"} />
                  <InfoRow label="Force Reset" value={profile.forcePasswordReset ? "Yes" : "No"} />
                  <InfoRow label="Login Count" value={String(profile.loginCount || 0)} />
                  <InfoRow label="Last Login IP" value={profile.lastLoginIp || "Unknown"} />
                </CardContent>
              </Card>

              {/* Timestamps */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Timestamps
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Registered" value={new Date(profile.createdAt).toLocaleString()} />
                  <InfoRow label="Last Updated" value={new Date(profile.updatedAt).toLocaleString()} />
                  <InfoRow label="Last Signed In" value={new Date(profile.lastSignedIn).toLocaleString()} />
                </CardContent>
              </Card>

              {/* Bank Info */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Bank Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <InfoRow label="Account Holder" value={profile.bankAccountHolderName || "Not set"} />
                  <InfoRow label="Account Number" value={profile.bankAccountNumber ? "****" + profile.bankAccountNumber.slice(-4) : "Not set"} />
                  <InfoRow label="Routing Number" value={profile.bankRoutingNumber ? "****" + profile.bankRoutingNumber.slice(-4) : "Not set"} />
                  <InfoRow label="Account Type" value={profile.bankAccountType || "Not set"} />
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <StatBox label="Loans" value={profile.loans?.length || 0} icon={<FileText className="w-4 h-4" />} />
                    <StatBox label="Payments" value={profile.payments?.length || 0} icon={<CreditCard className="w-4 h-4" />} />
                    <StatBox label="Disbursements" value={profile.disbursements?.length || 0} icon={<DollarSign className="w-4 h-4" />} />
                    <StatBox label="Documents" value={profile.documents?.length || 0} icon={<FileText className="w-4 h-4" />} />
                    <StatBox label="Tickets" value={profile.supportTickets?.length || 0} icon={<AlertTriangle className="w-4 h-4" />} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Loans Tab */}
          <TabsContent value="loans">
            <Card>
              <CardHeader><CardTitle>Loan Applications</CardTitle></CardHeader>
              <CardContent>
                {!profile.loans?.length ? (
                  <p className="text-gray-500 text-center py-8">No loan applications</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-3">ID</th>
                          <th className="text-left p-3">Amount</th>
                          <th className="text-left p-3">Status</th>
                          <th className="text-left p-3">Type</th>
                          <th className="text-left p-3">Created</th>
                          <th className="text-right p-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.loans.map((loan) => (
                          <tr key={loan.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">{loan.id}</td>
                            <td className="p-3">${Number(loan.requestedAmount || 0).toLocaleString()}</td>
                            <td className="p-3">
                              <Badge variant="outline">{loan.status}</Badge>
                              {loan.isLocked && (
                                <div>
                                  <Badge className="ml-1 bg-red-100 text-red-800 border-red-300">
                                    <Lock className="w-3 h-3 mr-1" /> Locked
                                  </Badge>
                                  {loan.lockedReason && (
                                    <p className="text-xs text-red-500 mt-1" title={loan.lockedReason}>
                                      {loan.lockedReason.length > 25 ? loan.lockedReason.slice(0, 25) + "..." : loan.lockedReason}
                                    </p>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-3">{loan.loanType || "N/A"}</td>
                            <td className="p-3">{new Date(loan.createdAt).toLocaleDateString()}</td>
                            <td className="p-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLockLoanDialog({ open: true, loanId: loan.id, isLocked: !!loan.isLocked })}
                                className={loan.isLocked ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700"}
                                title={loan.isLocked ? "Unlock Loan" : "Lock Loan"}
                              >
                                {loan.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            {/* Saved Cards Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Saved Payment Methods
                </CardTitle>
                <CardDescription>Cards saved for auto-pay - click to charge manually</CardDescription>
              </CardHeader>
              <CardContent>
                {savedCardsQuery.isLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : !savedCardsQuery.data?.length ? (
                  <p className="text-gray-500 text-center py-4">No saved cards</p>
                ) : (
                  <div className="grid gap-3">
                    {savedCardsQuery.data.map((card) => (
                      <div
                        key={card.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-8 h-8 text-blue-600" />
                          <div>
                            <p className="font-medium">
                              {card.cardBrand || "Card"} •••• {card.cardLast4}
                            </p>
                            <p className="text-sm text-gray-500">
                              Auto-pay: {card.isEnabled ? "Enabled" : "Disabled"} | Day {card.paymentDay}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedCard(card);
                            setChargeDialogOpen(true);
                          }}
                        >
                          <DollarSign className="w-4 h-4 mr-1" /> Charge
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
              <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
              <CardContent>
                {!profile.payments?.length ? (
                  <p className="text-gray-500 text-center py-8">No payments</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-3">ID</th>
                          <th className="text-left p-3">Amount</th>
                          <th className="text-left p-3">Method</th>
                          <th className="text-left p-3">Status</th>
                          <th className="text-left p-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.payments.map((payment) => (
                          <tr key={payment.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">{payment.id}</td>
                            <td className="p-3">${Number(payment.amount || 0).toLocaleString()}</td>
                            <td className="p-3">{payment.paymentMethod || "N/A"}</td>
                            <td className="p-3"><Badge variant="outline">{payment.status}</Badge></td>
                            <td className="p-3">{new Date(payment.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card>
              <CardHeader><CardTitle>Verification Documents</CardTitle></CardHeader>
              <CardContent>
                {!profile.documents?.length ? (
                  <p className="text-gray-500 text-center py-8">No documents</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-3">ID</th>
                          <th className="text-left p-3">Type</th>
                          <th className="text-left p-3">File</th>
                          <th className="text-left p-3">Status</th>
                          <th className="text-left p-3">Uploaded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.documents.map((doc) => (
                          <tr key={doc.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">{doc.id}</td>
                            <td className="p-3">{doc.documentType}</td>
                            <td className="p-3">{doc.fileName || "N/A"}</td>
                            <td className="p-3"><Badge variant="outline">{doc.status}</Badge></td>
                            <td className="p-3">{new Date(doc.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>Currently active login sessions for this user</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => forceLogoutMutation.mutate({ userId: profile.id })}
                  disabled={forceLogoutMutation.isPending}
                  className="gap-1"
                >
                  <LogOut className="w-3 h-3" /> Clear All Sessions
                </Button>
              </CardHeader>
              <CardContent>
                {userSessionsQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                ) : !userSessionsQuery.data?.length ? (
                  <p className="text-gray-500 text-center py-8">No active sessions</p>
                ) : (
                  <div className="space-y-3">
                    {userSessionsQuery.data.map((session) => (
                      <div key={session.id} className="p-4 bg-gray-50 rounded-lg border">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium">IP: {session.ipAddress || "Unknown"}</p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{session.userAgent || "Unknown device"}</p>
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <p>Last active: {new Date(session.lastActivityAt).toLocaleString()}</p>
                            <p>Expires: {new Date(session.expiresAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Login History</CardTitle>
                <CardDescription>Recent login attempts for this user</CardDescription>
              </CardHeader>
              <CardContent>
                {loginHistoryQuery.isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                ) : !loginHistoryQuery.data?.length ? (
                  <p className="text-gray-500 text-center py-8">No login history</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">IP Address</th>
                          <th className="text-left p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loginHistoryQuery.data.map((attempt) => (
                          <tr key={attempt.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">{new Date(attempt.createdAt).toLocaleString()}</td>
                            <td className="p-3">{attempt.ipAddress}</td>
                            <td className="p-3">
                              <Badge className={attempt.successful ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                {attempt.successful ? "Success" : "Failed"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Banking Tab */}
          <TabsContent value="banking">
            <div className="space-y-6">
              {/* User Bank Accounts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" /> Bank Accounts</CardTitle>
                  <CardDescription>All bank accounts linked to this user</CardDescription>
                </CardHeader>
                <CardContent>
                  {userBankAccountsQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                  ) : !userBankAccountsQuery.data?.length ? (
                    <p className="text-gray-500 text-center py-8">No bank accounts found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-3">Bank</th>
                            <th className="text-left p-3">Type</th>
                            <th className="text-left p-3">Holder</th>
                            <th className="text-left p-3">Account</th>
                            <th className="text-right p-3">Balance</th>
                            <th className="text-right p-3">Available</th>
                            <th className="text-left p-3">Status</th>
                            <th className="text-right p-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userBankAccountsQuery.data.map((acc) => (
                            <tr key={acc.id} className="border-b hover:bg-gray-50">
                              <td className="p-3 font-medium">{acc.bankName}</td>
                              <td className="p-3 capitalize">{acc.accountType}</td>
                              <td className="p-3">{acc.accountHolderName}</td>
                              <td className="p-3 font-mono">····{acc.accountNumberLast4}</td>
                              <td className="p-3 text-right font-medium">${((acc.balance || 0) / 100).toFixed(2)}</td>
                              <td className="p-3 text-right">${((acc.availableBalance || 0) / 100).toFixed(2)}</td>
                              <td className="p-3">
                                {acc.isFrozen ? (
                                  <div>
                                    <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                      <Snowflake className="w-3 h-3 mr-1" /> Frozen
                                    </Badge>
                                    {acc.frozenReason && (
                                      <p className="text-xs text-blue-600 mt-1" title={acc.frozenReason}>
                                        {acc.frozenReason.length > 25 ? acc.frozenReason.slice(0, 25) + "..." : acc.frozenReason}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    <Badge className={acc.isVerified ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                                      {acc.isVerified ? "Verified" : "Unverified"}
                                    </Badge>
                                    {acc.isPrimary && <Badge className="ml-1 bg-blue-100 text-blue-800">Primary</Badge>}
                                  </>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setFreezeBankDialog({ open: true, accountId: acc.id, isFrozen: !!acc.isFrozen })}
                                  className={acc.isFrozen ? "text-green-600 hover:text-green-700" : "text-blue-600 hover:text-blue-700"}
                                  title={acc.isFrozen ? "Unfreeze Account" : "Freeze Account"}
                                >
                                  <Snowflake className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> Recent Transactions</CardTitle>
                  <CardDescription>Banking transaction history for this user</CardDescription>
                </CardHeader>
                <CardContent>
                  {userTransactionsQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                  ) : !userTransactionsQuery.data?.transactions?.length ? (
                    <p className="text-gray-500 text-center py-8">No transactions found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-3">Date</th>
                            <th className="text-left p-3">Type</th>
                            <th className="text-left p-3">Description</th>
                            <th className="text-right p-3">Amount</th>
                            <th className="text-left p-3">Status</th>
                            <th className="text-left p-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userTransactionsQuery.data.transactions.map((tx) => (
                            <tr key={tx.id} className="border-b hover:bg-gray-50">
                              <td className="p-3 whitespace-nowrap">{new Date(tx.createdAt).toLocaleDateString()}</td>
                              <td className="p-3 capitalize">{tx.type?.replace(/_/g, " ")}</td>
                              <td className="p-3 max-w-xs truncate" title={tx.description}>{tx.description}</td>
                              <td className={`p-3 text-right font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {tx.amount >= 0 ? "+" : ""}${(Math.abs(tx.amount) / 100).toFixed(2)}
                              </td>
                              <td className="p-3">
                                <Badge className={
                                  tx.status === "completed" ? "bg-green-100 text-green-800" :
                                  tx.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                                  tx.status === "failed" ? "bg-red-100 text-red-800" :
                                  "bg-gray-100 text-gray-800"
                                }>
                                  {tx.status}
                                </Badge>
                              </td>
                              <td className="p-3">
                                {tx.type === "mobile_deposit" && tx.status === "pending" && (
                                  <Button size="sm" variant="outline" onClick={() => setReviewingDepositId(tx.id)}>
                                    <Eye className="w-3 h-3 mr-1" /> Review
                                  </Button>
                                )}
                                {tx.type === "mobile_deposit" && tx.checkImageFront && tx.status !== "pending" && (
                                  <Button size="sm" variant="ghost" onClick={() => setReviewingDepositId(tx.id)}>
                                    <Eye className="w-3 h-3 mr-1" /> Images
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-xs text-gray-400 mt-2">Showing {userTransactionsQuery.data.transactions.length} of {userTransactionsQuery.data.total} transactions</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Mobile Deposit Review Dialog */}
        <Dialog open={!!reviewingDepositId} onOpenChange={(open) => { if (!open) { setReviewingDepositId(null); setDepositImages(null); } }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Mobile Deposit Review</DialogTitle>
              <DialogDescription>Review check images and approve or reject this deposit</DialogDescription>
            </DialogHeader>
            {depositImagesQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
            ) : depositImagesQuery.data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Amount</p>
                    <p className="text-2xl font-bold text-green-600">${((depositImagesQuery.data.amount || 0) / 100).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Reference</p>
                    <p className="font-mono text-sm">{depositImagesQuery.data.referenceNumber}</p>
                    {depositImagesQuery.data.checkNumber && <p className="text-sm text-gray-500">Check #{depositImagesQuery.data.checkNumber}</p>}
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-amber-800 text-sm font-medium">Endorsement Required: "For Mobile Deposit Only at AmeriLendLoan"</p>
                  <p className="text-amber-600 text-xs mt-1">Verify the back of the check has the correct endorsement before approving.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Front of Check</p>
                    {depositImagesQuery.data.checkImageFront ? (
                      <img src={depositImagesQuery.data.checkImageFront} alt="Check front" className="w-full rounded-lg border shadow-sm" />
                    ) : (
                      <div className="w-full h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">No image</div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Back of Check</p>
                    {depositImagesQuery.data.checkImageBack ? (
                      <img src={depositImagesQuery.data.checkImageBack} alt="Check back" className="w-full rounded-lg border shadow-sm" />
                    ) : (
                      <div className="w-full h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">No image</div>
                    )}
                  </div>
                </div>
                {depositImagesQuery.data.status === "pending" && (
                  <DialogFooter className="flex gap-2">
                    <Button variant="destructive" disabled={reviewDepositMutation.isPending}
                      onClick={() => reviewDepositMutation.mutate({ transactionId: reviewingDepositId!, approved: false, adminNotes: "Check endorsement or image quality insufficient" })}>
                      Reject Deposit
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700" disabled={reviewDepositMutation.isPending}
                      onClick={() => reviewDepositMutation.mutate({ transactionId: reviewingDepositId!, approved: true })}>
                      Approve Deposit
                    </Button>
                  </DialogFooter>
                )}
                {depositImagesQuery.data.status !== "pending" && (
                  <div className="text-center py-2">
                    <Badge className={depositImagesQuery.data.status === "completed" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {depositImagesQuery.data.status === "completed" ? "Approved" : "Rejected"}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Failed to load deposit details</p>
            )}
          </DialogContent>
        </Dialog>

        {/* DIALOGS */}

        {/* Edit User Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit User Profile</DialogTitle>
              <DialogDescription>Modify all user account details</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Display Name</Label>
                <Input value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <Label>First Name</Label>
                <Input value={editForm.firstName || ""} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={editForm.lastName || ""} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input value={editForm.phoneNumber || ""} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input type="date" value={editForm.dateOfBirth || ""} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Street Address</Label>
                <Input value={editForm.street || ""} onChange={(e) => setEditForm({ ...editForm, street: e.target.value })} />
              </div>
              <div>
                <Label>City</Label>
                <Input value={editForm.city || ""} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
              </div>
              <div>
                <Label>State</Label>
                <Input value={editForm.state || ""} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} maxLength={2} />
              </div>
              <div>
                <Label>Zip Code</Label>
                <Input value={editForm.zipCode || ""} onChange={(e) => setEditForm({ ...editForm, zipCode: e.target.value })} />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={String(editForm.role || "user")} onValueChange={(val) => setEditForm({ ...editForm, role: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Account Status</Label>
                <Select value={String(editForm.accountStatus || "active")} onValueChange={(val) => setEditForm({ ...editForm, accountStatus: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                    <SelectItem value="deactivated">Deactivated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Suspend Dialog */}
        <Dialog open={suspendDialog} onOpenChange={setSuspendDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-yellow-600">
                <ShieldOff className="w-5 h-5" /> Suspend User
              </DialogTitle>
              <DialogDescription>This will suspend the user's account and force logout all sessions.</DialogDescription>
            </DialogHeader>
            <div>
              <Label>Suspension Reason *</Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Enter reason for suspension"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuspendDialog(false)}>Cancel</Button>
              <Button
                onClick={() => suspendMutation.mutate({ userId: profile.id, reason: suspendReason })}
                disabled={!suspendReason.trim() || suspendMutation.isPending}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                {suspendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Suspend User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ban Dialog */}
        <Dialog open={banDialog} onOpenChange={setBanDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Ban className="w-5 h-5" /> Ban User
              </DialogTitle>
              <DialogDescription>This will permanently ban the user's account. This action should be reserved for serious violations.</DialogDescription>
            </DialogHeader>
            <div>
              <Label>Ban Reason *</Label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter reason for ban"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBanDialog(false)}>Cancel</Button>
              <Button
                onClick={() => banMutation.mutate({ userId: profile.id, reason: banReason })}
                disabled={!banReason.trim() || banMutation.isPending}
                variant="destructive"
              >
                {banMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Ban User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" /> Delete User Permanently
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone. All user data including loans, payments, documents, and sessions will be permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">Are you sure you want to delete:</p>
              <p className="text-sm text-red-700 mt-1">{profile.name || profile.email} (ID: {profile.id})</p>
              <p className="text-xs text-red-600 mt-2">This will delete {profile.loans?.length || 0} loans, {profile.payments?.length || 0} payments, and all related records.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog(false)}>Cancel</Button>
              <Button
                onClick={() => deleteUserMutation.mutate({ userId: profile.id })}
                disabled={deleteUserMutation.isPending}
                variant="destructive"
              >
                {deleteUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Permanently Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Admin Notes Dialog */}
        <Dialog open={notesDialog} onOpenChange={setNotesDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <StickyNote className="w-5 h-5" /> Admin Notes
              </DialogTitle>
              <DialogDescription>Internal notes visible only to administrators</DialogDescription>
            </DialogHeader>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add internal admin notes about this user..."
                rows={5}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesDialog(false)}>Cancel</Button>
              <Button
                onClick={() => updateNotesMutation.mutate({ userId: profile.id, notes: adminNotes })}
                disabled={updateNotesMutation.isPending}
              >
                {updateNotesMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Notes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Charge Dialog */}
        <Dialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Charge Saved Card
              </DialogTitle>
              <DialogDescription>
                Manually charge {profile.firstName || "user"}'s saved card
              </DialogDescription>
            </DialogHeader>
            {selectedCard && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium">
                    {selectedCard.cardBrand || "Card"} •••• {selectedCard.cardLast4}
                  </p>
                  <p className="text-sm text-gray-500">
                    Loan Application ID: {selectedCard.loanApplicationId || "N/A"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Amount (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0.50"
                      placeholder="0.00"
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    placeholder="Reason for charge..."
                    value={chargeDescription}
                    onChange={(e) => setChargeDescription(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setChargeDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!chargeAmount || parseFloat(chargeAmount) < 0.50) {
                    toast.error("Minimum charge amount is $0.50");
                    return;
                  }
                  chargeSavedCardMutation.mutate({
                    autoPaySettingId: selectedCard!.id,
                    amountCents: Math.round(parseFloat(chargeAmount) * 100),
                    description: chargeDescription || undefined,
                  });
                }}
                disabled={chargeSavedCardMutation.isPending || !chargeAmount}
              >
                {chargeSavedCardMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="mr-2 h-4 w-4" />
                )}
                Charge ${chargeAmount || "0.00"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Loading state for user detail
  if (selectedUserId && userProfileQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // =====================
  // USERS LIST VIEW
  // =====================
  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setLocation("/admin")} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-500">Complete control over all user accounts</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="w-4 h-4" />
          {usersData?.totalCount || 0} total users
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
                <SelectItem value="deactivated">Deactivated</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => usersQuery.refetch()}>
              <RefreshCw className={`w-4 h-4 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {usersQuery.isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : !usersData?.users?.length ? (
            <div className="text-center py-16 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">No users found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-4 font-medium text-gray-600">User</th>
                      <th className="text-left p-4 font-medium text-gray-600">Email</th>
                      <th className="text-left p-4 font-medium text-gray-600">Role</th>
                      <th className="text-left p-4 font-medium text-gray-600">Status</th>
                      <th className="text-left p-4 font-medium text-gray-600">Last Active</th>
                      <th className="text-left p-4 font-medium text-gray-600">Registered</th>
                      <th className="text-right p-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersData.users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                              {(user.name || user.email || "?")[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {user.firstName && user.lastName
                                  ? `${user.firstName} ${user.lastName}`
                                  : user.name || "Unnamed"}
                              </p>
                              <p className="text-xs text-gray-500">ID: {user.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-gray-600">{user.email || "—"}</td>
                        <td className="p-4">
                          <Badge className={`${roleColors[user.role]} text-xs`}>{user.role}</Badge>
                        </td>
                        <td className="p-4">
                          <Badge className={`${statusColors[user.accountStatus || "active"]} text-xs`}>
                            {user.accountStatus || "active"}
                          </Badge>
                        </td>
                        <td className="p-4 text-gray-500 text-xs">
                          {new Date(user.lastSignedIn).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-gray-500 text-xs">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setSelectedUserId(user.id); setActiveTab("overview"); }}
                              className="gap-1 h-8"
                            >
                              <Eye className="w-3 h-3" /> View
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEdit(user)}
                              className="gap-1 h-8"
                            >
                              <Edit className="w-3 h-3" /> Edit
                            </Button>
                            {(user.accountStatus === "suspended" || user.accountStatus === "banned" || user.accountStatus === "deactivated") ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => activateMutation.mutate({ userId: user.id })}
                                className="gap-1 h-8 text-green-600 hover:text-green-700"
                              >
                                <Unlock className="w-3 h-3" /> Activate
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setSelectedUserId(user.id); setSuspendDialog(true); }}
                                className="gap-1 h-8 text-yellow-600 hover:text-yellow-700"
                              >
                                <Lock className="w-3 h-3" /> Suspend
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {usersData.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-gray-500">
                    Page {usersData.page} of {usersData.totalPages} ({usersData.totalCount} users)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => Math.min(usersData.totalPages, p + 1))}
                      disabled={page >= usersData.totalPages}
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog (for list view quick edit) */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>Modify all user account details</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Display Name</Label>
              <Input value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <Label>First Name</Label>
              <Input value={editForm.firstName || ""} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input value={editForm.lastName || ""} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input value={editForm.phoneNumber || ""} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input type="date" value={editForm.dateOfBirth || ""} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Street Address</Label>
              <Input value={editForm.street || ""} onChange={(e) => setEditForm({ ...editForm, street: e.target.value })} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={editForm.city || ""} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
            </div>
            <div>
              <Label>State</Label>
              <Input value={editForm.state || ""} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} maxLength={2} />
            </div>
            <div>
              <Label>Zip Code</Label>
              <Input value={editForm.zipCode || ""} onChange={(e) => setEditForm({ ...editForm, zipCode: e.target.value })} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={String(editForm.role || "user")} onValueChange={(val) => setEditForm({ ...editForm, role: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account Status</Label>
              <Select value={String(editForm.accountStatus || "active")} onValueChange={(val) => setEditForm({ ...editForm, accountStatus: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="banned">Banned</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Freeze/Unfreeze Bank Account Dialog */}
      <Dialog open={freezeBankDialog.open} onOpenChange={(open) => { setFreezeBankDialog({ open, accountId: open ? freezeBankDialog.accountId : null, isFrozen: open ? freezeBankDialog.isFrozen : false }); if (!open) { setFreezeBankReason(""); setFreezeBankCustomReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${freezeBankDialog.isFrozen ? "text-green-600" : "text-blue-600"}`}>
              <Snowflake className="w-5 h-5" /> {freezeBankDialog.isFrozen ? "Unfreeze Bank Account" : "Freeze Bank Account"}
            </DialogTitle>
            <DialogDescription>
              {freezeBankDialog.isFrozen
                ? "This will restore the bank account. The user will be notified by email."
                : "This will freeze the bank account immediately. All transfers, bill payments, and deposits will be blocked. The user will be notified by email."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason</Label>
              <Select value={freezeBankReason} onValueChange={setFreezeBankReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {BANK_FREEZE_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {freezeBankReason === "Other (specify below)" && (
              <div>
                <Label>Custom Reason</Label>
                <Textarea
                  placeholder="Enter the reason..."
                  value={freezeBankCustomReason}
                  onChange={(e) => setFreezeBankCustomReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFreezeBankDialog({ open: false, accountId: null, isFrozen: false }); setFreezeBankReason(""); setFreezeBankCustomReason(""); }}>Cancel</Button>
            <Button
              variant={freezeBankDialog.isFrozen ? "default" : "destructive"}
              onClick={() => {
                if (!freezeBankDialog.accountId) return;
                const reason = freezeBankReason === "Other (specify below)" ? freezeBankCustomReason : freezeBankReason;
                if (!reason) { toast.error("Please select or enter a reason"); return; }
                freezeAccountMutation.mutate({ accountId: freezeBankDialog.accountId, freeze: !freezeBankDialog.isFrozen, reason });
              }}
              disabled={freezeAccountMutation.isPending}
            >
              {freezeAccountMutation.isPending ? "Processing..." : freezeBankDialog.isFrozen ? "Unfreeze" : "Freeze Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock/Unlock Loan Dialog */}
      <Dialog open={lockLoanDialog.open} onOpenChange={(open) => { setLockLoanDialog({ open, loanId: open ? lockLoanDialog.loanId : null, isLocked: open ? lockLoanDialog.isLocked : false }); if (!open) { setLockLoanReason(""); setLockLoanCustomReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${lockLoanDialog.isLocked ? "text-green-600" : "text-orange-600"}`}>
              {lockLoanDialog.isLocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              {lockLoanDialog.isLocked ? "Unlock Loan Application" : "Lock Loan Application"}
            </DialogTitle>
            <DialogDescription>
              {lockLoanDialog.isLocked
                ? "This will unlock the loan application and allow it to proceed. The user will be notified by email."
                : "This will lock the loan application. It cannot be approved or processed while locked. The user will be notified by email."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason</Label>
              <Select value={lockLoanReason} onValueChange={setLockLoanReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {LOAN_LOCK_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lockLoanReason === "Other (specify below)" && (
              <div>
                <Label>Custom Reason</Label>
                <Textarea
                  placeholder="Enter the reason..."
                  value={lockLoanCustomReason}
                  onChange={(e) => setLockLoanCustomReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLockLoanDialog({ open: false, loanId: null, isLocked: false }); setLockLoanReason(""); setLockLoanCustomReason(""); }}>Cancel</Button>
            <Button
              variant={lockLoanDialog.isLocked ? "default" : "destructive"}
              onClick={() => {
                if (!lockLoanDialog.loanId) return;
                const reason = lockLoanReason === "Other (specify below)" ? lockLoanCustomReason : lockLoanReason;
                if (!reason) { toast.error("Please select or enter a reason"); return; }
                lockLoanMutation.mutate({ loanId: lockLoanDialog.loanId, lock: !lockLoanDialog.isLocked, reason });
              }}
              disabled={lockLoanMutation.isPending}
            >
              {lockLoanMutation.isPending ? "Processing..." : lockLoanDialog.isLocked ? "Unlock Loan" : "Lock Loan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper Components
function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-500 flex items-center gap-1">{icon}{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <div className="flex justify-center mb-1 text-gray-500">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
