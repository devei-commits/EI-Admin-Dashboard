/**
 * The SO dashboard is grouped by client, so column sorting has to sort within each group and then
 * order the groups — a flat sort would scatter a client's orders down the page.
 */
import { describe, it, expect } from 'vitest';
import { compareSoRows, soSortValue, sortGroupedSoRows } from '../soDashboardSort';
import type { SODashboardRow } from '../../types/orderFulfillment';

const row = (over: Partial<SODashboardRow>): SODashboardRow =>
  ({
    id: 1, soNo: 'SO-00001', soDate: null, dueDate: null, committedDate: null,
    priority: 'Normal', soStatus: 'Open', commercialStatus: 'draft', soValue: 0, unitPrice: 0,
    customer: { name: 'C', code: null, city: '', clientId: null },
    product: { name: 'P', code: 'PC', extraCount: 0 },
    totalOrderedQty: 0, fgReadyQty: 0, fgReadyPct: 0, packedQty: 0, packedPct: 0,
    invoicedQty: 0, invoicedPct: 0, shippedQty: 0, shippedPct: 0,
    stageStatus: [], batchPills: [], batchPillsTotal: 0,
    slaFlag: { overdue: false, daysOverdue: 0 }, commentCount: 0,
    ...over,
  } as SODashboardRow);

describe('soSortValue', () => {
  it('reads numbers numerically, not as text', () => {
    expect(soSortValue(row({ totalOrderedQty: 10000 }), 'orderQty')).toBe(10000);
    expect(soSortValue(row({ soValue: 180000 }), 'amount')).toBe(180000);
    expect(soSortValue(row({ unitPrice: 17.5 }), 'unitPrice')).toBe(17.5);
  });

  it('combines name and code for the product column', () => {
    expect(soSortValue(row({ product: { name: 'MOISTAR', code: 'PR001', extraCount: 0 } }), 'product'))
      .toBe('MOISTAR PR001');
  });

  it('ranks fulfillment by the furthest stage reached', () => {
    const shipped = soSortValue(row({ shippedPct: 50 }), 'fulfillment');
    const packed = soSortValue(row({ packedPct: 100 }), 'fulfillment');
    expect(shipped).toBeGreaterThan(packed);
  });

  it('prefers the authoritative order status over the legacy one', () => {
    expect(soSortValue(row({ orderStatus: 'Cancelled', soStatus: 'Open' } as never), 'status')).toBe('Cancelled');
  });
});

describe('compareSoRows', () => {
  it('sorts numerically both ways', () => {
    const a = row({ soNo: 'A', totalOrderedQty: 10 });
    const b = row({ soNo: 'B', totalOrderedQty: 1000 });
    expect(compareSoRows(a, b, 'orderQty', 'asc')).toBeLessThan(0);
    expect(compareSoRows(a, b, 'orderQty', 'desc')).toBeGreaterThan(0);
  });

  it('sorts SO numbers naturally — SO-00009 before SO-00110', () => {
    const a = row({ soNo: 'SO-00009' });
    const b = row({ soNo: 'SO-00110' });
    expect(compareSoRows(a, b, 'soNo', 'asc')).toBeLessThan(0);
  });

  it('puts undated rows last when sorting ascending by date', () => {
    const dated = row({ soNo: 'A', dueDate: '2026-05-12' });
    const undated = row({ soNo: 'B', dueDate: null });
    expect(compareSoRows(dated, undated, 'dueDate', 'asc')).toBeLessThan(0);
  });

  it('treats two undated rows as equal rather than NaN', () => {
    const a = row({ soNo: 'A', dueDate: null });
    const b = row({ soNo: 'B', dueDate: null });
    expect(compareSoRows(a, b, 'dueDate', 'asc')).toBeLessThan(0); // falls back to SO No
  });

  it('breaks ties by SO No so equal rows never shuffle', () => {
    const a = row({ soNo: 'SO-2', totalOrderedQty: 5 });
    const b = row({ soNo: 'SO-1', totalOrderedQty: 5 });
    expect(compareSoRows(a, b, 'orderQty', 'asc')).toBeGreaterThan(0);
    // Tiebreak is direction-independent — it must not invert with the sort arrow.
    expect(compareSoRows(a, b, 'orderQty', 'desc')).toBeGreaterThan(0);
  });
});

