import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Download, DollarSign, Calendar, TrendingUp, Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRouter } from 'wouter';

export function LoanDetail() {
  const router = useRouter();
  const [, params] = useRoute('/loans/:id');
  const loanId = parseInt(params?.id || '0');

  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ['loans.myLoans'],
    queryFn: () => trpc.loans.myLoans.query(),
  });

  const loan = loans?.find(l => l.id === loanId);

  const { data: paymentSchedule } = useQuery({
    queryKey: ['userFeatures.payments.get', loanId],
    queryFn: () => trpc.userFeatures.payments.get.query({ loanApplicationId: loanId }),
    enabled: !!loanId && !!loan,
  });

  const { data: autopaySettings } = useQuery({
    queryKey: ['userFeatures.payments.autopaySettings.get', loanId],
    queryFn: () => trpc.userFeatures.payments.autopaySettings.get.query({ 
      loanApplicationId: loanId 
    }),
    enabled: !!loanId && !!loan,
  });

  if (loansLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading loan details...</p>
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-red-600 mb-4" />
              <p className="font-medium">Loan Not Found</p>
              <p className="text-sm text-muted-foreground mt-2">
                We couldn't find the loan you're looking for.
              </p>
              <Button 
                onClick={() => router.push('/dashboard')}
                className="w-full mt-4"
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalPaid = loan.paidAmount || 0;
  const remainingBalance = (loan.approvedAmount || 0) - totalPaid;
  const paidPercentage = (totalPaid / (loan.approvedAmount || 1)) * 100;
  const nextPaymentDate = new Date();
  nextPaymentDate.setDate(nextPaymentDate.getDate() + 30);

  const paidPayments = paymentSchedule?.filter(p => p.status === 'paid').length || 0;
  const totalPayments = paymentSchedule?.length || 0;
  const overduePayments = paymentSchedule?.filter(p => p.status === 'overdue').length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="outline" 
            onClick={() => router.push('/dashboard')}
            className="mb-4"
          >
            ← Back
          </Button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Loan #{loan.trackingNumber}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {formatDate(new Date(loan.createdAt))}
          </p>
        </div>

        {/* Status Alert */}
        {overduePayments > 0 && (
          <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-100">
                    {overduePayments} Overdue Payment{overduePayments !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-300">
                    Please make a payment to avoid additional fees.
                  </p>
                </div>
                <Button 
                  className="ml-auto"
                  onClick={() => router.push('/payments/make')}
                >
                  Make Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Loan Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(loan.requestedAmount)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Approved: {formatCurrency(loan.approvedAmount)}</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Interest Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {loan.interestRate}%
              </div>
              <p className="text-xs text-slate-500 mt-1">APR</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Loan Term
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {loan.loanTerm}
              </div>
              <p className="text-xs text-slate-500 mt-1">Months</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Monthly Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(loan.monthlyPayment || 0)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Estimated</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Section */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle>Repayment Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Total Paid</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {formatCurrency(totalPaid)} of {formatCurrency(loan.approvedAmount)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${Math.min(paidPercentage, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {Math.round(paidPercentage)}% complete • {paidPayments} of {totalPayments} payments made
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Remaining Balance</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency(remainingBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Total Interest</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency((loan.approvedAmount || 0) * (loan.interestRate || 0) / 100)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Schedule */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle>Payment Schedule</CardTitle>
                <CardDescription>
                  All scheduled payments for this loan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-0 font-medium text-slate-600 dark:text-slate-400">
                          Payment #
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                          Due Date
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                          Amount
                        </th>
                        <th className="text-center py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentSchedule?.slice(0, 12).map((payment, index) => (
                        <tr 
                          key={payment.id}
                          className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <td className="py-3 px-0 text-slate-900 dark:text-white font-medium">
                            #{payment.installmentNumber}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {formatDate(new Date(payment.dueDate))}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-white font-medium">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge 
                              variant="outline"
                              className={
                                payment.status === 'paid' 
                                  ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                                  : payment.status === 'overdue'
                                  ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                                  : 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                              }
                            >
                              {payment.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(paymentSchedule?.length || 0) > 12 && (
                    <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-4">
                      +{(paymentSchedule?.length || 0) - 12} more payments
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  onClick={() => router.push('/payments/make')}
                  className="w-full"
                >
                  💳 Make a Payment
                </Button>
                <Button 
                  onClick={() => router.push(`/loans/${loanId}/autopay`)}
                  variant="outline"
                  className="w-full"
                >
                  ⚙️ Autopay Settings
                </Button>
                <Button 
                  variant="outline"
                  className="w-full"
                >
                  📄 Download Statement
                </Button>
              </CardContent>
            </Card>

            {/* Autopay Status */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-base">Autopay Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {autopaySettings?.isEnabled ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Active
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-blue-800 dark:text-blue-300">Payment Day</p>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Day {autopaySettings.paymentDay || 1} of each month
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Disabled
                      </span>
                    </div>
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      Enable autopay to automatically pay your monthly installments.
                    </p>
                  </>
                )}
                <Button 
                  variant="secondary"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => router.push(`/loans/${loanId}/autopay`)}
                >
                  {autopaySettings?.isEnabled ? 'Manage' : 'Enable'} Autopay
                </Button>
              </CardContent>
            </Card>

            {/* Next Payment */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-base">Next Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Due Date</p>
                  <p className="text-lg font-medium text-slate-900 dark:text-white">
                    {formatDate(nextPaymentDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Amount</p>
                  <p className="text-lg font-medium text-slate-900 dark:text-white">
                    {formatCurrency(loan.monthlyPayment || 0)}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <Button 
                    onClick={() => router.push('/payments/make')}
                    className="w-full"
                  >
                    Pay Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Help */}
            <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="text-base">Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => router.push('/support')}
                >
                  📞 Contact Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoanDetail;
