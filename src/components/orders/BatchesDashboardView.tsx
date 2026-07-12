import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, AlertCircle, Clock, MessageSquare, RefreshCw,
  Package, Loader2, AlertTriangle, CheckCircle,
} from 'lucide-react';
import type { BatchDashboardRow, StageLogEntry } from '../../types/orderFulfillment';
import { fetchBatchesDashboard } from '../../services/fulfillment.service';
import { BATCH_STAGE_FILTER_OPTIONS } from '../../constants/orderFulfillment';
import { CommentsPanel } from './CommentsPanel';

/* ── Formatting helpers ───────────────────────────────────────────────────── */
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d as string;
  const day = String(dt.getDate()).padStart(2, '0');
  const mon = dt.toLocaleString('en-US', { month: 'short' });
  return `${day}-${mon}-${dt.getFullYear()}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-IN');
}

function daysToGo(due: string | null | undefined): number | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

/* ── Stage colors / badge ─────────────────────────────────────────────────── */
const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PLANNING:    { bg: 'bg-gray-100',   text: 'text-gray-600',    border: 'border-gray-200' },
  PROCUREMENT: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  PRODUCTION:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  FG_READY:    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  PACKED:      { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  INVOICED:    { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  SHIPPED:     { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
};

function StageBadge({ stage, label }: { stage: string; label: string }) {
  const c = STAGE_COLORS[stage] ?? STAGE_COLORS.PLANNING;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${c.bg} ${c.text} ${c.border}`}>
      {label}
    </span>
  );
}

/* ── Qty cell: bar (% vs batch qty) + value ──────────────────────────────── */
function QtyCell({ value, denom, color }: { value: number; denom: number; color: string }) {
  const pct = denom > 0 ? Math.min(100, Math.round((value / denom) * 100)) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden shrink-0">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[11px] tabular-nums text-gray-700">{fmtNum(value)}</span>
    </div>
  );
}

