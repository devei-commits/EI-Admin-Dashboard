/**
 * RM / PM master dropdowns aligned with internal SKU rules + multi-sheet Excel import
 * (see ei-website-backend/src/masterBulk/rmMasterExcelUpload.js and pmMasterExcelUpload.js).
 */

/** RM workbook tabs / canonical sub-categories — leading digit 1 / 2 / 3 (Club shares 1 with Raw). */
export const RM_SUB_CATEGORY_SKU_OPTIONS = ['Raw material', 'Fragrance', 'Colors & Pigments', 'Club Items'] as const;

/** PM internal code series — Primary 4…, Monocarton 5M…, Labels 5l… (packMaterials/controller.js). */
export const PM_SUB_CATEGORY_SKU_OPTIONS = ['Primary', 'Labels', 'Monocarton'] as const;

const RM_CAT_GENERAL = ['ACT', 'EMOL', 'SURF', 'PRES', 'THIC', 'BUF', 'SOLV', 'MISC'] as const;

/** RM Category keys (EI-RM-*) allowed per sub-category tab. */
export function rmCategoryKeysForSubCategory(sub: string): readonly string[] {
  const k = String(sub || '')
    .trim()
    .toLowerCase();
  if (k === 'fragrance' || k === 'fragrances') return ['FRAG'];
  if (k === 'colors & pigments') return ['COL'];
  if (k === 'raw material' || k === 'raw materials' || k === 'club items') return [...RM_CAT_GENERAL];
  return [];
}

const PM_CAT_PRIMARY = ['PRI', 'CLSR', 'SACH', 'FIOL', 'ALUM', 'AIRLS', 'TAPE', 'GIFT', 'MISC'] as const;

/** PM Category keys (EI-PM-*) allowed per PM sub-category (SKU prefix series). */
export function pmCategoryKeysForSubCategory(sub: string): readonly string[] {
  const k = String(sub || '')
    .trim()
    .toLowerCase();
  if (k === 'primary' || k === 'primary packaging') return [...PM_CAT_PRIMARY];
  if (k === 'labels' || k === 'label') return ['SLBL'];
  if (k === 'monocarton' || k === 'monocartons') return ['MONO'];
  return [];
}
