import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import logoFull from '../assets/logo/eilogofull.svg';
import procurementData from '../data/procurement-data.json';

type RequestType = 'RM' | 'PM';
type RequestPriority = 'High' | 'Medium' | 'Low';
type RequestStatus = 'New' | 'Quoted' | 'PO Draft' | 'PO Released' | 'Delivery Pending';
type QuoteStatus = 'Confirmed' | 'Not Selected' | 'Pending Review';
type MainTab = 'Procurement' | 'Vendors' | 'Reports';
type SideSection = 'Overview' | 'Requests' | 'Quotations' | 'Draft POs' | 'Issued POs' | 'GRN Monitor' | 'Stock Check' | 'Item Tracker';

type ItemDetail = {
  itemCode: string;
  itemName: string;
  reqQty: number;
  unit: string;
  moq: string;
  packSize: string;
  plannedPrice: number;
  leadTimeDays: number;
  estValue: number;
};

type StockSummary = {
  stockInHand: number;
  openPOQty: number;
  inTransit: number;
  openOrders: number;
};

type ProcurementRequest = {
  id: string;
  code: string;
  description?: string;
  type: RequestType;
  priority: RequestPriority;
  status: RequestStatus;
  items: string[];
  quantities?: number[];
  plannedPrices?: number[];
  units?: string[];
  specifications?: string[];
  dueDate: string;
  createdDate?: string;
  requestedBy?: string;
  source?: string;
  itemDetails?: ItemDetail[];
  stockSummary?: StockSummary;
};

type QuoteLine = {
  item: string;
  qty: string;
  pricePerUnit: number;
  totalValue: number;
  vsPlanned: string;
};

type VendorQuote = {
  id: string;
  requestId: string;
  requestCode: string;
  requestType: RequestType;
  vendor: string;
  status: QuoteStatus;
  quotedOn: string;
  leadTimeDays: number;
  terms: string;
  validTill: string;
  rating: number;
  fileName: string;
  note: string;
  lines: QuoteLine[];
};

type Vendor = {
  id: string;
  vendorCode: string;
  name: string;
  type: RequestType;
  status: string;
  rating: number;
  confirmedQuotes: number;
  posIssued: number;
  avgLeadTime: number;
  paymentTerms: string;
  contact: string;
  email: string;
  phone: string;
  city: string;
};

type DraftPOLineItem = {
  item: string;
  itemCode: string;
  type: RequestType;
  qty: string;
  pricePerUnit: number;
  gstPercent: number;
  gstAmount: number;
  lineTotal: number;
};

type DraftPO = {
  id: string;
  dpoNumber: string;
  requestId: string;
  requestCode: string;
  type: RequestType;
  vendor: string;
  vendorId: string;
  status: string;
  createdDate: string;
  createdBy: string;
  paymentTerms: string;
  expectedDelivery: string;
  deliveryAddress: string;
  vendorRating: number;
  alertMessage: string;
  alertType: string;
  lineItems: DraftPOLineItem[];
  subtotal: number;
  gstTotal: number;
  grandTotal: number;
};

type POTimelineStep = {
  stage: string;
  done: boolean;
  timestamp: string | null;
  actor: string | null;
  note: string | null;
};

type PurchaseOrder = {
  id: string;
  vendorId: string;
  vendorName: string;
  poNumber: string;
  itemCount: number;
  value: number;
  date: string;
  status: string;
  etaDays: number;
  items?: string[];
  requestCode?: string;
  contactPerson?: string;
  timeline?: POTimelineStep[];
};

type CompletedGrnLine = {
  itemName: string;
  itemCode: string;
  orderedQty: string;
  receivedQty: string;
  qcPass: string;
  qcFail: string;
  receivedDate: string;
  status: 'Completed';
};

type CompletedGrn = {
  request: ProcurementRequest;
  vendor: string;
  poRef: string;
  grnRef: string;
  lines: CompletedGrnLine[];
};

type StockCheckStatus = 'Assigned' | 'In Progress' | 'Completed';

type PackagingCondition = 'Good' | 'Damaged' | 'Partially Damaged';

type StockCheckLineData = {
  zone: string;
  rack: string;
  physicalQty: number;
  batchNo: string;
  packagingCondition: PackagingCondition;
  remarks?: string;
};

const REQUESTS_SEED: ProcurementRequest[] = procurementData.requests as ProcurementRequest[];
const QUOTES_SEED: VendorQuote[] = procurementData.quotes as VendorQuote[];
const DRAFT_POS_SEED: DraftPO[] = (procurementData as any).draftPOs as DraftPO[];
const PROCUREMENT_LIVE_KEY = 'eiadmin.procurement.live.v1';

const MAIN_TABS: MainTab[] = ['Procurement', 'Vendors', 'Reports'];
const SIDE_SECTIONS: SideSection[] = ['Overview', 'Requests', 'Quotations', 'Draft POs', 'Issued POs', 'GRN Monitor', 'Stock Check', 'Item Tracker'];

