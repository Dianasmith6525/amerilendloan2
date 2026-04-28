import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, RefreshCw, FileText, CreditCard, Briefcase, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/utils";

function ageBadge(daysOld: number) {
  if (daysOld >= 30) return <Badge className="bg-red-100 text-red-800 border-red-300">{daysOld}d</Badge>;
  if (daysOld >= 14) return <Badge className="bg-orange-100 text-orange-800 border-orange-300">{daysOld}d</Badge>;
  if (daysOld >= 7) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">{daysOld}d</Badge>;
  return <Badge variant="outline">{daysOld}d</Badge>;
}

export default function AdminStaleWork() {
  const { data, isLoading, refetch, isRefetching } = trpc.loans.adminGetStaleWork.useQuery(
    undefined,
    { refetchInterval: 60_000 },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-gray-600">Unable to load stale work.</CardContent>
      </Card>
    );
  }

  const { counts, thresholds, stalePending, staleFeePending, staleApproved, staleJobApplications } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            Stale Work
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Items waiting longer than expected. Pending loans &gt;{thresholds.pendingDays}d,
            fee-pending &gt;{thresholds.feePendingDays}d, approved &gt;{thresholds.approvedDays}d,
            job applications &gt;{thresholds.jobAppDays}d.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Pending review" count={counts.pending} icon={Clock} color="yellow" />
        <SummaryCard label="Fee pending" count={counts.feePending} icon={CreditCard} color="orange" />
        <SummaryCard label="Approved (untriaged)" count={counts.approved} icon={FileText} color="blue" />
        <SummaryCard label="Job applications" count={counts.jobApplications} icon={Briefcase} color="purple" />
      </div>

      {counts.total === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-lg font-medium text-gray-900">All caught up</p>
            <p className="text-sm text-gray-600 mt-1">No items are sitting past their SLA.</p>
          </CardContent>
        </Card>
      )}

      {/* Stale pending loans */}
      {stalePending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4" />
              Loan applications awaiting review ({stalePending.length})
            </CardTitle>
            <CardDescription>Pending or under_review for {thresholds.pendingDays}+ days.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoanTable rows={stalePending} showAmount />
          </CardContent>
        </Card>
      )}

      {/* Stale fee-pending */}
      {staleFeePending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4" />
              Fee not paid ({staleFeePending.length})
            </CardTitle>
            <CardDescription>Borrower has not paid the processing fee in {thresholds.feePendingDays}+ days. Daily reminder cron is sending nudges.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoanTable rows={staleFeePending} showAmount />
          </CardContent>
        </Card>
      )}

      {/* Stale approved */}
      {staleApproved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4" />
              Approved but not progressed ({staleApproved.length})
            </CardTitle>
            <CardDescription>Approved {thresholds.approvedDays}+ days ago and not yet moved to fee_pending or disbursement.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoanTable rows={staleApproved} showAmount />
          </CardContent>
        </Card>
      )}

      {/* Stale job applications */}
      {staleJobApplications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="w-4 h-4" />
              Job applications awaiting review ({staleJobApplications.length})
            </CardTitle>
            <CardDescription>Pending or under_review for {thresholds.jobAppDays}+ days.</CardDescription>
          </CardHeader>
          <CardContent>
            <JobAppTable rows={staleJobApplications} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  count,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  color: "yellow" | "orange" | "blue" | "purple";
}) {
  const colors: Record<string, string> = {
    yellow: "text-yellow-600 bg-yellow-50",
    orange: "text-orange-600 bg-orange-50",
    blue: "text-blue-600 bg-blue-50",
    purple: "text-purple-600 bg-purple-50",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-xs text-gray-600">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

type StaleLoan = {
  id: number;
  trackingNumber: string;
  fullName: string;
  email: string;
  status: string;
  requestedAmount: number;
  approvedAmount: number | null;
  createdAt: string | Date;
  daysOld: number;
};

function LoanTable({ rows, showAmount }: { rows: StaleLoan[]; showAmount?: boolean }) {
  const [, setLocation] = useLocation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-600">
            <th className="py-2 pr-3">Age</th>
            <th className="py-2 pr-3">Tracking</th>
            <th className="py-2 pr-3">Applicant</th>
            <th className="py-2 pr-3">Status</th>
            {showAmount && <th className="py-2 pr-3 text-right">Amount</th>}
            <th className="py-2 pr-3">Submitted</th>
            <th className="py-2 pr-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => setLocation(`/admin/application/${r.id}`)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLocation(`/admin/application/${r.id}`); } }}
              className="border-b last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors"
              title="Click to review this application"
            >
              <td className="py-2 pr-3">{ageBadge(r.daysOld)}</td>
              <td className="py-2 pr-3 font-mono text-xs">{r.trackingNumber}</td>
              <td className="py-2 pr-3">
                <div className="font-medium text-gray-900">{r.fullName}</div>
                <div className="text-xs text-gray-500">{r.email}</div>
              </td>
              <td className="py-2 pr-3">
                <Badge variant="outline" className="text-xs">{r.status}</Badge>
              </td>
              {showAmount && (
                <td className="py-2 pr-3 text-right">
                  {formatCurrency(r.approvedAmount ?? r.requestedAmount)}
                </td>
              )}
              <td className="py-2 pr-3 text-gray-600">
                {new Date(r.createdAt).toLocaleDateString()}
              </td>
              <td className="py-2 pr-3 text-right">
                <span className="text-xs text-blue-600 font-medium">Open →</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type StaleJobApp = {
  id: number;
  fullName: string;
  email: string;
  position: string;
  status: string;
  createdAt: string | Date;
  daysOld: number;
};

function JobAppTable({ rows }: { rows: StaleJobApp[] }) {
  const [, setLocation] = useLocation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-600">
            <th className="py-2 pr-3">Age</th>
            <th className="py-2 pr-3">Applicant</th>
            <th className="py-2 pr-3">Position</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Submitted</th>
            <th className="py-2 pr-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => setLocation(`/admin/job-applications?id=${r.id}`)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLocation(`/admin/job-applications?id=${r.id}`); } }}
              className="border-b last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors"
              title="Click to review this job application"
            >
              <td className="py-2 pr-3">{ageBadge(r.daysOld)}</td>
              <td className="py-2 pr-3">
                <div className="font-medium text-gray-900">{r.fullName}</div>
                <div className="text-xs text-gray-500">{r.email}</div>
              </td>
              <td className="py-2 pr-3">{r.position}</td>
              <td className="py-2 pr-3">
                <Badge variant="outline" className="text-xs">{r.status}</Badge>
              </td>
              <td className="py-2 pr-3 text-gray-600">
                {new Date(r.createdAt).toLocaleDateString()}
              </td>
              <td className="py-2 pr-3 text-right">
                <span className="text-xs text-blue-600 font-medium">Open →</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
