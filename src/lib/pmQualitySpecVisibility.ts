import {
  normalizePmDetailSubCategoryKey,
  normalizePmFunctionalSubCategoryKey,
  normalizePmSkuCategoryForSelect,
  normalizePmSubSubCategoryForSelect,
} from '../constants/materialMasterSkuRules';
import { pmUnifiedToLegacyQualityCategory } from '../constants/eiMastersUnifiedSchema';
import { clonePmQualitySpecTableDefaults, hasPmQualitySpecDefaults } from '../constants/pmQualitySpecTableDefaults';
import {
  clonePmQualitySubSpecTableDefaults,
  hasPmQualitySubSpecDefaults,
  pmQualitySubSpecPathKey,
} from '../constants/pmQualitySubSpecTableDefaults';
import {
  PM_QUALITY_SPEC_FIELD_DEFS,
  PM_QUALITY_SPEC_FIELD_LABELS,
  type PmFunctionalCategory,
  type PmQualitySpecFieldDef,
} from '../constants/pmQualitySpecFields';
import {
  createEmptyQualitySpecRow,
  createQualitySpecAttachment,
  type QualitySpecAttachment,
  type QualitySpecTableRow,
} from '../types/qualitySpecTable';

export type PmQualitySpecContext = {
  optionalPmSubCategory: string;
  optionalPmSubSubCategory?: string;
  pmSkuCategory?: string;
  subCategory?: string;
};

