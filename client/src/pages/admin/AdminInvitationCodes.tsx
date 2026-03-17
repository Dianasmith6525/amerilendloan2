import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, ArrowLeft, Plus, Copy, RefreshCw,
  XCircle, CheckCircle, Clock, Ticket, Search, Send, X
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface InvitationCode {
  id: number;
  code: string;
  recipientEmail: string;
  recipientName: string;
  offerAmount?: number | null;
  offerApr?: number | null;
  offerTermMonths?: number | null;
  offerDescription?: string | null;
  status: string;
  adminNotes?: string | null;
  createdAt: string | Date;
  expiresAt?: string | Date | null;
  redeemedAt?: string | Date | null;
}

export default function AdminInvitationCodes() {
  const [, setLocation] = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCode, setSelectedCode] = useState<InvitationCode | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Create form state
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerApr, setOfferApr] = useState("");
  const [offerTermMonths, setOfferTermMonths] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [adminNotes, setAdminNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const { data: codesData, isLoading } = trpc.invitations.list.useQuery(
    statusFilter ? { status: statusFilter as "active" | "redeemed" | "expired" | "revoked" } : undefined
  );
  const utils = trpc.useUtils();

  const createMutation = trpc.invitations.create.useMutation({
    onSuccess: (data) => {
      if (data.emailSent) {
        toast.success("Invitation code created and email sent successfully!");
      } else if (data.emailError) {
        toast.warning(`Code created but email failed: ${data.emailError}`);
      } else {
        toast.success("Invitation code created (email not requested)");
      }
      utils.invitations.list.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeMutation = trpc.invitations.revoke.useMutation({
    onSuccess: () => {
      toast.success("Invitation code revoked");
      utils.invitations.list.invalidate();
      setSelectedCode(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const resendMutation = trpc.invitations.resend.useMutation({
    onSuccess: () => {
      toast.success("Invitation email resent");
    },
    onError: (err) => toast.error(err.message),
  });

  const codes = (codesData?.data ?? []) as InvitationCode[];
  const active = codes.filter((c: InvitationCode) => c.status === "active");
  const redeemed = codes.filter((c: InvitationCode) => c.status === "redeemed");
  const expired = codes.filter((c: InvitationCode) => c.status === "expired");
  const revoked = codes.filter((c: InvitationCode) => c.status === "revoked");

  const resetForm = () => {
    setShowCreateForm(false);
    setRecipientEmail("");
    setRecipientName("");
    setOfferAmount("");
    setOfferApr("");
    setOfferTermMonths("");
    setOfferDescription("");
    setExpiresInDays("30");
    setAdminNotes("");
    setSendEmail(true);
  };

  const handleCreate = () => {
    if (!recipientEmail || !recipientName) {
      toast.error("Recipient email and name are required");
      return;
    }
    createMutation.mutate({
      recipientEmail,
      recipientName,
      // Convert dollars to cents for storage (e.g. $5000 → 500000 cents)
      offerAmount: offerAmount ? Math.round(parseFloat(offerAmount) * 100) : undefined,
      // Convert APR percentage to basis points (e.g. 5.99% → 599 bps)
      offerApr: offerApr ? Math.round(parseFloat(offerApr) * 100) : undefined,
      offerTermMonths: offerTermMonths ? parseInt(offerTermMonths) : undefined,
      offerDescription: offerDescription || undefined,
      expiresInDays: parseInt(expiresInDays) || 30,
      adminNotes: adminNotes || undefined,
      sendEmail,
    });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "redeemed":
        return <Badge className="bg-blue-600"><CheckCircle className="w-3 h-3 mr-1" />Redeemed</Badge>;
      case "expired":
        return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
      case "revoked":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge className="bg-slate-600">{status}</Badge>;
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")} className="text-slate-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Ticket className="h-8 w-8 text-cyan-400" />
                Invitation Codes
              </h1>
              <p className="text-slate-400 mt-1">Create and manage invitation codes for pre-approved offers</p>
            </div>
          </div>
          {!showCreateForm && (
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Invitation
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-white">{codes.length}</p>
              <p className="text-slate-400 text-sm">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-green-400">{active.length}</p>
              <p className="text-slate-400 text-sm">Active</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-blue-400">{redeemed.length}</p>
              <p className="text-slate-400 text-sm">Redeemed</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-yellow-400">{expired.length}</p>
              <p className="text-slate-400 text-sm">Expired</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-red-400">{revoked.length}</p>
              <p className="text-slate-400 text-sm">Revoked</p>
            </CardContent>
          </Card>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Create Invitation Code</CardTitle>
                <Button variant="ghost" size="sm" onClick={resetForm} className="text-slate-400">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-slate-400">
                Generate a unique invitation code with an optional pre-approved offer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Recipient */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Recipient Name *</label>
                  <Input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="John Doe"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Recipient Email *</label>
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>

              {/* Offer details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Offer Amount ($)</label>
                  <Input
                    type="number"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    placeholder="5000"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">APR (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={offerApr}
                    onChange={(e) => setOfferApr(e.target.value)}
                    placeholder="5.99"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Term (months)</label>
                  <Input
                    type="number"
                    value={offerTermMonths}
                    onChange={(e) => setOfferTermMonths(e.target.value)}
                    placeholder="36"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Offer Description</label>
                <Textarea
                  value={offerDescription}
                  onChange={(e) => setOfferDescription(e.target.value)}
                  placeholder="Special pre-approved personal loan offer..."
                  className="bg-slate-700 border-slate-600 text-white"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Expires In (days)</label>
                  <Input
                    type="number"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Admin Notes</label>
                  <Input
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Internal notes..."
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
                <label className="text-sm text-slate-300">Send invitation email to recipient</label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={resetForm} className="text-slate-400">Cancel</Button>
                <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Create Invitation
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Code List */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Ticket className="h-5 w-5" /> Invitation Codes
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Click a code to view details and manage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all" onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v)}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="redeemed">Redeemed</TabsTrigger>
                    <TabsTrigger value="expired">Expired</TabsTrigger>
                    <TabsTrigger value="revoked">Revoked</TabsTrigger>
                  </TabsList>
                </Tabs>

                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : codes.length === 0 ? (
                  <div className="text-center py-12">
                    <Ticket className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No invitation codes found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {codes.map((code: InvitationCode) => (
                      <div
                        key={code.id}
                        onClick={() => setSelectedCode(code)}
                        className={`p-4 rounded-lg cursor-pointer transition-colors border ${
                          selectedCode?.id === code.id
                            ? "bg-slate-600/50 border-cyan-500"
                            : "bg-slate-700/50 hover:bg-slate-700 border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-white font-medium">{code.recipientName}</p>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyCode(code.code); }}
                                className="text-slate-500 hover:text-white transition-colors"
                                title="Copy code"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                            <p className="text-slate-400 text-sm mt-1">
                              {code.recipientEmail}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 font-mono">{code.code}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {statusBadge(code.status)}
                            {code.offerAmount && (
                              <span className="text-xs text-green-400">${(code.offerAmount / 100).toLocaleString()}</span>
                            )}
                            <span className="text-xs text-slate-500">
                              {new Date(code.createdAt).toLocaleDateString()}
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
            {selectedCode ? (
              <Card className="bg-slate-800 border-slate-700 sticky top-4">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">{selectedCode.recipientName}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCode(null)} className="text-slate-400">
                      ✕
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Invitation Code</h3>
                    <div className="flex items-center gap-2">
                      <code className="text-cyan-300 font-mono bg-slate-700/50 px-2 py-1 rounded text-sm">{selectedCode.code}</code>
                      <Button variant="ghost" size="icon" onClick={() => copyCode(selectedCode.code)} className="text-slate-400 hover:text-white h-7 w-7">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Status</h3>
                    {statusBadge(selectedCode.status)}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Email</h3>
                    <p className="text-slate-300 text-sm">{selectedCode.recipientEmail}</p>
                  </div>
                  {selectedCode.offerAmount && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Offer Amount</h3>
                      <p className="text-white font-medium">${(selectedCode.offerAmount / 100).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedCode.offerApr && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">APR</h3>
                      <p className="text-white">{(selectedCode.offerApr / 100).toFixed(2)}%</p>
                    </div>
                  )}
                  {selectedCode.offerTermMonths && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Term</h3>
                      <p className="text-white">{selectedCode.offerTermMonths} months</p>
                    </div>
                  )}
                  {selectedCode.offerDescription && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Offer Description</h3>
                      <p className="text-slate-300 text-sm">{selectedCode.offerDescription}</p>
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Created</h3>
                    <p className="text-slate-300 text-sm">{new Date(selectedCode.createdAt).toLocaleString()}</p>
                  </div>
                  {selectedCode.expiresAt && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Expires</h3>
                      <p className="text-slate-300 text-sm">{new Date(selectedCode.expiresAt).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedCode.adminNotes && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">Admin Notes</h3>
                      <p className="text-slate-300 text-sm bg-slate-700/50 p-2 rounded">{selectedCode.adminNotes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {selectedCode.status === "active" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="ghost"
                        className="flex-1 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                        onClick={() => resendMutation.mutate({ codeId: selectedCode.id })}
                        disabled={resendMutation.isPending}
                      >
                        {resendMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-1" />
                        )}
                        Resend
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => {
                          if (confirm("Revoke this invitation code?")) {
                            revokeMutation.mutate({ codeId: selectedCode.id });
                          }
                        }}
                        disabled={revokeMutation.isPending}
                      >
                        {revokeMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-1" />
                        )}
                        Revoke
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="pt-6 text-center py-12">
                  <Search className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Select an invitation to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
