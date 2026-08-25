/**
 * PR Inbox — Procurement Requests (Spec View 1, §3)
 * Single inbox for every PR needing Procurement action. Each row exposes the
 * four spec actions: ✏ Edit · 💬 Request Quote · 📦 Stock Audit · 🚚 Draft PO.
 * Expected-connecting-date and SLA are computed here from the existing PR data
 * (requested date + avg-actual-lead already resolved server-side).
 */
import React, { useMemo, useState } from 'react';
import { Pencil, MessageSquare, PackageSearch, Truck, Plus, Download, Trash2 } from 'lucide-react';
import { ClipboardText, Flag } from '@phosphor-icons/react';
import type { ProcurementRequest, ItemDetail } from '../../types/procurement.types';
import {
  PR_SOURCE_CONFIG, SLA_DEFAULTS, SLA_LEVEL_CLASSES, SLA_LEVEL_PREFIX,
  type PrSource, type SlaLevel,
} from '../../constants/procurement';
import { slaLevelFromDaysOpen, expectedVsNeedByLevel } from '../../lib/procurementSla';
import { ProcSectionHeader, ProcTabs, ProcFilterBar, ProcSearch, procSelectClass, ProcTableCard, ProcEmpty, procChipClass } from './ProcSection';
import { SortableTableTh } from '../ui/SortableTableTh';
import RecordDetailModal, { type DetailSection } from '../ui/RecordDetailModal';

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
  /** PR-created-date + vendor lead time — an estimate of arrival if ordered right now, used only to
      flag risk of missing needBy (see expLevel below). Not shown as the headline date. */
  estimatedArrivalIfOrderedNow: string | null;
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
    // "Expected Connecting" is the date Planning actually expects/needs this by (from the release),
    // not a re-derived guess — it previously computed createdDate + leadDays, which for a fresh,
    // not-yet-quoted PR with no lead time on file just showed "today", regardless of when the
    // requirement is really needed.
    expectedConnecting: req.dueDate ?? null,
    estimatedArrivalIfOrderedNow: addDays(requestedDate, leadDays),
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
      {cfg.label}
    </span>
  );
}

