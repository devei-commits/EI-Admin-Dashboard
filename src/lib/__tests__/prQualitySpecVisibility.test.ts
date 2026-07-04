import { describe, expect, it } from 'vitest';
import {
  flattenPrQualitySpecRowsBySectionForPayload,
  getDefaultPrBulkClearanceSubRows,
  getDefaultPrFinalClearanceSubRows,
  hydratePrQualityBulkSubSpecRowsByPath,
  hydratePrQualityFinalSubSpecRowsByPath,
  hydratePrQualitySpecRowsBySection,
  reconcileMisplacedPrFinalClearanceSpecs,
  seedPrQualitySpecsIfEmpty,
} from '../prQualitySpecVisibility';

describe('prQualitySpecVisibility', () => {
  it('hydrates tabular rows by section from API payload', () => {
    const bySection = hydratePrQualitySpecRowsBySection({
      pr_quality_spec_rows_by_section: {
        bulkClearance: [
          {
            id: 'b1',
            parameter: 'pH',
            specLimit: 'Per Master',
            method: 'pH meter @25°C',
            mandatory: false,
            tolerance: '±0.3',
            frequency: 'Per batch',
            sample: '100g',
            acceptance: 'Within range',
            attachments: [],
          },
        ],
      },
    });
    expect(bySection.bulkClearance).toHaveLength(1);
    expect(bySection.bulkClearance[0]?.parameter).toBe('pH');
    expect(bySection.finalClearance).toEqual([]);
  });

  it('hydrates bulk sub-category rows by path', () => {
    const byPath = hydratePrQualityBulkSubSpecRowsByPath({
      pr_quality_bulk_sub_spec_rows_by_path: {
        'Skin Care::Cream': [
          {
            id: 's1',
            parameter: 'Spreadability',
            specLimit: 'Per Master',
            method: 'Parallel plate',
            mandatory: false,
            tolerance: 'Per spec',
            frequency: 'Per batch',
            sample: '10g',
            acceptance: 'Within range',
            attachments: [],
          },
        ],
      },
    });
    expect(byPath['Skin Care::Cream']?.[0]?.parameter).toBe('Spreadability');
  });

  it('seeds Skin Care / Cream bulk common and sub defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Skin Care', prSubCategory: 'Cream' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'Appearance')).toBe(true);
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'Hold Time (bulk)')).toBe(true);
    expect(seeded.bulkSubByPath['Skin Care::Cream']?.some((r) => r.parameter === 'Active Assay (HPLC)')).toBe(
      true
    );
  });

  it('moves FG / pack QC rows from bulk clearance into final clearance', () => {
    const reconciled = reconcileMisplacedPrFinalClearanceSpecs(
      {
        bulkClearance: [
          {
            id: 'b1',
            parameter: 'Fill Volume / Weight',
            specLimit: 'Per label ±2%',
            method: 'Balance ±0.01g',
            mandatory: true,
            tolerance: '±2%',
            frequency: 'Every 30 min',
            sample: '10/check',
            acceptance: 'Within ±2%',
            attachments: [],
          },
          {
            id: 'b2',
            parameter: 'pH',
            specLimit: 'Per Master',
            method: 'pH meter',
            mandatory: false,
            tolerance: '±0.3',
            frequency: 'Per batch',
            sample: '100g',
            acceptance: 'Within range',
            attachments: [],
          },
        ],
        finalClearance: [],
        dispatchSpecs: [],
      },
      {
        'Skin Care::Cream': [
          {
            id: 's1',
            parameter: 'Cap Torque',
            specLimit: '8–12 in-lbs',
            method: 'Torque meter',
            mandatory: true,
            tolerance: '8–12 in-lbs',
            frequency: '',
            sample: '',
            acceptance: 'Pass',
            attachments: [],
          },
          {
            id: 's2',
            parameter: 'Appearance',
            specLimit: 'White homogeneous cream',
            method: 'Visual',
            mandatory: true,
            tolerance: 'Match',
            frequency: '',
            sample: '',
            acceptance: 'Match',
            attachments: [],
          },
        ],
      },
      {}
    );
    expect(reconciled.bySection.bulkClearance.map((r) => r.parameter)).toEqual(['pH']);
    expect(reconciled.bySection.finalClearance.map((r) => r.parameter)).toEqual(['Fill Volume / Weight']);
    expect(reconciled.bulkSubByPath['Skin Care::Cream']?.map((r) => r.parameter)).toEqual(['Appearance']);
    expect(reconciled.finalSubByPath['Skin Care::Cream']?.map((r) => r.parameter)).toEqual(['Cap Torque']);
  });

  it('seeds Skin Care / Cleansers dispatch common defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Skin Care', prSubCategory: 'Cleansers' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {},
      {}
    );
    expect(seeded.bySection.dispatchSpecs.some((r) => r.parameter === 'SO + Picking Match')).toBe(true);
    expect(seeded.bySection.dispatchSpecs.some((r) => r.parameter === 'FIFO Compliance')).toBe(true);
    expect(seeded.dispatchSubByPath['Skin Care::Cleansers']).toBeUndefined();
  });

  it('seeds Skin Care / Cream dispatch common and sub defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Skin Care', prSubCategory: 'Cream' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {},
      {}
    );
    expect(seeded.bySection.dispatchSpecs.some((r) => r.parameter === 'SO + Picking Match')).toBe(true);
    expect(
      seeded.bySection.dispatchSpecs.some((r) => r.parameter === 'Tax Invoice + E-way Bill + Packing List + COA')
    ).toBe(true);
    expect(
      seeded.dispatchSubByPath['Skin Care::Cream']?.some((r) => r.parameter === 'Packs per Shipper')
    ).toBe(true);
  });

  it('seeds Skin Care / Cream final clearance common and sub defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Skin Care', prSubCategory: 'Cream' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.finalClearance.some((r) => r.parameter === 'Fill Volume / Weight')).toBe(true);
    expect(seeded.bySection.finalClearance.some((r) => r.parameter === 'COA + Retain Sample')).toBe(true);
    expect(
      seeded.finalSubByPath['Skin Care::Cream']?.some((r) => r.parameter === 'Cap Torque')
    ).toBe(true);
    expect(
      seeded.finalSubByPath['Skin Care::Cream']?.some((r) => r.parameter === 'Net Weight')
    ).toBe(true);
  });

  it('hydrates final sub-category rows by path', () => {
    const byPath = hydratePrQualityFinalSubSpecRowsByPath({
      pr_quality_final_sub_spec_rows_by_path: {
        'Skin Care::Cream': [
          {
            id: 'f1',
            parameter: 'Cap Torque (Jar Lid)',
            specLimit: 'Per Master kgf-cm',
            method: 'Torque meter',
            mandatory: true,
            tolerance: '±10%',
            frequency: 'Every 30 min',
            sample: '5/check',
            acceptance: 'Within range',
            attachments: [],
          },
        ],
      },
    });
    expect(byPath['Skin Care::Cream']?.[0]?.parameter).toBe('Cap Torque (Jar Lid)');
  });

  it('provides Cream final sub-category default template', () => {
    const rows = getDefaultPrFinalClearanceSubRows({ category: 'Skin Care', prSubCategory: 'Cream' });
    expect(rows.some((r) => r.parameter === 'Cap Torque')).toBe(true);
    expect(rows.some((r) => r.parameter === 'Net Weight')).toBe(true);
  });

  it('seeds Others custom sub-category with Skin Care final clearance fallback when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Others', prSubCategory: 'Lipstick' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.finalClearance.some((r) => r.parameter === 'Fill Volume / Weight')).toBe(true);
    expect(seeded.finalSubByPath['Others::Lipstick']).toBeUndefined();
  });

  it('seeds Hair Care / Shampoos final clearance common and sub defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Hair Care', prSubCategory: 'Shampoos' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.finalClearance.some((r) => r.parameter === 'Fill Volume')).toBe(true);
    expect(seeded.bySection.finalClearance.some((r) => r.parameter === 'Coding + Labels + Carton')).toBe(true);
    expect(
      seeded.finalSubByPath['Hair Care::Shampoos']?.some((r) => r.parameter === 'Net Volume')
    ).toBe(true);
  });

  it('provides Cream sub-category default template', () => {
    const rows = getDefaultPrBulkClearanceSubRows({ category: 'Skin Care', prSubCategory: 'Cream' });
    expect(rows.some((r) => r.parameter === 'Appearance')).toBe(true);
    expect(rows.some((r) => r.parameter === 'Active Assay (HPLC)')).toBe(true);
  });

  it('seeds Hair Care / Shampoos bulk common and sub defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Hair Care', prSubCategory: 'Shampoos' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'Active Matter (surfactants)')).toBe(
      true
    );
    expect(seeded.bulkSubByPath['Hair Care::Shampoos']?.some((r) => r.parameter === 'Foam Volume (Ross-Miles)')).toBe(
      true
    );
  });

  it('seeds Skin Care / Cleansers bulk common and sub defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Skin Care', prSubCategory: 'Cleansers' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'Appearance')).toBe(true);
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'pH')).toBe(true);
    expect(seeded.bulkSubByPath['Skin Care::Cleansers']?.some((r) => r.parameter === 'Lather Density')).toBe(
      true
    );
  });

  it('maps legacy Color Cosmetics into Others with custom sub-category', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Color Cosmetics', prSubCategory: 'Lipstick' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'Appearance')).toBe(true);
    expect(seeded.bulkSubByPath['Others::Lipstick']).toBeUndefined();
  });

  it('maps legacy Baby / Sensitive into Others with custom sub-category', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Baby / Sensitive', prSubCategory: 'Baby Lotion' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.finalClearance.some((r) => r.parameter === 'Tamper Evidence')).toBe(true);
    expect(seeded.finalSubByPath['Others::Baby Lotion']).toBeUndefined();
  });

  it('seeds Others custom sub-category bulk common fallback when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Others', prSubCategory: 'Baby Lotion' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'Appearance')).toBe(true);
    expect(seeded.bulkSubByPath['Others::Baby Lotion']).toBeUndefined();
  });

  it('provides Sunscreens bulk sub-category defaults from FG clearance HTML', () => {
    const rows = getDefaultPrBulkClearanceSubRows({ category: 'Skin Care', prSubCategory: 'Sunscreens' });
    expect(rows.some((r) => r.parameter === 'In-vitro SPF (test patch)')).toBe(true);
  });

  it('returns empty sub defaults for Actives (no fixed templates — user adds specs)', () => {
    const rows = getDefaultPrBulkClearanceSubRows({ category: 'Skin Care', prSubCategory: 'Actives' });
    expect(rows).toEqual([]);
  });

  it('returns empty sub defaults for Skin Care / Others and Hair Care / Others', () => {
    expect(getDefaultPrBulkClearanceSubRows({ category: 'Skin Care', prSubCategory: 'Others' })).toEqual([]);
    expect(getDefaultPrBulkClearanceSubRows({ category: 'Hair Care', prSubCategory: 'Others' })).toEqual([]);
  });

  it('flattens empty parameters out of save payload', () => {
    const out = flattenPrQualitySpecRowsBySectionForPayload({
      bulkClearance: [
        {
          id: 'x',
          parameter: '  ',
          specLimit: '',
          method: '',
          mandatory: false,
          tolerance: '',
          frequency: '',
          sample: '',
          acceptance: '',
          attachments: [],
        },
        {
          id: 'y',
          parameter: 'Appearance',
          specLimit: 'Per Master',
          method: 'Visual',
          mandatory: false,
          tolerance: 'Match',
          frequency: 'Per batch',
          sample: '10g',
          acceptance: 'Match',
          attachments: [],
        },
      ],
      finalClearance: [],
      dispatchSpecs: [],
    });
    expect(out.bulkClearance).toHaveLength(1);
    expect(out.bulkClearance[0]?.parameter).toBe('Appearance');
  });
});
