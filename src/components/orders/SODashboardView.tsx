import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, AlertCircle, MessageSquare, RefreshCw, ChevronDown, ChevronRight,
  Package, Loader2, Plus, MoreVertical, Eye, Pencil, PackageCheck, FileText, Truck, MapPin,
  XCircle, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import type {
  SODashboardRow, CommercialStatus,
  SaleOrder, AddSOData, PickData, InvoiceData, ShipData, DeliveryData,
} from '../../types/orderFulfillment';
import {
  fetchSalesOrdersDashboard,
  cancelFulfillmentOrder,
  manualFulfillFulfillmentOrder,
} from '../../services/fulfillment.service';
import { COMMERCIAL_STATUS_CONFIG, COMMERCIAL_STATUS_FILTER_OPTIONS } from '../../constants/orderFulfillment';
import { formatLakhs } from '../../utils/orderFulfillmentUtils';
import { CommentsPanel } from './CommentsPanel';
import { SoActionModals, type SoActionModalsHandle, type SoUpdatePayload } from './SoActionModals';

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  const day = String(dt.getDate()).padStart(2, '0');
  const mon = dt.toLocaleString('en-US', { month: 'short' });
  return `${day}-${mon}-${dt.getFullYear()}`;
}

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString('en-IN');
}

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CommercialBadge({ status }: { status: CommercialStatus }) {
  const cfg = COMMERCIAL_STATUS_CONFIG[status] ?? COMMERCIAL_STATUS_CONFIG.received;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.color} ${cfg.bgColor} ${cfg.borderColor}`}>
      <Icon size={10} className="shrink-0" />
      {cfg.label}
    </span>
  );
}

// ─── Fulfillment Status Cell (FG Ready / Packed / Invoiced / Shipped) ─────────
const FF_STAGE_CONFIG: Record<string, { short: string; activeClass: string }> = {
  fg_ready: { short: 'FG Ready',  activeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  packed:   { short: 'Packed',    activeClass: 'bg-amber-100 text-amber-700 border border-amber-200' },
  invoiced: { short: 'Invoiced',  activeClass: 'bg-purple-100 text-purple-700 border border-purple-200' },
  shipped:  { short: 'Shipped',   activeClass: 'bg-teal-100 text-teal-700 border border-teal-200' },
};
const FF_INACTIVE_CLASS = 'bg-gray-50 text-gray-300 border border-gray-100';

function StageStatusCell({ stages }: { stages: SODashboardRow['stageStatus'] }) {
  if (!stages || stages.length === 0) {
    return <span className="text-[10px] text-gray-300 italic">No batches yet</span>;
  }
  const anyActive = stages.some((s) => s.qty > 0);
  return (
    <div className="flex gap-0.5 min-w-[168px]" title="FG Ready → Packed → Invoiced → Shipped">
      {stages.map((s) => {
        const active = s.qty > 0;
        const cfg = FF_STAGE_CONFIG[s.key];
        return (
          <div
            key={s.key}
            title={`${s.label}: ${s.qty.toLocaleString('en-IN')} units`}
            className={`flex-1 rounded px-1 py-0.5 text-center ${active ? (cfg?.activeClass ?? FF_INACTIVE_CLASS) : FF_INACTIVE_CLASS}`}
          >
            <div className="text-[8.5px] font-semibold leading-none whitespace-nowrap">{cfg?.short ?? s.label}</div>
            <div className="text-[10px] font-bold leading-tight tabular-nums mt-0.5">
              {active ? fmtNum(s.qty) : '—'}
            </div>
          </div>
        );
      })}
      {!anyActive && (
        <span className="absolute text-[10px] text-gray-300 italic hidden">Awaiting batches</span>
      )}
    </div>
  );
}

// ─── Batch Stage Cell (Planning / Procurement / Production / Ready) ────────────
const BATCH_STAGE_CONFIG: Record<string, { short: string; activeClass: string }> = {
  PLANNING:    { short: 'Plan',    activeClass: 'bg-slate-100 text-slate-600 border border-slate-200' },
  PROCUREMENT: { short: 'Proc',    activeClass: 'bg-blue-50 text-blue-600 border border-blue-200' },
  PRODUCTION:  { short: 'Prod',    activeClass: 'bg-amber-50 text-amber-700 border border-amber-200' },
  FG_READY:    { short: 'Ready',   activeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
};
const FULFILLMENT_PILL_CLASS: Record<string, string> = {
  PACKED:   'bg-orange-50 text-orange-700 border border-orange-200',
  INVOICED: 'bg-purple-50 text-purple-700 border border-purple-200',
  SHIPPED:  'bg-teal-50 text-teal-700 border border-teal-200',
};
const PROD_STAGES = ['PLANNING', 'PROCUREMENT', 'PRODUCTION', 'FG_READY'] as const;

function BatchStageBar({ pills, total }: { pills: SODashboardRow['batchPills']; total: number }) {
  if (!pills || (pills.length === 0 && total === 0)) {
    return <span className="text-[10px] text-gray-300 italic">No batches</span>;
  }

  // Count batches per production stage from visible pills
  const stageCounts: Record<string, number> = {};
  const postProdPills: typeof pills = [];
  for (const p of pills) {
    if ((PROD_STAGES as readonly string[]).includes(p.stage)) {
      stageCounts[p.stage] = (stageCounts[p.stage] ?? 0) + 1;
    } else {
      postProdPills.push(p);
    }
  }

  const anyProd = PROD_STAGES.some((s) => (stageCounts[s] ?? 0) > 0);

  return (
    <div className="flex flex-col gap-1 min-w-[148px]">
      {/* 4-slot production stage bar */}
      <div className="flex gap-0.5">
        {PROD_STAGES.map((key) => {
          const count = stageCounts[key] ?? 0;
          const cfg = BATCH_STAGE_CONFIG[key];
          return (
            <div
              key={key}
              title={`${key}: ${count} batch${count !== 1 ? 'es' : ''}`}
              className={`flex-1 rounded px-1 py-0.5 text-center ${count > 0 ? cfg.activeClass : 'bg-gray-50 text-gray-200 border border-gray-100'}`}
            >
              <div className="text-[8.5px] font-semibold leading-none">{cfg.short}</div>
              <div className="text-[10px] font-bold leading-tight">{count > 0 ? count : '—'}</div>
            </div>
          );
        })}
      </div>
      {/* Post-production (dispatched) pills */}
      {postProdPills.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {postProdPills.slice(0, 3).map((p) => (
            <span
              key={p.bprNo}
              title={`${p.batchNo} — ${p.stageLabel}`}
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${FULFILLMENT_PILL_CLASS[p.stage] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`}
            >
              {p.batchNo}
            </span>
          ))}
        </div>
      )}
      {/* Overflow count */}
      {total > pills.length && (
        <span className="text-[9px] text-gray-400">+{total - pills.length} more batch{total - pills.length !== 1 ? 'es' : ''}</span>
      )}
      {!anyProd && postProdPills.length === 0 && total > 0 && (
        <span className="text-[9px] text-gray-400 italic">{total} batch{total !== 1 ? 'es' : ''} (loading…)</span>
      )}
    </div>
  );
}

