/**
 * RM / PM master dropdowns aligned with EI_Masters_Unified.html taxonomy
 * (see src/constants/eiMastersUnifiedSchema.ts) + internal SKU rules.
 */

import {
  EI_TAX_RM,
  normalizeUnifiedRmCategory,
  normalizeUnifiedRmSubCategory,
  normalizeUnifiedRmSubSubCategory,
  normalizeUnifiedPmSubCategory,
  normalizeUnifiedPmSubSubCategory,
  pmSubCategoryHasSubSub,
  pmSubCategoryOptionsForSlug,
  pmSubSubCategoryOptionsForSubCategory,
  rmSubCategoryHasSubSub,
  rmSubCategoryOptionsForCategory,
  rmSubSubCategoryOptionsForSubCategory,
  type PmSkuCategoryOption as UnifiedPmSkuCategoryOption,
} from './eiMastersUnifiedSchema';

/** RM top-level categories (SKU series 1 / 2 / 3). */
export const RM_SUB_CATEGORY_SKU_OPTIONS = [
  'RAW MATERIALS',
  'FRAGRANCES / PERFUMES',
  'COLOURS',
] as const;

export type RmSubCategorySkuOption = (typeof RM_SUB_CATEGORY_SKU_OPTIONS)[number];

/** Map DB / Excel / legacy `group` strings to a canonical dropdown value. */
export function normalizeRmSubCategoryForSelect(raw: string): RmSubCategorySkuOption | '' {
  const unified = normalizeUnifiedRmCategory(raw);
  if (unified) return unified;
  return '';
}

/** PM category slugs — drives internal SKU series (4 / 5L / 5M / 5O / 6T / 6A). */
export const PM_SKU_CATEGORY_OPTIONS = [
  'ppm',
  'spm-labels',
  'spm-monocarton',
  'spm-other',
  'tpm-tertiary',
  'tpm-ancillary',
] as const;

export type PmSkuCategoryOption = UnifiedPmSkuCategoryOption;

export type PmSkuCodePrefix = '4' | '5M' | '5L' | '5O' | '6T' | '6A';

export const PM_SKU_CATEGORY_SELECT_OPTIONS = [
  { value: 'ppm', label: 'PPM — Primary (4XXXXX)' },
  { value: 'spm-labels', label: 'SPM — Labels (5LXXXXX)' },
  { value: 'spm-monocarton', label: 'SPM — Monocartons (5MXXXXX)' },
  { value: 'spm-other', label: 'SPM — Other Secondary (5OXXXXX)' },
  { value: 'tpm-tertiary', label: 'TPM — Tertiary (6TXXXXX)' },
  { value: 'tpm-ancillary', label: 'TPM — Ancillary (6AXXXX)' },
] as const;

/**
 * All PM functional categories (master form + quality specifications).
 * Stored in `optionalPmSubCategory`; sub-types in `optionalPmSubSubCategory`.
 */
export const PM_FUNCTIONAL_CATEGORY_OPTIONS = [
  'Closures & Pumps',
  'Secondary Pack',
  'Primary Pack',
  'Tertiary Pack',
  'Ancillary',
] as const;

export type PmFunctionalCategoryOption = (typeof PM_FUNCTIONAL_CATEGORY_OPTIONS)[number];

/** Sub-categories under Closures & Pumps (stored in `optionalPmSubSubCategory`). */
export const PM_CLOSURES_SUB_CATEGORY_OPTIONS = [
  'Pump (Lotion/Foam)',
  'Cap (Flip-top/Disc-top)',
  'Sprayer',
  'Dropper Cap',
  'Inner Plug',
] as const;

export type PmClosuresSubCategoryOption = (typeof PM_CLOSURES_SUB_CATEGORY_OPTIONS)[number];

/** Sub-categories under Primary Pack (stored in `optionalPmSubSubCategory`). */
export const PM_PRIMARY_PACK_SUB_CATEGORY_OPTIONS = [
  'Bottle (PET/HDPE)',
  'Tube (Laminated)',
  'Jar (PP/PET)',
  'Sachet',
  'Dropper',
  'Spray (Mist)',
] as const;

