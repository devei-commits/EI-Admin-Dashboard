import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, AlertCircle, MessageSquare, RefreshCw, ChevronDown, ChevronRight,
  Package, Plus, MoreVertical, Eye, Pencil, PackageCheck, FileText, Truck, MapPin,
  XCircle, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import type {
  SODashboardRow, CommercialStatus, SalesOrderStatus,
  SaleOrder, AddSOData, PickData, InvoiceData, ShipData, DeliveryData,
} from '../../types/orderFulfillment';
import {
  fetchSalesOrdersDashboard,
  cancelFulfillmentOrder,
  manualFulfillFulfillmentOrder,
} from '../../services/fulfillment.service';
import { SALES_ORDER_STATUS_CONFIG, SALES_ORDER_STATUS_FILTER_OPTIONS } from '../../constants/orderFulfillment';
import { formatLakhs } from '../../utils/orderFulfillmentUtils';
import { CommentsPanel } from './CommentsPanel';
import { SoActionModals, type SoActionModalsHandle, type SoUpdatePayload } from './SoActionModals';
import { ProcSectionHeader, ProcFilterBar, ProcThead, ProcTableCard } from '../procurement/ProcSection';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';

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

// The Status column shows the authoritative order status (sales_orders.status) — the same 5 values
// Edit SO → "Update SO Status" sets. Legacy rows without orderStatus fall back from commercial_status.
const ORDER_STATUS_FROM_COMMERCIAL: Record<CommercialStatus, SalesOrderStatus> = {
  draft: 'Draft', received: 'Confirmed', advance_pending: 'Confirmed', under_review: 'Confirmed',
  approved: 'Approved', partial_closed: 'Approved', closed: 'Closed', on_hold: 'Confirmed', cancelled: 'Cancelled',
};
function resolveOrderStatus(row: SODashboardRow): SalesOrderStatus {
  const raw = String(row.orderStatus ?? '').trim().toLowerCase();
  const known = (Object.keys(SALES_ORDER_STATUS_CONFIG) as SalesOrderStatus[]).find((k) => k.toLowerCase() === raw);
  return known ?? ORDER_STATUS_FROM_COMMERCIAL[row.commercialStatus] ?? 'Draft';
}
function OrderStatusBadge({ status }: { status: SalesOrderStatus }) {
  const cfg = SALES_ORDER_STATUS_CONFIG[status] ?? SALES_ORDER_STATUS_CONFIG.Draft;
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
  fg_ready: { short: 'FG Ready',  activeClass: 'bg-ok-soft text-ok border border-[color:var(--st-green-fg)]/30' },
  packed:   { short: 'Packed',    activeClass: 'bg-warn-soft text-warn border border-[color:var(--st-amber-fg)]/30' },
  invoiced: { short: 'Invoiced',  activeClass: 'bg-brand-soft text-brand border border-brand-soft' },
  shipped:  { short: 'Shipped',   activeClass: 'bg-brand-soft text-brand border border-brand-soft' },
};
const FF_INACTIVE_CLASS = 'bg-surface-3 text-ink-4 border border-hairline';

function StageStatusCell({ stages }: { stages: SODashboardRow['stageStatus'] }) {
  if (!stages || stages.length === 0) {
    return <span className="text-[10px] text-ink-4 italic">No batches yet</span>;
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
        <span className="absolute text-[10px] text-ink-4 italic hidden">Awaiting batches</span>
      )}
    </div>
  );
}

// ─── Batch Stage Cell (Planning / Procurement / Production / Ready) ────────────
const BATCH_STAGE_CONFIG: Record<string, { short: string; activeClass: string }> = {
  PLANNING:    { short: 'Plan',    activeClass: 'bg-surface-3 text-ink-3 border border-border' },
  PROCUREMENT: { short: 'Proc',    activeClass: 'bg-brand-soft text-brand border border-brand-soft' },
  PRODUCTION:  { short: 'Prod',    activeClass: 'bg-warn-soft text-warn border border-[color:var(--st-amber-fg)]/30' },
  FG_READY:    { short: 'Ready',   activeClass: 'bg-ok-soft text-ok border border-[color:var(--st-green-fg)]/30' },
};
const FULFILLMENT_PILL_CLASS: Record<string, string> = {
  PACKED:   'bg-brand-soft text-brand border border-brand-soft',
  INVOICED: 'bg-brand-soft text-brand border border-brand-soft',
  SHIPPED:  'bg-brand-soft text-brand border border-brand-soft',
};
const PROD_STAGES = ['PLANNING', 'PROCUREMENT', 'PRODUCTION', 'FG_READY'] as const;

