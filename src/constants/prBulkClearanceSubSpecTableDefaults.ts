import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type SubSpecTemplate = Omit<QualitySpecTableRow, 'id'>;

const DETAILED_SUB_SPEC_TEMPLATES: Record<string, readonly SubSpecTemplate[]> = {
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
  'Hair Care::Shampoo': [
    {
      parameter: 'Foam Height (Ross-Miles)',
      specLimit: '≥ Master (mm)',
      method: 'Ross-Miles',
      mandatory: false,
      tolerance: '≥ Spec',
      frequency: 'Per batch',
      sample: '50mL',
      acceptance: '≥ Spec',
      attachments: [],
    },
    {
      parameter: 'Foam Stability',
      specLimit: '≥ Master @ 5 min',
      method: 'Cylinder shake',
      mandatory: false,
      tolerance: '≥ Spec',
      frequency: 'Per batch',
      sample: '50mL',
      acceptance: 'Pass',
      attachments: [],
    },
    {
      parameter: 'Cleansing Efficacy (sebum test)',
      specLimit: 'Per Master',
      method: 'Standard sebum removal',
      mandatory: false,
      tolerance: 'Per spec',
      frequency: 'Per new SKU',
      sample: 'Hair tresses',
      acceptance: 'Pass',
      attachments: [],
    },
  ],
  'Skin Care::Cream': [
    {
      parameter: 'Phase Stability (45°C/RT/5°C × 7d)',
      specLimit: 'No separation',
      method: 'Cycling test',
      mandatory: false,
      tolerance: 'No separation',
      frequency: 'Per new SKU',
      sample: '3 vials',
      acceptance: 'Stable',
      attachments: [],
    },
    {
      parameter: 'Active Assay',
      specLimit: '90–110% label',
      method: 'HPLC',
      mandatory: false,
      tolerance: '90–110%',
      frequency: 'Per batch',
      sample: '2g',
      acceptance: 'Within range',
      attachments: [],
    },
    {
      parameter: 'Spreadability',
      specLimit: 'Per Master',
      method: 'Parallel plate',
      mandatory: false,
      tolerance: 'Per spec',
      frequency: 'Per batch',
      sample: '10g',
      acceptance: 'Within range',
      attachments: [],
    },
    {
      parameter: 'Centrifuge Test',
      specLimit: 'No separation @3000 rpm × 30 min',
      method: 'Centrifuge',
      mandatory: false,
      tolerance: 'No separation',
      frequency: 'Per batch',
      sample: '10mL',
      acceptance: 'Stable',
      attachments: [],
    },
  ],
};

export function prBulkSubSpecPathKey(category: string, subCategory: string): string {
  return `${category.trim()}::${subCategory.trim()}`;
}

export function hasPrBulkClearanceSubSpecDefaults(category: string, subCategory: string): boolean {
  const key = prBulkSubSpecPathKey(category, subCategory);
  return Boolean(DETAILED_SUB_SPEC_TEMPLATES[key]?.length);
}

export function clonePrBulkClearanceSubSpecTableDefaults(
  category: string,
  subCategory: string
): QualitySpecTableRow[] {
  const key = prBulkSubSpecPathKey(category, subCategory);
  const templates = DETAILED_SUB_SPEC_TEMPLATES[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}
