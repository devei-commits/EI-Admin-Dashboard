import { describe, expect, it } from 'vitest';
import {
  allGrnCoreMatchChecksPass,
  allGrnMatchChecksPass,
  allGrnReceiptChecksPass,
  buildGrnCopyDocumentRows,
  buildGrnCopyReceiptHeaderView,
  buildGrnMatchChecks,
  deriveGrnPackRows,
  formatShipmentBatchRef,
  grnReceiptDocumentsLocked,
  grnReceiptPrerequisitesMet,
  initialGrnCopyDocRefs,
  missingRequiredGrnDocs,
  requiredGrnDocsError,
  resolveGrnExistingLabels,
} from '../grnCopyReceiptDisplay';

describe('grnCopyReceiptDisplay', () => {
  it('formats shipment batch ref from PO', () => {
    expect(formatShipmentBatchRef('PO-2026-0350')).toBe('SB-2026-0350');
  });

  it('derives eight equal packs for 200 kg', () => {
    const rows = deriveGrnPackRows({ rcvdQty: 200, noOfBoxes: 8, unit: 'kg' });
    expect(rows).toHaveLength(8);
    expect(rows[0]?.declaredQty).toBe(25);
    expect(rows.reduce((s, r) => s + r.declaredQty, 0)).toBe(200);
  });

  it('builds document rows from source documents', () => {
    const rows = buildGrnCopyDocumentRows(
      {
        grnNo: 'GRN-1',
        sourceDocuments: {
          bill: { ref: 'GS/JUN/8825', fileName: 'GS_INV_8825.pdf' },
          waybill: { ref: 'EWB-271-9931', fileName: 'EWB_271_9931.pdf' },
          coa: { fileName: 'GS_COA_BATCH_44.pdf' },
        },
      },
    );
    expect(rows[0]?.refValue).toBe('GS/JUN/8825');
    expect(rows[1]?.uploaded).toBe(true);
    expect(rows[3]?.docType).toContain('COA');
  });

  it('builds header view with warehouse', () => {
    const view = buildGrnCopyReceiptHeaderView({
      grnNo: 'GRN-2026-0304',
      poNo: 'PO-2026-0350',
      vendor: 'Galaxy Surfactants',
      vendorCode: 'V-024',
      lineItem: { item: 'SLES 70%', itemCode: '1000098' },
    });
    expect(view.itemTitle).toBe('SLES 70% · 1000098');
    expect(view.shipmentBatchRef).toBe('SB-2026-0350');
    expect(view.vendorLine).toContain('V-024');
  });

  it('detects core mismatch when billed qty differs from PO', () => {
    const packRows = deriveGrnPackRows({ rcvdQty: 200, noOfBoxes: 8, unit: 'kg' });
    const documentRows = buildGrnCopyDocumentRows({
      grnNo: 'GRN-1',
      sourceDocuments: {
        bill: { fileName: 'inv.pdf' },
        waybill: { fileName: 'ewb.pdf' },
        coa: { fileName: 'coa.pdf' },
      },
      lineItem: { poQty: 200, rcvdQty: 200, invoiceQty: 200, unitPrice: 298, unit: 'kg' },
    });
    const checks = buildGrnMatchChecks({
      grn: { grnNo: 'GRN-1', lineItem: { poQty: 200, rcvdQty: 200, invoiceQty: 200, unitPrice: 298, unit: 'kg' } },
      packRows,
      documentRows,
      photoCount: 2,
      billedQty: 190,
      verifiedUnitPrice: 298,
    });
    expect(allGrnCoreMatchChecksPass(checks)).toBe(false);
    expect(grnReceiptPrerequisitesMet(checks)).toBe(true);
    expect(allGrnReceiptChecksPass(checks)).toBe(false);
  });

  it('resolveGrnExistingLabels reads GRN-level and line-level labels', () => {
    expect(
      resolveGrnExistingLabels({
        generatedLabels: [{ boxIndex: 1 }],
        lineItem: { itemCode: '1000020' },
      }),
    ).toHaveLength(1);
    expect(
      resolveGrnExistingLabels({
        lineItems: [{ itemCode: '1000020', generatedLabels: [{ boxIndex: 1 }, { boxIndex: 2 }] }],
        lineItem: { itemCode: '1000020' },
      }),
    ).toHaveLength(2);
    expect(
      resolveGrnExistingLabels({
        lineItem: { itemCode: '1000020' },
      }),
    ).toHaveLength(0);
  });

  it('marks QR label row pass when labels on file', () => {
    const checks = buildGrnMatchChecks({
      grn: { grnNo: 'GRN-1', lineItem: { poQty: 36, rcvdQty: 36, unit: 'kg' } },
      packRows: deriveGrnPackRows({ rcvdQty: 36, noOfBoxes: 1, unit: 'kg' }),
      documentRows: buildGrnCopyDocumentRows({ grnNo: 'GRN-1' }),
      photoCount: 0,
      existingLabelCount: 1,
    });
    const labelRow = checks.find((c) => c.label.startsWith('QR labels'));
    expect(labelRow?.pass).toBe(true);
  });

  it('seeds bill ref from invoice on init only', () => {
    expect(initialGrnCopyDocRefs(null, 'INV-8825')).toEqual({
      bill: 'INV-8825',
      waybill: '',
      lr: '',
    });
  });

  it('never locks docs during confirm receipt', () => {
    expect(
      grnReceiptDocumentsLocked('confirm-receipt', {
        status: 'Under GRN',
        generatedLabels: [{}],
      }),
    ).toBe(false);
  });

  it('does not lock grn-copy when labels exist but receipt docs are incomplete', () => {
    expect(
      grnReceiptDocumentsLocked('grn-copy', {
        status: 'Under GRN',
        generatedLabels: [{}],
        sourceDocuments: {},
      }),
    ).toBe(false);
  });

  it('locks grn-copy when receipt docs are complete and labels exist', () => {
    expect(
      grnReceiptDocumentsLocked('grn-copy', {
        status: 'Under GRN',
        generatedLabels: [{}],
        sourceDocuments: {
          bill: { fileName: 'inv.pdf' },
          waybill: { fileName: 'ewb.pdf' },
          coa: { fileName: 'coa.pdf' },
        },
      }),
    ).toBe(true);
  });

  describe('missingRequiredGrnDocs', () => {
    it('only requires docs whose checklist box was ticked at Confirm Receipt', () => {
      // Invoice and COA were ticked but no E-Way Bill came with this shipment — the E-Way Bill
      // upload must not be demanded for a document that was never physically received.
      const missing = missingRequiredGrnDocs({
        receipt: { checklist: { invoice: true, coa: true } },
      });
      expect(missing).toEqual(['bill', 'coa']);
    });

    it('drops a doc from the missing list once it is both ticked and uploaded', () => {
      const missing = missingRequiredGrnDocs({
        receipt: { checklist: { invoice: true, coa: true } },
        bill: { fileName: 'inv.pdf' },
      });
      expect(missing).toEqual(['coa']);
    });

    it('requires nothing when the checklist has no bill/waybill/coa items ticked', () => {
      // Only MSDS + Weighment Slip were ticked — this GRN's shipment never carried an invoice,
      // e-way bill, or COA, so nothing should block it.
      const missing = missingRequiredGrnDocs({
        receipt: { checklist: { msds: true, weighmentSlip: true } },
      });
      expect(missing).toEqual([]);
    });

    it('falls back to requiring all three when there is no checklist at all (legacy GRN)', () => {
      const missing = missingRequiredGrnDocs({});
      expect(missing).toEqual(['bill', 'waybill', 'coa']);
    });
  });

  describe('requiredGrnDocsError', () => {
    it('names only the checklist-ticked docs still missing a file', () => {
      const error = requiredGrnDocsError({
        receipt: { checklist: { ewayBill: true } },
      });
      expect(error).toContain('E-Way Bill');
      expect(error).not.toContain('Tax Invoice');
      expect(error).not.toContain('COA');
    });

    it('returns null once every checklist-ticked doc is uploaded', () => {
      const error = requiredGrnDocsError({
        receipt: { checklist: { invoice: true } },
        bill: { fileName: 'inv.pdf' },
      });
      expect(error).toBeNull();
    });
  });
});
