import {
  normalizeRmDetailSubCategoryForSelect,
  normalizeRmDetailSubCategoryKey,
  normalizeRmSubCategoryForSelect,
  normalizeRmSubSubCategoryForSelect,
} from '../constants/materialMasterSkuRules';
import { hasRmQualitySpecFields } from './rmQualitySpecVisibility';

export type RmCategoryContext = {
  subCategory: string;
  optionalRmSubCategory: string;
  optionalRmSubSubCategory?: string;
  rmState: string;
};

function normSub(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export type RmConditionalVisibility = {
  regMaxUseLevelPct: boolean;
  regAllergenDeclarationEu26: boolean;
  regIfraCategoryLimit: boolean;
  regCiNumber: boolean;
  regApprovedArea: boolean;
  rmPhysicalFormSolid: boolean;
  rmPhysicalFormLiquid: boolean;
  showRegulatoryConditional: boolean;
  showTechnicalConditional: boolean;
  showQualityConditional: boolean;
};

export function getRmConditionalVisibility(ctx: RmCategoryContext): RmConditionalVisibility {
  const cat = normalizeRmSubCategoryForSelect(ctx.subCategory);
  const functionalCat =
    normalizeRmDetailSubCategoryKey(ctx.optionalRmSubCategory) ||
    normalizeRmDetailSubCategoryForSelect(ctx.subCategory, ctx.optionalRmSubCategory) ||
    String(ctx.optionalRmSubCategory ?? '').trim();
  const functionalSub =
    normalizeRmSubSubCategoryForSelect(ctx.optionalRmSubCategory, ctx.optionalRmSubSubCategory) ||
    String(ctx.optionalRmSubSubCategory ?? '').trim();
  const functionalSubNorm = normSub(functionalSub);

  const isBulk = cat === 'Bulk raw materials';
  const isFragranceSku = cat === 'Fragrance';
  const isColors = cat === 'Colors & Pigments';

  const regMaxUseLevelPct =
    isBulk &&
    (functionalCat === 'Preservative' ||
      (functionalCat === 'Active' && functionalSubNorm === 'uv filter'));
  const regAllergenDeclarationEu26 = isFragranceSku || (isBulk && functionalCat === 'Fragrance');
  const regIfraCategoryLimit = regAllergenDeclarationEu26;
  const regCiNumber = isColors;
  const regApprovedArea = isColors;

  const state = String(ctx.rmState ?? '').trim();
  const rmPhysicalFormSolid = state === 'Solid';
  const rmPhysicalFormLiquid = state === 'Liquid';

  const showQualityConditional = hasRmQualitySpecFields({
    subCategory: ctx.subCategory,
    optionalRmSubCategory: ctx.optionalRmSubCategory,
    optionalRmSubSubCategory: ctx.optionalRmSubSubCategory,
  });

  return {
    regMaxUseLevelPct,
    regAllergenDeclarationEu26,
    regIfraCategoryLimit,
    regCiNumber,
    regApprovedArea,
    rmPhysicalFormSolid,
    rmPhysicalFormLiquid,
    showRegulatoryConditional:
      regMaxUseLevelPct ||
      regAllergenDeclarationEu26 ||
      regIfraCategoryLimit ||
      regCiNumber ||
      regApprovedArea,
    showTechnicalConditional: rmPhysicalFormSolid || rmPhysicalFormLiquid,
    showQualityConditional,
  };
}
