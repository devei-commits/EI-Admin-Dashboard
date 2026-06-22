import { describe, expect, it } from 'vitest';
import { getPmConditionalVisibility } from '../pmConditionalFields';

describe('getPmConditionalVisibility', () => {
  it('shows PPM primary fields for ppm category', () => {
    const v = getPmConditionalVisibility({
      pmSkuCategory: 'ppm',
      optionalPmSubCategory: 'BOTTLES',
      optionalPmSubSubCategory: 'PET',
    });
    expect(v.primaryAssemblyCode).toBe(true);
    expect(v.technicalEmptyWeight).toBe(true);
    expect(v.regulatoryFoodCosmeticCompliance).toBe(true);
  });

  it('shows bottle-specific technical fields', () => {
    const v = getPmConditionalVisibility({
      pmSkuCategory: 'ppm',
      optionalPmSubCategory: 'BOTTLES',
      optionalPmSubSubCategory: 'PET',
    });
    expect(v.technicalNominalVolume).toBe(true);
    expect(v.technicalShoulderHeight).toBe(true);
    expect(v.technicalBrimfulVolume).toBe(true);
    expect(v.technicalClosureType).toBe(false);
  });

  it('supports legacy bottle detail sub-category', () => {
    const v = getPmConditionalVisibility({
      pmSkuCategory: 'ppm',
      optionalPmSubCategory: 'Bottles',
      optionalPmSubSubCategory: '',
    });
    expect(v.technicalNominalVolume).toBe(true);
  });

  it('shows caps/lids diameter fields', () => {
    const caps = getPmConditionalVisibility({
      pmSkuCategory: 'ppm',
      optionalPmSubCategory: 'CAPS',
    });
    expect(caps.technicalOuterDiameter).toBe(true);
    expect(caps.technicalNominalVolume).toBe(false);
    expect(caps.aestheticsCapOvercapColour).toBe(true);
  });

  it('limits adhesive compatibility to labels and other secondary', () => {
    const labels = getPmConditionalVisibility({
      pmSkuCategory: 'spm-labels',
      optionalPmSubCategory: 'SHEET FORM',
    });
    const mono = getPmConditionalVisibility({
      pmSkuCategory: 'spm-monocarton',
      optionalPmSubCategory: 'LOCK BOTTOM',
    });
    expect(labels.compatAdhesiveCompatibility).toBe(true);
    expect(labels.compatContainerSurface).toBe(true);
    expect(mono.compatSuitableContainerType).toBe(true);
    expect(mono.compatAdhesiveCompatibility).toBe(false);
    expect(mono.compatContainerSurface).toBe(false);
  });
});
