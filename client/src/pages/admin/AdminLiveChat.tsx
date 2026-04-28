import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Loader2, Send, MessageCircle, Clock, User, Search,
  CheckCircle2, XCircle, Zap, ArrowLeft, RefreshCw
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

export default function AdminLiveChat() {
  const utils = trpc.useUtils();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [cannedOpen, setCannedOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch active sessions - polls every 5s
  const { data: sessions, isLoading: sessionsLoading } = trpc.liveChat.getActiveSessions.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Fetch messages for selected session - polls every 2s
  const { data: chatMessages, isLoading: messagesLoading } = trpc.liveChat.getMessages.useQuery(
    { sessionId: selectedSessionId ?? 0 },
    {
      enabled: !!selectedSessionId,
      refetchInterval: 2000,
    }
  );

  // Fetch canned responses
  const { data: cannedResponses } = trpc.liveChat.getCannedResponses.useQuery();

  const sendMutation = trpc.liveChat.sendMessage.useMutation({
    onSuccess: () => {
      utils.liveChat.getMessages.invalidate();
      setMessage("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Could not send message.");
    },
  });

  const assignMutation = trpc.liveChat.assignToAgent.useMutation({
    onSuccess: () => {
      utils.liveChat.getActiveSessions.invalidate();
      toast.success("Session assigned to you.");
    },
  });

  const closeMutation = trpc.liveChat.closeSession.useMutation({
    onSuccess: () => {
      utils.liveChat.getActiveSessions.invalidate();
      utils.liveChat.getMessages.invalidate();
      toast.success("Chat session closed.");
      setSelectedSessionId(null);
    },
  });

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // Filter sessions by search term
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    const list = sessions as any[];
    if (!searchTerm) return list;
    const lower = searchTerm.toLowerCase();
    return list.filter(
      (s: any) =>
        (s.userName || "").toLowerCase().includes(lower) ||
        (s.userEmail || "").toLowerCase().includes(lower) ||
        String(s.id).includes(lower)
    );
  }, [sessions, searchTerm]);

  const selectedSession = useMemo(() => {
    if (!sessions || !selectedSessionId) return null;
    return (sessions as any[]).find((s: any) => s.id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && selectedSessionId) {
      sendMutation.mutate({
        sessionId: selectedSessionId,
        message: message.trim(),
        isFromAgent: true,
      });
    }
  };

  const handleUseCannedResponse = (text: string) => {
    setMessage(text);
    setCannedOpen(false);
  };

  const handleAssignToMe = () => {
    if (selectedSessionId) {
      assignMutation.mutate({ sessionId: selectedSessionId });
    }
  };

  const totalActive = (sessions as any[])?.length || 0;
  const unassigned = (sessions as any[])?.filter((s: any) => !s.assignedToAgentId).length || 0;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="mb-3" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MessageCircle className="h-7 w-7 text-primary" />
          </div>
          Live Chat – Admin
        </h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            {totalActive} active session{totalActive !== 1 ? "s" : ""}
          </span>
          {unassigned > 0 && (
            <span className="flex items-center gap-1.5 text-yellow-600">
              <Clock className="h-3.5 w-3.5" />
              {unassigned} unassigned
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[700px]">
        {/* Sessions List */}
        <Card className="lg:col-span-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {sessionsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No active chats</p>
                <p className="text-xs mt-1">Sessions will appear here when users start a chat.</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredSessions.map((session: any) => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full text-left p-3 transition-colors hover:bg-muted/50 ${
                      selectedSessionId === session.id ? "bg-primary/5 border-l-2 border-primary" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium truncate max-w-[130px]">
                            {session.userName || session.userEmail || `User #${session.userId}`}
                          </p>
                          {session.userEmail && session.userName && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                              {session.userEmail}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {session.assignedToAgentId ? (
                          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                            Assigned
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse">
                            Waiting
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 pl-10">
                      {session.startedAt
                        ? formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })
                        : "Just now"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Chat Window */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          {!selectedSessionId ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
                <h3 className="text-lg font-medium mb-1">Select a chat</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a session from the left panel to start responding.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-3 border-b bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {selectedSession?.userName || selectedSession?.userEmail || `User #${selectedSession?.userId}`}
                    </p>
                    {selectedSession?.userEmail && (
                      <p className="text-[11px] text-muted-foreground">
                        {selectedSession.userEmail}
                        {selectedSession?.startedAt &&
                          ` · Started ${format(new Date(selectedSession.startedAt), "MMM d, h:mm a")}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!selectedSession?.assignedToAgentId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAssignToMe}
                      disabled={assignMutation.isPending}
                      className="text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Assign to Me
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => closeMutation.mutate({ sessionId: selectedSessionId })}
                    disabled={closeMutation.isPending}
                    className="text-xs text-destructive hover:text-destructive"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Close
                  </Button>
                </div>
              </div>

              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4 bg-muted/20">
                <div className="space-y-3">
                  {messagesLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : chatMessages && (chatMessages as any[]).length > 0 ? (
                    (chatMessages as any[]).map((msg: any) => {
                      const isAdmin = !!msg.isFromAgent;
                      return (
                        <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[75%] px-4 py-2.5 ${
                              isAdmin
                                ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                                : "bg-white border shadow-sm rounded-2xl rounded-tl-sm"
                            }`}
                          >
                            {!isAdmin && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <User className="h-3 w-3 text-blue-600" />
                                <span className="text-xs font-medium text-blue-600">
                                  {msg.senderName || "Customer"}
                                </span>
                              </div>
                            )}
                            {isAdmin && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-xs font-medium text-primary-foreground/70">
                                  You ({msg.senderName || "Admin"})
                                </span>
                              </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            <p
                              className={`text-[10px] mt-1 ${
                                isAdmin ? "text-primary-foreground/60" : "text-muted-foreground"
                              }`}
                            >
                              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                      <p>No messages yet.</p>
                      <p className="text-xs mt-1">The customer is waiting for a response.</p>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              {/* Input + Canned Responses */}
              <form onSubmit={handleSend} className="p-3 border-t bg-white">
                <div className="flex items-center gap-2">
                  {/* Canned Responses Button */}
                  <Dialog open={cannedOpen} onOpenChange={setCannedOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 h-10 w-10 rounded-full"
                        title="Canned Responses"
                      >
                        <Zap className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Canned Responses</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="max-h-[300px]">
                        {cannedResponses && (cannedResponses as any[]).length > 0 ? (
                          <div className="space-y-2">
                            {(cannedResponses as any[]).map((cr: any) => (
                              <button
                                key={cr.id}
                                type="button"
                                onClick={() => handleUseCannedResponse(cr.message)}
                                className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-[10px]">
                                    {cr.category || "General"}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    /{cr.shortcut}
                                  </span>
                                </div>
                                <p className="font-medium text-sm">{cr.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {cr.message}
                                </p>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-6">
                            No canned responses yet.
                          </p>
                        )}
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>

                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a reply..."
                    disabled={sendMutation.isPending}
                    className="flex-1 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
                  />
                  <Button
                    type="submit"
                    disabled={!message.trim() || sendMutation.isPending}
                    size="icon"
                    className="rounded-full h-10 w-10 shrink-0"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
