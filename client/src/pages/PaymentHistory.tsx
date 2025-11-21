import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Filter, TrendingUp, CreditCard } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

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
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "pending" | "failed">("all");

  // Fetch real payment history from backend
  const { data: paymentsData = [], isLoading } = trpc.payments.getHistory.useQuery();

  // Map backend payments to UI format
  const allPayments: Payment[] = paymentsData.map((p: any) => ({
    id: `PAY-${String(p.id).padStart(3, '0')}`,
    loanId: String(p.loanApplicationId),
    loanNumber: p.loanTrackingNumber || `LN-${p.loanApplicationId}`,
    amount: p.amount / 100, // Convert cents to dollars
    principalPaid: 0, // TODO: Calculate if loan repayment data available
    interestPaid: 0,  // TODO: Calculate if loan repayment data available
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
          <Button className="bg-blue-600 hover:bg-blue-700">
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
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
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
                    <p className="text-slate-400">No payments found</p>
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
                                <Button size="sm" variant="outline">
                                  Retry
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-blue-400 hover:text-blue-300"
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
              <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">💳</div>
                  <div>
                    <p className="text-white font-medium">Chase Bank Account</p>
                    <p className="text-sm text-slate-400">Savings - Last 4: 1234</p>
                  </div>
                </div>
                <Badge>Primary</Badge>
              </div>
              <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🏦</div>
                  <div>
                    <p className="text-white font-medium">Visa Credit Card</p>
                    <p className="text-sm text-slate-400">Ending in 5678</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Delete
                </Button>
              </div>
            </div>
            <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
              Add Payment Method
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PaymentHistory;
