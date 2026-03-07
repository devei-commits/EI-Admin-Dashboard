import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Search, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import {
  fetchPlanningExtractedList,
  fetchPlanningExtractedById,
  updatePlanningExtracted,
  fetchItemsInvolved,
  type PlanningExtractedRow,
} from '../services/planningExtracted.service';
import {
  createProcurementRequest,
  fetchProcurementRequests,
  type ProcurementRequestItem,
} from '../services/procurement.service';
import {
  fetchBOMByProductId,
  updateBOM,
  type BOMRecord,
  type BOMRmLine,
  type BOMPmLine,
} from '../services/bom.service';
import { fetchRawMaterialsList } from '../services/rawMaterials.service';
import { fetchPackMaterialsList } from '../services/packMaterials.service';
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
}

import { FeasibilityCard } from '../components/FeasibilityCard';

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
  };
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
  const location = useLocation();
  const pathTab = location.pathname.split('/planning/')[1]?.split('/')[0] || '';
  const activeMainTab: 'pis-extracted' | 'items-involved' | 'availability-summary' =
    pathTab === 'items-involved' ? 'items-involved' : pathTab === 'availability-summary' ? 'availability-summary' : 'pis-extracted';
  const [singleItemPrModalOpen, setSingleItemPrModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemsInvolvedDisplayRow | null>(null);
  const [singleItemPrOrderQty, setSingleItemPrOrderQty] = useState(0);
  const [singleItemPrSending, setSingleItemPrSending] = useState(false);
  const [singleItemPrPriority, setSingleItemPrPriority] = useState('High');
  const [singleItemPrRequiredByDate, setSingleItemPrRequiredByDate] = useState('2026-03-18');
  const [itemsInvolvedCategoryFilter, setItemsInvolvedCategoryFilter] = useState<'all' | 'RM' | 'PM' | 'shortage' | 'available'>('all');
  const [itemsInvolvedProductFilter, setItemsInvolvedProductFilter] = useState<string>('all');
  const [itemsInvolvedSearchTerm, setItemsInvolvedSearchTerm] = useState('');
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

  const { data: rawMaterialsList = [] } = useQuery({
    queryKey: ['raw-materials-list'],
    queryFn: () => fetchRawMaterialsList(),
    enabled: planBatchesModalOpen || prModalOpen,
  });
  const { data: packMaterialsList = [] } = useQuery({
    queryKey: ['pack-materials-list'],
    queryFn: () => fetchPackMaterialsList(),
    enabled: planBatchesModalOpen || prModalOpen,
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
    enabled: planBatchesModalOpen || prModalOpen || activeMainTab === 'availability-summary',
  });
  const warehouseRows = warehouseResult?.rows ?? [];

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

  useEffect(() => {
    if (!planBatchesModalOpen || !selectedSOForBatch || !planningRowForBatch) return;
    const row = planningRowForBatch as { batchCount?: number; batchSizeKg?: number; plannedStartDate?: string; productionLine?: string };
    if (row.batchCount != null) setNumBatches(String(row.batchCount));
    if (row.batchSizeKg != null) setBatchSizeKg(String(row.batchSizeKg));
    if (row.plannedStartDate) setPlannedStartDate(row.plannedStartDate);
    if (row.productionLine) setProductionLine(row.productionLine);
  }, [planBatchesModalOpen, selectedSOForBatch?.id, planningRowForBatch]);

  const lastSyncedBomIdRef = useRef<string | null>(null);
  const syncedFallbackOrderIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!planBatchesModalOpen || !selectedSOForBatch) return;
    if (activeBom && activeBom.productId === selectedSOForBatch.productId) {
      if (lastSyncedBomIdRef.current === activeBom.id) return;
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
  }, [planBatchesModalOpen, selectedSOForBatch?.id, selectedSOForBatch?.productId, selectedSOForBatch?.rawMaterials, selectedSOForBatch?.packagingMaterials, activeBom?.id, activeBom?.productId, activeBom?.rmLines, activeBom?.pmLines]);

  useEffect(() => {
    if (!planBatchesModalOpen) {
      lastSyncedBomIdRef.current = null;
      syncedFallbackOrderIdRef.current = null;
    }
  }, [planBatchesModalOpen]);

  // When PR modal opens, build prItems only from items that exist in RM/PM master tables (raw_materials, pack_materials)
  useEffect(() => {
    if (!prModalOpen || !selectedSO) {
      setPrItems([]);
      setPrOmittedCount(0);
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
    setPrItems(items);
    setPrOmittedCount(omitted);
  }, [prModalOpen, selectedSO?.id, selectedSO?.rawMaterials, selectedSO?.packagingMaterials, prShowPMOnly, warehouseRows, rawMaterialsList, packMaterialsList]);

  const batchSizeNum = parseInt(selectedSOForBatch?.batchSize?.replace(/\D/g, '') || '500', 10) || 500;
  const batchesReq = selectedSOForBatch?.batchesRequired ?? 15;
  const feasibilityRmRows = useMemo(() => {
    if (activeBom?.rmLines?.length) {
      return activeBom.rmLines.map((line, i) => {
        const code = line.rm_code ?? String(line.raw_material_id ?? i);
        const pct = line.pct_w_w ?? line.pct ?? 0;
        const perBatch = (batchSizeNum * pct) / 100;
        const whRow = warehouseRows.find((r) => r.type === 'RM' && (r.code === code || String(r.sourceId) === String(line.raw_material_id)));
        const sih = whRow?.stockInHand ?? 0;
        const maxBatches = perBatch > 0 ? Math.floor(sih / perBatch) : 999;
        const totalReq = perBatch * batchesReq;
        return { name: line.inci_name ?? code, code, pct, perBatch, sih, maxBatches, totalReq, ok: maxBatches >= batchesReq };
      });
    }
    return (selectedSOForBatch?.rawMaterials ?? []).map((item, idx) => {
      const pct = item.percentage || 0;
      const perBatch = (batchSizeNum * pct) / 100;
      const whRow = warehouseRows.find((r) => r.type === 'RM' && (r.name === item.name || r.code === (item as RawMaterial).code));
      const sih = whRow?.stockInHand ?? item.quantity ?? 0;
      const maxBatches = perBatch > 0 ? Math.floor(sih / perBatch) : 999;
      const totalReq = perBatch * batchesReq;
      return { name: item.name, code: (item as RawMaterial).code ?? item.id, pct, perBatch, sih, maxBatches, totalReq, ok: maxBatches >= batchesReq };
    });
  }, [activeBom?.rmLines, selectedSOForBatch?.rawMaterials, selectedSOForBatch?.batchSize, selectedSOForBatch?.batchesRequired, warehouseRows, batchSizeNum, batchesReq]);

  const feasibilityPmRows = useMemo(() => {
    if (activeBom?.pmLines?.length) {
      const unitsPerBatch = Math.ceil(parseInt(selectedSOForBatch?.orderQty?.replace(/\D/g, '') || '50000', 10) / batchesReq) || 3333;
      return activeBom.pmLines.map((line, i) => {
        const code = (line as { pm_code?: string }).pm_code ?? String(i);
        const qtyPerUnit = (line as { qty_per_unit?: number }).qty_per_unit ?? (line as { qty?: number }).qty ?? 1;
        const perBatchPcs = unitsPerBatch * qtyPerUnit;
        const whRow = warehouseRows.find((r) => r.type === 'PM' && (r.code === code || String(r.sourceId) === code));
        const sih = whRow?.stockInHand ?? 0;
        const maxBatches = perBatchPcs > 0 ? Math.floor(sih / perBatchPcs) : 999;
        const totalReq = perBatchPcs * batchesReq;
        return { name: line.description ?? code, code, qtyPerUnit, perBatchPcs, sih, maxBatches, totalReq, ok: maxBatches >= batchesReq };
      });
    }
    return (selectedSOForBatch?.packagingMaterials ?? []).map((item, idx) => {
      const qtyPerUnit = (item as PackagingMaterial).value ?? 1;
      const unitsPerBatch = Math.ceil(parseInt(selectedSOForBatch?.orderQty?.replace(/\D/g, '') || '50000', 10) / batchesReq) || 3333;
      const perBatchPcs = unitsPerBatch * qtyPerUnit;
      const whRow = warehouseRows.find((r) => r.type === 'PM' && (r.name === item.name || r.code === (item as PackagingMaterial).code));
      const sih = whRow?.stockInHand ?? item.quantity ?? 0;
      const maxBatches = perBatchPcs > 0 ? Math.floor(sih / perBatchPcs) : 999;
      const totalReq = perBatchPcs * batchesReq;
      return { name: item.name, code: (item as PackagingMaterial).code ?? item.id, qtyPerUnit, perBatchPcs, sih, maxBatches, totalReq, ok: maxBatches >= batchesReq };
    });
  }, [activeBom?.pmLines, selectedSOForBatch?.packagingMaterials, selectedSOForBatch?.orderQty, selectedSOForBatch?.batchesRequired, warehouseRows, batchesReq]);

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
    return {
      id: `${row.type}-${row.raw_material_id ?? row.pack_material_id}`,
      name: row.name,
      code: row.code,
      category: row.type === 'PM' ? 'PM - Primary' : 'RM',
      usedIn: String(row.usedInProducts?.length ?? 0),
      usedInProducts: row.usedInProducts ?? [],
      totalReq: totalReqStr,
      totalRequired: row.totalRequired,
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
    };
  }, [planningExtractedList, itemsInvolvedRows, procurementRequests]);

  const currentStats = tabStats[activeMainTab];

  // Availability Summary: product cards from planning_extracted + warehouse coverage (RM/PM %)
  const availabilitySummaryProducts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const colorMap: Record<string, { icon: string; iconBg: string; iconColor: string }> = {
      pink: { icon: '🌸', iconBg: 'bg-pink-100', iconColor: 'text-pink-600' },
      orange: { icon: '☀️', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
      blue: { icon: '💧', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
      purple: { icon: '🧴', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
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

  // All RM vs Whole Order / All PM vs Whole Order — from items-involved API (confirmed BOMs)
  const availabilityRMItems = useMemo(() => {
    return itemsInvolvedRows
      .filter((r) => r.type === 'RM')
      .map((r) => {
        const coverage = r.coverage ?? 0;
        const status = coverage >= 100 ? 'OK' : coverage >= 75 ? 'WARN' : 'SHORT';
        const statusColor = coverage >= 100 ? 'bg-green-100 text-green-700' : coverage >= 75 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
        return {
          id: `RM-${r.raw_material_id}`,
          name: r.name,
          code: r.code,
          reqKg: r.totalRequired.toLocaleString(),
          sihKg: r.sih.toLocaleString(),
          coverage,
          status,
          statusColor,
        };
      });
  }, [itemsInvolvedRows]);

  const availabilityPMItems = useMemo(() => {
    return itemsInvolvedRows
      .filter((r) => r.type === 'PM')
      .map((r) => {
        const coverage = r.coverage ?? 0;
        const status = coverage >= 100 ? 'OK' : coverage >= 75 ? 'WARN' : 'SHORT';
        const statusColor = coverage >= 100 ? 'bg-green-100 text-green-700' : coverage >= 75 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
        return {
          id: `PM-${r.pack_material_id}`,
          name: r.name,
          code: r.code,
          required: r.totalRequired.toLocaleString(),
          sih: r.sih.toLocaleString(),
          coverage,
          status,
          statusColor,
        };
      });
  }, [itemsInvolvedRows]);

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
    setBomFormula(order.rawMaterials);
    setBomPackaging(order.packagingMaterials);
    setIsReadyForProduction(false);
    setPlanBatchesModalOpen(true);
  };

  const handleRaisePR = (order: SalesOrder, pmOnly: boolean = false) => {
    console.log('handleRaisePR called with:', { orderId: order.id, orderNumber: order.soNumber, pmOnly });
    setSelectedSO(order);
    setPrModalOpen(true);
    setPrShowPMOnly(pmOnly);
    setPrPriority('High');
    setPrRequiredByDate(order.dueDate);
    setPrNotes('');
    console.log('State updated - modal should open');
  };

  const handleSendToProcurement = async () => {
    if (!selectedSO) return;
    setPrSending(true);
    try {
      const res = await createProcurementRequest({
        planningExtractedId: parseInt(selectedSO.id, 10),
        priority: prPriority,
        requiredByDate: prRequiredByDate || selectedSO.dueDate || new Date().toISOString().slice(0, 10),
        notes: prNotes,
        items: prItems,
      });
      if (res.success && res.data) {
        addToast('success', `PR for SO #${selectedSO.soNumber} saved. Reflected in Planning tab stats and in Procurement → Requests.`);
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

  const handleSaveBatchPlan = async () => {
    if (!selectedSOForBatch) return;
    try {
      await updatePlanningExtracted(selectedSOForBatch.id, {
        batchCount: parseInt(numBatches, 10) || 0,
        batchSizeKg: parseFloat(batchSizeKg) || 500,
        plannedStartDate: plannedStartDate || undefined,
        productionLine: productionLine || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
      addToast('success', 'Batch plan saved.');
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save batch plan');
    }
  };

  const handleConfirmBOM = async () => {
    if (!selectedSOForBatch) return;
    try {
      const rmLines: BOMRmLine[] = bomFormula.map((item) => ({
        phase: item.phase ?? 'Phase A',
        inci_name: item.name,
        rm_code: item.code ?? item.id,
        pct_w_w: item.percentage,
        uom: item.unit || 'kg',
        ...(typeof item.id === 'string' && /^\d+$/.test(item.id) ? { raw_material_id: parseInt(item.id, 10) } : {}),
      }));
      const pmLines: BOMPmLine[] = bomPackaging.map((item) => ({
        pm_code: item.code ?? item.id,
        description: item.name,
        pack_type: 'Primary',
        qty_per_unit: item.value,
        uom: 'pc/unit',
      }));

      if (activeBom?.id) {
        const res = await updateBOM(activeBom.id, { rmLines, pmLines });
        if (!res.success || res.error) {
          addToast('error', typeof res.error === 'string' ? res.error : 'Failed to update BOM');
          return;
        }
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
    try {
      await updatePlanningExtracted(selectedSOForBatch.id, {
        batchCount: parseInt(numBatches, 10) || 0,
        batchSizeKg: parseFloat(batchSizeKg) || 500,
        plannedStartDate: plannedStartDate || undefined,
        productionLine: productionLine || undefined,
        bomStatus: 'Production Released',
      });
      queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
      addToast('success', `Plan for ${selectedSOForBatch.productName} sent to Production successfully`);
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save');
    }
    setPlanBatchesModalOpen(false);
    setSelectedSOForBatch(null);
    setBomFormula([]);
    setBomPackaging([]);
    setActiveBatchTab('feasibility');
    setNumBatches('15');
    setBatchSizeKg('500');
    setPlannedStartDate('2026-03-04');
    setProductionLine('Line 1 — Primary Mixer');
    setIsReadyForProduction(false);
  };

  const handleRaisePRFromBatch = () => {
    if (selectedSOForBatch) {
      // Close Plan Batches modal first, then open PR modal with PM items only
      setPlanBatchesModalOpen(false);
      setPrModalOpen(true);
      setSelectedSO(selectedSOForBatch);
      setPrShowPMOnly(true);
      setPrPriority('High');
      setPrRequiredByDate(selectedSOForBatch.dueDate);
      setPrNotes('');
    }
  };

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
          <button 
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
          </button>
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
              `px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
                isActive ? 'text-emerald-700 border-emerald-700' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`
            }
          >
            📋 PIs Extracted
          </NavLink>
          <NavLink
            to="/planning/items-involved"
            className={({ isActive }) =>
              `px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
                isActive ? 'text-emerald-700 border-emerald-700' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`
            }
          >
            ✎ Items Involved
          </NavLink>
          <NavLink
            to="/planning/availability-summary"
            className={({ isActive }) =>
              `px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
                isActive ? 'text-emerald-700 border-emerald-700' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`
            }
          >
            📊 Availability Summary
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
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  statusFilter === status
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
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                    order.color === 'pink' ? 'bg-pink-400' : order.color === 'orange' ? 'bg-orange-400' : order.color === 'blue' ? 'bg-blue-400' : 'bg-purple-400'
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
                      RM — {selectedRowForDetail.rawMaterials.length} items
                    </h4>
                    <div className="space-y-3">
                      {selectedRowForDetail.rawMaterials.map((item) => (
                        <div key={item.id} className="flex flex-col">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                            <span className="text-sm text-teal-600 font-semibold shrink-0">
                              {typeof item.quantity === 'number' ? item.quantity.toFixed(1) : item.quantity}/{item.unit}
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
                      PM — {selectedRowForDetail.packagingMaterials.length} items
                    </h4>
                    <div className="space-y-3">
                      {selectedRowForDetail.packagingMaterials.map((item) => (
                        <div key={item.id} className="flex flex-col">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                            <span className="text-sm text-orange-600 font-semibold shrink-0">
                              {typeof item.quantity === 'number' ? item.quantity.toFixed(1) : item.quantity}/{item.unit}
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { handleRaisePR(selectedRowForDetail); closeDetailModal(); }}
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
                  </div>
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
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      itemsInvolvedCategoryFilter === key
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
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">TOTAL REQ</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">SIH</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">SURPLUS/<br/>SHORTAGE</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">COVERAGE</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">WH BATCHES</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">EXPIRY</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">BOM FLAG</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">ACTION</th>
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
                        <span className={`text-xs font-semibold px-1 py-0.5 rounded ${
                          item.itemType === 'PM' 
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
                      <td className="px-2 py-2 text-right text-gray-900 text-xs">{item.totalReq}</td>
                      <td className="px-2 py-2 text-right text-orange-600 font-medium text-xs">{item.sih}</td>
                      <td className={`px-2 py-2 text-right font-semibold text-xs ${
                        item.surplusShortage.includes('-') ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {item.surplusShortage}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className={`h-1.5 rounded-sm w-10 ${
                            item.coverage === '100%' ? 'bg-green-500' : 'bg-orange-400'
                          }`}></div>
                          <span className="text-xs font-semibold text-gray-700">{item.coverage}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-gray-900 text-xs">{item.whBatches}</td>
                      <td className="px-2 py-2 text-center text-gray-600 text-xs">{item.expiry}</td>
                      <td className="px-2 py-2 text-center text-gray-500 text-xs">{item.bomFlag}</td>
                      <td className="px-2 py-2 text-center">
                        {item.surplusShortageNum < 0 ? (
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              const shortage = Math.max(0, -item.surplusShortageNum);
                              setSingleItemPrOrderQty(Math.ceil(shortage * 1.1));
                              setSingleItemPrModalOpen(true);
                            }}
                            className="px-2 py-1 bg-orange-100 text-orange-700 rounded font-semibold text-xs hover:bg-orange-200"
                          >
                            PR
                          </button>
                        ) : (
                          <span className="text-green-600 font-semibold text-xs">✓ OK</span>
                        )}
                      </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              </div>
            </div>
        )}

        {/* Single Item PR Modal */}
        {singleItemPrModalOpen && selectedItem && (
          <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Raise Procurement Request</h2>
                <button
                  onClick={() => {
                    setSingleItemPrModalOpen(false);
                    setSelectedItem(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Item Info Banner */}
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm flex items-center gap-3">
                  <span>📦</span>
                  <span>Single item PR — <strong>{selectedItem.name}</strong></span>
                </div>

                {/* Item Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">CODE</label>
                    <input
                      type="text"
                      value={selectedItem.code}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">NAME</label>
                    <input
                      type="text"
                      value={selectedItem.name}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">SIH</label>
                    <input
                      type="text"
                      value={`${selectedItem.sih} ${selectedItem.unit}`}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">REQUIRED</label>
                    <input
                      type="text"
                      value={selectedItem.totalReq}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">SHORTAGE</label>
                    <input
                      type="text"
                      value={selectedItem.surplusShortage}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-red-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">QTY TO REQUEST</label>
                    <input
                      type="number"
                      min={1}
                      value={singleItemPrOrderQty}
                      onChange={(e) => setSingleItemPrOrderQty(Math.max(1, parseInt(e.target.value, 10) || 0))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Priority and Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">PRIORITY</label>
                    <select
                      value={singleItemPrPriority}
                      onChange={(e) => setSingleItemPrPriority(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">REQUIRED BY</label>
                    <input
                      type="date"
                      value={singleItemPrRequiredByDate}
                      onChange={(e) => setSingleItemPrRequiredByDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setSingleItemPrModalOpen(false);
                    setSelectedItem(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (selectedItem.planningExtractedId == null) {
                      addToast('error', 'No planning order linked to this item. Confirm BOM first.');
                      return;
                    }
                    setSingleItemPrSending(true);
                    try {
                      const shortageNum = Math.max(0, -selectedItem.surplusShortageNum);
                      const itemPayload: ProcurementRequestItem = {
                        type: selectedItem.itemType,
                        code: selectedItem.code,
                        name: selectedItem.name,
                        required: selectedItem.totalRequired,
                        sih: selectedItem.sihNum,
                        shortage: shortageNum,
                        quantity_requested: singleItemPrOrderQty,
                        unit: selectedItem.unit,
                        raw_material_id: selectedItem.raw_material_id,
                        pack_material_id: selectedItem.pack_material_id,
                      };
                      const result = await createProcurementRequest({
                        planningExtractedId: selectedItem.planningExtractedId,
                        priority: singleItemPrPriority,
                        requiredByDate: singleItemPrRequiredByDate,
                        notes: `Single-item PR: ${selectedItem.name} (${selectedItem.code})`,
                        items: [itemPayload],
                      });
                      if (result.success) {
                        queryClient.invalidateQueries({ queryKey: ['planning-extracted'] });
                        queryClient.invalidateQueries({ queryKey: ['procurement-requests'] });
                        addToast('success', `PR raised for ${selectedItem.name}`);
                        setSingleItemPrModalOpen(false);
                        setSelectedItem(null);
                      } else {
                        addToast('error', typeof result.error === 'string' ? result.error : 'Failed to raise PR');
                      }
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : 'Failed to raise PR';
                      addToast('error', errorMessage);
                      console.error('Error raising PR:', error);
                    } finally {
                      setSingleItemPrSending(false);
                    }
                  }}
                  disabled={singleItemPrSending}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {singleItemPrSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    '✓ Send to Procurement'
                  )}
                </button>
              </div>
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
                      
                      // Initialize batch data
                      setNumBatches(soToUse.batchesRequired.toString());
                      setBatchSizeKg(soToUse.batchSize.includes(' KG') ? soToUse.batchSize.replace(' KG', '') : soToUse.batchSize);
                      setPlannedStartDate('2026-03-05');
                      setProductionLine('Line 1 — Primary Mixer');
                      
                      // Set BOM data
                      setBomFormula(soToUse.rawMaterials);
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
                    ⚙ Plan Batches
                  </button>
                </div>
              ))}
            </div>

            {/* Two Column Tables Section */}
            <div className="grid grid-cols-2 gap-4">
              {/* All RM vs Whole Order Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">🧪 All RM vs Whole Order</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">RM</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">REQ KG</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">SIH KG</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">COVERAGE</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availabilityRMItems.map((item, idx) => (
                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2">
                            <div className="text-gray-900 font-medium text-xs">{item.name}</div>
                            <div className="text-xs text-blue-600">{item.code}</div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-gray-900 font-semibold text-xs">{item.reqKg}</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-cyan-600 font-semibold text-xs">{item.sihKg}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-16">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    item.coverage >= 100 ? 'bg-green-500' :
                                    item.coverage >= 75 ? 'bg-orange-400' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(item.coverage, 100)}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-semibold text-gray-700 w-8 text-right">{item.coverage}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${item.statusColor}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* All PM vs Whole Order Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">📦 All PM vs Whole Order</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">PM</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">REQUIRED</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">SIH</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">COVERAGE</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availabilityPMItems.map((item, idx) => (
                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2">
                            <div className="text-gray-900 font-medium text-xs">{item.name}</div>
                            <div className="text-xs text-blue-600">{item.code}</div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-gray-900 font-semibold text-xs">{item.required}</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-cyan-600 font-semibold text-xs">{item.sih}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-16">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    item.coverage >= 100 ? 'bg-green-500' :
                                    item.coverage >= 75 ? 'bg-orange-400' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(item.coverage, 100)}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-semibold text-gray-700 w-8 text-right">{item.coverage}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${item.statusColor}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          </>
        )}

      </div>

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
                      setIsReadyForProduction(false);
                      setSwapSourceIndex(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                  {/* Tabs */}
                  {/* Tab order: BOM work first (Feasibility, BOM Editor, Swap/Add), then Batch Plan after BOM is confirmed */}
                  <div className="flex gap-4 border-b border-gray-200">
                    <button 
                      onClick={() => setActiveBatchTab('feasibility')}
                      className={`px-4 py-2 text-sm font-semibold transition-colors ${
                        activeBatchTab === 'feasibility'
                          ? 'text-emerald-700 border-b-2 border-emerald-700'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📊 Feasibility
                    </button>
                    <button 
                      onClick={() => setActiveBatchTab('bom-editor')}
                      className={`px-4 py-2 text-sm font-semibold transition-colors ${
                        activeBatchTab === 'bom-editor'
                          ? 'text-emerald-700 border-b-2 border-emerald-700'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      ✎ BOM Editor
                    </button>
                    <button 
                      onClick={() => setActiveBatchTab('swap-add')}
                      className={`px-4 py-2 text-sm font-semibold transition-colors ${
                        activeBatchTab === 'swap-add'
                          ? 'text-emerald-700 border-b-2 border-emerald-700'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      ↔ Swap / Add
                    </button>
                    <button 
                      onClick={() => canSendToProduction && setActiveBatchTab('batch-plan')}
                      className={`px-4 py-2 text-sm font-semibold transition-colors ${
                        activeBatchTab === 'batch-plan'
                          ? 'text-emerald-700 border-b-2 border-emerald-700'
                          : canSendToProduction
                            ? 'text-gray-600 hover:text-gray-900'
                            : 'text-gray-400 cursor-not-allowed'
                      }`}
                      title={canSendToProduction ? 'Set number of batches and schedule' : 'Confirm BOM first, then set batches here'}
                    >
                      📋 Batch Plan
                    </button>
                  </div>

                  {/* Tab Content */}
                  {activeBatchTab === 'feasibility' && (
                    <div className="space-y-6">
                      {/* Order Summary */}
                      <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                        <p className="text-xs font-semibold text-cyan-900">
                          📦 Order: {selectedSOForBatch.orderQty} · Total KG: {selectedSOForBatch.totalKg} · Batch KG: {selectedSOForBatch.batchSize} · {selectedSOForBatch.batchesRequired} batches required
                        </p>
                      </div>

                      {/* Feasibility Cards */}
                      <div className="grid grid-cols-3 gap-4">
                        <FeasibilityCard
                          type="rm"
                          title="BY RM ONLY"
                          possibleUnits={feasibilityRmRows.length && feasibilityRmRows.every((r) => r.perBatch > 0) ? (() => { const canDo = Math.min(...feasibilityRmRows.map((r) => r.maxBatches)); const unitsPerBatch = Math.ceil(parseInt(selectedSOForBatch?.orderQty?.replace(/\D/g, '') || '50000', 10) / batchesReq) || 3333; return canDo * unitsPerBatch; })() : 0}
                          limitingFactor={feasibilityRmRows.find((r) => !r.ok)?.name ?? '—'}
                          isShortfall={feasibilityRmRows.some((r) => !r.ok)}
                          needed={batchesReq}
                          canDo={feasibilityRmRows.length ? Math.min(...feasibilityRmRows.filter((r) => r.perBatch > 0).map((r) => r.maxBatches), 999) : 0}
                        />
                        <FeasibilityCard
                          type="pm"
                          title="BY PM ONLY"
                          possibleUnits={feasibilityPmRows.length ? (() => { const canDo = Math.min(...feasibilityPmRows.map((r) => r.maxBatches)); const unitsPerBatch = Math.ceil(parseInt(selectedSOForBatch?.orderQty?.replace(/\D/g, '') || '50000', 10) / batchesReq) || 3333; return canDo * unitsPerBatch; })() : 0}
                          limitingFactor={feasibilityPmRows.find((r) => !r.ok)?.name ?? '—'}
                          isShortfall={feasibilityPmRows.some((r) => !r.ok)}
                          needed={batchesReq}
                          canDo={feasibilityPmRows.length ? Math.min(...feasibilityPmRows.map((r) => r.maxBatches)) : 0}
                        />
                        <FeasibilityCard
                          type="combined"
                          title="COMBINED (RM+PM)"
                          possibleUnits={(() => { const rmCanDo = feasibilityRmRows.length ? Math.min(...feasibilityRmRows.filter((r) => r.perBatch > 0).map((r) => r.maxBatches), 999) : 999; const pmCanDo = feasibilityPmRows.length ? Math.min(...feasibilityPmRows.map((r) => r.maxBatches)) : 999; const canDo = Math.min(rmCanDo, pmCanDo); const unitsPerBatch = Math.ceil(parseInt(selectedSOForBatch?.orderQty?.replace(/\D/g, '') || '50000', 10) / batchesReq) || 3333; return canDo * unitsPerBatch; })()}
                          limitingFactor={feasibilityRmRows.find((r) => !r.ok)?.name ?? feasibilityPmRows.find((r) => !r.ok)?.name ?? ''}
                          isShortfall={feasibilityRmRows.some((r) => !r.ok) || feasibilityPmRows.some((r) => !r.ok)}
                          canDo={Math.min(
                            feasibilityRmRows.length ? Math.min(...feasibilityRmRows.filter((r) => r.perBatch > 0).map((r) => r.maxBatches), 999) : 999,
                            feasibilityPmRows.length ? Math.min(...feasibilityPmRows.map((r) => r.maxBatches)) : 999
                          )}
                        />
                      </div>

                      {/* RM Feasibility Table */}
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                          RM FEASIBILITY — PER BATCH (~{selectedSOForBatch.batchSize})
                        </h3>
                        <div className="border border-gray-200 rounded-lg overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-2 text-left font-semibold text-gray-700">RM ITEM</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">% IN BOM</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">PER BATCH KG</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">SIH KG</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">MAX BATCHES</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">TOTAL REQ</th>
                                <th className="px-4 py-2 text-center font-semibold text-gray-700">STATUS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {feasibilityRmRows.map((row, idx) => (
                                <tr key={`rm-${row.code}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-4 py-3 text-gray-900 font-medium">{row.name}</td>
                                  <td className="px-4 py-3 text-right text-gray-900">{row.pct.toFixed(2)}%</td>
                                  <td className="px-4 py-3 text-right text-teal-700 font-semibold">{row.perBatch.toFixed(0)} KG</td>
                                  <td className="px-4 py-3 text-right text-gray-900">{row.sih.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-cyan-700 font-bold">{row.maxBatches}</td>
                                  <td className="px-4 py-3 text-right text-gray-900 font-medium">{row.totalReq.toFixed(0)}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded ${row.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                      {row.ok ? 'Ok' : 'Short'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* PM Feasibility Table */}
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          PM FEASIBILITY — PER BATCH
                        </h3>
                        <div className="border border-gray-200 rounded-lg overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-2 text-left font-semibold text-gray-700">PM ITEM</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">QTY/UNIT</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">PER BATCH PCS</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">SIH</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">MAX BATCHES</th>
                                <th className="px-4 py-2 text-right font-semibold text-gray-700">TOTAL REQ</th>
                                <th className="px-4 py-2 text-center font-semibold text-gray-700">STATUS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {feasibilityPmRows.map((row, idx) => (
                                <tr key={`pm-${row.code}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-4 py-3 text-gray-900 font-medium">{row.name}</td>
                                  <td className="px-4 py-3 text-right text-gray-900">{row.qtyPerUnit}</td>
                                  <td className="px-4 py-3 text-right text-orange-700 font-semibold">{row.perBatchPcs.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-gray-900">{row.sih.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-cyan-700 font-bold">{row.maxBatches}</td>
                                  <td className="px-4 py-3 text-right text-gray-900 font-medium">{row.totalReq.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded ${row.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                      {row.ok ? 'Ok' : 'Low'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Batch Plan Tab — shown after BOM is confirmed; here they set how many batches, size, schedule */}
                  {activeBatchTab === 'batch-plan' && (
                    <div className="space-y-6">
                      {canSendToProduction && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
                          <span className="font-semibold">BOM confirmed.</span> Set number of batches, batch size, and schedule below. Then send to Production when ready.
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-2">NUMBER OF BATCHES</label>
                          <input type="number" value={numBatches} onChange={(e) => setNumBatches(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-2">BATCH SIZE (KG)</label>
                          <input type="number" value={batchSizeKg} onChange={(e) => setBatchSizeKg(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
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
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                          <span>✓</span>
                          {numBatches} batches × {batchSizeKg} KG = {(parseInt(numBatches) * parseInt(batchSizeKg)).toLocaleString()} KG → ~{(parseInt(numBatches) * 3333).toLocaleString()} units
                        </p>
                        <p className="text-xs text-emerald-700 mt-1">Exactly meets order requirement.</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-4">BATCH SCHEDULE</h3>
                        <div className="grid grid-cols-10 gap-2">
                          {Array.from({ length: parseInt(numBatches) || 0 }).map((_, idx) => (
                            <div key={idx} className="border-2 border-emerald-200 rounded-lg p-3 text-center bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors">
                              <p className="text-xs font-bold text-emerald-700">B-{String(idx + 1).padStart(2, '0')}</p>
                              <p className="text-xs text-emerald-600 mt-1">{batchSizeKg} KG</p>
                              <p className="text-xs text-emerald-600 font-semibold mt-1">Planned</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button type="button" onClick={handleSaveBatchPlan} className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700">
                        💾 Save Batch Plan
                      </button>
                    </div>
                  )}

                  {/* BOM Editor Tab */}
                  {activeBatchTab === 'bom-editor' && (
                    <div className="space-y-6">
                      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start gap-3">
                        <span className="text-yellow-600 text-lg mt-0.5">⚠</span>
                        <div>
                          <p className="text-sm font-semibold text-yellow-900">Editing BOM for {selectedSOForBatch.productName}. Make all BOM updates here (add/swap materials). When done, click <strong>Confirm BOM</strong> below — then use the <strong>Batch Plan</strong> tab to set how many batches and schedule.</p>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <span className="text-emerald-600">✓</span>FORMULA BOM ({bomFormula.length} RM ITEMS)
                        </h3>
                        <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                          {bomFormula.map((item, idx) => (
                            <div key={`${item.id}-${idx}`} className="bg-white rounded-lg p-4 flex items-center gap-4 border border-gray-200">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                                <p className="text-xs text-blue-600 font-medium">{item.code ?? item.id} · {item.percentage}% · {item.phase ?? 'Phase A'}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <input type="number" value={item.percentage} onChange={(e) => { const updated = [...bomFormula]; updated[idx] = { ...item, percentage: parseFloat(e.target.value) }; setBomFormula(updated); }} step="0.1" className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <span className="text-sm font-semibold text-gray-600">%</span>
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
                          <span className="text-orange-500">●</span>PACK BOM ({bomPackaging.length} PM ITEMS)
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
                                      next[swapSourceIndex] = { id: item.id, name: item.name, quantity: 0, unit: 'KG', percentage: src?.percentage ?? 0, code: item.code, phase: src?.phase ?? 'Phase A' };
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
                                          <button type="button" onClick={() => { const newItem: RawMaterial = { id: item.id, name: item.name, quantity: 0, unit: 'KG', percentage: 0, code: item.code, phase: 'Phase A' }; setBomFormula([...bomFormula, newItem]); addToast('success', `Added ${item.name} to BOM — set % in BOM Editor`); }} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">+ Add</button>
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
                    onClick={() => { setPlanBatchesModalOpen(false); setSelectedSOForBatch(null); setIsReadyForProduction(false); setSwapSourceIndex(null); }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => handleRaisePRFromBatch()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 transition-colors">
                      🔴 Raise PR for Shortages
                    </button>
                    <button onClick={() => handleConfirmBOM()} disabled={canSendToProduction} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                      {canSendToProduction ? '✓ BOM Confirmed' : '✓ Confirm BOM'}
                    </button>
                    {canSendToProduction && (
                      <button onClick={() => handleSendToProduction()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                        🚀 Send to Production
                      </button>
                    )}
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
                <span className="text-yellow-500 mt-0.5">ℹ️</span>
                <span>
                  {prShowPMOnly ? (
                    <>Raising PR for {selectedSO.packagingMaterials.length} PM items with shortages for <strong>{selectedSO.productName}</strong>. Only items that exist in the Pack Materials master are listed.</>
                  ) : (
                    <>Raising PR for {selectedSO.rawMaterials.length} RM and {selectedSO.packagingMaterials.length} PM items with shortages for <strong>{selectedSO.productName}</strong>. Only items that exist in the Raw Materials and Pack Materials masters are listed.</>
                  )}
                  {prOmittedCount > 0 && (
                    <span className="block mt-2 text-amber-700 font-medium">
                      {prOmittedCount} item{prOmittedCount !== 1 ? 's' : ''} from the BOM are not in the RM/PM master tables and were omitted. Add them to Raw Materials or Pack Materials first to include in PRs.
                    </span>
                  )}
                  <span className="block mt-2 text-gray-600 text-xs">On submit, the request is saved to the backend (procurement_requests). You’ll see it in Planning tab stats and in Procurement → Requests.</span>
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
              {prItems.length === 0 && prModalOpen && selectedSO && (
                <p className="text-sm text-gray-500">No RM/PM items for this order. Add materials in BOM or check planning data.</p>
              )}
              {prItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                    Items — from DB (editable quantity to request)
                  </h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">TYPE</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">ITEM</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-700">REQUIRED</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-700">SIH</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-700">SHORTAGE</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-700">QTY TO REQUEST</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">NOTES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prItems.map((item, idx) => (
                          <tr key={`${item.type}-${item.code}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-gray-700 font-medium">{item.type}</td>
                            <td className="px-4 py-3 text-gray-900"><div>{item.name}</div><div className="text-xs text-gray-500">{item.code}</div></td>
                            <td className="px-4 py-3 text-right text-gray-900 font-medium">{item.required.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-orange-600 font-medium">{item.sih.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-red-600 font-semibold">{item.shortage > 0 ? `+${item.shortage.toLocaleString()}` : '0'}</td>
                            <td className="px-4 py-2 text-right">
                              <input type="number" min={0} value={item.quantity_requested} onChange={(e) => updatePrItem(idx, { quantity_requested: parseFloat(e.target.value) || 0 })} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="text" value={item.line_notes ?? ''} onChange={(e) => updatePrItem(idx, { line_notes: e.target.value })} placeholder="Notes" className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 p-6 flex gap-3 justify-end">
              <button onClick={() => { setPrModalOpen(false); setSelectedSO(null); setPrShowPMOnly(false); setPrOmittedCount(0); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-transparent hover:bg-gray-100 transition-colors disabled:opacity-50" disabled={prSending}>Cancel</button>
              <button onClick={handleSendToProcurement} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2" disabled={prSending}>
                {prSending ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Sending...</>) : '✓ Send to Procurement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Planning;
