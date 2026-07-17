import { useEffect, useMemo, useState } from 'react';
import {
  fetchMRNList,
  getApiErrorMessage,
  formatMrnDisplayDate,
  mrnDisplayPrName,
  mrnDisplayBatchNumber,
  type MRNRecordFromApi,
} from '../../../services/mrn.service';

/**
 * Transfers → Returns tab. Read-only list of inbound transfers (Manufacturing Unit → Warehouse):
 * material sent back from an ML/MU to a warehouse. Sourced from MRNs with transferType inbound_from_mu.
 */
function statusBadgeClass(status: string): string {
  const s = String(status || '').toLowerCase();
  if (s.includes('complet') || s.includes('received')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (s.includes('transit') || s.includes('transfer')) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (s.includes('pending')) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

/**
 * Body-only view: the shared Transfers chrome (title, search, tab bar) lives in the parent
 * (OverviewComplete), which passes the current `search` string down. Renders just the table.
 */
const WarehouseReturnsTab = ({ search = '' }: { search?: string } = {}) => {
  const [rows, setRows] = useState<MRNRecordFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMRNList({ transferType: 'inbound_from_mu' });
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setError(getApiErrorMessage(e));
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
    if (!q) return rows;
    return rows.filter((r) =>
      [r.mrnNo, r.productName, r.batchNo, r.status, r.requestedBy, r.muReceiveZone, r.whDispatchZone]
        .map((v) => String(v || '').toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [rows, search]);

  return (
    <div className="p-6 w-full">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm">{error}</div>
        )}

        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">MRN No</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Batch</th>
                <th className="px-4 py-3 font-semibold">Returned by</th>
                <th className="px-4 py-3 font-semibold">To zone</th>
                <th className="px-4 py-3 font-semibold text-center">Items</th>
                <th className="px-4 py-3 font-semibold">Received</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">Loading returns…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    {rows.length === 0 ? 'No returns yet.' : 'No returns match your search.'}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.mrnNo}</td>
                    <td className="px-4 py-3 text-slate-700">{mrnDisplayPrName(r)}</td>
                    <td className="px-4 py-3 text-slate-600">{mrnDisplayBatchNumber(r)}</td>
                    <td className="px-4 py-3 text-slate-600">{r.requestedBy || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.muReceiveZone || r.whDispatchZone || '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{Array.isArray(r.lineItems) ? r.lineItems.length : 0}</td>
                    <td className="px-4 py-3 text-slate-600">{formatMrnDisplayDate(r.receivedAtMu || r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeClass(r.status)}`}>
                        {r.status || '—'}
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

export default WarehouseReturnsTab;
