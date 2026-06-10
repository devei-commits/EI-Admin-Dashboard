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
    const opts = rmDetailSubCategoryOptionsForSkuCategory('Bulk raw materials').map((o) => o.value);
    expect(opts).toEqual(Object.keys(RM_BULK_FUNCTIONAL_SUB_CATEGORIES));
  });

  it('exposes surfactant sub-categories', () => {
    expect(rmDetailSubCategoryHasSubSubCategory('Surfactant')).toBe(true);
    expect(rmSubSubCategoryOptionsForDetailSubCategory('Surfactant').map((o) => o.value)).toEqual([
      'Anionic',
      'Non-ionic',
      'Amphoteric',
      'Cationic',
    ]);
  });

  it('exposes active sub-categories including UV Filter', () => {
    expect(rmSubSubCategoryOptionsForDetailSubCategory('Active').map((o) => o.value)).toContain('UV Filter');
  });

  it('has no sub-sub for fragrance oil / water soluble SKU tabs', () => {
    expect(normalizeRmDetailSubCategoryForSelect('Fragrance', 'oil soluble')).toBe('Oil soluble');
    expect(rmDetailSubCategoryHasSubSubCategory('Oil soluble')).toBe(false);
    expect(rmSubSubCategoryOptionsForDetailSubCategory('Water soluble')).toEqual([]);
  });

  it('normalizes legacy surfactant labels and sub-sub aliases', () => {
    expect(normalizeRmDetailSubCategoryForSelect('Bulk raw materials', 'surfactants')).toBe('Surfactant');
    expect(normalizeRmSubSubCategoryForSelect('Surfactant', 'non ionic')).toBe('Non-ionic');
    expect(normalizeRmSubSubCategoryForSelect('Preservative', 'phenoxyethanol')).toBe('Phenoxyethanol-type');
    expect(normalizeRmSubSubCategoryForSelect('Active', 'uv filter')).toBe('UV Filter');
  });
});
