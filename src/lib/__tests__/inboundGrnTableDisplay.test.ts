import { describe, expect, it } from 'vitest';
import {
  buildInboundGrnTableRowView,
  buildInboundStorageView,
  formatInboundSourceDocSet,
  inboundGrnActionView,
} from '../inboundGrnTableDisplay';

describe('inboundGrnTableDisplay', () => {
  it('builds in-transit row view', () => {
    const view = buildInboundGrnTableRowView({
      grnNo: 'GRN-2026-0301',
      status: 'In Transit',
      expectedDate: '2026-06-26',
      lineItem: { item: 'Glycerin', itemCode: '1000045', poQty: 100, rcvdQty: 100, unit: 'kg' },
      lineItemsCount: 1,
    });
    expect(view.statusLabel).toBe('IN TRANSIT');
    expect(view.storagePrimary).toBe('— (pre-rack)');
    expect(view.slaLabel).toContain('ETA 26-Jun');
    expect(view.actionLabel).toBe('Confirm');
    expect(view.actionPrefix).toBe('✓');
  });

  it('builds landed row view', () => {
    const view = buildInboundGrnTableRowView({
      grnNo: 'GRN-2026-0304',
      status: 'Under GRN',
      grnDate: '2026-06-30T09:14:00.000Z',
      receiptSource: 'po',
      sourceDocuments: {
        bill: { fileName: 'bill.pdf' },
        waybill: { ref: 'WB-001' },
        lr: { ref: 'LR-001' },
        coa: { fileName: 'coa.pdf' },
      },
      lineItem: { item: 'SLES 70%', itemCode: '1000098', poQty: 200, rcvdQty: 200, unit: 'kg' },
      lineItemsCount: 3,
    });
    expect(view.statusLabel).toBe('LANDED');
    expect(view.storagePrimary).toBe('— pending rack');
    expect(view.sourceDocs).toBe('4 of 4 docs uploaded ✓');
    expect(view.sourceDocsHint).toBe('Bill + Waybill + LR + COA');
    expect(view.relatedPrimary).toContain('2 siblings');
    expect(view.actionLabel).toBe('Confirm Receipt');
    expect(view.actionPrefix).toBe('✓');
  });

  it('builds rack + batch storage lines', () => {
    const storage = buildInboundStorageView({
      grnNo: 'GRN-2026-0298',
      status: 'Under GRN',
      locationPrefix: 'D08-A1',
      noOfBoxes: 6,
      unitsPerBox: 500,
      grnBatchMfg: 'GB-2026-0028',
      lineItem: { unit: 'pcs' },
    });
    expect(storage.primary).toContain('Rack-D08-A1');
    expect(storage.secondary).toBe('GB-2026-0028');
  });

  it('builds quarantined row with mismatch', () => {
    const view = buildInboundGrnTableRowView({
      grnNo: 'GRN-2026-0294',
      status: 'On Hold',
      lineItem: { poQty: 5, rcvdQty: 4.8, unit: 'kg', diff: -0.2 },
    });
    expect(view.statusLabel).toBe('QUARANTINED');
    expect(view.statusSubLabel).toContain('qty mismatch');
    expect(inboundGrnActionView({ grnNo: 'x', status: 'On Hold' })).toEqual({
      label: 'Send to QC',
      prefix: '🚦',
    });
  });

  it('shows GRN Copy when landed and receipt confirmed', () => {
    const view = buildInboundGrnTableRowView({
      grnNo: 'GRN-2026-0310',
      status: 'Under GRN',
      grnDate: '2026-06-30T09:14:00.000Z',
      workflowSteps: ['Receipt Confirmed'],
      lineItem: { poQty: 100, rcvdQty: 100, unit: 'kg' },
    });
    expect(view.statusLabel).toBe('LANDED');
    expect(view.actionLabel).toBe('GRN Copy');
    expect(view.actionPrefix).toBe('📋');
  });

  it('shows QC Check after QC complete and Assign Rack when passed', () => {
    expect(
      inboundGrnActionView({
        grnNo: 'x',
        status: 'On Hold',
        workflowSteps: ['Sent to QC'],
      }),
    ).toEqual({
      label: 'Awaiting QC',
      prefix: '⏳',
    });
    expect(
      inboundGrnActionView({
        grnNo: 'x',
        status: 'On Hold',
        workflowSteps: ['Sent to QC'],
        qcStatus: 'Rejected',
      }),
    ).toEqual({
      label: 'QC Check',
      prefix: '🧪',
    });
    expect(
      inboundGrnActionView({
        grnNo: 'x',
        status: 'On Hold',
        workflowSteps: ['Sent to QC'],
        qcStatus: 'Passed',
      }),
    ).toEqual({
      label: 'GRN Copy',
      prefix: '📋',
    });
    expect(
      inboundGrnActionView({
        grnNo: 'x',
        status: 'On Hold',
        workflowSteps: ['Sent to QC', 'Label Generation'],
        qcStatus: 'Passed',
        generatedLabels: [{}],
      }),
    ).toEqual({
      label: 'Assign Rack',
      prefix: '📍',
    });
    expect(
      inboundGrnActionView({
        grnNo: 'x',
        status: 'On Hold',
        workflowSteps: ['Sent to QC', 'QC Report Sent'],
      }),
    ).toEqual({
      label: 'QC Check',
      prefix: '🧪',
    });
  });

  it('shows GRN Copy when verified', () => {
    const view = buildInboundGrnTableRowView({
      grnNo: 'GRN-2026-0310',
      status: 'Verified',
      grnDate: '2026-06-30T09:14:00.000Z',
      workflowSteps: ['PO Received', 'Qty Check', 'Label Generation'],
      generatedLabels: [{}],
      lineItem: { poQty: 100, rcvdQty: 100, unit: 'kg' },
    });
    expect(view.statusLabel).toBe('VERIFIED');
    expect(view.actionLabel).toBe('GRN Copy');
    expect(view.actionPrefix).toBe('📋');
  });

  it('shows Assign Rack when QC passed and GRN Copy labels exist', () => {
    const view = buildInboundGrnTableRowView({
      grnNo: 'GRN-2026-0311',
      status: 'Under GRN',
      grnDate: '2026-06-30T09:14:00.000Z',
      qcStatus: 'Passed',
      workflowSteps: ['Label Generation'],
      generatedLabels: [{}],
      lineItem: { poQty: 100, rcvdQty: 100, unit: 'kg', qcStatus: 'Pass' },
    });
    expect(view.statusLabel).toBe('QC TESTED · PASS');
    expect(view.actionLabel).toBe('Assign Rack');
    expect(view.actionPrefix).toBe('📍');
  });

  it('shows GRN Copy when QC passed but labels not generated yet', () => {
    const view = buildInboundGrnTableRowView({
      grnNo: 'GRN-2026-0312',
      status: 'Under GRN',
      grnDate: '2026-06-30T09:14:00.000Z',
      qcStatus: 'Passed',
      lineItem: { poQty: 100, rcvdQty: 100, unit: 'kg', qcStatus: 'Pass' },
    });
    expect(view.statusLabel).toBe('QC TESTED · PASS');
    expect(view.actionLabel).toBe('GRN Copy');
    expect(view.actionPrefix).toBe('📋');
  });

  it('counts partial source docs', () => {
    expect(
      formatInboundSourceDocSet({
        grnNo: 'G1',
        receiptSource: 'po',
        invoiceNo: 'INV-1',
        lineItem: { rcvdQty: 10 },
      }).label,
    ).toBe('1 of 4 docs uploaded');
  });
});
