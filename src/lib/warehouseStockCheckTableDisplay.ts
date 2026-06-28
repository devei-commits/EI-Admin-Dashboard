import { buildInventoryAuditLines, type InventoryAuditLine } from './inventoryAuditLines';
import type { ProcurementRequest, RequestPriority } from '../types/procurement.types';
import { getDaysLeft } from '../utils/orderFulfillmentUtils';
import { parseDateStringToLocalDate } from '../pages/procurement/procurementDataMappers';

export type WarehouseStockCheckSlaTone = 'ok' | 'warn' | 'bad' | 'neutral';

export type WarehouseStockCheckTableRow = {
  lineKey: string;
  requestId: string;
  reqDate: string;
  reqDateDisplay: string;
  auditRef: string;
  warehouse: string;
  itemName: string;
  itemCode: string;
  itemType: 'RM' | 'PM' | 'FG';
  sourceDept: string;
  priority: RequestPriority;
  priorityDisplay: string;
  priorityClass: string;
  assignedTo: string;
  assignDisplay: string;
  targetDate: string;
  targetDateDisplay: string;
  slaDays: number | null;
  slaIcon: string;
  slaLabel: string;
  slaTone: WarehouseStockCheckSlaTone;
  stockCheckStatus: string;
  isCompleted: boolean;
  actionLabel: string;
  auditedAt: string;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const PRIORITY_CLASS: Record<RequestPriority, string> = {
  High: 'text-rose-700 font-bold',
  Medium: 'text-amber-700 font-semibold',
  Low: 'text-slate-600 font-medium',
};

function normalizePriority(raw: string | undefined | null): RequestPriority {
  const p = String(raw ?? '').trim();
  if (p === 'High' || p === 'Low') return p;
  return 'Medium';
}

export function formatStockCheckTableDate(raw: string | Date | null | undefined): string {
  const d = raw instanceof Date ? raw : parseDateStringToLocalDate(String(raw ?? ''));
  if (!d) return '—';
  const month = MONTH_SHORT[d.getMonth()];
  return month ? `${d.getDate()}-${month}` : '—';
}

export function buildWarehouseStockCheckAuditRef(requestId: string, year = new Date().getFullYear()): string {
  const seq = String(requestId ?? '').replace(/\D/g, '').padStart(4, '0') || '0000';
  return `AUD-${year}-${seq}`;
}

export function resolveWarehouseCode(
  location: string,
  itemCode: string,
  itemType: 'RM' | 'PM' | 'FG',
): string {
  const code = String(itemCode ?? '').trim().toUpperCase();
  if (/^5L/.test(code) || /^5S/.test(code)) return 'SW';
  if (itemType === 'PM' && /label|sticker|carton|mono/i.test(code)) return 'SW';

  const loc = String(location ?? '').trim().toUpperCase();
  if (loc === 'SW' || loc === 'MW') return loc;
  const lower = loc.toLowerCase();
  if (lower.includes('secondary') || lower.includes('label') || lower.includes('spm')) return 'SW';
  if (lower.includes('main') || lower.includes('rm') || lower.includes('raw')) return 'MW';
  return 'MW';
}

export function resolveStockCheckSourceDept(
  req: Pick<ProcurementRequest, 'batchId' | 'planningSoNumber' | 'requestedBy' | 'source'>,
): string {
  const explicit = String(req.source ?? '').trim();
  if (explicit) return explicit;
  const by = String(req.requestedBy ?? '').trim().toLowerCase();
  if (by.includes('treasury')) return 'Treasury';
  if (by.includes('warehouse') || by.includes('wh lead') || by.includes('wh team')) {
    return 'Self · WH lead';
  }
  if (by.includes('production') || by.includes('manufacturing')) return 'Production';
  if (by.includes('planning')) return 'Planning';
  if (req.batchId || (req.planningSoNumber != null && String(req.planningSoNumber).trim())) {
    return 'Production';
  }
  return 'Procurement';
}

export function formatAssigneeShortName(name: string): string {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return 'Open';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0] ?? 'Open';
  const first = parts[0] ?? '';
  const lastInitial = (parts[parts.length - 1] ?? '').charAt(0).toUpperCase();
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

function isCompletedStockCheck(status: string): boolean {
  return String(status ?? '').trim().toLowerCase() === 'completed';
}

function buildOpenSlaView(
  targetDate: string,
  priority: RequestPriority,
): Pick<WarehouseStockCheckTableRow, 'slaDays' | 'slaIcon' | 'slaLabel' | 'slaTone'> {
  const daysLeft = targetDate ? getDaysLeft(targetDate) : null;
  if (daysLeft === null) {
    return { slaDays: null, slaIcon: '', slaLabel: '—', slaTone: 'neutral' };
  }
  const days = Math.max(0, daysLeft);
  const label = `${days}d open`;
  if (priority === 'High' || daysLeft < 0 || daysLeft <= 1) {
    return { slaDays: daysLeft, slaIcon: '🚩', slaLabel: label, slaTone: 'bad' };
  }
  if (priority === 'Medium' || daysLeft <= 3) {
    return { slaDays: daysLeft, slaIcon: '⚠', slaLabel: label, slaTone: 'warn' };
  }
  return { slaDays: daysLeft, slaIcon: '✓', slaLabel: label, slaTone: 'ok' };
}

function buildClosedSlaView(
  auditedAt: string,
): Pick<WarehouseStockCheckTableRow, 'slaDays' | 'slaIcon' | 'slaLabel' | 'slaTone'> {
  const closedDate = formatStockCheckTableDate(auditedAt);
  return {
    slaDays: null,
    slaIcon: '✓',
    slaLabel: closedDate === '—' ? 'closed' : `closed ${closedDate}`,
    slaTone: 'neutral',
  };
}

export function warehouseStockCheckSlaClass(tone: WarehouseStockCheckSlaTone): string {
  switch (tone) {
    case 'bad':
      return 'text-red-700';
    case 'warn':
      return 'text-amber-700';
    case 'ok':
      return 'text-emerald-700';
    default:
      return 'text-slate-600';
  }
}

function lineToRow(
  line: InventoryAuditLine,
  req: ProcurementRequest | undefined,
  inventoryZoneByItemCode?: Map<string, string>,
): WarehouseStockCheckTableRow {
  const priority = normalizePriority(req?.priority);
  const targetDate = line.stockCheckDueDate;
  const completed = isCompletedStockCheck(line.stockCheckStatus);
  const sla = completed
    ? buildClosedSlaView(line.auditedAt)
    : buildOpenSlaView(targetDate, priority);
  const assignedTo = line.stockCheckAssignedTo.trim() === '—' ? '' : line.stockCheckAssignedTo.trim();
  const requestId = line.requestId;
  const inventoryZone =
    inventoryZoneByItemCode?.get(String(line.itemCode ?? '').trim().toLowerCase()) ?? '';

  return {
    lineKey: line.lineKey,
    requestId,
    reqDate: line.requestedAt,
    reqDateDisplay: formatStockCheckTableDate(line.requestedAt),
    auditRef: buildWarehouseStockCheckAuditRef(requestId),
    warehouse: resolveWarehouseCode(inventoryZone || line.location, line.itemCode, line.type),
    itemName: line.itemName,
    itemCode: line.itemCode,
    itemType: line.type,
    sourceDept: req ? resolveStockCheckSourceDept(req) : line.requestedBy || 'Procurement',
    priority,
    priorityDisplay: priority.toUpperCase(),
    priorityClass: PRIORITY_CLASS[priority],
    assignedTo,
    assignDisplay: formatAssigneeShortName(assignedTo),
    targetDate,
    targetDateDisplay: formatStockCheckTableDate(targetDate),
    ...sla,
    stockCheckStatus: line.stockCheckStatus || 'Pending',
    isCompleted: completed,
    actionLabel: completed ? 'View' : '🔍 Audit',
    auditedAt: line.auditedAt,
  };
}

function stockCheckStatusRank(status: string): number {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'pending' || s === 'requested') return 0;
  if (s === 'in progress') return 1;
  if (s === 'completed') return 2;
  return 1;
}

export function buildWarehouseStockCheckTableRows(
  requests: ProcurementRequest[],
  inventoryZoneByItemCode?: Map<string, string>,
): WarehouseStockCheckTableRow[] {
  const byId = new Map(requests.map((r) => [r.id, r]));
  const lines = buildInventoryAuditLines(requests);
  return lines
    .map((line) => lineToRow(line, byId.get(line.requestId), inventoryZoneByItemCode))
    .sort((a, b) => {
      const statusCmp = stockCheckStatusRank(a.stockCheckStatus) - stockCheckStatusRank(b.stockCheckStatus);
      if (statusCmp !== 0) return statusCmp;
      const dateCmp = b.reqDate.localeCompare(a.reqDate);
      if (dateCmp !== 0) return dateCmp;
      return b.auditRef.localeCompare(a.auditRef);
    });
}
