import { RM_QC_COMMON_BY_CATEGORY } from './eiMastersQualityCheckSpecs';
import { RM_QUALITY_SPEC_FIELD_DEFS } from './rmQualitySpecFields';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type CommonSpecTemplate = Omit<QualitySpecTableRow, 'id'>;

function buildFallbackCommonTemplates(): Record<string, CommonSpecTemplate[]> {
  const map: Record<string, CommonSpecTemplate[]> = {};
  for (const def of RM_QUALITY_SPEC_FIELD_DEFS) {
    if (def.subCategory) continue;
    const key = def.category;
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

const FALLBACK_COMMON_TEMPLATES = buildFallbackCommonTemplates();

export function hasRmQualitySpecDefaults(category: string): boolean {
  const key = category.trim();
  return Boolean(RM_QC_COMMON_BY_CATEGORY[key]?.length || FALLBACK_COMMON_TEMPLATES[key]?.length);
}

export function cloneRmQualitySpecTableDefaults(category: string): QualitySpecTableRow[] {
  const key = category.trim();
  const templates = RM_QC_COMMON_BY_CATEGORY[key] ?? FALLBACK_COMMON_TEMPLATES[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}

/** @deprecated Use cloneRmQualitySpecTableDefaults(category) — kept for legacy imports. */
export function cloneRmQualitySpecTableDefaultsLegacy(): QualitySpecTableRow[] {
  return cloneRmQualitySpecTableDefaults('Surfactant');
}
