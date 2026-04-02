import { describe, it, expect } from 'vitest';
import { computeIssuedPoEtaFromLeadTimes } from '../procurementDataMappers';
import type { ProcurementRequest } from '../../../types/procurement.types';

describe('computeIssuedPoEtaFromLeadTimes', () => {
  const baseRequest = (over: Partial<ProcurementRequest> = {}): ProcurementRequest => ({
    id: '1',
    code: 'PR-REQ-001',
    type: 'RM',
    priority: 'Medium',
    status: 'PO Released',
    items: ['A'],
    dueDate: '2026-06-01',
    createdDate: '2026-01-01',
    ...over,
  });

  it('uses max line lead from raw PO + PO date', () => {
    const today = new Date(2026, 3, 1, 12, 0, 0, 0);
    const r = computeIssuedPoEtaFromLeadTimes({
      today,
      poReleaseDateStr: '2026-04-01',
      request: baseRequest({ itemDetails: [{ itemCode: 'X', itemName: 'A', reqQty: 1, unit: 'kg', moq: '', packSize: '', plannedPrice: 0, estValue: 0, leadTimeDays: 99 }] }),
      linkedQuote: undefined,
      linkedPO: {
        id: '1',
        vendorId: '',
        vendorName: 'V',
        poNumber: 'PO-1',
        itemCount: 1,
        value: 100,
        date: '2026-04-01',
        status: 'Released',
        etaDays: 0,
        rawItems: [{ quantity: 1, rate: 1, lead_time_days: 5, itemName: 'A' }],
      },
      draftOverlay: undefined,
      lineItems: [{ item: 'A', itemCode: 'X' }],
    });
    expect(r.maxLeadDays).toBe(5);
    expect(r.etaDateDisplay).not.toBe('—');
  });

  it('falls back to PR due date when no lead data', () => {
    const today = new Date(2026, 3, 1, 12, 0, 0, 0);
    const r = computeIssuedPoEtaFromLeadTimes({
      today,
      poReleaseDateStr: '2026-04-01',
      request: baseRequest({ dueDate: '2026-05-15' }),
      linkedQuote: undefined,
      linkedPO: {
        id: '1',
        vendorId: '',
        vendorName: 'V',
        poNumber: 'PO-1',
        itemCount: 1,
        value: 100,
        date: '2026-04-01',
        status: 'Released',
        etaDays: 0,
        rawItems: [{ quantity: 1, rate: 1, itemName: 'A' }],
      },
      draftOverlay: undefined,
      lineItems: [{ item: 'A', itemCode: 'X' }],
    });
    expect(r.etaDateDisplay).toMatch(/15/);
  });
});
