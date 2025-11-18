import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Upload, FileText, CheckCircle2, XCircle, Clock, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";

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
  approved: CheckCircle2,
  rejected: XCircle,
  expired: XCircle,
};

export default function VerificationUpload() {
  const { isAuthenticated } = useAuth();
  const [selectedType, setSelectedType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [viewDocument, setViewDocument] = useState<{ url: string; type: string } | null>(null);

  const utils = trpc.useUtils();
  const { data: documents, isLoading } = trpc.verification.myDocuments.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const uploadMutation = trpc.verification.uploadDocument.useMutation({
    onSuccess: () => {
      utils.verification.myDocuments.invalidate();
      toast.success("Document uploaded successfully");
      setSelectedType("");
      setSelectedFile(null);
      setPreviewUrl(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload document");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPEG, PNG, and PDF files are allowed");
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedType) {
      toast.error("Please select a document type and file");
      return;
    }

    setUploading(true);

    try {
      // Step 1: Upload file to external storage via server
      const formData = new FormData();
      formData.append("file", selectedFile);

      // Get session token from cookies
      const sessionToken = document.cookie
        .split("; ")
        .find(row => row.startsWith("app_session_id="))
        ?.split("=")[1];

      const uploadResponse = await fetch("/api/upload-document", {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${sessionToken || ""}`,
        },
        credentials: "include", // Include cookies in request
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || "Storage upload failed");
      }

      const uploadedFile = await uploadResponse.json();
      
      // Step 2: Register document in database with URL (not Base64)
      await uploadMutation.mutateAsync({
        documentType: selectedType as any,
        fileName: uploadedFile.fileName,
        filePath: uploadedFile.url, // ✅ Store URL from storage, not Base64
        fileSize: uploadedFile.fileSize,
        mimeType: uploadedFile.mimeType,
      });

      setUploading(false);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload document");
      setUploading(false);
    }
  };

  const viewDocumentPreview = (filePath: string, mimeType: string) => {
    setViewDocument({ url: filePath, type: mimeType });
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Verification Documents
          </CardTitle>
          <CardDescription>
            Upload identity and financial documents for verification. Accepted formats: JPEG, PNG, PDF (max 10MB)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="documentType">Document Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger id="documentType">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(documentTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fileUpload">Select File</Label>
            <Input
              id="fileUpload"
              type="file"
              accept="image/jpeg,image/png,image/jpg,application/pdf"
              onChange={handleFileSelect}
              disabled={!selectedType}
            />
          </div>

          {previewUrl && (
            <div className="border rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Preview:</p>
              <img
                src={previewUrl}
                alt="Document preview"
                className="max-w-full h-auto max-h-64 rounded border"
              />
            </div>
          )}

          {selectedFile && !previewUrl && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <FileText className="w-5 h-5 text-gray-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !selectedType || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </>
            )}
          </Button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>Required Documents:</strong> At minimum, upload a valid government-issued ID
              (Driver's License or Passport) and a recent bank statement or utility bill for address
              verification.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>My Documents</CardTitle>
          <CardDescription>View the status of your uploaded verification documents</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => {
                const StatusIcon = statusIcons[doc.status];
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-gray-600" />
                      <div className="flex-1">
                        <p className="font-medium">{documentTypeLabels[doc.documentType]}</p>
                        <p className="text-sm text-gray-500">{doc.fileName}</p>
                        <p className="text-xs text-gray-400">
                          Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`${statusColors[doc.status]} border`}>
                        <StatusIcon
                          className={`w-3 h-3 mr-1 ${
                            doc.status === "under_review" ? "animate-spin" : ""
                          }`}
                        />
                        {doc.status.replace("_", " ").toUpperCase()}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewDocumentPreview(doc.filePath, doc.mimeType)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                    {doc.status === "rejected" && doc.rejectionReason && (
                      <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                        <strong>Reason:</strong> {doc.rejectionReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No documents uploaded yet</p>
              <p className="text-sm">Upload your verification documents to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Preview Dialog */}
      <Dialog open={!!viewDocument} onOpenChange={() => setViewDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
          </DialogHeader>
          {viewDocument && (
            <div className="mt-4">
              {viewDocument.type.startsWith("image/") ? (
                <img
                  src={viewDocument.url}
                  alt="Document"
                  className="max-w-full h-auto rounded border"
                />
              ) : viewDocument.type === "application/pdf" ? (
                <iframe
                  src={viewDocument.url}
                  className="w-full h-[70vh] border rounded"
                  title="PDF Preview"
                />
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">Preview not available for this file type</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
