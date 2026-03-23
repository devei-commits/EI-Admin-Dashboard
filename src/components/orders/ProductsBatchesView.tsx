import React, { useState, useMemo } from 'react';
import {
  Package,
  FileText,
  Truck,
  MapPin,
  Eye,
} from 'lucide-react';
import { FilterBar } from './FilterBar';
import { PickModal } from './PickModal';
import { InvoiceModal } from './InvoiceModal';
import { ShipModal } from './ShipModal';
import { TrackModal } from './TrackModal';
import { SODetailModal } from './SODetailModal';
import type {
  SaleOrder,
  BatchSplit,
  PickData,
  InvoiceData,
  ShipData,
  DeliveryData,
  OrderItem,
} from '../../types/orderFulfillment';
import { filterBatchSplits } from '../../utils/orderFulfillmentUtils';
import {
  formatDate,
  formatNumber,
  getDaysLeft,
  formatDaysLeft,
} from '../../utils/orderFulfillmentUtils';
import { StatusBadge } from './StatusBadge';
import { UnifiedButton as Button } from '../ui/UnifiedComponents';

interface ProductsBatchesViewProps {
  saleOrders: SaleOrder[];
  onPickConfirm: (soNo: string, data: PickData) => void;
  onGenerateInvoice: (soNo: string, data: InvoiceData) => void;
  onDispatch: (soNo: string, data: ShipData) => void;
  onConfirmDelivery: (soNo: string, data: DeliveryData) => void;
}

type Row = { so: SaleOrder; item: OrderItem; split: BatchSplit };

