import type { WarehouseItemType } from '../services/warehouseInventory.service';

/** null = all WH zones allowed for every item type (matches backend). */
export function allowedWarehouseLocationCodes(_type: WarehouseItemType | string): string[] | null {
  return null;
}

export function warehouseStoreLabelForItemType(_type: WarehouseItemType | string): string {
  return 'Warehouse zones';
}
