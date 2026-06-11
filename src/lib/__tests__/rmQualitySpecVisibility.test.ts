import { describe, expect, it } from 'vitest';
import {
  flattenRmQualitySpecRowsForPayload,
  flattenRmQualitySubSpecRowsByPathForPayload,
  getDefaultRmQualitySpecRows,
  getDefaultRmQualitySubSpecRows,
  hydrateRmQualitySpecRows,
  hydrateRmQualitySubSpecRowsByPath,
  shouldShowRmQualitySpecTable,
  shouldShowRmQualitySubSpecTable,
  validateRmQualitySpecRows,
} from '../rmQualitySpecVisibility';

describe('rmQualitySpecVisibility', () => {
  const bulkCtx = {
    subCategory: 'Bulk raw materials',
    optionalRmSubCategory: 'Surfactant',
    optionalRmSubSubCategory: 'Anionic',
  };

  it('shows tabular quality specs for bulk functional categories', () => {
    expect(shouldShowRmQualitySpecTable(bulkCtx)).toBe(true);
    expect(shouldShowRmQualitySpecTable({
      subCategory: 'Fragrance',
      optionalRmSubCategory: 'Oil soluble',
    })).toBe(false);
  });

  it('shows sub-category table when functional sub-category is set', () => {
    expect(shouldShowRmQualitySubSpecTable(bulkCtx)).toBe(true);
    expect(shouldShowRmQualitySubSpecTable({
      subCategory: 'Bulk raw materials',
      optionalRmSubCategory: 'Surfactant',
      optionalRmSubSubCategory: '',
    })).toBe(false);
  });

  it('seeds skin-care style default common rows', () => {
    const defaults = getDefaultRmQualitySpecRows(bulkCtx);
    expect(defaults.length).toBeGreaterThan(0);
    expect(defaults.some((r) => r.parameter === 'Appearance')).toBe(true);
    expect(defaults.some((r) => r.parameter === 'Bulk Yield')).toBe(true);
  });

  it('seeds anionic sub-category default rows', () => {
    const defaults = getDefaultRmQualitySubSpecRows(bulkCtx);
    expect(defaults.some((r) => r.parameter === 'Active Matter (sulfate %)')).toBe(true);
    expect(defaults.some((r) => r.parameter === '1,4-Dioxane' && r.mandatory)).toBe(true);
    expect(defaults.find((r) => r.parameter === 'Free Oil')?.acceptance).toBe('≤ 0.5%');
  });

  it('does not require quality spec rows on save', () => {
    expect(validateRmQualitySpecRows([], bulkCtx)).toEqual({});
  });

  it('hydrates tabular common rows from form_data', () => {
    const rows = hydrateRmQualitySpecRows({
      rmQualitySpecRows: [
        {
          id: 'qs-1',
          parameter: 'pH',
          specLimit: 'Per Master',
          method: 'pH meter',
          mandatory: true,
          tolerance: '±0.3',
          frequency: 'Per batch',
          sample: '100g',
          acceptance: 'Within range',
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.parameter).toBe('pH');
    expect(rows[0]?.mandatory).toBe(true);
  });

  it('hydrates sub-category rows by path', () => {
    const byPath = hydrateRmQualitySubSpecRowsByPath({
      rmQualitySubSpecRowsByPath: {
        'Surfactant::Anionic': [
          {
            id: 'sub-1',
            parameter: 'Free Oil',
            specLimit: '≤ 0.5%',
            method: 'Solvent extraction',
            mandatory: false,
            tolerance: '≤ Spec',
            frequency: 'Per lot',
            sample: '5g',
            acceptance: '≤ 0.5%',
          },
        ],
      },
    });
    expect(byPath['Surfactant::Anionic']).toHaveLength(1);
  });

  it('migrates legacy flat rmQualitySpecs into common and sub-category rows', () => {
    const common = hydrateRmQualitySpecRows({
      qcSurfAppearance: 'Clear liquid',
      qcSurfAnionicFreeOil: '≤ 0.3%',
    });
    const byPath = hydrateRmQualitySubSpecRowsByPath({
      qcSurfAppearance: 'Clear liquid',
      qcSurfAnionicFreeOil: '≤ 0.3%',
    });
    expect(common.some((r) => r.parameter === 'Appearance' && r.specLimit === 'Clear liquid')).toBe(true);
    expect(
      byPath['Surfactant::Anionic']?.some(
        (r) => r.parameter === 'Free Oil' && r.specLimit === '≤ 0.3%'
      )
    ).toBe(true);
  });

  it('flattens rows and drops empty parameters', () => {
    const out = flattenRmQualitySpecRowsForPayload([
      {
        id: 'a',
        parameter: '  Odor ',
        specLimit: 'Per Master',
        method: '',
        mandatory: false,
        tolerance: '',
        frequency: '',
        sample: '',
        acceptance: '',
        attachments: [],
      },
      {
        id: 'b',
        parameter: '   ',
        specLimit: 'x',
        method: '',
        mandatory: false,
        tolerance: '',
        frequency: '',
        sample: '',
        acceptance: '',
        attachments: [],
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.parameter).toBe('Odor');
  });

  it('hydrates multiple attachments per row', () => {
    const rows = hydrateRmQualitySpecRows({
      rmQualitySpecRows: [
        {
          id: 'qs-1',
          parameter: 'pH',
          specLimit: 'Per Master',
          method: 'pH meter',
          mandatory: false,
          tolerance: '',
          frequency: '',
          sample: '',
          acceptance: '',
          attachments: [
            { id: 'a1', type: 'file', name: 'coa.pdf', url: '' },
            { id: 'a2', type: 'link', name: 'https://example.com/spec', url: 'https://example.com/spec' },
          ],
        },
      ],
    });
    expect(rows[0]?.attachments).toHaveLength(2);
  });

  it('migrates legacy attachmentName and linkUrl into attachments array', () => {
    const rows = hydrateRmQualitySpecRows({
      rmQualitySpecRows: [
        {
          id: 'qs-1',
          parameter: 'Color',
          attachmentName: 'swatch.jpg',
          linkUrl: 'https://example.com/swatch',
        },
      ],
    });
    expect(rows[0]?.attachments).toHaveLength(2);
    expect(rows[0]?.attachments[0]?.type).toBe('file');
    expect(rows[0]?.attachments[1]?.type).toBe('link');
  });

  it('flattens sub-category rows by path', () => {
    const out = flattenRmQualitySubSpecRowsByPathForPayload({
      'Surfactant::Anionic': [
        {
          id: 'a',
          parameter: 'Free Oil',
          specLimit: '≤ 0.5%',
          method: '',
          mandatory: false,
          tolerance: '',
          frequency: '',
          sample: '',
          acceptance: '',
          attachments: [],
        },
      ],
      'Surfactant::': [],
    });
    expect(Object.keys(out)).toEqual(['Surfactant::Anionic']);
  });
});
