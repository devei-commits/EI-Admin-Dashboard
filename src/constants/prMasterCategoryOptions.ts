/** PR master — industry category & sub-category (BOM / finished goods registration). */

export const PR_CATEGORY_OPTIONS = [
  'Face Care',
  'Body Care',
  'Hair Care',
  'Colour Cosmetics',
  'Miscellaneous',
] as const;

export type PrCategoryOption = (typeof PR_CATEGORY_OPTIONS)[number];

export const PR_SUB_CATEGORY_OPTIONS = [
  'Cleansing',
  'Hydrating',
  'Anti-Aging',
  'Brightening',
  'Anti-Acne',
  'Sun Protection',
  'Conditioning',
  'Styling',
  'Make-up',
] as const;

export type PrSubCategoryOption = (typeof PR_SUB_CATEGORY_OPTIONS)[number];

/** Legacy EI-PR-* / composite code prefixes → canonical PR category label. */
const LEGACY_CODE_PREFIX_TO_CATEGORY: Record<string, PrCategoryOption> = {
  SKC: 'Face Care',
  HRC: 'Hair Care',
  BDY: 'Body Care',
  SUN: 'Face Care',
  OTC: 'Face Care',
  COL: 'Colour Cosmetics',
  MISC: 'Miscellaneous',
};

export function normalizePrCategoryForSelect(raw: string): PrCategoryOption | '' {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!k) return '';
  const exact = PR_CATEGORY_OPTIONS.find((o) => o.toLowerCase() === k);
  if (exact) return exact;
  if (k === 'skincare' || k.includes('skin care') || k.includes('face care') || k === 'sun care' || k.includes('otc') || k.includes('derma')) {
    return 'Face Care';
  }
  if (k.includes('hair')) return 'Hair Care';
  if (k.includes('body')) return 'Body Care';
  if (k.includes('colour') || k.includes('color cosmetic')) return 'Colour Cosmetics';
  if (k === 'misc' || k.includes('miscellaneous')) return 'Miscellaneous';
  return '';
}

export function normalizePrSubCategoryForSelect(raw: string): PrSubCategoryOption | '' {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/‑/g, '-');
  if (!k) return '';
  const exact = PR_SUB_CATEGORY_OPTIONS.find((o) => o.toLowerCase().replace(/‑/g, '-') === k);
  if (exact) return exact;
  if (k === 'anti aging' || k === 'antiaging') return 'Anti-Aging';
  if (k === 'anti acne' || k === 'antiacne') return 'Anti-Acne';
  if (k.includes('sun protect') || k === 'spf') return 'Sun Protection';
  if (k === 'makeup' || k === 'make up') return 'Make-up';
  return '';
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
