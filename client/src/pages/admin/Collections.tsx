import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/utils";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, AlertTriangle, Phone, Mail, MessageSquare, FileText, DollarSign } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function Collections() {
  const utils = trpc.useUtils();
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState("email");
  const [actionNotes, setActionNotes] = useState("");
  const [actionOutcome, setActionOutcome] = useState("");
  const [promiseAmount, setPromiseAmount] = useState("");
  const [promiseDate, setPromiseDate] = useState("");

  // Get active delinquencies
  const { data: delinquenciesData, isLoading } = trpc.collections.getActiveDelinquencies.useQuery();
  const delinquencies = (delinquenciesData as any)?.data;

  // Get collection actions for selected record
  const { data: actionsData } = trpc.collections.getCollectionActions.useQuery(
    { delinquencyRecordId: selectedRecord?.id ?? 0 },
    { enabled: !!selectedRecord }
  );
  const actions = (actionsData as any)?.data;

  // Record collection action mutation
  const actionMutation = trpc.collections.recordCollectionAction.useMutation({
    onSuccess: () => {
      utils.collections.getActiveDelinquencies.invalidate();
      utils.collections.getCollectionActions.invalidate();
      setActionDialogOpen(false);
      setActionType("email");
      setActionNotes("");
      setActionOutcome("");
      toast.success("Collection action has been logged successfully.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record collection action.");
    },
  });

  // Update promise to pay mutation
  const promiseMutation = trpc.collections.updatePromiseToPay.useMutation({
    onSuccess: () => {
      utils.collections.getActiveDelinquencies.invalidate();
      setPromiseAmount("");
      setPromiseDate("");
      toast.success("Promise to pay has been recorded.");
    },
  });

  const handleRecordAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    actionMutation.mutate({
      delinquencyRecordId: selectedRecord.id,
      actionType,
      outcome: actionOutcome,
      notes: actionNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      current: { color: "bg-green-50", label: "Current" },
      days_15: { color: "bg-yellow-50", label: "15 Days" },
      days_30: { color: "bg-orange-50", label: "30 Days" },
      days_60: { color: "bg-red-50", label: "60 Days" },
      days_90: { color: "bg-red-100", label: "90+ Days" },
      charged_off: { color: "bg-gray-100", label: "Charged Off" },
      in_settlement: { color: "bg-blue-50", label: "Settlement" },
    };

    const config = statusConfig[status] || { color: "bg-gray-50", label: status };
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
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
          <AlertTriangle className="h-8 w-8" />
          Collections Management
        </h1>
        <p className="text-muted-foreground">
          Manage delinquent accounts and collection activities.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Delinquent</p>
              <p className="text-2xl font-bold">{delinquencies?.length || 0}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">90+ Days</p>
              <p className="text-2xl font-bold">
                {delinquencies?.filter((d: any) => d.status === "days_90").length || 0}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">In Settlement</p>
              <p className="text-2xl font-bold">
                {delinquencies?.filter((d: any) => d.status === "in_settlement").length || 0}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Charged Off</p>
              <p className="text-2xl font-bold">
                {delinquencies?.filter((d: any) => d.status === "charged_off").length || 0}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-gray-500" />
          </div>
        </Card>
      </div>

      {/* Delinquencies Table */}
      <Card className="mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead>Loan ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Days Delinquent</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead>Last Contact</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {delinquencies && delinquencies.length > 0 ? (
              delinquencies.map((record: any) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">#{record.userId}</TableCell>
                  <TableCell>#{record.loanApplicationId}</TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                  <TableCell>{record.daysDelinquent} days</TableCell>
                  <TableCell>{formatCurrency(record.totalAmountDue)}</TableCell>
                  <TableCell className="text-sm">
                    {record.lastContactDate
                      ? format(new Date(record.lastContactDate), "MMM d, yyyy")
                      : "Never"}
                  </TableCell>
                  <TableCell>{record.collectionAttempts || 0}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedRecord(record)}
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No delinquent accounts
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Details Dialog */}
      {selectedRecord && (
        <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Collection Record Details</DialogTitle>
              <DialogDescription>
                Manage collection activities for User #{selectedRecord.userId}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Account Summary */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Account Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium">{getStatusBadge(selectedRecord.status)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Days Delinquent</p>
                    <p className="font-medium">{selectedRecord.daysDelinquent} days</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Amount Due</p>
                    <p className="font-medium text-lg">
                      {formatCurrency(selectedRecord.totalAmountDue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Payment</p>
                    <p className="font-medium">
                      {selectedRecord.lastPaymentDate
                        ? format(new Date(selectedRecord.lastPaymentDate), "MMM d, yyyy")
                        : "No payments"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Collection Attempts</p>
                    <p className="font-medium">{selectedRecord.collectionAttempts || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assigned Collector</p>
                    <p className="font-medium">
                      {selectedRecord.assignedCollectorId
                        ? `Agent #${selectedRecord.assignedCollectorId}`
                        : "Unassigned"}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Promise to Pay */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Promise to Pay</h3>
                {selectedRecord.promiseToPayDate ? (
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm">
                      <strong>Promised Amount:</strong> {formatCurrency(selectedRecord.promiseToPayAmount)}
                    </p>
                    <p className="text-sm">
                      <strong>Promised Date:</strong>{" "}
                      {format(new Date(selectedRecord.promiseToPayDate), "MMM d, yyyy")}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-3">No promise to pay recorded</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="promiseAmount">Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                      <Input
                        id="promiseAmount"
                        type="number"
                        step="0.01"
                        value={promiseAmount}
                        onChange={(e) => setPromiseAmount(e.target.value)}
                        className="pl-7"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="promiseDate">Date</Label>
                    <Input
                      id="promiseDate"
                      type="date"
                      value={promiseDate}
                      onChange={(e) => setPromiseDate(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={() => selectedRecord && promiseMutation.mutate({
                    delinquencyRecordId: selectedRecord.id,
                    promiseDate: new Date(promiseDate),
                    promiseAmount: Math.round(parseFloat(promiseAmount) * 100),
                  })}
                  disabled={!promiseAmount || !promiseDate || promiseMutation.isPending}
                >
                  Record Promise
                </Button>
              </Card>

              {/* Record Collection Action */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Collection Actions</h3>
                  <Button
                    size="sm"
                    onClick={() => setActionDialogOpen(true)}
                  >
                    Record Action
                  </Button>
                </div>

                {actions && actions.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {actions.map((action: any) => (
                      <Card key={action.id} className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {action.actionType === "phone_call" && <Phone className="h-3 w-3" />}
                              {action.actionType === "email" && <Mail className="h-3 w-3" />}
                              {action.actionType === "sms" && <MessageSquare className="h-3 w-3" />}
                              {action.actionType === "letter" && <FileText className="h-3 w-3" />}
                              <Badge variant="outline" className="text-xs">
                                {action.actionType}
                              </Badge>
                              {action.outcome && (
                                <Badge variant="outline" className="text-xs bg-blue-50">
                                  {action.outcome}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(action.actionDate), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                            {action.notes && (
                              <p className="text-xs mt-1">{action.notes}</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No collection actions recorded yet
                  </p>
                )}
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Record Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Collection Action</DialogTitle>
            <DialogDescription>
              Log a collection activity for this account
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordAction}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="actionType">Action Type</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger id="actionType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="phone_call">Phone Call</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="legal">Legal Action</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="outcome">Outcome</Label>
                <Select value={actionOutcome} onValueChange={setActionOutcome}>
                  <SelectTrigger id="outcome">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                    <SelectItem value="promised_payment">Promised Payment</SelectItem>
                    <SelectItem value="disputed">Disputed</SelectItem>
                    <SelectItem value="refused_to_pay">Refused to Pay</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Add details about this action..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActionDialogOpen(false)}
                disabled={actionMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={actionMutation.isPending}>
                {actionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  "Record Action"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
