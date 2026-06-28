import { describe, expect, it } from 'vitest';
import {
  countInboundSourceDocsUploaded,
  formatInboundSourceDocChip,
  inboundSourceDocRequirementLabel,
} from '../inboundGrnSourceDocs';

describe('inboundGrnSourceDocs', () => {
  it('describes PO requirements', () => {
    expect(inboundSourceDocRequirementLabel('po')).toBe('Bill + Waybill + LR + COA');
  });

  it('describes transfer requirements', () => {
    expect(inboundSourceDocRequirementLabel('transfer')).toBe('TO# ref + Dispatch label scans');
  });

  it('counts PO uploads from sourceDocuments', () => {
    const count = countInboundSourceDocsUploaded({
      receiptSource: 'po',
      sourceDocuments: {
        bill: { fileName: 'bill.pdf' },
        waybill: { ref: 'WB-001' },
      },
    });
    expect(count.uploaded).toBe(2);
    expect(count.required).toBe(4);
    expect(count.complete).toBe(false);
  });

  it('falls back to invoice for PO bill', () => {
    const chip = formatInboundSourceDocChip({
      receiptSource: 'po',
      invoiceNo: 'INV-88',
    });
    expect(chip.label).toBe('1 of 4 docs uploaded');
  });

  it('formats return doc chip', () => {
    const chip = formatInboundSourceDocChip({
      receiptSource: 'return',
      sourceDocuments: {
        credit_note: { ref: 'CN-2026-001' },
        debit_note: { ref: 'DN-2026-001' },
      },
    });
    expect(chip.label).toBe('2 of 2 docs uploaded ✓');
    expect(chip.requiredLabel).toBe('Credit Note + Debit Note');
  });
});
