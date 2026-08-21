/**
 * A PO's approved-ness has two sources: the authoritative `approval_status` column written by the
 * approval workflow (Sub-flow E), and a legacy `form_data.procurementApprovalStatus` marker older
 * POs carry.
 *
 * The mapper read only the legacy one, so every PO approved through the current workflow still
 * mapped to "Pending Approval" and the Release / Split guards refused it — on prod, all 4 approved
 * POs were in exactly that state (DPO-006: approval_status 'approved', legacy null).
 */
import { describe, it, expect } from 'vitest';
import { mapPurchaseOrderToDraftPO } from '../procurementDataMappers';
import type { PurchaseOrder } from '../../../types/procurement.types';

const po = (over: Partial<PurchaseOrder>): PurchaseOrder =>
  ({
    id: 'PO-1', vendorId: '', vendorName: 'V', poNumber: 'DPO-006', itemCount: 1, value: 100,
    date: '2026-07-21', status: 'Draft', etaDays: 0, formData: {},
    ...over,
  } as PurchaseOrder);

const statusOf = (p: PurchaseOrder) => mapPurchaseOrderToDraftPO(p, []).status;

describe('DraftPO approval source', () => {
  it('accepts the workflow column — the DPO-006 case that was blocked', () => {
    expect(statusOf(po({ approvalStatus: 'approved', formData: {} }))).toBe('Approved');
  });

  it('still accepts the legacy marker — the DPO-005 case', () => {
    expect(statusOf(po({ approvalStatus: null, formData: { procurementApprovalStatus: 'Approved' } })))
      .toBe('Approved');
  });

  it('is case-insensitive on the workflow column', () => {
    expect(statusOf(po({ approvalStatus: '  APPROVED ' }))).toBe('Approved');
  });

  it('leaves an un-approved PO pending', () => {
    expect(statusOf(po({ approvalStatus: 'under_review' }))).toBe('Pending Approval');
    expect(statusOf(po({ approvalStatus: null }))).toBe('Pending Approval');
    expect(statusOf(po({ approvalStatus: 'not_submitted' }))).toBe('Pending Approval');
  });

  it('keeps the split-child reset for a stale legacy marker with no timestamp', () => {
    const child = po({
      poNumber: 'DPO-006-S1',
      approvalStatus: null,
      formData: { procurementApprovalStatus: 'Approved' },
    });
    expect(statusOf(child)).toBe('Pending Approval');
  });

  it('does not reset a split child that the workflow itself approved', () => {
    const child = po({ poNumber: 'DPO-006-S1', approvalStatus: 'approved', formData: {} });
    expect(statusOf(child)).toBe('Approved');
  });
});
