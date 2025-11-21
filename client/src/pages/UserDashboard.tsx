import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CreditCard, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { useRouter } from 'wouter';
import { formatCurrency, formatDate } from '@/lib/utils';

export function UserDashboard() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['auth.me'],
    queryFn: () => trpc.auth.me.query(),
  });

  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ['loans.myLoans'],
    queryFn: () => trpc.loans.myLoans.query(),
  });

  const { data: preferences } = useQuery({
    queryKey: ['userFeatures.preferences'],
    queryFn: () => trpc.userFeatures.preferences.get.query(),
    enabled: !!user,
  });

  if (userLoading || loansLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const activeLoan = loans?.[0];
  const totalLoansAmount = loans?.reduce((sum, loan) => sum + (loan.approvedAmount || 0), 0) || 0;
  const totalPaid = loans?.reduce((sum, loan) => sum + (loan.paidAmount || 0), 0) || 0;
  const remainingBalance = totalLoansAmount - totalPaid;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Welcome back, {user?.firstName || user?.email}!
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Here's an overview of your loan accounts and payments
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Loans */}
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Active Loans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{loans?.length || 0}</div>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                {loans?.filter(l => l.status === 'active').length || 0} active
              </p>
            </CardContent>
          </Card>

          {/* Total Borrowed */}
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Borrowed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(totalLoansAmount)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                Across all loans
              </p>
            </CardContent>
          </Card>

          {/* Total Paid */}
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Total Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalPaid)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                {Math.round((totalPaid / totalLoansAmount) * 100)}% paid
              </p>
            </CardContent>
          </Card>

          {/* Remaining Balance */}
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Remaining Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(remainingBalance)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                To be paid off
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Loan Card */}
            {activeLoan ? (
              <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Your Active Loan</span>
                    <Badge variant={activeLoan.status === 'active' ? 'default' : 'secondary'}>
                      {activeLoan.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Loan #{activeLoan.trackingNumber}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Loan Amount</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(activeLoan.requestedAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Approved Amount</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(activeLoan.approvedAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Interest Rate</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {activeLoan.interestRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Term</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {activeLoan.loanTerm} months
                      </p>
                    </div>
                  </div>

                  <Button 
                    onClick={() => router.push(`/loans/${activeLoan.id}`)}
                    className="w-full"
                  >
                    View Full Details & Payment Schedule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle>No Active Loans</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    You don't have any active loans yet. Start by applying for a loan.
                  </p>
                  <Button onClick={() => router.push('/apply')}>Apply for a Loan</Button>
                </CardContent>
              </Card>
            )}

            {/* Next Payment */}
            {activeLoan && (
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Next Payment Due
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Due Date</p>
                      <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                        {formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Amount Due</p>
                      <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                        {formatCurrency(activeLoan.monthlyPayment || 0)}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => router.push('/payments/make')}
                    className="w-full"
                    variant="default"
                  >
                    Make a Payment Now
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* All Loans */}
            {loans && loans.length > 1 && (
              <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle>All Your Loans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {loans.map((loan) => (
                      <button
                        key={loan.id}
                        onClick={() => router.push(`/loans/${loan.id}`)}
                        className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            Loan #{loan.trackingNumber}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {formatCurrency(loan.requestedAmount)} • {loan.status}
                          </p>
                        </div>
                        <Badge variant="outline">{loan.loanTerm}m</Badge>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  onClick={() => router.push('/payments/make')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  💳 Make a Payment
                </Button>
                <Button 
                  onClick={() => router.push('/profile')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  👤 View Profile
                </Button>
                <Button 
                  onClick={() => router.push('/notifications')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  🔔 Notifications
                </Button>
                <Button 
                  onClick={() => router.push('/support')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  💬 Get Support
                </Button>
                <Button 
                  onClick={() => router.push('/referrals')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  🎁 Referrals & Rewards
                </Button>
              </CardContent>
            </Card>

            {/* Account Status */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-base">Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">KYC Verified</span>
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                    ✓ Verified
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Email Verified</span>
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                    ✓ Verified
                  </Badge>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                  <Button 
                    onClick={() => router.push('/settings/security')}
                    variant="ghost"
                    className="w-full justify-start text-xs"
                  >
                    🔒 View Security Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Help & Resources */}
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="text-base">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  onClick={() => router.push('/faq')}
                  variant="ghost"
                  className="w-full justify-start text-xs"
                >
                  ❓ FAQs
                </Button>
                <Button 
                  onClick={() => router.push('/contact')}
                  variant="ghost"
                  className="w-full justify-start text-xs"
                >
                  📞 Contact Support
                </Button>
                <Button 
                  onClick={() => router.push('/education')}
                  variant="ghost"
                  className="w-full justify-start text-xs"
                >
                  📚 Financial Education
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserDashboard;
