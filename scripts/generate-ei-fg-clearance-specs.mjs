/**
 * Regenerate src/constants/eiMastersFgClearanceSpecs.ts from EI_FG_Clearance_Specs.html
 * Usage: node scripts/generate-ei-fg-clearance-specs.mjs [path-to-html]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath =
  process.argv[2] ||
  path.join(process.env.HOME || '', 'Downloads/EI_FG_Clearance_Specs.html');
const outPath = path.join(__dirname, '../src/constants/eiMastersFgClearanceSpecs.ts');

const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('const SPECS={');
const end = html.indexOf('function evaluateSpec');
if (start < 0 || end < 0) {
  console.error('Could not find SPECS block in HTML');
  process.exit(1);
}
const chunk = html.slice(start, end).replace(/^const SPECS=/, 'export default ');
const tmp = path.join(__dirname, '../.tmp-ei-fg-clearance-specs.mjs');
fs.writeFileSync(tmp, chunk);
const SPECS = (await import(tmp)).default;
fs.unlinkSync(tmp);

/** HTML product type → PR master path (`Category::SubCategory`). */
const PRODUCT_TYPE_TO_PR_PATH = {
  Cream: 'Skin Care::Cream',
  Lotion: 'Skin Care::Lotion',
  Serum: 'Skin Care::Serum',
  Shampoo: 'Hair Care::Shampoo',
  Sunscreen: 'Skin Care::Sunscreen',
  Toner: 'Skin Care::Toner',
  Masque: 'Skin Care::Face Mask',
  'Bath Bar': 'Cleansing::Bar Soap',
};

const STAGE_TO_EXPORT = {
  bulk: 'PR_BULK_CLEARANCE_SUB_BY_PATH',
  fg: 'PR_FINAL_CLEARANCE_SUB_BY_PATH',
  dispatch: 'PR_DISPATCH_SUB_BY_PATH',
};

function deriveTolerance(s) {
  if (s.specType === 'number-range' && s.min != null && s.max != null) {
    return `${s.min}–${s.max}${s.unit ? ` ${s.unit}` : ''}`;
  }
  if (s.specType === 'number-le' && s.max != null) {
    return `≤ ${s.max}${s.unit ? ` ${s.unit}` : ''}`;
  }
  if (s.specType === 'number-ge' && s.min != null) {
    return `≥ ${s.min}${s.unit ? ` ${s.unit}` : ''}`;
  }
  if (s.specType === 'number-match' && s.expected != null) {
    return `= ${s.expected}${s.unit ? ` ${s.unit}` : ''}`;
  }
  if (s.expected != null && s.expected !== '') return String(s.expected);
  return '';
}

function deriveAcceptance(s) {
  if (s.specType === 'attachment') return 'Attached';
  if (s.specType === 'boolean' && s.expected === true) return 'Pass';
  if (s.specType === 'text-match' && s.expected) return String(s.expected);
  if (s.specType === 'text-contains' && s.expected) return `Contains ${s.expected}`;
  return s.spec || '';
}

function toRow(s) {
  return {
    parameter: s.param,
    specLimit: s.spec,
    method: s.method,
    mandatory: Boolean(s.mandatory),
    tolerance: deriveTolerance(s),
    frequency: '',
    sample: '',
    acceptance: deriveAcceptance(s),
    attachments: [],
  };
}

const bulkSub = {};
const finalSub = {};
const dispatchSub = {};

for (const [key, rows] of Object.entries(SPECS)) {
  const [stage, productType] = key.split('.');
  const prPath = PRODUCT_TYPE_TO_PR_PATH[productType];
  if (!prPath || !Array.isArray(rows)) continue;
  const mapped = rows.map(toRow);
  if (stage === 'bulk') bulkSub[prPath] = mapped;
  else if (stage === 'fg') finalSub[prPath] = mapped;
  else if (stage === 'dispatch') dispatchSub[prPath] = mapped;
}

const out = `// Generated from EI_FG_Clearance_Specs.html (PR bulk / FG / dispatch clearance sub-category templates).
// Regenerate: node scripts/generate-ei-fg-clearance-specs.mjs
import type { QualitySpecTableRow } from '../types/qualitySpecTable';

export type QualitySpecTemplate = Omit<QualitySpecTableRow, 'id'>;

/** Product types shown in EI_FG_Clearance_Specs.html (incl. empty Toner / Masque / Bath Bar). */
export const FG_CLEARANCE_PRODUCT_TYPES = ${JSON.stringify(Object.keys(PRODUCT_TYPE_TO_PR_PATH), null, 2)} as const;

/** HTML product type → PR \`Category::SubCategory\` path. */
export const FG_CLEARANCE_PRODUCT_TYPE_TO_PR_PATH: Record<string, string> = ${JSON.stringify(PRODUCT_TYPE_TO_PR_PATH, null, 2)};

export const PR_BULK_CLEARANCE_SUB_BY_PATH: Record<string, readonly QualitySpecTemplate[]> = ${JSON.stringify(bulkSub, null, 2)};

export const PR_FINAL_CLEARANCE_SUB_BY_PATH: Record<string, readonly QualitySpecTemplate[]> = ${JSON.stringify(finalSub, null, 2)};

export const PR_DISPATCH_SUB_BY_PATH: Record<string, readonly QualitySpecTemplate[]> = ${JSON.stringify(dispatchSub, null, 2)};
`;

fs.writeFileSync(outPath, out);
console.log(`Wrote ${outPath}`);
console.log(
  `Bulk: ${Object.keys(bulkSub).length} paths, Final: ${Object.keys(finalSub).length}, Dispatch: ${Object.keys(dispatchSub).length}`
);
