import type { RawMaterialRecord } from '../services/rawMaterials.service';

const CLUB_SKU_PREFIX = 'CLUB';

function normalizeClubLabel(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isClubItemsLabel(label: string): boolean {
  const k = normalizeClubLabel(label);
  if (!k) return false;
  if (k === 'club items' || k === 'club item') return true;
  return k.includes('club') && k.includes('item');
}

/** True for legacy club RMs (CLUB SKU prefix or historical category / type labels). */
export function isClubItemsRawMaterial(
  rm: Pick<RawMaterialRecord, 'code' | 'category' | 'group' | 'rmType' | 'zohoSkuCode'>
): boolean {
  if (isClubItemsLabel(rm.rmType)) return true;
  if (isClubItemsLabel(rm.category) || isClubItemsLabel(rm.group ?? '')) return true;
  const code = String(rm.code ?? '').trim().toUpperCase();
  const sku = String(rm.zohoSkuCode ?? '').trim().toUpperCase();
  return code.startsWith(CLUB_SKU_PREFIX) || sku.startsWith(CLUB_SKU_PREFIX);
}
