import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MasterSubmitPreviewModal } from '../components/masters/MasterSubmitPreviewModal';
import { PM_PREVIEW_SECTIONS } from '../constants/masterSubmitPreviewFields';
import { buildMasterPreviewSections } from '../utils/masterSubmitPreview';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import ArrayItemManager from '../components/ArrayItemManager';
import VendorCommercialEditor, {
  defaultTempVendorTiers,
  type PmCommercialVendor,
  type VendorTierDraft,
} from '../components/VendorCommercialEditor';
import { syncMasterVendorsToPriceList } from '../utils/syncVendorMasterToPriceList';
import { validateStagedPercents } from '../lib/stagedPaymentTerms';
import { fetchPackMaterialsList, fetchPackMaterialById, createPackMaterial, updatePackMaterial, deletePackMaterial, postPackMaterialsMasterExcel, resetAllPackMaterialsMaster, type PackMaterialRecord, type CreatePackMaterialPayload } from '../services/packMaterials.service';
import { fetchPRProducts, type PRProductListItem } from '../services/productsMaster.service';
import { fetchVendorClients, type VendorClientRecord } from '../services/vendorClient.service';
import { validateMasterTaxDetails, GST_RATE_OPTIONS } from '../utils/masterFormUtils';
import { fetchPriceListRowForMaterial, mergePmVendorsWithPriceList } from '../utils/mergeVendorsFromItemsList';
import {
  PM_SKU_CATEGORY_SELECT_OPTIONS,
  PM_SKU_CATEGORY_OPTIONS,
  isCanonicalPmSkuCategory,
  normalizePmSkuCategoryForSelect,
  normalizePmDetailSubCategoryForSelect,
  pmDetailSubCategoryOptionsForSkuCategory,
  pmLevelForSubCategory,
  pmSkuCategoryRequiresDetailSubCategory,
  pmSkuMatchesCodePrefix,
  pmSubCategorySkuPrefix,
} from '../constants/materialMasterSkuRules';
import { resolvePmEditCategories } from '../utils/masterImportCategoryResolve';
// ─── PM Category Code Series ─────────────────────────────────────────────────
const PM_CATEGORIES: Record<string, { label: string; prefix: string }> = {
  PRI: { label: 'Primary Container (Bottle/Jar/Tube)', prefix: 'EI-PM-PRI' },
  SLBL: { label: 'Self-adhesive Label', prefix: 'EI-PM-SLBL' },
  MONO: { label: 'Mono Carton / Folding Box', prefix: 'EI-PM-MONO' },
  SHIP: { label: 'Shipper / Master Carton', prefix: 'EI-PM-SHIP' },
  CLSR: { label: 'Closure / Cap / Pump', prefix: 'EI-PM-CLSR' },
  SACH: { label: 'Sachet / Pouch / Stick Pack', prefix: 'EI-PM-SACH' },
  FIOL: { label: 'Ampoule / Vial / Fiolax', prefix: 'EI-PM-FIOL' },
  ALUM: { label: 'Aluminium Tube / Blister', prefix: 'EI-PM-ALUM' },
  AIRLS: { label: 'Airless / Vacuum Dispenser', prefix: 'EI-PM-AIRLS' },
  TAPE: { label: 'Tape / Rubber Band / Twistie', prefix: 'EI-PM-TAPE' },
  GIFT: { label: 'Gift Box / Rigid Box / Set', prefix: 'EI-PM-GIFT' },
  MISC: { label: 'Miscellaneous / Others', prefix: 'EI-PM-MISC' },
};

const QC_GROUPS = ['Chemical QC', 'Microbiology', 'Physical QC', 'Packaging QC', 'Incoming QA'];
const STORAGE_TYPES = ['Ambient – Dry', 'Ambient – Cool', 'Refrigerated (2–8°C)', 'Frozen', 'Flammable Store'];
const PM_REQUIRED_FIELDS: Array<{
  id: string;
  label: string;
  section: number;
  toastMessage: string;
}> = [
  { id: 'pmSkuCategory', label: 'Category', section: 0, toastMessage: 'Step 1 — Category is required' },
  { id: 'itemCode', label: 'SKU', section: 0, toastMessage: 'Step 1 — Generate or enter SKU before submitting' },
  { id: 'name', label: 'Item Name', section: 0, toastMessage: 'Step 1 — Item Name is required' },
  { id: 'itemCategory', label: 'Item type', section: 0, toastMessage: 'Step 1 — Item type is required' },
];

function safeParseMaybeJsonObject(input: unknown): Record<string, unknown> | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    try {
      const parsed: unknown = JSON.parse(s);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      // ignore
    }
    return null;
  }
  if (typeof input === 'object' && !Array.isArray(input)) return input as Record<string, unknown>;
  return null;
}

/** Fresh PM form state when opening a new item or after closing the onboarding overlay. */
function createEmptyPackagingFormData() {
  return {
    itemCode: '',
    status: 'Draft',
    version: 'v1.0',
    pmCategory: '',
    pmSkuCategory: '',
    optionalPmSubCategory: '',
    qcGroup: '',
    subCategory: '',
    storeLoc: '',
    zohoId: '',
    pkgSku: '',
    pkgUnit: 'PCS',
    pkgHsn: '',
    pkgGst: '',
    pkgTaxPreference: '',
    pkgReturnable: false,
    pkgAssociateItems: '',
    name: '',
    level: '',
    itemCategory: '',
    intendedUse: '',
    expectedProductTypes: '',
    reusability: '',
    regulatory: '',
    identityNotes: '',
    matBody: '',
    matClosure: '',
    matInner: '',
    matRecycle: false,
    matBpa: false,
    matGrade: '',
    specNominal: '',
    specBrimful: '',
    specHeight: '',
    specDia: '',
    specNeck: '',
    specWeight: '',
    specWall: '',
    specLink: '',
    assayPurity: '',
    appearanceSpec: '',
    phSpec: '',
    moistureLod: '',
    heavyMetalsSpec: '',
    microbialSpec: '',
    odorColorSpec: '',
    otherSpecs: '',
    colorType: '',
    colorCode: '',
    finish: '',
    deco: '',
    images: '',
    cusCustomizable: false,
    cusParams: '',
    cusStdMoq: '',
    cusCustomMoq: '',
    cusToolingReq: '',
    cusToolingCost: '',
    cusSamplingLT: '',
    cusBulkLTStd: '',
    cusBulkLTCustom: '',
    cusRemarks: '',
    compLow: false,
    compMed: false,
    compHigh: false,
    compOil: false,
    compAlc: false,
    compAirless: false,
    compPump: false,
    compLeak: false,
    compActives: '',
    compRisk: '',
    compRemarks: '',
    secLabelType: '',
    secLabelSize: '',
    secAdhesive: '',
    secLabelCompat: '',
    secGsm: '',
    secCartonFinish: '',
    secFit: '',
    secArtLink: '',
    secNotes: '',
    terShipType: '',
    terUnits: '',
    terDrop: '',
    terStack: '',
    terNotes: '',
    apprPack: false,
    apprRd: false,
    apprFin: false,
    apprLock: false,
    catVisible: false,
    catShare: false,
    catWebName: '',
    catTags: '',
    catRecoTypes: '',
    catWebImages: '',
    variants: [] as Array<{ id: string; volume: number; sameMold: string; moq: number; status: string }>,
    vendors: [] as PmCommercialVendor[],
    tests: [] as Array<{ name: string; result: string; date: string; by: string; remarks: string }>,
  };
}

const SECTIONS = [
  'Primary info (details, code & tax)',
  'Technical, material & procurement',
  'Aesthetics',
  'Variants Matrix',
  'Customization & Tooling',
  'Compatibility (R&D / QA)',
  'Vendors & Commercial',
  'Secondary Packaging',
  'Tertiary Packaging',
  'QA Testing & Documents',
  'Catalogue / Website',
];

