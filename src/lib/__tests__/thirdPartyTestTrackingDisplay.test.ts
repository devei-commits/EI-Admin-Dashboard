import { describe, expect, it } from 'vitest';
import {
  extractThirdPartyTrackingRows,
  resolveThirdPartyPoStatus,
  resolveThirdPartyTrackingAction,
  summarizeThirdPartyTracking,
} from '../thirdPartyTestTrackingDisplay';
import type { GRNRecordFromApi } from '../../services/grn.service';

const grnWithThirdPartyPo = (): GRNRecordFromApi =>
  ({
    id: 'g1',
    grnNo: 'GRN-2026-0304',
    poNo: 'PO-1',
    vendor: 'Galaxy',
    type: 'RM',
    items: 1,
    poValue: 0,
    expectedDate: '',
    receivedDate: '2026-06-30',
    assignedTo: '',
    qcStatus: 'Pending',
    qcBy: '',
    status: 'On Hold',
    grnDate: '2026-06-30',
    qcSpecs: {
      lines: [
        {
          lineItemId: 'li-1',
          itemCode: '1000098',
          itemName: 'SLES 70%',
          masterType: 'RM',
          masterId: null,
          tests: [
            {
              specId: 'tp-1',
              parameter: 'Microbial Count (TVC)',
              specLimit: '< 100 cfu/g',
              method: 'External lab · 3rd-party NABL',
              mandatory: true,
              tolerance: '',
              frequency: '',
              sample: '2 samples',
              acceptance: 'PO-3P-2026-0042',
              result: 'pending',
              passed: null,
              thirdPartyOrder: {
                poNo: 'PO-3P-2026-0042',
                poDate: '2026-06-30T10:00:00.000Z',
                labVendorName: 'Eurofins Analytical Services',
                labVendorCode: 'V-061',
                samplePickupDate: '2026-07-01',
                expectedReportDate: '2026-07-06',
                status: 'SAMPLE PICKED',
              },
            },
          ],
        },
      ],
    },
  }) as GRNRecordFromApi;

describe('thirdPartyTestTrackingDisplay', () => {
  it('extracts tracking rows for released 3rd-party POs', () => {
    const rows = extractThirdPartyTrackingRows([grnWithThirdPartyPo()], Date.parse('2026-07-02'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.poNo).toBe('PO-3P-2026-0042');
    expect(rows[0]?.labVendorDisplay).toContain('Eurofins');
    expect(rows[0]?.qcRef).toBe('QC-2026-0304');
    expect(rows[0]?.samplePhotoOk).toBe(false);
    expect(rows[0]?.poStatus).toBe('PO RELEASED');
    expect(resolveThirdPartyTrackingAction(rows[0]!)).toBe('upload-sample');
  });

  it('does not mark sample photo from unrelated GRN attachments', () => {
    const grn = grnWithThirdPartyPo();
    grn.qcSpecs = {
      ...grn.qcSpecs!,
      attachments: [{ id: 'a1', fileName: 'other.jpg', type: 'Sample photo', uploadedAt: '2026-07-01' }],
    };
    const rows = extractThirdPartyTrackingRows([grn], Date.parse('2026-07-02'));
    expect(rows[0]?.samplePhotoOk).toBe(false);
  });

  it('progresses to IN LAB after per-PO sample photo upload', () => {
    const order = grnWithThirdPartyPo().qcSpecs!.lines[0]!.tests[0]!.thirdPartyOrder!;
    const status = resolveThirdPartyPoStatus(
      { ...grnWithThirdPartyPo().qcSpecs!.lines[0]!.tests[0]!, result: 'pending' },
      { ...order, samplePhotoUploaded: true },
      true,
      false,
      Date.parse('2026-07-02'),
    );
    expect(status).toBe('IN LAB');
  });

  it('summarizes active, in-lab, and overdue counts', () => {
    const rows = extractThirdPartyTrackingRows([grnWithThirdPartyPo()], Date.parse('2026-07-10'));
    const summary = summarizeThirdPartyTracking(rows);
    expect(summary.active).toBe(1);
    expect(summary.inLab).toBe(0);
    expect(summary.overdue).toBe(1);
  });
});
