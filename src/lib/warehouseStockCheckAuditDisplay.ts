import type { WarehouseLocationHistoryEntry } from '../services/warehouseInventory.service';
import type { StockByLocationPayload } from '../services/warehouseInventory.service';
import type { ParsedStockCheckNoteLine, ParsedStockCheckRackAudit } from './stockCheckNotes';
import { formatStockCheckTableDate } from './warehouseStockCheckTableDisplay';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const STALE_DAYS = 60;

export type WarehouseRackSystemRow = {
  key: string;
  rackLabel: string;
  rackId: number | null;
  locationCode: string;
  rackCode: string;
  packBreakdown: string;
  systemQty: number;
  unit: string;
  grnBatch: string;
  lastUpdated: string;
  lastUpdatedDisplay: string;
  isStale: boolean;
};

export type WarehouseRackAuditRow = WarehouseRackSystemRow & {
  auditedQty: number;
  notes: string;
  isNew?: boolean;
};

export type AuditProgressStep = {
  key: 'requested' | 'initiated' | 'completed';
  label: string;
  detail: string;
  status: 'done' | 'current' | 'pending';
};

export function resolveWarehouseDisplayName(warehouseCode: string): string {
  const code = String(warehouseCode ?? '').trim().toUpperCase();
  if (code === 'SW') return 'Secondary Warehouse';
  return 'Main Warehouse';
}

export function formatStockCheckAuditDate(raw: string | Date | null | undefined): string {
  const d = raw instanceof Date ? raw : new Date(String(raw ?? ''));
  if (Number.isNaN(d.getTime())) return '—';
  const month = MONTH_SHORT[d.getMonth()];
  return month ? `${d.getDate()}-${month}-${d.getFullYear()}` : '—';
}

