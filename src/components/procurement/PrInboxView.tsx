/**
 * PR Inbox — Procurement Requests (Spec View 1, §3)
 * Single inbox for every PR needing Procurement action. Each row exposes the
 * four spec actions: ✏ Edit · 💬 Request Quote · 📦 Stock Audit · 🚚 Draft PO.
 * Expected-connecting-date and SLA are computed here from the existing PR data
 * (requested date + avg-actual-lead already resolved server-side).
 */
import React, { useMemo, useState } from 'react';
import { Search, Pencil, MessageSquare, PackageSearch, Truck, Plus, Download } from 'lucide-react';
import type { ProcurementRequest, ItemDetail } from '../../types/procurement.types';
import {
  PR_SOURCE_CONFIG, SLA_DEFAULTS, SLA_LEVEL_CLASSES, SLA_LEVEL_PREFIX,
  type PrSource, type SlaLevel,
} from '../../constants/procurement';
import { slaLevelFromDaysOpen, expectedVsNeedByLevel } from '../../lib/procurementSla';

// ─── Date helpers ────────────────────────────────────────────────────────────
function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
function fmtDate(d: string | null | undefined): string {
  const dt = parseDate(d);
  if (!dt) return '—';
  const day = String(dt.getDate()).padStart(2, '0');
  const mon = dt.toLocaleString('en-US', { month: 'short' });
  return `${day}-${mon}-${dt.getFullYear()}`;
}
function addDays(d: string | null | undefined, days: number | null | undefined): string | null {
  const dt = parseDate(d);
  if (!dt || days == null || Number.isNaN(days)) return null;
  dt.setDate(dt.getDate() + Math.round(days));
  return dt.toISOString();
}
function daysSince(d: string | null | undefined): number {
  const dt = parseDate(d);
  if (!dt) return 0;
  dt.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((t.getTime() - dt.getTime()) / 86_400_000));
}
function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// ─── Derived row model ───────────────────────────────────────────────────────
interface InboxRow {
  req: ProcurementRequest;
  requestedDate: string | null;
  prNumber: string;
  source: PrSource;
  primary: ItemDetail | null;
  extraItems: number;
  vendorName: string;
  reqQty: number | null;
  unit: string;
  moq: number | null;
  rop: number | null;
  sih: number | null;
  leadDays: number | null;
  expectedConnecting: string | null;
  needBy: string | null;
  daysOpen: number;
  slaLevel: SlaLevel;
  belowMoq: boolean;
}

function deriveSource(req: ProcurementRequest): PrSource {
  const s = String(req.source ?? '').toLowerCase();
  if (s.includes('proc')) return 'procurement';
  if (s.includes('plan')) return 'planning';
  if (req.planningProductCode || req.planningSoNumber || req.batchId) return 'planning';
  return 'procurement';
}

function buildRow(req: ProcurementRequest): InboxRow {
  const items = req.itemDetails ?? [];
  const primary = items[0] ?? null;
  const requestedDate = req.createdDate ?? null;
  const leadDays = primary?.leadTimeDays ?? null;
  const reqQty = primary ? primary.reqQty : null;
  const moq = primary ? toNum(primary.moq) : null;
  const rop = primary ? (toNum((primary as Record<string, unknown>).reorder_point) ?? toNum((primary as Record<string, unknown>).rop)) : null;
  const sih = req.stockSummary ? req.stockSummary.stockInHand : null;
  const daysOpen = daysSince(requestedDate ?? req.dueDate);
  return {
    req,
    requestedDate,
    prNumber: req.code,
    source: deriveSource(req),
    primary,
    extraItems: Math.max(0, items.length - 1),
    vendorName: req.preferredVendor || '—',
    reqQty,
    unit: primary?.unit ?? '',
    moq,
    rop,
    sih,
    leadDays,
    expectedConnecting: addDays(requestedDate, leadDays),
    needBy: req.dueDate ?? null,
    daysOpen,
    slaLevel: slaLevelFromDaysOpen(daysOpen, SLA_DEFAULTS.procurementDays),
    belowMoq: reqQty != null && moq != null && reqQty < moq,
  };
}

const SLA_RANK: Record<SlaLevel, number> = { bad: 0, warn: 1, ok: 2 };

