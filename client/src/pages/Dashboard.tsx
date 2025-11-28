import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import AiSupportWidget from "@/components/AiSupportWidget";
import UserNotificationBell from "@/components/UserNotificationBell";
import {
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
  FileText,
  Phone,
  LogOut,
  AlertCircle,
  CreditCard,
  Shield,
  User,
  Settings,
  ChevronDown,
  TrendingUp,
  Bell,
  MessageSquare,
  Download,
  Calendar,
  Receipt,
  Menu,
  X,
  Search,
  Filter,
  Home,
  Zap,
  Activity,
  Lock,
  Paperclip,
} from "lucide-react";
import { Link } from "wouter";
import VerificationUpload from "@/components/VerificationUpload";
import DocumentProgressTracker from "@/components/DocumentProgressTracker";
import LoanApplicationProgress from "@/components/LoanApplicationProgress";
import NotificationCenter from "@/components/NotificationCenter";
import DocumentDownload from "@/components/DocumentDownload";
import QuickApply from "@/components/QuickApply";
import TwoFactorAuth from "@/components/TwoFactorAuth";
import PaymentHistoryAnalytics from "@/components/PaymentHistoryAnalytics";
import AutoPaySettings from "@/components/AutoPaySettings";
import PaymentMethodManager from "@/components/PaymentMethodManager";
import { PaymentAnalyticsCharts } from "@/components/PaymentAnalyticsCharts";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  
  // All hooks must be called before any conditional returns
  const { data: loans, isLoading } = trpc.loans.myApplications.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const [expandedLoan, setExpandedLoan] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [messageAttachment, setMessageAttachment] = useState<File | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [newTicketCategory, setNewTicketCategory] = useState("general_inquiry");
  
  // Mobile responsive state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("applications");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [paymentSearchTerm, setPaymentSearchTerm] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  
  // Withdrawal dialog state
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [withdrawalLoanId, setWithdrawalLoanId] = useState<number | null>(null);
  const [withdrawalReason, setWithdrawalReason] = useState("");
  
  // Fetch real support tickets for messages
  const { data: supportTicketsData, refetch: refetchTickets, isLoading: ticketsLoading } = trpc.supportTickets.getUserTickets.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const supportTickets = supportTicketsData?.data || [];
  
  // Get messages for selected ticket
  const { data: ticketMessagesData, refetch: refetchMessages } = trpc.supportTickets.getMessages.useQuery(
    { ticketId: selectedTicket || 0 },
    { enabled: !!selectedTicket }
  );
  
  const ticketMessages = ticketMessagesData?.data || [];
  
  const messages = Array.isArray(ticketMessages) ? ticketMessages.map((msg: any) => ({
    id: msg.id,
    sender: msg.isFromAdmin ? "Support Team" : (msg.userName || "You"),
    message: msg.message,
    timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
    isAdmin: msg.isFromAdmin,
    attachmentUrl: msg.attachmentUrl,
  })) : [];
  // Fetch real payment history
  const { data: paymentsData = [], isLoading: paymentsLoading } = trpc.payments.getHistory.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const payments = Array.isArray(paymentsData) ? paymentsData.map((p: any) => ({
    id: p.id,
    loanId: p.loanApplicationId,
    date: p.createdAt ? new Date(p.createdAt) : new Date(),
    amount: p.amount / 100, // Convert cents to dollars
    status: p.status === "succeeded" ? "completed" : p.status,
    trackingNumber: p.loanTrackingNumber || `LN-${p.loanApplicationId}`,
    paymentMethod: p.paymentMethod === "card" 
      ? `${p.cardBrand || "Card"} ****${p.cardLast4 || ""}` 
      : `${p.cryptoCurrency || "Crypto"}`,
    createdAt: p.createdAt,
    method: p.paymentMethod,
  })) : [];
  
  // Mutations
  const createTicketMutation = trpc.supportTickets.create.useMutation({
    onSuccess: () => {
      refetchTickets();
      toast.success("Support ticket created!");
      setNewTicketSubject("");
      setNewTicketMessage("");
      setShowNewTicketForm(false);
    },
  });
  
  const addMessageMutation = trpc.supportTickets.addMessage.useMutation({
    onSuccess: () => {
      refetchMessages();
      toast.success("Message sent!");
      setNewMessage("");
      setMessageAttachment(null);
    },
  });
  
  const withdrawalMutation = trpc.loans.withdraw.useMutation({
    onSuccess: () => {
      toast.success("Application withdrawn successfully");
      setWithdrawalDialogOpen(false);
      setWithdrawalLoanId(null);
      setWithdrawalReason("");
      // Refetch applications to update the list
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to withdraw application");
    },
  });
  
  // Redirect to admin dashboard if user is admin
  useEffect(() => {
    if (authLoading) return; // Don't redirect while loading
    if (isAuthenticated && user?.role === "admin") {
      setLocation("/admin");
    }
  }, [isAuthenticated, user?.role, authLoading, setLocation]);
  
  // Redirect to login if not authenticated (only after loading completes)
  useEffect(() => {
    if (authLoading) return; // Don't redirect while loading
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, authLoading, setLocation]);
  
  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }
  
  // Don't render if not authenticated or if admin (redirect will happen)
  if (!isAuthenticated || user?.role === "admin") {
    return null;
  }
  
  // Debug logging
  console.log("Dashboard Data:", { loans, payments: paymentsData, supportTickets: supportTicketsData });

  // Filter loans based on search and filters
  const filteredLoans = loans?.filter((loan) => {
    // Search term filter
    if (searchTerm && 
        !loan.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !loan.loanType?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    if (statusFilter !== "all" && loan.status !== statusFilter) {
      return false;
    }

    // Date range filter
    if (dateFrom && loan.createdAt && new Date(loan.createdAt) < new Date(dateFrom)) {
      return false;
    }
    if (dateTo && loan.createdAt && new Date(loan.createdAt) > new Date(dateTo)) {
      return false;
    }

    // Amount range filter
    const amount = (loan.requestedAmount || 0) / 100;
    if (amountMin && amount < parseFloat(amountMin)) {
      return false;
    }
    if (amountMax && amount > parseFloat(amountMax)) {
      return false;
    }

    return true;
  }) || [];

  // Filter payments based on search and status
  const filteredPayments = payments.filter((payment) => {
    // Search term filter
    if (paymentSearchTerm && 
        !payment.trackingNumber?.toLowerCase().includes(paymentSearchTerm.toLowerCase()) &&
        !payment.paymentMethod?.toLowerCase().includes(paymentSearchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    if (paymentStatusFilter !== "all" && payment.status !== paymentStatusFilter) {
      return false;
    }

    return true;
  });

  // Export to CSV function
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle dates
          if (value instanceof Date) {
            return value.toLocaleDateString();
          }
          // Handle strings with commas
          if (typeof value === "string" && value.includes(",")) {
            return `"${value}"`;
          }
          return value;
        }).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Data exported successfully!");
  };

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;
    
    let attachmentUrl: string | undefined = undefined;
    
    // Upload attachment if present
    if (messageAttachment) {
      try {
        const formData = new FormData();
        formData.append("file", messageAttachment);
        
        const uploadResponse = await fetch("/api/upload-document", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        
        if (uploadResponse.ok) {
          const uploadedFile = await uploadResponse.json();
          attachmentUrl = uploadedFile.url;
        } else {
          toast.error("Failed to upload attachment");
          return;
        }
      } catch (error) {
        toast.error("Error uploading attachment");
        return;
      }
    }
    
    addMessageMutation.mutate({
      ticketId: selectedTicket,
      message: newMessage,
      attachmentUrl,
    });
  };

  const handleCreateTicket = () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    
    createTicketMutation.mutate({
      subject: newTicketSubject,
      description: newTicketMessage,
      category: newTicketCategory,
      priority: "normal",
    });
  };

  // Calculate dashboard statistics
  const stats = {
    total: loans?.length || 0,
    approved: loans?.filter(l => l.status === "approved" || l.status === "fee_pending" || l.status === "fee_paid" || l.status === "disbursed").length || 0,
    pending: loans?.filter(l => l.status === "pending").length || 0,
    totalFunded: loans?.filter(l => l.status === "disbursed").reduce((sum, l) => sum + (l.approvedAmount || 0), 0) || 0,
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <Link href="/">
                <a className="flex items-center">
                  <img src="/logo.jpg" alt="AmeriLend" className="h-16 w-auto logo-blend" />
                </a>
              </Link>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center py-12">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-[#0033A0]/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#0033A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[#0033A0] mb-2">Sign In Required</h2>
              <p className="text-gray-600 mb-6">
                Please sign in to view your dashboard and manage your loan applications.
              </p>
              <Button
                className="w-full bg-[#FFA500] hover:bg-[#FF8C00] text-white"
                asChild
              >
                <a href="/login">Sign In</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        icon: Clock,
        text: "Under Review",
        bgColor: "bg-yellow-100",
        textColor: "text-yellow-800",
        borderColor: "border-yellow-300",
      },
      approved: {
        icon: CheckCircle2,
        text: "Approved",
        bgColor: "bg-green-100",
        textColor: "text-green-800",
        borderColor: "border-green-300",
      },
      rejected: {
        icon: XCircle,
        text: "Not Approved",
        bgColor: "bg-red-100",
        textColor: "text-red-800",
        borderColor: "border-red-300",
      },
      fee_pending: {
        icon: AlertCircle,
        text: "Payment Required",
        bgColor: "bg-orange-100",
        textColor: "text-orange-800",
        borderColor: "border-orange-300",
      },
      fee_paid: {
        icon: CreditCard,
        text: "Payment Confirmed",
        bgColor: "bg-blue-100",
        textColor: "text-blue-800",
        borderColor: "border-blue-300",
      },
      disbursed: {
        icon: CheckCircle2,
        text: "Funded",
        bgColor: "bg-green-100",
        textColor: "text-green-800",
        borderColor: "border-green-300",
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
      >
        <Icon className="w-4 h-4" />
        <span className="text-sm font-semibold">{config.text}</span>
      </div>
    );
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Left Sidebar Navigation */}
      <aside className={`${
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0 fixed md:sticky top-0 left-0 z-40 w-64 h-screen bg-white border-r shadow-lg transition-transform duration-300 ease-in-out`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b">
            <Link href="/">
              <a className="flex items-center">
                <img
                  src="/logo.jpg"
                  alt="AmeriLend"
                  className="h-16 w-auto object-contain"
                />
              </a>
            </Link>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            <div className="space-y-1">
              <button
                onClick={() => {
                  setActiveTab("applications");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "applications"
                    ? "bg-blue-50 text-[#0033A0] font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <FileText className="w-5 h-5" />
                <span>My Applications</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("quick-apply");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "quick-apply"
                    ? "bg-blue-50 text-[#0033A0] font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Zap className="w-5 h-5" />
                <span>Quick Apply</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("verification");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "verification"
                    ? "bg-blue-50 text-[#0033A0] font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Shield className="w-5 h-5" />
                <span>Verification</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("messages");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "messages"
                    ? "bg-blue-50 text-[#0033A0] font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <MessageSquare className="w-5 h-5" />
                <span>Messages</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("payments");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "payments"
                    ? "bg-blue-50 text-[#0033A0] font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span>Payments</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("auto-pay");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "auto-pay"
                    ? "bg-blue-50 text-[#0033A0] font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Calendar className="w-5 h-5" />
                <span>Auto-Pay</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("timeline");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "timeline"
                    ? "bg-blue-50 text-[#0033A0] font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Activity className="w-5 h-5" />
                <span>Activity</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("notifications");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "notifications"
                    ? "bg-blue-50 text-[#0033A0] font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Bell className="w-5 h-5" />
                <span>Notifications</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("documents");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "documents"
                    ? "bg-blue-50 text-[#0033A0] font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Download className="w-5 h-5" />
                <span>Documents</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("security");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "security"
                    ? "bg-blue-50 text-[#0033A0] font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Lock className="w-5 h-5" />
                <span>Security</span>
              </button>
            </div>

            <div className="mt-6 pt-6 border-t">
              <Link href="/settings">
                <a className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100">
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </a>
              </Link>
              <Link href="/profile">
                <a className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100">
                  <User className="w-5 h-5" />
                  <span>Profile</span>
                </a>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-700 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5" />
                <span>Log Out</span>
              </button>
            </div>
          </nav>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
          <div className="px-4 py-3 md:px-6">
            <div className="flex items-center justify-between">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100"
                aria-label="Menu"
              >
                <Menu className="w-6 h-6 text-gray-700" />
              </button>

              <div className="flex-1 md:flex-none">
                <h1 className="text-xl md:text-2xl font-bold text-[#0033A0]">
                  Welcome, {user?.firstName || user?.name || "there"}!
                </h1>
              </div>

              <div className="flex items-center gap-2 md:gap-4">
                {/* Notification Bell */}
                <UserNotificationBell />

                {/* Phone Number */}
                <a
                  href="tel:+19452121609"
                  className="hidden lg:flex items-center gap-2 text-gray-700 hover:text-[#0033A0]"
                >
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">+1 945 212-1609</span>
                </a>
                
                {/* Profile Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium hidden sm:inline">{user?.name?.split(" ")[0] || "Account"}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <Link href="/profile">
                        <a className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b">
                          <User className="w-4 h-4 inline mr-2" />
                          My Profile
                        </a>
                      </Link>
                      <Link href="/settings">
                        <a className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b">
                          <Settings className="w-4 h-4 inline mr-2" />
                          Settings
                        </a>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-3 text-sm text-red-700 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4 inline mr-2" />
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-gray-50">
          <div className="max-w-7xl mx-auto">
          {/* Analytics Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Applications</p>
                    <p className="text-3xl font-bold text-[#0033A0]">{stats.total}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Approved</p>
                    <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Pending Review</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Funded</p>
                    <p className="text-2xl font-bold text-green-600">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format((stats.totalFunded || 0) / 100)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tab Content Based on activeTab */}
          {activeTab === "applications" && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle className="text-2xl text-[#0033A0]">My Loan Applications</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2"
                      >
                        <Filter className="w-4 h-4" />
                        Filters
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportToCSV(
                          filteredLoans.map(loan => ({
                            trackingNumber: loan.trackingNumber,
                            type: loan.loanType,
                            amount: loan.requestedAmount / 100,
                            status: loan.status,
                            date: new Date(loan.createdAt).toLocaleDateString(),
                          })),
                          "loan-applications"
                        )}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </Button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="mt-4 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search by tracking number or loan type..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Advanced Filters */}
                  {showFilters && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                      <h4 className="font-semibold text-gray-900">Advanced Filters</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <Label>Status</Label>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Statuses</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                              <SelectItem value="fee_paid">Fee Paid</SelectItem>
                              <SelectItem value="disbursed">Disbursed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Date From</Label>
                          <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Date To</Label>
                          <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Min Amount ($)</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={amountMin}
                            onChange={(e) => setAmountMin(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Max Amount ($)</Label>
                          <Input
                            type="number"
                            placeholder="50000"
                            value={amountMax}
                            onChange={(e) => setAmountMax(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchTerm("");
                            setStatusFilter("all");
                            setDateFrom("");
                            setDateTo("");
                            setAmountMin("");
                            setAmountMax("");
                          }}
                        >
                          Clear Filters
                        </Button>
                        <p className="text-sm text-gray-600 flex items-center">
                          Showing {filteredLoans.length} of {loans?.length || 0} applications
                        </p>
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-12">
                      <div className="inline-block w-8 h-8 border-4 border-[#0033A0] border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-600 mt-4">Loading your applications...</p>
                    </div>
                  ) : filteredLoans && filteredLoans.length > 0 ? (
                    <div className="space-y-4">
                      {filteredLoans.map((loan) => (
                        <Card key={loan.id} id={`loan-${loan.id}`} className="border-l-4 border-l-[#0033A0]">
                          <CardContent className="p-6">
                            <button
                              onClick={() => setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}
                              className="w-full text-left hover:opacity-75 transition-opacity"
                            >
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-bold text-gray-800">
                                      {loan.loanType === "installment" ? "Installment Loan" : "Short-Term Loan"}
                                    </h3>
                                    {getStatusBadge(loan.status)}
                                  </div>
                                  <div className="mb-3">
                                    <p className="text-xs text-gray-500">Tracking Number</p>
                                    <p className="font-mono text-sm font-semibold text-[#0033A0]">
                                      {loan.trackingNumber}
                                    </p>
                                  </div>
                                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-500">Requested Amount</p>
                                      <p className="font-semibold text-gray-800">
                                        {formatCurrency(loan.requestedAmount)}
                                      </p>
                                    </div>
                                    {loan.approvedAmount && (
                                      <div>
                                        <p className="text-gray-500">Approved Amount</p>
                                        <p className="font-semibold text-green-600">
                                          {formatCurrency(loan.approvedAmount)}
                                        </p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-gray-500">Application Date</p>
                                      <p className="font-semibold text-gray-800">
                                        {formatDate(loan.createdAt)}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-2 md:min-w-fit">
                                  <ChevronDown
                                    className={`w-5 h-5 text-gray-400 transition-transform md:hidden ${
                                      expandedLoan === loan.id ? "rotate-180" : ""
                                    }`}
                                  />
                                  {(loan.status === "approved" || loan.status === "fee_pending") && (
                                    <>
                                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 mb-2 hidden md:block">
                                        <p className="font-semibold">Congratulations!</p>
                                        <p>Your loan has been approved.</p>
                                      </div>
                                      <Link href={`/payment/${loan.id}`}>
                                        <Button className="bg-[#FFA500] hover:bg-[#FF8C00] text-white w-full">
                                          Pay Processing Fee
                                        </Button>
                                      </Link>
                                    </>
                                  )}
                                  {loan.status === "fee_paid" && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 hidden md:block">
                                      <p className="font-semibold">Payment Confirmed</p>
                                      <p>Your loan is being processed.</p>
                                    </div>
                                  )}
                                  {loan.status === "disbursed" && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 hidden md:block">
                                      <p className="font-semibold">Funds Disbursed</p>
                                      <p>Check your bank account.</p>
                                    </div>
                                  )}
                                  {loan.status === "rejected" && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 hidden md:block">
                                      <p className="font-semibold">Not Approved</p>
                                      <p>Contact us for details.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>

                            {/* Expanded Details */}
                            {expandedLoan === loan.id && (
                              <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                                {/* Loan Terms Section - Only show for approved/fee_paid/disbursed loans */}
                                {(loan.status === "approved" || loan.status === "fee_paid" || loan.status === "disbursed") && loan.approvedAmount && (
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                    <h4 className="font-bold text-[#0033A0] mb-3 flex items-center gap-2">
                                      <Receipt className="w-4 h-4" />
                                      Loan Terms & Payment Details
                                    </h4>
                                    <div className="grid md:grid-cols-4 gap-4">
                                      <div>
                                        <p className="text-sm text-gray-600 mb-1">APR</p>
                                        <p className="font-semibold text-gray-800">
                                          {loan.loanType === "installment" ? "24.99%" : "35.99%"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-gray-600 mb-1">Interest Rate</p>
                                        <p className="font-semibold text-gray-800">
                                          {loan.loanType === "installment" ? "22.50%" : "32.00%"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-gray-600 mb-1">Monthly Payment</p>
                                        <p className="font-semibold text-green-600">
                                          {formatCurrency(Math.ceil(((loan.approvedAmount || 0) * 1.25) / (loan.loanType === "installment" ? 12 : 6)))}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-gray-600 mb-1">Loan Term</p>
                                        <p className="font-semibold text-gray-800">
                                          {loan.loanType === "installment" ? "12 months" : "6 months"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Processing Fee Breakdown - Show for approved/fee_pending/fee_paid/disbursed loans */}
                                {(loan.status === "approved" || loan.status === "fee_pending" || loan.status === "fee_paid" || loan.status === "disbursed") && loan.processingFeeAmount && (
                                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                                    <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                                      <DollarSign className="w-4 h-4" />
                                      Processing Fee Breakdown
                                    </h4>
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center pb-2 border-b border-orange-200">
                                        <span className="text-sm text-gray-600">Loan Amount</span>
                                        <span className="font-semibold text-gray-800">{formatCurrency(loan.approvedAmount || 0)}</span>
                                      </div>
                                      <div className="flex justify-between items-center pb-2">
                                        <span className="text-sm text-gray-600">Processing Fee</span>
                                        <span className="font-semibold text-lg text-orange-600">{formatCurrency(loan.processingFeeAmount)}</span>
                                      </div>
                                      <div className="text-xs text-orange-700 bg-orange-100 rounded p-2 mt-2">
                                        This fee covers administrative costs, loan processing, and verification services. The fee will be deducted when you pay before loan disbursement.
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Disbursement Details - Only show for disbursed loans */}
                                {loan.status === "disbursed" && (
                                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                    <h4 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                                      <TrendingUp className="w-4 h-4" />
                                      Disbursement Information
                                    </h4>
                                    <div className="grid md:grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-sm text-gray-600 mb-1">Disbursement Date</p>
                                        <p className="font-semibold text-gray-800">
                                          {formatDate(loan.createdAt)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-gray-600 mb-1">Disbursed Amount</p>
                                        <p className="font-semibold text-green-600">
                                          {formatCurrency(loan.approvedAmount || 0)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-gray-600 mb-1">Bank Account</p>
                                        <p className="font-semibold text-gray-800">
                                          ****{(loan as any).accountNumber?.slice(-4) || "1234"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-gray-600 mb-1">Processing Time</p>
                                        <p className="font-semibold text-gray-800">
                                          1-2 business days
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Next Steps Guidance */}
                                {loan.status === "pending" && (
                                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                    <h4 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                      <Clock className="w-4 h-4" />
                                      Next Steps
                                    </h4>
                                    <p className="text-sm text-yellow-800 mb-3">
                                      Your application is under review. Our team will contact you within 24-48 hours. Make sure to check your email and upload any required verification documents.
                                    </p>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        setWithdrawalLoanId(loan.id);
                                        setWithdrawalDialogOpen(true);
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <XCircle className="w-4 h-4" />
                                      Withdraw Application
                                    </Button>
                                  </div>
                                )}
                                
                                {loan.status === "under_review" && (
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                    <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                      <Clock className="w-4 h-4" />
                                      Under Review
                                    </h4>
                                    <p className="text-sm text-blue-800 mb-3">
                                      Your application is currently being reviewed by our team. We'll notify you of the decision soon.
                                    </p>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        setWithdrawalLoanId(loan.id);
                                        setWithdrawalDialogOpen(true);
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <XCircle className="w-4 h-4" />
                                      Withdraw Application
                                    </Button>
                                  </div>
                                )}

                {loan.status === "approved" && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Next Steps
                    </h4>
                    <p className="text-sm text-green-800 mb-3">
                      Congratulations! Your loan has been approved. Pay the processing fee to proceed with disbursement.
                    </p>
                    <Link href={`/payment/${loan.id}`}>
                      <Button className="bg-[#FFA500] hover:bg-[#FF8C00] text-white">
                        Pay Processing Fee ({formatCurrency(loan.processingFeeAmount || 0)})
                      </Button>
                    </Link>
                  </div>
                )}                                {loan.status === "fee_paid" && (
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                    <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                      <Clock className="w-4 h-4" />
                                      Next Steps
                                    </h4>
                                    <p className="text-sm text-blue-800">
                                      Payment confirmed! Your loan is being processed for disbursement. Funds will be transferred to your bank account within 1-2 business days.
                                    </p>
                                  </div>
                                )}

                                {loan.status === "disbursed" && (
                                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                    <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                                      <Calendar className="w-4 h-4" />
                                      Payment Schedule
                                    </h4>
                                    <p className="text-sm text-green-800 mb-3">
                                      Your first payment is due 30 days from disbursement. Set up automatic payments to avoid late fees.
                                    </p>
                                    <Button variant="outline" className="text-sm">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      View Full Payment Schedule
                                    </Button>
                                  </div>
                                )}

                                <div className="grid md:grid-cols-2 gap-6">
                                  <div>
                                    <p className="text-sm text-gray-600 mb-1">Loan Purpose</p>
                                    <p className="font-semibold text-gray-800 capitalize">
                                      {(loan as any).loanPurpose || "Not specified"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600 mb-1">Status</p>
                                    <p className="font-semibold text-gray-800 capitalize">
                                      {loan.status.replace("_", " ")}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600 mb-1">Employment Status</p>
                                    <p className="font-semibold text-gray-800">
                                      {(loan as any).employmentStatus || "Not specified"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600 mb-1">Annual Income</p>
                                    <p className="font-semibold text-gray-800">
                                      {(loan as any).annualIncome ? formatCurrency((loan as any).annualIncome) : "Not specified"}
                                    </p>
                                  </div>
                                </div>

                                {loan.status === "approved" && (
                                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 md:hidden">
                                    <p className="font-semibold text-green-800 mb-2">Congratulations!</p>
                                    <p className="text-sm text-green-800 mb-3">Your loan has been approved.</p>
                                    <Link href={`/payment/${loan.id}`}>
                                      <Button className="bg-[#FFA500] hover:bg-[#FF8C00] text-white w-full">
                                        Pay Processing Fee
                                      </Button>
                                    </Link>
                                  </div>
                                )}

                                {/* Document Downloads - For approved/disbursed loans */}
                                {(loan.status === "approved" || loan.status === "fee_paid" || loan.status === "disbursed") && (
                                  <div className="border-t border-gray-200 pt-4 mt-4">
                                    <h4 className="font-semibold text-gray-800 mb-3">Documents</h4>
                                    <div className="flex flex-wrap gap-2">
                                      <a href="/public/legal/loan-agreement" target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" size="sm">
                                          <Download className="w-3 h-3 mr-1" />
                                          Loan Agreement
                                        </Button>
                                      </a>
                                      <a href="/public/legal/truth-in-lending" target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" size="sm">
                                          <Download className="w-3 h-3 mr-1" />
                                          Truth in Lending Disclosure
                                        </Button>
                                      </a>
                                      {(loan.status === "fee_paid" || loan.status === "disbursed") && (
                                        <Button variant="outline" size="sm">
                                          <Download className="w-3 h-3 mr-1" />
                                          Processing Fee Receipt
                                        </Button>
                                      )}
                                      {loan.status === "disbursed" && (
                                        <Button variant="outline" size="sm">
                                          <Download className="w-3 h-3 mr-1" />
                                          Disbursement Confirmation
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    className="flex-1"
                                    onClick={() => {
                                      const loanCard = document.getElementById(`loan-${loan.id}`);
                                      if (loanCard) {
                                        loanCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      }
                                    }}
                                  >
                                    View Full Details
                                  </Button>
                                  {loan.status === "pending" && (
                                    <Link href={`/apply?edit=${loan.id}`}>
                                      <Button variant="outline" className="flex-1">
                                        Edit Application
                                      </Button>
                                    </Link>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">No Applications Yet</h3>
                      <p className="text-gray-600 mb-6">
                        You haven't submitted any loan applications. Ready to get started?
                      </p>
                      <Link href="/apply">
                        <Button className="bg-[#FFA500] hover:bg-[#FF8C00] text-white px-8">
                          Apply for a Loan
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Apply Tab - NEW FEATURE */}
            {activeTab === "quick-apply" && (
              <div className="space-y-6">
                <QuickApply 
                  existingUserData={{
                    name: user?.name || "",
                    email: user?.email || "",
                    phone: "", // Would come from user profile
                  }}
                />
              </div>
            )}

            {activeTab === "verification" && (
              <div className="space-y-6">
                {/* Document Progress Tracker - NEW FEATURE */}
                <DocumentProgressTracker />
                
                {/* Original Verification Upload */}
                <VerificationUpload />
              </div>
            )}

            {activeTab === "timeline" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl text-[#0033A0]">Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {loans && loans.length > 0 ? (
                      loans.map((loan) => (
                        <div key={loan.id} id={`loan-${loan.id}`} className="border-l-2 border-[#0033A0] pl-6 pb-6 relative">
                          <div className="absolute -left-3 w-6 h-6 bg-[#0033A0] rounded-full border-4 border-white"></div>
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="font-semibold text-gray-800 mb-1">
                              {loan.loanType === "installment" ? "Installment Loan" : "Short-Term Loan"} - {loan.status.replace("_", " ")}
                            </p>
                            <p className="text-sm text-gray-600 mb-2">
                              Tracking: {loan.trackingNumber}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(loan.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-600">No activity yet</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notifications Tab - ENHANCED */}
            {activeTab === "notifications" && (
              <NotificationCenter />
            )}

            {/* Documents Tab - ENHANCED */}
            {activeTab === "documents" && (
              <div className="space-y-6">
                {/* Document Download Component for each loan - NEW FEATURE */}
                {loans && loans.length > 0 && loans.map((loan) => (
                  loan.status === "approved" || loan.status === "fee_paid" || loan.status === "disbursed" || loan.status === "fee_pending" ? (
                    <div key={`download-${loan.id}`}>
                      <DocumentDownload 
                        loanId={loan.id}
                        trackingNumber={loan.trackingNumber}
                        status={loan.status}
                        approvedAmount={loan.approvedAmount ?? undefined}
                        processingFeeAmount={loan.processingFeeAmount ?? undefined}
                      />
                      
                      {/* Loan Application Progress - NEW FEATURE */}
                      <div className="mt-6">
                        <LoanApplicationProgress 
                          status={loan.status}
                          processingFeeAmount={loan.processingFeeAmount ?? undefined}
                          approvedAmount={loan.approvedAmount ?? undefined}
                        />
                      </div>
                    </div>
                  ) : null
                ))}
                
                {/* Legal Documents Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl text-[#0033A0]">Legal Documents</CardTitle>
                    <CardDescription>View our legal and policy documents</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="font-medium text-gray-900">Privacy Policy</p>
                            <p className="text-sm text-gray-600">Our privacy practices and data protection</p>
                          </div>
                        </div>
                        <a href="/public/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </a>
                      </div>
                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="font-medium text-gray-900">Terms of Service</p>
                            <p className="text-sm text-gray-600">Terms and conditions of using our service</p>
                          </div>
                        </div>
                        <a href="/public/legal/terms-of-service" target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "messages" && (
              <div className="space-y-6">
                {/* Support Tickets List & New Ticket Button */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl text-[#0033A0]">Support Tickets</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">View and manage your support conversations</p>
                      </div>
                      <Button 
                        onClick={() => setShowNewTicketForm(!showNewTicketForm)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        New Ticket
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* New Ticket Form */}
                    {showNewTicketForm && (
                      <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <h3 className="font-semibold text-gray-900 mb-4">Create New Support Ticket</h3>
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="ticket-category" className="block text-sm font-medium text-gray-700 mb-1">
                              Category
                            </label>
                            <select
                              id="ticket-category"
                              value={newTicketCategory}
                              onChange={(e) => setNewTicketCategory(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                            >
                              <option value="general_inquiry">General Inquiry</option>
                              <option value="loan_application">Loan Application</option>
                              <option value="payment_issue">Payment Issue</option>
                              <option value="account_settings">Account Settings</option>
                              <option value="technical_issue">Technical Issue</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Subject
                            </label>
                            <input
                              type="text"
                              value={newTicketSubject}
                              onChange={(e) => setNewTicketSubject(e.target.value)}
                              placeholder="Brief description of your issue..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Message
                            </label>
                            <textarea
                              value={newTicketMessage}
                              onChange={(e) => setNewTicketMessage(e.target.value)}
                              placeholder="Provide details about your issue..."
                              rows={4}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              onClick={handleCreateTicket}
                              disabled={createTicketMutation.isPending}
                              className="bg-[#0033A0] hover:bg-[#002080]"
                            >
                              {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
                            </Button>
                            <Button 
                              onClick={() => setShowNewTicketForm(false)}
                              variant="outline"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tickets List */}
                    {ticketsLoading ? (
                      <div className="text-center py-8 text-gray-500">Loading tickets...</div>
                    ) : supportTickets.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="font-medium">No support tickets yet</p>
                        <p className="text-sm mt-1">Click "New Ticket" to start a conversation with support</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {supportTickets.map((ticket: any) => (
                          <div
                            key={ticket.id}
                            onClick={() => setSelectedTicket(ticket.id)}
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                              selectedTicket === ticket.id
                                ? "border-[#0033A0] bg-blue-50"
                                : "border-gray-200 hover:border-gray-300 bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-gray-900">{ticket.subject}</h4>
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                    ticket.status === "open" 
                                      ? "bg-green-100 text-green-700"
                                      : ticket.status === "in_progress"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-gray-100 text-gray-700"
                                  }`}>
                                    {ticket.status.replace("_", " ")}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 line-clamp-2">{ticket.description}</p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                  <span>#{ticket.id}</span>
                                  <span>•</span>
                                  <span>{ticket.category.replace("_", " ")}</span>
                                  <span>•</span>
                                  <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Message Thread - Only show when ticket is selected */}
                {selectedTicket && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl text-[#0033A0]">Conversation</CardTitle>
                        <Button 
                          onClick={() => setSelectedTicket(null)}
                          variant="outline"
                          size="sm"
                        >
                          Close
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col h-96 border border-gray-200 rounded-lg overflow-hidden bg-white">
                        {/* Message Thread */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {messages.length > 0 ? (
                            messages.map((msg: any) => (
                              <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-start" : "justify-end"}`}>
                                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                  msg.isAdmin 
                                    ? "bg-gray-100 text-gray-800" 
                                    : "bg-[#0033A0] text-white"
                                }`}>
                                  <p className="font-semibold text-sm mb-1">{msg.sender}</p>
                                  <p className="text-sm break-words">{msg.message}</p>
                                  {msg.attachmentUrl && (
                                    <a
                                      href={msg.attachmentUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`flex items-center gap-1 mt-2 text-xs ${
                                        msg.isAdmin ? "text-blue-600 hover:text-blue-800" : "text-blue-200 hover:text-white"
                                      }`}
                                    >
                                      <Paperclip className="w-3 h-3" />
                                      <span>View attachment</span>
                                    </a>
                                  )}
                                  <p className={`text-xs mt-1 ${msg.isAdmin ? "text-gray-500" : "text-blue-100"}`}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-12 text-gray-500">
                              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                              <p>No messages yet. Send a message to start the conversation.</p>
                            </div>
                          )}
                        </div>

                        {/* Message Input */}
                        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
                          {/* File attachment preview */}
                          {messageAttachment && (
                            <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                              <FileText className="w-4 h-4 text-blue-600" />
                              <span className="text-sm text-blue-900 flex-1 truncate">{messageAttachment.name}</span>
                              <span className="text-xs text-blue-600">
                                {(messageAttachment.size / 1024).toFixed(1)} KB
                              </span>
                              <button
                                onClick={() => setMessageAttachment(null)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Remove attachment"
                                aria-label="Remove attachment"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            {/* File attachment button */}
                            <label className="cursor-pointer" title="Attach file">
                              <input
                                type="file"
                                accept="image/*,.pdf,.doc,.docx,.txt"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.size > 10 * 1024 * 1024) {
                                      toast.error("File size must be less than 10MB");
                                      return;
                                    }
                                    setMessageAttachment(file);
                                  }
                                }}
                                className="hidden"
                                aria-label="Attach file"
                              />
                              <div className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                                <Paperclip className="w-5 h-5 text-gray-600" />
                              </div>
                            </label>
                            
                            <input
                              type="text"
                              placeholder="Type your message..."
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                            />
                            <button
                              onClick={handleSendMessage}
                              disabled={!newMessage.trim() || addMessageMutation.isPending}
                              className="px-4 py-2 bg-[#0033A0] text-white rounded-lg hover:bg-[#002080] disabled:bg-gray-300 transition-colors"
                            >
                              {addMessageMutation.isPending ? "Sending..." : "Send"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === "payments" && (
              <div className="space-y-6">
                {/* Payment Method Management */}
                <PaymentMethodManager />
                
                {/* Payment Analytics Charts - Visual Insights */}
                <div className="mt-6">
                  <PaymentAnalyticsCharts payments={payments || []} />
                </div>
                
                {/* Payment History & Analytics - Detailed Table */}
                <div className="mt-6">
                  <PaymentHistoryAnalytics />
                </div>
              </div>
            )}

            {/* Auto-Pay Settings Tab - NEW FEATURE #4 */}
            {activeTab === "auto-pay" && (
              <AutoPaySettings loans={loans} />
            )}

            {/* Security & 2FA Tab - NEW FEATURE #2 */}
            {activeTab === "security" && (
              <TwoFactorAuth />
            )}

            {/* Payment Schedule Section */}
            <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-2xl text-[#0033A0]">Payment Schedule</CardTitle>
              <CardDescription>View your upcoming loan repayment schedule</CardDescription>
            </CardHeader>
            <CardContent>
              {loans && loans.filter(l => l.status === "disbursed").length > 0 ? (
                loans.filter(l => l.status === "disbursed").map(loan => {
                  const interestRate = 5.5; // Default interest rate
                  const loanTerm = 5; // Default loan term in years
                  const monthlyRate = (interestRate / 100) / 12;
                  const numPayments = loanTerm * 12;
                  const loanAmount = (loan.approvedAmount || 0) / 100;
                  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
                  
                  let balance = loanAmount;
                  const schedule = [];
                  
                  for (let i = 1; i <= Math.min(numPayments, 12); i++) {
                    const interestPayment = balance * monthlyRate;
                    const principalPayment = monthlyPayment - interestPayment;
                    balance -= principalPayment;
                    
                    schedule.push({
                      month: i,
                      payment: monthlyPayment,
                      principal: principalPayment,
                      interest: interestPayment,
                      balance: Math.max(0, balance)
                    });
                  }
                  
                  return (
                    <div key={loan.id} className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                        <div>
                          <p className="font-semibold text-gray-900">Loan ID: {loan.id}</p>
                          <p className="text-sm text-gray-600">
                            ${loanAmount.toLocaleString()} at {interestRate}% for {loanTerm} years
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Monthly Payment</p>
                          <p className="text-2xl font-bold text-[#0033A0]">
                            ${monthlyPayment.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Payment</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Principal</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Interest</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {schedule.map((row) => (
                              <tr key={row.month} className="hover:bg-gray-50">
                                <td className="py-3 px-4 text-sm text-gray-800">Payment {row.month}</td>
                                <td className="py-3 px-4 text-sm text-gray-800 text-right font-medium">
                                  ${row.payment.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-sm text-green-600 text-right">
                                  ${row.principal.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-sm text-amber-600 text-right">
                                  ${row.interest.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-800 text-right font-semibold">
                                  ${row.balance.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {numPayments > 12 && (
                        <p className="text-sm text-gray-500 text-center">
                          Showing first 12 payments of {numPayments} total
                        </p>
                      )}
                      
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => {
                          // Generate full schedule
                          const fullSchedule = [];
                          let bal = loanAmount;
                          for (let i = 1; i <= numPayments; i++) {
                            const interestPmt = bal * monthlyRate;
                            const principalPmt = monthlyPayment - interestPmt;
                            bal -= principalPmt;
                            fullSchedule.push({
                              month: i,
                              payment: monthlyPayment,
                              principal: principalPmt,
                              interest: interestPmt,
                              balance: Math.max(0, bal)
                            });
                          }
                          
                          // Create CSV
                          const csv = [
                            ['Month', 'Payment', 'Principal', 'Interest', 'Balance'].join(','),
                            ...fullSchedule.map(row => [
                              row.month,
                              row.payment.toFixed(2),
                              row.principal.toFixed(2),
                              row.interest.toFixed(2),
                              row.balance.toFixed(2)
                            ].join(','))
                          ].join('\n');
                          
                          const blob = new Blob([csv], { type: 'text/csv' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `payment-schedule-loan-${loan.id}.csv`;
                          a.click();
                          window.URL.revokeObjectURL(url);
                          toast.success('Payment schedule downloaded');
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Full Schedule
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No disbursed loans yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Payment schedule will appear after your loan is disbursed
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto-Pay Settings */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-2xl text-[#0033A0]">Auto-Pay Settings</CardTitle>
              <CardDescription>Set up automatic monthly payments</CardDescription>
            </CardHeader>
            <CardContent>
              {loans && loans.filter(l => l.status === "disbursed").length > 0 ? (
                <div className="space-y-6">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-900">Auto-Pay Coming Soon</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Automatic payment functionality will be available in the next update. 
                          You'll be able to link your bank account and set up recurring payments.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select disabled>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank">Bank Account</SelectItem>
                            <SelectItem value="card">Debit Card</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Payment Date</Label>
                        <Select disabled>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment date" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1st of month</SelectItem>
                            <SelectItem value="15">15th of month</SelectItem>
                            <SelectItem value="30">Last day of month</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Enable Auto-Pay</p>
                        <p className="text-sm text-gray-500">Automatically pay your monthly loan payment</p>
                      </div>
                      <Button disabled variant="outline">
                        Enable
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No active loans</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Auto-pay will be available once you have an active loan
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Help Section */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[#0033A0] mb-2">Need Help?</h3>
                <p className="text-gray-700 mb-4">
                  Our Loan Advocates are here to help you every step of the way. Call us Monday-Friday, 8am-8pm EST.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    className="bg-[#FFA500] hover:bg-[#FF8C00] text-white"
                    asChild
                  >
                    <a href="tel:+19452121609">
                      <Phone className="w-4 h-4 mr-2" />
                      +1 945 212-1609
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="border-[#0033A0] text-[#0033A0]"
                    asChild
                  >
                    <Link href="/#faq">
                      <a>View FAQs</a>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-gradient-to-r from-[#0033A0] to-[#003366] text-white py-8">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
              <div>
                <h4 className="font-semibold mb-3">Need Help?</h4>
                <div className="space-y-2 text-sm text-white/80">
                  <p>📞 <a href="tel:+19452121609" className="hover:text-[#FFA500] transition-colors">(945) 212-1609</a></p>
                  <p>📧 <a href="mailto:support@amerilendloan.com" className="hover:text-[#FFA500] transition-colors">support@amerilendloan.com</a></p>
                  <p>Hours: Mon-Fri 8am-8pm, Sat-Sun 9am-5pm CT</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Quick Links</h4>
                <ul className="space-y-2 text-sm text-white/80">
                  <li><a href="/" className="hover:text-[#FFA500] transition-colors">Home</a></li>
                  <li><a href="/#faq" className="hover:text-[#FFA500] transition-colors">FAQ</a></li>
                  <li><Link href="/settings"><span className="hover:text-[#FFA500] transition-colors">Settings</span></Link></li>
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

      {/* AI Support Widget - Only for authenticated users */}
      <AiSupportWidget isAuthenticated={true} />
            </div>
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="/" className="hover:text-[#FFA500] transition-colors">Home</a></li>
                <li><a href="/#faq" className="hover:text-[#FFA500] transition-colors">FAQ</a></li>
                <li><Link href="/settings"><span className="hover:text-[#FFA500] transition-colors">Settings</span></Link></li>
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

    {/* Withdrawal Confirmation Dialog */}
      <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Loan Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw this loan application? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="withdrawal-reason">Reason for withdrawal (optional)</Label>
              <Textarea
                id="withdrawal-reason"
                placeholder="Let us know why you're withdrawing your application..."
                value={withdrawalReason}
                onChange={(e) => setWithdrawalReason(e.target.value)}
                rows={4}
              />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Withdrawing your application will cancel it permanently. You can submit a new application at any time.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setWithdrawalDialogOpen(false);
                setWithdrawalLoanId(null);
                setWithdrawalReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (withdrawalLoanId) {
                  withdrawalMutation.mutate({
                    id: withdrawalLoanId,
                    reason: withdrawalReason || undefined,
                  });
                }
              }}
              disabled={withdrawalMutation.isPending}
            >
              {withdrawalMutation.isPending ? "Withdrawing..." : "Confirm Withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Support Widget - Only for authenticated users */}
      <AiSupportWidget isAuthenticated={true} />
    </div>
  );
}
