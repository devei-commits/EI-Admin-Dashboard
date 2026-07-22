/**
 * Track Quote Requests — Procurement spec View 3 (§4).
 * Planning-originated RFQs and Procurement-initiated quote requests in one inbox.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, MessageSquare, Loader2, FileText, Pencil, Plus, Download } from 'lucide-react';
import { fetchPlanningQuotationAsks, type PlanningQuotationAsk } from '../../services/planningQuotationAsks.service';
import type { VendorQuote } from '../../types/procurement.types';
import {
  QUOTE_STATUS_CONFIG, PR_SOURCE_CONFIG, SLA_DEFAULTS, SLA_LEVEL_CLASSES, SLA_LEVEL_PREFIX,
  type QuoteStatus, type PrSource,
} from '../../constants/procurement';
import { quoteSlaLevel } from '../../lib/procurementSla';
import { type RfqTemplateData } from './RfqTemplatePopup';
import { QuotationEditPopup } from './QuotationEditPopup';
import { RequestQuotationModal, type RequestQuotationContext } from './RequestQuotationModal';
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
    const rank: Record<QuoteStatus, number> = { requested: 0, draft: 1, completed: 2, terminated: 3 };
    merged.sort((a, b) => (rank[a.status] - rank[b.status]) || (b.daysOpen - a.daysOpen));
    return merged;
  }, [asks, vendorQuotes, search, statusFilter, sourceFilter]);

  const awaiting = rows.filter((r) => r.status === 'requested').length;
  const breached = rows.filter((r) => r.status === 'requested' && quoteSlaLevel(r.daysOpen) === 'bad').length;
  const fromPlanning = rows.filter((r) => r.source === 'planning').length;

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
      active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="text-xs text-slate-600">
          💬 <b className="text-slate-800">Quote Requests</b> · {rows.length} active · {awaiting} awaiting response
          {breached > 0 && <span className="ml-2 text-red-600 font-semibold">🚩 {breached} SLA-breached</span>}
          <span className="ml-2 text-slate-400">· {fromPlanning} from Planning</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRequestOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700">
            <Plus size={14} /> Request Quotation
          </button>
          {onExport && (
            <button onClick={onExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50">
              <Download size={14} /> Export
            </button>
          )}
          <button onClick={() => void load()} title="Refresh" className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Source</span>
          {(['all', 'planning', 'procurement'] as const).map((s) => (
            <button key={s} onClick={() => setSourceFilter(s)} className={chip(sourceFilter === s)}>
              {s === 'all' ? 'All' : s === 'planning' ? '📋 Planning' : '⊕ Procurement'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search QT ID, item, vendor…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
            <option value="all">All Statuses</option>
            {(Object.keys(QUOTE_STATUS_CONFIG) as QuoteStatus[]).map((s) => (
              <option key={s} value={s}>{QUOTE_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && rows.length === 0 ? (
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
                {['Req Date', 'QT Req ID', 'Source', 'Item', 'Vendor(s)', 'Req Qty', 'Target Price', 'Quote Status', 'SLA', 'Actions'].map((h) => (
                  <th key={h} className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const sc = QUOTE_STATUS_CONFIG[r.status];
                const src = PR_SOURCE_CONFIG[r.source];
                const slaLevel = quoteSlaLevel(r.daysOpen);
                const linkedQuote = r.id.startsWith('proc-') ? vendorQuotes.find((q) => `proc-${q.id}` === r.id) : undefined;
                return (
                  <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-700">{fmtDate(r.requestDate)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] font-semibold text-blue-600">{r.qtId}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9.5px] font-semibold ${src.text} ${src.bg} ${src.border}`}>{src.emoji} {src.label}</span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[170px]">
                      <p className="text-xs font-semibold text-slate-800 truncate" title={r.itemName}>{r.itemName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{r.itemCode}</p>
                    </td>
                    <td className="px-3 py-2.5 max-w-[130px]"><p className="text-xs text-slate-700 truncate">{r.vendors}</p></td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs tabular-nums text-slate-700">{r.qtyTiers.join(' / ')}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs tabular-nums text-slate-700">{r.targetPrice != null ? `₹${r.targetPrice.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${sc.text} ${sc.bg} ${sc.border}`}>{sc.label}</span></td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className={`text-[11px] font-mono ${SLA_LEVEL_CLASSES[slaLevel]}`}>{SLA_LEVEL_PREFIX[slaLevel]} {r.daysOpen}d</span><span className="text-[9.5px] text-slate-400 ml-1">/ {SLA_DEFAULTS.quoteDays}d</span></td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        {(() => {
                          const canRecord = r.status !== 'completed' && r.status !== 'terminated';
                          const showEdit = linkedQuote && onEditQuote;
                          // RFQ rows (planning_quotation_asks) are edited in the RequestQuotationModal while still pending.
                          const canEditRfq = !!r.ask && r.status === 'requested';
                          if (!canRecord && !showEdit && !canEditRfq) {
                            return <span className="text-xs text-slate-300">—</span>;
                          }
                          return (
                            <>
                              {canEditRfq && (
                                <button onClick={() => setEditingAsk(r.ask!)} title="Edit quote request" className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100 text-[10.5px] font-semibold">
                                  <Pencil size={12} /> Edit
                                </button>
                              )}
                              {showEdit && (
                                <button onClick={() => onEditQuote(linkedQuote)} title="Edit" className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100 text-[10.5px] font-semibold">
                                  <Pencil size={12} /> Edit
                                </button>
                              )}
                              {canRecord && (
                                <button onClick={() => setRecordingFor(r.templateData)} title="Record a vendor quotation" className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-[10.5px] font-semibold">
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
          </table>
        </div>
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
    </div>
  );
};

