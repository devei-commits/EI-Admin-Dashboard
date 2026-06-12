import { normalizePrCategoryForSelect } from './prMasterCategoryOptions';
import { RM_QUALITY_SPEC_TABLE_DEFAULTS } from './rmQualitySpecTableDefaults';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type CommonTemplate = Omit<QualitySpecTableRow, 'id'>;

const HAIR_CARE_BULK_COMMON: readonly CommonTemplate[] = [
  {
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
  {
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
  {
    parameter: 'Viscosity',
    specLimit: 'Per Master',
    method: 'Brookfield',
    mandatory: false,
    tolerance: '±20%',
    frequency: 'Per batch',
    sample: '250g',
    acceptance: 'Within range',
    attachments: [],
  },
  {
    parameter: 'Active Matter (surfactants)',
    specLimit: 'Per Master',
    method: 'Two-phase titration',
    mandatory: false,
    tolerance: '±2%',
    frequency: 'Per batch',
    sample: '2g',
    acceptance: 'Within range',
    attachments: [],
  },
  {
    parameter: 'Microbial',
    specLimit: 'Per IS 14648',
    method: 'USP <61>/<62>',
    mandatory: false,
    tolerance: '≤ Limit',
    frequency: 'Per batch',
    sample: '1g',
    acceptance: 'Pass',
    attachments: [],
  },
];

const CLEANSING_BULK_COMMON: readonly CommonTemplate[] = [
  {
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
  {
    parameter: 'pH',
    specLimit: '5.5–6.5 (skin-pH friendly)',
    method: 'pH meter',
    mandatory: false,
    tolerance: '±0.3',
    frequency: 'Per batch',
    sample: '100g',
    acceptance: 'Within range',
    attachments: [],
  },
  {
    parameter: 'Viscosity',
    specLimit: 'Per Master',
    method: 'Brookfield',
    mandatory: false,
    tolerance: '±20%',
    frequency: 'Per batch',
    sample: '250g',
    acceptance: 'Within range',
    attachments: [],
  },
  {
    parameter: 'Foam Height',
    specLimit: '≥ Master',
    method: 'Ross-Miles',
    mandatory: false,
    tolerance: '≥ Spec',
    frequency: 'Per batch',
    sample: '50mL',
    acceptance: '≥ Spec',
    attachments: [],
  },
  {
    parameter: 'Microbial',
    specLimit: 'Per IS 14648',
    method: 'USP <61>/<62>',
    mandatory: false,
    tolerance: '≤ Limit',
    frequency: 'Per batch',
    sample: '1g',
    acceptance: 'Pass',
    attachments: [],
  },
];

const COLOR_COSMETICS_BULK_COMMON: readonly CommonTemplate[] = [
  {
    parameter: 'Color Shade Match',
    specLimit: 'Per Master ΔE ≤ 2',
    method: 'Spectrophotometer',
    mandatory: false,
    tolerance: 'ΔE ≤ 2',
    frequency: 'Per batch',
    sample: '5g',
    acceptance: 'Match',
    attachments: [],
  },
  {
    parameter: 'Microbial',
    specLimit: 'Per IS',
    method: 'USP <61>/<62>',
    mandatory: false,
    tolerance: '≤ Limit',
    frequency: 'Per batch',
    sample: '1g',
    acceptance: 'Pass',
    attachments: [],
  },
  {
    parameter: 'Heavy Metals',
    specLimit: 'Per IS',
    method: 'ICP-MS',
    mandatory: false,
    tolerance: '≤ Limit',
    frequency: 'Per batch',
    sample: '2g',
    acceptance: '≤ Limit',
    attachments: [],
  },
  {
    parameter: 'Asbestos (talc-based)',
    specLimit: 'Absent',
    method: 'TEM / XRD',
    mandatory: false,
    tolerance: 'Absent',
    frequency: 'Per lot',
    sample: '2g',
    acceptance: 'Absent',
    attachments: [],
  },
];

const BABY_SENSITIVE_BULK_COMMON: readonly CommonTemplate[] = [
  {
    parameter: 'pH (skin-neutral)',
    specLimit: '5.5–7.0',
    method: 'pH meter',
    mandatory: false,
    tolerance: '±0.2',
    frequency: 'Per batch',
    sample: '100g',
    acceptance: 'Within range',
    attachments: [],
  },
  {
    parameter: 'Patch Test (HRIPT)',
    specLimit: 'Pass',
    method: 'HRIPT',
    mandatory: false,
    tolerance: 'No reaction',
    frequency: 'Per new SKU',
    sample: 'Panel',
    acceptance: 'Pass',
    attachments: [],
  },
  {
    parameter: 'Ocular Irritation (HET-CAM)',
    specLimit: 'Minimal',
    method: 'HET-CAM',
    mandatory: false,
    tolerance: 'Class 0–1',
    frequency: 'Per new SKU',
    sample: 'Test',
    acceptance: 'Minimal',
    attachments: [],
  },
  {
    parameter: 'No SLS / SLES (if claimed)',
    specLimit: 'Per claim',
    method: 'COA + formula review',
    mandatory: false,
    tolerance: 'Per claim',
    frequency: 'Per new SKU',
    sample: '1 doc',
    acceptance: 'Verified',
    attachments: [],
  },
  {
    parameter: 'Hypoallergenic Claim (if any)',
    specLimit: 'Per claim',
    method: 'COSMOS / dermatologist-tested doc',
    mandatory: false,
    tolerance: 'Valid',
    frequency: 'Per new SKU',
    sample: '1 doc',
    acceptance: 'Valid',
    attachments: [],
  },
  {
    parameter: 'Heavy Metals',
    specLimit: '≤ stricter limit (baby)',
    method: 'ICP-MS',
    mandatory: false,
    tolerance: '≤ Limit',
    frequency: 'Per batch',
    sample: '2g',
    acceptance: '≤ Limit',
    attachments: [],
  },
];

/** Category-specific bulk-clearance common spec templates. */
const COMMON_BY_CATEGORY: Record<string, readonly CommonTemplate[]> = {
  'Skin Care': RM_QUALITY_SPEC_TABLE_DEFAULTS,
  'Hair Care': HAIR_CARE_BULK_COMMON,
  Cleansing: CLEANSING_BULK_COMMON,
  'Color Cosmetics': COLOR_COSMETICS_BULK_COMMON,
  'Baby / Sensitive': BABY_SENSITIVE_BULK_COMMON,
};

export function hasPrBulkClearanceCommonDefaults(category: string): boolean {
  const key = normalizePrCategoryForSelect(category) || category.trim();
  return Boolean(key && COMMON_BY_CATEGORY[key]?.length);
}

export function clonePrBulkClearanceCommonDefaults(category: string): QualitySpecTableRow[] {
  const key = normalizePrCategoryForSelect(category) || category.trim();
  const templates = (key && COMMON_BY_CATEGORY[key]) || RM_QUALITY_SPEC_TABLE_DEFAULTS;
  return templates.map((row) => createEmptyQualitySpecRow(row));
}
