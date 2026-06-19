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

  it('seeds primary pack common default rows', () => {
    const defaults = getDefaultPmQualitySpecRows(bottleCtx);
    expect(defaults.some((r) => r.parameter === 'COA from Vendor')).toBe(true);
    expect(defaults.some((r) => r.parameter === 'Visual Damage / Defect')).toBe(true);
  });

  it('supports all five PM functional categories for quality specs', () => {
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
      const defaults = getDefaultPmQualitySpecRows(ctx);
      expect(defaults.length).toBeGreaterThan(0);
    }
  });

  it('seeds bottle sub-category default rows', () => {
    const defaults = getDefaultPmQualitySubSpecRows(bottleCtx);
    expect(defaults.some((r) => r.parameter === 'Height')).toBe(true);
    expect(defaults.some((r) => r.parameter === 'Stress-Crack Resistance (ESCR)')).toBe(true);
  });

  it('seeds secondary pack common and monocarton sub-category default rows', () => {
    const monoCtx = {
      pmSkuCategory: 'spm-monocarton',
      optionalPmSubCategory: 'Secondary Pack',
      optionalPmSubSubCategory: 'Monocarton',
    };
    const common = getDefaultPmQualitySpecRows(monoCtx);
    expect(common.some((r) => r.parameter === 'Artwork Match')).toBe(true);
    expect(common.some((r) => r.parameter === 'Barcode Scan')).toBe(true);

    const sub = getDefaultPmQualitySubSpecRows(monoCtx);
    expect(sub.some((r) => r.parameter === 'GSM')).toBe(true);
    expect(sub.some((r) => r.parameter === 'Folding Quality (creases)')).toBe(true);
  });

  it('seeds closures & pumps common and pump sub-category default rows', () => {
    const pumpCtx = {
      pmSkuCategory: 'ppm',
      optionalPmSubCategory: 'Closures & Pumps',
      optionalPmSubSubCategory: 'Pump (Lotion/Foam)',
    };
    const common = getDefaultPmQualitySpecRows(pumpCtx);
    expect(common.some((r) => r.parameter === 'Visual Defects')).toBe(true);
    expect(common.some((r) => r.parameter === 'Compatibility with Bottle / Tube')).toBe(true);

    const sub = getDefaultPmQualitySubSpecRows(pumpCtx);
    expect(sub.some((r) => r.parameter === 'Output Volume per Stroke')).toBe(true);
    expect(sub.some((r) => r.parameter === 'Cap Closure Lock' && r.mandatory)).toBe(true);
  });

  it('does not require quality spec rows on save', () => {
    expect(validatePmQualitySpecRows([], bottleCtx)).toEqual({});
  });

  it('hydrates tabular common rows from form_data', () => {
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
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.parameter).toBe('COA from Vendor');
    expect(rows[0]?.mandatory).toBe(true);
  });

  it('hydrates legacy flat qc keys into tabular rows', () => {
    const rows = hydratePmQualitySpecRows({
      qcPmPriBottleHeight: '120 mm',
      qcPmPriCoa: 'Yes — on file',
    });
    expect(rows.some((r) => r.parameter === 'COA')).toBe(true);
    const byPath = hydratePmQualitySubSpecRowsByPath({
      qcPmPriBottleHeight: '120 mm',
    });
    expect(byPath['Primary Pack::Bottle (PET/HDPE)']?.some((r) => r.parameter === 'Height')).toBe(true);
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
        },
      ],
      'Primary Pack::': [],
    });
    expect(Object.keys(byPath)).toEqual(['Primary Pack::Bottle (PET/HDPE)']);
  });
});