// ─── Row actions menu ───────────────────────────────────────────────────────
type RowActionKey = 'detail' | 'edit' | 'pick' | 'invoice' | 'ship' | 'track' | 'cancel' | 'manual_fulfill';

interface RowActionsProps {
  open: boolean;
  onToggle: () => void;
  onAction: (action: RowActionKey) => void;
}
function RowActions({ open, onToggle, onAction }: RowActionsProps) {
  const items: Array<{ key: RowActionKey; label: string; Icon: typeof Eye; danger?: boolean }> = [
    { key: 'detail',         label: 'View details',        Icon: Eye },
    { key: 'edit',           label: 'Edit SO',             Icon: Pencil },
    { key: 'pick',           label: 'Pick / Pack',         Icon: PackageCheck },
    { key: 'invoice',        label: 'Generate invoice',    Icon: FileText },
    { key: 'ship',           label: 'Ship',                Icon: Truck },
    { key: 'track',          label: 'Track delivery',      Icon: MapPin },
    { key: 'manual_fulfill', label: 'Mark as fulfilled',   Icon: CheckCircle2 },
    { key: 'cancel',         label: 'Cancel SO',           Icon: XCircle, danger: true },
  ];
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`p-1.5 rounded-lg transition-colors ${open ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
        title="Actions"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 w-48 rounded-lg border border-gray-200 bg-white shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map(({ key, label, Icon, danger }) => (
            <button
              key={key}
              onClick={() => onAction(key)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left ${
                danger
                  ? 'text-red-600 hover:bg-red-50 border-t border-gray-100 mt-1 pt-2'
                  : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700'
              }`}
            >
              <Icon size={13} className={`shrink-0 ${danger ? 'text-red-400' : 'text-gray-400'}`} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────
