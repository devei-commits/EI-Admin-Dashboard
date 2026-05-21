/**
 * Excel Category / Sub-Category map to category + sub-sub-category; SKU series uses sub-category dropdown.
 */

import {
  normalizeRmSubCategoryForSelect,
  normalizePmSkuCategoryForSelect,
} from '../constants/materialMasterSkuRules';

function trim(s: string | null | undefined): string {
  return String(s || '').trim();
}

export function resolveRmEditCategories(record: {
  code?: string | null;
  category?: string | null;
  rmType?: string | null;
  group?: string | null;
  form_data?: Record<string, unknown> | null;
}): { subCategory: string; rmCategoryKey: string; rmCategory: string; rmType: string; optionalRmSubCategory: string } {
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
  const rmType = trim((fd as { rmType?: string }).rmType || record.rmType);
  const optionalRmSubCategory = trim((fd as { optionalRmSubCategory?: string }).optionalRmSubCategory);

  return {
    subCategory,
    rmCategoryKey: trim((fd as { rmCategoryKey?: string }).rmCategoryKey),
    rmCategory,
    rmType,
    optionalRmSubCategory,
  };
}

export function resolvePmEditCategories(record: {
  code?: string | null;
  group?: string | null;
  material?: string | null;
  type?: string | null;
  form_data?: Record<string, unknown> | null;
}): { subCategory: string; optionalPmSubCategory: string } {
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
  const optionalPmSubCategory = trim(
    (fd as { optionalPmSubCategory?: string }).optionalPmSubCategory ||
      (excelSub && excelSub.toLowerCase() !== subCategoryRaw.toLowerCase() && excelSub.toLowerCase() !== excelCat.toLowerCase()
        ? excelSub
        : '')
  );

  return { subCategory, optionalPmSubCategory };
}

/** @deprecated Excel is source of truth; kept for code paths that still call this. */
export function inferRmCategoryKeyFromCode(_code: string): string {
  return '';
}

/** @deprecated Excel is source of truth; kept for code paths that still call this. */
export function inferPmCategoryKeyFromCode(_code: string): string {
  return '';
}
