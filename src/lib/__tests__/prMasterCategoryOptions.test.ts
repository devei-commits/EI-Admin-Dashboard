import { describe, expect, it } from 'vitest';
import {
  PR_CATEGORY_OPTIONS,
  PR_FUNCTIONAL_SUB_CATEGORIES,
  inferPrCategoryFromSubCategory,
  normalizePrCategoryForSelect,
  normalizePrSubCategoryForSelect,
  prSubCategoryOptionsForCategory,
  resolvePrCategoryAndSub,
} from '../../constants/prMasterCategoryOptions';

describe('prMasterCategoryOptions', () => {
  it('lists PR categories in catalog order', () => {
    expect(PR_CATEGORY_OPTIONS).toEqual(Object.keys(PR_FUNCTIONAL_SUB_CATEGORIES));
  });

  it('lists skin care sub-categories', () => {
    expect(prSubCategoryOptionsForCategory('Skin Care').map((o) => o.value)).toEqual(
      PR_FUNCTIONAL_SUB_CATEGORIES['Skin Care']
    );
  });

  it('normalizes legacy face care and colour cosmetics labels', () => {
    expect(normalizePrCategoryForSelect('Face Care')).toBe('Skin Care');
    expect(normalizePrCategoryForSelect('Colour Cosmetics')).toBe('Color Cosmetics');
  });

  it('normalizes sub-categories within parent category', () => {
    expect(normalizePrSubCategoryForSelect('Hair Care', 'shampoo')).toBe('Shampoo');
    expect(normalizePrSubCategoryForSelect('Cleansing', 'face wash')).toBe('Facewash');
  });

  it('infers category from sub when parent missing', () => {
    expect(inferPrCategoryFromSubCategory('Sunscreen')).toBe('Skin Care');
    expect(inferPrCategoryFromSubCategory('Mascara')).toBe('Color Cosmetics');
  });

  it('resolves legacy sub that was a category name', () => {
    const resolved = resolvePrCategoryAndSub('Face Care', 'Cleansing');
    expect(resolved.category).toBe('Cleansing');
    expect(resolved.prSubCategory).toBe('');
  });
});
