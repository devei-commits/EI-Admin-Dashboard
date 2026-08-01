/**
 * SOCard Component
 * Displays a sale order card with progress, actions, and item details
 */

import React from 'react';
import {
  ShoppingCart,
  Package,
  FileText,
  Truck,
  Radar,
  Eye,
  Calendar,
  CircleDollarSign,
  Clock,
  User,
} from 'lucide-react';
import type { SOCardProps } from '../../types/orderFulfillment';
import { StatusBadge } from './StatusBadge';
import {
  formatDate,
  formatCurrency,
  formatDaysLeft,
  getDaysLeft,
} from '../../utils/orderFulfillmentUtils';

export const SOCard: React.FC<SOCardProps> = ({
  saleOrder,
  progress,
  onViewDetails,
  onPick,
  onInvoice,
  onShip,
  onTrack,
}) => {
  const daysLeft = getDaysLeft(saleOrder.dueDate);
  const daysLeftFormatted = formatDaysLeft(daysLeft);
  const totalValue = saleOrder.items.reduce(
    (sum, item) => sum + item.orderedQty * item.unitPrice,
    0
  );

  const hasFGReady = saleOrder.items
    .flatMap((i) => i.batchSplits)
    .some((sp) => sp.ffStatus === 'fg_ready');
  const hasPicking = saleOrder.items
    .flatMap((i) => i.batchSplits)
    .some((sp) => sp.ffStatus === 'picking');
  const hasInvoiced = saleOrder.items
    .flatMap((i) => i.batchSplits)
    .some((sp) => sp.ffStatus === 'invoiced');
  const hasShipped = saleOrder.items
    .flatMap((i) => i.batchSplits)
    .some((sp) => sp.ffStatus === 'shipped');

  const cardActions = [
    {
      label: 'Pick FG',
      icon: Package,
      onClick: () => onPick(saleOrder.soNo),
      show: hasFGReady,
      className:
        'bg-ok-soft text-ok hover:bg-ok-soft border-[color:var(--st-green-fg)]/30',
    },
    {
      label: 'Invoice',
      icon: FileText,
      onClick: () => onInvoice(saleOrder.soNo),
      show: hasPicking,
      className:
        'bg-brand-soft text-brand hover:bg-brand-soft border-brand-soft',
    },
    {
      label: 'Ship',
      icon: Truck,
      onClick: () => onShip(saleOrder.soNo),
      show: hasInvoiced,
      className:
        'bg-brand-soft text-brand hover:bg-brand-soft border-brand-soft',
    },
    {
      label: 'Track',
      icon: Radar,
      onClick: () => onTrack(saleOrder.soNo),
      show: hasShipped,
      className: 'bg-brand-soft text-brand hover:bg-brand-soft border-brand-soft',
    },
    {
      label: 'Details',
      icon: Eye,
      onClick: () => onViewDetails(saleOrder.soNo),
      show: true,
      className: 'bg-surface-3 text-ink-3 hover:bg-surface-3 border-border',
    },
  ];

  return (
    <div className="bg-surface-3 border border-border rounded-lg overflow-hidden transition-all hover:shadow-md hover:border-border">
      {/* Header */}
      <div
        className="px-4 py-3 cursor-pointer"
        onClick={() => onViewDetails(saleOrder.soNo)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-ink">
                {saleOrder.soNo}
              </span>
              <StatusBadge status={saleOrder.soStatus} type="so" />
              {saleOrder.priority === 'high' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-err-soft text-err border border-[color:var(--st-red-fg)]/30">
                  Priority
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-ink-2 font-medium">
              <User size={14} className="text-ink-3" />
              <span>{saleOrder.customer}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-sm font-medium text-ink-3">
              <Calendar size={14} className="text-ink-4" />
              <span>{formatDate(saleOrder.orderDate)}</span>
            </div>
            <div
              className={`flex items-center gap-1.5 text-sm font-bold mt-1 ${daysLeftFormatted.color}`}
            >
              <Clock size={14} />
              <span>{daysLeftFormatted.text}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-sm font-medium text-ink-3 mt-2">
          <CircleDollarSign size={14} className="text-ink-4" />
          <span>{formatCurrency(totalValue)}</span>
          <span className="text-ink-4">|</span>
          <ShoppingCart size={14} className="text-ink-4" />
          <span>
            {saleOrder.items.length} item
            {saleOrder.items.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 pb-3">
        <div className="relative h-2.5 w-full bg-surface-3 rounded-full">
          <div
            className="absolute top-0 left-0 h-full bg-ok rounded-full transition-all duration-500"
            style={{ width: `${progress.readyPct}%` }}
          />
          <div
            className="absolute top-0 left-0 h-full bg-brand rounded-full transition-all duration-500"
            style={{ width: `${progress.shippedPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs font-medium text-ink-3">
          {progress.readyPct === 0 && progress.shippedPct === 0 ? (
            <>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-ink-4" /> Pending
              </span>
              <span>0% of {progress.total} units</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-ok" /> FG Ready
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-brand" /> Shipped
                </span>
              </div>
              <span>
                {progress.shippedPct}% of {progress.total} units
              </span>
            </>
          )}
        </div>
        <div className="mt-1 text-[11px] text-ink-3 font-medium">
          Lifecycle exec: {progress.fulfillmentLifecyclePct}%
        </div>
        {progress.batchesTotal > 0 && (
          <div className="mt-0.5 text-[11px] text-ink-3 font-medium">
            Batches: {progress.batchesDonePct}% ({progress.batchesDone}/{progress.batchesTotal}) done
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="px-3 py-2 border-t border-border bg-surface flex items-center justify-end gap-2">
        {cardActions
          .filter((action) => action.show)
          .map((action) => (
            <button
              key={action.label}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              title={action.label}
              aria-label={action.label}
              className={`h-8 w-8 flex items-center justify-center rounded-md border transition-all ${action.className}`}
            >
              <action.icon size={16} />
            </button>
          ))}
      </div>
    </div>
  );
};

