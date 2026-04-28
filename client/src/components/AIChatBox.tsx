import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Send, User, Zap, HelpCircle, RotateCcw, Shield, ArrowRight, CreditCard, FileText } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message.
   * Typically you'll call a tRPC mutation here to invoke the LLM.
   */
  onSendMessage: (content: string) => void;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];

  /**
   * Whether user is authenticated
   */
  isAuthenticated?: boolean;

  /**
   * User's display name for personalized greeting
   */
  userName?: string;

  /**
   * Callback to clear/reset the conversation
   */
  onClearConversation?: () => void;
};

/**
 * A ready-to-use AI chat box component that integrates with the comprehensive LLM system.
 *
 * Features:
 * - Comprehensive customer support A-Z
 * - Personalized assistance for authenticated users
 * - Markdown rendering with Streamdown
 * - Auto-scrolls to latest message
 * - Loading states
 * - Suggested prompts based on authentication status
 * - Uses global theme colors from index.css
 */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder,
  className,
  height = "600px",
  emptyStateMessage,
  suggestedPrompts,
  isAuthenticated = false,
  userName,
  onClearConversation,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [localSuggestedPrompts, setLocalSuggestedPrompts] = useState<string[]>(suggestedPrompts || []);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch suggested prompts from server
  const { data: serverSuggestedPrompts } = trpc.ai.getSuggestedPrompts.useQuery();

  useEffect(() => {
    if (serverSuggestedPrompts) {
      setLocalSuggestedPrompts(serverSuggestedPrompts);
    }
  }, [serverSuggestedPrompts]);

  // Filter out system messages
  const displayMessages = messages.filter((msg) => msg.role !== "system");

  // Calculate min-height for last assistant message to push user message to top
  const [minHeightForLastMessage, setMinHeightForLastMessage] = useState(0);

  useEffect(() => {
    if (containerRef.current && inputAreaRef.current) {
      const containerHeight = containerRef.current.offsetHeight;
      const inputHeight = inputAreaRef.current.offsetHeight;
      const scrollAreaHeight = containerHeight - inputHeight;

      // Reserve space for:
      // - padding (p-4 = 32px top+bottom)
      // - user message: 40px (item height) + 16px (margin-top from space-y-4) = 56px
      const userMessageReservedHeight = 56;
      const calculatedHeight = scrollAreaHeight - 32 - userMessageReservedHeight;

      setMinHeightForLastMessage(Math.max(0, calculatedHeight));
    }
  }, []);

  // Scroll to bottom helper function with smooth animation
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  };

  // Auto-scroll when new messages arrive (assistant responses)
  useEffect(() => {
    if (displayMessages.length > 0) {
      scrollToBottom();
    }
  }, [displayMessages.length, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    onSendMessage(trimmedInput);
    setInput("");

    // Scroll immediately after sending
    scrollToBottom();

    // Keep focus on input
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const defaultPlaceholder = isAuthenticated
    ? "Ask Kai about your loan, payments, account..."
    : "Ask Kai about loans, eligibility, rates...";

  const defaultEmptyStateMessage = isAuthenticated
    ? `Hey${userName ? ` ${userName}` : ""}! I'm Kai, your priority AI assistant with access to your account details.`
    : "Hi! I'm Kai, AmeriLend's AI assistant. I can help with loan applications, payments, eligibility, and more.";

  // Quick action buttons for authenticated users
  const authQuickActions = [
    { label: "Loan Status", icon: FileText, prompt: "What's my current loan status?" },
    { label: "Make Payment", icon: CreditCard, prompt: "How do I make a payment?" },
    { label: "Account Help", icon: HelpCircle, prompt: "I need help with my account" },
  ];

  const guestQuickActions = [
    { label: "Apply for Loan", icon: ArrowRight, prompt: "How do I apply for a loan?" },
    { label: "Check Eligibility", icon: Shield, prompt: "What are the eligibility requirements?" },
    { label: "View Rates", icon: FileText, prompt: "What interest rates do you offer?" },
  ];

  const quickActions = isAuthenticated ? authQuickActions : guestQuickActions;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-card text-card-foreground rounded-lg border shadow-sm",
        className
      )}
      style={{ height }}
    >
      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <div className={`relative p-3 rounded-full ${
                  isAuthenticated 
                    ? "bg-gradient-to-br from-[#C9A227]/20 to-[#e6c84d]/20" 
                    : "bg-[#C9A227]/10"
                }`}>
                  <span className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#C9A227] to-[#e6c84d] shadow-md">
                    <Zap className="w-5 h-5 text-[#0A2540]" strokeWidth={2.5} />
                  </span>
                  {isAuthenticated && (
                    <div className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background animate-pulse"></div>
                  )}
                </div>
                <p className="text-sm text-center font-medium max-w-sm">
                  {emptyStateMessage || defaultEmptyStateMessage}
                </p>
                {isAuthenticated && (
                  <div className="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-xs font-medium">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Priority Support Active
                  </div>
                )}
                {!isAuthenticated && (
                  <p className="text-xs text-muted-foreground/70 max-w-xs text-center">
                    Log in for personalized support with access to your loan details and tracking numbers.
                  </p>
                )}
              </div>

              {/* Quick Action Buttons */}
              <div className="flex max-w-sm w-full gap-2">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => onSendMessage(action.prompt)}
                    disabled={isLoading}
                    className="flex-1 flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-2.5 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <action.icon className="size-4 text-primary" />
                    <span className="font-medium text-[11px]">{action.label}</span>
                  </button>
                ))}
              </div>

              {localSuggestedPrompts && localSuggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {localSuggestedPrompts.slice(0, 4).map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1"
                    >
                      <HelpCircle className="size-3" />
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 p-4">
              {displayMessages.map((message, index) => {
                // Apply min-height to last message only if NOT loading
                const isLastMessage = index === displayMessages.length - 1;
                const shouldApplyMinHeight =
                  isLastMessage && !isLoading && minHeightForLastMessage > 0;

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user"
                        ? "justify-end items-start"
                        : "justify-start items-start"
                    )}
                    style={
                      shouldApplyMinHeight
                        ? { minHeight: `${minHeightForLastMessage}px` }
                        : undefined
                    }
                  >
                    {message.role === "assistant" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-gradient-to-br from-[#C9A227] to-[#e6c84d] flex items-center justify-center shadow-sm">
                        <Zap className="size-4 text-[#0A2540]" strokeWidth={2.5} />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2.5",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <Streamdown>{message.content}</Streamdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </p>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div
                  className="flex items-start gap-3"
                  style={
                    minHeightForLastMessage > 0
                      ? { minHeight: `${minHeightForLastMessage}px` }
                      : undefined
                  }
                >
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-gradient-to-br from-[#C9A227] to-[#e6c84d] flex items-center justify-center shadow-sm">
                    <Zap className="size-4 text-[#0A2540]" strokeWidth={2.5} />
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className="flex gap-2 p-4 border-t bg-background/50 items-end"
      >
        {onClearConversation && displayMessages.length > 0 && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClearConversation}
            className="shrink-0 h-[38px] w-[38px] text-muted-foreground hover:text-foreground"
            title="New conversation"
          >
            <RotateCcw className="size-4" />
          </Button>
        )}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || defaultPlaceholder}
          className="flex-1 max-h-32 resize-none min-h-9"
          maxLength={2000}
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
          className="shrink-0 h-[38px] w-[38px]"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
