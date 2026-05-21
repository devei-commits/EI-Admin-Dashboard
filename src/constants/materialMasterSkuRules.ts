/**
 * RM / PM master dropdowns aligned with internal SKU rules + multi-sheet Excel import
 * (see ei-website-backend/src/masterBulk/rmMasterExcelUpload.js and pmMasterExcelUpload.js).
 */

/** RM workbook tabs / canonical sub-categories — Bulk/Fragrance/Colors use leading digit 1 / 2 / 3; Club items use CLUB prefix. */
export const RM_SUB_CATEGORY_SKU_OPTIONS = [
  'Bulk raw materials',
  'Fragrance',
  'Colors & Pigments',
  'Club Items',
] as const;

export type RmSubCategorySkuOption = (typeof RM_SUB_CATEGORY_SKU_OPTIONS)[number];

/** Map DB / Excel / legacy `group` strings to a canonical dropdown value. */
export function normalizeRmSubCategoryForSelect(raw: string): RmSubCategorySkuOption | '' {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!k) return '';
  if (k === 'fragrance' || k === 'fragrances') return 'Fragrance';
  if (k === 'colors & pigments' || k === 'color & pigments') return 'Colors & Pigments';
  if (k === 'club items' || k === 'club item') return 'Club Items';
  if (
    k === 'raw material' ||
    k === 'raw materials' ||
    k.includes('bulk raw') ||
    k === 'solvents & carriers' ||
    k === 'pre-mixed bases' ||
    k === 'pre-mixed based'
  ) {
    return 'Bulk raw materials';
  }
  const exact = RM_SUB_CATEGORY_SKU_OPTIONS.find((o) => o.toLowerCase() === k);
  return exact ?? '';
}

/** PM sub-category slugs — PPM / SPM / TPM (SKU: 4 / 5M / 5L). */
export const PM_SKU_CATEGORY_OPTIONS = ['ppm', 'spm-monocarton', 'spm-labels', 'tpm'] as const;

export type PmSkuCategoryOption = (typeof PM_SKU_CATEGORY_OPTIONS)[number];

export const PM_SKU_CATEGORY_SELECT_OPTIONS = [
  { value: 'ppm', label: 'PPM' },
  { value: 'spm-monocarton', label: 'SPM - Monocarton' },
  { value: 'spm-labels', label: 'SPM - Labels' },
  { value: 'tpm', label: 'TPM - Other components' },
] as const;

/** @deprecated Use PM_SKU_CATEGORY_OPTIONS — legacy title-case values still seen in older `group` / form_data. */
export const PM_SUB_CATEGORY_SKU_OPTIONS = ['Primary', 'Labels', 'Monocarton'] as const;

/** RM category dropdown (value = persisted on `group` / form `subCategory`; drives internal SKU). */
export const RM_SUB_CATEGORY_SKU_SELECT_OPTIONS = [
  { value: 'Bulk raw materials', label: 'Bulk raw materials (SKU starts with 1)' },
  { value: 'Fragrance', label: 'Fragrance (SKU starts with 2)' },
  { value: 'Colors & Pigments', label: 'Colors & pigments (SKU starts with 3)' },
  { value: 'Club Items', label: 'Club items (SKU starts with CLUB)' },
] as const;

/** @deprecated Use PM_SKU_CATEGORY_SELECT_OPTIONS — kept for imports that still reference the old name. */
export const PM_SUB_CATEGORY_SKU_SELECT_OPTIONS = PM_SKU_CATEGORY_SELECT_OPTIONS;

const RM_CAT_GENERAL = ['ACT', 'EMOL', 'SURF', 'PRES', 'THIC', 'BUF', 'SOLV', 'MISC'] as const;

/** RM Category keys (EI-RM-*) allowed per sub-category tab. */
export function rmCategoryKeysForSubCategory(sub: string): readonly string[] {
  const k = String(sub || '')
    .trim()
    .toLowerCase();
  if (k === 'fragrance' || k === 'fragrances') return ['FRAG'];
  if (k === 'colors & pigments') return ['COL'];
  if (
    k === 'bulk raw materials' ||
    k === 'raw material' ||
    k === 'raw materials' ||
    k.includes('bulk raw') ||
    k === 'club items'
  ) {
    return [...RM_CAT_GENERAL];
  }
  return [];
}

const PM_CAT_PRIMARY = ['PRI', 'CLSR', 'SACH', 'FIOL', 'ALUM', 'AIRLS', 'TAPE', 'GIFT', 'MISC'] as const;

/** PM Category keys (EI-PM-*) allowed per PM sub-category (SKU prefix series). */
export function pmCategoryKeysForSubCategory(sub: string): readonly string[] {
  const canon = normalizePmSkuCategoryForSelect(sub);
  if (canon === 'ppm' || canon === 'tpm') return [...PM_CAT_PRIMARY];
  if (canon === 'spm-labels') return ['SLBL'];
  if (canon === 'spm-monocarton') return ['MONO'];
  return [];
}

/** Map legacy / Excel strings to PM sub-category slug (persisted on `group`). */
export function normalizePmSkuCategoryForSelect(raw: string): PmSkuCategoryOption | '' {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!k) return '';
  if (k === 'ppm') return 'ppm';
  if (k.includes('spm') && (k.includes('monocarton') || k.includes('mono carton'))) return 'spm-monocarton';
  if (k === 'monocarton' || k === 'monocartons') return 'spm-monocarton';
  if (k.includes('spm') && k.includes('label')) return 'spm-labels';
  if (k === 'labels' || k === 'label') return 'spm-labels';
  if (k === 'tpm' || k.includes('other component')) return 'tpm';
  if (k === 'primary') return 'tpm';
  const exact = PM_SKU_CATEGORY_OPTIONS.find((o) => o === k);
  return exact ?? '';
}

/** Level auto-derived from sub-category: PPM → Primary, SPM → Secondary, TPM → Tertiary. */
export function pmLevelForSubCategory(sub: string): 'Primary' | 'Secondary' | 'Tertiary' | '' {
  const canon = normalizePmSkuCategoryForSelect(sub);
  if (canon === 'ppm') return 'Primary';
  if (canon === 'spm-monocarton' || canon === 'spm-labels') return 'Secondary';
  if (canon === 'tpm') return 'Tertiary';
  return '';
}

/** Internal SKU leading prefix for PM code validation. */
export function pmSubCategorySkuPrefix(sub: string): '4' | '5M' | '5L' | null {
  const canon = normalizePmSkuCategoryForSelect(sub);
  if (canon === 'spm-monocarton') return '5M';
  if (canon === 'spm-labels') return '5L';
  if (canon === 'ppm' || canon === 'tpm') return '4';
  return null;
}

export function isCanonicalPmSkuCategory(raw: string): boolean {
  return normalizePmSkuCategoryForSelect(raw) !== '';
}
