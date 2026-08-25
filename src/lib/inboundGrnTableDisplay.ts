import { getDaysLeft } from '../utils/orderFulfillmentUtils';
import {
  formatInboundSourceDocChip,
  type InboundGrnSourceDocuments,
} from './inboundGrnSourceDocs';
import {
  inboundGrnLandedAt,
  isInboundGrnCompleted,
  isInboundGrnInTransit,
  isInboundGrnLanded,
  isInboundGrnQcComplete,
  isInboundGrnQcReportSent,
  isInboundGrnQcTested,
  isInboundGrnDocumentMismatch,
  isInboundGrnQuarantined,
  isInboundGrnReceiptConfirmed,
  isInboundGrnSentToQc,
  isInboundGrnVerified,
  INBOUND_GRN_RECEIPT_CONFIRMED_STEP,
  appendInboundGrnWorkflowStep,
} from './inboundGrnStatus';

export type InboundGrnSlaTone = 'ok' | 'warn' | 'bad' | 'neutral';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export type InboundGrnLineInput = {
  item?: string;
  itemCode?: string;
  poQty?: number;
  rcvdQty?: number;
  unit?: string;
  diff?: number;
  qcStatus?: string;
};

export type InboundGrnRowInput = {
  grnNo: string;
  poNo?: string | null;
  vendor?: string | null;
  status?: string | null;
  qcStatus?: string | null;
  receiptSource?: string | null;
  purchaseOrderId?: number | string | null;
  expectedDate?: string | null;
  receivedDate?: string | null;
  grnDate?: string | null;
  /** When the GRN record was created. Always present, unlike grnDate. */
  createdAt?: string | null;
  locationZone?: string | null;
  locationPrefix?: string | null;
  assignedTo?: string | null;
  grnBatchMfg?: string | null;
  mfgBatch?: string | null;
  noOfBoxes?: number | null;
  unitsPerBox?: number | null;
  invoiceNo?: string | null;
  workflowSteps?: string[] | null;
  generatedLabels?: unknown[] | null;
  sourceDocuments?: InboundGrnSourceDocuments | null;
  transferOrderRef?: string | null;
  lineItemsCount?: number;
  lineItem?: InboundGrnLineInput | null;
};

export type InboundGrnTableRowView = {
  shipmentDate: string;
  grnNo: string;
  warehouse: string;
  storagePrimary: string;
  storageSecondary: string | null;
  sourceDocs: string;
  sourceDocsHint: string;
  sourceDocsComplete: boolean;
  statusLabel: string;
  statusSubLabel: string | null;
  statusTone: 'transit' | 'landed' | 'verified' | 'qc' | 'quarantine' | 'complete' | 'default';
  slaIcon: string;
  slaLabel: string;
  slaTone: InboundGrnSlaTone;
  relatedPrimary: string | null;
  relatedSecondary: string | null;
  actionLabel: string;
  actionPrefix: string | null;
};

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatInboundTableDate(raw: string | Date | null | undefined): string {
  const d = raw instanceof Date ? raw : parseDate(String(raw ?? ''));
  if (!d) return '—';
  const month = MONTH_SHORT[d.getMonth()];
  return month ? `${d.getDate()}-${month}` : '—';
}

