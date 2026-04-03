import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation, NavLink, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ChevronDown, Search, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import type { SoPlanningAvailabilityItem, SoPlanningAvailabilityResponse } from '../services/fulfillment.service';
import { fetchSoPlanningAvailability } from '../services/fulfillment.service';
import {
  fetchPlanningExtractedList,
  fetchPlanningExtractedById,
  updatePlanningExtracted,
  fetchBomOverride,
  putBomOverride,
  createOrUpdatePlanningBatches,
  fetchPlanningBatches,
  fetchBatchById,
  addOneBatchFromMaster,
  updateBatch as updatePlanningBatch,
  fetchAllBatches,
  fetchItemsInvolved,
  type PlanningExtractedRow,
  type PlanningBatchRow,
  type PlanningBatchAllRow,
} from '../services/planningExtracted.service';
import {
  createProcurementRequest,
  fetchProcurementRequests,
  updateProcurementRequest,
  type ProcurementRequestItem,
} from '../services/procurement.service';
import { fetchPriceListPage, type PriceListItemPage } from '../services/itemsList.service';
import {
  fetchBOMByProductId,
  type BOMRecord,
  type BOMRmLine,
  type BOMPmLine,
} from '../services/bom.service';
import { fetchBatches, type BatchRow } from '../services/production.service';
import { fetchRawMaterialsList } from '../services/rawMaterials.service';
import { fetchPackMaterialsList } from '../services/packMaterials.service';
import { fetchPRProducts } from '../services/productsMaster.service';
import { fetchItemGroups } from '../services/itemGroups.service';
import { fetchWarehouseInventory } from '../services/warehouseInventory.service';

/** Merge a newly created batch into the planning-batches list cache so selection is not reset before refetch (fixes dropdown + batch label). */
function mergePlanningBatchIntoListCache(
  queryClient: QueryClient,
  planningExtractedId: string,
  newBatch: PlanningBatchRow
): void {
  const nid = Number(newBatch.id);
  if (Number.isNaN(nid)) return;
  const normalized: PlanningBatchRow = {
    ...newBatch,
    id: nid,
    sequence: Number(newBatch.sequence) || 0,
  };
  queryClient.setQueryData<PlanningBatchRow[]>(['planning-batches', planningExtractedId], (old) => {
    const prev = Array.isArray(old) ? old : [];
    const without = prev.filter((b) => Number(b.id) !== nid);
    return [...without, normalized].sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));
  });
  queryClient.setQueryData<PlanningBatchRow>(['planning-batch', planningExtractedId, nid], normalized);
}
import { fetchPurchaseOrders } from '../services/salesPurchase.service';
import {
  PAYMENT_TERMS_TYPE_OPTIONS,
  formatPaymentTermsString,
  parsePaymentTermsString,
  paymentTermsTypeRequiresAdvancePercent,
  validateAdvancePercentForType,
  type PaymentTermsStructuredType,
} from '../lib/paymentTermsStructured';
import {
  formatStagedPaymentTermsObject,
  formatStagedPaymentTermsSummary,
  resolveStagedPaymentTermsForForm,
} from '../lib/stagedPaymentTerms';

interface RawMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  percentage: number;
  code?: string;
  phase?: string;
  raw_material_id?: number;
  /** Specific gravity (vs water) for vessel volume: volume_L = quantity_kg / specificGravity. Default 1. */
  specificGravity?: number;
}

interface PackagingMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  value: number;
  percentage: number;
  code?: string;
  pack_material_id?: number;
}

interface ItemsInvolvedDisplayRow {
  id: string;
  name: string;
  code: string;
  category: string;
  usedIn: string;
  usedInProducts?: string[];
  totalReq: string;
  totalRequired: number;
  /** Number of production batches (released) that use this item. */
  batchCount: number;
  sih: string;
  sihNum: number;
  surplusShortage: string;
  surplusShortageNum: number;
  coverage: string;
  whBatches: string;
  warehouseInventoryId: number | null;
  expiry: string;
  bomFlag: string;
  itemType: 'RM' | 'PM';
  planningExtractedIds: number[];
  planningExtractedId: number | null;
  raw_material_id?: number;
  pack_material_id?: number;
  unit: string;
  /** Warehouse-style columns (from warehouse_inventory) */
  reserved: string;
  reservedNum: number;
  plannedQty: string;
  plannedQtyNum: number;
  orderedQty: string;
  orderedQtyNum: number;
  net: string;
  netNum: number;
  inTransit: string;
  reorderPt: string;
  avgMo: string;
  status: string;
}

type PlannedLine = {
  createdAt: string;
  planningExtractedId: number | null;
  itemType: 'RM' | 'PM';
  itemId: number | null;
  itemCode: string;
  itemName: string;
  vendorId: number | null;
  vendorName: string;
  moq: number;
  qty: number;
  unitPrice: number;
  paymentTerms: string;
  leadTimeDays: number;
  unit: string;
  /** Backend purchase_orders.id (numeric string) when synced to Draft PO */
  backendPoId?: string;
};

function buildPlannedGroupKey(vendorName: string, paymentTerms: string, leadTimeDays: number) {
  return `${vendorName.trim().toLowerCase()}|||${paymentTerms.trim()}|||${Number(leadTimeDays) || 0}`;
}

/** Match stored planned line to Items Involved row — avoid empty-string / missing-id false positives. */
function plannedLineMatchesItemsInvolvedRow(line: PlannedLine, item: ItemsInvolvedDisplayRow): boolean {
  if (line.itemType !== item.itemType) return false;
  const matId = item.itemType === 'RM' ? Number(item.raw_material_id) : Number(item.pack_material_id);
  const lineMatId = line.itemId != null ? Number(line.itemId) : NaN;
  if (Number.isFinite(matId) && matId > 0) {
    return Number.isFinite(lineMatId) && lineMatId === matId;
  }
  const codeItem = normalizeMaterialCode(String(item.code ?? '').trim().toLowerCase());
  const codeLine = normalizeMaterialCode(String(line.itemCode ?? '').trim().toLowerCase());
  if (codeItem.length > 0 && codeLine.length > 0 && codeItem === codeLine) return true;
  const nameItem = String(item.name ?? '').trim().toLowerCase();
  const nameLine = String(line.itemName ?? '').trim().toLowerCase();
  return nameItem.length > 0 && nameLine.length > 0 && nameItem === nameLine;
}

function normalizeMaterialCode(code: string): string {
  const c = (code ?? '').toString().trim().toLowerCase();
  if (!c) return '';
  // Examples: "EI-RM-UVF-001" -> "UVF-001"
  return c
    .replace(/^ei[-_]?rm[-_]?/i, '')
    .replace(/^ei[-_]?pm[-_]?/i, '')
    .replace(/^rm[-_]?/i, '')
    .replace(/^pm[-_]?/i, '');
}

function procurementItemMergeKey(item: ProcurementRequestItem): string {
  if (item.type === 'RM' && item.raw_material_id != null && Number(item.raw_material_id) > 0) {
    return `rm:${Number(item.raw_material_id)}`;
  }
  if (item.type === 'PM' && item.pack_material_id != null && Number(item.pack_material_id) > 0) {
    return `pm:${Number(item.pack_material_id)}`;
  }
  return `${item.type}:${String(item.code || item.name || '').trim().toLowerCase()}`;
}

/** Tab stats — all possible keys so we can access without `any` */
type PlanningTabStats = {
  totalSOs?: number;
  prodReleased?: number;
  shortages?: number;
  batchesRequired?: number;
  batchesConfirmed?: number;
  soValue?: string;
  confirmedProducts?: { value: number; total: number };
  rmItems?: { value: number; ok: number; short: number };
  pmItems?: { value: number; ok: number; short: number };
  rmShortages?: number;
  pmShortages?: number;
  prsRaised?: number;
};

interface SalesOrder {
  id: string;
  soNumber: string;
  productName: string;
  productCode: string;
  customerName?: string;
  soStatus?: string;
  orderQty: string;
  totalKg: string;
  orderDate: string;
  dueDate: string;
  daysLeft: string;
  batchSize: string;
  batchesRequired: number;
  bomStatus: 'Production Released' | 'Production Ready' | 'In Progress' | 'Planned';
  approvedBy: string;
  rawMaterials: RawMaterial[];
  packagingMaterials: PackagingMaterial[];
  color?: string;
  productId?: number;
  /** Indices of batches already sent to production (history); gray out in Plan Batches */
  sentBatchIndices?: number[];
  batchCount?: number | null;
  customBatches?: { sizeKg: number }[] | null;
}

/** PIs Extracted: row background tier from RM/PM startable batch counts vs total batches. */
type PisAvailabilityTier = 'loading' | 'unknown' | 'full' | 'partial' | 'none';

function getPisAvailabilityTier(
  item: SoPlanningAvailabilityItem | null | undefined,
  loading: boolean
): PisAvailabilityTier {
  if (loading && !item) return 'loading';
  if (!item) return 'unknown';
  const tb = Number(item.totalBatches) || 0;
  if (tb <= 0) return 'unknown';
  const rm = Number(item.rmStartableCount) || 0;
  const pm = Number(item.pmStartableCount) || 0;
  if (rm >= tb && pm >= tb) return 'full';
  if (rm === 0 && pm === 0) return 'none';
  return 'partial';
}

function pisAvailabilityRowClass(tier: PisAvailabilityTier): string {
  const base =
    'border-b border-gray-100/80 cursor-pointer transition-all duration-200 ease-out';
  switch (tier) {
    case 'loading':
      return `${base} bg-slate-50/95 border-l-[3px] border-l-slate-400 hover:bg-slate-100/95 hover:shadow-md`;
    case 'unknown':
      return `${base} bg-gray-50/95 border-l-[3px] border-l-gray-400 hover:bg-gray-100/95 hover:shadow-md`;
    case 'full':
      return `${base} bg-emerald-50/95 border-l-[4px] border-l-emerald-500 hover:bg-emerald-100/90 hover:shadow-[0_2px_12px_-2px_rgba(16,185,129,0.35)]`;
    case 'partial':
      return `${base} bg-amber-50/95 border-l-[4px] border-l-amber-500 hover:bg-amber-100/90 hover:shadow-[0_2px_12px_-2px_rgba(245,158,11,0.4)]`;
    case 'none':
      return `${base} bg-rose-50/95 border-l-[4px] border-l-rose-500 hover:bg-rose-100/90 hover:shadow-[0_2px_12px_-2px_rgba(244,63,94,0.38)]`;
    default:
      return `${base} hover:bg-gray-50`;
  }
}

/** Map API row to SalesOrder shape for Plan Batches / Raise PR modals */
function apiRowToSalesOrder(row: PlanningExtractedRow): SalesOrder {
  return {
    id: row.id,
    soNumber: row.soNumber,
    productName: row.productName,
    productCode: row.productCode,
    customerName: row.customerName ?? undefined,
    soStatus: row.soStatus ?? undefined,
    orderQty: row.orderQty,
    totalKg: row.totalKg,
    orderDate: row.orderDate,
    dueDate: row.dueDate,
    daysLeft: row.daysLeft,
    batchSize: row.batchSize,
    batchesRequired: row.batchesRequired,
    bomStatus: (row.bomStatus as SalesOrder['bomStatus']) || 'Planned',
    approvedBy: row.approvedBy,
    rawMaterials: (row.rawMaterials ?? []).map((rm, i) => ({ ...rm, id: rm.id ?? String((rm as { raw_material_id?: number }).raw_material_id ?? i) } as RawMaterial)),
    packagingMaterials: (row.packagingMaterials ?? []).map((pm, i) => ({ ...pm, id: pm.id ?? String((pm as { pack_material_id?: number }).pack_material_id ?? i) } as PackagingMaterial)),
    color: row.color,
    productId: row.product_id,
    sentBatchIndices: Array.isArray(row.sentBatchIndices) ? row.sentBatchIndices : [],
    batchCount: row.batchCount ?? null,
    customBatches: Array.isArray(row.customBatches) ? row.customBatches : null,
  };
}

/** Batch BOM line shapes from API */
interface BatchRmLine { inci_name?: string; rm_code?: string; pct_w_w?: number; uom?: string; phase?: string; raw_material_id?: number }
interface BatchPmLine { description?: string; pm_code?: string; qty_per_unit?: number; uom?: string }

/** Row shape for Raise PR from batch detail (single item + shortfall). */
interface BatchDetailRowForPr {
  id: string;
  type: 'RM' | 'PM';
  name: string;
  code: string;
  required: number;
  unit: string;
  sih: number;
  shortfall: number;
  raw_material_id?: number;
  pack_material_id?: number;
}

/** One row on /planning/batches: batch code is read-only; edit size (kg); click elsewhere opens detail. */
function PlanningBatchTableRow({
  row,
  onOpenDetail,
}: {
  row: PlanningBatchAllRow;
  onOpenDetail: (row: PlanningBatchAllRow) => void;
}) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [sizeKgStr, setSizeKgStr] = useState(row.sizeKg != null ? String(row.sizeKg) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSizeKgStr(row.sizeKg != null ? String(row.sizeKg) : '');
  }, [row.id, row.batchCode, row.sizeKg]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const sizeNum = parseFloat(String(sizeKgStr).replace(/,/g, '').trim());
    if (!Number.isFinite(sizeNum) || sizeNum < 0) {
      addToast('error', 'Enter a valid size (kg)');
      return;
    }
    setSaving(true);
    try {
      const updated = await updatePlanningBatch(String(row.planningExtractedId), row.id, {
        sizeKg: sizeNum,
      });
      if (updated) {
        addToast('success', 'Batch saved');
        await queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });
      } else {
        addToast('error', 'Could not save batch');
      }
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not save batch');
    } finally {
      setSaving(false);
    }
  };

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('input,button,textarea,select')) return;
    onOpenDetail(row);
  };

  return (
    <tr
      onClick={handleRowClick}
      className="border-b border-gray-100 hover:bg-emerald-50/80 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 text-gray-700 font-mono text-sm">
        {row.batchCode?.trim() ? row.batchCode : '—'}
      </td>
      <td className="px-4 py-3 text-gray-700">{row.soNumber ?? '—'}</td>
      <td className="px-4 py-3 text-gray-700">{row.customerName ?? '—'}</td>
      <td className="px-4 py-3 text-gray-700">{row.productName ?? row.productCode ?? '—'}</td>
      <td className="px-4 py-2 align-middle text-right" onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          min={0}
          step="0.01"
          value={sizeKgStr}
          onChange={(e) => setSizeKgStr(e.target.value)}
          className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm font-mono text-right text-gray-900"
          aria-label="Size kg"
        />
      </td>
      <td className="px-4 py-3 text-gray-600">{row.dueDate ?? '—'}</td>
      <td className="px-4 py-3 text-center">
        {row.sent ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-gray-400">No</span>}
      </td>
      <td className="px-4 py-2 align-middle whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </td>
    </tr>
  );
}

/** Batches tab: list all planning batches. Row click → batch detail popup (items, stock, PR per shortfall). */
function PlanningBatchesTab({ onBatchClick }: { onBatchClick: (row: PlanningBatchAllRow) => void }) {
  const { data: allBatches = [], isLoading } = useQuery({
    queryKey: ['planning-batches-all'],
    queryFn: fetchAllBatches,
    enabled: true,
  });
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  // Only show batches that have been sent to production (Batches tab = sent batches only)
  const rows = (allBatches as PlanningBatchAllRow[]).filter((row) => row.sent === true);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Batches sent to production. Edit batch code and size (kg), then Save. Click a row (outside fields) to view items, stock, and raise PR for shortfalls.
      </p>
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Batch code</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">SO</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Product</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Size (kg)</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Due</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Sent</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 w-[1%]"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <PlanningBatchTableRow key={`${row.planningExtractedId}-${row.id}`} row={row} onOpenDetail={onBatchClick} />
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            {allBatches.length === 0
              ? 'No batches yet. Create batches from Plan Batches (PIs Extracted) per SO line.'
              : 'No batches sent to production yet. In Plan Batches, select a batch and click “Send to Production” to see it here.'}
          </div>
        )}
      </div>
    </div>
  );
}

