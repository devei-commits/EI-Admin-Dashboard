/**
 * SODetailModal Component
 * Detailed view of a sale order with KPI grid, ship address, progress bar, and items with batch splits (reference layout).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Package, MapPin, FileText, Truck, CheckCircle } from 'lucide-react';
import { UnifiedModal as Modal, UnifiedButton as Button } from '../ui/UnifiedComponents';
import { StatusBadge } from './StatusBadge';
import type { SODetailModalProps } from '../../types/orderFulfillment';
import type { BatchSplit, OrderItem } from '../../types/orderFulfillment';
import type { SoPlanningAvailabilityResponse, SoPlanningAvailabilityItem, SoPlanningBatchAvailabilityRow } from '../../services/fulfillment.service';
import { fetchSoPlanningAvailability } from '../../services/fulfillment.service';
import {
  formatDate,
  formatNumber,
  formatCurrency,
  calculateSOProgress,
  getDaysLeft,
  formatDaysLeft,
  calculateOrderValue,
} from '../../utils/orderFulfillmentUtils';

const KPI = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="bg-black/10 dark:bg-black/15 border border-gray-200 dark:border-gray-700 rounded-lg py-2.5 px-3">
    <div className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
      {label}
    </div>
    <div className="text-[11.5px] font-bold">{children}</div>
  </div>
);

export const SODetailModal: React.FC<SODetailModalProps> = ({
  isOpen,
  onClose,
  saleOrder,
  onAction,
}) => {
  if (!saleOrder) return null;

  const progress = calculateSOProgress(saleOrder);
  const totalValue = calculateOrderValue(saleOrder);
  const daysLeft = getDaysLeft(saleOrder.dueDate);
  const daysLeftFormatted = formatDaysLeft(daysLeft);

  const [planningAvailability, setPlanningAvailability] = useState<SoPlanningAvailabilityResponse | null>(null);
  const [planningAvailabilityLoading, setPlanningAvailabilityLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isOpen || !saleOrder?.soNo) return;
      try {
        setPlanningAvailabilityLoading(true);
        const res = await fetchSoPlanningAvailability(saleOrder.soNo);
        if (!cancelled) setPlanningAvailability(res);
      } catch (e) {
        console.error('Failed to load SO planning availability', e);
        if (!cancelled) setPlanningAvailability(null);
      } finally {
        if (!cancelled) setPlanningAvailabilityLoading(false);
      }
    }

    load();
    const interval = window.setInterval(load, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isOpen, saleOrder?.soNo]);

  const availabilityMap = useMemo(() => {
    const m = new Map<string, SoPlanningAvailabilityItem>();
    const items = planningAvailability?.items ?? [];
    for (const it of items) {
      m.set(`${it.productName}__${it.sku}`, it);
      // Fallback: if SKU isn't present in the fulfillment item, match by productName.
      m.set(it.productName, it);
    }
    return m;
  }, [planningAvailability]);

  const hasFGReady = saleOrder.items.some((i) =>
    i.batchSplits.some((sp) => sp.ffStatus === 'fg_ready')
  );

  const modalTitle = (
    <div>
      <div className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight" id="sod-title">
        {saleOrder.soNo}
      </div>
      <div
        className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5"
        id="sod-sub"
      >
        {saleOrder.customer}
        {saleOrder.customerCity ? ` · ${saleOrder.customerCity}` : ''}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {hasFGReady && (
            <Button
              variant="primary"
              onClick={() => onAction('pick', saleOrder.soNo)}
              className="flex items-center gap-1.5"
            >
              <Package className="w-4 h-4" />
              Pick FG
            </Button>
          )}
        </>
      }
    >
      <div id="sod-body" className="space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2 mb-4">
          <KPI label="Status">
            <StatusBadge status={saleOrder.soStatus} type="so" size="sm" />
          </KPI>
          <KPI label="Order Date">{formatDate(saleOrder.orderDate)}</KPI>
          <KPI label="Due Date">{formatDate(saleOrder.dueDate)}</KPI>
          <KPI label="Days Left">
            <span className={daysLeftFormatted.color}>{daysLeftFormatted.text}</span>
          </KPI>
          <KPI label="Total Value">{formatCurrency(totalValue)}</KPI>
          <KPI label="Payment">{saleOrder.paymentTerms}</KPI>
          <KPI label="Priority">
            {saleOrder.priority === 'high' ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                High
              </span>
            ) : (
              'Normal'
            )}
          </KPI>
          <KPI label="Exec (lifecycle)">
            {progress.fulfillmentLifecyclePct}%
            <span className="block text-[9px] font-normal text-gray-500 mt-0.5">plan → deliver</span>
          </KPI>
          <KPI label="FG Ready">
            {progress.readyPct}% · {progress.ready.toLocaleString('en-IN')} units
          </KPI>
          <KPI label="Shipped">
            {progress.shippedPct}% · {progress.shipped.toLocaleString('en-IN')} units
          </KPI>
        </div>

        {/* Ship address */}
        <div className="flex gap-2 p-2.5 pl-3.5 bg-black/5 dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded-lg">
          <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0 mt-0.5" aria-hidden />
          <div>
            <div className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Deliver To
            </div>
            <div className="text-[12.5px] font-bold mt-0.5">{saleOrder.customer}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              {saleOrder.shipAddress || '—'}
            </div>
          </div>
        </div>

        {/* Notes alert */}
        {saleOrder.notes && (
          <div className="flex gap-2 p-3 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-blue-800 dark:text-blue-200 text-sm">
            <FileText className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <div>{saleOrder.notes}</div>
          </div>
        )}

        {/* Overall progress bar */}
        {/* <div className="p-3 px-4 bg-black/5 dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Fulfillment Progress
            </span>
            <span className="font-mono text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
              {progress.readyPct}% FG Ready · {progress.shippedPct}% Shipped
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 dark:bg-black/20 overflow-hidden relative">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/50 dark:bg-emerald-400/50 z-1 transition-all"
              style={{ width: `${progress.readyPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-blue-500 dark:bg-blue-400 z-2 transition-all"
              style={{ width: `${progress.shippedPct}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[9.5px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500/50 dark:bg-emerald-400/50 inline-block" />
              FG Ready
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 inline-block" />
              Shipped
            </span>
            {progress.batchesTotal > 0 && (
              <span className="font-semibold text-gray-600 dark:text-gray-300">
                Batches: {progress.batchesDonePct}% ({progress.batchesDone}/{progress.batchesTotal}) done
              </span>
            )}
          </div>
        </div> */}

        {/* Items with batch splits */}
        {saleOrder.items.map((item, idx) => (
          <ItemWithBatches
            key={idx}
            item={item}
            soNo={saleOrder.soNo}
            onAction={onAction}
            planningItem={availabilityMap.get(`${item.productName}__${item.sku}`) ?? availabilityMap.get(item.productName) ?? null}
            planningAvailabilityLoading={planningAvailabilityLoading}
          />
        ))}
      </div>
    </Modal>
  );
};