type ConfirmActionType = 'cancel' | 'manual_fulfill';
interface ConfirmState { id: number; soNo: string; type: ConfirmActionType }

function ConfirmDialog({
  state,
  onClose,
  onConfirm,
  loading,
}: {
  state: ConfirmState;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const isCancel = state.type === 'cancel';
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-6 w-full max-w-sm pointer-events-auto">
          <div className="flex items-start gap-3 mb-3">
            <div className={`mt-0.5 p-1.5 rounded-full ${isCancel ? 'bg-red-100' : 'bg-green-100'}`}>
              {isCancel
                ? <AlertTriangle size={16} className="text-red-600" />
                : <CheckCircle2 size={16} className="text-green-600" />}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">
                {isCancel ? 'Cancel Sales Order' : 'Mark as Manually Fulfilled'}
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">{state.soNo}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-5">
            {isCancel
              ? 'This will set SO status and commercial status to "Cancelled" and freeze all further changes. This cannot be undone from the dashboard.'
              : 'This will mark the SO as fully fulfilled and close it. Status will be set to "Closed" and frozen. Use this for SOs completed outside normal workflow.'}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Go back
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-3 py-2 text-sm rounded-lg font-semibold text-white disabled:opacity-60 ${
                isCancel ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {loading ? 'Processing…' : isCancel ? 'Yes, Cancel SO' : 'Yes, Mark Fulfilled'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────
export interface SODashboardViewProps {
  saleOrders: SaleOrder[];
  onAddSO: (data: AddSOData) => void;
  onUpdateSO: (soNo: string, data: SoUpdatePayload) => Promise<void> | void;
  onPickConfirm: (soNo: string, data: PickData) => void | Promise<SaleOrder | void>;
  onGenerateInvoice: (soNo: string, data: InvoiceData) => void | Promise<void>;
  onDispatch: (soNo: string, data: ShipData) => void;
  onConfirmDelivery: (soNo: string, data: DeliveryData) => void;
  initialOpenSoNo?: string | null;
  onDeepLinkSoConsumed?: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const SODashboardView: React.FC<SODashboardViewProps> = ({
  saleOrders, onAddSO, onUpdateSO, onPickConfirm, onGenerateInvoice, onDispatch, onConfirmDelivery,
  initialOpenSoNo = null, onDeepLinkSoConsumed,
}) => {
  const [rows, setRows] = useState<SODashboardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Server-side pagination (page/page_size backed by the sales-orders-dashboard endpoint).
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CommercialStatus | 'all'>('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Comments panel
  const [commentTarget, setCommentTarget] = useState<{ id: number; label: string } | null>(null);

  // Client group collapse + row action menu
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  // Cancel / manual-fulfill confirm
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const actionsRef = useRef<SoActionModalsHandle>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = [statusFilter];
      if (flaggedOnly) params.flagged_only = true;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      params.page = page;
      params.page_size = pageSize;
      const res = await fetchSalesOrdersDashboard(params as any);
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError('Failed to load SO dashboard');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, flaggedOnly, dateFrom, dateTo, page, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Any filter or page-size change resets to page 1 (no-op when already on page 1, so no double fetch).
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, flaggedOnly, dateFrom, dateTo, pageSize]);

  // If the result set shrinks below the current page, snap back to the last valid page.
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!initialOpenSoNo) return;
    const exists = saleOrders.some((o) => o.soNo === initialOpenSoNo);
    if (!exists) return;
    actionsRef.current?.openDetail(initialOpenSoNo);
    onDeepLinkSoConsumed?.();
  }, [initialOpenSoNo, saleOrders, onDeepLinkSoConsumed]);

  // Group rows by client name
  type ClientGroup = { clientKey: string; clientName: string; clientCode: string | null; rows: SODashboardRow[]; totalValue: number };
  const groups: ClientGroup[] = [];
  const seenClients = new Map<string, ClientGroup>();
  for (const row of rows) {
    const key = row.customer.name.toLowerCase().trim();
    if (!seenClients.has(key)) {
      const g: ClientGroup = { clientKey: key, clientName: row.customer.name, clientCode: row.customer.code, rows: [], totalValue: 0 };
      groups.push(g);
      seenClients.set(key, g);
    }
    const g = seenClients.get(key)!;
    g.rows.push(row);
    g.totalValue += row.soValue;
  }

  const toggleClient = (key: string) => {
    setCollapsedClients((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const runAction = (soNo: string, action: 'detail' | 'edit' | 'pick' | 'invoice' | 'ship' | 'track') => {
    setMenuOpenId(null);
    const r = actionsRef.current;
    if (!r) return;
    switch (action) {
      case 'detail':  r.openDetail(soNo); break;
      case 'edit':    r.openEdit(soNo); break;
      case 'pick':    r.openPick(soNo); break;
      case 'invoice': r.openInvoice(soNo); break;
      case 'ship':    r.openShip(soNo); break;
      case 'track':   r.openTrack(soNo); break;
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmState) return;
    setConfirmLoading(true);
    try {
      if (confirmState.type === 'cancel') {
        await cancelFulfillmentOrder(confirmState.id);
      } else {
        await manualFulfillFulfillmentOrder(confirmState.id);
      }
      setConfirmState(null);
      void load();
    } catch (e) {
      console.error('SO action failed:', e);
      alert('Operation failed. Please try again.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const COL_COUNT = 10;

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search SO no, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CommercialStatus | 'all')}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            {COMMERCIAL_STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              title="Due date from" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              title="Due date to" />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)}
                className="w-4 h-4 rounded accent-orange-500" />
              <span className="text-sm text-gray-700">Overdue only</span>
            </label>
            <button onClick={load} title="Refresh" className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {total === 0
              ? 'No orders'
              : `Showing ${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + rows.length} of ${total} orders`}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-xs text-gray-500 px-1 tabular-nums">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600 bg-white"
              title="Orders per page"
            >
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}/page</option>)}
            </select>
            <button onClick={() => { setSearch(''); setStatusFilter('all'); setFlaggedOnly(false); setDateFrom(''); setDateTo(''); }}
              className="text-xs text-gray-500 hover:text-gray-800 underline">Clear filters</button>
            <button
              onClick={() => actionsRef.current?.openAdd()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> New Sale Order
            </button>
          </div>
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
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <Package size={32} className="mb-2 opacity-30" />
          <p className="text-sm">No orders found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 w-8" />
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">SO No</th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Product</th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap text-right">Order Qty</th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap text-right">Price/U</th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap text-right">Amount</th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Fulfillment Status</th>
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Batch Stage</th>
                <th className="px-3 py-2 w-16 text-[10px] font-bold text-gray-500 uppercase tracking-wide text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.map((group) => {
                const collapsed = collapsedClients.has(group.clientKey);
                const groupOverdue = group.rows.some((r) => r.slaFlag.overdue);
                return (
                  <React.Fragment key={group.clientKey}>
                    {/* Client header row */}
                    <tr
                      className="bg-gray-50/80 border-y border-gray-200 cursor-pointer hover:bg-gray-100/80 transition-colors"
                      onClick={() => toggleClient(group.clientKey)}
                    >
                      <td className="px-3 py-2">
                        {collapsed
                          ? <ChevronRight size={14} className="text-gray-400" />
                          : <ChevronDown size={14} className="text-gray-400" />
                        }
                      </td>
                      <td colSpan={COL_COUNT - 1} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-800">{group.clientName}</span>
                          {group.clientCode && (
                            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">{group.clientCode}</span>
                          )}
                          <span className="text-[10px] text-gray-400">{group.rows.length} order{group.rows.length !== 1 ? 's' : ''}</span>
                          <span className="text-[10px] font-semibold text-gray-600">· {formatLakhs(group.totalValue)}</span>
                          {groupOverdue && <AlertCircle size={12} className="text-red-500" />}
                        </div>
                      </td>
                    </tr>
                    {/* SO rows */}
                    {!collapsed && group.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-orange-50/30 transition-colors align-top">
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button
                            onClick={() => runAction(row.soNo, 'detail')}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline decoration-dotted"
                            title="Open SO detail"
                          >
                            {row.soNo}
                          </button>
                          <p className="text-[10px] text-gray-400">{fmtDate(row.soDate)}</p>
                          {row.slaFlag?.overdue && (
                            <p className="text-[9.5px] text-red-500 font-semibold mt-0.5">
                              {row.slaFlag.daysOverdue}d overdue
                            </p>
                          )}
                        </td>
                        {/* Product — allow wrap, no truncate */}
                        <td className="px-3 py-2 min-w-[180px] max-w-[260px]">
                          {row.product ? (
                            <>
                              <p className="text-xs text-gray-800 leading-snug break-words" title={row.product.name}>
                                {row.product.name}
                              </p>
                              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                                {row.product.code}
                                {row.product.extraCount > 0 ? ` +${row.product.extraCount} more` : ''}
                              </p>
                            </>
                          ) : <span className="text-[10px] text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <CommercialBadge status={row.commercialStatus} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <span className="text-xs tabular-nums text-gray-700">{row.totalOrderedQty.toLocaleString('en-IN')}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <span className="text-xs tabular-nums text-gray-600">{row.unitPrice > 0 ? fmtMoney(row.unitPrice) : '—'}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <span className="text-xs tabular-nums font-semibold text-gray-800">{row.soValue > 0 ? formatLakhs(row.soValue) : '—'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <StageStatusCell stages={row.stageStatus} />
                        </td>
                        <td className="px-3 py-2">
                          <BatchStageBar pills={row.batchPills} total={row.batchPillsTotal} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              onClick={() => setCommentTarget({ id: row.id, label: row.soNo })}
                              className="relative p-1.5 rounded-lg hover:bg-orange-100 text-gray-400 hover:text-orange-600 transition-colors"
                              title="Comments & history"
                            >
                              <MessageSquare size={14} />
                              {row.commentCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                                  {row.commentCount > 9 ? '9+' : row.commentCount}
                                </span>
                              )}
                            </button>
                            <RowActions
                              open={menuOpenId === row.id}
                              onToggle={() => setMenuOpenId((prev) => (prev === row.id ? null : row.id))}
                              onAction={(action) => {
                                setMenuOpenId(null);
                                if (action === 'cancel' || action === 'manual_fulfill') {
                                  setConfirmState({ id: row.id, soNo: row.soNo, type: action });
                                } else {
                                  runAction(row.soNo, action);
                                }
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Click-away for row action menu */}
      {menuOpenId !== null && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuOpenId(null)} />
      )}

      {/* Cancel / Manual-fulfill confirm dialog */}
      {confirmState && (
        <ConfirmDialog
          state={confirmState}
          onClose={() => !confirmLoading && setConfirmState(null)}
          onConfirm={handleConfirmAction}
          loading={confirmLoading}
        />
      )}

      {/* Operational modals */}
      <SoActionModals
        ref={actionsRef}
        saleOrders={saleOrders}
        onAddSO={onAddSO}
        onUpdateSO={onUpdateSO}
        onPickConfirm={onPickConfirm}
        onGenerateInvoice={onGenerateInvoice}
        onDispatch={onDispatch}
        onConfirmDelivery={onConfirmDelivery}
        onAfterChange={load}
      />

      {/* Comments panel */}
      {commentTarget && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setCommentTarget(null)} />
          <CommentsPanel
            entityType="so"
            entityId={commentTarget.id}
            entityLabel={commentTarget.label}
            onClose={() => setCommentTarget(null)}
          />
        </>
      )}
    </>
  );
};