function parsePmVendorTierPrice(raw: string): number {
  const n = parseFloat(String(raw ?? '').replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

// ─── Main Component ───────────────────────────────────────────────────────────
const PackagingRefactored: React.FC = () => {
  const { addItem: _addItem } = useItems(); // BPR submit posts to API; addItem unused here
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [pageTab, setPageTab] = useState<'bpr' | 'form'>('bpr');
  const [existingPmId, setExistingPmId] = useState<string | null>(null);
  const [editPmLoading, setEditPmLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [autoSaveOn, setAutoSaveOn] = useState(true);
  const [lastSaved, setLastSaved] = useState<string>('—');
  const [generatedCode, setGeneratedCode] = useState('');
  const [submitPreviewOpen, setSubmitPreviewOpen] = useState(false);
  const [pendingPmPayload, setPendingPmPayload] = useState<CreatePackMaterialPayload | null>(null);
  const [submitConfirming, setSubmitConfirming] = useState(false);
  const focusPmField = useCallback((fieldId: string) => {
    window.setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el instanceof HTMLElement) el.focus();
    }, 0);
  }, []);

  const [formData, setFormData] = useState(createEmptyPackagingFormData);

  const isNewPm = !existingPmId;
  const taxIsTaxable = formData.pkgTaxPreference === 'Taxable';
  const pmDetailSubCategoryRequired = pmSkuCategoryRequiresDetailSubCategory(
    formData.pmSkuCategory || formData.subCategory
  );
  const pmDetailSubCategoryOptions = useMemo(() => {
    const base = pmDetailSubCategoryOptionsForSkuCategory(formData.pmSkuCategory || formData.subCategory);
    const cur = String(formData.optionalPmSubCategory ?? '').trim();
    if (cur && !base.some((o) => o.value === cur)) {
      return [{ value: cur, label: cur }, ...base];
    }
    return base;
  }, [formData.pmSkuCategory, formData.subCategory, formData.optionalPmSubCategory]);
  const canAdvancePastPrimary =
    !isNewPm ||
    Boolean(
      isCanonicalPmSkuCategory(formData.pmSkuCategory || formData.subCategory) &&
        pmLevelForSubCategory(formData.pmSkuCategory || formData.subCategory) &&
        formData.name?.trim() &&
        formData.itemCategory?.trim() &&
        formData.pkgTaxPreference?.trim() &&
        (!taxIsTaxable || (formData.pkgHsn?.trim() && formData.pkgGst?.toString().trim()))
    );
  const lockPrimaryFields = !!existingPmId;

  const [tempVariant, setTempVariant] = useState({ id: '', volume: '', sameMold: '', moq: '', status: 'Active' });
  const [tempVendor, setTempVendor] = useState({
    name: '',
    location: '',
    moq: '',
    price: '',
    leadTime: '',
    approved: '',
    priceType: '',
    validTill: '',
    sampleCost: '',
    currency: 'INR',
    advancePct: '',
    preShipmentPct: '',
    postShipmentPct: '',
    creditDays: '',
  });
  const [tempVendorTiers, setTempVendorTiers] = useState<VendorTierDraft[]>(() => defaultTempVendorTiers(4));
  const [tempTest, setTempTest] = useState({ name: '', result: '', date: '', by: '', remarks: '' });

  const { data: vendorClientData } = useQuery({
    queryKey: ['vendor-clients', 'vendor', 'packaging-form'],
    queryFn: async () => {
      const res = await fetchVendorClients('vendor');
      return (res.success ? res.data : []) as VendorClientRecord[];
    },
    staleTime: 2 * 60 * 1000,
  });
  const vendorClientList = vendorClientData ?? [];

  const resetPmFormToEmpty = useCallback(() => {
    setFormData(createEmptyPackagingFormData());
    setTempVariant({ id: '', volume: '', sameMold: '', moq: '', status: 'Active' });
    setTempVendor({
      name: '',
      location: '',
      moq: '',
      price: '',
      leadTime: '',
      approved: '',
      priceType: '',
      validTill: '',
      sampleCost: '',
      currency: 'INR',
      advancePct: '',
      preShipmentPct: '',
      postShipmentPct: '',
      creditDays: '',
    });
    setTempVendorTiers(defaultTempVendorTiers(4));
    setTempTest({ name: '', result: '', date: '', by: '', remarks: '' });
    setGeneratedCode('');
    setErrors({});
    setCurrentSection(0);
    setExistingPmId(null);
  }, []);

  const doSave = (silent = false) => {
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setLastSaved(now);
    if (!silent) addToast('success', 'Draft saved locally (session only)');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    if (id === 'zohoId') return;
    if (id === 'pkgHsn' || id === 'pkgGst' || id === 'pkgTaxPreference' || id in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        if (id === 'pkgTaxPreference') {
          delete next.pkgHsn;
          delete next.pkgGst;
          delete next.pkgTaxPreference;
        }
        return next;
      });
    }
    if (id === 'pmSkuCategory' || id === 'subCategory') {
      const canon = normalizePmSkuCategoryForSelect(value) || '';
      const level = pmLevelForSubCategory(canon);
      const sku = String(formData.itemCode || '').trim();
      if (sku && existingPmId && canon) {
        const p = pmSubCategorySkuPrefix(canon);
        if (p && !pmSkuMatchesCodePrefix(sku, p)) {
          addToast('error', `This PM code (${sku}) must start with "${p}" for the selected category.`);
          return;
        }
      }
      setFormData((prev) => ({
        ...prev,
        pmSkuCategory: canon || prev.pmSkuCategory,
        subCategory: canon || prev.subCategory,
        optionalPmSubCategory: normalizePmDetailSubCategoryForSelect(canon, prev.optionalPmSubCategory),
        ...(level ? { level } : {}),
      }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.pmSkuCategory;
        delete next.optionalPmSubCategory;
        return next;
      });
      return;
    }
    if (id === 'optionalPmSubCategory') {
      setErrors((prev) => {
        if (!prev.optionalPmSubCategory) return prev;
        const next = { ...prev };
        delete next.optionalPmSubCategory;
        return next;
      });
    }
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  // Variant ops
  const handleAddVariant = () => {
    if (!tempVariant.volume || Number(tempVariant.volume) <= 0) {
      setErrors(prev => ({ ...prev, varVolume: 'Step 4 — Fill volume is required' }));
      addToast('error', 'Step 4 — Fill volume is required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, {
        id: tempVariant.id || `V${prev.variants.length + 1}`,
        volume: Number(tempVariant.volume),
        sameMold: tempVariant.sameMold,
        moq: Number(tempVariant.moq),
        status: tempVariant.status,
      }],
    }));
    setTempVariant({ id: '', volume: '', sameMold: '', moq: '', status: 'Active' });
    setErrors(prev => ({ ...prev, varVolume: '' }));
  };
  const handleRemoveVariant = (idx: number) => setFormData(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== idx) }));

  // Vendor ops
  const handleAddVendor = () => {
    if (!tempVendor.name.trim()) {
      addToast('error', 'Step 7 — Vendor name is required');
      return;
    }
    const adv = Number(tempVendor.advancePct);
    const pre = Number(tempVendor.preShipmentPct);
    const post = Number(tempVendor.postShipmentPct);
    const pctErr = validateStagedPercents(adv, pre, post);
    if (pctErr) {
      addToast('error', pctErr);
      return;
    }
    let tierRows = tempVendorTiers.filter((t) => String(t.moq).trim() && String(t.price).trim());
    if (tierRows.length === 0 && tempVendor.moq?.trim() && tempVendor.price?.trim()) {
      tierRows = [
        {
          moq: tempVendor.moq.trim(),
          price: tempVendor.price.trim(),
          validTill: tempVendor.validTill || '',
          note: '',
        },
      ];
    }
    if (tierRows.length === 0) {
      addToast('error', 'Add at least one price tier (MOQ + price in the table) or fill MOQ + unit price.');
      return;
    }
    const first = tierRows[0];
    setFormData((prev) => ({
      ...prev,
      vendors: [
        ...prev.vendors,
        {
          id: Date.now().toString(),
          name: tempVendor.name,
          location: tempVendor.location,
          moq: Number(tempVendor.moq) || Number(first.moq) || 0,
          price: Number(tempVendor.price) || Number(first.price) || 0,
          leadTime: Number(tempVendor.leadTime),
          approved: tempVendor.approved,
          priceType: tempVendor.priceType,
          validTill: tempVendor.validTill,
          sampleCost: Number(tempVendor.sampleCost),
          currency: tempVendor.currency || 'INR',
          advancePct: tempVendor.advancePct,
          preShipmentPct: tempVendor.preShipmentPct,
          postShipmentPct: tempVendor.postShipmentPct,
          creditDays: tempVendor.creditDays,
          tiers: tierRows.map((t) => ({ ...t })),
        },
      ],
    }));
    setTempVendor({
      name: '',
      location: '',
      moq: '',
      price: '',
      leadTime: '',
      approved: '',
      priceType: '',
      validTill: '',
      sampleCost: '',
      currency: 'INR',
      advancePct: '',
      preShipmentPct: '',
      postShipmentPct: '',
      creditDays: '',
    });
    setTempVendorTiers(defaultTempVendorTiers(4));
  };
  const handleRemoveVendor = (idx: number) => setFormData((prev) => ({ ...prev, vendors: prev.vendors.filter((_, i) => i !== idx) }));

  const handlePmVendorTempFieldChange = (field: string, value: string) => {
    setTempVendor((prev) => ({ ...prev, [field]: value }));
  };

  const handleTempVendorTierChange = (rowIdx: number, field: keyof VendorTierDraft, value: string) => {
    setTempVendorTiers((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [field]: value } : r)));
  };

  const handleAddTempVendorTierRow = () => {
    setTempVendorTiers((prev) => [...prev, { moq: '', price: '', validTill: '', note: '' }]);
  };

  const syncPmVendorsToItemsListAfterSave = async (pmId: number): Promise<number> => {
    if (!formData.vendors.length) return 0;
    const mid = parseInt(String(pmId), 10);
    if (Number.isNaN(mid)) return 0;
    const { created, errors } = await syncMasterVendorsToPriceList({
      variant: 'pm',
      materialId: mid,
      vendors: formData.vendors,
      vendorClientList,
    });
    if (errors.length) {
      addToast('error', `Items List: ${errors[0]}`);
    }
    void queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('items-list'),
      refetchType: 'all',
    });
    return created;
  };

  // Test ops
  const handleAddTest = () => {
    if (!tempTest.name || !tempTest.result) { addToast('error', 'Select test + result'); return; }
    setFormData(prev => ({
      ...prev,
      tests: [...prev.tests, { name: tempTest.name, result: tempTest.result, date: tempTest.date, by: tempTest.by, remarks: tempTest.remarks }],
    }));
    setTempTest({ name: '', result: '', date: '', by: '', remarks: '' });
  };
  const handleRemoveTest = (idx: number) => setFormData(prev => ({ ...prev, tests: prev.tests.filter((_, i) => i !== idx) }));

  const handleReset = () => {
    if (window.confirm('Reset all form data? This cannot be undone.')) {
      resetPmFormToEmpty();
      addToast('info', 'Form reset');
    }
  };

  const buildPayload = () => {
    const codeTrim = (formData.itemCode || generatedCode || '').trim();
    const firstVendor = formData.vendors[0];
    const skuForZoho = formData.pkgSku?.trim() ? formData.pkgSku.trim() : codeTrim || undefined;
    const descBase = formData.name?.trim() || (codeTrim ? `PM Item ${codeTrim}` : 'New pack material');
    const skuCat =
      normalizePmSkuCategoryForSelect(formData.pmSkuCategory || formData.subCategory) ||
      String(formData.pmSkuCategory || formData.subCategory || '')
        .trim()
        .toLowerCase();
    return {
      ...(codeTrim ? { code: codeTrim } : {}),
      description: descBase,
      type: formData.itemCategory || undefined,
      level: formData.level || undefined,
      group: skuCat || undefined,
      material:
        formData.optionalPmSubCategory?.trim() ||
        formData.matBody?.trim() ||
        undefined,
      size_spec: formData.specNominal || undefined,
      price_per_pc: firstVendor?.price != null ? Number(firstVendor.price) : undefined,
      moq: firstVendor?.moq != null ? Number(firstVendor.moq) : undefined,
      lead_time_days: firstVendor?.leadTime != null ? Number(firstVendor.leadTime) : undefined,
      print_status: formData.deco || undefined,
      zohoId: formData.zohoId?.trim() ? formData.zohoId.trim() : undefined,
      zoho_sku_code: skuForZoho,
      hsnCode: formData.pkgHsn?.trim() ? formData.pkgHsn.trim() : undefined,
      unit: formData.pkgUnit?.trim() ? formData.pkgUnit.trim() : undefined,
      taxPref: formData.pkgTaxPreference ?? undefined,
      pkgReturnable: formData.pkgReturnable,
      pkgAssociateItems: formData.pkgAssociateItems?.trim() ? formData.pkgAssociateItems.trim() : undefined,
      form_data: (() => {
        const {
          pmCategory: _pmCat,
          excelCategory: _excelCat,
          excelSubCategory: _excelSub,
          matBody: _matBody,
          subCategory: _sub,
          pmSkuCategory: _pmSku,
          optionalPmSubCategory: _optSub,
          ...formRest
        } = formData as Record<string, unknown>;
        return {
          ...formRest,
          ...(codeTrim ? { itemCode: codeTrim } : {}),
          ...(skuCat
            ? {
                subCategory: skuCat,
                pmSkuCategory: skuCat,
                optionalPmSubCategory: formData.optionalPmSubCategory?.trim() || undefined,
              }
            : {}),
        };
      })(),
    };
  };

  const pmPreviewFormData = useMemo(
    () => ({
      ...(formData as Record<string, unknown>),
      itemCode: formData.itemCode || generatedCode || '',
    }),
    [formData, generatedCode]
  );

  const pmPreviewSections = useMemo(
    () => buildMasterPreviewSections(pmPreviewFormData, PM_PREVIEW_SECTIONS),
    [pmPreviewFormData]
  );

  const validatePmForSubmit = (): CreatePackMaterialPayload | null => {
    const requiredFields = PM_REQUIRED_FIELDS.filter((field) => {
      if (field.id === 'itemCode' && !existingPmId) return false;
      return true;
    });
    for (const field of requiredFields) {
      if (field.id === 'pmSkuCategory') {
        const ok = normalizePmSkuCategoryForSelect(formData.pmSkuCategory || formData.subCategory);
        if (!ok) {
          const stepNo = field.section + 1;
          setErrors((prev) => ({
            ...prev,
            pmSkuCategory: `Step ${stepNo} — ${field.label} is required`,
          }));
          addToast('error', field.toastMessage);
          setCurrentSection(field.section);
          focusPmField(field.id);
          return null;
        }
        continue;
      }
      if (field.id === 'optionalPmSubCategory') {
        continue;
      }
      const rawValue = formData[field.id as keyof typeof formData];
      const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      if (!value) {
        const stepNo = field.section + 1;
        setErrors((prev) => ({
          ...prev,
          [field.id]: `Step ${stepNo} — ${field.label} is required`,
        }));
        addToast('error', field.toastMessage);
        setCurrentSection(field.section);
        focusPmField(field.id);
        return null;
      }
    }
    const codeRule = (formData.itemCode || generatedCode || '').trim();
    const skuCatKey =
      normalizePmSkuCategoryForSelect(formData.pmSkuCategory || formData.subCategory) ||
      String(formData.pmSkuCategory || formData.subCategory || '')
        .trim()
        .toLowerCase();
    const pfxRule = pmSubCategorySkuPrefix(skuCatKey);
    if (pfxRule && codeRule && !pmSkuMatchesCodePrefix(codeRule, pfxRule)) {
      addToast('error', `SKU must start with "${pfxRule}" for category "${formData.pmSkuCategory || formData.subCategory}".`);
      setCurrentSection(0);
      focusPmField('itemCode');
      return null;
    }
    const taxValidation = validateMasterTaxDetails(formData as Record<string, unknown>, 'packaging');
    if (!taxValidation.valid) {
      setErrors((prev) => ({ ...prev, ...taxValidation.errors }));
      const firstTaxKey = ['pkgTaxPreference', 'pkgHsn', 'pkgGst'].find((k) => Boolean(taxValidation.errors[k]));
      addToast(
        'error',
        (firstTaxKey && taxValidation.errors[firstTaxKey]) ||
          'Select a Tax Preference and (for Taxable) fill a valid HSN code and GST % (Step 1).'
      );
      setCurrentSection(0);
      if (firstTaxKey) focusPmField(firstTaxKey);
      return null;
    }
    return buildPayload();
  };

  const handleSubmit = () => {
    const payload = validatePmForSubmit();
    if (!payload) return;
    setPendingPmPayload(payload);
    setSubmitPreviewOpen(true);
  };

  const handleConfirmSubmit = async () => {
    const payload = pendingPmPayload;
    if (!payload) return;
    setSubmitConfirming(true);
    try {
      if (existingPmId) {
        const pmIdForSync = parseInt(String(existingPmId), 10);
        await updatePackMaterial(existingPmId, payload);
        const syncCreated = Number.isNaN(pmIdForSync) ? 0 : await syncPmVendorsToItemsListAfterSave(pmIdForSync);
        addToast(
          'success',
          syncCreated > 0
            ? `Packaging item updated! ${syncCreated} vendor rate(s) synced to Items List.`
            : 'Packaging item updated!'
        );
        setExistingPmId(null);
      } else {
        const saved = await createPackMaterial({ ...payload });
        const newPmId = parseInt(String(saved.id), 10);
        const syncCreated = Number.isNaN(newPmId) ? 0 : await syncPmVendorsToItemsListAfterSave(newPmId);
        addToast(
          'success',
          syncCreated > 0
            ? `Packaging item saved! ${syncCreated} vendor rate(s) synced to Items List.`
            : 'Packaging item saved!'
        );
      }
      localStorage.removeItem('packaging_draft_new');
      queryClient.invalidateQueries({ queryKey: ['pack-materials-full-list'] });
      setSubmitPreviewOpen(false);
      setPendingPmPayload(null);
      resetPmFormToEmpty();
      setPageTab('bpr');
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save pack material');
    } finally {
      setSubmitConfirming(false);
    }
  };

  // ── Section Content ──────────────────────────────────────────────────────────
  const renderSection = () => {
    switch (currentSection) {
      case 0:
        return (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            {/* PM Category — Industry Buckets */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Category &amp; sub-category</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  label="Category"
                  id="pmSkuCategory"
                  value={formData.pmSkuCategory}
                  onChange={handleInputChange}
                  options={[...PM_SKU_CATEGORY_SELECT_OPTIONS]}
                  requiredMark
                  error={errors.pmSkuCategory}
                  disabled={lockPrimaryFields}
                />
                {formData.pmSkuCategory &&
                !PM_SKU_CATEGORY_OPTIONS.includes(formData.pmSkuCategory as (typeof PM_SKU_CATEGORY_OPTIONS)[number]) ? (
                  <p className="text-[10px] text-amber-800 mt-1 col-span-2">
                    Legacy category &quot;{formData.pmSkuCategory}&quot; — pick a PPM / SPM / TPM option to align level and SKU rules.
                  </p>
                ) : null}
                {pmDetailSubCategoryRequired ? (
                  <SelectField
                    label="Sub-category (optional)"
                    id="optionalPmSubCategory"
                    value={formData.optionalPmSubCategory}
                    onChange={handleInputChange}
                    options={pmDetailSubCategoryOptions}
                    error={errors.optionalPmSubCategory}
                    disabled={lockPrimaryFields || !formData.pmSkuCategory?.trim()}
                  />
                ) : (
                  <InputField
                    label="Sub-category (optional)"
                    id="optionalPmSubCategory"
                    value={formData.optionalPmSubCategory}
                    onChange={handleInputChange}
                    placeholder="Select a category first"
                    error={errors.optionalPmSubCategory}
                    disabled={!formData.pmSkuCategory?.trim()}
                  />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Category sets the SKU series: PPM <span className="font-mono">4</span>, SPM Labels{' '}
                <span className="font-mono">5L</span>, Monocartons <span className="font-mono">5M</span>, Other Secondary{' '}
                <span className="font-mono">5O</span>, TPM Tertiary <span className="font-mono">6T</span>, Ancillary{' '}
                <span className="font-mono">6A</span>. Level is set automatically from category.
              </p>
            </div>

            {/* Identity (merged from former section 1) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Identity</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Item Name"
                  id="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Packaging item name as used internally"
                  requiredMark
                  error={errors.name}
                />
                <div>
                  <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
                    Level
                  </label>
                  <input
                    id="level"
                    type="text"
                    readOnly
                    value={formData.level || '—'}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-slate-50 text-slate-800 cursor-default"
                    title="Set automatically from sub-category (PPM / SPM / TPM)"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Auto: PPM → Primary, SPM → Secondary, TPM → Tertiary</p>
                </div>
                <InputField
                  label="Item type"
                  id="itemCategory"
                  value={formData.itemCategory}
                  onChange={handleInputChange}
                  placeholder="e.g. Bottle, Carton, Label, Shipper"
                  requiredMark
                  error={errors.itemCategory}
                />
              </div>
            </div>

            {/* Basic Details */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Basic Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="SKU"
                  id="itemCode"
                  value={formData.itemCode}
                  onChange={handleInputChange}
                  placeholder={
                    isCanonicalPmSkuCategory(formData.pmSkuCategory || formData.subCategory)
                      ? 'Optional — leave blank to assign on save (4… / 5L… / 5M… / 5O… / 6T… / 6A…)'
                      : 'e.g. 400001 or legacy code'
                  }
                  requiredMark={
                    !isNewPm ||
                    !isCanonicalPmSkuCategory(formData.pmSkuCategory || formData.subCategory)
                  }
                  error={errors.itemCode}
                  readOnly={lockPrimaryFields}
                />
                <div>
                  <label htmlFor="pkgTaxPreference" className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Preference
                    <span className="text-red-600 ml-0.5" aria-hidden>*</span>
                  </label>
                  <select
                    id="pkgTaxPreference"
                    value={formData.pkgTaxPreference}
                    onChange={handleInputChange}
                    aria-invalid={errors.pkgTaxPreference ? true : undefined}
                    className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.pkgTaxPreference ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select...</option>
                    {['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {errors.pkgTaxPreference ? (
                    <p className="mt-1 text-xs text-red-600">{errors.pkgTaxPreference}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">Taxable: HSN and GST % required. Exempted / NonGST: HSN / GST not needed.</p>
                  )}
                </div>
                {formData.pkgTaxPreference === 'Taxable' ? (
                  <>
                    <InputField
                      label="HSN Code"
                      id="pkgHsn"
                      value={formData.pkgHsn}
                      onChange={handleInputChange}
                      placeholder="e.g. 3923, 4819, 7010"
                      error={errors.pkgHsn}
                      requiredMark
                    />
                    <div>
                      <label htmlFor="pkgGst" className="block text-sm font-medium text-gray-700 mb-1">
                        GST %
                        <span className="text-red-600 ml-0.5" aria-hidden>*</span>
                      </label>
                      <select
                        id="pkgGst"
                        value={formData.pkgGst}
                        onChange={handleInputChange}
                        aria-invalid={errors.pkgGst ? true : undefined}
                        className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          errors.pkgGst ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select...</option>
                        {GST_RATE_OPTIONS.map((v) => (
                          <option key={v} value={v}>{v}%</option>
                        ))}
                      </select>
                      {errors.pkgGst ? <p className="mt-1 text-xs text-red-600">{errors.pkgGst}</p> : null}
                    </div>
                  </>
                ) : null}
              </div>
            </div>

          </div>
        );

      case 1: // Material & Specs
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Optional — identity & Zoho details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Expected Product Types"
                  id="expectedProductTypes"
                  value={formData.expectedProductTypes}
                  onChange={handleInputChange}
                  placeholder="e.g. Creams, Serums, Shampoos"
                />
                <InputField
                  label="SKU (for Zoho)"
                  id="pkgSku"
                  value={formData.pkgSku}
                  onChange={handleInputChange}
                  placeholder="Optional; defaults to SKU above"
                />
              </div>
              <div className="mt-3 space-y-3">
                <TextareaField
                  label="Regulatory Notes"
                  id="regulatory"
                  value={formData.regulatory}
                  onChange={handleInputChange}
                  placeholder="Any packaging-specific regulations or country notes"
                />
                <TextareaField
                  label="Identity Notes"
                  id="identityNotes"
                  value={formData.identityNotes}
                  onChange={handleInputChange}
                  placeholder="Any extra description to identify this item uniquely"
                />
                <div className="mt-3 flex items-center gap-2">
                  <input type="checkbox" id="pkgReturnable" checked={formData.pkgReturnable} onChange={handleInputChange}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                  <label htmlFor="pkgReturnable" className="text-sm text-gray-700">Returnable Item</label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Associate Items</label>
                  <textarea
                    id="pkgAssociateItems"
                    value={formData.pkgAssociateItems}
                    onChange={handleInputChange}
                    rows={2}
                    placeholder="Link related BOM / RM / secondary packaging if any"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zoho Item ID</label>
                  <input
                    type="text"
                    id="zohoId"
                    value={formData.zohoId ?? ''}
                    readOnly
                    autoComplete="off"
                    aria-readonly="true"
                    placeholder="Populated from the server after save (when Books sync is on)"
                    onChange={() => {}}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Read-only — returned by the API after a successful save.</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-800 mb-2">Zoho Books</h4>
                <p className="text-xs text-gray-600">
                  When you submit this form, the server saves the pack material and creates the Zoho item in one step (or rolls back both if Books fails). No separate sync button.
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Optional — QC, storage & unit</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">QC Inspection Group</label>
                  <select
                    id="qcGroup"
                    value={formData.qcGroup}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select</option>
                    {QC_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Storage Location Type</label>
                  <select
                    id="storeLoc"
                    value={formData.storeLoc}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select</option>
                    {STORAGE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure</label>
                  <select
                    id="pkgUnit"
                    value={formData.pkgUnit}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {['PCS', 'GM', 'ML', 'L', 'KG'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Material</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Body Material"
                  id="matBody"
                  value={formData.matBody}
                  onChange={handleInputChange}
                  placeholder="e.g. PET, Glass, HDPE"
                  error={errors.matBody}
                />
                <InputField
                  label="Closure Material"
                  id="matClosure"
                  value={formData.matClosure}
                  onChange={handleInputChange}
                  placeholder="e.g. PP cap, Pump, Dropper"
                  error={errors.matClosure}
                />
                <InputField
                  label="Inner Material"
                  id="matInner"
                  value={formData.matInner}
                  onChange={handleInputChange}
                  placeholder="e.g. LDPE liner, Pouch film"
                />
                <InputField
                  label="Grade"
                  id="matGrade"
                  value={formData.matGrade}
                  onChange={handleInputChange}
                  placeholder="e.g. Pharma grade, Food grade"
                />
              </div>
              <div className="flex gap-6 mt-3">
                <CheckboxField label="Recyclable" id="matRecycle" checked={formData.matRecycle} onChange={handleInputChange} />
                <CheckboxField label="BPA Free" id="matBpa" checked={formData.matBpa} onChange={handleInputChange} />
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Specifications</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Nominal Volume"
                  id="specNominal"
                  value={formData.specNominal}
                  onChange={handleInputChange}
                  placeholder="Declared fill volume (e.g. 50 ml)"
                  error={errors.specNominal}
                />
                <InputField
                  label="Brimful Volume"
                  id="specBrimful"
                  value={formData.specBrimful}
                  onChange={handleInputChange}
                  placeholder="Total capacity at brim"
                />
                <InputField
                  label="Height (mm)"
                  id="specHeight"
                  value={formData.specHeight}
                  onChange={handleInputChange}
                  placeholder="Total height of pack"
                />
                <InputField
                  label="Diameter (mm)"
                  id="specDia"
                  value={formData.specDia}
                  onChange={handleInputChange}
                  placeholder="Body diameter"
                />
                <InputField
                  label="Neck (mm)"
                  id="specNeck"
                  value={formData.specNeck}
                  onChange={handleInputChange}
                  placeholder="Neck / thread spec"
                />
                <InputField
                  label="Weight (g)"
                  id="specWeight"
                  value={formData.specWeight}
                  onChange={handleInputChange}
                  placeholder="Empty component weight"
                />
                <InputField
                  label="Wall Thickness (mm)"
                  id="specWall"
                  value={formData.specWall}
                  onChange={handleInputChange}
                  placeholder="Critical wall thickness if applicable"
                />
                <InputField
                  label="Tech Link / Reference"
                  id="specLink"
                  value={formData.specLink}
                  onChange={handleInputChange}
                  placeholder="Link to drawing / spec sheet"
                />
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Bulk quality specifications</h3>
              <p className="text-[11px] text-gray-500 mb-3">Same fields as raw materials; used as reference during BMR Bulk QC for this PM.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Assay / Purity %" id="assayPurity" value={formData.assayPurity} onChange={handleInputChange} placeholder="e.g. NLT 98%" />
                <InputField label="Appearance spec" id="appearanceSpec" value={formData.appearanceSpec} onChange={handleInputChange} placeholder="e.g. Clear, no defects" />
                <InputField label="pH range" id="phSpec" value={formData.phSpec} onChange={handleInputChange} placeholder="e.g. 5.0 – 7.0" />
                <InputField label="Moisture / LOD %" id="moistureLod" value={formData.moistureLod} onChange={handleInputChange} placeholder="e.g. NMT 2%" />
                <InputField label="Heavy metals" id="heavyMetalsSpec" value={formData.heavyMetalsSpec} onChange={handleInputChange} placeholder="e.g. Pb, As, Cd limits" />
                <InputField label="Microbial" id="microbialSpec" value={formData.microbialSpec} onChange={handleInputChange} placeholder="e.g. TAMC / TYMC limits" />
                <InputField label="Odor & color" id="odorColorSpec" value={formData.odorColorSpec} onChange={handleInputChange} placeholder="e.g. Characteristic odour" />
                <InputField label="Other specifications" id="otherSpecs" value={formData.otherSpecs} onChange={handleInputChange} placeholder="Any additional criteria" />
              </div>
            </div>
          </div>
        );

      case 2: // Aesthetics
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Optional — usage details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Intended Use"
                  id="intendedUse"
                  value={formData.intendedUse}
                  onChange={handleInputChange}
                  placeholder="e.g. Face serum bottle, Outer mono-carton"
                />
                <InputField
                  label="Reusability"
                  id="reusability"
                  value={formData.reusability}
                  onChange={handleInputChange}
                  placeholder="e.g. Single use, Refillable, Re-closable"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Color Type"
                id="colorType"
                value={formData.colorType}
                onChange={handleInputChange}
                placeholder="e.g. Solid, Transparent, Frosted"
              />
              <InputField
                label="Color Code"
                id="colorCode"
                value={formData.colorCode}
                onChange={handleInputChange}
                placeholder="e.g. Pantone, HEX, or vendor shade code"
              />
              <InputField
                label="Finish"
                id="finish"
                value={formData.finish}
                onChange={handleInputChange}
                placeholder="e.g. Glossy, Matte, Soft-touch"
              />
              <InputField
                label="Decoration"
                id="deco"
                value={formData.deco}
                onChange={handleInputChange}
                placeholder="e.g. Screen print, Hot foil, Label, Embossing"
              />
            </div>
            <TextareaField
              label="Images / References"
              id="images"
              value={formData.images}
              onChange={handleInputChange}
              placeholder="Links or notes for reference artwork, mood boards, or sample packs"
            />
          </div>
        );

      case 3: // Variants Matrix
        return (
          <ArrayItemManager
            masterType="packaging"
            itemType="variant"
            items={formData.variants}
            tempFields={tempVariant}
            onTempFieldChange={(field, value) => setTempVariant(prev => ({ ...prev, [field]: value }))}
            onAdd={handleAddVariant}
            onRemove={handleRemoveVariant}
            errors={errors}
            itemLabel="Variant"
            columns={[
              { key: 'id', label: 'Variant ID' },
              { key: 'volume', label: 'Volume (ml)', type: 'number' },
              { key: 'sameMold', label: 'Same Mold' },
              { key: 'moq', label: 'MOQ', type: 'number' },
              { key: 'status', label: 'Status' },
            ]}
          />
        );

      case 4: // Customization & Tooling
        return (
          <div className="space-y-4">
            <CheckboxField label="Customizable" id="cusCustomizable" checked={formData.cusCustomizable} onChange={handleInputChange} />
            <TextareaField label="Customization Parameters" id="cusParams" value={formData.cusParams} onChange={handleInputChange} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Standard MOQ" id="cusStdMoq" value={formData.cusStdMoq} onChange={handleInputChange} />
              <InputField label="Custom MOQ" id="cusCustomMoq" value={formData.cusCustomMoq} onChange={handleInputChange} />
              <InputField label="Tooling Required" id="cusToolingReq" value={formData.cusToolingReq} onChange={handleInputChange} />
              <InputField label="Tooling Cost" id="cusToolingCost" value={formData.cusToolingCost} onChange={handleInputChange} />
              <InputField label="Sampling Lead Time" id="cusSamplingLT" value={formData.cusSamplingLT} onChange={handleInputChange} />
              <InputField label="Bulk Lead Time (Std)" id="cusBulkLTStd" value={formData.cusBulkLTStd} onChange={handleInputChange} />
              <InputField label="Bulk Lead Time (Custom)" id="cusBulkLTCustom" value={formData.cusBulkLTCustom} onChange={handleInputChange} />
            </div>
            <TextareaField label="Customization Remarks" id="cusRemarks" value={formData.cusRemarks} onChange={handleInputChange} />
          </div>
        );

      case 5: // Compatibility (R&D / QA)
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px,1fr] md:gap-6 md:items-start">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 pt-1">
                Viscosity Compatibility
              </p>
              <div className="flex flex-wrap gap-3">
                <PillCheckboxField label="Low" id="compLow" checked={formData.compLow} onChange={handleInputChange} />
                <PillCheckboxField label="Medium" id="compMed" checked={formData.compMed} onChange={handleInputChange} />
                <PillCheckboxField label="High" id="compHigh" checked={formData.compHigh} onChange={handleInputChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px,1fr] md:gap-6 md:items-start">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 pt-1">
                Chemical Compatibility
              </p>
              <div className="flex flex-wrap gap-3">
                <PillCheckboxField label="Oil Compatible" id="compOil" checked={formData.compOil} onChange={handleInputChange} color="red" />
                <PillCheckboxField label="Alcohol Compatible" id="compAlc" checked={formData.compAlc} onChange={handleInputChange} color="red" />
                <PillCheckboxField label="Airless Compatible" id="compAirless" checked={formData.compAirless} onChange={handleInputChange} color="red" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px,1fr] md:gap-6 md:items-start">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 pt-1">
                Functional Compatibility
              </p>
              <div className="flex flex-col gap-4 w-full">
                <div className="flex flex-wrap gap-3">
                  <PillCheckboxField label="Pump Compatible" id="compPump" checked={formData.compPump} onChange={handleInputChange} />
                  <PillCheckboxField label="Leak Proof" id="compLeak" checked={formData.compLeak} onChange={handleInputChange} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label="Actives Compatible" id="compActives" value={formData.compActives} onChange={handleInputChange} />
                  <InputField label="Risk Level" id="compRisk" value={formData.compRisk} onChange={handleInputChange} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px,1fr] md:gap-6 md:items-start">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 pt-2">
                Compatibility Remarks
              </p>
              <TextareaField label="" id="compRemarks" value={formData.compRemarks} onChange={handleInputChange} />
            </div>
          </div>
        );

      case 6: // Vendors & Commercial
        return (
          <VendorCommercialEditor
            variant="pm"
            vendors={formData.vendors}
            tempFields={tempVendor}
            tempTiers={tempVendorTiers}
            vendorClientList={vendorClientList}
            onTempFieldChange={handlePmVendorTempFieldChange}
            onTempTierChange={handleTempVendorTierChange}
            onAddTempTierRow={handleAddTempVendorTierRow}
            onAddVendor={handleAddVendor}
            onRemoveVendor={handleRemoveVendor}
            errors={errors}
          />
        );

      case 7: // Secondary Packaging
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Label Type" id="secLabelType" value={formData.secLabelType} onChange={handleInputChange} />
              <InputField label="Label Size" id="secLabelSize" value={formData.secLabelSize} onChange={handleInputChange} />
              <InputField label="Adhesive Type" id="secAdhesive" value={formData.secAdhesive} onChange={handleInputChange} />
              <InputField label="Label Compatibility" id="secLabelCompat" value={formData.secLabelCompat} onChange={handleInputChange} />
              <InputField label="Paper GSM" id="secGsm" value={formData.secGsm} onChange={handleInputChange} />
              <InputField label="Carton Finish" id="secCartonFinish" value={formData.secCartonFinish} onChange={handleInputChange} />
              <InputField label="Fit & Finish" id="secFit" value={formData.secFit} onChange={handleInputChange} />
              <InputField label="Art Link" id="secArtLink" value={formData.secArtLink} onChange={handleInputChange} />
            </div>
            <TextareaField label="Secondary Packaging Notes" id="secNotes" value={formData.secNotes} onChange={handleInputChange} />
          </div>
        );

      case 8: // Tertiary Packaging
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Shipper Type" id="terShipType" value={formData.terShipType} onChange={handleInputChange} />
              <InputField label="Units per Shipper" id="terUnits" value={formData.terUnits} onChange={handleInputChange} />
              <InputField label="Drop Test (m)" id="terDrop" value={formData.terDrop} onChange={handleInputChange} />
              <InputField label="Stack Height (units)" id="terStack" value={formData.terStack} onChange={handleInputChange} />
            </div>
            <TextareaField label="Tertiary Packaging Notes" id="terNotes" value={formData.terNotes} onChange={handleInputChange} />
          </div>
        );

      case 9: // Testing & Approval
        return (
          <>
            <div className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Approvals</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CheckboxField label="Approved by Packaging" id="apprPack" checked={formData.apprPack} onChange={handleInputChange} />
                <CheckboxField label="Approved by R&D" id="apprRd" checked={formData.apprRd} onChange={handleInputChange} />
                <CheckboxField label="Approved by Finance" id="apprFin" checked={formData.apprFin} onChange={handleInputChange} />
                <CheckboxField label="Lock for Modification" id="apprLock" checked={formData.apprLock} onChange={handleInputChange} />
              </div>
            </div>
            <ArrayItemManager
              masterType="packaging"
              itemType="test"
              items={formData.tests}
              tempFields={tempTest}
              onTempFieldChange={(field, value) => setTempTest(prev => ({ ...prev, [field]: value }))}
              onAdd={handleAddTest}
              onRemove={handleRemoveTest}
              errors={errors}
              itemLabel="Test"
              columns={[
                { key: 'name', label: 'Test Name' },
                { key: 'result', label: 'Result' },
                { key: 'date', label: 'Test Date', type: 'date' },
                { key: 'by', label: 'Tested By' },
                { key: 'remarks', label: 'Remarks' },
              ]}
            />
          </>
        );

      case 10: // Catalogue / Website
        return (
          <div className="space-y-4">
            <div className="flex gap-6">
              <CheckboxField label="Visible on Catalogue" id="catVisible" checked={formData.catVisible} onChange={handleInputChange} />
              <CheckboxField label="Share with Clients" id="catShare" checked={formData.catShare} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Web Display Name" id="catWebName" value={formData.catWebName} onChange={handleInputChange} />
              <InputField label="Tags (comma-separated)" id="catTags" value={formData.catTags} onChange={handleInputChange} />
              <InputField label="Recommended Product Types" id="catRecoTypes" value={formData.catRecoTypes} onChange={handleInputChange} />
            </div>
            <TextareaField label="Web Images" id="catWebImages" value={formData.catWebImages} onChange={handleInputChange} />
          </div>
        );

      default:
        return null;
    }
  };

  // Load existing PM when editing — show loading until data is in, then fill form
  useEffect(() => {
    if (pageTab !== 'form' || !existingPmId) return;
    setCurrentSection(0);
    let cancelled = false;
    setEditPmLoading(true);
    fetchPackMaterialById(existingPmId).then(async (pm) => {
      if (cancelled) return;
      if (!pm) {
        setEditPmLoading(false);
        return;
      }
      const priceRow = await fetchPriceListRowForMaterial('PM', parseInt(String(existingPmId), 10));
      if (cancelled) return;
      setEditPmLoading(false);
      const fdObj = safeParseMaybeJsonObject(pm.form_data);
      const fdNormalizedRaw: any = fdObj ?? null;
      const resolvedPmCats = resolvePmEditCategories({
        code: pm.code,
        group: pm.group,
        material: pm.material,
        type: pm.type,
        form_data: fdObj,
      });

      const skuCatResolved =
        normalizePmSkuCategoryForSelect(String((fdObj as any)?.pmSkuCategory || '')) ||
        normalizePmSkuCategoryForSelect(resolvedPmCats.subCategory) ||
        normalizePmSkuCategoryForSelect(pm.group || '') ||
        normalizePmSkuCategoryForSelect(pm.material || '') ||
        '';

      const baseFromRecord = {
        itemCode: pm.code,
        name: pm.description || '',
        itemCategory: pm.type || '',
        level: pmLevelForSubCategory(skuCatResolved) || pm.level || '',
        pmSkuCategory: skuCatResolved,
        subCategory: skuCatResolved || resolvedPmCats.subCategory,
        optionalPmSubCategory: resolvedPmCats.optionalPmSubCategory,
        matBody: resolvedPmCats.optionalPmSubCategory || pm.material || '',
        specNominal: pm.sizeSpec || '',
        deco: pm.printStatus || '',
        zohoId: pm.zohoId ?? '',
        pkgSku: pm.zohoSkuCode ?? '',
        pkgHsn: pm.hsnCode ?? '',
        pkgUnit: pm.unit ?? 'PCS',
        pkgTaxPreference: pm.taxPref ?? '',
        pkgGst: (pm as any).gst != null ? String((pm as any).gst) : '',
        pkgReturnable: pm.pkgReturnable ?? false,
        pkgAssociateItems: pm.pkgAssociateItems ?? '',
      };

      const vendorsVal = fdNormalizedRaw ? (fdNormalizedRaw as any).vendors : undefined;
      const variantsVal = fdNormalizedRaw ? (fdNormalizedRaw as any).variants : undefined;
      const testsVal = fdNormalizedRaw ? (fdNormalizedRaw as any).tests : undefined;

      const vendorsNormalized = normalizePmVendors(vendorsVal);
      const vendorsMerged = mergePmVendorsWithPriceList(vendorsNormalized, priceRow);

      const fdNormalized = fdNormalizedRaw
        ? {
          ...(fdNormalizedRaw as typeof formData),
          vendors: vendorsMerged,
          variants: normalizePmVariants(variantsVal),
          tests: normalizePmTests(testsVal),
        }
        : null;

      const fdOverlay = fdNormalized ? removeNullish(fdNormalized as any) : null;

      const fdOverlayClean =
        fdOverlay && typeof fdOverlay === 'object'
          ? Object.fromEntries(
              Object.entries(fdOverlay).filter(
                ([k, v]) =>
                  v !== null &&
                  v !== undefined &&
                  ![
                    'subCategory',
                    'pmSkuCategory',
                    'optionalPmSubCategory',
                    'pmCategory',
                    'excelCategory',
                    'excelSubCategory',
                    'matBody',
                  ].includes(k)
              )
            )
          : null;

      setFormData((prev) => {
        const merged = {
          ...prev,
          ...baseFromRecord,
          ...(fdOverlayClean ? (fdOverlayClean as typeof prev) : {}),
          ...(vendorsMerged.length > 0 && !fdOverlayClean ? { vendors: vendorsMerged } : {}),
        };
        merged.subCategory = merged.pmSkuCategory || merged.subCategory;
        merged.pmSkuCategory =
          normalizePmSkuCategoryForSelect(merged.pmSkuCategory || merged.subCategory) || merged.pmSkuCategory;
        merged.subCategory = merged.pmSkuCategory;
        const lvl = pmLevelForSubCategory(merged.pmSkuCategory);
        if (lvl) merged.level = lvl;
        merged.optionalPmSubCategory =
          normalizePmDetailSubCategoryForSelect(merged.pmSkuCategory, merged.optionalPmSubCategory) ||
          merged.optionalPmSubCategory ||
          '';
        merged.matBody = merged.optionalPmSubCategory || merged.matBody || '';
        return merged;
      });

      setGeneratedCode(pm.code);
    }).catch(() => {
      setEditPmLoading(false);
    });
    return () => { cancelled = true; };
  }, [pageTab, existingPmId]);

  const isEditingPm = !!existingPmId;
  const closePmFormPopup = () => {
    resetPmFormToEmpty();
    setPageTab('bpr');
    setEditPmLoading(false);
  };

  // When editing PM, show loading until data is fetched
  if (pageTab === 'form' && existingPmId && editPmLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
        <BprDashboard
          refreshKey={0}
          onSwitchToForm={() => { resetPmFormToEmpty(); setPageTab('form'); }}
          onEditPm={(pm) => { setExistingPmId(pm.id); setPageTab('form'); setCurrentSection(0); }}
          onDeletePm={async (pm) => {
            if (!window.confirm(`Delete pack material "${pm.description}" (${pm.code})? This cannot be undone.`)) return;
            try {
              await deletePackMaterial(pm.id);
              addToast('success', 'Pack material deleted');
              queryClient.invalidateQueries({ queryKey: ['pack-materials-full-list'] });
            } catch (e) {
              addToast('error', e instanceof Error ? e.message : 'Failed to delete');
            }
          }}
        />
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4"
          onClick={closePmFormPopup}
        >
          <div
            className="w-full max-w-6xl my-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
              <div className="text-sm font-semibold text-gray-800">Loading…</div>
              <button
                type="button"
                onClick={closePmFormPopup}
                aria-label="Close packaging popup"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 text-xs font-medium"
              >
                <span aria-hidden>✕</span>
                <span>Close</span>
              </button>
            </div>
            <div className="min-h-[50vh] bg-[#f9fafb] flex items-center justify-center">
              <p className="text-gray-500">Loading pack material…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── BPR tab ──────────────────────────────────────────────────────────────────
  const bprNode = (
    <BprDashboard
      refreshKey={0}
      onSwitchToForm={() => { resetPmFormToEmpty(); setPageTab('form'); }}
      onEditPm={(pm) => { setExistingPmId(pm.id); setPageTab('form'); setCurrentSection(0); }}
      onDeletePm={async (pm) => {
        if (!window.confirm(`Delete pack material "${pm.description}" (${pm.code})? This cannot be undone.`)) return;
        try {
          await deletePackMaterial(pm.id);
          addToast('success', 'Pack material deleted');
          queryClient.invalidateQueries({ queryKey: ['pack-materials-full-list'] });
        } catch (e) {
          addToast('error', e instanceof Error ? e.message : 'Failed to delete');
        }
      }}
    />
  );

  if (pageTab === 'bpr') return bprNode;

  // ── PM master popup: same shell as Raw Material (centered card, overlay dismiss) ──
  return (
    <>
      {bprNode}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4"
        onClick={closePmFormPopup}
      >
        <div
          className="w-full max-w-6xl my-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
            <div className="text-sm font-semibold text-gray-800">
              {isEditingPm ? 'Edit Packaging Material' : 'New Packaging Material'}
            </div>
            <button
              type="button"
              onClick={closePmFormPopup}
              aria-label="Close packaging popup"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 text-xs font-medium"
            >
              <span aria-hidden>✕</span>
              <span>Close</span>
            </button>
          </div>

          <div className="max-h-[88vh] overflow-y-auto">
            {/* Toolbar — mirrors MasterFormBase (Raw Material master) */}
            <div className="bg-white border-b border-gray-200">
              <div className="w-full px-4 md:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-y-2 gap-x-6">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      resetPmFormToEmpty();
                      setPageTab('bpr');
                    }}
                    className="text-sm text-indigo-600 hover:underline font-medium shrink-0"
                  >
                    BPR Dashboard
                  </button>
                  <h1 className="text-base md:text-lg font-bold text-gray-800 leading-tight truncate">
                    Packaging Material Master Data
                  </h1>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => doSave(false)}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                  >
                    Reset Form
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 shadow-sm transition"
                  >
                    Review & submit
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 bg-gray-50">
              <div className="flex w-full min-w-0 flex-col gap-4 px-4 py-4 md:px-6 lg:flex-row lg:items-stretch lg:px-8">
                <aside className="flex w-full max-h-[min(40vh,320px)] shrink-0 flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm lg:max-h-[calc(88vh-8rem)] lg:w-60">
                  <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Sections</span>
                      <button
                        type="button"
                        onClick={() => setAutoSaveOn((prev) => !prev)}
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${autoSaveOn ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        Autosave: {autoSaveOn ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] text-gray-500 mb-1">Item Status</label>
                      <select
                        id="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {['Draft', 'Active', 'Discontinued', 'Under Review'].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-12">
                      <label className="block text-[10px] text-gray-500 mb-1">Version</label>
                      <div className="text-xs font-medium text-gray-700 pt-1">{formData.version}</div>
                    </div>
                  </div>

                  <nav className="flex-1 px-2 py-2 min-h-0 overflow-y-auto">
                    {SECTIONS.map((section, idx) => {
                      const navLocked = isNewPm && idx > 0 && !canAdvancePastPrimary;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (navLocked) {
                              addToast('info', 'Sync with Zoho on the primary section first.');
                              return;
                            }
                            setCurrentSection(idx);
                          }}
                          disabled={navLocked}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium mb-0.5 transition-colors ${
                            currentSection === idx
                              ? 'bg-indigo-50 text-indigo-700 font-semibold'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                          } ${navLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          {idx + 1}) {section}
                        </button>
                      );
                    })}
                  </nav>

                  <div className="px-4 py-3 border-t border-gray-100 text-[11px] text-gray-500">
                    {currentSection + 1}) {SECTIONS.length} sections
                  </div>

                  <div className="px-4 py-3 border-t border-gray-100 grid grid-cols-2 gap-x-3 gap-y-2">
                    {[
                      { label: 'Variants', value: formData.variants.length },
                      { label: 'Vendors', value: formData.vendors.length },
                      { label: 'Tests Logged', value: formData.tests.length },
                      { label: 'Last Saved', value: lastSaved },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <p className="text-[9px] uppercase text-gray-400 tracking-wide">{stat.label}</p>
                        <p className="text-sm font-bold text-gray-700">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </aside>

                <main className="flex-1 min-w-0 overflow-y-auto bg-gray-50 rounded-xl border border-gray-200 shadow-sm max-h-[calc(88vh-8rem)]">
                  <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                    <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6">
                      <h2 className="text-sm font-bold text-gray-800 truncate">{SECTIONS[currentSection]}</h2>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCurrentSection((prev) => Math.max(0, prev - 1))}
                          disabled={currentSection === 0}
                          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentSection((prev) => Math.min(SECTIONS.length - 1, prev + 1))}
                          disabled={
                            currentSection === SECTIONS.length - 1 ||
                            (isNewPm && currentSection === 0 && !canAdvancePastPrimary)
                          }
                          title={
                            isNewPm && currentSection === 0 && !canAdvancePastPrimary
                              ? 'Complete all required step-0 fields first (sub-category, code, item name, item type, and taxable HSN when applicable).'
                              : undefined
                          }
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="px-3 py-4 sm:px-4 sm:py-6">
                    <div className="mx-auto max-w-4xl min-w-0 space-y-4">
                      <div className="rounded-xl border border-gray-100 bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6">
                        {renderSection()}
                      </div>
                    </div>
                  </div>
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>
      <MasterSubmitPreviewModal
        isOpen={submitPreviewOpen}
        onClose={() => {
          if (submitConfirming) return;
          setSubmitPreviewOpen(false);
          setPendingPmPayload(null);
        }}
        onConfirm={handleConfirmSubmit}
        title={isEditingPm ? 'Preview — update packaging material' : 'Preview — new packaging material'}
        sections={pmPreviewSections}
        confirming={submitConfirming}
        isEdit={isEditingPm}
      />
    </>
  );
};

