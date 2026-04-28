import React, { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  ExternalLink,
  Copy,
  CreditCard,
  Bitcoin,
  Loader2,
  Eye,
  CheckCircle,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

interface VerificationDialogState {
  open: boolean;
  payment: any;
  action: "approve" | "reject" | null;
}

export default function AdminPaymentVerification() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [verificationDialog, setVerificationDialog] = useState<VerificationDialogState>({
    open: false,
    payment: null,
    action: null,
  });
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  // Fetch all payments
  const { data: payments = [], isLoading, refetch } = trpc.payments.adminGetAllPayments.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter as any,
    paymentMethod: methodFilter === "all" ? undefined : methodFilter as any,
  });

  // Verify crypto payment mutation
  const verifyCryptoMutation = trpc.payments.adminVerifyCryptoPayment.useMutation({
    onSuccess: () => {
      toast.success("Payment verification completed");
      refetch();
      setVerificationDialog({ open: false, payment: null, action: null });
      setAdminNotes("");
      setSelectedPayment(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to verify payment");
    },
  });

  // Auto-sync card payment status from Stripe
  const refreshStripeMutation = trpc.payments.adminRefreshStripeStatus.useMutation({
    onSuccess: (result) => {
      if (result.changed) {
        toast.success(
          `Stripe sync: ${result.previousStatus} → ${result.newStatus}` +
          (result.lastPaymentError ? ` (${result.lastPaymentError})` : "")
        );
      } else {
        toast.info(`No change — Stripe still reports "${result.stripeStatus}"`);
      }
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to sync from Stripe");
    },
  });

  // Manual status override (used to reconcile stuck payments when Stripe webhooks were missed)
  const [forceDialog, setForceDialog] = useState<{ open: boolean; payment: any | null }>({ open: false, payment: null });
  const [forceStatus, setForceStatus] = useState<string>("succeeded");
  const [forceReason, setForceReason] = useState("");
  const [forceMarkLoanFeePaid, setForceMarkLoanFeePaid] = useState(true);

  const setPaymentStatusMutation = trpc.admin.setPaymentStatus.useMutation({
    onSuccess: () => {
      toast.success("Payment status updated");
      refetch();
      setForceDialog({ open: false, payment: null });
      setForceReason("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update payment status");
    },
  });

  const handleVerifyPayment = () => {
    if (!verificationDialog.payment || !verificationDialog.action) return;

    verifyCryptoMutation.mutate({
      paymentId: verificationDialog.payment.id,
      verified: verificationDialog.action === "approve",
      adminNotes: adminNotes || undefined,
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getBlockchainExplorerUrl = (currency: string, txHash: string) => {
    const explorers: Record<string, string> = {
      BTC: `https://blockchair.com/bitcoin/transaction/${txHash}`,
      ETH: `https://etherscan.io/tx/${txHash}`,
      USDT: `https://etherscan.io/tx/${txHash}`,
      USDC: `https://etherscan.io/tx/${txHash}`,
    };
    return explorers[currency] || "#";
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { icon: any; text: string; className: string }> = {
      pending: {
        icon: Clock,
        text: "Pending",
        className: "bg-yellow-100 text-yellow-800 border-yellow-300",
      },
      processing: {
        icon: Loader2,
        text: "Processing",
        className: "bg-blue-100 text-blue-800 border-blue-300",
      },
      succeeded: {
        icon: CheckCircle2,
        text: "Succeeded",
        className: "bg-green-100 text-green-800 border-green-300",
      },
      failed: {
        icon: XCircle,
        text: "Failed",
        className: "bg-red-100 text-red-800 border-red-300",
      },
      cancelled: {
        icon: Ban,
        text: "Cancelled",
        className: "bg-gray-100 text-gray-800 border-gray-300",
      },
    };

    const { icon: Icon, text, className } = config[status] || config.pending;

    return (
      <Badge className={`${className} border flex items-center gap-1 w-fit`}>
        <Icon className="h-3 w-3" />
        {text}
      </Badge>
    );
  };

  const getMethodBadge = (method: string, crypto?: string) => {
    if (method === "crypto") {
      return (
        <Badge className="bg-purple-100 text-purple-800 border-purple-300 border flex items-center gap-1 w-fit">
          <Bitcoin className="h-3 w-3" />
          {crypto || "Crypto"}
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-300 border flex items-center gap-1 w-fit">
        <CreditCard className="h-3 w-3" />
        Card
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-[#0033A0] flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Payment Verification
          </CardTitle>
          <CardDescription>
            Review and verify all payment transactions before disbursing loans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Status Filter</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Method</label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="card">Card Payments</SelectItem>
                  <SelectItem value="crypto">Crypto Payments</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {payments.filter(p => p.status === "pending").length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-blue-600">
                  {payments.filter(p => p.status === "processing").length}
                </p>
              </div>
              <Loader2 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Succeeded</p>
                <p className="text-2xl font-bold text-green-600">
                  {payments.filter(p => p.status === "succeeded").length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Needs Review</p>
                <p className="text-2xl font-bold text-orange-600">
                  {payments.filter(p => 
                    (p.status === "pending" || p.status === "processing") && 
                    p.paymentMethod === "crypto" && 
                    p.cryptoTxHash
                  ).length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Payments</CardTitle>
          <CardDescription>
            {payments.length} payment{payments.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No payments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">User</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Loan</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Method</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <React.Fragment key={payment.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">#{payment.id}</td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{payment.userName}</p>
                          <p className="text-xs text-gray-500">{payment.userEmail}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{payment.loanTrackingNumber}</p>
                          <p className="text-xs text-gray-500">Status: {payment.loanStatus}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(payment.amount)}
                        </p>
                        {payment.paymentMethod === "crypto" && payment.cryptoAmount && (
                          <p className="text-xs text-gray-500">
                            {payment.cryptoAmount} {payment.cryptoCurrency}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {getMethodBadge(payment.paymentMethod, payment.cryptoCurrency || undefined)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(payment.status)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPayment(selectedPayment?.id === payment.id ? null : payment)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                          
                          {payment.paymentMethod === "crypto" && 
                           payment.cryptoTxHash && 
                           payment.status !== "succeeded" && 
                           payment.status !== "failed" && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => {
                                setVerificationDialog({
                                  open: true,
                                  payment,
                                  action: "approve",
                                });
                              }}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verify
                            </Button>
                          )}

                          {/* Auto-sync card payment status from Stripe */}
                          {payment.paymentMethod === "card" &&
                           payment.paymentIntentId &&
                           !["succeeded", "failed", "cancelled", "refunded"].includes(payment.status as string) && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700"
                              disabled={refreshStripeMutation.isPending}
                              onClick={() => refreshStripeMutation.mutate({ paymentId: payment.id })}
                              title="Fetch latest status from Stripe and reconcile"
                            >
                              {refreshStripeMutation.isPending ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              )}
                              Sync from Stripe
                            </Button>
                          )}

                          {/* Manual reconcile for any non-terminal payment (Stripe stuck in processing, etc.) */}
                          {!["succeeded", "failed", "refunded"].includes(payment.status as string) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-400 text-amber-700 hover:bg-amber-50"
                              onClick={() => {
                                setForceDialog({ open: true, payment });
                                setForceStatus("succeeded");
                                setForceReason("");
                                setForceMarkLoanFeePaid(true);
                              }}
                              title="Manually set payment status (use when Stripe webhook was missed)"
                            >
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Force status
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Inline Details Row */}
                    {selectedPayment?.id === payment.id && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <div className="p-6 bg-blue-50 border-t border-b border-blue-200">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-gray-900">
                                Payment Details - #{selectedPayment.id}
                              </h3>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedPayment(null)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Basic Info */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-900 mb-2">Basic Information</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Payment ID:</span>
                                    <span className="font-medium">#{selectedPayment.id}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">User:</span>
                                    <span className="font-medium">{selectedPayment.userName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Email:</span>
                                    <span className="font-medium">{selectedPayment.userEmail}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Loan:</span>
                                    <span className="font-medium">{selectedPayment.loanTrackingNumber}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Amount:</span>
                                    <span className="font-medium">{formatCurrency(selectedPayment.amount)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Status:</span>
                                    {getStatusBadge(selectedPayment.status)}
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Created:</span>
                                    <span className="font-medium">
                                      {new Date(selectedPayment.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                  {selectedPayment.completedAt && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Completed:</span>
                                      <span className="font-medium">
                                        {new Date(selectedPayment.completedAt).toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Payment Method Details */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-900 mb-2">Payment Method Details</h4>
                                {selectedPayment.paymentMethod === "crypto" ? (
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-600">Currency:</span>
                                      <span className="font-medium">{selectedPayment.cryptoCurrency}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-600">Amount:</span>
                                      <span className="font-medium">
                                        {selectedPayment.cryptoAmount} {selectedPayment.cryptoCurrency}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600 block mb-1">Wallet Address:</span>
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
                                          {selectedPayment.cryptoAddress}
                                        </code>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => copyToClipboard(selectedPayment.cryptoAddress, "Address")}
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    {selectedPayment.cryptoTxHash && (
                                      <>
                                        <div>
                                          <span className="text-gray-600 block mb-1">Transaction Hash:</span>
                                          <div className="flex items-center gap-2">
                                            <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
                                              {selectedPayment.cryptoTxHash}
                                            </code>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => copyToClipboard(selectedPayment.cryptoTxHash, "TX Hash")}
                                            >
                                              <Copy className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                        <div className="mt-3">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => window.open(
                                              getBlockchainExplorerUrl(selectedPayment.cryptoCurrency, selectedPayment.cryptoTxHash),
                                              "_blank"
                                            )}
                                          >
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            View on Blockchain Explorer
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                    {!selectedPayment.cryptoTxHash && (
                                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                        <AlertCircle className="h-4 w-4 inline mr-2" />
                                        User has not submitted transaction hash yet
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-600">Card Brand:</span>
                                      <span className="font-medium">{selectedPayment.cardBrand || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-600">Last 4:</span>
                                      <span className="font-medium">****{selectedPayment.cardLast4 || "N/A"}</span>
                                    </div>
                                    {selectedPayment.paymentIntentId && (
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Transaction ID:</span>
                                        <span className="font-medium text-xs">
                                          {selectedPayment.paymentIntentId}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Admin Notes */}
                            {selectedPayment.adminNotes && (
                              <div className="mt-4 p-3 bg-gray-100 rounded">
                                <p className="text-sm font-semibold text-gray-700 mb-1">Admin Notes:</p>
                                <p className="text-sm text-gray-600">{selectedPayment.adminNotes}</p>
                              </div>
                            )}

                            {/* Verification Actions */}
                            {selectedPayment.paymentMethod === "crypto" && 
                             selectedPayment.cryptoTxHash && 
                             selectedPayment.status !== "succeeded" && 
                             selectedPayment.status !== "failed" && (
                              <div className="mt-6 pt-6 border-t border-blue-300">
                                <h4 className="font-semibold text-gray-900 mb-3">Verification Actions</h4>
                                <div className="flex gap-3">
                                  <Button
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => {
                                      setVerificationDialog({
                                        open: true,
                                        payment: selectedPayment,
                                        action: "approve",
                                      });
                                    }}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Approve Payment
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => {
                                      setVerificationDialog({
                                        open: true,
                                        payment: selectedPayment,
                                        action: "reject",
                                      });
                                    }}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject Payment
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Dialog */}
      <Dialog open={verificationDialog.open} onOpenChange={(open) => {
        if (!open) {
          setVerificationDialog({ open: false, payment: null, action: null });
          setAdminNotes("");
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {verificationDialog.action === "approve" ? "Approve" : "Reject"} Payment
            </DialogTitle>
            <DialogDescription>
              {verificationDialog.action === "approve" 
                ? "This will mark the payment as succeeded and update the loan status to 'fee_paid'. The user will receive a confirmation email."
                : "This will mark the payment as failed and change the loan status back to 'approved'. The user will need to make the payment again."
              }
            </DialogDescription>
          </DialogHeader>

          {verificationDialog.payment && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment ID:</span>
                  <span className="font-medium">#{verificationDialog.payment.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">User:</span>
                  <span className="font-medium">{verificationDialog.payment.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-medium">
                    {formatCurrency(verificationDialog.payment.amount)}
                  </span>
                </div>
                {verificationDialog.payment.cryptoTxHash && (
                  <div>
                    <span className="text-gray-600 block mb-1">TX Hash:</span>
                    <code className="text-xs bg-white px-2 py-1 rounded block overflow-hidden text-ellipsis">
                      {verificationDialog.payment.cryptoTxHash}
                    </code>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Admin Notes (Optional)
                </label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this verification decision..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVerificationDialog({ open: false, payment: null, action: null });
                setAdminNotes("");
              }}
              disabled={verifyCryptoMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className={verificationDialog.action === "approve" 
                ? "bg-green-600 hover:bg-green-700" 
                : "bg-red-600 hover:bg-red-700"
              }
              onClick={handleVerifyPayment}
              disabled={verifyCryptoMutation.isPending}
            >
              {verifyCryptoMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {verificationDialog.action === "approve" ? "Approve Payment" : "Reject Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force-status reconciliation dialog */}
      <Dialog open={forceDialog.open} onOpenChange={(open) => {
        if (!open) setForceDialog({ open: false, payment: null });
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Force payment status</DialogTitle>
            <DialogDescription>
              Use this when a Stripe webhook was missed or you've manually verified payment outside the system.
              Action is recorded in the payment audit log against your admin account.
            </DialogDescription>
          </DialogHeader>

          {forceDialog.payment && (
            <div className="space-y-4 py-2">
              <div className="text-sm space-y-1 bg-gray-50 p-3 rounded">
                <div><span className="text-gray-600">Payment:</span> #{forceDialog.payment.id}</div>
                <div><span className="text-gray-600">Loan:</span> {forceDialog.payment.loanTrackingNumber}</div>
                <div><span className="text-gray-600">Amount:</span> {formatCurrency(forceDialog.payment.amount)}</div>
                <div><span className="text-gray-600">Current status:</span> {forceDialog.payment.status}</div>
                {forceDialog.payment.paymentIntentId && (
                  <div className="text-xs text-gray-500 truncate">
                    PI: {forceDialog.payment.paymentIntentId}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">New status</label>
                <Select value={forceStatus} onValueChange={setForceStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="succeeded">succeeded</SelectItem>
                    <SelectItem value="failed">failed</SelectItem>
                    <SelectItem value="refunded">refunded</SelectItem>
                    <SelectItem value="processing">processing</SelectItem>
                    <SelectItem value="pending">pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Reason (required, recorded in audit log)</label>
                <Textarea
                  value={forceReason}
                  onChange={(e) => setForceReason(e.target.value)}
                  placeholder="e.g. Verified in Stripe Dashboard, webhook missed during outage"
                  rows={3}
                />
              </div>

              {forceStatus === "succeeded" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={forceMarkLoanFeePaid}
                    onChange={(e) => setForceMarkLoanFeePaid(e.target.checked)}
                  />
                  Also mark loan as <code>fee_paid</code> (only relevant for processing-fee payments)
                </label>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setForceDialog({ open: false, payment: null })}
              disabled={setPaymentStatusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!forceDialog.payment || !forceReason.trim()) {
                  toast.error("Reason is required");
                  return;
                }
                setPaymentStatusMutation.mutate({
                  paymentId: forceDialog.payment.id,
                  status: forceStatus as any,
                  reason: forceReason.trim(),
                  markLoanFeePaid: forceStatus === "succeeded" ? forceMarkLoanFeePaid : undefined,
                });
              }}
              disabled={setPaymentStatusMutation.isPending || !forceReason.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {setPaymentStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
