/**
 * Invoice / E-Way Bill / COA gate label generation and therefore GRN completion, but step 2 let an
 * operator continue without them — so the block only appeared at step 5. These pin the check that
 * moves it forward to where the documents are actually entered.
 */
import { describe, it, expect } from 'vitest';
import {
  missingRequiredGrnDocs,
  requiredGrnDocsError,
  GRN_REQUIRED_DOC_KEYS,
} from '../grnCopyReceiptDisplay';

const withFiles = (keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, { fileName: `${k}.pdf` }])) as never;

describe('missingRequiredGrnDocs', () => {
  it('reports all three when nothing is uploaded', () => {
    expect(missingRequiredGrnDocs({})).toEqual(['bill', 'waybill', 'coa']);
    expect(missingRequiredGrnDocs(undefined)).toEqual(['bill', 'waybill', 'coa']);
  });

  it('reports none once all three are on file', () => {
    expect(missingRequiredGrnDocs(withFiles(['bill', 'waybill', 'coa']))).toEqual([]);
  });

  it('ignores the Lorry Receipt, which is reference-only', () => {
    expect(GRN_REQUIRED_DOC_KEYS).not.toContain('lr');
    expect(missingRequiredGrnDocs(withFiles(['bill', 'waybill', 'coa', 'lr']))).toEqual([]);
    // An LR alone does not satisfy anything.
    expect(missingRequiredGrnDocs(withFiles(['lr']))).toEqual(['bill', 'waybill', 'coa']);
  });

  it('does not count a reference number as an upload', () => {
    expect(missingRequiredGrnDocs({ bill: { ref: 'INV-1' } } as never)).toContain('bill');
  });

  it('does not count a blank file name as an upload', () => {
    expect(missingRequiredGrnDocs({ bill: { fileName: '   ' } } as never)).toContain('bill');
  });
});

describe('requiredGrnDocsError', () => {
  it('is null when nothing is missing', () => {
    expect(requiredGrnDocsError(withFiles(['bill', 'waybill', 'coa']))).toBeNull();
  });

  it('names a single missing document in the singular', () => {
    const msg = requiredGrnDocsError(withFiles(['bill', 'waybill']))!;
    expect(msg).toContain('Upload COA');
    expect(msg).toContain('it is');
  });

  it('lists several missing documents readably', () => {
    const msg = requiredGrnDocsError({})!;
    expect(msg).toContain('Tax Invoice, E-Way Bill and COA');
    expect(msg).toContain('they are');
  });

  it('says why they are required, not just that they are', () => {
    expect(requiredGrnDocsError({})).toMatch(/generate labels and complete this GRN/);
  });
});

/* ── Driven by the dock checklist ─────────────────────────────────────────
 * Step 2 demanded Invoice + E-Way Bill + COA regardless of what arrived, so a shipment received
 * without an E-Way Bill could not clear the step at all.
 */
import { requiredGrnDocKeys } from '../grnCopyReceiptDisplay';

const withChecklist = (checklist: Record<string, boolean>) => ({ receipt: { checklist } }) as never;

describe('requiredGrnDocKeys', () => {
  it('asks only for what the checklist says arrived', () => {
    expect(requiredGrnDocKeys(withChecklist({ invoice: true, coa: true }))).toEqual(['bill', 'coa']);
    expect(requiredGrnDocKeys(withChecklist({ invoice: true }))).toEqual(['bill']);
  });

  it('gives every ticked checklist item an upload slot', () => {
    // Delivery Challan / MSDS / Weighment Slip previously had no slot, so ticking them recorded
    // that they arrived but left nowhere to attach them.
    expect(requiredGrnDocKeys(withChecklist({ deliveryChallan: true, msds: true, weighmentSlip: true })))
      .toEqual(['delivery_challan', 'msds', 'weighment_slip']);
  });

  it('asks for all four when four are ticked — the reported case', () => {
    expect(requiredGrnDocKeys(withChecklist({ invoice: true, coa: true, deliveryChallan: true, msds: true })))
      .toEqual(['bill', 'coa', 'delivery_challan', 'msds']);
  });

  it('keeps the canonical display order, not checklist order', () => {
    expect(requiredGrnDocKeys(withChecklist({ coa: true, invoice: true, ewayBill: true })))
      .toEqual(['bill', 'waybill', 'coa']);
  });

  it('falls back to all three when a GRN predates the checklist', () => {
    // Legacy rows keep the original three-document gate rather than suddenly demanding six.
    expect(requiredGrnDocKeys(undefined)).toEqual(['bill', 'waybill', 'coa']);
    expect(requiredGrnDocKeys({} as never)).toEqual(['bill', 'waybill', 'coa']);
    expect(requiredGrnDocKeys(withChecklist({}))).toEqual(['bill', 'waybill', 'coa']);
  });

  it('treats an all-false checklist as "no data" rather than "nothing required"', () => {
    expect(requiredGrnDocKeys(withChecklist({ invoice: false, coa: false }))).toEqual(['bill', 'waybill', 'coa']);
  });

  it('only blocks on documents that were both ticked and not uploaded', () => {
    const docs = { receipt: { checklist: { invoice: true, coa: true } }, bill: { fileName: 'inv.pdf' } } as never;
    expect(missingRequiredGrnDocs(docs)).toEqual(['coa']);
    expect(requiredGrnDocsError(docs)).toContain('Upload COA');
  });
});
