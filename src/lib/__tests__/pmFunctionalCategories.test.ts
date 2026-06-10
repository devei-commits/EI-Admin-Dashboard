import { describe, expect, it } from 'vitest';
import {
  PM_FUNCTIONAL_SUB_CATEGORIES,
  PM_SKU_FUNCTIONAL_CATEGORIES,
  normalizePmDetailSubCategoryForSelect,
  normalizePmSubSubCategoryForSelect,
  pmDetailSubCategoryOptionsForSkuCategory,
  pmFunctionalSubCategoryOptionsForSkuCategory,
  pmSubSubCategoryOptionsForDetailSubCategory,
} from '../../constants/materialMasterSkuRules';

describe('PM functional categories', () => {
  it('lists PPM functional categories', () => {
    const opts = pmDetailSubCategoryOptionsForSkuCategory('ppm').map((o) => o.value);
    expect(opts).toEqual(PM_SKU_FUNCTIONAL_CATEGORIES.ppm);
  });

  it('lists primary pack sub-categories', () => {
    expect(pmSubSubCategoryOptionsForDetailSubCategory('Primary Pack', 'ppm').map((o) => o.value)).toEqual(
      PM_FUNCTIONAL_SUB_CATEGORIES['Primary Pack']
    );
  });

  it('filters secondary pack subs for SPM labels', () => {
    expect(
      pmFunctionalSubCategoryOptionsForSkuCategory('spm-labels', 'Secondary Pack').map((o) => o.value)
    ).toEqual(['Front Label', 'Back Label']);
  });

  it('filters secondary pack subs for SPM monocarton', () => {
    expect(
      pmFunctionalSubCategoryOptionsForSkuCategory('spm-monocarton', 'Secondary Pack').map((o) => o.value)
    ).toEqual(['Monocarton']);
  });

  it('normalizes legacy bottle and tube labels', () => {
    expect(normalizePmDetailSubCategoryForSelect('ppm', 'bottles')).toBe('Primary Pack');
    expect(normalizePmSubSubCategoryForSelect('Primary Pack', 'bottles', 'ppm')).toBe('Bottle');
    expect(normalizePmSubSubCategoryForSelect('Primary Pack', 'tube', 'ppm')).toBe('Tube');
  });
});
