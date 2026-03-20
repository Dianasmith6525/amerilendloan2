import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Zap,
  TrendingUp,
  Target,
  Send,
  RotateCcw,
  User,
  Bot,
  FileSearch,
  ShieldAlert,
  ClipboardList,
  BarChart3,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

interface AdminAiAssistantProps {
  applicationId?: number;
  onTaskExecuted?: () => void;
}

export default function AdminAiAssistant({ applicationId, onTaskExecuted }: AdminAiAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activePanel, setActivePanel] = useState<"chat" | "insights" | "batch">("chat");
  const [batchAction, setBatchAction] = useState<"auto_approve" | "review_priority" | "flag_fraud">("auto_approve");
  const [batchLimit, setBatchLimit] = useState(5);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Chat mutation
  const { mutate: sendChat, isPending: chatLoading } = trpc.adminAi.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message as string },
      ]);
    },
    onError: (error) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
      toast.error(error.message || "AI request failed");
    },
  });

  // Insights query
  const {
    data: insights,
    isLoading: loadingInsights,
    refetch: refetchInsights,
  } = trpc.adminAi.getPendingApplicationsInsights.useQuery(
    { limit: 10 },
    { enabled: activePanel === "insights" }
  );

  // Suggested tasks
  const { data: suggestedTasks } = trpc.adminAi.getSuggestedTasks.useQuery();

  // Batch mutation
  const { mutate: processBatch, isPending: processingBatch } =
    trpc.adminAi.processBatchApplications.useMutation({
      onSuccess: (data) => {
        toast.success("Batch processing plan generated!");
        // Show the plan in chat
        setActivePanel("chat");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `**Batch Processing Plan** (${data.action}, ${data.applicationsCount} applications):\n\n${data.plan}`,
          },
        ]);
        onTaskExecuted?.();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to process batch");
      },
    });

  // Auto-scroll on new messages
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement | null;
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      });
    }
  }, [messages.length, chatLoading]);

  const handleSend = (content?: string) => {
    const text = (content || input).trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    textareaRef.current?.focus();

    sendChat({
      messages: updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearConversation = () => {
    setMessages([]);
  };

  const quickCommands = suggestedTasks?.quickCommands || [
    "What applications should I prioritize?",
    "Show me fraud indicators in pending apps",
    "Which apps are auto-approvable?",
    "Help me batch process applications",
  ];

  const quickActions = [
    {
      label: "Prioritize",
      icon: Target,
      prompt: "What applications should I prioritize right now?",
    },
    {
      label: "Fraud Check",
      icon: ShieldAlert,
      prompt: "Are there any suspicious applications or fraud indicators?",
    },
    {
      label: "Auto-Approve",
      icon: ClipboardList,
      prompt: "Which pending applications are eligible for auto-approval?",
    },
    {
      label: "Performance",
      icon: BarChart3,
      prompt: "What's my current workload and performance metrics?",
    },
  ];

  const displayMessages = messages.filter((m) => m.role !== "system");

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600/10">
            <Bot className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Admin AI Assistant</h2>
            <p className="text-sm text-muted-foreground">
              Intelligent recommendations, insights &amp; automation
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activePanel === "chat" ? "default" : "outline"}
            size="sm"
            onClick={() => setActivePanel("chat")}
          >
            <Zap className="h-4 w-4 mr-1" />
            Chat
          </Button>
          <Button
            variant={activePanel === "insights" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setActivePanel("insights");
              refetchInsights();
            }}
          >
            <TrendingUp className="h-4 w-4 mr-1" />
            Insights
          </Button>
          <Button
            variant={activePanel === "batch" ? "default" : "outline"}
            size="sm"
            onClick={() => setActivePanel("batch")}
          >
            <Layers className="h-4 w-4 mr-1" />
            Batch
          </Button>
        </div>
      </div>

      {/* Chat Panel */}
      {activePanel === "chat" && (
        <Card className="flex-1 flex flex-col min-h-[500px]">
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-hidden">
              {displayMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
                  <div className="p-3 rounded-full bg-blue-600/10">
                    <Bot className="h-10 w-10 text-blue-600" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-medium">How can I help you today?</p>
                    <p className="text-sm text-muted-foreground">
                      Ask me about applications, fraud detection, batch processing, or performance metrics.
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-xl">
                    {quickActions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(action.prompt)}
                        disabled={chatLoading}
                        className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <action.icon className="h-5 w-5 text-blue-600" />
                        <span className="font-medium">{action.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Suggested Prompts */}
                  <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                    {quickCommands.slice(0, 6).map((cmd, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(cmd)}
                        disabled={chatLoading}
                        className="rounded-lg border border-border bg-card px-3 py-2 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1"
                      >
                        <FileSearch className="h-3 w-3" />
                        {cmd}
                      </button>
                    ))}
                  </div>

                  {/* Suggested Tasks */}
                  {suggestedTasks && (
                    <div className="w-full max-w-xl space-y-2 border-t pt-4">
                      <p className="text-xs font-medium text-muted-foreground">Suggested Tasks</p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestedTasks.tasks.map((task, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="cursor-pointer hover:bg-accent"
                            onClick={() => handleSend(task)}
                          >
                            {task}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="flex flex-col space-y-4 p-4">
                    {displayMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 ${
                          message.role === "user"
                            ? "justify-end items-start"
                            : "justify-start items-start"
                        }`}
                      >
                        {message.role === "assistant" && (
                          <div className="size-8 shrink-0 mt-1 rounded-full bg-blue-600/10 flex items-center justify-center">
                            <Bot className="size-4 text-blue-600" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <Streamdown>{message.content}</Streamdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                          )}
                        </div>
                        {message.role === "user" && (
                          <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                            <User className="size-4 text-secondary-foreground" />
                          </div>
                        )}
                      </div>
                    ))}

                    {chatLoading && (
                      <div className="flex items-start gap-3">
                        <div className="size-8 shrink-0 mt-1 rounded-full bg-blue-600/10 flex items-center justify-center">
                          <Bot className="size-4 text-blue-600" />
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

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2 p-4 border-t bg-background/50 items-end"
            >
              {displayMessages.length > 0 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={clearConversation}
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
                placeholder="Ask about applications, fraud detection, batch processing..."
                className="flex-1 max-h-32 resize-none min-h-9"
                maxLength={2000}
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || chatLoading}
                className="shrink-0 h-[38px] w-[38px]"
              >
                {chatLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Insights Panel */}
      {activePanel === "insights" && (
        <Card className="flex-1 min-h-[500px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Pending Application Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInsights ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : insights ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{insights.count}</div>
                      <div className="text-sm text-muted-foreground">Pending Applications</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {insights.applications?.length || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Analyzed</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <Badge variant={insights.count > 10 ? "destructive" : "secondary"}>
                        {insights.count > 10 ? "High Load" : "Normal"}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-1">Queue Status</div>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardContent className="pt-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {typeof insights.message === "string" ? (
                        <Streamdown>{insights.message}</Streamdown>
                      ) : (
                        JSON.stringify(insights.message)
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Button variant="outline" onClick={() => refetchInsights()} className="w-full">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Refresh Insights
                </Button>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                No insights available
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Batch Panel */}
      {activePanel === "batch" && (
        <Card className="flex-1 min-h-[500px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5 text-blue-600" />
              Batch Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium">Action Type</label>
              <div className="mt-3 space-y-3">
                {(["auto_approve", "review_priority", "flag_fraud"] as const).map((action) => (
                  <label
                    key={action}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      batchAction === action
                        ? "border-blue-600 bg-blue-600/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="batch-action"
                      value={action}
                      checked={batchAction === action}
                      onChange={(e) => setBatchAction(e.target.value as typeof action)}
                      className="accent-blue-600"
                    />
                    <div>
                      <span className="text-sm font-medium">
                        {action === "auto_approve" && "Auto-Approve Eligible"}
                        {action === "review_priority" && "Prioritize for Review"}
                        {action === "flag_fraud" && "Flag Suspicious Applications"}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {action === "auto_approve" &&
                          "Automatically approve applications meeting all criteria"}
                        {action === "review_priority" &&
                          "Sort and prioritize applications needing human review"}
                        {action === "flag_fraud" &&
                          "Detect and flag potentially fraudulent applications"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="batch-limit" className="text-sm font-medium">
                Number of Applications
              </label>
              <input
                id="batch-limit"
                type="number"
                min="1"
                max="50"
                value={batchLimit}
                onChange={(e) => setBatchLimit(parseInt(e.target.value) || 5)}
                className="mt-2 w-full px-3 py-2 border rounded-md bg-background"
                aria-label="Batch processing limit"
              />
            </div>

            <Button
              onClick={() => processBatch({ action: batchAction, limit: batchLimit })}
              disabled={processingBatch}
              className="w-full"
            >
              {processingBatch ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              {processingBatch ? "Generating Plan..." : "Generate Batch Plan"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
