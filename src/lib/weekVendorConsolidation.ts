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
    const vendor = String(req.preferredVendor ?? '').trim() || 'Unassigned vendor';
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
      });
    }
  }

  return lines.sort(compareLines);
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
