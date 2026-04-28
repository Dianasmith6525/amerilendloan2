import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Clock, DollarSign, Calendar } from "lucide-react";
import {
  COMPANY_HARDSHIP_EMAIL,
  COMPANY_PHONE_DISPLAY,
  SUPPORT_HOURS_WEEKDAY,
  SUPPORT_HOURS_WEEKEND,
} from "@/const";

export default function HardshipPrograms() {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [programType, setProgramType] = useState("forbearance");
  const [reason, setReason] = useState("");
  const [proposedPayment, setProposedPayment] = useState("");
  const [requestedDuration, setRequestedDuration] = useState("");
  const [incomeChange, setIncomeChange] = useState("");

  const { data: loansData } = trpc.loans.myLoans.useQuery();
  const loans = loansData || [];

  const { data: requestsData, refetch } = trpc.hardship.getUserRequests.useQuery();
  const requests = requestsData?.data || [];

  const createMutation = trpc.hardship.create.useMutation({
    onSuccess: () => {
      toast.success("Hardship request submitted successfully");
      setShowRequestForm(false);
      refetch();
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit request");
    },
  });

  const resetForm = () => {
    setSelectedLoanId(null);
    setProgramType("forbearance");
    setReason("");
    setProposedPayment("");
    setRequestedDuration("");
    setIncomeChange("");
  };

  const handleSubmit = () => {
    if (!selectedLoanId || !reason || reason.length < 20) {
      toast.error("Please fill in all required fields");
      return;
    }

    createMutation.mutate({
      loanApplicationId: selectedLoanId,
      programType: programType as any,
      reason,
      proposedPaymentAmount: proposedPayment ? parseFloat(proposedPayment) * 100 : undefined,
      requestedDuration: requestedDuration ? parseInt(requestedDuration) : undefined,
      monthlyIncomeChange: incomeChange ? parseFloat(incomeChange) * 100 : undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
      case "active":
        return <Badge className="bg-blue-600"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
      case "rejected":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProgramTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      forbearance: "Forbearance",
      deferment: "Payment Deferment",
      payment_reduction: "Payment Reduction",
      term_extension: "Term Extension",
      settlement: "Debt Settlement",
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Hardship Assistance Programs</h1>
          <p className="text-slate-300">We understand financial difficulties. Explore options to help manage your loan.</p>
        </div>

        {/* Program Information */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg text-white">Forbearance</CardTitle>
              <CardDescription className="text-slate-400">Temporarily pause payments</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Suspend payments for 1-6 months during financial hardship. Interest may continue to accrue.
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg text-white">Payment Reduction</CardTitle>
              <CardDescription className="text-slate-400">Lower monthly payments</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Reduce your monthly payment amount for a specified period with term extension.
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg text-white">Term Extension</CardTitle>
              <CardDescription className="text-slate-400">Extend repayment period</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              Extend your loan term to reduce monthly payment burden over a longer period.
            </CardContent>
          </Card>
        </div>

        {/* Request Button */}
        <div className="mb-6">
          <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Request Hardship Assistance
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-white">Request Hardship Assistance</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Tell us about your situation and we'll work with you to find a solution
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label className="text-white">Select Loan</Label>
                  <Select value={selectedLoanId?.toString()} onValueChange={(val) => setSelectedLoanId(parseInt(val))}>
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                      <SelectValue placeholder="Choose a loan" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {loans.filter(l => l.status === "disbursed").map((loan) => (
                        <SelectItem key={loan.id} value={loan.id.toString()}>
                          {loan.trackingNumber} - ${((loan.approvedAmount || 0) / 100).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-white">Program Type</Label>
                  <Select value={programType} onValueChange={setProgramType}>
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="forbearance">Forbearance</SelectItem>
                      <SelectItem value="deferment">Payment Deferment</SelectItem>
                      <SelectItem value="payment_reduction">Payment Reduction</SelectItem>
                      <SelectItem value="term_extension">Term Extension</SelectItem>
                      <SelectItem value="settlement">Debt Settlement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-white">Monthly Income Change (optional)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., -500"
                    value={incomeChange}
                    onChange={(e) => setIncomeChange(e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                  <p className="text-xs text-slate-400 mt-1">Enter negative for income loss</p>
                </div>

                <div>
                  <Label className="text-white">Proposed Monthly Payment (optional)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 200"
                    value={proposedPayment}
                    onChange={(e) => setProposedPayment(e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>

                <div>
                  <Label className="text-white">Requested Duration (months, optional)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 3"
                    value={requestedDuration}
                    onChange={(e) => setRequestedDuration(e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>

                <div>
                  <Label className="text-white">Reason for Hardship *</Label>
                  <Textarea
                    placeholder="Please explain your financial situation (minimum 20 characters)..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white min-h-[100px]"
                  />
                  <p className="text-xs text-slate-400 mt-1">{reason.length}/20 characters minimum</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {createMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRequestForm(false)}
                    className="border-slate-600"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Existing Requests */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Your Hardship Requests</CardTitle>
            <CardDescription className="text-slate-400">Track the status of your assistance requests</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hardship requests found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request: any) => (
                  <div key={request.id} className="border border-slate-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-white">{getProgramTypeLabel(request.programType)}</h4>
                        <p className="text-sm text-slate-400">Loan: {request.trackingNumber}</p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>

                    <p className="text-sm text-slate-300 mb-3">{request.reason}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {request.requestedDuration && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Calendar className="w-4 h-4" />
                          <span>{request.requestedDuration} months</span>
                        </div>
                      )}
                      {request.approvedDuration && (
                        <div className="flex items-center gap-2 text-green-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approved: {request.approvedDuration} months</span>
                        </div>
                      )}
                      {request.approvedPaymentAmount && (
                        <div className="flex items-center gap-2 text-green-400">
                          <DollarSign className="w-4 h-4" />
                          <span>${(request.approvedPaymentAmount / 100).toFixed(2)}/mo</span>
                        </div>
                      )}
                      <div className="text-slate-400">
                        Submitted: {new Date(request.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {request.status === "active" && request.startDate && request.endDate && (
                      <div className="mt-3 p-3 bg-blue-900/30 rounded border border-blue-700">
                        <p className="text-sm text-blue-300">
                          Active from {new Date(request.startDate).toLocaleDateString()} to {new Date(request.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="bg-slate-800 border-slate-700 mt-6">
          <CardHeader>
            <CardTitle className="text-white">Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-2">
            <p>Our hardship assistance team is here to help you navigate difficult financial situations.</p>
            <p className="text-sm">
              <strong>Phone:</strong> {COMPANY_PHONE_DISPLAY}<br />
              <strong>Email:</strong> {COMPANY_HARDSHIP_EMAIL}<br />
              <strong>Hours:</strong> {SUPPORT_HOURS_WEEKDAY}; {SUPPORT_HOURS_WEEKEND}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
