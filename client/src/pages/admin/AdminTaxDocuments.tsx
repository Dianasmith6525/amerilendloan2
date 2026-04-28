import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileText, Loader2, ArrowLeft, Calendar,
  Receipt, Search
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

interface TaxDocumentRecord {
  id: number;
  userId: number;
  loanApplicationId?: number | null;
  documentType: string;
  taxYear: number;
  totalInterestPaid?: number | null;
  totalPrincipalPaid?: number | null;
  debtCancelled?: number | null;
  documentPath?: string | null;
  content?: string | null;
  generatedAt: string | Date;
  sentToUser?: boolean | null;
  sentAt?: string | Date | null;
}

export default function AdminTaxDocuments() {
  const [, setLocation] = useLocation();
  const [selectedDocument, setSelectedDocument] = useState<TaxDocumentRecord | null>(null);
  const [taxYearFilter, setTaxYearFilter] = useState<number | undefined>(undefined);
  const [userIdFilter, setUserIdFilter] = useState<string>("");

  const { data: docsData, isLoading } = trpc.taxDocuments.adminGetAll.useQuery({
    taxYear: taxYearFilter,
    userId: userIdFilter ? parseInt(userIdFilter) : undefined,
  });

  const documents = docsData?.data ?? [];

  const docTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      "1098": "Form 1098 (Mortgage Interest)",
      "1099_c": "Form 1099-C (Debt Cancellation)",
      interest_statement: "Interest Statement",
    };
    return labels[type] || type;
  };

  const docTypeBadge = (type: string) => {
    switch (type) {
      case "1098":
        return <Badge className="bg-blue-600">1098</Badge>;
      case "1099_c":
        return <Badge className="bg-purple-600">1099-C</Badge>;
      default:
        return <Badge className="bg-slate-600">Statement</Badge>;
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

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
              <Receipt className="h-8 w-8 text-emerald-400" />
              Tax Document Management
            </h1>
            <p className="text-slate-400 mt-1">View and manage all generated tax documents</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-white">{documents.length}</p>
              <p className="text-slate-400 text-sm">Total Documents</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-blue-400">
                {documents.filter((d) => d.documentType === "1098").length}
              </p>
              <p className="text-slate-400 text-sm">Form 1098</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {documents.filter((d) => d.documentType === "1099_c").length}
              </p>
              <p className="text-slate-400 text-sm">Form 1099-C</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tax Year</label>
                <select
                  title="Filter by tax year"
                  value={taxYearFilter ?? ""}
                  onChange={(e) => setTaxYearFilter(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All Years</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">User ID</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={userIdFilter}
                    onChange={(e) => setUserIdFilter(e.target.value)}
                    placeholder="Filter by user ID"
                    className="bg-slate-700 border-slate-600 text-white w-40"
                  />
                  {userIdFilter && (
                    <Button variant="ghost" size="sm" onClick={() => setUserIdFilter("")} className="text-slate-400">
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document List */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Tax Documents
                </CardTitle>
                <CardDescription className="text-slate-400">
                  All generated tax documents across users
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No tax documents found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDocument(doc)}
                        className={`p-4 rounded-lg cursor-pointer transition-colors border ${
                          selectedDocument?.id === doc.id
                            ? "bg-slate-600/50 border-emerald-500"
                            : "bg-slate-700/50 hover:bg-slate-700 border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">
                              {docTypeLabel(doc.documentType)}
                            </p>
                            <p className="text-slate-400 text-sm mt-1">
                              User #{doc.userId} • Tax Year {doc.taxYear}
                              {doc.loanApplicationId && ` • Loan #${doc.loanApplicationId}`}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {docTypeBadge(doc.documentType)}
                            <span className="text-xs text-slate-500">
                              {new Date(doc.generatedAt).toLocaleDateString()}
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
                    <CardTitle className="text-white">Document #{selectedDocument.id}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDocument(null)} className="text-slate-400">
                      ✕
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Document Type</h3>
                    <p className="text-white">{docTypeLabel(selectedDocument.documentType)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Tax Year</h3>
                    <p className="text-white flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      {selectedDocument.taxYear}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">User ID</h3>
                    <p className="text-white">#{selectedDocument.userId}</p>
                  </div>
                  {selectedDocument.loanApplicationId && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Loan Application</h3>
                      <p className="text-white">#{selectedDocument.loanApplicationId}</p>
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Generated</h3>
                    <p className="text-slate-300 text-sm">{new Date(selectedDocument.generatedAt).toLocaleString()}</p>
                  </div>
                  {selectedDocument.documentPath && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">File Path</h3>
                      <p className="text-slate-300 text-xs font-mono bg-slate-700/50 p-2 rounded break-all">
                        {selectedDocument.documentPath}
                      </p>
                    </div>
                  )}
                  {selectedDocument.content && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Content Preview</h3>
                      <pre className="text-slate-300 text-xs bg-slate-700/50 p-3 rounded max-h-64 overflow-y-auto whitespace-pre-wrap">
                        {selectedDocument.content}
                      </pre>
                    </div>
                  )}
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
