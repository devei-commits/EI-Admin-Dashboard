import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, AlertCircle, Clock, MessageSquare, RefreshCw,
  Package, AlertTriangle, CheckCircle,
} from 'lucide-react';
import type { BatchDashboardRow, StageLogEntry } from '../../types/orderFulfillment';
import { fetchBatchesDashboard } from '../../services/fulfillment.service';
import { BATCH_STAGE_FILTER_OPTIONS } from '../../constants/orderFulfillment';
import { CommentsPanel } from './CommentsPanel';
import { ProcSectionHeader, ProcFilterBar, ProcThead } from '../procurement/ProcSection';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';

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
  PLANNING:    { bg: 'bg-surface-3',   text: 'text-ink-3',    border: 'border-border' },
  PROCUREMENT: { bg: 'bg-brand-soft',    text: 'text-brand',    border: 'border-brand-soft' },
  PRODUCTION:  { bg: 'bg-warn-soft',   text: 'text-warn',   border: 'border-[color:var(--st-amber-fg)]/30' },
  FG_READY:    { bg: 'bg-ok-soft', text: 'text-ok', border: 'border-[color:var(--st-green-fg)]/30' },
  PACKED:      { bg: 'bg-brand-soft',  text: 'text-brand',  border: 'border-brand-soft' },
  INVOICED:    { bg: 'bg-brand-soft',  text: 'text-brand',  border: 'border-brand-soft' },
  SHIPPED:     { bg: 'bg-brand-soft',    text: 'text-brand',    border: 'border-brand-soft' },
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
      <span className="inline-block w-12 h-1.5 rounded-full bg-surface-3 overflow-hidden shrink-0">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[11px] tabular-nums text-ink-2">{fmtNum(value)}</span>
    </div>
  );
}