export type PmPrimaryPackSubCategoryOption = (typeof PM_PRIMARY_PACK_SUB_CATEGORY_OPTIONS)[number];

/** Sub-categories under Secondary Pack (stored in `optionalPmSubSubCategory`). */
export const PM_SECONDARY_PACK_SUB_CATEGORY_OPTIONS = [
  'Monocarton',
  'Front Label',
  'Back Label',
  'Tamper Sticker',
  'Leaflet',
] as const;

export type PmSecondaryPackSubCategoryOption = (typeof PM_SECONDARY_PACK_SUB_CATEGORY_OPTIONS)[number];

/** Sub-categories under Tertiary Pack (stored in `optionalPmSubSubCategory`). */
export const PM_TERTIARY_PACK_SUB_CATEGORY_OPTIONS = [
  'Master Carton',
  'Pallet Material',
  'Stretch Film',
  'Strapping',
] as const;

export type PmTertiaryPackSubCategoryOption = (typeof PM_TERTIARY_PACK_SUB_CATEGORY_OPTIONS)[number];

/** Sub-categories under Ancillary (stored in `optionalPmSubSubCategory`). */
export const PM_ANCILLARY_SUB_CATEGORY_OPTIONS = [
  'Spatula',
  'Brush',
  'Sponge',
  'QR Card / Insert',
] as const;

export type PmAncillarySubCategoryOption = (typeof PM_ANCILLARY_SUB_CATEGORY_OPTIONS)[number];

/**
 * PM functional taxonomy (master form: category → sub-category).
 * Stored in `optionalPmSubCategory` / `optionalPmSubSubCategory`.
 */
export const PM_FUNCTIONAL_SUB_CATEGORIES: Record<string, readonly string[]> = {
  'Primary Pack': [...PM_PRIMARY_PACK_SUB_CATEGORY_OPTIONS],
  'Closures & Pumps': [...PM_CLOSURES_SUB_CATEGORY_OPTIONS],
  'Secondary Pack': [...PM_SECONDARY_PACK_SUB_CATEGORY_OPTIONS],
  'Tertiary Pack': [...PM_TERTIARY_PACK_SUB_CATEGORY_OPTIONS],
  Ancillary: [...PM_ANCILLARY_SUB_CATEGORY_OPTIONS],
};

/** Functional categories shown per PM SKU series. */
export const PM_SKU_FUNCTIONAL_CATEGORIES: Record<PmSkuCategoryOption, readonly string[]> = {
  ppm: ['Primary Pack', 'Closures & Pumps'],
  'spm-labels': ['Secondary Pack'],
  'spm-monocarton': ['Secondary Pack'],
  'spm-other': ['Secondary Pack'],
  'tpm-tertiary': ['Tertiary Pack'],
  'tpm-ancillary': ['Ancillary'],
};

/** Secondary-pack sub-categories allowed per SPM SKU series. */
export const PM_SECONDARY_SUBS_BY_SKU: Partial<Record<PmSkuCategoryOption, readonly string[]>> = {
  'spm-labels': ['Front Label', 'Back Label'],
  'spm-monocarton': ['Monocarton'],
  'spm-other': ['Tamper Sticker', 'Leaflet'],
};

/** Functional categories per PM SKU series (stored in `optionalPmSubCategory`). */
export const PM_DETAIL_SUB_CATEGORIES: Record<PmSkuCategoryOption, readonly string[]> = {
  ppm: PM_SKU_FUNCTIONAL_CATEGORIES.ppm,
  'spm-labels': PM_SKU_FUNCTIONAL_CATEGORIES['spm-labels'],
  'spm-monocarton': PM_SKU_FUNCTIONAL_CATEGORIES['spm-monocarton'],
  'spm-other': PM_SKU_FUNCTIONAL_CATEGORIES['spm-other'],
  'tpm-tertiary': PM_SKU_FUNCTIONAL_CATEGORIES['tpm-tertiary'],
  'tpm-ancillary': PM_SKU_FUNCTIONAL_CATEGORIES['tpm-ancillary'],
};

/** Sub-category options keyed by functional category — stored in `optionalPmSubSubCategory`. */
export const PM_SUB_SUB_CATEGORIES: Record<string, readonly string[]> = {
  ...PM_FUNCTIONAL_SUB_CATEGORIES,
};

