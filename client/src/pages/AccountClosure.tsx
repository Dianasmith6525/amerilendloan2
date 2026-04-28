import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AlertTriangle, Download, Trash2, Shield, Clock } from "lucide-react";

export default function AccountClosure() {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [reason, setReason] = useState("no_longer_needed");
  const [detailedReason, setDetailedReason] = useState("");
  const [dataExportRequested, setDataExportRequested] = useState(false);
  const [confirmUnderstand, setConfirmUnderstand] = useState(false);

  const { data: closureData, refetch } = trpc.accountClosure.getMyRequest.useQuery();
  const closureRequest = closureData?.data;

  const { data: loansData } = trpc.loans.myLoans.useQuery();
  const loans = loansData || [];
  const hasActiveLoans = loans.some(l => l.status === "disbursed" || l.status === "approved");

  const requestMutation = trpc.accountClosure.requestClosure.useMutation({
    onSuccess: () => {
      toast.success("Account closure request submitted");
      setShowConfirmDialog(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit request");
    },
  });

  const handleSubmit = () => {
    if (!confirmUnderstand) {
      toast.error("Please confirm you understand the consequences");
      return;
    }

    requestMutation.mutate({
      reason: reason as any,
      detailedReason: detailedReason || undefined,
      dataExportRequested,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending Review</Badge>;
      case "approved":
        return <Badge className="bg-green-600">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      no_longer_needed: "No longer needed",
      switching_lender: "Switching to another lender",
      privacy_concerns: "Privacy concerns",
      service_quality: "Service quality issues",
      other: "Other",
    };
    return labels[reason] || reason;
  };

  if (closureRequest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Account Closure Request</CardTitle>
              <CardDescription className="text-slate-400">Your request is being reviewed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-900 rounded">
                  <div>
                    <p className="text-sm text-slate-400">Status</p>
                    <div className="mt-1">{getStatusBadge(closureRequest.status)}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Submitted</p>
                    <p className="text-white">{new Date(closureRequest.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-900 rounded">
                  <p className="text-sm text-slate-400 mb-1">Reason</p>
                  <p className="text-white">{getReasonLabel(closureRequest.reason)}</p>
                  {closureRequest.detailedReason && (
                    <p className="text-sm text-slate-300 mt-2">{closureRequest.detailedReason}</p>
                  )}
                </div>

                {closureRequest.hasOutstandingLoans && (
                  <div className="p-4 bg-yellow-900/30 rounded border border-yellow-700">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-yellow-300 font-semibold">Outstanding Loans Detected</p>
                        <p className="text-sm text-yellow-200 mt-1">
                          You have active loans. These must be paid off before account closure can be completed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {closureRequest.dataExportRequested && (
                  <div className="p-4 bg-blue-900/30 rounded border border-blue-700">
                    <div className="flex items-center gap-2">
                      <Download className="w-5 h-5 text-blue-400" />
                      <p className="text-blue-300">Data export requested - will be provided before deletion</p>
                    </div>
                  </div>
                )}

                {closureRequest.scheduledDeletionDate && (
                  <div className="p-4 bg-red-900/30 rounded border border-red-700">
                    <div className="flex items-start gap-2">
                      <Trash2 className="w-5 h-5 text-red-400 mt-0.5" />
                      <div>
                        <p className="text-red-300 font-semibold">Scheduled for Deletion</p>
                        <p className="text-sm text-red-200 mt-1">
                          Account deletion scheduled for: {new Date(closureRequest.scheduledDeletionDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {closureRequest.adminNotes && (
                  <div className="p-4 bg-slate-900 rounded">
                    <p className="text-sm text-slate-400 mb-1">Admin Notes</p>
                    <p className="text-slate-300">{closureRequest.adminNotes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Close Account</h1>
          <p className="text-slate-300">Request permanent deletion of your account and data</p>
        </div>

        {/* Warning Card */}
        <Card className="bg-red-900/20 border-red-700 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-300 font-bold mb-2">Important: This Action is Permanent</h3>
                <ul className="text-sm text-red-200 space-y-1 list-disc list-inside">
                  <li>Your account will be permanently deleted</li>
                  <li>All personal information will be removed from our systems</li>
                  <li>You will lose access to loan history and documents</li>
                  <li>This action cannot be reversed</li>
                  <li>You must pay off all outstanding loans before closure</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Loans Warning */}
        {hasActiveLoans && (
          <Card className="bg-yellow-900/20 border-yellow-700 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-yellow-300 font-bold mb-2">Outstanding Loans Detected</h3>
                  <p className="text-sm text-yellow-200">
                    You currently have {loans.filter(l => l.status === "disbursed" || l.status === "approved").length} active loan(s). 
                    All loans must be fully paid off before your account can be closed. You can still submit a closure request, 
                    but it will not be processed until all loans are settled.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* GDPR Info */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Your Privacy Rights
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-2 text-sm">
            <p>Under GDPR and CCPA regulations, you have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Request deletion of your personal data</li>
              <li>Export all data we have collected about you</li>
              <li>Understand how your data has been processed</li>
            </ul>
            <p className="text-xs text-slate-400 mt-3">
              Note: We may retain certain information as required by law for tax, legal, and regulatory purposes.
            </p>
          </CardContent>
        </Card>

        {/* Request Form */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Request Account Closure</CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Close My Account
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-white">Confirm Account Closure</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Please provide some information about your decision
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label className="text-white">Reason for Closing</Label>
                    <Select value={reason} onValueChange={setReason}>
                      <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="no_longer_needed">No longer needed</SelectItem>
                        <SelectItem value="switching_lender">Switching to another lender</SelectItem>
                        <SelectItem value="privacy_concerns">Privacy concerns</SelectItem>
                        <SelectItem value="service_quality">Service quality issues</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-white">Additional Details (optional)</Label>
                    <Textarea
                      placeholder="Tell us more about your decision..."
                      value={detailedReason}
                      onChange={(e) => setDetailedReason(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dataExport"
                      checked={dataExportRequested}
                      onCheckedChange={(checked) => setDataExportRequested(checked as boolean)}
                    />
                    <Label htmlFor="dataExport" className="text-white text-sm cursor-pointer">
                      Request a copy of my data before deletion
                    </Label>
                  </div>

                  <div className="flex items-start space-x-2 p-3 bg-red-900/30 rounded">
                    <Checkbox
                      id="confirm"
                      checked={confirmUnderstand}
                      onCheckedChange={(checked) => setConfirmUnderstand(checked as boolean)}
                    />
                    <Label htmlFor="confirm" className="text-red-200 text-sm cursor-pointer leading-tight">
                      I understand that this action is permanent and I will lose access to my account, 
                      loan history, and all associated data
                    </Label>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleSubmit}
                      disabled={requestMutation.isPending || !confirmUnderstand}
                      className="flex-1"
                    >
                      {requestMutation.isPending ? "Submitting..." : "Submit Closure Request"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowConfirmDialog(false)}
                      className="border-slate-600"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
