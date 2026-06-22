import { buildRmConditionalVisibility } from '../constants/eiMastersUnifiedSchema';
import { hasRmQualitySpecFields } from './rmQualitySpecVisibility';

export type RmCategoryContext = {
  subCategory: string;
  optionalRmSubCategory: string;
  optionalRmSubSubCategory?: string;
  rmState: string;
};

export type RmConditionalVisibility = ReturnType<typeof buildRmConditionalVisibility> & {
  showRegulatoryConditional: boolean;
  showTechnicalConditional: boolean;
  showQualityConditional: boolean;
};

export function getRmConditionalVisibility(ctx: RmCategoryContext): RmConditionalVisibility {
  const flags = buildRmConditionalVisibility(ctx);
  const showQualityConditional = hasRmQualitySpecFields({
    subCategory: ctx.subCategory,
    optionalRmSubCategory: ctx.optionalRmSubCategory,
    optionalRmSubSubCategory: ctx.optionalRmSubSubCategory,
  });

  return {
    ...flags,
    showRegulatoryConditional:
      flags.regMaxUseLevelPct ||
      flags.regAllergenDeclarationEu26 ||
      flags.regIfraCategoryLimit ||
      flags.regCiNumber ||
      flags.regApprovedArea,
    showTechnicalConditional: flags.rmPhysicalFormSolid || flags.rmPhysicalFormLiquid,
    showQualityConditional,
  };
}
