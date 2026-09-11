import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query';
import type { Query } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useGlobalState } from '../../context/GlobalStateContext';
import ProcurementDashboardShell from '../../components/procurement/ProcurementDashboardShell';
import type { IssuedPOViewRecord } from '../../components/procurement/issuedPoRecord.types';
import { PurchaseOrdersView } from '../../components/procurement/PurchaseOrdersView';
import { GrnTrackerView } from '../../components/procurement/GrnTrackerView';
import { StockAuditTrackerView } from '../../components/procurement/StockAuditTrackerView';
import { RequestQuotationModal, type RequestQuotationContext } from '../../components/procurement/RequestQuotationModal';
import { QuoteRequestsView } from '../../components/procurement/QuoteRequestsView';
import { PrInboxView } from '../../components/procurement/PrInboxView';
import { PrEditPopup } from '../../components/procurement/PrEditPopup';
import { StockAuditPopup } from '../../components/procurement/StockAuditPopup';
import { InventoryAuditDetailModal } from '../../components/procurement/InventoryAuditDetailModal';
import { buildInventoryAuditLines, type InventoryAuditLine } from '../../lib/inventoryAuditLines';
import { buildProcurementStockAuditSubmitPayload } from '../../lib/buildProcurementStockAuditSubmitPayload';
import {
  buildStockAuditWarehousesFromLocations,
  mergeStockByLocationIntoWarehouses,
} from '../../lib/stockAuditWarehouses';
import {
  bumpProcurementRequestItemQty,
  bumpPurchaseOrderItemsQty,
  findDraftPurchaseOrderForRequest,
  mergeGapApprovalIntoStockCheckNotes,
  resolveInventoryStockAfterGapApproval,
} from '../../lib/inventoryAuditGapApproval';
import { findStockCheckNoteForItem, parseStockCheckNotes } from '../../lib/stockCheckNotes';
import { getStockCheckGapForItem } from '../../lib/stockCheckGapDisplay';
import type { Order } from '../../types/salesPurchase.types';
import {
  mergePurchaseOrderRecords,
  isPoStatusCancelled,
  isPoStatusCompleted,
  isPoStatusIssuedLike,
  isPoStatusListed,
} from '../../lib/purchaseOrderRecordsMerge';
import { normalizeProcurementSection } from '../../lib/procurementNav';
import { formatIsoWeekLabel } from '../../lib/isoWeek';
import { buildProcurementRequestItemLines } from '../../lib/procurementRequestItemLines';
import procurementData from '../../mocks/procurement-data.json';
import {
  fetchProcurementRequests as fetchProcurementRequestsApi,
  updateProcurementRequest as updateProcurementRequestApi,
  createProcurementRequest as createProcurementRequestApi,
  deleteProcurementRequest as deleteProcurementRequestApi,
  submitStockCheckResult as submitStockCheckResultApi,
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
  createPlanningQuotationAsk,
  type PlanningQuotationAsk,
} from '../../services/planningQuotationAsks.service';
import { fetchVendorClients } from '../../services/vendorClient.service';
import VendorClientNameTypeahead from '../../components/VendorClientNameTypeahead';
import {
  fetchPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  importPrRowsExcel,
} from '../../services/salesPurchase.service';
import { fetchPoTracking, fetchPoTrackingBatch, updatePoTracking } from '../../services/poTracking.service';
import type { PoTrackingRecord } from '../../services/poTracking.service';
import { rejectPoByVendor } from '../../services/poVendor.service';
import {
  createGRN,
  fetchGRNById,
  fetchGRNList,
  grnLineItemDisplayName,
  grnLineItemsNameSummary,
  updateGRN,
  type GRNRecordFromApi,
} from '../../services/grn.service';
import { fetchWarehouseInventory, fetchStockByLocation, updateWarehouseStock } from '../../services/warehouseInventory.service';
import { fetchWarehouseLocations } from '../../services/warehouseLocations.service';
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
  parseQuantityRequested,
  resolveDraftLineLeadTimeDays,
  normalizeLeadTimeDays,
  computeIssuedPoEtaFromLeadTimes,
  connectingOverridesFromFormData,
  connectingDateByItemFromLineDates,
  normConnectingDateKey,
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
import type { ReleaseLineEditRow, IssuedPoLineConnectingDate } from './procurementDataMappers';
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
import { Search, X, Package, Loader2, FileText, MessageSquare } from 'lucide-react';
import { openPurchaseOrderPdf } from '../../lib/purchaseOrderPdf';
import {
  PAYMENT_TERMS_TYPE_OPTIONS,
  formatPaymentTermsString,
  parsePaymentTermsString,
  paymentTermsTypeRequiresAdvancePercent,
  validateAdvancePercentForType,
  type PaymentTermsStructuredType,
} from '../../lib/paymentTermsStructured';
import { PaymentTermsDisplay } from '../../components/procurement/PaymentTermsDisplay';
import { CommentsPanel } from '../../components/orders/CommentsPanel';
import { splitLinesByQuantity, lineQtyNumber } from '../../lib/splitPoByQuantity';
import { poExpectedDateFromPr } from '../../lib/poExpectedDateFromPr';
import {
  type PoType,
  PO_TYPE_CONFIG,
  PO_TYPE_ORDER,
  resolvePoApprovalRoute,
  poApproverRoleLabel,
  SLA_LEVEL_CLASSES,
  SLA_LEVEL_PREFIX,
  type SlaLevel,
  type PoApprovalStatus,
} from '../../constants/procurement';
import GrnMonitorDetailPanel from '../../components/procurement/GrnMonitorDetailPanel';
import PoApprovalPanel from '../../components/procurement/PoApprovalPanel';
import { poBackendId } from '../../services/poApproval.service';
import PoVendorPanel from '../../components/procurement/PoVendorPanel';
import PoMatchPanel from '../../components/procurement/PoMatchPanel';
import PoExceptionBar from '../../components/procurement/PoExceptionBar';
import type { PoExceptionState } from '../../services/poException.service';
import PoGrnExceptionPanel from '../../components/procurement/PoGrnExceptionPanel';
import NewPrModal from '../../components/procurement/NewPrModal';
import NewPoModal from '../../components/procurement/NewPoModal';
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
/**
 * Vendor-acknowledgement SLA (Flowchart Sub-flow F, 48h) for an issued PO's tracking row.
 * Returns null unless the PO is sent and still awaiting ack. Mirrors backend ACK_SLA_DAYS=2.
 */
