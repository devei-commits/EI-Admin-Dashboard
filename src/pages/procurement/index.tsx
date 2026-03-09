import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { useGlobalState } from '../../context/GlobalStateContext';
import logoFull from '../../assets/logo/eilogofull.svg';
import procurementData from '../../mocks/procurement-data.json';
import { fetchProcurementRequests as fetchProcurementRequestsApi, updateProcurementRequest as updateProcurementRequestApi } from '../../services/procurement.service';
import type { ProcurementRequestItem as BackendPRItem } from '../../services/procurement.service';
import { fetchProcurementQuotations } from '../../services/procurementQuotations.service';
import { fetchVendorClients } from '../../services/vendorClient.service';
import { fetchPurchaseOrders, createPurchaseOrder, updatePurchaseOrder } from '../../services/salesPurchase.service';
import { fetchPoTracking, updatePoTracking } from '../../services/poTracking.service';
import type { PoTrackingRecord } from '../../services/poTracking.service';
import { createGRN, fetchGRNList, type GRNRecordFromApi } from '../../services/grn.service';
import { fetchWarehouseInventory, type WarehouseInventoryRow } from '../../services/warehouseInventory.service';
import {
  mapBackendPrToRequest,
  mapBackendQuotationToQuote,
  mapVendorClientToVendor,
  mapOrderToPurchaseOrder,
  mapPurchaseOrderToDraftPO,
} from './procurementDataMappers';
import type {
  RequestType,
  RequestPriority,
  RequestStatus,
  QuoteStatus,
  MainTab,
  SideSection,
  ItemDetail,
  ProcurementRequest,
  VendorQuote,
  Vendor,
  DraftPOLineItem,
  DraftPO,
  PurchaseOrder,
  CompletedGrn,
  StockCheckStatus,
  StockCheckLineData,
  ItemTrackerRow,
  LiveProcurementState,
} from '../../types/procurement.types';
import StockCheckUpdateModal from './StockCheckUpdateModal';
import ProcurementVendors from './ProcurementVendors';
import ProcurementReports from './ProcurementReports';

const DRAFT_POS_SEED: DraftPO[] = (procurementData as any).draftPOs as DraftPO[];
const PROCUREMENT_LIVE_KEY = 'eiadmin.procurement.live.v1';

const MAIN_TABS: MainTab[] = ['Procurement', 'Vendors', 'Reports'];
const SIDE_SECTIONS: SideSection[] = ['Overview', 'Requests', 'Quotations', 'Draft POs', 'Issued POs', 'GRN Monitor', 'Stock Check', 'Item Tracker'];

const isMainTab = (value: string | null): value is MainTab => Boolean(value && MAIN_TABS.includes(value as MainTab));
const isSideSection = (value: string | null): value is SideSection => Boolean(value && SIDE_SECTIONS.includes(value as SideSection));

const getInitialMainTab = (searchParams: URLSearchParams): MainTab => (isMainTab(searchParams.get('tab')) ? (searchParams.get('tab') as MainTab) : 'Procurement');
const getInitialSideSection = (searchParams: URLSearchParams): SideSection => (isSideSection(searchParams.get('section')) ? (searchParams.get('section') as SideSection) : 'Overview');

const deriveStockCheckStatusForRequest = (request: ProcurementRequest): StockCheckStatus => {
  if (request.status === 'New' || request.status === 'Quoted') {
    return 'Assigned';
  }
  if (request.status === 'PO Draft') {
    return 'In Progress';
  }
  return 'Completed';
};

