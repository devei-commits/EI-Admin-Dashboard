/**
 * Customer Tracker — BD spec §3. One row per client, health at a glance.
 * Reads the rollup rows from /bd/customers (financials best-effort → '—').
 * Row click / history button open the detail & history popups; the meeting /
 * query / grievance buttons are Phase-2 actions.
 * Tool-native light styling, mirrors the procurement table chrome.
 */
import React, { useMemo, useState } from 'react';
import { Search, RefreshCw, Loader2, Users, BookText, CalendarPlus, HelpCircle, Flag, ArrowUp } from 'lucide-react';
import type { BdCustomerRow } from '../../types/bd.types';
import {
  TIER_CONFIG, TIER_ORDER, LIFECYCLE_CONFIG, formatINRCompact, formatDMY,
  type ClientTier, type ClientLifecycle,
} from '../../constants/bd';

export type TrackerAction = 'meeting' | 'query' | 'grievance';

export interface CustomerTrackerViewProps {
  rows: BdCustomerRow[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenDetail: (code: string) => void;
  onOpenTimeline: (code: string) => void;
  onAction: (action: TrackerAction, row: BdCustomerRow) => void;
}

function TierPill({ tier }: { tier: ClientTier }) {
  const c = TIER_CONFIG[tier] ?? TIER_CONFIG.bronze;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold ${c.text} ${c.bg} ${c.border}`}>
      <Icon size={10} className="shrink-0" /> {c.label}
    </span>
  );
}
function LifecyclePill({ lifecycle }: { lifecycle: ClientLifecycle }) {
  const c = LIFECYCLE_CONFIG[lifecycle] ?? LIFECYCLE_CONFIG.active;
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c.text} ${c.bg} ${c.border}`}>{c.label}</span>;
}

const HEADERS = [
  'Customer', 'Location', 'BD POC', 'Receivable', 'Advances', 'Status',
  'Orders', 'PIS', 'Queries', 'Next Meeting', 'Grievances', 'History', 'Actions',
];

