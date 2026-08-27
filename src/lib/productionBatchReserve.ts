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

/**
 * Has every line been claimed for this batch — whether or not the stock has arrived?
 *
 * `fullyReserved` is stock-backed only, so a batch whose material is on order reads as "not
 * reserved" even though the reservation exists and the warehouse will allocate to it on receipt.
 * Falls back to a per-line check for older payloads that predate the `fullyClaimed` flag.
 */
export function coverageFullyClaimed(coverage: BatchMaterialCoverage | null | undefined): boolean {
  if (!coverage || coverage.lines.length === 0) return false;
  if (typeof coverage.fullyClaimed === 'boolean') return coverage.fullyClaimed;
  return coverage.lines.every((l) =>
    typeof l.fullyClaimed === 'boolean'
      ? l.fullyClaimed
      : (Number(l.claimed) || 0) >= (Number(l.required) || 0),
  );
}

/**
 * What Production should say about reserving — three states, not two.
 *
 * Reserving in Planning's batch popup writes the same `reserved_batch_items` rows Production reads
 * (once the batch is sent, Planning delegates straight to the production batch), so a batch can
 * arrive here already claimed. Treating anything short of stock-backed as "unreserved" made
 * Production demand a second reserve for work Planning had already done, and clicking it again
 * changes nothing — the claim is recorded and the shortfall is waiting on a GRN, not on a click.
 *
 *   'reserved'       — every line stock-backed; free to proceed.
 *   'awaiting-stock' — every line claimed, some not yet arrived. Do NOT ask to reserve again.
 *   'unreserved'     — lines with no claim at all; reserving is the right next action.
 */
export type ReserveGateState = 'reserved' | 'awaiting-stock' | 'unreserved';

export function reserveGateState(
  coverage: BatchMaterialCoverage | null | undefined,
): ReserveGateState {
  // No coverage, or none loaded yet, is NOT "ready" — `every()` over an empty line list is
  // vacuously true, and reporting that as reserved would both claim all-green for a batch with no
  // BOM lines and hide the Reserve button while the coverage request is still in flight.
  if (!coverage || coverage.lines.length === 0) return 'unreserved';
  if (coverage.fullyReserved) return 'reserved';
  if (coverageFullyClaimed(coverage)) return 'awaiting-stock';
  return 'unreserved';
}

/**
 * Gate message for a kind ('RM' / 'PM'). Only the `unreserved` state asks for a reserve; the
 * awaiting-stock state reports the claim and what it is waiting on.
 */
export function reserveGateLabel(
  coverage: BatchMaterialCoverage | null | undefined,
  kind: 'RM' | 'PM',
): string {
  switch (reserveGateState(coverage)) {
    case 'reserved':
      return `${coverageSummaryLabel(coverage)} · all green to proceed`;
    case 'awaiting-stock': {
      const waiting = pendingSummaryLabel(coverage);
      const detail = waiting ? ` · ${waiting}` : '';
      return `All ${kind} reserved${detail} — allocated automatically on receipt`;
    }
    default:
      return `Reserve all ${kind} to proceed`;
  }
}

export function coverageSummaryLabel(coverage: BatchMaterialCoverage | null | undefined): string {
  if (!coverage || coverage.lines.length === 0) return 'No BOM lines';
  const done = coverage.lines.filter((l) => l.fullyReserved).length;
  const base = `${done}/${coverage.lines.length} lines reserved`;
  const waiting = pendingSummaryLabel(coverage);
  return waiting ? `${base} · ${waiting}` : base;
}