function computeIssuedAckSla(
  tr: { poReleasedAt?: string | null; ackSlaDueAt?: string | null } | undefined,
  hasConfirmed: boolean,
  hasRejected: boolean,
): { level: SlaLevel; dueDisplay: string; label: string } | null {
  if (!tr || hasConfirmed || hasRejected) return null;
  const dateOnly = (v: unknown): string | null => {
    const s = String(v ?? '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  const released = dateOnly(tr.poReleasedAt);
  if (!released) return null;
  let due = dateOnly(tr.ackSlaDueAt);
  if (!due) {
    const d = new Date(`${released}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + 2);
    due = d.toISOString().slice(0, 10);
  }
  const today = new Date().toISOString().slice(0, 10);
  const level: SlaLevel = today > due ? 'bad' : today === due ? 'warn' : 'ok';
  const label = level === 'bad' ? 'SLA breached' : level === 'warn' ? 'due today' : 'within SLA';
  const dueDisplay = new Date(`${due}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return { level, dueDisplay, label };
}

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
 * Starting price for a newly-added PO line: this vendor's default rate, else their lowest-MOQ
 * tier, else the catalog's own pricePerUnit, else 0. Only a starting point — qty is 0 when a
 * line is first added, so no MOQ tier is truly "correct" yet; the price stays editable.
 */
function resolveStartingPriceForVendor(item: PriceListItemPage, vendorName: string): number {
  const vendorNorm = String(vendorName ?? '').trim().toLowerCase();
  const rate = (item.vendorRates ?? []).find(
    (r) => String(r.vendor_name ?? '').trim().toLowerCase() === vendorNorm
  );
  if (rate) {
    const cheapestTier = [...(rate.tiers ?? [])].sort((a, b) => Number(a.moq_min) - Number(b.moq_min))[0];
    if (cheapestTier && Number(cheapestTier.price_per_unit) > 0) return Number(cheapestTier.price_per_unit);
  }
  return Number(item.pricePerUnit) > 0 ? Number(item.pricePerUnit) : 0;
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
  'Procurement Requests',
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
  // C9: a step is "done" only when its OWN evidence exists — never back-filled off a later
  // step's timestamp. Prevents the card asserting progress (advance paid / vendor confirmed)
  // the DB has no record of when a later step (e.g. delivered) is stamped out of order.
  const stepDone = (i: number): boolean => {
    switch (i) {
      case 0: return has(tracking?.poReleasedAt) || has(poDateFallback); // issued PO ⇒ released
      case 1: return has(tracking?.advancePaidAt);
      case 2: return has(tracking?.vendorConfirmedAt);
      case 3: return has(tracking?.shippedAt) || Boolean(ov?.shipped);
      case 4: return has(tracking?.deliveredAt) || Boolean(ov?.delivered);
      case 5: return has(tracking?.underGrnAt) || Boolean(ov?.underGrn);
      case 6: return has(tracking?.grnCompleteAt) || Boolean(grnCompleteForPo);
      default: return false;
    }
  };
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
    const done = stepDone(index);
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
  Confirmed: 'text-ok border-[color:var(--st-green-fg)]/30 bg-ok-soft',
  'Not Selected': 'text-ink-2 border-border bg-surface-3',
  'Pending Review': 'text-warn border-[color:var(--st-amber-fg)]/30 bg-warn-soft',
};

const requestTypeClass: Record<RequestType, string> = {
  RM: 'bg-brand-soft text-brand border-brand-soft',
  PM: 'bg-brand-soft text-brand border-brand-soft',
};

const statusBg: Record<RequestStatus, string> = {
  'New': 'bg-brand-soft text-brand border-brand-soft',
  'Quoted': 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30',
  'PO Draft': 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30',
  'PO Released': 'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30',
  'Delivery Pending': 'bg-err-soft text-err border-[color:var(--st-red-fg)]/30',
  'Under GRN': 'bg-surface-3 text-ink-2 border-border',
};

const priorityClass: Record<RequestPriority, string> = {
  'High': 'bg-err-soft text-err border-[color:var(--st-red-fg)]/30',
  'Medium': 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30',
  'Low': 'bg-surface-3 text-ink-2 border-border',
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
  // Per-PR "Request Quotation" (RFQ) — opens the shared RequestQuotationModal, pre-filled from the PR item.
  const [quoteRequestCtx, setQuoteRequestCtx] = useState<RequestQuotationContext | null>(null);
  // Spec §3A/§3B/§3C popups (PR Inbox row actions)
  const [prEditReq, setPrEditReq] = useState<ProcurementRequest | null>(null);
  const [stockAuditReq, setStockAuditReq] = useState<ProcurementRequest | null>(null);
  const [inventoryAuditDetailLine, setInventoryAuditDetailLine] = useState<InventoryAuditLine | null>(null);
  const [inventoryAuditApproving, setInventoryAuditApproving] = useState(false);
  const [inventoryAuditReAuditing, setInventoryAuditReAuditing] = useState(false);
  const [inventoryAuditTerminating, setInventoryAuditTerminating] = useState(false);
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
  // Draft PO editor: "add new item" picker — mirrors addPoItemSearch on the Issued PO modal.
  const [addDraftPoItemSearch, setAddDraftPoItemSearch] = useState('');
  // Raw text as typed per row — see editIssuedPoPriceDraft for why this can't just be derived
  // from the parsed number (a mid-typed "60." would collapse back to "60" every keystroke).
  const [editDraftPoPriceDraft, setEditDraftPoPriceDraft] = useState<Record<number, string>>({});
  const [editDraftPoGstDraft, setEditDraftPoGstDraft] = useState<Record<number, string>>({});
  const [editDraftPoGstAmtDraft, setEditDraftPoGstAmtDraft] = useState<Record<number, string>>({});
  /**
   * Raw text for the per-line Lead (days) inputs.
   *
   * Kept as strings, like the price/GST drafts, so the field can be empty mid-typing without
   * snapping to 0. Empty means "no lead time on record" and stays `undefined` on the line — the
   * Lead Connecting Date column depends on that staying distinct from a real zero.
   */
  const [editDraftPoLeadDraft, setEditDraftPoLeadDraft] = useState<Record<number, string>>({});
  const [poTrackingForm, setPoTrackingForm] = useState<Partial<PoTrackingRecord>>({});
  const [selectedStockCheckRequest, setSelectedStockCheckRequest] = useState<ProcurementRequest | null>(null);
  const [selectedStockCheckItemName, setSelectedStockCheckItemName] = useState<string | null>(null);
  const [updateStockCheckRequest, setUpdateStockCheckRequest] = useState<ProcurementRequest | null>(null);
  const [stockCheckForm, setStockCheckForm] = useState<{ assignedTo: string; status: string; dueDate: string; notes: string }>({ assignedTo: '', status: '', dueDate: '', notes: '' });
  const [stockCheckSaving, setStockCheckSaving] = useState(false);
  const [approvingGapLineKey, setApprovingGapLineKey] = useState<string | null>(null);
  const [releasingWeekVendorBucketKey, setReleasingWeekVendorBucketKey] = useState<string | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  // Issued-PO detail: editable per-item connecting dates (norm itemCode -> YYYY-MM-DD, '' = cleared to auto).
  const [connectingDateDraft, setConnectingDateDraft] = useState<Record<string, string>>({});
  const [connectingDateSaving, setConnectingDateSaving] = useState(false);
  // Issued-PO detail: editable line items (qty / price), same mechanics as the Draft PO editor.
  // Gated by the lifecycle-exception state fetched inside PoExceptionBar — only editable while the
  // PO could also be Amended (approved/sent, not shipped/GRN'd/held/cancelled) so a qty change here
  // can't desync from stock already moving against the old numbers.
  const [editIssuedPoLines, setEditIssuedPoLines] = useState<DraftPOLineItem[]>([]);
  const [editIssuedPoSaving, setEditIssuedPoSaving] = useState(false);
  const [poEditGate, setPoEditGate] = useState<PoExceptionState | null>(null);
  // New-item picker for the same editable table — a genuine correction/addition, not sourced
  // from the original procurement request (so it isn't matched/synced against PR demand — see
  // handleSaveIssuedPoLineItems / syncProcurementItemsAfterDraftPoLineQtyEdit).
  const [addPoItemSearch, setAddPoItemSearch] = useState('');
  // Raw text as typed per row (keyed by line index) — keeps a mid-typed "60." from being
  // collapsed back to "60" on every keystroke, which happened when the input's displayed value
  // was re-derived from the parsed number instead of the exact characters the user typed.
  const [editIssuedPoPriceDraft, setEditIssuedPoPriceDraft] = useState<Record<number, string>>({});
  const [editIssuedPoGstDraft, setEditIssuedPoGstDraft] = useState<Record<number, string>>({});
  const [editIssuedPoGstAmtDraft, setEditIssuedPoGstAmtDraft] = useState<Record<number, string>>({});
  useEffect(() => {
    setEditIssuedPoLines(Array.isArray(selectedPO?.lineItems) ? selectedPO.lineItems.map((l) => ({ ...l })) : []);
    setPoEditGate(null);
    setAddPoItemSearch('');
    setEditIssuedPoPriceDraft({});
    setEditIssuedPoGstDraft({});
    setEditIssuedPoGstAmtDraft({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPO?.backendPoId, selectedPO?.poNumber]);
  // Guards the released-PO detail modal's mutation buttons against double-submit while in flight.
  const [poActionBusy, setPoActionBusy] = useState<string | null>(null);
  const runPoAction = async (name: string, fn: () => void | Promise<unknown>) => {
    if (poActionBusy) return;
    setPoActionBusy(name);
    try {
      await fn();
    } finally {
      setPoActionBusy(null);
    }
  };
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
  /**
   * Comments panel for a purchase order: the PO's own thread plus a thread per material on it.
   *
   * The material threads are keyed by raw_materials.id / pack_materials.id — the SAME keys Planning
   * uses in Items Involved and PIs Extracted — so a note procurement leaves on a material here is
   * the conversation the planning team already reads, not a second one they never see.
   */
  const [poCommentTarget, setPoCommentTarget] = useState<{
    id: number;
    label: string;
    materials: { type: 'rm' | 'pm'; id: number; label: string }[];
  } | null>(null);

  /** PO line items -> material comment threads. Lines with no master link are skipped: a thread
   *  keyed on nothing would be unreachable from Planning, which is the point of sharing them. */
  const poMaterialCommentScopes = (
    lines: { raw_material_id?: number; pack_material_id?: number; item?: string; itemCode?: string }[] | undefined,
  ): { type: 'rm' | 'pm'; id: number; label: string }[] => {
    const out: { type: 'rm' | 'pm'; id: number; label: string }[] = [];
    const seen = new Set<string>();
    for (const line of lines ?? []) {
      const rm = Number(line.raw_material_id);
      const pm = Number(line.pack_material_id);
      const isRm = Number.isFinite(rm) && rm > 0;
      const id = isRm ? rm : pm;
      if (!Number.isFinite(id) || id <= 0) continue;
      const type: 'rm' | 'pm' = isRm ? 'rm' : 'pm';
      const key = `${type}-${id}`;
      // One chip per material even when it appears on several lines of the PO.
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type, id, label: String(line.item ?? line.itemCode ?? key).trim() || key });
    }
    return out;
  };
  /** Manual "New PR" modal (Direct PR source). */
  const [showNewPr, setShowNewPr] = useState(false);
  /** Manual "New PO" modal (Direct PO — no PR). */
  const [showNewPo, setShowNewPo] = useState(false);
  /** Bumped after any approval/vendor transition so both PO workflow panels refetch in sync. */
  const [poWorkflowRefresh, setPoWorkflowRefresh] = useState(0);
  // Governed approval status of the PO open in the detail popup, reported by PoApprovalPanel.
  // The footer gates on THIS, not purchase_orders.status — the backend only allows Release
  // when approval_status === 'approved'.
  const [poApprovalStatus, setPoApprovalStatus] = useState<PoApprovalStatus>('not_submitted');
  /** Lifted from PoExceptionBar so sibling workflow panels grey out while a PO is held/cancelled. */
  const [poLock, setPoLock] = useState<{ onHold: boolean; cancelled: boolean }>({ onHold: false, cancelled: false });
  // Reset the lock whenever the open PO changes (the exception bar re-reports on load).
  useEffect(() => {
    setPoLock({ onHold: false, cancelled: false });
  }, [selectedDraftPO?.backendPoId, selectedPO?.backendPoId]);
  // Seed the connecting-date editor from the open PO's saved overrides (keyed by norm itemCode).
  useEffect(() => {
    const lines = (selectedPO as { lineConnectingDates?: IssuedPoLineConnectingDate[] } | null)?.lineConnectingDates;
    if (!lines) { setConnectingDateDraft({}); return; }
    const seed: Record<string, string> = {};
    for (const l of lines) seed[normConnectingDateKey(l.itemCode)] = l.overrideIso ?? '';
    setConnectingDateDraft(seed);
  }, [selectedPO?.backendPoId, selectedPO?.poNumber]);
  const poLocked = poLock.onHold || poLock.cancelled;
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
  /** Quantity of each line assigned to Split PO 1; the remainder goes to Split PO 2. */
  const [splitQtyForS1, setSplitQtyForS1] = useState<Record<number, string>>({});
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
  const [approveDraftPOBusy, setApproveDraftPOBusy] = useState(false);
  const [submitSplitPOBusy, setSubmitSplitPOBusy] = useState(false);
  const [createDraftPOBusy, setCreateDraftPOBusy] = useState(false);
  const [editRequestSaving, setEditRequestSaving] = useState(false);
  const [releaseDraftBusy, setReleaseDraftBusy] = useState(false);
  const [editDraftPOSaving, setEditDraftPOSaving] = useState(false);
  const [approveCreateDraftPOBusy, setApproveCreateDraftPOBusy] = useState(false);
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
  const [grnTrackerCount, setGrnTrackerCount] = useState(0);
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
  /** PO type picked at Draft-PO release time (Flowchart §5 / Sub-flow D). */
  const [releasePoType, setReleasePoType] = useState<PoType>('regular');
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
  /** Live, issued PO. Used for "can this be shipped / does it block deleting the request". */
  const isIssuedLikePoStatus = useCallback(
    (status: unknown): boolean => isPoStatusIssuedLike(status as string),
    [],
  );
  /**
   * Which POs the Purchase Orders list shows — issued AND cancelled. Cancelling sets
   * purchase_orders.status to 'Cancelled', so the issued-only gate dropped the row entirely and the
   * view's Cancelled filter could never match anything. Kept separate from
   * `isIssuedLikePoStatus` so a cancelled PO still doesn't count as live anywhere else.
   */
  const isListedPoStatus = useCallback((status: unknown): boolean => isPoStatusListed(status as string), []);

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

  /** Vendor address / GSTIN / phone for the PO PDF, looked up from the vendor master by name. */
  const buildVendorPoPdfFields = (vendorName: string): { vendorAddress?: string; vendorGstin?: string; vendorPhone?: string } => {
    const key = String(vendorName ?? '').trim().toLowerCase();
    if (!key) return {};
    const v = (vendorClientList ?? []).find((x) => String(x.name ?? '').trim().toLowerCase() === key);
    if (!v) return {};
    const d = v.data && typeof v.data === 'object' && !Array.isArray(v.data) ? (v.data as Record<string, unknown>) : {};
    const str = (x: unknown) => String(x ?? '').trim();
    const addr = [
      str(d.billingAddress ?? d.shippingAddress),
      str(v.city),
      [str(d.pincode ?? d.pin_code), str(d.state)].filter(Boolean).join(' '),
      str(d.country),
    ].filter(Boolean).join('\n');
    return {
      vendorAddress: addr || undefined,
      vendorGstin: str(d.gstin) || undefined,
      vendorPhone: str(v.phone) || undefined,
    };
  };

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
    enabled: !!selectedStockCheckRequest || !!selectedRequest || !!stockAuditReq,
    staleTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const stockAuditItemWhInvId = useMemo(() => {
    if (!stockAuditReq) return null;
    const item = stockAuditReq.itemDetails?.[0];
    const whRows = warehouseInventoryData?.rows ?? [];
    if (!item || !whRows.length) return null;
    const rmId = item.raw_material_id != null ? Number(item.raw_material_id) : NaN;
    const pmId = item.pack_material_id != null ? Number(item.pack_material_id) : NaN;
    let row = Number.isFinite(rmId) && rmId > 0 ? whRows.find((r) => r.type === 'RM' && Number(r.sourceId) === rmId) : undefined;
    if (!row && Number.isFinite(pmId) && pmId > 0) {
      row = whRows.find((r) => r.type === 'PM' && Number(r.sourceId) === pmId);
    }
    if (!row) {
      const codeKey = String(item.itemCode ?? '').trim().toLowerCase();
      if (codeKey) row = whRows.find((r) => String(r.code ?? '').trim().toLowerCase() === codeKey);
    }
    if (!row) {
      const nameKey = String(item.itemName ?? '').trim().toLowerCase();
      if (nameKey) row = whRows.find((r) => String(r.name ?? '').trim().toLowerCase() === nameKey);
    }
    const wid = row?.warehouseInventoryId;
    return wid != null && Number(wid) > 0 ? Number(wid) : null;
  }, [stockAuditReq, warehouseInventoryData?.rows]);

  const { data: warehouseLocationsForAudit = [], isLoading: warehouseLocationsLoading } = useQuery({
    queryKey: ['warehouse-locations', 'stock-audit'],
    queryFn: async () => {
      const res = await fetchWarehouseLocations('warehouse');
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Failed to load warehouse locations');
      return res.data ?? [];
    },
    enabled: !!stockAuditReq,
  });

  const { data: stockByLocationForAudit } = useQuery({
    queryKey: ['stock-by-location', 'stock-audit', stockAuditItemWhInvId],
    queryFn: async () => {
      const res = await fetchStockByLocation(stockAuditItemWhInvId!);
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Failed to load stock by location');
      return res.data;
    },
    enabled: stockAuditItemWhInvId != null && stockAuditItemWhInvId > 0,
  });

  const stockAuditWarehouses = useMemo(() => {
    const base = buildStockAuditWarehousesFromLocations(warehouseLocationsForAudit);
    return mergeStockByLocationIntoWarehouses(base, stockByLocationForAudit);
  }, [warehouseLocationsForAudit, stockByLocationForAudit]);

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
      // Policy: a Procurement request may be released to a Draft PO irrespective of quantity already
      // committed on other draft/released POs (no "locked-qty" cap). The releasable qty defaults to the
      // full requested quantity; the previous committed-PO subtraction is intentionally not applied.
      return Math.max(0, Number(args.totalReqQty) || 0);
    },
    [],
  );

  /**
   * All released (or completed) backend PO ids — batch-fetch po-tracking so linked split POs show
   * Delivered / GRN steps correctly.
   *
   * Completed POs MUST stay in this scope even though they're no longer "issued-like": the
   * poWorkflowStatus derivation below reads `completed` off `tr?.grnCompleteAt` from this very
   * tracking map. Scoping the fetch to issued-like statuses only meant the instant a PO's backend
   * status flipped to 'Completed', its id dropped out of this list, the tracking fetch for it never
   * ran again, `tr` came back undefined, and the row silently fell back through every branch to the
   * default 'issued' — so a PO could never actually be SEEN as Completed once it became Completed.
   */
  const releasedPoBackendIdsForTracking = useMemo(() => {
    const ids = purchaseOrders
      .filter((p) => isIssuedLikePoStatus(p.status) || isPoStatusCompleted(p.status))
      .map((p) => String(p.id ?? '').replace(/^PO-/, ''))
      .filter((id) => /^\d+$/.test(id));
    return [...new Set(ids)].sort();
  }, [isIssuedLikePoStatus, purchaseOrders]);

  const { data: releasedPoTrackingByBackendId } = useQuery({
    queryKey: ['po-tracking-released-map', releasedPoBackendIdsForTracking.join(',')],
    queryFn: async () => {
      const res = await fetchPoTrackingBatch(releasedPoBackendIdsForTracking);
      return (res.success ? res.data : null) ?? ({} as Record<string, PoTrackingRecord>);
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
    sideSection === 'Procurement Requests' ||
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

  // Combined RM+PM catalog for the "add new item" picker on an already-released PO.
  const poAddItemCatalog = useMemo(
    () => [...(itemsListRm ?? []), ...(itemsListPm ?? [])],
    [itemsListRm, itemsListPm]
  );

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

  /**
   * Live backend status of the PO behind the open Draft-PO panel.
   *
   * `draftPOs` only holds purchase orders whose status is still 'Draft'. Once a PO is approved and
   * sent to the vendor the backend flips it to 'Released', so it drops out of that list — but the
   * open panel kept rendering the snapshot it was opened with, still showing "Pending Approval" and
   * still offering "Release PO to Vendor". Clicking it looked the PO up in `draftPOs`, missed, and
   * reported "Draft PO not found" for a PO that exists and is simply no longer a draft.
   *
   * Resolved against the full `purchaseOrders` list (not `draftPOs`) so it is null while loading
   * rather than briefly claiming a live draft has been released.
   */
  const selectedDraftPOLiveStatus = useMemo(() => {
    const bid = poBackendId(String(selectedDraftPO?.backendPoId ?? ''));
    if (!bid) return null;
    // The two id shapes differ: the PO list carries "PO-1091" (`toOrder` prefixes by type) while a
    // DraftPO carries the bare "1091". Comparing them raw never matched, so this always resolved to
    // null and the guard below silently did nothing — the panel kept offering Release on a PO that
    // had already been released. Normalise both sides through the same helper.
    const po = purchaseOrders.find((p) => poBackendId(String(p.id ?? '')) === bid);
    return po ? String(po.status ?? '').trim() : null;
  }, [selectedDraftPO?.backendPoId, purchaseOrders]);

  const selectedDraftPONoLongerDraft =
    selectedDraftPOLiveStatus != null && selectedDraftPOLiveStatus !== 'Draft';

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
    const confirmedQuote = selectedDraftPO.requestId
      ? quotes.find((q) => q.requestId === selectedDraftPO.requestId && q.status === 'Confirmed')
      : null;
    const enrichedLines: DraftPOLineItem[] = selectedDraftPO.lineItems.map((line) => {
      const qty = parseFloat(String(line.qty).replace(/[^\d.]/g, '')) || 0;
      const gstPercent = line.gstPercent != null ? Number(line.gstPercent) : 18;
      const storedPrice = Number(line.pricePerUnit) || 0;

      if (storedPrice > 0) {
        // The line already carries a real price — set directly via the qty/price/GST editor (or
        // a prior save). Trust it and its already-computed GST/total instead of silently
        // overriding with a confirmed-quote or Items List catalog price, which previously made
        // an explicit price/GST edit (e.g. GST set to 0%) revert to the catalog value here even
        // though the edit itself had saved correctly.
        const subtotal = qty * storedPrice;
        const gstAmount = line.gstAmount != null ? Number(line.gstAmount) : parseFloat((subtotal * (gstPercent / 100)).toFixed(2));
        const lineTotal = line.lineTotal != null ? Number(line.lineTotal) : parseFloat((subtotal + gstAmount).toFixed(2));
        return { ...line, pricePerUnit: storedPrice, gstPercent, gstAmount, lineTotal };
      }

      // No price yet on the line — fall back to a confirmed quote, then the Items List vendor price.
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
      const priceFromList = price ?? 0;
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

      // Bump matching pending planning quotation asks so Quote Requests reflects the new qty
      const matchedAsks = planningQuotationAsksPending.filter((ask) => {
        if (line.raw_material_id != null && Number(line.raw_material_id) > 0 && ask.rawMaterialId != null) {
          return Number(ask.rawMaterialId) === Number(line.raw_material_id);
        }
        if (line.pack_material_id != null && Number(line.pack_material_id) > 0 && ask.packMaterialId != null) {
          return Number(ask.packMaterialId) === Number(line.pack_material_id);
        }
        return line.itemCode
          ? String(ask.itemCode ?? '').trim().toLowerCase() === line.itemCode.trim().toLowerCase()
          : false;
      });
      if (matchedAsks.length > 0) {
        await Promise.all(
          matchedAsks.map((ask) =>
            updatePlanningQuotationAsk(ask.id, { quantityRequested: ask.quantityRequested + delta })
          )
        );
        void queryClient.invalidateQueries({ queryKey: ['planning-quotation-asks'] });
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
      planningQuotationAsksPending,
      purchaseOrdersRaw,
      queryClient,
      user?.name,
      warehouseInventoryData?.rows,
    ]
  );

  const handleReAuditInventoryAudit = useCallback(
    async (line: InventoryAuditLine, comment: string): Promise<void> => {
      const prRow = backendPrArray.find((p) => String(p.id) === line.requestId);
      if (!prRow) {
        addToast('error', 'Linked procurement request was not found.');
        return;
      }
      setInventoryAuditReAuditing(true);
      try {
        const notesParsed = parseStockCheckNotes(prRow.stockCheckNotes);
        const notesPayload = {
          version: 1,
          requestedAt: notesParsed?.requestedAt ?? new Date().toISOString(),
          requestedBy: notesParsed?.requestedBy ?? prRow.requestedBy ?? 'Procurement Team',
          reAuditComment: comment,
          reAuditAt: new Date().toISOString(),
          reAuditBy: user?.name?.trim() || 'Procurement',
          lines: notesParsed?.lines ?? [],
          warehouseCodes: (notesParsed as { warehouseCodes?: string[] } | null)?.warehouseCodes,
          comments: (notesParsed as { comments?: string } | null)?.comments,
        };
        const res = await updateProcurementRequestApi(line.requestId, {
          stockCheckStatus: 'Pending',
          stockCheckAssignedTo: null,
          stockCheckNotes: JSON.stringify(notesPayload),
        });
        if (!res.success) {
          addToast('error', typeof res.error === 'string' ? res.error : 'Failed to send re-audit request');
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
        addToast('success', 'Audit sent back to Warehouse for re-count.');
        setInventoryAuditDetailLine(null);
      } finally {
        setInventoryAuditReAuditing(false);
      }
    },
    [addToast, backendPrArray, queryClient, user?.name],
  );

  const handleTerminateInventoryAudit = useCallback(
    async (line: InventoryAuditLine, reason: string): Promise<void> => {
      const prRow = backendPrArray.find((p) => String(p.id) === line.requestId);
      if (!prRow) {
        addToast('error', 'Linked procurement request was not found.');
        return;
      }
      setInventoryAuditTerminating(true);
      try {
        const notesParsed = parseStockCheckNotes(prRow.stockCheckNotes);
        const notesPayload = {
          ...notesParsed,
          version: 1,
          terminated: true,
          terminatedAt: new Date().toISOString(),
          terminatedBy: user?.name?.trim() || 'Procurement',
          terminatedReason: reason || undefined,
        };
        const res = await updateProcurementRequestApi(line.requestId, {
          stockCheckStatus: 'Cancelled',
          stockCheckNotes: JSON.stringify(notesPayload),
        });
        if (!res.success) {
          addToast('error', typeof res.error === 'string' ? res.error : 'Failed to terminate audit');
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
        addToast('success', 'Stock audit terminated.');
        setInventoryAuditDetailLine(null);
      } finally {
        setInventoryAuditTerminating(false);
      }
    },
    [addToast, backendPrArray, queryClient, user?.name],
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

        // Zero-qty lines carry nothing to release — skip them (they no longer block the whole bucket,
        // since the committed-qty cap was removed; a line only hits 0 when its requested qty is 0).
        if (openQty <= 0) {
          continue;
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
      // Prefer the request's required-by date so the PO lands in the week the planner released for;
      // lead time is only the fallback. See lib/poExpectedDateFromPr.
      const expectedDeliveryStr = poExpectedDateFromPr({
        requiredByDate: (primaryRequest as { requiredByDate?: string | null } | undefined)?.requiredByDate ?? null,
        today,
        leadDays,
      });

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
    setAddDraftPoItemSearch('');
    setEditDraftPoPriceDraft({});
    setEditDraftPoGstDraft({});
    setEditDraftPoGstAmtDraft({});
    setEditDraftPoLeadDraft({});
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
    const nextSection = tab === 'Procurement' ? section ?? sideSection : 'Procurement Requests';
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

      if (sideSection === 'Procurement Requests') {
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
              isListedPoStatus(p.status) &&
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
                // `|| 18` treated an explicit 0% (tax genuinely removed) the same as "missing" and
                // silently forced it back to 18% — only default when tax is truly absent.
                const gstPct = i.tax != null && i.tax !== '' ? Number(i.tax) : 18;
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
              overrideDatesByCode: connectingOverridesFromFormData(linkedPO.formData),
            });
            const etaDays = etaPayload.etaDays;
            const etaDateDisplay = etaPayload.etaDateDisplay;
            const rowStatus: 'Released' | 'In Transit' | 'At Risk' = rowInTransit
              ? 'In Transit'
              : etaDays < 0 || (request.priority === 'High' && etaDays <= 2)
                ? 'At Risk'
                : 'Released';
            const hasTs = (v: string | null | undefined) => v != null && String(v).trim() !== '';
            return {
              request,
              poNumber: String(linkedPO.poNumber ?? draftOverlay?.dpoNumber ?? request.code).replace('DPO', 'PO'),
              vendor: linkedPO.vendorName ?? draftOverlay?.vendor ?? linkedQuote?.vendor ?? 'Unassigned Vendor',
              status: rowStatus,
              poWorkflowStatus: isPoStatusCancelled(linkedPO.status) ? 'cancelled' as const
                : hasTs(tr?.grnCompleteAt) ? 'completed' as const
                : (hasTs(tr?.underGrnAt) || hasTs(tr?.deliveredAt)) ? 'accepted' as const
                : hasTs(tr?.shippedAt) ? 'issued' as const
                : hasTs(tr?.advancePaidAt) ? 'awaiting_payment' as const
                : 'issued' as const,
              etaDays,
              etaDateDisplay,
              lineItems,
              grandTotal,
              requestCode: request.code,
              createdDate: linkedPO.date ?? draftOverlay?.createdDate ?? request.createdDate ?? '',
              paymentTerms: linkedPO.paymentTerms ?? draftOverlay?.paymentTerms ?? linkedQuote?.terms ?? 'As per contract',
              backendPoId: /^\d+$/.test(backendPoId) ? backendPoId : undefined,
              // etaPayload.lineDates already resolves manual override ?? lead-time-derived date per
              // line — using only the raw override map here left every PO with no manual override
              // showing "—" in the Connecting column even though a real expected date was computable.
              connectingDateByItem: connectingDateByItemFromLineDates(etaPayload.lineDates, request),
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
            // Draft PO rows never carried a Connecting date at all — a draft still has a computable
            // expected date (lead time / PR due date), it just hasn't been released yet.
            connectingDateByItem: connectingDateByItemFromLineDates(draftEta.lineDates, request),
          },
        ];
      });

    // Include released PO records even when there is no linked procurement request.
    // This happens for Draft POs created from Planning > Items Involved.
    const requestPoNumbers = new Set(requestRecords.map((r) => r.poNumber));

    const unlinkedReleasedPOs = purchaseOrders
      .filter((p) => isListedPoStatus(p.status))
      .filter((p) => {
        const poNumber = String(p.poNumber ?? '').replace('DPO', 'PO');
        if (requestPoNumbers.has(poNumber)) return false;

        const linked = requests.some((r) =>
          (String(p.formData?.requestId) && String(p.formData?.requestId) === String(r.id)) ||
          (String(p.formData?.requestCode) && String(p.formData?.requestCode).toUpperCase() === String(r.code).toUpperCase())
        );
        // A cancelled PO reopens its procurement request (cancelPo → syncRequestStatus 'New'), and
        // 'New' is not in REQUEST_STATUSES_FOR_ISSUED_PO_LIST — so the request-linked branch above
        // skips it while this one used to reject it for being linked at all. That pincer hid every
        // cancelled PO that had a request, independently of the status gate. The
        // `requestPoNumbers` check above already prevents a double row when the request DID emit it.
        return !linked || isPoStatusCancelled(p.status);
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
        // `|| 18` treated an explicit 0% (tax genuinely removed) the same as "missing" and
        // silently forced it back to 18% — only default when tax is truly absent.
        const gstPct = i.tax != null && i.tax !== '' ? Number(i.tax) : 18;
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
        overrideDatesByCode: connectingOverridesFromFormData(po.formData),
      });

      const hasTs2 = (v: string | null | undefined) => v != null && String(v).trim() !== '';
      return {
        request: placeholderRequest,
        poNumber: String(po.poNumber ?? po.reference ?? '').replace('DPO', 'PO'),
        vendor: po.vendorName ?? 'Unassigned Vendor',
        status: (ov?.shipped || ov?.delivered || ov?.underGrn || tracking?.shippedAt || tracking?.deliveredAt || tracking?.underGrnAt || tracking?.grnCompleteAt)
          ? ('In Transit' as const)
          : ('Released' as const),
        poWorkflowStatus: isPoStatusCancelled(po.status) ? 'cancelled' as const
          : hasTs2(tracking?.grnCompleteAt) ? 'completed' as const
          : (hasTs2(tracking?.underGrnAt) || hasTs2(tracking?.deliveredAt) || ov?.underGrn || ov?.delivered) ? 'accepted' as const
          : (hasTs2(tracking?.shippedAt) || ov?.shipped) ? 'issued' as const
          : hasTs2(tracking?.advancePaidAt) ? 'awaiting_payment' as const
          : 'issued' as const,
        backendPoId,
        etaDays: unlinkedEta.etaDays,
        etaDateDisplay: unlinkedEta.etaDateDisplay,
        lineItems,
        grandTotal,
        requestCode: placeholderRequest.code,
        createdDate: po.date ?? '',
        paymentTerms: po.paymentTerms ?? 'As per contract',
        connectingDateByItem: connectingDateByItemFromLineDates(unlinkedEta.lineDates, placeholderRequest),
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
    // NOTE: this used to also filter out rows where isIssuedPoHandedOffToWarehouse() was true
    // ("hide from Issued POs — tracked in GRN Monitor / Inbound instead"). That exclusion's only
    // two real consumers (filteredIssuedPORecords, issuedPoOverviewKpis — a dead kanban board and
    // an unrendered KPI memo) are never actually rendered anywhere in the app; this array's only
    // live consumer is purchaseOrderViewRecords, i.e. the Purchase Orders list itself. So the
    // exclusion's only real-world effect was to silently drop a PO from the Purchase Orders list
    // the moment it was delivered / under GRN / completed — the exact "completed PO not showing"
    // bug this was all chasing. Once the po-tracking-purchase-orders batch route actually started
    // returning data (it 404'd before), this filter went from a no-op (tracking was always {}, so
    // isIssuedPoHandedOffToWarehouse was always false) to actively hiding ~17 real POs.
    return Array.from(dedupedByPo.values());
  }, [draftPOs, isListedPoStatus, purchaseOrders, quotes, requests, releasedPoTrackingByBackendId, unlinkedPoTimelineOverrides]);

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
      'Procurement Requests': procurementRequestTabCounts.active,
      'Purchase Orders': purchaseOrderViewRecords.length,
      'Quote Requests': quotes.length + planningQuotationAsksPending.length,
      'Stock Audit': buildInventoryAuditLines(procurementRequestsList).length,
      'GRN Tracker': grnTrackerCount,
    }),
    [
      purchaseOrderViewRecords.length,
      grnTrackerCount,
      procurementRequestsList,
      planningQuotationAsksPending.length,
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
    // Per-line connecting dates (auto lead-time date + any manual override) for the modal editor.
    const connectingLineDates = computeIssuedPoEtaFromLeadTimes({
      today: new Date(),
      poReleaseDateStr: backendPo?.date ?? record.createdDate,
      request: record.request,
      linkedQuote: undefined,
      linkedPO: backendPo,
      lineItems: record.lineItems.map((l) => ({ item: l.item, itemCode: String(l.itemCode ?? '') })),
      overrideDatesByCode: connectingOverridesFromFormData(backendPo?.formData),
    }).lineDates;
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
      // Full data the PO PDF needs — previously unset, which made "PO PDF" throw on
      // `data.lines.reduce` (undefined lines) and leave a blank popup.
      vendor: record.vendor,
      lineItems: record.lineItems,
      grandTotal: record.grandTotal,
      createdDate: record.createdDate,
      paymentTerms: record.paymentTerms,
      requestCode: record.requestCode,
      requestId: record.request.id,
      contactPerson: 'Procurement Desk',
      backendPoId: backendPoId ?? undefined,
      // Carry form_data through so the detail modal can read + PATCH manual per-item connecting dates.
      formData: backendPo?.formData,
      lineConnectingDates: connectingLineDates,
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
    return updatePoTracking(backendPoId, {
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

  /** Vendor could not fulfil (Flowchart SENT→REJECTED). Uses the gated vendor endpoint (records + logs). */
  const markIssuedPOVendorRejected = (record: {
    backendPoId?: string;
    poNumber?: string;
    request?: { id?: string };
  }, note?: string) => {
    const backendPoId = resolveIssuedPoBackendId(record);
    if (!backendPoId) {
      addToast('error', 'Purchase order not found. Cannot record vendor rejection.');
      return;
    }
    return rejectPoByVendor(backendPoId, note).then((res) => {
      if (!res.success) {
        addToast('error', typeof res.error === 'string' ? res.error : 'Failed to record vendor rejection');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['po-tracking', backendPoId] });
      queryClient.invalidateQueries({ queryKey: ['po-tracking-released-map'] });
      addToast('success', `${String(record.poNumber ?? 'PO')} — vendor rejection recorded`);
    });
  };

  const markIssuedPOShipped = async (record: {
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
        void updateRequestStatus(requestId, 'Delivery Pending', { skipItems: true });
        addToast('info', `${requestCode ?? 'PO'} marked delivery pending — link a released PO to update the timeline.`);
        return;
      }
      addToast('error', 'Purchase order not found. Cannot mark shipped.');
      return;
    }

    // The batch map only loads inside the Purchase Orders section and only for POs in
    // releasedPoBackendIdsForTracking, so a PO opened from Planning has no entry and this gate used
    // to reject it as "vendor not confirmed" while the timeline right above showed it confirmed.
    // Fall back to this PO's own tracking row before deciding.
    let tracking = releasedPoTrackingByBackendId?.[backendPoId];
    if (!tracking) {
      const fresh = await fetchPoTracking(backendPoId);
      if (fresh.success) tracking = fresh.data ?? undefined;
    }
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
    return updatePoTracking(backendPoId, {
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

        const itemsForGrn = items.map((it) => ({ ...it, partial_release_remainder: true }));
        const statusRes = await updateProcurementRequestApi(requestId, { status: 'Under GRN' as RequestStatus, items: itemsForGrn });
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
    if (createDraftPOBusy) return false;
    setCreateDraftPOBusy(true);
    try {
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
    const expectedDeliveryStr = poExpectedDateFromPr({
      requiredByDate: (reqForAction as { requiredByDate?: string | null } | undefined)?.requiredByDate ?? null,
      today,
      leadDays: leadDaysForDelivery,
    });
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
    } finally {
      setCreateDraftPOBusy(false);
    }
  };

  /**
   * Why a draft-PO lookup missed.
   *
   * `draftPOs` holds only status==='Draft' purchase orders, so a PO that has been approved and
   * released is absent by design — "Draft PO not found" then reads as data loss for a PO that is
   * alive and simply past this stage.
   */
  const draftPoLookupMessage = (draftPoId: string): string => {
    const po = purchaseOrders.find(
      (p) =>
        String(p.poNumber ?? '') === String(draftPoId) ||
        poBackendId(String(p.id ?? '')) === poBackendId(String(draftPoId)),
    );
    const status = po ? String(po.status ?? '').trim() : '';
    if (status && status !== 'Draft') {
      return `${draftPoId} is already ${status} — it is no longer a draft PO.`;
    }
    return 'Draft PO not found — refresh the page and try again.';
  };

  const approveDraftPO = async (draftPoId: string) => {
    if (approveDraftPOBusy) return;
    setApproveDraftPOBusy(true);
    try {
    const target = draftPOs.find((draftPo) => draftPo.id === draftPoId);

    if (!target) {
      addToast('warning', draftPoLookupMessage(draftPoId));
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
    } finally {
      setApproveDraftPOBusy(false);
    }
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
            items: plan.items.map((it) => ({ ...it, partial_release_remainder: true })),
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
      addToast('warning', draftPoLookupMessage(draftPoId));
      return false;
    }

    if (target.status !== 'Approved') {
      addToast('warning', `${target.dpoNumber} must be approved before release`);
      return false;
    }

    const backendRequestId = resolveBackendProcurementRequestId(target);
    if (!backendRequestId) {
      // Planning-created draft POs (from Planning > Items Involved) may not be linked to a procurement_requests row.
      // In that case, we can still release the underlying purchase order and show it in "Issued POs".
      addToast('warning', `${target.dpoNumber} released (no backend procurement request link; created from Planning).`);
      applyRouteState('Procurement', 'Purchase Orders');
      return true;
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
      addToast('warning', draftPoLookupMessage(draftPoId));
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
    // Update PO table: set status to Released and ensure request link is stored
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
      const updateResult = await updatePurchaseOrder(draft.backendPoId, {
        status: 'Released',
        formData: { requestId: backendRequestId || draft.requestId, requestCode: draft.requestCode },
        items: poItemsPayload,
      });
      if (!updateResult.success) {
        const err = updateResult.error;
        addToast('error', typeof err === 'string' ? err : (err?.message ?? 'Failed to update purchase order'));
        return;
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
      addToast('warning', draftPoLookupMessage(draftPoId));
      return;
    }

    if (target.status !== 'Approved') {
      addToast('warning', `${target.dpoNumber} must be approved before split`);
      return;
    }

    // A single-line PO is splittable by QUANTITY (50,000 bottles → 30,000 + 20,000), so only an
    // empty PO is refused. The old "need 2 items" rule assumed splits only moved whole lines.
    if (target.lineItems.length === 0) {
      addToast('warning', 'This PO has no items to split');
      return;
    }

    setSplitPOTarget(target);
    // Start with no preselection to avoid accidental S1 assignment.
    setSplitSelectedLineIndexes([]);
    setSplitQtyForS1({});
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
    if (submitSplitPOBusy) return;
    setSubmitSplitPOBusy(true);
    try {
    if (!splitPOTarget) return;

    // Quantity-based split: a ticked line contributes its typed quantity (default = all of it) to
    // S1, and whatever is left of that line goes to S2. This is what makes a single-line PO
    // splittable — the old index-only split could only move whole lines.
    const qtyPlan: Record<number, number> = {};
    splitPOTarget.lineItems.forEach((line, index) => {
      if (!splitSelectedLineIndexes.includes(index)) return;
      const typed = String(splitQtyForS1[index] ?? '').trim();
      qtyPlan[index] = typed === '' ? lineQtyNumber(line) : Number(typed);
    });

    const plan = splitLinesByQuantity(splitPOTarget.lineItems, qtyPlan);
    if (plan.error) {
      addToast('warning', plan.error);
      return;
    }

    const selectedLineItems = plan.s1;
    const remainingLineItems = plan.s2;

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
      // A partially split line appears on BOTH sides, so the PR item is looked up by the line's
      // ORIGINAL index rather than by its position in the produced list.
      const assignedOne = plan.s1SourceIndexes.map((idx) => fullAssigned[idx]);
      const assignedTwo = plan.s2SourceIndexes.map((idx) => fullAssigned[idx]);

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
    } finally {
      setSubmitSplitPOBusy(false);
    }
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
      // Always prefer the freshest API data — requestsFromApi is a sync memo from backendPrResult
      // so it updates immediately after a PR edit refetch, before the requests-state useEffect fires.
      const liveReq = requestsFromApi.find((r) => r.id === req.id) ?? req;
      setReleasePoType('regular');
      if (liveReq.itemDetails && liveReq.itemDetails.length > 0) {
        const item = liveReq.itemDetails[0];
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
        setReleaseToPlannedTarget({ request: liveReq, item: relItem });
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
        const vendorSlabs0 = (matchedItem0?.vendorRates ?? []).flatMap((rate) =>
          (rate.tiers ?? []).map((tier) => ({
            vendor: String(rate.vendor_name ?? '').trim(),
            moq: Number(tier.moq_min ?? 0) || 0,
            unitPrice: Number(tier.price_per_unit ?? 0) || 0,
            leadDays: Number(rate.lead_time_days ?? 0) || 0,
            terms: String(rate.payment_terms ?? '').trim() || 'As per contract',
          }))
        );
        // The vendor the request is planned for decides the draft. Only that vendor's slab
        // may set price / lead / terms — using the first rate on the item paired one vendor's
        // name with another vendor's pricing.
        const plannedVendor0 = String(liveReq.preferredVendor ?? '').trim();
        const itemsListSlab0 = plannedVendor0
          ? vendorSlabs0.find((v) => v.vendor.toLowerCase() === plannedVendor0.toLowerCase())
          : vendorSlabs0.find((v) => v.vendor);
        const reqQuotesForItem = quotes.filter(
          (q) => q.requestId === liveReq.id && q.lines.some((l) => quoteLineMatchesReleaseTarget(l, relItem))
        );
        const first = reqQuotesForItem[0];
        const firstLine = first?.lines.find((l) => quoteLineMatchesReleaseTarget(l, relItem));
        const pt0 = parsePaymentTermsString(itemsListSlab0?.terms ?? first?.terms ?? 'As per contract');
        setReleaseToPlannedForm({
          vendor: plannedVendor0 || first?.vendor || itemsListSlab0?.vendor || '',
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
          (liveReq.itemDetails ?? []).map((d) => {
            const totalReqQty = Number(d.reqQty ?? 0) || 0;
            const oq = resolveOpenQtyForReleaseItem({
              requestId: liveReq.id,
              reqType: liveReq.type,
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
        const vendorSlabs1 = (matchedItem1?.vendorRates ?? []).flatMap((rate) =>
          (rate.tiers ?? []).map((tier) => ({
            vendor: String(rate.vendor_name ?? '').trim(),
            unitPrice: Number(tier.price_per_unit ?? 0) || 0,
            leadDays: Number(rate.lead_time_days ?? 0) || 0,
            terms: String(rate.payment_terms ?? '').trim() || 'As per contract',
          }))
        );
        // The vendor the request is planned for decides the draft. Only that vendor's slab
        // may set price / lead / terms — using the first rate on the item paired one vendor's
        // name with another vendor's pricing.
        const plannedVendor1 = String(req.preferredVendor ?? '').trim();
        const itemsListSlab1 = plannedVendor1
          ? vendorSlabs1.find((v) => v.vendor.toLowerCase() === plannedVendor1.toLowerCase())
          : vendorSlabs1.find((v) => v.vendor);
        const reqQuotesForItem = quotes.filter(
          (q) => q.requestId === req.id && q.lines.some((l) => quoteLineMatchesReleaseTarget(l, relItem))
        );
        const first = reqQuotesForItem[0];
        const firstLine = first?.lines.find((l) => quoteLineMatchesReleaseTarget(l, relItem));
        const pt1 = parsePaymentTermsString(itemsListSlab1?.terms ?? first?.terms ?? 'As per contract');
        setReleaseToPlannedForm({
          vendor: plannedVendor1 || first?.vendor || itemsListSlab1?.vendor || '',
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
      requestsFromApi,
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
    const res = await updateProcurementRequestApi(requestId, payload);
    if (!res.success) {
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
    <div className="min-h-screen bg-canvas text-ink">
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

              {sideSection === 'Procurement Requests' && (
                <PrInboxView
                  requests={procurementRequestsList}
                  onEdit={(req) => setPrEditReq(req)}
                  onDelete={(req) => openDeleteRequestConfirm(req)}
                  onRequestQuote={(req) => {
                    const first = (req.itemDetails ?? [])[0];
                    const itemType: 'RM' | 'PM' =
                      first?.type === 'PM' || (first?.pack_material_id != null && first?.raw_material_id == null)
                        ? 'PM'
                        : req.type === 'PM'
                          ? 'PM'
                          : 'RM';
                    setQuoteRequestCtx({
                      itemType,
                      itemCode: first?.itemCode ?? '',
                      itemName: first?.itemName ?? '',
                      rawMaterialId: first?.raw_material_id ?? null,
                      packMaterialId: first?.pack_material_id ?? null,
                      unit: first?.unit,
                      defaultQty: first?.reqQty != null && first.reqQty > 0 ? first.reqQty : undefined,
                      // Procurement-origin RFQ (no planning link) — let them switch/confirm the item.
                      allowItemPick: true,
                    });
                  }}
                  onStockAudit={(req) => {
                    if (isOpenStockCheckStatus(req.stockCheckStatus) || isStockCheckOneTimeCompleted(req)) {
                      openStockCheckModal(req);
                      return;
                    }
                    setStockAuditReq(req);
                  }}
                  onDraftPO={(req) => openReleaseToDraftPoForRequest(req)}
                  onNewPr={() => setShowNewPr(true)}
                />
              )}

              {showNewPr && (
                <NewPrModal
                  onClose={() => setShowNewPr(false)}
                  onCreate={async (payload) => {
                    const res = await createProcurementRequestApi(payload);
                    if (res.success) {
                      addToast('success', 'Procurement request created.');
                      await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                      return true;
                    }
                    addToast('error', typeof res.error === 'string' ? res.error : 'Failed to create PR.');
                    return false;
                  }}
                />
              )}

              {prEditReq && (
                <PrEditPopup
                  req={prEditReq}
                  onClose={() => setPrEditReq(null)}
                  onSave={async (payload) => {
                    const base = prEditReq;
                    const updatedDetails = (base.itemDetails ?? []).map((it, idx) =>
                      idx === 0
                        ? { ...it, reqQty: payload.qty, plannedPrice: payload.pricePerUnit, leadTimeDays: payload.leadDays }
                        : it,
                    );
                    const res = await updateProcurementRequestApi(base.id, {
                      items: itemDetailsToProcurementRequestItems(updatedDetails) as BackendPRItem[],
                      preferredVendor: payload.vendor,
                    });
                    if (res.success) {
                      await queryClient.refetchQueries({ queryKey: ['procurement-requests'] });
                      addToast('success', `PR ${base.code} updated.`);
                      setPrEditReq(null);
                    } else {
                      const errObj = res.error as { code?: string; message?: string } | null;
                      if (errObj && typeof errObj === 'object' && errObj.code === 'MOQ_NOT_MET') {
                        return { moqError: errObj.message ?? 'Quantity is below the vendor minimum order quantity.' };
                      }
                      addToast('error', typeof res.error === 'string' ? res.error : 'Failed to update PR.');
                    }
                  }}
                  onRaiseQuoteRequest={async (payload) => {
                    const base = prEditReq;
                    if (!base) return;
                    const item = base.itemDetails?.[0];
                    if (!item) return;
                    const res = await createPlanningQuotationAsk({
                      planningExtractedId: base.planningExtractedId,
                      itemType: (item.type as 'RM' | 'PM') ?? 'RM',
                      rawMaterialId: item.raw_material_id ?? undefined,
                      packMaterialId: item.pack_material_id ?? undefined,
                      itemCode: item.itemCode ?? undefined,
                      itemName: item.itemName ?? undefined,
                      quantityRequested: payload.qty,
                      unit: item.unit ?? undefined,
                      vendorHint: payload.vendor || null,
                      notes: `Quote request from PR ${base.code} — qty ${payload.qty} ${item.unit ?? ''} is below vendor MOQ.`,
                    });
                    if (res.success) {
                      addToast('success', `Quote request raised for ${item.itemName} — ${payload.qty} ${item.unit ?? ''}.`);
                      setPrEditReq(null);
                      void queryClient.invalidateQueries({ queryKey: ['planning-quotation-asks'] });
                    } else {
                      addToast('error', typeof res.error === 'string' ? res.error : 'Failed to raise quote request.');
                    }
                  }}
                />
              )}

              {stockAuditReq && (
                <StockAuditPopup
                  req={stockAuditReq}
                  warehouses={stockAuditWarehouses}
                  warehousesLoading={warehouseLocationsLoading || warehouseInventoryLoading}
                  onClose={() => setStockAuditReq(null)}
                  onSubmit={async (payload) => {
                    const base = stockAuditReq;
                    const dispatch = buildProcurementStockAuditSubmitPayload(
                      base,
                      payload,
                      stockAuditWarehouses,
                      user?.name?.trim() || 'Procurement Team',
                    );
                    const res = await updateProcurementRequestApi(base.id, dispatch);
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
                  vendors={vendorClientList ?? []}
                  vendorsLoading={vendorClientsLoading}
                  onEditQuote={(quote) => {
                    const req = requests.find((r) => String(r.id) === String(quote.requestId));
                    if (req) openRecordQuoteFromRequest(req);
                  }}
                  onNewQuoteRequest={() => applyRouteState('Procurement', 'Requests')}
                  onQuoteRecorded={() => {
                    void queryClient.refetchQueries({ queryKey: ['items-list-page', 'RM'], type: 'active' });
                    void queryClient.refetchQueries({ queryKey: ['items-list-page', 'PM'], type: 'active' });
                    addToast('success', 'Quotation recorded to the Items List (price list).');
                  }}
                />
              )}



              {/* Items List tier edit modal (Quotations view writes to Items List) */}
              {editItemsListLineTarget && (
                <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center px-4">
                  <div role="dialog" aria-modal="true" aria-label="Edit vendor tier (Items List)" className="w-full max-w-2xl rounded-xl bg-surface shadow-xl border border-border overflow-hidden">
                    <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-bold text-ink">Edit vendor tier (Items List)</h3>
                        <p className="text-xs text-ink-3 mt-1">
                          {editItemsListLineTarget.vendorName} · {editItemsListLineTarget.requestType} · {editItemsListLineTarget.itemCode || '—'} {editItemsListLineTarget.itemName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditItemsListLineTarget(null)}
                        className="px-2 py-1 rounded-md border border-border text-ink-2 hover:bg-surface-3 text-xs font-semibold"
                        disabled={editItemsListLineSaving}
                      >
                        Close
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">MOQ min</label>
                          <input
                            value={editItemsListLineForm.moqMin}
                            onChange={(e) => setEditItemsListLineForm((f) => ({ ...f, moqMin: e.target.value }))}
                            type="number"
                            min={1}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            disabled
                          />
                          <p className="text-[11px] text-ink-3 mt-1">MOQ min can’t be edited here. Create a new tier from Items List.</p>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">MOQ max (optional)</label>
                          <input
                            value={editItemsListLineForm.moqMax}
                            onChange={(e) => setEditItemsListLineForm((f) => ({ ...f, moqMax: e.target.value }))}
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            disabled={editItemsListLineSaving}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">Price / unit (₹)</label>
                        <input
                          value={editItemsListLineForm.pricePerUnit}
                          onChange={(e) => setEditItemsListLineForm((f) => ({ ...f, pricePerUnit: e.target.value }))}
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-full max-w-xs rounded-lg border border-border px-3 py-2 text-sm"
                          disabled={editItemsListLineSaving}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">
                          Payment terms
                        </label>
                        <p className="text-[11px] text-ink-3 mb-2">
                          Same three-way split as Items List and vendor masters (advance, pre-shipment, post-shipment, credit days).
                        </p>
                        <div className="overflow-auto max-h-[70vh] rounded-md border border-border bg-surface">
                          <table className="w-full max-w-xl text-xs border-collapse">
                            <thead className="sticky top-0 z-20 [&_th]:bg-surface-3">
                              <tr className="bg-surface-3 text-left text-ink-3">
                                <th scope="col" className="px-2 py-1.5 font-semibold border-b border-border">Advance %</th>
                                <th scope="col" className="px-2 py-1.5 font-semibold border-b border-border">Pre-ship %</th>
                                <th scope="col" className="px-2 py-1.5 font-semibold border-b border-border">Post-ship %</th>
                                <th scope="col" className="px-2 py-1.5 font-semibold border-b border-border">Credit days</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="px-2 py-1.5 border-t border-hairline">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editItemsListLineForm.advancePct}
                                    onChange={(e) =>
                                      setEditItemsListLineForm((f) => ({ ...f, advancePct: e.target.value }))
                                    }
                                    className="w-full min-w-[4rem] rounded border border-border px-2 py-1 text-sm tabular-nums"
                                    disabled={editItemsListLineSaving}
                                  />
                                </td>
                                <td className="px-2 py-1.5 border-t border-hairline">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editItemsListLineForm.preShipmentPct}
                                    onChange={(e) =>
                                      setEditItemsListLineForm((f) => ({ ...f, preShipmentPct: e.target.value }))
                                    }
                                    className="w-full min-w-[4rem] rounded border border-border px-2 py-1 text-sm tabular-nums"
                                    disabled={editItemsListLineSaving}
                                  />
                                </td>
                                <td className="px-2 py-1.5 border-t border-hairline">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editItemsListLineForm.postShipmentPct}
                                    onChange={(e) =>
                                      setEditItemsListLineForm((f) => ({ ...f, postShipmentPct: e.target.value }))
                                    }
                                    className="w-full min-w-[4rem] rounded border border-border px-2 py-1 text-sm tabular-nums"
                                    disabled={editItemsListLineSaving}
                                  />
                                </td>
                                <td className="px-2 py-1.5 border-t border-hairline">
                                  <input
                                    type="number"
                                    min={0}
                                    value={editItemsListLineForm.creditDays}
                                    onChange={(e) =>
                                      setEditItemsListLineForm((f) => ({ ...f, creditDays: e.target.value }))
                                    }
                                    className="w-full min-w-[4rem] rounded border border-border px-2 py-1 text-sm tabular-nums"
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
                          className="px-4 py-2 rounded-lg border border-border text-ink-2 hover:bg-surface-3 text-sm font-semibold"
                          disabled={editItemsListLineSaving}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveEditItemsListTier}
                          className="px-4 py-2 rounded-lg bg-brand text-white hover:bg-brand-press text-sm font-semibold disabled:opacity-60"
                          disabled={editItemsListLineSaving}
                        >
                          {editItemsListLineSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                      <p className="text-[11px] text-ink-3">
                        This updates the existing Items List tier (no new entries created from Procurement).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {sideSection === 'Purchase Orders' && (
                <>
                  {showNewPo && (
                    <NewPoModal
                      poNumber={nextSequentialDpoOrderId(purchaseOrders, draftPOs)}
                      vendors={vendors.map((v) => ({ id: v.id, name: v.name, vendorCode: v.vendorCode, paymentTerms: v.paymentTerms }))}
                      onClose={() => setShowNewPo(false)}
                      onCreate={async (payload) => {
                        const res = await createPurchaseOrder(payload);
                        if (res.success) {
                          addToast('success', `Draft PO ${payload.orderId} created.`);
                          await invalidatePurchaseOrdersQueries();
                          return true;
                        }
                        addToast('error', typeof res.error === 'string' ? res.error : 'Failed to create PO.');
                        return false;
                      }}
                    />
                  )}
                  {requestsPODraftNoDraftPO.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Marked PO Draft — open PR to create Draft PO</p>
                      {requestsPODraftNoDraftPO.map((req) => (
                        <article key={req.id} className="rounded-xl border border-[color:var(--st-amber-fg)]/30 bg-warn-soft px-5 py-4 flex items-center justify-between gap-4 shadow-[var(--e1)]">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-warn-soft text-warn">{req.code}</span>
                            <span className="text-sm text-ink-2">No draft PO yet</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(req)}
                            className="px-4 py-2 rounded-lg bg-warn text-white text-sm font-semibold hover:brightness-95 transition"
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
                    onNewPo={() => setShowNewPo(true)}
                    onExport={() => {
                      const cols = ['PO #', 'Vendor', 'Status', 'Value (INR)', 'Created Date', 'Payment Terms'];
                      const rows = filteredPurchaseOrderRecords.map((r) => [
                        r.poNumber,
                        `"${(r.vendor ?? '').replace(/"/g, '""')}"`,
                        r.poWorkflowStatus ?? r.status,
                        r.grandTotal ?? 0,
                        r.createdDate ?? '',
                        `"${(r.paymentTerms ?? '').replace(/"/g, '""')}"`,
                      ].join(','));
                      const csv = [cols.join(','), ...rows].join('\n');
                      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  />
                </>
              )}


              {sideSection === 'GRN Tracker' && <GrnTrackerView onCountChange={setGrnTrackerCount} />}

              {sideSection === 'Stock Audit' && (
                <StockAuditTrackerView
                  requests={procurementRequestsList}
                  onOpenPr={(pr) => setPrEditReq(pr)}
                  onOpenAudit={(line) => setInventoryAuditDetailLine(line)}
                />
              )}

              {inventoryAuditDetailLine && (
                <InventoryAuditDetailModal
                  line={inventoryAuditDetailLine}
                  onClose={() => setInventoryAuditDetailLine(null)}
                  approving={inventoryAuditApproving}
                  reAuditing={inventoryAuditReAuditing}
                  terminating={inventoryAuditTerminating}
                  onApproveGap={async (line) => {
                    setInventoryAuditApproving(true);
                    try {
                      const ok = await handleApproveInventoryAuditGap(line);
                      if (ok) setInventoryAuditDetailLine(null);
                    } finally {
                      setInventoryAuditApproving(false);
                    }
                  }}
                  onReAudit={handleReAuditInventoryAudit}
                  onTerminate={handleTerminateInventoryAudit}
                  onSubmitPhysicalCount={async (line, physicalQty, remarks, completedBy) => {
                    const res = await submitStockCheckResultApi(line.requestId, {
                      lines: [{
                        itemCode: line.itemCode,
                        itemName: line.itemName,
                        physicalQty,
                        location: line.location,
                        remarks: remarks || undefined,
                      }],
                      completedBy,
                    });
                    if (res.success) {
                      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                      addToast('success', 'Physical count submitted — audit marked Completed');
                      setInventoryAuditDetailLine(null);
                    } else {
                      addToast('error', typeof res.error === 'string' ? res.error : 'Failed to submit physical count');
                    }
                  }}
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
          Shipped: 'bg-brand-soft text-brand border-brand-soft',
          'Advance Paid': 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30',
          Delivered: 'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30',
          'PO Released': 'bg-surface-3 text-ink-2 border-border',
          'Vendor Confirmed': 'bg-brand-soft text-brand border-brand-soft',
          'Under GRN': 'bg-brand-soft text-brand border-brand-soft',
          'GRN Complete': 'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30',
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
            // delivered / underGrn / grnComplete are intentionally NOT sent: the warehouse owns them.
            // The API drops undefined but persists null (poTracking/controller.js: `if (v !== undefined)`),
            // so sending `?? null` here would wipe a stamp the warehouse had just written.
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

        const connectingLines =
          (po as { lineConnectingDates?: IssuedPoLineConnectingDate[] }).lineConnectingDates ?? [];

        const handleSaveConnectingDates = async () => {
          if (!po.backendPoId) return;
          setConnectingDateSaving(true);
          try {
            // Only persist real overrides; a cleared field falls back to the auto lead-time date.
            const map: Record<string, string> = {};
            for (const [k, v] of Object.entries(connectingDateDraft)) {
              if (v && v.trim()) map[normConnectingDateKey(k)] = v.trim();
            }
            // Shallow-merged server-side, so this keeps requestId / quoteId / poType intact.
            const res = await updatePurchaseOrder(po.backendPoId, { formData: { connectingDateByItem: map } });
            if (!res.success) {
              addToast('error', typeof res.error === 'string' ? res.error : (res.error?.message ?? 'Failed to save connecting dates'));
              return;
            }
            const prevFd = (po.formData && typeof po.formData === 'object' ? po.formData : {}) as Record<string, unknown>;
            const nextFd = { ...prevFd, connectingDateByItem: map };
            setSelectedPO((prev) => {
              if (!prev) return prev;
              const prevLines = (prev as { lineConnectingDates?: IssuedPoLineConnectingDate[] }).lineConnectingDates ?? [];
              const nextLines = prevLines.map((l) => {
                const ov = map[normConnectingDateKey(l.itemCode)] ?? null;
                return { ...l, overrideIso: ov, effectiveIso: ov ?? l.autoIso };
              });
              return { ...(prev as object), formData: nextFd, lineConnectingDates: nextLines } as unknown as PurchaseOrder;
            });
            void invalidatePurchaseOrdersQueries();
            addToast('success', 'Connecting dates updated');
          } finally {
            setConnectingDateSaving(false);
          }
        };

        /**
         * Save edited qty/price on an already-released PO — same mechanics as the Draft PO editor
         * (recalcDraftPoLineItem for line totals, draftLineItemsToPurchaseOrderItems for the PUT
         * payload). When qty is reduced/increased, syncs the linked procurement request's open
         * demand by the same delta (syncProcurementItemsAfterDraftPoLineQtyEdit) and spins off a
         * remainder request if qty came down, exactly like the Draft flow.
         */
        const handleSaveIssuedPoLineItems = async () => {
          if (!po.backendPoId) return;
          setEditIssuedPoSaving(true);
          try {
            const backendRequestId = (() => {
              const direct = String(po.requestId ?? '').trim();
              if (/^\d+$/.test(direct)) return direct;
              const codeNorm = String(po.requestCode ?? '').trim().toUpperCase();
              const byCode = codeNorm ? requests.find((r) => String(r.code).toUpperCase() === codeNorm) : undefined;
              return byCode?.id ? String(byCode.id) : '';
            })();
            const prItemsForLines = backendRequestId
              ? resolvePrItemsForPurchaseOrderLines(backendPrArray, requestsMapped, {
                  backendRequestId,
                  draftRequestId: po.requestId ?? '',
                  requestCode: po.requestCode ?? '',
                })
              : [];
            const assignedPrLines = assignPrItemToDraftLines(editIssuedPoLines, prItemsForLines);
            const qtyErr = validateDraftPoQtyAgainstMoqRemainder(po.poNumber, editIssuedPoLines, assignedPrLines);
            if (qtyErr) {
              addToast('warning', qtyErr);
              return;
            }

            const originalLines = Array.isArray(po.lineItems) ? po.lineItems : [];
            const qtyEdited = editIssuedPoLines.some(
              (l, idx) => parseQuantityRequested(l.qty) !== parseQuantityRequested(originalLines[idx]?.qty)
            );

            const poItems = draftLineItemsToPurchaseOrderItems(editIssuedPoLines, prItemsForLines, assignedPrLines);
            const res = await updatePurchaseOrder(po.backendPoId, { items: poItems });
            if (!res.success) {
              addToast('error', typeof res.error === 'string' ? res.error : (res.error?.message ?? 'Failed to update PO items'));
              return;
            }

            if (backendRequestId && qtyEdited) {
              const prRow = backendPrArray.find((p) => String(p.id) === backendRequestId) as
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
              const backendItemsForSync = Array.isArray(prRow?.items) ? prRow!.items : [];
              if (backendItemsForSync.length > 0) {
                const { updatedItems, remainderItems } = syncProcurementItemsAfterDraftPoLineQtyEdit(
                  backendItemsForSync,
                  originalLines,
                  editIssuedPoLines
                );
                const itemsForPrSync = updatedItems.map((it) => ({ ...it, partial_release_remainder: true }));
                const prUpd = await updateProcurementRequestApi(backendRequestId, { items: itemsForPrSync });
                if (!prUpd.success) {
                  addToast(
                    'error',
                    typeof prUpd.error === 'string'
                      ? prUpd.error
                      : 'PO items saved, but updating the linked procurement request failed. Fix the request manually.',
                  );
                  void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                } else {
                  let remainderCreatedLabel: string | null = null;
                  if (remainderItems.length > 0) {
                    if (!prRow?.planningExtractedId || prRow.planningExtractedId <= 0) {
                      addToast(
                        'warning',
                        'PO items updated; could not create a remainder request (missing planning link). Add the backlog lines manually.',
                      );
                    } else {
                      const remainderNotes = `Remainder from ${po.requestCode || po.poNumber}: PO line qty reduced (${po.poNumber}).`;
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
                            : 'PO items updated but creating the remainder procurement request failed.',
                        );
                      } else if (remainingRes.data.id != null) {
                        remainderCreatedLabel = `PR-REQ-${String(remainingRes.data.id).padStart(3, '0')}`;
                      }
                    }
                  }
                  void queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                  if (remainderItems.length > 0 && remainderCreatedLabel) {
                    addToast('success', `PO items updated; remainder tracked as ${remainderCreatedLabel}.`);
                  } else if (remainderItems.length > 0) {
                    addToast('success', 'PO items updated; remainder request created.');
                  }
                }
              }
            }

            const nextGrandTotal = editIssuedPoLines.reduce((s, l) => s + l.lineTotal, 0);
            setSelectedPO((prev) =>
              prev
                ? ({
                    ...(prev as object),
                    lineItems: editIssuedPoLines,
                    items: editIssuedPoLines.map((l) => l.item),
                    itemCount: editIssuedPoLines.length,
                    grandTotal: nextGrandTotal,
                    value: nextGrandTotal,
                  } as unknown as PurchaseOrder)
                : prev
            );
            void invalidatePurchaseOrdersQueries();
            if (!qtyEdited || !backendRequestId) addToast('success', 'PO items updated.');
          } finally {
            setEditIssuedPoSaving(false);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedPO(null)}>
            <div
              className="w-full max-w-2xl max-h-[90vh] bg-surface rounded-xl border border-brand-soft shadow-2xl overflow-y-auto flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-surface rounded-t-xl border-b border-brand-soft px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-ink-3 font-mono mb-1">{po.requestCode ?? po.id}</p>
                  <h2 className="text-lg font-bold font-archivo text-ink leading-tight">
                    {po.poNumber} – {po.vendorName}
                  </h2>
                  <div className="mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${poStatusColor2[po.status] ?? 'bg-surface-3 text-ink-3 border-border'}`}>
                      {po.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPO(null)}
                  className="text-ink-4 hover:text-ink-2 text-xl leading-none mt-1 transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 px-5 py-4 space-y-5">
                {/* PO Summary */}
                <div className="rounded-lg border border-border bg-surface-3 divide-y divide-hairline text-sm">
                  {[
                    { label: 'PO Number', value: po.poNumber },
                    { label: 'Vendor', value: po.vendorName },
                    { label: 'Contact', value: po.contactPerson ?? '—' },
                    { label: 'PO Date', value: new Date(po.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' }) },
                    { label: 'Total Value', value: `₹${po.value.toLocaleString('en-IN')}`, bold: true },
                    { label: 'ETA', value: `${po.etaDays} days`, highlight: po.etaDays <= 3 },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-2">
                      <span className="text-ink-3">{row.label}</span>
                      <span className={`font-medium ${row.highlight ? 'text-err' : row.bold ? 'text-warn font-bold' : 'text-ink'
                        }`}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* PO lifecycle exceptions (Hold · Cancel · Amend) — front-and-center: this is the
                    "Edit" path for a PO that has already left Draft. */}
                {po.backendPoId && (
                  <PoExceptionBar
                    poId={po.backendPoId}
                    refreshKey={poWorkflowRefresh}
                    onToast={addToast}
                    onLockChange={setPoLock}
                    onStateChange={setPoEditGate}
                    onChanged={() => { setPoWorkflowRefresh((n) => n + 1); void invalidatePurchaseOrdersQueries(); }}
                  />
                )}

                {/* Line items — qty & price/unit, same editable table as the Draft PO editor. Only
                    while the PO could also be Amended (approved/sent, not shipped/GRN'd/held/
                    cancelled) — past that point stock is already moving against the old numbers. */}
                {po.backendPoId && editIssuedPoLines.length > 0 && (
                  poEditGate?.canAmend ? (
                    <div>
                      <span className="block text-[10px] tracking-[0.14em] text-ink-3 uppercase mb-2">
                        Line items — qty &amp; price/unit
                      </span>
                      <div className="rounded-lg border border-border overflow-x-auto">
                        <table className="w-full text-sm min-w-[600px]">
                          <thead>
                            <tr className="bg-surface-3 text-left text-[11px] tracking-wide text-ink-3 border-b border-border">
                              <th scope="col" className="px-2 py-2 font-semibold">Item</th>
                              <th scope="col" className="px-2 py-2 font-semibold text-right w-32">Qty</th>
                              <th scope="col" className="px-2 py-2 font-semibold text-right w-36">Price/unit (₹)</th>
                              <th scope="col" className="px-2 py-2 font-semibold text-right w-32">GST</th>
                              <th scope="col" className="px-2 py-2 font-semibold text-right w-40">Line total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editIssuedPoLines.map((line, idx) => (
                              <tr key={idx} className="border-b border-hairline last:border-0">
                                <td className="px-2 py-2 align-top">
                                  <p className="font-medium text-ink leading-snug">{line.item}</p>
                                  <p className="text-[10px] text-ink-3">{line.itemCode}</p>
                                </td>
                                <td className="px-2 py-2 text-right align-top">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="Qty"
                                    value={line.qty}
                                    onChange={(e) => {
                                      const next = editIssuedPoLines.map((l, i) =>
                                        i === idx ? recalcDraftPoLineItem(l, { qty: e.target.value }) : l,
                                      );
                                      setEditIssuedPoLines(next);
                                    }}
                                    className="w-full rounded border border-border px-2 py-1 text-right tabular-nums"
                                  />
                                </td>
                                <td className="px-2 py-2 text-right align-top">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={
                                      editIssuedPoPriceDraft[idx] ??
                                      (line.pricePerUnit != null && line.pricePerUnit !== 0 ? String(line.pricePerUnit) : '')
                                    }
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      setEditIssuedPoPriceDraft((prev) => ({ ...prev, [idx]: raw }));
                                      const cleaned = raw.replace(/,/g, '').trim();
                                      const price = cleaned === '' ? 0 : parseFloat(cleaned.replace(/[^\d.]/g, '')) || 0;
                                      const next = editIssuedPoLines.map((l, i) =>
                                        i === idx ? recalcDraftPoLineItem(l, { pricePerUnit: price }) : l,
                                      );
                                      setEditIssuedPoLines(next);
                                    }}
                                    className="w-full rounded border border-border px-2 py-1 text-right tabular-nums"
                                  />
                                </td>
                                <td className="px-2 py-2 text-right align-top">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="0"
                                      title="GST %"
                                      value={
                                        editIssuedPoGstDraft[idx] ??
                                        (line.gstPercent != null ? String(line.gstPercent) : '')
                                      }
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        setEditIssuedPoGstDraft((prev) => ({ ...prev, [idx]: raw }));
                                        setEditIssuedPoGstAmtDraft((prev) => {
                                          const next = { ...prev };
                                          delete next[idx];
                                          return next;
                                        });
                                        const cleaned = raw.replace(/,/g, '').trim();
                                        const gstPercent = cleaned === '' ? 0 : parseFloat(cleaned.replace(/[^\d.]/g, '')) || 0;
                                        const next = editIssuedPoLines.map((l, i) =>
                                          i === idx ? recalcDraftPoLineItem(l, { gstPercent }) : l,
                                        );
                                        setEditIssuedPoLines(next);
                                      }}
                                      className="w-12 rounded border border-border px-1.5 py-1 text-right tabular-nums"
                                    />
                                    <span className="text-ink-3 text-[10px]">%</span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-1">
                                    <span className="text-ink-3 text-[10px]">₹</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="0"
                                      title="GST amount"
                                      value={
                                        editIssuedPoGstAmtDraft[idx] ??
                                        (line.gstAmount != null && line.gstAmount !== 0 ? String(line.gstAmount) : '')
                                      }
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        setEditIssuedPoGstAmtDraft((prev) => ({ ...prev, [idx]: raw }));
                                        setEditIssuedPoGstDraft((prev) => {
                                          const next = { ...prev };
                                          delete next[idx];
                                          return next;
                                        });
                                        const cleaned = raw.replace(/,/g, '').trim();
                                        const gstAmount = cleaned === '' ? 0 : parseFloat(cleaned.replace(/[^\d.]/g, '')) || 0;
                                        const next = editIssuedPoLines.map((l, i) =>
                                          i === idx ? recalcDraftPoLineItem(l, { gstAmount }) : l,
                                        );
                                        setEditIssuedPoLines(next);
                                      }}
                                      className="w-16 rounded border border-border px-1.5 py-1 text-right tabular-nums"
                                    />
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-right align-top tabular-nums text-ink font-medium whitespace-nowrap">
                                  ₹{line.lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Add a new line — a genuine correction/addition, not from the original PR.
                          Its qty counts toward PO Qty / grand total once saved, same as any other
                          line, but isn't matched against the linked request's demand (there's
                          nothing there to sync — it was never asked for). */}
                      <div className="mt-2 relative">
                        <input
                          type="text"
                          placeholder="+ Add item — search by name or code…"
                          value={addPoItemSearch}
                          onChange={(e) => setAddPoItemSearch(e.target.value)}
                          className="w-full rounded border border-dashed border-border px-2 py-1.5 text-xs focus:outline-none focus:border-brand"
                        />
                        {addPoItemSearch.trim().length >= 2 && (() => {
                          const q = addPoItemSearch.trim().toLowerCase();
                          const alreadyOnPo = new Set(
                            editIssuedPoLines.map((l) => String(l.itemCode ?? '').trim().toLowerCase()).filter(Boolean)
                          );
                          const matches = poAddItemCatalog
                            .filter((it): it is PriceListItemPage & { type: RequestType } => {
                              if (it.type !== 'RM' && it.type !== 'PM') return false; // PO lines are RM/PM only
                              const code = String(it.code ?? '').trim().toLowerCase();
                              const name = String(it.name ?? '').trim().toLowerCase();
                              if (code && alreadyOnPo.has(code)) return false;
                              return code.includes(q) || name.includes(q);
                            })
                            .slice(0, 8);
                          if (!matches.length) {
                            return (
                              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg px-3 py-2 text-xs text-ink-3">
                                No matching item found (or it&apos;s already on this PO).
                              </div>
                            );
                          }
                          return (
                            <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg max-h-56 overflow-auto">
                              {matches.map((it) => (
                                <button
                                  key={`${it.type}-${it.code}`}
                                  type="button"
                                  onClick={() => {
                                    const price = resolveStartingPriceForVendor(it, po.vendorName);
                                    const base: DraftPOLineItem = {
                                      item: it.name,
                                      itemCode: it.code,
                                      type: it.type,
                                      qty: '1',
                                      pricePerUnit: price,
                                      gstPercent: it.gst ?? 18,
                                      gstAmount: 0,
                                      lineTotal: 0,
                                      unit: it.uom,
                                      raw_material_id: it.raw_material_id ?? undefined,
                                      pack_material_id: it.pack_material_id ?? undefined,
                                    };
                                    setEditIssuedPoLines([
                                      ...editIssuedPoLines,
                                      recalcDraftPoLineItem(base, { qty: '1', pricePerUnit: price }),
                                    ]);
                                    setAddPoItemSearch('');
                                    addToast('info', `${it.name} added to this PO — set qty/price, then Save item changes.`);
                                  }}
                                  className="w-full text-left px-3 py-2.5 hover:bg-surface-3 border-b border-hairline last:border-0"
                                >
                                  <p className="text-xs font-medium text-ink leading-snug break-words">{it.name}</p>
                                  <p className="text-[10px] text-ink-3 mt-0.5">
                                    <span className="font-mono">{it.code}</span>
                                    <span className="text-ink-4 uppercase ml-2">{it.type}</span>
                                  </p>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      <p className="text-[11px] text-ink-3 mt-1.5">
                        Reducing qty splits the difference off to a new remainder procurement request; increasing it tops up the linked request by the same amount. Newly-added items count toward PO Qty / total once saved.
                      </p>
                      <button
                        type="button"
                        disabled={editIssuedPoSaving}
                        onClick={handleSaveIssuedPoLineItems}
                        className="mt-2 w-full px-3 py-2 rounded border border-brand-soft bg-brand-soft text-brand text-xs font-semibold hover:bg-brand hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {editIssuedPoSaving ? 'Saving…' : 'Save item changes'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-ink-3 bg-surface-3 border border-border rounded px-3 py-2">
                      {poEditGate
                        ? 'Qty / price can’t be edited once a PO has shipped, reached GRN, or is on hold/cancelled — use Amend above only if it truly needs to be reworked.'
                        : 'Checking whether this PO’s items can be edited…'}
                    </p>
                  )
                )}

                {/* Items — with editable per-item connecting date for issued POs */}
                {po.items && po.items.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] tracking-[0.14em] text-ink-3 uppercase">Items ({po.itemCount})</p>
                      {po.backendPoId && connectingLines.length > 0 && (
                        <p className="text-[10px] tracking-[0.14em] text-ink-3 uppercase">Connecting date</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-border bg-surface divide-y divide-hairline">
                      {po.items.map((item, idx) => {
                        const lineMeta = connectingLines[idx];
                        const key = lineMeta ? normConnectingDateKey(lineMeta.itemCode) : '';
                        const draftVal = key ? (connectingDateDraft[key] ?? '') : '';
                        const editable = Boolean(po.backendPoId && lineMeta);
                        return (
                          <div key={idx} className="px-4 py-2 text-sm text-ink flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full bg-warn-soft text-warn text-[10px] font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                            <span className="flex-1 min-w-0 truncate">{item}</span>
                            {editable && (
                              <div className="flex flex-col items-end gap-0.5 shrink-0">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="date"
                                    value={draftVal}
                                    onChange={(e) => setConnectingDateDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                                    className="rounded border border-border bg-surface-3 px-2 py-1 text-xs text-ink focus:outline-none focus:border-brand"
                                  />
                                  {draftVal && (
                                    <button
                                      type="button"
                                      title="Clear override (use auto lead-time date)"
                                      onClick={() => setConnectingDateDraft((prev) => ({ ...prev, [key]: '' }))}
                                      className="text-ink-4 hover:text-err text-sm leading-none px-1"
                                      aria-label="Clear connecting date override"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                                <span className="text-[10px] text-ink-4">
                                  {draftVal
                                    ? 'Manual override'
                                    : lineMeta?.autoIso
                                      ? `Auto: ${new Date(`${lineMeta.autoIso}T12:00:00`).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })}`
                                      : 'No lead time'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {po.backendPoId && connectingLines.length > 0 && (
                      <button
                        type="button"
                        disabled={connectingDateSaving}
                        onClick={handleSaveConnectingDates}
                        className="mt-2 w-full px-3 py-2 rounded border border-brand-soft bg-brand-soft text-brand text-xs font-semibold hover:bg-brand hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {connectingDateSaving ? 'Saving…' : 'Save connecting dates'}
                      </button>
                    )}
                  </div>
                )}

                {/* Status Timeline (from API when PO is linked to backend) */}
                {!po.backendPoId && (
                  <p className="text-xs text-warn bg-warn-soft border border-[color:var(--st-amber-fg)]/30 rounded px-3 py-2">
                    PO not linked to backend — create and release the PO from Draft POs to see and update the status timeline.
                  </p>
                )}
                {/* Save request link (for existing POs released before form_data was stored) */}
                {po.backendPoId && po.requestId && po.requestCode && (
                  <div className="rounded-lg border border-border bg-surface-3 p-3">
                    <p className="text-[10px] tracking-[0.14em] text-ink-3 uppercase mb-2">Existing PO?</p>
                    <p className="text-xs text-ink-3 mb-2">
                      If this PO was released before the link was saved, save the request link so &quot;Mark Delivered at WH&quot; and the timeline stay correct.
                    </p>
                    <button
                      type="button"
                      disabled={poActionBusy != null}
                      onClick={() => runPoAction('saveRequestLink', handleSaveRequestLink)}
                      className="w-full px-3 py-2 rounded border border-border bg-surface text-ink-2 text-xs font-semibold hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {poActionBusy === 'saveRequestLink' ? 'Saving…' : 'Save request link'}
                    </button>
                  </div>
                )}
                {po.backendPoId && timelineSteps.length > 0 && (
                  <div>
                    <p className="text-[10px] tracking-[0.14em] text-ink-3 uppercase mb-3">Status Timeline (PO Released &gt; Advance Paid &gt; Vendor Confirmed &gt; Shipped &gt; Delivered &gt; Under GRN &gt; GRN Complete)</p>
                    <div className="relative pl-12 space-y-6">
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-surface-3" />
                      {timelineSteps.map((step, idx) => (
                        <div key={idx} className="relative">
                          <div className={`absolute -left-8 top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm z-10 ${step.done ? 'bg-ok border-[color:var(--st-green-fg)]/40 text-white' : 'bg-surface border-border text-ink-4'
                            }`}>
                            {step.done ? 'Done' : ''}
                          </div>
                          <div className="pb-1">
                            <p className={`text-sm font-bold ${step.done ? 'text-ink' : 'text-ink-4'}`}>{step.stage}</p>
                            {step.timestamp && (
                              <p className="text-[11px] text-ink-3 mt-0.5">
                                {(() => {
                                  const d = new Date(String(step.timestamp));
                                  return Number.isNaN(d.getTime()) ? String(step.timestamp) : d.toLocaleString('en-IN');
                                })()}
                              </p>
                            )}
                            {step.note && <p className="text-xs text-ink-3 mt-1 leading-relaxed">{step.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3-way match + Payment → Closed (Sub-flow I) — once the PO reaches GRN */}
                {po.backendPoId && (() => {
                  const mtr = (data ?? poTrackingForm) as PoTrackingRecord | undefined;
                  const atGrn =
                    hasPoTrackingTimestamp(mtr?.underGrnAt) ||
                    hasPoTrackingTimestamp(mtr?.grnCompleteAt) ||
                    Boolean((mtr as { closedAt?: string | null })?.closedAt);
                  if (!atGrn) return null;
                  return (
                    <PoMatchPanel
                      poId={po.backendPoId}
                      refreshKey={poWorkflowRefresh}
                      locked={poLocked}
                      onToast={addToast}
                      onChanged={() => { setPoWorkflowRefresh((n) => n + 1); void invalidatePurchaseOrdersQueries(); }}
                    />
                  );
                })()}

                {/* GRN-stage exceptions (Short-supply short-close · QC-fail RTV) — self-hides when none */}
                {po.backendPoId && (
                  <PoGrnExceptionPanel
                    poId={po.backendPoId}
                    refreshKey={poWorkflowRefresh}
                    locked={poLocked}
                    onToast={addToast}
                    onChanged={() => { setPoWorkflowRefresh((n) => n + 1); void invalidatePurchaseOrdersQueries(); }}
                  />
                )}

                {/* Update tracking form (when PO is linked to backend) */}
                {po.backendPoId && (
                  <div className="rounded-lg border border-brand-soft bg-brand-soft p-4 space-y-3">
                    <p className="text-[10px] tracking-[0.14em] text-ink-3 uppercase font-semibold mb-2">Update status</p>
                    {(() => {
                      const modalTr = (data ?? poTrackingForm) as PoTrackingRecord | undefined;
                      const modalHasVendor = hasPoTrackingTimestamp(modalTr?.vendorConfirmedAt);
                      const modalHasRejected = hasPoTrackingTimestamp(modalTr?.vendorRejectedAt);
                      const modalHasShipped =
                        hasPoTrackingTimestamp(modalTr?.shippedAt) || Boolean(ovModal?.shipped);
                      const modalAckSla = computeIssuedAckSla(modalTr, modalHasVendor, modalHasRejected);
                      const issuedRecordForActions = {
                        backendPoId: po.backendPoId,
                        poNumber: po.poNumber,
                        requestCode: po.requestCode,
                        request: po.requestId ? { id: po.requestId } : undefined,
                      };
                      return (
                        <div className="space-y-2 pb-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {modalAckSla && (
                              <span className={`text-[11px] font-semibold ${SLA_LEVEL_CLASSES[modalAckSla.level]}`}>
                                {SLA_LEVEL_PREFIX[modalAckSla.level]} Ack {modalAckSla.label} · due {modalAckSla.dueDisplay}
                              </span>
                            )}
                            {modalHasRejected && (
                              <span className="px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-err-soft text-err border-[color:var(--st-red-fg)]/30">
                                Vendor rejected — renegotiate / reassign / cancel
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!modalHasVendor && !modalHasRejected && (
                              <button
                                type="button"
                                disabled={poActionBusy != null}
                                onClick={() => runPoAction('vendorConfirmed', () => markIssuedPOVendorConfirmed(issuedRecordForActions))}
                                className="px-3 py-1.5 rounded-lg border border-brand bg-brand text-white text-xs font-semibold hover:bg-brand-press disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {poActionBusy === 'vendorConfirmed' ? 'Saving…' : 'Mark Vendor Confirmed'}
                              </button>
                            )}
                            {!modalHasVendor && !modalHasRejected && (
                              <button
                                type="button"
                                disabled={poActionBusy != null}
                                onClick={() => runPoAction('vendorRejected', () => markIssuedPOVendorRejected(issuedRecordForActions))}
                                className="px-3 py-1.5 rounded-lg border border-[color:var(--st-red-fg)]/30 bg-surface text-err text-xs font-semibold hover:bg-err-soft disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {poActionBusy === 'vendorRejected' ? 'Saving…' : 'Mark Vendor Rejected'}
                              </button>
                            )}
                            {modalHasVendor && !modalHasShipped && (
                              <button
                                type="button"
                                disabled={poActionBusy != null}
                                onClick={() => runPoAction('shipped', () => markIssuedPOShipped(issuedRecordForActions))}
                                className="px-3 py-1.5 rounded-lg border border-[color:var(--st-amber-fg)]/40 bg-warn text-white text-xs font-semibold hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {poActionBusy === 'shipped' ? 'Saving…' : 'Mark In Transit'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {/* Procurement owns the PO only up to Shipped / In Transit. Delivered, Under GRN
                        and GRN Complete are stamped by the warehouse as the GRN lands and completes
                        (grn/controller.js stampPoTrackingForGrn), so editing them here would let the
                        two sides disagree. They stay visible in the read-only timeline above. */}
                    {[
                      { label: 'PO Released', at: 'poReleasedAt', note: 'poReleasedNote' },
                      { label: 'Advance Paid', at: 'advancePaidAt', note: 'advancePaidNote' },
                      { label: 'Vendor Confirmed', at: 'vendorConfirmedAt', note: 'vendorConfirmedNote' },
                      { label: 'Shipped', at: 'shippedAt', note: 'shippedNote' },
                    ].map(({ label, at, note }) => (
                      <div key={at} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center text-sm">
                        <span className="text-ink-2 font-medium">{label}</span>
                        <input
                          type="date"
                          value={(poTrackingForm[at as keyof PoTrackingRecord] as string) ?? ''}
                          onChange={(e) => setPoTrackingForm((f) => ({ ...f, [at]: e.target.value || undefined }))}
                          className="rounded border border-border px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Note"
                          value={(poTrackingForm[note as keyof PoTrackingRecord] as string) ?? ''}
                          onChange={(e) => setPoTrackingForm((f) => ({ ...f, [note]: e.target.value || undefined }))}
                          className="rounded border border-border px-2 py-1 text-xs min-w-0"
                        />
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-ink-3 text-sm">LR / Tracking ref</span>
                      <input
                        type="text"
                        placeholder="e.g. LR123456"
                        value={poTrackingForm.orderTrackingRef ?? ''}
                        onChange={(e) => setPoTrackingForm((f) => ({ ...f, orderTrackingRef: e.target.value || undefined }))}
                        className="flex-1 rounded border border-border px-2 py-1 text-sm"
                      />
                    </div>
                    <button
                      disabled={poActionBusy != null}
                      onClick={() => runPoAction('saveTracking', handleSaveTracking)}
                      className="mt-2 w-full py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-press disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {poActionBusy === 'saveTracking' ? 'Saving…' : 'Save tracking'}
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-surface rounded-b-xl border-t border-brand-soft px-5 py-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const ok = openPurchaseOrderPdf({
                      poNumber: po.poNumber,
                      reference: po.requestCode,
                      orderDate: po.createdDate,
                      vendor: po.vendor,
                      ...buildVendorPoPdfFields(po.vendor ?? ''),
                      paymentTerms: po.paymentTerms,
                      lines: po.lineItems,
                      grandTotal: po.grandTotal,
                    });
                    if (!ok) addToast('error', 'Could not open the PDF window. Allow popups and try again.');
                  }}
                  className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3 transition inline-flex items-center gap-1.5"
                >
                  <FileText className="h-4 w-4" /> PO PDF
                </button>
                {po.backendPoId && (
                  <button
                    onClick={() =>
                      setPoCommentTarget({
                        id: Number(poBackendId(String(po.backendPoId))),
                        label: `${po.poNumber} · ${po.vendor}`,
                        materials: poMaterialCommentScopes(po.lineItems),
                      })
                    }
                    className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3 transition inline-flex items-center gap-1.5"
                    title="Comments — on this PO, or on a material (shared with Planning)"
                  >
                    <MessageSquare className="h-4 w-4" /> Comments
                  </button>
                )}
                {po.backendPoId && (
                  <button
                    onClick={() => { setSelectedPO(null); applyRouteState('Procurement', 'GRN Tracker'); }}
                    className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-bold hover:bg-brand-press transition"
                  >
                    Open GRN Monitor
                  </button>
                )}
                <button
                  onClick={() => setSelectedPO(null)}
                  className="px-4 py-2 rounded-lg border border-border text-ink-3 text-sm font-semibold hover:bg-surface-3 transition"
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
              className="w-full sm:w-96 lg:w-120 max-w-[100vw] bg-surface border-l border-brand-soft shadow-2xl overflow-y-auto flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-surface border-b border-brand-soft px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-ink-3 font-mono mb-1">{grn.poRef}</p>
                  <h2 className="text-lg font-bold font-archivo text-ink leading-tight">
                    GRN – {grn.grnRef}
                  </h2>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-[color:var(--st-green-fg)]/30 bg-ok-soft text-[10px] font-semibold text-ok">
                      {primaryStatus}
                    </span>
                    <span className="text-[11px] text-ink-3">QC By&nbsp;<span className="font-semibold text-ink">Meera QC</span></span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGrn(null)}
                  className="text-ink-4 hover:text-ink-2 text-xl leading-none mt-1 transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 px-5 py-4 space-y-5 text-sm">
                {/* GRN Summary */}
                <div className="rounded-lg border border-border bg-surface-3 divide-y divide-hairline">
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-ink-3">PO Number</span>
                    <span className="font-mono text-xs text-brand">{grn.poRef}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-ink-3">Vendor</span>
                    <span className="font-medium text-ink">{grn.vendor}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-ink-3">GRN Status</span>
                    <span className="font-medium text-ok">{primaryStatus}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-ink-3">QC By</span>
                    <span className="font-medium text-ink">Meera QC</span>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <p className="text-[10px] tracking-[0.14em] text-ink-3 uppercase mb-2">Items ({grn.lines.length})</p>
                  <div className="space-y-3">
                    {grn.lines.map((line, idx) => (
                      <div
                        key={`${line.itemCode}-${idx}`}
                        className="rounded-lg border border-border bg-surface p-3"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-bold text-sm text-ink">{line.itemName}</p>
                            <p className="text-[10px] text-ink-3">{line.itemCode}</p>
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-ok-soft border border-[color:var(--st-green-fg)]/30 text-[10px] text-ok font-semibold">
                            {line.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-ink-3">
                          <span>
                            Ordered: <strong className="text-ink">{line.orderedQty}</strong>
                          </span>
                          <span>
                            Received: <strong className="text-ink">{line.receivedQty}</strong>
                          </span>
                          <span>
                            QC Pass: <strong className="text-ok">{line.qcPass}</strong>
                          </span>
                          <span>
                            QC Fail: <strong className="text-err">{line.qcFail}</strong>
                          </span>
                          <span>
                            Received Date:{' '}
                            <strong className="text-ink">
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
              <div className="sticky bottom-0 bg-surface border-t border-brand-soft px-5 py-3 flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedGrn(null)}
                  className="px-4 py-2 rounded-lg border border-border text-ink-3 text-sm font-semibold hover:bg-surface-3 transition"
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
              className="w-full max-w-2xl max-h-[90vh] bg-surface rounded-xl border border-brand-soft shadow-2xl overflow-y-auto flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-surface rounded-t-xl border-b border-brand-soft px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-ink-3 font-mono mb-1">{dpo.requestCode}</p>
                  <h2 className="text-lg font-bold font-archivo text-ink leading-tight">
                    {dpo.dpoNumber}
                  </h2>
                  <div className="mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${dpo.status === 'Approved' ? 'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30' : 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30'
                      }`}>
                      {dpo.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const ok = openPurchaseOrderPdf({
                        poNumber: dpo.dpoNumber,
                        poType: dpo.poType,
                        reference: dpo.requestCode,
                        orderDate: dpo.createdDate,
                        expectedDelivery: dpo.expectedDelivery,
                        vendor: dpo.vendor,
                        ...buildVendorPoPdfFields(dpo.vendor ?? ''),
                        deliveryAddress: dpo.deliveryAddress,
                        paymentTerms: dpo.paymentTerms,
                        lines: lineItems,
                        subtotal, gstTotal, grandTotal,
                      });
                      if (!ok) addToast('error', 'Could not open the PDF window. Allow popups and try again.');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-ink-2 text-xs font-semibold hover:bg-surface-3"
                  >
                    <FileText className="h-3.5 w-3.5" /> PO PDF
                  </button>
                  {dpo.backendPoId && (
                    <button
                      onClick={() =>
                        setPoCommentTarget({
                          id: Number(poBackendId(String(dpo.backendPoId))),
                          label: `${dpo.dpoNumber} · ${dpo.vendor}`,
                          materials: poMaterialCommentScopes(dpo.lineItems),
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-ink-2 text-xs font-semibold hover:bg-surface-3"
                      title="Comments — on this PO, or on a material (shared with Planning)"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Comments
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedDraftPO(null)}
                    className="text-ink-4 hover:text-ink-2 text-xl leading-none transition-colors"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="flex-1 px-5 py-4 space-y-5">
                {/* DPO Summary */}
                <div className="rounded-lg border border-border bg-surface-3 divide-y divide-hairline text-sm">
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
                      { label: 'Payment Terms', paymentTerms: dpo.paymentTerms, amount: grandTotal },
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
                      {
                        label: 'Status',
                        // Live status wins: the snapshot still said "Pending Approval" after the PO
                        // had already been approved and released.
                        value: selectedDraftPONoLongerDraft ? (selectedDraftPOLiveStatus as string) : dpo.status,
                        highlight: !selectedDraftPONoLongerDraft && dpo.status === 'Pending Approval',
                      },
                    ] as Array<
                      | { label: string; value: string; bold?: boolean; highlight?: boolean }
                      | { label: string; paymentTerms: string; amount?: number }
                    >
                  ).map((row) =>
                    'paymentTerms' in row ? (
                      <div key={row.label} className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <span className="text-ink-3 shrink-0 pt-0.5">{row.label}</span>
                        <div className="min-w-0 w-full sm:max-w-md sm:flex-1 sm:flex sm:justify-end">
                          <PaymentTermsDisplay value={row.paymentTerms} amount={row.amount} />
                        </div>
                      </div>
                    ) : (
                      <div key={row.label} className="flex items-center justify-between px-4 py-2">
                        <span className="text-ink-3">{row.label}</span>
                        <span
                          className={`font-medium ${row.highlight ? 'text-warn' : row.bold ? 'text-warn font-bold' : 'text-ink'
                            }`}
                        >
                          {row.value}
                        </span>
                      </div>
                    ),
                  )}
                </div>

                {/* Approval workflow (Sub-flow E) + Vendor loop (Sub-flow F) — needs a persisted backend PO */}
                {dpo.backendPoId && (
                  <div className="space-y-3">
                    <PoExceptionBar
                      poId={dpo.backendPoId}
                      refreshKey={poWorkflowRefresh}
                      onToast={addToast}
                      onLockChange={setPoLock}
                      onChanged={() => { setPoWorkflowRefresh((n) => n + 1); void invalidatePurchaseOrdersQueries(); }}
                    />
                    <PoApprovalPanel
                      poId={dpo.backendPoId}
                      refreshKey={poWorkflowRefresh}
                      locked={poLocked}
                      onToast={addToast}
                      onStatusChange={setPoApprovalStatus}
                      onChanged={() => { setPoWorkflowRefresh((n) => n + 1); void invalidatePurchaseOrdersQueries(); }}
                    />
                    <PoVendorPanel
                      poId={dpo.backendPoId}
                      refreshKey={poWorkflowRefresh}
                      locked={poLocked}
                      onToast={addToast}
                      onChanged={() => { setPoWorkflowRefresh((n) => n + 1); void invalidatePurchaseOrdersQueries(); }}
                    />
                  </div>
                )}

                {(totals && (() => {
                  const hasQuote = dpo.requestId && quotes.some((q) => q.requestId === dpo.requestId && q.status === 'Confirmed');
                  return hasQuote ? (
                    <p className="text-xs text-ok bg-ok-soft border border-[color:var(--st-green-fg)]/30 rounded-lg px-3 py-2">
                      Prices and totals from confirmed Quotation (vendor: {dpo.vendor}).
                    </p>
                  ) : pricesFromItemsList ? (
                    <p className="text-xs text-ok bg-ok-soft border border-[color:var(--st-green-fg)]/30 rounded-lg px-3 py-2">
                      Prices and totals from Items List (vendor: {dpo.vendor}).
                    </p>
                  ) : null;
                })())}

                {/* Alert */}
                {dpo.alertMessage && (
                  <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${dpo.alertType === 'warning' ? 'bg-warn-soft text-warn border border-[color:var(--st-amber-fg)]/30' : 'bg-ok-soft text-ok border border-[color:var(--st-green-fg)]/30'
                    }`}>
                    <span>{dpo.alertType === 'warning' ? '!' : '-'}</span>
                    <span>{dpo.alertMessage}</span>
                  </div>
                )}

                {/* Line Items */}
                <div>
                  <p className="text-[10px] tracking-[0.14em] text-ink-3 uppercase mb-2">Line Items</p>
                  <div className="space-y-2">
                    {lineItems.map((line, idx) => (
                      <div key={idx} className="rounded-lg border border-border bg-surface p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-bold text-sm text-ink">{line.item}</p>
                            <p className="text-[10px] text-ink-3">{line.itemCode}</p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${requestTypeClass[line.type]}`}>{line.type}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-3">
                          <span>Qty: <strong className="text-warn">{line.qty}</strong></span>
                          <span>Price/unit: <strong className="text-ink">₹{typeof line.pricePerUnit === 'number' ? line.pricePerUnit.toLocaleString('en-IN') : line.pricePerUnit}</strong></span>
                          <span>Lead (D): <strong className="text-ink">{line.leadTimeDays != null ? `${line.leadTimeDays}d` : '—'}</strong></span>
                          <span>GST: <strong className="text-ink">{line.gstPercent}%</strong></span>
                          <span>GST amt: <strong className="text-ink">₹{line.gstAmount.toLocaleString('en-IN')}</strong></span>
                          <span className="col-span-2">Line total: <strong className="text-ink">₹{line.lineTotal.toLocaleString('en-IN')}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="rounded-lg border border-border bg-surface-3 p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-3">Subtotal</span>
                    <span className="font-medium text-ink">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-3">GST Total</span>
                    <span className="font-medium text-ink">₹{gstTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-warn font-bold">Grand Total</span>
                    <span className="text-warn font-bold text-lg">₹{grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-surface rounded-b-xl border-t border-brand-soft px-5 py-3 flex items-center justify-end gap-2">
                {/* Already released: every action below acts on the draft list this PO has left, so
                    offering them produced a "Draft PO not found" on a PO that exists. */}
                {selectedDraftPONoLongerDraft ? (
                  <span className="text-xs text-ink-2 mr-auto">
                    This PO is <span className="font-semibold text-ink">{selectedDraftPOLiveStatus}</span> — it has
                    left the draft stage. Track it from Purchase Orders; use the Vendor section above for
                    acknowledgement.
                  </span>
                ) : (
                <>
                <button
                  type="button"
                  disabled={deletingDraftPoId === dpo.id}
                  onClick={() => openDeleteDraftPOConfirm(dpo)}
                  className="px-4 py-2 rounded-lg border border-[color:var(--st-red-fg)]/30 text-err text-sm font-semibold hover:bg-err-soft transition disabled:opacity-50"
                >
                  {deletingDraftPoId === dpo.id ? 'Deleting…' : 'Delete draft PO'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditDraftPOTarget(dpo)}
                  className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3 transition"
                >
                  Edit
                </button>
                {/* Approval happens in the Approval panel above — Submit for Review, then the
                    routed approver decides. The old footer "Approve" wrote purchase_orders.status
                    directly, skipping the role check and the audit trail, and left approval_status
                    at 'not_submitted' — so the Release that it unlocked was then refused by the
                    backend (PO_NOT_APPROVED). One flow now, and the footer follows it. */}
                {poApprovalStatus !== 'approved' && (
                  <span className="text-xs text-ink-3 mr-auto">
                    {poApprovalStatus === 'not_submitted'
                      ? 'Use Submit for Review in the Approval section to start approval.'
                      : poApprovalStatus === 'changes_requested'
                        ? 'Changes requested — edit the PO, then resubmit for review.'
                        : poApprovalStatus === 'rejected'
                          ? 'This PO was rejected in the approval workflow.'
                          : 'Awaiting a decision in the Approval section above.'}
                  </span>
                )}
                {poApprovalStatus === 'approved' && (
                  <>
                    {draftPaymentTermsRequireAdvance(dpo.paymentTerms) && (
                      <button
                        onClick={() => void recordRequiredPaymentReceivedForPo(dpo.backendPoId)}
                        disabled={recordingAdvancePayment || !String(dpo.backendPoId ?? '').trim()}
                        title={!String(dpo.backendPoId ?? '').trim() ? 'Draft PO must be synced to server first' : undefined}
                        className="px-4 py-2 rounded-lg border border-[color:var(--st-amber-fg)]/30 text-warn bg-warn-soft text-sm font-semibold hover:bg-warn-soft transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {recordingAdvancePayment ? 'Saving…' : 'Received Payment (Temp)'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        openReleasePOModal(dpo.id);
                      }}
                      className="px-4 py-2 rounded-lg bg-ok text-white text-sm font-bold hover:brightness-95 transition"
                    >
                      Release PO to Vendor
                    </button>
                    <button
                      onClick={() => splitDraftPO(dpo.id)}
                      className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3 transition"
                    >
                      Split PO
                    </button>
                  </>
                )}
                </>
                )}
                <button
                  onClick={() => setSelectedDraftPO(null)}
                  className="px-4 py-2 rounded-lg border border-border text-ink-3 text-sm font-semibold hover:bg-surface-3 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PO comments — the PO's own thread, plus one per material on it. Material threads are the
          same ones Planning reads, so procurement and planning share the conversation. */}
      {poCommentTarget && (
        <CommentsPanel
          entityType="po"
          entityId={poCommentTarget.id}
          entityLabel={poCommentTarget.label}
          materialScopes={poCommentTarget.materials}
          onClose={() => setPoCommentTarget(null)}
        />
      )}

      {/* ── Split PO Modal ── */}
      {splitPOTarget && (() => {
        const selectedCount = splitSelectedLineIndexes.length;
        const remainingCount = splitPOTarget.lineItems.length - selectedCount;
        const selectedSet = new Set(splitSelectedLineIndexes);
        // Preview from the same quantity plan the submit uses, so a partially split line shows on
        // BOTH sides with its real quantity instead of appearing wholly on one.
        const previewQtyPlan: Record<number, number> = {};
        splitPOTarget.lineItems.forEach((line, index) => {
          if (!selectedSet.has(index)) return;
          const typed = String(splitQtyForS1[index] ?? '').trim();
          previewQtyPlan[index] = typed === '' ? lineQtyNumber(line) : Number(typed);
        });
        const previewPlan = splitLinesByQuantity(splitPOTarget.lineItems, previewQtyPlan);
        const po1PreviewItems = previewPlan.s1;
        const po2PreviewItems = previewPlan.s2;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeSplitPOModal}>
            <div
              className="relative w-full max-w-3xl rounded-xl border border-border bg-surface shadow-2xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-3">
                <h3 className="text-lg font-bold text-ink">Split PO — {splitPOTarget.dpoNumber}</h3>
                <button
                  onClick={closeSplitPOModal}
                  className="w-7 h-7 rounded-md border border-border text-ink-3 hover:text-ink-2 hover:bg-surface-3 transition"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="px-5 py-4 space-y-3 bg-surface">
                <p className="text-xs text-ink-3">
                  Tick the items for PO 1 and set how much of each goes there — the remainder forms PO 2.
                  Leave the quantity blank to move the whole line.
                </p>

                <label className="block text-[10px] tracking-widest uppercase text-ink-3 mb-1">Items — Check for PO 1</label>
                <div className="space-y-2">
                  {splitPOTarget.lineItems.map((line, index) => {
                    const checked = splitSelectedLineIndexes.includes(index);
                    const totalQty = lineQtyNumber(line);
                    const typed = String(splitQtyForS1[index] ?? '').trim();
                    const toS1 = !checked ? 0 : typed === '' ? totalQty : Number(typed);
                    const toS2 = Number.isFinite(toS1) ? Math.round((totalQty - toS1) * 100) / 100 : totalQty;
                    const invalid = checked && (!Number.isFinite(toS1) || toS1 < 0 || toS1 > totalQty);
                    return (
                      <div
                        key={`${line.itemCode}-${index}`}
                        className="rounded-lg border border-border bg-surface-3 px-3 py-2"
                      >
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSplitLineSelection(index)}
                            className="mt-0.5 h-4 w-4 rounded border-border bg-surface text-ok focus:ring-[color:var(--ring)]"
                          />
                          <div className="leading-tight">
                            <p className="text-sm font-semibold text-ink">{line.item}</p>
                            <p className="text-xs text-ink-3">{line.qty} · ₹{line.lineTotal.toLocaleString('en-IN')}</p>
                          </div>
                        </label>
                        {checked && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                            <span className="text-[11px] font-semibold text-ink-2">Qty to PO 1</span>
                            <input
                              type="number"
                              min={0}
                              max={totalQty}
                              value={splitQtyForS1[index] ?? ''}
                              placeholder={String(totalQty)}
                              onChange={(e) =>
                                setSplitQtyForS1((prev) => ({ ...prev, [index]: e.target.value }))
                              }
                              className={`w-32 rounded-md border px-2 py-1 text-xs text-ink bg-surface focus:outline-none focus:ring-1 ${
                                invalid ? 'border-err focus:ring-err' : 'border-border focus:border-brand focus:ring-brand'
                              }`}
                            />
                            <span className={`text-[11px] ${invalid ? 'text-err' : 'text-ink-3'}`}>
                              {invalid
                                ? `Enter 0 – ${totalQty.toLocaleString('en-IN')}`
                                : `PO 2 gets ${toS2.toLocaleString('en-IN')}`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-[color:var(--st-green-fg)]/30 bg-ok-soft px-3 py-2">
                    <p className="text-[10px] tracking-widest uppercase text-ok font-semibold mb-1">
                      PO 1 ({splitPOTarget.dpoNumber}-S1)
                    </p>
                    <p className="text-xs text-ok">
                      {po1PreviewItems.length > 0
                        ? po1PreviewItems.map((line) => `${line.item} × ${line.qty}`).join(', ')
                        : 'No items selected yet'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-brand-soft bg-brand-soft px-3 py-2">
                    <p className="text-[10px] tracking-widest uppercase text-brand font-semibold mb-1">
                      PO 2 ({splitPOTarget.dpoNumber}-S2)
                    </p>
                    <p className="text-xs text-brand">
                      {po2PreviewItems.length > 0
                        ? po2PreviewItems.map((line) => `${line.item} × ${line.qty}`).join(', ')
                        : 'No items remaining'}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-warn-soft px-3 py-2 text-xs text-warn">
                  Two POs will be created. You can release them independently to the same or different vendors.
                  <span className="ml-2 font-medium">({selectedCount} item(s) in PO 1, {remainingCount} item(s) in PO 2)</span>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-border bg-surface-3 flex items-center justify-end gap-2">
                <button
                  onClick={closeSplitPOModal}
                  className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={submitSplitPOBusy}
                  onClick={submitSplitPO}
                  className="px-4 py-2 rounded-lg bg-ok text-white text-sm font-bold hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitSplitPOBusy ? 'Splitting…' : 'Split PO'}
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
            className="relative my-auto flex max-h-[calc(100svh-2rem)] w-full max-w-3xl min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            {releasingPO ? (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-surface/90 backdrop-blur-[1px]"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 className="h-9 w-9 text-ok animate-spin" aria-hidden />
                <p className="mt-2 text-sm font-semibold text-ink">Releasing PO…</p>
                <p className="mt-1 text-[11px] text-ink-3">Please wait for the server response</p>
              </div>
            ) : null}
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-3 px-5 py-3">
              <h3 className="text-lg font-bold text-ink">Release PO — {releasePOTarget.dpoNumber}</h3>
              <button
                type="button"
                onClick={closeReleasePOModal}
                disabled={releasingPO}
                className="h-7 w-7 shrink-0 rounded-md border border-border text-ink-3 transition hover:bg-surface-3 hover:text-ink-2 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pt-4 [scrollbar-gutter:stable]">
              <div className="rounded-lg border border-[color:var(--st-green-fg)]/30 bg-ok-soft px-3 py-2 text-xs text-ok">
                You are about to release a PO to <span className="font-bold">{releasePOTarget.vendor}</span> for <span className="font-bold">₹{releasePOTarget.grandTotal.toLocaleString('en-IN')}</span>.
              </div>

              <div>
                <label className="block text-[10px] tracking-widest uppercase text-ink-3 mb-1">Payment terms</label>
                <PaymentTermsDisplay value={releasePOTarget.paymentTerms} />
              </div>

              {releaseDraftRequiresAdvance && (
                <div className="rounded-lg border border-border bg-surface-3 px-3 py-3 space-y-3">
                  <p className="text-xs font-semibold text-ink">Payment transaction</p>
                  <p className="text-[11px] text-ink-3">
                    Required for advance payment terms. Record how the advance was paid — shown in Treasury with the PO.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] tracking-widest uppercase text-ink-3 mb-1">Transaction no.</label>
                      <input
                        value={releasePaymentTransactionNo}
                        onChange={(e) => setReleasePaymentTransactionNo(e.target.value)}
                        placeholder="e.g. UTR / cheque no."
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] tracking-widest uppercase text-ink-3 mb-1">Mode of payment</label>
                      <select
                        value={releasePaymentMode}
                        onChange={(e) => setReleasePaymentMode(e.target.value as ReleasePaymentMode | '')}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
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
                      <label className="block text-[10px] tracking-widest uppercase text-ink-3 mb-1">Payment date</label>
                      <input
                        type="date"
                        value={releasePaymentDate}
                        onChange={(e) => setReleasePaymentDate(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {releaseDraftRequiresAdvance && (
                <div className="rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-warn-soft px-3 py-2 text-xs text-warn space-y-2">
                  <p className="font-semibold">Advance payment required</p>
                  {!releaseDraftBackendPoIdNormalized ? (
                    <p className="text-warn">
                      This draft cannot be released until the purchase order exists on the server. Create or refresh the draft PO, then try again.
                    </p>
                  ) : releaseDraftTrackingLoading ? (
                    <p className="text-warn">Checking PO tracking…</p>
                  ) : advanceRecordedForReleaseDraft ? (
                    <div className="text-ok font-medium space-y-1">
                      <p>
                        Advance recorded
                        {releaseDraftTracking?.advancePaidAt
                          ? ` (${new Date(releaseDraftTracking.advancePaidAt).toLocaleDateString('en-IN')})`
                          : ''}
                        . You may release the PO.
                      </p>
                      {releaseDraftTracking?.paymentTransactionNo && (
                        <p className="text-xs text-ok">
                          Txn {releaseDraftTracking.paymentTransactionNo} · {releaseDraftTracking.paymentMode} ·{' '}
                          {releaseDraftTracking.paymentTransactionDate
                            ? new Date(releaseDraftTracking.paymentTransactionDate).toLocaleDateString('en-IN')
                            : '—'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-warn">
                        These terms include an advance. Record that the advance has been received (manual step until treasury transactions are wired) before issuing
                        this PO to the vendor.
                      </p>
                      <button
                        type="button"
                        disabled={recordingAdvancePayment}
                        onClick={() => void recordAdvancePaymentForReleaseDraft()}
                        className="px-3 py-1.5 rounded-lg bg-warn text-white text-xs font-semibold hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {recordingAdvancePayment ? 'Saving…' : 'Received Payment (Temp)'}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] tracking-widest uppercase text-ink-3 mb-1">PO Number</label>
                  <input
                    value={releasePOTarget.dpoNumber}
                    readOnly
                    className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-ink-2"
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-widest uppercase text-ink-3 mb-1">Release Method</label>
                  <select
                    value={releaseMethod}
                    onChange={(event) => setReleaseMethod(event.target.value as 'Email + Portal' | 'Email only' | 'Portal only' | 'WhatsApp + Email')}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-transparent"
                  >
                    <option value="Email + Portal">Email + Portal</option>
                    <option value="Email only">Email only</option>
                    <option value="Portal only">Portal only</option>
                    <option value="WhatsApp + Email">WhatsApp + Email</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest uppercase text-ink-3 mb-1">Release Notes</label>
                <textarea
                  value={releaseNotes}
                  onChange={(event) => setReleaseNotes(event.target.value)}
                  rows={3}
                  placeholder="e.g. Advance invoice to be raised immediately"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-2 placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-transparent"
                />
              </div>
              </div>

              <div className="flex min-h-0 shrink-0 flex-col px-5 pb-4 pt-2">
                <div className="flex max-h-[min(22rem,42svh)] min-h-[6.5rem] flex-col overflow-hidden rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-warn-soft px-3 py-2 text-xs text-warn">
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

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-3 px-5 py-3">
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
                className="px-4 py-2 rounded-lg bg-ok text-white text-sm font-bold hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 min-w-[7.5rem]"
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
                className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ))()}

      {/* ── Per-PR Request Quotation (RFQ) Modal ── */}
      {quoteRequestCtx && (
        <RequestQuotationModal
          context={quoteRequestCtx}
          onClose={() => setQuoteRequestCtx(null)}
          onSubmitted={() => {
            setQuoteRequestCtx(null);
            queryClient.invalidateQueries({ queryKey: ['planning-quotation-asks'] });
          }}
        />
      )}

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
              className="w-full max-w-2xl max-h-[90vh] bg-surface rounded-xl border border-brand-soft shadow-2xl overflow-y-auto flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 rounded-t-xl bg-brand-soft border-b border-brand-soft px-6 py-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 pr-2">
                    <h2 className="text-lg font-bold text-ink leading-tight">
                      {req.code} — {(req.preferredVendor ?? '').trim() || 'No preferred vendor'}
                    </h2>
                    {(req.description?.trim() || req.items[0]) && (
                      <p className="text-sm text-ink-3 mt-1.5 font-medium leading-snug">
                        {req.description?.trim() || req.items[0]}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="text-ink-4 hover:text-ink-2 text-2xl leading-none transition-colors"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-md font-bold border ${req.priority === 'High' ? 'bg-err-soft text-err border-[color:var(--st-red-fg)]/30' :
                    req.priority === 'Medium' ? 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30' :
                      'bg-surface-3 text-ink-2 border-border'
                    }`}>{req.priority}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-md font-bold border ${req.status === 'New' ? 'bg-brand-soft text-brand border-brand-soft' :
                    req.status === 'Quoted' ? 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30' :
                      req.status === 'PO Draft' ? 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30' :
                        req.status === 'PO Released' ? 'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30' :
                          'bg-surface-3 text-ink-2 border-border'
                    }`}>{req.status}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-md font-bold border ${req.type === 'RM' ? 'bg-brand-soft text-brand border-brand-soft' : 'bg-brand-soft text-brand border-brand-soft'
                    }`}>{req.type}</span>
                  {req.stockCheckStatus ? (
                    <span
                      className={`text-xs px-2.5 py-1 rounded-md font-bold border ${
                        isStockCheckPendingForRequest(req)
                          ? 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30'
                          : String(req.stockCheckStatus).trim().toLowerCase() === 'completed'
                            ? 'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30'
                            : 'bg-brand-soft text-brand border-brand-soft'
                      }`}
                    >
                      Stock Check: {req.stockCheckStatus}
                    </span>
                  ) : null}
                  {parseStockCheckOutcome(req.stockCheckNotes) === 'not_ok' ? (
                    <span className="text-xs px-2.5 py-1 rounded-md font-bold border bg-err-soft text-err border-[color:var(--st-red-fg)]/30">
                      Warehouse: Not OK
                    </span>
                  ) : parseStockCheckOutcome(req.stockCheckNotes) === 'all_ok' ? (
                    <span className="text-xs px-2.5 py-1 rounded-md font-bold border bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30">
                      Warehouse: All OK
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex-1 px-6 py-5 space-y-5 bg-surface-3">
                {/* Request Metadata */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-ink-3">Request Date</span>
                    <span className="text-ink font-medium">
                      {formatDateEnInSafe(req.createdDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-ink-3">Requested By</span>
                    <span className="text-ink font-medium">{req.requestedBy ?? 'Planning Team'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-ink-3">Required Date</span>
                    <span className="text-warn font-bold">
                      {formatDateWithIsoWeek(req.dueDate)}
                    </span>
                    {!req.dueDate?.trim() && (
                      <p className="text-[10px] text-ink-3 mt-0.5">
                        Not set — use <strong>Edit Request</strong> below to add a required date.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-ink-3">Source</span>
                    <span className="text-ink font-medium">{req.source ?? 'Planning Team'}</span>
                  </div>
                  {req.preferredVendor && (
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-ink-3">Preferred vendor</span>
                      <span className="text-ink font-medium">{req.preferredVendor}</span>
                    </div>
                  )}
                </div>

                {/* Items Requested - Detailed */}
                {req.itemDetails && req.itemDetails.length > 0 ? (
                  <div>
                    <h3 className="text-xs tracking-wider text-ink-3 uppercase mb-3 font-bold">Items Requested</h3>
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
                          <div key={item.itemCode} className="bg-surface rounded-lg border border-brand-soft overflow-hidden shadow-[var(--e1)]">
                            {/* Item Header */}
                            <div className="px-4 py-3 bg-brand-soft border-b border-brand-soft">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="font-bold text-ink text-sm">{item.itemName}</h4>
                                <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-3 text-ink-2">{item.itemCode}</span>
                              </div>
                            </div>

                            {/* Item Details Grid */}
                            <div className="px-4 py-3">
                              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                                <div>
                                  <p className="text-ink-3 uppercase tracking-wide mb-1">Req Qty</p>
                                  <p className="text-ink font-bold">{item.reqQty} {item.unit}</p>
                                </div>
                                <div>
                                  <p className="text-ink-3 uppercase tracking-wide mb-1">MOQ</p>
                                  <p className="text-ink font-bold">
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
                                  <p className="text-ink-3 uppercase tracking-wide mb-1">Pack Size</p>
                                  <p className="text-ink font-bold">{item.packSize}</p>
                                </div>
                                <div>
                                  <p className="text-ink-3 uppercase tracking-wide mb-1">Planned Price/Unit</p>
                                  <p className="text-ok font-bold">₹{item.plannedPrice}/{item.unit}</p>
                                </div>
                                <div>
                                  <p className="text-ink-3 uppercase tracking-wide mb-1">Est. Value</p>
                                  <p className="text-warn font-bold">₹{item.estValue.toLocaleString('en-IN')}</p>
                                </div>
                                <div>
                                  <p className="text-ink-3 uppercase tracking-wide mb-1">Lead (D)</p>
                                  <p className="text-ink font-bold">
                                    {item.leadTimeDays != null && Number.isFinite(item.leadTimeDays) ? `${item.leadTimeDays}d` : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-ink-3 uppercase tracking-wide mb-1">Expected</p>
                                  <p className="text-ink font-bold">
                                    {formatDateWithIsoWeek(item.expectedDate || req.dueDate)}
                                  </p>
                                </div>
                                {modalStockCheckGap ? (
                                  <div className="col-span-2">
                                    <p className="text-ink-3 uppercase tracking-wide mb-1">Stock check gap</p>
                                    <p className="text-warn font-bold tabular-nums">
                                      +{modalStockCheckGap.gapQty.toLocaleString('en-IN')} {item.unit}
                                    </p>
                                  </div>
                                ) : null}
                              </div>

                              {modalStockCheckGap ? (
                                <div className="mt-3 rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-warn-soft px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs text-warn">
                                    Warehouse reported a shortfall after stock check. Approve to add gap qty to this
                                    request{modalStockCheckGap.consumptionQty != null
                                      ? ` (consumption ${modalStockCheckGap.consumptionQty.toLocaleString('en-IN')} ${item.unit} in audit window)`
                                      : ''}{' '}
                                    and set inventory to the physical count.
                                  </p>
                                  {modalStockCheckGap.gapApproved ? (
                                    <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-ok-soft text-ok border border-[color:var(--st-green-fg)]/30">
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
                                      className="px-3 py-1.5 rounded-lg border border-[color:var(--st-amber-fg)]/40 bg-surface text-warn text-xs font-semibold hover:bg-warn-soft disabled:opacity-60"
                                    >
                                      {approvingGapLineKey === modalGapLineKey ? 'Approving…' : 'Approve gap'}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}

                              {/* Vendor history for this RM */}
                              {(quoteHistory.length > 0 || poHistory.length > 0) && (
                                <div className="mt-3 pt-3 border-t border-border">
                                  <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-2">Vendor history (previously used for this RM)</p>
                                  <div className="space-y-1.5 text-xs">
                                    {quoteHistory.map((e, i) => (
                                      <div key={`q-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-ink-2">
                                        <span className="font-medium text-ink">{e.vendor}</span>
                                        <span className="text-ink-3">— Quoted</span>
                                        {e.date && <span className="text-ink-3">{e.date}</span>}
                                        <span className="text-ok font-medium">₹{Number(e.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/unit</span>
                                        {e.status === 'Confirmed' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-ok-soft text-ok">Confirmed</span>}
                                      </div>
                                    ))}
                                    {poHistory.map((e, i) => (
                                      <div key={`po-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-ink-2">
                                        <span className="font-medium text-ink">{e.vendor}</span>
                                        <span className="text-ink-3">— PO</span>
                                        <span className="font-mono text-ink-3">{e.poNumber}</span>
                                        <span className="text-ok font-medium">₹{Number(e.rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/unit</span>
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
                    <h3 className="text-xs tracking-wider text-ink-3 uppercase mb-3 font-bold">Items Requested</h3>
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
                          <div key={idx} className="bg-surface border border-brand-soft rounded-lg p-4 space-y-2 shadow-[var(--e1)]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-ink font-semibold text-sm">{itemName}</p>
                                {spec && (
                                  <p className="text-ink-3 text-xs mt-1 wrap-break-word">{spec}</p>
                                )}
                              </div>
                              <span className="text-ink font-bold text-sm whitespace-nowrap">₹{sub.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="text-ink-3">Req Qty:</span>
                                <span className="text-ink font-medium">{qty} {unit}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-ink-3">Planned Price:</span>
                                <span className="text-ok font-medium">₹{price.toLocaleString('en-IN')}/{unit}</span>
                              </div>
                            </div>
                            {(quoteHistory.length > 0 || poHistory.length > 0) && (
                              <div className="mt-3 pt-3 border-t border-border">
                                <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-2">Vendor history (previously used for this RM)</p>
                                <div className="space-y-1.5 text-xs">
                                  {quoteHistory.map((e, i) => (
                                    <div key={`q-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-ink-2">
                                      <span className="font-medium text-ink">{e.vendor}</span>
                                      <span className="text-ink-3">— Quoted</span>
                                      {e.date && <span className="text-ink-3">{e.date}</span>}
                                      <span className="text-ok font-medium">₹{Number(e.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/unit</span>
                                      {e.status === 'Confirmed' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-ok-soft text-ok">Confirmed</span>}
                                    </div>
                                  ))}
                                  {poHistory.map((e, i) => (
                                    <div key={`po-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-ink-2">
                                      <span className="font-medium text-ink">{e.vendor}</span>
                                      <span className="text-ink-3">— PO</span>
                                      <span className="font-mono text-ink-3">{e.poNumber}</span>
                                      <span className="text-ok font-medium">₹{Number(e.rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/unit</span>
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
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm bg-surface rounded-lg p-3 shadow-[var(--e1)]">
                      <span className="text-ink-3 font-medium">Total Estimated Value</span>
                      <span className="text-ink font-bold text-base">
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
                    <h3 className="text-xs tracking-wider text-ink-3 uppercase mb-3 font-bold">Stock Summary</h3>
                    <div className="bg-surface rounded-lg border border-brand-soft overflow-hidden shadow-[var(--e1)]">
                      {(() => {
                        const stockCheckCompleted =
                          String(req.stockCheckStatus ?? '').trim().toLowerCase() === 'completed';
                        if (!stockCheckCompleted) {
                          return [
                            { label: 'Stock In Hand', value: 'Pending stock check completion', color: 'text-ink-3', isPending: true },
                            { label: 'Item Open PO (warehouse)', tooltip: 'Open PO quantity for this item across the warehouse — not just this PR', value: 'Pending stock check completion', color: 'text-ink-3', isPending: true },
                            { label: 'In Transit', value: 'Pending stock check completion', color: 'text-ink-3', isPending: true },
                            { label: 'Open Orders', value: 'Pending stock check completion', color: 'text-ink-3', isPending: true },
                          ];
                        }
                        const summary = requestStockSummaryByRequestId.get(req.id)
                          ?? req.stockSummary
                          ?? { stockInHand: 0, openPOQty: 0, inTransit: 0, openOrders: 0 };
                        return [
                          { label: 'Stock In Hand', value: summary.stockInHand, color: summary.stockInHand > 100 ? 'text-ok' : 'text-warn', isPending: false },
                          { label: 'Item Open PO (warehouse)', tooltip: 'Open PO quantity for this item across the warehouse — not just this PR', value: summary.openPOQty, color: 'text-ink', isPending: false },
                          { label: 'In Transit', value: summary.inTransit, color: summary.inTransit > 0 ? 'text-brand' : 'text-ink', isPending: false },
                          { label: 'Open Orders', value: summary.openOrders, color: summary.openOrders > 0 ? 'text-brand' : 'text-ink', isPending: false },
                        ];
                      })().map((row, idx) => (
                        <div key={row.label} className={`flex items-center justify-between px-4 py-3 ${idx < 3 ? 'border-b border-border' : ''}`}>
                          <span className="text-ink-3 text-sm" title={(row as { tooltip?: string }).tooltip}>{row.label}</span>
                          <span className={`font-bold ${row.isPending ? 'text-sm' : 'text-lg'} ${row.color}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quotations from Items List + vendor selection for this PR */}
                <div>
                  <h3 className="text-xs tracking-wider text-ink-3 uppercase mb-3 font-bold">
                    Quotations ({requestItemQuotes.length})
                  </h3>
                  {requestItemQuotes.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-brand-soft px-4 py-8 text-center text-sm text-ink-3">
                      No Items List vendor rates found for this request&apos;s RM/PM items yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-ink-3 mb-1">Preferred vendor for this request</label>
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
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface"
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
                      <div className="overflow-auto max-h-[70vh] rounded-lg border border-border bg-surface">
                        <table className="min-w-full text-xs">
                          <thead className="bg-surface-3 text-ink-2 sticky top-0 z-20 [&_th]:bg-surface-3">
                            <tr>
                              <th scope="col" className="px-3 py-2 text-left font-semibold">Item</th>
                              <th scope="col" className="px-3 py-2 text-left font-semibold">Vendor</th>
                              <th scope="col" className="px-3 py-2 text-right font-semibold">Price/Unit</th>
                              <th scope="col" className="px-3 py-2 text-right font-semibold">MOQ</th>
                              <th scope="col" className="px-3 py-2 text-right font-semibold">Lead (D)</th>
                              <th scope="col" className="px-3 py-2 text-left font-semibold">Terms</th>
                            </tr>
                          </thead>
                          <tbody>
                            {requestItemQuotes.map((row) => (
                              <tr key={row.key} className="border-t border-hairline">
                                <td className="px-3 py-2">
                                  <div className="font-medium text-ink">{row.itemName}</div>
                                  <div className="text-[10px] text-ink-3">{row.itemCode}</div>
                                </td>
                                <td className="px-3 py-2 text-ink">{row.vendor}</td>
                                <td className="px-3 py-2 text-right text-ink">₹{row.pricePerUnit.toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 text-right text-ink-2">
                                  {row.moqMin}
                                  {row.moqMax != null && row.moqMax > row.moqMin ? ` - ${row.moqMax}` : '+'}
                                </td>
                                <td className="px-3 py-2 text-right text-ink-2">{row.leadTimeDays}d</td>
                                <td className="px-3 py-2 text-ink-2 max-w-48 align-top">
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
                  <h3 className="text-xs tracking-wider text-ink-3 uppercase mb-3 font-bold">Stock Check</h3>
                  <div className="bg-surface rounded-lg border border-brand-soft p-4 space-y-3 shadow-[var(--e1)]">
                    <div>
                      <label className="block text-xs font-semibold text-ink-3 mb-1">Assigned To</label>
                      <input
                        type="text"
                        value={stockCheckForm.assignedTo}
                        onChange={(e) => setStockCheckForm((f) => ({ ...f, assignedTo: e.target.value }))}
                        placeholder="e.g. Anand Store"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-3 mb-1">Status</label>
                      <select
                        value={stockCheckForm.status}
                        onChange={(e) => setStockCheckForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink bg-surface"
                      >
                        <option value="">— Select status —</option>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-3 mb-1">Due Date</label>
                      <input
                        type="date"
                        value={stockCheckForm.dueDate}
                        onChange={(e) => setStockCheckForm((f) => ({ ...f, dueDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-3 mb-1">Notes / Alert</label>
                      <textarea
                        value={stockCheckForm.notes}
                        onChange={(e) => setStockCheckForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="e.g. Quarterly replenishment; SOH critically low for UV-001"
                        rows={2}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink"
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
                        className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-press disabled:opacity-50"
                      >
                        {stockCheckSaving ? 'Saving…' : 'Save stock check'}
                      </button>
                    </div>
                  </div>
                </div> */}
              </div>

              {/* Action Buttons */}
              <div className="sticky bottom-0 rounded-b-xl bg-surface-3 border-t border-brand-soft px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditRequestTarget(req);
                    }}
                    className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3 transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deletingRequestId === req.id}
                    onClick={() => openDeleteRequestConfirm(req)}
                    className="px-4 py-2 rounded-lg border border-[color:var(--st-red-fg)]/30 text-err text-sm font-semibold hover:bg-err-soft transition disabled:opacity-50"
                  >
                    {deletingRequestId === req.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleStockCheckAction(req)}
                    className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3 transition"
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
                    className="px-4 py-2 rounded-lg border border-brand-soft text-brand text-sm font-semibold hover:bg-brand-soft transition"
                  >
                    Priority
                  </button>

                  <button
                    type="button"
                    onClick={() => openReleaseToDraftPoForRequest(req)}
                    className="px-4 py-2 rounded-lg border border-[color:var(--st-amber-fg)]/30 text-warn text-sm font-semibold hover:bg-warn-soft transition"
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
                      disabled={createDraftPOBusy}
                      className="px-4 py-2 rounded-lg bg-warn text-white text-sm font-bold hover:brightness-95 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createDraftPOBusy ? 'Creating…' : 'Create Draft PO (Quick)'}
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
                        className="px-4 py-2 rounded-lg bg-ok text-white text-sm font-bold hover:brightness-95 transition shadow-lg"
                      >
                        Release PO ↗
                      </button>
                    );
                  })()}

                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="px-4 py-2 rounded-lg bg-surface-3 text-ink-2 text-sm font-semibold hover:bg-surface-3 transition"
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
            className="relative w-full max-w-2xl rounded-xl bg-surface shadow-xl border border-border p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-ink">Edit Request — {editRequestTarget.code}</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setEditRequestTarget(null)}
                className="text-ink-3 hover:text-ink transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-3 mb-1">Required date</label>
                  <input
                    type="date"
                    value={editRequestForm.requiredByDate}
                    onChange={(e) => setEditRequestForm((f) => ({ ...f, requiredByDate: e.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  />
                  <p className="text-[10px] text-ink-3 mt-1">
                    When material is needed by Planning / production. Also sets Items List tier valid-till for the preferred vendor.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-3 mb-1">Priority</label>
                  <select
                    value={editRequestForm.priority}
                    onChange={(e) =>
                      setEditRequestForm((f) => ({ ...f, priority: e.target.value as RequestPriority }))
                    }
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
              {/* <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">Preferred vendor</label>
                <select
                  value={editRequestForm.preferredVendor}
                  onChange={(e) => setEditRequestForm((f) => ({ ...f, preferredVendor: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
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
                    <label className="block text-xs font-semibold text-ink-3 mb-1">Quotation to use for Draft PO</label>
                    <select
                      value={editRequestForm.selectedQuotationId}
                      onChange={(e) => setEditRequestForm((f) => ({ ...f, selectedQuotationId: e.target.value }))}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm"
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
                    <p className="text-xs text-ink-3 mt-1">Choose which quotation’s price to use when creating a Draft PO.</p>
                  </div>
                );
              })()} */}
              {/* <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">Notes</label>
                <textarea
                  value={editRequestForm.notes}
                  onChange={(e) => setEditRequestForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div> */}
              {/* <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">Status</label>
                <select
                  value={editRequestForm.status}
                  onChange={(e) => setEditRequestForm((f) => ({ ...f, status: e.target.value as RequestStatus }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
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
                  <label className="block text-xs font-semibold text-ink-3 mb-2">Line items — qty, unit & planned price</label>
                  <div className="border border-border rounded-lg overflow-auto max-h-[70vh]">
                    <table className="w-full text-sm min-w-[36rem]">
                      <thead className="sticky top-0 z-20 [&_th]:bg-surface-3">
                        <tr className="bg-surface-3 border-b border-border">
                          <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">Item</th>
                          <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">Type</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Qty to request</th>
                          <th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">Unit</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Price (₹/unit)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editRequestForm.items.map((item, idx) => {
                          const plannedPrice = resolvePlannedUnitPrice(item);
                          return (
                          <tr key={idx} className="border-b border-hairline last:border-0">
                            <td className="px-3 py-2">
                              <span className="font-medium text-ink">{item.name ?? item.code ?? '—'}</span>
                              {item.code && <span className="text-xs text-ink-3 block">{item.code}</span>}
                            </td>
                            <td className="px-3 py-2 text-ink-2">{item.type ?? 'RM'}</td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                value={item.quantity_requested ?? 0}
                                onChange={(e) => updateEditRequestItem(idx, { quantity_requested: parseFloat(e.target.value) || 0 })}
                                className="w-24 px-2 py-1.5 rounded border border-border text-right text-sm focus:ring-2 focus:ring-[color:var(--ring)]"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={item.unit ?? 'KG'}
                                onChange={(e) => updateEditRequestItem(idx, { unit: e.target.value })}
                                className="w-20 px-2 py-1.5 rounded border border-border text-sm focus:ring-2 focus:ring-[color:var(--ring)]"
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
                                className="w-28 px-2 py-1.5 rounded border border-border text-right text-sm focus:ring-2 focus:ring-[color:var(--ring)]"
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
              {/* <div className="border-t border-border pt-4 mt-4">
                <h4 className="text-sm font-bold text-ink mb-2">Price history — RM/PM by vendor</h4>
                <p className="text-xs text-ink-3 mb-3">For each RM/PM on this request: which vendors have been used historically (from quotations and POs). Use this when picking a vendor for a new quote or Draft PO.</p>
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
                      <p className="text-xs text-ink-3 italic">No price history for these items yet. Record quotations (with or without linking to a PR) to see vendor history here.</p>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      {quotesForItems.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-2">Quotations for these items ({quotesForItems.length} total, any vendor)</p>
                          <div className="space-y-3">
                            {quotesForItems.map((q) => (
                              <div key={q.id} className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
                                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                  <span className="font-semibold text-ink">{q.vendor}</span>
                                  <span className="text-xs text-ink-3">{q.quotedOn || '—'}</span>
                                  {q.requestCode && <span className="text-[10px] text-ink-3">Link: {q.requestCode}</span>}
                                  {q.status !== 'Pending Review' && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${q.status === 'Confirmed' ? 'bg-ok-soft text-ok' :
                                      q.status === 'Not Selected' ? 'bg-surface-3 text-ink-2' : 'bg-warn-soft text-warn'
                                      }`}>{q.status}</span>
                                  )}
                                </div>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-ink-3 border-b border-border">
                                      <th scope="col" className="text-left py-1 font-medium">Item</th>
                                      <th scope="col" className="text-right py-1 font-medium">Qty</th>
                                      <th scope="col" className="text-right py-1 font-medium">Price/unit</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {q.lines?.map((line, i) => (
                                      <tr key={i} className="border-b border-hairline last:border-0">
                                        <td className="py-1 text-ink">{line.item}</td>
                                        <td className="py-1 text-right text-ink-2">{line.qty}</td>
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
                          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-2">POs for this request</p>
                          <div className="space-y-3">
                            {prPOs.map((po) => (
                              <div key={po.id} className="rounded-lg border border-border bg-brand-soft p-3 text-sm">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="font-semibold text-ink">{po.vendorName ?? po.id}</span>
                                  <span className="text-xs text-ink-3 font-mono">{po.poNumber}</span>
                                  <span className="text-xs text-ink-3">{po.date || '—'}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-surface-3 text-ink-2">{po.status ?? 'Draft'}</span>
                                </div>
                                {Array.isArray(po.rawItems) && po.rawItems.length > 0 ? (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-ink-3 border-b border-border">
                                        <th scope="col" className="text-left py-1 font-medium">Item</th>
                                        <th scope="col" className="text-right py-1 font-medium">Qty</th>
                                        <th scope="col" className="text-right py-1 font-medium">Rate</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {po.rawItems.map((row: { itemName?: string; name?: string; quantity?: number; rate?: number; price?: number }, i: number) => (
                                        <tr key={i} className="border-b border-hairline last:border-0">
                                          <td className="py-1 text-ink">{row.itemName ?? row.name ?? '—'}</td>
                                          <td className="py-1 text-right text-ink-2">{row.quantity ?? '—'}</td>
                                          <td className="py-1 text-right font-medium">₹{typeof (row.rate ?? row.price) === 'number' ? (row.rate ?? row.price)!.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : (row.rate ?? row.price ?? '—')}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="text-xs text-ink-3">No line detail</p>
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
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setEditRequestTarget(null)}
                className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3"
              >
                Cancel
              </button>
              <button
                disabled={editRequestSaving}
                onClick={async () => {
                  if (editRequestSaving) return;
                  if (!editRequestTarget) return;
                  setEditRequestSaving(true);
                  try {
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
                  } finally {
                    setEditRequestSaving(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-press disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editRequestSaving ? 'Saving…' : 'Save'}
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
            <div className="relative w-full max-w-5xl my-2 sm:my-4 max-h-[94vh] overflow-hidden rounded-xl bg-surface shadow-xl border border-border flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">
                    PO-DRAFT-{req.code.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase() || 'XXXX'}
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded border border-brand-soft bg-brand-soft text-brand">
                      {releaseToPlannedForm.vendor || req.preferredVendor || 'Unassigned'}
                    </span>
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded border border-[color:var(--st-amber-fg)]/30 bg-warn-soft text-warn">
                      DRAFT
                    </span>
                  </h2>
                  <p className="text-xs text-ink-3 mt-0.5">
                    Draft PO · Vendor payment splits in Draft controls; Treasury advance type below if used.
                  </p>
                </div>
                <button type="button" onClick={() => setReleaseToPlannedTarget(null)} className="px-3 py-1.5 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3">Close</button>
              </div>
              <div className="flex-1 overflow-auto p-3 sm:p-5 space-y-5">
                <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--e1)] w-full">
                  <h3 className="font-bold text-ink text-sm mb-1">PO lines</h3>
                  <p className="text-xs text-ink-3 mb-3">
                    Set <span className="font-semibold text-ink-2">release qty</span> per line (≤ open request). What you do not put on this draft stays open on the procurement request. Adjust pricing via vendor and MOQ slab below.
                  </p>
                  <div className="border-t border-border my-3" />
                  <div className="overflow-auto max-h-[70vh] w-full">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-20 [&_th]:bg-surface-2">
                        <tr className="text-ink-3 border-b border-border">
                          <th scope="col" className="text-left py-2 pr-3 font-medium">Item</th>
                          <th scope="col" className="text-right py-2 font-medium whitespace-nowrap">MOQ</th>
                          <th scope="col" className="text-right py-2 font-medium whitespace-nowrap">Qty</th>
                          <th scope="col" className="text-right py-2 font-medium whitespace-nowrap">Unit</th>
                          <th scope="col" className="text-right py-2 font-medium whitespace-nowrap">Unit ₹</th>
                          <th scope="col" className="text-right py-2 font-medium whitespace-nowrap">Line ₹</th>
                          <th scope="col" className="text-right py-2 font-medium whitespace-nowrap">Lead</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItemsForModal.map((ln, i) => (
                          <tr key={`${ln.itemCode}-${i}`} className="border-b border-hairline">
                            <td className="py-2 pr-2 align-top">
                              <div className="font-medium text-ink leading-5 break-words">{ln.itemName}</div>
                              <div className="text-[10px] text-ink-3 font-mono truncate">{ln.itemCode}</div>
                            </td>
                            <td className="py-2 text-right text-ink whitespace-nowrap align-top tabular-nums">
                              {ln.moq != null && Number(ln.moq) > 0 ? Number(ln.moq).toLocaleString('en-IN') : '—'}
                            </td>
                            <td className="py-2 text-right text-ink font-medium whitespace-nowrap align-top tabular-nums">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={String(ln.qty === 0 ? '' : ln.qty)}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^0-9.]/g, '');
                                  const n = raw === '' ? 0 : parseFloat(raw);
                                  const next = Number.isFinite(n) ? Math.max(0, n) : 0;
                                  setReleaseToPlannedLineEdits((prev) => {
                                    const base = prev.length > 0 ? prev : [...lineItemsForModal];
                                    return base.map((row, ri) => (ri === i ? { ...row, qty: next } : row));
                                  });
                                }}
                                className="w-24 rounded border border-border px-1.5 py-1 text-right text-xs tabular-nums"
                              />
                              <div className="text-[10px] text-ink-4 mt-0.5">
                                open: {Number(ln.originalQty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </div>
                            </td>
                            <td className="py-2 text-right text-ink-2 whitespace-nowrap align-top">{ln.unit}</td>
                            <td className="py-2 text-right text-ink whitespace-nowrap align-top tabular-nums">
                              ₹{Number(ln.unitPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 text-right font-medium whitespace-nowrap align-top tabular-nums">
                              ₹{((ln.qty * ln.unitPrice) * 1.18).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 text-right text-ink-2 whitespace-nowrap align-top">{ln.leadDays}d</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {lineItemsForModal.length === 0 && <p className="text-xs text-ink-3 py-3">No request line items found.</p>}
                </div>
                <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--e1)] space-y-3 w-full">
                  <h3 className="font-bold text-ink text-sm">Draft controls</h3>
                  <p className="text-xs text-ink-3">Select vendor and MOQ slab to apply Items List rates; payment terms apply to the draft PO.</p>
                  <div className="border-t border-border pt-3 space-y-2">
                    <div>
                      <span className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">Vendor payment terms</span>
                      <PaymentTermsDisplay value={releaseModalVendorTerms} />
                    </div>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-ink-3">Subtotal (ex GST)</span>
                      <span className="text-ink font-medium tabular-nums">
                        ₹{releaseModalSubtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-ink-3">GST (18%)</span>
                      <span className="text-ink font-medium tabular-nums">
                        ₹{releaseModalGstTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1 border-t border-hairline pt-2">
                      <span className="text-ink-3 font-semibold">Total (incl. GST)</span>
                      <span className="text-ink font-bold tabular-nums">
                        ₹{releaseModalGrand.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-border my-3" />
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">Vendor</label>
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
                          className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                        >
                          <option value="">— Select —</option>
                          {uniqueVendors.map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">MOQ slab</label>
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
                          className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
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
                        <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">Payment terms (type)</label>
                        <select
                          value={releaseToPlannedForm.paymentTermsType}
                          onChange={(e) =>
                            setReleaseToPlannedForm((f) => ({
                              ...f,
                              paymentTermsType: e.target.value as PaymentTermsStructuredType,
                            }))
                          }
                          className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                        >
                          {PAYMENT_TERMS_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-ink-3 mt-1">Advance % drives Treasury on draft release.</p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">Lead time (max line)</label>
                        <div className="py-1.5 text-sm font-medium text-ink">
                          {(lineItemsForModal.length
                            ? Math.max(...lineItemsForModal.map((ln) => Number(ln.leadDays) || 0))
                            : 0)} days
                        </div>
                      </div>
                    </div>
                    {paymentTermsTypeRequiresAdvancePercent(releaseToPlannedForm.paymentTermsType) && (
                      <div className="mb-3">
                        <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">Advance %</label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={releaseToPlannedForm.advancePercent}
                          onChange={(e) => setReleaseToPlannedForm((f) => ({ ...f, advancePercent: e.target.value }))}
                          className="w-full max-w-xs rounded-lg border border-border px-2 py-1.5 text-sm"
                        />
                      </div>
                    )}
                    <div className="border-t border-border my-3" />
                    {/* PO type (Flowchart §5) + live approval-route preview (Sub-flow E) */}
                    <div className="mb-3">
                      <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-wide mb-1">PO type</label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {PO_TYPE_ORDER.map((t) => {
                          const cfg = PO_TYPE_CONFIG[t];
                          const active = releasePoType === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setReleasePoType(t)}
                              title={cfg.blurb}
                              className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold text-left transition ${
                                active
                                  ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-1 ring-inset ring-current`
                                  : 'bg-surface text-ink-3 border-border hover:border-border'
                              }`}
                            >
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                      {(() => {
                        const route = resolvePoApprovalRoute(releasePoType, releaseModalGrand);
                        const isCfo = route.finalApprover === 'cfo';
                        return (
                          <div className={`mt-2 rounded-lg border px-3 py-2 text-[11px] ${isCfo ? 'border-[color:var(--st-amber-fg)]/30 bg-warn-soft text-warn' : 'border-brand-soft bg-brand-soft text-brand'}`}>
                            <span className="font-bold">Approval route: </span>
                            {route.twoStep ? 'Procurement Head → ' : ''}{poApproverRoleLabel(route.finalApprover)}
                            {route.deviationFlag ? ' · deviation-flagged' : ''}
                            <span className="block text-[10px] opacity-80 mt-0.5">{route.note} Submit for approval from the Purchase Orders tab after the draft is created.</span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="border border-border rounded-lg p-3 bg-surface-3">
                      <h3 className="font-bold text-ink text-sm mb-2">Notes</h3>
                      <textarea
                        value={releaseToPlannedNotes}
                        onChange={(e) => setReleaseToPlannedNotes(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface"
                        placeholder="Add draft notes..."
                      />
                    </div>
                    <h3 className="font-bold text-ink text-sm mb-2">Previous purchases</h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-ink-3 border-b border-border">
                          <th scope="col" className="text-left py-1 font-medium">Date</th>
                          <th scope="col" className="text-left py-1 font-medium">Vendor</th>
                          <th scope="col" className="text-right py-1 font-medium">Qty</th>
                          <th scope="col" className="text-right py-1 font-medium">Unit ₹</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previousPurchases.map((r, i) => (
                          <tr key={i} className="border-b border-hairline">
                            <td className="py-1.5 text-ink-2">{r.date ? new Date(r.date + 'Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                            <td className="py-1.5 text-ink-2">{r.vendor}</td>
                            <td className="py-1.5 text-right text-ink-2">{r.qty} <span className="text-ink-3">{r.unit}</span></td>
                            <td className="py-1.5 text-right font-medium">₹{r.unitPrice.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                        {previousPurchases.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-ink-3 text-xs">No previous purchases for this item.</td></tr>}
                      </tbody>
                    </table>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-border bg-surface-3 flex items-center justify-between">
                <p className="text-xs text-ink-3">Release triggers treasury if advance terms are selected.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setReleaseToPlannedTarget(null)} className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3">Cancel</button>
                  <button
                    type="button"
                    disabled={releaseDraftBusy}
                    onClick={async () => {
                      if (releaseDraftBusy) return;
                      setReleaseDraftBusy(true);
                      try {
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
                          poType: releasePoType,
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
                        poType: releasePoType,
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
                      } finally {
                        setReleaseDraftBusy(false);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-warn text-white text-sm font-bold hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {releaseDraftBusy ? 'Releasing…' : 'Release Draft'}
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
            className="relative w-full max-w-2xl rounded-xl bg-surface shadow-xl border border-border p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-ink">Edit Draft PO — {editDraftPOTarget.dpoNumber}</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setEditDraftPOTarget(null)}
                className="text-ink-3 hover:text-ink transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="edit-draft-po-vendor" className="block text-xs font-semibold text-ink-3 mb-1">Vendor</label>
                {/* Typeahead rather than a <select>: the vendor master runs to hundreds of rows, and
                    a plain dropdown made you scroll it by eye. Searches name, code, city and GSTIN,
                    the same as everywhere else a vendor is picked. */}
                <VendorClientNameTypeahead
                  inputId="edit-draft-po-vendor"
                  parties={vendorClientList ?? []}
                  loading={vendorClientsLoading}
                  partyKind="vendor"
                  placeholder="Search vendor by name, code, city…"
                  selectedId={
                    (vendorClientList ?? []).find(
                      (v) => String(v.name ?? '').trim() === String(editDraftPOForm.vendor ?? '').trim(),
                    )?.id ?? ''
                  }
                  onSelect={(party) => {
                    const name = String(party?.name ?? '').trim();
                    const matched = vendors.find((v) => v.name === name);
                    const fromMaster = String(matched?.paymentTerms ?? '').trim();
                    setEditDraftPOForm((f) => ({
                      ...f,
                      vendor: name,
                      // Clearing the vendor must not strand the previous vendor's terms on the PO.
                      paymentTerms: name ? fromMaster || f.paymentTerms : '',
                    }));
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">Payment terms</label>
                <p className="text-[11px] text-ink-3 mb-2">From vendor master (edit in Masters → Vendors).</p>
                <PaymentTermsDisplay value={editDraftPOForm.paymentTerms} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">Expected delivery</label>
                <input
                  type="date"
                  value={editDraftPOForm.expectedDelivery}
                  onChange={(e) => setEditDraftPOForm((f) => ({ ...f, expectedDelivery: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">Delivery address</label>
                <textarea
                  value={editDraftPOForm.deliveryAddress}
                  onChange={(e) => setEditDraftPOForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <span className="block text-xs font-semibold text-ink-3 mb-2">Line items — qty &amp; price/unit</span>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="bg-surface-3 text-left text-[11px] tracking-wide text-ink-3 border-b border-border">
                        <th scope="col" className="px-2 py-2 font-semibold">Item</th>
                        {/* Column order here must match the <td> order in the body row below:
                            Item · Lead · Qty · Price · GST · Total. */}
                        <th scope="col" className="px-2 py-2 font-semibold text-right w-28" title="Vendor lead time in days. Drives the Lead Connecting Date column on the Purchase Orders list.">Lead (days)</th>
                        <th scope="col" className="px-2 py-2 font-semibold text-right w-32">Qty</th>
                        <th scope="col" className="px-2 py-2 font-semibold text-right w-36">Price/unit (₹)</th>
                        <th scope="col" className="px-2 py-2 font-semibold text-right w-32">GST</th>
                        <th scope="col" className="px-2 py-2 font-semibold text-right w-40">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editDraftPOForm.lineItems.map((line, idx) => (
                        <tr key={idx} className="border-b border-hairline last:border-0">
                          <td className="px-2 py-2 align-top">
                            <p className="font-medium text-ink leading-snug">{line.item}</p>
                            <p className="text-[10px] text-ink-3">{line.itemCode}</p>
                          </td>
                          <td className="px-2 py-2 text-right align-top">
                            {/* Editable because plenty of POs arrive with no lead time at all —
                                imported ones, and any raised without a vendor quotation. Until it
                                can be filled in here, those lines can never show a Lead Connecting
                                Date. */}
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="—"
                              aria-label={`Lead time in days for ${line.itemCode || line.item}`}
                              title="Days from PO date to expected arrival. Leave blank if unknown."
                              value={
                                editDraftPoLeadDraft[idx] ??
                                (line.leadTimeDays != null ? String(line.leadTimeDays) : '')
                              }
                              onChange={(e) => {
                                const raw = e.target.value;
                                setEditDraftPoLeadDraft((prev) => ({ ...prev, [idx]: raw }));
                                const cleaned = raw.replace(/[^\d]/g, '');
                                // Blank clears it back to unknown rather than writing 0 — a zero
                                // lead means "arrives the day it is ordered", which is a different
                                // claim from "nobody has told us".
                                const leadTimeDays = cleaned === '' ? undefined : Number(cleaned);
                                const next = editDraftPOForm.lineItems.map((l, i) =>
                                  i === idx ? { ...l, leadTimeDays } : l,
                                );
                                setEditDraftPOForm((f) => ({ ...f, lineItems: next }));
                              }}
                              className="w-full rounded border border-border px-2 py-1 text-right tabular-nums"
                            />
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
                              className="w-full rounded border border-border px-2 py-1 text-right tabular-nums"
                            />
                          </td>
                          <td className="px-2 py-2 text-right align-top">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              value={
                                editDraftPoPriceDraft[idx] ??
                                (line.pricePerUnit != null && line.pricePerUnit !== 0 ? String(line.pricePerUnit) : '')
                              }
                              onChange={(e) => {
                                const raw = e.target.value;
                                setEditDraftPoPriceDraft((prev) => ({ ...prev, [idx]: raw }));
                                const cleaned = raw.replace(/,/g, '').trim();
                                const price = cleaned === '' ? 0 : parseFloat(cleaned.replace(/[^\d.]/g, '')) || 0;
                                const next = editDraftPOForm.lineItems.map((l, i) =>
                                  i === idx ? recalcDraftPoLineItem(l, { pricePerUnit: price }) : l,
                                );
                                setEditDraftPOForm((f) => ({ ...f, lineItems: next }));
                              }}
                              className="w-full rounded border border-border px-2 py-1 text-right tabular-nums"
                            />
                          </td>
                          <td className="px-2 py-2 text-right align-top">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                title="GST %"
                                value={
                                  editDraftPoGstDraft[idx] ??
                                  (line.gstPercent != null ? String(line.gstPercent) : '')
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  setEditDraftPoGstDraft((prev) => ({ ...prev, [idx]: raw }));
                                  setEditDraftPoGstAmtDraft((prev) => {
                                    const next = { ...prev };
                                    delete next[idx];
                                    return next;
                                  });
                                  const cleaned = raw.replace(/,/g, '').trim();
                                  const gstPercent = cleaned === '' ? 0 : parseFloat(cleaned.replace(/[^\d.]/g, '')) || 0;
                                  const next = editDraftPOForm.lineItems.map((l, i) =>
                                    i === idx ? recalcDraftPoLineItem(l, { gstPercent }) : l,
                                  );
                                  setEditDraftPOForm((f) => ({ ...f, lineItems: next }));
                                }}
                                className="w-12 rounded border border-border px-1.5 py-1 text-right tabular-nums"
                              />
                              <span className="text-ink-3 text-[10px]">%</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-ink-3 text-[10px]">₹</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                title="GST amount"
                                value={
                                  editDraftPoGstAmtDraft[idx] ??
                                  (line.gstAmount != null && line.gstAmount !== 0 ? String(line.gstAmount) : '')
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  setEditDraftPoGstAmtDraft((prev) => ({ ...prev, [idx]: raw }));
                                  setEditDraftPoGstDraft((prev) => {
                                    const next = { ...prev };
                                    delete next[idx];
                                    return next;
                                  });
                                  const cleaned = raw.replace(/,/g, '').trim();
                                  const gstAmount = cleaned === '' ? 0 : parseFloat(cleaned.replace(/[^\d.]/g, '')) || 0;
                                  const next = editDraftPOForm.lineItems.map((l, i) =>
                                    i === idx ? recalcDraftPoLineItem(l, { gstAmount }) : l,
                                  );
                                  setEditDraftPOForm((f) => ({ ...f, lineItems: next }));
                                }}
                                className="w-16 rounded border border-border px-1.5 py-1 text-right tabular-nums"
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right align-top tabular-nums text-ink font-medium whitespace-nowrap">
                            ₹{line.lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add a new line — same picker as the Issued PO editor. Its qty counts toward
                    PO Qty / total once saved but isn't matched against the linked request's
                    demand (there's nothing there to sync — it was never asked for). */}
                <div className="mt-2 relative">
                  <input
                    type="text"
                    placeholder="+ Add item — search by name or code…"
                    value={addDraftPoItemSearch}
                    onChange={(e) => setAddDraftPoItemSearch(e.target.value)}
                    className="w-full rounded border border-dashed border-border px-2 py-1.5 text-xs focus:outline-none focus:border-brand"
                  />
                  {addDraftPoItemSearch.trim().length >= 2 && (() => {
                    const q = addDraftPoItemSearch.trim().toLowerCase();
                    const alreadyOnPo = new Set(
                      editDraftPOForm.lineItems.map((l) => String(l.itemCode ?? '').trim().toLowerCase()).filter(Boolean)
                    );
                    const matches = poAddItemCatalog
                      .filter((it): it is PriceListItemPage & { type: RequestType } => {
                        if (it.type !== 'RM' && it.type !== 'PM') return false; // PO lines are RM/PM only
                        const code = String(it.code ?? '').trim().toLowerCase();
                        const name = String(it.name ?? '').trim().toLowerCase();
                        if (code && alreadyOnPo.has(code)) return false;
                        return code.includes(q) || name.includes(q);
                      })
                      .slice(0, 8);
                    if (!matches.length) {
                      return (
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg px-3 py-2 text-xs text-ink-3">
                          No matching item found (or it&apos;s already on this PO).
                        </div>
                      );
                    }
                    return (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg max-h-56 overflow-auto">
                        {matches.map((it) => (
                          <button
                            key={`${it.type}-${it.code}`}
                            type="button"
                            onClick={() => {
                              const price = resolveStartingPriceForVendor(it, editDraftPOForm.vendor);
                              const base: DraftPOLineItem = {
                                item: it.name,
                                itemCode: it.code,
                                type: it.type,
                                qty: '1',
                                pricePerUnit: price,
                                gstPercent: it.gst ?? 18,
                                gstAmount: 0,
                                lineTotal: 0,
                                unit: it.uom,
                                raw_material_id: it.raw_material_id ?? undefined,
                                pack_material_id: it.pack_material_id ?? undefined,
                              };
                              setEditDraftPOForm((f) => ({
                                ...f,
                                lineItems: [...f.lineItems, recalcDraftPoLineItem(base, { qty: '1', pricePerUnit: price })],
                              }));
                              setAddDraftPoItemSearch('');
                              addToast('info', `${it.name} added to this PO — set qty/price, then Save.`);
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-surface-3 border-b border-hairline last:border-0"
                          >
                            <p className="text-xs font-medium text-ink leading-snug break-words">{it.name}</p>
                            <p className="text-[10px] text-ink-3 mt-0.5">
                              <span className="font-mono">{it.code}</span>
                              <span className="text-ink-4 uppercase ml-2">{it.type}</span>
                            </p>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditDraftPOTarget(null)}
                className="px-4 py-2 rounded-lg border border-border text-ink-2 text-sm font-semibold hover:bg-surface-3"
              >
                Cancel
              </button>
              <button
                disabled={editDraftPOSaving}
                onClick={async () => {
                  if (editDraftPOSaving) return;
                  if (!editDraftPOTarget) return;
                  setEditDraftPOSaving(true);
                  try {
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
                    // Mark items as partial_release_remainder so backend skips MOQ validation —
                    // qty is already committed on the PO side.
                    const itemsForPrSync = updatedItems.map((it) => ({ ...it, partial_release_remainder: true }));
                    const prUpd = await updateProcurementRequestApi(backendRequestId, { items: itemsForPrSync });
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

                  const savedSubtotal = form.lineItems.reduce((s, l) => s + (l.lineTotal - (l.gstAmount ?? 0)), 0);
                  const savedGstTotal = form.lineItems.reduce((s, l) => s + (l.gstAmount ?? 0), 0);
                  const savedGrandTotal = form.lineItems.reduce((s, l) => s + l.lineTotal, 0);
                  const savedFields = {
                    vendor: form.vendor,
                    paymentTerms: form.paymentTerms,
                    expectedDelivery: form.expectedDelivery,
                    deliveryAddress: form.deliveryAddress,
                    lineItems: form.lineItems,
                    subtotal: savedSubtotal,
                    gstTotal: savedGstTotal,
                    grandTotal: savedGrandTotal,
                  };
                  setDraftPOs((prev) =>
                    prev.map((po) => (po.id === d.id ? { ...po, ...savedFields } : po))
                  );
                  // The read-only detail popup (selectedDraftPO) holds its own snapshot taken when it
                  // was opened — Edit opens on top of it without closing it, so without this it kept
                  // showing pre-edit qty/GST/totals after Save even though the edit itself succeeded.
                  if (selectedDraftPO?.id === d.id) {
                    setSelectedDraftPO((prev) => (prev ? { ...prev, ...savedFields } : prev));
                  }
                  void invalidatePurchaseOrdersQueries();
                  setEditDraftPOTarget(null);
                  addToast('success', `Draft PO ${d.dpoNumber} updated`);
                  } finally {
                    setEditDraftPOSaving(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-press disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editDraftPOSaving ? 'Saving…' : 'Save'}
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
            ? 'bg-ok-soft text-ok border-[color:var(--st-green-fg)]/30'
            : effectiveStatus === 'In Progress'
              ? 'bg-brand-soft text-brand border-brand-soft'
              : 'bg-warn-soft text-warn border-[color:var(--st-amber-fg)]/30';

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
              className="relative w-full max-w-xl max-h-[90vh] bg-surface rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 border-b border-border px-5 py-4 bg-surface-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-border bg-surface font-mono text-[11px] text-ink-2">
                      {scId}
                    </span>
                    <h2 className="text-sm font-semibold text-ink">
                      Stock Check {selectedStockCheckItemName ? `· ${selectedStockCheckItemName}` : ''}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedStockCheckRequest(null);
                        setSelectedStockCheckItemName(null);
                      }}
                      className="text-ink-4 hover:text-ink-2 text-xl leading-none transition-colors"
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-surface-3">
                <div className="rounded-lg border border-border bg-surface p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-3">Assigned To</span>
                    <span className="text-ink font-semibold">{assignedTo}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-3">Created</span>
                    <span className="text-ink font-semibold">{createdDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-3">Due Date</span>
                    <span className="text-ink font-semibold">{dueDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-3">Status</span>
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${statusPillClass}`}>
                      {effectiveStatus}
                    </span>
                  </div>
                </div>

                <>
                  {renderedItems.map((item, idx) => (
                      <div
                        key={`${item.itemCode}-${idx}`}
                        className="rounded-lg border border-border bg-surface overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-border bg-surface-3">
                          <div className="flex items-center gap-2">
                            <p className="text-ink font-semibold text-sm">{item.itemName}</p>
                            <span className="text-[10px] text-ink-3 font-mono">{item.itemCode}</span>
                            {!item.fromWarehouse && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-warn-soft text-warn">No warehouse match</span>
                            )}
                          </div>
                        </div>
                        <div className="px-4 py-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-ink-3">Zone / Rack</span>
                            <span className="text-ink font-semibold">{item.zoneRack}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-ink-3">Requested Qty</span>
                            <span className="text-ink font-semibold">{item.requestedQty ?? '—'} {item.whUnit || ''}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-ink-3">Stock in hand (from DB)</span>
                            <span className="text-ok font-bold">
                              {item.systemQty != null ? `${item.systemQty} ${item.whUnit || ''}` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-ink-3">Physical Qty (count)</span>
                            <span className="text-brand font-bold">
                              {item.physicalQty != null ? `${item.physicalQty} ${item.whUnit || ''}` : '—'}
                            </span>
                          </div>
                          {item.batchCode && (
                            <div className="pt-2 border-t border-border mt-2">
                              <p className="text-[10px] tracking-wide text-ink-3 uppercase mb-1">Batch</p>
                              <span className="text-xs font-mono text-ink-2">{item.batchCode}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                  <div className="rounded-lg border border-[color:var(--st-green-fg)]/30 bg-ok-soft px-3 py-2 text-xs text-ok">
                    Request-scoped view: stock/check values are shown for this PR request only.
                    {notesOutcome == null ? ' Waiting for warehouse completion.' : ` Outcome: ${notesOutcome === 'all_ok' ? 'All OK' : 'Not OK'}.`}
                  </div>
                </>
              </div>

              <div className="shrink-0 bg-surface border-t border-border px-4 py-3 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedStockCheckRequest(null);
                    setSelectedStockCheckItemName(null);
                  }}
                  className="px-4 py-1.5 rounded-lg border border-border text-ink-2 text-xs font-semibold bg-surface hover:bg-surface-3 transition"
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
        <div className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6" onClick={closeRecordQuoteModal}>
          <div className="my-auto flex w-full max-w-5xl max-h-[calc(100dvh-2rem)] flex-col rounded-2xl bg-surface shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-hairline px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {recordQuoteForm.planningQuotationAskId
                    ? 'Record quote for Planning ask'
                    : recordQuoteForm.procurementRequestId
                      ? 'Add quotation for request'
                      : 'Record Vendor Quotation'}
                </h2>
                <p className="text-xs text-ink-3 mt-1">
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
                className="rounded-full border border-border px-2 py-1 text-xs text-ink-3 hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {(rawMaterialsListForQuoteError || packMaterialsListForQuoteError) && (
              <div className="rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-warn-soft px-3 py-2 text-xs text-warn">
                <p className="font-semibold">Could not load RM/PM master lists</p>
                <p className="mt-1 text-warn">
                  Your role must allow reading Raw Materials and Pack Materials (or Sales / Purchase / Order Management). Ask an admin to add the right module to your role, then reopen this modal.
                </p>
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-2 flex items-center justify-between">
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
                  className="px-2 py-1 rounded bg-surface-3 text-ink-2 text-xs font-medium hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface-3"
                >
                  + Add line
                </button>
              </h3>
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-surface-3 px-4 py-2 flex text-[11px] font-semibold text-ink-3">
                  <div className="flex-1 min-w-[200px]">ITEM (RM/PM from masters)</div>
                  <div className="w-24 text-right">MOQ</div>
                  <div className="w-28 text-right">PRICE / UNIT</div>
                  <div className="w-16" />
                </div>
                <div className="max-h-[min(20rem,42vh)] overflow-auto divide-y divide-hairline">
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
                            className="w-full border border-border rounded px-2 py-1.5 text-sm text-ink bg-surface disabled:bg-surface-3 disabled:text-ink-3"
                          />
                          <datalist id={`quote-line-item-options-${line.index}`}>
                            {datalistOptions.map((opt) => (
                              <option key={opt.key} value={opt.label} />
                            ))}
                          </datalist>
                          {line.name && (
                            <p className="text-[10px] text-ink-3 mt-0.5 truncate">
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
                            className="w-full border border-border rounded px-1 py-0.5 text-right disabled:bg-surface-3"
                          />
                        </div>
                        <div className="w-28 text-right pl-1">
                          <input
                            type="text"
                            value={line.pricePerUnit}
                            onChange={handleRecordQuoteLineChange(idx, 'pricePerUnit')}
                            disabled={recordQuoteSaving}
                            className="w-full border border-border rounded px-1 py-0.5 text-right disabled:bg-surface-3"
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
                            className="text-ink-4 hover:text-err text-sm disabled:opacity-40 disabled:pointer-events-none"
                            title="Remove line"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {recordQuoteLines.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-ink-3">
                      Click &quot;+ Add line&quot; then select an item from Raw materials or Pack materials.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-sm">
              <label className="block text-xs font-semibold text-ink-3 mb-1">Vendor</label>
              <select
                value={recordQuoteForm.vendorId}
                onChange={(e) => {
                  setRecordQuoteForm((f) => ({ ...f, vendorId: e.target.value }));
                }}
                disabled={recordQuoteSaving}
                className="w-full max-w-md border border-border rounded-lg px-2 py-1.5 text-sm disabled:bg-surface-3"
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-ink-3 mt-1">Enter item names and prices from the vendor’s quote.</p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">Quote Date</label>
                <input
                  type="date"
                  value={recordQuoteForm.quoteDate}
                  onChange={(e) => setRecordQuoteForm((f) => ({ ...f, quoteDate: e.target.value }))}
                  disabled={recordQuoteSaving}
                  className="w-full border border-border rounded-lg px-2 py-1.5 text-sm disabled:bg-surface-3"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">Valid Till</label>
                <input
                  type="date"
                  value={recordQuoteForm.validTill}
                  onChange={(e) => setRecordQuoteForm((f) => ({ ...f, validTill: e.target.value }))}
                  disabled={recordQuoteSaving}
                  className="w-full border border-border rounded-lg px-2 py-1.5 text-sm disabled:bg-surface-3"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">Lead Time (days)</label>
                <input
                  type="number"
                  min={0}
                  value={recordQuoteForm.leadTimeDays}
                  onChange={(e) => setRecordQuoteForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
                  disabled={recordQuoteSaving}
                  className="w-full border border-border rounded-lg px-2 py-1.5 text-sm disabled:bg-surface-3"
                />
              </div>
            </div>

            <div className="text-sm">
              <label className="block text-xs font-semibold text-ink-3 mb-1">Payment terms (from vendor master)</label>
              <p className="text-[11px] text-ink-3 mb-2">
                The three-way split (advance, before dispatch / pre-shipment, after delivery / post-shipment) comes from the vendor record. Update it in Masters → Vendors if needed.
              </p>
              <PaymentTermsDisplay
                value={vendors.find((x) => String(x.id) === String(recordQuoteForm.vendorId))?.paymentTerms ?? ''}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-3 mb-1">Internal Notes</label>
              <textarea
                value={recordQuoteForm.notes}
                onChange={(e) => setRecordQuoteForm((f) => ({ ...f, notes: e.target.value }))}
                disabled={recordQuoteSaving}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-sm disabled:bg-surface-3"
                rows={2}
              />
            </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-6 py-4">
              <p className="text-[11px] text-ink-3">
                New quotes are saved with default status for internal tracking.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={recordQuoteSaving}
                  onClick={closeRecordQuoteModal}
                  className="px-4 py-2 rounded-lg border border-border text-sm text-ink-2 bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-warn text-white text-sm font-semibold hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-95"
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
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40" onClick={() => setShowCreatePoFromQuoteModal(false)}>
          <div className="w-full max-w-3xl rounded-2xl bg-surface shadow-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
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
                      <h2 className="text-lg font-semibold text-ink">Create Draft PO from Quote</h2>
                      <p className="text-xs text-ink-3 mt-1">
                        Pick the procurement request item this quotation is for. One draft PO will be created per
                        item/vendor.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreatePoFromQuoteModal(false)}
                      className="rounded-full border border-border px-2 py-1 text-xs text-ink-3 hover:bg-surface-3"
                    >
                      Close
                    </button>
                  </div>

                  {!selectedQuote ? (
                    <p className="text-sm text-err">
                      Unable to load quote. Please refresh the page and try again.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <label className="block text-xs font-semibold text-ink-3 mb-1">
                            Procurement Request (link PO to)
                          </label>
                          <select
                            value={createPoFromQuoteState.requestId}
                            onChange={(e) =>
                              setCreatePoFromQuoteState((prev) =>
                                prev ? { ...prev, requestId: e.target.value, itemKey: undefined } : prev
                              )
                            }
                            className="w-full border border-border rounded-lg px-2 py-1.5 text-sm"
                          >
                            {requests.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.code} · {r.items?.slice(0, 2).join(', ')}{r.items?.length > 2 ? '…' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-ink-3 mb-1">Vendor</label>
                          <p className="text-sm font-medium text-ink">
                            {selectedQuote.vendor} <span className="text-xs text-ink-3">(from quotation)</span>
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-ink-3 mb-1">Item</label>
                        <select
                          value={createPoFromQuoteState.itemKey ?? (selectedItem?.code ?? selectedItem?.name ?? '')}
                          onChange={(e) =>
                            setCreatePoFromQuoteState((prev) =>
                              prev ? { ...prev, itemKey: e.target.value } : prev
                            )
                          }
                          className="w-full border border-border rounded-lg px-2 py-1.5 text-sm"
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
                          <p className="mt-1 text-[11px] text-err">
                            No items on this request match the lines in this quotation.
                          </p>
                        )}
                      </div>

                      {selectedItem && selectedLine && (
                        <div className="mt-2 border border-border rounded-xl p-4 text-sm bg-surface-3">
                          <p className="text-xs font-semibold text-ink-3 mb-2">Calculation</p>
                          <p className="text-sm text-ink">
                            <span className="font-medium">
                              {selectedItem.name ?? selectedItem.code ?? 'Item'}
                            </span>{' '}
                            — Required Qty from PR:{' '}
                            <span className="font-mono font-semibold">
                              {qtyNeeded} {unit}
                            </span>
                          </p>
                          <p className="text-sm text-ink">
                            Vendor price from quotation:{' '}
                            <span className="font-mono font-semibold">
                              ₹{pricePerUnit.toLocaleString('en-IN', { maximumFractionDigits: 2 })} / {unit}
                            </span>
                          </p>
                          <p className="mt-2 text-sm text-ink">
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
                        <p className="text-[11px] text-ink-3">
                          One Draft PO will be created for this item and vendor. You can edit or split it later from the
                          Draft POs tab.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowCreatePoFromQuoteModal(false)}
                            className="px-4 py-2 rounded-lg border border-border text-sm text-ink-2 bg-surface"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={approveCreateDraftPOBusy || !matchingItems.length || !selectedItem || !selectedLine}
                            onClick={async () => {
                              if (approveCreateDraftPOBusy) return;
                              if (!selectedQuote || !backendPr || !selectedItem || !selectedLine) return;
                              setApproveCreateDraftPOBusy(true);
                              try {

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
                              } finally {
                                setApproveCreateDraftPOBusy(false);
                              }
                            }}
                            className="px-4 py-2 rounded-lg bg-warn text-white text-sm font-semibold hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {approveCreateDraftPOBusy ? 'Creating…' : 'Approve & Create Draft PO'}
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


