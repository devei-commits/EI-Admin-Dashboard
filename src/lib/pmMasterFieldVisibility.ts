import {
  condOK,
  PM_SLUG_TO_CATEGORY_LABEL,
  normalizeUnifiedPmSubCategory,
  type EiCondContext,
  type PmSkuCategoryOption,
} from '../constants/eiMastersUnifiedSchema';
import { PM_VENDOR_SECTION_REDUNDANT_KEY_SET } from '../constants/masterVendorSectionRedundantFields';
import {
  pmFieldsForModule,
  type PmMasterFieldDef,
  type PmMasterModuleSlug,
} from '../constants/pmMasterFieldSchema';

export type PmMasterFieldContext = {
  pmSkuCategory: string;
  optionalPmSubCategory: string;
  optionalPmSubSubCategory?: string;
};

export function buildPmMasterFieldContext(ctx: PmMasterFieldContext): EiCondContext {
  const slug = (ctx.pmSkuCategory || '') as PmSkuCategoryOption;
  const cat = PM_SLUG_TO_CATEGORY_LABEL[slug] ?? '';
  const sub =
    normalizeUnifiedPmSubCategory(slug, ctx.optionalPmSubCategory) || ctx.optionalPmSubCategory;
  return {
    cat,
    sub,
    subsub: ctx.optionalPmSubSubCategory,
  };
}

export function isPmMasterFieldVisible(
  field: PmMasterFieldDef,
  ctx: PmMasterFieldContext
): boolean {
  return condOK(field.cond, buildPmMasterFieldContext(ctx));
}

export function visiblePmFieldsForModule(
  moduleSlug: PmMasterModuleSlug,
  ctx: PmMasterFieldContext,
  skipKeys: readonly string[] = []
): PmMasterFieldDef[] {
  const skip = new Set([...skipKeys, ...PM_VENDOR_SECTION_REDUNDANT_KEY_SET]);
  return pmFieldsForModule(moduleSlug).filter(
    (field) => !skip.has(field.key) && isPmMasterFieldVisible(field, ctx)
  );
}

export function buildPmMasterFieldVisibility(
  ctx: PmMasterFieldContext
): Record<string, boolean> {
  const condCtx = buildPmMasterFieldContext(ctx);
  const out: Record<string, boolean> = {};
  for (const field of pmFieldsForModule('primary')) {
    out[field.key] = condOK(field.cond, condCtx);
  }
  for (const slug of [
    'primary',
    'units',
    'dimensions',
    'material',
    'aesthetics',
    'quality',
    'vendors',
  ] as const) {
    for (const field of pmFieldsForModule(slug)) {
      out[field.key] = condOK(field.cond, condCtx);
    }
  }
  return out;
}
