import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "./utils";
import {
  COMPANY_PHONE_DISPLAY_SHORT,
  COMPANY_SUPPORT_EMAIL,
  SUPPORT_HOURS_WEEKDAY,
  SUPPORT_HOURS_WEEKEND,
} from "@/const";

interface StatementParams {
  loan: any;
  paymentSchedule: any[];
  user: any;
  totalPaid: number;
  remainingBalance: number;
  paidPayments: number;
  totalPayments: number;
}

interface DerivedStatementData {
  loan: any;
  user: any;
  paymentSchedule: any[];
  approvedAmount: number;
  processingFee: number;
  interestRate: number | null;
  termMonths: number | null;
  monthlyPayment: number;
  totalPaid: number;
  remainingBalance: number;
  paidPayments: number;
  totalPayments: number;
  fullName: string;
  email: string;
  phone: string;
  mailingAddress: string;
  accountNumber: string;
  trackingNumber: string;
  loanType: string;
  status: string;
  originationDate: Date | null;
  maturityDate: Date | null;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  statementNumber: string;
  nextDuePayment: any | null;
  ytdPrincipal: number;
  ytdInterest: number;
  ytdFees: number;
  lateFeesPaid: number;
  txns: { date: Date; description: string; debit: number; credit: number; balance: number }[];
}

const LENDER = {
  legalName: "AmeriLend, LLC",
  tradeName: "AmeriLend",
  addressLine1: "AmeriLend Customer Service",
  addressLine2: "P.O. Box 7842",
  cityStateZip: "Dallas, TX 75221",
  phone: COMPANY_PHONE_DISPLAY_SHORT,
  email: COMPANY_SUPPORT_EMAIL,
  website: "www.amerilendloan.com",
  hours: `${SUPPORT_HOURS_WEEKDAY}, ${SUPPORT_HOURS_WEEKEND}`,
  nmls: "NMLS ID: Pending",
};

const escape = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const statusLabel = (s: string): string => {
  const map: Record<string, string> = {
    paid: "Paid",
    pending: "Scheduled",
    overdue: "Overdue",
    failed: "Failed",
    refunded: "Refunded",
    upcoming: "Upcoming",
  };
  return map[s] ?? s;
};

const statusColor = (s: string): string => {
  switch (s) {
    case "paid":
      return "#0a7a3a";
    case "overdue":
    case "failed":
      return "#b91c1c";
    case "refunded":
      return "#6b7280";
    default:
      return "#0a2540";
  }
};

const yyyymm = (d: Date): string =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;

const addMonths = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};

const estimateMonthlyPayment = (principal: number, annualRatePct: number | null, term: number | null): number => {
  if (!term || term <= 0) return 0;
  if (!annualRatePct || annualRatePct <= 0) return principal / term;
  const r = annualRatePct / 100 / 12;
  return (principal * r) / (1 - Math.pow(1 + r, -term));
};

const buildMailingAddress = (user: any, loan: any): string => {
  const street = user?.streetAddress ?? loan?.streetAddress ?? "";
  const city = user?.city ?? loan?.city ?? "";
  const state = user?.state ?? loan?.state ?? "";
  const zip = user?.zipCode ?? loan?.zipCode ?? "";
  const parts = [street, [city, state].filter(Boolean).join(", "), zip].filter(Boolean);
  return parts.join(" \u2022 ");
};

