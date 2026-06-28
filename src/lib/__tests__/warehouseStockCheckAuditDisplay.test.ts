import { describe, expect, it } from 'vitest';
import {
  buildAuditProgressSteps,
  buildAuditResultSummary,
  buildPackBreakdown,
  buildRackLabel,
  buildRackSystemRows,
  formatRackVariance,
  mergeRackAuditDrafts,
  resolveWarehouseDisplayName,
} from '../warehouseStockCheckAuditDisplay';

describe('warehouseStockCheckAuditDisplay', () => {
  it('builds rack label with warehouse prefix', () => {
    expect(buildRackLabel('MW', 'A12-B3')).toBe('MW · Rack-A12-B3');
  });

  it('builds pack breakdown from qty and unit', () => {
    expect(buildPackBreakdown(12, 'kg')).toBe('1 lot × 12 kg');
  });

  it('formats rack variance', () => {
    expect(formatRackVariance(3, 6)).toBe('+3');
    expect(formatRackVariance(12, 12)).toBe('0');
  });

  it('builds rack system rows from stock-by-location', () => {
    const rows = buildRackSystemRows(
      {
        warehouseInventoryId: 1,
        whStock: 15,
        whUnit: 'kg',
        stockInHand: 15,
        warehouse: [
          {
            locationId: 1,
            locationCode: 'A12',
            locationName: 'Zone A',
            locationType: 'WH',
            isDefault: false,
            totalQtyWh: 15,
            racks: [
              { rackId: 10, rackCode: 'B3', qtyWh: 12 },
              { rackId: 11, rackCode: 'C1', qtyWh: 3 },
            ],
          },
        ],
        manufacturing: [],
        unallocatedWh: 0,
      },
      'MW',
      'kg',
      'GB-2026-0022',
      [],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.systemQty).toBe(12);
    expect(rows[1]?.systemQty).toBe(3);
    expect(rows[0]?.grnBatch).toBe('GB-2026-0022');
  });

  it('merges saved rack audits into drafts', () => {
    const systemRows = buildRackSystemRows(
      {
        warehouseInventoryId: 1,
        whStock: 3,
        whUnit: 'kg',
        stockInHand: 3,
        warehouse: [
          {
            locationId: 1,
            locationCode: 'A12',
            locationName: 'Zone A',
            locationType: 'WH',
            isDefault: false,
            totalQtyWh: 3,
            racks: [{ rackId: 11, rackCode: 'C1', qtyWh: 3 }],
          },
        ],
        manufacturing: [],
        unallocatedWh: 0,
      },
      'MW',
      'kg',
      null,
      [],
    );
    const merged = mergeRackAuditDrafts(systemRows, {
      itemCode: '1000123',
      rackAudits: [
        {
          rackLabel: 'MW · Rack-A12-C1',
          systemQty: 3,
          physicalQty: 6,
          notes: 'Found 2 extra small drums',
        },
      ],
    });
    expect(merged[0]?.auditedQty).toBe(6);
    expect(merged[0]?.notes).toContain('extra small drums');
  });

  it('builds audit progress steps', () => {
    const steps = buildAuditProgressSteps({
      requestedAt: '2026-06-23T10:00:00.000Z',
      assignee: 'Ravi Kumar',
      initiatedAt: '2026-06-26T10:30:00.000Z',
      completedAt: null,
      isCompleted: false,
    });
    expect(steps[0]?.status).toBe('done');
    expect(steps[1]?.label).toBe('AUDIT INITIATED');
    expect(steps[2]?.detail).toBe('— pending');
  });

  it('builds audit result summary', () => {
    expect(buildAuditResultSummary(15, 18, 'kg')).toContain('Net variance +3 kg');
  });

  it('resolves warehouse display name', () => {
    expect(resolveWarehouseDisplayName('MW')).toBe('Main Warehouse');
    expect(resolveWarehouseDisplayName('SW')).toBe('Secondary Warehouse');
  });
});
