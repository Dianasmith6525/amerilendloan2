import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, CheckCircle, AlertCircle, Lock, CreditCard,
  ArrowUpRight, ArrowDownLeft, Send, Smartphone, Receipt,
  RefreshCw, DollarSign, Clock, Building2, ArrowLeftRight,
  Search, Filter, Eye, EyeOff, Calendar, XCircle, ChevronLeft
} from "lucide-react";
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

// ──────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────
function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const txTypeLabels: Record<string, string> = {
  wire_transfer: "Wire Transfer",
  ach_deposit: "ACH Deposit",
  ach_withdrawal: "ACH Withdrawal",
  mobile_deposit: "Mobile Deposit",
  bill_pay: "Bill Pay",
  internal_transfer: "Internal Transfer",
  direct_deposit: "Direct Deposit",
  loan_disbursement: "Loan Disbursement",
  loan_payment: "Loan Payment",
  fee: "Fee",
  interest: "Interest",
  refund: "Refund",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-600",
  processing: "bg-blue-600",
  completed: "bg-green-600",
  failed: "bg-red-600",
  cancelled: "bg-slate-600",
  on_hold: "bg-orange-600",
  returned: "bg-purple-600",
};

const billCategories = [
  "utilities", "rent", "mortgage", "insurance", "credit_card",
  "phone", "internet", "subscription", "medical", "education", "other",
] as const;

