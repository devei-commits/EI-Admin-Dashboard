import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query';
import type { Query } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useGlobalState } from '../../context/GlobalStateContext';
import ProcurementDashboardShell from '../../components/procurement/ProcurementDashboardShell';
import type { IssuedPOViewRecord } from '../../components/procurement/IssuedPOsView';
import { PurchaseOrdersView } from '../../components/procurement/PurchaseOrdersView';
import { GrnTrackerView } from '../../components/procurement/GrnTrackerView';
import { StockAuditTrackerView } from '../../components/procurement/StockAuditTrackerView';
import { QuoteRequestsView } from '../../components/procurement/QuoteRequestsView';
import { PrInboxView } from '../../components/procurement/PrInboxView';
import { PrEditPopup } from '../../components/procurement/PrEditPopup';
import { StockAuditPopup } from '../../components/procurement/StockAuditPopup';
import { buildInventoryAuditLines, type InventoryAuditLine } from '../../lib/inventoryAuditLines';
import {
  bumpProcurementRequestItemQty,
  bumpPurchaseOrderItemsQty,
  findDraftPurchaseOrderForRequest,
  mergeGapApprovalIntoStockCheckNotes,
  resolveInventoryStockAfterGapApproval,
} from '../../lib/inventoryAuditGapApproval';
import { findStockCheckNoteForItem } from '../../lib/stockCheckNotes';
import { getStockCheckGapForItem } from '../../lib/stockCheckGapDisplay';
import type { Order } from '../../types/salesPurchase.types';
import { mergePurchaseOrderRecords } from '../../lib/purchaseOrderRecordsMerge';
import { normalizeProcurementSection } from '../../lib/procurementNav';
import { formatIsoWeekLabel } from '../../lib/isoWeek';
import { buildProcurementRequestItemLines } from '../../lib/procurementRequestItemLines';
import procurementData from '../../mocks/procurement-data.json';
import {
  fetchProcurementRequests as fetchProcurementRequestsApi,
  updateProcurementRequest as updateProcurementRequestApi,
  createProcurementRequest as createProcurementRequestApi,
  deleteProcurementRequest as deleteProcurementRequestApi,
} from '../../services/procurement.service';
import type { ProcurementRequestItem as BackendPRItem, ProcurementRequest as ApiProcurementRequest } from '../../services/procurement.service';
import {
  fetchProcurementQuotations,
  fetchQuoteLineDefaults,
  createProcurementQuotation,
  deleteProcurementQuotation,
  updateProcurementQuotation as updateProcurementQuotationApi,
} from '../../services/procurementQuotations.service';
import {
  fetchPlanningQuotationAsks,
  updatePlanningQuotationAsk,
  type PlanningQuotationAsk,
} from '../../services/planningQuotationAsks.service';
import { fetchVendorClients } from '../../services/vendorClient.service';
import {
  fetchPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  importPrRowsExcel,
} from '../../services/salesPurchase.service';
import { fetchPoTracking, updatePoTracking } from '../../services/poTracking.service';
import type { PoTrackingRecord } from '../../services/poTracking.service';
import {
  createGRN,
  fetchGRNById,
  fetchGRNList,
  grnLineItemDisplayName,
  grnLineItemsNameSummary,
  updateGRN,
  type GRNRecordFromApi,
} from '../../services/grn.service';
import { fetchWarehouseInventory, updateWarehouseStock } from '../../services/warehouseInventory.service';
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
  buildStockCheckWarehouseDispatchPayload,
  isOpenStockCheckStatus,
} from '../../lib/stockCheckWarehouseDispatch';
import {
  coerceProcurementRequestRows,
  mapBackendPrToRequest,
  fillItemLeadFromPriceListPages,
  mapBackendQuotationToQuote,
  mapVendorClientToVendor,
  mapOrderToPurchaseOrder,
  mapPurchaseOrderToDraftPO,
  draftLineItemsToPurchaseOrderItems,
  recalcDraftPoLineItem,
  itemDetailsToProcurementRequestItems,
  assignPrItemToDraftLines,
  matchBackendPrItemForDraftLine,
  splitBackendPrItemsAfterPartialRelease,
  syncProcurementItemsAfterDraftPoLineQtyEdit,
  computeOpenProcurementLineQty,
  sumCommittedPoQtyForPrItem,
  parseQuantityRequested,
  resolveDraftLineLeadTimeDays,
  normalizeLeadTimeDays,
  computeIssuedPoEtaFromLeadTimes,
  computeRequestDaysUntilDue,
  sortVendorQuotesLatestFirst,
  sortProcurementRequestsLatestFirst,
  sortPlanningQuotationAsksLatestFirst,
  formatDateEnInSafe,
  formatDateWithIsoWeek,
  parseDateStringToLocalDate,
  normalizeDateOnlyString,
  resolvePlannedUnitPrice,
  mergePlannedRateIntoLineNotes,
  planDraftPoDeleteProcurementCleanup,
  requestHasOtherDraftPurchaseOrder,
} from './procurementDataMappers';
import { applyDraftPoLinePrices, applyEditRequestSideEffects } from './syncEditRequestSideEffects';
import type { ReleaseLineEditRow } from './procurementDataMappers';
import { formatMoqDisplay, moqValuesEqual, parseMoqInput } from '../../utils/moqQuantity';
import { formatQtyWithPrimaryUnit, normRmPrimaryUom } from '../../lib/rmUnitConversion';
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
  POTimelineStep,
  CompletedGrn,
  StockCheckStatus,
  StockCheckLineData,
  LiveProcurementState,
  ReleaseToPlannedItem,
  QuoteLine,
} from '../../types/procurement.types';
import StockCheckUpdateModal from './StockCheckUpdateModal';
import { Search, X, Package, Loader2 } from 'lucide-react';
import {
  PAYMENT_TERMS_TYPE_OPTIONS,
  formatPaymentTermsString,
  parsePaymentTermsString,
  paymentTermsTypeRequiresAdvancePercent,
  validateAdvancePercentForType,
  type PaymentTermsStructuredType,
} from '../../lib/paymentTermsStructured';
import { PaymentTermsDisplay } from '../../components/procurement/PaymentTermsDisplay';
import GrnMonitorDetailPanel from '../../components/procurement/GrnMonitorDetailPanel';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Pagination } from '../../components/ui/Pagination';
import { SortableTableTh, type SortDirection } from '../../components/ui/SortableTableTh';
import {
  parseStagedPaymentTerms,
  serializeStagedPaymentTerms,
  validateStagedPercents,
  parseVendorThreeWayFromPlainText,
  formatStagedPaymentTermsObject,
  resolveStagedPaymentTermsForForm,
} from '../../lib/stagedPaymentTerms';
import { queryKeys } from '../../lib/queryClient';
import {
  PROCUREMENT_PRE_DRAFT_STATUSES,
  isProcurementRequestPreDraftPipelineStatus,
} from '../../lib/procurementRequestMerge';

/** Populate tier editor fields from Items List payment_terms (JSON or legacy vendor text). */
function paymentTermsToStagedFields(raw: string): {
  advancePct: string;
  preShipmentPct: string;
  postShipmentPct: string;
  creditDays: string;
} {
  const j = parseStagedPaymentTerms(raw);
  if (j) {
    return {
      advancePct: String(j.advance_pct),
      preShipmentPct: String(j.pre_shipment_pct),
      postShipmentPct: String(j.post_shipment_pct),
      creditDays: String(j.credit_days),
    };
  }
  const v = parseVendorThreeWayFromPlainText(raw);
  if (v) {
    return {
      advancePct: String(v.advance_pct),
      preShipmentPct: String(v.pre_shipment_pct),
      postShipmentPct: String(v.post_shipment_pct),
      creditDays: String(v.credit_days),
    };
  }
  return { advancePct: '', preShipmentPct: '', postShipmentPct: '', creditDays: '0' };
}

const DRAFT_POS_SEED: DraftPO[] = (procurementData as any).draftPOs as DraftPO[];
const PROCUREMENT_LIVE_KEY = 'eiadmin.procurement.live.v1';
const ENABLE_PROCUREMENT_LOCAL_PERSISTENCE =
  typeof import.meta.env?.VITE_ENABLE_PROCUREMENT_LOCAL_PERSISTENCE === 'string'
    && import.meta.env.VITE_ENABLE_PROCUREMENT_LOCAL_PERSISTENCE === '1';
const DEBUG_PROC_RELEASE = import.meta.env.DEV;

/** Query roots used on this screen — `useIsFetching` predicate so the global loader tracks refetches too. */
const PROCUREMENT_PAGE_QUERY_ROOTS = new Set<string>([
  'procurement-requests',
  'procurement-quotations',
  'vendor-client',
  'purchase-orders',
  'grn-list',
  'warehouse-inventory',
  'raw-materials-list',
  'pack-materials-list',
  'po-tracking-released-map',
  'po-tracking',
  'items-list-page',
]);

function procurementPageQueryPredicate(query: Query): boolean {
  const key0 = query.queryKey[0];
  return typeof key0 === 'string' && PROCUREMENT_PAGE_QUERY_ROOTS.has(key0);
}

/** Detect API-driven PR changes that the list sync must apply (stock check, line qty, etc.). */
function procurementRequestApiSyncKey(req: ProcurementRequest): string {
  const itemSig = (req.itemDetails ?? [])
    .map((d) => `${d.itemCode}:${d.itemName}:${d.reqQty}`)
    .join('|');
  return [
    req.id,
    req.status,
    req.dueDate,
    req.priority,
    req.preferredVendor ?? '',
    req.stockCheckStatus ?? '',
    req.stockCheckDueDate ?? '',
    req.stockCheckAssignedTo ?? '',
    req.stockCheckNotes ?? '',
    itemSig,
  ].join('\0');
}

/**
 * PR lines for PO release/split: prefer API `procurement_requests.items`; if missing/empty (cache/sync gap),
 * fall back to mapped UI `itemDetails` so PO rows keep raw_material_id / pack_material_id for warehouse PO Qty.
 */
