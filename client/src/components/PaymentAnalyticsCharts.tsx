import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, DollarSign, Calendar, Activity } from "lucide-react";

interface PaymentAnalyticsChartsProps {
  payments: Array<{
    id: number;
    amount: number;
    status: string;
    createdAt: Date | string;
    method?: string;
  }>;
}

export function PaymentAnalyticsCharts({ payments }: PaymentAnalyticsChartsProps) {
  // Process data for charts
  const processPaymentsByMonth = () => {
    const monthlyData: Record<string, number> = {};
    
    payments.forEach(payment => {
      const date = new Date(payment.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!monthlyData[monthName]) {
        monthlyData[monthName] = 0;
      }
      
      if (payment.status === 'completed') {
        monthlyData[monthName] += payment.amount / 100; // Convert cents to dollars
      }
    });
    
    return Object.entries(monthlyData)
      .map(([month, amount]) => ({
        month,
        amount: Math.round(amount * 100) / 100, // Round to 2 decimals
      }))
      .slice(-6); // Last 6 months
  };

  const processPaymentsByStatus = () => {
    const statusCounts: Record<string, number> = {};
    
    payments.forEach(payment => {
      const status = payment.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
    }));
  };

  const processPaymentsByMethod = () => {
    const methodData: Record<string, { count: number; amount: number }> = {};
    
    payments.forEach(payment => {
      const method = payment.method || 'card';
      if (!methodData[method]) {
        methodData[method] = { count: 0, amount: 0 };
      }
      methodData[method].count++;
      if (payment.status === 'completed') {
        methodData[method].amount += payment.amount / 100;
      }
    });
    
    return Object.entries(methodData).map(([method, data]) => ({
      method: method.charAt(0).toUpperCase() + method.slice(1),
      count: data.count,
      amount: Math.round(data.amount * 100) / 100,
    }));
  };

  const calculateStats = () => {
    const completed = payments.filter(p => p.status === 'completed');
    const totalAmount = completed.reduce((sum, p) => sum + p.amount, 0) / 100;
    const avgAmount = completed.length > 0 ? totalAmount / completed.length : 0;
    
    return {
      totalPayments: payments.length,
      completedPayments: completed.length,
      totalAmount,
      avgAmount: Math.round(avgAmount * 100) / 100,
      successRate: payments.length > 0 ? Math.round((completed.length / payments.length) * 100) : 0,
    };
  };

  const monthlyData = processPaymentsByMonth();
  const statusData = processPaymentsByStatus();
  const methodData = processPaymentsByMethod();
  const stats = calculateStats();

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];
  const STATUS_COLORS: Record<string, string> = {
    'Completed': '#10b981',
    'Pending': '#f59e0b',
    'Failed': '#ef4444',
    'Cancelled': '#6b7280',
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payments</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPayments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.completedPayments} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From completed payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Payment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.avgAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Per transaction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Payment completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Payment Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Payment Trend</CardTitle>
            <CardDescription>Payment volume over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                  />
                  <Legend />
                  <Bar dataKey="amount" fill="#0033A0" name="Payment Amount ($)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No payment data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Status Distribution</CardTitle>
            <CardDescription>Breakdown by payment status</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
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
                      <Cell 
                        key={`cell-${index}`} 
                        fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No payment data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Comparison by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            {methodData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={methodData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="method" />
                  <YAxis yAxisId="left" orientation="left" stroke="#0033A0" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="#0033A0" name="Transaction Count" />
                  <Bar yAxisId="right" dataKey="amount" fill="#82ca9d" name="Total Amount ($)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No payment data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Timeline</CardTitle>
            <CardDescription>Transaction count over time</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#0033A0" 
                    strokeWidth={2}
                    name="Payment Amount ($)"
                    dot={{ fill: '#0033A0', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No payment data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
