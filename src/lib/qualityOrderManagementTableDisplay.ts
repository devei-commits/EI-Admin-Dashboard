import { displayInboundGrnNo, formatInboundQty } from './inboundGrnTableDisplay';
import { buildQualityTableNavigation } from './qualityTableNavigation';
import {
  inboundGrnLandedAt,
  isInboundGrnQuarantined,
  isInboundGrnSentToQc,
  isInboundGrnVerified,
} from './inboundGrnStatus';

export type QualityOrderManagementInput = {
  id: string;
  grnNo: string;
  poNo?: string | null;
  vendor?: string | null;
  type?: 'RM' | 'PM' | string | null;
  status?: string | null;
  qcStatus?: string | null;
  assignedTo?: string | null;
  qcBy?: string | null;
  grnDate?: string | null;
  /** When the GRN record was created (not the shipment date) — same field the Inbound GRN Tracker's
      "GRN Date" column prefers over grnDate/receivedDate/expectedDate for a fresh in-transit GRN. */
  createdAt?: string | null;
  receivedDate?: string | null;
  expectedDate?: string | null;
  receiptSource?: string | null;
  purchaseOrderId?: number | null;
  transferOrderRef?: string | null;
  locationZone?: string | null;
  workflowSteps?: string[] | null;
  generatedLabels?: unknown[] | null;
  lineItems?: Array<{
    item?: string;
    itemCode?: string;
    poQty?: number;
    rcvdQty?: number;
    diff?: number;
    unit?: string;
    qcStatus?: string;
  }> | null;
};

export type QualityMaterialSection = 'RM' | 'PM';

export type QualityPriority = 'High' | 'Medium' | 'Low';

export type QualitySlaTone = 'ok' | 'warn' | 'bad' | 'neutral';

