import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Upload, FileText, CheckCircle2, XCircle, Clock, Loader2, Eye, Shield, AlertCircle, Trash2 } from "lucide-react";
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
  const [isDragging, setIsDragging] = useState(false);

  const utils = trpc.useUtils();
  const { data: documents, isLoading } = trpc.verification.myDocuments.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const uploadMutation = trpc.verification.uploadDocument.useMutation({
    onSuccess: () => {
      utils.verification.myDocuments.invalidate();
      toast.success("Document uploaded successfully - verification will be processed automatically");
      setSelectedType("");
      setSelectedFile(null);
      setPreviewUrl(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload document");
    },
  });

  const deleteMutation = trpc.verification.deleteDocument.useMutation({
    onSuccess: () => {
      utils.verification.myDocuments.invalidate();
      toast.success("Document deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete document");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    processFile(file);
  };

  const processFile = (file: File) => {
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

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedType) {
      toast.error("Please select a document type and file");
      return;
    }

    // Validate file size
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      setUploading(false);
      return;
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error("Only JPEG, PNG, and PDF files are allowed");
      setUploading(false);
      return;
    }

    setUploading(true);

    try {
      // Step 1: Upload file to external storage via server
      const formData = new FormData();
      formData.append("file", selectedFile);

      console.log("[Upload] Starting upload for:", selectedFile.name, "Type:", selectedFile.type, "Size:", selectedFile.size);

      const uploadResponse = await fetch("/api/upload-document", {
        method: "POST",
        body: formData,
        credentials: "include", // Include cookies in request
      });

      console.log("[Upload] Upload endpoint response status:", uploadResponse.status);

      if (!uploadResponse.ok) {
        let errorMessage = "Storage upload failed";
        try {
          const errorData = await uploadResponse.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If response isn't JSON, use status text
          errorMessage = uploadResponse.statusText || `Upload failed with status ${uploadResponse.status}`;
        }
        
        console.error("[Upload] Upload failed:", errorMessage);
        throw new Error(errorMessage);
      }

      let uploadedFile;
      try {
        uploadedFile = await uploadResponse.json();
        console.log("[Upload] Upload response received:", { fileName: uploadedFile.fileName, url: uploadedFile.url ? "✓" : "✗" });
      } catch (parseError) {
        console.error("[Upload] Failed to parse upload response:", parseError);
        throw new Error("Invalid response from upload endpoint");
      }

      if (!uploadedFile.url) {
        console.error("[Upload] Upload response missing URL");
        throw new Error("Upload endpoint did not return a file URL");
      }

      // Step 2: Register document in database with URL (not Base64)
      console.log("[Upload] Registering document in database...");
      await uploadMutation.mutateAsync({
        documentType: selectedType as any,
        fileName: uploadedFile.fileName,
        filePath: uploadedFile.url, // ✅ Store URL from storage, not Base64
        fileSize: uploadedFile.fileSize,
        mimeType: uploadedFile.mimeType,
      });

      console.log("[Upload] Document registration complete");
      setUploading(false);
    } catch (error) {
      console.error("[Upload] Error:", error);
      const message = error instanceof Error ? error.message : "Failed to upload document";
      toast.error(message);
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

          {/* Drag and Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-[#0033A0] bg-blue-50"
                : selectedType
                ? "border-gray-300 hover:border-gray-400 cursor-pointer"
                : "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
            }`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (selectedType) {
                document.getElementById("fileUpload")?.click();
              }
            }}
          >
            <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? "text-[#0033A0]" : "text-gray-400"}`} />
            {isDragging ? (
              <p className="text-[#0033A0] font-medium">Drop your file here</p>
            ) : (
              <>
                <p className="text-gray-700 font-medium mb-1">
                  {selectedType ? "Drag and drop your file here" : "Select a document type first"}
                </p>
                <p className="text-sm text-gray-500">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">JPEG, PNG, PDF • Max 10MB</p>
              </>
            )}
          </div>

          <Input
            id="fileUpload"
            type="file"
            accept="image/jpeg,image/png,image/jpg,application/pdf"
            onChange={handleFileSelect}
            disabled={!selectedType}
            className="hidden"
          />

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
                    className="flex flex-col p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
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
                      <div className="flex items-center gap-2">
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
                          title="View document"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {(doc.status === "pending" || doc.status === "rejected") && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this document?")) {
                                deleteMutation.mutate({ id: doc.id });
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
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
