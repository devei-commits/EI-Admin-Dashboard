import { describe, expect, it } from 'vitest';
import { getItemsInvolvedProcurementDisplay } from './itemsInvolvedPipelineDisplay';

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