// ─── Pack Materials Dashboard ─────────────────────────────────────────────────

/** Same category badge hashing as Raw Material masters list (`RawMaterialForm`). */
const CATEGORY_STYLE_PALETTE: { bg: string; text: string; border: string }[] = [
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
];

function normalizeSkuKey(s: string): string {
  return String(s ?? '').trim().toLowerCase();
}

function buildPrProductLookup(products: PRProductListItem[]): Map<string, PRProductListItem> {
  const m = new Map<string, PRProductListItem>();
  for (const p of products) {
    const code = normalizeSkuKey(p.product_code ?? '');
    const zoho = normalizeSkuKey(p.zoho_sku_code ?? '');
    if (code) m.set(code, p);
    if (zoho && zoho !== code) m.set(zoho, p);
  }
  return m;
}

function getCategoryStyle(category: string): { bg: string; text: string; border: string } {
  if (!category) return CATEGORY_STYLE_PALETTE[CATEGORY_STYLE_PALETTE.length - 1];
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash << 5) - hash + category.charCodeAt(i);
  const index = Math.abs(hash) % CATEGORY_STYLE_PALETTE.length;
  return CATEGORY_STYLE_PALETTE[index];
}

function pmSubtitleLine(pm: PackMaterialRecord): string {
  const parts = [pm.material, pm.sizeSpec].map((s) => String(s ?? '').trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(' · ');
  const z = String(pm.zohoSkuCode ?? '').trim();
  return z || '—';
}

function pmGstDisplay(pm: PackMaterialRecord): string {
  const fd = pm.form_data;
  if (fd && typeof fd === 'object') {
    const raw = (fd as Record<string, unknown>).pkgGst;
    if (raw != null && String(raw).trim() !== '') {
      const s = String(raw).trim().replace(/%/g, '');
      const n = Number(s);
      if (Number.isFinite(n)) return `${n}%`;
      return String(raw).trim();
    }
  }
  return '—';
}

function removeNullish<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}

