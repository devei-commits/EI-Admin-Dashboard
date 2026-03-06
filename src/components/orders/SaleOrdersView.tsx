/**
 * SaleOrdersView Component
 * Main view showing sale orders with KPIs, pipeline, filters, and cards
 */

import React, { useState, useMemo } from 'react';
import { Plus, ShoppingCart, Package, TrendingUp, DollarSign, Factory, CheckCircle, FileText, Truck, MapPin, Lock } from 'lucide-react';
import { KPICard } from './KPICard';
import { PipelineStrip } from './PipelineStrip';
import { FilterBar } from './FilterBar';
import { SOCard } from './SOCard';
import { AddSOModal } from './AddSOModal';
import { SODetailModal } from './SODetailModal';
import { PickModal } from './PickModal';
import { InvoiceModal } from './InvoiceModal';
import { ShipModal } from './ShipModal';
import { TrackModal } from './TrackModal';
import type { SaleOrder, AddSOData, PickData, InvoiceData, ShipData, DeliveryData } from '../../types/orderFulfillment';
import { aggregateKPIs, aggregatePipelineCounts, formatINR, formatLakhs, calculateSOProgress } from '../../utils/orderFulfillmentUtils';

interface SaleOrdersViewProps {
  saleOrders: SaleOrder[];
  onAddSO: (data: AddSOData) => void;
  onPickConfirm: (soNo: string, data: PickData) => void;
  onGenerateInvoice: (soNo: string, data: InvoiceData) => void;
  onDispatch: (soNo: string, data: ShipData) => void;
  onConfirmDelivery: (soNo: string, data: DeliveryData) => void;
}

