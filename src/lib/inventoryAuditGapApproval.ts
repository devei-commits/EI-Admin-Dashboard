import type { ProcurementRequestItem } from '../services/procurement.service';
import {
  findStockCheckNoteForItem,
  parseStockCheckNotes,
  type ParsedStockCheckNoteLine,
  type ParsedStockCheckNotes,
} from './stockCheckNotes';
import { computeInventoryAuditGap } from './inventoryAuditGap';
import type { Order } from '../types/salesPurchase.types';

function parseQty(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function itemLineMatches(
  code: string | undefined,
  name: string | undefined,
  itemCode: string,
  itemName: string
): boolean {
  const c = String(code ?? '').trim().toLowerCase();
  const n = String(name ?? '').trim().toLowerCase();
  const wantC = itemCode.trim().toLowerCase();
  const wantN = itemName.trim().toLowerCase();
  if (wantC && c && c === wantC) return true;
  if (wantN && n && n === wantN) return true;
  return false;
}

function enrichNoteLine(note: ParsedStockCheckNoteLine): ParsedStockCheckNoteLine {
  const systemQty = parseQty(note.systemQty);
  const physicalQty = parseQty(note.physicalQty);
  const consumptionQty = parseQty(note.consumptionQty);
  const gapQty =
    note.gapQty != null && Number.isFinite(Number(note.gapQty))
      ? Number(note.gapQty)
      : computeInventoryAuditGap(systemQty, physicalQty, consumptionQty);
  return { ...note, systemQty, physicalQty, consumptionQty, gapQty };
}

export function mergeGapApprovalIntoStockCheckNotes(
  rawNotes: string | null | undefined,
  itemCode: string,
  itemName: string,
  gapQty: number,
  approvedBy: string
): string {
  const parsed: ParsedStockCheckNotes = parseStockCheckNotes(rawNotes) ?? { version: 1, lines: [] };
  const lines = Array.isArray(parsed.lines) ? [...parsed.lines] : [];
  const idx = lines.findIndex((ln) =>
    itemLineMatches(ln.itemCode, ln.itemName, itemCode, itemName)
  );
  const now = new Date().toISOString();
  const patch: ParsedStockCheckNoteLine = enrichNoteLine(
    idx >= 0
      ? { ...lines[idx] }
      : findStockCheckNoteForItem(rawNotes, itemCode, itemName) ?? { itemCode, itemName }
  );
  patch.gapApproved = true;
  patch.gapApprovedAt = now;
  patch.gapApprovedBy = approvedBy;
  patch.gapAppliedQty = gapQty;
  if (idx >= 0) lines[idx] = patch;
  else lines.push(patch);

  return JSON.stringify({
    ...parsed,
    lines,
    gapApprovalAt: now,
    gapApprovalBy: approvedBy,
  });
}

export function bumpProcurementRequestItemQty(
  items: ProcurementRequestItem[],
  itemCode: string,
  itemName: string,
  delta: number
): ProcurementRequestItem[] {
  if (!(delta > 0)) return items;
  return items.map((line) => {
    if (!itemLineMatches(line.code, line.name, itemCode, itemName)) return line;
    const qOld = parseQty(line.quantity_requested);
    const qNew = Math.round((qOld + delta) * 1000) / 1000;
    return {
      ...line,
      quantity_requested: qNew,
      required: parseQty(line.required) + delta,
      shortage: parseQty(line.shortage) + delta,
    };
  });
}

export function bumpPurchaseOrderItemsQty(
  items: Order['items'],
  itemCode: string,
  itemName: string,
  delta: number
): Order['items'] {
  if (!(delta > 0)) return items;
  return items.map((raw) => {
    const row = raw as {
      itemCode?: string;
      code?: string;
      itemName?: string;
      name?: string;
      quantity?: number | string;
      qty?: number | string;
    };
    const code = String(row.itemCode ?? row.code ?? '');
    const name = String(row.itemName ?? row.name ?? '');
    if (!itemLineMatches(code, name, itemCode, itemName)) return raw;
    const qOld = parseQty(row.quantity ?? row.qty);
    const qNew = Math.round((qOld + delta) * 1000) / 1000;
    return { ...raw, quantity: qNew, qty: String(qNew) };
  });
}

export function findDraftPurchaseOrderForRequest(
  purchaseOrders: Order[],
  requestId: string
): Order | null {
  const want = String(requestId).trim();
  if (!want) return null;
  return (
    purchaseOrders.find((po) => {
      if (po.type !== 'PO') return false;
      if (String(po.status ?? '').trim() !== 'Draft') return false;
      const fd = po.formData ?? {};
      const poReq = String(fd.requestId ?? fd.request_id ?? '').trim();
      return poReq === want;
    }) ?? null
  );
}
