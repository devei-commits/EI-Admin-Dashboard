import { PM_QC_COMMON_BY_CATEGORY } from './eiMastersQualityCheckSpecs';
import { PM_QUALITY_SPEC_FIELD_DEFS } from './pmQualitySpecFields';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type CommonSpecTemplate = Omit<QualitySpecTableRow, 'id'>;

function buildFallbackCommonTemplates(): Record<string, CommonSpecTemplate[]> {
  const map: Record<string, CommonSpecTemplate[]> = {};
  for (const def of PM_QUALITY_SPEC_FIELD_DEFS) {
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

export function hasPmQualitySpecDefaults(category: string): boolean {
  const key = category.trim();
  return Boolean(PM_QC_COMMON_BY_CATEGORY[key]?.length || FALLBACK_COMMON_TEMPLATES[key]?.length);
}

export function clonePmQualitySpecTableDefaults(category: string): QualitySpecTableRow[] {
  const key = category.trim();
  const templates = PM_QC_COMMON_BY_CATEGORY[key] ?? FALLBACK_COMMON_TEMPLATES[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}
