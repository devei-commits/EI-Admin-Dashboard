/**
 * Per-line GRN / warehouse status for Issued PO item split view.
 */

import type { GRNRecordFromApi } from '@/services/grn.service';
import type { DraftPOLineItem } from '@/types/procurement.types';

export type IssuedPoLineGrnStatus = 'none' | 'under_grn' | 'complete';

export function normPoNumberKey(n: string): string {
  return String(n ?? '').trim().replace(/^PO-?/i, '').replace(/^DPO-?/i, '');
}

export function normItemCodeKey(code: string | undefined | null): string {
  return String(code ?? '').trim().toUpperCase();
}

/** GRN rows linked to a PO number (normalized match). */
export function grnsForPoNumber(grnList: GRNRecordFromApi[] | undefined, poNumber: string): GRNRecordFromApi[] {
  const key = normPoNumberKey(poNumber);
  if (!key) return [];
  return (grnList ?? []).filter((g) => normPoNumberKey(g.poNo ?? '') === key);
}

/** Warehouse stage for a single PO line from its GRN row, if any. */
export function lineGrnStatus(
  grnList: GRNRecordFromApi[] | undefined,
  poNumber: string,
  itemCode: string | undefined,
): IssuedPoLineGrnStatus {
  const codeKey = normItemCodeKey(itemCode);
  if (!codeKey) return 'none';
  const poGrns = grnsForPoNumber(grnList, poNumber);
  for (const grn of poGrns) {
    const lines = Array.isArray(grn.lineItems) ? grn.lineItems : [];
    const hit = lines.some((li) => normItemCodeKey(li.itemCode) === codeKey);
    if (!hit) continue;
    if (String(grn.status ?? '').trim() === 'GRN Complete') return 'complete';
    return 'under_grn';
  }
  return 'none';
}

export type IssuedPoGrnProgress = {
  totalLines: number;
  underGrnCount: number;
  completeCount: number;
  pendingCount: number;
};

/** Count how many PO lines are pending / under GRN / complete. */
export function poGrnProgress(
  grnList: GRNRecordFromApi[] | undefined,
  poNumber: string,
  lineItems: DraftPOLineItem[],
): IssuedPoGrnProgress {
  const lines = lineItems.length > 0 ? lineItems : [];
  let underGrnCount = 0;
  let completeCount = 0;
  for (const line of lines) {
    const st = lineGrnStatus(grnList, poNumber, line.itemCode);
    if (st === 'complete') completeCount += 1;
    else if (st === 'under_grn') underGrnCount += 1;
  }
  const totalLines = lines.length;
  const pendingCount = Math.max(0, totalLines - underGrnCount - completeCount);
  return { totalLines, underGrnCount, completeCount, pendingCount };
}

/** True when every line on the PO already has a GRN row (any status). */
export function allPoLinesHaveGrn(
  grnList: GRNRecordFromApi[] | undefined,
  poNumber: string,
  lineItems: DraftPOLineItem[],
): boolean {
  const lines = lineItems.length > 0 ? lineItems : [];
  if (lines.length === 0) return false;
  return lines.every((line) => lineGrnStatus(grnList, poNumber, line.itemCode) !== 'none');
}

/** True when every line has GRN Complete. */
export function allPoLinesGrnComplete(
  grnList: GRNRecordFromApi[] | undefined,
  poNumber: string,
  lineItems: DraftPOLineItem[],
): boolean {
  const lines = lineItems.length > 0 ? lineItems : [];
  if (lines.length === 0) return false;
  return lines.every((line) => lineGrnStatus(grnList, poNumber, line.itemCode) === 'complete');
}

/**
 * Item-level pipeline index (0–6) combining PO tracking with per-line GRN state.
 * Pre-delivery stages follow PO tracking; delivery+ follow line GRN when available.
 */
export function issuedPoLineTimelineCompletedIndex(
  poCompletedIdx: number,
  lineGrn: IssuedPoLineGrnStatus,
): number {
  if (lineGrn === 'complete') return 6;
  if (lineGrn === 'under_grn') return Math.max(poCompletedIdx, 5);
  if (lineGrn === 'none' && poCompletedIdx >= 5) return poCompletedIdx;
  return poCompletedIdx;
}
