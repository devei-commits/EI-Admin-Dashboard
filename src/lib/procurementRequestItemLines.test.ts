import { describe, expect, it } from 'vitest';
import { buildProcurementRequestItemLines } from './procurementRequestItemLines';
import type { ProcurementRequest } from '../types/procurement.types';

function baseRequest(overrides: Partial<ProcurementRequest> = {}): ProcurementRequest {
  return {
    id: '1',
    code: 'PR-REQ-001',
    type: 'RM',
    priority: 'High',
    status: 'New',
    items: ['Item A'],
    dueDate: '2026-06-24',
    preferredVendor: undefined,
    itemDetails: [
      {
        itemCode: '1000153',
        itemName: 'DISODIUM EDTA',
        reqQty: 4.2,
        unit: 'KG',
        moq: '1 kg',
        packSize: '',
        plannedPrice: 12,
        expectedDate: '2026-06-24',
        estValue: 50.4,
        type: 'RM',
      },
    ],
    ...overrides,
  };
}

describe('buildProcurementRequestItemLines', () => {
  it('flattens one row per item without inferring vendor from quotes', () => {
    const lines = buildProcurementRequestItemLines([baseRequest()]);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.itemName).toBe('DISODIUM EDTA');
    expect(lines[0]?.preferredVendor).toBeNull();
  });

  it('includes preferred vendor only when set on request', () => {
    const lines = buildProcurementRequestItemLines([
      baseRequest({ preferredVendor: 'Adobe Systems' }),
    ]);
    expect(lines[0]?.preferredVendor).toBe('Adobe Systems');
  });
});
