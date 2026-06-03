import { describe, expect, it } from 'vitest';
import { isClubItemsRawMaterial } from '../rmClubItems';
import type { RawMaterialRecord } from '../../services/rawMaterials.service';

const base: RawMaterialRecord = {
  id: '1',
  code: 'EI-RM-ACT-001',
  name: 'Cucumber',
  inci: 'Cucumber',
  category: 'Actives',
  rmType: '',
  uom: 'KG',
  pricePerKg: 0,
  gst: 0,
  shelf: '',
  leadTimeDays: null,
  status: '',
  products: [],
  group: null,
  zohoId: null,
  zohoSkuCode: null,
  hsnCode: null,
  taxPref: null,
  salesPurchaseAccount: null,
  specificGravity: null,
};

describe('isClubItemsRawMaterial', () => {
  it('detects Club Items via group/category', () => {
    expect(isClubItemsRawMaterial({ ...base, group: 'Club Items' })).toBe(true);
    expect(isClubItemsRawMaterial({ ...base, category: 'club items' })).toBe(true);
  });

  it('detects Club Items via Zoho SKU prefix', () => {
    expect(isClubItemsRawMaterial({ ...base, zohoSkuCode: 'CLUB00023' })).toBe(true);
  });

  it('detects Club Items via internal CLUB code', () => {
    expect(isClubItemsRawMaterial({ ...base, code: 'CLUB00012' })).toBe(true);
  });

  it('rejects non-club bulk RM', () => {
    expect(isClubItemsRawMaterial({ ...base, category: 'Bulk raw materials', rmType: 'Surfactant' })).toBe(false);
  });
});
