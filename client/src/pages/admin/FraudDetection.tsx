import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Shield, AlertTriangle, CheckCircle2, XCircle, MapPin, Smartphone, Globe } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function FraudDetection() {
  const utils = trpc.useUtils();
  const [selectedCheck, setSelectedCheck] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  // Get pending fraud reviews
  const { data: fraudChecksData, isLoading } = trpc.fraudDetection.getPendingReviews.useQuery();
  const fraudChecks = (fraudChecksData as any)?.data as any[] | undefined;

  // Review fraud check mutation
  const reviewMutation = trpc.fraudDetection.reviewFraudCheck.useMutation({
    onSuccess: () => {
      utils.fraudDetection.getPendingReviews.invalidate();
      setSelectedCheck(null);
      setReviewNotes("");
      toast.success("Review Submitted", {
        description: "The fraud check review has been recorded.",
      });
    },
    onError: (error: any) => {
      toast.error("Review Failed", {
        description: error.message || "Failed to submit review.",
      });
    },
  });

  const handleApprove = () => {
    if (selectedCheck) {
      reviewMutation.mutate({
        fraudCheckId: selectedCheck.id,
        approved: true,
        reviewNotes: reviewNotes,
      } as any);
    }
  };

  const handleReject = () => {
    if (selectedCheck) {
      reviewMutation.mutate({
        fraudCheckId: selectedCheck.id,
        approved: false,
        reviewNotes: reviewNotes,
      } as any);
    }
  };

  const getRiskBadge = (riskScore: number) => {
    if (riskScore >= 80) {
      return <Badge variant="destructive">High Risk ({riskScore})</Badge>;
    } else if (riskScore >= 50) {
      return <Badge variant="outline" className="bg-yellow-50">Medium Risk ({riskScore})</Badge>;
    } else {
      return <Badge variant="outline" className="bg-green-50">Low Risk ({riskScore})</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-50">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Fraud Detection
        </h1>
        <p className="text-muted-foreground">
          Review suspicious activity and high-risk transactions.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Reviews</p>
              <p className="text-2xl font-bold">
                {fraudChecks?.filter((c: any) => c.reviewStatus === "pending").length || 0}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">High Risk</p>
              <p className="text-2xl font-bold">
                {fraudChecks?.filter((c: any) => c.riskScore >= 80).length || 0}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Medium Risk</p>
              <p className="text-2xl font-bold">
                {fraudChecks?.filter((c: any) => c.riskScore >= 50 && c.riskScore < 80).length || 0}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Low Risk</p>
              <p className="text-2xl font-bold">
                {fraudChecks?.filter((c: any) => c.riskScore < 50).length || 0}
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Fraud Checks Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead>Check Type</TableHead>
              <TableHead>Risk Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fraudChecks && fraudChecks.length > 0 ? (
              fraudChecks.map((check: any) => (
                <TableRow key={check.id}>
                  <TableCell className="font-medium">#{check.userId}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{check.checkType}</Badge>
                  </TableCell>
                  <TableCell>{getRiskBadge(check.riskScore)}</TableCell>
                  <TableCell>{getStatusBadge(check.reviewStatus)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3" />
                      {check.ipLocation || "Unknown"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(check.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedCheck(check);
                        setReviewNotes("");
                      }}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No fraud checks to review
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Review Dialog */}
      {selectedCheck && (
        <Dialog open={!!selectedCheck} onOpenChange={() => setSelectedCheck(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Fraud Check Review</DialogTitle>
              <DialogDescription>
                Review the details and approve or reject this transaction.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Risk Score */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Risk Assessment</p>
                  <p className="text-2xl font-bold">{selectedCheck.riskScore}/100</p>
                </div>
                {getRiskBadge(selectedCheck.riskScore)}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Device Info</p>
                  </div>
                  <p className="text-xs text-muted-foreground break-all">
                    {selectedCheck.deviceFingerprint || "Unknown"}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">IP Address</p>
                  </div>
                  <p className="text-sm">{selectedCheck.ipAddress}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCheck.ipLocation || "Location unknown"}
                  </p>
                </Card>

                <Card className="p-4">
                  <p className="text-sm font-medium mb-1">User Agent</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {selectedCheck.userAgent || "Unknown"}
                  </p>
                </Card>

                <Card className="p-4">
                  <p className="text-sm font-medium mb-1">Check Type</p>
                  <Badge>{selectedCheck.checkType}</Badge>
                </Card>
              </div>

              {/* Fraud Signals */}
              {selectedCheck.fraudSignals && selectedCheck.fraudSignals.length > 0 && (
                <Card className="p-4 bg-yellow-50 border-yellow-200">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Fraud Signals Detected
                  </p>
                  <ul className="text-sm space-y-1 ml-6 list-disc">
                    {selectedCheck.fraudSignals.map((signal: string, idx: number) => (
                      <li key={idx}>{signal}</li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Velocity Data */}
              {selectedCheck.velocityData && (
                <Card className="p-4">
                  <p className="text-sm font-medium mb-2">Velocity Check</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(selectedCheck.velocityData, null, 2)}
                  </pre>
                </Card>
              )}

              {/* Review Notes */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Review Notes (Optional)
                </label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about this review..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedCheck(null)}
                disabled={reviewMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={reviewMutation.isPending}
              >
                {reviewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Reject
              </Button>
              <Button onClick={handleApprove} disabled={reviewMutation.isPending}>
                {reviewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
