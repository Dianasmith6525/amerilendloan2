import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function AdminSupportManagement() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [replyMessage, setReplyMessage] = useState("");

  // Fetch all tickets with optional status filter
  const { data: ticketsData, isLoading: ticketsLoading, refetch: refetchTickets } =
    trpc.supportTickets.adminGetAll.useQuery(
      { status: filterStatus === "all" ? undefined : filterStatus },
      { refetchInterval: 15000 }
    );

  // Fetch messages for selected ticket
  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } =
    trpc.supportTickets.getMessages.useQuery(
      { ticketId: selectedTicketId! },
      { enabled: !!selectedTicketId }
    );

  // Reply mutation
  const addMessage = trpc.supportTickets.addMessage.useMutation({
    onSuccess: () => {
      setReplyMessage("");
      refetchMessages();
      refetchTickets();
      toast.success("Reply sent");
    },
    onError: (err) => toast.error(err.message || "Failed to send reply"),
  });

  // Status update mutation
  const updateStatus = trpc.supportTickets.adminUpdateStatus.useMutation({
    onSuccess: () => {
      refetchTickets();
      refetchMessages();
      toast.success("Ticket status updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update status"),
  });

  const tickets: any[] = (ticketsData as any)?.data || ticketsData || [];
  const messages: any[] = (messagesData as any)?.data || messagesData || [];
  const selectedTicket = tickets.find((t: any) => t.id === selectedTicketId);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-blue-600">Open</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-600">In Progress</Badge>;
      case "waiting_customer":
        return <Badge className="bg-purple-600">Waiting</Badge>;
      case "resolved":
        return <Badge className="bg-green-600">Resolved</Badge>;
      case "closed":
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
      case "urgent":
        return <Badge variant="destructive">{priority.toUpperCase()}</Badge>;
      case "medium":
      case "normal":
        return <Badge className="bg-yellow-600">{priority.toUpperCase()}</Badge>;
      case "low":
        return <Badge variant="outline">{priority.toUpperCase()}</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "payment": return "💳";
      case "loan": return "🏦";
      case "kyc": return "📄";
      case "technical": return "⚙️";
      default: return "📋";
    }
  };

  const handleReply = () => {
    if (!replyMessage.trim() || !selectedTicketId) return;
    addMessage.mutate({
      ticketId: selectedTicketId,
      message: replyMessage.trim(),
    });
  };

  const handleStatusChange = (ticketId: number, newStatus: string) => {
    updateStatus.mutate({ id: ticketId, status: newStatus });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">Support Management</h1>
          </div>
          <p className="text-slate-400">Manage and respond to customer support tickets</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{tickets.length}</p>
                <p className="text-slate-400 text-sm">Total Tickets</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-400">
                  {tickets.filter((t: any) => t.status === "open").length}
                </p>
                <p className="text-slate-400 text-sm">Open</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-400">
                  {tickets.filter((t: any) => t.status === "in_progress").length}
                </p>
                <p className="text-slate-400 text-sm">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">
                  {tickets.filter((t: any) => t.status === "resolved").length}
                </p>
                <p className="text-slate-400 text-sm">Resolved</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ticket List */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Support Tickets</CardTitle>
                <CardDescription>Manage customer inquiries and issues</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchTickets()}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2"
                  aria-label="Filter by status"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting_customer">Waiting Customer</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ticketsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
                <p className="text-slate-400">No tickets found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket: any) => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedTicketId === ticket.id
                        ? "border-blue-500 bg-slate-700"
                        : "border-slate-600 bg-slate-700/50 hover:bg-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{getCategoryIcon(ticket.category)}</span>
                          <h3 className="text-white font-semibold">{ticket.subject}</h3>
                          <code className="text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded">
                            #{ticket.id}
                          </code>
                        </div>
                        <p className="text-slate-400 text-sm">
                          User ID: {ticket.userId}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket Details */}
        {selectedTicket && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-lg">{getCategoryIcon(selectedTicket.category)}</span>
                    {selectedTicket.subject}
                  </CardTitle>
                  <CardDescription>
                    Ticket #{selectedTicket.id} • User ID: {selectedTicket.userId}
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setSelectedTicketId(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Ticket Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-700/50 rounded-lg">
                <div>
                  <p className="text-slate-400 text-xs mb-1">Status</p>
                  <div className="text-white">{getStatusBadge(selectedTicket.status)}</div>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Priority</p>
                  <div className="text-white">{getPriorityBadge(selectedTicket.priority)}</div>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Category</p>
                  <p className="text-white text-sm capitalize">{selectedTicket.category?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Created</p>
                  <p className="text-white text-sm">{new Date(selectedTicket.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Quick Status Actions */}
              <div className="flex flex-wrap gap-2">
                <p className="text-slate-400 text-sm mr-2 self-center">Change Status:</p>
                {["open", "in_progress", "waiting_customer", "resolved", "closed"].map((s) => (
                  <Button
                    key={s}
                    variant={selectedTicket.status === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(selectedTicket.id, s)}
                    disabled={updateStatus.isPending || selectedTicket.status === s}
                  >
                    {s.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>

              {/* Description */}
              {selectedTicket.description && (
                <div className="p-3 bg-slate-700/30 border border-slate-600 rounded-lg">
                  <p className="text-slate-400 text-xs mb-1">Description</p>
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
              )}

              {/* Messages */}
              <div>
                <h3 className="text-white font-semibold mb-4">Conversation</h3>
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400 text-sm">No messages yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {messages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg ${
                          msg.isFromAdmin
                            ? "bg-blue-600/20 border border-blue-600/30"
                            : "bg-slate-700/30 border border-slate-600"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-medium text-sm">
                            {msg.isFromAdmin ? "Support Team" : `User #${msg.userId}`}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {msg.isFromAdmin ? "Support" : "Customer"}
                          </Badge>
                          <p className="text-xs text-slate-400">
                            {new Date(msg.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <p className="text-slate-300 text-sm whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply */}
              {selectedTicket.status !== "closed" && (
                <div className="pt-4 border-t border-slate-600 space-y-3">
                  <Textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Write your reply here..."
                    className="bg-slate-700 border-slate-600 text-white min-h-20"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleReply}
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={!replyMessage.trim() || addMessage.isPending}
                    >
                      {addMessage.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Send Reply
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleStatusChange(selectedTicket.id, "resolved");
                        setSelectedTicketId(null);
                      }}
                      className="flex-1"
                    >
                      Resolve & Close Ticket
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default AdminSupportManagement;