/** @deprecated Use PM_SKU_CATEGORY_OPTIONS — legacy title-case values still seen in older `group` / form_data. */
export const PM_SUB_CATEGORY_SKU_OPTIONS = ['Primary', 'Labels', 'Monocarton'] as const;

/** RM category dropdown (value = persisted on `group` / form `subCategory`; drives internal SKU). */
export const RM_SUB_CATEGORY_SKU_SELECT_OPTIONS = [
  { value: 'RAW MATERIALS', label: 'Raw materials (SKU 1XXXXXX)' },
  { value: 'FRAGRANCES / PERFUMES', label: 'Fragrances / perfumes (SKU 2XXXXXX)' },
  { value: 'COLOURS', label: 'Colours (SKU 3XXXXXX)' },
] as const;

/** Bulk RM functional taxonomy under RAW MATERIALS. */
export const RM_BULK_FUNCTIONAL_SUB_CATEGORIES: Record<string, readonly string[]> = {
  ...EI_TAX_RM['RAW MATERIALS'],
};

/** Finer sub-category options per RM category. */
export const RM_DETAIL_SUB_CATEGORIES: Record<RmSubCategorySkuOption, readonly string[]> = {
  'RAW MATERIALS': Object.keys(EI_TAX_RM['RAW MATERIALS']),
  'FRAGRANCES / PERFUMES': Object.keys(EI_TAX_RM['FRAGRANCES / PERFUMES']),
  COLOURS: Object.keys(EI_TAX_RM.COLOURS),
};

/** Sub-sub options keyed by RM detail sub-category. */
export const RM_SUB_SUB_CATEGORIES: Record<string, readonly string[]> = {
  ...EI_TAX_RM['RAW MATERIALS'],
  ...EI_TAX_RM['FRAGRANCES / PERFUMES'],
  ...EI_TAX_RM.COLOURS,
};

export function rmSkuCategoryRequiresDetailSubCategory(parent: string): boolean {
  return normalizeRmSubCategoryForSelect(parent) !== '';
}

export function rmDetailSubCategoryOptionsForSkuCategory(
  parent: string
): { value: string; label: string }[] {
  return rmSubCategoryOptionsForCategory(parent);
}

/** Match saved / Excel sub-category text to a canonical option for the parent category. */
export function normalizeRmDetailSubCategoryForSelect(parent: string, raw: string): string {
  return normalizeUnifiedRmSubCategory(parent, raw);
}

/** Canonical RM detail sub-category label for sub-sub lookups. */
export function normalizeRmDetailSubCategoryKey(raw: string): string {
  for (const cat of RM_SUB_CATEGORY_SKU_OPTIONS) {
    const hit = normalizeUnifiedRmSubCategory(cat, raw);
    if (hit) return hit;
  }
  return String(raw || '').trim();
}

export function rmDetailSubCategoryHasSubSubCategory(detailSub: string, parentCategory?: string): boolean {
  const parent = parentCategory || 'RAW MATERIALS';
  const key = normalizeRmDetailSubCategoryForSelect(parent, detailSub) || detailSub;
  return rmSubCategoryHasSubSub(parent, key);
}

export function rmBulkUsesFunctionalCategoryTaxonomy(parentSkuCategory: string): boolean {
  return normalizeRmSubCategoryForSelect(parentSkuCategory) === 'RAW MATERIALS';
}

export function rmSubSubCategoryOptionsForDetailSubCategory(
  detailSub: string,
  parentCategory = 'RAW MATERIALS'
): { value: string; label: string }[] {
  const parent = normalizeRmSubCategoryForSelect(parentCategory) || parentCategory;
  const key = normalizeRmDetailSubCategoryForSelect(parent, detailSub) || detailSub;
  return rmSubSubCategoryOptionsForSubCategory(parent, key);
}

export function normalizeRmSubSubCategoryForSelect(detailSub: string, raw: string, parentCategory = 'RAW MATERIALS'): string {
  const parent = normalizeRmSubCategoryForSelect(parentCategory) || parentCategory;
  const sub = normalizeRmDetailSubCategoryForSelect(parent, detailSub) || detailSub;
  return normalizeUnifiedRmSubSubCategory(parent, sub, raw);
}

