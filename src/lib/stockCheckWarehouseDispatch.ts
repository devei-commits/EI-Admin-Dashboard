import type { ProcurementRequest } from '../types/procurement.types';

export type StockCheckWarehouseDispatchPayload = {
  stockCheckAssignedTo: string | null;
  stockCheckStatus: 'Pending';
  stockCheckDueDate: string | null;
  stockCheckNotes: string;
};

export function resolveStockCheckTargetDate(
  req: Pick<ProcurementRequest, 'stockCheckDueDate' | 'dueDate'>,
): string | null {
  const raw = String(req.stockCheckDueDate ?? req.dueDate ?? '').trim().slice(0, 10);
  return raw || null;
}

export function buildStockCheckWarehouseDispatchPayload(
  req: Pick<
    ProcurementRequest,
    'stockCheckAssignedTo' | 'stockCheckNotes' | 'requestedBy' | 'dueDate' | 'stockCheckDueDate'
  >,
): StockCheckWarehouseDispatchPayload {
  const existingNotes = req.stockCheckNotes != null ? String(req.stockCheckNotes).trim() : '';
  return {
    stockCheckAssignedTo: String(req.stockCheckAssignedTo ?? '').trim() || null,
    stockCheckStatus: 'Pending',
    stockCheckDueDate: resolveStockCheckTargetDate(req),
    stockCheckNotes:
      existingNotes ||
      JSON.stringify({
        version: 1,
        requestedAt: new Date().toISOString(),
        requestedBy: req.requestedBy ?? 'Procurement Team',
      }),
  };
}

export function isOpenStockCheckStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s === 'pending' || s === 'requested' || s === 'in progress';
}
