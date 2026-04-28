import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Send, MessageCircle, Clock, User, Bot, ArrowLeft } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";

export default function LiveChat() {
  const utils = trpc.useUtils();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: session, isLoading: sessionLoading } = trpc.liveChat.getOrCreateSession.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const sessionId = (session as any)?.id;
  const sessionStatus = (session as any)?.status;

  const { data: messages, isLoading: messagesLoading } = trpc.liveChat.getMessages.useQuery(
    { sessionId: sessionId ?? 0 },
    {
      enabled: !!sessionId,
      refetchInterval: 2000,
    }
  );

  const sendMutation = trpc.liveChat.sendMessage.useMutation({
    onSuccess: () => {
      utils.liveChat.getMessages.invalidate();
      setMessage("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Could not send message.");
    },
  });

  const closeMutation = trpc.liveChat.closeSession.useMutation({
    onSuccess: () => {
      utils.liveChat.getOrCreateSession.invalidate();
      toast.success("Chat session closed.");
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && sessionId) {
      sendMutation.mutate({
        sessionId,
        message: message.trim(),
        isFromAgent: false,
      });
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAgentAssigned = !!(session as any)?.assignedToAgentId;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="mb-3" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MessageCircle className="h-7 w-7 text-primary" />
          </div>
          Live Chat Support
        </h1>
        <p className="text-muted-foreground">
          Chat with our support team in real time.
        </p>
      </div>

      <Card className="flex flex-col h-[600px] shadow-lg overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                isAgentAssigned ? "bg-green-500" : "bg-yellow-500"
              }`} />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {isAgentAssigned ? "Support Agent" : "AmeriLend Support"}
              </p>
              {!isAgentAssigned && sessionStatus !== "closed" ? (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs mt-0.5">
                  <Clock className="h-3 w-3 mr-1" />
                  Connecting to agent...
                </Badge>
              ) : isAgentAssigned && sessionStatus !== "closed" ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 inline-block" />
                  Agent connected
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-gray-100 text-gray-500 text-xs mt-0.5">
                  Session ended
                </Badge>
              )}
            </div>
          </div>
          {sessionStatus !== "closed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => sessionId && closeMutation.mutate({ sessionId })}
              disabled={closeMutation.isPending}
              className="text-xs"
            >
              End Chat
            </Button>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4 bg-muted/20">
          <div className="space-y-3">
            {/* Welcome message */}
            <div className="flex justify-start">
              <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-2.5 bg-white border shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">AmeriLend Support</span>
                </div>
                <p className="text-sm">
                  Welcome to AmeriLend Live Chat! 👋 How can we help you today?
                  {!isAgentAssigned && " An agent will be with you shortly."}
                </p>
              </div>
            </div>

            {messagesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages && (messages as any[]).length > 0 ? (
              (messages as any[]).map((msg: any) => {
                const isFromUser = !msg.isFromAgent;
                return (
                  <div key={msg.id} className={`flex ${isFromUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] px-4 py-2.5 ${
                        isFromUser
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                          : "bg-white border shadow-sm rounded-2xl rounded-tl-sm"
                      }`}
                    >
                      {!isFromUser && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <User className="h-3 w-3 text-primary" />
                          <span className="text-xs font-medium text-primary">
                            {msg.senderName || "Agent"}
                          </span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${isFromUser ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        {msg.status === "read" && isFromUser && " · ✓ Read"}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Send a message to start the conversation.
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        {sessionStatus !== "closed" ? (
          <form onSubmit={handleSend} className="p-3 border-t bg-white">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
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
            {!isAgentAssigned && (
              <p className="text-[11px] text-muted-foreground mt-2 text-center">
                An agent will join shortly. Average response time: 2–5 minutes.
              </p>
            )}
          </form>
        ) : (
          <div className="p-4 border-t bg-white text-center">
            <p className="text-sm text-muted-foreground mb-3">This chat session has ended.</p>
            <Button
              onClick={() => {
                utils.liveChat.getOrCreateSession.invalidate();
                window.location.reload();
              }}
              size="sm"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Start New Chat
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4 mt-6 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm mb-1">Chat Support Hours</h3>
            <p className="text-xs text-muted-foreground">
              Mon–Fri: 8 AM – 8 PM EST &nbsp;|&nbsp; Sat–Sun: 10 AM – 6 PM EST
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Outside these hours, please submit a support ticket or email us.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
