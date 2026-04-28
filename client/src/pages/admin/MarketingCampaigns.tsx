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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, TrendingUp, Users, DollarSign,
  MousePointerClick, Plus, Tag, Mail, Copy, Power,
} from "lucide-react";
import { useState } from "react";

export default function MarketingCampaigns() {
  const utils = trpc.useUtils();

  // ── Campaign state ────────────────────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");

  // ── Promo code state ──────────────────────────────────────────────
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoDescription, setPromoDescription] = useState("");
  const [promoDiscountType, setPromoDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [promoDiscountValue, setPromoDiscountValue] = useState("");
  const [promoMaxUses, setPromoMaxUses] = useState("");
  const [promoExpiry, setPromoExpiry] = useState("");

  // ── Email broadcast state ─────────────────────────────────────────
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // ── Queries ───────────────────────────────────────────────────────
  const { data: campaignsData, isLoading } = trpc.marketing.getCampaigns.useQuery();
  const campaignList = (campaignsData as any)?.data ?? [];

  const { data: promoData } = trpc.marketing.getPromoCodes.useQuery();
  const promoList = (promoData as any)?.data ?? [];

  const { data: recipientData } = trpc.marketing.getEligibleRecipientCount.useQuery();
  const eligibleCount = (recipientData as any)?.count ?? 0;

  const { data: emailHistoryData } = trpc.marketing.getEmailHistory.useQuery();
  const emailHistory = (emailHistoryData as any)?.data ?? [];

  // ── Mutations ─────────────────────────────────────────────────────
  const createMutation = trpc.marketing.createCampaign.useMutation({
    onSuccess: () => {
      utils.marketing.getCampaigns.invalidate();
      setCreateDialogOpen(false);
      setCampaignName(""); setUtmSource(""); setUtmMedium("");
      setUtmCampaign(""); setUtmTerm(""); setUtmContent("");
      setBudget(""); setNotes("");
      toast.success("Campaign created.");
    },
    onError: (e: any) => toast.error(e.message || "Failed to create campaign."),
  });

  const promoMutation = trpc.marketing.createPromoCode.useMutation({
    onSuccess: () => {
      utils.marketing.getPromoCodes.invalidate();
      setPromoDialogOpen(false);
      setPromoCode(""); setPromoDescription(""); setPromoDiscountValue("");
      setPromoMaxUses(""); setPromoExpiry("");
      toast.success("Promo code created.");
    },
    onError: (e: any) => toast.error(e.message || "Failed to create promo code."),
  });

  const deactivateMutation = trpc.marketing.deactivatePromoCode.useMutation({
    onSuccess: () => {
      utils.marketing.getPromoCodes.invalidate();
      toast.success("Promo code deactivated.");
    },
  });

  const emailMutation = trpc.marketing.sendCampaignEmail.useMutation({
    onSuccess: (data: any) => {
      utils.marketing.getEmailHistory.invalidate();
      setEmailSubject(""); setEmailBody("");
      toast.success(`Email sent to ${data.sentCount} recipients.`);
    },
    onError: (e: any) => toast.error(e.message || "Failed to send campaign email."),
  });

  // ── Helpers ───────────────────────────────────────────────────────
  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      campaignName, utmSource, utmMedium, utmCampaign,
      utmTerm: utmTerm || undefined,
      utmContent: utmContent || undefined,
      budget: budget ? Math.round(parseFloat(budget) * 100) : undefined,
    } as any);
  };

  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    promoMutation.mutate({
      code: promoCode,
      description: promoDescription || undefined,
      discountType: promoDiscountType,
      discountValue: promoDiscountType === "percentage"
        ? parseInt(promoDiscountValue) : Math.round(parseFloat(promoDiscountValue) * 100),
      maxUses: promoMaxUses ? parseInt(promoMaxUses) : undefined,
      expiresAt: promoExpiry || undefined,
    });
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSubject.trim() || !emailBody.trim()) return;
    emailMutation.mutate({ subject: emailSubject, bodyHtml: emailBody });
  };

  const generateTrackingUrl = (campaign: any) => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      utm_source: campaign.source || "",
      utm_medium: campaign.medium || "",
      utm_campaign: campaign.campaignCode || campaign.campaignName,
    });
    return `${baseUrl}?${params.toString()}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard.");
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
          <TrendingUp className="h-8 w-8" />
          Marketing &amp; Promotions
        </h1>
        <p className="text-muted-foreground">
          Campaigns, promo codes, and email broadcasts.
        </p>
      </div>

      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="promo">Promo Codes</TabsTrigger>
          <TabsTrigger value="email">Email Broadcast</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════ CAMPAIGNS TAB ═══════════════════════ */}
        <TabsContent value="campaigns" className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Campaigns</p>
                  <p className="text-2xl font-bold">{campaignList.length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Promos</p>
                  <p className="text-2xl font-bold">
                    {promoList.filter((p: any) => p.isActive).length}
                  </p>
                </div>
                <Tag className="h-8 w-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Eligible Recipients</p>
                  <p className="text-2xl font-bold">{eligibleCount}</p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </Card>
          </div>

          {/* Create Campaign Dialog */}
          <div className="flex justify-end">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Create Campaign</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Marketing Campaign</DialogTitle>
                  <DialogDescription>Set up a new campaign with UTM tracking.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateCampaign}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Campaign Name</Label>
                      <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Summer 2024 Promotion" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>UTM Source *</Label>
                        <Input value={utmSource} onChange={e => setUtmSource(e.target.value)} placeholder="google, facebook" required />
                      </div>
                      <div className="space-y-2">
                        <Label>UTM Medium *</Label>
                        <Input value={utmMedium} onChange={e => setUtmMedium(e.target.value)} placeholder="cpc, email, social" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>UTM Campaign *</Label>
                      <Input value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} placeholder="summer_sale_2024" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>UTM Term</Label>
                        <Input value={utmTerm} onChange={e => setUtmTerm(e.target.value)} placeholder="personal+loans" />
                      </div>
                      <div className="space-y-2">
                        <Label>UTM Content</Label>
                        <Input value={utmContent} onChange={e => setUtmContent(e.target.value)} placeholder="banner_ad_1" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Budget</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                        <Input type="number" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} className="pl-7" placeholder="0.00" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional information..." rows={2} />
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Campaign"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Campaigns Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Source / Medium</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignList.length > 0 ? (
                  campaignList.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{c.campaignName}</p>
                          <p className="text-xs text-muted-foreground">{c.campaignCode}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {c.source && <Badge variant="outline">{c.source}</Badge>}
                          {c.medium && <Badge variant="outline">{c.medium}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{c.budget ? `$${(c.budget / 100).toFixed(2)}` : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={c.isActive ? "default" : "secondary"}>
                          {c.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(generateTrackingUrl(c))}>
                          <Copy className="h-3 w-3 mr-1" /> Copy URL
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No campaigns yet. Create one to start tracking.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ═══════════════════════ PROMO CODES TAB ═══════════════════════ */}
        <TabsContent value="promo" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Promo Codes</h2>
              <p className="text-sm text-muted-foreground">Create and manage discount codes for campaigns.</p>
            </div>
            <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
              <DialogTrigger asChild>
                <Button><Tag className="h-4 w-4 mr-2" /> Create Promo Code</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Promo Code</DialogTitle>
                  <DialogDescription>Create a discount code for marketing campaigns.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreatePromo}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Code *</Label>
                      <Input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="SUMMER25" required maxLength={50} />
                      <p className="text-xs text-muted-foreground">Will be uppercased automatically</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input value={promoDescription} onChange={e => setPromoDescription(e.target.value)} placeholder="25% off origination fee" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Discount Type *</Label>
                        <Select value={promoDiscountType} onValueChange={(v: "percentage" | "fixed") => setPromoDiscountType(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Discount Value *</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2">
                            {promoDiscountType === "percentage" ? "%" : "$"}
                          </span>
                          <Input type="number" min="1" step={promoDiscountType === "percentage" ? "1" : "0.01"}
                            value={promoDiscountValue} onChange={e => setPromoDiscountValue(e.target.value)}
                            className="pl-7" required />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Max Uses</Label>
                        <Input type="number" min="1" value={promoMaxUses} onChange={e => setPromoMaxUses(e.target.value)} placeholder="Unlimited" />
                      </div>
                      <div className="space-y-2">
                        <Label>Expires At</Label>
                        <Input type="date" value={promoExpiry} onChange={e => setPromoExpiry(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setPromoDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={promoMutation.isPending}>
                      {promoMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Code"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoList.length > 0 ? (
                  promoList.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-bold">{p.code}</TableCell>
                      <TableCell className="text-sm">{p.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {p.discountType === "percentage"
                            ? `${p.discountValue}%`
                            : `$${(p.discountValue / 100).toFixed(2)}`}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.currentUses}{p.maxUses ? ` / ${p.maxUses}` : ""}</TableCell>
                      <TableCell className="text-sm">
                        {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : "Never"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.isActive ? "default" : "secondary"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.isActive && (
                          <Button size="sm" variant="destructive"
                            onClick={() => deactivateMutation.mutate({ promoCodeId: p.id })}
                            disabled={deactivateMutation.isPending}>
                            <Power className="h-3 w-3 mr-1" /> Deactivate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No promo codes yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ═══════════════════════ EMAIL BROADCAST TAB ═══════════════════════ */}
        <TabsContent value="email" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Email Broadcast</h2>
            <p className="text-sm text-muted-foreground">
              Send marketing emails to users who opted in. Currently <strong>{eligibleCount}</strong> eligible recipients.
            </p>
          </div>

          <Card className="p-6">
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Exciting news from AmeriLend!" required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Email Body (HTML) *</Label>
                <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                  placeholder="<p>We have exciting new offers for you...</p>" rows={8} required />
                <p className="text-xs text-muted-foreground">
                  Write the email body in HTML. It will be wrapped in the standard AmeriLend email template with header, footer, and unsubscribe link.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  Will send to <strong>{eligibleCount}</strong> opted-in users
                </p>
                <Button type="submit" disabled={emailMutation.isPending || eligibleCount === 0}>
                  {emailMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                  ) : (
                    <><Mail className="mr-2 h-4 w-4" />Send Broadcast</>
                  )}
                </Button>
              </div>
            </form>
          </Card>

          {/* Email History */}
          {emailHistory.length > 0 && (
            <Card>
              <div className="p-4 border-b">
                <h3 className="font-semibold">Send History</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Sent At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailHistory.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.subject}</TableCell>
                      <TableCell>{entry.recipientCount}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(entry.sentAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