function normSub(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export type PmQualitySpecResolvedContext = {
  functionalCategory: PmFunctionalCategory | '';
  functionalSub: string;
  functionalSubNorm: string;
  categoryDisplayLabel: string;
  subSpecPathKey: string;
};

export function resolvePmQualitySpecContext(ctx: PmQualitySpecContext): PmQualitySpecResolvedContext {
  const sku = normalizePmSkuCategoryForSelect(ctx.pmSkuCategory || ctx.subCategory || '') || 'ppm';
  const unifiedSub =
    normalizePmDetailSubCategoryKey(ctx.optionalPmSubCategory) ||
    String(ctx.optionalPmSubCategory ?? '').trim();
  const functionalCategory = (pmUnifiedToLegacyQualityCategory(
    sku,
    unifiedSub
  ) || '') as PmFunctionalCategory | '';
  const functionalSub =
    normalizePmSubSubCategoryForSelect(
      unifiedSub,
      ctx.optionalPmSubSubCategory ?? '',
      sku
    ) || String(ctx.optionalPmSubSubCategory ?? '').trim();

  return {
    functionalCategory,
    functionalSub,
    functionalSubNorm: normSub(functionalSub),
    categoryDisplayLabel: functionalCategory || unifiedSub,
    subSpecPathKey:
      functionalCategory && functionalSub
        ? pmQualitySubSpecPathKey(functionalCategory, functionalSub)
        : '',
  };
}

function fieldMatchesSub(def: PmQualitySpecFieldDef, functionalSubNorm: string): boolean {
  if (!def.subCategory) return true;
  return normSub(def.subCategory) === functionalSubNorm;
}

/** @deprecated Use shouldShowPmQualitySpecTable — kept for tests. */
export function getVisiblePmQualitySpecFields(ctx: PmQualitySpecContext): PmQualitySpecFieldDef[] {
  const resolved = resolvePmQualitySpecContext(ctx);
  if (!resolved.functionalCategory) return [];

  return PM_QUALITY_SPEC_FIELD_DEFS.filter(
    (def) =>
      def.category === resolved.functionalCategory &&
      fieldMatchesSub(def, resolved.functionalSubNorm)
  );
}

/** @deprecated Use shouldShowPmQualitySpecTable — kept for tests. */
export function hasPmQualitySpecFields(ctx: PmQualitySpecContext): boolean {
  return shouldShowPmQualitySpecTable(ctx);
}

export type PmQualitySpecFieldGroup = {
  title: string;
  fields: PmQualitySpecFieldDef[];
};

/** @deprecated Legacy flat-field grouping — use tabular PmQualitySpecTable. */
export function groupVisiblePmQualitySpecFields(ctx: PmQualitySpecContext): PmQualitySpecFieldGroup[] {
  const visible = getVisiblePmQualitySpecFields(ctx);
  if (visible.length === 0) return [];

  const common = visible.filter((f) => !f.subCategory);
  const specific = visible.filter((f) => f.subCategory);
  const resolved = resolvePmQualitySpecContext(ctx);
  const groups: PmQualitySpecFieldGroup[] = [];

  if (common.length > 0) groups.push({ title: 'Common', fields: common });
  if (specific.length > 0) {
    groups.push({ title: resolved.functionalSub || 'Sub-category', fields: specific });
  }
  return groups;
}

/** Show common quality-spec table when PM functional category is set. */
export function shouldShowPmQualitySpecTable(ctx: PmQualitySpecContext): boolean {
  return Boolean(resolvePmQualitySpecContext(ctx).functionalCategory);
}

/** Sub-category specs can be edited once functional sub-category is chosen. */
export function shouldShowPmQualitySubSpecTable(ctx: PmQualitySpecContext): boolean {
  return Boolean(resolvePmQualitySpecContext(ctx).functionalSub);
}

/** Common table is interactive when a functional category is available. */
export function canEditPmQualityCategorySpecs(ctx: PmQualitySpecContext): boolean {
  return Boolean(resolvePmQualitySpecContext(ctx).functionalCategory);
}

export function getDefaultPmQualitySpecRows(ctx: PmQualitySpecContext): QualitySpecTableRow[] {
  const resolved = resolvePmQualitySpecContext(ctx);
  if (!resolved.functionalCategory || !hasPmQualitySpecDefaults(resolved.functionalCategory)) return [];
  return clonePmQualitySpecTableDefaults(resolved.functionalCategory);
}

export function getDefaultPmQualitySubSpecRows(ctx: PmQualitySpecContext): QualitySpecTableRow[] {
  const resolved = resolvePmQualitySpecContext(ctx);
  if (!resolved.functionalCategory || !resolved.functionalSub) return [];
  if (!hasPmQualitySubSpecDefaults(resolved.functionalCategory, resolved.functionalSub)) return [];
  return clonePmQualitySubSpecTableDefaults(resolved.functionalCategory, resolved.functionalSub);
}

function parseQualitySpecAttachment(raw: unknown, idx: number): QualitySpecAttachment | null {
  if (!raw || typeof raw !== 'object') return null;
  const att = raw as Record<string, unknown>;
  const typeRaw = String(att.type ?? '').toLowerCase();
  const type: QualitySpecAttachment['type'] = typeRaw === 'link' ? 'link' : 'file';
  const name = String(att.name ?? '').trim();
  const url = String(att.url ?? att.link ?? '').trim();
  if (!name && !url) return null;
  return createQualitySpecAttachment({
    id: String(att.id ?? `qsa-loaded-${idx}`),
    type: url && !name ? 'link' : type,
    name: name || url,
    url,
  });
}

function parseQualitySpecAttachments(raw: unknown, row: Record<string, unknown>): QualitySpecAttachment[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item, idx) => parseQualitySpecAttachment(item, idx))
      .filter((att): att is QualitySpecAttachment => att !== null);
  }

  const legacy: QualitySpecAttachment[] = [];
  const fileName = String(row.attachmentName ?? row.attachment_name ?? '').trim();
  const linkUrl = String(row.linkUrl ?? row.link_url ?? '').trim();
  if (fileName) {
    legacy.push(createQualitySpecAttachment({ type: 'file', name: fileName, url: '' }));
  }
  if (linkUrl) {
    legacy.push(createQualitySpecAttachment({ type: 'link', name: linkUrl, url: linkUrl }));
  }
  return legacy;
}

