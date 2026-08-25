/**
 * A PO that cannot ship yet must not advertise shipping.
 *
 * Regression: DPO-008 sat at approval_status 'not_submitted' and its row still read
 * "Initiate Shipment" (greyed out, tooltip "Available once PO is Issued/Accepted") — naming a state
 * rather than the outstanding action, which read as though shipping were the next step.
 */
import { describe, it, expect } from 'vitest';
import { preShipmentAction } from '../PurchaseOrdersView';
import type { IssuedPOViewRecord } from '../issuedPoRecord.types';

const po = (over: Partial<IssuedPOViewRecord>): IssuedPOViewRecord =>
  ({ status: 'Draft', approvalStatus: null, ...over } as IssuedPOViewRecord);

describe('preShipmentAction', () => {
  it('tells a not-yet-submitted draft to submit for review', () => {
    expect(preShipmentAction(po({ approvalStatus: 'not_submitted' }))?.label).toBe('Submit for Review');
  });

  it('names the waiting stage while approval is in flight', () => {
    expect(preShipmentAction(po({ approvalStatus: 'under_review' }))?.label).toBe('Awaiting Review');
    expect(preShipmentAction(po({ approvalStatus: 'under_approval' }))?.label).toBe('Awaiting Approval');
  });

  it('points an approved draft at release, which is what actually unblocks shipping', () => {
    expect(preShipmentAction(po({ approvalStatus: 'approved' }))?.label).toBe('Release to Vendor');
  });

  it('treats a null approval_status as not-submitted, agreeing with the Approval panel', () => {
    // DPO-008 carries approval_status = null in the DB and the panel renders it as "Not Submitted".
    expect(preShipmentAction(po({ approvalStatus: null }))?.label).toBe('Submit for Review');
    expect(preShipmentAction(po({ approvalStatus: '' }))?.label).toBe('Submit for Review');
    expect(preShipmentAction(po({ approvalStatus: 'something_new' }))?.label).toBe('Submit for Review');
  });

  it('surfaces terminal approval outcomes rather than a generic pending label', () => {
    expect(preShipmentAction(po({ approvalStatus: 'changes_requested' }))?.label).toBe('Changes Requested');
    expect(preShipmentAction(po({ approvalStatus: 'rejected' }))?.label).toBe('Rejected');
  });

  it('is case- and whitespace-insensitive on the backend value', () => {
    expect(preShipmentAction(po({ approvalStatus: '  Not_Submitted ' }))?.label).toBe('Submit for Review');
  });

  it('never labels a pre-shipment PO with a shipping verb', () => {
    for (const st of ['not_submitted', 'under_review', 'under_approval', 'approved', 'changes_requested', 'rejected', null]) {
      const label = preShipmentAction(po({ approvalStatus: st }))?.label ?? '';
      expect(label.toLowerCase()).not.toContain('shipment');
      expect(label.toLowerCase()).not.toContain('ship');
    }
  });

  it('yields to the normal shipment button once the PO has left Draft', () => {
    expect(preShipmentAction(po({ status: 'Released', approvalStatus: 'approved' }))).toBeNull();
    expect(preShipmentAction(po({ status: 'In Transit' }))).toBeNull();
    expect(preShipmentAction(po({ status: 'At Risk' }))).toBeNull();
  });
});

/* ── The plumbing that feeds preShipmentAction ─────────────────────────────
 * DPO-023 sat at approval_status 'under_review' and its row still read "Submit for Review",
 * because mapPurchaseOrderToDraftPO read the stage but never set it on the DraftPO it returned.
 */
import { mapPurchaseOrderToDraftPO } from '../../../pages/procurement/procurementDataMappers';
import { mergePurchaseOrderRecords } from '../../../lib/purchaseOrderRecordsMerge';
import type { PurchaseOrder } from '../../../types/procurement.types';

const backendPo = (approvalStatus: string | null): PurchaseOrder =>
  ({
    id: 'PO-1307', vendorId: '', vendorName: 'V', poNumber: 'DPO-023', itemCount: 1, value: 349,
    date: '2026-08-25', status: 'Draft', etaDays: 0, formData: {}, approvalStatus,
  } as PurchaseOrder);

describe('approval stage reaches the row action', () => {
  it('carries the workflow stage onto the DraftPO', () => {
    expect(mapPurchaseOrderToDraftPO(backendPo('under_review'), []).approvalStatus).toBe('under_review');
  });

  it('labels an under-review PO as awaiting review, not "Submit for Review"', () => {
    const draft = mapPurchaseOrderToDraftPO(backendPo('under_review'), []);
    const [record] = mergePurchaseOrderRecords([], [draft], []);
    expect(preShipmentAction(record)?.label).toBe('Awaiting Review');
  });

  it('walks the full ladder as approval progresses', () => {
    const labelFor = (stage: string | null) => {
      const draft = mapPurchaseOrderToDraftPO(backendPo(stage), []);
      const [record] = mergePurchaseOrderRecords([], [draft], []);
      return preShipmentAction(record)?.label;
    };
    expect(labelFor(null)).toBe('Submit for Review');
    expect(labelFor('under_review')).toBe('Awaiting Review');
    expect(labelFor('under_approval')).toBe('Awaiting Approval');
    expect(labelFor('approved')).toBe('Release to Vendor');
    expect(labelFor('changes_requested')).toBe('Changes Requested');
    expect(labelFor('rejected')).toBe('Rejected');
  });
});
