import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Filter, TrendingUp, CreditCard, Trash2, LogIn } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

interface Payment {
  id: string;
  loanId: string;
  loanNumber: string;
  amount: number;
  principalPaid: number;
  interestPaid: number;
  date: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue" | "failed";
  paymentMethod: string;
  transactionId: string;
}

export function PaymentHistory() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "pending" | "failed">("all");
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const [, setLocation] = useLocation();

  // Only fetch data when authenticated to avoid auth redirect
  const { data: paymentsData = [], isLoading } = trpc.payments.getHistory.useQuery(undefined, {
    enabled: isAuthenticated && !authLoading,
  });

  const { data: bankAccounts = [] } = trpc.userFeatures.bankAccounts.list.useQuery(undefined, {
    enabled: isAuthenticated && !authLoading,
  });

  // Remove bank account mutation
  const removeBankAccountMutation = trpc.userFeatures.bankAccounts.remove.useMutation({
    onSuccess: () => {
      toast.success("Payment method removed");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove payment method");
    },
  });

  // Map backend payments to UI format
  const allPayments: Payment[] = paymentsData.map((p: any) => ({
    id: `PAY-${String(p.id).padStart(3, '0')}`,
    loanId: String(p.loanApplicationId),
    loanNumber: p.loanTrackingNumber || `LN-${p.loanApplicationId}`,
    amount: p.amount, // cents — formatCurrency handles conversion
    principalPaid: p.principalPaid ? p.principalPaid : Math.round(p.amount * 0.7),
    interestPaid: p.interestPaid ? p.interestPaid : Math.round(p.amount * 0.3),
    date: new Date(p.completedAt || p.createdAt).toLocaleDateString(),
    dueDate: new Date(p.createdAt).toLocaleDateString(),
    status: p.status === "succeeded" ? "paid" : p.status,
    paymentMethod: p.paymentMethod === "card" 
      ? `Card ${p.cardBrand || ''} ****${p.cardLast4 || ''}`.trim()
      : p.paymentMethod === "crypto"
      ? `${p.cryptoCurrency || 'Crypto'}`
      : "Other",
    transactionId: p.paymentIntentId || p.cryptoTxHash || `TXN-${p.id}`,
  }));

  const filteredPayments =
    filterStatus === "all"
      ? allPayments
      : allPayments.filter((p) => p.status === filterStatus);

  const totalPaid = allPayments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = allPayments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalFailed = allPayments
    .filter((p) => p.status === "failed")
    .reduce((sum, p) => sum + p.amount, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-600">Paid</Badge>;
      case "pending":
        return <Badge className="bg-yellow-600">Pending</Badge>;
      case "overdue":
        return <Badge className="bg-red-600">Overdue</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "Bank Transfer":
        return "🏦";
      case "Credit Card":
        return "💳";
      case "Autopay":
        return "🤖";
      default:
        return "💰";
    }
  };

  // Show unauthenticated fallback
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-8 h-8 text-green-400" />
              <h1 className="text-3xl font-bold text-white">Payment History</h1>
            </div>
            <p className="text-slate-400">View and manage all your loan payments</p>
          </div>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <CreditCard className="w-16 h-16 text-slate-500 mx-auto mb-4 opacity-50" />
                <h2 className="text-xl font-semibold text-white mb-2">No payments yet</h2>
                <p className="text-slate-400 mb-6">Sign in to view your payment history and make a payment.</p>
                <Link href="/login">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-8 h-8 text-green-400" />
              <h1 className="text-3xl font-bold text-white">Payment History</h1>
            </div>
            <p className="text-slate-400">View and manage all your loan payments</p>
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              // Export filtered payments as CSV
              const headers = ["Date", "Loan", "Amount", "Principal", "Interest", "Method", "Status", "Transaction ID"];
              const rows = filteredPayments.map((p) => [
                p.date, p.loanNumber, `$${(p.amount / 100).toFixed(2)}`,
                `$${(p.principalPaid / 100).toFixed(2)}`, `$${(p.interestPaid / 100).toFixed(2)}`,
                p.paymentMethod, p.status, p.transactionId
              ]);
              const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `payment-history-${new Date().toISOString().split("T")[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Payment history exported");
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Total Paid</p>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(totalPaid)}
                  </p>
                </div>
                <div className="bg-green-500/20 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Pending</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {formatCurrency(totalPending)}
                  </p>
                </div>
                <div className="bg-yellow-500/20 p-3 rounded-lg">
                  <CreditCard className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Failed/Retry</p>
                  <p className="text-2xl font-bold text-red-400">
                    {formatCurrency(totalFailed)}
                  </p>
                </div>
                <div className="bg-red-500/20 p-3 rounded-lg">
                  <CreditCard className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Payment Transactions</CardTitle>
                <CardDescription>Complete history of all your payments</CardDescription>
              </div>
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilterPopover(!showFilterPopover)}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  {filterStatus === "all" ? "Filter" : `Filtered: ${filterStatus}`}
                </Button>
                {showFilterPopover && (
                  <div className="absolute right-0 top-full mt-2 z-20 bg-slate-700 border border-slate-600 rounded-lg p-2 shadow-lg min-w-[140px]">
                    {(["all", "paid", "pending", "failed"] as const).map((s) => (
                      <button
                        key={s}
                        className={`block w-full text-left px-3 py-2 rounded text-sm capitalize ${
                          filterStatus === s ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-600"
                        }`}
                        onClick={() => { setFilterStatus(s); setShowFilterPopover(false); }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" onValueChange={(v) => setFilterStatus(v as any)}>
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="failed">Failed</TabsTrigger>
              </TabsList>

              <TabsContent value={filterStatus}>
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading payment history...</p>
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
                    <p className="text-slate-400 text-lg font-medium mb-2">No payments yet</p>
                    <p className="text-slate-500 text-sm mb-4">When you make a payment, it will appear here.</p>
                    <Link href="/dashboard">
                      <Button variant="outline" size="sm">Make a payment</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-600">
                          <th className="text-left text-white font-semibold py-3 px-4">Date</th>
                          <th className="text-left text-white font-semibold py-3 px-4">Loan</th>
                          <th className="text-left text-white font-semibold py-3 px-4">Amount</th>
                          <th className="text-left text-white font-semibold py-3 px-4">Principal</th>
                          <th className="text-left text-white font-semibold py-3 px-4">Interest</th>
                          <th className="text-left text-white font-semibold py-3 px-4">Method</th>
                          <th className="text-left text-white font-semibold py-3 px-4">Status</th>
                          <th className="text-left text-white font-semibold py-3 px-4">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((payment) => (
                          <tr
                            key={payment.id}
                            className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors"
                          >
                            <td className="py-4 px-4 text-slate-300">
                              {formatDate(payment.date)}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="text-white font-medium">
                                  {payment.loanNumber}
                                </span>
                                <span className="text-xs text-slate-400">
                                  Due: {formatDate(payment.dueDate)}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-white font-semibold">
                                {formatCurrency(payment.amount)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-slate-300">
                              {formatCurrency(payment.principalPaid)}
                            </td>
                            <td className="py-4 px-4 text-slate-300">
                              {formatCurrency(payment.interestPaid)}
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-lg mr-2">
                                {getPaymentMethodIcon(payment.paymentMethod)}
                              </span>
                              <span className="text-slate-300 text-sm">
                                {payment.paymentMethod}
                              </span>
                            </td>
                            <td className="py-4 px-4">{getStatusBadge(payment.status)}</td>
                            <td className="py-4 px-4">
                              {payment.status === "failed" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    toast.info("Please contact support to retry this payment.");
                                  }}
                                >
                                  Retry
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-blue-400 hover:text-blue-300"
                                  onClick={() => setDetailPayment(payment)}
                                >
                                  Details
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Payment Methods Info */}
        <Card className="bg-slate-800 border-slate-700 mt-6">
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Your saved payment methods</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(bankAccounts as any[]).length === 0 ? (
                <div className="text-center py-6">
                  <CreditCard className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-slate-400 text-sm">No payment methods on file</p>
                </div>
              ) : (
                (bankAccounts as any[]).map((account: any) => (
                  <div key={account.id} className="p-4 rounded-lg bg-slate-700/50 border border-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{account.accountType === 'checking' ? '🏦' : '💳'}</div>
                      <div>
                        <p className="text-white font-medium">{account.bankName || 'Bank Account'}</p>
                        <p className="text-sm text-slate-400">
                          {account.accountType ? account.accountType.charAt(0).toUpperCase() + account.accountType.slice(1) : 'Account'} - Last 4: {account.last4 || '****'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.isPrimary ? (
                        <Badge>Primary</Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={removeBankAccountMutation.isPending}
                          onClick={() => {
                            if (confirm('Remove this payment method?')) {
                              removeBankAccountMutation.mutate({ accountId: account.id });
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <Button
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
              onClick={() => setLocation("/bank-accounts")}
            >
              Add Payment Method
            </Button>
          </CardContent>
        </Card>

        {/* Payment Detail Dialog */}
        <Dialog open={!!detailPayment} onOpenChange={(open) => !open && setDetailPayment(null)}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Payment Details</DialogTitle>
              <DialogDescription className="text-slate-400">
                Transaction {detailPayment?.transactionId}
              </DialogDescription>
            </DialogHeader>
            {detailPayment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Amount</p>
                    <p className="text-xl font-bold text-white">{formatCurrency(detailPayment.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Status</p>
                    <div className="mt-1">{getStatusBadge(detailPayment.status)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Principal</p>
                    <p className="text-white">{formatCurrency(detailPayment.principalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Interest</p>
                    <p className="text-white">{formatCurrency(detailPayment.interestPaid)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Loan</p>
                  <p className="text-white">{detailPayment.loanNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Payment Method</p>
                  <p className="text-white">{detailPayment.paymentMethod}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Date</p>
                    <p className="text-white">{formatDate(detailPayment.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Due Date</p>
                    <p className="text-white">{formatDate(detailPayment.dueDate)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Transaction ID</p>
                  <p className="text-white font-mono text-sm">{detailPayment.transactionId}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default PaymentHistory;
