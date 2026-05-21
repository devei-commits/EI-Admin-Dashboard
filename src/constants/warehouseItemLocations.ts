import type { WarehouseItemType } from '../services/warehouseInventory.service';

/** Allowed WH zone codes per inventory item type (matches backend warehouseLocationByItemType.js). */
export function allowedWarehouseLocationCodes(type: WarehouseItemType | string): string[] | null {
  const t = String(type || '').trim().toUpperCase();
  if (t === 'RM') return ['LOC-RM'];
  if (t === 'PM') return ['LOC-PM'];
  if (t === 'FG/PR' || t === 'PR' || t === 'FG') return ['LOC-FG'];
  return null;
}

export function warehouseStoreLabelForItemType(type: WarehouseItemType | string): string {
  const t = String(type || '').trim().toUpperCase();
  if (t === 'RM') return 'RM Store (LOC-RM)';
  if (t === 'PM') return 'Packaging / PM Store (LOC-PM)';
  if (t === 'FG/PR' || t === 'PR' || t === 'FG') return 'Finished goods store (LOC-FG)';
  return 'Warehouse';
}
