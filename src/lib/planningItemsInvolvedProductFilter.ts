import type { ItemsInvolvedRow, PlanningExtractedRow } from '../services/planningExtracted.service';
import { matchesDateRangeFilter } from '../utils/dateRangeFilter';

export type PlanningProductFilterOption = {
  id: string;
  name: string;
  sku: string;
  soNumber: string;
};

export const PLANNING_PRODUCT_FILTER_ALL_ID = 'all';

function itemsInvolvedRowKey(row: ItemsInvolvedRow): string {
  return `${row.type}-${row.raw_material_id ?? row.pack_material_id}`;
}

function unionUniqueStrings(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b].filter(Boolean))];
}

/** Combine per-product items-involved rows (same RM/PM across multiple SOs/products). */
export function mergeItemsInvolvedRows(batches: ItemsInvolvedRow[][]): ItemsInvolvedRow[] {
  const map = new Map<string, ItemsInvolvedRow>();
  for (const rows of batches) {
    for (const row of rows) {
      const key = itemsInvolvedRowKey(row);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          ...row,
          planningExtractedIds: [...(row.planningExtractedIds ?? [])],
          usedInProducts: [...(row.usedInProducts ?? [])],
        });
        continue;
      }
      const totalRequired = (Number(existing.totalRequired) || 0) + (Number(row.totalRequired) || 0);
      const sih = Number(existing.sih) || 0;
      const inTransit = (Number(existing.inTransit) || 0) + (Number(row.inTransit) || 0);
      existing.totalRequired = totalRequired;
      existing.unallocatedToBatches =
        (Number(existing.unallocatedToBatches) || 0) + (Number(row.unallocatedToBatches) || 0);
      existing.batchAllocatedQty =
        (Number(existing.batchAllocatedQty) || 0) + (Number(row.batchAllocatedQty) || 0);
      existing.plannedQty = (Number(existing.plannedQty) || 0) + (Number(row.plannedQty) || 0);
      existing.poQty = (Number(existing.poQty) || 0) + (Number(row.poQty) || 0);
      existing.inTransitQty = (Number(existing.inTransitQty) || 0) + (Number(row.inTransitQty) || 0);
      existing.totalReleased = (Number(existing.totalReleased) || 0) + (Number(row.totalReleased) || 0);
      existing.totalOnPO = (Number(existing.totalOnPO) || 0) + (Number(row.totalOnPO) || 0);
      existing.totalReceived = (Number(existing.totalReceived) || 0) + (Number(row.totalReceived) || 0);
      existing.inTransit = inTransit;
      existing.batchCount = (Number(existing.batchCount) || 0) + (Number(row.batchCount) || 0);
      existing.planningExtractedIds = unionUniqueStrings(
        existing.planningExtractedIds ?? [],
        row.planningExtractedIds ?? []
      );
      existing.usedInProducts = unionUniqueStrings(existing.usedInProducts ?? [], row.usedInProducts ?? []);
      existing.surplusShortage = sih + inTransit - totalRequired;
      existing.coverage =
        totalRequired > 0 ? Math.min(100, Math.round(((sih + inTransit) / totalRequired) * 100)) : 100;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    String(a.code ?? '').localeCompare(String(b.code ?? ''), undefined, { sensitivity: 'base' })
  );
}

