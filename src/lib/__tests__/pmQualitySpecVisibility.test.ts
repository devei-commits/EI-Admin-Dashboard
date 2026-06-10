import { describe, expect, it } from 'vitest';
import {
  getVisiblePmQualitySpecFields,
  groupVisiblePmQualitySpecFields,
  hydratePmQualitySpecs,
  validatePmQualitySpecs,
} from '../pmQualitySpecVisibility';

describe('pmQualitySpecVisibility', () => {
  it('shows primary pack common + bottle fields', () => {
    const ctx = {
      pmSkuCategory: 'ppm',
      optionalPmSubCategory: 'Primary Pack',
      optionalPmSubSubCategory: 'Bottle',
    };
    const visible = getVisiblePmQualitySpecFields(ctx);
    expect(visible.some((f) => f.id === 'qcPmPriCoa')).toBe(true);
    expect(visible.some((f) => f.id === 'qcPmPriBottleHeight')).toBe(true);
    expect(visible.some((f) => f.id === 'qcPmClsCoa')).toBe(false);

    const groups = groupVisiblePmQualitySpecFields(ctx);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.title).toBe('Common');
    expect(groups[1]?.title).toBe('Bottle');
  });

  it('shows secondary pack fields for SPM labels + front label', () => {
    const ctx = {
      pmSkuCategory: 'spm-labels',
      optionalPmSubCategory: 'Secondary Pack',
      optionalPmSubSubCategory: 'Front Label',
    };
    const visible = getVisiblePmQualitySpecFields(ctx);
    expect(visible.some((f) => f.id === 'qcPmSecArtworkMatch')).toBe(true);
    expect(visible.some((f) => f.id === 'qcPmSecFrontAdhesiveStrength')).toBe(true);
    expect(visible.some((f) => f.id === 'qcPmSecMonoGsm')).toBe(false);
  });

  it('does not require quality spec fields on save', () => {
    const ctx = {
      pmSkuCategory: 'ppm',
      optionalPmSubCategory: 'Primary Pack',
      optionalPmSubSubCategory: 'Bottle',
    };
    expect(validatePmQualitySpecs({}, ctx)).toEqual({});
  });

  it('hydrates flat qc keys into pmQualitySpecs', () => {
    const specs = hydratePmQualitySpecs({
      qcPmPriBottleHeight: '120 mm',
      qcPmPriCoa: 'Yes — on file',
    });
    expect(specs.qcPmPriBottleHeight).toBe('120 mm');
    expect(specs.qcPmPriCoa).toBe('Yes — on file');
  });
});
