import { describe, expect, it } from 'vitest';
import {
  normalizeRmDetailSubCategoryForSelect,
  normalizeRmSubSubCategoryForSelect,
  rmDetailSubCategoryHasSubSubCategory,
  rmDetailSubCategoryOptionsForSkuCategory,
  rmSubSubCategoryOptionsForDetailSubCategory,
} from '../../constants/materialMasterSkuRules';

describe('RM sub-sub category', () => {
  it('lists bulk raw material sub-categories in catalog order', () => {
    const opts = rmDetailSubCategoryOptionsForSkuCategory('Bulk raw materials').map((o) => o.value);
    expect(opts).toEqual([
      'Emulsifiers',
      'Surfactants',
      'Preservatives',
      'Solvents',
      'Waxes / butters',
      'UV filters',
      'Actives',
      'Botanicals',
      'Rheology modifiers',
    ]);
  });

  it('exposes preservative sub-sub options', () => {
    expect(rmDetailSubCategoryHasSubSubCategory('Preservatives')).toBe(true);
    expect(rmSubSubCategoryOptionsForDetailSubCategory('Preservatives').map((o) => o.value)).toEqual([
      'Broad spectrum',
      'Below 4.5',
    ]);
  });

  it('has no sub-sub for fragrance oil / water soluble', () => {
    expect(normalizeRmDetailSubCategoryForSelect('Fragrance', 'oil soluble')).toBe('Oil soluble');
    expect(rmDetailSubCategoryHasSubSubCategory('Oil soluble')).toBe(false);
    expect(rmSubSubCategoryOptionsForDetailSubCategory('Water soluble')).toEqual([]);
  });

  it('normalizes surfactant and emulsifier sub-sub aliases', () => {
    expect(normalizeRmSubSubCategoryForSelect('Surfactants', 'non ionic')).toBe('Non-ionic');
    expect(normalizeRmSubSubCategoryForSelect('Emulsifiers', 'o/w')).toBe('O/W');
    expect(normalizeRmSubSubCategoryForSelect('UV filters', 'uva')).toBe('UVA');
  });
});
