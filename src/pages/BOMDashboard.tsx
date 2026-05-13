import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Trash2, Plus, ArrowDownToLine, CloudDownload, Upload, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '../hooks/usePermissions';
import { fetchPRProducts, fetchPRProductDetail, updatePRProduct, deletePRProduct, fetchZohoCompositeSkuBomSuggestion, uploadSkuBomExcel, clearSkuBomForReimport, clearAllPrBomFullReset, ALL_PR_BOM_RESET_CONFIRM, postFormulaRmBomChunk, postFormulaPackBomChunk, type PRProductListItem, type PRProductDetail, type FormulaBomPhase, type SkuBomRow, type PackBomRow, type ProcessStep, type FormulaRmBomGroupResult, type FormulaPackBomGroupResult } from '../services/productsMaster.service';
import { parseFormulaBomWorkbook, groupRowsByCompositeSku, chunkCompositeGroups } from '../lib/formulaBomExcelParse';
import BOMForm from './BOMForm';
import {
  validateSkuBomTotals,
  parseFillSizeToSkuNet,
  getEffectiveSkuBomLimitFields,
  skuBomLinesToFormulaRows,
  parseBulkSpecificGravity,
} from '../lib/skuBomMath';
import { toPmDisplayUnit } from '../lib/pmDisplayUnit';

const STATUS_OPTIONS = ['Draft', 'R&D Review', 'Approved', 'Production Released', 'Discontinued'];

/** Composite SKU groups per chunk POST (RM then Packaging). */
const FORMULA_BOM_CHUNK_GROUPS = 5;