const derive = (params: StatementParams): DerivedStatementData => {
  const { loan, paymentSchedule, user, totalPaid, remainingBalance, paidPayments, totalPayments } = params;

  const approvedAmount = Number(loan.approvedAmount ?? loan.requestedAmount ?? 0);
  const processingFee = Number(loan.processingFeeAmount ?? 0);
  const interestRate: number | null = loan.interestRate != null ? Number(loan.interestRate) : null;
  const termMonths: number | null =
    (loan.termMonths ?? loan.termInMonths) != null ? Number(loan.termMonths ?? loan.termInMonths) : null;
  const monthlyPayment = estimateMonthlyPayment(approvedAmount, interestRate, termMonths);

  const generatedAt = new Date();
  const originationDate: Date | null = loan.disbursedAt
    ? new Date(loan.disbursedAt)
    : loan.approvedAt
      ? new Date(loan.approvedAt)
      : loan.createdAt
        ? new Date(loan.createdAt)
        : null;
  const maturityDate: Date | null = originationDate && termMonths ? addMonths(originationDate, termMonths) : null;
  const periodStart = originationDate ?? generatedAt;
  const periodEnd = generatedAt;

  const statementNumber = `SOA-${loan.id}-${yyyymm(generatedAt)}-${String(paidPayments).padStart(2, "0")}`;

  const fullName: string = user?.fullName || user?.name || loan.fullName || "Borrower";
  const email: string = user?.email || loan.email || "";
  const phone: string = user?.phone || loan.phone || "";
  const mailingAddress = buildMailingAddress(user, loan);

  const accountNumber = loan.loanAccountNumber || "\u2014";
  const trackingNumber = loan.trackingNumber || `#${loan.id}`;
  const loanType: string = loan.loanType ?? "\u2014";
  const status: string = loan.status ?? "\u2014";

  const nextDuePayment = paymentSchedule.find((p) => p.status !== "paid" && p.status !== "refunded") ?? null;

  const ytdYear = generatedAt.getFullYear();
  let ytdPrincipal = 0;
  let ytdInterest = 0;
  let ytdFees = 0;
  let lateFeesPaid = 0;
  for (const p of paymentSchedule) {
    if (p.status === "paid" && p.paidAt) {
      const paidYear = new Date(p.paidAt).getFullYear();
      const principalPart = Number(p.principalAmount ?? 0);
      const interestPart = Number(p.interestAmount ?? 0);
      const feePart = Number(p.feeAmount ?? p.lateFeeAmount ?? 0);
      lateFeesPaid += Number(p.lateFeeAmount ?? 0);
      if (paidYear === ytdYear) {
        ytdPrincipal += principalPart;
        ytdInterest += interestPart;
        ytdFees += feePart;
      }
    }
  }

  type Txn = { date: Date; description: string; debit: number; credit: number; balance: number };
  const events: Omit<Txn, "balance">[] = [];

  if (loan.createdAt) {
    events.push({
      date: new Date(loan.createdAt),
      description: "Loan application submitted",
      debit: 0,
      credit: 0,
    });
  }
  if (loan.approvedAt && approvedAmount > 0) {
    events.push({
      date: new Date(loan.approvedAt),
      description: `Loan approved \u2014 principal ${formatCurrency(approvedAmount)}`,
      debit: approvedAmount,
      credit: 0,
    });
  }
  if (loan.feePaidAt && processingFee > 0) {
    events.push({
      date: new Date(loan.feePaidAt),
      description: "Processing fee received",
      debit: 0,
      credit: processingFee,
    });
  }
  if (loan.disbursedAt) {
    events.push({
      date: new Date(loan.disbursedAt),
      description: `Funds disbursed${loan.disbursementMethod ? ` (${loan.disbursementMethod})` : ""}`,
      debit: 0,
      credit: 0,
    });
  }
  for (const p of paymentSchedule) {
    if (p.status === "paid" && p.paidAt) {
      const amt = Number(p.paidAmount ?? p.dueAmount ?? 0);
      events.push({
        date: new Date(p.paidAt),
        description: `Installment #${p.installmentNumber} payment received`,
        debit: 0,
        credit: amt,
      });
    }
    if (p.lateFeeAmount && Number(p.lateFeeAmount) > 0 && p.lateFeeAssessedAt) {
      events.push({
        date: new Date(p.lateFeeAssessedAt),
        description: `Late fee assessed (installment #${p.installmentNumber})`,
        debit: Number(p.lateFeeAmount),
        credit: 0,
      });
    }
  }
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  let running = 0;
  const txns: Txn[] = events.map((e) => {
    running = running + e.debit - e.credit;
    return { ...e, balance: running };
  });

  return {
    loan,
    user,
    paymentSchedule,
    approvedAmount,
    processingFee,
    interestRate,
    termMonths,
    monthlyPayment,
    totalPaid,
    remainingBalance,
    paidPayments,
    totalPayments,
    fullName,
    email,
    phone,
    mailingAddress,
    accountNumber,
    trackingNumber,
    loanType,
    status,
    originationDate,
    maturityDate,
    generatedAt,
    periodStart,
    periodEnd,
    statementNumber,
    nextDuePayment,
    ytdPrincipal,
    ytdInterest,
    ytdFees,
    lateFeesPaid,
    txns,
  };
};

