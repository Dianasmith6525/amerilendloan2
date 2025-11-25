import { Check, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LoanApplicationProgressProps {
  status: string;
  processingFeeAmount?: number;
  approvedAmount?: number;
}

const applicationStages = [
  {
    key: "submitted",
    label: "Application Submitted",
    description: "Your application has been received",
    statuses: ["pending", "under_review", "approved", "fee_pending", "fee_paid", "disbursed"],
  },
  {
    key: "review",
    label: "Under Review",
    description: "Our team is reviewing your application",
    statuses: ["under_review", "approved", "fee_pending", "fee_paid", "disbursed"],
  },
  {
    key: "approved",
    label: "Loan Approved",
    description: "Congratulations! Your loan is approved",
    statuses: ["approved", "fee_pending", "fee_paid", "disbursed"],
  },
  {
    key: "payment",
    label: "Processing Fee Payment",
    description: "Pay the processing fee to continue",
    statuses: ["fee_pending", "fee_paid", "disbursed"],
  },
  {
    key: "disbursement",
    label: "Loan Disbursed",
    description: "Funds transferred to your account",
    statuses: ["disbursed"],
  },
];

export default function LoanApplicationProgress({ status, processingFeeAmount, approvedAmount }: LoanApplicationProgressProps) {
  const getCurrentStageIndex = () => {
    return applicationStages.findIndex((stage) => stage.statuses.includes(status));
  };

  const isStageCompleted = (stageIndex: number) => {
    return stageIndex < getCurrentStageIndex();
  };

  const isStageCurrent = (stageIndex: number) => {
    return stageIndex === getCurrentStageIndex();
  };

  const currentStageIndex = getCurrentStageIndex();

  // Handle rejected/cancelled status
  if (status === "rejected" || status === "cancelled") {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-xl text-red-800">Application Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="font-semibold text-red-900 mb-2">
              {status === "rejected" ? "Application Not Approved" : "Application Cancelled"}
            </p>
            <p className="text-sm text-red-700">
              {status === "rejected"
                ? "We're unable to approve your loan application at this time. Please contact us for more details."
                : "This application has been cancelled."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl text-[#0033A0]">Application Progress</CardTitle>
        <CardDescription>Track your loan application journey</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div
            className="absolute left-6 top-0 w-0.5 bg-[#0033A0] transition-all duration-500"
            style={{
              height: `${(currentStageIndex / (applicationStages.length - 1)) * 100}%`,
            }}
          />

          {/* Stages */}
          <div className="space-y-8">
            {applicationStages.map((stage, index) => {
              const completed = isStageCompleted(index);
              const current = isStageCurrent(index);
              const upcoming = !completed && !current;

              return (
                <div key={stage.key} className="relative flex items-start gap-4">
                  {/* Stage Icon */}
                  <div className="relative z-10">
                    {completed ? (
                      <div className="w-12 h-12 rounded-full bg-[#0033A0] flex items-center justify-center border-4 border-white shadow-md">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                    ) : current ? (
                      <div className="w-12 h-12 rounded-full bg-[#FFA500] flex items-center justify-center border-4 border-white shadow-md animate-pulse">
                        <Circle className="w-6 h-6 text-white fill-white" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white">
                        <Circle className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Stage Content */}
                  <div className="flex-1 pb-4">
                    <div
                      className={`p-4 rounded-lg border-2 ${
                        completed
                          ? "bg-green-50 border-green-200"
                          : current
                          ? "bg-orange-50 border-orange-300 shadow-md"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4
                            className={`font-bold mb-1 ${
                              completed
                                ? "text-green-900"
                                : current
                                ? "text-orange-900"
                                : "text-gray-600"
                            }`}
                          >
                            {stage.label}
                          </h4>
                          <p
                            className={`text-sm ${
                              completed
                                ? "text-green-700"
                                : current
                                ? "text-orange-700"
                                : "text-gray-500"
                            }`}
                          >
                            {stage.description}
                          </p>

                          {/* Additional Info */}
                          {current && stage.key === "payment" && processingFeeAmount && (
                            <div className="mt-2 text-sm font-semibold text-orange-800">
                              Amount Due: ${(processingFeeAmount / 100).toFixed(2)}
                            </div>
                          )}
                          {current && stage.key === "disbursement" && approvedAmount && (
                            <div className="mt-2 text-sm font-semibold text-green-800">
                              Disbursement Amount: ${(approvedAmount / 100).toFixed(2)}
                            </div>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div>
                          {completed && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              Completed
                            </span>
                          )}
                          {current && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                              Current Step
                            </span>
                          )}
                          {upcoming && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Estimated Timeline */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>⏱️ Estimated Timeline:</strong> Most applications are reviewed within 24-48
            hours. Disbursement typically occurs 1-2 business days after payment confirmation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
