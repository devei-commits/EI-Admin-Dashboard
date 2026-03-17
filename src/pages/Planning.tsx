import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Search, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
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
  type ProcurementRequestItem,
} from '../services/procurement.service';
import {
  fetchBOMByProductId,
  type BOMRecord,
  type BOMRmLine,
  type BOMPmLine,
} from '../services/bom.service';
import { fetchRawMaterialsList } from '../services/rawMaterials.service';
import { fetchPackMaterialsList } from '../services/packMaterials.service';
import { fetchPRProducts } from '../services/productsMaster.service';
import { fetchItemGroups } from '../services/itemGroups.service';
import { fetchWarehouseInventory } from '../services/warehouseInventory.service';

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
  inTransit: string;
  reorderPt: string;
  avgMo: string;
  status: string;
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
  shortageIdentified?: { so: number; pr: number };
  requiredLeadDays?: number;
  receivedCompleted?: { so: number; pr: number };
  criticalShortage?: { so: number; pr: number };
};

interface SalesOrder {
  id: string;
  soNumber: string;
  productName: string;
  productCode: string;
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

/** Map API row to SalesOrder shape for Plan Batches / Raise PR modals */
function apiRowToSalesOrder(row: PlanningExtractedRow): SalesOrder {
  return {
    id: row.id,
    soNumber: row.soNumber,
    productName: row.productName,
    productCode: row.productCode,
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
        Batches sent to production. Click a row to view items, available stock, and raise PR for shortfalls. Only batches you have sent from Plan Batches appear here.
      </p>
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Batch</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">SO</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Product</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Size (kg)</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Due</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Sent</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">BOM status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.planningExtractedId}-${row.id}`}
                  onClick={() => onBatchClick(row)}
                  className="border-b border-gray-100 hover:bg-emerald-50/80 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{row.batchCode ?? `PE-${row.planningExtractedId}-B${row.sequence}`}</td>
                  <td className="px-4 py-3 text-gray-700">{row.soNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{row.customerName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{row.productName ?? row.productCode ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{row.sizeKg != null ? Number(row.sizeKg) : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{row.dueDate ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {row.sent ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-gray-400">No</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.bomStatus ?? '—'}</td>
                </tr>
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
  const [activeBatchTab, setActiveBatchTab] = useState<'feasibility' | 'batch-plan' | 'bom-editor' | 'swap-add'>('feasibility');
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
  /** Indices of batches selected (checked) to send this time */
  const [batchesToSendIndices, setBatchesToSendIndices] = useState<number[]>([]);
  /** Preview qty (units) for Feasibility tab — drives req/max units and summary bar */
  const [feasibilityPreviewQty, setFeasibilityPreviewQty] = useState<number>(0);
  const location = useLocation();
  const pathTab = location.pathname.split('/planning/')[1]?.split('/')[0] || '';
  const activeMainTab: 'pis-extracted' | 'items-involved' | 'availability-summary' | 'batches' =
    pathTab === 'items-involved' ? 'items-involved' : pathTab === 'availability-summary' ? 'availability-summary' : pathTab === 'batches' ? 'batches' : 'pis-extracted';
  const [itemsInvolvedCategoryFilter, setItemsInvolvedCategoryFilter] = useState<'all' | 'RM' | 'PM' | 'shortage' | 'available'>('all');
  const [itemsInvolvedProductFilter, setItemsInvolvedProductFilter] = useState<string>('all');
  const [itemsInvolvedSearchTerm, setItemsInvolvedSearchTerm] = useState('');
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

  // Planning list: used for PIs Extracted tab, tab stats, and Availability Summary
  const { data: planningExtractedList = [], isLoading: planningLoading } = useQuery({
    queryKey: ['planning-extracted'],
    queryFn: fetchPlanningExtractedList,
    enabled: true,
  });
  const pisRows: SalesOrder[] = useMemo(
    () => planningExtractedList.map(apiRowToSalesOrder),
    [planningExtractedList]
  );

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
      const qtyPerUnit = (line as { quantity?: number }).quantity ?? ((line.pct_w_w ?? (line as { pct?: number }).pct ?? 0) / 100);
      const totalQty = qtyPerUnit * orderQty;
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
  }, [bomForDetail, orderQtyNumForDetail]);

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
    enabled: planBatchesModalOpen || prModalOpen || activeMainTab === 'availability-summary' || detailModalOpen || batchForDetailModal != null,
  });
  const warehouseRows = useMemo(() => warehouseResult?.rows ?? [], [warehouseResult?.rows]);

  // Procurement requests: for tab stats (prsRaised, availability-summary counts)
  const { data: procurementListResult } = useQuery({
    queryKey: ['procurement-requests'],
    queryFn: () => fetchProcurementRequests(),
    enabled: true,
  });
  const procurementRequests = procurementListResult?.data ?? [];

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
    const row = planningRowForBatch as { batchCount?: number; batchSizeKg?: number; plannedStartDate?: string; productionLine?: string; customBatches?: { sizeKg: number }[] | null };
    if (row.batchCount != null) setNumBatches(String(row.batchCount));
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
      addOneBatchFromMaster(planningIdForBatch).then((newBatch) => {
        if (newBatch) {
          queryClient.invalidateQueries({ queryKey: ['planning-batches', planningIdForBatch] });
          setSelectedBatchId(newBatch.id);
        }
      });
      return;
    }
    if (planningBatches.length > 0) {
      addedOneBatchRef.current = true;
      const first = planningBatches[0] as PlanningBatchRow;
      if (selectedBatchId === null || !planningBatches.some((b: PlanningBatchRow) => b.id === selectedBatchId)) {
        setSelectedBatchId(first.id);
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

  const lastSyncedBomIdRef = useRef<string | null>(null);
  const syncedFallbackOrderIdRef = useRef<string | null>(null);
  const prFromBatchShortagesRef = useRef(false);
  const prFromDetailShortagesRef = useRef(false);
  /** When set, PR is being raised for a specific batch (from "Raise PR for this batch"); used to send planningBatchId. */
  const prForBatchIndexRef = useRef<number | null>(null);
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
        const perBatch = (batchSizeNum * pct) / 100;
        const kgPerUnitRm = kgPerUnitOfProduct > 0 ? (pct / 100) * kgPerUnitOfProduct : perBatch / (unitsPerBatch || 1);
        const whRow = warehouseRows.find((r) => r.type === 'RM' && (r.code === code || r.name === item.name || String(r.sourceId) === String(item.id)));
        const sih = whRow?.stockInHand ?? 0;
        const reserved = whRow?.reserved ?? 0;
        const free = Math.max(0, sih - reserved);
        const inTransit = whRow?.inTransit ?? 0;
        const reqThisOrder = kgPerUnitRm * feasibilityPreviewQty;
        const maxUnits = kgPerUnitRm > 0 ? Math.floor(sih / kgPerUnitRm) : 999;
        const maxBatches = perBatch > 0 ? Math.floor(sih / perBatch) : 999;
        const totalReq = kgPerUnitOfProduct > 0 ? (pct / 100) * totalKgNum : perBatch * batchesReq;
        const gap = Math.max(0, reqThisOrder - free);
        return { name: item.name, code: String(code), pct, perBatch, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= feasibilityPreviewQty };
      });
    }
    if (activeBom?.rmLines?.length) {
      return activeBom.rmLines.map((line, i) => {
        const code = line.rm_code ?? String(line.raw_material_id ?? i);
        const pct = line.pct_w_w ?? line.pct ?? 0;
        const perBatch = (batchSizeNum * pct) / 100;
        const kgPerUnitRm = kgPerUnitOfProduct > 0 ? (pct / 100) * kgPerUnitOfProduct : perBatch / (unitsPerBatch || 1);
        const whRow = warehouseRows.find((r) => r.type === 'RM' && (r.code === code || String(r.sourceId) === String(line.raw_material_id)));
        const sih = whRow?.stockInHand ?? 0;
        const reserved = whRow?.reserved ?? 0;
        const free = Math.max(0, sih - reserved);
        const inTransit = whRow?.inTransit ?? 0;
        const reqThisOrder = kgPerUnitRm * feasibilityPreviewQty;
        const maxUnits = kgPerUnitRm > 0 ? Math.floor(sih / kgPerUnitRm) : 999;
        const maxBatches = perBatch > 0 ? Math.floor(sih / perBatch) : 999;
        const totalReq = kgPerUnitOfProduct > 0 ? (pct / 100) * totalKgNum : perBatch * batchesReq;
        const gap = Math.max(0, reqThisOrder - free);
        return { name: line.inci_name ?? code, code, pct, perBatch, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= feasibilityPreviewQty };
      });
    }
    return (selectedSOForBatch?.rawMaterials ?? []).map((item) => {
      const pct = item.percentage || 0;
      const perBatch = (batchSizeNum * pct) / 100;
      const kgPerUnitRm = kgPerUnitOfProduct > 0 ? (pct / 100) * kgPerUnitOfProduct : perBatch / (unitsPerBatch || 1);
      const whRow = warehouseRows.find((r) => r.type === 'RM' && (r.name === item.name || r.code === (item as RawMaterial).code));
      const sih = whRow?.stockInHand ?? item.quantity ?? 0;
      const reserved = whRow?.reserved ?? 0;
      const free = Math.max(0, sih - reserved);
      const inTransit = whRow?.inTransit ?? 0;
      const reqThisOrder = kgPerUnitRm * feasibilityPreviewQty;
      const maxUnits = kgPerUnitRm > 0 ? Math.floor(sih / kgPerUnitRm) : 999;
      const maxBatches = perBatch > 0 ? Math.floor(sih / perBatch) : 999;
      const totalReq = kgPerUnitOfProduct > 0 ? (pct / 100) * totalKgNum : perBatch * batchesReq;
      const gap = Math.max(0, reqThisOrder - free);
      return { name: item.name, code: (item as RawMaterial).code ?? item.id, pct, perBatch, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= feasibilityPreviewQty };
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
        const maxUnits = qtyPerUnit > 0 ? Math.floor(sih / qtyPerUnit) : 999;
        const maxBatches = perBatchPcs > 0 ? Math.floor(sih / perBatchPcs) : 999;
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
        const maxUnits = qtyPerUnit > 0 ? Math.floor(sih / qtyPerUnit) : 999;
        const maxBatches = perBatchPcs > 0 ? Math.floor(sih / perBatchPcs) : 999;
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
      const maxUnits = qtyPerUnit > 0 ? Math.floor(sih / qtyPerUnit) : 999;
      const maxBatches = perBatchPcs > 0 ? Math.floor(sih / perBatchPcs) : 999;
      const totalReq = qtyPerUnit * orderQtyNum;
      const gap = Math.max(0, reqThisOrder - free);
      return { name: item.name, code: (item as PackagingMaterial).code ?? item.id, qtyPerUnit, perBatchPcs, sih, reserved, free, inTransit, gap, maxBatches, totalReq, reqThisOrder, maxUnits, ok: maxUnits >= feasibilityPreviewQty };
    });
  }, [bomPackaging, activeBom?.pmLines, selectedSOForBatch?.packagingMaterials, selectedSOForBatch?.orderQty, selectedSOForBatch?.batchesRequired, warehouseRows, batchesReq, orderQtyNum, feasibilityPreviewQty]);

  // Feasibility summary: max units we can make (bottleneck by RM and PM)
  const feasibilityRmCoversUnits = feasibilityRmRows.length > 0 ? Math.min(...feasibilityRmRows.map((r) => r.maxUnits)) : 0;
  const feasibilityPmCoversUnits = feasibilityPmRows.length > 0 ? Math.min(...feasibilityPmRows.map((r) => r.maxUnits)) : 0;
  const feasibilityExecutableUnits = Math.min(feasibilityRmCoversUnits, feasibilityPmCoversUnits);

  // Items Involved — from confirmed BOMs only (API); also used by Availability Summary RM/PM tables and tab stats
  const { data: itemsInvolvedRows = [], isLoading: itemsInvolvedLoading } = useQuery({
    queryKey: ['planning', 'items-involved'],
    queryFn: fetchItemsInvolved,
    enabled: activeMainTab === 'items-involved' || activeMainTab === 'availability-summary',
  });
  const itemsInvolved = useMemo(() => itemsInvolvedRows.map((row): ItemsInvolvedDisplayRow => {
    const shortage = row.surplusShortage < 0 ? Math.abs(row.surplusShortage) : 0;
    const surplusShortageStr = row.surplusShortage >= 0 ? `+${Math.round(row.surplusShortage).toLocaleString()}` : `-${Math.round(shortage).toLocaleString()}`;
    const totalReqStr = `${Math.round(row.totalRequired).toLocaleString()}${row.unit === 'KG' ? ' KG' : 'pcs'}`;
    const sihStr = Math.round(row.sih).toLocaleString();
    const unitSuffix = row.unit === 'KG' ? ' KG' : row.unit === 'PCS' ? ' pcs' : '';
    return {
      id: `${row.type}-${row.raw_material_id ?? row.pack_material_id}`,
      name: row.name,
      code: row.code,
      category: row.type === 'PM' ? 'PM - Primary' : 'RM',
      usedIn: String(row.usedInProducts?.length ?? 0),
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
      if (itemsInvolvedCategoryFilter === 'shortage' && row.surplusShortageNum >= 0) return false;
      if (itemsInvolvedCategoryFilter === 'available' && row.surplusShortageNum < 0) return false;
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
    const prReceived = procurementRequests.filter((pr) => (pr.status === 'Received' || pr.status === 'Completed')).length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const soDueInNext7 = planningExtractedList.filter((r) => {
      const d = r.dueDate ? new Date(r.dueDate) : null;
      if (!d) return false;
      d.setHours(0, 0, 0, 0);
      const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return days <= 7 && days >= 0 && (r as { bomStatus?: string }).bomStatus !== 'Production Released';
    }).length;
    const prCritical = procurementRequests.filter((pr) => pr.priority === 'High' || pr.priority === 'Urgent').length;
    const avgLeadDays = totalSOs > 0
      ? Math.round(
        planningExtractedList.reduce((acc, r) => {
          if (!r.dueDate) return acc;
          const d = new Date(r.dueDate);
          d.setHours(0, 0, 0, 0);
          return acc + Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / totalSOs
      )
      : 0;

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
      'availability-summary': {
        shortageIdentified: { so: totalSOs, pr: prCount },
        requiredLeadDays: avgLeadDays >= 0 ? avgLeadDays : 7,
        receivedCompleted: { so: prodReleased, pr: prReceived },
        criticalShortage: { so: soDueInNext7, pr: prCritical },
      },
      'batches': {},
    };
  }, [planningExtractedList, itemsInvolvedRows, procurementRequests]);

  const currentStats = tabStats[activeMainTab];

  // Availability Summary: product cards from planning_extracted + warehouse coverage (RM/PM %)
  const availabilitySummaryProducts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const colorMap: Record<string, { icon: string; iconBg: string; iconColor: string }> = {
      pink: { icon: '', iconBg: 'bg-pink-100', iconColor: 'text-pink-600' },
      orange: { icon: '', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
      blue: { icon: '', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
      purple: { icon: '', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
    };
    return planningExtractedList.map((row) => {
      const color = (row as { color?: string }).color ?? 'purple';
      const { icon, iconBg, iconColor } = colorMap[color] ?? colorMap.purple;
      const confirmed = (row as { bomConfirmedAt?: string }).bomConfirmedAt != null;
      let rmPct = 100;
      let pmPct = 100;
      const rms = Array.isArray(row.rawMaterials) ? row.rawMaterials : [];
      const pms = Array.isArray(row.packagingMaterials) ? row.packagingMaterials : [];
      for (const rm of rms) {
        const rid = (rm as { raw_material_id?: number }).raw_material_id;
        const req = Number((rm as { quantity?: number }).quantity) || 0;
        if (req <= 0) continue;
        const wh = warehouseRows.find((w) => w.type === 'RM' && Number(w.sourceId) === Number(rid));
        const sih = wh?.stockInHand ?? 0;
        const cov = Math.min(100, Math.round((sih / req) * 100));
        if (cov < rmPct) rmPct = cov;
      }
      for (const pm of pms) {
        const pid = (pm as { pack_material_id?: number }).pack_material_id;
        const req = Number((pm as { quantity?: number }).quantity) || 0;
        if (req <= 0) continue;
        const wh = warehouseRows.find((w) => w.type === 'PM' && Number(w.sourceId) === Number(pid));
        const sih = wh?.stockInHand ?? 0;
        const cov = Math.min(100, Math.round((sih / req) * 100));
        if (cov < pmPct) pmPct = cov;
      }
      const dueDate = row.dueDate ? new Date(row.dueDate) : null;
      const dueIn = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return {
        id: String(row.id),
        name: row.productName?.toUpperCase() ?? `Product ${row.id}`,
        icon,
        iconBg,
        iconColor,
        rmPercentage: rmPct,
        pmPercentage: pmPct,
        status: confirmed ? 'confirmed' : 'pending',
        statusColor: confirmed ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700',
        dueIn,
        soId: String(row.id),
      };
    });
  }, [planningExtractedList, warehouseRows]);

  // Fallback when API returns no rows (empty state); all list data comes from planning-extracted API
  const initialSalesOrders: SalesOrder[] = [];

  const [salesOrders] = useState<SalesOrder[]>(initialSalesOrders);

  const ordersForLookup = useMemo(() => (pisRows.length > 0 ? pisRows : salesOrders), [pisRows, salesOrders]);

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


  const openDetailModal = (order: SalesOrder) => {
    setSelectedRowForDetail(order);
    setDetailModalOpen(true);
  };
  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedRowForDetail(null);
  };

  const handlePlanBatches = (order: SalesOrder) => {
    setSelectedSOForBatch(order);
    setBatchesToSendIndices([]);
    setBomFormula((order.rawMaterials ?? []).map((rm) => ({ ...rm, specificGravity: (rm as RawMaterial).specificGravity ?? (rm as { specific_gravity?: number }).specific_gravity ?? 1 })));
    setBomPackaging(order.packagingMaterials);
    setIsReadyForProduction(false);
    setActiveBatchTab('feasibility');
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
    const batches = order.customBatches?.length
      ? order.customBatches
      : Array.from({ length: order.batchCount ?? order.batchesRequired ?? 1 }, () => ({ sizeKg: batchSizeKg }));
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
      await updatePlanningExtracted(selectedSOForBatch.id, {
        bomConfirmedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
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
      ? (planningBatches as PlanningBatchRow[]).findIndex((b) => b.id === selectedBatchId)
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
    setActiveBatchTab('feasibility');
    setNumBatches('1');
    setBatchSizeKg('500');
    setPlannedStartDate(new Date().toISOString().split('T')[0]);
    setProductionLine('Line 1 — Primary Mixer');
    setIsReadyForProduction(false);
    setCustomBatches([]);
    setExpandedBatchIndex(null);
    setBatchesToSendIndices([]);
    setSelectedBatchId(null);
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
          ) : activeMainTab === 'availability-summary' ? (
            <>
              <div className="bg-white rounded-lg p-4 border border-gray-200 col-span-2">
                <p className="text-gray-600 text-xs font-medium mb-1">SHORTAGE IDENTIFIED (SO/PR)</p>
                <p className="text-2xl font-bold text-orange-600">{(currentStats as PlanningTabStats).shortageIdentified.so} / {(currentStats as PlanningTabStats).shortageIdentified.pr}</p>
                <p className="text-xs text-gray-500 mt-1">Orders with shortages</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">REQUIRED LEAD DAYS (DAYS)</p>
                <p className="text-2xl font-bold text-blue-600">{(currentStats as PlanningTabStats).requiredLeadDays}</p>
                <p className="text-xs text-gray-500 mt-1">Average lead time</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200 col-span-2">
                <p className="text-gray-600 text-xs font-medium mb-1">RECEIVED & COMPLETED (SO/PR)</p>
                <p className="text-2xl font-bold text-green-600">{(currentStats as PlanningTabStats).receivedCompleted.so} / {(currentStats as PlanningTabStats).receivedCompleted.pr}</p>
                <p className="text-xs text-gray-500 mt-1">Fulfilled orders</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 text-xs font-medium mb-1">CRITICAL SHORTAGE (SO/PR)</p>
                <p className="text-2xl font-bold text-red-600">{(currentStats as PlanningTabStats).criticalShortage.so} / {(currentStats as PlanningTabStats).criticalShortage.pr}</p>
                <p className="text-xs text-gray-500 mt-1">Urgent orders</p>
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
            to="/planning/items-involved"
            className={({ isActive }) =>
              `px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${isActive ? 'text-emerald-700 border-emerald-700' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`
            }
          >
            Items Involved
          </NavLink>
          <NavLink
            to="/planning/availability-summary"
            className={({ isActive }) =>
              `px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${isActive ? 'text-emerald-700 border-emerald-700' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`
            }
          >
            Availability Summary
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
        </div>

        {/* PIs Extracted Tab Content */}
        {activeMainTab === 'pis-extracted' && (
          <>
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
            <div className="space-y-4">
              {filteredPisOrders.map((order) => (
                <div
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetailModal(order)}
                  onKeyDown={(e) => e.key === 'Enter' && openDetailModal(order)}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all"
                >
                  <div className="w-full p-4 flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${order.color === 'pink' ? 'bg-pink-400' : order.color === 'orange' ? 'bg-orange-400' : order.color === 'blue' ? 'bg-blue-400' : 'bg-purple-400'
                        }`}
                    >
                      {order.productName.charAt(0)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{order.productName}</h3>
                        <span className="text-xs text-gray-500">{order.soNumber}</span>
                        <select
                          value={order.bomStatus}
                          onChange={async (e) => {
                            e.stopPropagation();
                            const newStatus = e.target.value as SalesOrder['bomStatus'];
                            try {
                              await updatePlanningExtracted(order.id, { bomStatus: newStatus });
                              queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
                              addToast('success', 'Status updated');
                            } catch (err) {
                              addToast('error', err instanceof Error ? err.message : 'Failed to update status');
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-xs px-2 py-1 rounded border-0 cursor-pointer font-medium ${getStatusBadgeColor(order.bomStatus)}`}
                        >
                          <option value="Planned">Planned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Production Ready">Production Ready</option>
                          <option value="Production Released">Production Released</option>
                        </select>
                      </div>
                      <p className="text-sm text-gray-600">{order.productCode} · SO: {order.soNumber}</p>
                      {(order.batchCount != null || (order.sentBatchIndices?.length ?? 0) > 0) && (
                        <p className="text-xs text-gray-500 mt-1">
                          Target: <span className="font-medium text-gray-700">{order.orderQty}</span>
                          {' · '}
                          Batches sent: <span className="font-medium text-emerald-700">{order.sentBatchIndices?.length ?? 0}</span>
                          {(order.batchCount != null || order.batchesRequired != null) && (
                            <span> / {order.batchCount ?? order.batchesRequired}</span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-8 mr-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{order.orderQty}</p>
                        <p className="text-xs text-gray-500">{order.totalKg} total</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-700">{order.daysLeft}</p>
                        <p className="text-xs text-gray-500">Due {order.dueDate}</p>
                      </div>
                    </div>
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))}
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
                        ['Batch Size', selectedRowForDetail.batchSize],
                        ['Batches Required', `${selectedRowForDetail.batchesRequired} batches`],
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
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">BATCHES</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">TOTAL REQ</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">STOCK IN HAND</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">RESERVED</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">IN TRANSIT</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">REORDER PT</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">AVG/MO</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">QC / STATUS</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">SURPLUS/<br />SHORTAGE</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">COVERAGE</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">WH BATCHES</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">EXPIRY</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">BOM FLAG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItemsInvolved.map((item, idx) => (
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
                          <div className="w-5 h-5 bg-pink-100 rounded-full flex items-center justify-center mx-auto">
                            <span className="text-xs font-bold text-pink-700">{item.usedIn}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center text-gray-700 text-xs font-medium" title="Production batches using this item">
                          {item.batchCount}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-900 text-xs">{item.totalReq}</td>
                        <td className="px-2 py-2 text-right text-orange-600 font-medium text-xs">{item.sih}</td>
                        <td className="px-2 py-2 text-right text-amber-700 text-xs">{item.reserved}</td>
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
                        <td className={`px-2 py-2 text-right font-semibold text-xs ${item.surplusShortage.includes('-') ? 'text-red-600' : 'text-green-600'
                          }`}>
                          {item.surplusShortage}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Availability Summary Tab */}
        {activeMainTab === 'availability-summary' && (
          <>
            <div className="space-y-4">
              {/* Product Cards Row */}
              <div className="grid grid-cols-4 gap-4">
                {availabilitySummaryProducts.map((product) => (
                  <div key={product.id} className="bg-white rounded-lg border border-gray-200 p-4">
                    {/* Product Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg ${product.iconBg} flex items-center justify-center text-xl`}>
                        {product.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xs font-bold text-gray-900 uppercase">{product.name}</h3>
                      </div>
                    </div>

                    {/* Stats and Status */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700">RM</span>
                        <span className="text-xs font-bold text-cyan-600">{product.rmPercentage}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700">PM</span>
                        <span className="text-xs font-bold text-purple-600">{product.pmPercentage}%</span>
                      </div>
                      <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${product.statusColor}`}>
                        {product.status}
                      </span>
                    </div>

                    {/* Due Date */}
                    <p className="text-xs text-gray-500 mb-3">Due in {product.dueIn} days</p>

                    {/* Plan Batches Button */}
                    <button
                      onClick={() => {
                        const correspondingSO = ordersForLookup.find(so => so.id === product.soId);
                        if (!correspondingSO && ordersForLookup.length === 0) {
                          addToast('error', 'No sales orders available');
                          return;
                        }
                        const soToUse = correspondingSO || ordersForLookup[0];

                        // Set selected SO first
                        setSelectedSOForBatch(soToUse);
                        setBatchesToSendIndices([]);

                        // Initialize batch data
                        setNumBatches(soToUse.batchesRequired.toString());
                        setBatchSizeKg(soToUse.batchSize.includes(' KG') ? soToUse.batchSize.replace(' KG', '') : soToUse.batchSize);
                        setPlannedStartDate('2026-03-05');
                        setProductionLine('Line 1 — Primary Mixer');

                        // Set BOM data
                        setBomFormula((soToUse.rawMaterials ?? []).map((rm) => ({ ...rm, specificGravity: (rm as RawMaterial).specificGravity ?? (rm as { specific_gravity?: number }).specific_gravity ?? 1 })));
                        setBomPackaging(soToUse.packagingMaterials);

                        // Set production status
                        setIsReadyForProduction(soToUse.bomStatus === 'Production Ready' || soToUse.bomStatus === 'Production Released');

                        // Set active tab
                        setActiveBatchTab('feasibility');

                        // Open modal
                        setPlanBatchesModalOpen(true);

                        console.log('[Plan Batches] Modal opened, planBatchesModalOpen = true, selectedSOForBatch set');
                      }}
                      className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs font-semibold transition-colors"
                    >
                      Plan Batches
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </>
        )}

        {/* Batches Tab — list all batches we've sent out (batch code, SO, product, sent status, BOM summary) */}
        {activeMainTab === 'batches' && <PlanningBatchesTab onBatchClick={setBatchForDetailModal} />}

      </div>

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
        const prRaisedForBatchItem = (row: BatchDetailRow) =>
          procurementRequests.some(
            (pr) =>
              Number(pr.planningBatchId) === Number(batch.id) &&
              Array.isArray(pr.items) &&
              pr.items.some(
                (item: { raw_material_id?: number; pack_material_id?: number }) =>
                  row.type === 'RM'
                    ? item.raw_material_id === row.raw_material_id
                    : item.pack_material_id === row.pack_material_id
              )
          );
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
                {batch.productName ?? batch.productCode ?? '—'} · SO {batch.soNumber ?? '—'} · Size {sizeKg} kg · Raise PR for shortfalls (PR linked to this batch).
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
                      <th className="px-3 py-2 text-center font-semibold text-gray-700">Action</th>
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
                        <td className="px-3 py-2 text-center">
                          {row.shortfall > 0 && (row.raw_material_id != null || row.pack_material_id != null) ? (
                            prRaisedForBatchItem(row) ? (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                PR raised
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setBatchPrModal({ batch, row: { id: row.id, type: row.type, name: row.name, code: row.code, required: row.required, unit: row.unit, sih: row.sih, shortfall: row.shortfall, raw_material_id: row.raw_material_id, pack_material_id: row.pack_material_id } });
                                  setBatchPrQty(row.shortfall);
                                  setBatchPrPriority('High');
                                  setBatchPrRequiredBy(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
                                  setBatchPrNotes(`Batch ${batch.batchCode ?? `#${batch.id}`}: ${row.name} (${row.code})`);
                                }}
                                className="px-2 py-1 bg-amber-100 text-amber-800 rounded font-semibold text-xs hover:bg-amber-200"
                              >
                                Raise PR
                              </button>
                            )
                          ) : row.shortfall > 0 ? (
                            <span className="text-gray-400 text-xs">—</span>
                          ) : (
                            <span className="text-emerald-600 text-xs font-medium">OK</span>
                          )}
                        </td>
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
                const alreadySent = Boolean(batch.sent);
                if (alreadySent) {
                  return (
                    <div className="px-4 py-3 border-t border-gray-200 bg-emerald-50 flex items-center justify-between">
                      <span className="text-sm font-medium text-emerald-800">Sent to production — can be scheduled in Production → Calendar.</span>
                      <button type="button" onClick={() => setBatchForDetailModal(null)} className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                    </div>
                  );
                }
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
              {/* Batch selector: dropdown + Add batch (batch-first; each batch has its own BOM) */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch</span>
                <div className="flex items-center gap-1 border border-gray-300 rounded-lg bg-white overflow-hidden">
                  <select
                    value={selectedBatchId ?? ''}
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
                      <option key={b.id} value={b.id}>
                        {b.batchCode ?? `batch-${String(idx + 1).padStart(2, '0')}`}
                      </option>
                    ))}
                    {selectedBatchId != null && !(planningBatches as PlanningBatchRow[]).some((b) => b.id === selectedBatchId) && (
                      <option value={selectedBatchId}>Loading...</option>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      const newBatch = await addOneBatchFromMaster(planningIdForBatch);
                      if (newBatch) {
                        queryClient.invalidateQueries({ queryKey: ['planning-batches', planningIdForBatch] });
                        setSelectedBatchId(newBatch.id);
                        addToast('success', `Added ${newBatch.batchCode ?? 'new batch'} (BOM from product master).`);
                      } else {
                        addToast('error', 'Failed to add batch');
                      }
                    }}
                    className="px-2 py-2 text-emerald-600 hover:bg-emerald-50 border-l border-gray-200"
                    title="Add new batch (BOM from product master)"
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

              {/* Tabs */}
              {/* Tab order: BOM work first (Feasibility, BOM Editor, Swap/Add), then Batch Plan after BOM is confirmed */}
              <div className="flex gap-4 border-b border-gray-200">
                <button
                  onClick={() => setActiveBatchTab('feasibility')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${activeBatchTab === 'feasibility'
                    ? 'text-emerald-700 border-b-2 border-emerald-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Feasibility
                </button>
                <button
                  onClick={() => setActiveBatchTab('bom-editor')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${activeBatchTab === 'bom-editor'
                    ? 'text-emerald-700 border-b-2 border-emerald-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  BOM Editor
                </button>
                <button
                  onClick={() => setActiveBatchTab('swap-add')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${activeBatchTab === 'swap-add'
                    ? 'text-emerald-700 border-b-2 border-emerald-700'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Swap / Add
                </button>
                <button
                  onClick={() => canSendToProduction && setActiveBatchTab('batch-plan')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${activeBatchTab === 'batch-plan'
                    ? 'text-emerald-700 border-b-2 border-emerald-700'
                    : canSendToProduction
                      ? 'text-gray-600 hover:text-gray-900'
                      : 'text-gray-400 cursor-not-allowed'
                    }`}
                  title={canSendToProduction ? 'Set number of batches and schedule' : 'Confirm BOM first, then set batches here'}
                >
                  Batch Plan
                </button>
              </div>

              {/* Tab Content */}
              {activeBatchTab === 'feasibility' && (
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

                  {/* Order summary + Preview qty */}
                  <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
                    <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-2">
                      <p className="text-xs font-semibold text-cyan-900">
                        Order: {selectedSOForBatch.orderQty} · Total KG: {selectedSOForBatch.totalKg} · Batch KG: {selectedSOForBatch.batchSize} · {selectedSOForBatch.batchesRequired} batches required
                      </p>
                    </div>
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
                            {feasibilityRmRows.map((row, idx) => (
                              <tr key={`rm-${row.code}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-3 py-2 text-gray-900">
                                  <span className="font-medium text-xs">{row.name}</span>
                                  <div className="text-[10px] text-gray-500">{row.code} · kg</div>
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">{row.reqThisOrder.toFixed(2)}</td>
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
                </div>
              )}

              {/* Batch Plan Tab — custom batch sizes + per-batch material requirements */}
              {activeBatchTab === 'batch-plan' && (() => {
                const orderTotalKg = parseFloat(selectedSOForBatch.totalKg?.replace(/[^\d.]/g, '') || '0') || 0;
                const orderQtyNum = parseInt(selectedSOForBatch.orderQty?.replace(/\D/g, '') || '0', 10) || 0;
                const kgPerUnit = orderQtyNum > 0 ? orderTotalKg / orderQtyNum : orderTotalKg || 1;
                const batchTotal = customBatches.reduce((sum, b) => sum + (b.sizeKg || 0), 0);
                const batchTotalUnits = kgPerUnit > 0 ? batchTotal / kgPerUnit : 0;
                const remaining = orderTotalKg - batchTotal;
                const remainingUnits = kgPerUnit > 0 ? remaining / kgPerUnit : 0;
                const addBatch = async () => {
                  const newBatch = await addOneBatchFromMaster(selectedSOForBatch.id);
                  if (newBatch) {
                    queryClient.invalidateQueries({ queryKey: ['planning-batches', selectedSOForBatch.id] });
                    setSelectedBatchId(newBatch.id);
                    addToast('success', `Added ${newBatch.batchCode ?? 'batch'} (BOM from master).`);
                  }
                };
                const removeBatch = (idx: number) => {
                  setCustomBatches(customBatches.filter((_, i) => i !== idx));
                  if (expandedBatchIndex === idx) setExpandedBatchIndex(null);
                  else if (expandedBatchIndex !== null && expandedBatchIndex > idx) setExpandedBatchIndex(expandedBatchIndex - 1);
                };
                /** Update batch by quantity (units to be made); persists sizeKg to backend when batch has id */
                const updateBatchUnits = (idx: number, units: number) => {
                  const sizeKg = units * kgPerUnit;
                  setCustomBatches(customBatches.map((b, i) => i === idx ? { ...b, sizeKg } : b));
                  const batchRow = (planningBatches as PlanningBatchRow[])[idx];
                  if (batchRow?.id && selectedSOForBatch) {
                    updatePlanningBatch(selectedSOForBatch.id, batchRow.id, { sizeKg }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['planning-batches', selectedSOForBatch.id] });
                    });
                  }
                };

                /** Per-batch requirements in BATCH BREAKDOWN: use that batch's own BOM (planningBatches[batchIndex]), not the selected batch. */
                const getBatchRmRequirementsForBatchIndex = (batchSizeForCalc: number, batchIndex: number) => {
                  const batchRow = (planningBatches as PlanningBatchRow[])[batchIndex];
                  const rmLines = Array.isArray(batchRow?.rmLines) ? batchRow.rmLines : [];
                  if (rmLines.length === 0) return [];
                  return rmLines.map((line: { inci_name?: string; rm_code?: string; pct_w_w?: number; pct?: number; uom?: string }) => {
                    const pct = line.pct_w_w ?? (line as { pct?: number }).pct ?? 0;
                    const required = (batchSizeForCalc * pct) / 100;
                    return { name: line.inci_name ?? line.rm_code ?? '—', code: line.rm_code ?? '', pct, required, uom: line.uom ?? 'KG' };
                  });
                };
                const getBatchPmRequirementsForBatchIndex = (batchSizeForCalc: number, batchIndex: number) => {
                  const batchRow = (planningBatches as PlanningBatchRow[])[batchIndex];
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

                    {/* Custom batch list */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-900">BATCH BREAKDOWN</h3>
                        <div className="flex items-center gap-2">
                          {canSendToProduction && customBatches.some((_, idx) => !(selectedSOForBatch?.sentBatchIndices ?? []).includes(idx)) && (
                            <button
                              type="button"
                              onClick={() => {
                                const unsent = customBatches.map((_, i) => i).filter((i) => !(selectedSOForBatch?.sentBatchIndices ?? []).includes(i));
                                const allSelected = unsent.every((i) => batchesToSendIndices.includes(i));
                                setBatchesToSendIndices(allSelected ? [] : [...new Set([...batchesToSendIndices, ...unsent])]);
                              }}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              {customBatches.every((_, idx) => (selectedSOForBatch?.sentBatchIndices ?? []).includes(idx) || batchesToSendIndices.includes(idx)) ? 'Deselect all' : 'Select all unsent'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => addBatch()}
                            className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-200 transition-colors"
                          >
                            + Add Batch
                          </button>
                        </div>
                      </div>

                      {customBatches.length === 0 && (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-sm text-gray-500">No batches defined. Click "+ Add Batch" to split the SO quantity.</p>
                          {orderQtyNum > 0 && (
                            <button type="button" onClick={() => addBatch()} className="mt-3 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700">
                              Create single batch ({orderQtyNum.toLocaleString()} units)
                            </button>
                          )}
                        </div>
                      )}

                      <div className="space-y-3">
                        {customBatches.map((batch, idx) => {
                          const isExpanded = expandedBatchIndex === idx;
                          const sentBatchIndices = selectedSOForBatch?.sentBatchIndices ?? [];
                          const isSent = sentBatchIndices.includes(idx);
                          const isChecked = batchesToSendIndices.includes(idx);
                          const batchUnits = kgPerUnit > 0 ? batch.sizeKg / kgPerUnit : 0;
                          const rmReqs = isExpanded ? getBatchRmRequirementsForBatchIndex(batch.sizeKg, idx) : [];
                          const pmReqs = isExpanded ? getBatchPmRequirementsForBatchIndex(batch.sizeKg, idx) : [];
                          return (
                            <div key={idx} className={`border-2 rounded-lg overflow-hidden transition-colors ${isSent ? 'border-gray-200 bg-gray-100 opacity-90' : isExpanded ? 'border-emerald-400 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}>
                              <div className="flex items-center gap-3 p-4">
                                {canSendToProduction && !isSent && (
                                  <label className="flex items-center gap-1.5 shrink-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => setBatchesToSendIndices((prev) => prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx])}
                                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs font-medium text-gray-700">Send</span>
                                  </label>
                                )}
                                {isSent && (
                                  <span className="shrink-0 text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded">Sent</span>
                                )}
                                <div
                                  className="flex-1 flex items-center gap-4 cursor-pointer"
                                  onClick={() => setExpandedBatchIndex(isExpanded ? null : idx)}
                                >
                                  <span className={`text-sm font-bold px-3 py-1 rounded-md ${isSent ? 'text-gray-500 bg-gray-200' : 'text-emerald-700 bg-emerald-100'}`}>
                                    B-{String(idx + 1).padStart(2, '0')}
                                  </span>
                                  {planningBatches[idx]?.batchCode && (
                                    <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded" title="Batch ID (BOM copy saved for this batch)">
                                      {planningBatches[idx].batchCode}
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
                                    onChange={(e) => updateBatchUnits(idx, parseFloat(e.target.value) || 0)}
                                    disabled={isSent}
                                    className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    min={0}
                                  />
                                  <span className="text-xs font-semibold text-gray-600">units</span>
                                  {!isSent && (
                                    <button
                                      type="button"
                                      onClick={() => removeBatch(idx)}
                                      className="ml-2 text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
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
                                      <h4 className="text-xs font-bold text-teal-700 mb-2">RM REQUIRED FOR B-{String(idx + 1).padStart(2, '0')} ({Math.round(batchUnits).toLocaleString()} units — scales to kg below)</h4>
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
                                              <td className="px-3 py-1.5 text-right font-bold text-teal-800">{rmReqs.reduce((s, r) => s + r.required, 0).toFixed(2)} KG</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                  {pmReqs.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-bold text-orange-700 mb-2">PM REQUIRED FOR B-{String(idx + 1).padStart(2, '0')} ({Math.round(batchUnits).toLocaleString()} units)</h4>
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
                    <button type="button" onClick={handleSaveBatchPlan} className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700">
                      Save Batch Plan
                    </button>
                  </div>
                );
              })()}

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

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 flex gap-3 justify-between">
              <button
                onClick={() => { setPlanBatchesModalOpen(false); setSelectedSOForBatch(null); setSelectedBatchId(null); setIsReadyForProduction(false); setSwapSourceIndex(null); setCustomBatches([]); setExpandedBatchIndex(null); setBatchesToSendIndices([]); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-2">
                {/* <button onClick={() => handleRaisePRFromBatch()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 transition-colors">
                  Raise PR for Shortages
                </button> */}
                <button onClick={() => handleConfirmBOM()} disabled={canSendToProduction} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                  {canSendToProduction ? 'BOM Confirmed' : 'Confirm BOM'}
                </button>
                {canSendToProduction && (() => {
                  const sendSelectedIndex = selectedBatchId != null && planningBatches.length > 0
                    ? (planningBatches as PlanningBatchRow[]).findIndex((b) => b.id === selectedBatchId)
                    : -1;
                  const sendLabel = sendSelectedIndex >= 0
                    ? `Send B-${String(sendSelectedIndex + 1).padStart(2, '0')} to Production`
                    : 'Send to Production';
                  const alreadySent = sendSelectedIndex >= 0 && (selectedSOForBatch?.sentBatchIndices ?? []).includes(sendSelectedIndex);
                  return (
                    <button
                      onClick={() => handleSendToProduction()}
                      disabled={sendSelectedIndex < 0 || alreadySent}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {alreadySent ? `${sendLabel} (already sent)` : sendLabel}
                    </button>
                  );
                })()}
              </div>
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
