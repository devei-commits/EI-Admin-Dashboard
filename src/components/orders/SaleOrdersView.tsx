/**
 * SaleOrdersView Component
 * Main view showing sale orders with KPIs, pipeline, filters, and cards
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { aggregateKPIs, aggregatePipelineCounts, formatINR, formatLakhs, formatNumber } from '../../utils/orderFulfillmentUtils';
import { computeOrderItemExecutionPercent } from '../../lib/fulfillmentExecutionPct';
import type { ExecPlanningItem } from '../../lib/fulfillmentExecutionPct';
import { StatusBadge } from './StatusBadge';
import type { SoPlanningAvailabilityResponse } from '../../services/fulfillment.service';
import { fetchSoPlanningAvailability } from '../../services/fulfillment.service';

interface SaleOrdersViewProps {
  saleOrders: SaleOrder[];
  onAddSO: (data: AddSOData) => void;
  /** Returns updated order on success so we can open Invoice modal with fresh data. */
  onPickConfirm: (soNo: string, data: PickData) => void | Promise<SaleOrder | void>;
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
  const normalizeSoKey = (value: string) => String(value || '').trim().toUpperCase();
  const now = () => new Date().toISOString();

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
  /** When set, action modals restrict to these BPRs (single-batch from SO detail). */
  const [pickSelectedBprNos, setPickSelectedBprNos] = useState<string[] | undefined>(undefined);
  const [invoiceSelectedBprNos, setInvoiceSelectedBprNos] = useState<string[] | undefined>(undefined);
  const [shipSelectedBprNos, setShipSelectedBprNos] = useState<string[] | undefined>(undefined);
  const [trackSelectedBprNos, setTrackSelectedBprNos] = useState<string[] | undefined>(undefined);

  // "Ordered Products" view — planning availability per SO/product.
  const [planningAvailabilityBySoNo, setPlanningAvailabilityBySoNo] = useState<Record<string, SoPlanningAvailabilityResponse>>({});
  const [planningAvailabilityLoading, setPlanningAvailabilityLoading] = useState(false);
  const planningAvailabilityRequestInFlight = useRef(false);
  const planningAvailabilityFetchedOnce = useRef(false);

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

  const visibleSoNos = useMemo(() => Array.from(new Set(filteredSOs.map((so) => so.soNo))), [filteredSOs]);

  useEffect(() => {
    console.log('[FULFILLMENT-AVAIL][FRONTEND][LIFECYCLE] visibleSoNos changed', {
      ts: now(),
      saleOrdersCount: saleOrders.length,
      filteredSOsCount: filteredSOs.length,
      visibleSoNos,
      activeFilter,
      activePipelineStage,
      searchQuery,
      availabilityKeys: Object.keys(planningAvailabilityBySoNo),
    });
  }, [visibleSoNos, saleOrders.length, filteredSOs.length, activeFilter, activePipelineStage, searchQuery, planningAvailabilityBySoNo]);

  useEffect(() => {
    let cancelled = false;
    const key = visibleSoNos.join('|');
    console.log('[FULFILLMENT-AVAIL][FRONTEND][EFFECT] enter', {
      ts: now(),
      key,
      visibleSoNos,
      requestInFlight: planningAvailabilityRequestInFlight.current,
      availabilityKeys: Object.keys(planningAvailabilityBySoNo),
    });
    if (!key) {
      console.log('[FULFILLMENT-AVAIL][FRONTEND][EFFECT] skip no visible SOs', { ts: now() });
      return;
    }
    if (planningAvailabilityFetchedOnce.current) {
      console.log('[FULFILLMENT-AVAIL][FRONTEND][EFFECT] skip already fetched once', { ts: now(), key });
      return;
    }

    const fetchTick = async () => {
      if (planningAvailabilityRequestInFlight.current) {
        console.log('[FULFILLMENT-AVAIL][FRONTEND][EFFECT] fetchTick skipped (request in flight)', { ts: now(), visibleSoNos });
        return;
      }
      planningAvailabilityRequestInFlight.current = true;
      setPlanningAvailabilityLoading(true);
      console.log('[FULFILLMENT-AVAIL][FRONTEND][EFFECT] fetchTick start', { ts: now(), visibleSoNos });

      try {
        const results = await Promise.all(
          visibleSoNos.map((soNo) =>
            fetchSoPlanningAvailability(soNo)
              .then((res) => ({ soNo, res }))
              .catch((e) => {
                console.error('fetchSoPlanningAvailability error', { soNo, e });
                return { soNo, res: null as any };
              })
          )
        );
        if (cancelled) return;
        console.log('[FULFILLMENT-AVAIL][FRONTEND][VIEW] fetchedResults', {
          ts: now(),
          soNos: visibleSoNos,
          results,
        });
        setPlanningAvailabilityBySoNo((prev) => {
          const next = { ...prev };
          for (const r of results) {
            if (r.res) {
              const k = normalizeSoKey(r.soNo);
              next[r.soNo] = r.res;
              next[k] = r.res;
            }
          }
          console.log('[FULFILLMENT-AVAIL][FRONTEND][STATE] setPlanningAvailabilityBySoNo', {
            ts: now(),
            prevKeys: Object.keys(prev),
            nextKeys: Object.keys(next),
          });
          return next;
        });
        planningAvailabilityFetchedOnce.current = true;
      } finally {
        planningAvailabilityRequestInFlight.current = false;
        if (!cancelled) setPlanningAvailabilityLoading(false);
        console.log('[FULFILLMENT-AVAIL][FRONTEND][EFFECT] fetchTick end', {
          ts: now(),
          cancelled,
          requestInFlight: planningAvailabilityRequestInFlight.current,
        });
      }
    };

    // Fetch only when visible SO set changes (no periodic polling).
    fetchTick();

    return () => {
      cancelled = true;
      // Important for React StrictMode in dev:
      // first effect run may be cleaned up immediately; clear this so the next run fetches instantly.
      planningAvailabilityRequestInFlight.current = false;
      console.log('[FULFILLMENT-AVAIL][FRONTEND][EFFECT] cleanup', { ts: now(), key });
    };
  }, [visibleSoNos.join('|')]);

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
    if (so) {
      setPickModalSO(so);
      setPickSelectedBprNos(undefined);
    }
  };
  const handleInvoice = (soNo: string) => {
    const so = saleOrders.find(order => order.soNo === soNo);
    if (so) {
      setInvoiceModalSO(so);
      setInvoiceSelectedBprNos(undefined);
    }
  };
  const handleShip = (soNo: string) => {
    const so = saleOrders.find(order => order.soNo === soNo);
    if (so) {
      setShipModalSO(so);
      setShipSelectedBprNos(undefined);
    }
  };
  const handleTrack = (soNo: string) => {
    const so = saleOrders.find(order => order.soNo === soNo);
    if (so) {
      setTrackModalSO(so);
      setTrackSelectedBprNos(undefined);
    }
  };

  const handlePickConfirm = async (data: PickData) => {
    if (!pickModalSO) return;
    const so = pickModalSO;
    const bprNos = data.splits.map((s) => s.bprNo);
    try {
      const updated = await Promise.resolve(onPickConfirm(so.soNo, data));
      setPickModalSO(null);
      setPickSelectedBprNos(undefined);
      setInvoiceModalSO((updated as SaleOrder | undefined) ?? so);
      setInvoiceSelectedBprNos(bprNos);
    } catch {
      setPickModalSO(null);
      setPickSelectedBprNos(undefined);
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
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">SO</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Product</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Qty</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Availability
                  <div className="text-[10px] font-normal text-gray-500">RM / PM units</div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Exec%
                  <div className="text-[10px] font-normal text-gray-500">lifecycle / batches</div>
                </th>
                {/* <th className="px-4 py-3 text-left font-semibold text-gray-700">Stage</th> */}
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Batches
                  <div className="text-[10px] font-normal text-gray-500">click to open BMR</div>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">#</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSOs.flatMap((so) =>
                so.items.map((item) => {
                  const soKey = normalizeSoKey(so.soNo);
                  const planningResp = planningAvailabilityBySoNo[so.soNo] ?? planningAvailabilityBySoNo[soKey];
                  const planningItem =
                    planningResp?.items?.find((pi) => {
                      if (pi.productName !== item.productName) return false;
                      // If SKU is missing on either side, allow match by productName only.
                      if (!pi.sku || !item.sku) return true;
                      return pi.sku === item.sku;
                    }) ??
                    planningResp?.items?.find((pi) => pi.sku && item.sku && pi.sku === item.sku) ??
                    planningResp?.items?.find((pi) => pi.productName === item.productName) ??
                    null;

                  const execPct = computeOrderItemExecutionPercent(
                    item,
                    (planningItem as ExecPlanningItem | null | undefined) ?? undefined
                  );
                  const batchCount = item.batchSplits.length;

                  const rmStartable = planningItem?.rmStartableCount ?? 0;
                  const rmStarted = planningItem?.rmStartedCount ?? 0;
                  const pmStartable = planningItem?.pmStartableCount ?? 0;
                  const pmStarted = planningItem?.pmStartedCount ?? 0;

                  const totalBatches = planningItem?.totalBatches ?? 0;
                  const rmLineAvail = planningItem?.rmLineAvailableCount ?? 0;
                  const rmLineTotal = planningItem?.rmLineTotalCount ?? 0;
                  const pmLineAvail = planningItem?.pmLineAvailableCount ?? 0;
                  const pmLineTotal = planningItem?.pmLineTotalCount ?? 0;

                  // Prefer line-level availability metric (e.g. 9/10) when backend provides it.
                  const rmNumerator = rmLineTotal > 0 ? rmLineAvail : rmStartable;
                  const rmDenominator = rmLineTotal > 0 ? rmLineTotal : totalBatches;
                  const pmNumerator = pmLineTotal > 0 ? pmLineAvail : pmStartable;
                  const pmDenominator = pmLineTotal > 0 ? pmLineTotal : totalBatches;

                  const rmAvailabilityPct = rmDenominator > 0 ? Math.min(100, Math.round((rmNumerator / rmDenominator) * 100)) : 0;
                  const pmAvailabilityPct = pmDenominator > 0 ? Math.min(100, Math.round((pmNumerator / pmDenominator) * 100)) : 0;

                  // const stage = (() => {
                  //   switch (so.soStatus) {
                  //     case 'planned':
                  //       return 'Batch setup';
                  //     case 'in_production':
                  //       return 'In manufacturing';
                  //     case 'partial':
                  //     case 'fg_ready':
                  //       return 'Batch ready';
                  //     case 'picking':
                  //       return 'Picking';
                  //     case 'invoiced':
                  //       return 'Invoice';
                  //     case 'shipped':
                  //       return 'Shipped';
                  //     case 'delivered':
                  //       return 'Delivered';
                  //     case 'closed':
                  //       return 'Closed';
                  //     default:
                  //       return so.soStatus;
                  //   }
                  // })();

                  const sentCount = planningItem?.sentCount ?? 0;
                  // "Mostly available" threshold: show green at/above 90%.
                  const rmOk = rmDenominator > 0 && rmAvailabilityPct >= 90;
                  const pmOk = pmDenominator > 0 && pmAvailabilityPct >= 90;

                  if (!planningItem) {
                    console.log('[FULFILLMENT-AVAIL][FRONTEND][ROW] NO_PLANNING_ITEM_MATCH', {
                      soNo: so.soNo,
                      soKey,
                      itemProductName: item.productName,
                      itemSku: item.sku,
                      availabilityKeys: Object.keys(planningAvailabilityBySoNo),
                      planningItems: planningResp?.items?.map((pi) => ({ productName: pi.productName, sku: pi.sku })) ?? [],
                    });
                  } else {
                    console.log('[FULFILLMENT-AVAIL][FRONTEND][ROW] MATCH', {
                      soNo: so.soNo,
                      itemProductName: item.productName,
                      itemSku: item.sku,
                      planningProductName: planningItem.productName,
                      planningSku: planningItem.sku,
                      totalBatches,
                      rmLineAvail,
                      rmLineTotal,
                      pmLineAvail,
                      pmLineTotal,
                      rmStartable,
                      rmStarted,
                      pmStartable,
                      pmStarted,
                      sentCount,
                    });
                  }

                  return (
                    <tr key={`${so.soNo}__${item.productName}__${item.sku}`}>
                      <td className="px-4 py-3 align-top">
                        <div className="font-mono text-[12px] text-gray-900">
                          {so.soNo}
                          <div className="text-[10px] text-gray-500 font-normal">{so.orderDate}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-gray-900 text-[13px]">{item.productName}</div>
                        <div className="text-[10px] text-gray-500 font-medium">{item.pack}</div>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <div className="font-mono text-[12px] text-gray-900 font-bold">
                          {formatNumber(item.orderedQty)}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-[11px]">
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span className="text-gray-500">RM</span>
                            <b className={rmOk ? 'text-emerald-700' : 'text-amber-700'}>
                              {rmNumerator}/{rmDenominator || 0}
                            </b>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">
                            started {rmStarted}/{rmStartable || 0}
                          </div>
                          <div className="bg-gray-200/60 rounded-full h-1.5 mt-2" style={{ width: 100 }}>
                            <div
                              className={rmOk ? 'bg-emerald-500' : 'bg-amber-500'}
                              style={{ width: `${rmAvailabilityPct}%`, height: 6, borderRadius: 999 }}
                            />
                          </div>
                        </div>
                        <div className="text-[11px] mt-2">
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span className="text-gray-500">PM</span>
                            <b className={pmOk ? 'text-emerald-700' : 'text-amber-700'}>
                              {pmNumerator}/{pmDenominator || 0}
                            </b>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">
                            started {pmStarted}/{pmStartable || 0}
                          </div>
                          <div className="bg-gray-200/60 rounded-full h-1.5 mt-2" style={{ width: 100 }}>
                            <div
                              className={pmOk ? 'bg-emerald-500' : 'bg-amber-500'}
                              style={{ width: `${pmAvailabilityPct}%`, height: 6, borderRadius: 999 }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div
                          className={`text-2xl font-extrabold ${execPct >= 100 ? 'text-emerald-600' : execPct >= 40 ? 'text-amber-600' : 'text-amber-700'
                            }`}
                        >
                          {execPct}%
                        </div>
                        <div className="text-[10px] text-gray-500 font-normal">
                          {batchCount} batch{batchCount !== 1 ? 'es' : ''} · wt. by planned qty
                        </div>
                      </td>
                      {/* <td className="px-4 py-3 align-top">
                        <StatusBadge status={so.soStatus} type="so" size="sm" />
                      </td> */}
                      <td className="px-4 py-3 align-top">
                        {planningAvailabilityLoading && !planningItem ? (
                          <div className="text-[11px] text-gray-500">Loading…</div>
                        ) : totalBatches === 0 ? (
                          <div className="text-[11px] text-gray-500">No batches</div>
                        ) : (
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => handleViewDetails(so.soNo)}
                          >
                            <div className="text-[12px] text-gray-900 font-semibold">
                              {sentCount}/{totalBatches} Batches
                            </div>
                            <div className="text-[10px] text-gray-500">click to open BMR</div>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <b className="font-mono text-[14px] text-gray-900">{sentCount}</b>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 px-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="inline-block bg-gray-200 p-4 rounded-full">
            <ShoppingCart size={40} className="text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mt-4">No Orders Found</h3>
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
        onAction={(action, _soNo, split) => {
          if (!detailModalSO) return;
          const bprNos = split ? [split.bprNo] : undefined;
          switch (action) {
            case 'pick':
              setPickModalSO(detailModalSO);
              setPickSelectedBprNos(bprNos);
              break;
            case 'invoice':
              setInvoiceModalSO(detailModalSO);
              setInvoiceSelectedBprNos(bprNos);
              break;
            case 'ship':
              setShipModalSO(detailModalSO);
              setShipSelectedBprNos(bprNos);
              break;
            case 'track':
              setTrackModalSO(detailModalSO);
              setTrackSelectedBprNos(bprNos);
              break;
          }
          setDetailModalSO(null);
        }}
      />

      <PickModal
        isOpen={!!pickModalSO}
        onClose={() => { setPickModalSO(null); setPickSelectedBprNos(undefined); }}
        saleOrder={pickModalSO}
        selectedBprNos={pickSelectedBprNos}
        onConfirmPick={handlePickConfirm}
      />

      <InvoiceModal
        isOpen={!!invoiceModalSO}
        onClose={() => { setInvoiceModalSO(null); setInvoiceSelectedBprNos(undefined); }}
        saleOrder={invoiceModalSO}
        selectedBprNos={invoiceSelectedBprNos}
        onGenerateInvoice={handleInvoiceGenerate}
      />

      <ShipModal
        isOpen={!!shipModalSO}
        onClose={() => { setShipModalSO(null); setShipSelectedBprNos(undefined); }}
        saleOrder={shipModalSO}
        selectedBprNos={shipSelectedBprNos}
        onDispatch={handleDispatchConfirm}
      />

      <TrackModal
        isOpen={!!trackModalSO}
        onClose={() => { setTrackModalSO(null); setTrackSelectedBprNos(undefined); }}
        saleOrder={trackModalSO}
        selectedBprNos={trackSelectedBprNos}
        onConfirmDelivery={handleDeliveryConfirm}
      />
    </div>
  );
};
