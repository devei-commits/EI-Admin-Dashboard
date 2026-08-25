/**
 * The panel had two useful labels — AVAILABLE and SHORTAGE — so a row with 0 stock and 380 units
 * merely ORDERED read identically to one sitting on the shelf. The status now names the nearest
 * stage at which the requirement is actually covered.
 */
import { describe, it, expect } from 'vitest';
import { computeBatchItemsPanelStatus as status } from '../planBatchItemsPanelDisplay';

// (reqQty, free, plannedQty, poQty, inTransit, underGrn, reserved)
const s = (req: number, free: number, planned: number, po: number, transit: number, grn: number, reserved = 0) =>
  status(req, free, planned, po, transit, grn, reserved);

describe('coverage-stage status', () => {
  it('IN STOCK when free stock covers it', () => {
    expect(s(40, 40, 0, 0, 0, 0)).toBe('IN STOCK');
    expect(s(40, 0, 0, 0, 0, 0, 40)).toBe('IN STOCK'); // reserved for this batch counts as in hand
  });

  it('UNDER GRN when only received-but-unchecked stock closes the gap', () => {
    expect(s(40, 0, 0, 0, 0, 40)).toBe('UNDER GRN');
  });

  it('IN TRANSIT when shipped goods close the gap', () => {
    expect(s(40, 0, 0, 0, 40, 0)).toBe('IN TRANSIT');
  });

  it('UNDER PO when only an unshipped order covers it — previously mislabelled AVAILABLE', () => {
    // 1000552: req 40, SIH 0, PO 380.
    expect(s(40, 0, 0, 380, 0, 0)).toBe('UNDER PO');
  });

  it('prefers the nearest stage when several could cover', () => {
    expect(s(10, 10, 0, 500, 500, 500)).toBe('IN STOCK');
    expect(s(10, 0, 0, 500, 500, 10)).toBe('UNDER GRN');
    expect(s(10, 0, 0, 500, 10, 0)).toBe('IN TRANSIT');
  });

  it('ignores batch-allocation plannedQty — it is demand, not supply', () => {
    // 1001464 ALLIOS: req 40, planned 40, nothing real incoming. plannedQty is the qty allocated to
    // THIS batch, so counting it would let a SIH-0 row report itself as covered.
    expect(s(40, 0, 40, 0, 0, 0)).toBe('SHORTAGE');
  });

  it('UNDER PROCUREMENT when partial procurement exists but falls short', () => {
    expect(s(100, 0, 0, 30, 0, 0)).toBe('UNDER PROCUREMENT');
  });

  it('SHORTAGE only when nothing at all is happening', () => {
    // 1001473 TERIC: req 5, everything zero.
    expect(s(5, 0, 0, 0, 0, 0)).toBe('SHORTAGE');
  });

  it('treats a zero requirement as covered', () => {
    expect(s(0, 0, 0, 0, 0, 0)).toBe('IN STOCK');
  });

  it('ignores negative inputs rather than letting them subtract coverage', () => {
    expect(s(40, -10, 0, -5, 0, 0)).toBe('SHORTAGE');
    expect(s(40, 40, 0, -5, 0, 0)).toBe('IN STOCK');
  });

  it('combines stages when no single one is enough', () => {
    expect(s(100, 30, 0, 0, 30, 40)).toBe('IN TRANSIT'); // 30 + 40 grn + 30 transit = 100
  });
});
