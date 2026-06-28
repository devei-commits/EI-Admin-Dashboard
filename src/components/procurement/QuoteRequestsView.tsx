/**
 * Track Quote Requests — Procurement spec View 3 (§5).
 * Tracks RFQ requests (sourced from Planning's quotation asks) through their
 * lifecycle, with a Generate-Template action (§5.3). Self-fetches all statuses.
 * Tool-native light styling.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, MessageSquare, Loader2, FileText } from 'lucide-react';
import { fetchPlanningQuotationAsks, type PlanningQuotationAsk } from '../../services/planningQuotationAsks.service';
import {
  QUOTE_STATUS_CONFIG, PR_SOURCE_CONFIG, SLA_DEFAULTS, SLA_LEVEL_CLASSES, SLA_LEVEL_PREFIX,
  slaLevelFromDaysOpen, type QuoteStatus,
} from '../../constants/procurement';
import { RfqTemplatePopup, type RfqTemplateData } from './RfqTemplatePopup';

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-US', { month: 'short' })}-${dt.getFullYear()}`;
}
function daysSince(d: string | null | undefined): number {
  if (!d) return 0;
  const dt = new Date(d); dt.setHours(0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return 0;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((t.getTime() - dt.getTime()) / 86_400_000));
}
function mapStatus(s: PlanningQuotationAsk['status']): QuoteStatus {
  if (s === 'fulfilled') return 'completed';
  if (s === 'cancelled') return 'terminated';
  return 'requested';
}

export const QuoteRequestsView: React.FC = () => {
  const [asks, setAsks] = useState<PlanningQuotationAsk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [templateFor, setTemplateFor] = useState<RfqTemplateData | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetchPlanningQuotationAsks();
      if (res.success) setAsks(res.data ?? []);
      else setError('Failed to load quote requests');
    } catch (e) { setError('Failed to load quote requests'); console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = asks.map((a) => ({
      ask: a,
      qtId: `QT-${String(a.id).padStart(4, '0')}`,
      status: mapStatus(a.status),
      daysOpen: daysSince(a.createdAt),
    }));
    const filtered = out.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q && !`${r.qtId} ${r.ask.itemName ?? ''} ${r.ask.itemCode ?? ''} ${r.ask.vendorHint ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const rank: Record<QuoteStatus, number> = { requested: 0, draft: 1, completed: 2, terminated: 3 };
    filtered.sort((a, b) => (rank[a.status] - rank[b.status]) || (b.daysOpen - a.daysOpen));
    return filtered;
  }, [asks, search, statusFilter]);

  const openTemplate = (a: PlanningQuotationAsk) => {
    setTemplateFor({
      qtId: `QT-${String(a.id).padStart(4, '0')}`,
      requestDate: a.createdAt,
      vendor: a.vendorHint || 'Any (broadcast)',
      itemCode: a.itemCode || '',
      itemName: a.itemName || '—',
      qtyTiers: [`${a.quantityRequested.toLocaleString('en-IN')}${a.unit ? ` ${a.unit}` : ''}`],
      needBy: null,
      comments: a.notes || undefined,
    });
  };

  const awaiting = asks.filter((a) => a.status === 'pending').length;
  const breached = rows.filter((r) => r.status === 'requested' && r.daysOpen > SLA_DEFAULTS.quoteDays).length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="text-xs text-slate-600">
          💬 <b className="text-slate-800">Quote Requests</b> · {asks.length} total · {awaiting} awaiting response
          {breached > 0 && <span className="ml-2 text-red-600 font-semibold">🚩 {breached} SLA-breached</span>}
        </div>
        <button onClick={() => void load()} title="Refresh" className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search QT ID, item, vendor…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
          <option value="all">All Statuses</option>
          <option value="requested">Requested</option>
          <option value="completed">Completed</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-blue-500 mr-2" /><span className="text-sm text-slate-500">Loading quote requests…</span></div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center"><p className="text-red-500 text-sm mb-3">{error}</p><button onClick={() => void load()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Retry</button></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400 text-sm"><MessageSquare size={30} className="mx-auto mb-2 opacity-30" />No quote requests.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Req Date', 'QT ID', 'Source', 'Item', 'Vendor(s)', 'Req Qty', 'Target Price', 'Quote Status', 'SLA', 'Actions'].map((h) => (
                  <th key={h} className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const sc = QUOTE_STATUS_CONFIG[r.status];
                const src = PR_SOURCE_CONFIG.planning;
                const slaLevel = slaLevelFromDaysOpen(r.daysOpen, SLA_DEFAULTS.quoteDays);
                return (
                  <tr key={r.ask.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-700">{fmtDate(r.ask.createdAt)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] font-semibold text-slate-800">{r.qtId}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9.5px] font-semibold ${src.text} ${src.bg} ${src.border}`}>{src.emoji} {src.label}</span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[170px]">
                      <p className="text-xs font-semibold text-slate-800 truncate" title={r.ask.itemName ?? ''}>{r.ask.itemName ?? '—'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{r.ask.itemCode}</p>
                    </td>
                    <td className="px-3 py-2.5 max-w-[130px]"><p className="text-xs text-slate-700 truncate">{r.ask.vendorHint || 'Any (broadcast)'}</p></td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs tabular-nums text-slate-700">{r.ask.quantityRequested.toLocaleString('en-IN')}{r.ask.unit ? ` ${r.ask.unit}` : ''}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-400">—</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${sc.text} ${sc.bg} ${sc.border}`}>{sc.label}</span></td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className={`text-[11px] font-mono ${SLA_LEVEL_CLASSES[slaLevel]}`}>{SLA_LEVEL_PREFIX[slaLevel]} {r.daysOpen}d</span><span className="text-[9.5px] text-slate-400 ml-1">/ {SLA_DEFAULTS.quoteDays}d</span></td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => openTemplate(r.ask)} title="Generate RFQ template" className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-[10.5px] font-semibold">
                        <FileText size={12} /> Template
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {templateFor && <RfqTemplatePopup data={templateFor} onClose={() => setTemplateFor(null)} />}
    </div>
  );
};
