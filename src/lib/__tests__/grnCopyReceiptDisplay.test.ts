import { describe, expect, it } from 'vitest';
import {
  allGrnMatchChecksPass,
  buildGrnCopyDocumentRows,
  buildGrnCopyReceiptHeaderView,
  buildGrnMatchChecks,
  deriveGrnPackRows,
  formatShipmentBatchRef,
  grnReceiptDocumentsLocked,
  initialGrnCopyDocRefs,
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

  it('passes match checks when quantities and docs align', () => {
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
      photoCount: 3,
    });
    expect(allGrnMatchChecksPass(checks)).toBe(true);
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

  it('locks docs in grn-copy after labels exist', () => {
    expect(
      grnReceiptDocumentsLocked('grn-copy', {
        status: 'Under GRN',
        generatedLabels: [{}],
      }),
    ).toBe(true);
  });
});
