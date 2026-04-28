import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileSignature, CheckCircle2, Clock, XCircle, Download, Send } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function ESignatures() {
  const utils = trpc.useUtils();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [documentType, setDocumentType] = useState("loan_agreement");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerName, setSignerName] = useState("");

  // Get user's loans
  const { data: loans, isLoading: loansLoading } = trpc.loans.myApplications.useQuery();

  // Get e-signature documents
  const { data: documents, isLoading: documentsLoading } = trpc.eSignature.getUserDocuments.useQuery();

  // Request signature mutation
  const requestMutation = trpc.eSignature.requestSignature.useMutation({
    onSuccess: () => {
      utils.eSignature.getUserDocuments.invalidate();
      setRequestDialogOpen(false);
      setSelectedLoanId("");
      setDocumentTitle("");
      setDocumentDescription("");
      setDocumentType("loan_agreement");
      setSignerEmail("");
      setSignerName("");
      toast.success("Signature request has been sent.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send signature request.");
    },
  });

  // Sign document mutation
  const signMutation = trpc.eSignature.sign.useMutation({
    onSuccess: () => {
      utils.eSignature.getUserDocuments.invalidate();
      toast.success("Document signed successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to sign document.");
    },
  });

  const handleRequestSignature = (e: React.FormEvent) => {
    e.preventDefault();
    requestMutation.mutate({
      loanApplicationId: selectedLoanId ? parseInt(selectedLoanId) : undefined,
      documentTitle,
      documentDescription,
      documentType,
      signerEmail,
      signerName,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "sent":
        return (
          <Badge variant="outline" className="bg-blue-50">
            <Send className="h-3 w-3 mr-1" />
            Sent
          </Badge>
        );
      case "signed":
        return (
          <Badge variant="outline" className="bg-green-50">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Signed
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        );
      case "expired":
        return <Badge variant="outline">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loansLoading || documentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const activeLoans = (loans as any)?.filter((loan: any) => 
    loan.status === "approved" || loan.status === "pending"
  ) || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <FileSignature className="h-8 w-8" />
          E-Signatures
        </h1>
        <p className="text-muted-foreground">
          Sign documents electronically with DocuSign integration.
        </p>
      </div>

      {/* Info Card */}
      <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          What is E-Signature?
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          E-signatures allow you to sign documents digitally, making the process faster and more convenient. 
          Our integration with DocuSign ensures:
        </p>
        <ul className="text-sm space-y-1 ml-6 list-disc">
          <li>Legally binding signatures compliant with ESIGN Act</li>
          <li>Secure document transmission and storage</li>
          <li>Complete audit trail of all signing activities</li>
          <li>Multi-party signing support</li>
        </ul>
      </Card>

      {/* Request Signature */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Request Signature</h2>
            <p className="text-sm text-muted-foreground">
              Send a document for electronic signature
            </p>
          </div>
          <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <FileSignature className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Request E-Signature</DialogTitle>
                <DialogDescription>
                  Send a document to be signed electronically.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleRequestSignature}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="docType">Document Type</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger id="docType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="loan_agreement">Loan Agreement</SelectItem>
                        <SelectItem value="promissory_note">Promissory Note</SelectItem>
                        <SelectItem value="disclosure">Disclosure Document</SelectItem>
                        <SelectItem value="authorization">Authorization Form</SelectItem>
                        <SelectItem value="amendment">Amendment</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {activeLoans.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="loan">Related Loan (Optional)</Label>
                      <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
                        <SelectTrigger id="loan">
                          <SelectValue placeholder="No loan selected" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No loan</SelectItem>
                          {activeLoans.map((loan: any) => (
                            <SelectItem key={loan.id} value={loan.id.toString()}>
                              {loan.loanType} - ${(loan.requestedAmount / 100).toLocaleString()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="title">Document Title</Label>
                    <Input
                      id="title"
                      value={documentTitle}
                      onChange={(e) => setDocumentTitle(e.target.value)}
                      placeholder="Loan Agreement for Personal Loan"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={documentDescription}
                      onChange={(e) => setDocumentDescription(e.target.value)}
                      placeholder="Describe what this document is for..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signerName">Signer Name</Label>
                      <Input
                        id="signerName"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="John Doe"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signerEmail">Signer Email</Label>
                      <Input
                        id="signerEmail"
                        type="email"
                        value={signerEmail}
                        onChange={(e) => setSignerEmail(e.target.value)}
                        placeholder="signer@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg text-sm">
                    <p className="font-medium mb-2">What happens next?</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>We'll prepare the document for signature</li>
                      <li>The signer will receive an email with a secure link</li>
                      <li>They can review and sign the document online</li>
                      <li>You'll be notified when the document is signed</li>
                    </ol>
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRequestDialogOpen(false)}
                    disabled={requestMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={requestMutation.isPending}>
                    {requestMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Request
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      {/* Documents List */}
      <Card>
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Your Documents</h2>
        </div>
        <div className="p-4">
              {documents && (documents as any).length > 0 ? (
            <div className="space-y-4">
              {(documents as any).map((doc: any) => (
                <Card key={doc.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{doc.documentTitle}</h3>
                        {getStatusBadge(doc.status)}
                      </div>
                      {doc.documentDescription && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {doc.documentDescription}
                        </p>
                      )}
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          <Badge variant="outline" className="mr-2">
                            {doc.documentType}
                          </Badge>
                          {doc.loanApplicationId && `Loan #${doc.loanApplicationId}`}
                        </p>
                        <p>
                          Signer: {doc.signerName} ({doc.signerEmail})
                        </p>
                        <p className="text-xs">
                          Sent: {format(new Date(doc.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        {doc.signedAt && (
                          <p className="text-xs text-green-600">
                            Signed: {format(new Date(doc.signedAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        )}
                        {doc.expiresAt && doc.status === "sent" && (
                          <p className="text-xs">
                            Expires: {format(new Date(doc.expiresAt), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {(doc.status === "pending" || doc.status === "sent") && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={signMutation.isPending}
                          onClick={() => {
                            if (confirm(`Sign "${doc.documentTitle}"? This is a legally binding action.`)) {
                              signMutation.mutate({ documentId: doc.id });
                            }
                          }}
                        >
                          <FileSignature className="h-4 w-4 mr-2" />
                          {signMutation.isPending ? "Signing..." : "Sign"}
                        </Button>
                      )}
                      {doc.status === "signed" && doc.signedDocumentUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(doc.signedDocumentUrl, "_blank")}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                      {doc.status === "sent" && doc.envelopeId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://app.docusign.com/documents/details/${doc.envelopeId}`, "_blank")}
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </div>

                  {doc.declinedReason && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm font-medium text-red-900">Declined Reason:</p>
                      <p className="text-sm text-red-700">{doc.declinedReason}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileSignature className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No e-signature documents yet</p>
              <p className="text-sm mt-2">Click "New Request" above to get started</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
