import { describe, expect, it } from 'vitest';
import { mergePurchaseOrderRecords } from '../purchaseOrderRecordsMerge';
import type { DraftPO, ProcurementRequest } from '../../types/procurement.types';

describe('mergePurchaseOrderRecords', () => {
  it('includes draft POs without a linked procurement request (excel import)', () => {
    const drafts: DraftPO[] = [
      {
        id: 'EI/PO/26-27/398',
        dpoNumber: 'EI/PO/26-27/398',
        requestId: '',
        requestCode: 'EI/PO/26-27/398',
        type: 'RM',
        vendor: 'KRIYA INDUSTRIES',
        vendorId: '',
        status: 'Pending Approval',
        createdDate: '2026-03-10',
        createdBy: 'Procurement',
        paymentTerms: '',
        expectedDelivery: '',
        deliveryAddress: '',
        vendorRating: 0,
        alertMessage: '',
        alertType: 'warning',
        lineItems: [
          {
            item: 'Monocarton',
            itemCode: '5M00791',
            type: 'RM',
            qty: '5150',
            pricePerUnit: 6.468,
            gstPercent: 18,
            gstAmount: 6000,
            lineTotal: 39310,
          },
        ],
        subtotal: 33310,
        gstTotal: 6000,
        grandTotal: 39310,
        backendPoId: '42',
      },
    ];

    const merged = mergePurchaseOrderRecords([], drafts, [] as ProcurementRequest[]);
    expect(merged).toHaveLength(1);
    expect(merged[0].poNumber).toBe('EI/PO/26-27/398');
    expect(merged[0].status).toBe('Draft');
    expect(merged[0].poWorkflowStatus).toBe('draft');
    expect(merged[0].vendor).toBe('KRIYA INDUSTRIES');
    expect(merged[0].backendPoId).toBe('42');
  });

  it('prefers a real request match when requestId is set', () => {
    const request: ProcurementRequest = {
      id: '7',
      code: 'PR-REQ-007',
      type: 'PM',
      priority: 'High',
      status: 'PO Draft',
      items: ['Cap'],
      dueDate: '2026-05-01',
    };
    const drafts: DraftPO[] = [
      {
        id: 'PO-1',
        dpoNumber: 'PO-1',
        requestId: '7',
        requestCode: 'PR-REQ-007',
        type: 'PM',
        vendor: 'Vendor A',
        vendorId: '',
        status: 'Pending Approval',
        createdDate: '2026-05-01',
        createdBy: 'Procurement',
        paymentTerms: '',
        expectedDelivery: '',
        deliveryAddress: '',
        vendorRating: 0,
        alertMessage: '',
        alertType: 'warning',
        lineItems: [],
        subtotal: 0,
        gstTotal: 0,
        grandTotal: 100,
        backendPoId: '9',
      },
    ];

    const merged = mergePurchaseOrderRecords([], drafts, [request]);
    expect(merged).toHaveLength(1);
    expect(merged[0].request).toBe(request);
    expect(merged[0].requestCode).toBe('PR-REQ-007');
  });
});
