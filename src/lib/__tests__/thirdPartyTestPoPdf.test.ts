import { describe, expect, it } from 'vitest';
import { buildThirdPartyPoPreviewInput } from '../thirdPartyLabTest';
import { generateThirdPartyTestPoPdf } from '../thirdPartyTestPoPdf';

describe('thirdPartyTestPoPdf', () => {
  it('builds preview input and generates a PDF without throwing', () => {
    const input = buildThirdPartyPoPreviewInput({
      poNo: 'PO-3P-2026-0042',
      qcRef: 'QC-2026-0145',
      grnNo: 'GRN-2026-0304',
      vendorName: 'Eurofins Analytical Services',
      vendorCode: 'V-061',
      vendorCity: 'Bangalore',
      itemCode: '1000098',
      itemName: 'SLES 70%',
      testParameter: 'Microbial Count (TVC)',
      testMethod: 'External lab · Plate count, 3rd-party NABL',
      specLimit: '< 100 cfu/g',
      sampleQty: 2,
      sampleNote: '100 g each from drum 1 & 4',
      pricePerSample: 1800,
      pickupDate: '2026-07-01',
      expectedReportDate: '2026-07-06',
      paymentTerms: 'Net 30',
      warehouseLabel: 'MW',
    });

    expect(input.poNo).toBe('PO-3P-2026-0042');
    expect(() => generateThirdPartyTestPoPdf(input)).not.toThrow();
  });
});
