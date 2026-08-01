/**
 * Queries queue (§3F) — cross-client list of customer/EI queries with status &
 * SLA. Filter by status/source/related-type, search, open a row to respond or
 * escalate, or raise a new query. Mirrors the Customer Tracker table chrome.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, HelpCircle, Plus } from 'lucide-react';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import type { BdCustomerRow, BdQueryRow } from '../../types/bd.types';
import { QUERY_STATUS_CONFIG, formatDMY, type QueryStatus } from '../../constants/bd';
import { fetchBdQueries } from '../../services/bd.service';
import { StatusPill, SourceTag, SlaCell, ClientCell, RelatedCell } from './bdQueueBits';
import { QueryDetailPopup } from './QueryDetailPopup';
import { NewTxnPopup } from './NewTxnPopup';

const HEADERS = ['Query', 'Client', 'Source', 'Related To', 'Subject', 'Assignee', 'SLA', 'Status', 'Raised'];
const OPEN_STATUSES: QueryStatus[] = ['open', 'escalated', 'under_review', 'response_drafted', 'responded', 'reopened'];

export interface QueriesViewProps {
  clients: BdCustomerRow[];
  onDataChanged?: () => void;
}

export const QueriesView: React.FC<QueriesViewProps> = ({ clients, onDataChanged }) => {
  const [rows, setRows] = useState<BdQueryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | QueryStatus>('open');
  const [active, setActive] = useState<BdQueryRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await fetchBdQueries();
    if (res.success) setRows(res.data ?? []);
    else setError(res.error || 'Failed to load queries');
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === 'open' && r.status === 'resolved') return false;
      if (statusFilter !== 'all' && statusFilter !== 'open' && r.status !== statusFilter) return false;
      if (q && !`${r.code} ${r.client.name} ${r.client.displayCode} ${r.subject ?? ''} ${r.description} ${r.assignee.name ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const openCount = rows.filter((r) => r.status !== 'resolved').length;

  const handleUpdated = (updated: BdQueryRow) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    onDataChanged?.();
  };
  const handleCreated = () => { void load(); onDataChanged?.(); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <HelpCircle size={14} className="text-amber-500" />
          <span><b className="text-slate-800">Queries</b> · {openCount} open · {rows.length} total</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700"><Plus size={14} /> New query</button>
          <button onClick={() => void load()} title="Refresh" aria-label="Refresh" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search query, client, assignee…" aria-label="Search query, client, assignee" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
          <option value="open">Open (active)</option>
          <option value="all">All statuses</option>
          {OPEN_STATUSES.concat('resolved').map((s) => <option key={s} value={s}>{QUERY_STATUS_CONFIG[s].label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4"><TableSkeleton rows={6} cols={9} /></div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white"><ErrorState message={error} onRetry={() => void load()} /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white"><EmptyState icon={<HelpCircle />} title={rows.length === 0 ? 'No queries yet.' : 'No queries match your filters.'} /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">{HEADERS.map((h) => <th scope="col" key={h} className="whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="cursor-pointer transition-colors hover:bg-blue-50/30" onClick={() => setActive(r)}>
                  <td className="px-3 py-2.5 font-mono text-[11px] font-semibold text-blue-600">{r.code}</td>
                  <td className="px-3 py-2.5"><ClientCell client={r.client} /></td>
                  <td className="px-3 py-2.5"><SourceTag origin={r.origin} /></td>
                  <td className="px-3 py-2.5"><RelatedCell type={r.relatedType} ref={r.relatedRef} info={r.relatedInfo} /></td>
                  <td className="max-w-[200px] px-3 py-2.5"><p className="truncate text-xs text-slate-700" title={r.subject || r.description}>{r.subject || r.description}</p></td>
                  <td className="max-w-[110px] px-3 py-2.5"><p className="truncate text-xs text-slate-600">{r.assignee.name || '—'}</p></td>
                  <td className="px-3 py-2.5"><SlaCell createdAt={r.createdAt} targetHrs={r.slaTargetHours} resolvedAt={r.resolvedAt} /></td>
                  <td className="px-3 py-2.5"><StatusPill cfg={QUERY_STATUS_CONFIG[r.status]} /></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">{formatDMY(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active && <QueryDetailPopup query={active} onClose={() => setActive(null)} onUpdated={handleUpdated} />}
      {creating && <NewTxnPopup kind="query" clients={clients} onClose={() => setCreating(false)} onCreated={handleCreated} />}
    </div>
  );
};

export default QueriesView;