// ─── Small presentational bits ───────────────────────────────────────────────
function SourcePill({ source }: { source: PrSource }) {
  const cfg = PR_SOURCE_CONFIG[source];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9.5px] font-semibold ${cfg.text} ${cfg.bg} ${cfg.border}`}>
      <span>{cfg.emoji}</span>{cfg.label}
    </span>
  );
}

function ActionBtn({ icon: Icon, label, onClick, tone = 'default' }: {
  icon: typeof Pencil; label: string; onClick: () => void; tone?: 'default' | 'primary';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10.5px] font-semibold transition-colors ${
        tone === 'primary'
          ? 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100'
          : 'border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100'
      }`}
    >
      <Icon size={12} />{label}
    </button>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────
export interface PrInboxViewProps {
  requests: ProcurementRequest[];
  onEdit: (req: ProcurementRequest) => void;
  onRequestQuote: (req: ProcurementRequest) => void;
  onStockAudit: (req: ProcurementRequest) => void;
  onDraftPO: (req: ProcurementRequest) => void;
  onNewPr?: () => void;
  onExport?: () => void;
}

type SourceFilter = 'all' | PrSource;
type SlaFilter = 'all' | SlaLevel;
type TypeFilter = 'all' | 'RM' | 'PM';

export const PrInboxView: React.FC<PrInboxViewProps> = ({
  requests, onEdit, onRequestQuote, onStockAudit, onDraftPO, onNewPr, onExport,
}) => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');

  const allRows = useMemo(() => requests.map(buildRow), [requests]);

  const vendors = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.vendorName).filter((v) => v && v !== '—'))).sort(),
    [allRows],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = allRows.filter((r) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (slaFilter !== 'all' && r.slaLevel !== slaFilter) return false;
      if (typeFilter !== 'all' && (r.primary?.type ?? r.req.type) !== typeFilter) return false;
      if (vendorFilter !== 'all' && r.vendorName !== vendorFilter) return false;
      if (q) {
        const hay = `${r.prNumber} ${r.primary?.itemName ?? ''} ${r.primary?.itemCode ?? ''} ${r.vendorName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // Default sort: SLA ascending (most-overdue first), then expected-connecting asc.
    filtered.sort((a, b) => {
      if (SLA_RANK[a.slaLevel] !== SLA_RANK[b.slaLevel]) return SLA_RANK[a.slaLevel] - SLA_RANK[b.slaLevel];
      if (a.daysOpen !== b.daysOpen) return b.daysOpen - a.daysOpen;
      const ea = a.expectedConnecting ?? '9999';
      const eb = b.expectedConnecting ?? '9999';
      return ea < eb ? -1 : ea > eb ? 1 : 0;
    });
    return filtered;
  }, [allRows, search, sourceFilter, slaFilter, typeFilter, vendorFilter]);

  const breached = allRows.filter((r) => r.slaLevel === 'bad').length;
  const fromPlanning = allRows.filter((r) => r.source === 'planning').length;
  const fromProcurement = allRows.length - fromPlanning;

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
      active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    }`;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="text-xs text-slate-600">
          📋 <b className="text-slate-800">Procurement Requests</b> · {allRows.length} open
          {breached > 0 && <span className="ml-2 text-red-600 font-semibold">🚩 {breached} SLA-breached</span>}
          <span className="ml-2 text-slate-400">· {fromPlanning} from Planning · {fromProcurement} raised here</span>
        </div>
        <div className="flex items-center gap-2">
          {onNewPr && (
            <button onClick={onNewPr} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700">
              <Plus size={14} /> New PR
            </button>
          )}
          <button onClick={onExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PR #, item, vendor…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
            <option value="all">All Vendors</option>
            {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Source</span>
            {(['all', 'planning', 'procurement'] as SourceFilter[]).map((s) => (
              <button key={s} onClick={() => setSourceFilter(s)} className={chip(sourceFilter === s)}>
                {s === 'all' ? 'All' : PR_SOURCE_CONFIG[s].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase">SLA</span>
            {([['all', 'All'], ['ok', 'OK'], ['warn', 'Approaching'], ['bad', 'Breached']] as [SlaFilter, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setSlaFilter(k)} className={chip(slaFilter === k)}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Type</span>
            {(['all', 'RM', 'PM'] as TypeFilter[]).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)} className={chip(typeFilter === t)}>{t === 'all' ? 'All' : t}</button>
            ))}
          </div>
          <button
            onClick={() => { setSearch(''); setSourceFilter('all'); setSlaFilter('all'); setTypeFilter('all'); setVendorFilter('all'); }}
            className="ml-auto text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400 text-sm">No procurement requests match these filters.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Req Date', 'PR #', 'Item', 'Vendor', 'Req Qty', 'MOQ', 'ROP', 'Expected Connecting', 'SLA', 'Actions'].map((h) => (
                  <th key={h} className={`px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap ${['Req Qty', 'MOQ', 'ROP'].includes(h) ? 'text-center' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const expLevel = expectedVsNeedByLevel(r.expectedConnecting, r.needBy);
                return (
                  <tr key={r.req.id} className={`hover:bg-blue-50/30 transition-colors ${r.slaLevel === 'bad' ? 'bg-red-50/40' : ''}`}>
                    {/* Req Date */}
                    <td className="px-3 py-2.5 whitespace-nowrap align-top text-xs text-slate-700">{fmtDate(r.requestedDate)}</td>

                    {/* PR # + source */}
                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                      <button onClick={() => onEdit(r.req)} className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline decoration-dotted">{r.prNumber}</button>
                      <div className="mt-1"><SourcePill source={r.source} /></div>
                    </td>

                    {/* Item */}
                    <td className="px-3 py-2.5 align-top max-w-[180px]">
                      {r.primary ? (
                        <>
                          <p className="text-xs font-semibold text-slate-800 truncate" title={r.primary.itemName}>{r.primary.itemName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{r.primary.itemCode}{r.extraItems > 0 ? ` +${r.extraItems} more` : ''}</p>
                        </>
                      ) : <span className="text-[10px] text-slate-400">—</span>}
                    </td>

                    {/* Vendor */}
                    <td className="px-3 py-2.5 align-top max-w-[140px]">
                      <p className="text-xs text-slate-700 truncate" title={r.vendorName}>{r.vendorName}</p>
                    </td>

                    {/* Req Qty */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-center align-top">
                      <span className="text-xs tabular-nums text-slate-800">{r.reqQty != null ? r.reqQty.toLocaleString('en-IN') : '—'}{r.unit ? ` ${r.unit}` : ''}</span>
                    </td>

                    {/* MOQ */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-center align-top">
                      {r.moq != null ? (
                        <span className={`text-xs tabular-nums ${r.belowMoq ? 'inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold' : 'text-slate-600'}`}>
                          {r.moq.toLocaleString('en-IN')}{r.unit ? ` ${r.unit}` : ''}
                        </span>
                      ) : <span className="text-[10px] text-slate-400">—</span>}
                    </td>

                    {/* ROP */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-center align-top">
                      <span className="text-xs tabular-nums text-slate-600" title={r.sih != null ? `current SIH ${r.sih} / ROP ${r.rop ?? '—'}` : undefined}>
                        {r.rop != null ? r.rop.toLocaleString('en-IN') : '—'}
                      </span>
                    </td>

                    {/* Expected Connecting */}
                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                      <p className={`text-xs font-mono ${SLA_LEVEL_CLASSES[expLevel]}`}>
                        {expLevel === 'bad' && '🚩 '}{fmtDate(r.expectedConnecting)}
                      </p>
                      <p className="text-[9.5px] text-slate-400">
                        {r.leadDays != null ? `${r.leadDays}d lead` : 'no lead'}
                        {r.needBy ? ` · need-by ${fmtDate(r.needBy)}` : ''}
                      </p>
                    </td>

                    {/* SLA */}
                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                      <span className={`text-xs font-mono ${SLA_LEVEL_CLASSES[r.slaLevel]}`}>
                        {SLA_LEVEL_PREFIX[r.slaLevel]} {r.daysOpen}d open
                      </span>
                      <p className="text-[9.5px] text-slate-400">committed {SLA_DEFAULTS.procurementDays}d</p>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        <ActionBtn icon={Pencil} label="Edit" onClick={() => onEdit(r.req)} />
                        <ActionBtn icon={MessageSquare} label="Quote" onClick={() => onRequestQuote(r.req)} />
                        <ActionBtn icon={PackageSearch} label="Audit" onClick={() => onStockAudit(r.req)} />
                        <ActionBtn icon={Truck} label="Draft PO" tone="primary" onClick={() => onDraftPO(r.req)} />
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
