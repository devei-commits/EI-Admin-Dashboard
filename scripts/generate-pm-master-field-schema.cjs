#!/usr/bin/env node
/**
 * Regenerate src/constants/pmMasterFieldSchema.ts from EI_Masters_PM_v4g.html
 * Usage: node scripts/generate-pm-master-field-schema.js [path-to-html]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath =
  process.argv[2] ||
  path.join(process.env.HOME || '', 'Downloads/EI_Masters_PM_v4g.html');
const outPath = path.join(__dirname, '../src/constants/pmMasterFieldSchema.ts');

const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('const PM_MODS=[');
const end = html.indexOf('];\nconst SCHEMA', start);
if (start < 0 || end < 0) {
  console.error('Could not locate PM_MODS in HTML');
  process.exit(1);
}

const pmModsSource = html.slice(start, end + 2);

const SKIP_LABELS = new Set([
  'AR Number',
  'QC Test Plan Reference',
  'AQL Sampling Plan',
  'CoA from Vendor Required',
  'QC Decision Authority',
]);

const EXISTING = {
  'Material Code (SKU)': 'itemCode',
  'PM Name / Description': 'tradeCommercialName',
  'Assembly / Component-set Code': 'pmAssemblyCode',
  'Component breakdown': 'pmComponentBreakdown',
  'SKU Volume (ml/g)': 'pmSkuVolume',
  'Intended Use': 'intendedUse',
  Reusability: 'reusability',
  Status: 'pmLifecycleStatus',
  'Primary UOM': 'pkgUnit',
  'Units per Shipper / Roll': 'pkgUnitsPerShipperRoll',
  'HSN / SAC': 'pkgHsn',
  'GST Rate %': 'pkgGst',
  'Nominal Volume (ml)': 'specNominal',
  'Brimful Capacity (ml)': 'specBrimful',
  'Total / Overall Height (mm)': 'pmOverallHeightMm',
  'Body / Shoulder Height (mm)': 'pmShoulderHeightMm',
  'Outer Body Diameter (mm)': 'pmOuterDiameterMm',
  'Inner / Neck Diameter (mm)': 'pmInnerDiameterNeckMm',
  'Body Circumference (mm)': 'pmCircumferenceMm',
  'Empty / Component Weight (g)': 'specWeight',
  'Orifice Diameter (mm)': 'pmOrificeMm',
  'Closure Type': 'pmClosureType',
  'Pump / Dropper Output per Stroke (ml)': 'pmPumpCcDosage',
  'Pipette Length (mm)': 'pmPipetteLengthMm',
  'Fill Volume (ml/g)': 'pmFillVolumeMl',
  'Seal / Laminate Width (mm)': 'pmSealLaminateWidthMm',
  'Carton Length L (mm)': 'pmCartonLengthMm',
  'Carton Width W (mm)': 'pmCartonWidthMm',
  'Carton Height H (mm)': 'pmCartonHeightMm',
  Material: 'matBody',
  'Storage Condition': 'storeLoc',
  'Body / Component Colour': 'colorType',
  'Colour Code (Pantone / RAL)': 'colorCode',
  'Transparency Level': 'transparencyLevel',
  'Surface Finish': 'finish',
  'Surface Texture': 'surfaceTexture',
  'Decoration Method': 'decorationMethod',
  'Number of Print Colours': 'numberOfColours',
  'Print Colours (CMYK / Pantone)': 'printColours',
  'Print Coverage (%)': 'printCoverage',
  'Foil Colour': 'foilColour',
  'Embossing / Debossing Areas': 'embossingDebossing',
  'Premium Look & Feel': 'premiumLookFeel',
  'Reference Image / Mockup': 'images',
  'Shoulder Colour': 'pmShoulderColour',
  'Cap / Overcap Colour': 'pmCapOvercapColour',
  'Actuator Colour & Style': 'pmActuatorColourStyle',
  'Collar Finish': 'pmCollarFinish',
  'Teat Colour': 'pmTeatColour',
  'Preferred Vendor': 'preferredVendor',
  'Alternate Vendors': 'alternateVendor',
  'Supply Location': 'pmSupplyLocation',
  'Recyclability Code': 'regRecyclabilityCode',
  'Food / Cosmetic-contact Safe': 'regFoodCosmeticCompliance',
  'Board Type': 'pmBoardPaperType',
  'Board GSM': 'pmGsm',
  'Substrate Thickness (microns)': 'pmMaterialThicknessMicron',
  Lamination: 'pmLamination',
};

const MODULE_SLUG = {
  'PRIMARY INFO': 'primary',
  'UNITS & TAXES': 'units',
  DIMENSIONS: 'dimensions',
  'MATERIAL SPECIFICATIONS': 'material',
  AESTHETICS: 'aesthetics',
  'GRN QUALITY CHECKS': 'quality',
  'VENDORS & COMMERCIALS': 'vendors',
};

function toCamel(label) {
  const cleaned = label.replace(/[()°×\/]/g, ' ').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  const parts = cleaned.split(/[\s-]+/).filter(Boolean);
  if (!parts.length) return 'pmField';
  return parts
    .map((p, i) => {
      const lower = p.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function S(o) {
  return { t: 'select', o };
}

const pmModsExpr = pmModsSource.replace('const PM_MODS=', '');

const sandbox = { PM_MODS: null, S };
vm.runInNewContext(`PM_MODS = ${pmModsExpr}`, sandbox);
const PM_MODS = sandbox.PM_MODS;

const modules = [];
const allFields = [];
const usedKeys = new Set();

for (const mod of PM_MODS) {
  const fields = [];
  for (const f of mod.f) {
    const label = f.f;
    if (!label || label.startsWith('__') || SKIP_LABELS.has(label)) continue;
    let key = EXISTING[label] || toCamel(label);
    if (usedKeys.has(key)) key = `pm${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    usedKeys.add(key);
    const field = {
      key,
      label,
      module: MODULE_SLUG[mod.m] || mod.m,
      moduleCode: mod.c,
      type: f.t === 'select' ? 'select' : f.t === 'area' ? 'textarea' : 'text',
      required: Boolean(f.req),
      ...(Array.isArray(f.o) ? { options: [...f.o] } : {}),
      ...(f.cond ? { cond: { on: f.cond.on, vals: [...f.cond.vals] } } : {}),
    };
    fields.push(field);
    allFields.push(field);
  }
  modules.push({ title: mod.m, slug: MODULE_SLUG[mod.m], code: mod.c, fields });
}

const withCond = allFields.filter((f) => f.cond).length;
console.log(`Parsed ${allFields.length} fields (${withCond} conditional)`);

const output = `/**
 * PM master field schema — generated from EI_Masters_PM_v4g.html (source of truth).
 * Do not edit field definitions manually; re-run scripts/generate-pm-master-field-schema.js
 */
