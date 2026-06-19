import { describe, expect, it } from 'vitest';
import {
  allPoLinesHaveGrn,
  issuedPoLineTimelineCompletedIndex,
  lineGrnStatus,
  poGrnProgress,
} from '../issuedPoGrnLineStatus';
import type { GRNRecordFromApi } from '@/services/grn.service';
import type { DraftPOLineItem } from '@/types/procurement.types';

const sampleLines: DraftPOLineItem[] = [
  { item: 'Glycerin', itemCode: 'RM-001', type: 'RM', qty: '10', pricePerUnit: 100, gstPercent: 18, gstAmount: 180, lineTotal: 1180 },
  { item: 'Jar', itemCode: 'PM-002', type: 'PM', qty: '500', pricePerUnit: 2, gstPercent: 18, gstAmount: 180, lineTotal: 1180 },
];

const grnList: GRNRecordFromApi[] = [
  {
    id: '1',
    grnNo: 'GRN-1',
    poNo: 'PO-100',
    vendor: 'Acme',
    type: 'RM',
    items: 1,
    poValue: 1000,
    expectedDate: '',
    receivedDate: '2026-06-01',
    assignedTo: '',
    qcStatus: 'Pending',
    qcBy: '',
    status: 'Under GRN',
    lineItems: [{ id: 'l1', item: 'Glycerin', itemCode: 'RM-001', poQty: 10, rcvdQty: 0, invoiceQty: 0, unitPrice: 100, diff: 0, qcStatus: 'Pending', qcBy: '' }],
  },
];

describe('issuedPoGrnLineStatus', () => {
  it('resolves per-line GRN status', () => {
    expect(lineGrnStatus(grnList, 'PO-100', 'RM-001')).toBe('under_grn');
    expect(lineGrnStatus(grnList, 'PO-100', 'PM-002')).toBe('none');
  });

  it('counts PO warehouse progress', () => {
    expect(poGrnProgress(grnList, 'PO-100', sampleLines)).toEqual({
      totalLines: 2,
      underGrnCount: 1,
      completeCount: 0,
      pendingCount: 1,
    });
  });

  it('detects when all lines have GRNs', () => {
    expect(allPoLinesHaveGrn(grnList, 'PO-100', sampleLines)).toBe(false);
  });

  it('merges PO timeline with line GRN for item pipeline', () => {
    expect(issuedPoLineTimelineCompletedIndex(3, 'under_grn')).toBe(5);
    expect(issuedPoLineTimelineCompletedIndex(3, 'complete')).toBe(6);
    expect(issuedPoLineTimelineCompletedIndex(2, 'none')).toBe(2);
  });
});
