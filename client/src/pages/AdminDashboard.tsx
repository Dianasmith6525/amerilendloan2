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
import { APP_LOGO, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Loader2, Settings, DollarSign, CheckCircle, XCircle, Send, LogOut, Users, FileText, BarChart3, Package, TrendingUp, Clock, AlertCircle, Eye, MessageSquare, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import VerificationDocumentsAdmin from "@/components/VerificationDocumentsAdmin";
import CryptoWalletSettings from "@/components/CryptoWalletSettings";
import AdminAnalyticsDashboard from "@/components/AdminAnalyticsDashboard";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  under_review: "bg-blue-100 text-blue-800 border-blue-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  fee_pending: "bg-orange-100 text-orange-800 border-orange-300",
  fee_paid: "bg-emerald-100 text-emerald-800 border-emerald-300",
  disbursed: "bg-purple-100 text-purple-800 border-purple-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  cancelled: "bg-gray-100 text-gray-800 border-gray-300",
};

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();

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

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Don't render if not admin
  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const utils = trpc.useUtils();

  // Dialog states for loan management
  const [approvalDialog, setApprovalDialog] = useState<{ open: boolean; applicationId: number | null }>({
    open: false,
    applicationId: null,
  });
  const [approvalAmount, setApprovalAmount] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");

  const [rejectionDialog, setRejectionDialog] = useState<{ open: boolean; applicationId: number | null }>({
    open: false,
    applicationId: null,
  });
  const [rejectionReason, setRejectionReason] = useState("");

  const [disbursementDialog, setDisbursementDialog] = useState<{ open: boolean; applicationId: number | null }>({
    open: false,
    applicationId: null,
  });
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [disbursementNotes, setDisbursementNotes] = useState("");

  // Tracking dialog state
  const [trackingDialog, setTrackingDialog] = useState<{ open: boolean; disbursementId: number | null }>({
    open: false,
    disbursementId: null,
  });
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCompany, setTrackingCompany] = useState<"USPS" | "UPS" | "FedEx" | "DHL" | "Other">("USPS");

  // Fee verification dialog state
  const [feeVerificationDialog, setFeeVerificationDialog] = useState<{ open: boolean; applicationId: number | null }>({
    open: false,
    applicationId: null,
  });
  const [feeVerificationNotes, setFeeVerificationNotes] = useState("");

  // Fee configuration states
  const [feeMode, setFeeMode] = useState<"percentage" | "fixed">("percentage");
  const [percentageRate, setPercentageRate] = useState("2.00");
  const [fixedFeeAmount, setFixedFeeAmount] = useState("2.00");

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApps, setSelectedApps] = useState<number[]>([]);
  
  // Support ticket states
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string | undefined>(undefined);
  const [ticketReplyMessage, setTicketReplyMessage] = useState("");

  // Query data
  const { data: applications, isLoading } = trpc.loans.adminList.useQuery();
  const { data: disbursements, isLoading: disbursementsLoading } = trpc.disbursements.adminList.useQuery();
  const { data: stats, isLoading: statsLoading } = trpc.loans.adminStatistics.useQuery();
  const { data: feeConfig } = trpc.feeConfig.getActive.useQuery();
  
  // Support tickets data
  const { data: ticketsData, refetch: refetchTickets, isLoading: ticketsLoading } = trpc.supportTickets.adminGetAll.useQuery({
    status: ticketStatusFilter,
  });
  const tickets = ticketsData?.data || [];
  
  const { data: ticketMessagesData, refetch: refetchTicketMessages } = trpc.supportTickets.getMessages.useQuery(
    { ticketId: selectedTicket || 0 },
    { enabled: !!selectedTicket }
  );
  const ticketMessages = ticketMessagesData?.data || [];

  // Load fee configuration when it becomes available
  useEffect(() => {
    if (feeConfig) {
      setFeeMode(feeConfig.calculationMode);
      setPercentageRate((feeConfig.percentageRate / 100).toFixed(2));
      setFixedFeeAmount((feeConfig.fixedFeeAmount / 100).toFixed(2));
    }
  }, [feeConfig]);

  // Mutations
  const approveMutation = trpc.loans.adminApprove.useMutation({
    onSuccess: () => {
      toast.success("Loan approved successfully");
      utils.loans.adminList.invalidate();
      setApprovalDialog({ open: false, applicationId: null });
      setApprovalAmount("");
      setApprovalNotes("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve loan");
    },
  });

  const rejectMutation = trpc.loans.adminReject.useMutation({
    onSuccess: () => {
      toast.success("Loan rejected successfully");
      utils.loans.adminList.invalidate();
      setRejectionDialog({ open: false, applicationId: null });
      setRejectionReason("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject loan");
    },
  });

  const disburseMutation = trpc.disbursements.adminInitiate.useMutation({
    onSuccess: () => {
      toast.success("Disbursement initiated successfully");
      utils.loans.adminList.invalidate();
      setDisbursementDialog({ open: false, applicationId: null });
      setAccountHolderName("");
      setAccountNumber("");
      setRoutingNumber("");
      setDisbursementNotes("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to initiate disbursement");
    },
  });

  const trackingMutation = trpc.disbursements.adminUpdateTracking.useMutation({
    onSuccess: () => {
      toast.success("Check tracking information updated successfully");
      utils.disbursements.adminList.invalidate();
      setTrackingDialog({ open: false, disbursementId: null });
      setTrackingNumber("");
      setTrackingCompany("USPS");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update tracking information");
    },
  });

  const updateFeeConfigMutation = trpc.feeConfig.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("Fee configuration updated successfully");
      utils.feeConfig.getActive.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update fee configuration");
    },
  });

  const verifyFeePaymentMutation = trpc.loans.adminVerifyFeePayment.useMutation({
    onSuccess: () => {
      toast.success("Fee payment verification updated");
      utils.loans.adminList.invalidate();
      setFeeVerificationDialog({ open: false, applicationId: null });
      setFeeVerificationNotes("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to verify fee payment");
    },
  });

  const replyToTicketMutation = trpc.supportTickets.addMessage.useMutation({
    onSuccess: () => {
      toast.success("Reply sent successfully");
      setTicketReplyMessage("");
      refetchTickets();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send reply");
    },
  });

  const updateTicketStatusMutation = trpc.supportTickets.adminUpdateStatus.useMutation({
    onSuccess: () => {
      toast.success("Ticket status updated");
      refetchTickets();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update ticket status");
    },
  });

  const assignTicketMutation = trpc.supportTickets.adminAssign.useMutation({
    onSuccess: () => {
      toast.success("Ticket assigned successfully");
      refetchTickets();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to assign ticket");
    },
  });

  // Handlers
  const handleApprove = () => {
    if (!approvalDialog.applicationId) return;
    const amount = parseFloat(approvalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid approval amount");
      return;
    }
    approveMutation.mutate({
      id: approvalDialog.applicationId,
      approvedAmount: Math.round(amount * 100),
      adminNotes: approvalNotes || undefined,
    });
  };

  const handleReject = () => {
    if (!rejectionDialog.applicationId || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    rejectMutation.mutate({
      id: rejectionDialog.applicationId,
      rejectionReason,
    });
  };

  const handleDisburse = () => {
    if (!disbursementDialog.applicationId) return;
    if (!accountHolderName || !accountNumber || !routingNumber) {
      toast.error("Please fill in all bank account details");
      return;
    }
    disburseMutation.mutate({
      loanApplicationId: disbursementDialog.applicationId,
      accountHolderName,
      accountNumber,
      routingNumber,
      adminNotes: disbursementNotes || undefined,
    });
  };

  const handleUpdateTracking = () => {
    if (!trackingDialog.disbursementId || !trackingNumber.trim()) {
      toast.error("Please enter a tracking number");
      return;
    }
    trackingMutation.mutate({
      disbursementId: trackingDialog.disbursementId,
      trackingNumber,
      trackingCompany,
    });
  };

  const handleUpdateFeeConfig = () => {
    if (feeMode === "percentage") {
      const rate = parseFloat(percentageRate);
      if (isNaN(rate) || rate < 1.5 || rate > 10) {
        toast.error("Percentage rate must be between 1.5% and 10%");
        return;
      }
      updateFeeConfigMutation.mutate({
        calculationMode: "percentage",
        percentageRate: Math.round(rate * 100),
      });
    } else {
      const amount = parseFloat(fixedFeeAmount);
      if (isNaN(amount) || amount < 1.5 || amount > 10) {
        toast.error("Fixed fee must be between $1.50 and $10.00");
        return;
      }
      updateFeeConfigMutation.mutate({
        calculationMode: "fixed",
        fixedFeeAmount: Math.round(amount * 100),
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition">
                <img src={APP_LOGO || "/logo.jpg"} alt="AmeriLend" className="h-12 w-auto" />
                <div>
                  <h1 className="text-lg font-bold text-gray-900">AmeriLend</h1>
                  <Badge className="bg-blue-600">Admin</Badge>
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100">
                <span className="text-sm font-medium text-gray-700">{user?.name || "Admin"}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => { logout(); window.location.href = "/"; }}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Admin Dashboard</h2>
          <p className="text-gray-600 mt-2">Manage loan applications, verify documents, and configure settings</p>
        </div>

        {/* Quick Navigation Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link href="/admin/settings">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-blue-200 hover:border-blue-400">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Settings className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Settings</p>
                    <p className="text-xs text-gray-600">Configure system</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/users">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-purple-200 hover:border-purple-400">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Users</p>
                    <p className="text-xs text-gray-600">Manage users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/kyc">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-green-200 hover:border-green-400">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-semibold text-gray-900">KYC</p>
                    <p className="text-xs text-gray-600">Verify identities</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/support">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-orange-200 hover:border-orange-400">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-orange-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Support</p>
                    <p className="text-xs text-gray-600">Manage tickets</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Real-Time Statistics */}
        {statsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : stats ? (
          <>
            {/* Row 1: Application Counts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Applications</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalApplications}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Pending Review</p>
                      <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                    </div>
                    <FileText className="h-8 w-8 text-yellow-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Approved</p>
                      <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Disbursed</p>
                      <p className="text-2xl font-bold text-purple-600">{stats.disbursed}</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-purple-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Financial Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Requested</p>
                      <p className="text-2xl font-bold text-gray-900">${(stats.totalRequested / 100).toLocaleString()}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-orange-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Approved</p>
                      <p className="text-2xl font-bold text-green-600">${(stats.totalApproved / 100).toLocaleString()}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Disbursed</p>
                      <p className="text-2xl font-bold text-purple-600">${(stats.totalDisbursed / 100).toLocaleString()}</p>
                    </div>
                    <Send className="h-8 w-8 text-purple-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Fees Collected</p>
                      <p className="text-2xl font-bold text-blue-600">${(stats.totalFeesCollected / 100).toFixed(2)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-blue-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 3: Average Metrics & Rates */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Avg Loan Request</p>
                      <p className="text-2xl font-bold text-gray-900">${(stats.averageLoanAmount / 100).toLocaleString()}</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-indigo-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Avg Approved Amount</p>
                      <p className="text-2xl font-bold text-green-600">${(stats.averageApprovedAmount / 100).toLocaleString()}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Approval Rate</p>
                      <p className="text-2xl font-bold text-blue-600">{stats.approvalRate}%</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-blue-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Avg Processing Time</p>
                      <p className="text-2xl font-bold text-amber-600">{stats.averageProcessingTime} days</p>
                    </div>
                    <Clock className="h-8 w-8 text-amber-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 4: Check Tracking Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Disbursements</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalDisbursements}</p>
                    </div>
                    <Package className="h-8 w-8 text-gray-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Tracking Added</p>
                      <p className="text-2xl font-bold text-green-600">{stats.disbursementsWithTracking}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Tracking Pending</p>
                      <p className="text-2xl font-bold text-yellow-600">{stats.disbursementsPendingTracking}</p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-yellow-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-900">Status Breakdown</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fee Pending:</span>
                        <span className="font-semibold">{stats.fee_pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fee Paid:</span>
                        <span className="font-semibold">{stats.fee_paid}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rejected:</span>
                        <span className="font-semibold">{stats.rejected}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        {/* Tabs */}
        <Tabs defaultValue="applications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="tracking">Tracking</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
            <TabsTrigger value="settings">Fees</TabsTrigger>
            <TabsTrigger value="crypto">Crypto</TabsTrigger>
          </TabsList>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-6">
            {/* Search and Filter Bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search by name, email, or application ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="fee_pending">Fee Pending</SelectItem>
                      <SelectItem value="fee_paid">Fee Paid</SelectItem>
                      <SelectItem value="disbursed">Disbursed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!applications) return;
                      const filteredApps = applications.filter((app: any) => {
                        const matchesSearch = searchTerm === "" || 
                          app.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          app.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          app.id?.toString().includes(searchTerm);
                        const matchesStatus = statusFilter === "all" || app.status === statusFilter;
                        return matchesSearch && matchesStatus;
                      });
                      const csv = [
                        ['ID', 'Name', 'Email', 'Status', 'Loan Type', 'Amount', 'Approved Amount', 'Interest Rate', 'Term', 'Applied Date'].join(','),
                        ...filteredApps.map((app: any) => [
                          app.id,
                          `"${app.fullName}"`,
                          app.email,
                          app.status,
                          app.loanType,
                          app.requestedAmount / 100,
                          (app.approvedAmount || 0) / 100,
                          app.interestRate || '',
                          app.loanTerm || '',
                          new Date(app.createdAt).toLocaleDateString()
                        ].join(','))
                      ].join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `applications-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                      toast.success('Applications exported to CSV');
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bulk Actions Toolbar */}
            {selectedApps.length > 0 && (
              <Card className="border-blue-300 bg-blue-50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-900">
                        {selectedApps.length} application{selectedApps.length > 1 ? 's' : ''} selected
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedApps([])}
                      >
                        Clear Selection
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={async () => {
                          if (!confirm(`Approve ${selectedApps.length} application(s)? This will require setting approved amounts individually.`)) return;
                          
                          let successCount = 0;
                          for (const appId of selectedApps) {
                            try {
                              // Find the application to get requested amount
                              const app = applications?.find((a: any) => a.id === appId);
                              if (app) {
                                await approveMutation.mutateAsync({ 
                                  id: appId, 
                                  approvedAmount: app.requestedAmount // Approve for requested amount
                                });
                                successCount++;
                              }
                            } catch (error) {
                              console.error(`Failed to approve ${appId}:`, error);
                            }
                          }
                          setSelectedApps([]);
                          toast.success(`${successCount} application(s) approved`);
                        }}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Bulk Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!confirm(`Reject ${selectedApps.length} application(s)?`)) return;
                          
                          let successCount = 0;
                          for (const appId of selectedApps) {
                            try {
                              await rejectMutation.mutateAsync({ 
                                id: appId, 
                                rejectionReason: 'Bulk rejection by admin' 
                              });
                              successCount++;
                            } catch (error) {
                              console.error(`Failed to reject ${appId}:`, error);
                            }
                          }
                          setSelectedApps([]);
                          toast.success(`${successCount} application(s) rejected`);
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Bulk Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {isLoading ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </CardContent>
                </Card>
              ) : !applications || applications.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No loan applications found</p>
                  </CardContent>
                </Card>
              ) : (
                (() => {
                  // Filter applications
                  const filteredApps = applications.filter((app: any) => {
                    const matchesSearch = searchTerm === "" || 
                      app.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      app.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      app.id?.toString().includes(searchTerm);
                    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
                    return matchesSearch && matchesStatus;
                  });

                  if (filteredApps.length === 0) {
                    return (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600 font-medium">No applications match your filters</p>
                          <p className="text-sm text-gray-500 mt-2">Try adjusting your search or filters</p>
                        </CardContent>
                      </Card>
                    );
                  }

                  return filteredApps.map((app) => (
                  <Card key={app.id} className="hover:shadow-lg transition">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedApps.includes(app.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedApps([...selectedApps, app.id]);
                              } else {
                                setSelectedApps(selectedApps.filter(id => id !== app.id));
                              }
                            }}
                            className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            aria-label={`Select application ${app.id}`}
                          />
                          <div className="space-y-1 flex-1">
                            <CardTitle className="text-lg">{app.fullName}</CardTitle>
                            <CardDescription>
                              ID: {app.id} • Applied {new Date(app.createdAt).toLocaleDateString()}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className={statusColors[app.status] || "bg-gray-100"}>
                          {app.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide">Requested</p>
                          <p className="text-lg font-semibold text-gray-900">
                            ${(app.requestedAmount / 100).toLocaleString()}
                          </p>
                        </div>
                        {app.approvedAmount && (
                          <div>
                            <p className="text-xs text-gray-600 uppercase tracking-wide">Approved</p>
                            <p className="text-lg font-semibold text-green-600">
                              ${(app.approvedAmount / 100).toLocaleString()}
                            </p>
                          </div>
                        )}
                        {app.processingFeeAmount && (
                          <div>
                            <p className="text-xs text-gray-600 uppercase tracking-wide">Fee</p>
                            <p className="text-lg font-semibold text-gray-900">
                              ${(app.processingFeeAmount / 100).toFixed(2)}
                            </p>
                            {app.status === "fee_paid" && !app.feePaymentVerified && (
                              <Badge className="mt-1 bg-amber-100 text-amber-800 border-amber-300">
                                Pending Verification
                              </Badge>
                            )}
                            {app.status === "fee_paid" && app.feePaymentVerified && (
                              <Badge className="mt-1 bg-green-100 text-green-800 border-green-300">
                                ✓ Verified
                              </Badge>
                            )}
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide">Income</p>
                          <p className="text-lg font-semibold text-gray-900">
                            ${(app.monthlyIncome / 100).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600"><strong>Email:</strong> {app.email}</p>
                            <p className="text-gray-600"><strong>Phone:</strong> {app.phone}</p>
                            <p className="text-gray-600"><strong>Employment:</strong> {app.employmentStatus}</p>
                          </div>
                          <div>
                            <p className="text-gray-600"><strong>Address:</strong> {app.street}, {app.city}, {app.state} {app.zipCode}</p>
                            <p className="text-gray-600"><strong>Purpose:</strong> {app.loanPurpose}</p>
                          </div>
                        </div>
                      </div>

                      {app.adminNotes && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm font-semibold text-blue-900">Admin Notes</p>
                          <p className="text-sm text-blue-800 mt-1">{app.adminNotes}</p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setLocation(`/admin/application/${app.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Button>
                        {(app.status === "pending" || app.status === "under_review") && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => {
                                setApprovalDialog({ open: true, applicationId: app.id });
                                setApprovalAmount((app.requestedAmount / 100).toString());
                              }}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setRejectionDialog({ open: true, applicationId: app.id })}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        )}
                        {app.status === "fee_paid" && (
                          <>
                            {!app.feePaymentVerified && (
                              <div className="flex gap-2 w-full">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 flex-1"
                                  onClick={() => {
                                    verifyFeePaymentMutation.mutate({
                                      id: app.id,
                                      verified: true,
                                      adminNotes: "Fee payment verified - Ready for disbursement"
                                    });
                                  }}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Verify Payment
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1"
                                  onClick={() => setFeeVerificationDialog({ open: true, applicationId: app.id })}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject Payment
                                </Button>
                              </div>
                            )}
                            {app.feePaymentVerified && (
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700"
                                onClick={() => setDisbursementDialog({ open: true, applicationId: app.id })}
                              >
                                <Send className="mr-2 h-4 w-4" />
                                Initiate Disbursement
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  ));
                })()
              )}
            </div>
          </TabsContent>

          {/* Check Tracking Tab */}
          <TabsContent value="tracking" className="space-y-6">
            <div className="space-y-4">
              {disbursementsLoading ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </CardContent>
                </Card>
              ) : !disbursements || disbursements.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No disbursements found</p>
                  </CardContent>
                </Card>
              ) : (
                disbursements.map((disburse: any) => (
                  <Card key={disburse.id} className="hover:shadow-lg transition">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-lg">{disburse.applicantName}</CardTitle>
                          <CardDescription>
                            Disbursement ID: {disburse.id} • Email: {disburse.applicantEmail}
                          </CardDescription>
                        </div>
                        <Badge className={disburse.trackingNumber ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                          {disburse.trackingNumber ? "Tracked" : "Pending Tracking"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide">Disbursement Amount</p>
                          <p className="text-lg font-semibold text-gray-900">
                            ${(disburse.amount / 100).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide">Account Holder</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {disburse.accountHolderName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide">Status</p>
                          <p className="text-lg font-semibold text-gray-900">{disburse.status}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide">Created</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {new Date(disburse.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {disburse.trackingNumber ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                          <p className="text-sm font-semibold text-green-900">Tracking Information</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-green-700">Carrier</p>
                              <p className="font-semibold text-green-900">{disburse.trackingCompany}</p>
                            </div>
                            <div>
                              <p className="text-xs text-green-700">Tracking Number</p>
                              <p className="font-semibold text-green-900">{disburse.trackingNumber}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTrackingDialog({ open: true, disbursementId: disburse.id });
                              setTrackingNumber(disburse.trackingNumber || "");
                              setTrackingCompany(disburse.trackingCompany || "USPS");
                            }}
                            className="w-full mt-2"
                          >
                            Update Tracking
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            setTrackingDialog({ open: true, disbursementId: disburse.id });
                            setTrackingNumber("");
                            setTrackingCompany("USPS");
                          }}
                          className="w-full"
                        >
                          <Package className="mr-2 h-4 w-4" />
                          Add Tracking Information
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Verification Documents Tab */}
          <TabsContent value="verification">
            <VerificationDocumentsAdmin />
          </TabsContent>

          {/* Fee Configuration Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Processing Fee Configuration
                </CardTitle>
                <CardDescription>
                  Configure how processing fees are calculated for approved loans
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {feeConfig && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-2">Current Configuration</p>
                    <p className="text-sm text-blue-800">
                      Mode: <strong className="text-blue-900">{feeConfig.calculationMode}</strong>
                      {feeConfig.calculationMode === "percentage"
                        ? ` • Rate: ${(feeConfig.percentageRate / 100).toFixed(2)}%`
                        : ` • Fee: $${(feeConfig.fixedFeeAmount / 100).toFixed(2)}`}
                    </p>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="feeMode" className="text-base font-semibold">Calculation Mode</Label>
                    <Select value={feeMode} onValueChange={(v) => setFeeMode(v as "percentage" | "fixed")}>
                      <SelectTrigger id="feeMode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage of Loan Amount</SelectItem>
                        <SelectItem value="fixed">Fixed Fee Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {feeMode === "percentage" ? (
                    <div className="space-y-2">
                      <Label htmlFor="percentageRate" className="text-base font-semibold">Percentage Rate (1.5% - 10%)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="percentageRate"
                          type="number"
                          step="0.01"
                          min="1.5"
                          max="10"
                          value={percentageRate}
                          onChange={(e) => setPercentageRate(e.target.value)}
                          className="flex-1"
                        />
                        <span className="text-gray-600 font-medium">%</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Example: {percentageRate}% of $10,000 loan = ${((parseFloat(percentageRate) || 2) * 100).toFixed(2)} processing fee
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="fixedFeeAmount" className="text-base font-semibold">Fixed Fee Amount ($1.50 - $10.00)</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 font-medium">$</span>
                        <Input
                          id="fixedFeeAmount"
                          type="number"
                          step="0.01"
                          min="1.5"
                          max="10"
                          value={fixedFeeAmount}
                          onChange={(e) => setFixedFeeAmount(e.target.value)}
                          className="flex-1"
                        />
                      </div>
                      <p className="text-sm text-gray-600">
                        This fee will be charged for all loans regardless of amount
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleUpdateFeeConfig}
                    disabled={updateFeeConfigMutation.isPending}
                    className="w-full"
                  >
                    {updateFeeConfigMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <DollarSign className="mr-2 h-4 w-4" />
                        Update Configuration
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Support Tickets Tab */}
          <TabsContent value="support">
            <Card>
              <CardHeader>
                <CardTitle>Support Tickets</CardTitle>
                <CardDescription>Manage user support requests and messages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Ticket List */}
                  <div className="md:col-span-1 space-y-4">
                    <div className="flex gap-2">
                      <select
                        className="flex-1 px-3 py-2 border rounded-md text-sm"
                        value={ticketStatusFilter}
                        onChange={(e) => setTicketStatusFilter(e.target.value as any)}
                        aria-label="Filter tickets by status"
                      >
                        <option value="">All Status</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="waiting_customer">Waiting Customer</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {tickets && tickets.length > 0 ? (
                        tickets.map((ticket: any) => (
                          <div
                            key={ticket.id}
                            className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                              selectedTicket === ticket.id ? "border-blue-500 bg-blue-50" : ""
                            }`}
                            onClick={() => setSelectedTicket(ticket.id)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-sm">{ticket.subject}</h4>
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  ticket.status === "open"
                                    ? "bg-blue-100 text-blue-800"
                                    : ticket.status === "in_progress"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : ticket.status === "waiting_customer"
                                    ? "bg-purple-100 text-purple-800"
                                    : ticket.status === "resolved"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {ticket.status.replace("_", " ")}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">{ticket.category.replace("_", " ")}</p>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{ticket.userName}</span>
                              <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                            </div>
                            {ticket.priority && ticket.priority !== "normal" && (
                              <span
                                className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
                                  ticket.priority === "urgent"
                                    ? "bg-red-100 text-red-800"
                                    : ticket.priority === "high"
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {ticket.priority}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-center py-8 text-gray-500">No tickets found</p>
                      )}
                    </div>
                  </div>

                  {/* Ticket Detail */}
                  <div className="md:col-span-2">
                    {selectedTicket ? (
                      <div className="border rounded-lg p-6 space-y-4">
                        {(() => {
                          const ticket = tickets?.find((t: any) => t.id === selectedTicket);
                          if (!ticket) return <p>Ticket not found</p>;

                          return (
                            <>
                              {/* Ticket Header */}
                              <div className="border-b pb-4">
                                <h3 className="text-xl font-semibold mb-2">{ticket.subject}</h3>
                                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                  <span>From: {ticket.userName} ({ticket.userEmail})</span>
                                  {ticket.category && <span>Category: {ticket.category?.replace("_", " ")}</span>}
                                  <span>Created: {new Date(ticket.createdAt).toLocaleString()}</span>
                                </div>
                              </div>

                              {/* Status & Assignment Controls */}
                              <div className="grid md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                                <div>
                                  <label className="block text-sm font-medium mb-2">Status</label>
                                  <select
                                    className="w-full px-3 py-2 border rounded-md"
                                    value={ticket.status}
                                    onChange={(e) => {
                                      updateTicketStatusMutation.mutate({
                                        id: ticket.id,
                                        status: e.target.value as any,
                                      });
                                    }}
                                    aria-label="Update ticket status"
                                  >
                                    <option value="open">Open</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="waiting_customer">Waiting Customer</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="closed">Closed</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-2">Priority</label>
                                  <select
                                    className="w-full px-3 py-2 border rounded-md"
                                    value={ticket.priority || "normal"}
                                    disabled
                                    aria-label="Ticket priority"
                                  >
                                    <option value="low">Low</option>
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                  </select>
                                </div>
                              </div>

                              {/* Conversation */}
                              <div className="space-y-4 max-h-[400px] overflow-y-auto border rounded-lg p-4 bg-gray-50">
                                {/* Original message */}
                                <div className="bg-white p-4 rounded-lg border">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-sm">{ticket.userName}</span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(ticket.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700">{ticket.description}</p>
                                </div>

                                {/* Messages */}
                                {ticketMessages?.map((msg: any) => (
                                  <div
                                    key={msg.id}
                                    className={`p-4 rounded-lg border ${
                                      msg.isFromAdmin ? "bg-blue-50 border-blue-200" : "bg-white"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-semibold text-sm">
                                        {msg.isFromAdmin ? "Admin" : msg.userName || "User"}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {new Date(msg.createdAt).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-700">{msg.message}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Reply Input */}
                              {ticket.status !== "closed" && (
                                <div className="space-y-2">
                                  <label className="block text-sm font-medium">Reply to Ticket</label>
                                  <textarea
                                    className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                                    placeholder="Type your response..."
                                    value={ticketReplyMessage}
                                    onChange={(e) => setTicketReplyMessage(e.target.value)}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => {
                                        if (!ticketReplyMessage.trim()) {
                                          toast.error("Please enter a message");
                                          return;
                                        }
                                        replyToTicketMutation.mutate({
                                          ticketId: ticket.id,
                                          message: ticketReplyMessage,
                                        });
                                      }}
                                      disabled={replyToTicketMutation.isPending}
                                    >
                                      {replyToTicketMutation.isPending ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Sending...
                                        </>
                                      ) : (
                                        "Send Reply"
                                      )}
                                    </Button>
                                    {ticket.status === "waiting_customer" && (
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          updateTicketStatusMutation.mutate({
                                            id: ticket.id,
                                            status: "in_progress",
                                          });
                                        }}
                                      >
                                        Mark In Progress
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Resolved status */}
                              {ticket.status === "resolved" && ticket.resolvedAt && (
                                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                  <h4 className="font-semibold text-green-900 mb-2">Ticket Resolved</h4>
                                  <p className="text-xs text-green-700">
                                    Resolved on {new Date(ticket.resolvedAt).toLocaleString()}
                                  </p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="border rounded-lg p-12 text-center text-gray-500">
                        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p>Select a ticket to view details</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            {/* Advanced Analytics Dashboard - NEW FEATURE #5 */}
            <AdminAnalyticsDashboard />
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>Track all administrative actions and system events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {applications && applications.slice(0, 20).map((app: any) => (
                    <div key={app.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          Application {app.status === "approved" ? "Approved" : app.status === "rejected" ? "Rejected" : "Submitted"}
                        </p>
                        <p className="text-xs text-gray-600">
                          Application ID: {app.id} • {app.fullName}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(app.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge className={statusColors[app.status]}>{app.status}</Badge>
                    </div>
                  ))}
                  {(!applications || applications.length === 0) && (
                    <div className="text-center py-12">
                      <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No audit entries yet</p>
                      <p className="text-sm text-gray-500 mt-2">Activity will be logged here</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Crypto Wallet Settings Tab */}
          <TabsContent value="crypto">
            <CryptoWalletSettings />
          </TabsContent>
        </Tabs>
      </main>

      {/* Approval Dialog */}
      <Dialog open={approvalDialog.open} onOpenChange={(open) => setApprovalDialog({ ...approvalDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Loan Application</DialogTitle>
            <DialogDescription>Set the approved amount and add notes if needed</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="approvalAmount">Approved Amount ($)</Label>
              <Input
                id="approvalAmount"
                type="number"
                step="0.01"
                value={approvalAmount}
                onChange={(e) => setApprovalAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approvalNotes">Admin Notes (optional)</Label>
              <Textarea
                id="approvalNotes"
                rows={3}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog({ open: false, applicationId: null })}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                "Approve Loan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialog.open} onOpenChange={(open) => setRejectionDialog({ ...rejectionDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Loan Application</DialogTitle>
            <DialogDescription>Provide a reason for the rejection</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason</Label>
              <Textarea
                id="rejectionReason"
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this application is being rejected..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectionDialog({ open: false, applicationId: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject Application"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Verification Rejection Dialog */}
      <Dialog open={feeVerificationDialog.open} onOpenChange={(open) => setFeeVerificationDialog({ ...feeVerificationDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Fee Payment</DialogTitle>
            <DialogDescription>
              This will mark the payment as invalid and notify the user to submit payment again
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feeVerificationNotes">Reason for Rejection (Optional)</Label>
              <Textarea
                id="feeVerificationNotes"
                rows={4}
                value={feeVerificationNotes}
                onChange={(e) => setFeeVerificationNotes(e.target.value)}
                placeholder="E.g., Payment not received, incorrect amount, fraudulent transaction..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeeVerificationDialog({ open: false, applicationId: null })}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (!feeVerificationDialog.applicationId) return;
                verifyFeePaymentMutation.mutate({
                  id: feeVerificationDialog.applicationId,
                  verified: false,
                  adminNotes: feeVerificationNotes || "Fee payment rejected by admin"
                });
              }}
              disabled={verifyFeePaymentMutation.isPending}
            >
              {verifyFeePaymentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject Payment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disbursement Dialog */}
      <Dialog open={disbursementDialog.open} onOpenChange={(open) => setDisbursementDialog({ ...disbursementDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate Loan Disbursement</DialogTitle>
            <DialogDescription>Enter the bank account details for the check disbursement</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountHolderName">Account Holder Name</Label>
              <Input
                id="accountHolderName"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="routingNumber">Routing Number</Label>
              <Input
                id="routingNumber"
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disbursementNotes">Notes (optional)</Label>
              <Textarea
                id="disbursementNotes"
                rows={2}
                value={disbursementNotes}
                onChange={(e) => setDisbursementNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisbursementDialog({ open: false, applicationId: null })}>
              Cancel
            </Button>
            <Button onClick={handleDisburse} disabled={disburseMutation.isPending}>
              {disburseMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Initiate Disbursement"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tracking Dialog */}
      <Dialog open={trackingDialog.open} onOpenChange={(open) => setTrackingDialog({ ...trackingDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Check Tracking</DialogTitle>
            <DialogDescription>Add or update tracking information for the mailed check</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trackingCompany">Carrier</Label>
              <Select value={trackingCompany} onValueChange={(value: any) => setTrackingCompany(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USPS">USPS</SelectItem>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="FedEx">FedEx</SelectItem>
                  <SelectItem value="DHL">DHL</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackingNum">Tracking Number</Label>
              <Input
                id="trackingNum"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackingDialog({ open: false, disbursementId: null })}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTracking} disabled={trackingMutation.isPending}>
              {trackingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Tracking"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

