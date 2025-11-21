import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MessageSquare, Clock, CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);

  // Fetch tickets from backend
  const { data: tickets = [], refetch } = trpc.userFeatures.support.listTickets.useQuery();

  // Create ticket mutation
  const createTicketMutation = trpc.userFeatures.support.createTicket.useMutation({
    onSuccess: () => {
      toast.success("Support ticket created successfully!");
      setShowNewTicket(false);
      refetch();
      form.reset();
    },
    onError: (error) => {
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

  // Mock data
  const mockTickets: SupportTicket[] = tickets.map((t: any) => ({
    id: `TKT-${String(t.id).padStart(3, "0")}`,
    subject: t.subject,
    description: t.description,
    status: t.status as "open" | "in-progress" | "resolved" | "closed",
    priority: "medium" as const,
    createdAt: new Date(t.createdAt).toLocaleDateString(),
    lastUpdated: new Date(t.updatedAt || t.createdAt).toLocaleDateString(),
    messageCount: 0,
  }));

  const filteredTickets =
    filter === "all"
      ? mockTickets
      : filter === "open"
        ? mockTickets.filter((t) => ["open", "in-progress"].includes(t.status))
        : mockTickets.filter((t) => ["resolved", "closed"].includes(t.status));

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
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
                  {mockTickets.length}
                </p>
                <p className="text-slate-400 text-sm">Total Tickets</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-400">
                  {mockTickets.filter((t) => t.status === "in-progress").length}
                </p>
                <p className="text-slate-400 text-sm">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">
                  {mockTickets.filter((t) => t.status === "resolved").length}
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
