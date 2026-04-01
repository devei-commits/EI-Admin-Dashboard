import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Plus, Trash2 } from 'lucide-react';
import MasterFormBase from '../components/MasterFormBase';
import { fetchNextBomCode } from '../services/bom.service';
import { fetchRawMaterialsList, type RawMaterialRecord } from '../services/rawMaterials.service';
import { fetchPackMaterialsList, type PackMaterialRecord } from '../services/packMaterials.service';
import {
  createPRRegistration,
  fetchPRProductDetail,
  updatePRProduct,
  type PRProductDetail,
} from '../services/productsMaster.service';

// ─── PR Category Code Series (finished goods / PR master) ────────────────────
const PR_CATEGORIES: Record<string, { label: string; prefix: string }> = {
  SKC: { label: 'Skincare (FG)', prefix: 'EI-PR-SKC' },
  HRC: { label: 'Haircare (FG)', prefix: 'EI-PR-HRC' },
  BDY: { label: 'Bodycare (FG)', prefix: 'EI-PR-BDY' },
  SUN: { label: 'Sun care (FG)', prefix: 'EI-PR-SUN' },
  OTC: { label: 'OTC / Derma (FG)', prefix: 'EI-PR-OTC' },
  COL: { label: 'Colour cosmetics (FG)', prefix: 'EI-PR-COL' },
  MISC: { label: 'Miscellaneous (FG)', prefix: 'EI-PR-MISC' },
};

const PR_QC_GROUPS = ['Chemical QC', 'Microbiology', 'Physical QC', 'Packaging QC', 'Incoming QA'];
const PR_STORAGE_TYPES = ['Ambient – Dry', 'Ambient – Cool', 'Refrigerated (2–8°C)', 'Frozen', 'Flammable Store'];

