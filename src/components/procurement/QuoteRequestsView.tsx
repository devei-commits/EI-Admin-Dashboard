/**
 * Track Quote Requests — Procurement spec View 3 (§4).
 * Actions per row:
 *   📄 Template → opens editable RFQ document popup; editing + approve happen there
 *   ✓ Approve  → confirms the quote (planning: fulfilled / proc: Confirmed)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, RefreshCw, MessageSquare, Loader2, FileText,
  Plus, Download, CheckCircle, Tag,
} from 'lucide-react';
import {
  fetchPlanningQuotationAsks,
  updatePlanningQuotationAsk,
  type PlanningQuotationAsk,
} from '../../services/planningQuotationAsks.service';
import { updateProcurementQuotation } from '../../services/procurementQuotations.service';
import type { VendorQuote, Vendor } from '../../types/procurement.types';
import {
  QUOTE_STATUS_CONFIG, PR_SOURCE_CONFIG, SLA_DEFAULTS, SLA_LEVEL_CLASSES, SLA_LEVEL_PREFIX,
  type QuoteStatus, type PrSource,
} from '../../constants/procurement';
import { quoteSlaLevel } from '../../lib/procurementSla';
import { RfqTemplatePopup, type RfqTemplateData, type RfqEditedFields } from './RfqTemplatePopup';
import { UpdatePriceListPopup } from './UpdatePriceListPopup';

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
  rawId: number;
  source: PrSource;
  qtId: string;
  itemName: string;
  itemCode: string;
  itemType: 'RM' | 'PM';
  rawMaterialId?: number | null;
  packMaterialId?: number | null;
  vendors: string;
  qtyTiers: string[];
  targetPrice: number | null;
  status: QuoteStatus;
  requestDate: string | null;
  daysOpen: number;
  templateData: RfqTemplateData;
}

export interface QuoteRequestsViewProps {
  vendorQuotes?: VendorQuote[];
  vendors?: Vendor[];
  asks?: PlanningQuotationAsk[];
  onNewQuoteRequest?: () => void;
  onExport?: () => void;
}

export const QuoteRequestsView: React.FC<QuoteRequestsViewProps> = ({
  vendorQuotes = [],
  vendors = [],
  asks: propAsks,
  onNewQuoteRequest,
  onExport,
}) => {
  const [internalAsks, setInternalAsks] = useState<PlanningQuotationAsk[]>([]);
  const [loading, setLoading] = useState(propAsks === undefined);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | PrSource>('all');
  const [templateFor, setTemplateFor] = useState<QuoteRow | null>(null);
  const [priceListFor, setPriceListFor] = useState<QuoteRow | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem('qr-approved-ids');
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });

  const load = useCallback(async () => {
    if (propAsks !== undefined) return;   // parent owns asks — skip internal fetch
    setLoading(true); setError(null);
    try {
      const res = await fetchPlanningQuotationAsks();
      if (res.success) setInternalAsks(res.data ?? []);
      else setError('Failed to load quote requests');
    } catch (e) { setError('Failed to load quote requests'); console.error(e); }
    finally { setLoading(false); }
  }, [propAsks]);
  useEffect(() => { void load(); }, [load]);
  const asks = propAsks ?? internalAsks;

  const rows = useMemo((): QuoteRow[] => {
    const planningRows: QuoteRow[] = asks.map((a) => ({
      id: `planning-${a.id}`,
      rawId: a.id,
      source: 'planning' as PrSource,
      qtId: `QT-${new Date(a.createdAt ?? Date.now()).getFullYear()}-${String(a.id).padStart(4, '0')}`,
      itemName: a.itemName ?? '—',
      itemCode: a.itemCode ?? '',
      itemType: a.itemType,
      rawMaterialId: a.rawMaterialId,
      packMaterialId: a.packMaterialId,
      vendors: a.vendorHint || 'Any (broadcast)',
      qtyTiers: [`${a.quantityRequested.toLocaleString('en-IN')}${a.unit ? ` ${a.unit}` : ''}`],
      targetPrice: null,
      status: approvedIds.has(`planning-${a.id}`) ? 'completed' : mapPlanningStatus(a.status),
      requestDate: a.createdAt ?? null,
      daysOpen: daysSince(a.createdAt),
      templateData: {
        qtId: `QT-${String(a.id).padStart(4, '0')}`,
        requestDate: a.createdAt,
        vendor: a.vendorHint || '',
        itemCode: a.itemCode || '',
        itemName: a.itemName || '—',
        qtyTiers: [`${a.quantityRequested.toLocaleString('en-IN')}${a.unit ? ` ${a.unit}` : ''}`],
        needBy: null,
        comments: a.notes || undefined,
      },
    }));

    const procRows: QuoteRow[] = vendorQuotes.map((q) => {
      const qtyTiers = q.lines.map((l) => l.qty).filter(Boolean);
      return {
        id: `proc-${q.id}`,
        rawId: Number(q.id),
        source: 'procurement' as PrSource,
        qtId: `QT-${new Date(q.createdAt ?? q.quotedOn ?? Date.now()).getFullYear()}-${String(q.id).padStart(4, '0')}`,
        itemName: q.lines[0]?.item ?? q.requestCode,
        itemCode: q.lines[0]?.itemId ?? '',
        itemType: q.requestType,
        rawMaterialId: q.lines[0]?.raw_material_id ?? null,
        packMaterialId: q.lines[0]?.pack_material_id ?? null,
        vendors: q.vendor,
        qtyTiers: qtyTiers.length ? qtyTiers : ['—'],
        targetPrice: q.lines[0]?.pricePerUnit ?? null,
        status: approvedIds.has(`proc-${q.id}`) ? 'completed' : mapVendorQuoteStatus(q.status),
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
    const rank: Partial<Record<QuoteStatus, number>> = { requested: 0, completed: 1, terminated: 2 };
    merged.sort((a, b) => (rank[a.status] - rank[b.status]) || (b.daysOpen - a.daysOpen));
    return merged;
  }, [asks, vendorQuotes, search, statusFilter, sourceFilter, approvedIds]);

  const awaiting = rows.filter((r) => r.status === 'requested').length;
  const breached = rows.filter((r) => r.status === 'requested' && quoteSlaLevel(r.daysOpen) === 'bad').length;
  const fromPlanning = rows.filter((r) => r.source === 'planning').length;

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
      active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    }`;

  const handleApprove = async (row: QuoteRow) => {
    setApprovingId(row.id);
    try {
      if (row.source === 'planning') {
        await updatePlanningQuotationAsk(row.rawId, { status: 'fulfilled' });
      } else {
        await updateProcurementQuotation(row.rawId, { status: 'Confirmed' });
      }
      setApprovedIds((prev) => {
        const next = new Set([...prev, row.id]);
        try { sessionStorage.setItem('qr-approved-ids', JSON.stringify([...next])); } catch {}
        return next;
      });
      if (templateFor?.id === row.id) setTemplateFor(null);
    } catch (e) {
      console.error('Approve failed:', e);
    } finally {
      setApprovingId(null);
    }
  };

  const handleSave = async (row: QuoteRow, edited: RfqEditedFields) => {
    if (row.source === 'planning') {
      const qty = parseFloat(edited.qtyTiers[0]);
      await updatePlanningQuotationAsk(row.rawId, {
        notes: edited.comments || undefined,
        ...(Number.isFinite(qty) && qty > 0 ? { quantityRequested: qty } : {}),
      });
    } else {
      await updateProcurementQuotation(row.rawId, {
        notes: edited.comments || null,
        validTill: edited.needBy || null,
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Header bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="text-xs text-slate-600">
          💬 <b className="text-slate-800">Quote Requests</b> · {rows.length} active · {awaiting} awaiting response
          {breached > 0 && <span className="ml-2 text-red-600 font-semibold">🚩 {breached} SLA-breached</span>}
          <span className="ml-2 text-slate-400">· {fromPlanning} from Planning</span>
        </div>
        <div className="flex items-center gap-2">
          {onNewQuoteRequest && (
            <button onClick={onNewQuoteRequest} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700">
              <Plus size={14} /> New Quote Request
            </button>
          )}
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

      {/* ── Filters ───────────────────────────────────────────────────── */}
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
            {(['requested', 'completed', 'terminated'] as QuoteStatus[]).map((s) => (
              <option key={s} value={s}>{QUOTE_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="animate-spin text-blue-500 mr-2" />
          <span className="text-sm text-slate-500">Loading…</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <p className="text-red-500 text-sm mb-3">{error}</p>
          <button onClick={() => void load()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Retry</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400 text-sm">
          <MessageSquare size={30} className="mx-auto mb-2 opacity-30" />No quote requests.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Req Date', 'QT ID', 'Source', 'Item', 'Vendor(s)', 'Req Qty', 'Target Price', 'Status', 'SLA', 'Actions'].map((h) => (
                  <th key={h} className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const sc = QUOTE_STATUS_CONFIG[r.status];
                const src = PR_SOURCE_CONFIG[r.source];
                const slaLevel = quoteSlaLevel(r.daysOpen);
                const isTerminal = r.status === 'completed' || r.status === 'terminated';
                const isApproving = approvingId === r.id;

                return (
                  <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-700">{fmtDate(r.requestDate)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] font-semibold text-blue-600">{r.qtId}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9.5px] font-semibold ${src.text} ${src.bg} ${src.border}`}>
                        {src.emoji} {src.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[170px]">
                      <p className="text-xs font-semibold text-slate-800 truncate" title={r.itemName}>{r.itemName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{r.itemCode}</p>
                    </td>
                    <td className="px-3 py-2.5 max-w-[130px]">
                      <p className="text-xs text-slate-700 truncate">{r.vendors}</p>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs tabular-nums text-slate-700">
                      {r.qtyTiers.join(' / ')}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs tabular-nums text-slate-700">
                      {r.targetPrice != null ? `₹${r.targetPrice.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${sc.text} ${sc.bg} ${sc.border}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`text-[11px] font-mono ${SLA_LEVEL_CLASSES[slaLevel]}`}>
                        {SLA_LEVEL_PREFIX[slaLevel]} {r.daysOpen}d
                      </span>
                      <span className="text-[9.5px] text-slate-400 ml-1">/ {SLA_DEFAULTS.quoteDays}d</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 flex-wrap">

                        {/* 📄 Template — opens editable RFQ popup (edit + send + approve) */}
                        <button
                          onClick={() => setTemplateFor(r)}
                          title="View / send RFQ template"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-[10.5px] font-semibold"
                        >
                          <FileText size={12} /> Template
                        </button>

                        {/* 🏷 Update Price List */}
                        <button
                          onClick={() => setPriceListFor(r)}
                          title="Update price list for this item"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 text-[10.5px] font-semibold"
                        >
                          <Tag size={12} /> Price List
                        </button>

                        {/* ✓ Approve — confirm this quote (hidden once terminal) */}
                        {!isTerminal && (
                          <button
                            onClick={() => void handleApprove(r)}
                            disabled={isApproving}
                            title="Approve / confirm this quote"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-[10.5px] font-semibold disabled:opacity-60"
                          >
                            <CheckCircle size={12} />
                            {isApproving ? '…' : 'Approve'}
                          </button>
                        )}

                        {isTerminal && r.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                            <CheckCircle size={10} /> Confirmed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── RFQ template popup ────────────────────────────────────────── */}
      {templateFor && (
        <RfqTemplatePopup
          data={templateFor.templateData}
          vendors={vendors}
          onClose={() => setTemplateFor(null)}
          onSave={(edited) => handleSave(templateFor, edited)}
          onApprove={
            !['completed', 'terminated'].includes(templateFor.status)
              ? () => handleApprove(templateFor)
              : undefined
          }
          onSent={() => setTemplateFor(null)}
        />
      )}

      {priceListFor && (
        <UpdatePriceListPopup
          itemCode={priceListFor.itemCode}
          itemName={priceListFor.itemName}
          itemType={priceListFor.itemType}
          rawMaterialId={priceListFor.rawMaterialId}
          packMaterialId={priceListFor.packMaterialId}
          defaultVendorName={
            priceListFor.vendors !== 'Any (broadcast)' ? priceListFor.vendors : undefined
          }
          vendors={vendors}
          onClose={() => setPriceListFor(null)}
        />
      )}
    </div>
  );
};
