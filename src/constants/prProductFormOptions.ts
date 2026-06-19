/** PR master — product form (physical format of finished goods). */

export const PR_PRODUCT_FORM_OPTIONS = [
  'Cream',
  'Lotion',
  'Serum',
  'Gel',
  'Oil',
  'Stick',
  'Balm',
  'Bar',
  'Powder',
  'Liquid',
  'Spray',
  'Foam',
  'Mask',
  'Wipes',
  'Patch',
  'Powder-to-liquid',
] as const;

export type PrProductFormOption = (typeof PR_PRODUCT_FORM_OPTIONS)[number];

export function isCanonicalPrProductForm(raw: string): raw is PrProductFormOption {
  return PR_PRODUCT_FORM_OPTIONS.includes(raw as PrProductFormOption);
}

export function normalizePrProductFormForSelect(raw: string): PrProductFormOption | '' {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!k) return '';
  const exact = PR_PRODUCT_FORM_OPTIONS.find((o) => o.toLowerCase() === k);
  if (exact) return exact;
  if (k === 'lotion/cream' || k === 'lotion cream') return 'Cream';
  if (k === 'powder to liquid' || k === 'powder-to liquid') return 'Powder-to-liquid';
  return '';
}