import type { EiFieldCond } from './eiMastersUnifiedSchema';

export type PmMasterFieldType = 'text' | 'textarea' | 'select';

export type PmMasterFieldDef = {
  key: string;
  label: string;
  module: string;
  moduleCode: string;
  type: PmMasterFieldType;
  required?: boolean;
  options?: string[];
  cond?: EiFieldCond;
};

export const PM_MASTER_MODULE_ORDER = ${JSON.stringify(
  modules.map((m) => ({ title: m.title, slug: m.slug })),
  null,
  2
)} as const;

export type PmMasterModuleSlug = (typeof PM_MASTER_MODULE_ORDER)[number]['slug'];

export const PM_MASTER_FIELDS: PmMasterFieldDef[] = ${JSON.stringify(allFields, null, 2)};

export const PM_MASTER_FIELDS_BY_MODULE: Record<PmMasterModuleSlug, PmMasterFieldDef[]> = ${JSON.stringify(
  Object.fromEntries(modules.map((m) => [m.slug, m.fields])),
  null,
  2
)} as Record<PmMasterModuleSlug, PmMasterFieldDef[]>;

/** Conditional visibility keys for PM scalar fields (from HTML cond rules). */
export const PM_SCALAR_FIELD_CONDITIONS = Object.fromEntries(
  PM_MASTER_FIELDS.filter((f): f is PmMasterFieldDef & { cond: EiFieldCond } => Boolean(f.cond)).map(
    (f) => [f.key, f.cond]
  )
) as Record<string, EiFieldCond>;

export const PM_MASTER_FIELD_KEYS = ${JSON.stringify(
  allFields.map((f) => f.key),
  null,
  2
)} as const;

export function pmFieldsForModule(slug: PmMasterModuleSlug): PmMasterFieldDef[] {
  return PM_MASTER_FIELDS_BY_MODULE[slug] ?? [];
}

export function emptyPmMasterScalarDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of PM_MASTER_FIELDS) out[f.key] = '';
  return out;
}
`;

fs.writeFileSync(outPath, output);
console.log(`Wrote ${outPath}`);
