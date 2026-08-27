import { describe, expect, it } from 'vitest';
import { deriveAutoPassedFromResult, grnQcVerdictLabel, isThirdPartyQcTest } from '../grnQcAutoPass';
import type { GrnQcTestRow } from '../grnQcSpecs';
import { buildQualityCheckHeaderTitle, buildChecklistVerdict, buildQualityCheckAttachments, buildQualityCheckAttachmentSummary, thirdPartyActionLabel } from '../qualityCheckModalDisplay';

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
    // The fixture's spec is the numeric range "6.5 – 7.5", so a descriptive answer is not a
    // measurement and cannot be judged — it is awaiting, which blocks completion rather than
    // passing an unverifiable entry. With a descriptive spec the select still auto-passes.
    expect(deriveAutoPassedFromResult(testRow({ outputType: 'select', result: 'Clear pale-yellow' }))).toBe(null);
    expect(
      deriveAutoPassedFromResult(
        testRow({ outputType: 'select', specLimit: 'Clear pale-yellow', result: 'Clear pale-yellow' }),
      ),
    ).toBe(true);
    expect(deriveAutoPassedFromResult(testRow({ result: 'pending' }))).toBe(null);
  });

  it('labels verdict', () => {
    expect(grnQcVerdictLabel(true)).toBe('✓ PASS');
    expect(grnQcVerdictLabel(null)).toBe('awaiting');
  });

  it('detects third-party tests from method, acceptance, frequency, or spec id', () => {
    expect(isThirdPartyQcTest(testRow({ method: 'External lab · NABL' }))).toBe(true);
    expect(isThirdPartyQcTest(testRow({ acceptance: '3rd-party lab COA required' }))).toBe(true);
    expect(isThirdPartyQcTest(testRow({ specId: 'default-inbound-3rd-party-microbial' }))).toBe(true);
    expect(isThirdPartyQcTest(testRow({ method: 'Visual', parameter: 'Visual check' }))).toBe(false);
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

  it('shows awaiting label when 3rd-party PO is pending', () => {
    const label = thirdPartyActionLabel({
      method: 'External lab · NABL',
      acceptance: 'PO-3P-2026-0042',
      result: 'pending',
    });
    expect(label).toContain('awaiting');
    expect(label).not.toContain('Trigger');
  });
});
