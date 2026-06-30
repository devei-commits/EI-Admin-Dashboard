import type { WarehouseSih } from '../components/procurement/StockAuditPopup';
import type { WarehouseLocationDTO } from '../services/warehouseLocations.service';
import type { StockByLocationPayload } from '../services/warehouseInventory.service';

/** Build warehouse cards from DB location master (warehouse type only). */
export function buildStockAuditWarehousesFromLocations(
  locations: WarehouseLocationDTO[],
): WarehouseSih[] {
  return locations
    .filter((loc) => loc.locationType === 'warehouse')
    .map((loc) => ({
      code: loc.code,
      name: loc.name,
      sih: null,
      locations:
        loc.racks?.length > 0
          ? loc.racks.map((r) => r.code).join(', ')
          : '—',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Merge per-location stock quantities from warehouse inventory API. */
export function mergeStockByLocationIntoWarehouses(
  base: WarehouseSih[],
  stockByLocation: StockByLocationPayload | null | undefined,
): WarehouseSih[] {
  if (!stockByLocation?.warehouse?.length) return base;

  const byCode = new Map(base.map((w) => [w.code.toUpperCase(), { ...w }]));

  for (const wh of stockByLocation.warehouse) {
    const code = String(wh.locationCode ?? '').trim();
    if (!code) continue;
    const key = code.toUpperCase();
    const rackLabels =
      (wh.racks ?? [])
        .map((r) => `${r.rackCode}: ${Number(r.qtyWh ?? 0).toLocaleString('en-IN')}`)
        .join(' · ') || '—';
    const sih = Number(wh.totalQtyWh ?? 0) || (wh.racks ?? []).reduce((s, r) => s + (Number(r.qtyWh) || 0), 0);

    if (byCode.has(key)) {
      const row = byCode.get(key)!;
      row.sih = sih;
      row.locations = rackLabels;
    } else {
      byCode.set(key, {
        code,
        name: wh.locationName ?? code,
        sih,
        locations: rackLabels,
      });
    }
  }

  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}
