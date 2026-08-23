/**
 * Track Quote Requests — Procurement spec View 3 (§4).
 * Planning-originated RFQs and Procurement-initiated quote requests in one inbox.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, MessageSquare, Loader2, FileText, Pencil, Plus, Download } from 'lucide-react';
import { ChatCircle, Flag, ClipboardText } from '@phosphor-icons/react';
import { fetchPlanningQuotationAsks, type PlanningQuotationAsk } from '../../services/planningQuotationAsks.service';
import type { VendorQuote } from '../../types/procurement.types';
import {
  QUOTE_STATUS_CONFIG, PR_SOURCE_CONFIG, SLA_DEFAULTS, SLA_LEVEL_CLASSES, SLA_LEVEL_PREFIX,
  type QuoteStatus, type PrSource,
} from '../../constants/procurement';
import { quoteSlaLevel } from '../../lib/procurementSla';
import { type RfqTemplateData } from './RfqTemplatePopup';
import { ProcSectionHeader, ProcFilterBar, ProcSearch, procSelectClass, ProcTableCard, ProcLoading, ProcError, ProcEmpty, procChipClass } from './ProcSection';
import { SortableTableTh } from '../ui/SortableTableTh';
import { QuotationEditPopup } from './QuotationEditPopup';
import { RequestQuotationModal, type RequestQuotationContext } from './RequestQuotationModal';
import RecordDetailModal, { type DetailSection } from '../ui/RecordDetailModal';
import { recordQuotationToPriceList } from '../../utils/recordQuotationToPriceList';
import type { VendorClientRecord } from '../../services/vendorClient.service';

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
function mapPlanningStatus(s: PlanningQuotationAsk['status']): QuoteStatus {
  if (s === 'fulfilled') return 'completed';
  if (s === 'cancelled') return 'terminated';
  return 'requested';
}
function mapVendorQuoteStatus(s: VendorQuote['status']): QuoteStatus {
  if (s === 'Confirmed') return 'completed';
  if (s === 'Not Selected') return 'terminated';
  return 'requested';
}

type QuoteSortKey = 'date' | 'qtId' | 'item' | 'vendor' | 'targetPrice' | 'status' | 'sla';
type SortDir = 'asc' | 'desc';
const QUOTE_STATUS_RANK: Record<QuoteStatus, number> = { requested: 0, draft: 1, completed: 2, terminated: 3 };

function cmpNullableNum(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}
function cmpDateStr(a: string | null, b: string | null): number {
  const ea = a ?? '9999';
  const eb = b ?? '9999';
  return ea < eb ? -1 : ea > eb ? 1 : 0;
}

interface QuoteRow {
  id: string;
  qtId: string;
  source: PrSource;
  itemName: string;
  itemCode: string;
  vendors: string;
  qtyTiers: string[];
  targetPrice: number | null;
  status: QuoteStatus;
  requestDate: string | null;
  daysOpen: number;
  /** Present for RFQ rows (planning_quotation_asks) — enables the Edit-RFQ action. */
  ask?: PlanningQuotationAsk;
  templateData: RfqTemplateData;
}

export interface QuoteRequestsViewProps {
  /** Procurement-recorded vendor quotations (from parent React Query). */
  vendorQuotes?: VendorQuote[];
  /** Vendor master records for the Record-Quotation popup (typeahead + auto-fill). */
  vendors?: VendorClientRecord[];
  vendorsLoading?: boolean;
  onEditQuote?: (quote: VendorQuote) => void;
  onNewQuoteRequest?: () => void;
  onExport?: () => void;
  /** Fired after a quotation is recorded into the Items List (parent refetches price list). */
  onQuoteRecorded?: () => void;
}

