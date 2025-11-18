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
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Loader2, Settings, DollarSign, CheckCircle, XCircle, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import VerificationDocumentsAdmin from "@/components/VerificationDocumentsAdmin";

const statusColors = {
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
  
  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }
  
  // Don't render if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }
  
  const utils = trpc.useUtils();

  // Approval dialog state
  const [approvalDialog, setApprovalDialog] = useState<{ open: boolean; applicationId: number | null }>({
    open: false,
    applicationId: null,
  });
  const [approvalAmount, setApprovalAmount] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");

  // Rejection dialog state
  const [rejectionDialog, setRejectionDialog] = useState<{ open: boolean; applicationId: number | null }>({
    open: false,
    applicationId: null,
  });
  const [rejectionReason, setRejectionReason] = useState("");

  // Disbursement dialog state
  const [disbursementDialog, setDisbursementDialog] = useState<{ open: boolean; applicationId: number | null }>({
    open: false,
    applicationId: null,
  });
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [disbursementNotes, setDisbursementNotes] = useState("");

  // Fee config state
  const [feeMode, setFeeMode] = useState<"percentage" | "fixed">("percentage");
  const [percentageRate, setPercentageRate] = useState("2.00");
  const [fixedFeeAmount, setFixedFeeAmount] = useState("2.00");

  const { data: applications, isLoading } = trpc.loans.adminList.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const { data: feeConfig } = trpc.feeConfig.getActive.useQuery();

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
      toast.success("Loan rejected");
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
      toast.success("Fee configuration updated");
      utils.feeConfig.getActive.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update fee configuration");
    },
  });

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
        percentageRate: Math.round(rate * 100), // Convert to basis points
      });
    } else {
      const amount = parseFloat(fixedFeeAmount);
      if (isNaN(amount) || amount < 1.5 || amount > 2.5) {
        toast.error("Fixed fee must be between $1.50 and $2.50");
        return;
      }
      updateFeeConfigMutation.mutate({
        calculationMode: "fixed",
        fixedFeeAmount: Math.round(amount * 100), // Convert to cents
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>
              You must be an administrator to access this page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isAuthenticated ? (
              <Button className="w-full" asChild>
                <a href={getLoginUrl()}>Sign In</a>
              </Button>
            ) : (
              <Button className="w-full" onClick={() => setLocation("/dashboard")}>
                Return to Dashboard
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <img src="/logo.jpg" alt="AmeriLend" className="h-16 w-auto logo-blend" />
              <Badge variant="secondary">Admin</Badge>
            </div>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost">User Dashboard</Button>
            </Link>
            <Button variant="ghost" onClick={() => logout()}>
              Sign Out
            </Button>
          </nav>
        </div>
      </header>

      {/* Admin Content */}
      <div className="container py-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">Admin Dashboard</h2>

          <Tabs defaultValue="applications" className="space-y-6">
            <TabsList>
              <TabsTrigger value="applications">Loan Applications</TabsTrigger>
              <TabsTrigger value="verification">Verification Documents</TabsTrigger>
              <TabsTrigger value="settings">Fee Configuration</TabsTrigger>
            </TabsList>

            {/* Applications Tab */}
            <TabsContent value="applications" className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : applications && applications.length > 0 ? (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <Card key={app.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle>
                              {app.fullName} - {app.loanType === "installment" ? "Installment" : "Short-Term"}
                            </CardTitle>
                            <CardDescription>
                              Applied {new Date(app.createdAt).toLocaleDateString()} | ID: {app.id}
                            </CardDescription>
                          </div>
                          <Badge className={statusColors[app.status]}>{app.status}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Requested</p>
                            <p className="font-semibold">
                              ${(app.requestedAmount / 100).toLocaleString()}
                            </p>
                          </div>
                          {app.approvedAmount && (
                            <div>
                              <p className="text-sm text-muted-foreground">Approved</p>
                              <p className="font-semibold text-accent">
                                ${(app.approvedAmount / 100).toLocaleString()}
                              </p>
                            </div>
                          )}
                          {app.processingFeeAmount && (
                            <div>
                              <p className="text-sm text-muted-foreground">Processing Fee</p>
                              <p className="font-semibold">
                                ${(app.processingFeeAmount / 100).toFixed(2)}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-muted-foreground">Monthly Income</p>
                            <p className="font-semibold">
                              ${(app.monthlyIncome / 100).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Email: {app.email}</p>
                            <p className="text-muted-foreground">Phone: {app.phone}</p>
                            <p className="text-muted-foreground">
                              Employment: {app.employmentStatus}
                              {app.employer && ` at ${app.employer}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">
                              Address: {app.street}, {app.city}, {app.state} {app.zipCode}
                            </p>
                            <p className="text-muted-foreground">Purpose: {app.loanPurpose}</p>
                          </div>
                        </div>

                        {app.adminNotes && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-3">
                            <p className="text-sm font-medium text-blue-900">Admin Notes:</p>
                            <p className="text-sm text-blue-800">{app.adminNotes}</p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          {(app.status === "pending" || app.status === "under_review") && (
                            <>
                              <Button
                                size="sm"
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
                                onClick={() =>
                                  setRejectionDialog({ open: true, applicationId: app.id })
                                }
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                            </>
                          )}
                          {app.status === "fee_paid" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                setDisbursementDialog({ open: true, applicationId: app.id })
                              }
                            >
                              <Send className="mr-2 h-4 w-4" />
                              Initiate Disbursement
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No loan applications found</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Verification Documents Tab */}
            <TabsContent value="verification" className="space-y-6">
              <VerificationDocumentsAdmin />
            </TabsContent>

            {/* Settings Tab */}
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-blue-900 mb-2">Current Configuration</p>
                      <p className="text-sm text-blue-800">
                        Mode: <strong>{feeConfig.calculationMode}</strong>
                        {feeConfig.calculationMode === "percentage"
                          ? ` | Rate: ${(feeConfig.percentageRate / 100).toFixed(2)}%`
                          : ` | Fee: $${(feeConfig.fixedFeeAmount / 100).toFixed(2)}`}
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Calculation Mode</Label>
                      <Select value={feeMode} onValueChange={(v) => setFeeMode(v as "percentage" | "fixed")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage of Loan Amount</SelectItem>
                          <SelectItem value="fixed">Fixed Fee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {feeMode === "percentage" ? (
                      <div className="space-y-2">
                        <Label htmlFor="percentageRate">
                          Percentage Rate (1.5% - 2.5%)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="percentageRate"
                            type="number"
                            step="0.01"
                            min="1.5"
                            max="2.5"
                            value={percentageRate}
                            onChange={(e) => setPercentageRate(e.target.value)}
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Example: 2.00% of $10,000 = $200 processing fee
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="fixedFeeAmount">
                          Fixed Fee Amount ($1.50 - $2.50)
                        </Label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            id="fixedFeeAmount"
                            type="number"
                            step="0.01"
                            min="1.5"
                            max="2.5"
                            value={fixedFeeAmount}
                            onChange={(e) => setFixedFeeAmount(e.target.value)}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          This fee will be charged regardless of loan amount
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleUpdateFeeConfig}
                      disabled={updateFeeConfigMutation.isPending}
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
        </div>
      </div>

      {/* Approval Dialog */}
      <Dialog open={approvalDialog.open} onOpenChange={(open) => setApprovalDialog({ ...approvalDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Loan Application</DialogTitle>
            <DialogDescription>
              Enter the approved loan amount and any notes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
            <DialogDescription>
              Provide a reason for rejection
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
            <DialogDescription>
              Enter bank account details for disbursement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
