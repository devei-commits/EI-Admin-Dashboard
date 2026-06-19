import { describe, expect, it } from 'vitest';
import {
  buildWeekVendorConsolidationLines,
  buildWeekVendorItemBuckets,
  groupWeekVendorConsolidationLines,
} from './weekVendorConsolidation';
import type { ProcurementRequest } from '../types/procurement.types';

function pr(overrides: Partial<ProcurementRequest> & { id: string; code: string }): ProcurementRequest {
  return {
    type: 'RM',
    priority: 'High',
    status: 'New',
    items: ['DISODIUM EDTA'],
    dueDate: '2026-06-10',
    preferredVendor: 'Adobe Systems',
    itemDetails: [
      {
        itemCode: '1000153',
        itemName: 'DISODIUM EDTA',
        reqQty: 5,
        unit: 'KG',
        moq: '1 kg',
        packSize: '',
        plannedPrice: 12,
        expectedDate: '2026-06-10',
        estValue: 60,
        type: 'RM',
      },
    ],
    ...overrides,
  };
}

describe('weekVendorConsolidation', () => {
  it('builds item buckets with summed qty in same vendor-week', () => {
    const requests: ProcurementRequest[] = [
      pr({ id: '1', code: 'PR-046' }),
      pr({
        id: '2',
        code: 'PR-047',
        itemDetails: [
          {
            itemCode: '1000153',
            itemName: 'DISODIUM EDTA',
            reqQty: 6,
            unit: 'KG',
            moq: '1 kg',
            packSize: '',
            plannedPrice: 12,
            expectedDate: '2026-06-12',
            estValue: 72,
            type: 'RM',
          },
        ],
      }),
    ];
    const lines = buildWeekVendorConsolidationLines(requests);
    const groups = groupWeekVendorConsolidationLines(lines);
    expect(groups.length).toBeGreaterThanOrEqual(1);
    const buckets = buildWeekVendorItemBuckets(groups[0]!);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.totalReqQty).toBe(11);
    expect(buckets[0]?.sourceLines).toHaveLength(2);
  });
});
