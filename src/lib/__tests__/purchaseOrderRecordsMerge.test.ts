import { describe, expect, it } from 'vitest';
import {
  mergePurchaseOrderRecords,
  isPoStatusCancelled,
  isPoStatusIssuedLike,
  isPoStatusListed,
} from '../purchaseOrderRecordsMerge';
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

  it('surfaces an approved draft PO as "accepted" (not draft)', () => {
    const base: DraftPO = {
      id: 'EI/PO/26-27/400',
      dpoNumber: 'EI/PO/26-27/400',
      requestId: '',
      requestCode: 'EI/PO/26-27/400',
      type: 'RM',
      vendor: 'ACME',
      vendorId: '',
      status: 'Pending Approval',
      createdDate: '2026-03-11',
      createdBy: 'Procurement',
      paymentTerms: '',
      expectedDelivery: '',
      deliveryAddress: '',
      vendorRating: 0,
      alertMessage: '',
      alertType: 'warning',
      lineItems: [
        { item: 'X', itemCode: 'X1', type: 'RM', qty: '10', pricePerUnit: 1, gstPercent: 18, gstAmount: 1.8, lineTotal: 11.8 },
      ],
      subtotal: 10,
      gstTotal: 1.8,
      grandTotal: 11.8,
      backendPoId: '43',
    };
    const pending = mergePurchaseOrderRecords([], [base], []);
    expect(pending[0].poWorkflowStatus).toBe('draft'); // pending approval → still draft

    const approved = mergePurchaseOrderRecords([], [{ ...base, status: 'Approved' }], []);
    expect(approved[0].status).toBe('Draft'); // legacy status stays Draft (not yet released)
    expect(approved[0].poWorkflowStatus).toBe('accepted'); // …but the pill reads Accepted
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

  // PO-024 (DPO for PR-REQ-092): a Draft-status PO built entirely through this merge path (it never
  // reaches computeIssuedPoEtaFromLeadTimes at all, since Draft/Accepted-status requests are filtered
  // out of the issued-PO pipeline upstream). This function never set connectingDateByItem, so every
  // Draft/Accepted PO's Connecting column showed "—" even when the PR's required-by date was known.
  it('sets connectingDateByItem from the PR required-by date for a Draft PO row', () => {
    const request: ProcurementRequest = {
      id: '92',
      code: 'PR-REQ-092',
      type: 'PM',
      priority: 'High',
      status: 'PO Draft',
      items: ['BBOLD empty plastic tubes 12ml with single ball and black cap'],
      dueDate: '2026-10-08',
      itemDetails: [
        {
          itemCode: '12PT01',
          itemName: 'BBOLD empty plastic tubes 12ml with single ball and black cap',
          reqQty: 200,
          unit: 'PCS',
          moq: '0.5',
          packSize: '',
          plannedPrice: 2.96,
          estValue: 0,
          leadTimeDays: 0,
          expectedDate: '2026-10-08',
        },
      ],
    };
    const dpo: DraftPO = {
      id: 'DPO-024',
      dpoNumber: 'DPO-024',
      requestId: '92',
      requestCode: 'PR-REQ-092',
      type: 'PM',
      vendor: 'Adobe Systems Software Ireland Ltd',
      vendorId: '',
      status: 'Pending Approval',
      createdDate: '2026-08-25',
      createdBy: 'Procurement',
      paymentTerms: '',
      // Stale — computed as PO-creation-date + 0-day lead before the required-by fix existed.
      expectedDelivery: '2026-08-25',
      deliveryAddress: '',
      vendorRating: 0,
      alertMessage: '',
      alertType: 'warning',
      lineItems: [
        { item: 'BBOLD empty plastic tubes 12ml with single ball and black cap', itemCode: '12PT01', type: 'PM', qty: '200', pricePerUnit: 2.96, gstPercent: 18, gstAmount: 0, lineTotal: 699 },
      ],
      subtotal: 592,
      gstTotal: 107,
      grandTotal: 699,
      backendPoId: '1310',
    };

    const merged = mergePurchaseOrderRecords([], [dpo], [request]);
    expect(merged).toHaveLength(1);
    expect(merged[0].connectingDateByItem).not.toBeNull();
    expect(merged[0].connectingDateByItem?.['12pt01']).toBe('2026-10-08');
  });
});

describe('PO status predicates — cancelled POs must stay visible', () => {
  /**
   * Cancelling writes purchase_orders.status = 'Cancelled' (cancelPo). The Purchase Orders list
   * gated on issued-only statuses, so the row vanished the moment it was cancelled: 198 POs loaded,
   * the view's own "Cancelled" filter matching 0 of them, and no way to audit what was cancelled.
   */
  it('recognises the exact status the backend writes on cancel', () => {
    expect(isPoStatusCancelled('Cancelled')).toBe(true);
    expect(isPoStatusCancelled('cancelled')).toBe(true);
    expect(isPoStatusCancelled('Released')).toBe(false);
  });

  it('does NOT treat a cancelled PO as live', () => {
    // Guards that ask "is this PO live?" must keep saying no — a cancelled PO should not block
    // deleting its request, and must not be shippable.
    expect(isPoStatusIssuedLike('Cancelled')).toBe(false);
    expect(isPoStatusIssuedLike('Released')).toBe(true);
    expect(isPoStatusIssuedLike('Issued')).toBe(true);
  });

  it('DOES list a cancelled PO', () => {
    expect(isPoStatusListed('Cancelled')).toBe(true);
    expect(isPoStatusListed('Released')).toBe(true);
    expect(isPoStatusListed('Issued')).toBe(true);
  });

  it('still excludes statuses that were never in the list', () => {
    // Draft POs reach the view through the draftPOs merge, not this gate — widening it to
    // everything would double up every draft row.
    expect(isPoStatusListed('Draft')).toBe(false);
    expect(isPoStatusListed('Completed')).toBe(false);
    expect(isPoStatusListed('')).toBe(false);
    expect(isPoStatusListed(null)).toBe(false);
    expect(isPoStatusListed(undefined)).toBe(false);
  });

  it('is the widening of issued-like, never the reverse', () => {
    for (const s of ['Released', 'Issued', 'Cancelled', 'Draft', 'Completed', null]) {
      if (isPoStatusIssuedLike(s)) expect(isPoStatusListed(s)).toBe(true);
    }
  });
});

describe('mergePurchaseOrderRecords keeps a cancelled verdict', () => {
  it('does not downgrade a cancelled issued record to "issued"', () => {
    // mapLegacyToWorkflowStatus falls through to 'issued' for anything it does not recognise, so
    // the cancelled label set upstream has to survive the merge.
    const [row] = mergePurchaseOrderRecords(
      [
        {
          request: { id: '1', code: 'PR-1', type: 'RM', priority: 'Medium', status: 'New', items: [], dueDate: '', createdDate: '', source: 'Excel Import' } as ProcurementRequest,
          poNumber: 'PO-999',
          vendor: 'Acme',
          status: 'Released',
          poWorkflowStatus: 'cancelled',
          etaDays: 0,
          etaDateDisplay: '',
          lineItems: [],
          grandTotal: 0,
          requestCode: 'PR-1',
          createdDate: '2026-08-01',
        },
      ] as never,
      [],
      [],
    );
    expect(row?.poWorkflowStatus).toBe('cancelled');
  });
});
