import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  Eye,
  ThumbsUp,
  ThumbsDown,
  User,
  Calendar
} from "lucide-react";
import { toast } from "sonner";

const documentTypeLabels: Record<string, string> = {
  drivers_license_front: "Driver's License (Front)",
  drivers_license_back: "Driver's License (Back)",
  passport: "Passport",
  national_id_front: "National ID (Front)",
  national_id_back: "National ID (Back)",
  ssn_card: "Social Security Card",
  bank_statement: "Bank Statement",
  utility_bill: "Utility Bill",
  pay_stub: "Pay Stub",
  tax_return: "Tax Return",
  other: "Other Document",
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  under_review: "bg-blue-100 text-blue-800 border-blue-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  expired: "bg-gray-100 text-gray-800 border-gray-300",
};

const statusIcons = {
  pending: Clock,
  under_review: Loader2,
  approved: CheckCircle,
  rejected: XCircle,
  expired: XCircle,
};

export default function VerificationDocumentsAdmin() {
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const utils = trpc.useUtils();
  const { data: documents, isLoading } = trpc.verification.adminList.useQuery(undefined, {
    refetchInterval: 3000, // Real-time refresh every 3 seconds
  });

  const approveMutation = trpc.verification.adminApprove.useMutation({
    onSuccess: () => {
      toast.success("Document approved successfully");
      utils.verification.adminList.invalidate();
      setApproveDialog(false);
      setSelectedDocument(null);
      setAdminNotes("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve document");
    },
  });

  const rejectMutation = trpc.verification.adminReject.useMutation({
    onSuccess: () => {
      toast.success("Document rejected");
      utils.verification.adminList.invalidate();
      setRejectDialog(false);
      setSelectedDocument(null);
      setRejectionReason("");
      setAdminNotes("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject document");
    },
  });

  const handleApprove = () => {
    if (!selectedDocument) return;
    approveMutation.mutate({
      id: selectedDocument.id,
      adminNotes: adminNotes || undefined,
    });
  };

  const handleReject = () => {
    if (!selectedDocument || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    rejectMutation.mutate({
      id: selectedDocument.id,
      rejectionReason: rejectionReason,
      adminNotes: adminNotes || undefined,
    });
  };

  const openViewDialog = (doc: any) => {
    setSelectedDocument(doc);
    setViewDialog(true);
  };

  const openApproveDialog = (doc: any) => {
    setSelectedDocument(doc);
    setApproveDialog(true);
  };

  const openRejectDialog = (doc: any) => {
    setSelectedDocument(doc);
    setRejectDialog(true);
  };

  const pendingDocuments = documents?.filter(d => d.status === "pending" || d.status === "under_review");
  const reviewedDocuments = documents?.filter(d => d.status === "approved" || d.status === "rejected");

  return (
    <div className="space-y-6">
      {/* Pending Review Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            Pending Review ({pendingDocuments?.length || 0})
          </CardTitle>
          <CardDescription>Documents awaiting verification</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : pendingDocuments && pendingDocuments.length > 0 ? (
            <div className="space-y-4">
              {pendingDocuments.map((doc) => {
                const StatusIcon = statusIcons[doc.status];
                return (
                  <div
                    key={doc.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="w-5 h-5 text-gray-600" />
                        <div className="flex-1">
                          <p className="font-medium">{documentTypeLabels[doc.documentType]}</p>
                          <p className="text-sm text-gray-500">{doc.fileName}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              User ID: {doc.userId}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {(doc.fileSize / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge className={`${statusColors[doc.status]} border`}>
                        <StatusIcon
                          className={`w-3 h-3 mr-1 ${
                            doc.status === "under_review" ? "animate-spin" : ""
                          }`}
                        />
                        {doc.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>

                    {doc.documentNumber && (
                      <div className="text-sm text-gray-600">
                        <strong>Document #:</strong> {doc.documentNumber}
                      </div>
                    )}

                    {doc.expiryDate && (
                      <div className="text-sm text-gray-600">
                        <strong>Expiry Date:</strong> {doc.expiryDate}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openViewDialog(doc)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => openApproveDialog(doc)}
                      >
                        <ThumbsUp className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openRejectDialog(doc)}
                      >
                        <ThumbsDown className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No documents pending review</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviewed Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Reviewed Documents ({reviewedDocuments?.length || 0})
          </CardTitle>
          <CardDescription>Previously approved or rejected documents</CardDescription>
        </CardHeader>
        <CardContent>
          {reviewedDocuments && reviewedDocuments.length > 0 ? (
            <div className="space-y-3">
              {reviewedDocuments.map((doc) => {
                const StatusIcon = statusIcons[doc.status];
                return (
                  <div
                    key={doc.id}
                    className="border rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="w-5 h-5 text-gray-600" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{documentTypeLabels[doc.documentType]}</p>
                          <p className="text-xs text-gray-500">
                            User ID: {doc.userId} • {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${statusColors[doc.status]} border text-xs`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {doc.status.toUpperCase()}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openViewDialog(doc)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {doc.status === "rejected" && doc.rejectionReason && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                        <strong>Rejection Reason:</strong> {doc.rejectionReason}
                      </div>
                    )}
                    {doc.adminNotes && (
                      <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        <strong>Admin Notes:</strong> {doc.adminNotes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">No reviewed documents yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Document Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
            {selectedDocument && (
              <DialogDescription>
                {documentTypeLabels[selectedDocument.documentType]} - User ID: {selectedDocument.userId}
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold">File Name:</p>
                  <p className="text-gray-600">{selectedDocument.fileName}</p>
                </div>
                <div>
                  <p className="font-semibold">File Size:</p>
                  <p className="text-gray-600">{(selectedDocument.fileSize / 1024).toFixed(2)} KB</p>
                </div>
                <div>
                  <p className="font-semibold">Uploaded:</p>
                  <p className="text-gray-600">{new Date(selectedDocument.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-semibold">Status:</p>
                  <Badge className={`${statusColors[selectedDocument.status as keyof typeof statusColors]} border`}>
                    {selectedDocument.status.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>
                {selectedDocument.documentNumber && (
                  <div>
                    <p className="font-semibold">Document Number:</p>
                    <p className="text-gray-600">{selectedDocument.documentNumber}</p>
                  </div>
                )}
                {selectedDocument.expiryDate && (
                  <div>
                    <p className="font-semibold">Expiry Date:</p>
                    <p className="text-gray-600">{selectedDocument.expiryDate}</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                {selectedDocument.mimeType.startsWith("image/") ? (
                  <img
                    src={selectedDocument.filePath}
                    alt="Document"
                    className="max-w-full h-auto rounded border"
                  />
                ) : selectedDocument.mimeType === "application/pdf" ? (
                  <iframe
                    src={selectedDocument.filePath}
                    className="w-full h-[60vh] border rounded"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500">Preview not available for this file type</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Document</DialogTitle>
            <DialogDescription>
              Confirm that this document has been verified and approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="approveNotes">Admin Notes (Optional)</Label>
              <Textarea
                id="approveNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any notes about this verification..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApproveDialog(false);
                setAdminNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this verification document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Document expired, Image unclear, Information doesn't match..."
                rows={3}
                required
              />
            </div>
            <div>
              <Label htmlFor="rejectNotes">Admin Notes (Optional)</Label>
              <Textarea
                id="rejectNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialog(false);
                setRejectionReason("");
                setAdminNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
