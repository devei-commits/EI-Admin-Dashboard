import { describe, expect, it } from 'vitest';
import type { ProcurementRequest } from '../services/procurement.service';
import type { Order } from '../types/salesPurchase.types';
import {
  findVendorWeekMergeTarget,
  isProcurementRequestMergeable,
  procurementRequestHasLinkedDraftPo,
} from './procurementRequestMerge';

function pr(id: string, status: string): Pick<ProcurementRequest, 'id' | 'status'> {
  return { id, status };
}

function draftPoForRequest(requestId: string): Order {
  return {
    id: 'PO-1',
    type: 'PO',
    orderId: 'DPO-001',
    orderDate: '2026-01-01',
    status: 'Draft',
    items: [],
    formData: { requestId },
    orderStatus: {
      orderStatus: '',
      invoiced: '',
      payment: '',
      packed: '',
      shipped: '',
      deliveryMethod: '',
    },
  };
}

describe('procurementRequestHasLinkedDraftPo', () => {
  it('returns true when a draft PO references the request id', () => {
    expect(procurementRequestHasLinkedDraftPo('42', [draftPoForRequest('42')])).toBe(true);
  });

  it('returns false when only released POs reference the request', () => {
    const released: Order = { ...draftPoForRequest('42'), status: 'Released' };
    expect(procurementRequestHasLinkedDraftPo('42', [released])).toBe(false);
  });
});

describe('isProcurementRequestMergeable', () => {
  it('allows merge for New, Quoted, and backend Pending', () => {
    expect(isProcurementRequestMergeable(pr('1', 'New'), [])).toBe(true);
    expect(isProcurementRequestMergeable(pr('1', 'Quoted'), [])).toBe(true);
    expect(isProcurementRequestMergeable(pr('1', 'Pending'), [])).toBe(true);
    expect(isProcurementRequestMergeable(pr('1', 'pending'), [])).toBe(true);
  });

  it('blocks merge for PO Draft when a draft PO is linked (100 + 20 scenario)', () => {
    expect(
      isProcurementRequestMergeable(pr('7', 'PO Draft'), [draftPoForRequest('7')])
    ).toBe(false);
  });

  it('allows merge for PO Draft when no draft PO exists yet', () => {
    expect(isProcurementRequestMergeable(pr('7', 'PO Draft'), [])).toBe(true);
  });

  it('blocks merge for PO Released and later', () => {
    expect(isProcurementRequestMergeable(pr('1', 'PO Released'), [])).toBe(false);
    expect(isProcurementRequestMergeable(pr('1', 'Delivery Pending'), [])).toBe(false);
    expect(isProcurementRequestMergeable(pr('1', 'Under GRN'), [])).toBe(false);
  });
});

function fullPr(
  id: string,
  overrides: Partial<ProcurementRequest> = {}
): ProcurementRequest {
  return {
    id,
    planningExtractedId: 1842,
    planningBatchId: null,
    priority: 'High',
    requiredByDate: '2026-06-27',
    notes: null,
    items: [],
    status: 'Pending',
    preferredVendor: 'Adobe Systems Software Ireland Ltd',
    requestedBy: null,
    createdAt: '2026-06-13T09:55:59Z',
    updatedAt: '2026-06-13T09:55:59Z',
    ...overrides,
  };
}

describe('findVendorWeekMergeTarget', () => {
  it('merges into open PR with same vendor and ISO week regardless of batch id', () => {
    const requests: ProcurementRequest[] = [
      fullPr('53', {
        planningBatchId: null,
        items: [{ type: 'RM', code: '1000019', name: 'ALPHA CAPB', quantity_requested: 15, unit: 'KG' }],
        createdAt: '2026-06-13T09:55:59Z',
      }),
      fullPr('52', {
        planningBatchId: 46,
        status: 'PO Released',
        items: [{ type: 'RM', code: '1000520', name: 'LK 145 D', quantity_requested: 10, unit: 'KG' }],
        createdAt: '2026-06-13T09:45:52Z',
      }),
    ];
    const hit = findVendorWeekMergeTarget(requests, {
      vendorName: 'Adobe Systems Software Ireland Ltd',
      requiredByDate: '2026-06-27',
      purchaseOrders: [],
    });
    expect(hit?.id).toBe('53');
  });

  it('prefers PR with more lines when multiple merge candidates exist', () => {
    const requests: ProcurementRequest[] = [
      fullPr('54', {
        items: [{ type: 'RM', code: '1000172', name: 'EMPIGEN', quantity_requested: 2, unit: 'KG' }],
        createdAt: '2026-06-13T09:56:10Z',
      }),
      fullPr('53', {
        items: [
          { type: 'RM', code: '1000019', name: 'ALPHA CAPB', quantity_requested: 15, unit: 'KG' },
          { type: 'RM', code: '1000999', name: 'OTHER', quantity_requested: 1, unit: 'KG' },
        ],
        createdAt: '2026-06-13T09:55:59Z',
      }),
    ];
    const hit = findVendorWeekMergeTarget(requests, {
      vendorName: 'Adobe Systems Software Ireland Ltd',
      requiredByDate: '2026-06-27',
      purchaseOrders: [],
    });
    expect(hit?.id).toBe('53');
  });
});
