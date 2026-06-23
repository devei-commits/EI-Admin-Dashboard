import { describe, expect, it } from 'vitest';
import { getPmConditionalVisibility } from '../pmConditionalFields';
import { isPmMasterFieldVisible, visiblePmFieldsForModule } from '../pmMasterFieldVisibility';
import { PM_MASTER_FIELDS } from '../../constants/pmMasterFieldSchema';

describe('getPmConditionalVisibility', () => {
  it('shows PPM primary fields for ppm category', () => {
    const ctx = {
      pmSkuCategory: 'ppm',
      optionalPmSubCategory: 'BOTTLES',
      optionalPmSubSubCategory: 'PET',
    };
    const v = getPmConditionalVisibility(ctx);
    expect(v.pmAssemblyCode).toBe(true);
    expect(v.specWeight).toBe(true);
    expect(v.regFoodCosmeticCompliance).toBe(true);
  });

  it('shows bottle-specific dimension fields', () => {
    const ctx = {
      pmSkuCategory: 'ppm',
      optionalPmSubCategory: 'BOTTLES',
      optionalPmSubSubCategory: 'PET',
    };
    const dims = visiblePmFieldsForModule('dimensions', ctx);
    expect(dims.some((f) => f.key === 'specNominal')).toBe(true);
    expect(dims.some((f) => f.key === 'pmShoulderHeightMm')).toBe(true);
    expect(dims.some((f) => f.key === 'specBrimful')).toBe(true);
    expect(dims.some((f) => f.key === 'pmClosureType')).toBe(false);
  });

  it('supports legacy bottle detail sub-category', () => {
    const ctx = {
      pmSkuCategory: 'ppm',
      optionalPmSubCategory: 'Bottles',
      optionalPmSubSubCategory: '',
    };
    expect(isPmMasterFieldVisible(PM_MASTER_FIELDS.find((f) => f.key === 'specNominal')!, ctx)).toBe(
      true
    );
  });

  it('shows caps diameter fields without nominal volume', () => {
    const capsCtx = {
      pmSkuCategory: 'ppm',
      optionalPmSubCategory: 'CAPS',
    };
    const capsDims = visiblePmFieldsForModule('dimensions', capsCtx);
    expect(capsDims.some((f) => f.key === 'pmOuterDiameterMm')).toBe(true);
    expect(capsDims.some((f) => f.key === 'specNominal')).toBe(false);
    const aesthetics = visiblePmFieldsForModule('aesthetics', capsCtx);
    expect(aesthetics.some((f) => f.key === 'pmCapOvercapColour')).toBe(true);
  });

  it('shows label adhesive fields for SPM labels only', () => {
    const labels = visiblePmFieldsForModule('material', {
      pmSkuCategory: 'spm-labels',
      optionalPmSubCategory: 'SHEET FORM',
    });
    const mono = visiblePmFieldsForModule('material', {
      pmSkuCategory: 'spm-monocarton',
      optionalPmSubCategory: 'LOCK BOTTOM',
    });
    expect(labels.some((f) => f.key === 'adhesiveType')).toBe(true);
    expect(mono.some((f) => f.key === 'adhesiveType')).toBe(false);
    expect(mono.some((f) => f.key === 'pmBoardPaperType')).toBe(true);
  });
});
