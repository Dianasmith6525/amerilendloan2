import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, XCircle, Zap, Plus, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface AutomationRule {
  id: number;
  name: string;
  enabled: boolean;
  type: string;
  conditions: {
    field: string;
    operator: string;
    value: string;
  }[];
  action: {
    type: string;
    value: string;
  };
}

export default function AutomatedWorkflows() {
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleType, setNewRuleType] = useState("auto-approve");

  // Fetch rules from server
  const { data: rulesData, isLoading, refetch: refetchRules } =
    trpc.automationRules.getAll.useQuery();

  const rules: AutomationRule[] = (rulesData as any)?.data || rulesData || [];

  // Create rule mutation
  const createRule = trpc.automationRules.create.useMutation({
    onSuccess: () => {
      refetchRules();
      setNewRuleName("");
      toast.success("Rule created");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create rule"),
  });

  // Update rule mutation (for toggle)
  const updateRule = trpc.automationRules.update.useMutation({
    onSuccess: () => {
      refetchRules();
      toast.success("Rule updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update rule"),
  });

  // Delete rule mutation
  const deleteRuleMut = trpc.automationRules.delete.useMutation({
    onSuccess: () => {
      refetchRules();
      toast.success("Rule deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete rule"),
  });

  const toggleRule = (id: number, currentEnabled: boolean) => {
    updateRule.mutate({ id, enabled: !currentEnabled });
  };

  const deleteRule = (id: number) => {
    deleteRuleMut.mutate({ id });
  };

  const addRule = () => {
    if (!newRuleName.trim()) {
      toast.error("Please enter a rule name");
      return;
    }

    createRule.mutate({
      name: newRuleName,
      enabled: true,
      type: newRuleType,
      conditions: [{ field: "requestedAmount", operator: ">=", value: "0" }],
      action: { type: "approve", value: "auto" },
    });
  };

  const getRuleIcon = (type: string) => {
    switch (type) {
      case "auto-approve":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "auto-reject":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "status-transition":
        return <Zap className="h-5 w-5 text-blue-600" />;
      default:
        return <Zap className="h-5 w-5 text-purple-600" />;
    }
  };

  const getRuleBadgeColor = (type: string) => {
    switch (type) {
      case "auto-approve":
        return "bg-green-100 text-green-800";
      case "auto-reject":
        return "bg-red-100 text-red-800";
      case "status-transition":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-purple-100 text-purple-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Auto-Approve Rules</p>
                <p className="text-2xl font-bold text-green-600">
                  {rules.filter(r => r.type === "auto-approve" && r.enabled).length}
                </p>
              </div>
              <CheckCircle className="h-10 w-10 text-green-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Auto-Reject Rules</p>
                <p className="text-2xl font-bold text-red-600">
                  {rules.filter(r => r.type === "auto-reject" && r.enabled).length}
                </p>
              </div>
              <XCircle className="h-10 w-10 text-red-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Workflow Rules</p>
                <p className="text-2xl font-bold text-blue-600">
                  {rules.filter(r => r.type === "status-transition" && r.enabled).length}
                </p>
              </div>
              <Zap className="h-10 w-10 text-blue-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create New Rule */}
      <Card className="shadow-md border-2 border-dashed border-blue-300">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Automation Rule
          </CardTitle>
          <CardDescription>Define conditions and actions for automated loan processing</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Rule name (e.g., Auto-approve loans under $10K)"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select value={newRuleType} onValueChange={setNewRuleType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto-approve">Auto-Approve</SelectItem>
                  <SelectItem value="auto-reject">Auto-Reject</SelectItem>
                  <SelectItem value="status-transition">Status Transition</SelectItem>
                  <SelectItem value="ticket-routing">Ticket Routing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addRule} disabled={createRule.isPending}>
              {createRule.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Rule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Rules */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Active Automation Rules</CardTitle>
          <CardDescription>Manage automated workflows and processing rules</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
            </div>
          ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <Card key={rule.id} className={`border-l-4 ${rule.enabled ? 'border-l-green-500' : 'border-l-gray-300'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getRuleIcon(rule.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900">{rule.name}</h4>
                          <Badge className={getRuleBadgeColor(rule.type)}>
                            {rule.type.replace(/-/g, " ")}
                          </Badge>
                          {rule.enabled && (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-600 font-medium">Conditions:</p>
                          <ul className="list-disc list-inside text-gray-700 pl-2">
                            {(rule.conditions || []).map((cond: any, idx: number) => (
                              <li key={idx}>
                                {cond.field} {cond.operator} {cond.value}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-2 text-sm">
                          <p className="text-gray-600 font-medium">Action:</p>
                          <p className="text-gray-700 pl-2">
                            {rule.action?.type}: {rule.action?.value}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`rule-${rule.id}`} className="text-sm cursor-pointer">
                          {rule.enabled ? "Enabled" : "Disabled"}
                        </Label>
                        <Switch
                          id={`rule-${rule.id}`}
                          checked={rule.enabled}
                          onCheckedChange={() => toggleRule(rule.id, rule.enabled)}
                          disabled={updateRule.isPending}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRule(rule.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={deleteRuleMut.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {rules.length === 0 && (
              <div className="text-center py-12">
                <Zap className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No automation rules configured</p>
                <p className="text-xs text-gray-400 mt-1">Create rules to automate loan processing</p>
              </div>
            )}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-6">
          <h3 className="font-bold text-purple-900 mb-3">How Automation Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-purple-800">
            <div>
              <p className="font-semibold mb-1">🤖 Auto-Approve Rules</p>
              <p>Automatically approve applications that meet specific criteria (e.g., loan amount, credit score).</p>
            </div>
            <div>
              <p className="font-semibold mb-1">🚫 Auto-Reject Rules</p>
              <p>Automatically reject applications that don't meet minimum requirements.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">⚡ Status Transitions</p>
              <p>Automatically move applications through workflow stages when conditions are met.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">📮 Smart Routing</p>
              <p>Route support tickets to appropriate teams based on category or priority.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
