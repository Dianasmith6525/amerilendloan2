import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LoanStatusTimelineProps {
  currentStatus: string;
  createdAt: Date | string;
  approvedAt?: Date | string | null;
  feePaidAt?: Date | string | null;
  disbursedAt?: Date | string | null;
}

export default function LoanStatusTimeline({
  currentStatus,
  createdAt,
  approvedAt,
  feePaidAt,
  disbursedAt,
}: LoanStatusTimelineProps) {
  // Helper to convert dates
  const toDate = (d: Date | string | null | undefined): Date | null => {
    if (!d) return null;
    if (d instanceof Date) return d;
    return new Date(d);
  };

  // Calculate days elapsed
  const calculateDaysElapsed = (fromDate: Date | null, toDate: Date | null): number => {
    if (!fromDate || !toDate) return 0;
    return Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const createdDate = toDate(createdAt)!;
  const approvedDate = toDate(approvedAt);
  const feePaidDate = toDate(feePaidAt);
  const disbursedDate = toDate(disbursedAt);
  const now = new Date();

  // Calculate days in each stage
  const stages = [
    {
      status: "pending",
      label: "Application Submitted",
      description: "Your application is under review",
      completedDate: approvedDate,
      daysElapsed: approvedDate
        ? calculateDaysElapsed(createdDate, approvedDate)
        : calculateDaysElapsed(createdDate, now),
    },
    {
      status: "approved",
      label: "Approved",
      description: "Your loan has been approved",
      completedDate: feePaidDate,
      daysElapsed: feePaidDate
        ? calculateDaysElapsed(approvedDate || createdDate, feePaidDate)
        : approvedDate
        ? calculateDaysElapsed(approvedDate, now)
        : 0,
    },
    {
      status: "fee_paid",
      label: "Fee Paid",
      description: "Processing fee confirmed",
      completedDate: disbursedDate,
      daysElapsed: disbursedDate
        ? calculateDaysElapsed(feePaidDate || approvedDate || createdDate, disbursedDate)
        : feePaidDate
        ? calculateDaysElapsed(feePaidDate, now)
        : 0,
    },
    {
      status: "disbursed",
      label: "Funds Disbursed",
      description: "Funds have been transferred to your account",
      completedDate: disbursedDate,
      daysElapsed: 0,
    },
  ];

  const getStageIndex = (status: string): number => {
    const statusMap: { [key: string]: number } = {
      pending: 0,
      approved: 1,
      fee_pending: 1,
      fee_paid: 2,
      disbursed: 3,
      rejected: 0,
    };
    return statusMap[status] || 0;
  };

  const currentStageIndex = getStageIndex(currentStatus);
  const statusOrder = ["pending", "approved", "fee_paid", "disbursed"];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg text-[#0A2540]">Loan Application Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Timeline visualization */}
          <div className="relative">
            {/* Horizontal line connecting stages */}
            <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 -z-10">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${(currentStageIndex / 3) * 100}%` }}
              />
            </div>

            {/* Stages */}
            <div className="flex justify-between">
              {statusOrder.map((status, index) => {
                const isCompleted = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                const stage = stages[index];

                return (
                  <div key={status} className="flex flex-col items-center flex-1">
                    {/* Stage Circle */}
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center 
                        transition-all duration-300 relative z-10
                        ${
                          isCompleted
                            ? "bg-green-500 text-white"
                            : isCurrent
                            ? "bg-[#0A2540] text-white ring-4 ring-blue-100"
                            : "bg-gray-200 text-gray-500"
                        }
                      `}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : isCurrent ? (
                        <Clock className="w-5 h-5" />
                      ) : (
                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      )}
                    </div>

                    {/* Stage Label & Details */}
                    <div className="mt-3 text-center w-full px-2">
                      <p className={`text-sm font-semibold ${isCurrent ? "text-[#0A2540]" : "text-gray-600"}`}>
                        {stage.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{stage.description}</p>

                      {/* Time elapsed */}
                      {isCompleted && stage.daysElapsed > 0 && (
                        <p className="text-xs text-green-600 mt-1 font-medium">
                          {stage.daysElapsed} day{stage.daysElapsed > 1 ? "s" : ""} ago
                        </p>
                      )}

                      {isCurrent && (
                        <div className="mt-2 px-2 py-1 bg-blue-50 rounded text-xs">
                          <p className="font-semibold text-[#0A2540]">
                            {stage.daysElapsed} day{stage.daysElapsed > 1 ? "s" : ""} in this stage
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current status message */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#0A2540] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-[#0A2540]">
                  {currentStatus === "pending" && "Your application is being reviewed"}
                  {currentStatus === "approved" && "Your loan has been approved!"}
                  {(currentStatus === "fee_pending" || currentStatus === "fee_paid") && "Processing fee received"}
                  {currentStatus === "disbursed" && "Funds have been transferred"}
                  {currentStatus === "rejected" && "Application could not be approved"}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {currentStatus === "pending" &&
                    "We'll notify you as soon as a decision is made. Typically takes 1-2 business days."}
                  {currentStatus === "approved" &&
                    "Please pay the processing fee to proceed with fund disbursement."}
                  {(currentStatus === "fee_pending" || currentStatus === "fee_paid") &&
                    "Your fee has been processed. Funds will be sent within 24 hours."}
                  {currentStatus === "disbursed" && "All done! Check your bank account for the funds."}
                  {currentStatus === "rejected" &&
                    "Unfortunately, we were unable to approve your application at this time. Please contact support for details."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
