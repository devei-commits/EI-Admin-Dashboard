import {
  clonePrBulkClearanceSubSpecTableDefaults,
  hasPrBulkClearanceSubSpecDefaults,
  prBulkSubSpecPathKey,
} from '../constants/prBulkClearanceSubSpecTableDefaults';
import { clonePrBulkClearanceCommonDefaults } from '../constants/prBulkClearanceCommonTableDefaults';
import { clonePrFinalClearanceCommonDefaults } from '../constants/prFinalClearanceCommonTableDefaults';
import {
  clonePrFinalClearanceSubSpecTableDefaults,
  hasPrFinalClearanceSubSpecDefaults,
  isPrFinalClearanceSubParameter,
} from '../constants/prFinalClearanceSubSpecTableDefaults';
import { isPrFinalClearanceCommonParameter } from '../constants/prFinalClearanceCommonTableDefaults';
import { clonePrDispatchSpecsCommonDefaults } from '../constants/prDispatchSpecsCommonTableDefaults';
import {
  clonePrDispatchSpecsSubSpecTableDefaults,
  hasPrDispatchSpecsSubSpecDefaults,
} from '../constants/prDispatchSpecsSubSpecTableDefaults';
import { getDefaultPrQualitySpecRowsBySection } from '../constants/prQualitySpecTableDefaults';
import {
  normalizePrCategoryForSelect,
  normalizePrSubCategoryForSelect,
} from '../constants/prMasterCategoryOptions';
import {
  PR_QUALITY_SPEC_SECTION_KEYS,
  type PrQualitySpecSectionKey,
} from '../constants/prQualitySpecSections';
import {
  createEmptyQualitySpecRow,
  createQualitySpecAttachment,
  type QualitySpecAttachment,
  type QualitySpecTableRow,
} from '../types/qualitySpecTable';

export type PrQualitySpecContext = {
  category: string;
  prSubCategory: string;
};

export type PrQualitySpecResolvedContext = {
  category: string;
  subCategory: string;
  categoryDisplayLabel: string;
  bulkSubSpecPathKey: string;
};

const LEGACY_FLAT_TO_SECTION: ReadonlyArray<{
  field: string;
  label: string;
  section: PrQualitySpecSectionKey;
}> = [
  { field: 'ph_range', label: 'pH', section: 'bulkClearance' },
  { field: 'phRange', label: 'pH', section: 'bulkClearance' },
  { field: 'viscosity_range', label: 'Viscosity', section: 'bulkClearance' },
  { field: 'viscosity', label: 'Viscosity', section: 'bulkClearance' },
  { field: 'appearance', label: 'Appearance', section: 'bulkClearance' },
  { field: 'odour', label: 'Odor', section: 'bulkClearance' },
  { field: 'microbial_limits', label: 'TAMC / TYMC', section: 'bulkClearance' },
  { field: 'microbialLimits', label: 'TAMC / TYMC', section: 'bulkClearance' },
  { field: 'spf_pa_rating', label: 'SPF / PA Rating', section: 'finalClearance' },
  { field: 'sppRating', label: 'SPF / PA Rating', section: 'finalClearance' },
  { field: 'fill_weight_spec', label: 'Fill Weight', section: 'finalClearance' },
  { field: 'fillWeightSpec', label: 'Fill Weight', section: 'finalClearance' },
];

function emptyBySection(): Record<PrQualitySpecSectionKey, QualitySpecTableRow[]> {
  return {
    bulkClearance: [],
    finalClearance: [],
    dispatchSpecs: [],
  };
}

export function resolvePrQualitySpecContext(ctx: PrQualitySpecContext): PrQualitySpecResolvedContext {
  const category =
    normalizePrCategoryForSelect(ctx.category) || String(ctx.category ?? '').trim();
  const subCategory =
    normalizePrSubCategoryForSelect(category, ctx.prSubCategory) ||
    String(ctx.prSubCategory ?? '').trim();

  return {
    category,
    subCategory,
    categoryDisplayLabel: category || '—',
    bulkSubSpecPathKey: category && subCategory ? prBulkSubSpecPathKey(category, subCategory) : '',
  };
}

export function shouldShowPrBulkSubSpecTable(ctx: PrQualitySpecContext): boolean {
  return Boolean(resolvePrQualitySpecContext(ctx).bulkSubSpecPathKey);
}