function ActionBtn({ icon: Icon, label, onClick, tone = 'default' }: {
  icon: typeof Pencil; label: string; onClick: () => void; tone?: 'default' | 'primary' | 'danger';
}) {
  const toneClass =
    tone === 'primary'
      ? 'border-brand-soft text-brand bg-brand-soft hover:bg-brand-soft-2'
      : tone === 'danger'
        ? 'border-[color:var(--st-red-fg)]/30 text-err bg-surface hover:bg-err-soft'
        : 'border-border text-ink-3 bg-surface-3 hover:bg-surface-2';
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={label}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10.5px] font-semibold transition-colors ${toneClass}`}
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
  onDelete?: (req: ProcurementRequest) => void;
  onNewPr?: () => void;
  onExport?: () => void;
}

type SourceFilter = 'all' | PrSource;
type SlaFilter = 'all' | SlaLevel;
type TypeFilter = 'all' | 'RM' | 'PM';
type PrTab = 'active' | 'history';
type PrSortKey = 'date' | 'pr' | 'item' | 'vendor' | 'reqQty' | 'moq' | 'rop' | 'expectedConnecting' | 'sla';
type SortDir = 'asc' | 'desc';

/** null-safe compare: nulls always sort last regardless of direction. */
function cmpNullable(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}
function cmpStr(a: string, b: string): number {
  return a.localeCompare(b);
}
function cmpDateStr(a: string | null, b: string | null): number {
  const ea = a ?? '9999';
  const eb = b ?? '9999';
  return ea < eb ? -1 : ea > eb ? 1 : 0;
}

/** Active = still in the request queue (New/Quoted). History = released to a Draft PO or beyond. */
const PR_ACTIVE_STATUSES = new Set(['New', 'Quoted']);
function prIsActive(status: string | null | undefined): boolean {
  return PR_ACTIVE_STATUSES.has(String(status ?? '').trim());
}

export const PrInboxView: React.FC<PrInboxViewProps> = ({
  requests, onEdit, onRequestQuote, onStockAudit, onDraftPO, onDelete, onNewPr, onExport,
}) => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<PrTab>('active');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [detailRow, setDetailRow] = useState<InboxRow | null>(null);
  // null = default SLA-priority sort (most urgent first); set once a column header is clicked.
  const [sortBy, setSortBy] = useState<PrSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleHeaderSort = (key: PrSortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
  };

  const allRows = useMemo(() => requests.map(buildRow), [requests]);
  const activeCount = useMemo(() => allRows.filter((r) => prIsActive(r.req.status)).length, [allRows]);
  const historyCount = allRows.length - activeCount;

  const vendors = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.vendorName).filter((v) => v && v !== '—'))).sort(),
    [allRows],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = allRows.filter((r) => {
      if (tab === 'active' && !prIsActive(r.req.status)) return false;
      if (tab === 'history' && prIsActive(r.req.status)) return false;
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
    if (sortBy == null) {
      // Default sort: SLA ascending (most-overdue first), then expected-connecting asc.
      filtered.sort((a, b) => {
        if (SLA_RANK[a.slaLevel] !== SLA_RANK[b.slaLevel]) return SLA_RANK[a.slaLevel] - SLA_RANK[b.slaLevel];
        if (a.daysOpen !== b.daysOpen) return b.daysOpen - a.daysOpen;
        return cmpDateStr(a.expectedConnecting, b.expectedConnecting);
      });
      return filtered;
    }
    const dirMul = sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      let d = 0;
      switch (sortBy) {
        case 'date': d = cmpDateStr(a.requestedDate, b.requestedDate); break;
        case 'pr': d = cmpStr(a.prNumber, b.prNumber); break;
        case 'item': d = cmpStr(a.primary?.itemName ?? '', b.primary?.itemName ?? ''); break;
        case 'vendor': d = cmpStr(a.vendorName, b.vendorName); break;
        case 'reqQty': d = cmpNullable(a.reqQty, b.reqQty); break;
        case 'moq': d = cmpNullable(a.moq, b.moq); break;
        case 'rop': d = cmpNullable(a.rop, b.rop); break;
        case 'expectedConnecting': d = cmpDateStr(a.expectedConnecting, b.expectedConnecting); break;
        case 'sla': d = SLA_RANK[a.slaLevel] - SLA_RANK[b.slaLevel] || b.daysOpen - a.daysOpen; break;
      }
      if (d === 0) d = cmpStr(a.prNumber, b.prNumber);
      return d * dirMul;
    });
    return filtered;
  }, [allRows, tab, search, sourceFilter, slaFilter, typeFilter, vendorFilter, sortBy, sortDir]);

  const breached = allRows.filter((r) => r.slaLevel === 'bad').length;
  const fromPlanning = allRows.filter((r) => r.source === 'planning').length;
  const fromProcurement = allRows.length - fromPlanning;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <ProcSectionHeader
        icon={<ClipboardText className="w-4 h-4 shrink-0" />}
        title="Procurement Requests"
        stats={[
          { value: allRows.length, label: 'open' },
          { value: breached, label: 'SLA-breached', tone: 'err', hidden: breached === 0 },
          { value: fromPlanning, label: 'from Planning' },
          { value: fromProcurement, label: 'raised here' },
        ]}
        actions={
          <>
            {onNewPr && (
              <button onClick={onNewPr} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-press">
                <Plus size={14} /> New PR
              </button>
            )}
            <button onClick={onExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-ink-3 bg-surface hover:bg-surface-2">
              <Download size={14} /> Export
            </button>
          </>
        }
      />

      {/* Active vs History tabs — History holds PRs already released to a Draft PO. */}
      <ProcTabs
        tabs={[
          { key: 'active', label: 'Active', count: activeCount },
          { key: 'history', label: 'History', count: historyCount },
        ]}
        value={tab}
        onChange={(t) => setTab(t as PrTab)}
        trailing={tab === 'history' ? <span className="text-[11px] text-ink-4">Released to Draft PO or later — read reference.</span> : undefined}
      />

      {/* Filters */}
      <ProcFilterBar stack>
        <div className="flex flex-wrap items-center gap-2">
          <ProcSearch value={search} onChange={setSearch} placeholder="Search PR #, item, vendor…" />
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
            aria-label="Filter by vendor"
            className={procSelectClass}>
            <option value="all">All Vendors</option>
            {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-ink-4 uppercase">Source</span>
            {(['all', 'planning', 'procurement'] as SourceFilter[]).map((s) => (
              <button key={s} onClick={() => setSourceFilter(s)} className={procChipClass(sourceFilter === s)}>
                {s === 'all' ? 'All' : PR_SOURCE_CONFIG[s].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-ink-4 uppercase">SLA</span>
            {([['all', 'All'], ['ok', 'OK'], ['warn', 'Approaching'], ['bad', 'Breached']] as [SlaFilter, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setSlaFilter(k)} className={procChipClass(slaFilter === k)}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-ink-4 uppercase">Type</span>
            {(['all', 'RM', 'PM'] as TypeFilter[]).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)} className={procChipClass(typeFilter === t)}>{t === 'all' ? 'All' : t}</button>
            ))}
          </div>
          <button
            onClick={() => { setSearch(''); setSourceFilter('all'); setSlaFilter('all'); setTypeFilter('all'); setVendorFilter('all'); }}
            className="ml-auto text-xs text-ink-3 hover:text-ink underline"
          >
            Clear
          </button>
        </div>
      </ProcFilterBar>

      {/* Table */}
      {rows.length === 0 ? (
        <ProcEmpty>No procurement requests match these filters.</ProcEmpty>
      ) : (
        <ProcTableCard>
            <thead className="sticky top-0 z-20">
              <tr className="bg-surface-2 border-b border-border [&_th]:bg-surface-2">
                <SortableTableTh label="Req Date" column="date" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} />
                <SortableTableTh label="PR #" column="pr" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} />
                <SortableTableTh label="Item" column="item" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} />
                <SortableTableTh label="Vendor" column="vendor" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} />
                <SortableTableTh label="Req Qty" column="reqQty" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} align="right" />
                <SortableTableTh label="MOQ" column="moq" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} align="right" />
                <SortableTableTh label="ROP" column="rop" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} align="right" />
                <SortableTableTh label="Expected Connecting" column="expectedConnecting" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} />
                <SortableTableTh label="SLA" column="sla" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} />
                <th scope="col" className="px-3 py-2 text-[10px] font-bold text-ink-3 uppercase tracking-wide whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((r) => {
                const expLevel = expectedVsNeedByLevel(r.estimatedArrivalIfOrderedNow, r.needBy);
                return (
                  <tr key={r.req.id} onClick={() => setDetailRow(r)} className={`hover:bg-brand-soft transition-colors cursor-pointer ${r.slaLevel === 'bad' ? 'bg-err-soft' : ''}`}>
                    {/* Req Date */}
                    <td className="px-3 py-2.5 whitespace-nowrap align-top text-xs text-ink-2">{fmtDate(r.requestedDate)}</td>

                    {/* PR # + source */}
                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                      <button onClick={(e) => { e.stopPropagation(); onEdit(r.req); }} className="font-mono text-xs font-semibold text-brand hover:text-brand hover:underline decoration-dotted">{r.prNumber}</button>
                      <div className="mt-1"><SourcePill source={r.source} /></div>
                    </td>

                    {/* Item */}
                    <td className="px-3 py-2.5 align-top max-w-[180px]">
                      {r.primary ? (
                        <>
                          <p className="text-xs font-semibold text-ink truncate" title={r.primary.itemName}>{r.primary.itemName}</p>
                          <p className="text-[10px] text-ink-4 font-mono">{r.primary.itemCode}{r.extraItems > 0 ? ` +${r.extraItems} more` : ''}</p>
                        </>
                      ) : <span className="text-[10px] text-ink-4">—</span>}
                    </td>

                    {/* Vendor */}
                    <td className="px-3 py-2.5 align-top max-w-[140px]">
                      <p className="text-xs text-ink-2 truncate" title={r.vendorName}>{r.vendorName}</p>
                    </td>

                    {/* Req Qty */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-center align-top">
                      <span className="text-xs tabular-nums text-ink">{r.reqQty != null ? r.reqQty.toLocaleString('en-IN') : '—'}{r.unit ? ` ${r.unit}` : ''}</span>
                    </td>

                    {/* MOQ */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-center align-top">
                      {r.moq != null ? (
                        <span className={`text-xs tabular-nums ${r.belowMoq ? 'inline-flex items-center px-1.5 py-0.5 rounded-full bg-warn-soft text-warn border border-[color:var(--st-amber-fg)]/30 font-semibold' : 'text-ink-3'}`}>
                          {r.moq.toLocaleString('en-IN')}{r.unit ? ` ${r.unit}` : ''}
                        </span>
                      ) : <span className="text-[10px] text-ink-4">—</span>}
                    </td>

                    {/* ROP */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-center align-top">
                      <span className="text-xs tabular-nums text-ink-3" title={r.sih != null ? `current SIH ${r.sih} / ROP ${r.rop ?? '—'}` : undefined}>
                        {r.rop != null ? r.rop.toLocaleString('en-IN') : '—'}
                      </span>
                    </td>

                    {/* Expected Connecting */}
                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                      <p className={`text-xs font-mono ${SLA_LEVEL_CLASSES[expLevel]}`}>
                        {expLevel === 'bad' && <Flag weight="fill" className="inline w-3 h-3 align-[-1px] mr-1" />}{fmtDate(r.expectedConnecting)}
                      </p>
                      <p className="text-[9.5px] text-ink-4">
                        {r.leadDays != null ? `${r.leadDays}d lead` : 'no lead'}
                        {expLevel !== 'ok' && r.estimatedArrivalIfOrderedNow
                          ? ` · ~${fmtDate(r.estimatedArrivalIfOrderedNow)} if ordered now`
                          : ''}
                      </p>
                    </td>

                    {/* SLA */}
                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                      <span className={`text-xs font-mono ${SLA_LEVEL_CLASSES[r.slaLevel]}`}>
                        {SLA_LEVEL_PREFIX[r.slaLevel]} {r.daysOpen}d open
                      </span>
                      <p className="text-[9.5px] text-ink-4">committed {SLA_DEFAULTS.procurementDays}d</p>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        <ActionBtn icon={Pencil} label="Edit" onClick={() => onEdit(r.req)} />
                        <ActionBtn icon={MessageSquare} label="Quote" onClick={() => onRequestQuote(r.req)} />
                        <ActionBtn icon={PackageSearch} label="Audit" onClick={() => onStockAudit(r.req)} />
                        <ActionBtn icon={Truck} label="Draft PO" tone="primary" onClick={() => onDraftPO(r.req)} />
                        {onDelete && <ActionBtn icon={Trash2} label="Delete" tone="danger" onClick={() => onDelete(r.req)} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
        </ProcTableCard>
      )}

      {/* Record detail — click any PR row to see the full request */}
      {detailRow && (() => {
        const req = detailRow.req;
        const ss = req.stockSummary;
        const items = req.itemDetails ?? [];
        const itemRows = items.length
          ? items.map((it) => ({ name: it.itemName, code: it.itemCode, type: it.type ?? req.type, qty: it.reqQty, unit: it.unit, price: it.plannedPrice }))
          : (req.items ?? []).map((name, i) => ({ name, code: '', type: req.type, qty: req.quantities?.[i], unit: req.units?.[i] ?? '', price: req.plannedPrices?.[i] }));
        const hasPlanning = !!(req.planningSoNumber || req.planningCustomerName || req.planningProductName || req.planningProductCode);
        const num = (n: number | null | undefined) => (n != null ? Number(n).toLocaleString('en-IN') : '—');
        const sections: DetailSection[] = [
          {
            title: 'Request',
            fields: [
              { label: 'Code', value: req.code, mono: true },
              { label: 'Source', value: PR_SOURCE_CONFIG[detailRow.source]?.label },
              { label: 'Type', value: detailRow.primary?.type ?? req.type },
              { label: 'Priority', value: req.priority },
              { label: 'Status', value: req.status },
              { label: 'Requested By', value: req.requestedBy },
              { label: 'Due Date', value: fmtDate(req.dueDate) },
              { label: 'Created', value: fmtDate(req.createdDate) },
              { label: 'Preferred Vendor', value: req.preferredVendor },
              { label: 'Description', value: req.description, span: 'full' },
            ],
          },
          {
            title: 'Items',
            content: itemRows.length === 0 ? (
              <p className="text-xs text-ink-4">No item lines.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-ink-3 border-b border-border">
                      <th className="py-1.5 pr-3 font-semibold">Item</th>
                      <th className="py-1.5 px-3 font-semibold">Code</th>
                      <th className="py-1.5 px-3 font-semibold">Type</th>
                      <th className="py-1.5 px-3 font-semibold text-right">Qty</th>
                      <th className="py-1.5 px-3 font-semibold">Unit</th>
                      <th className="py-1.5 pl-3 font-semibold text-right">Planned Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {itemRows.map((it, i) => (
                      <tr key={i}>
                        <td className="py-1.5 pr-3 text-ink font-medium">{it.name || '—'}</td>
                        <td className="py-1.5 px-3 font-mono text-[11px] text-ink-3">{it.code || '—'}</td>
                        <td className="py-1.5 px-3 text-ink-2">{it.type || '—'}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-ink-2">{num(it.qty)}</td>
                        <td className="py-1.5 px-3 text-ink-2">{it.unit || '—'}</td>
                        <td className="py-1.5 pl-3 text-right tabular-nums text-ink-2">{it.price != null ? `₹${num(it.price)}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
          },
          ...(ss ? [{
            title: 'Stock position',
            fields: [
              { label: 'Stock In Hand', value: num(ss.stockInHand) },
              { label: 'Open PO Qty', value: num(ss.openPOQty) },
              { label: 'In Transit', value: num(ss.inTransit) },
              { label: 'Open Orders', value: num(ss.openOrders) },
            ],
          } as DetailSection] : []),
          ...(hasPlanning ? [{
            title: 'Planning linkage',
            fields: [
              { label: 'SO Number', value: req.planningSoNumber, mono: true },
              { label: 'Customer', value: req.planningCustomerName },
              { label: 'Product', value: req.planningProductName },
              { label: 'Product Code', value: req.planningProductCode, mono: true },
            ],
          } as DetailSection] : []),
        ];
        return (
          <RecordDetailModal
            open
            onClose={() => setDetailRow(null)}
            eyebrow="Procurement Request"
            title={req.code}
            subtitle={detailRow.primary?.itemName}
            status={<SourcePill source={detailRow.source} />}
            sections={sections}
            size="lg"
          />
        );
      })()}
    </div>
  );
};
