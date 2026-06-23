import { RM_QC_SUB_BY_PATH } from './eiMastersQualityCheckSpecs';
import { RM_QUALITY_SPEC_FIELD_DEFS } from './rmQualitySpecFields';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type SubSpecTemplate = Omit<QualitySpecTableRow, 'id'>;

function subSpecPathKey(category: string, subCategory: string): string {
  return `${category.trim()}::${subCategory.trim()}`;
}

function buildFallbackTemplatesFromFieldDefs(): Record<string, SubSpecTemplate[]> {
  const map: Record<string, SubSpecTemplate[]> = {};
  for (const def of RM_QUALITY_SPEC_FIELD_DEFS) {
    if (!def.subCategory) continue;
    const key = subSpecPathKey(def.category, def.subCategory);
    if (!map[key]) map[key] = [];
    map[key].push({
      parameter: def.label,
      specLimit: '',
      method: '',
      mandatory: def.mandatory,
      tolerance: '',
      frequency: '',
      sample: '',
      acceptance: '',
      attachments: [],
    });
  }
  return map;
}

const FALLBACK_SUB_SPEC_TEMPLATES = buildFallbackTemplatesFromFieldDefs();

export function rmQualitySubSpecPathKey(category: string, subCategory: string): string {
  return subSpecPathKey(category, subCategory);
}

export function hasRmQualitySubSpecDefaults(category: string, subCategory: string): boolean {
  const key = rmQualitySubSpecPathKey(category, subCategory);
  return Boolean(RM_QC_SUB_BY_PATH[key]?.length || FALLBACK_SUB_SPEC_TEMPLATES[key]?.length);
}

export function cloneRmQualitySubSpecTableDefaults(
  category: string,
  subCategory: string
): QualitySpecTableRow[] {
  const key = rmQualitySubSpecPathKey(category, subCategory);
  const templates = RM_QC_SUB_BY_PATH[key] ?? FALLBACK_SUB_SPEC_TEMPLATES[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}
