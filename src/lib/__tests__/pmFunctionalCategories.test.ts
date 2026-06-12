import { describe, expect, it } from 'vitest';
import {
  PM_CLOSURES_SUB_CATEGORY_OPTIONS,
  PM_PRIMARY_PACK_SUB_CATEGORY_OPTIONS,
  PM_SECONDARY_PACK_SUB_CATEGORY_OPTIONS,
  PM_TERTIARY_PACK_SUB_CATEGORY_OPTIONS,
  PM_ANCILLARY_SUB_CATEGORY_OPTIONS,
  PM_FUNCTIONAL_CATEGORY_OPTIONS,
  PM_FUNCTIONAL_SUB_CATEGORIES,
  PM_SKU_FUNCTIONAL_CATEGORIES,
  normalizePmDetailSubCategoryForSelect,
  normalizePmFunctionalSubCategoryKey,
  normalizePmSubSubCategoryForSelect,
  pmDetailSubCategoryOptionsForSkuCategory,
  pmFunctionalSubCategoryOptionsForSkuCategory,
  pmRecommendedFunctionalCategoriesForSku,
  pmSubSubCategoryOptionsForDetailSubCategory,
} from '../../constants/materialMasterSkuRules';

describe('PM functional categories', () => {
  it('lists all five PM functional categories for any SKU series', () => {
    const opts = pmDetailSubCategoryOptionsForSkuCategory('ppm').map((o) => o.value);
    expect(opts).toEqual([...PM_FUNCTIONAL_CATEGORY_OPTIONS]);
    expect(pmRecommendedFunctionalCategoriesForSku('ppm')).toEqual(PM_SKU_FUNCTIONAL_CATEGORIES.ppm);
  });

  it('lists primary pack sub-categories with material-specific labels', () => {
    expect(pmSubSubCategoryOptionsForDetailSubCategory('Primary Pack', 'ppm').map((o) => o.value)).toEqual(
      [...PM_PRIMARY_PACK_SUB_CATEGORY_OPTIONS]
    );
    expect(PM_FUNCTIONAL_SUB_CATEGORIES['Primary Pack']).toEqual([...PM_PRIMARY_PACK_SUB_CATEGORY_OPTIONS]);
  });

  it('lists secondary pack sub-categories', () => {
    expect(pmSubSubCategoryOptionsForDetailSubCategory('Secondary Pack', 'ppm').map((o) => o.value)).toEqual(
      [...PM_SECONDARY_PACK_SUB_CATEGORY_OPTIONS]
    );
    expect(PM_FUNCTIONAL_SUB_CATEGORIES['Secondary Pack']).toEqual([...PM_SECONDARY_PACK_SUB_CATEGORY_OPTIONS]);
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

  it('filters secondary pack subs for SPM other (tamper sticker and leaflet)', () => {
    expect(
      pmFunctionalSubCategoryOptionsForSkuCategory('spm-other', 'Secondary Pack').map((o) => o.value)
    ).toEqual(['Tamper Sticker', 'Leaflet']);
  });

  it('lists tertiary pack sub-categories', () => {
    expect(pmSubSubCategoryOptionsForDetailSubCategory('Tertiary Pack', 'tpm-tertiary').map((o) => o.value)).toEqual(
      [...PM_TERTIARY_PACK_SUB_CATEGORY_OPTIONS]
    );
    expect(PM_FUNCTIONAL_SUB_CATEGORIES['Tertiary Pack']).toEqual([...PM_TERTIARY_PACK_SUB_CATEGORY_OPTIONS]);
  });

  it('lists ancillary sub-categories', () => {
    expect(pmSubSubCategoryOptionsForDetailSubCategory('Ancillary', 'tpm-ancillary').map((o) => o.value)).toEqual(
      [...PM_ANCILLARY_SUB_CATEGORY_OPTIONS]
    );
    expect(PM_FUNCTIONAL_SUB_CATEGORIES.Ancillary).toEqual([...PM_ANCILLARY_SUB_CATEGORY_OPTIONS]);
  });

  it('normalizes legacy ancillary sub-category labels', () => {
    expect(normalizePmFunctionalSubCategoryKey('spatulas')).toBe('Spatula');
    expect(normalizePmFunctionalSubCategoryKey('brushes')).toBe('Brush');
    expect(normalizePmSubSubCategoryForSelect('Ancillary', 'qr card', 'tpm-ancillary')).toBe('QR Card / Insert');
    expect(normalizePmSubSubCategoryForSelect('Ancillary', 'insert', 'tpm-ancillary')).toBe('QR Card / Insert');
  });

  it('normalizes legacy tertiary pack sub-category labels', () => {
    expect(normalizePmFunctionalSubCategoryKey('shipper')).toBe('Master Carton');
    expect(normalizePmFunctionalSubCategoryKey('pallet')).toBe('Pallet Material');
    expect(normalizePmSubSubCategoryForSelect('Tertiary Pack', 'stretch film', 'tpm-tertiary')).toBe('Stretch Film');
    expect(normalizePmSubSubCategoryForSelect('Tertiary Pack', 'strapping', 'tpm-tertiary')).toBe('Strapping');
  });

  it('normalizes legacy secondary pack sub-category labels', () => {
    expect(normalizePmFunctionalSubCategoryKey('monocartons')).toBe('Monocarton');
    expect(normalizePmFunctionalSubCategoryKey('sheet form')).toBe('Front Label');
    expect(normalizePmFunctionalSubCategoryKey('roll form')).toBe('Back Label');
    expect(normalizePmSubSubCategoryForSelect('Secondary Pack', 'tamper band', 'spm-other')).toBe('Tamper Sticker');
    expect(normalizePmSubSubCategoryForSelect('Secondary Pack', 'pil', 'spm-other')).toBe('Leaflet');
  });

  it('normalizes legacy bottle and tube labels', () => {
    expect(normalizePmDetailSubCategoryForSelect('ppm', 'bottles')).toBe('Primary Pack');
    expect(normalizePmSubSubCategoryForSelect('Primary Pack', 'bottles', 'ppm')).toBe('Bottle (PET/HDPE)');
    expect(normalizePmSubSubCategoryForSelect('Primary Pack', 'tube', 'ppm')).toBe('Tube (Laminated)');
    expect(normalizePmFunctionalSubCategoryKey('Bottle')).toBe('Bottle (PET/HDPE)');
    expect(normalizePmFunctionalSubCategoryKey('Jar')).toBe('Jar (PP/PET)');
  });

  it('lists Closures & Pumps sub-categories with lotion/foam and flip-top labels', () => {
    expect(pmSubSubCategoryOptionsForDetailSubCategory('Closures & Pumps', 'ppm').map((o) => o.value)).toEqual(
      [...PM_CLOSURES_SUB_CATEGORY_OPTIONS]
    );
    expect(PM_FUNCTIONAL_SUB_CATEGORIES['Closures & Pumps']).toEqual([...PM_CLOSURES_SUB_CATEGORY_OPTIONS]);
  });

  it('normalizes legacy Pump and Cap closure sub-categories', () => {
    expect(normalizePmFunctionalSubCategoryKey('Pump')).toBe('Pump (Lotion/Foam)');
    expect(normalizePmFunctionalSubCategoryKey('Cap')).toBe('Cap (Flip-top/Disc-top)');
    expect(normalizePmSubSubCategoryForSelect('Closures & Pumps', 'pump', 'ppm')).toBe('Pump (Lotion/Foam)');
    expect(normalizePmSubSubCategoryForSelect('Closures & Pumps', 'flip-top', 'ppm')).toBe(
      'Cap (Flip-top/Disc-top)'
    );
  });
});
