import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Download, FileText, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";

export default function TaxDocuments() {
  const currentYear = new Date().getFullYear();
  const { data: documentsData, refetch } = trpc.taxDocuments.getUserDocuments.useQuery({});
  const documents = documentsData?.data || [];

  const generateMutation = trpc.taxDocuments.generate.useMutation({
    onSuccess: () => {
      toast.success("Tax document generated successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate document");
    },
  });

  const handleGenerate = (taxYear: number, documentType: string) => {
    generateMutation.mutate({
      taxYear,
      documentType: documentType as any,
    });
  };

  const getDocumentTypeName = (type: string) => {
    const names: Record<string, string> = {
      "1098": "Form 1098 - Mortgage Interest Statement",
      "1099_c": "Form 1099-C - Cancellation of Debt",
      "interest_statement": "Year-End Interest Statement",
    };
    return names[type] || type;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Tax Documents</h1>
          <p className="text-slate-300">Download your tax forms and year-end statements</p>
        </div>

        {/* Generate New Documents */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Generate Tax Documents</CardTitle>
            <CardDescription className="text-slate-400">
              Create tax forms for previous years
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <Button
                onClick={() => handleGenerate(currentYear - 1, "interest_statement")}
                disabled={generateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 justify-start"
              >
                <FileText className="w-4 h-4 mr-2" />
                {currentYear - 1} Interest Statement
              </Button>
              
              <Button
                onClick={() => handleGenerate(currentYear - 1, "1098")}
                disabled={generateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 justify-start"
              >
                <FileText className="w-4 h-4 mr-2" />
                {currentYear - 1} Form 1098
              </Button>

              <Button
                onClick={() => handleGenerate(currentYear - 2, "interest_statement")}
                disabled={generateMutation.isPending}
                variant="outline"
                className="border-slate-600 justify-start"
              >
                <FileText className="w-4 h-4 mr-2" />
                {currentYear - 2} Interest Statement
              </Button>

              <Button
                onClick={() => handleGenerate(currentYear - 2, "1098")}
                disabled={generateMutation.isPending}
                variant="outline"
                className="border-slate-600 justify-start"
              >
                <FileText className="w-4 h-4 mr-2" />
                {currentYear - 2} Form 1098
              </Button>
            </div>

            <div className="mt-4 p-4 bg-blue-900/30 rounded border border-blue-700">
              <p className="text-sm text-blue-300">
                <strong>Note:</strong> Tax documents are typically available after January 31st of each year.
                If you need documents for older years, please contact support.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Available Documents */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Your Tax Documents</CardTitle>
            <CardDescription className="text-slate-400">
              Download previously generated documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tax documents available yet</p>
                <p className="text-sm mt-2">Generate your first document using the buttons above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="border border-slate-700 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-blue-400" />
                          <h4 className="font-semibold text-white">{getDocumentTypeName(doc.documentType)}</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-400 mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Tax Year: {doc.taxYear}</span>
                          </div>
                          
                          {doc.totalInterestPaid && (
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              <span>Interest: ${(doc.totalInterestPaid / 100).toFixed(2)}</span>
                            </div>
                          )}
                          
                          {doc.totalPrincipalPaid && (
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              <span>Principal: ${(doc.totalPrincipalPaid / 100).toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>Generated: {new Date(doc.generatedAt).toLocaleDateString()}</span>
                          {doc.sentToUser && (
                            <Badge variant="secondary" className="text-xs">Sent via Email</Badge>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          const content = [
                            `Tax Document: ${getDocumentTypeName(doc.documentType)}`,
                            `Tax Year: ${doc.taxYear}`,
                            `Generated: ${new Date(doc.generatedAt).toLocaleDateString()}`,
                            '',
                            doc.totalInterestPaid ? `Total Interest Paid: $${(doc.totalInterestPaid / 100).toFixed(2)}` : '',
                            doc.totalPrincipalPaid ? `Total Principal Paid: $${(doc.totalPrincipalPaid / 100).toFixed(2)}` : '',
                          ].filter(Boolean).join('\n');
                          const blob = new Blob([content], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${doc.documentType}_${doc.taxYear}.txt`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          toast.success('Document downloaded');
                        }}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tax Information */}
        <Card className="bg-slate-800 border-slate-700 mt-6">
          <CardHeader>
            <CardTitle className="text-white">Tax Information</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-3 text-sm">
            <div>
              <h4 className="font-semibold text-white mb-1">Form 1098 - Mortgage Interest Statement</h4>
              <p>Reports the amount of mortgage interest you paid during the year. You may be able to deduct this on Schedule A if you itemize deductions.</p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-1">Form 1099-C - Cancellation of Debt</h4>
              <p>Reports any debt that was cancelled, forgiven, or discharged. This amount may be taxable income.</p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-1">Year-End Interest Statement</h4>
              <p>A summary of all interest paid during the tax year on your loan account.</p>
            </div>

            <div className="mt-4 p-3 bg-yellow-900/30 rounded border border-yellow-700">
              <p className="text-yellow-300 text-xs">
                <strong>Disclaimer:</strong> This information is for general guidance only. Please consult with a tax professional 
                regarding your specific situation and the deductibility of your loan interest.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
