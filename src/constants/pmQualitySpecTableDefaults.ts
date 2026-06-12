import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';
import { PM_QUALITY_SPEC_FIELD_DEFS } from './pmQualitySpecFields';

type CommonSpecTemplate = Omit<QualitySpecTableRow, 'id'>;

const DETAILED_COMMON_TEMPLATES: Record<string, readonly CommonSpecTemplate[]> = {
  'Primary Pack': [
    {
      parameter: 'COA from Vendor',
      specLimit: 'Signed',
      method: 'Doc review',
      mandatory: true,
      tolerance: '—',
      frequency: 'Per lot',
      sample: '1',
      acceptance: 'Signed',
      attachments: [],
    },
    {
      parameter: 'Visual Damage / Defect',
      specLimit: 'No cracks / dents / scratches',
      method: 'Visual @AQL 1.0 critical',
      mandatory: true,
      tolerance: '0 critical',
      frequency: 'Per lot',
      sample: 'AQL',
      acceptance: 'Pass',
      attachments: [],
    },
    {
      parameter: 'Cleanliness',
      specLimit: 'No particles / foreign matter',
      method: 'Visual + Air-blast',
      mandatory: true,
      tolerance: '0 contaminants',
      frequency: 'Per lot',
      sample: 'AQL',
      acceptance: 'Clean',
      attachments: [],
    },
    {
      parameter: 'Material Identity (HDPE/PET/PP/Glass)',
      specLimit: 'Per Master',
      method: 'COA + FTIR (random)',
      mandatory: true,
      tolerance: 'Exact',
      frequency: 'Per vendor / quarterly',
      sample: '1',
      acceptance: 'Match',
      attachments: [],
    },
    {
      parameter: 'Color / Opacity Match',
      specLimit: 'Per artwork master',
      method: 'Visual + Spectrophotometer',
      mandatory: true,
      tolerance: 'ΔE ≤ 3',
      frequency: 'Per lot',
      sample: '5/lot',
      acceptance: 'Match',
      attachments: [],
    },
    {
      parameter: 'Weight per Unit',
      specLimit: 'Per Master',
      method: 'Balance ±0.01g',
      mandatory: true,
      tolerance: '±5%',
      frequency: 'Per lot',
      sample: '10/lot',
      acceptance: 'Within ±5%',
      attachments: [],
    },
    {
      parameter: 'Lot Marking Visible',
      specLimit: 'Vendor lot No. on carton',
      method: 'Visual',
      mandatory: true,
      tolerance: '—',
      frequency: 'Per lot',
      sample: 'All cartons',
      acceptance: 'Visible',
      attachments: [],
    },
    {
      parameter: 'Leak Test (general)',
      specLimit: 'No leak under standard test for that pack format',
      method:
        'Water inversion / Pressure decay / Vacuum / Dye penetration — per sub-cat method below',
      mandatory: false,
      tolerance: '0 leaks',
      frequency: 'Per lot',
      sample: 'AQL 1.0 (critical) / 2.5 (major)',
      acceptance: '0 leaks',
      attachments: [],
    },
    {
      parameter: 'Closure Integrity Test (capped/sealed pack)',
      specLimit: 'No leak when capped + inverted 5 min',
      method: 'Capped + inversion @25°C',
      mandatory: false,
      tolerance: '0 leaks',
      frequency: 'Per lot',
      sample: '10/lot',
      acceptance: '0 leaks',
      attachments: [],
    },
  ],
  'Closures & Pumps': [
    {
      parameter: 'COA from Vendor',
      specLimit: 'Signed',
      method: 'Doc review',
      mandatory: true,
      tolerance: '—',
      frequency: 'Per lot',
      sample: '1',
      acceptance: 'Signed',
      attachments: [],
    },
    {
      parameter: 'Visual Defects',
      specLimit: 'No flash / short-shot / contamination',
      method: 'Visual @AQL',
      mandatory: true,
      tolerance: '0 critical',
      frequency: 'Per lot',
      sample: 'AQL',
      acceptance: 'Pass',
      attachments: [],
    },
    {
      parameter: 'Material Identity',
      specLimit: 'Per Master',
      method: 'COA + FTIR',
      mandatory: true,
      tolerance: 'Match',
      frequency: 'Per vendor',
      sample: '1',
      acceptance: 'Match',
      attachments: [],
    },
    {
      parameter: 'Color Match',
      specLimit: 'Per Master ΔE ≤ 3',
      method: 'Visual + Spectro',
      mandatory: true,
      tolerance: 'ΔE ≤ 3',
      frequency: 'Per lot',
      sample: '5',
      acceptance: 'Match',
      attachments: [],
    },
    {
      parameter: 'Compatibility with Bottle / Tube',
      specLimit: 'Snug fit, leak-proof',
      method: 'Manual fit + leak',
      mandatory: true,
      tolerance: 'No leak',
      frequency: 'Per lot',
      sample: '10',
      acceptance: 'No leak',
      attachments: [],
    },
  ],
  'Secondary Pack': [
    {
      parameter: 'COA',
      specLimit: 'Per vendor',
      method: 'Doc review',
      mandatory: true,
      tolerance: '—',
      frequency: 'Per lot',
      sample: '1',
      acceptance: 'Signed',
      attachments: [],
    },
    {
      parameter: 'Artwork Match',
      specLimit: 'Matches approved artwork',
      method: 'Visual vs proof',
      mandatory: true,
      tolerance: 'Exact',
      frequency: 'Per lot',
      sample: '5',
      acceptance: 'Match',
      attachments: [],
    },
    {
      parameter: 'Pantone / Color Accuracy',
      specLimit: 'ΔE ≤ 3',
      method: 'Spectrophotometer',
      mandatory: true,
      tolerance: 'ΔE ≤ 3',
      frequency: 'Per lot',
      sample: '3',
      acceptance: 'Within range',
      attachments: [],
    },
    {
      parameter: 'Text Legibility',
      specLimit: 'No missing letters / smudge',
      method: 'Visual + Magnifier',
      mandatory: true,
      tolerance: '100% legible',
      frequency: 'Per lot',
      sample: 'AQL',
      acceptance: 'Pass',
      attachments: [],
    },
    {
      parameter: 'Barcode Scan',
      specLimit: 'First-attempt scan',
      method: 'Barcode reader',
      mandatory: true,
      tolerance: '100%',
      frequency: 'Per lot',
      sample: '5',
      acceptance: 'Pass',
      attachments: [],
    },
  ],
};

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
  return Boolean(DETAILED_COMMON_TEMPLATES[key]?.length || FALLBACK_COMMON_TEMPLATES[key]?.length);
}

export function clonePmQualitySpecTableDefaults(category: string): QualitySpecTableRow[] {
  const key = category.trim();
  const templates = DETAILED_COMMON_TEMPLATES[key] ?? FALLBACK_COMMON_TEMPLATES[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}
