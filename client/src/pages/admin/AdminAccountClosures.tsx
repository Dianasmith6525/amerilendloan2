import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  CheckCircle, XCircle, Clock, FileText, Loader2,
  ArrowLeft, AlertTriangle, UserX, Calendar, Shield
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface ClosureRequest {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  reason: string;
  detailedReason?: string | null;
  status: string;
  dataExportRequested: boolean | null;
  adminNotes?: string | null;
  createdAt: string | Date;
  scheduledDeletionDate?: string | null;
}

export default function AdminAccountClosures() {
  const [, setLocation] = useLocation();
  const [selectedRequest, setSelectedRequest] = useState<ClosureRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [scheduledDeletionDate, setScheduledDeletionDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data: requestsData, isLoading } = trpc.accountClosure.adminGetAll.useQuery(
    { status: statusFilter }
  );
  const utils = trpc.useUtils();

  const reviewMutation = trpc.accountClosure.adminReview.useMutation({
    onSuccess: () => {
      toast.success("Account closure request reviewed successfully");
      utils.accountClosure.adminGetAll.invalidate();
      setSelectedRequest(null);
      setAdminNotes("");
      setScheduledDeletionDate("");
    },
    onError: (err) => toast.error(err.message),
  });

  const requests = requestsData?.data ?? [];
  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");
  const rejected = requests.filter((r) => r.status === "rejected");

  const handleReview = (status: "approved" | "rejected") => {
    if (!selectedRequest) return;
    reviewMutation.mutate({
      requestId: selectedRequest.id,
      status,
      adminNotes: adminNotes || undefined,
      scheduledDeletionDate: scheduledDeletionDate || undefined,
    });
  };

  const reasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      no_longer_needed: "No Longer Needed",
      switching_lender: "Switching Lender",
      privacy_concerns: "Privacy Concerns",
      service_quality: "Service Quality",
      other: "Other",
    };
    return labels[reason] || reason;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")} className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <UserX className="h-8 w-8 text-red-400" />
              Account Closure Management
            </h1>
            <p className="text-slate-400 mt-1">Review and process account closure requests</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-white">{requests.length}</p>
              <p className="text-slate-400 text-sm">Total Requests</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-yellow-400">{pending.length}</p>
              <p className="text-slate-400 text-sm">Pending Review</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-green-400">{approved.length}</p>
              <p className="text-slate-400 text-sm">Approved</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-red-400">{rejected.length}</p>
              <p className="text-slate-400 text-sm">Rejected</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Request List */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Closure Requests
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Click a request to review and take action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all" onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v)}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                  </TabsList>
                </Tabs>

                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : requests.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No closure requests found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requests.map((req) => (
                      <div
                        key={req.id}
                        onClick={() => setSelectedRequest(req)}
                        className={`p-4 rounded-lg cursor-pointer transition-colors border ${
                          selectedRequest?.id === req.id
                            ? "bg-slate-600/50 border-red-500"
                            : "bg-slate-700/50 hover:bg-slate-700 border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">
                              Closure #{req.id} — {reasonLabel(req.reason)}
                            </p>
                            <p className="text-slate-400 text-sm mt-1">
                              User #{req.userId}
                              {req.dataExportRequested && (
                                <span className="ml-2 text-blue-400">• Data export requested</span>
                              )}
                            </p>
                            {req.detailedReason && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-1">{req.detailedReason}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {statusBadge(req.status)}
                            <span className="text-xs text-slate-500">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detail Panel */}
          <div>
            {selectedRequest ? (
              <Card className="bg-slate-800 border-slate-700 sticky top-4">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Closure #{selectedRequest.id}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)} className="text-slate-400">
                      ✕
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Reason</h3>
                    <p className="text-white">{reasonLabel(selectedRequest.reason)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Status</h3>
                    {statusBadge(selectedRequest.status)}
                  </div>
                  {selectedRequest.detailedReason && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Detailed Reason</h3>
                      <p className="text-slate-300 text-sm">{selectedRequest.detailedReason}</p>
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Data Export Requested</h3>
                    <p className="text-white">{selectedRequest.dataExportRequested ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Submitted</h3>
                    <p className="text-slate-300 text-sm">{new Date(selectedRequest.createdAt).toLocaleString()}</p>
                  </div>

                  {selectedRequest.scheduledDeletionDate && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Scheduled Deletion</h3>
                      <p className="text-red-300 text-sm flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(selectedRequest.scheduledDeletionDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {selectedRequest.status === "pending" && (
                    <>
                      <hr className="border-slate-600" />
                      <div>
                        <h3 className="text-sm font-medium text-slate-400 mb-2">Review Actions</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-slate-400">Scheduled Deletion Date</label>
                            <Input
                              type="date"
                              value={scheduledDeletionDate}
                              onChange={(e) => setScheduledDeletionDate(e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400">Admin Notes</label>
                            <Textarea
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              placeholder="Add notes about this decision..."
                              className="bg-slate-700 border-slate-600 text-white mt-1"
                              rows={3}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => handleReview("approved")}
                              disabled={reviewMutation.isPending}
                            >
                              {reviewMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-1" />
                              )}
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              className="flex-1"
                              onClick={() => handleReview("rejected")}
                              disabled={reviewMutation.isPending}
                            >
                              {reviewMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <XCircle className="h-4 w-4 mr-1" />
                              )}
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {selectedRequest.adminNotes && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Previous Admin Notes</h3>
                      <p className="text-slate-300 text-sm bg-slate-700/50 p-2 rounded">{selectedRequest.adminNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="pt-6 text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Select a request to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
