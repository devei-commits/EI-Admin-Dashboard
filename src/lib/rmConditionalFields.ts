import { hasRmQualitySpecFields } from './rmQualitySpecVisibility';
import { buildRmMasterFieldVisibility } from './rmMasterFieldVisibility';

export type RmCategoryContext = {
  subCategory: string;
  optionalRmSubCategory: string;
  optionalRmSubSubCategory?: string;
  rmState: string;
};

export type RmConditionalVisibility = ReturnType<typeof buildRmMasterFieldVisibility> & {
  showRegulatoryConditional: boolean;
  showTechnicalConditional: boolean;
  showQualityConditional: boolean;
  regMaxUseLevelPct: boolean;
  regAllergenDeclarationEu26: boolean;
  regIfraCategoryLimit: boolean;
  regCiNumber: boolean;
  regApprovedArea: boolean;
  rmPhysicalFormSolid: boolean;
  rmPhysicalFormLiquid: boolean;
};

export function getRmConditionalVisibility(ctx: RmCategoryContext): RmConditionalVisibility {
  const flags = buildRmMasterFieldVisibility(ctx);
  const showQualityConditional = hasRmQualitySpecFields({
    subCategory: ctx.subCategory,
    optionalRmSubCategory: ctx.optionalRmSubCategory,
    optionalRmSubSubCategory: ctx.optionalRmSubSubCategory,
  });

  return {
    ...flags,
    regMaxUseLevelPct: flags.regMaxUseLevelPct ?? false,
    regAllergenDeclarationEu26: flags.regAllergenDeclarationEu26 ?? false,
    regIfraCategoryLimit: flags.regIfraCategoryLimit ?? false,
    regCiNumber: flags.regCiNumber ?? false,
    regApprovedArea: flags.regApprovedArea ?? false,
    rmPhysicalFormSolid: flags.physicalFormSolid ?? false,
    rmPhysicalFormLiquid: flags.physicalFormLiquid ?? false,
    showRegulatoryConditional:
      Boolean(flags.regMaxUseLevelPct) ||
      Boolean(flags.regAllergenDeclarationEu26) ||
      Boolean(flags.regIfraCategoryLimit) ||
      Boolean(flags.regCiNumber) ||
      Boolean(flags.regApprovedArea),
    showTechnicalConditional:
      Boolean(flags.physicalFormSolid) || Boolean(flags.physicalFormLiquid),
    showQualityConditional,
  };
}
