import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Users, CheckCircle, XCircle, Clock, Banknote } from "lucide-react";

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export default function AdvancedAnalytics() {
  const { data: applications = [] } = trpc.loans.adminList.useQuery();
  const { data: stats } = trpc.loans.adminStatistics.useQuery();
  const { data: disbursements = [] } = trpc.disbursements.adminList.useQuery();

  // Calculate monthly application trends
  const monthlyTrends = applications.reduce((acc: any, app: any) => {
    const month = new Date(app.createdAt).toLocaleString('default', { month: 'short', year: 'numeric' });
    if (!acc[month]) {
      acc[month] = { month, applications: 0, approved: 0, rejected: 0, totalAmount: 0 };
    }
    acc[month].applications++;
    if (app.status === 'approved') acc[month].approved++;
    if (app.status === 'rejected') acc[month].rejected++;
    acc[month].totalAmount += Number(app.requestedAmount || 0);
    return acc;
  }, {});

  const monthlyData = Object.values(monthlyTrends).slice(-6);

  // Status distribution
  const statusDistribution = applications.reduce((acc: any, app: any) => {
    const status = app.status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(statusDistribution).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').toUpperCase(),
    value
  }));

  // Approval rate by amount range
  const amountRanges = [
    { range: '$0-5K', min: 0, max: 5000 },
    { range: '$5K-10K', min: 5000, max: 10000 },
    { range: '$10K-25K', min: 10000, max: 25000 },
    { range: '$25K-50K', min: 25000, max: 50000 },
    { range: '$50K+', min: 50000, max: Infinity },
  ];

  const approvalByAmount = amountRanges.map(({ range, min, max }) => {
    const inRange = applications.filter((app: any) => {
      const amount = Number(app.requestedAmount || 0);
      return amount >= min && amount < max;
    });
    const approved = inRange.filter((app: any) => app.status === 'approved').length;
    const rate = inRange.length > 0 ? (approved / inRange.length) * 100 : 0;
    return { range, total: inRange.length, approved, rate: Math.round(rate) };
  });

  // Daily disbursement trends
  const dailyDisbursements = disbursements
    .filter((d: any) => d.status === 'completed')
    .reduce((acc: any, d: any) => {
      const date = new Date(d.createdAt).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { date, amount: 0, count: 0 };
      }
      acc[date].amount += Number(d.amount || 0);
      acc[date].count++;
      return acc;
    }, {});

  const disbursementData = Object.values(dailyDisbursements).slice(-14);

  // Calculate key metrics
  const approvalRate = applications.length > 0
    ? ((applications.filter((a: any) => a.status === 'approved').length / applications.length) * 100).toFixed(1)
    : '0';

  const avgProcessingTime = applications.length > 0
    ? Math.round(
        applications
          .filter((a: any) => a.updatedAt && a.createdAt)
          .reduce((sum: number, a: any) => {
            const hours = (new Date(a.updatedAt).getTime() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }, 0) / applications.length
      )
    : 0;

  const totalDisbursed = disbursements
    .filter((d: any) => d.status === 'completed')
    .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-md border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approval Rate</p>
                <p className="text-2xl font-bold text-purple-600">{approvalRate}%</p>
              </div>
              <CheckCircle className="h-10 w-10 text-purple-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Processing Time</p>
                <p className="text-2xl font-bold text-blue-600">{avgProcessingTime}h</p>
              </div>
              <Clock className="h-10 w-10 text-blue-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Disbursed</p>
                <p className="text-2xl font-bold text-green-600">${(totalDisbursed / 1000).toFixed(1)}K</p>
              </div>
              <Banknote className="h-10 w-10 text-green-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Applications</p>
                <p className="text-2xl font-bold text-orange-600">{applications.length}</p>
              </div>
              <Users className="h-10 w-10 text-orange-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Applications Trend */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Monthly Application Trends
            </CardTitle>
            <CardDescription>Applications, approvals, and rejections over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" style={{ fontSize: '12px' }} />
                <YAxis style={{ fontSize: '12px' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="applications" stroke="#8b5cf6" strokeWidth={2} name="Total" />
                <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2} name="Approved" />
                <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={2} name="Rejected" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution Pie */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Application Status Distribution
            </CardTitle>
            <CardDescription>Current status breakdown of all applications</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Approval Rate by Amount */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Approval Rate by Loan Amount
            </CardTitle>
            <CardDescription>How approval rates vary by requested amount</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={approvalByAmount}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" style={{ fontSize: '12px' }} />
                <YAxis style={{ fontSize: '12px' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#8b5cf6" name="Total Applications" />
                <Bar dataKey="approved" fill="#10b981" name="Approved" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Disbursements */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-orange-600" />
              Daily Disbursement Activity
            </CardTitle>
            <CardDescription>Last 14 days of completed disbursements</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={disbursementData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" style={{ fontSize: '10px' }} />
                <YAxis style={{ fontSize: '12px' }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="amount" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} name="Amount ($)" />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Count" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Approval Rate Analysis</CardTitle>
            <CardDescription>Detailed breakdown by loan amount range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {approvalByAmount.map((item) => (
                <div key={item.range} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold">{item.range}</p>
                    <p className="text-sm text-gray-600">{item.total} applications</p>
                  </div>
                  <div className="text-right">
                    <Badge className={item.rate >= 70 ? 'bg-green-100 text-green-800' : item.rate >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                      {item.rate}% approved
                    </Badge>
                    <p className="text-xs text-gray-600 mt-1">{item.approved} of {item.total}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Summary */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Performance Insights</CardTitle>
            <CardDescription>Key trends and observations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-purple-900">Strong Approval Rate</p>
                    <p className="text-sm text-purple-700">Currently at {approvalRate}% overall approval rate</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900">Processing Efficiency</p>
                    <p className="text-sm text-blue-700">Average {avgProcessingTime} hours per application</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900">Total Disbursed</p>
                    <p className="text-sm text-green-700">${totalDisbursed.toLocaleString()} in completed loans</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900">Application Volume</p>
                    <p className="text-sm text-orange-700">{applications.length} total applications received</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
