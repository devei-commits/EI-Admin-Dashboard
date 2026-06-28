import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, AlertCircle, MessageSquare, RefreshCw, ChevronDown, ChevronRight,
  Package, Loader2, Plus, MoreVertical, Eye, Pencil, PackageCheck, FileText, Truck, MapPin,
} from 'lucide-react';
import type {
  SODashboardRow, CommercialStatus,
  SaleOrder, AddSOData, PickData, InvoiceData, ShipData, DeliveryData,
} from '../../types/orderFulfillment';
import { fetchSalesOrdersDashboard } from '../../services/fulfillment.service';
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

const STAGE_DOT: Record<string, string> = {
  fg_ready: 'bg-emerald-400',
  packed: 'bg-amber-400',
  invoiced: 'bg-purple-400',
  shipped: 'bg-teal-400',
};

/** Merged fulfillment-status cell: one line per stage, in batches + batch units (not KG). */
function StageStatusCell({ stages }: { stages: SODashboardRow['stageStatus'] }) {
  if (!stages || stages.every((s) => s.batches === 0)) {
    return <span className="text-[10px] text-gray-300">Not started</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {stages.map((s) => {
        const active = s.batches > 0;
        return (
          <div key={s.key} className="flex items-center gap-1.5 text-[10px] leading-tight">
            <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${active ? STAGE_DOT[s.key] : 'bg-gray-200'}`} />
            <span className={`w-14 shrink-0 ${active ? 'text-gray-600 font-medium' : 'text-gray-300'}`}>{s.label}</span>
            {active ? (
              <span className="tabular-nums text-gray-700 whitespace-nowrap">
                {s.batches} batch{s.batches !== 1 ? 'es' : ''} · {fmtNum(s.qty)}
              </span>
            ) : (
              <span className="text-gray-300">—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BatchPills({ pills, total }: { pills: SODashboardRow['batchPills']; total: number }) {
  const stageColors: Record<string, string> = {
    PLANNING: 'bg-gray-100 text-gray-600 border-gray-200',
    PROCUREMENT: 'bg-blue-50 text-blue-600 border-blue-200',
    PRODUCTION: 'bg-amber-50 text-amber-700 border-amber-200',
    FG_READY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PACKED: 'bg-orange-50 text-orange-700 border-orange-200',
    INVOICED: 'bg-purple-50 text-purple-700 border-purple-200',
    SHIPPED: 'bg-teal-50 text-teal-700 border-teal-200',
  };
  return (
    <div className="flex flex-wrap gap-1">
      {pills.map((p) => (
        <span
          key={p.bprNo}
          title={`${p.batchNo} — ${p.stageLabel}`}
          className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9.5px] font-medium ${stageColors[p.stage] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
        >
          {p.batchNo} · {p.stageLabel}
        </span>
      ))}
      {total > 3 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-gray-100 text-gray-500 border-gray-200 text-[9.5px]">
          +{total - 3}
        </span>
      )}
    </div>
  );
}

// ─── Row actions menu ───────────────────────────────────────────────────────
type RowActionKey = 'detail' | 'edit' | 'pick' | 'invoice' | 'ship' | 'track';
interface RowActionsProps {
  open: boolean;
  onToggle: () => void;
  onAction: (action: RowActionKey) => void;
}
function RowActions({ open, onToggle, onAction }: RowActionsProps) {
  const items: Array<{ key: RowActionKey; label: string; Icon: typeof Eye }> = [
    { key: 'detail', label: 'View details', Icon: Eye },
    { key: 'edit', label: 'Edit SO', Icon: Pencil },
    { key: 'pick', label: 'Pick / Pack', Icon: PackageCheck },
    { key: 'invoice', label: 'Generate invoice', Icon: FileText },
    { key: 'ship', label: 'Ship', Icon: Truck },
    { key: 'track', label: 'Track delivery', Icon: MapPin },
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
          className="absolute right-0 top-full mt-1 z-30 w-44 rounded-lg border border-gray-200 bg-white shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => onAction(key)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors text-left"
            >
              <Icon size={13} className="shrink-0 text-gray-400" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────
export interface SODashboardViewProps {
  /** Full (unfiltered) sale orders — used to resolve a row's SO for operational actions. */
  saleOrders: SaleOrder[];
  onAddSO: (data: AddSOData) => void;
  onUpdateSO: (soNo: string, data: SoUpdatePayload) => Promise<void> | void;
  onPickConfirm: (soNo: string, data: PickData) => void | Promise<SaleOrder | void>;
  onGenerateInvoice: (soNo: string, data: InvoiceData) => void | Promise<void>;
  onDispatch: (soNo: string, data: ShipData) => void;
  onConfirmDelivery: (soNo: string, data: DeliveryData) => void;
  /** Deep-link: open this SO's detail once data is available (e.g. /fulfillment?so=SO-123). */
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
      const res = await fetchSalesOrdersDashboard(params as any);
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError('Failed to load SO dashboard');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, flaggedOnly, dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Deep-link: open the SO detail once its full order has loaded into saleOrders.
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
      case 'detail': r.openDetail(soNo); break;
      case 'edit': r.openEdit(soNo); break;
      case 'pick': r.openPick(soNo); break;
      case 'invoice': r.openInvoice(soNo); break;
      case 'ship': r.openShip(soNo); break;
      case 'track': r.openTrack(soNo); break;
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
              placeholder="From" title="Due date from" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="To" title="Due date to" />
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
          <span className="text-xs text-gray-500">Showing {rows.length} of {total} orders</span>
          <div className="flex items-center gap-3">
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
                <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Batch — Stage</th>
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
                      <tr key={row.id} className="hover:bg-orange-50/30 transition-colors">
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
                        </td>
                        <td className="px-3 py-2 max-w-[160px]">
                          {row.product ? (
                            <>
                              <p className="text-xs text-gray-800 truncate" title={row.product.name}>{row.product.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{row.product.code}{row.product.extraCount > 0 ? ` +${row.product.extraCount} more` : ''}</p>
                            </>
                          ) : <span className="text-[10px] text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <CommercialBadge status={row.commercialStatus} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <span className="text-xs tabular-nums text-gray-700">{fmtNum(row.totalOrderedQty)}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <span className="text-xs tabular-nums text-gray-600">{row.unitPrice > 0 ? fmtMoney(row.unitPrice) : '—'}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <span className="text-xs tabular-nums font-semibold text-gray-800">{row.soValue > 0 ? formatLakhs(row.soValue) : '—'}</span>
                        </td>
                        <td className="px-3 py-2 min-w-[150px]">
                          <StageStatusCell stages={row.stageStatus} />
                        </td>
                        <td className="px-3 py-2 min-w-[120px]">
                          <BatchPills pills={row.batchPills} total={row.batchPillsTotal} />
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
                              onAction={(action) => runAction(row.soNo, action)}
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

      {/* Click-away closer for the row action menu */}
      {menuOpenId !== null && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuOpenId(null)} />
      )}

      {/* Operational modals (Add / Detail / Edit / Pick / Invoice / Ship / Track) */}
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
