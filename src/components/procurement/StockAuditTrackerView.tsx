/**
 * Stock Audit Tracker — Procurement spec View 4 (§6).
 * Audit requests raised from PR rows (§3B) land here. Derived from the PR
 * stock-check data already persisted (no new backend): status maps
 * REQUESTED → AUDITED → UPDATED. Linked PR opens the PR Edit popup.
 * Tool-native light styling.
 */
import React, { useMemo, useState } from 'react';
import { Search, PackageSearch } from 'lucide-react';
import type { ProcurementRequest } from '../../types/procurement.types';
import {
  AUDIT_STATUS_CONFIG, SLA_DEFAULTS, SLA_LEVEL_CLASSES, SLA_LEVEL_PREFIX,
  slaLevelFromDaysOpen, type AuditStatus,
} from '../../constants/procurement';

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

function deriveAuditStatus(pr: ProcurementRequest): AuditStatus {
  const s = String(pr.stockCheckStatus ?? '').toLowerCase();
  if (s === 'completed') {
    const notes = String(pr.stockCheckNotes ?? '').toLowerCase();
    if (notes.includes('approved') || notes.includes('reconcil') || notes.includes('updated')) return 'updated';
    return 'audited';
  }
  return 'requested'; // requested / assigned / in progress
}

interface AuditRow {
  pr: ProcurementRequest;
  auditId: string;
  reqDate: string | null;
  itemName: string;
  itemCode: string;
  warehouse: string;
  sih: number | null;
  status: AuditStatus;
  daysOpen: number;
}

function buildRow(pr: ProcurementRequest): AuditRow {
  const item = pr.itemDetails?.[0] ?? null;
  const reqDate = pr.stockCheckDueDate ?? pr.createdDate ?? null;
  return {
    pr,
    auditId: `AUD-${String(pr.id).padStart(4, '0')}`,
    reqDate,
    itemName: item?.itemName ?? '—',
    itemCode: item?.itemCode ?? '',
    warehouse: pr.stockCheckAssignedTo || '—',
    sih: pr.stockSummary ? pr.stockSummary.stockInHand : null,
    status: deriveAuditStatus(pr),
    daysOpen: daysSince(reqDate),
  };
}

function StatusPill({ status }: { status: AuditStatus }) {
  const c = AUDIT_STATUS_CONFIG[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${c.text} ${c.bg} ${c.border}`}>{c.label}</span>;
}

export interface StockAuditTrackerViewProps {
  requests: ProcurementRequest[];
  onOpenPr: (pr: ProcurementRequest) => void;
}

export const StockAuditTrackerView: React.FC<StockAuditTrackerViewProps> = ({ requests, onOpenPr }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AuditStatus>('all');
  const [whFilter, setWhFilter] = useState('all');

  const allRows = useMemo(
    () => requests.filter((r) => !!r.stockCheckStatus).map(buildRow),
    [requests],
  );

  const warehouses = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.warehouse).filter((w) => w && w !== '—'))).sort(),
    [allRows],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = allRows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (whFilter !== 'all' && r.warehouse !== whFilter) return false;
      if (q && !`${r.auditId} ${r.itemName} ${r.itemCode} ${r.pr.code} ${r.warehouse}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const rank: Record<AuditStatus, number> = { requested: 0, re_audit: 0, audited: 1, updated: 2, terminated: 3 };
    out.sort((a, b) => (rank[a.status] - rank[b.status]) || (b.daysOpen - a.daysOpen));
    return out;
  }, [allRows, search, statusFilter, whFilter]);

  const requested = allRows.filter((r) => r.status === 'requested').length;
  const awaiting = allRows.filter((r) => r.status === 'audited').length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="text-xs text-slate-600">
          📦 <b className="text-slate-800">Stock Audit Tracker</b> · {allRows.length} audits · {requested} requested · {awaiting} awaiting reconciliation
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audit ID, item, PR, warehouse…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
          <option value="all">All Statuses</option>
          <option value="requested">Requested</option>
          <option value="audited">Audited</option>
          <option value="updated">Updated</option>
        </select>
        <select value={whFilter} onChange={(e) => setWhFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
          <option value="all">All Warehouses</option>
          {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400 text-sm">
          <PackageSearch size={30} className="mx-auto mb-2 opacity-30" />
          No stock audits yet — raise one from a PR row's 📦 Audit action.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Req Date', 'Audit ID', 'Item', 'WH Location', 'SIH (system)', 'Status', 'Linked PR', 'SLA'].map((h) => (
                  <th key={h} className={`px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap ${h === 'SIH (system)' ? 'text-center' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const slaLevel = slaLevelFromDaysOpen(r.daysOpen, SLA_DEFAULTS.auditDays);
                return (
                  <tr key={r.pr.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-700">{fmtDate(r.reqDate)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] font-semibold text-slate-800">{r.auditId}</td>
                    <td className="px-3 py-2.5 max-w-[170px]">
                      <p className="text-xs font-semibold text-slate-800 truncate" title={r.itemName}>{r.itemName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{r.itemCode}</p>
                    </td>
                    <td className="px-3 py-2.5 max-w-[140px]"><p className="text-xs text-slate-700 truncate" title={r.warehouse}>{r.warehouse}</p></td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-xs text-slate-700">{r.sih != null ? r.sih.toLocaleString('en-IN') : '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><StatusPill status={r.status} /></td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button onClick={() => onOpenPr(r.pr)} className="font-mono text-[11px] font-semibold text-blue-600 hover:underline decoration-dotted">{r.pr.code}</button>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`text-[11px] font-mono ${SLA_LEVEL_CLASSES[slaLevel]}`}>
                        {SLA_LEVEL_PREFIX[slaLevel]} {r.daysOpen}d open
                      </span>
                      <span className="text-[9.5px] text-slate-400 ml-1">/ {SLA_DEFAULTS.auditDays}d</span>
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
