import type { FacilityAreaDTO } from '../services/facilityAreas.service';
import type { WarehouseInventoryRow } from '../services/warehouseInventory.service';

export type TransferSourceType = 'Production' | 'Warehouse' | 'Internal';

export type TransferFacility = 'warehouse' | 'ml1' | 'ml2';

export type TransferLocationOption = {
  /** Representative real zone code for the facility (drives stock lookup + downstream
   *  MU matching). Falls back to a canonical code (MW/ML1/ML2) when no zone exists. */
  code: string;
  facility: TransferFacility;
  /** Facility-level label shown in the dropdown — "Warehouse" / "ML1" / "ML2". */
  label: string;
  areaType: 'warehouse' | 'production';
};

function classifyTransferFacility(
  zoneCode: string,
  areaType: 'warehouse' | 'production',
): TransferFacility {
  if (areaType === 'warehouse') return 'warehouse';
  return zoneCode.toUpperCase().includes('ML2') ? 'ml2' : 'ml1';
}

/**
 * Transfers move stock between three facilities — Warehouse, ML1, ML2 — because that is
 * the only granularity the inventory model tracks (whStock / ml1Stock / ml2Stock). We
 * collapse every configured zone into its facility bucket and expose one option each.
 * The representative `code` is a real zone code (so the receive flow can pre-resolve the
 * MU area/zone), falling back to a canonical code when a facility has no zones yet.
 */
export function buildTransferLocationOptions(
  warehouseAreas: FacilityAreaDTO[],
  productionAreas: FacilityAreaDTO[],
): TransferLocationOption[] {
  const byFacility = new Map<TransferFacility, TransferLocationOption>();
  const labels: Record<TransferFacility, string> = {
    warehouse: 'Warehouse',
    ml1: 'ML1',
    ml2: 'ML2',
  };
  const areaTypeFor: Record<TransferFacility, 'warehouse' | 'production'> = {
    warehouse: 'warehouse',
    ml1: 'production',
    ml2: 'production',
  };
  const scan = (areas: FacilityAreaDTO[], areaType: 'warehouse' | 'production'): void => {
    for (const area of areas) {
      for (const zone of area.zones || []) {
        const facility = classifyTransferFacility(zone.code, areaType);
        if (byFacility.has(facility)) continue; // first zone is the representative
        byFacility.set(facility, {
          code: zone.code,
          facility,
          label: labels[facility],
          areaType,
        });
      }
    }
  };
  scan(warehouseAreas, 'warehouse');
  scan(productionAreas, 'production');

  // Guarantee the three canonical buckets even when a facility has no zones configured.
  const canonicalCode: Record<TransferFacility, string> = { warehouse: 'MW', ml1: 'ML1', ml2: 'ML2' };
  const order: TransferFacility[] = ['warehouse', 'ml1', 'ml2'];
  return order.map(
    (facility) =>
      byFacility.get(facility) ?? {
        code: canonicalCode[facility],
        facility,
        label: labels[facility],
        areaType: areaTypeFor[facility],
      },
  );
}

export function sihAtZoneForInventoryRow(
  row: Pick<WarehouseInventoryRow, 'whStock' | 'ml1Stock' | 'ml2Stock'>,
  zoneCode: string,
): number {
  const normalized = zoneCode.toUpperCase();
  if (normalized.includes('ML2')) return Number(row.ml2Stock) || 0;
  if (normalized.includes('ML1')) return Number(row.ml1Stock) || 0;
  return Number(row.whStock) || 0;
}

export function formatTransferQty(value: number, unit: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const u = String(unit || '').trim();
  return u ? `${n.toLocaleString('en-IN')} ${u}` : n.toLocaleString('en-IN');
}

export function defaultRequiredByDate(daysAhead = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}
