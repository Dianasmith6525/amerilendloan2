import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Download, 
  DollarSign, 
  Calendar, 
  PieChart,
  BarChart3,
  Receipt,
  CheckCircle2,
  Clock,
  XCircle
} from "lucide-react";
import { toast } from "sonner";

export default function PaymentHistoryAnalytics() {
  const [selectedPeriod, setSelectedPeriod] = useState<"all" | "year" | "month">("all");

  const { data: paymentsData = [], isLoading } = trpc.payments.getHistory.useQuery();

  const payments = paymentsData.map((p: any) => ({
    id: p.id,
    date: new Date(p.createdAt),
    amount: p.amount / 100,
    status: p.status === "succeeded" ? "completed" : p.status,
    method: p.paymentMethod === "card" 
      ? `${p.cardBrand || "Card"} ****${p.cardLast4 || ""}` 
      : `${p.cryptoCurrency || "Crypto"}`,
    loanId: p.loanApplicationId,
    type: "Processing Fee", // Could be different types
  }));

  // Calculate analytics
  const totalPaid = payments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const onTimePayments = payments.filter(p => p.status === "completed").length;
  const onTimePercentage = payments.length > 0 
    ? Math.round((onTimePayments / payments.length) * 100) 
    : 0;

  const monthlyData = payments.reduce((acc: any, payment) => {
    const month = payment.date.toLocaleString('default', { month: 'short', year: 'numeric' });
    if (!acc[month]) acc[month] = 0;
    if (payment.status === "completed") {
      acc[month] += payment.amount;
    }
    return acc;
  }, {});

  const handleExportCSV = () => {
    const csvContent = [
      ["Date", "Amount", "Status", "Method", "Type", "Loan ID"],
      ...payments.map(p => [
        p.date.toLocaleDateString(),
        p.amount.toFixed(2),
        p.status,
        p.method,
        p.type,
        p.loanId
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Payment history exported!");
  };

  const handleExportPDF = () => {
    // Mock PDF export
    toast.success("PDF export will be available soon!");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "failed":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Paid</p>
                <p className="text-3xl font-bold text-green-600">
                  ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Payments</p>
                <p className="text-3xl font-bold text-[#0033A0]">{payments.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Receipt className="w-6 h-6 text-[#0033A0]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">On-Time Rate</p>
                <p className="text-3xl font-bold text-purple-600">{onTimePercentage}%</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-[#0033A0] flex items-center gap-2">
                <BarChart3 className="w-6 h-6" />
                Payment Trends
              </CardTitle>
              <CardDescription>Monthly payment history overview</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(monthlyData).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(monthlyData).map(([month, amount]: any) => {
                const maxAmount = Math.max(...Object.values(monthlyData) as number[]);
                const percentage = (amount / maxAmount) * 100;
                
                return (
                  <div key={month} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">{month}</span>
                      <span className="font-bold text-[#0033A0]">
                        ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-[#0033A0] to-[#0055DD] h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No payment data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-[#0033A0] flex items-center gap-2">
            <Receipt className="w-6 h-6" />
            Payment History
          </CardTitle>
          <CardDescription>Detailed view of all your payments</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length > 0 ? (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div 
                  key={payment.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(payment.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-semibold text-gray-900">{payment.type}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(payment.status)}`}>
                          {payment.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {payment.date.toLocaleDateString()}
                        </span>
                        <span>{payment.method}</span>
                        <span className="text-xs">Loan #{payment.loanId}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      ${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No payments yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Your payment history will appear here
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-[#0033A0] flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Payment Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-2xl font-bold text-green-600">
                {payments.filter(p => p.status === "completed").length}
              </p>
              <p className="text-sm text-green-700 mt-1">Completed</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-2xl font-bold text-yellow-600">
                {payments.filter(p => p.status === "pending").length}
              </p>
              <p className="text-sm text-yellow-700 mt-1">Pending</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-2xl font-bold text-red-600">
                {payments.filter(p => p.status === "failed").length}
              </p>
              <p className="text-sm text-red-700 mt-1">Failed</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-2xl font-bold text-blue-600">
                ${(totalPaid / (payments.length || 1)).toFixed(2)}
              </p>
              <p className="text-sm text-blue-700 mt-1">Avg Payment</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Information Notice */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-sm text-purple-900 font-semibold mb-1 flex items-center gap-2">
          <Receipt className="w-4 h-4" />
          Tax Documents
        </p>
        <p className="text-xs text-purple-700">
          Your payment history and interest information will be available for tax filing purposes. 
          Documents will be generated in January for the previous year.
        </p>
      </div>
    </div>
  );
}