function normalizePmVendors(input: any): PmCommercialVendor[] {
  if (!Array.isArray(input)) return [];
  return input.map((v: any) => {
    const tiersRaw = v?.tiers;
    const tiers =
      Array.isArray(tiersRaw) && tiersRaw.length > 0
        ? tiersRaw.map((t: any) => ({
            moq: String(t?.moq ?? ''),
            price: String(t?.price ?? ''),
            validTill: String(t?.validTill ?? t?.valid_till ?? ''),
            note: String(t?.note ?? ''),
          }))
        : undefined;
    return {
      id: v?.id != null ? String(v.id) : undefined,
      name: String(v?.name ?? v?.venName ?? v?.vendorName ?? ''),
      location: String(v?.location ?? v?.venLocation ?? v?.vendorLocation ?? ''),
      moq: Number(v?.moq ?? v?.venMoq ?? v?.vendorMoq ?? 0),
      price: Number(v?.price ?? v?.unitPrice ?? v?.venPrice ?? v?.venUnitPrice ?? v?.vendorUnitPrice ?? 0),
      leadTime: Number(v?.leadTime ?? v?.lead_time_days ?? v?.venLT ?? v?.leadTimeDays ?? 0),
      approved: String(v?.approved ?? v?.venApproved ?? ''),
      priceType: String(v?.priceType ?? v?.venPriceType ?? ''),
      validTill: String(v?.validTill ?? v?.venValid ?? ''),
      sampleCost: Number(v?.sampleCost ?? v?.venSampleCost ?? 0),
      currency: v?.currency != null ? String(v.currency) : 'INR',
      advancePct: v?.advancePct != null ? String(v.advancePct) : '',
      preShipmentPct: v?.preShipmentPct != null ? String(v.preShipmentPct) : '',
      postShipmentPct: v?.postShipmentPct != null ? String(v.postShipmentPct) : '',
      creditDays: v?.creditDays != null ? String(v.creditDays) : '',
      tiers,
    };
  });
}

