/**
 * SODetailModal Component
 * Detailed view of a sale order with complete information
 */

import React from 'react';
import {
  Package,
  FileText,
  Truck,
  Radar,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  Info,
  Star,
  Hash,
  CheckCircle,
} from 'lucide-react';
import { UnifiedModal as Modal } from '../ui/UnifiedComponents';
import { StatusBadge } from './StatusBadge';
import type { SODetailModalProps } from '../../types/orderFulfillment';
import {
  formatDate,
  formatNumber,
  formatCurrency,
  calculateSOProgress,
  getDaysLeft,
  formatDaysLeft,
  calculateOrderValue,
} from '../../utils/orderFulfillmentUtils';
import { UnifiedButton as Button } from '../ui/UnifiedComponents';

const DetailItem = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
    <Icon className="h-5 w-5 text-gray-500 mt-0.5" />
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <div className="text-base font-semibold text-gray-800">{children}</div>
    </div>
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
  const daysLeftFormatted = formatDaysLeft(getDaysLeft(saleOrder.dueDate));

  const splits = saleOrder.items.flatMap((i) => i.batchSplits);
  const hasFGReady = splits.some((sp) => sp.ffStatus === 'fg_ready');
  const hasPicking = splits.some((sp) => sp.ffStatus === 'picking');
  const hasInvoiced = splits.some((sp) => sp.ffStatus === 'invoiced');
  const hasShipped = splits.some((sp) => sp.ffStatus === 'shipped');

  const actionButtons = [
    {
      label: 'Pick FG',
      icon: Package,
      onClick: () => onAction('pick', saleOrder.soNo),
      show: hasFGReady,
      variant: 'default' as const,
    },
    {
      label: 'Invoice',
      icon: FileText,
      onClick: () => onAction('invoice', saleOrder.soNo),
      show: hasPicking,
      variant: 'default' as const,
    },
    {
      label: 'Ship',
      icon: Truck,
      onClick: () => onAction('ship', saleOrder.soNo),
      show: hasInvoiced,
      variant: 'default' as const,
    },
    {
      label: 'Track',
      icon: Radar,
      onClick: () => onAction('track', saleOrder.soNo),
      show: hasShipped,
      variant: 'default' as const,
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`SO Details: ${saleOrder.soNo}`}
      size="4xl"
    >
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DetailItem icon={Info} label="Status">
                <StatusBadge status={saleOrder.soStatus} type="so" />
              </DetailItem>
              <DetailItem icon={Calendar} label="Order Date">
                {formatDate(saleOrder.orderDate)}
              </DetailItem>
              <DetailItem icon={Clock} label="Due Date">
                <span className={daysLeftFormatted.color}>
                  {formatDate(saleOrder.dueDate)} ({daysLeftFormatted.text})
                </span>
              </DetailItem>
              <DetailItem icon={DollarSign} label="Total Value">
                {formatCurrency(totalValue)}
              </DetailItem>
              <DetailItem icon={Hash} label="Payment">
                {saleOrder.paymentTerms}
              </DetailItem>
              <DetailItem icon={Star} label="Priority">
                {saleOrder.priority === 'high' ? (
                  <span className="text-red-600 font-bold">High</span>
                ) : (
                  'Normal'
                )}
              </DetailItem>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">
                Fulfillment Progress
              </h3>
              <div className="relative h-3 w-full bg-gray-200 rounded-full">
                <div
                  className="absolute top-0 left-0 h-full bg-green-400 rounded-full transition-all duration-500 z-10"
                  style={{ width: `${progress.readyPct}%` }}
                  title={`FG Ready: ${progress.readyPct}%`}
                />
                <div
                  className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress.shippedPct}%` }}
                  title={`Shipped: ${progress.shippedPct}%`}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>
                  {formatNumber(progress.ready)}/{formatNumber(progress.total)}{' '}
                  units FG ready
                </span>
                <span>
                  {formatNumber(progress.shipped)}/{formatNumber(progress.total)}{' '}
                  units shipped
                </span>
              </div>
            </div>

            {/* Items & Batches */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">
                Items & Batches
              </h3>
              {saleOrder.items.map((item, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <div className="bg-gray-50 p-4 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-800">
                        {item.productName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.sku} | {item.pack}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-800">
                        {formatNumber(item.orderedQty)} units
                      </p>
                      <p className="text-sm text-gray-500">
                        @ {formatCurrency(item.unitPrice)}/unit
                      </p>
                    </div>
                  </div>
                  <div className="p-4">
                    {item.batchSplits.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="text-left text-gray-500">
                          <tr>
                            <th className="pb-2 font-medium">BPR No</th>
                            <th className="pb-2 font-medium">FG Qty</th>
                            <th className="pb-2 font-medium">Location</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.batchSplits.map((sp, sidx) => (
                            <tr key={sidx} className="border-b last:border-0">
                              <td className="py-2 font-mono text-purple-600">
                                {sp.bprNo}
                              </td>
                              <td className="py-2 font-semibold text-green-600">
                                {formatNumber(sp.fgQty)}
                              </td>
                              <td className="py-2">{sp.fgLocation}</td>
                              <td className="py-2">
                                <StatusBadge status={sp.ffStatus} type="ff" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No production batches linked yet.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-gray-500" /> Shipping Address
              </h3>
              <address className="not-italic text-gray-600">
                <strong className="font-semibold text-gray-800">
                  {saleOrder.customer}
                </strong>
                <br />
                {saleOrder.shipAddress}
              </address>
            </div>

            {saleOrder.notes && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-semibold mb-1 text-blue-900">Notes</p>
                <p className="text-blue-700">{saleOrder.notes}</p>
              </div>
            )}

            <div className="space-y-3 p-4 bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-100 rounded-lg">
              <h3 className="font-bold text-gray-900">Actions</h3>
              <div className="grid grid-cols-1 gap-2">
                {actionButtons
                  .filter((btn) => btn.show)
                  .map((btn) => (
                    <Button
                      key={btn.label}
                      variant="default"
                      onClick={btn.onClick}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                    >
                      <btn.icon className="h-5 w-5" />
                      <span>{btn.label}</span>
                    </Button>
                  ))}
              </div>
              {splits.length > 0 &&
                splits.every((sp) =>
                  ['delivered', 'closed'].includes(sp.ffStatus)
                ) && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">Order Completed</span>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 p-4 bg-gray-50 border-t">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};
