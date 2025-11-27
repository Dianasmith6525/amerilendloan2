import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CreditCard, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { useLocation } from 'wouter';
import { formatCurrency, formatDate } from '@/lib/utils';
import { QuickPaymentButton } from '@/components/QuickPaymentButton';

export function UserDashboard() {
  const [, navigate] = useLocation();
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery(undefined, {
    enabled: true,
  });

  const { data: loans, isLoading: loansLoading } = trpc.loans.myLoans.useQuery(undefined, {
    enabled: true,
  });

  const { data: preferences } = trpc.userFeatures.preferences.get.useQuery(undefined, {
    enabled: !!user,
  });

  // Debug: Log loans data
  console.log('UserDashboard - All loans:', loans);

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
  
  // Calculate totals based on actual database fields
  const totalLoansAmount = loans?.reduce((sum: number, loan: any) => {
    // Use approvedAmount if approved/fee_paid/disbursed, otherwise requestedAmount
    const amount = (loan.status === 'approved' || loan.status === 'fee_pending' || loan.status === 'fee_paid' || loan.status === 'disbursed') 
      ? (loan.approvedAmount || 0) 
      : 0;
    return sum + amount;
  }, 0) || 0;
  
  // Note: paidAmount is in paymentSchedules table, not in loanApplications
  // For now, we'll show $0 until we add a proper query to aggregate payments
  const totalPaid = 0; // TODO: Query paymentSchedules table
  const remainingBalance = totalLoansAmount - totalPaid;
  
  // Count actually disbursed loans (not 'active' which doesn't exist)
  const disbursedLoansCount = loans?.filter((l: any) => l.status === 'disbursed').length || 0;
  
  // Find loan that needs processing fee payment
  // Show for approved or fee_pending status
  const loanWithPendingFee = loans?.find((loan: any) => {
    console.log('Checking loan:', loan.id, 'status:', loan.status, 'processingFeeAmount:', loan.processingFeeAmount, 'approvedAmount:', loan.approvedAmount);
    return (loan.status === 'approved' || loan.status === 'fee_pending') && loan.approvedAmount && loan.approvedAmount > 0;
  });
  
  // Calculate processing fee if not set (default 2%)
  const processingFee = loanWithPendingFee?.processingFeeAmount || 
                        (loanWithPendingFee?.approvedAmount ? Math.round(loanWithPendingFee.approvedAmount * 0.02) : 0);

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

        {/* Quick Payment Alert - Processing Fee */}
        {loanWithPendingFee && processingFee > 0 && (
          <Card className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-2 border-green-500 dark:border-green-700 shadow-lg">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-500 rounded-full">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl text-green-900 dark:text-green-100">
                    Processing Fee Payment Required
                  </CardTitle>
                  <CardDescription className="text-green-700 dark:text-green-300 mt-1">
                    Your loan has been approved! Complete your processing fee payment to receive your funds.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Loan Amount</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(loanWithPendingFee.approvedAmount || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Processing Fee</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(processingFee)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Loan Number</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      #{loanWithPendingFee.trackingNumber}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <QuickPaymentButton
                    applicationId={loanWithPendingFee.id}
                    processingFeeAmount={processingFee}
                    onPaymentComplete={() => {
                      // Optionally navigate or show success
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/payment/${loanWithPendingFee.id}`)}
                  className="border-green-500 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-950"
                >
                  View Payment Details
                </Button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Quick & Easy:</strong> Pay with credit card or cryptocurrency. Your payment will be processed instantly and your loan will be disbursed within 24 hours.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
                {disbursedLoansCount} disbursed
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
                {totalLoansAmount > 0 ? Math.round((totalPaid / totalLoansAmount) * 100) : 0}% paid
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
                    <Badge variant={activeLoan.status === 'disbursed' ? 'default' : 'secondary'}>
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
                        {formatCurrency(activeLoan.approvedAmount || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Loan Status</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white capitalize">
                        {activeLoan.status.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  <Button 
                    onClick={() => navigate(`/loans/${activeLoan.id}`)}
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
                  <Button onClick={() => navigate('/apply')}>Apply for a Loan</Button>
                </CardContent>
              </Card>
            )}

            {/* Next Payment - Only show for disbursed loans */}
            {activeLoan && activeLoan.status === 'disbursed' && (
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Loan Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Disbursed Date</p>
                      <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                        {activeLoan.disbursedAt ? formatDate(new Date(activeLoan.disbursedAt)) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Loan Amount</p>
                      <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                        {formatCurrency(activeLoan.approvedAmount || activeLoan.requestedAmount)}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => navigate(`/loans/${activeLoan.id}`)}
                    className="w-full"
                    variant="default"
                  >
                    View Loan Details
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
                    {loans.map((loan: any) => (
                      <button
                        key={loan.id}
                        onClick={() => navigate(`/loans/${loan.id}`)}
                        className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            Loan #{loan.trackingNumber}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {formatCurrency(loan.approvedAmount || loan.requestedAmount)} • {loan.status.replace('_', ' ')}
                          </p>
                        </div>
                        <Badge variant="outline">{loan.loanType}</Badge>
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
                  onClick={() => navigate('/payment')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  💳 Make a Payment
                </Button>
                <Button 
                  onClick={() => navigate('/user-profile')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  👤 View Profile
                </Button>
                <Button 
                  onClick={() => navigate('/notifications')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  🔔 Notifications
                </Button>
                <Button 
                  onClick={() => navigate('/support')}
                  variant="outline"
                  className="w-full justify-start"
                >
                  💬 Get Support
                </Button>
                <Button 
                  onClick={() => navigate('/referrals')}
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
                    onClick={() => navigate('/settings')}
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
                  onClick={() => navigate('/support')}
                  variant="ghost"
                  className="w-full justify-start text-xs"
                >
                  ❓ FAQs
                </Button>
                <Button 
                  onClick={() => navigate('/support')}
                  variant="ghost"
                  className="w-full justify-start text-xs"
                >
                  📞 Contact Support
                </Button>
                <Button 
                  onClick={() => navigate('/support')}
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
