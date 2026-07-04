import { describe, expect, it } from 'vitest';
import {
  PR_CATEGORY_OPTIONS,
  PR_FUNCTIONAL_SUB_CATEGORIES,
  inferPrCategoryFromSubCategory,
  normalizePrCategoryForSelect,
  normalizePrSubCategoryForSelect,
  prCategoryAllowsCustomSubCategory,
  prSubCategoryOptionsForCategory,
  resolvePrCategoryAndSub,
} from '../../constants/prMasterCategoryOptions';

describe('prMasterCategoryOptions', () => {
  it('lists only Skin Care, Hair Care, and Others', () => {
    expect(PR_CATEGORY_OPTIONS).toEqual(['Skin Care', 'Hair Care', 'Others']);
    expect(PR_CATEGORY_OPTIONS).toEqual(Object.keys(PR_FUNCTIONAL_SUB_CATEGORIES));
  });

  it('lists skin care and hair care sub-categories', () => {
    expect(prSubCategoryOptionsForCategory('Skin Care').map((o) => o.value)).toEqual([
      'Cleansers',
      'Moisturiser',
      'Sunscreens',
      'Actives',
      'Others',
    ]);
    expect(prSubCategoryOptionsForCategory('Hair Care').map((o) => o.value)).toEqual([
      'Shampoos',
      'Conditioners',
      'Actives',
      'Others',
    ]);
    expect(prSubCategoryOptionsForCategory('Others')).toEqual([]);
  });

  it('normalizes legacy category labels into the three categories', () => {
    expect(normalizePrCategoryForSelect('Face Care')).toBe('Skin Care');
    expect(normalizePrCategoryForSelect('Colour Cosmetics')).toBe('Others');
    expect(normalizePrCategoryForSelect('Cleansing')).toBe('Skin Care');
    expect(normalizePrCategoryForSelect('Baby / Sensitive')).toBe('Others');
  });

  it('normalizes sub-categories within parent category', () => {
    expect(normalizePrSubCategoryForSelect('Hair Care', 'shampoo')).toBe('Shampoos');
    expect(normalizePrSubCategoryForSelect('Skin Care', 'face wash')).toBe('Cleansers');
    expect(normalizePrSubCategoryForSelect('Skin Care', 'sunscreen')).toBe('Sunscreens');
    expect(normalizePrSubCategoryForSelect('Hair Care', 'conditioners')).toBe('Conditioners');
  });

  it('allows free-text sub-category under Others', () => {
    expect(prCategoryAllowsCustomSubCategory('Others')).toBe(true);
    expect(prCategoryAllowsCustomSubCategory('Skin Care')).toBe(false);
    expect(normalizePrSubCategoryForSelect('Others', 'Custom Serum Line')).toBe('Custom Serum Line');
  });

  it('infers category from sub when parent missing', () => {
    expect(inferPrCategoryFromSubCategory('Sunscreens')).toBe('Skin Care');
    expect(inferPrCategoryFromSubCategory('Shampoos')).toBe('Hair Care');
    expect(inferPrCategoryFromSubCategory('Custom Line')).toBe('');
  });

  it('resolves legacy cleansing labels into Skin Care / Cleansers', () => {
    const resolved = resolvePrCategoryAndSub('Face Care', 'Cleansing');
    expect(resolved.category).toBe('Skin Care');
    expect(resolved.prSubCategory).toBe('Cleansers');
  });

  it('preserves legacy free-text subs that are not in the fixed lists', () => {
    const resolved = resolvePrCategoryAndSub('Skin Care', 'Cream');
    expect(resolved.category).toBe('Skin Care');
    expect(resolved.prSubCategory).toBe('Cream');
  });
});