type LiveProcurementState = {
  requests: ProcurementRequest[];
  quotes: VendorQuote[];
  draftPOs: DraftPO[];
  completedGrns: CompletedGrn[];
   stockCheckStatuses: Record<string, StockCheckStatus>;
   stockCheckUpdates: Record<string, Record<string, StockCheckLineData>>;
  updatedAt: string;
};

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
  if (typeof window === 'undefined') {
    const initialStockStatuses: Record<string, StockCheckStatus> = {};
    REQUESTS_SEED.filter((request) => request.priority !== 'Low').forEach((request) => {
      initialStockStatuses[request.id] = deriveStockCheckStatusForRequest(request);
    });

    return {
      requests: REQUESTS_SEED,
      quotes: QUOTES_SEED,
      draftPOs: DRAFT_POS_SEED,
      completedGrns: [],
      stockCheckStatuses: initialStockStatuses,
      stockCheckUpdates: {},
      updatedAt: new Date().toISOString(),
    };
  }

  const raw = window.localStorage.getItem(PROCUREMENT_LIVE_KEY);
  if (!raw) {
    const initialStockStatuses: Record<string, StockCheckStatus> = {};
    REQUESTS_SEED.filter((request) => request.priority !== 'Low').forEach((request) => {
      initialStockStatuses[request.id] = deriveStockCheckStatusForRequest(request);
    });

    return {
      requests: REQUESTS_SEED,
      quotes: QUOTES_SEED,
      draftPOs: DRAFT_POS_SEED,
      completedGrns: [],
      stockCheckStatuses: initialStockStatuses,
      stockCheckUpdates: {},
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const parsed = JSON.parse(raw) as LiveProcurementState;
    if (!parsed?.requests || !parsed?.quotes || !parsed?.draftPOs) {
      throw new Error('Invalid procurement state payload');
    }

    const derivedStockStatuses: Record<string, StockCheckStatus> = { ...parsed.stockCheckStatuses };
    parsed.requests
      .filter((request) => request.priority !== 'Low')
      .forEach((request) => {
        if (!derivedStockStatuses[request.id]) {
          derivedStockStatuses[request.id] = deriveStockCheckStatusForRequest(request);
        }
      });

    return {
      ...parsed,
      completedGrns: parsed.completedGrns ?? [],
      stockCheckStatuses: derivedStockStatuses,
      stockCheckUpdates: parsed.stockCheckUpdates ?? {},
    };
  } catch {
    const initialStockStatuses: Record<string, StockCheckStatus> = {};
    REQUESTS_SEED.filter((request) => request.priority !== 'Low').forEach((request) => {
      initialStockStatuses[request.id] = deriveStockCheckStatusForRequest(request);
    });

    return {
      requests: REQUESTS_SEED,
      quotes: QUOTES_SEED,
      draftPOs: DRAFT_POS_SEED,
      completedGrns: [],
      stockCheckStatuses: initialStockStatuses,
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
};

const priorityClass: Record<RequestPriority, string> = {
  'High': 'bg-rose-50 text-rose-700 border-rose-200',
  'Medium': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Low': 'bg-slate-50 text-slate-700 border-slate-200',
};

type StockCheckUpdateModalProps = {
  request: ProcurementRequest;
  scId: string;
  existingUpdates: Record<string, StockCheckLineData> | undefined;
  onClose: () => void;
  onSave: (updates: Record<string, StockCheckLineData>) => void;
};

const StockCheckUpdateModal: React.FC<StockCheckUpdateModalProps> = ({
  request,
  scId,
  existingUpdates,
  onClose,
  onSave,
}) => {
  const initialLines = React.useMemo(() => {
    const updatesForRequest = existingUpdates ?? {};

    const baseItems =
      (request.itemDetails && request.itemDetails.length > 0
        ? request.itemDetails.map((item, idx) => {
            const systemQty = item.reqQty;
            const itemCode = item.itemCode;
            const override = itemCode ? updatesForRequest[itemCode] : undefined;
            const defaultZone = request.type === 'RM' ? 'LOC-RM' : 'LOC-PM';
            const defaultRack = `A1-L1-S${idx + 1}`;

            return {
              itemName: item.itemName,
              itemCode,
              systemQty,
              zone: override?.zone ?? defaultZone,
              rack: override?.rack ?? defaultRack,
              physicalQty: override?.physicalQty ?? systemQty,
              batchNo: override?.batchNo ?? `BTH-${(item.itemCode || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-6) || 'ITEM'}-${
                String(idx + 1).padStart(2, '0')
              }`,
              packagingCondition: override?.packagingCondition ?? ('Good' as PackagingCondition),
            };
          })
        : request.items.map((itemName, idx) => {
            const systemQty = request.quantities?.[idx] ?? 0;
            const generatedCodeBase =
              itemName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) ||
              String(idx + 1).padStart(3, '0');
            const itemCode = `EI-${request.type}-${generatedCodeBase}`;
            const override = updatesForRequest[itemCode];
            const defaultZone = request.type === 'RM' ? 'LOC-RM' : 'LOC-PM';
            const defaultRack = `A1-L1-S${idx + 1}`;

            return {
              itemName,
              itemCode,
              systemQty,
              zone: override?.zone ?? defaultZone,
              rack: override?.rack ?? defaultRack,
              physicalQty: override?.physicalQty ?? systemQty,
              batchNo: override?.batchNo ?? `BTH-${generatedCodeBase}-${String(idx + 1).padStart(2, '0')}`,
              packagingCondition: override?.packagingCondition ?? ('Good' as PackagingCondition),
            };
          })) || [];

    return baseItems;
  }, [existingUpdates, request]);

  const [lines, setLines] = useState(
    initialLines.map((line) => ({ ...line })),
  );
  const [overallRemarks, setOverallRemarks] = useState('');

  const handleLineChange = (
    index: number,
    field: 'zone' | 'rack' | 'physicalQty' | 'batchNo' | 'packagingCondition',
    value: string,
  ) => {
    setLines((prev) => {
      const next = [...prev];
      const target = { ...next[index] } as any;
      if (field === 'physicalQty') {
        const parsed = Number(value.replace(/[^0-9.]/g, ''));
        target.physicalQty = Number.isFinite(parsed) ? parsed : 0;
      } else if (field === 'packagingCondition') {
        target.packagingCondition = value as PackagingCondition;
      } else {
        target[field] = value;
      }
      next[index] = target;
      return next;
    });
  };

  const handleSave = () => {
    const updates: Record<string, StockCheckLineData> = {};
    lines.forEach((line) => {
      if (!line.itemCode) {
        return;
      }
      updates[line.itemCode] = {
        zone: line.zone,
        rack: line.rack,
        physicalQty: line.physicalQty,
        batchNo: line.batchNo,
        packagingCondition: line.packagingCondition,
        remarks: overallRemarks || undefined,
      };
    });

    onSave(updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Update Physical Count</p>
            <h2 className="text-sm font-semibold text-slate-900 mt-1">{scId}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-slate-50">
          {lines.map((line, idx) => {
            const variance = line.physicalQty - line.systemQty;
            return (
              <div
                key={line.itemCode ?? `${line.itemName}-${idx}`}
                className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {line.itemName}{' '}
                      <span className="text-[11px] text-slate-500 font-normal">System: {line.systemQty}</span>
                    </p>in 
                    <p className="text-[11px] text-slate-500 font-mono">{line.itemCode}</p>
                  </div>
                  <p className="text-[11px] text-slate-500">Variance: <span className="font-semibold text-amber-700">{variance}</span></p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Zone</label>
                    <input
                      value={line.zone}
                      onChange={(e) => handleLineChange(idx, 'zone', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Rack / Location</label>
                    <input
                      value={line.rack}
                      onChange={(e) => handleLineChange(idx, 'rack', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                      Physical Qty Found *
                    </label>
                    <input
                      value={String(line.physicalQty)}
                      onChange={(e) => handleLineChange(idx, 'physicalQty', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Packaging Condition</label>
                    <select
                      value={line.packagingCondition}
                      onChange={(e) => handleLineChange(idx, 'packagingCondition', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                    >
                      <option value="Good">Good</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Partially Damaged">Partially Damaged</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                      Batch No (comma-sep)
                    </label>
                    <input
                      value={line.batchNo}
                      onChange={(e) => handleLineChange(idx, 'batchNo', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-2">
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Overall Remarks</label>
            <textarea
              value={overallRemarks}
              onChange={(e) => setOverallRemarks(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 resize-none"
              placeholder="Notes on discrepancies, damages, or follow-ups"
            />
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-amber-500 text-xs font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            Save Update
          </button>
        </div>
      </div>
    </div>
  );
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
  const [issuedViewMode, setIssuedViewMode] = useState<'Table' | 'Cards'>('Cards');
  const [grnCategoryFilter, setGrnCategoryFilter] = useState<'All' | RequestType>('All');
  const [grnVendorFilter, setGrnVendorFilter] = useState('All Vendors');
  const [grnStatusFilter, setGrnStatusFilter] = useState<'All' | 'Pending GRN' | 'Under GRN' | 'Completed'>('All');
  const [grnSearch, setGrnSearch] = useState('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState<'All' | RequestType>('All');
  const [stockStatusFilter, setStockStatusFilter] = useState<'All Statuses' | 'Assigned' | 'In Progress' | 'Completed'>('All Statuses');
  const [stockSearch, setStockSearch] = useState('');

  const vendors: Vendor[] = procurementData.vendors as Vendor[];
  const purchaseOrders: PurchaseOrder[] = procurementData.purchaseOrders as PurchaseOrder[];

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
        setRequests(incoming.requests ?? REQUESTS_SEED);
        setQuotes(incoming.quotes ?? QUOTES_SEED);
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
    const draftPos = requests.filter((request) => request.status === 'PO Draft').length;
    const issuedPos = requests.filter((request) => request.status === 'PO Released').length;
    const grnCount = Math.max(issuedPos, 1);
    const stockCheck = requests.filter((request) => request.priority !== 'Low').length;
    const itemTracker = new Set(requests.flatMap((request) => request.items)).size;

    return {
      Overview: requestCount,
      Requests: requestCount,
      Quotations: quotationsCount,
      'Draft POs': draftPos,
      'Issued POs': issuedPos,
      'GRN Monitor': grnCount,
      'Stock Check': stockCheck,
      'Item Tracker': itemTracker,
    };
  }, [quotes, requests]);

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
    const today = new Date('2026-02-28');

    return requests
      .filter((request) => request.status === 'PO Released' || request.status === 'Delivery Pending')
      .map((request) => {
        const linkedDraftPO = draftPOs.find((draftPo) => draftPo.requestId === request.id);
        const linkedQuote = quotes.find((quote) => quote.requestId === request.id && quote.status === 'Confirmed') ??
          quotes.find((quote) => quote.requestId === request.id);

        const etaDays = Math.ceil((new Date(request.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const computedStatus: 'Released' | 'In Transit' | 'At Risk' =
          request.status === 'Delivery Pending'
            ? 'In Transit'
            : etaDays < 0 || (request.priority === 'High' && etaDays <= 2)
            ? 'At Risk'
            : 'Released';

        const lineItems = linkedDraftPO?.lineItems ??
          request.items.map((item, index) => ({
            item,
            itemCode: `EI-${request.type}-${String(index + 1).padStart(3, '0')}`,
            type: request.type,
            qty: request.itemDetails?.[index]?.reqQty ? `${request.itemDetails[index].reqQty}` : '—',
            pricePerUnit: request.itemDetails?.[index]?.plannedPrice ?? 0,
            gstPercent: 18,
            gstAmount: 0,
            lineTotal: request.itemDetails?.[index]?.estValue ?? 0,
          }));

        const grandTotal = linkedDraftPO?.grandTotal ?? lineItems.reduce((sum, line) => sum + line.lineTotal, 0);

        return {
          request,
          poNumber: (linkedDraftPO?.dpoNumber ?? request.code).replace('DPO', 'PO'),
          vendor: linkedDraftPO?.vendor ?? linkedQuote?.vendor ?? 'Unassigned Vendor',
          status: computedStatus,
          etaDays,
          lineItems,
          grandTotal,
          requestCode: request.code,
          createdDate: linkedDraftPO?.createdDate ?? request.createdDate ?? '2026-02-28',
          paymentTerms: linkedDraftPO?.paymentTerms ?? linkedQuote?.terms ?? 'As per contract',
        };
      });
  }, [draftPOs, quotes, requests]);

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
      contactPerson: 'Procurement Desk',
      timeline: [
        { stage: 'PO Released', done: true, timestamp: record.createdDate, actor: 'Procurement', note: 'PO shared with vendor' },
        { stage: 'Vendor Confirmed', done: true, timestamp: record.createdDate, actor: record.vendor, note: 'Acknowledged by vendor' },
        { stage: 'In Transit', done: record.status === 'In Transit', timestamp: record.status === 'In Transit' ? '2026-02-28' : null, actor: 'Logistics', note: null },
        { stage: 'Delivered', done: false, timestamp: null, actor: null, note: null },
      ],
    });
  };

  const markIssuedPOInTransit = (requestId: string, requestCode: string) => {
    updateRequestStatus(requestId, 'Delivery Pending');
    addToast('success', `${requestCode} moved to In Transit`);
  };

  const receiveIssuedPOGRN = (requestId: string, requestCode: string) => {
    updateProcurementState((current) => ({
      requests: current.requests.filter((request) => request.id !== requestId),
    }));
    addToast('success', `GRN received for ${requestCode}`);
  };

  const updateQuoteStatus = (quoteId: string, status: QuoteStatus) => {
    updateProcurementState((current) => ({
      quotes: current.quotes.map((quote) => (quote.id === quoteId ? { ...quote, status } : quote)),
    }));
    addToast('success', `Quote ${quoteId} moved to ${status}`);
  };

  const createDraftPO = (quoteId: string) => {
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

    // Calculate expected delivery date (add lead time to today)
    const expectedDelivery = new Date('2026-02-28');
    expectedDelivery.setDate(expectedDelivery.getDate() + selectedQuote.leadTimeDays);

    const newDraftPO: DraftPO = {
      id: newDpoId,
      dpoNumber: newDpoId,
      requestId: selectedQuote.requestId,
      requestCode: selectedQuote.requestCode,
      type: selectedQuote.requestType,
      vendor: selectedQuote.vendor,
      vendorId: `VND-${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
      status: 'Pending Approval',
      createdDate: '2026-02-28',
      createdBy: 'Procurement — Admin',
      paymentTerms: selectedQuote.terms,
      expectedDelivery: expectedDelivery.toISOString().split('T')[0],
      deliveryAddress: 'EI Plant 1, IDA Jeedimetla, Hyderabad - 500 055',
      vendorRating: selectedQuote.rating,
      alertMessage: `Draft PO created from quote ${selectedQuote.id}. Awaiting approval to proceed.`,
      alertType: 'warning',
      lineItems,
      subtotal,
      gstTotal,
      grandTotal,
    };

    updateProcurementState((current) => ({
      requests: current.requests.map((request) =>
        request.id === selectedQuote.requestId ? { ...request, status: 'PO Draft' } : request,
      ),
      draftPOs: [newDraftPO, ...current.draftPOs],
    }));

    addToast('success', `Draft PO ${newDpoId} created for ${selectedQuote.requestCode}`);
    
    // Navigate to Draft POs section to show the created PO
    setTimeout(() => {
      applyRouteState('Procurement', 'Draft POs');
    }, 500);
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

  const releaseDraftPOToVendor = (draftPoId: string) => {
    const target = draftPOs.find((draftPo) => draftPo.id === draftPoId);

    if (!target) {
      addToast('warning', 'Draft PO not found');
      return;
    }

    if (target.status !== 'Approved') {
      addToast('warning', `${target.dpoNumber} must be approved before release`);
      return;
    }

    updateRequestStatus(target.requestId, 'PO Released');
    addToast('success', `${target.dpoNumber} released to vendor`);
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

  const submitReleasePO = () => {
    if (!releasePOTarget) {
      return;
    }

    releaseDraftPOToVendor(releasePOTarget.id);
    updateProcurementState((current) => ({
      draftPOs: current.draftPOs.map((draftPo) =>
        draftPo.id === releasePOTarget.id
          ? {
              ...draftPo,
              alertType: 'ok',
              alertMessage: `Released via ${releaseMethod}${releaseNotes.trim() ? ` · Note: ${releaseNotes.trim()}` : ''}`,
            }
          : draftPo,
      ),
    }));

    if (selectedDraftPO?.id === releasePOTarget.id) {
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
      vendor: 'New Horizon Supplies',
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
        vsPlanned: index % 2 === 0 ? '▼2.1%' : '▲1.2%',
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

  const updateRequestStatus = (requestId: string, status: RequestStatus) => {
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
            <div className="flex gap-4 h-screen-minus-header">
              <div className="flex-1 pr-4">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold font-archivo text-slate-900">Vendor Directory</h2>
                    <p className="text-sm text-slate-600 mt-1">Manage suppliers and purchase orders</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => applyRouteState('Procurement', sideSection)}
                      className="px-4 py-2 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-300 hover:bg-cyan-100 transition"
                    >
                      ← Back
                    </button>
                    <button className="px-4 py-2 rounded-lg bg-yellow-400 text-yellow-900 font-semibold hover:bg-yellow-500 transition">
                      + Add Vendor
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <div className="rounded-xl border border-cyan-300 bg-cyan-50 p-4">
                    <p className="text-xs text-cyan-600 tracking-widest font-semibold">TOTAL VENDORS</p>
                    <p className="text-3xl font-bold text-cyan-700 mt-2">{vendors.length}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
                    <p className="text-xs text-emerald-600 tracking-widest font-semibold">ACTIVE</p>
                    <p className="text-3xl font-bold text-emerald-700 mt-2">{vendors.filter(v => v.status === 'Active').length}</p>
                  </div>
                  <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4">
                    <p className="text-xs text-yellow-600 tracking-widest font-semibold">RM SUPPLIERS</p>
                    <p className="text-3xl font-bold text-yellow-700 mt-2">{vendors.filter(v => v.type === 'RM').length}</p>
                  </div>
                  <div className="rounded-xl border border-violet-300 bg-violet-50 p-4">
                    <p className="text-xs text-violet-600 tracking-widest font-semibold">PM SUPPLIERS</p>
                    <p className="text-3xl font-bold text-violet-700 mt-2">{vendors.filter(v => v.type === 'PM').length}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200 bg-white overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-blue-200 bg-linear-to-r from-blue-50 to-cyan-50">
                    <h3 className="font-bold text-slate-900">Vendor Directory</h3>
                  </div>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="text-left text-xs tracking-widest text-slate-500 border-b border-slate-200 bg-slate-50">
                          <th className="px-6 py-3">VENDOR</th>
                          <th className="px-6 py-3">CATEGORY</th>
                          <th className="px-6 py-3">CONTACT</th>
                          <th className="px-6 py-3">CITY</th>
                          <th className="px-6 py-3">PAYMENT TERMS</th>
                          <th className="px-6 py-3">RATING</th>
                          <th className="px-6 py-3">POS ISSUED</th>
                          <th className="px-6 py-3">STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendors.map(vendor => (
                          <tr
                            key={vendor.id}
                            onClick={() => setSelectedVendor(vendor)}
                            className="border-b border-slate-100 hover:bg-blue-50 transition cursor-pointer"
                          >
                            <td className="px-6 py-3 font-semibold text-slate-900">{vendor.name}</td>
                            <td className="px-6 py-3">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${vendor.type === 'RM' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
                                {vendor.type}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-slate-700">{vendor.contact}</td>
                            <td className="px-6 py-3 text-slate-600">{vendor.city}</td>
                            <td className="px-6 py-3 text-slate-600 text-xs">{vendor.paymentTerms}</td>
                            <td className="px-6 py-3">
                              <span className="text-yellow-700 font-bold">{'★'.repeat(Math.round(vendor.rating))} {vendor.rating}</span>
                            </td>
                            <td className="px-6 py-3 text-slate-600 font-semibold">{vendor.posIssued}</td>
                            <td className="px-6 py-3">
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">{vendor.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {selectedVendor && (
                <div className="w-96 bg-white border-l border-slate-200 overflow-y-auto shadow-lg rounded-lg">
                  <div className="sticky top-0 bg-linear-to-r from-blue-50 to-cyan-50 border-b border-blue-200 px-6 py-4 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-lg">{selectedVendor.name}</h3>
                    <button
                      onClick={() => setSelectedVendor(null)}
                      className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 tracking-widest font-semibold">VENDOR ID</p>
                      <p className="text-sm font-mono text-slate-700 mt-1">{selectedVendor.vendorCode}</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 tracking-widest font-semibold">CATEGORY</p>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mt-1 ${selectedVendor.type === 'RM' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
                        {selectedVendor.type}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 tracking-widest font-semibold">CONTACT</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVendor.contact}</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 tracking-widest font-semibold">EMAIL</p>
                      <p className="text-sm text-blue-600 mt-1">{selectedVendor.email}</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 tracking-widest font-semibold">PHONE</p>
                      <p className="text-sm text-slate-700 font-mono mt-1">{selectedVendor.phone}</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 tracking-widest font-semibold">CITY</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVendor.city}</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 tracking-widest font-semibold">PAYMENT TERMS</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVendor.paymentTerms}</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 tracking-widest font-semibold">RATING</p>
                      <p className="text-sm text-yellow-700 font-bold mt-1">{'★'.repeat(Math.round(selectedVendor.rating))} {selectedVendor.rating}</p>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-xs text-slate-500 tracking-widest font-semibold mb-3">PURCHASE ORDERS ({purchaseOrders.filter(po => po.vendorId === selectedVendor.id).length})</p>
                      <div className="space-y-3">
                        {purchaseOrders.filter(po => po.vendorId === selectedVendor.id).map((po) => (
                          <div key={po.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="flex items-start justify-between mb-2">
                              <p className="font-mono text-xs text-slate-600">{po.poNumber}</p>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  po.status === 'Delivered'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : po.status === 'Shipped'
                                    ? 'bg-blue-100 text-blue-700'
                                    : po.status === '80% Complete'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}
                              >
                                {po.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mb-1">Value: ₹{po.value.toLocaleString('en-IN')}</p>
                            <p className="text-xs text-slate-500">{po.date}</p>
                          </div>
                        ))}
                        {purchaseOrders.filter(po => po.vendorId === selectedVendor.id).length === 0 && (
                          <p className="text-xs text-slate-500 italic">No purchase orders yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {mainTab === 'Reports' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold font-archivo text-slate-900">Procurement Reports</h2>
                  <p className="text-sm text-slate-600 mt-1">Analytics and performance insights</p>
                </div>
                <button
                  onClick={() => applyRouteState('Procurement', sideSection)}
                  className="px-4 py-2 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-300"
                >
                  ← Back to Procurement
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500 tracking-widest">TOTAL PO VALUE</p>
                  <p className="text-3xl font-bold text-yellow-700 mt-2">₹{quotes.reduce((sum, q) => sum + q.lines.reduce((s, l) => s + l.totalValue, 0), 0).toLocaleString('en-IN')}</p>
                  <p className="text-xs text-slate-500 mt-1">all quotes combined</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500 tracking-widest">REQUEST PIPELINE</p>
                  <p className="text-3xl font-bold text-cyan-700 mt-2">{requests.length}</p>
                  <p className="text-xs text-slate-500 mt-1">{requests.filter(r => r.status === 'New').length} new, {requests.filter(r => r.status === 'Quoted').length} quoted</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500 tracking-widest">QUOTES STATUS</p>
                  <p className="text-3xl font-bold text-emerald-700 mt-2">{quoteStats.confirmed}/{quoteStats.totalQuotes}</p>
                  <p className="text-xs text-slate-500 mt-1">confirmed quotes</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500 tracking-widest">COMPLETION RATE</p>
                  <p className="text-3xl font-bold text-blue-700 mt-2">{Math.round((requests.filter(r => r.status === 'PO Released').length / requests.length) * 100)}%</p>
                  <p className="text-xs text-slate-500 mt-1">POs released</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">Request Status Breakdown</h3>
                  <div className="space-y-3">
                    {['New', 'Quoted', 'PO Draft', 'PO Released', 'Delivery Pending'].map(status => {
                      const count = requests.filter(r => r.status === status as any).length;
                      const percentage = Math.round((count / requests.length) * 100);
                      return (
                        <div key={status}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-700 font-medium">{status}</span>
                            <span className="text-sm font-bold text-slate-900">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                status === 'New' ? 'bg-blue-500' :
                                status === 'Quoted' ? 'bg-yellow-500' :
                                status === 'PO Draft' ? 'bg-orange-500' :
                                status === 'PO Released' ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">Quote Status Distribution</h3>
                  <div className="space-y-3">
                    {['Confirmed', 'Pending Review', 'Not Selected'].map(status => {
                      const count = quotes.filter(q => q.status === status as any).length;
                      const percentage = Math.round((count / quotes.length) * 100);
                      return (
                        <div key={status}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-700 font-medium">{status}</span>
                            <span className="text-sm font-bold text-slate-900">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                status === 'Confirmed' ? 'bg-emerald-500' :
                                status === 'Pending Review' ? 'bg-yellow-500' : 'bg-slate-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-white overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-blue-200 bg-linear-to-r from-blue-50 to-cyan-50">
                  <h3 className="font-bold text-slate-900">Request Timeline</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs tracking-widest text-slate-500 border-b border-slate-200 bg-slate-50">
                        <th className="px-6 py-3">REQUEST CODE</th>
                        <th className="px-6 py-3">TYPE</th>
                        <th className="px-6 py-3">DUE DATE</th>
                        <th className="px-6 py-3">PRIORITY</th>
                        <th className="px-6 py-3">STATUS</th>
                        <th className="px-6 py-3">QUOTES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map(req => {
                        const relatedQuotes = quotes.filter(q => q.requestId === req.id);
                        return (
                          <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            <td className="px-6 py-3 font-mono font-bold text-slate-900">{req.code}</td>
                            <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${requestTypeClass[req.type]}`}>{req.type}</span></td>
                            <td className="px-6 py-3 text-slate-700">{new Date(req.dueDate).toLocaleDateString('en-IN')}</td>
                            <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${priorityClass[req.priority]}`}>{req.priority}</span></td>
                            <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBg[req.status]}`}>{req.status}</span></td>
                            <td className="px-6 py-3 text-slate-700">{relatedQuotes.length} quotes</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
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
                const TODAY = new Date('2026-02-28');
                const daysUntil = (dateStr: string) => Math.ceil((new Date(dateStr).getTime() - TODAY.getTime()) / 86400000);
                const activeRequests = requests.filter(r => r.status !== 'PO Released');
                const rmRequests = requests.filter(r => r.type === 'RM');
                const pmRequests = requests.filter(r => r.type === 'PM');
                const activePOValue = purchaseOrders.filter(p => p.status !== 'Delivered').reduce((s, p) => s + p.value, 0);
                const poStatusColor: Record<string, string> = {
                  Shipped: 'bg-blue-100 text-blue-700',
                  'Advance Paid': 'bg-orange-100 text-orange-700',
                  Delivered: 'bg-emerald-100 text-emerald-700',
                  '80% Complete': 'bg-yellow-100 text-yellow-700',
                };
                return (
                  <>
                    {/* KPI strip */}
                    <div className="flex flex-wrap gap-3">
                      {[
                        { label: 'NEW REQUESTS', value: requests.filter(r => r.status === 'New').length, sub: 'Awaiting action ↑', color: 'text-yellow-600' },
                        { label: 'RM — RAW MATERIALS', value: rmRequests.length, sub: `${rmRequests.flatMap(r => r.items).length} items · pending action`, color: 'text-cyan-600', badge: 'RM' },
                        { label: 'PM — PACKAGING MATERIALS', value: pmRequests.length, sub: `${pmRequests.flatMap(r => r.items).length} items · pending action`, color: 'text-violet-600', badge: 'PM' },
                        { label: 'ACTIVE POS', value: requests.filter(r => r.status === 'PO Draft' || r.status === 'PO Released').length, sub: 'In pipeline ↑', color: 'text-emerald-600' },
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
                          <h3 className="font-bold text-slate-900">⚡ Actions Required</h3>
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
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${priorityClass[req.priority]}`}>● {req.priority}</span>
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
                          <h3 className="font-bold text-slate-900">🔥 PO Pipeline</h3>
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
                  {/* Stats KPI Bar */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                          <span className="text-orange-600 text-lg">📋</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Requests</p>
                      <p className="text-2xl font-bold text-slate-900">{requests.length}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-cyan-200 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                          <span className="text-cyan-600 text-lg">🧪</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">RM Requests</p>
                      <p className="text-2xl font-bold text-cyan-600">{requests.filter(r => r.type === 'RM').length}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-violet-200 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                          <span className="text-violet-600 text-lg">📦</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">PM Requests</p>
                      <p className="text-2xl font-bold text-violet-600">{requests.filter(r => r.type === 'PM').length}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                          <span className="text-red-600 text-lg">⚠️</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">New / Unactioned</p>
                      <p className="text-2xl font-bold text-red-600">{requests.filter(r => r.status === 'New').length}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-yellow-200 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                          <span className="text-yellow-600 text-lg">📝</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Draft PO Stage</p>
                      <p className="text-2xl font-bold text-yellow-600">{requests.filter(r => r.status === 'PO Draft').length}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <span className="text-emerald-600 text-lg">✅</span>
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
                                    <span className="font-semibold text-slate-700">📝 Notes:</span> {req.priority === 'High' ? 'Currently replenishment target for RM. Batch 1M2 production run from Feb 28.' : 'Q2 faceroll production. Need 100% tubes by batch date. Estimated Nov batch or DTC.'}
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
                                    👁 View
                                  </button>
                                  <button
                                    onClick={() => addToast('info', `Editing ${req.code}`)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedStockCheckRequest(req);
                                      setSelectedStockCheckItemName(req.itemDetails?.[0]?.itemName ?? req.items[0] ?? null);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-cyan-400 text-cyan-700 text-xs font-semibold hover:bg-cyan-50 transition-all"
                                  >
                                    📊 Stock Check
                                  </button>
                                  <button
                                    onClick={() => {
                                      updateRequestPriority(req.id, req.priority === 'High' ? 'Medium' : req.priority === 'Medium' ? 'Low' : 'High');
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-violet-400 text-violet-700 text-xs font-semibold hover:bg-violet-50 transition-all"
                                  >
                                    🔄 Priority
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => applyRouteState('Procurement', 'Quotations')}
                                    className="px-3 py-1.5 rounded-lg border border-emerald-400 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 transition-all"
                                  >
                                    💰 View Quotes
                                  </button>
                                  <button
                                    onClick={() => {
                                      updateRequestStatus(req.id, 'PO Released');
                                      addToast('success', `${req.code} marked as PO Released`);
                                    }}
                                    className="px-4 py-1.5 rounded-lg bg-amber-400 text-slate-900 text-xs font-bold hover:bg-amber-500 shadow-md transition-all"
                                  >
                                    ✅ Release PO
                                  </button>
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
                  {filteredQuotes.length === 0 ? (
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
                                      line.vsPlanned.includes('▼') ? 'text-emerald-600' : 'text-rose-600'
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
                                  <span className="text-slate-500">📦 Lead time:</span>
                                  <span className="font-semibold">{quote.leadTimeDays} days</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-slate-500">💳 Terms:</span>
                                  <span className="font-semibold">{quote.terms}</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-slate-500">⏰ Valid till:</span>
                                  <span className="font-semibold">{quote.validTill}</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-slate-500">⭐ Vendor:</span>
                                  <span className="font-semibold text-amber-600">
                                    {'★'.repeat(Math.floor(quote.rating))} {quote.rating}
                                  </span>
                                </span>
                              </div>
                              <button
                                onClick={() => setExpandedQuoteId(isExpanded ? null : quote.id)}
                                className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium transition-colors"
                              >
                                {isExpanded ? '▲ Hide Details' : '▼ View Details'}
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
                                    <div className="text-xs font-semibold text-slate-600 mb-1">💬 Additional Notes</div>
                                    <div className="text-sm text-slate-700">{quote.note}</div>
                                  </div>
                                )}
                                
                                {/* File Info */}
                                <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">📄 Attached File:</span>
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
                              🗑 Delete
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
                                {quote.status === 'Confirmed' ? '✕ Mark Not Selected' : '✓ Confirm Quote'}
                              </button>
                              <button
                                onClick={() => createDraftPO(quote.id)}
                                className="px-4 py-2 rounded-lg bg-amber-400 text-slate-900 font-bold text-sm hover:bg-amber-500 transition-colors"
                              >
                                Create Draft PO →
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
                      <select className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700">
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

                  {/* Draft PO Cards */}
                  <div className="space-y-3">
                    {draftPOs.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500 shadow-sm">
                        No draft purchase orders.
                      </div>
                    ) : (
                      draftPOs.map((dpo) => (
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
                              <p><strong>Vendor Rating</strong> {'⭐'.repeat(Math.floor(dpo.vendorRating))} {dpo.vendorRating}</p>
                            </div>
                          </div>

                          {/* Alert */}
                          {dpo.alertMessage && (
                            <div className={`px-5 py-2 text-xs flex items-center gap-2 ${
                              dpo.alertType === 'warning' ? 'bg-yellow-50 text-yellow-800' : 'bg-emerald-50 text-emerald-800'
                            }`}>
                              <span>{dpo.alertType === 'warning' ? '⚠️' : '✓'}</span>
                              <span>{dpo.alertMessage}</span>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedDraftPO(dpo)}
                              className="px-4 py-2 rounded-lg border border-blue-300 text-blue-700 text-sm font-semibold hover:bg-blue-50 transition"
                            >
                              ➤ View PO
                            </button>
                            <button
                              onClick={() => {
                                addToast('info', `Editing ${dpo.dpoNumber}`);
                              }}
                              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                            >
                              — Edit
                            </button>
                            {dpo.status === 'Pending Approval' && (
                              <button
                                onClick={() => {
                                  approveDraftPO(dpo.id);
                                }}
                                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition"
                              >
                                ✓ Approve
                              </button>
                            )}
                            {dpo.status === 'Approved' && (
                              <>
                                <button
                                  onClick={() => openReleasePOModal(dpo.id)}
                                  className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition"
                                >
                                  🚀 Release PO to Vendor
                                </button>
                                <button
                                  onClick={() => splitDraftPO(dpo.id)}
                                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition"
                                >
                                  ✂ Split PO
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
                const advancePending = 1; // sample metric to mirror design
                const inTransitCount = issuedPORecords.filter(record => record.status === 'In Transit').length;
                const grnComplete = 1; // sample metric to mirror design

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
                              <tr key={key} className="border-b border-slate-100 hover:bg-blue-50">
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
                                    Track →
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
                                className="px-3 py-1.5 rounded border border-amber-400 text-amber-700 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100"
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
                const pendingRequests = requests.filter(
                  (request) => request.status === 'PO Released' || request.status === 'Delivery Pending',
                );

                const grnLines = pendingRequests.flatMap((request) => {
                  const linkedDraftPO = draftPOs.find((draftPo) => draftPo.requestId === request.id);
                  const vendor = linkedDraftPO?.vendor ?? 'Unassigned Vendor';
                  const poRef = (linkedDraftPO?.dpoNumber ?? request.code).replace('DPO', 'PO');
                  const grnRef = `GRN-${request.code}`;

                  const baseLines = linkedDraftPO?.lineItems ??
                    request.items.map((item, index) => ({
                      item,
                      itemCode: `EI-${request.type}-${String(index + 1).padStart(3, '0')}`,
                      qty: request.itemDetails?.[index]?.reqQty ? `${request.itemDetails[index].reqQty}` : '—',
                      lineTotal: request.itemDetails?.[index]?.estValue ?? 0,
                    }));

                  return baseLines.map((line, index) => ({
                    key: `${request.id}-${index}`,
                    request,
                    vendor,
                    poRef,
                    grnRef,
                    itemName: line.item,
                    itemCode: line.itemCode,
                    orderedQty: line.qty,
                    receivedQty: line.qty,
                    lineValue: line.lineTotal,
                    status: (request.status === 'Delivery Pending' ? 'Under GRN' : 'Pending GRN') as
                      | 'Pending GRN'
                      | 'Under GRN',
                    qcPass: '-',
                    qcFail: '-',
                    receivedDate: request.dueDate,
                  }));
                });

                const filteredGrnLines = grnLines.filter((line) => {
                  if (grnCategoryFilter !== 'All' && line.request.type !== grnCategoryFilter) {
                    return false;
                  }

                  if (grnVendorFilter !== 'All Vendors' && line.vendor !== grnVendorFilter) {
                    return false;
                  }

                  if (grnStatusFilter !== 'All' && line.status !== grnStatusFilter) {
                    return false;
                  }

                  if (!grnSearch.trim()) {
                    return true;
                  }

                  const query = grnSearch.toLowerCase();
                  return (
                    line.itemName.toLowerCase().includes(query) ||
                    line.itemCode.toLowerCase().includes(query) ||
                    line.poRef.toLowerCase().includes(query) ||
                    line.grnRef.toLowerCase().includes(query) ||
                    line.vendor.toLowerCase().includes(query)
                  );
                });

                const grnSummary = Object.values(
                  filteredGrnLines.reduce<Record<string, {
                    request: ProcurementRequest;
                    vendor: string;
                    poRef: string;
                    grnRef: string;
                    items: string[];
                  }>>((acc, line) => {
                    const key = line.request.id;
                    if (!acc[key]) {
                      acc[key] = {
                        request: line.request,
                        vendor: line.vendor,
                        poRef: line.poRef,
                        grnRef: line.grnRef,
                        items: [],
                      };
                    }
                    if (!acc[key].items.includes(line.itemName)) {
                      acc[key].items.push(line.itemName);
                    }
                    return acc;
                  }, {}),
                );

                const totalGrns = grnLines.length;
                const rmGrns = grnLines.filter((line) => line.request.type === 'RM').length;
                const pmGrns = grnLines.filter((line) => line.request.type === 'PM').length;
                const pendingGrn = grnLines.filter((line) => line.status === 'Pending GRN').length;
                const underGrn = grnLines.filter((line) => line.status === 'Under GRN').length;
                const grnComplete = completedGrns.length;

                const completeGrnForRequest = (requestId: string, requestCode: string) => {
                  const linesForRequest = grnLines.filter((line) => line.request.id === requestId);

                  if (linesForRequest.length === 0) {
                    updateProcurementState((current) => ({
                      requests: current.requests.filter((request) => request.id !== requestId),
                      completedGrns: current.completedGrns,
                    }));
                    addToast('success', `GRN completed for ${requestCode}`);
                    return;
                  }

                  const completedEntry: CompletedGrn = {
                    request: linesForRequest[0].request,
                    vendor: linesForRequest[0].vendor,
                    poRef: linesForRequest[0].poRef,
                    grnRef: linesForRequest[0].grnRef,
                    lines: linesForRequest.map((line) => ({
                      itemName: line.itemName,
                      itemCode: line.itemCode,
                      orderedQty: String(line.orderedQty),
                      receivedQty: String(line.receivedQty),
                      qcPass: line.qcPass === '-' ? '—' : line.qcPass,
                      qcFail: line.qcFail === '-' ? '—' : line.qcFail,
                      receivedDate: line.receivedDate,
                      status: 'Completed',
                    })),
                  };

                  updateProcurementState((current) => ({
                    requests: current.requests.filter((request) => request.id !== requestId),
                    completedGrns: [...current.completedGrns, completedEntry],
                  }));
                  addToast('success', `GRN completed for ${requestCode}`);
                };

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
                          {Array.from(new Set(grnLines.map((line) => line.vendor))).map((vendor) => (
                            <option key={vendor} value={vendor}>{vendor}</option>
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

                    {/* Itemised GRN Lines */}
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-500 text-lg">◆</span>
                          <div>
                            <p className="text-xs font-semibold text-slate-800 tracking-[0.18em] uppercase">Itemised GRN Lines</p>
                            <p className="text-[11px] text-slate-500">Warehouse receipts by line item</p>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-full text-[11px] text-slate-900">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] tracking-[0.18em] uppercase text-slate-500">
                              <th className="px-4 py-2 text-left">Item</th>
                              <th className="px-4 py-2 text-center">Type</th>
                              <th className="px-4 py-2 text-left">GRN / PO Ref</th>
                              <th className="px-4 py-2 text-left">Vendor</th>
                              <th className="px-4 py-2 text-center">Ordered</th>
                              <th className="px-4 py-2 text-center">Received</th>
                              <th className="px-4 py-2 text-center">QC Pass</th>
                              <th className="px-4 py-2 text-center">QC Fail</th>
                              <th className="px-4 py-2 text-center">Received Date</th>
                              <th className="px-4 py-2 text-center">QC By</th>
                              <th className="px-4 py-2 text-center">Status</th>
                              <th className="px-4 py-2 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredGrnLines.map((line) => (
                              <tr key={line.key} className="border-b border-slate-100 hover:bg-blue-50/60">
                                <td className="px-4 py-2 align-middle">
                                  <div className="flex flex-col">
                                    <span className="text-[12px] font-semibold text-slate-900">{line.itemName}</span>
                                    <span className="text-[10px] text-slate-500">{line.itemCode}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 align-middle text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    line.request.type === 'RM'
                                      ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                      : 'bg-violet-50 text-violet-700 border border-violet-200'
                                  }`}>
                                    {line.request.type}
                                  </span>
                                </td>
                                <td className="px-4 py-2 align-middle">
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 text-[10px] font-mono">
                                      {line.grnRef}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 text-sky-700 border border-sky-300 px-2 py-0.5 text-[10px] font-mono">
                                      {line.poRef}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 align-middle text-[11px]">{line.vendor}</td>
                                <td className="px-4 py-2 align-middle text-center">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                                    {line.orderedQty}
                                  </span>
                                </td>
                                <td className="px-4 py-2 align-middle text-center">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                                    {line.receivedQty}
                                  </span>
                                </td>
                                <td className="px-4 py-2 align-middle text-center text-[11px] text-emerald-600">{line.qcPass}</td>
                                <td className="px-4 py-2 align-middle text-center text-[11px] text-rose-500">{line.qcFail}</td>
                                <td className="px-4 py-2 align-middle text-center text-[11px] text-slate-700">
                                  {new Date(line.receivedDate).toLocaleDateString('en-IN')}
                                </td>
                                <td className="px-4 py-2 align-middle text-center text-[11px] text-slate-600">Meera QC</td>
                                <td className="px-4 py-2 align-middle text-center">
                                  <span className="inline-flex items-center justify-center px-3 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-semibold min-w-24">
                                    {line.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 align-middle text-center">
                                  <button
                                    onClick={() => completeGrnForRequest(line.request.id, line.request.code)}
                                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-full border border-emerald-400 text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold"
                                  >
                                    Complete GRN
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {filteredGrnLines.length === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-center text-[11px] text-slate-500" colSpan={12}>
                                  No GRN lines match current filters.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* GRN Summary Cards */}
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-800 tracking-[0.18em] uppercase">GRN Summary Cards</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-full text-[11px] text-slate-900">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] tracking-[0.18em] uppercase text-slate-500">
                              <th className="px-4 py-2 text-left">GRN / PO Ref</th>
                              <th className="px-4 py-2 text-left">Type</th>
                              <th className="px-4 py-2 text-left">Vendor</th>
                              <th className="px-4 py-2 text-left">Items</th>
                              <th className="px-4 py-2 text-left">Received Date</th>
                              <th className="px-4 py-2 text-left">Received By</th>
                              <th className="px-4 py-2 text-left">QC By</th>
                              <th className="px-4 py-2 text-left">Status</th>
                              <th className="px-4 py-2 text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grnSummary.map((entry) => (
                              <tr key={entry.request.id} className="border-b border-slate-100 hover:bg-blue-50/60">
                                <td className="px-4 py-2 align-top">
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 text-[10px] font-mono">
                                      {entry.grnRef}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 text-sky-700 border border-sky-300 px-2 py-0.5 text-[10px] font-mono">
                                      {entry.poRef}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 align-top text-[11px]">{entry.request.type}</td>
                                <td className="px-4 py-2 align-top text-[11px]">{entry.vendor}</td>
                                <td className="px-4 py-2 align-top text-[11px]">
                                  {entry.items.join(', ')}
                                </td>
                                <td className="px-4 py-2 align-top text-[11px] text-slate-700">
                                  {new Date(entry.request.dueDate).toLocaleDateString('en-IN')}
                                </td>
                                <td className="px-4 py-2 align-top text-[11px] text-slate-700">Anand Store</td>
                                <td className="px-4 py-2 align-top text-[11px] text-slate-700">Meera QC</td>
                                <td className="px-4 py-2 align-top">
                                  <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] text-amber-700 font-semibold">
                                    Under GRN
                                  </span>
                                </td>
                                <td className="px-4 py-2 align-top">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      onClick={() => {
                                        const linesForEntry = grnLines
                                          .filter((line) => line.request.id === entry.request.id)
                                          .map((line) => ({
                                            itemName: line.itemName,
                                            itemCode: line.itemCode,
                                            orderedQty: line.orderedQty,
                                            receivedQty: line.receivedQty,
                                            qcPass: line.qcPass,
                                            qcFail: line.qcFail,
                                            receivedDate: line.receivedDate,
                                            status: line.status,
                                          }));

                                        setSelectedGrn({
                                          request: entry.request,
                                          vendor: entry.vendor,
                                          poRef: entry.poRef,
                                          grnRef: entry.grnRef,
                                          lines: linesForEntry,
                                        });
                                      }}
                                      className="px-3 py-1.5 rounded-full border border-slate-300 text-[11px] text-slate-800 bg-white hover:bg-slate-50"
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={() => completeGrnForRequest(entry.request.id, entry.request.code)}
                                      className="px-3 py-1.5 rounded-full border border-emerald-400 text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                    >
                                      Complete GRN
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {grnSummary.length === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-center text-[11px] text-slate-500" colSpan={9}>
                                  No GRN summary records.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Completed GRNs */}
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden mt-4">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-800 tracking-[0.18em] uppercase">Completed GRNs</p>
                        <p className="text-[11px] text-slate-500">Showing {completedGrns.length} completed GRN{completedGrns.length === 1 ? '' : 's'}</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-full text-[11px] text-slate-900">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] tracking-[0.18em] uppercase text-slate-500">
                              <th className="px-4 py-2 text-left">GRN / PO Ref</th>
                              <th className="px-4 py-2 text-left">Type</th>
                              <th className="px-4 py-2 text-left">Vendor</th>
                              <th className="px-4 py-2 text-left">Items</th>
                              <th className="px-4 py-2 text-left">Received Date</th>
                              <th className="px-4 py-2 text-left">Received By</th>
                              <th className="px-4 py-2 text-left">QC By</th>
                              <th className="px-4 py-2 text-left">Status</th>
                              <th className="px-4 py-2 text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {completedGrns.map((entry, index) => {
                              const uniqueItems = Array.from(new Set(entry.lines.map((line) => line.itemName)));
                              const receivedDate = entry.lines[0]?.receivedDate ?? entry.request.dueDate;

                              return (
                                <tr key={`${entry.request.id}-completed-${index}`} className="border-b border-slate-100 hover:bg-emerald-50/40">
                                  <td className="px-4 py-2 align-top">
                                    <div className="flex flex-col gap-1">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 text-[10px] font-mono">
                                        {entry.grnRef}
                                      </span>
                                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 text-sky-700 border border-sky-300 px-2 py-0.5 text-[10px] font-mono">
                                        {entry.poRef}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 align-top text-[11px]">{entry.request.type}</td>
                                  <td className="px-4 py-2 align-top text-[11px]">{entry.vendor}</td>
                                  <td className="px-4 py-2 align-top text-[11px]">{uniqueItems.join(', ')}</td>
                                  <td className="px-4 py-2 align-top text-[11px] text-slate-700">
                                    {new Date(receivedDate).toLocaleDateString('en-IN')}
                                  </td>
                                  <td className="px-4 py-2 align-top text-[11px] text-slate-700">Anand Store</td>
                                  <td className="px-4 py-2 align-top text-[11px] text-slate-700">Meera QC</td>
                                  <td className="px-4 py-2 align-top">
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-semibold">
                                      Completed
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 align-top">
                                    <button
                                      onClick={() => {
                                        setSelectedGrn({
                                          request: entry.request,
                                          vendor: entry.vendor,
                                          poRef: entry.poRef,
                                          grnRef: entry.grnRef,
                                          lines: entry.lines,
                                        });
                                      }}
                                      className="px-3 py-1.5 rounded-full border border-slate-300 text-[11px] text-slate-800 bg-white hover:bg-slate-50"
                                    >
                                      View
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            {completedGrns.length === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-center text-[11px] text-slate-500" colSpan={9}>
                                  No completed GRNs yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {sideSection === 'Stock Check' && (
                (() => {
                  const rawStockChecks = requests
                    .filter((request) => request.priority !== 'Low')
                    .map((request, index) => {
                      const scId = `SC-${String(index + 1).padStart(3, '0')}`;
                      const baseStatus: StockCheckStatus = deriveStockCheckStatusForRequest(request);
                      const effectiveStatus: StockCheckStatus = stockCheckStatuses[request.id] ?? baseStatus;

                      const updatesForRequest = stockCheckUpdates[request.id] ?? {};

                      const assignedTo =
                        request.requestedBy ||
                        (request.type === 'RM'
                          ? 'Anand Store'
                          : 'Ravi Kumar');

                      const createdDate =
                        request.createdDate ||
                        '2026-02-10';

                      const lineItems =
                        (request.itemDetails && request.itemDetails.length > 0
                          ? request.itemDetails.map((item, idx) => {
                              const systemQty = item.reqQty;
                              const itemCode = item.itemCode;
                              const override = itemCode ? updatesForRequest[itemCode] : undefined;
                              const defaultZone = request.type === 'RM' ? 'LOC-RM' : 'LOC-PM';
                              const defaultRack = `A1-L1-S${idx + 1}`;

                              return {
                                name: item.itemName,
                                itemCode,
                                systemQty,
                                zone: override?.zone ?? defaultZone,
                                rack: override?.rack ?? defaultRack,
                                physicalQty: override?.physicalQty ?? systemQty,
                                batchNo: override?.batchNo ?? `ETH-UV08-00${idx + 1}`,
                                packagingCondition: override?.packagingCondition ?? 'Good',
                              };
                            })
                          : request.items.map((itemName, idx) => {
                              const systemQty = request.quantities?.[idx] ?? 0;
                              const generatedCodeBase =
                                itemName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) ||
                                String(idx + 1).padStart(3, '0');
                              const itemCode = `EI-${request.type}-${generatedCodeBase}`;
                              const override = updatesForRequest[itemCode];
                              const defaultZone = request.type === 'RM' ? 'LOC-RM' : 'LOC-PM';
                              const defaultRack = `A1-L1-S${idx + 1}`;

                              return {
                                name: itemName,
                                itemCode,
                                systemQty,
                                zone: override?.zone ?? defaultZone,
                                rack: override?.rack ?? defaultRack,
                                physicalQty: override?.physicalQty ?? systemQty,
                                batchNo: override?.batchNo ?? `ETH-UV08-00${idx + 1}`,
                                packagingCondition: override?.packagingCondition ?? 'Good',
                              };
                            })) || [];

                      return {
                        id: scId,
                        request,
                        type: request.type,
                        status: effectiveStatus,
                        assignedTo,
                        createdDate,
                        lineItems,
                      };
                    });

                  const filteredStockChecks = rawStockChecks.filter((entry) => {
                    if (stockCategoryFilter !== 'All' && entry.type !== stockCategoryFilter) {
                      return false;
                    }

                    if (stockStatusFilter !== 'All Statuses' && entry.status !== stockStatusFilter) {
                      return false;
                    }

                    if (!stockSearch.trim()) {
                      return true;
                    }

                    const query = stockSearch.toLowerCase();
                    return (
                      entry.id.toLowerCase().includes(query) ||
                      entry.request.code.toLowerCase().includes(query) ||
                      entry.assignedTo.toLowerCase().includes(query) ||
                      entry.lineItems.some((line) => line.name.toLowerCase().includes(query))
                    );
                  });

                  const totalStockChecks = rawStockChecks.length;
                  const rmStockChecks = rawStockChecks.filter((entry) => entry.type === 'RM').length;
                  const pmStockChecks = rawStockChecks.filter((entry) => entry.type === 'PM').length;
                  const assignedCount = rawStockChecks.filter((entry) => entry.status === 'Assigned').length;
                  const inProgressCount = rawStockChecks.filter((entry) => entry.status === 'In Progress').length;
                  const completedCount = rawStockChecks.filter((entry) => entry.status === 'Completed').length;

                  return (
                    <div className="space-y-4 rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                      {/* KPI strip */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-[10px] tracking-[0.18em] text-slate-600 uppercase">Total Stock Checks</p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">{totalStockChecks}</p>
                        </div>
                        <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3">
                          <p className="text-[10px] tracking-[0.18em] text-cyan-700 uppercase">RM Checks</p>
                          <p className="mt-1 text-2xl font-bold text-cyan-900">{rmStockChecks}</p>
                        </div>
                        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                          <p className="text-[10px] tracking-[0.18em] text-violet-700 uppercase">PM Checks</p>
                          <p className="mt-1 text-2xl font-bold text-violet-900">{pmStockChecks}</p>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                          <p className="text-[10px] tracking-[0.18em] text-amber-700 uppercase">Assigned</p>
                          <p className="mt-1 text-2xl font-bold text-amber-900">{assignedCount}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <p className="text-[10px] tracking-[0.18em] text-emerald-700 uppercase">In Progress / Completed</p>
                          <p className="mt-1 text-2xl font-bold text-emerald-900">{inProgressCount + completedCount}</p>
                        </div>
                      </div>

                      {/* Filters */}
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-slate-500">Category:</span>
                          <button
                            onClick={() => setStockCategoryFilter('All')}
                            className={`px-2 py-1 rounded-full border text-xs ${
                              stockCategoryFilter === 'All'
                                ? 'border-amber-400 text-amber-800 bg-amber-50'
                                : 'border-slate-300 text-slate-600 bg-white'
                            }`}
                          >
                            All
                          </button>
                          {(['RM', 'PM'] as RequestType[]).map((type) => (
                            <button
                              key={type}
                              onClick={() => setStockCategoryFilter(type)}
                              className={`px-2 py-1 rounded-full border text-xs ${
                                stockCategoryFilter === type
                                  ? 'border-emerald-400 text-emerald-800 bg-emerald-50'
                                  : 'border-slate-300 text-slate-600 bg-white'
                              }`}
                            >
                              {type}
                            </button>
                          ))}

                          <span className="ml-3 text-slate-500">Status:</span>
                          <select
                            value={stockStatusFilter}
                            onChange={(event) =>
                              setStockStatusFilter(
                                event.target.value as 'All Statuses' | 'Assigned' | 'In Progress' | 'Completed',
                              )
                            }
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-xs"
                          >
                            <option value="All Statuses">All Statuses</option>
                            <option value="Assigned">Assigned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>

                        <input
                          value={stockSearch}
                          onChange={(event) => setStockSearch(event.target.value)}
                          placeholder="Search SC ID, assignee, item..."
                          className="w-64 max-w-full px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400"
                        />
                      </div>

                      {/* Stock check cards */}
                      <div className="space-y-4">
                        {filteredStockChecks.map((entry) => (
                          <article
                            key={entry.id}
                            className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                          >
                            {/* Card header */}
                            <div className="px-4 py-3 border-b border-slate-200 bg-linear-to-r from-slate-50 via-blue-50 to-slate-50 flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-300 bg-white font-mono text-[10px] text-slate-700">
                                    {entry.id}
                                  </span>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                      entry.type === 'RM'
                                        ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                        : 'bg-violet-50 text-violet-700 border-violet-200'
                                    }`}
                                  >
                                    {entry.type === 'RM' ? 'Raw Material' : 'Packaging Material'}
                                  </span>
                                </div>
                                <h3 className="text-sm font-semibold text-slate-900">Stock Check — {entry.type === 'RM' ? 'Raw Material' : 'Packaging'}</h3>
                                <p className="text-[11px] text-slate-600">
                                  Assigned to <span className="font-semibold">{entry.assignedTo}</span> · Created{' '}
                                  {new Date(entry.createdDate).toLocaleDateString('en-IN')} · For:{' '}
                                  <span className="font-mono text-slate-700">{entry.request.code}</span>
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 text-[11px]">
                                <span
                                  className={`inline-flex items-center px-3 py-0.5 rounded-full border text-[10px] font-semibold ${
                                    entry.status === 'Completed'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : entry.status === 'In Progress'
                                      ? 'bg-sky-50 text-sky-700 border-sky-300'
                                      : 'bg-amber-50 text-amber-700 border-amber-300'
                                  }`}
                                >
                                  {entry.status}
                                </span>
                              </div>
                            </div>

                            {/* Items table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-[11px] text-slate-900">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] tracking-[0.18em] uppercase text-slate-500">
                                    <th className="px-4 py-2 text-left">Item</th>
                                    <th className="px-4 py-2 text-left">Zone / Rack</th>
                                    <th className="px-4 py-2 text-center">System Qty</th>
                                    <th className="px-4 py-2 text-center">Physical Qty</th>
                                    <th className="px-4 py-2 text-center">Variance</th>
                                    <th className="px-4 py-2 text-left">Batches Found</th>
                                    <th className="px-4 py-2 text-center">Pkg Condition</th>
                                    <th className="px-4 py-2 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.lineItems.map((line, idx) => {
                                    const systemQty = line.systemQty || 0;
                                    const physicalQty = line.physicalQty ?? systemQty;
                                    const variance = physicalQty - systemQty;
                                    return (
                                      <tr
                                        key={`${entry.id}-line-${idx}`}
                                        className="border-b border-slate-100 hover:bg-blue-50/40"
                                      >
                                        <td className="px-4 py-2 align-middle">
                                          <p className="text-[12px] font-semibold text-slate-900">{line.name}</p>
                                          <p className="text-[10px] text-slate-500">{line.itemCode ?? entry.request.code}</p>
                                        </td>
                                        <td className="px-4 py-2 align-middle text-[11px] text-slate-700">{line.zone} · {line.rack}</td>
                                        <td className="px-4 py-2 align-middle text-center text-[11px] text-slate-800">{systemQty}</td>
                                        <td className="px-4 py-2 align-middle text-center text-[11px] text-slate-800">{physicalQty}</td>
                                        <td className="px-4 py-2 align-middle text-center text-[11px] text-slate-800">
                                          {variance}
                                        </td>
                                        <td className="px-4 py-2 align-middle text-[11px] text-emerald-700">{line.batchNo}</td>
                                        <td className="px-4 py-2 align-middle text-center text-[11px]">
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-semibold">
                                            {line.packagingCondition}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2 align-middle text-center text-[11px]">
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-semibold">
                                            OK
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {entry.lineItems.length === 0 && (
                                    <tr>
                                      <td
                                        className="px-4 py-4 text-center text-[11px] text-slate-500"
                                        colSpan={8}
                                      >
                                        No items to show for this stock check.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* Footer actions */}
                            <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
                              <p className="text-[11px] text-slate-600">
                                All filters verified. Batch details confirmed with COA on file.
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <button
                                  onClick={() => {
                                    setSelectedStockCheckRequest(entry.request);
                                    setSelectedStockCheckItemName(null);
                                  }}
                                  className="px-3 py-1.5 rounded-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                                >
                                  View Details
                                </button>
                                {/* Primary stock check action: Start -> Mark Complete */}
                                {entry.status !== 'Completed' && (
                                  <button
                                    onClick={() => {
                                      if (entry.status === 'Assigned') {
                                        // Start the stock check and open the physical quantity update modal
                                        updateProcurementState((current) => ({
                                          stockCheckStatuses: {
                                            ...current.stockCheckStatuses,
                                            [entry.request.id]: 'In Progress',
                                          },
                                        }));
                                        setUpdateStockCheckRequest(entry.request);
                                        addToast('success', `${entry.id} started. You can now update physical quantities.`);
                                      } else {
                                        // In Progress -> Completed
                                        updateProcurementState((current) => ({
                                          stockCheckStatuses: {
                                            ...current.stockCheckStatuses,
                                            [entry.request.id]: 'Completed',
                                          },
                                        }));
                                        addToast('success', `${entry.id} marked as Completed.`);
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-full border text-emerald-800 hover:bg-emerald-100 text-[11px] ${
                                      entry.status === 'Assigned'
                                        ? 'border-sky-400 bg-sky-50 text-sky-800 hover:bg-sky-100'
                                        : 'border-emerald-400 bg-emerald-50'
                                    }`}
                                  >
                                    {entry.status === 'Assigned' ? 'Start Check' : 'Mark Complete'}
                                  </button>
                                )}
                                {/* Keep Update Physical Qty available for manual adjustments once check is in progress/completed */}
                                {(entry.status === 'In Progress' || entry.status === 'Completed') && (
                                  <button
                                    onClick={() => {
                                      if (entry.status === 'Assigned') {
                                        updateProcurementState((current) => ({
                                          stockCheckStatuses: {
                                            ...current.stockCheckStatuses,
                                            [entry.request.id]: 'In Progress',
                                          },
                                        }));
                                      }
                                      setUpdateStockCheckRequest(entry.request);
                                      addToast('info', `${entry.id} opened for physical quantity update.`);
                                    }}
                                    className="px-3 py-1.5 rounded-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                                  >
                                    Update Physical Qty
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        ))}
                        {filteredStockChecks.length === 0 && (
                          <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500 shadow-sm text-[11px]">
                            No stock checks match current filters.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}

              {sideSection === 'Item Tracker' && (
                <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                  <p className="text-sm text-slate-700 mb-3">Tracking all {new Set(requests.flatMap(r => r.items)).size} unique items across requests:</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(requests.flatMap(r => r.items))).map((item, idx) => (
                      <span key={idx} className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold">{item}</span>
                    ))}
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
                    🔥 {po.poNumber} – {po.vendorName}
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

                {/* Status Timeline */}
                {po.timeline && po.timeline.length > 0 && (
                  <div>
                    <p className="text-[10px] tracking-[0.14em] text-slate-500 uppercase mb-3">Status Timeline</p>
                    <div className="relative pl-12 space-y-6">
                      {/* vertical line */}
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
                      {po.timeline.map((step, idx) => {
                        const isActive = po.status === step.stage;
                        return (
                          <div key={idx} className="relative">
                            {/* Circle - positioned absolutely on the line */}
                            <div className={`absolute -left-8 top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm z-10 ${
                              step.done
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : isActive
                                ? 'bg-orange-400 border-orange-400 text-white'
                                : 'bg-white border-slate-300 text-slate-300'
                            }`}>
                              {step.done ? '✓' : isActive ? '●' : ''}
                            </div>
                            {/* Content */}
                            <div className="pb-1">
                              <p className={`text-sm font-bold ${
                                step.done ? 'text-slate-900' : isActive ? 'text-orange-600' : 'text-slate-400'
                              }`}>{step.stage}</p>
                              {step.timestamp && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {step.timestamp}
                                  {step.actor && (
                                    <span className="text-slate-600 font-medium"> · {step.actor}</span>
                                  )}
                                </p>
                              )}
                              {step.note && (
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{step.note}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-blue-200 px-5 py-3 flex items-center justify-end gap-2">
                {po.status === 'Delivered' && (
                  <button
                    onClick={() => {
                      addToast('success', `GRN process started for ${po.poNumber}`);
                      setSelectedPO(null);
                      applyRouteState('Procurement', 'GRN Monitor');
                    }}
                    className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 transition"
                  >
                    Start GRN →
                  </button>
                )}
                {(po.status === 'Shipped' || po.status === 'Advance Paid') && (
                  <button
                    onClick={() => {
                      addToast('info', `Tracking ${po.poNumber} — ETA ${po.etaDays} days`);
                    }}
                    className="px-4 py-2 rounded-lg border border-blue-300 text-blue-700 text-sm font-semibold hover:bg-blue-50 transition"
                  >
                    Track Shipment
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
                    📄 {dpo.dpoNumber}
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
                    <span>{dpo.alertType === 'warning' ? '⚠️' : '✓'}</span>
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
                {dpo.status === 'Pending Approval' && (
                  <button
                    onClick={() => {
                      approveDraftPO(dpo.id);
                      setSelectedDraftPO(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition"
                  >
                    ✓ Approve
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
                      🚀 Release PO to Vendor
                    </button>
                    <button
                      onClick={() => splitDraftPO(dpo.id)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                    >
                      ✂ Split PO
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
                  ✂ Split PO
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
                🚀 Release PO
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
                </div>

                {/* Items Requested - Detailed */}
                {req.itemDetails && req.itemDetails.length > 0 ? (
                  <div>
                    <h3 className="text-xs tracking-wider text-slate-600 uppercase mb-3 font-bold">Items Requested</h3>
                    <div className="space-y-4">
                      {req.itemDetails.map((item, idx) => (
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
                        <span className="text-amber-600 text-sm">⚠️</span>
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
                    setSelectedRequest(null);
                    applyRouteState('Procurement', 'Requests');
                    addToast('info', `Editing ${req.code}`);
                  }}
                  className="px-4 py-2 rounded-lg border border-blue-300 text-slate-700 text-sm font-semibold hover:bg-blue-50 transition"
                >
                  ✏️ Edit Request
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
                      Draft PO →
                    </button>
                  )}

                  {canReleasePO && (
                    <button
                      onClick={() => {
                        updateRequestStatus(req.id, 'PO Released');
                        addToast('success', `PO released for ${req.code}`);
                        setSelectedRequest(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition shadow-lg"
                    >
                      Release PO ↗
                    </button>
                  )}

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
                  💬 All {req.description ?? 'requested'} stocks verified. Batch details confirmed with COA on file.
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


