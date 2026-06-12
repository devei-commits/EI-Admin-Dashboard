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
    expect(seeded.bulkSubByPath['Skin Care::Cream']?.some((r) => r.parameter === 'Centrifuge Test')).toBe(
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
          {
            id: 's2',
            parameter: 'Centrifuge Test',
            specLimit: 'No separation @3000 rpm × 30 min',
            method: 'Centrifuge',
            mandatory: false,
            tolerance: 'No separation',
            frequency: 'Per batch',
            sample: '10mL',
            acceptance: 'Stable',
            attachments: [],
          },
        ],
      },
      {}
    );
    expect(reconciled.bySection.bulkClearance.map((r) => r.parameter)).toEqual(['pH']);
    expect(reconciled.bySection.finalClearance.map((r) => r.parameter)).toEqual(['Fill Volume / Weight']);
    expect(reconciled.bulkSubByPath['Skin Care::Cream']?.map((r) => r.parameter)).toEqual(['Centrifuge Test']);
    expect(reconciled.finalSubByPath['Skin Care::Cream']?.map((r) => r.parameter)).toEqual([
      'Cap Torque (Jar Lid)',
    ]);
  });

  it('seeds Cleansing / Facewash dispatch common defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Cleansing', prSubCategory: 'Facewash' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {},
      {}
    );
    expect(seeded.bySection.dispatchSpecs.some((r) => r.parameter === 'SO + Picking Match')).toBe(true);
    expect(seeded.bySection.dispatchSpecs.some((r) => r.parameter === 'FIFO Compliance')).toBe(true);
    expect(seeded.dispatchSubByPath['Cleansing::Facewash']).toBeUndefined();
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
      seeded.dispatchSubByPath['Skin Care::Cream']?.some((r) => r.parameter === 'Storage Temp Indicator')
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
      seeded.finalSubByPath['Skin Care::Cream']?.some((r) => r.parameter === 'Cap Torque (Jar Lid)')
    ).toBe(true);
    expect(
      seeded.finalSubByPath['Skin Care::Cream']?.some((r) => r.parameter === 'No Air Pockets in Jar')
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
    expect(rows.some((r) => r.parameter === 'Cap Torque (Jar Lid)')).toBe(true);
  });

  it('seeds Color Cosmetics / Lipstick final clearance common and sub defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Color Cosmetics', prSubCategory: 'Lipstick' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.finalClearance.some((r) => r.parameter === 'Weight / Volume per Unit')).toBe(
      true
    );
    expect(
      seeded.finalSubByPath['Color Cosmetics::Lipstick']?.some((r) => r.parameter === 'Bullet Orientation')
    ).toBe(true);
  });

  it('seeds Hair Care / Shampoo final clearance common and sub defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Hair Care', prSubCategory: 'Shampoo' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.finalClearance.some((r) => r.parameter === 'Fill Volume')).toBe(true);
    expect(seeded.bySection.finalClearance.some((r) => r.parameter === 'Coding + Labels + Carton')).toBe(true);
    expect(
      seeded.finalSubByPath['Hair Care::Shampoo']?.some((r) => r.parameter === 'Squeeze Bottle Function')
    ).toBe(true);
  });

  it('provides Cream sub-category default template', () => {
    const rows = getDefaultPrBulkClearanceSubRows({ category: 'Skin Care', prSubCategory: 'Cream' });
    expect(rows.some((r) => r.parameter.startsWith('Phase Stability'))).toBe(true);
  });

  it('seeds Hair Care / Shampoo bulk common and sub defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Hair Care', prSubCategory: 'Shampoo' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'Active Matter (surfactants)')).toBe(
      true
    );
    expect(seeded.bulkSubByPath['Hair Care::Shampoo']?.some((r) => r.parameter === 'Foam Stability')).toBe(
      true
    );
  });

  it('seeds Cleansing / Facewash bulk common and sub defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Cleansing', prSubCategory: 'Facewash' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'Foam Height')).toBe(true);
    expect(
      seeded.bySection.bulkClearance.some((r) => r.specLimit === '5.5–6.5 (skin-pH friendly)')
    ).toBe(true);
    expect(seeded.bulkSubByPath['Cleansing::Facewash']?.some((r) => r.parameter === 'Lather Density')).toBe(
      true
    );
  });

  it('seeds Color Cosmetics / Lipstick bulk common and sub defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Color Cosmetics', prSubCategory: 'Lipstick' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'Color Shade Match')).toBe(true);
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'Asbestos (talc-based)')).toBe(true);
    expect(
      seeded.bulkSubByPath['Color Cosmetics::Lipstick']?.some((r) => r.parameter === 'Pay-off (color deposit)')
    ).toBe(true);
  });

  it('seeds Baby / Sensitive / Baby Lotion final clearance common defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Baby / Sensitive', prSubCategory: 'Baby Lotion' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.finalClearance.some((r) => r.parameter === 'Tamper Evidence')).toBe(true);
    expect(seeded.bySection.finalClearance[0]?.specLimit).toBe('Intact');
    expect(seeded.finalSubByPath['Baby / Sensitive::Baby Lotion']).toBeUndefined();
  });

  it('seeds Baby / Sensitive / Baby Lotion bulk common defaults when empty', () => {
    const seeded = seedPrQualitySpecsIfEmpty(
      { category: 'Baby / Sensitive', prSubCategory: 'Baby Lotion' },
      hydratePrQualitySpecRowsBySection({}),
      {},
      {}
    );
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'pH (skin-neutral)')).toBe(true);
    expect(seeded.bySection.bulkClearance.some((r) => r.parameter === 'Patch Test (HRIPT)')).toBe(true);
    expect(seeded.bySection.bulkClearance.some((r) => r.specLimit === '≤ stricter limit (baby)')).toBe(true);
    expect(seeded.bulkSubByPath['Baby / Sensitive::Baby Lotion']).toBeUndefined();
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