export type QualityOrderManagementRow = {
  id: string;
  section: QualityMaterialSection;
  quarantineDate: string;
  quarantineDateDisplay: string;
  grnSourceNo: string;
  itemName: string;
  itemCode: string;
  qtyInQ: string;
  qtyInQValue: number;
  source: string;
  sourceKind: 'mismatch' | 'routine';
  assignedTo: string;
  assignDisplay: string;
  approver: string;
  approverDisplay: string;
  priority: QualityPriority;
  priorityDisplay: string;
  priorityClass: string;
  slaIcon: string;
  slaLabel: string;
  slaTone: QualitySlaTone;
  qcStatusLabel: string;
  /** QC verdict already recorded (Passed/Rejected) — the row stays in this queue past this point
      instead of disappearing, but opens read-only since the decision is already made. */
  qcDecided: boolean;
  actionLabel: string;
  actionPrefix: string;
  sourceDetailHref: string;
  sourceDetailLabel: string;
  itemMasterHref: string;
  itemMasterHint: string;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const PRIORITY_CLASS: Record<QualityPriority, string> = {
  High: 'text-rose-700 font-bold',
  Medium: 'text-amber-700 font-semibold',
  Low: 'text-slate-600 font-medium',
};

function toInboundRowInput(grn: QualityOrderManagementInput) {
  const line = grn.lineItems?.[0];
  return {
    grnNo: grn.grnNo,
    poNo: grn.poNo,
    vendor: grn.vendor,
    status: grn.status,
    qcStatus: grn.qcStatus,
    grnDate: grn.grnDate,
    receivedDate: grn.receivedDate,
    expectedDate: grn.expectedDate,
    receiptSource: grn.receiptSource,
    purchaseOrderId: grn.purchaseOrderId,
    workflowSteps: grn.workflowSteps,
    generatedLabels: grn.generatedLabels,
    lineItem: line
      ? {
          item: line.item,
          itemCode: line.itemCode,
          poQty: line.poQty,
          rcvdQty: line.rcvdQty,
          diff: line.diff,
          unit: line.unit,
          qcStatus: line.qcStatus,
        }
      : null,
  };
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveQualitySection(grn: QualityOrderManagementInput): QualityMaterialSection {
  const type = String(grn.type ?? '').trim().toUpperCase();
  if (type === 'PM') return 'PM';
  if (type === 'RM') return 'RM';
  const code = String(grn.lineItems?.[0]?.itemCode ?? '').trim();
  if (/^5/i.test(code)) return 'PM';
  return 'RM';
}

export function isQualityGrnMismatch(grn: QualityOrderManagementInput): boolean {
  const status = String(grn.status ?? '').trim();
  if (status === 'On Hold') return true;
  const line = grn.lineItems?.[0];
  if (!line) return false;
  const diff = Number(line.diff);
  if (Number.isFinite(diff) && Math.abs(diff) > 0.0001) return true;
  const po = Number(line.poQty);
  const rcvd = Number(line.rcvdQty);
  return Number.isFinite(po) && Number.isFinite(rcvd) && Math.abs(rcvd - po) > 0.0001;
}

function resolveQuarantineDate(grn: QualityOrderManagementInput): string {
  return (
    String(grn.grnDate ?? '').trim() ||
    String(grn.receivedDate ?? '').trim() ||
    String(grn.expectedDate ?? '').trim() ||
    ''
  );
}

export function formatQualityQuarantineDateTime(raw: string | null | undefined): string {
  const d = parseDate(raw);
  if (!d) return '—';
  const month = MONTH_SHORT[d.getMonth()];
  if (!month) return '—';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()}-${month} ${hours}:${minutes}`;
}

function resolveGrnSourceNo(grn: QualityOrderManagementInput): string {
  return displayInboundGrnNo(grn.grnNo);
}

function resolveBillGrnSource(grn: QualityOrderManagementInput): string {
  return `Bill GRN · ${isQualityGrnMismatch(grn) ? 'mismatch' : 'routine'}`;
}

function resolveQtyInQNumeric(grn: QualityOrderManagementInput): number {
  const line = grn.lineItems?.[0];
  if (!line) return 0;
  const qty = Number(line.rcvdQty ?? line.poQty);
  return Number.isFinite(qty) ? qty : 0;
}

function resolveQtyInQ(grn: QualityOrderManagementInput): string {
  const line = grn.lineItems?.[0];
  if (!line) return '—';
  const section = resolveQualitySection(grn);
  const unit = String(line.unit ?? '').trim() || (section === 'PM' ? 'pcs' : 'kg');
  const qty = Number(line.rcvdQty ?? line.poQty);
  return formatInboundQty(qty, unit);
}

function hoursSince(raw: string | null | undefined, now = Date.now()): number | null {
  const d = parseDate(raw);
  if (!d) return null;
  return Math.max(0, Math.floor((now - d.getTime()) / (60 * 60 * 1000)));
}

function daysSince(raw: string | null | undefined, now = Date.now()): number | null {
  const d = parseDate(raw);
  if (!d) return null;
  return Math.max(0, Math.floor((now - d.getTime()) / (24 * 60 * 60 * 1000)));
}

export function buildQualitySlaView(
  grn: QualityOrderManagementInput,
  now = Date.now(),
): { icon: string; label: string; tone: QualitySlaTone } {
  const mismatch = isQualityGrnMismatch(grn);
  const inbound = toInboundRowInput(grn);
  const verified = isInboundGrnVerified(inbound);
  const anchor = resolveQuarantineDate(grn) || inboundGrnLandedAt(inbound) || '';
  const hours = hoursSince(anchor, now);
  const days = daysSince(anchor, now);

  if (mismatch) {
    if (verified && days != null && days >= 1) {
      return { icon: '🚩', label: `${days}d in QC`, tone: 'bad' };
    }
    if (hours != null && hours < 24) {
      return { icon: '⚠', label: `${Math.max(hours, 1)}h in Q`, tone: 'warn' };
    }
    if (days != null && days >= 1) {
      return { icon: '🚩', label: `${days}d in Q`, tone: 'bad' };
    }
    return { icon: '⚠', label: `${Math.max(hours ?? 1, 1)}h in Q`, tone: 'warn' };
  }

  if (days != null && days >= 2) {
    return { icon: '⚠', label: `${days}d in QC`, tone: 'warn' };
  }
  return { icon: '✓', label: 'in time', tone: 'ok' };
}

function resolveQcDecision(grn: QualityOrderManagementInput): { label: string; decided: boolean } {
  const qc = String(grn.qcStatus ?? '').trim();
  if (qc === 'Passed' || qc === 'Pass') return { label: 'Passed', decided: true };
  if (qc === 'Rejected' || qc === 'Fail' || qc === 'Failed') return { label: 'Rejected', decided: true };
  return { label: qc || 'Pending', decided: false };
}

function resolvePriority(grn: QualityOrderManagementInput): QualityPriority {
  if (isQualityGrnMismatch(grn)) return 'High';
  return 'Medium';
}

export function formatQualityAssigneeShortName(name: string): string {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return 'Open';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const lastInitial = (parts[parts.length - 1][0] ?? '').toUpperCase();
  return `${parts[0]} ${lastInitial}.`;
}

export function formatQualityApproverDisplay(name: string): string {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return '—';
  const drMatch = trimmed.match(/^(Dr\.?\s+)/i);
  const prefix = drMatch ? 'Dr. ' : '';
  const rest = drMatch ? trimmed.slice(drMatch[0].length).trim() : trimmed;
  const parts = rest.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return `${prefix}${parts[0]}`;
  const lastInitial = (parts[parts.length - 1][0] ?? '').toUpperCase();
  return `${prefix}${parts[0]} ${lastInitial}.`;
}

export function buildQualityOrderManagementRow(
  grn: QualityOrderManagementInput,
  now = Date.now(),
): QualityOrderManagementRow {
  const line = grn.lineItems?.[0];
  const sla = buildQualitySlaView(grn, now);
  const qDate = resolveQuarantineDate(grn);
  const priority = resolvePriority(grn);
  const assignedTo = String(grn.assignedTo ?? '').trim();
  const approver = String(grn.qcBy ?? '').trim();
  const navigation = buildQualityTableNavigation(grn);
  const qcDecision = resolveQcDecision(grn);

  return {
    id: grn.id,
    section: resolveQualitySection(grn),
    quarantineDate: qDate,
    quarantineDateDisplay: formatQualityQuarantineDateTime(qDate),
    grnSourceNo: resolveGrnSourceNo(grn),
    itemName: String(line?.item ?? '').trim() || String(line?.itemCode ?? '').trim() || '—',
    itemCode: String(line?.itemCode ?? '').trim() || '—',
    qtyInQ: resolveQtyInQ(grn),
    qtyInQValue: resolveQtyInQNumeric(grn),
    source: resolveBillGrnSource(grn),
    sourceKind: isQualityGrnMismatch(grn) ? 'mismatch' : 'routine',
    assignedTo,
    assignDisplay: formatQualityAssigneeShortName(assignedTo),
    approver,
    approverDisplay: formatQualityApproverDisplay(approver),
    priority,
    priorityDisplay: priority.toUpperCase(),
    priorityClass: PRIORITY_CLASS[priority],
    slaIcon: sla.icon,
    slaLabel: sla.label,
    slaTone: sla.tone,
    qcStatusLabel: qcDecision.label,
    qcDecided: qcDecision.decided,
    actionLabel: qcDecision.decided ? 'View' : 'QC',
    actionPrefix: qcDecision.decided ? '👁' : '🧪',
    sourceDetailHref: navigation.sourceDetailHref,
    sourceDetailLabel: navigation.sourceDetailLabel,
    itemMasterHref: navigation.itemMasterHref,
    itemMasterHint: navigation.itemMasterHint,
  };
}

/**
 * GRNs explicitly sent from warehouse to QC. Stays visible after a verdict is recorded (or the GRN
 * is later fully completed) rather than dropping the row — completed ones just show a decided
 * status and open read-only, instead of only living on a separate history page.
 */
export function filterQualityOrderManagementQueue(grns: QualityOrderManagementInput[]): QualityOrderManagementInput[] {
  return grns.filter((grn) => isInboundGrnSentToQc(toInboundRowInput(grn)));
}

export function buildQualityOrderManagementRows(grns: QualityOrderManagementInput[]): QualityOrderManagementRow[] {
  return grns.map((grn) => buildQualityOrderManagementRow(grn));
}

/** Build an order-management row for a single GRN line (warehouse QC Check popup). */
export function buildQualityOrderManagementRowForGrnLine(
  grn: QualityOrderManagementInput,
  lineItem?: NonNullable<QualityOrderManagementInput['lineItems']>[number] | null,
): QualityOrderManagementRow {
  if (!lineItem) return buildQualityOrderManagementRow(grn);
  return buildQualityOrderManagementRow({
    ...grn,
    lineItems: [lineItem],
  });
}

export type QualityOrderManagementSortKey =
  | 'section'
  | 'quarantineDate'
  | 'grnSourceNo'
  | 'item'
  | 'qtyInQ'
  | 'source'
  | 'assign'
  | 'approver'
  | 'priority'
  | 'sla';

export type QualityOrderManagementFilters = {
  search: string;
  section: QualityMaterialSection | 'all';
  priority: QualityPriority | 'all';
  sourceKind: 'all' | 'mismatch' | 'routine';
  assignStatus: 'all' | 'open' | 'assigned';
};

const PRIORITY_ORDER: Record<QualityPriority, number> = { High: 0, Medium: 1, Low: 2 };
const SLA_TONE_ORDER: Record<QualitySlaTone, number> = { bad: 0, warn: 1, ok: 2, neutral: 3 };

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function matchesQualityOrderManagementSearch(row: QualityOrderManagementRow, query: string): boolean {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.section,
    row.grnSourceNo,
    row.itemName,
    row.itemCode,
    row.qtyInQ,
    row.source,
    row.sourceDetailLabel,
    row.assignedTo,
    row.assignDisplay,
    row.approver,
    row.approverDisplay,
    row.priorityDisplay,
    row.slaLabel,
    row.itemMasterHint,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function applyQualityOrderManagementFilters(
  rows: QualityOrderManagementRow[],
  filters: QualityOrderManagementFilters,
): QualityOrderManagementRow[] {
  let result = rows;
  if (filters.section !== 'all') {
    result = result.filter((row) => row.section === filters.section);
  }
  if (filters.priority !== 'all') {
    result = result.filter((row) => row.priority === filters.priority);
  }
  if (filters.sourceKind === 'mismatch') {
    result = result.filter((row) => row.sourceKind === 'mismatch');
  } else if (filters.sourceKind === 'routine') {
    result = result.filter((row) => row.sourceKind === 'routine');
  }
  if (filters.assignStatus === 'open') {
    result = result.filter((row) => !String(row.assignedTo ?? '').trim());
  } else if (filters.assignStatus === 'assigned') {
    result = result.filter((row) => Boolean(String(row.assignedTo ?? '').trim()));
  }
  const search = String(filters.search ?? '').trim();
  if (search) {
    result = result.filter((row) => matchesQualityOrderManagementSearch(row, search));
  }
  return result;
}

export function hasActiveQualityOrderManagementFilters(filters: QualityOrderManagementFilters): boolean {
  return (
    Boolean(String(filters.search ?? '').trim()) ||
    filters.section !== 'all' ||
    filters.priority !== 'all' ||
    filters.sourceKind !== 'all' ||
    filters.assignStatus !== 'all'
  );
}

export function sortQualityOrderManagementRows(
  rows: QualityOrderManagementRow[],
  key: QualityOrderManagementSortKey,
  direction: 'asc' | 'desc',
): QualityOrderManagementRow[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'section':
        cmp = compareStrings(a.section, b.section);
        break;
      case 'quarantineDate':
        cmp = compareStrings(a.quarantineDate, b.quarantineDate);
        break;
      case 'grnSourceNo':
        cmp = compareStrings(a.grnSourceNo, b.grnSourceNo);
        break;
      case 'item':
        cmp = compareStrings(`${a.itemName} ${a.itemCode}`, `${b.itemName} ${b.itemCode}`);
        break;
      case 'qtyInQ':
        cmp = a.qtyInQValue - b.qtyInQValue;
        break;
      case 'source':
        cmp = compareStrings(a.source, b.source);
        break;
      case 'assign':
        cmp = compareStrings(a.assignedTo || 'Open', b.assignedTo || 'Open');
        break;
      case 'approver':
        cmp = compareStrings(a.approverDisplay, b.approverDisplay);
        break;
      case 'priority':
        cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        break;
      case 'sla':
        cmp = SLA_TONE_ORDER[a.slaTone] - SLA_TONE_ORDER[b.slaTone];
        break;
      default:
        cmp = 0;
    }
    if (cmp !== 0) return cmp * factor;
    return compareStrings(a.grnSourceNo, b.grnSourceNo) * factor;
  });
}

export function qualityOrderManagementSlaClass(tone: QualitySlaTone): string {
  switch (tone) {
    case 'bad':
      return 'text-red-700';
    case 'warn':
      return 'text-amber-700';
    case 'ok':
      return 'text-emerald-700';
    default:
      return 'text-slate-600';
  }
}
