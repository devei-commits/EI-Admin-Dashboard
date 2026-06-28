import { describe, expect, it } from 'vitest';
import { deriveAutoPassedFromResult, grnQcVerdictLabel } from '../grnQcAutoPass';
import type { GrnQcTestRow } from '../grnQcSpecs';
import { buildQualityCheckHeaderTitle, buildChecklistVerdict, buildQualityCheckAttachments, buildQualityCheckAttachmentSummary } from '../qualityCheckModalDisplay';

const testRow = (partial: Partial<GrnQcTestRow> = {}): GrnQcTestRow => ({
  specId: '1',
  parameter: 'pH',
  specLimit: '6.5 – 7.5',
  method: 'pH meter',
  mandatory: true,
  tolerance: '',
  frequency: '',
  sample: '',
  acceptance: '',
  result: '',
  passed: null,
  ...partial,
});

describe('grnQcAutoPass', () => {
  it('auto-passes number in range', () => {
    expect(deriveAutoPassedFromResult(testRow({ outputType: 'number-range', result: '7.1' }))).toBe(true);
    expect(deriveAutoPassedFromResult(testRow({ outputType: 'number-range', result: '8.5' }))).toBe(false);
  });

  it('auto-passes pass-fail and select', () => {
    expect(deriveAutoPassedFromResult(testRow({ outputType: 'pass-fail', result: 'Pass' }))).toBe(true);
    expect(deriveAutoPassedFromResult(testRow({ outputType: 'select', result: 'Clear pale-yellow' }))).toBe(true);
    expect(deriveAutoPassedFromResult(testRow({ result: 'pending' }))).toBe(null);
  });

  it('labels verdict', () => {
    expect(grnQcVerdictLabel(true)).toBe('✓ PASS');
    expect(grnQcVerdictLabel(null)).toBe('awaiting');
  });
});

describe('qualityCheckModalDisplay', () => {
  it('builds modal title', () => {
    const title = buildQualityCheckHeaderTitle({
      id: '1',
      grnNo: 'GRN-2026-0304',
      lineItems: [{ item: 'SLES 70%', itemCode: '1000098' }],
    });
    expect(title).toContain('SLES 70%');
    expect(title).toContain('1000098');
  });

  it('builds checklist verdict from auto pass', () => {
    const verdict = buildChecklistVerdict(testRow({ outputType: 'number-range', result: '7.1' }));
    expect(verdict.label).toBe('✓ PASS');
  });

  it('merges GRN docs and QC uploads in attachment list', () => {
    const rows = buildQualityCheckAttachments(
      {
        id: '1',
        grnNo: 'GRN-1',
        sourceDocuments: { coa: { fileName: 'Vendor_COA.pdf', uploadedAt: '2026-06-30T12:08:00' } },
      } as import('../services/grn.service').GRNRecordFromApi,
      {
        lines: [],
        attachments: [
          {
            id: 'a1',
            fileName: 'InHouse_pH.pdf',
            type: 'In-house test',
            uploadedAt: '2026-06-30T15:30:00',
          },
        ],
      },
    );
    expect(rows).toHaveLength(2);
    expect(buildQualityCheckAttachmentSummary(rows)).toContain('In-house test');
  });
});
