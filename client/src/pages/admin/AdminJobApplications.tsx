import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, User, Mail, Phone, FileText, CheckCircle, XCircle, Clock, Eye, RefreshCw, Loader2, Download, Send, MapPin, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type AppStatus = "pending" | "under_review" | "approved" | "rejected";

interface JobApp {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  resumeFileName: string | null;
  resumeFileUrl: string | null;
  coverLetter: string;
  status: AppStatus;
  adminNotes: string | null;
  replyMessage: string | null;
  rejectionReasons: string | null;
  reviewedBy: number | null;
  reviewedAt: Date | string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}

const REJECTION_REASONS = [
  "Location — Applicant is not based in the USA",
  "Insufficient experience for the role",
  "Qualifications do not meet requirements",
  "Incomplete application or missing documents",
  "Position has already been filled",
  "Failed background or reference check",
  "Salary expectations exceed budget",
  "Poor cultural fit based on interview",
  "Insufficient skills or certifications",
  "Unable to verify employment history",
] as const;

function StatusBadge({ status }: { status: AppStatus }) {
  switch (status) {
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">Pending</Badge>;
    case "under_review":
      return <Badge className="bg-blue-100 text-blue-800 border border-blue-300">Under Review</Badge>;
    case "approved":
      return <Badge className="bg-green-100 text-green-800 border border-green-300">Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-800 border border-red-300">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function generateReplyMessage(name: string, position: string, status: AppStatus, reasons?: string[]): string {
  const firstName = name.split(" ")[0];
  const reasonsText = reasons && reasons.length > 0
    ? `\n\nReason(s) for this decision:\n${reasons.map(r => `• ${r}`).join("\n")}\n`
    : "";
  switch (status) {
    case "approved":
      return `Dear ${firstName},\n\nCongratulations! We are pleased to inform you that your application for the ${position} position at AmeriLend has been approved.\n\n--- NEXT STEPS FOR ONBOARDING ---\n\nPlease complete the following within the next 5 business days:\n\n1. Identity Verification\n   • Government-issued photo ID (Passport or Driver's License)\n   • Social Security Number confirmation\n\n2. Employment Documents\n   • Signed offer letter (will be sent separately)\n   • Completed W-4 tax form\n   • Completed I-9 Employment Eligibility Verification\n   • Direct deposit authorization form\n\n3. Background & Reference Check\n   • Consent form for background check\n   • Contact information for 2-3 professional references\n\n4. Additional Requirements\n   • Proof of eligibility to work in the United States\n   • Educational certificates or transcripts (if applicable)\n   • Professional licenses or certifications relevant to the role\n   • Signed confidentiality/NDA agreement\n\n5. IT & Access Setup\n   • Complete new hire registration form (link will be emailed)\n   • Upload a professional headshot for your company profile\n\nOur HR team will be reaching out to you shortly with detailed instructions and required forms. Please keep an eye on your email and phone for further communication.\n\nWe look forward to welcoming you to the AmeriLend team!\n\nBest regards,\nAmeriLend HR Team`;
    case "rejected":
      return `Dear ${firstName},\n\nThank you for your interest in the ${position} position at AmeriLend and for taking the time to apply.\n\nAfter careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.${reasonsText}\nWe encourage you to apply again in the future as new opportunities arise. We wish you all the best in your career journey.\n\nBest regards,\nAmeriLend HR Team`;
    case "under_review":
      return `Dear ${firstName},\n\nThank you for applying for the ${position} position at AmeriLend. We wanted to let you know that your application is currently under review by our hiring team.\n\nWe will be in touch within the next few business days with an update. In the meantime, if you have any questions, feel free to reach out.\n\nBest regards,\nAmeriLend HR Team`;
    case "pending":
      return `Dear ${firstName},\n\nThank you for submitting your application for the ${position} position at AmeriLend. We are excited to confirm that your application has been successfully received!\n\nWhat happens next:\n• Our hiring team will carefully review your application and qualifications\n• You can expect to hear from us within 5-7 business days\n• If your profile matches our requirements, we will reach out to schedule an interview\n\nIn the meantime, please ensure your contact information is up to date so we can reach you without delay.\n\nWe appreciate your interest in joining AmeriLend and look forward to reviewing your application.\n\nBest regards,\nAmeriLend HR Team`;
    default:
      return "";
  }
}

export default function AdminJobApplications() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedApp, setSelectedApp] = useState<JobApp | null>(null);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<AppStatus>("under_review");
  const [adminNotes, setAdminNotes] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<string[]>([]);
  const [sendNotification, setSendNotification] = useState(true);

  const { data: applications = [], isLoading, isError, error, refetch } =
    trpc.jobApplications.list.useQuery(undefined, { refetchInterval: 30000 });

  const updateStatus = trpc.jobApplications.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Application status updated" + (sendNotification ? " and notification sent to applicant" : ""));
      setReviewDialog(false);
      setSelectedApp(null);
      setAdminNotes("");
      setReplyMessage("");
      setRejectionReasons([]);
      setSendNotification(true);
      refetch();
    },
    onError: (err) => toast.error(err.message || "Failed to update status"),
  });

  const filtered = filterStatus === "all"
    ? applications
    : applications.filter((a: JobApp) => a.status === filterStatus);

  const counts = {
    all: applications.length,
    pending: applications.filter((a: JobApp) => a.status === "pending").length,
    under_review: applications.filter((a: JobApp) => a.status === "under_review").length,
    approved: applications.filter((a: JobApp) => a.status === "approved").length,
    rejected: applications.filter((a: JobApp) => a.status === "rejected").length,
  };

  function openReview(app: JobApp) {
    setSelectedApp(app);
    const newStatus = app.status === "pending" ? "under_review" : app.status;
    setReviewStatus(newStatus);
    setAdminNotes(app.adminNotes || "");
    const existingReasons: string[] = app.rejectionReasons ? (() => { try { return JSON.parse(app.rejectionReasons); } catch { return []; } })() : [];
    setRejectionReasons(existingReasons);
    setReplyMessage(app.replyMessage || generateReplyMessage(app.fullName, app.position, newStatus, existingReasons));
    setSendNotification(true);
    setReviewDialog(true);
  }

  function handleStatusChange(newStatus: AppStatus) {
    setReviewStatus(newStatus);
    if (newStatus !== "rejected") {
      setRejectionReasons([]);
    }
    if (selectedApp) {
      setReplyMessage(generateReplyMessage(selectedApp.fullName, selectedApp.position, newStatus, newStatus === "rejected" ? rejectionReasons : []));
    }
  }

  function toggleRejectionReason(reason: string) {
    setRejectionReasons((prev) => {
      const updated = prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason];
      if (selectedApp) {
        setReplyMessage(generateReplyMessage(selectedApp.fullName, selectedApp.position, reviewStatus, updated));
      }
      return updated;
    });
  }

  function submitReview() {
    if (!selectedApp) return;
    updateStatus.mutate({
      id: selectedApp.id,
      status: reviewStatus,
      adminNotes: adminNotes || undefined,
      replyMessage: replyMessage || undefined,
      rejectionReasons: reviewStatus === "rejected" ? rejectionReasons : undefined,
      sendNotification,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="w-7 h-7 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Job Applications</h2>
            <p className="text-gray-500 text-sm">Review and manage career applications from candidates</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: counts.all, color: "text-gray-700", bg: "bg-gray-50 border-gray-200" },
          { label: "Pending", value: counts.pending, color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
          { label: "Under Review", value: counts.under_review, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
          { label: "Approved", value: counts.approved, color: "text-green-700", bg: "bg-green-50 border-green-200" },
        ].map((stat) => (
          <Card key={stat.label} className={`border ${stat.bg}`}>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 font-medium">Filter:</span>
        {(["all", "pending", "under_review", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              filterStatus === s
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            {" "}({counts[s as keyof typeof counts]})
          </button>
        ))}
      </div>

      {/* Applications List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-700 font-medium mb-2">Failed to load job applications</p>
            <p className="text-red-500 text-sm mb-4">{error?.message || "Something went wrong. Please try again."}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No applications found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((app: JobApp) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-gray-900 text-lg">{app.fullName}</span>
                      <StatusBadge status={app.status} />
                      <Badge variant="outline" className="text-xs">
                        {app.position}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> {app.email}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> {app.phone}
                      </span>
                      {app.resumeFileName && (
                        <span className="flex items-center gap-1.5 text-blue-600">
                          <FileText className="w-3.5 h-3.5" />
                          {app.resumeFileUrl ? (
                            <a href={`/api/view-resume/${app.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                              {app.resumeFileName} <Download className="w-3 h-3" />
                            </a>
                          ) : (
                            <span>{app.resumeFileName}</span>
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{app.coverLetter}</p>
                    <p className="text-xs text-gray-400">
                      Applied {app.createdAt ? new Date(app.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      {app.reviewedAt && ` · Reviewed ${new Date(app.reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </p>
                    {app.adminNotes && (
                      <p className="text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-yellow-800">
                        Admin notes: {app.adminNotes}
                      </p>
                    )}
                    {app.status === "rejected" && app.rejectionReasons && (() => {
                      try {
                        const reasons: string[] = JSON.parse(app.rejectionReasons);
                        if (reasons.length > 0) {
                          return (
                            <div className="text-xs bg-red-50 border border-red-200 rounded px-2 py-1 text-red-800 flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                              <span>Rejection: {reasons.join(", ")}</span>
                            </div>
                          );
                        }
                      } catch { /* ignore */ }
                      return null;
                    })()}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => openReview(app)}
                  >
                    <Eye className="w-4 h-4" />
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialog} onOpenChange={(open) => { if (!open) { setReviewDialog(false); setSelectedApp(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Review Application
            </DialogTitle>
            <DialogDescription>
              {selectedApp?.fullName} — {selectedApp?.position}
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-4">
              {/* Applicant Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedApp.fullName}</span></div>
                  <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selectedApp.email}</span></div>
                  <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{selectedApp.phone}</span></div>
                  <div><span className="text-gray-500">Position:</span> <span className="font-medium">{selectedApp.position}</span></div>
                </div>
                {selectedApp.resumeFileName && (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-gray-500">Resume:</span>
                    {selectedApp.resumeFileUrl ? (
                      <>
                        <a href={`/api/view-resume/${selectedApp.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline inline-flex items-center gap-1">
                          {selectedApp.resumeFileName}
                        </a>
                        <a href={`/api/view-resume/${selectedApp.id}?download=1`} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      </>
                    ) : (
                      <span className="text-blue-600 font-medium">{selectedApp.resumeFileName}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Cover Letter */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Cover Letter</Label>
                <div className="mt-1 bg-white border rounded-lg p-3 text-sm text-gray-700 max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {selectedApp.coverLetter}
                </div>
              </div>

              {/* Status Update */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Update Status</Label>
                <Select value={reviewStatus} onValueChange={(v) => handleStatusChange(v as AppStatus)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-500" /> Pending</span>
                    </SelectItem>
                    <SelectItem value="under_review">
                      <span className="flex items-center gap-2"><Eye className="w-4 h-4 text-blue-500" /> Under Review</span>
                    </SelectItem>
                    <SelectItem value="approved">
                      <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Approved</span>
                    </SelectItem>
                    <SelectItem value="rejected">
                      <span className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500" /> Rejected</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rejection Reasons (shown when rejected) */}
              {reviewStatus === "rejected" && (
                <div>
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Rejection Reason(s)
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5 mb-2">Select one or more reasons for rejecting this application</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-lg p-3 bg-red-50/50">
                    {REJECTION_REASONS.map((reason) => (
                      <label
                        key={reason}
                        className={`flex items-start gap-2.5 p-2 rounded-md cursor-pointer transition-colors text-sm ${
                          rejectionReasons.includes(reason)
                            ? "bg-red-100 border border-red-300"
                            : "hover:bg-red-50 border border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={rejectionReasons.includes(reason)}
                          onChange={() => toggleRejectionReason(reason)}
                          className="mt-0.5 accent-red-600"
                        />
                        <span className={rejectionReasons.includes(reason) ? "text-red-800 font-medium" : "text-gray-700"}>
                          {reason}
                        </span>
                      </label>
                    ))}
                  </div>
                  {rejectionReasons.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">{rejectionReasons.length} selected</Badge>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => {
                          setRejectionReasons([]);
                          if (selectedApp) setReplyMessage(generateReplyMessage(selectedApp.fullName, selectedApp.position, reviewStatus, []));
                        }}
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Admin Notes (optional)</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes (not visible to applicant)..."
                />
              </div>

              {/* Reply Message to Applicant */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm font-medium text-gray-700">Message to Applicant</Label>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    onClick={() => selectedApp && setReplyMessage(generateReplyMessage(selectedApp.fullName, selectedApp.position, reviewStatus, rejectionReasons))}
                  >
                    Reset to default
                  </button>
                </div>
                <Textarea
                  className="mt-1 text-sm"
                  rows={5}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                />
              </div>

              {/* Send Notification Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-600" />
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Send email notification</Label>
                    <p className="text-xs text-gray-500">Email this message to {selectedApp?.fullName}</p>
                  </div>
                </div>
                <Switch
                  checked={sendNotification}
                  onCheckedChange={setSendNotification}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReviewDialog(false); setSelectedApp(null); }}>
              Cancel
            </Button>
            <Button
              onClick={submitReview}
              disabled={updateStatus.isPending}
              className={reviewStatus === "approved" ? "bg-green-600 hover:bg-green-700" : reviewStatus === "rejected" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}
            >
              {updateStatus.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : reviewStatus === "approved" ? (
                <><CheckCircle className="w-4 h-4 mr-2" /> Approve{sendNotification && replyMessage ? " & Notify" : ""}</>
              ) : reviewStatus === "rejected" ? (
                <><XCircle className="w-4 h-4 mr-2" /> Reject{sendNotification && replyMessage ? " & Notify" : ""}</>
              ) : (
                sendNotification && replyMessage ? "Save & Notify" : "Save Status"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