/* ── Stage Time Log: one mini-row per stage (actual / committed) ──────────── */
function StageTimeLog({ logs }: { logs: StageLogEntry[] }) {
  if (!logs.length) return <span className="text-[10px] text-gray-400">—</span>;
  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      {logs.map((log) => {
        const committed = log.committedDays;
        const actual = log.actualDays;
        const pct = committed && committed > 0 && actual != null
          ? Math.min(100, Math.round((actual / committed) * 100))
          : actual != null ? 100 : 0;
        const barColor = log.slipped
          ? 'bg-red-500'
          : log.approaching
            ? 'bg-amber-500'
            : actual != null ? 'bg-emerald-500' : 'bg-gray-200';
        const Icon = log.slipped ? AlertTriangle : log.completedAt != null ? CheckCircle : Clock;
        return (
          <div key={log.stage} className="grid items-center gap-1.5" style={{ gridTemplateColumns: '58px 1fr 56px' }}>
            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-gray-600 truncate" title={log.stageLabel}>
              <Icon size={8} className={`shrink-0 ${log.slipped ? 'text-red-500' : log.completedAt != null ? 'text-emerald-500' : 'text-gray-400'}`} />
              {log.stageLabel}
            </span>
            <span className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <span className={`block h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </span>
            <span className={`text-[9px] font-mono text-right whitespace-nowrap ${log.slipped ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
              {log.slipped && '🚩'}{actual != null ? `${actual}d` : '—'} / {committed != null ? `${committed}d` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Deduplicate flat rows (drop sync-race duplicates / stale placeholders) ── */
function dedupRows(rows: BatchDashboardRow[]): BatchDashboardRow[] {
  const groups = new Map<string, BatchDashboardRow[]>();
  for (const r of rows) {
    const key = `${r.soNo}__${r.product.code}__${r.product.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const out: BatchDashboardRow[] = [];
  for (const group of groups.values()) {
    const hasReal = group.some((s) => s.batch.bprNo !== '');
    const filtered = hasReal ? group.filter((s) => s.batch.bprNo !== '') : group;
    const seen = new Set<string>();
    for (const s of filtered) {
      const k = s.batch.bprNo || `__pending_${s.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

/* ── Group deduped rows by SO + product — one visual record per line item ─── */
type GroupedBatchRow = {
  key: string;
  representative: BatchDashboardRow; // first batch — used for SO/client/product/due cells
  batches: BatchDashboardRow[];
  worstSla: { overdue: boolean; approaching: boolean; daysOverdue: number };
};

function groupRows(rows: BatchDashboardRow[]): GroupedBatchRow[] {
  const map = new Map<string, GroupedBatchRow>();
  const order: string[] = [];

  for (const r of rows) {
    const key = `${r.soNo}__${r.product.code}__${r.product.name}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        representative: r,
        batches: [],
        worstSla: { overdue: false, approaching: false, daysOverdue: 0 },
      });
      order.push(key);
    }
    const g = map.get(key)!;
    g.batches.push(r);
    // Aggregate worst SLA across all batches in the group
    if (r.slaFlag.overdue) {
      g.worstSla.overdue = true;
      g.worstSla.daysOverdue = Math.max(g.worstSla.daysOverdue, r.slaFlag.daysOverdue);
    }
    if (r.slaFlag.approaching && !g.worstSla.overdue) {
      g.worstSla.approaching = true;
    }
  }

  // Sort groups: overdue first, then approaching, then due date ascending
  const sorted = order.map((k) => map.get(k)!);
  sorted.sort((a, b) => {
    if (a.worstSla.overdue !== b.worstSla.overdue) return a.worstSla.overdue ? -1 : 1;
    if (a.worstSla.approaching !== b.worstSla.approaching) return a.worstSla.approaching ? -1 : 1;
    const da = a.representative.dueDate ?? '9999-12-31';
    const db = b.representative.dueDate ?? '9999-12-31';
    return da < db ? -1 : da > db ? 1 : 0;
  });

  return sorted;
}

/* ── Main component ───────────────────────────────────────────────────────── */
export const BatchesDashboardView: React.FC = () => {
  const [rows, setRows] = useState<BatchDashboardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [dueBefore, setDueBefore] = useState('');

  // Comments panel (per batch)
  const [commentTarget, setCommentTarget] = useState<{ id: number; label: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {};
      if (search.trim()) params.search = search.trim();
      if (stageFilter !== 'all') params.stage = [stageFilter];
      if (flaggedOnly) params.flagged_only = true;
      if (dueBefore) params.due_before = dueBefore;
      const res = await fetchBatchesDashboard(params as any);
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError('Failed to load batches dashboard');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter, flaggedOnly, dueBefore]);

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const grouped = useMemo(() => groupRows(dedupRows(rows)), [rows]);
  const totalBatches = useMemo(() => grouped.reduce((s, g) => s + g.batches.length, 0), [grouped]);
  const overdueCount = useMemo(() => grouped.filter((g) => g.worstSla.overdue).length, [grouped]);

  return (
    <>
      {/* Filters */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search batch no, SO no, product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm bg-white"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            {BATCH_STAGE_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 whitespace-nowrap shrink-0">Due before</label>
            <input type="date" value={dueBefore} onChange={(e) => setDueBefore(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)}
                className="w-4 h-4 rounded accent-orange-500" />
              <span className="text-sm text-gray-700">Flagged only</span>
            </label>
            <button onClick={load} title="Refresh" className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {grouped.length} product line{grouped.length !== 1 ? 's' : ''}
            {totalBatches !== grouped.length && <span className="ml-1 text-gray-400">({totalBatches} batch{totalBatches !== 1 ? 'es' : ''})</span>}
            {overdueCount > 0 && <span className="ml-2 text-red-600 font-semibold">🚩 {overdueCount} overdue</span>}
          </span>
          <button
            onClick={() => { setSearch(''); setStageFilter('all'); setFlaggedOnly(false); setDueBefore(''); }}
            className="text-xs text-gray-500 hover:text-gray-800 underline"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={22} className="animate-spin text-orange-500 mr-2" />
          <span className="text-sm text-gray-500">Loading dashboard…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-16">
          <p className="text-red-500 text-sm mb-3">{error}</p>
          <button onClick={load} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">Retry</button>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <Package size={32} className="mb-2 opacity-30" />
          <p className="text-sm">No batches found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['SO #', 'Client', 'Product', 'Order Qty', 'Due Date', 'Batch', 'FG Ready', 'Packed', 'Invoiced', 'Shipped', 'Batch Status', 'Stage Time Log', ''].map((h, i) => (
                  <th key={i} className={`px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap ${h === 'Order Qty' ? 'text-right' : ''} ${h === '' ? 'w-8' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => {
                const rep = group.representative;
                const ordered = rep.product.orderedQty || 0;
                const dtg = daysToGo(rep.dueDate);
                const rowSpan = group.batches.length;

                return group.batches.map((row, batchIdx) => {
                  const isFirst = batchIdx === 0;
                  const batchQty = row.fgQty > 0 ? row.fgQty : ordered;
                  const cov = ordered > 0 && batchQty > 0
                    ? Math.min(100, Math.round((batchQty / ordered) * 100))
                    : row.batch.coveragePct;

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${group.worstSla.overdue ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-orange-50/30'} ${
                        batchIdx < rowSpan - 1 ? 'border-b border-dashed border-gray-100' : 'border-b border-gray-100'
                      }`}
                    >
                      {/* SO-level cells — rendered once with rowSpan */}
                      {isFirst && (
                        <>
                          {/* SO # */}
                          <td className="px-3 py-2.5 whitespace-nowrap align-top" rowSpan={rowSpan}>
                            <p className="text-xs font-semibold text-gray-800">{rep.soNo}</p>
                            <p className="text-[10px] text-gray-400">{fmtDate(rep.soDate)}</p>
                          </td>

                          {/* Client */}
                          <td className="px-3 py-2.5 align-top max-w-[130px]" rowSpan={rowSpan}>
                            <p className="text-xs text-gray-800 truncate" title={rep.client.name}>{rep.client.name}</p>
                            {rep.client.code && <p className="text-[10px] text-gray-400 font-mono">{rep.client.code}</p>}
                          </td>

                          {/* Product */}
                          <td className="px-3 py-2.5 align-top max-w-[150px]" rowSpan={rowSpan}>
                            <p className="text-xs text-gray-800 leading-snug" title={rep.product.name}>{rep.product.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{rep.product.code}</p>
                          </td>

                          {/* Order Qty */}
                          <td className="px-3 py-2.5 whitespace-nowrap text-right align-top" rowSpan={rowSpan}>
                            <span className="text-xs tabular-nums font-semibold text-gray-800">{fmtNum(ordered)}</span>
                          </td>

                          {/* Due Date */}
                          <td className="px-3 py-2.5 whitespace-nowrap align-top" rowSpan={rowSpan}>
                            {group.worstSla.overdue ? (
                              <>
                                <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                                  <AlertCircle size={11} className="shrink-0" />{fmtDate(rep.dueDate)}
                                </p>
                                <p className="text-[10px] text-red-500 font-semibold">{group.worstSla.daysOverdue}d overdue</p>
                              </>
                            ) : group.worstSla.approaching ? (
                              <>
                                <p className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                                  <Clock size={11} className="shrink-0" />{fmtDate(rep.dueDate)}
                                </p>
                                <p className="text-[10px] text-amber-600">{dtg != null ? `${dtg}d to go` : ''}</p>
                              </>
                            ) : (
                              <>
                                <p className="text-xs text-gray-700">{fmtDate(rep.dueDate)}</p>
                                {dtg != null && dtg >= 0 && <p className="text-[10px] text-gray-400">{dtg}d to go</p>}
                              </>
                            )}
                          </td>
                        </>
                      )}

                      {/* Batch-level cells — repeated per batch */}

                      {/* Batch Planning */}
                      <td className="px-3 py-2.5 align-top min-w-[130px]">
                        <p className="text-xs font-semibold text-gray-700">
                          {row.batch.batchNo || row.batch.bprNo || <span className="italic text-gray-400 font-normal">Pending</span>}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block w-10 h-1 rounded-full bg-gray-100 overflow-hidden shrink-0">
                            <span className="block h-full rounded-full bg-blue-400" style={{ width: `${Math.min(100, cov)}%` }} />
                          </span>
                          <span className="text-[9px] text-gray-400 whitespace-nowrap">
                            {fmtNum(row.batch.plannedQty)} / {fmtNum(ordered)} · {cov}% cov
                          </span>
                        </div>
                        {row.batch.bmrNo && <p className="text-[9px] text-gray-400 mt-0.5">BMR {row.batch.bmrNo}</p>}
                      </td>

                      {/* FG / Packed / Invoiced / Shipped */}
                      <td className="px-3 py-2.5 whitespace-nowrap align-top"><QtyCell value={row.fgQty} denom={batchQty} color="bg-orange-400" /></td>
                      <td className="px-3 py-2.5 whitespace-nowrap align-top"><QtyCell value={row.packedQty} denom={batchQty} color="bg-amber-400" /></td>
                      <td className="px-3 py-2.5 whitespace-nowrap align-top"><QtyCell value={row.invoicedQty} denom={batchQty} color="bg-purple-400" /></td>
                      <td className="px-3 py-2.5 whitespace-nowrap align-top"><QtyCell value={row.shippedQty} denom={batchQty} color="bg-teal-400" /></td>

                      {/* Batch Status */}
                      <td className="px-3 py-2.5 whitespace-nowrap align-top">
                        <StageBadge stage={row.batch.stage} label={row.batch.stageLabel} />
                      </td>

                      {/* Stage Time Log */}
                      <td className="px-3 py-2.5 align-top">
                        <StageTimeLog logs={row.stageLogs} />
                      </td>

                      {/* History & Comments */}
                      <td className="px-3 py-2.5 align-top">
                        <button
                          onClick={() => setCommentTarget({ id: row.id, label: `${row.batch.batchNo || row.batch.bprNo || 'Batch'} · ${row.soNo}` })}
                          className="relative p-1.5 rounded-lg hover:bg-orange-100 text-gray-400 hover:text-orange-600 transition-colors"
                          title="History & comments"
                        >
                          <MessageSquare size={14} />
                          {row.commentCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                              {row.commentCount > 9 ? '9+' : row.commentCount}
                            </span>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Comments / history panel (per batch) */}
      {commentTarget && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setCommentTarget(null)} />
          <CommentsPanel
            entityType="batch"
            entityId={commentTarget.id}
            entityLabel={commentTarget.label}
            onClose={() => setCommentTarget(null)}
          />
        </>
      )}
    </>
  );
};