/** @deprecated Use PM_SKU_CATEGORY_SELECT_OPTIONS — kept for imports that still reference the old name. */
export const PM_SUB_CATEGORY_SKU_SELECT_OPTIONS = PM_SKU_CATEGORY_SELECT_OPTIONS;

const RM_CAT_GENERAL = ['ACT', 'EMOL', 'SURF', 'PRES', 'THIC', 'BUF', 'SOLV', 'MISC'] as const;

/** RM Category keys (EI-RM-*) allowed per sub-category tab. */
export function rmCategoryKeysForSubCategory(sub: string): readonly string[] {
  const k = normalizeRmSubCategoryForSelect(sub);
  if (k === 'FRAGRANCES / PERFUMES') return ['FRAG'];
  if (k === 'COLOURS') return ['COL'];
  if (k === 'RAW MATERIALS') return [...RM_CAT_GENERAL];
  return [];
}

const PM_CAT_PRIMARY = ['PRI', 'CLSR', 'SACH', 'FIOL', 'ALUM', 'AIRLS', 'TAPE', 'GIFT', 'MISC'] as const;

/** PM Category keys (EI-PM-*) allowed per PM category (SKU prefix series). */
export function pmCategoryKeysForSubCategory(sub: string): readonly string[] {
  const canon = normalizePmSkuCategoryForSelect(sub);
  if (canon === 'ppm') return [...PM_CAT_PRIMARY];
  if (canon === 'spm-labels') return ['SLBL'];
  if (canon === 'spm-monocarton') return ['MONO'];
  if (canon === 'spm-other') return ['SACH', 'TAPE', 'GIFT', 'MISC'];
  if (canon === 'tpm-tertiary') return ['SHIP'];
  if (canon === 'tpm-ancillary') return ['MISC'];
  return [];
}

/** Map legacy / Excel strings to PM category slug (persisted on `group`). */
export function normalizePmSkuCategoryForSelect(raw: string): PmSkuCategoryOption | '' {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!k) return '';
  if (k === 'ppm' || k.includes('primary packaging')) return 'ppm';
  if (k.includes('spm') && k.includes('label')) return 'spm-labels';
  if (k === 'labels' || k === 'label') return 'spm-labels';
  if (k.includes('spm') && (k.includes('monocarton') || k.includes('mono carton'))) return 'spm-monocarton';
  if (k === 'monocarton' || k === 'monocartons') return 'spm-monocarton';
  if (
    k.includes('other secondary') ||
    k === 'spm-other' ||
    (k.includes('spm') && k.includes('other'))
  ) {
    return 'spm-other';
  }
  if (
    k.includes('fitment') ||
    k === 'fitness & misc' ||
    k === 'fitments & misc' ||
    (k.includes('fitness') && k.includes('misc')) ||
    (k.includes('fitments') && k.includes('misc'))
  ) {
    return 'tpm-ancillary';
  }
  if (k.includes('ancillary')) return 'tpm-ancillary';
  if (k === 'tpm' || k.includes('tertiary') || k.includes('other component')) {
    return 'tpm-tertiary';
  }
  const exact = PM_SKU_CATEGORY_OPTIONS.find((o) => o === k);
  return exact ?? '';
}

export function pmSkuCategoryRequiresDetailSubCategory(parent: string): boolean {
  return normalizePmSkuCategoryForSelect(parent) !== '';
}

export function pmDetailSubCategoryOptionsForSkuCategory(
  parent: string
): { value: string; label: string }[] {
  const canon = normalizePmSkuCategoryForSelect(parent);
  if (!canon) return [];
  return pmSubCategoryOptionsForSlug(canon);
}

/** @deprecated Unified taxonomy uses item-type subs directly — returns same as pmDetailSubCategoryOptionsForSkuCategory. */
export function pmRecommendedFunctionalCategoriesForSku(parent: string): readonly string[] {
  return pmDetailSubCategoryOptionsForSkuCategory(parent).map((o) => o.value);
}

