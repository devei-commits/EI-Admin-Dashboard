/**
 * Stock Audit Tracker — Procurement spec View 4 (§5).
 * Uses buildInventoryAuditLines for rich audit rows; row click opens detail modal.
 */
import React, { useMemo, useState } from 'react';
import { Search, PackageSearch } from 'lucide-react';
import type { ProcurementRequest } from '../../types/procurement.types';
import type { InventoryAuditLine } from '../../lib/inventoryAuditLines';
import { buildInventoryAuditLines } from '../../lib/inventoryAuditLines';
import { parseStockCheckNotes } from '../../lib/stockCheckNotes';
import {
  AUDIT_STATUS_CONFIG, SLA_DEFAULTS, SLA_LEVEL_CLASSES, SLA_LEVEL_PREFIX,
  type AuditStatus,
} from '../../constants/procurement';
import { auditSlaLevel } from '../../lib/procurementSla';

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

function deriveAuditStatus(line: InventoryAuditLine, pr: ProcurementRequest | undefined): AuditStatus {
  const notes = parseStockCheckNotes(pr?.stockCheckNotes);
  if (notes && (notes as { terminated?: boolean }).terminated) return 'terminated';
  const s = String(line.stockCheckStatus ?? '').toLowerCase();
  if (line.gapApproved || String(line.uiStatus).toLowerCase().includes('gap approved')) return 'updated';
  if (s === 'completed') {
    const rawNotes = String(pr?.stockCheckNotes ?? '').toLowerCase();
    if (rawNotes.includes('approved') || rawNotes.includes('reconcil') || rawNotes.includes('updated')) return 'updated';
    return 'audited';
  }
  if (s === 'cancelled') return 'terminated';
  if (notes && (notes as { reAuditComment?: string }).reAuditComment) return 're_audit';
  return 'requested';
}

function StatusPill({ status }: { status: AuditStatus }) {
  const c = AUDIT_STATUS_CONFIG[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${c.text} ${c.bg} ${c.border}`}>{c.label}</span>;
}

export interface StockAuditTrackerViewProps {
  requests: ProcurementRequest[];
  onOpenPr: (pr: ProcurementRequest) => void;
  onOpenAudit: (line: InventoryAuditLine) => void;
}

export const StockAuditTrackerView: React.FC<StockAuditTrackerViewProps> = ({
  requests,
  onOpenPr,
  onOpenAudit,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AuditStatus>('all');
  const [whFilter, setWhFilter] = useState('all');

  const auditLines = useMemo(() => buildInventoryAuditLines(requests), [requests]);
  const reqById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);

  const warehouses = useMemo(
    () => Array.from(new Set(auditLines.map((l) => l.location).filter(Boolean))).sort(),
    [auditLines],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = auditLines.map((line) => {
      const pr = reqById.get(line.requestId);
      const status = deriveAuditStatus(line, pr);
      const reqDate = line.requestedAt || line.stockCheckDueDate || pr?.createdDate || null;
      return { line, pr, status, reqDate, daysOpen: daysSince(reqDate) };
    }).filter(({ line, status, reqDate, pr }) => {
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (whFilter !== 'all' && line.location !== whFilter) return false;
      if (q && !`${line.auditRef} ${line.itemName} ${line.itemCode} ${line.requestCode} ${line.location}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const rank: Record<AuditStatus, number> = { requested: 0, re_audit: 0, audited: 1, updated: 2, terminated: 3 };
    out.sort((a, b) => (rank[a.status] - rank[b.status]) || (b.daysOpen - a.daysOpen));
    return out;
  }, [auditLines, reqById, search, statusFilter, whFilter]);

  const requested = auditLines.filter((l) => deriveAuditStatus(l, reqById.get(l.requestId)) === 'requested').length;
  const awaiting = auditLines.filter((l) => deriveAuditStatus(l, reqById.get(l.requestId)) === 'audited').length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="text-xs text-slate-600">
          📦 <b className="text-slate-800">Stock Audit Tracker</b> · {auditLines.length} audits · {requested} requested · {awaiting} awaiting reconciliation
        </div>
      </div>

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
          <option value="terminated">Terminated</option>
        </select>
        <select value={whFilter} onChange={(e) => setWhFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
          <option value="all">All Warehouses</option>
          {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

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
              {rows.map(({ line, pr, status, reqDate, daysOpen }) => {
                const slaLevel = auditSlaLevel(daysOpen);
                return (
                  <tr
                    key={line.lineKey}
                    className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                    onClick={() => onOpenAudit(line)}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-700">{fmtDate(reqDate)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] font-semibold text-blue-700 hover:underline">{line.auditRef}</td>
                    <td className="px-3 py-2.5 max-w-[170px]">
                      <p className="text-xs font-semibold text-slate-800 truncate" title={line.itemName}>{line.itemName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{line.itemCode}</p>
                    </td>
                    <td className="px-3 py-2.5 max-w-[140px]"><p className="text-xs text-slate-700 truncate" title={line.location}>{line.location}</p></td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-xs text-slate-700">{line.systemQty != null ? line.systemQty.toLocaleString('en-IN') : '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><StatusPill status={status} /></td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {pr ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onOpenPr(pr); }}
                          className="font-mono text-[11px] font-semibold text-blue-600 hover:underline decoration-dotted"
                        >
                          {line.requestCode}
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-500">{line.requestCode}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`text-[11px] font-mono ${SLA_LEVEL_CLASSES[slaLevel]}`}>
                        {SLA_LEVEL_PREFIX[slaLevel]} {daysOpen}d open
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
