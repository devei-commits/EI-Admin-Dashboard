import { describe, expect, it } from 'vitest';
import {
  flattenPmQualitySpecRowsForPayload,
  flattenPmQualitySubSpecRowsByPathForPayload,
  getDefaultPmQualitySpecRows,
  getDefaultPmQualitySubSpecRows,
  getVisiblePmQualitySpecFields,
  groupVisiblePmQualitySpecFields,
  hydratePmQualitySpecRows,
  hydratePmQualitySubSpecRowsByPath,
  shouldShowPmQualitySpecTable,
  shouldShowPmQualitySubSpecTable,
  validatePmQualitySpecRows,
} from '../pmQualitySpecVisibility';

describe('pmQualitySpecVisibility', () => {
  const bottleCtx = {
    pmSkuCategory: 'ppm',
    optionalPmSubCategory: 'Primary Pack',
    optionalPmSubSubCategory: 'Bottle (PET/HDPE)',
  };

  it('shows primary pack common + bottle fields (legacy flat defs)', () => {
    const visible = getVisiblePmQualitySpecFields(bottleCtx);
    expect(visible.some((f) => f.id === 'qcPmPriCoa')).toBe(true);
    expect(visible.some((f) => f.id === 'qcPmPriBottleHeight')).toBe(true);
    expect(visible.some((f) => f.id === 'qcPmClsCoa')).toBe(false);

    const groups = groupVisiblePmQualitySpecFields(bottleCtx);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.title).toBe('Common');
    expect(groups[1]?.title).toBe('Bottle (PET/HDPE)');
  });

  it('shows quality spec tables when category / sub-category are set', () => {
    expect(shouldShowPmQualitySpecTable(bottleCtx)).toBe(true);
    expect(shouldShowPmQualitySubSpecTable(bottleCtx)).toBe(true);
    expect(
      shouldShowPmQualitySubSpecTable({
        pmSkuCategory: 'ppm',
        optionalPmSubCategory: 'Primary Pack',
        optionalPmSubSubCategory: '',
      })
    ).toBe(false);
  });

  it('does not auto-seed template default rows', () => {
    expect(getDefaultPmQualitySpecRows(bottleCtx)).toEqual([]);
    expect(getDefaultPmQualitySubSpecRows(bottleCtx)).toEqual([]);
    for (const category of [
      'Closures & Pumps',
      'Secondary Pack',
      'Primary Pack',
      'Tertiary Pack',
      'Ancillary',
    ] as const) {
      const ctx = {
        pmSkuCategory: 'ppm',
        optionalPmSubCategory: category,
        optionalPmSubSubCategory: '',
      };
      expect(shouldShowPmQualitySpecTable(ctx)).toBe(true);
      expect(getDefaultPmQualitySpecRows(ctx)).toEqual([]);
    }
  });

  it('does not require quality spec rows on save', () => {
    expect(validatePmQualitySpecRows([], bottleCtx)).toEqual({});
  });

  it('hydrates only custom tabular common rows from form_data', () => {
    const rows = hydratePmQualitySpecRows({
      pmQualitySpecRows: [
        {
          id: 'qs-1',
          parameter: 'COA from Vendor',
          specLimit: 'Signed',
          method: 'Doc review',
          mandatory: true,
          tolerance: '—',
          frequency: 'Per lot',
          sample: '1',
          acceptance: 'Signed',
          custom: true,
        },
        {
          id: 'qs-2',
          parameter: 'Height',
          specLimit: 'Per Master mm',
          method: 'Vernier',
          mandatory: true,
          tolerance: '',
          frequency: '',
          sample: '',
          acceptance: '',
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.parameter).toBe('COA from Vendor');
    expect(rows[0]?.mandatory).toBe(true);
  });

  it('ignores legacy flat qc keys when loading tabular specs', () => {
    expect(
      hydratePmQualitySpecRows({
        qcPmPriBottleHeight: '120 mm',
        qcPmPriCoa: 'Yes — on file',
      })
    ).toEqual([]);
    expect(
      hydratePmQualitySubSpecRowsByPath({
        qcPmPriBottleHeight: '120 mm',
      })
    ).toEqual({});
  });

  it('flattens tabular rows for payload', () => {
    const rows = flattenPmQualitySpecRowsForPayload([
      {
        id: 'qs-1',
        parameter: '  Height  ',
        specLimit: 'Per Master mm',
        method: 'Vernier',
        mandatory: true,
        tolerance: '±0.5 mm',
        frequency: 'Per lot',
        sample: '10',
        acceptance: 'Within tolerance',
        attachments: [],
        custom: true,
      },
      {
        id: 'qs-2',
        parameter: '   ',
        specLimit: '',
        method: '',
        mandatory: false,
        tolerance: '',
        frequency: '',
        sample: '',
        acceptance: '',
        attachments: [],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.parameter).toBe('Height');
  });

  it('persists only custom rows on save', () => {
    const rows = flattenPmQualitySpecRowsForPayload([
      {
        id: 'tpl',
        parameter: 'COA from Vendor',
        specLimit: 'Signed',
        method: 'Doc review',
        mandatory: true,
        tolerance: '',
        frequency: '',
        sample: '',
        acceptance: '',
        attachments: [],
      },
      {
        id: 'custom',
        parameter: 'Height',
        specLimit: '120 mm',
        method: 'Vernier',
        mandatory: true,
        tolerance: '',
        frequency: '',
        sample: '',
        acceptance: '',
        attachments: [],
        custom: true,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.parameter).toBe('Height');
  });

  it('flattens sub-category rows by path for payload', () => {
    const byPath = flattenPmQualitySubSpecRowsByPathForPayload({
      'Primary Pack::Bottle (PET/HDPE)': [
        {
          id: 'qs-1',
          parameter: 'Height',
          specLimit: 'Per Master mm',
          method: 'Vernier',
          mandatory: true,
          tolerance: '±0.5 mm',
          frequency: 'Per lot',
          sample: '10',
          acceptance: 'Within tolerance',
          attachments: [],
          custom: true,
        },
      ],
      'Primary Pack::': [],
    });
    expect(Object.keys(byPath)).toEqual(['Primary Pack::Bottle (PET/HDPE)']);
  });
});