interface BOMFormState {
  // Identity & coding (step 0)
  prCategoryKey: string;
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
  mrp: string;
  zohoId: string;
  skuForZoho: string;
  bomTaxPreference: string;
  bomReturnable: boolean;
  bomAssociateItems: string;

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
    prCategoryKey: '',
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
    mrp: '',
    zohoId: '',
    skuForZoho: '',
    bomTaxPreference: 'Taxable',
    bomReturnable: false,
    bomAssociateItems: '',
    formulaIngredients: [],
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

function mockBomForm(): BOMFormState {
  return {
    prCategoryKey: 'SUN',
    prQcGroup: 'Chemical QC',
    prSubCategory: 'Broad spectrum lotion',
    prDefaultStorageType: 'Ambient – Cool',
    productName: 'EI Sunscreen Lotion SPF50+ PA++++',
    category: 'Sunscreen',
    productForm: 'Lotion',
    brandClient: 'Esthetic Insights',
    fillSize: '50ml',
    packConfiguration: 'Bottle + Cap',
    skuCode: 'EI-PR-SUN-00001',
    mrp: '₹499',
    zohoId: '',
    skuForZoho: '',
    bomTaxPreference: 'Taxable',
    bomReturnable: false,
    bomAssociateItems: '',
    formulaIngredients: [
      { id: '1', inciName: 'Zinc Oxide', phase: 'Oil', percentWW: '15', uom: 'GM' },
      { id: '2', inciName: 'Titanium Dioxide', phase: 'Oil', percentWW: '10', uom: 'GM' },
      { id: '3', inciName: 'Cetyl Alcohol', phase: 'Oil', percentWW: '5', uom: 'GM' },
      { id: '4', inciName: 'Glycerin', phase: 'Water', percentWW: '5', uom: 'GM' },
    ],
    packingComponents: [
      { id: '1', pmDescription: '50ml White Bottle', type: 'Primary Container', qtyUnit: '1', uom: 'PCS' },
      { id: '2', pmDescription: 'White Cap with Pump', type: 'Closure', qtyUnit: '1', uom: 'PCS' },
      { id: '3', pmDescription: 'Product Label', type: 'Label', qtyUnit: '1', uom: 'PCS' },
    ],
    processSteps: [
      { id: '1', stepNumber: '1', instruction: 'Mix oils in reactor at 60°C', duration: '30 min' },
      { id: '2', stepNumber: '2', instruction: 'Add water phase slowly with stirring', duration: '15 min' },
      { id: '3', stepNumber: '3', instruction: 'Cool to 25°C', duration: '45 min' },
    ],
    phRange: '6.0-7.0',
    viscosity: '8000-12000 CPS',
    specificGravity: '0.95-1.02',
    appearance: 'White smooth lotion',
    odour: 'Pleasant fragrance',
    fillWeightSpec: '50 ± 2g',
    microbialLimits: 'TVC < 1000 cfu/g',
    sppRating: 'SPF 50+',
    acceleratedStability: '6M/40°C/75%RH - PASS',
    intermediateStability: '9M/30°C/65%RH - PASS',
    longTermStability: '12M/25°C/60%RH - PASS',
    phototability: 'ICH Q1B PASS',
    freezeThawCycles: '3 cycles PASS',
    applicableRegulation: 'India - BIS / CDSCO',
    cosmosNaturalCertification: 'Not applicable',
    dermatologicallyTested: 'Yes - certified',
    crueltyFreeVegan: 'No',
    approvedMarketingClaims: 'Broad spectrum UVA+UVB protection, Non-greasy formula, Dermatologist tested',
    claimsSubstantiation: 'SPF test ref: SPF-2024-001, Clinical report on file',
  };
}

interface BOMFormProps {
  /** When provided, used instead of route param `:id` (enables modal editing). */
  productId?: string;
  onClose?: () => void;
  onSaved?: () => void;
}

function inferPrCategoryKeyFromCode(code: string): string {
  if (!code) return '';
  for (const [k, v] of Object.entries(PR_CATEGORIES)) {
    if (code.startsWith(`${v.prefix}-`) || code === v.prefix) return k;
  }
  return '';
}

function hasMeaningfulFormulaLine(fd: BOMFormState): boolean {
  return fd.formulaIngredients.some((ing) => Boolean(ing.inciName.trim()));
}

function hasMeaningfulPackLine(fd: BOMFormState): boolean {
  return fd.packingComponents.some((c) => Boolean(c.pmDescription.trim()));
}

function isFormulaTotalValid(fd: BOMFormState): boolean {
  const total = fd.formulaIngredients.reduce((sum, ing) => {
    const n = parseFloat(String(ing.percentWW).replace(/[^\d.-]/g, ''));
    return sum + (Number.isNaN(n) ? 0 : n);
  }, 0);
  return Math.abs(total - 100) <= 0.001;
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
  return {
    product_name: fd.productName.trim(),
    name: fd.productName.trim(),
    product_code: fd.skuCode.trim(),
    bomCode: fd.skuCode.trim(),
    category: fd.category || null,
    form: fd.productForm || null,
    type: fd.productForm || null,
    client: fd.brandClient || null,
    fill_size: fd.fillSize || null,
    packSize: fd.fillSize || null,
    product_sku: (fd.skuForZoho?.trim() || fd.skuCode).trim(),
    bomSku: (fd.skuForZoho?.trim() || fd.skuCode).trim(),
    zoho_id: fd.zohoId?.trim() || null,
    bom_tax_preference: fd.bomTaxPreference || null,
    bom_returnable: fd.bomReturnable,
    bom_associate_items: fd.bomAssociateItems?.trim() || null,
    status: 'Draft',
    pr_qc_group: fd.prQcGroup || null,
    pr_sub_category: fd.prSubCategory || null,
    storage_conditions: fd.prDefaultStorageType || null,
    mrp: fd.mrp || null,
    rm_lines: bomFormToRmLines(fd),
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
    product_sku: (fd.skuForZoho?.trim() || fd.skuCode).trim(),
    category: fd.category || null,
    form: fd.productForm || null,
    fill_size: fd.fillSize || null,
    storage_conditions: fd.prDefaultStorageType || null,
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
      pm_lines: bomFormToPmLines(fd),
      process_steps: bomFormToProcessSteps(fd),
      ph_range: fd.phRange || null,
      stability_summary: fd.longTermStability || null,
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
  const inferred = inferPrCategoryKeyFromCode(skuCode);
  return {
    ...emptyBomForm(),
    prCategoryKey: inferred,
    productName: p.product_name || '',
    category: p.category || '',
    productForm: p.form || '',
    fillSize: p.fill_size || '',
    skuCode,
    mrp: p.mrp_price != null ? `₹${p.mrp_price}` : '',
    formulaIngredients,
    packingComponents,
    processSteps,
    phRange: p.ph_range || '',
    viscosity: p.viscosity_range || '',
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
  const [generatedPrCode, setGeneratedPrCode] = useState('');
  const focusPrField = useCallback((target: 'prCategoryKey' | 'skuCode' | 'productName' | 'formula' | 'pack') => {
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
  const [tempComponent, setTempComponent] = useState({ pmDescription: '', type: '', qtyUnit: '', uom: '' });
  const [tempStep, setTempStep] = useState({ stepNumber: '', instruction: '', duration: '' });
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRecord[]>([]);
  const [packMaterials, setPackMaterials] = useState<PackMaterialRecord[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);
  const [selectedRmId, setSelectedRmId] = useState<string>('');
  const [selectedPmId, setSelectedPmId] = useState<string>('');

  const stages = [
    'Identity & coding',
    'Formula BOM',
    'Pack BOM',
    'Process Steps',
    'Specs & Regulatory',
  ];

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
  const selectedPmIds = useMemo(
    () => new Set(formData.packingComponents.map((c) => String(c.packMaterialId || '')).filter(Boolean)),
    [formData.packingComponents]
  );

  const ingredientDraftRef = useRef<HTMLDivElement>(null);
  const packDraftRef = useRef<HTMLDivElement>(null);
  const stepDraftRef = useRef<HTMLDivElement>(null);

  const formulaPercentTotal = useMemo(() => {
    return formData.formulaIngredients.reduce((sum, ing) => {
      const n = parseFloat(String(ing.percentWW).replace(/[^\d.-]/g, ''));
      return sum + (Number.isNaN(n) ? 0 : n);
    }, 0);
  }, [formData.formulaIngredients]);

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
        setGeneratedPrCode(next.skuCode || '');
      }
    }).catch(() => {
      if (!cancelled) setEditLoading(false);
    });
    return () => { cancelled = true; };
  }, [productIdFromRoute]);

