import type { GRNRecordFromApi } from '../services/grn.service';
import type { PriceListItemPage } from '../services/itemsList.service';
import type { ProcurementRequest } from '../services/procurement.service';
import type { RawMaterialRecord } from '../services/rawMaterials.service';
import type { PackMaterialRecord } from '../services/packMaterials.service';
import type { Order } from '../types/salesPurchase.types';

export type PlanBatchMaterialStatus = 'AVAILABLE' | 'SHORTAGE' | 'UNDER PROCUREMENT';

export interface ActualLeadTimeStats {
  avgDays: number;
  sampleCount: number;
  subLabel: string;
  trendLabel: string | null;
}

interface LeadSample {
  days: number;
  receiptDate: Date;
}

function normalizeCode(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}

function parseDateOnly(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = String(raw).trim().slice(0, 10);
  if (!s) return null;
  const ts = Date.parse(`${s}T12:00:00`);
  return Number.isFinite(ts) ? new Date(ts) : null;
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function isGrnCompleted(grn: GRNRecordFromApi): boolean {
  const status = String(grn.status ?? '').toLowerCase();
  return status.includes('complete') || Boolean(grn.grnDate || grn.receivedDate);
}

function materialKey(itemType: 'RM' | 'PM', code: string): string {
  return `${itemType}:${normalizeCode(code)}`;
}

function buildLeadStats(samples: LeadSample[], lookbackMonths: number): ActualLeadTimeStats | null {
  if (samples.length === 0) return null;
  const daysList = samples.map((s) => s.days);
  const avgDays = Math.round((daysList.reduce((a, b) => a + b, 0) / daysList.length) * 10) / 10;

  const cutoff90 = new Date();
  cutoff90.setDate(cutoff90.getDate() - 90);
  const recent = samples.filter((s) => s.receiptDate >= cutoff90);
  const older = samples.filter((s) => s.receiptDate < cutoff90);
  let trendLabel: string | null = null;
  if (recent.length >= 2 && older.length >= 2) {
    const recentAvg = recent.reduce((sum, s) => sum + s.days, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.days, 0) / older.length;
    if (recentAvg > olderAvg * 1.1) trendLabel = 'trending up';
  }

  const n = samples.length;
  return {
    avgDays,
    sampleCount: n,
    subLabel: `avg of ${n} PO${n === 1 ? '' : 's'} · last ${lookbackMonths}mo`,
    trendLabel,
  };
}

/** Actual lead = PO order date → GRN complete / SIH receipt date, averaged per material code. */
export function buildActualLeadTimeByMaterialKey(
  purchaseOrders: Order[],
  grnList: GRNRecordFromApi[],
  lookbackMonths = 6,
): Map<string, ActualLeadTimeStats> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - lookbackMonths);

  const poByOrderId = new Map<string, Order>();
  for (const po of purchaseOrders) {
    if (po.type !== 'PO') continue;
    poByOrderId.set(normalizeCode(po.orderId), po);
  }

  const samplesByKey = new Map<string, LeadSample[]>();

  for (const grn of grnList) {
    if (!isGrnCompleted(grn)) continue;
    const receiptDate = parseDateOnly(grn.grnDate ?? grn.receivedDate);
    if (!receiptDate || receiptDate < cutoff) continue;

    const po = poByOrderId.get(normalizeCode(grn.poNo));
    const poDate = parseDateOnly(po?.orderDate);
    if (!poDate) continue;

    const days = daysBetween(poDate, receiptDate);
    const itemType: 'RM' | 'PM' = grn.type === 'PM' ? 'PM' : 'RM';
    const lines = grn.lineItems ?? [];
    const touched = new Set<string>();
    for (const line of lines) {
      const code = normalizeCode(line.itemCode);
      if (!code || touched.has(code)) continue;
      touched.add(code);
      const key = materialKey(itemType, code);
      const bucket = samplesByKey.get(key) ?? [];
      bucket.push({ days, receiptDate });
      samplesByKey.set(key, bucket);
    }
  }

  const out = new Map<string, ActualLeadTimeStats>();
  for (const [key, samples] of samplesByKey) {
    const stats = buildLeadStats(samples, lookbackMonths);
    if (stats) out.set(key, stats);
  }
  return out;
}