function formatInboundDateTimeShort(raw: string | null | undefined): string | null {
  const d = parseDate(raw);
  if (!d) return null;
  const month = MONTH_SHORT[d.getMonth()];
  if (!month) return null;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()}-${month} ${hours}:${minutes}`;
}

export function displayInboundGrnNo(grnNo: string | null | undefined): string {
  const raw = String(grnNo ?? '').trim();
  if (!raw) return '—';
  return raw.replace(/^GRN-PO-/i, 'GRN-');
}

export function resolveInboundWarehouseCode(
  grn: Pick<InboundGrnRowInput, 'locationZone'>,
  lineItem: InboundGrnLineInput | null | undefined,
): string {
  const code = String(lineItem?.itemCode ?? '').trim().toUpperCase();
  if (/^5[LBS]/.test(code)) return 'SW';
  const zone = String(grn.locationZone ?? '').trim().toUpperCase();
  if (zone.includes('SW') || zone.includes('SECOND') || zone.includes('SPM')) return 'SW';
  return 'MW';
}

function formatPackLine(grn: InboundGrnRowInput, unit?: string): string | null {
  const boxes = Number(grn.noOfBoxes);
  const perBox = Number(grn.unitsPerBox);
  if (!Number.isFinite(boxes) || boxes <= 0 || !Number.isFinite(perBox) || perBox <= 0) return null;
  const u = String(unit ?? '').trim();
  return u ? `${boxes} boxes × ${perBox.toLocaleString('en-IN')} ${u}` : `${boxes} boxes × ${perBox.toLocaleString('en-IN')}`;
}

function formatGrnBatch(grn: InboundGrnRowInput): string | null {
  const batch = String(grn.grnBatchMfg ?? grn.mfgBatch ?? '').trim();
  return batch || null;
}

export function buildInboundStorageView(grn: InboundGrnRowInput): {
  primary: string;
  secondary: string | null;
} {
  const status = String(grn.status ?? '').trim();
  const qc = String(grn.qcStatus ?? grn.lineItem?.qcStatus ?? '').trim().toLowerCase();
  const unit = grn.lineItem?.unit;
  const rack = String(grn.locationPrefix ?? '').trim();
  const batch = formatGrnBatch(grn);
  const pack = formatPackLine(grn, unit);

  if (status === 'On Hold' || qc === 'fail' || qc === 'hold') {
    return { primary: '— in QC hold', secondary: null };
  }

  if (rack) {
    const rackPart = rack.startsWith('Rack-') ? rack : `Rack-${rack}`;
    const primary = pack ? `${rackPart} · ${pack}` : rackPart;
    return { primary, secondary: batch };
  }

  if (status === 'In Transit' || status === 'Delayed') {
    return { primary: '— (pre-rack)', secondary: null };
  }

  return { primary: '— pending rack', secondary: batch };
}

export function formatInboundSourceDocSet(grn: InboundGrnRowInput): {
  label: string;
  complete: boolean;
  requiredLabel: string;
  uploaded: number;
  required: number;
} {
  return formatInboundSourceDocChip(grn);
}

function lineQtyMismatch(grn: InboundGrnRowInput): number | null {
  const line = grn.lineItem;
  if (!line) return null;
  if (line.diff != null && Number.isFinite(Number(line.diff)) && Math.abs(Number(line.diff)) > 0.0001) {
    return Number(line.diff);
  }
  const po = Number(line.poQty);
  const rcvd = Number(line.rcvdQty);
  if (!Number.isFinite(po) || !Number.isFinite(rcvd)) return null;
  const diff = rcvd - po;
  return Math.abs(diff) > 0.0001 ? diff : null;
}

function isLandedStatus(status: string): boolean {
  return status === 'Under GRN' || status === 'Pending';
}

export function buildInboundGrnStatusView(grn: InboundGrnRowInput): {
  label: string;
  subLabel: string | null;
  tone: InboundGrnTableRowView['statusTone'];
} {
  const landedAt = inboundGrnLandedAt(grn);

  if (isInboundGrnCompleted(grn)) {
    return { label: 'GRN COMPLETED', subLabel: null, tone: 'complete' };
  }

  // QC pass outranks quarantine: the mismatch workflow step that flags quarantine is append-only,
  // so without this a quarantined GRN whose QC later PASSED read QUARANTINED forever ("in QC hold")
  // and its Assign Rack action never surfaced. Mirrors INBOUND_GRN_LIFECYCLE order.
  if (isInboundGrnQcTested(grn)) {
    return { label: 'QC TESTED · PASS', subLabel: null, tone: 'qc' };
  }

  if (isInboundGrnQuarantined(grn)) {
    const line = grn.lineItem;
    const unit = String(line?.unit ?? '').trim();
    let subLabel: string | null = null;
    if (isInboundGrnDocumentMismatch(grn)) {
      subLabel = 'document-physical mismatch';
    } else {
      let mismatch: number | null = null;
      if (line?.diff != null && Number.isFinite(Number(line.diff)) && Math.abs(Number(line.diff)) > 0.0001) {
        mismatch = Number(line.diff);
      } else if (line) {
        const po = Number(line.poQty);
        const rcvd = Number(line.rcvdQty);
        if (Number.isFinite(po) && Number.isFinite(rcvd) && Math.abs(rcvd - po) > 0.0001) {
          mismatch = rcvd - po;
        }
      }
      subLabel =
        mismatch != null
          ? `qty mismatch ${mismatch > 0 ? '+' : ''}${mismatch.toLocaleString('en-IN')}${unit ? ` ${unit}` : ''}`
          : null;
    }
    return { label: 'QUARANTINED', subLabel, tone: 'quarantine' };
  }

  if (isInboundGrnVerified(grn)) {
    return { label: 'VERIFIED', subLabel: null, tone: 'verified' };
  }

  if (isInboundGrnLanded(grn)) {
    return {
      label: 'LANDED',
      subLabel: landedAt ? formatInboundDateTimeShort(landedAt) : null,
      tone: 'landed',
    };
  }

  if (isInboundGrnInTransit(grn)) {
    return { label: 'IN TRANSIT', subLabel: null, tone: 'transit' };
  }

  if (isLandedStatus(String(grn.status ?? '').trim()) && landedAt) {
    return {
      label: 'LANDED',
      subLabel: formatInboundDateTimeShort(landedAt),
      tone: 'landed',
    };
  }

  const status = String(grn.status ?? '').trim();
  if (status === 'In Transit' || status === 'Delayed') {
    return { label: 'IN TRANSIT', subLabel: null, tone: 'transit' };
  }

  return { label: status.toUpperCase() || 'IN TRANSIT', subLabel: null, tone: 'default' };
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

export function buildInboundGrnSlaView(grn: InboundGrnRowInput): {
  icon: string;
  label: string;
  tone: InboundGrnSlaTone;
} {
  const landedAt = inboundGrnLandedAt(grn);

  if (isInboundGrnCompleted(grn)) {
    const end = grn.receivedDate ?? grn.grnDate;
    const days = daysSince(end) ?? 1;
    return { icon: '✓', label: `${Math.max(days, 1)}d total`, tone: 'ok' };
  }

  if (isInboundGrnQuarantined(grn)) {
    const days = daysSince(landedAt ?? grn.expectedDate) ?? 1;
    return { icon: '🚩', label: `${Math.max(days, 1)}d in Q`, tone: 'bad' };
  }

  if (isInboundGrnQcTested(grn)) {
    const hours = hoursSince(landedAt) ?? 4;
    return { icon: '✓', label: `${hours}h to QC`, tone: 'ok' };
  }

  if (isInboundGrnVerified(grn)) {
    const hours = hoursSince(landedAt) ?? 1;
    return { icon: '✓', label: `${Math.max(hours, 1)}h since verified`, tone: 'ok' };
  }

  if (isInboundGrnLanded(grn)) {
    const hours = hoursSince(landedAt) ?? 0;
    if (hours >= 1) return { icon: '⚠', label: `${hours}h since landed`, tone: 'warn' };
    return { icon: '✓', label: 'Landed today', tone: 'ok' };
  }

  if (isInboundGrnInTransit(grn)) {
    const eta = String(grn.expectedDate ?? '').trim().slice(0, 10);
    if (eta) return { icon: '✓', label: `ETA ${formatInboundTableDate(eta)}`, tone: 'ok' };
    return { icon: '', label: '—', tone: 'neutral' };
  }

  const target = String(grn.expectedDate ?? '').trim().slice(0, 10);
  if (!target) return { icon: '', label: '—', tone: 'neutral' };
  const daysLeft = getDaysLeft(target);
  if (daysLeft === null) return { icon: '', label: '—', tone: 'neutral' };
  if (daysLeft < 0) return { icon: '🚩', label: `${Math.abs(daysLeft)}d overdue`, tone: 'bad' };
  if (daysLeft <= 2) return { icon: '⚠', label: `${daysLeft}d left`, tone: 'warn' };
  return { icon: '✓', label: `${daysLeft}d left`, tone: 'ok' };
}

function formatShipmentBatchRef(grn: InboundGrnRowInput): string | null {
  const batch = formatGrnBatch(grn);
  if (batch && /^SB-/i.test(batch)) return batch;
  const po = String(grn.poNo ?? '').trim();
  if (po) return po.replace(/^PO[\s-]*/i, 'SB-');
  return null;
}

export function buildInboundRelatedView(
  grn: InboundGrnRowInput,
  siblingGrnCount = 0,
): { primary: string | null; secondary: string | null } {
  const siblings = Math.max(0, Number(grn.lineItemsCount ?? 1) - 1);
  const relatedGrns = Math.max(0, siblingGrnCount);
  const po = String(grn.poNo ?? '').trim();

  if (siblings > 0) {
    return {
      primary: `▶ ${siblings} sibling${siblings === 1 ? '' : 's'}`,
      secondary: formatShipmentBatchRef(grn),
    };
  }

  if (relatedGrns > 0 && po) {
    return {
      primary: `▶ ${relatedGrns} related`,
      secondary: `${po} siblings`,
    };
  }

  return { primary: null, secondary: null };
}

export function inboundGrnArrivalConfirmPayload(
  existingSteps?: string[] | null,
  now = new Date(),
): {
  status: string;
  receivedDate: string;
  grnDate: string;
  workflowSteps: string[];
} {
  const iso = now.toISOString();
  const dateOnly = iso.slice(0, 10);
  return {
    status: 'Under GRN',
    receivedDate: dateOnly,
    grnDate: dateOnly,
    workflowSteps: appendInboundGrnWorkflowStep(existingSteps, INBOUND_GRN_RECEIPT_CONFIRMED_STEP),
  };
}

export function inboundGrnActionView(grn: InboundGrnRowInput): { label: string; prefix: string | null } {
  const statusView = buildInboundGrnStatusView(grn);

  /** Rack first, then labels: an unracked GRN goes to the Assign Rack popup; once racked, what
      remains (documents + QR labels + completion) lives in GRN Copy. "Racked" requires an
      assignee too — GRN Copy's own completion check refuses to finish a GRN with no assignedTo,
      so a rack-only save must keep routing back to Assign Rack or the two screens deadlock again
      (rack chosen, GRN Copy says "go assign rack", but the row button no longer opens it). */
  const assignRackOrGrnCopy = (): { label: string; prefix: string | null } => {
    const pfx = String(grn.locationPrefix ?? '').trim();
    const racked =
      pfx !== '' && pfx.toUpperCase() !== 'DEFAULT' && String(grn.assignedTo ?? '').trim() !== '';
    return racked
      ? { label: 'GRN Copy', prefix: '📋' }
      : { label: 'Assign Rack', prefix: '📍' };
  };

  if (statusView.label === 'GRN COMPLETED') {
    return { label: 'GRN Copy', prefix: '📋' };
  }
  if (statusView.label === 'QUARANTINED') {
    if (isInboundGrnSentToQc(grn)) {
      if (isInboundGrnQcTested(grn)) {
        return assignRackOrGrnCopy();
      }
      if (isInboundGrnQcComplete(grn) || isInboundGrnQcReportSent(grn)) {
        return { label: 'QC Check', prefix: '🧪' };
      }
      return { label: 'Awaiting QC', prefix: '⏳' };
    }
    return { label: 'Send to QC', prefix: '🚦' };
  }
  if (statusView.label === 'QC TESTED · PASS') {
    return assignRackOrGrnCopy();
  }
  if (statusView.label === 'VERIFIED') {
    if (isInboundGrnSentToQc(grn)) {
      if (isInboundGrnQcTested(grn)) {
        return assignRackOrGrnCopy();
      }
      return { label: 'Awaiting QC', prefix: '⏳' };
    }
    return { label: 'Send to QC', prefix: '🚦' };
  }
  if (statusView.label === 'LANDED') {
    // Distinct, situation-specific action so LANDED never shows the same label as GRN COMPLETED.
    if (!isInboundGrnReceiptConfirmed(grn)) {
      return { label: 'Confirm Receipt', prefix: '✓' };
    }
    const pfx = String(grn.locationPrefix ?? '').trim();
    const racked =
      pfx !== '' && pfx.toUpperCase() !== 'DEFAULT' && String(grn.assignedTo ?? '').trim() !== ''; // 'DEFAULT' = auto placeholder, not a real rack
    if (racked) {
      return { label: 'GRN Copy', prefix: '📋' }; // landed + racked → nothing left but pull the copy
    }
    if (isInboundGrnVerified(grn)) {
      return { label: 'Assign Rack', prefix: '📍' }; // docs/labels done → put it on a rack
    }
    // Receipt confirmed but docs/labels still incomplete and not racked → finish it in the staged
    // receipt modal (openInboundRowAction routes every receiving label there, in grn-copy mode).
    return { label: 'Complete GRN', prefix: '📦' };
  }
  if (statusView.label === 'IN TRANSIT') {
    return { label: 'Confirm', prefix: '✓' };
  }

  // Statuses that resolve to a raw label (buildInboundGrnStatusView fallback) — most importantly
  // "Under GRN" (received / being processed but with no landed-at stamp, so it matched neither the
  // LANDED nor IN TRANSIT flag). Without this these rows all showed a constant generic 'Open'. Mirror
  // the LANDED → receipt → QC → rack progression so the action reflects the actual current stage.
  const rawStatus = String(grn.status ?? '').trim();
  if (rawStatus === 'Under GRN' || statusView.label === 'UNDER GRN') {
    if (isInboundGrnSentToQc(grn)) {
      if (isInboundGrnQcTested(grn)) return assignRackOrGrnCopy();
      if (isInboundGrnQcComplete(grn) || isInboundGrnQcReportSent(grn)) return { label: 'QC Check', prefix: '🧪' };
      return { label: 'Awaiting QC', prefix: '⏳' };
    }
    return isInboundGrnReceiptConfirmed(grn)
      ? { label: 'Send to QC', prefix: '🚦' }
      : { label: 'Confirm Receipt', prefix: '✓' };
  }
  if (rawStatus === 'On Hold' || statusView.label === 'ON HOLD') {
    return { label: 'Send to QC', prefix: '🚦' };
  }
  if (rawStatus === 'Pending' || rawStatus === 'Delayed' || statusView.label === 'PENDING' || statusView.label === 'DELAYED') {
    return { label: 'Confirm', prefix: '✓' };
  }
  return { label: 'Open', prefix: null };
}

export function inboundGrnSlaClass(tone: InboundGrnSlaTone): string {
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

export function inboundGrnStatusClass(tone: InboundGrnTableRowView['statusTone']): string {
  switch (tone) {
    case 'transit':
      return 'text-blue-700 font-semibold';
    case 'landed':
      return 'text-violet-700 font-semibold';
    case 'verified':
      return 'text-cyan-700 font-semibold';
    case 'qc':
      return 'text-emerald-700 font-semibold';
    case 'quarantine':
      return 'text-rose-700 font-semibold';
    case 'complete':
      return 'text-slate-700 font-semibold';
    default:
      return 'text-amber-700 font-semibold';
  }
}

export function formatInboundQty(value: number | null | undefined, unit?: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const u = String(unit ?? '').trim();
  return u ? `${n.toLocaleString('en-IN')} ${u}` : n.toLocaleString('en-IN');
}

export function buildInboundGrnTableRowView(
  grn: InboundGrnRowInput,
  siblingGrnCount = 0,
): InboundGrnTableRowView {
  const storage = buildInboundStorageView(grn);
  const sourceDocs = formatInboundSourceDocSet(grn);
  const status = buildInboundGrnStatusView(grn);
  const sla = buildInboundGrnSlaView(grn);
  const related = buildInboundRelatedView(grn, siblingGrnCount);
  const action = inboundGrnActionView(grn);

  return {
    shipmentDate: formatInboundShipmentLabel(grn),
    grnNo: displayInboundGrnNo(grn.grnNo),
    warehouse: resolveInboundWarehouseCode(grn, grn.lineItem),
    storagePrimary: storage.primary,
    storageSecondary: storage.secondary,
    sourceDocs: sourceDocs.label,
    sourceDocsHint: sourceDocs.requiredLabel,
    sourceDocsComplete: sourceDocs.complete,
    statusLabel: status.label,
    statusSubLabel: status.subLabel,
    statusTone: status.tone,
    slaIcon: sla.icon,
    slaLabel: sla.label,
    slaTone: sla.tone,
    relatedPrimary: related.primary,
    relatedSecondary: related.secondary,
    actionLabel: action.label,
    actionPrefix: action.prefix,
  };
}

export function formatInboundStorage(grn: InboundGrnRowInput): string {
  const view = buildInboundStorageView(grn);
  return view.secondary ? `${view.primary}\n${view.secondary}` : view.primary;
}

export function formatInboundRelated(grn: InboundGrnRowInput): string {
  const related = buildInboundRelatedView(grn);
  return related.primary ?? related.secondary ?? '—';
}

export function inboundGrnActionLabel(status: string | null | undefined): string {
  return inboundGrnActionView({ grnNo: '', status }).label;
}

/**
 * The column shows when the GRN was CREATED.
 *
 * It previously read `grnDate ?? receivedDate ?? expectedDate`. Most GRNs carry no `grn_date` at
 * all, so the cell fell through to the EXPECTED date — a future date — and read as though the GRN
 * had been raised then. `createdAt` is stamped on every row, so it is authoritative; the old chain
 * remains as a fallback for any row that predates it being exposed.
 */
export function formatInboundShipmentLabel(grn: InboundGrnRowInput): string {
  return formatInboundTableDate(grn.createdAt ?? grn.grnDate ?? grn.receivedDate ?? grn.expectedDate);
}

/**
 * Sortable instant behind the Shipment column.
 *
 * The column sorted on its own display label ("24-Jul"), so it ordered alphabetically —
 * 10-Aug, 11-Aug, 17-Jul, 21-Aug — rather than chronologically. Same field precedence as
 * `formatInboundShipmentLabel` so the sort always matches what the cell shows.
 * Undated rows collapse to 0 and settle at the old end of the list.
 */
export function inboundShipmentSortValue(grn: InboundGrnRowInput): number {
  // Same field precedence as the label it sorts.
  const raw = grn.createdAt ?? grn.grnDate ?? grn.receivedDate ?? grn.expectedDate;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function formatInboundLoc(grn: InboundGrnRowInput): string {
  return resolveInboundWarehouseCode(grn, grn.lineItem);
}
