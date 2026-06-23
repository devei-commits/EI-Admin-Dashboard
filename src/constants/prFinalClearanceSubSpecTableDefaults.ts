import { PR_FINAL_CLEARANCE_SUB_BY_PATH } from './eiMastersFgClearanceSpecs';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type SubSpecTemplate = Omit<QualitySpecTableRow, 'id'>;

/** Paths not covered by EI_FG_Clearance_Specs.html — kept as manual fallbacks. */
const FALLBACK_SUB_SPEC_TEMPLATES: Record<string, readonly SubSpecTemplate[]> = {
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
};

export function prFinalSubSpecPathKey(category: string, subCategory: string): string {
  return `${category.trim()}::${subCategory.trim()}`;
}

export function hasPrFinalClearanceSubSpecDefaults(category: string, subCategory: string): boolean {
  const key = prFinalSubSpecPathKey(category, subCategory);
  return Boolean(
    PR_FINAL_CLEARANCE_SUB_BY_PATH[key]?.length || FALLBACK_SUB_SPEC_TEMPLATES[key]?.length
  );
}

export function clonePrFinalClearanceSubSpecTableDefaults(
  category: string,
  subCategory: string
): QualitySpecTableRow[] {
  const key = prFinalSubSpecPathKey(category, subCategory);
  const templates =
    PR_FINAL_CLEARANCE_SUB_BY_PATH[key] ?? FALLBACK_SUB_SPEC_TEMPLATES[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}

function normalizeFinalClearanceParameterName(parameter: string): string {
  return parameter.trim().replace(/\s+/g, ' ').toLowerCase();
}

function collectSubParameterNames(
  templates: Record<string, readonly SubSpecTemplate[]>
): string[] {
  return Object.values(templates).flatMap((rows) =>
    rows.map((row) => normalizeFinalClearanceParameterName(row.parameter))
  );
}

/** Sub-category FG / pack QC parameters that belong in Final Clearance — not Bulk. */
export const PR_FINAL_CLEARANCE_SUB_PARAMETER_NAMES: ReadonlySet<string> = new Set([
  ...collectSubParameterNames(PR_FINAL_CLEARANCE_SUB_BY_PATH),
  ...collectSubParameterNames(FALLBACK_SUB_SPEC_TEMPLATES),
]);

export function isPrFinalClearanceSubParameter(parameter: string): boolean {
  return PR_FINAL_CLEARANCE_SUB_PARAMETER_NAMES.has(normalizeFinalClearanceParameterName(parameter));
}
