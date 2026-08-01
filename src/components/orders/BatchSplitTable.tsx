import React from 'react';
import { Package, FileText, Truck, Radar, MapPin, Eye } from 'lucide-react';
import type { SaleOrder, BatchSplit, OrderItem } from '../../types/orderFulfillment';
import { StatusBadge } from './StatusBadge';
import {
  formatDate,
  formatNumber,
  getDaysLeft,
  formatDaysLeft,
} from '../../utils/orderFulfillmentUtils';
import { UnifiedButton as Button } from '../ui/UnifiedComponents';

interface BatchSplitTableProps {
  rows: Array<{ so: SaleOrder; item: OrderItem; split: BatchSplit }>;
  onPick: (bprNo: string) => void;
  onInvoice: (bprNo: string) => void;
  onShip: (bprNo: string) => void;
  onTrack: (bprNo: string) => void;
  onViewSO: (soNo: string) => void;
}

export const BatchSplitTable: React.FC<BatchSplitTableProps> = ({
  rows,
  onPick,
  onInvoice,
  onShip,
  onTrack,
  onViewSO,
}) => {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-ink-3">
        <Package size={32} className="mx-auto mb-2" />
        <p className="font-semibold">No batch splits found.</p>
        <p className="text-sm">
          No records match the current filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-surface rounded-lg border border-border">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-surface-3 border-b border-border">
          <tr>
            <th scope="col" className="w-24 px-4 py-3 text-left font-semibold text-ink-2 border-r border-border">
              Sale Order
            </th>
            <th scope="col" className="w-32 px-4 py-3 text-left font-semibold text-ink-2 border-r border-border">
              Customer
            </th>
            <th scope="col" className="w-24 px-4 py-3 text-left font-semibold text-ink-2 border-r border-border">
              BPR No
            </th>
            <th scope="col" className="w-20 px-4 py-3 text-right font-semibold text-ink-2 border-r border-border">
              Qty
            </th>
            <th scope="col" className="w-28 px-4 py-3 text-left font-semibold text-ink-2 border-r border-border">
              Due Date
            </th>
            <th scope="col" className="w-24 px-4 py-3 text-left font-semibold text-ink-2 border-r border-border">
              Status
            </th>
            <th scope="col" className="w-40 px-4 py-3 text-center font-semibold text-ink-2">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map(({ so, item, split }) => {
            const daysLeft = getDaysLeft(so.dueDate);
            const daysLeftFormatted = formatDaysLeft(daysLeft);

            return (
              <tr key={split.bprNo} className="hover:bg-brand-soft transition-colors">
                <td className="w-24 px-4 py-3 border-r border-border">
                  <p
                    className="font-semibold text-brand cursor-pointer hover:underline truncate"
                    onClick={() => onViewSO(so.soNo)}
                  >
                    {so.soNo}
                  </p>
                  {so.priority === 'high' && (
                    <span className="text-xs font-bold text-err block">
                      High Priority
                    </span>
                  )}
                </td>
                <td className="w-32 px-4 py-3 border-r border-border">
                  <p className="font-medium text-ink truncate">{so.customer}</p>
                  <p className="text-xs text-ink-3 truncate">{so.customerCity}</p>
                </td>
                <td className="w-24 px-4 py-3 font-mono text-brand border-r border-border truncate">
                  {split.bprNo}
                </td>
                <td className="w-20 px-4 py-3 text-right border-r border-border">
                  <p className="font-semibold text-ink">
                    {formatNumber(split.plannedQty)}
                  </p>
                  {split.fgQty > 0 && (
                    <p className="text-xs text-ok">
                      FG: {formatNumber(split.fgQty)}
                    </p>
                  )}
                </td>
                <td className="w-28 px-4 py-3 border-r border-border">
                  <p className={`font-medium ${daysLeftFormatted.color} truncate`}>
                    {formatDate(so.dueDate)}
                  </p>
                  <p className={`text-xs ${daysLeftFormatted.color} truncate`}>
                    {daysLeftFormatted.text}
                  </p>
                </td>
                <td className="w-24 px-4 py-3 border-r border-border">
                  <StatusBadge status={split.ffStatus} type="ff" />
                </td>
                <td className="w-40 px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    {split.ffStatus === 'fg_ready' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onPick(split.bprNo)}
                        className="flex items-center gap-1 whitespace-nowrap"
                      >
                        <Package className="h-4 w-4" />
                        <span className="hidden sm:inline">Pick</span>
                      </Button>
                    )}
                    {split.ffStatus === 'picking' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onInvoice(split.bprNo)}
                        className="flex items-center gap-1 whitespace-nowrap"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">Invoice</span>
                      </Button>
                    )}
                    {split.ffStatus === 'invoiced' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onShip(split.bprNo)}
                        className="flex items-center gap-1 whitespace-nowrap"
                      >
                        <Truck className="h-4 w-4" />
                        <span className="hidden sm:inline">Ship</span>
                      </Button>
                    )}
                    {split.ffStatus === 'shipped' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onTrack(split.bprNo)}
                        className="flex items-center gap-1 whitespace-nowrap"
                      >
                        <Radar className="h-4 w-4" />
                        <span className="hidden sm:inline">Track</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onViewSO(so.soNo)}
                      title="View Sale Order Details"
                      aria-label="View Sale Order Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};