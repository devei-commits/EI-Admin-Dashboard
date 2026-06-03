import { describe, expect, it } from 'vitest';
import type { ProcurementRequest } from '../services/procurement.service';
import type { Order } from '../types/salesPurchase.types';
import {
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
  it('allows merge for New and Quoted', () => {
    expect(isProcurementRequestMergeable(pr('1', 'New'), [])).toBe(true);
    expect(isProcurementRequestMergeable(pr('1', 'Quoted'), [])).toBe(true);
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
