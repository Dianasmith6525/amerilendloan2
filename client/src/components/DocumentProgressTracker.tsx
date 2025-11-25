import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock, Upload, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const requiredDocuments = [
  {
    type: "drivers_license_front",
    label: "Driver's License (Front)",
    description: "Front side of your valid government ID",
    category: "identity",
  },
  {
    type: "drivers_license_back",
    label: "Driver's License (Back)",
    description: "Back side of your valid government ID",
    category: "identity",
  },
  {
    type: "bank_statement",
    label: "Bank Statement",
    description: "Recent bank statement (last 30 days)",
    category: "financial",
  },
  {
    type: "utility_bill",
    label: "Proof of Address",
    description: "Utility bill or similar document",
    category: "address",
  },
];

export default function DocumentProgressTracker() {
  const { data: documents = [], isLoading } = trpc.verification.myDocuments.useQuery();

  const getDocumentStatus = (type: string) => {
    const doc = documents.find((d) => d.documentType === type);
    if (!doc) return "missing";
    return doc.status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "rejected":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "pending":
      case "under_review":
        return <Clock className="w-5 h-5 text-yellow-600 animate-pulse" />;
      case "missing":
        return <Upload className="w-5 h-5 text-gray-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-50 border-green-200";
      case "rejected":
        return "bg-red-50 border-red-200";
      case "pending":
      case "under_review":
        return "bg-yellow-50 border-yellow-200";
      case "missing":
        return "bg-gray-50 border-gray-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved":
        return "Verified ✓";
      case "rejected":
        return "Rejected";
      case "pending":
        return "Pending Review";
      case "under_review":
        return "Under Review";
      case "missing":
        return "Not Uploaded";
      default:
        return "Unknown";
    }
  };

  const approvedCount = requiredDocuments.filter(
    (doc) => getDocumentStatus(doc.type) === "approved"
  ).length;
  const totalRequired = requiredDocuments.length;
  const progressPercentage = (approvedCount / totalRequired) * 100;

  const groupedDocs = requiredDocuments.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, typeof requiredDocuments>);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl text-[#0033A0] flex items-center gap-2">
          <Upload className="w-6 h-6" />
          Document Verification Progress
        </CardTitle>
        <CardDescription>
          Track your document upload and verification status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              Overall Progress
            </span>
            <span className="text-sm font-bold text-[#0033A0]">
              {approvedCount} of {totalRequired} verified
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          <p className="text-xs text-gray-500">
            {progressPercentage === 100
              ? "🎉 All documents verified! You're all set."
              : `${totalRequired - approvedCount} document${
                  totalRequired - approvedCount !== 1 ? "s" : ""
                } remaining`}
          </p>
        </div>

        {/* Document Categories */}
        {Object.entries(groupedDocs).map(([category, docs]) => (
          <div key={category} className="space-y-3">
            <h4 className="font-semibold text-gray-900 capitalize text-sm border-b pb-1">
              {category} Documents
            </h4>
            {docs.map((doc) => {
              const status = getDocumentStatus(doc.type);
              return (
                <div
                  key={doc.type}
                  className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(
                    status
                  )}`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(status)}
                    <div>
                      <p className="font-medium text-sm text-gray-900">{doc.label}</p>
                      <p className="text-xs text-gray-600">{doc.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-semibold ${
                        status === "approved"
                          ? "text-green-700"
                          : status === "rejected"
                          ? "text-red-700"
                          : status === "missing"
                          ? "text-gray-500"
                          : "text-yellow-700"
                      }`}
                    >
                      {getStatusText(status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Action Button */}
        {progressPercentage < 100 && (
          <div className="pt-4 border-t">
            <Link href="/dashboard">
              <Button className="w-full bg-[#FFA500] hover:bg-[#FF8C00] text-white">
                <Upload className="w-4 h-4 mr-2" />
                Upload Missing Documents
              </Button>
            </Link>
          </div>
        )}

        {/* Help Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            💡 <strong>Tip:</strong> Upload clear, high-quality images or PDFs. Documents are
            typically reviewed within 24-48 hours.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
