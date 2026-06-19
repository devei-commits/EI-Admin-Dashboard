import { RM_QUALITY_SPEC_FIELD_DEFS } from './rmQualitySpecFields';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type SubSpecTemplate = Omit<QualitySpecTableRow, 'id'>;

const DETAILED_SUB_SPEC_TEMPLATES: Record<string, readonly SubSpecTemplate[]> = {
  'Surfactant::Anionic': [
    {
      parameter: 'Active Matter (sulfate %)',
      specLimit: '27–29% (SLES) / 28–32% (SLS)',
      method: 'Two-phase titration',
      mandatory: false,
      tolerance: 'Per spec',
      frequency: 'Per lot',
      sample: '1g',
      acceptance: 'Within range',
      attachments: [],
    },
    {
      parameter: 'Free Oil',
      specLimit: '≤ 0.5%',
      method: 'Solvent extraction',
      mandatory: false,
      tolerance: '≤ Spec',
      frequency: 'Per lot',
      sample: '5g',
      acceptance: '≤ 0.5%',
      attachments: [],
    },
    {
      parameter: '1,4-Dioxane',
      specLimit: '≤ 10 ppm (FDA / EU)',
      method: 'GC-MS',
      mandatory: true,
      tolerance: '≤ Limit',
      frequency: 'Per vendor / yearly',
      sample: '5g',
      acceptance: '≤ 10 ppm',
      attachments: [],
    },
    {
      parameter: 'Sulfate Content (inorganic)',
      specLimit: '≤ 2.5%',
      method: 'BaCl2 titration',
      mandatory: false,
      tolerance: '≤ Spec',
      frequency: 'Per lot',
      sample: '5g',
      acceptance: '≤ 2.5%',
      attachments: [],
    },
    {
      parameter: 'Color (Hazen / APHA)',
      specLimit: '≤ 50',
      method: 'Colorimeter',
      mandatory: false,
      tolerance: '≤ Limit',
      frequency: 'Per lot',
      sample: '10mL',
      acceptance: '≤ 50',
      attachments: [],
    },
  ],
};

function subSpecPathKey(category: string, subCategory: string): string {
  return `${category}::${subCategory}`;
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
  return subSpecPathKey(category.trim(), subCategory.trim());
}

export function hasRmQualitySubSpecDefaults(category: string, subCategory: string): boolean {
  const key = rmQualitySubSpecPathKey(category, subCategory);
  return Boolean(DETAILED_SUB_SPEC_TEMPLATES[key]?.length || FALLBACK_SUB_SPEC_TEMPLATES[key]?.length);
}

export function cloneRmQualitySubSpecTableDefaults(
  category: string,
  subCategory: string
): QualitySpecTableRow[] {
  const key = rmQualitySubSpecPathKey(category, subCategory);
  const templates =
    DETAILED_SUB_SPEC_TEMPLATES[key] ?? FALLBACK_SUB_SPEC_TEMPLATES[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}