  const handleInputChange = (field: keyof BOMFormState, value: unknown) => {
    if (field === 'prCategoryKey') {
      setFormData((prev) => ({ ...prev, prCategoryKey: value as string }));
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getPrCodePreview = () => {
    const cat = formData.prCategoryKey ? PR_CATEGORIES[formData.prCategoryKey] : null;
    if (!cat) return { prefix: '—', next: '—' };
    if (generatedPrCode && generatedPrCode.startsWith(cat.prefix)) {
      const suffix = generatedPrCode.slice(cat.prefix.length).replace(/^-+/, '') || '—';
      return { prefix: cat.prefix, next: suffix };
    }
    return { prefix: cat.prefix, next: '…' };
  };

  const generatePrCode = async (confirm = false) => {
    if (!formData.prCategoryKey) {
      addToast('error', 'Select a PR Category first');
      return;
    }
    if (generatedPrCode && !confirm) {
      const ok = window.confirm('A code is already generated. Regenerate? This must be controlled after approvals.');
      if (!ok) return;
    }
    const cat = PR_CATEGORIES[formData.prCategoryKey];
    try {
      const code = await fetchNextBomCode(cat.prefix);
      setGeneratedPrCode(code);
      setFormData((prev) => ({ ...prev, skuCode: code }));
      addToast('success', `Code generated: ${code}`);
    } catch (err) {
      console.error(err);
      addToast('error', err instanceof Error ? err.message : 'Failed to generate code');
    }
  };

  const fillMockData = () => {
    const mock = mockBomForm();
    setFormData(mock);
    setGeneratedPrCode(mock.skuCode);
    addToast('success', 'Form filled with mock data for testing!');
  };

  const flushIngredientDraft = (): boolean => {
    const rm = selectedRmId ? rawMaterialById.get(String(selectedRmId)) : undefined;
    if (!rm && !tempIngredient.inciName.trim()) return false;
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
          inciName: rm ? (rm.inci || rm.name || tempIngredient.inciName) : tempIngredient.inciName,
          phase: tempIngredient.phase,
          percentWW: tempIngredient.percentWW,
          // Keep operator-selected UOM; fallback to RM UOM only if no explicit input.
          uom: tempIngredient.uom || rm?.uom || 'GM',
        },
      ],
    }));
    setSelectedRmId('');
    setTempIngredient({ inciName: '', phase: '', percentWW: '', uom: 'GM' });
    return true;
  };

  const addIngredient = () => {
    flushIngredientDraft();
  };

  const removeIngredient = (id: string) => {
    setFormData(prev => ({
      ...prev,
      formulaIngredients: prev.formulaIngredients.filter(item => item.id !== id)
    }));
  };

  const flushComponentDraft = (): boolean => {
    const pm = selectedPmId ? packMaterialById.get(String(selectedPmId)) : undefined;
    if (!pm && !tempComponent.pmDescription.trim()) return false;
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
          pmDescription: pm ? (pm.description || tempComponent.pmDescription) : tempComponent.pmDescription,
          type: tempComponent.type || pm?.level || pm?.type || '',
          qtyUnit: tempComponent.qtyUnit,
          uom: tempComponent.uom || pm?.unit || 'PCS',
        },
      ],
    }));
    setSelectedPmId('');
    setTempComponent({ pmDescription: '', type: '', qtyUnit: '', uom: '' });
    return true;
  };

  const addComponent = () => {
    flushComponentDraft();
  };

  const removeComponent = (id: string) => {
    setFormData(prev => ({
      ...prev,
      packingComponents: prev.packingComponents.filter(item => item.id !== id)
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

  const handleSubmit = async () => {
    setErrors({});
    if (!formData.prCategoryKey.trim()) {
      setErrors({ prCategoryKey: 'Select a PR Category' });
      addToast('error', 'Select a PR Category (Identity & coding)');
      setCurrentStage(0);
      focusPrField('prCategoryKey');
      return;
    }
    if (!formData.productName.trim()) {
      setErrors({ productName: 'Product Name is required' });
      addToast('error', 'Product Name is required');
      setCurrentStage(0);
      focusPrField('productName');
      return;
    }
    if (!formData.category.trim()) {
      setErrors({ category: 'Category is required' });
      addToast('error', 'Category is required');
      setCurrentStage(0);
      window.setTimeout(() => {
        const el = document.getElementById('category');
        if (el instanceof HTMLElement) el.focus();
      }, 0);
      return;
    }
    if (!formData.productForm.trim()) {
      setErrors({ productForm: 'Product Form is required' });
      addToast('error', 'Product Form is required');
      setCurrentStage(0);
      window.setTimeout(() => {
        const el = document.getElementById('productForm');
        if (el instanceof HTMLElement) el.focus();
      }, 0);
      return;
    }
    if (!formData.fillSize.trim()) {
      setErrors({ fillSize: 'Fill Size is required' });
      addToast('error', 'Fill Size is required');
      setCurrentStage(0);
      window.setTimeout(() => {
        const el = document.getElementById('fillSize');
        if (el instanceof HTMLElement) el.focus();
      }, 0);
      return;
    }
    if (!productIdFromRoute) {
      if (!formData.skuCode.trim()) {
        setErrors({ skuCode: 'Generate or enter PR / BOM code' });
        addToast('error', 'Generate or enter PR code before submitting');
        setCurrentStage(0);
        focusPrField('skuCode');
        return;
      }
    }

    if (formData.fillSize.trim() && !isValidFillSizeInput(formData.fillSize)) {
      setErrors({ fillSize: 'Fill Size must be in g or ml format' });
      addToast('error', 'Fill Size must be in g or ml format (example: 50g or 50ml)');
      setCurrentStage(0);
      window.setTimeout(() => {
        const el = document.getElementById('fillSize');
        if (el instanceof HTMLElement) el.focus();
      }, 0);
      return;
    }

    if (!hasMeaningfulFormulaLine(formData)) {
      setErrors({ formula: 'Add at least one formula ingredient' });
      addToast('error', 'Add at least one formula ingredient (INCI name or % w/w) in Formula BOM.');
      setCurrentStage(1);
      focusPrField('formula');
      return;
    }
    if (!isFormulaTotalValid(formData)) {
      setErrors({ formulaPercentTotal: 'Formula BOM total must be exactly 100%' });
      addToast('error', 'Formula BOM % w/w total must be exactly 100%');
      setCurrentStage(1);
      focusPrField('formula');
      return;
    }
    if (!hasMeaningfulPackLine(formData)) {
      setErrors({ pack: 'Add at least one packaging component' });
      addToast('error', 'Add at least one packaging component (description) in Pack BOM.');
      setCurrentStage(2);
      focusPrField('pack');
      return;
    }

    try {
      if (productIdFromRoute) {
        const res = await updatePRProduct(productIdFromRoute, buildPrUpdateBody(formData));
        if (res.success) {
          addToast('success', 'Product updated successfully!');
          onSaved?.();
          if (onClose) onClose();
          else navigate('/bom');
        } else {
          addToast('error', typeof res.error === 'string' ? res.error : 'Failed to update product');
        }
        return;
      }

      const res = await createPRRegistration(buildPrRegistrationBody(formData));
      if (res.success) {
        addToast('success', 'Product registered — saved to Products (PR) master.');
        onSaved?.();
        if (onClose) onClose();
        else navigate('/bom');
      } else {
        addToast('error', typeof res.error === 'string' ? res.error : 'Failed to register product');
      }
    } catch (err) {
      console.error(err);
      addToast('error', err instanceof Error ? err.message : 'Save failed');
    }
  };

  const renderStageContent = () => {
    const { prefix, next } = getPrCodePreview();

    switch (currentStage) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
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

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">PR Category (Industry Buckets)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PR Category <span className="text-red-600">*</span></label>
                  <select
                    id="prCategoryKey"
                    value={formData.prCategoryKey}
                    onChange={(e) => handleInputChange('prCategoryKey', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select</option>
                    {Object.entries(PR_CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">QC Inspection Group</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub‑Category <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={formData.prSubCategory}
                    onChange={(e) => handleInputChange('prSubCategory', e.target.value)}
                    placeholder="e.g. Anti‑acne serum / Kids shampoo / SPF 50 lotion"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Storage Location Type</label>
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
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Code Series Preview</h3>
              <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center gap-6 mb-4 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Series Prefix</p>
                    <p className="font-mono font-bold text-gray-800 text-sm">{prefix}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Next Code (preview)</p>
                    <p className="font-mono font-bold text-gray-800 text-sm">{prefix !== '—' ? `${prefix}-${next}` : '—'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => generatePrCode()}
                    className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
                  >
                    Generate Code Now
                  </button>
                  {generatedPrCode && (
                    <button
                      type="button"
                      onClick={() => generatePrCode(true)}
                      className="px-4 py-1.5 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition"
                    >
                      Regenerate (change category)
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-3">Code is stored as PR / BOM code (bom_code). Edit below if needed.</p>
              </div>
            </div>

            <div>
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Category (Formulation) <span className="text-red-600">*</span></label>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">Select category</option>
                      <option value="Sunscreen">Sunscreen</option>
                      <option value="Face Wash">Face Wash</option>
                      <option value="Serum">Serum</option>
                      <option value="Cream">Cream</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Product Form <span className="text-red-600">*</span></label>
                    <select
                      id="productForm"
                      value={formData.productForm}
                      onChange={(e) => handleInputChange('productForm', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">Select product form</option>
                      <option value="Lotion/Cream">Lotion/Cream</option>
                      <option value="Gel">Gel</option>
                      <option value="Serum">Serum</option>
                      <option value="Oil">Oil</option>
                    </select>
                  </div>
                </div>

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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fill Size (in g or ml) <span className="text-red-600">*</span></label>
                    <input
                      id="fillSize"
                      type="text"
                      placeholder="e.g. 50g or 50ml"
                      value={formData.fillSize}
                      onChange={(e) => handleInputChange('fillSize', normalizeFillSizeInput(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
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
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">PR / BOM Code <span className="text-red-600">*</span></label>
                    <input
                      id="skuCode"
                      type="text"
                      placeholder="PR / BOM code (generate above)"
                      value={formData.skuCode}
                      onChange={(e) => handleInputChange('skuCode', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">MRP Price</label>
                    <input
                      type="text"
                      placeholder="e.g. Rs.499"
                      value={formData.mrp}
                      onChange={(e) => handleInputChange('mrp', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Zoho Item ID</label>
                    <input
                      type="text"
                      placeholder="Zoho item id (sync TODO)"
                      value={formData.zohoId}
                      onChange={(e) => handleInputChange('zohoId', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">SKU for Zoho</label>
                    <input
                      type="text"
                      placeholder="SKU (for Zoho) - optional (defaults to PR code)"
                      value={formData.skuForZoho}
                      onChange={(e) => handleInputChange('skuForZoho', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Preference</label>
                    <select
                      value={formData.bomTaxPreference}
                      onChange={(e) => handleInputChange('bomTaxPreference', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">Select tax preference</option>
                      {['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

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
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Associated Items</label>
                  <textarea
                    value={formData.bomAssociateItems}
                    onChange={(e) => handleInputChange('bomAssociateItems', e.target.value)}
                    rows={2}
                    placeholder="Link related BOM / RM / packaging if any"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
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
                <p className="text-xs text-slate-600 mb-3">
                  Add ingredients in phase order. Rows are saved when you leave the fields below or press Enter (total should equal 100%).
                </p>

                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-600 uppercase">
                    <div>INCI Name / Raw Material</div>
                    <div>Phase</div>
                    <div>% W/W</div>
                    <div>UOM</div>
                  </div>
                  <div className="space-y-2">
                    {formData.formulaIngredients.map(ing => (
                      <div key={ing.id} className="grid grid-cols-4 gap-2 text-sm items-center bg-slate-50 p-2 rounded">
                        <div className="text-slate-900">{ing.inciName}</div>
                        <div className="text-slate-600">{ing.phase}</div>
                        <div className="text-slate-600">{ing.percentWW}</div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">{ing.uom}</span>
                          <button type="button" onClick={() => removeIngredient(ing.id)} className="text-red-600 hover:text-red-800">
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
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
                    e.preventDefault();
                    addIngredient();
                  }}
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">New line</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={selectedRmId}
                      onChange={(e) => setSelectedRmId(e.target.value)}
                      onBlur={() => runOnDraftLeave(ingredientDraftRef, flushIngredientDraft)}
                      disabled={masterLoading}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                    >
                      <option value="">{masterLoading ? 'Loading raw materials…' : 'Select Raw Material (RM master)'}</option>
                      {rawMaterials.map((rm) => (
                        <option key={rm.id} value={rm.id} disabled={selectedRmIds.has(String(rm.id)) && String(selectedRmId) !== String(rm.id)}>
                          {rm.code} — {rm.inci || rm.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Or type INCI Name (manual)"
                      value={tempIngredient.inciName}
                      onChange={(e) => setTempIngredient(prev => ({ ...prev, inciName: e.target.value }))}
                      onBlur={() => runOnDraftLeave(ingredientDraftRef, flushIngredientDraft)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Phase"
                      value={tempIngredient.phase}
                      onChange={(e) => setTempIngredient(prev => ({ ...prev, phase: e.target.value }))}
                      onBlur={() => runOnDraftLeave(ingredientDraftRef, flushIngredientDraft)}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                    <input
                      type="number"
                      placeholder="% W/W"
                      value={tempIngredient.percentWW}
                      onChange={(e) => setTempIngredient(prev => ({ ...prev, percentWW: e.target.value }))}
                      onBlur={() => runOnDraftLeave(ingredientDraftRef, flushIngredientDraft)}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                    <select
                      value={tempIngredient.uom}
                      onChange={(e) => setTempIngredient(prev => ({ ...prev, uom: e.target.value }))}
                      onBlur={() => runOnDraftLeave(ingredientDraftRef, flushIngredientDraft)}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    >
                      <option>GM</option>
                      <option>ML</option>
                      <option>KG</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                  <p className="text-xs text-slate-600">
                    Total (saved lines): <span className={`font-semibold ${Math.abs(formulaPercentTotal - 100) <= 0.001 ? 'text-blue-600' : 'text-red-600'}`}>{formulaPercentTotal.toFixed(2)}%</span>
                  </p>
                  <button
                    type="button"
                    onClick={addIngredient}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50"
                  >
                    <Plus className="w-4 h-4" /> Add ingredient to list
                  </button>
                </div>
              </div>
            </div>
        );
      case 2:
        return (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">PACKAGING BOM</label>
                <p className="text-xs text-slate-600 mb-3">
                  List primary, secondary, and label components. Rows save when you leave the fields below or press Enter.
                </p>

                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-600 uppercase">
                    <div className="col-span-2">PM Description</div>
                    <div>Type</div>
                    <div>Qty / Unit</div>
                  </div>
                  <div className="space-y-2">
                    {formData.packingComponents.map(comp => (
                      <div key={comp.id} className="grid grid-cols-4 gap-2 text-sm items-center bg-slate-50 p-2 rounded">
                        <div className="col-span-2 text-slate-900">{comp.pmDescription}</div>
                        <div className="text-slate-600">{comp.type}</div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">{comp.qtyUnit}</span>
                          <button type="button" onClick={() => removeComponent(comp.id)} className="text-red-600 hover:text-red-800">
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
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    addComponent();
                  }}
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">New line</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={selectedPmId}
                      onChange={(e) => setSelectedPmId(e.target.value)}
                      onBlur={() => runOnDraftLeave(packDraftRef, flushComponentDraft)}
                      disabled={masterLoading}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                    >
                      <option value="">{masterLoading ? 'Loading pack materials…' : 'Select Pack Material (PM master)'}</option>
                      {packMaterials.map((pm) => (
                        <option key={pm.id} value={pm.id} disabled={selectedPmIds.has(String(pm.id)) && String(selectedPmId) !== String(pm.id)}>
                          {pm.code} — {pm.description}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Or type PM Description (manual)"
                      value={tempComponent.pmDescription}
                      onChange={(e) => setTempComponent(prev => ({ ...prev, pmDescription: e.target.value }))}
                      onBlur={() => runOnDraftLeave(packDraftRef, flushComponentDraft)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Type"
                      value={tempComponent.type}
                      onChange={(e) => setTempComponent(prev => ({ ...prev, type: e.target.value }))}
                      onBlur={() => runOnDraftLeave(packDraftRef, flushComponentDraft)}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Qty / Unit"
                      value={tempComponent.qtyUnit}
                      onChange={(e) => setTempComponent(prev => ({ ...prev, qtyUnit: e.target.value }))}
                      onBlur={() => runOnDraftLeave(packDraftRef, flushComponentDraft)}
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
                    <Plus className="w-4 h-4" /> Add component to list
                  </button>
                </div>
              </div>
            </div>
        );
      case 3:
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
      case 4:
        return (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">FINISHED PRODUCT SPECIFICATIONS</label>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" placeholder="e.g. 6.0-7.0" value={formData.phRange} onChange={(e) => handleInputChange('phRange', e.target.value)} className="px-3 py-2 border border-slate-200 rounded text-sm" />
                    <input type="text" placeholder="e.g. 15,000-25,000" value={formData.viscosity} onChange={(e) => handleInputChange('viscosity', e.target.value)} className="px-3 py-2 border border-slate-200 rounded text-sm" />
                    <input type="text" placeholder="e.g. 0.98-1.02" value={formData.specificGravity} onChange={(e) => handleInputChange('specificGravity', e.target.value)} className="px-3 py-2 border border-slate-200 rounded text-sm" />
                    <input type="text" placeholder="e.g. White smooth lotion" value={formData.appearance} onChange={(e) => handleInputChange('appearance', e.target.value)} className="px-3 py-2 border border-slate-200 rounded text-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">STABILITY PROTOCOL</label>
                <div className="space-y-3">
                  <input type="text" placeholder="e.g. 6M completed PASS" value={formData.acceleratedStability} onChange={(e) => handleInputChange('acceleratedStability', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm" />
                  <input type="text" placeholder="e.g. 12M ongoing" value={formData.intermediateStability} onChange={(e) => handleInputChange('intermediateStability', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm" />
                  <input type="text" placeholder="e.g. 24M ongoing" value={formData.longTermStability} onChange={(e) => handleInputChange('longTermStability', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">REGULATORY & CLAIMS</label>
                <div className="space-y-3">
                  <select value={formData.applicableRegulation} onChange={(e) => handleInputChange('applicableRegulation', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm">
                    <option value="">APPLICABLE REGULATION</option>
                    <option value="India - BIS / CDSCO">India - BIS / CDSCO</option>
                    <option value="EU">EU</option>
                    <option value="USA - FDA">USA - FDA</option>
                  </select>
                  <select value={formData.cosmosNaturalCertification} onChange={(e) => handleInputChange('cosmosNaturalCertification', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm">
                    <option value="">COSMOS / NATURAL CERTIFICATION</option>
                    <option value="Not applicable">Not applicable</option>
                    <option value="COSMOS Organic">COSMOS Organic</option>
                    <option value="COSMOS Natural">COSMOS Natural</option>
                  </select>
                  <select value={formData.dermatologicallyTested} onChange={(e) => handleInputChange('dermatologicallyTested', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm">
                    <option value="">DERMATOLOGICALLY TESTED</option>
                    <option value="Yes - certified">Yes - certified</option>
                    <option value="No">No</option>
                  </select>
                  <select value={formData.crueltyFreeVegan} onChange={(e) => handleInputChange('crueltyFreeVegan', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm">
                    <option value="">CRUELTY FREE / VEGAN</option>
                    <option value="Yes - certified">Yes - certified</option>
                    <option value="No">No</option>
                  </select>
                  <textarea placeholder="e.g. Broad spectrum UVA+UVB, Niacinamide brightening..." value={formData.approvedMarketingClaims} onChange={(e) => handleInputChange('approvedMarketingClaims', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded text-sm" />
                  <textarea placeholder="SPF test ref, in-vitro study, clinical report ref no." value={formData.claimsSubstantiation} onChange={(e) => handleInputChange('claimsSubstantiation', e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded text-sm" />
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
    <MasterFormBase
      title={productIdFromRoute ? 'Edit Product Registration (PR Master)' : 'New Product Registration (PR Master)'}
      stages={stages}
      currentStage={currentStage}
      onStageChange={setCurrentStage}
      errors={errors}
      formData={formData as unknown as Record<string, unknown>}
      onInputChange={() => {}}
      onFillMock={fillMockData}
      onSubmit={handleSubmit}
    >
      {renderStageContent()}
    </MasterFormBase>
  );
};

export default BOMForm;
