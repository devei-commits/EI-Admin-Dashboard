/**
 * PM lines often carry the finished-good size UOM (e.g. KG for a 1kg SKU).
 * For read-only UI (Planning confirm BOM, /bom Pack BOM), show discrete pack count as PCS.
 */
export function toPmDisplayUnit(_unit?: string | null): 'PCS' {
  return 'PCS';
}
