import { describe, expect, it } from 'vitest';
import {
  buildInboundGrnTableRowView,
  buildInboundStorageView,
  formatInboundSourceDocSet,
  inboundGrnActionView,
  isInboundGrnRacked,
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
    // IN TRANSIT and LANDED both open the same staged receipt modal, so they share one label —
    // two names for one action read as two separate steps in the GRN flow.
    expect(view.actionLabel).toBe('Confirm Receipt');
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

  it('builds quarantined row with document mismatch', () => {
    const view = buildInboundGrnTableRowView({
      grnNo: 'GRN-2026-0294',
      status: 'On Hold',
      workflowSteps: ['Document-Physical Mismatch', 'Sent to QC'],
      lineItem: { poQty: 5, rcvdQty: 5, unit: 'kg' },
    });
    expect(view.statusLabel).toBe('QUARANTINED');
    expect(view.statusSubLabel).toBe('document-physical mismatch');
    expect(view.actionLabel).toBe('Awaiting QC');
  });

  it('shows Complete GRN when landed, receipt confirmed, docs/labels pending', () => {
    const view = buildInboundGrnTableRowView({
      grnNo: 'GRN-2026-0310',
      status: 'Under GRN',
      grnDate: '2026-06-30T09:14:00.000Z',
      workflowSteps: ['Receipt Confirmed'],
      lineItem: { poQty: 100, rcvdQty: 100, unit: 'kg' },
    });
    expect(view.statusLabel).toBe('LANDED');
    expect(view.actionLabel).toBe('Complete GRN');
    expect(view.actionPrefix).toBe('📦');
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
    // Rack-first: after QC pass the unracked GRN routes to Assign Rack; once a real rack is set,
    // the remaining paperwork (docs + labels + completion) lives in GRN Copy.
    expect(
      inboundGrnActionView({
        grnNo: 'x',
        status: 'On Hold',
        workflowSteps: ['Sent to QC'],
        qcStatus: 'Passed',
      }),
    ).toEqual({
      label: 'Assign Rack',
      prefix: '📍',
    });
    expect(
      inboundGrnActionView({
        grnNo: 'x',
        status: 'On Hold',
        workflowSteps: ['Sent to QC', 'Label Generation'],
        qcStatus: 'Passed',
        generatedLabels: [{}],
        locationPrefix: 'SW-R1',
        assignedTo: 'Bhaskar',
      }),
    ).toEqual({
      label: 'GRN Copy',
      prefix: '📋',
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

  // GRN-2026-0186: a rack was saved but "Assigned To" was left "Unassigned", which permanently
  // blocked GRN Copy's completion check (it requires assignedTo). The row must keep offering
  // Assign Rack in that state — routing to GRN Copy here would strand the operator with no way
  // back to the field that's actually missing.
  it('keeps offering Assign Rack when a rack is set but no assignee yet', () => {
    expect(
      inboundGrnActionView({
        grnNo: 'x',
        status: 'On Hold',
        workflowSteps: ['Sent to QC', 'Label Generation'],
        qcStatus: 'Passed',
        generatedLabels: [{}],
        locationPrefix: 'SW-R1',
        assignedTo: '',
      }),
    ).toEqual({
      label: 'Assign Rack',
      prefix: '📍',
    });
  });

  it('shows Send to QC for quarantined GRN not yet sent', () => {
    expect(inboundGrnActionView({ grnNo: 'x', status: 'On Hold' })).toEqual({
      label: 'Send to QC',
      prefix: '🚦',
    });
  });

  it('shows Send to QC when verified with labels', () => {
    const view = buildInboundGrnTableRowView({
      grnNo: 'GRN-2026-0310',
      status: 'Verified',
      grnDate: '2026-06-30T09:14:00.000Z',
      workflowSteps: ['PO Received', 'Qty Check', 'Label Generation'],
      generatedLabels: [{}],
      lineItem: { poQty: 100, rcvdQty: 100, unit: 'kg' },
    });
    expect(view.statusLabel).toBe('VERIFIED');
    expect(view.actionLabel).toBe('Send to QC');
    expect(view.actionPrefix).toBe('🚦');
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

  it('shows Assign Rack when QC passed but no rack assigned yet (rack-first)', () => {
    const view = buildInboundGrnTableRowView({
      grnNo: 'GRN-2026-0312',
      status: 'Under GRN',
      grnDate: '2026-06-30T09:14:00.000Z',
      qcStatus: 'Passed',
      lineItem: { poQty: 100, rcvdQty: 100, unit: 'kg', qcStatus: 'Pass' },
    });
    expect(view.statusLabel).toBe('QC TESTED · PASS');
    expect(view.actionLabel).toBe('Assign Rack');
    expect(view.actionPrefix).toBe('📍');
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

describe('isInboundGrnRacked — a rack literally named DEFAULT still counts', () => {
  /**
   * GRN-2026-0197 exactly as stored after Assign Rack: the user picked "DEFAULT — Default storage"
   * from Facility Management, an assignee is set, one post-racking photo is saved. The old check
   * read the code `DEFAULT` as an auto-placeholder, so the row offered Assign Rack forever and
   * saving again could never change the answer.
   */
  const racked0197 = {
    grnNo: 'GRN-2026-0197',
    status: 'Under GRN',
    qcStatus: 'Passed',
    assignedTo: 'Admin User',
    locationPrefix: 'DEFAULT',
    locationZone: 'Default',
    receivedDate: '2026-08-28',
    grnDate: '2026-08-27',
    workflowSteps: [
      'Receipt Confirmed', 'Sent to QC', 'PO Received', 'Qty Check', 'QC Inspection', 'Rack Assigned',
    ],
    sourceDocuments: {
      postRackingPhotos: { byRack: { DEFAULT: { photoCount: 1, updatedAt: '2026-08-27T20:47:10.767Z' } } },
    },
  };

  it('counts the Rack Assigned stamp as proof, whatever the rack is called', () => {
    expect(isInboundGrnRacked(racked0197)).toBe(true);
  });

  it('moves the row on to GRN Copy instead of looping back to Assign Rack', () => {
    expect(inboundGrnActionView(racked0197).label).toBe('GRN Copy');
  });

  it('counts saved post-racking photos when the step stamp is missing', () => {
    // Rows racked before the stamp existed still carry their mandatory photos.
    const noStamp = { ...racked0197, workflowSteps: ['Receipt Confirmed', 'Sent to QC'] };
    expect(isInboundGrnRacked(noStamp)).toBe(true);
    expect(inboundGrnActionView(noStamp).label).toBe('GRN Copy');
  });

  it('still treats a bare DEFAULT with no stamp and no photos as unracked', () => {
    // The legacy placeholder case the original rule was written for — kept working.
    const placeholder = {
      ...racked0197,
      workflowSteps: ['Receipt Confirmed', 'Sent to QC'],
      sourceDocuments: {},
    };
    expect(isInboundGrnRacked(placeholder)).toBe(false);
    expect(inboundGrnActionView(placeholder).label).toBe('Assign Rack');
  });

  it('accepts a normal named rack as before', () => {
    const named = { ...racked0197, workflowSteps: [], sourceDocuments: {}, locationPrefix: 'A-01-03' };
    expect(isInboundGrnRacked(named)).toBe(true);
  });

  it('needs an assignee — GRN Copy cannot complete a GRN without one', () => {
    expect(isInboundGrnRacked({ ...racked0197, assignedTo: '' })).toBe(false);
    expect(inboundGrnActionView({ ...racked0197, assignedTo: '' }).label).toBe('Assign Rack');
  });

  it('needs a rack code at all', () => {
    expect(isInboundGrnRacked({ ...racked0197, locationPrefix: '' })).toBe(false);
  });

  it('ignores a photos record that holds no photos', () => {
    const zeroPhotos = {
      ...racked0197,
      workflowSteps: ['Receipt Confirmed'],
      sourceDocuments: { postRackingPhotos: { byRack: { DEFAULT: { photoCount: 0, updatedAt: 'x' } } } },
    };
    expect(isInboundGrnRacked(zeroPhotos)).toBe(false);
  });
});
