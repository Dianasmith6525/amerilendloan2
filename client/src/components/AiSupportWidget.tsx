import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Send, Loader2, Phone, Mail, User, RotateCcw, Shield, ArrowRight, CreditCard, FileText, HelpCircle, Zap } from "lucide-react";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";
import {
  COMPANY_PHONE_DISPLAY_SHORT,
  COMPANY_PHONE_RAW,
  COMPANY_SUPPORT_EMAIL,
  SUPPORT_HOURS_WEEKDAY,
  SUPPORT_HOURS_WEEKEND,
} from "@/const";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiSupportWidgetProps {
  isAuthenticated?: boolean;
  userName?: string;
}

/* ─── Kai Avatar (reusable) ───────────────────────────────── */
function KaiAvatar({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "w-6 h-6", md: "w-10 h-10", lg: "w-14 h-14 sm:w-16 sm:h-16" };
  const iconMap = { sm: "w-3 h-3", md: "w-5 h-5", lg: "w-7 h-7 sm:w-8 sm:h-8" };
  return (
    <span className={`${sizeMap[size]} shrink-0 rounded-full bg-gradient-to-br from-[#C9A227] to-[#e6c84d] flex items-center justify-center shadow-md`}>
      <Zap className={`${iconMap[size]} text-[#0A2540]`} strokeWidth={2.5} />
    </span>
  );
}

