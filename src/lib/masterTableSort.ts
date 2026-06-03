import type { SortDirection } from '../components/ui/SortableTableTh';

export function compareMasterTableSort(
  av: string | number,
  bv: string | number,
  direction: SortDirection
): number {
  let cmp: number;
  if (typeof av === 'number' && typeof bv === 'number') {
    cmp = av - bv;
  } else {
    cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
  }
  return direction === 'asc' ? cmp : -cmp;
}

export function nextMasterTableSort<T extends string>(
  column: T,
  sortColumn: T | null,
  sortDirection: SortDirection
): { sortColumn: T; sortDirection: SortDirection } {
  if (sortColumn === column) {
    return { sortColumn: column, sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' };
  }
  return { sortColumn: column, sortDirection: 'asc' };
}

export type MasterStatCardSort = 'count-desc' | 'count-asc' | 'name-asc' | 'name-desc';

export type MasterStatBucket = {
  id: string;
  label: string;
  count: number;
};

/** Group master list rows into stat-card buckets (category, level, type, …). */
export function buildMasterStatBuckets(
  rows: unknown[],
  getKey: (row: unknown) => string,
  sort: MasterStatCardSort
): MasterStatBucket[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = String(getKey(row) ?? '').trim();
    const label = raw || 'Unset';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const buckets: MasterStatBucket[] = [...counts.entries()].map(([label, count]) => ({
    id: label,
    label,
    count,
  }));
  switch (sort) {
    case 'count-asc':
      buckets.sort((a, b) => a.count - b.count || a.label.localeCompare(b.label));
      break;
    case 'name-asc':
      buckets.sort((a, b) => a.label.localeCompare(b.label));
      break;
    case 'name-desc':
      buckets.sort((a, b) => b.label.localeCompare(a.label));
      break;
    default:
      buckets.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }
  return buckets;
}
