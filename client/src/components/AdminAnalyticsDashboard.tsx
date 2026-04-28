import { useState, useMemo } from "react";
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
  AlertTriangle,
  Loader2,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/utils";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const CHART_COLORS = {
  navy: "#0A2540",
  gold: "#C9A227",
  green: "#00875A",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  red: "#EF4444",
  amber: "#F59E0B",
  cyan: "#06B6D4",
};

const STATUS_COLORS: Record<string, string> = {
  "Pending Review": "#F59E0B",
  "Approved": "#10B981",
  "Disbursed": "#3B82F6",
  "Rejected": "#EF4444",
  "Cancelled": "#6B7280",
};

export default function AdminAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<"week" | "month" | "quarter" | "year">("month");

  // Fetch real data from backend
  const { data: metricsData, isLoading } = trpc.analytics.getAdminMetrics.useQuery({ timeRange });
  const { data: allApplications } = trpc.loans.adminList.useQuery();
  const { data: paymentCollectionData } = trpc.analytics.getPaymentCollectionMetrics.useQuery();

  // Calculate derived metrics from real data
  const metrics = metricsData?.data || {
    totalApplications: 0,
    approvedApplications: 0,
    approvalRate: 0,
    totalDisbursed: 0,
    activeLoans: 0,
    averageLoanAmount: 0,
    conversionRate: 0,
    defaultRate: 0,
    totalUsers: 0,
    newUsersThisMonth: 0,
    averageProcessingTime: 0,
  };

  // Calculate total revenue (estimated from processing fees - 5% of disbursed amount)
  const totalRevenue = Math.round(metrics.totalDisbursed * 0.05);

  // Calculate applications by status from real data
  const applicationsByStatus = allApplications ? [
    { status: "Pending Review", count: allApplications.filter((app: any) => app.status === "pending" || app.status === "under_review").length, color: "amber" },
    { status: "Approved", count: allApplications.filter((app: any) => app.status === "approved" || app.status === "fee_pending").length, color: "green" },
    { status: "Disbursed", count: allApplications.filter((app: any) => app.status === "disbursed").length, color: "blue" },
    { status: "Rejected", count: allApplications.filter((app: any) => app.status === "rejected").length, color: "red" },
    { status: "Cancelled", count: allApplications.filter((app: any) => app.status === "cancelled").length, color: "gray" }
  ] : [];

  // Payment collection metrics from real data
  const paymentMetrics = paymentCollectionData?.data || {
    collectionRate: 0,
    onTimePayments: 0,
    latePayments: 0,
    missedPayments: 0,
    totalCollected: 0,
    outstanding: 0,
  };

  // ── Derived chart data from real applications ──

  // Monthly application volume trend (last 6 months)
  const monthlyTrendData = useMemo(() => {
    if (!allApplications?.length) return [];
    const buckets: Record<string, { month: string; sortKey: string; total: number; approved: number; rejected: number; amount: number }> = {};
    allApplications.forEach((app: any) => {
      if (!app.createdAt) return;
      const d = new Date(app.createdAt);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (!buckets[key]) buckets[key] = { month: label, sortKey: key, total: 0, approved: 0, rejected: 0, amount: 0 };
      buckets[key].total++;
      if (["approved", "fee_paid", "disbursed"].includes(app.status)) buckets[key].approved++;
      if (app.status === "rejected") buckets[key].rejected++;
      buckets[key].amount += Number(app.requestedAmount || 0);
    });
    return Object.values(buckets).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-6);
  }, [allApplications]);

  // Revenue / disbursement by month
  const revenueData = useMemo(() => {
    if (!allApplications?.length) return [];
    const buckets: Record<string, { month: string; sortKey: string; disbursed: number; revenue: number }> = {};
    allApplications.forEach((app: any) => {
      if (!app.createdAt || app.status !== "disbursed") return;
      const d = new Date(app.createdAt);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (!buckets[key]) buckets[key] = { month: label, sortKey: key, disbursed: 0, revenue: 0 };
      const amt = Number(app.approvedAmount || app.requestedAmount || 0);
      buckets[key].disbursed += amt;
      buckets[key].revenue += Math.round(amt * 0.05);
    });
    return Object.values(buckets).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-6);
  }, [allApplications]);

  // Pie data for status distribution
  const statusPieData = useMemo(() => {
    return applicationsByStatus
      .filter((s) => s.count > 0)
      .map((s) => ({ name: s.status, value: s.count }));
  }, [applicationsByStatus]);

  // Loan amount distribution buckets
  const amountDistribution = useMemo(() => {
    if (!allApplications?.length) return [];
    const ranges = [
      { range: "$0-5K", min: 0, max: 500000 },
      { range: "$5K-10K", min: 500000, max: 1000000 },
      { range: "$10K-25K", min: 1000000, max: 2500000 },
      { range: "$25K-50K", min: 2500000, max: 5000000 },
      { range: "$50K+", min: 5000000, max: Infinity },
    ];
    return ranges.map(({ range, min, max }) => {
      const inRange = allApplications.filter((a: any) => {
        const amt = Number(a.requestedAmount || 0);
        return amt >= min && amt < max;
      });
      const approved = inRange.filter((a: any) => ["approved", "fee_paid", "disbursed"].includes(a.status)).length;
      return { range, total: inRange.length, approved, rate: inRange.length > 0 ? Math.round((approved / inRange.length) * 100) : 0 };
    });
  }, [allApplications]);

  const exportData = (format: "csv" | "pdf") => {
    if (format === "csv") {
      const csvRows = [
        "Metric,Value",
        `Total Applications,${metrics.totalApplications}`,
        `Approved Applications,${metrics.approvedApplications}`,
        `Approval Rate,${metrics.approvalRate}%`,
        `Total Disbursed,${formatCurrency(metrics.totalDisbursed)}`,
        `Active Loans,${metrics.activeLoans}`,
        `Average Loan Amount,${formatCurrency(metrics.averageLoanAmount)}`,
        `Conversion Rate,${metrics.conversionRate}%`,
        `Default Rate,${metrics.defaultRate}%`,
        `Total Users,${metrics.totalUsers}`,
        `New Users This Month,${metrics.newUsersThisMonth}`,
        `Average Processing Time,${metrics.averageProcessingTime} days`
      ];
      const csv = csvRows.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } else {
      toast.success("PDF export initiated");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#0A2540]" />
        <span className="ml-3 text-gray-600">Loading analytics data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-[#0A2540]">Analytics Dashboard</h2>
          <p className="text-gray-600 mt-1">Real-time business intelligence and metrics</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => exportData("csv")} variant="outline" disabled={isLoading}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => exportData("pdf")} variant="outline" disabled={isLoading}>
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
                ? "bg-white text-[#0A2540] shadow"
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
          icon={<Activity className="w-5 h-5" />}
        />
        <MetricCard
          title="Approval Rate"
          value={`${metrics.approvalRate}%`}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <MetricCard
          title="Total Disbursed"
          value={formatCurrency(metrics.totalDisbursed)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Active Loans"
          value={metrics.activeLoans.toLocaleString()}
          icon={<CreditCard className="w-5 h-5" />}
        />
        <MetricCard
          title="Total Users"
          value={metrics.totalUsers.toLocaleString()}
          subtitle={`+${metrics.newUsersThisMonth} this month`}
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard
          title="Avg Loan Amount"
          value={formatCurrency(metrics.averageLoanAmount)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${metrics.conversionRate}%`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Default Rate"
          value={`${metrics.defaultRate}%`}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>

      {/* ── CHARTS ROW 1: Trend Line + Status Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Application Trend */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Monthly Application Trends
            </CardTitle>
            <CardDescription>Applications, approvals, and rejections over time</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" style={{ fontSize: "12px" }} />
                  <YAxis style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={CHART_COLORS.navy}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    name="Total"
                  />
                  <Line
                    type="monotone"
                    dataKey="approved"
                    stroke={CHART_COLORS.green}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Approved"
                  />
                  <Line
                    type="monotone"
                    dataKey="rejected"
                    stroke={CHART_COLORS.red}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Rejected"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                <div className="text-center">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No application data yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Application Status Donut */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Application Status Distribution
            </CardTitle>
            <CardDescription>Current status breakdown of all applications</CardDescription>
          </CardHeader>
          <CardContent>
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusPieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STATUS_COLORS[entry.name] || "#6B7280"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB" }}
                    formatter={(value: number) => [value, "Applications"]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                <div className="text-center">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No status data yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── CHARTS ROW 2: Revenue Area + Amount Distribution Bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue & Disbursements */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Revenue &amp; Disbursements
            </CardTitle>
            <CardDescription>Monthly disbursement volume and estimated revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" style={{ fontSize: "12px" }} />
                  <YAxis
                    style={{ fontSize: "12px" }}
                    tickFormatter={(v) => `$${(v / 100000).toFixed(0)}K`}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB" }}
                    formatter={(value: number) => [formatCurrency(value), undefined]}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="disbursed"
                    stroke={CHART_COLORS.blue}
                    fill={CHART_COLORS.blue}
                    fillOpacity={0.15}
                    strokeWidth={2}
                    name="Disbursed"
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={CHART_COLORS.gold}
                    fill={CHART_COLORS.gold}
                    fillOpacity={0.25}
                    strokeWidth={2}
                    name="Revenue (est.)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                <div className="text-center">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No disbursement data yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loan Amount Distribution */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              Approval Rate by Loan Amount
            </CardTitle>
            <CardDescription>How approval rates vary by requested amount</CardDescription>
          </CardHeader>
          <CardContent>
            {amountDistribution.some((d) => d.total > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={amountDistribution} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="range" style={{ fontSize: "12px" }} />
                  <YAxis style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB" }}
                  />
                  <Legend />
                  <Bar dataKey="total" fill={CHART_COLORS.purple} name="Total Applications" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="approved" fill={CHART_COLORS.green} name="Approved" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                <div className="text-center">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No amount data yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Payment Collection & Operational Efficiency ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Collection */}
        <Card className="shadow-md">
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
                  {formatCurrency(paymentMetrics.totalCollected)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-600">Outstanding</span>
                <span className="font-bold text-amber-600">
                  {formatCurrency(paymentMetrics.outstanding)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operational Efficiency */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Operational Efficiency</CardTitle>
            <CardDescription>Process metrics and system performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <p className="text-3xl font-bold text-amber-900">{formatCurrency(totalRevenue)}</p>
                <p className="text-sm text-amber-700 mt-1">Estimated Revenue (5% fees)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
}

function MetricCard({ title, value, subtitle, icon }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="text-xs mt-1 text-gray-500">{subtitle}</p>
            )}
          </div>
          <div className="p-3 bg-blue-100 rounded-lg text-[#0A2540]">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
