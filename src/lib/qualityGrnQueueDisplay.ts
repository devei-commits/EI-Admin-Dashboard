import { buildInboundGrnStatusView, displayInboundGrnNo } from './inboundGrnTableDisplay';
import {
  isInboundGrnCompleted,
  isInboundGrnQcTested,
  isInboundGrnQuarantined,
  isInboundGrnSentToQc,
  isInboundGrnVerified,
} from './inboundGrnStatus';

export type QualityGrnQueueInput = {
  id: string;
  grnNo: string;
  poNo?: string | null;
  vendor?: string | null;
  status?: string | null;
  qcStatus?: string | null;
  grnDate?: string | null;
  receivedDate?: string | null;
  workflowSteps?: string[] | null;
  generatedLabels?: unknown[] | null;
  lineItems?: Array<{
    item?: string;
    itemCode?: string;
    poQty?: number;
    rcvdQty?: number;
    qcStatus?: string;
  }> | null;
};

export type QualityGrnQueueRow = {
  id: string;
  grnNo: string;
  poNo: string;
  vendor: string;
  itemLabel: string;
  statusLabel: string;
  qcStatus: string;
  /** QC verdict already recorded (Passed/Rejected) — the row stays visible in the queue past this
      point, just read-only, rather than disappearing once a decision is made. */
  qcDecided: boolean;
};

function toRowInput(grn: QualityGrnQueueInput) {
  const line = grn.lineItems?.[0];
  return {
    grnNo: grn.grnNo,
    poNo: grn.poNo,
    vendor: grn.vendor,
    status: grn.status,
    qcStatus: grn.qcStatus,
    grnDate: grn.grnDate,
    receivedDate: grn.receivedDate,
    workflowSteps: grn.workflowSteps,
    generatedLabels: grn.generatedLabels,
    lineItem: line
      ? {
          item: line.item,
          itemCode: line.itemCode,
          poQty: line.poQty,
          rcvdQty: line.rcvdQty,
          qcStatus: line.qcStatus,
        }
      : null,
  };
}

export function buildQualityGrnQueueRow(grn: QualityGrnQueueInput): QualityGrnQueueRow {
  const line = grn.lineItems?.[0];
  const itemName = String(line?.item ?? '').trim();
  const itemCode = String(line?.itemCode ?? '').trim();
  const statusView = buildInboundGrnStatusView(toRowInput(grn));
  const qcStatus = String(grn.qcStatus ?? line?.qcStatus ?? 'Pending').trim() || 'Pending';
  return {
    id: grn.id,
    grnNo: displayInboundGrnNo(grn.grnNo),
    poNo: String(grn.poNo ?? '').trim() || '—',
    vendor: String(grn.vendor ?? '').trim() || '—',
    itemLabel: itemCode ? `${itemName || itemCode} · ${itemCode}` : itemName || '—',
    statusLabel: statusView.label,
    qcStatus,
    qcDecided: qcStatus === 'Passed' || qcStatus === 'Pass' || qcStatus === 'Rejected',
  };
}

/**
 * GRNs sent from warehouse via Send to QC. Used to stop showing a row the moment QC was decided,
 * which made the completed inspection vanish instead of staying visible as a record — the row now
 * stays in the queue (read-only once decided) rather than only living on the separate QC History
 * page.
 */
export function filterInboundQcQueue(grns: QualityGrnQueueInput[]): QualityGrnQueueInput[] {
  return grns.filter((grn) => isInboundGrnSentToQc(toRowInput(grn)));
}

export function filterQuarantineQueue(grns: QualityGrnQueueInput[]): QualityGrnQueueInput[] {
  return grns.filter((grn) => {
    const input = toRowInput(grn);
    if (isInboundGrnCompleted(input)) return false;
    if (isInboundGrnQcTested(input)) return false;
    if (isInboundGrnSentToQc(input)) return false;
    return isInboundGrnQuarantined(input);
  });
}

export function filterQcHistory(grns: QualityGrnQueueInput[]): QualityGrnQueueInput[] {
  return grns.filter((grn) => isInboundGrnQcTested(toRowInput(grn)));
}

export type QualityGrnQueueSortKey = 'grnNo' | 'itemLabel' | 'poNo' | 'vendor' | 'statusLabel' | 'qcStatus';

export function searchQualityGrnQueueRows(
  rows: QualityGrnQueueRow[],
  search: string,
): QualityGrnQueueRow[] {
  const term = search.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) =>
    [row.grnNo, row.itemLabel, row.poNo, row.vendor, row.statusLabel, row.qcStatus].some((field) =>
      field.toLowerCase().includes(term),
    ),
  );
}

export function sortQualityGrnQueueRows(
  rows: QualityGrnQueueRow[],
  sortKey: QualityGrnQueueSortKey,
  direction: 'asc' | 'desc',
): QualityGrnQueueRow[] {
  const sorted = [...rows].sort((a, b) =>
    a[sortKey].localeCompare(b[sortKey], undefined, { numeric: true }),
  );
  return direction === 'asc' ? sorted : sorted.reverse();
}
