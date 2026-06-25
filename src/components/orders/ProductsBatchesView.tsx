import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Package,
  FileText,
  Truck,
  MapPin,
  Eye,
  Activity,
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
import { buildBatchTimelineSteps } from '../../services/fulfillment.service';
import { SortableTableTh, type SortDirection } from '../ui/SortableTableTh';

interface ProductsBatchesViewProps {
  saleOrders: SaleOrder[];
  onPickConfirm: (soNo: string, data: PickData) => void;
  onGenerateInvoice: (soNo: string, data: InvoiceData) => void | Promise<void>;
  onDispatch: (soNo: string, data: ShipData) => void;
  onConfirmDelivery: (soNo: string, data: DeliveryData) => void;
  onViewYieldSplit?: (payload: {
    bmrNo: string;
    bprNo: string;
    productName: string;
    soNo: string;
    plannedQty: number;
    bmrYieldKg: number;
    bprBulkUnits: number;
    actualOutputUnits: number;
    bmrWasteKg: number;
    bprWasteUnits: number;
    overallWasteUnits: number;
    bmrYieldPct: number;
    completionPercent: number;
  }) => void;
  initialSearchQuery?: string;
  initialOpenBmrNo?: string | null;
  onDeepLinkConsumed?: () => void;
}

type Row = { so: SaleOrder; item: OrderItem; split: BatchSplit };

type BatchSortColumn =
  | 'saleOrder'
  | 'customer'
  | 'product'
  | 'bmrBpr'
  | 'orderDate'
  | 'dueDate'
  | 'plannedQty'
  | 'fgOutput'
  | 'completion'
  | 'fgLocation'
  | 'picked'
  | 'invoice'
  | 'awb'
  | 'status';

function batchCompletionPct(split: BatchSplit): number {
  const planned = Number(split.plannedQty || 0) || 0;
  const fgOutput = Number(split.fgOutput ?? split.fgQty ?? split.fgYield ?? 0) || 0;
  if (planned <= 0) return 0;
  return Math.min(100, Math.max(0, Number(split.completionPercent ?? Math.round((fgOutput / planned) * 100))));
}

function sortValueForBatchRow(row: Row, column: BatchSortColumn): string | number {
  const { so, item, split } = row;
  switch (column) {
    case 'saleOrder':
      return so.soNo.toLowerCase();
    case 'customer':
      return String(so.customer || '').toLowerCase();
    case 'product':
      return item.productName.toLowerCase();
    case 'bmrBpr':
      return `${split.bmrNo} ${split.bprNo}`.toLowerCase();
    case 'orderDate':
      return new Date(so.orderDate).getTime() || 0;
    case 'dueDate':
      return new Date(so.dueDate).getTime() || 0;
    case 'plannedQty':
      return Number(split.plannedQty) || 0;
    case 'fgOutput':
      return Number(split.fgQty ?? split.fgOutput ?? split.fgYield ?? 0) || 0;
    case 'completion':
      return batchCompletionPct(split);
    case 'fgLocation':
      return (split.fgLocation || '').toLowerCase();
    case 'picked':
      return Number(split.pickedQty) || 0;
    case 'invoice':
      return String(split.invoiceNo || '').toLowerCase();
    case 'awb':
      return [split.awbNo, split.courier].filter(Boolean).join(' ').toLowerCase();
    case 'status':
      return split.ffStatus;
    default:
      return '';
  }
}

