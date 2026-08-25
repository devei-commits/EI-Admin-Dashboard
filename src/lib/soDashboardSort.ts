/**
 * Column sorting for the Fulfillment SO Dashboard.
 *
 * The table is grouped by client, so sorting cannot simply reorder a flat list: rows sort WITHIN
 * their client group, and the groups themselves follow their own best row. That keeps a client's
 * orders together — which is the point of the grouping — while still honouring the chosen column.
 *
 * Serial numbers are assigned after sorting, so "Sr" always reads 1..n down the page.
 */
import type { SODashboardRow } from '../types/orderFulfillment';

export type SoDashboardSortKey =
  | 'soNo'
  | 'dueDate'
  | 'committedDate'
  | 'product'
  | 'status'
  | 'orderQty'
  | 'unitPrice'
  | 'amount'
  | 'fulfillment'
  | 'batchStage';

export type SortDir = 'asc' | 'desc';

/** Sort value for a row on one column. Strings compare naturally, numbers numerically. */
export function soSortValue(row: SODashboardRow, key: SoDashboardSortKey): string | number {
  switch (key) {
    case 'soNo':
      return String(row.soNo ?? '');
    case 'dueDate':
      return dateValue(row.dueDate);
    case 'committedDate':
      return dateValue(row.committedDate);
    case 'product':
      return `${row.product?.name ?? ''} ${row.product?.code ?? ''}`.trim();
    case 'status':
      return String(row.orderStatus ?? row.soStatus ?? '');
    case 'orderQty':
      return Number(row.totalOrderedQty) || 0;
    case 'unitPrice':
      return Number(row.unitPrice) || 0;
    case 'amount':
      return Number(row.soValue) || 0;
    case 'fulfillment':
      // Shipped is the furthest stage, so percent shipped orders the column meaningfully;
      // ties fall back to how much is packed, then ready.
      return (Number(row.shippedPct) || 0) * 1e6 + (Number(row.packedPct) || 0) * 1e3 + (Number(row.fgReadyPct) || 0);
    case 'batchStage':
      return Number(row.batchPillsTotal) || 0;
    default:
      return '';
  }
}

/** Undated rows sort last on ascending, which reads better than 1970 at the top. */
function dateValue(raw: string | null): number {
  if (!raw) return Number.POSITIVE_INFINITY;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export function compareSoRows(
  a: SODashboardRow,
  b: SODashboardRow,
  key: SoDashboardSortKey,
  dir: SortDir,
): number {
  const av = soSortValue(a, key);
  const bv = soSortValue(b, key);
  let cmp: number;
  if (typeof av === 'number' && typeof bv === 'number') {
    // Infinity - Infinity is NaN; treat two undated rows as equal.
    cmp = av === bv ? 0 : av - bv;
  } else {
    cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
  }
  if (cmp === 0) {
    // Stable, predictable tiebreak so equal rows never shuffle between renders.
    cmp = String(a.soNo ?? '').localeCompare(String(b.soNo ?? ''), undefined, { numeric: true, sensitivity: 'base' });
    return cmp;
  }
  return dir === 'asc' ? cmp : -cmp;
}

/** Sort rows inside each group, then order the groups by their own leading row. */
export function sortGroupedSoRows<G extends { rows: SODashboardRow[] }>(
  groups: G[],
  key: SoDashboardSortKey,
  dir: SortDir,
): G[] {
  for (const g of groups) g.rows.sort((a, b) => compareSoRows(a, b, key, dir));
  const ordered = [...groups].sort((a, b) =>
    a.rows[0] && b.rows[0] ? compareSoRows(a.rows[0], b.rows[0], key, dir) : 0,
  );
  return ordered;
}

/* ── Products & Batches tab ──────────────────────────────────────────────────
 * Rows are grouped by (SO, product) with one row per batch, so sorting works the same way as the
 * SO dashboard: batches sort inside their product line, and the product lines follow their leading
 * batch. Sorting flat would split a product's batches apart.
 */
import type { BatchDashboardRow } from '../types/orderFulfillment';

export type BatchesSortKey =
  | 'soNo'
  | 'client'
  | 'product'
  | 'orderQty'
  | 'dueDate'
  | 'batchNo'
  | 'fgReady'
  | 'packed'
  | 'invoiced'
  | 'shipped'
  | 'batchStatus';

export function batchSortValue(row: BatchDashboardRow, key: BatchesSortKey): string | number {
  switch (key) {
    case 'soNo':
      return String(row.soNo ?? '');
    case 'client':
      return String(row.client?.name ?? '');
    case 'product':
      return `${row.product?.name ?? ''} ${row.product?.code ?? ''}`.trim();
    case 'orderQty':
      return Number(row.product?.orderedQty) || 0;
    case 'dueDate':
      return batchDateValue(row.dueDate);
    case 'batchNo':
      return String(row.batch?.batchNo ?? '');
    case 'fgReady':
      return Number(row.fgQty) || 0;
    case 'packed':
      return Number(row.packedQty) || 0;
    case 'invoiced':
      return Number(row.invoicedQty) || 0;
    case 'shipped':
      return Number(row.shippedQty) || 0;
    case 'batchStatus':
      return String(row.batch?.stageLabel ?? row.batch?.stage ?? '');
    default:
      return '';
  }
}

function batchDateValue(raw: string | null): number {
  if (!raw) return Number.POSITIVE_INFINITY;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export function compareBatchRows(
  a: BatchDashboardRow,
  b: BatchDashboardRow,
  key: BatchesSortKey,
  dir: SortDir,
): number {
  const av = batchSortValue(a, key);
  const bv = batchSortValue(b, key);
  let cmp: number;
  if (typeof av === 'number' && typeof bv === 'number') {
    cmp = av === bv ? 0 : av - bv;
  } else {
    cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
  }
  if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
  // Direction-independent tiebreak: SO then batch no, so equal rows hold a stable order.
  const bySo = String(a.soNo ?? '').localeCompare(String(b.soNo ?? ''), undefined, { numeric: true, sensitivity: 'base' });
  if (bySo !== 0) return bySo;
  return String(a.batch?.batchNo ?? '').localeCompare(String(b.batch?.batchNo ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/** Sort batches inside each product line, then order the lines by their leading batch. */
export function sortGroupedBatchRows<G extends { batches: BatchDashboardRow[]; representative: BatchDashboardRow }>(
  groups: G[],
  key: BatchesSortKey,
  dir: SortDir,
): G[] {
  for (const g of groups) g.batches.sort((a, b) => compareBatchRows(a, b, key, dir));
  return [...groups].sort((a, b) => {
    const al = a.batches[0] ?? a.representative;
    const bl = b.batches[0] ?? b.representative;
    return al && bl ? compareBatchRows(al, bl, key, dir) : 0;
  });
}