function parseQualitySpecRow(raw: unknown, idx: number): QualitySpecTableRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const parameter = String(row.parameter ?? '').trim();
  if (!parameter) return null;
  const mandatoryRaw = row.mandatory;
  const mandatory =
    mandatoryRaw === true ||
    mandatoryRaw === 'true' ||
    mandatoryRaw === 'Yes' ||
    mandatoryRaw === 'yes' ||
    mandatoryRaw === 1;
  return createEmptyQualitySpecRow({
    id: String(row.id ?? `qs-loaded-${idx}`),
    parameter,
    specLimit: String(row.specLimit ?? row.spec_limit ?? '').trim(),
    method: String(row.method ?? '').trim(),
    mandatory,
    tolerance: String(row.tolerance ?? '').trim(),
    frequency: String(row.frequency ?? '').trim(),
    sample: String(row.sample ?? '').trim(),
    acceptance: String(row.acceptance ?? '').trim(),
    attachments: parseQualitySpecAttachments(row.attachments, row),
    dataType: String(row.dataType ?? row.data_type ?? '').trim() || undefined,
    custom: row.custom === true || row._custom === true,
  });
}

function parseQualitySpecRows(raw: unknown): QualitySpecTableRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => parseQualitySpecRow(item, idx))
    .filter((r): r is QualitySpecTableRow => r !== null);
}

/** Load common tabular rows from form_data; migrates legacy flat pmQualitySpecs when needed. */
export function hydratePmQualitySpecRows(source: Record<string, unknown>): QualitySpecTableRow[] {
  const nested = source.pmQualitySpecRows;
  if (Array.isArray(nested) && nested.length > 0) {
    const rows = parseQualitySpecRows(nested);
    if (rows.length > 0) return rows;
  }

  const { common } = splitLegacyPmQualitySpecs(source);
  return common;
}

const PM_LEGACY_FUNCTIONAL_CATEGORIES = new Set<PmFunctionalCategory>([
  'Primary Pack',
  'Closures & Pumps',
  'Secondary Pack',
  'Tertiary Pack',
  'Ancillary',
]);

function migratePmQualitySubSpecPathKey(pathKey: string): string {
  const parts = pathKey.split('::');
  if (parts.length < 2) return pathKey;
  const categoryRaw = (parts[0] ?? '').trim();
  const subRaw = parts.slice(1).join('::').trim();
  if (!categoryRaw || !subRaw) return pathKey;

  if (PM_LEGACY_FUNCTIONAL_CATEGORIES.has(categoryRaw as PmFunctionalCategory)) {
    return pmQualitySubSpecPathKey(categoryRaw, subRaw);
  }

  const category = normalizePmDetailSubCategoryKey(categoryRaw) || categoryRaw;
  const subCategory = normalizePmFunctionalSubCategoryKey(subRaw) || subRaw;
  return pmQualitySubSpecPathKey(category, subCategory);
}

/** Load sub-category tabular rows keyed by `Category::SubCategory`. */
export function hydratePmQualitySubSpecRowsByPath(
  source: Record<string, unknown>
): Record<string, QualitySpecTableRow[]> {
  const nested = source.pmQualitySubSpecRowsByPath;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const out: Record<string, QualitySpecTableRow[]> = {};
    for (const [pathKey, rawRows] of Object.entries(nested as Record<string, unknown>)) {
      const rows = parseQualitySpecRows(rawRows);
      if (rows.length === 0) continue;
      const migratedKey = migratePmQualitySubSpecPathKey(pathKey);
      out[migratedKey] = [...(out[migratedKey] ?? []), ...rows];
    }
    if (Object.keys(out).length > 0) return out;
  }

  const { byPath } = splitLegacyPmQualitySpecs(source);
  const migrated: Record<string, QualitySpecTableRow[]> = {};
  for (const [pathKey, rows] of Object.entries(byPath)) {
    const key = migratePmQualitySubSpecPathKey(pathKey);
    migrated[key] = [...(migrated[key] ?? []), ...rows];
  }
  return migrated;
}