export const ProductsBatchesView: React.FC<ProductsBatchesViewProps> = ({
  saleOrders,
  onPickConfirm,
  onGenerateInvoice,
  onDispatch,
  onConfirmDelivery,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [pickModalSO, setPickModalSO] = useState<SaleOrder | null>(null);
  const [invoiceModalSO, setInvoiceModalSO] = useState<SaleOrder | null>(null);
  const [shipModalSO, setShipModalSO] = useState<SaleOrder | null>(null);
  const [trackModalSO, setTrackModalSO] = useState<SaleOrder | null>(null);
  const [detailModalSO, setDetailModalSO] = useState<SaleOrder | null>(null);

  const tableRows = useMemo(
    () => filterBatchSplits(saleOrders, activeFilter, searchQuery),
    [saleOrders, activeFilter, searchQuery]
  );

  const findSOByBprNo = (bprNo: string) =>
    saleOrders.find((so) =>
      so.items.some((item) =>
        item.batchSplits.some((split) => split.bprNo === bprNo)
      )
    );

  const handlePickBatch = (bprNo: string) => setPickModalSO(findSOByBprNo(bprNo) || null);
  const handleInvoiceBatch = (bprNo: string) => setInvoiceModalSO(findSOByBprNo(bprNo) || null);
  const handleShipBatch = (bprNo: string) => setShipModalSO(findSOByBprNo(bprNo) || null);
  const handleTrackBatch = (bprNo: string) => setTrackModalSO(findSOByBprNo(bprNo) || null);
  const handleViewSO = (soNo: string) => {
    const so = saleOrders.find((s) => s.soNo === soNo);
    setDetailModalSO(so || null);
  };

  const handleSODetailAction = (action: string, soNo: string) => {
    const so = saleOrders.find((s) => s.soNo === soNo);
    if (!so) return;
    setDetailModalSO(null);
    switch (action) {
      case 'pick':
        setPickModalSO(so);
        break;
      case 'invoice':
        setInvoiceModalSO(so);
        break;
      case 'ship':
        setShipModalSO(so);
        break;
      case 'track':
        setTrackModalSO(so);
        break;
      default:
        break;
    }
  };

  const handlePickConfirm = (data: PickData) => pickModalSO && onPickConfirm(pickModalSO.soNo, data);
  const handleInvoiceGenerate = (data: InvoiceData) => invoiceModalSO && onGenerateInvoice(invoiceModalSO.soNo, data);
  const handleDispatchConfirm = (data: ShipData) => shipModalSO && onDispatch(shipModalSO.soNo, data);
  const handleDeliveryConfirm = (data: DeliveryData) => trackModalSO && onConfirmDelivery(trackModalSO.soNo, data);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Products & Batches</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Batch-split level view — FG output, location, status per batch
        </p>
      </div>

      <FilterBar
        filterType="batch"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onClearFilters={() => {
          setActiveFilter('all');
          setSearchQuery('');
        }}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Sale Order</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Product / SKU</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">BMR / BPR</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Order Date</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Due</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Planned Qty</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">FG Output</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">FG Location</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Picked</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Invoice</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">AWB / Courier</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tableRows.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-4 py-12 text-center text-gray-500">
                  <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="font-medium">No batches found</p>
                  <p className="text-xs mt-1">
                    {searchQuery || activeFilter !== 'all'
                      ? 'Try adjusting filters or search.'
                      : 'Batches will appear when BPR is closed and FG is ready.'}
                  </p>
                </td>
              </tr>
            ) : (
              tableRows.map(({ so, item, split }: Row) => (
                <BatchRow
                  key={`${so.soNo}-${split.bprNo}`}
                  so={so}
                  item={item}
                  split={split}
                  onPick={() => handlePickBatch(split.bprNo)}
                  onInvoice={() => handleInvoiceBatch(split.bprNo)}
                  onShip={() => handleShipBatch(split.bprNo)}
                  onTrack={() => handleTrackBatch(split.bprNo)}
                  onViewSO={handleViewSO}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <PickModal
        isOpen={!!pickModalSO}
        onClose={() => setPickModalSO(null)}
        saleOrder={pickModalSO}
        onConfirmPick={handlePickConfirm}
      />
      <InvoiceModal
        isOpen={!!invoiceModalSO}
        onClose={() => setInvoiceModalSO(null)}
        saleOrder={invoiceModalSO}
        onGenerateInvoice={handleInvoiceGenerate}
      />
      <ShipModal
        isOpen={!!shipModalSO}
        onClose={() => setShipModalSO(null)}
        saleOrder={shipModalSO}
        onDispatch={handleDispatchConfirm}
      />
      <TrackModal
        isOpen={!!trackModalSO}
        onClose={() => setTrackModalSO(null)}
        saleOrder={trackModalSO}
        onConfirmDelivery={handleDeliveryConfirm}
      />
      <SODetailModal
        isOpen={!!detailModalSO}
        onClose={() => setDetailModalSO(null)}
        saleOrder={detailModalSO}
        onAction={handleSODetailAction}
      />
    </div>
  );
};

function BatchRow({
  so,
  item,
  split,
  onPick,
  onInvoice,
  onShip,
  onTrack,
  onViewSO,
}: {
  so: SaleOrder;
  item: OrderItem;
  split: BatchSplit;
  onPick: () => void;
  onInvoice: () => void;
  onShip: () => void;
  onTrack: () => void;
  onViewSO: (soNo: string) => void;
}) {
  const daysLeft = getDaysLeft(so.dueDate);
  const daysLeftFormatted = formatDaysLeft(daysLeft);

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onViewSO(so.soNo)}
          className="font-mono text-xs font-bold text-blue-600 hover:underline text-left"
        >
          {so.soNo}
        </button>
        {so.priority === 'high' && (
          <span className="block text-[10px] font-bold text-red-600 mt-0.5">High</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold text-gray-800 text-xs">{so.customer}</div>
        <div className="text-[11px] text-gray-500">{so.customerCity || '—'}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold text-gray-800 text-xs">{item.productName}</div>
        <div className="flex gap-1 mt-0.5 flex-wrap">
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-600">
            {item.sku}
          </span>
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-600">
            {item.pack}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-mono text-[10px] text-blue-600">{split.bmrNo}</div>
        <div className="font-mono text-[10px] text-purple-600">{split.bprNo}</div>
      </td>
      <td className="px-4 py-3 text-[10.5px] text-gray-500">
        {formatDate(so.orderDate)}
      </td>
      <td className="px-4 py-3">
        <div className={`text-xs font-bold ${daysLeftFormatted.color}`}>
          {formatDate(so.dueDate)}
        </div>
        <div className={`text-[10px] ${daysLeftFormatted.color}`}>
          {daysLeftFormatted.text}
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">
        {formatNumber(split.plannedQty)}
      </td>
      <td className="px-4 py-3 text-right">
        {split.fgQty != null && split.fgQty > 0 ? (
          <span className="font-mono text-xs font-bold text-emerald-600">
            {formatNumber(split.fgQty)}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {split.fgLocation ? (
          <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-mono bg-teal-100 text-teal-700 border border-teal-200">
            {split.fgLocation}
          </span>
        ) : (
          <span className="text-gray-400 text-[10.5px]">—</span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-500">
        {split.pickedQty != null && split.pickedQty > 0 ? formatNumber(split.pickedQty) : '—'}
      </td>
      <td className="px-4 py-3">
        {split.invoiceNo != null ? String(split.invoiceNo) : '—'}
      </td>
      <td className="px-4 py-3">
        {split.awbNo || split.courier
          ? [split.awbNo, split.courier].filter(Boolean).join(' / ')
          : '—'}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={split.ffStatus} type="ff" size="sm" />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1 flex-wrap">
          {split.ffStatus === 'fg_ready' && (
            <Button size="sm" variant="secondary" onClick={onPick} className="whitespace-nowrap">
              <Package className="h-3.5 w-3.5 mr-1" />
              Pick
            </Button>
          )}
          {split.ffStatus === 'picking' && (
            <Button size="sm" variant="secondary" onClick={onInvoice} className="whitespace-nowrap">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Invoice
            </Button>
          )}
          {split.ffStatus === 'invoiced' && (
            <Button size="sm" variant="secondary" onClick={onShip} className="whitespace-nowrap">
              <Truck className="h-3.5 w-3.5 mr-1" />
              Ship
            </Button>
          )}
          {split.ffStatus === 'shipped' && (
            <Button size="sm" variant="secondary" onClick={onTrack} className="whitespace-nowrap">
              <MapPin className="h-3.5 w-3.5 mr-1" />
              Track
            </Button>
          )}
          {['wip', 'fg_pending', 'bulk_qc'].includes(split.ffStatus) && (
            <span className="text-[9.5px] text-gray-500">In Production</span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onViewSO(so.soNo)}
            title="View Sale Order Details"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
