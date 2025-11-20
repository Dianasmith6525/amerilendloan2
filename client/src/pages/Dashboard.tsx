import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
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
  History,
  Bell,
  MessageSquare,
  Send,
  Download,
  Calendar,
  Receipt,
} from "lucide-react";
import { Link } from "wouter";
import VerificationUpload from "@/components/VerificationUpload";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  
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
  
  // Don't render if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }
  
  const { data: loans, isLoading } = trpc.loans.myApplications.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const [expandedLoan, setExpandedLoan] = useState<number | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState([
    { id: 1, sender: "Admin", message: "Hi! Thank you for choosing AmeriLend. How can we help?", timestamp: new Date(Date.now() - 86400000), isAdmin: true },
  ]);
  const [showMessages, setShowMessages] = useState(false);
  const [payments] = useState([
    { id: 1, loanId: 1, date: new Date(Date.now() - 2592000000), amount: 250, balance: 4750, status: "completed" },
    { id: 2, loanId: 1, date: new Date(Date.now() - 1296000000), amount: 250, balance: 4500, status: "completed" },
  ]);

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    setMessages([...messages, {
      id: messages.length + 1,
      sender: user?.name || "You",
      message: newMessage,
      timestamp: new Date(),
      isAdmin: false,
    }]);
    toast.success("Message sent to support team!");
    setNewMessage("");
  };

  // Calculate dashboard statistics
  const stats = {
    total: loans?.length || 0,
    approved: loans?.filter(l => l.status === "approved" || l.status === "fee_paid" || l.status === "disbursed").length || 0,
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
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-2 sm:py-2.5 md:py-3">
          <div className="flex items-center justify-between">
            <Link href="/">
              <a className="flex items-center flex-shrink-0">
                <img
                  src="/logo.jpg"
                  alt="AmeriLend"
                  className="h-20 sm:h-24 md:h-28 w-auto object-contain brightness-105 contrast-110"
                />
              </a>
            </Link>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 text-gray-700 hover:text-[#0033A0]">
                <Bell className="w-4 h-4" />
                <span className="text-sm">Notifications</span>
              </div>
              <a
                href="tel:+19452121609"
                className="hidden md:flex items-center gap-2 text-gray-700 hover:text-[#0033A0]"
              >
                <Phone className="w-4 h-4" />
                +1 945 212-1609
              </a>
              {user?.role === "admin" && (
                <Link href="/admin">
                  <Button variant="outline" className="border-[#0033A0] text-[#0033A0]">
                    Admin Panel
                  </Button>
                </Link>
              )}
              
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
                        Settings & Security
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

      {/* Welcome Banner */}
      <div className="bg-[#0033A0] text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name || "Valued Customer"}!</h1>
          <p className="text-white/90">
            Manage your loan applications and track your progress.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Analytics Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Applications</p>
                    <p className="text-2xl sm:text-3xl font-bold text-[#0033A0]">{stats.total}</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Approved</p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.approved}</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Pending Review</p>
                    <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{stats.pending}</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Funded</p>
                    <p className="text-xl sm:text-3xl font-bold text-green-600">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format((stats.totalFunded || 0) / 100)}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-[#0033A0] mb-1">New Application</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Start a new loan application
                    </p>
                    <Link href="/apply">
                      <Button className="bg-[#FFA500] hover:bg-[#FF8C00] text-white w-full">
                        Apply Now
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-[#0033A0] mb-1">Contact Support</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Speak with a Loan Advocate
                    </p>
                    <Button
                      variant="outline"
                      className="border-[#0033A0] text-[#0033A0] w-full"
                      asChild
                    >
                      <a href="tel:+19452121609">Call Now</a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <History className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-[#0033A0] mb-1">Application History</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      View all past applications
                    </p>
                    <Link href="#applications">
                      <Button variant="outline" className="border-green-500 text-green-600 w-full">
                        View History
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Tabs defaultValue="applications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="applications">My Applications</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="payments">Payment History</TabsTrigger>
            <TabsTrigger value="timeline">Activity</TabsTrigger>
          </TabsList>            <TabsContent value="applications" id="applications">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl text-[#0033A0]">My Loan Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-12">
                      <div className="inline-block w-8 h-8 border-4 border-[#0033A0] border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-600 mt-4">Loading your applications...</p>
                    </div>
                  ) : loans && loans.length > 0 ? (
                    <div className="space-y-4">
                      {loans.map((loan) => (
                        <Card key={loan.id} className="border-l-4 border-l-[#0033A0]">
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
                                  {loan.status === "approved" && (
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
                                          {formatCurrency(Math.ceil((loan.approvedAmount * 1.25) / (loan.loanType === "installment" ? 12 : 6)))}
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
                                    <p className="text-sm text-yellow-800">
                                      Your application is under review. Our team will contact you within 24-48 hours. Make sure to check your email and upload any required verification documents.
                                    </p>
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
                                        Pay Processing Fee ({formatCurrency(loan.approvedAmount ? loan.approvedAmount * 0.05 : 0)})
                                      </Button>
                                    </Link>
                                  </div>
                                )}

                                {loan.status === "fee_paid" && (
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
                                      <Button variant="outline" size="sm">
                                        <Download className="w-3 h-3 mr-1" />
                                        Loan Agreement
                                      </Button>
                                      <Button variant="outline" size="sm">
                                        <Download className="w-3 h-3 mr-1" />
                                        Truth in Lending Disclosure
                                      </Button>
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
                                  <Button variant="outline" className="flex-1">
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
            </TabsContent>

            <TabsContent value="verification">
              <VerificationUpload />
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl text-[#0033A0]">Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {loans && loans.length > 0 ? (
                      loans.map((loan) => (
                        <div key={loan.id} className="border-l-2 border-[#0033A0] pl-6 pb-6 relative">
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
            </TabsContent>

            <TabsContent value="messages">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl text-[#0033A0]">Messages</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Communication with support team</p>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col h-96 border border-gray-200 rounded-lg overflow-hidden bg-white">
                    {/* Message Thread */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.length > 0 ? (
                        messages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-start" : "justify-end"}`}>
                            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              msg.isAdmin 
                                ? "bg-gray-100 text-gray-800" 
                                : "bg-[#0033A0] text-white"
                            }`}>
                              <p className="font-semibold text-sm mb-1">{msg.sender}</p>
                              <p className="text-sm break-words">{msg.message}</p>
                              <p className={`text-xs mt-1 ${msg.isAdmin ? "text-gray-500" : "text-blue-100"}`}>
                                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p>No messages yet. Send a message to start a conversation.</p>
                        </div>
                      )}
                    </div>

                    {/* Message Input */}
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Type your message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0]"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim()}
                          className="px-4 py-2 bg-[#0033A0] text-white rounded-lg hover:bg-[#002080] disabled:bg-gray-300 transition-colors"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl text-[#0033A0]">Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tracking #</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {loans && loans.filter(loan => loan.status === "fee_paid" || loan.status === "disbursed").length > 0 ? (
                          loans
                            .filter(loan => loan.status === "fee_paid" || loan.status === "disbursed")
                            .map((loan) => (
                              <tr key={loan.id} className="hover:bg-gray-50">
                                <td className="py-3 px-4 text-sm text-gray-800">
                                  {formatDate(loan.createdAt)}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-800">
                                  Processing Fee
                                </td>
                                <td className="py-3 px-4 text-sm font-semibold text-gray-800">
                                  {formatCurrency(loan.approvedAmount ? loan.approvedAmount * 0.05 : 0)}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Paid
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-sm font-mono text-[#0033A0]">
                                  {loan.trackingNumber}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                  >
                                    <Download className="w-3 h-3 mr-1" />
                                    Receipt
                                  </Button>
                                </td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="text-center py-12">
                              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                              <p className="text-gray-600">No payment history yet</p>
                              <p className="text-sm text-gray-500 mt-1">
                                Payments will appear here once you pay processing fees
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>

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
      </div>

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
  );
}