export function formatStockCheckAuditDateTimeShort(raw: string | Date | null | undefined): string {
  const d = raw instanceof Date ? raw : new Date(String(raw ?? ''));
  if (Number.isNaN(d.getTime())) return '—';
  const month = MONTH_SHORT[d.getMonth()];
  if (!month) return '—';
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()}-${month} ${hours}:${minutes}`;
}

export function formatQtyWithUnit(qty: number, unit: string): string {
  const u = String(unit ?? '').trim() || 'kg';
  const n = Number.isFinite(qty) ? qty : 0;
  return `${n.toLocaleString('en-IN')} ${u}`;
}

export function formatRackVariance(systemQty: number, auditedQty: number): string {
  const variance = auditedQty - systemQty;
  if (Math.abs(variance) < 1e-6) return '0';
  return variance > 0 ? `+${variance}` : String(variance);
}

export function buildPackBreakdown(qty: number, unit: string): string {
  const u = String(unit ?? '').trim() || 'kg';
  const n = Number.isFinite(qty) ? qty : 0;
  if (n <= 0) return '—';
  return `1 lot × ${n} ${u}`;
}

export function buildRackLabel(warehouseCode: string, rackCode: string): string {
  const wh = String(warehouseCode ?? 'MW').trim().toUpperCase() || 'MW';
  const rack = String(rackCode ?? '').trim();
  if (!rack) return `${wh} · Rack —`;
  const normalized = /^rack[-\s]/i.test(rack) ? rack : `Rack-${rack}`;
  return `${wh} · ${normalized}`;
}

function parseIsoDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function findLatestHistoryForRack(
  history: WarehouseLocationHistoryEntry[],
  rackCode: string,
): WarehouseLocationHistoryEntry | null {
  const target = String(rackCode ?? '').trim().toLowerCase();
  if (!target) return null;
  let latest: WarehouseLocationHistoryEntry | null = null;
  let latestTs = 0;
  for (const entry of history) {
    const toRack = String(entry.toRack ?? '').trim().toLowerCase();
    const fromRack = String(entry.fromRack ?? '').trim().toLowerCase();
    if (toRack !== target && fromRack !== target) continue;
    const ts = parseIsoDate(entry.movedAt)?.getTime() ?? 0;
    if (ts >= latestTs) {
      latestTs = ts;
      latest = entry;
    }
  }
  return latest;
}

function isStaleDate(raw: string | null | undefined, now = new Date()): boolean {
  const d = parseIsoDate(raw);
  if (!d) return false;
  const diffMs = now.getTime() - d.getTime();
  return diffMs > STALE_DAYS * 24 * 60 * 60 * 1000;
}

export function buildRackSystemRows(
  stockByLocation: StockByLocationPayload | null,
  warehouseCode: string,
  unit: string,
  defaultBatch: string | null | undefined,
  history: WarehouseLocationHistoryEntry[],
): WarehouseRackSystemRow[] {
  if (!stockByLocation) return [];

  const rows: WarehouseRackSystemRow[] = [];
  for (const loc of stockByLocation.warehouse ?? []) {
    const locationCode = String(loc.locationCode ?? '').trim();
    for (const rack of loc.racks ?? []) {
      const qty = Number(rack.qtyWh) || 0;
      if (qty <= 0) continue;
      const rackCode = String(rack.rackCode ?? '').trim();
      const rackLabel = buildRackLabel(warehouseCode, rackCode ? `${locationCode}-${rackCode}` : locationCode);
      const latest = findLatestHistoryForRack(history, rackCode);
      const lastUpdated = latest?.movedAt ?? '';
      const grnBatch =
        String(latest?.batchNo ?? '').trim() ||
        String(defaultBatch ?? '').trim() ||
        '—';
      rows.push({
        key: `${loc.locationId}-${rack.rackId}`,
        rackLabel,
        rackId: rack.rackId ?? null,
        locationCode,
        rackCode,
        packBreakdown: buildPackBreakdown(qty, unit),
        systemQty: qty,
        unit,
        grnBatch,
        lastUpdated,
        lastUpdatedDisplay: lastUpdated ? formatStockCheckAuditDate(lastUpdated) : '—',
        isStale: isStaleDate(lastUpdated),
      });
    }
  }

  if (rows.length === 0 && (Number(stockByLocation.whStock) || 0) > 0) {
    const qty = Number(stockByLocation.whStock) || 0;
    rows.push({
      key: 'unallocated',
      rackLabel: `${warehouseCode} · Unallocated`,
      rackId: null,
      locationCode: '',
      rackCode: '',
      packBreakdown: buildPackBreakdown(qty, unit),
      systemQty: qty,
      unit,
      grnBatch: String(defaultBatch ?? '').trim() || '—',
      lastUpdated: '',
      lastUpdatedDisplay: '—',
      isStale: false,
    });
  }

  return rows.sort((a, b) => a.rackLabel.localeCompare(b.rackLabel));
}

export function mergeRackAuditDrafts(
  systemRows: WarehouseRackSystemRow[],
  existingLine: ParsedStockCheckNoteLine | null,
): WarehouseRackAuditRow[] {
  const rackAudits = existingLine?.rackAudits ?? [];
  const byLabel = new Map<string, ParsedStockCheckRackAudit>();
  for (const ra of rackAudits) {
    const label = String(ra.rackLabel ?? '').trim();
    if (label) byLabel.set(label.toLowerCase(), ra);
  }

  const merged: WarehouseRackAuditRow[] = systemRows.map((row) => {
    const saved = byLabel.get(row.rackLabel.toLowerCase());
    const auditedQty =
      saved?.physicalQty != null
        ? Number(saved.physicalQty)
        : existingLine?.physicalQty != null && systemRows.length === 1
          ? Number(existingLine.physicalQty)
          : row.systemQty;
    return {
      ...row,
      auditedQty: Number.isFinite(auditedQty) ? auditedQty : row.systemQty,
      notes: String(saved?.notes ?? existingLine?.remarks ?? ''),
    };
  });

  for (const saved of rackAudits) {
    const label = String(saved.rackLabel ?? '').trim();
    if (!label) continue;
    if (merged.some((r) => r.rackLabel.toLowerCase() === label.toLowerCase())) continue;
    const systemQty = Number(saved.systemQty) || 0;
    merged.push({
      key: `saved-${label}`,
      rackLabel: label,
      rackId: saved.rackId ?? null,
      locationCode: '',
      rackCode: '',
      packBreakdown: buildPackBreakdown(systemQty, 'kg'),
      systemQty,
      unit: 'kg',
      grnBatch: String(saved.grnBatch ?? '—'),
      lastUpdated: '',
      lastUpdatedDisplay: '—',
      isStale: false,
      auditedQty: Number(saved.physicalQty) || systemQty,
      notes: String(saved.notes ?? ''),
      isNew: Boolean(saved.isNew),
    });
  }

  return merged;
}

export function buildAuditProgressSteps(params: {
  requestedAt: string | null | undefined;
  assignee: string | null | undefined;
  initiatedAt: string | null | undefined;
  completedAt: string | null | undefined;
  isCompleted: boolean;
}): AuditProgressStep[] {
  const requestedDetail = params.requestedAt
    ? formatStockCheckTableDate(params.requestedAt)
    : '—';
  const assignee = String(params.assignee ?? '').trim();
  const initiatedDetail =
    assignee && (params.initiatedAt || params.requestedAt)
      ? `${formatStockCheckAuditDateTimeShort(params.initiatedAt ?? params.requestedAt)} by ${assignee}`
      : assignee
        ? `Assigned to ${assignee}`
        : '— pending';
  const completedDetail = params.isCompleted
    ? params.completedAt
      ? formatStockCheckAuditDateTimeShort(params.completedAt)
      : 'Completed'
    : '— pending';

  const hasInitiated = Boolean(assignee);
  const completedStatus: AuditProgressStep['status'] = params.isCompleted
    ? 'done'
    : hasInitiated
      ? 'current'
      : 'pending';
  const initiatedStatus: AuditProgressStep['status'] = params.isCompleted
    ? 'done'
    : hasInitiated
      ? 'done'
      : 'current';

  return [
    { key: 'requested', label: 'REQUESTED', detail: requestedDetail, status: 'done' },
    { key: 'initiated', label: 'AUDIT INITIATED', detail: initiatedDetail, status: initiatedStatus },
    { key: 'completed', label: 'AUDIT COMPLETED', detail: completedDetail, status: completedStatus },
  ];
}

export function buildAuditResultSummary(
  systemTotal: number,
  auditedTotal: number,
  unit: string,
): string {
  const variance = auditedTotal - systemTotal;
  const varianceLabel =
    Math.abs(variance) < 1e-6 ? '0' : variance > 0 ? `+${variance}` : String(variance);
  return `Total system ${formatQtyWithUnit(systemTotal, unit)} → Total audited ${formatQtyWithUnit(auditedTotal, unit)} · Net variance ${varianceLabel} ${unit}`;
}

export function formatItemCategory(
  itemType: 'RM' | 'PM' | 'FG',
  subtitle: string | null | undefined,
): string {
  const typeLabel = itemType === 'PM' ? 'PM' : itemType === 'FG' ? 'FG' : 'RM';
  const sub = String(subtitle ?? '').trim();
  return sub ? `${typeLabel} · ${sub}` : typeLabel;
}
