/**
 * One truck delivering several GRNs was confirmed one GRN at a time: the same vehicle, driver,
 * date/time, photos and paperwork re-entered for each, producing records that claim to be separate
 * deliveries. A grouped receipt captures it once and writes it to every selected GRN.
 */
import { describe, it, expect } from 'vitest';
import {
  buildGroupedReceiptUpdates,
  groupBlockReason,
  isGroupableForReceipt,
  sortGroupCandidates,
} from '../groupedGrnReceipt';

const grn = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, grnNo: `GRN-${id}`, status: 'In Transit', ...over }) as never;

const share = {
  meta: {
    receiptDate: '2026-08-27',
    receiptTime: '11:28',
    receivedBy: 'Bhaskar',
    vehicleNumber: 'MH-04-XX-1234',
    driverName: 'Ramesh',
    checklist: { invoice: true, coa: true },
    vehiclePhotos: ['data:image/jpeg;base64,AAA'],
    documentPhotos: ['data:image/jpeg;base64,BBB'],
  },
  sharedDocs: { bill: { fileName: 'invoice.pdf', ref: 'INV-9' }, coa: { fileName: 'coa.pdf' } },
};
const AT = '2026-08-27T06:00:00.000Z';

describe('isGroupableForReceipt', () => {
  it('accepts a GRN whose receipt has not been confirmed', () => {
    expect(isGroupableForReceipt(grn('1'))).toBe(true);
    expect(groupBlockReason(grn('1'))).toBeNull();
  });

  it('refuses one already confirmed — regrouping would overwrite a signed-off arrival', () => {
    const done = grn('2', { sourceDocuments: { receipt: { confirmedAt: AT } } });
    expect(isGroupableForReceipt(done)).toBe(false);
    expect(groupBlockReason(done)).toBe('Receipt already confirmed');
  });
});

describe('buildGroupedReceiptUpdates', () => {
  it('writes the same receipt record to every selected GRN', () => {
    const out = buildGroupedReceiptUpdates([grn('1'), grn('2'), grn('3')], share, AT);
    expect(out.map((u) => u.grnNo)).toEqual(['GRN-1', 'GRN-2', 'GRN-3']);
    for (const u of out) {
      expect(u.sourceDocuments.receipt?.vehicleNumber).toBe('MH-04-XX-1234');
      expect(u.sourceDocuments.receipt?.confirmedAt).toBe(AT);
      expect(u.sourceDocuments.receipt?.vehiclePhotos).toHaveLength(1);
      expect(u.receivedDate).toBe('2026-08-27');
    }
  });

  it('copies the shared documents onto each GRN and marks them as shared', () => {
    const [u] = buildGroupedReceiptUpdates([grn('1')], share, AT);
    expect(u.sourceDocuments.bill).toMatchObject({ fileName: 'invoice.pdf', ref: 'INV-9', sharedWithGroup: true });
    expect(u.sourceDocuments.coa).toMatchObject({ fileName: 'coa.pdf', sharedWithGroup: true });
  });

  it("preserves a GRN's own existing documents rather than replacing the blob", () => {
    const withOwn = grn('1', { sourceDocuments: { msds: { fileName: 'own-msds.pdf' } } });
    const [u] = buildGroupedReceiptUpdates([withOwn], share, AT);
    expect(u.sourceDocuments.msds).toMatchObject({ fileName: 'own-msds.pdf' });
    expect(u.sourceDocuments.bill).toMatchObject({ fileName: 'invoice.pdf' });
  });

  it('skips GRNs whose receipt is already confirmed', () => {
    const done = grn('2', { sourceDocuments: { receipt: { confirmedAt: AT } } });
    expect(buildGroupedReceiptUpdates([grn('1'), done], share, AT).map((u) => u.grnNo)).toEqual(['GRN-1']);
  });

  it('ignores empty shared-doc entries instead of writing blank files', () => {
    const out = buildGroupedReceiptUpdates([grn('1')], { ...share, sharedDocs: { bill: { fileName: '  ' } } }, AT);
    expect(out[0].sourceDocuments.bill).toBeUndefined();
  });

  it('sets assignedTo only for a specific assignment', () => {
    const open = buildGroupedReceiptUpdates([grn('1')], share, AT)[0];
    expect(open.assignedTo).toBeUndefined();
    const specific = buildGroupedReceiptUpdates(
      [grn('1')],
      { ...share, meta: { ...share.meta, assignmentType: 'specific', assignedTo: 'p@x.com' } },
      AT,
    )[0];
    expect(specific.assignedTo).toBe('p@x.com');
  });

  it('handles an empty selection', () => {
    expect(buildGroupedReceiptUpdates([], share, AT)).toEqual([]);
  });
});

describe('sortGroupCandidates', () => {
  it('groups by vendor, then GRN number naturally', () => {
    const rows = [
      grn('10', { vendor: 'B', grnNo: 'GRN-10' }),
      grn('2', { vendor: 'A', grnNo: 'GRN-2' }),
      grn('9', { vendor: 'A', grnNo: 'GRN-9' }),
    ];
    expect(sortGroupCandidates(rows).map((g) => g.grnNo)).toEqual(['GRN-2', 'GRN-9', 'GRN-10']);
  });
});

/* ── Document requirement while the form is being composed ───────────────── */
import { docKeysForChecklist } from '../grnCopyReceiptDisplay';

describe('docKeysForChecklist', () => {
  it('asks for nothing before anything is ticked — the reported bug', () => {
    // The grouped form starts with an empty checklist. The stored-GRN helper falls back to the
    // original three, which demanded Invoice + E-Way Bill + COA on a blank form.
    expect(docKeysForChecklist({})).toEqual([]);
    expect(docKeysForChecklist(undefined)).toEqual([]);
    expect(docKeysForChecklist(null)).toEqual([]);
  });

  it('asks for exactly what is ticked', () => {
    expect(docKeysForChecklist({ invoice: true })).toEqual(['bill']);
    expect(docKeysForChecklist({ invoice: true, msds: true })).toEqual(['bill', 'msds']);
    expect(docKeysForChecklist({ coa: true, invoice: true, ewayBill: true }))
      .toEqual(['bill', 'waybill', 'coa']);
  });

  it('ignores explicitly-unticked boxes', () => {
    expect(docKeysForChecklist({ invoice: false, coa: false })).toEqual([]);
    expect(docKeysForChecklist({ invoice: true, coa: false })).toEqual(['bill']);
  });
});
