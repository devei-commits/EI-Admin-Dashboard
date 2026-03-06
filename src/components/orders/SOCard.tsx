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
        'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200',
    },
    {
      label: 'Invoice',
      icon: FileText,
      onClick: () => onInvoice(saleOrder.soNo),
      show: hasPicking,
      className:
        'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200',
    },
    {
      label: 'Ship',
      icon: Truck,
      onClick: () => onShip(saleOrder.soNo),
      show: hasInvoiced,
      className:
        'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200',
    },
    {
      label: 'Track',
      icon: Radar,
      onClick: () => onTrack(saleOrder.soNo),
      show: hasShipped,
      className: 'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200',
    },
    {
      label: 'Details',
      icon: Eye,
      onClick: () => onViewDetails(saleOrder.soNo),
      show: true,
      className: 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200',
    },
  ];

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden transition-all hover:shadow-md hover:border-gray-300">
      {/* Header */}
      <div
        className="px-4 py-3 cursor-pointer"
        onClick={() => onViewDetails(saleOrder.soNo)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-gray-800">
                {saleOrder.soNo}
              </span>
              <StatusBadge status={saleOrder.soStatus} type="so" />
              {saleOrder.priority === 'high' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                  🔥 Priority
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-700 font-medium">
              <User size={14} className="text-gray-500" />
              <span>{saleOrder.customer}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
              <Calendar size={14} className="text-gray-400" />
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

        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mt-2">
          <CircleDollarSign size={14} className="text-gray-400" />
          <span>{formatCurrency(totalValue)}</span>
          <span className="text-gray-300">|</span>
          <ShoppingCart size={14} className="text-gray-400" />
          <span>
            {saleOrder.items.length} item
            {saleOrder.items.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 pb-3">
        <div className="relative h-2.5 w-full bg-gray-200 rounded-full">
          <div
            className="absolute top-0 left-0 h-full bg-green-400 rounded-full transition-all duration-500"
            style={{ width: `${progress.readyPct}%` }}
          />
          <div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress.shippedPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs font-medium text-gray-500">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400" /> FG Ready
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Shipped
            </span>
          </div>
          <span>
            {progress.shippedPct}% of {progress.total} units
          </span>
        </div>
      </div>

      {/* Actions Footer */}
      <div className="px-3 py-2 border-t border-gray-200 bg-white flex items-center justify-end gap-2">
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
              className={`h-8 w-8 flex items-center justify-center rounded-md border transition-all ${action.className}`}
            >
              <action.icon size={16} />
            </button>
          ))}
      </div>
    </div>
  );
};

