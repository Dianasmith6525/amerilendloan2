import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CheckCircle, AlertCircle, Lock, CreditCard } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface BankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  bankName: string;
  accountType: "checking" | "savings";
  status: "verified" | "pending" | "failed";
  isPrimary: boolean;
  addedDate: string;
}

export function BankAccountManagement() {
  const [showAddAccount, setShowAddAccount] = useState(false);

  // Mock data
  const mockAccounts: BankAccount[] = [
    {
      id: "ACC-001",
      accountName: "My Checking Account",
      accountNumber: "****1234",
      routingNumber: "****5678",
      bankName: "Chase Bank",
      accountType: "checking",
      status: "verified",
      isPrimary: true,
      addedDate: "2024-01-01",
    },
    {
      id: "ACC-002",
      accountName: "Savings Account",
      accountNumber: "****5678",
      routingNumber: "****1234",
      bankName: "Bank of America",
      accountType: "savings",
      status: "verified",
      isPrimary: false,
      addedDate: "2024-01-10",
    },
    {
      id: "ACC-003",
      accountName: "Wells Fargo Checking",
      accountNumber: "****9999",
      routingNumber: "****4444",
      bankName: "Wells Fargo",
      accountType: "checking",
      status: "pending",
      isPrimary: false,
      addedDate: "2024-01-15",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge className="bg-green-600 flex items-center gap-1 w-fit">
            <CheckCircle className="w-3 h-3" />
            Verified
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-600 flex items-center gap-1 w-fit">
            <AlertCircle className="w-3 h-3" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
            <AlertCircle className="w-3 h-3" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const getAccountTypeIcon = (type: string) => {
    return type === "checking" ? "🏦" : "💰";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-8 h-8 text-blue-400" />
              <h1 className="text-3xl font-bold text-white">Bank Accounts</h1>
            </div>
            <p className="text-slate-400">Manage your linked bank accounts for payments and transfers</p>
          </div>
          <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle>Add Bank Account</DialogTitle>
                <DialogDescription>
                  Connect a new bank account for secure payments and transfers
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Account Nickname</label>
                  <Input
                    placeholder="e.g., My Checking"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Bank Name</label>
                  <Input
                    placeholder="Your bank name"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white text-sm font-medium mb-2 block">Account Type</label>
                    <select className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2">
                      <option>Checking</option>
                      <option>Savings</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white text-sm font-medium mb-2 block">Account Number</label>
                    <Input
                      placeholder="Account number"
                      type="password"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Routing Number</label>
                  <Input
                    placeholder="Routing number"
                    type="password"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div className="bg-blue-500/10 border border-blue-600/30 rounded-lg p-3">
                  <p className="text-sm text-blue-300 flex items-start gap-2">
                    <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    Your banking information is encrypted and securely stored
                  </p>
                </div>
                <Button
                  onClick={() => setShowAddAccount(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Add Account
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Accounts List */}
        <div className="space-y-4 mb-8">
          {mockAccounts.map((account) => (
            <Card
              key={account.id}
              className={`bg-slate-800 border-slate-700 transition-all hover:border-slate-600 ${
                account.isPrimary ? "ring-2 ring-blue-600" : ""
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{getAccountTypeIcon(account.accountType)}</span>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold text-lg">
                          {account.accountName}
                        </h3>
                        <p className="text-slate-400 text-sm">{account.bankName}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(account.status)}
                        {account.isPrimary && (
                          <Badge className="bg-blue-600">Primary</Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-700">
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Account Type</p>
                        <p className="text-white font-medium capitalize">
                          {account.accountType}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Account Number</p>
                        <p className="text-white font-mono">{account.accountNumber}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Routing Number</p>
                        <p className="text-white font-mono">{account.routingNumber}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Added Date</p>
                        <p className="text-white">{account.addedDate}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4 flex-shrink-0">
                    {!account.isPrimary && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-400 border-blue-600 hover:bg-blue-600/20"
                      >
                        Set as Primary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-600/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {account.status === "pending" && (
                  <div className="mt-4 pt-4 border-t border-slate-700 bg-yellow-600/10 p-3 rounded-lg">
                    <p className="text-yellow-300 text-sm">
                      ⚠️ Verification in progress. Two small deposits will be made to confirm your account.
                      <Button variant="link" className="p-0 ml-2 h-auto">
                        Verify Now
                      </Button>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Security Info */}
        <Card className="bg-slate-800 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle>Security & Privacy</CardTitle>
            <CardDescription>How we protect your banking information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">256-bit AES Encryption</p>
                <p className="text-slate-400 text-sm">All banking data is encrypted in transit and at rest</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">PCI-DSS Compliance</p>
                <p className="text-slate-400 text-sm">We meet highest standards for payment security</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">Verification via Micro-deposits</p>
                <p className="text-slate-400 text-sm">We verify account ownership with small test transfers</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">Read-Only Access</p>
                <p className="text-slate-400 text-sm">We can only read your balance, not modify your account</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ACH Transfer Info */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle>ACH Transfer Details</CardTitle>
            <CardDescription>Information about secure bank transfers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <h4 className="text-white font-medium mb-2">Transfer Limits</h4>
                <ul className="text-slate-400 text-sm space-y-1">
                  <li>• Daily limit: $10,000</li>
                  <li>• Monthly limit: $100,000</li>
                  <li>• Single transfer max: $10,000</li>
                </ul>
              </div>
              <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <h4 className="text-white font-medium mb-2">Processing Times</h4>
                <ul className="text-slate-400 text-sm space-y-1">
                  <li>• Standard: 3-5 business days</li>
                  <li>• Rush: 1-2 business days (fee applies)</li>
                  <li>• Weekends/holidays excluded</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default BankAccountManagement;
