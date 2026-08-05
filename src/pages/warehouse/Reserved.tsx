import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Search, Package, FlaskConical } from 'lucide-react';
import {
  fetchReservedItems,
  type ReservedItem,
} from '../../services/warehouseInventory.service';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';

const SOURCE_META: Record<string, { label: string; cls: string }> = {
  planning: { label: 'Planning', cls: 'bg-brand-soft text-brand border-brand-soft' },
  production: { label: 'Production', cls: 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30' },
  fulfillment: { label: 'Fulfillment', cls: 'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30' },
  unlinked: { label: 'Unlinked', cls: 'bg-surface-3 text-ink-3 border-border' },
};

function fmtQty(n: number, unit: string): string {
  const v = Number(n) || 0;
  const s = Number.isInteger(v)
    ? v.toLocaleString('en-IN')
    : v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return `${s} ${unit}`;
}

function referenceLabel(r: ReservedItem['reservations'][number]): string {
  if (r.source === 'production' && r.productionBatchNo) {
    return `Batch ${r.productionBatchNo}${r.productionBmrStatus ? ` (${r.productionBmrStatus})` : ''}`;
  }
  if (r.source === 'planning' && r.planningExtractedId != null) return `Planning #${r.planningExtractedId}`;
  if (r.source === 'fulfillment' && r.fulfillmentOrderItemId != null) return `Fulfillment #${r.fulfillmentOrderItemId}`;
  return '—';
}

export default function WarehouseReserved(): React.ReactElement {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['warehouse-reserved-items'],
    queryFn: async () => {
      const res = await fetchReservedItems();
      if (!res.success) {
        const msg = typeof res.error === 'string' ? res.error : res.error?.message ?? 'Failed to load reserved items';
        throw new Error(msg);
      }
      return res.data ?? [];
    },
  });

  const items = data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.code.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        it.reservations.some((r) => (r.soNo ?? '').toLowerCase().includes(q)),
    );
  }, [items, search]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const totalReserved = filtered.reduce((s, it) => s + it.reservedTotal, 0);

  return (
    <div className="flex-1 overflow-auto bg-surface p-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-ink tracking-tight">Reserved Items</h1>
          <p className="text-sm text-ink-3 mt-1">
            Every material with active reservations, and exactly where each is held — planning, production, or
            fulfillment. Free stock (SIH) is what remains after these holds; an item can show <em>0 free</em> even when
            physically in stock because it is fully reserved.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-4 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, name, or SO…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-surface"
            />
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-3 py-2 text-sm border border-border rounded-lg text-ink-2 hover:bg-surface-2"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : isError ? (
          <ErrorState message="Failed to load reserved items." onRetry={() => refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No reserved items"
            description={search ? 'No items match your search.' : 'Nothing is reserved right now.'}
          />
        ) : (
          <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-2 flex items-center justify-between">
              <p className="text-[11px] text-ink-3 tabular-nums">
                {filtered.length} item{filtered.length === 1 ? '' : 's'} reserved
                {isFetching ? ' · refreshing…' : ` · ${totalReserved.toLocaleString('en-IN')} units held`}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3 bg-surface-2 border-b border-border">
                    <th className="px-4 py-2 w-8" />
                    <th className="px-2 py-2">Code</th>
                    <th className="px-2 py-2">Item</th>
                    <th className="px-2 py-2 text-right">Stock in Hand</th>
                    <th className="px-2 py-2 text-right">Reserved</th>
                    <th className="px-2 py-2 text-right">Available</th>
                    <th className="px-2 py-2 text-center">Where</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it) => {
                    const key = `${it.itemType}-${it.itemId}`;
                    const open = expanded.has(key);
                    const over = it.reservedTotal > it.stockInHand + 1e-6;
                    return (
                      <React.Fragment key={key}>
                        <tr
                          className="border-b border-border hover:bg-surface-2 cursor-pointer"
                          onClick={() => toggle(key)}
                        >
                          <td className="px-4 py-2 text-ink-4">
                            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-2 py-2 font-mono text-xs text-ink whitespace-nowrap">{it.code}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1.5">
                              {it.itemType === 'RM' ? (
                                <FlaskConical className="w-3.5 h-3.5 text-ink-4 shrink-0" />
                              ) : (
                                <Package className="w-3.5 h-3.5 text-ink-4 shrink-0" />
                              )}
                              <span className="text-ink truncate max-w-[320px]" title={it.name}>
                                {it.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-ink whitespace-nowrap">
                            {fmtQty(it.stockInHand, it.unit)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums font-semibold text-ink whitespace-nowrap">
                            {fmtQty(it.reservedTotal, it.unit)}
                          </td>
                          <td
                            className={`px-2 py-2 text-right tabular-nums font-semibold whitespace-nowrap ${
                              it.available > 0 ? 'text-ok' : 'text-err'
                            }`}
                          >
                            {fmtQty(it.available, it.unit)}
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
                              {it.reservations.length} hold{it.reservations.length === 1 ? '' : 's'}
                              {over ? (
                                <span className="ml-1 text-[10px] text-err bg-err-soft border border-err/30 rounded px-1">
                                  over-reserved
                                </span>
                              ) : null}
                            </span>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="bg-surface-2/50">
                            <td />
                            <td colSpan={6} className="px-4 py-3">
                              <div className="rounded-lg border border-border overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-ink-3 bg-surface-2 border-b border-border">
                                      <th className="px-3 py-1.5">Source</th>
                                      <th className="px-3 py-1.5">Sales Order</th>
                                      <th className="px-3 py-1.5">Customer</th>
                                      <th className="px-3 py-1.5">Reference</th>
                                      <th className="px-3 py-1.5 text-right">Qty</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {it.reservations.map((r) => {
                                      const sm = SOURCE_META[r.source] ?? SOURCE_META.unlinked;
                                      return (
                                        <tr key={r.reservationId} className="border-b border-border/60 last:border-0">
                                          <td className="px-3 py-1.5">
                                            <span
                                              className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold ${sm.cls}`}
                                            >
                                              {sm.label}
                                            </span>
                                          </td>
                                          <td className="px-3 py-1.5 whitespace-nowrap">
                                            {r.soNo ? (
                                              <span className="text-ink">
                                                {r.soNo}
                                                {r.soStatus ? <span className="text-ink-4"> · {r.soStatus}</span> : null}
                                              </span>
                                            ) : (
                                              <span className="text-ink-4">—</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-1.5 text-ink-3 truncate max-w-[220px]" title={r.customer ?? ''}>
                                            {r.customer ?? '—'}
                                          </td>
                                          <td className="px-3 py-1.5 text-ink-3 whitespace-nowrap">{referenceLabel(r)}</td>
                                          <td className="px-3 py-1.5 text-right tabular-nums font-medium text-ink whitespace-nowrap">
                                            {fmtQty(r.qty, it.unit)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
