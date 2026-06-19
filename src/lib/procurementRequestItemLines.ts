import type { ProcurementRequest, RequestPriority, RequestStatus } from '../types/procurement.types';

export type ProcurementRequestItemLine = {
  lineKey: string;
  lineIndex: number;
  requestId: string;
  requestCode: string;
  batchId: string | null;
  status: RequestStatus;
  priority: RequestPriority;
  requestType: 'RM' | 'PM';
  /** Set only when preferred vendor is explicitly chosen on the PR. */
  preferredVendor: string | null;
  dueDate: string;
  notes: string | null;
  stockCheckStatus: string | null;
  stockCheckNotes: string | null;
  planningSoNumber: string | null;
  planningCustomerName: string | null;
  planningProductName: string | null;
  planningProductCode: string | null;
  itemCode: string;
  itemName: string;
  reqQty: number;
  unit: string;
  moq: string;
  packSize: string;
  plannedPrice: number;
  expectedDate: string;
  estValue: number;
  leadTimeDays?: number;
  type: 'RM' | 'PM' | 'FG';
  raw_material_id?: number;
  pack_material_id?: number;
};

function compareItemLines(a: ProcurementRequestItemLine, b: ProcurementRequestItemLine): number {
  const dateA = String(a.expectedDate || a.dueDate || '').trim();
  const dateB = String(b.expectedDate || b.dueDate || '').trim();
  if (dateA && dateB && dateA !== dateB) return dateA.localeCompare(dateB);
  if (dateA && !dateB) return -1;
  if (!dateA && dateB) return 1;
  const reqCmp = a.requestCode.localeCompare(b.requestCode, 'en');
  if (reqCmp !== 0) return reqCmp;
  return a.itemName.localeCompare(b.itemName, 'en', { sensitivity: 'base' });
}

/** Flatten procurement requests into one row per item line (no vendor grouping). */
export function buildProcurementRequestItemLines(
  requests: ProcurementRequest[]
): ProcurementRequestItemLine[] {
  const lines: ProcurementRequestItemLine[] = [];

  for (const req of requests) {
    const preferredVendor = String(req.preferredVendor ?? '').trim() || null;
    const batchId =
      req.batchId != null && String(req.batchId).trim() !== '' ? String(req.batchId) : null;
    const base = {
      requestId: req.id,
      requestCode: req.code,
      batchId,
      status: req.status,
      priority: req.priority,
      requestType: req.type,
      preferredVendor,
      dueDate: String(req.dueDate ?? '').trim().slice(0, 10),
      notes: req.notes ?? null,
      stockCheckStatus: req.stockCheckStatus ?? null,
      stockCheckNotes: req.stockCheckNotes ?? null,
      planningSoNumber: req.planningSoNumber ?? null,
      planningCustomerName: req.planningCustomerName ?? null,
      planningProductName: req.planningProductName ?? null,
      planningProductCode: req.planningProductCode ?? null,
    };

    const details = req.itemDetails ?? [];
    if (details.length === 0) {
      const names = req.items ?? [];
      const qtys = req.quantities ?? [];
      const prices = req.plannedPrices ?? [];
      const units = req.units ?? [];
      names.forEach((name, idx) => {
        const itemName = String(name ?? '').trim();
        if (!itemName) return;
        const reqQty = Number(qtys[idx] ?? 0) || 0;
        const plannedPrice = Number(prices[idx] ?? 0) || 0;
        lines.push({
          ...base,
          lineKey: `${req.id}|${idx}|${itemName}`,
          lineIndex: idx,
          itemCode: '',
          itemName,
          reqQty,
          unit: String(units[idx] ?? ''),
          moq: '',
          packSize: '',
          plannedPrice,
          expectedDate: base.dueDate,
          estValue: reqQty * plannedPrice,
          type: req.type,
        });
      });
      continue;
    }

    details.forEach((d, idx) => {
      const reqQty = Number(d.reqQty ?? 0) || 0;
      const plannedPrice = Number(d.plannedPrice ?? 0) || 0;
      lines.push({
        ...base,
        lineKey: `${req.id}|${idx}|${d.itemCode ?? d.itemName ?? idx}`,
        lineIndex: idx,
        itemCode: d.itemCode ?? '',
        itemName: d.itemName ?? '',
        reqQty,
        unit: d.unit ?? '',
        moq: d.moq ?? '',
        packSize: d.packSize ?? '',
        plannedPrice,
        expectedDate: String(d.expectedDate || base.dueDate || '').trim().slice(0, 10),
        estValue: Number(d.estValue ?? 0) || reqQty * plannedPrice,
        leadTimeDays: d.leadTimeDays,
        type: d.type === 'PM' ? 'PM' : d.type === 'FG' ? 'FG' : 'RM',
        ...(d.raw_material_id != null ? { raw_material_id: d.raw_material_id } : {}),
        ...(d.pack_material_id != null ? { pack_material_id: d.pack_material_id } : {}),
      });
    });
  }

  return lines.sort(compareItemLines);
}
