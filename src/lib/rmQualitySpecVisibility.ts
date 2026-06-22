import {
  normalizeRmDetailSubCategoryForSelect,
  normalizeRmDetailSubCategoryKey,
  normalizeRmSubCategoryForSelect,
  normalizeRmSubSubCategoryForSelect,
} from '../constants/materialMasterSkuRules';
import {
  rmUnifiedToLegacyQualityCategory,
  rmUnifiedToLegacyQualitySub,
} from '../constants/eiMastersUnifiedSchema';
import { cloneRmQualitySpecTableDefaults } from '../constants/rmQualitySpecTableDefaults';
import {
  cloneRmQualitySubSpecTableDefaults,
  hasRmQualitySubSpecDefaults,
  rmQualitySubSpecPathKey,
} from '../constants/rmQualitySubSpecTableDefaults';
import {
  RM_QUALITY_SPEC_FIELD_DEFS,
  RM_QUALITY_SPEC_FIELD_LABELS,
  RM_QUALITY_SPEC_LEGACY_FLAT_IDS,
} from '../constants/rmQualitySpecFields';
import {
  createEmptyQualitySpecRow,
  createQualitySpecAttachment,
  type QualitySpecAttachment,
  type QualitySpecTableRow,
} from '../types/qualitySpecTable';

export type RmQualitySpecContext = {
  subCategory: string;
  optionalRmSubCategory: string;
  optionalRmSubSubCategory?: string;
};

export type RmQualitySpecResolvedContext = {
  isBulkFunctional: boolean;
  functionalCategory: string;
  functionalSub: string;
  categoryDisplayLabel: string;
  subSpecPathKey: string;
};

function normSub(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function resolveRmQualitySpecContext(ctx: RmQualitySpecContext): RmQualitySpecResolvedContext {
  const cat = normalizeRmSubCategoryForSelect(ctx.subCategory);
  const isBulk = cat === 'RAW MATERIALS';
  const unifiedCategory =
    normalizeRmDetailSubCategoryKey(ctx.optionalRmSubCategory) ||
    normalizeRmDetailSubCategoryForSelect(ctx.subCategory, ctx.optionalRmSubCategory) ||
    String(ctx.optionalRmSubCategory ?? '').trim();
  const unifiedSub =
    normalizeRmSubSubCategoryForSelect(
      unifiedCategory,
      ctx.optionalRmSubSubCategory ?? '',
      ctx.subCategory
    ) || String(ctx.optionalRmSubSubCategory ?? '').trim();

  const functionalCategory = rmUnifiedToLegacyQualityCategory(unifiedCategory);
  const functionalSub = rmUnifiedToLegacyQualitySub(unifiedCategory, unifiedSub);

  const categoryDisplayLabel = functionalCategory || unifiedCategory || 'Skin Care';

  return {
    isBulkFunctional: isBulk && Boolean(unifiedCategory),
    functionalCategory,
    functionalSub,
    categoryDisplayLabel,
    subSpecPathKey:
      functionalCategory && functionalSub
        ? rmQualitySubSpecPathKey(functionalCategory, functionalSub)
        : '',
  };
}

/** Show category (common) quality-spec table on the Quality step for any classified RM. */
export function shouldShowRmQualitySpecTable(ctx: RmQualitySpecContext): boolean {
  const resolved = resolveRmQualitySpecContext(ctx);
  return Boolean(resolved.functionalCategory) || Boolean(String(ctx.subCategory ?? '').trim());
}

/** Sub-category specs can be edited once functional sub-category is chosen (defaults optional). */
export function shouldShowRmQualitySubSpecTable(ctx: RmQualitySpecContext): boolean {
  return Boolean(resolveRmQualitySpecContext(ctx).functionalSub);
}

/** Category table is interactive when a functional category label is available. */
export function canEditRmQualityCategorySpecs(ctx: RmQualitySpecContext): boolean {
  return Boolean(resolveRmQualitySpecContext(ctx).functionalCategory);
}

/** @deprecated Use shouldShowRmQualitySpecTable — kept for conditional-field tests. */
export function hasRmQualitySpecFields(ctx: RmQualitySpecContext): boolean {
  return shouldShowRmQualitySpecTable(ctx);
}

export function getDefaultRmQualitySpecRows(ctx: RmQualitySpecContext): QualitySpecTableRow[] {
  if (!resolveRmQualitySpecContext(ctx).isBulkFunctional) return [];
  return cloneRmQualitySpecTableDefaults();
}

export function getDefaultRmQualitySubSpecRows(ctx: RmQualitySpecContext): QualitySpecTableRow[] {
  const resolved = resolveRmQualitySpecContext(ctx);
  if (!resolved.functionalCategory || !resolved.functionalSub) return [];
  if (!hasRmQualitySubSpecDefaults(resolved.functionalCategory, resolved.functionalSub)) return [];
  return cloneRmQualitySubSpecTableDefaults(resolved.functionalCategory, resolved.functionalSub);
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
  });
}

