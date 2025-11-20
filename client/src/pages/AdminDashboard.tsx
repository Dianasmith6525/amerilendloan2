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
import { Loader2, Settings, DollarSign, CheckCircle, XCircle, Send, LogOut, Users, FileText, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import VerificationDocumentsAdmin from "@/components/VerificationDocumentsAdmin";

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

  // Fee configuration states
  const [feeMode, setFeeMode] = useState<"percentage" | "fixed">("percentage");
  const [percentageRate, setPercentageRate] = useState("2.00");
  const [fixedFeeAmount, setFixedFeeAmount] = useState("2.00");

  // Query data
  const { data: applications, isLoading } = trpc.loans.adminList.useQuery();
  const { data: feeConfig } = trpc.feeConfig.getActive.useQuery();

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

  const updateFeeConfigMutation = trpc.feeConfig.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("Fee configuration updated successfully");
      utils.feeConfig.getActive.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update fee configuration");
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

  const handleUpdateFeeConfig = () => {
    if (feeMode === "percentage") {
      const rate = parseFloat(percentageRate);
      if (isNaN(rate) || rate < 1.5 || rate > 2.5) {
        toast.error("Percentage rate must be between 1.5% and 2.5%");
        return;
      }
      updateFeeConfigMutation.mutate({
        calculationMode: "percentage",
        percentageRate: Math.round(rate * 100),
      });
    } else {
      const amount = parseFloat(fixedFeeAmount);
      if (isNaN(amount) || amount < 1.5 || amount > 2.5) {
        toast.error("Fixed fee must be between $1.50 and $2.50");
        return;
      }
      updateFeeConfigMutation.mutate({
        calculationMode: "fixed",
        fixedFeeAmount: Math.round(amount * 100),
      });
    }
  };

  // Calculate stats
  const stats = {
    total: applications?.length || 0,
    pending: applications?.filter(a => a.status === "pending" || a.status === "under_review").length || 0,
    approved: applications?.filter(a => a.status === "approved").length || 0,
    disbursed: applications?.filter(a => a.status === "disbursed").length || 0,
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Applications</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
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

        {/* Tabs */}
        <Tabs defaultValue="applications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="applications">Loan Applications</TabsTrigger>
            <TabsTrigger value="verification">Verification Documents</TabsTrigger>
            <TabsTrigger value="settings">Fee Configuration</TabsTrigger>
          </TabsList>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-6">
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
                applications.map((app) => (
                  <Card key={app.id} className="hover:shadow-lg transition">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-lg">{app.fullName}</CardTitle>
                          <CardDescription>
                            ID: {app.id} • Applied {new Date(app.createdAt).toLocaleDateString()}
                          </CardDescription>
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
                          <Button
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700"
                            onClick={() => setDisbursementDialog({ open: true, applicationId: app.id })}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Initiate Disbursement
                          </Button>
                        )}
                      </div>
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
                      <Label htmlFor="percentageRate" className="text-base font-semibold">Percentage Rate (1.5% - 2.5%)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="percentageRate"
                          type="number"
                          step="0.01"
                          min="1.5"
                          max="2.5"
                          value={percentageRate}
                          onChange={(e) => setPercentageRate(e.target.value)}
                          className="flex-1"
                        />
                        <span className="text-gray-600 font-medium">%</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Example: 2.00% of $10,000 loan = $200 processing fee
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="fixedFeeAmount" className="text-base font-semibold">Fixed Fee Amount ($1.50 - $2.50)</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 font-medium">$</span>
                        <Input
                          id="fixedFeeAmount"
                          type="number"
                          step="0.01"
                          min="1.5"
                          max="2.5"
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
    </div>
  );
}