export function resolvePlanningExtractedIdForRelease(
  planningExtractedIds: number[],
  planningExtractedId: number | null | undefined,
  selectedProductIds: string[]
): number | null {
  const selected = selectedProductIds.map(String).filter(Boolean);
  if (selected.length === 1) {
    const n = Number(selected[0]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (selected.length > 1) {
    const hit = (planningExtractedIds ?? []).map(String).find((id) => selected.includes(id));
    if (hit) {
      const n = Number(hit);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
  }
  const single = Number(planningExtractedId);
  if (Number.isFinite(single) && single > 0) return single;
  const first = (planningExtractedIds ?? []).map(Number).find((n) => Number.isFinite(n) && n > 0);
  return first ?? null;
}

export const PLANNING_PRODUCT_FILTER_MAX_SUGGESTIONS = 30;

export function formatPlanningProductFilterDisplay(opt: PlanningProductFilterOption): string {
  const name = String(opt.name || '').trim();
  const sku = String(opt.sku || '').trim();
  if (name && sku) return `${name} — ${sku}`;
  return name || sku || 'Product';
}

/** Product chips + dropdown options — planning list plus items-involved PE ids (confirmed BOMs). */
export function buildPlanningProductFilterOptions(
  planningRows: PlanningExtractedRow[],
  itemsRows: ItemsInvolvedRow[],
  dateFilter: { from: string; to: string }
): PlanningProductFilterOption[] {
  const peById = new Map<string, PlanningExtractedRow>();
  for (const row of planningRows) {
    peById.set(String(row.id), row);
  }

  const candidateIds = new Set<string>();

  for (const row of planningRows) {
    const id = String(row.id);
    if (!row.bomConfirmedAt) continue;
    if (!matchesDateRangeFilter(row.orderDate ?? '', dateFilter.from, dateFilter.to)) continue;
    candidateIds.add(id);
  }

  for (const item of itemsRows) {
    for (const peId of item.planningExtractedIds ?? []) {
      const id = String(peId);
      const pe = peById.get(id);
      const orderDate = pe?.orderDate ?? '';
      if (!matchesDateRangeFilter(orderDate, dateFilter.from, dateFilter.to)) continue;
      candidateIds.add(id);
    }
  }

  const options: PlanningProductFilterOption[] = [];
  for (const id of candidateIds) {
    const pe = peById.get(id);
    if (pe) {
      options.push({
        id,
        name: String(pe.productName || pe.productCode || 'Product').trim(),
        sku: String(pe.productCode ?? '').trim(),
        soNumber: pe.soNumber ? `SO ${pe.soNumber}` : '',
      });
      continue;
    }
    const productNames = new Set<string>();
    for (const item of itemsRows) {
      if (!(item.planningExtractedIds ?? []).map(String).includes(id)) continue;
      for (const name of item.usedInProducts ?? []) {
        const trimmed = String(name ?? '').trim();
        if (trimmed) productNames.add(trimmed);
      }
    }
    options.push({
      id,
      name:
        productNames.size === 1
          ? [...productNames][0]!
          : productNames.size > 1
            ? [...productNames].slice(0, 2).join(', ')
            : `Planning line ${id}`,
      sku: '',
      soNumber: '',
    });
  }

  return options.sort((a, b) =>
    formatPlanningProductFilterDisplay(a).localeCompare(formatPlanningProductFilterDisplay(b), undefined, {
      sensitivity: 'base',
    })
  );
}

/** Filter consolidated items-involved rows to selected planning-extracted ids. */
export function filterItemsInvolvedRowsByProductIds(
  rows: ItemsInvolvedRow[],
  selectedProductIds: string[]
): ItemsInvolvedRow[] {
  if (selectedProductIds.length === 0) return rows;
  const selected = new Set(selectedProductIds.map(String));
  return rows.filter((row) =>
    (row.planningExtractedIds ?? []).some((id) => selected.has(String(id)))
  );
}

export function filterPlanningProductFilterOptions(
  options: PlanningProductFilterOption[],
  query: string,
  max: number = PLANNING_PRODUCT_FILTER_MAX_SUGGESTIONS
): PlanningProductFilterOption[] {
  const q = String(query ?? '')
    .trim()
    .toLowerCase();
  if (!q) return options.slice(0, max);
  return options
    .filter((opt) => {
      const name = String(opt.name ?? '').toLowerCase();
      const sku = String(opt.sku ?? '').toLowerCase();
      const so = String(opt.soNumber ?? '').toLowerCase();
      return name.includes(q) || sku.includes(q) || so.includes(q);
    })
    .slice(0, max);
}