const Planning = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRowForDetail, setSelectedRowForDetail] = useState<SalesOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);
  const [prSending, setPrSending] = useState(false);
  const [prPriority, setPrPriority] = useState('High');
  const [prRequiredByDate, setPrRequiredByDate] = useState('');
  const [prNotes, setPrNotes] = useState('');
  const [prShowPMOnly, setPrShowPMOnly] = useState(false);
  const [prItems, setPrItems] = useState<ProcurementRequestItem[]>([]);
  const [prOmittedCount, setPrOmittedCount] = useState(0);
  const [planBatchesModalOpen, setPlanBatchesModalOpen] = useState(false);
  const [swapSourceIndex, setSwapSourceIndex] = useState<number | null>(null);
  const [selectedSOForBatch, setSelectedSOForBatch] = useState<SalesOrder | null>(null);
  const [activeBatchTab, setActiveBatchTab] = useState<'batch-plan' | 'bom-editor' | 'swap-add'>('batch-plan');
  const [numBatches, setNumBatches] = useState('15');
  const [batchSizeKg, setBatchSizeKg] = useState('500');
  const [plannedStartDate, setPlannedStartDate] = useState('2026-03-04');
  const [productionLine, setProductionLine] = useState('Line 1 — Primary Mixer');
  const [bomFormula, setBomFormula] = useState<RawMaterial[]>([]);
  const [quickAddRmCode, setQuickAddRmCode] = useState('');
  const [quickAddInciName, setQuickAddInciName] = useState('');
  const [quickAddPercentage, setQuickAddPercentage] = useState('');
  const [bomPackaging, setBomPackaging] = useState<PackagingMaterial[]>([]);
  const [isReadyForProduction, setIsReadyForProduction] = useState(false);
  const [productionSentOrderIds, setProductionSentOrderIds] = useState<string[]>([]);
  const [customBatches, setCustomBatches] = useState<{ sizeKg: number }[]>([]);
  const [expandedBatchIndex, setExpandedBatchIndex] = useState<number | null>(null);
  /** Selected batch id (planning_batches.id) — drives BOM editor, swap/add, batch plan for this batch only */
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  /** Preview qty (units) on Batch Plan tab — drives req/max units and summary bar */
  const [feasibilityPreviewQty, setFeasibilityPreviewQty] = useState<number>(0);
  const location = useLocation();
  const pathTab = location.pathname.split('/planning/')[1]?.split('/')[0] || '';
  const activeMainTab: 'pis-extracted' | 'items-involved' | 'batches' =
    pathTab === 'items-involved' ? 'items-involved' : pathTab === 'batches' ? 'batches' : 'pis-extracted';
  const [itemsInvolvedCategoryFilter, setItemsInvolvedCategoryFilter] = useState<'all' | 'RM' | 'PM' | 'shortage' | 'available'>('all');
  const [itemsInvolvedProductFilter, setItemsInvolvedProductFilter] = useState<string>('all');
  const [itemsInvolvedSearchTerm, setItemsInvolvedSearchTerm] = useState('');
  const [usedInModalItem, setUsedInModalItem] = useState<ItemsInvolvedDisplayRow | null>(null);
  const [releaseToPlanningItem, setReleaseToPlanningItem] = useState<ItemsInvolvedDisplayRow | null>(null);
  const [releaseToPlanningForm, setReleaseToPlanningForm] = useState<{
    vendorId: number | null;
    vendorName: string;
    moq: number;
    qty: string;
    unitPrice: string;
    paymentTermsType: PaymentTermsStructuredType;
    advancePercent: string;
    leadTimeDays: number;
    /** Items List `payment_terms` JSON string when picked from a rate; cleared when user edits type/advance manually. */
    paymentTermsRaw: string | null;
  }>({
    vendorId: null,
    vendorName: '',
    moq: 0,
    qty: '',
    unitPrice: '',
    paymentTermsType: 'as_per_contract',
    advancePercent: '50',
    leadTimeDays: 0,
    paymentTermsRaw: null,
  });
  const [releaseToPlanningSaving, setReleaseToPlanningSaving] = useState(false);
  const [batchForDetailModal, setBatchForDetailModal] = useState<PlanningBatchAllRow | null>(null);
  /** Raise PR confirmation popup from batch detail: { batch, row } so user can confirm and edit before sending. */
  const [batchPrModal, setBatchPrModal] = useState<{ batch: PlanningBatchAllRow; row: BatchDetailRowForPr } | null>(null);
  const [batchPrQty, setBatchPrQty] = useState(0);
  const [batchPrPriority, setBatchPrPriority] = useState('High');
  const [batchPrRequiredBy, setBatchPrRequiredBy] = useState('');
  const [batchPrNotes, setBatchPrNotes] = useState('');
  const [batchPrSending, setBatchPrSending] = useState(false);
  const canSendToProduction =
    isReadyForProduction || selectedSOForBatch?.bomStatus === 'Production Ready';

  // Planning list: used for PIs Extracted tab and tab stats
  const { data: planningExtractedList = [], isLoading: planningLoading } = useQuery({
    queryKey: ['planning-extracted'],
    queryFn: fetchPlanningExtractedList,
    enabled: true,
  });

  // Used by Items Involved tab for "Planned line" badge + "Previous purchases" modal.
  // Intentionally backend-driven (no localStorage cache) for production reliability.
  const { data: purchaseOrders = [], isLoading: purchaseOrdersLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const res = await fetchPurchaseOrders();
      return res.success ? (res.data ?? []) : [];
    },
    enabled: activeMainTab === 'items-involved',
  });

  // Used for MFG Records column in "PIs Extracted" list.
  const { data: productionBatches = [] } = useQuery({
    queryKey: ['production-batches'],
    queryFn: fetchBatches,
    enabled: activeMainTab === 'pis-extracted',
  });
  const pisRows: SalesOrder[] = useMemo(
    () => planningExtractedList.map(apiRowToSalesOrder),
    [planningExtractedList]
  );

  // Fulfillment "Availability" parity: per SO, fetch planning availability (RM/PM startable batches) and show it in PIs Extracted rows.
  const normalizeSoKey = (value: string) => String(value || '').trim().toUpperCase();
  const [planningAvailabilityBySoNo, setPlanningAvailabilityBySoNo] = useState<Record<string, SoPlanningAvailabilityResponse>>({});
  const [planningAvailabilityLoading, setPlanningAvailabilityLoading] = useState(false);
  const planningAvailabilityRequestInFlight = useRef(false);

  const productIdForBom = selectedSOForBatch?.productId ?? 0;
  const { data: bomByProduct } = useQuery({
    queryKey: ['bom-by-product', productIdForBom],
    queryFn: async () => {
      const r = await fetchBOMByProductId(productIdForBom);
      return r.data ?? null;
    },
    enabled: planBatchesModalOpen && productIdForBom > 0,
  });
  const activeBom: BOMRecord | null = bomByProduct ?? null;

  // BOM for detail popup: when FG row is clicked, load BOM to show RM/PM × order qty
  const productIdForDetail = selectedRowForDetail?.productId ?? 0;
  const { data: bomForDetail } = useQuery({
    queryKey: ['bom-by-product-detail', productIdForDetail],
    queryFn: async () => {
      const r = await fetchBOMByProductId(productIdForDetail);
      return r.data ?? null;
    },
    enabled: detailModalOpen && productIdForDetail > 0,
  });

  // Parse order qty from display string (e.g. "50,000 Units" or "50000") for total required calc
  const orderQtyNumForDetail = useMemo(() => {
    if (!selectedRowForDetail?.orderQty) return 0;
    const s = String(selectedRowForDetail.orderQty).replace(/,/g, '').trim();
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : n;
  }, [selectedRowForDetail?.orderQty]);
  const totalKgNumForDetail = useMemo(() => {
    if (!selectedRowForDetail?.totalKg) return 0;
    const n = parseFloat(String(selectedRowForDetail.totalKg).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [selectedRowForDetail?.totalKg]);
  const batchSizeKgForDetail = useMemo(() => {
    if (!selectedRowForDetail?.batchSize) return 0;
    const n = parseFloat(String(selectedRowForDetail.batchSize).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [selectedRowForDetail?.batchSize]);

  // RM/PM list for detail popup: BOM lines × order quantity (total required for this FG order)
  const { detailRmItems, detailPmItems } = useMemo(() => {
    const orderQty = orderQtyNumForDetail || 1;
    const bom = bomForDetail ?? null;
    if (!bom) {
      return {
        detailRmItems: [] as { id: string; name: string; quantity: number; unit: string }[],
        detailPmItems: [] as { id: string; name: string; quantity: number; unit: string }[],
      };
    }
    const rmLines = bom.rmLines ?? [];
    const pmLines = bom.pmLines ?? [];
    const rmItems = rmLines.map((line: BOMRmLine, i: number) => {
      const pct = Number(line.pct_w_w ?? (line as { pct?: number }).pct ?? 0) || 0;
      const absoluteQty = Number((line as { quantity?: number }).quantity ?? 0) || 0;
      const totalQty = pct > 0 && totalKgNumForDetail > 0
        ? (pct / 100) * totalKgNumForDetail
        : (absoluteQty > 0 && batchSizeKgForDetail > 0 && totalKgNumForDetail > 0
          ? absoluteQty * (totalKgNumForDetail / batchSizeKgForDetail)
          : absoluteQty * orderQty);
      return {
        id: String((line as { raw_material_id?: number }).raw_material_id ?? line.rm_code ?? i),
        name: (line as { inci_name?: string }).inci_name ?? (line as { name?: string }).name ?? String(line.rm_code ?? ''),
        quantity: totalQty,
        unit: line.uom ?? 'KG',
      };
    });
    const pmItems = pmLines.map((line: BOMPmLine, i: number) => {
      const qtyPerUnit = (line as { qty_per_unit?: number }).qty_per_unit ?? (line as { qty?: number }).qty ?? 1;
      const totalQty = qtyPerUnit * orderQty;
      return {
        id: String((line as { pack_material_id?: number }).pack_material_id ?? line.pm_code ?? i),
        name: line.description ?? (line as { name?: string }).name ?? String(line.pm_code ?? ''),
        quantity: totalQty,
        unit: line.uom ?? 'PCS',
      };
    });
    return { detailRmItems: rmItems, detailPmItems: pmItems };
  }, [bomForDetail, orderQtyNumForDetail, totalKgNumForDetail, batchSizeKgForDetail]);

  const { data: rawMaterialsData } = useQuery({
    queryKey: ['raw-materials-list'],
    queryFn: () => fetchRawMaterialsList(),
    enabled: planBatchesModalOpen || prModalOpen || detailModalOpen || batchForDetailModal != null,
  });
  const { data: packMaterialsData } = useQuery({
    queryKey: ['pack-materials-list'],
    queryFn: () => fetchPackMaterialsList(),
    enabled: planBatchesModalOpen || prModalOpen || detailModalOpen || batchForDetailModal != null,
  });
  const rawMaterialsList = useMemo(() => rawMaterialsData ?? [], [rawMaterialsData]);
  const packMaterialsList = useMemo(() => packMaterialsData ?? [], [packMaterialsData]);

  const { data: productsList = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const r = await fetchPRProducts();
      return r.success && r.data ? r.data : [];
    },
    enabled: prModalOpen,
  });

  const { data: itemGroupsRmResult } = useQuery({
    queryKey: ['item-groups-rm'],
    queryFn: () => fetchItemGroups('RM'),
    enabled: planBatchesModalOpen,
  });
  const itemGroupsRm = itemGroupsRmResult?.data ?? [];

  const { data: warehouseResult } = useQuery({
    queryKey: ['warehouse-inventory'],
    queryFn: async () => {
      const r = await fetchWarehouseInventory();
      return r.data ?? null;
    },
    enabled: planBatchesModalOpen || prModalOpen || detailModalOpen || batchForDetailModal != null,
  });
  const warehouseRows = useMemo(() => warehouseResult?.rows ?? [], [warehouseResult?.rows]);

  // Procurement requests: for tab stats (prsRaised)
  // Must return ProcurementRequest[] — same queryKey as Procurement page (shared cache).
  const { data: procurementRequests = [] } = useQuery({
    queryKey: ['procurement-requests'],
    queryFn: async () => {
      const res = await fetchProcurementRequests();
      return res.success ? (res.data ?? []) : [];
    },
    enabled: true,
  });

  const planningIdForBatch = selectedSOForBatch?.id ?? '';
  const { data: planningRowForBatch } = useQuery({
    queryKey: ['planning-extracted', planningIdForBatch],
    queryFn: () => fetchPlanningExtractedById(planningIdForBatch),
    enabled: planBatchesModalOpen && !!planningIdForBatch,
  });

  const { data: bomOverrideForPlanning } = useQuery({
    queryKey: ['planning-bom-override', planningIdForBatch],
    queryFn: () => fetchBomOverride(planningIdForBatch),
    enabled: planBatchesModalOpen && !!planningIdForBatch,
  });

  const { data: planningBatches = [] } = useQuery({
    queryKey: ['planning-batches', planningIdForBatch],
    queryFn: () => fetchPlanningBatches(planningIdForBatch),
    enabled: planBatchesModalOpen && !!planningIdForBatch,
  });

  /** Require the latest batch (max sequence) to be sent before adding another (matches backend). */
  const latestPlanningBatchIndex = useMemo(() => {
    if (planningBatches.length === 0) return -1;
    let bestIdx = 0;
    let bestSeq = Number((planningBatches[0] as PlanningBatchRow)?.sequence ?? 0) || 0;
    for (let i = 1; i < planningBatches.length; i += 1) {
      const seq = Number((planningBatches[i] as PlanningBatchRow)?.sequence ?? 0) || 0;
      if (seq >= bestSeq) {
        bestSeq = seq;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [planningBatches]);
  const canAddAnotherPlanningBatch =
    planningBatches.length === 0 ||
    (selectedSOForBatch?.sentBatchIndices ?? []).some((x) => Number(x) === latestPlanningBatchIndex);

  /** Selected batch detail — drives BOM (bomFormula/bomPackaging) for this batch */
  const { data: selectedBatchData } = useQuery({
    queryKey: ['planning-batch', planningIdForBatch, selectedBatchId],
    queryFn: () => fetchBatchById(planningIdForBatch, selectedBatchId!),
    enabled: planBatchesModalOpen && !!planningIdForBatch && !!selectedBatchId,
  });

  // Sync form fields (numBatches, batchSizeKg, etc.) from planning extracted row. Do NOT set customBatches
  // from batchCount here — the batch list must come from actual planning_batches (see effect below) so we
  // only show batches that exist (B1 only → B-01 only), not placeholders from "batches required".
  useEffect(() => {
    if (!planBatchesModalOpen || !selectedSOForBatch || !planningRowForBatch) return;
    const row = planningRowForBatch as { batchCount?: number; batchesRequired?: number; batchSizeKg?: number; plannedStartDate?: string; productionLine?: string; customBatches?: { sizeKg: number }[] | null };
    if (row.batchCount != null && row.batchCount > 0) setNumBatches(String(row.batchCount));
    else if (row.batchesRequired != null && row.batchesRequired > 0) setNumBatches(String(row.batchesRequired));
    if (row.batchSizeKg != null) setBatchSizeKg(String(row.batchSizeKg));
    if (row.plannedStartDate) setPlannedStartDate(row.plannedStartDate);
    if (row.productionLine) setProductionLine(row.productionLine);
    // Only restore customBatches from saved row when we have saved data; never create placeholders from batchCount
    if (Array.isArray(row.customBatches) && row.customBatches.length > 0) {
      setCustomBatches(row.customBatches);
    }
  }, [planBatchesModalOpen, selectedSOForBatch?.id, planningRowForBatch]);

  // Batch-first: ensure at least one batch and set selected batch; sync customBatches from planningBatches
  const addedOneBatchRef = useRef(false);
  useEffect(() => {
    if (!planBatchesModalOpen || !planningIdForBatch) return;
    if (planningBatches.length === 0 && !addedOneBatchRef.current) {
      addedOneBatchRef.current = true;
      addOneBatchFromMaster(planningIdForBatch)
        .then((newBatch) => {
          if (newBatch) {
            mergePlanningBatchIntoListCache(queryClient, planningIdForBatch, newBatch);
            queryClient.invalidateQueries({ queryKey: ['planning-batches', planningIdForBatch] });
            setSelectedBatchId(Number(newBatch.id));
          } else {
            addedOneBatchRef.current = false;
          }
        })
        .catch(() => {
          addedOneBatchRef.current = false;
        });
      return;
    }
    if (planningBatches.length > 0) {
      addedOneBatchRef.current = true;
      const first = planningBatches[0] as PlanningBatchRow;
      if (
        selectedBatchId === null ||
        !planningBatches.some((b: PlanningBatchRow) => Number(b.id) === Number(selectedBatchId))
      ) {
        setSelectedBatchId(Number(first.id));
      }
      setCustomBatches(planningBatches.map((b: PlanningBatchRow) => ({ sizeKg: b.sizeKg ?? 500 })));
    }
  }, [planBatchesModalOpen, planningIdForBatch, planningBatches, selectedBatchId]);

  useEffect(() => {
    if (!planBatchesModalOpen) addedOneBatchRef.current = false;
  }, [planBatchesModalOpen]);

  // When selected batch data loads, sync BOM from that batch (batch-specific BOM)
  useEffect(() => {
    if (!selectedBatchData || !selectedBatchId) return;
    const rmLines = (selectedBatchData.rmLines || []) as Array<{ inci_name?: string; rm_code?: string; pct_w_w?: number; uom?: string; phase?: string; raw_material_id?: number }>;
    const pmLines = (selectedBatchData.pmLines || []) as Array<{ description?: string; pm_code?: string; qty_per_unit?: number }>;
    setBomFormula(rmLines.map((line, i) => ({
      id: String(line.raw_material_id ?? line.rm_code ?? i),
      name: line.inci_name ?? '',
      quantity: 0,
      unit: line.uom ?? 'KG',
      percentage: line.pct_w_w ?? 0,
      code: line.rm_code,
      phase: line.phase ?? 'Phase A',
      specificGravity: (line as BOMRmLine).specific_gravity ?? 1,
    })));
    setBomPackaging(pmLines.map((line, i) => ({
      id: String(line.pm_code ?? i),
      name: line.description ?? '',
      quantity: 0,
      unit: 'PCS',
      value: line.qty_per_unit ?? 1,
      percentage: 0,
      code: line.pm_code,
    })));
  }, [selectedBatchId, selectedBatchData]);

  // Sync feasibility preview qty to order qty when Plan Batches modal opens or SO changes
  useEffect(() => {
    if (!selectedSOForBatch) return;
    const orderQtyNum = parseInt(selectedSOForBatch.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
    setFeasibilityPreviewQty(orderQtyNum);
  }, [selectedSOForBatch?.id, selectedSOForBatch?.orderQty]);

  const kgPerUnitForPlanBatches = useMemo(() => {
    const orderQtyNum = parseInt(selectedSOForBatch?.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
    const totalKgNum = parseFloat(selectedSOForBatch?.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
    return orderQtyNum > 0 && totalKgNum > 0 ? totalKgNum / orderQtyNum : 0;
  }, [selectedSOForBatch?.orderQty, selectedSOForBatch?.totalKg]);

  // When preview qty changes, reflect it once into the next active batch-units input in Batch Plan.
  // "Next active" = expanded batch if any; otherwise first unsent batch.
  const lastAppliedPreviewQtyRef = useRef<number | null>(null);
  useEffect(() => {
    if (!planBatchesModalOpen || !selectedSOForBatch) return;
    if (activeBatchTab !== 'batch-plan') return;
    if (!Number.isFinite(kgPerUnitForPlanBatches) || kgPerUnitForPlanBatches <= 0) return;
    if (customBatches.length === 0) return;

    const sent = selectedSOForBatch.sentBatchIndices ?? [];
    let targetIdx = expandedBatchIndex;
    if (targetIdx == null) {
      const firstUnsent = customBatches.findIndex((_, i) => !sent.includes(i));
      targetIdx = firstUnsent >= 0 ? firstUnsent : 0;
    }
    if (targetIdx < 0 || targetIdx >= customBatches.length) return;

    const nextUnits = Math.max(0, Math.floor(feasibilityPreviewQty || 0));
    if (lastAppliedPreviewQtyRef.current === nextUnits) return;
    lastAppliedPreviewQtyRef.current = nextUnits;
    const currentUnits = Math.round((customBatches[targetIdx]?.sizeKg || 0) / kgPerUnitForPlanBatches);
    if (nextUnits === currentUnits) return;

    setCustomBatches((prev) =>
      prev.map((b, i) => (i === targetIdx ? { ...b, sizeKg: nextUnits * kgPerUnitForPlanBatches } : b))
    );
    setExpandedBatchIndex(targetIdx);
  }, [
    feasibilityPreviewQty,
    activeBatchTab,
    planBatchesModalOpen,
    selectedSOForBatch,
    expandedBatchIndex,
    kgPerUnitForPlanBatches,
    customBatches,
  ]);

  useEffect(() => {
    if (!planBatchesModalOpen) {
      lastAppliedPreviewQtyRef.current = null;
    }
  }, [planBatchesModalOpen, selectedSOForBatch?.id]);

  const lastSyncedBomIdRef = useRef<string | null>(null);
  const syncedFallbackOrderIdRef = useRef<string | null>(null);
  const prFromBatchShortagesRef = useRef(false);
  const prFromDetailShortagesRef = useRef(false);
  /** When set, PR is being raised for a specific batch (from "Raise PR for this batch"); used to send planningBatchId. */
  const prForBatchIndexRef = useRef<number | null>(null);
  /** Dedupe Warehouse → Items Involved "Release to Planning" navigation (location.state). */
  const warehouseReleaseHandledNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!planBatchesModalOpen || !selectedSOForBatch) return;
    if (selectedBatchId != null) return; // batch-first: BOM comes from selected batch (selectedBatchData effect)
    if (bomOverrideForPlanning === undefined) return;
    if (bomOverrideForPlanning === null) lastSyncedBomIdRef.current = null;
    if (bomOverrideForPlanning && (bomOverrideForPlanning.rmLines?.length > 0 || bomOverrideForPlanning.pmLines?.length > 0)) {
      lastSyncedBomIdRef.current = 'override';
      syncedFallbackOrderIdRef.current = null;
      const rmLines = bomOverrideForPlanning.rmLines ?? [];
      const pmLines = bomOverrideForPlanning.pmLines ?? [];
      setBomFormula(rmLines.map((line: BOMRmLine, i: number) => ({
        id: String((line as { raw_material_id?: number }).raw_material_id ?? line.rm_code ?? i),
        name: line.inci_name ?? (line as { name?: string }).name ?? '',
        quantity: 0,
        unit: line.uom ?? 'KG',
        percentage: line.pct_w_w ?? line.pct ?? 0,
        code: line.rm_code,
        phase: line.phase,
        specificGravity: line.specific_gravity ?? 1,
      })));
      setBomPackaging(pmLines.map((line: BOMPmLine, i: number) => ({
        id: String((line as { pm_code?: string }).pm_code ?? i),
        name: line.description ?? (line as { name?: string }).name ?? '',
        quantity: 0,
        unit: 'PCS',
        value: (line as { qty_per_unit?: number }).qty_per_unit ?? (line as { qty?: number }).qty ?? 1,
        percentage: 0,
        code: (line as { pm_code?: string }).pm_code,
      })));
      return;
    }
    if (activeBom && activeBom.productId === selectedSOForBatch.productId) {
      if (lastSyncedBomIdRef.current === 'override' || lastSyncedBomIdRef.current === activeBom.id) return;
      lastSyncedBomIdRef.current = activeBom.id;
      syncedFallbackOrderIdRef.current = null;
      const rmLines = activeBom.rmLines ?? [];
      const pmLines = activeBom.pmLines ?? [];
      setBomFormula(rmLines.map((line: BOMRmLine, i: number) => ({
        id: String((line as { raw_material_id?: number }).raw_material_id ?? line.rm_code ?? i),
        name: line.inci_name ?? (line as { name?: string }).name ?? '',
        quantity: 0,
        unit: line.uom ?? 'KG',
        percentage: line.pct_w_w ?? line.pct ?? 0,
        code: line.rm_code,
        phase: line.phase,
        specificGravity: line.specific_gravity ?? 1,
      })));
      setBomPackaging(pmLines.map((line: BOMPmLine, i: number) => ({
        id: String((line as { pm_code?: string }).pm_code ?? i),
        name: line.description ?? (line as { name?: string }).name ?? '',
        quantity: 0,
        unit: 'PCS',
        value: (line as { qty_per_unit?: number }).qty_per_unit ?? (line as { qty?: number }).qty ?? 1,
        percentage: 0,
        code: (line as { pm_code?: string }).pm_code,
      })));
      return;
    }
    if (!activeBom && selectedSOForBatch.rawMaterials?.length >= 0 && syncedFallbackOrderIdRef.current !== selectedSOForBatch.id) {
      syncedFallbackOrderIdRef.current = selectedSOForBatch.id;
      lastSyncedBomIdRef.current = null;
      setBomFormula((selectedSOForBatch.rawMaterials ?? []).map((item, i) => ({
        id: (item as RawMaterial).code ?? item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        percentage: item.percentage,
        code: (item as RawMaterial).code,
        phase: 'Phase A',
        specificGravity: (item as RawMaterial).specificGravity ?? (item as { specific_gravity?: number }).specific_gravity ?? 1,
      })));
      setBomPackaging((selectedSOForBatch.packagingMaterials ?? []).map((item, i) => ({
        id: (item as PackagingMaterial).code ?? item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        value: (item as PackagingMaterial).value ?? 1,
        percentage: (item as PackagingMaterial).percentage ?? 0,
        code: (item as PackagingMaterial).code,
      })));
    }
  }, [planBatchesModalOpen, selectedSOForBatch?.id, selectedSOForBatch?.productId, selectedSOForBatch?.rawMaterials, selectedSOForBatch?.packagingMaterials, activeBom?.id, activeBom?.productId, activeBom?.rmLines, activeBom?.pmLines, bomOverrideForPlanning, selectedBatchId]);

  useEffect(() => {
    if (!planBatchesModalOpen) {
      lastSyncedBomIdRef.current = null;
      syncedFallbackOrderIdRef.current = null;
    }
  }, [planBatchesModalOpen]);

  // When PR modal opens, build prItems only from items that exist in RM/PM master tables (raw_materials, pack_materials)
  // When opening from Plan Batches "Raise PR for Shortages", prFromBatchShortagesRef is set and we build from feasibility short rows instead
  useEffect(() => {
    if (!prModalOpen || !selectedSO) {
      setPrItems([]);
      setPrOmittedCount(0);
      return;
    }
    if (prFromDetailShortagesRef.current) {
      prFromDetailShortagesRef.current = false;
      return;
    }
    if (prFromBatchShortagesRef.current) {
      prFromBatchShortagesRef.current = false;
      const rmByCode = new Map(rawMaterialsList.map((r) => [r.code?.toLowerCase() ?? '', r]));
      const pmByCode = new Map(packMaterialsList.map((p) => [p.code?.toLowerCase() ?? '', p]));
      const items: ProcurementRequestItem[] = [];
      let omitted = 0;
      for (const row of feasibilityRmRows) {
        if (row.ok) continue;
        const master = rmByCode.get(row.code?.toLowerCase() ?? '') ?? rawMaterialsList.find((r) => r.code === row.code || r.name === row.name);
        if (!master) {
          omitted += 1;
          continue;
        }
        const raw_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
        if (raw_material_id == null || Number.isNaN(raw_material_id)) {
          omitted += 1;
          continue;
        }
        const shortage = Math.max(0, row.totalReq - row.sih);
        items.push({
          type: 'RM',
          code: master.code ?? row.code,
          name: master.name ?? row.name,
          required: row.totalReq,
          sih: row.sih,
          shortage,
          quantity_requested: shortage,
          unit: 'KG',
          line_notes: '',
          raw_material_id,
        });
      }
      for (const row of feasibilityPmRows) {
        if (row.ok) continue;
        const master = pmByCode.get(row.code?.toLowerCase() ?? '') ?? packMaterialsList.find((p) => p.code === row.code || p.description === row.name);
        if (!master) {
          omitted += 1;
          continue;
        }
        const pack_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
        if (pack_material_id == null || Number.isNaN(pack_material_id)) {
          omitted += 1;
          continue;
        }
        const shortage = Math.max(0, row.totalReq - row.sih);
        items.push({
          type: 'PM',
          code: master.code ?? row.code,
          name: master.description ?? row.name,
          required: row.totalReq,
          sih: row.sih,
          shortage,
          quantity_requested: shortage,
          unit: 'PCS',
          line_notes: '',
          pack_material_id,
        });
      }
      setPrItems(items);
      setPrOmittedCount(omitted);
      return;
    }
    const validRmIds = new Set(rawMaterialsList.map((r) => String(r.id)));
    const validPmIds = new Set(packMaterialsList.map((p) => String(p.id)));
    const rmByCode = new Map(rawMaterialsList.map((r) => [r.code?.toLowerCase() ?? '', r]));
    const pmByCode = new Map(packMaterialsList.map((p) => [p.code?.toLowerCase() ?? '', p]));
    let omitted = 0;
    const items: ProcurementRequestItem[] = [];

    if (!prShowPMOnly) {
      for (const rm of selectedSO.rawMaterials) {
        const rid = (rm as RawMaterial).raw_material_id;
        const code = (rm as RawMaterial).code ?? rm.id ?? '';
        const master = rid != null && validRmIds.has(String(rid))
          ? rawMaterialsList.find((r) => String(r.id) === String(rid))
          : rmByCode.get(code?.toLowerCase()) ?? rawMaterialsList.find((r) => r.code === code || r.name === rm.name);
        if (!master) {
          omitted += 1;
          continue;
        }
        const raw_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
        if (raw_material_id == null || Number.isNaN(raw_material_id)) {
          omitted += 1;
          continue;
        }
        const required = typeof rm.quantity === 'number' ? rm.quantity : 0;
        const wh = warehouseRows.find((r) => r.type === 'RM' && (r.code === master.code || r.name === master.name || r.sourceId === raw_material_id));
        const sih = wh?.stockInHand ?? 0;
        const shortage = Math.max(0, required - sih);
        items.push({
          type: 'RM',
          code: master.code ?? code,
          name: master.name ?? rm.name,
          required,
          sih,
          shortage,
          quantity_requested: shortage,
          unit: rm.unit || 'KG',
          line_notes: '',
          raw_material_id,
        });
      }
    }
    for (const pm of selectedSO.packagingMaterials) {
      const pid = (pm as PackagingMaterial).pack_material_id;
      const code = (pm as PackagingMaterial).code ?? pm.id ?? '';
      const master = pid != null && validPmIds.has(String(pid))
        ? packMaterialsList.find((p) => String(p.id) === String(pid))
        : pmByCode.get(code?.toLowerCase()) ?? packMaterialsList.find((p) => p.code === code || p.description === pm.name);
      if (!master) {
        omitted += 1;
        continue;
      }
      const pack_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
      if (pack_material_id == null || Number.isNaN(pack_material_id)) {
        omitted += 1;
        continue;
      }
      const required = typeof pm.quantity === 'number' ? pm.quantity : 0;
      const wh = warehouseRows.find((r) => r.type === 'PM' && (r.code === master.code || r.name === master.description || r.sourceId === pack_material_id));
      const sih = wh?.stockInHand ?? 0;
      const shortage = Math.max(0, required - sih);
      items.push({
        type: 'PM',
        code: master.code ?? code,
        name: master.description ?? pm.name,
        required,
        sih,
        shortage,
        quantity_requested: shortage,
        unit: pm.unit || 'PCS',
        line_notes: '',
        pack_material_id,
      });
    }
    const shortageItems = items.filter((i) => i.shortage > 0);
    setPrItems(shortageItems);
    setPrOmittedCount(omitted);
  }, [prModalOpen, selectedSO?.id, prShowPMOnly, warehouseRows, rawMaterialsList, packMaterialsList]);

  const batchSizeNum = parseInt(selectedSOForBatch?.batchSize?.replace(/\D/g, '') || '500', 10) || 500;
  const batchesReq = selectedSOForBatch?.batchesRequired ?? 15;
  const orderQtyNum = parseInt(selectedSOForBatch?.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
  const totalKgNum = parseFloat(selectedSOForBatch?.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
  const unitsPerBatch = batchesReq > 0 ? orderQtyNum / batchesReq : 0;
  // Req this order = (BOM per unit of product) × preview qty — same basis as PIs Extracted list (BOM × order qty)
  const kgPerUnitOfProduct = orderQtyNum > 0 && totalKgNum > 0 ? totalKgNum / orderQtyNum : 0;

  const feasibilityRmRows = useMemo(() => {
    if (bomFormula.length > 0) {
      return bomFormula.map((item) => {
        const code = item.code ?? item.id;
        const pct = item.percentage ?? 0;
        const sgRaw =
          (item as RawMaterial).specificGravity ??
          (item as { specific_gravity?: number }).specific_gravity ??
          1;
        const specificGravity = Number.isFinite(Number(sgRaw)) && Number(sgRaw) > 0 ? Number(sgRaw) : 1;
        const perBatch = (batchSizeNum * pct) / 100;
        const kgPerUnitRm = kgPerUnitOfProduct > 0 ? (pct / 100) * kgPerUnitOfProduct : perBatch / (unitsPerBatch || 1);
        const whRow = warehouseRows.find((r) => r.type === 'RM' && (r.code === code || r.name === item.name || String(r.sourceId) === String(item.id)));
        const sih = whRow?.stockInHand ?? 0;
        const reserved = whRow?.reserved ?? 0;
        const free = Math.max(0, sih - reserved);
        const inTransit = whRow?.inTransit ?? 0;
        const reqThisOrder = kgPerUnitRm * feasibilityPreviewQty;
        const reqThisOrderLiters = specificGravity > 0 ? reqThisOrder / specificGravity : reqThisOrder;
        const maxUnits = kgPerUnitRm > 0 ? Math.floor(free / kgPerUnitRm) : 999;
        const maxBatches = perBatch > 0 ? Math.floor(free / perBatch) : 999;
        const totalReq = kgPerUnitOfProduct > 0 ? (pct / 100) * totalKgNum : perBatch * batchesReq;
        const gap = Math.max(0, reqThisOrder - free);
        return { name: item.name, code: String(code), pct, specificGravity, perBatch, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, reqThisOrderLiters, maxUnits, ok: maxUnits >= feasibilityPreviewQty };
      });
    }
    if (activeBom?.rmLines?.length) {
      return activeBom.rmLines.map((line, i) => {
        const code = line.rm_code ?? String(line.raw_material_id ?? i);
        const pct = line.pct_w_w ?? line.pct ?? 0;
        const sgRaw = (line as any).specific_gravity ?? (line as any).specificGravity ?? 1;
        const specificGravity = Number.isFinite(Number(sgRaw)) && Number(sgRaw) > 0 ? Number(sgRaw) : 1;
        const perBatch = (batchSizeNum * pct) / 100;
        const kgPerUnitRm = kgPerUnitOfProduct > 0 ? (pct / 100) * kgPerUnitOfProduct : perBatch / (unitsPerBatch || 1);
        const whRow = warehouseRows.find((r) => r.type === 'RM' && (r.code === code || String(r.sourceId) === String(line.raw_material_id)));
        const sih = whRow?.stockInHand ?? 0;
        const reserved = whRow?.reserved ?? 0;
        const free = Math.max(0, sih - reserved);
        const inTransit = whRow?.inTransit ?? 0;
        const reqThisOrder = kgPerUnitRm * feasibilityPreviewQty;
        const reqThisOrderLiters = specificGravity > 0 ? reqThisOrder / specificGravity : reqThisOrder;
        const maxUnits = kgPerUnitRm > 0 ? Math.floor(free / kgPerUnitRm) : 999;
        const maxBatches = perBatch > 0 ? Math.floor(free / perBatch) : 999;
        const totalReq = kgPerUnitOfProduct > 0 ? (pct / 100) * totalKgNum : perBatch * batchesReq;
        const gap = Math.max(0, reqThisOrder - free);
        return { name: line.inci_name ?? code, code, pct, specificGravity, perBatch, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, reqThisOrderLiters, maxUnits, ok: maxUnits >= feasibilityPreviewQty };
      });
    }
    return (selectedSOForBatch?.rawMaterials ?? []).map((item) => {
      const pct = item.percentage || 0;
      const sgRaw =
        (item as RawMaterial).specificGravity ??
        (item as { specific_gravity?: number }).specific_gravity ??
        1;
      const specificGravity = Number.isFinite(Number(sgRaw)) && Number(sgRaw) > 0 ? Number(sgRaw) : 1;
      const perBatch = (batchSizeNum * pct) / 100;
      const kgPerUnitRm = kgPerUnitOfProduct > 0 ? (pct / 100) * kgPerUnitOfProduct : perBatch / (unitsPerBatch || 1);
      const whRow = warehouseRows.find((r) => r.type === 'RM' && (r.name === item.name || r.code === (item as RawMaterial).code));
      const sih = whRow?.stockInHand ?? item.quantity ?? 0;
      const reserved = whRow?.reserved ?? 0;
      const free = Math.max(0, sih - reserved);
      const inTransit = whRow?.inTransit ?? 0;
      const reqThisOrder = kgPerUnitRm * feasibilityPreviewQty;
      const reqThisOrderLiters = specificGravity > 0 ? reqThisOrder / specificGravity : reqThisOrder;
      const maxUnits = kgPerUnitRm > 0 ? Math.floor(free / kgPerUnitRm) : 999;
      const maxBatches = perBatch > 0 ? Math.floor(free / perBatch) : 999;
      const totalReq = kgPerUnitOfProduct > 0 ? (pct / 100) * totalKgNum : perBatch * batchesReq;
      const gap = Math.max(0, reqThisOrder - free);
      return { name: item.name, code: (item as RawMaterial).code ?? item.id, pct, specificGravity, perBatch, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, reqThisOrderLiters, maxUnits, ok: maxUnits >= feasibilityPreviewQty };
    });
  }, [bomFormula, activeBom?.rmLines, selectedSOForBatch?.rawMaterials, selectedSOForBatch?.batchSize, selectedSOForBatch?.batchesRequired, selectedSOForBatch?.totalKg, warehouseRows, batchSizeNum, batchesReq, orderQtyNum, totalKgNum, kgPerUnitOfProduct, unitsPerBatch, feasibilityPreviewQty]);

  const feasibilityPmRows = useMemo(() => {
    const upb = batchesReq > 0 ? Math.ceil(orderQtyNum / batchesReq) || 3333 : 3333;
    if (bomPackaging.length > 0) {
      return bomPackaging.map((item) => {
        const code = item.code ?? item.id;
        const qtyPerUnit = item.value ?? 1;
        const perBatchPcs = upb * qtyPerUnit;
        const whRow = warehouseRows.find((r) => r.type === 'PM' && (r.code === code || r.name === item.name || String(r.sourceId) === String(item.id)));
        const sih = whRow?.stockInHand ?? 0;
        const reserved = whRow?.reserved ?? 0;
        const free = Math.max(0, sih - reserved);
        const inTransit = whRow?.inTransit ?? 0;
        const reqThisOrder = qtyPerUnit * feasibilityPreviewQty;
        const maxUnits = qtyPerUnit > 0 ? Math.floor(free / qtyPerUnit) : 999;
        const maxBatches = perBatchPcs > 0 ? Math.floor(free / perBatchPcs) : 999;
        const totalReq = qtyPerUnit * orderQtyNum;
        const gap = Math.max(0, reqThisOrder - free);
        return { name: item.name, code: String(code), qtyPerUnit, perBatchPcs, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= feasibilityPreviewQty };
      });
    }
    if (activeBom?.pmLines?.length) {
      return activeBom.pmLines.map((line, i) => {
        const code = (line as { pm_code?: string }).pm_code ?? String(i);
        const qtyPerUnit = (line as { qty_per_unit?: number }).qty_per_unit ?? (line as { qty?: number }).qty ?? 1;
        const perBatchPcs = upb * qtyPerUnit;
        const whRow = warehouseRows.find((r) => r.type === 'PM' && (r.code === code || String(r.sourceId) === code));
        const sih = whRow?.stockInHand ?? 0;
        const reserved = whRow?.reserved ?? 0;
        const free = Math.max(0, sih - reserved);
        const inTransit = whRow?.inTransit ?? 0;
        const reqThisOrder = qtyPerUnit * feasibilityPreviewQty;
        const maxUnits = qtyPerUnit > 0 ? Math.floor(free / qtyPerUnit) : 999;
        const maxBatches = perBatchPcs > 0 ? Math.floor(free / perBatchPcs) : 999;
        const totalReq = qtyPerUnit * orderQtyNum;
        const gap = Math.max(0, reqThisOrder - free);
        return { name: line.description ?? code, code, qtyPerUnit, perBatchPcs, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= feasibilityPreviewQty };
      });
    }
    return (selectedSOForBatch?.packagingMaterials ?? []).map((item) => {
      const qtyPerUnit = (item as PackagingMaterial).value ?? 1;
      const perBatchPcs = upb * qtyPerUnit;
      const whRow = warehouseRows.find((r) => r.type === 'PM' && (r.name === item.name || r.code === (item as PackagingMaterial).code));
      const sih = whRow?.stockInHand ?? item.quantity ?? 0;
      const reserved = whRow?.reserved ?? 0;
      const free = Math.max(0, sih - reserved);
      const inTransit = whRow?.inTransit ?? 0;
      const reqThisOrder = qtyPerUnit * feasibilityPreviewQty;
        const maxUnits = qtyPerUnit > 0 ? Math.floor(free / qtyPerUnit) : 999;
        const maxBatches = perBatchPcs > 0 ? Math.floor(free / perBatchPcs) : 999;
      const totalReq = qtyPerUnit * orderQtyNum;
      const gap = Math.max(0, reqThisOrder - free);
      return { name: item.name, code: (item as PackagingMaterial).code ?? item.id, qtyPerUnit, perBatchPcs, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= feasibilityPreviewQty };
    });
  }, [bomPackaging, activeBom?.pmLines, selectedSOForBatch?.packagingMaterials, selectedSOForBatch?.orderQty, selectedSOForBatch?.batchesRequired, warehouseRows, batchesReq, orderQtyNum, feasibilityPreviewQty]);

  /** BOM can be confirmed whenever the editor has RM/PM lines; backend reserves up to free stock (shortages stay for POs). */
  const canConfirmBomPerBatch = useMemo(() => {
    return feasibilityRmRows.length > 0 || feasibilityPmRows.length > 0;
  }, [feasibilityRmRows, feasibilityPmRows]);

  // Feasibility summary: max units we can make (bottleneck by RM and PM)
  const feasibilityRmCoversUnits = feasibilityRmRows.length > 0 ? Math.min(...feasibilityRmRows.map((r) => r.maxUnits)) : 0;
  const feasibilityPmCoversUnits = feasibilityPmRows.length > 0 ? Math.min(...feasibilityPmRows.map((r) => r.maxUnits)) : 0;
  const feasibilityExecutableUnits = Math.min(feasibilityRmCoversUnits, feasibilityPmCoversUnits);

  const selectedBatchPlanIndex = useMemo(() => {
    if (selectedBatchId == null || !planningBatches?.length) return -1;
    return (planningBatches as PlanningBatchRow[]).findIndex((b) => Number(b.id) === Number(selectedBatchId));
  }, [planningBatches, selectedBatchId]);

  const selectedBatchPlanSequence = useMemo(() => {
    if (selectedBatchPlanIndex < 0) return 1;
    const row = (planningBatches as PlanningBatchRow[])[selectedBatchPlanIndex];
    return Number(row?.sequence ?? selectedBatchPlanIndex + 1) || selectedBatchPlanIndex + 1;
  }, [planningBatches, selectedBatchPlanIndex]);

  // Items Involved — from confirmed BOMs only (API); also used for tab stats
  const { data: itemsInvolvedRows = [], isLoading: itemsInvolvedLoading } = useQuery({
    queryKey: ['planning', 'items-involved'],
    queryFn: fetchItemsInvolved,
    enabled: activeMainTab === 'items-involved',
  });
  const { data: allPlanningBatches = [] } = useQuery({
    queryKey: ['planning', 'batches', 'all', 'items-involved'],
    queryFn: fetchAllBatches,
    enabled: activeMainTab === 'items-involved',
  });
  // Items List (vendor rates) is the single source of truth for quotations and PO planned stage.
  const { data: itemsListRmPage = [] } = useQuery({
    queryKey: ['items-list-page', 'RM', 'planning-items-involved'],
    queryFn: async () => {
      const res = await fetchPriceListPage('RM');
      return res.success ? (res.data ?? []) : [];
    },
    enabled: activeMainTab === 'items-involved',
  });
  const { data: itemsListPmPage = [] } = useQuery({
    queryKey: ['items-list-page', 'PM', 'planning-items-involved'],
    queryFn: async () => {
      const res = await fetchPriceListPage('PM');
      return res.success ? (res.data ?? []) : [];
    },
    enabled: activeMainTab === 'items-involved',
  });
  const itemsInvolved = useMemo(() => itemsInvolvedRows.map((row): ItemsInvolvedDisplayRow => {
    const shortage = row.surplusShortage < 0 ? Math.abs(row.surplusShortage) : 0;
    const surplusShortageStr = row.surplusShortage >= 0 ? `+${Math.round(row.surplusShortage).toLocaleString()}` : `-${Math.round(shortage).toLocaleString()}`;
    const totalReqStr =
      row.type === 'RM' || String(row.unit ?? '').toUpperCase() === 'KG'
        ? `${Number(row.totalRequired).toLocaleString(undefined, { maximumFractionDigits: 3 })} kg`
        : `${Math.round(row.totalRequired).toLocaleString()} pcs`;
    const sihStr = Math.round(row.sih).toLocaleString();
    const orderedQtyNum = Number(row.inTransit ?? 0) || 0;
    // Availability math (per requirement):
    // Gap = Required - (((SIH + PO) - Reserved))
    // This API provides `row.sih` as free/available stock (stock_in_hand - reserved), so:
    // Gap = Required - (free + PO)
    const netNum = Number(row.sih ?? 0) + orderedQtyNum - Number(row.totalRequired ?? 0);
    const unitSuffix = row.unit === 'KG' ? ' KG' : row.unit === 'PCS' ? ' pcs' : '';
    const netDisplay =
      row.type === 'RM' || String(row.unit ?? '').toUpperCase() === 'KG'
        ? `${netNum >= 0 ? '+' : ''}${Number(netNum).toLocaleString(undefined, { maximumFractionDigits: 3 })}${unitSuffix}`
        : `${netNum >= 0 ? '+' : ''}${Math.round(netNum).toLocaleString()}${unitSuffix}`;
    return {
      id: `${row.type}-${row.raw_material_id ?? row.pack_material_id}`,
      name: row.name,
      code: row.code,
      category: row.type === 'PM' ? 'PM - Primary' : 'RM',
      usedIn: String(row.batchCount ?? 0),
      usedInProducts: row.usedInProducts ?? [],
      totalReq: totalReqStr,
      totalRequired: row.totalRequired,
      batchCount: row.batchCount ?? 0,
      sih: sihStr,
      sihNum: row.sih,
      surplusShortage: surplusShortageStr,
      surplusShortageNum: row.surplusShortage,
      coverage: `${row.coverage}%`,
      whBatches: row.batchNumber ?? '—',
      warehouseInventoryId: row.warehouseInventoryId ?? null,
      expiry: row.expiryDate ?? '—',
      bomFlag: 'Original',
      itemType: row.type,
      planningExtractedIds: row.planningExtractedIds ?? [],
      planningExtractedId: row.planningExtractedIds?.[0] ?? null,
      raw_material_id: row.raw_material_id ?? undefined,
      pack_material_id: row.pack_material_id ?? undefined,
      unit: row.unit,
      reserved: (row.reserved ?? 0).toLocaleString() + unitSuffix,
      reservedNum: Number(row.reserved ?? 0) || 0,
      plannedQty: (Number(row.plannedQty ?? 0) || 0).toLocaleString() + unitSuffix,
      plannedQtyNum: Number(row.plannedQty ?? 0) || 0,
      orderedQty: orderedQtyNum.toLocaleString() + unitSuffix,
      orderedQtyNum,
      net: netDisplay,
      netNum,
      inTransit: (row.inTransit ?? 0).toLocaleString() + unitSuffix,
      reorderPt: (row.reorderPt ?? 0).toLocaleString() + unitSuffix,
      avgMo: (row.avgMo ?? 0).toLocaleString() + unitSuffix,
      status: row.status ?? 'In Stock',
    };
  }), [itemsInvolvedRows]);

  const itemsInvolvedProductOptions = useMemo(() => {
    const set = new Set<string>();
    itemsInvolved.forEach((row) => (row.usedInProducts ?? []).forEach((p) => set.add(p)));
    return ['all', ...Array.from(set).sort()];
  }, [itemsInvolved]);

  const filteredItemsInvolved = useMemo(() => {
    return itemsInvolved.filter((row) => {
      if (itemsInvolvedCategoryFilter === 'RM' && row.itemType !== 'RM') return false;
      if (itemsInvolvedCategoryFilter === 'PM' && row.itemType !== 'PM') return false;
      if (itemsInvolvedCategoryFilter === 'shortage' && row.netNum >= 0) return false;
      if (itemsInvolvedCategoryFilter === 'available' && row.netNum < 0) return false;
      if (itemsInvolvedProductFilter !== 'all') {
        const usedIn = row.usedInProducts ?? [];
        if (!usedIn.includes(itemsInvolvedProductFilter)) return false;
      }
      const search = itemsInvolvedSearchTerm.trim().toLowerCase();
      if (search) {
        const matchName = row.name?.toLowerCase().includes(search);
        const matchCode = row.code?.toLowerCase().includes(search);
        const matchUsedIn = (row.usedInProducts ?? []).some((p) => p.toLowerCase().includes(search));
        if (!matchName && !matchCode && !matchUsedIn) return false;
      }
      return true;
    });
  }, [itemsInvolved, itemsInvolvedCategoryFilter, itemsInvolvedProductFilter, itemsInvolvedSearchTerm]);

  // Tab-specific stats — derived from API data (planning-extracted, items-involved, procurement)
  const tabStats = useMemo(() => {
    const totalSOs = planningExtractedList.length;
    const prodReleased = planningExtractedList.filter((r) => (r as { bomStatus?: string }).bomStatus === 'Production Released').length;
    const batchesRequired = planningExtractedList.reduce((s, r) => s + (r.batchesRequired ?? 0), 0);
    const batchesConfirmed = planningExtractedList.filter((r) => (r as { bomConfirmedAt?: string }).bomConfirmedAt != null).length;
    const itemShortages = itemsInvolvedRows.filter((r) => r.surplusShortage < 0).length;
    const confirmedCount = planningExtractedList.filter((r) => (r as { bomConfirmedAt?: string }).bomConfirmedAt != null).length;
    const rmItems = itemsInvolvedRows.filter((r) => r.type === 'RM');
    const pmItems = itemsInvolvedRows.filter((r) => r.type === 'PM');
    const rmOk = rmItems.filter((r) => r.coverage >= 100).length;
    const rmShort = rmItems.filter((r) => r.coverage < 100).length;
    const pmOk = pmItems.filter((r) => r.coverage >= 100).length;
    const pmShort = pmItems.filter((r) => r.coverage < 100).length;
    const prCount = procurementRequests.length;

    return {
      'pis-extracted': {
        totalSOs,
        prodReleased,
        shortages: itemShortages,
        batchesRequired,
        batchesConfirmed,
        soValue: '—',
      },
      'items-involved': {
        confirmedProducts: { value: confirmedCount, total: totalSOs },
        rmItems: { value: rmItems.length, ok: rmOk, short: rmShort },
        pmItems: { value: pmItems.length, ok: pmOk, short: pmShort },
        rmShortages: rmShort,
        pmShortages: pmShort,
        prsRaised: prCount,
      },
      'batches': {},
    };
  }, [planningExtractedList, itemsInvolvedRows, procurementRequests]);

  const currentStats = tabStats[activeMainTab];

  // Fallback when API returns no rows (empty state); all list data comes from planning-extracted API
  const initialSalesOrders: SalesOrder[] = [];

  const [salesOrders] = useState<SalesOrder[]>(initialSalesOrders);

  const filteredPisOrders = useMemo(() => {
    return pisRows.filter((order) => {
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Prod Released' && order.bomStatus === 'Production Released') ||
        (statusFilter === 'In Progress' && order.bomStatus === 'In Progress') ||
        (statusFilter === 'Planned' && order.bomStatus === 'Planned');

      const matchesSearch =
        order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.soNumber.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [pisRows, statusFilter, searchTerm]);

  const visiblePisSoNos = useMemo(
    () => Array.from(new Set(filteredPisOrders.map((o) => String(o.soNumber || '').trim()).filter(Boolean))),
    [filteredPisOrders]
  );

  useEffect(() => {
    let cancelled = false;
    const key = visiblePisSoNos.join('|');
    if (activeMainTab !== 'pis-extracted') return;
    if (!key) return;
    if (planningAvailabilityRequestInFlight.current) return;

    planningAvailabilityRequestInFlight.current = true;
    setPlanningAvailabilityLoading(true);
    Promise.all(
      visiblePisSoNos.map((soNo) =>
        fetchSoPlanningAvailability(soNo)
          .then((res) => ({ soNo, res }))
          .catch((e) => {
            console.error('fetchSoPlanningAvailability error', { soNo, e });
            return { soNo, res: null as any };
          })
      )
    )
      .then((results) => {
        if (cancelled) return;
        setPlanningAvailabilityBySoNo((prev) => {
          const next = { ...prev };
          for (const r of results) {
            if (r.res) {
              next[r.soNo] = r.res;
              next[normalizeSoKey(r.soNo)] = r.res;
            }
          }
          return next;
        });
      })
      .finally(() => {
        planningAvailabilityRequestInFlight.current = false;
        if (!cancelled) setPlanningAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
      planningAvailabilityRequestInFlight.current = false;
    };
  }, [activeMainTab, visiblePisSoNos.join('|')]);


  const openDetailModal = (order: SalesOrder) => {
    setSelectedRowForDetail(order);
    setDetailModalOpen(true);
  };
  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedRowForDetail(null);
  };

  const getUsedInBatchesForItem = (item: ItemsInvolvedDisplayRow) => {
    const itemCode = String(item.code ?? '').trim().toLowerCase();
    const itemName = String(item.name ?? '').trim().toLowerCase();
    const itemId = item.itemType === 'RM' ? Number(item.raw_material_id) : Number(item.pack_material_id);
    return (allPlanningBatches as PlanningBatchAllRow[])
      // Include both sent and draft batches so the operator sees every batch for the
      // selected product/item.
      .filter((b) => {
        const allowedProductNames = (item.usedInProducts ?? [])
          .map((p) => String(p ?? '').trim().toLowerCase())
          .filter(Boolean);
        if (allowedProductNames.length === 0) return true;
        return allowedProductNames.includes(String(b.productName ?? '').trim().toLowerCase());
      })
      .filter((b) => {
        const lines = item.itemType === 'RM' ? (b.rmLines ?? []) : (b.pmLines ?? []);
        return lines.some((line: { raw_material_id?: number; pack_material_id?: number; rm_code?: string; pm_code?: string; code?: string; inci_name?: string; name?: string; description?: string }) => {
          const lineId = item.itemType === 'RM' ? Number(line.raw_material_id) : Number(line.pack_material_id);
          const lineCode = String(line.rm_code ?? line.pm_code ?? line.code ?? '').trim().toLowerCase();
          const lineLabel = String(line.inci_name ?? line.name ?? line.description ?? '')
            .trim()
            .toLowerCase();

          const matchesById = Number.isFinite(itemId) && itemId > 0 && Number.isFinite(lineId) && lineId === itemId;
          const matchesByCode = itemCode.length > 0 && lineCode === itemCode;
          const matchesByName = itemName.length > 0 && lineLabel === itemName;

          return matchesById || matchesByCode || matchesByName;
        });
      });
  };

  const getItemRequiredInBatch = (item: ItemsInvolvedDisplayRow, batch: PlanningBatchAllRow) => {
    const sizeKg = Number(batch.sizeKg) || 0;
    const lines = item.itemType === 'RM' ? (batch.rmLines ?? []) : (batch.pmLines ?? []);
    const itemCode = String(item.code ?? '').trim().toLowerCase();
    const itemId = item.itemType === 'RM' ? Number(item.raw_material_id) : Number(item.pack_material_id);
    if (item.itemType === 'RM') {
      return lines.reduce<number>((sum, line: { raw_material_id?: number; rm_code?: string; code?: string; pct_w_w?: number; pct?: number; quantity?: number }) => {
        const lineId = Number(line.raw_material_id);
        const lineCode = String(line.rm_code ?? line.code ?? '').trim().toLowerCase();
        const matches = (Number.isFinite(itemId) && itemId > 0 && Number.isFinite(lineId) && lineId === itemId) || (itemCode.length > 0 && lineCode === itemCode);
        if (!matches) return sum;
        const pct = Number(line.pct_w_w ?? line.pct ?? 0);
        const qty = Number.isFinite(pct) && pct > 0 ? (sizeKg * pct) / 100 : (Number(line.quantity) || 0);
        return sum + qty;
      }, 0);
    }
    return lines.reduce<number>((sum, line: { pack_material_id?: number; pm_code?: string; code?: string; qty_per_unit?: number; quantity?: number; value?: number }) => {
      const lineId = Number(line.pack_material_id);
      const lineCode = String(line.pm_code ?? line.code ?? '').trim().toLowerCase();
      const matches = (Number.isFinite(itemId) && itemId > 0 && Number.isFinite(lineId) && lineId === itemId) || (itemCode.length > 0 && lineCode === itemCode);
      if (!matches) return sum;
      const qty = Number(line.quantity ?? line.qty_per_unit ?? line.value ?? 0) || 0;
      return sum + qty;
    }, 0);
  };

  const plannedLinesFromBackend: PlannedLine[] = useMemo(() => {
    const parseTs = (dateStr: unknown): number | null => {
      if (dateStr == null) return null;
      const s = String(dateStr).trim();
      if (!s) return null;
      const ts = Date.parse(`${s}T00:00:00Z`);
      return Number.isFinite(ts) ? ts : null;
    };

    const leadTimeDaysFromDates = (orderDate: unknown, expected: unknown): number => {
      const t1 = parseTs(orderDate);
      const t2 = parseTs(expected);
      if (t1 == null || t2 == null) return 0;
      return Math.max(0, Math.round((t2 - t1) / 86400000));
    };

    const out: PlannedLine[] = [];
    for (const po of purchaseOrders as any[]) {
      // Planning-created draft PO reference is like: "Planning PE-<planningExtractedId>"
      const ref = String(po.reference ?? '');
      const m = ref.match(/^Planning\\s+PE-(\\d+)/i);
      if (!m) continue;
      const planningExtractedId = Number(m[1]);
      if (!Number.isFinite(planningExtractedId) || planningExtractedId <= 0) continue;

      const createdAt = String(po.orderDate ?? '');
      const paymentTerms = String(po.paymentTerms ?? '');
      const vendorName = String(po.vendorName ?? '');
      const expectedShipmentDate = po.expectedShipmentDate ?? '';

      const items = Array.isArray(po.items) ? po.items : [];
      for (const itemLine of items as any[]) {
        const rawId = itemLine?.raw_material_id ?? itemLine?.rawMaterialId;
        const packId = itemLine?.pack_material_id ?? itemLine?.packMaterialId;

        const rawIdNum = rawId != null ? Number(rawId) : NaN;
        const packIdNum = packId != null ? Number(packId) : NaN;

        // Only include lines we can match to RM/PM rows from Items Involved.
        if (Number.isFinite(rawIdNum) && rawIdNum > 0) {
          const qtyNum = Number(itemLine?.quantity ?? itemLine?.qty ?? 0) || 0;
          const unitPriceNum = Number(itemLine?.rate ?? itemLine?.price ?? 0) || 0;
          out.push({
            createdAt,
            planningExtractedId,
            itemType: 'RM',
            itemId: rawIdNum,
            itemCode: '',
            itemName: '',
            vendorId: null,
            vendorName,
            moq: 0,
            qty: qtyNum,
            unitPrice: unitPriceNum,
            paymentTerms,
            leadTimeDays: leadTimeDaysFromDates(po.orderDate, expectedShipmentDate),
            unit: 'KG',
          });
        } else if (Number.isFinite(packIdNum) && packIdNum > 0) {
          const qtyNum = Number(itemLine?.quantity ?? itemLine?.qty ?? 0) || 0;
          const unitPriceNum = Number(itemLine?.rate ?? itemLine?.price ?? 0) || 0;
          out.push({
            createdAt,
            planningExtractedId,
            itemType: 'PM',
            itemId: packIdNum,
            itemCode: '',
            itemName: '',
            vendorId: null,
            vendorName,
            moq: 0,
            qty: qtyNum,
            unitPrice: unitPriceNum,
            paymentTerms,
            leadTimeDays: leadTimeDaysFromDates(po.orderDate, expectedShipmentDate),
            unit: 'PCS',
          });
        } else {
          // Fallback for partial payloads / legacy rows:
          // Accept multiple shapes: explicit code fields, or "<name> (<code>)".
          const rawName = String(itemLine?.itemName ?? itemLine?.name ?? '').trim();
          const explicitCode = String(itemLine?.itemCode ?? itemLine?.itemId ?? itemLine?.code ?? '').trim();
          const parsedCodeFromName = rawName.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() ?? '';
          const parsedCode = explicitCode || parsedCodeFromName;
          const parsedName = explicitCode
            ? rawName
            : rawName.replace(/\s*\([^)]*\)\s*$/, '').trim();
          if (!parsedCode && !parsedName) continue;

          const codeLower = parsedCode.toLowerCase();
          const itemTypeGuess: 'RM' | 'PM' =
            codeLower.includes('pm-') || codeLower.includes('ei-pm') || codeLower.includes('-pm-')
              ? 'PM'
              : (String(itemLine?.unit ?? itemLine?.uom ?? '').toUpperCase().includes('PCS') ? 'PM' : 'RM');

          const qtyNum = Number(itemLine?.quantity ?? itemLine?.qty ?? 0) || 0;
          const unitPriceNum = Number(itemLine?.rate ?? itemLine?.price ?? 0) || 0;

          out.push({
            createdAt,
            planningExtractedId,
            itemType: itemTypeGuess,
            itemId: null,
            itemCode: parsedCode,
            itemName: parsedName,
            vendorId: null,
            vendorName,
            moq: 0,
            qty: qtyNum,
            unitPrice: unitPriceNum,
            paymentTerms,
            leadTimeDays: leadTimeDaysFromDates(po.orderDate, expectedShipmentDate),
            unit: itemTypeGuess === 'RM' ? 'KG' : 'PCS',
          });
        }
      }
    }

    // Newest first (matches the old localStorage "preprend" behavior).
    out.sort((a, b) => (parseTs(b.createdAt) ?? 0) - (parseTs(a.createdAt) ?? 0));
    return out;
  }, [purchaseOrders]);

  const hasPlannedLineForItem = (item: ItemsInvolvedDisplayRow) => {
    const lines = plannedLinesFromBackend;
    return lines.some((line) => {
      if (Number(item.planningExtractedId) > 0 && Number(line.planningExtractedId) > 0 && Number(line.planningExtractedId) !== Number(item.planningExtractedId)) return false;
      return plannedLineMatchesItemsInvolvedRow(line, item);
    });
  };

  const getQuotationSlabsForItem = (item: ItemsInvolvedDisplayRow) => {
    const rid = Number(item.raw_material_id);
    const pid = Number(item.pack_material_id);
    const page: PriceListItemPage[] = item.itemType === 'PM' ? (itemsListPmPage as PriceListItemPage[]) : (itemsListRmPage as PriceListItemPage[]);
    const codeNorm = normalizeMaterialCode(String(item.code ?? '').trim().toLowerCase());

    const row =
      (item.itemType === 'RM' && Number.isFinite(rid) && rid > 0 ? page.find((p) => Number(p.raw_material_id) === rid) : null) ??
      (item.itemType === 'PM' && Number.isFinite(pid) && pid > 0 ? page.find((p) => Number(p.pack_material_id) === pid) : null) ??
      page.find((p) => normalizeMaterialCode(String(p.code ?? '').trim().toLowerCase()) === codeNorm) ??
      null;

    const vendorRates = row?.vendorRates ?? [];
    const slabs = vendorRates.flatMap((vr) => {
      const vendorName = String(vr.vendor_name ?? vr.vendor_code ?? `Vendor ${vr.vendor_id}`);
      const paymentTerms = String((vr as any).payment_terms ?? 'As per contract');
      return (vr.tiers ?? []).map((t) => ({
        vendorId: Number(vr.vendor_id) || null,
        vendorName,
        moq: Number(t.moq_min ?? 0) || 0,
        unitPrice: Number((t as any).price_per_unit ?? 0) || 0,
        leadTimeDays: Number((vr as any).lead_time_days ?? 0) || 0,
        paymentTerms,
        __source: 'items_list',
      }));
    });

    return slabs.sort((a, b) => a.vendorName.localeCompare(b.vendorName) || a.moq - b.moq || a.unitPrice - b.unitPrice);
  };

  const openReleaseToPlanningModal = (item: ItemsInvolvedDisplayRow, opts?: { preferSurplusQty?: number }) => {
    const slabs = getQuotationSlabsForItem(item);
    const first = slabs[0];
    const debugRelease =
      (typeof window !== 'undefined' && window.localStorage.getItem('eiadmin.debug.releaseToPlanning') === '1') || import.meta.env.DEV;
    if (debugRelease) {
      // eslint-disable-next-line no-console
      console.groupCollapsed('[ReleaseToPlanning] matched quote lines for item');
      // eslint-disable-next-line no-console
      console.log('item', {
        itemType: item.itemType,
        code: item.code,
        name: item.name,
        raw_material_id: item.raw_material_id ?? null,
        pack_material_id: item.pack_material_id ?? null,
      });
      // eslint-disable-next-line no-console
      const debugSlabs = slabs.map((s: any) => ({
        vendorName: s.vendorName,
        moq: s.moq,
        unitPrice: s.unitPrice,
        matchReason: s.__debugMatchReason,
        matchedQuoteLine: {
          item: s.__debugLine?.item,
          itemId: s.__debugLine?.itemId,
          raw_material_id: s.__debugLine?.raw_material_id,
          pack_material_id: s.__debugLine?.pack_material_id,
          orderQty: s.__debugLine?.orderQty,
        },
        debugQuoteSource: s.__debugQuoteSource,
      }));
      // eslint-disable-next-line no-console
      console.log('slabs-json', JSON.stringify(debugSlabs, null, 2));
      // eslint-disable-next-line no-console
      console.groupEnd();
    }
    const shortfall = Math.max(0, item.totalRequired - (item.sihNum + item.orderedQtyNum));
    const surplus = opts?.preferSurplusQty != null && opts.preferSurplusQty > 0 ? Math.round(opts.preferSurplusQty) : 0;
    const qtyStr =
      surplus > 0 ? String(surplus) : shortfall > 0 ? String(Math.round(shortfall)) : '';
    const parsedTerms = parsePaymentTermsString(first?.paymentTerms ?? 'As per contract');
    setReleaseToPlanningItem(item);
    setReleaseToPlanningForm({
      vendorId: first?.vendorId ?? null,
      vendorName: first?.vendorName ?? '',
      moq: first?.moq ?? 0,
      qty: qtyStr,
      unitPrice: first ? String(first.unitPrice) : '',
      paymentTermsType: parsedTerms.type,
      advancePercent: String(
        parsedTerms.advancePercent ||
        (paymentTermsTypeRequiresAdvancePercent(parsedTerms.type) ? 50 : 0)
      ),
      leadTimeDays: first?.leadTimeDays ?? 0,
      paymentTermsRaw: first ? String(first.paymentTerms ?? '').trim() || null : null,
    });
  };

  const addPlannedLine = async (): Promise<boolean> => {
    if (!releaseToPlanningItem) return false;
    const planningRow = releaseToPlanningItem;
    const qty = Number(releaseToPlanningForm.qty || 0);
    const unitPrice = Number(releaseToPlanningForm.unitPrice || 0);
    if (!releaseToPlanningForm.vendorName || qty <= 0 || unitPrice <= 0) {
      addToast('warning', 'Pick vendor and enter valid qty and unit price.');
      return false;
    }

    const advErr = validateAdvancePercentForType(
      releaseToPlanningForm.paymentTermsType,
      Number(releaseToPlanningForm.advancePercent)
    );
    if (advErr) {
      addToast('warning', advErr);
      return false;
    }

    const slabMoq = Number(releaseToPlanningForm.moq) || 0;
    if (slabMoq > 0 && qty + 1e-4 < slabMoq) {
      const u = planningRow.itemType === 'RM' ? 'kg' : 'pcs';
      addToast(
        'error',
        `Order quantity must be at least the selected vendor MOQ (${slabMoq} ${u}). Increase qty or pick another vendor tier.`
      );
      return false;
    }

    const vendorName = releaseToPlanningForm.vendorName.trim();
    const paymentTerms = formatPaymentTermsString(
      releaseToPlanningForm.paymentTermsType,
      Number(releaseToPlanningForm.advancePercent)
    ).trim();
    const leadTimeDays = Number(releaseToPlanningForm.leadTimeDays || 0) || 0;
    const groupKey = buildPlannedGroupKey(vendorName, paymentTerms, leadTimeDays);

    const rmId =
      planningRow.itemType === 'RM' && Number.isFinite(Number(planningRow.raw_material_id)) && Number(planningRow.raw_material_id) > 0
        ? Number(planningRow.raw_material_id)
        : undefined;
    const pmId =
      planningRow.itemType === 'PM' && Number.isFinite(Number(planningRow.pack_material_id)) && Number(planningRow.pack_material_id) > 0
        ? Number(planningRow.pack_material_id)
        : undefined;

    const newRequestItem: ProcurementRequestItem = {
      type: planningRow.itemType,
      code: planningRow.code || planningRow.name,
      name: planningRow.name,
      required: qty,
      sih: Number(planningRow.sihNum ?? 0) || 0,
      shortage: qty,
      quantity_requested: qty,
      unit: planningRow.unit || (planningRow.itemType === 'RM' ? 'KG' : 'PCS'),
      line_notes: `Planned rate ₹${unitPrice.toFixed(2)} | Terms: ${paymentTerms} | Lead: ${leadTimeDays}d`,
      planned_unit_price: unitPrice,
      ...(leadTimeDays > 0 ? { lead_time_days: leadTimeDays } : {}),
      ...(rmId != null ? { raw_material_id: rmId } : {}),
      ...(pmId != null ? { pack_material_id: pmId } : {}),
      ...(slabMoq > 0 ? { moq_min: slabMoq } : {}),
    };

    const peId = Number(planningRow.planningExtractedId);
    if (!Number.isFinite(peId) || peId <= 0) {
      addToast('error', 'Missing planning line context; cannot create procurement request.');
      return false;
    }

    const requiredByDate: string | null = null;

    const reqRes = await fetchProcurementRequests(peId);
    if (!reqRes.success || !reqRes.data) {
      addToast('error', typeof reqRes.error === 'string' ? reqRes.error : 'Failed to load procurement requests');
      return false;
    }

    const existing = reqRes.data.find((r) => {
      const sameVendor = String(r.preferredVendor ?? '').trim().toLowerCase() === vendorName.toLowerCase();
      // If the earlier request has already reached `PO Draft`, a subsequent planning release should
      // create a new request rather than consolidate (otherwise it looks like the new release was ignored).
      const openStatus = !['PO Released', 'Delivery Pending', 'Under GRN', 'PO Draft'].includes(String(r.status || ''));
      return sameVendor && openStatus;
    });

    if (existing) {
      const existingItems = Array.isArray(existing.items) ? [...existing.items] : [];
      const mergeKey = procurementItemMergeKey(newRequestItem);
      const idx = existingItems.findIndex((i) => procurementItemMergeKey(i) === mergeKey);
      let merged: ProcurementRequestItem[];
      if (idx >= 0) {
        const old = existingItems[idx];
        const qOld = Number(old.quantity_requested ?? 0) || 0;
        const qNew = qOld + qty;
        merged = [...existingItems];
        merged[idx] = {
          ...old,
          required: (Number(old.required ?? 0) || 0) + qty,
          shortage: (Number(old.shortage ?? 0) || 0) + qty,
          quantity_requested: qNew,
          line_notes: `Planned rate ₹${unitPrice.toFixed(2)} | Terms: ${paymentTerms} | Lead: ${leadTimeDays}d`,
          planned_unit_price: unitPrice,
          lead_time_days: leadTimeDays > 0 ? leadTimeDays : old.lead_time_days,
          moq_min: slabMoq > 0 ? slabMoq : old.moq_min,
        };
      } else {
        merged = [...existingItems, newRequestItem];
      }

      const upd = await updateProcurementRequest(existing.id, {
        items: merged,
        preferredVendor: vendorName,
      });
      if (!upd.success) {
        addToast('error', typeof upd.error === 'string' ? upd.error : 'Failed to update procurement request');
        return false;
      }
    } else {
      const createRes = await createProcurementRequest({
        planningExtractedId: peId,
        planningBatchId: null,
        priority: 'High',
        requiredByDate,
        notes: `Planned group: ${groupKey}`,
        items: [newRequestItem],
      });
      if (!createRes.success || !createRes.data) {
        addToast('error', typeof createRes.error === 'string' ? createRes.error : 'Failed to create procurement request');
        return false;
      }
      await updateProcurementRequest(createRes.data.id, { preferredVendor: vendorName });
    }

    await queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });

    setReleaseToPlanningItem(null);
    addToast('success', 'Added to Procurement → Requests (vendor consolidated).');
    return true;
  };

  // Warehouse inventory → Items Involved: open Release to Planning with optional surplus qty prefilled.
  useEffect(() => {
    if (activeMainTab !== 'items-involved') return;
    const st = (location.state ?? null) as {
      openReleasePlanning?: { itemType: 'RM' | 'PM'; sourceId: number; nonce: number; surplusQty?: number };
    } | null;
    const payload = st?.openReleasePlanning;
    if (!payload?.nonce) return;
    if (warehouseReleaseHandledNonceRef.current === payload.nonce) return;
    if (itemsInvolvedLoading) return;

    warehouseReleaseHandledNonceRef.current = payload.nonce;

    const { itemType, sourceId, surplusQty } = payload;
    const match = itemsInvolved.find(
      (r) =>
        r.itemType === itemType &&
        (itemType === 'RM' ? Number(r.raw_material_id) === Number(sourceId) : Number(r.pack_material_id) === Number(sourceId))
    );
    navigate(location.pathname, { replace: true, state: {} });
    if (match) {
      openReleaseToPlanningModal(match, surplusQty != null && surplusQty > 0 ? { preferSurplusQty: surplusQty } : undefined);
    } else {
      addToast('warning', 'This item is not in Items Involved yet. Confirm BOM in Plan Batches first.');
    }
    // openReleaseToPlanningModal is stable enough for this one-shot navigation; omit from deps to avoid extra runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run when items-involved data or nav state changes
  }, [activeMainTab, itemsInvolvedLoading, itemsInvolved, location.pathname, location.state, navigate]);

  const handlePlanBatches = (order: SalesOrder) => {
    setSelectedSOForBatch(order);
    setBomFormula((order.rawMaterials ?? []).map((rm) => ({ ...rm, specificGravity: (rm as RawMaterial).specificGravity ?? (rm as { specific_gravity?: number }).specific_gravity ?? 1 })));
    setBomPackaging(order.packagingMaterials);
    setIsReadyForProduction(false);
    setActiveBatchTab('batch-plan');
    setSwapSourceIndex(null);
    setNumBatches(String(order.batchesRequired || 1));
    setBatchSizeKg(order.batchSize?.replace(/\D/g, '') || '500');
    setPlannedStartDate(new Date().toISOString().split('T')[0]);
    setProductionLine('Line 1 — Primary Mixer');
    setCustomBatches([]);
    setExpandedBatchIndex(null);
    setPlanBatchesModalOpen(true);
  };

  const handleRaisePR = (order: SalesOrder, pmOnly: boolean = false) => {
    prForBatchIndexRef.current = null;
    setSelectedSO(order);
    setPrModalOpen(true);
    setPrShowPMOnly(pmOnly);
    setPrPriority('High');
    setPrRequiredByDate(order.dueDate || '');
    setPrNotes('');
  };

  /** Build PR items for a single batch and open PR modal (PR is per batch, not bulk). */
  const handleRaisePRForBatch = (order: SalesOrder, batchIndex: number) => {
    const batchSizeKg = parseFloat(order.batchSize?.replace(/\D/g, '') || '') || 500;
    const batchLen =
      order.customBatches?.length
        ? order.customBatches.length
        : order.batchCount != null && order.batchCount > 0
          ? order.batchCount
          : order.batchesRequired || 1;
    const batches = order.customBatches?.length
      ? order.customBatches
      : Array.from({ length: batchLen }, () => ({ sizeKg: batchSizeKg }));
    const sizeKgForBatch = batches[batchIndex]?.sizeKg ?? batchSizeKg;
    const scale = sizeKgForBatch / batchSizeKg;

    const rmByCode = new Map(rawMaterialsList.map((r) => [r.code?.toLowerCase() ?? '', r]));
    const pmByCode = new Map(packMaterialsList.map((p) => [p.code?.toLowerCase() ?? '', p]));
    const items: ProcurementRequestItem[] = [];
    let omitted = 0;

    for (const item of order.rawMaterials ?? []) {
      const qty = (typeof item.quantity === 'number' ? item.quantity : 0) * scale;
      const idStr = String((item as RawMaterial).code ?? item.id ?? '');
      const master = rawMaterialsList.find((r) => String(r.id) === idStr) ?? rmByCode.get(idStr.toLowerCase()) ?? rawMaterialsList.find((r) => r.code === idStr || r.name === item.name);
      if (!master) { omitted += 1; continue; }
      const raw_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
      if (raw_material_id == null || Number.isNaN(raw_material_id)) { omitted += 1; continue; }
      const wh = warehouseRows.find((r) => r.type === 'RM' && (Number(r.sourceId) === Number(raw_material_id) || r.code === master.code || r.name === master.name));
      const sih = wh?.stockInHand ?? 0;
      const shortage = Math.max(0, qty - sih);
      if (shortage <= 0) continue;
      items.push({
        type: 'RM',
        code: master.code ?? idStr,
        name: master.name ?? item.name,
        required: qty,
        sih,
        shortage,
        quantity_requested: shortage,
        unit: (item as RawMaterial).unit || 'KG',
        line_notes: '',
        raw_material_id,
      });
    }

    for (const item of order.packagingMaterials ?? []) {
      const qty = Math.ceil((typeof item.quantity === 'number' ? item.quantity : 0) * scale);
      const idStr = String((item as PackagingMaterial).code ?? item.id ?? '');
      const master = packMaterialsList.find((p) => String(p.id) === idStr) ?? pmByCode.get(idStr.toLowerCase()) ?? packMaterialsList.find((p) => p.code === idStr || p.description === item.name);
      if (!master) { omitted += 1; continue; }
      const pack_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
      if (pack_material_id == null || Number.isNaN(pack_material_id)) { omitted += 1; continue; }
      const wh = warehouseRows.find((r) => r.type === 'PM' && (Number(r.sourceId) === Number(pack_material_id) || r.code === master.code || r.name === master.description));
      const sih = wh?.stockInHand ?? 0;
      const shortage = Math.max(0, qty - sih);
      if (shortage <= 0) continue;
      items.push({
        type: 'PM',
        code: master.code ?? idStr,
        name: master.description ?? item.name,
        required: qty,
        sih,
        shortage,
        quantity_requested: shortage,
        unit: (item as PackagingMaterial).unit || 'PCS',
        line_notes: '',
        pack_material_id,
      });
    }

    const orderTotalKg = parseFloat(order.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
    const orderQtyNum = parseInt(order.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
    const kgPerUnit = orderQtyNum > 0 ? orderTotalKg / orderQtyNum : 0;
    const unitsForBatch = kgPerUnit > 0 ? Math.round(sizeKgForBatch / kgPerUnit) : sizeKgForBatch;

    setPrItems(items);
    setPrOmittedCount(omitted);
    prFromDetailShortagesRef.current = true;
    setSelectedSO(order);
    setPrPriority('High');
    setPrRequiredByDate(order.dueDate || '');
    setPrNotes(`Batch B-${String(batchIndex + 1).padStart(2, '0')} — ${unitsForBatch} units`);
    prForBatchIndexRef.current = batchIndex;
    setDetailModalOpen(false);
    setSelectedRowForDetail(null);
    setPrModalOpen(true);
  };

  /** Build PR items from PIS detail popup: only items that are short (BOM×orderQty - SIH > 0), pre-fill quantities. */
  const handleRaisePRFromDetailPopup = () => {
    if (!selectedRowForDetail) return;
    prForBatchIndexRef.current = null;
    if (detailRmItems.length === 0 && detailPmItems.length === 0) {
      setDetailModalOpen(false);
      setSelectedRowForDetail(null);
      handleRaisePR(selectedRowForDetail);
      return;
    }
    const rmByCode = new Map(rawMaterialsList.map((r) => [r.code?.toLowerCase() ?? '', r]));
    const pmByCode = new Map(packMaterialsList.map((p) => [p.code?.toLowerCase() ?? '', p]));
    const items: ProcurementRequestItem[] = [];
    let omitted = 0;

    for (const item of detailRmItems) {
      const idStr = String(item.id ?? '');
      const master =
        rawMaterialsList.find((r) => String(r.id) === idStr) ??
        rmByCode.get(idStr.toLowerCase()) ??
        rawMaterialsList.find((r) => r.code === idStr || r.name === item.name);
      if (!master) {
        omitted += 1;
        continue;
      }
      const raw_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
      if (raw_material_id == null || Number.isNaN(raw_material_id)) {
        omitted += 1;
        continue;
      }
      const wh = warehouseRows.find(
        (r) =>
          r.type === 'RM' &&
          (Number(r.sourceId) === Number(raw_material_id) || r.code === master.code || r.name === master.name)
      );
      const sih = wh?.stockInHand ?? 0;
      const required = item.quantity;
      const shortage = Math.max(0, required - sih);
      if (shortage <= 0) continue;
      items.push({
        type: 'RM',
        code: master.code ?? idStr,
        name: master.name ?? item.name,
        required,
        sih,
        shortage,
        quantity_requested: shortage,
        unit: item.unit || 'KG',
        line_notes: '',
        raw_material_id,
      });
    }

    for (const item of detailPmItems) {
      const idStr = String(item.id ?? '');
      const master =
        packMaterialsList.find((p) => String(p.id) === idStr) ??
        pmByCode.get(idStr.toLowerCase()) ??
        packMaterialsList.find((p) => p.code === idStr || p.description === item.name);
      if (!master) {
        omitted += 1;
        continue;
      }
      const pack_material_id = master.id != null ? parseInt(String(master.id), 10) : undefined;
      if (pack_material_id == null || Number.isNaN(pack_material_id)) {
        omitted += 1;
        continue;
      }
      const wh = warehouseRows.find(
        (r) =>
          r.type === 'PM' &&
          (Number(r.sourceId) === Number(pack_material_id) ||
            r.code === master.code ||
            r.name === master.description)
      );
      const sih = wh?.stockInHand ?? 0;
      const required = item.quantity;
      const shortage = Math.max(0, required - sih);
      if (shortage <= 0) continue;
      items.push({
        type: 'PM',
        code: master.code ?? idStr,
        name: master.description ?? item.name,
        required,
        sih,
        shortage,
        quantity_requested: shortage,
        unit: item.unit || 'PCS',
        line_notes: '',
        pack_material_id,
      });
    }

    setPrItems(items);
    setPrOmittedCount(omitted);
    prFromDetailShortagesRef.current = true;
    setSelectedSO(selectedRowForDetail);
    setPrModalOpen(true);
    setPrShowPMOnly(false);
    setPrPriority('High');
    setPrRequiredByDate(selectedRowForDetail.dueDate || '');
    setPrNotes('');
    setDetailModalOpen(false);
    setSelectedRowForDetail(null);
  };

  const handleSendToProcurement = async () => {
    if (!selectedSO) return;
    const validItems = prItems.filter((i) => i.raw_material_id != null || i.pack_material_id != null || i.product_id != null);
    if (validItems.length === 0) {
      addToast('error', 'Select at least one item (RM/PM/FG) per line. Use the item dropdown to link to master data.');
      return;
    }
    const batchIndex = prForBatchIndexRef.current;
    prForBatchIndexRef.current = null;
    let planningBatchId: number | undefined;
    if (batchIndex !== null) {
      const batches = await fetchPlanningBatches(selectedSO.id);
      const batch = batches[batchIndex];
      planningBatchId = batch?.id;
    }
    setPrSending(true);
    try {
      const res = await createProcurementRequest({
        planningExtractedId: parseInt(selectedSO.id, 10),
        planningBatchId: planningBatchId ?? null,
        priority: prPriority,
        requiredByDate: prRequiredByDate || selectedSO.dueDate || new Date().toISOString().slice(0, 10),
        notes: prNotes,
        items: validItems,
      });
      if (res.success && res.data) {
        addToast('success', `PR for SO #${selectedSO.soNumber} saved. Reflected in Planning tab stats and in Procurement - Requests.`);
        queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
        queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
        setPrModalOpen(false);
        setSelectedSO(null);
        setPrItems([]);
        setPrPriority('High');
        setPrRequiredByDate('');
        setPrNotes('');
        setPrShowPMOnly(false);
      } else {
        addToast('error', typeof res.error === 'string' ? res.error : 'Failed to create procurement request');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send PR to Procurement';
      addToast('error', errorMessage);
      console.error('Error sending to procurement:', error);
    } finally {
      setPrSending(false);
    }
  };

  const updatePrItem = (index: number, updates: Partial<ProcurementRequestItem>) => {
    setPrItems((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const addPrLine = () => {
    setPrItems((prev) => [
      ...prev,
      {
        type: 'RM',
        code: '',
        name: '',
        required: 0,
        sih: 0,
        shortage: 0,
        quantity_requested: 0,
        unit: 'KG',
        raw_material_id: undefined,
        pack_material_id: undefined,
        product_id: undefined,
      },
    ]);
  };

  const removePrLine = (index: number) => {
    setPrItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveBatchPlan = async () => {
    if (!selectedSOForBatch) return;
    try {
      await updatePlanningExtracted(selectedSOForBatch.id, {
        batchCount: customBatches.length || parseInt(numBatches, 10) || 0,
        batchSizeKg: customBatches.length > 0 ? customBatches[0].sizeKg : (parseFloat(batchSizeKg) || 500),
        plannedStartDate: plannedStartDate || undefined,
        productionLine: productionLine || undefined,
        customBatches: customBatches.length > 0 ? customBatches : undefined,
      });
      if (customBatches.length > 0) {
        await createOrUpdatePlanningBatches(selectedSOForBatch.id, customBatches);
      }
      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
      queryClient.invalidateQueries({ queryKey: ['planning-batches', selectedSOForBatch.id] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
      addToast('success', 'Batch plan saved. Each batch has its own BOM copy for reuse.');
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save batch plan');
    }
  };

  const handleConfirmBOM = async () => {
    if (!selectedSOForBatch) return;
    if (!canConfirmBomPerBatch) {
      addToast('error', 'Add at least one raw material or packaging line to the BOM before confirming.');
      return;
    }
    const rmLines: BOMRmLine[] = bomFormula.map((item) => ({
      phase: item.phase ?? 'Phase A',
      inci_name: item.name,
      rm_code: item.code ?? item.id,
      pct_w_w: item.percentage,
      uom: item.unit || 'kg',
      specific_gravity: item.specificGravity ?? 1,
      ...(typeof item.id === 'string' && /^\d+$/.test(item.id) ? { raw_material_id: parseInt(item.id, 10) } : {}),
    }));
    const pmLines: BOMPmLine[] = bomPackaging.map((item) => ({
      pm_code: item.code ?? item.id,
      description: item.name,
      pack_type: 'Primary',
      qty_per_unit: item.value,
      uom: 'pc/unit',
    }));

    try {
      if (selectedBatchId != null) {
        const saved = await updatePlanningBatch(selectedSOForBatch.id, selectedBatchId, { rmLines, pmLines });
        if (!saved) {
          addToast('error', 'Failed to save BOM for this batch');
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['planning-batch', selectedSOForBatch.id, selectedBatchId] });
        queryClient.invalidateQueries({ queryKey: ['planning-batches', selectedSOForBatch.id] });
      } else {
        const saved = await putBomOverride(selectedSOForBatch.id, { rmLines, pmLines });
        if (!saved) {
          addToast('error', 'Failed to save custom BOM for this SO');
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['planning-bom-override', selectedSOForBatch.id] });
      }
      const confirmed = await updatePlanningExtracted(selectedSOForBatch.id, {
        bomConfirmedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
      if (!confirmed) {
        addToast('error', 'Failed to confirm BOM. Check stock and try again.');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
      addToast('success', `BOM confirmed for ${selectedSOForBatch.productName}. Go to Batch Plan to set batches and schedule.`);
      setIsReadyForProduction(true);
      setActiveBatchTab('batch-plan');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to confirm BOM';
      addToast('error', errorMessage);
      console.error('Error confirming BOM:', error);
    }
  };

  const handleSendToProduction = async () => {
    if (!selectedSOForBatch || !canSendToProduction) return;
    // Send only the batch currently selected in the top dropdown (the one the user is viewing), not all checked boxes
    const selectedIndex = selectedBatchId != null && planningBatches.length > 0
      ? (planningBatches as PlanningBatchRow[]).findIndex((b) => Number(b.id) === Number(selectedBatchId))
      : -1;
    const toSend = selectedIndex >= 0 && selectedIndex < customBatches.length ? [selectedIndex] : [];
    if (toSend.length === 0) {
      addToast('info', 'Select a batch in the dropdown above (e.g. B-01) to send that batch to Production.');
      return;
    }
    const alreadySent = (selectedSOForBatch.sentBatchIndices ?? []).includes(toSend[0]);
    if (alreadySent) {
      addToast('info', `B-${String(toSend[0] + 1).padStart(2, '0')} is already sent to Production.`);
      return;
    }
    const mergedSent = [...new Set([...(selectedSOForBatch.sentBatchIndices ?? []), ...toSend])].sort((a, b) => a - b);
    try {
      await updatePlanningExtracted(selectedSOForBatch.id, {
        batchCount: customBatches.length || parseInt(numBatches, 10) || 0,
        batchSizeKg: customBatches.length > 0 ? customBatches[0].sizeKg : (parseFloat(batchSizeKg) || 500),
        plannedStartDate: plannedStartDate || undefined,
        productionLine: productionLine || undefined,
        bomStatus: 'Production Released',
        customBatches: customBatches.length > 0 ? customBatches : undefined,
        sentBatchIndices: mergedSent,
      });
      if (customBatches.length > 0) {
        await createOrUpdatePlanningBatches(selectedSOForBatch.id, customBatches);
      }
      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
      queryClient.invalidateQueries({ queryKey: ['planning-batches', selectedSOForBatch.id] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
      queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });
      addToast('success', `${toSend.length} batch${toSend.length !== 1 ? 'es' : ''} sent to Production`);
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save');
    }
    setPlanBatchesModalOpen(false);
    setSelectedSOForBatch(null);
    setBomFormula([]);
    setBomPackaging([]);
    setActiveBatchTab('batch-plan');
    setNumBatches('1');
    setBatchSizeKg('500');
    setPlannedStartDate(new Date().toISOString().split('T')[0]);
    setProductionLine('Line 1 — Primary Mixer');
    setIsReadyForProduction(false);
    setCustomBatches([]);
    setExpandedBatchIndex(null);
    setSelectedBatchId(null);
  };

  /** Send selected batch to Production (toolbar on Batch Plan tab or legacy callers). */
  const handleSendBatchToProductionIndividually = async (batchIndex: number) => {
    if (!selectedSOForBatch || !canSendToProduction) return;
    if (!Number.isFinite(batchIndex) || batchIndex < 0) return;
    if (!customBatches || batchIndex >= customBatches.length) return;

    const alreadySent = (selectedSOForBatch.sentBatchIndices ?? []).includes(batchIndex);
    if (alreadySent) {
      addToast('info', `B-${String(batchIndex + 1).padStart(2, '0')} is already sent to Production.`);
      return;
    }

    const mergedSent = [...new Set([...(selectedSOForBatch.sentBatchIndices ?? []), batchIndex])].sort((a, b) => a - b);
    try {
      await updatePlanningExtracted(selectedSOForBatch.id, {
        batchCount: customBatches.length || parseInt(numBatches, 10) || 0,
        batchSizeKg: customBatches.length > 0 ? customBatches[0].sizeKg : (parseFloat(batchSizeKg) || 500),
        plannedStartDate: plannedStartDate || undefined,
        productionLine: productionLine || undefined,
        bomStatus: 'Production Released',
        customBatches: customBatches.length > 0 ? customBatches : undefined,
        sentBatchIndices: mergedSent,
      });

      if (customBatches.length > 0) {
        await createOrUpdatePlanningBatches(selectedSOForBatch.id, customBatches);
      }

      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
      queryClient.invalidateQueries({ queryKey: ['planning-batches', selectedSOForBatch.id] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
      queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });

      addToast('success', `B-${String(batchIndex + 1).padStart(2, '0')} sent to Production`);
      setSelectedSOForBatch((prev) => (prev ? { ...prev, sentBatchIndices: mergedSent, bomStatus: 'Production Released' } : prev));
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to send to Production');
    }
  };

  // const handleRaisePRFromBatch = () => {
  //   if (selectedSOForBatch) {
  //     prForBatchIndexRef.current = null;
  //     prFromBatchShortagesRef.current = true;
  //     setPlanBatchesModalOpen(false);
  //     setSelectedSO(selectedSOForBatch);
  //     setPrModalOpen(true);
  //     setPrShowPMOnly(false);
  //     setPrPriority('High');
  //     setPrRequiredByDate(selectedSOForBatch.dueDate || '');
  //     setPrNotes('');
  //   }
  // };

  const swapCategories = useMemo(() => {
    if (itemGroupsRm.length > 0) {
      return itemGroupsRm.map((grp) => ({
        name: grp.name,
        items: (grp.approvedMembers ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          code: m.code,
          description: grp.description || '',
          status: bomFormula.some((f) => f.code === m.code || f.name === m.name) ? 'IN BOM' : 'AVAILABLE',
          inBom: bomFormula.some((f) => f.code === m.code || f.name === m.name),
        })),
      }));
    }
    return [{
      name: 'Raw materials',
      items: rawMaterialsList.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        description: r.inci || '',
        status: bomFormula.some((f) => f.code === r.code || f.name === r.name) ? 'IN BOM' : 'AVAILABLE',
        inBom: bomFormula.some((f) => f.code === r.code || f.name === r.name),
      })),
    }];
  }, [itemGroupsRm, rawMaterialsList, bomFormula]);

  const handleQuickAddRM = () => {
    if (!quickAddInciName || !quickAddPercentage) {
      addToast('error', 'INCI name and % are required');
      return;
    }
    const pct = parseFloat(quickAddPercentage);
    if (Number.isNaN(pct) || pct <= 0) {
      addToast('error', 'Enter a valid percentage');
      return;
    }
    const rm = rawMaterialsList.find((r) => r.code === quickAddRmCode || r.name.toLowerCase().includes(quickAddInciName.trim().toLowerCase()));
    const code = rm?.code ?? (quickAddRmCode?.trim() || `RM-${Date.now()}`);
    const newItem: RawMaterial = {
      id: rm?.id ?? `custom-${Date.now()}`,
      name: quickAddInciName.trim(),
      quantity: 0,
      unit: 'KG',
      percentage: pct,
      code,
      phase: 'Phase A',
      specificGravity: 1,
    };
    setBomFormula([...bomFormula, newItem]);
    setQuickAddRmCode('');
    setQuickAddInciName('');
    setQuickAddPercentage('');
    addToast('success', `Added ${newItem.name} at ${pct}%`);

    addToast('success', `${quickAddInciName} (${quickAddPercentage}%) added to Formula BOM`);
  };

  const _handleSendToProductionFromCard = async (order: SalesOrder) => {
    if (order.bomStatus !== 'Production Ready' || productionSentOrderIds.includes(order.id)) return;

    try {
      await updatePlanningExtracted(order.id, { bomStatus: 'Production Released' });
      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
      if (selectedSOForBatch?.id === order.id) {
        setSelectedSOForBatch({ ...selectedSOForBatch, bomStatus: 'Production Released' });
      }
      setProductionSentOrderIds((prev) => [...prev, order.id]);
      addToast('success', `${order.productName} sent to Production`);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to send to Production');
    }
  };

  const _getStatusColor = (status: string) => {
    switch (status) {
      case 'Production Released':
        return 'bg-teal-100 text-teal-700';
      case 'In Progress':
        return 'bg-blue-100 text-blue-700';
      case 'Planned':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Production Released':
        return 'bg-emerald-100 text-emerald-700';
      case 'Production Ready':
        return 'bg-green-100 text-green-700';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Planning</h1>
            <p className="text-sm text-gray-500">Production Planning Hub</p>
          </div>
          {/* <button
            onClick={() => {
              try {
                const list = pisRows.length > 0 ? pisRows : salesOrders;
                if (list.length > 0) {
                  handleRaisePR(list[0], false);
                } else {
                  addToast('warning', 'No sales orders available to raise PR');
                }
              } catch (_error) {
                addToast('error', 'Error opening PR modal');
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-full font-medium transition-colors"
          >
            Raise PR
          </button> */}
        </div>

        {/* Status Badges */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium">
            {pisRows.length} Active SOs
          </div>
          <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
            {tabStats['pis-extracted'].shortages} Shortages
          </div>
          <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
            {tabStats['items-involved'].prsRaised} PRs Raised
          </div>
          <div className="text-gray-500 text-sm ml-auto">Planning: Feb 2026</div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          {activeMainTab === 'items-involved' ? (
            <>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">CONFIRMED PRODUCTS</p>
                <p className="text-2xl font-bold text-emerald-600">{(currentStats as PlanningTabStats).confirmedProducts.value}</p>
                <p className="text-xs text-gray-500 mt-1">of {(currentStats as PlanningTabStats).confirmedProducts.total} total</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">RM ITEMS</p>
                <p className="text-2xl font-bold text-cyan-600">{(currentStats as PlanningTabStats).rmItems.value}</p>
                <p className="text-xs text-gray-500 mt-1">{(currentStats as PlanningTabStats).rmItems.ok} OK, {(currentStats as PlanningTabStats).rmItems.short} short</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">PM ITEMS</p>
                <p className="text-2xl font-bold text-purple-600">{(currentStats as PlanningTabStats).pmItems.value}</p>
                <p className="text-xs text-gray-500 mt-1">{(currentStats as PlanningTabStats).pmItems.ok} OK, {(currentStats as PlanningTabStats).pmItems.short} short</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">RM SHORTAGES</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as PlanningTabStats).rmShortages}</p>
                <p className="text-xs text-gray-500 mt-1">Items below order req</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">PM SHORTAGES</p>
                <p className="text-2xl font-bold text-red-600">{(currentStats as PlanningTabStats).pmShortages}</p>
                <p className="text-xs text-gray-500 mt-1">Items below order req</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">PRS RAISED</p>
                <p className="text-2xl font-bold text-orange-600">{(currentStats as PlanningTabStats).prsRaised}</p>
                <p className="text-xs text-gray-500 mt-1">Pending procurement</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">TOTAL SOS</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as PlanningTabStats).totalSOs}</p>
                <p className="text-xs text-gray-500 mt-1">Approved orders</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">PROD. RELEASED</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as PlanningTabStats).prodReleased}</p>
                <p className="text-xs text-gray-500 mt-1">Ready to plan</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">RM/PM SHORTAGES</p>
                <p className="text-2xl font-bold text-orange-600">{(currentStats as PlanningTabStats).shortages}</p>
                <p className="text-xs text-gray-500 mt-1">needs below order req</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">BATCHES REQUIRED</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as PlanningTabStats).batchesRequired}</p>
                <p className="text-xs text-gray-500 mt-1">Across all products</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">BATCHES CONFIRMED</p>
                <p className="text-2xl font-bold text-gray-900">{(currentStats as PlanningTabStats).batchesConfirmed}</p>
                <p className="text-xs text-gray-500 mt-1">BOM confirmed & planned</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">SO VALUE</p>
                <p className="text-2xl font-bold text-orange-600">{(currentStats as PlanningTabStats).soValue}</p>
              </div>
            </>
          )}
        </div>

        {/* Main Tabs Navigation — each tab is a sub-route */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <NavLink
            to="/planning/pis-extracted"
            className={({ isActive }) =>
              `px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${isActive ? 'text-emerald-700 border-emerald-700' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`
            }
          >
            PIs Extracted
          </NavLink>
          <NavLink
            to="/planning/batches"
            className={({ isActive }) =>
              `px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${isActive ? 'text-emerald-700 border-emerald-700' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`
            }
          >
            Batches
          </NavLink>
          <NavLink
            to="/planning/items-involved"
            className={({ isActive }) =>
              `px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${isActive ? 'text-emerald-700 border-emerald-700' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`
            }
          >
            Items Involved
          </NavLink>
        </div>

        {/* PIs Extracted Tab Content */}
        {activeMainTab === 'pis-extracted' && (
          <>
            {/* Order Management Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Order Management</h2>
                <div className="text-xs text-gray-500 mt-0.5">Client PO → Internal SO → Ordered Products → Items involved (syncs to procurement)</div>
              </div>
            </div>
            {/* Tabs and Filter */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600 font-medium">STATUS:</span>
                {['All', 'Prod Released', 'In Progress', 'Planned'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${statusFilter === status
                      ? 'bg-white text-gray-800 border border-gray-300 shadow-xs'
                      : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                      }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 mt-4">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search product, SO, client"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 outline-none text-sm"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')}>
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* PIs Extracted: list from API; row click opens detail popup */}
            {planningLoading && (
              <div className="py-8 text-center text-gray-500">Loading…</div>
            )}
            {!planningLoading && filteredPisOrders.length === 0 && (
              <div className="py-8 text-center text-gray-500 border border-gray-200 rounded-lg bg-white">No PRs extracted. Create SOs and they will appear here.</div>
            )}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[820px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">SO No</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Client</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Units</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Due</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">MFG Records</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPisOrders.map((order) => {
                      const todayISO = new Date().toISOString().slice(0, 10);
                      const dueToday = order.dueDate === todayISO;
                      const orderDateDisplay = (() => {
                        const d = order.orderDate ? new Date(order.orderDate) : null;
                        if (!d || Number.isNaN(d.getTime())) return '—';
                        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      })();
                      const dueDateDisplay = (() => {
                        const d = order.dueDate ? new Date(order.dueDate) : null;
                        if (!d || Number.isNaN(d.getTime())) return order.dueDate ?? '—';
                        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      })();

                      const dueTagBg = dueToday ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200';

                      const customerTag = order.bomStatus === 'Planned'
                        ? { text: 'Planned', dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-700 border-gray-200' }
                        : order.bomStatus === 'In Progress'
                          ? { text: 'In Production', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800 border-amber-200' }
                          : { text: 'Confirmed', dot: 'bg-green-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' };

                      // MFG records from production batches for this SO number.
                      const prodForSo = (productionBatches as BatchRow[])
                        .filter((b) => String(b.soNo ?? '').trim() === String(order.soNumber ?? '').trim());
                      const bmrCount = prodForSo.filter((b) => (b.bmrNo ?? '').toString().trim() !== '').length;
                      const bprCount = prodForSo.filter((b) => (b.bprNo ?? '').toString().trim() !== '').length;

                      const res =
                        planningAvailabilityBySoNo[order.soNumber] ??
                        planningAvailabilityBySoNo[normalizeSoKey(order.soNumber)];
                      const availItems = res?.items ?? [];
                      const availabilityItem: SoPlanningAvailabilityItem | null =
                        availItems.find((it) => String(it.sku || '').trim() === String(order.productCode || '').trim()) ??
                        availItems.find((it) => String(it.productName || '').trim() === String(order.productName || '').trim()) ??
                        (availItems.length === 1 ? availItems[0] : null);
                      const availabilityTier = getPisAvailabilityTier(availabilityItem, planningAvailabilityLoading);

                      return (
                        <tr
                          key={order.id}
                          onClick={() => openDetailModal(order)}
                          className={pisAvailabilityRowClass(availabilityTier)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-mono font-semibold text-gray-900">{order.soNumber}</div>
                            <div className="text-xs text-gray-500">{orderDateDisplay}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{order.customerName ?? '—'}</div>
                            <div className="text-xs text-gray-700">{order.productName ?? order.productCode ?? '—'}</div>
                            <div className="text-xs text-gray-500">{order.soStatus ?? '—'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{order.orderQty}</div>
                            <div className="text-xs text-gray-500">{order.totalKg} total</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded text-[11px] font-semibold border ${customerTag.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${customerTag.dot}`} />
                              {customerTag.text}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {dueToday ? (
                              <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded text-[11px] font-semibold border ${dueTagBg}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                Today
                                <span className="text-xs text-gray-500 border-l pl-2 border-gray-200">{dueDateDisplay}</span>
                              </span>
                            ) : (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-600">{order.daysLeft}</span>
                                <span className="text-xs text-gray-500">Due {dueDateDisplay}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {bmrCount} BMR · {bprCount} BPR
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetailModal(order);
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold"
                            >
                              Open →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detail popup: full order details, RM/PM, Plan Batches & Raise PR */}
            {detailModalOpen && selectedRowForDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeDetailModal}>
                <div
                  className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">{selectedRowForDetail.productName}</h2>
                    <button type="button" onClick={closeDetailModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6 pb-4 border-b border-gray-200 text-center">
                      {[
                        ['SO Number', selectedRowForDetail.soNumber],
                        ['Order Qty', selectedRowForDetail.orderQty],
                        ['Total KG', selectedRowForDetail.totalKg],
                        ['Order Date', selectedRowForDetail.orderDate],
                        ['Due Date', selectedRowForDetail.dueDate],
                        ['Days Left', selectedRowForDetail.daysLeft],
                        // ['Batch Size', selectedRowForDetail.batchSize],
                        // ['Batches Required', `${selectedRowForDetail.batchesRequired} batches`],
                        ['BOM Status', selectedRowForDetail.bomStatus],
                        ['Approved By', selectedRowForDetail.approvedBy],
                      ].map(([label, value]) => (
                        <div key={String(label)}>
                          <p className="text-xs text-gray-500 font-medium uppercase mb-1">{label}</p>
                          <p className="text-sm font-semibold text-gray-900">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        {selectedRowForDetail.batchesRequired} batches required
                      </p>
                      <button
                        type="button"
                        onClick={() => { handlePlanBatches(selectedRowForDetail); closeDetailModal(); }}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
                      >
                        Plan Batches & Confirm BOM
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center text-sm">
                          <span className="w-2.5 h-2.5 bg-teal-500 rounded-full mr-2" />
                          RM — {(detailRmItems.length > 0 ? detailRmItems : selectedRowForDetail.rawMaterials).length} items
                          {detailRmItems.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-gray-500">(BOM × order qty)</span>
                          )}
                        </h4>
                        <div className="space-y-3">
                          {(detailRmItems.length > 0 ? detailRmItems : selectedRowForDetail.rawMaterials).map((item) => (
                            <div key={item.id} className="flex flex-col">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                                <span className="text-sm text-teal-600 font-semibold shrink-0">
                                  {typeof item.quantity === 'number' ? Number(item.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : item.quantity} {item.unit}
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-500 rounded-full" style={{ width: '100%' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center text-sm">
                          <span className="w-2.5 h-2.5 bg-orange-500 rounded-full mr-2" />
                          PM — {(detailPmItems.length > 0 ? detailPmItems : selectedRowForDetail.packagingMaterials).length} items
                          {detailPmItems.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-gray-500">(BOM × order qty)</span>
                          )}
                        </h4>
                        <div className="space-y-3">
                          {(detailPmItems.length > 0 ? detailPmItems : selectedRowForDetail.packagingMaterials).map((item) => (
                            <div key={item.id} className="flex flex-col">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                                <span className="text-sm text-orange-600 font-semibold shrink-0">
                                  {typeof item.quantity === 'number' ? Number(item.quantity).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : item.quantity} {item.unit}
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500 rounded-full" style={{ width: '100%' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-gray-500">
                        Approved by <span className="font-semibold text-gray-700">{selectedRowForDetail.approvedBy}</span>
                      </p>
                      {/* <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRaisePRFromDetailPopup()}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200"
                        >
                          Raise PR
                        </button>
                        <button
                          type="button"
                          onClick={() => { handlePlanBatches(selectedRowForDetail); closeDetailModal(); }}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
                        >
                          Plan Batches
                        </button>
                      </div> */}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </>
        )}

        {activeMainTab === 'items-involved' && (
          <div className="space-y-4">
            {/* Filters Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="font-medium text-sm text-gray-600">CATEGORY:</span>
                {(['all', 'RM', 'PM', 'shortage', 'available'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setItemsInvolvedCategoryFilter(key)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${itemsInvolvedCategoryFilter === key
                      ? key === 'shortage'
                        ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                        : key === 'available'
                          ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                          : 'bg-slate-200 text-slate-800 ring-1 ring-slate-400'
                      : key === 'shortage'
                        ? 'bg-gray-100 text-gray-600 hover:bg-red-50'
                        : key === 'available'
                          ? 'bg-gray-100 text-gray-600 hover:bg-green-50'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {key === 'all' ? 'All' : key === 'shortage' ? 'Shortage' : key === 'available' ? 'Available' : key}
                  </button>
                ))}
                <select
                  value={itemsInvolvedProductFilter}
                  onChange={(e) => setItemsInvolvedProductFilter(e.target.value)}
                  className="px-3 py-1 rounded text-sm border border-gray-300 text-gray-700 bg-white"
                >
                  <option value="all">All Products</option>
                  {itemsInvolvedProductOptions.filter((p) => p !== 'all').map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search item, code, INCI..."
                  value={itemsInvolvedSearchTerm}
                  onChange={(e) => setItemsInvolvedSearchTerm(e.target.value)}
                  className="flex-1 outline-none text-sm border border-gray-200 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto w-full">
              {itemsInvolvedLoading && (
                <div className="p-8 text-center text-gray-500 text-sm">Loading items from confirmed BOMs…</div>
              )}
              {!itemsInvolvedLoading && itemsInvolved.length === 0 && (
                <div className="p-12 text-center border border-dashed border-gray-200 rounded-lg">
                  <div className="text-4xl mb-2">⧖</div>
                  <div className="font-semibold text-gray-700 mb-1">No confirmed batches</div>
                  <div className="text-sm text-gray-500">Confirm BOM in Plan Batches (PRs Extracted) to see RM/PM items here.</div>
                </div>
              )}
              {!itemsInvolvedLoading && itemsInvolved.length > 0 && filteredItemsInvolved.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm border border-dashed border-gray-200 rounded-lg">
                  No items match the current filters or search. Try changing category, product, or search term.
                </div>
              )}
              {!itemsInvolvedLoading && itemsInvolved.length > 0 && filteredItemsInvolved.length > 0 && (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">ITEM / INCI</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">CODE</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">CAT</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">USED IN</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">
                        <span className="block">TOTAL REQ</span>
                        <span className="block text-[9px] font-normal text-gray-500">RM · kg · PM · pcs</span>
                      </th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">STOCK IN HAND</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">RESERVED</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">PLANNED QTY</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">IN TRANSIT</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">REORDER PT</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">AVG/MO</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">QC / STATUS</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">NET</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">COVERAGE</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">WH BATCHES</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">EXPIRY</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">BOM FLAG</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItemsInvolved.map((item, idx) => (
                      (() => {
                        // Release opens procurement when NET is negative (free SIH + in-transit < required). Not used for BMR — use Plan Batches → Production after stock is covered.
                        const hasShortfall = item.netNum < 0;
                        const hasExistingPlannedLine = hasPlannedLineForItem(item);
                        const canReleaseToPlanning = hasShortfall;
                        return (
                          <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-2 py-2">
                              <div className="text-gray-900 font-medium text-xs">{item.name}</div>
                              {item.itemType === 'PM' && <div className="text-xs text-gray-500">Primary A</div>}
                            </td>
                            <td className="px-2 py-2">
                              <span className="text-blue-600 font-medium text-xs">{item.code}</span>
                            </td>
                            <td className="px-2 py-2">
                              <span className={`text-xs font-semibold px-1 py-0.5 rounded ${item.itemType === 'PM'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-cyan-100 text-cyan-700'
                                }`}>
                                {item.itemType}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => setUsedInModalItem(item)}
                                className="w-5 h-5 bg-pink-100 hover:bg-pink-200 rounded-full flex items-center justify-center mx-auto transition-colors"
                                title="Click to view batches using this item"
                              >
                                <span className="text-xs font-bold text-pink-700">{item.usedIn}</span>
                              </button>
                            </td>
                            <td className="px-2 py-2 text-right text-gray-900 text-xs">{item.totalReq}</td>
                            <td className="px-2 py-2 text-right text-orange-600 font-medium text-xs">{item.sih}</td>
                            <td className="px-2 py-2 text-right text-amber-700 text-xs">{item.reserved}</td>
                            <td className="px-2 py-2 text-right text-blue-700 text-xs">{item.plannedQty}</td>
                            <td className="px-2 py-2 text-right text-rose-600 text-xs">{item.inTransit}</td>
                            <td className="px-2 py-2 text-right text-gray-600 text-xs">{item.reorderPt}</td>
                            <td className="px-2 py-2 text-right text-gray-600 text-xs">{item.avgMo}</td>
                            <td className="px-2 py-2 text-center">
                              {item.status === 'In Stock' && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">In Stock</span>}
                              {item.status === 'Low Stock' && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">Low Stock</span>}
                              {item.status === 'Critical' && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">Critical</span>}
                              {item.status === 'Out of Stock' && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded">Out of Stock</span>}
                              {item.status && !['In Stock', 'Low Stock', 'Critical', 'Out of Stock'].includes(item.status) && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded">{item.status}</span>}
                            </td>
                            <td className={`px-2 py-2 text-right font-semibold text-xs ${item.netNum < 0 ? 'text-red-600' : 'text-green-600'
                              }`}>
                              {item.net}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <div className={`h-1.5 rounded-sm w-10 ${item.coverage === '100%' ? 'bg-green-500' : 'bg-orange-400'
                                  }`}></div>
                                <span className="text-xs font-semibold text-gray-700">{item.coverage}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-gray-900 text-xs">{item.whBatches}</td>
                            <td className="px-2 py-2 text-center text-gray-600 text-xs">{item.expiry}</td>
                            <td className="px-2 py-2 text-center text-gray-500 text-xs">{item.bomFlag}</td>
                            <td className="px-2 py-2 text-center">
                              <div className="flex flex-col items-center gap-1 min-w-[7rem]">
                                {hasShortfall && hasExistingPlannedLine && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    title="At least one planned line exists for this item; you can add another release."
                                  >
                                    Planned line
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={!canReleaseToPlanning}
                                  title={
                                    canReleaseToPlanning
                                      ? undefined
                                      : 'No planning shortage: NET (free stock + in transit − required) is ≥ 0. You do not need Release here. For vendor quotes without a shortage, use Procurement / Items List. BMR: confirm batches and send to Production — not gated by this button.'
                                  }
                                  onClick={() => openReleaseToPlanningModal(item)}
                                >
                                  Release to Planning
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })()
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Batches Tab — list all batches we've sent out (batch code, SO, product, sent status, BOM summary) */}
        {activeMainTab === 'batches' && <PlanningBatchesTab onBatchClick={setBatchForDetailModal} />}

      </div>

      {/* Used In popup: list all batches (sent + draft) that consume selected RM/PM */}
      {usedInModalItem && (() => {
        const rows = getUsedInBatchesForItem(usedInModalItem);
        return (
          <div className="fixed inset-0 z-95 bg-black/35 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-xl border border-gray-200 max-h-[85vh] overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Batches using {usedInModalItem.code}</h3>
                  <p className="text-xs text-gray-500 mt-1">{usedInModalItem.name} ({usedInModalItem.itemType})</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUsedInModalItem(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 overflow-auto max-h-[70vh]">
                {rows.length === 0 ? (
                  <div className="text-sm text-gray-500 p-6 text-center">No batches found for this item.</div>
                ) : (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Batch Code</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">SO</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Product</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Batch Size</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Required ({usedInModalItem.unit})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={`${row.id}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 text-gray-900">{row.batchCode ?? `B-${idx + 1}`}</td>
                          <td className="px-3 py-2 text-gray-700">{row.soNumber ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{row.productName ?? row.productCode ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{(Number(row.sizeKg) || 0).toLocaleString()} KG</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">
                            {Math.round(getItemRequiredInBatch(usedInModalItem, row)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Release to Planned modal */}
      {releaseToPlanningItem && (() => {
        const item = releaseToPlanningItem;
        const slabs = getQuotationSlabsForItem(item);
        const vendorOptions = Array.from(new Set(slabs.map((s) => s.vendorName)));
        const previous = plannedLinesFromBackend
          .filter((l) => {
            if (Number(item.planningExtractedId) > 0 && Number(l.planningExtractedId) > 0 && Number(l.planningExtractedId) !== Number(item.planningExtractedId)) {
              return false;
            }
            return plannedLineMatchesItemsInvolvedRow(l, item);
          })
          .slice(0, 10);
        const shortfall = Math.max(0, item.totalRequired - (item.sihNum + item.orderedQtyNum));
        const releasePtStages = resolveStagedPaymentTermsForForm(
          releaseToPlanningForm.paymentTermsRaw,
          releaseToPlanningForm.paymentTermsType,
          Number(releaseToPlanningForm.advancePercent)
        );
        return (
          <div className="fixed inset-0 z-95 bg-black/35 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl rounded-xl shadow-xl border border-gray-200 max-h-[92vh] overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Release to PO Planned Stage</h2>
                  <p className="text-xs text-slate-600 mt-0.5">Pick vendor & MOQ price, choose qty, set payment terms. Creates planned lines grouped by vendor.</p>
                </div>
                <button type="button" onClick={() => setReleaseToPlanningItem(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">Close</button>
              </div>
              <div className="p-5 overflow-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="font-bold text-slate-900 text-sm mb-1">{item.name} <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{item.code}</span></h3>
                    <p className="text-xs text-slate-500 mb-3">{item.itemType} · {item.unit} · Gap {Math.round(shortfall).toLocaleString()} {item.unit}</p>
                    <div className="border-t border-slate-200 my-3" />
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200">
                          <th className="text-left py-2 font-medium">Vendor</th>
                          <th className="text-left py-2 font-medium">MOQ</th>
                          <th className="text-right py-2 font-medium">Unit ₹</th>
                          <th className="text-right py-2 font-medium">Lead</th>
                          <th className="text-left py-2 font-medium min-w-[8rem]">Terms</th>
                          <th className="w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {slabs.map((s, i) => (
                          <tr key={`${s.vendorName}-${s.moq}-${s.unitPrice}-${i}`} className="border-b border-slate-100">
                            <td className="py-2 font-medium text-slate-900">{s.vendorName}</td>
                            <td className="py-2 text-slate-700">{s.moq || '—'}</td>
                            <td className="py-2 text-right font-medium">₹{s.unitPrice.toLocaleString('en-IN')}</td>
                            <td className="py-2 text-right text-slate-700">{s.leadTimeDays}d</td>
                            <td className="py-2 text-slate-600 text-[11px] leading-snug max-w-[11rem]">
                              {formatStagedPaymentTermsSummary(s.paymentTerms)}
                            </td>
                            <td className="py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const p = parsePaymentTermsString(s.paymentTerms || '');
                                  setReleaseToPlanningForm((f) => ({
                                    ...f,
                                    vendorId: s.vendorId,
                                    vendorName: s.vendorName,
                                    moq: s.moq,
                                    unitPrice: String(s.unitPrice),
                                    paymentTermsType: p.type,
                                    advancePercent: String(
                                      p.advancePercent ||
                                      (paymentTermsTypeRequiresAdvancePercent(p.type) ? 50 : 0)
                                    ),
                                    leadTimeDays: s.leadTimeDays,
                                    paymentTermsRaw: String(s.paymentTerms || '').trim() || null,
                                  }));
                                }}
                                className="px-2 py-1 rounded border border-cyan-400 text-cyan-700 text-[10px] font-semibold hover:bg-cyan-50"
                              >
                                Pick
                              </button>
                            </td>
                          </tr>
                        ))}
                        {slabs.length === 0 && <tr><td colSpan={6} className="py-3 text-center text-slate-500">No vendor rates found for this item in Items List (shown in Procurement &gt; Quotations).</td></tr>}
                      </tbody>
                    </table>
                    <p className="text-xs text-slate-500 mt-2">Pick a slab or select manually.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="font-bold text-slate-900 text-sm mb-3">Planned line details</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Vendor</label>
                        <select
                          value={releaseToPlanningForm.vendorName}
                          onChange={(e) => {
                            const name = e.target.value;
                            const match = slabs.find((s) => s.vendorName === name);
                            if (!name.trim()) {
                              setReleaseToPlanningForm((f) => ({ ...f, vendorName: '', paymentTermsRaw: null }));
                              return;
                            }
                            if (match) {
                              const p = parsePaymentTermsString(match.paymentTerms || '');
                              setReleaseToPlanningForm((f) => ({
                                ...f,
                                vendorName: name,
                                vendorId: match.vendorId,
                                moq: match.moq,
                                unitPrice: String(match.unitPrice),
                                paymentTermsType: p.type,
                                advancePercent: String(
                                  p.advancePercent ||
                                  (paymentTermsTypeRequiresAdvancePercent(p.type) ? 50 : 0)
                                ),
                                leadTimeDays: match.leadTimeDays,
                                paymentTermsRaw: String(match.paymentTerms || '').trim() || null,
                              }));
                            } else {
                              setReleaseToPlanningForm((f) => ({ ...f, vendorName: name, paymentTermsRaw: null }));
                            }
                          }}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">— Select —</option>
                          {vendorOptions.map((v) => (<option key={v} value={v}>{v}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">MOQ</label>
                        <input
                          type="number"
                          min={0}
                          value={releaseToPlanningForm.moq || ''}
                          onChange={(e) => setReleaseToPlanningForm((f) => ({ ...f, moq: Number(e.target.value || 0) }))}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Quantity</label>
                        <input type="number" min={0} value={releaseToPlanningForm.qty} onChange={(e) => setReleaseToPlanningForm((f) => ({ ...f, qty: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Unit price (₹)</label>
                        <input type="number" min={0} value={releaseToPlanningForm.unitPrice} onChange={(e) => setReleaseToPlanningForm((f) => ({ ...f, unitPrice: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Payment terms (type)</label>
                        <select
                          value={releaseToPlanningForm.paymentTermsType}
                          onChange={(e) =>
                            setReleaseToPlanningForm((f) => ({
                              ...f,
                              paymentTermsType: e.target.value as PaymentTermsStructuredType,
                              paymentTermsRaw: null,
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
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Lead time</label>
                        <div className="py-1.5 text-sm font-medium text-slate-800">{releaseToPlanningForm.leadTimeDays} days</div>
                      </div>
                    </div>
                    {paymentTermsTypeRequiresAdvancePercent(releaseToPlanningForm.paymentTermsType) && (
                      <div className="mb-3">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Advance %</label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={releaseToPlanningForm.advancePercent}
                          onChange={(e) =>
                            setReleaseToPlanningForm((f) => ({
                              ...f,
                              advancePercent: e.target.value,
                              paymentTermsRaw: null,
                            }))
                          }
                          className="w-full max-w-xs rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    )}
                    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                        Payment split (advance · pre-shipment · post-shipment)
                      </p>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <div className="text-[10px] text-slate-500">Advance</div>
                          <div className="text-sm font-semibold text-slate-900">{releasePtStages.advance_pct}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Pre-shipment</div>
                          <div className="text-sm font-semibold text-slate-900">{releasePtStages.pre_shipment_pct}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Post-shipment</div>
                          <div className="text-sm font-semibold text-slate-900">{releasePtStages.post_shipment_pct}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Credit</div>
                          <div className="text-sm font-semibold text-slate-900">
                            {releasePtStages.credit_days > 0 ? `Net ${releasePtStages.credit_days}d` : '—'}
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-2">{formatStagedPaymentTermsObject(releasePtStages)}</p>
                    </div>
                    {/* <div className="flex gap-2 mb-3">
                      <button type="button" onClick={() => setReleaseToPlanningForm((f) => ({ ...f, qty: String(shortfall) }))} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50">Prefill qty = Gap</button>
                      <button
                        type="button"
                        disabled={releaseToPlanningSaving}
                        onClick={async () => {
                          setReleaseToPlanningSaving(true);
                          try {
                            await addPlannedLine();
                          } finally {
                            setReleaseToPlanningSaving(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-50"
                      >
                        Add to Planned
                      </button>
                    </div> */}
                    <div className="border-t border-slate-200 my-3" />
                    <h3 className="font-bold text-slate-900 text-sm mb-2">Previous purchases</h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200">
                          <th className="text-left py-1 font-medium">Date</th>
                          <th className="text-left py-1 font-medium">Vendor</th>
                          <th className="text-right py-1 font-medium">Qty</th>
                          <th className="text-right py-1 font-medium">Unit ₹</th>
                          <th className="text-right py-1 font-medium">Pick</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previous.map((r, i) => (
                          <tr key={`${r.createdAt}-${i}`} className="border-b border-slate-100">
                            <td className="py-1.5 text-slate-700">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="py-1.5 text-slate-700">{r.vendorName}</td>
                            <td className="py-1.5 text-right text-slate-700">{r.qty} <span className="text-slate-500">{r.unit}</span></td>
                            <td className="py-1.5 text-right font-medium">₹{r.unitPrice.toLocaleString('en-IN')}</td>
                            <td className="py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const p = parsePaymentTermsString(r.paymentTerms || '');
                                  setReleaseToPlanningForm((f) => ({
                                    ...f,
                                    vendorId: r.vendorId,
                                    vendorName: r.vendorName,
                                    moq: r.moq,
                                    qty: String(r.qty),
                                    unitPrice: String(r.unitPrice),
                                    paymentTermsType: p.type,
                                    advancePercent: String(
                                      p.advancePercent ||
                                      (paymentTermsTypeRequiresAdvancePercent(p.type) ? 50 : 0)
                                    ),
                                    leadTimeDays: r.leadTimeDays,
                                    paymentTermsRaw: String(r.paymentTerms || '').trim() || null,
                                  }));
                                }}
                                className="px-2 py-1 rounded border border-cyan-400 text-cyan-700 text-[10px] font-semibold hover:bg-cyan-50"
                              >
                                Pick
                              </button>
                            </td>
                          </tr>
                        ))}
                        {purchaseOrdersLoading && (
                          <tr>
                            <td colSpan={5} className="py-3 text-center text-slate-500">
                              Loading previous picks...
                            </td>
                          </tr>
                        )}
                        {!purchaseOrdersLoading && previous.length === 0 && (
                          <tr><td colSpan={5} className="py-3 text-center text-slate-500">No previous picks for this item.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-xs text-slate-500">Planned stage is the transition stage before Draft POs and splitting/releasing.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setReleaseToPlanningItem(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">Cancel</button>
                  <button
                    type="button"
                    disabled={releaseToPlanningSaving}
                    onClick={async () => {
                      setReleaseToPlanningSaving(true);
                      try {
                        const ok = await addPlannedLine();
                        if (ok) setReleaseToPlanningItem(null);
                      } finally {
                        setReleaseToPlanningSaving(false);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Add Planned Line
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Batch detail modal: items with SIH, Reserved, Available, Shortfall, PR per row (PR raised against batch id) */}
      {batchForDetailModal && (() => {
        const batch = batchForDetailModal;
        const sizeKg = Number(batch.sizeKg) || 0;
        const orderQtyNum = parseInt(String(batch.orderQty || '0').replace(/\D/g, ''), 10) || 0;
        const totalKg = parseFloat(String(batch.totalKg || '0').replace(/[^\d.]/g, '')) || 0;
        const kgPerUnit = orderQtyNum > 0 && totalKg > 0 ? totalKg / orderQtyNum : 1;
        const unitsForBatch = kgPerUnit > 0 ? sizeKg / kgPerUnit : 0;
        const rmByCode = new Map(rawMaterialsList.map((r) => [r.code?.toLowerCase() ?? '', r]));
        const pmByCode = new Map(packMaterialsList.map((p) => [p.code?.toLowerCase() ?? '', p]));
        type BatchDetailRow = { id: string; type: 'RM' | 'PM'; name: string; code: string; required: number; unit: string; sih: number; reserved: number; available: number; shortfall: number; raw_material_id?: number; pack_material_id?: number };
        const rows: BatchDetailRow[] = [];
        (batch.rmLines || []).forEach((line: BatchRmLine, idx: number) => {
          const code = line.rm_code || (line as { code?: string }).code || '';
          const rm = rmByCode.get(code.toLowerCase()) ?? rawMaterialsList.find((r) => r.code === code || r.name === (line.inci_name ?? (line as { name?: string }).name));
          const raw_material_id = rm?.id != null ? Number(rm.id) : undefined;
          const pct = line.pct_w_w ?? (line as { pct?: number }).pct ?? 0;
          const required = (sizeKg * pct) / 100;
          const wh = warehouseRows.find((w) => w.type === 'RM' && (Number(w.sourceId) === Number(raw_material_id) || w.code === code));
          const sih = wh?.stockInHand ?? 0;
          const reserved = wh?.reserved ?? 0;
          const available = Math.max(0, sih - reserved);
          const shortfall = Math.max(0, required - available);
          rows.push({
            id: `rm-${raw_material_id ?? code}-${idx}`,
            type: 'RM',
            name: line.inci_name ?? (line as { name?: string }).name ?? rm?.name ?? code,
            code: code || String(raw_material_id ?? ''),
            required,
            unit: line.uom ?? 'KG',
            sih,
            reserved,
            available,
            shortfall,
            raw_material_id: raw_material_id ?? undefined,
          });
        });
        (batch.pmLines || []).forEach((line: BatchPmLine, idx: number) => {
          const code = line.pm_code || (line as { code?: string }).code || '';
          const pm = pmByCode.get(code.toLowerCase()) ?? packMaterialsList.find((p) => p.code === code || p.description === (line.description ?? (line as { name?: string }).name));
          const pack_material_id = pm?.id != null ? Number(pm.id) : undefined;
          const qtyPerUnit = line.qty_per_unit ?? (line as { qty?: number }).qty ?? 1;
          const required = Math.ceil(unitsForBatch * qtyPerUnit);
          const wh = warehouseRows.find((w) => w.type === 'PM' && (Number(w.sourceId) === Number(pack_material_id) || w.code === code));
          const sih = wh?.stockInHand ?? 0;
          const reserved = wh?.reserved ?? 0;
          const available = Math.max(0, sih - reserved);
          const shortfall = Math.max(0, required - available);
          rows.push({
            id: `pm-${pack_material_id ?? code}-${idx}`,
            type: 'PM',
            name: line.description ?? (line as { name?: string }).name ?? pm?.description ?? code,
            code: code || String(pack_material_id ?? ''),
            required,
            unit: 'PCS',
            sih,
            reserved,
            available,
            shortfall,
            pack_material_id: pack_material_id ?? undefined,
          });
        });
        return (
          <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">
                  Batch — {batch.batchCode ?? `PE-${batch.planningExtractedId}-B${batch.sequence}`}
                </h3>
                <button type="button" onClick={() => setBatchForDetailModal(null)} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              <p className="px-4 pt-2 text-xs text-gray-600">
                {batch.productName ?? batch.productCode ?? '—'} · SO {batch.soNumber ?? '—'} · Size {sizeKg} kg.
              </p>
              <div className="p-4 overflow-x-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Item / Code</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-700">Type</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Required</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Stock in hand</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Reserved</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Available</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Shortfall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900">{row.name}</div>
                          <div className="text-xs text-gray-500">{row.code}</div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${row.type === 'RM' ? 'bg-cyan-100 text-cyan-700' : 'bg-orange-100 text-orange-700'}`}>{row.type}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">{row.required.toLocaleString(undefined, { maximumFractionDigits: 2 })} {row.unit}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700">{row.sih.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-600">{row.reserved.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700">{row.available.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{row.shortfall > 0 ? <span className="text-red-600">{row.shortfall.toLocaleString()}</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && (
                  <div className="py-8 text-center text-gray-500 text-sm">No RM/PM lines in this batch.</div>
                )}
              </div>
              {(() => {
                const allShortfallResolved = rows.length > 0 && rows.every((r) => r.shortfall <= 0);
                // const alreadySent = Boolean(batch.sent);
                // if (alreadySent) {
                //   return (
                //     <div className="px-4 py-3 border-t border-gray-200 bg-emerald-50 flex items-center justify-between">
                //       <span className="text-sm font-medium text-emerald-800">Sent to production — can be scheduled in Production → Calendar.</span>
                //       <button type="button" onClick={() => setBatchForDetailModal(null)} className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                //     </div>
                //   );
                // }
                if (allShortfallResolved) {
                  return (
                    <div className="px-4 py-3 border-t border-gray-200 bg-amber-50 flex items-center justify-between gap-3">
                      <span className="text-sm text-amber-800">All materials available. Send this batch to production to allow scheduling in Production → Calendar.</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const current = (batch as PlanningBatchAllRow).sentBatchIndices ?? [];
                            const idx = Number(batch.sequence) - 1;
                            if (current.includes(idx)) return;
                            const merged = [...current, idx].sort((a, b) => a - b);
                            try {
                              await updatePlanningExtracted(String(batch.planningExtractedId), { sentBatchIndices: merged });
                              queryClient.invalidateQueries({ queryKey: ['planning-batches-all'] });
                              addToast('success', 'Batch sent to production. You can schedule it in Production → Calendar.');
                              setBatchForDetailModal(null);
                            } catch {
                              addToast('error', 'Failed to send batch to production.');
                            }
                          }}
                          className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 shadow-sm"
                        >
                          Send To Production
                        </button>
                        <button type="button" onClick={() => setBatchForDetailModal(null)} className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
                    <button type="button" onClick={() => setBatchForDetailModal(null)} className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Close</button>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Raise Procurement Request popup — confirm and send PR linked to batch id */}
      {batchPrModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Raise Procurement Request</h3>
              <button type="button" onClick={() => setBatchPrModal(null)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch</p>
                <p className="text-sm font-bold text-slate-900">{batchPrModal.batch.batchCode ?? `PE-${batchPrModal.batch.planningExtractedId}-B${batchPrModal.batch.sequence}`} <span className="text-slate-500 font-normal">(ID: {batchPrModal.batch.id})</span></p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Item</label>
                  <p className="text-sm text-gray-900">{batchPrModal.row.name}</p>
                  <p className="text-xs text-gray-500">{batchPrModal.row.code}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Shortfall</label>
                  <p className="text-sm font-mono text-gray-900">{batchPrModal.row.shortfall.toLocaleString(undefined, { maximumFractionDigits: 2 })} {batchPrModal.row.unit}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity to request</label>
                <input
                  type="number"
                  min={1}
                  step={batchPrModal.row.unit === 'KG' ? 0.01 : 1}
                  value={batchPrQty}
                  onChange={(e) => setBatchPrQty(batchPrModal.row.unit === 'KG' ? Math.max(0, parseFloat(e.target.value) || 0) : Math.max(1, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
                  <select value={batchPrPriority} onChange={(e) => setBatchPrPriority(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Required by</label>
                  <input type="date" value={batchPrRequiredBy} onChange={(e) => setBatchPrRequiredBy(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <textarea value={batchPrNotes} onChange={(e) => setBatchPrNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
              <button type="button" onClick={() => setBatchPrModal(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">
                Cancel
              </button>
              <button
                type="button"
                disabled={batchPrSending}
                onClick={async () => {
                  const { batch, row } = batchPrModal;
                  setBatchPrSending(true);
                  try {
                    const itemPayload: ProcurementRequestItem = {
                      type: row.type,
                      code: row.code,
                      name: row.name,
                      required: row.required,
                      sih: row.sih,
                      shortage: row.shortfall,
                      quantity_requested: batchPrQty,
                      unit: row.unit,
                      raw_material_id: row.raw_material_id,
                      pack_material_id: row.pack_material_id,
                    };
                    const result = await createProcurementRequest({
                      planningExtractedId: batch.planningExtractedId,
                      planningBatchId: batch.id,
                      priority: batchPrPriority,
                      requiredByDate: batchPrRequiredBy || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                      notes: batchPrNotes,
                      items: [itemPayload],
                    });
                    if (result.success) {
                      queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                      queryClient.invalidateQueries({ queryKey: ['planning', 'items-involved'] });
                      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
                      addToast('success', `PR raised for ${row.name} (batch ${batch.batchCode ?? batch.id})`);
                      setBatchPrModal(null);
                    } else {
                      addToast('error', typeof result.error === 'string' ? result.error : 'Failed to raise PR');
                    }
                  } catch (e) {
                    addToast('error', e instanceof Error ? e.message : 'Failed to raise PR');
                  } finally {
                    setBatchPrSending(false);
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
              >
                {batchPrSending ? 'Sending...' : 'Send to Procurement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Batches & Confirm BOM Modal — global: opens from PIs Extracted (Plan Batches & Confirm BOM) or Availability Summary (Plan Batches) */}
      {planBatchesModalOpen && selectedSOForBatch && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Plan Batches — {selectedSOForBatch.productName}</h2>
                <p className="text-xs text-gray-500 mt-1">{selectedSOForBatch.soNumber} · {selectedSOForBatch.orderQty} · Total KG: {selectedSOForBatch.totalKg}</p>
              </div>
              <button
                onClick={() => {
                  setPlanBatchesModalOpen(false);
                  setSelectedSOForBatch(null);
                  setSelectedBatchId(null);
                  setIsReadyForProduction(false);
                  setSwapSourceIndex(null);
                  setCustomBatches([]);
                  setExpandedBatchIndex(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Batch selector on BOM Editor / Swap; Batch Plan tab has its own row next to Preview qty */}
              {activeBatchTab !== 'batch-plan' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch</span>
                  <div className="flex items-center gap-1 border border-gray-300 rounded-lg bg-white overflow-hidden">
                    <select
                      value={selectedBatchId != null ? String(selectedBatchId) : ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        setSelectedBatchId(Number.isNaN(v) ? null : v);
                      }}
                      className="min-w-[120px] px-3 py-2 text-sm font-medium text-gray-900 bg-transparent focus:outline-none focus:ring-0"
                    >
                      {planningBatches.length === 0 && (
                        <option value="">{selectedBatchId ? 'Loading...' : 'batch-01'}</option>
                      )}
                      {(planningBatches as PlanningBatchRow[]).map((b, idx) => (
                        <option key={b.id} value={String(b.id)}>
                          {b.batchCode ?? `batch-${String(idx + 1).padStart(2, '0')}`}
                        </option>
                      ))}
                      {selectedBatchId != null &&
                        !(planningBatches as PlanningBatchRow[]).some(
                          (b) => Number(b.id) === Number(selectedBatchId)
                        ) && (
                        <option value={String(selectedBatchId)}>Loading...</option>
                      )}
                    </select>
                    <button
                      type="button"
                      disabled={planningBatches.length > 0 && !canAddAnotherPlanningBatch}
                      onClick={async () => {
                        if (planningBatches.length > 0 && !canAddAnotherPlanningBatch) {
                          addToast('error', 'Send the latest batch to production before adding another.');
                          return;
                        }
                        try {
                          const newBatch = await addOneBatchFromMaster(planningIdForBatch);
                          if (newBatch) {
                            mergePlanningBatchIntoListCache(queryClient, planningIdForBatch, newBatch);
                            queryClient.invalidateQueries({ queryKey: ['planning-batches', planningIdForBatch] });
                            setSelectedBatchId(Number(newBatch.id));
                            addToast('success', `Added ${newBatch.batchCode ?? 'new batch'} (BOM from product master).`);
                          } else {
                            addToast('error', 'Failed to add batch');
                          }
                        } catch (e) {
                          addToast('error', e instanceof Error ? e.message : 'Failed to add batch');
                        }
                      }}
                      className="px-2 py-2 text-emerald-600 hover:bg-emerald-50 border-l border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      title={
                        planningBatches.length > 0 && !canAddAnotherPlanningBatch
                          ? 'Send the latest batch to production before adding another'
                          : 'Add new batch (BOM from product master)'
                      }
                    >
                      + Add
                    </button>
                  </div>
                  {selectedBatchId != null && (
                    <span className="text-xs text-gray-500">
                      Editing BOM for this batch only. Confirm BOM saves to this batch.
                    </span>
                  )}
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-4 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveBatchTab('batch-plan')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${activeBatchTab === 'batch-plan'
                    ? 'text-emerald-700 border-b-2 border-emerald-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Batch Plan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBatchTab('bom-editor')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${activeBatchTab === 'bom-editor'
                    ? 'text-emerald-700 border-b-2 border-emerald-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  BOM Editor
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBatchTab('swap-add')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${activeBatchTab === 'swap-add'
                    ? 'text-emerald-700 border-b-2 border-emerald-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Swap / Add
                </button>
              </div>

              {/* Tab Content */}
              {activeBatchTab === 'batch-plan' && (
                <div className="space-y-0">
                  {/* Availability bar — ORDER QTY, RM/PM COVERS, EXECUTABLE, STATUS */}
                  <div className="flex flex-wrap gap-5 items-center p-4 border-b border-gray-200 bg-gray-50/80">
                    <div className="flex-1 min-w-[140px]">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">ORDER QTY</div>
                      <div className="text-xl font-bold text-gray-900">
                        {orderQtyNum.toLocaleString()} <span className="text-gray-500 text-sm font-normal">units</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">RM COVERS</div>
                      <div className={`text-lg font-bold ${feasibilityRmCoversUnits >= orderQtyNum ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {Math.round(feasibilityRmCoversUnits).toLocaleString()} <span className="text-gray-500 text-xs font-normal">units</span>
                      </div>
                      <div className="text-[10px] text-gray-500">{feasibilityRmRows.length} RM item{feasibilityRmRows.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">PM COVERS</div>
                      <div className={`text-lg font-bold ${feasibilityPmCoversUnits >= orderQtyNum ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {Math.round(feasibilityPmCoversUnits).toLocaleString()} <span className="text-gray-500 text-xs font-normal">units</span>
                      </div>
                      <div className="text-[10px] text-gray-500">{feasibilityPmRows.length} PM item{feasibilityPmRows.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">EXECUTABLE</div>
                      <div className={`text-lg font-bold ${feasibilityExecutableUnits >= orderQtyNum ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {Math.round(feasibilityExecutableUnits).toLocaleString()} <span className="text-gray-500 text-xs font-normal">units</span>
                      </div>
                      <div className="mt-1 h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${feasibilityExecutableUnits >= orderQtyNum ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${orderQtyNum > 0 ? Math.min(100, (feasibilityExecutableUnits / orderQtyNum) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-[2] min-w-[180px]">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">STATUS</div>
                      <div className="text-xs leading-relaxed text-gray-700">
                        {feasibilityRmCoversUnits < orderQtyNum && (
                          <>RM: <b className="text-amber-600">Only {Math.round(feasibilityRmCoversUnits).toLocaleString()} units</b><br /></>
                        )}
                        {feasibilityPmCoversUnits < orderQtyNum && (
                          <>PM: <b className="text-amber-600">Only {Math.round(feasibilityPmCoversUnits).toLocaleString()} units</b><br /></>
                        )}
                        {feasibilityExecutableUnits < orderQtyNum && (
                          <span className="text-amber-600 font-medium">Raise POs for shortages</span>
                        )}
                        {feasibilityExecutableUnits >= orderQtyNum && (
                          <span className="text-emerald-600 font-medium">Materials cover full order</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Preview qty + planning batch selector (same stock math context) */}
                  <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-500">Preview qty:</span>
                        <input
                          type="number"
                          min={1}
                          value={feasibilityPreviewQty || ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? 0 : parseInt(e.target.value.replace(/\D/g, ''), 10);
                            setFeasibilityPreviewQty(Number.isNaN(v) ? 0 : Math.max(0, v));
                          }}
                          className="w-24 border border-gray-300 bg-white text-gray-900 px-2 py-1.5 rounded-lg text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] font-semibold text-gray-500">units</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap border-l border-gray-200 pl-4">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Planning batch</span>
                        <select
                          value={selectedBatchId != null ? String(selectedBatchId) : ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                            setSelectedBatchId(Number.isNaN(v) ? null : v);
                          }}
                          className="min-w-[120px] px-3 py-1.5 text-sm font-medium text-gray-900 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {planningBatches.length === 0 && (
                            <option value="">{selectedBatchId ? 'Loading...' : 'batch-01'}</option>
                          )}
                          {(planningBatches as PlanningBatchRow[]).map((b, idx) => (
                            <option key={b.id} value={String(b.id)}>
                              {b.batchCode ?? `batch-${String(idx + 1).padStart(2, '0')}`}
                            </option>
                          ))}
                          {selectedBatchId != null &&
                            !(planningBatches as PlanningBatchRow[]).some(
                              (b) => Number(b.id) === Number(selectedBatchId)
                            ) && (
                            <option value={String(selectedBatchId)}>Loading...</option>
                          )}
                        </select>
                        <button
                          type="button"
                          disabled={planningBatches.length > 0 && !canAddAnotherPlanningBatch}
                          onClick={async () => {
                            if (planningBatches.length > 0 && !canAddAnotherPlanningBatch) {
                              addToast('error', 'Send the latest batch to production before adding another.');
                              return;
                            }
                            try {
                              const newBatch = await addOneBatchFromMaster(planningIdForBatch);
                              if (newBatch) {
                                mergePlanningBatchIntoListCache(queryClient, planningIdForBatch, newBatch);
                                queryClient.invalidateQueries({ queryKey: ['planning-batches', planningIdForBatch] });
                                setSelectedBatchId(Number(newBatch.id));
                                addToast('success', `Added ${newBatch.batchCode ?? 'new batch'} (BOM from product master).`);
                              } else {
                                addToast('error', 'Failed to add batch');
                              }
                            } catch (e) {
                              addToast('error', e instanceof Error ? e.message : 'Failed to add batch');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={
                            planningBatches.length > 0 && !canAddAnotherPlanningBatch
                              ? 'Send the latest batch to production before adding another'
                              : 'Create planning batch (BOM from product master)'
                          }
                        >
                          Create batch
                        </button>
                        <button
                          type="button"
                          disabled={
                            !canSendToProduction ||
                            selectedBatchPlanIndex < 0 ||
                            selectedBatchPlanIndex >= customBatches.length ||
                            (selectedSOForBatch?.sentBatchIndices ?? []).includes(selectedBatchPlanIndex)
                          }
                          onClick={() => {
                            if (selectedBatchPlanIndex >= 0) void handleSendBatchToProductionIndividually(selectedBatchPlanIndex);
                          }}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            !canSendToProduction
                              ? 'Confirm BOM in BOM Editor first'
                              : selectedBatchPlanIndex < 0
                                ? 'Select a planning batch'
                                : (selectedSOForBatch?.sentBatchIndices ?? []).includes(selectedBatchPlanIndex)
                                  ? 'This batch was already sent'
                                  : 'Send this batch to Production'
                          }
                        >
                          Send B-{String(selectedBatchPlanSequence).padStart(2, '0')}
                        </button>
                      </div>
                    </div>
                    {selectedBatchId != null && (
                      <span className="text-[11px] text-gray-500 max-w-[220px]">
                        BOM Editor / Swap use this batch. Batch Plan allocates units across batches below.
                      </span>
                    )}
                  </div>

                  {/* BOM / Material Status — RM & PM tables driven by preview qty */}
                  <div className="p-4 overflow-auto max-h-[58vh] space-y-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-gray-900">BOM / Material Status</h3>
                    </div>

                    {/* RM Feasibility Table */}
                    <div>
                      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Raw materials ({feasibilityRmRows.length})</h4>
                      <div className="border border-gray-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[120px]">Item</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">SG</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Req this order</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Stock</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Reserved</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Available</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">PO / Transit</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Gap</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Max units</th>
                            </tr>
                          </thead>
                          <tbody>
                            {feasibilityRmRows.map((row, idx) => (
                              <tr key={`rm-${row.code}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-3 py-2 text-gray-900">
                                  <span className="font-medium text-xs">{row.name}</span>
                                  <div className="text-[10px] text-gray-500">{row.code} · kg</div>
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-gray-700">{Number(row.specificGravity ?? 1).toFixed(2)}</td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">
                                  {row.reqThisOrder.toFixed(2)}
                                  <div className="text-[10px] font-normal text-gray-500">
                                    {(row.reqThisOrderLiters ?? row.reqThisOrder).toFixed(2)} L
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-gray-700">{row.sih.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-600">{row.reserved.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700">{row.free.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-600">{row.inTransit.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono font-semibold">{row.gap > 0 ? <span className="text-red-600">{row.gap.toFixed(2)}</span> : <span className="text-emerald-600">—</span>}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">{Math.round(row.maxUnits).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* PM Feasibility Table */}
                    <div>
                      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Packing materials ({feasibilityPmRows.length})</h4>
                      <div className="border border-gray-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[120px]">Item</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Req this order</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Stock</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Reserved</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Free</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">PO / Transit</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700">Gap</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-[10px]">Max units</th>
                            </tr>
                          </thead>
                          <tbody>
                            {feasibilityPmRows.map((row, idx) => (
                              <tr key={`pm-${row.code}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-3 py-2 text-gray-900">
                                  <span className="font-medium text-xs">{row.name}</span>
                                  <div className="text-[10px] text-gray-500">{row.code} · pcs</div>
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">{row.reqThisOrder.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-700">{row.sih.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-600">{row.reserved.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700">{row.free.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-600">{row.inTransit.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono font-semibold">{row.gap > 0 ? <span className="text-red-600">{row.gap.toLocaleString()}</span> : <span className="text-emerald-600">—</span>}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">{Math.round(row.maxUnits).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {(() => {
                const orderTotalKg = parseFloat(selectedSOForBatch.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
                const orderQtyNum = parseInt(selectedSOForBatch.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
                const kgPerUnit = orderQtyNum > 0 && orderTotalKg > 0 ? orderTotalKg / orderQtyNum : (orderTotalKg || 1);
                const batchTotal = customBatches.reduce((sum, b) => sum + (b.sizeKg || 0), 0);
                const batchTotalUnits = kgPerUnit > 0 ? batchTotal / kgPerUnit : 0;
                const remaining = orderTotalKg - batchTotal;
                const remainingUnits = kgPerUnit > 0 ? remaining / kgPerUnit : 0;
                const addBatch = async () => {
                  if (planningBatches.length > 0 && !canAddAnotherPlanningBatch) {
                    addToast('error', 'Send the latest batch to production before adding another.');
                    return;
                  }
                  try {
                    const newBatch = await addOneBatchFromMaster(planningIdForBatch);
                    if (newBatch) {
                      mergePlanningBatchIntoListCache(queryClient, planningIdForBatch, newBatch);
                      queryClient.invalidateQueries({ queryKey: ['planning-batches', planningIdForBatch] });
                      setSelectedBatchId(Number(newBatch.id));
                      addToast('success', `Added ${newBatch.batchCode ?? 'batch'} (BOM from master).`);
                    } else {
                      addToast('error', 'Failed to add batch');
                    }
                  } catch (e) {
                    addToast('error', e instanceof Error ? e.message : 'Failed to add batch');
                  }
                };
                const removeBatch = (idx: number) => {
                  setCustomBatches(customBatches.filter((_, i) => i !== idx));
                  if (expandedBatchIndex === idx) setExpandedBatchIndex(null);
                  else if (expandedBatchIndex !== null && expandedBatchIndex > idx) setExpandedBatchIndex(expandedBatchIndex - 1);
                };
                /** Update batch units locally; persist with Save Batch Plan or Send to Production (same as Feasibility preview math). */
                const updateBatchUnits = (idx: number, units: number) => {
                  const sizeKg = units * kgPerUnit;
                  setCustomBatches(customBatches.map((b, i) => (i === idx ? { ...b, sizeKg } : b)));
                };

                const normalizeMassUom = (raw?: string): 'KG' | 'GM' | 'MG' => {
                  const u = String(raw || '').trim().toUpperCase();
                  if (u === 'G' || u === 'GM' || u === 'GRAM' || u === 'GRAMS') return 'GM';
                  if (u === 'MG' || u === 'MILLIGRAM' || u === 'MILLIGRAMS') return 'MG';
                  return 'KG';
                };
                const convertKgToMassUom = (kg: number, uom: 'KG' | 'GM' | 'MG') => {
                  if (uom === 'GM') return kg * 1000;
                  if (uom === 'MG') return kg * 1000 * 1000;
                  return kg;
                };

                /** Per-batch requirements in BATCH BREAKDOWN: use that batch row's own BOM copy. */
                const getBatchRmRequirementsForBatch = (batchSizeForCalc: number, batchRow?: PlanningBatchRow) => {
                  const rmLines = Array.isArray(batchRow?.rmLines) ? batchRow.rmLines : [];
                  if (rmLines.length === 0) return [];
                  return rmLines.map((line: { inci_name?: string; rm_code?: string; pct_w_w?: number; pct?: number; uom?: string }) => {
                    const pct = line.pct_w_w ?? (line as { pct?: number }).pct ?? 0;
                    const requiredKg = (batchSizeForCalc * pct) / 100;
                    const uom = normalizeMassUom(line.uom);
                    const required = convertKgToMassUom(requiredKg, uom);
                    return { name: line.inci_name ?? line.rm_code ?? '—', code: line.rm_code ?? '', pct, required, requiredKg, uom };
                  });
                };
                const getBatchPmRequirementsForBatch = (batchSizeForCalc: number, batchRow?: PlanningBatchRow) => {
                  const pmLines = Array.isArray(batchRow?.pmLines) ? batchRow.pmLines : [];
                  if (pmLines.length === 0) return [];
                  const orderQtyNum = parseInt(selectedSOForBatch.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
                  const unitsFraction = orderTotalKg > 0 ? batchSizeForCalc / orderTotalKg : 0;
                  const unitsForBatch = Math.ceil(orderQtyNum * unitsFraction);
                  return pmLines.map((line: { description?: string; pm_code?: string; qty_per_unit?: number }) => {
                    const qtyPerUnit = line.qty_per_unit ?? 1;
                    const required = unitsForBatch * qtyPerUnit;
                    return { name: line.description ?? line.pm_code ?? '—', code: line.pm_code ?? '', qtyPerUnit, required, uom: 'PCS' };
                  });
                };
                const batchPlanRows = customBatches
                  .map((batch, originalIndex) => {
                    const row = (planningBatches as PlanningBatchRow[])[originalIndex];
                    const sequence = Number(row?.sequence ?? (originalIndex + 1)) || (originalIndex + 1);
                    return { batch, originalIndex, row, sequence };
                  })
                  .sort((a, b) => b.sequence - a.sequence || b.originalIndex - a.originalIndex);

                return (
                  <div className="space-y-6">
                    {canSendToProduction && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
                        <span className="font-semibold">BOM confirmed.</span> Select which batches to send to Production (checkboxes). Already-sent batches are grayed out. Click a batch to view its required materials.
                      </div>
                    )}

                    {/* Schedule & production line */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">PLANNED START DATE</label>
                        <input type="date" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">PRODUCTION LINE</label>
                        <select value={productionLine} onChange={(e) => setProductionLine(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                          <option>Line 1 — Primary Mixer</option>
                          <option>Line 2 — Secondary Mixer</option>
                          <option>Multi-line split</option>
                        </select>
                      </div>
                    </div>

                    {/* Summary banner — quantity (units) to be made */}
                    <div className={`border rounded-lg p-4 ${Math.abs(remaining) < 0.01 ? 'bg-emerald-50 border-emerald-200' : remaining > 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <span className={Math.abs(remaining) < 0.01 ? 'text-emerald-900' : remaining > 0 ? 'text-amber-900' : 'text-red-900'}>
                          {customBatches.length} batch{customBatches.length !== 1 ? 'es' : ''} — {Math.round(batchTotalUnits).toLocaleString()} units to be made
                          {orderQtyNum > 0 && <> of {orderQtyNum.toLocaleString()} units total</>}
                        </span>
                      </p>
                      {Math.abs(remaining) >= 0.01 && (
                        <p className={`text-xs mt-1 ${remaining > 0 ? 'text-amber-700' : 'text-red-700'}`}>
                          {remaining > 0 ? `${Math.round(remainingUnits).toLocaleString()} units remaining to allocate` : `${Math.round(-remainingUnits).toLocaleString()} units over-allocated`}
                        </p>
                      )}
                      {Math.abs(remaining) < 0.01 && <p className="text-xs text-emerald-700 mt-1">Fully allocated.</p>}
                    </div>

                    {/* Custom batch list — create batches from the toolbar (Preview qty row) or the batch bar on other tabs */}
                    <div>
                      <div className="mb-4">
                        <h3 className="text-sm font-bold text-gray-900">BATCH BREAKDOWN</h3>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Use <strong>Create batch</strong> next to Planning batch (above), or <strong>+ Add</strong> in the batch bar when you are on BOM Editor / Swap.
                        </p>
                      </div>

                      {customBatches.length === 0 && (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-sm text-gray-600">No unit split yet. Add a planning batch first, then allocate units per row below.</p>
                          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                            {orderQtyNum > 0 && (
                              <button
                                type="button"
                                disabled={planningBatches.length > 0 && !canAddAnotherPlanningBatch}
                                onClick={() => addBatch()}
                                className="px-4 py-2 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-lg hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={
                                  planningBatches.length > 0 && !canAddAnotherPlanningBatch
                                    ? 'Send the latest batch to production first'
                                    : undefined
                                }
                              >
                                Create single batch ({orderQtyNum.toLocaleString()} units)
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        {batchPlanRows.map(({ batch, originalIndex, row, sequence }) => {
                          const isExpanded = expandedBatchIndex === originalIndex;
                          const sentBatchIndices = selectedSOForBatch?.sentBatchIndices ?? [];
                          const isSent = sentBatchIndices.includes(originalIndex);
                          const batchUnits = kgPerUnit > 0 ? batch.sizeKg / kgPerUnit : 0;
                          const rmReqs = isExpanded ? getBatchRmRequirementsForBatch(batch.sizeKg, row) : [];
                          const pmReqs = isExpanded ? getBatchPmRequirementsForBatch(batch.sizeKg, row) : [];
                          return (
                            <div key={row?.id ?? `batch-${originalIndex}`} className={`border-2 rounded-lg overflow-hidden transition-colors ${isSent ? 'border-gray-200 bg-gray-100 opacity-90' : isExpanded ? 'border-emerald-400 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}>
                              <div className="flex items-center gap-3 p-4">
                                {isSent && (
                                  <span className="shrink-0 text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded">Sent</span>
                                )}
                                <div
                                  className="flex-1 flex items-center gap-4 cursor-pointer"
                                  onClick={() => setExpandedBatchIndex(isExpanded ? null : originalIndex)}
                                >
                                  <span className={`text-sm font-bold px-3 py-1 rounded-md ${isSent ? 'text-gray-500 bg-gray-200' : 'text-emerald-700 bg-emerald-100'}`}>
                                    B-{String(sequence).padStart(2, '0')}
                                  </span>
                                  {row?.batchCode && (
                                    <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded" title="Batch ID (BOM copy saved for this batch)">
                                      {row.batchCode}
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide materials' : 'View required materials'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={kgPerUnit > 0 ? Math.round(batch.sizeKg / kgPerUnit) : batch.sizeKg}
                                    onChange={(e) => {
                                      const units = parseFloat(e.target.value) || 0;
                                      const sizeKg = units * kgPerUnit;
                                      console.log('e.target.value', e.target.value);
                                      console.log('sizeKg', kgPerUnit, units, sizeKg);
                                      updateBatchUnits(originalIndex, units);
                                    }}
                                    disabled={isSent}
                                    className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    min={0}

                                  />
                                  <span className="text-xs font-semibold text-gray-600">units</span>
                                  {!isSent && (
                                    <button
                                      type="button"
                                      onClick={() => removeBatch(originalIndex)}
                                      className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Per-batch material requirements */}
                              {isExpanded && (
                                <div className="border-t border-gray-200 p-4 bg-white space-y-4">
                                  {rmReqs.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-bold text-teal-700 mb-2">RM REQUIRED FOR B-{String(sequence).padStart(2, '0')} ({Math.round(batchUnits).toLocaleString()} units)</h4>
                                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-xs">
                                          <thead><tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-3 py-1.5 text-left font-semibold text-gray-600">RM ITEM</th>
                                            <th className="px-3 py-1.5 text-right font-semibold text-gray-600">% W/W</th>
                                            <th className="px-3 py-1.5 text-right font-semibold text-gray-600">REQUIRED</th>
                                          </tr></thead>
                                          <tbody>
                                            {rmReqs.map((r, ri) => (
                                              <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-3 py-1.5 text-gray-900 font-medium">{r.name} <span className="text-gray-400 text-xs">({r.code})</span></td>
                                                <td className="px-3 py-1.5 text-right text-gray-600">{r.pct.toFixed(2)}%</td>
                                                <td className="px-3 py-1.5 text-right text-teal-700 font-bold">{r.required.toFixed(2)} {r.uom}</td>
                                              </tr>
                                            ))}
                                            <tr className="bg-teal-50 border-t border-teal-200">
                                              <td colSpan={2} className="px-3 py-1.5 text-right font-bold text-teal-800">Total RM</td>
                                              <td className="px-3 py-1.5 text-right font-bold text-teal-800">
                                                {(() => {
                                                  const uoms = [...new Set(rmReqs.map((r) => r.uom))];
                                                  if (uoms.length === 1) {
                                                    const u = uoms[0] as 'KG' | 'GM' | 'MG';
                                                    const total = convertKgToMassUom(rmReqs.reduce((s, r) => s + (r.requiredKg ?? 0), 0), u);
                                                    return `${total.toFixed(2)} ${u}`;
                                                  }
                                                  const totalKg = rmReqs.reduce((s, r) => s + (r.requiredKg ?? 0), 0);
                                                  return `${totalKg.toFixed(2)} KG`;
                                                })()}
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                  {pmReqs.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-bold text-orange-700 mb-2">PM REQUIRED FOR B-{String(sequence).padStart(2, '0')} ({Math.round(batchUnits).toLocaleString()} units)</h4>
                                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-xs">
                                          <thead><tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-3 py-1.5 text-left font-semibold text-gray-600">PM ITEM</th>
                                            <th className="px-3 py-1.5 text-right font-semibold text-gray-600">QTY/UNIT</th>
                                            <th className="px-3 py-1.5 text-right font-semibold text-gray-600">REQUIRED</th>
                                          </tr></thead>
                                          <tbody>
                                            {pmReqs.map((p, pi) => (
                                              <tr key={pi} className={pi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-3 py-1.5 text-gray-900 font-medium">{p.name} <span className="text-gray-400 text-xs">({p.code})</span></td>
                                                <td className="px-3 py-1.5 text-right text-gray-600">{p.qtyPerUnit}</td>
                                                <td className="px-3 py-1.5 text-right text-orange-700 font-bold">{p.required.toLocaleString()} {p.uom}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                  {rmReqs.length === 0 && pmReqs.length === 0 && (
                                    <p className="text-xs text-gray-500 text-center py-2">No BOM data available to calculate materials.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
                </div>
              )}

              {/* BOM Editor Tab */}
              {activeBatchTab === 'bom-editor' && (
                <div className="space-y-6">
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start gap-3">
                    <span className="text-yellow-600 text-lg mt-0.5">!</span>
                    <div>
                      <p className="text-sm font-semibold text-yellow-900">Editing BOM for {selectedSOForBatch.productName}. Make all BOM updates here (add/swap materials). When done, click <strong>Confirm BOM</strong> below — then use the <strong>Batch Plan</strong> tab to set how many batches and schedule. Each batch gets its own saved BOM copy (e.g. PE-5-B1) when you save the batch plan, so this BOM is reused per batch.</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      FORMULA BOM ({bomFormula.length} RM ITEMS)
                    </h3>
                    <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                      {bomFormula.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="bg-white rounded-lg p-4 flex items-center gap-4 border border-gray-200">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                            <p className="text-xs text-blue-600 font-medium">{item.code ?? item.id} · {item.percentage}% · {item.phase ?? 'Phase A'}{item.specificGravity != null && item.specificGravity !== 1 ? ` · SG ${item.specificGravity}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <input type="number" value={item.percentage} onChange={(e) => { const updated = [...bomFormula]; updated[idx] = { ...item, percentage: parseFloat(e.target.value) }; setBomFormula(updated); }} step="0.1" className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <span className="text-sm font-semibold text-gray-600">%</span>
                            <label className="flex items-center gap-1 text-xs text-gray-600">
                              <span>SG</span>
                              <input type="number" value={item.specificGravity ?? 1} onChange={(e) => { const updated = [...bomFormula]; updated[idx] = { ...item, specificGravity: parseFloat(e.target.value) || 1 }; setBomFormula(updated); }} step="0.01" min="0.1" max="3" className="w-14 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" title="Specific gravity (vs water) for vessel volume" />
                            </label>
                            <button onClick={() => setBomFormula(bomFormula.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"><X size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="mt-4 text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-2" onClick={() => setActiveBatchTab('swap-add')}>
                      <span>+</span>Add RM via Swap Panel
                    </button>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      PACK BOM ({bomPackaging.length} PM ITEMS)
                    </h3>
                    <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                      {bomPackaging.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="bg-white rounded-lg p-4 flex items-center gap-4 border border-gray-200">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                            <p className="text-xs text-blue-600 font-medium">{item.code ?? item.id} · {idx === 0 ? 'Primary' : 'Secondary'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <input type="number" value={item.value} onChange={(e) => { const updated = [...bomPackaging]; updated[idx] = { ...item, value: parseFloat(e.target.value) }; setBomPackaging(updated); }} step="0.1" className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <span className="text-sm font-semibold text-gray-600">Qty/unit</span>
                            <button onClick={() => setBomPackaging(bomPackaging.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"><X size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-200">
                    {!canSendToProduction ? (
                      <button
                        type="button"
                        onClick={() => handleConfirmBOM()}
                        disabled={!canConfirmBomPerBatch}
                        title={
                          canConfirmBomPerBatch
                            ? 'Confirm BOM: available stock is reserved; raise POs for any gaps'
                            : 'Add RM/PM lines in the BOM editor first'
                        }
                        className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                          canConfirmBomPerBatch ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Confirm BOM
                      </button>
                    ) : (
                      <span className="px-4 py-2 rounded-lg text-sm font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200">
                        BOM Confirmed
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Swap / Add Tab */}
              {activeBatchTab === 'swap-add' && (
                <div className="bg-white">
                  <div className="bg-cyan-50 border-y border-cyan-200 px-6 py-3">
                    <p className="text-xs text-cyan-800 font-semibold">Universal Swap & Add — Click an item to swap it with a BOM ingredient, or use Quick Add to add new items.</p>
                  </div>
                  <div className="flex max-h-[60vh]">
                    <div className="flex-1 border-r border-gray-200 overflow-y-auto p-6 space-y-4">
                      {swapCategories.map((category) => (
                        <div key={category.name}>
                          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{category.name}</h3>
                          <div className="space-y-2">
                            {category.items.map((item) => {
                              const whRow = warehouseRows.find((r) => r.code === item.code);
                              const sih = whRow?.stockInHand ?? 0;
                              const handleSwapReplace = () => {
                                if (swapSourceIndex === null) return;
                                setBomFormula((prev) => {
                                  const next = [...prev];
                                  const src = next[swapSourceIndex];
                                  next[swapSourceIndex] = { id: item.id, name: item.name, quantity: 0, unit: 'KG', percentage: src?.percentage ?? 0, code: item.code, phase: src?.phase ?? 'Phase A', specificGravity: src?.specificGravity ?? 1 };
                                  return next;
                                });
                                setSwapSourceIndex(null);
                                addToast('success', `Replaced with ${item.name}. Confirm BOM to save.`);
                              };
                              return (
                                <div key={`${category.name}-${item.id}`} className="px-3 py-2 rounded-lg flex items-center justify-between gap-3 text-sm bg-white border border-gray-200">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-800 truncate">{item.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{item.code} · {item.description}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${item.status === 'IN BOM' ? 'bg-green-100 text-green-800' : item.status === 'AVAILABLE' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span>
                                    <span className="text-sm font-bold text-gray-700">{sih.toLocaleString()} KG</span>
                                    {swapSourceIndex !== null ? (
                                      <button type="button" onClick={handleSwapReplace} className="text-xs font-semibold text-purple-600 hover:text-purple-700">Use as replacement</button>
                                    ) : item.status === 'AVAILABLE' && (
                                      <button type="button" onClick={() => { const newItem: RawMaterial = { id: item.id, name: item.name, quantity: 0, unit: 'KG', percentage: 0, code: item.code, phase: 'Phase A', specificGravity: 1 }; setBomFormula([...bomFormula, newItem]); addToast('success', `Added ${item.name} to BOM — set % in BOM Editor`); }} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">+ Add</button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div className="pt-4 border-t border-gray-200">
                        <h4 className="text-xs font-bold text-gray-700 mb-3">Quick Add RM to BOM</h4>
                        <div className="space-y-2">
                          <input type="text" placeholder="RM Code" value={quickAddRmCode} onChange={(e) => setQuickAddRmCode(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                          <input type="text" placeholder="INCI Name" value={quickAddInciName} onChange={(e) => setQuickAddInciName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                          <input type="number" placeholder="%" value={quickAddPercentage} onChange={(e) => setQuickAddPercentage(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                          <button onClick={handleQuickAddRM} className="w-full px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"><span>+</span> Add to Working BOM</button>
                        </div>
                      </div>
                    </div>
                    <div className="w-2/5 bg-gray-50 border-l border-gray-200 overflow-y-auto p-6">
                      <h3 className="text-sm font-bold text-gray-800 mb-4">CURRENT BOM — {selectedSOForBatch.productName}</h3>
                      {swapSourceIndex !== null && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                          Select replacement for <strong>{bomFormula[swapSourceIndex]?.name}</strong> below (left panel). Click an available item to swap.
                          <button type="button" onClick={() => setSwapSourceIndex(null)} className="ml-2 text-amber-700 underline">Cancel</button>
                        </div>
                      )}
                      <div className="space-y-3">
                        {bomFormula.map((item, idx) => (
                          <div key={`swap-${item.id}-${idx}`} className={`bg-white rounded-lg p-3 flex items-center gap-3 border shadow-sm ${swapSourceIndex === idx ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'}`}>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.code ?? item.id} · {item.percentage}% · {item.phase ?? 'Phase A'}</p>
                            </div>
                            <button type="button" onClick={() => setSwapSourceIndex(swapSourceIndex === idx ? null : idx)} className="text-xs font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-md transition-colors">
                              {swapSourceIndex === idx ? 'Cancel' : 'Swap'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PR Modal Popup - Global: renders across all tabs */}
      {prModalOpen && selectedSO && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Raise Procurement Request</h2>
              <button onClick={() => { setPrModalOpen(false); setSelectedSO(null); setPrShowPMOnly(false); setPrOmittedCount(0); }} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
                <span className="text-yellow-500 mt-0.5">i</span>
                <span>
                  Items are linked to Raw Materials, Pack Materials, or Products (FG). You can change type, pick another item from the dropdowns, edit unit and quantity, add lines, or remove lines. Only lines with an item selected are sent.
                  {prOmittedCount > 0 && (
                    <span className="block mt-2 text-amber-700 font-medium">
                      {prOmittedCount} BOM item{prOmittedCount !== 1 ? 's' : ''} were omitted (not in RM/PM masters). You can add them manually via “Add line” and select from masters.
                    </span>
                  )}
                  <span className="block mt-2 text-gray-600 text-xs">On submit, the request is saved to the backend (procurement_requests). You’ll see it in Planning tab stats and in Procurement - Requests.</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">PRIORITY</label>
                  <select value={prPriority} onChange={(e) => setPrPriority(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">REQUIRED BY DATE</label>
                  <input type="date" value={prRequiredByDate} onChange={(e) => setPrRequiredByDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">NOTES TO PROCUREMENT</label>
                <textarea value={prNotes} onChange={(e) => setPrNotes(e.target.value)} placeholder="Any special instructions..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                  Items — linked to RM/PM/FG masters (editable)
                </h3>
                {prItems.length === 0 && (
                  <p className="text-sm text-gray-500 mb-2">No lines. Add a line and select an item from Raw Materials, Pack Materials, or Products.</p>
                )}
                {prItems.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">TYPE</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">ITEM (RM/PM/FG)</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">UNIT</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">REQ</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">SIH</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">SHORT</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">QTY REQUEST</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">NOTES</th>
                          <th className="px-2 py-2 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {prItems.map((item, idx) => (
                          <tr key={`${item.type}-${item.code}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2">
                              <select
                                value={item.type}
                                onChange={(e) => {
                                  const t = e.target.value as 'RM' | 'PM' | 'FG';
                                  updatePrItem(idx, {
                                    type: t,
                                    raw_material_id: undefined,
                                    pack_material_id: undefined,
                                    product_id: undefined,
                                    code: '',
                                    name: '',
                                    unit: t === 'PM' || t === 'FG' ? 'PCS' : 'KG',
                                  });
                                }}
                                className="w-full min-w-[4rem] px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="RM">RM</option>
                                <option value="PM">PM</option>
                                <option value="FG">FG</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              {item.type === 'RM' && (
                                <select
                                  value={item.raw_material_id ?? ''}
                                  onChange={(e) => {
                                    const id = e.target.value;
                                    const master = rawMaterialsList.find((r) => String(r.id) === id);
                                    if (master) updatePrItem(idx, { raw_material_id: parseInt(String(master.id), 10), pack_material_id: undefined, product_id: undefined, code: master.code, name: master.name, unit: master.uom || 'KG' });
                                  }}
                                  className="w-full min-w-[12rem] px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select RM…</option>
                                  {rawMaterialsList.map((r) => (
                                    <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
                                  ))}
                                </select>
                              )}
                              {item.type === 'PM' && (
                                <select
                                  value={item.pack_material_id ?? ''}
                                  onChange={(e) => {
                                    const id = e.target.value;
                                    const master = packMaterialsList.find((p) => String(p.id) === id);
                                    if (master) updatePrItem(idx, { pack_material_id: parseInt(String(master.id), 10), raw_material_id: undefined, product_id: undefined, code: master.code, name: master.description, unit: 'PCS' });
                                  }}
                                  className="w-full min-w-[12rem] px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select PM…</option>
                                  {packMaterialsList.map((p) => (
                                    <option key={p.id} value={p.id}>{p.code} — {p.description}</option>
                                  ))}
                                </select>
                              )}
                              {item.type === 'FG' && (
                                <select
                                  value={item.product_id ?? ''}
                                  onChange={(e) => {
                                    const id = e.target.value;
                                    const master = productsList.find((p) => p.product_id === parseInt(id, 10));
                                    if (master) updatePrItem(idx, { product_id: master.product_id, raw_material_id: undefined, pack_material_id: undefined, code: master.product_code, name: master.product_name, unit: 'PCS' });
                                  }}
                                  className="w-full min-w-[12rem] px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select product…</option>
                                  {productsList.map((p) => (
                                    <option key={p.product_id} value={p.product_id}>{p.product_code} — {p.product_name}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={item.unit}
                                onChange={(e) => updatePrItem(idx, { unit: e.target.value })}
                                className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                              >
                                {['KG', 'PCS', 'L', 'ML', 'G', 'BOX', 'CTN'].map((u) => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">{item.required.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-orange-600">{item.sih.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-red-600 font-medium">{item.shortage > 0 ? `+${item.shortage.toLocaleString()}` : '0'}</td>
                            <td className="px-3 py-2 text-right">
                              <input type="number" min={0} value={item.quantity_requested} onChange={(e) => updatePrItem(idx, { quantity_requested: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="text" value={item.line_notes ?? ''} onChange={(e) => updatePrItem(idx, { line_notes: e.target.value })} placeholder="Line notes" className="w-full min-w-[6rem] px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="px-2 py-2">
                              <button type="button" onClick={() => removePrLine(idx)} className="text-red-600 hover:text-red-800 text-xs font-medium" title="Remove line">X</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button type="button" onClick={addPrLine} className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 border border-gray-300 bg-white hover:bg-gray-50">
                  + Add line (RM/PM/FG)
                </button>
              </div>
            </div>
            <div className="border-t border-gray-200 p-6 flex gap-3 justify-end">
              <button onClick={() => { setPrModalOpen(false); setSelectedSO(null); setPrShowPMOnly(false); setPrOmittedCount(0); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-transparent hover:bg-gray-100 transition-colors disabled:opacity-50" disabled={prSending}>Cancel</button>
              <button onClick={handleSendToProcurement} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2" disabled={prSending}>
                {prSending ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Sending...</>) : 'Send to Procurement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Planning;
