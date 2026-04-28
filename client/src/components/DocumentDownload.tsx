import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Receipt, FileCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface DocumentDownloadProps {
  loanId: number;
  trackingNumber: string;
  status: string;
  approvedAmount?: number;
  processingFeeAmount?: number;
}

export default function DocumentDownload({ loanId, trackingNumber, status, approvedAmount, processingFeeAmount }: DocumentDownloadProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const generateDoc = trpc.documents.generate.useMutation();

  const handleDownload = async (docType: string) => {
    setDownloading(docType);
    
    try {
      const result = await generateDoc.mutateAsync({
        loanId,
        documentType: docType as any,
      });

      const docData = (result as any)?.data || result;
      
      if (docData?.content && docData?.filename) {
        // Create a text file blob and trigger download
        const blob = new Blob([docData.content], { type: docData.mimeType || 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = docData.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast.success(`${docType.replace(/_/g, ' ')} downloaded successfully!`);
      } else {
        toast.error("Document generation returned empty content");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to download document. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  const documents = [
    {
      id: "loan_agreement",
      name: "Loan Agreement",
      description: "Your signed loan agreement and terms",
      icon: FileText,
      available: ["approved", "fee_pending", "fee_paid", "disbursed"].includes(status),
    },
    {
      id: "payment_receipt",
      name: "Payment Receipt",
      description: "Receipt for processing fee payment",
      icon: Receipt,
      available: ["fee_paid", "disbursed"].includes(status),
    },
    {
      id: "disbursement_statement",
      name: "Disbursement Statement",
      description: "Loan disbursement details and breakdown",
      icon: FileCheck,
      available: status === "disbursed",
    },
    {
      id: "repayment_schedule",
      name: "Repayment Schedule",
      description: "Monthly payment schedule and dates",
      icon: FileText,
      available: status === "disbursed",
    },
  ];

  const availableDocs = documents.filter((doc) => doc.available);

  if (availableDocs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-[#0033A0] flex items-center gap-2">
            <Download className="w-5 h-5" />
            Download Documents
          </CardTitle>
          <CardDescription>Access your loan documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No documents available yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Documents will be available once your loan is approved
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl text-[#0033A0] flex items-center gap-2">
          <Download className="w-5 h-5" />
          Download Documents
        </CardTitle>
        <CardDescription>
          Download and save your loan documents for your records
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {availableDocs.map((doc) => {
          const Icon = doc.icon;
          const isDownloading = downloading === doc.id;

          return (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{doc.name}</p>
                  <p className="text-sm text-gray-600">{doc.description}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(doc.id)}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
            </div>
          );
        })}

        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
          <p className="text-xs text-green-800">
            💾 <strong>Tip:</strong> Keep these documents in a safe place. You may need them for
            tax purposes or future reference.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
