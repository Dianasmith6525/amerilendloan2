import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  ArrowLeft,
  Plus,
  DollarSign,
  Ban,
  RefreshCw,
  User,
  Search,
  Shield,
  Package,
  Truck,
  MapPin,
  CheckCircle2,
  Clock,
  ChevronRight,
  ExternalLink,
  Snowflake,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { CARD_FREEZE_REASONS } from "@shared/const";
import { Textarea } from "@/components/ui/textarea";

type AdminTab = "virtual_cards" | "physical_requests";

function AdminVirtualCards() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>("virtual_cards");
  const [issueDialog, setIssueDialog] = useState(false);
  const [addBalanceDialog, setAddBalanceDialog] = useState<{ open: boolean; cardId: number | null }>({ open: false, cardId: null });
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; cardId: number | null }>({ open: false, cardId: null });
  const [freezeDialog, setFreezeDialog] = useState<{ open: boolean; cardId: number | null; currentStatus: string }>({ open: false, cardId: null, currentStatus: "" });
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Issue form state
  const [issueForm, setIssueForm] = useState({
    userId: "",
    cardholderName: "",
    initialBalance: "",
    cardLabel: "",
    cardColor: "blue",
  });
  const [addBalanceAmount, setAddBalanceAmount] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [freezeReason, setFreezeReason] = useState("");
  const [freezeCustomReason, setFreezeCustomReason] = useState("");
  
  // Physical card request state
  const [physicalFilterStatus, setPhysicalFilterStatus] = useState<string>("all");
  const [updateShipDialog, setUpdateShipDialog] = useState<{ open: boolean; requestId: number | null; currentStatus: string }>({
    open: false, requestId: null, currentStatus: "",
  });
  const [shipForm, setShipForm] = useState({
    status: "" as string,
    trackingNumber: "",
    carrier: "",
    trackingUrl: "",
    estimatedDeliveryDate: "",
    physicalCardLast4: "",
    adminNotes: "",
    cancellationReason: "",
  });

  const { data: user } = trpc.auth.me.useQuery();
  const { data: cards, isLoading, refetch } = trpc.virtualCards.adminListCards.useQuery(
    { status: filterStatus !== "all" ? filterStatus : undefined },
    { enabled: !!user && user.role === "admin" }
  );

  const issueCardMutation = trpc.virtualCards.issueCard.useMutation({
    onSuccess: (data) => {
      toast.success(`Card issued! Last 4: ${data.card.cardNumberLast4}`);
      setIssueDialog(false);
      setIssueForm({ userId: "", cardholderName: "", initialBalance: "", cardLabel: "", cardColor: "blue" });
      refetch();
    },
    onError: (err) => toast.error(err.message || "Failed to issue card"),
  });

  const addBalanceMutation = trpc.virtualCards.addBalance.useMutation({
    onSuccess: (data) => {
      toast.success(`Balance added! New balance: ${formatCurrency(data.newBalance)}`);
      setAddBalanceDialog({ open: false, cardId: null });
      setAddBalanceAmount("");
      refetch();
    },
    onError: (err) => toast.error(err.message || "Failed to add balance"),
  });

  const cancelCardMutation = trpc.virtualCards.cancelCard.useMutation({
    onSuccess: () => {
      toast.success("Card cancelled successfully");
      setCancelDialog({ open: false, cardId: null });
      setCancelReason("");
      refetch();
    },
    onError: (err) => toast.error(err.message || "Failed to cancel card"),
  });

  const freezeCardMutation = trpc.virtualCards.adminFreezeCard.useMutation({
    onSuccess: (data) => {
      toast.success(`Card ${data.status === "frozen" ? "frozen" : "unfrozen"} successfully`);
      setFreezeDialog({ open: false, cardId: null, currentStatus: "" });
      setFreezeReason("");
      setFreezeCustomReason("");
      refetch();
    },
    onError: (err) => toast.error(err.message || "Failed to update card"),
  });

  // Physical card requests
  const { data: physicalRequests, isLoading: physLoading, refetch: refetchPhysical } = trpc.virtualCards.adminListPhysicalRequests.useQuery(
    { status: physicalFilterStatus !== "all" ? physicalFilterStatus : undefined },
    { enabled: !!user && user.role === "admin" }
  );

  const updatePhysicalStatusMutation = trpc.virtualCards.updatePhysicalCardStatus.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Status updated to: ${data.status}`);
      setUpdateShipDialog({ open: false, requestId: null, currentStatus: "" });
      setShipForm({ status: "", trackingNumber: "", carrier: "", trackingUrl: "", estimatedDeliveryDate: "", physicalCardLast4: "", adminNotes: "", cancellationReason: "" });
      refetchPhysical();
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });
  const handleIssueCard = () => {
    if (!issueForm.userId || !issueForm.cardholderName) {
      toast.error("User ID and cardholder name are required");
      return;
    }
    issueCardMutation.mutate({
      userId: parseInt(issueForm.userId),
      cardholderName: issueForm.cardholderName,
      initialBalance: issueForm.initialBalance ? Math.round(parseFloat(issueForm.initialBalance) * 100) : 0,
      cardLabel: issueForm.cardLabel || undefined,
      cardColor: issueForm.cardColor || undefined,
    });
  };

  const handleAddBalance = () => {
    if (!addBalanceDialog.cardId || !addBalanceAmount) return;
    addBalanceMutation.mutate({
      cardId: addBalanceDialog.cardId,
      amount: Math.round(parseFloat(addBalanceAmount) * 100),
    });
  };

  const handleCancelCard = () => {
    if (!cancelDialog.cardId) return;
    cancelCardMutation.mutate({
      cardId: cancelDialog.cardId,
      reason: cancelReason || undefined,
    });
  };

  const handleFreezeCard = () => {
    if (!freezeDialog.cardId) return;
    const isFreezing = freezeDialog.currentStatus !== "frozen";
    const reason = freezeReason === "Other (specify below)" ? freezeCustomReason : freezeReason;
    if (!reason) {
      toast.error("Please select or enter a reason");
      return;
    }
    freezeCardMutation.mutate({
      cardId: freezeDialog.cardId,
      freeze: isFreezing,
      reason,
    });
  };

  const handleUpdatePhysicalStatus = () => {
    if (!updateShipDialog.requestId || !shipForm.status) return;
    updatePhysicalStatusMutation.mutate({
      requestId: updateShipDialog.requestId,
      status: shipForm.status as any,
      trackingNumber: shipForm.trackingNumber || undefined,
      carrier: shipForm.carrier || undefined,
      trackingUrl: shipForm.trackingUrl || undefined,
      estimatedDeliveryDate: shipForm.estimatedDeliveryDate || undefined,
      physicalCardLast4: shipForm.physicalCardLast4 || undefined,
      adminNotes: shipForm.adminNotes || undefined,
      cancellationReason: shipForm.cancellationReason || undefined,
    });
  };

  const getNextStatuses = (currentStatus: string): string[] => {
    const flow: Record<string, string[]> = {
      pending: ["approved", "cancelled"],
      approved: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["out_for_delivery", "delivered", "cancelled"],
      out_for_delivery: ["delivered", "cancelled"],
    };
    return flow[currentStatus] || [];
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Admin access required</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-300",
    frozen: "bg-blue-100 text-blue-800 border-blue-300",
    expired: "bg-gray-100 text-gray-800 border-gray-300",
    cancelled: "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Admin
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">Virtual Cards Management</h1>
              </div>
            </div>
            <Button onClick={() => setIssueDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Issue New Card
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-8">
          <button
            onClick={() => setActiveTab("virtual_cards")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "virtual_cards"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <CreditCard className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Virtual Cards
          </button>
          <button
            onClick={() => setActiveTab("physical_requests")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "physical_requests"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Package className="w-4 h-4 inline -mt-0.5" /> Physical Card Requests
            {physicalRequests && physicalRequests.filter((r: any) => r.status === "pending").length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {physicalRequests.filter((r: any) => r.status === "pending").length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "virtual_cards" && (
        <>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-gray-500 mb-1">Total Cards</p>
              <p className="text-2xl font-bold">{cards?.length || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-gray-500 mb-1">Active</p>
              <p className="text-2xl font-bold text-green-600">
                {cards?.filter((c: any) => c.status === "active").length || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-gray-500 mb-1">Frozen</p>
              <p className="text-2xl font-bold text-blue-600">
                {cards?.filter((c: any) => c.status === "frozen").length || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-gray-500 mb-1">Total Balance</p>
              <p className="text-2xl font-bold">
                {formatCurrency(cards?.reduce((sum: number, c: any) => sum + (c.currentBalance || 0), 0) || 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-6">
          <Label className="text-sm text-gray-500">Filter:</Label>
          {["all", "active", "frozen", "cancelled"].map(status => (
            <Button
              key={status}
              variant={filterStatus === status ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* Cards Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-gray-400">Loading cards...</div>
            ) : !cards || cards.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No virtual cards issued yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Card</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">User ID</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Cardholder</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Balance</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Issued</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cards.map((card: any) => (
                      <tr key={card.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-gray-400" />
                            <span className="font-mono">•••• {card.cardNumberLast4}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{card.cardLabel || "Debit Card"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-700">#{card.userId}</span>
                        </td>
                        <td className="px-4 py-3 font-medium">{card.cardholderName}</td>
                        <td className="px-4 py-3 font-mono font-medium">
                          {formatCurrency(card.currentBalance || 0)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={statusColors[card.status] || ""}>
                            {card.status}
                          </Badge>
                          {card.status === "frozen" && card.frozenReason && (
                            <p className="text-xs text-red-500 mt-1" title={card.frozenReason}>
                              {card.frozenReason.length > 30 ? card.frozenReason.slice(0, 30) + "..." : card.frozenReason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(card.issuedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setFreezeDialog({ open: true, cardId: card.id, currentStatus: card.status }); }}
                              disabled={card.status === "cancelled" || card.status === "expired"}
                              className={card.status === "frozen" ? "text-green-600 hover:text-green-700" : "text-blue-600 hover:text-blue-700"}
                              title={card.status === "frozen" ? "Unfreeze Card" : "Freeze Card"}
                            >
                              <Snowflake className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setAddBalanceDialog({ open: true, cardId: card.id }); }}
                              disabled={card.status === "cancelled"}
                              title="Add Balance"
                            >
                              <DollarSign className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setCancelDialog({ open: true, cardId: card.id }); }}
                              disabled={card.status === "cancelled"}
                              className="text-red-500 hover:text-red-700"
                              title="Cancel Card"
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        </>
        )}

        {activeTab === "physical_requests" && (
        <>
          {/* Physical Request Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: "Total Requests", count: physicalRequests?.length || 0, color: "" },
              { label: "Pending", count: physicalRequests?.filter((r: any) => r.status === "pending").length || 0, color: "text-yellow-600" },
              { label: "Processing", count: physicalRequests?.filter((r: any) => ["approved", "processing"].includes(r.status)).length || 0, color: "text-blue-600" },
              { label: "Shipped", count: physicalRequests?.filter((r: any) => ["shipped", "out_for_delivery"].includes(r.status)).length || 0, color: "text-indigo-600" },
              { label: "Delivered", count: physicalRequests?.filter((r: any) => r.status === "delivered").length || 0, color: "text-green-600" },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <Label className="text-sm text-gray-500">Filter:</Label>
            {["all", "pending", "approved", "processing", "shipped", "out_for_delivery", "delivered", "cancelled"].map(status => (
              <Button
                key={status}
                variant={physicalFilterStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => setPhysicalFilterStatus(status)}
                className="capitalize text-xs"
              >
                {status.replace(/_/g, " ")}
              </Button>
            ))}
            <div className="ml-auto">
              <Button variant="ghost" size="sm" onClick={() => refetchPhysical()} className="gap-1">
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
            </div>
          </div>

          {/* Physical Requests Table */}
          <Card>
            <CardContent className="p-0">
              {physLoading ? (
                <div className="text-center py-12 text-gray-400">Loading requests...</div>
              ) : !physicalRequests || physicalRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No physical card requests</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Request</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Ship To</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Method</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Tracking</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Requested</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {physicalRequests.map((req: any) => {
                        const physStatusColors: Record<string, string> = {
                          pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
                          approved: "bg-blue-100 text-blue-800 border-blue-300",
                          processing: "bg-indigo-100 text-indigo-800 border-indigo-300",
                          shipped: "bg-purple-100 text-purple-800 border-purple-300",
                          out_for_delivery: "bg-cyan-100 text-cyan-800 border-cyan-300",
                          delivered: "bg-green-100 text-green-800 border-green-300",
                          cancelled: "bg-red-100 text-red-800 border-red-300",
                        };
                        return (
                          <tr key={req.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">#{req.id}</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">Card #{req.virtualCardId}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-gray-700">#{req.userId}</span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-gray-800 font-medium text-xs">{req.shippingName}</p>
                              <p className="text-xs text-gray-400 truncate max-w-[180px]">
                                {req.shippingCity}, {req.shippingState} {req.shippingZip}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="capitalize text-xs">
                                {req.shippingMethod}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={physStatusColors[req.status] || ""}>
                                {req.status.replace(/_/g, " ")}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {req.trackingNumber ? (
                                <div>
                                  <p className="font-mono text-xs">{req.trackingNumber}</p>
                                  {req.carrier && <p className="text-[10px] text-gray-400">{req.carrier}</p>}
                                </div>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {new Date(req.requestedAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end">
                                {!["delivered", "cancelled"].includes(req.status) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs gap-1"
                                    onClick={() => {
                                      setUpdateShipDialog({ open: true, requestId: req.id, currentStatus: req.status });
                                      setShipForm({ ...shipForm, status: "" });
                                    }}
                                  >
                                    <ChevronRight className="w-3 h-3" /> Update
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
        )}
      </div>

      {/* Issue Card Dialog */}
      <Dialog open={issueDialog} onOpenChange={setIssueDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" /> Issue Virtual Debit Card
            </DialogTitle>
            <DialogDescription>
              Create a new virtual debit card for a user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="issue-userId">User ID *</Label>
              <Input
                id="issue-userId"
                type="number"
                placeholder="Enter user ID"
                value={issueForm.userId}
                onChange={(e) => setIssueForm({ ...issueForm, userId: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="issue-name">Cardholder Name *</Label>
              <Input
                id="issue-name"
                placeholder="Full name on card"
                value={issueForm.cardholderName}
                onChange={(e) => setIssueForm({ ...issueForm, cardholderName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="issue-balance">Initial Balance ($)</Label>
              <Input
                id="issue-balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={issueForm.initialBalance}
                onChange={(e) => setIssueForm({ ...issueForm, initialBalance: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="issue-label">Card Label</Label>
              <Input
                id="issue-label"
                placeholder="e.g. Personal Loan Card"
                value={issueForm.cardLabel}
                onChange={(e) => setIssueForm({ ...issueForm, cardLabel: e.target.value })}
              />
            </div>
            <div>
              <Label>Card Color</Label>
              <div className="flex gap-2 mt-1">
                {["blue", "black", "gold", "green", "purple"].map(color => (
                  <button
                    key={color}
                    onClick={() => setIssueForm({ ...issueForm, cardColor: color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      issueForm.cardColor === color ? "border-gray-900 scale-110" : "border-gray-200"
                    } ${
                      color === "blue" ? "bg-blue-600" :
                      color === "black" ? "bg-gray-900" :
                      color === "gold" ? "bg-amber-500" :
                      color === "green" ? "bg-emerald-600" :
                      "bg-purple-600"
                    }`}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialog(false)}>Cancel</Button>
            <Button
              onClick={handleIssueCard}
              disabled={issueCardMutation.isPending}
            >
              {issueCardMutation.isPending ? "Issuing..." : "Issue Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Balance Dialog */}
      <Dialog open={addBalanceDialog.open} onOpenChange={(open) => setAddBalanceDialog({ open, cardId: open ? addBalanceDialog.cardId : null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" /> Add Balance
            </DialogTitle>
            <DialogDescription>
              Load funds onto this virtual card.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="add-amount">Amount ($)</Label>
            <Input
              id="add-amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={addBalanceAmount}
              onChange={(e) => setAddBalanceAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBalanceDialog({ open: false, cardId: null })}>Cancel</Button>
            <Button
              onClick={handleAddBalance}
              disabled={addBalanceMutation.isPending || !addBalanceAmount}
            >
              {addBalanceMutation.isPending ? "Adding..." : "Add Balance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Card Dialog */}
      <Dialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ open, cardId: open ? cancelDialog.cardId : null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="w-5 h-5" /> Cancel Card
            </DialogTitle>
            <DialogDescription>
              This action is permanent. The card will be deactivated immediately.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Input
              id="cancel-reason"
              placeholder="Reason for cancellation"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog({ open: false, cardId: null })}>Keep Card</Button>
            <Button
              variant="destructive"
              onClick={handleCancelCard}
              disabled={cancelCardMutation.isPending}
            >
              {cancelCardMutation.isPending ? "Cancelling..." : "Cancel Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Physical Card Status Dialog */}
      <Dialog 
        open={updateShipDialog.open} 
        onOpenChange={(open) => setUpdateShipDialog({ open, requestId: open ? updateShipDialog.requestId : null, currentStatus: open ? updateShipDialog.currentStatus : "" })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-600" /> Update Shipping Status
            </DialogTitle>
            <DialogDescription>
              Update the status for physical card request #{updateShipDialog.requestId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Status</Label>
              <Badge variant="outline" className="ml-2 capitalize">{updateShipDialog.currentStatus.replace(/_/g, " ")}</Badge>
            </div>
            <div>
              <Label>New Status *</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {getNextStatuses(updateShipDialog.currentStatus).map(status => (
                  <Button
                    key={status}
                    variant={shipForm.status === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShipForm({ ...shipForm, status })}
                    className={`capitalize text-xs ${status === "cancelled" ? "text-red-600 border-red-300 hover:bg-red-50" : ""}`}
                  >
                    {status === "approved" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {status === "processing" && <Package className="w-3 h-3 mr-1" />}
                    {status === "shipped" && <Truck className="w-3 h-3 mr-1" />}
                    {status === "out_for_delivery" && <MapPin className="w-3 h-3 mr-1" />}
                    {status === "delivered" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {status === "cancelled" && <Ban className="w-3 h-3 mr-1" />}
                    {status.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </div>

            {/* Show tracking fields when shipping */}
            {shipForm.status === "shipped" && (
              <>
                <div>
                  <Label htmlFor="tracking-num">Tracking Number</Label>
                  <Input
                    id="tracking-num"
                    placeholder="e.g. 1Z999AA10123456784"
                    value={shipForm.trackingNumber}
                    onChange={(e) => setShipForm({ ...shipForm, trackingNumber: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="carrier">Carrier</Label>
                    <Select value={shipForm.carrier} onValueChange={(v) => setShipForm({ ...shipForm, carrier: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USPS">USPS</SelectItem>
                        <SelectItem value="FedEx">FedEx</SelectItem>
                        <SelectItem value="UPS">UPS</SelectItem>
                        <SelectItem value="DHL">DHL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="est-delivery">Est. Delivery</Label>
                    <Input
                      id="est-delivery"
                      type="date"
                      value={shipForm.estimatedDeliveryDate}
                      onChange={(e) => setShipForm({ ...shipForm, estimatedDeliveryDate: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="tracking-url">Tracking URL</Label>
                  <Input
                    id="tracking-url"
                    placeholder="https://..."
                    value={shipForm.trackingUrl}
                    onChange={(e) => setShipForm({ ...shipForm, trackingUrl: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="card-last4">Physical Card Last 4 Digits</Label>
                  <Input
                    id="card-last4"
                    placeholder="e.g. 5678"
                    maxLength={4}
                    value={shipForm.physicalCardLast4}
                    onChange={(e) => setShipForm({ ...shipForm, physicalCardLast4: e.target.value.replace(/\D/g, "") })}
                  />
                </div>
              </>
            )}

            {shipForm.status === "cancelled" && (
              <div>
                <Label htmlFor="cancel-phys-reason">Cancellation Reason</Label>
                <Input
                  id="cancel-phys-reason"
                  placeholder="Reason for cancellation"
                  value={shipForm.cancellationReason}
                  onChange={(e) => setShipForm({ ...shipForm, cancellationReason: e.target.value })}
                />
              </div>
            )}

            <div>
              <Label htmlFor="admin-notes">Admin Notes</Label>
              <Input
                id="admin-notes"
                placeholder="Internal notes (optional)"
                value={shipForm.adminNotes}
                onChange={(e) => setShipForm({ ...shipForm, adminNotes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateShipDialog({ open: false, requestId: null, currentStatus: "" })}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdatePhysicalStatus}
              disabled={updatePhysicalStatusMutation.isPending || !shipForm.status}
            >
              {updatePhysicalStatusMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Freeze/Unfreeze Card Dialog */}
      <Dialog open={freezeDialog.open} onOpenChange={(open) => { setFreezeDialog({ open, cardId: open ? freezeDialog.cardId : null, currentStatus: open ? freezeDialog.currentStatus : "" }); if (!open) { setFreezeReason(""); setFreezeCustomReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${freezeDialog.currentStatus === "frozen" ? "text-green-600" : "text-blue-600"}`}>
              <Snowflake className="w-5 h-5" /> {freezeDialog.currentStatus === "frozen" ? "Unfreeze Card" : "Freeze Card"}
            </DialogTitle>
            <DialogDescription>
              {freezeDialog.currentStatus === "frozen"
                ? "This will restore the card to active status. The user will be notified by email."
                : "This will freeze the card immediately. The user will not be able to unfreeze it themselves and will be notified by email."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason</Label>
              <Select value={freezeReason} onValueChange={setFreezeReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {CARD_FREEZE_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {freezeReason === "Other (specify below)" && (
              <div>
                <Label>Custom Reason</Label>
                <Textarea
                  placeholder="Enter the reason..."
                  value={freezeCustomReason}
                  onChange={(e) => setFreezeCustomReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFreezeDialog({ open: false, cardId: null, currentStatus: "" }); setFreezeReason(""); setFreezeCustomReason(""); }}>Cancel</Button>
            <Button
              variant={freezeDialog.currentStatus === "frozen" ? "default" : "destructive"}
              onClick={handleFreezeCard}
              disabled={freezeCardMutation.isPending}
            >
              {freezeCardMutation.isPending ? "Processing..." : freezeDialog.currentStatus === "frozen" ? "Unfreeze" : "Freeze Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminVirtualCards;