const BOMDashboard: React.FC = () => {
  const { hasModuleAccess } = usePermissions();
  const canEdit = hasModuleAccess('catalogue-management') || hasModuleAccess('packaging-management');

  const [list, setList] = useState<PRProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [selectedProduct, setSelectedProduct] = useState<PRProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<PRProductDetail> | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [bomEditPopupId, setBomEditPopupId] = useState<string | null>(null);
  const [zohoSkuFetchId, setZohoSkuFetchId] = useState('');
  const [zohoSkuFetchLoading, setZohoSkuFetchLoading] = useState(false);
  const [skuExcelUploading, setSkuExcelUploading] = useState(false);
  const [skuBomClearing, setSkuBomClearing] = useState(false);
  const skuExcelFileInputRef = useRef<HTMLInputElement | null>(null);
  const [formulaRmExcelUploading, setFormulaRmExcelUploading] = useState(false);
  /** Full BOM reset for the product currently open in the side panel (toolbar). */
  const [prToolbarFullResetting, setPrToolbarFullResetting] = useState(false);
  /** 0–100 while chunked Formula BOM import runs */
  const [formulaBomUploadPercent, setFormulaBomUploadPercent] = useState<number | null>(null);
  const formulaRmFileInputRef = useRef<HTMLInputElement | null>(null);

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
    const res = await fetchPRProductDetail(product.product_id);
    setDetailLoading(false);
    if (res.success && res.data) {
      setSelectedProduct(res.data);
    }
  }, []);

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
        ingredients: [...fb[phaseIdx].ingredients, { inci_name: '', rm_code: '', pct_w_w: 0, uom: 'kg' }],
      };
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

  const importSkuBomIntoFormulaBom = () => {
    if (!editDraft) return;
    const fillSize = String(editDraft.fill_size ?? '');
    const limQ = editDraft.skuBomLimitQty != null ? String(editDraft.skuBomLimitQty) : '';
    const limU = String(editDraft.skuBomLimitUom ?? 'GM');
    const { limitQty, limitUom } = getEffectiveSkuBomLimitFields({
      fillSize,
      skuBomLimitQty: limQ,
      skuBomLimitUom: limU,
    });
    const lines = (editDraft.skuBom ?? []).map((r) => ({
      inciName: r.inci_name,
      rmCode: r.rm_code,
      rawMaterialId: r.raw_material_id != null ? String(r.raw_material_id) : undefined,
      qtyPerUnit: r.qty_per_unit,
      uom: r.uom,
    }));
    const res = skuBomLinesToFormulaRows({
      lines,
      limitQty,
      limitUom,
      defaultPhase: 'Imported from SKU',
      specificGravity: parseBulkSpecificGravity(editDraft.specific_gravity),
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const phases = editDraft.formulaBom ?? [];
    if (phases.some((p) => (p.ingredients?.length ?? 0) > 0)) {
      const ok = window.confirm(
        'Replace all Formula BOM phases with one phase containing % w/w from the SKU BOM? Existing phases and lines will be removed from this draft.'
      );
      if (!ok) return;
    }
    const phaseLabel = 'Imported from SKU';
    updateDraft({
      formulaBom: [
        {
          phase: phaseLabel,
          ingredients: res.rows.map((r) => ({
            inci_name: r.inciName,
            rm_code: r.rmCode,
            pct_w_w: parseFloat(r.percentWW),
            uom: r.uom,
            raw_material_id: r.rawMaterialId && !Number.isNaN(Number(r.rawMaterialId)) ? Number(r.rawMaterialId) : null,
          })),
        },
      ],
    });
    toast.success(`Imported ${res.rows.length} ingredient line(s) from SKU BOM (% total 100%).`);
  };

  useEffect(() => {
    const z = selectedProduct?.zoho_item_id;
    if (z != null && String(z).trim() !== '') setZohoSkuFetchId(String(z));
    else setZohoSkuFetchId('');
  }, [selectedProduct?.product_id, selectedProduct?.zoho_item_id]);

  const loadZohoCompositeIntoSkuBomPanel = async (syncFormula: boolean) => {
    if (!editDraft) return;
    let applyFormula = syncFormula;
    if (applyFormula && (editDraft.formulaBom ?? []).some((p) => (p.ingredients?.length ?? 0) > 0)) {
      if (
        !window.confirm(
          'Replace Formula BOM with % w/w derived from imported SKU lines? Existing formula phases will be removed.'
        )
      ) {
        applyFormula = false;
      }
    }
    const id = zohoSkuFetchId.trim() || (editDraft.zoho_item_id != null ? String(editDraft.zoho_item_id) : '');
    if (!id) {
      toast.error('Enter the Zoho composite item id or set Zoho Item ID on the product.');
      return;
    }
    if ((editDraft.skuBom ?? []).length > 0 && !window.confirm('Replace SKU BOM lines with Zoho mapped items?')) return;

    setZohoSkuFetchLoading(true);
    try {
      const res = await fetchZohoCompositeSkuBomSuggestion(id);
      if (!res.success || !res.data) {
        toast.error(typeof res.error === 'string' ? res.error : 'Failed to load Zoho composite');
        return;
      }
      const data = res.data;
      const skuBom = data.sku_bom.map((r, i) => ({
        row_number: i + 1,
        inci_name: r.inci_name,
        rm_code: r.rm_code,
        raw_material_id: r.raw_material_id,
        qty_per_unit: r.qty_per_unit,
        uom: r.uom,
      }));
      let skuBomLimitQty = editDraft.skuBomLimitQty ?? null;
      let skuBomLimitUom = editDraft.skuBomLimitUom ?? null;
      const fillNet = parseFillSizeToSkuNet(String(editDraft.fill_size ?? ''));
      if (!fillNet && data.sku_bom_limit_qty != null && data.sku_bom_limit_uom) {
        skuBomLimitQty = data.sku_bom_limit_qty;
        skuBomLimitUom = data.sku_bom_limit_uom;
      }
      const updates: Partial<PRProductDetail> = { skuBom, skuBomLimitQty, skuBomLimitUom };
      if (applyFormula) {
        const { limitQty, limitUom } = getEffectiveSkuBomLimitFields({
          fillSize: String(editDraft.fill_size ?? ''),
          skuBomLimitQty: skuBomLimitQty != null ? String(skuBomLimitQty) : '',
          skuBomLimitUom: String(skuBomLimitUom ?? 'GM'),
        });
        const mappedLines = skuBom.map((row) => ({
          inciName: row.inci_name,
          rmCode: row.rm_code,
          rawMaterialId: row.raw_material_id != null ? String(row.raw_material_id) : undefined,
          qtyPerUnit: String(row.qty_per_unit),
          uom: row.uom,
        }));
        const pctRes = skuBomLinesToFormulaRows({
          lines: mappedLines,
          limitQty,
          limitUom,
          defaultPhase: 'Imported from SKU',
          specificGravity: parseBulkSpecificGravity(editDraft.specific_gravity),
        });
        if (pctRes.ok) {
          updates.formulaBom = [
            {
              phase: 'Imported from SKU',
              ingredients: pctRes.rows.map((r) => ({
                inci_name: r.inciName,
                rm_code: r.rm_code,
                pct_w_w: parseFloat(r.percentWW),
                uom: r.uom,
                raw_material_id:
                  r.rawMaterialId && !Number.isNaN(Number(r.rawMaterialId)) ? Number(r.rawMaterialId) : null,
              })),
            },
          ];
        } else {
          toast.error(`SKU lines loaded; formula not updated: ${pctRes.error}`);
        }
      }
      updateDraft(updates);
      let msg = `Loaded ${skuBom.length} SKU line(s) from Zoho${data.composite_name ? `: ${data.composite_name}` : ''}.`;
      if (data.warnings?.length) msg += ` ${data.warnings.join(' ')}`;
      if (data.unmatched_components?.length) msg += ` ${data.unmatched_components.length} line(s) need RM linking.`;
      if (applyFormula && updates.formulaBom) msg += ' Formula % updated.';
      toast.success(msg);
    } finally {
      setZohoSkuFetchLoading(false);
    }
  };

  const handleSkuExcelUpload = useCallback(
    async (file: File) => {
      if (!selectedProduct) return;
      if (isEditMode) {
        const ok = window.confirm(
          'Importing from Excel writes directly to the server and reloads the product. Any unsaved draft changes will be lost. Continue?'
        );
        if (!ok) return;
      }
      setSkuExcelUploading(true);
      try {
        const res = await uploadSkuBomExcel(selectedProduct.product_id, file);
        if (!res.success || !res.data) {
          const err = res.error;
          const msg =
            typeof err === 'string'
              ? err
              : err && typeof err === 'object' && 'message' in err
                ? String(err.message)
                : 'Failed to import Excel';
          toast.error(msg);
          return;
        }
        const { summary, unmatched, skipped_unknown_type, sheet_name } = res.data;
        const detail = await fetchPRProductDetail(selectedProduct.product_id);
        if (detail.success && detail.data) {
          setSelectedProduct(detail.data);
          if (isEditMode) setEditDraft({ ...detail.data });
        }
        const parts: string[] = [];
        parts.push(`Sheet "${sheet_name}"`);
        parts.push(
          `${summary.sku_rm_count} SKU RM line(s) (${summary.sku_rm_matched} matched, ${summary.sku_rm_unmatched} unmatched)`
        );
        parts.push(
          `${summary.pm_count} Pack line(s) (${summary.pm_matched} matched, ${summary.pm_unmatched} unmatched)`
        );
        if (summary.skipped_unknown_type > 0) {
          parts.push(`${summary.skipped_unknown_type} row(s) skipped (unknown Type)`);
        }
        toast.success(`SKU BOM imported — ${parts.join('; ')}.`);
        if ((unmatched?.length ?? 0) > 0) {
          const sample = unmatched
            .slice(0, 3)
            .map((u) => `"${u.component_name}" (${u.type})`)
            .join(', ');
          toast.warning(
            `${unmatched.length} component name(s) not matched in masters: ${sample}${unmatched.length > 3 ? '…' : ''}`
          );
        }
        if ((skipped_unknown_type?.length ?? 0) > 0) {
          const sample = skipped_unknown_type.slice(0, 3).map((s) => `row ${s.row_number}`).join(', ');
          toast.warning(
            `${skipped_unknown_type.length} row(s) had an unrecognised Type: ${sample}${skipped_unknown_type.length > 3 ? '…' : ''}`
          );
        }
        loadProducts();
      } finally {
        setSkuExcelUploading(false);
        if (skuExcelFileInputRef.current) skuExcelFileInputRef.current.value = '';
      }
    },
    [selectedProduct, isEditMode, loadProducts]
  );

  const handleClearSkuBomForReimport = useCallback(async () => {
    if (!selectedProduct) return;
    if (isEditMode) {
      const okDraft = window.confirm(
        'Clearing removes SKU BOM and Pack BOM on the server and reloads the product. Unsaved draft edits on other tabs will be lost. Continue?'
      );
      if (!okDraft) return;
    }
    const ok = window.confirm(
      'Clear all SKU BOM lines and Pack BOM lines for this product? Formula BOM (% phases) and process steps are kept. Use this before uploading Excel again from scratch.'
    );
    if (!ok) return;
    setSkuBomClearing(true);
    try {
      const res = await clearSkuBomForReimport(selectedProduct.product_id);
      if (!res.success || !res.data) {
        const err = res.error;
        const msg =
          typeof err === 'string'
            ? err
            : err && typeof err === 'object' && 'message' in err
              ? String(err.message)
              : 'Failed to clear';
        toast.error(msg);
        return;
      }
      toast.success(res.data.message ?? 'SKU BOM and Pack BOM cleared.');
      const detail = await fetchPRProductDetail(selectedProduct.product_id);
      if (detail.success && detail.data) {
        setSelectedProduct(detail.data);
        if (isEditMode) setEditDraft({ ...detail.data });
      }
      loadProducts();
    } finally {
      setSkuBomClearing(false);
    }
  }, [selectedProduct, isEditMode, loadProducts]);

  /** Toolbar: wipe BOM line data on every PR (next to Formula BOM Excel). Requires typed confirmation. */
  const handleToolbarClearAllPrBom = useCallback(async () => {
    if (isEditMode) {
      const okDraft = window.confirm(
        'Global reset updates the server for all products. Any unsaved edits in the side panel will be lost when data reloads. Continue?'
      );
      if (!okDraft) return;
    }
    const ok = window.confirm(
      'This permanently deletes ALL PR master data from the database:\n' +
        '• Every catalogue product that is linked from a BOM row\n' +
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

        if (parsed.warnings.length > 0) {
          for (const w of parsed.warnings) {
            toast.info(w);
          }
        }

        const rmRows = parsed.rm?.rows ?? [];
        const packRows = parsed.pack?.rows ?? [];
        if (rmRows.length === 0 && packRows.length === 0) {
          toast.error('No data rows found on the Formula RM or Packaging BOM sheets.');
          return;
        }

        const rmChunks = chunkCompositeGroups(groupRowsByCompositeSku(rmRows), FORMULA_BOM_CHUNK_GROUPS);
        const packChunks = chunkCompositeGroups(groupRowsByCompositeSku(packRows), FORMULA_BOM_CHUNK_GROUPS);
        const totalSteps = rmChunks.length + packChunks.length;

        let stepDone = 0;
        const setProgressFromStep = () => {
          stepDone += 1;
          if (totalSteps > 0) {
            setFormulaBomUploadPercent(Math.min(100, Math.round((stepDone / totalSteps) * 100)));
          }
        };

        const allRmResults: FormulaRmBomGroupResult[] = [];
        const allPackResults: FormulaPackBomGroupResult[] = [];

        for (let i = 0; i < rmChunks.length; i += 1) {
          const res = await postFormulaRmBomChunk({
            chunk_index: i,
            chunk_total: rmChunks.length,
            apply_sg: true,
            groups: rmChunks[i],
          });
          if (!res.success || !res.data) {
            toast.error(
              typeof res.error === 'object' && res.error && 'message' in res.error
                ? String(res.error.message)
                : 'RM chunk import failed'
            );
            return;
          }
          allRmResults.push(...res.data.results);
          setProgressFromStep();
        }

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
                : 'Packaging BOM chunk import failed'
            );
            return;
          }
          allPackResults.push(...res.data.results);
          setProgressFromStep();
        }

        if (totalSteps === 0) {
          setFormulaBomUploadPercent(100);
        }

        const rmOk = allRmResults.filter((r) => r.success).length;
        const rmFail = allRmResults.filter((r) => !r.success).length;
        const packOk = allPackResults.filter((r) => r.success).length;
        const packFail = allPackResults.filter((r) => !r.success).length;
        const rmNewPr = allRmResults.filter((r) => r.success && r.product_created).length;
        const packNewPr = allPackResults.filter((r) => r.success && r.product_created).length;

        const parts: string[] = [];
        if (rmRows.length > 0) {
          const newBit = rmNewPr > 0 ? `, ${rmNewPr} new PR` : '';
          parts.push(
            `RM (${parsed.rm?.sheetName ?? 'sheet'}): ${rmOk} ok${newBit}, ${rmFail} failed`
          );
        }
        if (packRows.length > 0) {
          const newBit = packNewPr > 0 ? `, ${packNewPr} new PR` : '';
          parts.push(
            `Packaging (${parsed.pack?.sheetName ?? 'sheet'}): ${packOk} ok${newBit}, ${packFail} failed`
          );
        }
        toast.success(`Formula BOM import — ${parts.join('; ')}.`);

        const selectedZoho = String(
          (selectedProduct as unknown as { zoho_sku_code?: string })?.zoho_sku_code ?? ''
        ).trim();
        if (selectedZoho && selectedProduct) {
          const z = selectedZoho.toLowerCase();
          const hitRm = allRmResults.some(
            (r) => r.success && String(r.composite_sku ?? '').trim().toLowerCase() === z
          );
          const hitPack = allPackResults.some(
            (r) => r.success && String(r.composite_sku ?? '').trim().toLowerCase() === z
          );
          if (hitRm || hitPack) {
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
      packBom: [...(prev?.packBom ?? []), { row_number: (prev?.packBom?.length ?? 0) + 1, pm_id: null, pm_description: '', pm_code: '', pack_type: 'Primary', qty_per_unit: 1, uom: 'pc/unit' }],
    }));
  };
  const updatePackRow = (rowIdx: number, field: keyof Omit<PackBomRow, 'row_number' | 'pm_id'>, value: string | number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const packBom = (prev.packBom ?? []).map((row, i) => (i !== rowIdx ? row : { ...row, [field]: value }));
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

  const addSkuBomRow = () => {
    setEditDraft((prev) => ({
      ...prev!,
      skuBom: [
        ...(prev?.skuBom ?? []),
        {
          row_number: (prev?.skuBom?.length ?? 0) + 1,
          inci_name: '',
          rm_code: '',
          raw_material_id: null,
          qty_per_unit: 0,
          uom: 'KG',
        },
      ],
    }));
  };
  const updateSkuBomRow = (rowIdx: number, field: keyof SkuBomRow, value: string | number | null) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const skuBom = (prev.skuBom ?? []).map((row, i) => (i !== rowIdx ? row : { ...row, [field]: value }));
      return { ...prev, skuBom };
    });
  };
  const removeSkuBomRow = (rowIdx: number) => {
    setEditDraft((prev) => {
      if (!prev) return null;
      const skuBom = (prev.skuBom ?? [])
        .filter((_, i) => i !== rowIdx)
        .map((r, i) => ({ ...r, row_number: i + 1 }));
      return { ...prev, skuBom };
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
      fill_size: editDraft.fill_size ?? selectedProduct.fill_size,
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
      }))
    );
    const sku_rm_lines = skuBom.map((r) => ({
      inci_name: r.inci_name,
      rm_code: r.rm_code,
      qty_per_unit: r.qty_per_unit,
      uom: r.uom || 'GM',
      ...(r.raw_material_id != null ? { raw_material_id: r.raw_material_id } : {}),
    }));
    const fillStrPanel =
      String(editDraft.fill_size ?? selectedProduct.fill_size ?? '').trim();
    const fromFillPanel = parseFillSizeToSkuNet(fillStrPanel);
    const sku_bom_limit_qty = fromFillPanel
      ? parseFloat(fromFillPanel.qty)
      : (editDraft.skuBomLimitQty ?? selectedProduct.skuBomLimitQty ?? null);
    const sku_bom_limit_uom = fromFillPanel
      ? fromFillPanel.uom
      : (editDraft.skuBomLimitUom ?? selectedProduct.skuBomLimitUom ?? null);
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
    const pm_lines = packBom.map((r) => ({ pm_code: r.pm_code, description: r.pm_description, pack_type: r.pack_type, qty_per_unit: r.qty_per_unit, uom: r.uom }));
    const process_steps = processSteps.map((s, i) => ({ step_number: i + 1, description: s.description, duration_minutes: s.duration_minutes }));
    payload.bom = { rm_lines, sku_rm_lines, sku_bom_limit_qty, sku_bom_limit_uom, pm_lines, process_steps };
    const res = await updatePRProduct(selectedProduct.product_id, payload);
    setSaving(false);
    if (res.success && res.data) {
      setSelectedProduct(res.data);
      setEditDraft(null);
      setIsEditMode(false);
      loadProducts();
      toast.success('Product updated');
    } else {
      toast.error(res.error ?? 'Update failed');
    }
  }, [selectedProduct, editDraft, loadProducts]);

  const displayProduct = isEditMode && editDraft ? editDraft : selectedProduct;

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    // Reset to page 1 whenever filters/search/page size change.
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedStatus, pageSize]);

  const filteredList = list.filter((p) => {
    const matchSearch = !searchTerm.trim() || [
      p.product_name,
      p.product_code,
      (p as unknown as { zoho_sku_code?: string }).zoho_sku_code,
      (p as unknown as { product_sku?: string }).product_sku,
    ].some((s) => (s ?? '').toLowerCase().includes(searchTerm.toLowerCase()));
    const matchCat = selectedCategory === 'All Categories' || p.category === selectedCategory;
    const matchStatus = selectedStatus === 'All Statuses' || p.status === selectedStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const totalFiltered = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const pagedFilteredList = filteredList.slice(startIndex, startIndex + pageSize);

  const statCardData = [
    { label: 'TOTAL PRODUCTS', value: list.length, sub: 'Registered PR masters', accent: 'border-l-blue-500', num: 'text-blue-600' },
    { label: 'PRODUCTION RELEASED', value: list.filter((p) => p.status === 'Production Released').length, sub: 'Ready to manufacture', accent: 'border-l-green-500', num: 'text-green-600' },
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

        {/* ── Table Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">

          {/* toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-linear-to-r from-slate-50/50 to-transparent">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-gray-900">Products Master</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/50">{list.length}</span>
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
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
              >
                <option>All Statuses</option>
                <option>Production Released</option>
                <option>Draft</option>
                <option>R&D Review</option>
                <option>Approved</option>
                <option>Discontinued</option>
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
                    title='Reads "Formula BOM - RM per KG-LTR" (SKU RM lines + net fill) and "Packaging BOM" (pm_lines only). Import runs in chunks; large files show progress.'
                    onClick={() => formulaRmFileInputRef.current?.click()}
                    className="inline-flex items-center px-3 py-2 border border-blue-200 bg-white text-blue-800 text-xs font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap gap-1"
                  >
                    <Upload className="w-4 h-4" />
                    {formulaRmExcelUploading ? 'Importing…' : 'Formula BOM (Excel)'}
                  </button>
                  <button
                    type="button"
                    disabled={
                      formulaRmExcelUploading || prToolbarFullResetting || skuExcelUploading || skuBomClearing
                    }
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">CODE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Record</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">PRODUCT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">CATEGORY</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">FORM</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">FILL SIZE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">BATCH (KG)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">SHELF LIFE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">RM INGS.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">PACK ITEMS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">STATUS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">VER.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">OPEN SOS</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-12 text-center text-gray-500">
                        No Products found. <Link to="/bom/new" className="text-blue-600 hover:text-blue-700 font-semibold">Create one</Link> to get started.
                      </td>
                    </tr>
                  ) : (
                    pagedFilteredList.map((p) => (
                      <tr key={p.product_id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleViewItem(p)}>
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
                        <td className="px-4 py-3 text-sm text-gray-600">{p.form ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.fill_size ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.batch_size_kg ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.shelf_life_months != null ? `${p.shelf_life_months}M` : '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-indigo-600 text-center">{p.rm_ingredients_count ?? 0}</td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-amber-600 text-center">{p.pack_items_count ?? 0}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{p.mrp_price != null ? `Rs.${p.mrp_price}` : '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            p.status === 'Production Released' ? 'bg-green-100 text-green-700' : p.status === 'Draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {p.status || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.version ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {(p.open_sos_count ?? 0) > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-indigo-100 text-indigo-700 border border-indigo-200">{p.open_sos_count}</span>
                          ) : (
                            '—'
                          )}
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
                        <div><span className="text-gray-500">Fill Size</span>
                          {isEditMode ? <input value={displayProduct.fill_size ?? ''} onChange={(e) => updateDraft({ fill_size: e.target.value })} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded font-mono" /> : <div className="font-mono">{displayProduct.fill_size ?? '—'}</div>}
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
                          <button
                            type="button"
                            onClick={importSkuBomIntoFormulaBom}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium border border-violet-300 bg-violet-50 text-violet-900 rounded hover:bg-violet-100"
                            title="Derive % w/w from SKU BOM per-unit quantities (SKU tab must sum to net)."
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" /> Import from SKU BOM
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
                              <thead><tr className="bg-gray-50"><th className="text-left p-2 w-8">#</th><th className="text-left p-2">INCI Name</th><th className="text-left p-2">RM Code</th><th className="text-right p-2 w-16">% w/w</th><th className="text-left p-2">UOM</th>{isEditMode && <th className="w-8" />}</tr></thead>
                              <tbody>
                                {phase.ingredients.map((ing, i) => (
                                  <tr key={i} className="border-t border-gray-100">
                                    <td className="p-2 text-gray-400 font-mono">{i + 1}</td>
                                    {isEditMode ? (
                                      <>
                                        <td className="p-2"><input value={ing.inci_name} onChange={(e) => updateFormulaIngredient(phaseIdx, i, 'inci_name', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" /></td>
                                        <td className="p-2"><input value={ing.rm_code} onChange={(e) => updateFormulaIngredient(phaseIdx, i, 'rm_code', e.target.value)} className="w-full px-2 py-1 border rounded font-mono text-xs" /></td>
                                        <td className="p-2"><input type="number" step="0.01" value={ing.pct_w_w} onChange={(e) => updateFormulaIngredient(phaseIdx, i, 'pct_w_w', Number(e.target.value) || 0)} className="w-16 px-2 py-1 border rounded text-right text-xs" /></td>
                                        <td className="p-2"><input value={ing.uom} onChange={(e) => updateFormulaIngredient(phaseIdx, i, 'uom', e.target.value)} className="w-14 px-2 py-1 border rounded text-xs" /></td>
                                        <td className="p-2"><button type="button" onClick={() => removeFormulaIngredient(phaseIdx, i)} className="text-red-600 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button></td>
                                      </>
                                    ) : (
                                      <><td className="p-2 font-medium">{ing.inci_name}</td><td className="p-2 font-mono text-xs text-indigo-600">{ing.rm_code}</td><td className="p-2 text-right font-mono">{ing.pct_w_w}</td><td className="p-2 text-gray-500">{ing.uom}</td></>
                                    )}
                                  </tr>
                                ))}
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
                  const fillForNet = String(
                    (isEditMode ? editDraft?.fill_size : selectedProduct?.fill_size) ?? ''
                  ).trim();
                  const fillNetPanel = parseFillSizeToSkuNet(fillForNet);
                  const limQ = fillNetPanel
                    ? parseFloat(fillNetPanel.qty)
                    : isEditMode
                      ? editDraft?.skuBomLimitQty
                      : selectedProduct?.skuBomLimitQty;
                  const limU = fillNetPanel
                    ? fillNetPanel.uom
                    : isEditMode
                      ? editDraft?.skuBomLimitUom
                      : selectedProduct?.skuBomLimitUom;
                  return (
                    <div className="space-y-4">
                      <p className="text-xs text-gray-600">
                        Raw materials by <strong>quantity per 1 unit</strong>. Net per unit comes from product <strong>Fill Size</strong> when set (<span className="font-mono">50g</span> / <span className="font-mono">50ml</span>); otherwise use manual limit on this tab. Line UOMs must match mass vs volume. <strong>Sum must equal the limit exactly</strong> (±0.001).
                      </p>
                      {canEdit && (
                        <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/80 space-y-2">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">
                                Bulk import from Excel
                              </p>
                              <p className="text-[11px] text-emerald-900/80 mt-0.5">
                                Upload a <span className="font-mono">.xlsx</span> sheet with columns:{' '}
                                <span className="font-mono">Component Name</span>,{' '}
                                <span className="font-mono">Type</span> (<em>Raw Material</em> or{' '}
                                <em>Packaging</em>),{' '}
                                <span className="font-mono">Qty per SKU (kg/nos)</span>,{' '}
                                <span className="font-mono">UOM</span>. Raw-material rows populate the SKU BOM below; packaging rows go to the Pack BOM tab. Existing lines are replaced.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                              <input
                                ref={skuExcelFileInputRef}
                                type="file"
                                accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) void handleSkuExcelUpload(f);
                                }}
                              />
                              <button
                                type="button"
                                disabled={skuExcelUploading || skuBomClearing}
                                onClick={() => void handleClearSkuBomForReimport()}
                                title="Removes SKU BOM and Pack BOM lines on the server so you can upload Excel again. Keeps formula % and process steps."
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-amber-300 bg-white text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                {skuBomClearing ? 'Clearing…' : 'Clear import'}
                              </button>
                              <button
                                type="button"
                                disabled={skuExcelUploading || skuBomClearing}
                                onClick={() => skuExcelFileInputRef.current?.click()}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                {skuExcelUploading ? 'Uploading…' : 'Upload Excel'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {fillNetPanel ? (
                        <div className="p-3 bg-violet-50 border border-violet-100 rounded-lg space-y-1">
                          <p className="text-[10px] font-semibold text-violet-900 uppercase">Net per 1 product unit (from Fill Size)</p>
                          <p className="text-lg font-mono font-bold text-violet-900">
                            {fillNetPanel.qty} <span className="text-base font-semibold text-violet-700">{fillNetPanel.uom}</span>
                          </p>
                          <p className="text-xs text-gray-600">
                            Fill Size: <span className="font-mono">{fillForNet || '—'}</span> — edit on Overview tab (<span className="font-mono">fill_size</span> on product).
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
                          <span className="block text-xs font-normal text-gray-500 mt-1">Set product Fill Size (e.g. 50g) to auto-fill.</span>
                        </p>
                      )}
                      {isEditMode && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50">
                            <div className="flex-1 min-w-[180px]">
                              <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">
                                Zoho composite ID
                              </label>
                              <input
                                type="text"
                                value={zohoSkuFetchId}
                                onChange={(e) => setZohoSkuFetchId(e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-mono"
                                placeholder="e.g. 1252231000017972949"
                                autoComplete="off"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={zohoSkuFetchLoading}
                              onClick={() => void loadZohoCompositeIntoSkuBomPanel(false)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium border border-slate-300 bg-white rounded hover:bg-slate-100 disabled:opacity-50"
                            >
                              <CloudDownload className="w-3.5 h-3.5" />
                              {zohoSkuFetchLoading ? '…' : 'Load from Zoho'}
                            </button>
                            <button
                              type="button"
                              disabled={zohoSkuFetchLoading}
                              onClick={() => void loadZohoCompositeIntoSkuBomPanel(true)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium border border-violet-300 bg-violet-50 text-violet-900 rounded hover:bg-violet-100 disabled:opacity-50"
                            >
                              <CloudDownload className="w-3.5 h-3.5" />
                              {zohoSkuFetchLoading ? '…' : 'Load SKU + Formula'}
                            </button>
                          </div>
                          <button type="button" onClick={addSkuBomRow} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-violet-600 text-white rounded hover:bg-violet-700">
                            <Plus className="w-3.5 h-3.5" /> Add RM line
                          </button>
                        </div>
                      )}
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left p-2 w-8">#</th>
                              <th className="text-left p-2">INCI / Name</th>
                              <th className="text-left p-2">RM Code</th>
                              <th className="text-right p-2">Qty / unit</th>
                              <th className="text-left p-2">UOM</th>
                              {isEditMode && <th className="text-left p-2 w-24">RM id</th>}
                              {isEditMode && <th className="w-8" />}
                            </tr>
                          </thead>
                          <tbody>
                            {skuList.map((row, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="p-2 text-gray-400 font-mono">{i + 1}</td>
                                {isEditMode ? (
                                  <>
                                    <td className="p-2">
                                      <input value={row.inci_name} onChange={(e) => updateSkuBomRow(i, 'inci_name', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" />
                                    </td>
                                    <td className="p-2">
                                      <input value={row.rm_code} onChange={(e) => updateSkuBomRow(i, 'rm_code', e.target.value)} className="w-full px-2 py-1 border rounded font-mono text-xs" />
                                    </td>
                                    <td className="p-2">
                                      <input type="number" step="0.0001" value={row.qty_per_unit} onChange={(e) => updateSkuBomRow(i, 'qty_per_unit', Number(e.target.value) || 0)} className="w-24 px-2 py-1 border rounded text-right text-xs" />
                                    </td>
                                    <td className="p-2">
                                      <input value={row.uom} onChange={(e) => updateSkuBomRow(i, 'uom', e.target.value)} className="w-16 px-2 py-1 border rounded text-xs" />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        value={row.raw_material_id ?? ''}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          updateSkuBomRow(i, 'raw_material_id', v === '' ? null : Number(v) || null);
                                        }}
                                        className="w-full px-2 py-1 border rounded text-xs font-mono"
                                        placeholder="optional"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <button type="button" onClick={() => removeSkuBomRow(i)} className="text-red-600 hover:text-red-700">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-2 font-medium">{row.inci_name}</td>
                                    <td className="p-2 font-mono text-xs text-violet-700">{row.rm_code}</td>
                                    <td className="p-2 text-right font-mono font-bold text-violet-700">{row.qty_per_unit}</td>
                                    <td className="p-2 text-gray-500">{row.uom}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {skuList.length === 0 && <p className="text-gray-500 text-sm">No SKU-level RM lines. {isEditMode && 'Add a row above.'}</p>}
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
                          <thead><tr className="bg-gray-50"><th className="text-left p-2 w-8">#</th><th className="text-left p-2">PM Description</th><th className="text-left p-2">PM Code</th><th className="text-left p-2">Pack Type</th><th className="text-right p-2">Qty/Unit</th><th className="text-left p-2">UOM</th>{isEditMode && <th className="w-8" />}</tr></thead>
                          <tbody>
                            {packList.map((row, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="p-2 text-gray-400 font-mono">{i + 1}</td>
                                {isEditMode ? (
                                  <>
                                    <td className="p-2"><input value={row.pm_description} onChange={(e) => updatePackRow(i, 'pm_description', e.target.value)} className="w-full px-2 py-1 border rounded text-xs" /></td>
                                    <td className="p-2"><input value={row.pm_code} onChange={(e) => updatePackRow(i, 'pm_code', e.target.value)} className="w-full px-2 py-1 border rounded font-mono text-xs" /></td>
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
                                    <td className="p-2"><span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">{row.pack_type}</span></td>
                                    <td className="p-2 text-right font-mono font-bold text-indigo-600">{row.qty_per_unit}</td>
                                    <td className="p-2 text-gray-500">{toPmDisplayUnit(row.uom)}</td>
                                  </>
                                )}
                              </tr>
                            ))}
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
              onSaved={() => loadProducts()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BOMDashboard;
