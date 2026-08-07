import { isQtyShort, normalizeQtyForCompare } from '../utils/formatQty';

export interface ProductionReservedItemRow {
  id: number;
  productionBatchId: number;
  bmrNo: string | null;
  bprNo: string | null;
  soNo: string | null;
  productName: string | null;
  itemType: 'RM' | 'PM';
  code: string;
  name: string;
  quantityReserved: number;
  unit: string;
  updatedAt: string;
}

export interface BatchMaterialCoverageLine {
  code: string;
  materialId: number;
  required: number;
  /** Stock-backed: material physically in the facility and held for this batch. */
  reserved: number;
  /** Everything the batch has claimed, including quantity that has not arrived yet. */
  claimed?: number;
  /** claimed − reserved: queued against incoming stock, auto-allocated on GRN (FIFO). */
  pending?: number;
  unit: string;
  fullyReserved: boolean;
  /** Whole requirement is claimed, even if part of it is still awaiting arrival. */
  fullyClaimed?: boolean;
}

export interface BatchMaterialCoverage {
  lines: BatchMaterialCoverageLine[];
  fullyReserved: boolean;
  fullyClaimed?: boolean;
  anyReserved: boolean;
  anyPending?: boolean;
}

/** A line the batch has claimed but the facility cannot back yet. */
export function coverageLinePending(line: BatchMaterialCoverageLine): number {
  const pending = Number(line.pending);
  if (Number.isFinite(pending)) return Math.max(0, pending);
  const claimed = Number(line.claimed);
  if (!Number.isFinite(claimed)) return 0;
  return Math.max(0, claimed - (Number(line.reserved) || 0));
}

/** "3 awaiting stock" — short summary of what a batch is still waiting on. */
export function pendingSummaryLabel(coverage: BatchMaterialCoverage | null | undefined): string {
  if (!coverage || coverage.lines.length === 0) return '';
  const waiting = coverage.lines.filter((l) => coverageLinePending(l) > 0).length;
  return waiting > 0 ? `${waiting} awaiting stock` : '';
}

export function batchHasReservedMaterial(
  batch: { _pk?: number; rmReserved?: boolean; pmReserved?: boolean },
  reservedItems: ProductionReservedItemRow[],
  kind: 'RM' | 'PM',
): boolean {
  if (kind === 'RM' && batch.rmReserved) return true;
  if (kind === 'PM' && batch.pmReserved) return true;
  const pk = batch._pk;
  if (!pk) return false;
  return reservedItems.some(
    (r) =>
      r.productionBatchId === pk &&
      r.itemType === kind &&
      (Number(r.quantityReserved) || 0) > 0,
  );
}

export function batchLineFullyReserved(
  required: number,
  reserved: number,
  kind: 'kg' | 'pcs',
): boolean {
  const req = normalizeQtyForCompare(required, kind);
  const res = normalizeQtyForCompare(reserved, kind);
  return !isQtyShort(res, req, kind);
}

export function batchItemsFullyReserved(
  items: Array<{ code: string; required: number }>,
  reservedByCode: Record<string, number>,
  kind: 'kg' | 'pcs',
): boolean {
  if (items.length === 0) return false;
  return items.every((it) => {
    const code = String(it.code ?? '').trim();
    if (!code) return false;
    return batchLineFullyReserved(
      it.required,
      Number(reservedByCode[code] ?? 0) || 0,
      kind,
    );
  });
}

export function coverageSummaryLabel(coverage: BatchMaterialCoverage | null | undefined): string {
  if (!coverage || coverage.lines.length === 0) return 'No BOM lines';
  const done = coverage.lines.filter((l) => l.fullyReserved).length;
  const base = `${done}/${coverage.lines.length} lines reserved`;
  const waiting = pendingSummaryLabel(coverage);
  return waiting ? `${base} · ${waiting}` : base;
}
