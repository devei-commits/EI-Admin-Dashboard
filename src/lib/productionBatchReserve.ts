import { isQtyShort, normalizeQtyForCompare } from '../utils/formatQty';

export interface ProductionReservedItemRow {
  id: number;
  productionBatchId: number;
  bmrNo: string | null;
  bprNo: string | null;
  soNo: string | null;
  productName: string | null;
  itemType: 'RM' | 'PM';
  code: string;
  name: string;
  quantityReserved: number;
  unit: string;
  updatedAt: string;
}

export interface BatchMaterialCoverageLine {
  code: string;
  materialId: number;
  required: number;
  reserved: number;
  unit: string;
  fullyReserved: boolean;
}

export interface BatchMaterialCoverage {
  lines: BatchMaterialCoverageLine[];
  fullyReserved: boolean;
  anyReserved: boolean;
}

export function batchHasReservedMaterial(
  batch: { _pk?: number; rmReserved?: boolean; pmReserved?: boolean },
  reservedItems: ProductionReservedItemRow[],
  kind: 'RM' | 'PM',
): boolean {
  if (kind === 'RM' && batch.rmReserved) return true;
  if (kind === 'PM' && batch.pmReserved) return true;
  const pk = batch._pk;
  if (!pk) return false;
  return reservedItems.some(
    (r) =>
      r.productionBatchId === pk &&
      r.itemType === kind &&
      (Number(r.quantityReserved) || 0) > 0,
  );
}

export function batchLineFullyReserved(
  required: number,
  reserved: number,
  kind: 'kg' | 'pcs',
): boolean {
  const req = normalizeQtyForCompare(required, kind);
  const res = normalizeQtyForCompare(reserved, kind);
  return !isQtyShort(res, req, kind);
}

export function batchItemsFullyReserved(
  items: Array<{ code: string; required: number }>,
  reservedByCode: Record<string, number>,
  kind: 'kg' | 'pcs',
): boolean {
  if (items.length === 0) return false;
  return items.every((it) => {
    const code = String(it.code ?? '').trim();
    if (!code) return false;
    return batchLineFullyReserved(
      it.required,
      Number(reservedByCode[code] ?? 0) || 0,
      kind,
    );
  });
}

export function coverageSummaryLabel(coverage: BatchMaterialCoverage | null | undefined): string {
  if (!coverage || coverage.lines.length === 0) return 'No BOM lines';
  const done = coverage.lines.filter((l) => l.fullyReserved).length;
  return `${done}/${coverage.lines.length} lines reserved`;
}