function parseQualitySpecRows(raw: unknown): QualitySpecTableRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => parseQualitySpecRow(item, idx))
    .filter((r): r is QualitySpecTableRow => r !== null);
}

/** Load common tabular rows from form_data; migrates legacy flat rmQualitySpecs when needed. */
export function hydrateRmQualitySpecRows(source: Record<string, unknown>): QualitySpecTableRow[] {
  const nested = source.rmQualitySpecRows;
  if (Array.isArray(nested) && nested.length > 0) {
    const rows = parseQualitySpecRows(nested);
    if (rows.length > 0) return rows;
  }

  const { common } = splitLegacyRmQualitySpecs(source);
  return common;
}

/** Load sub-category tabular rows keyed by `Category::SubCategory`. */
export function hydrateRmQualitySubSpecRowsByPath(
  source: Record<string, unknown>
): Record<string, QualitySpecTableRow[]> {
  const nested = source.rmQualitySubSpecRowsByPath;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const out: Record<string, QualitySpecTableRow[]> = {};
    for (const [pathKey, rawRows] of Object.entries(nested as Record<string, unknown>)) {
      const rows = parseQualitySpecRows(rawRows);
      if (rows.length > 0) out[pathKey] = rows;
    }
    if (Object.keys(out).length > 0) return out;
  }

  const { byPath } = splitLegacyRmQualitySpecs(source);
  return byPath;
}

function splitLegacyRmQualitySpecs(source: Record<string, unknown>): {
  common: QualitySpecTableRow[];
  byPath: Record<string, QualitySpecTableRow[]>;
} {
  const legacyFlat = hydrateLegacyRmQualitySpecs(source);
  const common: QualitySpecTableRow[] = [];
  const byPath: Record<string, QualitySpecTableRow[]> = {};

  for (const [id, value] of Object.entries(legacyFlat)) {
    const def = RM_QUALITY_SPEC_FIELD_DEFS.find((f) => f.id === id);
    const label = def?.label ?? RM_QUALITY_SPEC_FIELD_LABELS[id] ?? id;
    const trimmed = String(value ?? '').trim();
    if (!trimmed) continue;

    const row = createEmptyQualitySpecRow({
      parameter: label,
      specLimit: trimmed,
      mandatory: def?.mandatory ?? false,
    });

    if (def?.subCategory && def.category) {
      const pathKey = rmQualitySubSpecPathKey(def.category, def.subCategory);
      if (!byPath[pathKey]) byPath[pathKey] = [];
      byPath[pathKey].push(row);
    } else {
      common.push(row);
    }
  }

  return { common, byPath };
}

function hydrateLegacyRmQualitySpecs(source: Record<string, unknown>): Record<string, string> {
  const specs: Record<string, string> = {};
  const nested = source.rmQualitySpecs;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    for (const [key, val] of Object.entries(nested as Record<string, unknown>)) {
      const trimmed = String(val ?? '').trim();
      if (trimmed) specs[key] = trimmed;
    }
  }
  for (const def of RM_QUALITY_SPEC_FIELD_DEFS) {
    const top = source[def.id];
    const trimmed = String(top ?? '').trim();
    if (trimmed && !specs[def.id]) specs[def.id] = trimmed;
  }
  for (const legacyId of RM_QUALITY_SPEC_LEGACY_FLAT_IDS) {
    const top = source[legacyId];
    const trimmed = String(top ?? '').trim();
    if (trimmed && !specs[legacyId]) specs[legacyId] = trimmed;
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

export function flattenRmQualitySpecRowsForPayload(
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

export function flattenRmQualitySubSpecRowsByPathForPayload(
  byPath: Record<string, QualitySpecTableRow[]>
): Record<string, QualitySpecTableRow[]> {
  const out: Record<string, QualitySpecTableRow[]> = {};
  for (const [pathKey, rows] of Object.entries(byPath)) {
    const flattened = flattenRmQualitySpecRowsForPayload(rows);
    if (flattened.length > 0) out[pathKey] = flattened;
  }
  return out;
}

/** Quality spec rows are optional on save (only steps 1–2 enforce required fields). */
export function validateRmQualitySpecRows(
  _rows: QualitySpecTableRow[],
  _ctx: RmQualitySpecContext
): Record<string, string> {
  return {};
}

/** @deprecated Legacy flat map — use hydrateRmQualitySpecRows. */
export function hydrateRmQualitySpecs(source: Record<string, unknown>): Record<string, string> {
  return hydrateLegacyRmQualitySpecs(source);
}

/** @deprecated Legacy flat map — use flattenRmQualitySpecRowsForPayload. */
export function flattenRmQualitySpecsForPayload(
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
