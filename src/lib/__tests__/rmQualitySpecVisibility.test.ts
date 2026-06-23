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

  it('shows category quality specs for any classified RM path', () => {
    expect(shouldShowRmQualitySpecTable(bulkCtx)).toBe(true);
    expect(shouldShowRmQualitySpecTable({
      subCategory: 'Fragrance',
      optionalRmSubCategory: 'Oil soluble',
    })).toBe(true);
    expect(shouldShowRmQualitySpecTable({
      subCategory: 'Fragrance',
      optionalRmSubCategory: '',
    })).toBe(true);
  });

  it('shows sub-category table when functional sub-category is set (defaults optional)', () => {
    expect(shouldShowRmQualitySubSpecTable(bulkCtx)).toBe(true);
    expect(shouldShowRmQualitySubSpecTable({
      subCategory: 'Bulk raw materials',
      optionalRmSubCategory: 'Surfactant',
      optionalRmSubSubCategory: 'Cationic',
    })).toBe(true);
    expect(shouldShowRmQualitySubSpecTable({
      subCategory: 'Bulk raw materials',
      optionalRmSubCategory: 'Surfactant',
      optionalRmSubSubCategory: '',
    })).toBe(false);
  });

  it('does not auto-seed template default rows', () => {
    expect(getDefaultRmQualitySpecRows(bulkCtx)).toEqual([]);
    expect(getDefaultRmQualitySubSpecRows(bulkCtx)).toEqual([]);
  });

  it('does not require quality spec rows on save', () => {
    expect(validateRmQualitySpecRows([], bulkCtx)).toEqual({});
  });

  it('hydrates only custom tabular common rows from form_data', () => {
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
          custom: true,
        },
        {
          id: 'qs-2',
          parameter: 'Appearance',
          specLimit: 'Per Master',
          method: 'Visual',
          mandatory: true,
          tolerance: '',
          frequency: '',
          sample: '',
          acceptance: '',
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.parameter).toBe('pH');
  });

  it('hydrates custom sub-category rows by path', () => {
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
            custom: true,
          },
        ],
      },
    });
    expect(byPath['Surfactant::Anionic']).toHaveLength(1);
  });

  it('ignores legacy flat qc keys when loading tabular specs', () => {
    expect(
      hydrateRmQualitySpecRows({
        qcSurfAppearance: 'Clear liquid',
        qcSurfAnionicFreeOil: '≤ 0.3%',
      })
    ).toEqual([]);
    expect(
      hydrateRmQualitySubSpecRowsByPath({
        qcSurfAppearance: 'Clear liquid',
        qcSurfAnionicFreeOil: '≤ 0.3%',
      })
    ).toEqual({});
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
        custom: true,
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

  it('persists only custom rows on save', () => {
    const out = flattenRmQualitySpecRowsForPayload([
      {
        id: 'tpl',
        parameter: 'Appearance',
        specLimit: 'Clear',
        method: 'Visual',
        mandatory: true,
        tolerance: '',
        frequency: '',
        sample: '',
        acceptance: '',
        attachments: [],
      },
      {
        id: 'custom',
        parameter: 'pH',
        specLimit: '5–7',
        method: 'pH meter',
        mandatory: true,
        tolerance: '',
        frequency: '',
        sample: '',
        acceptance: '',
        attachments: [],
        custom: true,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.parameter).toBe('pH');
  });

  it('hydrates multiple attachments on custom rows', () => {
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
          custom: true,
          attachments: [
            { id: 'a1', type: 'file', name: 'coa.pdf', url: '' },
            { id: 'a2', type: 'link', name: 'https://example.com/spec', url: 'https://example.com/spec' },
          ],
        },
      ],
    });
    expect(rows[0]?.attachments).toHaveLength(2);
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
          custom: true,
        },
      ],
      'Surfactant::': [],
    });
    expect(Object.keys(out)).toEqual(['Surfactant::Anionic']);
  });
});
