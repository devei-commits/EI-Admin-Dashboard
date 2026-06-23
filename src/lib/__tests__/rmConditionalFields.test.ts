import { describe, expect, it } from 'vitest';
import { getRmConditionalVisibility } from '../rmConditionalFields';
import { isRmMasterFieldVisible, visibleRmFieldsForModule } from '../rmMasterFieldVisibility';
import { RM_MASTER_FIELDS } from '../../constants/rmMasterFieldSchema';

describe('getRmConditionalVisibility', () => {
  it('shows max use level for preservatives / UV filters', () => {
    const preserv = getRmConditionalVisibility({
      subCategory: 'RAW MATERIALS',
      optionalRmSubCategory: 'PRESERVATIVES',
      optionalRmSubSubCategory: '',
      rmState: '',
    });
    expect(preserv.regMaxUseLevelPct).toBe(true);
    expect(preserv.regCiNumber).toBe(false);

    const uv = getRmConditionalVisibility({
      subCategory: 'RAW MATERIALS',
      optionalRmSubCategory: 'UV FILTERS',
      optionalRmSubSubCategory: 'UVA',
      rmState: '',
    });
    expect(uv.regMaxUseLevelPct).toBe(true);
  });

  it('shows fragrance regulatory fields for Fragrance category', () => {
    const v = getRmConditionalVisibility({
      subCategory: 'FRAGRANCES / PERFUMES',
      optionalRmSubCategory: 'OIL SOLUBLE',
      rmState: '',
    });
    expect(v.regAllergenDeclarationEu26).toBe(true);
    expect(v.regIfraCategoryLimit).toBe(true);
    expect(v.regMaxUseLevelPct).toBe(false);
  });

  it('shows colour fields for COLOURS', () => {
    const v = getRmConditionalVisibility({
      subCategory: 'COLOURS',
      optionalRmSubCategory: 'OIL SOLUBLE',
      rmState: '',
    });
    expect(v.regCiNumber).toBe(true);
    expect(v.regApprovedArea).toBe(true);
  });

  it('accepts legacy category labels', () => {
    const v = getRmConditionalVisibility({
      subCategory: 'Bulk raw materials',
      optionalRmSubCategory: 'Preservative',
      rmState: '',
    });
    expect(v.regMaxUseLevelPct).toBe(true);
  });

  it('shows quality spec section for bulk functional categories', () => {
    expect(
      getRmConditionalVisibility({
        subCategory: 'RAW MATERIALS',
        optionalRmSubCategory: 'SURFACTANTS',
        optionalRmSubSubCategory: 'ANIONIC',
        rmState: '',
      }).showQualityConditional
    ).toBe(true);

    expect(
      getRmConditionalVisibility({
        subCategory: '',
        optionalRmSubCategory: '',
        optionalRmSubSubCategory: '',
        rmState: '',
      }).showQualityConditional
    ).toBe(false);
  });

  it('shows physical form fields by technical state', () => {
    expect(
      getRmConditionalVisibility({
        subCategory: 'RAW MATERIALS',
        optionalRmSubCategory: 'ACTIVES',
        rmState: 'Solid',
      }).rmPhysicalFormSolid
    ).toBe(true);
    expect(
      getRmConditionalVisibility({
        subCategory: 'RAW MATERIALS',
        optionalRmSubCategory: 'ACTIVES',
        rmState: 'Liquid',
      }).rmPhysicalFormLiquid
    ).toBe(true);
  });

  it('renders regulatory fields from schema for fragrance category', () => {
    const ctx = {
      subCategory: 'FRAGRANCES / PERFUMES',
      optionalRmSubCategory: 'OIL SOLUBLE',
      rmState: '',
    };
    const reg = visibleRmFieldsForModule('regulatory', ctx);
    expect(reg.some((f) => f.key === 'regAllergenDeclarationEu26')).toBe(true);
    expect(isRmMasterFieldVisible(RM_MASTER_FIELDS.find((f) => f.key === 'regCiNumber')!, ctx)).toBe(
      false
    );
  });
});
