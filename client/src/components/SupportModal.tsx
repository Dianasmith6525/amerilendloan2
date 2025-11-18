import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MessageCircle, Clock } from "lucide-react";

interface SupportModalProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SupportModal({ isOpen, onOpenChange }: SupportModalProps) {
  const [activeTab, setActiveTab] = useState<"contact" | "faq" | "ticket">("contact");
  const [ticketData, setTicketData] = useState({
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle ticket submission here
    console.log("Ticket submitted:", ticketData);
    setTicketData({ email: "", subject: "", message: "" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customer Support</DialogTitle>
          <DialogDescription>
            We're here to help. Choose how you'd like to get in touch.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <Button
            variant={activeTab === "contact" ? "default" : "outline"}
            onClick={() => setActiveTab("contact")}
            className="w-full"
          >
            Contact Us
          </Button>
          <Button
            variant={activeTab === "faq" ? "default" : "outline"}
            onClick={() => setActiveTab("faq")}
            className="w-full"
          >
            FAQ
          </Button>
          <Button
            variant={activeTab === "ticket" ? "default" : "outline"}
            onClick={() => setActiveTab("ticket")}
            className="w-full"
          >
            Submit Ticket
          </Button>
        </div>

        {activeTab === "contact" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 space-y-4">
              {/* Phone Support */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <Phone className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Phone Support</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Call our team at <strong>1-800-AMERILEND</strong>
                  </p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Available Mon-Fri, 8am-6pm EST
                  </p>
                </div>
              </div>

              {/* Email Support */}
              <div className="flex gap-4 pt-4 border-t border-blue-200">
                <div className="flex-shrink-0">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Email Support</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Email us at <strong>support@amerilendloan.com</strong>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Response within 24 hours
                  </p>
                </div>
              </div>

              {/* Live Chat */}
              <div className="flex gap-4 pt-4 border-t border-blue-200">
                <div className="flex-shrink-0">
                  <MessageCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Live Chat</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Chat with our support team in real-time
                  </p>
                  <Button size="sm" className="mt-2 bg-blue-600 hover:bg-blue-700">
                    Start Chat
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "faq" && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <details className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
              <summary className="font-semibold text-gray-900">
                What payment methods do you accept?
              </summary>
              <p className="text-sm text-gray-600 mt-3">
                We accept credit cards (Visa, Mastercard, American Express, Discover) and cryptocurrencies (Bitcoin, Ethereum, USDT, USDC).
              </p>
            </details>

            <details className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
              <summary className="font-semibold text-gray-900">
                How long does payment verification take?
              </summary>
              <p className="text-sm text-gray-600 mt-3">
                Card payments are verified instantly. Cryptocurrency payments require blockchain confirmations (1-3 minutes for USDT/USDC, 10-30 minutes for BTC/ETH).
              </p>
            </details>

            <details className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
              <summary className="font-semibold text-gray-900">
                What if my payment fails?
              </summary>
              <p className="text-sm text-gray-600 mt-3">
                If your payment fails, you can retry immediately. Check the error message for details. For crypto, ensure you sent the exact amount to the correct address.
              </p>
            </details>

            <details className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
              <summary className="font-semibold text-gray-900">
                Can I get a refund?
              </summary>
              <p className="text-sm text-gray-600 mt-3">
                Processing fees are non-refundable once payment is confirmed. If you believe there was an error, contact our support team for assistance.
              </p>
            </details>

            <details className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
              <summary className="font-semibold text-gray-900">
                How do I track my loan status?
              </summary>
              <p className="text-sm text-gray-600 mt-3">
                Once payment is confirmed, you'll see your loan status update on the dashboard. Disbursement typically happens within 1-2 business days.
              </p>
            </details>
          </div>
        )}

        {activeTab === "ticket" && (
          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={ticketData.email}
                onChange={(e) => setTicketData({ ...ticketData, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <Input
                type="text"
                placeholder="Brief description of your issue"
                value={ticketData.subject}
                onChange={(e) => setTicketData({ ...ticketData, subject: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <Textarea
                placeholder="Please describe your issue in detail..."
                value={ticketData.message}
                onChange={(e) => setTicketData({ ...ticketData, message: e.target.value })}
                required
                rows={5}
              />
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Submit Support Ticket
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