// ---------------------------------------------------------------------------
// HTML statement (in-browser viewer)
// ---------------------------------------------------------------------------

export function buildStatementOfAccountHtml(params: StatementParams): string {
  const d = derive(params);

  const txnRows = d.txns
    .map(
      (t) => `
        <tr>
          <td>${escape(formatDate(t.date))}</td>
          <td>${escape(t.description)}</td>
          <td class="num">${t.debit ? formatCurrency(t.debit) : ""}</td>
          <td class="num">${t.credit ? formatCurrency(t.credit) : ""}</td>
          <td class="num">${formatCurrency(t.balance)}</td>
        </tr>`,
    )
    .join("");

  const scheduleRows = d.paymentSchedule
    .map(
      (p) => `
        <tr>
          <td>#${escape(p.installmentNumber)}</td>
          <td>${escape(formatDate(new Date(p.dueDate)))}</td>
          <td class="num">${formatCurrency(Number(p.dueAmount ?? 0))}</td>
          <td class="num">${p.paidAmount ? formatCurrency(Number(p.paidAmount)) : "\u2014"}</td>
          <td><span class="status" style="color:${statusColor(p.status)}">${escape(statusLabel(p.status))}</span></td>
          <td>${p.paidAt ? escape(formatDate(new Date(p.paidAt))) : "\u2014"}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Statement of Account \u2014 ${escape(d.statementNumber)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #0a2540; background: #f7f8fa; padding: 24px; }
  .page { max-width: 880px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; padding: 40px 48px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0a2540; padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; color: #0a2540; }
  .brand-sub { font-size: 11px; color: #6b7280; margin-top: 2px; letter-spacing: 0.3px; text-transform: uppercase; }
  .brand-addr { font-size: 11px; color: #6b7280; margin-top: 6px; line-height: 1.55; }
  .doc-title { text-align: right; }
  .doc-title h1 { margin: 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1.5px; color: #0a2540; }
  .doc-title .row { font-size: 11px; color: #6b7280; margin-top: 4px; line-height: 1.5; }
  .doc-title .stmt-no { font-family: ui-monospace, Menlo, monospace; color: #0a2540; font-weight: 600; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
  .meta-block h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin: 0 0 6px 0; font-weight: 600; }
  .meta-block .line { font-size: 13px; line-height: 1.55; }
  .meta-block .line strong { color: #0a2540; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .summary .cell { background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px; }
  .summary .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; margin-bottom: 4px; }
  .summary .value { font-size: 15px; font-weight: 700; color: #0a2540; }
  .terms-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .terms-grid .cell { border: 1px solid #e5e7eb; padding: 10px; }
  .terms-grid .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; margin-bottom: 4px; }
  .terms-grid .value { font-size: 13px; font-weight: 600; color: #0a2540; }
  .next-due { background: #fff7ed; border: 1px solid #fdba74; padding: 12px 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .next-due .left .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #9a3412; }
  .next-due .left .desc { font-size: 13px; color: #7c2d12; margin-top: 2px; }
  .next-due .right .amt { font-size: 18px; font-weight: 700; color: #9a3412; }
  .next-due .right .when { font-size: 11px; color: #9a3412; text-align: right; }
  .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #0a2540; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; margin: 22px 0 10px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #0a2540; color: #fff; padding: 8px 10px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .status { font-weight: 600; font-size: 11px; }
  .totals { margin-top: 14px; display: grid; grid-template-columns: 1fr 260px; }
  .totals .totals-box { border: 1px solid #d1d5db; padding: 10px 12px; }
  .totals .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .totals .totals-row.total { border-top: 1px solid #d1d5db; margin-top: 4px; padding-top: 8px; font-weight: 700; font-size: 13px; }
  .ytd { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 14px 0; }
  .ytd .cell { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; }
  .ytd .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #475569; }
  .ytd .value { font-size: 13px; font-weight: 700; color: #0a2540; margin-top: 2px; }
  .remit { border: 1px dashed #94a3b8; padding: 12px 14px; margin-top: 18px; font-size: 12px; line-height: 1.6; }
  .remit h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #0a2540; }
  .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; line-height: 1.6; }
  .footer strong { color: #0a2540; }
  .actions { max-width: 880px; margin: 0 auto 16px; display: flex; gap: 8px; justify-content: flex-end; }
  .actions button { background: #0a2540; color: #fff; border: 0; padding: 8px 16px; font-size: 13px; cursor: pointer; }
  .actions button.secondary { background: #fff; color: #0a2540; border: 1px solid #0a2540; }
  @media print {
    body { background: #fff; padding: 0; }
    .actions { display: none; }
    .page { border: 0; padding: 24px; max-width: none; }
  }
</style>
</head>
<body>
  <div class="actions">
    <button class="secondary" onclick="window.close()">Close</button>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="page">
    <div class="header">
      <div>
        <div class="brand">${escape(LENDER.tradeName)}</div>
        <div class="brand-sub">${escape(LENDER.legalName)}</div>
        <div class="brand-addr">
          ${escape(LENDER.addressLine1)}<br/>
          ${escape(LENDER.addressLine2)}<br/>
          ${escape(LENDER.cityStateZip)}<br/>
          ${escape(LENDER.phone)} \u2022 ${escape(LENDER.email)}<br/>
          ${escape(LENDER.nmls)}
        </div>
      </div>
      <div class="doc-title">
        <h1>Statement of Account</h1>
        <div class="row">Statement #: <span class="stmt-no">${escape(d.statementNumber)}</span></div>
        <div class="row">Issued: ${escape(formatDate(d.generatedAt))}</div>
        <div class="row">Period: ${escape(formatDate(d.periodStart))} \u2013 ${escape(formatDate(d.periodEnd))}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-block">
        <h3>Account Holder</h3>
        <div class="line"><strong>${escape(d.fullName)}</strong></div>
        ${d.email ? `<div class="line">${escape(d.email)}</div>` : ""}
        ${d.phone ? `<div class="line">${escape(d.phone)}</div>` : ""}
        ${d.mailingAddress ? `<div class="line" style="color:#475569;font-size:12px;">${escape(d.mailingAddress)}</div>` : ""}
      </div>
      <div class="meta-block">
        <h3>Loan Account</h3>
        <div class="line">Account #: <strong>${escape(d.accountNumber)}</strong></div>
        <div class="line">Tracking #: <strong>${escape(d.trackingNumber)}</strong></div>
        <div class="line">Type: <strong>${escape(d.loanType)}</strong></div>
        <div class="line">Status: <strong>${escape(d.status)}</strong></div>
      </div>
    </div>

    <div class="summary">
      <div class="cell"><div class="label">Approved Principal</div><div class="value">${formatCurrency(d.approvedAmount)}</div></div>
      <div class="cell"><div class="label">Total Paid</div><div class="value">${formatCurrency(d.totalPaid)}</div></div>
      <div class="cell"><div class="label">Outstanding Balance</div><div class="value">${formatCurrency(d.remainingBalance)}</div></div>
      <div class="cell"><div class="label">Installments Paid</div><div class="value">${d.paidPayments} of ${d.totalPayments}</div></div>
    </div>

    <div class="terms-grid">
      <div class="cell"><div class="label">Interest Rate</div><div class="value">${d.interestRate != null ? `${d.interestRate}% APR` : "\u2014"}</div></div>
      <div class="cell"><div class="label">Term</div><div class="value">${d.termMonths != null ? `${d.termMonths} months` : "\u2014"}</div></div>
      <div class="cell"><div class="label">Scheduled Monthly Payment</div><div class="value">${d.monthlyPayment > 0 ? formatCurrency(d.monthlyPayment) : "\u2014"}</div></div>
      <div class="cell"><div class="label">Origination Date</div><div class="value">${d.originationDate ? escape(formatDate(d.originationDate)) : "\u2014"}</div></div>
      <div class="cell"><div class="label">Maturity Date</div><div class="value">${d.maturityDate ? escape(formatDate(d.maturityDate)) : "\u2014"}</div></div>
      <div class="cell"><div class="label">Processing Fee</div><div class="value">${d.processingFee > 0 ? formatCurrency(d.processingFee) : "\u2014"}</div></div>
    </div>

    ${
      d.nextDuePayment
        ? `<div class="next-due">
            <div class="left">
              <div class="label">Next Payment Due</div>
              <div class="desc">Installment #${escape(d.nextDuePayment.installmentNumber)} \u00b7 ${escape(statusLabel(d.nextDuePayment.status))}</div>
            </div>
            <div class="right">
              <div class="amt">${formatCurrency(Number(d.nextDuePayment.dueAmount ?? 0))}</div>
              <div class="when">due ${escape(formatDate(new Date(d.nextDuePayment.dueDate)))}</div>
            </div>
          </div>`
        : ""
    }

    <div class="section-title">Year-to-Date Summary (${d.generatedAt.getFullYear()})</div>
    <div class="ytd">
      <div class="cell"><div class="label">Principal Paid YTD</div><div class="value">${formatCurrency(d.ytdPrincipal)}</div></div>
      <div class="cell"><div class="label">Interest Paid YTD</div><div class="value">${formatCurrency(d.ytdInterest)}</div></div>
      <div class="cell"><div class="label">Fees Paid YTD</div><div class="value">${formatCurrency(d.ytdFees)}</div></div>
      <div class="cell"><div class="label">Late Fees Paid (life)</div><div class="value">${formatCurrency(d.lateFeesPaid)}</div></div>
    </div>

    <div class="section-title">Transaction History</div>
    ${
      d.txns.length > 0
        ? `<table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th class="num">Debit</th>
                <th class="num">Credit</th>
                <th class="num">Balance</th>
              </tr>
            </thead>
            <tbody>${txnRows}</tbody>
          </table>`
        : `<p style="font-size:12px;color:#6b7280;">No transactions have posted to this account yet.</p>`
    }

    <div class="totals">
      <div></div>
      <div class="totals-box">
        <div class="totals-row"><span>Approved principal</span><span>${formatCurrency(d.approvedAmount)}</span></div>
        <div class="totals-row"><span>Payments applied</span><span>\u2212 ${formatCurrency(d.totalPaid)}</span></div>
        <div class="totals-row total"><span>Balance due</span><span>${formatCurrency(d.remainingBalance)}</span></div>
      </div>
    </div>

    <div class="section-title">Repayment Schedule</div>
    ${
      d.paymentSchedule.length > 0
        ? `<table>
            <thead>
              <tr>
                <th>#</th>
                <th>Due Date</th>
                <th class="num">Amount Due</th>
                <th class="num">Amount Paid</th>
                <th>Status</th>
                <th>Paid On</th>
              </tr>
            </thead>
            <tbody>${scheduleRows}</tbody>
          </table>`
        : `<p style="font-size:12px;color:#6b7280;">A repayment schedule has not been generated for this loan.</p>`
    }

    <div class="remit">
      <h4>Payment Instructions</h4>
      Make payments through your dashboard at <strong>${escape(LENDER.website)}/dashboard</strong> using the Make a Payment button on this loan. Auto-pay can be enabled or adjusted under Payment Preferences. For pay-off quotes, hardship arrangements, or to dispute a transaction, contact ${escape(LENDER.email)} or call ${escape(LENDER.phone)} (${escape(LENDER.hours)}).
    </div>

    <div class="footer">
      <p>This statement reflects activity on your ${escape(LENDER.tradeName)} loan account as of <strong>${escape(formatDate(d.generatedAt))}</strong>. If any item appears incorrect, you must notify us in writing within <strong>30 days</strong> of the statement date. After that period the statement will be considered correct except for amounts that you brought to our attention in writing.</p>
      <p><strong>${escape(LENDER.legalName)}</strong> \u00b7 ${escape(LENDER.email)} \u00b7 ${escape(LENDER.phone)} \u00b7 ${escape(LENDER.website)} \u00b7 ${escape(LENDER.nmls)}</p>
      <p style="font-size:10px;margin-top:8px;">This document is generated electronically and is valid without a signature. Please retain a copy for your records.</p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// PDF statement (one-click vector PDF)
// ---------------------------------------------------------------------------

const NAVY: [number, number, number] = [10, 37, 64];
const SUBTLE: [number, number, number] = [107, 114, 128];
const LIGHT: [number, number, number] = [243, 244, 246];
const RULE: [number, number, number] = [209, 213, 219];
const ACCENT_AMBER_BG: [number, number, number] = [255, 247, 237];
const ACCENT_AMBER_FG: [number, number, number] = [154, 52, 18];
const ACCENT_AMBER_BORDER: [number, number, number] = [253, 186, 116];

export function downloadStatementOfAccountPdf(params: StatementParams): void {
  const d = derive(params);
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;

  // Header
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(LENDER.tradeName, margin, margin + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUBTLE);
  doc.text(LENDER.legalName, margin, margin + 18);
  doc.text(LENDER.addressLine1, margin, margin + 30);
  doc.text(LENDER.addressLine2, margin, margin + 41);
  doc.text(LENDER.cityStateZip, margin, margin + 52);
  doc.text(`${LENDER.phone}  \u2022  ${LENDER.email}`, margin, margin + 63);
  doc.text(LENDER.nmls, margin, margin + 74);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text("STATEMENT OF ACCOUNT", pageW - margin, margin + 4, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SUBTLE);
  doc.text(`Statement #: ${d.statementNumber}`, pageW - margin, margin + 20, { align: "right" });
  doc.text(`Issued: ${formatDate(d.generatedAt)}`, pageW - margin, margin + 32, { align: "right" });
  doc.text(`Period: ${formatDate(d.periodStart)} \u2013 ${formatDate(d.periodEnd)}`, pageW - margin, margin + 44, {
    align: "right",
  });

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1.2);
  doc.line(margin, margin + 88, pageW - margin, margin + 88);

  let y = margin + 102;

  // Account holder + loan account
  const colW = (contentW - 16) / 2;
  const drawBlock = (
    x: number,
    blockY: number,
    title: string,
    rows: { label?: string; value: string; bold?: boolean; muted?: boolean }[],
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SUBTLE);
    doc.text(title.toUpperCase(), x, blockY);
    let ly = blockY + 12;
    for (const row of rows) {
      const label = row.label ? `${row.label}: ` : "";
      doc.setFont("helvetica", row.bold ? "bold" : "normal");
      doc.setFontSize(10);
      doc.setTextColor(...(row.muted ? SUBTLE : NAVY));
      doc.text(`${label}${row.value}`, x, ly);
      ly += 13;
    }
  };

  drawBlock(margin, y, "Account Holder", [
    { value: d.fullName, bold: true },
    ...(d.email ? [{ value: d.email }] : []),
    ...(d.phone ? [{ value: d.phone }] : []),
    ...(d.mailingAddress ? [{ value: d.mailingAddress, muted: true }] : []),
  ]);
  drawBlock(margin + colW + 16, y, "Loan Account", [
    { label: "Account #", value: d.accountNumber, bold: true },
    { label: "Tracking #", value: d.trackingNumber, bold: true },
    { label: "Type", value: d.loanType, bold: true },
    { label: "Status", value: d.status, bold: true },
  ]);

  y += 80;

  // Summary tiles
  const drawTile = (x: number, tileY: number, w: number, label: string, value: string) => {
    doc.setFillColor(...LIGHT);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.rect(x, tileY, w, 44, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SUBTLE);
    doc.text(label.toUpperCase(), x + 8, tileY + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(value, x + 8, tileY + 32);
  };
  const tileW = (contentW - 12 * 3) / 4;
  drawTile(margin + 0 * (tileW + 12), y, tileW, "Approved Principal", formatCurrency(d.approvedAmount));
  drawTile(margin + 1 * (tileW + 12), y, tileW, "Total Paid", formatCurrency(d.totalPaid));
  drawTile(margin + 2 * (tileW + 12), y, tileW, "Outstanding Balance", formatCurrency(d.remainingBalance));
  drawTile(
    margin + 3 * (tileW + 12),
    y,
    tileW,
    "Installments Paid",
    `${d.paidPayments} of ${d.totalPayments}`,
  );
  y += 56;

  // Terms grid
  const termCellW = (contentW - 12 * 2) / 3;
  const termCellH = 38;
  const drawTermCell = (col: number, row: number, label: string, value: string) => {
    const x = margin + col * (termCellW + 12);
    const yy = y + row * (termCellH + 8);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.rect(x, yy, termCellW, termCellH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SUBTLE);
    doc.text(label.toUpperCase(), x + 8, yy + 13);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(value, x + 8, yy + 28);
  };
  drawTermCell(0, 0, "Interest Rate", d.interestRate != null ? `${d.interestRate}% APR` : "\u2014");
  drawTermCell(1, 0, "Term", d.termMonths != null ? `${d.termMonths} months` : "\u2014");
  drawTermCell(
    2,
    0,
    "Scheduled Monthly Payment",
    d.monthlyPayment > 0 ? formatCurrency(d.monthlyPayment) : "\u2014",
  );
  drawTermCell(0, 1, "Origination Date", d.originationDate ? formatDate(d.originationDate) : "\u2014");
  drawTermCell(1, 1, "Maturity Date", d.maturityDate ? formatDate(d.maturityDate) : "\u2014");
  drawTermCell(
    2,
    1,
    "Processing Fee",
    d.processingFee > 0 ? formatCurrency(d.processingFee) : "\u2014",
  );
  y += termCellH * 2 + 8 + 10;

  // Next payment due
  if (d.nextDuePayment) {
    const dueAmt = Number(d.nextDuePayment.dueAmount ?? 0);
    doc.setFillColor(...ACCENT_AMBER_BG);
    doc.setDrawColor(...ACCENT_AMBER_BORDER);
    doc.setLineWidth(0.7);
    doc.rect(margin, y, contentW, 44, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...ACCENT_AMBER_FG);
    doc.text("NEXT PAYMENT DUE", margin + 12, y + 14);
    doc.setFontSize(9);
    doc.text(
      `Installment #${d.nextDuePayment.installmentNumber} \u00b7 ${statusLabel(d.nextDuePayment.status)}`,
      margin + 12,
      y + 30,
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(formatCurrency(dueAmt), pageW - margin - 12, y + 22, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`due ${formatDate(new Date(d.nextDuePayment.dueDate))}`, pageW - margin - 12, y + 35, {
      align: "right",
    });
    y += 56;
  }

  // YTD summary
  const sectionTitle = (text: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(text.toUpperCase(), margin, y);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 4, pageW - margin, y + 4);
    y += 14;
  };

  sectionTitle(`Year-to-Date Summary (${d.generatedAt.getFullYear()})`);
  const ytdW = (contentW - 12 * 3) / 4;
  drawTile(margin + 0 * (ytdW + 12), y, ytdW, "Principal Paid YTD", formatCurrency(d.ytdPrincipal));
  drawTile(margin + 1 * (ytdW + 12), y, ytdW, "Interest Paid YTD", formatCurrency(d.ytdInterest));
  drawTile(margin + 2 * (ytdW + 12), y, ytdW, "Fees Paid YTD", formatCurrency(d.ytdFees));
  drawTile(margin + 3 * (ytdW + 12), y, ytdW, "Late Fees Paid (life)", formatCurrency(d.lateFeesPaid));
  y += 56;

  // Transaction history
  sectionTitle("Transaction History");
  if (d.txns.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Date", "Description", "Debit", "Credit", "Balance"]],
      body: d.txns.map((t) => [
        formatDate(t.date),
        t.description,
        t.debit ? formatCurrency(t.debit) : "",
        t.credit ? formatCurrency(t.credit) : "",
        formatCurrency(t.balance),
      ]),
      styles: { fontSize: 9, cellPadding: 5, textColor: NAVY, lineColor: RULE, lineWidth: 0.3 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 70 },
        2: { halign: "right", cellWidth: 70 },
        3: { halign: "right", cellWidth: 70 },
        4: { halign: "right", cellWidth: 80 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...SUBTLE);
    doc.text("No transactions have posted to this account yet.", margin, y);
    y += 16;
  }

  // Totals box
  if (y > pageH - 220) {
    doc.addPage();
    y = margin;
  }
  const boxW = 240;
  const boxX = pageW - margin - boxW;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.rect(boxX, y, boxW, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Approved principal", boxX + 10, y + 16);
  doc.text(formatCurrency(d.approvedAmount), boxX + boxW - 10, y + 16, { align: "right" });
  doc.text("Payments applied", boxX + 10, y + 30);
  doc.text(`\u2212 ${formatCurrency(d.totalPaid)}`, boxX + boxW - 10, y + 30, { align: "right" });
  doc.line(boxX + 6, y + 38, boxX + boxW - 6, y + 38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Balance due", boxX + 10, y + 52);
  doc.text(formatCurrency(d.remainingBalance), boxX + boxW - 10, y + 52, { align: "right" });
  y += 76;

  // Repayment schedule
  sectionTitle("Repayment Schedule");
  if (d.paymentSchedule.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Due Date", "Amount Due", "Amount Paid", "Status", "Paid On"]],
      body: d.paymentSchedule.map((p) => [
        `#${p.installmentNumber}`,
        formatDate(new Date(p.dueDate)),
        formatCurrency(Number(p.dueAmount ?? 0)),
        p.paidAmount ? formatCurrency(Number(p.paidAmount)) : "\u2014",
        statusLabel(p.status),
        p.paidAt ? formatDate(new Date(p.paidAt)) : "\u2014",
      ]),
      styles: { fontSize: 9, cellPadding: 5, textColor: NAVY, lineColor: RULE, lineWidth: 0.3 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 40 },
        2: { halign: "right", cellWidth: 80 },
        3: { halign: "right", cellWidth: 80 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...SUBTLE);
    doc.text("A repayment schedule has not been generated for this loan.", margin, y);
    y += 16;
  }

  // Payment instructions
  if (y > pageH - 180) {
    doc.addPage();
    y = margin;
  }
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([3, 3], 0);
  doc.rect(margin, y, contentW, 60);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("PAYMENT INSTRUCTIONS", margin + 10, y + 16);
  doc.setFont("helvetica", "normal");
  const remitText =
    `Make payments through your dashboard at ${LENDER.website}/dashboard using the Make a Payment button on this loan. ` +
    `Auto-pay can be enabled or adjusted under Payment Preferences. For pay-off quotes, hardship arrangements, or to dispute ` +
    `a transaction, contact ${LENDER.email} or call ${LENDER.phone} (${LENDER.hours}).`;
  const remitLines = doc.splitTextToSize(remitText, contentW - 20);
  doc.text(remitLines, margin + 10, y + 30);
  y += 76;

  // Footer + page numbers (every page)
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const fy = pageH - 60;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.4);
    doc.line(margin, fy, pageW - margin, fy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUBTLE);
    const disc =
      `This statement reflects activity on your ${LENDER.tradeName} loan account as of ${formatDate(d.generatedAt)}. ` +
      `If any item appears incorrect, you must notify us in writing within 30 days of the statement date.`;
    const discLines = doc.splitTextToSize(disc, contentW);
    doc.text(discLines, margin, fy + 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(
      `${LENDER.legalName} \u00b7 ${LENDER.email} \u00b7 ${LENDER.phone} \u00b7 ${LENDER.website} \u00b7 ${LENDER.nmls}`,
      margin,
      fy + 36,
    );
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SUBTLE);
    doc.text(`Page ${i} of ${total}`, pageW - margin, fy + 36, { align: "right" });
  }

  const filename = `amerilend-statement-${d.trackingNumber.replace(/[^A-Za-z0-9]+/g, "")}-${yyyymm(d.generatedAt)}.pdf`;
  doc.save(filename);
}

// ---------------------------------------------------------------------------
// View HTML statement in a new window (kept for the "view" use case)
// ---------------------------------------------------------------------------

export function openStatementOfAccount(params: StatementParams): void {
  const html = buildStatementOfAccountHtml(params);
  const w = window.open("", "_blank", "width=960,height=900");
  if (!w) {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amerilend-statement-${params.loan.trackingNumber || params.loan.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
