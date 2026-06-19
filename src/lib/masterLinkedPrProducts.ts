import type { PRProductListItem } from '../services/productsMaster.service';

export function normalizeMasterLinkedSkuKey(s: string): string {
  return String(s ?? '').trim().toLowerCase();
}

/** Parse linked PR product codes from master `products` array and/or associate-items text. */
export function parseMasterLinkedProductCodes(input: {
  products?: string[];
  associateItems?: string | null;
}): string[] {
  if (Array.isArray(input.products) && input.products.length > 0) {
    return [...new Set(input.products.map((c) => String(c).trim()).filter(Boolean))];
  }
  const assoc = String(input.associateItems ?? '').trim();
  if (!assoc) return [];
  return [...new Set(assoc.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))];
}

/** Map product_code and zoho_sku_code (lowercased) → product row. */
export function buildPrProductLookup(products: PRProductListItem[]): Map<string, PRProductListItem> {
  const m = new Map<string, PRProductListItem>();
  for (const p of products) {
    const code = normalizeMasterLinkedSkuKey(p.product_code ?? '');
    const zoho = normalizeMasterLinkedSkuKey(p.zoho_sku_code ?? '');
    if (code) m.set(code, p);
    if (zoho && zoho !== code) m.set(zoho, p);
  }
  return m;
}

export function getPrMasterEditPath(productId: number): string {
  return `/bom/${productId}`;
}

export type MasterLinkedPrProductRow = {
  sku: string;
  product?: PRProductListItem;
};

export function resolveMasterLinkedPrProductRows(
  codes: string[],
  lookup: Map<string, PRProductListItem>
): MasterLinkedPrProductRow[] {
  return codes.map((sku) => {
    const key = normalizeMasterLinkedSkuKey(sku);
    const product = key ? lookup.get(key) : undefined;
    return { sku, product };
  });
}