export const ProductsBatchesView: React.FC<ProductsBatchesViewProps> = ({
  saleOrders,
  onPickConfirm,
  onGenerateInvoice,
  onDispatch,
  onConfirmDelivery,
  onViewYieldSplit,
  initialSearchQuery = '',
  initialOpenBmrNo = null,
  onDeepLinkConsumed,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<BatchSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [pickModalSO, setPickModalSO] = useState<SaleOrder | null>(null);
  const [invoiceModalSO, setInvoiceModalSO] = useState<SaleOrder | null>(null);
  const [shipModalSO, setShipModalSO] = useState<SaleOrder | null>(null);
  const [trackModalSO, setTrackModalSO] = useState<SaleOrder | null>(null);
  const [detailModalSO, setDetailModalSO] = useState<SaleOrder | null>(null);
  const batchesDeepLinkAppliedRef = useRef(false);

  useEffect(() => {
    if (initialSearchQuery) setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);

  useEffect(() => {
    if (!initialOpenBmrNo || batchesDeepLinkAppliedRef.current || saleOrders.length === 0) return;
    const target = initialOpenBmrNo.trim().toLowerCase();
    const matchSo = saleOrders.find((so) =>
      so.items.some((item) =>
        item.batchSplits.some(
          (split) =>
            split.bmrNo.toLowerCase() === target || split.bprNo.toLowerCase() === target,
        ),
      ),
    );
    if (matchSo) {
      batchesDeepLinkAppliedRef.current = true;
      setDetailModalSO(matchSo);
      onDeepLinkConsumed?.();
    }
  }, [initialOpenBmrNo, saleOrders, onDeepLinkConsumed]);

  const tableRows = useMemo(
    () => filterBatchSplits(saleOrders, activeFilter, searchQuery),
    [saleOrders, activeFilter, searchQuery]
  );

  const sortedTableRows = useMemo(() => {
    if (!sortColumn) return tableRows;
    const rows = [...tableRows];
    rows.sort((a, b) => {
      const av = sortValueForBatchRow(a, sortColumn);
      const bv = sortValueForBatchRow(b, sortColumn);
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      }
      if (cmp === 0) {
        cmp = `${a.so.soNo}-${a.split.bprNo}`.localeCompare(`${b.so.soNo}-${b.split.bprNo}`, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [tableRows, sortColumn, sortDirection]);

  const toggleBatchSort = (column: BatchSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  };

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
  const handleInvoiceGenerate = async (data: InvoiceData) => {
    if (invoiceModalSO) await Promise.resolve(onGenerateInvoice(invoiceModalSO.soNo, data));
  };
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
              <SortableTableTh label="Sale Order" column="saleOrder" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} />
              <SortableTableTh label="Customer" column="customer" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} />
              <SortableTableTh label="Product / SKU" column="product" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} />
              <SortableTableTh label="BMR / BPR" column="bmrBpr" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} />
              <SortableTableTh label="Order Date" column="orderDate" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} />
              <SortableTableTh label="Due" column="dueDate" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} />
              <SortableTableTh label="Planned Qty" column="plannedQty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} align="right" />
              <SortableTableTh label="FG Output" column="fgOutput" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} align="right" />
              <SortableTableTh label="Completion" column="completion" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} align="right" />
              <SortableTableTh label="FG Location" column="fgLocation" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} />
              <SortableTableTh label="Picked" column="picked" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} align="right" />
              <SortableTableTh label="Invoice" column="invoice" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} />
              <SortableTableTh label="AWB / Courier" column="awb" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} />
              <SortableTableTh label="Status" column="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleBatchSort} />
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedTableRows.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-4 py-12 text-center text-gray-500">
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
              sortedTableRows.map(({ so, item, split }: Row) => (
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
                  onViewYield={onViewYieldSplit ? () => {
                    const plannedQty = Number(split.plannedQty) || 0;
                    const bmrYieldKg = Number(split.bulkYield) || 0;
                    const bprBulkUnits = Number(split.fillYield) || 0;
                    const actualOutputUnits = Number(split.fgYield) || bprBulkUnits;
                    const bmrWasteKg = Math.max(0, plannedQty - bmrYieldKg);
                    const bprWasteUnits = Math.max(0, bprBulkUnits - actualOutputUnits);
                    const overallWasteUnits = Math.max(0, plannedQty - actualOutputUnits);
                    const bmrYieldPct = plannedQty > 0 ? (bmrYieldKg / plannedQty) * 100 : 0;
                    const completionPercent = plannedQty > 0 ? Math.min(100, (actualOutputUnits / plannedQty) * 100) : 0;
                    onViewYieldSplit({
                      bmrNo: split.bmrNo,
                      bprNo: split.bprNo,
                      productName: item.productName,
                      soNo: so.soNo,
                      plannedQty,
                      bmrYieldKg,
                      bprBulkUnits,
                      actualOutputUnits,
                      bmrWasteKg,
                      bprWasteUnits,
                      overallWasteUnits,
                      bmrYieldPct,
                      completionPercent,
                    });
                  } : undefined}
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
  onViewYield,
}: {
  so: SaleOrder;
  item: OrderItem;
  split: BatchSplit;
  onPick: () => void;
  onInvoice: () => void;
  onShip: () => void;
  onTrack: () => void;
  onViewSO: (soNo: string) => void;
  onViewYield?: () => void;
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
      <td className="px-4 py-3 min-w-52">
        <BatchTimelineCell split={split} />
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
          {split.ffStatus === 'fg_ready' && ((Number(split.bulkYield) || 0) > 0 || (Number(split.fillYield) || 0) > 0 || (Number(split.fgYield) || 0) > 0) && onViewYield && (
            <Button size="sm" variant="secondary" onClick={onViewYield} className="whitespace-nowrap">
              <Activity className="h-3.5 w-3.5 mr-1" />
              Yield
            </Button>
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

function BatchTimelineCell({ split }: { split: BatchSplit }) {
  const planned = Number(split.plannedQty || 0) || 0;
  const fgOutput = Number(split.fgOutput ?? split.fgQty ?? split.fgYield ?? 0) || 0;
  const remaining = Math.max(0, Number(split.remainingQty ?? (planned - fgOutput)) || 0);
  const pct = planned > 0
    ? Math.min(100, Math.max(0, Number(split.completionPercent ?? Math.round((fgOutput / planned) * 100))))
    : 0;
  const steps = buildBatchTimelineSteps(split);

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-gray-600">
        <span className="font-medium">Planned:</span> {formatNumber(planned)}{' '}
        <span className="font-medium ml-1.5">FG:</span> {formatNumber(fgOutput)}{' '}
        <span className="font-medium ml-1.5">Rem:</span> {formatNumber(remaining)}
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded">
        <div
          className="h-1.5 rounded bg-indigo-500"
          style={{ width: `${pct}%` }}
          title={`Completion ${pct}%`}
        />
      </div>
      <div className="flex items-center gap-1">
        {steps.map((step) => (
          <span
            key={step.key}
            title={step.label}
            className={`h-2 w-2 rounded-full ${
              step.status === 'done'
                ? 'bg-emerald-500'
                : step.status === 'active'
                  ? 'bg-indigo-500'
                  : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