describe('sortGroupedSoRows', () => {
  it('sorts within each client and orders clients by their leading row', () => {
    const groups = [
      { rows: [row({ soNo: 'X1', totalOrderedQty: 900 }), row({ soNo: 'X2', totalOrderedQty: 100 })] },
      { rows: [row({ soNo: 'Y1', totalOrderedQty: 500 }), row({ soNo: 'Y2', totalOrderedQty: 50 })] },
    ];
    const out = sortGroupedSoRows(groups, 'orderQty', 'asc');
    expect(out[0].rows.map((r) => r.soNo)).toEqual(['Y2', 'Y1']);   // 50 leads
    expect(out[1].rows.map((r) => r.soNo)).toEqual(['X2', 'X1']);   // 100 leads
  });

  it('keeps every client group intact — rows never move between clients', () => {
    const groups = [
      { rows: [row({ soNo: 'A', totalOrderedQty: 1 })] },
      { rows: [row({ soNo: 'B', totalOrderedQty: 2 })] },
    ];
    const out = sortGroupedSoRows(groups, 'orderQty', 'desc');
    expect(out).toHaveLength(2);
    expect(out.flatMap((g) => g.rows)).toHaveLength(2);
  });

  it('handles an empty group without throwing', () => {
    expect(() => sortGroupedSoRows([{ rows: [] }], 'soNo', 'asc')).not.toThrow();
  });
});

/* ── Products & Batches tab ─────────────────────────────────────────────── */
import { compareBatchRows, batchSortValue, sortGroupedBatchRows } from '../soDashboardSort';
import type { BatchDashboardRow } from '../../types/orderFulfillment';

const brow = (over: Partial<BatchDashboardRow>): BatchDashboardRow =>
  ({
    id: 1, soId: 1, soNo: 'SO-00001', soDate: null, dueDate: null, priority: 'Normal',
    soStatus: 'Open', commercialStatus: 'draft',
    client: { name: 'ACME', code: null, city: '', id: null },
    product: { name: 'P', code: 'PC', pack: '', orderedQty: 0, unitPrice: 0 },
    batch: { batchNo: 'B-01', bprNo: '', bmrNo: '', plannedQty: 0, coveragePct: 0, stage: 'fg', stageLabel: 'FG Ready', fgLocation: null },
    ffStatus: '', fgQty: 0, pickedQty: 0, packedQty: 0, invoicedQty: 0, shippedQty: 0,
    slaFlag: { overdue: false, approaching: false, daysOverdue: 0 },
    ...over,
  } as BatchDashboardRow);

describe('batches tab sorting', () => {
  it('sorts quantities numerically', () => {
    expect(batchSortValue(brow({ shippedQty: 2500 }), 'shipped')).toBe(2500);
    expect(batchSortValue(brow({ product: { name: 'P', code: 'C', pack: '', orderedQty: 10000, unitPrice: 0 } }), 'orderQty')).toBe(10000);
  });

  it('sorts batch numbers naturally — B-2 before B-10', () => {
    const a = brow({ batch: { ...brow({}).batch, batchNo: 'B-2' } });
    const b = brow({ batch: { ...brow({}).batch, batchNo: 'B-10' } });
    expect(compareBatchRows(a, b, 'batchNo', 'asc')).toBeLessThan(0);
  });

  it('uses the readable stage label for batch status', () => {
    expect(batchSortValue(brow({}), 'batchStatus')).toBe('FG Ready');
  });

  it('puts undated rows last ascending', () => {
    const dated = brow({ soNo: 'A', dueDate: '2026-05-12' });
    const undated = brow({ soNo: 'B', dueDate: null });
    expect(compareBatchRows(dated, undated, 'dueDate', 'asc')).toBeLessThan(0);
  });

  it('keeps a product line together and orders lines by their leading batch', () => {
    const groups = [
      { representative: brow({ soNo: 'X' }), batches: [brow({ soNo: 'X', batch: { ...brow({}).batch, batchNo: 'B-2' }, shippedQty: 900 }), brow({ soNo: 'X', batch: { ...brow({}).batch, batchNo: 'B-1' }, shippedQty: 100 })] },
      { representative: brow({ soNo: 'Y' }), batches: [brow({ soNo: 'Y', batch: { ...brow({}).batch, batchNo: 'B-9' }, shippedQty: 50 })] },
    ];
    const out = sortGroupedBatchRows(groups, 'shipped', 'asc');
    expect(out[0].batches[0].shippedQty).toBe(50);   // Y leads
    expect(out[1].batches.map((r) => r.shippedQty)).toEqual([100, 900]);
  });

  it('tiebreaks direction-independently so equal rows never shuffle', () => {
    const a = brow({ soNo: 'SO-2', shippedQty: 5 });
    const b = brow({ soNo: 'SO-1', shippedQty: 5 });
    expect(compareBatchRows(a, b, 'shipped', 'asc')).toBeGreaterThan(0);
    expect(compareBatchRows(a, b, 'shipped', 'desc')).toBeGreaterThan(0);
  });
});
