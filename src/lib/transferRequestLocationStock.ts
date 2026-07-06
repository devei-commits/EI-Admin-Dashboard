import type { FacilityAreaDTO } from '../services/facilityAreas.service';
import type { WarehouseInventoryRow } from '../services/warehouseInventory.service';

export type TransferSourceType = 'Production' | 'Warehouse' | 'Internal';

export type TransferZoneOption = {
  code: string;
  shortLabel: string;
  fullLabel: string;
  areaType: 'warehouse' | 'production';
};

export function flattenTransferZoneOptions(
  warehouseAreas: FacilityAreaDTO[],
  productionAreas: FacilityAreaDTO[],
): TransferZoneOption[] {
  const options: TransferZoneOption[] = [];
  const appendAreas = (areas: FacilityAreaDTO[]): void => {
    for (const area of areas) {
      for (const zone of area.zones || []) {
        const zoneLabel = String(zone.zoneLabel ?? '').trim();
        const shortLabel =
          zoneLabel ||
          (area.areaType === 'warehouse' ? 'MW' : zone.code.replace(/^LOC-/i, ''));
        options.push({
          code: zone.code,
          shortLabel,
          fullLabel: `${area.name} — ${zone.name}`,
          areaType: area.areaType,
        });
      }
    }
  };
  appendAreas(warehouseAreas);
  appendAreas(productionAreas);
  return options;
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