function ItemWithBatches({
  item,
  soNo,
  onAction,
  planningItem,
  planningAvailabilityLoading,
}: {
  item: OrderItem;
  soNo: string;
  onAction: (action: string, soNo: string, split?: BatchSplit) => void;
  planningItem: SoPlanningAvailabilityItem | null;
  planningAvailabilityLoading: boolean;
}) {
  const readyQty = item.batchSplits.reduce(
    (sum, sp) =>
      ['fg_ready', 'picking', 'invoiced', 'shipped', 'delivered', 'closed'].includes(sp.ffStatus)
        ? sum + (sp.fgQty || 0)
        : sum,
    0
  );
  const itemValue = item.orderedQty * item.unitPrice;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-3 bg-black/10 dark:bg-black/15 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[13px] font-extrabold">{item.productName}</div>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-mono bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {item.sku}
            </span>
            <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-mono bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {item.pack}
            </span>
            <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-mono bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {formatCurrency(item.unitPrice)}/unit
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9.5px] text-gray-500 dark:text-gray-400">FG Ready / Ordered</div>
          <div className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
            {formatNumber(readyQty)}
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">
              {' '}
              / {formatNumber(item.orderedQty)}
            </span>
          </div>
          <div className="text-[9.5px] text-gray-500 dark:text-gray-400">
            Value {formatCurrency(itemValue)}
          </div>
        </div>
      </div>

      {/* RM/PM availability summary (from warehouse) */}
      {(planningItem || planningAvailabilityLoading) && (
        <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-800/20 border-b border-gray-200 dark:border-gray-700">
          {planningAvailabilityLoading ? (
            <div className="text-[11px] text-gray-600 dark:text-gray-300">Loading RM/PM availability…</div>
          ) : planningItem ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-700 dark:text-gray-200">
              <span>
                RM: {planningItem.rmStartedCount}/{planningItem.rmStartableCount} started · {planningItem.rmStartableCount}/{planningItem.totalBatches} available
              </span>
              <span>
                PM: {planningItem.pmStartedCount}/{planningItem.pmStartableCount} started · {planningItem.pmStartableCount}/{planningItem.totalBatches} available
              </span>
              <span>
                Sent to production: {planningItem.sentCount}/{planningItem.totalBatches}
              </span>
            </div>
          ) : null}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400">
                Batch No
              </th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400">
                Planned
              </th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400">
                FG Output
              </th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400">
                FG Location
              </th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400">
                Picked
              </th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400">
                Invoice
              </th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400">
                AWB / Courier
              </th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400">
                Status
              </th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {item.batchSplits.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No production batches linked yet.
                </td>
              </tr>
            ) : (
              item.batchSplits.map((sp, sidx) => (
                <BatchRow
                  key={sidx}
                  batchNo={sidx + 1}
                  split={sp}
                  soNo={soNo}
                  onAction={onAction}
                  planningBatch={planningItem?.batches?.find((b) => b.sequence === sidx + 1) ?? null}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchRow({
  batchNo,
  split,
  soNo,
  onAction,
  planningBatch,
}: {
  batchNo: number;
  split: BatchSplit;
  soNo: string;
  onAction: (action: string, soNo: string, split?: BatchSplit) => void;
  planningBatch: SoPlanningBatchAvailabilityRow | null;
}) {
  const isFGReady = split.ffStatus === 'fg_ready';
  const isPicking = split.ffStatus === 'picking';
  const isInvoiced = split.ffStatus === 'invoiced';
  const isShipped = split.ffStatus === 'shipped';
  const isPending =
    ['wip', 'fg_pending', 'bulk_qc'].includes(split.ffStatus) || !split.fgQty;

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
      <td className="py-2 px-3">
        <div className="font-mono text-[10px] text-gray-700 dark:text-gray-200">
          Batch {batchNo}
        </div>
        {planningBatch ? (
          <div className="mt-1 text-[9.3px] text-gray-500 dark:text-gray-400">
            RM: {formatNumber(planningBatch.rmNeededTotalKg)} / {formatNumber(planningBatch.rmRequestedTotalKg)} KG · rem{' '}
            {formatNumber(planningBatch.rmRemainingTotalKg)}
            <br />
            PM: {formatNumber(planningBatch.pmNeededTotalUnits)} / {formatNumber(planningBatch.pmRequestedTotalUnits)} PCS · rem{' '}
            {formatNumber(planningBatch.pmRemainingTotalUnits)}
          </div>
        ) : null}
      </td>
      <td className="py-2 px-3 font-mono">{formatNumber(split.plannedQty)}</td>
      <td className="py-2 px-3 font-mono font-bold">
        {split.fgQty != null && split.fgQty > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400">
            {formatNumber(split.fgQty)}
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">—</span>
        )}
      </td>
      <td className="py-2 px-3">
        {split.fgLocation ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-500/30">
            <MapPin className="w-3 h-3" /> {split.fgLocation}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="py-2 px-3 font-mono text-gray-500 dark:text-gray-400">
        {split.pickedQty != null && split.pickedQty > 0 ? formatNumber(split.pickedQty) : '—'}
      </td>
      <td className="py-2 px-3">
        {split.invoiceNo != null ? String(split.invoiceNo) : '—'}
      </td>
      <td className="py-2 px-3">
        {split.awbNo || split.courier
          ? [split.awbNo, split.courier].filter(Boolean).join(' / ')
          : '—'}
      </td>
      <td className="py-2 px-3">
        <StatusBadge status={split.ffStatus} type="ff" size="sm" />
      </td>
      <td className="py-2 px-3 min-w-[120px]">
        <div className="flex gap-1 flex-wrap">
          {isFGReady && (
            <button
              type="button"
              onClick={() => onAction('pick', soNo, split)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Package className="w-3 h-3" /> Pick
            </button>
          )}
          {isPicking && (
            <button
              type="button"
              onClick={() => onAction('invoice', soNo, split)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FileText className="w-3 h-3" /> Invoice
            </button>
          )}
          {isInvoiced && (
            <button
              type="button"
              onClick={() => onAction('ship', soNo, split)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Truck className="w-3 h-3" /> Ship
            </button>
          )}
          {isShipped && (
            <button
              type="button"
              onClick={() => onAction('track', soNo, split)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-slate-600 hover:bg-slate-700 text-white"
            >
              <CheckCircle className="w-3 h-3" /> Track
            </button>
          )}
          {isPending && (
            <span className="text-[9px] text-gray-500 dark:text-gray-400">
              In production
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
