import { describe, expect, it } from 'vitest';
import {
  bumpProcurementRequestItemQty,
  bumpPurchaseOrderItemsQty,
  findDraftPurchaseOrderForRequest,
  mergeGapApprovalIntoStockCheckNotes,
} from './inventoryAuditGapApproval';
import type { Order } from '../types/salesPurchase.types';

describe('inventoryAuditGapApproval', () => {
  it('merges gap approval into stock check notes JSON', () => {
    const raw = JSON.stringify({
      outcome: 'not_ok',
      lines: [{ itemCode: 'RM-1', physicalQty: 625, systemQty: 680, consumptionQty: 50 }],
    });
    const next = mergeGapApprovalIntoStockCheckNotes(raw, 'RM-1', 'Niacinamide', 5, 'Procurement User');
    const parsed = JSON.parse(next) as {
      lines: Array<{ gapApproved?: boolean; gapAppliedQty?: number }>;
    };
    expect(parsed.lines[0]?.gapApproved).toBe(true);
    expect(parsed.lines[0]?.gapAppliedQty).toBe(5);
  });

  it('bumps procurement request item qty by gap delta', () => {
    const items = [
      {
        type: 'RM' as const,
        code: 'RM-1',
        name: 'Niacinamide',
        required: 100,
        sih: 0,
        shortage: 100,
        quantity_requested: 100,
        unit: 'KG',
      },
    ];
    const bumped = bumpProcurementRequestItemQty(items, 'RM-1', 'Niacinamide', 5);
    expect(bumped[0]?.quantity_requested).toBe(105);
    expect(bumped[0]?.required).toBe(105);
  });

  it('bumps draft PO line qty when item matches', () => {
    const items = [{ itemCode: 'RM-1', itemName: 'Niacinamide', quantity: 100 }];
    const bumped = bumpPurchaseOrderItemsQty(items, 'RM-1', 'Niacinamide', 5);
    expect((bumped[0] as { quantity?: number }).quantity).toBe(105);
  });

  it('finds draft PO linked to procurement request', () => {
    const orders: Order[] = [
      {
        id: 'po-1',
        type: 'PO',
        orderId: 'DPO-001',
        orderDate: '2026-06-01',
        status: 'Draft',
        items: [],
        formData: { requestId: 'pr-99' },
        orderStatus: { orderStatus: '', invoiced: '', payment: '', packed: '', shipped: '', deliveryMethod: '' },
      },
      {
        id: 'po-2',
        type: 'PO',
        orderId: 'PO-002',
        orderDate: '2026-06-01',
        status: 'Released',
        items: [],
        formData: { requestId: 'pr-99' },
        orderStatus: { orderStatus: '', invoiced: '', payment: '', packed: '', shipped: '', deliveryMethod: '' },
      },
    ];
    const found = findDraftPurchaseOrderForRequest(orders, 'pr-99');
    expect(found?.id).toBe('po-1');
  });
});