function splitLegacyPmQualitySpecs(source: Record<string, unknown>): {
  common: QualitySpecTableRow[];
  byPath: Record<string, QualitySpecTableRow[]>;
} {
  const legacyFlat = hydrateLegacyPmQualitySpecs(source);
  const common: QualitySpecTableRow[] = [];
  const byPath: Record<string, QualitySpecTableRow[]> = {};

  for (const [id, value] of Object.entries(legacyFlat)) {
    const def = PM_QUALITY_SPEC_FIELD_DEFS.find((f) => f.id === id);
    const label = def?.label ?? PM_QUALITY_SPEC_FIELD_LABELS[id] ?? id;
    const trimmed = String(value ?? '').trim();
    if (!trimmed) continue;

    const row = createEmptyQualitySpecRow({
      parameter: label,
      specLimit: trimmed,
      mandatory: def?.mandatory ?? false,
    });

    if (def?.subCategory && def.category) {
      const pathKey = pmQualitySubSpecPathKey(def.category, def.subCategory);
      if (!byPath[pathKey]) byPath[pathKey] = [];
      byPath[pathKey].push(row);
    } else {
      common.push(row);
    }
  }

  return { common, byPath };
}

function hydrateLegacyPmQualitySpecs(source: Record<string, unknown>): Record<string, string> {
  const specs: Record<string, string> = {};
  const nested = source.pmQualitySpecs;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    for (const [key, val] of Object.entries(nested as Record<string, unknown>)) {
      const trimmed = String(val ?? '').trim();
      if (trimmed) specs[key] = trimmed;
    }
  }
  for (const def of PM_QUALITY_SPEC_FIELD_DEFS) {
    const top = source[def.id];
    const trimmed = String(top ?? '').trim();
    if (trimmed && !specs[def.id]) specs[def.id] = trimmed;
  }
  return specs;
}

function flattenQualitySpecAttachments(attachments: QualitySpecAttachment[]): QualitySpecAttachment[] {
  return attachments
    .map((att) => ({
      ...att,
      name: att.name.trim(),
      url: att.url.trim(),
    }))
    .filter((att) => att.name.length > 0 || att.url.length > 0);
}

export function flattenPmQualitySpecRowsForPayload(
  rows: QualitySpecTableRow[]
): QualitySpecTableRow[] {
  return rows
    .map((row) => ({
      ...row,
      parameter: row.parameter.trim(),
      specLimit: row.specLimit.trim(),
      method: row.method.trim(),
      tolerance: row.tolerance.trim(),
      frequency: row.frequency.trim(),
      sample: row.sample.trim(),
      acceptance: row.acceptance.trim(),
      attachments: flattenQualitySpecAttachments(row.attachments ?? []),
    }))
    .filter((row) => row.parameter.length > 0);
}

export function flattenPmQualitySubSpecRowsByPathForPayload(
  byPath: Record<string, QualitySpecTableRow[]>
): Record<string, QualitySpecTableRow[]> {
  const out: Record<string, QualitySpecTableRow[]> = {};
  for (const [pathKey, rows] of Object.entries(byPath)) {
    const flattened = flattenPmQualitySpecRowsForPayload(rows);
    if (flattened.length > 0) out[pathKey] = flattened;
  }
  return out;
}

/** Quality spec rows are optional on save (only steps 1–2 enforce required fields). */
export function validatePmQualitySpecRows(
  _rows: QualitySpecTableRow[],
  _ctx: PmQualitySpecContext
): Record<string, string> {
  return {};
}

/** @deprecated Use validatePmQualitySpecRows. */
export function validatePmQualitySpecs(
  _specs: Record<string, string>,
  _ctx: PmQualitySpecContext
): Record<string, string> {
  return {};
}

/** @deprecated Legacy flat map — use hydratePmQualitySpecRows. */
export function hydratePmQualitySpecs(source: Record<string, unknown>): Record<string, string> {
  return hydrateLegacyPmQualitySpecs(source);
}

/** @deprecated Legacy flat map — use flattenPmQualitySpecRowsForPayload. */
export function flattenPmQualitySpecsForPayload(
  specs: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(specs)) {
    const trimmed = String(val ?? '').trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

export { normSub };
