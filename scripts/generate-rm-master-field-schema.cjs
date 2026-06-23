#!/usr/bin/env node
/**
 * Regenerate src/constants/rmMasterFieldSchema.ts from EI_Masters_PM_v4g.html
 * Usage: node scripts/generate-rm-master-field-schema.cjs [path-to-html]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath =
  process.argv[2] ||
  path.join(process.env.HOME || '', 'Downloads/EI_Masters_PM_v4g.html');
const outPath = path.join(__dirname, '../src/constants/rmMasterFieldSchema.ts');

const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('const RM_MODS=[');
const end = html.indexOf('];\nconst PM_MODS', start);
if (start < 0 || end < 0) {
  console.error('Could not locate RM_MODS in HTML');
  process.exit(1);
}

const rmModsExpr = html.slice(start + 'const RM_MODS='.length, end + 1);

const EXISTING = {
  'Material Code (SKU)': 'rmSku',
  'INCI Name': 'inciName',
  'Trade / Commercial Name': 'tradeCommercialName',
  'CAS Number': 'casNo',
  'Function in Formula': 'functionRole',
  'Primary UOM': 'primaryUom',
  'HSN / SAC': 'hsnCode',
  'GST Rate %': 'gst',
  'Grade': 'grade',
  'Compliance / Certificate': 'compliance',
  'BIS Compliance': 'bisCompliance',
  'Regulatory Max Use Level %': 'regMaxUseLevelPct',
  'Allergen Declaration (EU 26)': 'regAllergenDeclarationEu26',
  'IFRA Category & Limit': 'regIfraCategoryLimit',
  'CI Number': 'regCiNumber',
  'Approved Area': 'regApprovedArea',
  'Animal Origin': 'animalOrigin',
  State: 'rmState',
  Appearance: 'appearance',
  Odour: 'odour',
  'Active Content / Purity %': 'activeContentPurityPct',
  Solubility: 'solubility',
  'Viscosity (cP)': 'viscosityP',
  'Melting Point (°C)': 'meltingPointC',
  'Boiling Point (°C)': 'boilingPointC',
  'Flash Point (°C)': 'flashPointC',
  'Specific Gravity': 'specificGravity',
  'Refractive Index': 'refractiveIndex',
  'Charge Type': 'chargeType',
  'Active Matter %': 'activeMatterPct',
  'HLB Value': 'hlbValue',
  'Residual / Residual Solvents (ppm)': 'residualSolventsPpm',
  Pathogen: 'pathogen',
  'Moisture Content %': 'moistureContentPct',
  'Dose / Use Level': 'doseUseLevel',
  pH: 'ph',
  '% VOC': 'vocPct',
  'Optical / Spectroscopy (λmax/RI/IR)': 'opticalSpectroscopy',
  'Colour Impart to Formulation': 'colourImpartToFormulation',
  'MSDS / SDS Notes & Link': 'msdsSdsNotesLink',
  'Storage Condition': 'storageCondition',
  'Dispensing Direction': 'dispensingDirection',
  'AR Number': 'arNumber',
  'CoA Required': 'coaRequired',
  'Acceptance Spec (min)': 'acceptanceSpecMin',
  'Acceptance Spec (max)': 'acceptanceSpecMax',
  'Physical Form — Solid': 'physicalFormSolid',
  'Physical Form — Liquid': 'physicalFormLiquid',
  'Preferred Vendor': 'preferredVendor',
  'Alternate Vendors': 'alternateVendors',
  'Country of Origin': 'sourcingCountryOfOrigin',
  MOQ: 'sourcingMoq',
  'Lead Time (days)': 'sourcingLeadTimeDays',
  'Standard Cost / UOM': 'sourcingStandardUom',
  Currency: 'sourcingCurrency',
  'Shelf Life (months)': 'shelfLife',
  'Re-test Period (months)': 'retestPeriod',
  'Reorder Level': 'reorderLevel',
  'Dispensing Batch No': 'dispensingBatchNo',
  'Lifecycle Status': 'masterLifecycleStatus',
  Owner: 'rmOwner',
  'Universal-swap eligibility': 'universalSwapEligibility',
  'Functional equivalents': 'functionalEquivalents',
};

const MODULE_SLUG = {
  'PRIMARY INFO': 'primary',
  'UNITS & TAXES': 'units',
  REGULATORY: 'regulatory',
  TECHNICAL: 'technical',
  QUALITY: 'quality',
  'SOURCING & COST': 'sourcing',
  'INVENTORY & LOGISTICS': 'inventory',
  'LIFECYCLE & OWNERSHIP': 'lifecycle',
  'SIMILAR & GROUP': 'similar',
};

function toCamel(label) {
  const cleaned = label.replace(/[()°×\/]/g, ' ').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  const parts = cleaned.split(/[\s-]+/).filter(Boolean);
  if (!parts.length) return 'rmField';
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

const RM_MODS = vm.runInNewContext(`(${rmModsExpr})`, { S });

const modules = [];
const allFields = [];
const usedKeys = new Set();

for (const mod of RM_MODS) {
  const fields = [];
  for (const f of mod.f) {
    const label = f.f;
    if (!label || label.startsWith('__') || f.rmv) continue;
    let key = EXISTING[label] || toCamel(label);
    if (usedKeys.has(key)) key = `rm${key.charAt(0).toUpperCase()}${key.slice(1)}`;
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

console.log(`Parsed ${allFields.length} RM fields (${allFields.filter((f) => f.cond).length} conditional)`);

const output = `/**
 * RM master field schema — generated from EI_Masters_PM_v4g.html (source of truth).
 * Do not edit field definitions manually; re-run scripts/generate-rm-master-field-schema.cjs
 */
import type { EiFieldCond } from './eiMastersUnifiedSchema';

export type RmMasterFieldType = 'text' | 'textarea' | 'select';

export type RmMasterFieldDef = {
  key: string;
  label: string;
  module: string;
  moduleCode: string;
  type: RmMasterFieldType;
  required?: boolean;
  options?: string[];
  cond?: EiFieldCond;
};

export const RM_MASTER_MODULE_ORDER = ${JSON.stringify(
  modules.map((m) => ({ title: m.title, slug: m.slug })),
  null,
  2
)} as const;

export type RmMasterModuleSlug = (typeof RM_MASTER_MODULE_ORDER)[number]['slug'];

export const RM_MASTER_FIELDS: RmMasterFieldDef[] = ${JSON.stringify(allFields, null, 2)};

export const RM_MASTER_FIELDS_BY_MODULE: Record<RmMasterModuleSlug, RmMasterFieldDef[]> = ${JSON.stringify(
  Object.fromEntries(modules.map((m) => [m.slug, m.fields])),
  null,
  2
)} as Record<RmMasterModuleSlug, RmMasterFieldDef[]>;

export const RM_SCALAR_FIELD_CONDITIONS = Object.fromEntries(
  RM_MASTER_FIELDS.filter((f): f is RmMasterFieldDef & { cond: EiFieldCond } => Boolean(f.cond)).map(
    (f) => [f.key, f.cond]
  )
) as Record<string, EiFieldCond>;

export const RM_MASTER_FIELD_KEYS = ${JSON.stringify(
  allFields.map((f) => f.key),
  null,
  2
)} as const;

export function rmFieldsForModule(slug: RmMasterModuleSlug): RmMasterFieldDef[] {
  return RM_MASTER_FIELDS_BY_MODULE[slug] ?? [];
}

export function emptyRmMasterScalarDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of RM_MASTER_FIELDS) out[f.key] = '';
  return out;
}
`;

fs.writeFileSync(outPath, output);
console.log(`Wrote ${outPath}`);
