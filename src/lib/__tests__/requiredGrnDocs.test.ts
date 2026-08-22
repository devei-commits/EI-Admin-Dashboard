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