// ──────────────────────────────────────────
//  Main Component
// ──────────────────────────────────────────
export function BankAccountManagement() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState("accounts");
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showBalances, setShowBalances] = useState(true);

  // ── Add account form ──
  const [newAccountName, setNewAccountName] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const [newAccountType, setNewAccountType] = useState<"checking" | "savings">("checking");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newRoutingNumber, setNewRoutingNumber] = useState("");

  // ── Transfer forms ──
  const [transferType, setTransferType] = useState<"wire" | "ach_out" | "ach_in" | "internal">("wire");
  const [txFromAccount, setTxFromAccount] = useState<number | "">("");
  const [txToAccount, setTxToAccount] = useState<number | "">("");
  const [txAmount, setTxAmount] = useState("");
  const [txRecipientName, setTxRecipientName] = useState("");
  const [txRecipientAcct, setTxRecipientAcct] = useState("");
  const [txRecipientRouting, setTxRecipientRouting] = useState("");
  const [txRecipientBank, setTxRecipientBank] = useState("");
  const [txSwift, setTxSwift] = useState("");
  const [txMemo, setTxMemo] = useState("");
  const [txDescription, setTxDescription] = useState("");

  // ── Mobile Deposit ──
  const [mdAccount, setMdAccount] = useState<number | "">("");
  const [mdAmount, setMdAmount] = useState("");
  const [mdCheckNumber, setMdCheckNumber] = useState("");
  const [mdMemo, setMdMemo] = useState("");
  const [mdFrontImage, setMdFrontImage] = useState<string>("");
  const [mdBackImage, setMdBackImage] = useState<string>("");
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  // ── Bill Pay ──
  const [bpAccount, setBpAccount] = useState<number | "">("");
  const [bpAmount, setBpAmount] = useState("");
  const [bpPayeeName, setBpPayeeName] = useState("");
  const [bpPayeeAcct, setBpPayeeAcct] = useState("");
  const [bpCategory, setBpCategory] = useState<(typeof billCategories)[number]>("utilities");
  const [bpMemo, setBpMemo] = useState("");
  const [bpScheduledDate, setBpScheduledDate] = useState("");

  // ── Transaction History Filters ──
  const [historyAccount, setHistoryAccount] = useState<number | "">("");
  const [historyType, setHistoryType] = useState<string>("");
  const [historyStatus, setHistoryStatus] = useState<string>("");

  // ──────────────────────────────────────────
  //  Queries & Mutations — Bank Accounts
  // ──────────────────────────────────────────
  const { data: bankAccounts = [], isLoading: acctLoading, refetch: refetchAccounts } = trpc.userFeatures.bankAccounts.list.useQuery();

  const addAccountMutation = trpc.userFeatures.bankAccounts.add.useMutation({
    onSuccess: () => { toast.success("Bank account added"); setShowAddAccount(false); resetAddForm(); refetchAccounts(); },
    onError: (e) => toast.error(e.message || "Failed to add account"),
  });
  const removeAccountMutation = trpc.userFeatures.bankAccounts.remove.useMutation({
    onSuccess: () => { toast.success("Account removed"); refetchAccounts(); },
    onError: (e) => toast.error(e.message || "Failed to remove"),
  });
  const setPrimaryMutation = trpc.userFeatures.bankAccounts.setPrimary.useMutation({
    onSuccess: () => { toast.success("Primary updated"); refetchAccounts(); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const verifyAccountMutation = trpc.userFeatures.bankAccounts.verify.useMutation({
    onSuccess: () => { toast.success("Verified!"); refetchAccounts(); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  // ──────────────────────────────────────────
  //  Queries & Mutations — Banking Transactions
  // ──────────────────────────────────────────
  const balancesQuery = trpc.userFeatures.banking.getAllBalances.useQuery();

  const txQuery = trpc.userFeatures.banking.getTransactions.useQuery(
    {
      ...(historyAccount ? { accountId: historyAccount as number } : {}),
      ...(historyType ? { type: historyType as any } : {}),
      ...(historyStatus ? { status: historyStatus as any } : {}),
      limit: 50,
      offset: 0,
    },
    { }
  );

  const recurringQuery = trpc.userFeatures.banking.getRecurringBills.useQuery();

  const wireTransferMutation = trpc.userFeatures.banking.wireTransfer.useMutation({
    onSuccess: (d) => { toast.success(`Wire sent! Ref: ${d.referenceNumber}`); resetTransferForm(); refetchAll(); },
    onError: (e) => toast.error(e.message),
  });
  const achDepositMutation = trpc.userFeatures.banking.achDeposit.useMutation({
    onSuccess: (d) => { toast.success(`ACH deposit initiated! Ref: ${d.referenceNumber}`); resetTransferForm(); refetchAll(); },
    onError: (e) => toast.error(e.message),
  });
  const achWithdrawalMutation = trpc.userFeatures.banking.achWithdrawal.useMutation({
    onSuccess: (d) => { toast.success(`ACH withdrawal initiated! Ref: ${d.referenceNumber}`); resetTransferForm(); refetchAll(); },
    onError: (e) => toast.error(e.message),
  });
  const internalTransferMutation = trpc.userFeatures.banking.internalTransfer.useMutation({
    onSuccess: (d) => { toast.success(`Transfer complete! Ref: ${d.referenceNumber}`); resetTransferForm(); refetchAll(); },
    onError: (e) => toast.error(e.message),
  });
  const mobileDepositMutation = trpc.userFeatures.banking.mobileDeposit.useMutation({
    onSuccess: (d) => { toast.success(`Check deposited! Ref: ${d.referenceNumber}. ${d.holdMessage}`); resetMobileDeposit(); refetchAll(); },
    onError: (e) => toast.error(e.message),
  });
  const billPayMutation = trpc.userFeatures.banking.billPay.useMutation({
    onSuccess: (d) => { toast.success(d.scheduled ? `Bill scheduled! Ref: ${d.referenceNumber}` : `Bill paid! Ref: ${d.referenceNumber}`); resetBillPay(); refetchAll(); },
    onError: (e) => toast.error(e.message),
  });
  const createRecurringMutation = trpc.userFeatures.banking.createRecurringBill.useMutation({
    onSuccess: () => { toast.success("Recurring bill created"); recurringQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const cancelRecurringMutation = trpc.userFeatures.banking.cancelRecurringBill.useMutation({
    onSuccess: () => { toast.success("Recurring bill cancelled"); recurringQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  // ── Helpers ──
  function refetchAll() { refetchAccounts(); balancesQuery.refetch(); txQuery.refetch(); }
  function resetAddForm() { setNewAccountName(""); setNewBankName(""); setNewAccountType("checking"); setNewAccountNumber(""); setNewRoutingNumber(""); }
  function resetTransferForm() { setTxFromAccount(""); setTxToAccount(""); setTxAmount(""); setTxRecipientName(""); setTxRecipientAcct(""); setTxRecipientRouting(""); setTxRecipientBank(""); setTxSwift(""); setTxMemo(""); setTxDescription(""); }
  function resetMobileDeposit() { setMdAccount(""); setMdAmount(""); setMdCheckNumber(""); setMdMemo(""); setMdFrontImage(""); setMdBackImage(""); }
  function resetBillPay() { setBpAccount(""); setBpAmount(""); setBpPayeeName(""); setBpPayeeAcct(""); setBpCategory("utilities"); setBpMemo(""); setBpScheduledDate(""); }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, side: "front" | "back") {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (side === "front") setMdFrontImage(result);
      else setMdBackImage(result);
    };
    reader.readAsDataURL(file);
  }

  const verifiedAccounts = bankAccounts.filter((a: any) => a.isVerified);
  const anyPending = wireTransferMutation.isPending || achDepositMutation.isPending || achWithdrawalMutation.isPending || internalTransferMutation.isPending || mobileDepositMutation.isPending || billPayMutation.isPending;

  // ──────────────────────────────────────────
  //              RENDER
  // ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/user-dashboard")} className="text-slate-400 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Building2 className="w-7 h-7 text-blue-400" />
                <h1 className="text-2xl md:text-3xl font-bold text-white">Banking Center</h1>
              </div>
              <p className="text-slate-400 text-sm">Manage accounts, send transfers, deposit checks, and pay bills</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={() => setShowBalances(!showBalances)}>
              {showBalances ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
              {showBalances ? "Hide" : "Show"} Balances
            </Button>
            <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700" disabled={isAdmin} title={isAdmin ? "Admin cannot add accounts" : undefined}>
                  <Plus className="w-4 h-4 mr-1" /> Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Add Bank Account</DialogTitle>
                  <DialogDescription>Connect a new bank account for payments and transfers</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-white text-sm font-medium mb-1 block">Account Holder Name</label>
                    <Input placeholder="Full name on account" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                  <div>
                    <label className="text-white text-sm font-medium mb-1 block">Bank Name</label>
                    <Input placeholder="Your bank name" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-white text-sm font-medium mb-1 block">Account Type</label>
                      <select title="Account Type" value={newAccountType} onChange={(e) => setNewAccountType(e.target.value as any)} className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2">
                        <option value="checking">Checking</option>
                        <option value="savings">Savings</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-white text-sm font-medium mb-1 block">Account Number</label>
                      <Input placeholder="Account number" type="password" value={newAccountNumber} onChange={(e) => setNewAccountNumber(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-white text-sm font-medium mb-1 block">Routing Number</label>
                    <Input placeholder="9-digit routing number" type="password" value={newRoutingNumber} onChange={(e) => setNewRoutingNumber(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                  <div className="bg-blue-500/10 border border-blue-600/30 rounded-lg p-3">
                    <p className="text-sm text-blue-300 flex items-start gap-2">
                      <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      Your banking information is encrypted and securely stored
                    </p>
                  </div>
                  <Button onClick={() => {
                    if (!newAccountName.trim() || !newBankName.trim() || !newAccountNumber.trim() || !newRoutingNumber.trim()) { toast.error("Please fill in all fields"); return; }
                    addAccountMutation.mutate({ accountHolderName: newAccountName, bankName: newBankName, accountType: newAccountType, accountNumber: newAccountNumber, routingNumber: newRoutingNumber });
                  }} className="w-full bg-blue-600 hover:bg-blue-700" disabled={addAccountMutation.isPending}>
                    {addAccountMutation.isPending ? "Adding..." : "Add Account"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── Account Summary Cards ── */}
        {bankAccounts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {bankAccounts.map((acc: any) => (
              <Card key={acc.id} className={`bg-slate-800/80 border-slate-700 ${acc.isPrimary ? "ring-2 ring-blue-500" : ""}`}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{acc.accountType === "checking" ? "🏦" : "💰"}</span>
                      <div>
                        <p className="text-white font-medium text-sm">{acc.bankName}</p>
                        <p className="text-slate-400 text-xs capitalize">{acc.accountType} ****{acc.accountNumber?.slice(-4)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {acc.isPrimary && <Badge className="bg-blue-600 text-[10px] px-1.5">Primary</Badge>}
                      {acc.isVerified ? (
                        <Badge className="bg-green-600/80 text-[10px] px-1.5"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />Verified</Badge>
                      ) : (
                        <Badge className="bg-yellow-600/80 text-[10px] px-1.5"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />Pending</Badge>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-slate-700 pt-3">
                    <p className="text-slate-400 text-xs mb-0.5">Available Balance</p>
                    <p className="text-white text-2xl font-bold">{showBalances ? fmt(acc.availableBalance ?? 0) : "••••••"}</p>
                    {showBalances && acc.balance !== acc.availableBalance && (
                      <p className="text-slate-500 text-xs mt-0.5">Total: {fmt(acc.balance ?? 0)}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {/* Total card */}
            <Card className="bg-gradient-to-br from-blue-900/50 to-slate-800 border-blue-700/50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-5 h-5 text-blue-400" />
                  <p className="text-blue-300 font-medium text-sm">Total Balance</p>
                </div>
                <div className="border-t border-blue-800/50 pt-3">
                  <p className="text-blue-200 text-xs mb-0.5">All Accounts</p>
                  <p className="text-white text-2xl font-bold">
                    {showBalances ? fmt(bankAccounts.reduce((s: number, a: any) => s + (a.availableBalance ?? 0), 0)) : "••••••"}
                  </p>
                  <p className="text-blue-400 text-xs mt-1">{bankAccounts.length} account{bankAccounts.length !== 1 ? "s" : ""} linked</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-800 border border-slate-700 w-full flex flex-wrap h-auto p-1">
            <TabsTrigger value="accounts" className="flex-1 data-[state=active]:bg-blue-600 text-xs sm:text-sm gap-1">
              <CreditCard className="w-3.5 h-3.5" /> Accounts
            </TabsTrigger>
            <TabsTrigger value="transfers" className="flex-1 data-[state=active]:bg-blue-600 text-xs sm:text-sm gap-1">
              <Send className="w-3.5 h-3.5" /> Transfers
            </TabsTrigger>
            <TabsTrigger value="deposits" className="flex-1 data-[state=active]:bg-blue-600 text-xs sm:text-sm gap-1">
              <Smartphone className="w-3.5 h-3.5" /> Deposits
            </TabsTrigger>
            <TabsTrigger value="billpay" className="flex-1 data-[state=active]:bg-blue-600 text-xs sm:text-sm gap-1">
              <Receipt className="w-3.5 h-3.5" /> Bill Pay
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 data-[state=active]:bg-blue-600 text-xs sm:text-sm gap-1">
              <Clock className="w-3.5 h-3.5" /> History
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════  ACCOUNTS TAB  ═══════════════ */}
          <TabsContent value="accounts" className="space-y-4">
            {acctLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-slate-400">Loading accounts...</p>
              </div>
            ) : bankAccounts.length === 0 ? (
              <div className="text-center py-16">
                <CreditCard className="w-14 h-14 text-slate-500 mx-auto mb-4 opacity-50" />
                {isAdmin ? (
                  <>
                    <p className="text-slate-400 mb-2 text-lg">Admin accounts cannot open bank accounts</p>
                    <p className="text-slate-500 text-sm">Use the <button onClick={() => navigate('/admin/invitations')} className="text-blue-400 underline hover:text-blue-300">Invitation System</button> to invite users who can manage their own accounts.</p>
                  </>
                ) : (
                  <>
                    <p className="text-slate-400 mb-4 text-lg">No bank accounts yet</p>
                    <Button onClick={() => setShowAddAccount(true)} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" /> Add Your First Account
                    </Button>
                  </>
                )}
              </div>
            ) : (
              bankAccounts.map((acc: any) => (
                <Card key={acc.id} className={`bg-slate-800 border-slate-700 hover:border-slate-600 transition-all ${acc.isPrimary ? "ring-2 ring-blue-600" : ""}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">{acc.accountType === "checking" ? "🏦" : "💰"}</span>
                          <div className="flex-1">
                            <h3 className="text-white font-semibold text-lg">{acc.accountHolderName || "Bank Account"}</h3>
                            <p className="text-slate-400 text-sm">{acc.bankName}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {acc.isVerified ? (
                              <Badge className="bg-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Verified</Badge>
                            ) : (
                              <Badge className="bg-yellow-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Pending</Badge>
                            )}
                            {acc.isPrimary && <Badge className="bg-blue-600">Primary</Badge>}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-700">
                          <div>
                            <p className="text-slate-400 text-xs mb-1">Account Type</p>
                            <p className="text-white font-medium capitalize">{acc.accountType}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-xs mb-1">Account Number</p>
                            <p className="text-white font-mono">****{acc.accountNumber?.slice(-4)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-xs mb-1">Routing Number</p>
                            <p className="text-white font-mono">****{acc.routingNumber?.slice(-4)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-xs mb-1">Balance</p>
                            <p className="text-white font-semibold">{showBalances ? fmt(acc.availableBalance ?? 0) : "••••"}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-xs mb-1">Added</p>
                            <p className="text-white">{fmtDate(acc.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4 flex-shrink-0">
                        {!acc.isPrimary && (
                          <Button variant="outline" size="sm" className="text-blue-400 border-blue-600 hover:bg-blue-600/20"
                            onClick={() => setPrimaryMutation.mutate({ accountId: acc.id })} disabled={setPrimaryMutation.isPending}>
                            Set Primary
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-600/20"
                          onClick={() => removeAccountMutation.mutate({ accountId: acc.id })} disabled={removeAccountMutation.isPending}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {!acc.isVerified && (
                      <div className="mt-4 pt-4 border-t border-slate-700 bg-yellow-600/10 p-3 rounded-lg">
                        <p className="text-yellow-300 text-sm">
                          ⚠️ Account pending verification.
                          <Button variant="link" className="p-0 ml-2 h-auto text-yellow-200 hover:text-yellow-100"
                            onClick={() => verifyAccountMutation.mutate({ accountId: acc.id })} disabled={verifyAccountMutation.isPending}>
                            {verifyAccountMutation.isPending ? "Verifying..." : "Verify Now"}
                          </Button>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}

            {/* Security Footer */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-5 pb-4">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="flex items-center gap-2"><Lock className="w-4 h-4 text-green-400" /><span className="text-slate-300">256-bit AES Encryption</span></div>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /><span className="text-slate-300">PCI-DSS Compliant</span></div>
                  <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /><span className="text-slate-300">FDIC Insured</span></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════  TRANSFERS TAB  ═══════════════ */}
          <TabsContent value="transfers" className="space-y-4">
            {bankAccounts.length === 0 ? (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="py-12 text-center">
                  <Send className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
                  <p className="text-slate-400 mb-4">Add a bank account first to make transfers</p>
                  <Button onClick={() => { setActiveTab("accounts"); setShowAddAccount(true); }}>
                    <Plus className="w-4 h-4 mr-2" /> Add Account
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Transfer type selector */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {([
                    { key: "wire", label: "Wire Transfer", icon: Send, desc: "Same or next day", color: "blue" },
                    { key: "ach_out", label: "ACH Send", icon: ArrowUpRight, desc: "1-3 business days", color: "purple" },
                    { key: "ach_in", label: "ACH Deposit", icon: ArrowDownLeft, desc: "1-3 business days", color: "green" },
                    { key: "internal", label: "Internal Transfer", icon: ArrowLeftRight, desc: "Instant", color: "cyan" },
                  ] as const).map(({ key, label, icon: Icon, desc, color }) => (
                    <button key={key} onClick={() => setTransferType(key)}
                      className={`p-4 rounded-xl border text-left transition-all ${transferType === key
                        ? `bg-${color}-600/20 border-${color}-500 ring-1 ring-${color}-500`
                        : "bg-slate-800 border-slate-700 hover:border-slate-600"
                      }`}>
                      <Icon className={`w-6 h-6 mb-2 ${transferType === key ? `text-${color}-400` : "text-slate-400"}`} />
                      <p className="text-white font-medium text-sm">{label}</p>
                      <p className="text-slate-400 text-xs">{desc}</p>
                    </button>
                  ))}
                </div>

                {/* Transfer form */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">
                      {transferType === "wire" ? "Wire Transfer" : transferType === "ach_out" ? "ACH Withdrawal" : transferType === "ach_in" ? "ACH Deposit" : "Internal Transfer"}
                    </CardTitle>
                    <CardDescription>
                      {transferType === "wire" ? "Send money via wire transfer (max $25,000)" :
                       transferType === "ach_out" ? "Send money via ACH (max $10,000)" :
                       transferType === "ach_in" ? "Deposit funds via ACH (max $100,000)" :
                       "Transfer between your accounts (instant)"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* From Account */}
                    <div>
                      <label className="text-white text-sm font-medium mb-1 block">
                        {transferType === "ach_in" ? "Deposit To" : "From Account"}
                      </label>
                      <select title="From Account" value={txFromAccount} onChange={(e) => setTxFromAccount(e.target.value ? parseInt(e.target.value) : "")}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2">
                        <option value="">Select account...</option>
                        {(transferType === "ach_in" ? bankAccounts : verifiedAccounts).map((a: any) => (
                          <option key={a.id} value={a.id}>
                            {a.bankName} - {a.accountType} ****{a.accountNumber?.slice(-4)} ({showBalances ? fmt(a.availableBalance ?? 0) : "••••"})
                          </option>
                        ))}
                      </select>
                      {transferType !== "ach_in" && verifiedAccounts.length === 0 && (
                        <p className="text-yellow-400 text-xs mt-1">No verified accounts. Verify an account first.</p>
                      )}
                    </div>

                    {/* To Account (internal transfer) */}
                    {transferType === "internal" && (
                      <div>
                        <label className="text-white text-sm font-medium mb-1 block">To Account</label>
                        <select title="To Account" value={txToAccount} onChange={(e) => setTxToAccount(e.target.value ? parseInt(e.target.value) : "")}
                          className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2">
                          <option value="">Select account...</option>
                          {bankAccounts.filter((a: any) => a.id !== txFromAccount).map((a: any) => (
                            <option key={a.id} value={a.id}>
                              {a.bankName} - {a.accountType} ****{a.accountNumber?.slice(-4)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Recipient info for wire/ACH out */}
                    {(transferType === "wire" || transferType === "ach_out") && (
                      <>
                        <div>
                          <label className="text-white text-sm font-medium mb-1 block">Recipient Name</label>
                          <Input placeholder="Full name or business" value={txRecipientName} onChange={(e) => setTxRecipientName(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-white text-sm font-medium mb-1 block">Account Number</label>
                            <Input placeholder="Recipient account #" value={txRecipientAcct} onChange={(e) => setTxRecipientAcct(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                          </div>
                          <div>
                            <label className="text-white text-sm font-medium mb-1 block">Routing Number</label>
                            <Input placeholder="9-digit routing #" value={txRecipientRouting} onChange={(e) => setTxRecipientRouting(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                          </div>
                        </div>
                        <div>
                          <label className="text-white text-sm font-medium mb-1 block">Bank Name</label>
                          <Input placeholder="Recipient's bank" value={txRecipientBank} onChange={(e) => setTxRecipientBank(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                        </div>
                        {transferType === "wire" && (
                          <div>
                            <label className="text-white text-sm font-medium mb-1 block">SWIFT/BIC Code <span className="text-slate-400">(optional, for international)</span></label>
                            <Input placeholder="e.g. CHASUS33" value={txSwift} onChange={(e) => setTxSwift(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                          </div>
                        )}
                      </>
                    )}

                    {/* Sender info for ACH deposit */}
                    {transferType === "ach_in" && (
                      <>
                        <div>
                          <label className="text-white text-sm font-medium mb-1 block">Description</label>
                          <Input placeholder="What is this deposit for?" value={txDescription} onChange={(e) => setTxDescription(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                        </div>
                        <div>
                          <label className="text-white text-sm font-medium mb-1 block">Sender Name <span className="text-slate-400">(optional)</span></label>
                          <Input placeholder="Who is sending this deposit?" value={txRecipientName} onChange={(e) => setTxRecipientName(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                        </div>
                      </>
                    )}

                    {/* Amount */}
                    <div>
                      <label className="text-white text-sm font-medium mb-1 block">Amount ($)</label>
                      <Input type="number" placeholder="0.00" min="0.01" step="0.01" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} className="bg-slate-700 border-slate-600 text-white text-lg" />
                    </div>

                    {/* Memo */}
                    <div>
                      <label className="text-white text-sm font-medium mb-1 block">Memo <span className="text-slate-400">(optional)</span></label>
                      <Input placeholder="Add a note" value={txMemo} onChange={(e) => setTxMemo(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                    </div>

                    {/* Submit */}
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6" disabled={anyPending}
                      onClick={() => {
                        const amountCents = Math.round(parseFloat(txAmount || "0") * 100);
                        if (amountCents <= 0) { toast.error("Enter a valid amount"); return; }
                        if (!txFromAccount) { toast.error("Select an account"); return; }

                        if (transferType === "wire") {
                          if (!txRecipientName || !txRecipientAcct || !txRecipientRouting || !txRecipientBank) { toast.error("Fill in all recipient details"); return; }
                          wireTransferMutation.mutate({ fromAccountId: txFromAccount as number, amount: amountCents, recipientName: txRecipientName, recipientAccountNumber: txRecipientAcct, recipientRoutingNumber: txRecipientRouting, recipientBankName: txRecipientBank, swiftCode: txSwift || undefined, memo: txMemo || undefined });
                        } else if (transferType === "ach_out") {
                          if (!txRecipientName || !txRecipientAcct || !txRecipientRouting) { toast.error("Fill in all recipient details"); return; }
                          achWithdrawalMutation.mutate({ fromAccountId: txFromAccount as number, amount: amountCents, recipientName: txRecipientName, recipientAccountNumber: txRecipientAcct, recipientRoutingNumber: txRecipientRouting, recipientBankName: txRecipientBank || undefined, memo: txMemo || undefined });
                        } else if (transferType === "ach_in") {
                          if (!txDescription) { toast.error("Add a description"); return; }
                          achDepositMutation.mutate({ toAccountId: txFromAccount as number, amount: amountCents, description: txDescription, senderName: txRecipientName || undefined, memo: txMemo || undefined });
                        } else if (transferType === "internal") {
                          if (!txToAccount) { toast.error("Select destination account"); return; }
                          internalTransferMutation.mutate({ fromAccountId: txFromAccount as number, toAccountId: txToAccount as number, amount: amountCents, memo: txMemo || undefined });
                        }
                      }}>
                      {anyPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : <><Send className="w-4 h-4 mr-2" /> Send Transfer</>}
                    </Button>

                    {/* Transfer info */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                        <h4 className="text-white font-medium text-sm mb-1">Transfer Limits</h4>
                        <ul className="text-slate-400 text-xs space-y-0.5">
                          <li>Wire: up to $25,000</li>
                          <li>ACH: up to $10,000 out / $100,000 in</li>
                          <li>Internal: up to $100,000</li>
                        </ul>
                      </div>
                      <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                        <h4 className="text-white font-medium text-sm mb-1">Processing Times</h4>
                        <ul className="text-slate-400 text-xs space-y-0.5">
                          <li>Wire: Same / next business day</li>
                          <li>ACH: 1-3 business days</li>
                          <li>Internal: Instant</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ═══════════════  DEPOSITS TAB  ═══════════════ */}
          <TabsContent value="deposits" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Smartphone className="w-5 h-5 text-green-400" /> Mobile Check Deposit</CardTitle>
                <CardDescription>Deposit checks by taking a photo. Max $5,000 per check.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-white text-sm font-medium mb-1 block">Deposit To</label>
                  <select title="Deposit To Account" value={mdAccount} onChange={(e) => setMdAccount(e.target.value ? parseInt(e.target.value) : "")}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2">
                    <option value="">Select account...</option>
                    {verifiedAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.bankName} - {a.accountType} ****{a.accountNumber?.slice(-4)}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white text-sm font-medium mb-1 block">Amount ($)</label>
                    <Input type="number" placeholder="0.00" min="0.01" step="0.01" value={mdAmount} onChange={(e) => setMdAmount(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                  <div>
                    <label className="text-white text-sm font-medium mb-1 block">Check Number <span className="text-slate-400">(opt)</span></label>
                    <Input placeholder="#1234" value={mdCheckNumber} onChange={(e) => setMdCheckNumber(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                </div>

                {/* Endorsement Instruction */}
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4">
                  <p className="text-amber-300 text-sm font-semibold mb-1 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Endorsement Required
                  </p>
                  <p className="text-amber-200 text-sm">
                    Please write on the back of your check: <strong className="text-white">"For Mobile Deposit Only at AmeriLendLoan"</strong>
                  </p>
                  <p className="text-amber-200/70 text-xs mt-1">Checks without proper endorsement may be rejected.</p>
                </div>

                {/* Check Images */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white text-sm font-medium mb-1 block">Front of Check</label>
                    <input ref={frontInputRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Front of check image" title="Front of check image"
                      onChange={(e) => handleImageUpload(e, "front")} />
                    <button onClick={() => frontInputRef.current?.click()}
                      className={`w-full h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                        mdFrontImage ? "border-green-500 bg-green-900/20" : "border-slate-600 bg-slate-700/50 hover:border-blue-500"
                      }`}>
                      {mdFrontImage ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-green-400 mb-1" />
                          <span className="text-green-300 text-xs">Front captured</span>
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-6 h-6 text-slate-400 mb-1" />
                          <span className="text-slate-400 text-xs">Tap to capture front</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div>
                    <label className="text-white text-sm font-medium mb-1 block">Back of Check</label>
                    <input ref={backInputRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Back of check image" title="Back of check image"
                      onChange={(e) => handleImageUpload(e, "back")} />
                    <button onClick={() => backInputRef.current?.click()}
                      className={`w-full h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                        mdBackImage ? "border-green-500 bg-green-900/20" : "border-slate-600 bg-slate-700/50 hover:border-blue-500"
                      }`}>
                      {mdBackImage ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-green-400 mb-1" />
                          <span className="text-green-300 text-xs">Back captured</span>
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-6 h-6 text-slate-400 mb-1" />
                          <span className="text-slate-400 text-xs">Tap to capture back</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-white text-sm font-medium mb-1 block">Memo <span className="text-slate-400">(optional)</span></label>
                  <Input placeholder="Add a note" value={mdMemo} onChange={(e) => setMdMemo(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                </div>

                <Button className="w-full bg-green-600 hover:bg-green-700" disabled={mobileDepositMutation.isPending}
                  onClick={() => {
                    const amountCents = Math.round(parseFloat(mdAmount || "0") * 100);
                    if (amountCents <= 0) { toast.error("Enter a valid amount"); return; }
                    if (!mdAccount) { toast.error("Select an account"); return; }
                    if (!mdFrontImage || !mdBackImage) { toast.error("Capture both sides of the check"); return; }
                    mobileDepositMutation.mutate({ toAccountId: mdAccount as number, amount: amountCents, checkNumber: mdCheckNumber || undefined, checkImageFront: mdFrontImage, checkImageBack: mdBackImage, memo: mdMemo || undefined });
                  }}>
                  {mobileDepositMutation.isPending ? "Depositing..." : "Deposit Check"}
                </Button>

                <div className="bg-blue-500/10 border border-blue-600/30 rounded-lg p-3">
                  <p className="text-blue-300 text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    Funds are typically available within 1-2 business days after verification. Larger deposits may take longer.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════  BILL PAY TAB  ═══════════════ */}
          <TabsContent value="billpay" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Receipt className="w-5 h-5 text-purple-400" /> Pay a Bill</CardTitle>
                <CardDescription>Pay bills directly from your bank account. Max $50,000.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-white text-sm font-medium mb-1 block">Pay From</label>
                  <select title="Pay From Account" value={bpAccount} onChange={(e) => setBpAccount(e.target.value ? parseInt(e.target.value) : "")}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2">
                    <option value="">Select account...</option>
                    {verifiedAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.bankName} - {a.accountType} ****{a.accountNumber?.slice(-4)} ({showBalances ? fmt(a.availableBalance ?? 0) : "••••"})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white text-sm font-medium mb-1 block">Payee Name</label>
                    <Input placeholder="e.g. Electric Company" value={bpPayeeName} onChange={(e) => setBpPayeeName(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                  <div>
                    <label className="text-white text-sm font-medium mb-1 block">Account # <span className="text-slate-400">(opt)</span></label>
                    <Input placeholder="Payee acct number" value={bpPayeeAcct} onChange={(e) => setBpPayeeAcct(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white text-sm font-medium mb-1 block">Category</label>
                    <select title="Bill Category" value={bpCategory} onChange={(e) => setBpCategory(e.target.value as any)}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2">
                      {billCategories.map((c) => (
                        <option key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-white text-sm font-medium mb-1 block">Amount ($)</label>
                    <Input type="number" placeholder="0.00" min="0.01" step="0.01" value={bpAmount} onChange={(e) => setBpAmount(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                </div>

                <div>
                  <label className="text-white text-sm font-medium mb-1 block">Schedule Date <span className="text-slate-400">(optional — leave blank for immediate)</span></label>
                  <Input type="date" value={bpScheduledDate} onChange={(e) => setBpScheduledDate(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                </div>

                <div>
                  <label className="text-white text-sm font-medium mb-1 block">Memo <span className="text-slate-400">(optional)</span></label>
                  <Input placeholder="Invoice #, account reference, etc." value={bpMemo} onChange={(e) => setBpMemo(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                </div>

                <Button className="w-full bg-purple-600 hover:bg-purple-700" disabled={billPayMutation.isPending}
                  onClick={() => {
                    const amountCents = Math.round(parseFloat(bpAmount || "0") * 100);
                    if (amountCents <= 0) { toast.error("Enter a valid amount"); return; }
                    if (!bpAccount) { toast.error("Select an account"); return; }
                    if (!bpPayeeName.trim()) { toast.error("Enter payee name"); return; }
                    billPayMutation.mutate({ fromAccountId: bpAccount as number, amount: amountCents, payeeName: bpPayeeName, payeeAccountNumber: bpPayeeAcct || undefined, billCategory: bpCategory, memo: bpMemo || undefined, scheduledDate: bpScheduledDate || undefined });
                  }}>
                  {billPayMutation.isPending ? "Processing..." : bpScheduledDate ? "Schedule Payment" : "Pay Now"}
                </Button>
              </CardContent>
            </Card>

            {/* Recurring Bills */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2"><RefreshCw className="w-4 h-4 text-cyan-400" /> Recurring Bills</CardTitle>
                <CardDescription>Set up automatic recurring bill payments</CardDescription>
              </CardHeader>
              <CardContent>
                {recurringQuery.data && recurringQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {recurringQuery.data.map((bill: any) => (
                      <div key={bill.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                        <div>
                          <p className="text-white font-medium">{bill.payeeName}</p>
                          <p className="text-slate-400 text-xs">{fmt(bill.amount)} · {bill.frequency} · Next: {fmtDate(bill.nextPaymentDate)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {bill.isActive ? (
                            <Badge className="bg-green-600/80 text-xs">Active</Badge>
                          ) : (
                            <Badge className="bg-slate-600 text-xs">Cancelled</Badge>
                          )}
                          {bill.isActive && (
                            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300"
                              onClick={() => cancelRecurringMutation.mutate({ billId: bill.id })} disabled={cancelRecurringMutation.isPending}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm text-center py-4">No recurring bills set up</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════  HISTORY TAB  ═══════════════ */}
          <TabsContent value="history" className="space-y-4">
            {/* Filters */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-4 pb-3">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-slate-400 text-xs mb-1 block">Account</label>
                    <select title="Filter by Account" value={historyAccount} onChange={(e) => setHistoryAccount(e.target.value ? parseInt(e.target.value) : "")}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-2 py-1.5 text-sm">
                      <option value="">All Accounts</option>
                      {bankAccounts.map((a: any) => (
                        <option key={a.id} value={a.id}>{a.bankName} ****{a.accountNumber?.slice(-4)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-slate-400 text-xs mb-1 block">Type</label>
                    <select title="Filter by Type" value={historyType} onChange={(e) => setHistoryType(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-2 py-1.5 text-sm">
                      <option value="">All Types</option>
                      {Object.entries(txTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-slate-400 text-xs mb-1 block">Status</label>
                    <select title="Filter by Status" value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-2 py-1.5 text-sm">
                      <option value="">All</option>
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="returned">Returned</option>
                    </select>
                  </div>
                  <Button variant="outline" size="sm" className="border-slate-600 text-slate-300"
                    onClick={() => { setHistoryAccount(""); setHistoryType(""); setHistoryStatus(""); }}>
                    <Filter className="w-3 h-3 mr-1" /> Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Transaction List */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-4">
                {txQuery.isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Loading transactions...</p>
                  </div>
                ) : !txQuery.data?.transactions?.length ? (
                  <div className="text-center py-12">
                    <Clock className="w-10 h-10 text-slate-500 mx-auto mb-3 opacity-50" />
                    <p className="text-slate-400">No transactions found</p>
                    <p className="text-slate-500 text-sm mt-1">Transactions will appear here after you make transfers, deposits, or payments</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-slate-400 text-sm">{txQuery.data.total} transaction{txQuery.data.total !== 1 ? "s" : ""}</p>
                      <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => txQuery.refetch()}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {txQuery.data.transactions.map((tx: any) => {
                        const isCredit = tx.amount > 0;
                        return (
                          <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg border border-slate-600/50 hover:bg-slate-700/60 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isCredit ? "bg-green-600/20" : "bg-red-600/20"}`}>
                                {isCredit ? <ArrowDownLeft className="w-4 h-4 text-green-400" /> : <ArrowUpRight className="w-4 h-4 text-red-400" />}
                              </div>
                              <div>
                                <p className="text-white font-medium text-sm">{tx.description}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-slate-400 text-xs">{txTypeLabels[tx.type] || tx.type}</span>
                                  <span className="text-slate-600">·</span>
                                  <span className="text-slate-400 text-xs">{fmtDateTime(tx.createdAt)}</span>
                                </div>
                                {tx.referenceNumber && <p className="text-slate-500 text-[10px] mt-0.5">Ref: {tx.referenceNumber}</p>}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${isCredit ? "text-green-400" : "text-red-400"}`}>
                                {isCredit ? "+" : ""}{fmt(Math.abs(tx.amount))}
                              </p>
                              <Badge className={`${statusColors[tx.status] || "bg-slate-600"} text-[10px] px-1.5 mt-1`}>
                                {tx.status}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default BankAccountManagement;