export function resolveVendorAndQuotedLead(input: {
  itemType: 'RM' | 'PM';
  code: string;
  rawMaterialId?: number | string | null;
  packMaterialId?: number | string | null;
  itemsList: PriceListItemPage[];
  rmMaster?: RawMaterialRecord | null;
  pmMaster?: PackMaterialRecord | null;
}): { vendorName: string; quotedLeadDays: number | null } {
  const codeKey = normalizeCode(input.code);
  const rmId = input.rawMaterialId != null ? Number(input.rawMaterialId) : NaN;
  const pmId = input.packMaterialId != null ? Number(input.packMaterialId) : NaN;

  const pageItem = input.itemsList.find((row) => {
    if (input.itemType === 'RM' && Number.isFinite(rmId) && rmId > 0) {
      return Number(row.raw_material_id) === rmId;
    }
    if (input.itemType === 'PM' && Number.isFinite(pmId) && pmId > 0) {
      return Number(row.pack_material_id) === pmId;
    }
    return normalizeCode(row.code) === codeKey;
  });

  let vendorName = '';
  let quotedLeadDays: number | null = null;
  for (const rate of pageItem?.vendorRates ?? []) {
    const lt = rate.lead_time_days != null ? Number(rate.lead_time_days) : null;
    if (lt == null || !Number.isFinite(lt)) continue;
    if (quotedLeadDays == null || lt < quotedLeadDays) {
      quotedLeadDays = lt;
      vendorName = String(rate.vendor_name ?? '').trim();
    }
  }

  if (quotedLeadDays == null && input.itemType === 'RM' && input.rmMaster?.leadTimeDays != null) {
    quotedLeadDays = Number(input.rmMaster.leadTimeDays);
  }
  if (quotedLeadDays == null && input.itemType === 'PM' && input.pmMaster?.leadTimeDays != null) {
    quotedLeadDays = Number(input.pmMaster.leadTimeDays);
  }

  return { vendorName: vendorName || '—', quotedLeadDays };
}

function sumOpenPipelineQty(input: {
  itemType: 'RM' | 'PM';
  code: string;
  rawMaterialId?: number | string | null;
  packMaterialId?: number | string | null;
  procurementRequests: ProcurementRequest[];
  inTransit: number;
}): { openPoQty: number; openPrQty: number } {
  const codeKey = normalizeCode(input.code);
  const rmId = input.rawMaterialId != null ? Number(input.rawMaterialId) : NaN;
  const pmId = input.packMaterialId != null ? Number(input.packMaterialId) : NaN;

  const openPoQty = Math.max(0, Number(input.inTransit) || 0);

  let openPrQty = 0;
  const closedPr = new Set(['received', 'cancelled', 'closed', 'completed']);
  for (const pr of input.procurementRequests) {
    const prStatus = String(pr.status ?? '').toLowerCase();
    if (closedPr.has(prStatus)) continue;
    for (const line of pr.items ?? []) {
      if (line.type !== input.itemType) continue;
      const lineCode = normalizeCode(line.code);
      const matches =
        input.itemType === 'RM'
          ? (Number.isFinite(rmId) && line.raw_material_id === rmId) || lineCode === codeKey
          : (Number.isFinite(pmId) && line.pack_material_id === pmId) || lineCode === codeKey;
      if (!matches) continue;
      openPrQty += Number(line.quantity_requested) || 0;
    }
  }

  return { openPoQty, openPrQty };
}

export function computePlanBatchMaterialStatus(
  reqQty: number,
  free: number,
  inTransit: number,
  openPoQty: number,
  openPrQty: number,
): PlanBatchMaterialStatus {
  if (reqQty <= free) return 'AVAILABLE';
  if (inTransit > 0 || openPoQty > 0 || openPrQty > 0) return 'UNDER PROCUREMENT';
  return 'SHORTAGE';
}

export function formatEarliestInHouse(input: {
  reqQty: number;
  free: number;
  actualLeadDays: number | null;
  quotedLeadDays: number | null;
}): string {
  if (input.free >= input.reqQty) return 'in stock';
  const leadDays = Math.ceil(input.actualLeadDays ?? input.quotedLeadDays ?? 14);
  const d = new Date();
  d.setDate(d.getDate() + leadDays);
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    .replace(/ /g, '-');
}

export function formatLeadDaysLabel(days: number | null, suffix: 'quoted' | 'actual'): string {
  if (days == null || !Number.isFinite(days)) return '—';
  return `${days}d ${suffix}`;
}

export function planBatchStatusClass(status: PlanBatchMaterialStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'text-emerald-700 font-semibold';
    case 'UNDER PROCUREMENT':
      return 'text-amber-700 font-semibold';
    default:
      return 'text-red-700 font-semibold';
  }
}

