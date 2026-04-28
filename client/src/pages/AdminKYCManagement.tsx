import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock, FileText, Download, Loader2, CheckCheck, ShieldCheck, AlertTriangle, Shield, CreditCard, User, FileImage, FileCheck } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface KYCVerification {
  userId: number;
  userName: string;
  userEmail: string;
  status: string;
  submittedAt: Date;
  documents: Document[];
}

interface Document {
  id: number;
  type: string;
  fileName: string;
  uploadedAt: Date;
  status: string;
  notes: string;
}

export function AdminKYCManagement() {
  const [selectedKYC, setSelectedKYC] = useState<KYCVerification | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  // Fetch pending KYC verifications
  const { data: kycVerifications = [], isLoading } = trpc.admin.listPendingKYC.useQuery();
  const utils = trpc.useUtils();

  // Mutations — these approve/reject ALL docs for the user at once & send one email
  const approveKYCMutation = trpc.admin.approveKYC.useMutation({
    onSuccess: (data) => {
      toast.success(data?.message || "All documents approved — one email sent to user");
      utils.admin.listPendingKYC.invalidate();
      setSelectedKYC(null);
      setAdminNotes("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve KYC");
    },
  });

  const rejectKYCMutation = trpc.admin.rejectKYC.useMutation({
    onSuccess: (data) => {
      toast.success(data?.message || "All documents rejected — one email sent to user");
      utils.admin.listPendingKYC.invalidate();
      setSelectedKYC(null);
      setAdminNotes("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject KYC");
    },
  });

  const handleApproveAll = () => {
    if (!selectedKYC) return;
    approveKYCMutation.mutate({
      userId: selectedKYC.userId,
      notes: adminNotes || undefined,
    });
  };

  const handleRejectAll = () => {
    if (!selectedKYC || !adminNotes.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    rejectKYCMutation.mutate({
      userId: selectedKYC.userId,
      reason: adminNotes,
    });
  };

  const pendingDocs = selectedKYC?.documents.filter(d => d.status === "pending") || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-600 flex items-center gap-1 w-fit">
            <CheckCircle className="w-3 h-3" />
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-600 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" />
            Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
            <XCircle className="w-3 h-3" />
            Rejected
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-orange-600 flex items-center gap-1 w-fit">
            <AlertTriangle className="w-3 h-3" />
            Expired
          </Badge>
        );
      default:
        return null;
    }
  };

  const getDocumentBadge = (status: string) => {
    switch (status) {
      case "approved":
      case "verified":
        return <Badge className="bg-green-600 text-xs">Verified</Badge>;
      case "pending":
        return <Badge className="bg-yellow-600 text-xs">Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
      case "expired":
        return <Badge className="bg-orange-600 text-xs">Expired</Badge>;
      default:
        return <Badge className="bg-slate-600 text-xs">{status}</Badge>;
    }
  };

  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case "drivers_license_front":
      case "drivers_license_back":
      case "driver_license":
        return <CreditCard className="w-4 h-4 text-blue-400" />;
      case "passport":
        return <Shield className="w-4 h-4 text-purple-400" />;
      case "national_id_front":
      case "national_id_back":
      case "state_id":
        return <User className="w-4 h-4 text-cyan-400" />;
      case "selfie_with_id":
        return <FileImage className="w-4 h-4 text-green-400" />;
      case "ssn_card":
        return <FileCheck className="w-4 h-4 text-red-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">KYC Management</h1>
          </div>
          <p className="text-slate-400">Review and approve user identity verification</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{kycVerifications.length}</p>
                <p className="text-slate-400 text-sm">Total Submissions</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-400">
                  {kycVerifications.filter((k) => k.status === "pending").length}
                </p>
                <p className="text-slate-400 text-sm">Pending Review</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">
                  {kycVerifications.filter((k) => k.status === "approved").length}
                </p>
                <p className="text-slate-400 text-sm">Approved</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-400">
                  {kycVerifications.filter((k) => k.status === "rejected").length}
                </p>
                <p className="text-slate-400 text-sm">Rejected</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KYC List */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>KYC Submissions</CardTitle>
                <CardDescription>Review user identity verification documents</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : kycVerifications.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
                <p className="text-slate-400">No KYC submissions found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {kycVerifications.map((kyc) => (
                  <div
                    key={kyc.userId}
                    onClick={() => setSelectedKYC(kyc)}
                    className="p-4 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-white font-semibold">{kyc.userName}</h3>
                        <p className="text-slate-400 text-sm">{kyc.userEmail}</p>
                      </div>
                      <div className="flex gap-2">
                        {getStatusBadge(kyc.status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Submitted: {new Date(kyc.submittedAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{kyc.documents.length} documents</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* KYC Details */}
        {selectedKYC && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedKYC.userName}</CardTitle>
                  <CardDescription>{selectedKYC.userEmail}</CardDescription>
                </div>
                <Button variant="outline" onClick={() => setSelectedKYC(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status */}
              <div>
                <h3 className="text-white font-semibold mb-3">Status</h3>
                <div className="flex gap-2">
                  {getStatusBadge(selectedKYC.status)}
                  <p className="text-slate-400 text-sm">
                    Submitted: {new Date(selectedKYC.submittedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h3 className="text-white font-semibold mb-3">Documents</h3>
                <div className="space-y-3">
                  {selectedKYC.documents.map((doc) => (
                    <div key={doc.id} className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getDocumentTypeIcon(doc.type)}
                          <div>
                            <p className="text-white text-sm font-medium">{doc.fileName}</p>
                            <p className="text-xs text-slate-400">{doc.type.replace("_", " ")}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {getDocumentBadge(doc.status)}
                          <Button variant="ghost" size="sm" className="text-blue-400">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {doc.notes && (
                        <p className="text-xs text-slate-400 ml-10">Admin Notes: {doc.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <h3 className="text-white font-semibold mb-3">Admin Notes</h3>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                  rows={4}
                  placeholder="Add notes about this KYC submission..."
                />
              </div>

              {/* Actions */}
              {selectedKYC.status === "pending" && (
                <div className="pt-4 border-t border-slate-600 space-y-3">
                  <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-blue-300 font-medium">Bulk Action</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        This will approve or reject <strong className="text-white">{pendingDocs.length} document{pendingDocs.length !== 1 ? 's' : ''}</strong> at once and send <strong className="text-white">one consolidated email</strong> to {selectedKYC.userName}.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApproveAll}
                      disabled={approveKYCMutation.isPending || pendingDocs.length === 0}
                      className="bg-green-600 hover:bg-green-700 flex-1"
                    >
                      {approveKYCMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Approving All...
                        </>
                      ) : (
                        <>
                          <CheckCheck className="w-4 h-4 mr-2" />
                          Approve All {pendingDocs.length} Document{pendingDocs.length !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleRejectAll}
                      disabled={rejectKYCMutation.isPending || !adminNotes.trim() || pendingDocs.length === 0}
                      variant="destructive"
                      className="flex-1"
                    >
                      {rejectKYCMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Rejecting All...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject All {pendingDocs.length} Document{pendingDocs.length !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </div>
                  {!adminNotes.trim() && (
                    <p className="text-xs text-yellow-400 text-center">
                      * Admin notes required to reject documents
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default AdminKYCManagement;
