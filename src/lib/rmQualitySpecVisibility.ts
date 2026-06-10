import {
  normalizeRmDetailSubCategoryForSelect,
  normalizeRmDetailSubCategoryKey,
  normalizeRmSubCategoryForSelect,
  normalizeRmSubSubCategoryForSelect,
} from '../constants/materialMasterSkuRules';
import {
  RM_QUALITY_SPEC_FIELD_DEFS,
  RM_QUALITY_SPEC_LEGACY_FLAT_IDS,
  type RmBulkFunctionalCategory,
  type RmQualitySpecFieldDef,
} from '../constants/rmQualitySpecFields';

export type RmQualitySpecContext = {
  subCategory: string;
  optionalRmSubCategory: string;
  optionalRmSubSubCategory?: string;
};

function normSub(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export type RmQualitySpecResolvedContext = {
  isBulkFunctional: boolean;
  functionalCategory: RmBulkFunctionalCategory | '';
  functionalSub: string;
  functionalSubNorm: string;
};

export function resolveRmQualitySpecContext(ctx: RmQualitySpecContext): RmQualitySpecResolvedContext {
  const cat = normalizeRmSubCategoryForSelect(ctx.subCategory);
  const isBulk = cat === 'Bulk raw materials';
  const functionalCategory =
    (normalizeRmDetailSubCategoryKey(ctx.optionalRmSubCategory) ||
      normalizeRmDetailSubCategoryForSelect(ctx.subCategory, ctx.optionalRmSubCategory) ||
      String(ctx.optionalRmSubCategory ?? '').trim()) as RmBulkFunctionalCategory | '';
  const functionalSub =
    normalizeRmSubSubCategoryForSelect(ctx.optionalRmSubCategory, ctx.optionalRmSubSubCategory) ||
    String(ctx.optionalRmSubSubCategory ?? '').trim();

  return {
    isBulkFunctional: isBulk && Boolean(functionalCategory),
    functionalCategory,
    functionalSub,
    functionalSubNorm: normSub(functionalSub),
  };
}

function fieldMatchesSub(def: RmQualitySpecFieldDef, functionalSubNorm: string): boolean {
  if (!def.subCategory) return true;
  return normSub(def.subCategory) === functionalSubNorm;
}

export function getVisibleRmQualitySpecFields(ctx: RmQualitySpecContext): RmQualitySpecFieldDef[] {
  const resolved = resolveRmQualitySpecContext(ctx);
  if (!resolved.isBulkFunctional || !resolved.functionalCategory) return [];

  return RM_QUALITY_SPEC_FIELD_DEFS.filter(
    (def) =>
      def.category === resolved.functionalCategory &&
      fieldMatchesSub(def, resolved.functionalSubNorm)
  );
}

export function hasRmQualitySpecFields(ctx: RmQualitySpecContext): boolean {
  return getVisibleRmQualitySpecFields(ctx).length > 0;
}

export type RmQualitySpecFieldGroup = {
  title: string;
  fields: RmQualitySpecFieldDef[];
};

export function groupVisibleRmQualitySpecFields(ctx: RmQualitySpecContext): RmQualitySpecFieldGroup[] {
  const visible = getVisibleRmQualitySpecFields(ctx);
  if (visible.length === 0) return [];

  const common = visible.filter((f) => !f.subCategory);
  const specific = visible.filter((f) => f.subCategory);
  const resolved = resolveRmQualitySpecContext(ctx);
  const groups: RmQualitySpecFieldGroup[] = [];

  if (common.length > 0) {
    groups.push({ title: 'Common', fields: common });
  }
  if (specific.length > 0) {
    const subLabel = resolved.functionalSub || 'Sub-category';
    groups.push({ title: subLabel, fields: specific });
  }
  return groups;
}

/** Quality spec fields are optional on save (only steps 1–2 enforce required fields). */
export function validateRmQualitySpecs(
  _specs: Record<string, string>,
  _ctx: RmQualitySpecContext
): Record<string, string> {
  return {};
}

/** Merge legacy flat qc* keys and rmQualitySpecs object from saved form_data. */
export function hydrateRmQualitySpecs(source: Record<string, unknown>): Record<string, string> {
  const specs: Record<string, string> = {};
  const nested = source.rmQualitySpecs;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    for (const [key, val] of Object.entries(nested as Record<string, unknown>)) {
      const trimmed = String(val ?? '').trim();
      if (trimmed) specs[key] = trimmed;
    }
  }
  for (const id of RM_QUALITY_SPEC_FIELD_IDS_FROM_DEFS()) {
    const top = source[id];
    const trimmed = String(top ?? '').trim();
    if (trimmed && !specs[id]) specs[id] = trimmed;
  }
  for (const legacyId of RM_QUALITY_SPEC_LEGACY_FLAT_IDS) {
    const top = source[legacyId];
    const trimmed = String(top ?? '').trim();
    if (trimmed && !specs[legacyId]) specs[legacyId] = trimmed;
  }
  return specs;
}

function RM_QUALITY_SPEC_FIELD_IDS_FROM_DEFS(): string[] {
  return RM_QUALITY_SPEC_FIELD_DEFS.map((f) => f.id);
}

/** Flatten rmQualitySpecs into payload keys for persistence and preview. */
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
