import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Check,
  Bitcoin,
  Wallet
} from "lucide-react";
import { toast } from "sonner";

export default function PaymentMethodManager() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<"card" | "crypto">("card");
  const [cardData, setCardData] = useState({
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
    nameOnCard: "",
  });

  // Query saved payment methods
  const { data: paymentMethods = [], isLoading, refetch } = trpc.payments.getSavedMethods.useQuery();

  // Mutations
  const addMethodMutation = trpc.payments.addPaymentMethod.useMutation({
    onSuccess: () => {
      toast.success("Payment method added successfully!");
      setShowAddDialog(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add payment method");
    },
  });

  const deleteMethodMutation = trpc.payments.deletePaymentMethod.useMutation({
    onSuccess: () => {
      toast.success("Payment method removed");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove payment method");
    },
  });

  const setDefaultMutation = trpc.payments.setDefaultMethod.useMutation({
    onSuccess: () => {
      toast.success("Default payment method updated");
      refetch();
    },
  });

  const resetForm = () => {
    setCardData({
      cardNumber: "",
      expiryMonth: "",
      expiryYear: "",
      cvv: "",
      nameOnCard: "",
    });
  };

  const handleAddMethod = () => {
    if (selectedMethod === "card") {
      // Validate card data
      if (!cardData.cardNumber || !cardData.expiryMonth || !cardData.expiryYear || !cardData.cvv || !cardData.nameOnCard) {
        toast.error("Please fill in all card details");
        return;
      }

      // Basic card number validation (remove spaces)
      const cleanCardNumber = cardData.cardNumber.replace(/\s/g, "");
      if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
        toast.error("Invalid card number");
        return;
      }

      addMethodMutation.mutate({
        type: "card",
        cardNumber: cleanCardNumber,
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        cvv: cardData.cvv,
        nameOnCard: cardData.nameOnCard,
      });
    } else {
      // Crypto wallet - simplified for now
      toast.info("Crypto wallet integration coming soon!");
    }
  };

  const formatCardNumber = (number: string) => {
    const cleaned = number.replace(/\s/g, "");
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(" ") : cleaned;
  };

  const getCardBrand = (number: string) => {
    const cleaned = number.replace(/\s/g, "");
    if (cleaned.startsWith("4")) return "Visa";
    if (cleaned.startsWith("5")) return "Mastercard";
    if (cleaned.startsWith("3")) return "Amex";
    if (cleaned.startsWith("6")) return "Discover";
    return "Card";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-[#0033A0]">Payment Methods</CardTitle>
              <CardDescription>Manage your saved payment methods for faster checkout</CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)} className="bg-[#FFA500] hover:bg-[#ff8c00]">
              <Plus className="w-4 h-4 mr-2" />
              Add Method
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading payment methods...</div>
          ) : paymentMethods.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payment Methods</h3>
              <p className="text-gray-600 mb-4">Add a payment method to make payments faster and easier</p>
              <Button onClick={() => setShowAddDialog(true)} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Method
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentMethods.map((method: any) => (
                <Card key={method.id} className={`relative ${method.isDefault ? "border-2 border-[#0033A0]" : ""}`}>
                  <CardContent className="p-6">
                    {method.isDefault && (
                      <div className="absolute top-2 right-2">
                        <span className="bg-[#0033A0] text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Default
                        </span>
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {method.type === "card" ? (
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-white" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-700 rounded-lg flex items-center justify-center">
                            <Bitcoin className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">
                            {method.type === "card" ? method.cardBrand : "Crypto Wallet"}
                          </p>
                          <p className="text-sm text-gray-600">
                            {method.type === "card" ? `****${method.last4}` : method.walletAddress?.slice(0, 16) + "..."}
                          </p>
                          {method.type === "card" && (
                            <p className="text-xs text-gray-500 mt-1">
                              Expires {method.expiryMonth}/{method.expiryYear}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      {!method.isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDefaultMutation.mutate({ id: method.id })}
                          disabled={setDefaultMutation.isPending}
                        >
                          Set as Default
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Are you sure you want to remove this payment method?")) {
                            deleteMethodMutation.mutate({ id: method.id });
                          }
                        }}
                        disabled={deleteMethodMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>Add a new card or crypto wallet for payments</DialogDescription>
          </DialogHeader>

          {/* Method Type Selection */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => setSelectedMethod("card")}
              className={`p-4 border-2 rounded-lg transition-all ${
                selectedMethod === "card"
                  ? "border-[#0033A0] bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <CreditCard className="w-8 h-8 mx-auto mb-2 text-[#0033A0]" />
              <p className="text-sm font-semibold">Card</p>
            </button>
            <button
              onClick={() => setSelectedMethod("crypto")}
              className={`p-4 border-2 rounded-lg transition-all ${
                selectedMethod === "crypto"
                  ? "border-[#FFA500] bg-orange-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Wallet className="w-8 h-8 mx-auto mb-2 text-[#FFA500]" />
              <p className="text-sm font-semibold">Crypto</p>
            </button>
          </div>

          {selectedMethod === "card" && (
            <div className="space-y-4">
              <div>
                <Label>Card Number</Label>
                <Input
                  placeholder="1234 5678 9012 3456"
                  value={cardData.cardNumber}
                  onChange={(e) => {
                    const formatted = formatCardNumber(e.target.value.replace(/\D/g, ""));
                    if (formatted.replace(/\s/g, "").length <= 19) {
                      setCardData({ ...cardData, cardNumber: formatted });
                    }
                  }}
                  maxLength={23}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Expiry Month</Label>
                  <Input
                    placeholder="MM"
                    value={cardData.expiryMonth}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 2 && (value === "" || (parseInt(value) >= 1 && parseInt(value) <= 12))) {
                        setCardData({ ...cardData, expiryMonth: value });
                      }
                    }}
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label>Expiry Year</Label>
                  <Input
                    placeholder="YYYY"
                    value={cardData.expiryYear}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 4) {
                        setCardData({ ...cardData, expiryYear: value });
                      }
                    }}
                    maxLength={4}
                  />
                </div>
              </div>
              <div>
                <Label>CVV</Label>
                <Input
                  placeholder="123"
                  type="password"
                  value={cardData.cvv}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    if (value.length <= 4) {
                      setCardData({ ...cardData, cvv: value });
                    }
                  }}
                  maxLength={4}
                />
              </div>
              <div>
                <Label>Name on Card</Label>
                <Input
                  placeholder="John Doe"
                  value={cardData.nameOnCard}
                  onChange={(e) => setCardData({ ...cardData, nameOnCard: e.target.value })}
                />
              </div>
            </div>
          )}

          {selectedMethod === "crypto" && (
            <div className="text-center py-8">
              <Bitcoin className="w-16 h-16 mx-auto text-[#FFA500] mb-4" />
              <p className="text-gray-600">Crypto wallet integration coming soon!</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMethod}
              disabled={addMethodMutation.isPending || selectedMethod === "crypto"}
              className="bg-[#0033A0] hover:bg-[#002680]"
            >
              {addMethodMutation.isPending ? "Adding..." : "Add Method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
