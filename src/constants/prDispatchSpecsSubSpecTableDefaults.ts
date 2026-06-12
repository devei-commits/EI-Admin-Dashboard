import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type SubSpecTemplate = Omit<QualitySpecTableRow, 'id'>;

const DETAILED_SUB_SPEC_TEMPLATES: Record<string, readonly SubSpecTemplate[]> = {
  'Skin Care::Cream': [
    {
      parameter: 'Storage Temp Indicator',
      specLimit: '≤ 30°C in transit (typical)',
      method: 'Reefer / temp logger',
      mandatory: true,
      tolerance: '≤ 30°C',
      frequency: 'Per vehicle',
      sample: 'Logger',
      acceptance: 'Within range',
      attachments: [],
    },
  ],
};

export function prDispatchSubSpecPathKey(category: string, subCategory: string): string {
  return `${category.trim()}::${subCategory.trim()}`;
}

export function hasPrDispatchSpecsSubSpecDefaults(category: string, subCategory: string): boolean {
  const key = prDispatchSubSpecPathKey(category, subCategory);
  return Boolean(DETAILED_SUB_SPEC_TEMPLATES[key]?.length);
}

export function clonePrDispatchSpecsSubSpecTableDefaults(
  category: string,
  subCategory: string
): QualitySpecTableRow[] {
  const key = prDispatchSubSpecPathKey(category, subCategory);
  const templates = DETAILED_SUB_SPEC_TEMPLATES[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}
