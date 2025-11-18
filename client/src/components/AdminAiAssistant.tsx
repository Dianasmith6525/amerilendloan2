import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Loader2, Zap, TrendingUp, AlertCircle, CheckCircle, Target } from "lucide-react";
import { toast } from "sonner";

interface AdminAiAssistantProps {
  applicationId?: number;
  onTaskExecuted?: () => void;
}

export default function AdminAiAssistant({ applicationId, onTaskExecuted }: AdminAiAssistantProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"recommendation" | "insights" | "batch">("recommendation");
  const [batchAction, setBatchAction] = useState<"auto_approve" | "review_priority" | "flag_fraud">("auto_approve");
  const [batchLimit, setBatchLimit] = useState(5);

  // Queries and mutations
  const { data: recommendation, isLoading: loadingRecommendation, refetch: refetchRecommendation } =
    trpc.adminAi.getApplicationRecommendation.useQuery(
      { applicationId: applicationId || 0 },
      { enabled: !!applicationId && open && activeTab === "recommendation" }
    );

  const { data: insights, isLoading: loadingInsights, refetch: refetchInsights } =
    trpc.adminAi.getPendingApplicationsInsights.useQuery(
      { limit: 10 },
      { enabled: open && activeTab === "insights" }
    );

  const { data: suggestedTasks } = trpc.adminAi.getSuggestedTasks.useQuery(undefined, {
    enabled: open,
  });

  const { mutate: processBatch, isPending: processingBatch } = trpc.adminAi.processBatchApplications.useMutation({
    onSuccess: () => {
      toast.success("Batch processing plan generated!");
      onTaskExecuted?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to process batch");
    },
  });

  const handleProcessBatch = () => {
    processBatch({ action: batchAction, limit: batchLimit });
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="gap-2"
        title="AI Admin Assistant"
      >
        <Zap className="h-4 w-4" />
        AI Assistant
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Admin AI Assistant
            </DialogTitle>
            <DialogDescription>
              Get intelligent recommendations and automation assistance for admin tasks
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-96 w-full rounded-md border p-4">
            {/* Recommendation Tab */}
            {activeTab === "recommendation" && (
              <div className="space-y-4">
                {!applicationId ? (
                  <div className="text-center text-gray-500">
                    Select an application to get AI recommendations
                  </div>
                ) : loadingRecommendation ? (
                  <div className="flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : recommendation ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm font-medium text-gray-600">Applicant</div>
                          <div className="text-lg font-semibold">{recommendation.applicantName}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm font-medium text-gray-600">Application ID</div>
                          <div className="text-lg font-semibold">#{recommendation.applicationId}</div>
                        </CardContent>
                      </Card>
                    </div>
                    <Card>
                      <CardContent className="pt-4 whitespace-pre-wrap text-sm">
                        {typeof recommendation.recommendation === 'string' 
                          ? recommendation.recommendation 
                          : JSON.stringify(recommendation.recommendation)}
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </div>
            )}

            {/* Insights Tab */}
            {activeTab === "insights" && (
              <div className="space-y-4">
                {loadingInsights ? (
                  <div className="flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : insights ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm font-medium text-gray-600">Pending Apps</div>
                          <div className="text-lg font-semibold">{insights.count}</div>
                        </CardContent>
                      </Card>
                    </div>
                    <Card>
                      <CardContent className="pt-4 whitespace-pre-wrap text-sm">
                        {typeof insights.message === 'string' 
                          ? insights.message 
                          : JSON.stringify(insights.message)}
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </div>
            )}

            {/* Batch Tab */}
            {activeTab === "batch" && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Batch Action</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Action Type</label>
                      <div className="mt-2 space-y-2">
                        {(["auto_approve", "review_priority", "flag_fraud"] as const).map((action) => (
                          <label key={action} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="batch-action"
                              value={action}
                              checked={batchAction === action}
                              onChange={(e) => setBatchAction(e.target.value as typeof action)}
                              className="rounded-full"
                            />
                            <span className="text-sm">
                              {action === "auto_approve" && "Auto-Approve Eligible"}
                              {action === "review_priority" && "Prioritize for Review"}
                              {action === "flag_fraud" && "Flag Suspicious Applications"}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="batch-limit" className="text-sm font-medium">Limit</label>
                      <input
                        id="batch-limit"
                        type="number"
                        min="1"
                        max="50"
                        value={batchLimit}
                        onChange={(e) => setBatchLimit(parseInt(e.target.value))}
                        className="mt-2 w-full px-3 py-2 border rounded-md"
                        aria-label="Batch processing limit"
                      />
                    </div>
                  </CardContent>
                </Card>

                {processingBatch ? (
                  <div className="flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <Button onClick={handleProcessBatch} className="w-full">
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Batch Plan
                  </Button>
                )}
              </div>
            )}

            {/* Suggested Tasks */}
            {suggestedTasks && (
              <div className="mt-6 space-y-2 border-t pt-4">
                <div className="text-sm font-medium">Suggested Tasks</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedTasks.tasks.map((task, i) => (
                    <Badge key={i} variant="secondary">
                      {task}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Tabs */}
          <div className="flex gap-2 border-t pt-4">
            <Button
              variant={activeTab === "recommendation" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("recommendation")}
              disabled={!applicationId}
              className="flex-1"
            >
              <Target className="h-4 w-4 mr-1" />
              Recommendation
            </Button>
            <Button
              variant={activeTab === "insights" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("insights")}
              className="flex-1"
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Insights
            </Button>
            <Button
              variant={activeTab === "batch" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("batch")}
              className="flex-1"
            >
              <Zap className="h-4 w-4 mr-1" />
              Batch
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
