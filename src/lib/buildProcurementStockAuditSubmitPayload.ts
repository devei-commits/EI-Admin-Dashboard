import type { StockAuditPayload, WarehouseSih } from '../components/procurement/StockAuditPopup';
import type { ProcurementRequest } from '../types/procurement.types';
import type { StockCheckWarehouseDispatchPayload } from './stockCheckWarehouseDispatch';

export function buildProcurementStockAuditSubmitPayload(
  req: ProcurementRequest,
  payload: StockAuditPayload,
  warehouses: WarehouseSih[],
  requestedBy: string,
): StockCheckWarehouseDispatchPayload {
  const item = req.itemDetails?.[0] ?? null;
  const itemCode = String(item?.itemCode ?? '').trim();
  const itemName = String(item?.itemName ?? req.items?.[0] ?? '').trim();
  const whByCode = new Map(warehouses.map((w) => [w.code.toUpperCase(), w]));

  const lines = payload.warehouseCodes.map((code) => {
    const wh = whByCode.get(code.toUpperCase());
    return {
      itemCode,
      itemName,
      location: code,
      zone: code,
      systemQtyAtRequest: wh?.sih != null ? wh.sih : undefined,
      remarks: payload.comments.trim() || undefined,
    };
  });

  const stockCheckNotes = JSON.stringify({
    version: 1,
    requestedAt: new Date().toISOString(),
    requestedBy: requestedBy.trim() || 'Procurement Team',
    targetDate: payload.targetDate,
    warehouseCodes: payload.warehouseCodes,
    comments: payload.comments.trim() || undefined,
    lines: lines.length > 0 ? lines : itemCode || itemName
      ? [{
          itemCode,
          itemName,
          location: payload.warehouseCodes[0] ?? 'MAIN',
          zone: payload.warehouseCodes[0] ?? 'MAIN',
          systemQtyAtRequest: req.stockSummary?.stockInHand ?? undefined,
          remarks: payload.comments.trim() || undefined,
        }]
      : [],
  });

  return {
    stockCheckAssignedTo: null,
    stockCheckStatus: 'Pending',
    stockCheckDueDate: payload.targetDate,
    stockCheckNotes,
  };
}