export const SaleOrdersView: React.FC<SaleOrdersViewProps> = ({
  saleOrders,
  onAddSO,
  onPickConfirm,
  onGenerateInvoice,
  onDispatch,
  onConfirmDelivery
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activePipelineStage, setActivePipelineStage] = useState<string | null>(null);

  // Modal states
  const [isAddSOModalOpen, setIsAddSOModalOpen] = useState(false);
  const [detailModalSO, setDetailModalSO] = useState<SaleOrder | null>(null);
  const [pickModalSO, setPickModalSO] = useState<SaleOrder | null>(null);
  const [invoiceModalSO, setInvoiceModalSO] = useState<SaleOrder | null>(null);
  const [shipModalSO, setShipModalSO] = useState<SaleOrder | null>(null);
  const [trackModalSO, setTrackModalSO] = useState<SaleOrder | null>(null);

  // Filter sale orders
  const filteredSOs = useMemo(() => {
    let filtered = saleOrders;

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(so =>
        so.soNo.toLowerCase().includes(query) ||
        so.customer.toLowerCase().includes(query) ||
        so.items.some(item => item.productName.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (activeFilter && activeFilter !== 'all') {
      filtered = filtered.filter(so => so.soStatus === activeFilter);
    }

    // Apply pipeline stage filter
    if (activePipelineStage) {
      filtered = filtered.filter(so => so.soStatus === activePipelineStage);
    }

    return filtered;
  }, [saleOrders, activeFilter, searchQuery, activePipelineStage]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const baseKpis = aggregateKPIs(saleOrders);
    const allSplits = saleOrders.flatMap(so => so.items.flatMap(item => item.batchSplits));
    const pickingSplits = allSplits.filter(sp => ['picking', 'invoiced', 'shipped', 'delivered', 'closed'].includes(sp.ffStatus)).length;
    const invoicedSOs = saleOrders.filter(so => ['invoiced', 'shipped', 'delivered', 'closed'].includes(so.soStatus)).length;
    const inTransitSOs = saleOrders.filter(so => so.soStatus === 'shipped').length;

    return {
      ...baseKpis,
      totalOrders: baseKpis.total,
      fgReadyCount: baseKpis.fgReadySplits,
      totalSplits: allSplits.length,
      pickingSplits,
      invoicedSOs,
      inTransitSOs,
    };
  }, [saleOrders]);

  // Pipeline stage counts using actual statuses
  const pipelineCounts = useMemo(() => aggregatePipelineCounts(saleOrders), [saleOrders]);

  // Modal handlers
  const handleViewDetails = (soNo: string) => {
    const so = saleOrders.find(order => order.soNo === soNo);
    if (so) setDetailModalSO(so);
  };
  const handlePick = (soNo: string) => {
    const so = saleOrders.find(order => order.soNo === soNo);
    if (so) setPickModalSO(so);
  };
  const handleInvoice = (soNo: string) => {
    const so = saleOrders.find(order => order.soNo === soNo);
    if (so) setInvoiceModalSO(so);
  };
  const handleShip = (soNo: string) => {
    const so = saleOrders.find(order => order.soNo === soNo);
    if (so) setShipModalSO(so);
  };
  const handleTrack = (soNo: string) => {
    const so = saleOrders.find(order => order.soNo === soNo);
    if (so) setTrackModalSO(so);
  };

  const handlePickConfirm = (data: PickData) => {
    if (pickModalSO) {
      onPickConfirm(pickModalSO.soNo, data);
    }
  };

  const handleInvoiceGenerate = (data: InvoiceData) => {
    if (invoiceModalSO) {
      onGenerateInvoice(invoiceModalSO.soNo, data);
    }
  };

  const handleDispatchConfirm = (data: ShipData) => {
    if (shipModalSO) {
      onDispatch(shipModalSO.soNo, data);
    }
  };

  const handleDeliveryConfirm = (data: DeliveryData) => {
    if (trackModalSO) {
      onConfirmDelivery(trackModalSO.soNo, data);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-800">
          Sale Orders Overview
        </h2>
        <button
          onClick={() => setIsAddSOModalOpen(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          New Sale Order
        </button>
      </div>

      {/* KPI Cards — 8 matching HTML */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 pt-4">
        <KPICard
          label="Total Orders"
          value={kpis.totalOrders.toString()}
          icon={<ShoppingCart size={20} />}
          color="#3b82f6"
        />
        <KPICard
          label="Total Value"
          value={formatLakhs(kpis.totalValue)}
          icon={<DollarSign size={20} />}
          color="#10b981"
        />
        <KPICard
          label="In Production"
          value={kpis.inProduction.toString()}
          icon={<Factory size={20} />}
          color="#f59e0b"
        />
        <KPICard
          label="FG Ready"
          value={`${kpis.fgReadyCount} splits`}
          icon={<CheckCircle size={20} />}
          color="#10b981"
        />
        <KPICard
          label="Invoiced"
          value={kpis.invoicedSOs.toString()}
          icon={<FileText size={20} />}
          color="#8b5cf6"
        />
        <KPICard
          label="In Transit"
          value={kpis.inTransitSOs.toString()}
          icon={<Truck size={20} />}
          color="#f97316"
        />
        <KPICard
          label="Closed"
          value={kpis.closed.toString()}
          icon={<Lock size={20} />}
          color="#14b8a6"
        />
        <KPICard
          label="Pending Value"
          value={formatLakhs(kpis.pendingValue)}
          icon={<TrendingUp size={20} />}
          color="#ef4444"
        />
      </div>

      {/* Pipeline Strip — 8 stages */}
      <PipelineStrip
        stages={[
          { key: 'planned' as const, label: 'Planned', count: pipelineCounts.planned || 0, icon: null },
          { key: 'in_production' as const, label: 'Production', count: pipelineCounts.in_production || 0, icon: null },
          { key: 'partial' as const, label: 'Partial', count: pipelineCounts.partial || 0, icon: null },
          { key: 'fg_ready' as const, label: 'FG Ready', count: pipelineCounts.fg_ready || 0, icon: null },
          { key: 'picking' as const, label: 'Picking', count: pipelineCounts.picking || 0, icon: null },
          { key: 'invoiced' as const, label: 'Invoiced', count: pipelineCounts.invoiced || 0, icon: null },
          { key: 'shipped' as const, label: 'Shipped', count: pipelineCounts.shipped || 0, icon: null },
          { key: 'closed' as const, label: 'Closed', count: (pipelineCounts.delivered || 0) + (pipelineCounts.closed || 0), icon: null },
        ]}
        onStageClick={(stage) => setActivePipelineStage(stage === activePipelineStage ? null : stage)}
      />

      {/* Filter Bar */}
      <FilterBar
        filterType="so"
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onClearFilters={() => {
          setActiveFilter('all');
          setSearchQuery('');
          setActivePipelineStage(null);
        }}
      />

      {/* Sale Orders Grid */}
      {filteredSOs.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filteredSOs.map(so => (
            <SOCard
              key={so.soNo}
              saleOrder={so}
              progress={calculateSOProgress(so)}
              onViewDetails={handleViewDetails}
              onPick={handlePick}
              onInvoice={handleInvoice}
              onShip={handleShip}
              onTrack={handleTrack}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="inline-block bg-gray-200 p-4 rounded-full">
            <ShoppingCart size={40} className="text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mt-4">
            No Orders Found
          </h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
            {searchQuery || activeFilter !== 'all' || activePipelineStage
              ? 'Try adjusting your search or filter to find what you are looking for.'
              : 'Get started by creating a new sale order. It will appear here.'}
          </p>
        </div>
      )}

      {/* Modals */}
      <AddSOModal
        isOpen={isAddSOModalOpen}
        onClose={() => setIsAddSOModalOpen(false)}
        onSave={onAddSO}
      />

      <SODetailModal
        isOpen={!!detailModalSO}
        onClose={() => setDetailModalSO(null)}
        saleOrder={detailModalSO}
        onAction={(action, _soNo) => {
          if (!detailModalSO) return;
          switch (action) {
            case 'pick':
              setPickModalSO(detailModalSO);
              break;
            case 'invoice':
              setInvoiceModalSO(detailModalSO);
              break;
            case 'ship':
              setShipModalSO(detailModalSO);
              break;
            case 'track':
              setTrackModalSO(detailModalSO);
              break;
          }
          setDetailModalSO(null);
        }}
      />

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
    </div>
  );
};
