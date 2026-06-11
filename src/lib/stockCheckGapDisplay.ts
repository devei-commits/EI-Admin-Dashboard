import { computeInventoryAuditGap } from './inventoryAuditGap';
import {
  findStockCheckNoteForItem,
  type ParsedStockCheckNoteLine,
} from './stockCheckNotes';

export type StockCheckGapInfo = {
  gapQty: number;
  gapApproved: boolean;
  physicalQty: number | null;
  systemQty: number | null;
  consumptionQty: number | null;
  canApprove: boolean;
};

function parseQty(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function enrichGapFromNote(
  note: ParsedStockCheckNoteLine | null,
  stockCheckStatus: string
): StockCheckGapInfo | null {
  if (!note) return null;
  const systemQty = parseQty(note.systemQtyAtRequest ?? note.systemQty);
  const physicalQty = parseQty(note.physicalQty);
  const consumptionQty = parseQty(note.consumptionQty ?? 0) ?? 0;
  const gapQty =
    note.gapQty != null && Number.isFinite(Number(note.gapQty))
      ? Number(note.gapQty)
      : computeInventoryAuditGap(systemQty ?? 0, physicalQty ?? 0, consumptionQty);
  const gapApproved = note.gapApproved === true;
  const completed = String(stockCheckStatus ?? '').trim().toLowerCase() === 'completed';
  return {
    gapQty,
    gapApproved,
    physicalQty,
    systemQty,
    consumptionQty,
    canApprove: completed && gapQty > 1e-6 && !gapApproved,
  };
}

/** Gap from completed stock check for a procurement request item line. */
export function getStockCheckGapForItem(
  stockCheckStatus: string | null | undefined,
  stockCheckNotes: string | null | undefined,
  itemCode: string,
  itemName: string
): StockCheckGapInfo | null {
  if (String(stockCheckStatus ?? '').trim().toLowerCase() !== 'completed') return null;
  const note = findStockCheckNoteForItem(stockCheckNotes, itemCode, itemName);
  const info = enrichGapFromNote(note, String(stockCheckStatus ?? ''));
  if (!info) return null;
  if (Math.abs(info.gapQty) < 1e-6 && !info.gapApproved) return null;
  return info;
}

/** Inventory qty to apply when procurement approves a stock-check gap (physical count). */
export function resolveInventoryStockAfterGapApproval(
  note: ParsedStockCheckNoteLine | null | undefined
): number | null {
  if (!note) return null;
  const updated = parseQty(note.updatedStockQty);
  if (updated != null) return updated;
  const physical = parseQty(note.physicalQty);
  if (physical != null) return physical;
  return null;
}
