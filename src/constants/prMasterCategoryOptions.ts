/** PR master — industry category & sub-category (BOM / finished goods registration). */

export const PR_FUNCTIONAL_SUB_CATEGORIES: Record<string, readonly string[]> = {
  'Skin Care': [
    'Cream',
    'Lotion',
    'Serum',
    'Toner',
    'Sunscreen',
    'Face Mask',
    'Body Butter',
    'Eye Cream',
  ],
  'Hair Care': ['Shampoo', 'Conditioner', 'Hair Oil', 'Hair Mask', 'Hair Serum'],
  Cleansing: ['Facewash', 'Body Wash', 'Hand Wash', 'Bar Soap', 'Cleansing Balm'],
  'Color Cosmetics': ['Lipstick', 'Foundation', 'Compact', 'Eyeliner', 'Mascara'],
  'Baby / Sensitive': ['Baby Lotion', 'Baby Wash', 'Sensitive Skin Cream'],
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

/** Legacy EI-PR-* / composite code prefixes → canonical PR category label. */
const LEGACY_CODE_PREFIX_TO_CATEGORY: Record<string, PrCategoryOption> = {
  SKC: 'Skin Care',
  HRC: 'Hair Care',
  BDY: 'Skin Care',
  SUN: 'Skin Care',
  OTC: 'Skin Care',
  COL: 'Color Cosmetics',
  MISC: 'Skin Care',
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
  cleansing: 'Cleansing',
  cleanser: 'Cleansing',
  'color cosmetics': 'Color Cosmetics',
  'colour cosmetics': 'Color Cosmetics',
  cosmetics: 'Color Cosmetics',
  makeup: 'Color Cosmetics',
  'baby / sensitive': 'Baby / Sensitive',
  'baby sensitive': 'Baby / Sensitive',
  baby: 'Baby / Sensitive',
  sensitive: 'Baby / Sensitive',
  miscellaneous: 'Skin Care',
  misc: 'Skin Care',
};

const PR_SUB_CATEGORY_ALIASES: Record<string, string> = {
  cream: 'Cream',
  creams: 'Cream',
  lotion: 'Lotion',
  lotions: 'Lotion',
  serum: 'Serum',
  serums: 'Serum',
  toner: 'Toner',
  toners: 'Toner',
  sunscreen: 'Sunscreen',
  'sun protection': 'Sunscreen',
  spf: 'Sunscreen',
  'face mask': 'Face Mask',
  mask: 'Face Mask',
  'body butter': 'Body Butter',
  'eye cream': 'Eye Cream',
  shampoo: 'Shampoo',
  shampoos: 'Shampoo',
  conditioner: 'Conditioner',
  conditioners: 'Conditioner',
  'hair oil': 'Hair Oil',
  'hair mask': 'Hair Mask',
  'hair serum': 'Hair Serum',
  facewash: 'Facewash',
  'face wash': 'Facewash',
  'body wash': 'Body Wash',
  'hand wash': 'Hand Wash',
  'bar soap': 'Bar Soap',
  'bath bar': 'Bar Soap',
  masque: 'Face Mask',
  soap: 'Bar Soap',
  'cleansing balm': 'Cleansing Balm',
  balm: 'Cleansing Balm',
  lipstick: 'Lipstick',
  lipsticks: 'Lipstick',
  foundation: 'Foundation',
  compact: 'Compact',
  eyeliner: 'Eyeliner',
  mascara: 'Mascara',
  'baby lotion': 'Baby Lotion',
  'baby wash': 'Baby Wash',
  'sensitive skin cream': 'Sensitive Skin Cream',
  hydrating: 'Lotion',
  'anti-aging': 'Cream',
  antiaging: 'Cream',
  brightening: 'Serum',
  'anti-acne': 'Serum',
  antiacne: 'Serum',
  conditioning: 'Conditioner',
  styling: 'Hair Serum',
  'make-up': 'Foundation',
  makeup: 'Foundation',
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
