import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Plus, Trash2, Pencil, Check, ArrowDownToLine, ArrowUpFromLine, CloudDownload, Upload, RotateCcw } from 'lucide-react';
import MasterFormBase from '../components/MasterFormBase';
import { MasterSubmitPreviewModal } from '../components/masters/MasterSubmitPreviewModal';
import { PR_PREVIEW_SECTIONS } from '../constants/masterSubmitPreviewFields';
import { buildMasterPreviewSections } from '../utils/masterSubmitPreview';
import RmMasterTypeahead from '../components/RmMasterTypeahead';
import PmMasterTypeahead from '../components/PmMasterTypeahead';
import { buildRmTypeaheadOptions, rmTypeaheadLabelForId } from '../lib/rmTypeahead';
import { buildPmTypeaheadOptions, pmTypeaheadLabelForId } from '../lib/pmTypeahead';
import { fetchRawMaterialsList, type RawMaterialRecord } from '../services/rawMaterials.service';
import { fetchPackMaterialsList, type PackMaterialRecord } from '../services/packMaterials.service';
import {
  createPRRegistration,
  fetchPRProductDetail,
  updatePRProduct,
  fetchZohoCompositeSkuBomSuggestion,
  uploadSkuBomExcel,
  clearSkuBomForReimport,
  type PRProductDetail,
  type PrRecordTypeForm,
} from '../services/productsMaster.service';
import {
  validateSkuBomTotals,
  countMeaningfulFormulaRmLines,
  countMeaningfulPackLines,
  countMeaningfulSkuRmLines,
  parseFillSizeToSkuNet,
  getEffectiveSkuBomLimitFields,
  getEffectiveSkuBomLimitForPersist,
  skuBomLinesToFormulaRows,
  formulaRowsToSkuBomLines,
  parseBulkSpecificGravity,
} from '../lib/skuBomMath';
import {
  PR_CATEGORY_OPTIONS,
  PR_SUB_CATEGORY_OPTIONS,
  inferPrCategoryFromLegacyCode,
  normalizePrCategoryForSelect,
  normalizePrSubCategoryForSelect,
} from '../constants/prMasterCategoryOptions';
import {
  PR_PRODUCT_FORM_OPTIONS,
  isCanonicalPrProductForm,
  normalizePrProductFormForSelect,
} from '../constants/prProductFormOptions';

/** Legacy alphanumeric PR codes only — used to infer composite when editing old rows. */
const COMPOSITE_ITEM_PREFIX_BASE = 'EI-CI';

const PR_QC_GROUPS = ['Chemical QC', 'Microbiology', 'Physical QC', 'Packaging QC', 'Incoming QA'];
const PR_STORAGE_TYPES = ['Ambient – Dry', 'Ambient – Cool', 'Refrigerated (2–8°C)', 'Frozen', 'Flammable Store'];

interface BOMFormState {
  // Identity & coding (step 0)
  prQcGroup: string;
  prSubCategory: string;
  prDefaultStorageType: string;
  // Overview Tab
  productName: string;
  category: string;
  productForm: string;
  brandClient: string;
  fillSize: string;
  packConfiguration: string;
  skuCode: string;
  /** Permanent vs temporary internal-code series; `legacy` only when editing old DB rows. */
  prRecordType: PrRecordTypeForm;
  mrp: string;
  zohoId: string;
  skuForZoho: string;
  bomTaxPreference: string;
  bomReturnable: boolean;
  bomAssociateItems: string;
  /** Required at Step 1: must be explicitly set to 'Yes' or 'No' (Zoho / reporting). */
  bomCompositeItem: '' | 'Yes' | 'No';

  // Formula BOM Tab
  formulaIngredients: Array<{
    id: string;
    rawMaterialId?: string;
    rmCode?: string;
    inciName: string;
    phase: string;
    percentWW: string;
    uom: string;
  }>;

  /** Per 1 finished SKU unit (separate from formula % w/w). */
  skuBomLines: Array<{
    id: string;
    rawMaterialId?: string;
    rmCode?: string;
    inciName: string;
    qtyPerUnit: string;
    uom: string;
  }>;
  /** Net content per 1 unit (e.g. 50) — SKU RM lines must sum to this in skuBomLimitUom. */
  skuBomLimitQty: string;
  skuBomLimitUom: string;

  // Pack BOM Tab
  packingComponents: Array<{
    id: string;
    packMaterialId?: string;
    pmCode?: string;
    pmDescription: string;
    type: string;
    qtyUnit: string;
    uom: string;
  }>;

  // Process Steps Tab
  processSteps: Array<{
    id: string;
    stepNumber: string;
    instruction: string;
    duration: string;
  }>;

  // Specs & Regulatory Tab
  phRange: string;
  viscosity: string;
  specificGravity: string;
  appearance: string;
  odour: string;
  fillWeightSpec: string;
  microbialLimits: string;
  sppRating: string;
  acceleratedStability: string;
  intermediateStability: string;
  longTermStability: string;
  phototability: string;
  freezeThawCycles: string;
  applicableRegulation: string;
  cosmosNaturalCertification: string;
  dermatologicallyTested: string;
  crueltyFreeVegan: string;
  approvedMarketingClaims: string;
  claimsSubstantiation: string;
}

function emptyBomForm(): BOMFormState {
  return {
    prQcGroup: '',
    prSubCategory: '',
    prDefaultStorageType: '',
    productName: '',
    category: '',
    productForm: '',
    brandClient: '',
    fillSize: '',
    packConfiguration: '',
    skuCode: '',
    prRecordType: 'permanent',
    mrp: '',
    zohoId: '',
    skuForZoho: '',
    bomTaxPreference: 'Taxable',
    bomReturnable: false,
    bomAssociateItems: '',
    bomCompositeItem: 'Yes',
    formulaIngredients: [],
    skuBomLines: [],
    skuBomLimitQty: '',
    skuBomLimitUom: 'GM',
    packingComponents: [],
    processSteps: [],
    phRange: '',
    viscosity: '',
    specificGravity: '',
    appearance: '',
    odour: '',
    fillWeightSpec: '',
    microbialLimits: '',
    sppRating: '',
    acceleratedStability: '',
    intermediateStability: '',
    longTermStability: '',
    phototability: '',
    freezeThawCycles: '',
    applicableRegulation: '',
    cosmosNaturalCertification: '',
    dermatologicallyTested: '',
    crueltyFreeVegan: '',
    approvedMarketingClaims: '',
    claimsSubstantiation: '',
  };
}

interface BOMFormProps {
  /** When provided, used instead of route param `:id` (enables modal editing). */
  productId?: string;
  onClose?: () => void;
  onSaved?: () => void;
}

/** PR masters are composite items; default Yes when DB flag is unset. */
function inferPrCompositeFromCode(_code: string): 'Yes' {
  return 'Yes';
}

function bomFormToRmLines(fd: BOMFormState) {
  return fd.formulaIngredients.map((ing) => ({
    phase: ing.phase,
    inci_name: ing.inciName,
    rm_code: ing.rmCode || '',
    raw_material_id: ing.rawMaterialId ? parseInt(ing.rawMaterialId, 10) : undefined,
    pct_w_w: parseFloat(ing.percentWW) || 0,
    uom: ing.uom,
  }));
}

function bomFormToSkuRmLines(fd: BOMFormState) {
  return fd.skuBomLines.map((row) => ({
    inci_name: row.inciName,
    rm_code: row.rmCode || '',
    raw_material_id: row.rawMaterialId ? parseInt(row.rawMaterialId, 10) : undefined,
    qty_per_unit: parseFloat(String(row.qtyPerUnit).replace(/[^\d.-]/g, '')) || 0,
    uom: row.uom || 'GM',
  }));
}

function bomFormToPmLines(fd: BOMFormState) {
  return fd.packingComponents.map((c) => ({
    pm_code: c.pmCode || '',
    pack_material_id: c.packMaterialId ? parseInt(c.packMaterialId, 10) : undefined,
    description: c.pmDescription,
    pack_type: c.type,
    qty_per_unit: parseFloat(c.qtyUnit) || 1,
    uom: c.uom || 'PCS',
  }));
}

function bomFormToProcessSteps(fd: BOMFormState) {
  return fd.processSteps.map((s, i) => {
    const stepNum = parseInt(String(s.stepNumber).replace(/\D/g, ''), 10);
    const durNum = parseInt(String(s.duration).replace(/\D/g, ''), 10);
    return {
      step_number: Number.isNaN(stepNum) ? i + 1 : stepNum,
      description: s.instruction,
      duration_minutes: Number.isNaN(durNum) ? 0 : durNum,
    };
  });
}

