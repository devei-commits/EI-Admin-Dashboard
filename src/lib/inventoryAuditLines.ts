import {
  findStockCheckNoteForItem,
  hasStockCheckRequest,
  parseStockCheckNotes,
  parseStockCheckOutcome,
  type ParsedStockCheckNoteLine,
} from './stockCheckNotes';
import {
  buildInventoryAuditRef,
  computeInventoryAuditGap,
  formatInventoryAuditUiStatus,
  resolveInventoryAuditUiStatus,
} from './inventoryAuditGap';
import type { ProcurementRequest } from '../types/procurement.types';

export type InventoryAuditLine = {
  lineKey: string;
  auditRef: string;
  requestId: string;
  requestCode: string;
  requestStatus: string;
  stockCheckStatus: string;
  uiStatus: string;
  stockCheckAssignedTo: string;
  stockCheckDueDate: string;
  stockCheckOutcome: 'all_ok' | 'not_ok' | null;
  requestedAt: string;
  requestedBy: string;
  auditedAt: string;
  auditedBy: string;
  itemCode: string;
  itemName: string;
  requestedQty: number;
  unit: string;
  type: 'RM' | 'PM' | 'FG';
  location: string;
  systemQty: number | null;
  physicalQty: number | null;
  updatedStockQty: number | null;
  consumptionQty: number | null;
  gapQty: number;
  gapApproved: boolean;
  gapApprovedAt: string;
  gapApprovedBy: string;
  remarks: string;
  planningSoNumber: string;
  planningProductName: string;
  raw_material_id?: number;
  pack_material_id?: number;
};

