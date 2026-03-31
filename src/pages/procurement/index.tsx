import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { useGlobalState } from '../../context/GlobalStateContext';
import logoFull from '../../assets/logo/eilogofull.svg';
import procurementData from '../../mocks/procurement-data.json';
import { fetchProcurementRequests as fetchProcurementRequestsApi, updateProcurementRequest as updateProcurementRequestApi } from '../../services/procurement.service';
import type { ProcurementRequestItem as BackendPRItem, ProcurementRequest as ApiProcurementRequest } from '../../services/procurement.service';
import {
  fetchProcurementQuotations,
  fetchQuoteLineDefaults,
  createProcurementQuotation,
  deleteProcurementQuotation,
} from '../../services/procurementQuotations.service';
import { fetchVendorClients } from '../../services/vendorClient.service';
import { fetchPurchaseOrders, createPurchaseOrder, updatePurchaseOrder } from '../../services/salesPurchase.service';
import { fetchPoTracking, updatePoTracking } from '../../services/poTracking.service';
import type { PoTrackingRecord } from '../../services/poTracking.service';
import { createGRN, fetchGRNList, type GRNRecordFromApi } from '../../services/grn.service';
import { fetchWarehouseInventory } from '../../services/warehouseInventory.service';
import {
  fetchPriceListPage,
  createItemList,
  createItemListRate,
  createItemListTier,
  updateItemListTier,
  updateItemListRate,
  type PriceListItemPage,
} from '../../services/itemsList.service';
import { fetchRawMaterialsList, type RawMaterialRecord } from '../../services/rawMaterials.service';
import { fetchPackMaterialsList, type PackMaterialRecord } from '../../services/packMaterials.service';
import {
  mapBackendPrToRequest,
  mapBackendQuotationToQuote,
  mapVendorClientToVendor,
  mapOrderToPurchaseOrder,
  mapPurchaseOrderToDraftPO,
  draftLineItemsToPurchaseOrderItems,
  assignPrItemToDraftLines,
  matchBackendPrItemForDraftLine,
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
  ReleaseToPlannedItem,
  QuoteLine,
} from '../../types/procurement.types';
import StockCheckUpdateModal from './StockCheckUpdateModal';
import ProcurementVendors from './ProcurementVendors';
import ProcurementReports from './ProcurementReports';
import {
  PAYMENT_TERMS_TYPE_OPTIONS,
  formatPaymentTermsString,
  parsePaymentTermsString,
  paymentTermsTypeRequiresAdvancePercent,
  validateAdvancePercentForType,
  type PaymentTermsStructuredType,
} from '../../lib/paymentTermsStructured';
import { PaymentTermsDisplay } from '../../components/procurement/PaymentTermsDisplay';

const DRAFT_POS_SEED: DraftPO[] = (procurementData as any).draftPOs as DraftPO[];
const PROCUREMENT_LIVE_KEY = 'eiadmin.procurement.live.v1';
const ENABLE_PROCUREMENT_LOCAL_PERSISTENCE =
  typeof import.meta.env?.VITE_ENABLE_PROCUREMENT_LOCAL_PERSISTENCE === 'string'
    && import.meta.env.VITE_ENABLE_PROCUREMENT_LOCAL_PERSISTENCE === '1';
const DEBUG_PROC_RELEASE = import.meta.env.DEV;

/** Shared React Query key ['procurement-requests'] must always hold an array; unwrap mistaken ServiceResult or wrapped shapes. */
function coerceProcurementRequestRows(value: unknown): ApiProcurementRequest[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as ApiProcurementRequest[];
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as ApiProcurementRequest[];
    if (Array.isArray(o.requests)) return o.requests as ApiProcurementRequest[];
  }
  return [];
}

/** Avoid setDraftPOs on every purchase-orders refetch when mapped drafts are logically unchanged (prevents update-depth loops + flickering ids). */
function draftPOsFromApiSyncKey(list: DraftPO[]): string {
  try {
    const byId = [...list].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return JSON.stringify(
      byId.map((d) => ({
        id: d.id,
        dpoNumber: d.dpoNumber,
        backendPoId: d.backendPoId ?? '',
        requestId: d.requestId,
        requestCode: d.requestCode,
        vendorId: d.vendorId,
        vendor: d.vendor,
        type: d.type,
        status: d.status,
        paymentTerms: d.paymentTerms,
        expectedDelivery: d.expectedDelivery,
        deliveryAddress: d.deliveryAddress,
        createdDate: d.createdDate,
        createdBy: d.createdBy,
        vendorRating: d.vendorRating,
        alertMessage: d.alertMessage,
        alertType: d.alertType,
        subtotal: d.subtotal,
        gstTotal: d.gstTotal,
        grandTotal: d.grandTotal,
        lineItems: [...d.lineItems]
          .sort((a, b) => String(a.itemCode || a.item).localeCompare(String(b.itemCode || b.item)))
          .map((l) => ({
            item: l.item,
            itemCode: l.itemCode,
            type: l.type,
            qty: l.qty,
            leadTimeDays: l.leadTimeDays,
            pricePerUnit: l.pricePerUnit,
            gstPercent: l.gstPercent,
            gstAmount: l.gstAmount,
            lineTotal: l.lineTotal,
            raw_material_id: l.raw_material_id,
            pack_material_id: l.pack_material_id,
          })),
      })),
    );
  } catch {
    return `n:${list.length}`;
  }
}

/** Vendor quote line vs PR line in Release to PO Planned Stage — RM/PM id match only when IDs exist on the PR line. */
function quoteLineMatchesReleaseTarget(line: QuoteLine, rel: ReleaseToPlannedItem): boolean {
  const rm = rel.raw_material_id;
  const pm = rel.pack_material_id;
  if (Number.isFinite(Number(rm)) && Number(rm) > 0 && line.raw_material_id != null && Number(line.raw_material_id) === Number(rm)) {
    return true;
  }
  if (Number.isFinite(Number(pm)) && Number(pm) > 0 && line.pack_material_id != null && Number(line.pack_material_id) === Number(pm)) {
    return true;
  }
  const nameKey = (rel.itemName ?? '').trim().toLowerCase();
  const codeKey = (rel.itemCode ?? '').trim().toLowerCase();
  const lineName = (line.item ?? '').trim().toLowerCase();
  const lineCode = (line.itemId ?? '').trim().toLowerCase();
  // Exact name/code only (no substring match) — avoids split-PO style bugs like "new rm mat" ↔ "new rm mat22".
  if (nameKey.length > 0 && lineName.length > 0 && lineName === nameKey) return true;
  if (codeKey.length > 0 && lineCode.length > 0 && lineCode === codeKey) return true;
  return false;
}

function extractMasterCodeFromText(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const m = s.match(/EI-[A-Z0-9-]+/i);
  return m && m[0] ? m[0].toUpperCase() : '';
}

function resolveItemCodeFromSources(
  sources: unknown[],
  fallbackType: RequestType,
  fallbackIndex: number
): string {
  for (const src of sources) {
    const code = extractMasterCodeFromText(src);
    if (code) return code;
  }
  return `EI-${fallbackType}-${String(fallbackIndex + 1).padStart(3, '0')}`;
}

function resolveMasterIdsFromRawItem(raw: any): {
  raw_material_id?: number;
  pack_material_id?: number;
  product_id?: number;
} {
  const rm = raw?.raw_material_id != null ? Number(raw.raw_material_id) : NaN;
  const pm = raw?.pack_material_id != null ? Number(raw.pack_material_id) : NaN;
  const pr = raw?.product_id != null ? Number(raw.product_id) : NaN;
  return {
    ...(Number.isFinite(rm) && rm > 0 ? { raw_material_id: rm } : {}),
    ...(Number.isFinite(pm) && pm > 0 ? { pack_material_id: pm } : {}),
    ...(Number.isFinite(pr) && pr > 0 ? { product_id: pr } : {}),
  };
}

const MAIN_TABS: MainTab[] = ['Procurement', 'Vendors', 'Reports'];
const SIDE_SECTIONS: SideSection[] = ['Overview', 'Requests', 'Quotations', 'Draft POs', 'Issued POs', 'GRN Monitor', 'Item Tracker'];

/**
 * Procurement requests whose released POs should appear under Issued POs.
 * Includes Under GRN: marking one split PO delivered sets the whole PR to Under GRN, but sibling POs (e.g. …-S2) must stay visible.
 * Individual PO rows are removed from the Issued list once that PO is marked delivered at warehouse (see `isIssuedPoHandedOffToWarehouse`).
 */
const REQUEST_STATUSES_FOR_ISSUED_PO_LIST: readonly RequestStatus[] = [
  'PO Released',
  'Delivery Pending',
  'Under GRN',
];

function requestStatusShowsIssuedPOs(status: RequestStatus): boolean {
  return REQUEST_STATUSES_FOR_ISSUED_PO_LIST.includes(status);
}

/** True when payment terms include an advance % (cannot issue PO until advance is recorded in PO tracking). */
function draftPaymentTermsRequireAdvance(paymentTerms: string | undefined | null): boolean {
  const { type } = parsePaymentTermsString(paymentTerms);
  return paymentTermsTypeRequiresAdvancePercent(type);
}

/** Normalise PO number for matching GRN poNo ↔ issued card poNumber. */
function normPoNumberKeyForTimeline(n: string) {
  return String(n ?? '').trim().replace(/^PO-?/i, '').replace(/^DPO-?/i, '');
}

/** Matches DPO-001, DPO-001-S1, etc. — use the first numeric block after `DPO-`. */
const DPO_ORDER_ID_SEQUENCE_RE = /^DPO-(\d+)/i;

/**
 * Next `order_id` for a new draft PO. Uses every persisted PO (`purchaseOrders`), any status — not `draftPOs.length`:
 * released rows still hold `DPO-###` in the DB but disappear from the Draft-only list, which used to reuse numbers.
 */
function nextSequentialDpoOrderId(
  allPurchaseOrders: Array<{ poNumber?: string }>,
  localDraftPOs?: Array<{ id?: string; dpoNumber?: string }>,
): string {
  let maxSeq = 0;
  const consider = (raw: string | undefined | null) => {
    const s = String(raw ?? '').trim();
    const m = s.match(DPO_ORDER_ID_SEQUENCE_RE);
    if (!m) return;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) maxSeq = Math.max(maxSeq, n);
  };
  for (const p of allPurchaseOrders) consider(p.poNumber);
  if (localDraftPOs?.length) {
    for (const d of localDraftPOs) {
      consider(d.id);
      consider(d.dpoNumber);
    }
  }
  return `DPO-${String(maxSeq + 1).padStart(3, '0')}`;
}

type IssuedPoTimelineOverride = { shipped?: boolean; delivered?: boolean; underGrn?: boolean };

function hasPoTrackingTimestamp(v: unknown): boolean {
  return v != null && String(v).trim() !== '';
}

/**
 * True when this PO has been marked delivered at warehouse (or is under GRN in the warehouse flow).
 * Used to hide the row from Issued POs — the PO is tracked in GRN Monitor / Inbound instead.
 * Per backend PO id so split POs (e.g. S1 vs S2) are handled independently.
 */
function isIssuedPoHandedOffToWarehouse(
  record: { backendPoId?: string },
  trackingById: Record<string, PoTrackingRecord> | undefined,
  unlinkedOverrides: Record<string, IssuedPoTimelineOverride> | undefined,
): boolean {
  const raw = record.backendPoId != null ? String(record.backendPoId) : '';
  const bid = raw.replace(/^PO-/, '');
  if (!bid || !/^\d+$/.test(bid)) return false;

  const tracking = trackingById?.[bid];
  if (tracking) {
    if (
      hasPoTrackingTimestamp(tracking.deliveredAt) ||
      hasPoTrackingTimestamp(tracking.underGrnAt) ||
      hasPoTrackingTimestamp(tracking.grnCompleteAt)
    ) {
      return true;
    }
  }
  const ov = unlinkedOverrides?.[bid];
  if (ov?.delivered || ov?.underGrn) return true;
  return false;
}

/**
 * Highest completed step index for Issued PO cards (0 = PO Released … 6 = GRN Complete).
 * Uses po-tracking timestamps; GRN Complete also when warehouse GRN list shows GRN Complete for this PO.
 */
