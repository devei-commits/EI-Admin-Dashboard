/**
 * Regenerate src/constants/eiMastersQualityCheckSpecs.ts from EI_Masters_QualityCheck.html
 * Usage: node scripts/generate-ei-masters-quality-check-specs.mjs [path-to-html]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath =
  process.argv[2] ||
  path.join(process.env.HOME || '', 'Downloads/EI_Masters_QualityCheck.html');
const outPath = path.join(__dirname, '../src/constants/eiMastersQualityCheckSpecs.ts');

const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('const SPECS={');
const end = html.indexOf('/* ═══════════ STATE ═══════════ */');
if (start < 0 || end < 0) {
  console.error('Could not find SPECS block in HTML');
  process.exit(1);
}
const chunk = html.slice(start, end).replace(/^const SPECS=/, 'export default ');
const tmp = path.join(__dirname, '../.tmp-ei-qc-specs.mjs');
fs.writeFileSync(tmp, chunk);
const SPECS = (await import(tmp)).default;
fs.unlinkSync(tmp);

function toRow(s) {
  return {
    parameter: s.param,
    specLimit: s.spec,
    method: s.method,
    mandatory: Boolean(s.mandatory),
    tolerance: s.tolerance || '',
    frequency: s.frequency || '',
    sample: s.sample || '',
    acceptance: s.acceptance || '',
    attachments: [],
  };
}

const rmCommon = {};
const rmSub = {};
for (const [cat, block] of Object.entries(SPECS.rm)) {
  if (block._common) rmCommon[cat] = block._common.map(toRow);
  for (const [key, val] of Object.entries(block)) {
    if (key === '_common' || !Array.isArray(val)) continue;
    rmSub[`${cat}::${key}`] = val.map(toRow);
  }
}

const pmCommon = {};
const pmSub = {};
for (const [cat, block] of Object.entries(SPECS.pm)) {
  if (block._common) pmCommon[cat] = block._common.map(toRow);
  for (const [key, val] of Object.entries(block)) {
    if (key === '_common' || !Array.isArray(val)) continue;
    pmSub[`${cat}::${key}`] = val.map(toRow);
  }
}

const out = `// Generated from EI_Masters_QualityCheck.html (RM/PM GRN QC templates).
// Regenerate: node scripts/generate-ei-masters-quality-check-specs.mjs
import type { QualitySpecTableRow } from '../types/qualitySpecTable';

export type QualitySpecTemplate = Omit<QualitySpecTableRow, 'id'>;

export const RM_QC_COMMON_BY_CATEGORY: Record<string, readonly QualitySpecTemplate[]> = ${JSON.stringify(rmCommon, null, 2)};

export const RM_QC_SUB_BY_PATH: Record<string, readonly QualitySpecTemplate[]> = ${JSON.stringify(rmSub, null, 2)};

export const PM_QC_COMMON_BY_CATEGORY: Record<string, readonly QualitySpecTemplate[]> = ${JSON.stringify(pmCommon, null, 2)};

export const PM_QC_SUB_BY_PATH: Record<string, readonly QualitySpecTemplate[]> = ${JSON.stringify(pmSub, null, 2)};
`;

fs.writeFileSync(outPath, out);
console.log(`Wrote ${outPath}`);
console.log(`RM: ${Object.keys(rmCommon).length} categories, ${Object.keys(rmSub).length} sub-paths`);
console.log(`PM: ${Object.keys(pmCommon).length} categories, ${Object.keys(pmSub).length} sub-paths`);