export default function AiSupportWidget({ isAuthenticated = false, userName }: AiSupportWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showHumanSupport, setShowHumanSupport] = useState(false);
  const [loanSummary, setLoanSummary] = useState<{
    status?: string;
    trackingNumber?: string;
    loanCount?: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const chatMutation = trpc.system.chatWithAi.useMutation();
  const suggestedPromptsQuery = trpc.system.getSuggestedPrompts.useQuery(undefined, {
    enabled: isOpen && messages.length === 0,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (message?: string) => {
    const userMessage = message || input.trim();
    if (!userMessage) return;

    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setInput("");

    try {
      const response = await chatMutation.mutateAsync({
        message: userMessage,
        conversationHistory: messages,
      });

      // Capture loan context from first response
      if (!loanSummary && response.userContext && response.isAuthenticated) {
        const ctx = response.userContext as Record<string, any>;
        setLoanSummary({
          status: ctx.loanStatus,
          trackingNumber: ctx.trackingNumber,
          loanCount: ctx.loanCount,
        });
      }

      setMessages([...newMessages, { role: "assistant", content: response.message }]);
    } catch (error) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `I apologize, but I'm having trouble connecting right now. Please try again or contact support at ${COMPANY_SUPPORT_EMAIL} or ${COMPANY_PHONE_DISPLAY_SHORT}.`,
        },
      ]);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    handleSend(prompt);
  };

  const handleClearConversation = () => {
    setMessages([]);
    setLoanSummary(null);
  };

  // Format loan status for display
  const formatStatus = (status?: string) => {
    if (!status) return "Unknown";
    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Quick action buttons for authenticated users
  const authQuickActions = [
    { label: "Loan Status", icon: FileText, prompt: "What's my current loan status?" },
    { label: "Payments", icon: CreditCard, prompt: "How do I make a payment?" },
    { label: "Help", icon: HelpCircle, prompt: "I need help with my account" },
  ];

  // Quick action buttons for unauthenticated users
  const guestQuickActions = [
    { label: "Apply Now", icon: ArrowRight, prompt: "How do I apply for a loan?" },
    { label: "Eligibility", icon: Shield, prompt: "What are the eligibility requirements?" },
    { label: "Rates", icon: FileText, prompt: "What interest rates do you offer?" },
  ];

  const quickActions = isAuthenticated ? authQuickActions : guestQuickActions;

  return (
    <>
      {/* ─── Advanced Floating Kai Button ───────────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 group"
          aria-label="Open Kai AI Support"
        >
          {/* Outer pulse ring */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#C9A227] to-[#0033A0] opacity-40 animate-ping" />
          {/* Rotating glow ring */}
          <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#C9A227] via-[#0055CC] to-[#C9A227] opacity-30 blur-sm group-hover:opacity-50 transition-opacity animate-[spin_6s_linear_infinite]" />
          {/* Main button body */}
          <span className="relative flex items-center gap-2 bg-gradient-to-br from-[#0A2540] via-[#0033A0] to-[#0055CC] text-white rounded-full px-4 py-3 sm:py-3.5 shadow-xl shadow-blue-900/30 transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-blue-800/40">
            {/* Kai medallion */}
            <span className="relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-[#C9A227] to-[#e6c84d] shadow-inner">
              <Zap className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-[#0A2540]" strokeWidth={2.5} />
            </span>
            {/* Label */}
            <span className="font-semibold text-sm sm:text-base tracking-wide">Kai</span>
            {/* Online dot */}
            {isAuthenticated && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
            )}
          </span>
        </button>
      )}

      {/* ─── Chat Panel ──────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[420px] max-h-[85vh] sm:max-h-none sm:max-w-[calc(100vw-3rem)] shadow-2xl">
          <Card className="h-full sm:h-[600px] sm:max-h-[calc(100vh-3rem)] flex flex-col rounded-t-xl sm:rounded-xl overflow-hidden border-0 sm:border">
            {/* Header */}
            <CardHeader className="text-white p-3 sm:p-4 flex flex-col space-y-0 bg-gradient-to-r from-[#0A2540] via-[#0033A0] to-[#0055CC]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <KaiAvatar size="md" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0A2540]" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg leading-tight flex items-center gap-1.5">
                      Kai
                      {isAuthenticated && (
                        <Badge className="bg-white/20 text-white/90 text-[9px] px-1.5 py-0 font-normal border-0">
                          PRO
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-[10px] sm:text-xs text-white/60 mt-0.5">
                      {isAuthenticated ? "Your personal AI assistant" : "AmeriLend AI Support"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button
                      onClick={handleClearConversation}
                      className="hover:bg-white/20 rounded-full p-1.5 transition-colors"
                      aria-label="Clear conversation"
                      title="New conversation"
                    >
                      <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="hover:bg-white/20 rounded-full p-1.5 transition-colors"
                    aria-label="Close chat"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>

              {/* Auth status banner — shown when chat first opened with loan context */}
              {isAuthenticated && loanSummary?.status && messages.length > 0 && (
                <div className="mt-2 flex items-center gap-2 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs">
                  <Shield className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {loanSummary.trackingNumber && (
                      <span className="font-mono text-white/90">{loanSummary.trackingNumber}</span>
                    )}
                    {loanSummary.status && (
                      <Badge variant="outline" className="ml-2 text-[10px] border-white/40 text-white/90 py-0 px-1.5">
                        {formatStatus(loanSummary.status)}
                      </Badge>
                    )}
                  </span>
                </div>
              )}
            </CardHeader>

            {/* Messages Area */}
            <CardContent className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2.5 sm:space-y-4 bg-gray-50 dark:bg-gray-900/50">
              {/* Welcome State */}
              {messages.length === 0 && (
                <div className="text-center py-3 sm:py-6">
                  <div className="relative inline-block mb-2 sm:mb-4">
                    <KaiAvatar size="lg" />
                    {/* Decorative spinning dashed ring */}
                    <span className="absolute -inset-1.5 rounded-full border-2 border-dashed border-[#C9A227]/30 animate-[spin_12s_linear_infinite]" />
                  </div>

                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1 text-sm sm:text-base">
                    {isAuthenticated
                      ? `Hey${userName ? ` ${userName}` : ""}! I'm Kai`
                      : "Hi! I'm Kai, your AI assistant"}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3 sm:mb-4 px-2">
                    {isAuthenticated
                      ? "I have access to your account, loan status, and tracking details. Ask me anything!"
                      : "Learn about loans, check eligibility, or get application guidance."}
                  </p>

                  {/* Auth badge */}
                  {isAuthenticated && (
                    <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-medium mb-3 sm:mb-4">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Priority Support Active
                    </div>
                  )}

                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                    {quickActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestedPrompt(action.prompt)}
                        className="flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-700 hover:border-[#C9A227]/50 rounded-lg transition-colors text-center group"
                      >
                        <action.icon className="w-4 h-4 text-[#0033A0] dark:text-blue-400 group-hover:text-[#C9A227] transition-colors" />
                        <span className="text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 font-medium">{action.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Suggested Prompts */}
                  {suggestedPromptsQuery.data && suggestedPromptsQuery.data.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-gray-400 mb-2">Or ask Kai about:</p>
                      {suggestedPromptsQuery.data.slice(0, 3).map((prompt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestedPrompt(prompt)}
                          className="w-full text-left p-2 sm:p-2.5 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-700 hover:border-[#C9A227]/40 rounded-lg text-xs transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Guest CTA */}
                  {!isAuthenticated && (
                    <div className="mt-4 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        <strong>Already have an account?</strong> Log in for personalized support with access to your loan details.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Messages */}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}
                >
                  {msg.role === "assistant" && (
                    <div className="mt-1">
                      <KaiAvatar size="sm" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm ${
                      msg.role === "user"
                        ? "bg-[#0033A0] text-white rounded-br-sm"
                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 shrink-0 mt-1 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <User className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {chatMutation.isPending && (
                <div className="flex justify-start gap-2">
                  <div className="mt-1">
                    <KaiAvatar size="sm" />
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2.5 sm:p-3 rounded-lg rounded-bl-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400 mr-1">Kai is typing</span>
                      <span className="w-1.5 h-1.5 bg-[#C9A227] rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-[#C9A227] rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-[#C9A227] rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input Area */}
            <div className="p-3 sm:p-4 border-t bg-white dark:bg-gray-900">
              {showHumanSupport ? (
                /* Human Support Options */
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm sm:text-base flex items-center gap-2">
                      <User className="w-4 h-4 text-[#0033A0]" />
                      Talk to Human Agent
                    </h3>
                    <button
                      onClick={() => setShowHumanSupport(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    >
                      Back to Kai
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <a
                      href={`tel:${COMPANY_PHONE_RAW}`}
                      className="flex items-center gap-3 p-3 bg-[#0033A0] hover:bg-[#002080] text-white rounded-lg transition-colors"
                    >
                      <Phone className="w-5 h-5" />
                      <div className="text-left">
                        <p className="font-semibold text-sm">Call Us</p>
                        <p className="text-xs opacity-90">{COMPANY_PHONE_DISPLAY_SHORT}</p>
                      </div>
                    </a>
                    
                    <a
                      href={`mailto:${COMPANY_SUPPORT_EMAIL}`}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
                    >
                      <Mail className="w-5 h-5 text-[#0033A0]" />
                      <div className="text-left">
                        <p className="font-semibold text-sm">Email Us</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{COMPANY_SUPPORT_EMAIL}</p>
                      </div>
                    </a>
                  </div>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                    Available {SUPPORT_HOURS_WEEKDAY} and {SUPPORT_HOURS_WEEKEND}
                  </p>
                </div>
              ) : (
                /* Chat Input */
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={isAuthenticated ? "Ask Kai about your loan, payments..." : "Ask Kai about loans, eligibility..."}
                      className="flex-1 px-3 py-2 sm:px-4 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A227] focus:border-transparent bg-white dark:bg-gray-800 dark:text-gray-100"
                      disabled={chatMutation.isPending}
                      maxLength={2000}
                    />
                    <Button
                      type="submit"
                      disabled={!input.trim() || chatMutation.isPending}
                      className="bg-gradient-to-r from-[#0A2540] to-[#0033A0] hover:from-[#002080] hover:to-[#0055CC] text-white p-2 sm:px-4"
                    >
                      {chatMutation.isPending ? (
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </Button>
                  </form>
                  
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                      Powered by Kai AI {isAuthenticated && "• Account-aware"}
                    </p>
                    <button
                      onClick={() => setShowHumanSupport(true)}
                      className="text-xs text-[#0033A0] hover:text-[#002080] dark:text-blue-400 font-medium flex items-center gap-1"
                    >
                      <User className="w-3 h-3" />
                      Human Agent
                    </button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
