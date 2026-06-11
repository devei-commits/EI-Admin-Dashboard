export type StockCheckOutcome = 'all_ok' | 'not_ok';

export type ParsedStockCheckNoteLine = {
  itemCode?: string;
  itemName?: string;
  /** Warehouse system qty at audit time */
  systemQty?: number;
  /** System qty frozen when stock check was first opened (request received day). */
  systemQtyAtRequest?: number;
  physicalQty?: number;
  updatedStockQty?: number;
  /** Consumption in audit window (request received → warehouse update day). */
  consumptionQty?: number;
  consumptionFrom?: string;
  consumptionTo?: string;
  /** system − physical − consumption (stored or recomputed) */
  gapQty?: number;
  zone?: string;
  location?: string;
  rack?: string;
  batchNo?: string;
  remarks?: string;
  gapApproved?: boolean;
  gapApprovedAt?: string;
  gapApprovedBy?: string;
  gapAppliedQty?: number;
};

export type ParsedStockCheckNotes = {
  outcome?: StockCheckOutcome;
  lines?: ParsedStockCheckNoteLine[];
  requestedAt?: string;
  requestedBy?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export function parseStockCheckNotes(raw: string | null | undefined): ParsedStockCheckNotes | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as ParsedStockCheckNotes;
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function parseStockCheckOutcome(notes: string | null | undefined): StockCheckOutcome | null {
  return parseStockCheckNotes(notes)?.outcome ?? null;
}

export function parseStockCheckNotesLines(notes: string | null | undefined): ParsedStockCheckNoteLine[] {
  const parsed = parseStockCheckNotes(notes);
  return Array.isArray(parsed?.lines) ? parsed.lines : [];
}

export function hasStockCheckRequest(stockCheckStatus: string | null | undefined): boolean {
  return String(stockCheckStatus ?? '').trim().length > 0;
}

export function findStockCheckNoteForItem(
  notes: string | null | undefined,
  itemCode: string,
  itemName: string
): ParsedStockCheckNoteLine | null {
  const lines = parseStockCheckNotesLines(notes);
  const codeKey = itemCode.trim().toLowerCase();
  const nameKey = itemName.trim().toLowerCase();
  return (
    lines.find((ln) => {
      const c = String(ln.itemCode ?? '').trim().toLowerCase();
      const n = String(ln.itemName ?? '').trim().toLowerCase();
      if (codeKey && c && c === codeKey) return true;
      if (nameKey && n && n === nameKey) return true;
      return false;
    }) ?? null
  );
}