/* ── Stage Time Log: one mini-row per stage (actual / committed) ──────────── */
function StageTimeLog({ logs }: { logs: StageLogEntry[] }) {
  if (!logs.length) return <span className="text-[10px] text-ink-4">—</span>;
  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      {logs.map((log) => {
        const committed = log.committedDays;
        const actual = log.actualDays;
        const pct = committed && committed > 0 && actual != null
          ? Math.min(100, Math.round((actual / committed) * 100))
          : actual != null ? 100 : 0;
        const barColor = log.slipped
          ? 'bg-err'
          : log.approaching
            ? 'bg-warn'
            : actual != null ? 'bg-ok' : 'bg-surface-3';
        const Icon = log.slipped ? AlertTriangle : log.completedAt != null ? CheckCircle : Clock;
        return (
          <div key={log.stage} className="grid items-center gap-1.5" style={{ gridTemplateColumns: '58px 1fr 56px' }}>
            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-ink-3 truncate" title={log.stageLabel}>
              <Icon size={8} className={`shrink-0 ${log.slipped ? 'text-err' : log.completedAt != null ? 'text-ok' : 'text-ink-4'}`} />
              {log.stageLabel}
            </span>
            <span className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <span className={`block h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </span>
            <span className={`text-[9px] font-mono text-right whitespace-nowrap ${log.slipped ? 'text-err font-bold' : 'text-ink-4'}`}>
              {actual != null ? `${actual}d` : '—'} / {committed != null ? `${committed}d` : '—'}
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
      <ProcSectionHeader
        icon={<Package className="w-[18px] h-[18px] text-brand" />}
        title="Products & Batches"
        stats={[
          { value: grouped.length, label: grouped.length === 1 ? 'product line' : 'product lines' },
          { value: totalBatches, label: totalBatches === 1 ? 'batch' : 'batches' },
          ...(overdueCount > 0 ? [{ value: overdueCount, label: 'overdue', tone: 'err' as const }] : []),
        ]}
      />

      {/* Filters */}
      <ProcFilterBar stack className="mb-4 mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" size={15} />
            <input
              type="text"
              placeholder="Search batch no, SO no, product…"
              aria-label="Search batch no, SO no, product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-brand text-sm bg-surface"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            aria-label="Filter by stage"
            className="px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-[color:var(--ring)] focus:border-brand"
          >
            {BATCH_STAGE_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 min-w-[220px]">
            <label className="text-xs text-ink-3 whitespace-nowrap shrink-0">Due before</label>
            <input type="date" value={dueBefore} onChange={(e) => setDueBefore(e.target.value)}
              aria-label="Due before"
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-[color:var(--ring)] focus:border-brand" />
          </div>
          <div className="flex items-center gap-3 ml-auto shrink-0">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)}
                className="w-4 h-4 rounded accent-[color:var(--accent)]" />
              <span className="text-sm text-ink-2 whitespace-nowrap">Flagged only</span>
            </label>
            <button onClick={load} title="Refresh" aria-label="Refresh" className="p-2 rounded-lg border border-border hover:bg-surface-3 text-ink-3">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-ink-3">
            {grouped.length} product line{grouped.length !== 1 ? 's' : ''}
            {totalBatches !== grouped.length && <span className="ml-1 text-ink-4">({totalBatches} batch{totalBatches !== 1 ? 'es' : ''})</span>}
            {overdueCount > 0 && <span className="ml-2 text-err font-semibold">{overdueCount} overdue</span>}
          </span>
          <button
            onClick={() => { setSearch(''); setStageFilter('all'); setFlaggedOnly(false); setDueBefore(''); }}
            className="text-xs text-ink-3 hover:text-ink underline"
          >
            Clear filters
          </button>
        </div>
      </ProcFilterBar>

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border border-border p-5">
          <TableSkeleton rows={8} cols={13} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : grouped.length === 0 ? (
        <EmptyState icon={<Package size={32} />} title="No batches found" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm text-left border-collapse">
            <ProcThead
              cols={['SO #', 'Client', 'Product', { label: 'Order Qty', align: 'right' }, 'Due Date', 'Batch', 'FG Ready', 'Packed', 'Invoiced', 'Shipped', 'Batch Status', 'Stage Time Log', '']}
            />
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
                      className={`transition-colors ${group.worstSla.overdue ? 'bg-err-soft/40 hover:bg-err-soft/60' : 'hover:bg-brand-soft/30'} ${
                        batchIdx < rowSpan - 1 ? 'border-b border-dashed border-hairline' : 'border-b border-hairline'
                      }`}
                    >
                      {/* SO-level cells — rendered once with rowSpan */}
                      {isFirst && (
                        <>
                          {/* SO # */}
                          <td className="px-3 py-2.5 whitespace-nowrap align-top" rowSpan={rowSpan}>
                            <p className="text-xs font-semibold text-ink">{rep.soNo}</p>
                            <p className="text-[10px] text-ink-4">{fmtDate(rep.soDate)}</p>
                          </td>

                          {/* Client */}
                          <td className="px-3 py-2.5 align-top max-w-[130px]" rowSpan={rowSpan}>
                            <p className="text-xs text-ink truncate" title={rep.client.name}>{rep.client.name}</p>
                            {rep.client.code && <p className="text-[10px] text-ink-4 font-mono">{rep.client.code}</p>}
                          </td>

                          {/* Product */}
                          <td className="px-3 py-2.5 align-top max-w-[150px]" rowSpan={rowSpan}>
                            <p className="text-xs text-ink leading-snug" title={rep.product.name}>{rep.product.name}</p>
                            <p className="text-[10px] text-ink-4 font-mono">{rep.product.code}</p>
                          </td>

                          {/* Order Qty */}
                          <td className="px-3 py-2.5 whitespace-nowrap text-right align-top" rowSpan={rowSpan}>
                            <span className="text-xs tabular-nums font-semibold text-ink">{fmtNum(ordered)}</span>
                          </td>

                          {/* Due Date */}
                          <td className="px-3 py-2.5 whitespace-nowrap align-top" rowSpan={rowSpan}>
                            {group.worstSla.overdue ? (
                              <>
                                <p className="text-xs font-bold text-err flex items-center gap-1">
                                  <AlertCircle size={11} className="shrink-0" />{fmtDate(rep.dueDate)}
                                </p>
                                <p className="text-[10px] text-err font-semibold">{group.worstSla.daysOverdue}d overdue</p>
                              </>
                            ) : group.worstSla.approaching ? (
                              <>
                                <p className="text-xs font-semibold text-warn flex items-center gap-1">
                                  <Clock size={11} className="shrink-0" />{fmtDate(rep.dueDate)}
                                </p>
                                <p className="text-[10px] text-warn">{dtg != null ? `${dtg}d to go` : ''}</p>
                              </>
                            ) : (
                              <>
                                <p className="text-xs text-ink-2">{fmtDate(rep.dueDate)}</p>
                                {dtg != null && dtg >= 0 && <p className="text-[10px] text-ink-4">{dtg}d to go</p>}
                              </>
                            )}
                          </td>
                        </>
                      )}

                      {/* Batch-level cells — repeated per batch */}

                      {/* Batch Planning */}
                      <td className="px-3 py-2.5 align-top min-w-[130px]">
                        <p className="text-xs font-semibold text-ink-2">
                          {row.batch.batchNo || row.batch.bprNo || <span className="italic text-ink-4 font-normal">Pending</span>}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block w-10 h-1 rounded-full bg-surface-3 overflow-hidden shrink-0">
                            <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, cov)}%` }} />
                          </span>
                          <span className="text-[9px] text-ink-4 whitespace-nowrap">
                            {fmtNum(row.batch.plannedQty)} / {fmtNum(ordered)} · {cov}% cov
                          </span>
                        </div>
                        {row.batch.bmrNo && <p className="text-[9px] text-ink-4 mt-0.5">BMR {row.batch.bmrNo}</p>}
                      </td>

                      {/* FG / Packed / Invoiced / Shipped */}
                      <td className="px-3 py-2.5 whitespace-nowrap align-top"><QtyCell value={row.fgQty} denom={batchQty} color="bg-brand" /></td>
                      <td className="px-3 py-2.5 whitespace-nowrap align-top"><QtyCell value={row.packedQty} denom={batchQty} color="bg-brand" /></td>
                      <td className="px-3 py-2.5 whitespace-nowrap align-top"><QtyCell value={row.invoicedQty} denom={batchQty} color="bg-brand" /></td>
                      <td className="px-3 py-2.5 whitespace-nowrap align-top"><QtyCell value={row.shippedQty} denom={batchQty} color="bg-brand" /></td>

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
                          className="relative p-1.5 rounded-lg hover:bg-brand-soft text-ink-4 hover:text-brand transition-colors"
                          title="History & comments"
                          aria-label="History & comments"
                        >
                          <MessageSquare size={14} />
                          {row.commentCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-brand text-white text-[8px] font-bold rounded-full flex items-center justify-center">
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
