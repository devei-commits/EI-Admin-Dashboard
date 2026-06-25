import { describe, expect, it } from 'vitest';
import {
  buildPlanningBatchFulfillmentView,
  buildPlanningBatchProductionView,
  buildPlanningBatchRmStatusView,
  computePlanningBatchPlannedQty,
} from '../planningBatchesTableDisplay';
import type { PlanningBatchAllRow } from '../../services/planningExtracted.service';
import type { SoPlanningBatchAvailabilityRow } from '../../services/fulfillment.service';
import type { BatchRow } from '../../services/production.service';

const baseRow: PlanningBatchAllRow = {
  id: 10,
  planningExtractedId: 5,
  sequence: 1,
  batchCode: 'B-2026-0420',
  sizeKg: 600,
  rmLines: [],
  pmLines: [],
  sent: true,
  orderQty: '3,000 pcs',
  totalKg: '600 kg',
  orderDate: '2026-06-14',
};

describe('planningBatchesTableDisplay', () => {
  it('computes planned qty units from batch size and order totals', () => {
    expect(computePlanningBatchPlannedQty(baseRow)).toBe(3000);
  });

  it('shows READY when batch RM availability is startable', () => {
    const avail: SoPlanningBatchAvailabilityRow = {
      sequence: 1,
      sent: true,
      rmNeededTotalKg: 100,
      rmRequestedTotalKg: 0,
      rmRemainingTotalKg: 0,
      pmNeededTotalUnits: 3000,
      pmRequestedTotalUnits: 0,
      pmRemainingTotalUnits: 0,
      rmStartable: true,
      pmStartable: true,
    };
    const view = buildPlanningBatchRmStatusView(avail);
    expect(view.label).toBe('READY');
  });

  it('maps production batch lifecycle label', () => {
    const prod = {
      bmrStatus: 'dispensing',
      bprStatus: 'draft',
      batchNo: 'BMR-001',
    } as BatchRow;
    const view = buildPlanningBatchProductionView(baseRow, prod);
    expect(view.label).toBe('Dispensing');
    expect(view.sub).toContain('BMR-001');
  });

  it('maps fulfillment ff status when linked', () => {
    const prod = { bprStatus: 'packaging' } as BatchRow;
    const view = buildPlanningBatchFulfillmentView(prod, 'shipped');
    expect(view.label).toBe('Shipped');
  });
});