function parseQty(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function enrichNote(note: ParsedStockCheckNoteLine | null): {
  systemQty: number | null;
  physicalQty: number | null;
  updatedStockQty: number | null;
  consumptionQty: number | null;
  gapQty: number;
  location: string;
  remarks: string;
  gapApproved: boolean;
  gapApprovedAt: string;
  gapApprovedBy: string;
} {
  if (!note) {
    return {
      systemQty: null,
      physicalQty: null,
      updatedStockQty: null,
      consumptionQty: null,
      gapQty: 0,
      location: 'MAIN',
      remarks: '',
      gapApproved: false,
      gapApprovedAt: '',
      gapApprovedBy: '',
    };
  }
  const systemQty = parseQty(note.systemQty);
  const physicalQty = parseQty(note.physicalQty);
  const consumptionQty = parseQty(note.consumptionQty ?? 0);
  const gapQty =
    note.gapQty != null && Number.isFinite(Number(note.gapQty))
      ? Number(note.gapQty)
      : computeInventoryAuditGap(
          systemQty ?? 0,
          physicalQty ?? 0,
          consumptionQty ?? 0
        );
  const location =
    String(note.location ?? note.zone ?? '').trim() || 'MAIN';
  return {
    systemQty,
    physicalQty,
    updatedStockQty: parseQty(note.updatedStockQty),
    consumptionQty,
    gapQty,
    location,
    remarks: String(note.remarks ?? '').trim(),
    gapApproved: note.gapApproved === true,
    gapApprovedAt: String(note.gapApprovedAt ?? '').trim(),
    gapApprovedBy: String(note.gapApprovedBy ?? '').trim(),
  };
}

export function buildInventoryAuditLines(requests: ProcurementRequest[]): InventoryAuditLine[] {
  const lines: InventoryAuditLine[] = [];

  for (const req of requests) {
    if (!hasStockCheckRequest(req.stockCheckStatus)) continue;

    const notesRoot = parseStockCheckNotes(req.stockCheckNotes);
    const outcome = parseStockCheckOutcome(req.stockCheckNotes);
    const assignedTo = String(req.stockCheckAssignedTo ?? '').trim() || '—';
    const dueDate = String(req.stockCheckDueDate ?? req.dueDate ?? '').trim().slice(0, 10);
    const stockStatus = String(req.stockCheckStatus ?? '').trim() || 'Pending';
    const so = String(req.planningSoNumber ?? '').trim();
    const product = String(req.planningProductName ?? req.planningProductCode ?? '').trim();
    const requestedAt = String(notesRoot?.requestedAt ?? req.createdDate ?? '').trim().slice(0, 10);
    const requestedBy =
      String(notesRoot?.requestedBy ?? req.requestedBy ?? 'Procurement').trim() || 'Procurement';
    const auditedAt = String(notesRoot?.updatedAt ?? '').trim().slice(0, 10);
    const auditedBy = String(notesRoot?.updatedBy ?? req.stockCheckAssignedTo ?? 'Warehouse').trim();
    const auditRef = buildInventoryAuditRef(req.code);

    const pushLine = (
      itemCode: string,
      itemName: string,
      requestedQty: number,
      unit: string,
      type: 'RM' | 'PM' | 'FG',
      raw_material_id?: number,
      pack_material_id?: number,
      lineIndex = 0
    ): void => {
      const note = findStockCheckNoteForItem(req.stockCheckNotes, itemCode, itemName);
      const enriched = enrichNote(note);
      const uiStatus = resolveInventoryAuditUiStatus({
        stockCheckStatus: stockStatus,
        gapQty: enriched.gapQty,
        gapApproved: enriched.gapApproved,
      });
      lines.push({
        lineKey: `${req.id}|${itemCode}|${lineIndex}`,
        auditRef,
        requestId: req.id,
        requestCode: req.code,
        requestStatus: req.status,
        stockCheckStatus: stockStatus,
        uiStatus: formatInventoryAuditUiStatus(uiStatus),
        stockCheckAssignedTo: assignedTo,
        stockCheckDueDate: dueDate,
        stockCheckOutcome: outcome,
        requestedAt,
        requestedBy,
        auditedAt,
        auditedBy,
        itemCode,
        itemName,
        requestedQty,
        unit,
        type,
        location: enriched.location,
        systemQty: enriched.systemQty,
        physicalQty: enriched.physicalQty,
        updatedStockQty: enriched.updatedStockQty,
        consumptionQty: enriched.consumptionQty,
        gapQty: enriched.gapQty,
        gapApproved: enriched.gapApproved,
        gapApprovedAt: enriched.gapApprovedAt,
        gapApprovedBy: enriched.gapApprovedBy,
        remarks: enriched.remarks,
        planningSoNumber: so,
        planningProductName: product,
        ...(raw_material_id != null ? { raw_material_id } : {}),
        ...(pack_material_id != null ? { pack_material_id } : {}),
      });
    };

    const details = req.itemDetails ?? [];
    if (details.length > 0) {
      details.forEach((d, idx) => {
        pushLine(
          d.itemCode ?? '',
          d.itemName ?? '',
          Number(d.reqQty ?? 0) || 0,
          d.unit ?? '',
          d.type === 'PM' ? 'PM' : d.type === 'FG' ? 'FG' : 'RM',
          d.raw_material_id,
          d.pack_material_id,
          idx
        );
      });
      continue;
    }

    const names = req.items ?? [];
    const qtys = req.quantities ?? [];
    const units = req.units ?? [];
    names.forEach((name, idx) => {
      const itemName = String(name ?? '').trim();
      if (!itemName) return;
      const generatedCode = `EI-${req.type}-${itemName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || String(idx + 1).padStart(3, '0')}`;
      pushLine(
        generatedCode,
        itemName,
        Number(qtys[idx] ?? 0) || 0,
        String(units[idx] ?? ''),
        req.type,
        undefined,
        undefined,
        idx
      );
    });
  }

  return lines.sort((a, b) => {
    const reqCmp = a.requestCode.localeCompare(b.requestCode, 'en');
    if (reqCmp !== 0) return reqCmp;
    return a.itemName.localeCompare(b.itemName, 'en', { sensitivity: 'base' });
  });
}

export function countStockCheckRequests(requests: ProcurementRequest[]): number {
  return requests.filter((r) => hasStockCheckRequest(r.stockCheckStatus)).length;
}
