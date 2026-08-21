/**
 * Splitting a PO by QUANTITY, not just by which lines go where.
 *
 * The original split moved whole line items between two POs, so it needed at least two lines. A
 * single-line PO ("50,000 dropper bottles") could not be split at all — yet splitting one item into
 * two deliveries is the common case. This computes the two sides for any line, whole or partial.
 *
 * Money is recomputed from qty x unit price rather than pro-rated from the parent's totals, so the
 * two halves always add up to the original and never drift by a rounding step.
 */
import type { DraftPOLineItem } from '../types/procurement.types';

/** Numeric qty behind a line's display string ("50,000" / "6 KG" -> 50000 / 6). */
export function lineQtyNumber(line: Pick<DraftPOLineItem, 'qty'>): number {
  const n = parseFloat(String(line?.qty ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Rebuild a line at `qty`, recomputing GST and total from the unit price. */
export function lineAtQty(line: DraftPOLineItem, qty: number): DraftPOLineItem {
  const unit = Number(line.pricePerUnit) || 0;
  const gstPct = Number(line.gstPercent) || 0;
  const subtotal = round2(qty * unit);
  const gstAmount = round2((subtotal * gstPct) / 100);
  return {
    ...line,
    // Keep the plain number form; the display layer formats it.
    qty: String(qty),
    gstAmount,
    lineTotal: round2(subtotal + gstAmount),
  };
}

export type SplitQtyByIndex = Record<number, number>;

export type SplitSides = {
  s1: DraftPOLineItem[];
  s2: DraftPOLineItem[];
  /**
   * Index in the ORIGINAL line list that each produced line came from. A partially split line
   * appears on both sides, so downstream PR↔PO matching cannot infer the source from position —
   * it maps through these instead.
   */
  s1SourceIndexes: number[];
  s2SourceIndexes: number[];
  /** Human-readable reason the plan is not valid, or null when it is. */
  error: string | null;
};

/**
 * Split `lines` into two POs given the quantity of each line assigned to S1.
 *
 * A line absent from `qtyForS1` (or set to 0) goes entirely to S2; a line set to its full quantity
 * goes entirely to S1. Anything between splits the line across both.
 */
export function splitLinesByQuantity(
  lines: DraftPOLineItem[],
  qtyForS1: SplitQtyByIndex,
): SplitSides {
  const s1: DraftPOLineItem[] = [];
  const s2: DraftPOLineItem[] = [];
  const s1SourceIndexes: number[] = [];
  const s2SourceIndexes: number[] = [];
  const all = Array.isArray(lines) ? lines : [];
  const fail = (error: string): SplitSides => ({ s1: [], s2: [], s1SourceIndexes: [], s2SourceIndexes: [], error });

  for (let i = 0; i < all.length; i += 1) {
    const line = all[i];
    const total = lineQtyNumber(line);
    const raw = Number(qtyForS1[i]);
    const want = Number.isFinite(raw) ? raw : 0;

    if (want < 0) return fail(`${line.item}: quantity cannot be negative.`);
    if (want > total) return fail(`${line.item}: split quantity exceeds the ordered ${total}.`);
    if (want > 0) { s1.push(lineAtQty(line, want)); s1SourceIndexes.push(i); }
    const rest = round2(total - want);
    if (rest > 0) { s2.push(lineAtQty(line, rest)); s2SourceIndexes.push(i); }
  }

  if (s1.length === 0) {
    return { s1, s2, s1SourceIndexes, s2SourceIndexes, error: 'Assign some quantity to Split PO 1.' };
  }
  if (s2.length === 0) {
    return {
      s1, s2, s1SourceIndexes, s2SourceIndexes,
      error: 'Leave some quantity for Split PO 2 — the whole order cannot move to one PO.',
    };
  }
  return { s1, s2, s1SourceIndexes, s2SourceIndexes, error: null };
}

/** Totals for a set of lines, matching how the draft PO stores them. */
export function totalsForLines(lines: DraftPOLineItem[]): {
  subtotal: number; gstTotal: number; grandTotal: number;
} {
  const subtotal = round2((lines ?? []).reduce((s, l) => s + (Number(l.lineTotal) - Number(l.gstAmount)), 0));
  const gstTotal = round2((lines ?? []).reduce((s, l) => s + Number(l.gstAmount), 0));
  return { subtotal, gstTotal, grandTotal: round2(subtotal + gstTotal) };
}
