import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MessageSquare, Clock, CheckCircle, AlertCircle, ChevronRight, Send, LogIn } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import SEOHead from "@/components/SEOHead";

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  createdAt: string;
  lastUpdated: string;
  messageCount: number;
}

// Form schema matching backend validation
const ticketFormSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  category: z.enum(["billing", "technical", "account", "loan", "other"]),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

type TicketFormData = z.infer<typeof ticketFormSchema>;

export function SupportCenter() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");

  // Only fetch tickets when authenticated to avoid auth redirect
  const { data: ticketsData, refetch } = trpc.supportTickets.getUserTickets.useQuery(undefined, {
    enabled: isAuthenticated && !authLoading,
  });
  const tickets = ticketsData?.data || [];

  // Create ticket mutation
  const createTicketMutation = trpc.supportTickets.create.useMutation({
    onSuccess: () => {
      toast.success("Support ticket created successfully!");
      setShowNewTicket(false);
      refetch();
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create ticket");
    },
  });

  // Form setup
  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      subject: "",
      category: "other",
      description: "",
    },
  });

  const onSubmit = (data: TicketFormData) => {
    createTicketMutation.mutate(data);
  };

  // Map backend tickets to UI format
  const allTickets: SupportTicket[] = tickets.map((t: any) => ({
    id: `TKT-${String(t.id).padStart(3, "0")}`,
    rawId: t.id,
    subject: t.subject,
    description: t.description,
    status: t.status as "open" | "in-progress" | "resolved" | "closed",
    priority: (t.priority || "medium") as "low" | "medium" | "high",
    createdAt: new Date(t.createdAt).toLocaleDateString(),
    lastUpdated: new Date(t.updatedAt || t.createdAt).toLocaleDateString(),
    messageCount: 0,
  }));

  // Fetch messages for selected ticket
  const selectedRawId = selectedTicket ? (selectedTicket as any).rawId : null;
  const { data: messagesData, refetch: refetchMessages } = trpc.supportTickets.getMessages.useQuery(
    { ticketId: selectedRawId! },
    { enabled: !!selectedRawId }
  );
  const ticketMessages = messagesData?.data || [];

  // Reply mutation
  const addMessageMutation = trpc.supportTickets.addMessage.useMutation({
    onSuccess: () => {
      toast.success("Reply sent!");
      setReplyMessage("");
      refetchMessages();
    },
    onError: (err: any) => toast.error(err.message || "Failed to send reply"),
  });

  const handleSendReply = () => {
    if (!replyMessage.trim() || !selectedRawId) return;
    addMessageMutation.mutate({ ticketId: selectedRawId, message: replyMessage });
  };

  const filteredTickets =
    filter === "all"
      ? allTickets
      : filter === "open"
        ? allTickets.filter((t) => ["open", "in-progress"].includes(t.status))
        : allTickets.filter((t) => ["resolved", "closed"].includes(t.status));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-blue-600">Open</Badge>;
      case "in-progress":
        return <Badge className="bg-yellow-600">In Progress</Badge>;
      case "resolved":
        return <Badge className="bg-green-600">Resolved</Badge>;
      case "closed":
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">{priority.toUpperCase()}</Badge>;
      case "medium":
        return <Badge className="bg-yellow-600">{priority.toUpperCase()}</Badge>;
      case "low":
        return <Badge variant="outline">{priority.toUpperCase()}</Badge>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertCircle className="w-5 h-5 text-blue-400" />;
      case "in-progress":
        return <Clock className="w-5 h-5 text-yellow-400" />;
      case "resolved":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "closed":
        return <CheckCircle className="w-5 h-5 text-slate-400" />;
      default:
        return null;
    }
  };

  // Show unauthenticated fallback with FAQ and contact info
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare className="w-8 h-8 text-blue-400" />
              <h1 className="text-3xl font-bold text-white">Support Center</h1>
            </div>
            <p className="text-slate-400">Get help and manage your support tickets</p>
          </div>
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-slate-500 mx-auto mb-4 opacity-50" />
                <h2 className="text-xl font-semibold text-white mb-2">Sign in to manage support tickets</h2>
                <p className="text-slate-400 mb-6">Create and track your support requests after signing in.</p>
                <Link href="/login">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { q: "How long does payment processing take?", a: "Most payments are processed within 2-3 business days." },
                  { q: "What documents do I need for KYC verification?", a: "You'll need a valid ID and proof of address. Upload via your profile." },
                  { q: "Can I reschedule my payment date?", a: "Yes, contact support or use the payment schedule adjustment feature." },
                ].map((faq, idx) => (
                  <div key={idx} className="border-t border-slate-600 pt-4">
                    <h4 className="text-white font-medium mb-2">{faq.q}</h4>
                    <p className="text-slate-400 text-sm">{faq.a}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <SEOHead
        title="Support Center"
        description="Get help with your AmeriLend account, loans, and payments. Submit a support ticket or browse FAQs for quick answers."
        path="/support"
      />
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare className="w-8 h-8 text-blue-400" />
              <h1 className="text-3xl font-bold text-white">Support Center</h1>
            </div>
            <p className="text-slate-400">Get help and manage your support tickets</p>
          </div>
          <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle>Create New Support Ticket</DialogTitle>
                <DialogDescription>
                  Describe your issue and we'll get back to you soon
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Subject</label>
                  <Input
                    {...form.register("subject")}
                    placeholder="Brief subject of your issue"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  {form.formState.errors.subject && (
                    <p className="text-red-400 text-xs mt-1">{form.formState.errors.subject.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Category</label>
                  <select
                    {...form.register("category")}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2"
                    aria-label="Support ticket category"
                  >
                    <option value="billing">Payment & Billing</option>
                    <option value="loan">Loan Application</option>
                    <option value="account">KYC Verification</option>
                    <option value="technical">Technical Issue</option>
                    <option value="other">Other</option>
                  </select>
                  {form.formState.errors.category && (
                    <p className="text-red-400 text-xs mt-1">{form.formState.errors.category.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Description</label>
                  <Textarea
                    {...form.register("description")}
                    placeholder="Describe your issue in detail"
                    className="bg-slate-700 border-slate-600 text-white min-h-24"
                  />
                  {form.formState.errors.description && (
                    <p className="text-red-400 text-xs mt-1">{form.formState.errors.description.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={createTicketMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {createTicketMutation.isPending ? "Creating..." : "Submit Ticket"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">
                  {allTickets.length}
                </p>
                <p className="text-slate-400 text-sm">Total Tickets</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">
                  {allTickets.filter((t) => t.status === "in-progress").length}
                </p>
                <p className="text-slate-400 text-sm">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">
                  {allTickets.filter((t) => t.status === "resolved").length}
                </p>
                <p className="text-slate-400 text-sm">Resolved</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-400">2d</p>
                <p className="text-slate-400 text-sm">Avg Response Time</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tickets */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle>Your Support Tickets</CardTitle>
            <CardDescription>Track and manage your support requests</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="open">Open & In Progress</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
              </TabsList>

              <TabsContent value={filter} className="space-y-3">
                {filteredTickets.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
                    <p className="text-slate-400">No tickets found</p>
                  </div>
                ) : (
                  filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className="p-4 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 cursor-pointer transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="mt-1">{getStatusIcon(ticket.status)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-white font-semibold group-hover:text-blue-400">
                                {ticket.subject}
                              </h3>
                              <code className="text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded">
                                {ticket.id}
                              </code>
                            </div>
                            <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                              {ticket.description}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <span>Created: {ticket.createdAt}</span>
                              <span>•</span>
                              <span>Updated: {ticket.lastUpdated}</span>
                              <span>•</span>
                              <MessageSquare className="w-3 h-3" />
                              <span>{ticket.messageCount} messages</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end flex-shrink-0 ml-4">
                          <div className="flex gap-2">
                            {getStatusBadge(ticket.status)}
                            {getPriorityBadge(ticket.priority)}
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-400" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedTicket && getStatusIcon(selectedTicket.status)}
                {selectedTicket?.subject}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <code className="text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded">{selectedTicket?.id}</code>
                {selectedTicket && getStatusBadge(selectedTicket.status)}
                {selectedTicket && getPriorityBadge(selectedTicket.priority)}
              </DialogDescription>
            </DialogHeader>

            {/* Original description */}
            <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
              <p className="text-xs text-slate-400 mb-1">Original Description</p>
              <p className="text-slate-200 text-sm">{selectedTicket?.description}</p>
              <p className="text-xs text-slate-500 mt-2">Created: {selectedTicket?.createdAt}</p>
            </div>

            {/* Messages thread */}
            <ScrollArea className="flex-1 max-h-[300px]">
              <div className="space-y-3 pr-4">
                {ticketMessages.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">No replies yet</p>
                ) : (
                  ticketMessages.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg text-sm ${
                        msg.isFromAdmin
                          ? "bg-blue-900/40 border border-blue-700 ml-4"
                          : "bg-slate-700 border border-slate-600 mr-4"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold ${msg.isFromAdmin ? "text-blue-400" : "text-green-400"}`}>
                          {msg.isFromAdmin ? "Support Agent" : "You"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-200">{msg.message}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Reply input */}
            {selectedTicket && !["resolved", "closed"].includes(selectedTicket.status) && (
              <div className="flex gap-2 pt-2 border-t border-slate-600">
                <Input
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply..."
                  className="bg-slate-700 border-slate-600 text-white flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                />
                <Button
                  onClick={handleSendReply}
                  disabled={!replyMessage.trim() || addMessageMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* FAQ Section */}
        <Card className="bg-slate-800 border-slate-700 mt-6">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  q: "How long does payment processing take?",
                  a: "Most payments are processed within 2-3 business days.",
                },
                {
                  q: "What documents do I need for KYC verification?",
                  a: "You'll need a valid ID and proof of address. Upload via your profile.",
                },
                {
                  q: "Can I reschedule my payment date?",
                  a: "Yes, contact support or use the payment schedule adjustment feature.",
                },
              ].map((faq, idx) => (
                <div key={idx} className="border-t border-slate-600 pt-4">
                  <h4 className="text-white font-medium mb-2">{faq.q}</h4>
                  <p className="text-slate-400 text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SupportCenter;
