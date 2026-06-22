import { describe, expect, it } from 'vitest';
import {
  RM_BULK_FUNCTIONAL_SUB_CATEGORIES,
  normalizeRmDetailSubCategoryForSelect,
  normalizeRmSubSubCategoryForSelect,
  rmDetailSubCategoryHasSubSubCategory,
  rmDetailSubCategoryOptionsForSkuCategory,
  rmSubSubCategoryOptionsForDetailSubCategory,
} from '../../constants/materialMasterSkuRules';

describe('RM sub-sub category', () => {
  it('lists bulk functional categories in catalog order', () => {
    const opts = rmDetailSubCategoryOptionsForSkuCategory('RAW MATERIALS').map((o) => o.value);
    expect(opts).toEqual(Object.keys(RM_BULK_FUNCTIONAL_SUB_CATEGORIES));
  });

  it('exposes surfactant sub-categories', () => {
    expect(rmDetailSubCategoryHasSubSubCategory('SURFACTANTS', 'RAW MATERIALS')).toBe(true);
    expect(rmSubSubCategoryOptionsForDetailSubCategory('SURFACTANTS', 'RAW MATERIALS').map((o) => o.value)).toEqual([
      'ANIONIC',
      'CATIONIC',
      'NON-IONIC',
      'AMPHOTERIC',
    ]);
  });

  it('exposes UV filter sub-categories', () => {
    expect(rmSubSubCategoryOptionsForDetailSubCategory('UV FILTERS', 'RAW MATERIALS').map((o) => o.value)).toContain(
      'UVA'
    );
  });

  it('has no sub-sub for fragrance oil / water soluble tabs', () => {
    expect(normalizeRmDetailSubCategoryForSelect('FRAGRANCES / PERFUMES', 'oil soluble')).toBe('OIL SOLUBLE');
    expect(rmDetailSubCategoryHasSubSubCategory('OIL SOLUBLE', 'FRAGRANCES / PERFUMES')).toBe(false);
    expect(rmSubSubCategoryOptionsForDetailSubCategory('WATER SOLUBLE', 'FRAGRANCES / PERFUMES')).toEqual([]);
  });

  it('normalizes legacy surfactant labels and sub-sub aliases', () => {
    expect(normalizeRmDetailSubCategoryForSelect('RAW MATERIALS', 'surfactants')).toBe('SURFACTANTS');
    expect(normalizeRmSubSubCategoryForSelect('SURFACTANTS', 'non ionic', 'RAW MATERIALS')).toBe('NON-IONIC');
    expect(normalizeRmSubSubCategoryForSelect('PRESERVATIVES', 'phenoxyethanol', 'RAW MATERIALS')).toBe(
      'BROAD SPECTRUM'
    );
    expect(normalizeRmSubSubCategoryForSelect('UV FILTERS', 'uva', 'RAW MATERIALS')).toBe('UVA');
  });
});
