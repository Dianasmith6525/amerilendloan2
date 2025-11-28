import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, DollarSign, Users, Activity, CreditCard, Calendar, AlertCircle, Clock } from "lucide-react";

interface AdminPaymentAnalyticsProps {
  payments: Array<{
    id: number;
    amount: number;
    status: string;
    createdAt: Date | string;
    method?: string;
    userId?: number;
  }>;
  loans: Array<{
    id: number;
    status: string;
    approvedAmount?: number;
    requestedAmount?: number;
  }>;
}

export function AdminPaymentAnalytics({ payments, loans }: AdminPaymentAnalyticsProps) {
  // Advanced analytics processing
  const processRevenueByMonth = () => {
    const monthlyRevenue: Record<string, { revenue: number; count: number }> = {};
    
    payments.forEach(payment => {
      if (!payment.createdAt) return;
      const date = new Date(payment.createdAt);
      if (isNaN(date.getTime())) return;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!monthlyRevenue[monthName]) {
        monthlyRevenue[monthName] = { revenue: 0, count: 0 };
      }
      
      if (payment.status === 'completed' && payment.amount) {
        monthlyRevenue[monthName].revenue += payment.amount / 100;
        monthlyRevenue[monthName].count++;
      }
    });
    
    return Object.entries(monthlyRevenue)
      .map(([month, data]) => ({
        month,
        revenue: Math.round(data.revenue * 100) / 100,
        transactions: data.count,
      }))
      .slice(-12); // Last 12 months
  };

  const processPaymentMethodStats = () => {
    const methodStats: Record<string, { count: number; amount: number; avgAmount: number }> = {};
    
    payments.forEach(payment => {
      const method = payment.method || 'card';
      if (!methodStats[method]) {
        methodStats[method] = { count: 0, amount: 0, avgAmount: 0 };
      }
      methodStats[method].count++;
      if (payment.status === 'completed' && payment.amount) {
        methodStats[method].amount += payment.amount / 100;
      }
    });
    
    return Object.entries(methodStats).map(([method, stats]) => ({
      method: method.charAt(0).toUpperCase() + method.slice(1),
      count: stats.count,
      totalAmount: Math.round(stats.amount * 100) / 100,
      avgAmount: stats.count > 0 ? Math.round((stats.amount / stats.count) * 100) / 100 : 0,
    }));
  };

  const processStatusBreakdown = () => {
    const statusCount: Record<string, { count: number; amount: number }> = {};
    
    payments.forEach(payment => {
      const status = payment.status || 'unknown';
      if (!statusCount[status]) {
        statusCount[status] = { count: 0, amount: 0 };
      }
      statusCount[status].count++;
      statusCount[status].amount += (payment.amount || 0) / 100;
    });
    
    return Object.entries(statusCount).map(([status, data]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      count: data.count,
      amount: Math.round(data.amount * 100) / 100,
    }));
  };

  const calculateAdminStats = () => {
    const completed = payments.filter(p => p.status === 'completed');
    const failed = payments.filter(p => p.status === 'failed');
    const pending = payments.filter(p => p.status === 'pending');
    
    const totalRevenue = completed.reduce((sum, p) => sum + p.amount, 0) / 100;
    const avgTransactionValue = completed.length > 0 ? totalRevenue / completed.length : 0;
    
    // Calculate conversion rate (completed / total)
    const conversionRate = payments.length > 0 
      ? (completed.length / payments.length) * 100 
      : 0;
    
    // Calculate failure rate
    const failureRate = payments.length > 0 
      ? (failed.length / payments.length) * 100 
      : 0;
    
    // Get unique users
    const uniqueUsers = new Set(payments.map(p => p.userId)).size;
    
    return {
      totalTransactions: payments.length,
      completedTransactions: completed.length,
      pendingTransactions: pending.length,
      failedTransactions: failed.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgTransactionValue: Math.round(avgTransactionValue * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      uniqueUsers,
      activeLoans: loans.filter(l => l.status === 'disbursed').length,
    };
  };

  const revenueData = processRevenueByMonth();
  const methodStats = processPaymentMethodStats();
  const statusBreakdown = processStatusBreakdown();
  const adminStats = calculateAdminStats();

  // Colors
  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280', '#8b5cf6', '#06b6d4'];
  const STATUS_COLORS: Record<string, string> = {
    'Completed': '#10b981',
    'Pending': '#f59e0b',
    'Failed': '#ef4444',
    'Cancelled': '#6b7280',
  };

  return (
    <div className="space-y-6">
      {/* Admin Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${adminStats.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {adminStats.completedTransactions} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Transaction</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${adminStats.avgTransactionValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per transaction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {adminStats.conversionRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Conversion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {adminStats.pendingTransactions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adminStats.uniqueUsers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active payers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend (Area Chart) */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly revenue over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0033A0" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#0033A0" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#0033A0" 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)"
                    name="Revenue ($)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Volume */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Volume</CardTitle>
            <CardDescription>Number of transactions per month</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="transactions" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    name="Transactions"
                    dot={{ fill: '#8b5cf6', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No transaction data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Method Performance</CardTitle>
            <CardDescription>Comparison by method</CardDescription>
          </CardHeader>
          <CardContent>
            {methodStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={methodStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="method" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="#0033A0" name="Transaction Count" />
                  <Bar yAxisId="right" dataKey="totalAmount" fill="#10b981" name="Total Amount ($)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No method data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution (Pie Chart) */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Status Distribution</CardTitle>
            <CardDescription>Breakdown by status</CardDescription>
          </CardHeader>
          <CardContent>
            {statusBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {statusBreakdown.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [value, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No status data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Indicators</CardTitle>
          <CardDescription>Key metrics for payment processing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">Success Rate</span>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {adminStats.conversionRate}%
              </div>
              <p className="text-sm text-muted-foreground">
                {adminStats.completedTransactions} of {adminStats.totalTransactions} successful
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium">Failure Rate</span>
              </div>
              <div className="text-3xl font-bold text-red-600">
                {adminStats.failureRate}%
              </div>
              <p className="text-sm text-muted-foreground">
                {adminStats.failedTransactions} failed transactions
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium">Active Loans</span>
              </div>
              <div className="text-3xl font-bold">
                {adminStats.activeLoans}
              </div>
              <p className="text-sm text-muted-foreground">
                Currently disbursed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
