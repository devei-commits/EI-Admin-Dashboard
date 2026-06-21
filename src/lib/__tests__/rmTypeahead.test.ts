import { describe, expect, it } from 'vitest';
import { buildRmTypeaheadOptions, filterRmTypeaheadOptions } from '../rmTypeahead';

describe('rmTypeahead', () => {
  it('filters with cap and prebuilt haystack', () => {
    const options = buildRmTypeaheadOptions([
      { id: '1', code: 'RM-A', name: 'Glycerin', inci: 'Glycerin', category: '', rmType: '', uom: 'KG', pricePerKg: 0, gst: 0, shelf: '', leadTimeDays: null, status: '', products: [], group: null, zohoId: null, zohoSkuCode: null, hsnCode: null, taxPref: null, salesPurchaseAccount: null, specificGravity: null },
      { id: '2', code: 'RM-B', name: 'Niacinamide', inci: 'Niacinamide', category: '', rmType: '', uom: 'KG', pricePerKg: 0, gst: 0, shelf: '', leadTimeDays: null, status: '', products: [], group: null, zohoId: null, zohoSkuCode: null, hsnCode: null, taxPref: null, salesPurchaseAccount: null, specificGravity: null },
    ]);
    const hits = filterRmTypeaheadOptions(options, 'gly', 10);
    expect(hits).toHaveLength(1);
    expect(hits[0].code).toBe('RM-A');
  });

  it('appends approval status suffix for non-Active masters', () => {
    const options = buildRmTypeaheadOptions([
      {
        id: '3',
        code: 'RM-C',
        name: 'Beta Glucan',
        inci: 'Beta Glucan',
        category: '',
        rmType: '',
        uom: 'KG',
        pricePerKg: 0,
        gst: 0,
        shelf: '',
        leadTimeDays: null,
        status: 'Under Review',
        products: [],
        group: null,
        zohoId: null,
        zohoSkuCode: null,
        hsnCode: null,
        taxPref: null,
        salesPurchaseAccount: null,
        specificGravity: null,
      },
    ]);
    expect(options[0].label).toContain('[Under Review]');
  });

  it('matches Zoho SKU code in haystack', () => {
    const options = buildRmTypeaheadOptions([
      {
        id: '10',
        code: 'EI-RM-ACT-001',
        name: 'Cucumber Extract',
        inci: 'Cucumber Extract',
        category: '',
        rmType: 'Club Items',
        uom: 'KG',
        pricePerKg: 0,
        gst: 0,
        shelf: '',
        leadTimeDays: null,
        status: '',
        products: [],
        group: null,
        zohoId: null,
        zohoSkuCode: 'CLUB00023',
        hsnCode: null,
        taxPref: null,
        salesPurchaseAccount: null,
        specificGravity: null,
      },
    ]);
    expect(filterRmTypeaheadOptions(options, 'club00023', 10)).toHaveLength(1);
    expect(filterRmTypeaheadOptions(options, 'cucumber', 10)).toHaveLength(1);
  });
});
