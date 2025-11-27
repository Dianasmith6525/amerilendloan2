import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APP_LOGO } from "@/const";
import { trpc } from "@/lib/trpc";
import { 
  Menu, X, Home, Users, FileText, BarChart3, Package, 
  ShieldCheck, Settings, Wallet, Search, LogOut,
  TrendingUp, Clock, AlertCircle, CheckCircle, XCircle,
  Banknote, CreditCard, Activity, Eye, MessageSquare,
  Send, Download, Loader2, Upload, FileCheck, Zap, Bell
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import VerificationDocumentsAdmin from "@/components/VerificationDocumentsAdmin";
import CryptoWalletSettings from "@/components/CryptoWalletSettings";
import AdminAnalyticsDashboard from "@/components/AdminAnalyticsDashboard";
import { NotificationBell } from "@/components/NotificationBell";
import AdvancedAnalytics from "@/components/AdvancedAnalytics";
import AutomatedWorkflows from "@/components/AutomatedWorkflows";

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

type ViewType = "dashboard" | "applications" | "tracking" | "verification" | "support" | "audit" | "fees" | "crypto" | "workflows";

export default function AdminDashboardFalcon() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();

  // Navigation states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>("dashboard");

  // Dialog states
  const [approvalDialog, setApprovalDialog] = useState<{ open: boolean; applicationId: number | null }>({ open: false, applicationId: null });
  const [approvalAmount, setApprovalAmount] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");

  const [rejectionDialog, setRejectionDialog] = useState<{ open: boolean; applicationId: number | null }>({ open: false, applicationId: null });
  const [rejectionReason, setRejectionReason] = useState("");

  const [disbursementDialog, setDisbursementDialog] = useState<{ open: boolean; applicationId: number | null }>({ open: false, applicationId: null });
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [disbursementNotes, setDisbursementNotes] = useState("");

  const [trackingDialog, setTrackingDialog] = useState<{ open: boolean; disbursementId: number | null }>({ open: false, disbursementId: null });
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCompany, setTrackingCompany] = useState<"USPS" | "UPS" | "FedEx" | "DHL" | "Other">("USPS");

  const [feeVerificationDialog, setFeeVerificationDialog] = useState<{ open: boolean; applicationId: number | null }>({ open: false, applicationId: null });
  const [feeVerificationNotes, setFeeVerificationNotes] = useState("");

  // Fee configuration states
  const [feeMode, setFeeMode] = useState<"percentage" | "fixed">("percentage");
  const [percentageRate, setPercentageRate] = useState("2.00");
  const [fixedFeeAmount, setFixedFeeAmount] = useState("2.00");

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string | undefined>(undefined);
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [ticketReplyMessage, setTicketReplyMessage] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  // Advanced filters
  const [dateRangeFrom, setDateRangeFrom] = useState("");
  const [dateRangeTo, setDateRangeTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [multiStatusFilter, setMultiStatusFilter] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Auth redirects
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, authLoading, setLocation]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user?.role, authLoading, setLocation]);

  // Data queries
  const utils = trpc.useUtils();
  const { data: applications, isLoading } = trpc.loans.adminList.useQuery();
  const { data: disbursements, isLoading: disbursementsLoading } = trpc.disbursements.adminList.useQuery();
  const { data: stats, isLoading: statsLoading } = trpc.loans.adminStatistics.useQuery();
  const { data: feeConfig } = trpc.feeConfig.getActive.useQuery();
  const { data: ticketsData, refetch: refetchTickets, isLoading: ticketsLoading } = trpc.supportTickets.adminGetAll.useQuery({ status: ticketStatusFilter });
  const tickets = ticketsData?.data || [];
  const { data: ticketMessagesData, refetch: refetchTicketMessages } = trpc.supportTickets.getMessages.useQuery(
    { ticketId: selectedTicket || 0 },
    { enabled: !!selectedTicket }
  );
  const ticketMessages = ticketMessagesData?.data || [];

  // Load fee config
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
    onError: (error) => toast.error(error.message || "Failed to approve loan"),
  });

  const rejectMutation = trpc.loans.adminReject.useMutation({
    onSuccess: () => {
      toast.success("Loan rejected successfully");
      utils.loans.adminList.invalidate();
      setRejectionDialog({ open: false, applicationId: null });
      setRejectionReason("");
    },
    onError: (error) => toast.error(error.message || "Failed to reject loan"),
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
    onError: (error) => toast.error(error.message || "Failed to initiate disbursement"),
  });

  const trackingMutation = trpc.disbursements.adminUpdateTracking.useMutation({
    onSuccess: () => {
      toast.success("Check tracking information updated successfully");
      utils.disbursements.adminList.invalidate();
      setTrackingDialog({ open: false, disbursementId: null });
      setTrackingNumber("");
      setTrackingCompany("USPS");
    },
    onError: (error) => toast.error(error.message || "Failed to update tracking information"),
  });

  const updateFeeConfigMutation = trpc.feeConfig.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("Fee configuration updated successfully");
      utils.feeConfig.getActive.invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to update fee configuration"),
  });

  const verifyFeePaymentMutation = trpc.loans.adminVerifyFeePayment.useMutation({
    onSuccess: () => {
      toast.success("Fee payment verification updated");
      utils.loans.adminList.invalidate();
      setFeeVerificationDialog({ open: false, applicationId: null });
      setFeeVerificationNotes("");
    },
    onError: (error) => toast.error(error.message || "Failed to verify fee payment"),
  });

  const replyToTicketMutation = trpc.supportTickets.addMessage.useMutation({
    onSuccess: () => {
      toast.success("Reply sent successfully");
      setTicketReplyMessage("");
      refetchTickets();
      refetchTicketMessages();
    },
    onError: (error) => toast.error(error.message || "Failed to send reply"),
  });

  const updateTicketStatusMutation = trpc.supportTickets.adminUpdateStatus.useMutation({
    onSuccess: () => {
      toast.success("Ticket status updated");
      refetchTickets();
    },
    onError: (error) => toast.error(error.message || "Failed to update ticket status"),
  });

  const assignTicketMutation = trpc.supportTickets.adminAssign.useMutation({
    onSuccess: () => {
      toast.success("Ticket assigned successfully");
      refetchTickets();
    },
    onError: (error) => toast.error(error.message || "Failed to assign ticket"),
  });

  const sendFeeReminderMutation = trpc.loans.adminSendFeeReminder.useMutation({
    onSuccess: () => {
      toast.success("Fee payment reminder sent successfully");
    },
    onError: (error) => toast.error(error.message || "Failed to send reminder"),
  });

  const sendDocumentReminderMutation = trpc.loans.adminSendDocumentReminder.useMutation({
    onSuccess: () => {
      toast.success("Document upload reminder sent successfully");
    },
    onError: (error) => toast.error(error.message || "Failed to send reminder"),
  });

  // Handlers
  const handleApprove = () => {
    if (!approvalDialog.applicationId) return;
    const amount = parseFloat(approvalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid approval amount");
      return;
    }
    const amountInCents = Math.round(amount * 100);
    console.log(`[Frontend] Approving: amount entered=$${amount}, sending to backend=${amountInCents} cents`);
    approveMutation.mutate({
      id: approvalDialog.applicationId,
      approvedAmount: amountInCents,
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
      toast.error("Please provide tracking information");
      return;
    }
    trackingMutation.mutate({
      disbursementId: trackingDialog.disbursementId,
      trackingNumber,
      trackingCompany,
    });
  };

  const handleVerifyFeePayment = (applicationId: number, verified: boolean) => {
    verifyFeePaymentMutation.mutate({
      id: applicationId,
      verified: verified,
      adminNotes: feeVerificationNotes || undefined,
    });
  };

  const handleUpdateFeeConfig = () => {
    const rate = parseFloat(percentageRate);
    const fixedFee = parseFloat(fixedFeeAmount);
    
    if (feeMode === "percentage" && (isNaN(rate) || rate < 0 || rate > 100)) {
      toast.error("Percentage rate must be between 0 and 100");
      return;
    }
    
    if (feeMode === "fixed" && (isNaN(fixedFee) || fixedFee < 0)) {
      toast.error("Fixed fee amount must be a positive number");
      return;
    }

    updateFeeConfigMutation.mutate({
      calculationMode: feeMode,
      percentageRate: Math.round(rate * 100),
      fixedFeeAmount: Math.round(fixedFee * 100),
    });
  };

  const handleSendTicketReply = () => {
    if (!selectedTicket || !ticketReplyMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }
    
    // Note: File upload would require backend support for file storage
    // For now, we'll show a toast indicating files would be uploaded
    if (uploadedFiles.length > 0) {
      toast.info(`${uploadedFiles.length} file(s) would be uploaded (requires backend implementation)`);
    }
    
    replyToTicketMutation.mutate({
      ticketId: selectedTicket,
      message: ticketReplyMessage,
    });
    
    // Clear files after sending
    setUploadedFiles([]);
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Auth check
  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  // Filter applications
  const filteredApplications = applications?.filter(app => {
    // Basic search (name, email, phone)
    const matchesSearch = searchTerm === "" || 
      app.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.phone?.includes(searchTerm);
    
    // Basic status filter
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    
    // Multi-status filter (advanced)
    const matchesMultiStatus = multiStatusFilter.length === 0 || multiStatusFilter.includes(app.status);
    
    // Date range filter
    const appDate = new Date(app.createdAt);
    const matchesDateFrom = !dateRangeFrom || appDate >= new Date(dateRangeFrom);
    const matchesDateTo = !dateRangeTo || appDate <= new Date(dateRangeTo);
    
    // Amount range filter
    const amount = app.requestedAmount / 100;
    const matchesAmountMin = !amountMin || amount >= parseFloat(amountMin);
    const matchesAmountMax = !amountMax || amount <= parseFloat(amountMax);
    
    return matchesSearch && matchesStatus && matchesMultiStatus && 
           matchesDateFrom && matchesDateTo && matchesAmountMin && matchesAmountMax;
  }) || [];

  // Navigation items
  const navItems = [
    { id: "dashboard" as ViewType, icon: Home, label: "Dashboard" },
    { id: "applications" as ViewType, icon: FileText, label: "Applications" },
    { id: "tracking" as ViewType, icon: Package, label: "Tracking" },
    { id: "verification" as ViewType, icon: ShieldCheck, label: "Verification" },
    { id: "support" as ViewType, icon: MessageSquare, label: "Support" },
    { id: "audit" as ViewType, icon: BarChart3, label: "Analytics" },
    { id: "workflows" as ViewType, icon: Zap, label: "Workflows" },
    { id: "fees" as ViewType, icon: Settings, label: "Fee Settings" },
    { id: "crypto" as ViewType, icon: Wallet, label: "Crypto Wallet" },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        ${sidebarOpen ? 'w-64' : 'w-20'} 
        bg-gradient-to-b from-[#1e3a8a] to-[#1e40af] text-white 
        transition-all duration-300 flex flex-col shadow-xl
        fixed lg:relative h-full z-50
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center space-x-3">
                <img src={APP_LOGO} alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
                <span className="font-bold text-xl">Admin Portal</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-white hover:bg-white/10"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-white/20 shadow-lg' 
                    : 'hover:bg-white/10'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-white/10">
          <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {sidebarOpen && (
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">{user?.email}</p>
                  <p className="text-xs text-white/70">Administrator</p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-white hover:bg-white/10"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full lg:w-auto">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-gray-700"
            >
              <Menu className="h-6 w-6" />
            </Button>
            
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">
              {navItems.find(item => item.id === currentView)?.label || 'Dashboard'}
            </h1>
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search..."
                  className="pl-10 w-40 lg:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          {/* Dashboard View */}
          {currentView === "dashboard" && (
            <div className="space-y-4 md:space-y-6">
              {/* Colorful Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium opacity-90">Total Applications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-3xl font-bold">{stats?.totalApplications || 0}</p>
                      <FileText className="h-8 w-8 opacity-80" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium opacity-90">Pending Review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-3xl font-bold">{stats?.pending || 0}</p>
                      <Clock className="h-8 w-8 opacity-80" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium opacity-90">Approved</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-3xl font-bold">{stats?.approved || 0}</p>
                      <CheckCircle className="h-8 w-8 opacity-80" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium opacity-90">Disbursed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-3xl font-bold">{stats?.disbursed || 0}</p>
                      <Banknote className="h-8 w-8 opacity-80" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Secondary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-l-4 border-l-red-500 shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Rejected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-gray-900">{stats?.rejected || 0}</p>
                      <XCircle className="h-6 w-6 text-red-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-yellow-500 shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Under Review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-gray-900">{stats?.pending || 0}</p>
                      <Activity className="h-6 w-6 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-emerald-500 shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Fee Paid</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-gray-900">{stats?.fee_paid || 0}</p>
                      <CreditCard className="h-6 w-6 text-emerald-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Analytics Dashboard */}
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Analytics Overview</CardTitle>
                  <CardDescription>Real-time insights and trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <AdminAnalyticsDashboard />
                </CardContent>
              </Card>

              {/* Recent Applications */}
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Recent Applications</CardTitle>
                  <CardDescription>Latest loan applications submitted</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-gray-600">Applicant</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-600">Amount</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                            <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {applications?.slice(0, 5).map((app) => (
                            <tr key={app.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <div>
                                  <p className="font-medium text-gray-900">{app.fullName}</p>
                                  <p className="text-sm text-gray-500">{app.email}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-medium">${(app.requestedAmount / 100).toFixed(2)}</td>
                              <td className="py-3 px-4">
                                <Badge className={statusColors[app.status]}>{app.status}</Badge>
                              </td>
                              <td className="py-3 px-4 text-gray-600">{new Date(app.createdAt).toLocaleDateString()}</td>
                              <td className="py-3 px-4 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCurrentView("applications")}
                                >
                                  <Eye className="h-4 w-4" />
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
            </div>
          )}

          {/* Applications View */}
          {currentView === "applications" && (
            <div className="space-y-6">
              <Card className="shadow-md">
                <CardHeader>
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Loan Applications</CardTitle>
                        <CardDescription>Manage and review all loan applications</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-48">
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
                          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        >
                          {showAdvancedFilters ? "Hide" : "Show"} Advanced Filters
                        </Button>
                      </div>
                    </div>
                    
                    {/* Advanced Filters Panel */}
                    {showAdvancedFilters && (
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Date Range */}
                            <div>
                              <Label className="text-sm">From Date</Label>
                              <Input
                                type="date"
                                value={dateRangeFrom}
                                onChange={(e) => setDateRangeFrom(e.target.value)}
                                className="bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">To Date</Label>
                              <Input
                                type="date"
                                value={dateRangeTo}
                                onChange={(e) => setDateRangeTo(e.target.value)}
                                className="bg-white"
                              />
                            </div>
                            
                            {/* Amount Range */}
                            <div>
                              <Label className="text-sm">Min Amount ($)</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={amountMin}
                                onChange={(e) => setAmountMin(e.target.value)}
                                className="bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">Max Amount ($)</Label>
                              <Input
                                type="number"
                                placeholder="100000"
                                value={amountMax}
                                onChange={(e) => setAmountMax(e.target.value)}
                                className="bg-white"
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-4">
                            <p className="text-sm text-blue-700">
                              Showing {filteredApplications.length} of {applications?.length || 0} applications
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDateRangeFrom("");
                                setDateRangeTo("");
                                setAmountMin("");
                                setAmountMax("");
                                setMultiStatusFilter([]);
                                setStatusFilter("all");
                                setSearchTerm("");
                              }}
                            >
                              Clear All Filters
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">ID</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Applicant</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Fee Paid</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Docs</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredApplications.map((app) => (
                            <tr key={app.id} className="border-b hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4 font-mono text-sm text-gray-600">#{app.id}</td>
                              <td className="py-3 px-4 font-medium text-gray-900">{app.fullName}</td>
                              <td className="py-3 px-4 text-gray-600">{app.email}</td>
                              <td className="py-3 px-4 font-semibold text-gray-900">${(app.requestedAmount / 100).toFixed(2)}</td>
                              <td className="py-3 px-4">
                                <Badge className={statusColors[app.status]}>{app.status}</Badge>
                              </td>
                              <td className="py-3 px-4">
                                {app.status === "fee_pending" || app.status === "fee_paid" ? (
                                  app.feePaymentVerified ? (
                                    <Badge className="bg-green-100 text-green-800">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Verified
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-yellow-100 text-yellow-800">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Pending
                                    </Badge>
                                  )
                                ) : (
                                  <span className="text-gray-400 text-sm">N/A</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <Badge className="bg-gray-100 text-gray-800">
                                  <FileCheck className="h-3 w-3 mr-1" />
                                  N/A
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-gray-600">{new Date(app.createdAt).toLocaleDateString()}</td>
                              <td className="py-3 px-4">
                                <div className="flex justify-end space-x-2 flex-wrap gap-1">
                                  {app.status === "pending" && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="bg-green-600 hover:bg-green-700"
                                        onClick={() => {
                                          const requestedInDollars = app.requestedAmount / 100;
                                          console.log(`[Approve Dialog] Opening for app ${app.id}: requestedAmount=${app.requestedAmount} cents, pre-filling dialog with $${requestedInDollars}`);
                                          setApprovalDialog({ open: true, applicationId: app.id });
                                          setApprovalAmount(requestedInDollars.toString());
                                        }}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => setRejectionDialog({ open: true, applicationId: app.id })}
                                      >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                  {app.status === "fee_paid" && (
                                    <Button
                                      size="sm"
                                      className="bg-purple-600 hover:bg-purple-700"
                                      onClick={() => setDisbursementDialog({ open: true, applicationId: app.id })}
                                    >
                                      <Banknote className="h-4 w-4 mr-1" />
                                      Disburse
                                    </Button>
                                  )}
                                  {(app.status === "fee_pending" || app.status === "approved") && !app.feePaymentVerified && (
                                    <>
                                      {app.status === "fee_pending" && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setFeeVerificationDialog({ open: true, applicationId: app.id });
                                          }}
                                        >
                                          Verify Fee
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-amber-50 hover:bg-amber-100 border-amber-300"
                                        onClick={() => sendFeeReminderMutation.mutate({ id: app.id })}
                                        disabled={sendFeeReminderMutation.isPending}
                                        title="Send fee payment reminder"
                                      >
                                        <Bell className="h-4 w-4 mr-1" />
                                        Remind Fee
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-blue-50 hover:bg-blue-100 border-blue-300"
                                    onClick={() => sendDocumentReminderMutation.mutate({ id: app.id })}
                                    disabled={sendDocumentReminderMutation.isPending}
                                    title="Send document upload reminder"
                                  >
                                    <Upload className="h-4 w-4 mr-1" />
                                    Remind Docs
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredApplications.length === 0 && (
                        <div className="text-center py-12">
                          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500">No applications found matching your criteria</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tracking View */}
          {currentView === "tracking" && (
            <div className="space-y-6">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Check Tracking Management</CardTitle>
                  <CardDescription>Monitor and update check disbursement tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  {disbursementsLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">ID</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Application ID</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Account Holder</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Tracking</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {disbursements?.map((disb) => (
                            <tr key={disb.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4 font-mono text-sm">#{disb.id}</td>
                              <td className="py-3 px-4 font-mono text-sm">#{disb.loanApplicationId}</td>
                              <td className="py-3 px-4 font-semibold">${(disb.amount / 100).toFixed(2)}</td>
                              <td className="py-3 px-4">{disb.accountHolderName}</td>
                              <td className="py-3 px-4">
                                <Badge className={disb.status === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                                  {disb.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                {disb.trackingNumber ? (
                                  <div>
                                    <p className="font-medium text-sm">{disb.trackingCompany}</p>
                                    <p className="text-xs text-gray-500">{disb.trackingNumber}</p>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-sm">Not set</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setTrackingDialog({ open: true, disbursementId: disb.id });
                                    setTrackingNumber(disb.trackingNumber || "");
                                    setTrackingCompany((disb.trackingCompany as any) || "USPS");
                                  }}
                                >
                                  <Package className="h-4 w-4 mr-1" />
                                  {disb.trackingNumber ? "Update" : "Add"} Tracking
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {disbursements?.length === 0 && (
                        <div className="text-center py-12">
                          <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500">No disbursements to track</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Verification View */}
          {currentView === "verification" && (
            <div className="space-y-6">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Document Verification</CardTitle>
                  <CardDescription>Review and verify identity documents</CardDescription>
                </CardHeader>
                <CardContent>
                  <VerificationDocumentsAdmin />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Support View */}
          {currentView === "support" && (
            <div className="space-y-6">
              <Card className="shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Support Tickets</CardTitle>
                      <CardDescription>Manage customer support requests</CardDescription>
                    </div>
                    <Select value={ticketStatusFilter || "all"} onValueChange={(val) => setTicketStatusFilter(val === "all" ? undefined : val)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tickets</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {ticketsLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tickets.map((ticket) => (
                        <Card key={ticket.id} className="border-l-4 border-l-blue-500">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg">#{ticket.id} - {ticket.subject}</CardTitle>
                                <CardDescription className="mt-1">
                                  Category: {ticket.category} | Priority: {ticket.priority}
                                </CardDescription>
                              </div>
                              <Badge className={
                                ticket.status === "open" ? "bg-yellow-100 text-yellow-800" :
                                ticket.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                                ticket.status === "resolved" ? "bg-green-100 text-green-800" :
                                "bg-gray-100 text-gray-800"
                              }>
                                {ticket.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-gray-700 mb-4">{ticket.description}</p>
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-500">
                                Created {new Date(ticket.createdAt).toLocaleString()}
                              </p>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedTicket(ticket.id)}
                                >
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  View Messages
                                </Button>
                                <Select
                                  value={ticket.status}
                                  onValueChange={(status) => {
                                    updateTicketStatusMutation.mutate({
                                      id: ticket.id,
                                      status: status as any,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {tickets.length === 0 && (
                        <div className="text-center py-12">
                          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500">No support tickets found</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Analytics View */}
          {currentView === "audit" && (
            <div className="space-y-6">
              <AdvancedAnalytics />
            </div>
          )}

          {/* Fee Settings View */}
          {currentView === "fees" && (
            <div className="space-y-6">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Fee Configuration</CardTitle>
                  <CardDescription>Manage origination fee settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label>Calculation Mode</Label>
                      <Select value={feeMode} onValueChange={(val: "percentage" | "fixed") => setFeeMode(val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {feeMode === "percentage" && (
                      <div>
                        <Label>Percentage Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={percentageRate}
                          onChange={(e) => setPercentageRate(e.target.value)}
                          placeholder="e.g., 2.00 for 2%"
                        />
                      </div>
                    )}

                    {feeMode === "fixed" && (
                      <div>
                        <Label>Fixed Fee Amount ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={fixedFeeAmount}
                          onChange={(e) => setFixedFeeAmount(e.target.value)}
                          placeholder="e.g., 50.00"
                        />
                      </div>
                    )}

                    <Button
                      onClick={handleUpdateFeeConfig}
                      disabled={updateFeeConfigMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {updateFeeConfigMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Settings className="mr-2 h-4 w-4" />
                          Update Fee Configuration
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="pt-6 border-t">
                    <h3 className="font-semibold mb-2">Current Configuration</h3>
                    {feeConfig && (
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <p><span className="font-medium">Mode:</span> {feeConfig.calculationMode}</p>
                        <p><span className="font-medium">Percentage Rate:</span> {(feeConfig.percentageRate / 100).toFixed(2)}%</p>
                        <p><span className="font-medium">Fixed Fee:</span> ${(feeConfig.fixedFeeAmount / 100).toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Workflows View */}
          {currentView === "workflows" && (
            <div className="space-y-6">
              <AutomatedWorkflows />
            </div>
          )}

          {/* Crypto Wallet View */}
          {currentView === "crypto" && (
            <div className="space-y-6">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Crypto Wallet Settings</CardTitle>
                  <CardDescription>Configure cryptocurrency payment options</CardDescription>
                </CardHeader>
                <CardContent>
                  <CryptoWalletSettings />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
      {/* Approval Dialog */}
      <Dialog open={approvalDialog.open} onOpenChange={(open) => !open && setApprovalDialog({ open: false, applicationId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Loan Application</DialogTitle>
            <DialogDescription>Set the approved loan amount and any admin notes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Approved Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={approvalAmount}
                onChange={(e) => setApprovalAmount(e.target.value)}
                placeholder="Enter approved amount"
              />
            </div>
            <div>
              <Label>Admin Notes (Optional)</Label>
              <Textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add any notes about this approval"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog({ open: false, applicationId: null })}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending} className="bg-green-600 hover:bg-green-700">
              {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialog.open} onOpenChange={(open) => !open && setRejectionDialog({ open: false, applicationId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Loan Application</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this application</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Rejection Reason</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter the reason for rejection"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectionDialog({ open: false, applicationId: null })}>
              Cancel
            </Button>
            <Button onClick={handleReject} disabled={rejectMutation.isPending} variant="destructive">
              {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disbursement Dialog */}
      <Dialog open={disbursementDialog.open} onOpenChange={(open) => !open && setDisbursementDialog({ open: false, applicationId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate Disbursement</DialogTitle>
            <DialogDescription>Enter bank account details for check disbursement</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Account Holder Name</Label>
              <Input
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Full name on account"
              />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Bank account number"
              />
            </div>
            <div>
              <Label>Routing Number</Label>
              <Input
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value)}
                placeholder="Bank routing number"
              />
            </div>
            <div>
              <Label>Admin Notes (Optional)</Label>
              <Textarea
                value={disbursementNotes}
                onChange={(e) => setDisbursementNotes(e.target.value)}
                placeholder="Add any notes about this disbursement"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisbursementDialog({ open: false, applicationId: null })}>
              Cancel
            </Button>
            <Button onClick={handleDisburse} disabled={disburseMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
              {disburseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Initiate Disbursement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tracking Dialog */}
      <Dialog open={trackingDialog.open} onOpenChange={(open) => !open && setTrackingDialog({ open: false, disbursementId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Tracking Information</DialogTitle>
            <DialogDescription>Add or update check tracking details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tracking Company</Label>
              <Select value={trackingCompany} onValueChange={(val: typeof trackingCompany) => setTrackingCompany(val)}>
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
            <div>
              <Label>Tracking Number</Label>
              <Input
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
              {trackingMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update Tracking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Verification Dialog */}
      <Dialog open={feeVerificationDialog.open} onOpenChange={(open) => !open && setFeeVerificationDialog({ open: false, applicationId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Fee Payment</DialogTitle>
            <DialogDescription>Confirm the applicant has paid the origination fee</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Verification Notes (Optional)</Label>
            <Textarea
              value={feeVerificationNotes}
              onChange={(e) => setFeeVerificationNotes(e.target.value)}
              placeholder="Add verification details or notes"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeeVerificationDialog({ open: false, applicationId: null })}>
              Cancel
            </Button>
            <Button
              onClick={() => feeVerificationDialog.applicationId && handleVerifyFeePayment(feeVerificationDialog.applicationId, true)}
              disabled={verifyFeePaymentMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {verifyFeePaymentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Messages Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket Messages</DialogTitle>
            <DialogDescription>View and reply to support ticket</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {ticketMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.isFromAdmin ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">
                    {msg.isFromAdmin ? 'Admin' : 'Customer'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(msg.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="text-gray-700">{msg.message}</p>
              </div>
            ))}
          </div>
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <Label>Reply to Ticket</Label>
              <Textarea
                value={ticketReplyMessage}
                onChange={(e) => setTicketReplyMessage(e.target.value)}
                placeholder="Type your reply..."
                rows={3}
              />
            </div>
            
            {/* File Upload Section */}
            <div className="space-y-2">
              <Label>Attach Files (Optional)</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                <Input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    if (e.target.files) {
                      setUploadedFiles(Array.from(e.target.files));
                    }
                  }}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Supported: PDF, DOC, DOCX, TXT, PNG, JPG (Max 5MB each)
                </p>
              </div>
              
              {/* File Preview */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Selected Files:</p>
                  <div className="space-y-1">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSelectedTicket(null);
              setUploadedFiles([]);
            }}>
              Close
            </Button>
            <Button onClick={handleSendTicketReply} disabled={replyToTicketMutation.isPending}>
              {replyToTicketMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Reply {uploadedFiles.length > 0 && `(${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
