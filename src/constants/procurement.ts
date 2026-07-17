/**
 * Procurement Module Constants — status/source/SLA vocabulary
 * Mirrors EI_Procurement_Dashboard_Spec.html §2.4 (sources), §9 (status
 * workflows) and §10 (SLA & flag rules). Tailwind class triples reproduce the
 * spec's pill colours.
 */

// ─── Tones → Tailwind class triples (text / bg / border) ─────────────────────
export type StatusTone =
  | 'slate' | 'gray' | 'amber' | 'orange' | 'cyan' | 'blue'
  | 'violet' | 'emerald' | 'red';

export interface StatusStyle {
  text: string;
  bg: string;
  border: string;
}

export const TONE_CLASSES: Record<StatusTone, StatusStyle> = {
  slate:   { text: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-200' },
  gray:    { text: 'text-gray-600',    bg: 'bg-gray-100',    border: 'border-gray-200' },
  amber:   { text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
  orange:  { text: 'text-orange-700',  bg: 'bg-orange-100',  border: 'border-orange-200' },
  cyan:    { text: 'text-cyan-700',    bg: 'bg-cyan-50',     border: 'border-cyan-200' },
  blue:    { text: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  violet:  { text: 'text-violet-700',  bg: 'bg-violet-50',   border: 'border-violet-200' },
  emerald: { text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  red:     { text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200' },
};

export interface StatusConfig extends StatusStyle {
  label: string;
  tone: StatusTone;
}

function mk(label: string, tone: StatusTone): StatusConfig {
  return { label, tone, ...TONE_CLASSES[tone] };
}

// ─── §2.4 PR source (two sources, one inbox) ─────────────────────────────────
export type PrSource = 'planning' | 'procurement';

export const PR_SOURCE_CONFIG: Record<PrSource, StatusConfig & { emoji: string }> = {
  planning:    { ...mk('Planning', 'blue'),    emoji: '📋' },
  procurement: { ...mk('Procurement', 'violet'), emoji: '⊕' },
};

// ─── §9.1 PR workflow ────────────────────────────────────────────────────────
export type PrStatus =
  | 'draft' | 'open' | 'edited' | 'quote_wait' | 'audit_wait' | 'released';

export const PR_STATUS_CONFIG: Record<PrStatus, StatusConfig> = {
  draft:      mk('Draft', 'slate'),
  open:       mk('Open', 'cyan'),
  edited:     mk('Edited', 'blue'),
  quote_wait: mk('Quote-Wait', 'violet'),
  audit_wait: mk('Audit-Wait', 'amber'),
  released:   mk('Released', 'emerald'),
};

// ─── PO Types (Flowchart §5 — five types share one core flow) ────────────────
export type PoType = 'regular' | 'blanket' | 'spot' | 'consignment' | 'sample';

export const PO_TYPE_CONFIG: Record<PoType, StatusConfig & { blurb: string }> = {
  regular:     { ...mk('Regular', 'blue'),    blurb: 'Spot buy for a batch or 30–90 day cycle' },
  blanket:     { ...mk('Blanket', 'violet'),  blurb: 'Umbrella PO valid 3–12 months · call-offs' },
  spot:        { ...mk('Spot / Emergency', 'orange'), blurb: 'Same/next-day · higher approval gate' },
  consignment: { ...mk('Consignment', 'cyan'), blurb: 'Vendor stock at EI · invoiced on consumption' },
  sample:      { ...mk('Sample / Trial', 'amber'), blurb: 'Small qty for R&D · links to Trial Batch' },
};

export const PO_TYPE_ORDER: PoType[] = ['regular', 'blanket', 'spot', 'consignment', 'sample'];

export function toPoType(raw: string | null | undefined): PoType {
  const s = String(raw ?? '').trim().toLowerCase();
  return (PO_TYPE_ORDER as string[]).includes(s) ? (s as PoType) : 'regular';
}

// ─── PO Approval workflow (Flowchart Sub-flow E) ─────────────────────────────
export type PoApprovalStatus =
  | 'not_submitted' | 'under_review' | 'under_approval'
  | 'approved' | 'changes_requested' | 'rejected';

export const PO_APPROVAL_STATUS_CONFIG: Record<PoApprovalStatus, StatusConfig> = {
  not_submitted:     mk('Not Submitted', 'slate'),
  under_review:      mk('Under Review', 'violet'),
  under_approval:    mk('Under Approval', 'orange'),
  approved:          mk('Approved', 'emerald'),
  changes_requested: mk('Changes Requested', 'amber'),
  rejected:          mk('Rejected', 'red'),
};

/** Normalise a nullable backend approval_status into the UI enum. */
export function toPoApprovalStatus(raw: string | null | undefined): PoApprovalStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'under_review' || s === 'under_approval' || s === 'approved'
      || s === 'changes_requested' || s === 'rejected') return s;
  return 'not_submitted';
}

// Approval threshold matrix — MIRRORS backend src/purchaseOrders/poApprovalMatrix.js.
// Keep thresholds in sync if the backend changes.
export type PoApproverRole = 'proc_head' | 'cfo';
export const PO_REGULAR_CFO_THRESHOLD = 500000;
export const PO_SAMPLE_CFO_THRESHOLD = 50000;

export interface PoApprovalRoute {
  finalApprover: PoApproverRole;
  requiresCfo: boolean;
  twoStep: boolean;
  deviationFlag: boolean;
  note: string;
}

export function poApproverRoleLabel(role: PoApproverRole): string {
  return role === 'cfo' ? 'CFO' : 'Procurement Head';
}

/** Frontend preview of the approval route (backend is authoritative on submit). */
export function resolvePoApprovalRoute(poType: PoType, amount: number): PoApprovalRoute {
  const amt = Number(amount) || 0;
  let finalApprover: PoApproverRole = 'proc_head';
  let deviationFlag = false;
  let note = 'Single-step — Procurement Head reviews and approves.';
  switch (poType) {
    case 'regular':
      if (amt > PO_REGULAR_CFO_THRESHOLD) { finalApprover = 'cfo'; note = `Above ₹${PO_REGULAR_CFO_THRESHOLD.toLocaleString('en-IN')} — CFO approval required.`; }
      break;
    case 'blanket':
      finalApprover = 'cfo'; note = 'Blanket (umbrella) PO — CFO approval required.'; break;
    case 'spot':
      finalApprover = 'cfo'; deviationFlag = true; note = 'Spot / Emergency — deviation flagged, CFO approval required.'; break;
    case 'consignment':
      finalApprover = 'cfo'; note = 'Consignment — QA Head review + CFO approval.'; break;
    case 'sample':
      if (amt > PO_SAMPLE_CFO_THRESHOLD) { finalApprover = 'cfo'; note = `Above ₹${PO_SAMPLE_CFO_THRESHOLD.toLocaleString('en-IN')} — R&D review + CFO approval.`; }
      else { note = 'Sample / Trial — Procurement Head approves.'; }
      break;
    default: break;
  }
  const requiresCfo = finalApprover === 'cfo';
  return { finalApprover, requiresCfo, twoStep: requiresCfo, deviationFlag, note };
}

// ─── PO → Vendor loop (Flowchart Sub-flow F · SENT / ACK / reject) ───────────
export type PoVendorStatus = 'not_sent' | 'sent' | 'acknowledged' | 'rejected';

export const PO_VENDOR_STATUS_CONFIG: Record<PoVendorStatus, StatusConfig> = {
  not_sent:     mk('Not Sent', 'slate'),
  sent:         mk('Sent', 'cyan'),
  acknowledged: mk('Acknowledged', 'emerald'),
  rejected:     mk('Vendor Rejected', 'red'),
};

export type PoSendChannel = 'portal' | 'email' | 'whatsapp';
export const PO_SEND_CHANNEL_OPTIONS: Array<{ value: PoSendChannel; label: string }> = [
  { value: 'portal', label: 'Vendor Portal' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

/** Ack-SLA window in days (mirrors backend ACK_SLA_DAYS). */
export const PO_ACK_SLA_DAYS = 2;

// ─── 3-way match + Payment → Closed (Flowchart Sub-flow I) ───────────────────
export type PoMatchVerdict = 'awaiting_invoice' | 'pass' | 'variance';

export const PO_MATCH_VERDICT_CONFIG: Record<PoMatchVerdict, StatusConfig> = {
  awaiting_invoice: mk('Awaiting Invoice', 'slate'),
  pass:             mk('Match Passed', 'emerald'),
  variance:         mk('Variance', 'red'),
};

export type PoMatchLineVerdict =
  | 'matched' | 'short_received' | 'over_received' | 'over_billed' | 'unexpected';

export const PO_MATCH_LINE_CONFIG: Record<PoMatchLineVerdict, StatusConfig> = {
  matched:        mk('Matched', 'emerald'),
  short_received: mk('Short received', 'amber'),
  over_received:  mk('Over received', 'orange'),
  over_billed:    mk('Over billed', 'red'),
  unexpected:     mk('Unexpected', 'violet'),
};

export const PO_PAYMENT_MODE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'imps', label: 'IMPS' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

// ─── §9.2 PO workflow ────────────────────────────────────────────────────────
export type PoStatus =
  | 'draft' | 'awaiting_payment' | 'issued' | 'accepted'
  | 'on_hold' | 'terminated' | 'completed';

export const PO_STATUS_CONFIG: Record<PoStatus, StatusConfig> = {
  draft:            mk('Draft', 'slate'),
  awaiting_payment: mk('Awaiting Payment', 'orange'),
  issued:           mk('Issued', 'cyan'),
  accepted:         mk('Accepted', 'emerald'),
  on_hold:          mk('On Hold', 'orange'),
  terminated:       mk('Terminated', 'red'),
  completed:        mk('Completed', 'emerald'),
};

/** PO row may show "Initiate Shipment" only in these states (§4.1). */
export const PO_SHIPPABLE_STATUSES: PoStatus[] = ['issued', 'accepted'];

// ─── §9.3 Quote (RFQ) workflow ───────────────────────────────────────────────
export type QuoteStatus = 'draft' | 'requested' | 'completed' | 'terminated';

export const QUOTE_STATUS_CONFIG: Record<QuoteStatus, StatusConfig> = {
  draft:      mk('Draft', 'slate'),
  requested:  mk('Requested', 'cyan'),
  completed:  mk('Completed', 'emerald'),
  terminated: mk('Terminated', 'red'),
};

// ─── §9.4 Audit workflow ─────────────────────────────────────────────────────
export type AuditStatus = 'requested' | 'audited' | 'updated' | 're_audit' | 'terminated';

export const AUDIT_STATUS_CONFIG: Record<AuditStatus, StatusConfig> = {
  requested:  mk('Requested', 'cyan'),
  audited:    mk('Audited', 'violet'),
  updated:    mk('Updated', 'emerald'),
  re_audit:   mk('Re-Audit', 'amber'),
  terminated: mk('Terminated', 'red'),
};

// ─── §9.5 GRN workflow (6 stages, per shipment line) ─────────────────────────
export type GrnStage =
  | 'in_transit' | 'landed' | 'verified' | 'quarantined' | 'qc_tested' | 'grn_completed';

export const GRN_STAGE_CONFIG: Record<GrnStage, StatusConfig> = {
  in_transit:    mk('In Transit', 'gray'),
  landed:        mk('Landed', 'cyan'),
  verified:      mk('Verified', 'violet'),
  quarantined:   mk('Quarantined', 'orange'),
  qc_tested:     mk('QC Tested', 'blue'),
  grn_completed: mk('GRN Completed', 'emerald'),
};

export const GRN_STAGE_ORDER: GrnStage[] = [
  'in_transit', 'landed', 'verified', 'quarantined', 'qc_tested', 'grn_completed',
];

// ─── §9.6 Purchase Status (financial lifecycle, per PO line) ──────────────────
export type PurchaseStatus = 'ordered' | 'received' | 'billed' | 'paid' | 'returned';

export const PURCHASE_STATUS_CONFIG: Record<PurchaseStatus, StatusConfig> = {
  ordered:  mk('Ordered', 'slate'),
  received: mk('Received', 'cyan'),
  billed:   mk('Billed', 'violet'),
  paid:     mk('Paid', 'emerald'),
  returned: mk('Returned', 'red'),
};

// ─── §10 SLA & flag rules ────────────────────────────────────────────────────
/** Default committed SLAs (days) — overridable from Settings later. */
export const SLA_DEFAULTS = {
  /** View 1 PR — days open vs committed procurement SLA. */
  procurementDays: 2,
  /** View 3 Quotes — days since sent. */
  quoteDays: 5,
  /** View 4 Audit — days open. */
  auditDays: 2,
} as const;

export type SlaLevel = 'ok' | 'warn' | 'bad';

export const SLA_LEVEL_CLASSES: Record<SlaLevel, string> = {
  ok:   'text-emerald-600',
  warn: 'text-amber-600 font-semibold',
  bad:  'text-red-600 font-bold',
};

export const SLA_LEVEL_PREFIX: Record<SlaLevel, string> = {
  ok: '✓', warn: '⚠', bad: '🚩',
};

/**
 * SLA flag for a "days open vs committed days" field (§10 rows for PR/Quote/Audit).
 * ok while within committed, warn on the committed day, bad once exceeded.
 */
export function slaLevelFromDaysOpen(daysOpen: number, committed: number): SlaLevel {
  if (daysOpen > committed) return 'bad';
  if (daysOpen >= committed) return 'warn';
  return 'ok';
}

/** Date-vs-need-by flag: red if expected after need-by, amber within 2 days. */
export function expectedVsNeedByLevel(
  expected: string | null | undefined,
  needBy: string | null | undefined,
): SlaLevel {
  if (!expected || !needBy) return 'ok';
  const e = new Date(expected); e.setHours(0, 0, 0, 0);
  const n = new Date(needBy); n.setHours(0, 0, 0, 0);
  if (Number.isNaN(e.getTime()) || Number.isNaN(n.getTime())) return 'ok';
  const diffDays = Math.round((e.getTime() - n.getTime()) / 86_400_000);
  if (diffDays > 0) return 'bad';
  if (diffDays >= -2) return 'warn';
  return 'ok';
}
