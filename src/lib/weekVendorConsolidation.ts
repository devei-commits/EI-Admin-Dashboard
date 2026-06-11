import { isoWeekFromDateString } from './isoWeek';
import type { ProcurementRequest, RequestStatus } from '../types/procurement.types';

export type WeekVendorConsolidationLine = {
  vendor: string;
  isoWeek: number;
  isoWeekYear: number;
  hasWeek: boolean;
  expectedDate: string;
  requestId: string;
  requestCode: string;
  status: RequestStatus;
  itemCode: string;
  itemName: string;
  reqQty: number;
  unit: string;
  moq: string;
  plannedPrice: number;
  estValue: number;
  type: 'RM' | 'PM' | 'FG';
  raw_material_id?: number;
  pack_material_id?: number;
};

/** Same vendor + ISO week + material — multiple PR lines rolled up for one PO. */
export type WeekVendorItemBucket = {
  key: string;
  vendor: string;
  isoWeek: number;
  isoWeekYear: number;
  hasWeek: boolean;
  itemCode: string;
  itemName: string;
  unit: string;
  type: 'RM' | 'PM' | 'FG';
  moq: string;
  plannedPrice: number;
  totalReqQty: number;
  totalEstValue: number;
  sourceLines: WeekVendorConsolidationLine[];
  raw_material_id?: number;
  pack_material_id?: number;
};

export type WeekVendorConsolidationGroup = {
  key: string;
  vendor: string;
  isoWeek: number;
  isoWeekYear: number;
  hasWeek: boolean;
  lines: WeekVendorConsolidationLine[];
  lineCount: number;
  totalEstValue: number;
};

function compareVendorWeekGroups(a: WeekVendorConsolidationGroup, b: WeekVendorConsolidationGroup): number {
  const vendorCmp = a.vendor.localeCompare(b.vendor, 'en', { sensitivity: 'base' });
  if (vendorCmp !== 0) return vendorCmp;
  if (a.hasWeek !== b.hasWeek) return a.hasWeek ? -1 : 1;
  if (a.isoWeekYear !== b.isoWeekYear) return a.isoWeekYear - b.isoWeekYear;
  if (a.isoWeek !== b.isoWeek) return a.isoWeek - b.isoWeek;
  return 0;
}

function compareLines(a: WeekVendorConsolidationLine, b: WeekVendorConsolidationLine): number {
  const vendorCmp = a.vendor.localeCompare(b.vendor, 'en', { sensitivity: 'base' });
  if (vendorCmp !== 0) return vendorCmp;
  if (a.hasWeek !== b.hasWeek) return a.hasWeek ? -1 : 1;
  if (a.isoWeekYear !== b.isoWeekYear) return a.isoWeekYear - b.isoWeekYear;
  if (a.isoWeek !== b.isoWeek) return a.isoWeek - b.isoWeek;
  const reqCmp = a.requestCode.localeCompare(b.requestCode, 'en');
  if (reqCmp !== 0) return reqCmp;
  return a.itemName.localeCompare(b.itemName, 'en', { sensitivity: 'base' });
}

/** Flatten procurement request item lines with vendor + ISO week from expected date. */
export function buildWeekVendorConsolidationLines(
  requests: ProcurementRequest[],
  options?: { excludeStatuses?: RequestStatus[] }
): WeekVendorConsolidationLine[] {
  const exclude = new Set(options?.excludeStatuses ?? []);
  const lines: WeekVendorConsolidationLine[] = [];

  for (const req of requests) {
    if (exclude.has(req.status)) continue;
    const vendor = String(req.preferredVendor ?? '').trim();
    if (!vendor) continue;
    const details = req.itemDetails ?? [];

    if (details.length === 0) {
      const names = req.items ?? [];
      const qtys = req.quantities ?? [];
      const prices = req.plannedPrices ?? [];
      const units = req.units ?? [];
      names.forEach((name, idx) => {
        const expectedDate = String(req.dueDate ?? '').trim().slice(0, 10);
        const weekParts = isoWeekFromDateString(expectedDate);
        lines.push({
          vendor,
          isoWeek: weekParts?.week ?? 0,
          isoWeekYear: weekParts?.year ?? 0,
          hasWeek: weekParts != null,
          expectedDate,
          requestId: req.id,
          requestCode: req.code,
          status: req.status,
          itemCode: '',
          itemName: String(name ?? ''),
          reqQty: Number(qtys[idx] ?? 0) || 0,
          unit: String(units[idx] ?? ''),
          moq: '',
          plannedPrice: Number(prices[idx] ?? 0) || 0,
          estValue: (Number(qtys[idx] ?? 0) || 0) * (Number(prices[idx] ?? 0) || 0),
          type: req.type,
        });
      });
      continue;
    }

    for (const d of details) {
      const expectedDate = String(d.expectedDate || req.dueDate || '').trim().slice(0, 10);
      const weekParts = isoWeekFromDateString(expectedDate);
      const reqQty = Number(d.reqQty ?? 0) || 0;
      const plannedPrice = Number(d.plannedPrice ?? 0) || 0;
      lines.push({
        vendor,
        isoWeek: weekParts?.week ?? 0,
        isoWeekYear: weekParts?.year ?? 0,
        hasWeek: weekParts != null,
        expectedDate,
        requestId: req.id,
        requestCode: req.code,
        status: req.status,
        itemCode: d.itemCode ?? '',
        itemName: d.itemName ?? '',
        reqQty,
        unit: d.unit ?? '',
        moq: d.moq ?? '',
        plannedPrice,
        estValue: Number(d.estValue ?? 0) || reqQty * plannedPrice,
        type: d.type === 'PM' ? 'PM' : d.type === 'FG' ? 'FG' : 'RM',
        ...(d.raw_material_id != null ? { raw_material_id: d.raw_material_id } : {}),
        ...(d.pack_material_id != null ? { pack_material_id: d.pack_material_id } : {}),
      });
    }
  }

  return lines.sort(compareLines);
}

