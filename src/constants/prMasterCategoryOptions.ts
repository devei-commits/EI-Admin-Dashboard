/** PR master — industry category & sub-category (BOM / finished goods registration). */

export const PR_FUNCTIONAL_SUB_CATEGORIES: Record<string, readonly string[]> = {
  'Skin Care': ['Cleansers', 'Moisturiser', 'Sunscreens', 'Actives', 'Others'],
  'Hair Care': ['Shampoos', 'Conditioners', 'Actives', 'Others'],
  /** Free-text sub-category (no fixed options). */
  Others: [],
};

export const PR_CATEGORY_OPTIONS = Object.keys(
  PR_FUNCTIONAL_SUB_CATEGORIES
) as readonly (keyof typeof PR_FUNCTIONAL_SUB_CATEGORIES)[];

export type PrCategoryOption = (typeof PR_CATEGORY_OPTIONS)[number];

/** All sub-categories (flat) — legacy importers only; prefer per-category options in the form. */
export const PR_SUB_CATEGORY_OPTIONS = [
  ...new Set(Object.values(PR_FUNCTIONAL_SUB_CATEGORIES).flat()),
] as readonly string[];

export type PrSubCategoryOption = (typeof PR_SUB_CATEGORY_OPTIONS)[number];

/** Categories that accept a free-text sub-category instead of a fixed list. */
export function prCategoryAllowsCustomSubCategory(category: string): boolean {
  return normalizePrCategoryForSelect(category) === 'Others';
}

/** Legacy EI-PR-* / composite code prefixes → canonical PR category label. */
const LEGACY_CODE_PREFIX_TO_CATEGORY: Record<string, PrCategoryOption> = {
  SKC: 'Skin Care',
  HRC: 'Hair Care',
  BDY: 'Skin Care',
  SUN: 'Skin Care',
  OTC: 'Skin Care',
  COL: 'Others',
  MISC: 'Others',
};

const PR_CATEGORY_ALIASES: Record<string, PrCategoryOption> = {
  skincare: 'Skin Care',
  'skin care': 'Skin Care',
  'face care': 'Skin Care',
  'body care': 'Skin Care',
  'sun care': 'Skin Care',
  derma: 'Skin Care',
  otc: 'Skin Care',
  'hair care': 'Hair Care',
  haircare: 'Hair Care',
  'hair cares': 'Hair Care',
  cleansing: 'Skin Care',
  cleanser: 'Skin Care',
  cleansers: 'Skin Care',
  'color cosmetics': 'Others',
  'colour cosmetics': 'Others',
  cosmetics: 'Others',
  makeup: 'Others',
  'make-up': 'Others',
  'baby / sensitive': 'Others',
  'baby sensitive': 'Others',
  baby: 'Others',
  sensitive: 'Others',
  miscellaneous: 'Others',
  misc: 'Others',
  other: 'Others',
  others: 'Others',
};

const PR_SUB_CATEGORY_ALIASES: Record<string, string> = {
  cleanser: 'Cleansers',
  cleansers: 'Cleansers',
  cleansing: 'Cleansers',
  facewash: 'Cleansers',
  'face wash': 'Cleansers',
  'body wash': 'Cleansers',
  'hand wash': 'Cleansers',
  'bar soap': 'Cleansers',
  'bath bar': 'Cleansers',
  soap: 'Cleansers',
  'cleansing balm': 'Cleansers',
  balm: 'Cleansers',
  moisturiser: 'Moisturiser',
  moisturizer: 'Moisturiser',
  moisturisers: 'Moisturiser',
  moisturizers: 'Moisturiser',
  sunscreen: 'Sunscreens',
  sunscreens: 'Sunscreens',
  'sun protection': 'Sunscreens',
  spf: 'Sunscreens',
  active: 'Actives',
  actives: 'Actives',
  other: 'Others',
  others: 'Others',
  shampoo: 'Shampoos',
  shampoos: 'Shampoos',
  conditioner: 'Conditioners',
  conditioners: 'Conditioners',
};

export function normalizePrCategoryForSelect(raw: string): PrCategoryOption | '' {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/‑/g, '-');
  if (!k) return '';
  const exact = PR_CATEGORY_OPTIONS.find((o) => o.toLowerCase() === k);
  if (exact) return exact;
  return PR_CATEGORY_ALIASES[k] ?? '';
}

export function prSubCategoryOptionsForCategory(
  category: string
): { value: string; label: string }[] {
  const canon = normalizePrCategoryForSelect(category);
  if (!canon) return [];
  return (PR_FUNCTIONAL_SUB_CATEGORIES[canon] ?? []).map((label) => ({ value: label, label }));
}

export function normalizePrSubCategoryForSelect(category: string, raw: string): string {
  const detail = String(raw || '').trim();
  if (!detail) return '';

  const tryCategory = (cat: string): string => {
    const canon = normalizePrCategoryForSelect(cat);
    if (!canon) return '';
    if (canon === 'Others') {
      return detail;
    }
    const options = PR_FUNCTIONAL_SUB_CATEGORIES[canon] ?? [];
    const lower = detail.toLowerCase().replace(/‑/g, '-');
    const exact = options.find((o) => o.toLowerCase() === lower);
    if (exact) return exact;
    const mapped = PR_SUB_CATEGORY_ALIASES[lower];
    if (mapped && options.includes(mapped)) return mapped;
    return '';
  };

  const catNorm = normalizePrCategoryForSelect(category) || String(category ?? '').trim();
  if (catNorm) {
    return tryCategory(catNorm);
  }

  for (const cat of PR_CATEGORY_OPTIONS) {
    const hit = tryCategory(cat);
    if (hit) return hit;
  }
  return '';
}

export function inferPrCategoryFromSubCategory(sub: string): PrCategoryOption | '' {
  for (const cat of PR_CATEGORY_OPTIONS) {
    if (cat === 'Others') continue;
    if (normalizePrSubCategoryForSelect(cat, sub)) return cat;
  }
  return '';
}

/** Resolve category + sub-category from DB / import (handles legacy flat sub names). */
export function resolvePrCategoryAndSub(
  categoryRaw: string,
  subRaw: string
): { category: string; prSubCategory: string } {
  let category = normalizePrCategoryForSelect(categoryRaw) || String(categoryRaw ?? '').trim();
  let sub = String(subRaw ?? '').trim();

  const subAsCategory = normalizePrCategoryForSelect(sub);
  if (subAsCategory && !normalizePrSubCategoryForSelect(category, sub)) {
    category = subAsCategory;
    sub = '';
  }

  let prSubCategory = normalizePrSubCategoryForSelect(category, sub) || sub;
  if (!category && prSubCategory) {
    category = inferPrCategoryFromSubCategory(prSubCategory) || category;
    prSubCategory = normalizePrSubCategoryForSelect(category, prSubCategory) || prSubCategory;
  }

  return { category, prSubCategory };
}

/** Infer PR category label from legacy alphanumeric codes (EI-PR-SKC-*, EI-CI-HRC-*, etc.). */
export function inferPrCategoryFromLegacyCode(code: string): PrCategoryOption | '' {
  if (!code) return '';
  const upper = code.toUpperCase();
  for (const [key, label] of Object.entries(LEGACY_CODE_PREFIX_TO_CATEGORY)) {
    const pr = `EI-PR-${key}`;
    const ci = `EI-CI-${key}`;
    if (upper.startsWith(`${pr}-`) || upper === pr || upper.startsWith(`${ci}-`) || upper === ci) {
      return label;
    }
  }
  return '';
}
