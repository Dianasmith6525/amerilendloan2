import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDb, getDbStatus } from "../db";
import { buildMessages, getSuggestedPrompts as getAiSuggestedPrompts } from "./aiSupport";
import { invokeLLM } from "./llm";

// Helper function to get varied fallback responses based on user intent
const getFallbackResponse = (userMessage: string): string => {
  const msg = userMessage.toLowerCase();

  if (msg.includes("apply")) {
    const responses = [
      "To apply for a loan with AmeriLend, visit our Apply page. The process takes just a few minutes and requires basic information about yourself and the loan amount you need.",
      "Ready to apply? Head to our Apply page and you'll be done in minutes. We just need some basic info about you and your desired loan amount.",
      "Getting a loan from AmeriLend is easy! Simply visit our application page, enter your details, and we'll process your request quickly.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (msg.includes("rate") || msg.includes("interest") || msg.includes("apr")) {
    const responses = [
      "Our loan rates start at competitive APRs and vary based on your credit profile and loan amount. Visit our Rates page to see current offers, or apply to get a personalized rate quote.",
      "Interest rates depend on several factors including credit history and loan amount. Check our Rates page for current ranges, or apply to receive your custom rate.",
      "We offer competitive rates tailored to your situation. For the most accurate rate information, I recommend visiting our Rates page or submitting an application.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (msg.includes("payment") || msg.includes("pay")) {
    const responses = [
      "You can make payments using credit/debit cards or cryptocurrency. Log in to your dashboard to view your payment schedule and make payments securely.",
      "We accept both traditional card payments and crypto payments. Access your dashboard to see your balance and payment options.",
      "Making a payment is easy! Just log in to your account dashboard where you'll find your payment schedule and can choose between card or crypto payment methods.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (msg.includes("document") || msg.includes("upload") || msg.includes("verification")) {
    const responses = [
      "You can upload required documents directly through your dashboard. We accept PDF, JPG, and PNG files. Common documents include ID, proof of income, and bank statements.",
      "Document upload is simple through your account dashboard. Make sure files are clear and readable - we accept PDF and image formats.",
      "Upload your verification documents in your dashboard under the Documents section. Our team will review them within 24 hours.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (msg.includes("status") || msg.includes("application")) {
    const responses = [
      "You can check your loan application status anytime by logging into your dashboard. We'll also send email updates at each stage of the process.",
      "Track your application progress in real-time through your account dashboard. You'll receive notifications as your application moves through each stage.",
      "Your application status is always available in your dashboard. We typically process applications within 24-48 hours and keep you updated via email.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (msg.includes("contact") || msg.includes("support") || msg.includes("help")) {
    return "You can reach our support team at support@amerilendloan.com or call us at (945) 212-1609. We're here to help Monday through Friday, 9 AM to 6 PM EST.";
  }

  // Default responses
  const defaults = [
    "I'm here to help! You can ask me about our loan application process, rates, payment options, or anything else related to AmeriLend services.",
    "I can assist you with questions about applying for loans, checking rates, making payments, uploading documents, or tracking your application status. What would you like to know?",
    "Feel free to ask me about loan applications, interest rates, payment methods, document requirements, or contact information. How can I help you today?",
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
};

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(async () => ({
      ok: true,
      timestamp: new Date().toISOString(),
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // AI Chat Support
  chatWithAi: publicProcedure
    .input(z.object({
      message: z.string().min(1, "Message cannot be empty"),
      conversationHistory: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional().default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const isAuthenticated = !!ctx.user;
        const userContext = isAuthenticated ? {
          isAuthenticated: true,
          userRole: ctx.user?.role,
          userId: ctx.user?.id,
        } : {
          isAuthenticated: false,
        };

        // Build messages with context
        const messages = buildMessages(input.message, input.conversationHistory, userContext);

        // Try to get AI response
        try {
          const aiResponse = await invokeLLM(messages);
          return {
            success: true,
            message: aiResponse,
            isAuthenticated,
            userContext,
          };
        } catch (llmError) {
          console.error('[AI Support] LLM error, using fallback:', llmError);
          // Use fallback response if LLM fails
          const fallbackMsg = getFallbackResponse(input.message);
          return {
            success: true,
            message: fallbackMsg,
            isAuthenticated,
            userContext,
          };
        }
      } catch (error) {
        console.error('[AI Support] Error:', error);
        return {
          success: false,
          message: "I apologize, but I'm having trouble connecting right now. Please try again or contact support at support@amerilendloan.com or (945) 212-1609.",
          isAuthenticated: !!ctx.user,
          userContext: { isAuthenticated: !!ctx.user },
        };
      }
    }),

  // Get suggested prompts based on authentication status
  getSuggestedPrompts: publicProcedure.query(({ ctx }) => {
    const isAuthenticated = !!ctx.user;
    return getAiSuggestedPrompts(isAuthenticated);
  }),
});
