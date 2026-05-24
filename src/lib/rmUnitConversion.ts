/**
 * RM primary UoM (KG, GM, L, ML) ↔ kilograms for planning vs procurement/PO.
 */

export function normRmPrimaryUom(raw: string | undefined | null): string {
  const u = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!u) return 'KG';
  if (u === 'KG' || u === 'KGS' || u === 'KILO' || u === 'KILOS' || u === 'KILOGRAM' || u === 'KILOGRAMS') return 'KG';
  if (u === 'G' || u === 'GM' || u === 'GRAM' || u === 'GRAMS') return 'GM';
  if (
    u === 'L' ||
    u === 'LT' ||
    u === 'LTR' ||
    u === 'LITRE' ||
    u === 'LITER' ||
    u === 'LITRES' ||
    u === 'LITERS'
  ) {
    return 'L';
  }
  if (u === 'ML' || u === 'MILLILITRE' || u === 'MILLILITER' || u === 'MILLILITRES' || u === 'MILLILITERS') {
    return 'ML';
  }
  return u;
}

export function parseSpecificGravity(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function isVolumePrimaryUom(primaryUom: string | undefined | null): boolean {
  const p = normRmPrimaryUom(primaryUom);
  return p === 'L' || p === 'ML';
}

function roundQty(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Number(n.toFixed(16));
}

export function kgToRmPrimaryQty(
  kg: number,
  primaryUom: string | undefined | null,
  specificGravity = 1
): number {
  const k = Number(kg);
  if (!Number.isFinite(k)) return 0;
  const sg = parseSpecificGravity(specificGravity);
  const p = normRmPrimaryUom(primaryUom);
  if (p === 'KG') return roundQty(k);
  if (p === 'GM') return roundQty(k * 1000);
  if (p === 'L') return roundQty(sg > 0 ? k / sg : k);
  if (p === 'ML') return roundQty(sg > 0 ? (k / sg) * 1000 : k * 1000);
  return roundQty(k);
}

export function rmPrimaryQtyToKg(
  qty: number,
  primaryUom: string | undefined | null,
  specificGravity = 1
): number {
  const q = Number(qty);
  if (!Number.isFinite(q)) return 0;
  const sg = parseSpecificGravity(specificGravity);
  const p = normRmPrimaryUom(primaryUom);
  if (p === 'KG') return roundQty(q);
  if (p === 'GM') return roundQty(q / 1000);
  if (p === 'L') return roundQty(q * sg);
  if (p === 'ML') return roundQty((q / 1000) * sg);
  return roundQty(q);
}

/** Human suffix for procurement qty fields (not planning items-involved, which stays kg). */
export function procurementUnitSuffix(primaryUom: string | undefined | null): string {
  const p = normRmPrimaryUom(primaryUom);
  if (p === 'KG') return ' kg';
  if (p === 'GM') return ' g';
  if (p === 'L') return ' L';
  if (p === 'ML') return ' ml';
  return ` ${p}`;
}

export function procurementQtyFromKgGap(
  kgQty: number,
  primaryUom: string | undefined | null,
  specificGravity = 1
): { qty: number; unit: string } {
  const unit = normRmPrimaryUom(primaryUom);
  return { qty: kgToRmPrimaryQty(kgQty, unit, specificGravity), unit };
}
