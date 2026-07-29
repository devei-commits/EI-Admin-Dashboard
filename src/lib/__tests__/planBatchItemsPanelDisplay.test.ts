import { describe, expect, it } from 'vitest';
import {
  buildBatchItemsPanelRows,
  computeBatchItemsPanelStatus,
  type BatchItemsPanelInvolvedRow,
} from '../planBatchItemsPanelDisplay';
import type { PlanningBatchAllRow } from '../../services/planningExtracted.service';

const involvedRows: BatchItemsPanelInvolvedRow[] = [
  {
    itemType: 'RM',
    code: '1000098',
    raw_material_id: 98,
    totalRequired: 615,
    sihNum: 400,
    reservedNum: 120,
    plannedQtyNum: 200,
    poQtyNum: 300,
    inTransitQtyNum: 100,
  },
  {
    itemType: 'RM',
    code: '1000123',
    raw_material_id: 123,
    totalRequired: 75,
    sihNum: 15,
    reservedNum: 0,
    plannedQtyNum: 0,
    poQtyNum: 0,
    inTransitQtyNum: 0,
  },
  {
    itemType: 'RM',
    code: '1000045',
    raw_material_id: 45,
    totalRequired: 280,
    sihNum: 150,
    reservedNum: 40,
    plannedQtyNum: 100,
    poQtyNum: 0,
    inTransitQtyNum: 0,
  },
];

const batch: PlanningBatchAllRow = {
  id: 1,
  planningExtractedId: 5,
  sequence: 1,
  batchCode: 'PE-5-B01',
  sizeKg: 1000,
  orderQty: '1000',
  totalKg: '1000',
  rmLines: [
    { rm_code: '1000098', inci_name: 'SLES 70%', pct_w_w: 8.5, uom: 'KG' },
    { rm_code: '1000123', inci_name: 'CAPB', pct_w_w: 2.5, uom: 'KG' },
    { rm_code: '1000045', inci_name: 'Glycerin', pct_w_w: 3.5, uom: 'KG' },
  ],
  pmLines: [],
};

describe('computeBatchItemsPanelStatus (real stock + procurement; batch-allocation plannedQty ignored)', () => {
  it('marks AVAILABLE when reserved + free stock + procurement covers the requirement', () => {
    // reserved (last arg) 85 ≥ req 85 → covered
    expect(computeBatchItemsPanelStatus(85, 0, 0, 0, 0, 0, 85)).toBe('AVAILABLE');
    // reserved 30 + PO 10 = 40 ≥ req 35 → covered
    expect(computeBatchItemsPanelStatus(35, 0, 0, 10, 0, 0, 30)).toBe('AVAILABLE');
    // free stock 280 ≥ req 85 → covered (free counts toward availability)
    expect(computeBatchItemsPanelStatus(85, 280, 0, 0, 0, 0, 0)).toBe('AVAILABLE');
  });

  it('IGNORES batch-allocation plannedQty (demand ≠ supply): SIH-0 with only plannedQty is SHORTAGE', () => {
    // plannedQty 200 but no real stock/procurement → SHORTAGE (previously wrongly AVAILABLE/UNDER PROCUREMENT)
    expect(computeBatchItemsPanelStatus(500, 0, 200, 0, 0, 0, 0)).toBe('SHORTAGE');
    // reserved 40 but short of req 100, nothing incoming → SHORTAGE
    expect(computeBatchItemsPanelStatus(100, 0, 0, 0, 0, 0, 40)).toBe('SHORTAGE');
    // no stock, no pipeline → SHORTAGE
    expect(computeBatchItemsPanelStatus(25, 15, 0, 0, 0, 0, 0)).toBe('SHORTAGE');
  });

  it('marks UNDER PROCUREMENT when a real procurement pipeline exists but is still short', () => {
    expect(computeBatchItemsPanelStatus(500, 0, 0, 0, 100, 50, 0)).toBe('UNDER PROCUREMENT');
    expect(computeBatchItemsPanelStatus(500, 0, 0, 120, 0, 0, 0)).toBe('UNDER PROCUREMENT');
  });
});

describe('buildBatchItemsPanelRows', () => {
  it('builds panel rows matching RM/PM popup spec', () => {
    const rows = buildBatchItemsPanelRows({
      batch,
      warehouseRows: [],
      rawMaterials: [
        { id: '98', code: '1000098', name: 'SLES 70%', uom: 'KG' },
        { id: '123', code: '1000123', name: 'CAPB', uom: 'KG' },
        { id: '45', code: '1000045', name: 'Glycerin', uom: 'KG' },
      ] as import('../../services/rawMaterials.service').RawMaterialRecord[],
      packMaterials: [],
      itemsInvolved: involvedRows,
      materialFilter: 'RM',
    });

    expect(rows).toHaveLength(3);

    const sles = rows.find((r) => r.itemCode === '1000098');
    expect(sles?.reqQty).toBe(85);
    expect(sles?.sih).toBe(400);
    expect(sles?.totalRequired).toBe(615);
    expect(sles?.reserved).toBe(120);
    expect(sles?.plannedQty).toBe(200);
    expect(sles?.poQty).toBe(300);
    expect(sles?.inTransit).toBe(100);
    expect(sles?.status).toBe('AVAILABLE');

    const capb = rows.find((r) => r.itemCode === '1000123');
    expect(capb?.reqQty).toBe(25);
    expect(capb?.status).toBe('SHORTAGE');

    const glycerin = rows.find((r) => r.itemCode === '1000045');
    expect(glycerin?.reqQty).toBe(35);
    expect(glycerin?.status).toBe('AVAILABLE');
  });
});