export function normalizePmDetailSubCategoryForSelect(parent: string, raw: string): string {
  const canon = normalizePmSkuCategoryForSelect(parent);
  if (!canon) return '';
  return normalizeUnifiedPmSubCategory(canon, raw);
}

/** Canonical PM item-type sub-category for lookups. */
export function normalizePmDetailSubCategoryKey(raw: string): string {
  for (const slug of PM_SKU_CATEGORY_OPTIONS) {
    const hit = normalizeUnifiedPmSubCategory(slug, raw);
    if (hit) return hit;
  }
  return String(raw || '').trim();
}

export function pmDetailSubCategoryHasSubSubCategory(detailSub: string, skuCategory?: string): boolean {
  const slug = normalizePmSkuCategoryForSelect(skuCategory ?? '') || 'ppm';
  const key = normalizePmDetailSubCategoryForSelect(slug, detailSub) || detailSub;
  return pmSubCategoryHasSubSub(slug, key);
}

export function pmFunctionalSubCategoryOptionsForSkuCategory(
  skuCategory: string,
  _functionalCategory: string
): { value: string; label: string }[] {
  return pmSubSubCategoryOptionsForDetailSubCategory(_functionalCategory, skuCategory);
}

export function pmSubSubCategoryOptionsForDetailSubCategory(
  detailSub: string,
  skuCategory?: string
): { value: string; label: string }[] {
  const slug = normalizePmSkuCategoryForSelect(skuCategory ?? '') || 'ppm';
  const sub = normalizePmDetailSubCategoryForSelect(slug, detailSub) || detailSub;
  return pmSubSubCategoryOptionsForSubCategory(slug, sub);
}

export function pmUsesFunctionalCategoryTaxonomy(parentSkuCategory: string): boolean {
  return normalizePmSkuCategoryForSelect(parentSkuCategory) !== '';
}

export function normalizePmFunctionalSubCategoryKey(raw: string): string {
  return normalizePmDetailSubCategoryKey(raw);
}

export function normalizePmSubSubCategoryForSelect(
  detailSub: string,
  raw: string,
  skuCategory?: string
): string {
  const slug = normalizePmSkuCategoryForSelect(skuCategory ?? '') || 'ppm';
  const sub = normalizePmDetailSubCategoryForSelect(slug, detailSub) || detailSub;
  return normalizeUnifiedPmSubSubCategory(slug, sub, raw);
}

/** Level auto-derived from category: PPM → Primary, SPM → Secondary, TPM → Tertiary. */
export function pmLevelForSubCategory(sub: string): 'Primary' | 'Secondary' | 'Tertiary' | '' {
  const canon = normalizePmSkuCategoryForSelect(sub);
  if (canon === 'ppm') return 'Primary';
  if (canon === 'spm-monocarton' || canon === 'spm-labels' || canon === 'spm-other') return 'Secondary';
  if (canon === 'tpm-tertiary' || canon === 'tpm-ancillary') return 'Tertiary';
  return '';
}

/** Internal SKU leading prefix for PM code validation / allocation. */
export function pmSubCategorySkuPrefix(sub: string): PmSkuCodePrefix | null {
  const canon = normalizePmSkuCategoryForSelect(sub);
  if (canon === 'ppm') return '4';
  if (canon === 'spm-monocarton') return '5M';
  if (canon === 'spm-labels') return '5L';
  if (canon === 'spm-other') return '5O';
  if (canon === 'tpm-tertiary') return '6T';
  if (canon === 'tpm-ancillary') return '6A';
  return null;
}

export function pmSkuMatchesCodePrefix(sku: string, prefix: PmSkuCodePrefix): boolean {
  const s = String(sku || '').trim();
  if (!s) return false;
  if (prefix === '5L') return /^5[Ll]/.test(s);
  if (prefix === '5M') return /^5M/i.test(s);
  if (prefix === '5O') return /^5O/i.test(s);
  if (prefix === '6T') return /^6T/i.test(s);
  if (prefix === '6A') return /^6A/i.test(s);
  return s.startsWith(prefix);
}

export function isCanonicalPmSkuCategory(raw: string): boolean {
  return normalizePmSkuCategoryForSelect(raw) !== '';
}
