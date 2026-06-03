import {
  normalizeRmDetailSubCategoryForSelect,
  normalizeRmSubCategoryForSelect,
} from '../constants/materialMasterSkuRules';

export type RmCategoryContext = {
  subCategory: string;
  optionalRmSubCategory: string;
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
};

export function getRmConditionalVisibility(ctx: RmCategoryContext): RmConditionalVisibility {
  const cat = normalizeRmSubCategoryForSelect(ctx.subCategory);
  const detail =
    normalizeRmDetailSubCategoryForSelect(ctx.subCategory, ctx.optionalRmSubCategory) ||
    String(ctx.optionalRmSubCategory ?? '').trim();
  const detailNorm = normSub(detail);

  const isBulk = cat === 'Bulk raw materials';
  const isFragrance = cat === 'Fragrance';
  const isColors = cat === 'Colors & Pigments';

  const regMaxUseLevelPct =
    isBulk && (detailNorm === 'preservatives' || detailNorm === 'uv filters');
  const regAllergenDeclarationEu26 = isFragrance;
  const regIfraCategoryLimit = isFragrance;
  const regCiNumber = isColors;
  const regApprovedArea = isColors;

  const state = String(ctx.rmState ?? '').trim();
  const rmPhysicalFormSolid = state === 'Solid';
  const rmPhysicalFormLiquid = state === 'Liquid';

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
  };
}