export function shouldShowPrFinalSubSpecTable(ctx: PrQualitySpecContext): boolean {
  return Boolean(resolvePrQualitySpecContext(ctx).bulkSubSpecPathKey);
}

export function shouldShowPrDispatchSubSpecTable(ctx: PrQualitySpecContext): boolean {
  return Boolean(resolvePrQualitySpecContext(ctx).bulkSubSpecPathKey);
}

function parseQualitySpecAttachments(raw: unknown, row: Record<string, unknown>): QualitySpecAttachment[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item, idx) => {
        if (!item || typeof item !== 'object') return null;
        const att = item as Record<string, unknown>;
        const name = String(att.name ?? '').trim();
        const url = String(att.url ?? '').trim();
        if (!name && !url) return null;
        return createQualitySpecAttachment({
          id: String(att.id ?? `qsa-${idx}`),
          type: att.type === 'link' ? 'link' : 'file',
          name: name || url,
          url,
        });
      })
      .filter((a): a is QualitySpecAttachment => a !== null);
  }
  const legacy: QualitySpecAttachment[] = [];
  const fileName = String(row.attachmentName ?? row.attachment_name ?? '').trim();
  const linkUrl = String(row.linkUrl ?? row.link_url ?? '').trim();
  if (fileName) legacy.push(createQualitySpecAttachment({ type: 'file', name: fileName, url: '' }));
  if (linkUrl) legacy.push(createQualitySpecAttachment({ type: 'link', name: linkUrl, url: linkUrl }));
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
    id: String(row.id ?? `pr-qs-${idx}`),
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

function isPrQualitySpecSectionKey(key: string): key is PrQualitySpecSectionKey {
  return (PR_QUALITY_SPEC_SECTION_KEYS as readonly string[]).includes(key);
}

function migrateLegacyFlatFields(source: Record<string, unknown>): Record<PrQualitySpecSectionKey, QualitySpecTableRow[]> {
  const out = emptyBySection();
  for (const { field, label, section } of LEGACY_FLAT_TO_SECTION) {
    const trimmed = String(source[field] ?? '').trim();
    if (!trimmed) continue;
    const exists = out[section].some((r) => r.parameter.toLowerCase() === label.toLowerCase());
    if (exists) continue;
    out[section].push(
      createEmptyQualitySpecRow({
        parameter: label,
        specLimit: trimmed,
        mandatory: true,
      })
    );
  }
  return out;
}

