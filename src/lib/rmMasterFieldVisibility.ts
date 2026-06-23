import {
  condOK,
  normalizeUnifiedRmCategory,
  normalizeUnifiedRmSubCategory,
  type EiCondContext,
} from '../constants/eiMastersUnifiedSchema';
import { RM_VENDOR_SECTION_REDUNDANT_KEY_SET } from '../constants/masterVendorSectionRedundantFields';
import {
  rmFieldsForModule,
  type RmMasterFieldDef,
  type RmMasterModuleSlug,
} from '../constants/rmMasterFieldSchema';

export type RmMasterFieldContext = {
  subCategory: string;
  optionalRmSubCategory: string;
  optionalRmSubSubCategory?: string;
  rmState: string;
};

export function buildRmMasterFieldContext(ctx: RmMasterFieldContext): EiCondContext {
  const cat = normalizeUnifiedRmCategory(ctx.subCategory);
  const sub =
    normalizeUnifiedRmSubCategory(ctx.subCategory, ctx.optionalRmSubCategory) ||
    ctx.optionalRmSubCategory;
  return {
    cat,
    sub,
    subsub: ctx.optionalRmSubSubCategory,
    vals: { State: ctx.rmState },
  };
}

export function isRmMasterFieldVisible(
  field: RmMasterFieldDef,
  ctx: RmMasterFieldContext
): boolean {
  return condOK(field.cond, buildRmMasterFieldContext(ctx));
}

export function visibleRmFieldsForModule(
  moduleSlug: RmMasterModuleSlug,
  ctx: RmMasterFieldContext,
  skipKeys: readonly string[] = []
): RmMasterFieldDef[] {
  const skip = new Set([...skipKeys, ...RM_VENDOR_SECTION_REDUNDANT_KEY_SET]);
  return rmFieldsForModule(moduleSlug).filter(
    (field) => !skip.has(field.key) && isRmMasterFieldVisible(field, ctx)
  );
}

export function buildRmMasterFieldVisibility(ctx: RmMasterFieldContext): Record<string, boolean> {
  const condCtx = buildRmMasterFieldContext(ctx);
  const out: Record<string, boolean> = {};
  for (const slug of [
    'primary',
    'units',
    'regulatory',
    'technical',
    'quality',
    'sourcing',
  ] as const) {
    for (const field of rmFieldsForModule(slug)) {
      out[field.key] = condOK(field.cond, condCtx);
    }
  }
  return out;
}
