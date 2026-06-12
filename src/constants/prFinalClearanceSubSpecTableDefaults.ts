import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type SubSpecTemplate = Omit<QualitySpecTableRow, 'id'>;

const DETAILED_SUB_SPEC_TEMPLATES: Record<string, readonly SubSpecTemplate[]> = {
  'Hair Care::Shampoo': [
    {
      parameter: 'Squeeze Bottle Function',
      specLimit: 'Even flow',
      method: 'Manual',
      mandatory: true,
      tolerance: 'Even',
      frequency: 'Per shift',
      sample: '5/check',
      acceptance: 'Pass',
      attachments: [],
    },
  ],
  'Color Cosmetics::Lipstick': [
    {
      parameter: 'Bullet Orientation',
      specLimit: 'Per Master',
      method: 'Visual',
      mandatory: true,
      tolerance: 'Match',
      frequency: 'Per batch',
      sample: '5',
      acceptance: 'Match',
      attachments: [],
    },
  ],
  'Skin Care::Cream': [
    {
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
      parameter: 'No Air Pockets in Jar',
      specLimit: 'Surface even',
      method: 'Visual',
      mandatory: true,
      tolerance: 'No pockets',
      frequency: 'Per shift',
      sample: 'AQL',
      acceptance: 'Pass',
      attachments: [],
    },
  ],
};

export function prFinalSubSpecPathKey(category: string, subCategory: string): string {
  return `${category.trim()}::${subCategory.trim()}`;
}

export function hasPrFinalClearanceSubSpecDefaults(category: string, subCategory: string): boolean {
  const key = prFinalSubSpecPathKey(category, subCategory);
  return Boolean(DETAILED_SUB_SPEC_TEMPLATES[key]?.length);
}

export function clonePrFinalClearanceSubSpecTableDefaults(
  category: string,
  subCategory: string
): QualitySpecTableRow[] {
  const key = prFinalSubSpecPathKey(category, subCategory);
  const templates = DETAILED_SUB_SPEC_TEMPLATES[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}

function normalizeFinalClearanceParameterName(parameter: string): string {
  return parameter.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Sub-category FG / pack QC parameters that belong in Final Clearance — not Bulk. */
export const PR_FINAL_CLEARANCE_SUB_PARAMETER_NAMES: ReadonlySet<string> = new Set(
  Object.values(DETAILED_SUB_SPEC_TEMPLATES).flatMap((templates) =>
    templates.map((row) => normalizeFinalClearanceParameterName(row.parameter))
  )
);

export function isPrFinalClearanceSubParameter(parameter: string): boolean {
  return PR_FINAL_CLEARANCE_SUB_PARAMETER_NAMES.has(normalizeFinalClearanceParameterName(parameter));
}
