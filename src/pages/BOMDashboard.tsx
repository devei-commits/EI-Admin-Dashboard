import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle, Trash2, Plus, ArrowUpFromLine, Upload, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';
import { useMasterApprovalPermission } from '../hooks/useMasterApprovalPermission';
import { normalizeStageAssignees } from '../constants/masterApprovalStatus';
import {
  canEditPrTeamAssignSlot,
  getPrTeamAssignStatus,
  normalizePrApprovalTeamPending,
  PR_TEAM_ASSIGN_STATUSES,
  type PrTeamAssignStatus,
  type PrTeamKey,
} from '../lib/prMasterTeamApproval';
import { MasterPrTeamAssignCell } from '../components/masters/MasterPrTeamAssignCell';
import { MasterPrTrackApprovalCell } from '../components/masters/MasterPrTrackApprovalCell';
import { masterApprovalStatusBadgeClass } from '../constants/masterApprovalStatus';
import { MasterApprovalLogsCell } from '../components/masters/MasterApprovalLogsCell';
import { MasterApprovalStatusTabs } from '../components/masters/MasterApprovalStatusTabs';
import {
  buildMasterApprovalStatusCounts,
  normalizeMasterApprovalStatus,
  type MasterApprovalStatusTab,
} from '../constants/masterApprovalStatus';
import { fetchPRProducts, fetchPRProductDetail, updatePRProduct, deletePRProduct, clearAllPrBomFullReset, ALL_PR_BOM_RESET_CONFIRM, postFormulaSummaryChunk, postFormulaRmBomChunk, postFormulaPackBomChunk, type PRProductListItem, type PRProductDetail, type FormulaBomPhase, type SkuBomRow, type PackBomRow, type ProcessStep, type FormulaSummaryGroupResult, type FormulaRmBomGroupResult, type FormulaPackBomGroupResult } from '../services/productsMaster.service';
import { parseFormulaBomWorkbook, chunkSummaryRows, groupRowsByCompositeSku, chunkCompositeGroups } from '../lib/formulaBomExcelParse';
import BOMForm from './BOMForm';
import {
  validateSkuBomTotals,
  countMeaningfulFormulaRmLines,
  countMeaningfulPackLines,
  countMeaningfulSkuRmLines,
  formatSkuBomLimitAsPack,
  getEffectiveSkuBomLimitFields,
  formulaRowsToSkuBomLines,
  flattenFormulaBomPhases,
} from '../lib/skuBomMath';
import { toPmDisplayUnit } from '../lib/pmDisplayUnit';
import { computeSkuBomQtyDisplay, formatSkuBomStdQtyWithUnit, resolveRmMasterForSkuLine } from '../lib/skuBomDisplay';
import { fetchRawMaterialsList, type RawMaterialRecord } from '../services/rawMaterials.service';
import { fetchItemGroups, type ItemGroupRecord } from '../services/itemGroups.service';
import { formatQtyWithUnit } from '../utils/formatQty';
import { SortableTableTh, type SortDirection } from '../components/ui/SortableTableTh';
import { compareMasterTableSort } from '../lib/masterTableSort';
import {
  PM_SKU_CATEGORY_SELECT_OPTIONS,
  normalizePmDetailSubCategoryForSelect,
  normalizePmSkuCategoryForSelect,
  pmDetailSubCategoryHasSubSubCategory,
  pmDetailSubCategoryOptionsForSkuCategory,
  pmLevelForSubCategory,
  pmSubSubCategoryOptionsForDetailSubCategory,
  normalizePmSubSubCategoryForSelect,
} from '../constants/materialMasterSkuRules';

type PrListSortColumn =
  | 'code'
  | 'record'
  | 'product'
  | 'category'
  | 'subCategory'
  | 'form'
  | 'packSize'
  | 'batchKg'
  | 'shelfLife'
  | 'rmIngs'
  | 'packItems'
  | 'status'
  | 'openSos';

const STATUS_OPTIONS = ['Draft', 'Under Review', 'Under Approval', 'Active', 'Discontinued'];

type PrStatusTab = MasterApprovalStatusTab | 'Discontinued';

/** Summary rows per chunk POST. */
const FORMULA_SUMMARY_CHUNK_ROWS = 25;

/** Composite SKU groups per RM BOM chunk POST. */
const FORMULA_BOM_CHUNK_GROUPS = 5;