function issuedPoCardTimelineCompletedIndex(
  recordStatus: string,
  tracking: PoTrackingRecord | null | undefined,
  ov: IssuedPoTimelineOverride | undefined,
  grnCompleteForPo: boolean,
): number {
  const has = (v: unknown) => v != null && String(v).trim() !== '';
  let idx = 0;
  if (tracking) {
    if (has(tracking.advancePaidAt)) idx = 1;
    if (has(tracking.vendorConfirmedAt)) idx = Math.max(idx, 2);
    if (has(tracking.shippedAt) || ov?.shipped) idx = Math.max(idx, 3);
    if (has(tracking.deliveredAt) || ov?.delivered) idx = Math.max(idx, 4);
    if (has(tracking.underGrnAt) || ov?.underGrn) idx = Math.max(idx, 5);
    if (has(tracking.grnCompleteAt) || grnCompleteForPo) idx = Math.max(idx, 6);
  } else {
    if (ov?.shipped) idx = Math.max(idx, 3);
    if (ov?.delivered) idx = Math.max(idx, 4);
    if (ov?.underGrn) idx = Math.max(idx, 5);
    if (grnCompleteForPo) idx = Math.max(idx, 6);
  }
  if (idx > 0) return idx;
  if (recordStatus === 'In Transit' || recordStatus === 'At Risk') return 3;
  return 0;
}

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

  if (!ENABLE_PROCUREMENT_LOCAL_PERSISTENCE) {
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
  /** Requests tab: All = no status filter; Active = exclude PO Released; else match exact status */
  const [requestTab, setRequestTab] = useState<'All' | 'Active' | RequestStatus>('All');
  const [draftPOStatusFilter, setDraftPOStatusFilter] = useState<'All Statuses' | 'Pending Approval' | 'Approved'>('All Statuses');
  const [draftPOSearch, setDraftPOSearch] = useState('');
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
  /** In PR View: which quotation is selected for "Create Draft PO" (dropdown) */
  const [selectedQuoteIdInPrView, setSelectedQuoteIdInPrView] = useState<string>('');
  const [editRequestTarget, setEditRequestTarget] = useState<ProcurementRequest | null>(null);
  const [editRequestForm, setEditRequestForm] = useState<{
    priority: RequestPriority;
    requiredByDate: string;
    notes: string;
    status: RequestStatus;
    preferredVendor: string;
    /** Quote id to use when creating Draft PO — deterministic price from this quotation */
    selectedQuotationId: string;
    items: BackendPRItem[];
  }>({ priority: 'Medium', requiredByDate: '', notes: '', status: 'New', preferredVendor: '', selectedQuotationId: '', items: [] });
  const [editDraftPOTarget, setEditDraftPOTarget] = useState<DraftPO | null>(null);
  const [editDraftPOForm, setEditDraftPOForm] = useState<Pick<DraftPO, 'vendor' | 'paymentTerms' | 'expectedDelivery' | 'deliveryAddress' | 'lineItems'>>({ vendor: '', paymentTerms: '', expectedDelivery: '', deliveryAddress: '', lineItems: [] });
  const [poTrackingForm, setPoTrackingForm] = useState<Partial<PoTrackingRecord>>({});
  const [selectedStockCheckRequest, setSelectedStockCheckRequest] = useState<ProcurementRequest | null>(null);
  const [selectedStockCheckItemName, setSelectedStockCheckItemName] = useState<string | null>(null);
  const [updateStockCheckRequest, setUpdateStockCheckRequest] = useState<ProcurementRequest | null>(null);
  const [stockCheckForm, setStockCheckForm] = useState<{ assignedTo: string; status: string; dueDate: string; notes: string }>({ assignedTo: '', status: '', dueDate: '', notes: '' });
  const [stockCheckSaving, setStockCheckSaving] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showRecordQuoteModal, setShowRecordQuoteModal] = useState(false);
  const [recordQuoteForm, setRecordQuoteForm] = useState<{
    vendorId: string;
    quoteDate: string;
    validTill: string;
    leadTimeDays: string;
    notes: string;
  }>({
    vendorId: '',
    quoteDate: '',
    validTill: '',
    leadTimeDays: '',
    notes: '',
  });
  const [recordQuoteLines, setRecordQuoteLines] = useState<
    {
      index: number;
      itemId: string;
      name: string;
      uom: string;
      orderQty: string;
      pricePerUnit: string;
      totalValue: number;
      raw_material_id?: number | null;
      pack_material_id?: number | null;
      itemType?: 'RM' | 'PM';
    }[]
  >([]);

  const [editItemsListLineTarget, setEditItemsListLineTarget] = useState<{
    itemsListId: number;
    rateId: number;
    tierId: number;
    vendorId: number;
    vendorName: string;
    requestType: RequestType;
    itemName: string;
    itemCode: string;
    moqMin: number;
    moqMax: number | null;
    pricePerUnit: number;
    paymentTerms: string;
  } | null>(null);
  const [editItemsListLineSaving, setEditItemsListLineSaving] = useState(false);
  const [editItemsListLineForm, setEditItemsListLineForm] = useState<{
    pricePerUnit: string;
    moqMin: string;
    moqMax: string;
    paymentTerms: string;
  }>({ pricePerUnit: '', moqMin: '', moqMax: '', paymentTerms: '' });
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
  const [recordingAdvancePayment, setRecordingAdvancePayment] = useState(false);
  const [issuedSearch, setIssuedSearch] = useState('');
  const [issuedVendorFilter, setIssuedVendorFilter] = useState('All Vendors');
  const [issuedStatusFilter, setIssuedStatusFilter] = useState<'All' | 'Released' | 'In Transit' | 'At Risk'>('All');
  const [_issuedViewMode, _setIssuedViewMode] = useState<'Table' | 'Cards'>('Cards');
  const [grnCategoryFilter, setGrnCategoryFilter] = useState<'All' | RequestType>('All');
  const [grnVendorFilter, setGrnVendorFilter] = useState('All Vendors');
  const [grnStatusFilter, setGrnStatusFilter] = useState<'All' | 'Pending GRN' | 'Under GRN' | 'Completed'>('All');
  const [grnSearch, setGrnSearch] = useState('');
  const [itemTrackerCategory, setItemTrackerCategory] = useState<'All' | RequestType>('All');
  const [itemTrackerVendor, setItemTrackerVendor] = useState('All Vendors');
  const [itemTrackerStatus, setItemTrackerStatus] = useState<'All Statuses' | RequestStatus>('All Statuses');
  const [itemTrackerSearch, setItemTrackerSearch] = useState('');
  const [releaseToPlannedTarget, setReleaseToPlannedTarget] = useState<{ request: ProcurementRequest; item: ReleaseToPlannedItem } | null>(null);
  const [releaseToPlannedForm, setReleaseToPlannedForm] = useState<{
    vendor: string;
    moqDisplay: string;
    qty: string;
    unitPrice: string;
    paymentTermsType: PaymentTermsStructuredType;
    advancePercent: string;
    leadTimeDays: number;
  }>({
    vendor: '',
    moqDisplay: '',
    qty: '',
    unitPrice: '',
    paymentTermsType: 'as_per_contract',
    advancePercent: '50',
    leadTimeDays: 0,
  });
  const [releaseToPlannedNotes, setReleaseToPlannedNotes] = useState('');
  const [releaseToPlannedLineEdits, setReleaseToPlannedLineEdits] = useState<Array<{
    itemName: string;
    itemCode: string;
    type: RequestType;
    qty: number;
    unit: string;
    moq: number;
    unitPrice: number;
    leadDays: number;
    raw_material_id?: number;
    pack_material_id?: number;
  }>>([]);

  /**
   * For Draft POs created from Planning > Items Involved, we release a purchase order without
   * having a linked backend `procurement_requests` row. Those PO entries still show up in
   * "Issued POs", but timeline visuals must be driven by the actions that update po-tracking.
   *
   * Keyed by backend purchase_orders.id without the `PO-` prefix (i.e. the id used in `po-tracking` calls).
   */
  const [unlinkedPoTimelineOverrides, setUnlinkedPoTimelineOverrides] = useState<
    Record<string, { shipped: boolean; delivered: boolean; underGrn: boolean }>
  >({});

  const queryClient = useQueryClient();
  const { dispatch: globalDispatch } = useGlobalState();

  // Prevent double-click / race conditions from creating multiple GRNs for the same PO.
  // Keyed by `record.poNumber`.
  const receiveGrnLockRef = useRef<Record<string, boolean>>({});

  const { data: backendPrResult } = useQuery({
    queryKey: ['procurement-requests'],
    queryFn: async () => {
      const res = await fetchProcurementRequestsApi();
      return res.success ? coerceProcurementRequestRows(res.data) : [];
    },
  });

  const backendPrArray = useMemo(() => coerceProcurementRequestRows(backendPrResult), [backendPrResult]);

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
    enabled: sideSection === 'GRN Monitor' || sideSection === 'Issued POs',
  });

  const grnCompletePoNormSet = useMemo(() => {
    const set = new Set<string>();
    for (const g of grnListFromApi ?? []) {
      if (String(g.status || '').trim() === 'GRN Complete') {
        set.add(normPoNumberKeyForTimeline(g.poNo));
      }
    }
    return set;
  }, [grnListFromApi]);

  const { data: warehouseInventoryData, isLoading: warehouseInventoryLoading } = useQuery({
    queryKey: ['warehouse-inventory'],
    queryFn: async () => {
      const res = await fetchWarehouseInventory();
      return res.success ? res.data : null;
    },
    enabled: sideSection === 'Item Tracker' || !!selectedStockCheckRequest,
  });

  const { data: rawMaterialsListForQuote = [] } = useQuery({
    queryKey: ['raw-materials-list'],
    queryFn: () => fetchRawMaterialsList(),
    enabled: showRecordQuoteModal,
  });
  const { data: packMaterialsListForQuote = [] } = useQuery({
    queryKey: ['pack-materials-list'],
    queryFn: () => fetchPackMaterialsList(),
    enabled: showRecordQuoteModal,
  });

  const requestsFromApi = useMemo(
    () => backendPrArray.map(mapBackendPrToRequest),
    [backendPrArray]
  );
  const requestStockSummaryByRequestId = useMemo(() => {
    const whRows = warehouseInventoryData?.rows ?? [];
    const byReq = new Map<string, { stockInHand: number; openPOQty: number; inTransit: number; openOrders: number }>();
    if (!whRows.length) return byReq;

    const byRmId = new Map<number, typeof whRows[number]>();
    const byPmId = new Map<number, typeof whRows[number]>();
    const byCode = new Map<string, typeof whRows[number]>();
    const byName = new Map<string, typeof whRows[number]>();
    for (const row of whRows) {
      if (row.type === 'RM') byRmId.set(Number(row.sourceId), row);
      if (row.type === 'PM') byPmId.set(Number(row.sourceId), row);
      const codeKey = String(row.code ?? '').trim().toLowerCase();
      const nameKey = String(row.name ?? '').trim().toLowerCase();
      if (codeKey) byCode.set(codeKey, row);
      if (nameKey) byName.set(nameKey, row);
    }

    for (const req of requestsFromApi) {
      const detailRows = Array.isArray(req.itemDetails) ? req.itemDetails : [];
      let stockInHand = 0;
      let openPOQty = 0;
      let inTransit = 0;
      for (const item of detailRows) {
        let row: (typeof whRows[number]) | undefined;
        const rmId = item.raw_material_id != null ? Number(item.raw_material_id) : NaN;
        const pmId = item.pack_material_id != null ? Number(item.pack_material_id) : NaN;
        if (Number.isFinite(rmId) && rmId > 0) row = byRmId.get(rmId);
        if (!row && Number.isFinite(pmId) && pmId > 0) row = byPmId.get(pmId);
        if (!row) {
          const codeKey = String(item.itemCode ?? '').trim().toLowerCase();
          if (codeKey) row = byCode.get(codeKey);
        }
        if (!row) {
          const nameKey = String(item.itemName ?? '').trim().toLowerCase();
          if (nameKey) row = byName.get(nameKey);
        }
        if (!row) continue;
        stockInHand += Number(row.stockInHand) || 0;
        openPOQty += Number(row.poQuantity) || 0;
        inTransit += Number(row.inTransit) || 0;
      }
      byReq.set(req.id, {
        stockInHand,
        openPOQty,
        inTransit,
        openOrders: detailRows.reduce((sum, i) => sum + (Number(i.reqQty) || 0), 0),
      });
    }
    return byReq;
  }, [warehouseInventoryData?.rows, requestsFromApi]);

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

  /** All released backend PO ids — batch-fetch po-tracking so linked split POs show Delivered / GRN steps correctly. */
  const releasedPoBackendIdsForTracking = useMemo(() => {
    const ids = purchaseOrders
      .filter((p) => p.status === 'Released')
      .map((p) => String(p.id ?? '').replace(/^PO-/, ''))
      .filter((id) => /^\d+$/.test(id));
    return [...new Set(ids)].sort();
  }, [purchaseOrders]);

  const { data: releasedPoTrackingByBackendId } = useQuery({
    queryKey: ['po-tracking-released-map', releasedPoBackendIdsForTracking.join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        releasedPoBackendIdsForTracking.map(async (id) => {
          const res = await fetchPoTracking(id);
          return { id, tracking: res.success ? res.data : null };
        }),
      );
      return entries.reduce((acc, e) => {
        if (e.tracking) acc[e.id] = e.tracking;
        return acc;
      }, {} as Record<string, PoTrackingRecord>);
    },
    enabled: sideSection === 'Issued POs' && releasedPoBackendIdsForTracking.length > 0,
    staleTime: 30_000,
  });

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

  const releaseDraftBackendPoIdNormalized = useMemo(() => {
    const raw = releasePOTarget?.backendPoId;
    if (raw == null) return '';
    const s = String(raw).replace(/^PO-/, '').trim();
    return /^\d+$/.test(s) ? s : '';
  }, [releasePOTarget?.backendPoId]);

  const releaseDraftRequiresAdvance = Boolean(
    releasePOTarget && draftPaymentTermsRequireAdvance(releasePOTarget.paymentTerms),
  );

  const { data: releaseDraftTracking, isFetching: releaseDraftTrackingLoading, refetch: refetchReleaseDraftTracking } = useQuery({
    queryKey: ['po-tracking', 'release-draft', releaseDraftBackendPoIdNormalized],
    queryFn: async () => {
      const res = await fetchPoTracking(releaseDraftBackendPoIdNormalized);
      return res.success ? res.data : null;
    },
    enabled: Boolean(releasePOTarget && releaseDraftRequiresAdvance && releaseDraftBackendPoIdNormalized),
    staleTime: 15_000,
  });

  const advanceRecordedForReleaseDraft = Boolean(
    releaseDraftTracking?.advancePaidAt != null && String(releaseDraftTracking.advancePaidAt).trim() !== '',
  );

  const needItemsListForQuotesOrDraftPO =
    sideSection === 'Quotations' ||
    sideSection === 'Draft POs' ||
    sideSection === 'Requests' ||
    !!selectedDraftPO ||
    !!selectedRequest;
  const { data: itemsListRm = [] } = useQuery({
    queryKey: ['items-list-page', 'RM'],
    queryFn: async () => {
      const res = await fetchPriceListPage('RM');
      return res.success ? res.data ?? [] : [];
    },
    enabled: needItemsListForQuotesOrDraftPO,
  });
  const { data: itemsListPm = [] } = useQuery({
    queryKey: ['items-list-page', 'PM'],
    queryFn: async () => {
      const res = await fetchPriceListPage('PM');
      return res.success ? res.data ?? [] : [];
    },
    enabled: needItemsListForQuotesOrDraftPO,
  });

  const vendorItemPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    const add = (item: PriceListItemPage) => {
      const code = (item.code ?? '').trim().toLowerCase();
      const name = (item.name ?? '').trim().toLowerCase();
      item.vendorRates?.forEach((rate) => {
        const vendorName = (rate.vendor_name ?? '').trim().toLowerCase();
        if (!vendorName) return;
        const price = rate.tiers?.[0]?.price_per_unit;
        if (price != null && !Number.isNaN(Number(price))) {
          if (code) map.set(`${code}|${vendorName}`, Number(price));
          if (name) map.set(`${name}|${vendorName}`, Number(price));
        }
      });
    };
    (itemsListRm ?? []).forEach(add);
    (itemsListPm ?? []).forEach(add);
    return map;
  }, [itemsListRm, itemsListPm]);

  const draftPOSidebarTotals = useMemo(() => {
    if (!selectedDraftPO) return null;
    const vendorNorm = (selectedDraftPO.vendor ?? '').trim().toLowerCase();
    const gstPercent = 18;
    const confirmedQuote = selectedDraftPO.requestId
      ? quotes.find((q) => q.requestId === selectedDraftPO.requestId && q.status === 'Confirmed')
      : null;
    const enrichedLines: DraftPOLineItem[] = selectedDraftPO.lineItems.map((line) => {
      const qty = parseFloat(String(line.qty).replace(/[^\d.]/g, '')) || 0;
      const nameNorm = (line.item ?? '').trim().toLowerCase();
      const codeNorm = (line.itemCode ?? '').trim().toLowerCase();
      let price: number | undefined;
      if (confirmedQuote?.lines?.length) {
        const quoteLine = confirmedQuote.lines.find((l) => {
          const q = (l.item ?? '').trim().toLowerCase();
          if (!q) return false;
          return q === nameNorm || q === codeNorm || (nameNorm && (nameNorm.includes(q) || q.includes(nameNorm))) || (codeNorm && q.includes(codeNorm));
        });
        if (quoteLine != null && typeof quoteLine.pricePerUnit === 'number') price = quoteLine.pricePerUnit;
      }
      if (price == null && vendorNorm) {
        price =
          (codeNorm && vendorItemPriceMap.get(`${codeNorm}|${vendorNorm}`)) ??
          (nameNorm && vendorItemPriceMap.get(`${nameNorm}|${vendorNorm}`));
      }
      const priceFromList = price ?? line.pricePerUnit ?? 0;
      const subtotal = qty * priceFromList;
      const gstAmount = parseFloat((subtotal * (gstPercent / 100)).toFixed(2));
      const lineTotal = parseFloat((subtotal + gstAmount).toFixed(2));
      return {
        ...line,
        pricePerUnit: priceFromList,
        gstPercent,
        gstAmount,
        lineTotal,
      };
    });
    const subtotal = parseFloat(enrichedLines.reduce((s, l) => s + (l.lineTotal - l.gstAmount), 0).toFixed(2));
    const gstTotal = parseFloat(enrichedLines.reduce((s, l) => s + l.gstAmount, 0).toFixed(2));
    const grandTotal = parseFloat((subtotal + gstTotal).toFixed(2));
    return { lineItems: enrichedLines, subtotal, gstTotal, grandTotal };
  }, [selectedDraftPO, quotes, vendorItemPriceMap]);

  const isProcurementDataLoading =
    vendorClientList === undefined ||
    purchaseOrdersRaw === undefined ||
    (sideSection !== 'Quotations' && (backendPrResult === undefined || quotationsResult === undefined));

  useEffect(() => {
    if (backendPrResult !== undefined) setRequests(requestsFromApi);
  }, [backendPrResult, requestsFromApi]);

  useEffect(() => {
    if (quotationsResult !== undefined) setQuotes(quotesFromApi);
  }, [quotationsResult, quotesFromApi]);

  const lastDraftPOsFromApiKeyRef = useRef<string>('');
  useEffect(() => {
    if (isProcurementDataLoading) {
      return;
    }
    const nextKey = draftPOsFromApiSyncKey(draftPOsFromApi);
    if (nextKey === lastDraftPOsFromApiKeyRef.current) {
      return;
    }
    lastDraftPOsFromApiKeyRef.current = nextKey;
    setDraftPOs(draftPOsFromApi);
  }, [isProcurementDataLoading, draftPOsFromApi]);

  /** Reset draft sync guard so the next PO list fetch always applies to `draftPOs` (covers approve/split/release and any mapper-only deltas). */
  const invalidatePurchaseOrdersQueries = useCallback(async () => {
    lastDraftPOsFromApiKeyRef.current = '';
    await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
  }, [queryClient]);

  useEffect(() => {
    if (!editRequestTarget) return;
    const backendPr = backendPrArray.find((p: { id: string }) => String(p.id) === editRequestTarget.id) as { items?: BackendPRItem[]; preferredVendor?: string } | undefined;
    const items = Array.isArray(backendPr?.items) ? backendPr.items.map((i) => ({ ...i })) : [];
    setEditRequestForm({
      priority: editRequestTarget.priority,
      requiredByDate: editRequestTarget.dueDate?.slice(0, 10) ?? '',
      notes: (backendPr as { notes?: string } | undefined)?.notes ?? '',
      status: editRequestTarget.status,
      preferredVendor: backendPr?.preferredVendor ?? '',
      selectedQuotationId: '',
      items,
    });
  }, [editRequestTarget, backendPrArray]);

  useEffect(() => {
    if (!selectedRequest) {
      setSelectedQuoteIdInPrView('');
      return;
    }
    const rq = quotes.filter((q) => q.requestId === selectedRequest.id);
    const conf = rq.find((q) => q.status === 'Confirmed');
    setSelectedQuoteIdInPrView(conf?.id ?? rq[0]?.id ?? '');
  }, [selectedRequest, quotes]);

  useEffect(() => {
    if (!selectedRequest || backendPrResult === undefined) {
      setStockCheckForm({ assignedTo: '', status: '', dueDate: '', notes: '' });
      return;
    }
    const pr = backendPrArray.find((p: { id: string }) => String(p.id) === selectedRequest.id) as {
      stockCheckAssignedTo?: string | null;
      stockCheckStatus?: string | null;
      stockCheckDueDate?: string | null;
      stockCheckNotes?: string | null;
    } | undefined;
    setStockCheckForm({
      assignedTo: pr?.stockCheckAssignedTo ?? '',
      status: pr?.stockCheckStatus ?? '',
      dueDate: pr?.stockCheckDueDate?.toString().slice(0, 10) ?? '',
      notes: pr?.stockCheckNotes ?? '',
    });
  }, [selectedRequest, backendPrResult, backendPrArray]);

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

  const backendPrs: ApiProcurementRequest[] = backendPrArray;

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

  const procurementUrlSyncKey = searchParams.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are procurementUrlSyncKey only; including `searchParams` can retrigger every render.
  useEffect(() => {
    const routeTab = getInitialMainTab(searchParams);
    const routeSection = getInitialSideSection(searchParams);
    setMainTab((prev) => (routeTab !== prev ? routeTab : prev));
    if (routeTab === 'Procurement') {
      setSideSection((prev) => (routeSection !== prev ? routeSection : prev));
    }
  }, [procurementUrlSyncKey]);

  const lastLiveStoragePayloadRef = useRef<string>('');
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!ENABLE_PROCUREMENT_LOCAL_PERSISTENCE) {
      try {
        window.localStorage.removeItem(PROCUREMENT_LIVE_KEY);
      } catch {
        // ignore storage cleanup errors
      }
      return;
    }

    const payloadKey = JSON.stringify({
      requests,
      quotes,
      draftPOs,
      completedGrns,
      stockCheckStatuses,
      stockCheckUpdates,
    });
    if (payloadKey === lastLiveStoragePayloadRef.current) {
      return;
    }
    lastLiveStoragePayloadRef.current = payloadKey;

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
    if (!ENABLE_PROCUREMENT_LOCAL_PERSISTENCE) {
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
    const issuedPos = requests.filter((request) => requestStatusShowsIssuedPOs(request.status)).length;
    const grnCount = Math.max(issuedPos, 1);
    const itemTracker = new Set(requests.flatMap((request) => request.items)).size;

    return {
      Overview: requestCount,
      Requests: requestCount,
      Quotations: quotationsCount,
      'Draft POs': draftPosCount,
      'Issued POs': issuedPos,
      'GRN Monitor': grnCount,
      'Item Tracker': itemTracker,
    };
  }, [draftPOs, quotes, requests]);

  const itemTrackerRows = useMemo<ItemTrackerRow[]>(() => {
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

      const draftCandidates = draftPOs.filter((d) => d.requestId === request.id);
      const releasedPosForRequest = purchaseOrders.filter(
        (p) =>
          p.status === 'Released' &&
          (String((p.formData as { requestId?: string } | undefined)?.requestId) === String(request.id) ||
            String((p.formData as { requestCode?: string } | undefined)?.requestCode).toUpperCase() ===
              String(request.code).toUpperCase() ||
            p.requestCode === request.code),
      );

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
        const norm = (s: string) => String(s ?? '').trim().toLowerCase();

        const po =
          releasedPosForRequest.find((p) => {
            const raw = Array.isArray(p.rawItems) ? (p.rawItems as { itemName?: string; name?: string; itemCode?: string; code?: string }[]) : [];
            return raw.some(
              (ri) =>
                (norm(ri.itemName ?? ri.name ?? '') && norm(ri.itemName ?? ri.name ?? '') === norm(itemName)) ||
                (!!detail.itemCode &&
                  norm(String(ri.itemCode ?? ri.code ?? '')) &&
                  norm(String(ri.itemCode ?? ri.code ?? '')) === norm(detail.itemCode)),
            );
          }) ??
          (releasedPosForRequest.length === 1 ? releasedPosForRequest[0] : null);

        const draftPo =
          draftCandidates.find((d) =>
            d.lineItems.some(
              (ln) => norm(ln.item) === norm(itemName) || (!!detail.itemCode && norm(ln.itemCode) === norm(detail.itemCode)),
            ),
          ) ?? (draftCandidates.length === 1 ? draftCandidates[0] : null);

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
        (row.poNumber ?? '').toLowerCase().includes(q) ||
        (row.preferredVendor ?? '').toLowerCase().includes(q) ||
        (row.quotedVendor ?? '').toLowerCase().includes(q)
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
        if (!linkedRequest || !requestStatusShowsIssuedPOs(linkedRequest.status)) {
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
        quote.lines.some(
          (line) =>
            line.item.toLowerCase().includes(query) ||
            String(line.itemId ?? '').toLowerCase().includes(query),
        )
      );
    });
  }, [categoryFilter, vendorFilter, statusFilter, searchQuery, quotes, sideSection, requests]);

  const itemsListQuotes = useMemo<VendorQuote[]>(() => {
    type TmpLine = QuoteLine & {
      vendorId: string;
      __itemsListId: number;
      __rateId: number;
      __tierId: number;
      __moqMin: number;
      __moqMax: number | null;
      __paymentTerms: string;
    };
    const bucket = new Map<string, { vendor: string; vendorId: string; requestType: RequestType; lines: TmpLine[]; terms?: string }>();
    const add = (type: RequestType, item: PriceListItemPage) => {
      const code = String(item.code ?? '').trim();
      const name = String(item.name ?? '').trim() || code;
      const unit = type === 'RM' ? (String(item.uom ?? 'KG') || 'KG') : 'PCS';
      (item.vendorRates ?? []).forEach((rate) => {
        const vendorName = String(rate.vendor_name ?? rate.vendor_code ?? '').trim();
        if (!vendorName) return;
        const vendorId = String(rate.vendor_id ?? '');
        const itemsListId = Number(item.itemsListId ?? item.itemsListId) || 0;
        if (!Number.isFinite(itemsListId) || itemsListId <= 0) return;
        const rateId = Number(rate.id) || 0;
        if (!Number.isFinite(rateId) || rateId <= 0) return;
        const key = `${vendorName.toLowerCase()}|${vendorId}|${type}`;
        const existing = bucket.get(key) ?? { vendor: vendorName, vendorId, requestType: type, lines: [], terms: (rate as any).payment_terms ?? '' };
        (rate.tiers ?? []).forEach((tier) => {
          const moq = Number(tier.moq_min ?? 0) || 0;
          const price = Number((tier as any).price_per_unit ?? 0) || 0;
          if (moq <= 0 || price <= 0) return;
          const tierId = Number(tier.id) || 0;
          if (!Number.isFinite(tierId) || tierId <= 0) return;
          existing.lines.push({
            item: name,
            itemId: code,
            unit,
            qty: String(moq),
            pricePerUnit: price,
            totalValue: moq * price,
            vsPlanned: '—',
            vendorId,
            raw_material_id: item.raw_material_id ?? undefined,
            pack_material_id: item.pack_material_id ?? undefined,
            __itemsListId: itemsListId,
            __rateId: rateId,
            __tierId: tierId,
            __moqMin: moq,
            __moqMax: tier.moq_max ?? null,
            __paymentTerms: String((rate as any).payment_terms ?? ''),
          });
        });
        bucket.set(key, existing);
      });
    };
    (itemsListRm ?? []).forEach((it) => add('RM', it));
    (itemsListPm ?? []).forEach((it) => add('PM', it));

    const out: VendorQuote[] = [];
    bucket.forEach((b) => {
      const lines = b.lines
        .sort((a, z) => a.item.localeCompare(z.item) || Number(a.qty) - Number(z.qty))
        // remove vendorId helper
        .map(({ vendorId: _vendorId, ...rest }) => rest);
      out.push({
        id: `IL-${b.requestType}-${b.vendorId}`,
        requestId: '',
        requestCode: 'ITEMS LIST',
        requestType: b.requestType,
        vendor: b.vendor,
        status: 'Confirmed',
        quotedOn: new Date().toISOString().slice(0, 10),
        leadTimeDays: 0,
        terms: String(b.terms ?? 'As per contract'),
        validTill: '—',
        rating: 0,
        fileName: '—',
        note: 'From Items List (vendor price list)',
        lines,
      });
    });
    return out;
  }, [itemsListPm, itemsListRm]);

  const filteredItemsListQuotes = useMemo(() => {
    return itemsListQuotes.filter((quote) => {
      if (categoryFilter !== 'All' && quote.requestType !== categoryFilter) return false;
      if (vendorFilter !== 'All Vendors' && quote.vendor !== vendorFilter) return false;
      if (statusFilter !== 'All Statuses' && quote.status !== statusFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      if (quote.vendor.toLowerCase().includes(q)) return true;
      if (quote.id.toLowerCase().includes(q)) return true;
      if (quote.requestCode.toLowerCase().includes(q)) return true;
      return (quote.lines ?? []).some((l) => String(l.item ?? '').toLowerCase().includes(q) || String(l.itemId ?? '').toLowerCase().includes(q));
    });
  }, [categoryFilter, itemsListQuotes, searchQuery, statusFilter, vendorFilter]);

  /** Quotations tab: show recorded procurement quotations (DB) and Items List–derived price cards. IL-* rows are not procurement_quotations rows. */
  const quotesForQuotationsSection = useMemo(() => {
    if (sideSection !== 'Quotations') return filteredQuotes;
    return [...filteredQuotes, ...filteredItemsListQuotes];
  }, [sideSection, filteredQuotes, filteredItemsListQuotes]);

  const openEditItemsListTier = (quote: VendorQuote, line: QuoteLine) => {
    const meta = line as QuoteLine & {
      __itemsListId?: number;
      __rateId?: number;
      __tierId?: number;
      __moqMin?: number;
      __moqMax?: number | null;
      __paymentTerms?: string;
    };
    const itemsListId = Number(meta.__itemsListId ?? 0) || 0;
    const rateId = Number(meta.__rateId ?? 0) || 0;
    const tierId = Number(meta.__tierId ?? 0) || 0;
    if (itemsListId <= 0 || rateId <= 0 || tierId <= 0) {
      addToast('error', 'This row is missing Items List linkage (itemsListId/rateId/tierId).');
      return;
    }
    const moqMin = Number(meta.__moqMin ?? 0) || 0;
    const moqMax = meta.__moqMax != null ? Number(meta.__moqMax) : null;
    const paymentTerms = String(meta.__paymentTerms ?? quote.terms ?? '');
    setEditItemsListLineTarget({
      itemsListId,
      rateId,
      tierId,
      vendorId: Number(String((quote as any).vendorId ?? '').replace(/[^\d]/g, '')) || Number((quote as any).vendorId) || 0,
      vendorName: quote.vendor,
      requestType: quote.requestType,
      itemName: String(line.item ?? ''),
      itemCode: String(line.itemId ?? ''),
      moqMin,
      moqMax,
      pricePerUnit: Number(line.pricePerUnit ?? 0) || 0,
      paymentTerms,
    });
    setEditItemsListLineForm({
      pricePerUnit: String(Number(line.pricePerUnit ?? 0) || ''),
      moqMin: String(moqMin || ''),
      moqMax: moqMax == null ? '' : String(moqMax),
      paymentTerms: paymentTerms || '',
    });
  };

  const saveEditItemsListTier = async () => {
    if (!editItemsListLineTarget) return;
    const itemsListId = editItemsListLineTarget.itemsListId;
    const rateId = editItemsListLineTarget.rateId;
    const tierId = editItemsListLineTarget.tierId;
    const nextPrice = Number(editItemsListLineForm.pricePerUnit || 0) || 0;
    const moqMaxRaw = String(editItemsListLineForm.moqMax ?? '').trim();
    const nextMoqMax = moqMaxRaw === '' ? null : (Number(moqMaxRaw) || 0);
    const nextPaymentTerms = String(editItemsListLineForm.paymentTerms ?? '').trim();
    if (nextPrice <= 0) {
      addToast('warning', 'Enter a valid price.');
      return;
    }
    setEditItemsListLineSaving(true);
    try {
      // Update payment terms at vendor-rate level (optional).
      if (nextPaymentTerms !== editItemsListLineTarget.paymentTerms) {
        const resRate = await updateItemListRate(String(itemsListId), rateId, { payment_terms: nextPaymentTerms });
        if (!resRate.success) {
          addToast('error', 'Failed to update payment terms.');
          return;
        }
      }

      // IMPORTANT: edit must update existing tier (no new tiers created from Procurement UI).
      const resTier = await updateItemListTier(String(itemsListId), rateId, tierId, {
        moq_max: nextMoqMax,
        price_per_unit: nextPrice,
        note: 'Edited from Procurement → Quotations',
      });
      if (!resTier.success) {
        addToast('error', 'Failed to update tier.');
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['items-list-page', 'RM'] });
      await queryClient.invalidateQueries({ queryKey: ['items-list-page', 'PM'] });
      addToast('success', 'Saved to Items List.');
      setEditItemsListLineTarget(null);
    } finally {
      setEditItemsListLineSaving(false);
    }
  };

  const filteredDraftPOs = useMemo(() => {
    const q = draftPOSearch.trim().toLowerCase();
    return draftPOs.filter((dpo) => {
      if (categoryFilter !== 'All' && dpo.type !== categoryFilter) return false;
      if (vendorFilter !== 'All Vendors' && dpo.vendor !== vendorFilter) return false;
      if (draftPOStatusFilter !== 'All Statuses' && dpo.status !== draftPOStatusFilter) return false;
      if (q) {
        const inHeader =
          String(dpo.dpoNumber ?? '').toLowerCase().includes(q) ||
          String(dpo.vendor ?? '').toLowerCase().includes(q) ||
          String((dpo as { requestCode?: string }).requestCode ?? '').toLowerCase().includes(q);
        const inLines = (dpo.lineItems ?? []).some(
          (l) =>
            String(l.item ?? '').toLowerCase().includes(q) ||
            String(l.itemCode ?? '').toLowerCase().includes(q),
        );
        if (!inHeader && !inLines) return false;
      }
      return true;
    });
  }, [draftPOs, categoryFilter, vendorFilter, draftPOStatusFilter, draftPOSearch]);

  /** Requests set to PO Draft via Edit Request but with no Draft PO created yet (create from PR modal + quotations) */
  const requestsPODraftNoDraftPO = useMemo(() => {
    const linkedRequestIds = new Set(draftPOs.map((d) => d.requestId));
    return requests.filter(
      (r) => r.status === 'PO Draft' && !linkedRequestIds.has(r.id)
    );
  }, [requests, draftPOs]);

  const quoteStats = useMemo(() => {
    const list = sideSection === 'Quotations' ? quotesForQuotationsSection : filteredQuotes;
    const totalQuotes = list.length;
    const confirmed = list.filter((quote) => quote.status === 'Confirmed').length;
    const notSelected = list.filter((quote) => quote.status === 'Not Selected').length;

    return {
      totalQuotes,
      confirmed,
      notSelected,
      urgent: requests.filter((request) => request.priority === 'High' && request.status === 'New').length,
      pendingAction: requests.filter((request) => request.status === 'New' || request.status === 'Quoted').length,
    };
  }, [filteredQuotes, quotesForQuotationsSection, requests, sideSection]);

  const issuedPORecords = useMemo(() => {
    const today = new Date();
    const normPoKey = (n: string) => String(n ?? '').trim().replace(/^PO-?/i, '').replace(/^DPO-?/i, '');

    const requestRecords = requests
      .filter((request) => requestStatusShowsIssuedPOs(request.status))
      .flatMap((request) => {
        const linkedQuote = quotes.find((quote) => quote.requestId === request.id && quote.status === 'Confirmed') ??
          quotes.find((quote) => quote.requestId === request.id);

        const releasedPosForRequest = purchaseOrders
          .filter(
            (p) =>
              p.status === 'Released' &&
              (String(p.formData?.requestId) === String(request.id) ||
                String(p.formData?.requestCode).toUpperCase() === String(request.code).toUpperCase()),
          )
          .sort((a, b) => {
            const na = parseInt(String(a.id).replace(/\D/g, ''), 10) || 0;
            const nb = parseInt(String(b.id).replace(/\D/g, ''), 10) || 0;
            return nb - na;
          });

        const etaDays = Math.ceil((new Date(request.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const computedStatus: 'Released' | 'In Transit' | 'At Risk' =
          request.status === 'Delivery Pending'
            ? 'In Transit'
            : etaDays < 0 || (request.priority === 'High' && etaDays <= 2)
              ? 'At Risk'
              : 'Released';

        const fallbackLineItems = request.items.map((item, index) => {
          const qtyNum = Number(request.itemDetails?.[index]?.reqQty) || 0;
          const pricePerUnit = linkedQuote?.lines?.[index]?.pricePerUnit ?? request.itemDetails?.[index]?.plannedPrice ?? 0;
          const gstPercent = 18;
          const subtotal = qtyNum * pricePerUnit;
          const gstAmount = parseFloat((subtotal * (gstPercent / 100)).toFixed(2));
          const lineTotal = parseFloat((subtotal + gstAmount).toFixed(2));
          return {
            item,
            itemCode: `EI-${request.type}-${String(index + 1).padStart(3, '0')}`,
            type: request.type,
            qty: request.itemDetails?.[index]?.reqQty ? `${request.itemDetails[index].reqQty}` : '—',
            pricePerUnit,
            gstPercent,
            gstAmount,
            lineTotal,
          };
        });

        const withQuotePrices = (lines: { item: string; itemCode: string; type: RequestType; qty: string; pricePerUnit: number; gstPercent: number; gstAmount: number; lineTotal: number }[]) =>
          linkedQuote?.lines?.length
            ? lines.map((ln, idx) => {
              const quoteLine = linkedQuote.lines[idx] ?? linkedQuote.lines.find((l) => l.item && String(l.item).trim() === String(ln.item).trim());
              const pricePerUnit = (quoteLine && typeof quoteLine.pricePerUnit === 'number') ? quoteLine.pricePerUnit : ln.pricePerUnit;
              const qty = parseFloat(String(ln.qty).replace(/[^\d.]/g, '')) || 0;
              const subtotal = qty * pricePerUnit;
              const gstPercent = 18;
              const gstAmount = parseFloat((subtotal * (gstPercent / 100)).toFixed(2));
              const lineTotal = parseFloat((subtotal + gstAmount).toFixed(2));
              return { ...ln, pricePerUnit, gstPercent, gstAmount, lineTotal };
            })
            : lines;

        const lineItemsForReleasedPo = (linkedPO: PurchaseOrder) =>
          withQuotePrices(
            linkedPO.rawItems && Array.isArray(linkedPO.rawItems) && linkedPO.rawItems.length > 0
              ? (linkedPO.rawItems as any[]).map((i: any, idx: number) => {
                const qty = Number(i.quantity) || 0;
                const rate = Number(i.rate ?? i.price ?? 0);
                const gstPct = Number(i.tax) || 18;
                const subtotal = qty * rate;
                const gstAmount = parseFloat((subtotal * (gstPct / 100)).toFixed(2));
                const lineTotal = parseFloat((subtotal + gstAmount).toFixed(2));
                return {
                  item: i.itemName ?? i.name ?? request.items[idx] ?? '',
                  itemCode: resolveItemCodeFromSources(
                    [i.code, i.itemCode, i.item_code, i.itemId, i.item_id, i.rm_code, i.pm_code, i.itemName, i.name],
                    request.type,
                    idx
                  ),
                  type: request.type,
                  qty: String(i.quantity ?? ''),
                  pricePerUnit: rate,
                  gstPercent: gstPct,
                  gstAmount,
                  lineTotal,
                };
              })
              : fallbackLineItems,
          );

        // After a split, a *draft* split (e.g. …-S2) still shares requestId with the released half (…-S1).
        // Never let that draft override lines / PO number for Issued POs — vendor-facing data must come from each Released PO row.
        if (releasedPosForRequest.length > 0) {
          return releasedPosForRequest.map((linkedPO) => {
            const lineItems = lineItemsForReleasedPo(linkedPO);
            const grandTotal =
              Number(linkedPO.value) > 0
                ? Number(linkedPO.value)
                : lineItems.reduce((sum, line) => sum + line.lineTotal, 0);
            const draftOverlay = draftPOs.find(
              (d) =>
                String(d.requestId) === String(request.id) &&
                normPoKey(d.dpoNumber) === normPoKey(String(linkedPO.poNumber ?? '')),
            );
            const backendPoId = String(linkedPO.id ?? '').replace(/^PO-/, '');
            return {
              request,
              poNumber: String(linkedPO.poNumber ?? draftOverlay?.dpoNumber ?? request.code).replace('DPO', 'PO'),
              vendor: linkedPO.vendorName ?? draftOverlay?.vendor ?? linkedQuote?.vendor ?? 'Unassigned Vendor',
              status: computedStatus,
              etaDays,
              lineItems,
              grandTotal,
              requestCode: request.code,
              createdDate: linkedPO.date ?? draftOverlay?.createdDate ?? request.createdDate ?? '',
              paymentTerms: linkedPO.paymentTerms ?? draftOverlay?.paymentTerms ?? linkedQuote?.terms ?? 'As per contract',
              backendPoId: /^\d+$/.test(backendPoId) ? backendPoId : undefined,
            };
          });
        }

        const linkedDraftPO = draftPOs.find((draftPo) => draftPo.requestId === request.id);
        const lineItems =
          linkedDraftPO?.lineItems ?? withQuotePrices(fallbackLineItems);
        const grandTotal =
          linkedDraftPO?.grandTotal ?? lineItems.reduce((sum, line) => sum + line.lineTotal, 0);

        return [
          {
            request,
            poNumber: String(linkedDraftPO?.dpoNumber ?? request.code).replace('DPO', 'PO'),
            vendor: linkedDraftPO?.vendor ?? linkedQuote?.vendor ?? 'Unassigned Vendor',
            status: computedStatus,
            etaDays,
            lineItems,
            grandTotal,
            requestCode: request.code,
            createdDate: linkedDraftPO?.createdDate ?? request.createdDate ?? '',
            paymentTerms: linkedDraftPO?.paymentTerms ?? linkedQuote?.terms ?? 'As per contract',
          },
        ];
      });

    // Include released PO records even when there is no linked procurement request.
    // This happens for Draft POs created from Planning > Items Involved.
    const requestPoNumbers = new Set(requestRecords.map((r) => r.poNumber));

    const unlinkedReleasedPOs = purchaseOrders
      .filter((p) => p.status === 'Released')
      .filter((p) => {
        const poNumber = String(p.poNumber ?? '').replace('DPO', 'PO');
        if (requestPoNumbers.has(poNumber)) return false;

        const linked = requests.some((r) =>
          (String(p.formData?.requestId) && String(p.formData?.requestId) === String(r.id)) ||
          (String(p.formData?.requestCode) && String(p.formData?.requestCode).toUpperCase() === String(r.code).toUpperCase())
        );
        return !linked;
      });

    const unlinkedRecords = unlinkedReleasedPOs.map((po) => {
      const rawItems = Array.isArray(po.rawItems) ? (po.rawItems as any[]) : [];
      const inferredType: RequestType = rawItems.some((it) => it?.pack_material_id != null) ? 'PM' : 'RM';
      const backendPoId = String(po.id ?? '').replace(/^PO-/, '');
      const ov = backendPoId ? unlinkedPoTimelineOverrides[backendPoId] : undefined;
      const tracking = backendPoId ? releasedPoTrackingByBackendId?.[backendPoId] : undefined;

      const lineItems = rawItems.map((i: any, idx: number) => {
        const qty = Number(i.quantity) || 0;
        const rate = Number(i.rate ?? i.price ?? 0);
        const gstPct = Number(i.tax) || 18;
        const subtotal = qty * rate;
        const gstAmount = parseFloat((subtotal * (gstPct / 100)).toFixed(2));
        const lineTotal = parseFloat((subtotal + gstAmount).toFixed(2));
        return {
          item: i.itemName ?? i.name ?? '',
          itemCode: resolveItemCodeFromSources(
            [i.code, i.itemCode, i.item_code, i.itemId, i.item_id, i.rm_code, i.pm_code, i.itemName, i.name],
            inferredType,
            idx
          ),
          type: inferredType,
          qty: String(i.quantity ?? ''),
          pricePerUnit: rate,
          gstPercent: gstPct,
          gstAmount,
          lineTotal,
        };
      });

      const grandTotal = Number(po.value ?? 0) || lineItems.reduce((sum, line) => sum + line.lineTotal, 0);
      const expected = po.expectedShipmentDate || po.date || today.toISOString().slice(0, 10);
      const etaDays = Math.ceil((new Date(expected).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const placeholderRequest: ProcurementRequest = {
        id: String(po.formData?.requestId ?? ''),
        code: String(po.formData?.requestCode ?? po.reference ?? po.poNumber ?? 'Planning'),
        type: inferredType,
        priority: 'Medium',
        status: 'PO Released',
        items: lineItems.map((l) => l.item).filter(Boolean),
        dueDate: expected,
        createdDate: po.date ?? '',
        source: 'Planning Team',
        preferredVendor: null,
      };

      return {
        request: placeholderRequest,
        poNumber: String(po.poNumber ?? po.reference ?? '').replace('DPO', 'PO'),
        vendor: po.vendorName ?? 'Unassigned Vendor',
        status: (ov?.shipped || ov?.delivered || ov?.underGrn || tracking?.shippedAt || tracking?.deliveredAt || tracking?.underGrnAt || tracking?.grnCompleteAt)
          ? ('In Transit' as const)
          : ('Released' as const),
        backendPoId,
        etaDays,
        lineItems,
        grandTotal,
        requestCode: placeholderRequest.code,
        createdDate: po.date ?? '',
        paymentTerms: po.paymentTerms ?? 'As per contract',
      };
    });

    const merged = [...requestRecords, ...unlinkedRecords];
    const dedupedByPo = new Map<string, (typeof merged)[number]>();
    for (const r of merged) {
      const bid = r.backendPoId && /^\d+$/.test(String(r.backendPoId)) ? String(r.backendPoId) : '';
      const poNorm = normPoKey(r.poNumber);
      const key = bid ? `id:${bid}` : `po:${poNorm}|req:${r.request.id}`;
      if (!dedupedByPo.has(key)) dedupedByPo.set(key, r);
    }
    return Array.from(dedupedByPo.values()).filter(
      (r) => !isIssuedPoHandedOffToWarehouse(r, releasedPoTrackingByBackendId, unlinkedPoTimelineOverrides),
    );
  }, [draftPOs, purchaseOrders, quotes, requests, releasedPoTrackingByBackendId, unlinkedPoTimelineOverrides]);

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
        record.lineItems.some(
          (line) =>
            line.item.toLowerCase().includes(query) ||
            String((line as { itemCode?: string }).itemCode ?? '').toLowerCase().includes(query),
        )
      );
    });
  }, [issuedPORecords, issuedSearch, issuedStatusFilter, issuedVendorFilter]);

  const openIssuedPODetail = (record: (typeof filteredIssuedPORecords)[number]) => {
    const recBackend = (record as { backendPoId?: string }).backendPoId;
    const normPoKey = (n: string) => String(n ?? '').trim().replace(/^PO-?/i, '').replace(/^DPO-?/i, '');
    let backendPo: PurchaseOrder | undefined;
    if (recBackend) {
      backendPo = purchaseOrders.find((p) => String(p.id ?? '').replace(/^PO-/, '') === String(recBackend).replace(/^PO-/, ''));
    }
    if (!backendPo) {
      backendPo = purchaseOrders.find(
        (p) =>
          normPoKey(p.poNumber ?? '') === normPoKey(record.poNumber) ||
          normPoKey(String((p as { orderId?: string }).orderId ?? '')) === normPoKey(record.poNumber),
      );
    }
    const backendPoId = backendPo ? String(backendPo.id).replace(/^PO-/, '') : null;
    const ov = backendPoId ? unlinkedPoTimelineOverrides[String(backendPoId)] : undefined;
    const tracking = backendPoId ? releasedPoTrackingByBackendId?.[String(backendPoId)] : undefined;
    const hasT = (v: unknown) => v != null && String(v).trim() !== '';
    const grnDone = grnCompletePoNormSet.has(normPoNumberKeyForTimeline(record.poNumber));
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
        { stage: 'Advance Paid', done: hasT(tracking?.advancePaidAt), timestamp: tracking?.advancePaidAt ?? null, actor: null, note: tracking?.advancePaidNote ?? null },
        { stage: 'Vendor Confirmed', done: hasT(tracking?.vendorConfirmedAt), timestamp: tracking?.vendorConfirmedAt ?? null, actor: null, note: tracking?.vendorConfirmedNote ?? null },
        { stage: 'Shipped', done: hasT(tracking?.shippedAt) || !!ov?.shipped, timestamp: tracking?.shippedAt ?? null, actor: null, note: tracking?.shippedNote ?? null },
        { stage: 'Delivered', done: hasT(tracking?.deliveredAt) || !!ov?.delivered, timestamp: tracking?.deliveredAt ?? null, actor: null, note: tracking?.deliveredNote ?? null },
        { stage: 'Under GRN', done: hasT(tracking?.underGrnAt) || !!ov?.underGrn, timestamp: tracking?.underGrnAt ?? null, actor: null, note: tracking?.underGrnNote ?? null },
        { stage: 'GRN Complete', done: hasT(tracking?.grnCompleteAt) || grnDone, timestamp: tracking?.grnCompleteAt ?? null, actor: null, note: tracking?.grnCompleteNote ?? null },
      ],
    });
  };

  const markIssuedPOInTransit = (record: any) => {
    const requestId = record?.request?.id as string | undefined;
    const requestCode = record?.requestCode as string | undefined;

    // Normal path for linked POs.
    if (requestId) {
      updateRequestStatus(requestId, 'Delivery Pending');
      addToast('success', `${requestCode ?? 'PO'} moved to In Transit`);
      return;
    }

    // Fallback for unlinked Planning POs: update PO tracking (shippedAt).
    const linkedPO =
      purchaseOrders.find((p) => p.status === 'Released' && (p.poNumber === record.poNumber || p.poNumber === record.poNumber.replace(/^PO/, 'DPO'))) ??
      purchaseOrders.find(
        (p) =>
          p.status === 'Released' &&
          String(p.formData?.requestCode).toUpperCase() === String(record.requestCode).toUpperCase(),
      );

    const backendPoId = linkedPO ? String(linkedPO.id).replace(/^PO-/, '') : null;
    if (!backendPoId) {
      addToast('error', 'Linked purchase order not found. Cannot mark In Transit.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    updatePoTracking(backendPoId, {
      shippedAt: today,
      shippedNote: 'Marked In Transit (unlinked Planning PO) from Procurement',
    }).then((trackingRes) => {
      if (!trackingRes.success) {
        addToast('error', typeof trackingRes.error === 'string' ? trackingRes.error : (trackingRes.error?.message ?? 'Failed to update PO tracking'));
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['po-tracking', backendPoId] });
      queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });
      setUnlinkedPoTimelineOverrides((prev) => ({
        ...prev,
        [backendPoId]: {
          shipped: true,
          delivered: prev[backendPoId]?.delivered ?? false,
          underGrn: prev[backendPoId]?.underGrn ?? false,
        },
      }));
      addToast('success', `${record.poNumber} marked In Transit (tracking updated).`);
    });
  };

  const receiveIssuedPOGRN = async (record: any) => {
    const requestId = record?.request?.id as string | undefined;
    const requestCode = record?.requestCode as string | undefined;
    const poNo = String(record?.poNumber ?? '').trim();

    if (!poNo) {
      addToast('error', 'PO not found. Cannot mark delivered.');
      return;
    }

    if (receiveGrnLockRef.current[poNo]) {
      addToast('info', 'GRN creation already in progress for this PO.');
      return;
    }

    receiveGrnLockRef.current[poNo] = true;
    try {
      const hasUnderOrCompleteGrnForPo = async () => {
        const existingGrns = await fetchGRNList();
        return existingGrns.some(
          (g) => String(g.poNo ?? '').trim().toUpperCase() === poNo.toUpperCase() && (g.status === 'Under GRN' || g.status === 'GRN Complete'),
        );
      };

      // Linked path: update procurement request + create GRN.
      if (requestId) {
        const normPoKey = (n: string) => String(n ?? '').trim().replace(/^PO-?/i, '').replace(/^DPO-?/i, '');
        const recBackend = record?.backendPoId != null ? String(record.backendPoId).replace(/^PO-/, '') : '';
        let linkedPO: PurchaseOrder | undefined;
        if (recBackend) {
          linkedPO = purchaseOrders.find(
            (p) => p.status === 'Released' && String(p.id ?? '').replace(/^PO-/, '') === recBackend,
          );
        }
        if (!linkedPO) {
          linkedPO = purchaseOrders.find(
            (p) =>
              p.status === 'Released' &&
              (normPoKey(p.poNumber ?? '') === normPoKey(poNo) ||
                normPoKey(String((p as { orderId?: string }).orderId ?? '')) === normPoKey(poNo)),
          );
        }
        if (!linkedPO) {
          linkedPO = purchaseOrders.find(
            (p) =>
              p.status === 'Released' &&
              (String(p.formData?.requestId) === String(requestId) ||
                String(p.formData?.requestCode).toUpperCase() === String(requestCode).toUpperCase()),
          );
        }

        const backendPoId = linkedPO ? String(linkedPO.id).replace(/^PO-/, '') : null;
        if (!backendPoId) {
          addToast('error', 'Linked purchase order not found. Cannot mark delivered.');
          return;
        }

        const today = new Date().toISOString().split('T')[0];
        const backendPr = backendPrArray.find((p: { id: string }) => String(p.id) === String(requestId));
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

        let grnCreated = false;
        try {
          const alreadyHasGrn = await hasUnderOrCompleteGrnForPo();
          if (!alreadyHasGrn) {
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
              lineItems: record.lineItems.map((line: any, idx: number) => {
                const prItem =
                  matchBackendPrItemForDraftLine(
                    {
                      item: String(line.item ?? ''),
                      itemCode: String(line.itemCode ?? ''),
                      type: (record.request?.type ?? 'RM') as RequestType,
                      qty: String(line.qty ?? ''),
                      pricePerUnit: Number(line.pricePerUnit) || 0,
                      gstPercent: Number(line.gstPercent) || 18,
                      gstAmount: Number(line.gstAmount) || 0,
                      lineTotal: Number(line.lineTotal) || 0,
                    },
                    items
                  ) ?? items[idx];
                return {
                  id: `line-${idx}`,
                  item: String(line.item ?? ''),
                  itemCode: resolveItemCodeFromSources(
                    [prItem?.code, line.itemCode, line.item, prItem?.name],
                    record.request.type,
                    idx
                  ),
                  poQty: Number(line.qty) || 0,
                  rcvdQty: 0,
                  invoiceQty: 0,
                  unitPrice: Number(line.pricePerUnit) || 0,
                  diff: 0,
                  qcStatus: 'Pending',
                  qcBy: '',
                  raw_material_id: prItem?.raw_material_id,
                  pack_material_id: prItem?.pack_material_id,
                  product_id: prItem?.product_id,
                };
              }),
            });
            grnCreated = true;
          } else {
            addToast('info', 'GRN already exists for this PO. Skipping duplicate creation.');
          }
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
        queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });
        queryClient.invalidateQueries({ queryKey: ['grn-list'] });
        updateProcurementState((current: any) => ({
          requests: current.requests.map((req: any) => (req.id === requestId ? { ...req, status: 'Under GRN' as RequestStatus } : req)),
        }));
        addToast(
          'success',
          grnCreated
            ? `${requestCode ?? record.poNumber} marked delivered at WH. GRN created — see Warehouse > Inbound.`
            : `${requestCode ?? record.poNumber} marked delivered at WH. GRN already existed — see Warehouse > Inbound.`,
        );
        return;
      }

      // Unlinked path: only update PO tracking + create GRN.
      const linkedPO =
        purchaseOrders.find(
          (p) => p.status === 'Released' && (p.poNumber === record.poNumber || p.poNumber === record.poNumber.replace(/^PO/, 'DPO')),
        ) ??
        purchaseOrders.find(
          (p) => p.status === 'Released' && String(p.formData?.requestCode).toUpperCase() === String(record.requestCode).toUpperCase(),
        );

      const backendPoId = linkedPO ? String(linkedPO.id).replace(/^PO-/, '') : null;
      if (!backendPoId) {
        addToast('error', 'Linked purchase order not found. Cannot mark delivered.');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const trackingRes = await updatePoTracking(backendPoId, {
        deliveredAt: today,
        deliveredNote: 'Marked delivered at WH (unlinked Planning PO) from Procurement',
        underGrnAt: today,
        underGrnNote: 'GRN created from Procurement (unlinked Planning PO)',
      });
      if (!trackingRes.success) {
        addToast('error', typeof trackingRes.error === 'string' ? trackingRes.error : (trackingRes.error?.message ?? 'Failed to update PO tracking'));
        return;
      }

      setUnlinkedPoTimelineOverrides((prev) => ({
        ...prev,
        [backendPoId]: {
          shipped: true,
          delivered: true,
          underGrn: true,
        },
      }));

      let unlinkedGrnCreated = false;
      try {
        const alreadyHasGrn = await hasUnderOrCompleteGrnForPo();
        if (!alreadyHasGrn) {
          const rawItemsForGrn = Array.isArray(linkedPO?.rawItems) ? (linkedPO!.rawItems as any[]) : [];
          await createGRN({
            grnNo: `GRN-${record.poNumber}-${Date.now()}`,
            purchase_order_id: parseInt(backendPoId, 10),
            poNo: record.poNumber,
            vendor: record.vendor,
            type: (record.request?.type ?? record.lineItems?.[0]?.type ?? 'RM') as 'RM' | 'PM',
            items: record.lineItems.length,
            poValue: record.grandTotal ?? 0,
            status: 'Under GRN',
            receivedDate: today,
            lineItems: record.lineItems.map((line: any, idx: number) => {
              const raw = rawItemsForGrn[idx] ?? {};
              return {
                id: `line-${idx}`,
                item: String(line.item ?? raw.itemName ?? raw.name ?? ''),
                itemCode: resolveItemCodeFromSources(
                  [
                    raw.code,
                    raw.itemCode,
                    raw.item_code,
                    raw.itemId,
                    raw.item_id,
                    raw.rm_code,
                    raw.pm_code,
                    line.itemCode,
                    line.item,
                  ],
                  (record.request?.type ?? 'RM') as RequestType,
                  idx
                ),
                poQty: Number(line.qty) || Number(raw.quantity) || 0,
                rcvdQty: 0,
                invoiceQty: 0,
                unitPrice: Number(line.pricePerUnit) || Number(raw.rate ?? raw.price ?? 0) || 0,
                diff: 0,
                qcStatus: 'Pending',
                qcBy: '',
                ...resolveMasterIdsFromRawItem(raw),
              };
            }),
          });
          unlinkedGrnCreated = true;
        } else {
          addToast('info', 'GRN already exists for this PO. Skipping duplicate creation.');
        }
      } catch (e) {
        addToast('error', e instanceof Error ? e.message : 'Failed to create GRN in warehouse');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['po-tracking', backendPoId] });
      queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });
      queryClient.invalidateQueries({ queryKey: ['grn-list'] });
      addToast(
        'success',
        unlinkedGrnCreated
          ? `${record.poNumber} marked delivered at WH. GRN created — see Warehouse > Inbound.`
          : `${record.poNumber} marked delivered at WH. GRN already existed — see Warehouse > Inbound.`,
      );
    } finally {
      delete receiveGrnLockRef.current[poNo];
    }
  };

  const [showCreatePoFromQuoteModal, setShowCreatePoFromQuoteModal] = useState(false);
  const [createPoFromQuoteState, setCreatePoFromQuoteState] = useState<{
    quoteId: string;
    requestId: string;
    itemKey?: string;
  } | null>(null);

  const createDraftPO = (quoteId: string) => {
    const selectedQuote = quotes.find((quote) => quote.id === quoteId);
    if (!selectedQuote) {
      addToast('error', 'Quote not found');
      return;
    }
    const relatedRequest = requests.find((req) => req.id === selectedQuote.requestId);
    if (!relatedRequest && selectedQuote.requestId) {
      addToast('error', 'Related request not found');
      return;
    }
    // Open confirmation modal: choose PR (if standalone quote) and item within that PR/quote before creating Draft PO
    setCreatePoFromQuoteState({
      quoteId,
      requestId: selectedQuote.requestId || (requests[0]?.id ?? ''),
      itemKey: undefined,
    });
    setShowCreatePoFromQuoteModal(true);
  };

  /** Create a draft PO from request data only (no quote). Uses preferred/confirmed quote prices if available; otherwise fetches vendor prices from Items List (quote-line-defaults). */
  const createDraftPOFromRequest = async (
    requestId: string,
    requestCode: string,
    items: BackendPRItem[],
    preferredVendor: string,
    requestType: RequestType,
    preferredQuotationId?: string
  ): Promise<boolean> => {
    if (!items.length) {
      addToast('warning', 'Add at least one line item to the request to create a draft PO.');
      return false;
    }
    const quoteToUse = preferredQuotationId
      ? quotes.find((q) => q.id === preferredQuotationId)
      : quotes.find((q) => q.requestId === requestId && q.status === 'Confirmed')
      ?? quotes.find((q) => q.requestId === requestId);
    const vendor = preferredVendor?.trim() || quoteToUse?.vendor?.trim() || 'Unassigned';
    const matchedVendorForZoho = vendors.find((v) => (v.name || '').trim().toLowerCase() === vendor.toLowerCase());
    const vendorId = matchedVendorForZoho?.id;
    const quoteTerms = String(quoteToUse?.terms ?? '').trim();
    const vendorMasterTerms = String(matchedVendorForZoho?.paymentTerms ?? '').trim();
    const resolvedPaymentTerms = vendorMasterTerms || quoteTerms || 'As per contract';

    let itemsListPrices: { name: string; itemId?: string; pricePerUnit: number }[] = [];
    if (vendorId && vendor !== 'Unassigned') {
      const res = await fetchQuoteLineDefaults(parseInt(requestId, 10), parseInt(String(vendorId), 10));
      if (res.success && res.data?.items?.length) {
        itemsListPrices = res.data.items.map((i) => ({ name: i.name ?? '', itemId: i.itemId, pricePerUnit: Number(i.pricePerUnit) || 0 }));
      }
    }

    const newDpoId = nextSequentialDpoOrderId(purchaseOrders, draftPOs);
    const lineItems: DraftPOLineItem[] = items.map((it, idx) => {
      const qty = Number(it.quantity_requested) || 0;
      const prName = String(it.name ?? '').trim().toLowerCase();
      const prCode = String(it.code ?? '').trim().toLowerCase();
      const matchedLine = quoteToUse?.lines?.find((l) => {
        const quoteItem = String(l.item ?? '').trim().toLowerCase();
        if (!quoteItem) return false;
        return quoteItem === prName || quoteItem === prCode || prName === quoteItem || prCode === quoteItem
          || prName.includes(quoteItem) || quoteItem.includes(prName) || (prCode && quoteItem.includes(prCode));
      });
      let pricePerUnit = matchedLine != null && typeof matchedLine.pricePerUnit === 'number' && matchedLine.pricePerUnit > 0
        ? matchedLine.pricePerUnit
        : 0;
      if (pricePerUnit === 0 && itemsListPrices.length > 0) {
        const byIndex = itemsListPrices[idx];
        const byName = itemsListPrices.find((p) => (p.name || '').trim().toLowerCase() === String(it.name ?? '').trim().toLowerCase());
        const byCode = itemsListPrices.find((p) => ((p.itemId ?? p.name) || '').trim().toLowerCase() === String(it.code ?? '').trim().toLowerCase());
        pricePerUnit = byIndex?.pricePerUnit ?? byName?.pricePerUnit ?? byCode?.pricePerUnit ?? 0;
      }
      const gstPercent = 18;
      const subtotal = qty * pricePerUnit;
      const gstAmount = parseFloat((subtotal * (gstPercent / 100)).toFixed(2));
      const lineTotal = parseFloat((subtotal + gstAmount).toFixed(2));
      return {
        item: it.name ?? it.code ?? 'Item',
        itemCode: requestType === 'PM' ? `EI-PM-${String(idx + 1).padStart(3, '0')}` : `EI-RM-${String(idx + 1).padStart(3, '0')}`,
        type: requestType,
        qty: String(it.quantity_requested ?? 0),
        leadTimeDays: quoteToUse?.leadTimeDays ?? 0,
        pricePerUnit,
        gstPercent,
        gstAmount,
        lineTotal,
      };
    });
    const subtotal = parseFloat(lineItems.reduce((s, l) => s + (l.lineTotal - l.gstAmount), 0).toFixed(2));
    const gstTotal = parseFloat(lineItems.reduce((s, l) => s + l.gstAmount, 0).toFixed(2));
    const grandTotal = parseFloat((subtotal + gstTotal).toFixed(2));
    const today = new Date();
    const createdDateStr = today.toISOString().split('T')[0];
    const leadDaysForDelivery = Math.max(
      0,
      ...lineItems.map((l) => Number(l.leadTimeDays ?? 0) || 0),
      Number(quoteToUse?.leadTimeDays ?? 0) || 0
    );
    const expectedDelivery = new Date(today);
    expectedDelivery.setDate(expectedDelivery.getDate() + leadDaysForDelivery);
    const expectedDeliveryStr = expectedDelivery.toISOString().split('T')[0];
    const poPayload = {
      orderId: newDpoId,
      vendorName: vendor,
      orderDate: createdDateStr,
      expectedShipmentDate: expectedDeliveryStr,
      reference: requestCode,
      paymentTerms: resolvedPaymentTerms,
      status: 'Draft',
      formData: {
        requestId,
        requestCode,
        ...(matchedVendorForZoho && vendor !== 'Unassigned'
          ? {
            vendorClientId: matchedVendorForZoho.id,
            vendorEntityCode: matchedVendorForZoho.vendorCode,
          }
          : {}),
      },
      items: lineItems.map((l, idx) => {
        const src = items[idx];
        return {
          itemName: l.item,
          itemCode: l.itemCode,
          quantity: l.qty,
          rate: String(l.pricePerUnit),
          tax: String(l.gstPercent || 18),
          ...(src?.raw_material_id != null ? { raw_material_id: Number(src.raw_material_id) } : {}),
          ...(src?.pack_material_id != null ? { pack_material_id: Number(src.pack_material_id) } : {}),
        };
      }),
    };
    const createResult = await createPurchaseOrder(poPayload);
    if (!createResult.success || !createResult.data) {
      addToast('error', typeof createResult.error === 'string' ? createResult.error : (createResult.error?.message ?? 'Failed to create draft PO'));
      return false;
    }
    const backendId = String(createResult.data.id ?? '').replace(/^PO-/, '') || String(createResult.data.id);
    const usedQuotePrices = quoteToUse && lineItems.some((l) => l.pricePerUnit > 0);
    const usedItemsListPrices = !usedQuotePrices && itemsListPrices.length > 0 && lineItems.some((l) => l.pricePerUnit > 0);
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
      paymentTerms: resolvedPaymentTerms,
      expectedDelivery: expectedDeliveryStr,
      deliveryAddress: 'EI Plant 1, IDA Jeedimetla, Hyderabad - 500 055',
      vendorRating: 0,
      alertMessage: usedQuotePrices
        ? `Draft PO created with ${vendor} quotation prices.`
        : usedItemsListPrices
          ? `Draft PO created with ${vendor} prices from Items List.`
          : 'Draft PO created from request. Add rates in Edit if needed.',
      alertType: usedQuotePrices || usedItemsListPrices ? 'success' : 'warning',
      lineItems,
      subtotal,
      gstTotal,
      grandTotal,
      backendPoId: backendId,
    };
    updateProcurementState((current) => ({
      draftPOs: [newDraftPO, ...current.draftPOs],
    }));
    void invalidatePurchaseOrdersQueries();
    await updateProcurementRequestApi(requestId, { status: 'PO Draft' });
    queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
    updateProcurementState((current) => ({
      requests: current.requests.map((r) => (r.id === requestId ? { ...r, status: 'PO Draft' as RequestStatus } : r)),
    }));
    addToast('success', `Draft PO ${newDpoId} created for ${requestCode}`);
    return true;
  };

  const approveDraftPO = async (draftPoId: string) => {
    const target = draftPOs.find((draftPo) => draftPo.id === draftPoId);

    if (!target) {
      addToast('warning', 'Draft PO not found');
      return;
    }

    if (target.status === 'Approved') {
      const isSplitChild = /-S\d+$/i.test(String(target.dpoNumber ?? '').trim());
      const normalizedPoId = target.backendPoId ? String(target.backendPoId).replace(/^PO-/, '') : '';
      const sourcePo =
        isSplitChild && normalizedPoId
          ? purchaseOrders.find((p) => String(p.id ?? '').replace(/^PO-/, '') === normalizedPoId)
          : undefined;
      const fd =
        sourcePo?.formData && typeof sourcePo.formData === 'object' && !Array.isArray(sourcePo.formData)
          ? (sourcePo.formData as Record<string, unknown>)
          : null;
      const serverSaysApproved = String(fd?.procurementApprovalStatus ?? '').toLowerCase() === 'approved';
      if (!isSplitChild || serverSaysApproved) {
        addToast('info', `${target.dpoNumber} is already approved`);
        return;
      }
      // UI still shows Approved from before split/refetch; server form_data is pending — allow approval to proceed.
    }

    const approvedAt = new Date();
    const dateLabel = approvedAt.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const alertMessage = `Approved on ${dateLabel}. Ready for release.`;

    if (target.backendPoId) {
      const normalizedId = String(target.backendPoId).replace(/^PO-/, '');
      const sourcePo = purchaseOrders.find((p) => String(p.id ?? '').replace(/^PO-/, '') === normalizedId);
      const baseForm =
        sourcePo?.formData && typeof sourcePo.formData === 'object' && !Array.isArray(sourcePo.formData)
          ? { ...(sourcePo.formData as Record<string, unknown>) }
          : {};
      const res = await updatePurchaseOrder(target.backendPoId, {
        formData: {
          ...baseForm,
          procurementApprovalStatus: 'Approved',
          procurementApprovedAt: approvedAt.toISOString(),
        },
      });
      if (!res.success) {
        const err = res.error;
        addToast('error', typeof err === 'string' ? err : (err?.message ?? 'Failed to save approval'));
        return;
      }
      await invalidatePurchaseOrdersQueries();
    }

    updateProcurementState((current) => ({
      draftPOs: current.draftPOs.map((draftPo) =>
        draftPo.id === draftPoId
          ? {
            ...draftPo,
            status: 'Approved',
            alertType: 'ok',
            alertMessage,
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
            alertMessage,
          }
          : prev,
      );
    }

    addToast('success', `${target.dpoNumber} approved`);
  };

  const resolveBackendProcurementRequestId = (draft: DraftPO): string => {
    // Backend PATCH /api/v1/procurement/:id expects the numeric procurement_requests.id.
    const direct = draft.requestId ?? '';
    if (typeof direct === 'string' && /^\d+$/.test(direct.trim())) return direct.trim();

    // Fallback: resolve by requestCode (what we show in the UI).
    if (draft.requestCode) {
      const byCode = requests.find((r) => String(r.code).toUpperCase() === String(draft.requestCode).toUpperCase());
      if (byCode?.id) return String(byCode.id);
    }

    // Last resort: try extracting digits from whatever is stored.
    const digits = String(direct).match(/\d+/)?.[0];
    if (digits) {
      const byId = requests.find((r) => String(r.id) === String(digits));
      if (byId?.id) return String(byId.id);
    }
    return '';
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

    const backendRequestId = resolveBackendProcurementRequestId(target);
    if (DEBUG_PROC_RELEASE) {
      console.log('[PROC-RELEASE] resolveBackendProcurementRequestId', {
        dpoId: target.id,
        dpoNumber: target.dpoNumber,
        target_requestId: target.requestId,
        target_requestCode: target.requestCode,
        resolved_backendRequestId: backendRequestId,
        requestCodes_in_state_sample: requests.slice(0, 5).map((r) => ({ id: r.id, code: r.code, status: r.status })),
      });
    }
    if (!backendRequestId) {
      // Planning-created draft POs (from Planning > Items Involved) may not be linked to a procurement_requests row.
      // In that case, we can still release the underlying purchase order and show it in "Issued POs".
      addToast('warning', `${target.dpoNumber} released (no backend procurement request link; created from Planning).`);
      applyRouteState('Procurement', 'Issued POs');
      return;
    }

    if (DEBUG_PROC_RELEASE) {
      console.log('[PROC-RELEASE] calling updateRequestStatus', {
        backendRequestId,
        status: 'PO Released',
      });
    }
    // Split draft POs (…-S1 / …-S2): do not PATCH the full PR item list — vendor-facing lines come from the PO only.
    const isSplitDraft = /-S[12]$/.test(target.dpoNumber);
    await updateRequestStatus(backendRequestId, 'PO Released', isSplitDraft ? { skipItems: true } : undefined);
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

  const recordAdvancePaymentForReleaseDraft = async () => {
    if (!releaseDraftBackendPoIdNormalized) {
      addToast('error', 'No server purchase order id on this draft. Refresh or re-save the draft PO.');
      return;
    }
    setRecordingAdvancePayment(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await updatePoTracking(releaseDraftBackendPoIdNormalized, {
        advancePaidAt: today,
        advancePaidNote: 'Advance payment recorded (manual — treasury transaction pending)',
      });
      if (!res.success) {
        addToast('error', typeof res.error === 'string' ? res.error : 'Failed to record advance payment');
        return;
      }
      addToast('success', 'Advance payment recorded. You can release the PO to vendor.');
      await queryClient.invalidateQueries({ queryKey: ['po-tracking', 'release-draft', releaseDraftBackendPoIdNormalized] });
      await queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });
      void refetchReleaseDraftTracking();
    } finally {
      setRecordingAdvancePayment(false);
    }
  };

  const submitReleasePO = async () => {
    if (!releasePOTarget) {
      return;
    }

    const draft = releasePOTarget;
    if (draftPaymentTermsRequireAdvance(draft.paymentTerms)) {
      const bid = draft.backendPoId ? String(draft.backendPoId).replace(/^PO-/, '') : '';
      if (!bid || !/^\d+$/.test(bid)) {
        addToast(
          'error',
          'These payment terms require advance payment before release. Ensure the draft PO exists on the server, then record advance payment.',
        );
        return;
      }
      const trackRes = await fetchPoTracking(bid);
      const tr = trackRes.success ? trackRes.data : null;
      if (!tr?.advancePaidAt || !String(tr.advancePaidAt).trim()) {
        addToast('error', 'Record advance payment before releasing this PO.');
        return;
      }
    }
    if (DEBUG_PROC_RELEASE) {
      console.log('[PROC-RELEASE] submitReleasePO called', {
        dpoId: draft.id,
        dpoNumber: draft.dpoNumber,
        draft_requestId: draft.requestId,
        draft_requestCode: draft.requestCode,
        draft_backendPoId: draft.backendPoId,
        draft_status: draft.status,
      });
    }

    // Update PO table: set status to Released and ensure request link is stored
    if (draft.backendPoId) {
      const backendRequestId = resolveBackendProcurementRequestId(draft);
      const prRow = backendPrArray.find((p: { id: string }) => String(p.id) === String(backendRequestId || draft.requestId)) as
        | { items?: BackendPRItem[] }
        | undefined;
      const prItemsForLines = Array.isArray(prRow?.items) ? prRow.items : [];
      const poItemsPayload = draftLineItemsToPurchaseOrderItems(draft.lineItems, prItemsForLines);
      if (DEBUG_PROC_RELEASE) {
        console.log('[PROC-RELEASE] updatePurchaseOrder formData request linkage', {
          backendPoId: draft.backendPoId,
          dpoNumber: draft.dpoNumber,
          draft_requestId: draft.requestId,
          draft_requestCode: draft.requestCode,
          resolved_backendRequestId: backendRequestId,
        });
      }
      const updateResult = await updatePurchaseOrder(draft.backendPoId, {
        status: 'Released',
        formData: { requestId: backendRequestId || draft.requestId, requestCode: draft.requestCode },
        items: poItemsPayload,
      });
      if (DEBUG_PROC_RELEASE) {
        console.log('[PROC-RELEASE] updatePurchaseOrder result', {
          backendPoId: draft.backendPoId,
          success: updateResult.success,
          error: updateResult.error,
        });
      }
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

    void invalidatePurchaseOrdersQueries();
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
    // Start with no preselection to avoid accidental S1 assignment.
    setSplitSelectedLineIndexes([]);
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
      // Split changes line structure — must not inherit Approved from the pre-split draft (would block approve + show "already approved").
      status: 'Pending Approval',
      alertType: 'warning',
      alertMessage: `Split from ${baseDraftPo.dpoNumber}. Approve this PO before release.`,
      lineItems,
      subtotal,
      gstTotal,
      grandTotal,
    };
  };

  const submitSplitPO = async () => {
    if (!splitPOTarget) return;

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

    if (splitPOTarget.backendPoId) {
      const backendRequestId = resolveBackendProcurementRequestId(splitPOTarget);
      const prRow = backendPrArray.find((p: { id: string }) => String(p.id) === String(backendRequestId || splitPOTarget.requestId)) as
        | { items?: BackendPRItem[] }
        | undefined;
      const prItemsForLines = Array.isArray(prRow?.items) ? prRow.items : [];
      const fullAssigned = assignPrItemToDraftLines(splitPOTarget.lineItems, prItemsForLines);
      const assignedOne = uniqueIndexes.map((idx) => fullAssigned[idx]);
      const remainingLineIndices = splitPOTarget.lineItems.map((_, i) => i).filter((i) => !uniqueIndexes.includes(i));
      const assignedTwo = remainingLineIndices.map((i) => fullAssigned[i]);
      const itemsOne = draftLineItemsToPurchaseOrderItems(selectedLineItems, prItemsForLines, assignedOne);
      const itemsTwo = draftLineItemsToPurchaseOrderItems(remainingLineItems, prItemsForLines, assignedTwo);

      const normalizedPoId = String(splitPOTarget.backendPoId).replace(/^PO-/, '');
      const sourcePo = purchaseOrders.find((p) => String(p.id ?? '').replace(/^PO-/, '') === normalizedPoId);
      const restoreSnapshot =
        sourcePo != null
          ? {
              orderId: sourcePo.poNumber,
              vendorName: sourcePo.vendorName ?? splitPOTarget.vendor,
              orderDate: sourcePo.date,
              expectedShipmentDate: sourcePo.expectedShipmentDate ?? '',
              reference: sourcePo.reference ?? '',
              paymentTerms: sourcePo.paymentTerms ?? splitPOTarget.paymentTerms,
              status: sourcePo.status ?? 'Draft',
              formData:
                sourcePo.formData && typeof sourcePo.formData === 'object' && !Array.isArray(sourcePo.formData)
                  ? { ...(sourcePo.formData as Record<string, unknown>) }
                  : {},
              items:
                Array.isArray(sourcePo.rawItems) && sourcePo.rawItems.length > 0
                  ? [...sourcePo.rawItems]
                  : draftLineItemsToPurchaseOrderItems(splitPOTarget.lineItems, prItemsForLines, fullAssigned),
            }
          : null;
      const baseForm =
        sourcePo?.formData && typeof sourcePo.formData === 'object' && !Array.isArray(sourcePo.formData)
          ? { ...(sourcePo.formData as Record<string, unknown>) }
          : {};
      baseForm.requestId = splitPOTarget.requestId;
      baseForm.requestCode = splitPOTarget.requestCode;
      baseForm.procurementApprovalStatus = 'Pending Approval';
      delete (baseForm as Record<string, unknown>).procurementApprovedAt;

      const formDataS1: Record<string, unknown> = {
        ...baseForm,
        poNumber: splitPOOne.dpoNumber,
        orderId: splitPOOne.dpoNumber,
        procurementApprovedAt: null,
      };
      const formDataS2: Record<string, unknown> = {
        ...baseForm,
        poNumber: splitPOTwo.dpoNumber,
        orderId: splitPOTwo.dpoNumber,
        procurementApprovedAt: null,
      };

      const updateFirstPayload = {
        orderId: splitPOOne.dpoNumber,
        vendorName: splitPOTarget.vendor,
        orderDate: splitPOTarget.createdDate,
        expectedShipmentDate: splitPOTarget.expectedDelivery,
        reference: splitPOTarget.requestCode,
        paymentTerms: splitPOTarget.paymentTerms,
        status: 'Draft',
        formData: formDataS1,
        items: itemsOne,
      };
      const up1 = await updatePurchaseOrder(splitPOTarget.backendPoId, updateFirstPayload);
      if (!up1.success) {
        const err = up1.error;
        addToast('error', typeof err === 'string' ? err : (err?.message ?? 'Failed to update first split PO'));
        return;
      }

      const createPayload = {
        orderId: splitPOTwo.dpoNumber,
        vendorName: splitPOTarget.vendor,
        orderDate: splitPOTarget.createdDate,
        expectedShipmentDate: splitPOTarget.expectedDelivery,
        reference: splitPOTarget.requestCode,
        paymentTerms: splitPOTarget.paymentTerms,
        status: 'Draft',
        formData: formDataS2,
        items: itemsTwo,
      };
      const cr = await createPurchaseOrder(createPayload);
      if (!cr.success) {
        const err = cr.error;
        const msg = typeof err === 'string' ? err : (err?.message ?? 'Failed to create second split PO');
        if (restoreSnapshot) {
          const rb = await updatePurchaseOrder(splitPOTarget.backendPoId, restoreSnapshot);
          if (rb.success) {
            addToast('error', `${msg} The original draft PO was restored.`);
            await invalidatePurchaseOrdersQueries();
            return;
          }
          addToast(
            'error',
            `${msg} Could not restore the original draft PO automatically — please verify the first PO in the backend.`,
          );
          return;
        }
        addToast('error', msg);
        return;
      }

      await invalidatePurchaseOrdersQueries();
      void fetchPoTracking(normalizedPoId);
      const po2NumericId = cr.data?.id ? String(cr.data.id).replace(/^PO-/, '') : '';
      if (po2NumericId) void fetchPoTracking(po2NumericId);
      await queryClient.invalidateQueries({ queryKey: ['po-tracking', normalizedPoId] });
      if (po2NumericId) await queryClient.invalidateQueries({ queryKey: ['po-tracking', po2NumericId] });
      await queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });

      if (selectedDraftPO?.id === splitPOTarget.id) {
        setSelectedDraftPO(null);
      }
      addToast('success', `Split saved: ${splitPOOne.dpoNumber} and ${splitPOTwo.dpoNumber} (two backend draft POs).`);
      closeSplitPOModal();
      return;
    }

    updateProcurementState((current) => ({
      draftPOs: [splitPOOne, splitPOTwo, ...current.draftPOs.filter((draftPo) => draftPo.id !== splitPOTarget.id)],
    }));

    if (selectedDraftPO?.id === splitPOTarget.id) {
      setSelectedDraftPO(null);
    }

    addToast('success', `Split complete: ${splitPOOne.dpoNumber} and ${splitPOTwo.dpoNumber} created`);
    closeSplitPOModal();
  };

  const addNewQuote = () => {
    if (!vendors.length) {
      addToast('warning', 'Add at least one vendor in Vendor-Client before recording a quote');
      return;
    }
    const defaultVendor = vendors[0];
    const todayStr = new Date().toISOString().slice(0, 10);
    setRecordQuoteForm({
      vendorId: defaultVendor.id,
      quoteDate: todayStr,
      validTill: '',
      leadTimeDays: '',
      notes: '',
    });
    setRecordQuoteLines([]);
    setShowRecordQuoteModal(true);
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

  const deleteQuote = async (quoteId: string) => {
    const raw = String(quoteId ?? '').trim();
    if (raw.startsWith('IL-')) {
      addToast(
        'info',
        'This card reflects Items List vendor rates, not a saved procurement quotation. Remove or edit rates under Vendor Client → Items List.',
      );
      return;
    }
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
      addToast('error', 'Invalid quotation id');
      return;
    }
    const res = await deleteProcurementQuotation(id);
    if (!res.success) {
      addToast('error', typeof res.error === 'string' ? res.error : 'Failed to delete quotation');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['procurement-quotations'] });
    addToast('success', `Quotation ${quoteId} deleted`);
  };

  const updateRequestStatus = async (requestId: string, status: RequestStatus, opts?: { skipItems?: boolean }) => {
    const payload = opts?.skipItems
      ? { status }
      : {
        status,
        items:
          (backendPrArray.find((p: { id: string }) => String(p.id) === requestId) as { items?: BackendPRItem[] } | undefined)?.items ??
          ([] as BackendPRItem[]),
      };
    if (DEBUG_PROC_RELEASE) {
      console.log('[PROC-RELEASE] PATCH /api/v1/procurement/:id about to run', {
        requestId,
        status,
        payload: {
          status: payload.status,
          itemsCount: Array.isArray((payload as any).items) ? (payload as any).items.length : null,
        },
      });
    }
    const res = await updateProcurementRequestApi(requestId, payload);
    if (!res.success) {
      if (DEBUG_PROC_RELEASE) {
        console.log('[PROC-RELEASE] PATCH /api/v1/procurement/:id failed', {
          requestId,
          status,
          error: res.error,
        });
      }
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

  const handleRecordQuoteLineChange =
    (idx: number, field: 'orderQty' | 'pricePerUnit' | 'name' | 'itemId') => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setRecordQuoteLines((prev) =>
        prev.map((line, i) => {
          if (i !== idx) return line;
          const next: typeof line = { ...line, [field]: value };
          const qtyNum = parseFloat(String(next.orderQty).replace(/[^\d.]/g, '')) || 0;
          const priceNum = parseFloat(String(next.pricePerUnit).replace(/[^\d.]/g, '')) || 0;
          next.totalValue = parseFloat((qtyNum * priceNum).toFixed(2));
          return next;
        })
      );
    };

  const handleRecordQuoteLineSelectItem = (idx: number, value: string) => {
    if (!value || value === '') {
      setRecordQuoteLines((prev) =>
        prev.map((line, i) =>
          i !== idx
            ? line
            : { ...line, itemType: undefined, raw_material_id: null, pack_material_id: null, itemId: '', name: '', uom: 'KG' }
        )
      );
      return;
    }
    const [type, idStr] = value.split('-');
    const id = parseInt(idStr, 10);
    if (type === 'rm' && !Number.isNaN(id)) {
      const rm = (rawMaterialsListForQuote as RawMaterialRecord[]).find((r) => String(r.id) === String(id));
      if (rm) {
        setRecordQuoteLines((prev) =>
          prev.map((line, i) =>
            i !== idx
              ? line
              : {
                ...line,
                itemType: 'RM',
                raw_material_id: id,
                pack_material_id: null,
                itemId: rm.code ?? '',
                name: rm.name ?? '',
                uom: rm.uom ?? 'KG',
              }
          )
        );
      }
    } else if (type === 'pm' && !Number.isNaN(id)) {
      const pm = (packMaterialsListForQuote as PackMaterialRecord[]).find((p) => String(p.id) === String(id));
      if (pm) {
        setRecordQuoteLines((prev) =>
          prev.map((line, i) =>
            i !== idx
              ? line
              : {
                ...line,
                itemType: 'PM',
                raw_material_id: null,
                pack_material_id: id,
                itemId: pm.code ?? '',
                name: pm.description ?? pm.code ?? '',
                uom: pm.unit ?? 'PCS',
              }
          )
        );
      }
    }
  };

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
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${mainTab === tab
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
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${sideSection === section
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
              {(['GRN Monitor', 'Item Tracker'] as SideSection[]).map((section) => (
                <button
                  key={section}
                  onClick={() => {
                    applyRouteState('Procurement', section);
                    addToast('info', `${section} synced with procurement data`);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${sideSection === section
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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { label: 'TOTAL QUOTES', value: quoteStats.totalQuotes, color: 'text-yellow-700' },
                  { label: 'CONFIRMED', value: quoteStats.confirmed, color: 'text-emerald-600' },
                  { label: 'NOT SELECTED', value: quoteStats.notSelected, color: 'text-slate-600' },
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
                      className={`px-2 py-1 rounded border ${categoryFilter === category
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
                <p className="text-[11px] text-slate-500 px-1 pt-2 border-t border-slate-100 mt-2">
                  Record vendor quotes and pricing here for reference in Planning and PR. Draft POs are created from the PR / Draft POs flow, not from individual quote cards.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {sideSection === 'Overview' && (() => {
                const TODAY = new Date();
                const daysUntil = (dateStr: string) => Math.ceil((new Date(dateStr).getTime() - TODAY.getTime()) / 86400000);
                // Once PR → PO is issued and released to vendor, exclude from Overview (Actions Required)
                const activeRequests = requests.filter(r => r.status !== 'PO Released' && r.status !== 'Delivery Pending');
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
                    {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    </div> */}
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
                        <table className="w-full text-sm border-collapse min-w-[960px]">
                          <thead>
                            <tr className="border-b border-slate-200 text-left">
                              <th className="py-2 pr-3 font-semibold text-slate-700">ID</th>
                              <th className="py-2 pr-3 font-semibold text-slate-700">PI / SO</th>
                              <th className="py-2 pr-3 font-semibold text-slate-700">Customer</th>
                              <th className="py-2 pr-3 font-semibold text-slate-700">Product</th>
                              <th className="py-2 pr-3 font-semibold text-slate-700">Batch</th>
                              <th className="py-2 pr-3 font-semibold text-slate-700">Vendor</th>
                              <th className="py-2 pr-3 font-semibold text-slate-700">Priority</th>
                              <th className="py-2 pr-3 font-semibold text-slate-700">Status</th>
                              <th className="py-2 pr-3 font-semibold text-slate-700">Required by</th>
                              <th className="py-2 pr-3 font-semibold text-slate-700">RM/PM lines</th>
                              <th className="py-2 pr-3 font-semibold text-slate-700">Requested by</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backendPrs.map((pr) => {
                              const lines = Array.isArray(pr.items) ? pr.items : [];
                              const lineSummary = lines
                                .map((ln: BackendPRItem) => {
                                  const t =
                                    ln?.type === 'PM' || (ln?.pack_material_id != null && Number(ln.pack_material_id) > 0)
                                      ? 'PM'
                                      : 'RM';
                                  const label = (ln?.name && String(ln.name).trim()) || (ln?.code && String(ln.code).trim()) || t;
                                  const qty = Number(ln?.quantity_requested) || 0;
                                  const u = String(ln?.unit || (t === 'PM' ? 'PCS' : 'KG'));
                                  return `${label} (${t}) ${qty} ${u}`;
                                })
                                .join(' · ');
                              return (
                                <tr key={pr.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                                  <td className="py-2 pr-3 text-slate-900 font-medium whitespace-nowrap">{pr.id}</td>
                                  <td className="py-2 pr-3 text-slate-700">
                                    <div className="font-medium">PI #{pr.planningExtractedId}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                                      {pr.planningSoNumber != null && String(pr.planningSoNumber).trim()
                                        ? `SO ${pr.planningSoNumber}`
                                        : '—'}
                                    </div>
                                  </td>
                                  <td className="py-2 pr-3 text-slate-600 max-w-[140px] truncate" title={pr.planningCustomerName ?? ''}>
                                    {pr.planningCustomerName != null && String(pr.planningCustomerName).trim()
                                      ? pr.planningCustomerName
                                      : '—'}
                                  </td>
                                  <td className="py-2 pr-3 text-slate-700 max-w-[180px]">
                                    <div className="truncate font-medium" title={pr.planningProductName ?? ''}>
                                      {pr.planningProductName != null && String(pr.planningProductName).trim()
                                        ? pr.planningProductName
                                        : '—'}
                                    </div>
                                    {pr.planningProductCode != null && String(pr.planningProductCode).trim() ? (
                                      <div className="text-xs text-slate-500 font-mono truncate">{pr.planningProductCode}</div>
                                    ) : null}
                                  </td>
                                  <td className="py-2 pr-3 text-slate-700 whitespace-nowrap">
                                    {pr.planningBatchId != null ? `#${pr.planningBatchId}` : '—'}
                                  </td>
                                  <td className="py-2 pr-3 text-slate-700 max-w-[140px] truncate" title={pr.preferredVendor ?? ''}>
                                    {pr.preferredVendor != null && String(pr.preferredVendor).trim() ? pr.preferredVendor : '—'}
                                  </td>
                                  <td className="py-2 pr-3 whitespace-nowrap">{pr.priority}</td>
                                  <td className="py-2 pr-3 whitespace-nowrap">{pr.status}</td>
                                  <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{pr.requiredByDate ?? '—'}</td>
                                  <td className="py-2 pr-3 text-slate-600 text-xs max-w-[280px]">
                                    <span className="line-clamp-2" title={lineSummary}>
                                      {lines.length === 0 ? '—' : lineSummary}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-3 text-slate-500 text-xs">{pr.requestedBy ?? '—'}</td>
                                </tr>
                              );
                            })}
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
                            placeholder="Search request #, SO, product, vendor, RM/PM"
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

                          const isActive =
                            tabStatus === 'All'
                              ? requestTab === 'All'
                              : tabStatus === 'Active'
                                ? requestTab === 'Active'
                                : requestTab === tabStatus;

                          return (
                            <button
                              key={tabStatus}
                              onClick={() => {
                                if (tabStatus === 'All') setRequestTab('All');
                                else if (tabStatus === 'Active') setRequestTab('Active');
                                else setRequestTab(tabStatus as RequestStatus);
                              }}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${isActive
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
                          if (categoryFilter !== 'All' && req.type !== categoryFilter) return false;
                          if (requestTab === 'Active') {
                            if (req.status === 'PO Released') return false;
                          } else if (requestTab !== 'All') {
                            if (req.status !== requestTab) return false;
                          }
                          if (searchQuery.trim()) {
                            const query = searchQuery.toLowerCase();
                            const matchesCode = req.code.toLowerCase().includes(query);
                            const matchesItems = req.items.some((item) => item.toLowerCase().includes(query));
                            const matchesPlanning =
                              (req.planningSoNumber != null && String(req.planningSoNumber).toLowerCase().includes(query)) ||
                              (req.planningCustomerName != null && String(req.planningCustomerName).toLowerCase().includes(query)) ||
                              (req.planningProductName != null && String(req.planningProductName).toLowerCase().includes(query)) ||
                              (req.planningProductCode != null && String(req.planningProductCode).toLowerCase().includes(query));
                            const matchesVendor =
                              req.preferredVendor != null && String(req.preferredVendor).toLowerCase().includes(query);
                            const matchesItemDetails = (req.itemDetails ?? []).some(
                              (d) =>
                                (d.itemName != null && String(d.itemName).toLowerCase().includes(query)) ||
                                (d.itemCode != null && String(d.itemCode).toLowerCase().includes(query))
                            );
                            if (!matchesCode && !matchesItems && !matchesPlanning && !matchesVendor && !matchesItemDetails) {
                              return false;
                            }
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
                          const dueDateRaw = String(req.dueDate ?? '').trim();
                          const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
                          const today = new Date();
                          const daysLeft =
                            dueDate && Number.isFinite(dueDate.getTime())
                              ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                              : null;
                          const dueDateDisplay =
                            dueDate && Number.isFinite(dueDate.getTime())
                              ? dueDate.toLocaleDateString('en-IN')
                              : '—';
                          const firstQuoteForReq = quotes.find((q) => q.requestId === req.id);
                          const prefVendorDisplay =
                            req.preferredVendor?.trim() ||
                            firstQuoteForReq?.vendor?.trim() ||
                            '—';

                          return (
                            <div key={req.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                              {/* Card Header */}
                              <div className="px-5 py-3 bg-linear-to-r from-blue-50 via-cyan-50 to-blue-50 border-b border-slate-200 space-y-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-3 py-1 rounded-md bg-slate-700 text-white text-xs font-mono font-bold">
                                      {req.code}
                                    </span>
                                    {req.batchId != null && req.batchId !== '' && (
                                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200" title="Batch that raised this PR">
                                        Batch #{req.batchId}
                                      </span>
                                    )}
                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${req.type === 'RM'
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
                                    <span>Req. {dueDateDisplay}</span>
                                    <span className={`font-bold ${daysLeft == null ? 'text-slate-500' : daysLeft <= 3 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-emerald-600'
                                      }`}>
                                      {daysLeft == null ? '—' : `${daysLeft}d left`}
                                    </span>
                                  </div>
                                </div>
                                {(req.planningSoNumber != null && String(req.planningSoNumber).trim()) ||
                                (req.planningProductName != null && String(req.planningProductName).trim()) ? (
                                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    {req.planningSoNumber != null && String(req.planningSoNumber).trim() ? (
                                      <span>
                                        <span className="font-semibold text-slate-700">SO</span> {req.planningSoNumber}
                                      </span>
                                    ) : null}
                                    {req.planningCustomerName != null && String(req.planningCustomerName).trim() ? (
                                      <span className="truncate max-w-[200px]" title={req.planningCustomerName}>
                                        {req.planningCustomerName}
                                      </span>
                                    ) : null}
                                    {req.planningProductName != null && String(req.planningProductName).trim() ? (
                                      <span className="truncate max-w-[280px]" title={req.planningProductName}>
                                        <span className="font-semibold text-slate-700">Product</span> {req.planningProductName}
                                        {req.planningProductCode != null && String(req.planningProductCode).trim()
                                          ? ` (${req.planningProductCode})`
                                          : ''}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>

                              {/* Card Body - Item Details Grid */}
                              <div className="p-5">
                                {req.items.map((item, itemIdx) => {
                                  const detail = req.itemDetails?.[itemIdx];
                                  const reqQtyNum = Number(detail?.reqQty ?? 0) || 0;
                                  const lineType = detail?.type === 'PM' ? 'PM' : detail?.type === 'FG' ? 'FG' : 'RM';
                                  const unitLabel = detail?.unit || (lineType === 'PM' ? 'PCS' : 'KG');
                                  const plannedPrice = Number(detail?.plannedPrice ?? 0) || 0;
                                  const estValue = reqQtyNum * plannedPrice;
                                  const leadDays = Number(detail?.leadTimeDays ?? 0) || 0;
                                  return (
                                    <div key={itemIdx} className="mb-4 last:mb-0">
                                      <div className="flex items-start justify-between mb-3 gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span
                                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                lineType === 'PM'
                                                  ? 'bg-violet-100 text-violet-800 border border-violet-200'
                                                  : lineType === 'FG'
                                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                                    : 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                              }`}
                                            >
                                              {lineType}
                                            </span>
                                            <h4 className="font-bold text-slate-900 text-sm">{item}</h4>
                                          </div>
                                          <p className="text-xs text-slate-500 font-mono truncate">{detail?.itemCode || '—'}</p>
                                        </div>
                                      </div>

                                      {/* Details Grid */}
                                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                                        <div>
                                          <p className="text-slate-500 uppercase tracking-wide mb-1">Req Qty</p>
                                          <p className="font-semibold text-slate-900">{reqQtyNum.toLocaleString('en-IN')} {unitLabel}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 uppercase tracking-wide mb-1">MOQ</p>
                                          <p className="font-semibold text-slate-900">{detail?.moq || '—'}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 uppercase tracking-wide mb-1">Pack Size</p>
                                          <p className="font-semibold text-slate-900">{detail?.packSize || '—'}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 uppercase tracking-wide mb-1">Planned ₹/unit</p>
                                          <p className="font-semibold text-emerald-600">₹{plannedPrice.toLocaleString('en-IN')}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 uppercase tracking-wide mb-1">Est. Value</p>
                                          <p className="font-semibold text-amber-600">₹{estValue.toLocaleString('en-IN')}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 uppercase tracking-wide mb-1">GRI</p>
                                          <p className="font-semibold text-slate-900">—</p>
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
                                          <p className="font-semibold text-slate-900">{leadDays > 0 ? `${leadDays}d` : '—'}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 uppercase tracking-wide mb-1">Pref. Vendor</p>
                                          <p className="font-semibold text-indigo-600 truncate" title={prefVendorDisplay}>
                                            {prefVendorDisplay}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Divider between items */}
                                      {itemIdx < req.items.length - 1 && (
                                        <div className="border-t border-slate-200 mt-4"></div>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Notes + planning context */}
                                <div className="mt-4 space-y-2">
                                  {(req.planningSoNumber != null && String(req.planningSoNumber).trim()) ||
                                  (req.planningProductName != null && String(req.planningProductName).trim()) ? (
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                                      {req.planningSoNumber != null && String(req.planningSoNumber).trim() ? (
                                        <p>
                                          <span className="font-semibold text-slate-800">SO:</span> {req.planningSoNumber}
                                          {req.planningCustomerName != null && String(req.planningCustomerName).trim()
                                            ? ` · ${req.planningCustomerName}`
                                            : ''}
                                        </p>
                                      ) : null}
                                      {req.planningProductName != null && String(req.planningProductName).trim() ? (
                                        <p className="mt-1">
                                          <span className="font-semibold text-slate-800">Product:</span> {req.planningProductName}
                                          {req.planningProductCode != null && String(req.planningProductCode).trim()
                                            ? ` (${req.planningProductCode})`
                                            : ''}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-xs text-slate-600">
                                      <span className="font-semibold text-slate-700">Notes:</span>{' '}
                                      {req.notes != null && String(req.notes).trim() ? String(req.notes) : '—'}
                                    </p>
                                  </div>
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
                                  <button
                                    onClick={() => {
                                      if (req.itemDetails && req.itemDetails.length > 0) {
                                        const item = req.itemDetails[0];
                                        const relItem: ReleaseToPlannedItem = {
                                          itemName: item.itemName,
                                          itemCode: item.itemCode,
                                          idx: 0,
                                          qty: item.reqQty,
                                          unit: item.unit,
                                          plannedPrice: item.plannedPrice,
                                          moq: item.moq,
                                          reqQty: item.reqQty,
                                          raw_material_id: item.raw_material_id,
                                          pack_material_id: item.pack_material_id,
                                          itemType: item.type === 'PM' ? 'PM' : 'RM',
                                        };
                                        setReleaseToPlannedTarget({ request: req, item: relItem });
                                        const reqType0: RequestType =
                                          relItem.itemType === 'PM' || relItem.pack_material_id != null ? 'PM' : 'RM';
                                        const itemSource0 = reqType0 === 'PM' ? itemsListPm : itemsListRm;
                                        const matchedItem0 = itemSource0.find((row) => {
                                          const rm0 = relItem.raw_material_id != null ? Number(relItem.raw_material_id) : NaN;
                                          const pm0 = relItem.pack_material_id != null ? Number(relItem.pack_material_id) : NaN;
                                          const rowRm0 = row.raw_material_id != null ? Number(row.raw_material_id) : NaN;
                                          const rowPm0 = row.pack_material_id != null ? Number(row.pack_material_id) : NaN;
                                          if (Number.isFinite(rm0) && rm0 > 0 && Number.isFinite(rowRm0) && rowRm0 > 0) return rowRm0 === rm0;
                                          if (Number.isFinite(pm0) && pm0 > 0 && Number.isFinite(rowPm0) && rowPm0 > 0) return rowPm0 === pm0;
                                          const c0 = String(relItem.itemCode ?? '').trim().toLowerCase();
                                          const n0 = String(relItem.itemName ?? '').trim().toLowerCase();
                                          const rc0 = String(row.code ?? '').trim().toLowerCase();
                                          const rn0 = String(row.name ?? '').trim().toLowerCase();
                                          if (c0 && rc0 && c0 === rc0) return true;
                                          if (n0 && rn0 && (n0 === rn0 || n0.includes(rn0) || rn0.includes(n0))) return true;
                                          return false;
                                        });
                                        const itemsListSlab0 = (matchedItem0?.vendorRates ?? []).flatMap((rate) =>
                                          (rate.tiers ?? []).map((tier) => ({
                                            vendor: String(rate.vendor_name ?? '').trim(),
                                            moq: Number(tier.moq_min ?? 0) || 0,
                                            unitPrice: Number(tier.price_per_unit ?? 0) || 0,
                                            leadDays: Number(rate.lead_time_days ?? 0) || 0,
                                            terms: String(rate.payment_terms ?? '').trim() || 'As per contract',
                                          }))
                                        ).find((s) => s.vendor);
                                        const reqQuotesForItem = quotes.filter(
                                          (q) => q.requestId === req.id && q.lines.some((l) => quoteLineMatchesReleaseTarget(l, relItem))
                                        );
                                        const first = reqQuotesForItem[0];
                                        const firstLine = first?.lines.find((l) => quoteLineMatchesReleaseTarget(l, relItem));
                                        const pt0 = parsePaymentTermsString(itemsListSlab0?.terms ?? first?.terms ?? 'As per contract');
                                        setReleaseToPlannedForm({
                                          vendor: itemsListSlab0?.vendor ?? first?.vendor ?? req.preferredVendor ?? '',
                                          moqDisplay: item.moq ? `${item.moq} (₹${itemsListSlab0?.unitPrice ?? firstLine?.pricePerUnit ?? 0} · ${itemsListSlab0?.leadDays ?? first?.leadTimeDays ?? 0}d)` : '',
                                          qty: String(item.reqQty ?? 0),
                                          unitPrice: String(itemsListSlab0?.unitPrice ?? firstLine?.pricePerUnit ?? item.plannedPrice ?? 0),
                                          paymentTermsType: pt0.type,
                                          advancePercent: String(
                                            pt0.advancePercent ||
                                            (paymentTermsTypeRequiresAdvancePercent(pt0.type) ? 50 : 0)
                                          ),
                                          leadTimeDays: itemsListSlab0?.leadDays ?? first?.leadTimeDays ?? item.leadTimeDays ?? 0,
                                        });
                                        setReleaseToPlannedNotes('');
                                        setReleaseToPlannedLineEdits(
                                          (req.itemDetails ?? []).map((d) => ({
                                            itemName: d.itemName ?? '',
                                            itemCode: d.itemCode ?? '',
                                            type: d.type === 'PM' ? 'PM' : 'RM',
                                            qty: Number(d.reqQty ?? 0) || 0,
                                            unit: String(d.unit ?? (d.type === 'PM' ? 'PCS' : 'KG')),
                                            moq: Number(d.moq ?? 0) || 0,
                                            unitPrice: Number(d.plannedPrice ?? 0) || 0,
                                            leadDays: Number(d.leadTimeDays ?? 0) || 0,
                                            ...(d.raw_material_id != null ? { raw_material_id: Number(d.raw_material_id) } : {}),
                                            ...(d.pack_material_id != null ? { pack_material_id: Number(d.pack_material_id) } : {}),
                                          }))
                                        );
                                      } else if (req.items && req.items.length > 0) {
                                        const itemName = req.items[0];
                                        const qty = req.quantities?.[0] ?? 0;
                                        const price = req.plannedPrices?.[0] ?? 0;
                                        const unit = req.units?.[0] ?? 'KG';
                                        const spec = req.specifications?.[0];
                                        const prRow = backendPrArray.find((p: { id: string }) => String(p.id) === req.id) as
                                          | { items?: { raw_material_id?: number; pack_material_id?: number; type?: string; code?: string }[] }
                                          | undefined;
                                        const line0 = prRow?.items?.[0];
                                        const relItem: ReleaseToPlannedItem = {
                                          itemName,
                                          itemCode: line0?.code,
                                          idx: 0,
                                          qty,
                                          unit,
                                          spec,
                                          plannedPrice: price,
                                          raw_material_id: line0?.raw_material_id != null ? Number(line0.raw_material_id) : undefined,
                                          pack_material_id: line0?.pack_material_id != null ? Number(line0.pack_material_id) : undefined,
                                          itemType: line0?.type === 'PM' ? 'PM' : 'RM',
                                        };
                                        setReleaseToPlannedTarget({ request: req, item: relItem });
                                        const reqType1: RequestType =
                                          relItem.itemType === 'PM' || relItem.pack_material_id != null ? 'PM' : 'RM';
                                        const itemSource1 = reqType1 === 'PM' ? itemsListPm : itemsListRm;
                                        const matchedItem1 = itemSource1.find((row) => {
                                          const rm1 = relItem.raw_material_id != null ? Number(relItem.raw_material_id) : NaN;
                                          const pm1 = relItem.pack_material_id != null ? Number(relItem.pack_material_id) : NaN;
                                          const rowRm1 = row.raw_material_id != null ? Number(row.raw_material_id) : NaN;
                                          const rowPm1 = row.pack_material_id != null ? Number(row.pack_material_id) : NaN;
                                          if (Number.isFinite(rm1) && rm1 > 0 && Number.isFinite(rowRm1) && rowRm1 > 0) return rowRm1 === rm1;
                                          if (Number.isFinite(pm1) && pm1 > 0 && Number.isFinite(rowPm1) && rowPm1 > 0) return rowPm1 === pm1;
                                          const c1 = String(relItem.itemCode ?? '').trim().toLowerCase();
                                          const n1 = String(relItem.itemName ?? '').trim().toLowerCase();
                                          const rc1 = String(row.code ?? '').trim().toLowerCase();
                                          const rn1 = String(row.name ?? '').trim().toLowerCase();
                                          if (c1 && rc1 && c1 === rc1) return true;
                                          if (n1 && rn1 && (n1 === rn1 || n1.includes(rn1) || rn1.includes(n1))) return true;
                                          return false;
                                        });
                                        const itemsListSlab1 = (matchedItem1?.vendorRates ?? []).flatMap((rate) =>
                                          (rate.tiers ?? []).map((tier) => ({
                                            vendor: String(rate.vendor_name ?? '').trim(),
                                            unitPrice: Number(tier.price_per_unit ?? 0) || 0,
                                            leadDays: Number(rate.lead_time_days ?? 0) || 0,
                                            terms: String(rate.payment_terms ?? '').trim() || 'As per contract',
                                          }))
                                        ).find((s) => s.vendor);
                                        const reqQuotesForItem = quotes.filter(
                                          (q) => q.requestId === req.id && q.lines.some((l) => quoteLineMatchesReleaseTarget(l, relItem))
                                        );
                                        const first = reqQuotesForItem[0];
                                        const firstLine = first?.lines.find((l) => quoteLineMatchesReleaseTarget(l, relItem));
                                        const pt1 = parsePaymentTermsString(itemsListSlab1?.terms ?? first?.terms ?? 'As per contract');
                                        setReleaseToPlannedForm({
                                          vendor: itemsListSlab1?.vendor ?? first?.vendor ?? req.preferredVendor ?? '',
                                          moqDisplay: '',
                                          qty: String(qty ?? 0),
                                          unitPrice: String(itemsListSlab1?.unitPrice ?? firstLine?.pricePerUnit ?? price ?? 0),
                                          paymentTermsType: pt1.type,
                                          advancePercent: String(
                                            pt1.advancePercent ||
                                            (paymentTermsTypeRequiresAdvancePercent(pt1.type) ? 50 : 0)
                                          ),
                                          leadTimeDays: itemsListSlab1?.leadDays ?? first?.leadTimeDays ?? 0,
                                        });
                                        setReleaseToPlannedNotes('');
                                        setReleaseToPlannedLineEdits((req.items ?? []).map((nm, i) => ({
                                          itemName: String(nm ?? ''),
                                          itemCode: String(line0?.code ?? ''),
                                          type: relItem.itemType === 'PM' ? 'PM' : 'RM',
                                          qty: Number((req.quantities ?? [])[i] ?? 0) || 0,
                                          unit: String((req.units ?? [])[i] ?? 'KG'),
                                          moq: 0,
                                          unitPrice: Number((req.plannedPrices ?? [])[i] ?? 0) || 0,
                                          leadDays: 0,
                                          ...(line0?.raw_material_id != null ? { raw_material_id: Number(line0.raw_material_id) } : {}),
                                          ...(line0?.pack_material_id != null ? { pack_material_id: Number(line0.pack_material_id) } : {}),
                                        })));
                                      } else {
                                        addToast('warning', 'No items on this request.');
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-amber-400 text-amber-800 text-xs font-semibold hover:bg-amber-50 transition-all"
                                  >
                                    Release to Draft PO
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
                                            addToast('warning', 'Create a Draft PO from the PR (select a recorded quotation), then release from Draft POs.');
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
                  ) : quotesForQuotationsSection.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500 shadow-sm">
                      No quotes match current filters.
                    </div>
                  ) : (
                    quotesForQuotationsSection.map((quote) => {
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
                                  {quote.status !== 'Pending Review' && (
                                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${statusClass[quote.status]}`}>
                                      {quote.status}
                                    </span>
                                  )}
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
                                  <th className="px-4 py-2.5 font-semibold text-right">VS PLANNED</th>
                                </tr>
                              </thead>
                              <tbody>
                                {quote.lines.map((line, idx) => (
                                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="font-semibold text-slate-900">{line.item}</span>
                                        {quote.id.startsWith('IL-') && (
                                          <button
                                            type="button"
                                            onClick={() => openEditItemsListTier(quote, line)}
                                            className="px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
                                          >
                                            Edit
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-bold">
                                        {line.qty}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-700">
                                      ₹{line.pricePerUnit.toLocaleString('en-IN')}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold ${line.vsPlanned.includes('-') ? 'text-emerald-600' : 'text-rose-600'
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
                            <div className="flex flex-wrap items-start justify-between gap-3 text-xs text-slate-700">
                              <div className="flex flex-wrap items-center gap-6">
                                <span className="flex items-center gap-1.5">
                                  <span className="text-slate-500">Lead time:</span>
                                  <span className="font-semibold">{quote.leadTimeDays} days</span>
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
                                className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium transition-colors shrink-0"
                              >
                                {isExpanded ? 'Hide Details' : 'View Details'}
                              </button>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200/90">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Payment terms</p>
                              <PaymentTermsDisplay value={quote.terms} />
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

                          {/* Action Buttons — DB quotations delete via API; IL-* cards are Items List aggregates (not procurement_quotations rows). */}
                          <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-end">
                            {String(quote.id).startsWith('IL-') ? (
                              <span className="text-[11px] text-slate-500">
                                Managed from Items List / vendor rates
                              </span>
                            ) : (
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
                            )}
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
                          className={`px-2 py-1 rounded border ${categoryFilter === category
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
                      value={draftPOSearch}
                      onChange={(e) => setDraftPOSearch(e.target.value)}
                      placeholder="Search vendor, DPO ID, item..."
                      className="w-60 max-w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-700"
                    />
                  </div>

                  {/* Requests marked PO Draft but no Draft PO yet — open PR modal to pick quotation & create draft */}
                  {requestsPODraftNoDraftPO.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Marked PO Draft — open PR to create Draft PO (use recorded quotations)</p>
                      {requestsPODraftNoDraftPO.map((req) => (
                        <article key={req.id} className="rounded-xl border border-amber-200 bg-amber-50/50 px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">{req.code}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${requestTypeClass[req.type]}`}>{req.type}</span>
                            <span className="text-sm text-slate-700">No draft PO yet</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              applyRouteState('Procurement', 'Draft POs');
                              setSelectedRequest(req);
                            }}
                            className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition"
                          >
                            Open PR & create Draft PO
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
                            ? 'No draft POs yet. Use the cards above to open the PR and create a Draft PO from recorded quotations.'
                            : 'No draft POs match the current filters.'}
                      </div>
                    ) : (
                      filteredDraftPOs.map((dpo) => (
                        <article key={dpo.backendPoId != null ? `po-${dpo.backendPoId}` : `dpo-${dpo.id}`} className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
                          {/* Header */}
                          <div className="px-5 py-3 border-b border-blue-200 bg-linear-to-r from-slate-50 to-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{dpo.dpoNumber}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${requestTypeClass[dpo.type]}`}>{dpo.type}</span>
                              <span className="text-sm font-bold text-slate-900">{dpo.vendor}</span>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${dpo.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              }`}>{dpo.status}</span>
                          </div>

                          {/* Items Table */}
                          <div className="px-4 py-2 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-[11px] tracking-[0.14em] text-slate-500 border-b border-slate-200">
                                  <th className="px-2 py-2">ITEM</th>
                                  <th className="px-2 py-2">TYPE</th>
                                  <th className="px-2 py-2 text-right">Lead (D)</th>
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
                                    <td className="px-2 py-2 text-right text-slate-700">{line.leadTimeDays != null ? `${line.leadTimeDays}d` : '—'}</td>
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
                              <div>
                                <p className="font-bold text-slate-800 mb-1">Payment Terms</p>
                                <PaymentTermsDisplay value={dpo.paymentTerms} />
                              </div>
                              <p><strong>Expected Delivery</strong> {new Date(dpo.expectedDelivery).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</p>
                              <p><strong>Delivery Address</strong> {dpo.deliveryAddress}</p>
                              <p><strong>Vendor Rating</strong> {dpo.vendorRating}</p>
                            </div>
                          </div>

                          {/* Alert */}
                          {dpo.alertMessage && (
                            <div className={`px-5 py-2 text-xs flex items-center gap-2 ${dpo.alertType === 'warning' ? 'bg-yellow-50 text-yellow-800' : 'bg-emerald-50 text-emerald-800'
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

              {/* Items List tier edit modal (Quotations view writes to Items List) */}
              {editItemsListLineTarget && (
                <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center px-4">
                  <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Edit vendor tier (Items List)</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {editItemsListLineTarget.vendorName} · {editItemsListLineTarget.requestType} · {editItemsListLineTarget.itemCode || '—'} {editItemsListLineTarget.itemName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditItemsListLineTarget(null)}
                        className="px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
                        disabled={editItemsListLineSaving}
                      >
                        Close
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">MOQ min</label>
                          <input
                            value={editItemsListLineForm.moqMin}
                            onChange={(e) => setEditItemsListLineForm((f) => ({ ...f, moqMin: e.target.value }))}
                            type="number"
                            min={1}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            disabled
                          />
                          <p className="text-[11px] text-slate-500 mt-1">MOQ min can’t be edited here. Create a new tier from Items List.</p>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">MOQ max (optional)</label>
                          <input
                            value={editItemsListLineForm.moqMax}
                            onChange={(e) => setEditItemsListLineForm((f) => ({ ...f, moqMax: e.target.value }))}
                            type="number"
                            min={0}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            disabled={editItemsListLineSaving}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Price / unit (₹)</label>
                          <input
                            value={editItemsListLineForm.pricePerUnit}
                            onChange={(e) => setEditItemsListLineForm((f) => ({ ...f, pricePerUnit: e.target.value }))}
                            type="number"
                            min={0}
                            step="0.01"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            disabled={editItemsListLineSaving}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Payment terms</label>
                          <input
                            value={editItemsListLineForm.paymentTerms}
                            onChange={(e) => setEditItemsListLineForm((f) => ({ ...f, paymentTerms: e.target.value }))}
                            type="text"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            disabled={editItemsListLineSaving}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditItemsListLineTarget(null)}
                          className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold"
                          disabled={editItemsListLineSaving}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveEditItemsListTier}
                          className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 text-sm font-semibold disabled:opacity-60"
                          disabled={editItemsListLineSaving}
                        >
                          {editItemsListLineSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        This updates the existing Items List tier (no new entries created from Procurement).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {sideSection === 'Issued POs' && (() => {
                const normPoKeyLocal = (n: string) =>
                  String(n ?? '').trim().replace(/^PO-?/i, '').replace(/^DPO-?/i, '');
                const totalPos = issuedPORecords.length;
                const rmPos = issuedPORecords.filter(record => record.request.type === 'RM').length;
                const pmPos = issuedPORecords.filter(record => record.request.type === 'PM').length;
                const advancePending = issuedPORecords.filter(record => record.status === 'Released').length;
                const inTransitCount = issuedPORecords.filter(record => record.status === 'In Transit').length;
                const grnComplete = completedGrns.length;

                const itemisedRows = filteredIssuedPORecords.flatMap((record, recordIndex) =>
                  record.lineItems.map((line, lineIndex) => ({
                    key: `${record.backendPoId ?? 'nobid'}-${normPoKeyLocal(record.poNumber)}-r${recordIndex}-li${lineIndex}-${line.itemCode}`,
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

                const getTimelineCompletedIndexForRecord = (record: any) => {
                  const backendPoId = record?.backendPoId ? String(record.backendPoId) : '';
                  const ov = backendPoId ? unlinkedPoTimelineOverrides[backendPoId] : undefined;
                  const tracking = backendPoId ? releasedPoTrackingByBackendId?.[backendPoId] : undefined;
                  const grnDone = grnCompletePoNormSet.has(normPoKeyLocal(record.poNumber));
                  return issuedPoCardTimelineCompletedIndex(record.status, tracking, ov, grnDone);
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
                          className={`px-2 py-1 rounded-full border text-xs ${categoryFilter === 'All'
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
                            className={`px-2 py-1 rounded-full border text-xs ${categoryFilter === type
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
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${record.request.type === 'RM'
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
                                <td className="px-4 py-2 align-top text-[11px] text-slate-600 max-w-56">
                                  <PaymentTermsDisplay compact value={record.paymentTerms} />
                                </td>
                                <td className="px-4 py-2 align-top">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${record.status === 'In Transit'
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
                      {filteredIssuedPORecords.map((record, cardIndex) => {
                        const completedIndex = getTimelineCompletedIndexForRecord(record);

                        return (
                          <div
                            key={`${record.backendPoId ?? 'nobid'}-${normPoKeyLocal(record.poNumber)}-card-${cardIndex}`}
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
                                  className={`text-[11px] mt-1 ${record.etaDays <= 1 ? 'text-rose-600' : 'text-slate-500'
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
                                      key={`${record.backendPoId ?? 'nobid'}-${normPoKeyLocal(record.poNumber)}-c${cardIndex}-${stage}`}
                                      className="relative flex flex-col items-center flex-1"
                                    >
                                      <div
                                        className={`z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-semibold shadow-sm ${done
                                          ? 'bg-emerald-500 border-emerald-500 text-white'
                                          : 'bg-white border-sky-200 text-sky-400'
                                          }`}
                                      >
                                        {index + 1}
                                      </div>
                                      <p
                                        className={`mt-2 text-[10px] tracking-[0.18em] uppercase ${done ? 'text-sky-700' : 'text-sky-400'
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
                                    key={`${record.backendPoId ?? 'nobid'}-${normPoKeyLocal(record.poNumber)}-c${cardIndex}-li-${line.itemCode}-${index}`}
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
                                onClick={() => markIssuedPOInTransit(record)}
                                disabled={record.status === 'In Transit'}
                                className={`px-3 py-1.5 rounded border text-[11px] font-semibold ${record.status === 'In Transit' ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed' : 'border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100'}`}
                              >
                                Mark In Transit
                              </button>
                              <button
                                onClick={() => receiveIssuedPOGRN(record)}
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
                          className={`px-2 py-1 rounded-full border text-xs ${grnCategoryFilter === 'All'
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
                            className={`px-2 py-1 rounded-full border text-xs ${grnCategoryFilter === type
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
                          {Array.from(new Set(grnList.map((g) => g.vendor).filter(Boolean))).map((vendor) => (
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
                        className={`px-2 py-1 rounded-full border text-[11px] md:text-xs ${itemTrackerCategory === 'All'
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
                          className={`px-2 py-1 rounded-full border text-[11px] md:text-xs ${itemTrackerCategory === type
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
                          else if (requestStatusShowsIssuedPOs(row.requestStatus)) actionLabel = 'PO';

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

                            if (requestStatusShowsIssuedPOs(row.requestStatus)) {
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
                                  <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${row.status === 'In Stock' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
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
          await queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });
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
          void invalidatePurchaseOrdersQueries();
          addToast('success', 'Request link saved. Mark Delivered at WH and timeline will use this PO.');
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedPO(null)}>
            <div
              className="w-full max-w-2xl max-h-[90vh] bg-white rounded-xl border border-blue-200 shadow-2xl overflow-y-auto flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white rounded-t-xl border-b border-blue-200 px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
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
                      <span className={`font-medium ${row.highlight ? 'text-rose-600' : row.bold ? 'text-yellow-700 font-bold' : 'text-slate-800'
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
                          <div className={`absolute -left-8 top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm z-10 ${step.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-slate-300'
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
              <div className="sticky bottom-0 bg-white rounded-b-xl border-t border-blue-200 px-5 py-3 flex items-center justify-end gap-2">
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

      {/* ── Draft PO Detail Modal ── */}
      {selectedDraftPO && (() => {
        const dpo = selectedDraftPO;
        const totals = draftPOSidebarTotals;
        const lineItems = totals?.lineItems ?? dpo.lineItems;
        const maxLeadDaysForDpo = Math.max(
          0,
          ...lineItems.map((l) => Number(l.leadTimeDays ?? 0) || 0),
        );
        const subtotal = totals?.subtotal ?? dpo.subtotal;
        const gstTotal = totals?.gstTotal ?? dpo.gstTotal;
        const grandTotal = totals?.grandTotal ?? dpo.grandTotal;
        const pricesFromItemsList = !!totals;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedDraftPO(null)}>
            <div
              className="w-full max-w-2xl max-h-[90vh] bg-white rounded-xl border border-blue-200 shadow-2xl overflow-y-auto flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white rounded-t-xl border-b border-blue-200 px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 font-mono mb-1">{dpo.requestCode}</p>
                  <h2 className="text-lg font-bold font-archivo text-slate-900 leading-tight">
                    {dpo.dpoNumber}
                  </h2>
                  <div className="mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${dpo.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
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
                  {(
                    [
                      { label: 'Vendor', value: dpo.vendor },
                      {
                        label: 'Created',
                        value: new Date(dpo.createdDate).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        }),
                      },
                      { label: 'Payment Terms', paymentTerms: dpo.paymentTerms },
                      {
                        label: 'Expected Delivery',
                        value: new Date(dpo.expectedDelivery).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        }),
                      },
                      { label: 'Lead time', value: `${maxLeadDaysForDpo} days` },
                      { label: 'Grand Total', value: `₹${grandTotal.toLocaleString('en-IN')}`, bold: true },
                      { label: 'Status', value: dpo.status, highlight: dpo.status === 'Pending Approval' },
                    ] as Array<
                      | { label: string; value: string; bold?: boolean; highlight?: boolean }
                      | { label: string; paymentTerms: string }
                    >
                  ).map((row) =>
                    'paymentTerms' in row ? (
                      <div key={row.label} className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <span className="text-slate-500 shrink-0 pt-0.5">{row.label}</span>
                        <div className="min-w-0 w-full sm:max-w-md sm:flex-1 sm:flex sm:justify-end">
                          <PaymentTermsDisplay value={row.paymentTerms} />
                        </div>
                      </div>
                    ) : (
                      <div key={row.label} className="flex items-center justify-between px-4 py-2">
                        <span className="text-slate-500">{row.label}</span>
                        <span
                          className={`font-medium ${row.highlight ? 'text-yellow-700' : row.bold ? 'text-yellow-700 font-bold' : 'text-slate-800'
                            }`}
                        >
                          {row.value}
                        </span>
                      </div>
                    ),
                  )}
                </div>

                {(totals && (() => {
                  const hasQuote = dpo.requestId && quotes.some((q) => q.requestId === dpo.requestId && q.status === 'Confirmed');
                  return hasQuote ? (
                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      Prices and totals from confirmed Quotation (vendor: {dpo.vendor}).
                    </p>
                  ) : pricesFromItemsList ? (
                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      Prices and totals from Items List (vendor: {dpo.vendor}).
                    </p>
                  ) : null;
                })())}

                {/* Alert */}
                {dpo.alertMessage && (
                  <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${dpo.alertType === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}>
                    <span>{dpo.alertType === 'warning' ? '!' : '-'}</span>
                    <span>{dpo.alertMessage}</span>
                  </div>
                )}

                {/* Line Items */}
                <div>
                  <p className="text-[10px] tracking-[0.14em] text-slate-500 uppercase mb-2">Line Items</p>
                  <div className="space-y-2">
                    {lineItems.map((line, idx) => (
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
                          <span>Price/unit: <strong className="text-slate-900">₹{typeof line.pricePerUnit === 'number' ? line.pricePerUnit.toLocaleString('en-IN') : line.pricePerUnit}</strong></span>
                          <span>Lead (D): <strong className="text-slate-900">{line.leadTimeDays != null ? `${line.leadTimeDays}d` : '—'}</strong></span>
                          <span>GST: <strong className="text-slate-900">{line.gstPercent}%</strong></span>
                          <span>GST amt: <strong className="text-slate-900">₹{line.gstAmount.toLocaleString('en-IN')}</strong></span>
                          <span className="col-span-2">Line total: <strong className="text-slate-900">₹{line.lineTotal.toLocaleString('en-IN')}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-medium text-slate-800">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">GST Total</span>
                    <span className="font-medium text-slate-800">₹{gstTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-yellow-700 font-bold">Grand Total</span>
                    <span className="text-yellow-700 font-bold text-lg">₹{grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white rounded-b-xl border-t border-blue-200 px-5 py-3 flex items-center justify-end gap-2">
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
        const selectedSet = new Set(splitSelectedLineIndexes);
        const po1PreviewItems = splitPOTarget.lineItems.filter((_, index) => selectedSet.has(index));
        const po2PreviewItems = splitPOTarget.lineItems.filter((_, index) => !selectedSet.has(index));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeSplitPOModal}>
            <div
              className="relative w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900">Split PO — {splitPOTarget.dpoNumber}</h3>
                <button
                  onClick={closeSplitPOModal}
                  className="w-7 h-7 rounded-md border border-slate-300 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="px-5 py-4 space-y-3 bg-white">
                <p className="text-xs text-slate-600">Select items for each split PO. Unchecked items will remain in a new separate PO.</p>

                <label className="block text-[10px] tracking-widest uppercase text-slate-500 mb-1">Items — Check for PO 1</label>
                <div className="space-y-2">
                  {splitPOTarget.lineItems.map((line, index) => {
                    const checked = splitSelectedLineIndexes.includes(index);
                    return (
                      <label
                        key={`${line.itemCode}-${index}`}
                        className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 cursor-pointer hover:bg-slate-100 transition"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSplitLineSelection(index)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 bg-white text-emerald-600 focus:ring-emerald-400"
                        />
                        <div className="leading-tight">
                          <p className="text-sm font-semibold text-slate-900">{line.item}</p>
                          <p className="text-xs text-slate-500">{line.qty} · ₹{line.lineTotal.toLocaleString('en-IN')}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-[10px] tracking-widest uppercase text-emerald-700 font-semibold mb-1">
                      PO 1 ({splitPOTarget.dpoNumber}-S1)
                    </p>
                    <p className="text-xs text-emerald-900">
                      {po1PreviewItems.length > 0
                        ? po1PreviewItems.map((line) => line.item).join(', ')
                        : 'No items selected yet'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                    <p className="text-[10px] tracking-widest uppercase text-sky-700 font-semibold mb-1">
                      PO 2 ({splitPOTarget.dpoNumber}-S2)
                    </p>
                    <p className="text-xs text-sky-900">
                      {po2PreviewItems.length > 0
                        ? po2PreviewItems.map((line) => line.item).join(', ')
                        : 'No items remaining'}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Two POs will be created. You can release them independently to the same or different vendors.
                  <span className="ml-2 font-medium">({selectedCount} item(s) in PO 1, {remainingCount} item(s) in PO 2)</span>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
                <button
                  onClick={submitSplitPO}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition"
                >
                  Split PO
                </button>
                <button
                  onClick={closeSplitPOModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeReleasePOModal}>
          <div
            className="relative w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Release PO — {releasePOTarget.dpoNumber}</h3>
              <button
                onClick={closeReleasePOModal}
                className="w-7 h-7 rounded-md border border-slate-300 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 bg-white">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                You are about to release a PO to <span className="font-bold">{releasePOTarget.vendor}</span> for <span className="font-bold">₹{releasePOTarget.grandTotal.toLocaleString('en-IN')}</span>.
              </div>

              <div>
                <label className="block text-[10px] tracking-widest uppercase text-slate-500 mb-1">Payment terms</label>
                <PaymentTermsDisplay value={releasePOTarget.paymentTerms} />
              </div>

              {releaseDraftRequiresAdvance && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 space-y-2">
                  <p className="font-semibold">Advance payment required</p>
                  {!releaseDraftBackendPoIdNormalized ? (
                    <p className="text-amber-900">
                      This draft cannot be released until the purchase order exists on the server. Create or refresh the draft PO, then try again.
                    </p>
                  ) : releaseDraftTrackingLoading ? (
                    <p className="text-amber-800">Checking PO tracking…</p>
                  ) : advanceRecordedForReleaseDraft ? (
                    <p className="text-emerald-800 font-medium">
                      Advance recorded
                      {releaseDraftTracking?.advancePaidAt
                        ? ` (${new Date(releaseDraftTracking.advancePaidAt).toLocaleDateString('en-IN')})`
                        : ''}
                      . You may release the PO.
                    </p>
                  ) : (
                    <>
                      <p className="text-amber-900">
                        These terms include an advance. Record that the advance has been received (manual step until treasury transactions are wired) before issuing
                        this PO to the vendor.
                      </p>
                      <button
                        type="button"
                        disabled={recordingAdvancePayment}
                        onClick={() => void recordAdvancePaymentForReleaseDraft()}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {recordingAdvancePayment ? 'Saving…' : 'Record advance payment received'}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] tracking-widest uppercase text-slate-500 mb-1">PO Number</label>
                  <input
                    value={releasePOTarget.dpoNumber}
                    readOnly
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-widest uppercase text-slate-500 mb-1">Release Method</label>
                  <select
                    value={releaseMethod}
                    onChange={(event) => setReleaseMethod(event.target.value as 'Email + Portal' | 'Email only' | 'Portal only' | 'WhatsApp + Email')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
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

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={submitReleasePO}
                disabled={
                  releaseDraftRequiresAdvance &&
                  (!releaseDraftBackendPoIdNormalized ||
                    !advanceRecordedForReleaseDraft ||
                    releaseDraftTrackingLoading)
                }
                title={
                  releaseDraftRequiresAdvance && !advanceRecordedForReleaseDraft && releaseDraftBackendPoIdNormalized
                    ? 'Record advance payment before releasing'
                    : undefined
                }
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Release PO
              </button>
              <button
                onClick={closeReleasePOModal}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ))()}

      {/* ── Request Detail Modal ── */}
      {selectedRequest && (() => {
        const req = selectedRequest;
        // Legacy procurement_quotations fallback (kept for Draft PO flow compatibility).
        const prItemNames = new Set<string>(
          [
            ...(req.items ?? []),
            ...(req.itemDetails?.map((d) => d.itemName).filter(Boolean) ?? []),
          ].map((n) => String(n).trim().toLowerCase()).filter(Boolean)
        );
        const reqQuotes = quotes.filter((q) =>
          q.lines?.some((l) => {
            const qName = String(l.item ?? '').trim().toLowerCase();
            if (!qName) return false;
            return prItemNames.has(qName) || [...prItemNames].some((prName) => prName.includes(qName) || qName.includes(prName));
          })
        );
        const requestItemQuotes = (req.itemDetails ?? []).flatMap((item) => {
          const itemNameNorm = String(item.itemName ?? '').trim().toLowerCase();
          const itemCodeNorm = String(item.itemCode ?? '').trim().toLowerCase();
          const rmId = item.raw_material_id != null ? Number(item.raw_material_id) : NaN;
          const pmId = item.pack_material_id != null ? Number(item.pack_material_id) : NaN;
          const reqType: RequestType =
            Number.isFinite(pmId) && pmId > 0 ? 'PM' : Number.isFinite(rmId) && rmId > 0 ? 'RM' : req.type;
          const source = reqType === 'PM' ? itemsListPm : itemsListRm;
          const matched = source.find((row) => {
            const rowRmId = row.raw_material_id != null ? Number(row.raw_material_id) : NaN;
            const rowPmId = row.pack_material_id != null ? Number(row.pack_material_id) : NaN;
            if (Number.isFinite(rmId) && rmId > 0 && Number.isFinite(rowRmId) && rowRmId > 0) return rowRmId === rmId;
            if (Number.isFinite(pmId) && pmId > 0 && Number.isFinite(rowPmId) && rowPmId > 0) return rowPmId === pmId;
            const rowCode = String(row.code ?? '').trim().toLowerCase();
            const rowName = String(row.name ?? '').trim().toLowerCase();
            if (itemCodeNorm && rowCode && rowCode === itemCodeNorm) return true;
            if (itemNameNorm && rowName && (rowName === itemNameNorm || rowName.includes(itemNameNorm) || itemNameNorm.includes(rowName))) return true;
            return false;
          });
          if (!matched) return [];
          return (matched.vendorRates ?? []).flatMap((rate) => {
            const vendorName = String(rate.vendor_name ?? '').trim();
            if (!vendorName) return [];
            const paymentTerms = String(rate.payment_terms ?? '').trim();
            const leadDays = Number(rate.lead_time_days ?? 0) || 0;
            return (rate.tiers ?? []).map((tier) => ({
              key: `${item.itemCode}|${vendorName}|${tier.id ?? tier.moq_min ?? 0}`,
              itemName: item.itemName,
              itemCode: item.itemCode,
              vendor: vendorName,
              pricePerUnit: Number(tier.price_per_unit ?? 0) || 0,
              moqMin: Number(tier.moq_min ?? 0) || 0,
              moqMax: tier.moq_max != null ? Number(tier.moq_max) : null,
              leadTimeDays: leadDays,
              paymentTerms,
              requestType: reqType,
            }));
          });
        });
        const requestQuotedVendors = Array.from(
          new Set(requestItemQuotes.map((q) => q.vendor).filter((v) => v.trim().length > 0))
        ).sort((a, b) => a.localeCompare(b));
        const canReleasePO = req.status === 'PO Draft';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedRequest(null)}>
            {/* Modal */}
            <div
              className="w-full max-w-2xl max-h-[90vh] bg-white rounded-xl border border-blue-200 shadow-2xl overflow-y-auto flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 rounded-t-xl bg-linear-to-r from-blue-50 via-cyan-50 to-blue-50 border-b border-blue-200 px-6 py-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 pr-2">
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">
                      {req.code} — {(req.preferredVendor ?? '').trim() || 'No preferred vendor'}
                    </h2>
                    {(req.description?.trim() || req.items[0]) && (
                      <p className="text-sm text-slate-600 mt-1.5 font-medium leading-snug">
                        {req.description?.trim() || req.items[0]}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="text-slate-400 hover:text-slate-700 text-2xl leading-none transition-colors"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-md font-bold border ${req.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' :
                    req.priority === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>{req.priority}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-md font-bold border ${req.status === 'New' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    req.status === 'Quoted' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      req.status === 'PO Draft' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        req.status === 'PO Released' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>{req.status}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-md font-bold border ${req.type === 'RM' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-violet-50 text-violet-700 border-violet-200'
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
                      {req.itemDetails.map((item, _idx) => {
                        const itemName = item.itemName ?? '';
                        const itemNameNorm = itemName.trim().toLowerCase();
                        const lineMatches = (lineItem: string) => {
                          const q = String(lineItem ?? '').trim().toLowerCase();
                          return q && (itemNameNorm === q || itemNameNorm.includes(q) || q.includes(itemNameNorm));
                        };
                        const quoteHistory = quotes.filter((q) => q.lines?.some((l) => lineMatches(l.item))).map((q) => {
                          const line = q.lines?.find((l) => lineMatches(l.item));
                          return { vendor: q.vendor ?? '', date: q.quotedOn ?? '', price: line?.pricePerUnit ?? 0, status: q.status };
                        });
                        const prPOs = purchaseOrders.filter((po) => (po.formData as { requestId?: string })?.requestId === req.id);
                        const poHistory = prPOs.filter((po) => (po.rawItems as { itemName?: string; name?: string; rate?: number; price?: number }[] | undefined)?.some((r) => lineMatches(r.itemName ?? r.name ?? ''))).map((po) => {
                          const raw = (po.rawItems ?? []) as { itemName?: string; name?: string; rate?: number; price?: number }[];
                          const row = raw.find((r) => lineMatches(r.itemName ?? r.name ?? ''));
                          return { vendor: po.vendorName ?? '', poNumber: po.poNumber ?? '', rate: row?.rate ?? row?.price ?? 0 };
                        });
                        return (
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

                              {/* Vendor history for this RM */}
                              {(quoteHistory.length > 0 || poHistory.length > 0) && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                  <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Vendor history (previously used for this RM)</p>
                                  <div className="space-y-1.5 text-xs">
                                    {quoteHistory.map((e, i) => (
                                      <div key={`q-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-700">
                                        <span className="font-medium text-slate-900">{e.vendor}</span>
                                        <span className="text-slate-500">— Quoted</span>
                                        {e.date && <span className="text-slate-500">{e.date}</span>}
                                        <span className="text-emerald-600 font-medium">₹{Number(e.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/unit</span>
                                        {e.status === 'Confirmed' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Confirmed</span>}
                                      </div>
                                    ))}
                                    {poHistory.map((e, i) => (
                                      <div key={`po-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-700">
                                        <span className="font-medium text-slate-900">{e.vendor}</span>
                                        <span className="text-slate-500">— PO</span>
                                        <span className="font-mono text-slate-600">{e.poNumber}</span>
                                        <span className="text-emerald-600 font-medium">₹{Number(e.rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/unit</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
                        const itemNameNorm = String(itemName ?? '').trim().toLowerCase();
                        const lineMatches = (lineItem: string) => {
                          const q = String(lineItem ?? '').trim().toLowerCase();
                          return q && (itemNameNorm === q || itemNameNorm.includes(q) || q.includes(itemNameNorm));
                        };
                        const quoteHistory = quotes.filter((q) => q.lines?.some((l) => lineMatches(l.item))).map((q) => {
                          const line = q.lines?.find((l) => lineMatches(l.item));
                          return { vendor: q.vendor ?? '', date: q.quotedOn ?? '', price: line?.pricePerUnit ?? 0, status: q.status };
                        });
                        const prPOs = purchaseOrders.filter((po) => (po.formData as { requestId?: string })?.requestId === req.id);
                        const poHistory = prPOs.filter((po) => (po.rawItems as { itemName?: string; name?: string; rate?: number; price?: number }[] | undefined)?.some((r) => lineMatches(r.itemName ?? r.name ?? ''))).map((po) => {
                          const raw = (po.rawItems ?? []) as { itemName?: string; name?: string; rate?: number; price?: number }[];
                          const row = raw.find((r) => lineMatches(r.itemName ?? r.name ?? ''));
                          return { vendor: po.vendorName ?? '', poNumber: po.poNumber ?? '', rate: row?.rate ?? row?.price ?? 0 };
                        });
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
                            {(quoteHistory.length > 0 || poHistory.length > 0) && (
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Vendor history (previously used for this RM)</p>
                                <div className="space-y-1.5 text-xs">
                                  {quoteHistory.map((e, i) => (
                                    <div key={`q-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-700">
                                      <span className="font-medium text-slate-900">{e.vendor}</span>
                                      <span className="text-slate-500">— Quoted</span>
                                      {e.date && <span className="text-slate-500">{e.date}</span>}
                                      <span className="text-emerald-600 font-medium">₹{Number(e.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/unit</span>
                                      {e.status === 'Confirmed' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Confirmed</span>}
                                    </div>
                                  ))}
                                  {poHistory.map((e, i) => (
                                    <div key={`po-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-700">
                                      <span className="font-medium text-slate-900">{e.vendor}</span>
                                      <span className="text-slate-500">— PO</span>
                                      <span className="font-mono text-slate-600">{e.poNumber}</span>
                                      <span className="text-emerald-600 font-medium">₹{Number(e.rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/unit</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
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
                      {(() => {
                        const summary = requestStockSummaryByRequestId.get(req.id)
                          ?? req.stockSummary
                          ?? { stockInHand: 0, openPOQty: 0, inTransit: 0, openOrders: 0 };
                        return [
                          { label: 'Stock In Hand', value: summary.stockInHand, color: summary.stockInHand > 100 ? 'text-emerald-600' : 'text-amber-600' },
                          { label: 'Open PO Qty', value: summary.openPOQty, color: 'text-slate-900' },
                          { label: 'In Transit', value: summary.inTransit, color: summary.inTransit > 0 ? 'text-cyan-600' : 'text-slate-900' },
                          { label: 'Open Orders', value: summary.openOrders, color: summary.openOrders > 0 ? 'text-blue-600' : 'text-slate-900' },
                        ];
                      })().map((row, idx) => (
                        <div key={row.label} className={`flex items-center justify-between px-4 py-3 ${idx < 3 ? 'border-b border-slate-200' : ''}`}>
                          <span className="text-slate-600 text-sm">{row.label}</span>
                          <span className={`font-bold text-lg ${row.color}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quotations from Items List + vendor selection for this PR */}
                <div>
                  <h3 className="text-xs tracking-wider text-slate-600 uppercase mb-3 font-bold">
                    Quotations ({requestItemQuotes.length})
                  </h3>
                  {requestItemQuotes.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-blue-200 px-4 py-8 text-center text-sm text-slate-500">
                      No Items List vendor rates found for this request&apos;s RM/PM items yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Preferred vendor for this request</label>
                          <select
                            value={req.preferredVendor ?? ''}
                            onChange={async (e) => {
                              const nextVendor = e.target.value.trim();
                              const prevVendor = req.preferredVendor ?? '';
                              setSelectedRequest((prev) => (prev && prev.id === req.id ? { ...prev, preferredVendor: nextVendor || null } : prev));
                              updateProcurementState((current) => ({
                                ...current,
                                requests: current.requests.map((r) => (r.id === req.id ? { ...r, preferredVendor: nextVendor || null } : r)),
                              }));
                              const res = await updateProcurementRequestApi(req.id, { preferredVendor: nextVendor || null });
                              if (!res.success) {
                                setSelectedRequest((prev) => (prev && prev.id === req.id ? { ...prev, preferredVendor: prevVendor || null } : prev));
                                updateProcurementState((current) => ({
                                  ...current,
                                  requests: current.requests.map((r) => (r.id === req.id ? { ...r, preferredVendor: prevVendor || null } : r)),
                                }));
                                const err =
                                  res.error == null
                                    ? 'Failed to update preferred vendor'
                                    : typeof res.error === 'string'
                                      ? res.error
                                      : (res.error.message ?? 'Failed to update preferred vendor');
                                addToast('error', err);
                                return;
                              }
                              queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                              addToast('success', 'Preferred vendor updated');
                            }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                          >
                            <option value="">— Select vendor —</option>
                            {requestQuotedVendors.map((vendorName) => (
                              <option key={vendorName} value={vendorName}>
                                {vendorName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="min-w-full text-xs">
                          <thead className="bg-slate-100 text-slate-700">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Item</th>
                              <th className="px-3 py-2 text-left font-semibold">Vendor</th>
                              <th className="px-3 py-2 text-right font-semibold">Price/Unit</th>
                              <th className="px-3 py-2 text-right font-semibold">MOQ</th>
                              <th className="px-3 py-2 text-right font-semibold">Lead (D)</th>
                              <th className="px-3 py-2 text-left font-semibold">Terms</th>
                            </tr>
                          </thead>
                          <tbody>
                            {requestItemQuotes.map((row) => (
                              <tr key={row.key} className="border-t border-slate-100">
                                <td className="px-3 py-2">
                                  <div className="font-medium text-slate-900">{row.itemName}</div>
                                  <div className="text-[10px] text-slate-500">{row.itemCode}</div>
                                </td>
                                <td className="px-3 py-2 text-slate-800">{row.vendor}</td>
                                <td className="px-3 py-2 text-right text-slate-900">₹{row.pricePerUnit.toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 text-right text-slate-700">
                                  {row.moqMin}
                                  {row.moqMax != null && row.moqMax > row.moqMin ? ` - ${row.moqMax}` : '+'}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-700">{row.leadTimeDays}d</td>
                                <td className="px-3 py-2 text-slate-700 max-w-48 align-top">
                                  <PaymentTermsDisplay compact value={row.paymentTerms} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Stock Check Section — editable, persisted to DB */}
                {/* <div>
                  <h3 className="text-xs tracking-wider text-slate-600 uppercase mb-3 font-bold">Stock Check</h3>
                  <div className="bg-white rounded-lg border border-blue-200 p-4 space-y-3 shadow-sm">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Assigned To</label>
                      <input
                        type="text"
                        value={stockCheckForm.assignedTo}
                        onChange={(e) => setStockCheckForm((f) => ({ ...f, assignedTo: e.target.value }))}
                        placeholder="e.g. Anand Store"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                      <select
                        value={stockCheckForm.status}
                        onChange={(e) => setStockCheckForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
                      >
                        <option value="">— Select status —</option>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
                      <input
                        type="date"
                        value={stockCheckForm.dueDate}
                        onChange={(e) => setStockCheckForm((f) => ({ ...f, dueDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Alert</label>
                      <textarea
                        value={stockCheckForm.notes}
                        onChange={(e) => setStockCheckForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="e.g. Quarterly replenishment; SOH critically low for UV-001"
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                      />
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={stockCheckSaving}
                        onClick={async () => {
                          setStockCheckSaving(true);
                          const res = await updateProcurementRequestApi(req.id, {
                            stockCheckAssignedTo: stockCheckForm.assignedTo.trim() || null,
                            stockCheckStatus: stockCheckForm.status.trim() || null,
                            stockCheckDueDate: stockCheckForm.dueDate.trim() || null,
                            stockCheckNotes: stockCheckForm.notes.trim() || null,
                          });
                          setStockCheckSaving(false);
                          if (res.success) {
                            queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                            addToast('success', 'Stock check saved');
                          } else {
                            const stockCheckErr =
                              res.error == null
                                ? 'Failed to save stock check'
                                : typeof res.error === 'string'
                                  ? res.error
                                  : (res.error.message ?? 'Failed to save stock check');
                            addToast('error', stockCheckErr);
                          }
                        }}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                      >
                        {stockCheckSaving ? 'Saving…' : 'Save stock check'}
                      </button>
                    </div>
                  </div>
                </div> */}
              </div>

              {/* Action Buttons */}
              <div className="sticky bottom-0 rounded-b-xl bg-slate-50 border-t border-blue-200 px-6 py-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setEditRequestTarget(req);
                  }}
                  className="px-4 py-2 rounded-lg border border-blue-300 text-slate-700 text-sm font-semibold hover:bg-blue-50 transition"
                >
                  Edit Request
                </button>

                <div className="flex items-center gap-2">
                  {reqQuotes.length > 0 && selectedQuoteIdInPrView && (
                    <button
                      onClick={async () => {
                        const selectedQuote = quotes.find((q) => q.id === selectedQuoteIdInPrView);
                        const backendPr = backendPrArray.find((p: { id: string }) => String(p.id) === req.id) as { items?: BackendPRItem[] } | undefined;
                        const items = Array.isArray(backendPr?.items) ? backendPr.items : [];
                        if (!items.length) {
                          addToast('warning', 'Request has no line items. Add items in Edit Request first.');
                          return;
                        }
                        const raised = await createDraftPOFromRequest(
                          req.id,
                          req.code,
                          items,
                          selectedQuote?.vendor ?? '',
                          req.type,
                          selectedQuoteIdInPrView
                        );
                        if (raised) {
                          setSelectedRequest(null);
                          applyRouteState('Procurement', 'Draft POs');
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition shadow-lg"
                    >
                      Create Draft PO
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
                            addToast('warning', 'Create a Draft PO from the quotation above first, then release from here.');
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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4" onClick={() => setEditRequestTarget(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl border border-slate-200 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">Edit Request — {editRequestTarget.code}</h3>
            <div className="space-y-3">
              {/* <div>
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
              </div> */}
              {/* {(() => {
                const requestQuotes = quotes.filter(
                  (q) => q.requestId === editRequestTarget.id && (!editRequestForm.preferredVendor?.trim() || (q.vendor ?? '').trim().toLowerCase() === editRequestForm.preferredVendor.trim().toLowerCase())
                );
                return (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Quotation to use for Draft PO</label>
                    <select
                      value={editRequestForm.selectedQuotationId}
                      onChange={(e) => setEditRequestForm((f) => ({ ...f, selectedQuotationId: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">— Select quotation (order qty · price/unit) —</option>
                      {requestQuotes.map((q) => {
                        const firstLine = q.lines?.[0];
                        const label = firstLine
                          ? `${q.vendor ?? 'Vendor'} · ${firstLine.item ?? 'Item'}: ${firstLine.qty ?? 0} ${(firstLine.unit ?? 'kg').toLowerCase()} @ ₹${Number(firstLine.pricePerUnit) || 0}`
                          : `${q.vendor ?? 'Vendor'} (${q.lines?.length ?? 0} lines)`;
                        return (
                          <option key={q.id} value={q.id}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Choose which quotation’s price to use when creating a Draft PO.</p>
                  </div>
                );
              })()} */}
              {/* <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <textarea
                  value={editRequestForm.notes}
                  onChange={(e) => setEditRequestForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div> */}
              {/* <div>
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
              </div> */}
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

              {/* Price history: all quotations that have these items (any vendor) + POs for this request */}
              {/* <div className="border-t border-slate-200 pt-4 mt-4">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Price history — RM/PM by vendor</h4>
                <p className="text-xs text-slate-500 mb-3">For each RM/PM on this request: which vendors have been used historically (from quotations and POs). Use this when picking a vendor for a new quote or Draft PO.</p>
                {(() => {
                  const prItemNames = new Set<string>(
                    [
                      ...(editRequestTarget.items ?? []),
                      ...(editRequestTarget.itemDetails?.map((d) => d.itemName).filter(Boolean) ?? []),
                    ].map((n) => String(n).trim().toLowerCase()).filter(Boolean)
                  );
                  const quotesForItems = quotes.filter((q) =>
                    q.lines?.some((l) => prItemNames.has(String(l.item ?? '').trim().toLowerCase()))
                  );
                  const prPOs = purchaseOrders.filter((po) => (po.formData as { requestId?: string } | undefined)?.requestId === editRequestTarget.id);
                  const prPOsReleased = prPOs.filter((po) => (po.status ?? 'Draft') !== 'Draft');
                  const quotesReleasedAsPO = quotesForItems.filter(
                    (q) =>
                      q.status === 'Confirmed' &&
                      prPOsReleased.some(
                        (po) => (po.vendorName ?? '').trim().toLowerCase() === (q.vendor ?? '').trim().toLowerCase()
                      )
                  );
                  if (quotesForItems.length === 0 && prPOs.length === 0) {
                    return (
                      <p className="text-xs text-slate-500 italic">No price history for these items yet. Record quotations (with or without linking to a PR) to see vendor history here.</p>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      {quotesForItems.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Quotations for these items ({quotesForItems.length} total, any vendor)</p>
                          <div className="space-y-3">
                            {quotesForItems.map((q) => (
                              <div key={q.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
                                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                  <span className="font-semibold text-slate-900">{q.vendor}</span>
                                  <span className="text-xs text-slate-500">{q.quotedOn || '—'}</span>
                                  {q.requestCode && <span className="text-[10px] text-slate-500">Link: {q.requestCode}</span>}
                                  {q.status !== 'Pending Review' && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${q.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' :
                                      q.status === 'Not Selected' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'
                                      }`}>{q.status}</span>
                                  )}
                                </div>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-slate-500 border-b border-slate-200">
                                      <th className="text-left py-1 font-medium">Item</th>
                                      <th className="text-right py-1 font-medium">Qty</th>
                                      <th className="text-right py-1 font-medium">Price/unit</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {q.lines?.map((line, i) => (
                                      <tr key={i} className="border-b border-slate-100 last:border-0">
                                        <td className="py-1 text-slate-800">{line.item}</td>
                                        <td className="py-1 text-right text-slate-700">{line.qty}</td>
                                        <td className="py-1 text-right font-medium">₹{typeof line.pricePerUnit === 'number' ? line.pricePerUnit.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : line.pricePerUnit}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {prPOs.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">POs for this request</p>
                          <div className="space-y-3">
                            {prPOs.map((po) => (
                              <div key={po.id} className="rounded-lg border border-slate-200 bg-blue-50/30 p-3 text-sm">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="font-semibold text-slate-900">{po.vendorName ?? po.id}</span>
                                  <span className="text-xs text-slate-600 font-mono">{po.poNumber}</span>
                                  <span className="text-xs text-slate-500">{po.date || '—'}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-200 text-slate-700">{po.status ?? 'Draft'}</span>
                                </div>
                                {Array.isArray(po.rawItems) && po.rawItems.length > 0 ? (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-slate-500 border-b border-slate-200">
                                        <th className="text-left py-1 font-medium">Item</th>
                                        <th className="text-right py-1 font-medium">Qty</th>
                                        <th className="text-right py-1 font-medium">Rate</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {po.rawItems.map((row: { itemName?: string; name?: string; quantity?: number; rate?: number; price?: number }, i: number) => (
                                        <tr key={i} className="border-b border-slate-100 last:border-0">
                                          <td className="py-1 text-slate-800">{row.itemName ?? row.name ?? '—'}</td>
                                          <td className="py-1 text-right text-slate-700">{row.quantity ?? '—'}</td>
                                          <td className="py-1 text-right font-medium">₹{typeof (row.rate ?? row.price) === 'number' ? (row.rate ?? row.price)!.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : (row.rate ?? row.price ?? '—')}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="text-xs text-slate-500">No line detail</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div> */}
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
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Release to PO Planned Stage Modal ── */}
      {releaseToPlannedTarget && (() => {
        const { request: req, item } = releaseToPlannedTarget;
        const itemName = item.itemName;
        const itemCode = item.itemCode ?? (req.type === 'RM' ? 'RI-RM-001-001' : 'PI-PM-002-001');
        const _spec = item.spec ?? `${req.type} · ${item.unit}`;
        const reqTypeModal: RequestType =
          item.itemType === 'PM' || item.pack_material_id != null ? 'PM' : 'RM';
        const itemSourceModal = reqTypeModal === 'PM' ? itemsListPm : itemsListRm;
        const matchedItemModal = itemSourceModal.find((row) => {
          const rmM = item.raw_material_id != null ? Number(item.raw_material_id) : NaN;
          const pmM = item.pack_material_id != null ? Number(item.pack_material_id) : NaN;
          const rowRmM = row.raw_material_id != null ? Number(row.raw_material_id) : NaN;
          const rowPmM = row.pack_material_id != null ? Number(row.pack_material_id) : NaN;
          if (Number.isFinite(rmM) && rmM > 0 && Number.isFinite(rowRmM) && rowRmM > 0) return rowRmM === rmM;
          if (Number.isFinite(pmM) && pmM > 0 && Number.isFinite(rowPmM) && rowPmM > 0) return rowPmM === pmM;
          const cM = String(item.itemCode ?? '').trim().toLowerCase();
          const nM = String(item.itemName ?? '').trim().toLowerCase();
          const rcM = String(row.code ?? '').trim().toLowerCase();
          const rnM = String(row.name ?? '').trim().toLowerCase();
          if (cM && rcM && cM === rcM) return true;
          if (nM && rnM && (nM === rnM || nM.includes(rnM) || rnM.includes(nM))) return true;
          return false;
        });
        const vendorSlabsFromItemsList = (matchedItemModal?.vendorRates ?? []).flatMap((rate) =>
          (rate.tiers ?? []).map((tier) => ({
            vendor: String(rate.vendor_name ?? '').trim(),
            moq: Number(tier.moq_min ?? 0) || 0,
            unitPrice: Number(tier.price_per_unit ?? 0) || 0,
            leadDays: Number(rate.lead_time_days ?? 0) || 0,
            terms: String(rate.payment_terms ?? '').trim() || 'As per contract',
          }))
        ).filter((s) => s.vendor);
        const reqQuotesForItem = quotes.filter(
          (q) => q.requestId === req.id && q.lines.some((l) => quoteLineMatchesReleaseTarget(l, item))
        );
        const vendorSlabsFromQuotes = reqQuotesForItem.flatMap((q) => {
          const line = q.lines.find((l) => quoteLineMatchesReleaseTarget(l, item));
          if (!line) return [];
          const moqFromQty = typeof line.qty === 'string' ? parseInt(line.qty, 10) : line.qty;
          return [{ vendor: q.vendor, moq: Number.isNaN(moqFromQty) ? item.moq ?? '—' : moqFromQty, unitPrice: line.pricePerUnit, leadDays: q.leadTimeDays, terms: q.terms }];
        });
        const vendorSlabs = vendorSlabsFromItemsList.length > 0 ? vendorSlabsFromItemsList : vendorSlabsFromQuotes;
        const lineItemsForModal = releaseToPlannedLineEdits.length > 0
          ? releaseToPlannedLineEdits
          : [{
            itemName: itemName ?? '',
            itemCode: itemCode ?? '',
            type: req.type,
            qty: Number(item.reqQty ?? item.qty ?? 0) || 0,
            unit: String(item.unit ?? (req.type === 'PM' ? 'PCS' : 'KG')),
            moq: Number(item.moq ?? 0) || 0,
            unitPrice: Number(item.plannedPrice ?? 0) || 0,
            leadDays: Number(releaseToPlannedForm.leadTimeDays ?? 0) || 0,
            ...(item.raw_material_id != null ? { raw_material_id: Number(item.raw_material_id) } : {}),
            ...(item.pack_material_id != null ? { pack_material_id: Number(item.pack_material_id) } : {}),
          }];
        const releaseModalSubtotal = lineItemsForModal.reduce(
          (sum, ln) => sum + (Number(ln.qty) || 0) * (Number(ln.unitPrice) || 0),
          0
        );
        const releaseModalGstTotal = parseFloat((releaseModalSubtotal * 0.18).toFixed(2));
        const releaseModalGrand = parseFloat((releaseModalSubtotal + releaseModalGstTotal).toFixed(2));
        const allVendorNamesFromItemsList = new Set<string>();
        lineItemsForModal.forEach((ln) => {
          const source = ln.type === 'PM' ? itemsListPm : itemsListRm;
          const row = source.find((r) => {
            const c0 = String(ln.itemCode ?? '').trim().toLowerCase();
            const n0 = String(ln.itemName ?? '').trim().toLowerCase();
            const rc0 = String(r.code ?? '').trim().toLowerCase();
            const rn0 = String(r.name ?? '').trim().toLowerCase();
            const rmA = ln.raw_material_id != null ? Number(ln.raw_material_id) : NaN;
            const pmA = ln.pack_material_id != null ? Number(ln.pack_material_id) : NaN;
            const rmB = r.raw_material_id != null ? Number(r.raw_material_id) : NaN;
            const pmB = r.pack_material_id != null ? Number(r.pack_material_id) : NaN;
            if (Number.isFinite(rmA) && rmA > 0 && Number.isFinite(rmB) && rmB > 0) return rmA === rmB;
            if (Number.isFinite(pmA) && pmA > 0 && Number.isFinite(pmB) && pmB > 0) return pmA === pmB;
            if (c0 && rc0 && c0 === rc0) return true;
            if (n0 && rn0 && (n0 === rn0 || n0.includes(rn0) || rn0.includes(n0))) return true;
            return false;
          });
          (row?.vendorRates ?? []).forEach((vr) => {
            const vn = String(vr.vendor_name ?? '').trim();
            if (vn) allVendorNamesFromItemsList.add(vn);
          });
        });
        const uniqueVendors = Array.from(new Set([...allVendorNamesFromItemsList, ...vendorSlabs.map((s) => s.vendor)])).sort((a, b) => a.localeCompare(b));
        /** PO line matches this PR line — never use empty substring (.includes('') matches everything). */
        const nameKey = (itemName ?? '').trim().toLowerCase();
        const codeKey = (itemCode ?? '').trim().toLowerCase();
        const hasMatchKey = nameKey.length > 0 || codeKey.length > 0;
        const poLineMatches = (r: { itemName?: string; name?: string; itemCode?: string; code?: string }) => {
          const rn = (r?.itemName ?? r?.name ?? '').toString().trim().toLowerCase();
          const rc = (r?.itemCode ?? r?.code ?? '').toString().trim().toLowerCase();
          if (nameKey.length > 0 && rn.length > 0 && rn === nameKey) return true;
          if (codeKey.length > 0 && rc.length > 0 && rc === codeKey) return true;
          return false;
        };
        const selectedVendorName = String(releaseToPlannedForm.vendor ?? '').trim().toLowerCase();
        const previousPurchases = !hasMatchKey
          ? []
          : (purchaseOrders ?? [])
            // Backend source of truth: purchase_orders API (skip local draft-only rows)
            .filter((po) => {
              const status = String(po.status ?? '').trim().toLowerCase();
              if (status === 'draft') return false;
              if (selectedVendorName) {
                const poVendor = String(po.vendorName ?? '').trim().toLowerCase();
                if (!poVendor || poVendor !== selectedVendorName) return false;
              }
              const raw = po.rawItems ?? [];
              return raw.some((r: any) => poLineMatches(r));
            })
            .map((po) => {
              const raw = (po.rawItems ?? []) as { itemName?: string; name?: string; itemCode?: string; code?: string; quantity?: number; rate?: number; price?: number }[];
              const row = raw.find((r) => poLineMatches(r));
              return {
                date: po.date ?? '',
                vendor: po.vendorName ?? '',
                qty: row?.quantity ?? 0,
                unitPrice: row?.rate ?? row?.price ?? 0,
                unit: item.unit,
              };
            })
            .filter((r) => r.qty > 0)
            .slice(0, 10);
        const reqSummary = requestStockSummaryByRequestId.get(req.id)
          ?? req.stockSummary
          ?? { stockInHand: 0, openPOQty: 0, inTransit: 0, openOrders: 0 };
        const _gapQty = Math.max(
          0,
          (item.reqQty ?? item.qty) - (reqSummary.stockInHand ?? 0) - (reqSummary.openPOQty ?? 0),
        );
        const releaseModalVendorName = String(releaseToPlannedForm.vendor || req.preferredVendor || '').trim();
        const releaseModalVendorTerms =
          vendors.find(
            (v) => (v.name || '').trim().toLowerCase() === releaseModalVendorName.toLowerCase(),
          )?.paymentTerms ?? '';
        return (
          <div className="fixed inset-0 z-60 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto" onClick={() => setReleaseToPlannedTarget(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative w-full max-w-5xl my-2 sm:my-4 max-h-[94vh] overflow-hidden rounded-xl bg-white shadow-xl border border-slate-200 flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    PO-DRAFT-{req.code.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase() || 'XXXX'}
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded border border-cyan-200 bg-cyan-50 text-cyan-700">
                      {releaseToPlannedForm.vendor || req.preferredVendor || 'Unassigned'}
                    </span>
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700">
                      DRAFT
                    </span>
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Draft PO · Vendor payment splits in Draft controls; Treasury advance type below if used.
                  </p>
                </div>
                <button type="button" onClick={() => setReleaseToPlannedTarget(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">Close</button>
              </div>
              <div className="flex-1 overflow-auto p-3 sm:p-5 space-y-5">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm w-full">
                  <h3 className="font-bold text-slate-900 text-sm mb-1">PO lines</h3>
                  <p className="text-xs text-slate-500 mb-3">Quantities and rates from the request; adjust pricing via vendor and MOQ slab below.</p>
                  <div className="border-t border-slate-200 my-3" />
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200">
                          <th className="text-left py-2 pr-3 font-medium">Item</th>
                          <th className="text-right py-2 font-medium whitespace-nowrap">MOQ</th>
                          <th className="text-right py-2 font-medium whitespace-nowrap">Qty</th>
                          <th className="text-right py-2 font-medium whitespace-nowrap">Unit</th>
                          <th className="text-right py-2 font-medium whitespace-nowrap">Unit ₹</th>
                          <th className="text-right py-2 font-medium whitespace-nowrap">Line ₹</th>
                          <th className="text-right py-2 font-medium whitespace-nowrap">Lead</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItemsForModal.map((ln, i) => (
                          <tr key={`${ln.itemCode}-${i}`} className="border-b border-slate-100">
                            <td className="py-2 pr-2 align-top">
                              <div className="font-medium text-slate-900 leading-5 break-words">{ln.itemName}</div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">{ln.itemCode}</div>
                            </td>
                            <td className="py-2 text-right text-slate-800 whitespace-nowrap align-top tabular-nums">
                              {ln.moq != null && Number(ln.moq) > 0 ? Number(ln.moq).toLocaleString('en-IN') : '—'}
                            </td>
                            <td className="py-2 text-right text-slate-900 font-medium whitespace-nowrap align-top tabular-nums">
                              {Number(ln.qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 text-right text-slate-700 whitespace-nowrap align-top">{ln.unit}</td>
                            <td className="py-2 text-right text-slate-900 whitespace-nowrap align-top tabular-nums">
                              ₹{Number(ln.unitPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 text-right font-medium whitespace-nowrap align-top tabular-nums">
                              ₹{((ln.qty * ln.unitPrice) * 1.18).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 text-right text-slate-700 whitespace-nowrap align-top">{ln.leadDays}d</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {lineItemsForModal.length === 0 && <p className="text-xs text-slate-500 py-3">No request line items found.</p>}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 w-full">
                  <h3 className="font-bold text-slate-900 text-sm">Draft controls</h3>
                  <p className="text-xs text-slate-500">Select vendor and MOQ slab to apply Items List rates; payment terms apply to the draft PO.</p>
                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Vendor payment terms</span>
                      <PaymentTermsDisplay value={releaseModalVendorTerms} />
                    </div>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-slate-500">Subtotal (ex GST)</span>
                      <span className="text-slate-900 font-medium tabular-nums">
                        ₹{releaseModalSubtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-slate-500">GST (18%)</span>
                      <span className="text-slate-800 font-medium tabular-nums">
                        ₹{releaseModalGstTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100 pt-2">
                      <span className="text-slate-600 font-semibold">Total (incl. GST)</span>
                      <span className="text-slate-900 font-bold tabular-nums">
                        ₹{releaseModalGrand.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 my-3" />
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Vendor</label>
                        <select
                          value={releaseToPlannedForm.vendor}
                          onChange={(e) => {
                            const vendorName = e.target.value;
                            setReleaseToPlannedForm((f) => ({ ...f, vendor: vendorName }));
                            if (!vendorName) return;
                            setReleaseToPlannedLineEdits((prev) => prev.map((ln) => {
                              const source = ln.type === 'PM' ? itemsListPm : itemsListRm;
                              const row = source.find((r) => {
                                const c0 = String(ln.itemCode ?? '').trim().toLowerCase();
                                const n0 = String(ln.itemName ?? '').trim().toLowerCase();
                                const rc0 = String(r.code ?? '').trim().toLowerCase();
                                const rn0 = String(r.name ?? '').trim().toLowerCase();
                                const rmA = ln.raw_material_id != null ? Number(ln.raw_material_id) : NaN;
                                const pmA = ln.pack_material_id != null ? Number(ln.pack_material_id) : NaN;
                                const rmB = r.raw_material_id != null ? Number(r.raw_material_id) : NaN;
                                const pmB = r.pack_material_id != null ? Number(r.pack_material_id) : NaN;
                                if (Number.isFinite(rmA) && rmA > 0 && Number.isFinite(rmB) && rmB > 0) return rmA === rmB;
                                if (Number.isFinite(pmA) && pmA > 0 && Number.isFinite(pmB) && pmB > 0) return pmA === pmB;
                                if (c0 && rc0 && c0 === rc0) return true;
                                if (n0 && rn0 && (n0 === rn0 || n0.includes(rn0) || rn0.includes(n0))) return true;
                                return false;
                              });
                              const vr = (row?.vendorRates ?? []).find((x) => String(x.vendor_name ?? '').trim().toLowerCase() === vendorName.trim().toLowerCase());
                              if (!vr) return ln;
                              const tier0 = (vr.tiers ?? [])[0];
                              return {
                                ...ln,
                                moq: Number(tier0?.moq_min ?? ln.moq) || ln.moq,
                                unitPrice: Number(tier0?.price_per_unit ?? ln.unitPrice) || ln.unitPrice,
                                leadDays: Number(vr.lead_time_days ?? ln.leadDays) || ln.leadDays,
                              };
                            }));
                          }}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">— Select —</option>
                          {uniqueVendors.map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">MOQ slab</label>
                        <select
                          value={releaseToPlannedForm.moqDisplay}
                          onChange={(e) => {
                            const opt = e.target.value;
                            setReleaseToPlannedForm((f) => {
                              const slab = vendorSlabs.find(
                                (s) =>
                                  s.vendor === f.vendor &&
                                  `${s.moq} (₹${s.unitPrice} · ${s.leadDays}d)` === opt
                              );
                              const next = { ...f, moqDisplay: opt };
                              if (slab?.terms) {
                                const p = parsePaymentTermsString(slab.terms);
                                next.paymentTermsType = p.type;
                                next.advancePercent = String(
                                  p.advancePercent ||
                                  (paymentTermsTypeRequiresAdvancePercent(p.type) ? 50 : 0)
                                );
                              }
                              if (slab) {
                                next.leadTimeDays = slab.leadDays;
                                setReleaseToPlannedLineEdits((prev) =>
                                  prev.map((ln) => ({
                                    ...ln,
                                    moq: slab.moq,
                                    unitPrice: slab.unitPrice,
                                    leadDays: slab.leadDays,
                                  }))
                                );
                              }
                              return next;
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">— Select slab —</option>
                          {vendorSlabs.filter((s) => s.vendor === releaseToPlannedForm.vendor).map((s, i) => {
                            const opt = `${s.moq} (₹${s.unitPrice} · ${s.leadDays}d)`;
                            return <option key={i} value={opt}>{opt}</option>;
                          })}
                          {releaseToPlannedForm.moqDisplay && !vendorSlabs.some((s) => `${s.moq} (₹${s.unitPrice} · ${s.leadDays}d)` === releaseToPlannedForm.moqDisplay) && (
                            <option value={releaseToPlannedForm.moqDisplay}>{releaseToPlannedForm.moqDisplay}</option>
                          )}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Payment terms (type)</label>
                        <select
                          value={releaseToPlannedForm.paymentTermsType}
                          onChange={(e) =>
                            setReleaseToPlannedForm((f) => ({
                              ...f,
                              paymentTermsType: e.target.value as PaymentTermsStructuredType,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          {PAYMENT_TERMS_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">Advance % drives Treasury on draft release.</p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Lead time (max line)</label>
                        <div className="py-1.5 text-sm font-medium text-slate-800">
                          {(lineItemsForModal.length
                            ? Math.max(...lineItemsForModal.map((ln) => Number(ln.leadDays) || 0))
                            : 0)} days
                        </div>
                      </div>
                    </div>
                    {paymentTermsTypeRequiresAdvancePercent(releaseToPlannedForm.paymentTermsType) && (
                      <div className="mb-3">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Advance %</label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={releaseToPlannedForm.advancePercent}
                          onChange={(e) => setReleaseToPlannedForm((f) => ({ ...f, advancePercent: e.target.value }))}
                          className="w-full max-w-xs rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    )}
                    <div className="border-t border-slate-200 my-3" />
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                      <h3 className="font-bold text-slate-900 text-sm mb-2">Notes</h3>
                      <textarea
                        value={releaseToPlannedNotes}
                        onChange={(e) => setReleaseToPlannedNotes(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        placeholder="Add draft notes..."
                      />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm mb-2">Previous purchases</h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200">
                          <th className="text-left py-1 font-medium">Date</th>
                          <th className="text-left py-1 font-medium">Vendor</th>
                          <th className="text-right py-1 font-medium">Qty</th>
                          <th className="text-right py-1 font-medium">Unit ₹</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previousPurchases.map((r, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="py-1.5 text-slate-700">{r.date ? new Date(r.date + 'Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                            <td className="py-1.5 text-slate-700">{r.vendor}</td>
                            <td className="py-1.5 text-right text-slate-700">{r.qty} <span className="text-slate-500">{r.unit}</span></td>
                            <td className="py-1.5 text-right font-medium">₹{r.unitPrice.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                        {previousPurchases.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-slate-500 text-xs">No previous purchases for this item.</td></tr>}
                      </tbody>
                    </table>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-xs text-slate-500">Release triggers treasury if advance terms are selected.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setReleaseToPlannedTarget(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">Cancel</button>
                  <button
                    type="button"
                    onClick={async () => {
                      const linesForCreate = lineItemsForModal.filter(
                        (ln) => (Number(ln.qty) || 0) > 0 && (Number(ln.unitPrice) || 0) > 0
                      );
                      if (!releaseToPlannedForm.vendor || linesForCreate.length === 0) {
                        addToast('warning', 'Select vendor and ensure lines have quantity and unit price from Items List or slab.');
                        return;
                      }

                      const advErr = validateAdvancePercentForType(
                        releaseToPlannedForm.paymentTermsType,
                        Number(releaseToPlannedForm.advancePercent)
                      );
                      if (advErr) {
                        addToast('warning', advErr);
                        return;
                      }

                      const composedReleasePaymentTerms = formatPaymentTermsString(
                        releaseToPlannedForm.paymentTermsType,
                        Number(releaseToPlannedForm.advancePercent)
                      );

                      const today = new Date();
                      const expectedDelivery = new Date(today);
                      const maxLeadDays = Math.max(0, ...linesForCreate.map((ln) => Number(ln.leadDays ?? 0) || 0));
                      expectedDelivery.setDate(expectedDelivery.getDate() + maxLeadDays);
                      const createdDateStr = today.toISOString().split('T')[0];
                      const expectedDeliveryStr = expectedDelivery.toISOString().split('T')[0];

                      const newDpoId = nextSequentialDpoOrderId(purchaseOrders, draftPOs);
                      const gstPercent = 18;
                      const draftLines: DraftPOLineItem[] = linesForCreate.map((ln) => {
                        const sub = (Number(ln.qty) || 0) * (Number(ln.unitPrice) || 0);
                        const gst = parseFloat((sub * (gstPercent / 100)).toFixed(2));
                        const total = parseFloat((sub + gst).toFixed(2));
                        return {
                          item: ln.itemName ?? '',
                          itemCode: ln.itemCode || (ln.type === 'PM' ? 'EI-PM-001' : 'EI-RM-001'),
                          type: ln.type,
                          qty: String(ln.qty),
                          leadTimeDays: Number(ln.leadDays ?? 0) || 0,
                          pricePerUnit: Number(ln.unitPrice) || 0,
                          gstPercent,
                          gstAmount: gst,
                          lineTotal: total,
                        };
                      });
                      const subtotal = draftLines.reduce((acc, ln) => acc + ((Number(ln.qty) || 0) * (Number(ln.pricePerUnit) || 0)), 0);
                      const gstAmount = draftLines.reduce((acc, ln) => acc + (Number(ln.gstAmount) || 0), 0);
                      const lineTotal = draftLines.reduce((acc, ln) => acc + (Number(ln.lineTotal) || 0), 0);

                      const vendorName = releaseToPlannedForm.vendor || req.preferredVendor || 'Unassigned';
                      const matchedVendorForZoho = vendors.find(
                        (v) => (v.name || '').trim().toLowerCase() === vendorName.trim().toLowerCase()
                      );
                      const vendorMasterPaymentTermsForPo = String(
                        matchedVendorForZoho?.paymentTerms ?? '',
                      ).trim();

                      const poPayload = {
                        orderId: newDpoId,
                        vendorName,
                        orderDate: createdDateStr,
                        expectedShipmentDate: expectedDeliveryStr,
                        reference: req.code,
                        paymentTerms: vendorMasterPaymentTermsForPo || composedReleasePaymentTerms || undefined,
                        status: 'Draft',
                        formData: {
                          requestId: req.id,
                          requestCode: req.code,
                          draftNotes: releaseToPlannedNotes.trim() || undefined,
                          ...(matchedVendorForZoho && vendorName.trim() && vendorName !== 'Unassigned'
                            ? {
                              vendorClientId: matchedVendorForZoho.id,
                              vendorEntityCode: matchedVendorForZoho.vendorCode,
                            }
                            : {}),
                        },
                        items: linesForCreate.map((ln, idx) => ({
                          itemName: ln.itemName,
                          itemCode: ln.itemCode || `EI-${ln.type}-${String(idx + 1).padStart(3, '0')}`,
                          quantity: String(ln.qty),
                          rate: String(ln.unitPrice),
                          tax: '18',
                          ...(ln.raw_material_id != null ? { raw_material_id: Number(ln.raw_material_id) } : {}),
                          ...(ln.pack_material_id != null ? { pack_material_id: Number(ln.pack_material_id) } : {}),
                        })),
                      };

                      const createResult = await createPurchaseOrder(poPayload);
                      if (!createResult.success || !createResult.data) {
                        addToast(
                          'error',
                          typeof createResult.error === 'string'
                            ? createResult.error
                            : (createResult.error as any)?.message ??
                            'Failed to create purchase order'
                        );
                        return;
                      }

                      const backendId =
                        String(createResult.data.id ?? '').replace(/^PO-/, '') ||
                        String(createResult.data.id);

                      const newDraftPO: DraftPO = {
                        id: newDpoId,
                        dpoNumber: newDpoId,
                        requestId: req.id,
                        requestCode: req.code,
                        type: req.type,
                        vendor: vendorName,
                        vendorId: `VND-${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
                        status: 'Pending Approval',
                        createdDate: createdDateStr,
                        createdBy: 'Procurement — Admin',
                        paymentTerms: vendorMasterPaymentTermsForPo || composedReleasePaymentTerms || 'As per contract',
                        expectedDelivery: expectedDeliveryStr,
                        deliveryAddress: 'EI Plant 1, IDA Jeedimetla, Hyderabad - 500 055',
                        vendorRating: 0,
                        alertMessage: `${releaseToPlannedNotes.trim() ? `${releaseToPlannedNotes.trim()} ` : ''}Draft PO created from planned line for ${itemName ?? ''}. Awaiting approval to proceed.`,
                        alertType: 'warning',
                        lineItems: draftLines,
                        subtotal,
                        gstTotal: gstAmount,
                        grandTotal: lineTotal,
                        backendPoId: backendId,
                      };

                      await updateRequestStatus(req.id, 'PO Draft', {
                        skipItems: true,
                      });

                      updateProcurementState((current) => ({
                        draftPOs: [newDraftPO, ...current.draftPOs],
                      }));

                      void invalidatePurchaseOrdersQueries();
                      addToast(
                        'success',
                        `Draft PO ${newDpoId} created for ${req.code}`
                      );
                      setReleaseToPlannedNotes('');
                      setReleaseToPlannedTarget(null);
                      setTimeout(() => {
                        applyRouteState('Procurement', 'Draft POs');
                      }, 500);
                    }}
                    className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600"
                  >
                    Release Draft
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Edit Draft PO Modal ── */}
      {editDraftPOTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4" onClick={() => setEditDraftPOTarget(null)}>
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
                  onChange={(e) => {
                    const name = e.target.value;
                    const matched = vendors.find((v) => v.name === name);
                    const fromMaster = String(matched?.paymentTerms ?? '').trim();
                    setEditDraftPOForm((f) => ({
                      ...f,
                      vendor: name,
                      paymentTerms: fromMaster || f.paymentTerms,
                    }));
                  }}
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
                <p className="text-[11px] text-slate-500 mb-2">From vendor master (edit in Masters → Vendors).</p>
                <PaymentTermsDisplay value={editDraftPOForm.paymentTerms} />
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
                      <span className="text-xs text-slate-500 min-w-[70px]">
                        Lead: {line.leadTimeDays != null ? `${line.leadTimeDays}d` : '—'}
                      </span>
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
                      items: form.lineItems.map((l) => ({
                        itemName: l.item,
                        itemCode: l.itemCode,
                        quantity: l.qty,
                        rate: String(l.pricePerUnit),
                        tax: String(l.gstPercent ?? 18),
                      })),
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
                  void invalidatePurchaseOrdersQueries();
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

      {/* ── Stock Check Modal (inventory from warehouse-inventory API) ── */}
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

        const whRows = warehouseInventoryData?.rows ?? [];
        const whByCode = new Map<string, { zone: string; rack: string; stockInHand: number; whUnit: string; status?: string }>();
        const whByName = new Map<string, { zone: string; rack: string; stockInHand: number; whUnit: string; status?: string }>();
        whRows.forEach((row) => {
          const code = (row.code ?? '').trim();
          const name = (row.name ?? '').trim();
          if (code) whByCode.set(code.toLowerCase(), { zone: row.zone ?? '—', rack: row.rack ?? '—', stockInHand: row.stockInHand ?? 0, whUnit: row.whUnit ?? '', status: row.status });
          if (name) whByName.set(name.toLowerCase(), { zone: row.zone ?? '—', rack: row.rack ?? '—', stockInHand: row.stockInHand ?? 0, whUnit: row.whUnit ?? '', status: row.status });
        });

        const resolveWh = (itemCode: string, itemName: string) =>
          whByCode.get((itemCode ?? '').trim().toLowerCase()) ??
          whByName.get((itemName ?? '').trim().toLowerCase()) ??
          null;

        const stockItems = req.itemDetails && req.itemDetails.length > 0
          ? req.itemDetails.map((item, _idx) => {
            const wh = resolveWh(item.itemCode, item.itemName);
            const override = item.itemCode ? updatesForRequest[item.itemCode] : undefined;
            return {
              itemName: item.itemName,
              itemCode: item.itemCode,
              requestedQty: item.reqQty,
              systemQty: wh ? wh.stockInHand : null,
              whUnit: wh?.whUnit ?? '',
              physicalQty: override?.physicalQty ?? (wh ? wh.stockInHand : null),
              zoneRack: wh ? `${wh.zone} · ${wh.rack}` : (override ? `${override.zone ?? '—'} · ${override.rack ?? '—'}` : '—'),
              batchCode: override?.batchNo ?? (wh ? null : '—'),
              fromWarehouse: !!wh,
            };
          })
          : req.items.map((itemName, idx) => {
            const itemCode = `EI-${req.type}-${itemName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || String(idx + 1).padStart(3, '0')}`;
            const wh = resolveWh(itemCode, itemName);
            const override = updatesForRequest[itemCode];
            const reqQty = req.quantities?.[idx] ?? 0;
            return {
              itemName,
              itemCode,
              requestedQty: reqQty,
              systemQty: wh ? wh.stockInHand : null,
              whUnit: wh?.whUnit ?? '',
              physicalQty: override?.physicalQty ?? (wh ? wh.stockInHand : null),
              zoneRack: wh ? `${wh.zone} · ${wh.rack}` : (override ? `${override.zone ?? '—'} · ${override.rack ?? '—'}` : '—'),
              batchCode: override?.batchNo ?? (wh ? null : '—'),
              fromWarehouse: !!wh,
            };
          });
        const displayStockItems = selectedStockCheckItemName
          ? stockItems.filter(item => item.itemName === selectedStockCheckItemName)
          : stockItems;
        const hasFocusedItem = displayStockItems.length > 0;
        const renderedItems = hasFocusedItem ? displayStockItems : stockItems;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setSelectedStockCheckRequest(null);
              setSelectedStockCheckItemName(null);
            }}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
            <div
              className="relative w-full max-w-xl max-h-[90vh] bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 border-b border-slate-200 px-5 py-4 bg-slate-50">
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

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
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

                {warehouseInventoryLoading ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500 text-sm">
                    Loading warehouse inventory…
                  </div>
                ) : (
                  <>
                    {renderedItems.map((item, idx) => (
                      <div
                        key={`${item.itemCode}-${idx}`}
                        className="rounded-lg border border-slate-200 bg-white overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                          <div className="flex items-center gap-2">
                            <p className="text-slate-900 font-semibold text-sm">{item.itemName}</p>
                            <span className="text-[10px] text-slate-500 font-mono">{item.itemCode}</span>
                            {!item.fromWarehouse && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">No warehouse match</span>
                            )}
                          </div>
                        </div>
                        <div className="px-4 py-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Zone / Rack</span>
                            <span className="text-slate-900 font-semibold">{item.zoneRack}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Requested Qty</span>
                            <span className="text-slate-800 font-semibold">{item.requestedQty ?? '—'} {item.whUnit || ''}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Stock in hand (from DB)</span>
                            <span className="text-emerald-700 font-bold">
                              {item.systemQty != null ? `${item.systemQty} ${item.whUnit || ''}` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Physical Qty (count)</span>
                            <span className="text-sky-700 font-bold">
                              {item.physicalQty != null ? `${item.physicalQty} ${item.whUnit || ''}` : '—'}
                            </span>
                          </div>
                          {item.batchCode && (
                            <div className="pt-2 border-t border-slate-200 mt-2">
                              <p className="text-[10px] tracking-wide text-slate-500 uppercase mb-1">Batch</p>
                              <span className="text-xs font-mono text-slate-700">{item.batchCode}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      Stock in hand is read from warehouse inventory. Match is by item code or name.
                    </div>
                  </>
                )}
              </div>

              <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-end">
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

      {showRecordQuoteModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Record Vendor Quotation</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Add vendor, items and prices. A quotation is independent of PRs; it gets linked to a PR when you create a Draft PO from it. Per-item vendor history is shown in each PR popup (Requests).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordQuoteModal(false)}
                className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center justify-between">
                <span>Quote lines</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextIndex = recordQuoteLines.length > 0 ? Math.max(...recordQuoteLines.map((l) => l.index)) + 1 : 0;
                    setRecordQuoteLines((prev) => [
                      ...prev,
                      {
                        index: nextIndex,
                        itemId: '',
                        name: '',
                        uom: 'KG',
                        orderQty: '0',
                        pricePerUnit: '0',
                        totalValue: 0,
                        raw_material_id: null,
                        pack_material_id: null,
                        itemType: undefined,
                      },
                    ]);
                  }}
                  className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                >
                  + Add line
                </button>
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 flex text-[11px] font-semibold text-slate-600">
                  <div className="flex-1 min-w-[200px]">ITEM (RM/PM from masters)</div>
                  <div className="w-24 text-right">QTY</div>
                  <div className="w-28 text-right">PRICE / UNIT</div>
                  <div className="w-16" />
                </div>
                <div className="max-h-64 overflow-auto divide-y divide-slate-100">
                  {recordQuoteLines.map((line, idx) => {
                    const lineItemValue =
                      line.raw_material_id != null
                        ? `rm-${line.raw_material_id}`
                        : line.pack_material_id != null
                          ? `pm-${line.pack_material_id}`
                          : '';
                    return (
                      <div key={line.index} className="px-4 py-2 flex items-center text-xs gap-2">
                        <div className="flex-1 min-w-0">
                          <select
                            value={lineItemValue}
                            onChange={(e) => handleRecordQuoteLineSelectItem(idx, e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-800 bg-white"
                          >
                            <option value="">— Select RM or PM —</option>
                            <optgroup label="Raw materials">
                              {(rawMaterialsListForQuote as RawMaterialRecord[]).map((r) => (
                                <option key={`rm-${r.id}`} value={`rm-${r.id}`}>
                                  {r.code} — {r.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Pack materials">
                              {(packMaterialsListForQuote as PackMaterialRecord[]).map((p) => (
                                <option key={`pm-${p.id}`} value={`pm-${p.id}`}>
                                  {p.code} — {p.description || p.code}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                          {line.name && (
                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                              {line.itemId && `${line.itemId} · `}{line.name} ({line.uom})
                            </p>
                          )}
                        </div>
                        <div className="w-24 text-right pl-1">
                          <input
                            type="text"
                            value={line.orderQty}
                            onChange={handleRecordQuoteLineChange(idx, 'orderQty')}
                            className="w-full border border-slate-300 rounded px-1 py-0.5 text-right"
                          />
                        </div>
                        <div className="w-28 text-right pl-1">
                          <input
                            type="text"
                            value={line.pricePerUnit}
                            onChange={handleRecordQuoteLineChange(idx, 'pricePerUnit')}
                            className="w-full border border-slate-300 rounded px-1 py-0.5 text-right"
                          />
                        </div>
                        <div className="w-16 shrink-0">
                          <button
                            type="button"
                            onClick={() => setRecordQuoteLines((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-red-600 text-sm"
                            title="Remove line"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {recordQuoteLines.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-slate-500">
                      Click &quot;+ Add line&quot; then select an item from Raw materials or Pack materials.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-sm">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Vendor</label>
              <select
                value={recordQuoteForm.vendorId}
                onChange={(e) => {
                  setRecordQuoteForm((f) => ({ ...f, vendorId: e.target.value }));
                }}
                className="w-full max-w-md border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">Enter item names and prices from the vendor’s quote.</p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Quote Date</label>
                <input
                  type="date"
                  value={recordQuoteForm.quoteDate}
                  onChange={(e) => setRecordQuoteForm((f) => ({ ...f, quoteDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Valid Till</label>
                <input
                  type="date"
                  value={recordQuoteForm.validTill}
                  onChange={(e) => setRecordQuoteForm((f) => ({ ...f, validTill: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Lead Time (days)</label>
                <input
                  type="number"
                  min={0}
                  value={recordQuoteForm.leadTimeDays}
                  onChange={(e) => setRecordQuoteForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="text-sm">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Payment terms (from vendor master)</label>
              <p className="text-[11px] text-slate-500 mb-2">
                The three-way split (advance, before dispatch / pre-shipment, after delivery / post-shipment) comes from the vendor record. Update it in Masters → Vendors if needed.
              </p>
              <PaymentTermsDisplay
                value={vendors.find((x) => String(x.id) === String(recordQuoteForm.vendorId))?.paymentTerms ?? ''}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Internal Notes</label>
              <textarea
                value={recordQuoteForm.notes}
                onChange={(e) => setRecordQuoteForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                rows={2}
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <p className="text-[11px] text-slate-500">
                New quotes are saved with default status for internal tracking.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecordQuoteModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const vendorId = parseInt(recordQuoteForm.vendorId, 10);
                    if (!vendorId || Number.isNaN(vendorId)) {
                      addToast('error', 'Select a vendor');
                      return;
                    }
                    if (!recordQuoteLines.length) {
                      addToast('error', 'Add at least one line.');
                      return;
                    }
                    const missingItem = recordQuoteLines.some((l) => l.raw_material_id == null && l.pack_material_id == null);
                    if (missingItem) {
                      addToast('error', 'Select an item (RM or PM) from the dropdown for each line.');
                      return;
                    }

                    const selectedVendorProc = vendors.find((x) => String(x.id) === String(recordQuoteForm.vendorId));
                    const composedPaymentTerms = selectedVendorProc?.paymentTerms?.trim() || 'As per contract';

                    // Save into Items List (single source of truth for vendor pricing).
                    const loadPage = async (type: 'RM' | 'PM') => {
                      const res = await fetchPriceListPage(type);
                      return res.success ? (res.data ?? []) : [];
                    };
                    let rmPage = await loadPage('RM');
                    let pmPage = await loadPage('PM');

                    const getOrCreateItemsListId = async (line: { raw_material_id?: number | null; pack_material_id?: number | null }) => {
                      const isRm = line.raw_material_id != null;
                      const type = isRm ? 'RM' : 'PM';
                      const idToMatch = isRm ? Number(line.raw_material_id) : Number(line.pack_material_id);
                      const page = isRm ? rmPage : pmPage;
                      const match = isRm
                        ? page.find((p) => Number(p.raw_material_id) === idToMatch)
                        : page.find((p) => Number(p.pack_material_id) === idToMatch);
                      const existingId = Number(match?.itemsListId ?? 0) || 0;
                      if (existingId > 0) return { itemsListId: existingId, pageRow: match ?? null };

                      // Not present in items_list yet → create it.
                      const createRes = await createItemList({
                        type,
                        raw_material_id: isRm ? (line.raw_material_id ?? null) : null,
                        pack_material_id: !isRm ? (line.pack_material_id ?? null) : null,
                        status: 'Active',
                      });
                      // 409 Conflict is expected when seeded already exists; proceed in all cases by reloading.
                      if (!createRes.success) {
                        const msg =
                          typeof createRes.error === 'string'
                            ? createRes.error
                            : (createRes.error as any)?.message ?? '';
                        const lowered = String(msg).toLowerCase();
                        if (msg && !lowered.includes('already') && !lowered.includes('conflict') && !lowered.includes('409')) {
                          addToast('error', msg || 'Failed to create Items List entry');
                          return { itemsListId: 0, pageRow: null };
                        }
                      }

                      // Reload the page list and find again.
                      if (type === 'RM') rmPage = await loadPage('RM');
                      else pmPage = await loadPage('PM');
                      const page2 = type === 'RM' ? rmPage : pmPage;
                      const match2 =
                        type === 'RM'
                          ? page2.find((p) => Number(p.raw_material_id) === idToMatch)
                          : page2.find((p) => Number(p.pack_material_id) === idToMatch);
                      const createdId = Number(match2?.itemsListId ?? 0) || 0;
                      return { itemsListId: createdId, pageRow: match2 ?? null };
                    };

                    for (const l of recordQuoteLines) {
                      const qty = parseFloat(String(l.orderQty).replace(/[^\d.]/g, '')) || 0;
                      const price = parseFloat(String(l.pricePerUnit).replace(/[^\d.]/g, '')) || 0;
                      if (qty <= 0 || price <= 0) continue;

                      const { itemsListId, pageRow } = await getOrCreateItemsListId(l);
                      if (itemsListId <= 0 || !pageRow) {
                        addToast('error', 'Failed to resolve Items List entry for one of the lines.');
                        return;
                      }

                      const existingRate = (pageRow.vendorRates ?? []).find((r) => Number(r.vendor_id) === Number(vendorId)) ?? null;
                      let rateId = Number(existingRate?.id ?? 0) || 0;
                      if (rateId <= 0) {
                        const resRate = await createItemListRate(String(itemsListId), {
                          vendor_id: vendorId,
                          default_rate: price,
                          default_moq: qty,
                          currency: 'INR',
                          payment_terms: composedPaymentTerms || null,
                          lead_time_days: recordQuoteForm.leadTimeDays ? Number(recordQuoteForm.leadTimeDays) : null,
                        });
                        if (!resRate.success || !resRate.data) {
                          addToast('error', 'Failed to create vendor rate in Items List.');
                          return;
                        }
                        rateId = Number(resRate.data.id) || 0;
                        // Reload to get updated tiers/rates for subsequent matching.
                        if (l.raw_material_id != null) rmPage = await loadPage('RM');
                        else pmPage = await loadPage('PM');
                      } else {
                        await updateItemListRate(String(itemsListId), rateId, {
                          default_rate: price,
                          default_moq: qty,
                          payment_terms: composedPaymentTerms || null,
                          lead_time_days: recordQuoteForm.leadTimeDays ? Number(recordQuoteForm.leadTimeDays) : null,
                        });
                      }

                      // Create tier row for this MOQ (or update if same MOQ already exists).
                      const existingTier = (existingRate?.tiers ?? []).find((t) => Number(t.moq_min) === Number(qty)) ?? null;
                      if (existingTier) {
                        await updateItemListTier(String(itemsListId), rateId, existingTier.id, {
                          price_per_unit: price,
                          moq_max: existingTier.moq_max ?? null,
                          note: 'Recorded from Procurement → Quotations',
                        });
                      } else {
                        const resTier = await createItemListTier(String(itemsListId), rateId, {
                          moq_min: qty,
                          moq_max: null,
                          price_per_unit: price,
                          valid_till: recordQuoteForm.validTill || null,
                          note: 'Recorded from Procurement → Quotations',
                        });
                        if (!resTier.success) {
                          addToast('error', 'Failed to create tier in Items List.');
                          return;
                        }
                      }
                    }

                    await queryClient.invalidateQueries({ queryKey: ['items-list-page', 'RM'] });
                    await queryClient.invalidateQueries({ queryKey: ['items-list-page', 'PM'] });
                    addToast('success', 'Saved vendor price list (Items List).');
                    setShowRecordQuoteModal(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600"
                >
                  Save Quote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreatePoFromQuoteModal && createPoFromQuoteState && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl p-6 space-y-4">
            {(() => {
              const selectedQuote = quotes.find((q) => q.id === createPoFromQuoteState.quoteId);
              const backendPr =
                backendPrArray.find((p: { id: string }) => String(p.id) === createPoFromQuoteState.requestId) ??
                null;
              const prItems: BackendPRItem[] = Array.isArray((backendPr as any)?.items)
                ? ((backendPr as any).items as BackendPRItem[])
                : [];
              const matchingItems = prItems.filter((it) => {
                const name = (it.name ?? '').trim().toLowerCase();
                const code = (it.code ?? '').trim().toLowerCase();
                return selectedQuote?.lines.some((l) => {
                  const q = (l.item ?? '').trim().toLowerCase();
                  if (!q) return false;
                  return q === name || q === code || (name && name.includes(q)) || (q && name.includes(q)) || (code && q.includes(code));
                });
              });

              const selectedItem =
                matchingItems.find(
                  (it) =>
                    it.code === createPoFromQuoteState.itemKey ||
                    it.name === createPoFromQuoteState.itemKey
                ) ?? matchingItems[0];
              const prName = (selectedItem?.name ?? '').trim().toLowerCase();
              const prCode = (selectedItem?.code ?? '').trim().toLowerCase();
              const selectedLine =
                selectedQuote?.lines.find((l) => {
                  const q = (l.item ?? '').trim().toLowerCase();
                  if (!q) return false;
                  return q === prName || q === prCode || (prName && prName.includes(q)) || (q && prName.includes(q)) || (prCode && q.includes(prCode));
                }) ?? selectedQuote?.lines?.[0] ?? null;

              const qtyNeeded = selectedItem ? Number(selectedItem.quantity_requested) || 0 : 0;
              const unit = selectedItem?.unit ?? 'KG';
              const pricePerUnit = selectedLine?.pricePerUnit ?? 0;
              const subtotal = qtyNeeded * pricePerUnit;
              const gstPercent = 18;
              const gstAmount = parseFloat((subtotal * (gstPercent / 100)).toFixed(2));
              const lineTotal = parseFloat((subtotal + gstAmount).toFixed(2));

              return (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Create Draft PO from Quote</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Pick the procurement request item this quotation is for. One draft PO will be created per
                        item/vendor.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreatePoFromQuoteModal(false)}
                      className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      Close
                    </button>
                  </div>

                  {!selectedQuote ? (
                    <p className="text-sm text-rose-600">
                      Unable to load quote. Please refresh the page and try again.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">
                            Procurement Request (link PO to)
                          </label>
                          <select
                            value={createPoFromQuoteState.requestId}
                            onChange={(e) =>
                              setCreatePoFromQuoteState((prev) =>
                                prev ? { ...prev, requestId: e.target.value, itemKey: undefined } : prev
                              )
                            }
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                          >
                            {requests.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.code} · {r.items?.slice(0, 2).join(', ')}{r.items?.length > 2 ? '…' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Vendor</label>
                          <p className="text-sm font-medium text-slate-900">
                            {selectedQuote.vendor} <span className="text-xs text-slate-500">(from quotation)</span>
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Item</label>
                        <select
                          value={createPoFromQuoteState.itemKey ?? (selectedItem?.code ?? selectedItem?.name ?? '')}
                          onChange={(e) =>
                            setCreatePoFromQuoteState((prev) =>
                              prev ? { ...prev, itemKey: e.target.value } : prev
                            )
                          }
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                        >
                          {matchingItems.map((it) => (
                            <option key={it.code ?? it.name} value={it.code ?? it.name}>
                              {(it.code ?? '') && (it.name ?? '')
                                ? `${it.code} — ${it.name}`
                                : it.code ?? it.name ?? ''}
                            </option>
                          ))}
                        </select>
                        {!matchingItems.length && (
                          <p className="mt-1 text-[11px] text-rose-600">
                            No items on this request match the lines in this quotation.
                          </p>
                        )}
                      </div>

                      {selectedItem && selectedLine && (
                        <div className="mt-2 border border-slate-200 rounded-xl p-4 text-sm bg-slate-50">
                          <p className="text-xs font-semibold text-slate-500 mb-2">Calculation</p>
                          <p className="text-sm text-slate-800">
                            <span className="font-medium">
                              {selectedItem.name ?? selectedItem.code ?? 'Item'}
                            </span>{' '}
                            — Required Qty from PR:{' '}
                            <span className="font-mono font-semibold">
                              {qtyNeeded} {unit}
                            </span>
                          </p>
                          <p className="text-sm text-slate-800">
                            Vendor price from quotation:{' '}
                            <span className="font-mono font-semibold">
                              ₹{pricePerUnit.toLocaleString('en-IN', { maximumFractionDigits: 2 })} / {unit}
                            </span>
                          </p>
                          <p className="mt-2 text-sm text-slate-900">
                            Line subtotal:{' '}
                            <span className="font-mono font-semibold">
                              ₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>{' '}
                            + GST {gstPercent}% ={' '}
                            <span className="font-mono font-semibold">
                              ₹{lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                          </p>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2">
                        <p className="text-[11px] text-slate-500">
                          One Draft PO will be created for this item and vendor. You can edit or split it later from the
                          Draft POs tab.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowCreatePoFromQuoteModal(false)}
                            className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!matchingItems.length || !selectedItem || !selectedLine}
                            onClick={async () => {
                              if (!selectedQuote || !backendPr || !selectedItem || !selectedLine) return;

                              const today = new Date();
                              const expectedDelivery = new Date(today);
                              expectedDelivery.setDate(
                                expectedDelivery.getDate() + (selectedQuote.leadTimeDays || 0)
                              );
                              const createdDateStr = today.toISOString().split('T')[0];
                              const expectedDeliveryStr = expectedDelivery.toISOString().split('T')[0];

                              const newDpoId = nextSequentialDpoOrderId(purchaseOrders, draftPOs);
                              const fallbackItemCode =
                                selectedQuote.requestType === 'PM' ? `EI-PM-001` : `EI-RM-001`;
                              const lineItem: DraftPOLineItem = {
                                item: selectedItem.name ?? selectedItem.code ?? 'Item',
                                itemCode: (selectedItem.code && String(selectedItem.code).trim()) || fallbackItemCode,
                                type: selectedQuote.requestType,
                                qty: String(qtyNeeded),
                                pricePerUnit,
                                gstPercent,
                                gstAmount,
                                lineTotal,
                              };

                              const vendorName =
                                (backendPr as any).preferredVendor?.trim() || selectedQuote.vendor;
                              const matchedVendorForZoho = vendors.find(
                                (v) => (v.name || '').trim().toLowerCase() === String(vendorName).trim().toLowerCase()
                              );
                              const paymentTermsForPo =
                                matchedVendorForZoho?.paymentTerms?.trim() || selectedQuote.terms?.trim() || undefined;

                              const poPayload = {
                                orderId: newDpoId,
                                vendorName,
                                orderDate: createdDateStr,
                                expectedShipmentDate: expectedDeliveryStr,
                                reference: selectedQuote.requestCode,
                                paymentTerms: paymentTermsForPo,
                                status: 'Draft',
                                formData: {
                                  requestId: createPoFromQuoteState.requestId,
                                  requestCode: requests.find((r) => r.id === createPoFromQuoteState.requestId)?.code ?? selectedQuote.requestCode,
                                  quoteId: selectedQuote.id,
                                  ...(matchedVendorForZoho && String(vendorName).trim() && String(vendorName).trim() !== 'Unassigned'
                                    ? {
                                      vendorClientId: matchedVendorForZoho.id,
                                      vendorEntityCode: matchedVendorForZoho.vendorCode,
                                    }
                                    : {}),
                                },
                                items: [
                                  {
                                    itemName: lineItem.item,
                                    itemCode: lineItem.itemCode,
                                    quantity: lineItem.qty,
                                    rate: String(lineItem.pricePerUnit),
                                    tax: String(lineItem.gstPercent || 18),
                                    ...(selectedItem.raw_material_id != null
                                      ? { raw_material_id: Number(selectedItem.raw_material_id) }
                                      : {}),
                                    ...(selectedItem.pack_material_id != null
                                      ? { pack_material_id: Number(selectedItem.pack_material_id) }
                                      : {}),
                                  },
                                ],
                              };

                              const createResult = await createPurchaseOrder(poPayload);
                              if (!createResult.success || !createResult.data) {
                                addToast(
                                  'error',
                                  typeof createResult.error === 'string'
                                    ? createResult.error
                                    : (createResult.error as any)?.message ??
                                    'Failed to create purchase order'
                                );
                                return;
                              }

                              const backendId =
                                String(createResult.data.id ?? '').replace(/^PO-/, '') ||
                                String(createResult.data.id);

                              const newDraftPO: DraftPO = {
                                id: newDpoId,
                                dpoNumber: newDpoId,
                                requestId: createPoFromQuoteState.requestId,
                                requestCode: requests.find((r) => r.id === createPoFromQuoteState.requestId)?.code ?? selectedQuote.requestCode,
                                type: selectedQuote.requestType,
                                vendor: vendorName,
                                vendorId: `VND-${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
                                status: 'Pending Approval',
                                createdDate: createdDateStr,
                                createdBy: 'Procurement — Admin',
                                paymentTerms: paymentTermsForPo ?? selectedQuote.terms ?? '',
                                expectedDelivery: expectedDeliveryStr,
                                deliveryAddress: 'EI Plant 1, IDA Jeedimetla, Hyderabad - 500 055',
                                vendorRating: selectedQuote.rating,
                                alertMessage: `Draft PO created from quote ${selectedQuote.id} for ${lineItem.item}. Awaiting approval to proceed.`,
                                alertType: 'warning',
                                lineItems: [lineItem],
                                subtotal,
                                gstTotal: gstAmount,
                                grandTotal: lineTotal,
                                backendPoId: backendId,
                              };

                              if (createPoFromQuoteState.requestId) {
                                await updateRequestStatus(createPoFromQuoteState.requestId, 'PO Draft', {
                                  skipItems: true,
                                });
                              }

                              updateProcurementState((current) => ({
                                draftPOs: [newDraftPO, ...current.draftPOs],
                              }));

                              void invalidatePurchaseOrdersQueries();
                              addToast(
                                'success',
                                `Draft PO ${newDpoId} created for ${requests.find((r) => r.id === createPoFromQuoteState.requestId)?.code ?? selectedQuote.requestCode}`
                              );
                              setShowCreatePoFromQuoteModal(false);

                              setTimeout(() => {
                                applyRouteState('Procurement', 'Draft POs');
                              }, 500);
                            }}
                            className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60"
                          >
                            Approve & Create Draft PO
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Procurement;


