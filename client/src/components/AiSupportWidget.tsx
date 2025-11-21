import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiSupportWidgetProps {
  isAuthenticated?: boolean;
}

export default function AiSupportWidget({ isAuthenticated = false }: AiSupportWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
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
        messages: newMessages,
      });

      setMessages([...newMessages, { role: "assistant", content: response.message }]);
    } catch (error) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "I apologize, but I'm having trouble connecting right now. Please try again or contact support at support@amerilendloan.com or (945) 212-1609.",
        },
      ]);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    handleSend(prompt);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-[#0033A0] hover:bg-[#002080] text-white rounded-full p-4 shadow-lg transition-all hover:scale-110 flex items-center gap-2 group"
          aria-label="Open AI Support"
        >
          <Sparkles className="w-6 h-6" />
          <MessageCircle className="w-6 h-6" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
            Ask AI Support
          </span>
        </button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] shadow-2xl">
          <Card className="h-[600px] max-h-[calc(100vh-3rem)] flex flex-col">
            <CardHeader className="bg-gradient-to-r from-[#0033A0] to-[#0055CC] text-white p-4 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <CardTitle className="text-lg">
                  {isAuthenticated ? "Personal AI Assistant" : "AI Support"}
                </CardTitle>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 rounded-full p-1 transition-colors"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-[#0033A0]" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">
                    {isAuthenticated ? "Hi! I'm your personal AI assistant" : "Hi! How can I help you today?"}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {isAuthenticated
                      ? "I have access to your account details and can help with loan questions, payments, and more."
                      : "Ask me anything about loans, applications, rates, or requirements."}
                  </p>

                  {/* Suggested Prompts */}
                  {suggestedPromptsQuery.data && suggestedPromptsQuery.data.length > 0 && (
                    <div className="space-y-2 mt-6">
                      <p className="text-xs text-gray-500 mb-3">Quick questions:</p>
                      {suggestedPromptsQuery.data.map((prompt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestedPrompt(prompt)}
                          className="w-full text-left p-3 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-sm transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === "user"
                        ? "bg-[#0033A0] text-white"
                        : "bg-white border border-gray-200 text-gray-800"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-[#0033A0]" />
                        <span className="text-xs font-semibold text-[#0033A0]">AI Assistant</span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#0033A0]" />
                      <span className="text-sm text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input Area */}
            <div className="p-4 border-t bg-white">
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
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0033A0] focus:border-transparent"
                  disabled={chatMutation.isPending}
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || chatMutation.isPending}
                  className="bg-[#0033A0] hover:bg-[#002080] text-white"
                >
                  {chatMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </form>
              <p className="text-xs text-gray-500 mt-2 text-center">
                AI responses are helpful but may not always be accurate
              </p>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
