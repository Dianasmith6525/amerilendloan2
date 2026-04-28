import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, ArrowLeft, Plus, Trash2, Edit, Save,
  Zap, Settings2, X
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface ActionConfig {
  type: string;
  value: string;
}

interface AutomationRule {
  id: number;
  name: string;
  enabled: boolean;
  type: string;
  conditions: Condition[];
  action: ActionConfig;
  createdAt?: string | Date;
}

export default function AdminAutomationRules() {
  const [, setLocation] = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [ruleType, setRuleType] = useState("loan_status_change");
  const [conditions, setConditions] = useState<Condition[]>([{ field: "", operator: "equals", value: "" }]);
  const [action, setAction] = useState<ActionConfig>({ type: "send_notification", value: "" });

  const { data: rulesData, isLoading } = trpc.automationRules.getAll.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.automationRules.create.useMutation({
    onSuccess: () => {
      toast.success("Automation rule created successfully");
      utils.automationRules.getAll.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.automationRules.update.useMutation({
    onSuccess: () => {
      toast.success("Rule updated successfully");
      utils.automationRules.getAll.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.automationRules.delete.useMutation({
    onSuccess: () => {
      toast.success("Rule deleted successfully");
      utils.automationRules.getAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const rules = rulesData?.data ?? [];

  const resetForm = () => {
    setShowCreateForm(false);
    setEditingRule(null);
    setName("");
    setEnabled(true);
    setRuleType("loan_status_change");
    setConditions([{ field: "", operator: "equals", value: "" }]);
    setAction({ type: "send_notification", value: "" });
  };

  const startEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setShowCreateForm(true);
    setName(rule.name);
    setEnabled(rule.enabled);
    setRuleType(rule.type);
    setConditions(
      Array.isArray(rule.conditions) && rule.conditions.length > 0
        ? rule.conditions
        : [{ field: "", operator: "equals", value: "" }]
    );
    setAction(rule.action || { type: "send_notification", value: "" });
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    const validConditions = conditions.filter((c) => c.field && c.value);
    if (validConditions.length === 0) {
      toast.error("At least one condition is required");
      return;
    }
    if (!action.type || !action.value) {
      toast.error("Action type and value are required");
      return;
    }

    if (editingRule) {
      updateMutation.mutate({
        id: editingRule.id,
        name,
        enabled,
        type: ruleType,
        conditions: validConditions,
        action,
      });
    } else {
      createMutation.mutate({
        name,
        enabled,
        type: ruleType,
        conditions: validConditions,
        action,
      });
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { field: "", operator: "equals", value: "" }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, key: keyof Condition, value: string) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [key]: value };
    setConditions(updated);
  };

  const ruleTypeOptions = [
    { value: "loan_status_change", label: "Loan Status Change" },
    { value: "payment_received", label: "Payment Received" },
    { value: "payment_overdue", label: "Payment Overdue" },
    { value: "document_uploaded", label: "Document Uploaded" },
    { value: "kyc_status_change", label: "KYC Status Change" },
    { value: "fee_paid", label: "Fee Paid" },
    { value: "application_submitted", label: "Application Submitted" },
  ];

  const actionTypeOptions = [
    { value: "send_notification", label: "Send Notification" },
    { value: "send_email", label: "Send Email" },
    { value: "update_status", label: "Update Status" },
    { value: "assign_agent", label: "Assign Agent" },
    { value: "create_task", label: "Create Task" },
    { value: "flag_review", label: "Flag for Review" },
  ];

  const operatorOptions = [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Not Equals" },
    { value: "greater_than", label: "Greater Than" },
    { value: "less_than", label: "Less Than" },
    { value: "contains", label: "Contains" },
    { value: "starts_with", label: "Starts With" },
  ];

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")} className="text-slate-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Zap className="h-8 w-8 text-amber-400" />
                Automation Rules
              </h1>
              <p className="text-slate-400 mt-1">Configure automated workflows and triggers</p>
            </div>
          </div>
          {!showCreateForm && (
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Rule
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-white">{rules.length}</p>
              <p className="text-slate-400 text-sm">Total Rules</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-green-400">
                {rules.filter((r) => r.enabled).length}
              </p>
              <p className="text-slate-400 text-sm">Active</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-slate-500">
                {rules.filter((r) => !r.enabled).length}
              </p>
              <p className="text-slate-400 text-sm">Disabled</p>
            </CardContent>
          </Card>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">
                  {editingRule ? "Edit Rule" : "Create New Rule"}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={resetForm} className="text-slate-400">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Rule Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Auto-approve small loans"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Trigger Type</label>
                  <select
                    title="Trigger type"
                    value={ruleType}
                    onChange={(e) => setRuleType(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                  >
                    {ruleTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <label className="text-sm text-slate-300">Rule enabled</label>
              </div>

              {/* Conditions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-400">Conditions</h3>
                  <Button variant="ghost" size="sm" onClick={addCondition} className="text-amber-400 hover:text-amber-300">
                    <Plus className="h-3 w-3 mr-1" /> Add Condition
                  </Button>
                </div>
                <div className="space-y-2">
                  {conditions.map((cond, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={cond.field}
                        onChange={(e) => updateCondition(index, "field", e.target.value)}
                        placeholder="Field (e.g. amount)"
                        className="bg-slate-700 border-slate-600 text-white flex-1"
                      />
                      <select
                        title="Condition operator"
                        value={cond.operator}
                        onChange={(e) => updateCondition(index, "operator", e.target.value)}
                        className="bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                      >
                        {operatorOptions.map((op) => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <Input
                        value={cond.value}
                        onChange={(e) => updateCondition(index, "value", e.target.value)}
                        placeholder="Value"
                        className="bg-slate-700 border-slate-600 text-white flex-1"
                      />
                      {conditions.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeCondition(index)} className="text-red-400 hover:text-red-300 shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Action</h3>
                <div className="flex gap-2">
                  <select
                    title="Action type"
                    value={action.type}
                    onChange={(e) => setAction({ ...action, type: e.target.value })}
                    className="bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                  >
                    {actionTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <Input
                    value={action.value}
                    onChange={(e) => setAction({ ...action, value: e.target.value })}
                    placeholder="Action value (e.g. message text, status name)"
                    className="bg-slate-700 border-slate-600 text-white flex-1"
                  />
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={resetForm} className="text-slate-400">
                  Cancel
                </Button>
                <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  {editingRule ? "Update Rule" : "Create Rule"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rules List */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings2 className="h-5 w-5" /> All Rules
            </CardTitle>
            <CardDescription className="text-slate-400">
              Manage your automation rules and their triggers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-12">
                <Zap className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No automation rules configured</p>
                <Button
                  className="mt-4 bg-amber-600 hover:bg-amber-700"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" /> Create Your First Rule
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-4 rounded-lg bg-slate-700/50 border border-slate-600 hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${rule.enabled ? "bg-green-400" : "bg-slate-500"}`} />
                        <div>
                          <p className="text-white font-medium">{rule.name}</p>
                          <p className="text-slate-400 text-sm mt-1">
                            Trigger: <span className="text-slate-300">{rule.type?.replace(/_/g, " ")}</span>
                            {rule.conditions && Array.isArray(rule.conditions) && (
                              <span className="ml-2">
                                • {rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            {rule.action && (
                              <span className="ml-2">
                                → {rule.action.type?.replace(/_/g, " ")}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={rule.enabled ? "bg-green-600" : "bg-slate-600"}>
                          {rule.enabled ? "Active" : "Disabled"}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => startEdit(rule)} className="text-slate-400 hover:text-white">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this automation rule?")) {
                              deleteMutation.mutate({ id: rule.id });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
