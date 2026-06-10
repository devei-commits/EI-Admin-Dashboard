import {
  normalizePmDetailSubCategoryKey,
  normalizePmFunctionalSubCategoryKey,
  normalizePmSubSubCategoryForSelect,
} from '../constants/materialMasterSkuRules';
import {
  PM_QUALITY_SPEC_FIELD_DEFS,
  type PmFunctionalCategory,
  type PmQualitySpecFieldDef,
} from '../constants/pmQualitySpecFields';

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
};

export function resolvePmQualitySpecContext(ctx: PmQualitySpecContext): PmQualitySpecResolvedContext {
  const functionalCategory = (normalizePmDetailSubCategoryKey(ctx.optionalPmSubCategory) ||
    '') as PmFunctionalCategory | '';
  const sku = ctx.pmSkuCategory || ctx.subCategory || '';
  const functionalSub =
    normalizePmSubSubCategoryForSelect(
      ctx.optionalPmSubCategory,
      ctx.optionalPmSubSubCategory ?? '',
      sku
    ) || String(ctx.optionalPmSubSubCategory ?? '').trim();

  return {
    functionalCategory,
    functionalSub,
    functionalSubNorm: normSub(functionalSub),
  };
}

function fieldMatchesSub(def: PmQualitySpecFieldDef, functionalSubNorm: string): boolean {
  if (!def.subCategory) return true;
  return normSub(def.subCategory) === functionalSubNorm;
}

export function getVisiblePmQualitySpecFields(ctx: PmQualitySpecContext): PmQualitySpecFieldDef[] {
  const resolved = resolvePmQualitySpecContext(ctx);
  if (!resolved.functionalCategory) return [];

  return PM_QUALITY_SPEC_FIELD_DEFS.filter(
    (def) =>
      def.category === resolved.functionalCategory &&
      fieldMatchesSub(def, resolved.functionalSubNorm)
  );
}

export function hasPmQualitySpecFields(ctx: PmQualitySpecContext): boolean {
  return getVisiblePmQualitySpecFields(ctx).length > 0;
}

export type PmQualitySpecFieldGroup = {
  title: string;
  fields: PmQualitySpecFieldDef[];
};

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

/** Quality spec fields are optional on save (only steps 1–2 enforce required fields). */
export function validatePmQualitySpecs(
  _specs: Record<string, string>,
  _ctx: PmQualitySpecContext
): Record<string, string> {
  return {};
}

export function hydratePmQualitySpecs(source: Record<string, unknown>): Record<string, string> {
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
