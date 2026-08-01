/**
 * SaleOrdersView Component
 * Main view showing sale orders with KPIs, pipeline, filters, and cards
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, ShoppingCart, TrendingUp, DollarSign, Factory, CheckCircle, FileText, Truck, Lock, MessageSquare, AlertCircle, Clock } from 'lucide-react';
import { KPICard } from './KPICard';
import { PipelineStrip } from './PipelineStrip';
import { FilterBar } from './FilterBar';
import { AddSOModal } from './AddSOModal';
import { SODetailModal } from './SODetailModal';
import { PickModal } from './PickModal';
import { InvoiceModal } from './InvoiceModal';
import { ShipModal } from './ShipModal';
import { TrackModal } from './TrackModal';
import { EditSOModal } from './EditSOModal';
import { CommentsPanel } from './CommentsPanel';
import type { SaleOrder, AddSOData, PickData, InvoiceData, ShipData, DeliveryData, CommercialStatus } from '../../types/orderFulfillment';
import { aggregateKPIs, aggregatePipelineCounts, formatLakhs, formatNumber } from '../../utils/orderFulfillmentUtils';
import { computeOrderItemExecutionPercent } from '../../lib/fulfillmentExecutionPct';
import type { ExecPlanningItem } from '../../lib/fulfillmentExecutionPct';
import type { SoPlanningAvailabilityResponse } from '../../services/fulfillment.service';
import { fetchSoPlanningAvailability } from '../../services/fulfillment.service';
import { SortableTableTh, type SortDirection } from '../ui/SortableTableTh';
import type { OrderItem, BatchSplit } from '../../types/orderFulfillment';
import { COMMERCIAL_STATUS_CONFIG } from '../../constants/orderFulfillment';

// ─── Fulfillment progress helpers ────────────────────────────────────────────

const FG_PLUS   = new Set(['fg_ready','picking','invoiced','shipped','delivered','closed']);
const PICK_PLUS  = new Set(['picking','invoiced','shipped','delivered','closed']);
const INV_PLUS   = new Set(['invoiced','shipped','delivered','closed']);
const SHIP_PLUS  = new Set(['shipped','delivered','closed']);

function computeItemProgress(item: OrderItem) {
  const splits = item.batchSplits;
  const totalSplits = splits.length || 1;
  const unitPerSplit = Math.round(item.orderedQty / totalSplits);
  let fgReady = 0, packed = 0, invoiced = 0, shipped = 0;
  for (const s of splits) {
    // Best unit estimate for this split (fgYield from production → pickedQty → proportional)
    const unitQty = (s.fgYield && s.fgYield > 0) ? s.fgYield
      : s.pickedQty > 0 ? s.pickedQty
      : unitPerSplit;
    if (FG_PLUS.has(s.ffStatus))  fgReady  += unitQty;
    if (PICK_PLUS.has(s.ffStatus)) packed   += s.pickedQty;
    if (INV_PLUS.has(s.ffStatus))  invoiced += s.pickedQty;
    if (SHIP_PLUS.has(s.ffStatus)) shipped  += s.pickedQty;
  }
  return { fgReady: Math.round(fgReady), packed, invoiced, shipped };
}

const STAGE_COLORS_PILL: Record<string, string> = {
  PLANNING:    'bg-surface-3 text-ink-3 border-border',
  PRODUCTION:  'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30',
  FG_READY:    'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30',
  PACKED:      'bg-brand-soft text-brand border-brand-soft',
  INVOICED:    'bg-brand-soft text-brand border-brand-soft',
  SHIPPED:     'bg-brand-soft text-brand border-brand-soft',
};

function ffStatusToStage(status: string): string {
  if (['shipped','delivered','closed'].includes(status)) return 'SHIPPED';
  if (status === 'invoiced') return 'INVOICED';
  if (status === 'picking') return 'PACKED';
  if (status === 'fg_ready') return 'FG_READY';
  return 'PLANNING';
}

function deriveBatchPills(splits: BatchSplit[]) {
  const seen = new Set<string>();
  return splits
    .filter(s => { const k = s.bprNo || `_${s.bmrNo}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(s => ({ bprNo: s.bprNo, stage: ffStatusToStage(s.ffStatus) }));
}

function computeSlaFlag(dueDate: string | null | undefined) {
  if (!dueDate) return { overdue: false, approaching: false, daysOverdue: 0 };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { overdue: true, approaching: false, daysOverdue: -diff };
  if (diff <= 7) return { overdue: false, approaching: true, daysOverdue: 0 };
  return { overdue: false, approaching: false, daysOverdue: 0 };
}

function fmtShortDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return d; }
}

// ─────────────────────────────────────────────────────────────────────────────

type SaleOrderItemSortColumn = 'soNo' | 'product' | 'qty' | 'availability' | 'execPct' | 'batches' | 'sentCount';

interface EnrichedSaleOrderItemRow {
  clientKey: string;
  clientName: string;
  city: string;
  so: SaleOrder;
  item: OrderItem;
  execPct: number;
  batchCount: number;
  rmAvailabilityPct: number;
  pmAvailabilityPct: number;
  rmNumerator: number;
  rmDenominator: number;
  pmNumerator: number;
  pmDenominator: number;
  rmStarted: number;
  pmStarted: number;
  totalBatches: number;
  sentCount: number;
  rmOk: boolean;
  pmOk: boolean;
  planningItem: ExecPlanningItem | null;
}

function sortValueForSaleOrderItemRow(row: EnrichedSaleOrderItemRow, column: SaleOrderItemSortColumn): string | number {
  switch (column) {
    case 'soNo':
      return row.so.soNo.toLowerCase();
    case 'product':
      return row.item.productName.toLowerCase();
    case 'qty':
      return Number(row.item.orderedQty) || 0;
    case 'availability':
      return (row.rmAvailabilityPct + row.pmAvailabilityPct) / 2;
    case 'execPct':
      return row.execPct;
    case 'batches':
      return row.totalBatches;
    case 'sentCount':
      return row.sentCount;
    default:
      return '';
  }
}

interface SaleOrdersViewProps {
  saleOrders: SaleOrder[];
  onAddSO: (data: AddSOData) => void;
  onUpdateSO: (
    soNo: string,
    data: {
      customer: string;
      customerCity: string;
      orderDate: string;
      dueDate: string;
      priority: 'normal' | 'high';
      shipAddress: string;
      paymentTerms: string;
      notes: string;
      items: Array<{ sku: string; productName: string; pack: string; orderedQty: number; unitPrice: number; mrp?: number | null }>;
    }
  ) => Promise<void> | void;
  /** Returns updated order on success so we can open Invoice modal with fresh data. */
  onPickConfirm: (soNo: string, data: PickData) => void | Promise<SaleOrder | void>;
  onGenerateInvoice: (soNo: string, data: InvoiceData) => void | Promise<void>;
  onDispatch: (soNo: string, data: ShipData) => void;
  onConfirmDelivery: (soNo: string, data: DeliveryData) => void;
  /** Open SO detail when navigating from Planning etc. (`/fulfillment?so=...`). */
  initialOpenSoNo?: string | null;
  onDeepLinkSoConsumed?: () => void;
}

