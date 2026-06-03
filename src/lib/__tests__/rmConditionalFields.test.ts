import { describe, expect, it } from 'vitest';
import { getRmConditionalVisibility } from '../rmConditionalFields';

describe('getRmConditionalVisibility', () => {
  it('shows max use level for bulk preservatives / UV filters', () => {
    const v = getRmConditionalVisibility({
      subCategory: 'Bulk raw materials',
      optionalRmSubCategory: 'Preservatives',
      rmState: '',
    });
    expect(v.regMaxUseLevelPct).toBe(true);
    expect(v.regCiNumber).toBe(false);
  });

  it('shows fragrance regulatory fields for Fragrance category', () => {
    const v = getRmConditionalVisibility({
      subCategory: 'Fragrance',
      optionalRmSubCategory: '',
      rmState: '',
    });
    expect(v.regAllergenDeclarationEu26).toBe(true);
    expect(v.regIfraCategoryLimit).toBe(true);
    expect(v.regMaxUseLevelPct).toBe(false);
  });

  it('shows colour fields for Colors & Pigments', () => {
    const v = getRmConditionalVisibility({
      subCategory: 'Colors & Pigments',
      optionalRmSubCategory: '',
      rmState: '',
    });
    expect(v.regCiNumber).toBe(true);
    expect(v.regApprovedArea).toBe(true);
  });

  it('shows physical form fields by technical state', () => {
    expect(
      getRmConditionalVisibility({
        subCategory: 'Actives',
        optionalRmSubCategory: '',
        rmState: 'Solid',
      }).rmPhysicalFormSolid
    ).toBe(true);
    expect(
      getRmConditionalVisibility({
        subCategory: 'Actives',
        optionalRmSubCategory: '',
        rmState: 'Liquid',
      }).rmPhysicalFormLiquid
    ).toBe(true);
  });
});
