import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  CheckCircle, 
  XCircle,
  Clock,
  Download,
  Calendar,
  Activity,
  CreditCard,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

export default function AdminAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<"week" | "month" | "quarter" | "year">("month");

  // Mock data - replace with real tRPC queries
  const metrics = {
    totalApplications: 1247,
    approvedApplications: 892,
    approvalRate: 71.5,
    totalDisbursed: 4567890,
    totalRevenue: 123456,
    activeLoans: 567,
    averageLoanAmount: 5100,
    conversionRate: 68.3,
    totalUsers: 2341,
    newUsersThisMonth: 234,
    averageProcessingTime: 2.3,
    defaultRate: 3.2
  };

  const applicationsByStatus = [
    { status: "Pending Review", count: 45, color: "amber" },
    { status: "Approved", count: 892, color: "green" },
    { status: "Disbursed", count: 567, color: "blue" },
    { status: "Rejected", count: 123, color: "red" },
    { status: "Cancelled", count: 87, color: "gray" }
  ];

  const monthlyVolume = [
    { month: "Jan", applications: 98, disbursed: 65, revenue: 9800 },
    { month: "Feb", applications: 112, disbursed: 78, revenue: 11200 },
    { month: "Mar", applications: 125, disbursed: 89, revenue: 12500 },
    { month: "Apr", applications: 108, disbursed: 72, revenue: 10800 },
    { month: "May", applications: 142, disbursed: 95, revenue: 14200 },
    { month: "Jun", applications: 156, disbursed: 108, revenue: 15600 }
  ];

  const riskTierBreakdown = [
    { tier: "Low Risk (A)", count: 342, percentage: 38.3 },
    { tier: "Medium Risk (B)", count: 415, percentage: 46.5 },
    { tier: "High Risk (C)", count: 135, percentage: 15.2 }
  ];

  const paymentMetrics = {
    collectionRate: 94.7,
    onTimePayments: 86.2,
    latePayments: 10.6,
    missedPayments: 3.2,
    totalCollected: 2345678,
    outstanding: 156789
  };

  const exportData = (format: "csv" | "pdf") => {
    if (format === "csv") {
      // Mock CSV export
      const csv = "Metric,Value\nTotal Applications,1247\nApproval Rate,71.5%\n";
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } else {
      toast.success("PDF export initiated");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#0033A0]">Analytics Dashboard</h2>
          <p className="text-gray-600 mt-1">Comprehensive business intelligence and metrics</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => exportData("csv")} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => exportData("pdf")} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
        {(["week", "month", "quarter", "year"] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              timeRange === range
                ? "bg-white text-[#0033A0] shadow"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {range.charAt(0).toUpperCase() + range.slice(1)}
          </button>
        ))}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Applications"
          value={metrics.totalApplications.toLocaleString()}
          change="+12.3%"
          icon={<Activity className="w-5 h-5" />}
          trend="up"
        />
        <MetricCard
          title="Approval Rate"
          value={`${metrics.approvalRate}%`}
          change="+2.1%"
          icon={<CheckCircle className="w-5 h-5" />}
          trend="up"
        />
        <MetricCard
          title="Total Disbursed"
          value={`$${(metrics.totalDisbursed / 100).toLocaleString()}`}
          change="+18.4%"
          icon={<DollarSign className="w-5 h-5" />}
          trend="up"
        />
        <MetricCard
          title="Active Loans"
          value={metrics.activeLoans.toLocaleString()}
          change="+5.7%"
          icon={<CreditCard className="w-5 h-5" />}
          trend="up"
        />
        <MetricCard
          title="Total Users"
          value={metrics.totalUsers.toLocaleString()}
          change="+234 this month"
          icon={<Users className="w-5 h-5" />}
          trend="up"
        />
        <MetricCard
          title="Avg Loan Amount"
          value={`$${metrics.averageLoanAmount.toLocaleString()}`}
          change="-3.2%"
          icon={<DollarSign className="w-5 h-5" />}
          trend="down"
        />
        <MetricCard
          title="Conversion Rate"
          value={`${metrics.conversionRate}%`}
          change="+4.1%"
          icon={<TrendingUp className="w-5 h-5" />}
          trend="up"
        />
        <MetricCard
          title="Default Rate"
          value={`${metrics.defaultRate}%`}
          change="-0.8%"
          icon={<AlertTriangle className="w-5 h-5" />}
          trend="down"
          trendIsGood="down"
        />
      </div>

      {/* Applications by Status */}
      <Card>
        <CardHeader>
          <CardTitle>Applications by Status</CardTitle>
          <CardDescription>Current distribution across all application stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {applicationsByStatus.map((item) => {
              const percentage = (item.count / metrics.totalApplications) * 100;
              return (
                <div key={item.status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{item.status}</span>
                    <span className="text-sm text-gray-600">{item.count} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full bg-${item.color}-500`}
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: getStatusColor(item.color)
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Volume Trends</CardTitle>
          <CardDescription>Applications, disbursements, and revenue over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {monthlyVolume.map((month) => {
              const maxApplications = Math.max(...monthlyVolume.map(m => m.applications));
              return (
                <div key={month.month} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium w-12">{month.month}</span>
                    <div className="flex-1 mx-4 grid grid-cols-3 gap-2">
                      <div className="bg-blue-100 rounded px-2 py-1 text-center">
                        <span className="text-xs text-blue-900 font-semibold">{month.applications} apps</span>
                      </div>
                      <div className="bg-green-100 rounded px-2 py-1 text-center">
                        <span className="text-xs text-green-900 font-semibold">{month.disbursed} disbursed</span>
                      </div>
                      <div className="bg-amber-100 rounded px-2 py-1 text-center">
                        <span className="text-xs text-amber-900 font-semibold">${(month.revenue / 100).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500"
                      style={{ width: `${(month.applications / maxApplications) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Risk Tier Breakdown & Payment Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Tiers */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Tier Distribution</CardTitle>
            <CardDescription>Approved loans by risk category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {riskTierBreakdown.map((tier, index) => (
                <div key={tier.tier} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? "bg-green-500" : index === 1 ? "bg-amber-500" : "bg-red-500"
                      }`} />
                      <span className="text-sm font-medium">{tier.tier}</span>
                    </div>
                    <span className="text-sm text-gray-600">{tier.count} ({tier.percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        index === 0 ? "bg-green-500" : index === 1 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${tier.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Collection */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Collection Metrics</CardTitle>
            <CardDescription>Payment performance and collection rates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">Collection Rate</p>
                <p className="text-2xl font-bold text-green-900">{paymentMetrics.collectionRate}%</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">On-Time Payments</p>
                <p className="text-2xl font-bold text-blue-900">{paymentMetrics.onTimePayments}%</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>On-Time</span>
                </div>
                <span className="font-medium">{paymentMetrics.onTimePayments}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Late</span>
                </div>
                <span className="font-medium">{paymentMetrics.latePayments}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span>Missed</span>
                </div>
                <span className="font-medium">{paymentMetrics.missedPayments}%</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Collected</span>
                <span className="font-bold text-green-600">
                  ${(paymentMetrics.totalCollected / 100).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-600">Outstanding</span>
                <span className="font-bold text-amber-600">
                  ${(paymentMetrics.outstanding / 100).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Operational Efficiency</CardTitle>
          <CardDescription>Process metrics and system performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-blue-900">{metrics.averageProcessingTime}</p>
              <p className="text-sm text-blue-700 mt-1">Avg Processing Days</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-green-900">{metrics.newUsersThisMonth}</p>
              <p className="text-sm text-green-700 mt-1">New Users This Month</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <TrendingUp className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-amber-900">${(metrics.totalRevenue / 100).toLocaleString()}</p>
              <p className="text-sm text-amber-700 mt-1">Total Revenue</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  trend: "up" | "down";
  trendIsGood?: "up" | "down";
}

function MetricCard({ title, value, change, icon, trend, trendIsGood = "up" }: MetricCardProps) {
  const isPositive = trend === trendIsGood;
  
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className={`text-xs mt-1 flex items-center gap-1 ${
              isPositive ? "text-green-600" : "text-red-600"
            }`}>
              {trend === "up" ? "↑" : "↓"} {change}
            </p>
          </div>
          <div className="p-3 bg-blue-100 rounded-lg text-[#0033A0]">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusColor(color: string): string {
  const colors: Record<string, string> = {
    amber: "#F59E0B",
    green: "#10B981",
    blue: "#3B82F6",
    red: "#EF4444",
    gray: "#6B7280"
  };
  return colors[color] || colors.gray;
}
