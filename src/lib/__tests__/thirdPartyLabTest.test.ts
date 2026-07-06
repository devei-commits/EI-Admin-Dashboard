import { describe, expect, it } from 'vitest';
import {
  buildQcReferenceNo,
  buildThirdPartyPoPreview,
  canTriggerThirdPartyTest,
  filterLabVendorsForTest,
  formatInr,
  formatThirdPartySampleQtyLine,
  isLabVendorCategory,
  isThirdPartyResultPending,
  labVendorMatchesTest,
  mergeLabVendorOptions,
  resolveThirdPartyQcAction,
} from '../thirdPartyLabTest';
import { STATIC_THIRD_PARTY_LAB_VENDORS } from '../../constants/thirdPartyLabVendorsStatic';
import type { GrnQcTestRow } from '../grnQcSpecs';

const thirdPartyTest = (partial: Partial<GrnQcTestRow> = {}): GrnQcTestRow => ({
  specId: '1',
  parameter: 'Microbial Count (TVC)',
  specLimit: '< 100 cfu/g',
  method: 'External lab · Plate count, NABL',
  mandatory: true,
  tolerance: '',
  frequency: '',
  sample: '2 samples',
  acceptance: '',
  result: '',
  passed: null,
  ...partial,
});

describe('thirdPartyLabTest', () => {
  it('detects lab vendor categories', () => {
    expect(isLabVendorCategory('Lab / Testing')).toBe(true);
    expect(isLabVendorCategory('3rd-party-lab')).toBe(true);
    expect(isLabVendorCategory('RM Vendor')).toBe(false);
  });

  it('filters vendors by NABL accreditation for microbial tests', () => {
    const vendors = mergeLabVendorOptions(STATIC_THIRD_PARTY_LAB_VENDORS);
    const filtered = filterLabVendorsForTest(vendors, thirdPartyTest());
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((v) => labVendorMatchesTest(v, thirdPartyTest()))).toBe(true);
  });

  it('builds QC reference from GRN number', () => {
    expect(buildQcReferenceNo('GRN-2026-0304', 'abc')).toBe('QC-2026-0304');
  });

  it('formats sample qty without duplicating sample count', () => {
    expect(formatThirdPartySampleQtyLine(2, '2 samples × 100 g')).toBe('2 samples × 100 g');
    expect(formatThirdPartySampleQtyLine(2, '100 g each from drum 1 & 4')).toBe(
      '2 samples × 100 g each from drum 1 & 4',
    );
  });

  it('builds PO preview with item and test lines', () => {
    const preview = buildThirdPartyPoPreview({
      poNo: 'PO-3P-2026-0042',
      poDate: new Date('2026-06-30'),
      qcRef: 'QC-2026-0145',
      grnNo: 'GRN-2026-0304',
      vendorName: 'Eurofins Analytical Services',
      vendorCode: 'V-061',
      vendorCity: 'Bangalore',
      itemCode: '1000098',
      itemName: 'SLES 70%',
      testParameter: 'Microbial Count (TVC)',
      testMethod: 'Plate count, NABL-accredited method',
      specLimit: '< 100 cfu/g',
      sampleQty: 2,
      sampleNote: '100 g each from drum 1 & 4',
      pricePerSample: 1800,
      pickupDate: '2026-07-01',
      expectedReportDate: '2026-07-06',
      paymentTerms: 'Net 30',
      warehouseLabel: 'MW (Main Warehouse)',
      materialVendor: 'Galaxy V-024',
    });
    expect(preview).toContain('PO-3P-2026-0042');
    expect(preview).toContain('SLES 70%');
    expect(preview).toContain('Microbial Count (TVC)');
    expect(formatInr(1800)).toBe('₹1,800');
  });

  it('blocks new trigger when PO is released and result pending', () => {
    const test = thirdPartyTest({ acceptance: 'PO-3P-2026-0042', result: 'pending' });
    expect(canTriggerThirdPartyTest(test)).toBe(false);
    expect(isThirdPartyResultPending(test)).toBe(true);
    expect(resolveThirdPartyQcAction(test)?.mode).toBe('view');
    expect(resolveThirdPartyQcAction(test)?.label).toContain('awaiting');
  });

  it('allows trigger only before PO release', () => {
    const test = thirdPartyTest();
    expect(canTriggerThirdPartyTest(test)).toBe(true);
    expect(resolveThirdPartyQcAction(test)?.mode).toBe('trigger');
  });
});
