/**
 * Excel Category / Sub-Category are stored verbatim — load for edit without enum remapping.
 */

function trim(s: string | null | undefined): string {
  return String(s || '').trim();
}

export function resolveRmEditCategories(record: {
  code?: string | null;
  category?: string | null;
  rmType?: string | null;
  group?: string | null;
  form_data?: Record<string, unknown> | null;
}): { subCategory: string; rmCategoryKey: string; rmCategory: string; rmType: string } {
  const fd = record.form_data && typeof record.form_data === 'object' ? record.form_data : {};
  const subCategory = trim(
    (fd as { excelSubCategory?: string }).excelSubCategory ||
      (fd as { subCategory?: string }).subCategory ||
      (fd as { sub_category?: string }).sub_category ||
      record.group
  );
  const rmCategory = trim(
    (fd as { excelCategory?: string }).excelCategory ||
      (fd as { rmCategory?: string }).rmCategory ||
      record.category
  );
  const rmType = trim((fd as { rmType?: string }).rmType || record.rmType);

  return {
    subCategory,
    rmCategoryKey: trim((fd as { rmCategoryKey?: string }).rmCategoryKey),
    rmCategory,
    rmType,
  };
}

export function resolvePmEditCategories(record: {
  code?: string | null;
  group?: string | null;
  material?: string | null;
  type?: string | null;
  form_data?: Record<string, unknown> | null;
}): { subCategory: string; pmCategory: string; matBody: string } {
  const fd = record.form_data && typeof record.form_data === 'object' ? record.form_data : {};
  const subCategory = trim(
    (fd as { excelSubCategory?: string }).excelSubCategory ||
      (fd as { subCategory?: string }).subCategory ||
      record.group
  );
  const pmCategory = trim(
    (fd as { excelCategory?: string }).excelCategory ||
      (fd as { pmCategory?: string }).pmCategory ||
      record.material
  );
  const matBody = trim((fd as { matBody?: string }).matBody || record.material);

  return { subCategory, pmCategory, matBody };
}

/** @deprecated Excel is source of truth; kept for code paths that still call this. */
export function inferRmCategoryKeyFromCode(_code: string): string {
  return '';
}

/** @deprecated Excel is source of truth; kept for code paths that still call this. */
export function inferPmCategoryKeyFromCode(_code: string): string {
  return '';
}