function normalizeQualitySpecParameterName(parameter: string): string {
  return parameter.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Move FG / pack QC rows mistakenly stored under Bulk Clearance into Final Clearance. */
export function reconcileMisplacedPrFinalClearanceSpecs(
  bySection: Record<PrQualitySpecSectionKey, QualitySpecTableRow[]>,
  bulkSubByPath: Record<string, QualitySpecTableRow[]>,
  finalSubByPath: Record<string, QualitySpecTableRow[]>
): {
  bySection: Record<PrQualitySpecSectionKey, QualitySpecTableRow[]>;
  bulkSubByPath: Record<string, QualitySpecTableRow[]>;
  finalSubByPath: Record<string, QualitySpecTableRow[]>;
} {
  const finalCommonNames = new Set(
    (bySection.finalClearance ?? []).map((row) => normalizeQualitySpecParameterName(row.parameter))
  );
  const misplacedCommon = (bySection.bulkClearance ?? []).filter((row) =>
    isPrFinalClearanceCommonParameter(row.parameter)
  );
  const keptBulkCommon = (bySection.bulkClearance ?? []).filter(
    (row) => !isPrFinalClearanceCommonParameter(row.parameter)
  );
  const nextFinalCommon = [...(bySection.finalClearance ?? [])];
  for (const row of misplacedCommon) {
    const key = normalizeQualitySpecParameterName(row.parameter);
    if (finalCommonNames.has(key)) continue;
    finalCommonNames.add(key);
    nextFinalCommon.push(row);
  }

  const nextBulkSub: Record<string, QualitySpecTableRow[]> = { ...bulkSubByPath };
  const nextFinalSub: Record<string, QualitySpecTableRow[]> = { ...finalSubByPath };
  for (const [pathKey, rows] of Object.entries(bulkSubByPath)) {
    const misplacedSub = rows.filter((row) => isPrFinalClearanceSubParameter(row.parameter));
    if (misplacedSub.length === 0) continue;
    const keptSub = rows.filter((row) => !isPrFinalClearanceSubParameter(row.parameter));
    if (keptSub.length > 0) nextBulkSub[pathKey] = keptSub;
    else delete nextBulkSub[pathKey];

    const existingFinal = nextFinalSub[pathKey] ?? [];
    const finalSubNames = new Set(
      existingFinal.map((row) => normalizeQualitySpecParameterName(row.parameter))
    );
    const mergedFinal = [...existingFinal];
    for (const row of misplacedSub) {
      const key = normalizeQualitySpecParameterName(row.parameter);
      if (finalSubNames.has(key)) continue;
      finalSubNames.add(key);
      mergedFinal.push(row);
    }
    nextFinalSub[pathKey] = mergedFinal;
  }

  return {
    bySection: {
      ...bySection,
      bulkClearance: keptBulkCommon,
      finalClearance: nextFinalCommon,
    },
    bulkSubByPath: nextBulkSub,
    finalSubByPath: nextFinalSub,
  };
}

export function hydrateAndReconcilePrQualitySpecs(source: Record<string, unknown>): {
  bySection: Record<PrQualitySpecSectionKey, QualitySpecTableRow[]>;
  bulkSubByPath: Record<string, QualitySpecTableRow[]>;
  finalSubByPath: Record<string, QualitySpecTableRow[]>;
  dispatchSubByPath: Record<string, QualitySpecTableRow[]>;
} {
  const reconciled = reconcileMisplacedPrFinalClearanceSpecs(
    hydratePrQualitySpecRowsBySection(source),
    hydratePrQualityBulkSubSpecRowsByPath(source),
    hydratePrQualityFinalSubSpecRowsByPath(source)
  );
  return {
    ...reconciled,
    dispatchSubByPath: hydratePrQualityDispatchSubSpecRowsByPath(source),
  };
}

/** Load tabular PR quality specs keyed by section; migrates legacy scalar product fields when needed. */
export function hydratePrQualitySpecRowsBySection(
  source: Record<string, unknown>
): Record<PrQualitySpecSectionKey, QualitySpecTableRow[]> {
  const nested = source.prQualitySpecRowsBySection ?? source.pr_quality_spec_rows_by_section;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const out = emptyBySection();
    let hasRows = false;
    for (const [key, rawRows] of Object.entries(nested as Record<string, unknown>)) {
      if (!isPrQualitySpecSectionKey(key)) continue;
      const rows = parseQualitySpecRows(rawRows);
      if (rows.length > 0) {
        out[key] = rows;
        hasRows = true;
      }
    }
    if (hasRows) return out;
  }

  const legacy = migrateLegacyFlatFields(source);
  if (PR_QUALITY_SPEC_SECTION_KEYS.some((k) => legacy[k].length > 0)) {
    return legacy;
  }

  return emptyBySection();
}

function hydrateQualitySpecRowsByPathFromSource(
  source: Record<string, unknown>,
  camelKey: string,
  snakeKey: string
): Record<string, QualitySpecTableRow[]> {
  const nested = source[camelKey] ?? source[snakeKey];
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const out: Record<string, QualitySpecTableRow[]> = {};
    for (const [pathKey, rawRows] of Object.entries(nested as Record<string, unknown>)) {
      const rows = parseQualitySpecRows(rawRows);
      if (rows.length > 0) out[pathKey] = rows;
    }
    if (Object.keys(out).length > 0) return out;
  }
  return {};
}

/** Load bulk-clearance sub-category rows keyed by `Category::SubCategory`. */
export function hydratePrQualityBulkSubSpecRowsByPath(
  source: Record<string, unknown>
): Record<string, QualitySpecTableRow[]> {
  return hydrateQualitySpecRowsByPathFromSource(
    source,
    'prQualityBulkSubSpecRowsByPath',
    'pr_quality_bulk_sub_spec_rows_by_path'
  );
}

/** Load final-clearance sub-category rows keyed by `Category::SubCategory`. */
export function hydratePrQualityFinalSubSpecRowsByPath(
  source: Record<string, unknown>
): Record<string, QualitySpecTableRow[]> {
  return hydrateQualitySpecRowsByPathFromSource(
    source,
    'prQualityFinalSubSpecRowsByPath',
    'pr_quality_final_sub_spec_rows_by_path'
  );
}

