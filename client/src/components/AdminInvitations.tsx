import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Send,
  Plus,
  Copy,
  RotateCcw,
  XCircle,
  Mail,
  Loader2,
  Gift,
  Clock,
  CheckCircle2,
  AlertCircle,
  Ban,
  Users,
  X,
  UserPlus,
} from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-300",
  redeemed: "bg-blue-100 text-blue-800 border-blue-300",
  expired: "bg-gray-100 text-gray-800 border-gray-300",
  revoked: "bg-red-100 text-red-800 border-red-300",
};

const statusIcons: Record<string, typeof CheckCircle2> = {
  active: Clock,
  redeemed: CheckCircle2,
  expired: AlertCircle,
  revoked: Ban,
};

// Infer a full name from the local part of an email address
// e.g. john.doe@gmail.com → "John Doe", sarah_wilson@co.com → "Sarah Wilson"
function inferNameFromEmail(email: string): string {
  const local = email.split("@")[0];
  // Split on dots, underscores, hyphens, or camelCase boundaries
  const parts = local
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → separate words
    .split(/[._\-+]+/)
    .filter(Boolean);

  // Filter out parts that look like pure numbers (e.g. john.doe123 → skip "123")
  const nameParts = parts.filter((p) => /[a-zA-Z]/.test(p));

  if (nameParts.length === 0) return local;

  return nameParts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

// Parse emails from text: supports comma, semicolon, newline separated
// Detects "Name <email>", "email (Name)", and plain email patterns
// Automatically infers full names from email addresses (e.g. john.doe@gmail.com → John Doe)
function parseEmailEntries(text: string): { email: string; name: string }[] {
  const results: { email: string; name: string }[] = [];
  const seen = new Set<string>();

  // Split by common delimiters
  const parts = text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    // Pattern: "Name <email@example.com>"
    const angleBracket = part.match(/^(.+?)\s*<([^>]+@[^>]+)>$/);
    if (angleBracket) {
      const email = angleBracket[2].trim().toLowerCase();
      const name = angleBracket[1].trim().replace(/^["']|["']$/g, "");
      if (!seen.has(email) && isValidEmail(email)) {
        seen.add(email);
        results.push({ email, name: name || inferNameFromEmail(email) });
      }
      continue;
    }

    // Pattern: "email@example.com (Name)"
    const parenName = part.match(/^([^\s]+@[^\s]+)\s*\(([^)]+)\)$/);
    if (parenName) {
      const email = parenName[1].trim().toLowerCase();
      const name = parenName[2].trim();
      if (!seen.has(email) && isValidEmail(email)) {
        seen.add(email);
        results.push({ email, name: name || inferNameFromEmail(email) });
      }
      continue;
    }

    // Pattern: plain email — infer full name from local part
    const emailOnly = part.trim().toLowerCase();
    if (!seen.has(emailOnly) && isValidEmail(emailOnly)) {
      seen.add(emailOnly);
      results.push({ email: emailOnly, name: inferNameFromEmail(emailOnly) });
    }
  }

  return results;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function AdminInvitations() {
  const utils = trpc.useUtils();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogTab, setDialogTab] = useState<"single" | "bulk">("single");

  // Single invite form state
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  // Bulk invite form state
  const [bulkEmailText, setBulkEmailText] = useState("");
  const [parsedEmails, setParsedEmails] = useState<{ email: string; name: string }[]>([]);

  // Shared offer form state
  const [offerAmount, setOfferAmount] = useState("");
  const [offerApr, setOfferApr] = useState("");
  const [offerTermMonths, setOfferTermMonths] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [adminNotes, setAdminNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  // Queries
  const queryInput = statusFilter !== "all" ? { status: statusFilter as any } : undefined;
  const { data: codesData, isLoading } = trpc.invitations.list.useQuery(queryInput);
  const codes = codesData?.data || [];

  // Mutations
  const createMutation = trpc.invitations.create.useMutation({
    onSuccess: (result) => {
      toast.success(`Invitation code ${result.data.code} created${sendEmail ? " and emailed" : ""}!`);
      utils.invitations.list.invalidate();
      resetForm();
      setCreateDialogOpen(false);
    },
    onError: (err) => toast.error(err.message || "Failed to create invitation"),
  });

  const bulkCreateMutation = trpc.invitations.bulkCreate.useMutation({
    onSuccess: (result) => {
      const { sent, failed, total } = result.data;
      if (failed === 0) {
        toast.success(`All ${sent} invitation${sent > 1 ? "s" : ""} created and sent!`);
      } else {
        toast.warning(`${sent} of ${total} invitations sent. ${failed} failed.`);
      }
      utils.invitations.list.invalidate();
      resetForm();
      setCreateDialogOpen(false);
    },
    onError: (err) => toast.error(err.message || "Failed to send bulk invitations"),
  });

  const revokeMutation = trpc.invitations.revoke.useMutation({
    onSuccess: () => {
      toast.success("Invitation revoked");
      utils.invitations.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resendMutation = trpc.invitations.resend.useMutation({
    onSuccess: () => toast.success("Invitation email resent!"),
    onError: (err) => toast.error(err.message || "Failed to resend"),
  });

  const resetForm = () => {
    setRecipientName("");
    setRecipientEmail("");
    setBulkEmailText("");
    setParsedEmails([]);
    setOfferAmount("");
    setOfferApr("");
    setOfferTermMonths("");
    setOfferDescription("");
    setExpiresInDays("30");
    setAdminNotes("");
    setSendEmail(true);
    setDialogTab("single");
  };

  const handleCreate = () => {
    if (!recipientName.trim() || !recipientEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    createMutation.mutate({
      recipientName: recipientName.trim(),
      recipientEmail: recipientEmail.trim(),
      offerAmount: offerAmount ? Math.round(Number(offerAmount) * 100) : undefined,
      offerApr: offerApr ? Math.round(Number(offerApr) * 100) : undefined,
      offerTermMonths: offerTermMonths ? Number(offerTermMonths) : undefined,
      offerDescription: offerDescription.trim() || undefined,
      expiresInDays: Number(expiresInDays) || 30,
      adminNotes: adminNotes.trim() || undefined,
      sendEmail,
    });
  };

  const handleBulkCreate = () => {
    if (parsedEmails.length === 0) {
      toast.error("No valid email addresses detected. Enter emails separated by commas, semicolons, or new lines.");
      return;
    }
    bulkCreateMutation.mutate({
      recipients: parsedEmails,
      offerAmount: offerAmount ? Math.round(Number(offerAmount) * 100) : undefined,
      offerApr: offerApr ? Math.round(Number(offerApr) * 100) : undefined,
      offerTermMonths: offerTermMonths ? Number(offerTermMonths) : undefined,
      offerDescription: offerDescription.trim() || undefined,
      expiresInDays: Number(expiresInDays) || 30,
      adminNotes: adminNotes.trim() || undefined,
      sendEmail,
    });
  };

  const handleBulkTextChange = (text: string) => {
    setBulkEmailText(text);
    setParsedEmails(parseEmailEntries(text));
  };

  const removeEmail = (emailToRemove: string) => {
    const updated = parsedEmails.filter((e) => e.email !== emailToRemove);
    setParsedEmails(updated);
    setBulkEmailText(updated.map((e) => e.name !== e.email.split("@")[0] ? `${e.name} <${e.email}>` : e.email).join("\n"));
  };

  const updateEmailName = (email: string, newName: string) => {
    setParsedEmails((prev) =>
      prev.map((e) => (e.email === email ? { ...e, name: newName } : e))
    );
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Code ${code} copied to clipboard`);
  };

  const filtered = codes.filter((c: any) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        c.code?.toLowerCase().includes(term) ||
        c.recipientEmail?.toLowerCase().includes(term) ||
        c.recipientName?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const activeCount = codes.filter((c: any) => c.status === "active").length;
  const redeemedCount = codes.filter((c: any) => c.status === "redeemed").length;
  const pendingReminderCount = codes.filter((c: any) => c.status === "active" && new Date(c.expiresAt) > new Date() && (c.reminderCount || 0) > 0).length;
  const totalCount = codes.length;

  const isMutating = createMutation.isPending || bulkCreateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header + Stats */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Invitation Codes</h2>
          <p className="text-gray-500 text-sm">Send personalized offer codes to potential borrowers</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }} className="bg-[#C9A227] hover:bg-[#b8922a] text-white">
          <Plus className="w-4 h-4 mr-2" /> New Invitation
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Sent</p>
              <p className="text-2xl font-bold">{totalCount}</p>
            </div>
            <Gift className="w-8 h-8 text-purple-400" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-bold text-green-700">{activeCount}</p>
            </div>
            <Mail className="w-8 h-8 text-green-400" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Being Reminded</p>
              <p className="text-2xl font-bold text-amber-700">{pendingReminderCount}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-400" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Redeemed</p>
              <p className="text-2xl font-bold text-blue-700">{redeemedCount}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-blue-400" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <Input
            placeholder="Search by code, name, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="md:w-64"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="redeemed">Redeemed</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-sm text-gray-500 mt-2">Loading invitations...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Gift className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No invitation codes yet</p>
              <p className="text-sm text-gray-400 mt-1">Create one to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Recipient</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Offer</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Reminders</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Expires</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Created</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv: any) => {
                    const StatusIcon = statusIcons[inv.status] || AlertCircle;
                    const isExpired = inv.status === "active" && new Date(inv.expiresAt) < new Date();
                    const displayStatus = isExpired ? "expired" : inv.status;
                    return (
                      <tr key={inv.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono font-bold text-[#0A2540] dark:text-[#C9A227]">
                              {inv.code}
                            </code>
                            <button
                              onClick={() => copyCode(inv.code)}
                              className="text-gray-400 hover:text-gray-600"
                              title="Copy code"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{inv.recipientName}</p>
                          <p className="text-xs text-gray-500">{inv.recipientEmail}</p>
                        </td>
                        <td className="px-4 py-3">
                          {inv.offerAmount ? (
                            <div>
                              <p className="font-medium">{formatCurrency(inv.offerAmount)}</p>
                              {inv.offerApr && (
                                <p className="text-xs text-gray-500">{(inv.offerApr / 100).toFixed(2)}% APR</p>
                              )}
                              {inv.offerTermMonths && (
                                <p className="text-xs text-gray-500">{inv.offerTermMonths} months</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">General invite</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${statusColors[displayStatus]} text-xs gap-1`}>
                            <StatusIcon className="w-3 h-3" />
                            {displayStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {inv.reminderCount > 0 ? (
                            <div className="flex items-center gap-1">
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                                {inv.reminderCount} sent
                              </Badge>
                              {inv.lastReminderSentAt && (
                                <span className="text-[10px] text-gray-400" title={`Last: ${new Date(inv.lastReminderSentAt).toLocaleString()}`}>
                                  {new Date(inv.lastReminderSentAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {inv.status === "active" && !isExpired && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => resendMutation.mutate({ codeId: inv.id })}
                                  disabled={resendMutation.isPending}
                                  title="Resend Email"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-700"
                                  onClick={() => revokeMutation.mutate({ codeId: inv.id })}
                                  disabled={revokeMutation.isPending}
                                  title="Revoke"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </Button>
                              </>
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

      {/* Create Invitation Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-[#C9A227]" />
              Send Invitation Code
            </DialogTitle>
            <DialogDescription>
              Invite one or multiple customers with personalized offer codes
            </DialogDescription>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as "single" | "bulk")} className="mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Single Invite
              </TabsTrigger>
              <TabsTrigger value="bulk" className="gap-2">
                <Users className="w-4 h-4" />
                Bulk Invite
              </TabsTrigger>
            </TabsList>

            {/* Single Invite Tab */}
            <TabsContent value="single" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Recipient Name *</Label>
                  <Input
                    placeholder="John Doe"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Bulk Invite Tab */}
            <TabsContent value="bulk" className="space-y-4 mt-4">
              <div>
                <Label>Email Addresses</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Enter multiple emails separated by commas, semicolons, or new lines. Supports formats:{" "}
                  <span className="font-mono text-[#0A2540] dark:text-[#C9A227]">email@example.com</span>,{" "}
                  <span className="font-mono text-[#0A2540] dark:text-[#C9A227]">John Doe &lt;email@example.com&gt;</span>
                </p>
                <Textarea
                  placeholder={`john@example.com\njane@example.com\nJohn Smith <john.smith@company.com>\nSarah Wilson <sarah@email.com>`}
                  value={bulkEmailText}
                  onChange={(e) => handleBulkTextChange(e.target.value)}
                  rows={5}
                  className="font-mono text-sm"
                />
              </div>

              {/* Preview detected emails */}
              {parsedEmails.length > 0 && (
                <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      {parsedEmails.length} email{parsedEmails.length > 1 ? "s" : ""} detected
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-500 hover:text-red-700 h-7"
                      onClick={() => { setBulkEmailText(""); setParsedEmails([]); }}
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {parsedEmails.map((entry) => (
                      <div
                        key={entry.email}
                        className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded px-3 py-1.5 text-sm"
                      >
                        <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          value={entry.name}
                          onChange={(e) => updateEmailName(entry.email, e.target.value)}
                          className="bg-transparent border-none outline-none font-medium text-gray-900 dark:text-gray-100 w-32 min-w-0"
                          title="Edit recipient name"
                        />
                        <span className="text-gray-500 text-xs truncate flex-1">{entry.email}</span>
                        <button
                          onClick={() => removeEmail(entry.email)}
                          className="text-gray-400 hover:text-red-500 shrink-0"
                          title="Remove email"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Shared offer details */}
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Offer Details (optional)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  placeholder="10000"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>APR (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="8.99"
                  value={offerApr}
                  onChange={(e) => setOfferApr(e.target.value)}
                />
              </div>
              <div>
                <Label>Term (months)</Label>
                <Input
                  type="number"
                  placeholder="36"
                  value={offerTermMonths}
                  onChange={(e) => setOfferTermMonths(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Offer Description</Label>
              <Textarea
                placeholder="e.g., Special pre-approved offer for existing customers..."
                value={offerDescription}
                onChange={(e) => setOfferDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-3 border-t pt-4">
              <div>
                <Label>Expires In (days)</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Send email notification</span>
                </label>
              </div>
            </div>

            <div>
              <Label>Admin Notes</Label>
              <Textarea
                placeholder="Internal notes (not sent to recipient)..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { resetForm(); setCreateDialogOpen(false); }}>
              Cancel
            </Button>
            {dialogTab === "single" ? (
              <Button
                onClick={handleCreate}
                disabled={isMutating}
                className="bg-[#C9A227] hover:bg-[#b8922a] text-white"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {sendEmail ? "Create & Send" : "Create Code"}
              </Button>
            ) : (
              <Button
                onClick={handleBulkCreate}
                disabled={isMutating || parsedEmails.length === 0}
                className="bg-[#C9A227] hover:bg-[#b8922a] text-white"
              >
                {bulkCreateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Users className="w-4 h-4 mr-2" />
                )}
                {sendEmail
                  ? `Send to ${parsedEmails.length} Recipient${parsedEmails.length !== 1 ? "s" : ""}`
                  : `Create ${parsedEmails.length} Code${parsedEmails.length !== 1 ? "s" : ""}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