function BatchStageBar({ pills, total }: { pills: SODashboardRow['batchPills']; total: number }) {
  if (!pills || (pills.length === 0 && total === 0)) {
    return <span className="text-[10px] text-ink-4 italic">No batches</span>;
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
              className={`flex-1 rounded px-1 py-0.5 text-center ${count > 0 ? cfg.activeClass : 'bg-surface-3 text-ink-4 border border-hairline'}`}
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
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${FULFILLMENT_PILL_CLASS[p.stage] ?? 'bg-surface-3 text-ink-3 border border-border'}`}
            >
              {p.batchNo}
            </span>
          ))}
        </div>
      )}
      {/* Overflow count */}
      {total > pills.length && (
        <span className="text-[9px] text-ink-4">+{total - pills.length} more batch{total - pills.length !== 1 ? 'es' : ''}</span>
      )}
      {!anyProd && postProdPills.length === 0 && total > 0 && (
        <span className="text-[9px] text-ink-4 italic">{total} batch{total !== 1 ? 'es' : ''} (loading…)</span>
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
        className={`p-1.5 rounded-lg transition-colors ${open ? 'bg-brand-soft text-brand' : 'text-ink-4 hover:bg-surface-3 hover:text-ink-2'}`}
        title="Actions"
        aria-label="Actions"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 w-48 rounded-lg border border-border bg-surface shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map(({ key, label, Icon, danger }) => (
            <button
              key={key}
              onClick={() => onAction(key)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left ${
                danger
                  ? 'text-err hover:bg-err-soft border-t border-hairline mt-1 pt-2'
                  : 'text-ink-2 hover:bg-brand-soft hover:text-brand'
              }`}
            >
              <Icon size={13} className={`shrink-0 ${danger ? 'text-err' : 'text-ink-4'}`} />
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="so-confirm-dialog-title"
          className="bg-surface rounded-xl border border-border shadow-xl p-6 w-full max-w-sm pointer-events-auto"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className={`mt-0.5 p-1.5 rounded-full ${isCancel ? 'bg-err-soft' : 'bg-ok-soft'}`}>
              {isCancel
                ? <AlertTriangle size={16} className="text-err" />
                : <CheckCircle2 size={16} className="text-ok" />}
            </div>
            <div>
              <h3 id="so-confirm-dialog-title" className="font-bold text-ink text-sm">
                {isCancel ? 'Cancel Sales Order' : 'Mark as Manually Fulfilled'}
              </h3>
              <p className="text-[11px] text-ink-3 mt-0.5">{state.soNo}</p>
            </div>
          </div>
          <p className="text-sm text-ink-3 mb-5">
            {isCancel
              ? 'This will set SO status and commercial status to "Cancelled" and freeze all further changes. This cannot be undone from the dashboard.'
              : 'This will mark the SO as fully fulfilled and close it. Status will be set to "Closed" and frozen. Use this for SOs completed outside normal workflow.'}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-3 py-2 text-sm rounded-lg border border-border text-ink-2 hover:bg-surface-3 disabled:opacity-60"
            >
              Go back
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-3 py-2 text-sm rounded-lg font-semibold text-white disabled:opacity-60 ${
                isCancel ? 'bg-err hover:opacity-90' : 'bg-ok hover:opacity-90'
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
  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | 'all'>('all');
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
      <ProcSectionHeader
        icon={<Package className="w-4 h-4 shrink-0" />}
        title="Sale Orders"
        stats={[{ value: total, label: 'sale orders' }]}
        actions={
          <button
            onClick={() => actionsRef.current?.openAdd()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-press transition-colors"
          >
            <Plus size={14} /> New Sale Order
          </button>
        }
      />
      {/* Toolbar */}
      <ProcFilterBar stack className="mb-4 mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" size={15} />
            <input
              type="text"
              placeholder="Search SO no, customer…"
              aria-label="Search SO no, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[color:var(--ring)] focus:border-brand text-sm bg-surface"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SalesOrderStatus | 'all')}
            aria-label="Filter by status"
            className="px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-[color:var(--ring)] focus:border-brand"
          >
            {SALES_ORDER_STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <div className="flex gap-2 min-w-[230px]">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-[color:var(--ring)] focus:border-brand"
              title="Due date from" aria-label="Due date from" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-[color:var(--ring)] focus:border-brand"
              title="Due date to" aria-label="Due date to" />
          </div>
          <div className="flex items-center gap-3 ml-auto shrink-0">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)}
                className="w-4 h-4 rounded accent-[color:var(--accent)]" />
              <span className="text-sm text-ink-2 whitespace-nowrap">Overdue only</span>
            </label>
            <button onClick={load} title="Refresh" aria-label="Refresh" className="p-2 rounded-lg border border-border hover:bg-surface-3 text-ink-3">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-ink-3">
            {total === 0
              ? 'No orders'
              : `Showing ${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + rows.length} of ${total} orders`}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded border border-border text-xs text-ink-3 hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-xs text-ink-3 px-1 tabular-nums">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 rounded border border-border text-xs text-ink-3 hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="text-xs border border-border rounded px-1.5 py-1 text-ink-3 bg-surface"
              title="Orders per page"
              aria-label="Orders per page"
            >
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}/page</option>)}
            </select>
            <button onClick={() => { setSearch(''); setStatusFilter('all'); setFlaggedOnly(false); setDateFrom(''); setDateTo(''); }}
              className="text-xs text-ink-3 hover:text-ink underline">Clear filters</button>
          </div>
        </div>
      </ProcFilterBar>

      {/* Table */}
      {loading ? (
        <ProcTableCard>
          <tbody><tr><td className="p-5"><TableSkeleton rows={8} cols={10} /></td></tr></tbody>
        </ProcTableCard>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : groups.length === 0 ? (
        <EmptyState icon={<Package size={32} />} title="No orders found" />
      ) : (
        <ProcTableCard>
            <ProcThead
              cols={['', 'SO No', 'Product', 'Status', { label: 'Order Qty', align: 'right' }, { label: 'Price/U', align: 'right' }, { label: 'Amount', align: 'right' }, 'Fulfillment Status', 'Batch Stage', { label: 'Actions', align: 'center' }]}
            />
            <tbody className="divide-y divide-hairline">
              {groups.map((group) => {
                const collapsed = collapsedClients.has(group.clientKey);
                const groupOverdue = group.rows.some((r) => r.slaFlag.overdue);
                return (
                  <React.Fragment key={group.clientKey}>
                    {/* Client header row */}
                    <tr
                      className="bg-surface-3/80 border-y border-border cursor-pointer hover:bg-surface-3/80 transition-colors"
                      onClick={() => toggleClient(group.clientKey)}
                    >
                      <td className="px-3 py-2">
                        {collapsed
                          ? <ChevronRight size={14} className="text-ink-4" />
                          : <ChevronDown size={14} className="text-ink-4" />
                        }
                      </td>
                      <td colSpan={COL_COUNT - 1} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-ink">{group.clientName}</span>
                          {group.clientCode && (
                            <span className="text-[10px] bg-surface-3 text-ink-3 px-1.5 py-0.5 rounded font-mono">{group.clientCode}</span>
                          )}
                          <span className="text-[10px] text-ink-4">{group.rows.length} order{group.rows.length !== 1 ? 's' : ''}</span>
                          <span className="text-[10px] font-semibold text-ink-3">· {formatLakhs(group.totalValue)}</span>
                          {groupOverdue && <AlertCircle size={12} className="text-err" />}
                        </div>
                      </td>
                    </tr>
                    {/* SO rows */}
                    {!collapsed && group.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-brand-soft/30 transition-colors align-top">
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button
                            onClick={() => runAction(row.soNo, 'detail')}
                            className="text-xs font-semibold text-brand hover:text-brand hover:underline decoration-dotted"
                            title="Open SO detail"
                          >
                            {row.soNo}
                          </button>
                          <p className="text-[10px] text-ink-4">{fmtDate(row.soDate)}</p>
                          {row.slaFlag?.overdue && (
                            <p className="text-[9.5px] text-err font-semibold mt-0.5">
                              {row.slaFlag.daysOverdue}d overdue
                            </p>
                          )}
                        </td>
                        {/* Product — allow wrap, no truncate */}
                        <td className="px-3 py-2 min-w-[180px] max-w-[260px]">
                          {row.product ? (
                            <>
                              <p className="text-xs text-ink leading-snug break-words" title={row.product.name}>
                                {row.product.name}
                              </p>
                              <p className="text-[10px] text-ink-4 font-mono mt-0.5">
                                {row.product.code}
                                {row.product.extraCount > 0 ? ` +${row.product.extraCount} more` : ''}
                              </p>
                            </>
                          ) : <span className="text-[10px] text-ink-4">—</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <OrderStatusBadge status={resolveOrderStatus(row)} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <span className="text-xs tabular-nums text-ink-2">{row.totalOrderedQty.toLocaleString('en-IN')}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <span className="text-xs tabular-nums text-ink-3">{row.unitPrice > 0 ? fmtMoney(row.unitPrice) : '—'}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <span className="text-xs tabular-nums font-semibold text-ink">{row.soValue > 0 ? formatLakhs(row.soValue) : '—'}</span>
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
                              className="relative p-1.5 rounded-lg hover:bg-brand-soft text-ink-4 hover:text-brand transition-colors"
                              title="Comments & history"
                              aria-label="Comments & history"
                            >
                              <MessageSquare size={14} />
                              {row.commentCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-brand text-white text-[8px] font-bold rounded-full flex items-center justify-center">
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
        </ProcTableCard>
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