/** Load dispatch sub-category rows keyed by `Category::SubCategory`. */
export function hydratePrQualityDispatchSubSpecRowsByPath(
  source: Record<string, unknown>
): Record<string, QualitySpecTableRow[]> {
  return hydrateQualitySpecRowsByPathFromSource(
    source,
    'prQualityDispatchSubSpecRowsByPath',
    'pr_quality_dispatch_sub_spec_rows_by_path'
  );
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

export function flattenPrQualitySpecRowsForPayload(rows: QualitySpecTableRow[]): QualitySpecTableRow[] {
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

export function flattenPrQualitySpecRowsBySectionForPayload(
  bySection: Record<PrQualitySpecSectionKey, QualitySpecTableRow[]>
): Record<PrQualitySpecSectionKey, QualitySpecTableRow[]> {
  const out = emptyBySection();
  for (const key of PR_QUALITY_SPEC_SECTION_KEYS) {
    const flattened = flattenPrQualitySpecRowsForPayload(bySection[key] ?? []);
    if (flattened.length > 0) out[key] = flattened;
  }
  return out;
}

function flattenQualitySpecRowsByPathForPayload(
  byPath: Record<string, QualitySpecTableRow[]>
): Record<string, QualitySpecTableRow[]> {
  const out: Record<string, QualitySpecTableRow[]> = {};
  for (const [pathKey, rows] of Object.entries(byPath)) {
    const flattened = flattenPrQualitySpecRowsForPayload(rows);
    if (flattened.length > 0) out[pathKey] = flattened;
  }
  return out;
}

export function flattenPrQualityBulkSubSpecRowsByPathForPayload(
  byPath: Record<string, QualitySpecTableRow[]>
): Record<string, QualitySpecTableRow[]> {
  return flattenQualitySpecRowsByPathForPayload(byPath);
}

export function flattenPrQualityFinalSubSpecRowsByPathForPayload(
  byPath: Record<string, QualitySpecTableRow[]>
): Record<string, QualitySpecTableRow[]> {
  return flattenQualitySpecRowsByPathForPayload(byPath);
}

export function flattenPrQualityDispatchSubSpecRowsByPathForPayload(
  byPath: Record<string, QualitySpecTableRow[]>
): Record<string, QualitySpecTableRow[]> {
  return flattenQualitySpecRowsByPathForPayload(byPath);
}

export function getDefaultPrBulkClearanceCommonRows(ctx: PrQualitySpecContext): QualitySpecTableRow[] {
  const resolved = resolvePrQualitySpecContext(ctx);
  if (!resolved.category) return [];
  return clonePrBulkClearanceCommonDefaults(resolved.category);
}

export function getDefaultPrBulkClearanceSubRows(ctx: PrQualitySpecContext): QualitySpecTableRow[] {
  const resolved = resolvePrQualitySpecContext(ctx);
  if (!resolved.category || !resolved.subCategory) return [];
  if (!hasPrBulkClearanceSubSpecDefaults(resolved.category, resolved.subCategory)) return [];
  return clonePrBulkClearanceSubSpecTableDefaults(resolved.category, resolved.subCategory);
}

export function getDefaultPrFinalClearanceCommonRows(ctx: PrQualitySpecContext): QualitySpecTableRow[] {
  const resolved = resolvePrQualitySpecContext(ctx);
  if (!resolved.category) return [];
  return clonePrFinalClearanceCommonDefaults(resolved.category);
}

export function getDefaultPrFinalClearanceSubRows(ctx: PrQualitySpecContext): QualitySpecTableRow[] {
  const resolved = resolvePrQualitySpecContext(ctx);
  if (!resolved.category || !resolved.subCategory) return [];
  if (!hasPrFinalClearanceSubSpecDefaults(resolved.category, resolved.subCategory)) return [];
  return clonePrFinalClearanceSubSpecTableDefaults(resolved.category, resolved.subCategory);
}

export function getDefaultPrDispatchCommonRows(ctx: PrQualitySpecContext): QualitySpecTableRow[] {
  const resolved = resolvePrQualitySpecContext(ctx);
  if (!resolved.category) return [];
  return clonePrDispatchSpecsCommonDefaults(resolved.category);
}

export function getDefaultPrDispatchSubRows(ctx: PrQualitySpecContext): QualitySpecTableRow[] {
  const resolved = resolvePrQualitySpecContext(ctx);
  if (!resolved.category || !resolved.subCategory) return [];
  if (!hasPrDispatchSpecsSubSpecDefaults(resolved.category, resolved.subCategory)) return [];
  return clonePrDispatchSpecsSubSpecTableDefaults(resolved.category, resolved.subCategory);
}

export function seedPrQualitySpecsIfEmpty(
  ctx: PrQualitySpecContext,
  bySection: Record<PrQualitySpecSectionKey, QualitySpecTableRow[]>,
  bulkSubByPath: Record<string, QualitySpecTableRow[]>,
  finalSubByPath: Record<string, QualitySpecTableRow[]> = {},
  dispatchSubByPath: Record<string, QualitySpecTableRow[]> = {}
): {
  bySection: Record<PrQualitySpecSectionKey, QualitySpecTableRow[]>;
  bulkSubByPath: Record<string, QualitySpecTableRow[]>;
  finalSubByPath: Record<string, QualitySpecTableRow[]>;
  dispatchSubByPath: Record<string, QualitySpecTableRow[]>;
} {
  const reconciled = reconcileMisplacedPrFinalClearanceSpecs(bySection, bulkSubByPath, finalSubByPath);
  const resolved = resolvePrQualitySpecContext(ctx);
  let nextBySection = reconciled.bySection;
  let nextBulkSub = reconciled.bulkSubByPath;
  let nextFinalSub = reconciled.finalSubByPath;
  let nextDispatchSub = dispatchSubByPath;

  const hasAnySection = PR_QUALITY_SPEC_SECTION_KEYS.some((k) => (bySection[k]?.length ?? 0) > 0);
  if (!hasAnySection) {
    nextBySection = getDefaultPrQualitySpecRowsBySection(resolved.category || 'Skin Care');
    if (!resolved.category) {
      nextBySection = { ...nextBySection, bulkClearance: [], finalClearance: [], dispatchSpecs: [] };
    }
  } else {
    if ((bySection.bulkClearance?.length ?? 0) === 0 && resolved.category) {
      nextBySection = {
        ...bySection,
        bulkClearance: getDefaultPrBulkClearanceCommonRows(ctx),
      };
    }
    if ((bySection.finalClearance?.length ?? 0) === 0 && resolved.category) {
      nextBySection = {
        ...nextBySection,
        finalClearance: getDefaultPrFinalClearanceCommonRows(ctx),
      };
    }
    if ((bySection.dispatchSpecs?.length ?? 0) === 0 && resolved.category) {
      nextBySection = {
        ...nextBySection,
        dispatchSpecs: getDefaultPrDispatchCommonRows(ctx),
      };
    }
  }

  if (resolved.bulkSubSpecPathKey) {
    const existing = bulkSubByPath[resolved.bulkSubSpecPathKey];
    if (!existing?.length) {
      const defaults = getDefaultPrBulkClearanceSubRows(ctx);
      if (defaults.length > 0) {
        nextBulkSub = {
          ...bulkSubByPath,
          [resolved.bulkSubSpecPathKey]: defaults,
        };
      }
    }
  }

  if (resolved.bulkSubSpecPathKey) {
    const existing = finalSubByPath[resolved.bulkSubSpecPathKey];
    if (!existing?.length) {
      const defaults = getDefaultPrFinalClearanceSubRows(ctx);
      if (defaults.length > 0) {
        nextFinalSub = {
          ...finalSubByPath,
          [resolved.bulkSubSpecPathKey]: defaults,
        };
      }
    }
  }

  if (resolved.bulkSubSpecPathKey) {
    const existing = dispatchSubByPath[resolved.bulkSubSpecPathKey];
    if (!existing?.length) {
      const defaults = getDefaultPrDispatchSubRows(ctx);
      if (defaults.length > 0) {
        nextDispatchSub = {
          ...dispatchSubByPath,
          [resolved.bulkSubSpecPathKey]: defaults,
        };
      }
    }
  }

  const hasDispatch = (nextBySection.dispatchSpecs?.length ?? 0) > 0;
  if (!hasDispatch && resolved.category) {
    const defaults = getDefaultPrDispatchCommonRows(ctx);
    if (defaults.length > 0) {
      nextBySection = {
        ...nextBySection,
        dispatchSpecs: defaults,
      };
    }
  }

  return {
    bySection: nextBySection,
    bulkSubByPath: nextBulkSub,
    finalSubByPath: nextFinalSub,
    dispatchSubByPath: nextDispatchSub,
  };
}

export function validatePrQualitySpecRowsBySection(
  _bySection: Record<PrQualitySpecSectionKey, QualitySpecTableRow[]>
): Record<string, string> {
  return {};
}