function resolvePrItemsForPurchaseOrderLines(
  backendPrArray: ApiProcurementRequest[],
  requestsMapped: ProcurementRequest[],
  opts: { backendRequestId: string; draftRequestId: string; requestCode: string }
): BackendPRItem[] {
  const { backendRequestId, draftRequestId, requestCode } = opts;
  const key = String(backendRequestId || draftRequestId || '').trim();
  const prRow = backendPrArray.find((p) => String(p.id) === key) as { items?: BackendPRItem[] } | undefined;
  let lines: BackendPRItem[] = Array.isArray(prRow?.items) ? [...prRow.items] : [];
  if (lines.length === 0) {
    const codeNorm = String(requestCode ?? '').trim().toUpperCase();
    const liveReq =
      requestsMapped.find((r) => String(r.id) === key) ||
      (codeNorm ? requestsMapped.find((r) => String(r.code).toUpperCase() === codeNorm) : undefined);
    if (liveReq?.itemDetails?.length) {
      lines = itemDetailsToProcurementRequestItems(liveReq.itemDetails) as BackendPRItem[];
    }
  }
  return lines;
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

/**
 * Numeric / alphanumeric RM-PM master codes such as "1000612", "4000640", "5L00471" are the real
 * primary keys the backend uses to resolve PO -> GRN line items. extractMasterCodeFromText only
 * matches the synthetic "EI-..." prefix, so anything that needs to survive a round-trip (PO line,
 * GRN payload, warehouse Inbound display) must keep the original code as-is.
 */
function isRealMasterCode(value: unknown): boolean {
  const s = String(value ?? '').trim();
  if (!s) return false;
  if (/^EI-/i.test(s)) return false;
  return /^[A-Z0-9]+$/i.test(s);
}

function resolveItemCodeFromSources(
  sources: unknown[],
  fallbackType: RequestType,
  fallbackIndex: number
): string {
  // Prefer real master codes (e.g. "1000612", "4000640", "5L00471") over synthetic "EI-..." codes.
  // Stripping the real codes here was breaking the procurement -> warehouse GRN flow: the backend
  // could no longer match the line to its PO row by code, fell back to positional matching, and
  // ended up labelling PM lines as the first RM of the PO (the "AQUA" bug).
  for (const src of sources) {
    if (isRealMasterCode(src)) return String(src).trim();
  }
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

const MAIN_TABS: MainTab[] = ['Procurement'];
const SIDE_SECTIONS: SideSection[] = [
  'Requests',
  'Purchase Orders',
  'Quote Requests',
  'Stock Audit',
  'GRN Tracker',
];

type RequestListTab = 'All' | 'Active' | RequestStatus | 'Week + Vendor';
type RequestListViewMode = 'item' | 'pr';

const GRN_MONITOR_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type GrnMonitorSortColumn =
  | 'grnNo'
  | 'poNo'
  | 'vendor'
  | 'type'
  | 'items'
  | 'poValue'
  | 'receivedDate'
  | 'assignedTo'
  | 'qcStatus'
  | 'status';

function grnMonitorStatusLabel(grn: GRNRecordFromApi): string {
  const s = String(grn.status ?? '').trim();
  if (s === 'GRN Complete') return 'Completed';
  if (s === 'Under GRN') return 'Under GRN';
  if (s) return s;
  return 'Pending GRN';
}

function compareGrnSortValues(av: string | number, bv: string | number, direction: SortDirection): number {
  let cmp: number;
  if (typeof av === 'number' && typeof bv === 'number') {
    cmp = av - bv;
  } else {
    cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
  }
  return direction === 'asc' ? cmp : -cmp;
}

function sortValueForGrnMonitorRow(grn: GRNRecordFromApi, col: GrnMonitorSortColumn): string | number {
  switch (col) {
    case 'grnNo':
      return grn.grnNo ?? '';
    case 'poNo':
      return grn.poNo ?? '';
    case 'vendor':
      return grn.vendor ?? '';
    case 'type':
      return grn.type ?? '';
    case 'items':
      return grnLineItemsNameSummary(grn.lineItems);
    case 'poValue':
      return Number(grn.poValue) || 0;
    case 'receivedDate': {
      const d = grn.receivedDate ? new Date(grn.receivedDate) : null;
      return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
    }
    case 'assignedTo':
      return grn.assignedTo ?? '';
    case 'qcStatus':
      return grn.qcStatus ?? '';
    case 'status':
      return grnMonitorStatusLabel(grn);
    default:
      return '';
  }
}

const QUOTATIONS_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
/** Vendor-consolidated quotation cards show this many item rows before "View more". */
const QUOTATION_VENDOR_LINES_PREVIEW = 5;

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

/** PRs still in the RFQ / request queue (before Release to Draft PO). Hidden from the Requests "Active" tab once status is PO Draft or later. */
const REQUEST_STATUSES_PRE_DRAFT_PIPELINE = PROCUREMENT_PRE_DRAFT_STATUSES;

function requestStatusIsPreDraftPipeline(status: RequestStatus): boolean {
  return isProcurementRequestPreDraftPipelineStatus(status);
}

/** True when payment terms include a positive advance % (transaction details + advance recording apply). */
function draftPaymentTermsRequireAdvance(paymentTerms: string | undefined | null): boolean {
  const { type, advancePercent } = parsePaymentTermsString(paymentTerms);
  return paymentTermsTypeRequiresAdvancePercent(type) && Number(advancePercent) > 0;
}

const RELEASE_PAYMENT_MODES = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash', 'Bank Transfer'] as const;
type ReleasePaymentMode = (typeof RELEASE_PAYMENT_MODES)[number];

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
  return idx;
}

/**
 * Timeline rows for Issued PO cards + detail modal — same 7 stages and same completion rule as
 * `issuedPoCardTimelineCompletedIndex` (avoids modal-only extra "Order Tracking" step / different progressive logic).
 */
function buildIssuedPoTimelineSteps(
  recordStatus: string,
  tracking: PoTrackingRecord | null | undefined,
  ov: IssuedPoTimelineOverride | undefined,
  grnCompleteForPo: boolean,
  poDateFallback: string,
): POTimelineStep[] {
  const has = (v: unknown) => v != null && String(v).trim() !== '';
  const completedIdx = issuedPoCardTimelineCompletedIndex(recordStatus, tracking, ov, grnCompleteForPo);
  const meta: { label: string; at: keyof PoTrackingRecord; note: keyof PoTrackingRecord }[] = [
    { label: 'PO Released', at: 'poReleasedAt', note: 'poReleasedNote' },
    { label: 'Advance Paid', at: 'advancePaidAt', note: 'advancePaidNote' },
    { label: 'Vendor Confirmed', at: 'vendorConfirmedAt', note: 'vendorConfirmedNote' },
    { label: 'Shipped', at: 'shippedAt', note: 'shippedNote' },
    { label: 'Delivered', at: 'deliveredAt', note: 'deliveredNote' },
    { label: 'Under GRN', at: 'underGrnAt', note: 'underGrnNote' },
    { label: 'GRN Complete', at: 'grnCompleteAt', note: 'grnCompleteNote' },
  ];
  return meta.map((m, index) => {
    const done = index <= completedIdx;
    let timestamp: string | null = null;
    if (tracking) {
      const raw = tracking[m.at];
      if (has(raw) && typeof raw === 'string') timestamp = raw;
    }
    if (index === 0 && !timestamp && has(poDateFallback)) timestamp = poDateFallback;
    let note: string | null = null;
    if (tracking) {
      const n = tracking[m.note];
      if (has(n) && typeof n === 'string') note = n;
    }
    if (index === 0 && !note && done) note = 'PO shared with vendor';
    return {
      stage: m.label,
      done,
      timestamp,
      actor: index === 0 && done ? 'Procurement' : null,
      note,
    };
  });
}

const isMainTab = (value: string | null): value is MainTab => Boolean(value && MAIN_TABS.includes(value as MainTab));
const isSideSection = (value: string | null): value is SideSection => Boolean(value && SIDE_SECTIONS.includes(value as SideSection));

/** Same tag Planning writes on procurement_requests.notes when requesting vendor rates. */
const PLANNING_QUOTATION_REQUEST_NOTE_TAG = 'Quotation requested from Planning';

function isPlanningQuotationRequest(req: ProcurementRequest): boolean {
  return String(req.notes ?? '').includes(PLANNING_QUOTATION_REQUEST_NOTE_TAG);
}

/** Planning "request quotation" rows belong in Quotations, not the procurement-requests queue. */
function isProcurementRequestsListRow(req: ProcurementRequest): boolean {
  return !isPlanningQuotationRequest(req);
}

function planningQuotationRequestHasRecordedQuote(req: ProcurementRequest, quoteList: VendorQuote[]): boolean {
  return quoteList.some(
    (q) => String(q.requestId) === String(req.id) && !String(q.id).startsWith('IL-'),
  );
}

const getInitialMainTab = (_searchParams: URLSearchParams): MainTab => 'Procurement';
const getInitialSideSection = (searchParams: URLSearchParams): SideSection =>
  normalizeProcurementSection(searchParams.get('section'));

const deriveStockCheckStatusForRequest = (request: ProcurementRequest): StockCheckStatus => {
  const sc = String(request.stockCheckStatus ?? '').trim();
  if (sc) {
    if (sc.toLowerCase() === 'completed') return 'Completed';
    if (sc.toLowerCase() === 'in progress') return 'In Progress';
    return 'Assigned';
  }
  // Do not infer stock-check completion from procurement request lifecycle.
  // Warehouse status is the source of truth for stock-check progress.
  return 'Assigned';
};

const isStockCheckPendingForRequest = (request: ProcurementRequest): boolean => {
  const sc = String(request.stockCheckStatus ?? '').trim().toLowerCase();
  return sc === 'pending' || sc === 'requested' || sc === 'in progress';
};

const parseStockCheckOutcome = (notes: string | null | undefined): 'all_ok' | 'not_ok' | null => {
  if (!notes || !notes.trim()) return null;
  try {
    const parsed = JSON.parse(notes) as { outcome?: string };
    if (parsed?.outcome === 'all_ok' || parsed?.outcome === 'not_ok') return parsed.outcome;
    return null;
  } catch {
    return null;
  }
};

const parseStockCheckNotesLines = (
  notes: string | null | undefined,
): Array<{
  itemCode?: string;
  itemName?: string;
  physicalQty?: number;
  updatedStockQty?: number;
  zone?: string;
  rack?: string;
  batchNo?: string;
}> => {
  if (!notes || !notes.trim()) return [];
  try {
    const parsed = JSON.parse(notes) as { lines?: unknown[] };
    return Array.isArray(parsed?.lines) ? (parsed.lines as Array<any>) : [];
  } catch {
    return [];
  }
};

const isStockCheckOneTimeCompleted = (request: ProcurementRequest): boolean => {
  const status = String(request.stockCheckStatus ?? '').trim().toLowerCase();
  if (status !== 'completed') return false;
  const outcome = parseStockCheckOutcome(request.stockCheckNotes);
  const lines = parseStockCheckNotesLines(request.stockCheckNotes);
  return outcome === 'all_ok' && lines.length > 0;
};

type IlPriceHistoryEntry = {
  oldPrice: number;
  newPrice: number;
  changedAt: string;
  changedBy?: string | null;
  reason?: string | null;
};

const parseIlTierHistory = (tierNote: unknown): IlPriceHistoryEntry[] => {
  const raw = String(tierNote ?? '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { history?: unknown[] };
    if (!Array.isArray(parsed?.history)) return [];
    return parsed.history
      .map((h) => {
        if (!h || typeof h !== 'object') return null;
        const oldPrice = Number((h as { oldPrice?: unknown }).oldPrice);
        const newPrice = Number((h as { newPrice?: unknown }).newPrice);
        const changedAt = String((h as { changedAt?: unknown }).changedAt ?? '').trim();
        if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice)) return null;
        return {
          oldPrice,
          newPrice,
          changedAt: changedAt || new Date().toISOString(),
          changedBy: String((h as { changedBy?: unknown }).changedBy ?? '').trim() || null,
          reason: String((h as { reason?: unknown }).reason ?? '').trim() || null,
        };
      })
      .filter((x): x is IlPriceHistoryEntry => x != null);
  } catch {
    return [];
  }
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
  /** Requests tab: All = no filter; Active = New + Quoted only (excludes PO Draft+ once moved to Draft POs) */
  const [requestTab, setRequestTab] = useState<RequestListTab>('New');
  /** Requests list: one card per item line vs one card per PR (multi-line → one PO). */
  const [requestListView, setRequestListView] = useState<RequestListViewMode>('pr');
  const [draftPOStatusFilter, setDraftPOStatusFilter] = useState<'All Statuses' | 'Pending Approval' | 'Approved'>('All Statuses');
  const [draftPOSearch, setDraftPOSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  /** Per-quote id: show all item lines (vendor cards with many consolidated items). */
  const [expandedQuoteLineLists, setExpandedQuoteLineLists] = useState<Record<string, boolean>>({});
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ProcurementRequest | null>(null);
  // Spec §3A/§3B/§3C popups (PR Inbox row actions)
  const [prEditReq, setPrEditReq] = useState<ProcurementRequest | null>(null);
  const [stockAuditReq, setStockAuditReq] = useState<ProcurementRequest | null>(null);
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
  const [approvingGapLineKey, setApprovingGapLineKey] = useState<string | null>(null);
  const [releasingWeekVendorBucketKey, setReleasingWeekVendorBucketKey] = useState<string | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showRecordQuoteModal, setShowRecordQuoteModal] = useState(false);
  const [recordQuoteForm, setRecordQuoteForm] = useState<{
    vendorId: string;
    quoteDate: string;
    validTill: string;
    leadTimeDays: string;
    notes: string;
    /** When set, save links quotation to this PR and syncs Items List for Planning. */
    procurementRequestId: string;
    /** Planning quotation ask — fulfill on Items List save (no PR). */
    planningQuotationAskId: string;
  }>({
    vendorId: '',
    quoteDate: '',
    validTill: '',
    leadTimeDays: '',
    notes: '',
    procurementRequestId: '',
    planningQuotationAskId: '',
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
  const [recordQuoteLineSearch, setRecordQuoteLineSearch] = useState<Record<number, string>>({});
  const [recordQuoteSaving, setRecordQuoteSaving] = useState(false);

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
    tierNote: string;
  } | null>(null);
  const [editItemsListLineSaving, setEditItemsListLineSaving] = useState(false);
  const [editItemsListLineForm, setEditItemsListLineForm] = useState<{
    pricePerUnit: string;
    moqMin: string;
    moqMax: string;
    advancePct: string;
    preShipmentPct: string;
    postShipmentPct: string;
    creditDays: string;
  }>({
    pricePerUnit: '',
    moqMin: '',
    moqMax: '',
    advancePct: '',
    preShipmentPct: '',
    postShipmentPct: '',
    creditDays: '0',
  });
  const [selectedDraftPO, setSelectedDraftPO] = useState<DraftPO | null>(null);
  const [editingQuoteLine, setEditingQuoteLine] = useState<{
    quoteId: string;
    lineIndex: number;
    nextPrice: string;
  } | null>(null);
  const [savingQuoteLine, setSavingQuoteLine] = useState(false);
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
  const [deletingDraftPoId, setDeletingDraftPoId] = useState<string | null>(null);
  const [draftPoDeleteConfirmTarget, setDraftPoDeleteConfirmTarget] = useState<DraftPO | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [requestDeleteConfirmTarget, setRequestDeleteConfirmTarget] = useState<ProcurementRequest | null>(null);
  const [releaseMethod, setReleaseMethod] = useState<'Email + Portal' | 'Email only' | 'Portal only' | 'WhatsApp + Email'>('Email + Portal');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [releasePaymentTransactionNo, setReleasePaymentTransactionNo] = useState('');
  const [releasePaymentMode, setReleasePaymentMode] = useState<ReleasePaymentMode | ''>('');
  const [releasePaymentDate, setReleasePaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recordingAdvancePayment, setRecordingAdvancePayment] = useState(false);
  const [releasingPO, setReleasingPO] = useState(false);
  const [issuedSearch, setIssuedSearch] = useState('');
  const [issuedVendorFilter, setIssuedVendorFilter] = useState('All Vendors');
  const [issuedStatusFilter, setIssuedStatusFilter] = useState<'All' | 'Released' | 'In Transit' | 'At Risk'>('All');
  /** Timeline stage filter for Issued POs itemised dashboard (parity with Fulfillment pipeline strip). Keys `issued-0` … `issued-6`. */
  const [issuedPoPipelineStageKey, setIssuedPoPipelineStageKey] = useState<string | null>(null);
  const [_issuedViewMode, _setIssuedViewMode] = useState<'Table' | 'Cards'>('Cards');
  const [grnCategoryFilter, setGrnCategoryFilter] = useState<'All' | RequestType>('All');
  const [grnVendorFilter, setGrnVendorFilter] = useState('All Vendors');
  const [grnStatusFilter, setGrnStatusFilter] = useState<'All' | 'Pending GRN' | 'Under GRN' | 'Completed'>('All');
  const [grnSearch, setGrnSearch] = useState('');
  const [grnSortColumn, setGrnSortColumn] = useState<GrnMonitorSortColumn | null>('receivedDate');
  const [grnSortDirection, setGrnSortDirection] = useState<SortDirection>('desc');
  const [grnMonitorPage, setGrnMonitorPage] = useState(1);
  const [grnMonitorPageSize, setGrnMonitorPageSize] = useState<number>(25);
  const [quotationsPage, setQuotationsPage] = useState(1);
  const [quotationsPageSize, setQuotationsPageSize] = useState<number>(10);
  const [selectedGrnMonitor, setSelectedGrnMonitor] = useState<GRNRecordFromApi | null>(null);
  const [grnMonitorDetailLoading, setGrnMonitorDetailLoading] = useState(false);
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
  const [releaseToPlannedLineEdits, setReleaseToPlannedLineEdits] = useState<ReleaseLineEditRow[]>([]);

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
  const { user } = useAuth();
  const { dispatch: globalDispatch } = useGlobalState();
  const isIssuedLikePoStatus = useCallback((status: unknown): boolean => {
    const s = String(status ?? '').trim().toLowerCase();
    return s === 'released' || s === 'issued';
  }, []);

  const procurementQueriesFetching = useIsFetching({ predicate: procurementPageQueryPredicate }) > 0;

  // Prevent double-click / race conditions from creating multiple GRNs for the same PO.
  // Keyed by `record.poNumber`.
  const receiveGrnLockRef = useRef<Record<string, boolean>>({});
  const poExcelInputRef = useRef<HTMLInputElement>(null);
  const [importingPoExcel, setImportingPoExcel] = useState(false);

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

  const { data: planningQuotationAsksResult } = useQuery({
    queryKey: ['planning-quotation-asks', 'pending'],
    queryFn: async () => {
      const res = await fetchPlanningQuotationAsks({ status: 'pending' });
      return res.success ? (res.data ?? []) : [];
    },
  });

  const planningQuotationAsksPending = useMemo(
    () => sortPlanningQuotationAsksLatestFirst(planningQuotationAsksResult ?? []),
    [planningQuotationAsksResult],
  );

  const { data: vendorClientList, isLoading: vendorClientsLoading } = useQuery({
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
    /** Always fetch so sidebar GRN badge matches `grnListFromApi.length` on every visit. */
    enabled: true,
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

  const openGrnMonitorDetail = useCallback(async (grn: GRNRecordFromApi) => {
    setSelectedGrnMonitor(grn);
    setGrnMonitorDetailLoading(true);
    try {
      const full = await fetchGRNById(String(grn.id));
      if (full) setSelectedGrnMonitor(full);
    } finally {
      setGrnMonitorDetailLoading(false);
    }
  }, []);

  const toggleGrnMonitorSort = useCallback((column: GrnMonitorSortColumn) => {
    if (grnSortColumn === column) {
      setGrnSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setGrnSortColumn(column);
      setGrnSortDirection('asc');
    }
    setGrnMonitorPage(1);
  }, [grnSortColumn]);

  const filteredGrnMonitorLines = useMemo(() => {
    const grnList: GRNRecordFromApi[] = grnListFromApi ?? [];
    const filtered = grnList.filter((grn) => {
      if (grnCategoryFilter !== 'All' && grn.type !== grnCategoryFilter) return false;
      if (grnVendorFilter !== 'All Vendors' && grn.vendor !== grnVendorFilter) return false;
      const statusNorm =
        (grn.status || '') === 'GRN Complete'
          ? 'Completed'
          : (grn.status || '') === 'Under GRN'
            ? 'Under GRN'
            : 'Pending GRN';
      if (grnStatusFilter !== 'All' && statusNorm !== grnStatusFilter) return false;
      if (grnSearch.trim()) {
        const q = grnSearch.toLowerCase();
        const globalHit =
          (grn.grnNo ?? '').toLowerCase().includes(q) ||
          (grn.poNo ?? '').toLowerCase().includes(q) ||
          (grn.vendor ?? '').toLowerCase().includes(q) ||
          (grn.lineItems ?? []).some((l) => {
            const name = grnLineItemDisplayName(l).toLowerCase();
            return name.includes(q) || (l.itemCode ?? '').toLowerCase().includes(q);
          });
        if (!globalHit) return false;
      }
      return true;
    });
    if (!grnSortColumn) return filtered;
    return [...filtered].sort((a, b) => {
      const cmp = compareGrnSortValues(
        sortValueForGrnMonitorRow(a, grnSortColumn),
        sortValueForGrnMonitorRow(b, grnSortColumn),
        grnSortDirection
      );
      if (cmp !== 0) return cmp;
      return String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [
    grnListFromApi,
    grnCategoryFilter,
    grnVendorFilter,
    grnStatusFilter,
    grnSearch,
    grnSortColumn,
    grnSortDirection,
  ]);

  const grnMonitorTotalPages = Math.max(
    1,
    Math.ceil(filteredGrnMonitorLines.length / grnMonitorPageSize)
  );
  const grnMonitorSafePage = Math.min(grnMonitorPage, grnMonitorTotalPages);
  const grnMonitorStartIndex = (grnMonitorSafePage - 1) * grnMonitorPageSize;
  const pagedGrnMonitorLines = filteredGrnMonitorLines.slice(
    grnMonitorStartIndex,
    grnMonitorStartIndex + grnMonitorPageSize
  );

  useEffect(() => {
    setGrnMonitorPage(1);
  }, [grnCategoryFilter, grnVendorFilter, grnStatusFilter, grnSearch, grnSortColumn, grnSortDirection, grnMonitorPageSize]);

  useEffect(() => {
    if (grnMonitorPage > grnMonitorTotalPages) {
      setGrnMonitorPage(grnMonitorTotalPages);
    }
  }, [grnMonitorPage, grnMonitorTotalPages]);

  const { data: warehouseInventoryData, isLoading: warehouseInventoryLoading, refetch: refetchWarehouseInventory } = useQuery({
    queryKey: ['warehouse-inventory'],
    queryFn: async () => {
      const res = await fetchWarehouseInventory();
      return res.success ? res.data : null;
    },
    // Needed for Stock Summary in PR View modal as well.
    enabled: !!selectedStockCheckRequest || !!selectedRequest,
    staleTime: 0,
    // Avoid repeated GETs when users switch tabs/windows.
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const openStockCheckModal = useCallback(
    (req: ProcurementRequest) => {
      setSelectedStockCheckRequest(req);
      setSelectedStockCheckItemName(req.itemDetails?.[0]?.itemName ?? req.items[0] ?? null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
    },
    [queryClient]
  );

  const sendStockCheckToWarehouse = useCallback(
    async (req: ProcurementRequest): Promise<ApiProcurementRequest | null> => {
      if (isStockCheckOneTimeCompleted(req)) {
        addToast(
          'warning',
          'Stock check already completed successfully with warehouse qty data. New stock check cannot be raised again for this request.',
        );
        return null;
      }
      if (isOpenStockCheckStatus(req.stockCheckStatus)) {
        addToast(
          'warning',
          'Stock check request is already pending for this request. Complete the current check before raising a new one.',
        );
        return null;
      }
      const res = await updateProcurementRequestApi(req.id, buildStockCheckWarehouseDispatchPayload(req));
      if (!res.success || !res.data) {
        addToast(
          'error',
          typeof res.error === 'string'
            ? res.error
            : (res.error as { message?: string } | null)?.message ?? 'Failed to send stock check request',
        );
        return null;
      }
      const rows = coerceProcurementRequestRows(queryClient.getQueryData(['procurement-requests']));
      const nextRows = rows.some((row) => String(row.id) === String(res.data?.id))
        ? rows.map((row) => (String(row.id) === String(res.data?.id) ? res.data! : row))
        : [res.data, ...rows];
      queryClient.setQueryData(['procurement-requests'], nextRows);
      await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      addToast('success', 'Stock check request sent to Warehouse.');
      return res.data;
    },
    [addToast, queryClient],
  );

  const handleStockCheckAction = useCallback(
    async (req: ProcurementRequest) => {
      if (isOpenStockCheckStatus(req.stockCheckStatus) || isStockCheckOneTimeCompleted(req)) {
        openStockCheckModal(req);
        return;
      }
      const updated = await sendStockCheckToWarehouse(req);
      if (updated) {
        openStockCheckModal(mapBackendPrToRequest(updated));
      }
    },
    [openStockCheckModal, sendStockCheckToWarehouse],
  );

  const { data: rawMaterialsListForQuote = [], isError: rawMaterialsListForQuoteError } = useQuery({
    queryKey: ['raw-materials-list'],
    queryFn: () => fetchRawMaterialsList(),
    enabled: showRecordQuoteModal,
  });
  const { data: packMaterialsListForQuote = [], isError: packMaterialsListForQuoteError } = useQuery({
    queryKey: ['pack-materials-list'],
    queryFn: () => fetchPackMaterialsList(),
    enabled: showRecordQuoteModal,
  });

  const MAX_QUOTE_LINE_RM_PM_SUGGESTIONS = 100;

  const quoteLineItemOptions = useMemo(() => {
    const rmOptions = (rawMaterialsListForQuote as RawMaterialRecord[]).map((r) => {
      const code = String(r.code ?? '').trim();
      const name = String(r.name ?? '').trim();
      const inci = String(r.inci ?? '').trim();
      const sku = String(r.zohoSkuCode ?? '').trim();
      const zoho = String(r.zohoId ?? '').trim();
      const uom = String(r.uom ?? 'KG').trim() || 'KG';
      const searchText = ['rm', String(r.id), code, name, inci, sku, zoho].filter(Boolean).join(' ').toLowerCase();
      return {
        key: `rm-${r.id}`,
        label: `RM - ${code || String(r.id)} - ${name || code || String(r.id)}`,
        searchText,
        itemType: 'RM' as const,
        itemId: code,
        name: name || code || `RM ${r.id}`,
        uom,
      };
    });
    const pmOptions = (packMaterialsListForQuote as PackMaterialRecord[]).map((p) => {
      const code = String(p.code ?? '').trim();
      const name = String(p.description ?? p.code ?? '').trim();
      const sku = String(p.zohoSkuCode ?? '').trim();
      const zoho = String(p.zohoId ?? '').trim();
      const material = String(p.material ?? '').trim();
      const uom = String(p.unit ?? 'PCS').trim() || 'PCS';
      const searchText = ['pm', String(p.id), code, name, sku, material, zoho].filter(Boolean).join(' ').toLowerCase();
      return {
        key: `pm-${p.id}`,
        label: `PM - ${code || String(p.id)} - ${name || code || String(p.id)}`,
        searchText,
        itemType: 'PM' as const,
        itemId: code,
        name: name || code || `PM ${p.id}`,
        uom,
      };
    });
    return [...rmOptions, ...pmOptions];
  }, [packMaterialsListForQuote, rawMaterialsListForQuote]);

  const quoteLineOptionByKey = useMemo(
    () => new Map(quoteLineItemOptions.map((opt) => [opt.key, opt])),
    [quoteLineItemOptions]
  );
  const quoteLineOptionByLabelLower = useMemo(
    () => new Map(quoteLineItemOptions.map((opt) => [opt.label.toLowerCase(), opt])),
    [quoteLineItemOptions]
  );

  const filterQuoteLineOptionsForDatalist = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      const list = !q ? quoteLineItemOptions : quoteLineItemOptions.filter((o) => o.searchText.includes(q));
      return list.slice(0, MAX_QUOTE_LINE_RM_PM_SUGGESTIONS);
    },
    [quoteLineItemOptions]
  );

  const resolveRecordQuoteLineOption = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const lower = trimmed.toLowerCase();
      const exactLabel = quoteLineOptionByLabelLower.get(lower);
      if (exactLabel) return exactLabel;
      const idMatch = /^(rm|pm)-(\d+)$/i.exec(trimmed.replace(/\s+/g, ''));
      if (idMatch) {
        const key = `${idMatch[1].toLowerCase()}-${idMatch[2]}`;
        return quoteLineOptionByKey.get(key) ?? null;
      }
      const cands = quoteLineItemOptions.filter((o) => o.searchText.includes(lower));
      if (cands.length === 1) return cands[0];
      return null;
    },
    [quoteLineItemOptions, quoteLineOptionByKey, quoteLineOptionByLabelLower]
  );

  const requestsMapped = useMemo(
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

    for (const req of requestsMapped) {
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
  }, [warehouseInventoryData?.rows, requestsMapped]);

  const quotesFromApi = useMemo(() => {
    const list = quotationsResult ?? [];
    const mapped = list.map((q) => {
      const req = requestsMapped.find((r) => r.id === String(q.procurementRequestId));
      return mapBackendQuotationToQuote(q, req?.code, req?.type);
    });
    return sortVendorQuotesLatestFirst(mapped);
  }, [quotationsResult, requestsMapped]);

  const vendors: Vendor[] = useMemo(
    () => (vendorClientList ?? []).map(mapVendorClientToVendor),
    [vendorClientList]
  );

  const purchaseOrders: PurchaseOrder[] = useMemo(
    () => (purchaseOrdersRaw ?? []).map((row: any) => mapOrderToPurchaseOrder(row)),
    [purchaseOrdersRaw]
  );

  const resolveOpenQtyForReleaseItem = useCallback(
    (args: {
      requestId: string;
      reqType: RequestType;
      itemName: string;
      itemCode?: string;
      totalReqQty: number;
      raw_material_id?: number;
      pack_material_id?: number;
      itemType?: 'RM' | 'PM';
    }): number => {
      const committed = sumCommittedPoQtyForPrItem(
        {
          itemName: args.itemName,
          itemCode: args.itemCode,
          raw_material_id: args.raw_material_id,
          pack_material_id: args.pack_material_id,
          type: args.itemType ?? args.reqType,
        },
        { requestId: args.requestId, purchaseOrders, draftPOs },
      );
      return computeOpenProcurementLineQty(args.totalReqQty, committed);
    },
    [purchaseOrders, draftPOs],
  );

  /** All released backend PO ids — batch-fetch po-tracking so linked split POs show Delivered / GRN steps correctly. */
  const releasedPoBackendIdsForTracking = useMemo(() => {
    const ids = purchaseOrders
      .filter((p) => isIssuedLikePoStatus(p.status))
      .map((p) => String(p.id ?? '').replace(/^PO-/, ''))
      .filter((id) => /^\d+$/.test(id));
    return [...new Set(ids)].sort();
  }, [isIssuedLikePoStatus, purchaseOrders]);

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
    enabled: sideSection === 'Purchase Orders' && releasedPoBackendIdsForTracking.length > 0,
    staleTime: 30_000,
  });

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

  useEffect(() => {
    if (!releasePOTarget || !releaseDraftTracking) return;
    if (releaseDraftTracking.paymentTransactionNo) {
      setReleasePaymentTransactionNo(releaseDraftTracking.paymentTransactionNo);
    }
    if (releaseDraftTracking.paymentMode) {
      setReleasePaymentMode(releaseDraftTracking.paymentMode as ReleasePaymentMode);
    }
    if (releaseDraftTracking.paymentTransactionDate) {
      setReleasePaymentDate(String(releaseDraftTracking.paymentTransactionDate).slice(0, 10));
    } else if (releaseDraftTracking.advancePaidAt) {
      setReleasePaymentDate(String(releaseDraftTracking.advancePaidAt).slice(0, 10));
    }
  }, [releasePOTarget?.id, releaseDraftTracking]);

  const needItemsListForQuotesOrDraftPO =
    sideSection === 'Quote Requests' ||
    sideSection === 'Purchase Orders' ||
    sideSection === 'Requests' ||
    !!selectedDraftPO ||
    !!selectedRequest;
  const { data: itemsListRm = [] } = useQuery({
    queryKey: ['items-list-page', 'RM'],
    queryFn: async () => {
      const res = await fetchPriceListPage('RM');
      return res.success ? res.data ?? [] : [];
    },
    enabled: needItemsListForQuotesOrDraftPO || backendPrArray.length > 0,
  });
  const { data: itemsListPm = [] } = useQuery({
    queryKey: ['items-list-page', 'PM'],
    queryFn: async () => {
      const res = await fetchPriceListPage('PM');
      return res.success ? res.data ?? [] : [];
    },
    enabled: needItemsListForQuotesOrDraftPO || backendPrArray.length > 0,
  });

  const resolveRmPrimaryUnit = useCallback(
    (rawMaterialId?: number | null, itemCode?: string | null, fallback?: string | null): string => {
      const rmId = rawMaterialId != null ? Number(rawMaterialId) : NaN;
      const code = String(itemCode ?? '').trim().toLowerCase();
      const hit = (itemsListRm ?? []).find((row) => {
        const rowRmId = row.raw_material_id != null ? Number(row.raw_material_id) : NaN;
        if (Number.isFinite(rmId) && rmId > 0 && Number.isFinite(rowRmId) && rowRmId > 0) return rowRmId === rmId;
        const rowCode = String(row.code ?? '').trim().toLowerCase();
        return !!code && !!rowCode && rowCode === code;
      });
      return normRmPrimaryUom(hit?.uom ?? fallback ?? 'KG');
    },
    [itemsListRm]
  );

  const requestsFromApi = useMemo(() => {
    return requestsMapped.map((req) => {
      const quote = quotesFromApi.find((q) => q.requestId === req.id) ?? null;
      const withLead = fillItemLeadFromPriceListPages(req, itemsListRm, itemsListPm, quote?.vendor ?? null);
      const itemDetails = (withLead.itemDetails ?? []).map((d) => {
        const lineType: 'RM' | 'PM' = d.type === 'PM' ? 'PM' : 'RM';
        const master =
          lineType === 'RM'
            ? (itemsListRm ?? []).find((row) => {
                const rid = d.raw_material_id != null ? Number(d.raw_material_id) : NaN;
                const rowRm = row.raw_material_id != null ? Number(row.raw_material_id) : NaN;
                if (Number.isFinite(rid) && rid > 0 && Number.isFinite(rowRm) && rowRm === rid) return true;
                const c = String(d.itemCode ?? '').trim().toLowerCase();
                const rc = String(row.code ?? '').trim().toLowerCase();
                return !!c && !!rc && c === rc;
              })
            : undefined;
        const unit =
          lineType === 'PM'
            ? normRmPrimaryUom(d.unit || 'PCS')
            : resolveRmPrimaryUnit(
                d.raw_material_id != null ? Number(d.raw_material_id) : null,
                d.itemCode,
                d.unit || (master as { uom?: string } | undefined)?.uom
              );
        const requestExpected = normalizeDateOnlyString(withLead.dueDate) || '';
        const expectedDate =
          normalizeDateOnlyString(d.expectedDate) || requestExpected;
        return { ...d, unit, expectedDate };
      });
      return { ...withLead, itemDetails };
    });
  }, [requestsMapped, itemsListRm, itemsListPm, quotesFromApi, resolveRmPrimaryUnit]);

  const draftPOsFromApi = useMemo(() => {
    const reqs = requestsFromApi;
    return purchaseOrders
      .filter((p) => p.status === 'Draft')
      .map((po) => mapPurchaseOrderToDraftPO(po, reqs));
  }, [purchaseOrders, requestsFromApi]);

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
    (sideSection === 'Quote Requests' &&
      (quotationsResult === undefined || planningQuotationAsksResult === undefined)) ||
    (sideSection !== 'Quote Requests' && (backendPrResult === undefined || quotationsResult === undefined));

  useEffect(() => {
    if (backendPrResult === undefined) return;
    setRequests((prev) => {
      if (prev.length !== requestsFromApi.length) return requestsFromApi;
      const same = prev.every((p, i) => {
        const n = requestsFromApi[i];
        if (!n || p.id !== n.id) return false;
        return procurementRequestApiSyncKey(p) === procurementRequestApiSyncKey(n);
      });
      return same ? prev : requestsFromApi;
    });
  }, [backendPrResult, requestsFromApi]);

  /** Keep open request detail in sync after list refetch (e.g. Edit Request saved required date). */
  useEffect(() => {
    if (!selectedRequest?.id) return;
    const fresh = requestsFromApi.find((r) => r.id === selectedRequest.id);
    if (!fresh) return;
    setSelectedRequest((prev) => {
      if (!prev || prev.id !== fresh.id) return prev;
      if (
        prev.dueDate === fresh.dueDate &&
        prev.priority === fresh.priority &&
        prev.status === fresh.status &&
        prev.preferredVendor === fresh.preferredVendor
      ) {
        return prev;
      }
      return { ...prev, ...fresh };
    });
  }, [requestsFromApi, selectedRequest?.id]);

  useEffect(() => {
    if (quotationsResult === undefined) return;
    setQuotes((prev) => {
      const same =
        prev.length === quotesFromApi.length &&
        prev.every((p, i) => {
          const n = quotesFromApi[i];
          if (!n) return false;
          return (
            p.id === n.id &&
            p.requestId === n.requestId &&
            p.vendor === n.vendor &&
            p.status === n.status &&
            p.validTill === n.validTill
          );
        });
      return same ? prev : quotesFromApi;
    });
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

  const handleApproveInventoryAuditGap = useCallback(
    async (line: InventoryAuditLine): Promise<boolean> => {
      if (!(line.gapQty > 1e-6)) {
        addToast('warning', 'No positive gap to approve on this line.');
        return false;
      }
      if (line.stockCheckStatus.trim().toLowerCase() !== 'completed') {
        addToast('warning', 'Warehouse must complete the stock check before gap approval.');
        return false;
      }

      const prRow = backendPrArray.find((p) => String(p.id) === line.requestId);
      if (!prRow) {
        addToast('error', 'Linked procurement request was not found.');
        return false;
      }

      const existingNote = findStockCheckNoteForItem(prRow.stockCheckNotes, line.itemCode, line.itemName);
      if (existingNote?.gapApproved || line.gapApproved) {
        addToast('warning', 'Gap already approved for this audit line.');
        await queryClient.refetchQueries({ queryKey: ['procurement-requests'] });
        return false;
      }

      const items = Array.isArray(prRow.items) ? [...prRow.items] : [];
      if (items.length === 0) {
        addToast('error', 'Request has no item lines to update.');
        return false;
      }

      const approvedBy = user?.name?.trim() || 'Procurement';
      const delta = line.gapQty;
      const bumpedItems = bumpProcurementRequestItemQty(items, line.itemCode, line.itemName, delta);
      const didBumpQty = bumpedItems.some((item, idx) => {
        const nextQty = parseQuantityRequested(item.quantity_requested);
        const prevQty = parseQuantityRequested(items[idx]?.quantity_requested);
        return nextQty !== prevQty;
      });
      if (!didBumpQty) {
        addToast('error', 'Could not match this audit line to a procurement request item.');
        return false;
      }

      const stockCheckNotes = mergeGapApprovalIntoStockCheckNotes(
        prRow.stockCheckNotes,
        line.itemCode,
        line.itemName,
        delta,
        approvedBy
      );

      const prUpd = await updateProcurementRequestApi(line.requestId, {
        items: bumpedItems,
        stockCheckNotes,
      });
      if (!prUpd.success) {
        addToast('error', typeof prUpd.error === 'string' ? prUpd.error : 'Failed to update procurement request');
        return false;
      }

      const targetStock = resolveInventoryStockAfterGapApproval(existingNote);
      const whRows = warehouseInventoryData?.rows ?? [];
      const whRow =
        whRows.find((r) => {
          if (line.raw_material_id != null && Number(line.raw_material_id) > 0) {
            return r.type === 'RM' && Number(r.sourceId) === Number(line.raw_material_id);
          }
          if (line.pack_material_id != null && Number(line.pack_material_id) > 0) {
            return r.type === 'PM' && Number(r.sourceId) === Number(line.pack_material_id);
          }
          const code = line.itemCode.trim().toLowerCase();
          return code && String(r.code ?? '').trim().toLowerCase() === code;
        }) ?? null;
      let inventoryUpdated = false;
      if (targetStock != null && whRow?.warehouseInventoryId != null) {
        const invRes = await updateWarehouseStock(whRow.warehouseInventoryId, { wh_stock: targetStock });
        if (!invRes.success) {
          addToast(
            'warning',
            typeof invRes.error === 'string'
              ? invRes.error
              : 'Request updated, but warehouse inventory could not be adjusted.'
          );
        } else {
          inventoryUpdated = true;
        }
      }

      if (prUpd.data) {
        const updated = mapBackendPrToRequest(prUpd.data);
        setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }

      const rawOrders = (purchaseOrdersRaw ?? []) as Order[];
      const draftPo = findDraftPurchaseOrderForRequest(rawOrders, line.requestId);
      let poUpdated = false;
      if (draftPo?.id) {
        const poItems = bumpPurchaseOrderItemsQty(draftPo.items, line.itemCode, line.itemName, delta);
        const poRes = await updatePurchaseOrder(draftPo.id, { items: poItems });
        if (!poRes.success) {
          addToast(
            'warning',
            typeof poRes.error === 'string'
              ? poRes.error
              : 'Request updated, but draft PO quantity could not be updated.'
          );
        } else {
          poUpdated = true;
        }
      }

      await queryClient.refetchQueries({ queryKey: ['procurement-requests'] });
      await invalidatePurchaseOrdersQueries();
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });

      addToast(
        'success',
        `Gap +${delta.toLocaleString('en-IN')} ${line.unit} approved${
          poUpdated ? ' — request and draft PO qty increased' : ' — request qty increased'
        }${inventoryUpdated ? ' — warehouse stock set to physical count' : ''}.`
      );
      return true;
    },
    [
      addToast,
      backendPrArray,
      invalidatePurchaseOrdersQueries,
      purchaseOrdersRaw,
      queryClient,
      user?.name,
      warehouseInventoryData?.rows,
    ]
  );

  const handleReleaseWeekVendorConsolidated = useCallback(
    async (bucket: WeekVendorItemBucket): Promise<void> => {
      if (bucket.sourceLines.length === 0) {
        addToast('warning', 'No source lines to release.');
        return;
      }

      type SourceReleasePlan = {
        line: (typeof bucket.sourceLines)[number];
        request: ProcurementRequest;
        openQty: number;
        editRow: ReleaseLineEditRow;
      };

      const plans: SourceReleasePlan[] = [];
      const reqType: RequestType = bucket.type === 'PM' ? 'PM' : 'RM';

      for (const line of bucket.sourceLines) {
        const req = requests.find((r) => r.id === line.requestId);
        if (!req) {
          addToast('error', `Request ${line.requestCode} not found.`);
          return;
        }
        if (!isProcurementRequestPreDraftPipelineStatus(req.status)) {
          addToast(
            'warning',
            `${line.requestCode} is not in New or Quoted status — cannot release to draft PO.`
          );
          return;
        }
        if (isStockCheckPendingForRequest(req)) {
          addToast(
            'warning',
            `Stock check is pending on ${line.requestCode}. Release is locked until warehouse sends stock status.`
          );
          return;
        }

        const openQty = resolveOpenQtyForReleaseItem({
          requestId: req.id,
          reqType: req.type,
          itemName: line.itemName,
          itemCode: line.itemCode,
          totalReqQty: line.reqQty,
          raw_material_id: line.raw_material_id,
          pack_material_id: line.pack_material_id,
          itemType: reqType,
        });

        if (openQty <= 0) {
          addToast(
            'warning',
            `No open quantity on ${line.requestCode} for ${line.itemName} (already on a draft PO).`
          );
          return;
        }

        const moqParsed = parseMoqInput(line.moq);
        const moqNum =
          typeof moqParsed === 'number' && !Number.isNaN(moqParsed)
            ? moqParsed
            : Number(line.moq) || 0;

        plans.push({
          line,
          request: req,
          openQty,
          editRow: {
            itemName: line.itemName,
            itemCode: line.itemCode,
            type: reqType,
            originalQty: openQty,
            qty: openQty,
            unit:
              reqType === 'PM'
                ? normRmPrimaryUom(line.unit || 'PCS')
                : resolveRmPrimaryUnit(
                    line.raw_material_id != null ? Number(line.raw_material_id) : null,
                    line.itemCode,
                    line.unit
                  ),
            moq: moqNum,
            unitPrice: 0,
            leadDays: 0,
            ...(line.raw_material_id != null ? { raw_material_id: line.raw_material_id } : {}),
            ...(line.pack_material_id != null ? { pack_material_id: line.pack_material_id } : {}),
          },
        });
      }

      const consolidatedQty = plans.reduce((sum, p) => sum + p.openQty, 0);
      if (consolidatedQty <= 0) {
        addToast('warning', 'Consolidated release quantity must be greater than zero.');
        return;
      }

      const itemSource = bucket.type === 'PM' ? itemsListPm : itemsListRm;
      const matchedItemModal = itemSource.find((row) => {
        const rmM = bucket.raw_material_id != null ? Number(bucket.raw_material_id) : NaN;
        const pmM = bucket.pack_material_id != null ? Number(bucket.pack_material_id) : NaN;
        const rowRmM = row.raw_material_id != null ? Number(row.raw_material_id) : NaN;
        const rowPmM = row.pack_material_id != null ? Number(row.pack_material_id) : NaN;
        if (Number.isFinite(rmM) && rmM > 0 && Number.isFinite(rowRmM) && rowRmM > 0) return rowRmM === rmM;
        if (Number.isFinite(pmM) && pmM > 0 && Number.isFinite(rowPmM) && rowPmM > 0) return rowPmM === pmM;
        const cM = String(bucket.itemCode ?? '').trim().toLowerCase();
        const nM = String(bucket.itemName ?? '').trim().toLowerCase();
        const rcM = String(row.code ?? '').trim().toLowerCase();
        const rnM = String(row.name ?? '').trim().toLowerCase();
        if (cM && rcM && cM === rcM) return true;
        if (nM && rnM && (nM === rnM || nM.includes(rnM) || rnM.includes(nM))) return true;
        return false;
      });

      let unitPrice = Number(bucket.plannedPrice) || 0;
      let leadDays = 0;
      const vendorKey = bucket.vendor.trim().toLowerCase();
      const vendorRate = (matchedItemModal?.vendorRates ?? []).find(
        (rate) => String(rate.vendor_name ?? '').trim().toLowerCase() === vendorKey
      );
      if (vendorRate) {
        const tier =
          (vendorRate.tiers ?? []).find((t) => {
            const moqMin = Number(t.moq_min ?? 0) || 0;
            return consolidatedQty >= moqMin;
          }) ?? vendorRate.tiers?.[0];
        if (tier && Number(tier.price_per_unit) > 0) {
          unitPrice = Number(tier.price_per_unit);
        }
        leadDays = normalizeLeadTimeDays(vendorRate.lead_time_days) ?? leadDays;
      }

      for (const plan of plans) {
        const relItem: ReleaseToPlannedItem = {
          itemName: plan.line.itemName,
          itemCode: plan.line.itemCode,
          idx: 0,
          qty: plan.openQty,
          unit: plan.line.unit,
          reqQty: plan.line.reqQty,
          moq: plan.line.moq,
          plannedPrice: plan.line.plannedPrice,
          ...(plan.line.raw_material_id != null
            ? { raw_material_id: plan.line.raw_material_id }
            : {}),
          ...(plan.line.pack_material_id != null
            ? { pack_material_id: plan.line.pack_material_id }
            : {}),
        };
        const reqQuotes = quotes.filter(
          (q) =>
            q.requestId === plan.request.id &&
            String(q.vendor ?? '').trim().toLowerCase() === vendorKey &&
            q.lines.some((l) => quoteLineMatchesReleaseTarget(l, relItem))
        );
        const quote =
          reqQuotes.find((q) => q.status === 'Confirmed') ?? reqQuotes[0];
        const quoteLine = quote?.lines.find((l) => quoteLineMatchesReleaseTarget(l, relItem));
        if (quoteLine && Number(quoteLine.pricePerUnit) > 0) {
          unitPrice = quoteLine.pricePerUnit;
        }
        if (quote?.leadTimeDays) {
          leadDays = Math.max(leadDays, Number(quote.leadTimeDays) || 0);
        }
      }

      if (unitPrice <= 0) {
        addToast(
          'warning',
          'Set unit price from Items List vendor rates or record a quotation before releasing consolidated PO.'
        );
        return;
      }

      const plansWithPrice = plans.map((p) => ({
        ...p,
        editRow: { ...p.editRow, unitPrice, leadDays },
      }));

      const requestIds = [...new Set(plansWithPrice.map((p) => p.request.id))];
      const requestCodes = [...new Set(plansWithPrice.map((p) => p.line.requestCode))];
      const primaryRequest = plansWithPrice[0]!.request;
      const reference = requestCodes.join(' + ');
      const weekLabel = bucket.hasWeek
        ? formatIsoWeekLabel({ week: bucket.isoWeek, year: bucket.isoWeekYear })
        : '';

      const today = new Date();
      const createdDateStr = today.toISOString().split('T')[0];
      const expectedDelivery = new Date(today);
      expectedDelivery.setDate(expectedDelivery.getDate() + Math.max(0, leadDays));
      const expectedDeliveryStr = expectedDelivery.toISOString().split('T')[0];

      const newDpoId = nextSequentialDpoOrderId(purchaseOrders, draftPOs);
      const vendorName = bucket.vendor;
      const matchedVendorForZoho = vendors.find(
        (v) => (v.name || '').trim().toLowerCase() === vendorName.trim().toLowerCase()
      );
      const vendorMasterPaymentTerms = String(matchedVendorForZoho?.paymentTerms ?? '').trim();
      const gstPercent = 18;
      const subtotal = parseFloat((consolidatedQty * unitPrice).toFixed(2));
      const gstAmount = parseFloat((subtotal * (gstPercent / 100)).toFixed(2));
      const lineTotal = parseFloat((subtotal + gstAmount).toFixed(2));

      const draftLine: DraftPOLineItem = {
        item: bucket.itemName,
        itemCode:
          bucket.itemCode ||
          (bucket.type === 'PM' ? 'EI-PM-001' : 'EI-RM-001'),
        type: reqType,
        qty: String(consolidatedQty),
        leadTimeDays: leadDays,
        pricePerUnit: unitPrice,
        gstPercent,
        gstAmount,
        lineTotal,
        unit: bucket.unit,
        ...(bucket.raw_material_id != null ? { raw_material_id: bucket.raw_material_id } : {}),
        ...(bucket.pack_material_id != null ? { pack_material_id: bucket.pack_material_id } : {}),
      };

      setReleasingWeekVendorBucketKey(bucket.key);

      const poPayload = {
        orderId: newDpoId,
        vendorName,
        orderDate: createdDateStr,
        expectedShipmentDate: expectedDeliveryStr,
        reference,
        paymentTerms: vendorMasterPaymentTerms || 'As per contract',
        status: 'Draft',
        formData: {
          requestId: primaryRequest.id,
          requestCode: reference,
          consolidatedRequestIds: requestIds,
          weekVendorConsolidationKey: bucket.key,
          ...(weekLabel ? { consolidatedWeekLabel: weekLabel } : {}),
          draftNotes: `Week+vendor consolidation (${requestCodes.join(', ')})`,
          ...(matchedVendorForZoho && vendorName.trim()
            ? {
                vendorClientId: matchedVendorForZoho.id,
                vendorEntityCode: matchedVendorForZoho.vendorCode,
              }
            : {}),
        },
        items: [
          {
            itemName: bucket.itemName,
            itemCode: draftLine.itemCode,
            quantity: String(consolidatedQty),
            rate: String(unitPrice),
            tax: String(gstPercent),
            lead_time_days: leadDays,
            ...(bucket.raw_material_id != null
              ? { raw_material_id: Number(bucket.raw_material_id) }
              : {}),
            ...(bucket.pack_material_id != null
              ? { pack_material_id: Number(bucket.pack_material_id) }
              : {}),
          },
        ],
      };

      try {
        const createResult = await createPurchaseOrder(poPayload);
        if (!createResult.success || !createResult.data) {
          addToast(
            'error',
            typeof createResult.error === 'string'
              ? createResult.error
              : (createResult.error as { message?: string })?.message ??
                  'Failed to create consolidated purchase order'
          );
          return;
        }

        const backendId =
          String(createResult.data.id ?? '').replace(/^PO-/, '') ||
          String(createResult.data.id);

        const byRequestId = new Map<string, typeof plansWithPrice>();
        for (const plan of plansWithPrice) {
          const arr = byRequestId.get(plan.request.id) ?? [];
          arr.push(plan);
          byRequestId.set(plan.request.id, arr);
        }

        const remainderCodes: string[] = [];

        for (const [requestId, requestPlans] of byRequestId) {
          const prRow = backendPrArray.find((p: { id: string }) => String(p.id) === requestId) as
            | {
                items?: BackendPRItem[];
                planningExtractedId?: number;
                planningBatchId?: number | null;
                priority?: string;
                requiredByDate?: string | null;
                notes?: string | null;
                preferredVendor?: string | null;
              }
            | undefined;

          const backendItemsForSplit = Array.isArray(prRow?.items) ? prRow!.items : [];
          const lineEdits = requestPlans.map((p) => p.editRow);
          const { releasedItems, remainingItems } = splitBackendPrItemsAfterPartialRelease(
            backendItemsForSplit,
            lineEdits,
            lineEdits
          );

          const prUpd = await updateProcurementRequestApi(requestId, {
            status: 'PO Draft',
            items: releasedItems,
          });
          if (!prUpd.success) {
            addToast(
              'error',
              typeof prUpd.error === 'string'
                ? prUpd.error
                : `Draft PO created but updating ${requestPlans[0]?.line.requestCode ?? 'request'} failed. Adjust manually.`
            );
            void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
            void invalidatePurchaseOrdersQueries();
            return;
          }

          if (remainingItems.length > 0) {
            if (!prRow?.planningExtractedId || prRow.planningExtractedId <= 0) {
              addToast(
                'warning',
                `Cannot split remainder for ${requestPlans[0]?.line.requestCode ?? requestId}: missing planningExtractedId.`
              );
            } else {
              const remainingRes = await createProcurementRequestApi({
                planningExtractedId: prRow.planningExtractedId,
                planningBatchId: prRow.planningBatchId ?? null,
                priority: prRow.priority ?? 'Medium',
                requiredByDate: prRow.requiredByDate ?? null,
                notes: prRow.notes ?? null,
                preferredVendor: prRow.preferredVendor ?? null,
                items: remainingItems,
              });
              if (!remainingRes.success || !remainingRes.data) {
                addToast(
                  'error',
                  typeof remainingRes.error === 'string'
                    ? remainingRes.error
                    : `Failed to create remainder PR for ${requestPlans[0]?.line.requestCode ?? requestId}.`
                );
              } else if (remainingRes.data.code) {
                remainderCodes.push(remainingRes.data.code);
              }
            }
          }
        }

        const newDraftPO: DraftPO = {
          id: newDpoId,
          dpoNumber: newDpoId,
          requestId: primaryRequest.id,
          requestCode: reference,
          type: reqType,
          vendor: vendorName,
          vendorId: `VND-${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
          status: 'Pending Approval',
          createdDate: createdDateStr,
          createdBy: 'Procurement — Admin',
          paymentTerms: vendorMasterPaymentTerms || 'As per contract',
          expectedDelivery: expectedDeliveryStr,
          deliveryAddress: 'EI Plant 1, IDA Jeedimetla, Hyderabad - 500 055',
          vendorRating: 0,
          alertMessage: `Consolidated draft PO (${consolidatedQty.toLocaleString('en-IN')} ${bucket.unit}) from ${requestCodes.join(', ')}${weekLabel ? ` · ${weekLabel}` : ''}.`,
          alertType: 'success',
          lineItems: [draftLine],
          subtotal,
          gstTotal: gstAmount,
          grandTotal: lineTotal,
          backendPoId: backendId,
        };

        setDraftPOs((prev) => [newDraftPO, ...prev]);

        void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
        void invalidatePurchaseOrdersQueries();

        addToast(
          'success',
          `Draft PO ${newDpoId} created — ${consolidatedQty.toLocaleString('en-IN')} ${bucket.unit} from ${requestCodes.join(' + ')}${
            remainderCodes.length > 0 ? `; remainders: ${remainderCodes.join(', ')}` : ''
          }`
        );

        setTimeout(() => {
          setMainTab('Procurement');
          setSideSection('Purchase Orders');
          const nextSearchParams = new URLSearchParams(searchParams);
          nextSearchParams.set('tab', 'Procurement');
          nextSearchParams.set('section', 'Purchase Orders');
          setSearchParams(nextSearchParams, { replace: true });
        }, 500);
      } finally {
        setReleasingWeekVendorBucketKey(null);
      }
    },
    [
      addToast,
      backendPrArray,
      draftPOs,
      invalidatePurchaseOrdersQueries,
      itemsListPm,
      itemsListRm,
      purchaseOrders,
      queryClient,
      quotes,
      requests,
      resolveOpenQtyForReleaseItem,
      resolveRmPrimaryUnit,
      searchParams,
      setSearchParams,
      vendors,
    ]
  );

  const handlePoExcelChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      setImportingPoExcel(true);
      try {
        const res = await importPrRowsExcel(file, { details: true });
        const summary = res.summary;
        if (!res.ok) {
          addToast('error', res.error ?? 'Purchase order import failed');
          return;
        }
        const quoteHint =
          res.quotation_rows_total != null && res.quotation_rows_total > 0
            ? ` · ${res.quotation_rows_total} quotation rows`
            : '';
        const rawHint =
          res.raw_detail_rows_total != null && res.raw_detail_rows_total > 0
            ? ` · ${res.raw_detail_rows_total} reconcile rows`
            : '';
        addToast(
          'success',
          `POs imported: ${summary?.purchase_orders_created ?? 0} created, ${summary?.purchase_orders_updated ?? 0} updated, ${res.rows_total ?? 0} PR rows${quoteHint}${rawHint}, ${summary?.errors ?? 0} errors`,
        );
        if ((summary?.errors ?? 0) > 0 && Array.isArray(res.row_log) && res.row_log.length > 0) {
          const sampleErrors = res.row_log
            .filter((r) => r.action === 'error')
            .slice(0, 3)
            .map((r) => `${r.po_key ?? 'PO'}: ${r.reason ?? r.action}`)
            .join('; ');
          if (sampleErrors) addToast('warning', `Import issues: ${sampleErrors}`);
        }
        await invalidatePurchaseOrdersQueries();
      } catch (err) {
        addToast('error', err instanceof Error ? err.message : 'Purchase order import failed');
      } finally {
        setImportingPoExcel(false);
      }
    },
    [addToast, invalidatePurchaseOrdersQueries],
  );

  useEffect(() => {
    if (!editRequestTarget) return;
    const backendPr = backendPrArray.find((p: { id: string }) => String(p.id) === editRequestTarget.id) as { items?: BackendPRItem[]; preferredVendor?: string } | undefined;
    const items = Array.isArray(backendPr?.items)
      ? backendPr.items.map((i) => {
          const price = resolvePlannedUnitPrice(i);
          if (price <= 0) return { ...i };
          return {
            ...i,
            planned_unit_price: price,
            line_notes: mergePlannedRateIntoLineNotes(i.line_notes, price),
          };
        })
      : [];
    setEditRequestForm({
      priority: editRequestTarget.priority,
      requiredByDate: normalizeDateOnlyString(editRequestTarget.dueDate) || '',
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

  const updateEditRequestItemPrice = (index: number, rawValue: string) => {
    const price = parseFloat(String(rawValue).replace(/,/g, '')) || 0;
    setEditRequestForm((prev) => {
      const next = [...prev.items];
      const cur = next[index];
      if (!cur) return prev;
      next[index] = {
        ...cur,
        planned_unit_price: price > 0 ? price : undefined,
        line_notes: mergePlannedRateIntoLineNotes(cur.line_notes, price),
      };
      return { ...prev, items: next };
    });
  };

  const applyRouteState = (tab: MainTab, section?: SideSection) => {
    const nextSection = tab === 'Procurement' ? section ?? sideSection : 'Requests';
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

      if (sideSection === 'Requests') {
        const linkedRequest = requests.find((request) => request.id === quote.requestId);
        if (!linkedRequest || !requestStatusIsPreDraftPipeline(linkedRequest.status)) {
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
      __tierNote: string;
    };
    const bucket = new Map<string, { vendor: string; vendorId: string; requestType: RequestType; lines: TmpLine[]; terms?: string }>();
    const add = (type: RequestType, item: PriceListItemPage) => {
      const code = String(item.code ?? '').trim();
      const name = String(item.name ?? '').trim() || code;
      const unit =
        type === 'RM'
          ? resolveRmPrimaryUnit(
              item.raw_material_id != null ? Number(item.raw_material_id) : null,
              item.code,
              item.uom
            )
          : 'PCS';
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
            __tierNote: String((tier as { note?: unknown }).note ?? ''),
            priceHistory: parseIlTierHistory((tier as { note?: unknown }).note),
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
    if (sideSection !== 'Quote Requests') return sortVendorQuotesLatestFirst(filteredQuotes);
    return sortVendorQuotesLatestFirst([...filteredQuotes, ...filteredItemsListQuotes]);
  }, [sideSection, filteredQuotes, filteredItemsListQuotes]);

  const quotationsTotalPages = Math.max(
    1,
    Math.ceil(quotesForQuotationsSection.length / quotationsPageSize)
  );
  const quotationsSafePage = Math.min(quotationsPage, quotationsTotalPages);
  const quotationsStartIndex = (quotationsSafePage - 1) * quotationsPageSize;
  const pagedQuotesForQuotationsSection = useMemo(
    () =>
      quotesForQuotationsSection.slice(
        quotationsStartIndex,
        quotationsStartIndex + quotationsPageSize
      ),
    [quotesForQuotationsSection, quotationsStartIndex, quotationsPageSize]
  );

  useEffect(() => {
    setQuotationsPage(1);
    setExpandedQuoteLineLists({});
  }, [searchQuery, categoryFilter, vendorFilter, statusFilter, quotationsPageSize]);

  useEffect(() => {
    if (quotationsPage > quotationsTotalPages) {
      setQuotationsPage(quotationsTotalPages);
    }
  }, [quotationsPage, quotationsTotalPages]);

  const procurementRequestsList = useMemo(
    () => requests.filter(isProcurementRequestsListRow),
    [requests],
  );

  const planningQuotationRequestsAwaitingQuote = useMemo(() => {
    return requests.filter(
      (r) => isPlanningQuotationRequest(r) && !planningQuotationRequestHasRecordedQuote(r, quotes),
    );
  }, [quotes, requests]);

  const filteredPlanningQuotationRequestsAwaitingQuote = useMemo(() => {
    return sortProcurementRequestsLatestFirst(planningQuotationRequestsAwaitingQuote.filter((req) => {
      if (categoryFilter !== 'All' && req.type !== categoryFilter) return false;
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const matchesCode = req.code.toLowerCase().includes(query);
      const matchesItems = req.items.some((item) => item.toLowerCase().includes(query));
      const matchesPlanning =
        (req.planningSoNumber != null && String(req.planningSoNumber).toLowerCase().includes(query)) ||
        (req.planningCustomerName != null && String(req.planningCustomerName).toLowerCase().includes(query)) ||
        (req.planningProductName != null && String(req.planningProductName).toLowerCase().includes(query)) ||
        (req.planningProductCode != null && String(req.planningProductCode).toLowerCase().includes(query));
      const matchesItemDetails = (req.itemDetails ?? []).some(
        (d) =>
          (d.itemName != null && String(d.itemName).toLowerCase().includes(query)) ||
          (d.itemCode != null && String(d.itemCode).toLowerCase().includes(query)),
      );
      return matchesCode || matchesItems || matchesPlanning || matchesItemDetails;
    }));
  }, [categoryFilter, planningQuotationRequestsAwaitingQuote, searchQuery]);

  const filteredPlanningQuotationAsks = useMemo(() => {
    return sortPlanningQuotationAsksLatestFirst(planningQuotationAsksPending.filter((ask) => {
      const askType = ask.itemType === 'PM' ? 'PM' : 'RM';
      if (categoryFilter !== 'All' && askType !== categoryFilter) return false;
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const matchesCode = String(ask.itemCode ?? '').toLowerCase().includes(query);
      const matchesName = String(ask.itemName ?? '').toLowerCase().includes(query);
      const matchesVendor = String(ask.vendorHint ?? '').toLowerCase().includes(query);
      const matchesPlanning =
        (ask.planningSoNumber != null && String(ask.planningSoNumber).toLowerCase().includes(query)) ||
        (ask.planningCustomerName != null && String(ask.planningCustomerName).toLowerCase().includes(query)) ||
        (ask.planningProductName != null && String(ask.planningProductName).toLowerCase().includes(query)) ||
        (ask.planningProductCode != null && String(ask.planningProductCode).toLowerCase().includes(query));
      return matchesCode || matchesName || matchesVendor || matchesPlanning;
    }));
  }, [categoryFilter, planningQuotationAsksPending, searchQuery]);

  const openEditItemsListTier = (quote: VendorQuote, line: QuoteLine) => {
    const meta = line as QuoteLine & {
      __itemsListId?: number;
      __rateId?: number;
      __tierId?: number;
      __moqMin?: number;
      __moqMax?: number | null;
      __paymentTerms?: string;
      __tierNote?: string;
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
      tierNote: String(meta.__tierNote ?? ''),
    });
    const staged = paymentTermsToStagedFields(paymentTerms || '');
    setEditItemsListLineForm({
      pricePerUnit: String(Number(line.pricePerUnit ?? 0) || ''),
      moqMin: String(moqMin || ''),
      moqMax: moqMax == null ? '' : String(moqMax),
      ...staged,
    });
  };

  const saveEditItemsListTier = async () => {
    if (!editItemsListLineTarget) return;
    const itemsListId = editItemsListLineTarget.itemsListId;
    const rateId = editItemsListLineTarget.rateId;
    const tierId = editItemsListLineTarget.tierId;
    const nextPrice = Number(editItemsListLineForm.pricePerUnit || 0) || 0;
    const moqMaxRaw = String(editItemsListLineForm.moqMax ?? '').trim();
    const nextMoqMax = moqMaxRaw === '' ? null : parseMoqInput(moqMaxRaw);
    const adv = Number(editItemsListLineForm.advancePct);
    const pre = Number(editItemsListLineForm.preShipmentPct);
    const post = Number(editItemsListLineForm.postShipmentPct);
    const cd = Math.max(0, parseInt(String(editItemsListLineForm.creditDays ?? '0'), 10) || 0);
    const pctErr = validateStagedPercents(adv, pre, post);
    if (pctErr) {
      addToast('error', pctErr);
      return;
    }
    const nextPaymentTerms = serializeStagedPaymentTerms({
      advance_pct: adv,
      pre_shipment_pct: pre,
      post_shipment_pct: post,
      credit_days: cd,
    });
    if (nextPrice <= 0) {
      addToast('warning', 'Enter a valid price.');
      return;
    }
    const existingHistory = parseIlTierHistory(editItemsListLineTarget.tierNote);
    const appendedHistory =
      Math.abs((Number(editItemsListLineTarget.pricePerUnit) || 0) - nextPrice) < 1e-9
        ? existingHistory
        : [
            ...existingHistory,
            {
              oldPrice: Number(editItemsListLineTarget.pricePerUnit) || 0,
              newPrice: nextPrice,
              changedAt: new Date().toISOString(),
              reason: 'Edited from Procurement -> Quotations',
            } satisfies IlPriceHistoryEntry,
          ];
    const nextTierNote = JSON.stringify({
      source: 'procurement-il-edit',
      history: appendedHistory,
    });
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
        note: nextTierNote,
      });
      if (!resTier.success) {
        addToast('error', 'Failed to update tier.');
        return;
      }

      // Keep default rate aligned with edited tier for downstream consumers.
      await updateItemListRate(String(itemsListId), rateId, { default_rate: nextPrice });

      // Optimistically update cached items-list page to avoid stale IL card rows.
      const patchItemsListPage = (pageType: 'RM' | 'PM') => {
        queryClient.setQueryData<PriceListItemPage[]>(['items-list-page', pageType], (prev) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((item) => {
            const currentItemsListId = Number(item.itemsListId ?? 0) || 0;
            if (currentItemsListId !== itemsListId) return item;
            return {
              ...item,
              vendorRates: (item.vendorRates ?? []).map((rate) => {
                if (Number(rate.id) !== rateId) return rate;
                return {
                  ...rate,
                  tiers: (rate.tiers ?? []).map((tier) =>
                    Number(tier.id) === tierId
                      ? {
                          ...tier,
                          price_per_unit: nextPrice,
                          moq_max: nextMoqMax,
                          note: nextTierNote,
                        }
                      : tier,
                  ),
                };
              }),
            };
          });
        });
      };
      patchItemsListPage('RM');
      patchItemsListPage('PM');

      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          typeof q.queryKey[0] === 'string' &&
          q.queryKey[0].startsWith('items-list'),
        refetchType: 'all',
      });
      await queryClient.refetchQueries({ queryKey: ['items-list-page', 'RM'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['items-list-page', 'PM'], type: 'active' });
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
    return procurementRequestsList.filter(
      (r) =>
        r.status === 'PO Draft' &&
        !linkedRequestIds.has(r.id) &&
        (categoryFilter === 'All' || r.type === categoryFilter),
    );
  }, [procurementRequestsList, draftPOs, categoryFilter]);

  /** Requests sidebar tabs: counts must match list filters (Active = New + Quoted only). */
  const procurementRequestTabCounts = useMemo(() => {
    const rows = procurementRequestsList;
    return {
      all: rows.length,
      active: rows.filter((r) => requestStatusIsPreDraftPipeline(r.status)).length,
      new: rows.filter((r) => r.status === 'New').length,
      quoted: rows.filter((r) => r.status === 'Quoted').length,
      poDraft: rows.filter((r) => r.status === 'PO Draft').length,
      poReleased: rows.filter((r) => r.status === 'PO Released').length,
    };
  }, [procurementRequestsList]);

  const procurementRequestsMatchingSearchAndCategory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return procurementRequestsList.filter((req) => {
      if (categoryFilter !== 'All' && req.type !== categoryFilter) return false;
      if (!query) return true;
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
      return matchesCode || matchesItems || matchesPlanning || matchesVendor || matchesItemDetails;
    });
  }, [procurementRequestsList, categoryFilter, searchQuery]);

  const weekVendorTabLineCount = 0;

  const quoteStats = useMemo(() => {
    const list = sideSection === 'Quote Requests' ? quotesForQuotationsSection : filteredQuotes;
    const totalQuotes =
      list.length +
      (sideSection === 'Quote Requests'
        ? filteredPlanningQuotationAsks.length + filteredPlanningQuotationRequestsAwaitingQuote.length
        : 0);
    const confirmed = list.filter((quote) => quote.status === 'Confirmed').length;
    const notSelected = list.filter((quote) => quote.status === 'Not Selected').length;

    return {
      totalQuotes,
      confirmed,
      notSelected,
      urgent: procurementRequestsList.filter((request) => request.priority === 'High' && request.status === 'New')
        .length,
      pendingAction: procurementRequestsList.filter((request) => request.status === 'New' || request.status === 'Quoted')
        .length,
    };
  }, [
    filteredPlanningQuotationAsks.length,
    filteredPlanningQuotationRequestsAwaitingQuote.length,
    filteredQuotes,
    procurementRequestsList,
    quotesForQuotationsSection,
    requests,
    sideSection,
  ]);

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
              isIssuedLikePoStatus(p.status) &&
              (String(p.formData?.requestId) === String(request.id) ||
                String(p.formData?.requestCode).toUpperCase() === String(request.code).toUpperCase()),
          )
          .sort((a, b) => {
            const na = parseInt(String(a.id).replace(/\D/g, ''), 10) || 0;
            const nb = parseInt(String(b.id).replace(/\D/g, ''), 10) || 0;
            return nb - na;
          });

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
                const rmId = i?.raw_material_id != null ? Number(i.raw_material_id) : NaN;
                const pmId = i?.pack_material_id != null ? Number(i.pack_material_id) : NaN;
                const lineLead = normalizeLeadTimeDays(i.lead_time_days ?? i.leadTimeDays);
                const quoteLine = linkedQuote?.lines?.[idx] ?? linkedQuote?.lines?.find(
                  (l) => l.item && String(l.item).trim() === String(i.itemName ?? i.name ?? '').trim(),
                );
                const resolvedLead =
                  lineLead ??
                  normalizeLeadTimeDays(quoteLine?.leadTimeDays) ??
                  normalizeLeadTimeDays(request.itemDetails?.[idx]?.leadTimeDays) ??
                  normalizeLeadTimeDays(linkedQuote?.leadTimeDays);
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
                  ...(resolvedLead !== undefined ? { leadTimeDays: resolvedLead } : {}),
                  ...(Number.isFinite(rmId) && rmId > 0 ? { raw_material_id: rmId } : {}),
                  ...(Number.isFinite(pmId) && pmId > 0 ? { pack_material_id: pmId } : {}),
                  ...(i.unit ? { unit: String(i.unit) } : {}),
                } as DraftPOLineItem;
              })
              : fallbackLineItems,
          );

        // After a split, a *draft* split (e.g. …-S2) still shares requestId with the released half (…-S1).
        // Never let that draft override lines / PO number for Issued POs — vendor-facing data must come from each Released PO row.
        if (releasedPosForRequest.length > 0) {
          const multiReleased = releasedPosForRequest.length > 1;
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
            const tr =
              /^\d+$/.test(backendPoId) && releasedPoTrackingByBackendId
                ? releasedPoTrackingByBackendId[backendPoId]
                : undefined;
            const shipped =
              tr?.shippedAt != null && String(tr.shippedAt).trim() !== '';
            /** Legacy: PR was set to Delivery Pending before per-PO tracking — only trust for a single released PO. */
            const legacyInTransitFromPr = !multiReleased && request.status === 'Delivery Pending';
            const rowInTransit = shipped || legacyInTransitFromPr;
            const etaPayload = computeIssuedPoEtaFromLeadTimes({
              today,
              poReleaseDateStr: linkedPO.date ?? draftOverlay?.createdDate ?? request.createdDate,
              request,
              linkedQuote,
              linkedPO,
              draftOverlay,
              lineItems: lineItems.map((l) => ({ item: l.item, itemCode: String(l.itemCode ?? '') })),
            });
            const etaDays = etaPayload.etaDays;
            const etaDateDisplay = etaPayload.etaDateDisplay;
            const rowStatus: 'Released' | 'In Transit' | 'At Risk' = rowInTransit
              ? 'In Transit'
              : etaDays < 0 || (request.priority === 'High' && etaDays <= 2)
                ? 'At Risk'
                : 'Released';
            return {
              request,
              poNumber: String(linkedPO.poNumber ?? draftOverlay?.dpoNumber ?? request.code).replace('DPO', 'PO'),
              vendor: linkedPO.vendorName ?? draftOverlay?.vendor ?? linkedQuote?.vendor ?? 'Unassigned Vendor',
              status: rowStatus,
              etaDays,
              etaDateDisplay,
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

        const draftEta = computeIssuedPoEtaFromLeadTimes({
          today,
          poReleaseDateStr: linkedDraftPO?.createdDate ?? request.createdDate,
          request,
          linkedQuote,
          linkedPO: undefined,
          draftOverlay: linkedDraftPO,
          lineItems: lineItems.map((l) => ({ item: l.item, itemCode: String(l.itemCode ?? '') })),
        });
        const etaDaysDraft = draftEta.etaDays;
        /** Request-level status for rows that are not tied to a specific released PO (draft-only card). */
        const computedStatusDraftRow: 'Released' | 'In Transit' | 'At Risk' =
          request.status === 'Delivery Pending'
            ? 'In Transit'
            : etaDaysDraft < 0 || (request.priority === 'High' && etaDaysDraft <= 2)
              ? 'At Risk'
              : 'Released';

        return [
          {
            request,
            poNumber: String(linkedDraftPO?.dpoNumber ?? request.code).replace('DPO', 'PO'),
            vendor: linkedDraftPO?.vendor ?? linkedQuote?.vendor ?? 'Unassigned Vendor',
            status: computedStatusDraftRow,
            etaDays: etaDaysDraft,
            etaDateDisplay: draftEta.etaDateDisplay,
            lineItems,
            grandTotal,
            requestCode: request.code,
            createdDate: linkedDraftPO?.createdDate ?? request.createdDate ?? '',
            paymentTerms: linkedDraftPO?.paymentTerms ?? linkedQuote?.terms ?? 'As per contract',
            backendPoId: undefined,
          },
        ];
      });

    // Include released PO records even when there is no linked procurement request.
    // This happens for Draft POs created from Planning > Items Involved.
    const requestPoNumbers = new Set(requestRecords.map((r) => r.poNumber));

    const unlinkedReleasedPOs = purchaseOrders
      .filter((p) => isIssuedLikePoStatus(p.status))
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
        const rmId = i?.raw_material_id != null ? Number(i.raw_material_id) : NaN;
        const pmId = i?.pack_material_id != null ? Number(i.pack_material_id) : NaN;
        const lineLead = normalizeLeadTimeDays(i.lead_time_days ?? i.leadTimeDays);
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
          ...(lineLead !== undefined ? { leadTimeDays: lineLead } : {}),
          ...(Number.isFinite(rmId) && rmId > 0 ? { raw_material_id: rmId } : {}),
          ...(Number.isFinite(pmId) && pmId > 0 ? { pack_material_id: pmId } : {}),
          ...(i.unit ? { unit: String(i.unit) } : {}),
        } as DraftPOLineItem;
      });

      const grandTotal = Number(po.value ?? 0) || lineItems.reduce((sum, line) => sum + line.lineTotal, 0);
      const expected = po.expectedShipmentDate || po.date || today.toISOString().slice(0, 10);

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

      const unlinkedEta = computeIssuedPoEtaFromLeadTimes({
        today,
        poReleaseDateStr: po.date,
        request: placeholderRequest,
        linkedQuote: undefined,
        linkedPO: po,
        lineItems: lineItems.map((l) => ({ item: l.item, itemCode: String(l.itemCode ?? '') })),
      });

      return {
        request: placeholderRequest,
        poNumber: String(po.poNumber ?? po.reference ?? '').replace('DPO', 'PO'),
        vendor: po.vendorName ?? 'Unassigned Vendor',
        status: (ov?.shipped || ov?.delivered || ov?.underGrn || tracking?.shippedAt || tracking?.deliveredAt || tracking?.underGrnAt || tracking?.grnCompleteAt)
          ? ('In Transit' as const)
          : ('Released' as const),
        backendPoId,
        etaDays: unlinkedEta.etaDays,
        etaDateDisplay: unlinkedEta.etaDateDisplay,
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
  }, [draftPOs, isIssuedLikePoStatus, purchaseOrders, quotes, requests, releasedPoTrackingByBackendId, unlinkedPoTimelineOverrides]);

  /** KPI + timeline stage counts for Issued POs itemised dashboard (aligned with fulfillment overview). */
  const issuedPoOverviewKpis = useMemo(() => {
    const stageCounts = [0, 0, 0, 0, 0, 0, 0];
    let advancePending = 0;
    let inTransitCount = 0;
    let rmPos = 0;
    let pmPos = 0;
    let totalValue = 0;
    let pendingValue = 0;

    for (const record of issuedPORecords) {
      totalValue += record.grandTotal;
      if (record.status === 'Released') advancePending++;
      if (record.status === 'In Transit') inTransitCount++;
      if (record.request.type === 'RM') rmPos++;
      if (record.request.type === 'PM') pmPos++;

      const backendPoId = record.backendPoId ? String(record.backendPoId) : '';
      const ov = backendPoId ? unlinkedPoTimelineOverrides[backendPoId] : undefined;
      const tracking = backendPoId ? releasedPoTrackingByBackendId?.[backendPoId] : undefined;
      const grnDone = grnCompletePoNormSet.has(normPoNumberKeyForTimeline(record.poNumber));
      const idx = issuedPoCardTimelineCompletedIndex(record.status, tracking, ov, grnDone);
      if (idx >= 0 && idx <= 6) stageCounts[idx]++;
      if (idx < 6) pendingValue += record.grandTotal;
    }

    return {
      totalPos: issuedPORecords.length,
      rmPos,
      pmPos,
      advancePending,
      inTransitCount,
      totalValue,
      pendingValue,
      stageCounts,
      grnCompletePoCount: stageCounts[6],
    };
  }, [issuedPORecords, releasedPoTrackingByBackendId, unlinkedPoTimelineOverrides, grnCompletePoNormSet]);

  const purchaseOrderViewRecords = useMemo(
    () => mergePurchaseOrderRecords(issuedPORecords, draftPOs, requests),
    [issuedPORecords, draftPOs, requests],
  );

  /** Sidebar badges: each number is a direct count from its own dataset (no derived math like max-of-two). */
  const sideCounts = useMemo(
    () => ({
      Requests: procurementRequestTabCounts.active,
      'Purchase Orders': purchaseOrderViewRecords.length,
      'Quote Requests':
        quotes.length +
        filteredPlanningQuotationAsks.length +
        planningQuotationRequestsAwaitingQuote.length,
      'Stock Audit': buildInventoryAuditLines(procurementRequestsList).length,
      'GRN Tracker': (grnListFromApi ?? []).length,
    }),
    [
      purchaseOrderViewRecords.length,
      grnListFromApi,
      procurementRequestsList,
      filteredPlanningQuotationAsks.length,
      planningQuotationRequestsAwaitingQuote.length,
      procurementRequestTabCounts,
      quotes,
    ],
  );

  const filteredIssuedPORecords = useMemo(() => {
    return issuedPORecords.filter((record) => {
      if (categoryFilter !== 'All' && record.request.type !== categoryFilter) {
        return false;
      }
      if (issuedVendorFilter !== 'All Vendors' && record.vendor !== issuedVendorFilter) {
        return false;
      }

      if (issuedStatusFilter !== 'All' && record.status !== issuedStatusFilter) {
        return false;
      }

      if (issuedPoPipelineStageKey != null) {
        const m = /^issued-(\d+)$/.exec(issuedPoPipelineStageKey);
        const targetIdx = m ? Number(m[1]) : NaN;
        if (Number.isFinite(targetIdx) && targetIdx >= 0 && targetIdx <= 6) {
          const backendPoId = record.backendPoId ? String(record.backendPoId) : '';
          const ov = backendPoId ? unlinkedPoTimelineOverrides[backendPoId] : undefined;
          const tracking = backendPoId ? releasedPoTrackingByBackendId?.[backendPoId] : undefined;
          const grnDone = grnCompletePoNormSet.has(normPoNumberKeyForTimeline(record.poNumber));
          const idx = issuedPoCardTimelineCompletedIndex(record.status, tracking, ov, grnDone);
          if (idx !== targetIdx) return false;
        }
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
  }, [
    categoryFilter,
    grnCompletePoNormSet,
    issuedPORecords,
    issuedPoPipelineStageKey,
    issuedSearch,
    issuedStatusFilter,
    issuedVendorFilter,
    releasedPoTrackingByBackendId,
    unlinkedPoTimelineOverrides,
  ]);

  const filteredPurchaseOrderRecords = useMemo(() => {
    return purchaseOrderViewRecords.filter((record) => {
      if (categoryFilter !== 'All' && record.request.type !== categoryFilter) {
        return false;
      }
      if (issuedVendorFilter !== 'All Vendors' && record.vendor !== issuedVendorFilter) {
        return false;
      }
      if (issuedStatusFilter !== 'All' && record.status !== issuedStatusFilter) {
        return false;
      }
      if (!issuedSearch.trim()) return true;
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
  }, [purchaseOrderViewRecords, categoryFilter, issuedVendorFilter, issuedStatusFilter, issuedSearch]);

  const openIssuedPODetail = (record: IssuedPOViewRecord) => {
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
      timeline: buildIssuedPoTimelineSteps(
        record.status,
        tracking as PoTrackingRecord | undefined,
        ov,
        grnDone,
        record.createdDate,
      ),
    });
  };

  const openPurchaseOrderDetail = (record: IssuedPOViewRecord) => {
    if (record.poWorkflowStatus === 'draft' || record.status === 'Draft') {
      const normKey = (n: string) => String(n ?? '').trim().replace(/^PO-?/i, '').replace(/^DPO-?/i, '');
      const dpo = draftPOs.find((d) => normKey(d.dpoNumber) === normKey(record.poNumber));
      if (dpo) {
        setSelectedDraftPO(dpo);
        return;
      }
    }
    openIssuedPODetail(record);
  };

  const resolveIssuedPoBackendId = (record: {
    backendPoId?: string;
    poNumber?: string;
  }): string => {
    const normPoKey = (n: string) => String(n ?? '').trim().replace(/^PO-?/i, '').replace(/^DPO-?/i, '');
    let backendPoId = record?.backendPoId != null ? String(record.backendPoId).replace(/^PO-/, '').trim() : '';
    if (backendPoId && /^\d+$/.test(backendPoId)) return backendPoId;
    const fromPo =
      purchaseOrders.find(
        (p) =>
          p.status === 'Released' &&
          (normPoKey(p.poNumber ?? '') === normPoKey(record.poNumber ?? '') ||
            normPoKey(String((p as { orderId?: string }).orderId ?? '')) === normPoKey(record.poNumber ?? '')),
      ) ?? null;
    if (fromPo) {
      backendPoId = String(fromPo.id ?? '').replace(/^PO-/, '');
    }
    return backendPoId && /^\d+$/.test(backendPoId) ? backendPoId : '';
  };

  const markIssuedPOVendorConfirmed = (record: {
    backendPoId?: string;
    poNumber?: string;
    request?: { id?: string };
  }) => {
    const backendPoId = resolveIssuedPoBackendId(record);
    if (!backendPoId) {
      addToast('error', 'Purchase order not found. Cannot mark vendor confirmed.');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const prId = String(record?.request?.id ?? '').trim();
    const isUnlinkedPlanning = !prId;
    void updatePoTracking(backendPoId, {
      vendorConfirmedAt: today,
      vendorConfirmedNote: isUnlinkedPlanning
        ? 'Vendor confirmed (unlinked Planning PO) from Procurement'
        : 'Vendor confirmed from Procurement',
    }).then((trackingRes) => {
      if (!trackingRes.success) {
        addToast(
          'error',
          typeof trackingRes.error === 'string'
            ? trackingRes.error
            : (trackingRes.error?.message ?? 'Failed to update PO tracking'),
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['po-tracking', backendPoId] });
      queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });
      addToast('success', `${String(record.poNumber ?? 'PO')} — vendor confirmed`);
    });
  };

  const markIssuedPOShipped = (record: {
    backendPoId?: string;
    poNumber?: string;
    requestCode?: string;
    request?: { id?: string };
  }) => {
    const backendPoId = resolveIssuedPoBackendId(record);
    if (!backendPoId) {
      const requestId = record?.request?.id as string | undefined;
      const requestCode = record?.requestCode as string | undefined;
      if (requestId) {
        void updateRequestStatus(requestId, 'Delivery Pending');
        addToast('info', `${requestCode ?? 'PO'} marked delivery pending — link a released PO to update the timeline.`);
        return;
      }
      addToast('error', 'Purchase order not found. Cannot mark shipped.');
      return;
    }

    const tracking = releasedPoTrackingByBackendId?.[backendPoId];
    if (!hasPoTrackingTimestamp(tracking?.vendorConfirmedAt)) {
      addToast('error', 'Mark vendor confirmed before marking shipped.');
      return;
    }
    if (hasPoTrackingTimestamp(tracking?.shippedAt)) {
      addToast('info', `${String(record.poNumber ?? 'PO')} is already marked shipped.`);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const prId = String(record?.request?.id ?? '').trim();
    const isUnlinkedPlanning = !prId;
    void updatePoTracking(backendPoId, {
      shippedAt: today,
      shippedNote: isUnlinkedPlanning
        ? 'Marked shipped (unlinked Planning PO) from Procurement'
        : 'Marked shipped from Procurement',
    }).then((trackingRes) => {
      if (!trackingRes.success) {
        addToast(
          'error',
          typeof trackingRes.error === 'string'
            ? trackingRes.error
            : (trackingRes.error?.message ?? 'Failed to update PO tracking'),
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['po-tracking', backendPoId] });
      queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
      void queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
      if (isUnlinkedPlanning) {
        setUnlinkedPoTimelineOverrides((prev) => ({
          ...prev,
          [backendPoId]: {
            shipped: true,
            delivered: prev[backendPoId]?.delivered ?? false,
            underGrn: prev[backendPoId]?.underGrn ?? false,
          },
        }));
      }
      addToast('success', `${String(record.poNumber ?? 'PO')} marked shipped`);
    });
  };

  const receiveIssuedPOGRN = async (
    record: {
      poNumber?: string;
      vendor?: string;
      requestCode?: string;
      lineItems?: Array<Record<string, unknown>>;
      request?: { id?: string; type?: RequestType };
      backendPoId?: string;
    },
    scope?: { lineIndex?: number; allLines?: boolean },
  ) => {
    const requestId = record?.request?.id as string | undefined;
    const requestCode = record?.requestCode as string | undefined;
    const poNo = String(record?.poNumber ?? '').trim();
    const allLineItems = Array.isArray(record.lineItems) ? record.lineItems : [];
    const scopedLineIndex =
      scope?.lineIndex != null && Number.isFinite(scope.lineIndex) ? scope.lineIndex : null;
    const lineEntries =
      scopedLineIndex != null
        ? allLineItems[scopedLineIndex]
          ? [{ line: allLineItems[scopedLineIndex], idx: scopedLineIndex }]
          : []
        : allLineItems.map((line, idx) => ({ line, idx }));

    if (!poNo) {
      addToast('error', 'PO not found. Cannot mark delivered.');
      return;
    }

    if (scopedLineIndex != null && lineEntries.length === 0) {
      addToast('error', 'Line item not found on this PO.');
      return;
    }

    const lockKey = scopedLineIndex != null ? `${poNo}::L${scopedLineIndex}` : poNo;

    if (receiveGrnLockRef.current[lockKey]) {
      addToast('info', scopedLineIndex != null ? 'GRN creation already in progress for this item.' : 'GRN creation already in progress for this PO.');
      return;
    }

    receiveGrnLockRef.current[lockKey] = true;
    try {
      const splitLegacyMultiLineGrnsForPo = async (backendPoId: string) => {
        const existingGrns = await fetchGRNList();
        const poGrns = existingGrns.filter(
          (g) => normPoNumberKeyForTimeline(g.poNo || '') === normPoNumberKeyForTimeline(record.poNumber)
        );
        for (const g of poGrns) {
          const lines = Array.isArray(g.lineItems) ? g.lineItems : [];
          if (lines.length <= 1) continue;
          // Splitting a multi-line GRN that is already GRN Complete would clone "Complete" rows without
          // running warehouse inventory apply (only the PUT transition does). Skip — warehouse owns that case.
          if (String(g.status || '').trim() === 'GRN Complete') continue;
          const first = lines[0];
          await updateGRN(String(g.id), { lineItems: [first] });
          for (let i = 1; i < lines.length; i += 1) {
            const li = lines[i];
            await createGRN({
              grnNo: `GRN-${record.poNumber}-${li.itemCode || i + 1}-${Date.now()}-${i}`,
              purchase_order_id: parseInt(backendPoId, 10),
              poNo: g.poNo || record.poNumber,
              vendor: g.vendor || record.vendor,
              type: g.type as 'RM' | 'PM',
              items: 1,
              poValue: Number(li.unitPrice || 0) * Number(li.poQty || 0),
              status: g.status || 'Under GRN',
              receivedDate: g.receivedDate ?? null,
              lineItems: [li],
            });
          }
        }
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
        await splitLegacyMultiLineGrnsForPo(backendPoId);

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
          const normalizedLines = lineEntries.map(({ line, idx }) => {
            // Pass the draft line's FK into the matcher so PR lookup is FK-first (matchBackend
            // falls back to name/code only when no FK is set). Without this, mixed-type POs
            // routed every PM line through the same name-only path and any subtle mismatch
            // selected the wrong PR item.
            const draftRm = line?.raw_material_id != null ? Number(line.raw_material_id) : undefined;
            const draftPm = line?.pack_material_id != null ? Number(line.pack_material_id) : undefined;
            const prItem =
              matchBackendPrItemForDraftLine(
                {
                  item: String(line.item ?? ''),
                  itemCode: String(line.itemCode ?? ''),
                  type: (line?.type ?? record.request?.type ?? 'RM') as RequestType,
                  qty: String(line.qty ?? ''),
                  pricePerUnit: Number(line.pricePerUnit) || 0,
                  gstPercent: Number(line.gstPercent) || 18,
                  gstAmount: Number(line.gstAmount) || 0,
                  lineTotal: Number(line.lineTotal) || 0,
                  ...(Number.isFinite(draftRm) ? { raw_material_id: draftRm } : {}),
                  ...(Number.isFinite(draftPm) ? { pack_material_id: draftPm } : {}),
                },
                items
              ) ?? items[idx];
            // Explicit FK from the draft line always wins. PR items only fill in the gap when
            // the draft PO didn't carry one.
            const resolvedRmId = Number.isFinite(draftRm)
              ? draftRm
              : (prItem?.raw_material_id != null ? Number(prItem.raw_material_id) : undefined);
            const resolvedPmId = Number.isFinite(draftPm)
              ? draftPm
              : (prItem?.pack_material_id != null ? Number(prItem.pack_material_id) : undefined);
            // PM lines never carry raw_material_id and RM lines never carry pack_material_id —
            // mutually exclude them so a stale id from the other side cannot reach the GRN.
            const finalRmId = resolvedPmId != null ? undefined : resolvedRmId;
            const finalPmId = resolvedRmId != null ? undefined : resolvedPmId;
            return {
              id: `line-${idx}`,
              item: String(line.item ?? prItem?.name ?? ''),
              itemCode: resolveItemCodeFromSources(
                [line.itemCode, prItem?.code, line.item, prItem?.name],
                (line?.type ?? record.request?.type ?? 'RM') as RequestType,
                idx
              ),
              poQty: Number(line.qty) || 0,
              rcvdQty: 0,
              invoiceQty: 0,
              unitPrice: Number(line.pricePerUnit) || 0,
              diff: 0,
              qcStatus: 'Pending',
              qcBy: '',
              raw_material_id: finalRmId,
              pack_material_id: finalPmId,
              product_id: prItem?.product_id,
            };
          });
          const existingGrns = await fetchGRNList();
          const existingLineKeys = new Set(
            existingGrns
              .filter((g) => normPoNumberKeyForTimeline(g.poNo || '') === normPoNumberKeyForTimeline(record.poNumber))
              .flatMap((g) => (Array.isArray(g.lineItems) ? g.lineItems : []))
              .map((li) => String(li.itemCode || '').trim().toUpperCase())
              .filter(Boolean)
          );
          for (let idx = 0; idx < normalizedLines.length; idx += 1) {
            const line = normalizedLines[idx];
            const sourceLine = lineEntries[idx]?.line;
            const lineKey = String(line.itemCode || '').trim().toUpperCase();
            if (lineKey && existingLineKeys.has(lineKey)) continue;
            await createGRN({
              grnNo: `GRN-${record.poNumber}-${line.itemCode || idx + 1}-${Date.now()}`,
              purchase_order_id: parseInt(backendPoId, 10),
              poNo: record.poNumber,
              vendor: record.vendor,
              type: (sourceLine?.type ?? record.request?.type ?? 'RM') as 'RM' | 'PM',
              items: 1,
              poValue: Number(line.unitPrice || 0) * Number(line.poQty || 0),
              status: 'Under GRN',
              receivedDate: today,
              lineItems: [line],
            });
            existingLineKeys.add(lineKey);
            grnCreated = true;
          }
          if (!grnCreated) {
            addToast('info', 'GRN already exists for these PO items. Skipping duplicate creation.');
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
            ? scopedLineIndex != null
              ? `${lineEntries[0]?.line?.item ?? 'Item'} on ${requestCode ?? record.poNumber} marked at WH — GRN created.`
              : `${requestCode ?? record.poNumber} marked delivered at WH. GRN created — see Warehouse > Inbound.`
            : scopedLineIndex != null
              ? `${lineEntries[0]?.line?.item ?? 'Item'} already has a GRN on this PO.`
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
      await splitLegacyMultiLineGrnsForPo(backendPoId);
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
        const rawItemsForGrn = Array.isArray(linkedPO?.rawItems) ? (linkedPO!.rawItems as any[]) : [];
        const normalizedLines = lineEntries.map(({ line, idx }) => {
          const raw = rawItemsForGrn[idx] ?? {};
          // Prefer the explicit FK from the draft line; fall back to the matching PO raw item
          // only when the draft didn't carry one. Mutually exclude RM/PM so a PM line cannot
          // also stamp a raw_material_id (this was the "PM shows as AQUA" contamination).
          const lineRm = line?.raw_material_id != null ? Number(line.raw_material_id) : NaN;
          const linePm = line?.pack_material_id != null ? Number(line.pack_material_id) : NaN;
          const fromRaw = resolveMasterIdsFromRawItem(raw);
          const rmId = Number.isFinite(lineRm) && lineRm > 0 ? lineRm : (fromRaw.raw_material_id ?? undefined);
          const pmId = Number.isFinite(linePm) && linePm > 0 ? linePm : (fromRaw.pack_material_id ?? undefined);
          const finalRmId = pmId != null ? undefined : rmId;
          const finalPmId = rmId != null ? undefined : pmId;
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
            ...(finalRmId != null ? { raw_material_id: finalRmId } : {}),
            ...(finalPmId != null ? { pack_material_id: finalPmId } : {}),
            ...(fromRaw.product_id != null ? { product_id: fromRaw.product_id } : {}),
          };
        });
        const existingGrns = await fetchGRNList();
        const existingLineKeys = new Set(
          existingGrns
            .filter((g) => normPoNumberKeyForTimeline(g.poNo || '') === normPoNumberKeyForTimeline(record.poNumber))
            .flatMap((g) => (Array.isArray(g.lineItems) ? g.lineItems : []))
            .map((li) => String(li.itemCode || '').trim().toUpperCase())
            .filter(Boolean)
        );
        for (let idx = 0; idx < normalizedLines.length; idx += 1) {
          const line = normalizedLines[idx];
          const sourceLine = lineEntries[idx]?.line;
          const lineKey = String(line.itemCode || '').trim().toUpperCase();
          if (lineKey && existingLineKeys.has(lineKey)) continue;
          await createGRN({
            grnNo: `GRN-${record.poNumber}-${line.itemCode || idx + 1}-${Date.now()}`,
            purchase_order_id: parseInt(backendPoId, 10),
            poNo: record.poNumber,
            vendor: record.vendor,
            type: (sourceLine?.type ?? record.request?.type ?? record.lineItems?.[0]?.type ?? 'RM') as 'RM' | 'PM',
            items: 1,
            poValue: Number(line.unitPrice || 0) * Number(line.poQty || 0),
            status: 'Under GRN',
            receivedDate: today,
            lineItems: [line],
          });
          existingLineKeys.add(lineKey);
          unlinkedGrnCreated = true;
        }
        if (!unlinkedGrnCreated) {
          addToast('info', 'GRN already exists for these PO items. Skipping duplicate creation.');
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
          ? scopedLineIndex != null
            ? `${lineEntries[0]?.line?.item ?? 'Item'} on ${record.poNumber} marked at WH — GRN created.`
            : `${record.poNumber} marked delivered at WH. GRN created — see Warehouse > Inbound.`
          : scopedLineIndex != null
            ? `${lineEntries[0]?.line?.item ?? 'Item'} already has a GRN on this PO.`
            : `${record.poNumber} marked delivered at WH. GRN already existed — see Warehouse > Inbound.`,
      );
    } finally {
      delete receiveGrnLockRef.current[lockKey];
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
    const reqForAction = requests.find((r) => r.id === requestId);
    if (reqForAction && isStockCheckPendingForRequest(reqForAction)) {
      addToast('warning', 'Stock check is pending. Draft PO creation is locked until warehouse sends stock status.');
      return false;
    }
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

    let itemsListPrices: { name: string; itemId?: string; pricePerUnit: number; leadTimeDays?: number }[] = [];
    if (vendorId && vendor !== 'Unassigned') {
      const res = await fetchQuoteLineDefaults(parseInt(requestId, 10), parseInt(String(vendorId), 10));
      if (res.success && res.data?.items?.length) {
        itemsListPrices = res.data.items.map((i) => ({
          name: i.name ?? '',
          itemId: i.itemId,
          pricePerUnit: Number(i.pricePerUnit) || 0,
          leadTimeDays: normalizeLeadTimeDays(i.leadTimeDays ?? (i as { lead_time_days?: unknown }).lead_time_days),
        }));
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
      let itemsListLead: number | undefined;
      if (itemsListPrices.length > 0) {
        const byIndex = itemsListPrices[idx];
        const byName = itemsListPrices.find((p) => (p.name || '').trim().toLowerCase() === String(it.name ?? '').trim().toLowerCase());
        const byCode = itemsListPrices.find((p) => ((p.itemId ?? p.name) || '').trim().toLowerCase() === String(it.code ?? '').trim().toLowerCase());
        const picked = byIndex ?? byName ?? byCode;
        itemsListLead = picked?.leadTimeDays;
        if (pricePerUnit === 0) {
          pricePerUnit = picked?.pricePerUnit ?? 0;
        }
      }
      const gstPercent = 18;
      const subtotal = qty * pricePerUnit;
      const gstAmount = parseFloat((subtotal * (gstPercent / 100)).toFixed(2));
      const lineTotal = parseFloat((subtotal + gstAmount).toFixed(2));
      const leadTimeDays = resolveDraftLineLeadTimeDays({
        prLine: it,
        quoteLineLead: matchedLine?.leadTimeDays,
        itemsListLead,
        quoteHeaderLead: quoteToUse?.leadTimeDays,
      });
      return {
        item: it.name ?? it.code ?? 'Item',
        itemCode: requestType === 'PM' ? `EI-PM-${String(idx + 1).padStart(3, '0')}` : `EI-RM-${String(idx + 1).padStart(3, '0')}`,
        type: requestType,
        qty: String(it.quantity_requested ?? 0),
        leadTimeDays,
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
        const ld = normalizeLeadTimeDays(l.leadTimeDays);
        return {
          itemName: l.item,
          itemCode: l.itemCode,
          quantity: l.qty,
          rate: String(l.pricePerUnit),
          tax: String(l.gstPercent || 18),
          ...(ld !== undefined ? { lead_time_days: ld } : {}),
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
    void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    lastDraftPOsFromApiKeyRef.current = '';
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

  const openDeleteDraftPOConfirm = (draft: DraftPO): void => {
    const backendPoId = String(draft.backendPoId ?? '').replace(/^PO-/, '').trim();
    if (!backendPoId || !/^\d+$/.test(backendPoId)) {
      addToast('error', 'This draft PO is not saved on the server yet. Refresh the page and try again.');
      return;
    }

    const serverPo = purchaseOrders.find(
      (p) => String(p.id ?? '').replace(/^PO-/, '').trim() === backendPoId
    );
    if (serverPo && String(serverPo.status ?? '').trim().toLowerCase() === 'released') {
      addToast('warning', 'Released purchase orders cannot be deleted here.');
      return;
    }

    setDraftPoDeleteConfirmTarget(draft);
  };

  const confirmDeleteDraftPO = (): void => {
    const draft = draftPoDeleteConfirmTarget;
    if (!draft) return;
    void deleteDraftPO(draft);
  };

  const openDeleteRequestConfirm = (req: ProcurementRequest): void => {
    if (requestStatusShowsIssuedPOs(req.status)) {
      addToast('warning', 'Released or completed requests cannot be deleted.');
      return;
    }
    const hasReleasedPo = purchaseOrders.some((po) => {
      const linkedRequestId = (po.formData as { requestId?: string } | undefined)?.requestId;
      return linkedRequestId === req.id && isIssuedLikePoStatus(po.status);
    });
    if (hasReleasedPo) {
      addToast('warning', 'This request has a released purchase order and cannot be deleted.');
      return;
    }
    setRequestDeleteConfirmTarget(req);
  };

  const confirmDeleteRequest = (): void => {
    const req = requestDeleteConfirmTarget;
    if (!req) return;
    void deleteProcurementRequestFlow(req);
  };

  const deleteProcurementRequestFlow = async (req: ProcurementRequest): Promise<void> => {
    if (requestStatusShowsIssuedPOs(req.status)) {
      addToast('warning', 'Released or completed requests cannot be deleted.');
      return;
    }

    setDeletingRequestId(req.id);
    try {
      const linkedDrafts = draftPOs.filter((d) => d.requestId === req.id);
      for (const draft of linkedDrafts) {
        const backendPoId = String(draft.backendPoId ?? '').replace(/^PO-/, '').trim();
        if (!backendPoId || !/^\d+$/.test(backendPoId)) continue;
        const serverPo = purchaseOrders.find(
          (p) => String(p.id ?? '').replace(/^PO-/, '').trim() === backendPoId,
        );
        if (serverPo && isIssuedLikePoStatus(serverPo.status)) {
          addToast('warning', 'This request has a released purchase order and cannot be deleted.');
          return;
        }
        const delPo = await deletePurchaseOrder(backendPoId);
        if (!delPo.success) {
          addToast(
            'error',
            typeof delPo.error === 'string' ? delPo.error : 'Failed to delete linked draft PO',
          );
          return;
        }
      }

      const del = await deleteProcurementRequestApi(req.id);
      if (!del.success) {
        addToast(
          'error',
          typeof del.error === 'string' ? del.error : 'Failed to delete procurement request',
        );
        return;
      }

      updateProcurementState((current) => ({
        ...current,
        requests: current.requests.filter((r) => r.id !== req.id),
        draftPOs: current.draftPOs.filter((d) => d.requestId !== req.id),
      }));

      if (selectedRequest?.id === req.id) setSelectedRequest(null);
      if (editRequestTarget?.id === req.id) setEditRequestTarget(null);
      if (releaseToPlannedTarget?.request.id === req.id) setReleaseToPlannedTarget(null);

      void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      void invalidatePurchaseOrdersQueries();
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
      void queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
      void queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved', 'by-pe'] });
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });

      addToast(
        'success',
        linkedDrafts.length > 0
          ? `Request ${req.code} and linked draft PO(s) deleted. Quantities return to Planning.`
          : `Request ${req.code} deleted.`,
      );
      setRequestDeleteConfirmTarget(null);
    } finally {
      setDeletingRequestId(null);
    }
  };

  const deleteDraftPO = async (draft: DraftPO): Promise<void> => {
    const backendPoId = String(draft.backendPoId ?? '').replace(/^PO-/, '').trim();
    if (!backendPoId || !/^\d+$/.test(backendPoId)) {
      addToast('error', 'This draft PO is not saved on the server yet. Refresh the page and try again.');
      return;
    }

    const serverPo = purchaseOrders.find(
      (p) => String(p.id ?? '').replace(/^PO-/, '').trim() === backendPoId
    );
    if (serverPo && String(serverPo.status ?? '').trim().toLowerCase() === 'released') {
      addToast('warning', 'Released purchase orders cannot be deleted here.');
      return;
    }

    setDeletingDraftPoId(draft.id);
    try {
      const backendRequestId = resolveBackendProcurementRequestId(draft);
      const prRow = backendRequestId
        ? backendPrArray.find((p) => String(p.id) === backendRequestId)
        : undefined;
      let linkedPrRemoved = false;

      if (prRow) {
        const hasOtherDraft = requestHasOtherDraftPurchaseOrder(
          backendRequestId,
          purchaseOrders,
          backendPoId
        );
        const hasQuote = quotes.some((q) => q.requestId === backendRequestId);
        const plan = planDraftPoDeleteProcurementCleanup(
          draft,
          prRow,
          hasOtherDraft,
          hasQuote
        );

        if (plan.kind === 'delete-parent') {
          const delPr = await deleteProcurementRequestApi(backendRequestId);
          if (!delPr.success) {
            addToast(
              'error',
              typeof delPr.error === 'string'
                ? delPr.error
                : 'Could not remove the linked procurement request. Draft PO was not deleted.'
            );
            return;
          }
          linkedPrRemoved = true;
        } else {
          const prUpd = await updateProcurementRequestApi(backendRequestId, {
            items: plan.items,
            status: plan.status,
          });
          if (!prUpd.success) {
            addToast(
              'error',
              typeof prUpd.error === 'string'
                ? prUpd.error
                : 'Could not update the linked procurement request. Draft PO was not deleted.'
            );
            return;
          }
        }
      }

      const delPo = await deletePurchaseOrder(backendPoId);
      if (!delPo.success) {
        addToast('error', typeof delPo.error === 'string' ? delPo.error : 'Failed to delete draft PO');
        void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
        return;
      }

      updateProcurementState((current) => ({
        draftPOs: current.draftPOs.filter((d) => d.id !== draft.id),
        requests:
          linkedPrRemoved && backendRequestId
            ? current.requests.filter((r) => r.id !== backendRequestId)
            : current.requests,
      }));

      if (selectedDraftPO?.id === draft.id) setSelectedDraftPO(null);
      if (editDraftPOTarget?.id === draft.id) setEditDraftPOTarget(null);
      if (releasePOTarget?.id === draft.id) closeReleasePOModal();

      void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      void invalidatePurchaseOrdersQueries();
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
      void queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
      void queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved', 'by-pe'] });
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });

      addToast(
        'success',
        linkedPrRemoved
          ? `Draft PO ${draft.dpoNumber} deleted; linked procurement request removed — qty available on Planning → Items Involved.`
          : `Draft PO ${draft.dpoNumber} deleted; procurement request updated.`
      );
      setDraftPoDeleteConfirmTarget(null);
    } finally {
      setDeletingDraftPoId(null);
    }
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

  const releaseDraftPOToVendor = async (draftPoId: string): Promise<boolean> => {
    const target = draftPOs.find((draftPo) => draftPo.id === draftPoId);

    if (!target) {
      addToast('warning', 'Draft PO not found');
      return false;
    }

    if (target.status !== 'Approved') {
      addToast('warning', `${target.dpoNumber} must be approved before release`);
      return false;
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
      applyRouteState('Procurement', 'Purchase Orders');
      return true;
    }

    if (DEBUG_PROC_RELEASE) {
      console.log('[PROC-RELEASE] calling updateRequestStatus', {
        backendRequestId,
        status: 'PO Released',
      });
    }
    // Always skip items: PO lines are already persisted on the purchase order; re-sending PR lines can fail MOQ validation
    // and leave procurement_requests.status stuck while the UI still showed release success.
    const ok = await updateRequestStatus(backendRequestId, 'PO Released', { skipItems: true, silentToast: true });
    if (!ok) return false;
    applyRouteState('Procurement', 'Purchase Orders');
    return true;
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

    const linkedReq = requests.find((r) => r.id === target.requestId);
    if (linkedReq && isStockCheckPendingForRequest(linkedReq)) {
      addToast('warning', 'Stock check is pending. PO release is locked until warehouse completes it.');
      return;
    }

    setReleasePOTarget(target);
    setReleaseMethod('Email + Portal');
    setReleaseNotes('');
    setReleasePaymentTransactionNo('');
    setReleasePaymentMode('');
    setReleasePaymentDate(new Date().toISOString().split('T')[0]);
  };

  const closeReleasePOModal = () => {
    if (releasingPO) return;
    setReleasePOTarget(null);
    setReleaseMethod('Email + Portal');
    setReleaseNotes('');
    setReleasePaymentTransactionNo('');
    setReleasePaymentMode('');
    setReleasePaymentDate(new Date().toISOString().split('T')[0]);
  };

  const validateReleasePaymentFields = (required: boolean): string | null => {
    if (!required) return null;
    const txn = releasePaymentTransactionNo.trim();
    if (!txn) return 'Transaction number is required.';
    if (!releasePaymentMode) return 'Mode of payment is required.';
    if (!releasePaymentDate) return 'Payment date is required.';
    return null;
  };

  const buildReleasePaymentTrackingPayload = () => {
    const txn = releasePaymentTransactionNo.trim();
    if (!txn && !releasePaymentMode && !releasePaymentDate) return {};
    const note = `Payment: ${txn} via ${releasePaymentMode} on ${releasePaymentDate}`;
    return {
      paymentTransactionNo: txn,
      paymentMode: releasePaymentMode || null,
      paymentTransactionDate: releasePaymentDate || null,
      advancePaidAt: releasePaymentDate || new Date().toISOString().split('T')[0],
      advancePaidNote: note,
    };
  };

  const validateDraftPoQtyAgainstMoqRemainder = (
    dpoNumber: string,
    draftLines: DraftPOLineItem[],
    assignedPrLines: Array<BackendPRItem | undefined>,
  ): string | null => {
    for (let i = 0; i < draftLines.length; i += 1) {
      const ln = draftLines[i];
      const prLine = assignedPrLines[i];
      const qty = Number(String(ln.qty ?? '').replace(/[^\d.]/g, '')) || 0;
      const orig = Number(prLine?.quantity_requested ?? 0) || 0;
      const moq = Number(prLine?.moq_min ?? 0) || 0;

      if (moq > 0 && qty > 0 && qty < moq) {
        const u = String(prLine?.unit ?? 'KG');
        return `Cannot proceed ${dpoNumber}: ${ln.item || ln.itemCode || 'line'} qty ${formatQtyWithPrimaryUnit(qty, u, 'RM')} is below vendor MOQ ${formatQtyWithPrimaryUnit(moq, u, 'RM')}.`;
      }
      if (orig > 0 && qty > orig) {
        return `Cannot proceed ${dpoNumber}: ${ln.item || ln.itemCode || 'line'} qty ${qty} exceeds open request qty ${orig}.`;
      }
      // Intentionally no check for (orig - qty) < MOQ: small remainders return to the linked PR / new remainder
      // request; MOQ is enforced on procurement request update and Items List, not on this split math.
    }
    return null;
  };

  const recordRequiredPaymentReceivedForPo = async (backendPoIdRaw: string | number | null | undefined) => {
    const backendPoId = String(backendPoIdRaw ?? '').replace(/^PO-/, '').trim();
    if (!backendPoId || !/^\d+$/.test(backendPoId)) {
      addToast('error', 'No server purchase order id on this draft. Refresh or re-save the draft PO.');
      return;
    }
    const paymentErr = validateReleasePaymentFields(true);
    if (paymentErr) {
      addToast('warning', paymentErr);
      return;
    }
    setRecordingAdvancePayment(true);
    try {
      const res = await updatePoTracking(backendPoId, buildReleasePaymentTrackingPayload());
      if (!res.success) {
        addToast('error', typeof res.error === 'string' ? res.error : 'Failed to mark payment received');
        return;
      }
      addToast('success', 'Payment marked as received. You can now issue/release the PO.');
      await queryClient.invalidateQueries({ queryKey: ['po-tracking', 'release-draft', backendPoId] });
      await queryClient.invalidateQueries({ queryKey: ['po-tracking', backendPoId] });
      await queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });
      await queryClient.invalidateQueries({ queryKey: ['treasury-purchase-orders'] });
      void refetchReleaseDraftTracking();
    } finally {
      setRecordingAdvancePayment(false);
    }
  };

  const recordAdvancePaymentForReleaseDraft = async () => {
    await recordRequiredPaymentReceivedForPo(releaseDraftBackendPoIdNormalized);
  };

  const submitReleasePO = async () => {
    if (!releasePOTarget || releasingPO) {
      return;
    }

    const draft = releasePOTarget;
    const paymentErr = validateReleasePaymentFields(draftPaymentTermsRequireAdvance(draft.paymentTerms));
    if (paymentErr) {
      addToast('warning', paymentErr);
      return;
    }

    setReleasingPO(true);
    try {
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
    if (import.meta.env.DEV && !draft.backendPoId) {
      console.warn(
        '[EI po-qty debug] No draft.backendPoId — skipping PUT purchase-orders (items never hit DB; warehouse PO Qty will not change from this release).',
      );
    }
    if (draft.backendPoId) {
      const backendRequestId = resolveBackendProcurementRequestId(draft);
      const prItemsForLines = resolvePrItemsForPurchaseOrderLines(backendPrArray, requestsMapped, {
        backendRequestId,
        draftRequestId: draft.requestId,
        requestCode: draft.requestCode,
      });
      const assignedPrLines = assignPrItemToDraftLines(draft.lineItems, prItemsForLines);
      const releaseQtyErr = validateDraftPoQtyAgainstMoqRemainder(draft.dpoNumber, draft.lineItems, assignedPrLines);
      if (releaseQtyErr) {
        addToast('warning', releaseQtyErr);
        return;
      }
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
      if (import.meta.env.DEV) {
        const pl = poItemsPayload as Record<string, unknown>[];
        console.log('[EI po-qty debug] release → PUT purchase-orders payload', {
          backendPoId: draft.backendPoId,
          prItemsForLinesCount: prItemsForLines.length,
          payloadLineCount: pl.length,
          lines: pl.map((l) => ({
            quantity: l.quantity,
            raw_material_id: l.raw_material_id,
            pack_material_id: l.pack_material_id,
            itemCode: l.itemCode,
          })),
        });
        if (pl.length > 0 && pl.every((l) => l.raw_material_id == null && l.pack_material_id == null)) {
          console.warn(
            '[EI po-qty debug] WARNING: no raw_material_id / pack_material_id on any line — warehouse PO Qty sums only lines with these FKs. Check PR link / assignPrItemToDraftLines.',
          );
        }
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
      if (import.meta.env.DEV && updateResult.data?.items) {
        console.log('[EI po-qty debug] release ← PUT purchase-orders response items', updateResult.data.items);
      }
      const backendPoIdNormalized = String(draft.backendPoId).replace(/^PO-/, '').trim();
      const poReleasedAt = new Date().toISOString().slice(0, 10);
      const releaseNote = [
        releaseMethod ? `Released via ${releaseMethod}` : '',
        releaseNotes?.trim() || '',
      ]
        .filter(Boolean)
        .join(' | ') || 'PO released from Procurement';
      const trackingResult = await updatePoTracking(backendPoIdNormalized, {
        poReleasedAt,
        poReleasedNote: releaseNote,
        ...(draftPaymentTermsRequireAdvance(draft.paymentTerms)
          ? buildReleasePaymentTrackingPayload()
          : {}),
      });
      if (!trackingResult.success) {
        const err = trackingResult.error;
        addToast('error', typeof err === 'string' ? err : (err?.message ?? 'PO released, but tracking timeline update failed'));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['po-tracking', backendPoIdNormalized] });
      await queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });
      await queryClient.invalidateQueries({ queryKey: ['treasury-purchase-orders'] });
      // PO lines + Released status are persisted — warehouse inventory PO Qty column reads from purchase_orders
      if (import.meta.env.DEV) {
        console.log('[EI po-qty debug] invalidateQueries warehouse-inventory (after PO Released + items saved)');
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
    }

    // If payment terms are set, route to Treasury for advance approval
    if (draft.paymentTerms?.trim()) {
      const needsAdvanceTxn = draftPaymentTermsRequireAdvance(draft.paymentTerms);
      globalDispatch({
        type: 'ADD_PO',
        payload: {
          stage: 'treasury',
          po: {
            id: draft.dpoNumber,
            backendPoId: draft.backendPoId,
            vendor: draft.vendor,
            paymentTerms: draft.paymentTerms,
            grandTotal: draft.grandTotal,
            ...(needsAdvanceTxn
              ? {
                  paymentTransactionNo: releasePaymentTransactionNo.trim(),
                  paymentMode: releasePaymentMode,
                  paymentTransactionDate: releasePaymentDate,
                }
              : {}),
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

    const releasePrOk = await releaseDraftPOToVendor(draft.id);
    if (!releasePrOk) {
      addToast(
        'error',
        'Release could not update the linked procurement request. Refresh the page; if the PO shows as released, status may still sync from the server.',
      );
      void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
      return;
    }
    updateProcurementState((current) => ({
      draftPOs: current.draftPOs.filter((d) => d.id !== draft.id),
    }));

    void invalidatePurchaseOrdersQueries();
    if (import.meta.env.DEV) {
      console.log('[EI po-qty debug] invalidateQueries warehouse-inventory (end of submitReleasePO)');
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
    if (draft.paymentTerms?.trim()) {
      addToast('success', `${draft.dpoNumber} released; sent to Treasury for advance.`);
    } else {
      addToast('success', `${draft.dpoNumber} released to vendor.`);
    }

    if (selectedDraftPO?.id === draft.id) {
      setSelectedDraftPO(null);
    }

    closeReleasePOModal();
    } finally {
      setReleasingPO(false);
    }
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
      const prItemsForLines = resolvePrItemsForPurchaseOrderLines(backendPrArray, requestsMapped, {
        backendRequestId,
        draftRequestId: splitPOTarget.requestId,
        requestCode: splitPOTarget.requestCode,
      });
      const fullAssigned = assignPrItemToDraftLines(splitPOTarget.lineItems, prItemsForLines);
      const assignedOne = uniqueIndexes.map((idx) => fullAssigned[idx]);
      const remainingLineIndices = splitPOTarget.lineItems.map((_, i) => i).filter((i) => !uniqueIndexes.includes(i));
      const assignedTwo = remainingLineIndices.map((i) => fullAssigned[i]);

      // Strict MOQ check for split flows: every resulting split line qty must satisfy MOQ.
      const enforceSplitMoq = (
        lines: DraftPOLineItem[],
        assigned: Array<BackendPRItem | null | undefined>,
        splitLabel: string
      ): string | null => {
        for (let i = 0; i < lines.length; i += 1) {
          const ln = lines[i];
          const pr = assigned[i];
          const moq = Number(pr?.moq_min ?? 0) || 0;
          if (moq <= 0) continue;
          const qty = Number(String(ln.qty ?? '').replace(/[^\d.]/g, '')) || 0;
          if (qty > 0 && qty < moq) {
            const u = String(pr?.unit ?? 'KG');
            return `${splitLabel}: ${ln.item || ln.itemCode || 'line'} qty ${formatQtyWithPrimaryUnit(qty, u, 'RM')} is below MOQ ${formatQtyWithPrimaryUnit(moq, u, 'RM')}. Adjust split quantities/items.`;
          }
        }
        return null;
      };

      const splitOneMoqErr = enforceSplitMoq(selectedLineItems, assignedOne, 'Split PO 1');
      if (splitOneMoqErr) {
        addToast('warning', splitOneMoqErr);
        return;
      }
      const splitTwoMoqErr = enforceSplitMoq(remainingLineItems, assignedTwo, 'Split PO 2');
      if (splitTwoMoqErr) {
        addToast('warning', splitTwoMoqErr);
        return;
      }

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

  const closeRecordQuoteModal = () => {
    if (recordQuoteSaving) return;
    setShowRecordQuoteModal(false);
    setRecordQuoteForm({
      vendorId: '',
      quoteDate: '',
      validTill: '',
      leadTimeDays: '',
      notes: '',
      procurementRequestId: '',
      planningQuotationAskId: '',
    });
    setRecordQuoteLines([]);
    setRecordQuoteLineSearch({});
    setRecordQuoteSaving(false);
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
      procurementRequestId: '',
      planningQuotationAskId: '',
    });
    setRecordQuoteLines([]);
    setRecordQuoteLineSearch({});
    setRecordQuoteSaving(false);
    setShowRecordQuoteModal(true);
  };

  const openRecordQuoteFromPlanningAsk = (ask: PlanningQuotationAsk) => {
    if (!vendors.length) {
      addToast('warning', 'Add at least one vendor in Vendor-Client before recording a quote');
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    const lineType: 'RM' | 'PM' = ask.itemType === 'PM' ? 'PM' : 'RM';
    const qty = Number(ask.quantityRequested) || 0;
    const vendorHint = String(ask.vendorHint ?? '').trim();
    const matchedVendor =
      vendorHint.length > 0
        ? vendors.find((v) => v.name.trim().toLowerCase() === vendorHint.toLowerCase())
        : undefined;
    const lines = [
      {
        index: 0,
        itemId: String(ask.itemCode ?? '').trim(),
        name: String(ask.itemName ?? '').trim(),
        uom:
          lineType === 'PM'
            ? String(ask.unit ?? 'PCS')
            : resolveRmPrimaryUnit(
                ask.rawMaterialId != null ? Number(ask.rawMaterialId) : null,
                String(ask.itemCode ?? ''),
                String(ask.unit ?? '')
              ),
        orderQty: String(qty > 0 ? qty : ''),
        pricePerUnit: '',
        totalValue: 0,
        raw_material_id: ask.rawMaterialId != null ? Number(ask.rawMaterialId) : null,
        pack_material_id: ask.packMaterialId != null ? Number(ask.packMaterialId) : null,
        itemType: lineType,
      },
    ];
    setRecordQuoteForm({
      vendorId: matchedVendor?.id ?? vendors[0].id,
      quoteDate: todayStr,
      validTill: '',
      leadTimeDays: '',
      notes: ask.notes
        ? String(ask.notes)
        : `Vendor quotation for Planning · ${ask.itemName ?? 'Material'} (${ask.itemCode ?? '—'})`,
      procurementRequestId: '',
      planningQuotationAskId: String(ask.id),
    });
    setRecordQuoteLines(lines);
    setRecordQuoteLineSearch({});
    setRecordQuoteSaving(false);
    setShowRecordQuoteModal(true);
  };

  const openRecordQuoteFromRequest = (req: ProcurementRequest) => {
    if (!vendors.length) {
      addToast('warning', 'Add at least one vendor in Vendor-Client before recording a quote');
      return;
    }
    const details = req.itemDetails ?? [];
    if (!details.length) {
      addToast('error', 'This request has no line items to quote.');
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    const lines = details.map((d, i) => {
      const lineType: 'RM' | 'PM' = d.type === 'PM' ? 'PM' : 'RM';
      const qty = Number(d.reqQty ?? 0) || 0;
      const price = Number(d.plannedPrice ?? 0) || 0;
      return {
        index: i,
        itemId: String(d.itemCode ?? '').trim(),
        name: String(d.itemName ?? '').trim(),
        uom:
          lineType === 'PM'
            ? String(d.unit ?? 'PCS')
            : resolveRmPrimaryUnit(
                d.raw_material_id != null ? Number(d.raw_material_id) : null,
                String(d.itemCode ?? ''),
                String(d.unit ?? '')
              ),
        orderQty: String(qty > 0 ? qty : ''),
        pricePerUnit: price > 0 ? String(price) : '',
        totalValue: qty * price,
        raw_material_id: d.raw_material_id != null ? Number(d.raw_material_id) : null,
        pack_material_id: d.pack_material_id != null ? Number(d.pack_material_id) : null,
        itemType: lineType,
      };
    });
    setRecordQuoteForm({
      vendorId: vendors[0].id,
      quoteDate: todayStr,
      validTill: '',
      leadTimeDays: '',
      notes: isPlanningQuotationRequest(req)
        ? `Vendor quotation for Planning request ${req.code}`
        : `Quotation for ${req.code}`,
      procurementRequestId: req.id,
      planningQuotationAskId: '',
    });
    setRecordQuoteLines(lines);
    setRecordQuoteLineSearch({});
    setRecordQuoteSaving(false);
    setShowRecordQuoteModal(true);
  };

  const openReleaseToDraftPoForRequest = useCallback(
    (req: ProcurementRequest) => {
      if (isStockCheckPendingForRequest(req)) {
        addToast('warning', 'Stock check is pending. Wait for warehouse response before release actions.');
        return;
      }
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
          moqDisplay: item.moq
            ? `${item.moq} (₹${itemsListSlab0?.unitPrice ?? firstLine?.pricePerUnit ?? 0} · ${itemsListSlab0?.leadDays ?? first?.leadTimeDays ?? 0}d)`
            : '',
          qty: String(item.reqQty ?? 0),
          unitPrice: String(itemsListSlab0?.unitPrice ?? firstLine?.pricePerUnit ?? item.plannedPrice ?? 0),
          paymentTermsType: pt0.type,
          advancePercent: String(
            pt0.advancePercent || (paymentTermsTypeRequiresAdvancePercent(pt0.type) ? 50 : 0)
          ),
          leadTimeDays: itemsListSlab0?.leadDays ?? first?.leadTimeDays ?? item.leadTimeDays ?? 0,
        });
        setReleaseToPlannedNotes('');
        setReleaseToPlannedLineEdits(
          (req.itemDetails ?? []).map((d) => {
            const totalReqQty = Number(d.reqQty ?? 0) || 0;
            const oq = resolveOpenQtyForReleaseItem({
              requestId: req.id,
              reqType: req.type,
              itemName: d.itemName ?? '',
              itemCode: d.itemCode,
              totalReqQty,
              raw_material_id: d.raw_material_id,
              pack_material_id: d.pack_material_id,
              itemType: d.type === 'PM' ? 'PM' : 'RM',
            });
            return {
              itemName: d.itemName ?? '',
              itemCode: d.itemCode ?? '',
              type: d.type === 'PM' ? 'PM' : 'RM',
              originalQty: oq,
              qty: oq,
              unit:
                d.type === 'PM'
                  ? String(d.unit ?? 'PCS')
                  : resolveRmPrimaryUnit(
                      d.raw_material_id != null ? Number(d.raw_material_id) : null,
                      String(d.itemCode ?? ''),
                      String(d.unit ?? '')
                    ),
              moq: Number(d.moq ?? 0) || 0,
              unitPrice: Number(d.plannedPrice ?? 0) || 0,
              leadDays: Number(d.leadTimeDays ?? 0) || 0,
              ...(d.raw_material_id != null ? { raw_material_id: Number(d.raw_material_id) } : {}),
              ...(d.pack_material_id != null ? { pack_material_id: Number(d.pack_material_id) } : {}),
            };
          })
        );
      } else if (req.items && req.items.length > 0) {
        const itemName = req.items[0];
        const qty = req.quantities?.[0] ?? 0;
        const price = req.plannedPrices?.[0] ?? 0;
        const spec = req.specifications?.[0];
        const prRow = backendPrArray.find((p: { id: string }) => String(p.id) === req.id) as
          | { items?: { raw_material_id?: number; pack_material_id?: number; type?: string; code?: string }[] }
          | undefined;
        const line0 = prRow?.items?.[0];
        const line0Type: 'RM' | 'PM' = line0?.type === 'PM' ? 'PM' : 'RM';
        const unit =
          line0Type === 'PM'
            ? String(req.units?.[0] ?? 'PCS')
            : resolveRmPrimaryUnit(
                line0?.raw_material_id != null ? Number(line0.raw_material_id) : null,
                String(line0?.code ?? itemName ?? ''),
                String(req.units?.[0] ?? '')
              );
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
          itemType: line0Type,
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
            pt1.advancePercent || (paymentTermsTypeRequiresAdvancePercent(pt1.type) ? 50 : 0)
          ),
          leadTimeDays: itemsListSlab1?.leadDays ?? first?.leadTimeDays ?? 0,
        });
        setReleaseToPlannedNotes('');
        setReleaseToPlannedLineEdits(
          (req.items ?? []).map((nm, i) => {
            const totalReqQty = Number((req.quantities ?? [])[i] ?? 0) || 0;
            const oq = resolveOpenQtyForReleaseItem({
              requestId: req.id,
              reqType: req.type,
              itemName: String(nm ?? ''),
              itemCode: String(line0?.code ?? ''),
              totalReqQty,
              raw_material_id: line0?.raw_material_id != null ? Number(line0.raw_material_id) : undefined,
              pack_material_id: line0?.pack_material_id != null ? Number(line0.pack_material_id) : undefined,
              itemType: relItem.itemType,
            });
            return {
              itemName: String(nm ?? ''),
              itemCode: String(line0?.code ?? ''),
              type: relItem.itemType === 'PM' ? 'PM' : 'RM',
              originalQty: oq,
              qty: oq,
              unit:
                relItem.itemType === 'PM'
                  ? String((req.units ?? [])[i] ?? 'PCS')
                  : resolveRmPrimaryUnit(
                      line0?.raw_material_id != null ? Number(line0.raw_material_id) : null,
                      String(line0?.code ?? nm ?? ''),
                      String((req.units ?? [])[i] ?? '')
                    ),
              moq: 0,
              unitPrice: Number((req.plannedPrices ?? [])[i] ?? 0) || 0,
              leadDays: 0,
              ...(line0?.raw_material_id != null ? { raw_material_id: Number(line0.raw_material_id) } : {}),
              ...(line0?.pack_material_id != null ? { pack_material_id: Number(line0.pack_material_id) } : {}),
            };
          })
        );
      } else {
        addToast('warning', 'No items on this request.');
      }
    },
    [
      addToast,
      backendPrArray,
      itemsListPm,
      itemsListRm,
      quotes,
      resolveOpenQtyForReleaseItem,
    ]
  );

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
    await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
    addToast('success', `Quotation ${quoteId} deleted`);
  };

  const updateRequestStatus = async (
    requestId: string,
    status: RequestStatus,
    opts?: { skipItems?: boolean; silentToast?: boolean }
  ): Promise<boolean> => {
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
      return false;
    }
    void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    if (status === 'PO Released' || status === 'Delivery Pending') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventory });
      void queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
    }
    lastDraftPOsFromApiKeyRef.current = '';
    updateProcurementState((current) => ({
      requests: current.requests.map((req) => (req.id === requestId ? { ...req, status } : req)),
    }));
    if (!opts?.silentToast) {
      addToast('success', `Request status updated to ${status}`);
    }
    return true;
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
          const qtyNum = parseMoqInput(next.orderQty) ?? 0;
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

  const handleRecordQuoteLineSearchChange = (idx: number, lineIndex: number, value: string) => {
    setRecordQuoteLineSearch((prev) => ({ ...prev, [lineIndex]: value }));
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      handleRecordQuoteLineSelectItem(idx, '');
      return;
    }
    const matched = resolveRecordQuoteLineOption(value);
    if (matched) {
      handleRecordQuoteLineSelectItem(idx, matched.key);
      setRecordQuoteLineSearch((prev) => ({ ...prev, [lineIndex]: matched.label }));
      return;
    }
    setRecordQuoteLines((prev) =>
      prev.map((line, i) =>
        i !== idx
          ? line
          : { ...line, itemType: undefined, raw_material_id: null, pack_material_id: null, itemId: '', name: '', uom: 'KG' }
      )
    );
  };

  const handleRecordQuoteLineItemBlur = (idx: number, lineIndex: number, raw: string) => {
    const matched = resolveRecordQuoteLineOption(raw);
    if (matched) {
      handleRecordQuoteLineSelectItem(idx, matched.key);
      setRecordQuoteLineSearch((prev) => ({ ...prev, [lineIndex]: matched.label }));
    }
  };

  const saveQuotedLinePrice = useCallback(
    async (quote: VendorQuote, line: QuoteLine, lineIndex: number) => {
      const draft = editingQuoteLine;
      if (!draft || draft.quoteId !== quote.id || draft.lineIndex !== lineIndex) return;
      const nextPrice = Number(draft.nextPrice);
      if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
        addToast('warning', 'Enter a valid line price.');
        return;
      }
      if (Math.abs(nextPrice - (Number(line.pricePerUnit) || 0)) < 1e-9) {
        setEditingQuoteLine(null);
        return;
      }
      const nowIso = new Date().toISOString();
      const nextItems = quote.lines.map((l, idx) => {
        const qtyNum = parseFloat(String(l.qty ?? '').replace(/[^\d.]/g, '')) || 0;
        const price = idx === lineIndex ? nextPrice : Number(l.pricePerUnit) || 0;
        const existingHistory = Array.isArray(l.priceHistory) ? l.priceHistory : [];
        const nextHistory =
          idx === lineIndex
            ? [
                ...existingHistory,
                {
                  oldPrice: Number(l.pricePerUnit) || 0,
                  newPrice: nextPrice,
                  changedAt: nowIso,
                  reason: 'Updated from quotation line edit',
                },
              ]
            : existingHistory;
        return {
          itemId: l.itemId ?? '',
          name: l.item ?? '',
          orderQty: qtyNum,
          uom: l.unit ?? (String(l.qty ?? '').replace(/^[\d.\s]+/, '').trim() || 'KG'),
          pricePerUnit: price,
          totalValue: qtyNum * price,
          leadTimeDays: l.leadTimeDays ?? null,
          raw_material_id: l.raw_material_id ?? null,
          pack_material_id: l.pack_material_id ?? null,
          priceHistory: nextHistory,
        };
      });
      setSavingQuoteLine(true);
      try {
        const quoteIdNum = Number(quote.id);
        if (!Number.isFinite(quoteIdNum) || quoteIdNum <= 0) {
          addToast('error', 'Only saved quotations can be edited.');
          return;
        }
        const res = await updateProcurementQuotationApi(quoteIdNum, { items: nextItems });
        if (!res.success) {
          addToast('error', res.error || 'Failed to update quotation line.');
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ['procurement-quotations'] });
        addToast('success', 'Quotation price updated.');
        setEditingQuoteLine(null);
      } finally {
        setSavingQuoteLine(false);
      }
    },
    [addToast, editingQuoteLine, queryClient]
  );

  const showProcurementGlobalLoader =
    procurementQueriesFetching ||
    isProcurementDataLoading ||
    savingQuoteLine ||
    stockCheckSaving ||
    editItemsListLineSaving ||
    recordingAdvancePayment;

  return (
    <div className="min-h-screen bg-[#F7F7F9] text-gray-900">
      <input
        ref={poExcelInputRef}
        type="file"
        accept=".xlsx,.xlsm"
        className="hidden"
        onChange={handlePoExcelChange}
        aria-hidden
      />
      <ProcurementDashboardShell
        mainTab={mainTab}
        onMainTabChange={(tab) => applyRouteState(tab, sideSection)}
        sideSection={sideSection}
        onSideSectionChange={(section) => {
          applyRouteState('Procurement', section);
          if (section === 'GRN Tracker') {
            addToast('info', `${section} synced with procurement data`);
          }
        }}
        sideCounts={sideCounts}
        quoteStats={quoteStats}
        liveSyncTime={liveSyncTime}
        importingPoExcel={importingPoExcel}
        onImportPoExcel={() => poExcelInputRef.current?.click()}
        showGlobalLoader={showProcurementGlobalLoader}
        procurementContent={
          <>
            <div className="space-y-4">
              {false && sideSection === 'Overview' && (() => {
                const TODAY = new Date();
                // Actions Required: same as Requests "Active" — New / Quoted only (excludes PO Draft+)
                const activeRequests = procurementRequestsList.filter((r) => requestStatusIsPreDraftPipeline(r.status));
                const rmRequests = procurementRequestsList.filter(r => r.type === 'RM');
                const pmRequests = procurementRequestsList.filter(r => r.type === 'PM');
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
                        { label: 'NEW REQUESTS', value: procurementRequestsList.filter(r => r.status === 'New').length, sub: 'Awaiting action', color: 'text-yellow-600' },
                        { label: 'RM — RAW MATERIALS', value: rmRequests.length, sub: `${rmRequests.flatMap(r => r.items).length} items · pending action`, color: 'text-cyan-600', badge: 'RM' },
                        { label: 'PM — PACKAGING MATERIALS', value: pmRequests.length, sub: `${pmRequests.flatMap(r => r.items).length} items · pending action`, color: 'text-violet-600', badge: 'PM' },
                        { label: 'ACTIVE POS', value: requests.filter(r => r.status === 'PO Draft' || r.status === 'PO Released').length, sub: 'In pipeline', color: 'text-emerald-600' },
                        { label: 'DELIVERY PENDING GRN', value: requests.filter(r => r.status === 'Delivery Pending').length, sub: null, color: 'text-rose-600' },
                        { label: 'STOCK CHECKS ACTIVE', value: requests.filter(r => r.priority !== 'Low').length, sub: null, color: 'text-yellow-600' },
                        { label: 'PO VALUE (ACTIVE)', value: `₹${activePOValue.toLocaleString('en-IN')}`, sub: null, color: 'text-cyan-600' },
                      ].map(kpi => (
                        <div key={kpi.label} className="flex-1 min-w-32 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
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
                      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                          <h3 className="font-bold text-gray-900">Actions Required</h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {activeRequests.map(req => {
                            const days = computeRequestDaysUntilDue(req, TODAY);
                            const daysDisplay =
                              days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`;
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
                                    <span className="text-xs text-slate-500 font-mono">{daysDisplay}</span>
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
                                  <td className="px-4 py-2 text-xs text-slate-500">{formatDateEnInSafe(req.dueDate)}</td>
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
                                  <td className="px-4 py-2 text-xs text-slate-500">{formatDateEnInSafe(req.dueDate)}</td>
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
                <PrInboxView
                  requests={procurementRequestsList}
                  onEdit={(req) => setPrEditReq(req)}
                  onRequestQuote={(req) => setSelectedRequest(req)}
                  onStockAudit={(req) => {
                    if (isOpenStockCheckStatus(req.stockCheckStatus) || isStockCheckOneTimeCompleted(req)) {
                      openStockCheckModal(req);
                      return;
                    }
                    setStockAuditReq(req);
                  }}
                  onDraftPO={(req) => openReleaseToDraftPoForRequest(req)}
                />
              )}

              {prEditReq && (
                <PrEditPopup
                  req={prEditReq}
                  onClose={() => setPrEditReq(null)}
                  onSave={async (payload) => {
                    const base = prEditReq;
                    const updatedItems = (base.itemDetails ?? []).map((it, idx) =>
                      idx === 0
                        ? { ...it, reqQty: payload.qty, plannedPrice: payload.pricePerUnit, leadTimeDays: payload.leadDays }
                        : it,
                    );
                    const res = await updateProcurementRequestApi(base.id, {
                      items: updatedItems as BackendPRItem[],
                      preferredVendor: payload.vendor,
                    });
                    if (res.success) {
                      await queryClient.refetchQueries({ queryKey: ['procurement-requests'] });
                      addToast('success', `PR ${base.code} updated.`);
                      setPrEditReq(null);
                    } else {
                      addToast('error', typeof res.error === 'string' ? res.error : 'Failed to update PR.');
                    }
                  }}
                />
              )}

              {stockAuditReq && (
                <StockAuditPopup
                  req={stockAuditReq}
                  onClose={() => setStockAuditReq(null)}
                  onSubmit={async (payload) => {
                    const base = stockAuditReq;
                    const res = await updateProcurementRequestApi(base.id, {
                      stockCheckAssignedTo: payload.warehouseCodes.join(', '),
                      stockCheckStatus: 'Pending',
                      stockCheckDueDate: payload.targetDate,
                      stockCheckNotes: payload.comments || null,
                    });
                    if (res.success && res.data) {
                      const rows = coerceProcurementRequestRows(queryClient.getQueryData(['procurement-requests']));
                      const nextRows = rows.some((row) => String(row.id) === String(res.data?.id))
                        ? rows.map((row) => (String(row.id) === String(res.data?.id) ? res.data! : row))
                        : [res.data, ...rows];
                      queryClient.setQueryData(['procurement-requests'], nextRows);
                      await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                      addToast(
                        'success',
                        `Stock check sent to Warehouse for ${base.code} @ ${payload.warehouseCodes.join(', ')} (target ${payload.targetDate}).`,
                      );
                      setStockAuditReq(null);
                      openStockCheckModal(mapBackendPrToRequest(res.data));
                    } else {
                      addToast(
                        'error',
                        typeof res.error === 'string' ? res.error : 'Failed to submit stock audit request.',
                      );
                    }
                  }}
                />
              )}


              {sideSection === 'Quote Requests' && (
                <QuoteRequestsView
                  vendorQuotes={quotesForQuotationsSection}
                  onEditQuote={(quote) => {
                    const req = requests.find((r) => String(r.id) === String(quote.requestId));
                    if (req) openRecordQuoteFromRequest(req);
                  }}
                  onNewQuoteRequest={() => applyRouteState('Procurement', 'Requests')}
                />
              )}

              {false && sideSection === 'Quote Requests' && (
                <div className="space-y-3">
                  {isProcurementDataLoading ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500 shadow-sm">
                      Loading procurement data…
                    </div>
                  ) : (
                    <>
                  {filteredPlanningQuotationAsks.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 px-1">
                        Awaiting vendor quote from Planning ({filteredPlanningQuotationAsks.length})
                      </p>
                      {filteredPlanningQuotationAsks.map((ask) => (
                        <article
                          key={`planning-quote-ask-${ask.id}`}
                          className="rounded-xl border border-amber-300 bg-white shadow-md overflow-hidden"
                        >
                          <div className="px-5 py-3 bg-linear-to-r from-amber-50 via-yellow-50 to-amber-50 border-b border-amber-200">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="px-2.5 py-1 rounded-md bg-amber-500 text-white text-xs font-bold">
                                    Planning
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${requestTypeClass[ask.itemType === 'PM' ? 'PM' : 'RM']}`}
                                  >
                                    {ask.itemType}
                                  </span>
                                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    Awaiting quote
                                  </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">
                                  {ask.itemName ?? 'Material line'}
                                </h3>
                                <p className="text-xs text-slate-600 mt-1">
                                  Add vendor / MOQ on Items List — no procurement request is created
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => openRecordQuoteFromPlanningAsk(ask)}
                                className="px-4 py-2 rounded-lg bg-yellow-400 text-slate-900 font-semibold text-sm hover:bg-yellow-500 shadow-sm"
                              >
                                Record Quote
                              </button>
                            </div>
                          </div>
                          <div className="px-5 py-4">
                            <p className="text-slate-500 uppercase tracking-wide text-xs mb-1">Qty to quote</p>
                            <p className="font-semibold text-slate-900 text-sm">
                              {Number(ask.quantityRequested ?? 0).toLocaleString('en-IN')}{' '}
                              {ask.unit ||
                                (ask.itemType === 'PM'
                                  ? 'PCS'
                                  : resolveRmPrimaryUnit(
                                      ask.raw_material_id != null ? Number(ask.raw_material_id) : null,
                                      ask.itemCode,
                                      ask.unit
                                    ))}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">{ask.itemCode || '—'}</p>
                            {ask.vendorHint ? (
                              <p className="text-xs text-slate-700 mt-2">
                                <span className="font-semibold">Vendor hint:</span> {ask.vendorHint}
                                {ask.moqHint != null && ask.moqHint > 0 ? (
                                  <>
                                    {' '}
                                    · <span className="font-semibold">MOQ:</span>{' '}
                                    {formatQtyWithPrimaryUnit(
                                      ask.moqHint,
                                      ask.unit ||
                                        (ask.itemType === 'PM'
                                          ? 'PCS'
                                          : resolveRmPrimaryUnit(
                                              ask.raw_material_id != null ? Number(ask.raw_material_id) : null,
                                              ask.itemCode,
                                              ''
                                            )),
                                      ask.itemType === 'PM' ? 'PM' : 'RM'
                                    )}
                                  </>
                                ) : null}
                              </p>
                            ) : null}
                            {(ask.planningSoNumber || ask.planningProductName) && (
                              <p className="text-xs text-slate-600 mt-2">
                                {ask.planningSoNumber ? (
                                  <>
                                    <span className="font-semibold">SO</span> {ask.planningSoNumber}
                                    {ask.planningCustomerName ? ` · ${ask.planningCustomerName}` : ''}
                                  </>
                                ) : null}
                                {ask.planningProductName ? (
                                  <span className={ask.planningSoNumber ? ' ml-2' : ''}>
                                    <span className="font-semibold">Product</span> {ask.planningProductName}
                                  </span>
                                ) : null}
                              </p>
                            )}
                            {ask.notes ? (
                              <p className="text-xs text-slate-600 mt-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                                {ask.notes}
                              </p>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {filteredPlanningQuotationRequestsAwaitingQuote.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 px-1">
                        Legacy planning quotation PRs ({filteredPlanningQuotationRequestsAwaitingQuote.length})
                      </p>
                      {filteredPlanningQuotationRequestsAwaitingQuote.map((req) => (
                        <article
                          key={`planning-quote-pending-${req.id}`}
                          className="rounded-xl border border-amber-300 bg-white shadow-md overflow-hidden"
                        >
                          <div className="px-5 py-3 bg-linear-to-r from-amber-50 via-yellow-50 to-amber-50 border-b border-amber-200">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="px-2.5 py-1 rounded-md bg-amber-500 text-white text-xs font-bold">
                                    Planning
                                  </span>
                                  <span className="px-2.5 py-1 rounded-md bg-slate-700 text-white text-xs font-mono font-bold">
                                    {req.code}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${requestTypeClass[req.type]}`}
                                  >
                                    {req.type}
                                  </span>
                                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    Awaiting quote
                                  </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">
                                  {req.items[0] ?? 'Material line'}
                                </h3>
                                <p className="text-xs text-slate-600 mt-1">
                                  Record vendor rates — same flow as <span className="font-semibold">+ Record Quote</span>
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => openRecordQuoteFromRequest(req)}
                                className="px-4 py-2 rounded-lg bg-yellow-400 text-slate-900 font-semibold text-sm hover:bg-yellow-500 shadow-sm"
                              >
                                Record Quote
                              </button>
                            </div>
                          </div>
                          <div className="px-5 py-4">
                            {(req.itemDetails ?? []).map((detail, idx) => (
                              <div key={idx} className="mb-3 last:mb-0">
                                <p className="text-slate-500 uppercase tracking-wide text-xs mb-1">Qty to quote</p>
                                <p className="font-semibold text-slate-900 text-sm">
                                  {Number(detail.reqQty ?? 0).toLocaleString('en-IN')}{' '}
                                  {detail.unit ||
                                    (req.type === 'PM'
                                      ? 'PCS'
                                      : resolveRmPrimaryUnit(
                                          detail.raw_material_id != null ? Number(detail.raw_material_id) : null,
                                          detail.itemCode,
                                          ''
                                        ))}
                                </p>
                                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{detail.itemCode || '—'}</p>
                              </div>
                            ))}
                            {(req.planningSoNumber || req.planningProductName) && (
                              <p className="text-xs text-slate-600 mt-2">
                                {req.planningSoNumber ? (
                                  <>
                                    <span className="font-semibold">SO</span> {req.planningSoNumber}
                                    {req.planningCustomerName ? ` · ${req.planningCustomerName}` : ''}
                                  </>
                                ) : null}
                                {req.planningProductName ? (
                                  <span className={req.planningSoNumber ? ' ml-2' : ''}>
                                    <span className="font-semibold">Product</span> {req.planningProductName}
                                  </span>
                                ) : null}
                              </p>
                            )}
                            {req.notes ? (
                              <p className="text-xs text-slate-600 mt-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                                {req.notes}
                              </p>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {quotesForQuotationsSection.length === 0 &&
                  filteredPlanningQuotationAsks.length === 0 &&
                  filteredPlanningQuotationRequestsAwaitingQuote.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500 shadow-sm">
                      No quotes match current filters.
                    </div>
                  ) : (
                    <>
                  {quotesForQuotationsSection.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                          Recorded quotes & price list
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {quotesForQuotationsSection.length} quote
                          {quotesForQuotationsSection.length === 1 ? '' : 's'} match filters
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <span>Per page</span>
                        <select
                          value={quotationsPageSize}
                          onChange={(e) => {
                            setQuotationsPageSize(Number(e.target.value));
                            setQuotationsPage(1);
                          }}
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 text-xs"
                        >
                          {QUOTATIONS_PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  {pagedQuotesForQuotationsSection.map((quote) => {
                      const isExpanded = expandedQuoteId === quote.id;
                      const linesExpanded = expandedQuoteLineLists[quote.id] ?? false;
                      const lineCount = quote.lines.length;
                      const hasManyLines = lineCount > QUOTATION_VENDOR_LINES_PREVIEW;
                      const hiddenLineCount = hasManyLines ? lineCount - QUOTATION_VENDOR_LINES_PREVIEW : 0;
                      const visibleLineEntries = (
                        hasManyLines && !linesExpanded
                          ? quote.lines
                              .map((line, idx) => ({ line, idx }))
                              .slice(0, QUOTATION_VENDOR_LINES_PREVIEW)
                          : quote.lines.map((line, idx) => ({ line, idx }))
                      );

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
                                <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">
                                    For {quote.requestCode}
                                  </span>
                                  <span>·</span>
                                  <span>{quote.requestType === 'RM' ? 'Raw Material' : 'Packaging Material'}</span>
                                  <span>·</span>
                                  <span>
                                    {lineCount} item{lineCount === 1 ? '' : 's'}
                                  </span>
                                  {quote.quotedOn ? (
                                    <>
                                      <span>·</span>
                                      <span>Quoted {quote.quotedOn.split('-').reverse().join('-')}</span>
                                    </>
                                  ) : null}
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
                                {visibleLineEntries.map(({ line, idx }) => (
                                  <tr key={`${quote.id}-line-${idx}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                          <span className="font-semibold text-slate-900">{line.item}</span>
                                          {(() => {
                                            const hist = Array.isArray(line.priceHistory) ? line.priceHistory : [];
                                            const latest = hist.length > 0 ? hist[hist.length - 1] : null;
                                            if (!latest) return null;
                                            const oldP = Number(latest.oldPrice);
                                            const newP = Number(latest.newPrice);
                                            if (!Number.isFinite(oldP) || !Number.isFinite(newP) || Math.abs(oldP - newP) < 1e-9) return null;
                                            return (
                                              <p className="text-[10px] text-amber-700 mt-0.5">
                                                Previous: ₹{oldP.toLocaleString('en-IN')} {'->'} Now: ₹{newP.toLocaleString('en-IN')}
                                              </p>
                                            );
                                          })()}
                                          {!!line.priceHistory?.length && (
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                              {line.priceHistory.length} price change{line.priceHistory.length !== 1 ? 's' : ''}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {!quote.id.startsWith('IL-') && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setEditingQuoteLine({
                                                  quoteId: quote.id,
                                                  lineIndex: idx,
                                                  nextPrice: String(Number(line.pricePerUnit ?? 0) || ''),
                                                })
                                              }
                                              className="px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
                                            >
                                              Edit Price
                                            </button>
                                          )}
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
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-bold">
                                        {line.qty}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-700">
                                      {editingQuoteLine?.quoteId === quote.id && editingQuoteLine?.lineIndex === idx ? (
                                        <div className="flex items-center justify-end gap-2">
                                          <input
                                            value={editingQuoteLine.nextPrice}
                                            onChange={(e) =>
                                              setEditingQuoteLine((prev) => (prev ? { ...prev, nextPrice: e.target.value } : prev))
                                            }
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs text-right"
                                            disabled={savingQuoteLine}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => void saveQuotedLinePrice(quote, line, idx)}
                                            className="px-2 py-1 rounded-md bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-700 disabled:opacity-60"
                                            disabled={savingQuoteLine}
                                          >
                                            Save
                                          </button>
                                        </div>
                                      ) : (
                                        <>₹{line.pricePerUnit.toLocaleString('en-IN')}</>
                                      )}
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
                          {hasManyLines ? (
                            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/90 flex justify-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedQuoteLineLists((prev) => ({
                                    ...prev,
                                    [quote.id]: !linesExpanded,
                                  }))
                                }
                                className="px-3 py-1.5 rounded-md border border-cyan-300 bg-white text-cyan-800 text-xs font-semibold hover:bg-cyan-50 transition-colors"
                              >
                                {linesExpanded
                                  ? 'Show fewer items'
                                  : `View ${hiddenLineCount} more item${hiddenLineCount === 1 ? '' : 's'}`}
                              </button>
                            </div>
                          ) : null}

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
                                {quote.lines.some((l) => Array.isArray(l.priceHistory) && l.priceHistory.length > 0) && (
                                  <div className="p-3 rounded-lg bg-white border border-slate-200">
                                    <div className="text-xs font-semibold text-slate-600 mb-2">Price change history</div>
                                    <div className="space-y-2">
                                      {quote.lines.map((line, lineIdx) => {
                                        const history = Array.isArray(line.priceHistory) ? [...line.priceHistory].reverse() : [];
                                        if (!history.length) return null;
                                        return (
                                          <div key={`${quote.id}-h-${lineIdx}`} className="rounded-md border border-slate-100 p-2">
                                            <p className="text-xs font-semibold text-slate-700">{line.item}</p>
                                            <div className="mt-1 space-y-1">
                                              {history.map((h, hIdx) => (
                                                <p key={`${quote.id}-${lineIdx}-${hIdx}`} className="text-[11px] text-slate-600">
                                                  ₹{Number(h.oldPrice || 0).toLocaleString('en-IN')} → ₹
                                                  {Number(h.newPrice || 0).toLocaleString('en-IN')}
                                                  {' · '}
                                                  {h.changedAt ? new Date(h.changedAt).toLocaleString('en-IN') : '—'}
                                                  {h.changedBy ? ` · ${h.changedBy}` : ''}
                                                </p>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
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
                    })}
                  {quotesForQuotationsSection.length > 0 && quotationsTotalPages > 1 && (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <Pagination
                        currentPage={quotationsSafePage}
                        totalPages={quotationsTotalPages}
                        onPageChange={setQuotationsPage}
                        totalItems={quotesForQuotationsSection.length}
                        itemsPerPage={quotationsPageSize}
                        variant="compact"
                      />
                    </div>
                  )}
                    </>
                  )}
                    </>
                  )}
                </div>
              )}

              {false && sideSection === 'Draft POs' && (
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
                              applyRouteState('Procurement', 'Purchase Orders');
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
                      <>
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-[11px] tracking-[0.14em] text-slate-500 border-b border-slate-200 bg-slate-50">
                                  <th className="px-3 py-2">Date</th>
                                  <th className="px-3 py-2">Vendor Name</th>
                                  <th className="px-3 py-2">Purchase Order#</th>
                                  <th className="px-3 py-2">Reference#</th>
                                  <th className="px-3 py-2">Vendor Name</th>
                                  <th className="px-3 py-2">Status</th>
                                  <th className="px-3 py-2 text-right">Amount</th>
                                  <th className="px-3 py-2">Delivery Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredDraftPOs.map((dpo) => {
                                  const linkedReq = procurementRequestsList.find((r) => r.id === dpo.requestId);
                                  return (
                                    <tr
                                      key={`draft-row-${dpo.id}`}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setSelectedDraftPO(dpo)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                          event.preventDefault();
                                          setSelectedDraftPO(dpo);
                                        }
                                      }}
                                      className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer"
                                    >
                                      <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">{dpo.createdDate || '—'}</td>
                                      <td className="px-3 py-2 text-xs text-slate-700">{linkedReq?.planningCustomerName || linkedReq?.source || dpo.deliveryAddress || '—'}</td>
                                      <td className="px-3 py-2 text-xs font-mono text-slate-700">{dpo.dpoNumber}</td>
                                      <td className="px-3 py-2 text-xs font-mono font-semibold text-slate-900">{dpo.requestCode || '—'}</td>
                                      <td className="px-3 py-2 text-xs text-slate-700">{dpo.vendor}</td>
                                      <td className="px-3 py-2 text-xs">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
                                          dpo.status === 'Approved'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                        }`}>
                                          {dpo.status}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-right font-semibold text-amber-700">₹{dpo.grandTotal.toLocaleString('en-IN')}</td>
                                      <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">{dpo.expectedDelivery || '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <p className="px-3 py-2 text-[11px] text-slate-500 border-t border-slate-100 bg-slate-50">
                            Click any row to open full draft PO details.
                          </p>
                        </div>
                        {filteredDraftPOs.map((dpo) => (
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
                              type="button"
                              disabled={deletingDraftPoId === dpo.id}
                              onClick={() => openDeleteDraftPOConfirm(dpo)}
                              className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50"
                            >
                              {deletingDraftPoId === dpo.id ? 'Deleting…' : 'Delete'}
                            </button>
                            <button
                              type="button"
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
                      ))}
                      </>
                    )}
                  </div>
                </>
              )}

              {/* Items List tier edit modal (Quotations view writes to Items List) */}
              {editItemsListLineTarget && (
                <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center px-4">
                  <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden">
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
                            step="any"
                            inputMode="decimal"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            disabled={editItemsListLineSaving}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Price / unit (₹)</label>
                        <input
                          value={editItemsListLineForm.pricePerUnit}
                          onChange={(e) => setEditItemsListLineForm((f) => ({ ...f, pricePerUnit: e.target.value }))}
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          disabled={editItemsListLineSaving}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Payment terms
                        </label>
                        <p className="text-[11px] text-slate-500 mb-2">
                          Same three-way split as Items List and vendor masters (advance, pre-shipment, post-shipment, credit days).
                        </p>
                        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                          <table className="w-full max-w-xl text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-left text-slate-600">
                                <th className="px-2 py-1.5 font-semibold border-b border-slate-200">Advance %</th>
                                <th className="px-2 py-1.5 font-semibold border-b border-slate-200">Pre-ship %</th>
                                <th className="px-2 py-1.5 font-semibold border-b border-slate-200">Post-ship %</th>
                                <th className="px-2 py-1.5 font-semibold border-b border-slate-200">Credit days</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="px-2 py-1.5 border-t border-slate-100">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editItemsListLineForm.advancePct}
                                    onChange={(e) =>
                                      setEditItemsListLineForm((f) => ({ ...f, advancePct: e.target.value }))
                                    }
                                    className="w-full min-w-[4rem] rounded border border-slate-300 px-2 py-1 text-sm tabular-nums"
                                    disabled={editItemsListLineSaving}
                                  />
                                </td>
                                <td className="px-2 py-1.5 border-t border-slate-100">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editItemsListLineForm.preShipmentPct}
                                    onChange={(e) =>
                                      setEditItemsListLineForm((f) => ({ ...f, preShipmentPct: e.target.value }))
                                    }
                                    className="w-full min-w-[4rem] rounded border border-slate-300 px-2 py-1 text-sm tabular-nums"
                                    disabled={editItemsListLineSaving}
                                  />
                                </td>
                                <td className="px-2 py-1.5 border-t border-slate-100">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editItemsListLineForm.postShipmentPct}
                                    onChange={(e) =>
                                      setEditItemsListLineForm((f) => ({ ...f, postShipmentPct: e.target.value }))
                                    }
                                    className="w-full min-w-[4rem] rounded border border-slate-300 px-2 py-1 text-sm tabular-nums"
                                    disabled={editItemsListLineSaving}
                                  />
                                </td>
                                <td className="px-2 py-1.5 border-t border-slate-100">
                                  <input
                                    type="number"
                                    min={0}
                                    value={editItemsListLineForm.creditDays}
                                    onChange={(e) =>
                                      setEditItemsListLineForm((f) => ({ ...f, creditDays: e.target.value }))
                                    }
                                    className="w-full min-w-[4rem] rounded border border-slate-300 px-2 py-1 text-sm tabular-nums"
                                    disabled={editItemsListLineSaving}
                                  />
                                </td>
                              </tr>
                            </tbody>
                          </table>
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

              {sideSection === 'Purchase Orders' && (
                <>
                  {requestsPODraftNoDraftPO.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Marked PO Draft — open PR to create Draft PO</p>
                      {requestsPODraftNoDraftPO.map((req) => (
                        <article key={req.id} className="rounded-xl border border-amber-200 bg-amber-50/50 px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">{req.code}</span>
                            <span className="text-sm text-slate-700">No draft PO yet</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(req)}
                            className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition"
                          >
                            Open PR & create Draft PO
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                  <PurchaseOrdersView
                    records={filteredPurchaseOrderRecords}
                    grnList={grnListFromApi ?? []}
                    vendorOptions={Array.from(new Set(purchaseOrderViewRecords.map((r) => r.vendor))).sort((a, b) =>
                      a.localeCompare(b, undefined, { sensitivity: 'base' }),
                    )}
                    onOpenDetail={openPurchaseOrderDetail}
                    onEdit={openPurchaseOrderDetail}
                    onShipmentCreated={() => {
                      void queryClient.invalidateQueries({ queryKey: ['grn-list'] });
                      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
                      addToast('success', 'Shipment batch + GRN(s) created — moved to In Transit.');
                    }}
                    onOpenGrnForPo={() => applyRouteState('Procurement', 'GRN Tracker')}
                  />
                </>
              )}


              {sideSection === 'GRN Tracker' && <GrnTrackerView />}

              {sideSection === 'Stock Audit' && (
                <StockAuditTrackerView
                  requests={procurementRequestsList}
                  onOpenPr={(pr) => setPrEditReq(pr)}
                />
              )}

            </div>
          </>
        }
      />

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

        const data = poTrackingData ?? poTrackingForm;
        const backendIdNorm = po.backendPoId ? String(po.backendPoId).replace(/^PO-/, '') : '';
        const ovModal = backendIdNorm ? unlinkedPoTimelineOverrides[backendIdNorm] : undefined;
        const grnDoneModal = po.poNumber ? grnCompletePoNormSet.has(normPoNumberKeyForTimeline(po.poNumber)) : false;
        /** Same 7-stage rules as Issued PO cards (no separate "Order Tracking" row — LR/ref stays in Update status). */
        const timelineSteps: POTimelineStep[] = po.backendPoId
          ? buildIssuedPoTimelineSteps(
              po.status,
              (data as PoTrackingRecord) || undefined,
              ovModal,
              grnDoneModal,
              po.date,
            )
          : [];

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
                            {step.timestamp && (
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {(() => {
                                  const d = new Date(String(step.timestamp));
                                  return Number.isNaN(d.getTime()) ? String(step.timestamp) : d.toLocaleString('en-IN');
                                })()}
                              </p>
                            )}
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
                    {(() => {
                      const modalTr = (data ?? poTrackingForm) as PoTrackingRecord | undefined;
                      const modalHasVendor = hasPoTrackingTimestamp(modalTr?.vendorConfirmedAt);
                      const modalHasShipped =
                        hasPoTrackingTimestamp(modalTr?.shippedAt) || Boolean(ovModal?.shipped);
                      const issuedRecordForActions = {
                        backendPoId: po.backendPoId,
                        poNumber: po.poNumber,
                        requestCode: po.requestCode,
                        request: po.requestId ? { id: po.requestId } : undefined,
                      };
                      return (
                        <div className="flex flex-wrap gap-2 pb-1">
                          {!modalHasVendor && (
                            <button
                              type="button"
                              onClick={() => markIssuedPOVendorConfirmed(issuedRecordForActions)}
                              className="px-3 py-1.5 rounded-lg border border-cyan-500 bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-700"
                            >
                              Mark Vendor Confirmed
                            </button>
                          )}
                          {modalHasVendor && !modalHasShipped && (
                            <button
                              type="button"
                              onClick={() => markIssuedPOShipped(issuedRecordForActions)}
                              className="px-3 py-1.5 rounded-lg border border-amber-500 bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600"
                            >
                              Mark In Transit
                            </button>
                          )}
                        </div>
                      );
                    })()}
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
                    onClick={() => { setSelectedPO(null); applyRouteState('Procurement', 'GRN Tracker'); }}
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

      {/* ── GRN Monitor detail (warehouse API) ── */}
      {selectedGrnMonitor && (
        <GrnMonitorDetailPanel
          grn={selectedGrnMonitor}
          loading={grnMonitorDetailLoading}
          onClose={() => setSelectedGrnMonitor(null)}
        />
      )}

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
                  type="button"
                  disabled={deletingDraftPoId === dpo.id}
                  onClick={() => openDeleteDraftPOConfirm(dpo)}
                  className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50"
                >
                  {deletingDraftPoId === dpo.id ? 'Deleting…' : 'Delete draft PO'}
                </button>
                <button
                  type="button"
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
                    {draftPaymentTermsRequireAdvance(dpo.paymentTerms) && (
                      <button
                        onClick={() => void recordRequiredPaymentReceivedForPo(dpo.backendPoId)}
                        disabled={recordingAdvancePayment || !String(dpo.backendPoId ?? '').trim()}
                        title={!String(dpo.backendPoId ?? '').trim() ? 'Draft PO must be synced to server first' : undefined}
                        className="px-4 py-2 rounded-lg border border-amber-300 text-amber-800 bg-amber-50 text-sm font-semibold hover:bg-amber-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {recordingAdvancePayment ? 'Saving…' : 'Received Payment (Temp)'}
                      </button>
                    )}
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
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-6"
          onClick={() => {
            if (!releasingPO) closeReleasePOModal();
          }}
        >
          <div
            className="relative my-auto flex max-h-[calc(100svh-2rem)] w-full max-w-3xl min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            {releasingPO ? (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-white/90 backdrop-blur-[1px]"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 className="h-9 w-9 text-emerald-600 animate-spin" aria-hidden />
                <p className="mt-2 text-sm font-semibold text-slate-800">Releasing PO…</p>
                <p className="mt-1 text-[11px] text-slate-500">Please wait for the server response</p>
              </div>
            ) : null}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <h3 className="text-lg font-bold text-slate-900">Release PO — {releasePOTarget.dpoNumber}</h3>
              <button
                type="button"
                onClick={closeReleasePOModal}
                disabled={releasingPO}
                className="h-7 w-7 shrink-0 rounded-md border border-slate-300 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pt-4 [scrollbar-gutter:stable]">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                You are about to release a PO to <span className="font-bold">{releasePOTarget.vendor}</span> for <span className="font-bold">₹{releasePOTarget.grandTotal.toLocaleString('en-IN')}</span>.
              </div>

              <div>
                <label className="block text-[10px] tracking-widest uppercase text-slate-500 mb-1">Payment terms</label>
                <PaymentTermsDisplay value={releasePOTarget.paymentTerms} />
              </div>

              {releaseDraftRequiresAdvance && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-3">
                  <p className="text-xs font-semibold text-slate-800">Payment transaction</p>
                  <p className="text-[11px] text-slate-600">
                    Required for advance payment terms. Record how the advance was paid — shown in Treasury with the PO.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] tracking-widest uppercase text-slate-500 mb-1">Transaction no.</label>
                      <input
                        value={releasePaymentTransactionNo}
                        onChange={(e) => setReleasePaymentTransactionNo(e.target.value)}
                        placeholder="e.g. UTR / cheque no."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] tracking-widest uppercase text-slate-500 mb-1">Mode of payment</label>
                      <select
                        value={releasePaymentMode}
                        onChange={(e) => setReleasePaymentMode(e.target.value as ReleasePaymentMode | '')}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        <option value="">Select mode</option>
                        {RELEASE_PAYMENT_MODES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] tracking-widest uppercase text-slate-500 mb-1">Payment date</label>
                      <input
                        type="date"
                        value={releasePaymentDate}
                        onChange={(e) => setReleasePaymentDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              )}

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
                    <div className="text-emerald-800 font-medium space-y-1">
                      <p>
                        Advance recorded
                        {releaseDraftTracking?.advancePaidAt
                          ? ` (${new Date(releaseDraftTracking.advancePaidAt).toLocaleDateString('en-IN')})`
                          : ''}
                        . You may release the PO.
                      </p>
                      {releaseDraftTracking?.paymentTransactionNo && (
                        <p className="text-xs text-emerald-900">
                          Txn {releaseDraftTracking.paymentTransactionNo} · {releaseDraftTracking.paymentMode} ·{' '}
                          {releaseDraftTracking.paymentTransactionDate
                            ? new Date(releaseDraftTracking.paymentTransactionDate).toLocaleDateString('en-IN')
                            : '—'}
                        </p>
                      )}
                    </div>
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
                        {recordingAdvancePayment ? 'Saving…' : 'Received Payment (Temp)'}
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
              </div>

              <div className="flex min-h-0 shrink-0 flex-col px-5 pb-4 pt-2">
                <div className="flex max-h-[min(22rem,42svh)] min-h-[6.5rem] flex-col overflow-hidden rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <p className="mb-1 shrink-0 font-semibold">Items in this PO ({releasePOTarget.lineItems.length})</p>
                  <ul
                    className="min-h-0 flex-1 list-disc space-y-0.5 overflow-y-scroll overscroll-y-contain pl-4 pr-2 [scrollbar-gutter:stable]"
                    aria-label="Line items in this purchase order"
                  >
                    {releasePOTarget.lineItems.map((line, index) => (
                      <li key={`${line.itemCode}-${index}`} className="break-words py-0.5">
                        {line.item}: {line.qty} @ ₹{line.pricePerUnit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => void submitReleasePO()}
                disabled={
                  releasingPO ||
                  (releaseDraftRequiresAdvance &&
                    (!releaseDraftBackendPoIdNormalized ||
                      !advanceRecordedForReleaseDraft ||
                      releaseDraftTrackingLoading))
                }
                title={
                  releaseDraftRequiresAdvance && !advanceRecordedForReleaseDraft && releaseDraftBackendPoIdNormalized
                    ? 'Record advance payment before releasing'
                    : undefined
                }
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 min-w-[7.5rem]"
              >
                {releasingPO ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Releasing…
                  </>
                ) : (
                  'Release PO'
                )}
              </button>
              <button
                type="button"
                onClick={closeReleasePOModal}
                disabled={releasingPO}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
        const stockCheckPending = isStockCheckPendingForRequest(req);
        const canReleasePO = req.status === 'PO Draft' && !stockCheckPending;

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
                  {req.stockCheckStatus ? (
                    <span
                      className={`text-xs px-2.5 py-1 rounded-md font-bold border ${
                        isStockCheckPendingForRequest(req)
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : String(req.stockCheckStatus).trim().toLowerCase() === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-sky-50 text-sky-700 border-sky-200'
                      }`}
                    >
                      Stock Check: {req.stockCheckStatus}
                    </span>
                  ) : null}
                  {parseStockCheckOutcome(req.stockCheckNotes) === 'not_ok' ? (
                    <span className="text-xs px-2.5 py-1 rounded-md font-bold border bg-rose-50 text-rose-700 border-rose-200">
                      Warehouse: Not OK
                    </span>
                  ) : parseStockCheckOutcome(req.stockCheckNotes) === 'all_ok' ? (
                    <span className="text-xs px-2.5 py-1 rounded-md font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                      Warehouse: All OK
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex-1 px-6 py-5 space-y-5 bg-slate-50">
                {/* Request Metadata */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-slate-200">
                    <span className="text-slate-600">Request Date</span>
                    <span className="text-slate-900 font-medium">
                      {formatDateEnInSafe(req.createdDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-200">
                    <span className="text-slate-600">Requested By</span>
                    <span className="text-slate-900 font-medium">{req.requestedBy ?? 'Planning Team'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-200">
                    <span className="text-slate-600">Required Date</span>
                    <span className="text-amber-600 font-bold">
                      {formatDateWithIsoWeek(req.dueDate)}
                    </span>
                    {!req.dueDate?.trim() && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Not set — use <strong>Edit Request</strong> below to add a required date.
                      </p>
                    )}
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
                        const modalStockCheckGap = getStockCheckGapForItem(
                          req.stockCheckStatus,
                          req.stockCheckNotes,
                          item.itemCode,
                          item.itemName
                        );
                        const modalGapLineKey = `${req.id}|${item.itemCode}|modal`;
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
                                  <p className="text-slate-900 font-bold">
                                    {item.moq
                                      ? formatQtyWithPrimaryUnit(
                                          item.moq,
                                          item.unit,
                                          item.type === 'PM' ? 'PM' : 'RM'
                                        )
                                      : '—'}
                                  </p>
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
                                  <p className="text-slate-900 font-bold">
                                    {item.leadTimeDays != null && Number.isFinite(item.leadTimeDays) ? `${item.leadTimeDays}d` : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500 uppercase tracking-wide mb-1">Expected</p>
                                  <p className="text-slate-900 font-bold">
                                    {formatDateWithIsoWeek(item.expectedDate || req.dueDate)}
                                  </p>
                                </div>
                                {modalStockCheckGap ? (
                                  <div className="col-span-2">
                                    <p className="text-slate-500 uppercase tracking-wide mb-1">Stock check gap</p>
                                    <p className="text-amber-700 font-bold tabular-nums">
                                      +{modalStockCheckGap.gapQty.toLocaleString('en-IN')} {item.unit}
                                    </p>
                                  </div>
                                ) : null}
                              </div>

                              {modalStockCheckGap ? (
                                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs text-amber-900">
                                    Warehouse reported a shortfall after stock check. Approve to add gap qty to this
                                    request{modalStockCheckGap.consumptionQty != null
                                      ? ` (consumption ${modalStockCheckGap.consumptionQty.toLocaleString('en-IN')} ${item.unit} in audit window)`
                                      : ''}{' '}
                                    and set inventory to the physical count.
                                  </p>
                                  {modalStockCheckGap.gapApproved ? (
                                    <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Gap approved
                                    </span>
                                  ) : modalStockCheckGap.canApprove ? (
                                    <button
                                      type="button"
                                      disabled={approvingGapLineKey === modalGapLineKey}
                                      onClick={async () => {
                                        const auditLine = buildInventoryAuditLines([req]).find(
                                          (l) =>
                                            l.requestId === req.id &&
                                            l.itemCode === item.itemCode &&
                                            l.itemName === item.itemName
                                        );
                                        if (!auditLine) {
                                          addToast('error', 'Could not resolve audit line for gap approval.');
                                          return;
                                        }
                                        setApprovingGapLineKey(modalGapLineKey);
                                        try {
                                          await handleApproveInventoryAuditGap(auditLine);
                                        } finally {
                                          setApprovingGapLineKey(null);
                                        }
                                      }}
                                      className="px-3 py-1.5 rounded-lg border border-amber-400 bg-white text-amber-900 text-xs font-semibold hover:bg-amber-100 disabled:opacity-60"
                                    >
                                      {approvingGapLineKey === modalGapLineKey ? 'Approving…' : 'Approve gap'}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}

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
                        const stockCheckCompleted =
                          String(req.stockCheckStatus ?? '').trim().toLowerCase() === 'completed';
                        if (!stockCheckCompleted) {
                          return [
                            { label: 'Stock In Hand', value: 'Pending stock check completion', color: 'text-slate-500', isPending: true },
                            { label: 'Open PO Qty', value: 'Pending stock check completion', color: 'text-slate-500', isPending: true },
                            { label: 'In Transit', value: 'Pending stock check completion', color: 'text-slate-500', isPending: true },
                            { label: 'Open Orders', value: 'Pending stock check completion', color: 'text-slate-500', isPending: true },
                          ];
                        }
                        const summary = requestStockSummaryByRequestId.get(req.id)
                          ?? req.stockSummary
                          ?? { stockInHand: 0, openPOQty: 0, inTransit: 0, openOrders: 0 };
                        return [
                          { label: 'Stock In Hand', value: summary.stockInHand, color: summary.stockInHand > 100 ? 'text-emerald-600' : 'text-amber-600', isPending: false },
                          { label: 'Open PO Qty', value: summary.openPOQty, color: 'text-slate-900', isPending: false },
                          { label: 'In Transit', value: summary.inTransit, color: summary.inTransit > 0 ? 'text-cyan-600' : 'text-slate-900', isPending: false },
                          { label: 'Open Orders', value: summary.openOrders, color: summary.openOrders > 0 ? 'text-blue-600' : 'text-slate-900', isPending: false },
                        ];
                      })().map((row, idx) => (
                        <div key={row.label} className={`flex items-center justify-between px-4 py-3 ${idx < 3 ? 'border-b border-slate-200' : ''}`}>
                          <span className="text-slate-600 text-sm">{row.label}</span>
                          <span className={`font-bold ${row.isPending ? 'text-sm' : 'text-lg'} ${row.color}`}>{row.value}</span>
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
              <div className="sticky bottom-0 rounded-b-xl bg-slate-50 border-t border-blue-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditRequestTarget(req);
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deletingRequestId === req.id}
                    onClick={() => openDeleteRequestConfirm(req)}
                    className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50"
                  >
                    {deletingRequestId === req.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleStockCheckAction(req)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
                  >
                    Stock Check
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      updateRequestPriority(
                        req.id,
                        req.priority === 'High' ? 'Medium' : req.priority === 'Medium' ? 'Low' : 'High'
                      );
                    }}
                    className="px-4 py-2 rounded-lg border border-blue-300 text-blue-700 text-sm font-semibold hover:bg-blue-50 transition"
                  >
                    Priority
                  </button>

                  <button
                    type="button"
                    onClick={() => openReleaseToDraftPoForRequest(req)}
                    className="px-4 py-2 rounded-lg border border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition"
                  >
                    Release to Draft PO
                  </button>

                  {reqQuotes.length > 0 && selectedQuoteIdInPrView && (
                    <button
                      onClick={async () => {
                        if (stockCheckPending) {
                          addToast('warning', 'Stock check is pending. Draft/PO actions are locked until warehouse sends stock status.');
                          return;
                        }
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
                          applyRouteState('Procurement', 'Purchase Orders');
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition shadow-lg"
                    >
                      Create Draft PO (Quick)
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Required date</label>
                  <input
                    type="date"
                    value={editRequestForm.requiredByDate}
                    onChange={(e) => setEditRequestForm((f) => ({ ...f, requiredByDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    When material is needed by Planning / production. Also sets Items List tier valid-till for the preferred vendor.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
                  <select
                    value={editRequestForm.priority}
                    onChange={(e) =>
                      setEditRequestForm((f) => ({ ...f, priority: e.target.value as RequestPriority }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
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
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Line items — qty, unit & planned price</label>
                  <div className="border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm min-w-[36rem]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Item</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Type</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-700">Qty to request</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Unit</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-700">Price (₹/unit)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editRequestForm.items.map((item, idx) => {
                          const plannedPrice = resolvePlannedUnitPrice(item);
                          return (
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
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="0"
                                value={plannedPrice > 0 ? plannedPrice : ''}
                                onChange={(e) => updateEditRequestItemPrice(idx, e.target.value)}
                                className="w-28 px-2 py-1.5 rounded border border-slate-300 text-right text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                          </tr>
                          );
                        })}
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
                  const savedId = editRequestTarget.id;
                  const savedCode = editRequestTarget.code;
                  if (res.data) {
                    const updated = mapBackendPrToRequest(res.data);
                    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
                    setSelectedRequest((prev) => (prev && prev.id === updated.id ? updated : prev));
                  } else {
                    const savedDue = normalizeDateOnlyString(editRequestForm.requiredByDate) || '';
                    const patchRequest = (r: ProcurementRequest): ProcurementRequest =>
                      r.id === savedId
                        ? { ...r, dueDate: savedDue, priority: editRequestForm.priority }
                        : r;
                    setRequests((prev) => prev.map(patchRequest));
                    setSelectedRequest((prev) => (prev && prev.id === savedId ? patchRequest(prev) : prev));
                  }
                  const prItemsForSync = Array.isArray(editRequestForm.items) ? editRequestForm.items : [];
                  const vendorForSync =
                    editRequestForm.preferredVendor?.trim() ||
                    editRequestTarget.preferredVendor?.trim() ||
                    '';
                  const syncResult = await applyEditRequestSideEffects({
                    requestId: savedId,
                    prItems: prItemsForSync,
                    preferredVendor: vendorForSync,
                    validTill: normalizeDateOnlyString(editRequestForm.requiredByDate) || null,
                    draftPOs,
                    itemsListRm: itemsListRm ?? [],
                    itemsListPm: itemsListPm ?? [],
                    vendors: (vendorClientList ?? [])
                      .filter((v) => v.type === 'vendor')
                      .map((v) => ({ id: v.id, name: v.name })),
                  });

                  if (syncResult.draftPosUpdated > 0) {
                    setDraftPOs((prev) =>
                      prev.map((d) => {
                        if (String(d.requestId) !== String(savedId)) return d;
                        const { lines } = applyDraftPoLinePrices(d, prItemsForSync);
                        const subtotal = lines.reduce((s, l) => s + (l.lineTotal - l.gstAmount), 0);
                        const gstTotal = lines.reduce((s, l) => s + l.gstAmount, 0);
                        return {
                          ...d,
                          lineItems: lines,
                          subtotal: parseFloat(subtotal.toFixed(2)),
                          gstTotal: parseFloat(gstTotal.toFixed(2)),
                          grandTotal: parseFloat((subtotal + gstTotal).toFixed(2)),
                        };
                      })
                    );
                  }

                  await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                  await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
                  await queryClient.invalidateQueries({
                    predicate: (q) =>
                      Array.isArray(q.queryKey) &&
                      typeof q.queryKey[0] === 'string' &&
                      q.queryKey[0].startsWith('items-list'),
                  });
                  setEditRequestTarget(null);
                  const syncParts: string[] = [];
                  if (syncResult.draftPosUpdated > 0) {
                    syncParts.push(`${syncResult.draftPosUpdated} draft PO(s)`);
                  }
                  if (syncResult.itemsListTiersUpdated > 0) {
                    syncParts.push(`${syncResult.itemsListTiersUpdated} price list tier(s)`);
                  }
                  let successMsg = `Request ${savedCode} updated`;
                  if (syncParts.length > 0) {
                    successMsg += ` — also updated ${syncParts.join(' and ')}`;
                  }
                  addToast('success', successMsg);
                  if (syncResult.warnings.length > 0) {
                    addToast('warning', syncResult.warnings.slice(0, 2).join(' '));
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
          const moqFromQty =
            typeof line.qty === 'string' ? parseMoqInput(line.qty) ?? line.qty : line.qty;
          return [{ vendor: q.vendor, moq: Number.isNaN(moqFromQty) ? item.moq ?? '—' : moqFromQty, unitPrice: line.pricePerUnit, leadDays: q.leadTimeDays, terms: q.terms }];
        });
        const vendorSlabs = vendorSlabsFromItemsList.length > 0 ? vendorSlabsFromItemsList : vendorSlabsFromQuotes;
        const lineItemsForModal: ReleaseLineEditRow[] = releaseToPlannedLineEdits.length > 0
          ? releaseToPlannedLineEdits
          : (() => {
            const totalReqQty = Number(item.reqQty ?? item.qty ?? 0) || 0;
            const oq = resolveOpenQtyForReleaseItem({
              requestId: req.id,
              reqType: req.type,
              itemName: itemName ?? '',
              itemCode: itemCode ?? '',
              totalReqQty,
              raw_material_id: item.raw_material_id,
              pack_material_id: item.pack_material_id,
              itemType: reqTypeModal,
            });
            return [{
              itemName: itemName ?? '',
              itemCode: itemCode ?? '',
              type: req.type,
              originalQty: oq,
              qty: oq,
              unit:
                req.type === 'PM'
                  ? String(item.unit ?? 'PCS')
                  : resolveRmPrimaryUnit(
                      item.raw_material_id != null ? Number(item.raw_material_id) : null,
                      item.itemCode,
                      String(item.unit ?? '')
                    ),
              moq: Number(item.moq ?? 0) || 0,
              unitPrice: Number(item.plannedPrice ?? 0) || 0,
              leadDays: Number(releaseToPlannedForm.leadTimeDays ?? 0) || 0,
              ...(item.raw_material_id != null ? { raw_material_id: Number(item.raw_material_id) } : {}),
              ...(item.pack_material_id != null ? { pack_material_id: Number(item.pack_material_id) } : {}),
            }];
          })();
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
                  <p className="text-xs text-slate-500 mb-3">
                    Set <span className="font-semibold text-slate-700">release qty</span> per line (≤ open request). What you do not put on this draft stays open on the procurement request. Adjust pricing via vendor and MOQ slab below.
                  </p>
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
                              <input
                                type="number"
                                min={0}
                                step="any"
                                max={ln.originalQty}
                                value={ln.qty === 0 ? '' : ln.qty}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const n = raw === '' ? 0 : parseFloat(raw);
                                  const next = Number.isFinite(n) ? Math.min(ln.originalQty, Math.max(0, n)) : 0;
                                  setReleaseToPlannedLineEdits((prev) => {
                                    const base = prev.length > 0 ? prev : [...lineItemsForModal];
                                    return base.map((row, ri) => (ri === i ? { ...row, qty: next } : row));
                                  });
                                }}
                                className="w-24 rounded border border-slate-300 px-1.5 py-1 text-right text-xs tabular-nums"
                              />
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                max {Number(ln.originalQty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </div>
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
                            setReleaseToPlannedLineEdits((prev) => {
                              const base = prev.length > 0 ? prev : [...lineItemsForModal];
                              return base.map((ln) => {
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
                              });
                            });
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
                                setReleaseToPlannedLineEdits((prev) => {
                                  const base = prev.length > 0 ? prev : [...lineItemsForModal];
                                  const moqNum = Number(slab.moq);
                                  return base.map((ln) => ({
                                    ...ln,
                                    moq: Number.isFinite(moqNum) ? moqNum : ln.moq,
                                    unitPrice: slab.unitPrice,
                                    leadDays: slab.leadDays,
                                  }));
                                });
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

                      for (const ln of linesForCreate) {
                        const q = Number(ln.qty) || 0;
                        if (q > ln.originalQty) {
                          addToast(
                            'warning',
                            `Release qty for ${ln.itemName || 'line'} cannot exceed open request (${ln.originalQty}).`,
                          );
                          return;
                        }
                        const moq = Number(ln.moq) || 0;
                        const remaining = Math.max(0, (Number(ln.originalQty) || 0) - q);
                        if (moq > 0 && remaining > 0 && remaining < moq) {
                          addToast(
                            'warning',
                            `Leftover qty for ${ln.itemName || 'line'} is ${remaining}, below MOQ ${moq}. Increase release qty to full, or keep remaining >= MOQ.`,
                          );
                          return;
                        }
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
                          lead_time_days: Number(ln.leadDays ?? 0) || 0,
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

                      const prRow = backendPrArray.find((p: { id: string }) => String(p.id) === req.id) as
                        | {
                            items?: BackendPRItem[];
                            planningExtractedId?: number;
                            planningBatchId?: number | null;
                            priority?: string;
                            requiredByDate?: string | null;
                            notes?: string | null;
                            preferredVendor?: string | null;
                          }
                        | undefined;

                      const backendItemsForSplit = Array.isArray(prRow?.items) ? prRow!.items : [];
                      const { releasedItems, remainingItems } = splitBackendPrItemsAfterPartialRelease(
                        backendItemsForSplit,
                        lineItemsForModal,
                        linesForCreate
                      );

                      const prUpd = await updateProcurementRequestApi(req.id, {
                        status: 'PO Draft',
                        items: releasedItems,
                      });
                      if (!prUpd.success) {
                        addToast(
                          'error',
                          typeof prUpd.error === 'string'
                            ? prUpd.error
                            : 'Draft PO was created but updating the procurement request failed. Adjust the request manually.',
                        );
                        void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                        void invalidatePurchaseOrdersQueries();
                        return;
                      }

                      let remainingCreatedCode: string | null = null;
                      if (remainingItems.length > 0) {
                        // Create a NEW procurement request row for the remainder so future PO drafts are linked to the correct requestId.
                        if (!prRow?.planningExtractedId || prRow.planningExtractedId <= 0) {
                          addToast('error', 'Cannot split PR remainder: missing planningExtractedId on backend PR.');
                        } else {
                          const remainingRes = await createProcurementRequestApi({
                            planningExtractedId: prRow.planningExtractedId,
                            planningBatchId: prRow.planningBatchId ?? null,
                            priority: prRow.priority ?? 'Medium',
                            requiredByDate: prRow.requiredByDate ?? null,
                            notes: prRow.notes ?? null,
                            preferredVendor: prRow.preferredVendor ?? null,
                            items: remainingItems,
                          });

                          if (!remainingRes.success || !remainingRes.data) {
                            addToast(
                              'error',
                              typeof remainingRes.error === 'string'
                                ? remainingRes.error
                                : 'Failed to create remaining procurement request for PR remainder.',
                            );
                          } else {
                            remainingCreatedCode = remainingRes.data.code ?? null;
                          }
                        }
                      }
                      void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });

                      updateProcurementState((current) => ({
                        draftPOs: [newDraftPO, ...current.draftPOs],
                      }));

                      void invalidatePurchaseOrdersQueries();
                      addToast(
                        'success',
                        `Draft PO ${newDpoId} created for ${req.code}${
                          remainingItems.length > 0
                            ? remainingCreatedCode
                              ? `; remainder split into ${remainingCreatedCode}`
                              : '; remainder split into a new PR'
                            : ''
                        }`
                      );
                      setReleaseToPlannedNotes('');
                      setReleaseToPlannedTarget(null);
                      setTimeout(() => {
                        applyRouteState('Procurement', 'Purchase Orders');
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
                <span className="block text-xs font-semibold text-slate-600 mb-2">Line items — qty &amp; price/unit</span>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] tracking-wide text-slate-500 border-b border-slate-200">
                        <th className="px-2 py-2 font-semibold">Item</th>
                        <th className="px-2 py-2 font-semibold text-right w-24">Qty</th>
                        <th className="px-2 py-2 font-semibold text-right w-28">Price/unit (₹)</th>
                        <th className="px-2 py-2 font-semibold text-right w-28">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editDraftPOForm.lineItems.map((line, idx) => (
                        <tr key={idx} className="border-b border-slate-100 last:border-0">
                          <td className="px-2 py-2 align-top">
                            <p className="font-medium text-slate-800 leading-snug">{line.item}</p>
                            <p className="text-[10px] text-slate-500">{line.itemCode}</p>
                            {line.leadTimeDays != null ? (
                              <p className="text-[10px] text-slate-500 mt-0.5">Lead {line.leadTimeDays}d · GST {line.gstPercent ?? 18}%</p>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 text-right align-top">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Qty"
                              value={line.qty}
                              onChange={(e) => {
                                const next = editDraftPOForm.lineItems.map((l, i) =>
                                  i === idx ? recalcDraftPoLineItem(l, { qty: e.target.value }) : l,
                                );
                                setEditDraftPOForm((f) => ({ ...f, lineItems: next }));
                              }}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                            />
                          </td>
                          <td className="px-2 py-2 text-right align-top">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              value={line.pricePerUnit != null && line.pricePerUnit !== 0 ? String(line.pricePerUnit) : ''}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/,/g, '').trim();
                                const price = raw === '' ? 0 : parseFloat(raw.replace(/[^\d.]/g, '')) || 0;
                                const next = editDraftPOForm.lineItems.map((l, i) =>
                                  i === idx ? recalcDraftPoLineItem(l, { pricePerUnit: price }) : l,
                                );
                                setEditDraftPOForm((f) => ({ ...f, lineItems: next }));
                              }}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                            />
                          </td>
                          <td className="px-2 py-2 text-right align-top tabular-nums text-slate-800 font-medium whitespace-nowrap">
                            ₹{line.lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                  const backendRequestId = resolveBackendProcurementRequestId(d);
                  const prItemsForLines = resolvePrItemsForPurchaseOrderLines(backendPrArray, requestsMapped, {
                    backendRequestId,
                    draftRequestId: d.requestId,
                    requestCode: d.requestCode,
                  });
                  const assignedPrLines = assignPrItemToDraftLines(form.lineItems, prItemsForLines);
                  const editQtyErr = validateDraftPoQtyAgainstMoqRemainder(d.dpoNumber, form.lineItems, assignedPrLines);
                  if (editQtyErr) {
                    addToast('warning', editQtyErr);
                    return;
                  }
                  const qtyEdited = form.lineItems.some((l, idx) => {
                    const next = parseQuantityRequested(l.qty);
                    const prev = parseQuantityRequested(d.lineItems[idx]?.qty);
                    return next !== prev;
                  });

                  if (d.backendPoId) {
                    const poItems = draftLineItemsToPurchaseOrderItems(form.lineItems, prItemsForLines, assignedPrLines);
                    const payload = {
                      vendorName: form.vendor,
                      paymentTerms: form.paymentTerms || undefined,
                      expectedShipmentDate: form.expectedDelivery || undefined,
                      items: poItems,
                    };
                    const res = await updatePurchaseOrder(d.backendPoId, payload);
                    if (!res.success) {
                      addToast('error', typeof res.error === 'string' ? res.error : (res.error?.message ?? 'Failed to update draft PO'));
                      return;
                    }
                  }

                  const prRow = backendRequestId
                    ? (backendPrArray.find((p) => String(p.id) === backendRequestId) as
                        | {
                            items?: BackendPRItem[];
                            planningExtractedId?: number;
                            planningBatchId?: number | null;
                            priority?: string;
                            requiredByDate?: string | null;
                            notes?: string | null;
                            preferredVendor?: string | null;
                          }
                        | undefined)
                    : undefined;
                  const backendItemsForSync = Array.isArray(prRow?.items) ? prRow!.items : [];
                  if (backendRequestId && backendItemsForSync.length > 0 && qtyEdited) {
                    const { updatedItems, remainderItems } = syncProcurementItemsAfterDraftPoLineQtyEdit(
                      backendItemsForSync,
                      d.lineItems,
                      form.lineItems
                    );
                    const prUpd = await updateProcurementRequestApi(backendRequestId, { items: updatedItems });
                    if (!prUpd.success) {
                      addToast(
                        'error',
                        typeof prUpd.error === 'string'
                          ? prUpd.error
                          : 'Draft PO saved but updating the linked procurement request failed. Fix the request manually.',
                      );
                      void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                    } else {
                      let remainderCreatedLabel: string | null = null;
                      if (remainderItems.length > 0) {
                        if (!prRow?.planningExtractedId || prRow.planningExtractedId <= 0) {
                          addToast(
                            'warning',
                            'Linked request was updated; could not create a remainder request (missing planning link). Add the backlog lines manually.',
                          );
                        } else {
                          const remainderNotes = `Remainder from ${d.requestCode || d.dpoNumber}: draft PO line qty reduced (${d.dpoNumber}).`;
                          const remainingRes = await createProcurementRequestApi({
                            planningExtractedId: prRow.planningExtractedId,
                            planningBatchId: prRow.planningBatchId ?? null,
                            priority: prRow.priority ?? 'Medium',
                            requiredByDate: prRow.requiredByDate ?? null,
                            notes: [prRow.notes, remainderNotes].filter(Boolean).join('\n\n') || remainderNotes,
                            preferredVendor: prRow.preferredVendor ?? null,
                            items: remainderItems,
                          });
                          if (!remainingRes.success || !remainingRes.data) {
                            addToast(
                              'error',
                              typeof remainingRes.error === 'string'
                                ? remainingRes.error
                                : 'Linked request updated but creating the remainder procurement request failed.',
                            );
                          } else if (remainingRes.data.id != null) {
                            remainderCreatedLabel = `PR-REQ-${String(remainingRes.data.id).padStart(3, '0')}`;
                          }
                        }
                      }
                      void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                      if (remainderItems.length > 0 && remainderCreatedLabel) {
                        addToast('success', `Procurement synced; remainder tracked as ${remainderCreatedLabel}.`);
                      } else if (remainderItems.length > 0) {
                        addToast('success', 'Procurement synced; remainder request created.');
                      }
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

      {/* ── Stock Check Modal (request-id scoped stock-check result) ── */}
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

        const notesOutcome = parseStockCheckOutcome(req.stockCheckNotes);
        const notesLines = parseStockCheckNotesLines(req.stockCheckNotes);
        const notesByCode = new Map<string, (typeof notesLines)[number]>();
        const notesByName = new Map<string, (typeof notesLines)[number]>();
        for (const ln of notesLines) {
          const c = String(ln?.itemCode ?? '').trim().toLowerCase();
          const n = String(ln?.itemName ?? '').trim().toLowerCase();
          if (c) notesByCode.set(c, ln);
          if (n) notesByName.set(n, ln);
        }

        const stockItems = req.itemDetails && req.itemDetails.length > 0
          ? req.itemDetails.map((item) => {
            const note =
              notesByCode.get(String(item.itemCode ?? '').trim().toLowerCase()) ??
              notesByName.get(String(item.itemName ?? '').trim().toLowerCase()) ??
              null;
            const override = item.itemCode ? updatesForRequest[item.itemCode] : undefined;
            const qtyFromNote = note
              ? Number(note.updatedStockQty ?? note.physicalQty ?? 0)
              : null;
            return {
              itemName: item.itemName,
              itemCode: item.itemCode,
              requestedQty: item.reqQty,
              systemQty: qtyFromNote,
              whUnit: item.unit ?? '',
              physicalQty: override?.physicalQty ?? qtyFromNote,
              zoneRack: override ? `${override.zone ?? '—'} · ${override.rack ?? '—'}` : '—',
              batchCode: override?.batchNo ?? (note?.batchNo ?? '—'),
              fromWarehouse: qtyFromNote != null,
            };
          })
          : req.items.map((itemName, idx) => {
            const itemCode = `EI-${req.type}-${itemName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || String(idx + 1).padStart(3, '0')}`;
            const note =
              notesByCode.get(itemCode.trim().toLowerCase()) ??
              notesByName.get(itemName.trim().toLowerCase()) ??
              null;
            const override = updatesForRequest[itemCode];
            const reqQty = req.quantities?.[idx] ?? 0;
            const qtyFromNote = note
              ? Number(note.updatedStockQty ?? note.physicalQty ?? 0)
              : null;
            return {
              itemName,
              itemCode,
              requestedQty: reqQty,
              systemQty: qtyFromNote,
              whUnit: req.units?.[idx] ?? '',
              physicalQty: override?.physicalQty ?? qtyFromNote,
              zoneRack: override ? `${override.zone ?? '—'} · ${override.rack ?? '—'}` : '—',
              batchCode: override?.batchNo ?? (note?.batchNo ?? '—'),
              fromWarehouse: qtyFromNote != null,
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
                  <div className="flex items-center gap-2">
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
                    Request-scoped view: stock/check values are shown for this PR request only.
                    {notesOutcome == null ? ' Waiting for warehouse completion.' : ` Outcome: ${notesOutcome === 'all_ok' ? 'All OK' : 'Not OK'}.`}
                  </div>
                </>
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


      {showRecordQuoteModal && (
        <div className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6">
          <div className="my-auto flex w-full max-w-5xl max-h-[calc(100dvh-2rem)] flex-col rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {recordQuoteForm.planningQuotationAskId
                    ? 'Record quote for Planning ask'
                    : recordQuoteForm.procurementRequestId
                      ? 'Add quotation for request'
                      : 'Record Vendor Quotation'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {recordQuoteForm.planningQuotationAskId
                    ? 'Saves vendor rates to Items List only. No procurement request is created; Planning adds a PR manually after rates exist.'
                    : recordQuoteForm.procurementRequestId
                      ? 'Enter vendor and unit prices for each line. Rates are saved to Items List so Planning can release procurement with those vendors.'
                      : 'Add vendor, items and prices. A quotation is independent of PRs; it gets linked to a PR when you create a Draft PO from it. Per-item vendor history is shown in each PR popup (Requests).'}
                </p>
              </div>
              <button
                type="button"
                disabled={recordQuoteSaving}
                onClick={closeRecordQuoteModal}
                className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {(rawMaterialsListForQuoteError || packMaterialsListForQuoteError) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <p className="font-semibold">Could not load RM/PM master lists</p>
                <p className="mt-1 text-amber-900/90">
                  Your role must allow reading Raw Materials and Pack Materials (or Sales / Purchase / Order Management). Ask an admin to add the right module to your role, then reopen this modal.
                </p>
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center justify-between">
                <span>Quote lines</span>
                <button
                  type="button"
                  disabled={recordQuoteSaving}
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
                    setRecordQuoteLineSearch((prev) => ({ ...prev, [nextIndex]: '' }));
                  }}
                  className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-100"
                >
                  + Add line
                </button>
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 flex text-[11px] font-semibold text-slate-600">
                  <div className="flex-1 min-w-[200px]">ITEM (RM/PM from masters)</div>
                  <div className="w-24 text-right">MOQ</div>
                  <div className="w-28 text-right">PRICE / UNIT</div>
                  <div className="w-16" />
                </div>
                <div className="max-h-[min(20rem,42vh)] overflow-auto divide-y divide-slate-100">
                  {recordQuoteLines.map((line, idx) => {
                    const lineItemValue =
                      line.raw_material_id != null
                        ? `rm-${line.raw_material_id}`
                        : line.pack_material_id != null
                          ? `pm-${line.pack_material_id}`
                          : '';
                    const selectedOption = lineItemValue ? quoteLineOptionByKey.get(lineItemValue) : undefined;
                    const inputValue = recordQuoteLineSearch[line.index] ?? selectedOption?.label ?? '';
                    const datalistOptions = filterQuoteLineOptionsForDatalist(inputValue);
                    return (
                      <div key={line.index} className="px-4 py-2 flex items-center text-xs gap-2">
                        <div className="flex-1 min-w-0">
                          <input
                            list={`quote-line-item-options-${line.index}`}
                            value={inputValue}
                            onChange={(e) => handleRecordQuoteLineSearchChange(idx, line.index, e.target.value)}
                            onBlur={(e) => handleRecordQuoteLineItemBlur(idx, line.index, e.target.value)}
                            placeholder="Type code, INCI, name, SKU, or rm-12 / pm-34"
                            disabled={recordQuoteSaving}
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-800 bg-white disabled:bg-slate-50 disabled:text-slate-500"
                          />
                          <datalist id={`quote-line-item-options-${line.index}`}>
                            {datalistOptions.map((opt) => (
                              <option key={opt.key} value={opt.label} />
                            ))}
                          </datalist>
                          {line.name && (
                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                              {line.itemId && `${line.itemId} · `}{line.name} ({line.uom})
                            </p>
                          )}
                        </div>
                        <div className="w-24 text-right pl-1">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            placeholder="0.5"
                            value={line.orderQty}
                            onChange={handleRecordQuoteLineChange(idx, 'orderQty')}
                            disabled={recordQuoteSaving}
                            className="w-full border border-slate-300 rounded px-1 py-0.5 text-right disabled:bg-slate-50"
                          />
                        </div>
                        <div className="w-28 text-right pl-1">
                          <input
                            type="text"
                            value={line.pricePerUnit}
                            onChange={handleRecordQuoteLineChange(idx, 'pricePerUnit')}
                            disabled={recordQuoteSaving}
                            className="w-full border border-slate-300 rounded px-1 py-0.5 text-right disabled:bg-slate-50"
                          />
                        </div>
                        <div className="w-16 shrink-0">
                          <button
                            type="button"
                            disabled={recordQuoteSaving}
                            onClick={() => {
                              setRecordQuoteLines((prev) => prev.filter((_, i) => i !== idx));
                              setRecordQuoteLineSearch((prev) => {
                                const next = { ...prev };
                                delete next[line.index];
                                return next;
                              });
                            }}
                            className="text-slate-400 hover:text-red-600 text-sm disabled:opacity-40 disabled:pointer-events-none"
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
                disabled={recordQuoteSaving}
                className="w-full max-w-md border border-slate-300 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50"
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
                  disabled={recordQuoteSaving}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Valid Till</label>
                <input
                  type="date"
                  value={recordQuoteForm.validTill}
                  onChange={(e) => setRecordQuoteForm((f) => ({ ...f, validTill: e.target.value }))}
                  disabled={recordQuoteSaving}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Lead Time (days)</label>
                <input
                  type="number"
                  min={0}
                  value={recordQuoteForm.leadTimeDays}
                  onChange={(e) => setRecordQuoteForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
                  disabled={recordQuoteSaving}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50"
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
                disabled={recordQuoteSaving}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50"
                rows={2}
              />
            </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
              <p className="text-[11px] text-slate-500">
                New quotes are saved with default status for internal tracking.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={recordQuoteSaving}
                  onClick={closeRecordQuoteModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={recordQuoteSaving}
                  onClick={async () => {
                    if (recordQuoteSaving) return;
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
                    const invalidPrice = recordQuoteLines.some((l) => {
                      const price = parseFloat(String(l.pricePerUnit).replace(/[^\d.]/g, '')) || 0;
                      return price <= 0;
                    });
                    if (invalidPrice) {
                      addToast('error', 'Enter a price per unit greater than zero for each line.');
                      return;
                    }

                    setRecordQuoteSaving(true);
                    try {
                    const selectedVendorProc = vendors.find((x) => String(x.id) === String(recordQuoteForm.vendorId));
                    const composedPaymentTerms = selectedVendorProc?.paymentTerms?.trim() || 'As per contract';

                    const linkedPrId = String(recordQuoteForm.procurementRequestId ?? '').trim();
                    if (linkedPrId) {
                      const quotationItems = recordQuoteLines.map((l) => {
                        const qty = parseMoqInput(l.orderQty) ?? 0;
                        const price = parseFloat(String(l.pricePerUnit).replace(/[^\d.]/g, '')) || 0;
                        return {
                          raw_material_id: l.raw_material_id ?? undefined,
                          pack_material_id: l.pack_material_id ?? undefined,
                          itemId: l.itemId || l.name,
                          name: l.name,
                          orderQty: qty,
                          pricePerUnit: price,
                          uom: l.uom || 'KG',
                          totalValue: qty * price,
                        };
                      });
                      const createRes = await createProcurementQuotation({
                        procurementRequestId: parseInt(linkedPrId, 10),
                        vendorId,
                        quoteDate: recordQuoteForm.quoteDate || null,
                        validTill: recordQuoteForm.validTill || null,
                        leadTimeDays: recordQuoteForm.leadTimeDays
                          ? Number(recordQuoteForm.leadTimeDays)
                          : null,
                        paymentTerms: composedPaymentTerms,
                        notes: recordQuoteForm.notes || null,
                        status: 'pending',
                        items: quotationItems,
                      });
                      if (!createRes.success || !createRes.data) {
                        addToast(
                          'error',
                          typeof createRes.error === 'string' ? createRes.error : 'Failed to save quotation'
                        );
                        return;
                      }
                      await queryClient.invalidateQueries({
                        predicate: (q) =>
                          Array.isArray(q.queryKey) &&
                          typeof q.queryKey[0] === 'string' &&
                          q.queryKey[0].startsWith('items-list'),
                        refetchType: 'all',
                      });
                      await queryClient.invalidateQueries({ queryKey: ['procurement-quotations'] });
                      await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                      addToast(
                        'success',
                        'Quotation saved to Items List. Planning can now pick this vendor when releasing procurement.'
                      );
                      closeRecordQuoteModal();
                      return;
                    }

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
                      const qty = parseMoqInput(l.orderQty) ?? 0;
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
                      const existingTier =
                        (existingRate?.tiers ?? []).find((t) => moqValuesEqual(t.moq_min, qty)) ?? null;
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

                    await queryClient.invalidateQueries({
                      predicate: (q) =>
                        Array.isArray(q.queryKey) &&
                        typeof q.queryKey[0] === 'string' &&
                        q.queryKey[0].startsWith('items-list'),
                      refetchType: 'all',
                    });
                    const askId = parseInt(String(recordQuoteForm.planningQuotationAskId ?? ''), 10);
                    if (Number.isFinite(askId) && askId > 0) {
                      await updatePlanningQuotationAsk(askId, { status: 'fulfilled' });
                      await queryClient.invalidateQueries({ queryKey: ['planning-quotation-asks'] });
                    }
                    addToast(
                      'success',
                      askId > 0
                        ? 'Saved to Items List. Planning quotation ask marked fulfilled — planner can create a PR manually when ready.'
                        : 'Saved vendor price list (Items List).'
                    );
                    closeRecordQuoteModal();
                    } finally {
                      setRecordQuoteSaving(false);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-yellow-500"
                >
                  {recordQuoteSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    recordQuoteForm.planningQuotationAskId
                      ? 'Save to Items List'
                      : recordQuoteForm.procurementRequestId
                        ? 'Save quotation'
                        : 'Save Quote'
                  )}
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

                              const lineLeadDays = resolveDraftLineLeadTimeDays({
                                prLine: selectedItem,
                                quoteLineLead: selectedLine?.leadTimeDays,
                                itemsListLead: undefined,
                                quoteHeaderLead: selectedQuote.leadTimeDays,
                              });

                              const today = new Date();
                              const expectedDelivery = new Date(today);
                              expectedDelivery.setDate(expectedDelivery.getDate() + lineLeadDays);
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
                                leadTimeDays: lineLeadDays,
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
                                    lead_time_days: lineLeadDays,
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
                                applyRouteState('Procurement', 'Purchase Orders');
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
      <ConfirmDialog
        isOpen={draftPoDeleteConfirmTarget !== null}
        onClose={() => {
          if (deletingDraftPoId) return;
          setDraftPoDeleteConfirmTarget(null);
        }}
        onConfirm={confirmDeleteDraftPO}
        title="Delete draft PO?"
        message={
          draftPoDeleteConfirmTarget ? (
            <>
              Delete draft PO{' '}
              <span className="font-semibold">{draftPoDeleteConfirmTarget.dpoNumber}</span>? The draft PO
              and its linked procurement request will be removed. Quantities return to Planning so you
              can use Release to Planning again. Other remainder requests from a partial release are kept.
            </>
          ) : (
            ''
          )
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={deletingDraftPoId === draftPoDeleteConfirmTarget?.id}
      />
      <ConfirmDialog
        isOpen={requestDeleteConfirmTarget !== null}
        onClose={() => {
          if (deletingRequestId) return;
          setRequestDeleteConfirmTarget(null);
        }}
        onConfirm={confirmDeleteRequest}
        title="Delete procurement request?"
        message={
          requestDeleteConfirmTarget ? (
            <>
              Delete request{' '}
              <span className="font-semibold">{requestDeleteConfirmTarget.code}</span>? Linked draft
              PO(s) will also be removed. Quantities return to Planning.
            </>
          ) : (
            ''
          )
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={deletingRequestId === requestDeleteConfirmTarget?.id}
      />
    </div>
  );
};

export default Procurement;


