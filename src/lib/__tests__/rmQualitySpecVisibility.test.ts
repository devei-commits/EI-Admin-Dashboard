import { describe, expect, it } from 'vitest';
import {
  getVisibleRmQualitySpecFields,
  groupVisibleRmQualitySpecFields,
  hydrateRmQualitySpecs,
  validateRmQualitySpecs,
} from '../rmQualitySpecVisibility';

describe('rmQualitySpecVisibility', () => {
  it('shows surfactant common + anionic fields', () => {
    const ctx = {
      subCategory: 'Bulk raw materials',
      optionalRmSubCategory: 'Surfactant',
      optionalRmSubSubCategory: 'Anionic',
    };
    const visible = getVisibleRmQualitySpecFields(ctx);
    expect(visible.some((f) => f.id === 'qcSurfCoaFromVendor')).toBe(true);
    expect(visible.some((f) => f.id === 'qcSurfAnionic14Dioxane')).toBe(true);
    expect(visible.some((f) => f.id === 'qcSurfNonionicHlbValue')).toBe(false);

    const groups = groupVisibleRmQualitySpecFields(ctx);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.title).toBe('Common');
    expect(groups[1]?.title).toBe('Anionic');
  });

  it('shows aqua/solvent and alcohol-specific fields', () => {
    const ctx = {
      subCategory: 'Bulk raw materials',
      optionalRmSubCategory: 'Aqua / Solvent',
      optionalRmSubSubCategory: 'Alcohol',
    };
    const visible = getVisibleRmQualitySpecFields(ctx);
    expect(visible.some((f) => f.id === 'qcEndotoxinPharmaGrade')).toBe(true);
    expect(visible.some((f) => f.id === 'qcDenaturantVerification')).toBe(true);
    expect(visible.some((f) => f.id === 'qcAquaToc')).toBe(false);
  });

  it('does not require quality spec fields on save (optional after step 2)', () => {
    const ctx = {
      subCategory: 'Bulk raw materials',
      optionalRmSubCategory: 'Active',
      optionalRmSubSubCategory: 'UV Filter',
    };
    expect(validateRmQualitySpecs({}, ctx)).toEqual({});
  });

  it('hydrates legacy flat qc keys into rmQualitySpecs', () => {
    const specs = hydrateRmQualitySpecs({
      qcParticleSizeMineral: ' 50 nm ',
      qcEndotoxinPharmaGrade: '0.25 EU/mg',
    });
    expect(specs.qcParticleSizeMineral).toBe('50 nm');
    expect(specs.qcEndotoxinPharmaGrade).toBe('0.25 EU/mg');
  });

  it('returns no fields for non-bulk SKU series', () => {
    const visible = getVisibleRmQualitySpecFields({
      subCategory: 'Fragrance',
      optionalRmSubCategory: 'Oil soluble',
      optionalRmSubSubCategory: '',
    });
    expect(visible).toHaveLength(0);
  });
});
