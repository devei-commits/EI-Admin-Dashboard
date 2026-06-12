import { PM_QUALITY_SPEC_FIELD_DEFS } from './pmQualitySpecFields';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type SubSpecTemplate = Omit<QualitySpecTableRow, 'id'>;

const DETAILED_SUB_SPEC_TEMPLATES: Record<string, readonly SubSpecTemplate[]> = {
  'Primary Pack::Bottle (PET/HDPE)': [
    {
      parameter: 'Height',
      specLimit: 'Per Master mm',
      method: 'Vernier caliper',
      mandatory: true,
      tolerance: '±0.5 mm',
      frequency: 'Per lot',
      sample: '10',
      acceptance: 'Within tolerance',
      attachments: [],
    },
    {
      parameter: 'Body Diameter',
      specLimit: 'Per Master mm',
      method: 'Vernier caliper',
      mandatory: true,
      tolerance: '±0.3 mm',
      frequency: 'Per lot',
      sample: '10',
      acceptance: 'Within tolerance',
      attachments: [],
    },
    {
      parameter: 'Neck Finish',
      specLimit: 'Per Master std (24/410, 28/415)',
      method: 'Plug gauge',
      mandatory: true,
      tolerance: 'Std',
      frequency: 'Per lot',
      sample: '10',
      acceptance: 'Match std',
      attachments: [],
    },
    {
      parameter: 'Wall Thickness',
      specLimit: 'Per Master mm',
      method: 'Magna-mike',
      mandatory: true,
      tolerance: '±0.05 mm',
      frequency: 'Per lot',
      sample: '10',
      acceptance: 'Within range',
      attachments: [],
    },
    {
      parameter: 'Leak Test (water inversion)',
      specLimit: 'No leak after fill + cap + invert 5 min',
      method: 'Fill water to nominal capacity, seal with cap, invert 5 min @25°C',
      mandatory: true,
      tolerance: '0 leaks',
      frequency: 'Per lot',
      sample: '10/lot',
      acceptance: '0 leaks',
      attachments: [],
    },
    {
      parameter: 'Leak Test (pressure decay)',
      specLimit: '≤ Master pressure drop in 10 sec',
      method: 'Cap + pressurize to 0.5 bar, monitor decay',
      mandatory: false,
      tolerance: '≤ Spec drop',
      frequency: 'Per vendor / quarter',
      sample: '5/lot',
      acceptance: 'Within tolerance',
      attachments: [],
    },
    {
      parameter: 'Pin-hole / Micro-leak (vacuum)',
      specLimit: 'No leak under 200 mbar vacuum × 30 sec',
      method: 'Vacuum chamber + dye / bubble test',
      mandatory: false,
      tolerance: '0 leaks',
      frequency: 'Per vendor / quarter',
      sample: '5/lot',
      acceptance: 'No bubbles',
      attachments: [],
    },
    {
      parameter: 'Drop Test',
      specLimit: 'Survives 75 cm × 3 axes',
      method: 'Drop test',
      mandatory: false,
      tolerance: 'No break',
      frequency: 'Per vendor / quarter',
      sample: '5',
      acceptance: 'No break',
      attachments: [],
    },
    {
      parameter: 'Top-load Compression',
      specLimit: 'Per Master (kgf)',
      method: 'Compression tester',
      mandatory: false,
      tolerance: '≥ Spec',
      frequency: 'Per vendor',
      sample: '3',
      acceptance: '≥ Spec',
      attachments: [],
    },
    {
      parameter: 'Stress-Crack Resistance (ESCR)',
      specLimit: '≥ Master (hr)',
      method: 'ASTM D1693',
      mandatory: false,
      tolerance: '≥ Spec',
      frequency: 'Per vendor',
      sample: '5',
      acceptance: '≥ Spec',
      attachments: [],
    },
  ],
  'Closures & Pumps::Pump (Lotion/Foam)': [
    {
      parameter: 'Output Volume per Stroke',
      specLimit: 'Per Master mL',
      method: '10 strokes weighed',
      mandatory: true,
      tolerance: '±10%',
      frequency: 'Per lot',
      sample: '10',
      acceptance: 'Within ±10%',
      attachments: [],
    },
    {
      parameter: 'Priming Strokes',
      specLimit: '≤ Master',
      method: 'Count',
      mandatory: true,
      tolerance: '≤ Spec',
      frequency: 'Per lot',
      sample: '5',
      acceptance: 'Within spec',
      attachments: [],
    },
    {
      parameter: 'Cycle Life',
      specLimit: '≥ Master (typical 500 strokes)',
      method: 'Cycling rig',
      mandatory: false,
      tolerance: '≥ Spec',
      frequency: 'Per vendor',
      sample: '3',
      acceptance: '≥ Spec',
      attachments: [],
    },
    {
      parameter: 'Cap Closure Lock',
      specLimit: 'Locks/unlocks cleanly',
      method: 'Manual',
      mandatory: true,
      tolerance: 'Functional',
      frequency: 'Per lot',
      sample: '10',
      acceptance: 'Functional',
      attachments: [],
    },
  ],
  'Secondary Pack::Monocarton': [
    {
      parameter: 'GSM',
      specLimit: 'Per Master (g/m²)',
      method: 'Square + Balance',
      mandatory: true,
      tolerance: '±5%',
      frequency: 'Per lot',
      sample: '5',
      acceptance: 'Within ±5%',
      attachments: [],
    },
    {
      parameter: 'Compression Strength',
      specLimit: 'Per Master (kgf)',
      method: 'BCT machine',
      mandatory: false,
      tolerance: '≥ Spec',
      frequency: 'Per vendor',
      sample: '3',
      acceptance: '≥ Spec',
      attachments: [],
    },
    {
      parameter: 'Glue Joint Strength',
      specLimit: 'No fail under load',
      method: 'Manual pull / drop',
      mandatory: true,
      tolerance: 'No fail',
      frequency: 'Per lot',
      sample: '5',
      acceptance: 'Holds',
      attachments: [],
    },
    {
      parameter: 'Folding Quality (creases)',
      specLimit: 'No cracking at folds',
      method: 'Visual after fold',
      mandatory: true,
      tolerance: 'No crack',
      frequency: 'Per lot',
      sample: '5',
      acceptance: 'Clean folds',
      attachments: [],
    },
    {
      parameter: 'Print Adhesion (rub)',
      specLimit: 'No transfer after 10 rubs',
      method: 'Crockmeter dry',
      mandatory: false,
      tolerance: 'No transfer',
      frequency: 'Per vendor',
      sample: '3',
      acceptance: 'No smudge',
      attachments: [],
    },
  ],
};

function subSpecPathKey(category: string, subCategory: string): string {
  return `${category}::${subCategory}`;
}

function buildFallbackTemplatesFromFieldDefs(): Record<string, SubSpecTemplate[]> {
  const map: Record<string, SubSpecTemplate[]> = {};
  for (const def of PM_QUALITY_SPEC_FIELD_DEFS) {
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

export function pmQualitySubSpecPathKey(category: string, subCategory: string): string {
  return subSpecPathKey(category.trim(), subCategory.trim());
}

export function hasPmQualitySubSpecDefaults(category: string, subCategory: string): boolean {
  const key = pmQualitySubSpecPathKey(category, subCategory);
  return Boolean(DETAILED_SUB_SPEC_TEMPLATES[key]?.length || FALLBACK_SUB_SPEC_TEMPLATES[key]?.length);
}

export function clonePmQualitySubSpecTableDefaults(
  category: string,
  subCategory: string
): QualitySpecTableRow[] {
  const key = pmQualitySubSpecPathKey(category, subCategory);
  const templates =
    DETAILED_SUB_SPEC_TEMPLATES[key] ?? FALLBACK_SUB_SPEC_TEMPLATES[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}