export const QuoteRequestsView: React.FC<QuoteRequestsViewProps> = ({
  vendorQuotes = [],
  vendors = [],
  vendorsLoading,
  onEditQuote,
  onNewQuoteRequest,
  onExport,
  onQuoteRecorded,
}) => {
  const [asks, setAsks] = useState<PlanningQuotationAsk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | PrSource>('all');
  // Record a vendor quotation (MOQ bands) → Approve & Save writes straight to the Items List price list.
  const [recordingFor, setRecordingFor] = useState<RfqTemplateData | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  // Edit an existing RFQ (planning_quotation_ask) in the RequestQuotationModal.
  const [editingAsk, setEditingAsk] = useState<PlanningQuotationAsk | null>(null);
  const [detailRow, setDetailRow] = useState<QuoteRow | null>(null);
  // null = default status-priority sort (awaiting response first); set once a header is clicked.
  const [sortBy, setSortBy] = useState<QuoteSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleHeaderSort = (key: QuoteSortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
  };

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

  const rows = useMemo((): QuoteRow[] => {
    const planningRows: QuoteRow[] = asks.map((a) => {
      // "Req Qty" shows the RFQ's MOQ bands when the request asks for multiple MOQs; otherwise the single qty.
      const unitStr = a.unit ? ` ${a.unit}` : '';
      const moqTiers = Array.isArray(a.moqBands) ? a.moqBands.filter((m) => Number(m) > 0) : [];
      const qtyTiers = moqTiers.length > 0
        ? moqTiers.map((m) => `${Number(m).toLocaleString('en-IN')}${unitStr}`)
        : [`${a.quantityRequested.toLocaleString('en-IN')}${unitStr}`];
      return {
        id: `planning-${a.id}`,
        qtId: `QT-${new Date(a.createdAt ?? Date.now()).getFullYear()}-${String(a.id).padStart(4, '0')}`,
        source: (a.source === 'procurement' ? 'procurement' : 'planning') as PrSource,
        itemName: a.itemName ?? '—',
        itemCode: a.itemCode ?? '',
        vendors: a.vendorHint || 'Any (broadcast)',
        qtyTiers,
        targetPrice: null,
        status: mapPlanningStatus(a.status),
        requestDate: a.createdAt ?? null,
        daysOpen: daysSince(a.createdAt),
        ask: a,
        templateData: {
          qtId: `QT-${String(a.id).padStart(4, '0')}`,
          requestDate: a.createdAt,
          vendor: a.vendorHint || 'Any (broadcast)',
          itemCode: a.itemCode || '',
          itemName: a.itemName || '—',
          qtyTiers,
          needBy: null,
          comments: a.notes || undefined,
          itemType: a.itemType,
          rawMaterialId: a.rawMaterialId,
          packMaterialId: a.packMaterialId,
          askId: a.id,
          moqHint: a.moqHint,
          quantityToQuote: a.quantityRequested,
        },
      };
    });

    // Items-List rows (id 'IL-…') are the vendor price-list catalog (one per vendor, all their items) — they are
    // NOT quote requests and their concatenated quantities polluted "Req Qty". Excluded here; they live in Items List.
    const procRows: QuoteRow[] = vendorQuotes.filter((q) => !String(q.id).startsWith('IL-')).map((q) => {
      const qtyTiers = q.lines.map((l) => l.qty).filter(Boolean);
      return {
        id: `proc-${q.id}`,
        qtId: `QT-${new Date(q.createdAt ?? q.quotedOn ?? Date.now()).getFullYear()}-${String(q.id).padStart(4, '0')}`,
        source: 'procurement' as PrSource,
        itemName: q.lines[0]?.item ?? q.requestCode,
        itemCode: q.lines[0]?.itemId ?? '',
        vendors: q.vendor,
        qtyTiers: qtyTiers.length ? qtyTiers : ['—'],
        targetPrice: q.lines[0]?.pricePerUnit ?? null,
        status: mapVendorQuoteStatus(q.status),
        requestDate: q.createdAt ?? q.quotedOn ?? null,
        daysOpen: daysSince(q.createdAt ?? q.quotedOn),
        templateData: {
          qtId: `QT-${String(q.id).padStart(4, '0')}`,
          requestDate: q.createdAt ?? q.quotedOn,
          vendor: q.vendor,
          itemCode: q.lines[0]?.itemId ?? '',
          itemName: q.lines[0]?.item ?? q.requestCode,
          qtyTiers,
          needBy: null,
          comments: q.note || undefined,
          itemType: q.requestType === 'RM' || q.requestType === 'PM' ? q.requestType : undefined,
          rawMaterialId: q.lines[0]?.raw_material_id ?? null,
          packMaterialId: q.lines[0]?.pack_material_id ?? null,
          askId: null,
          moqHint: null,
          quantityToQuote: q.lines[0]?.qty != null && q.lines[0].qty !== '' ? Number(q.lines[0].qty) : null,
        },
      };
    });

    const q = search.trim().toLowerCase();
    const merged = [...planningRows, ...procRows].filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (q && !`${r.qtId} ${r.itemName} ${r.itemCode} ${r.vendors}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sortBy == null) {
      merged.sort((a, b) => (QUOTE_STATUS_RANK[a.status] - QUOTE_STATUS_RANK[b.status]) || (b.daysOpen - a.daysOpen));
      return merged;
    }
    const dirMul = sortDir === 'asc' ? 1 : -1;
    merged.sort((a, b) => {
      let d = 0;
      switch (sortBy) {
        case 'date': d = cmpDateStr(a.requestDate, b.requestDate); break;
        case 'qtId': d = a.qtId.localeCompare(b.qtId); break;
        case 'item': d = a.itemName.localeCompare(b.itemName); break;
        case 'vendor': d = a.vendors.localeCompare(b.vendors); break;
        case 'targetPrice': d = cmpNullableNum(a.targetPrice, b.targetPrice); break;
        case 'status': d = QUOTE_STATUS_RANK[a.status] - QUOTE_STATUS_RANK[b.status]; break;
        case 'sla': d = b.daysOpen - a.daysOpen; break;
      }
      if (d === 0) d = a.qtId.localeCompare(b.qtId);
      return d * dirMul;
    });
    return merged;
  }, [asks, vendorQuotes, search, statusFilter, sourceFilter, sortBy, sortDir]);

  const awaiting = rows.filter((r) => r.status === 'requested').length;
  const breached = rows.filter((r) => r.status === 'requested' && quoteSlaLevel(r.daysOpen) === 'bad').length;
  const fromPlanning = rows.filter((r) => r.source === 'planning').length;

  return (
    <div className="space-y-3">
      <ProcSectionHeader
        icon={<ChatCircle className="w-4 h-4 shrink-0" />}
        title="Quote Requests"
        stats={[
          { value: rows.length, label: 'active' },
          { value: awaiting, label: 'awaiting response', tone: 'brand' },
          { value: breached, label: 'SLA-breached', tone: 'err', hidden: breached === 0 },
          { value: fromPlanning, label: 'from Planning' },
        ]}
        actions={
          <>
            <button onClick={() => setRequestOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-press">
              <Plus size={14} /> Request Quotation
            </button>
            {onExport && (
              <button onClick={onExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-ink-3 bg-surface hover:bg-surface-2">
                <Download size={14} /> Export
              </button>
            )}
            <button onClick={() => void load()} disabled={loading} title="Refresh" aria-label="Refresh" className="p-2 rounded-lg border border-border hover:bg-surface-2 text-ink-3 disabled:opacity-50 disabled:cursor-not-allowed">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </>
        }
      />

      <ProcFilterBar stack>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-ink-4 uppercase">Source</span>
          {(['all', 'planning', 'procurement'] as const).map((s) => (
            <button key={s} onClick={() => setSourceFilter(s)} className={`${procChipClass(sourceFilter === s)} inline-flex items-center gap-1`}>
              {s === 'all' ? 'All' : s === 'planning' ? <><ClipboardText className="w-3 h-3" /> Planning</> : <><Plus className="w-3 h-3" /> Procurement</>}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProcSearch value={search} onChange={setSearch} placeholder="Search QT ID, item, vendor…" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by status" className={procSelectClass}>
            <option value="all">All Statuses</option>
            {(Object.keys(QUOTE_STATUS_CONFIG) as QuoteStatus[]).map((s) => (
              <option key={s} value={s}>{QUOTE_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
      </ProcFilterBar>

      {loading && rows.length === 0 ? (
        <ProcLoading label="Loading quote requests…" />
      ) : error ? (
        <ProcError message={error} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <ProcEmpty icon={<MessageSquare size={30} />}>No quote requests.</ProcEmpty>
      ) : (
        <ProcTableCard>
            <thead className="sticky top-0 z-20">
              <tr className="bg-surface-2 border-b border-border [&_th]:bg-surface-2">
                <SortableTableTh label="Req Date" column="date" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} />
                <SortableTableTh label="QT Req ID" column="qtId" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} />
                <th scope="col" className="px-3 py-2 text-[10px] font-bold text-ink-3 uppercase tracking-wide whitespace-nowrap">Source</th>
                <SortableTableTh label="Item" column="item" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} />
                <SortableTableTh label="Vendor(s)" column="vendor" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} />
                <th scope="col" className="px-3 py-2 text-right text-[10px] font-bold text-ink-3 uppercase tracking-wide whitespace-nowrap">Req Qty</th>
                <SortableTableTh label="Target Price" column="targetPrice" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} align="right" />
                <SortableTableTh label="Quote Status" column="status" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} />
                <SortableTableTh label="SLA" column="sla" sortColumn={sortBy} sortDirection={sortDir} onSort={handleHeaderSort} />
                <th scope="col" className="px-3 py-2 text-[10px] font-bold text-ink-3 uppercase tracking-wide whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((r) => {
                const sc = QUOTE_STATUS_CONFIG[r.status];
                const src = PR_SOURCE_CONFIG[r.source];
                const slaLevel = quoteSlaLevel(r.daysOpen);
                const linkedQuote = r.id.startsWith('proc-') ? vendorQuotes.find((q) => `proc-${q.id}` === r.id) : undefined;
                return (
                  <tr key={r.id} onClick={() => setDetailRow(r)} className="hover:bg-brand-soft transition-colors cursor-pointer">
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-ink-2">{fmtDate(r.requestDate)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] font-semibold text-brand">{r.qtId}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9.5px] font-semibold ${src.text} ${src.bg} ${src.border}`}>{src.label}</span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[170px]">
                      <p className="text-xs font-semibold text-ink truncate" title={r.itemName}>{r.itemName}</p>
                      <p className="text-[10px] text-ink-4 font-mono">{r.itemCode}</p>
                    </td>
                    <td className="px-3 py-2.5 max-w-[130px]"><p className="text-xs text-ink-2 truncate">{r.vendors}</p></td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right text-xs tabular-nums text-ink-2">{r.qtyTiers.join(' / ')}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right text-xs tabular-nums text-ink-2">{r.targetPrice != null ? `₹${r.targetPrice.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${sc.text} ${sc.bg} ${sc.border}`}>{sc.label}</span></td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className={`text-[11px] font-mono ${SLA_LEVEL_CLASSES[slaLevel]}`}>{SLA_LEVEL_PREFIX[slaLevel]} {r.daysOpen}d</span><span className="text-[9.5px] text-ink-4 ml-1">/ {SLA_DEFAULTS.quoteDays}d</span></td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        {(() => {
                          const canRecord = r.status !== 'completed' && r.status !== 'terminated';
                          const showEdit = linkedQuote && onEditQuote;
                          // RFQ rows (planning_quotation_asks) are edited in the RequestQuotationModal while still pending.
                          const canEditRfq = !!r.ask && r.status === 'requested';
                          if (!canRecord && !showEdit && !canEditRfq) {
                            return <span className="text-xs text-ink-4">—</span>;
                          }
                          return (
                            <>
                              {canEditRfq && (
                                <button onClick={(e) => { e.stopPropagation(); setEditingAsk(r.ask!); }} title="Edit quote request" className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-ink-3 bg-surface-3 hover:bg-surface-2 text-[10.5px] font-semibold">
                                  <Pencil size={12} /> Edit
                                </button>
                              )}
                              {showEdit && (
                                <button onClick={(e) => { e.stopPropagation(); onEditQuote(linkedQuote); }} title="Edit" className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-ink-3 bg-surface-3 hover:bg-surface-2 text-[10.5px] font-semibold">
                                  <Pencil size={12} /> Edit
                                </button>
                              )}
                              {canRecord && (
                                <button onClick={(e) => { e.stopPropagation(); setRecordingFor(r.templateData); }} title="Record a vendor quotation" className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-brand-soft text-brand bg-brand-soft hover:bg-brand-soft-2 text-[10.5px] font-semibold">
                                  <FileText size={12} /> Record Quote
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
        </ProcTableCard>
      )}

      {/* Record the quotation — enter MOQ price bands and save straight to the price list. */}
      {recordingFor && (
        <QuotationEditPopup
          data={recordingFor}
          vendors={vendors}
          vendorsLoading={vendorsLoading}
          onClose={() => setRecordingFor(null)}
          onApproveSave={async (quote) => {
            const itemType = recordingFor.itemType;
            const materialId = itemType === 'RM' ? recordingFor.rawMaterialId : recordingFor.packMaterialId;
            if (!itemType || materialId == null) {
              return { success: false, error: 'This item is not linked to a material master, so it cannot be priced.' };
            }
            const res = await recordQuotationToPriceList({
              itemType,
              materialId,
              askId: recordingFor.askId ?? null,
              quote,
            });
            if (!res.success) return { success: false, error: res.error ?? 'Failed to update the price list.' };
            onQuoteRecorded?.();
            void load();
            return { success: true };
          }}
        />
      )}

      {requestOpen && (
        <RequestQuotationModal
          context={{ itemType: 'RM', itemCode: '', itemName: '', allowItemPick: true }}
          onClose={() => setRequestOpen(false)}
          onSubmitted={() => { setRequestOpen(false); void load(); }}
        />
      )}

      {editingAsk && (
        <RequestQuotationModal
          editAsk={editingAsk}
          context={{
            itemType: editingAsk.itemType,
            itemCode: editingAsk.itemCode ?? '',
            itemName: editingAsk.itemName ?? '',
            rawMaterialId: editingAsk.rawMaterialId,
            packMaterialId: editingAsk.packMaterialId,
            unit: editingAsk.unit ?? undefined,
            planningExtractedId: editingAsk.planningExtractedId,
            defaultQty: editingAsk.quantityRequested,
            allowItemPick: true,
          } as RequestQuotationContext}
          onClose={() => setEditingAsk(null)}
          onSubmitted={() => { setEditingAsk(null); void load(); }}
        />
      )}

      {/* Record detail — click any quote-request row to see the full request */}
      {detailRow && (() => {
        const r = detailRow;
        const sc = QUOTE_STATUS_CONFIG[r.status];
        const linkedQuote = r.id.startsWith('proc-') ? vendorQuotes.find((q) => `proc-${q.id}` === r.id) : undefined;
        const sections: DetailSection[] = [
          {
            title: 'Request',
            fields: [
              { label: 'QT Req ID', value: r.qtId, mono: true },
              { label: 'Source', value: PR_SOURCE_CONFIG[r.source]?.label },
              { label: 'Item', value: r.itemName },
              { label: 'Item Code', value: r.itemCode, mono: true },
              { label: 'Status', value: sc?.label },
              { label: 'Request Date', value: fmtDate(r.requestDate) },
              { label: 'Days Open', value: `${r.daysOpen}d` },
              { label: 'Target Price', value: r.targetPrice != null ? `₹${r.targetPrice.toLocaleString('en-IN')}` : undefined },
              { label: 'Vendor(s)', value: r.vendors, span: 'full' },
            ],
          },
          {
            title: 'MOQ tiers',
            content: r.qtyTiers.length === 0 ? (
              <p className="text-xs text-ink-4">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {r.qtyTiers.map((t, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full border border-border bg-surface-3 text-[11px] font-mono text-ink-2">{t}</span>
                ))}
              </div>
            ),
          },
          ...(linkedQuote && linkedQuote.lines.length ? [{
            title: 'Quote lines',
            content: (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-ink-3 border-b border-border">
                      <th className="py-1.5 pr-3 font-semibold">Item</th>
                      <th className="py-1.5 px-3 font-semibold text-right">Qty</th>
                      <th className="py-1.5 px-3 font-semibold text-right">Price/Unit</th>
                      <th className="py-1.5 px-3 font-semibold text-right">Total Value</th>
                      <th className="py-1.5 pl-3 font-semibold">vs Planned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {linkedQuote.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="py-1.5 pr-3 text-ink font-medium">{l.item || '—'}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-ink-2">{l.qty || '—'}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-ink-2">{l.pricePerUnit != null ? `₹${l.pricePerUnit.toLocaleString('en-IN')}` : '—'}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-ink-2">{l.totalValue != null ? `₹${l.totalValue.toLocaleString('en-IN')}` : '—'}</td>
                        <td className="py-1.5 pl-3 text-ink-2">{l.vsPlanned || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
          } as DetailSection] : []),
          ...(linkedQuote ? [{
            title: 'Terms',
            fields: [
              { label: 'Lead Time', value: linkedQuote.leadTimeDays != null ? `${linkedQuote.leadTimeDays}d` : undefined },
              { label: 'Terms', value: linkedQuote.terms },
              { label: 'Valid Till', value: fmtDate(linkedQuote.validTill) },
              { label: 'Rating', value: linkedQuote.rating ? `${linkedQuote.rating} ★` : undefined },
            ],
          } as DetailSection] : []),
        ];
        return (
          <RecordDetailModal
            open
            onClose={() => setDetailRow(null)}
            eyebrow="Quote Request"
            title={r.qtId}
            subtitle={r.itemName}
            status={sc ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${sc.text} ${sc.bg} ${sc.border}`}>{sc.label}</span> : undefined}
            sections={sections}
            size="lg"
          />
        );
      })()}
    </div>
  );
};

