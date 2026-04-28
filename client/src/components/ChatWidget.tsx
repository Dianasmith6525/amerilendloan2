import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Loader2, Send, MessageCircle, X, Minus, Maximize2, User, Bot, Clock,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";

/**
 * Floating chat widget that appears on all pages for authenticated non-admin users.
 * Minimizes to a bubble in the bottom-right corner; expands into a mini chat window.
 */
export default function ChatWidget() {
  const { user, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [message, setMessage] = useState("");
  const [hasUnread, setHasUnread] = useState(false);
  const lastMsgCountRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Don't render for unauthenticated, admins, or if user is on the dedicated /chat page
  const isAdmin = user?.role === "admin";
  const isOnChatPage = location === "/chat";
  const isOnAdminPage = location.startsWith("/admin");
  const shouldHide = !isAuthenticated || isAdmin || isOnChatPage || isOnAdminPage;

  // Get or create session (only when widget is open)
  const { data: session } = trpc.liveChat.getOrCreateSession.useQuery(undefined, {
    enabled: !shouldHide && open,
    refetchInterval: open ? 5000 : false,
  });

  const sessionId = (session as any)?.id;
  const isAgentAssigned = !!(session as any)?.assignedToAgentId;

  // Fetch messages (only when widget is expanded)
  const { data: messages } = trpc.liveChat.getMessages.useQuery(
    { sessionId: sessionId ?? 0 },
    {
      enabled: !!sessionId && open && !minimized,
      refetchInterval: 2000,
    }
  );

  // Track unread messages
  useEffect(() => {
    if (!messages) return;
    const msgList = messages as any[];
    const agentMsgCount = msgList.filter((m: any) => m.isFromAgent).length;
    if (agentMsgCount > lastMsgCountRef.current && !open) {
      setHasUnread(true);
    }
    lastMsgCountRef.current = agentMsgCount;
  }, [messages, open]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  // Clear unread when opening
  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        setHasUnread(false);
        setMinimized(false);
      }
      return !prev;
    });
  }, []);

  const sendMutation = trpc.liveChat.sendMessage.useMutation({
    onSuccess: () => {
      utils.liveChat.getMessages.invalidate();
      setMessage("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send message.");
    },
  });

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

  if (shouldHide) return null;

  return (
    <>
      {/* Chat Window */}
      {open && !minimized && (
        <div
          className="fixed bottom-20 right-4 z-[9999] w-[360px] max-w-[calc(100vw-2rem)] h-[480px]
            bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden
            animate-in slide-in-from-bottom-4 fade-in duration-200"
        >
          {/* Header */}
          <div className="p-3 bg-primary text-primary-foreground flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">AmeriLend Support</p>
                <p className="text-[11px] opacity-80">
                  {isAgentAssigned ? "Agent connected" : "Connecting..."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary-foreground hover:bg-white/20"
                onClick={() => setMinimized(true)}
                title="Minimize"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary-foreground hover:bg-white/20"
                onClick={() => {
                  navigate("/chat");
                }}
                title="Open full page"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary-foreground hover:bg-white/20"
                onClick={toggleOpen}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-3 bg-muted/20">
            <div className="space-y-2.5">
              {/* Welcome */}
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-3 py-2 bg-white border shadow-sm">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Bot className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-medium text-primary">Support</span>
                  </div>
                  <p className="text-xs">Hi there! 👋 How can we help you today?</p>
                </div>
              </div>

              {messages && (messages as any[]).length > 0 ? (
                (messages as any[]).map((msg: any) => {
                  const isFromUser = !msg.isFromAgent;
                  return (
                    <div key={msg.id} className={`flex ${isFromUser ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] px-3 py-2 ${
                          isFromUser
                            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                            : "bg-white border shadow-sm rounded-2xl rounded-tl-sm"
                        }`}
                      >
                        {!isFromUser && (
                          <div className="flex items-center gap-1 mb-0.5">
                            <User className="h-2.5 w-2.5 text-primary" />
                            <span className="text-[10px] font-medium text-primary">
                              {msg.senderName || "Agent"}
                            </span>
                          </div>
                        )}
                        <p className="text-xs whitespace-pre-wrap">{msg.message}</p>
                        <p className={`text-[9px] mt-0.5 ${isFromUser ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-3 text-muted-foreground text-xs">
                  Send a message to get started.
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSend} className="p-2.5 border-t bg-white">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={sendMutation.isPending}
                className="flex-1 h-9 text-sm rounded-full bg-muted/50 border-0 focus-visible:ring-1"
              />
              <Button
                type="submit"
                disabled={!message.trim() || sendMutation.isPending}
                size="icon"
                className="rounded-full h-9 w-9 shrink-0"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Minimized bar */}
      {open && minimized && (
        <div
          className="fixed bottom-20 right-4 z-[9999] w-[280px] bg-primary text-primary-foreground
            rounded-full shadow-lg flex items-center gap-2 px-4 py-2.5 cursor-pointer
            hover:opacity-90 transition-opacity animate-in slide-in-from-bottom-2"
          onClick={() => setMinimized(false)}
        >
          <MessageCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium truncate">Support Chat</span>
          {isAgentAssigned && (
            <span className="w-2 h-2 rounded-full bg-green-400 shrink-0 ml-auto" />
          )}
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={toggleOpen}
        className={`fixed bottom-4 right-4 z-[9999] w-14 h-14 rounded-full shadow-lg
          flex items-center justify-center transition-all duration-200
          ${open ? "bg-muted hover:bg-muted/80" : "bg-primary hover:bg-primary/90 text-primary-foreground"}
          `}
        aria-label={open ? "Close chat" : "Open live chat"}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-bounce">
                !
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}