function itemBucketKey(line: WeekVendorConsolidationLine): string {
  const code = String(line.itemCode ?? '').trim().toLowerCase();
  const name = String(line.itemName ?? '').trim().toLowerCase();
  const unit = String(line.unit ?? '').trim().toLowerCase();
  return `${line.type}|${code || name}|${unit}`;
}

/** Roll up lines in a vendor-week group by material (e.g. 5 kg + 6 kg → 11 kg). */
export function buildWeekVendorItemBuckets(
  group: WeekVendorConsolidationGroup
): WeekVendorItemBucket[] {
  const map = new Map<string, WeekVendorItemBucket>();

  for (const line of group.lines) {
    const ik = itemBucketKey(line);
    const bucketKey = `${group.key}|${ik}`;
    const existing = map.get(bucketKey);
    if (!existing) {
      map.set(bucketKey, {
        key: bucketKey,
        vendor: group.vendor,
        isoWeek: group.isoWeek,
        isoWeekYear: group.isoWeekYear,
        hasWeek: group.hasWeek,
        itemCode: line.itemCode,
        itemName: line.itemName,
        unit: line.unit,
        type: line.type,
        moq: line.moq,
        plannedPrice: line.plannedPrice,
        totalReqQty: line.reqQty,
        totalEstValue: line.estValue,
        sourceLines: [line],
        ...(line.raw_material_id != null ? { raw_material_id: line.raw_material_id } : {}),
        ...(line.pack_material_id != null ? { pack_material_id: line.pack_material_id } : {}),
      });
      continue;
    }
    const nextQty = existing.totalReqQty + line.reqQty;
    const nextValue = existing.totalEstValue + line.estValue;
    const weightedPrice =
      nextQty > 0
        ? (existing.plannedPrice * existing.totalReqQty + line.plannedPrice * line.reqQty) / nextQty
        : line.plannedPrice;
    map.set(bucketKey, {
      ...existing,
      totalReqQty: Math.round(nextQty * 1000) / 1000,
      totalEstValue: Math.round(nextValue * 100) / 100,
      plannedPrice: Math.round(weightedPrice * 100) / 100,
      sourceLines: [...existing.sourceLines, line],
      moq: existing.moq || line.moq,
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    a.itemName.localeCompare(b.itemName, 'en', { sensitivity: 'base' })
  );
}

export function groupWeekVendorConsolidationLines(
  lines: WeekVendorConsolidationLine[]
): WeekVendorConsolidationGroup[] {
  const groups: WeekVendorConsolidationGroup[] = [];
  let current: WeekVendorConsolidationGroup | null = null;

  for (const line of lines) {
    const weekKey = line.hasWeek ? `${line.isoWeekYear}-${line.isoWeek}` : 'no-date';
    const key = `${line.vendor}|${weekKey}`;
    if (!current || current.key !== key) {
      current = {
        key,
        vendor: line.vendor,
        isoWeek: line.isoWeek,
        isoWeekYear: line.isoWeekYear,
        hasWeek: line.hasWeek,
        lines: [],
        lineCount: 0,
        totalEstValue: 0,
      };
      groups.push(current);
    }
    current.lines.push(line);
    current.lineCount += 1;
    current.totalEstValue += line.estValue;
  }

  return groups.sort(compareVendorWeekGroups);
}