function parseMrpNumber(mrp: string): number | undefined {
  if (!mrp?.trim()) return undefined;
  const n = parseFloat(mrp.replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? undefined : n;
}

/** When MRP is provided, it must parse to a positive amount. Empty is allowed. */
function isValidMrpForPr(mrp: string): boolean {
  if (!mrp?.trim()) return true;
  const n = parseMrpNumber(mrp);
  return n !== undefined && n > 0;
}

function mrpValidationMessage(mrp: string): string | null {
  if (!mrp?.trim()) return null;
  if (isValidMrpForPr(mrp)) return null;
  return 'Enter a positive amount, e.g. 499 or ₹499';
}

/**
 * Accept fill sizes only in `g` or `ml` to keep backend unit parsing unambiguous.
 * Examples: 50g, 500 g, 30ml, 100 ml
 */
function normalizeFillSizeInput(raw: string): string {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return '';
  const m = text.match(/^(\d+(?:\.\d+)?)\s*(g|ml)$/i);
  if (!m) return text;
  const value = m[1];
  const unit = m[2].toLowerCase();
  return `${value}${unit}`;
}

function isValidFillSizeInput(raw: string): boolean {
  return /^(\d+(?:\.\d+)?)\s*(g|ml)$/i.test(String(raw || '').trim());
}

function buildPrRegistrationBody(fd: BOMFormState): Record<string, unknown> {
  const stabilityParts = [fd.acceleratedStability, fd.intermediateStability, fd.longTermStability].filter(Boolean);
  const internalCode = fd.skuCode.trim();
  const zohoSku = fd.skuForZoho?.trim() || internalCode;
  return {
    product_name: fd.productName.trim(),
    name: fd.productName.trim(),
    pr_record_type: fd.prRecordType === 'temporary' ? 'temporary' : 'permanent',
    ...(internalCode ? { product_code: internalCode, bomCode: internalCode } : {}),
    category: fd.category || null,
    form: fd.productForm || null,
    type: fd.productForm || null,
    client: fd.brandClient || null,
    fill_size: fd.fillSize || null,
    packSize: fd.fillSize || null,
    zoho_sku_code: zohoSku || undefined,
    bomSku: zohoSku || undefined,
    bom_tax_preference: fd.bomTaxPreference || null,
    bom_returnable: fd.bomReturnable,
    bom_associate_items: fd.bomAssociateItems?.trim() || null,
    bom_composite_item: fd.bomCompositeItem === 'Yes',
    status: 'Draft',
    pr_qc_group: fd.prQcGroup || null,
    pr_sub_category: fd.prSubCategory || null,
    pack_configuration: fd.packConfiguration || null,
    specific_gravity: fd.specificGravity || null,
    microbial_limits: fd.microbialLimits || null,
    spf_pa_rating: fd.sppRating || null,
    photostability: fd.phototability || null,
    freeze_thaw_cycles: fd.freezeThawCycles || null,
    cosmos_natural_certification: fd.cosmosNaturalCertification || null,
    dermatologically_tested: fd.dermatologicallyTested || null,
    cruelty_free_vegan: fd.crueltyFreeVegan || null,
    storage_conditions: fd.prDefaultStorageType || null,
    mrp: fd.mrp?.trim() || null,
    ...(isValidMrpForPr(fd.mrp) ? { mrp_price: parseMrpNumber(fd.mrp) } : {}),
    rm_lines: bomFormToRmLines(fd),
    sku_rm_lines: bomFormToSkuRmLines(fd),
    ...getEffectiveSkuBomLimitForPersist({
      fillSize: fd.fillSize,
      skuBomLimitQty: fd.skuBomLimitQty,
      skuBomLimitUom: fd.skuBomLimitUom,
    }),
    pm_lines: bomFormToPmLines(fd),
    process_steps: bomFormToProcessSteps(fd),
    ph_range: fd.phRange || null,
    viscosity_range: fd.viscosity || null,
    appearance: fd.appearance || null,
    odour: fd.odour || null,
    fill_weight_spec: fd.fillWeightSpec || null,
    stability_summary: stabilityParts.length ? stabilityParts.join('; ') : fd.longTermStability || null,
    approved_claims: fd.approvedMarketingClaims || null,
    regulatory: fd.applicableRegulation || null,
    desc: fd.claimsSubstantiation || null,
  };
}

function buildPrUpdateBody(fd: BOMFormState): Record<string, unknown> {
  const stabilityParts = [fd.acceleratedStability, fd.intermediateStability, fd.longTermStability].filter(Boolean);
  const mrp = parseMrpNumber(fd.mrp);
  return {
    product_name: fd.productName.trim(),
    product_code: fd.skuCode.trim(),
    zoho_sku_code: (fd.skuForZoho?.trim() || fd.skuCode).trim(),
    ...(fd.prRecordType === 'temporary' || fd.prRecordType === 'permanent'
      ? { pr_record_type: fd.prRecordType }
      : {}),
    category: fd.category || null,
    form: fd.productForm || null,
    fill_size: fd.fillSize || null,
    storage_conditions: fd.prDefaultStorageType || null,
    pr_sub_category: fd.prSubCategory || null,
    pr_qc_group: fd.prQcGroup || null,
    brand_client: fd.brandClient || null,
    applicable_regulation: fd.applicableRegulation || null,
    claims_substantiation: fd.claimsSubstantiation || null,
    pack_configuration: fd.packConfiguration || null,
    specific_gravity: fd.specificGravity || null,
    microbial_limits: fd.microbialLimits || null,
    spf_pa_rating: fd.sppRating || null,
    photostability: fd.phototability || null,
    freeze_thaw_cycles: fd.freezeThawCycles || null,
    cosmos_natural_certification: fd.cosmosNaturalCertification || null,
    dermatologically_tested: fd.dermatologicallyTested || null,
    cruelty_free_vegan: fd.crueltyFreeVegan || null,
    approved_claims: fd.approvedMarketingClaims || null,
    ph_range: fd.phRange || null,
    viscosity_range: fd.viscosity || null,
    appearance: fd.appearance || null,
    odour: fd.odour || null,
    fill_weight_spec: fd.fillWeightSpec || null,
    stability_summary: stabilityParts.length ? stabilityParts.join('; ') : fd.longTermStability || null,
    ...(mrp !== undefined ? { mrp_price: mrp } : {}),
    bom: {
      rm_lines: bomFormToRmLines(fd),
      sku_rm_lines: bomFormToSkuRmLines(fd),
      ...getEffectiveSkuBomLimitForPersist({
        fillSize: fd.fillSize,
        skuBomLimitQty: fd.skuBomLimitQty,
        skuBomLimitUom: fd.skuBomLimitUom,
      }),
      pm_lines: bomFormToPmLines(fd),
      process_steps: bomFormToProcessSteps(fd),
      ph_range: fd.phRange || null,
      pack_configuration: fd.packConfiguration || null,
      specific_gravity: fd.specificGravity || null,
      pr_sub_category: fd.prSubCategory || null,
      pr_qc_group: fd.prQcGroup || null,
      microbial_limits: fd.microbialLimits || null,
      spf_pa_rating: fd.sppRating || null,
      photostability: fd.phototability || null,
      freeze_thaw_cycles: fd.freezeThawCycles || null,
      cosmos_natural_certification: fd.cosmosNaturalCertification || null,
      dermatologically_tested: fd.dermatologicallyTested || null,
      cruelty_free_vegan: fd.crueltyFreeVegan || null,
      stability_summary: fd.longTermStability || null,
      bom_composite_item: fd.bomCompositeItem === 'Yes',
    },
  };
}

function productDetailToBomForm(p: PRProductDetail): BOMFormState {
  const formulaIngredients: BOMFormState['formulaIngredients'] = [];
  (p.formulaBom || []).forEach((phase, pi) => {
    (phase.ingredients || []).forEach((ing, ii) => {
      formulaIngredients.push({
        id: `fi-${pi}-${ii}`,
        rawMaterialId: ing.raw_material_id != null ? String(ing.raw_material_id) : undefined,
        rmCode: ing.rm_code || '',
        inciName: ing.inci_name || '',
        phase: phase.phase || '',
        percentWW: String(ing.pct_w_w ?? ''),
        uom: ing.uom || 'GM',
      });
    });
  });
  const skuBomLines: BOMFormState['skuBomLines'] = (p.skuBom || []).map((row, i) => ({
    id: `sku-${i}`,
    rawMaterialId: row.raw_material_id != null ? String(row.raw_material_id) : undefined,
    rmCode: row.rm_code || '',
    inciName: row.inci_name || '',
    qtyPerUnit: row.qty_per_unit != null ? String(row.qty_per_unit) : '',
    uom: row.uom || 'GM',
  }));
  const fromFillSize = parseFillSizeToSkuNet(p.fill_size || '');
  const skuBomLimitQtyStr = fromFillSize
    ? fromFillSize.qty
    : p.skuBomLimitQty != null && !Number.isNaN(Number(p.skuBomLimitQty))
      ? String(p.skuBomLimitQty)
      : '';
  const skuBomLimitUomStr = fromFillSize
    ? fromFillSize.uom
    : p.skuBomLimitUom?.trim()
      ? String(p.skuBomLimitUom)
      : 'GM';
  const packingComponents: BOMFormState['packingComponents'] = (p.packBom || []).map((row, i) => ({
    id: `pc-${i}`,
    packMaterialId:
      (row as any).pack_material_id != null
        ? String((row as any).pack_material_id)
        : (row.pm_id != null ? String(row.pm_id) : undefined),
    pmCode: (row.pm_code as string) || '',
    pmDescription: row.pm_description || '',
    type: row.pack_type || '',
    qtyUnit: String(row.qty_per_unit ?? ''),
    uom: row.uom || 'PCS',
  }));
  const processSteps: BOMFormState['processSteps'] = (p.processSteps || []).map((step, i) => ({
    id: `ps-${i}`,
    stepNumber: String(step.step_number ?? ''),
    instruction: step.description || '',
    duration: String(step.duration_minutes ?? ''),
  }));
  const skuCode = p.product_code || '';
  const categoryFromDb = normalizePrCategoryForSelect(p.category || '') || p.category || '';
  const categoryFromCode = inferPrCategoryFromLegacyCode(skuCode);
  const category = categoryFromDb || categoryFromCode || '';
  const zi = p.zoho_item_id;
  const rawComposite = (p as unknown as { bom_composite_item?: unknown }).bom_composite_item;
  const compositeFromBackend: '' | 'Yes' | 'No' =
    rawComposite === true || rawComposite === 'true' || rawComposite === 1 || rawComposite === '1'
      ? 'Yes'
      : rawComposite === false || rawComposite === 'false' || rawComposite === 0 || rawComposite === '0'
        ? 'No'
        : '';
  const bomCompositeItem: '' | 'Yes' | 'No' =
    compositeFromBackend || inferPrCompositeFromCode(skuCode);
  const prSubRaw = (p as unknown as { pr_sub_category?: string | null }).pr_sub_category || '';
  return {
    ...emptyBomForm(),
    bomCompositeItem,
    productName: p.product_name || '',
    category,
    productForm:
      normalizePrProductFormForSelect(p.form || '') ||
      String(p.form || '').trim(),
    brandClient: p.brand_client || p.brand_name || '',
    fillSize: p.fill_size || '',
    prDefaultStorageType: p.storage_conditions || '',
    prQcGroup: (p as unknown as { pr_qc_group?: string | null }).pr_qc_group || '',
    skuCode,
    prRecordType:
      p.pr_record_type === 'temporary'
        ? 'temporary'
        : p.pr_record_type === 'permanent'
          ? 'permanent'
          : 'legacy',
    zohoId: zi != null && String(zi).trim() !== '' ? String(zi) : '',
    // Read the new column name first; fall back to legacy `product_sku` for any cached/older payloads.
    skuForZoho: (() => {
      const z = (p as unknown as { zoho_sku_code?: string | null }).zoho_sku_code;
      const legacy = (p as unknown as { product_sku?: string | null }).product_sku;
      const v = (z && String(z).trim()) || (legacy && String(legacy).trim()) || '';
      return v && v !== skuCode ? v : '';
    })(),
    mrp: p.mrp_price != null ? `₹${p.mrp_price}` : '',
    formulaIngredients,
    skuBomLines,
    skuBomLimitQty: skuBomLimitQtyStr,
    skuBomLimitUom: skuBomLimitUomStr,
    packingComponents,
    processSteps,
    phRange: p.ph_range || '',
    viscosity: p.viscosity_range || '',
    specificGravity: (p as unknown as { specific_gravity?: string | null }).specific_gravity || '',
    microbialLimits: (p as unknown as { microbial_limits?: string | null }).microbial_limits || '',
    sppRating: (p as unknown as { spf_pa_rating?: string | null }).spf_pa_rating || '',
    phototability: (p as unknown as { photostability?: string | null }).photostability || '',
    freezeThawCycles: (p as unknown as { freeze_thaw_cycles?: string | null }).freeze_thaw_cycles || '',
    packConfiguration: (p as unknown as { pack_configuration?: string | null }).pack_configuration || '',
    prSubCategory: normalizePrSubCategoryForSelect(prSubRaw) || prSubRaw,
    applicableRegulation: (p as unknown as { applicable_regulation?: string | null }).applicable_regulation || '',
    claimsSubstantiation: (p as unknown as { claims_substantiation?: string | null }).claims_substantiation || '',
    cosmosNaturalCertification: (p as unknown as { cosmos_natural_certification?: string | null }).cosmos_natural_certification || '',
    dermatologicallyTested: (p as unknown as { dermatologically_tested?: string | null }).dermatologically_tested || '',
    crueltyFreeVegan: (p as unknown as { cruelty_free_vegan?: string | null }).cruelty_free_vegan || '',
    appearance: p.appearance || '',
    odour: p.odour || '',
    fillWeightSpec: p.fill_weight_spec || '',
    approvedMarketingClaims: p.approved_claims || '',
    longTermStability: p.stability_summary || '',
  };
}

const BOMForm: React.FC<BOMFormProps> = ({ productId: productIdProp, onClose, onSaved }) => {
  const navigate = useNavigate();
  const { id: productIdFromParams } = useParams<{ id: string }>();
  const productIdFromRoute = productIdProp ?? productIdFromParams;
  const { addToast } = useToast();
  const [currentStage, setCurrentStage] = useState(0);
  const [formData, setFormData] = useState<BOMFormState>(emptyBomForm());
  const [editLoading, setEditLoading] = useState(!!productIdFromRoute);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const focusPrField = useCallback((target: 'category' | 'prSubCategory' | 'productName' | 'formula' | 'pack' | 'bomCompositeItem') => {
    window.setTimeout(() => {
      if (target === 'formula') {
        const el = document.querySelector('input[placeholder="Or type INCI Name (manual)"]');
        if (el instanceof HTMLElement) el.focus();
        return;
      }
      if (target === 'pack') {
        const el = document.querySelector('input[placeholder="Or type PM Description (manual)"]');
        if (el instanceof HTMLElement) el.focus();
        return;
      }
      const el = document.getElementById(target);
      if (el instanceof HTMLElement) el.focus();
    }, 0);
  }, []);
  const [tempIngredient, setTempIngredient] = useState({ inciName: '', phase: '', percentWW: '', uom: 'GM' });
  const [tempSkuLine, setTempSkuLine] = useState({ inciName: '', qtyPerUnit: '', uom: 'GM' });
  const [editingSkuLineId, setEditingSkuLineId] = useState<string | null>(null);
  const [selectedSkuRmId, setSelectedSkuRmId] = useState<string>('');
  const [skuRmQuery, setSkuRmQuery] = useState('');
  const [tempComponent, setTempComponent] = useState({ pmDescription: '', type: '', qtyUnit: '', uom: '' });
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [tempStep, setTempStep] = useState({ stepNumber: '', instruction: '', duration: '' });
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRecord[]>([]);
  const [packMaterials, setPackMaterials] = useState<PackMaterialRecord[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);
  const [selectedRmId, setSelectedRmId] = useState<string>('');
  const [selectedPmId, setSelectedPmId] = useState<string>('');
  const [ingredientRmQuery, setIngredientRmQuery] = useState('');
  const [packPmQuery, setPackPmQuery] = useState('');
  /** Zoho composite item id for pulling mapped_items into SKU BOM (defaults from saved Zoho Item ID). */
  const [zohoCompositeFetchId, setZohoCompositeFetchId] = useState('');
  const [zohoCompositeLoading, setZohoCompositeLoading] = useState(false);
  const skuExcelFileInputRef = useRef<HTMLInputElement | null>(null);
  const [skuExcelUploading, setSkuExcelUploading] = useState(false);
  const [skuBomClearing, setSkuBomClearing] = useState(false);
  const [submitPreviewOpen, setSubmitPreviewOpen] = useState(false);
  const [pendingPrSubmit, setPendingPrSubmit] = useState<
    { mode: 'create' | 'update'; body: Record<string, unknown> } | null
  >(null);
  const [submitConfirming, setSubmitConfirming] = useState(false);

  const stages = [
    'Primary info (details & Books)',
    'Formula BOM',
    'SKU BOM (per unit)',
    'Pack BOM',
    'Process Steps',
    'Specs & Regulatory',
  ];

  const isNewProduct = !productIdFromRoute;
  const canAdvancePastPrimary =
    !isNewProduct ||
    Boolean(
      formData.category.trim() &&
        formData.bomCompositeItem &&
        formData.productName.trim()
    );
  // Existing products normally keep identity/code fields locked.
  // Exception: legacy rows that have no BOM payload loaded (all edit arrays empty)
  // need a bootstrap edit pass to set missing composite/returnable/code metadata.
  const isBomBootstrapEdit =
    !!productIdFromRoute &&
    formData.formulaIngredients.length === 0 &&
    formData.skuBomLines.length === 0 &&
    formData.packingComponents.length === 0 &&
    formData.processSteps.length === 0;
  const lockPrimaryFields = !!productIdFromRoute && !isBomBootstrapEdit;

  // Load RM/PM masters once so the BOM lines can reference actual items (ids/codes/prices).
  useEffect(() => {
    let cancelled = false;
    setMasterLoading(true);
    Promise.all([fetchRawMaterialsList(), fetchPackMaterialsList()])
      .then(([rms, pms]) => {
        if (cancelled) return;
        setRawMaterials(rms || []);
        setPackMaterials(pms || []);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) addToast('error', 'Failed to load RM/PM masters');
      })
      .finally(() => {
        if (!cancelled) setMasterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const rawMaterialById = useMemo(() => {
    const m = new Map<string, RawMaterialRecord>();
    rawMaterials.forEach((r) => m.set(String(r.id), r));
    return m;
  }, [rawMaterials]);
  const packMaterialById = useMemo(() => {
    const m = new Map<string, PackMaterialRecord>();
    packMaterials.forEach((p) => m.set(String(p.id), p));
    return m;
  }, [packMaterials]);
  const selectedRmIds = useMemo(
    () => new Set(formData.formulaIngredients.map((ing) => String(ing.rawMaterialId || '')).filter(Boolean)),
    [formData.formulaIngredients]
  );
  const selectedSkuRmIds = useMemo(
    () => new Set(formData.skuBomLines.map((row) => String(row.rawMaterialId || '')).filter(Boolean)),
    [formData.skuBomLines]
  );
  const selectedPmIds = useMemo(
    () => new Set(formData.packingComponents.map((c) => String(c.packMaterialId || '')).filter(Boolean)),
    [formData.packingComponents]
  );
  const formulaRmTypeaheadOptions = useMemo(
    () =>
      buildRmTypeaheadOptions(rawMaterials, {
        excludeIds: selectedRmIds,
        allowId: selectedRmId || undefined,
      }),
    [rawMaterials, selectedRmIds, selectedRmId]
  );
  const skuRmTypeaheadOptions = useMemo(
    () =>
      buildRmTypeaheadOptions(rawMaterials, {
        excludeIds: selectedSkuRmIds,
        allowId: selectedSkuRmId || undefined,
      }),
    [rawMaterials, selectedSkuRmIds, selectedSkuRmId]
  );
  const packPmTypeaheadOptions = useMemo(
    () =>
      buildPmTypeaheadOptions(packMaterials, {
        excludeIds: selectedPmIds,
        allowId: selectedPmId || undefined,
      }),
    [packMaterials, selectedPmIds, selectedPmId]
  );

  const ingredientDraftRef = useRef<HTMLDivElement>(null);
  const skuDraftRef = useRef<HTMLDivElement>(null);
  const packDraftRef = useRef<HTMLDivElement>(null);
  const stepDraftRef = useRef<HTMLDivElement>(null);

  const formulaPercentTotal = useMemo(() => {
    return formData.formulaIngredients.reduce((sum, ing) => {
      const n = parseFloat(String(ing.percentWW).replace(/[^\d.-]/g, ''));
      return sum + (Number.isNaN(n) ? 0 : n);
    }, 0);
  }, [formData.formulaIngredients]);

  const skuBomValidation = useMemo(() => {
    const { limitQty, limitUom } = getEffectiveSkuBomLimitFields({
      fillSize: formData.fillSize,
      skuBomLimitQty: formData.skuBomLimitQty,
      skuBomLimitUom: formData.skuBomLimitUom,
    });
    return validateSkuBomTotals({
      lines: formData.skuBomLines.map((row) => ({
        inci_name: row.inciName,
        rm_code: row.rmCode,
        qty_per_unit: row.qtyPerUnit,
        uom: row.uom,
      })),
      limitQty,
      limitUom,
    });
  }, [formData.skuBomLines, formData.skuBomLimitQty, formData.skuBomLimitUom, formData.fillSize]);

  useEffect(() => {
    const z = formData.zohoId?.trim();
    if (z) setZohoCompositeFetchId(z);
  }, [formData.zohoId]);

  useEffect(() => {
    if (formulaPercentTotal > 100.001) return;
    setErrors((prev) => {
      if (!prev.formulaPercentTotal) return prev;
      const next = { ...prev };
      delete next.formulaPercentTotal;
      return next;
    });
  }, [formulaPercentTotal]);

  const runOnDraftLeave = useCallback(
    (containerRef: React.RefObject<HTMLDivElement | null>, flush: () => boolean) => {
      window.setTimeout(() => {
        const root = containerRef.current;
        if (!root) return;
        const active = document.activeElement;
        if (root.contains(active)) return;
        flush();
      }, 0);
    },
    []
  );

  // When route has :id, fetch product and fill form for edit
  useEffect(() => {
    if (!productIdFromRoute) return;
    setCurrentStage(0);
    let cancelled = false;
    setEditLoading(true);
    fetchPRProductDetail(productIdFromRoute).then((res) => {
      if (cancelled) return;
      setEditLoading(false);
      if (res.success && res.data) {
        const d = res.data;
        const dbg = {
          productIdFromRoute,
          formulaBomPhases: Array.isArray(d.formulaBom) ? d.formulaBom.length : null,
          formulaBomIngredientsTotal: Array.isArray(d.formulaBom)
            ? d.formulaBom.reduce((sum: number, ph: any) => sum + (Array.isArray(ph.ingredients) ? ph.ingredients.length : 0), 0)
            : null,
          packBomRows: Array.isArray(d.packBom) ? d.packBom.length : null,
          processSteps: Array.isArray(d.processSteps) ? d.processSteps.length : null,
          scalarKeysSample: d ? Object.keys(d).slice(0, 20) : null,
        };
        console.log('[PR Edit Populate Debug]', JSON.stringify(dbg, null, 2));
        if ((dbg.formulaBomPhases ?? 0) === 0 && (dbg.packBomRows ?? 0) === 0) {
          window.alert(`PR edit populate looks empty for id=${productIdFromRoute}. See console log [PR Edit Populate Debug].`);
        }
        const next = productDetailToBomForm(d);
        setFormData(next);
      }
    }).catch(() => {
      if (!cancelled) setEditLoading(false);
    });
    return () => { cancelled = true; };
  }, [productIdFromRoute]);

  const handleInputChange = (field: keyof BOMFormState, value: unknown) => {
    if (field === 'zohoId') return;
    if (field === 'bomCompositeItem') {
      setFormData((prev) => ({ ...prev, bomCompositeItem: value as '' | 'Yes' | 'No' }));
      setErrors((prev) => {
        if (!prev.bomCompositeItem) return prev;
        const next = { ...prev };
        delete next.bomCompositeItem;
        return next;
      });
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === 'mrp') {
      setErrors((prev) => {
        if (!prev.mrp) return prev;
        const next = { ...prev };
        delete next.mrp;
        return next;
      });
    }
  };

  const beginEditIngredient = (id: string) => {
    const ing = formData.formulaIngredients.find((i) => i.id === id);
    if (!ing) return;
    setEditingIngredientId(id);
    setTempIngredient({
      inciName: ing.inciName,
      phase: ing.phase,
      percentWW: ing.percentWW,
      uom: ing.uom || 'GM',
    });
    setSelectedRmId(ing.rawMaterialId || '');
    setIngredientRmQuery(
      ing.rawMaterialId
        ? rmTypeaheadLabelForId(rawMaterials, ing.rawMaterialId)
        : ing.inciName
    );
    window.setTimeout(() => {
      ingredientDraftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  };

  const cancelIngredientEdit = () => {
    setEditingIngredientId(null);
    setSelectedRmId('');
    setIngredientRmQuery('');
    setTempIngredient({ inciName: '', phase: '', percentWW: '', uom: 'GM' });
  };

  const flushIngredientDraft = (): boolean => {
    const rm = selectedRmId ? rawMaterialById.get(String(selectedRmId)) : undefined;
    const manualInci = tempIngredient.inciName.trim() || ingredientRmQuery.trim();
    if (!rm && !manualInci) return false;

    if (editingIngredientId) {
      if (rm) {
        const conflict = formData.formulaIngredients.some(
          (ing) => ing.id !== editingIngredientId && String(ing.rawMaterialId) === String(rm.id)
        );
        if (conflict) {
          addToast('error', 'This raw material is already added in Formula BOM');
          return false;
        }
      }
      setFormData((prev) => ({
        ...prev,
        formulaIngredients: prev.formulaIngredients.map((item) =>
          item.id === editingIngredientId
            ? {
                ...item,
                rawMaterialId: rm ? String(rm.id) : undefined,
                rmCode: rm ? rm.code : '',
                inciName: rm ? (rm.inci || rm.name || manualInci) : manualInci,
                phase: tempIngredient.phase,
                percentWW: tempIngredient.percentWW,
                uom: tempIngredient.uom || rm?.uom || 'GM',
              }
            : item
        ),
      }));
      setEditingIngredientId(null);
      setSelectedRmId('');
      setIngredientRmQuery('');
      setTempIngredient({ inciName: '', phase: '', percentWW: '', uom: 'GM' });
      return true;
    }

    if (rm && selectedRmIds.has(String(rm.id))) {
      addToast('error', 'This raw material is already added in Formula BOM');
      return false;
    }
    setFormData((prev) => ({
      ...prev,
      formulaIngredients: [
        ...prev.formulaIngredients,
        {
          id: Date.now().toString(),
          rawMaterialId: rm ? String(rm.id) : undefined,
          rmCode: rm ? rm.code : '',
          inciName: rm ? (rm.inci || rm.name || manualInci) : manualInci,
          phase: tempIngredient.phase,
          percentWW: tempIngredient.percentWW,
          // Keep operator-selected UOM; fallback to RM UOM only if no explicit input.
          uom: tempIngredient.uom || rm?.uom || 'GM',
        },
      ],
    }));
    setSelectedRmId('');
    setIngredientRmQuery('');
    setTempIngredient({ inciName: '', phase: '', percentWW: '', uom: 'GM' });
    return true;
  };

  const addIngredient = () => {
    flushIngredientDraft();
  };

  const removeIngredient = (id: string) => {
    setEditingIngredientId((cur) => {
      if (cur === id) {
        setSelectedRmId('');
        setIngredientRmQuery('');
        setTempIngredient({ inciName: '', phase: '', percentWW: '', uom: 'GM' });
        return null;
      }
      return cur;
    });
    setFormData((prev) => ({
      ...prev,
      formulaIngredients: prev.formulaIngredients.filter((item) => item.id !== id),
    }));
  };

  const importFormulaFromSkuBom = useCallback(() => {
    const { limitQty, limitUom } = getEffectiveSkuBomLimitFields({
      fillSize: formData.fillSize,
      skuBomLimitQty: formData.skuBomLimitQty,
      skuBomLimitUom: formData.skuBomLimitUom,
    });
    const mappedLines = formData.skuBomLines.map((l) => ({
      inciName: l.inciName,
      rmCode: l.rmCode,
      rawMaterialId: l.rawMaterialId,
      qtyPerUnit: l.qtyPerUnit,
      uom: l.uom,
    }));
    const res = skuBomLinesToFormulaRows({
      lines: mappedLines,
      limitQty,
      limitUom,
      specificGravity: parseBulkSpecificGravity(formData.specificGravity),
    });
    if (!res.ok) {
      addToast('error', res.error);
      return;
    }
    if (formData.formulaIngredients.length > 0) {
      const ok = window.confirm(
        'Replace all Formula BOM lines with % w/w derived from the SKU BOM (per-unit quantities)? You can undo only by re-entering lines manually.'
      );
      if (!ok) return;
    }
    const baseTime = Date.now();
    setFormData((prev) => ({
      ...prev,
      formulaIngredients: res.rows.map((r, i) => ({
        id: `${baseTime}-${i}`,
        rawMaterialId: r.rawMaterialId,
        rmCode: r.rmCode || '',
        inciName: r.inciName,
        phase: r.phase,
        percentWW: r.percentWW,
        uom: r.uom,
      })),
    }));
    setEditingIngredientId(null);
    setSelectedRmId('');
    setIngredientRmQuery('');
    setTempIngredient({ inciName: '', phase: '', percentWW: '', uom: 'GM' });
    addToast('success', `Imported ${res.rows.length} line(s) from SKU BOM (% w/w total 100%).`);
  }, [
    formData.fillSize,
    formData.skuBomLimitQty,
    formData.skuBomLimitUom,
    formData.skuBomLines,
    formData.specificGravity,
    formData.formulaIngredients.length,
    addToast,
  ]);

  const importSkuBomFromFormulaBom = useCallback(() => {
    const { limitQty, limitUom } = getEffectiveSkuBomLimitFields({
      fillSize: formData.fillSize,
      skuBomLimitQty: formData.skuBomLimitQty,
      skuBomLimitUom: formData.skuBomLimitUom,
    });
    if (!limitQty || !limitUom) {
      addToast('error', 'Set net per-unit quantity and UOM (Fill Size e.g. 50g/50ml, or manual limit on this step).');
      return;
    }
    const formulaLines = formData.formulaIngredients.map((ing) => ({
      inciName: ing.inciName,
      rmCode: ing.rmCode,
      rawMaterialId: ing.rawMaterialId,
      pct_w_w: ing.percentWW,
      uom: ing.uom,
      phase: ing.phase,
    }));
    const res = formulaRowsToSkuBomLines({ formulaLines, limitQty, limitUom });
    if (!res.ok) {
      addToast('error', res.error);
      return;
    }
    if (formData.skuBomLines.length > 0) {
      const ok = window.confirm(
        'Replace all SKU BOM lines with quantities derived from Formula BOM % w/w? Existing SKU lines will be removed.'
      );
      if (!ok) return;
    }
    const baseTime = Date.now();
    setFormData((prev) => ({
      ...prev,
      skuBomLines: res.rows.map((r, i) => ({
        id: `${baseTime}-sku-${i}`,
        rawMaterialId: r.rawMaterialId ?? '',
        rmCode: r.rmCode || '',
        inciName: r.inciName,
        qtyPerUnit: String(r.qtyPerUnit),
        uom: r.uom,
      })),
      skuBomLimitQty: String(res.limitQty),
      skuBomLimitUom: res.limitUom,
    }));
    addToast(
      'success',
      `Imported ${res.rows.length} SKU line(s) from Formula BOM for net ${res.limitQty} ${res.limitUom}.`
    );
  }, [
    formData.fillSize,
    formData.skuBomLimitQty,
    formData.skuBomLimitUom,
    formData.formulaIngredients,
    formData.skuBomLines.length,
    addToast,
  ]);

  const loadZohoCompositeIntoBom = useCallback(
    async (syncFormula: boolean) => {
      const rawId = zohoCompositeFetchId.trim() || formData.zohoId.trim();
      if (!rawId) {
        addToast(
          'error',
          'Enter the Zoho composite item id (same as in Inventory / Books), or save the product so Zoho Item ID is populated.'
        );
        return;
      }
      let applyFormula = syncFormula;
      if (applyFormula && formData.formulaIngredients.length > 0) {
        if (
          !window.confirm(
            'Replace Formula BOM % w/w from the imported SKU lines? Existing formula lines will be removed.'
          )
        ) {
          applyFormula = false;
        }
      }
      if (formData.skuBomLines.length > 0 && !window.confirm('Replace current SKU BOM lines with Zoho mapped items?')) {
        return;
      }

      setZohoCompositeLoading(true);
      try {
        const res = await fetchZohoCompositeSkuBomSuggestion(rawId);
        if (!res.success || !res.data) {
          addToast('error', typeof res.error === 'string' ? res.error : 'Failed to load Zoho composite');
          return;
        }
        const data = res.data;
        const base = Date.now();
        const skuBomLines = data.sku_bom.map((r, i) => ({
          id: `${base}-${i}`,
          rawMaterialId: r.raw_material_id != null ? String(r.raw_material_id) : undefined,
          rmCode: r.rm_code ?? '',
          inciName: r.inci_name ?? '',
          qtyPerUnit: String(r.qty_per_unit ?? ''),
          uom: r.uom || 'G',
        }));
        let skuBomLimitQty = formData.skuBomLimitQty;
        let skuBomLimitUom = formData.skuBomLimitUom;
        const fillNet = parseFillSizeToSkuNet(formData.fillSize);
        if (!fillNet && data.sku_bom_limit_qty != null && data.sku_bom_limit_uom) {
          skuBomLimitQty = String(data.sku_bom_limit_qty);
          skuBomLimitUom = data.sku_bom_limit_uom;
        }
        const { limitQty, limitUom } = getEffectiveSkuBomLimitFields({
          fillSize: formData.fillSize,
          skuBomLimitQty,
          skuBomLimitUom,
        });
        let formulaIngredients = formData.formulaIngredients;
        let formulaNote = '';
        if (applyFormula) {
          const mappedLines = skuBomLines.map((l) => ({
            inciName: l.inciName,
            rmCode: l.rmCode,
            rawMaterialId: l.rawMaterialId,
            qtyPerUnit: l.qtyPerUnit,
            uom: l.uom,
          }));
          const pctRes = skuBomLinesToFormulaRows({
            lines: mappedLines,
            limitQty,
            limitUom,
            specificGravity: parseBulkSpecificGravity(formData.specificGravity),
          });
          if (pctRes.ok) {
            formulaIngredients = pctRes.rows.map((r, i) => ({
              id: `${base}-f-${i}`,
              rawMaterialId: r.rawMaterialId,
              rmCode: r.rmCode || '',
              inciName: r.inciName,
              phase: r.phase,
              percentWW: r.percentWW,
              uom: r.uom,
            }));
            formulaNote = ' Formula % w/w updated from SKU BOM.';
          } else {
            addToast('error', `SKU lines loaded; formula not updated: ${pctRes.error}`);
          }
        }
        setFormData((prev) => ({
          ...prev,
          skuBomLines,
          skuBomLimitQty,
          skuBomLimitUom,
          formulaIngredients,
        }));
        setEditingSkuLineId(null);
        setSelectedSkuRmId('');
        setSkuRmSearchTerm('');
        setTempSkuLine({ inciName: '', qtyPerUnit: '', uom: 'GM' });
        if (applyFormula) {
          setEditingIngredientId(null);
          setSelectedRmId('');
          setIngredientRmQuery('');
          setTempIngredient({ inciName: '', phase: '', percentWW: '', uom: 'GM' });
        }
        let msg = `Loaded ${data.sku_bom.length} line(s) from Zoho${data.composite_name ? `: ${data.composite_name}` : ''}.`;
        if (data.warnings?.length) msg += ` ${data.warnings.join(' ')}`;
        if (data.unmatched_components?.length) {
          msg += ` ${data.unmatched_components.length} line(s) are not linked to an RM master — link them in the row editor.`;
        }
        msg += formulaNote;
        addToast('success', msg);
      } finally {
        setZohoCompositeLoading(false);
      }
    },
    [
      zohoCompositeFetchId,
      formData.zohoId,
      formData.skuBomLines.length,
      formData.formulaIngredients.length,
      formData.fillSize,
      formData.skuBomLimitQty,
      formData.skuBomLimitUom,
      addToast,
    ]
  );

  const reloadPrFromServer = useCallback(async () => {
    if (!productIdFromRoute) return;
    const res = await fetchPRProductDetail(productIdFromRoute);
    if (res.success && res.data) {
      setFormData(productDetailToBomForm(res.data));
    }
  }, [productIdFromRoute]);

  const handleSkuExcelUploadBomForm = useCallback(
    async (file: File) => {
      if (!productIdFromRoute) return;
      setSkuExcelUploading(true);
      try {
        const res = await uploadSkuBomExcel(productIdFromRoute, file);
        if (!res.success || !res.data) {
          const err = res.error;
          const msg =
            typeof err === 'string'
              ? err
              : err && typeof err === 'object' && 'message' in err
                ? String((err as { message?: string }).message)
                : 'Failed to import Excel';
          addToast('error', msg);
          return;
        }
        const { summary, sheet_name } = res.data;
        await reloadPrFromServer();
        addToast(
          'success',
          `Imported sheet "${sheet_name}" — ${summary.sku_rm_count} SKU RM line(s), ${summary.pm_count} pack line(s).`
        );
      } finally {
        setSkuExcelUploading(false);
        if (skuExcelFileInputRef.current) skuExcelFileInputRef.current.value = '';
      }
    },
    [productIdFromRoute, reloadPrFromServer, addToast]
  );

  const handleClearSkuBomForReimportBomForm = useCallback(async () => {
    if (!productIdFromRoute) return;
    if (
      !window.confirm(
        'Clear all SKU BOM and Pack BOM lines on the server for this PR? Formula BOM (% phases) and process steps are not changed. Use this before uploading Excel again from scratch.'
      )
    ) {
      return;
    }
    setSkuBomClearing(true);
    try {
      const res = await clearSkuBomForReimport(productIdFromRoute);
      if (!res.success || !res.data) {
        const err = res.error;
        const msg =
          typeof err === 'string'
            ? err
            : err && typeof err === 'object' && 'message' in err
              ? String((err as { message?: string }).message)
              : 'Failed to clear';
        addToast('error', msg);
        return;
      }
      addToast('success', res.data.message ?? 'SKU BOM and Pack BOM cleared.');
      await reloadPrFromServer();
    } finally {
      setSkuBomClearing(false);
    }
  }, [productIdFromRoute, reloadPrFromServer, addToast]);

  const beginEditSkuLine = (id: string) => {
    const row = formData.skuBomLines.find((r) => r.id === id);
    if (!row) return;
    setEditingSkuLineId(id);
    setTempSkuLine({
      inciName: row.inciName,
      qtyPerUnit: row.qtyPerUnit,
      uom: row.uom || 'KG',
    });
    setSelectedSkuRmId(row.rawMaterialId || '');
    setSkuRmQuery(
      row.rawMaterialId ? rmTypeaheadLabelForId(rawMaterials, row.rawMaterialId) : row.inciName
    );
    window.setTimeout(() => {
      skuDraftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  };

  const cancelSkuLineEdit = () => {
    setEditingSkuLineId(null);
    setSelectedSkuRmId('');
    setSkuRmQuery('');
    setTempSkuLine({ inciName: '', qtyPerUnit: '', uom: 'GM' });
  };

  const flushSkuLineDraft = (): boolean => {
    const rm = selectedSkuRmId ? rawMaterialById.get(String(selectedSkuRmId)) : undefined;
    const manualInci = tempSkuLine.inciName.trim() || skuRmQuery.trim();
    if (!rm && !manualInci) return false;
    const qtyNum = parseFloat(String(tempSkuLine.qtyPerUnit).replace(/[^\d.-]/g, ''));
    if (Number.isNaN(qtyNum) || qtyNum <= 0) {
      addToast('error', 'Enter a positive quantity per unit for SKU BOM');
      return false;
    }

    if (editingSkuLineId) {
      if (rm) {
        const conflict = formData.skuBomLines.some(
          (r) => r.id !== editingSkuLineId && String(r.rawMaterialId) === String(rm.id)
        );
        if (conflict) {
          addToast('error', 'This raw material is already added in SKU BOM');
          return false;
        }
      }
      setFormData((prev) => ({
        ...prev,
        skuBomLines: prev.skuBomLines.map((item) =>
          item.id === editingSkuLineId
            ? {
                ...item,
                rawMaterialId: rm ? String(rm.id) : undefined,
                rmCode: rm ? rm.code : item.rmCode,
                inciName: rm ? (rm.inci || rm.name || manualInci) : manualInci,
                qtyPerUnit: tempSkuLine.qtyPerUnit,
                uom: tempSkuLine.uom || rm?.uom || 'GM',
              }
            : item
        ),
      }));
      setEditingSkuLineId(null);
      setSelectedSkuRmId('');
      setSkuRmQuery('');
      setTempSkuLine({ inciName: '', qtyPerUnit: '', uom: 'GM' });
      return true;
    }

    if (rm && selectedSkuRmIds.has(String(rm.id))) {
      addToast('error', 'This raw material is already added in SKU BOM');
      return false;
    }
    setFormData((prev) => ({
      ...prev,
      skuBomLines: [
        ...prev.skuBomLines,
        {
          id: Date.now().toString(),
          rawMaterialId: rm ? String(rm.id) : undefined,
          rmCode: rm ? rm.code : '',
          inciName: rm ? (rm.inci || rm.name || manualInci) : manualInci,
          qtyPerUnit: tempSkuLine.qtyPerUnit,
          uom: tempSkuLine.uom || rm?.uom || 'GM',
        },
      ],
    }));
    setSelectedSkuRmId('');
    setSkuRmQuery('');
    setTempSkuLine({ inciName: '', qtyPerUnit: '', uom: 'GM' });
    return true;
  };

  const addSkuLine = () => {
    flushSkuLineDraft();
  };

  const removeSkuLine = (id: string) => {
    setEditingSkuLineId((cur) => {
      if (cur === id) {
        setSelectedSkuRmId('');
        setSkuRmQuery('');
        setTempSkuLine({ inciName: '', qtyPerUnit: '', uom: 'GM' });
        return null;
      }
      return cur;
    });
    setFormData((prev) => ({
      ...prev,
      skuBomLines: prev.skuBomLines.filter((item) => item.id !== id),
    }));
  };

  const beginEditComponent = (id: string) => {
    const c = formData.packingComponents.find((x) => x.id === id);
    if (!c) return;
    setEditingComponentId(id);
    setTempComponent({
      pmDescription: c.pmDescription,
      type: c.type,
      qtyUnit: c.qtyUnit,
      uom: c.uom || '',
    });
    setSelectedPmId(c.packMaterialId || '');
    setPackPmQuery(
      c.packMaterialId ? pmTypeaheadLabelForId(packMaterials, c.packMaterialId) : c.pmDescription
    );
    window.setTimeout(() => {
      packDraftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  };

  const cancelComponentEdit = () => {
    setEditingComponentId(null);
    setSelectedPmId('');
    setPackPmQuery('');
    setTempComponent({ pmDescription: '', type: '', qtyUnit: '', uom: '' });
  };

  const flushComponentDraft = (): boolean => {
    const pm = selectedPmId ? packMaterialById.get(String(selectedPmId)) : undefined;
    const manualDesc = tempComponent.pmDescription.trim() || packPmQuery.trim();
    if (!pm && !manualDesc) return false;

    if (editingComponentId) {
      if (pm) {
        const conflict = formData.packingComponents.some(
          (c) => c.id !== editingComponentId && String(c.packMaterialId) === String(pm.id)
        );
        if (conflict) {
          addToast('error', 'This pack material is already added in Pack BOM');
          return false;
        }
      }
      setFormData((prev) => ({
        ...prev,
        packingComponents: prev.packingComponents.map((item) =>
          item.id === editingComponentId
            ? {
                ...item,
                packMaterialId: pm ? String(pm.id) : undefined,
                pmCode: pm ? pm.code : '',
                pmDescription: pm ? (pm.description || manualDesc) : manualDesc,
                type: tempComponent.type || pm?.level || pm?.type || '',
                qtyUnit: tempComponent.qtyUnit,
                uom: tempComponent.uom || pm?.unit || 'PCS',
              }
            : item
        ),
      }));
      setEditingComponentId(null);
      setSelectedPmId('');
      setPackPmQuery('');
      setTempComponent({ pmDescription: '', type: '', qtyUnit: '', uom: '' });
      return true;
    }

    if (pm && selectedPmIds.has(String(pm.id))) {
      addToast('error', 'This pack material is already added in Pack BOM');
      return false;
    }
    setFormData((prev) => ({
      ...prev,
      packingComponents: [
        ...prev.packingComponents,
        {
          id: Date.now().toString(),
          packMaterialId: pm ? String(pm.id) : undefined,
          pmCode: pm ? pm.code : '',
          pmDescription: pm ? (pm.description || manualDesc) : manualDesc,
          type: tempComponent.type || pm?.level || pm?.type || '',
          qtyUnit: tempComponent.qtyUnit,
          uom: tempComponent.uom || pm?.unit || 'PCS',
        },
      ],
    }));
    setSelectedPmId('');
    setPackPmQuery('');
    setTempComponent({ pmDescription: '', type: '', qtyUnit: '', uom: '' });
    return true;
  };

  const addComponent = () => {
    flushComponentDraft();
  };

  const removeComponent = (id: string) => {
    setEditingComponentId((cur) => {
      if (cur === id) {
        setSelectedPmId('');
        setTempComponent({ pmDescription: '', type: '', qtyUnit: '', uom: '' });
        return null;
      }
      return cur;
    });
    setFormData((prev) => ({
      ...prev,
      packingComponents: prev.packingComponents.filter((item) => item.id !== id),
    }));
  };

  const flushStepDraft = (): boolean => {
    if (!tempStep.instruction.trim()) return false;
    setFormData((prev) => ({
      ...prev,
      processSteps: [
        ...prev.processSteps,
        {
          id: Date.now().toString(),
          ...tempStep,
        },
      ],
    }));
    setTempStep({ stepNumber: '', instruction: '', duration: '' });
    return true;
  };

  const addStep = () => {
    flushStepDraft();
  };

  const removeStep = (id: string) => {
    setFormData(prev => ({
      ...prev,
      processSteps: prev.processSteps.filter(item => item.id !== id)
    }));
  };

  const prPreviewSections = useMemo(
    () => buildMasterPreviewSections(formData as unknown as Record<string, unknown>, PR_PREVIEW_SECTIONS),
    [formData]
  );

  const validatePrForSubmit = (): { mode: 'create' | 'update'; body: Record<string, unknown> } | null => {
    setErrors({});
    if (!formData.category.trim()) {
      setErrors({ category: 'Step 1 — PR Category is required' });
      addToast('error', 'Step 1 — Select a PR Category');
      setCurrentStage(0);
      focusPrField('category');
      return null;
    }
    if (!formData.bomCompositeItem) {
      setErrors({ bomCompositeItem: 'Step 1 — Composite Item selection is required' });
      addToast('error', 'Step 1 — Select whether this is a Composite Item (Yes / No)');
      setCurrentStage(0);
      focusPrField('bomCompositeItem');
      return null;
    }
    if (!formData.productName.trim()) {
      setErrors({ productName: 'Step 1 — Product Name is required' });
      addToast('error', 'Step 1 — Product Name is required');
      setCurrentStage(0);
      focusPrField('productName');
      return null;
    }
    const mrpMsg = mrpValidationMessage(formData.mrp);
    if (mrpMsg) {
      setErrors({ mrp: `Step 1 — MRP Price: ${mrpMsg}` });
      addToast('error', `Step 1 — MRP Price: ${mrpMsg}`);
      setCurrentStage(0);
      window.setTimeout(() => {
        const el = document.getElementById('mrp');
        if (el instanceof HTMLElement) el.focus();
      }, 0);
      return null;
    }
    const codeTrim = formData.skuCode.trim();
    if (formData.prRecordType !== 'legacy') {
      const rt = formData.prRecordType === 'temporary' ? 'temporary' : 'permanent';
      if (codeTrim) {
        const badTemp = rt === 'temporary' && !/^TPR/i.test(codeTrim);
        const badPerm =
          rt === 'permanent' && (!/^PR/i.test(codeTrim) || /^TPR/i.test(codeTrim));
        if (badTemp || badPerm) {
          addToast(
            'error',
            rt === 'temporary'
              ? 'Internal PR code must start with TPR for a temporary record.'
              : 'Internal PR code must start with PR (not TPR) for a permanent record.'
          );
          setCurrentStage(0);
          return null;
        }
      }
    }
    if (formData.fillSize.trim() && !isValidFillSizeInput(formData.fillSize)) {
      setErrors({ fillSize: 'Fill Size must be in g or ml format (e.g. 50g or 50ml)' });
      addToast('error', 'Fill Size must be in g or ml format (example: 50g or 50ml) — see Step 5 (Specs & Regulatory)');
      setCurrentStage(5);
      window.setTimeout(() => {
        const el = document.getElementById('fillSize');
        if (el instanceof HTMLElement) el.focus();
      }, 0);
      return null;
    }

    const rmCount = countMeaningfulFormulaRmLines(bomFormToRmLines(formData));
    if (rmCount < 1) {
      addToast('error', 'At least one Formula BOM line is required. Add ingredients in Formula BOM.');
      setCurrentStage(1);
      return null;
    }
    if (formulaPercentTotal > 100.001) {
      const msg = `Formula BOM % w/w total cannot exceed 100% (current ${formulaPercentTotal.toFixed(2)}%).`;
      setErrors({ formulaPercentTotal: `Step 2 — ${msg}` });
      addToast('error', `Step 2 — ${msg}`);
      setCurrentStage(1);
      return null;
    }
    const pmCount = countMeaningfulPackLines(bomFormToPmLines(formData));
    if (pmCount < 1) {
      addToast('error', 'At least one Pack BOM line is required. Add packaging in Pack BOM.');
      setCurrentStage(3);
      return null;
    }

    const meaningfulSku = countMeaningfulSkuRmLines(bomFormToSkuRmLines(formData));
    if (meaningfulSku > 0 && !skuBomValidation.ok) {
      addToast('error', skuBomValidation.error);
      setCurrentStage(2);
      return null;
    }

    if (productIdFromRoute) {
      return { mode: 'update', body: buildPrUpdateBody(formData) };
    }
    return { mode: 'create', body: buildPrRegistrationBody(formData) };
  };

  const handleSubmit = () => {
    const pending = validatePrForSubmit();
    if (!pending) return;
    setPendingPrSubmit(pending);
    setSubmitPreviewOpen(true);
  };

  const handleConfirmSubmit = async () => {
    const pending = pendingPrSubmit;
    if (!pending) return;
    setSubmitConfirming(true);
    try {
      if (pending.mode === 'update' && productIdFromRoute) {
        const res = await updatePRProduct(productIdFromRoute, pending.body);
        if (res.success) {
          addToast('success', 'Product updated successfully!');
          onSaved?.();
          setSubmitPreviewOpen(false);
          setPendingPrSubmit(null);
          if (onClose) onClose();
          else navigate('/bom');
        } else {
          addToast('error', typeof res.error === 'string' ? res.error : 'Failed to update product');
        }
        return;
      }

      const res = await createPRRegistration(pending.body);
      if (res.success) {
        addToast('success', 'Product registered — saved to Products (PR) master.');
        onSaved?.();
        setSubmitPreviewOpen(false);
        setPendingPrSubmit(null);
        if (onClose) onClose();
        else navigate('/bom');
      } else {
        addToast('error', typeof res.error === 'string' ? res.error : 'Failed to register product');
      }
    } catch (err) {
      console.error(err);
      addToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitConfirming(false);
    }
  };

  const renderStageContent = () => {
    switch (currentStage) {
      case 0:
        return (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => { if (onClose) onClose(); else navigate('/bom'); }}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                ← Back to PR Master list
              </button>
              <p className="text-xs text-slate-500">
                {productIdFromRoute ? 'Editing linked PR / BOM registration' : 'Stepwise flow — same pattern as Raw Material master'}
              </p>
            </div>

            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">PR Category</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PR Category <span className="text-red-600">*</span></label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    aria-invalid={errors.category ? true : undefined}
                    className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.category ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select category</option>
                    {PR_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {formData.category &&
                    !PR_CATEGORY_OPTIONS.includes(formData.category as (typeof PR_CATEGORY_OPTIONS)[number]) ? (
                      <option value={formData.category}>{formData.category} (legacy)</option>
                    ) : null}
                  </select>
                  {errors.category ? <p className="mt-1 text-xs text-red-600">{errors.category}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub‑Category (optional)</label>
                  <select
                    id="prSubCategory"
                    value={formData.prSubCategory}
                    onChange={(e) => handleInputChange('prSubCategory', e.target.value)}
                    aria-invalid={errors.prSubCategory ? true : undefined}
                    className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.prSubCategory ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select sub-category</option>
                    {PR_SUB_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {formData.prSubCategory &&
                    !PR_SUB_CATEGORY_OPTIONS.includes(formData.prSubCategory as (typeof PR_SUB_CATEGORY_OPTIONS)[number]) ? (
                      <option value={formData.prSubCategory}>{formData.prSubCategory} (legacy)</option>
                    ) : null}
                  </select>
                  {errors.prSubCategory ? <p className="mt-1 text-xs text-red-600">{errors.prSubCategory}</p> : null}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="bomCompositeItem" className="block text-sm font-medium text-gray-700 mb-1">
                    Composite Item
                    <span className="text-red-600 ml-0.5" aria-hidden>*</span>
                  </label>
                  <select
                    id="bomCompositeItem"
                    value={formData.bomCompositeItem}
                    onChange={(e) => handleInputChange('bomCompositeItem', e.target.value)}
                    disabled={lockPrimaryFields}
                    aria-invalid={errors.bomCompositeItem ? true : undefined}
                    className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.bomCompositeItem ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
                    } ${lockPrimaryFields ? 'bg-slate-100 text-slate-700 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select...</option>
                    <option value="Yes">Yes — Composite Item</option>
                    <option value="No">No — Single product</option>
                  </select>
                  {errors.bomCompositeItem ? (
                    <p className="mt-1 text-xs text-red-600">{errors.bomCompositeItem}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      Composite flag is used for Books / workflows.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <label className="block text-sm font-semibold text-slate-900 mb-2">PRODUCT IDENTITY</label>
              <div className="space-y-4 border-t border-slate-200 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name <span className="text-red-600">*</span></label>
                  <input
                    id="productName"
                    type="text"
                    placeholder="e.g. EI Sunscreen Lotion SPF50+ PA++++"
                    value={formData.productName}
                    onChange={(e) => handleInputChange('productName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div>
                  <div className="block text-xs font-semibold text-slate-700 mb-2">
                    PR record type <span className="text-red-600">*</span>
                  </div>
                  <div className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-6 text-sm ${lockPrimaryFields ? 'opacity-90' : ''}`}>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="prRecordType"
                        checked={formData.prRecordType === 'permanent'}
                        disabled={lockPrimaryFields}
                        onChange={() => handleInputChange('prRecordType', 'permanent')}
                        className="text-blue-600"
                      />
                      <span>Permanent — internal code <span className="font-mono">PR#####</span></span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="prRecordType"
                        checked={formData.prRecordType === 'temporary'}
                        disabled={lockPrimaryFields}
                        onChange={() => handleInputChange('prRecordType', 'temporary')}
                        className="text-blue-600"
                      />
                      <span>Temporary — internal code <span className="font-mono">TPR#####</span></span>
                    </label>
                    {productIdFromRoute ? (
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="prRecordType"
                          checked={formData.prRecordType === 'legacy'}
                          disabled={lockPrimaryFields}
                          onChange={() => handleInputChange('prRecordType', 'legacy')}
                          className="text-blue-600"
                        />
                        <span>Legacy / unspecified (existing codes)</span>
                      </label>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Leave internal code blank to auto-assign the next free number. Manual codes must match the series you select.
                  </p>
                </div>

                <div>
                  <label htmlFor="internalPrCode" className="block text-xs font-semibold text-slate-700 mb-1">
                    Internal PR code <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="internalPrCode"
                    type="text"
                    placeholder={formData.prRecordType === 'temporary' ? 'e.g. TPR00042 or leave blank' : 'e.g. PR00042 or leave blank'}
                    value={formData.skuCode}
                    onChange={(e) => handleInputChange('skuCode', e.target.value)}
                    disabled={lockPrimaryFields}
                    autoComplete="off"
                    className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      lockPrimaryFields ? 'bg-slate-100 text-slate-700 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="mrp">
                    MRP Price <span className="text-slate-400 font-normal">(optional — sale order price comes from Items List client rates)</span>
                  </label>
                  <input
                    id="mrp"
                    type="text"
                    placeholder="e.g. Rs.499"
                    value={formData.mrp}
                    onChange={(e) => handleInputChange('mrp', e.target.value)}
                    aria-invalid={Boolean(errors.mrp)}
                    aria-describedby={errors.mrp ? 'mrp-error' : undefined}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${errors.mrp ? 'border-red-500' : 'border-slate-200'}`}
                  />
                  {errors.mrp ? (
                    <p id="mrp-error" className="mt-1 text-xs text-red-600">
                      {errors.mrp}
                    </p>
                  ) : null}
                </div>

              </div>
            </div>

          </div>
        );
      case 1:
        return (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">FORMULA BOM - RAW MATERIALS</label>
                <p className="text-xs text-slate-600 mb-2">
                  Add ingredients in phase order. Rows are added only when you click the Add button (total should equal 100%).
                </p>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={importFormulaFromSkuBom}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100"
                    title="Uses SKU BOM per-unit quantities and net limit; each line becomes % w/w = (line qty ÷ net) × 100."
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    Import from SKU BOM
                  </button>
                  <span className="text-[11px] text-slate-500 max-w-xl">
                    Fill the <strong>SKU BOM</strong> step first (lines must sum to net per unit). Imports replace formula lines with the same RMs and phases set to <span className="font-mono">Bulk</span>.
                  </span>
                </div>

                <div className="mb-4 space-y-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
                  <div className="grid min-w-[520px] grid-cols-4 gap-2 text-xs font-semibold text-slate-600 uppercase sm:min-w-0">
                    <div>INCI Name / Raw Material</div>
                    <div>Phase</div>
                    <div>% W/W</div>
                    <div>UOM</div>
                  </div>
                  <div className="space-y-2">
                    {formData.formulaIngredients.map(ing => (
                      <div
                        key={ing.id}
                        className={`grid min-w-[520px] grid-cols-4 gap-2 text-sm items-center p-2 rounded sm:min-w-0 ${
                          ing.id === editingIngredientId ? 'bg-blue-50 ring-2 ring-blue-200' : 'bg-slate-50'
                        }`}
                      >
                        <div className="text-slate-900">{ing.inciName}</div>
                        <div className="text-slate-600">{ing.phase}</div>
                        <div className="text-slate-600">{ing.percentWW}</div>
                        <div className="flex justify-end items-center gap-1">
                          <span className="text-slate-600 mr-auto">{ing.uom}</span>
                          <button
                            type="button"
                            onClick={() => beginEditIngredient(ing.id)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded"
                            title="Edit line"
                            aria-label="Edit line"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeIngredient(ing.id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded"
                            title="Remove line"
                            aria-label="Remove line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  ref={ingredientDraftRef}
                  className="border border-slate-200 rounded-lg p-3 bg-white space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {editingIngredientId ? 'Edit line' : 'New line'}
                    </p>
                    {editingIngredientId ? (
                      <button type="button" onClick={cancelIngredientEdit} className="text-xs text-slate-600 hover:text-slate-900 underline">
                        Cancel edit
                      </button>
                    ) : null}
                  </div>
                  <RmMasterTypeahead
                    className="sm:col-span-2"
                    options={formulaRmTypeaheadOptions}
                    value={ingredientRmQuery}
                    loading={masterLoading}
                    selectedId={selectedRmId}
                    onValueChange={(next) => {
                      setIngredientRmQuery(next);
                      setTempIngredient((prev) => ({ ...prev, inciName: next }));
                    }}
                    onSelect={(opt) => {
                      setSelectedRmId(opt.id);
                      setIngredientRmQuery(opt.label);
                      const rm = rawMaterialById.get(opt.id);
                      setTempIngredient((prev) => ({
                        ...prev,
                        inciName: rm ? (rm.inci || rm.name || opt.label) : opt.label,
                        uom: prev.uom || rm?.uom || 'GM',
                      }));
                    }}
                    onClearSelection={() => setSelectedRmId('')}
                    placeholder="Search RM by code or INCI — pick from list or type manual name"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Phase"
                      value={tempIngredient.phase}
                      onChange={(e) => setTempIngredient(prev => ({ ...prev, phase: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                    <input
                      type="number"
                      placeholder="% W/W"
                      value={tempIngredient.percentWW}
                      onChange={(e) => setTempIngredient(prev => ({ ...prev, percentWW: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                    <select
                      value={tempIngredient.uom}
                      onChange={(e) => setTempIngredient(prev => ({ ...prev, uom: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    >
                      <option>GM</option>
                      <option>ML</option>
                      <option>KG</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                  <div>
                    <p className="text-xs text-slate-600">
                      Total (saved lines):{' '}
                      <span
                        className={`font-semibold ${
                          formulaPercentTotal > 100.001
                            ? 'text-red-600'
                            : Math.abs(formulaPercentTotal - 100) <= 0.001
                              ? 'text-blue-600'
                              : 'text-amber-700'
                        }`}
                      >
                        {formulaPercentTotal.toFixed(2)}%
                      </span>
                      {formulaPercentTotal > 100.001 ? (
                        <span className="text-red-600"> — cannot exceed 100%</span>
                      ) : null}
                    </p>
                    {errors.formulaPercentTotal ? (
                      <p className="mt-1 text-xs text-red-600">{errors.formulaPercentTotal}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={addIngredient}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50"
                  >
                    {editingIngredientId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingIngredientId ? 'Update ingredient' : 'Add ingredient to list'}
                  </button>
                </div>
              </div>
            </div>
        );
      case 2: {
        const fillNet = parseFillSizeToSkuNet(formData.fillSize);
        return (
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-violet-800 mb-2">
                SKU BOM — RAW MATERIALS (PER UNIT){' '}
                <span className="font-normal text-violet-600">(optional — Formula BOM and Pack BOM are required)</span>
              </label>
              <p className="text-xs text-slate-600 mb-3">
                Raw materials by quantity for <strong>one</strong> finished unit. Each line can use G, KG, ML, or L; all lines must match the net type (mass vs volume). The <strong>sum must equal the net per unit exactly</strong> (±0.001).
              </p>

              {productIdFromRoute ? (
                <div className="mb-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50/80 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">Bulk import from Excel</p>
                      <p className="text-[11px] text-emerald-900/80 mt-0.5">
                        Same as PR Masters list: <span className="font-mono">Component Name</span>, <span className="font-mono">Type</span>{' '}
                        (Raw Material / Packaging), <span className="font-mono">Qty per SKU</span>, <span className="font-mono">UOM</span>. Writes to
                        the server and reloads this form. <strong>Clear import</strong> empties SKU + Pack BOM lines so you can upload fresh.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                      <input
                        ref={skuExcelFileInputRef}
                        type="file"
                        accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleSkuExcelUploadBomForm(f);
                        }}
                      />
                      <button
                        type="button"
                        disabled={skuExcelUploading || skuBomClearing || zohoCompositeLoading}
                        onClick={() => void handleClearSkuBomForReimportBomForm()}
                        title="Clears SKU BOM + Pack BOM on the server; keeps formula % and process steps."
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-amber-300 bg-white text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {skuBomClearing ? 'Clearing…' : 'Clear import'}
                      </button>
                      <button
                        type="button"
                        disabled={skuExcelUploading || skuBomClearing || zohoCompositeLoading}
                        onClick={() => skuExcelFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {skuExcelUploading ? 'Uploading…' : 'Upload Excel'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mb-4 text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2">
                  Save the PR first (get a product id); then you can use <strong>Upload Excel</strong> and <strong>Clear import</strong> here.
                </p>
              )}

              <div className="mb-4 p-3 rounded-lg border border-slate-200 bg-slate-50/90 space-y-2">
                <p className="text-xs font-semibold text-slate-800">Zoho composite (Inventory / Books)</p>
                <p className="text-[11px] text-slate-600">
                  Paste the composite item id from Zoho (e.g. <span className="font-mono">1252231000017972949</span>). The server loads <strong>mapped_items</strong> into SKU BOM and optionally derives Formula % w/w. OAuth + org id are configured on the API; Inventory is tried first, then Books.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                      Composite item ID
                    </label>
                    <input
                      type="text"
                      value={zohoCompositeFetchId}
                      onChange={(e) => setZohoCompositeFetchId(e.target.value)}
                      placeholder="Numeric id from Zoho"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-mono"
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={zohoCompositeLoading}
                    onClick={() => void loadZohoCompositeIntoBom(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <CloudDownload className="w-3.5 h-3.5" />
                    {zohoCompositeLoading ? 'Loading…' : 'Load into SKU BOM'}
                  </button>
                  <button
                    type="button"
                    disabled={zohoCompositeLoading}
                    onClick={() => void loadZohoCompositeIntoBom(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                  >
                    <CloudDownload className="w-3.5 h-3.5" />
                    {zohoCompositeLoading ? 'Loading…' : 'Load SKU + Formula %'}
                  </button>
                </div>
              </div>

              {fillNet ? (
                <div className="mb-4 p-3 rounded-lg bg-violet-50/80 border border-violet-100 space-y-1">
                  <p className="text-xs font-semibold text-violet-900 uppercase tracking-wide">Net per 1 product unit</p>
                  <p className="text-lg font-mono font-bold text-violet-900">
                    {fillNet.qty} <span className="text-base font-semibold text-violet-700">{fillNet.uom}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    Pulled from product <strong>Fill Size</strong> ({formData.fillSize.trim() || '—'}). Change it on the <strong>Specs & Regulatory</strong> step; SKU totals validate against that value.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3 rounded-lg bg-amber-50/80 border border-amber-100">
                  <div>
                    <label className="block text-xs font-semibold text-amber-900 mb-1">Net per 1 product unit — quantity (manual)</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="e.g. 50"
                      value={formData.skuBomLimitQty}
                      onChange={(e) => handleInputChange('skuBomLimitQty', e.target.value)}
                      className="w-full px-2 py-1.5 border border-amber-200 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-amber-900 mb-1">UOM</label>
                    <select
                      value={formData.skuBomLimitUom}
                      onChange={(e) => handleInputChange('skuBomLimitUom', e.target.value)}
                      className="w-full px-2 py-1.5 border border-amber-200 rounded text-sm"
                    >
                      <option value="GM">G / GM (grams)</option>
                      <option value="KG">KG (kilograms)</option>
                      <option value="ML">ML (millilitres)</option>
                      <option value="L">L (litres)</option>
                    </select>
                  </div>
                  <p className="sm:col-span-2 text-xs text-amber-800">
                    Add <strong>Fill Size</strong> as <span className="font-mono">50g</span> or <span className="font-mono">50ml</span> on Specs & Regulatory to auto-fill net here next time.
                  </p>
                </div>
              )}

              <div className="mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50/80 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                      Import from Formula BOM
                    </p>
                    <p className="text-[11px] text-blue-900/80 mt-0.5">
                      Derives per-unit RM quantities from Formula BOM <strong>% w/w</strong> on the previous step (must total 100%). Uses net per unit from Fill Size or manual limit above.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={importSkuBomFromFormulaBom}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-blue-300 bg-white text-blue-900 hover:bg-blue-100 shrink-0"
                    title="Populate SKU BOM from Formula % w/w and net per-unit qty"
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5" />
                    Import from Formula BOM
                  </button>
                </div>
              </div>

              {skuBomValidation.ok && skuBomValidation.sumInDisplay != null ? (
                <p className="text-xs font-medium text-emerald-700 mb-3">
                  SKU BOM total {skuBomValidation.sumInDisplay.toFixed(4)} {skuBomValidation.displayUom} — matches limit.
                </p>
              ) : !skuBomValidation.ok ? (
                <p className="text-xs font-medium text-red-600 mb-3">{skuBomValidation.error}</p>
              ) : (
                <p className="text-xs text-slate-500 mb-3">Leave lines empty if you do not use SKU-level RM.</p>
              )}

              <div className="mb-4 space-y-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
                <div className="grid min-w-[480px] grid-cols-4 gap-2 text-xs font-semibold text-slate-600 uppercase sm:min-w-0">
                  <div>INCI / Raw Material</div>
                  <div>Qty / unit</div>
                  <div>UOM</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="space-y-2">
                  {formData.skuBomLines.map((row) => (
                    <div
                      key={row.id}
                      className={`grid min-w-[480px] grid-cols-4 gap-2 text-sm items-center p-2 rounded sm:min-w-0 ${
                        row.id === editingSkuLineId ? 'bg-violet-50 ring-2 ring-violet-200' : 'bg-slate-50'
                      }`}
                    >
                      <div className="text-slate-900">
                        {row.inciName}
                        {row.rmCode ? <span className="block text-[10px] font-mono text-violet-700">{row.rmCode}</span> : null}
                      </div>
                      <div className="text-slate-800 font-mono">{row.qtyPerUnit}</div>
                      <div className="text-slate-600">{row.uom}</div>
                      <div className="flex justify-end items-center gap-1">
                        <button
                          type="button"
                          onClick={() => beginEditSkuLine(row.id)}
                          className="text-violet-700 hover:text-violet-900 p-1 rounded"
                          title="Edit line"
                          aria-label="Edit line"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSkuLine(row.id)}
                          className="text-red-600 hover:text-red-800 p-1 rounded"
                          title="Remove line"
                          aria-label="Remove line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div ref={skuDraftRef} className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {editingSkuLineId ? 'Edit SKU BOM line' : 'New SKU BOM line'}
                  </p>
                  {editingSkuLineId ? (
                    <button type="button" onClick={cancelSkuLineEdit} className="text-xs text-slate-600 hover:text-slate-900 underline">
                      Cancel edit
                    </button>
                  ) : null}
                </div>
                <RmMasterTypeahead
                  options={skuRmTypeaheadOptions}
                  value={skuRmQuery}
                  loading={masterLoading}
                  selectedId={selectedSkuRmId}
                  onValueChange={(next) => {
                    setSkuRmQuery(next);
                    setTempSkuLine((prev) => ({ ...prev, inciName: next }));
                  }}
                  onSelect={(opt) => {
                    setSelectedSkuRmId(opt.id);
                    setSkuRmQuery(opt.label);
                    const rm = rawMaterialById.get(opt.id);
                    setTempSkuLine((prev) => ({
                      ...prev,
                      inciName: rm ? (rm.inci || rm.name || opt.label) : opt.label,
                      uom: prev.uom || rm?.uom || 'GM',
                    }));
                  }}
                  onClearSelection={() => setSelectedSkuRmId('')}
                  placeholder="Search RM by code or INCI — pick from list or type manual name"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="Qty per 1 unit of product"
                    value={tempSkuLine.qtyPerUnit}
                    onChange={(e) => setTempSkuLine((prev) => ({ ...prev, qtyPerUnit: e.target.value }))}
                    className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                  />
                  <select
                    value={tempSkuLine.uom}
                    onChange={(e) => setTempSkuLine((prev) => ({ ...prev, uom: e.target.value }))}
                    className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                  >
                    <option value="GM">GM / G</option>
                    <option value="KG">KG</option>
                    <option value="ML">ML</option>
                    <option value="L">L</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={addSkuLine}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-violet-200 text-violet-800 rounded-lg text-sm font-semibold hover:bg-violet-50"
                >
                  {editingSkuLineId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {editingSkuLineId ? 'Update SKU BOM line' : 'Add to SKU BOM'}
                </button>
              </div>
            </div>
        );
      }
      case 3:
        return (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">PACKAGING BOM</label>
                <p className="text-xs text-slate-600 mb-3">
                  List primary, secondary, and label components. Rows are added only when you click the Add button.
                </p>

                <div className="mb-4 space-y-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
                  <div className="grid min-w-[480px] grid-cols-4 gap-2 text-xs font-semibold text-slate-600 uppercase sm:min-w-0">
                    <div className="col-span-2">PM Description</div>
                    <div>Type</div>
                    <div>Qty / Unit</div>
                  </div>
                  <div className="space-y-2">
                    {formData.packingComponents.map(comp => (
                      <div
                        key={comp.id}
                        className={`grid min-w-[480px] grid-cols-4 gap-2 text-sm items-center p-2 rounded sm:min-w-0 ${
                          comp.id === editingComponentId ? 'bg-blue-50 ring-2 ring-blue-200' : 'bg-slate-50'
                        }`}
                      >
                        <div className="col-span-2 text-slate-900">{comp.pmDescription}</div>
                        <div className="text-slate-600">{comp.type}</div>
                        <div className="flex justify-end items-center gap-1">
                          <span className="text-slate-600 mr-auto">{comp.qtyUnit}</span>
                          <button
                            type="button"
                            onClick={() => beginEditComponent(comp.id)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded"
                            title="Edit line"
                            aria-label="Edit line"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeComponent(comp.id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded"
                            title="Remove line"
                            aria-label="Remove line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  ref={packDraftRef}
                  className="border border-slate-200 rounded-lg p-3 bg-white space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {editingComponentId ? 'Edit line' : 'New line'}
                    </p>
                    {editingComponentId ? (
                      <button type="button" onClick={cancelComponentEdit} className="text-xs text-slate-600 hover:text-slate-900 underline">
                        Cancel edit
                      </button>
                    ) : null}
                  </div>
                  <PmMasterTypeahead
                    className="sm:col-span-2"
                    options={packPmTypeaheadOptions}
                    value={packPmQuery}
                    loading={masterLoading}
                    selectedId={selectedPmId}
                    onValueChange={(next) => {
                      setPackPmQuery(next);
                      setTempComponent((prev) => ({ ...prev, pmDescription: next }));
                    }}
                    onSelect={(opt) => {
                      setSelectedPmId(opt.id);
                      setPackPmQuery(opt.label);
                      const pm = packMaterialById.get(opt.id);
                      setTempComponent((prev) => ({
                        ...prev,
                        pmDescription: pm ? (pm.description || opt.label) : opt.label,
                        type: prev.type || pm?.level || pm?.type || '',
                        uom: prev.uom || pm?.unit || 'PCS',
                      }));
                    }}
                    onClearSelection={() => setSelectedPmId('')}
                    placeholder="Search PM by code or description — pick from list or type manual name"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Type"
                      value={tempComponent.type}
                      onChange={(e) => setTempComponent(prev => ({ ...prev, type: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Qty / Unit"
                      value={tempComponent.qtyUnit}
                      onChange={(e) => setTempComponent(prev => ({ ...prev, qtyUnit: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="UOM"
                      value={tempComponent.uom}
                      onChange={(e) => setTempComponent(prev => ({ ...prev, uom: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={addComponent}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50"
                  >
                    {editingComponentId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingComponentId ? 'Update component' : 'Add component to list'}
                  </button>
                </div>
              </div>
            </div>
        );
      case 4:
        return (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">MANUFACTURING PROCESS STEPS</label>
                <p className="text-xs text-slate-600 mb-3">
                  Steps are added when you leave the fields below (or use Ctrl+Enter in the instruction box). Instruction is required.
                </p>

                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-600 uppercase">
                    <div>Step</div>
                    <div className="col-span-2">Step Description / Instruction</div>
                  </div>
                  <div className="space-y-2">
                    {formData.processSteps.map(step => (
                      <div key={step.id} className="grid grid-cols-3 gap-2 text-sm items-start bg-slate-50 p-2 rounded">
                        <div className="text-slate-900 font-semibold">{step.stepNumber}</div>
                        <div className="col-span-2 flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <div className="text-slate-900">{step.instruction}</div>
                            <div className="text-xs text-slate-600 mt-1">Duration: {step.duration}</div>
                          </div>
                          <button type="button" onClick={() => removeStep(step.id)} className="text-red-600 hover:text-red-800">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  ref={stepDraftRef}
                  className="border border-slate-200 rounded-lg p-3 bg-white space-y-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && (e.target as HTMLElement).tagName === 'TEXTAREA') {
                      e.preventDefault();
                      addStep();
                    }
                  }}
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">New step</p>
                  <input
                    type="text"
                    placeholder="Step #"
                    value={tempStep.stepNumber}
                    onChange={(e) => setTempStep(prev => ({ ...prev, stepNumber: e.target.value }))}
                    onBlur={() => runOnDraftLeave(stepDraftRef, flushStepDraft)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                  />
                  <textarea
                    placeholder="Step Description / Instruction (Ctrl+Enter to add)"
                    value={tempStep.instruction}
                    onChange={(e) => setTempStep(prev => ({ ...prev, instruction: e.target.value }))}
                    onBlur={() => runOnDraftLeave(stepDraftRef, flushStepDraft)}
                    rows={2}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g., 15 mins)"
                    value={tempStep.duration}
                    onChange={(e) => setTempStep(prev => ({ ...prev, duration: e.target.value }))}
                    onBlur={() => runOnDraftLeave(stepDraftRef, flushStepDraft)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addStep();
                      }
                    }}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                  />
                </div>

                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={addStep}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50"
                  >
                    <Plus className="w-4 h-4" /> Add step to list
                  </button>
                </div>
              </div>
            </div>
        );
      case 5:
        return (
            <div className="space-y-6">
              <div className="space-y-4 border border-slate-200 rounded-lg p-3 sm:p-4 bg-white">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Optional — business, storage & Zoho</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Brand / Client</label>
                    <select
                      value={formData.brandClient}
                      onChange={(e) => handleInputChange('brandClient', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">Select brand / client</option>
                      <option value="EI Own Brand">EI Own Brand</option>
                      <option value="Client A">Client A</option>
                      <option value="Client B">Client B</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pack Configuration</label>
                    <input
                      type="text"
                      placeholder="e.g. 1x50 tube"
                      value={formData.packConfiguration}
                      onChange={(e) => handleInputChange('packConfiguration', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="productForm">Product Form</label>
                    <select
                      id="productForm"
                      value={formData.productForm}
                      onChange={(e) => handleInputChange('productForm', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">Select product form</option>
                      {PR_PRODUCT_FORM_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                      {formData.productForm && !isCanonicalPrProductForm(formData.productForm) ? (
                        <option value={formData.productForm}>
                          {formData.productForm} (legacy)
                        </option>
                      ) : null}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="fillSize">Fill Size (in g or ml)</label>
                    <input
                      id="fillSize"
                      type="text"
                      placeholder="e.g. 50g or 50ml"
                      value={formData.fillSize}
                      onChange={(e) => handleInputChange('fillSize', normalizeFillSizeInput(e.target.value))}
                      aria-invalid={errors.fillSize ? true : undefined}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        errors.fillSize ? 'border-red-500 bg-red-50/40' : 'border-slate-200'
                      }`}
                    />
                    {errors.fillSize ? (
                      <p className="mt-1 text-xs text-red-600">{errors.fillSize}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">QC Inspection Group</label>
                    <select
                      value={formData.prQcGroup}
                      onChange={(e) => handleInputChange('prQcGroup', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select</option>
                      {PR_QC_GROUPS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Default Storage Location Type</label>
                    <select
                      value={formData.prDefaultStorageType}
                      onChange={(e) => handleInputChange('prDefaultStorageType', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select</option>
                      {PR_STORAGE_TYPES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  {!lockPrimaryFields ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">SKU for Zoho</label>
                    <input
                      type="text"
                      placeholder="Optional — defaults to internal PR code after save"
                      value={formData.skuForZoho}
                      onChange={(e) => handleInputChange('skuForZoho', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  ) : null}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Preference</label>
                    <select
                      value={formData.bomTaxPreference}
                      onChange={(e) => handleInputChange('bomTaxPreference', e.target.value)}
                      disabled={lockPrimaryFields}
                      className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${lockPrimaryFields ? 'bg-slate-100' : ''}`}
                    >
                      <option value="">Select tax preference</option>
                      {['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Returnable</label>
                    <div className="flex items-center gap-3 px-3 py-2 border border-slate-200 rounded-lg">
                      <input
                        type="checkbox"
                        checked={formData.bomReturnable}
                        onChange={(e) => handleInputChange('bomReturnable', e.target.checked)}
                      />
                      <span className="text-sm font-medium text-slate-700">Returnable Item</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Associated Items</label>
                    <textarea
                      value={formData.bomAssociateItems}
                      onChange={(e) => handleInputChange('bomAssociateItems', e.target.value)}
                      rows={2}
                      disabled={lockPrimaryFields}
                      placeholder="Link related BOM / RM / packaging if any"
                      className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${lockPrimaryFields ? 'bg-slate-100' : ''}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Zoho Item ID</label>
                  <input
                    type="text"
                    readOnly
                    autoComplete="off"
                    aria-readonly="true"
                    placeholder="Populated from the server after successful registration (when Books sync is on)"
                    value={formData.zohoId}
                    onChange={() => {}}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-800 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">Read-only — returned after a successful save.</p>
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-white">
                <label className="block text-sm font-semibold text-blue-700 mb-3">FINISHED PRODUCT SPECIFICATIONS</label>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">pH Range</label>
                      <input type="text" placeholder="e.g. 6.0-7.0" value={formData.phRange} onChange={(e) => handleInputChange('phRange', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Viscosity</label>
                      <input type="text" placeholder="e.g. 15,000-25,000" value={formData.viscosity} onChange={(e) => handleInputChange('viscosity', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Specific Gravity</label>
                      <input type="text" placeholder="e.g. 0.98-1.02" value={formData.specificGravity} onChange={(e) => handleInputChange('specificGravity', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Appearance</label>
                      <input type="text" placeholder="e.g. White smooth lotion" value={formData.appearance} onChange={(e) => handleInputChange('appearance', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-white">
                <label className="block text-sm font-semibold text-blue-700 mb-3">STABILITY PROTOCOL</label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Accelerated Stability</label>
                    <input type="text" placeholder="e.g. 6M completed PASS" value={formData.acceleratedStability} onChange={(e) => handleInputChange('acceleratedStability', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Intermediate Stability</label>
                    <input type="text" placeholder="e.g. 12M ongoing" value={formData.intermediateStability} onChange={(e) => handleInputChange('intermediateStability', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Long-term Stability</label>
                    <input type="text" placeholder="e.g. 24M ongoing" value={formData.longTermStability} onChange={(e) => handleInputChange('longTermStability', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-white">
                <label className="block text-sm font-semibold text-blue-700 mb-3">REGULATORY & CLAIMS</label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Applicable Regulation</label>
                    <select value={formData.applicableRegulation} onChange={(e) => handleInputChange('applicableRegulation', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="">APPLICABLE REGULATION</option>
                      <option value="India - BIS / CDSCO">India - BIS / CDSCO</option>
                      <option value="EU">EU</option>
                      <option value="USA - FDA">USA - FDA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">COSMOS / Natural Certification</label>
                    <select value={formData.cosmosNaturalCertification} onChange={(e) => handleInputChange('cosmosNaturalCertification', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="">COSMOS / NATURAL CERTIFICATION</option>
                      <option value="Not applicable">Not applicable</option>
                      <option value="COSMOS Organic">COSMOS Organic</option>
                      <option value="COSMOS Natural">COSMOS Natural</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Dermatologically Tested</label>
                    <select value={formData.dermatologicallyTested} onChange={(e) => handleInputChange('dermatologicallyTested', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="">DERMATOLOGICALLY TESTED</option>
                      <option value="Yes - certified">Yes - certified</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cruelty Free / Vegan</label>
                    <select value={formData.crueltyFreeVegan} onChange={(e) => handleInputChange('crueltyFreeVegan', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="">CRUELTY FREE / VEGAN</option>
                      <option value="Yes - certified">Yes - certified</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Approved Marketing Claims</label>
                    <textarea placeholder="e.g. Broad spectrum UVA+UVB, Niacinamide brightening..." value={formData.approvedMarketingClaims} onChange={(e) => handleInputChange('approvedMarketingClaims', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Claims Substantiation</label>
                    <textarea placeholder="SPF test ref, in-vitro study, clinical report ref no." value={formData.claimsSubstantiation} onChange={(e) => handleInputChange('claimsSubstantiation', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
              </div>
            </div>
        );
      default:
        return null;
    }
  };

  if (editLoading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center">
        <p className="text-gray-500">Loading product…</p>
      </div>
    );
  }

  return (
    <>
      <MasterFormBase
        title={productIdFromRoute ? 'Edit Product Registration (PR Master)' : 'New Product Registration (PR Master)'}
        stages={stages}
        currentStage={currentStage}
        onStageChange={setCurrentStage}
        errors={errors}
        formData={formData as unknown as Record<string, unknown>}
        onInputChange={() => {}}
        onSubmit={handleSubmit}
        nextDisabled={isNewProduct && !canAdvancePastPrimary}
        nextDisabledTitle="Complete PR category, sub-category, composite item, and product name on this step before continuing."
        isStageDisabled={(idx) => isNewProduct && idx > 0 && !canAdvancePastPrimary}
      >
        {renderStageContent()}
      </MasterFormBase>
      <MasterSubmitPreviewModal
        isOpen={submitPreviewOpen}
        onClose={() => {
          if (submitConfirming) return;
          setSubmitPreviewOpen(false);
          setPendingPrSubmit(null);
        }}
        onConfirm={handleConfirmSubmit}
        title={
          productIdFromRoute ? 'Preview — update product (PR)' : 'Preview — new product registration (PR)'
        }
        sections={prPreviewSections}
        confirming={submitConfirming}
        isEdit={!!productIdFromRoute}
      />
    </>
  );
};

export default BOMForm;