export interface PlanBatchRmDisplayRow {
  key: string;
  name: string;
  code: string;
  vendorName: string;
  reqQty: number;
  sih: number;
  reserved: number;
  free: number;
  quotedLeadDays: number | null;
  actualLead: ActualLeadTimeStats | null;
  earliestInHouse: string;
  status: PlanBatchMaterialStatus;
}

export interface PlanBatchPmDisplayRow {
  key: string;
  name: string;
  code: string;
  vendorName: string;
  reqQty: number;
  sih: number;
  quotedLeadDays: number | null;
  actualLead: ActualLeadTimeStats | null;
  status: PlanBatchMaterialStatus;
}

export function enrichPlanBatchRmRows(input: {
  rows: Array<{
    name: string;
    code: string;
    reqThisOrder: number;
    sih: number;
    reserved: number;
    free: number;
    inTransit: number;
  }>;
  itemsList: PriceListItemPage[];
  rawMaterialsList: RawMaterialRecord[];
  procurementRequests: ProcurementRequest[];
  actualLeadByKey: Map<string, ActualLeadTimeStats>;
}): PlanBatchRmDisplayRow[] {
  return input.rows.map((row, idx) => {
    const master = input.rawMaterialsList.find(
      (r) =>
        normalizeCode(r.code) === normalizeCode(row.code) ||
        String(r.id) === String(row.code) ||
        r.name === row.name,
    );
    const { vendorName, quotedLeadDays } = resolveVendorAndQuotedLead({
      itemType: 'RM',
      code: row.code,
      rawMaterialId: master?.id,
      itemsList: input.itemsList,
      rmMaster: master,
    });
    const actualLead = input.actualLeadByKey.get(materialKey('RM', row.code)) ?? null;
    const { openPoQty, openPrQty } = sumOpenPipelineQty({
      itemType: 'RM',
      code: row.code,
      rawMaterialId: master?.id,
      procurementRequests: input.procurementRequests,
      inTransit: row.inTransit,
    });
    const status = computePlanBatchMaterialStatus(
      row.reqThisOrder,
      row.free,
      row.inTransit,
      openPoQty,
      openPrQty,
    );
    return {
      key: `rm-${row.code}-${idx}`,
      name: row.name,
      code: row.code,
      vendorName,
      reqQty: row.reqThisOrder,
      sih: row.sih,
      reserved: row.reserved,
      free: row.free,
      quotedLeadDays,
      actualLead,
      earliestInHouse: formatEarliestInHouse({
        reqQty: row.reqThisOrder,
        free: row.free,
        actualLeadDays: actualLead?.avgDays ?? null,
        quotedLeadDays,
      }),
      status,
    };
  });
}

export function enrichPlanBatchPmRows(input: {
  rows: Array<{
    name: string;
    code: string;
    reqThisOrder: number;
    sih: number;
    free: number;
    inTransit: number;
  }>;
  itemsList: PriceListItemPage[];
  packMaterialsList: PackMaterialRecord[];
  procurementRequests: ProcurementRequest[];
  actualLeadByKey: Map<string, ActualLeadTimeStats>;
}): PlanBatchPmDisplayRow[] {
  return input.rows.map((row, idx) => {
    const master = input.packMaterialsList.find(
      (p) =>
        normalizeCode(p.code) === normalizeCode(row.code) ||
        String(p.id) === String(row.code) ||
        p.description === row.name,
    );
    const { vendorName, quotedLeadDays } = resolveVendorAndQuotedLead({
      itemType: 'PM',
      code: row.code,
      packMaterialId: master?.id,
      itemsList: input.itemsList,
      pmMaster: master,
    });
    const actualLead = input.actualLeadByKey.get(materialKey('PM', row.code)) ?? null;
    const { openPoQty, openPrQty } = sumOpenPipelineQty({
      itemType: 'PM',
      code: row.code,
      packMaterialId: master?.id,
      procurementRequests: input.procurementRequests,
      inTransit: row.inTransit,
    });
    const status = computePlanBatchMaterialStatus(
      row.reqThisOrder,
      row.free,
      row.inTransit,
      openPoQty,
      openPrQty,
    );
    return {
      key: `pm-${row.code}-${idx}`,
      name: row.name,
      code: row.code,
      vendorName,
      reqQty: row.reqThisOrder,
      sih: row.sih,
      quotedLeadDays,
      actualLead,
      status,
    };
  });
}