const getInitialLiveState = (): LiveProcurementState => {
  const emptyRequests: ProcurementRequest[] = [];
  const emptyQuotes: VendorQuote[] = [];
  const initialStockStatuses: Record<string, StockCheckStatus> = {};

  if (typeof window === 'undefined') {
    return {
      requests: emptyRequests,
      quotes: emptyQuotes,
      draftPOs: DRAFT_POS_SEED,
      completedGrns: [],
      stockCheckStatuses: initialStockStatuses,
      stockCheckUpdates: {},
      updatedAt: new Date().toISOString(),
    };
  }

  const raw = window.localStorage.getItem(PROCUREMENT_LIVE_KEY);
  if (!raw) {
    return {
      requests: emptyRequests,
      quotes: emptyQuotes,
      draftPOs: DRAFT_POS_SEED,
      completedGrns: [],
      stockCheckStatuses: initialStockStatuses,
      stockCheckUpdates: {},
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const parsed = JSON.parse(raw) as LiveProcurementState;
    const draftPOs = Array.isArray(parsed?.draftPOs) ? parsed.draftPOs : DRAFT_POS_SEED;
    const completedGrns = Array.isArray(parsed?.completedGrns) ? parsed.completedGrns : [];
    const stockCheckStatuses = parsed?.stockCheckStatuses && typeof parsed.stockCheckStatuses === 'object' ? parsed.stockCheckStatuses : {};
    const stockCheckUpdates = parsed?.stockCheckUpdates && typeof parsed.stockCheckUpdates === 'object' ? parsed.stockCheckUpdates : {};

    return {
      requests: emptyRequests,
      quotes: emptyQuotes,
      draftPOs,
      completedGrns,
      stockCheckStatuses,
      stockCheckUpdates,
      updatedAt: parsed?.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return {
      requests: emptyRequests,
      quotes: emptyQuotes,
      draftPOs: DRAFT_POS_SEED,
      completedGrns: [],
      stockCheckStatuses: {},
      stockCheckUpdates: {},
      updatedAt: new Date().toISOString(),
    };
  }
};

const statusClass: Record<QuoteStatus, string> = {
  Confirmed: 'text-emerald-700 border-emerald-300 bg-emerald-50',
  'Not Selected': 'text-slate-700 border-slate-300 bg-slate-100',
  'Pending Review': 'text-yellow-700 border-yellow-300 bg-yellow-50',
};

const requestTypeClass: Record<RequestType, string> = {
  RM: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  PM: 'bg-violet-50 text-violet-700 border-violet-200',
};

const statusBg: Record<RequestStatus, string> = {
  'New': 'bg-blue-50 text-blue-700 border-blue-200',
  'Quoted': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'PO Draft': 'bg-orange-50 text-orange-700 border-orange-200',
  'PO Released': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Delivery Pending': 'bg-rose-50 text-rose-700 border-rose-200',
  'Under GRN': 'bg-slate-50 text-slate-700 border-slate-200',
};

const priorityClass: Record<RequestPriority, string> = {
  'High': 'bg-rose-50 text-rose-700 border-rose-200',
  'Medium': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Low': 'bg-slate-50 text-slate-700 border-slate-200',
};

const Procurement: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialLiveState = useMemo(() => getInitialLiveState(), []);

  const [mainTab, setMainTab] = useState<MainTab>(() => getInitialMainTab(searchParams));
  const [sideSection, setSideSection] = useState<SideSection>(() => getInitialSideSection(searchParams));
  const [requests, setRequests] = useState<ProcurementRequest[]>(initialLiveState.requests);
  const [quotes, setQuotes] = useState<VendorQuote[]>(initialLiveState.quotes);
  const [draftPOs, setDraftPOs] = useState<DraftPO[]>(initialLiveState.draftPOs);
  const [completedGrns, setCompletedGrns] = useState<CompletedGrn[]>(initialLiveState.completedGrns ?? []);
  const [stockCheckStatuses, setStockCheckStatuses] = useState<Record<string, StockCheckStatus>>(
    initialLiveState.stockCheckStatuses ?? {},
  );
  const [stockCheckUpdates, setStockCheckUpdates] = useState<
    Record<string, Record<string, StockCheckLineData>>
  >(initialLiveState.stockCheckUpdates ?? {});
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>(initialLiveState.updatedAt);
  const [categoryFilter, setCategoryFilter] = useState<'All' | RequestType>('All');
  const [vendorFilter, setVendorFilter] = useState('All Vendors');
  const [statusFilter, setStatusFilter] = useState<'All Statuses' | QuoteStatus>('All Statuses');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'All Statuses' | RequestStatus>('All Statuses');
  const [draftPOStatusFilter, setDraftPOStatusFilter] = useState<'All Statuses' | 'Pending Approval' | 'Approved'>('All Statuses');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [newRequestForm, setNewRequestForm] = useState({
    category: '',
    type: 'RM' as RequestType,
    source: 'Planning Team',
    priority: 'High' as 'High' | 'Medium' | 'Low',
    requestDate: '27-02-2026',
    requiredDate: '',
    itemName: '',
    reqQty: '',
    uom: '',
    moq: '',
    plannedPrice: '',
    packSize: '',
    leadTimeDays: '',
    preferredVendor: '',
    notes: '',
    requireStockCheck: 'No'
  });
  const [selectedRequest, setSelectedRequest] = useState<ProcurementRequest | null>(null);
  const [editRequestTarget, setEditRequestTarget] = useState<ProcurementRequest | null>(null);
  const [editRequestForm, setEditRequestForm] = useState<{
    priority: RequestPriority;
    requiredByDate: string;
    notes: string;
    status: RequestStatus;
    preferredVendor: string;
    items: BackendPRItem[];
  }>({ priority: 'Medium', requiredByDate: '', notes: '', status: 'New', preferredVendor: '', items: [] });
  const [editDraftPOTarget, setEditDraftPOTarget] = useState<DraftPO | null>(null);
  const [editDraftPOForm, setEditDraftPOForm] = useState<Pick<DraftPO, 'vendor' | 'paymentTerms' | 'expectedDelivery' | 'deliveryAddress' | 'lineItems'>>({ vendor: '', paymentTerms: '', expectedDelivery: '', deliveryAddress: '', lineItems: [] });
  const [poTrackingForm, setPoTrackingForm] = useState<Partial<PoTrackingRecord>>({});
  const [selectedStockCheckRequest, setSelectedStockCheckRequest] = useState<ProcurementRequest | null>(null);
  const [selectedStockCheckItemName, setSelectedStockCheckItemName] = useState<string | null>(null);
  const [updateStockCheckRequest, setUpdateStockCheckRequest] = useState<ProcurementRequest | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedDraftPO, setSelectedDraftPO] = useState<DraftPO | null>(null);
  const [selectedGrn, setSelectedGrn] = useState<{
    request: ProcurementRequest;
    vendor: string;
    poRef: string;
    grnRef: string;
    lines: {
      itemName: string;
      itemCode: string;
      orderedQty: string;
      receivedQty: string;
      qcPass: string;
      qcFail: string;
      receivedDate: string;
      status: 'Pending GRN' | 'Under GRN' | 'Completed';
    }[];
  } | null>(null);
  const [splitPOTarget, setSplitPOTarget] = useState<DraftPO | null>(null);
  const [splitSelectedLineIndexes, setSplitSelectedLineIndexes] = useState<number[]>([]);
  const [releasePOTarget, setReleasePOTarget] = useState<DraftPO | null>(null);
  const [releaseMethod, setReleaseMethod] = useState<'Email + Portal' | 'Email only' | 'Portal only' | 'WhatsApp + Email'>('Email + Portal');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [issuedSearch, setIssuedSearch] = useState('');
  const [issuedVendorFilter, setIssuedVendorFilter] = useState('All Vendors');
  const [issuedStatusFilter, setIssuedStatusFilter] = useState<'All' | 'Released' | 'In Transit' | 'At Risk'>('All');
  const [_issuedViewMode, _setIssuedViewMode] = useState<'Table' | 'Cards'>('Cards');
  const [grnCategoryFilter, setGrnCategoryFilter] = useState<'All' | RequestType>('All');
  const [grnVendorFilter, setGrnVendorFilter] = useState('All Vendors');
  const [grnStatusFilter, setGrnStatusFilter] = useState<'All' | 'Pending GRN' | 'Under GRN' | 'Completed'>('All');
  const [grnSearch, setGrnSearch] = useState('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState<'All' | RequestType>('All');
  const [stockStatusFilter, setStockStatusFilter] = useState<'All Statuses' | 'Assigned' | 'In Progress' | 'Completed' | 'In Stock' | 'Low Stock' | 'Critical' | 'Out of Stock'>('All Statuses');
  const [stockSearch, setStockSearch] = useState('');
  const [itemTrackerCategory, setItemTrackerCategory] = useState<'All' | RequestType>('All');
  const [itemTrackerVendor, setItemTrackerVendor] = useState('All Vendors');
  const [itemTrackerStatus, setItemTrackerStatus] = useState<'All Statuses' | RequestStatus>('All Statuses');
  const [itemTrackerSearch, setItemTrackerSearch] = useState('');

  const queryClient = useQueryClient();
  const { dispatch: globalDispatch } = useGlobalState();

  const { data: backendPrResult } = useQuery({
    queryKey: ['procurement-requests'],
    queryFn: async () => {
      const res = await fetchProcurementRequestsApi();
      return res.success ? (res.data ?? []) : [];
    },
  });

  const { data: quotationsResult } = useQuery({
    queryKey: ['procurement-quotations'],
    queryFn: async () => {
      const res = await fetchProcurementQuotations();
      return res.success ? (res.data ?? []) : [];
    },
  });

  const { data: vendorClientList } = useQuery({
    queryKey: ['vendor-client', 'vendor'],
    queryFn: async () => {
      const res = await fetchVendorClients('vendor');
      return res.success ? (res.data ?? []) : [];
    },
  });

  const { data: purchaseOrdersRaw } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const res = await fetchPurchaseOrders();
      return res.success ? (res.data ?? []) : [];
    },
  });

  const { data: grnListFromApi, isLoading: grnListLoading } = useQuery({
    queryKey: ['grn-list'],
    queryFn: fetchGRNList,
    enabled: sideSection === 'GRN Monitor',
  });

  const { data: warehouseInventoryData, isLoading: warehouseInventoryLoading } = useQuery({
    queryKey: ['warehouse-inventory'],
    queryFn: async () => {
      const res = await fetchWarehouseInventory();
      return res.success ? res.data : null;
    },
    enabled: sideSection === 'Stock Check' || sideSection === 'Item Tracker',
  });

  const requestsFromApi = useMemo(
    () => (backendPrResult ?? []).map(mapBackendPrToRequest),
    [backendPrResult]
  );

  const quotesFromApi = useMemo(() => {
    const list = quotationsResult ?? [];
    return list.map((q) => {
      const req = requestsFromApi.find((r) => r.id === String(q.procurementRequestId));
      return mapBackendQuotationToQuote(q, req?.code, req?.type);
    });
  }, [quotationsResult, requestsFromApi]);

  const vendors: Vendor[] = useMemo(
    () => (vendorClientList ?? []).map(mapVendorClientToVendor),
    [vendorClientList]
  );

  const purchaseOrders: PurchaseOrder[] = useMemo(
    () => (purchaseOrdersRaw ?? []).map((row: any) => mapOrderToPurchaseOrder(row)),
    [purchaseOrdersRaw]
  );

  const draftPOsFromApi = useMemo(() => {
    const reqs = requestsFromApi;
    return purchaseOrders
      .filter((p) => p.status === 'Draft')
      .map((po) => mapPurchaseOrderToDraftPO(po, reqs));
  }, [purchaseOrders, requestsFromApi]);

  const { data: poTrackingData } = useQuery({
    queryKey: ['po-tracking', selectedPO?.backendPoId],
    queryFn: async () => {
      if (!selectedPO?.backendPoId) return null;
      const res = await fetchPoTracking(selectedPO.backendPoId);
      return res.success ? res.data : null;
    },
    enabled: !!selectedPO?.backendPoId,
  });

  const isProcurementDataLoading =
    backendPrResult === undefined ||
    quotationsResult === undefined ||
    vendorClientList === undefined ||
    purchaseOrdersRaw === undefined;

  useEffect(() => {
    if (backendPrResult !== undefined) setRequests(requestsFromApi);
  }, [backendPrResult, requestsFromApi]);

  useEffect(() => {
    if (quotationsResult !== undefined) setQuotes(quotesFromApi);
  }, [quotationsResult, quotesFromApi]);

  useEffect(() => {
    if (isProcurementDataLoading) return;
    setDraftPOs(draftPOsFromApi);
  }, [isProcurementDataLoading, draftPOsFromApi]);

  useEffect(() => {
    if (!editRequestTarget) return;
    const backendPr = backendPrResult?.find((p: { id: string }) => String(p.id) === editRequestTarget.id) as { items?: BackendPRItem[]; preferredVendor?: string } | undefined;
    const items = Array.isArray(backendPr?.items) ? backendPr.items.map((i) => ({ ...i })) : [];
    setEditRequestForm({
      priority: editRequestTarget.priority,
      requiredByDate: editRequestTarget.dueDate?.slice(0, 10) ?? '',
      notes: (backendPr as { notes?: string } | undefined)?.notes ?? '',
      status: editRequestTarget.status,
      preferredVendor: backendPr?.preferredVendor ?? '',
      items,
    });
  }, [editRequestTarget, backendPrResult]);

  useEffect(() => {
    if (!poTrackingData) {
      setPoTrackingForm({});
      return;
    }
    setPoTrackingForm({
      poReleasedAt: poTrackingData.poReleasedAt ?? undefined,
      poReleasedNote: poTrackingData.poReleasedNote ?? undefined,
      advancePaidAt: poTrackingData.advancePaidAt ?? undefined,
      advancePaidNote: poTrackingData.advancePaidNote ?? undefined,
      vendorConfirmedAt: poTrackingData.vendorConfirmedAt ?? undefined,
      vendorConfirmedNote: poTrackingData.vendorConfirmedNote ?? undefined,
      shippedAt: poTrackingData.shippedAt ?? undefined,
      shippedNote: poTrackingData.shippedNote ?? undefined,
      orderTrackingRef: poTrackingData.orderTrackingRef ?? undefined,
      deliveredAt: poTrackingData.deliveredAt ?? undefined,
      deliveredNote: poTrackingData.deliveredNote ?? undefined,
      underGrnAt: poTrackingData.underGrnAt ?? undefined,
      underGrnNote: poTrackingData.underGrnNote ?? undefined,
      grnCompleteAt: poTrackingData.grnCompleteAt ?? undefined,
      grnCompleteNote: poTrackingData.grnCompleteNote ?? undefined,
    });
  }, [poTrackingData]);

  useEffect(() => {
    if (!editDraftPOTarget) return;
    setEditDraftPOForm({
      vendor: editDraftPOTarget.vendor,
      paymentTerms: editDraftPOTarget.paymentTerms,
      expectedDelivery: editDraftPOTarget.expectedDelivery,
      deliveryAddress: editDraftPOTarget.deliveryAddress,
      lineItems: editDraftPOTarget.lineItems.map((l) => ({ ...l })),
    });
  }, [editDraftPOTarget]);

  const updateEditRequestItem = (index: number, updates: Partial<BackendPRItem>) => {
    setEditRequestForm((prev) => {
      const next = [...prev.items];
      if (next[index]) next[index] = { ...next[index], ...updates };
      return { ...prev, items: next };
    });
  };

  const backendPrs = backendPrResult ?? [];

  const applyRouteState = (tab: MainTab, section?: SideSection) => {
    const nextSection = tab === 'Procurement' ? section ?? sideSection : 'Overview';
    setMainTab(tab);
    setSideSection(nextSection);

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('tab', tab);

    if (tab === 'Procurement') {
      nextSearchParams.set('section', nextSection);
    } else {
      nextSearchParams.delete('section');
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  const updateProcurementState = (
    updater: (current: {
      requests: ProcurementRequest[];
      quotes: VendorQuote[];
      draftPOs: DraftPO[];
      completedGrns: CompletedGrn[];
      stockCheckStatuses: Record<string, StockCheckStatus>;
      stockCheckUpdates: Record<string, Record<string, StockCheckLineData>>;
    }) => {
      requests?: ProcurementRequest[];
      quotes?: VendorQuote[];
      draftPOs?: DraftPO[];
      completedGrns?: CompletedGrn[];
      stockCheckStatuses?: Record<string, StockCheckStatus>;
      stockCheckUpdates?: Record<string, Record<string, StockCheckLineData>>;
    },
  ) => {
    const next = updater({ requests, quotes, draftPOs, completedGrns, stockCheckStatuses, stockCheckUpdates });
    if (next.requests) setRequests(next.requests);
    if (next.quotes) setQuotes(next.quotes);
    if (next.draftPOs) setDraftPOs(next.draftPOs);
    if (next.completedGrns) setCompletedGrns(next.completedGrns);
    if (next.stockCheckStatuses) setStockCheckStatuses(next.stockCheckStatuses);
    if (next.stockCheckUpdates) setStockCheckUpdates(next.stockCheckUpdates);
  };

  useEffect(() => {
    const routeTab = getInitialMainTab(searchParams);
    const routeSection = getInitialSideSection(searchParams);

    if (routeTab !== mainTab) {
      setMainTab(routeTab);
    }

    if (routeTab === 'Procurement' && routeSection !== sideSection) {
      setSideSection(routeSection);
    }
  }, [mainTab, searchParams, sideSection]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const liveState: LiveProcurementState = {
      requests,
      quotes,
      draftPOs,
      completedGrns,
      stockCheckStatuses,
      stockCheckUpdates,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(PROCUREMENT_LIVE_KEY, JSON.stringify(liveState));
    setLastUpdatedAt(liveState.updatedAt);
  }, [completedGrns, draftPOs, quotes, requests, stockCheckStatuses, stockCheckUpdates]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== PROCUREMENT_LIVE_KEY || !event.newValue) {
        return;
      }

      try {
        const incoming = JSON.parse(event.newValue) as LiveProcurementState;
        setDraftPOs(incoming.draftPOs ?? DRAFT_POS_SEED);
        setCompletedGrns(incoming.completedGrns ?? []);
        if (incoming.stockCheckStatuses) {
          setStockCheckStatuses(incoming.stockCheckStatuses);
        }
        if (incoming.stockCheckUpdates) {
          setStockCheckUpdates(incoming.stockCheckUpdates);
        }
        setLastUpdatedAt(incoming.updatedAt ?? new Date().toISOString());
      } catch {
        // Ignore malformed payloads from other sessions.
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const sideCounts = useMemo(() => {
    const requestCount = requests.length;
    const quotationsCount = quotes.length;
    const draftPosCount = draftPOs.length;
    const issuedPos = requests.filter((request) => request.status === 'PO Released' || request.status === 'Delivery Pending').length;
    const grnCount = Math.max(issuedPos, 1);
    const stockCheck = requests.filter((request) => request.priority !== 'Low').length;
    const itemTracker = new Set(requests.flatMap((request) => request.items)).size;

    return {
      Overview: requestCount,
      Requests: requestCount,
      Quotations: quotationsCount,
      'Draft POs': draftPosCount,
      'Issued POs': issuedPos,
      'GRN Monitor': grnCount,
      'Stock Check': stockCheck,
      'Item Tracker': itemTracker,
    };
  }, [draftPOs, quotes, requests]);

  const itemTrackerRows = useMemo<ItemTrackerRow[]>(() => {
    const poByRequestCode = new Map<string, PurchaseOrder>();
    purchaseOrders.forEach((po) => {
      if (po.requestCode) {
        poByRequestCode.set(po.requestCode, po);
      }
    });

    const draftPoByRequestId = new Map<string, DraftPO>();
    draftPOs.forEach((dpo) => {
      draftPoByRequestId.set(dpo.requestId, dpo);
    });

    const quotesByRequestId = new Map<string, VendorQuote[]>();
    quotes.forEach((quote) => {
      const list = quotesByRequestId.get(quote.requestId) ?? [];
      list.push(quote);
      quotesByRequestId.set(quote.requestId, list);
    });

    const rows: ItemTrackerRow[] = [];

    requests.forEach((request) => {
      const requestQuotes = quotesByRequestId.get(request.id) ?? [];
      const confirmedQuote = requestQuotes.find((q) => q.status === 'Confirmed') ?? null;
      const primaryQuote = confirmedQuote ?? requestQuotes[0] ?? null;
      const draftPo = draftPoByRequestId.get(request.id) ?? null;
      const po = poByRequestCode.get(request.code) ?? null;

      const details: ItemDetail[] =
        request.itemDetails && request.itemDetails.length > 0
          ? request.itemDetails
          : request.items.map((itemName, idx) => {
              const qty = request.quantities?.[idx] ?? 0;
              const plannedPrice = request.plannedPrices?.[idx] ?? 0;
              return {
                itemCode: `EI-${request.type}-${String(idx + 1).padStart(3, '0')}`,
                itemName,
                reqQty: qty,
                unit: request.units?.[idx] ?? '',
                moq: '',
                packSize: '',
                plannedPrice,
                leadTimeDays: 0,
                estValue: plannedPrice * qty,
              };
            });

      details.forEach((detail) => {
        const itemName = detail.itemName;

        let quotedVendor: string | null = null;
        let actualPrice: number | null = null;
        let actualVsPlanned: string | null = null;
        let orderQty: string | null = null;

        if (requestQuotes.length > 0) {
          const sourceQuote =
            confirmedQuote ??
            requestQuotes.find((q) => q.lines.some((line) => line.item === itemName)) ??
            requestQuotes[0];

          const matchedLine = sourceQuote.lines.find((line) => line.item === itemName) ?? sourceQuote.lines[0];
          quotedVendor = sourceQuote.vendor;
          actualPrice = matchedLine?.pricePerUnit ?? null;
          actualVsPlanned = matchedLine?.vsPlanned ?? null;
          orderQty = matchedLine?.qty ?? null;
        }

        let advPaid: string | null = null;
        let lrNo: string | null = null;

        if (po && po.timeline) {
          const advanceStage = po.timeline.find((step) => step.stage === 'Advance Paid' && step.done);
          if (advanceStage) {
            advPaid = 'Yes';
          }

          const shippedStage = po.timeline.find((step) => step.stage === 'Shipped' && step.done && step.note);
          if (shippedStage?.note) {
            const match = shippedStage.note.match(/LR No: ([A-Za-z0-9-]+)/i);
            if (match) {
              lrNo = match[1];
            }
          }
        }

        const expDelivery = draftPo?.expectedDelivery ?? request.dueDate ?? null;

        rows.push({
          key: `${request.id}::${detail.itemCode}`,
          requestId: request.id,
          requestCode: request.code,
          type: request.type,
          priority: request.priority,
          requestStatus: request.status,
          itemName: detail.itemName,
          itemCode: detail.itemCode,
          reqQty: detail.reqQty,
          unit: detail.unit,
          plannedPrice: detail.plannedPrice,
          plannedValue: detail.estValue,
          preferredVendor: primaryQuote?.vendor ?? null,
          quotedVendor,
          actualPrice,
          actualVsPlanned,
          poNumber: po?.poNumber ?? null,
          poStatus: po?.status ?? null,
          orderQty,
          advPaid,
          lrNo,
          expDelivery,
          grnRef: null,
          quoteId: primaryQuote?.id ?? null,
          draftPoId: draftPo?.id ?? null,
          poId: po?.id ?? null,
        });
      });
    });

    return rows;
  }, [draftPOs, purchaseOrders, quotes, requests]);

  const filteredItemTrackerRows = useMemo(() => {
    return itemTrackerRows.filter((row) => {
      if (itemTrackerCategory !== 'All' && row.type !== itemTrackerCategory) {
        return false;
      }

      if (itemTrackerVendor !== 'All Vendors') {
        if (row.preferredVendor !== itemTrackerVendor && row.quotedVendor !== itemTrackerVendor) {
          return false;
        }
      }

      if (itemTrackerStatus !== 'All Statuses' && row.requestStatus !== itemTrackerStatus) {
        return false;
      }

      if (!itemTrackerSearch.trim()) {
        return true;
      }

      const q = itemTrackerSearch.toLowerCase();
      return (
        row.itemName.toLowerCase().includes(q) ||
        row.itemCode.toLowerCase().includes(q) ||
        row.requestCode.toLowerCase().includes(q) ||
        (row.poNumber ?? '').toLowerCase().includes(q)
      );
    });
  }, [itemTrackerCategory, itemTrackerRows, itemTrackerSearch, itemTrackerStatus, itemTrackerVendor]);

  const itemTrackerVendors = useMemo(() => {
    const set = new Set<string>();
    itemTrackerRows.forEach((row) => {
      if (row.preferredVendor) set.add(row.preferredVendor);
      if (row.quotedVendor) set.add(row.quotedVendor);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [itemTrackerRows]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) => {
      if (categoryFilter !== 'All' && quote.requestType !== categoryFilter) {
        return false;
      }

      if (vendorFilter !== 'All Vendors' && quote.vendor !== vendorFilter) {
        return false;
      }

      if (statusFilter !== 'All Statuses' && quote.status !== statusFilter) {
        return false;
      }

      if (sideSection === 'Quotations' || sideSection === 'Overview') {
        /* ignored */
      } else if (sideSection === 'Draft POs') {
        const linkedRequest = requests.find((request) => request.id === quote.requestId);
        if (!linkedRequest || linkedRequest.status !== 'PO Draft') {
          return false;
        }
      } else if (sideSection === 'Issued POs') {
        const linkedRequest = requests.find((request) => request.id === quote.requestId);
        if (!linkedRequest || linkedRequest.status !== 'PO Released') {
          return false;
        }
      } else if (sideSection === 'Requests') {
        const linkedRequest = requests.find((request) => request.id === quote.requestId);
        if (!linkedRequest || linkedRequest.status !== 'New') {
          return false;
        }
      }

      if (!searchQuery.trim()) {
        return true;
      }

      const query = searchQuery.toLowerCase();

      return (
        quote.vendor.toLowerCase().includes(query) ||
        quote.requestCode.toLowerCase().includes(query) ||
        quote.id.toLowerCase().includes(query) ||
        quote.lines.some((line) => line.item.toLowerCase().includes(query))
      );
    });
  }, [categoryFilter, vendorFilter, statusFilter, searchQuery, quotes, sideSection, requests]);

  const filteredDraftPOs = useMemo(() => {
    return draftPOs.filter((dpo) => {
      if (categoryFilter !== 'All' && dpo.type !== categoryFilter) return false;
      if (vendorFilter !== 'All Vendors' && dpo.vendor !== vendorFilter) return false;
      if (draftPOStatusFilter !== 'All Statuses' && dpo.status !== draftPOStatusFilter) return false;
      return true;
    });
  }, [draftPOs, categoryFilter, vendorFilter, draftPOStatusFilter]);

  /** Requests set to PO Draft via Edit Request but with no Draft PO created yet (create from Quotations) */
  const requestsPODraftNoDraftPO = useMemo(() => {
    const linkedRequestIds = new Set(draftPOs.map((d) => d.requestId));
    return requests.filter(
      (r) => r.status === 'PO Draft' && !linkedRequestIds.has(r.id)
    );
  }, [requests, draftPOs]);

  const quoteStats = useMemo(() => {
    const totalQuotes = filteredQuotes.length;
    const confirmed = filteredQuotes.filter((quote) => quote.status === 'Confirmed').length;
    const notSelected = filteredQuotes.filter((quote) => quote.status === 'Not Selected').length;
    const pendingReview = filteredQuotes.filter((quote) => quote.status === 'Pending Review').length;
    const quotesValue = filteredQuotes.reduce(
      (sum, quote) => sum + quote.lines.reduce((lineSum, line) => lineSum + line.totalValue, 0),
      0,
    );

    return {
      totalQuotes,
      confirmed,
      notSelected,
      pendingReview,
      quotesValue,
      urgent: requests.filter((request) => request.priority === 'High' && request.status === 'New').length,
      pendingAction: requests.filter((request) => request.status === 'New' || request.status === 'Quoted').length,
    };
  }, [filteredQuotes, requests]);

  const issuedPORecords = useMemo(() => {
    const today = new Date();

    return requests
      .filter((request) => request.status === 'PO Released' || request.status === 'Delivery Pending')
      .map((request) => {
        const linkedDraftPO = draftPOs.find((draftPo) => draftPo.requestId === request.id);
        const linkedPO = purchaseOrders.find(
          (p) =>
            p.status === 'Released' &&
            (String(p.formData?.requestId) === String(request.id) ||
              String(p.formData?.requestCode).toUpperCase() === String(request.code).toUpperCase())
        );
        const linkedQuote = quotes.find((quote) => quote.requestId === request.id && quote.status === 'Confirmed') ??
          quotes.find((quote) => quote.requestId === request.id);

        const etaDays = Math.ceil((new Date(request.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const computedStatus: 'Released' | 'In Transit' | 'At Risk' =
          request.status === 'Delivery Pending'
            ? 'In Transit'
            : etaDays < 0 || (request.priority === 'High' && etaDays <= 2)
            ? 'At Risk'
            : 'Released';

        const fallbackLineItems = request.items.map((item, index) => ({
          item,
          itemCode: `EI-${request.type}-${String(index + 1).padStart(3, '0')}`,
          type: request.type,
          qty: request.itemDetails?.[index]?.reqQty ? `${request.itemDetails[index].reqQty}` : '—',
          pricePerUnit: request.itemDetails?.[index]?.plannedPrice ?? 0,
          gstPercent: 18,
          gstAmount: 0,
          lineTotal: request.itemDetails?.[index]?.estValue ?? 0,
        }));

        const lineItems =
          linkedDraftPO?.lineItems ??
          (linkedPO?.rawItems && Array.isArray(linkedPO.rawItems) && linkedPO.rawItems.length > 0
            ? (linkedPO.rawItems as any[]).map((i: any, idx: number) => ({
                item: i.itemName ?? i.name ?? request.items[idx] ?? '',
                itemCode: `EI-${request.type}-${String(idx + 1).padStart(3, '0')}`,
                type: request.type,
                qty: String(i.quantity ?? ''),
                pricePerUnit: Number(i.rate ?? i.price ?? 0),
                gstPercent: 18,
                gstAmount: 0,
                lineTotal: Number(i.quantity ?? 0) * Number(i.rate ?? i.price ?? 0),
              }))
            : fallbackLineItems);

        const grandTotal =
          linkedDraftPO?.grandTotal ??
          linkedPO?.value ??
          lineItems.reduce((sum, line) => sum + line.lineTotal, 0);

        return {
          request,
          poNumber: (linkedDraftPO?.dpoNumber ?? linkedPO?.poNumber ?? request.code).replace('DPO', 'PO'),
          vendor: linkedDraftPO?.vendor ?? linkedPO?.vendorName ?? linkedQuote?.vendor ?? 'Unassigned Vendor',
          status: computedStatus,
          etaDays,
          lineItems,
          grandTotal,
          requestCode: request.code,
          createdDate: linkedDraftPO?.createdDate ?? linkedPO?.date ?? request.createdDate ?? '',
          paymentTerms: linkedDraftPO?.paymentTerms ?? linkedPO?.paymentTerms ?? linkedQuote?.terms ?? 'As per contract',
        };
      });
  }, [draftPOs, purchaseOrders, quotes, requests]);

  const filteredIssuedPORecords = useMemo(() => {
    return issuedPORecords.filter((record) => {
      if (issuedVendorFilter !== 'All Vendors' && record.vendor !== issuedVendorFilter) {
        return false;
      }

      if (issuedStatusFilter !== 'All' && record.status !== issuedStatusFilter) {
        return false;
      }

      if (!issuedSearch.trim()) {
        return true;
      }

      const query = issuedSearch.toLowerCase();

      return (
        record.poNumber.toLowerCase().includes(query) ||
        record.requestCode.toLowerCase().includes(query) ||
        record.vendor.toLowerCase().includes(query) ||
        record.lineItems.some((line) => line.item.toLowerCase().includes(query))
      );
    });
  }, [issuedPORecords, issuedSearch, issuedStatusFilter, issuedVendorFilter]);

  const openIssuedPODetail = (record: (typeof filteredIssuedPORecords)[number]) => {
    const backendPo = purchaseOrders.find(
      (p) => p.poNumber === record.poNumber || p.poNumber === record.poNumber.replace(/^PO/, 'DPO')
    );
    const backendPoId = backendPo ? String(backendPo.id).replace(/^PO-/, '') : null;
    setSelectedPO({
      id: record.poNumber,
      vendorId: record.vendor,
      vendorName: record.vendor,
      poNumber: record.poNumber,
      itemCount: record.lineItems.length,
      value: record.grandTotal,
      date: record.createdDate,
      status: record.status,
      etaDays: record.etaDays,
      items: record.lineItems.map((line) => line.item),
      requestCode: record.requestCode,
      requestId: record.request.id,
      contactPerson: 'Procurement Desk',
      backendPoId: backendPoId ?? undefined,
      timeline: [
        { stage: 'PO Released', done: true, timestamp: record.createdDate, actor: 'Procurement', note: 'PO shared with vendor' },
        { stage: 'Vendor Confirmed', done: false, timestamp: null, actor: null, note: null },
        { stage: 'Shipped', done: false, timestamp: null, actor: null, note: null },
        { stage: 'Delivered', done: false, timestamp: null, actor: null, note: null },
        { stage: 'Under GRN', done: false, timestamp: null, actor: null, note: null },
        { stage: 'GRN Complete', done: false, timestamp: null, actor: null, note: null },
      ],
    });
  };

  const markIssuedPOInTransit = (requestId: string, requestCode: string) => {
    updateRequestStatus(requestId, 'Delivery Pending');
    addToast('success', `${requestCode} moved to In Transit`);
  };

  const receiveIssuedPOGRN = async (requestId: string, requestCode: string) => {
    const record = issuedPORecords.find((r) => r.request.id === requestId && r.requestCode === requestCode);
    if (!record) {
      addToast('error', 'PO record not found');
      return;
    }
    let linkedPO = purchaseOrders.find(
      (p) =>
        p.status === 'Released' &&
        (String(p.formData?.requestId) === String(requestId) ||
          String(p.formData?.requestCode).toUpperCase() === String(requestCode).toUpperCase())
    );
    if (!linkedPO) {
      linkedPO = purchaseOrders.find(
        (p) =>
          p.status === 'Released' &&
          (p.poNumber === record.poNumber ||
            p.poNumber === record.poNumber.replace(/^PO/, 'DPO') ||
            (p as { orderId?: string }).orderId === record.poNumber ||
            (p as { orderId?: string }).orderId === record.poNumber.replace(/^PO/, 'DPO'))
      );
    }
    const backendPoId = linkedPO ? String(linkedPO.id).replace(/^PO-/, '') : null;
    if (!backendPoId) {
      addToast('error', 'Linked purchase order not found. Cannot mark delivered.');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const backendPr = backendPrResult?.find((p: { id: string }) => String(p.id) === requestId);
    const items = (backendPr as { items?: BackendPRItem[] } | undefined)?.items ?? ([] as BackendPRItem[]);

    const trackingRes = await updatePoTracking(backendPoId, {
      deliveredAt: today,
      deliveredNote: 'Marked delivered at WH from Procurement',
      underGrnAt: today,
      underGrnNote: 'GRN created from Procurement',
    });
    if (!trackingRes.success) {
      addToast('error', typeof trackingRes.error === 'string' ? trackingRes.error : (trackingRes.error?.message ?? 'Failed to update PO tracking'));
      return;
    }

    try {
      await createGRN({
        grnNo: `GRN-${record.poNumber}-${Date.now()}`,
        purchase_order_id: parseInt(backendPoId, 10),
        poNo: record.poNumber,
        vendor: record.vendor,
        type: record.request.type as 'RM' | 'PM',
        items: record.lineItems.length,
        poValue: record.grandTotal ?? 0,
        status: 'Under GRN',
        receivedDate: today,
        lineItems: record.lineItems.map((line, idx) => ({
          id: `line-${idx}`,
          item: String(line.item ?? ''),
          itemCode: line.itemCode ?? `EI-${record.request.type}-${String(idx + 1).padStart(3, '0')}`,
          poQty: Number(line.qty) || 0,
          rcvdQty: 0,
          invoiceQty: 0,
          unitPrice: Number(line.pricePerUnit) || 0,
          diff: 0,
          qcStatus: 'Pending',
          qcBy: '',
        })),
      });
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to create GRN in warehouse');
      return;
    }

    const statusRes = await updateProcurementRequestApi(requestId, { status: 'Under GRN' as RequestStatus, items });
    if (!statusRes.success) {
      addToast('error', typeof statusRes.error === 'string' ? statusRes.error : (statusRes.error?.message ?? 'Failed to update request status'));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
    queryClient.invalidateQueries({ queryKey: ['po-tracking', backendPoId] });
    queryClient.invalidateQueries({ queryKey: ['grn-list'] });
    updateProcurementState((current) => ({
      requests: current.requests.map((req) => (req.id === requestId ? { ...req, status: 'Under GRN' as RequestStatus } : req)),
    }));
    addToast('success', `${requestCode} marked delivered at WH. GRN created — see Warehouse > Inbound.`);
  };

  const updateQuoteStatus = (quoteId: string, status: QuoteStatus) => {
    updateProcurementState((current) => ({
      quotes: current.quotes.map((quote) => (quote.id === quoteId ? { ...quote, status } : quote)),
    }));
    addToast('success', `Quote ${quoteId} moved to ${status}`);
  };

  const createDraftPO = async (quoteId: string) => {
    const selectedQuote = quotes.find((quote) => quote.id === quoteId);
    if (!selectedQuote) {
      addToast('error', 'Quote not found');
      return;
    }

    const relatedRequest = requests.find(req => req.id === selectedQuote.requestId);
    if (!relatedRequest) {
      addToast('error', 'Related request not found');
      return;
    }

    // Generate new DPO ID
    const newDpoId = `DPO-${String(draftPOs.length + 1).padStart(3, '0')}`;
    
    // Create line items from quote lines
    const lineItems: DraftPOLineItem[] = selectedQuote.lines.map((line, idx) => {
      const qty = parseFloat(line.qty.replace(/[^\d.]/g, ''));
      const pricePerUnit = line.pricePerUnit;
      const gstPercent = 18; // Standard GST rate
      const subtotal = qty * pricePerUnit;
      const gstAmount = subtotal * (gstPercent / 100);
      const lineTotal = subtotal + gstAmount;

      return {
        item: line.item,
        itemCode: selectedQuote.requestType === 'RM' ? `EI-RM-${String(idx + 1).padStart(3, '0')}` : `EI-PM-${String(idx + 1).padStart(3, '0')}`,
        type: selectedQuote.requestType,
        qty: line.qty,
        pricePerUnit,
        gstPercent,
        gstAmount: parseFloat(gstAmount.toFixed(2)),
        lineTotal: parseFloat(lineTotal.toFixed(2)),
      };
    });

    // Calculate totals
    const subtotal = parseFloat(lineItems.reduce((sum, item) => sum + (item.lineTotal - item.gstAmount), 0).toFixed(2));
    const gstTotal = parseFloat(lineItems.reduce((sum, item) => sum + item.gstAmount, 0).toFixed(2));
    const grandTotal = parseFloat((subtotal + gstTotal).toFixed(2));

    const today = new Date();
    const expectedDelivery = new Date(today);
    expectedDelivery.setDate(expectedDelivery.getDate() + selectedQuote.leadTimeDays);
    const createdDateStr = today.toISOString().split('T')[0];
    const expectedDeliveryStr = expectedDelivery.toISOString().split('T')[0];

    const vendor = relatedRequest.preferredVendor?.trim() || selectedQuote.vendor;
    const newDraftPO: DraftPO = {
      id: newDpoId,
      dpoNumber: newDpoId,
      requestId: selectedQuote.requestId,
      requestCode: selectedQuote.requestCode,
      type: selectedQuote.requestType,
      vendor,
      vendorId: `VND-${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
      status: 'Pending Approval',
      createdDate: createdDateStr,
      createdBy: 'Procurement — Admin',
      paymentTerms: selectedQuote.terms,
      expectedDelivery: expectedDeliveryStr,
      deliveryAddress: 'EI Plant 1, IDA Jeedimetla, Hyderabad - 500 055',
      vendorRating: selectedQuote.rating,
      alertMessage: `Draft PO created from quote ${selectedQuote.id}. Awaiting approval to proceed.`,
      alertType: 'warning',
      lineItems,
      subtotal,
      gstTotal,
      grandTotal,
    };

    // Persist to PO table (backend) with request link for reload
    const poPayload = {
      orderId: newDraftPO.dpoNumber,
      vendorName: vendor,
      orderDate: createdDateStr,
      expectedShipmentDate: expectedDeliveryStr,
      reference: newDraftPO.requestCode,
      paymentTerms: newDraftPO.paymentTerms || undefined,
      status: 'Draft',
      formData: { requestId: selectedQuote.requestId, requestCode: selectedQuote.requestCode },
      items: newDraftPO.lineItems.map((l) => ({
        itemName: l.item,
        quantity: l.qty,
        rate: String(l.pricePerUnit),
        tax: String(l.gstPercent || 18),
      })),
    };
    const createResult = await createPurchaseOrder(poPayload);
    if (!createResult.success || !createResult.data) {
      addToast('error', typeof createResult.error === 'string' ? createResult.error : (createResult.error?.message ?? 'Failed to create purchase order'));
      return;
    }
    const backendId = String(createResult.data.id ?? '').replace(/^PO-/, '') || String(createResult.data.id);
    const draftWithBackend: DraftPO = { ...newDraftPO, backendPoId: backendId };

    await updateRequestStatus(selectedQuote.requestId, 'PO Draft', { skipItems: true });

    updateProcurementState((current) => ({
      draftPOs: [draftWithBackend, ...current.draftPOs],
    }));

    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    addToast('success', `Draft PO ${newDpoId} created for ${selectedQuote.requestCode}`);
    
    setTimeout(() => {
      applyRouteState('Procurement', 'Draft POs');
    }, 500);
  };

  /** Create a draft PO from request data only (no quote). Used after Edit Request save. */
  const createDraftPOFromRequest = async (
    requestId: string,
    requestCode: string,
    items: BackendPRItem[],
    preferredVendor: string,
    requestType: RequestType
  ): Promise<boolean> => {
    if (!items.length) {
      addToast('warning', 'Add at least one line item to the request to create a draft PO.');
      return false;
    }
    const newDpoId = `DPO-${String(draftPOs.length + 1).padStart(3, '0')}`;
    const lineItems: DraftPOLineItem[] = items.map((it, idx) => {
      const qty = Number(it.quantity_requested) || 0;
      const pricePerUnit = 0;
      const gstPercent = 18;
      const subtotal = qty * pricePerUnit;
      const gstAmount = subtotal * (gstPercent / 100);
      const lineTotal = subtotal + gstAmount;
      return {
        item: it.name ?? it.code ?? 'Item',
        itemCode: requestType === 'PM' ? `EI-PM-${String(idx + 1).padStart(3, '0')}` : `EI-RM-${String(idx + 1).padStart(3, '0')}`,
        type: requestType,
        qty: String(it.quantity_requested ?? 0),
        pricePerUnit,
        gstPercent,
        gstAmount: parseFloat(gstAmount.toFixed(2)),
        lineTotal: parseFloat(lineTotal.toFixed(2)),
      };
    });
    const subtotal = parseFloat(lineItems.reduce((s, l) => s + (l.lineTotal - l.gstAmount), 0).toFixed(2));
    const gstTotal = parseFloat(lineItems.reduce((s, l) => s + l.gstAmount, 0).toFixed(2));
    const grandTotal = parseFloat((subtotal + gstTotal).toFixed(2));
    const today = new Date();
    const createdDateStr = today.toISOString().split('T')[0];
    const expectedDeliveryStr = createdDateStr;
    const vendor = preferredVendor?.trim() || 'Unassigned';
    const poPayload = {
      orderId: newDpoId,
      vendorName: vendor,
      orderDate: createdDateStr,
      expectedShipmentDate: expectedDeliveryStr,
      reference: requestCode,
      paymentTerms: 'As per contract',
      status: 'Draft',
      formData: { requestId, requestCode },
      items: lineItems.map((l) => ({
        itemName: l.item,
        quantity: l.qty,
        rate: String(l.pricePerUnit),
        tax: String(l.gstPercent || 18),
      })),
    };
    const createResult = await createPurchaseOrder(poPayload);
    if (!createResult.success || !createResult.data) {
      addToast('error', typeof createResult.error === 'string' ? createResult.error : (createResult.error?.message ?? 'Failed to create draft PO'));
      return false;
    }
    const backendId = String(createResult.data.id ?? '').replace(/^PO-/, '') || String(createResult.data.id);
    const newDraftPO: DraftPO = {
      id: newDpoId,
      dpoNumber: newDpoId,
      requestId,
      requestCode,
      type: requestType,
      vendor,
      vendorId: `VND-${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
      status: 'Pending Approval',
      createdDate: createdDateStr,
      createdBy: 'Procurement — Admin',
      paymentTerms: 'As per contract',
      expectedDelivery: expectedDeliveryStr,
      deliveryAddress: 'EI Plant 1, IDA Jeedimetla, Hyderabad - 500 055',
      vendorRating: 0,
      alertMessage: 'Draft PO created from request. Add rates in Edit if needed.',
      alertType: 'warning',
      lineItems,
      subtotal,
      gstTotal,
      grandTotal,
      backendPoId: backendId,
    };
    updateProcurementState((current) => ({
      draftPOs: [newDraftPO, ...current.draftPOs],
    }));
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    await updateProcurementRequestApi(requestId, { status: 'PO Draft' });
    queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
    updateProcurementState((current) => ({
      requests: current.requests.map((r) => (r.id === requestId ? { ...r, status: 'PO Draft' as RequestStatus } : r)),
    }));
    addToast('success', `Draft PO ${newDpoId} created for ${requestCode}`);
    return true;
  };

  const approveDraftPO = (draftPoId: string) => {
    const target = draftPOs.find((draftPo) => draftPo.id === draftPoId);

    if (!target) {
      addToast('warning', 'Draft PO not found');
      return;
    }

    if (target.status === 'Approved') {
      addToast('info', `${target.dpoNumber} is already approved`);
      return;
    }

    updateProcurementState((current) => ({
      draftPOs: current.draftPOs.map((draftPo) =>
        draftPo.id === draftPoId
          ? {
              ...draftPo,
              status: 'Approved',
              alertType: 'ok',
              alertMessage: `Approved on ${new Date('2026-02-28').toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' })}. Ready for release.`,
            }
          : draftPo,
      ),
    }));

    if (selectedDraftPO?.id === draftPoId) {
      setSelectedDraftPO((prev) =>
        prev
          ? {
              ...prev,
              status: 'Approved',
              alertType: 'ok',
              alertMessage: `Approved on ${new Date('2026-02-28').toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' })}. Ready for release.`,
            }
          : prev,
      );
    }

    addToast('success', `${target.dpoNumber} approved`);
  };

  const releaseDraftPOToVendor = async (draftPoId: string) => {
    const target = draftPOs.find((draftPo) => draftPo.id === draftPoId);

    if (!target) {
      addToast('warning', 'Draft PO not found');
      return;
    }

    if (target.status !== 'Approved') {
      addToast('warning', `${target.dpoNumber} must be approved before release`);
      return;
    }

    await updateRequestStatus(target.requestId, 'PO Released');
    applyRouteState('Procurement', 'Issued POs');
  };

  const openReleasePOModal = (draftPoId: string) => {
    const target = draftPOs.find((draftPo) => draftPo.id === draftPoId);

    if (!target) {
      addToast('warning', 'Draft PO not found');
      return;
    }

    if (target.status !== 'Approved') {
      addToast('warning', `${target.dpoNumber} must be approved before release`);
      return;
    }

    setReleasePOTarget(target);
    setReleaseMethod('Email + Portal');
    setReleaseNotes('');
  };

  const closeReleasePOModal = () => {
    setReleasePOTarget(null);
    setReleaseMethod('Email + Portal');
    setReleaseNotes('');
  };

  const submitReleasePO = async () => {
    if (!releasePOTarget) {
      return;
    }

    const draft = releasePOTarget;

    // Update PO table: set status to Released and ensure request link is stored
    if (draft.backendPoId) {
      const updateResult = await updatePurchaseOrder(draft.backendPoId, {
        status: 'Released',
        formData: { requestId: draft.requestId, requestCode: draft.requestCode },
      });
      if (!updateResult.success) {
        const err = updateResult.error;
        addToast('error', typeof err === 'string' ? err : (err?.message ?? 'Failed to update purchase order'));
        return;
      }
    }

    // If payment terms are set, route to Treasury for advance approval
    if (draft.paymentTerms?.trim()) {
      globalDispatch({
        type: 'ADD_PO',
        payload: {
          stage: 'treasury',
          po: {
            id: draft.dpoNumber,
            vendor: draft.vendor,
            paymentTerms: draft.paymentTerms,
            grandTotal: draft.grandTotal,
            lines: draft.lineItems.map((l) => ({
              itemId: l.itemCode,
              itemName: l.item,
              qty: parseFloat(l.qty) || 0,
              unit: l.pricePerUnit,
              uom: 'PCS',
            })),
          },
        },
      });
    }

    await releaseDraftPOToVendor(draft.id);
    updateProcurementState((current) => ({
      draftPOs: current.draftPOs.filter((d) => d.id !== draft.id),
    }));

    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    if (draft.paymentTerms?.trim()) {
      addToast('success', `${draft.dpoNumber} released; sent to Treasury for advance.`);
    } else {
      addToast('success', `${draft.dpoNumber} released to vendor.`);
    }

    if (selectedDraftPO?.id === draft.id) {
      setSelectedDraftPO(null);
    }

    closeReleasePOModal();
  };

  const splitDraftPO = (draftPoId: string) => {
    const target = draftPOs.find((draftPo) => draftPo.id === draftPoId);

    if (!target) {
      addToast('warning', 'Draft PO not found');
      return;
    }

    if (target.status !== 'Approved') {
      addToast('warning', `${target.dpoNumber} must be approved before split`);
      return;
    }

    if (target.lineItems.length < 2) {
      addToast('warning', 'Need at least 2 items to split this PO');
      return;
    }

    setSplitPOTarget(target);
    setSplitSelectedLineIndexes([0]);
  };

  const toggleSplitLineSelection = (lineIndex: number) => {
    setSplitSelectedLineIndexes((prev) =>
      prev.includes(lineIndex) ? prev.filter((index) => index !== lineIndex) : [...prev, lineIndex],
    );
  };

  const closeSplitPOModal = () => {
    setSplitPOTarget(null);
    setSplitSelectedLineIndexes([]);
  };

  const createSplitDraftPO = (baseDraftPo: DraftPO, lineItems: DraftPOLineItem[], suffix: string): DraftPO => {
    const subtotal = parseFloat(lineItems.reduce((sum, item) => sum + (item.lineTotal - item.gstAmount), 0).toFixed(2));
    const gstTotal = parseFloat(lineItems.reduce((sum, item) => sum + item.gstAmount, 0).toFixed(2));
    const grandTotal = parseFloat((subtotal + gstTotal).toFixed(2));

    return {
      ...baseDraftPo,
      id: `${baseDraftPo.id}-${suffix}`,
      dpoNumber: `${baseDraftPo.dpoNumber}-${suffix}`,
      alertType: 'ok',
      alertMessage: `Split from ${baseDraftPo.dpoNumber}. Ready for release.`,
      lineItems,
      subtotal,
      gstTotal,
      grandTotal,
    };
  };

  const submitSplitPO = () => {
    if (!splitPOTarget) {
      return;
    }

    const uniqueIndexes = Array.from(new Set(splitSelectedLineIndexes)).sort((a, b) => a - b);

    if (uniqueIndexes.length === 0) {
      addToast('warning', 'Select at least one item for Split PO 1');
      return;
    }

    if (uniqueIndexes.length === splitPOTarget.lineItems.length) {
      addToast('warning', 'Leave at least one item unchecked to create the second PO');
      return;
    }

    const selectedLineItems = splitPOTarget.lineItems.filter((_, index) => uniqueIndexes.includes(index));
    const remainingLineItems = splitPOTarget.lineItems.filter((_, index) => !uniqueIndexes.includes(index));

    const splitPOOne = createSplitDraftPO(splitPOTarget, selectedLineItems, 'S1');
    const splitPOTwo = createSplitDraftPO(splitPOTarget, remainingLineItems, 'S2');

    updateProcurementState((current) => ({
      draftPOs: [
        splitPOOne,
        splitPOTwo,
        ...current.draftPOs.filter((draftPo) => draftPo.id !== splitPOTarget.id),
      ],
    }));

    if (selectedDraftPO?.id === splitPOTarget.id) {
      setSelectedDraftPO(null);
    }

    addToast('success', `Split complete: ${splitPOOne.dpoNumber} and ${splitPOTwo.dpoNumber} created`);
    closeSplitPOModal();
  };

  const addNewQuote = () => {
    const targetRequest = requests.find((request) => request.status === 'New') || requests[0];

    if (!targetRequest) {
      addToast('warning', 'No request available to attach a new quote');
      return;
    }

    const newId = `QT-${String(quotes.length + 1).padStart(3, '0')}`;

    const newQuote: VendorQuote = {
      id: newId,
      requestId: targetRequest.id,
      requestCode: targetRequest.code,
      requestType: targetRequest.type,
      vendor: vendors[0]?.name ?? 'Unassigned',
      status: 'Pending Review',
      quotedOn: '2026-02-27',
      leadTimeDays: 19,
      terms: '45% Advance, 55% on Dispatch',
      validTill: '2026-03-22',
      rating: 4.0,
      fileName: `${newId}-new-horizon-quote.pdf`,
      note: 'Auto-generated sample quote for quick review and comparison.',
      lines: targetRequest.items.map((item, index) => ({
        item,
        qty: targetRequest.type === 'RM' ? `${40 + index * 10} KG` : `${20000 + index * 5000} PCS`,
        pricePerUnit: targetRequest.type === 'RM' ? 640 + index * 25 : 1.95 + index * 0.2,
        totalValue:
          targetRequest.type === 'RM'
            ? (40 + index * 10) * (640 + index * 25)
            : Math.round((20000 + index * 5000) * (1.95 + index * 0.2)),
        vsPlanned: index % 2 === 0 ? '-2.1%' : '+1.2%',
      })),
    };

    updateProcurementState((current) => ({
      quotes: [newQuote, ...current.quotes],
    }));
    applyRouteState('Procurement', 'Quotations');
    addToast('success', `${newId} recorded successfully`);
  };

  const openNewRequestModal = () => {
    setShowNewRequestModal(true);
  };

  const closeNewRequestModal = () => {
    setShowNewRequestModal(false);
    // Reset form
    setNewRequestForm({
      category: '',
      type: 'RM',
      source: 'Planning Team',
      priority: 'High',
      requestDate: '27-02-2026',
      requiredDate: '',
      itemName: '',
      reqQty: '',
      uom: '',
      moq: '',
      plannedPrice: '',
      packSize: '',
      leadTimeDays: '',
      preferredVendor: '',
      notes: '',
      requireStockCheck: 'No'
    });
  };

  const submitNewRequest = () => {
    if (!newRequestForm.itemName.trim()) {
      addToast('error', 'Item name is required');
      return;
    }
    if (!newRequestForm.requiredDate) {
      addToast('error', 'Required date is required');
      return;
    }

    const newCode = `REQ-${String(requests.length + 101).padStart(3, '0')}`;
    
    const newRequest: ProcurementRequest = {
      id: `req-${Date.now()}`,
      code: newCode,
      type: newRequestForm.type,
      items: [newRequestForm.itemName],
      status: 'New',
      priority: newRequestForm.priority,
      dueDate: newRequestForm.requiredDate.split('-').reverse().join('-'),
    };

    updateProcurementState((current) => ({
      requests: [newRequest, ...current.requests],
    }));
    addToast('success', `${newCode} created successfully`);
    closeNewRequestModal();
  };

  const deleteQuote = (quoteId: string) => {
    updateProcurementState((current) => ({
      quotes: current.quotes.filter((quote) => quote.id !== quoteId),
    }));
    addToast('info', `Quote ${quoteId} removed`);
  };

  const updateRequestStatus = async (requestId: string, status: RequestStatus, opts?: { skipItems?: boolean }) => {
    const payload = opts?.skipItems
      ? { status }
      : { status, items: (backendPrResult?.find((p: { id: string }) => String(p.id) === requestId) as { items?: BackendPRItem[] } | undefined)?.items ?? ([] as BackendPRItem[]) };
    const res = await updateProcurementRequestApi(requestId, payload);
    if (!res.success) {
      addToast('error', typeof res.error === 'string' ? res.error : (res.error?.message ?? 'Failed to update request status'));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
    updateProcurementState((current) => ({
      requests: current.requests.map((req) => (req.id === requestId ? { ...req, status } : req)),
    }));
    addToast('success', `Request status updated to ${status}`);
  };

  const updateRequestPriority = (requestId: string, priority: 'High' | 'Medium' | 'Low') => {
    updateProcurementState((current) => ({
      requests: current.requests.map((req) => (req.id === requestId ? { ...req, priority } : req)),
    }));
    addToast('success', `Priority updated to ${priority}`);
  };

  const liveSyncTime = new Date(lastUpdatedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-yellow-50 text-slate-900">
      <div className="border-b border-blue-200 bg-linear-to-r from-white via-blue-50/70 to-white">
        <div className="px-5 md:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={logoFull} alt="Esthetic Insights" className="h-8 object-contain" />
            <p className="text-xs text-slate-500">Operations Hub</p>
            <div className="hidden md:flex items-center gap-2 ml-4">
              {(['Procurement', 'Vendors', 'Reports'] as MainTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => applyRouteState(tab, sideSection)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    mainTab === tab
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                      : 'bg-white text-slate-600 border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full border border-rose-300 bg-rose-50 text-rose-700">{quoteStats.urgent} Urgent</span>
            <span className="px-2 py-1 rounded-full border border-yellow-300 bg-yellow-50 text-yellow-700">{quoteStats.pendingAction} Pending Action</span>
            <span className="hidden sm:inline px-2 py-1 rounded-full border border-cyan-300 bg-cyan-50 text-cyan-700">Esthetic Insights CDMO</span>
            <span className="hidden md:inline px-2 py-1 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700">Live · {liveSyncTime}</span>
          </div>
        </div>
      </div>

      {mainTab !== 'Procurement' ? (
        <div className="px-5 md:px-8 py-8 space-y-4">
          {mainTab === 'Vendors' && (
            <ProcurementVendors
              vendors={vendors}
              purchaseOrders={purchaseOrders}
              selectedVendor={selectedVendor}
              setSelectedVendor={setSelectedVendor}
              applyRouteState={applyRouteState}
              sideSection={sideSection}
            />
          )}

          {mainTab === 'Reports' && (
            <ProcurementReports
              requests={requests}
              quotes={quotes}
              quoteStats={quoteStats}
              applyRouteState={applyRouteState}
              sideSection={sideSection}
              requestTypeClass={requestTypeClass}
              priorityClass={priorityClass}
              statusBg={statusBg}
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr]">
          <aside className="border-r border-blue-200 bg-blue-50/50 px-4 py-4">
            <p className="text-[11px] tracking-[0.2em] text-slate-400 mb-3">PROCUREMENT</p>
            <div className="space-y-1 mb-6">
              {(['Overview', 'Requests', 'Quotations', 'Draft POs', 'Issued POs'] as SideSection[]).map((section) => (
                <button
                  key={section}
                  onClick={() => applyRouteState('Procurement', section)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                    sideSection === section
                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{section}</span>
                  <span className="text-xs text-slate-500">{sideCounts[section]}</span>
                </button>
              ))}
            </div>

            <p className="text-[11px] tracking-[0.2em] text-slate-400 mb-3">OPERATIONS</p>
            <div className="space-y-1">
              {(['GRN Monitor', 'Stock Check', 'Item Tracker'] as SideSection[]).map((section) => (
                <button
                  key={section}
                  onClick={() => {
                    applyRouteState('Procurement', section);
                    addToast('info', `${section} synced with procurement data`);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                    sideSection === section
                      ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{section}</span>
                  <span className="text-xs text-cyan-700">{sideCounts[section]}</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="px-5 md:px-7 py-5 space-y-4">
            {sideSection !== 'Overview' && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'TOTAL QUOTES', value: quoteStats.totalQuotes, color: 'text-yellow-700' },
                { label: 'CONFIRMED', value: quoteStats.confirmed, color: 'text-emerald-600' },
                { label: 'NOT SELECTED', value: quoteStats.notSelected, color: 'text-slate-600' },
                { label: 'PENDING REVIEW', value: quoteStats.pendingReview, color: 'text-cyan-600' },
                { label: 'QUOTES VALUE', value: `₹${quoteStats.quotesValue.toLocaleString('en-IN')}`, color: 'text-cyan-700' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[10px] tracking-[0.14em] text-slate-500">{stat.label}</p>
                  <p className={`mt-2 text-3xl font-bold font-archivo ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
            )}

            {sideSection === 'Quotations' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">CATEGORY:</span>
                {(['All', 'RM', 'PM'] as Array<'All' | RequestType>).map((category) => (
                  <button
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    className={`px-2 py-1 rounded border ${
                      categoryFilter === category
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {category}
                  </button>
                ))}

                <span className="text-slate-500 ml-2">VENDOR:</span>
                <select
                  value={vendorFilter}
                  onChange={(event) => setVendorFilter(event.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700"
                >
                  <option value="All Vendors">All Vendors</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.name}>
                      {vendor.name}
                    </option>
                  ))}
                </select>

                <span className="text-slate-500 ml-2">STATUS:</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'All Statuses' | QuoteStatus)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700"
                >
                  <option value="All Statuses">All Statuses</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Not Selected">Not Selected</option>
                  <option value="Pending Review">Pending Review</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search vendor, request ID..."
                  className="w-60 max-w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-700"
                />
                <button
                  onClick={addNewQuote}
                  className="px-4 py-2 rounded-lg bg-yellow-400 text-slate-900 font-semibold text-sm"
                >
                  + Record Quote
                </button>
              </div>
            </div>
            )}

            <div className="space-y-4">
              {sideSection === 'Overview' && (() => {
                const TODAY = new Date();
                const daysUntil = (dateStr: string) => Math.ceil((new Date(dateStr).getTime() - TODAY.getTime()) / 86400000);
                const activeRequests = requests.filter(r => r.status !== 'PO Released');
                const rmRequests = requests.filter(r => r.type === 'RM');
                const pmRequests = requests.filter(r => r.type === 'PM');
                const activePOValue = purchaseOrders.filter(p => p.status !== 'Delivered').reduce((s, p) => s + (p.value ?? 0), 0);
                const poStatusColor: Record<string, string> = {
                  Shipped: 'bg-blue-100 text-blue-700',
                  'Advance Paid': 'bg-orange-100 text-orange-700',
                  Delivered: 'bg-emerald-100 text-emerald-700',
                  '80% Complete': 'bg-yellow-100 text-yellow-700',
                };
                if (isProcurementDataLoading) {
                  return (
                    <div className="flex items-center justify-center py-16 text-slate-500">
                      <span className="animate-pulse">Loading procurement data…</span>
                    </div>
                  );
                }
                return (
                  <>
                    {/* KPI strip */}
                    <div className="flex flex-wrap gap-3">
                      {[
                        { label: 'NEW REQUESTS', value: requests.filter(r => r.status === 'New').length, sub: 'Awaiting action', color: 'text-yellow-600' },
                        { label: 'RM — RAW MATERIALS', value: rmRequests.length, sub: `${rmRequests.flatMap(r => r.items).length} items · pending action`, color: 'text-cyan-600', badge: 'RM' },
                        { label: 'PM — PACKAGING MATERIALS', value: pmRequests.length, sub: `${pmRequests.flatMap(r => r.items).length} items · pending action`, color: 'text-violet-600', badge: 'PM' },
                        { label: 'ACTIVE POS', value: requests.filter(r => r.status === 'PO Draft' || r.status === 'PO Released').length, sub: 'In pipeline', color: 'text-emerald-600' },
                        { label: 'DELIVERY PENDING GRN', value: requests.filter(r => r.status === 'Delivery Pending').length, sub: null, color: 'text-rose-600' },
                        { label: 'STOCK CHECKS ACTIVE', value: requests.filter(r => r.priority !== 'Low').length, sub: null, color: 'text-yellow-600' },
                        { label: 'PO VALUE (ACTIVE)', value: `₹${activePOValue.toLocaleString('en-IN')}`, sub: null, color: 'text-cyan-600' },
                      ].map(kpi => (
                        <div key={kpi.label} className="flex-1 min-w-32 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-sm">
                          <div className="flex items-center gap-2 mb-1">
                            {kpi.badge && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${kpi.badge === 'RM' ? 'bg-cyan-100 text-cyan-700' : 'bg-violet-100 text-violet-700'}`}>{kpi.badge}</span>
                            )}
                            <p className="text-[10px] tracking-[0.12em] text-slate-500 uppercase">{kpi.label}</p>
                          </div>
                          <p className={`text-3xl font-bold font-archivo ${kpi.color} leading-none`}>{kpi.value}</p>
                          {kpi.sub && <p className="text-[10px] text-slate-500 mt-1">{kpi.sub}</p>}
                        </div>
                      ))}
                    </div>

                    {/* Actions Required + PO Pipeline */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
                      <div className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-blue-200 bg-linear-to-r from-yellow-50 to-white">
                          <h3 className="font-bold text-slate-900">Actions Required</h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {activeRequests.map(req => {
                            const days = daysUntil(req.dueDate);
                            const urgency = days <= 3 ? 100 : days <= 10 ? 80 : days <= 20 ? 55 : 30;
                            return (
                              <div
                                key={req.id}
                                className="px-5 py-4 cursor-pointer hover:bg-yellow-50/60 transition-colors"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedRequest(req);
                                }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{req.code}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${requestTypeClass[req.type]}`}>{req.type}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${priorityClass[req.priority]}`}>{req.priority}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${statusBg[req.status]}`}>{req.status}</span>
                                    <span className="text-xs text-slate-500 font-mono">{days}d</span>
                                  </div>
                                </div>
                                <p className="text-sm font-bold text-slate-900 mb-0.5">
                                  {req.type === 'RM' ? 'Raw Material' : 'Packaging Material'} — {req.items.length} item(s)
                                </p>
                                <p className="text-xs text-slate-500 mb-2">{req.items.join(', ')}</p>
                                <div className="w-full bg-slate-100 rounded-full h-1">
                                  <div className="h-1 rounded-full bg-yellow-400" style={{ width: `${urgency}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-xl border border-orange-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-orange-200 bg-linear-to-r from-orange-50 to-white">
                          <h3 className="font-bold text-slate-900">PO Pipeline</h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {purchaseOrders.map(po => (
                            <div
                              key={po.id}
                              className="px-5 py-4 cursor-pointer hover:bg-orange-50/60 transition-colors"
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedPO(po);
                              }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{po.poNumber}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${poStatusColor[po.status] ?? 'bg-slate-100 text-slate-600'}`}>{po.status}</span>
                              </div>
                              <p className="text-sm font-bold text-slate-900 mb-0.5">{po.vendorName}</p>
                              <p className="text-xs text-slate-500 mb-1">{po.itemCount} items · ₹{po.value.toLocaleString('en-IN')}</p>
                              <p className="text-xs text-slate-400">{po.etaDays} days ETA</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* RM + PM Summary Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-cyan-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-cyan-200 bg-cyan-50 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-200 text-cyan-800">RM</span>
                          <h3 className="font-bold text-slate-900">Raw Material — Request Summary</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-[10px] tracking-[0.12em] text-slate-500 border-b border-slate-200 bg-slate-50">
                                <th className="px-4 py-2">REQUEST</th>
                                <th className="px-4 py-2">ITEMS</th>
                                <th className="px-4 py-2">REQUIRED</th>
                                <th className="px-4 py-2">STATUS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rmRequests.map(req => (
                                <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                                  <td className="px-4 py-2">
                                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{req.code}</span>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-slate-600">{req.items.join(', ')}</td>
                                  <td className="px-4 py-2 text-xs text-slate-500">{req.dueDate}</td>
                                  <td className="px-4 py-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${statusBg[req.status]}`}>{req.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border border-violet-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-violet-200 bg-violet-50 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-200 text-violet-800">PM</span>
                          <h3 className="font-bold text-slate-900">Packaging Material — Request Summary</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-[10px] tracking-[0.12em] text-slate-500 border-b border-slate-200 bg-slate-50">
                                <th className="px-4 py-2">REQUEST</th>
                                <th className="px-4 py-2">ITEMS</th>
                                <th className="px-4 py-2">REQUIRED</th>
                                <th className="px-4 py-2">STATUS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pmRequests.map(req => (
                                <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                                  <td className="px-4 py-2">
                                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{req.code}</span>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-slate-600">{req.items.join(', ')}</td>
                                  <td className="px-4 py-2 text-xs text-slate-500">{req.dueDate}</td>
                                  <td className="px-4 py-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${statusBg[req.status]}`}>{req.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {sideSection === 'Requests' && (
                <div className="space-y-4">
                  {/* Requests from Planning (backend) — PRs raised from Planning page */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                      <h3 className="text-base font-bold text-slate-900">Requests from Planning (backend)</h3>
                      <p className="text-xs text-slate-500 mt-0.5">PRs raised via Planning &gt; Raise Procurement Request. Data from API.</p>
                    </div>
                    <div className="p-4 overflow-x-auto">
                      {isProcurementDataLoading ? (
                        <p className="text-sm text-slate-500 py-4">Loading procurement data…</p>
                      ) : backendPrs.length === 0 ? (
                        <p className="text-sm text-slate-500 py-4">No procurement requests from Planning yet. Raise a PR from Planning &gt; PRs Extracted to see them here.</p>
                      ) : (
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-left">
                              <th className="py-2 pr-4 font-semibold text-slate-700">ID</th>
                              <th className="py-2 pr-4 font-semibold text-slate-700">Planning line</th>
                              <th className="py-2 pr-4 font-semibold text-slate-700">Priority</th>
                              <th className="py-2 pr-4 font-semibold text-slate-700">Status</th>
                              <th className="py-2 pr-4 font-semibold text-slate-700">Required by</th>
                              <th className="py-2 pr-4 font-semibold text-slate-700">Items</th>
                              <th className="py-2 pr-4 font-semibold text-slate-700">Requested by</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backendPrs.map((pr) => (
                              <tr key={pr.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-2 pr-4 text-slate-900 font-medium">{pr.id}</td>
                                <td className="py-2 pr-4 text-slate-600">PI #{pr.planningExtractedId}</td>
                                <td className="py-2 pr-4">{pr.priority}</td>
                                <td className="py-2 pr-4">{pr.status}</td>
                                <td className="py-2 pr-4 text-slate-600">{pr.requiredByDate ?? '—'}</td>
                                <td className="py-2 pr-4 text-slate-600">{(pr.items?.length ?? 0)} line(s)</td>
                                <td className="py-2 pr-4 text-slate-500 text-xs">{pr.requestedBy ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Stats KPI Bar */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                          <span className="text-orange-600 text-lg font-bold">TR</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Requests</p>
                      <p className="text-2xl font-bold text-slate-900">{requests.length}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-cyan-200 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                          <span className="text-cyan-600 text-lg font-bold">RM</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">RM Requests</p>
                      <p className="text-2xl font-bold text-cyan-600">{requests.filter(r => r.type === 'RM').length}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-violet-200 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                          <span className="text-violet-600 text-lg font-bold">PM</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">PM Requests</p>
                      <p className="text-2xl font-bold text-violet-600">{requests.filter(r => r.type === 'PM').length}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                          <span className="text-red-600 text-lg font-bold">!</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">New / Unactioned</p>
                      <p className="text-2xl font-bold text-red-600">{requests.filter(r => r.status === 'New').length}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-yellow-200 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                          <span className="text-yellow-600 text-lg font-bold">PO</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Draft PO Stage</p>
                      <p className="text-2xl font-bold text-yellow-600">{requests.filter(r => r.status === 'PO Draft').length}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <span className="text-emerald-600 text-lg font-bold">OK</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">PO Released</p>
                      <p className="text-2xl font-bold text-emerald-600">{requests.filter(r => r.status === 'PO Released').length}</p>
                    </div>
                  </div>

                  {/* Header with Tabs and Actions */}
                  <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900 mb-1">Procurement Requests</h2>
                          <p className="text-xs text-slate-500">Manage and track all procurement requests</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search from name, request #"
                            className="w-64 px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <button
                            onClick={openNewRequestModal}
                            className="px-4 py-2 rounded-lg bg-amber-400 text-slate-900 font-bold text-sm hover:bg-amber-500 shadow-md transition-all"
                          >
                            + New Request
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-2 overflow-x-auto">
                        {(['All', 'Active', 'New', 'Quoted', 'PO Draft', 'PO Released'] as const).map((tabStatus) => {
                          const count = tabStatus === 'All' 
                            ? requests.length
                            : tabStatus === 'Active'
                            ? requests.filter(r => r.status !== 'PO Released').length
                            : requests.filter(r => r.status === tabStatus).length;
                          
                          const isActive = requestStatusFilter === (tabStatus === 'All' ? 'All Statuses' : tabStatus === 'Active' ? 'All Statuses' : tabStatus);
                          
                          return (
                            <button
                              key={tabStatus}
                              onClick={() => {
                                if (tabStatus === 'All' || tabStatus === 'Active') {
                                  setRequestStatusFilter('All Statuses');
                                } else {
                                  setRequestStatusFilter(tabStatus as RequestStatus);
                                }
                              }}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                                isActive
                                  ? 'bg-blue-500 text-white shadow-md'
                                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              {tabStatus} ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Request Cards */}
                    <div className="p-5 space-y-4 bg-slate-50">
                      {(() => {
                        const filteredRequests = requests.filter(req => {
                          // Apply filters
                          if (categoryFilter !== 'All' && req.type !== categoryFilter) return false;
                          if (requestStatusFilter !== 'All Statuses' && req.status !== requestStatusFilter) return false;
                          if (searchQuery.trim()) {
                            const query = searchQuery.toLowerCase();
                            const matchesCode = req.code.toLowerCase().includes(query);
                            const matchesItems = req.items.some(item => item.toLowerCase().includes(query));
                            if (!matchesCode && !matchesItems) return false;
                          }
                          return true;
                        });

                        if (filteredRequests.length === 0) {
                          return (
                            <div className="text-center py-12">
                              <p className="text-slate-500 text-sm">No requests match the current filters.</p>
                            </div>
                          );
                        }

                        return filteredRequests.map((req) => {
                          const dueDate = new Date(req.dueDate);
                          const today = new Date('2026-02-28');
                          const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                          
                          return (
                            <div key={req.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                              {/* Card Header */}
                              <div className="px-5 py-3 bg-linear-to-r from-blue-50 via-cyan-50 to-blue-50 border-b border-slate-200">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-md bg-slate-700 text-white text-xs font-mono font-bold">
                                      {req.code}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                      req.type === 'RM' 
                                        ? 'bg-cyan-100 text-cyan-800 border border-cyan-300' 
                                        : 'bg-violet-100 text-violet-800 border border-violet-300'
                                    }`}>
                                      {req.type}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${priorityClass[req.priority]}`}>
                                      {req.priority}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${statusClass[req.status]}`}>
                                      {req.status}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-slate-600">
                                    <span>Req. {req.dueDate.split('-').reverse().join('-')}</span>
                                    <span className={`font-bold ${
                                      daysLeft <= 3 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-emerald-600'
                                    }`}>
                                      {daysLeft}d left
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Card Body - Item Details Grid */}
                              <div className="p-5">
                                {req.items.map((item, itemIdx) => (
                                  <div key={itemIdx} className="mb-4 last:mb-0">
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex-1">
                                        <h4 className="font-bold text-slate-900 text-sm mb-1">{item}</h4>
                                        <p className="text-xs text-slate-500 font-mono">{req.type === 'RM' ? 'RI-RM-001-001' : 'PI-PM-002-001'}</p>
                                      </div>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                                      <div>
                                        <p className="text-slate-500 uppercase tracking-wide mb-1">Req Qty</p>
                                        <p className="font-semibold text-slate-900">{req.type === 'RM' ? '100 KG' : '25,000 pcs'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 uppercase tracking-wide mb-1">MOQ</p>
                                        <p className="font-semibold text-slate-900">{req.type === 'RM' ? '25 KG' : '10,000 pcs'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 uppercase tracking-wide mb-1">Pack Size</p>
                                        <p className="font-semibold text-slate-900">{req.type === 'RM' ? '25 kg drum' : '1000 pcs/box'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 uppercase tracking-wide mb-1">Planned ₹/unit</p>
                                        <p className="font-semibold text-emerald-600">₹{req.type === 'RM' ? '520' : '1.40'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 uppercase tracking-wide mb-1">Est. Value</p>
                                        <p className="font-semibold text-amber-600">₹{req.type === 'RM' ? '52,000' : '35,000'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 uppercase tracking-wide mb-1">GRI</p>
                                        <p className="font-semibold text-slate-900">{itemIdx === 0 ? '140' : '155'}</p>
                                      </div>
                                    </div>

                                    {/* Additional Info Row */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-3">
                                      <div>
                                        <p className="text-slate-500 uppercase tracking-wide mb-1">Open PO</p>
                                        <p className="font-semibold text-blue-600">{req.status === 'PO Released' ? '1' : '0'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 uppercase tracking-wide mb-1">In-Transit</p>
                                        <p className="font-semibold text-cyan-600">0</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 uppercase tracking-wide mb-1">Lead (D)</p>
                                        <p className="font-semibold text-slate-900">{itemIdx === 0 ? '21d' : '14d'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 uppercase tracking-wide mb-1">Pref. Vendor</p>
                                        <p className="font-semibold text-indigo-600 truncate">Chemspec India Pvt Ltd</p>
                                      </div>
                                    </div>

                                    {/* Divider between items */}
                                    {itemIdx < req.items.length - 1 && (
                                      <div className="border-t border-slate-200 mt-4"></div>
                                    )}
                                  </div>
                                ))}

                                {/* Notes Section */}
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                  <p className="text-xs text-slate-600">
                                    <span className="font-semibold text-slate-700">Notes:</span> {req.priority === 'High' ? 'Currently replenishment target for RM. Batch 1M2 production run from Feb 28.' : 'Q2 faceroll production. Need 100% tubes by batch date. Estimated Nov batch or DTC.'}
                                  </p>
                                </div>
                              </div>

                              {/* Card Footer - Actions */}
                              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setSelectedRequest(req)}
                                    className="px-3 py-1.5 rounded-lg border border-blue-400 text-blue-700 text-xs font-semibold hover:bg-blue-50 transition-all"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedStockCheckRequest(req);
                                      setSelectedStockCheckItemName(req.itemDetails?.[0]?.itemName ?? req.items[0] ?? null);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-cyan-400 text-cyan-700 text-xs font-semibold hover:bg-cyan-50 transition-all"
                                  >
                                    Stock Check
                                  </button>
                                  <button
                                    onClick={() => {
                                      updateRequestPriority(req.id, req.priority === 'High' ? 'Medium' : req.priority === 'Medium' ? 'Low' : 'High');
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-violet-400 text-violet-700 text-xs font-semibold hover:bg-violet-50 transition-all"
                                  >
                                    Priority
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => applyRouteState('Procurement', 'Quotations')}
                                    className="px-3 py-1.5 rounded-lg border border-emerald-400 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 transition-all"
                                  >
                                    View Quotes
                                  </button>
                                  {req.status === 'PO Draft' && (() => {
                                    const linkedDraft = draftPOs.find((d) => d.requestId === req.id);
                                    return (
                                      <button
                                        onClick={() => {
                                          if (linkedDraft?.backendPoId) {
                                            openReleasePOModal(linkedDraft.id);
                                          } else {
                                            addToast('warning', 'Create a Draft PO from Quotations first, then release from Draft POs.');
                                          }
                                        }}
                                        className="px-4 py-1.5 rounded-lg bg-amber-400 text-slate-900 text-xs font-bold hover:bg-amber-500 shadow-md transition-all"
                                      >
                                        Release PO
                                      </button>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {sideSection === 'Quotations' && (
                <div className="space-y-3">
                  {isProcurementDataLoading ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500 shadow-sm">
                      Loading procurement data…
                    </div>
                  ) : filteredQuotes.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500 shadow-sm">
                      No quotes match current filters.
                    </div>
                  ) : (
                    filteredQuotes.map((quote) => {
                      const totalValue = quote.lines.reduce((sum, line) => sum + line.totalValue, 0);
                      const isExpanded = expandedQuoteId === quote.id;
                      
                      return (
                        <article key={quote.id} className="rounded-xl border border-cyan-300 bg-white shadow-md overflow-hidden">
                          {/* Card Header */}
                          <div className="px-5 py-3 bg-linear-to-r from-cyan-50 via-blue-50 to-cyan-50 border-b border-cyan-200">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="px-2.5 py-1 rounded-md bg-cyan-500 text-white text-xs font-bold tracking-wide">
                                    {quote.id}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${requestTypeClass[quote.requestType]}`}>
                                    {quote.requestType}
                                  </span>
                                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${statusClass[quote.status]}`}>
                                    {quote.status}
                                  </span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-1">{quote.vendor}</h3>
                                <div className="flex items-center gap-3 text-xs text-slate-600">
                                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">
                                    For {quote.requestCode}
                                  </span>
                                  <span>·</span>
                                  <span>{quote.requestType === 'RM' ? 'Raw Material' : 'Packaging Material'}</span>
                                  <span>·</span>
                                  <span>Quoted {quote.quotedOn.split('-').reverse().join('-')}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-slate-500 mb-1">TOTAL VALUE</div>
                                <div className="text-2xl font-bold text-amber-600">₹{totalValue.toLocaleString('en-IN')}</div>
                              </div>
                            </div>
                          </div>

                          {/* Items Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-[10px] tracking-[0.14em] uppercase text-slate-500 bg-slate-50 border-b border-slate-200">
                                  <th className="px-4 py-2.5 font-semibold">ITEM</th>
                                  <th className="px-4 py-2.5 font-semibold">ORDER QTY</th>
                                  <th className="px-4 py-2.5 font-semibold text-right">PRICE / UNIT</th>
                                  <th className="px-4 py-2.5 font-semibold text-right">TOTAL VALUE</th>
                                  <th className="px-4 py-2.5 font-semibold text-right">VS PLANNED</th>
                                </tr>
                              </thead>
                              <tbody>
                                {quote.lines.map((line, idx) => (
                                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                      <span className="font-semibold text-slate-900">{line.item}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-bold">
                                        {line.qty}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-700">
                                      ₹{line.pricePerUnit.toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                                      ₹{line.totalValue.toLocaleString('en-IN')}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold ${
                                      line.vsPlanned.includes('-') ? 'text-emerald-600' : 'text-rose-600'
                                    }`}>
                                      {line.vsPlanned}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Footer Info */}
                          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
                            <div className="flex items-center justify-between text-xs text-slate-700">
                              <div className="flex items-center gap-6">
                                <span className="flex items-center gap-1.5">
                                  <span className="text-slate-500">Lead time:</span>
                                  <span className="font-semibold">{quote.leadTimeDays} days</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-slate-500">Terms:</span>
                                  <span className="font-semibold">{quote.terms}</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-slate-500">Valid till:</span>
                                  <span className="font-semibold">{quote.validTill}</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-slate-500">Vendor:</span>
                                  <span className="font-semibold text-amber-600">
                                    {quote.rating}
                                  </span>
                                </span>
                              </div>
                              <button
                                onClick={() => setExpandedQuoteId(isExpanded ? null : quote.id)}
                                className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium transition-colors"
                              >
                                {isExpanded ? 'Hide Details' : 'View Details'}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="px-5 py-4 bg-cyan-50/50 border-t border-cyan-100">
                              <div className="space-y-3">
                                {/* Note */}
                                {quote.note && (
                                  <div className="p-3 rounded-lg bg-white border border-cyan-200">
                                    <div className="text-xs font-semibold text-slate-600 mb-1">Additional Notes</div>
                                    <div className="text-sm text-slate-700">{quote.note}</div>
                                  </div>
                                )}
                                
                                {/* File Info */}
                                <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">Attached File:</span>
                                    <span className="text-sm font-semibold text-slate-700">{quote.fileName}</span>
                                  </div>
                                  <button className="px-3 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium">
                                    Download
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete quote ${quote.id}?`)) {
                                  deleteQuote(quote.id);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-medium transition-colors"
                            >
                              Delete
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuoteStatus(quote.id, quote.status === 'Confirmed' ? 'Not Selected' : 'Confirmed')}
                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                  quote.status === 'Confirmed'
                                    ? 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                                    : 'border border-emerald-400 text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                {quote.status === 'Confirmed' ? 'Mark Not Selected' : 'Confirm Quote'}
                              </button>
                              <button
                                onClick={() => createDraftPO(quote.id)}
                                className="px-4 py-2 rounded-lg bg-amber-400 text-slate-900 font-bold text-sm hover:bg-amber-500 transition-colors"
                              >
                                Create Draft PO
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              )}

              {sideSection === 'Draft POs' && (
                <>
                  {/* Filters */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-500">CATEGORY:</span>
                      {(['All', 'RM', 'PM'] as Array<'All' | RequestType>).map((category) => (
                        <button
                          key={category}
                          onClick={() => setCategoryFilter(category)}
                          className={`px-2 py-1 rounded border ${
                            categoryFilter === category
                              ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          {category}
                        </button>
                      ))}

                      <span className="text-slate-500 ml-2">VENDOR:</span>
                      <select
                        value={vendorFilter}
                        onChange={(event) => setVendorFilter(event.target.value)}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700"
                      >
                        <option value="All Vendors">All Vendors</option>
                        {vendors.map((vendor) => (
                          <option key={vendor.id} value={vendor.name}>
                            {vendor.name}
                          </option>
                        ))}
                      </select>

                      <span className="text-slate-500 ml-2">STATUS:</span>
                      <select
                        value={draftPOStatusFilter}
                        onChange={(e) => setDraftPOStatusFilter(e.target.value as 'All Statuses' | 'Pending Approval' | 'Approved')}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700"
                      >
                        <option value="All Statuses">All Statuses</option>
                        <option value="Pending Approval">Pending Approval</option>
                        <option value="Approved">Approved</option>
                      </select>
                    </div>

                    <input
                      placeholder="Search vendor, DPO ID, item..."
                      className="w-60 max-w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-700"
                    />
                  </div>

                  {/* Requests marked PO Draft but no Draft PO yet — create from Quotations */}
                  {requestsPODraftNoDraftPO.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Marked PO Draft — create draft PO from Quotations</p>
                      {requestsPODraftNoDraftPO.map((req) => (
                        <article key={req.id} className="rounded-xl border border-amber-200 bg-amber-50/50 px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">{req.code}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${requestTypeClass[req.type]}`}>{req.type}</span>
                            <span className="text-sm text-slate-700">No draft PO yet</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setMainTab('Procurement'); setSideSection('Quotations'); setSelectedRequest(req); }}
                            className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition"
                          >
                            Create Draft PO from Quotations
                          </button>
                        </article>
                      ))}
                    </div>
                  )}

                  {/* Draft PO Cards */}
                  <div className="space-y-3">
                    {filteredDraftPOs.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500 shadow-sm">
                        {draftPOs.length === 0 && requestsPODraftNoDraftPO.length === 0
                          ? 'No draft purchase orders.'
                          : draftPOs.length === 0
                            ? 'No draft POs yet. Create one from the Quotations tab (or use the cards above).'
                            : 'No draft POs match the current filters.'}
                      </div>
                    ) : (
                      filteredDraftPOs.map((dpo) => (
                        <article key={dpo.id} className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
                          {/* Header */}
                          <div className="px-5 py-3 border-b border-blue-200 bg-linear-to-r from-slate-50 to-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{dpo.dpoNumber}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${requestTypeClass[dpo.type]}`}>{dpo.type}</span>
                              <span className="text-sm font-bold text-slate-900">{dpo.vendor}</span>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${
                              dpo.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}>{dpo.status}</span>
                          </div>

                          {/* Items Table */}
                          <div className="px-4 py-2 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-[11px] tracking-[0.14em] text-slate-500 border-b border-slate-200">
                                  <th className="px-2 py-2">ITEM</th>
                                  <th className="px-2 py-2">TYPE</th>
                                  <th className="px-2 py-2">QTY</th>
                                  <th className="px-2 py-2 text-right">PRICE/UNIT</th>
                                  <th className="px-2 py-2 text-right">GST %</th>
                                  <th className="px-2 py-2 text-right">GST AMT</th>
                                  <th className="px-2 py-2 text-right">LINE TOTAL</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dpo.lineItems.map((line, idx) => (
                                  <tr key={idx} className="border-b border-slate-100">
                                    <td className="px-2 py-2">
                                      <div>
                                        <p className="font-medium text-slate-900">{line.item}</p>
                                        <p className="text-[10px] text-slate-500">{line.itemCode}</p>
                                      </div>
                                    </td>
                                    <td className="px-2 py-2">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${requestTypeClass[line.type]}`}>{line.type}</span>
                                    </td>
                                    <td className="px-2 py-2 text-yellow-700 font-semibold">{line.qty}</td>
                                    <td className="px-2 py-2 text-right">₹{line.pricePerUnit}</td>
                                    <td className="px-2 py-2 text-right">{line.gstPercent}%</td>
                                    <td className="px-2 py-2 text-right">₹{line.gstAmount.toLocaleString('en-IN')}</td>
                                    <td className="px-2 py-2 text-right font-semibold">₹{line.lineTotal.toLocaleString('en-IN')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Footer */}
                          <div className="px-5 py-3 bg-slate-50 flex flex-wrap items-start justify-between gap-4 text-xs">
                            <div className="space-y-3">
                              <div className="grid grid-cols-[120px_1fr] gap-2 text-slate-700">
                                <span>Subtotal</span>
                                <span className="font-medium">₹{dpo.subtotal.toLocaleString('en-IN')}</span>
                                <span>GST Total</span>
                                <span className="font-medium">₹{dpo.gstTotal.toLocaleString('en-IN')}</span>
                                <span className="text-yellow-700 font-bold">Grand Total</span>
                                <span className="text-yellow-700 font-bold">₹{dpo.grandTotal.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                            <div className="space-y-1 text-slate-600">
                              <p><strong>Payment Terms</strong> {dpo.paymentTerms}</p>
                              <p><strong>Expected Delivery</strong> {new Date(dpo.expectedDelivery).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</p>
                              <p><strong>Delivery Address</strong> {dpo.deliveryAddress}</p>
                              <p><strong>Vendor Rating</strong> {dpo.vendorRating}</p>
                            </div>
                          </div>

                          {/* Alert */}
                          {dpo.alertMessage && (
                            <div className={`px-5 py-2 text-xs flex items-center gap-2 ${
                              dpo.alertType === 'warning' ? 'bg-yellow-50 text-yellow-800' : 'bg-emerald-50 text-emerald-800'
                            }`}>
                              <span>{dpo.alertType === 'warning' ? '!' : '-'}</span>
                              <span>{dpo.alertMessage}</span>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedDraftPO(dpo)}
                              className="px-4 py-2 rounded-lg border border-blue-300 text-blue-700 text-sm font-semibold hover:bg-blue-50 transition"
                            >
                              View PO
                            </button>
                            <button
                              onClick={() => setEditDraftPOTarget(dpo)}
                              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                            >
                              Edit
                            </button>
                            {dpo.status === 'Pending Approval' && (
                              <button
                                onClick={() => {
                                  approveDraftPO(dpo.id);
                                }}
                                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition"
                              >
                                Approve
                              </button>
                            )}
                            {dpo.status === 'Approved' && (
                              <>
                                <button
                                  onClick={() => openReleasePOModal(dpo.id)}
                                  className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition"
                                >
                                  Release PO to Vendor
                                </button>
                                <button
                                  onClick={() => splitDraftPO(dpo.id)}
                                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition"
                                >
                                  Split PO
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </>
              )}

              {sideSection === 'Issued POs' && (() => {
                const totalPos = issuedPORecords.length;
                const rmPos = issuedPORecords.filter(record => record.request.type === 'RM').length;
                const pmPos = issuedPORecords.filter(record => record.request.type === 'PM').length;
                const advancePending = issuedPORecords.filter(record => record.status === 'Released').length;
                const inTransitCount = issuedPORecords.filter(record => record.status === 'In Transit').length;
                const grnComplete = completedGrns.length;

                const itemisedRows = filteredIssuedPORecords.flatMap(record =>
                  record.lineItems.map((line, index) => ({
                    key: `${record.poNumber}-${line.itemCode}-${index}`,
                    record,
                    line,
                  })),
                );

                const timelineStages = [
                  'PO Released',
                  'Advance Paid',
                  'Vendor Confirmed',
                  'Shipped',
                  'Delivered',
                  'Under GRN',
                  'GRN Complete',
                ] as const;

                const getTimelineCompletedIndex = (status: string) => {
                  if (status === 'Released') return 0;
                  if (status === 'In Transit') return 3;
                  if (status === 'At Risk') return 3;
                  return 0;
                };

                return (
                  <div className="space-y-4 rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                    {/* Top summary strip */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                      <div className="rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-900 px-4 py-3 flex flex-col justify-between">
                        <p className="text-[10px] tracking-[0.18em] text-cyan-700 uppercase">Total POs</p>
                        <p className="mt-1 text-2xl font-bold">{totalPos}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-emerald-700 uppercase">RM POs</p>
                        <p className="mt-1 text-2xl font-bold">{rmPos}</p>
                      </div>
                      <div className="rounded-lg border border-violet-200 bg-violet-50 text-violet-900 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-violet-700 uppercase">PM POs</p>
                        <p className="mt-1 text-2xl font-bold">{pmPos}</p>
                      </div>
                      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
                        <p className="text-[10px] tracking-[0.18em] uppercase">Advance Pending</p>
                        <p className="mt-1 text-2xl font-bold">{advancePending}</p>
                      </div>
                      <div className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sky-900">
                        <p className="text-[10px] tracking-[0.18em] uppercase">In Transit</p>
                        <p className="mt-1 text-2xl font-bold">{inTransitCount}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
                        <p className="text-[10px] tracking-[0.18em] uppercase">GRN Complete</p>
                        <p className="mt-1 text-2xl font-bold">{grnComplete}</p>
                      </div>
                    </div>

                    {/* Filters */}
                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-500">Category:</span>
                        <button
                            onClick={() => setCategoryFilter('All')}
                            className={`px-2 py-1 rounded-full border text-xs ${
                            categoryFilter === 'All'
                              ? 'border-amber-400 text-amber-800 bg-amber-50'
                              : 'border-slate-300 text-slate-600 bg-white'
                          }`}
                        >
                          All
                        </button>
                        {(['RM', 'PM'] as RequestType[]).map(type => (
                          <button
                            key={type}
                            onClick={() => setCategoryFilter(type)}
                            className={`px-2 py-1 rounded-full border text-xs ${
                              categoryFilter === type
                                ? 'border-emerald-400 text-emerald-800 bg-emerald-50'
                                : 'border-slate-300 text-slate-600 bg-white'
                            }`}
                          >
                            {type}
                          </button>
                        ))}

                        <span className="ml-3 text-slate-500">Vendor:</span>
                        <select
                          value={issuedVendorFilter}
                          onChange={(event) => setIssuedVendorFilter(event.target.value)}
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-xs"
                        >
                          <option value="All Vendors">All Vendors</option>
                          {Array.from(new Set(issuedPORecords.map(record => record.vendor))).map(vendor => (
                            <option key={vendor} value={vendor}>{vendor}</option>
                          ))}
                        </select>

                        <span className="ml-3 text-slate-500">Status:</span>
                        <select
                          value={issuedStatusFilter}
                          onChange={(event) => setIssuedStatusFilter(event.target.value as 'All' | 'Released' | 'In Transit' | 'At Risk')}
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-xs"
                        >
                          <option value="All">All Status</option>
                          <option value="Released">Released</option>
                          <option value="In Transit">In Transit</option>
                          <option value="At Risk">At Risk</option>
                        </select>
                      </div>

                      <input
                        value={issuedSearch}
                        onChange={(event) => setIssuedSearch(event.target.value)}
                        placeholder="Search PO no, vendor, item..."
                        className="w-64 max-w-full px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400"
                      />
                    </div>

                    {/* Itemised View table */}
                    <div className="rounded-lg border border-blue-200 bg-white overflow-hidden">
                      <div className="px-4 py-3 border-b border-blue-100 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-2">
                          <span className="text-sky-500 text-lg">▣</span>
                          <div>
                            <p className="text-xs font-semibold text-slate-800 tracking-[0.18em] uppercase">Itemised View</p>
                            <p className="text-[11px] text-slate-500">All line items across issued purchase orders</p>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Total Value{' '}
                          <span className="font-semibold text-amber-700">
                            ₹{filteredIssuedPORecords.reduce((sum, po) => sum + po.grandTotal, 0).toLocaleString('en-IN')}
                          </span>
                        </p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-full text-[11px] text-slate-900">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] tracking-[0.18em] uppercase text-slate-500">
                              <th className="px-4 py-2 text-left">Item</th>
                              <th className="px-4 py-2 text-left">Type</th>
                              <th className="px-4 py-2 text-left">PO Number</th>
                              <th className="px-4 py-2 text-left">Vendor</th>
                              <th className="px-4 py-2 text-left">Order Qty</th>
                              <th className="px-4 py-2 text-right">Price/Unit</th>
                              <th className="px-4 py-2 text-right">Line Value</th>
                              <th className="px-4 py-2 text-left">Payment Terms</th>
                              <th className="px-4 py-2 text-left">PO Status</th>
                              <th className="px-4 py-2 text-left">LR No</th>
                              <th className="px-4 py-2 text-left">Exp. Delivery</th>
                              <th className="px-4 py-2 text-left">Adv. Paid</th>
                              <th className="px-4 py-2 text-left">GRN Ref</th>
                              <th className="px-4 py-2 text-right">Track</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemisedRows.map(({ key, record, line }) => (
                              <tr
                                key={key}
                                className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer"
                                onClick={() => openIssuedPODetail(record)}
                              >
                                <td className="px-4 py-2 align-top">
                                  <div className="flex flex-col">
                                    <span className="text-[12px] font-semibold text-slate-900">{line.item}</span>
                                    <span className="text-[10px] text-slate-500">{line.itemCode}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 align-top">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    record.request.type === 'RM'
                                      ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                      : 'bg-violet-50 text-violet-700 border border-violet-200'
                                  }`}>
                                    {record.request.type}
                                  </span>
                                </td>
                                <td className="px-4 py-2 align-top font-mono text-[11px] text-sky-700">{record.poNumber}</td>
                                <td className="px-4 py-2 align-top text-[11px]">{record.vendor}</td>
                                <td className="px-4 py-2 align-top">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">
                                    <span className="text-slate-700">{line.qty}</span>
                                  </span>
                                </td>
                                <td className="px-4 py-2 align-top text-right text-[11px] text-slate-900">
                                  ₹{line.pricePerUnit.toLocaleString('en-IN')}
                                </td>
                                <td className="px-4 py-2 align-top text-right text-[11px] font-semibold text-amber-700">
                                  ₹{line.lineTotal.toLocaleString('en-IN')}
                                </td>
                                <td className="px-4 py-2 align-top text-[11px] text-slate-600">{record.paymentTerms}</td>
                                <td className="px-4 py-2 align-top">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    record.status === 'In Transit'
                                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                      : record.status === 'At Risk'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    {record.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 align-top text-[11px] text-slate-400">—</td>
                                <td className="px-4 py-2 align-top text-[11px] text-rose-600">
                                  {new Date(record.request.dueDate).toLocaleDateString('en-IN')}
                                </td>
                                <td className="px-4 py-2 align-top text-[11px] text-slate-400">—</td>
                                <td className="px-4 py-2 align-top text-[11px] text-emerald-600">—</td>
                                <td className="px-4 py-2 align-top text-right">
                                  <button
                                    onClick={() => openIssuedPODetail(record)}
                                    className="px-3 py-1 rounded-full border border-slate-300 bg-white text-[10px] text-slate-800 hover:bg-slate-50"
                                  >
                                    Track
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {itemisedRows.length === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-center text-[11px] text-slate-500" colSpan={14}>
                                  No issued purchase orders match current filters.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tracking cards under the itemised view */}
                    <div className="space-y-3">
                      {filteredIssuedPORecords.map(record => {
                        const completedIndex = getTimelineCompletedIndex(record.status);

                        return (
                          <div
                            key={`${record.request.id}-${record.poNumber}-card`}
                            className="rounded-lg border border-blue-200 bg-white px-4 py-4 text-xs text-slate-800 shadow-sm"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-300 font-mono text-[10px] text-sky-700">
                                    {record.poNumber}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-full border border-slate-300 text-[10px] text-slate-600">
                                    {record.request.type}
                                  </span>
                                </div>
                                <p className="text-sm font-semibold text-slate-900">{record.vendor}</p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                  {record.requestCode} · {record.lineItems.map(line => line.item).join(', ')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-amber-700">
                                  ₹{record.grandTotal.toLocaleString('en-IN')}
                                </p>
                                <p
                                  className={`text-[11px] mt-1 ${
                                    record.etaDays <= 1 ? 'text-rose-600' : 'text-slate-500'
                                  }`}
                                >
                                  {record.etaDays >= 0 ? `ETA ${record.etaDays} days` : 'Overdue'}
                                </p>
                              </div>
                            </div>

                            {/* Timeline */}
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-1.5 relative">
                                <div className="absolute left-8 right-8 top-1/2 h-px bg-slate-200" />
                                {timelineStages.map((stage, index) => {
                                  const done = index <= completedIndex;
                                  return (
                                    <div
                                      key={`${record.poNumber}-${stage}`}
                                      className="relative flex flex-col items-center flex-1"
                                    >
                                      <div
                                        className={`z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-semibold shadow-sm ${
                                          done
                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : 'bg-white border-sky-200 text-sky-400'
                                        }`}
                                      >
                                        {index + 1}
                                      </div>
                                      <p
                                        className={`mt-2 text-[10px] tracking-[0.18em] uppercase ${
                                          done ? 'text-sky-700' : 'text-sky-400'
                                        }`}
                                      >
                                        {stage}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Shipment tracking + actions */}
                            <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
                              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
                                <p className="mb-1 font-semibold">Items Ordered</p>
                                {record.lineItems.map((line, index) => (
                                  <div
                                    key={`${record.poNumber}-${line.itemCode}-${index}`}
                                    className="flex items-center justify-between gap-2 py-1 border-t border-slate-800 first:border-t-0"
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-[11px] text-slate-900">{line.item}</span>
                                      <span className="text-[10px] text-slate-500">{line.itemCode}</span>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[10px] text-slate-700">{line.qty}</p>
                                      <p className="text-[10px] text-amber-700">
                                        ₹{line.lineTotal.toLocaleString('en-IN')}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
                                <p className="mb-1 font-semibold">Shipment Tracking</p>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Courier</span>
                                    <span className="text-slate-800">Logistics Partner</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500">ETA</span>
                                    <span className="text-slate-800">{new Date(record.request.dueDate).toLocaleDateString('en-IN')}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Status</span>
                                    <span className="text-slate-800">{record.status}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => openIssuedPODetail(record)}
                                className="px-3 py-1.5 rounded border border-slate-300 text-slate-800 text-[11px] font-semibold hover:bg-slate-50"
                              >
                                Full Timeline
                              </button>
                              <button
                                onClick={() => markIssuedPOInTransit(record.request.id, record.requestCode)}
                                disabled={record.status === 'In Transit'}
                                className={`px-3 py-1.5 rounded border text-[11px] font-semibold ${record.status === 'In Transit' ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed' : 'border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100'}`}
                              >
                                Mark In Transit
                              </button>
                              <button
                                onClick={() => receiveIssuedPOGRN(record.request.id, record.requestCode)}
                                className="px-3 py-1.5 rounded border border-emerald-400 text-emerald-700 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100"
                              >
                                Mark Delivered at WH
                              </button>
                              <button
                                onClick={() => applyRouteState('Procurement', 'GRN Monitor')}
                                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 text-[11px] font-semibold bg-white hover:bg-slate-50"
                              >
                                Open GRN Monitor
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {sideSection === 'GRN Monitor' && (() => {
                const grnList: GRNRecordFromApi[] = grnListFromApi ?? [];
                const filteredGrnLines = grnList.filter((grn) => {
                  if (grnCategoryFilter !== 'All' && grn.type !== grnCategoryFilter) return false;
                  if (grnVendorFilter !== 'All Vendors' && grn.vendor !== grnVendorFilter) return false;
                  const statusNorm = (grn.status || '') === 'GRN Complete' ? 'Completed' : (grn.status || '') === 'Under GRN' ? 'Under GRN' : 'Pending GRN';
                  if (grnStatusFilter !== 'All' && statusNorm !== grnStatusFilter) return false;
                  if (!grnSearch.trim()) return true;
                  const q = grnSearch.toLowerCase();
                  return (
                    (grn.grnNo ?? '').toLowerCase().includes(q) ||
                    (grn.poNo ?? '').toLowerCase().includes(q) ||
                    (grn.vendor ?? '').toLowerCase().includes(q) ||
                    (grn.lineItems ?? []).some((l) => (l.item ?? '').toLowerCase().includes(q) || (l.itemCode ?? '').toLowerCase().includes(q))
                  );
                });
                const totalGrns = grnList.length;
                const rmGrns = grnList.filter((g) => g.type === 'RM').length;
                const pmGrns = grnList.filter((g) => g.type === 'PM').length;
                const pendingGrn = grnList.filter((g) => (g.status || '') !== 'Under GRN' && (g.status || '') !== 'GRN Complete').length;
                const underGrn = grnList.filter((g) => (g.status || '') === 'Under GRN').length;
                const grnComplete = grnList.filter((g) => (g.status || '') === 'GRN Complete').length;

                if (grnListLoading) {
                  return (
                    <div className="rounded-xl border border-blue-200 bg-white p-8 text-center text-slate-500 text-sm">
                      Loading GRN data…
                    </div>
                  );
                }

                return (
                  <div className="space-y-4 rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                    {/* Top summary strip */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-slate-500 uppercase">Total GRNs</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-700">{totalGrns}</p>
                      </div>
                      <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-cyan-700 uppercase">RM GRNs</p>
                        <p className="mt-1 text-2xl font-bold text-cyan-800">{rmGrns}</p>
                      </div>
                      <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-violet-700 uppercase">PM GRNs</p>
                        <p className="mt-1 text-2xl font-bold text-violet-800">{pmGrns}</p>
                      </div>
                      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-amber-700 uppercase">Pending GRN</p>
                        <p className="mt-1 text-2xl font-bold text-amber-800">{pendingGrn}</p>
                      </div>
                      <div className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-sky-700 uppercase">Under GRN</p>
                        <p className="mt-1 text-2xl font-bold text-sky-800">{underGrn}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-emerald-700 uppercase">GRN Complete</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-800">{grnComplete}</p>
                      </div>
                    </div>

                    {/* Filters */}
                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-500">Category:</span>
                        <button
                          onClick={() => setGrnCategoryFilter('All')}
                          className={`px-2 py-1 rounded-full border text-xs ${
                            grnCategoryFilter === 'All'
                              ? 'border-amber-400 text-amber-800 bg-amber-50'
                              : 'border-slate-300 text-slate-600 bg-white'
                          }`}
                        >
                          All
                        </button>
                        {(['RM', 'PM'] as RequestType[]).map((type) => (
                          <button
                            key={type}
                            onClick={() => setGrnCategoryFilter(type)}
                            className={`px-2 py-1 rounded-full border text-xs ${
                              grnCategoryFilter === type
                                ? 'border-emerald-400 text-emerald-800 bg-emerald-50'
                                : 'border-slate-300 text-slate-600 bg-white'
                            }`}
                          >
                            {type}
                          </button>
                        ))}

                        <span className="ml-3 text-slate-500">Vendor:</span>
                        <select
                          value={grnVendorFilter}
                          onChange={(event) => setGrnVendorFilter(event.target.value)}
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-xs"
                        >
                          <option value="All Vendors">All Vendors</option>
                          {Array.from(new Set(filteredGrnLines.map((g) => g.vendor).filter(Boolean))).map((vendor) => (
                            <option key={String(vendor)} value={String(vendor)}>{String(vendor)}</option>
                          ))}
                        </select>

                        <span className="ml-3 text-slate-500">Status:</span>
                        <select
                          value={grnStatusFilter}
                          onChange={(event) =>
                            setGrnStatusFilter(
                              event.target.value as 'All' | 'Pending GRN' | 'Under GRN' | 'Completed',
                            )
                          }
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-xs"
                        >
                          <option value="All">All Status</option>
                          <option value="Pending GRN">Pending GRN</option>
                          <option value="Under GRN">Under GRN</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>

                      <input
                        value={grnSearch}
                        onChange={(event) => setGrnSearch(event.target.value)}
                        placeholder="Search vendor, PO no, item..."
                        className="w-64 max-w-full px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400"
                      />
                    </div>

                    {/* GRN list from warehouse (read-only) */}
                    <p className="text-[11px] text-slate-500 mb-2">Data from warehouse GRN table. Read-only.</p>
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>
                          <div>
                            <p className="text-xs font-semibold text-slate-800 tracking-[0.18em] uppercase">GRN list (warehouse)</p>
                            <p className="text-[11px] text-slate-500">Read-only progress from backend</p>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-full text-[11px] text-slate-900">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] tracking-[0.18em] uppercase text-slate-500">
                              <th className="px-4 py-2 text-left">GRN No.</th>
                              <th className="px-4 py-2 text-left">PO No.</th>
                              <th className="px-4 py-2 text-left">Vendor</th>
                              <th className="px-4 py-2 text-center">Type</th>
                              <th className="px-4 py-2 text-center">Items</th>
                              <th className="px-4 py-2 text-center">PO Value</th>
                              <th className="px-4 py-2 text-left">Received Date</th>
                              <th className="px-4 py-2 text-left">Assigned To</th>
                              <th className="px-4 py-2 text-center">QC Status</th>
                              <th className="px-4 py-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredGrnLines.map((grn) => (
                              <tr key={grn.id} className="border-b border-slate-100 hover:bg-blue-50/60">
                                <td className="px-4 py-2 align-middle font-mono text-emerald-700">{grn.grnNo}</td>
                                <td className="px-4 py-2 align-middle font-mono text-slate-700">{grn.poNo}</td>
                                <td className="px-4 py-2 align-middle text-[11px]">{grn.vendor}</td>
                                <td className="px-4 py-2 align-middle text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${grn.type === 'RM' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
                                    {grn.type}
                                  </span>
                                </td>
                                <td className="px-4 py-2 align-middle text-center">{grn.items ?? 0}</td>
                                <td className="px-4 py-2 align-middle text-center">₹{(grn.poValue ?? 0).toLocaleString('en-IN')}</td>
                                <td className="px-4 py-2 align-middle text-[11px]">{(grn.receivedDate && grn.receivedDate !== '') ? new Date(grn.receivedDate).toLocaleDateString('en-IN') : '—'}</td>
                                <td className="px-4 py-2 align-middle text-[11px]">{grn.assignedTo || '—'}</td>
                                <td className="px-4 py-2 align-middle text-center text-[11px]">{grn.qcStatus ?? '—'}</td>
                                <td className="px-4 py-2 align-middle text-center">
                                  <span className="inline-flex items-center justify-center px-3 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-semibold min-w-24">
                                    {grn.status ?? 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {filteredGrnLines.length === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-center text-[11px] text-slate-500" colSpan={10}>
                                  {grnList.length === 0 ? 'No GRNs in warehouse. Data from /api/v1/grn.' : 'No GRNs match current filters.'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Line items by GRN (read-only) */}
                    {filteredGrnLines.some((g) => (g.lineItems?.length ?? 0) > 0) && (
                      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                          <p className="text-xs font-semibold text-slate-800 tracking-[0.18em] uppercase">GRN line items (read-only)</p>
                        </div>
                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                          <table className="w-full min-w-full text-[11px] text-slate-900">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] tracking-[0.18em] uppercase text-slate-500">
                                <th className="px-4 py-2 text-left">GRN No.</th>
                                <th className="px-4 py-2 text-left">Item</th>
                                <th className="px-4 py-2 text-center">PO Qty</th>
                                <th className="px-4 py-2 text-center">Rcvd</th>
                                <th className="px-4 py-2 text-center">QC</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredGrnLines.flatMap((grn) => (grn.lineItems ?? []).map((li, idx) => (
                                <tr key={`${grn.id}-${idx}`} className="border-b border-slate-100">
                                  <td className="px-4 py-1.5 font-mono text-[10px] text-emerald-700">{grn.grnNo}</td>
                                  <td className="px-4 py-1.5">{li.item ?? li.itemCode ?? '—'}</td>
                                  <td className="px-4 py-1.5 text-center">{li.poQty ?? '—'}</td>
                                  <td className="px-4 py-1.5 text-center">{li.rcvdQty ?? '—'}</td>
                                  <td className="px-4 py-1.5 text-center">{li.qcStatus ?? '—'}</td>
                                </tr>
                              )))}
                            {filteredGrnLines.flatMap((g) => g.lineItems ?? []).length === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-center text-[11px] text-slate-500" colSpan={5}>
                                  No GRN line items.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    )}

                    {/* Completed GRNs (read-only from warehouse API) */}
                    {(() => {
                      const completedFromApi = filteredGrnLines.filter((g) => (g.status || '') === 'GRN Complete');
                      return (
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden mt-4">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-800 tracking-[0.18em] uppercase">Completed GRNs</p>
                        <p className="text-[11px] text-slate-500">Showing {completedFromApi.length} completed GRN{completedFromApi.length === 1 ? '' : 's'} (read-only)</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-full text-[11px] text-slate-900">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] tracking-[0.18em] uppercase text-slate-500">
                              <th className="px-4 py-2 text-left">GRN No.</th>
                              <th className="px-4 py-2 text-left">PO No.</th>
                              <th className="px-4 py-2 text-left">Type</th>
                              <th className="px-4 py-2 text-left">Vendor</th>
                              <th className="px-4 py-2 text-left">Items</th>
                              <th className="px-4 py-2 text-left">Received Date</th>
                              <th className="px-4 py-2 text-left">Assigned To</th>
                              <th className="px-4 py-2 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {completedFromApi.map((grn) => (
                              <tr key={grn.id} className="border-b border-slate-100 hover:bg-emerald-50/40">
                                <td className="px-4 py-2 font-mono text-[10px] text-emerald-700">{grn.grnNo}</td>
                                <td className="px-4 py-2 font-mono text-[10px] text-sky-700">{grn.poNo ?? '—'}</td>
                                <td className="px-4 py-2 text-[11px]">{grn.type ?? '—'}</td>
                                <td className="px-4 py-2 text-[11px]">{grn.vendor ?? '—'}</td>
                                <td className="px-4 py-2 text-[11px]">{(grn.lineItems ?? []).map((li) => li.item ?? li.itemCode ?? '—').filter(Boolean).join(', ') || '—'}</td>
                                <td className="px-4 py-2 text-[11px] text-slate-700">{grn.receivedDate ? new Date(grn.receivedDate).toLocaleDateString('en-IN') : '—'}</td>
                                <td className="px-4 py-2 text-[11px] text-slate-700">{grn.assignedTo ?? '—'}</td>
                                <td className="px-4 py-2">
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-semibold">Completed</span>
                                </td>
                              </tr>
                            ))}
                            {completedFromApi.length === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-center text-[11px] text-slate-500" colSpan={8}>
                                  No completed GRNs yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {sideSection === 'Stock Check' && (() => {
                const rows: WarehouseInventoryRow[] = warehouseInventoryData?.rows ?? [];
                const filteredRows = rows.filter((row) => {
                  if (stockCategoryFilter !== 'All' && row.type !== stockCategoryFilter) return false;
                  if (stockStatusFilter !== 'All Statuses' && row.status !== stockStatusFilter) return false;
                  if (!stockSearch.trim()) return true;
                  const q = stockSearch.toLowerCase();
                  return (row.code ?? '').toLowerCase().includes(q) || (row.name ?? '').toLowerCase().includes(q);
                });
                const total = rows.length;
                const rmCount = rows.filter((r) => r.type === 'RM').length;
                const pmCount = rows.filter((r) => r.type === 'PM').length;
                const fgCount = rows.filter((r) => r.type === 'FG/PR').length;
                const inStock = rows.filter((r) => r.status === 'In Stock').length;
                const lowStock = rows.filter((r) => r.status === 'Low Stock').length;
                const critical = rows.filter((r) => r.status === 'Critical').length;
                const outOfStock = rows.filter((r) => r.status === 'Out of Stock').length;

                if (warehouseInventoryLoading) {
                  return (
                    <div className="rounded-xl border border-blue-200 bg-white p-8 text-center text-slate-500 text-sm">
                      Loading warehouse inventory…
                    </div>
                  );
                }

                return (
                  <div className="space-y-4 rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] text-slate-600">Data from warehouse inventory. Read-only.</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-slate-600 uppercase">Total</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">{total}</p>
                      </div>
                      <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-cyan-700 uppercase">RM</p>
                        <p className="mt-1 text-xl font-bold text-cyan-800">{rmCount}</p>
                      </div>
                      <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-violet-700 uppercase">PM</p>
                        <p className="mt-1 text-xl font-bold text-violet-800">{pmCount}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-slate-600 uppercase">FG/PR</p>
                        <p className="mt-1 text-xl font-bold text-slate-800">{fgCount}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-emerald-700 uppercase">In Stock</p>
                        <p className="mt-1 text-xl font-bold text-emerald-800">{inStock}</p>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-amber-700 uppercase">Low Stock</p>
                        <p className="mt-1 text-xl font-bold text-amber-800">{lowStock}</p>
                      </div>
                      <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-orange-700 uppercase">Critical</p>
                        <p className="mt-1 text-xl font-bold text-orange-800">{critical}</p>
                      </div>
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                        <p className="text-[10px] tracking-[0.18em] text-red-700 uppercase">Out of Stock</p>
                        <p className="mt-1 text-xl font-bold text-red-800">{outOfStock}</p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-slate-500">Category:</span>
                      <button onClick={() => setStockCategoryFilter('All')} className={`px-2 py-1 rounded-full border ${stockCategoryFilter === 'All' ? 'border-amber-400 text-amber-800 bg-amber-50' : 'border-slate-300 text-slate-600 bg-white'}`}>All</button>
                      {(['RM', 'PM'] as const).map((t) => (
                        <button key={t} onClick={() => setStockCategoryFilter(t)} className={`px-2 py-1 rounded-full border ${stockCategoryFilter === t ? 'border-emerald-400 text-emerald-800 bg-emerald-50' : 'border-slate-300 text-slate-600 bg-white'}`}>{t}</button>
                      ))}
                      <span className="text-slate-500 ml-2">Status:</span>
                      <select value={stockStatusFilter} onChange={(e) => setStockStatusFilter(e.target.value as typeof stockStatusFilter)} className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-xs">
                        <option value="All Statuses">All</option>
                        <option value="In Stock">In Stock</option>
                        <option value="Low Stock">Low Stock</option>
                        <option value="Critical">Critical</option>
                        <option value="Out of Stock">Out of Stock</option>
                      </select>
                      <input value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} placeholder="Search code, name…" className="w-48 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400" />
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                        <p className="text-xs font-semibold text-slate-800 tracking-[0.18em] uppercase">Warehouse inventory</p>
                      </div>
                      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                        <table className="w-full min-w-full text-[11px] text-slate-900">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] tracking-[0.18em] uppercase text-slate-500">
                              <th className="px-4 py-2 text-left">Code</th>
                              <th className="px-4 py-2 text-left">Name</th>
                              <th className="px-4 py-2 text-left">Type</th>
                              <th className="px-4 py-2 text-left">Zone</th>
                              <th className="px-4 py-2 text-left">Rack</th>
                              <th className="px-4 py-2 text-right">Stock in hand</th>
                              <th className="px-4 py-2 text-right">In transit</th>
                              <th className="px-4 py-2 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRows.map((row) => (
                              <tr key={row.id} className="border-b border-slate-100">
                                <td className="px-4 py-2 font-mono text-[10px] text-slate-800">{row.code}</td>
                                <td className="px-4 py-2">{row.name}</td>
                                <td className="px-4 py-2">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${row.type === 'RM' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : row.type === 'PM' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{row.type}</span>
                                </td>
                                <td className="px-4 py-2 text-slate-700">{row.zone ?? '—'}</td>
                                <td className="px-4 py-2 text-slate-700">{row.rack ?? '—'}</td>
                                <td className="px-4 py-2 text-right font-mono">{row.stockInHand} {row.whUnit ?? ''}</td>
                                <td className="px-4 py-2 text-right font-mono">{row.inTransit ?? 0}</td>
                                <td className="px-4 py-2">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
                                    row.status === 'In Stock' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    row.status === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    row.status === 'Critical' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                    'bg-red-50 text-red-700 border-red-200'
                                  }`}>{row.status}</span>
                                </td>
                              </tr>
                            ))}
                            {filteredRows.length === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-center text-slate-500" colSpan={8}>No warehouse inventory rows match filters.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {sideSection === 'Item Tracker' && (
                <div className="rounded-xl border border-blue-200 bg-white p-4 md:p-5 shadow-sm space-y-4">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base md:text-lg font-bold text-slate-900">Item Tracker — All Items Across All Stages</h2>
                      <p className="text-xs md:text-sm text-slate-600 mt-1">
                        Live view of every raw material and packaging item across requests, quotes, POs and deliveries.
                      </p>
                    </div>
                    <div className="text-[11px] md:text-xs text-slate-500 flex items-center gap-2">
                      <span className="px-2 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold">
                        {filteredItemTrackerRows.length} items shown
                      </span>
                      <span className="hidden sm:inline text-slate-400">Synced with procurement data</span>
                    </div>
                  </div>

                  {/* Filters row */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 md:px-4 py-3 flex flex-wrap items-center gap-3 md:gap-4 text-[11px] md:text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-600">Category:</span>
                      <button
                        type="button"
                        onClick={() => setItemTrackerCategory('All')}
                        className={`px-2 py-1 rounded-full border text-[11px] md:text-xs ${
                          itemTrackerCategory === 'All'
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        All
                      </button>
                      {(['RM', 'PM'] as RequestType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setItemTrackerCategory(type)}
                          className={`px-2 py-1 rounded-full border text-[11px] md:text-xs ${
                            itemTrackerCategory === type
                              ? type === 'RM'
                                ? 'border-cyan-500 bg-cyan-50 text-cyan-800'
                                : 'border-violet-500 bg-violet-50 text-violet-800'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-600">Vendor:</span>
                      <select
                        value={itemTrackerVendor}
                        onChange={(e) => setItemTrackerVendor(e.target.value)}
                        className="min-w-35 md:min-w-45 bg-white border border-slate-300 rounded-md px-2 py-1 text-[11px] md:text-xs text-slate-800"
                      >
                        <option value="All Vendors">All Vendors</option>
                        {itemTrackerVendors.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-600">Status:</span>
                      <select
                        value={itemTrackerStatus}
                        onChange={(e) => setItemTrackerStatus(e.target.value as 'All Statuses' | RequestStatus)}
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 text-[11px] md:text-xs text-slate-800"
                      >
                        <option value="All Statuses">All Statuses</option>
                        <option value="New">New</option>
                        <option value="Quoted">Quoted</option>
                        <option value="PO Draft">PO Draft</option>
                        <option value="PO Released">PO Released</option>
                        <option value="Delivery Pending">Delivery Pending</option>
                      </select>
                    </div>

                    <div className="ml-auto flex-1 min-w-40 max-w-xs">
                      <input
                        value={itemTrackerSearch}
                        onChange={(e) => setItemTrackerSearch(e.target.value)}
                        placeholder="Search item name, code, PO"
                        className="w-full px-3 py-1.5 rounded-md bg-white border border-slate-300 text-[11px] md:text-xs text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Items table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-[11px] md:text-xs text-slate-900">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr className="text-[10px] md:text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          <th className="px-3 md:px-4 py-2 text-left">Item</th>
                          <th className="px-3 md:px-4 py-2 text-left">Type</th>
                          <th className="px-3 md:px-4 py-2 text-left">Request</th>
                          <th className="px-3 md:px-4 py-2 text-left">Priority</th>
                          <th className="px-3 md:px-4 py-2 text-center">Req Qty</th>
                          <th className="px-3 md:px-4 py-2 text-center">Planned ₹</th>
                          <th className="px-3 md:px-4 py-2 text-left">Request Status</th>
                          <th className="px-3 md:px-4 py-2 text-left">Preferred Vendor</th>
                          <th className="px-3 md:px-4 py-2 text-left">Quoted Vendor</th>
                          <th className="px-3 md:px-4 py-2 text-center">Actual ₹</th>
                          <th className="px-3 md:px-4 py-2 text-left">PO Number</th>
                          <th className="px-3 md:px-4 py-2 text-left">PO Status</th>
                          <th className="px-3 md:px-4 py-2 text-center">Order Qty</th>
                          <th className="px-3 md:px-4 py-2 text-center">Adv Paid</th>
                          <th className="px-3 md:px-4 py-2 text-left">LR No</th>
                          <th className="px-3 md:px-4 py-2 text-left">Exp. Delivery</th>
                          <th className="px-3 md:px-4 py-2 text-left">GRN Ref</th>
                          <th className="px-3 md:px-4 py-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItemTrackerRows.map((row) => {
                          const priorityClassName =
                            row.priority === 'High'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : row.priority === 'Medium'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200';

                          const typePillClass =
                            row.type === 'RM'
                              ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                              : 'bg-violet-50 text-violet-700 border-violet-200';

                          const statusPillClass = statusBg[row.requestStatus];

                          let actionLabel: string | null = null;
                          if (row.requestStatus === 'New') actionLabel = 'Quote';
                          else if (row.requestStatus === 'Quoted') actionLabel = 'Draft';
                          else if (row.requestStatus === 'PO Draft') actionLabel = 'Release';
                          else if (row.requestStatus === 'PO Released' || row.requestStatus === 'Delivery Pending') actionLabel = 'PO';

                          const handleActionClick = () => {
                            if (!actionLabel) return;

                            if (row.requestStatus === 'New') {
                              setCategoryFilter('All');
                              setVendorFilter('All Vendors');
                              setStatusFilter('All Statuses');
                              setRequestStatusFilter('All Statuses');
                              setSearchQuery(row.itemName);
                              applyRouteState('Procurement', 'Quotations');
                              return;
                            }

                            if (row.requestStatus === 'Quoted') {
                              if (row.quoteId) {
                                createDraftPO(row.quoteId);
                              } else {
                                addToast('warning', 'No quote found for this item');
                              }
                              return;
                            }

                            if (row.requestStatus === 'PO Draft') {
                              if (row.draftPoId) {
                                approveDraftPO(row.draftPoId);
                                openReleasePOModal(row.draftPoId);
                              } else {
                                addToast('warning', 'No draft PO linked to this item');
                              }
                              return;
                            }

                            if (row.requestStatus === 'PO Released' || row.requestStatus === 'Delivery Pending') {
                              if (row.poId) {
                                const po = purchaseOrders.find((p) => p.id === row.poId);
                                if (po) {
                                  setSelectedPO(po);
                                } else {
                                  addToast('warning', 'Purchase order not found');
                                }
                              } else {
                                applyRouteState('Procurement', 'Issued POs');
                              }
                            }
                          };

                          return (
                            <tr key={row.key} className="border-b border-slate-100 hover:bg-blue-50/40">
                              <td className="px-3 md:px-4 py-2 align-middle">
                                <div className="flex flex-col">
                                  <span className="text-[11px] md:text-xs font-semibold text-slate-900">{row.itemName}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{row.itemCode}</span>
                                </div>
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${typePillClass}`}>
                                  {row.type === 'RM' ? 'RM' : 'PM'}
                                </span>
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-300 bg-slate-50 text-[10px] font-mono text-slate-700">
                                  {row.requestCode}
                                </span>
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${priorityClassName}`}>
                                  {row.priority}
                                </span>
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-center text-[11px] text-slate-800">
                                {row.reqQty.toLocaleString('en-IN')} {row.unit}
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-center text-[11px] text-slate-800">
                                ₹{row.plannedPrice.toLocaleString('en-IN')}
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusPillClass}`}>
                                  {row.requestStatus}
                                </span>
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-[11px] text-slate-800">
                                {row.preferredVendor ?? '—'}
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-[11px] text-slate-800">
                                {row.quotedVendor ?? '—'}
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-center text-[11px] text-emerald-700">
                                {row.actualPrice != null ? `₹${row.actualPrice.toLocaleString('en-IN')}` : '—'}
                                {row.actualVsPlanned && (
                                  <span className="block text-[9px] text-emerald-600">{row.actualVsPlanned}</span>
                                )}
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-[11px] text-slate-800 font-mono">
                                {row.poNumber ?? '—'}
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-[11px]">
                                {row.poStatus ?? '—'}
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-center text-[11px] text-slate-800">
                                {row.orderQty ?? '—'}
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-center text-[11px] text-slate-800">
                                {row.advPaid ?? '—'}
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-[11px] text-slate-800 font-mono">
                                {row.lrNo ?? '—'}
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-[11px] text-slate-800">
                                {row.expDelivery ?? '—'}
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-[11px] text-slate-800">
                                {row.grnRef ?? '—'}
                              </td>
                              <td className="px-3 md:px-4 py-2 align-middle text-center">
                                {actionLabel && (
                                  <button
                                    type="button"
                                    onClick={handleActionClick}
                                    className="px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold shadow-sm"
                                  >
                                    {actionLabel}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredItemTrackerRows.length === 0 && (
                          <tr>
                            <td
                              colSpan={18}
                              className="px-4 py-6 text-center text-[11px] text-slate-500"
                            >
                              No items match the current filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Warehouse item progress (read-only from warehouse API) */}
                  <div className="mt-6 rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-800 tracking-[0.18em] uppercase">Warehouse item progress</p>
                      <span className="text-[11px] text-slate-500">Read-only · from warehouse inventory</span>
                    </div>
                    {warehouseInventoryLoading ? (
                      <div className="px-4 py-8 text-center text-slate-500 text-sm">Loading…</div>
                    ) : (
                      <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                        <table className="w-full min-w-full text-[11px] text-slate-900">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] tracking-[0.18em] uppercase text-slate-500">
                              <th className="px-4 py-2 text-left">Code</th>
                              <th className="px-4 py-2 text-left">Name</th>
                              <th className="px-4 py-2 text-left">Type</th>
                              <th className="px-4 py-2 text-left">Zone</th>
                              <th className="px-4 py-2 text-left">Rack</th>
                              <th className="px-4 py-2 text-right">Stock in hand</th>
                              <th className="px-4 py-2 text-right">In transit</th>
                              <th className="px-4 py-2 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(warehouseInventoryData?.rows ?? []).map((row) => (
                              <tr key={row.id} className="border-b border-slate-100">
                                <td className="px-4 py-2 font-mono text-[10px] text-slate-800">{row.code}</td>
                                <td className="px-4 py-2">{row.name}</td>
                                <td className="px-4 py-2">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${row.type === 'RM' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : row.type === 'PM' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{row.type}</span>
                                </td>
                                <td className="px-4 py-2 text-slate-700">{row.zone ?? '—'}</td>
                                <td className="px-4 py-2 text-slate-700">{row.rack ?? '—'}</td>
                                <td className="px-4 py-2 text-right font-mono">{row.stockInHand} {row.whUnit ?? ''}</td>
                                <td className="px-4 py-2 text-right font-mono">{row.inTransit ?? 0}</td>
                                <td className="px-4 py-2">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
                                    row.status === 'In Stock' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    row.status === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    row.status === 'Critical' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                    'bg-red-50 text-red-700 border-red-200'
                                  }`}>{row.status}</span>
                                </td>
                              </tr>
                            ))}
                            {(warehouseInventoryData?.rows ?? []).length === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-center text-slate-500" colSpan={8}>No warehouse inventory data.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* ── PO Detail Side Panel ── */}
      {selectedPO && (() => {
        const po = selectedPO;
        const poStatusColor2: Record<string, string> = {
          Shipped: 'bg-blue-100 text-blue-700 border-blue-200',
          'Advance Paid': 'bg-orange-100 text-orange-700 border-orange-200',
          Delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          'PO Released': 'bg-slate-100 text-slate-700 border-slate-200',
          'Vendor Confirmed': 'bg-cyan-100 text-cyan-700 border-cyan-200',
          'Under GRN': 'bg-violet-100 text-violet-700 border-violet-200',
          'GRN Complete': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        };

        const TRACKING_STAGES: { label: string; atKey: keyof PoTrackingRecord; noteKey: keyof PoTrackingRecord; useRef?: boolean }[] = [
          { label: 'PO Released', atKey: 'poReleasedAt', noteKey: 'poReleasedNote' },
          { label: 'Advance Paid', atKey: 'advancePaidAt', noteKey: 'advancePaidNote' },
          { label: 'Vendor Confirmed', atKey: 'vendorConfirmedAt', noteKey: 'vendorConfirmedNote' },
          { label: 'Shipped', atKey: 'shippedAt', noteKey: 'shippedNote' },
          { label: 'Order Tracking', atKey: 'poReleasedAt', noteKey: 'poReleasedNote', useRef: true },
          { label: 'Delivered', atKey: 'deliveredAt', noteKey: 'deliveredNote' },
          { label: 'Under GRN', atKey: 'underGrnAt', noteKey: 'underGrnNote' },
          { label: 'GRN Complete', atKey: 'grnCompleteAt', noteKey: 'grnCompleteNote' },
        ];
        const data = poTrackingData ?? poTrackingForm;
        const timelineFromApi = po.backendPoId && data
          ? TRACKING_STAGES.map((s) => {
              const atVal = s.useRef ? data.orderTrackingRef : data[s.atKey];
              const noteVal = data[s.noteKey];
              const done = !!atVal;
              return { stage: s.label, done, timestamp: typeof atVal === 'string' ? atVal : null, note: !s.useRef ? (noteVal ?? null) : null };
            })
          : null;
        const timelineSteps = timelineFromApi ?? (po.timeline ?? []);

        const handleSaveTracking = async () => {
          if (!po.backendPoId) return;
          const res = await updatePoTracking(po.backendPoId, {
            poReleasedAt: poTrackingForm.poReleasedAt ?? null,
            poReleasedNote: poTrackingForm.poReleasedNote ?? null,
            advancePaidAt: poTrackingForm.advancePaidAt ?? null,
            advancePaidNote: poTrackingForm.advancePaidNote ?? null,
            vendorConfirmedAt: poTrackingForm.vendorConfirmedAt ?? null,
            vendorConfirmedNote: poTrackingForm.vendorConfirmedNote ?? null,
            shippedAt: poTrackingForm.shippedAt ?? null,
            shippedNote: poTrackingForm.shippedNote ?? null,
            orderTrackingRef: poTrackingForm.orderTrackingRef ?? null,
            deliveredAt: poTrackingForm.deliveredAt ?? null,
            deliveredNote: poTrackingForm.deliveredNote ?? null,
            underGrnAt: poTrackingForm.underGrnAt ?? null,
            underGrnNote: poTrackingForm.underGrnNote ?? null,
            grnCompleteAt: poTrackingForm.grnCompleteAt ?? null,
            grnCompleteNote: poTrackingForm.grnCompleteNote ?? null,
          });
          if (!res.success) {
            addToast('error', typeof res.error === 'string' ? res.error : (res.error?.message ?? 'Failed to save tracking'));
            return;
          }
          await queryClient.invalidateQueries({ queryKey: ['po-tracking', po.backendPoId] });
          await queryClient.refetchQueries({ queryKey: ['po-tracking', po.backendPoId] });
          addToast('success', 'Tracking updated');
        };

        const handleSaveRequestLink = async () => {
          if (!po.backendPoId || !po.requestId || !po.requestCode) return;
          const res = await updatePurchaseOrder(po.backendPoId, {
            formData: { requestId: po.requestId, requestCode: po.requestCode },
          });
          if (!res.success) {
            addToast('error', typeof res.error === 'string' ? res.error : (res.error?.message ?? 'Failed to save request link'));
            return;
          }
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
          addToast('success', 'Request link saved. Mark Delivered at WH and timeline will use this PO.');
        };

        return (
          <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedPO(null)}>
            <div className="flex-1 bg-black/20" />
            <div
              className="w-full sm:w-96 lg:w-120 max-w-[100vw] bg-white border-l border-blue-200 shadow-2xl overflow-y-auto flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white border-b border-blue-200 px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 font-mono mb-1">{po.requestCode ?? po.id}</p>
                  <h2 className="text-lg font-bold font-archivo text-slate-900 leading-tight">
                    {po.poNumber} – {po.vendorName}
                  </h2>
                  <div className="mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${poStatusColor2[po.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {po.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPO(null)}
                  className="text-slate-400 hover:text-slate-700 text-xl leading-none mt-1 transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 px-5 py-4 space-y-5">
                {/* PO Summary */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-200 text-sm">
                  {[
                    { label: 'PO Number', value: po.poNumber },
                    { label: 'Vendor', value: po.vendorName },
                    { label: 'Contact', value: po.contactPerson ?? '—' },
                    { label: 'PO Date', value: new Date(po.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' }) },
                    { label: 'Total Value', value: `₹${po.value.toLocaleString('en-IN')}`, bold: true },
                    { label: 'ETA', value: `${po.etaDays} days`, highlight: po.etaDays <= 3 },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-2">
                      <span className="text-slate-500">{row.label}</span>
                      <span className={`font-medium ${
                        row.highlight ? 'text-rose-600' : row.bold ? 'text-yellow-700 font-bold' : 'text-slate-800'
                      }`}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Items */}
                {po.items && po.items.length > 0 && (
                  <div>
                    <p className="text-[10px] tracking-[0.14em] text-slate-500 uppercase mb-2">Items ({po.itemCount})</p>
                    <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                      {po.items.map((item, idx) => (
                        <div key={idx} className="px-4 py-2 text-sm text-slate-800 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Timeline (from API when PO is linked to backend) */}
                {!po.backendPoId && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    PO not linked to backend — create and release the PO from Draft POs to see and update the status timeline.
                  </p>
                )}
                {/* Save request link (for existing POs released before form_data was stored) */}
                {po.backendPoId && po.requestId && po.requestCode && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] tracking-[0.14em] text-slate-500 uppercase mb-2">Existing PO?</p>
                    <p className="text-xs text-slate-600 mb-2">
                      If this PO was released before the link was saved, save the request link so &quot;Mark Delivered at WH&quot; and the timeline stay correct.
                    </p>
                    <button
                      type="button"
                      onClick={handleSaveRequestLink}
                      className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50"
                    >
                      Save request link
                    </button>
                  </div>
                )}
                {po.backendPoId && timelineSteps.length > 0 && (
                  <div>
                    <p className="text-[10px] tracking-[0.14em] text-slate-500 uppercase mb-3">Status Timeline (PO Released &gt; Advance Paid &gt; Vendor Confirmed &gt; Shipped &gt; Delivered &gt; Under GRN &gt; GRN Complete)</p>
                    <div className="relative pl-12 space-y-6">
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
                      {timelineSteps.map((step, idx) => (
                        <div key={idx} className="relative">
                          <div className={`absolute -left-8 top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm z-10 ${
                            step.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-slate-300'
                          }`}>
                            {step.done ? 'Done' : ''}
                          </div>
                          <div className="pb-1">
                            <p className={`text-sm font-bold ${step.done ? 'text-slate-900' : 'text-slate-400'}`}>{step.stage}</p>
                            {step.timestamp && <p className="text-[11px] text-slate-500 mt-0.5">{step.timestamp}</p>}
                            {step.note && <p className="text-xs text-slate-600 mt-1 leading-relaxed">{step.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Update tracking form (when PO is linked to backend) */}
                {po.backendPoId && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                    <p className="text-[10px] tracking-[0.14em] text-slate-600 uppercase font-semibold mb-2">Update status</p>
                    {[
                      { label: 'PO Released', at: 'poReleasedAt', note: 'poReleasedNote' },
                      { label: 'Advance Paid', at: 'advancePaidAt', note: 'advancePaidNote' },
                      { label: 'Vendor Confirmed', at: 'vendorConfirmedAt', note: 'vendorConfirmedNote' },
                      { label: 'Shipped', at: 'shippedAt', note: 'shippedNote' },
                      { label: 'Delivered', at: 'deliveredAt', note: 'deliveredNote' },
                      { label: 'Under GRN', at: 'underGrnAt', note: 'underGrnNote' },
                      { label: 'GRN Complete', at: 'grnCompleteAt', note: 'grnCompleteNote' },
                    ].map(({ label, at, note }) => (
                      <div key={at} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center text-sm">
                        <span className="text-slate-700 font-medium">{label}</span>
                        <input
                          type="date"
                          value={(poTrackingForm[at as keyof PoTrackingRecord] as string) ?? ''}
                          onChange={(e) => setPoTrackingForm((f) => ({ ...f, [at]: e.target.value || undefined }))}
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Note"
                          value={(poTrackingForm[note as keyof PoTrackingRecord] as string) ?? ''}
                          onChange={(e) => setPoTrackingForm((f) => ({ ...f, [note]: e.target.value || undefined }))}
                          className="rounded border border-slate-300 px-2 py-1 text-xs min-w-0"
                        />
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-slate-600 text-sm">LR / Tracking ref</span>
                      <input
                        type="text"
                        placeholder="e.g. LR123456"
                        value={poTrackingForm.orderTrackingRef ?? ''}
                        onChange={(e) => setPoTrackingForm((f) => ({ ...f, orderTrackingRef: e.target.value || undefined }))}
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <button
                      onClick={handleSaveTracking}
                      className="mt-2 w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                    >
                      Save tracking
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-blue-200 px-5 py-3 flex items-center justify-end gap-2">
                {po.backendPoId && (
                  <button
                    onClick={() => { setSelectedPO(null); applyRouteState('Procurement', 'GRN Monitor'); }}
                    className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 transition"
                  >
                    Open GRN Monitor
                  </button>
                )}
                <button
                  onClick={() => setSelectedPO(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── GRN Detail Side Panel ── */}
      {selectedGrn && (() => {
        const grn = selectedGrn;
        const primaryStatus = grn.lines[0]?.status ?? 'Pending GRN';

        return (
          <div className="fixed inset-0 z-40 flex" onClick={() => setSelectedGrn(null)}>
            <div className="flex-1 bg-black/20" />
            <div
              className="w-full sm:w-96 lg:w-120 max-w-[100vw] bg-white border-l border-blue-200 shadow-2xl overflow-y-auto flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white border-b border-blue-200 px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 font-mono mb-1">{grn.poRef}</p>
                  <h2 className="text-lg font-bold font-archivo text-slate-900 leading-tight">
                    GRN – {grn.grnRef}
                  </h2>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-emerald-300 bg-emerald-50 text-[10px] font-semibold text-emerald-700">
                      {primaryStatus}
                    </span>
                    <span className="text-[11px] text-slate-500">QC By&nbsp;<span className="font-semibold text-slate-800">Meera QC</span></span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGrn(null)}
                  className="text-slate-400 hover:text-slate-700 text-xl leading-none mt-1 transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 px-5 py-4 space-y-5 text-sm">
                {/* GRN Summary */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-200">
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-slate-500">PO Number</span>
                    <span className="font-mono text-xs text-sky-700">{grn.poRef}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-slate-500">Vendor</span>
                    <span className="font-medium text-slate-800">{grn.vendor}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-slate-500">GRN Status</span>
                    <span className="font-medium text-emerald-700">{primaryStatus}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-slate-500">QC By</span>
                    <span className="font-medium text-slate-800">Meera QC</span>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <p className="text-[10px] tracking-[0.14em] text-slate-500 uppercase mb-2">Items ({grn.lines.length})</p>
                  <div className="space-y-3">
                    {grn.lines.map((line, idx) => (
                      <div
                        key={`${line.itemCode}-${idx}`}
                        className="rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-bold text-sm text-slate-900">{line.itemName}</p>
                            <p className="text-[10px] text-slate-500">{line.itemCode}</p>
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-semibold">
                            {line.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span>
                            Ordered: <strong className="text-slate-900">{line.orderedQty}</strong>
                          </span>
                          <span>
                            Received: <strong className="text-slate-900">{line.receivedQty}</strong>
                          </span>
                          <span>
                            QC Pass: <strong className="text-emerald-600">{line.qcPass}</strong>
                          </span>
                          <span>
                            QC Fail: <strong className="text-rose-500">{line.qcFail}</strong>
                          </span>
                          <span>
                            Received Date:{' '}
                            <strong className="text-slate-900">
                              {new Date(line.receivedDate).toLocaleDateString('en-IN')}
                            </strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-blue-200 px-5 py-3 flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedGrn(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Draft PO Detail Side Panel ── */}
      {selectedDraftPO && (() => {
        const dpo = selectedDraftPO;

        return (
          <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedDraftPO(null)}>
            <div className="flex-1 bg-black/20" />
            <div
              className="w-full sm:w-96 lg:w-120 max-w-[100vw] bg-white border-l border-blue-200 shadow-2xl overflow-y-auto flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white border-b border-blue-200 px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 font-mono mb-1">{dpo.requestCode}</p>
                  <h2 className="text-lg font-bold font-archivo text-slate-900 leading-tight">
                    {dpo.dpoNumber}
                  </h2>
                  <div className="mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${
                      dpo.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                    }`}>
                      {dpo.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDraftPO(null)}
                  className="text-slate-400 hover:text-slate-700 text-xl leading-none mt-1 transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 px-5 py-4 space-y-5">
                {/* DPO Summary */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-200 text-sm">
                  {[
                    { label: 'Vendor', value: dpo.vendor },
                    { label: 'Created', value: new Date(dpo.createdDate).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' }) },
                    { label: 'Payment Terms', value: dpo.paymentTerms },
                    { label: 'Expected Delivery', value: new Date(dpo.expectedDelivery).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' }) },
                    { label: 'Grand Total', value: `₹${dpo.grandTotal.toLocaleString('en-IN')}`, bold: true },
                    { label: 'Status', value: dpo.status, highlight: dpo.status === 'Pending Approval' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-2">
                      <span className="text-slate-500">{row.label}</span>
                      <span className={`font-medium ${
                        row.highlight ? 'text-yellow-700' : row.bold ? 'text-yellow-700 font-bold' : 'text-slate-800'
                      }`}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Alert */}
                {dpo.alertMessage && (
                  <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
                    dpo.alertType === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    <span>{dpo.alertType === 'warning' ? '!' : '-'}</span>
                    <span>{dpo.alertMessage}</span>
                  </div>
                )}

                {/* Line Items */}
                <div>
                  <p className="text-[10px] tracking-[0.14em] text-slate-500 uppercase mb-2">Line Items</p>
                  <div className="space-y-2">
                    {dpo.lineItems.map((line, idx) => (
                      <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-bold text-sm text-slate-900">{line.item}</p>
                            <p className="text-[10px] text-slate-500">{line.itemCode}</p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${requestTypeClass[line.type]}`}>{line.type}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span>Qty: <strong className="text-yellow-700">{line.qty}</strong></span>
                          <span>Price: <strong className="text-slate-900">₹{line.pricePerUnit}</strong></span>
                          <span>GST: <strong className="text-slate-900">{line.gstPercent}%</strong></span>
                          <span>Total: <strong className="text-slate-900">₹{line.lineTotal.toLocaleString('en-IN')}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-medium text-slate-800">₹{dpo.subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">GST Total</span>
                    <span className="font-medium text-slate-800">₹{dpo.gstTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-yellow-700 font-bold">Grand Total</span>
                    <span className="text-yellow-700 font-bold text-lg">₹{dpo.grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-blue-200 px-5 py-3 flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditDraftPOTarget(dpo)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Edit
                </button>
                {dpo.status === 'Pending Approval' && (
                  <button
                    onClick={() => {
                      approveDraftPO(dpo.id);
                      setSelectedDraftPO(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition"
                  >
                    Approve
                  </button>
                )}
                {dpo.status === 'Approved' && (
                  <>
                    <button
                      onClick={() => {
                        openReleasePOModal(dpo.id);
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition"
                    >
                      Release PO to Vendor
                    </button>
                    <button
                      onClick={() => splitDraftPO(dpo.id)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                    >
                      Split PO
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedDraftPO(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Split PO Modal ── */}
      {splitPOTarget && (() => {
        const selectedCount = splitSelectedLineIndexes.length;
        const remainingCount = splitPOTarget.lineItems.length - selectedCount;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeSplitPOModal}>
            <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" />
            <div
              className="relative w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                <h3 className="text-lg font-bold text-slate-100">Split PO — {splitPOTarget.dpoNumber}</h3>
                <button
                  onClick={closeSplitPOModal}
                  className="w-7 h-7 rounded-md border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                <p className="text-xs text-slate-400">Select items for each split PO. Unchecked items will remain in a new separate PO.</p>

                <p className="text-[10px] tracking-widest text-slate-500 uppercase">Items — Check for PO 1</p>
                <div className="space-y-2">
                  {splitPOTarget.lineItems.map((line, index) => {
                    const checked = splitSelectedLineIndexes.includes(index);
                    return (
                      <label
                        key={`${line.itemCode}-${index}`}
                        className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSplitLineSelection(index)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-400 focus:ring-amber-400"
                        />
                        <div className="leading-tight">
                          <p className="text-sm font-semibold text-slate-100">{line.item}</p>
                          <p className="text-xs text-slate-500">{line.qty} · ₹{line.lineTotal.toLocaleString('en-IN')}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  Two POs will be created. You can release them independently to the same or different vendors.
                  <span className="ml-2 text-amber-200">({selectedCount} item(s) in PO 1, {remainingCount} item(s) in PO 2)</span>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  onClick={submitSplitPO}
                  className="px-4 py-2 rounded-lg bg-amber-400 text-slate-900 text-sm font-bold hover:bg-amber-500 transition"
                >
                  Split PO
                </button>
                <button
                  onClick={closeSplitPOModal}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-900 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Release PO Modal ── */}
      {releasePOTarget && (() => (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeReleasePOModal}>
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" />
          <div
            className="relative w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-slate-100">Release PO — {releasePOTarget.dpoNumber}</h3>
              <button
                onClick={closeReleasePOModal}
                className="w-7 h-7 rounded-md border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                You are about to release a PO to <span className="font-bold">{releasePOTarget.vendor}</span> for <span className="font-bold">₹{releasePOTarget.grandTotal.toLocaleString('en-IN')}</span>.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] tracking-widest uppercase text-slate-500 mb-1">PO Number</label>
                  <input
                    value={releasePOTarget.dpoNumber}
                    readOnly
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-widest uppercase text-slate-500 mb-1">Release Method</label>
                  <select
                    value={releaseMethod}
                    onChange={(event) => setReleaseMethod(event.target.value as 'Email + Portal' | 'Email only' | 'Portal only' | 'WhatsApp + Email')}
                    className="w-full rounded-lg border border-amber-400/50 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="Email + Portal">Email + Portal</option>
                    <option value="Email only">Email only</option>
                    <option value="Portal only">Portal only</option>
                    <option value="WhatsApp + Email">WhatsApp + Email</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest uppercase text-slate-500 mb-1">Release Notes</label>
                <textarea
                  value={releaseNotes}
                  onChange={(event) => setReleaseNotes(event.target.value)}
                  rows={3}
                  placeholder="e.g. Advance invoice to be raised immediately"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <p className="font-semibold mb-1">Items in this PO:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {releasePOTarget.lineItems.map((line, index) => (
                    <li key={`${line.itemCode}-${index}`}>
                      {line.item}: {line.qty} @ ₹{line.pricePerUnit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={submitReleasePO}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition"
              >
                Release PO
              </button>
              <button
                onClick={closeReleasePOModal}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-900 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ))()}

      {/* ── Request Detail Side Panel ── */}
      {selectedRequest && (() => {
        const req = selectedRequest;
        const reqQuotes = quotes.filter(q => q.requestId === req.id);
        const confirmedQuote = reqQuotes.find(q => q.status === 'Confirmed');
        const canDraftPO = req.status === 'Quoted' || req.status === 'New';
        const canReleasePO = req.status === 'PO Draft';

        return (
          <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedRequest(null)}>
            {/* Backdrop */}
            <div className="flex-1 bg-black/20 backdrop-blur-sm" />

            {/* Panel */}
            <div
              className="w-full max-w-xl bg-white border-l border-blue-200 shadow-2xl overflow-y-auto flex flex-col animate-slide-in-right"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-linear-to-r from-blue-50 via-cyan-50 to-blue-50 border-b border-blue-200 px-6 py-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">
                    {req.code} — {req.description ?? req.items[0]?.toUpperCase()}
                  </h2>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="text-slate-400 hover:text-slate-700 text-2xl leading-none transition-colors"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-md font-bold border ${
                    req.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' :
                    req.priority === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                    'bg-slate-50 text-slate-700 border-slate-200'
                  }`}>{req.priority}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-md font-bold border ${
                    req.status === 'New' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    req.status === 'Quoted' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                    req.status === 'PO Draft' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    req.status === 'PO Released' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    'bg-slate-50 text-slate-700 border-slate-200'
                  }`}>{req.status}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-md font-bold border ${
                    req.type === 'RM' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-violet-50 text-violet-700 border-violet-200'
                  }`}>{req.type}</span>
                </div>
              </div>

              <div className="flex-1 px-6 py-5 space-y-5 bg-slate-50">
                {/* Request Metadata */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-slate-200">
                    <span className="text-slate-600">Request Date</span>
                    <span className="text-slate-900 font-medium">
                      {req.createdDate ? new Date(req.createdDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' }) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-200">
                    <span className="text-slate-600">Requested By</span>
                    <span className="text-slate-900 font-medium">{req.requestedBy ?? 'Planning Team'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-200">
                    <span className="text-slate-600">Required Date</span>
                    <span className="text-amber-600 font-bold">
                      {new Date(req.dueDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-200">
                    <span className="text-slate-600">Source</span>
                    <span className="text-slate-900 font-medium">{req.source ?? 'Planning Team'}</span>
                  </div>
                  {req.preferredVendor && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-200">
                      <span className="text-slate-600">Preferred vendor</span>
                      <span className="text-slate-900 font-medium">{req.preferredVendor}</span>
                    </div>
                  )}
                </div>

                {/* Items Requested - Detailed */}
                {req.itemDetails && req.itemDetails.length > 0 ? (
                  <div>
                    <h3 className="text-xs tracking-wider text-slate-600 uppercase mb-3 font-bold">Items Requested</h3>
                    <div className="space-y-4">
                      {req.itemDetails.map((item, _idx) => (
                        <div key={item.itemCode} className="bg-white rounded-lg border border-blue-200 overflow-hidden shadow-sm">
                          {/* Item Header */}
                          <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h4 className="font-bold text-slate-900 text-sm">{item.itemName}</h4>
                              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">{item.itemCode}</span>
                            </div>
                          </div>
                          
                          {/* Item Details Grid */}
                          <div className="px-4 py-3">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                              <div>
                                <p className="text-slate-500 uppercase tracking-wide mb-1">Req Qty</p>
                                <p className="text-slate-900 font-bold">{item.reqQty} {item.unit}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase tracking-wide mb-1">MOQ</p>
                                <p className="text-slate-900 font-bold">{item.moq}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase tracking-wide mb-1">Pack Size</p>
                                <p className="text-slate-900 font-bold">{item.packSize}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase tracking-wide mb-1">Planned Price/Unit</p>
                                <p className="text-emerald-600 font-bold">₹{item.plannedPrice}/{item.unit}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase tracking-wide mb-1">Est. Value</p>
                                <p className="text-amber-600 font-bold">₹{item.estValue.toLocaleString('en-IN')}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 uppercase tracking-wide mb-1">Lead (D)</p>
                                <p className="text-slate-900 font-bold">{item.leadTimeDays}d</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : req.items && req.items.length > 0 && (
                  /* Items Requested - Simple */
                  <div>
                    <h3 className="text-xs tracking-wider text-slate-600 uppercase mb-3 font-bold">Items Requested</h3>
                    <div className="space-y-3">
                      {req.items.map((itemName, idx) => {
                        const qty = req.quantities?.[idx] ?? 0;
                        const price = req.plannedPrices?.[idx] ?? 0;
                        const unit = req.units?.[idx] ?? 'KG';
                        const spec = req.specifications?.[idx];
                        const sub = qty * price;
                        return (
                          <div key={idx} className="bg-white border border-blue-200 rounded-lg p-4 space-y-2 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-900 font-semibold text-sm">{itemName}</p>
                                {spec && (
                                  <p className="text-slate-600 text-xs mt-1 wrap-break-word">{spec}</p>
                                )}
                              </div>
                              <span className="text-slate-900 font-bold text-sm whitespace-nowrap">₹{sub.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-600">Req Qty:</span>
                                <span className="text-slate-900 font-medium">{qty} {unit}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-600">Planned Price:</span>
                                <span className="text-emerald-600 font-medium">₹{price.toLocaleString('en-IN')}/{unit}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Total */}
                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-sm bg-white rounded-lg p-3 shadow-sm">
                      <span className="text-slate-600 font-medium">Total Estimated Value</span>
                      <span className="text-slate-900 font-bold text-base">
                        ₹{req.items.reduce((sum, _, i) => {
                          const q = req.quantities?.[i] ?? 0;
                          const p = req.plannedPrices?.[i] ?? 0;
                          return sum + q * p;
                        }, 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Stock Summary */}
                {req.stockSummary && (
                  <div>
                    <h3 className="text-xs tracking-wider text-slate-600 uppercase mb-3 font-bold">Stock Summary</h3>
                    <div className="bg-white rounded-lg border border-blue-200 overflow-hidden shadow-sm">
                      {[
                        { label: 'Stock In Hand', value: req.stockSummary.stockInHand, color: req.stockSummary.stockInHand > 100 ? 'text-emerald-600' : 'text-amber-600' },
                        { label: 'Open PO Qty', value: req.stockSummary.openPOQty, color: 'text-slate-900' },
                        { label: 'In Transit', value: req.stockSummary.inTransit, color: req.stockSummary.inTransit > 0 ? 'text-cyan-600' : 'text-slate-900' },
                        { label: 'Open Orders', value: req.stockSummary.openOrders, color: req.stockSummary.openOrders > 0 ? 'text-blue-600' : 'text-slate-900' },
                      ].map((row, idx) => (
                        <div key={row.label} className={`flex items-center justify-between px-4 py-3 ${idx < 3 ? 'border-b border-slate-200' : ''}`}>
                          <span className="text-slate-600 text-sm">{row.label}</span>
                          <span className={`font-bold text-lg ${row.color}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quotations */}
                <div>
                  <h3 className="text-xs tracking-wider text-slate-600 uppercase mb-3 font-bold">
                    Quotations ({reqQuotes.length})
                  </h3>
                  {reqQuotes.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-blue-200 px-4 py-8 text-center text-sm text-slate-500">
                      No quotes received yet for this request.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reqQuotes.map(q => {
                        const qTotal = q.lines.reduce((s, l) => s + l.totalValue, 0);
                        return (
                          <div key={q.id} className={`rounded-lg border p-4 shadow-sm ${
                            q.status === 'Confirmed' 
                              ? 'border-emerald-500 bg-emerald-50' 
                              : 'border-blue-200 bg-white'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-base font-bold text-slate-900">{q.vendor}</span>
                              <span className={`text-xs px-2 py-1 rounded-md font-bold border ${
                                q.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                q.status === 'Not Selected' ? 'bg-slate-50 text-slate-600 border-slate-200' :
                                'bg-yellow-50 text-yellow-700 border-yellow-200'
                              }`}>{q.status}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-600">Terms: <span className="text-slate-900">{q.terms}</span></span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                              <span className="text-slate-600 text-sm">Total</span>
                              <span className="font-bold text-amber-600 text-lg">₹{qTotal.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Stock Check Section */}
                <div>
                  <h3 className="text-xs tracking-wider text-slate-600 uppercase mb-3 font-bold">Stock Check: SC-001</h3>
                  <div className="bg-white rounded-lg border border-blue-200 p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Assigned To</span>
                      <span className="text-slate-900 font-medium">Anand Store</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Status</span>
                      <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">Completed</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Due Date</span>
                      <span className="text-slate-900 font-medium">2026-02-12</span>
                    </div>
                    
                    {/* Alert Message */}
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="flex items-start gap-2">
                        <span className="text-amber-600 text-sm font-bold">!</span>
                        <p className="text-amber-800 text-xs leading-relaxed">
                          Quarterly replenishment for Q2 sunscreen batch plan. SOH critically low for UV-001.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="sticky bottom-0 bg-slate-50 border-t border-blue-200 px-6 py-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setEditRequestTarget(req);
                  }}
                  className="px-4 py-2 rounded-lg border border-blue-300 text-slate-700 text-sm font-semibold hover:bg-blue-50 transition"
                >
                  Edit Request
                </button>

                <div className="flex items-center gap-2">
                  {canDraftPO && confirmedQuote && (
                    <button
                      onClick={() => {
                        createDraftPO(confirmedQuote.id);
                        setSelectedRequest(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition shadow-lg"
                    >
                      Draft PO
                    </button>
                  )}

                  {canReleasePO && (() => {
                    const linkedDraft = draftPOs.find((d) => d.requestId === req.id);
                    return (
                      <button
                        onClick={() => {
                          if (linkedDraft?.backendPoId) {
                            openReleasePOModal(linkedDraft.id);
                            setSelectedRequest(null);
                          } else {
                            addToast('warning', 'Create a Draft PO from Quotations first, then release from Draft POs.');
                          }
                        }}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition shadow-lg"
                      >
                        Release PO ↗
                      </button>
                    );
                  })()}

                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-300 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Edit Procurement Request Modal ── */}
      {editRequestTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setEditRequestTarget(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl border border-slate-200 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">Edit Request — {editRequestTarget.code}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
                  <select
                    value={editRequestForm.priority}
                    onChange={(e) => setEditRequestForm((f) => ({ ...f, priority: e.target.value as RequestPriority }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Required by date</label>
                  <input
                    type="date"
                    value={editRequestForm.requiredByDate}
                    onChange={(e) => setEditRequestForm((f) => ({ ...f, requiredByDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Preferred vendor</label>
                <select
                  value={editRequestForm.preferredVendor}
                  onChange={(e) => setEditRequestForm((f) => ({ ...f, preferredVendor: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Select vendor —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea
                  value={editRequestForm.notes}
                  onChange={(e) => setEditRequestForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={editRequestForm.status}
                  onChange={(e) => setEditRequestForm((f) => ({ ...f, status: e.target.value as RequestStatus }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="New">New</option>
                  <option value="Quoted">Quoted</option>
                  <option value="PO Draft">PO Draft</option>
                  <option value="PO Released">PO Released</option>
                  <option value="Delivery Pending">Delivery Pending</option>
                </select>
              </div>
              {/* Line items: editable quantities and unit */}
              {editRequestForm.items.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Line items — quantities & unit</label>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Item</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Type</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-700">Qty to request</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editRequestForm.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2">
                              <span className="font-medium text-slate-900">{item.name ?? item.code ?? '—'}</span>
                              {item.code && <span className="text-xs text-slate-500 block">{item.code}</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-700">{item.type ?? 'RM'}</td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                value={item.quantity_requested ?? 0}
                                onChange={(e) => updateEditRequestItem(idx, { quantity_requested: parseFloat(e.target.value) || 0 })}
                                className="w-24 px-2 py-1.5 rounded border border-slate-300 text-right text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={item.unit ?? 'KG'}
                                onChange={(e) => updateEditRequestItem(idx, { unit: e.target.value })}
                                className="w-20 px-2 py-1.5 rounded border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
                              >
                                {['KG', 'PCS', 'L', 'ML', 'G', 'BOX', 'CTN'].map((u) => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setEditRequestTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!editRequestTarget) return;
                  const payload: Parameters<typeof updateProcurementRequestApi>[1] = {
                    priority: editRequestForm.priority,
                    requiredByDate: editRequestForm.requiredByDate || null,
                    notes: editRequestForm.notes ?? null,
                    status: editRequestForm.status,
                  };
                  if (editRequestForm.preferredVendor?.trim()) payload.preferredVendor = editRequestForm.preferredVendor.trim();
                  if (Array.isArray(editRequestForm.items) && editRequestForm.items.length > 0) payload.items = editRequestForm.items;
                  const res = await updateProcurementRequestApi(editRequestTarget.id, payload);
                  if (!res.success) {
                    addToast('error', typeof res.error === 'string' ? res.error : (res.error?.message ?? 'Failed to update request'));
                    return;
                  }
                  queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                  setEditRequestTarget(null);
                  addToast('success', `Request ${editRequestTarget.code} updated`);
                  const reqId = editRequestTarget.id;
                  const reqCode = editRequestTarget.code;
                  const reqType = editRequestTarget.type;
                  const confirmedQuote = quotes.find((q) => q.requestId === reqId && q.status === 'Confirmed');
                  if (confirmedQuote) {
                    await createDraftPO(confirmedQuote.id);
                    setSelectedRequest(null);
                  } else {
                    const raised = await createDraftPOFromRequest(
                      reqId,
                      reqCode,
                      editRequestForm.items,
                      editRequestForm.preferredVendor ?? '',
                      reqType
                    );
                    if (raised) {
                      applyRouteState('Procurement', 'Draft POs');
                      setSelectedRequest(null);
                    }
                  }
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Draft PO Modal ── */}
      {editDraftPOTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setEditDraftPOTarget(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">Edit Draft PO — {editDraftPOTarget.dpoNumber}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Vendor</label>
                <select
                  value={editDraftPOForm.vendor}
                  onChange={(e) => setEditDraftPOForm((f) => ({ ...f, vendor: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Select vendor —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment terms</label>
                <input
                  type="text"
                  value={editDraftPOForm.paymentTerms}
                  onChange={(e) => setEditDraftPOForm((f) => ({ ...f, paymentTerms: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expected delivery</label>
                <input
                  type="date"
                  value={editDraftPOForm.expectedDelivery}
                  onChange={(e) => setEditDraftPOForm((f) => ({ ...f, expectedDelivery: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Delivery address</label>
                <textarea
                  value={editDraftPOForm.deliveryAddress}
                  onChange={(e) => setEditDraftPOForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-600 mb-2">Line items</span>
                <div className="space-y-2">
                  {editDraftPOForm.lineItems.map((line, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                      <span className="font-medium text-slate-800 min-w-[120px] truncate">{line.item}</span>
                      <input
                        type="text"
                        placeholder="Qty"
                        value={line.qty}
                        onChange={(e) => {
                          const qtyStr = e.target.value;
                          const qty = parseFloat(String(qtyStr).replace(/[^\d.]/g, '')) || 0;
                          const price = editDraftPOForm.lineItems[idx].pricePerUnit ?? 0;
                          const gstPct = editDraftPOForm.lineItems[idx].gstPercent ?? 18;
                          const subtotal = qty * price;
                          const gstAmount = parseFloat((subtotal * (gstPct / 100)).toFixed(2));
                          const lineTotal = parseFloat((subtotal + gstAmount).toFixed(2));
                          const next = editDraftPOForm.lineItems.map((l, i) =>
                            i === idx ? { ...l, qty: qtyStr, gstAmount, lineTotal } : l
                          ) as DraftPOLineItem[];
                          setEditDraftPOForm((f) => ({ ...f, lineItems: next }));
                        }}
                        className="w-20 rounded border border-slate-300 px-2 py-1"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={line.pricePerUnit}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          const qty = parseFloat(String(editDraftPOForm.lineItems[idx].qty).replace(/[^\d.]/g, '')) || 0;
                          const gstPct = editDraftPOForm.lineItems[idx].gstPercent ?? 18;
                          const subtotal = qty * v;
                          const gstAmount = parseFloat((subtotal * (gstPct / 100)).toFixed(2));
                          const lineTotal = parseFloat((subtotal + gstAmount).toFixed(2));
                          const next = editDraftPOForm.lineItems.map((l, i) =>
                            i === idx ? { ...l, pricePerUnit: v, gstAmount, lineTotal } : l
                          ) as DraftPOLineItem[];
                          setEditDraftPOForm((f) => ({ ...f, lineItems: next }));
                        }}
                        className="w-24 rounded border border-slate-300 px-2 py-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditDraftPOTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!editDraftPOTarget) return;
                  const d = editDraftPOTarget;
                  const form = editDraftPOForm;
                  if (d.backendPoId) {
                    const payload = {
                      vendorName: form.vendor,
                      paymentTerms: form.paymentTerms || undefined,
                      expectedShipmentDate: form.expectedDelivery || undefined,
                      items: form.lineItems.map((l) => ({ itemName: l.item, quantity: l.qty, rate: String(l.pricePerUnit), tax: String(l.gstPercent ?? 18) })),
                    };
                    const res = await updatePurchaseOrder(d.backendPoId, payload);
                    if (!res.success) {
                      addToast('error', typeof res.error === 'string' ? res.error : (res.error?.message ?? 'Failed to update draft PO'));
                      return;
                    }
                  }
                  setDraftPOs((prev) =>
                    prev.map((po) =>
                      po.id === d.id
                        ? {
                            ...po,
                            vendor: form.vendor,
                            paymentTerms: form.paymentTerms,
                            expectedDelivery: form.expectedDelivery,
                            deliveryAddress: form.deliveryAddress,
                            lineItems: form.lineItems,
                            subtotal: form.lineItems.reduce((s, l) => s + (l.lineTotal - (l.gstAmount ?? 0)), 0),
                            gstTotal: form.lineItems.reduce((s, l) => s + (l.gstAmount ?? 0), 0),
                            grandTotal: form.lineItems.reduce((s, l) => s + l.lineTotal, 0),
                          }
                        : po
                    )
                  );
                  queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
                  setEditDraftPOTarget(null);
                  addToast('success', `Draft PO ${d.dpoNumber} updated`);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stock Check Side Panel ── */}
      {selectedStockCheckRequest && (() => {
        const req = selectedStockCheckRequest;
        const updatesForRequest = stockCheckUpdates[req.id] ?? {};
        const nonLowPriorityRequests = requests.filter((request) => request.priority !== 'Low');
        const scIndex = nonLowPriorityRequests.findIndex((request) => request.id === req.id);
        const scId = scIndex >= 0 ? `SC-${String(scIndex + 1).padStart(3, '0')}` : 'SC-000';

        const assignedTo =
          req.requestedBy ||
          (req.type === 'RM'
            ? 'Anand Store'
            : 'Ravi Kumar');

        const createdDate = req.createdDate ?? '2026-02-10';
        const dueDate = req.dueDate ?? '2026-02-16';

        const effectiveStatus: StockCheckStatus = stockCheckStatuses[req.id] ?? deriveStockCheckStatusForRequest(req);

        const statusPillClass =
          effectiveStatus === 'Completed'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
            : effectiveStatus === 'In Progress'
            ? 'bg-sky-50 text-sky-700 border-sky-300'
            : 'bg-amber-50 text-amber-700 border-amber-300';

        const stockItems = req.itemDetails && req.itemDetails.length > 0
          ? req.itemDetails.map((item, idx) => ({
              itemName: item.itemName,
              itemCode: item.itemCode,
              systemQty: item.reqQty,
              physicalQty: (() => {
                const override = item.itemCode ? updatesForRequest[item.itemCode] : undefined;
                return override?.physicalQty ?? item.reqQty;
              })(),
              zoneRack: (() => {
                const override = item.itemCode ? updatesForRequest[item.itemCode] : undefined;
                const defaultZone = req.type === 'RM' ? 'LOC-RM' : 'LOC-PM';
                const defaultRack = `A1-L1-S${idx + 2}`;
                const zone = override?.zone ?? defaultZone;
                const rack = override?.rack ?? defaultRack;
                return `${zone} · ${rack}`;
              })(),
              batchCode: `BTH-${item.itemCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-6)}-${String(idx + 1).padStart(2, '0')}`,
              expiry: `2027-0${(idx % 3) + 6}-3${idx}`,
            }))
          : req.items.map((itemName, idx) => ({
              itemName,
              itemCode: `EI-${req.type}-${itemName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || String(idx + 1).padStart(3, '0')}`,
              systemQty: req.quantities?.[idx] ?? 0,
              physicalQty: (() => {
                const generatedCodeBase =
                  itemName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) ||
                  String(idx + 1).padStart(3, '0');
                const itemCode = `EI-${req.type}-${generatedCodeBase}`;
                const override = updatesForRequest[itemCode];
                const baseQty = req.quantities?.[idx] ?? 0;
                return override?.physicalQty ?? baseQty;
              })(),
              zoneRack: (() => {
                const generatedCodeBase =
                  itemName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) ||
                  String(idx + 1).padStart(3, '0');
                const itemCode = `EI-${req.type}-${generatedCodeBase}`;
                const override = updatesForRequest[itemCode];
                const defaultZone = req.type === 'RM' ? 'LOC-RM' : 'LOC-PM';
                const defaultRack = `A1-L1-S${idx + 2}`;
                const zone = override?.zone ?? defaultZone;
                const rack = override?.rack ?? defaultRack;
                return `${zone} · ${rack}`;
              })(),
              batchCode: `BTH-${itemName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'ITEM'}-${String(idx + 1).padStart(3, '0')}`,
              expiry: `2027-0${(idx % 3) + 6}-3${idx}`,
            }));
        const displayStockItems = selectedStockCheckItemName
          ? stockItems.filter(item => item.itemName === selectedStockCheckItemName)
          : stockItems;
        const hasFocusedItem = displayStockItems.length > 0;
        const renderedItems = hasFocusedItem ? displayStockItems : stockItems;

        return (
          <div
            className="fixed inset-0 z-50 flex"
            onClick={() => {
              setSelectedStockCheckRequest(null);
              setSelectedStockCheckItemName(null);
            }}
          >
            <div className="flex-1 bg-black/25 backdrop-blur-[1px]" />
            <div
              className="w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl overflow-y-auto flex flex-col animate-slide-in-right"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 border-b border-slate-200 px-5 py-4 bg-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-300 bg-white font-mono text-[11px] text-slate-700">
                      {scId}
                    </span>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Stock Check {selectedStockCheckItemName ? `· ${selectedStockCheckItemName}` : ''}
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedStockCheckRequest(null);
                      setSelectedStockCheckItemName(null);
                    }}
                    className="text-slate-400 hover:text-slate-700 text-xl leading-none transition-colors"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="flex-1 px-4 py-4 space-y-3 bg-slate-50">
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Assigned To</span>
                    <span className="text-slate-900 font-semibold">{assignedTo}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Created</span>
                    <span className="text-slate-900 font-semibold">{createdDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Due Date</span>
                    <span className="text-slate-900 font-semibold">{dueDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status</span>
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${statusPillClass}`}>
                      {effectiveStatus}
                    </span>
                  </div>
                </div>

                {renderedItems.map((item, idx) => (
                  <div
                    key={`${item.itemCode}-${idx}`}
                    className="rounded-lg border border-slate-200 bg-white overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-2">
                        <p className="text-slate-900 font-semibold text-sm">{item.itemName}</p>
                        <span className="text-[10px] text-slate-500">{item.itemCode}</span>
                      </div>
                    </div>
                    <div className="px-4 py-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Zone/Rack</span>
                        <span className="text-slate-900 font-semibold">{item.zoneRack}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">System Qty</span>
                        <span className="text-emerald-700 font-bold">{item.systemQty}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Physical Qty</span>
                        <span className="text-sky-700 font-bold">{item.physicalQty}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Variance</span>
                        <span className="text-amber-700 font-bold">{Math.max(0, item.physicalQty - item.systemQty)}</span>
                      </div>

                      <div className="pt-2 border-t border-slate-200 mt-2">
                        <p className="text-[10px] tracking-wide text-slate-500 uppercase mb-1">Batch Details</p>
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 font-mono">
                            {item.batchCode}
                          </span>
                          <span className="text-slate-800 font-semibold">{item.physicalQty} units</span>
                          <span className="text-slate-500">Exp: {item.expiry}</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                            Good
                          </span>
                          <span className="text-slate-400 ml-auto">Not verified yet</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  All {req.description ?? 'requested'} stocks verified. Batch details confirmed with COA on file.
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedStockCheckRequest(null);
                    setSelectedStockCheckItemName(null);
                  }}
                  className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold bg-white hover:bg-slate-100 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Stock Check Update Modal ── */}
      {updateStockCheckRequest && (() => {
        const req = updateStockCheckRequest;
        const nonLowPriorityRequests = requests.filter((request) => request.priority !== 'Low');
        const scIndex = nonLowPriorityRequests.findIndex((request) => request.id === req.id);
        const scId = scIndex >= 0 ? `SC-${String(scIndex + 1).padStart(3, '0')}` : 'SC-000';

        return (
          <StockCheckUpdateModal
            request={req}
            scId={scId}
            existingUpdates={stockCheckUpdates[req.id]}
            onClose={() => setUpdateStockCheckRequest(null)}
            onSave={(updates) => {
              updateProcurementState((current) => ({
                stockCheckUpdates: {
                  ...current.stockCheckUpdates,
                  [req.id]: {
                    ...(current.stockCheckUpdates[req.id] ?? {}),
                    ...updates,
                  },
                },
              }));
              setUpdateStockCheckRequest(null);
              addToast('success', `${scId} physical counts updated.`);
            }}
          />
        );
      })()}

      {/* New Request Modal */}
      {showNewRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="bg-linear-to-r from-cyan-500 via-blue-500 to-cyan-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-xl font-bold text-white tracking-tight">New Procurement Request</h2>
              <button
                onClick={closeNewRequestModal}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1.5 transition-all hover:rotate-90 duration-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form Body - Scrollable */}
            <div className="overflow-y-auto flex-1 p-6 bg-linear-to-b from-slate-50 to-white">
              <div className="space-y-5">
              {/* Row 1: Category, Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    Category *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UV FILTER, SURFACTANT"
                    value={newRequestForm.category}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, category: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    Type
                  </label>
                  <select
                    value={newRequestForm.type}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, type: e.target.value as RequestType })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                  >
                    <option value="RM">RM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Source, Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    Source
                  </label>
                  <select
                    value={newRequestForm.source}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, source: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                  >
                    <option value="Planning Team">Planning Team</option>
                    <option value="Production Team">Production Team</option>
                    <option value="Quality Team">Quality Team</option>
                    <option value="R&D Team">R&D Team</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    Priority
                  </label>
                  <select
                    value={newRequestForm.priority}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, priority: e.target.value as 'High' | 'Medium' | 'Low' })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Request Date, Required Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    Request Date *
                  </label>
                  <input
                    type="text"
                    placeholder="dd-mm-yyyy"
                    value={newRequestForm.requestDate}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, requestDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    Required Date *
                  </label>
                  <input
                    type="text"
                    placeholder="dd-mm-yyyy"
                    value={newRequestForm.requiredDate}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, requiredDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Row 4: Item Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  Item Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Homosalate"
                  value={newRequestForm.itemName}
                  onChange={(e) => setNewRequestForm({ ...newRequestForm, itemName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                />
              </div>

              {/* Row 5: Req Qty, UOM, MOQ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    Req Qty *
                  </label>
                  <input
                    type="text"
                    placeholder="100"
                    value={newRequestForm.reqQty}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, reqQty: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    UOM
                  </label>
                  <input
                    type="text"
                    placeholder="KG or pcs"
                    value={newRequestForm.uom}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, uom: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    MOQ
                  </label>
                  <input
                    type="text"
                    placeholder="25"
                    value={newRequestForm.moq}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, moq: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Row 6: Planned Price, Pack Size, Lead Time */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    Planned Price
                  </label>
                  <input
                    type="text"
                    placeholder="₹20"
                    value={newRequestForm.plannedPrice}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, plannedPrice: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    Pack Size
                  </label>
                  <input
                    type="text"
                    placeholder="25 KG drum"
                    value={newRequestForm.packSize}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, packSize: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    Lead Time (Days)
                  </label>
                  <input
                    type="text"
                    placeholder="21"
                    value={newRequestForm.leadTimeDays}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, leadTimeDays: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Row 7: Preferred Vendor */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  Preferred Vendor
                </label>
                <select
                  value={newRequestForm.preferredVendor}
                  onChange={(e) => setNewRequestForm({ ...newRequestForm, preferredVendor: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                >
                  <option value="">— None —</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.name}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 8: Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  Notes
                </label>
                <textarea
                  placeholder="Additional notes or context"
                  rows={3}
                  value={newRequestForm.notes}
                  onChange={(e) => setNewRequestForm({ ...newRequestForm, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all resize-none"
                />
              </div>

              {/* Hidden: Require Stock Check - Not in reference image */}
            </div>
            </div>

            {/* Footer */}
            <div className="bg-white px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 rounded-b-xl">
              <div className="text-xs text-slate-500">
                Fields marked with <span className="text-red-500">*</span> are required
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={closeNewRequestModal}
                  className="px-5 py-2.5 rounded-lg border-2 border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={submitNewRequest}
                  className="px-6 py-2.5 rounded-lg bg-slate-700 text-white font-bold text-sm hover:bg-slate-800 shadow-lg hover:shadow-xl transition-all"
                >
                  Create Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Procurement;