export const CustomerTrackerView: React.FC<CustomerTrackerViewProps> = ({
  rows, loading, error, onRefresh, onOpenDetail, onOpenTimeline, onAction,
}) => {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | ClientTier>('all');
  const [lifeFilter, setLifeFilter] = useState<'all' | ClientLifecycle>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (tierFilter !== 'all' && r.tier !== tierFilter) return false;
      if (lifeFilter !== 'all' && r.lifecycle !== lifeFilter) return false;
      if (q && !`${r.displayCode} ${r.code} ${r.name} ${r.bdPoc.name ?? ''} ${r.city ?? ''} ${r.location ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const tierRank: Record<ClientTier, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
    out.sort((a, b) => (tierRank[a.tier] - tierRank[b.tier]) || (b.clv - a.clv));
    return out;
  }, [rows, search, tierFilter, lifeFilter]);

  const totalReceivable = rows.reduce((s, r) => s + (r.receivable ?? 0), 0);
  const openOrders = rows.reduce((s, r) => s + r.orders.open, 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Users size={14} className="text-slate-400" />
          <span><b className="text-slate-800">Customer Tracker</b> · {rows.length} clients · {openOrders} open orders
          {totalReceivable > 0 && <span className="ml-2 text-slate-500">· receivable {formatINRCompact(totalReceivable)}</span>}</span>
        </div>
        <button onClick={onRefresh} title="Refresh" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, code, POC, city…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
          <option value="all">All Tiers</option>
          {TIER_ORDER.map((t) => <option key={t} value={t}>{TIER_CONFIG[t].label}</option>)}
        </select>
        <select value={lifeFilter} onChange={(e) => setLifeFilter(e.target.value as typeof lifeFilter)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
          <option value="all">All Statuses</option>
          {(Object.keys(LIFECYCLE_CONFIG) as ClientLifecycle[]).map((l) => <option key={l} value={l}>{LIFECYCLE_CONFIG[l].label}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="mr-2 animate-spin text-blue-500" />
          <span className="text-sm text-slate-500">Loading customers…</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <p className="mb-3 text-sm text-red-500">{error}</p>
          <button onClick={onRefresh} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          <Users size={30} className="mx-auto mb-2 opacity-30" />
          {rows.length === 0 ? 'No clients found.' : 'No clients match your filters.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {HEADERS.map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const overdue = (r.overdue ?? 0) > 0;
                return (
                  <tr key={r.id} className="transition-colors hover:bg-blue-50/30">
                    {/* Customer */}
                    <td className="px-3 py-2.5">
                      <button onClick={() => onOpenDetail(r.code)} className="text-left">
                        <span className="block font-mono text-[11px] font-semibold text-blue-600 hover:underline decoration-dotted">{r.displayCode}</span>
                        <span className="block max-w-[180px] truncate text-xs font-semibold text-slate-800" title={r.name}>{r.name}</span>
                        <span className="mt-0.5 block"><TierPill tier={r.tier} /></span>
                      </button>
                    </td>
                    {/* Location */}
                    <td className="max-w-[130px] px-3 py-2.5">
                      <p className="truncate text-xs text-slate-700">{r.city || r.location || '—'}</p>
                      {r.country && <p className="truncate text-[10px] text-slate-400">{r.country}</p>}
                    </td>
                    {/* BD POC */}
                    <td className="max-w-[120px] px-3 py-2.5"><p className="truncate text-xs text-slate-700">{r.bdPoc.name || '—'}</p></td>
                    {/* Receivable */}
                    <td className={`whitespace-nowrap px-3 py-2.5 text-xs tabular-nums ${overdue ? 'font-bold text-red-600' : 'text-slate-700'}`}>
                      {formatINRCompact(r.receivable)}
                      {overdue && <span className="ml-1 text-[9px]">overdue</span>}
                    </td>
                    {/* Advances */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-green-600">{formatINRCompact(r.advances)}</td>
                    {/* Status */}
                    <td className="whitespace-nowrap px-3 py-2.5"><LifecyclePill lifecycle={r.lifecycle} /></td>
                    {/* Orders */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-slate-700">
                      <b className={r.orders.open > 0 ? 'text-blue-600' : 'text-slate-400'}>{r.orders.open}</b>
                      <span className="text-slate-400"> / {r.orders.ytd} YTD</span>
                    </td>
                    {/* PIS */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-slate-700">
                      <b className={r.pis.inFlight > 0 ? 'text-violet-600' : 'text-slate-400'}>{r.pis.inFlight}</b>
                      <span className="text-slate-400"> / {r.pis.total}</span>
                    </td>
                    {/* Queries */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums">
                      <span className={r.queries.open > 0 ? 'font-semibold text-amber-600' : 'text-slate-400'}>{r.queries.open}</span>
                      {r.queries.breached > 0 && <span className="ml-1 inline-flex items-center font-bold text-red-600"><Flag size={9} className="mr-0.5" />{r.queries.breached}</span>}
                    </td>
                    {/* Next Meeting */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">{r.nextMeeting?.date ? formatDMY(r.nextMeeting.date) : '—'}</td>
                    {/* Grievances */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums">
                      <span className={r.grievances.open > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}>{r.grievances.open}</span>
                      {r.grievances.escalated > 0 && <span className="ml-1 inline-flex items-center text-[10px] text-orange-600"><ArrowUp size={9} className="mr-0.5" />{r.grievances.escalated}</span>}
                    </td>
                    {/* History */}
                    <td className="px-3 py-2.5">
                      <button onClick={() => onOpenTimeline(r.code)} title="History & comments"
                        className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600">
                        <BookText size={14} />
                      </button>
                    </td>
                    {/* Actions */}
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => onAction('meeting', r)} title="Add meeting"
                          className="rounded-md border border-blue-200 p-1.5 text-blue-600 hover:bg-blue-50"><CalendarPlus size={13} /></button>
                        <button onClick={() => onAction('query', r)} title="Raise query"
                          className="rounded-md border border-amber-200 p-1.5 text-amber-600 hover:bg-amber-50"><HelpCircle size={13} /></button>
                        <button onClick={() => onAction('grievance', r)} title="Log grievance"
                          className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Flag size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
