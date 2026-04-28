import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, UserPlus, Mail, CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function CoSigners() {
  const utils = trpc.useUtils();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [coSignerEmail, setCoSignerEmail] = useState("");
  const [coSignerName, setCoSignerName] = useState("");
  const [liabilitySplit, setLiabilitySplit] = useState("50");

  // Get user's loans
  const { data: loans, isLoading: loansLoading } = trpc.loans.myApplications.useQuery();

  // Get pending co-signer invitations
  const { data: invitationsData, isLoading: invitationsLoading } = trpc.coSigners.getInvitations.useQuery();
  const invitations = (invitationsData as any)?.data as any[] | undefined;

  // Send invitation mutation
  const inviteMutation = trpc.coSigners.sendInvitation.useMutation({
    onSuccess: () => {
      utils.coSigners.getInvitations.invalidate();
      setInviteDialogOpen(false);
      setSelectedLoanId("");
      setCoSignerEmail("");
      setCoSignerName("");
      setLiabilitySplit("50");
      toast.success("Invitation Sent", {
        description: "The co-signer invitation has been sent via email.",
      });
    },
    onError: (error: any) => {
      toast.error("Failed to Send", {
        description: error.message || "Failed to send invitation.",
      });
    },
  });

  // Cancel invitation mutation
  const cancelMutation = trpc.coSigners.cancelInvitation.useMutation({
    onSuccess: () => {
      utils.coSigners.getInvitations.invalidate();
      toast.success("Invitation Cancelled", {
        description: "The co-signer invitation has been cancelled.",
      });
    },
  });

  const handleSendInvitation = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate({
      loanApplicationId: parseInt(selectedLoanId),
      coSignerEmail,
      coSignerName,
      liabilityPercentage: parseInt(liabilitySplit),
    } as any);
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
      case "accepted":
        return (
          <Badge variant="outline" className="bg-green-50">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loansLoading || invitationsLoading) {
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
          <Users className="h-8 w-8" />
          Co-Signers
        </h1>
        <p className="text-muted-foreground">
          Add a co-signer to your loan application to increase approval chances or get better rates.
        </p>
      </div>

      {/* Info Card */}
      <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          What is a Co-Signer?
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          A co-signer is someone who agrees to be responsible for your loan if you can't make payments. 
          Having a co-signer can help you:
        </p>
        <ul className="text-sm space-y-1 ml-6 list-disc">
          <li>Qualify for a loan you might not get approved for on your own</li>
          <li>Get a lower interest rate</li>
          <li>Borrow a larger amount</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-3">
          <strong>Important:</strong> Your co-signer will be equally responsible for repaying the loan.
        </p>
      </Card>

      {/* Invite Co-Signer */}
      {activeLoans.length > 0 && (
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Invite a Co-Signer</h2>
              <p className="text-sm text-muted-foreground">
                Send an invitation to someone to co-sign your loan
              </p>
            </div>
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Send Invitation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Co-Signer</DialogTitle>
                  <DialogDescription>
                    Send an invitation to someone to co-sign your loan application.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSendInvitation}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="loan">Select Loan Application</Label>
                      <Select value={selectedLoanId} onValueChange={setSelectedLoanId} required>
                        <SelectTrigger id="loan">
                          <SelectValue placeholder="Choose a loan" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeLoans.map((loan: any) => (
                            <SelectItem key={loan.id} value={loan.id.toString()}>
                              {loan.loanType} - ${(loan.requestedAmount / 100).toLocaleString()} ({loan.status})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">Co-Signer Name</Label>
                      <Input
                        id="name"
                        value={coSignerName}
                        onChange={(e) => setCoSignerName(e.target.value)}
                        placeholder="John Doe"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Co-Signer Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={coSignerEmail}
                        onChange={(e) => setCoSignerEmail(e.target.value)}
                        placeholder="cosigner@example.com"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="split">Liability Split (%)</Label>
                      <Select value={liabilitySplit} onValueChange={setLiabilitySplit}>
                        <SelectTrigger id="split">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50% / 50% (Equal)</SelectItem>
                          <SelectItem value="60">60% You / 40% Co-Signer</SelectItem>
                          <SelectItem value="70">70% You / 30% Co-Signer</SelectItem>
                          <SelectItem value="80">80% You / 20% Co-Signer</SelectItem>
                          <SelectItem value="100">100% Co-Signer</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Percentage of loan responsibility the co-signer will share
                      </p>
                    </div>
                  </div>

                  <DialogFooter className="mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setInviteDialogOpen(false)}
                      disabled={inviteMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Invitation
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </Card>
      )}

      {/* Existing Invitations */}
      <Card>
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Co-Signer Invitations</h2>
        </div>
        <div className="p-4">
          {invitations && invitations.length > 0 ? (
            <div className="space-y-4">
              {invitations.map((invitation: any) => (
                <Card key={invitation.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{invitation.coSignerName}</h3>
                        {getStatusBadge(invitation.status)}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          <Mail className="inline h-3 w-3 mr-1" />
                          {invitation.coSignerEmail}
                        </p>
                        <p>Loan Application ID: #{invitation.loanApplicationId}</p>
                        <p>Liability Share: {invitation.liabilityPercentage}%</p>
                        <p className="text-xs">
                          Sent: {format(new Date(invitation.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        {invitation.respondedAt && (
                          <p className="text-xs">
                            Responded: {format(new Date(invitation.respondedAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        )}
                      </div>
                    </div>

                    {invitation.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelMutation.mutate({ invitationId: invitation.id })}
                        disabled={cancelMutation.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No co-signer invitations yet</p>
              {activeLoans.length > 0 && (
                <p className="text-sm mt-2">Click "Send Invitation" above to get started</p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* No Active Loans Message */}
      {activeLoans.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-4">
            You don't have any active loan applications. Apply for a loan first to add a co-signer.
          </p>
          <Button onClick={() => window.location.href = "/apply"}>
            Apply for a Loan
          </Button>
        </Card>
      )}
    </div>
  );
}
