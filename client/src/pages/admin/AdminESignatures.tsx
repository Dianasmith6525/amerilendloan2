import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, ArrowLeft, PenTool, Clock,
  CheckCircle, Search, FileSignature, RefreshCw, XCircle, Download
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface ESignatureDocument {
  id: number;
  userId: number;
  loanApplicationId: number;
  documentType: string;
  documentTitle?: string | null;
  documentPath?: string | null;
  status: string;
  signatureHash?: string | null;
  ipAddress?: string | null;
  createdAt: string | Date;
  signedAt?: string | Date | null;
}

export default function AdminESignatures() {
  const [, setLocation] = useLocation();
  const [selectedDocument, setSelectedDocument] = useState<ESignatureDocument | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data: docsData, isLoading, refetch } = trpc.eSignature.adminGetAll.useQuery(
    { status: statusFilter }
  );

  const resendMutation = trpc.eSignature.adminResend.useMutation({
    onSuccess: () => {
      toast.success("Signature request resent");
      refetch();
    },
    onError: (err: { message?: string }) => toast.error(err.message || "Failed to resend"),
  });

  const revokeMutation = trpc.eSignature.adminRevoke.useMutation({
    onSuccess: () => {
      toast.success("Document revoked/expired");
      refetch();
      setSelectedDocument(null);
    },
    onError: (err: { message?: string }) => toast.error(err.message || "Failed to revoke"),
  });

  const documents = docsData?.data ?? [];
  const pending = documents.filter((d) => d.status === "pending");
  const signed = documents.filter((d) => d.status === "signed");
  const expired = documents.filter((d) => d.status === "expired");

  const statusBadge = (status: string) => {
    switch (status) {
      case "signed":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Signed</Badge>;
      case "expired":
        return <Badge variant="destructive"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
      case "pending":
        return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge className="bg-slate-600">{status}</Badge>;
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
              <FileSignature className="h-8 w-8 text-indigo-400" />
              E-Signature Management
            </h1>
            <p className="text-slate-400 mt-1">Monitor all e-signature documents and their status</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-white">{documents.length}</p>
              <p className="text-slate-400 text-sm">Total Documents</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-yellow-400">{pending.length}</p>
              <p className="text-slate-400 text-sm">Awaiting Signature</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-green-400">{signed.length}</p>
              <p className="text-slate-400 text-sm">Signed</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-red-400">{expired.length}</p>
              <p className="text-slate-400 text-sm">Expired</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document List */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <PenTool className="h-5 w-5" /> Signature Documents
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Track all e-signature requests and completions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all" onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v)}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="signed">Signed</TabsTrigger>
                    <TabsTrigger value="expired">Expired</TabsTrigger>
                  </TabsList>
                </Tabs>

                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-12">
                    <FileSignature className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No e-signature documents found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDocument(doc)}
                        className={`p-4 rounded-lg cursor-pointer transition-colors border ${
                          selectedDocument?.id === doc.id
                            ? "bg-slate-600/50 border-indigo-500"
                            : "bg-slate-700/50 hover:bg-slate-700 border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">
                              {doc.documentTitle || `Document #${doc.id}`}
                            </p>
                            <p className="text-slate-400 text-sm mt-1">
                              User #{doc.userId} • Loan #{doc.loanApplicationId}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {doc.documentType}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {statusBadge(doc.status)}
                            <span className="text-xs text-slate-500">
                              {new Date(doc.createdAt).toLocaleDateString()}
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
            {selectedDocument ? (
              <Card className="bg-slate-800 border-slate-700 sticky top-4">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg">
                      {selectedDocument.documentTitle || `Document #${selectedDocument.id}`}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDocument(null)} className="text-slate-400">
                      ✕
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Status</h3>
                    {statusBadge(selectedDocument.status)}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Document Type</h3>
                    <p className="text-white">{selectedDocument.documentType}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">User ID</h3>
                    <p className="text-white">#{selectedDocument.userId}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Loan Application</h3>
                    <p className="text-white">#{selectedDocument.loanApplicationId}</p>
                  </div>
                  {selectedDocument.documentPath && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Document Path</h3>
                      <p className="text-slate-300 text-xs font-mono bg-slate-700/50 p-2 rounded break-all">
                        {selectedDocument.documentPath}
                      </p>
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Created</h3>
                    <p className="text-slate-300 text-sm">{new Date(selectedDocument.createdAt).toLocaleString()}</p>
                  </div>
                  {selectedDocument.signedAt && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Signed At</h3>
                      <p className="text-green-300 text-sm flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {new Date(selectedDocument.signedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {selectedDocument.ipAddress && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Signing IP</h3>
                      <p className="text-slate-300 text-sm font-mono">{selectedDocument.ipAddress}</p>
                    </div>
                  )}
                  {selectedDocument.signatureHash && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Signature Hash</h3>
                      <p className="text-slate-300 text-xs font-mono bg-slate-700/50 p-2 rounded break-all">
                        {selectedDocument.signatureHash}
                      </p>
                    </div>
                  )}

                  {/* Admin Actions */}
                  <div className="border-t border-slate-600 pt-4 space-y-2">
                    <h3 className="text-sm font-medium text-slate-400 mb-2">Actions</h3>
                    {selectedDocument.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          disabled={resendMutation.isPending}
                          onClick={() => resendMutation.mutate({ documentId: selectedDocument.id })}
                        >
                          <RefreshCw className="w-3 h-3 mr-2" />
                          {resendMutation.isPending ? "Resending..." : "Resend Request"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full"
                          disabled={revokeMutation.isPending}
                          onClick={() => {
                            if (confirm("Are you sure you want to revoke this signature request?")) {
                              revokeMutation.mutate({ documentId: selectedDocument.id });
                            }
                          }}
                        >
                          <XCircle className="w-3 h-3 mr-2" />
                          {revokeMutation.isPending ? "Revoking..." : "Revoke / Expire"}
                        </Button>
                      </>
                    )}
                    {selectedDocument.documentPath && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          toast.info(`Document path: ${selectedDocument.documentPath}`);
                        }}
                      >
                        <Download className="w-3 h-3 mr-2" />
                        View Document Path
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="pt-6 text-center py-12">
                  <Search className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Select a document to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
