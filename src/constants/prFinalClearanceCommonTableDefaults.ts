import { normalizePrCategoryForSelect } from './prMasterCategoryOptions';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type CommonTemplate = Omit<QualitySpecTableRow, 'id'>;

const SKIN_CARE_FINAL_COMMON: readonly CommonTemplate[] = [
  {
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
    parameter: 'Net Content Min',
    specLimit: '≥ Label declared',
    method: 'Balance',
    mandatory: true,
    tolerance: '≥ Declared',
    frequency: 'Every shift',
    sample: '25/run',
    acceptance: 'No unit < declared',
    attachments: [],
  },
  {
    parameter: 'Tamper Evidence',
    specLimit: 'Seal intact',
    method: 'Visual',
    mandatory: true,
    tolerance: '100%',
    frequency: 'Every unit',
    sample: 'AQL',
    acceptance: '100%',
    attachments: [],
  },
  {
    parameter: 'Label Alignment & Coding',
    specLimit: 'Per Master',
    method: 'Visual + scanner',
    mandatory: true,
    tolerance: 'Per spec',
    frequency: 'Every 30 min',
    sample: '10/check',
    acceptance: 'Pass',
    attachments: [],
  },
  {
    parameter: 'Master Carton Sealing + Label',
    specLimit: 'Per Master',
    method: 'Visual',
    mandatory: true,
    tolerance: '100%',
    frequency: 'Every carton',
    sample: 'All',
    acceptance: 'Pass',
    attachments: [],
  },
  {
    parameter: 'COA + Retain Sample',
    specLimit: 'Generated + stored',
    method: 'Doc + storage',
    mandatory: true,
    tolerance: '—',
    frequency: 'Per batch',
    sample: '≥3 units',
    acceptance: 'Stored',
    attachments: [],
  },
];

const HAIR_CARE_FINAL_COMMON: readonly CommonTemplate[] = [
  {
    parameter: 'Fill Volume',
    specLimit: 'Per label ±2%',
    method: 'Balance',
    mandatory: true,
    tolerance: '±2%',
    frequency: 'Every 30 min',
    sample: '10/check',
    acceptance: 'Within range',
    attachments: [],
  },
  {
    parameter: 'Coding + Labels + Carton',
    specLimit: 'Per Master',
    method: 'Visual',
    mandatory: true,
    tolerance: '100%',
    frequency: 'Every shift',
    sample: 'AQL',
    acceptance: 'Pass',
    attachments: [],
  },
];

const COLOR_COSMETICS_FINAL_COMMON: readonly CommonTemplate[] = [
  {
    parameter: 'Weight / Volume per Unit',
    specLimit: 'Per Master',
    method: 'Balance',
    mandatory: true,
    tolerance: '±2%',
    frequency: 'Every shift',
    sample: '10',
    acceptance: 'Within range',
    attachments: [],
  },
];

const BABY_SENSITIVE_FINAL_COMMON: readonly CommonTemplate[] = [
  {
    parameter: 'Tamper Evidence',
    specLimit: 'Intact',
    method: 'Visual',
    mandatory: true,
    tolerance: '100%',
    frequency: 'Per unit',
    sample: 'All',
    acceptance: 'Pass',
    attachments: [],
  },
];

/** Category-specific final-clearance common spec templates (FG / pack QC). */
const COMMON_BY_CATEGORY: Record<string, readonly CommonTemplate[]> = {
  'Skin Care': SKIN_CARE_FINAL_COMMON,
  'Hair Care': HAIR_CARE_FINAL_COMMON,
  'Color Cosmetics': COLOR_COSMETICS_FINAL_COMMON,
  'Baby / Sensitive': BABY_SENSITIVE_FINAL_COMMON,
};

export function hasPrFinalClearanceCommonDefaults(category: string): boolean {
  const key = normalizePrCategoryForSelect(category) || category.trim();
  return Boolean(key && COMMON_BY_CATEGORY[key]?.length);
}

export function clonePrFinalClearanceCommonDefaults(category: string): QualitySpecTableRow[] {
  const key = normalizePrCategoryForSelect(category) || category.trim();
  const templates = (key && COMMON_BY_CATEGORY[key]) || SKIN_CARE_FINAL_COMMON;
  return templates.map((row) => createEmptyQualitySpecRow(row));
}

function normalizeFinalClearanceParameterName(parameter: string): string {
  return parameter.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** FG / pack QC parameters that belong in Final Clearance — not Bulk Clearance. */
export const PR_FINAL_CLEARANCE_COMMON_PARAMETER_NAMES: ReadonlySet<string> = new Set(
  Object.values(COMMON_BY_CATEGORY)
    .flatMap((templates) => templates.map((row) => normalizeFinalClearanceParameterName(row.parameter)))
);

export function isPrFinalClearanceCommonParameter(parameter: string): boolean {
  return PR_FINAL_CLEARANCE_COMMON_PARAMETER_NAMES.has(normalizeFinalClearanceParameterName(parameter));
}
