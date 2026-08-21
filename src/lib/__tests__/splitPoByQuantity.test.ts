/**
 * Split PO refused any order with a single line ("Need at least 2 items"), but a 50,000-unit line
 * is exactly what needs splitting into two deliveries. These cover splitting by quantity.
 */
import { describe, it, expect } from 'vitest';
import { splitLinesByQuantity, lineAtQty, lineQtyNumber, totalsForLines } from '../splitPoByQuantity';
import type { DraftPOLineItem } from '../../types/procurement.types';

const line = (over: Partial<DraftPOLineItem> = {}): DraftPOLineItem =>
  ({
    item: 'GLASS DROPPER BOTTLE 30 ML AMBER', itemCode: '4000005', type: 'PM',
    qty: '50000', pricePerUnit: 3, gstPercent: 18, gstAmount: 27000, lineTotal: 177000,
    ...over,
  } as DraftPOLineItem);

describe('lineQtyNumber', () => {
  it('reads the number out of a formatted qty', () => {
    expect(lineQtyNumber({ qty: '50,000' })).toBe(50000);
    expect(lineQtyNumber({ qty: '6 KG' })).toBe(6);
    expect(lineQtyNumber({ qty: '' })).toBe(0);
  });
});

describe('lineAtQty', () => {
  it('recomputes GST and total from the unit price', () => {
    const out = lineAtQty(line(), 30000);
    expect(out.qty).toBe('30000');
    expect(out.gstAmount).toBe(16200);   // 30000*3 = 90000, 18% = 16200
    expect(out.lineTotal).toBe(106200);
  });

  it('keeps material ids so PR↔PO matching still works after a split', () => {
    const out = lineAtQty(line({ pack_material_id: 42 }), 10);
    expect(out.pack_material_id).toBe(42);
  });
});

describe('splitLinesByQuantity', () => {
  it('splits a SINGLE line into two POs — the case that was refused outright', () => {
    const { s1, s2, error } = splitLinesByQuantity([line()], { 0: 30000 });
    expect(error).toBeNull();
    expect(s1).toHaveLength(1);
    expect(s2).toHaveLength(1);
    expect(s1[0].qty).toBe('30000');
    expect(s2[0].qty).toBe('20000');
  });

  it('makes the two halves add back up to the original', () => {
    const { s1, s2 } = splitLinesByQuantity([line()], { 0: 30000 });
    const a = totalsForLines(s1);
    const b = totalsForLines(s2);
    expect(a.grandTotal + b.grandTotal).toBe(177000);
    expect(a.gstTotal + b.gstTotal).toBe(27000);
  });

  it('still supports the whole-line split it always did', () => {
    const lines = [line({ item: 'A' }), line({ item: 'B' })];
    const { s1, s2, error } = splitLinesByQuantity(lines, { 0: 50000 });
    expect(error).toBeNull();
    expect(s1.map((l) => l.item)).toEqual(['A']);
    expect(s2.map((l) => l.item)).toEqual(['B']);
  });

  it('mixes a partial line with a whole line', () => {
    const lines = [line({ item: 'A' }), line({ item: 'B' })];
    const { s1, s2 } = splitLinesByQuantity(lines, { 0: 20000, 1: 50000 });
    expect(s1.map((l) => `${l.item}:${l.qty}`)).toEqual(['A:20000', 'B:50000']);
    expect(s2.map((l) => `${l.item}:${l.qty}`)).toEqual(['A:30000']);
  });

  it('refuses to move the entire order to one side', () => {
    expect(splitLinesByQuantity([line()], { 0: 50000 }).error).toMatch(/Split PO 2/);
    expect(splitLinesByQuantity([line()], { 0: 0 }).error).toMatch(/Split PO 1/);
  });

  it('rejects a quantity above what was ordered', () => {
    expect(splitLinesByQuantity([line()], { 0: 50001 }).error).toMatch(/exceeds/);
  });

  it('rejects a negative quantity', () => {
    expect(splitLinesByQuantity([line()], { 0: -1 }).error).toMatch(/negative/);
  });

  it('treats a missing or non-numeric entry as zero', () => {
    const { s1, s2 } = splitLinesByQuantity([line({ item: 'A' }), line({ item: 'B' })], { 0: 10000 });
    expect(s1.map((l) => l.item)).toEqual(['A']);
    expect(s2.map((l) => `${l.item}:${l.qty}`)).toEqual(['A:40000', 'B:50000']);
  });

  it('reports which original line each produced line came from', () => {
    const lines = [line({ item: 'A' }), line({ item: 'B' })];
    const out = splitLinesByQuantity(lines, { 0: 20000, 1: 50000 });
    // A is split across both sides, B goes wholly to S1.
    expect(out.s1SourceIndexes).toEqual([0, 1]);
    expect(out.s2SourceIndexes).toEqual([0]);
  });

  it('handles decimal quantities without drift', () => {
    const l = line({ qty: '6', pricePerUnit: 20, gstPercent: 18 });
    const { s1, s2 } = splitLinesByQuantity([l], { 0: 2.5 });
    expect(s1[0].qty).toBe('2.5');
    expect(s2[0].qty).toBe('3.5');
    expect(totalsForLines(s1).grandTotal + totalsForLines(s2).grandTotal).toBe(141.6);
  });
});
