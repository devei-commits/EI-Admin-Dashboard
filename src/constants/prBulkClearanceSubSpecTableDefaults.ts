import { PR_BULK_CLEARANCE_SUB_BY_PATH } from './eiMastersFgClearanceSpecs';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type SubSpecTemplate = Omit<QualitySpecTableRow, 'id'>;

/** Paths not covered by EI_FG_Clearance_Specs.html — kept as manual fallbacks. */
const FALLBACK_SUB_SPEC_TEMPLATES: Record<string, readonly SubSpecTemplate[]> = {
  'Color Cosmetics::Lipstick': [
    {
      parameter: 'Hardness (Penetrometer)',
      specLimit: 'Per Master',
      method: 'Penetrometer',
      mandatory: false,
      tolerance: '± Per spec',
      frequency: 'Per batch',
      sample: '5',
      acceptance: 'Within range',
      attachments: [],
    },
    {
      parameter: 'Drop Test (case drop)',
      specLimit: 'No break from 30 cm',
      method: 'Drop test',
      mandatory: false,
      tolerance: 'No break',
      frequency: 'Per batch',
      sample: '5',
      acceptance: 'Pass',
      attachments: [],
    },
    {
      parameter: 'Melting Point',
      specLimit: 'Per Master °C',
      method: 'Capillary tube',
      mandatory: false,
      tolerance: '± Per spec',
      frequency: 'Per batch',
      sample: '5g',
      acceptance: 'Within range',
      attachments: [],
    },
    {
      parameter: 'Pay-off (color deposit)',
      specLimit: 'Per Master',
      method: 'Standard surface drag',
      mandatory: false,
      tolerance: 'Per spec',
      frequency: 'Per batch',
      sample: '1 stick',
      acceptance: 'Pass',
      attachments: [],
    },
  ],
  'Cleansing::Facewash': [
    {
      parameter: 'Lather Density',
      specLimit: 'Per Master',
      method: 'Manual lather',
      mandatory: false,
      tolerance: 'Per spec',
      frequency: 'Per batch',
      sample: '10g',
      acceptance: 'Pass',
      attachments: [],
    },
  ],
};

export function prBulkSubSpecPathKey(category: string, subCategory: string): string {
  return `${category.trim()}::${subCategory.trim()}`;
}

export function hasPrBulkClearanceSubSpecDefaults(category: string, subCategory: string): boolean {
  const key = prBulkSubSpecPathKey(category, subCategory);
  return Boolean(
    PR_BULK_CLEARANCE_SUB_BY_PATH[key]?.length || FALLBACK_SUB_SPEC_TEMPLATES[key]?.length
  );
}

export function clonePrBulkClearanceSubSpecTableDefaults(
  category: string,
  subCategory: string
): QualitySpecTableRow[] {
  const key = prBulkSubSpecPathKey(category, subCategory);
  const templates =
    PR_BULK_CLEARANCE_SUB_BY_PATH[key] ?? FALLBACK_SUB_SPEC_TEMPLATES[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}
