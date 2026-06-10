import { describe, expect, it } from 'vitest';
import { buildInventoryAuditLines } from './inventoryAuditLines';
import type { ProcurementRequest } from '../types/procurement.types';

function mkRequest(overrides: Partial<ProcurementRequest>): ProcurementRequest {
  return {
    id: '1',
    code: 'PR-REQ-001',
    type: 'RM',
    priority: 'High',
    status: 'New',
    items: [],
    dueDate: '2026-06-01',
    ...overrides,
  };
}

describe('buildInventoryAuditLines', () => {
  it('returns item lines only for requests with stock check status', () => {
    const lines = buildInventoryAuditLines([
      mkRequest({
        id: '1',
        stockCheckStatus: 'Pending',
        itemDetails: [
          {
            itemCode: '1000153',
            itemName: 'DISODIUM EDTA',
            reqQty: 2,
            unit: 'KG',
            moq: '1',
            packSize: '',
            plannedPrice: 12,
            estValue: 24,
            type: 'RM',
          },
        ],
      }),
      mkRequest({ id: '2', stockCheckStatus: null, itemDetails: [] }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.itemCode).toBe('1000153');
    expect(lines[0]?.requestedQty).toBe(2);
    expect(lines[0]?.stockCheckStatus).toBe('Pending');
  });

  it('merges warehouse note qty onto lines when completed', () => {
    const lines = buildInventoryAuditLines([
      mkRequest({
        code: 'PR-REQ-022',
        stockCheckStatus: 'Completed',
        stockCheckNotes: JSON.stringify({
          outcome: 'not_ok',
          lines: [
            {
              itemCode: '1000153',
              systemQty: 680,
              physicalQty: 625,
              consumptionQty: 50,
              gapQty: 5,
              location: 'MAIN',
              remarks: '5KG physical vs system gap',
            },
          ],
        }),
        itemDetails: [
          {
            itemCode: '1000153',
            itemName: 'DISODIUM EDTA',
            reqQty: 2,
            unit: 'KG',
            moq: '',
            packSize: '',
            plannedPrice: 0,
            estValue: 0,
          },
        ],
      }),
    ]);
    expect(lines[0]?.auditRef).toBe('INVA-2026-022');
    expect(lines[0]?.physicalQty).toBe(625);
    expect(lines[0]?.systemQty).toBe(680);
    expect(lines[0]?.consumptionQty).toBe(50);
    expect(lines[0]?.gapQty).toBe(5);
    expect(lines[0]?.location).toBe('MAIN');
    expect(lines[0]?.uiStatus).toBe('awaiting gap approval');
    expect(lines[0]?.stockCheckOutcome).toBe('not_ok');
    expect(lines[0]?.remarks).toBe('5KG physical vs system gap');
  });
});
