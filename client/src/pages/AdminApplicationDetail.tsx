import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Loader2, ArrowLeft, User, FileText, CreditCard, Send, 
  AlertCircle, CheckCircle, XCircle, Clock, Download,
  Shield, MapPin, Briefcase, DollarSign, Calendar,
  Phone, Mail, Hash, Building, Eye, EyeOff, Banknote, Bell, Upload
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  under_review: "bg-blue-100 text-blue-800 border-blue-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  fee_pending: "bg-orange-100 text-orange-800 border-orange-300",
  fee_paid: "bg-purple-100 text-purple-800 border-purple-300",
  disbursed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  cancelled: "bg-gray-100 text-gray-800 border-gray-300",
};

export default function AdminApplicationDetail() {
  const [, params] = useRoute("/admin/application/:id");
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const applicationId = params?.id ? parseInt(params.id) : null;
  const [showBankCredentials, setShowBankCredentials] = useState(false);
  const [showSSN, setShowSSN] = useState(false);

  // Action dialog states
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [rejectionDialog, setRejectionDialog] = useState(false);
  const [disbursementDialog, setDisbursementDialog] = useState(false);
  const [feeVerificationDialog, setFeeVerificationDialog] = useState(false);

  // Form states
  const [approvalAmount, setApprovalAmount] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [disbursementNotes, setDisbursementNotes] = useState("");
  const [disbursementTarget, setDisbursementTarget] = useState<"amerilend_account" | "external_account">("amerilend_account");
  const [selectedAmeriLendAccount, setSelectedAmeriLendAccount] = useState<number | "">("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [feeVerificationNotes, setFeeVerificationNotes] = useState("");

  // Redirect if not admin
  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data, isLoading, error } = trpc.loans.adminGetApplicationDetails.useQuery(
    { id: applicationId! },
    { enabled: !!applicationId && user?.role === "admin" }
  );

  const userBankAccounts = trpc.disbursements.getUserBankAccounts.useQuery(
    { loanApplicationId: applicationId! },
    { enabled: disbursementDialog && !!applicationId }
  );

  const utils = trpc.useUtils();

  // Action mutations
  const approveMutation = trpc.loans.adminApprove.useMutation({
    onSuccess: () => {
      toast.success("Application approved successfully");
      setApprovalDialog(false);
      setApprovalAmount("");
      setApprovalNotes("");
      utils.loans.adminGetApplicationDetails.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to approve"),
  });

  const rejectMutation = trpc.loans.adminReject.useMutation({
    onSuccess: () => {
      toast.success("Application rejected");
      setRejectionDialog(false);
      setRejectionReason("");
      utils.loans.adminGetApplicationDetails.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to reject"),
  });

  const disburseMutation = trpc.disbursements.adminInitiate.useMutation({
    onSuccess: (result) => {
      const msg = result.disbursementTarget === "amerilend_account"
        ? `${result.amountFormatted} disbursed to AmeriLend account instantly!`
        : `Disbursement of ${result.amountFormatted} initiated to external account`;
      toast.success(msg);
      setDisbursementDialog(false);
      setDisbursementTarget("amerilend_account");
      setSelectedAmeriLendAccount("");
      setAccountHolderName("");
      setAccountNumber("");
      setRoutingNumber("");
      setDisbursementNotes("");
      utils.loans.adminGetApplicationDetails.invalidate();
      utils.disbursements.adminList.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to initiate disbursement"),
  });

  const verifyFeePaymentMutation = trpc.loans.adminVerifyFeePayment.useMutation({
    onSuccess: () => {
      toast.success("Fee payment verified");
      setFeeVerificationDialog(false);
      setFeeVerificationNotes("");
      utils.loans.adminGetApplicationDetails.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to verify fee"),
  });

  const sendFeeReminderMutation = trpc.loans.adminSendFeeReminder.useMutation({
    onSuccess: () => toast.success("Fee reminder email sent"),
    onError: (err) => toast.error(err.message || "Failed to send reminder"),
  });

  const sendDocumentReminderMutation = trpc.loans.adminSendDocumentReminder.useMutation({
    onSuccess: () => toast.success("Document reminder email sent"),
    onError: (err) => toast.error(err.message || "Failed to send reminder"),
  });

  // Safety net: re-issue virtual card for a disbursed loan if the
  // auto-issue inside `disbursements.adminInitiate` was silently swallowed.
  const ensureCardMutation = trpc.virtualCards.ensureCardForLoan.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.created
          ? `Virtual card issued (last 4: ${res.card.cardNumberLast4})`
          : `Active card already exists (last 4: ${res.card.cardNumberLast4})`
      );
      utils.loans.adminGetApplicationDetails.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to issue card"),
  });

  // Action handlers
  const handleApprove = () => {
    if (!applicationId) return;
    const amountCents = Math.round(parseFloat(approvalAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error("Enter a valid approval amount");
      return;
    }
    approveMutation.mutate({ id: applicationId, approvedAmount: amountCents, adminNotes: approvalNotes || undefined });
  };

  const handleReject = () => {
    if (!applicationId || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    rejectMutation.mutate({ id: applicationId, rejectionReason });
  };

  const handleDisburse = () => {
    if (!applicationId) return;
    if (disbursementTarget === "amerilend_account") {
      if (!selectedAmeriLendAccount) {
        toast.error("Please select an AmeriLend bank account");
        return;
      }
      disburseMutation.mutate({
        loanApplicationId: applicationId,
        disbursementTarget: "amerilend_account",
        amerilendBankAccountId: Number(selectedAmeriLendAccount),
        adminNotes: disbursementNotes || undefined,
      });
    } else {
      if (!accountHolderName.trim() || !accountNumber.trim() || !routingNumber.trim()) {
        toast.error("Please fill in all bank account details");
        return;
      }
      disburseMutation.mutate({
        loanApplicationId: applicationId,
        disbursementTarget: "external_account",
        accountHolderName,
        accountNumber,
        routingNumber,
        adminNotes: disbursementNotes || undefined,
      });
    }
  };

  const handleVerifyFeePayment = () => {
    if (!applicationId) return;
    verifyFeePaymentMutation.mutate({ id: applicationId, verified: true, adminNotes: feeVerificationNotes || undefined });
  };

  const getBankPasswordQuery = trpc.loans.adminGetBankPassword.useQuery(
    { applicationId: applicationId! },
    { enabled: showBankCredentials && !!applicationId }
  );

  const getSSNQuery = trpc.loans.adminGetSSN.useQuery(
    { applicationId: applicationId! },
    { enabled: showSSN && !!applicationId }
  );

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!applicationId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">Invalid application ID</p>
            <Button onClick={() => setLocation("/admin")} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">{error?.message || "Application not found"}</p>
            <Button onClick={() => setLocation("/admin")} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { application, user: applicantUser, payments, disbursement, documents, verificationDocs, kycVerification, activityLog } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/admin")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Application #{application.id}
                </h1>
                <p className="text-sm text-gray-600">
                  Tracking: {application.trackingNumber}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={statusColors[application.status] || "bg-gray-100"}>
                {application.status}
              </Badge>

              {/* Action buttons based on status */}
              {(application.status === "pending" || application.status === "under_review") && (
                <>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => {
                    setApprovalAmount(((application as any).requestedAmount ? ((application as any).requestedAmount / 100).toString() : ""));
                    setApprovalDialog(true);
                  }}>
                    <CheckCircle className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectionDialog(true)}>
                    <XCircle className="mr-1 h-4 w-4" /> Reject
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => sendDocumentReminderMutation.mutate({ id: applicationId! })}>
                    <Bell className="mr-1 h-4 w-4" /> Doc Reminder
                  </Button>
                </>
              )}

              {application.status === "approved" && (
                <Button size="sm" variant="outline" onClick={() => sendFeeReminderMutation.mutate({ id: applicationId! })}>
                  <Bell className="mr-1 h-4 w-4" /> Fee Reminder
                </Button>
              )}

              {application.status === "fee_pending" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => sendFeeReminderMutation.mutate({ id: applicationId! })}>
                    <Bell className="mr-1 h-4 w-4" /> Fee Reminder
                  </Button>
                </>
              )}

              {application.status === "fee_paid" && (
                <>
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setFeeVerificationDialog(true)}>
                    <DollarSign className="mr-1 h-4 w-4" /> Verify Fee
                  </Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setDisbursementDialog(true)}>
                    <Banknote className="mr-1 h-4 w-4" /> Disburse
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="applicant">Applicant Info</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="disbursement">Disbursement</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Application Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Application Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Requested Amount</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(application.requestedAmount)}
                      </p>
                    </div>
                    {application.approvedAmount && (
                      <div>
                        <p className="text-sm text-gray-600">Approved Amount</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(application.approvedAmount)}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {application.processingFeeAmount && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Processing Fee</span>
                      <div className="text-right">
                        <p className="font-bold text-blue-900">
                          {formatCurrency(application.processingFeeAmount)}
                        </p>
                        {application.feePaymentVerified ? (
                          <Badge className="mt-1 bg-green-100 text-green-800 text-xs">
                            ✓ Verified
                          </Badge>
                        ) : application.status === "fee_paid" ? (
                          <Badge className="mt-1 bg-amber-100 text-amber-800 text-xs">
                            Pending Verification
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Loan Type</span>
                      <span className="font-medium capitalize">{application.loanType.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Disbursement Method</span>
                      <span className="font-medium capitalize">{application.disbursementMethod.replace('_', ' ')}</span>
                    </div>
                    
                    {/* Bank Account Details for Direct Deposit */}
                    {application.disbursementMethod === 'bank_transfer' && application.bankName && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-[#0A2540] text-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Bank Account Information
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowBankCredentials(!showBankCredentials)}
                            className="h-7 text-xs"
                          >
                            {showBankCredentials ? (
                              <><EyeOff className="h-3 w-3 mr-1" /> Hide Credentials</>
                            ) : (
                              <><Eye className="h-3 w-3 mr-1" /> Show Credentials</>
                            )}
                          </Button>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Bank Name</span>
                          <span className="font-medium">{application.bankName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Online Banking Username</span>
                          {showBankCredentials ? (
                            <span className="font-medium font-mono text-xs bg-white px-2 py-1 rounded border border-blue-300">
                              {application.bankUsername || 'Not provided'}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-gray-400">••••••••</span>
                          )}
                        </div>
                        <div className="flex justify-between text-sm items-start">
                          <span className="text-gray-600">Password</span>
                          <div className="text-right">
                            {application.bankPassword ? (
                              showBankCredentials ? (
                                getBankPasswordQuery.isFetching ? (
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span className="text-xs text-gray-500">Decrypting...</span>
                                  </div>
                                ) : getBankPasswordQuery.isError ? (
                                  <div className="space-y-1">
                                    <div className="font-mono text-xs bg-yellow-50 px-2 py-1 rounded border border-yellow-300 text-yellow-800">
                                      ⚠️ Failed to decrypt
                                    </div>
                                    <p className="text-xs text-gray-500 max-w-xs">
                                      {getBankPasswordQuery.error?.message || "Unable to decrypt password. Please contact support."}
                                    </p>
                                  </div>
                                ) : getBankPasswordQuery.data?.password ? (
                                  <div className="space-y-1">
                                    <div className="font-mono text-xs bg-green-50 px-3 py-1.5 rounded border border-green-300 text-green-800 select-all">
                                      {getBankPasswordQuery.data.password}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      Click to select and copy
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="font-mono text-xs bg-yellow-50 px-2 py-1 rounded border border-yellow-300 text-yellow-800">
                                      ⚠️ Failed to decrypt
                                    </div>
                                    <p className="text-xs text-gray-500 max-w-xs">
                                      Unable to decrypt password. Please contact support.
                                    </p>
                                  </div>
                                )
                              ) : (
                                <span className="text-green-600 flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Encrypted & Stored
                                </span>
                              )
                            ) : (
                              <span className="text-gray-400">Not provided</span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-blue-700 mt-2">
                          🔒 Bank credentials are encrypted for security and can be decrypted by admins for verification
                        </p>
                      </div>
                    )}
                    
                    
                    {/* Invitation Code Badge */}
                    {application.invitationCode && (
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-600">Invitation Code</span>
                        <code className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded text-xs font-mono font-bold">
                          {application.invitationCode}
                        </code>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Applied On</span>
                      <span className="font-medium">
                        {new Date(application.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {application.approvedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Approved On</span>
                        <span className="font-medium">
                          {new Date(application.approvedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {application.disbursedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Disbursed On</span>
                        <span className="font-medium">
                          {new Date(application.disbursedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {application.status === "disbursed" && (
                    <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3">
                      <p className="text-xs text-blue-900 mb-2">
                        Virtual card not visible to user? Re-run the issuance safety net (idempotent).
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                        disabled={ensureCardMutation.isPending}
                        onClick={() => ensureCardMutation.mutate({ loanApplicationId: applicationId! })}
                      >
                        {ensureCardMutation.isPending ? "Working…" : "Issue / Verify Virtual Card"}
                      </Button>
                    </div>
                  )}

                  {application.loanPurpose && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Loan Purpose</p>
                        <p className="text-sm text-gray-900">{application.loanPurpose}</p>
                      </div>
                    </>
                  )}

                  {application.adminNotes && (
                    <>
                      <Separator />
                      <div className="bg-amber-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-amber-900 mb-1">Admin Notes</p>
                        <p className="text-sm text-amber-800 whitespace-pre-wrap">{application.adminNotes}</p>
                      </div>
                    </>
                  )}

                  {application.rejectionReason && (
                    <>
                      <Separator />
                      <div className="bg-red-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-red-900 mb-1">Rejection Reason</p>
                        <p className="text-sm text-red-800">{application.rejectionReason}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Financial Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Financial Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Monthly Income</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(application.monthlyIncome)}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Employment Status</span>
                      <span className="font-medium capitalize">{application.employmentStatus.replace('_', ' ')}</span>
                    </div>
                    {application.employer && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Employer</span>
                        <span className="font-medium">{application.employer}</span>
                      </div>
                    )}
                  </div>

                  {payments && payments.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Payment Summary</p>
                        <div className="space-y-1">
                          {payments.map((payment) => (
                            <div key={payment.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                              <span className="capitalize">{payment.paymentMethod.replace('_', ' ')}</span>
                              <span className="font-medium">{formatCurrency(payment.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Applicant Info Tab */}
          <TabsContent value="applicant" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Full Name</p>
                    <p className="font-medium text-gray-900">{application.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date of Birth</p>
                    <p className="font-medium text-gray-900">{application.dateOfBirth}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">SSN</p>
                    <div className="flex items-center gap-2">
                      {showSSN ? (
                        <>
                          <p className="font-medium text-gray-900 font-mono">
                            {getSSNQuery.isFetching
                              ? "Decrypting..."
                              : getSSNQuery.isError
                                ? `Error: ${getSSNQuery.error?.message || "Unable to decrypt"}`
                                : (getSSNQuery.data?.ssn || "Unable to decrypt")}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSSN(false)}
                          >
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-500 font-mono">••••••••••</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSSN(true)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium text-gray-900">{application.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium text-gray-900">{application.phone}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Address */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium text-gray-900">{application.street}</p>
                  <p className="text-gray-600">
                    {application.city}, {application.state} {application.zipCode}
                  </p>
                </CardContent>
              </Card>

              {/* Account Information */}
              {applicantUser && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Account Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">User ID</p>
                      <p className="font-medium text-gray-900">#{applicantUser.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Login Method</p>
                      <p className="font-medium text-gray-900 capitalize">
                        {applicantUser.loginMethod?.replace('_', ' ') || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Account Created</p>
                      <p className="font-medium text-gray-900">
                        {new Date(applicantUser.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {applicantUser.lastSignedIn && (
                      <div>
                        <p className="text-sm text-gray-600">Last Sign In</p>
                        <p className="font-medium text-gray-900">
                          {new Date(applicantUser.lastSignedIn).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* KYC Verification Status */}
              {kycVerification && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      KYC Verification Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <Badge className={
                          kycVerification.status === 'approved' ? 'bg-green-100 text-green-800' :
                          kycVerification.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }>
                          {kycVerification.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">SSN Verification</p>
                        <p className="font-medium">{kycVerification.ssnVerified ? '✓ Verified' : '✗ Not Verified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Address Verification</p>
                        <p className="font-medium">{kycVerification.addressVerified ? '✓ Verified' : '✗ Not Verified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">ITIN Verification</p>
                        <p className="font-medium">{kycVerification.itinVerified ? '✓ Verified' : '✗ Not Verified'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Uploaded Documents */}
              <Card>
                <CardHeader>
                  <CardTitle>Uploaded Documents ({documents?.length || 0})</CardTitle>
                  <CardDescription>Documents submitted with the application</CardDescription>
                </CardHeader>
                <CardContent>
                  {!documents || documents.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No documents uploaded</p>
                  ) : (
                    <div className="space-y-3">
                      {documents.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900 capitalize">
                                {doc.documentType.replace('_', ' ')}
                              </p>
                              <p className="text-sm text-gray-600">
                                Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Verification Documents */}
              {verificationDocs && verificationDocs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Verification Documents ({verificationDocs.length})</CardTitle>
                    <CardDescription>Identity and address verification documents</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {verificationDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900 capitalize">
                                {doc.documentType.replace('_', ' ')}
                              </p>
                              <p className="text-sm text-gray-600">
                                Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment History ({payments?.length || 0})</CardTitle>
                <CardDescription>All payments related to this application</CardDescription>
              </CardHeader>
              <CardContent>
                  {!payments || payments.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No payments found</p>
                  ) : (
                    <div className="space-y-3">
                      {payments.map((payment: any) => (
                      <div key={payment.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              Payment #{payment.id}
                            </p>
                            <p className="text-sm text-gray-600">
                              {new Date(payment.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-gray-900">
                              {formatCurrency(payment.amount)}
                            </p>
                            <Badge className={
                              payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                              payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {payment.status}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600">Method</p>
                            <p className="font-medium capitalize">{payment.paymentMethod.replace('_', ' ')}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Type</p>
                            <p className="font-medium capitalize">{payment.paymentType}</p>
                          </div>
                          {payment.transactionId && (
                            <div className="col-span-2">
                              <p className="text-gray-600">Transaction ID</p>
                              <p className="font-medium font-mono text-xs">{payment.transactionId}</p>
                            </div>
                          )}
                          {payment.cardLast4 && (
                            <div>
                              <p className="text-gray-600">Card</p>
                              <p className="font-medium">****{payment.cardLast4}</p>
                            </div>
                          )}
                          {payment.cardBrand && (
                            <div>
                              <p className="text-gray-600">Brand</p>
                              <p className="font-medium">{payment.cardBrand}</p>
                            </div>
                          )}
                        </div>

                        {payment.completedAt && (
                          <div className="mt-2 text-sm text-gray-600">
                            Completed: {new Date(payment.completedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Disbursement Tab */}
          <TabsContent value="disbursement" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Disbursement Information</CardTitle>
                <CardDescription>Loan disbursement details and tracking</CardDescription>
              </CardHeader>
              <CardContent>
                {!disbursement ? (
                  <p className="text-center text-gray-500 py-8">No disbursement initiated</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Disbursement ID</p>
                        <p className="font-medium text-gray-900">#{disbursement.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Amount</p>
                        <p className="text-xl font-bold text-gray-900">
                          {formatCurrency(disbursement.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <Badge>{disbursement.status}</Badge>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Account Holder</p>
                        <p className="font-medium text-gray-900">{disbursement.accountHolderName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Account Number</p>
                        <p className="font-medium text-gray-900 font-mono">
                          ****{disbursement.accountNumber.slice(-4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Routing Number</p>
                        <p className="font-medium text-gray-900 font-mono">{disbursement.routingNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Method</p>
                        <p className="font-medium text-gray-900">Check</p>
                      </div>
                    </div>

                    {disbursement.trackingNumber && (
                      <>
                        <Separator />
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 mb-2">Tracking Information</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-sm text-blue-700">Tracking Number</p>
                              <p className="font-mono font-medium text-blue-900">{disbursement.trackingNumber}</p>
                            </div>
                            <div>
                              <p className="text-sm text-blue-700">Carrier</p>
                              <p className="font-medium text-blue-900">{disbursement.trackingCompany}</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {disbursement.adminNotes && (
                      <>
                        <Separator />
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm font-medium text-gray-900 mb-1">Admin Notes</p>
                          <p className="text-sm text-gray-700">{disbursement.adminNotes}</p>
                        </div>
                      </>
                    )}

                    <Separator />

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Initiated At</p>
                        <p className="font-medium">{new Date(disbursement.createdAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Status</p>
                        <p className="font-medium capitalize">{disbursement.status}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Log Tab */}
          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Admin Activity Log</CardTitle>
                <CardDescription>All admin actions on this application</CardDescription>
              </CardHeader>
              <CardContent>
                {!activityLog || activityLog.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No activity recorded</p>
                ) : (
                  <div className="space-y-3">
                    {activityLog.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className={`p-2 rounded-full ${
                          log.action.includes('approve') ? 'bg-green-100' :
                          log.action.includes('reject') ? 'bg-red-100' :
                          log.action.includes('verify') ? 'bg-blue-100' :
                          'bg-gray-100'
                        }`}>
                          {log.action.includes('approve') ? <CheckCircle className="h-4 w-4 text-green-600" /> :
                           log.action.includes('reject') ? <XCircle className="h-4 w-4 text-red-600" /> :
                           log.action.includes('verify') ? <Shield className="h-4 w-4 text-blue-600" /> :
                           <Clock className="h-4 w-4 text-gray-600" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 capitalize">
                            {log.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(log.createdAt).toLocaleString()}
                          </p>
                          {log.details && (
                            <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(JSON.parse(log.details), null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approval Dialog */}
      <Dialog open={approvalDialog} onOpenChange={setApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Application #{applicationId}</DialogTitle>
            <DialogDescription>Set the approved loan amount and optional notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Approved Amount ($)</Label>
              <Input
                type="number"
                placeholder="e.g. 5000"
                value={approvalAmount}
                onChange={(e) => setApprovalAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Approval notes..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialog} onOpenChange={setRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application #{applicationId}</DialogTitle>
            <DialogDescription>Provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Textarea
                placeholder="Reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectionDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Verification Dialog */}
      <Dialog open={feeVerificationDialog} onOpenChange={setFeeVerificationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Fee Payment — Application #{applicationId}</DialogTitle>
            <DialogDescription>Confirm that the processing fee has been received.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Verification notes..."
                value={feeVerificationNotes}
                onChange={(e) => setFeeVerificationNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="destructive" onClick={() => {
              if (!applicationId) return;
              verifyFeePaymentMutation.mutate({ id: applicationId, verified: false, adminNotes: feeVerificationNotes || "Payment rejected by admin" });
            }} disabled={verifyFeePaymentMutation.isPending}>
              {verifyFeePaymentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Reject Fee
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFeeVerificationDialog(false)}>Cancel</Button>
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleVerifyFeePayment} disabled={verifyFeePaymentMutation.isPending}>
                {verifyFeePaymentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                Verify & Approve
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disbursement Dialog */}
      <Dialog open={disbursementDialog} onOpenChange={setDisbursementDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Initiate Disbursement — Application #{applicationId}</DialogTitle>
            <DialogDescription>Choose where to disburse the approved loan funds.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Disbursement Target Selector */}
            <div className="space-y-2">
              <Label className="font-semibold">Disbursement Target</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDisbursementTarget("amerilend_account")}
                  className={`relative p-3 rounded-lg border-2 text-left transition-all ${
                    disbursementTarget === "amerilend_account"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">Recommended</span>
                  <div className="text-lg mb-1">🏦</div>
                  <div className="font-medium text-sm">AmeriLend Account</div>
                  <div className="text-xs text-muted-foreground">Instant deposit</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDisbursementTarget("external_account")}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    disbursementTarget === "external_account"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="text-lg mb-1">🔗</div>
                  <div className="font-medium text-sm">External Account</div>
                  <div className="text-xs text-muted-foreground">1-3 business days</div>
                </button>
              </div>
            </div>

            {/* AmeriLend Account Picker */}
            {disbursementTarget === "amerilend_account" && (
              <div className="space-y-2">
                <Label className="font-semibold">Select AmeriLend Bank Account *</Label>
                {userBankAccounts.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts...
                  </div>
                ) : !userBankAccounts.data?.length ? (
                  <div className="text-sm text-orange-600 bg-orange-50 dark:bg-orange-950 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    This borrower has no AmeriLend bank accounts. Please use external account option.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userBankAccounts.data.map((acct: any) => (
                      <button
                        key={acct.id}
                        type="button"
                        onClick={() => setSelectedAmeriLendAccount(acct.id)}
                        className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                          selectedAmeriLendAccount === acct.id
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-sm">{acct.bankName}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {acct.accountType} ····{acct.accountNumberLast4}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">{formatCurrency(acct.balance)}</div>
                            {acct.isVerified && (
                              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">Verified</Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* External Account Fields */}
            {disbursementTarget === "external_account" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Account Holder Name *</Label>
                  <Input placeholder="Full name on account" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Account Number *</Label>
                  <Input placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Routing Number *</Label>
                  <Input placeholder="9-digit routing number" value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} />
                </div>
              </div>
            )}

            {/* Admin Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Disbursement notes..." value={disbursementNotes} onChange={(e) => setDisbursementNotes(e.target.value)} />
            </div>

            {/* Loan Amount Summary */}
            {data?.application?.approvedAmount && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border">
                <div className="text-xs text-muted-foreground mb-1">Approved Loan Amount</div>
                <div className="text-xl font-bold text-emerald-600">
                  {formatCurrency(data.application.approvedAmount)}
                </div>
                {data.application.loanAccountNumber && (
                  <div className="text-[11px] text-muted-foreground mt-1 pt-1 border-t">
                    Loan Account: <span className="font-mono">{data.application.loanAccountNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisbursementDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleDisburse} disabled={disburseMutation.isPending}>
              {disburseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
              {disbursementTarget === "amerilend_account" ? "Disburse Instantly" : "Disburse Funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
