import React, { useState, useMemo } from 'react';
import {
  Package,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { KPICard } from './KPICard';
import { FilterBar } from './FilterBar';
import { BatchSplitTable } from './BatchSplitTable';
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
import { filterSaleOrders } from '../../utils/orderFulfillmentUtils';
import { UnifiedButton as Button } from '../ui/UnifiedComponents';

interface ProductsBatchesViewProps {
  saleOrders: SaleOrder[];
  onPickConfirm: (soNo: string, data: PickData) => void;
  onGenerateInvoice: (soNo: string, data: InvoiceData) => void;
  onDispatch: (soNo: string, data: ShipData) => void;
  onConfirmDelivery: (soNo: string, data: DeliveryData) => void;
}

interface BatchWithContext extends BatchSplit {
  soNo: string;
  customer: string;
  productName: string;
  pack: string;
  sku: string;
}

const ProductBatchCard: React.FC<{
  product: { name: string; sku: string; pack: string };
  rows: Array<{ so: SaleOrder; item: OrderItem; split: BatchSplit }>;
  onPick: (bprNo: string) => void;
  onInvoice: (bprNo: string) => void;
  onShip: (bprNo: string) => void;
  onTrack: (bprNo: string) => void;
  onViewSO: (soNo: string) => void;
}> = ({ product, rows, ...actions }) => {
  const [isOpen, setIsOpen] = useState(true);

  const totalQty = useMemo(
    () => rows.reduce((acc, row) => acc + row.split.fgQty, 0),
    [rows]
  );
  const readyQty = useMemo(
    () =>
      rows
        .filter((r) => r.split.ffStatus === 'fg_ready')
        .reduce((acc, row) => acc + row.split.fgQty, 0),
    [rows]
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div
        className="flex justify-between items-center p-4 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-gray-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">{product.name}</h3>
            <p className="text-sm text-gray-500">
              {product.sku} &middot; {product.pack}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <p className="text-xs text-gray-500">Total Batches</p>
            <p className="font-bold text-lg text-gray-800">{rows.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Qty</p>
            <p className="font-bold text-lg text-gray-800">{totalQty}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Ready for Picking</p>
            <p className="font-bold text-lg text-green-600">{readyQty}</p>
          </div>
          <Button variant="ghost" size="sm">
            {isOpen ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>
      </div>
      {isOpen && (
        <div className="border-t">
          <BatchSplitTable rows={rows} {...actions} />
        </div>
      )}
    </div>
  );
};

export const ProductsBatchesView: React.FC<ProductsBatchesViewProps> = ({
  saleOrders,
  onPickConfirm,
  onGenerateInvoice,
  onDispatch,
  onConfirmDelivery,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Modal states
  const [pickModalSO, setPickModalSO] = useState<SaleOrder | null>(null);
  const [invoiceModalSO, setInvoiceModalSO] = useState<SaleOrder | null>(null);
  const [shipModalSO, setShipModalSO] = useState<SaleOrder | null>(null);
  const [trackModalSO, setTrackModalSO] = useState<SaleOrder | null>(null);
  const [detailModalSO, setDetailModalSO] = useState<SaleOrder | null>(null);

  const productsWithBatches = useMemo(() => {
    const filteredSOs = filterSaleOrders(saleOrders, activeFilter, searchQuery);
    const filteredSONos = new Set(filteredSOs.map((so) => so.soNo));

    const products: {
      [productName: string]: {
        product: { name: string; sku: string; pack: string };
        rows: Array<{ so: SaleOrder; item: OrderItem; split: BatchSplit }>;
      };
    } = {};

    saleOrders.forEach((so) => {
      if (!filteredSONos.has(so.soNo)) return;

      so.items.forEach((item) => {
        if (item.batchSplits.length > 0) {
          if (!products[item.productName]) {
            products[item.productName] = {
              product: {
                name: item.productName,
                sku: item.sku,
                pack: item.pack,
              },
              rows: [],
            };
          }

          item.batchSplits.forEach((split) => {
            products[item.productName].rows.push({ so, item, split });
          });
        }
      });
    });

    return Object.values(products);
  }, [saleOrders, activeFilter, searchQuery]);

  const batchKPIs = useMemo(() => {
    const allBatches = saleOrders.flatMap(so => so.items.flatMap(item => item.batchSplits));
    const totalBatches = allBatches.length;
    const wipCount = allBatches.filter((b) => b.ffStatus === 'wip').length;
    const fgReadyCount = allBatches.filter(
      (b) => b.ffStatus === 'fg_ready'
    ).length;
    const completedCount = allBatches.filter((b) =>
      ['picked', 'invoiced', 'shipped', 'delivered', 'closed'].includes(b.ffStatus)
    ).length;
    const completionRate =
      totalBatches > 0
        ? Math.round((completedCount / totalBatches) * 100)
        : 0;

    return { totalBatches, wipCount, fgReadyCount, completionRate };
  }, [saleOrders]);

  // Modal handlers
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

  // Handle SO Detail Modal actions
  const handleSODetailAction = (action: string, soNo: string) => {
    const so = saleOrders.find((s) => s.soNo === soNo);
    if (!so) return;

    setDetailModalSO(null); // Close the detail modal
    
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

  // Modal confirm handlers
  const handlePickConfirm = (data: PickData) => pickModalSO && onPickConfirm(pickModalSO.soNo, data);
  const handleInvoiceGenerate = (data: InvoiceData) => invoiceModalSO && onGenerateInvoice(invoiceModalSO.soNo, data);
  const handleDispatchConfirm = (data: ShipData) => shipModalSO && onDispatch(shipModalSO.soNo, data);
  const handleDeliveryConfirm = (data: DeliveryData) => trackModalSO && onConfirmDelivery(trackModalSO.soNo, data);

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Products & Batches Dashboard
        </h2>
        <p className="text-sm text-gray-600">
          Product-centric view of all production splits and their fulfillment
          status.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Batches"
          value={batchKPIs.totalBatches.toString()}
          icon={<Package size={20} />}
          color="blue"
        />
        <KPICard
          label="In Production (WIP)"
          value={batchKPIs.wipCount.toString()}
          icon={<AlertCircle size={20} />}
          color="purple"
        />
        <KPICard
          label="Ready for Picking"
          value={batchKPIs.fgReadyCount.toString()}
          icon={<CheckCircle size={20} />}
          color="orange"
        />
        <KPICard
          label="Completion Rate"
          value={`${batchKPIs.completionRate}%`}
          icon={<TrendingUp size={20} />}
          color="emerald"
        />
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

      {productsWithBatches.length > 0 ? (
        <div className="space-y-4">
          {productsWithBatches.map(({ product, rows }) => (
            <ProductBatchCard
              key={product.name}
              product={product}
              rows={rows}
              onPick={handlePickBatch}
              onInvoice={handleInvoiceBatch}
              onShip={handleShipBatch}
              onTrack={handleTrackBatch}
              onViewSO={handleViewSO}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
          <Package size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-800 mb-1">
            No Batches Found
          </h3>
          <p className="text-sm text-gray-500">
            {searchQuery || activeFilter !== 'all'
              ? 'Try adjusting your filters or search query.'
              : 'Batches will appear here once production starts for an order.'}
          </p>
        </div>
      )}

      {/* Modals */}
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