import { useState } from "react";
import { Search, AlertCircle, CheckCircle2, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export function ApplicationTracking() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [showTracker, setShowTracker] = useState(false);
  const [searched, setSearched] = useState(false);

  const { data: application, isLoading, error } = trpc.loans.getLoanByTrackingNumber.useQuery(
    { trackingNumber },
    { enabled: searched && trackingNumber.length > 0 }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      setSearched(true);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
      case "fee_paid":
      case "disbursed":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "rejected":
      case "cancelled":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "pending":
      case "under_review":
      case "fee_pending":
        return <Clock className="w-5 h-5 text-blue-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
      case "fee_paid":
      case "disbursed":
        return "bg-green-50 border-green-200";
      case "rejected":
      case "cancelled":
        return "bg-red-50 border-red-200";
      case "pending":
      case "under_review":
      case "fee_pending":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="w-full">
      {/* Tracker Button */}
      <button
        onClick={() => setShowTracker(!showTracker)}
        title="Track your loan application by tracking number"
        className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium text-white bg-[#0033A0] hover:bg-[#002080] transition-colors whitespace-nowrap"
      >
        <Search className="w-3 h-3 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Track Application</span>
        <span className="sm:hidden">Track</span>
      </button>

      {/* Tracker Modal */}
      {showTracker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="border-b pb-3 sm:pb-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg sm:text-2xl">Track Your Application</CardTitle>
                <button
                  onClick={() => {
                    setShowTracker(false);
                    setSearched(false);
                  }}
                  title="Close tracking modal"
                  className="text-gray-500 hover:text-gray-700 font-bold text-lg flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6">
              {/* Search Form */}
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium text-gray-700">
                    Tracking Number
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., APP-2024-001234"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
                      className="flex-1 text-xs sm:text-sm"
                    />
                    <Button
                      type="submit"
                      disabled={isLoading || !trackingNumber.trim()}
                      className="bg-[#0033A0] hover:bg-[#002080] text-xs sm:text-sm px-3 sm:px-4"
                    >
                      {isLoading ? "..." : "Search"}
                    </Button>
                  </div>
                </div>
              </form>

              {/* Search Results */}
              {searched && (
                <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
                  {error ? (
                    <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs sm:text-sm text-red-700">
                        {error instanceof Error
                          ? error.message
                          : "Application not found. Please check your tracking number."}
                      </p>
                    </div>
                  ) : isLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-[#0033A0]" />
                    </div>
                  ) : application ? (
                    <div className="space-y-3 sm:space-y-4">
                      {/* Status Badge */}
                      <div className={`p-3 sm:p-4 border rounded-lg ${getStatusColor(application.status)}`}>
                        <div className="flex items-center gap-2 sm:gap-3">
                          {getStatusIcon(application.status)}
                          <div className="min-w-0">
                            <p className="text-xs text-gray-600">Current Status</p>
                            <p className="font-semibold text-xs sm:text-sm text-gray-900 truncate">
                              {getStatusLabel(application.status)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Application Details */}
                      <div className="space-y-2 sm:space-y-3 bg-gray-50 p-3 sm:p-4 rounded-lg">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-600">Applicant Name</p>
                          <p className="font-semibold text-xs sm:text-sm text-gray-900 truncate">{application.fullName}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:gap-4">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-600">Loan Type</p>
                            <p className="font-semibold text-xs sm:text-sm text-gray-900">
                              {application.loanType === "installment"
                                ? "Installment"
                                : "Short Term"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-600">Amount</p>
                            <p className="font-semibold text-xs sm:text-sm text-gray-900">
                              ${(application.requestedAmount / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {application.approvedAmount && (
                          <div>
                            <p className="text-xs text-gray-600">Approved Amount</p>
                            <p className="font-semibold text-xs sm:text-sm text-green-600">
                              ${(application.approvedAmount / 100).toFixed(2)}
                            </p>
                          </div>
                        )}

                        {application.processingFeeAmount && (
                          <div>
                            <p className="text-xs text-gray-600">Processing Fee</p>
                            <p className="font-semibold text-xs sm:text-sm text-gray-900">
                              ${(application.processingFeeAmount / 100).toFixed(2)}
                            </p>
                          </div>
                        )}

                        <div>
                          <p className="text-xs text-gray-600">Submitted</p>
                          <p className="font-semibold text-xs sm:text-sm text-gray-900">
                            {new Date(application.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        {application.rejectionReason && (
                          <div className="bg-red-50 p-3 rounded border border-red-200">
                            <p className="text-xs text-gray-600 mb-1">Rejection Reason</p>
                            <p className="text-sm text-red-700">{application.rejectionReason}</p>
                          </div>
                        )}
                      </div>

                      {/* Status Timeline */}
                      <div className="space-y-2 bg-blue-50 p-4 rounded-lg">
                        <p className="text-xs font-semibold text-gray-600 uppercase">Status Timeline</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span className="text-gray-700">Application Submitted</span>
                          </div>
                          {(
                            application.status === "under_review" ||
                            application.status === "approved" ||
                            application.status === "fee_pending" ||
                            application.status === "fee_paid" ||
                            application.status === "disbursed"
                          ) && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                              <span className="text-gray-700">Under Review</span>
                            </div>
                          )}
                          {(
                            application.status === "approved" ||
                            application.status === "fee_pending" ||
                            application.status === "fee_paid" ||
                            application.status === "disbursed"
                          ) && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                              <span className="text-gray-700">Approved</span>
                            </div>
                          )}
                          {(application.status === "fee_pending" || application.status === "fee_paid" || application.status === "disbursed") && (
                            <div className="flex items-center gap-2">
                              {application.status === "fee_paid" || application.status === "disbursed" ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              )}
                              <span className="text-gray-700">Fee Payment</span>
                            </div>
                          )}
                          {application.status === "disbursed" && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                              <span className="text-gray-700">Disbursed</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Next Steps */}
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-gray-900 mb-2">📝 Next Steps:</p>
                        {application.status === "pending" && (
                          <p className="text-sm text-gray-700">
                            Your application is pending review. We'll notify you once the review is complete.
                          </p>
                        )}
                        {application.status === "under_review" && (
                          <p className="text-sm text-gray-700">
                            Our team is reviewing your application. You'll hear from us soon!
                          </p>
                        )}
                        {application.status === "approved" && (
                          <p className="text-sm text-gray-700">
                            Congratulations! Your loan has been approved. Log in to your dashboard to review and pay the processing fee.
                          </p>
                        )}
                        {application.status === "fee_pending" && (
                          <p className="text-sm text-gray-700">
                            Your payment is being processed. Please allow 1-2 business days for confirmation.
                          </p>
                        )}
                        {application.status === "fee_paid" && (
                          <p className="text-sm text-gray-700">
                            Thank you for your payment! Your funds will be disbursed within 1-2 business days.
                          </p>
                        )}
                        {application.status === "disbursed" && (
                          <p className="text-sm text-gray-700">
                            Your loan has been disbursed! Check your bank account for the funds.
                          </p>
                        )}
                        {application.status === "rejected" && (
                          <p className="text-sm text-gray-700">
                            Unfortunately, your application was not approved. You can reapply after 30 days.
                          </p>
                        )}
                        {application.status === "cancelled" && (
                          <p className="text-sm text-gray-700">
                            Your application has been cancelled. You can submit a new application anytime.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