export const SaleOrdersView: React.FC<SaleOrdersViewProps> = ({
  saleOrders,
  onAddSO,
  onUpdateSO,
  onPickConfirm,
  onGenerateInvoice,
  onDispatch,
  onConfirmDelivery,
  initialOpenSoNo = null,
  onDeepLinkSoConsumed,
}) => {
  const normalizeSoKey = (value: string) => String(value || '').trim().toUpperCase();
  const now = () => new Date().toISOString();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activePipelineStage, setActivePipelineStage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortColumn, setSortColumn] = useState<SaleOrderItemSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [commentPanelSo, setCommentPanelSo] = useState<{ id: number; label: string } | null>(null);

  // Modal states
  const [isAddSOModalOpen, setIsAddSOModalOpen] = useState(false);
  const [detailModalSO, setDetailModalSO] = useState<SaleOrder | null>(null);
  const [pickModalSO, setPickModalSO] = useState<SaleOrder | null>(null);
  const [invoiceModalSO, setInvoiceModalSO] = useState<SaleOrder | null>(null);
  const [shipModalSO, setShipModalSO] = useState<SaleOrder | null>(null);
  const [trackModalSO, setTrackModalSO] = useState<SaleOrder | null>(null);
  const [editModalSO, setEditModalSO] = useState<SaleOrder | null>(null);
  const [editSaving, setEditSaving] = useState(false);
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
  const deepLinkSoAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    const target = initialOpenSoNo?.trim();
    if (!target || saleOrders.length === 0) return;
    if (deepLinkSoAppliedRef.current === target) return;
    const normalized = target.toUpperCase();
    const so = saleOrders.find((order) => String(order.soNo || '').trim().toUpperCase() === normalized);
    if (!so) return;
    deepLinkSoAppliedRef.current = target;
    setDetailModalSO(so);
    setSearchQuery(so.soNo);
    onDeepLinkSoConsumed?.();
  }, [initialOpenSoNo, saleOrders, onDeepLinkSoConsumed]);

  // Filter sale orders
  const filteredSOs = useMemo(() => {
    const normalizeForSearch = (value: unknown): string =>
      String(value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    let filtered = saleOrders;

    // Apply search query
    if (searchQuery.trim()) {
      const query = normalizeForSearch(searchQuery);
      filtered = filtered.filter((so) => {
        const clientSearchText = [
          so.customer,
          (so as SaleOrder & { clientName?: string; customerName?: string }).clientName,
          (so as SaleOrder & { clientName?: string; customerName?: string }).customerName,
          (so as SaleOrder & { client?: string; client_name?: string; customer_name?: string }).client,
          (so as SaleOrder & { client?: string; client_name?: string; customer_name?: string }).client_name,
          (so as SaleOrder & { client?: string; client_name?: string; customer_name?: string }).customer_name,
        ]
          .map((v) => normalizeForSearch(v))
          .join(' ');
        return (
          normalizeForSearch(so.soNo).includes(query) ||
          clientSearchText.includes(query) ||
          so.items.some((item) => normalizeForSearch(item.productName).includes(query))
        );
      });
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

  const groupedByClient = useMemo(() => {
    const map = new Map<string, { clientName: string; city: string; orders: SaleOrder[] }>();
    for (const so of filteredSOs) {
      const clientName = String(so.customer || 'Unknown Client').trim() || 'Unknown Client';
      const city = String(so.customerCity || '').trim();
      const key = `${clientName.toLowerCase()}__${city.toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.orders.push(so);
      } else {
        map.set(key, { clientName, city, orders: [so] });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [filteredSOs]);

  const enrichedRows = useMemo((): EnrichedSaleOrderItemRow[] => {
    const rows: EnrichedSaleOrderItemRow[] = [];
    for (const so of filteredSOs) {
      const clientName = String(so.customer || 'Unknown Client').trim() || 'Unknown Client';
      const city = String(so.customerCity || '').trim();
      const clientKey = `${clientName.toLowerCase()}__${city.toLowerCase()}`;
      const soKey = normalizeSoKey(so.soNo);
      const planningResp = planningAvailabilityBySoNo[so.soNo] ?? planningAvailabilityBySoNo[soKey];

      for (const item of so.items) {
        const planningItem =
          planningResp?.items?.find((pi) => {
            if (pi.productName !== item.productName) return false;
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
        const rmNumerator = rmLineTotal > 0 ? rmLineAvail : rmStartable;
        const rmDenominator = rmLineTotal > 0 ? rmLineTotal : totalBatches;
        const pmNumerator = pmLineTotal > 0 ? pmLineAvail : pmStartable;
        const pmDenominator = pmLineTotal > 0 ? pmLineTotal : totalBatches;
        const rmAvailabilityPct =
          rmDenominator > 0 ? Math.min(100, Math.round((rmNumerator / rmDenominator) * 100)) : 0;
        const pmAvailabilityPct =
          pmDenominator > 0 ? Math.min(100, Math.round((pmNumerator / pmDenominator) * 100)) : 0;
        const sentCount = planningItem?.sentCount ?? 0;
        const rmOk = rmDenominator > 0 && rmAvailabilityPct >= 90;
        const pmOk = pmDenominator > 0 && pmAvailabilityPct >= 90;

        rows.push({
          clientKey,
          clientName,
          city,
          so,
          item,
          execPct,
          batchCount,
          rmAvailabilityPct,
          pmAvailabilityPct,
          rmNumerator,
          rmDenominator,
          pmNumerator,
          pmDenominator,
          rmStarted,
          pmStarted,
          totalBatches,
          sentCount,
          rmOk,
          pmOk,
          planningItem: (planningItem as ExecPlanningItem | null) ?? null,
        });
      }
    }
    return rows;
  }, [filteredSOs, planningAvailabilityBySoNo]);

  const sortedEnrichedRows = useMemo(() => {
    if (!sortColumn) return enrichedRows;
    const rows = [...enrichedRows];
    rows.sort((a, b) => {
      const av = sortValueForSaleOrderItemRow(a, sortColumn);
      const bv = sortValueForSaleOrderItemRow(b, sortColumn);
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      }
      if (cmp === 0) {
        cmp = `${a.so.soNo}-${a.item.productName}`.localeCompare(`${b.so.soNo}-${b.item.productName}`, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [enrichedRows, sortColumn, sortDirection]);

  const toggleSaleOrderSort = (column: SaleOrderItemSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter, activePipelineStage, pageSize, sortColumn, sortDirection]);

  const totalRowPages = Math.max(1, Math.ceil(sortedEnrichedRows.length / pageSize));
  const totalClientPages = Math.max(1, Math.ceil(groupedByClient.length / pageSize));
  const useRowPagination = sortColumn != null;
  const totalPages = useRowPagination ? totalRowPages : totalClientPages;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedEnrichedRows = useMemo(() => {
    if (!useRowPagination) return [];
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedEnrichedRows.slice(start, start + pageSize);
  }, [sortedEnrichedRows, safeCurrentPage, pageSize, useRowPagination]);
  const pagedClientGroups = useMemo(() => {
    if (useRowPagination) return [];
    const start = (safeCurrentPage - 1) * pageSize;
    return groupedByClient.slice(start, start + pageSize);
  }, [groupedByClient, safeCurrentPage, pageSize, useRowPagination]);

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
  const isEditLocked = (_so: SaleOrder) => false;
  const editLockReason = '';

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

  const handleInvoiceGenerate = async (data: InvoiceData) => {
    if (invoiceModalSO) {
      await Promise.resolve(onGenerateInvoice(invoiceModalSO.soNo, data));
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
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-ink">
          Sale Orders Overview
        </h2>
        <button
          onClick={() => setIsAddSOModalOpen(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand text-white hover:bg-brand-press transition-all flex items-center gap-2"
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
        <>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-surface-3 border-b border-border">
              <tr>
                <SortableTableTh label="SO" column="soNo" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleSaleOrderSort} />
                <SortableTableTh label="Product" column="product" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleSaleOrderSort} />
                <SortableTableTh label="Qty · Due" column="qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleSaleOrderSort} align="right" />
                <SortableTableTh
                  label={
                    <>
                      Availability
                      <div className="text-[10px] font-normal normal-case tracking-normal text-ink-3">RM / PM lines · WH or BMR/BPR done</div>
                    </>
                  }
                  column="availability"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSaleOrderSort}
                />
                <th scope="col" className="px-4 py-3 text-left font-semibold text-ink-2 text-sm whitespace-nowrap">
                  Fulfillment Progress
                  <div className="text-[10px] font-normal text-ink-3">FG · Packed · Invoiced · Shipped</div>
                </th>
                <SortableTableTh
                  label={
                    <>
                      Exec%
                      <div className="text-[10px] font-normal normal-case tracking-normal text-ink-3">lifecycle / batches</div>
                    </>
                  }
                  column="execPct"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSaleOrderSort}
                />
                <th scope="col" className="px-4 py-3 text-left font-semibold text-ink-2 text-sm whitespace-nowrap">Batch Stages</th>
                <SortableTableTh
                  label={
                    <>
                      Batches
                      <div className="text-[10px] font-normal normal-case tracking-normal text-ink-3">click to open BMR</div>
                    </>
                  }
                  column="batches"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSaleOrderSort}
                />
                <SortableTableTh label="#" column="sentCount" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleSaleOrderSort} align="right" />
                <th scope="col" className="px-4 py-3 text-left font-semibold text-ink-2 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {useRowPagination
                ? pagedEnrichedRows.map((row) => (
                    <SaleOrderItemTableRow
                      key={`${row.so.soNo}__${row.item.productName}__${row.item.sku}`}
                      row={row}
                      planningAvailabilityLoading={planningAvailabilityLoading}
                      onViewDetails={handleViewDetails}
                      onEdit={setEditModalSO}
                      isEditLocked={isEditLocked}
                      onComments={(id, label) => setCommentPanelSo({ id, label })}
                    />
                  ))
                : pagedClientGroups.flatMap((clientGroup) => {
                    const clientKey = `${clientGroup.clientName.toLowerCase()}__${clientGroup.city.toLowerCase()}`;
                    const clientRows = enrichedRows.filter((r) => r.clientKey === clientKey);
                    const groupHeader = (
                      <tr key={`client-header-${clientGroup.clientName}-${clientGroup.city}`} className="bg-brand-soft">
                        <td colSpan={10} className="px-4 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-brand">
                              {clientGroup.clientName}
                              {clientGroup.city ? (
                                <span className="text-xs font-normal text-brand ml-2">({clientGroup.city})</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-brand">
                              {clientGroup.orders.length} order{clientGroup.orders.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                    return [
                      groupHeader,
                      ...clientRows.map((row) => (
                        <SaleOrderItemTableRow
                          key={`${row.so.soNo}__${row.item.productName}__${row.item.sku}`}
                          row={row}
                          planningAvailabilityLoading={planningAvailabilityLoading}
                          onViewDetails={handleViewDetails}
                          onEdit={setEditModalSO}
                          isEditLocked={isEditLocked}
                          onComments={(id, label) => setCommentPanelSo({ id, label })}
                        />
                      )),
                    ];
                  })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-border bg-surface-3">
          <div className="text-xs text-ink-3">
            {useRowPagination
              ? `Page ${safeCurrentPage} of ${totalPages} · Showing ${pagedEnrichedRows.length} of ${sortedEnrichedRows.length} rows`
              : `Page ${safeCurrentPage} of ${totalPages} · Showing ${pagedClientGroups.length} of ${groupedByClient.length} clients`}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 10)}
              aria-label="Rows per page"
              className="text-xs border border-border rounded px-2 py-1 bg-surface"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="px-2 py-1 text-xs rounded border border-border disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="px-2 py-1 text-xs rounded border border-border disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
        </>
      ) : (
        <div className="text-center py-16 px-4 bg-surface-3 border-2 border-dashed border-border rounded-xl">
          <div className="inline-block bg-surface-3 p-4 rounded-full">
            <ShoppingCart size={40} className="text-ink-3" />
          </div>
          <h3 className="text-lg font-semibold text-ink mt-4">No Orders Found</h3>
          <p className="text-sm text-ink-3 mt-1 max-w-xs mx-auto">
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
        onEditSO={(soNo) => {
          const so = saleOrders.find((order) => order.soNo === soNo);
          if (so) setEditModalSO(so);
        }}
        editDisabled={detailModalSO ? isEditLocked(detailModalSO) : false}
        editDisabledReason={editLockReason}
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

      <EditSOModal
        isOpen={!!editModalSO}
        saleOrder={editModalSO}
        canEdit={editModalSO ? !isEditLocked(editModalSO) : false}
        lockReason={editLockReason}
        isSaving={editSaving}
        onClose={() => setEditModalSO(null)}
        onSave={async (payload) => {
          if (!editModalSO) return;
          setEditSaving(true);
          try {
            await Promise.resolve(onUpdateSO(editModalSO.soNo, payload));
            setEditModalSO(null);
          } finally {
            setEditSaving(false);
          }
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

      {commentPanelSo && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setCommentPanelSo(null)} />
          <CommentsPanel
            entityType="so"
            entityId={commentPanelSo.id}
            entityLabel={commentPanelSo.label}
            onClose={() => setCommentPanelSo(null)}
          />
        </>
      )}
    </div>
  );
};

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-20 h-1.5 rounded-full bg-surface-3 overflow-hidden shrink-0 inline-block">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function CommercialBadge({ status }: { status: CommercialStatus }) {
  const cfg = COMMERCIAL_STATUS_CONFIG[status] ?? COMMERCIAL_STATUS_CONFIG.received;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9.5px] font-semibold ${cfg.color} ${cfg.bgColor} ${cfg.borderColor}`}>
      <Icon size={9} className="shrink-0" />
      {cfg.label}
    </span>
  );
}

function SaleOrderItemTableRow({
  row,
  planningAvailabilityLoading,
  onViewDetails,
  onEdit,
  isEditLocked,
  onComments,
}: {
  row: EnrichedSaleOrderItemRow;
  planningAvailabilityLoading: boolean;
  onViewDetails: (soNo: string) => void;
  onEdit: (so: SaleOrder) => void;
  isEditLocked: (so: SaleOrder) => boolean;
  onComments: (id: number, label: string) => void;
}): JSX.Element {
  const {
    so, item, execPct, batchCount,
    rmNumerator, rmDenominator, pmNumerator, pmDenominator,
    rmStarted, pmStarted, totalBatches, sentCount,
    rmOk, pmOk, rmAvailabilityPct, pmAvailabilityPct, planningItem,
  } = row;

  const progress = computeItemProgress(item);
  const ordQty = item.orderedQty || 1;
  const fgPct   = Math.min(100, Math.round(progress.fgReady  / ordQty * 100));
  const pkPct   = Math.min(100, Math.round(progress.packed   / ordQty * 100));
  const invPct  = Math.min(100, Math.round(progress.invoiced / ordQty * 100));
  const shpPct  = Math.min(100, Math.round(progress.shipped  / ordQty * 100));

  const pills = deriveBatchPills(item.batchSplits);
  const sla = computeSlaFlag(so.dueDate);
  const commercialStatus = so.commercialStatus;

  return (
    <tr className="hover:bg-surface-3/60">
      {/* SO No + commercial status + SLA */}
      <td className="px-4 py-3 align-top">
        <div className="font-mono text-[12px] text-ink font-semibold">{so.soNo}</div>
        <div className="text-[10px] text-ink-4 mt-0.5">{so.orderDate}</div>
        {commercialStatus && (
          <div className="mt-1">
            <CommercialBadge status={commercialStatus} />
          </div>
        )}
        {sla.overdue && (
          <div className="mt-1 flex items-center gap-0.5 text-[9px] text-err font-semibold">
            <AlertCircle size={9} /> {sla.daysOverdue}d overdue
          </div>
        )}
        {!sla.overdue && sla.approaching && (
          <div className="mt-1 flex items-center gap-0.5 text-[9px] text-warn font-semibold">
            <Clock size={9} /> Due soon
          </div>
        )}
      </td>

      {/* Product */}
      <td className="px-4 py-3 align-top">
        <div className="font-semibold text-ink text-[13px]">{item.productName}</div>
        {item.pack && <div className="text-[10px] text-ink-4 mt-0.5">{item.pack}</div>}
      </td>

      {/* Qty + Due Date */}
      <td className="px-4 py-3 text-right align-top">
        <div className="font-mono text-[13px] text-ink font-bold">{formatNumber(item.orderedQty)}</div>
        <div className="text-[10px] text-ink-4 mt-0.5">Due {fmtShortDate(so.dueDate)}</div>
      </td>

      {/* RM / PM Availability */}
      <td className="px-4 py-3 align-top">
        <div className="text-[11px]">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="text-ink-3">RM</span>
            <b className={rmOk ? 'text-ok' : 'text-warn'}>{rmNumerator}/{rmDenominator || 0}</b>
          </div>
          <div className="text-[10px] text-ink-3 mt-1">started {rmStarted}/{totalBatches || 0}</div>
          <div className="bg-surface-3/60 rounded-full h-1.5 mt-1.5" style={{ width: 100 }}>
            <div className={rmOk ? 'bg-ok' : 'bg-warn'} style={{ width: `${rmAvailabilityPct}%`, height: 6, borderRadius: 999 }} />
          </div>
        </div>
        <div className="text-[11px] mt-2">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="text-ink-3">PM</span>
            <b className={pmOk ? 'text-ok' : 'text-warn'}>{pmNumerator}/{pmDenominator || 0}</b>
          </div>
          <div className="text-[10px] text-ink-3 mt-1">started {pmStarted}/{totalBatches || 0}</div>
          <div className="bg-surface-3/60 rounded-full h-1.5 mt-1.5" style={{ width: 100 }}>
            <div className={pmOk ? 'bg-ok' : 'bg-warn'} style={{ width: `${pmAvailabilityPct}%`, height: 6, borderRadius: 999 }} />
          </div>
        </div>
      </td>

      {/* Fulfillment Progress: FG / Packed / Invoiced / Shipped */}
      <td className="px-4 py-3 align-top min-w-[180px]">
        {[
          { label: 'FG',  qty: progress.fgReady,  pct: fgPct,  color: 'bg-brand' },
          { label: 'Pkg', qty: progress.packed,   pct: pkPct,  color: 'bg-brand' },
          { label: 'Inv', qty: progress.invoiced, pct: invPct, color: 'bg-brand' },
          { label: 'Shp', qty: progress.shipped,  pct: shpPct, color: 'bg-brand' },
        ].map(({ label, qty, pct, color }) => (
          <div key={label} className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-ink-4 w-6 shrink-0">{label}</span>
            <MiniBar pct={pct} color={color} />
            <span className="text-[10px] tabular-nums text-ink-2 whitespace-nowrap">
              {formatNumber(qty)}<span className="text-ink-4">/{formatNumber(item.orderedQty)}</span>
            </span>
          </div>
        ))}
      </td>

      {/* Exec% */}
      <td className="px-4 py-3 align-top">
        <div className={`text-2xl font-extrabold ${execPct >= 100 ? 'text-ok' : execPct >= 40 ? 'text-warn' : 'text-warn'}`}>
          {execPct}%
        </div>
        <div className="text-[10px] text-ink-3 font-normal">
          {batchCount} batch{batchCount !== 1 ? 'es' : ''} · wt. by planned qty
        </div>
      </td>

      {/* Batch Stage Pills */}
      <td className="px-4 py-3 align-top min-w-[120px]">
        <div className="flex flex-wrap gap-1">
          {pills.length === 0 && <span className="text-[10px] text-ink-4">—</span>}
          {pills.slice(0, 4).map((p, i) => {
            const cls = STAGE_COLORS_PILL[p.stage] ?? STAGE_COLORS_PILL.PLANNING;
            return (
              <span key={i} title={`${p.bprNo || '—'} · ${p.stage}`}
                className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9.5px] font-medium ${cls}`}>
                {p.bprNo || 'Pending'}
              </span>
            );
          })}
          {pills.length > 4 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-surface-3 text-ink-3 border-border text-[9.5px]">
              +{pills.length - 4}
            </span>
          )}
        </div>
      </td>

      {/* Batches */}
      <td className="px-4 py-3 align-top">
        {planningAvailabilityLoading && !planningItem ? (
          <div className="text-[11px] text-ink-3">Loading…</div>
        ) : totalBatches === 0 ? (
          <div className="text-[11px] text-ink-3">No batches</div>
        ) : (
          <button type="button" className="text-left" onClick={() => onViewDetails(so.soNo)}>
            <div className="text-[12px] text-ink font-semibold">{sentCount}/{totalBatches} Batches</div>
            <div className="text-[10px] text-ink-3">click to open BMR</div>
          </button>
        )}
      </td>

      {/* # sent */}
      <td className="px-4 py-3 text-right align-top">
        <b className="font-mono text-[14px] text-ink">{sentCount}</b>
      </td>

      {/* Actions + Comments */}
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-1.5 items-start">
          {!isEditLocked(so) && (
            <button type="button" onClick={() => onEdit(so)}
              className="px-2.5 py-1.5 rounded-md border text-xs font-semibold border-brand-soft text-brand bg-brand-soft hover:bg-brand-soft whitespace-nowrap">
              Edit SO
            </button>
          )}
          {so.id != null && (
            <button type="button"
              onClick={() => onComments(so.id!, so.soNo)}
              title="Comments & history"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-semibold border-brand-soft text-brand bg-brand-soft hover:bg-brand-soft whitespace-nowrap">
              <MessageSquare size={12} />
              Comments
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
