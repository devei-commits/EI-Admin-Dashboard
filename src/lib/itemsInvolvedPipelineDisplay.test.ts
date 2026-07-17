import { describe, expect, it } from 'vitest';
import {
  getItemsInvolvedProcurementDisplay,
  computeItemsInvolvedGap,
} from './itemsInvolvedPipelineDisplay';

describe('computeItemsInvolvedGap (§6.3 shortage gap)', () => {
  const base = {
    sihFree: 0,
    scopedReserved: 0,
    planned: 0,
    po: 0,
    inTransit: 0,
    underGrn: 0,
    totalRequired: 100,
  };

  it('sums all six supply terms', () => {
    const g = computeItemsInvolvedGap({
      ...base,
      sihFree: 10,
      scopedReserved: 20,
      planned: 5,
      po: 5,
      inTransit: 5,
      underGrn: 5,
    });
    expect(g.supply).toBe(50);
    expect(g.net).toBe(-50);
    expect(g.shortQty).toBe(50);
    expect(g.coveragePct).toBe(50);
  });

  it('credits scoped reserved so a fully-reserved item is not short', () => {
    // Free stock 0 but 100 reserved for these batches → covered, no shortage.
    const withReserve = computeItemsInvolvedGap({ ...base, sihFree: 0, scopedReserved: 100 });
    expect(withReserve.shortQty).toBe(0);
    expect(withReserve.coveragePct).toBe(100);
    // Prior behaviour (ignoring reserved) would have flagged the full 100 as short.
    const withoutReserve = computeItemsInvolvedGap({ ...base, sihFree: 0, scopedReserved: 0 });
    expect(withoutReserve.shortQty).toBe(100);
  });

  it('reports positive net as over-planned (not flagged short)', () => {
    const g = computeItemsInvolvedGap({ ...base, sihFree: 120 });
    expect(g.net).toBe(20);
    expect(g.shortQty).toBe(0);
    expect(g.coveragePct).toBe(100);
  });

  it('handles zero demand as fully covered', () => {
    const g = computeItemsInvolvedGap({ ...base, totalRequired: 0 });
    expect(g.shortQty).toBe(0);
    expect(g.coveragePct).toBe(100);
  });

  it('ignores NaN supply terms', () => {
    const g = computeItemsInvolvedGap({ ...base, sihFree: Number.NaN, scopedReserved: 40 });
    expect(g.supply).toBe(40);
    expect(g.shortQty).toBe(60);
  });
});

describe('getItemsInvolvedProcurementDisplay', () => {
  const baseItem = {
    itemType: 'RM' as const,
    code: 'EI-RM-TEST',
    name: 'Test RM',
    raw_material_id: 1,
    planningExtractedIds: [10],
    planningExtractedId: 10,
    totalRequired: 100,
    netNum: -50,
    plannedQtyNum: 20,
    poQtyNum: 0,
    inTransitQtyNum: 0,
    whQtyNum: 0,
    sihNum: 30,
    totalReleasedNum: 20,
    unit: 'KG',
  };

  it('shows procurement queue when planned qty exists and still short', () => {
    const d = getItemsInvolvedProcurementDisplay(baseItem, [], []);
    expect(d.currentStatus.title).toContain('Procurement');
    expect(d.currentStatus.badge).toBe('PR / draft');
  });

  it('includes PR line in PO info', () => {
    const d = getItemsInvolvedProcurementDisplay(
      baseItem,
      [
        {
          id: '42',
          planningExtractedId: 10,
          planningBatchId: null,
          priority: 'High',
          requiredByDate: null,
          notes: 'Urgent for PE-10',
          items: [
            {
              type: 'RM',
              code: 'EI-RM-TEST',
              name: 'Test RM',
              required: 50,
              sih: 0,
              shortage: 50,
              quantity_requested: 50,
              unit: 'KG',
              raw_material_id: 1,
              line_notes: 'Vendor ABC MOQ 25kg',
            },
          ],
          status: 'Pending',
          requestedBy: null,
          stockCheckAssignedTo: null,
          stockCheckStatus: null,
          stockCheckDueDate: null,
          stockCheckNotes: null,
          createdAt: '2026-05-20T10:00:00Z',
          updatedAt: '2026-05-21T12:00:00Z',
          planningSoNumber: 'SO-100',
        },
      ],
      []
    );
    expect(d.poInfo.lines.some((l) => l.includes('PR #42'))).toBe(true);
    expect(d.latestComment?.text).toContain('Vendor ABC');
  });
});