function normalizePmVariants(input: any): Array<{ id: string; volume: number; sameMold: string; moq: number; status: string }> {
  if (!Array.isArray(input)) return [];
  return input.map((r: any, idx: number) => ({
    id: String(r?.id ?? r?.varId ?? `V${idx + 1}`),
    volume: Number(r?.volume ?? r?.varVolume ?? 0),
    sameMold: String(r?.sameMold ?? r?.varSameMold ?? ''),
    moq: Number(r?.moq ?? r?.varMoq ?? 0),
    status: String(r?.status ?? r?.varStatus ?? 'Active'),
  }));
}

function normalizePmTests(input: any): Array<{ name: string; result: string; date: string; by: string; remarks: string }> {
  if (!Array.isArray(input)) return [];
  return input.map((t: any, idx: number) => ({
    name: String(t?.name ?? t?.testName ?? ''),
    result: String(t?.result ?? t?.testResult ?? ''),
    date: String(t?.date ?? t?.testDate ?? ''),
    by: String(t?.by ?? t?.testBy ?? ''),
    remarks: String(t?.remarks ?? t?.testRemarks ?? ''),
  }));
}

const BprDashboard: React.FC<{
  refreshKey?: number;
  onSwitchToForm: () => void;
  onEditPm: (pm: PackMaterialRecord) => void;
  onDeletePm: (pm: PackMaterialRecord) => void | Promise<void>;
}> = ({ refreshKey = 0, onSwitchToForm, onEditPm, onDeletePm }) => {
  const [searchParams] = useSearchParams();
  const pmFromQuery = searchParams.get('pm') ?? '';
  const [search, setSearch] = useState(pmFromQuery);
  const [linkedSkusModalPm, setLinkedSkusModalPm] = useState<PackMaterialRecord | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const itemRefFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkUploadRunning, setBulkUploadRunning] = useState(false);
  const [resetAllRunning, setResetAllRunning] = useState(false);

  const { data: prProductsLookupResult, isFetching: prProductsLookupLoading } = useQuery({
    queryKey: ['pr-products-lookup-for-pm-linked-skus'],
    queryFn: () => fetchPRProducts(),
    enabled: linkedSkusModalPm != null,
    staleTime: 5 * 60 * 1000,
  });

  const prProductLookup = useMemo(() => {
    const ok = prProductsLookupResult?.success === true;
    const rows = ok ? prProductsLookupResult.data ?? [] : [];
    return buildPrProductLookup(rows);
  }, [prProductsLookupResult]);

  const linkedSkuRows = useMemo(() => {
    if (!linkedSkusModalPm) return [];
    return linkedSkusModalPm.products.map((sku) => {
      const key = normalizeSkuKey(sku);
      const product = key ? prProductLookup.get(key) : undefined;
      return { sku, product };
    });
  }, [linkedSkusModalPm, prProductLookup]);

  const onPickItemReferenceExcel = useCallback(() => {
    itemRefFileInputRef.current?.click();
  }, []);

  const onResetAllMasters = useCallback(async () => {
    if (
      !window.confirm(
        'This permanently deletes ALL pack materials and cleans related data (warehouse PM rows, BOM & planning-batch PM lines, planning packaging snapshots, procurement PM links, items list PM entries). This cannot be undone. Continue?'
      )
    ) {
      return;
    }
    const typed = window.prompt('Type RESET_ALL_PACK_MATERIALS to confirm.');
    if (typed !== 'RESET_ALL_PACK_MATERIALS') {
      addToast('error', 'Confirmation text did not match. No changes were made.');
      return;
    }
    setResetAllRunning(true);
    try {
      const { deletedPackMaterials } = await resetAllPackMaterialsMaster();
      addToast('success', `Reset complete. Removed ${deletedPackMaterials} pack material(s).`);
      await queryClient.invalidateQueries({ queryKey: ['pack-materials-full-list'] });
      await queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'pack-materials-list' });
      await queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('items-list'),
      });
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetAllRunning(false);
    }
  }, [addToast, queryClient]);

  const onItemReferenceFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.xlsx') && !lower.endsWith('.xlsm')) {
        addToast('error', 'Please choose an Excel file (.xlsx or .xlsm).');
        return;
      }
      setBulkUploadRunning(true);
      try {
        const res = await postPackMaterialsMasterExcel(file);
        const s = res.summary;
        const rmSkip = res.raw_material_rows_skipped ?? 0;
        const rmNote = rmSkip > 0 ? ` (${rmSkip} raw material row(s) ignored.)` : '';
        const label = res.format === 'multi_sheet' ? 'Pack materials (multi-sheet)' : 'Pack materials (Item Reference)';
        addToast(
          'success',
          `${label}: ${s.packaging_created} created, ${s.packaging_updated} updated, ${s.skipped} skipped, ${s.errors} errors.${rmNote}`
        );
        void queryClient.invalidateQueries({ queryKey: ['pack-materials-full-list'] });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        addToast('error', msg);
      } finally {
        setBulkUploadRunning(false);
      }
    },
    [addToast, queryClient]
  );

  useEffect(() => {
    if (pmFromQuery) setSearch(pmFromQuery);
  }, [pmFromQuery]);

  const {
    data: allRows = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['pack-materials-full-list', refreshKey],
    queryFn: () => fetchPackMaterialsList(),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((p) =>
      [p.code, p.description, p.type, p.level, p.group, p.material, p.sizeSpec, p.printStatus, p.zohoSkuCode, p.unit].some((s) =>
        (s ?? '').toLowerCase().includes(q)
      )
    );
  }, [allRows, search]);

  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const rows = filteredRows.slice(startIndex, startIndex + pageSize);

  // Reset to page 1 when search or page size changes (same pattern as Products PR page).
  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, refreshKey]);

  const stats = {
    total: allRows.length,
    primary: allRows.filter((p) => (p.level || '') === 'Primary').length,
    secondary: allRows.filter((p) => (p.level || '') === 'Secondary').length,
    groups: allRows.filter((p) => p.group).length,
    types: new Set(allRows.map((p) => p.type).filter(Boolean)).size,
  };

  const statCards = [
    { label: 'TOTAL PMS', value: stats.total, sub: 'Unique pack materials', accent: 'border-l-teal-500', num: 'text-teal-600' },
    { label: 'PRIMARY', value: stats.primary, sub: 'Direct contact', accent: 'border-l-orange-400', num: 'text-orange-500' },
    { label: 'SECONDARY', value: stats.secondary, sub: 'Outer packaging', accent: 'border-l-blue-500', num: 'text-blue-600' },
    { label: 'PM GROUPS', value: stats.groups, sub: 'With affinities', accent: 'border-l-violet-500', num: 'text-violet-600' },
    { label: 'PACK TYPES', value: stats.types, sub: 'Tube, bottle…', accent: 'border-l-rose-500', num: 'text-rose-600' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
      <div className="px-6 md:px-10 py-8 space-y-6 w-full">

        {/* ── Page Header ── */}
        <div className="relative">
          <div className="absolute inset-0 bg-linear-to-r from-teal-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl"></span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">PM Masters</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Pack Materials</h1>
            <p className="text-sm text-gray-600">Manage packaging masters — tubes, bottles, cartons, labels, closures and their vendor details.</p>
          </div>
        </div>

        {/* ── Loading / Error ── */}
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <span className="animate-pulse">Loading pack materials…</span>
          </div>
        )}
        {!isLoading && error && (
          <div className="py-8 text-center">
            <p className="text-red-600 mb-2">{error instanceof Error ? error.message : 'Failed to load pack materials'}</p>
            <button type="button" onClick={() => refetch()} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Retry</button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* ── Stat Cards (same card chrome as Raw Material masters) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {statCards.map(card => (
                <div key={card.label} className={`group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden`}>
                  <div className={`h-1 bg-linear-to-r from-teal-400 to-teal-600 ${card.accent}`} />
                  <div className="px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">{card.label}</p>
                    <p className={`text-3xl font-extrabold mt-2 ${card.num} group-hover:scale-110 transition-transform origin-left`}>{card.value}</p>
                    <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors">{card.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Table Card (columns aligned with Raw Material masters list) ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">

              {/* toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-linear-to-r from-slate-50/50 to-transparent">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-gray-900">Packaging Material Masters</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200/50">{rows.length} / {totalFiltered}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={itemRefFileInputRef}
                    type="file"
                    accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(ev) => { void onItemReferenceFileChange(ev); }}
                  />
                  <button
                    type="button"
                    onClick={() => { void onResetAllMasters(); }}
                    disabled={bulkUploadRunning || resetAllRunning || isLoading}
                    title="Deletes all pack material master rows and scrubs linked warehouse, BOM, planning, and procurement data."
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-white text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    {resetAllRunning ? 'Resetting…' : 'Reset all masters'}
                  </button>
                  <button
                    type="button"
                    onClick={onPickItemReferenceExcel}
                    disabled={bulkUploadRunning}
                    title="Multi-tab PM workbook: Primary Packaging, Labels, Monocartons, Shrink Sleeves, Shippers %CFB, Fitness & Misc — row 4 headers (A–M), data from row 5. Legacy: sheet Item Reference (cols A–C, row 2+)."
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-teal-200 bg-white text-teal-700 text-xs font-semibold hover:bg-teal-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    {bulkUploadRunning ? 'Uploading…' : 'Item Reference Excel'}
                  </button>
                  <div className="relative group">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search name, INCI, code…"
                      className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all w-52"
                    />
                  </div>
                  <button
                    onClick={onSwitchToForm}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-linear-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-xs font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-md"
                  >
                    <span className="text-base leading-none">+</span> New PM
                  </button>
                </div>
              </div>

              {bulkUploadRunning && (
                <div className="px-6 py-3 border-b border-gray-100 bg-teal-50/40">
                  <div className="text-xs text-gray-700 mb-1.5 font-medium">Uploading workbook — server is parsing and importing in chunks…</div>
                  <div className="h-2.5 rounded-full bg-teal-100 overflow-hidden shadow-inner">
                    <div className="h-full w-full rounded-full bg-linear-to-r from-teal-500 to-teal-600 animate-pulse" />
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-linear-to-r from-slate-50/70 to-transparent">
                      <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600 select-none whitespace-nowrap hover:text-gray-900 hover:bg-slate-100/50 transition-colors">
                        CODE <span className="text-teal-500">Asc</span>
                      </th>
                      <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">Name / INCI</th>
                      <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Sub-category</th>
                      <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Type</th>
                      <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">UOM</th>
                      <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider text-gray-600">GST</th>
                      <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Status</th>
                      <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Products</th>
                      <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {totalFiltered === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">
                          <div className="flex flex-col items-center gap-2">
                            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            No packaging materials match your search.
                          </div>
                        </td>
                      </tr>
                    ) : rows.map((pm) => {
                      const catStyle = getCategoryStyle(pm.type || pm.level || '');
                      const uom = (pm.unit || 'PCS').trim() || 'PCS';
                      const statusLabel = (pm.printStatus || '').trim() || '—';
                      return (
                        <tr key={pm.code} className="hover:bg-linear-to-r hover:from-teal-50/50 hover:to-transparent transition-colors group border-b border-gray-50 last:border-0">
                          <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-teal-700 whitespace-nowrap group-hover:text-teal-900">{pm.code}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <p className="font-semibold text-gray-900 group-hover:text-teal-700 transition-colors">{pm.description}</p>
                            <p className="text-gray-400 text-[10px] mt-0.5 italic">{pmSubtitleLine(pm)}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all group-hover:shadow-sm ${catStyle.bg} ${catStyle.text} ${catStyle.border} whitespace-nowrap`}>
                              {pm.type || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-700 font-medium">{pm.level || '—'}</td>
                          <td className="px-4 py-3.5 text-gray-700 font-semibold">{uom}</td>
                          <td className="px-4 py-3.5 text-right text-gray-600 font-medium">{pmGstDisplay(pm)}</td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {pm.products.length === 0 ? (
                              <span className="text-gray-300 text-xs">—</span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLinkedSkusModalPm(pm);
                                }}
                                className="text-xs font-semibold text-teal-600 hover:text-teal-800 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-1 rounded"
                              >
                                View SKU ({pm.products.length})
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onEditPm(pm); }}
                              className="text-[10px] font-semibold text-teal-600 hover:text-teal-800 hover:underline mr-2"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onDeletePm(pm); }}
                              className="text-[10px] font-semibold text-red-600 hover:text-red-800 hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-t border-gray-100 bg-white">
                  <div className="text-xs text-gray-600">
                    Page <span className="font-semibold text-gray-900">{safeCurrentPage}</span> of{' '}
                    <span className="font-semibold text-gray-900">{totalPages}</span> • Showing{' '}
                    <span className="font-semibold text-gray-900">{totalFiltered === 0 ? 0 : startIndex + 1}</span>–{' '}
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
                      className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safeCurrentPage <= 1}
                      className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage >= totalPages}
                      className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {linkedSkusModalPm && (
              <div
                className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-6"
                role="presentation"
                onClick={() => setLinkedSkusModalPm(null)}
              >
                <div
                  className="my-auto w-full max-w-3xl max-h-[calc(100svh-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="pm-linked-skus-modal-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-slate-50 px-5 py-4">
                    <div className="min-w-0">
                      <h2 id="pm-linked-skus-modal-title" className="text-lg font-bold text-gray-900">
                        Linked product SKUs
                      </h2>
                      <p className="mt-1 truncate text-xs text-gray-600 font-mono">{linkedSkusModalPm.code}</p>
                      <p className="mt-0.5 text-sm text-gray-800">{linkedSkusModalPm.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLinkedSkusModalPm(null)}
                      className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-500 hover:bg-white hover:text-gray-800"
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-5 py-4">
                    {prProductsLookupLoading && (
                      <p className="mb-3 text-xs text-gray-500">Loading product master for names and details…</p>
                    )}
                    {prProductsLookupResult && prProductsLookupResult.success === false && (
                      <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Could not load Products master. SKUs from this pack material are still listed below.
                      </p>
                    )}
                    <p className="mb-3 text-xs text-gray-500">
                      When a linked code matches a product in the master list, the columns below are filled in from that product.
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full min-w-[420px] text-left text-xs">
                        <thead className="sticky top-0 z-1 border-b border-gray-200 bg-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Linked SKU / code</th>
                            <th className="px-3 py-2">Product name</th>
                            <th className="px-3 py-2">Category</th>
                            <th className="px-3 py-2">Subcategory</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-800">
                          {linkedSkuRows.map(({ sku, product }, i) => (
                            <tr key={`${sku}-${i}`} className="bg-white hover:bg-teal-50/40">
                              <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                              <td className="px-3 py-2 font-mono font-semibold text-teal-800 break-all">{sku}</td>
                              <td className="px-3 py-2 wrap-break-word">{product?.product_name ?? '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{product?.category ?? '—'}</td>
                              <td className="px-3 py-2 text-gray-600 wrap-break-word">{product?.pr_sub_category?.trim() || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{product?.status ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setLinkedSkusModalPm(null)}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

          </>
        )}

      </div>
    </div>
  );
};

// ─── Small field helpers ──────────────────────────────────────────────────────
const InputField: React.FC<{
  label: string; id: string; value: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  type?: string; placeholder?: string;
  error?: string;
  requiredMark?: boolean;
  readOnly?: boolean;
}> = ({ label, id, value, onChange, type = 'text', placeholder, error, requiredMark, readOnly }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {requiredMark ? <span className="text-red-600 ml-0.5" aria-hidden>*</span> : null}
    </label>
    <input
      type={type}
      id={id}
      value={value ?? ''}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      aria-invalid={error ? true : undefined}
      className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        error ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
      } ${readOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`}
    />
    {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
  </div>
);

type PmSelectOption = string | { value: string; label: string };

const SelectField: React.FC<{
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => void;
  options: readonly PmSelectOption[];
  disabled?: boolean;
  requiredMark?: boolean;
  error?: string;
}> = ({ label, id, value, onChange, options, disabled, requiredMark, error }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {requiredMark ? <span className="text-red-600 ml-0.5" aria-hidden>*</span> : null}
    </label>
    <select
      id={id}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        error ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
      } ${disabled ? 'bg-slate-100' : ''}`}
    >
      <option value="">Select sub-category…</option>
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const l = typeof opt === 'string' ? opt : opt.label;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
    {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
  </div>
);

const TextareaField: React.FC<{
  label: string; id: string; value: any;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; rows?: number; placeholder?: string;
}> = ({ label, id, value, onChange, rows = 3, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <textarea id={id} value={value ?? ''} onChange={onChange} rows={rows} placeholder={placeholder}
      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
  </div>
);

const CheckboxField: React.FC<{
  label: string; id: string; checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, id, checked, onChange }) => (
  <label className="flex items-center gap-2 text-sm cursor-pointer">
    <input type="checkbox" id={id} checked={checked} onChange={onChange}
      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500" />
    <span className="text-gray-700">{label}</span>
  </label>
);

const PillCheckboxField: React.FC<{
  label: string;
  id: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  color?: 'indigo' | 'red';
}> = ({ label, id, checked, onChange, color = 'indigo' }) => {
  const base =
    'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition-colors';
  const activeColor =
    color === 'red'
      ? 'bg-red-50 border-red-300 text-red-700'
      : 'bg-indigo-50 border-indigo-300 text-indigo-700';
  const inactiveColor = 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50';

  return (
    <label
      htmlFor={id}
      className={`${base} ${checked ? activeColor : inactiveColor}`}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={`h-1.5 w-1.5 rounded-full ${checked
            ? color === 'red'
              ? 'bg-red-500'
              : 'bg-indigo-500'
            : 'bg-gray-300'
          }`}
      />
      <span>{label}</span>
    </label>
  );
};

export default PackagingRefactored;
