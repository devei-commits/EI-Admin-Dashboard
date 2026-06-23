/**
 * Excel Category / Sub-Category map to category + sub-category detail; SKU series uses category dropdown.
 */

import {
  normalizeRmSubCategoryForSelect,
  normalizeRmSubSubCategoryForSelect,
  normalizeRmDetailSubCategoryForSelect,
  normalizePmSkuCategoryForSelect,
  normalizePmDetailSubCategoryForSelect,
  normalizePmSubSubCategoryForSelect,
} from '../constants/materialMasterSkuRules';

function trim(s: string | null | undefined): string {
  return String(s || '').trim();
}

export function resolveRmEditCategories(record: {
  code?: string | null;
  category?: string | null;
  group?: string | null;
  form_data?: Record<string, unknown> | null;
}): {
  subCategory: string;
  rmCategoryKey: string;
  rmCategory: string;
  optionalRmSubCategory: string;
  optionalRmSubSubCategory: string;
} {
  const fd = record.form_data && typeof record.form_data === 'object' ? record.form_data : {};
  const subCategoryRaw = trim(
    (fd as { excelSubCategory?: string }).excelSubCategory ||
      (fd as { subCategory?: string }).subCategory ||
      (fd as { sub_category?: string }).sub_category ||
      record.group ||
      record.category
  );
  const subCategory =
    normalizeRmSubCategoryForSelect(subCategoryRaw) ||
    normalizeRmSubCategoryForSelect(record.category || '') ||
    normalizeRmSubCategoryForSelect(record.group || '') ||
    subCategoryRaw;
  const rmCategory = trim(
    (fd as { excelCategory?: string }).excelCategory ||
      (fd as { rmCategory?: string }).rmCategory ||
      record.category
  );
  const optionalRmSubCategory =
    normalizeRmDetailSubCategoryForSelect(subCategory, trim((fd as { optionalRmSubCategory?: string }).optionalRmSubCategory)) ||
    trim((fd as { optionalRmSubCategory?: string }).optionalRmSubCategory);
  const optionalRmSubSubCategoryRaw = trim(
    (fd as { optionalRmSubSubCategory?: string }).optionalRmSubSubCategory ||
      (fd as { rm_sub_sub_category?: string }).rm_sub_sub_category
  );
  const optionalRmSubSubCategory =
    normalizeRmSubSubCategoryForSelect(
      optionalRmSubCategory,
      optionalRmSubSubCategoryRaw,
      subCategory
    ) || optionalRmSubSubCategoryRaw;

  return {
    subCategory,
    rmCategoryKey: trim((fd as { rmCategoryKey?: string }).rmCategoryKey),
    rmCategory,
    optionalRmSubCategory,
    optionalRmSubSubCategory,
  };
}

export function resolvePmEditCategories(record: {
  code?: string | null;
  group?: string | null;
  material?: string | null;
  form_data?: Record<string, unknown> | null;
}): { subCategory: string; optionalPmSubCategory: string; optionalPmSubSubCategory: string } {
  const fd = record.form_data && typeof record.form_data === 'object' ? record.form_data : {};
  const excelCat = trim(
    (fd as { excelCategory?: string }).excelCategory ||
      (fd as { pmCategory?: string }).pmCategory ||
      (fd as { matBody?: string }).matBody ||
      record.material ||
      ''
  );
  const excelSub = trim((fd as { excelSubCategory?: string }).excelSubCategory);
  const subCategoryRaw = trim(
    (fd as { pmSkuCategory?: string }).pmSkuCategory ||
      (fd as { subCategory?: string }).subCategory ||
      record.group ||
      excelCat
  );
  const subCategory =
    normalizePmSkuCategoryForSelect(subCategoryRaw) ||
    normalizePmSkuCategoryForSelect(excelCat) ||
    subCategoryRaw;
  const optionalPmSubCategoryRaw = trim(
    (fd as { optionalPmSubCategory?: string }).optionalPmSubCategory ||
      (excelSub &&
      excelSub.toLowerCase() !== subCategoryRaw.toLowerCase() &&
      excelSub.toLowerCase() !== excelCat.toLowerCase()
        ? excelSub
        : '') ||
      (record.material && String(record.material).trim() !== subCategory ? String(record.material).trim() : '')
  );
  const optionalPmSubCategory =
    normalizePmDetailSubCategoryForSelect(subCategory, optionalPmSubCategoryRaw) ||
    optionalPmSubCategoryRaw;
  const optionalPmSubSubCategoryRaw = trim(
    (fd as { optionalPmSubSubCategory?: string }).optionalPmSubSubCategory ||
      (fd as { pm_sub_sub_category?: string }).pm_sub_sub_category ||
      ''
  );
  const optionalPmSubSubCategory =
    normalizePmSubSubCategoryForSelect(optionalPmSubCategory, optionalPmSubSubCategoryRaw, subCategory) ||
    optionalPmSubSubCategoryRaw;

  return { subCategory, optionalPmSubCategory, optionalPmSubSubCategory };
}

/** @deprecated Excel is source of truth; kept for code paths that still call this. */
export function inferRmCategoryKeyFromCode(_code: string): string {
  return '';
}

/** @deprecated Excel is source of truth; kept for code paths that still call this. */
export function inferPmCategoryKeyFromCode(_code: string): string {
  return '';
}
