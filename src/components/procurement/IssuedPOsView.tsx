/**
 * Issued POs tab — layout aligned with Order Fulfillment SaleOrdersView:
 * overview header, KPIs, pipeline strip, filters, vendor-grouped table, pagination.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  DollarSign,
  Factory,
  CheckCircle,
  FileText,
  Truck,
  X,
  Search,
} from 'lucide-react';
import { KPICard } from '../orders/KPICard';
import { PipelineStrip } from '../orders/PipelineStrip';
import { formatLakhs } from '../../utils/orderFulfillmentUtils';
import type { DraftPOLineItem, ProcurementRequest, RequestType } from '../../types/procurement.types';
import type { PoTrackingRecord } from '../../services/poTracking.service';

export type IssuedPOViewRecord = {
  request: ProcurementRequest;
  poNumber: string;
  vendor: string;
  status: 'Released' | 'In Transit' | 'At Risk';
  etaDays: number;
  etaDateDisplay?: string;
  lineItems: DraftPOLineItem[];
  grandTotal: number;
  requestCode: string;
  createdDate: string;
  paymentTerms: string;
  backendPoId?: string;
};

export type IssuedPoOverviewKpis = {
  totalPos: number;
  rmPos: number;
  pmPos: number;
  advancePending: number;
  inTransitCount: number;
  totalValue: number;
  pendingValue: number;
  stageCounts: number[];
  grnCompletePoCount: number;
};

const TIMELINE_STAGE_LABELS = [
  'PO Released',
  'Advance Paid',
  'Vendor Confirmed',
  'Shipped',
  'Delivered',
  'Under GRN',
  'GRN Complete',
] as const;

const STATUS_FILTER_CHIPS: { key: 'All' | IssuedPOViewRecord['status']; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Released', label: 'Released' },
  { key: 'In Transit', label: 'In Transit' },
  { key: 'At Risk', label: 'At Risk' },
];

function statusBadgeClass(status: IssuedPOViewRecord['status']): string {
  switch (status) {
    case 'In Transit':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'At Risk':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function typeBadgeClass(type: RequestType): string {
  return type === 'RM'
    ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
    : 'bg-violet-50 text-violet-700 border-violet-200';
}

export type IssuedPOsViewProps = {
  kpis: IssuedPoOverviewKpis;
  records: IssuedPOViewRecord[];
  categoryFilter: 'All' | RequestType;
  onCategoryFilterChange: (value: 'All' | RequestType) => void;
  issuedVendorFilter: string;
  onIssuedVendorFilterChange: (value: string) => void;
  vendorOptions: string[];
  issuedStatusFilter: 'All' | IssuedPOViewRecord['status'];
  onIssuedStatusFilterChange: (value: 'All' | IssuedPOViewRecord['status']) => void;
  issuedSearch: string;
  onIssuedSearchChange: (value: string) => void;
  issuedPoPipelineStageKey: string | null;
  onIssuedPoPipelineStageKeyChange: (value: string | null) => void;
  onClearFilters: () => void;
  getTimelineCompletedIndex: (record: IssuedPOViewRecord) => number;
  releasedPoTrackingByBackendId: Record<string, PoTrackingRecord> | undefined;
  resolveBackendPoId: (record: IssuedPOViewRecord) => string;
  hasPoTrackingTimestamp: (value: unknown) => boolean;
  onOpenDetail: (record: IssuedPOViewRecord) => void;
  onMarkVendorConfirmed: (record: IssuedPOViewRecord) => void;
  onMarkShipped: (record: IssuedPOViewRecord) => void;
  onReceiveGrn: (record: IssuedPOViewRecord) => void;
  onOpenGrnMonitor: () => void;
};

export default function IssuedPOsView({
  kpis,
  records,
  categoryFilter,
  onCategoryFilterChange,
  issuedVendorFilter,
  onIssuedVendorFilterChange,
  vendorOptions,
  issuedStatusFilter,
  onIssuedStatusFilterChange,
  issuedSearch,
  onIssuedSearchChange,
  issuedPoPipelineStageKey,
  onIssuedPoPipelineStageKeyChange,
  onClearFilters,
  getTimelineCompletedIndex,
  releasedPoTrackingByBackendId,
  resolveBackendPoId,
  hasPoTrackingTimestamp,
  onOpenDetail,
  onMarkVendorConfirmed,
  onMarkShipped,
  onReceiveGrn,
  onOpenGrnMonitor,
}: IssuedPOsViewProps): React.ReactElement {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const lineCount = useMemo(
    () => records.reduce((sum, r) => sum + r.lineItems.length, 0),
    [records],
  );

  const groupedByVendor = useMemo(() => {
    const map = new Map<string, IssuedPOViewRecord[]>();
    for (const record of records) {
      const vendorName = String(record.vendor ?? 'Unassigned Vendor').trim() || 'Unassigned Vendor';
      const list = map.get(vendorName) ?? [];
      list.push(record);
      map.set(vendorName, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([vendorName, orders]) => ({
        vendorName,
        orders,
        poCount: orders.length,
        lineCount: orders.reduce((sum, o) => sum + o.lineItems.length, 0),
        totalValue: orders.reduce((sum, o) => sum + o.grandTotal, 0),
      }));
  }, [records]);

  const totalPages = Math.max(1, Math.ceil(groupedByVendor.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pagedVendorGroups = useMemo(
    () => groupedByVendor.slice(startIndex, startIndex + pageSize),
    [groupedByVendor, startIndex, pageSize],
  );

  const pagedPoCount = useMemo(
    () => pagedVendorGroups.reduce((sum, g) => sum + g.poCount, 0),
    [pagedVendorGroups],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, issuedVendorFilter, issuedStatusFilter, issuedSearch, issuedPoPipelineStageKey, pageSize, records.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const hasActiveFilters =
    issuedSearch.trim() !== '' ||
    categoryFilter !== 'All' ||
    issuedVendorFilter !== 'All Vendors' ||
    issuedStatusFilter !== 'All' ||
    issuedPoPipelineStageKey != null;

  const k = kpis;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Issued POs Overview</h2>
          <p className="text-xs text-gray-500 mt-1">
            Purchase orders grouped by vendor — same layout as Order Fulfillment sale orders.
          </p>
        </div>
        <span className="text-xs text-gray-500">
          {lineCount} line{lineCount !== 1 ? 's' : ''} · {records.length} PO
          {records.length !== 1 ? 's' : ''} · {groupedByVendor.length} vendor
          {groupedByVendor.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 pt-4">
        <KPICard label="Total POs" value={String(k.totalPos)} icon={<ShoppingCart size={20} />} color="#3b82f6" />
        <KPICard label="Total Value" value={formatLakhs(k.totalValue)} icon={<DollarSign size={20} />} color="#10b981" />
        <KPICard label="RM POs" value={String(k.rmPos)} icon={<Factory size={20} />} color="#f59e0b" />
        <KPICard label="PM POs" value={String(k.pmPos)} icon={<Package size={20} />} color="#8b5cf6" />
        <KPICard label="Advance Pending" value={String(k.advancePending)} icon={<FileText size={20} />} color="#f97316" />
        <KPICard label="In Transit" value={String(k.inTransitCount)} icon={<Truck size={20} />} color="#ea580c" />
        <KPICard label="GRN Complete" value={String(k.grnCompletePoCount)} icon={<CheckCircle size={20} />} color="#14b8a6" />
        <KPICard label="Pending Value" value={formatLakhs(k.pendingValue)} icon={<TrendingUp size={20} />} color="#ef4444" />
      </div>

      <PipelineStrip
        stages={[
          { key: 'issued-0', label: 'Released', count: k.stageCounts[0] ?? 0, icon: null },
          { key: 'issued-1', label: 'Advance', count: k.stageCounts[1] ?? 0, icon: null },
          { key: 'issued-2', label: 'Confirmed', count: k.stageCounts[2] ?? 0, icon: null },
          { key: 'issued-3', label: 'Shipped', count: k.stageCounts[3] ?? 0, icon: null },
          { key: 'issued-4', label: 'Delivered', count: k.stageCounts[4] ?? 0, icon: null },
          { key: 'issued-5', label: 'Under GRN', count: k.stageCounts[5] ?? 0, icon: null },
          { key: 'issued-6', label: 'Complete', count: k.stageCounts[6] ?? 0, icon: null },
        ]}
        onStageClick={(stage) =>
          onIssuedPoPipelineStageKeyChange(stage === issuedPoPipelineStageKey ? null : stage)
        }
      />

      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-600 shrink-0">Category</span>
          <button
            type="button"
            onClick={() => onCategoryFilterChange('All')}
            className={`px-3 py-1 rounded-full border text-xs font-semibold transition-all ${
              categoryFilter === 'All'
                ? 'text-orange-600 bg-orange-50 border-orange-300 shadow-sm'
                : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {(['RM', 'PM'] as RequestType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onCategoryFilterChange(type)}
              className={`px-3 py-1 rounded-full border text-xs font-semibold transition-all ${
                categoryFilter === type
                  ? 'text-orange-600 bg-orange-50 border-orange-300 shadow-sm'
                  : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <select
            value={issuedVendorFilter}
            onChange={(e) => onIssuedVendorFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="All Vendors">All vendors</option>
            {vendorOptions.map((vendor) => (
              <option key={vendor} value={vendor}>
                {vendor}
              </option>
            ))}
          </select>

          <select
            value={issuedStatusFilter}
            onChange={(e) =>
              onIssuedStatusFilterChange(e.target.value as 'All' | IssuedPOViewRecord['status'])
            }
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            {STATUS_FILTER_CHIPS.map((chip) => (
              <option key={chip.key} value={chip.key}>
                {chip.label === 'All' ? 'All status' : chip.label}
              </option>
            ))}
          </select>

          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={issuedSearch}
              onChange={(e) => onIssuedSearchChange(e.target.value)}
              placeholder="Search PO no, vendor, item, request..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 underline flex items-center gap-1"
            >
              <X size={14} aria-hidden />
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      {records.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">PO / Request</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Item</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Qty</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Pipeline
                    <div className="text-[10px] font-normal normal-case tracking-normal text-gray-500">
                      PO lifecycle stage
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">ETA</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Value</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Tracking</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pagedVendorGroups.flatMap((vendorGroup) => {
                  const headerRow = (
                    <tr key={`vendor-${vendorGroup.vendorName}`} className="bg-blue-50/60">
                      <td colSpan={8} className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-blue-900">{vendorGroup.vendorName}</div>
                          <div className="text-xs text-blue-800">
                            {vendorGroup.poCount} PO{vendorGroup.poCount !== 1 ? 's' : ''} ·{' '}
                            {vendorGroup.lineCount} line{vendorGroup.lineCount !== 1 ? 's' : ''} ·{' '}
                            <span className="font-semibold text-blue-900">
                              ₹{vendorGroup.totalValue.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );

                  const poRows = vendorGroup.orders.flatMap((record) => {
                    const completedIdx = getTimelineCompletedIndex(record);
                    const stageLabel = TIMELINE_STAGE_LABELS[completedIdx] ?? 'PO Released';
                    const backendPoId = resolveBackendPoId(record);
                    const tr =
                      backendPoId && releasedPoTrackingByBackendId
                        ? releasedPoTrackingByBackendId[backendPoId]
                        : undefined;
                    const lrRef = tr?.orderTrackingRef?.trim() || '—';
                    const shipNote = tr?.shippedNote?.trim() || '';
                    const hasVendorConfirmed = hasPoTrackingTimestamp(tr?.vendorConfirmedAt);
                    const hasShipped =
                      hasPoTrackingTimestamp(tr?.shippedAt) || record.status === 'In Transit';
                    const etaLabel = record.etaDateDisplay ?? '—';
                    const primaryLine = record.lineItems[0];
                    const extraLines = record.lineItems.length > 1 ? record.lineItems.length - 1 : 0;

                    return (
                      <tr key={`${record.backendPoId ?? 'noid'}-${record.poNumber}`} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 align-top">
                          <div className="font-mono text-[12px] text-gray-900 font-semibold">{record.poNumber}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{record.requestCode}</div>
                          <span
                            className={`inline-flex mt-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${typeBadgeClass(record.request.type)}`}
                          >
                            {record.request.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {primaryLine ? (
                            <>
                              <div className="font-semibold text-gray-900 text-[13px]">{primaryLine.item}</div>
                              <div className="text-[10px] text-gray-500 font-mono">{primaryLine.itemCode}</div>
                              {extraLines > 0 ? (
                                <div className="text-[10px] text-gray-500 mt-0.5">+{extraLines} more line(s)</div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right align-top font-mono text-[12px] text-gray-900">
                          {primaryLine?.qty ?? '—'}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-sky-50 text-sky-800 border-sky-200">
                            {stageLabel}
                          </span>
                          <div className="text-[10px] text-gray-500 mt-1">
                            Step {completedIdx + 1} of {TIMELINE_STAGE_LABELS.length}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div
                            className={`text-[12px] font-medium ${
                              record.etaDays < 0 ? 'text-rose-600' : 'text-gray-800'
                            }`}
                          >
                            {record.etaDays >= 0 ? `${record.etaDays}d` : 'Overdue'}
                          </div>
                          <div className="text-[10px] text-gray-500">{etaLabel}</div>
                          <span
                            className={`inline-flex mt-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusBadgeClass(record.status)}`}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right align-top font-semibold text-amber-700">
                          ₹{record.grandTotal.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 align-top text-[11px] text-gray-700">
                          <div className="text-gray-500">LR / ref</div>
                          <div className="break-all">{lrRef}</div>
                          {shipNote ? (
                            <>
                              <div className="text-gray-500 mt-1">Courier note</div>
                              <div className="break-words max-w-[12rem]">{shipNote}</div>
                            </>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-1.5 items-start">
                            <button
                              type="button"
                              onClick={() => onOpenDetail(record)}
                              className="px-2.5 py-1.5 rounded-md border text-xs font-semibold border-slate-300 text-slate-800 hover:bg-slate-50"
                            >
                              Timeline
                            </button>
                            {backendPoId && !hasVendorConfirmed ? (
                              <button
                                type="button"
                                onClick={() => onMarkVendorConfirmed(record)}
                                className="px-2.5 py-1.5 rounded-md border text-xs font-semibold border-cyan-300 text-cyan-800 bg-cyan-50 hover:bg-cyan-100"
                              >
                                Vendor confirmed
                              </button>
                            ) : null}
                            {backendPoId && hasVendorConfirmed && !hasShipped ? (
                              <button
                                type="button"
                                onClick={() => onMarkShipped(record)}
                                className="px-2.5 py-1.5 rounded-md border text-xs font-semibold border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                              >
                                In transit
                              </button>
                            ) : null}
                            {!backendPoId && record.status !== 'In Transit' ? (
                              <button
                                type="button"
                                onClick={() => onMarkShipped(record)}
                                className="px-2.5 py-1.5 rounded-md border text-xs font-semibold border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                              >
                                In transit
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => onReceiveGrn(record)}
                              className="px-2.5 py-1.5 rounded-md border text-xs font-semibold border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                            >
                              WH delivered
                            </button>
                            <button
                              type="button"
                              onClick={onOpenGrnMonitor}
                              className="px-2.5 py-1.5 rounded-md border text-xs font-semibold border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                            >
                              GRN Monitor
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  });

                  return [headerRow, ...poRows];
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div className="text-xs text-gray-600">
              Page {safePage} of {totalPages} · Showing {pagedVendorGroups.length} of {groupedByVendor.length}{' '}
              vendors ({pagedPoCount} PO{pagedPoCount !== 1 ? 's' : ''} on this page)
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) || 10)}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50 bg-white"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50 bg-white"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 px-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="inline-block bg-gray-200 p-4 rounded-full">
            <ShoppingCart size={40} className="text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mt-4">No issued POs found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
            {hasActiveFilters
              ? 'Try adjusting your search or filters.'
              : 'Released purchase orders will appear here after PO release.'}
          </p>
        </div>
      )}
    </div>
  );
}
