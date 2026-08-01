import { useEffect, useMemo, useState } from 'react';
import { fetchFulfillmentOrders } from '../../../services/fulfillment.service';
import type { SaleOrder } from '../../../types/orderFulfillment';

/**
 * Transfers → Invoice tab. Read-only list of customer dispatch requests coming from the
 * Fulfillment module: orders that have reached the warehouse dispatch stage (fg_ready →
 * picking → invoiced → shipped → delivered). The warehouse dispatches these to the customer.
 */

/** SO statuses that represent a dispatch the warehouse is (or was) responsible for. */
const DISPATCH_STATUSES = new Set(['fg_ready', 'picking', 'invoiced', 'shipped', 'delivered']);

function prettyStatus(s: string): string {
  return String(s || '')
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function statusBadgeClass(status: string): string {
  const s = String(status || '').toLowerCase();
  if (s === 'delivered' || s === 'closed') return 'bg-ok-soft text-ok border-ok-soft';
  if (s === 'shipped') return 'bg-brand-soft text-brand border-brand-soft';
  if (s === 'invoiced') return 'bg-brand-soft text-brand border-brand-soft';
  if (s === 'picking') return 'bg-warn-soft text-warn border-warn-soft';
  if (s === 'fg_ready') return 'bg-brand-soft text-brand border-brand-soft';
  return 'bg-surface-3 text-ink-2 border-border';
}

function fmtDate(v: string | undefined | null): string {
  if (!v || !String(v).trim()) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
}

function fmtValue(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `₹${Number(v).toLocaleString('en-IN')}`;
}

/**
 * Body-only view: the shared Transfers chrome (title, search, tab bar) lives in the parent
 * (OverviewComplete), which passes the current `search` string down. Renders just the table.
 */
const WarehouseInvoiceTab = ({ search = '' }: { search?: string } = {}) => {
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchFulfillmentOrders();
        const dispatchable = (Array.isArray(data) ? data : []).filter((o) =>
          DISPATCH_STATUSES.has(String(o.soStatus || '').toLowerCase())
        );
        if (!cancelled) setOrders(dispatchable);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dispatch requests');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      [o.soNo, o.customer, o.customerCity, o.invoiceNo, o.soStatus]
        .map((v) => String(v || '').toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [orders, search]);

  return (
    <div className="p-6 w-full">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-err-soft bg-err-soft text-err text-sm">{error}</div>
        )}

        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-2 text-ink-2">
              <tr className="text-left">
                <th scope="col" className="px-4 py-3 font-semibold">SO No</th>
                <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                <th scope="col" className="px-4 py-3 font-semibold">Invoice No</th>
                <th scope="col" className="px-4 py-3 font-semibold">Dispatch date</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Value</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-4">Loading dispatch requests…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-4">
                    {orders.length === 0 ? 'No dispatch requests yet.' : 'No dispatches match your search.'}
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr key={o.id ?? o.soNo} className="hover:bg-surface-2">
                    <td className="px-4 py-3 font-medium text-ink">{o.soNo}</td>
                    <td className="px-4 py-3 text-ink-2">
                      {o.customer}
                      {o.customerCity ? <span className="text-ink-4"> · {o.customerCity}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-ink-2">{o.invoiceNo || '—'}</td>
                    <td className="px-4 py-3 text-ink-2">{fmtDate(o.dispatchDate)}</td>
                    <td className="px-4 py-3 text-right text-ink-2">{fmtValue(o.soValue)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeClass(o.soStatus)}`}>
                        {prettyStatus(o.soStatus)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
};

export default WarehouseInvoiceTab;