const BOMDashboard: React.FC = () => {
  const { hasModuleAccess, isAdmin } = usePermissions();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canEdit = hasModuleAccess('catalogue-management') || hasModuleAccess('packaging-management');
  const { canAssignApprover } = useMasterApprovalPermission('PR');

  const canAssignPrTeam = useCallback(
    (team: PrTeamKey, stageAssignees: unknown): boolean =>
      canEditPrTeamAssignSlot(team, isAdmin, user?.id, normalizeStageAssignees(stageAssignees), canAssignApprover),
    [isAdmin, user?.id, canAssignApprover]
  );

  const [list, setList] = useState<PRProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [statusTab, setStatusTab] = useState<PrStatusTab>('all');
  const [rmAssignStatusFilter, setRmAssignStatusFilter] = useState<'all' | PrTeamAssignStatus>('all');
  const [packAssignStatusFilter, setPackAssignStatusFilter] = useState<'all' | PrTeamAssignStatus>('all');
  const [selectedProduct, setSelectedProduct] = useState<PRProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<PRProductDetail> | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<PrListSortColumn | null>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [bomEditPopupId, setBomEditPopupId] = useState<string | null>(null);
  const [formulaRmExcelUploading, setFormulaRmExcelUploading] = useState(false);
  /** Full BOM reset for the product currently open in the side panel (toolbar). */
  const [prToolbarFullResetting, setPrToolbarFullResetting] = useState(false);
  /** 0–100 while chunked Formula BOM import runs */
  const [formulaBomUploadPercent, setFormulaBomUploadPercent] = useState<number | null>(null);
  const formulaRmFileInputRef = useRef<HTMLInputElement | null>(null);
  const deepLinkPrAppliedRef = useRef(false);
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRecord[]>([]);
  const [itemGroupsRm, setItemGroupsRm] = useState<ItemGroupRecord[]>([]);

  const rmById = useMemo(() => {
    const map = new Map<number, RawMaterialRecord>();
    for (const rm of rawMaterials) {
      const id = Number(rm.id);
      if (Number.isFinite(id)) map.set(id, rm);
    }
    return map;
  }, [rawMaterials]);

  const rmByCode = useMemo(() => {
    const map = new Map<string, RawMaterialRecord>();
    for (const rm of rawMaterials) {
      const code = rm.code?.trim();
      if (code) map.set(code.toUpperCase(), rm);
    }
    return map;
  }, [rawMaterials]);

  const reloadRawMaterialsMaster = useCallback(async (): Promise<void> => {
    try {
      const [rows, groupsRes] = await Promise.all([
        fetchRawMaterialsList(),
        fetchItemGroups('RM'),
      ]);
      setRawMaterials(rows ?? []);
      setItemGroupsRm(groupsRes.success && groupsRes.data ? groupsRes.data : []);
    } catch {
      setRawMaterials([]);
      setItemGroupsRm([]);
    }
  }, []);

  useEffect(() => {
    void reloadRawMaterialsMaster();
  }, [reloadRawMaterialsMaster]);

  const refreshOpenProductDetail = useCallback(
    async (productId?: number | string): Promise<void> => {
      const id = productId ?? selectedProduct?.product_id;
      if (id == null || !isPanelOpen) return;
      const res = await fetchPRProductDetail(id);
      if (res.success && res.data) {
        setSelectedProduct(res.data);
        if (isEditMode) {
          setEditDraft({ ...res.data });
        }
      }
    },
    [selectedProduct?.product_id, isPanelOpen, isEditMode]
  );

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchPRProducts();
    if (res.success && res.data) {
      setList(res.data);
    } else {
      const err = res.error;
      setError(typeof err === 'string' ? err : err?.message ?? 'Failed to load products');
      setList([]);
    }
    setLoading(false);
  }, []);

  const handleViewItem = useCallback(async (product: PRProductListItem) => {
    setIsPanelOpen(true);
    setDetailLoading(true);
    setSelectedProduct(null);
    setEditDraft(null);
    setIsEditMode(false);
    setPanelTab(0);
    const [res] = await Promise.all([
      fetchPRProductDetail(product.product_id),
      reloadRawMaterialsMaster(),
    ]);
    setDetailLoading(false);
    if (res.success && res.data) {
      setSelectedProduct(res.data);
    }
  }, [reloadRawMaterialsMaster]);

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setSelectedProduct(null);
    setEditDraft(null);
    setIsEditMode(false);
    setPanelTab(0);
  };

  const startEdit = () => {
    if (selectedProduct) {
      setEditDraft({ ...selectedProduct });
      setIsEditMode(true);
    }
  };

  const cancelEdit = () => {
    setEditDraft(null);
    setIsEditMode(false);
  };

  const updateDraft = (updates: Partial<PRProductDetail>) => {
    setEditDraft((prev) => (prev ? { ...prev, ...updates } : null));
  };

  const addFormulaPhase = () => {
    setEditDraft((prev) => ({
      ...prev!,
      formulaBom: [...(prev?.formulaBom ?? []), { phase: 'New Phase', ingredients: [] }],
    }));
  };
  const addFormulaIngredient = (phaseIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const fb = [...(prev.formulaBom ?? [])];
      if (!fb[phaseIdx]) return prev;
      fb[phaseIdx] = {
        ...fb[phaseIdx],
        ingredients: [
          ...fb[phaseIdx].ingredients,
          { inci_name: '', rm_code: '', pct_w_w: 0, uom: 'kg' },
        ],
      };
      return { ...prev, formulaBom: fb };
    });
  };
  const setFormulaIngredientKind = (phaseIdx: number, ingIdx: number, kind: 'rm' | 'item_group') => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const fb = (prev.formulaBom ?? []).map((p, i) => {
        if (i !== phaseIdx) return p;
        return {
          ...p,
          ingredients: p.ingredients.map((ing, j) => {
            if (j !== ingIdx) return ing;
            if (kind === 'item_group') {
              return {
                ...ing,
                raw_material_id: null,
                inci_name: '',
                rm_code: '',
                item_group_id: null,
                item_group_name: null,
              };
            }
            return {
              ...ing,
              item_group_id: null,
              item_group_name: null,
            };
          }),
        };
      });
      return { ...prev, formulaBom: fb };
    });
  };
  const setFormulaIngredientItemGroup = (phaseIdx: number, ingIdx: number, groupId: string) => {
    const grp = itemGroupsRm.find((g) => String(g.id) === groupId);
    setEditDraft((prev) => {
      if (!prev) return null;
      const fb = (prev.formulaBom ?? []).map((p, i) => {
        if (i !== phaseIdx) return p;
        return {
          ...p,
          ingredients: p.ingredients.map((ing, j) => {
            if (j !== ingIdx) return ing;
            if (!grp) {
              return {
                ...ing,
                item_group_id: null,
                item_group_name: null,
                raw_material_id: null,
                inci_name: '',
                rm_code: '',
              };
            }
            return {
              ...ing,
              item_group_id: Number(grp.id),
              item_group_name: grp.name,
              inci_name: grp.name,
              rm_code: grp.code,
              raw_material_id: null,
            };
          }),
        };
      });
      return { ...prev, formulaBom: fb };
    });
  };
  const updateFormulaIngredient = (phaseIdx: number, ingIdx: number, field: keyof FormulaBomPhase['ingredients'][0], value: string | number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const fb = (prev.formulaBom ?? []).map((p, i) =>
        i !== phaseIdx ? p : { ...p, ingredients: p.ingredients.map((ing, j) => (j !== ingIdx ? ing : { ...ing, [field]: value })) }
      );
      return { ...prev, formulaBom: fb };
    });
  };
  const removeFormulaIngredient = (phaseIdx: number, ingIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const fb = (prev.formulaBom ?? []).map((p, i) =>
        i !== phaseIdx ? p : { ...p, ingredients: p.ingredients.filter((_, j) => j !== ingIdx) }
      );
      return { ...prev, formulaBom: fb };
    });
  };
  const updateFormulaPhaseName = (phaseIdx: number, phase: string) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const fb = [...(prev.formulaBom ?? [])];
      if (!fb[phaseIdx]) return prev;
      fb[phaseIdx] = { ...fb[phaseIdx], phase };
      return { ...prev, formulaBom: fb };
    });
  };
  const removeFormulaPhase = (phaseIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const formulaBom = (prev.formulaBom ?? []).filter((_, i) => i !== phaseIdx);
      return { ...prev, formulaBom };
    });
  };

  const importFormulaBomIntoSkuBom = () => {
    if (!editDraft) return;
    const limQ = editDraft.skuBomLimitQty != null ? String(editDraft.skuBomLimitQty) : '';
    const limU = String(editDraft.skuBomLimitUom ?? 'GM');
    const { limitQty, limitUom } = getEffectiveSkuBomLimitFields({
      skuBomLimitQty: limQ,
      skuBomLimitUom: limU,
    });
    if (!limitQty || !limitUom) {
      toast.error('Set net per-unit quantity and UOM on the SKU BOM tab before importing from Formula BOM.');
      return;
    }
    const formulaLines = flattenFormulaBomPhases(editDraft.formulaBom ?? []);
    const res = formulaRowsToSkuBomLines({ formulaLines, limitQty, limitUom });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if ((editDraft.skuBom ?? []).length > 0) {
      const ok = window.confirm(
        'Replace all SKU BOM lines with quantities derived from Formula BOM % w/w? Existing SKU lines will be removed from this draft.'
      );
      if (!ok) return;
    }
    const skuBom: SkuBomRow[] = res.rows.map((r, i) => ({
      row_number: i + 1,
      inci_name: r.inciName,
      rm_code: r.rmCode,
      raw_material_id: r.rawMaterialId && !Number.isNaN(Number(r.rawMaterialId)) ? Number(r.rawMaterialId) : null,
      qty_per_unit: r.qtyPerUnit,
      uom: r.uom,
    }));
    updateDraft({
      skuBom,
      skuBomLimitQty: res.limitQty,
      skuBomLimitUom: res.limitUom,
    });
    toast.success(
      `Imported ${skuBom.length} SKU line(s) from Formula BOM for net ${res.limitQty} ${res.limitUom}.`
    );
  };

  /** Toolbar: wipe BOM line data on every PR (next to Formula BOM Excel). Requires typed confirmation. */
  const handleToolbarClearAllPrBom = useCallback(async () => {
    if (isEditMode) {
      const okDraft = window.confirm(
        'Global reset updates the server for all products. Any unsaved edits in the side panel will be lost when data reloads. Continue?'
      );
      if (!okDraft) return;
    }
    const ok = window.confirm(
      'This permanently HARD-deletes ALL PR master data from the database (rows are removed, not archived):\n' +
        '• Every product row in the catalogue table (including previously soft-deleted)\n' +
        '• Every row in the BOM table (including orphan BOMs)\n' +
        '• Related planning, warehouse FG rows, items-list PR links, and product customizations\n\n' +
        'Raw material and pack material masters are not deleted. If any ecommerce order lines still reference these products, the reset will be blocked. You will be asked to type a confirmation phrase next.'
    );
    if (!ok) return;
    const phrase = window.prompt(`Type exactly: ${ALL_PR_BOM_RESET_CONFIRM}`);
    if (phrase !== ALL_PR_BOM_RESET_CONFIRM) {
      toast.error('Confirmation phrase did not match — no changes made.');
      return;
    }
    setPrToolbarFullResetting(true);
    try {
      const res = await clearAllPrBomFullReset(ALL_PR_BOM_RESET_CONFIRM);
      if (!res.success || !res.data) {
        const err = res.error;
        const msg =
          typeof err === 'string'
            ? err
            : err && typeof err === 'object' && 'message' in err
              ? String(err.message)
              : 'Failed to reset';
        toast.error(msg);
        return;
      }
      toast.success(res.data.message ?? 'All PR BOM data cleared.');
      if (selectedProduct) {
        const detail = await fetchPRProductDetail(selectedProduct.product_id);
        if (detail.success && detail.data) {
          setSelectedProduct(detail.data);
          if (isEditMode) setEditDraft({ ...detail.data });
        }
      }
      loadProducts();
    } finally {
      setPrToolbarFullResetting(false);
    }
  }, [selectedProduct, isEditMode, loadProducts]);

  const handleFormulaRmBomExcelUpload = useCallback(
    async (file: File) => {
      setFormulaRmExcelUploading(true);
      setFormulaBomUploadPercent(0);
      try {
        const buf = await file.arrayBuffer();
        const parsed = parseFormulaBomWorkbook(buf);

        if (parsed.errors.length > 0) {
          for (const err of parsed.errors) {
            toast.error(err);
          }
          return;
        }

        if (parsed.warnings.length > 0) {
          for (const w of parsed.warnings) {
            toast.info(w);
          }
        }

        const summaryRows = parsed.summary?.rows ?? [];
        if (summaryRows.length === 0) {
          toast.error('No data rows found on the Summary sheet.');
          return;
        }

        const rmRows = parsed.rm?.rows ?? [];
        const packRows = parsed.pack?.rows ?? [];
        const summaryChunks = chunkSummaryRows(summaryRows, FORMULA_SUMMARY_CHUNK_ROWS);
        const rmChunks = chunkCompositeGroups(groupRowsByCompositeSku(rmRows), FORMULA_BOM_CHUNK_GROUPS);
        const packChunks = chunkCompositeGroups(groupRowsByCompositeSku(packRows), FORMULA_BOM_CHUNK_GROUPS);
        const totalSteps = summaryChunks.length + rmChunks.length + packChunks.length;

        let stepDone = 0;
        const setProgressFromStep = () => {
          stepDone += 1;
          if (totalSteps > 0) {
            setFormulaBomUploadPercent(Math.min(100, Math.round((stepDone / totalSteps) * 100)));
          }
        };

        const allSummaryResults: FormulaSummaryGroupResult[] = [];
        const allRmResults: FormulaRmBomGroupResult[] = [];
        const allPackResults: FormulaPackBomGroupResult[] = [];

        for (let i = 0; i < summaryChunks.length; i += 1) {
          const res = await postFormulaSummaryChunk({
            chunk_index: i,
            chunk_total: summaryChunks.length,
            rows: summaryChunks[i],
          });
          if (!res.success || !res.data) {
            toast.error(
              typeof res.error === 'object' && res.error && 'message' in res.error
                ? String(res.error.message)
                : 'Summary chunk import failed'
            );
            return;
          }
          allSummaryResults.push(...res.data.results);
          setProgressFromStep();
        }

        if (rmRows.length > 0) {
          for (let i = 0; i < rmChunks.length; i += 1) {
            const res = await postFormulaRmBomChunk({
              chunk_index: i,
              chunk_total: rmChunks.length,
              apply_sg: false,
              groups: rmChunks[i],
            });
            if (!res.success || !res.data) {
              toast.error(
                typeof res.error === 'object' && res.error && 'message' in res.error
                  ? String(res.error.message)
                  : 'RM BOM chunk import failed'
              );
              return;
            }
            allRmResults.push(...res.data.results);
            setProgressFromStep();
          }
        } else if (parsed.rm?.sheetName) {
          toast.info(`RM BOM sheet "${parsed.rm.sheetName}" had no importable formula lines.`);
        }

        if (packRows.length > 0) {
          for (let i = 0; i < packChunks.length; i += 1) {
            const res = await postFormulaPackBomChunk({
              chunk_index: i,
              chunk_total: packChunks.length,
              groups: packChunks[i],
            });
            if (!res.success || !res.data) {
              toast.error(
                typeof res.error === 'object' && res.error && 'message' in res.error
                  ? String(res.error.message)
                  : 'PM BOM chunk import failed'
              );
              return;
            }
            allPackResults.push(...res.data.results);
            setProgressFromStep();
          }
        } else if (parsed.pack?.sheetName) {
          toast.info(`PM BOM sheet "${parsed.pack.sheetName}" had no importable packaging lines.`);
        }

        if (totalSteps === 0) {
          setFormulaBomUploadPercent(100);
        }

        const summaryOk = allSummaryResults.filter((r) => r.success).length;
        const summaryFail = allSummaryResults.filter((r) => !r.success).length;
        const summaryNewPr = allSummaryResults.filter((r) => r.success && r.product_created).length;
        const rmOk = allRmResults.filter((r) => r.success).length;
        const rmFail = allRmResults.filter((r) => !r.success).length;
        const packOk = allPackResults.filter((r) => r.success).length;
        const packFail = allPackResults.filter((r) => !r.success).length;

        const parts: string[] = [];
        const newBit = summaryNewPr > 0 ? `, ${summaryNewPr} new PR` : '';
        parts.push(
          `Summary (${parsed.summary?.sheetName ?? 'Summary'}): ${summaryOk} ok${newBit}, ${summaryFail} failed`
        );
        if (rmRows.length > 0) {
          parts.push(`RM (${parsed.rm?.sheetName ?? 'RM BOM'}): ${rmOk} ok, ${rmFail} failed`);
        }
        if (packRows.length > 0) {
          parts.push(`PM (${parsed.pack?.sheetName ?? 'PM BOM'}): ${packOk} ok, ${packFail} failed`);
        }
        toast.success(`Formula BOM import — ${parts.join('; ')}.`);

        const selectedZoho = String(
          (selectedProduct as unknown as { zoho_sku_code?: string })?.zoho_sku_code ?? ''
        ).trim();
        if (selectedZoho && selectedProduct) {
          const z = selectedZoho.toLowerCase();
          const hitSummary = allSummaryResults.some(
            (r) => r.success && String(r.sku ?? '').trim().toLowerCase() === z
          );
          const hitRm = allRmResults.some(
            (r) => r.success && String(r.composite_sku ?? '').trim().toLowerCase() === z
          );
          const hitPack = allPackResults.some(
            (r) => r.success && String(r.composite_sku ?? '').trim().toLowerCase() === z
          );
          if (hitSummary || hitRm || hitPack) {
            const detail = await fetchPRProductDetail(selectedProduct.product_id);
            if (detail.success && detail.data) {
              setSelectedProduct(detail.data);
              if (isEditMode) setEditDraft({ ...detail.data });
            }
          }
        }
        loadProducts();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Formula BOM import failed');
      } finally {
        setFormulaRmExcelUploading(false);
        setFormulaBomUploadPercent(null);
        if (formulaRmFileInputRef.current) formulaRmFileInputRef.current.value = '';
      }
    },
    [selectedProduct, isEditMode, loadProducts]
  );

  const addPackRow = () => {
    setEditDraft((prev) => ({
      ...prev!,
      packBom: [
        ...(prev?.packBom ?? []),
        {
          row_number: (prev?.packBom?.length ?? 0) + 1,
          pm_id: null,
          pm_description: '',
          pm_code: '',
          pack_type: 'Primary',
          pm_sku_category: '',
          pm_sub_category: '',
          pm_sub_sub_category: '',
          qty_per_unit: 1,
          uom: 'pc/unit',
        },
      ],
    }));
  };
  const updatePackRow = (rowIdx: number, field: keyof Omit<PackBomRow, 'row_number' | 'pm_id'>, value: string | number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const packBom = (prev.packBom ?? []).map((row, i) => (i !== rowIdx ? row : { ...row, [field]: value }));
      return { ...prev, packBom };
    });
  };
  const updatePackRowCategory = (rowIdx: number, categoryRaw: string) => {
    const canon = normalizePmSkuCategoryForSelect(categoryRaw) || '';
    const level = pmLevelForSubCategory(canon);
    setEditDraft((prev) => {
      if (!prev) return null;
      const packBom = (prev.packBom ?? []).map((row, i) => {
        if (i !== rowIdx) return row;
        return {
          ...row,
          pm_sku_category: canon,
          pm_sub_category: normalizePmDetailSubCategoryForSelect(
            canon,
            row.pm_sub_category ?? ''
          ),
          pm_sub_sub_category: '',
          pack_type: level || row.pack_type,
        };
      });
      return { ...prev, packBom };
    });
  };
  const updatePackRowSubCategory = (rowIdx: number, subRaw: string) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const packBom = (prev.packBom ?? []).map((row, i) => {
        if (i !== rowIdx) return row;
        const detail =
          normalizePmDetailSubCategoryForSelect(row.pm_sku_category ?? '', subRaw) || subRaw;
        return {
          ...row,
          pm_sub_category: detail,
          pm_sub_sub_category: normalizePmSubSubCategoryForSelect(
            detail,
            row.pm_sub_sub_category ?? '',
            row.pm_sku_category ?? ''
          ),
        };
      });
      return { ...prev, packBom };
    });
  };
  const removePackRow = (rowIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const packBom = (prev.packBom ?? []).filter((_, i) => i !== rowIdx).map((r, i) => ({ ...r, row_number: i + 1 }));
      return { ...prev, packBom };
    });
  };

  const addProcessStep = () => {
    setEditDraft((prev) => ({
      ...prev!,
      processSteps: [...(prev?.processSteps ?? []), { step_number: (prev?.processSteps?.length ?? 0) + 1, description: '', duration_minutes: 0 }],
    }));
  };
  const updateProcessStep = (stepIdx: number, field: keyof ProcessStep, value: string | number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const processSteps = (prev.processSteps ?? []).map((s, i) => (i !== stepIdx ? s : { ...s, [field]: value }));
      return { ...prev, processSteps };
    });
  };
  const removeProcessStep = (stepIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const processSteps = (prev.processSteps ?? []).filter((_, i) => i !== stepIdx).map((s, i) => ({ ...s, step_number: i + 1 }));
      return { ...prev, processSteps };
    });
  };

  const handleSave = useCallback(async () => {
    if (!selectedProduct || !editDraft) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      product_name: editDraft.product_name ?? selectedProduct.product_name,
      product_code: editDraft.product_code ?? selectedProduct.product_code,
      zoho_sku_code:
        (editDraft as unknown as { zoho_sku_code?: string }).zoho_sku_code
        ?? (editDraft as unknown as { product_sku?: string }).product_sku
        ?? (selectedProduct as unknown as { zoho_sku_code?: string }).zoho_sku_code
        ?? (selectedProduct as unknown as { product_sku?: string }).product_sku,
      product_description: editDraft.product_description ?? selectedProduct.product_description,
      category: editDraft.category ?? selectedProduct.category,
      status: editDraft.status ?? selectedProduct.status,
      form: editDraft.form ?? selectedProduct.form,
      batch_size_kg: editDraft.batch_size_kg ?? selectedProduct.batch_size_kg,
      shelf_life_months: editDraft.shelf_life_months ?? selectedProduct.shelf_life_months,
      version: editDraft.version ?? selectedProduct.version,
      license_cml: editDraft.license_cml ?? selectedProduct.license_cml,
      theoretical_yield_pct: editDraft.theoretical_yield_pct ?? selectedProduct.theoretical_yield_pct,
      pao_months: editDraft.pao_months ?? selectedProduct.pao_months,
      mrp_price: editDraft.mrp_price ?? selectedProduct.mrp_price,
      manufacturing_location: editDraft.manufacturing_location ?? selectedProduct.manufacturing_location,
      equipment_vessel: editDraft.equipment_vessel ?? selectedProduct.equipment_vessel,
      storage_conditions: editDraft.storage_conditions ?? selectedProduct.storage_conditions,
      approved_claims: editDraft.approved_claims ?? selectedProduct.approved_claims,
      ph_range: editDraft.ph_range ?? selectedProduct.ph_range,
      viscosity_range: editDraft.viscosity_range ?? selectedProduct.viscosity_range,
      spf_pa_rating: editDraft.spf_pa_rating ?? selectedProduct.spf_pa_rating,
      appearance: editDraft.appearance ?? selectedProduct.appearance,
      odour: editDraft.odour ?? selectedProduct.odour,
      fill_weight_spec: editDraft.fill_weight_spec ?? selectedProduct.fill_weight_spec,
      stability_summary: editDraft.stability_summary ?? selectedProduct.stability_summary,
      pr_record_type:
        editDraft.pr_record_type !== undefined ? editDraft.pr_record_type : selectedProduct.pr_record_type,
    };
    const formulaBom = editDraft.formulaBom ?? selectedProduct.formulaBom ?? [];
    const skuBom = editDraft.skuBom ?? selectedProduct.skuBom ?? [];
    const packBom = editDraft.packBom ?? selectedProduct.packBom ?? [];
    const processSteps = editDraft.processSteps ?? selectedProduct.processSteps ?? [];
    const rm_lines = formulaBom.flatMap((p) =>
      p.ingredients.map((ing) => ({
        phase: p.phase,
        inci_name: ing.inci_name,
        rm_code: ing.rm_code,
        pct_w_w: ing.pct_w_w,
        uom: ing.uom || 'kg',
        ...(ing.raw_material_id != null ? { raw_material_id: ing.raw_material_id } : {}),
        ...(ing.item_group_id != null && Number(ing.item_group_id) > 0
          ? {
              item_group_id: Number(ing.item_group_id),
              item_group_name: ing.item_group_name ?? ing.inci_name,
            }
          : {}),
      }))
    );
    const sku_rm_lines = skuBom.map((r) => ({
      inci_name: r.inci_name,
      rm_code: r.rm_code,
      qty_per_unit: r.qty_per_unit,
      uom: r.uom || 'GM',
      ...(r.raw_material_id != null ? { raw_material_id: r.raw_material_id } : {}),
    }));
    const sku_bom_limit_qty = editDraft.skuBomLimitQty ?? selectedProduct.skuBomLimitQty ?? null;
    const sku_bom_limit_uom = editDraft.skuBomLimitUom ?? selectedProduct.skuBomLimitUom ?? null;
    if (countMeaningfulFormulaRmLines(rm_lines) < 1) {
      setSaving(false);
      toast.error('At least one Formula BOM line is required.');
      return;
    }
    if (countMeaningfulPackLines(pm_lines) < 1) {
      setSaving(false);
      toast.error('At least one Pack BOM line is required.');
      return;
    }
    if (countMeaningfulSkuRmLines(sku_rm_lines) > 0) {
      const skuPanelV = validateSkuBomTotals({
        lines: sku_rm_lines,
        limitQty: sku_bom_limit_qty,
        limitUom: sku_bom_limit_uom,
      });
      if (!skuPanelV.ok) {
        setSaving(false);
        toast.error(skuPanelV.error);
        return;
      }
    }
    const pm_lines = packBom.map((r) => ({
      pm_code: r.pm_code,
      description: r.pm_description,
      pack_type: r.pack_type,
      pm_sku_category: r.pm_sku_category || undefined,
      pm_sub_category: r.pm_sub_category || undefined,
      optional_pm_sub_category: r.pm_sub_category || undefined,
      pm_sub_sub_category: r.pm_sub_sub_category || undefined,
      optional_pm_sub_sub_category: r.pm_sub_sub_category || undefined,
      qty_per_unit: r.qty_per_unit,
      uom: r.uom,
    }));
    const process_steps = processSteps.map((s, i) => ({ step_number: i + 1, description: s.description, duration_minutes: s.duration_minutes }));
    payload.bom = { rm_lines, sku_rm_lines, sku_bom_limit_qty, sku_bom_limit_uom, pm_lines, process_steps };
    const res = await updatePRProduct(selectedProduct.product_id, payload);
    setSaving(false);
    if (res.success && res.data) {
      setSelectedProduct(res.data);
      setEditDraft(null);
      setIsEditMode(false);
      await Promise.all([loadProducts(), reloadRawMaterialsMaster()]);
      toast.success('Product updated');
    } else {
      toast.error(res.error ?? 'Update failed');
    }
  }, [selectedProduct, editDraft, loadProducts, reloadRawMaterialsMaster]);

  const displayProduct = isEditMode && editDraft ? editDraft : selectedProduct;

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (loading || deepLinkPrAppliedRef.current || list.length === 0) return;
    const productIdRaw = searchParams.get('productId')?.trim();
    const prCodeRaw = searchParams.get('pr')?.trim();
    if (!productIdRaw && !prCodeRaw) return;

    let product: PRProductListItem | undefined;
    if (productIdRaw) {
      const id = Number(productIdRaw);
      if (Number.isFinite(id)) {
        product = list.find((p) => Number(p.product_id) === id);
      }
    }
    if (!product && prCodeRaw) {
      const key = prCodeRaw.toUpperCase();
      product = list.find((p) => String(p.product_code ?? '').trim().toUpperCase() === key);
    }
    if (!product) {
      deepLinkPrAppliedRef.current = true;
      if (prCodeRaw) setSearchTerm(prCodeRaw);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('productId');
        next.delete('pr');
        return next;
      }, { replace: true });
      return;
    }

    deepLinkPrAppliedRef.current = true;
    void handleViewItem(product);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('productId');
      next.delete('pr');
      return next;
    }, { replace: true });
  }, [loading, list, searchParams, handleViewItem, setSearchParams]);

  useEffect(() => {
    // Reset to page 1 whenever filters/search/page size change.
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, statusTab, rmAssignStatusFilter, packAssignStatusFilter, pageSize, sortColumn, sortDirection]);

  const togglePrSort = useCallback((column: PrListSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  }, [sortColumn]);

  const statusCounts = useMemo(
    () => buildMasterApprovalStatusCounts(list, (p) => p.status, ['Discontinued']),
    [list]
  );

  const filteredList = useMemo(() => {
    return list.filter((p) => {
      const matchSearch = !searchTerm.trim() || [
        p.product_name,
        p.product_code,
        (p as unknown as { zoho_sku_code?: string }).zoho_sku_code,
        (p as unknown as { product_sku?: string }).product_sku,
      ].some((s) => (s ?? '').toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCat = selectedCategory === 'All Categories' || p.category === selectedCategory;
      const matchStatus =
        statusTab === 'all'
          ? true
          : statusTab === 'Discontinued'
            ? String(p.status ?? '').trim() === 'Discontinued'
            : normalizeMasterApprovalStatus(p.status) === statusTab;
      const assignees = normalizeStageAssignees(p.approval_stage_assignees);
      const pending = normalizePrApprovalTeamPending(p.approval_team_pending);
      const matchRmStatus =
        rmAssignStatusFilter === 'all' || getPrTeamAssignStatus('rm_team', assignees, pending) === rmAssignStatusFilter;
      const matchPackStatus =
        packAssignStatusFilter === 'all' ||
        getPrTeamAssignStatus('pack_team', assignees, pending) === packAssignStatusFilter;
      return matchSearch && matchCat && matchStatus && matchRmStatus && matchPackStatus;
    });
  }, [list, searchTerm, selectedCategory, statusTab, rmAssignStatusFilter, packAssignStatusFilter]);

  const sortedFilteredList = useMemo(() => {
    if (!sortColumn) return filteredList;
    const dir = sortDirection;
    const packSizeKey = (p: PRProductListItem): string =>
      formatSkuBomLimitAsPack(p.skuBomLimitQty, p.skuBomLimitUom);
    const recordKey = (p: PRProductListItem): string => p.pr_record_type ?? '';
    const cmp = (a: PRProductListItem, b: PRProductListItem): number => {
      switch (sortColumn) {
        case 'code':
          return compareMasterTableSort(a.product_code ?? '', b.product_code ?? '', dir);
        case 'record':
          return compareMasterTableSort(recordKey(a), recordKey(b), dir);
        case 'product':
          return compareMasterTableSort(a.product_name ?? '', b.product_name ?? '', dir);
        case 'category':
          return compareMasterTableSort(a.category ?? '', b.category ?? '', dir);
        case 'subCategory':
          return compareMasterTableSort(a.pr_sub_category ?? '', b.pr_sub_category ?? '', dir);
        case 'form':
          return compareMasterTableSort(a.form ?? '', b.form ?? '', dir);
        case 'packSize':
          return compareMasterTableSort(packSizeKey(a), packSizeKey(b), dir);
        case 'batchKg':
          return compareMasterTableSort(Number(a.batch_size_kg ?? 0), Number(b.batch_size_kg ?? 0), dir);
        case 'shelfLife':
          return compareMasterTableSort(
            Number(a.shelf_life_months ?? 0),
            Number(b.shelf_life_months ?? 0),
            dir
          );
        case 'rmIngs':
          return compareMasterTableSort(
            Number(a.rm_ingredients_count ?? 0),
            Number(b.rm_ingredients_count ?? 0),
            dir
          );
        case 'packItems':
          return compareMasterTableSort(
            Number(a.pack_items_count ?? 0),
            Number(b.pack_items_count ?? 0),
            dir
          );
        case 'status':
          return compareMasterTableSort(
            normalizeMasterApprovalStatus(a.status),
            normalizeMasterApprovalStatus(b.status),
            dir
          );
        case 'openSos':
          return compareMasterTableSort(
            Number(a.open_sos_count ?? 0),
            Number(b.open_sos_count ?? 0),
            dir
          );
        default:
          return 0;
      }
    };
    return [...filteredList].sort(cmp);
  }, [filteredList, sortColumn, sortDirection]);

  const totalFiltered = sortedFilteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const pagedFilteredList = sortedFilteredList.slice(startIndex, startIndex + pageSize);

  const statCardData = [
    { label: 'TOTAL PRODUCTS', value: list.length, sub: 'Registered PR masters', accent: 'border-l-blue-500', num: 'text-blue-600' },
    { label: 'ACTIVE', value: list.filter((p) => p.status === 'Active').length, sub: 'Approved masters', accent: 'border-l-green-500', num: 'text-green-600' },
    { label: 'CATEGORIES', value: [...new Set(list.map((p) => p.category).filter(Boolean))].length, sub: 'Product categories', accent: 'border-l-orange-400', num: 'text-orange-500' },
    { label: 'RM INGREDIENTS', value: list.reduce((sum, p) => sum + (p.rm_ingredients_count ?? 0), 0), sub: 'Total in formulas', accent: 'border-l-teal-500', num: 'text-teal-600' },
    { label: 'PM COMPONENTS', value: list.reduce((sum, p) => sum + (p.pack_items_count ?? 0), 0), sub: 'Total pack items', accent: 'border-l-rose-500', num: 'text-rose-600' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
      <div className="px-6 md:px-10 py-8 space-y-6 w-full">

        {/* ── Page Header ── */}
        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-r from-blue-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl"></span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">PR Masters</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Products (PR)</h1>
            <p className="text-sm text-gray-600">Manage product registrations, formulations, packaging specifications and regulatory compliance.</p>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCardData.map(card => (
            <div key={card.label} className={`group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
              <div className={`h-1 bg-linear-to-r from-blue-400 to-blue-600 ${card.accent}`} />
              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">{card.label}</p>
                <p className={`text-3xl font-extrabold mt-2 ${card.num} group-hover:scale-110 transition-transform origin-left`}>{card.value}</p>
                <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <MasterApprovalStatusTabs
          value={statusTab}
          onChange={(tab) => {
            setStatusTab(tab as PrStatusTab);
            setCurrentPage(1);
          }}
          counts={statusCounts}
          extraTabs={[{ id: 'Discontinued', label: 'Discontinued' }]}
          accent="blue"
        />

        {/* ── Table Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">

          {/* toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-linear-to-r from-slate-50/50 to-transparent">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-gray-900">Products Master</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/50">{pagedFilteredList.length} / {totalFiltered}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* search */}
              <div className="relative group">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadProducts()}
                  placeholder="Search name, code, SKU…"
                  className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all w-52"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
              >
                <option>All Categories</option>
                {[...new Set(list.map((p) => p.category).filter(Boolean))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>

              <select
                value={rmAssignStatusFilter}
                onChange={(e) => setRmAssignStatusFilter(e.target.value as 'all' | PrTeamAssignStatus)}
                title="Filter by RM team assign status"
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
              >
                <option value="all">RM status: All</option>
                {PR_TEAM_ASSIGN_STATUSES.map((s) => (
                  <option key={s} value={s}>RM: {s}</option>
                ))}
              </select>

              <select
                value={packAssignStatusFilter}
                onChange={(e) => setPackAssignStatusFilter(e.target.value as 'all' | PrTeamAssignStatus)}
                title="Filter by Pack team assign status"
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
              >
                <option value="all">Pack status: All</option>
                {PR_TEAM_ASSIGN_STATUSES.map((s) => (
                  <option key={s} value={s}>Pack: {s}</option>
                ))}
              </select>

              <Link
                to="/bom/new"
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap gap-1"
              >
                <PlusCircle className="w-4 h-4" />
                New PR
              </Link>

              {canEdit && (
                <>
                  <input
                    ref={formulaRmFileInputRef}
                    type="file"
                    accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleFormulaRmBomExcelUpload(f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={formulaRmExcelUploading}
                    title='Requires Summary, RM BOM, and PM BOM worksheets. Summary: category, pack, SG. RM: Formula % (RM Count). PM: Qty/Unit per FG (PM Count).'
                    onClick={() => formulaRmFileInputRef.current?.click()}
                    className="inline-flex items-center px-3 py-2 border border-blue-200 bg-white text-blue-800 text-xs font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap gap-1"
                  >
                    <Upload className="w-4 h-4" />
                    {formulaRmExcelUploading ? 'Importing…' : 'Formula BOM (Excel)'}
                  </button>
                  <button
                    type="button"
                    disabled={formulaRmExcelUploading || prToolbarFullResetting}
                    title="Permanently deletes all PR-linked catalogue products, every BOM row, and related planning/inventory rows. Raw and pack material masters are kept. Blocked if ecommerce orders still reference these products. Requires typing a confirmation phrase."
                    onClick={() => void handleToolbarClearAllPrBom()}
                    className="inline-flex items-center px-3 py-2 border border-amber-300 bg-amber-50 text-amber-950 text-xs font-semibold rounded-lg hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap gap-1"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {prToolbarFullResetting ? 'Deleting…' : 'Delete all PR masters'}
                  </button>
                  {formulaRmExcelUploading && formulaBomUploadPercent != null && (
                    <div className="flex items-center gap-2 min-w-[10rem]">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[9rem]">
                        <div
                          className="h-full bg-blue-600 transition-[width] duration-150 ease-out"
                          style={{ width: `${formulaBomUploadPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 tabular-nums w-9">{formulaBomUploadPercent}%</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Table */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <span className="animate-pulse">Loading Products…</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Sr No</th>
                    <SortableTableTh
                      label="Code"
                      column="code"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <SortableTableTh
                      label="Record"
                      column="record"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <SortableTableTh
                      label="Product"
                      column="product"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <SortableTableTh
                      label="Category"
                      column="category"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <SortableTableTh
                      label="Sub-category"
                      column="subCategory"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <SortableTableTh
                      label="Form"
                      column="form"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <SortableTableTh
                      label="Pack size"
                      column="packSize"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <SortableTableTh
                      label="Batch (kg)"
                      column="batchKg"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <SortableTableTh
                      label="Shelf life"
                      column="shelfLife"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <SortableTableTh
                      label="RM ings."
                      column="rmIngs"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <SortableTableTh
                      label="Pack items"
                      column="packItems"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <SortableTableTh
                      label="Status"
                      column="status"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">RM approval</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">PM approval</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">RM assign</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Pack assign</th>
                    <SortableTableTh
                      label="Open SOs"
                      column="openSos"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={togglePrSort}
                      accent="cyan"
                    />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Logs</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={20} className="px-4 py-12 text-center text-gray-500">
                        No Products found. <Link to="/bom/new" className="text-blue-600 hover:text-blue-700 font-semibold">Create one</Link> to get started.
                      </td>
                    </tr>
                  ) : (
                    pagedFilteredList.map((p, idx) => (
                      <tr key={p.product_id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleViewItem(p)}>
                        <td className="px-4 py-3 text-sm text-gray-500">{startIndex + idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">{p.product_code || '—'}</td>
                        <td className="px-4 py-3 text-sm">
                          {p.pr_record_type === 'temporary' ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                              Temporary
                            </span>
                          ) : p.pr_record_type === 'permanent' ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                              Permanent
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{p.product_name || 'Product'}</p>
                            <p className="text-xs text-gray-500">SKU: {(p as unknown as { zoho_sku_code?: string; product_sku?: string }).zoho_sku_code ?? (p as unknown as { product_sku?: string }).product_sku ?? '—'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.category || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.pr_sub_category || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.form ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          {formatSkuBomLimitAsPack(p.skuBomLimitQty, p.skuBomLimitUom)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.batch_size_kg ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.shelf_life_months != null ? `${p.shelf_life_months}M` : '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-indigo-600 text-center">{p.rm_ingredients_count ?? 0}</td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-amber-600 text-center">{p.pack_items_count ?? 0}</td>
                        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`inline-flex w-fit items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border ${masterApprovalStatusBadgeClass(p.status ?? 'Draft')}`}
                          >
                            {p.status ?? 'Draft'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <MasterPrTrackApprovalCell
                            track="rm"
                            itemId={p.product_id}
                            trackApprovals={p.pr_track_approvals}
                            stageAssignees={p.approval_stage_assignees}
                            currentUserId={user?.id}
                            isAdmin={isAdmin}
                            onUpdated={(tracks, overall) => {
                              setList((prev) =>
                                prev.map((row) =>
                                  row.product_id === p.product_id
                                    ? { ...row, status: overall, lifecycle_status: overall, pr_track_approvals: tracks }
                                    : row
                                )
                              );
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <MasterPrTrackApprovalCell
                            track="pm"
                            itemId={p.product_id}
                            trackApprovals={p.pr_track_approvals}
                            stageAssignees={p.approval_stage_assignees}
                            currentUserId={user?.id}
                            isAdmin={isAdmin}
                            onUpdated={(tracks, overall) => {
                              setList((prev) =>
                                prev.map((row) =>
                                  row.product_id === p.product_id
                                    ? { ...row, status: overall, lifecycle_status: overall, pr_track_approvals: tracks }
                                    : row
                                )
                              );
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <MasterPrTeamAssignCell
                            team="rm_team"
                            itemId={p.product_id}
                            itemCode={p.product_code || String(p.product_id)}
                            stageAssignees={p.approval_stage_assignees}
                            approvalTeamPending={p.approval_team_pending}
                            canAssign={canAssignPrTeam('rm_team', p.approval_stage_assignees)}
                            onSaved={(assignees) => {
                              setList((prev) =>
                                prev.map((row) =>
                                  row.product_id === p.product_id
                                    ? {
                                        ...row,
                                        approval_stage_assignees: assignees,
                                        approval_team_pending: null,
                                      }
                                    : row
                                )
                              );
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <MasterPrTeamAssignCell
                            team="pack_team"
                            itemId={p.product_id}
                            itemCode={p.product_code || String(p.product_id)}
                            stageAssignees={p.approval_stage_assignees}
                            approvalTeamPending={p.approval_team_pending}
                            canAssign={canAssignPrTeam('pack_team', p.approval_stage_assignees)}
                            onSaved={(assignees) => {
                              setList((prev) =>
                                prev.map((row) =>
                                  row.product_id === p.product_id
                                    ? {
                                        ...row,
                                        approval_stage_assignees: assignees,
                                        approval_team_pending: null,
                                      }
                                    : row
                                )
                              );
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(p.open_sos_count ?? 0) > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-indigo-100 text-indigo-700 border border-indigo-200">{p.open_sos_count}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <MasterApprovalLogsCell
                            kind="PR"
                            itemId={p.product_id}
                            itemCode={p.product_code || String(p.product_id)}
                            itemLabel={p.product_name}
                            currentStatus={p.status ?? 'Draft'}
                          />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setBomEditPopupId(String(p.product_id)); }}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline mr-2"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Delete product "${p.product_name}" (${p.product_code})? This cannot be undone.`)) return;
                              const res = await deletePRProduct(p.product_id);
                              if (res.success) {
                                toast.success('Product deleted');
                                loadProducts();
                                if (selectedProduct?.product_id === p.product_id) handleClosePanel();
                              } else {
                                toast.error(res.error ?? 'Failed to delete');
                              }
                            }}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                </table>
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-t border-gray-100 bg-white">
                  <div className="text-xs text-gray-600">
                    Page <span className="font-semibold text-gray-900">{safeCurrentPage}</span> of{' '}
                    <span className="font-semibold text-gray-900">{totalPages}</span> • Showing{' '}
                    <span className="font-semibold text-gray-900">{totalFiltered === 0 ? 0 : startIndex + 1}</span>{' '}
                    -{' '}
                    <span className="font-semibold text-gray-900">{Math.min(startIndex + pageSize, totalFiltered)}</span> of{' '}
                    <span className="font-semibold text-gray-900">{totalFiltered}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage <= 1}
                      className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage >= totalPages}
                      className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── PR Detail Panel (5 tabs) ── */}
      {isPanelOpen && (
        <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div>
              <span className="text-sm font-mono text-gray-500">{selectedProduct?.product_code ?? '—'}</span>
              <h2 className="text-lg font-bold text-gray-900">{selectedProduct?.product_name ?? 'Product'}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => selectedProduct && setBomEditPopupId(String(selectedProduct.product_id))}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Edit page
              </button>
              {selectedProduct && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Delete product "${selectedProduct.product_name}"? This cannot be undone.`)) return;
                    const res = await deletePRProduct(selectedProduct.product_id);
                    if (res.success) {
                      toast.success('Product deleted');
                      handleClosePanel();
                      loadProducts();
                    } else {
                      toast.error(res.error ?? 'Failed to delete');
                    }
                  }}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Delete
                </button>
              )}
              <button onClick={handleClosePanel} className="p-2 rounded-lg hover:bg-gray-200 text-gray-600">X</button>
            </div>
          </div>
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">Loading…</div>
          ) : selectedProduct ? (
            <>
              <div className="flex gap-1 px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                {['Overview', 'Formula BOM', 'SKU BOM', 'Pack BOM', 'Process', 'Specs & Stability'].map((label, i) => (
                  <button
                    key={label}
                    onClick={() => setPanelTab(i)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${panelTab === i ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {panelTab === 0 && displayProduct && (
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Identity</div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="col-span-2">
                          <span className="text-gray-500">Internal PR code</span>
                          {isEditMode ? (
                            <input
                              value={displayProduct.product_code ?? ''}
                              onChange={(e) => updateDraft({ product_code: e.target.value })}
                              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono text-sm text-gray-900"
                            />
                          ) : (
                            <div className="font-mono mt-1 font-semibold text-gray-900">{displayProduct.product_code ?? '—'}</div>
                          )}
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">PR record type</span>
                          {isEditMode ? (
                            <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-900">
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="prRecordTypeDash"
                                  checked={displayProduct.pr_record_type === 'permanent'}
                                  onChange={() => updateDraft({ pr_record_type: 'permanent' })}
                                />
                                Permanent <span className="font-mono text-xs text-gray-500">(PR…)</span>
                              </label>
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="prRecordTypeDash"
                                  checked={displayProduct.pr_record_type === 'temporary'}
                                  onChange={() => updateDraft({ pr_record_type: 'temporary' })}
                                />
                                Temporary <span className="font-mono text-xs text-gray-500">(TPR…)</span>
                              </label>
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="prRecordTypeDash"
                                  checked={
                                    displayProduct.pr_record_type !== 'temporary' &&
                                    displayProduct.pr_record_type !== 'permanent'
                                  }
                                  onChange={() => updateDraft({ pr_record_type: null })}
                                />
                                Legacy / unspecified
                              </label>
                            </div>
                          ) : (
                            <div className="mt-1">
                              {displayProduct.pr_record_type === 'temporary' ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">Temporary</span>
                              ) : displayProduct.pr_record_type === 'permanent' ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">Permanent</span>
                              ) : (
                                <span className="text-gray-500">Legacy / unspecified</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div><span className="text-gray-500">Category</span>
                          {isEditMode ? <input value={displayProduct.category ?? ''} onChange={(e) => updateDraft({ category: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-gray-900" /> : <div className="font-medium">{displayProduct.category ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Status</span>
                          {isEditMode ? (
                            <select value={displayProduct.status ?? ''} onChange={(e) => updateDraft({ status: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-gray-900">
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : <div><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">{displayProduct.status ?? '—'}</span></div>}
                        </div>
                        <div><span className="text-gray-500">Form</span>
                          {isEditMode ? <input value={displayProduct.form ?? ''} onChange={(e) => updateDraft({ form: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.form ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Pack size (SKU BOM)</span>
                          <div className="font-mono mt-1">
                            {formatSkuBomLimitAsPack(
                              isEditMode ? editDraft?.skuBomLimitQty : selectedProduct?.skuBomLimitQty,
                              isEditMode ? editDraft?.skuBomLimitUom : selectedProduct?.skuBomLimitUom
                            )}
                          </div>
                        </div>
                        <div><span className="text-gray-500">SKU Code</span>
                          {isEditMode ? (
                            <input
                              value={
                                (displayProduct as unknown as { zoho_sku_code?: string }).zoho_sku_code
                                ?? (displayProduct as unknown as { product_sku?: string }).product_sku
                                ?? ''
                              }
                              onChange={(e) => updateDraft({ zoho_sku_code: e.target.value } as unknown as Partial<typeof displayProduct>)}
                              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono"
                            />
                          ) : (
                            <div className="font-mono">{
                              (displayProduct as unknown as { zoho_sku_code?: string }).zoho_sku_code
                              ?? (displayProduct as unknown as { product_sku?: string }).product_sku
                              ?? '—'
                            }</div>
                          )}
                        </div>
                        <div><span className="text-gray-500">License / CML</span>
                          {isEditMode ? <input value={displayProduct.license_cml ?? ''} onChange={(e) => updateDraft({ license_cml: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.license_cml ?? '—'}</div>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Commercials</div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-gray-500">Version</span>
                          {isEditMode ? <input value={displayProduct.version ?? ''} onChange={(e) => updateDraft({ version: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.version ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Batch Size (KG)</span>
                          {isEditMode ? <input type="number" value={displayProduct.batch_size_kg ?? ''} onChange={(e) => updateDraft({ batch_size_kg: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.batch_size_kg != null ? `${displayProduct.batch_size_kg} KG` : '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Yield %</span>
                          {isEditMode ? <input type="number" step="0.01" value={displayProduct.theoretical_yield_pct ?? ''} onChange={(e) => updateDraft({ theoretical_yield_pct: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.theoretical_yield_pct != null ? `${displayProduct.theoretical_yield_pct}%` : '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Shelf Life (months)</span>
                          {isEditMode ? <input type="number" value={displayProduct.shelf_life_months ?? ''} onChange={(e) => updateDraft({ shelf_life_months: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.shelf_life_months != null ? `${displayProduct.shelf_life_months} months` : '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">PAO (months)</span>
                          {isEditMode ? <input type="number" value={displayProduct.pao_months ?? ''} onChange={(e) => updateDraft({ pao_months: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.pao_months != null ? `${displayProduct.pao_months} months` : '—'}</div>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Manufacturing</div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="col-span-2"><span className="text-gray-500">Location</span>
                          {isEditMode ? <input value={displayProduct.manufacturing_location ?? ''} onChange={(e) => updateDraft({ manufacturing_location: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.manufacturing_location ?? '—'}</div>}
                        </div>
                        <div className="col-span-2"><span className="text-gray-500">Equipment</span>
                          {isEditMode ? <input value={displayProduct.equipment_vessel ?? ''} onChange={(e) => updateDraft({ equipment_vessel: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.equipment_vessel ?? '—'}</div>}
                        </div>
                        <div className="col-span-2"><span className="text-gray-500">Storage</span>
                          {isEditMode ? <input value={displayProduct.storage_conditions ?? ''} onChange={(e) => updateDraft({ storage_conditions: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.storage_conditions ?? '—'}</div>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Claims</div>
                      {isEditMode ? <textarea value={displayProduct.approved_claims ?? ''} onChange={(e) => updateDraft({ approved_claims: e.target.value })} rows={3} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /> : <div className="p-3 bg-gray-50 rounded-lg text-sm">{displayProduct.approved_claims ?? '—'}</div>}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Open Sales Orders</div>
                      <div className="space-y-2">
                        {(selectedProduct?.openSalesOrders ?? []).length === 0 ? (
                          <p className="text-sm text-gray-500">No open orders</p>
                        ) : (
                          (selectedProduct?.openSalesOrders ?? []).map((so) => (
                            <div key={so.order_id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                              <span className="font-mono text-xs font-bold text-indigo-600">{so.order_id}</span>
                              <span className="flex-1 text-sm text-gray-700">{so.customer_name}</span>
                              <span className="font-mono text-sm font-bold text-amber-600">{Number(so.quantity).toLocaleString()} units</span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">{so.status}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {panelTab === 1 && (selectedProduct || editDraft) && (() => {
                  const formulaList = (isEditMode ? editDraft?.formulaBom : selectedProduct?.formulaBom) ?? [];
                  return (
                    <div className="space-y-4">
                      {isEditMode && (
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <button type="button" onClick={addFormulaPhase} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700">
                            <Plus className="w-3.5 h-3.5" /> Add phase
                          </button>
                        </div>
                      )}
                      {formulaList.map((phase, phaseIdx) => (
                        <div key={phaseIdx} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {isEditMode ? (
                              <input value={phase.phase} onChange={(e) => updateFormulaPhaseName(phaseIdx, e.target.value)} className="px-2 py-1 rounded text-xs font-semibold bg-blue-50 border border-blue-200 w-40" placeholder="Phase name" />
                            ) : (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">{phase.phase}</span>
                            )}
                            <span className="text-xs text-gray-500">{phase.ingredients.length} ingredient(s)</span>
                            {isEditMode && (
                              <>
                                <button type="button" onClick={() => addFormulaIngredient(phaseIdx)} className="text-xs text-blue-600 hover:underline">+ Ingredient</button>
                                <button type="button" onClick={() => removeFormulaPhase(phaseIdx)} className="text-red-600 hover:text-red-700 p-0.5" title="Remove phase"><Trash2 className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead><tr className="bg-gray-50"><th className="text-left p-2 w-8">#</th><th className="text-left p-2 w-24">Type</th><th className="text-left p-2">INCI / Group</th><th className="text-left p-2">RM / Group Code</th><th className="text-right p-2 w-16">% w/w</th><th className="text-left p-2">UOM</th>{isEditMode && <th className="w-8" />}</tr></thead>
                              <tbody>
                                {phase.ingredients.map((ing, i) => {
                                  const isGroupLine =
                                    ing.item_group_id != null && Number(ing.item_group_id) > 0;
                                  return (
                                  <tr key={i} className="border-t border-gray-100">
                                    <td className="p-2 text-gray-400 font-mono">{i + 1}</td>
                                    {isEditMode ? (
                                      <>
                                        <td className="p-2">
                                          <select
                                            value={isGroupLine ? 'item_group' : 'rm'}
                                            onChange={(e) =>
                                              setFormulaIngredientKind(
                                                phaseIdx,
                                                i,
                                                e.target.value === 'item_group' ? 'item_group' : 'rm'
                                              )
                                            }
                                            className="w-full px-1 py-1 border rounded text-xs bg-white"
                                          >
                                            <option value="rm">RM</option>
                                            <option value="item_group">Item group</option>
                                          </select>
                                        </td>
                                        {isGroupLine ? (
                                          <>
                                            <td className="p-2" colSpan={2}>
                                              <select
                                                value={
                                                  ing.item_group_id != null ? String(ing.item_group_id) : ''
                                                }
                                                onChange={(e) =>
                                                  setFormulaIngredientItemGroup(phaseIdx, i, e.target.value)
                                                }
                                                className="w-full px-2 py-1 border rounded text-xs bg-white"
                                              >
                                                <option value="">— Select item group —</option>
                                                {itemGroupsRm.map((g) => (
                                                  <option key={g.id} value={g.id}>
                                                    {g.name} ({g.code}) · {(g.approvedMembers ?? []).length} member(s)
                                                  </option>
                                                ))}
                                              </select>
                                            </td>
                                          </>
                                        ) : (
                                          <>
                                            <td className="p-2"><input value={ing.inci_name} onChange={(e) => updateFormulaIngredient(phaseIdx, i, 'inci_name', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" /></td>
                                            <td className="p-2"><input value={ing.rm_code} onChange={(e) => updateFormulaIngredient(phaseIdx, i, 'rm_code', e.target.value)} className="w-full px-2 py-1 border rounded font-mono text-xs" /></td>
                                          </>
                                        )}
                                        <td className="p-2"><input type="number" step="0.01" value={ing.pct_w_w} onChange={(e) => updateFormulaIngredient(phaseIdx, i, 'pct_w_w', Number(e.target.value) || 0)} className="w-16 px-2 py-1 border rounded text-right text-xs" /></td>
                                        <td className="p-2"><input value={ing.uom} onChange={(e) => updateFormulaIngredient(phaseIdx, i, 'uom', e.target.value)} className="w-14 px-2 py-1 border rounded text-xs" /></td>
                                        <td className="p-2"><button type="button" onClick={() => removeFormulaIngredient(phaseIdx, i)} className="text-red-600 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button></td>
                                      </>
                                    ) : (
                                      <>
                                        <td className="p-2">
                                          {isGroupLine ? (
                                            <span className="text-[10px] font-semibold uppercase text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">Group</span>
                                          ) : (
                                            <span className="text-[10px] font-semibold uppercase text-gray-500">RM</span>
                                          )}
                                        </td>
                                        <td className="p-2 font-medium">
                                          {ing.inci_name}
                                          {isGroupLine && ing.item_group_name ? (
                                            <span className="block text-[10px] text-violet-600 font-normal">
                                              Swap among group members at Planning BOM confirm
                                            </span>
                                          ) : null}
                                        </td>
                                        <td className="p-2 font-mono text-xs text-indigo-600">{ing.rm_code}</td>
                                        <td className="p-2 text-right font-mono">{ing.pct_w_w}</td>
                                        <td className="p-2 text-gray-500">{ing.uom}</td>
                                      </>
                                    )}
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      {formulaList.length === 0 && <p className="text-gray-500 text-sm">No formula BOM data. {isEditMode && 'Add a phase above.'}</p>}
                    </div>
                  );
                })()}
                {panelTab === 2 && (selectedProduct || editDraft) && (() => {
                  const skuList = (isEditMode ? editDraft?.skuBom : selectedProduct?.skuBom) ?? [];
                  const limQ = isEditMode ? editDraft?.skuBomLimitQty : selectedProduct?.skuBomLimitQty;
                  const limU = isEditMode ? editDraft?.skuBomLimitUom : selectedProduct?.skuBomLimitUom;
                  const hasNet = limQ != null && Number(limQ) > 0 && String(limU ?? '').trim();
                  return (
                    <div className="space-y-4">
                      <p className="text-xs text-gray-600">
                        Per-unit RM required for <strong>1 finished product</strong>, derived from <strong>Formula BOM</strong> via Import below. First qty column is always <strong>kg</strong>; second column is the same requirement in each RM&apos;s <strong>standard UoM</strong> from Raw Materials master (e.g. L for liquids, KG for solids). Net per unit is used as pack size on sale orders.
                      </p>
                      {hasNet ? (
                        <div className="p-3 bg-violet-50 border border-violet-100 rounded-lg space-y-1">
                          <p className="text-[10px] font-semibold text-violet-900 uppercase">Net per 1 product unit</p>
                          <p className="text-lg font-mono font-bold text-violet-900">
                            {limQ}{' '}
                            <span className="text-base font-semibold text-violet-700">{limU}</span>
                            <span className="text-sm font-normal text-violet-700 ml-2">
                              (pack {formatSkuBomLimitAsPack(limQ, limU)})
                            </span>
                          </p>
                        </div>
                      ) : isEditMode ? (
                        <div className="flex flex-wrap items-end gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                          <div>
                            <label className="block text-[10px] font-semibold text-amber-900 uppercase mb-1">Net / unit qty (manual)</label>
                            <input
                              type="number"
                              step="0.0001"
                              value={limQ ?? ''}
                              onChange={(e) =>
                                updateDraft({
                                  skuBomLimitQty: e.target.value === '' ? null : Number(e.target.value),
                                })
                              }
                              className="w-28 px-2 py-1.5 border border-amber-200 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-amber-900 uppercase mb-1">UOM</label>
                            <select
                              value={limU || 'GM'}
                              onChange={(e) => updateDraft({ skuBomLimitUom: e.target.value })}
                              className="px-2 py-1.5 border border-amber-200 rounded text-sm"
                            >
                              <option value="GM">GM</option>
                              <option value="KG">KG</option>
                              <option value="ML">ML</option>
                              <option value="L">L</option>
                            </select>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm font-mono text-violet-800">
                          Net per unit:{' '}
                          <span className="font-bold">
                            {limQ != null ? limQ : '—'} {limU || ''}
                          </span>
                          <span className="block text-xs font-normal text-gray-500 mt-1">Set net per unit (qty + UOM) for pack size on sale orders.</span>
                        </p>
                      )}
                      {canEdit && (
                        <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/80 space-y-2">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                                Import from Formula BOM
                              </p>
                              <p className="text-[11px] text-blue-900/80 mt-0.5">
                                Derives per-unit RM quantities from Formula BOM <strong>% w/w</strong> (must total 100%). Uses net per unit above. Replaces existing SKU BOM lines.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={importFormulaBomIntoSkuBom}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-blue-300 bg-white text-blue-900 hover:bg-blue-100 shrink-0"
                              title="Populate SKU BOM from Formula % w/w and net per-unit qty"
                            >
                              <ArrowUpFromLine className="w-3.5 h-3.5" />
                              Import from Formula BOM
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left p-2 w-8">#</th>
                              <th className="text-left p-2">INCI / Name</th>
                              <th className="text-left p-2">RM Code</th>
                              <th className="text-right p-2">Required / unit (kg)</th>
                              <th className="text-right p-2">Required / unit (Std UoM)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {skuList.map((row, i) => {
                              const formulaBom =
                                (isEditMode ? editDraft?.formulaBom : selectedProduct?.formulaBom) ?? [];
                              const rmMaster = resolveRmMasterForSkuLine(row, rmById, rmByCode);
                              const display = computeSkuBomQtyDisplay({
                                row,
                                formulaBom,
                                rmMaster,
                              });
                              return (
                                <tr key={i} className="border-t border-gray-100">
                                  <td className="p-2 text-gray-400 font-mono">{i + 1}</td>
                                  <td className="p-2 font-medium">{row.inci_name}</td>
                                  <td className="p-2 font-mono text-xs text-violet-700">{row.rm_code}</td>
                                  <td className="p-2 text-right font-mono font-bold text-violet-700">
                                    {formatQtyWithUnit(display.kgQty, 'kg')}
                                  </td>
                                  <td className="p-2 text-right font-mono font-bold text-indigo-700">
                                    {formatSkuBomStdQtyWithUnit(display.stdQty, display.stdUom)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {skuList.length === 0 && (
                        <p className="text-gray-500 text-sm">
                          No SKU-level RM lines. {canEdit ? 'Complete Formula BOM, then use Import from Formula BOM.' : ''}
                        </p>
                      )}
                    </div>
                  );
                })()}
                {panelTab === 3 && (selectedProduct || editDraft) && (() => {
                  const packList = (isEditMode ? editDraft?.packBom : selectedProduct?.packBom) ?? [];
                  return (
                    <div>
                      <p className="text-xs text-gray-600 mb-3">
                        Items are from the <strong>Pack Materials (PM)</strong> table. Edit a PM there to update it everywhere it is used (products, BOMs, orders).
                      </p>
                      {isEditMode && (
                        <button type="button" onClick={addPackRow} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 mb-3">
                          <Plus className="w-3.5 h-3.5" /> Add row
                        </button>
                      )}
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead><tr className="bg-gray-50"><th className="text-left p-2 w-8">#</th><th className="text-left p-2">PM Description</th><th className="text-left p-2">PM Code</th><th className="text-left p-2">Category</th><th className="text-left p-2">Sub-category</th><th className="text-left p-2">Sub-sub category</th><th className="text-left p-2">Pack Type</th><th className="text-right p-2">Qty/Unit</th><th className="text-left p-2">UOM</th>{isEditMode && <th className="w-8" />}</tr></thead>
                          <tbody>
                            {packList.map((row, i) => {
                              const subCategoryOpts = pmDetailSubCategoryOptionsForSkuCategory(row.pm_sku_category ?? '');
                              const subSubCategoryOpts = pmSubSubCategoryOptionsForDetailSubCategory(
                                row.pm_sub_category ?? '',
                                row.pm_sku_category ?? ''
                              );
                              const categoryLabel =
                                PM_SKU_CATEGORY_SELECT_OPTIONS.find((o) => o.value === row.pm_sku_category)?.label ||
                                row.pm_sku_category ||
                                '—';
                              return (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="p-2 text-gray-400 font-mono">{i + 1}</td>
                                {isEditMode ? (
                                  <>
                                    <td className="p-2"><input value={row.pm_description} onChange={(e) => updatePackRow(i, 'pm_description', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" /></td>
                                    <td className="p-2"><input value={row.pm_code} onChange={(e) => updatePackRow(i, 'pm_code', e.target.value)} className="w-full px-2 py-1 border rounded font-mono text-xs" /></td>
                                    <td className="p-2">
                                      <select
                                        value={row.pm_sku_category ?? ''}
                                        onChange={(e) => updatePackRowCategory(i, e.target.value)}
                                        className="w-full min-w-[7rem] px-2 py-1 border rounded text-xs"
                                      >
                                        <option value="">Category…</option>
                                        {PM_SKU_CATEGORY_SELECT_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="p-2">
                                      <select
                                        value={row.pm_sub_category ?? ''}
                                        disabled={!String(row.pm_sku_category ?? '').trim()}
                                        onChange={(e) => updatePackRowSubCategory(i, e.target.value)}
                                        className="w-full min-w-[7rem] px-2 py-1 border rounded text-xs disabled:bg-gray-50"
                                      >
                                        <option value="">Sub-category…</option>
                                        {subCategoryOpts.map((opt) => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                        {row.pm_sub_category &&
                                        !subCategoryOpts.some((o) => o.value === row.pm_sub_category) ? (
                                          <option value={row.pm_sub_category}>{row.pm_sub_category}</option>
                                        ) : null}
                                      </select>
                                    </td>
                                    <td className="p-2">
                                      <select
                                        value={row.pm_sub_sub_category ?? ''}
                                        disabled={
                                          !String(row.pm_sub_category ?? '').trim() ||
                                          !pmDetailSubCategoryHasSubSubCategory(row.pm_sub_category ?? '')
                                        }
                                        onChange={(e) => updatePackRow(i, 'pm_sub_sub_category', e.target.value)}
                                        className="w-full min-w-[7rem] px-2 py-1 border rounded text-xs disabled:bg-gray-50"
                                      >
                                        <option value="">Sub-sub…</option>
                                        {subSubCategoryOpts.map((opt) => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                        {row.pm_sub_sub_category &&
                                        !subSubCategoryOpts.some((o) => o.value === row.pm_sub_sub_category) ? (
                                          <option value={row.pm_sub_sub_category}>{row.pm_sub_sub_category}</option>
                                        ) : null}
                                      </select>
                                    </td>
                                    <td className="p-2"><input value={row.pack_type} onChange={(e) => updatePackRow(i, 'pack_type', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" /></td>
                                    <td className="p-2"><input type="number" step="0.01" value={row.qty_per_unit} onChange={(e) => updatePackRow(i, 'qty_per_unit', Number(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded text-right text-xs" /></td>
                                    <td className="p-2"><input value={row.uom} onChange={(e) => updatePackRow(i, 'uom', e.target.value)} className="w-14 px-2 py-1 border rounded text-xs" /></td>
                                    <td className="p-2"><button type="button" onClick={() => removePackRow(i)} className="text-red-600 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button></td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-2 font-medium">{row.pm_description}</td>
                                    <td className="p-2">
                                      <Link to={`/packaging?pm=${encodeURIComponent(row.pm_code)}`} className="font-mono text-xs text-amber-600 hover:text-amber-700 underline" title="Open in Pack Materials to edit; changes apply everywhere">{row.pm_code}</Link>
                                    </td>
                                    <td className="p-2 text-xs text-gray-700">{categoryLabel}</td>
                                    <td className="p-2 text-xs text-gray-700">{row.pm_sub_category || '—'}</td>
                                    <td className="p-2 text-xs text-gray-700">{row.pm_sub_sub_category || '—'}</td>
                                    <td className="p-2"><span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">{row.pack_type}</span></td>
                                    <td className="p-2 text-right font-mono font-bold text-indigo-600">{row.qty_per_unit}</td>
                                    <td className="p-2 text-gray-500">{toPmDisplayUnit(row.uom)}</td>
                                  </>
                                )}
                              </tr>
                            );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">{packList.length} packaging component(s)</p>
                      {packList.length === 0 && <p className="text-gray-500 text-sm mt-2">No pack BOM data. {isEditMode && 'Add a row above.'}</p>}
                    </div>
                  );
                })()}
                {panelTab === 4 && (selectedProduct || editDraft) && (() => {
                  const stepsList = (isEditMode ? editDraft?.processSteps : selectedProduct?.processSteps) ?? [];
                  return (
                    <div className="space-y-2">
                      {isEditMode && (
                        <button type="button" onClick={addProcessStep} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 mb-2">
                          <Plus className="w-3.5 h-3.5" /> Add step
                        </button>
                      )}
                      {stepsList.map((step, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg">
                          <span className="shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">{i + 1}</span>
                          {isEditMode ? (
                            <>
                              <div className="flex-1 min-w-0 space-y-1">
                                <input value={step.description} onChange={(e) => updateProcessStep(i, 'description', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Step description" />
                                <div className="flex items-center gap-2">
                                  <input type="number" min={0} value={step.duration_minutes} onChange={(e) => updateProcessStep(i, 'duration_minutes', Number(e.target.value) || 0)} className="w-20 px-2 py-1 border rounded text-sm font-mono" />
                                  <span className="text-xs text-gray-500">min</span>
                                </div>
                              </div>
                              <button type="button" onClick={() => removeProcessStep(i)} className="shrink-0 text-red-600 hover:text-red-700 p-1" title="Remove step"><Trash2 className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              <div className="flex-1 min-w-0"><p className="text-sm text-gray-800">{step.description}</p></div>
                              <span className="shrink-0 text-sm font-mono text-gray-500">{step.duration_minutes} min</span>
                            </>
                          )}
                        </div>
                      ))}
                      {stepsList.length === 0 && <p className="text-gray-500 text-sm">No process steps. {isEditMode && 'Add a step above.'}</p>}
                      {stepsList.length > 0 && <p className="text-xs text-gray-500 text-right">Total steps: {stepsList.length}</p>}
                    </div>
                  );
                })()}
                {panelTab === 5 && displayProduct && (
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">FP Specifications</div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-gray-500">pH Range</span>
                          {isEditMode ? <input value={displayProduct.ph_range ?? ''} onChange={(e) => updateDraft({ ph_range: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.ph_range ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Viscosity (cPs)</span>
                          {isEditMode ? <input value={displayProduct.viscosity_range ?? ''} onChange={(e) => updateDraft({ viscosity_range: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.viscosity_range ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">SPF / PA</span>
                          {isEditMode ? <input value={displayProduct.spf_pa_rating ?? ''} onChange={(e) => updateDraft({ spf_pa_rating: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.spf_pa_rating ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Appearance</span>
                          {isEditMode ? <input value={displayProduct.appearance ?? ''} onChange={(e) => updateDraft({ appearance: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.appearance ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Odour</span>
                          {isEditMode ? <input value={displayProduct.odour ?? ''} onChange={(e) => updateDraft({ odour: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded" /> : <div>{displayProduct.odour ?? '—'}</div>}
                        </div>
                        <div><span className="text-gray-500">Fill Weight</span>
                          {isEditMode ? <input value={displayProduct.fill_weight_spec ?? ''} onChange={(e) => updateDraft({ fill_weight_spec: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.fill_weight_spec ?? '—'}</div>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Stability</div>
                      {isEditMode ? <textarea value={displayProduct.stability_summary ?? ''} onChange={(e) => updateDraft({ stability_summary: e.target.value })} rows={3} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900" /> : <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">{displayProduct.stability_summary ?? '—'}</div>}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex gap-2">
                {isEditMode ? (
                  <>
                    <button onClick={cancelEdit} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
                  </>
                ) : (
                  <>
                    <button onClick={handleClosePanel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                    {canEdit && selectedProduct && (
                      <button
                        onClick={() => { setBomEditPopupId(String(selectedProduct.product_id)); }}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                      >
                        Edit
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">Failed to load detail</div>
          )}
        </div>
      )}
      {bomEditPopupId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setBomEditPopupId(null)}
        >
          <div
            className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <BOMForm
              productId={bomEditPopupId}
              onClose={() => setBomEditPopupId(null)}
              onSaved={async () => {
                await loadProducts();
                const pid = bomEditPopupId ?? selectedProduct?.product_id;
                if (pid != null) {
                  await refreshOpenProductDetail(pid);
                }
                await reloadRawMaterialsMaster();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BOMDashboard;
