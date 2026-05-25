import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import MasterFormBase from '../components/MasterFormBase';
import { MasterSubmitPreviewModal } from '../components/masters/MasterSubmitPreviewModal';
import { MasterSaveSuccessModal, type MasterSaveSuccessRow } from '../components/masters/MasterSaveSuccessModal';
import { RM_PREVIEW_SECTIONS } from '../constants/masterSubmitPreviewFields';
import { buildMasterPreviewSections } from '../utils/masterSubmitPreview';
import ArrayItemManager from '../components/ArrayItemManager';
import VendorCommercialEditor, {
  defaultTempVendorTiers,
  type RmCommercialVendor,
  type VendorTierDraft,
} from '../components/VendorCommercialEditor';
import { syncMasterVendorsToPriceList } from '../utils/syncVendorMasterToPriceList';
import { fetchPriceListRowForMaterial, mergeRmVendorsWithPriceList } from '../utils/mergeVendorsFromItemsList';
import { getPrimaryFields, validatePrimaryFields, validateMasterTaxDetails, GST_RATE_OPTIONS } from '../utils/masterFormUtils';
import { validateStagedPercents } from '../lib/stagedPaymentTerms';
import { fetchRawMaterialsList, createRawMaterial, updateRawMaterial, deleteRawMaterial, fetchRawMaterialById, fetchReservedStock, postRawMaterialsMasterExcel, resetAllRawMaterialsMaster, type RawMaterialRecord, type ReservedStockResponse } from '../services/rawMaterials.service';
import { fetchPRProducts, type PRProductListItem } from '../services/productsMaster.service';
import { fetchVendorClients, type VendorClientRecord } from '../services/vendorClient.service';
import {
  RM_SUB_CATEGORY_SKU_SELECT_OPTIONS,
  normalizeRmSubCategoryForSelect,
  normalizeRmDetailSubCategoryForSelect,
  rmDetailSubCategoryOptionsForSkuCategory,
  rmSkuCategoryRequiresDetailSubCategory,
} from '../constants/materialMasterSkuRules';
import { resolveRmEditCategories } from '../utils/masterImportCategoryResolve';

// ─── RM Category Code Series (industry buckets) ───────────────────────────────
const RM_CATEGORIES: Record<string, { label: string; prefix: string }> = {
  ACT:  { label: 'Actives / API', prefix: 'EI-RM-ACT' },
  EMOL: { label: 'Emollients / Oils / Esters', prefix: 'EI-RM-EMOL' },
  SURF: { label: 'Surfactants / Cleansing', prefix: 'EI-RM-SURF' },
  PRES: { label: 'Preservatives / Chelators', prefix: 'EI-RM-PRES' },
  FRAG: { label: 'Fragrance / Essential oils', prefix: 'EI-RM-FRAG' },
  THIC: { label: 'Thickeners / Polymers / Gums', prefix: 'EI-RM-THIC' },
  COL:  { label: 'Colorants / Pigments', prefix: 'EI-RM-COL' },
  BUF:  { label: 'Buffers / pH adjusters', prefix: 'EI-RM-BUF' },
  SOLV: { label: 'Solvents / Glycols / Alcohols', prefix: 'EI-RM-SOLV' },
  MISC: { label: 'Miscellaneous / Others', prefix: 'EI-RM-MISC' },
};

const RM_QC_GROUPS = ['Chemical QC', 'Microbiology', 'Physical QC', 'Packaging QC', 'Incoming QA'];
const RM_STORAGE_TYPES = ['Ambient – Dry', 'Ambient – Cool', 'Refrigerated (2–8°C)', 'Frozen', 'Flammable Store'];
/** Primary UoM choices when creating a new RM (backend/storage standard). */
const RM_NEW_PRIMARY_UOM_OPTIONS = ['KG', 'L'] as const;
const RM_EDIT_PRIMARY_UOM_OPTIONS = ['KG', 'GM', 'L', 'ML'] as const;

function rmSubCategoryLeadingDigit(sub: string): '1' | '2' | '3' | null {
  const canon = normalizeRmSubCategoryForSelect(sub);
  if (canon === 'Bulk raw materials') return '1';
  const k = String(sub || '').trim().toLowerCase();
  if (k === 'raw material' || k === 'raw materials' || k.includes('bulk raw')) return '1';
  if (k === 'fragrance' || k === 'fragrances') return '2';
  if (k === 'colors & pigments') return '3';
  return null;
}

function isRmClubItemsSubCategory(sub: string): boolean {
  const k = String(sub || '').trim().toLowerCase();
  return k === 'club items' || k === 'club item';
}

function inferRmCategoryKeyFromCode(code: string): string {
  if (!code) return '';
  for (const [k, v] of Object.entries(RM_CATEGORIES)) {
    if (code.startsWith(`${v.prefix}-`) || code === v.prefix) return k;
  }
  return '';
}

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

/** Fresh RM form state for new entry or after closing the popup (avoids stale data). */
function createEmptyRmFormData() {
  return {
    rmSku: '',
    zohoId: '',
    sku: '',
    rmTaxPreference: '',
    rmReturnable: '' as '' | 'Yes' | 'No',
    rmAssociateItems: '',
    rmCategoryKey: '',
    rmCategory: '',
    qcInspectionGroup: '',
    subCategory: '',
    optionalRmSubCategory: '',
    hazardHandlingClass: '',
    seriesPrefix: '',
    rmDefaultStorageType: '',
    inciName: '',
    tradeCommercialName: '',
    functionRole: '',
    rmType: '',
    casNo: '',
    einecs: '',
    countryOfOrigin: '',
    manufacturer: '',
    synonyms: '',
    internalNotes: '',
    primaryUom: '',
    issueUom: '',
    standardPackSize: '',
    hsnCode: '',
    gst: '',
    accountingCategory: '',
    preferredCurrency: 'INR',
    grade: '',
    compliance: '',
    allergenRequired: false,
    gmoRequired: false,
    sdsAvailable: false,
    coaAvailable: false,
    regulatoryNotes: '',
    assayPurity: '',
    appearanceSpec: '',
    phSpec: '',
    moistureLod: '',
    heavyMetalsSpec: '',
    microbialSpec: '',
    odorColorSpec: '',
    otherSpecs: '',
    recommendedUseLevel: '',
    maxUseLevel: '',
    solubility: '',
    processingGuidance: '',
    incompatibilities: '',
    stabilityNotes: '',
    claims: '',
    storageConditions: '',
    shelfLife: '',
    retestPeriod: '',
    warehouseLocation: '',
    batchTracking: '',
    fifoFefo: '',
    minimumStock: '',
    reorderLevel: '',
    handlingNotes: '',
    vendors: [] as RmCommercialVendor[],
    documents: [] as Array<{ id: string; type: string; link: string; date: string }>,
    tests: [] as Array<{
      id: string;
      name: string;
      result: string;
      date: string;
      approvedBy: string;
      remarks: string;
    }>,
  };
}

function parseVendorTierPrice(raw: string): number {
  const n = parseFloat(String(raw ?? '').replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

const RawMaterialRefactored: React.FC = () => {
 useItems(); // items list now loaded from API on dashboard
 const queryClient = useQueryClient();
 const { addToast } = useToast();
 const [errors, setErrors] = useState<Record<string, string>>({});
 const [currentStage, setCurrentStage] = useState(0);
 const [pageTab, setPageTab] = useState<'dashboard' | 'form'>('dashboard');
 const [existingRmId, setExistingRmId] = useState<string | null>(null);
 const [editRmLoading, setEditRmLoading] = useState(false);
 const [formData, setFormData] = useState(createEmptyRmFormData);

 // Temp fields separated
 const [tempVendor, setTempVendor] = useState({
  name: '',
  location: '',
  moq: '',
  unitPrice: '',
  leadTime: '',
  approved: '',
  priceValidTill: '',
  currency: 'INR',
  advancePct: '',
  preShipmentPct: '',
  postShipmentPct: '',
  creditDays: '',
 });
 const [tempVendorTiers, setTempVendorTiers] = useState<VendorTierDraft[]>(() => defaultTempVendorTiers(4));
 const [tempDocument, setTempDocument] = useState({ 
  type: '', link: '', date: '' 
 });
 const [tempTest, setTempTest] = useState({ 
  name: '', result: '', date: '', approvedBy: '', remarks: '' 
 });
 const [submitPreviewOpen, setSubmitPreviewOpen] = useState(false);
 const [pendingSavePayload, setPendingSavePayload] = useState<Record<string, unknown> | null>(null);
 const [submitConfirming, setSubmitConfirming] = useState(false);
 const [saveSuccessOpen, setSaveSuccessOpen] = useState(false);
 const [saveSuccessCode, setSaveSuccessCode] = useState('');
 const [saveSuccessRows, setSaveSuccessRows] = useState<MasterSaveSuccessRow[]>([]);
 const [saveSuccessZohoNote, setSaveSuccessZohoNote] = useState<string | null>(null);
 const [saveSuccessIsEdit, setSaveSuccessIsEdit] = useState(false);

 const focusFieldById = useCallback((fieldId: string) => {
  window.setTimeout(() => {
   const el = document.getElementById(fieldId);
   if (el instanceof HTMLElement) el.focus();
  }, 0);
 }, []);

 const resetRmFormToEmpty = useCallback(() => {
  setFormData(createEmptyRmFormData());
  setTempVendor({
   name: '',
   location: '',
   moq: '',
   unitPrice: '',
   leadTime: '',
   approved: '',
   priceValidTill: '',
   currency: 'INR',
   advancePct: '',
   preShipmentPct: '',
   postShipmentPct: '',
   creditDays: '',
  });
  setTempVendorTiers(defaultTempVendorTiers(4));
  setTempDocument({ type: '', link: '', date: '' });
  setTempTest({ name: '', result: '', date: '', approvedBy: '', remarks: '' });
  setErrors({});
  setCurrentStage(0);
 }, []);

 const { data: vendorClientData } = useQuery({
  queryKey: ['vendor-clients', 'vendor', 'raw-material-form'],
  queryFn: async () => {
   const res = await fetchVendorClients('vendor');
   return (res.success ? res.data : []) as VendorClientRecord[];
  },
  staleTime: 2 * 60 * 1000,
 });
 const vendorClientList = vendorClientData ?? [];

 const stages = [
  'Primary info (details, code & Books)',
  'Units, Tax & Procurement',
  'Technical & Regulatory',
  'Quality Specifications',
  'Usage in Formulation (R&D)',
  'Vendors & Commercial',
  'QA Testing & Documents',
  'Inventory, Storage & WH',
 ];

 const isNewRm = !existingRmId;
 const taxIsTaxable = formData.rmTaxPreference === 'Taxable';
 const rmDetailSubCategoryRequired = rmSkuCategoryRequiresDetailSubCategory(formData.subCategory);
 const rmDetailSubCategoryOptions = useMemo(() => {
  const base = rmDetailSubCategoryOptionsForSkuCategory(formData.subCategory);
  const cur = String(formData.optionalRmSubCategory ?? '').trim();
  if (cur && !base.some((o) => o.value === cur)) {
   return [{ value: cur, label: cur }, ...base];
  }
  return base;
 }, [formData.subCategory, formData.optionalRmSubCategory]);
 const canAdvancePastPrimary =
  !isNewRm ||
  Boolean(
    formData.subCategory?.trim() &&
    formData.inciName?.trim() &&
    formData.tradeCommercialName?.trim() &&
    formData.primaryUom?.trim() &&
    formData.rmTaxPreference?.trim() &&
    formData.rmReturnable?.trim() &&
    (!taxIsTaxable || (formData.hsnCode?.trim() && formData.gst?.toString().trim()))
  );
 const lockPrimaryFields = !!existingRmId;

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  const { id, value, type } = e.target;
  if (id === 'zohoId') return;
  if (id === 'hsnCode' || id === 'gst' || id === 'rmTaxPreference') {
   setErrors((prev) => {
    const next = { ...prev };
    delete next.hsnCode;
    delete next.gst;
    delete next.rmTaxPreference;
    return next;
   });
  }
  if (id === 'rmReturnable') {
   setErrors((prev) => {
    const next = { ...prev };
    delete next.rmReturnable;
    return next;
   });
  }
  if (id === 'primaryUom') {
   setErrors((prev) => {
    if (!prev.primaryUom) return prev;
    const next = { ...prev };
    delete next.primaryUom;
    return next;
   });
  }
  if (id === 'rmCategoryKey') {
   const cat = value ? RM_CATEGORIES[value] : null;
   setFormData(prev => ({
    ...prev,
    rmCategoryKey: value,
    rmCategory: cat ? cat.label : prev.rmCategory,
    seriesPrefix: '',
   }));
   return;
  }
  if (id === 'subCategory') {
   const next = value;
   const sku = String(formData.rmSku || '').trim();
   if (sku && existingRmId) {
    if (isRmClubItemsSubCategory(next)) {
     if (!sku.toUpperCase().startsWith('CLUB')) {
      addToast(
       'error',
       `This RM code (${sku}) must start with "CLUB" for Club items.`
      );
      return;
     }
    } else {
     const d = rmSubCategoryLeadingDigit(next);
     if (d && !sku.startsWith(d)) {
      addToast(
       'error',
       `This RM code (${sku}) does not start with "${d}", which is required for canonical sub-category "${next}".`
      );
      return;
     }
    }
   }
   setFormData((prev) => ({
    ...prev,
    subCategory: next,
    optionalRmSubCategory: normalizeRmDetailSubCategoryForSelect(next, prev.optionalRmSubCategory),
   }));
   setErrors((prev) => {
    const n = { ...prev };
    delete n.subCategory;
    delete n.optionalRmSubCategory;
    return n;
   });
   return;
  }
  if (id === 'optionalRmSubCategory') {
   setErrors((prev) => {
    if (!prev.optionalRmSubCategory) return prev;
    const n = { ...prev };
    delete n.optionalRmSubCategory;
    return n;
   });
  }
  setFormData(prev => ({
   ...prev,
   [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
  }));
 };

 // Vendor operations
 const handleAddVendor = () => {
  if (!tempVendor.name.trim()) {
   setErrors(prev => ({ ...prev, venName: 'Step 6 — Vendor name is required' }));
   addToast('error', 'Step 6 — Vendor name is required');
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
  if (tierRows.length === 0 && tempVendor.moq?.trim() && tempVendor.unitPrice?.trim()) {
   tierRows = [
    {
     moq: tempVendor.moq.trim(),
     price: tempVendor.unitPrice.trim(),
     validTill: tempVendor.priceValidTill || '',
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
     unitPrice: Number(tempVendor.unitPrice) || Number(first.price) || 0,
     leadTime: Number(tempVendor.leadTime),
     approved: tempVendor.approved,
     priceValidTill: tempVendor.priceValidTill,
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
   unitPrice: '',
   leadTime: '',
   approved: '',
   priceValidTill: '',
   currency: 'INR',
   advancePct: '',
   preShipmentPct: '',
   postShipmentPct: '',
   creditDays: '',
  });
  setTempVendorTiers(defaultTempVendorTiers(4));
  setErrors((prev) => {
   const next = { ...prev };
   delete next.venName;
   return next;
  });
 };

 const handleRemoveVendor = (index: number) => {
  setFormData((prev) => ({
   ...prev,
   vendors: prev.vendors.filter((_, i) => i !== index),
  }));
 };

 const handleVendorTempFieldChange = (field: string, value: string) => {
  setTempVendor((prev) => ({ ...prev, [field]: value }));
 };

 const handleTempVendorTierChange = (rowIdx: number, field: keyof VendorTierDraft, value: string) => {
  setTempVendorTiers((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [field]: value } : r)));
 };

 const handleAddTempVendorTierRow = () => {
  setTempVendorTiers((prev) => [...prev, { moq: '', price: '', validTill: '', note: '' }]);
 };

 const syncRmVendorsToItemsListAfterSave = async (rmId: number): Promise<number> => {
  if (!formData.vendors.length) return 0;
  const mid = parseInt(String(rmId), 10);
  if (Number.isNaN(mid)) return 0;
  const { created, errors } = await syncMasterVendorsToPriceList({
   variant: 'rm',
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

 // Document operations
 const handleAddDocument = () => {
  if (!tempDocument.type || !tempDocument.link.trim()) {
   setErrors(prev => ({ ...prev, documentType: 'Step 7 — Document type and link are required' }));
   addToast('error', 'Step 7 — Document type and link are required');
   return;
  }
  setFormData(prev => ({
   ...prev,
   documents: [...prev.documents, {
    id: Date.now().toString(),
    type: tempDocument.type,
    link: tempDocument.link,
    date: tempDocument.date,
   }]
  }));
  setTempDocument({ type: '', link: '', date: '' });
  setErrors((prev) => {
   const next = { ...prev };
   delete next.documentType;
   return next;
  });
 };

 const handleRemoveDocument = (id: string) => {
  setFormData(prev => ({
   ...prev,
   documents: prev.documents.filter(d => d.id !== id)
  }));
 };

 // Test operations
 const handleAddTest = () => {
  if (!tempTest.name || !tempTest.result) {
   setErrors(prev => ({ ...prev, testName: 'Step 7 — Test name and result are required' }));
   addToast('error', 'Step 7 — Test name and result are required');
   return;
  }
  setFormData(prev => ({
   ...prev,
   tests: [...prev.tests, {
    id: Date.now().toString(),
    name: tempTest.name,
    result: tempTest.result,
    date: tempTest.date,
    approvedBy: tempTest.approvedBy,
    remarks: tempTest.remarks,
   }]
  }));
  setTempTest({ name: '', result: '', date: '', approvedBy: '', remarks: '' });
  setErrors((prev) => {
   const next = { ...prev };
   delete next.testName;
   return next;
  });
 };

 const handleRemoveTest = (id: string) => {
  setFormData(prev => ({
   ...prev,
   tests: prev.tests.filter(t => t.id !== id)
  }));
 };

 const buildRmSavePayload = (): Record<string, unknown> | null => {
  if (!existingRmId) {
   if (!formData.subCategory?.trim()) {
    addToast('error', 'Category is required (Primary info step)');
    setCurrentStage(0);
    focusFieldById('subCategory');
    return null;
   }
  }
  if (!formData.rmReturnable?.trim()) {
   setErrors((prev) => ({
    ...prev,
    rmReturnable: 'Step 1 — Returnable Item is required (pick Yes or No)',
   }));
   addToast('error', 'Step 1 — Returnable Item is required (pick Yes or No)');
   setCurrentStage(0);
   focusFieldById('rmReturnable');
   return null;
  }
  if (!formData.primaryUom?.trim()) {
   const uomHint = isNewRm ? 'KG or L' : 'KG / GM / L / ML';
   setErrors((prev) => ({
    ...prev,
    primaryUom: `Step 1 — Primary UoM is required (pick ${uomHint})`,
   }));
   addToast('error', `Step 1 — Primary UoM is required (pick ${uomHint})`);
   setCurrentStage(0);
   focusFieldById('primaryUom');
   return null;
  }
  const validation = validatePrimaryFields(formData, 'rawMaterial', {
   omitFields: isNewRm ? ['rmSku'] : undefined,
  });
  const taxValidation = validateMasterTaxDetails(formData as Record<string, unknown>, 'rawMaterial');
  if (!validation.valid || !taxValidation.valid) {
   setErrors({ ...validation.errors, ...taxValidation.errors });
    const stageByField: Record<string, number> = {
      rmSku: 0,
      subCategory: 0,
      optionalRmSubCategory: 0,
      inciName: 0,
      tradeCommercialName: 0,
      primaryUom: 0,
      rmTaxPreference: 0,
      hsnCode: 0,
      gst: 0,
    };
    const firstPrimaryMissing = getPrimaryFields('rawMaterial').find((f) => Boolean(validation.errors[f]));
    const firstTaxMissing = ['rmTaxPreference', 'hsnCode', 'gst'].find((f) => Boolean(taxValidation.errors[f]));
    const firstField = firstTaxMissing || firstPrimaryMissing;
    if (firstField) {
      setCurrentStage(stageByField[firstField] ?? 0);
      focusFieldById(firstField);
    }
   if (!taxValidation.valid) {
    const firstTax = ['rmTaxPreference', 'hsnCode', 'gst'].find((f) => Boolean(taxValidation.errors[f]));
    addToast(
     'error',
     firstTax
      ? taxValidation.errors[firstTax]
      : 'Select a Tax Preference and (for Taxable) fill a valid HSN code and GST % (Step 1).'
    );
    setCurrentStage(0);
   } else {
    const firstPrimary = getPrimaryFields('rawMaterial').find((f) => Boolean(validation.errors[f]));
    const firstMsg =
     (firstPrimary && validation.errors[firstPrimary]) ||
     Object.values(validation.errors)[0] ||
     Object.values(taxValidation.errors)[0];
    addToast('error', firstMsg || 'Please fill all required fields');
   }
   return null;
  }
  const skuTrim = String(formData.rmSku || '').trim();
  if (skuTrim) {
   if (isRmClubItemsSubCategory(formData.subCategory)) {
    if (!skuTrim.toUpperCase().startsWith('CLUB')) {
     addToast('error', 'Internal RM code must start with "CLUB" for Club items.');
     setCurrentStage(0);
     focusFieldById('rmSku');
     return null;
    }
   } else {
    const digitForSub = rmSubCategoryLeadingDigit(formData.subCategory);
    if (digitForSub && !skuTrim.startsWith(digitForSub)) {
     addToast(
      'error',
      `Internal RM code must start with "${digitForSub}" for sub-category "${formData.subCategory}".`
     );
     setCurrentStage(0);
     focusFieldById('rmSku');
     return null;
    }
   }
  }
  const payload: Record<string, unknown> = {
   ...(formData as Record<string, unknown>),
   rmCategory: formData.subCategory?.trim() || formData.rmCategory,
   category: formData.subCategory?.trim() || formData.rmCategory,
  };
  if (isNewRm) {
   delete payload.rmSku;
   delete payload.sku;
  }
  delete payload.specific_gravity;
  delete payload.specificGravity;
  return payload;
 };

 const rmPreviewFormData = useMemo(
  () => ({
   ...(formData as Record<string, unknown>),
   ...(isNewRm ? { rmSku: '(Assigned on save)', sku: '(Assigned on save)' } : {}),
  }),
  [formData, isNewRm]
 );

 const rmPreviewSections = useMemo(
  () => buildMasterPreviewSections(rmPreviewFormData, RM_PREVIEW_SECTIONS),
  [rmPreviewFormData]
 );

 const handleSubmit = () => {
  const savePayload = buildRmSavePayload();
  if (!savePayload) return;
  setPendingSavePayload(savePayload);
  setSubmitPreviewOpen(true);
 };

 const closeSaveSuccessAndExit = () => {
  setSaveSuccessOpen(false);
  setSaveSuccessCode('');
  setSaveSuccessRows([]);
  setSaveSuccessZohoNote(null);
  setExistingRmId(null);
  resetRmFormToEmpty();
  setPageTab('dashboard');
 };

 const handleConfirmSubmit = async () => {
  const savePayload = pendingSavePayload;
  if (!savePayload) return;
  setSubmitConfirming(true);
  try {
   if (existingRmId) {
    const rmIdForSync = parseInt(String(existingRmId), 10);
    const record = await updateRawMaterial(existingRmId, savePayload);
    const syncCreated = Number.isNaN(rmIdForSync) ? 0 : await syncRmVendorsToItemsListAfterSave(rmIdForSync);
    setSaveSuccessIsEdit(true);
    setSaveSuccessCode(record.code || formData.rmSku || '');
    setSaveSuccessRows([
     { label: 'INCI name', value: record.inci || formData.inciName || '' },
     { label: 'Trade / commercial name', value: record.name || formData.tradeCommercialName || '' },
     { label: 'Category', value: record.category || formData.subCategory || '' },
     { label: 'Primary UoM', value: record.uom || formData.primaryUom || '' },
     ...(syncCreated > 0
      ? [{ label: 'Items List', value: `${syncCreated} vendor rate(s) synced` }]
      : []),
    ]);
    setSaveSuccessZohoNote(null);
   } else {
    const { record, zohoSync } = await createRawMaterial(savePayload);
    const newRmId = parseInt(String(record.id), 10);
    const syncCreated = Number.isNaN(newRmId) ? 0 : await syncRmVendorsToItemsListAfterSave(newRmId);
    setSaveSuccessIsEdit(false);
    setSaveSuccessCode(record.code || '');
    setSaveSuccessRows([
     { label: 'INCI name', value: record.inci || formData.inciName || '' },
     { label: 'Trade / commercial name', value: record.name || formData.tradeCommercialName || '' },
     { label: 'Category', value: record.category || formData.subCategory || '' },
     { label: 'Primary UoM', value: record.uom || formData.primaryUom || '' },
     ...(syncCreated > 0
      ? [{ label: 'Items List', value: `${syncCreated} vendor rate(s) synced` }]
      : []),
    ]);
    if (zohoSync?.synced === false && zohoSync.error) {
     setSaveSuccessZohoNote(
      `Saved in Esthetic Insights, but Zoho Books sync failed: ${zohoSync.error}`
     );
    } else if (zohoSync?.synced && zohoSync.item_id) {
     setSaveSuccessZohoNote(`Linked to Zoho Books (item ${zohoSync.item_id}).`);
    } else {
     setSaveSuccessZohoNote(null);
    }
   }
   queryClient.invalidateQueries({ queryKey: ['raw-materials-full-list'] });
   setSubmitPreviewOpen(false);
   setPendingSavePayload(null);
   setSaveSuccessOpen(true);
  } catch (err) {
   console.error(err);
   addToast('error', err instanceof Error ? err.message : 'Failed to save raw material');
  } finally {
   setSubmitConfirming(false);
  }
 };

 // Stage content rendering
 const renderStageContent = () => {
  switch (currentStage) {
  case 0: // Primary info — category, code, identity, Zoho
  {
   return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
     <div className="min-w-0">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Category &amp; sub-category</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
       <SelectField
        label="Category"
        id="subCategory"
        value={formData.subCategory}
        onChange={handleInputChange}
        options={[...RM_SUB_CATEGORY_SKU_SELECT_OPTIONS]}
        requiredMark
        error={errors.subCategory}
        disabled={lockPrimaryFields}
       />
       {rmDetailSubCategoryRequired ? (
        <SelectField
         label="Sub-category (optional)"
         id="optionalRmSubCategory"
         value={formData.optionalRmSubCategory}
         onChange={handleInputChange}
         options={rmDetailSubCategoryOptions}
         error={errors.optionalRmSubCategory}
         disabled={lockPrimaryFields || !formData.subCategory?.trim()}
        />
       ) : (
        <InputField
         label="Sub-category (optional)"
         id="optionalRmSubCategory"
         value={formData.optionalRmSubCategory}
         onChange={handleInputChange}
         placeholder={isRmClubItemsSubCategory(formData.subCategory) ? 'Optional note for club items' : 'Select a category first'}
         error={errors.optionalRmSubCategory}
         disabled={!formData.subCategory?.trim()}
        />
       )}
      </div>
      <p className="text-xs text-gray-500 mt-2">
       Category drives the internal SKU prefix (<span className="font-mono">1</span> bulk,{' '}
       <span className="font-mono">2</span> fragrance, <span className="font-mono">3</span> colors, or{' '}
       <span className="font-mono">CLUB</span>). Sub-category lists depend on the category you pick.
      </p>
     </div>

     {isNewRm ? (
      <div>
       <label className="block text-sm font-medium text-gray-700 mb-1">Internal RM code (SKU)</label>
       <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
        {isRmClubItemsSubCategory(formData.subCategory) ? (
         <>
          Assigned on save: <span className="font-mono">CLUB</span> plus five digits (e.g.{' '}
          <span className="font-mono text-gray-800">CLUB00019</span>).
         </>
        ) : (
         <>
          Assigned on save: leading digit from sub-category (<span className="font-mono">1</span>,{' '}
          <span className="font-mono">2</span>, or <span className="font-mono">3</span>) plus six digits — seven
          digits total (e.g. <span className="font-mono text-gray-800">1000001</span>).
         </>
        )}
       </div>
      </div>
     ) : (
      <div>
       <label className="block text-sm font-medium text-gray-700 mb-1">Internal RM code (SKU)</label>
       <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-mono text-gray-800">
        {formData.rmSku || '—'}
       </div>
      </div>
     )}

     <div className="border-t border-gray-200 pt-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Identity</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
       <InputField
        label="INCI Name"
        id="inciName"
        value={formData.inciName}
        onChange={handleInputChange}
        placeholder="Official INCI name as per supplier / standard"
        requiredMark
        readOnly={lockPrimaryFields}
       />
       <InputField
        label="Trade/Commercial Name"
        id="tradeCommercialName"
        value={formData.tradeCommercialName}
        onChange={handleInputChange}
        placeholder="What vendor calls this raw material"
        requiredMark
        readOnly={lockPrimaryFields}
       />
       <SelectField
        label="Primary UoM"
        id="primaryUom"
        value={formData.primaryUom}
        onChange={handleInputChange}
        options={isNewRm ? [...RM_NEW_PRIMARY_UOM_OPTIONS] : [...RM_EDIT_PRIMARY_UOM_OPTIONS]}
        disabled={lockPrimaryFields}
        requiredMark
        error={errors.primaryUom}
       />
      </div>
      <p className="text-xs text-gray-500 mt-2">
       {isNewRm
        ? 'New raw materials use KG (mass) or L (volume) only. KG ↔ L conversion uses per-line Specific Gravity on the PR Formula BOM (Planning BOM confirmation).'
        : 'Base unit this RM is bought, stored and issued in. Mass/volume conversions (e.g. KG ↔ L) use per-line Specific Gravity on the PR Formula BOM — not on the RM master.'}
      </p>
     </div>

     <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Tax Classification</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
       <SelectField
        label="Returnable Item"
        id="rmReturnable"
        value={formData.rmReturnable}
        onChange={handleInputChange}
        options={['Yes', 'No']}
        disabled={lockPrimaryFields}
        requiredMark
        error={errors.rmReturnable}
       />
       <SelectField
        label="Tax Preference"
        id="rmTaxPreference"
        value={formData.rmTaxPreference}
        onChange={handleInputChange}
        options={['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST']}
        disabled={lockPrimaryFields}
        requiredMark
        error={errors.rmTaxPreference}
       />
       {taxIsTaxable ? (
        <>
         <InputField
          label="HSN Code"
          id="hsnCode"
          value={formData.hsnCode}
          onChange={handleInputChange}
          placeholder="Tax classification code"
          error={errors.hsnCode}
          requiredMark
         />
         <SelectField
          label="GST %"
          id="gst"
          value={formData.gst}
          onChange={handleInputChange}
          options={GST_RATE_OPTIONS.map((v) => ({ value: v, label: `${v}%` }))}
          requiredMark
          error={errors.gst}
         />
        </>
       ) : null}
      </div>
      <p className="text-xs text-gray-500 mt-2">
       Taxable: HSN and GST % are required on this step. Exempted / NonGST: HSN / GST not needed.
      </p>
     </div>

    </div>
   );
  }

   case 1: // Units & Procurement
    return (
     <div className="min-w-0 space-y-5 sm:space-y-6">
      <div>
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Classification</h3>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField
         label="Hazard Handling Class"
         id="hazardHandlingClass"
         value={formData.hazardHandlingClass}
         onChange={handleInputChange}
         placeholder="e.g. Flammable, Corrosive, General"
        />
       </div>
      </div>

      <div>
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Procurement</h3>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField
         label="Standard Pack Size"
         id="standardPackSize"
         value={formData.standardPackSize}
         onChange={handleInputChange}
         placeholder="e.g. 25 KG bag, 200 KG drum"
        />
        <SelectField
         label="Preferred Currency"
         id="preferredCurrency"
         value={formData.preferredCurrency}
         onChange={handleInputChange}
         options={['INR', 'USD', 'EUR', 'GBP']}
        />
       </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Zoho Books</h3>
       <p className="text-xs text-gray-500 mb-3">
        {isNewRm
         ? 'Internal RM code is assigned on save and synced to Zoho Books with your tax preferences (or both roll back if Books fails).'
         : 'Internal RM code is fixed; Zoho item ID is read-only.'}
       </p>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField
         label="Zoho Item ID"
         id="zohoId"
         value={formData.zohoId}
         onChange={() => {}}
         placeholder="Populated from the server after save (when Books sync is on)"
         readOnly
        />
       </div>
       <div className="mt-3">
        <TextareaField
         label="Associate Items"
         id="rmAssociateItems"
         value={formData.rmAssociateItems}
         onChange={handleInputChange}
         placeholder="Link related RM / PM / packaging codes if any"
        />
       </div>
       <p className="text-xs text-gray-500 mt-2">Zoho Item ID is read-only — returned by the API after a successful save.</p>
      </div>
     </div>
    );

   case 2: // Technical & Regulatory
    return (
     <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50/50">
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Optional — Classification</h3>
       <p className="text-xs text-gray-500 mb-3">Not required to create the RM; complete when available.</p>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField
         label="Grade"
         id="grade"
         value={formData.grade}
         onChange={handleInputChange}
         placeholder="e.g. Cosmetic Grade, Pharma Grade"
        />
        <InputField
         label="Compliance/Certificate"
         id="compliance"
         value={formData.compliance}
         onChange={handleInputChange}
         placeholder="e.g. COSMOS, ECOCERT, RSPO"
        />
        <InputField
         label="Accounting Category"
         id="accountingCategory"
         value={formData.accountingCategory}
         onChange={handleInputChange}
         placeholder="ERP / finance category mapping"
        />
       </div>
      </div>

      <div>
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Technical Identity</h3>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField
         label="Function/Role"
         id="functionRole"
         value={formData.functionRole}
         onChange={handleInputChange}
         placeholder="e.g. Emulsifier, Preservative, Fragrance"
        />
        <InputField
         label="Type"
         id="rmType"
         value={formData.rmType}
         onChange={handleInputChange}
         placeholder="e.g. Liquid, Powder, Paste"
        />
        <InputField
         label="CAS Number"
         id="casNo"
         value={formData.casNo}
         onChange={handleInputChange}
         placeholder="e.g. 9004-99-3"
        />
        <InputField
         label="EINECS Number"
         id="einecs"
         value={formData.einecs}
         onChange={handleInputChange}
         placeholder="If applicable"
        />
        <InputField
         label="Country of Origin"
         id="countryOfOrigin"
         value={formData.countryOfOrigin}
         onChange={handleInputChange}
         placeholder="e.g. India, France"
        />
        <InputField
         label="Manufacturer"
         id="manufacturer"
         value={formData.manufacturer}
         onChange={handleInputChange}
         placeholder="Manufacturer / principal supplier"
        />
       </div>
      </div>

      <div>
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Notes</h3>
       <div className="space-y-3">
        <TextareaField
         label="Synonyms"
         id="synonyms"
         value={formData.synonyms}
         onChange={handleInputChange}
         placeholder="Other names used internally or by vendors"
        />
        <TextareaField
         label="Internal Notes"
         id="internalNotes"
         value={formData.internalNotes}
         onChange={handleInputChange}
         placeholder="Any internal-only remarks for R&D, QC, or Purchase"
        />
        <TextareaField
         label="Regulatory Notes"
         id="regulatoryNotes"
         value={formData.regulatoryNotes}
         onChange={handleInputChange}
         placeholder="Any specific restrictions, region notes, or regulatory info"
        />
       </div>
      </div>

      <div>
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Regulatory Flags</h3>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CheckboxField label="Allergen Declaration Required" id="allergenRequired" checked={formData.allergenRequired} onChange={handleInputChange} />
        <CheckboxField label="GMO Test Required" id="gmoRequired" checked={formData.gmoRequired} onChange={handleInputChange} />
        <CheckboxField label="SDS Available" id="sdsAvailable" checked={formData.sdsAvailable} onChange={handleInputChange} />
        <CheckboxField label="CoA Available" id="coaAvailable" checked={formData.coaAvailable} onChange={handleInputChange} />
       </div>
      </div>
     </div>
    );

   case 3: // Quality Specifications
    return (
     <div className="min-w-0 space-y-5 sm:space-y-6">
      <div>
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Specifications</h3>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField
         label="Assay/Purity %"
         id="assayPurity"
         value={formData.assayPurity}
         onChange={handleInputChange}
         placeholder="e.g. NLT 98%"
        />
        <InputField
         label="Appearance Spec"
         id="appearanceSpec"
         value={formData.appearanceSpec}
         onChange={handleInputChange}
         placeholder="e.g. Clear, colourless liquid"
        />
        <InputField
         label="pH Range"
         id="phSpec"
         value={formData.phSpec}
         onChange={handleInputChange}
         placeholder="e.g. 5.0 – 7.0"
        />
        <InputField
         label="Moisture / LOD %"
         id="moistureLod"
         value={formData.moistureLod}
         onChange={handleInputChange}
         placeholder="e.g. NMT 2%"
        />
        <InputField
         label="Heavy Metals Spec"
         id="heavyMetalsSpec"
         value={formData.heavyMetalsSpec}
         onChange={handleInputChange}
         placeholder="e.g. Pb, As, Cd limits"
        />
        <InputField
         label="Microbial Spec"
         id="microbialSpec"
         value={formData.microbialSpec}
         onChange={handleInputChange}
         placeholder="e.g. TAMC / TYMC limits"
        />
        <InputField
         label="Odor & Color Spec"
         id="odorColorSpec"
         value={formData.odorColorSpec}
         onChange={handleInputChange}
         placeholder="e.g. Characteristic odour, pale yellow"
        />
       </div>
       <div className="mt-3">
        <TextareaField
         label="Other Specifications"
         id="otherSpecs"
         value={formData.otherSpecs}
         onChange={handleInputChange}
         placeholder="Any additional quality criteria"
        />
       </div>
      </div>
     </div>
    );

   case 4: // Usage in Formulation
    return (
     <div className="min-w-0 space-y-5 sm:space-y-6">
      <div>
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Use Levels</h3>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField
         label="Recommended Use Level %"
         id="recommendedUseLevel"
         value={formData.recommendedUseLevel}
         onChange={handleInputChange}
         placeholder="e.g. 1.0 – 3.0"
        />
        <InputField
         label="Max Use Level %"
         id="maxUseLevel"
         value={formData.maxUseLevel}
         onChange={handleInputChange}
         placeholder="Absolute maximum allowed in formula"
        />
        <InputField
         label="Solubility (in what?)"
         id="solubility"
         value={formData.solubility}
         onChange={handleInputChange}
         placeholder="e.g. Soluble in oils / water / glycols"
        />
       </div>
      </div>

      <div>
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Formulation Notes</h3>
       <div className="space-y-3">
        <TextareaField
         label="Processing Guidance"
         id="processingGuidance"
         value={formData.processingGuidance}
         onChange={handleInputChange}
         placeholder="Order of addition, temperature, special handling"
        />
        <TextareaField
         label="Incompatibilities"
         id="incompatibilities"
         value={formData.incompatibilities}
         onChange={handleInputChange}
         placeholder="Actives, pH ranges, or other materials to avoid"
        />
        <TextareaField
         label="Stability Notes"
         id="stabilityNotes"
         value={formData.stabilityNotes}
         onChange={handleInputChange}
         placeholder="Known stability observations from vendor / internal data"
        />
        <TextareaField
         label="Claims Supported"
         id="claims"
         value={formData.claims}
         onChange={handleInputChange}
         placeholder="e.g. Moisturizing, anti-aging, anti-dandruff (with evidence)"
        />
       </div>
      </div>
     </div>
    );

   case 5: // Vendors & Commercial
    return (
     <VendorCommercialEditor
      variant="rm"
      vendors={formData.vendors}
      tempFields={tempVendor}
      tempTiers={tempVendorTiers}
      vendorClientList={vendorClientList}
      onTempFieldChange={handleVendorTempFieldChange}
      onTempTierChange={handleTempVendorTierChange}
      onAddTempTierRow={handleAddTempVendorTierRow}
      onAddVendor={handleAddVendor}
      onRemoveVendor={handleRemoveVendor}
      errors={errors}
     />
    );

   case 6: // QA Testing & Documents
    return (
     <div className="space-y-8">
      <div>
       <h3 className="font-semibold text-gray-700 mb-4">QA Testing Results</h3>
       <ArrayItemManager
        masterType="rawMaterial"
        itemType="test"
        items={formData.tests}
        tempFields={tempTest}
        onTempFieldChange={(field, value) => setTempTest(prev => ({ ...prev, [field]: value }))}
        onAdd={handleAddTest}
        onRemove={(idx) => handleRemoveTest(formData.tests[idx].id)}
        errors={errors}
        itemLabel="Test"
        columns={[
         { key: 'name', label: 'Test Name', required: true },
         { key: 'result', label: 'Result', required: true },
         { key: 'date', label: 'Test Date', type: 'date' },
         { key: 'approvedBy', label: 'Approved By' },
         { key: 'remarks', label: 'Remarks' },
        ]}
       />
      </div>
      <div>
       <h3 className="font-semibold text-gray-700 mb-4">QA Documents & Certificates</h3>
       <ArrayItemManager
        masterType="rawMaterial"
        itemType="document"
        items={formData.documents}
        tempFields={tempDocument}
        onTempFieldChange={(field, value) => setTempDocument(prev => ({ ...prev, [field]: value }))}
        onAdd={handleAddDocument}
        onRemove={(idx) => handleRemoveDocument(formData.documents[idx].id)}
        errors={errors}
        itemLabel="Document"
        columns={[
         { key: 'type', label: 'Document Type' },
         { key: 'link', label: 'Link / Path' },
         { key: 'date', label: 'Issue Date', type: 'date' },
        ]}
       />
      </div>
     </div>
    );

   case 7: // Inventory, Storage & WH
    return (
     <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50/50">
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Optional — QC & Default Storage</h3>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className="block text-sm font-medium text-gray-700 mb-1">QC Inspection Group</label>
         <select
          id="qcInspectionGroup"
          value={formData.qcInspectionGroup}
          onChange={handleInputChange}
          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
         >
          <option value="">Select</option>
          {RM_QC_GROUPS.map((g) => (
           <option key={g} value={g}>{g}</option>
          ))}
         </select>
        </div>
        <div>
         <label className="block text-sm font-medium text-gray-700 mb-1">Default Storage Location Type</label>
         <select
          id="rmDefaultStorageType"
          value={formData.rmDefaultStorageType}
          onChange={handleInputChange}
          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
         >
          <option value="">Select</option>
          {RM_STORAGE_TYPES.map((s) => (
           <option key={s} value={s}>{s}</option>
          ))}
         </select>
        </div>
        <InputField
         label="Issue UoM"
         id="issueUom"
         value={formData.issueUom}
         onChange={handleInputChange}
         placeholder="Unit in which material is issued"
        />
       </div>
      </div>

      <div>
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Storage & Shelf Life</h3>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField
         label="Shelf Life"
         id="shelfLife"
         value={formData.shelfLife}
         onChange={handleInputChange}
         placeholder="e.g. 24 months from DOM"
        />
        <InputField
         label="Re-test Period"
         id="retestPeriod"
         value={formData.retestPeriod}
         onChange={handleInputChange}
         placeholder="e.g. 12 months"
        />
        <InputField
         label="Warehouse Location"
         id="warehouseLocation"
         value={formData.warehouseLocation}
         onChange={handleInputChange}
         placeholder="Default bin / rack / zone"
        />
        <InputField
         label="Batch Tracking Required"
         id="batchTracking"
         value={formData.batchTracking}
         onChange={handleInputChange}
         placeholder="e.g. Batch-wise, Lot-wise, Not required"
        />
        <InputField
         label="FIFO / FEFO"
         id="fifoFefo"
         value={formData.fifoFefo}
         onChange={handleInputChange}
         placeholder="Policy used in WH (e.g. FIFO / FEFO)"
        />
        <InputField
         label="Minimum Stock"
         id="minimumStock"
         value={formData.minimumStock}
         onChange={handleInputChange}
         placeholder="Trigger level for planning / purchase"
        />
        <InputField
         label="Reorder Level"
         id="reorderLevel"
         value={formData.reorderLevel}
         onChange={handleInputChange}
         placeholder="When replenishment must be initiated"
        />
       </div>
      </div>

      <div>
       <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Handling Notes</h3>
       <div className="space-y-3">
        <TextareaField
         label="Storage Conditions"
         id="storageConditions"
         value={formData.storageConditions}
         onChange={handleInputChange}
         placeholder="e.g. Store below 25°C, protect from light"
        />
        <TextareaField
         label="Handling Notes"
         id="handlingNotes"
         value={formData.handlingNotes}
         onChange={handleInputChange}
         placeholder="Special handling instructions for stores / production"
        />
       </div>
      </div>
     </div>
    );

   default:
    return <p>No content</p>;
  }
 };

 // Load existing RM when editing — always populate from API; use form_data if present, else map from record
 useEffect(() => {
  if (pageTab !== 'form' || !existingRmId) return;
  setCurrentStage(0);
  let cancelled = false;
  setEditRmLoading(true);
  fetchRawMaterialById(existingRmId).then(async (result) => {
   if (cancelled) return;
   if (!result) {
    setEditRmLoading(false);
    return;
   }
   const priceRow = await fetchPriceListRowForMaterial('RM', parseInt(String(existingRmId), 10));
   if (cancelled) return;
   setEditRmLoading(false);
   const fdObj = safeParseMaybeJsonObject(result.form_data);
   const vendorsVal = (fdObj as any)?.vendors;
   const docsVal = (fdObj as any)?.documents;
   const testsVal = (fdObj as any)?.tests;

   // Normalize array item key variants (older persisted shapes) into the current UI shape.
   // UI expects:
   //  - vendors: { id, name, location, moq, unitPrice, leadTime, approved, priceValidTill }
   //  - documents: { id, type, link, date }
   //  - tests: { id, name, result, date, approvedBy, remarks }
   let fdNormalized = fdObj as Record<string, unknown> | null;
   if (fdNormalized) {
     if (Array.isArray(vendorsVal)) {
       fdNormalized = {
         ...fdNormalized,
         vendors: vendorsVal.map((v: any, idx: number) => {
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
            id: String(v?.id ?? v?.vendorId ?? idx),
            name: String(v?.name ?? v?.venName ?? v?.vendorName ?? ''),
            location: String(v?.location ?? v?.venLocation ?? v?.vendorLocation ?? ''),
            moq: Number(v?.moq ?? v?.venMoq ?? v?.vendorMoq ?? 0),
            unitPrice: Number(v?.unitPrice ?? v?.venPrice ?? v?.venUnitPrice ?? v?.vendorUnitPrice ?? 0),
            leadTime: Number(v?.leadTime ?? v?.venLT ?? v?.leadTimeDays ?? 0),
            approved: String(v?.approved ?? v?.venApproved ?? ''),
            priceValidTill: String(v?.priceValidTill ?? v?.venValid ?? v?.validTill ?? ''),
            currency: v?.currency != null ? String(v.currency) : 'INR',
            advancePct: v?.advancePct != null ? String(v.advancePct) : '',
            preShipmentPct: v?.preShipmentPct != null ? String(v.preShipmentPct) : '',
            postShipmentPct: v?.postShipmentPct != null ? String(v.postShipmentPct) : '',
            creditDays: v?.creditDays != null ? String(v.creditDays) : '',
            tiers,
           };
          }),
       };
     }
     if (Array.isArray(docsVal)) {
       fdNormalized = {
         ...fdNormalized,
         documents: docsVal.map((d: any, idx: number) => ({
           id: String(d?.id ?? d?.documentId ?? idx),
           type: String(d?.type ?? d?.documentType ?? ''),
           link: String(d?.link ?? d?.documentLink ?? d?.path ?? ''),
           date: String(d?.date ?? d?.documentDate ?? ''),
         })),
       };
     }
     if (Array.isArray(testsVal)) {
       fdNormalized = {
         ...fdNormalized,
         tests: testsVal.map((t: any, idx: number) => ({
           id: String(t?.id ?? t?.testId ?? idx),
           name: String(t?.name ?? t?.testName ?? ''),
           result: String(t?.result ?? t?.testResult ?? ''),
           date: String(t?.date ?? t?.testDate ?? ''),
           approvedBy: String(t?.approvedBy ?? t?.testBy ?? ''),
           remarks: String(t?.remarks ?? t?.testRemarks ?? ''),
         })),
       };
     }
   }

   const vArr =
     fdNormalized && Array.isArray((fdNormalized as { vendors?: RmCommercialVendor[] }).vendors)
       ? ((fdNormalized as { vendors: RmCommercialVendor[] }).vendors)
       : [];
   const mergedVendors = mergeRmVendorsWithPriceList(vArr, priceRow);
   if (fdNormalized) {
     (fdNormalized as { vendors: RmCommercialVendor[] }).vendors = mergedVendors;
   } else if (mergedVendors.length > 0) {
     fdNormalized = { vendors: mergedVendors } as Record<string, unknown>;
   }

   const r = result.record;
   const recordCode = r.code ?? '';
   const resolvedCats = resolveRmEditCategories({
     code: recordCode,
     category: r.category,
     rmType: r.rmType,
     group: r.group,
     form_data: fdObj,
   });

   const fdDebug = {
     existingRmId,
     recordCode,
     recordInci: r.inci ?? null,
     recordName: r.name ?? null,
     recordCategory: r.category ?? null,
     recordRmType: r.rmType ?? null,
     formDataKeys: fdObj ? Object.keys(fdObj) : null,
     rmSku: (fdObj as any)?.rmSku ?? null,
     inciName: (fdObj as any)?.inciName ?? null,
     rmCategoryKey: (fdObj as any)?.rmCategoryKey ?? null,
     vendorsIsArray: Array.isArray(vendorsVal),
     vendorsLen: Array.isArray(vendorsVal) ? vendorsVal.length : null,
     documentsIsArray: Array.isArray(docsVal),
     documentsLen: Array.isArray(docsVal) ? docsVal.length : null,
     testsIsArray: Array.isArray(testsVal),
     testsLen: Array.isArray(testsVal) ? testsVal.length : null,
   };
   console.log('[RM Edit Populate Debug]', JSON.stringify(fdDebug, null, 2));

   // Partial imports may persist `vendors` as non-array; normalize below instead of blocking edit.

   // Always seed from the list-view record, because partial/empty `form_data` can override defaults.
   const productsList = Array.isArray(r.products) ? r.products : [];
   const recordMapped = {
     rmSku: recordCode || '',
     inciName: r.inci ?? '',
     tradeCommercialName: r.name ?? '',
     subCategory: resolvedCats.subCategory,
     optionalRmSubCategory: resolvedCats.optionalRmSubCategory,
     rmCategory: resolvedCats.rmCategory || (r.category ?? ''),
     rmCategoryKey: resolvedCats.rmCategoryKey || inferRmCategoryKeyFromCode(recordCode) || '',
     seriesPrefix: (() => {
       const inf = resolvedCats.rmCategoryKey || inferRmCategoryKeyFromCode(recordCode);
       return inf ? RM_CATEGORIES[inf]?.prefix ?? '' : '';
     })(),
     rmType: resolvedCats.rmType || (r.rmType ?? ''),
     primaryUom: r.uom ?? '',
     gst: String(r.gst ?? ''),
     shelfLife: r.shelf ?? '',
     zohoId: r.zohoId ?? '',
     sku: r.zohoSkuCode ?? '',
     hsnCode: r.hsnCode ?? '',
     rmTaxPreference: r.taxPref ?? '',
     accountingCategory: r.salesPurchaseAccount ?? '',
     /** Linked PR / product codes from list row when `form_data` is missing (legacy imports). */
     rmAssociateItems: productsList.length > 0 ? productsList.join('\n') : '',
   };

   // Overlay only non-nullish `form_data` keys.
   const fdToOverlay = (fdNormalized ?? fdObj) as Record<string, unknown> | null;
   const fdCleanOverlay =
     fdToOverlay && typeof fdToOverlay === 'object'
       ? Object.fromEntries(
           Object.entries(fdToOverlay).filter(
             ([k, v]) =>
               v !== null &&
               v !== undefined &&
               ![
                 'subCategory',
                 'rmCategoryKey',
                 'rmCategory',
                 'excelCategory',
                 'excelSubCategory',
                 'rmType',
                 'rm_type',
                 'sub_category',
                 'rm_category_key',
               ].includes(k)
           )
         )
       : null;

  setFormData((prev) => {
    const merged = { ...prev, ...recordMapped, ...(fdCleanOverlay ?? {}) } as typeof prev;

    merged.subCategory =
      normalizeRmSubCategoryForSelect(resolvedCats.subCategory) ||
      normalizeRmSubCategoryForSelect(r.category ?? '') ||
      normalizeRmSubCategoryForSelect(r.group ?? '') ||
      resolvedCats.subCategory;
    const parentForDetail = merged.subCategory;
    merged.optionalRmSubCategory =
      normalizeRmDetailSubCategoryForSelect(parentForDetail, resolvedCats.optionalRmSubCategory) ||
      normalizeRmDetailSubCategoryForSelect(parentForDetail, merged.optionalRmSubCategory) ||
      resolvedCats.optionalRmSubCategory ||
      merged.optionalRmSubCategory ||
      '';
    merged.rmCategory = resolvedCats.rmCategory || merged.rmCategory;
    merged.rmType = resolvedCats.rmType;
    if (!Array.isArray((merged as { vendors?: unknown }).vendors)) {
      (merged as { vendors: RmCommercialVendor[] }).vendors = mergedVendors;
    }

    // `rmReturnable` is a required Yes/No selector in the UI, but older records may
    // have persisted it as a plain boolean inside form_data. Coerce back to the
    // current UI shape so edit loads don't silently skip the required state.
    const rawReturnable: unknown = (merged as any).rmReturnable;
    if (rawReturnable === true) (merged as any).rmReturnable = 'Yes';
    else if (rawReturnable === false) (merged as any).rmReturnable = 'No';
    else if (rawReturnable !== 'Yes' && rawReturnable !== 'No') (merged as any).rmReturnable = '';

    // Scalar key normalization for older persisted shapes.
    const anyFd: any = fdCleanOverlay ?? fdNormalized ?? fdObj ?? {};
    if (!merged.rmSku) merged.rmSku = String(anyFd?.sku ?? anyFd?.code ?? '');
     if (!merged.inciName) merged.inciName = String(anyFd?.inciName ?? anyFd?.inci ?? anyFd?.inci_name ?? '');
     if (!merged.tradeCommercialName) {
       merged.tradeCommercialName = String(anyFd?.tradeCommercialName ?? anyFd?.trade_commercial_name ?? anyFd?.name ?? merged.tradeCommercialName ?? '');
     }
     if (!merged.rmType) merged.rmType = String(anyFd?.rmType ?? anyFd?.rm_type ?? merged.rmType ?? '');
     if (!merged.primaryUom) merged.primaryUom = String(anyFd?.primaryUom ?? anyFd?.uom ?? merged.primaryUom ?? '');

     const sku = String(merged.rmSku || '').trim();
     if (!merged.rmCategoryKey && sku) {
       const inferred = inferRmCategoryKeyFromCode(sku);
       if (inferred) {
         merged.rmCategoryKey = inferred;
         merged.seriesPrefix = RM_CATEGORIES[inferred]?.prefix ?? merged.seriesPrefix;
       }
     }
     return merged;
   });
  }).catch(() => {
   setEditRmLoading(false);
  });
  return () => { cancelled = true; };
 }, [pageTab, existingRmId]);

  const dashboardNode = (
    <RawMaterialDashboard
      refreshKey={0}
      onSwitchToForm={() => {
        setExistingRmId(null);
        resetRmFormToEmpty();
        setPageTab('form');
      }}
      onEditRm={(rm) => { setExistingRmId(rm.id); setPageTab('form'); setCurrentStage(0); }}
      onDeleteRm={async (rm) => {
        if (!window.confirm(`Delete raw material "${rm.name}" (${rm.code})? This cannot be undone.`)) return;
        try {
          await deleteRawMaterial(rm.id);
          addToast('success', 'Raw material deleted');
          queryClient.invalidateQueries({ queryKey: ['raw-materials-full-list'] });
        } catch (e) {
          addToast('error', e instanceof Error ? e.message : 'Failed to delete');
        }
      }}
    />
  );

  if (pageTab === 'dashboard') {
    return dashboardNode;
  }

  const isEditLoading = pageTab === 'form' && !!existingRmId && editRmLoading;
  const isEditing = !!existingRmId;
  const closeFormPopup = () => {
    setExistingRmId(null);
    setPageTab('dashboard');
    setEditRmLoading(false);
    resetRmFormToEmpty();
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50">
      {dashboardNode}
      {pageTab === 'form' && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4"
          onClick={closeFormPopup}
        >
          <div
            className="w-full max-w-6xl my-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
              <div className="text-sm font-semibold text-gray-800">
                {isEditing ? 'Edit Raw Material' : 'New Raw Material'}
              </div>
              <button
                type="button"
                onClick={closeFormPopup}
                aria-label="Close raw material popup"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 text-xs font-medium"
              >
                <span aria-hidden>✕</span>
                <span>Close</span>
              </button>
            </div>

            <div className="max-h-[88vh] overflow-y-auto">
              {isEditLoading ? (
                <div className="min-h-[60vh] bg-[#f9fafb] flex items-center justify-center">
                  <p className="text-gray-500">Loading raw material…</p>
                </div>
              ) : (
                <MasterFormBase
                  title="Raw Material Master Data"
                  stages={stages}
                  currentStage={currentStage}
                  onStageChange={setCurrentStage}
                  errors={errors}
                  formData={formData}
                  onInputChange={handleInputChange}
                  primaryFields={getPrimaryFields('rawMaterial')}
                  onSubmit={handleSubmit}
                  nextDisabled={isNewRm && !canAdvancePastPrimary}
                  nextDisabledTitle="Fill all required step-1 fields (category, sub-category when applicable, INCI, trade/commercial name, primary UoM, returnable item, tax preference, and taxable HSN/GST when applicable). For new RMs, internal code is assigned on save."
                  isStageDisabled={(idx) => isNewRm && idx > 0 && !canAdvancePastPrimary}
                >
                  {renderStageContent()}
                </MasterFormBase>
              )}
            </div>
          </div>
        </div>
      )}
      <MasterSubmitPreviewModal
        isOpen={submitPreviewOpen}
        onClose={() => {
          if (submitConfirming) return;
          setSubmitPreviewOpen(false);
          setPendingSavePayload(null);
        }}
        onConfirm={handleConfirmSubmit}
        title={isEditing ? 'Preview — update raw material' : 'Preview — new raw material'}
        sections={rmPreviewSections}
        confirming={submitConfirming}
        isEdit={isEditing}
      />
      <MasterSaveSuccessModal
        isOpen={saveSuccessOpen}
        onClose={closeSaveSuccessAndExit}
        title={saveSuccessIsEdit ? 'Raw material updated' : 'Raw material created'}
        subtitle={
         saveSuccessIsEdit
          ? 'Changes are saved. Internal code cannot be changed here.'
          : 'Your raw material is saved with the internal code below (assigned by the server).'
        }
        generatedCode={saveSuccessCode}
        codeLabel="Internal RM code (SKU)"
        rows={saveSuccessRows}
        zohoNote={saveSuccessZohoNote}
      />
    </div>
  );
};

type RawMaterialDashboardProps = {
 refreshKey?: number;
 onSwitchToForm: () => void;
 onEditRm: (rm: RawMaterialRecord) => void;
 onDeleteRm: (rm: RawMaterialRecord) => void | Promise<void>;
};

function normalizeSkuKey(s: string): string {
 return String(s ?? '').trim().toLowerCase();
}

/** Map product_code and zoho_sku_code (lowercased) → product row for RM “linked products” enrichment. */
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

/** Palette of category badge styles; any category (including new ones from API) gets a stable style via hash. */
const CATEGORY_STYLE_PALETTE: { bg: string; text: string; border: string }[] = [
 { bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200' },
 { bg: 'bg-green-50',    text: 'text-green-700',    border: 'border-green-200' },
 { bg: 'bg-slate-100',   text: 'text-slate-600',    border: 'border-slate-200' },
 { bg: 'bg-orange-50',   text: 'text-orange-700',   border: 'border-orange-200' },
 { bg: 'bg-red-50',      text: 'text-red-700',      border: 'border-red-200' },
 { bg: 'bg-yellow-50',   text: 'text-yellow-700',   border: 'border-yellow-200' },
 { bg: 'bg-violet-50',   text: 'text-violet-700',   border: 'border-violet-200' },
 { bg: 'bg-pink-50',     text: 'text-pink-700',     border: 'border-pink-200' },
 { bg: 'bg-cyan-50',     text: 'text-cyan-700',     border: 'border-cyan-200' },
 { bg: 'bg-blue-50',     text: 'text-blue-700',     border: 'border-blue-200' },
 { bg: 'bg-indigo-50',   text: 'text-indigo-700',   border: 'border-indigo-200' },
 { bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200' },
 { bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-200' },
 { bg: 'bg-sky-50',      text: 'text-sky-700',     border: 'border-sky-200' },
 { bg: 'bg-gray-100',    text: 'text-gray-600',     border: 'border-gray-200' },
];

function getCategoryStyle(category: string): { bg: string; text: string; border: string } {
 if (!category) return CATEGORY_STYLE_PALETTE[CATEGORY_STYLE_PALETTE.length - 1];
 let hash = 0;
 for (let i = 0; i < category.length; i++) hash = ((hash << 5) - hash) + category.charCodeAt(i);
 const index = Math.abs(hash) % CATEGORY_STYLE_PALETTE.length;
 return CATEGORY_STYLE_PALETTE[index];
}

const RawMaterialDashboard: React.FC<RawMaterialDashboardProps> = ({ refreshKey = 0, onSwitchToForm, onEditRm, onDeleteRm }) => {
 const [search, setSearch] = useState('');
 const [pageSize, setPageSize] = useState(25);
 const [currentPage, setCurrentPage] = useState(1);
 const [linkedSkusModalRm, setLinkedSkusModalRm] = useState<RawMaterialRecord | null>(null);
 const queryClient = useQueryClient();
 const { addToast } = useToast();
 const itemRefFileInputRef = useRef<HTMLInputElement>(null);
 const [bulkUploadRunning, setBulkUploadRunning] = useState(false);
 const [resetAllRunning, setResetAllRunning] = useState(false);

 const { data: prProductsLookupResult, isFetching: prProductsLookupLoading } = useQuery({
  queryKey: ['pr-products-lookup-for-rm-linked-skus'],
  queryFn: () => fetchPRProducts(),
  enabled: linkedSkusModalRm != null,
  staleTime: 5 * 60 * 1000,
 });

 const prProductLookup = useMemo(() => {
  const ok = prProductsLookupResult?.success === true;
  const rows = ok ? prProductsLookupResult.data ?? [] : [];
  return buildPrProductLookup(rows);
 }, [prProductsLookupResult]);

 const linkedSkuRows = useMemo(() => {
  if (!linkedSkusModalRm) return [];
  return linkedSkusModalRm.products.map((sku) => {
   const key = normalizeSkuKey(sku);
   const product = key ? prProductLookup.get(key) : undefined;
   return { sku, product };
  });
 }, [linkedSkusModalRm, prProductLookup]);

 const onResetAllMasters = useCallback(async () => {
  if (
   !window.confirm(
    'This permanently deletes ALL raw materials and cleans related data (warehouse RM rows, BOM & planning-batch RM lines, planning RM snapshots, procurement RM links, items list RM entries, universal swap history). This cannot be undone. Continue?'
   )
  ) {
   return;
  }
  const typed = window.prompt('Type RESET_ALL_RAW_MATERIALS to confirm.');
  if (typed !== 'RESET_ALL_RAW_MATERIALS') {
   addToast('error', 'Confirmation text did not match. No changes were made.');
   return;
  }
  setResetAllRunning(true);
  try {
   const { deletedRawMaterials } = await resetAllRawMaterialsMaster();
   addToast('success', `Reset complete. Removed ${deletedRawMaterials} raw material(s).`);
   await queryClient.invalidateQueries({ queryKey: ['raw-materials-full-list'] });
   await queryClient.invalidateQueries({ queryKey: ['raw-materials-list'] });
   await queryClient.invalidateQueries({
    predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('items-list'),
   });
  } catch (err) {
   addToast('error', err instanceof Error ? err.message : 'Reset failed');
  } finally {
   setResetAllRunning(false);
  }
 }, [addToast, queryClient]);

 const onPickItemReferenceExcel = useCallback(() => {
   itemRefFileInputRef.current?.click();
 }, []);

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
       const res = await postRawMaterialsMasterExcel(file);
       const s = res.summary;
       const pmSkip = res.packaging_rows_skipped ?? 0;
       const pmNote = pmSkip > 0 ? ` (${pmSkip} packaging row(s) ignored.)` : '';
       const label = res.format === 'multi_sheet' ? 'Raw materials (multi-sheet)' : 'Raw materials (Item Reference)';
       addToast(
         'success',
         `${label}: ${s.raw_material_created} created, ${s.raw_material_updated} updated, ${s.skipped} skipped, ${s.errors} errors.${pmNote}`
       );
       void queryClient.invalidateQueries({ queryKey: ['raw-materials-full-list'] });
     } catch (err) {
       const msg = err instanceof Error ? err.message : 'Upload failed';
       addToast('error', msg);
     } finally {
       setBulkUploadRunning(false);
     }
   },
   [addToast, queryClient]
 );

 const {
    data: allRows = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['raw-materials-full-list', refreshKey],
    queryFn: () => fetchRawMaterialsList(),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) =>
      [r.code, r.name, r.inci, r.category, r.rmType, r.zohoSkuCode].some((s) => (s ?? '').toLowerCase().includes(q))
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
    active: allRows.filter((r) => String(r.status).toLowerCase() === 'active').length,
    uvFilters: allRows.filter((r) => (r.category || '') === 'UV FILTER').length,
    surfactants: allRows.filter((r) => (r.category || '') === 'SURFACTANT').length,
    categories: new Set(allRows.map((r) => r.category).filter(Boolean)).size,
  };

 const statCards = [
  { label: 'TOTAL RMS',   value: stats.total,       sub: 'Unique raw materials',  accent: 'border-l-teal-500',   num: 'text-teal-600' },
  { label: 'ACTIVE',      value: stats.active,      sub: 'Approved status',        accent: 'border-l-orange-400', num: 'text-orange-500' },
  { label: 'UV FILTERS',  value: stats.uvFilters,   sub: 'Sunscreen actives',      accent: 'border-l-blue-500',   num: 'text-blue-600' },
  { label: 'SURFACTANTS', value: stats.surfactants, sub: 'Facewash actives',       accent: 'border-l-violet-500', num: 'text-violet-600' },
  { label: 'SUB-CATEGORIES', value: stats.categories, sub: 'Distinct types', accent: 'border-l-rose-500', num: 'text-rose-600' },
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
       <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">RM Masters</span>
      </div>
      <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Raw Materials</h1>
      <p className="text-sm text-gray-600">Manage raw material masters, INCI details, pricing and item group assignments.</p>
     </div>
    </div>

    {/* ── Loading / Error ── */}
    {isLoading && (
     <div className="flex items-center justify-center py-12 text-gray-500">
      <span className="animate-pulse">Loading raw materials…</span>
     </div>
    )}
    {!isLoading && error && (
     <div className="py-8 text-center">
     <p className="text-red-600 mb-2">{error instanceof Error ? error.message : 'Failed to load raw materials'}</p>
     <button type="button" onClick={() => refetch()} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Retry</button>
     </div>
    )}

    {!isLoading && !error && (
     <>
    {/* ── Stat Cards ── */}
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

    {/* ── Table Card ── */}
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">

     {/* toolbar */}
     <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-linear-to-r from-slate-50/50 to-transparent">
      <div className="flex items-center gap-2 min-w-0">
       <span className="text-sm font-semibold text-gray-900">Raw Material Masters</span>
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
        title="Deletes all raw material master rows and scrubs linked warehouse, BOM, planning, and procurement data."
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-white text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
       >
        {resetAllRunning ? 'Resetting…' : 'Reset all masters'}
       </button>
       <button
        type="button"
        onClick={onPickItemReferenceExcel}
        disabled={bulkUploadRunning}
        title="Multi-tab RM workbook: tabs Raw Materials, Fragrances, Colors & Pigments, Club Items — row 4 headers (A–M), data from row 5. Legacy: sheet Item Reference (cols A–C, row 2+)."
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-teal-200 bg-white text-teal-700 text-xs font-semibold hover:bg-teal-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
       >
        {bulkUploadRunning ? 'Uploading…' : 'Item Reference Excel'}
       </button>
       {/* search */}
       <div className="relative group">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
        </svg>
        <input
         value={search}
         onChange={e => setSearch(e.target.value)}
         placeholder="Search name, INCI, code…"
         className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all w-52"
        />
       </div>
      {/* category filter removed (server-side pagination uses search + backend ordering) */}
       {/* new RM button */}
       <button
        onClick={onSwitchToForm}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-linear-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-xs font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-md"
       >
        <span className="text-base leading-none">+</span> New RM
       </button>
      </div>
     </div>

     {bulkUploadRunning && (
      <div className="px-6 py-3 border-b border-gray-100 bg-teal-50/40">
       <div className="text-xs text-gray-700 mb-1.5 font-medium">Uploading workbook — server is parsing and importing…</div>
       <div className="h-2.5 rounded-full bg-teal-100 overflow-hidden shadow-inner">
        <div className="h-full w-full rounded-full bg-linear-to-r from-teal-500 to-teal-600 animate-pulse" />
       </div>
      </div>
     )}

     {/* table */}
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
            No raw materials match your search.
           </div>
          </td>
         </tr>
       ) : rows.map((rm, _idx) => {
         const catStyle = getCategoryStyle(rm.category);
         return (
          <tr key={rm.code} className="hover:bg-linear-to-r hover:from-teal-50/50 hover:to-transparent transition-colors group border-b border-gray-50 last:border-0">
           {/* code */}
           <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-teal-700 whitespace-nowrap group-hover:text-teal-900">{rm.code}</td>
           {/* name / inci */}
           <td className="px-4 py-3.5 whitespace-nowrap">
            <p className="font-semibold text-gray-900 group-hover:text-teal-700 transition-colors">{rm.name}</p>
            <p className="text-gray-400 text-[10px] mt-0.5 italic">{rm.inci}</p>
           </td>
           {/* category badge */}
           <td className="px-4 py-3.5">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all group-hover:shadow-sm ${catStyle.bg} ${catStyle.text} ${catStyle.border} whitespace-nowrap`}>
             {rm.category}
            </span>
           </td>
           {/* type */}
           <td className="px-4 py-3.5 text-gray-700 font-medium">{rm.rmType}</td>
           {/* uom */}
           <td className="px-4 py-3.5 text-gray-700 font-semibold">{rm.uom}</td>
           {/* gst */}
           <td className="px-4 py-3.5 text-right text-gray-600 font-medium">{rm.gst}%</td>
           {/* status */}
           <td className="px-4 py-3.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             {rm.status}
            </span>
           </td>
           {/* products — compact link; full SKU list in modal */}
           <td className="px-4 py-3.5">
            {rm.products.length === 0 ? (
             <span className="text-gray-300 text-xs">—</span>
            ) : (
             <button
              type="button"
              onClick={(e) => {
               e.stopPropagation();
               setLinkedSkusModalRm(rm);
              }}
              className="text-xs font-semibold text-teal-600 hover:text-teal-800 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-1 rounded"
             >
              View SKU ({rm.products.length})
             </button>
            )}
           </td>
           {/* Actions */}
           <td className="px-4 py-3.5 text-right whitespace-nowrap">
            <button
             type="button"
             onClick={(e) => { e.stopPropagation(); onEditRm(rm); }}
             className="text-[10px] font-semibold text-teal-600 hover:text-teal-800 hover:underline mr-2"
            >
             Edit
            </button>
            <button
             type="button"
             onClick={(e) => { e.stopPropagation(); onDeleteRm(rm); }}
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

     {/* Pagination */}
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

    {linkedSkusModalRm && (
     <div
      className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-6"
      role="presentation"
      onClick={() => setLinkedSkusModalRm(null)}
     >
      <div
       className="my-auto w-full max-w-3xl max-h-[calc(100svh-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
       role="dialog"
       aria-modal="true"
       aria-labelledby="linked-skus-modal-title"
       onClick={(e) => e.stopPropagation()}
      >
       <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-slate-50 px-5 py-4">
        <div className="min-w-0">
         <h2 id="linked-skus-modal-title" className="text-lg font-bold text-gray-900">
          Linked product SKUs
         </h2>
         <p className="mt-1 truncate text-xs text-gray-600 font-mono">{linkedSkusModalRm.code}</p>
         <p className="mt-0.5 text-sm text-gray-800">{linkedSkusModalRm.name}</p>
        </div>
        <button
         type="button"
         onClick={() => setLinkedSkusModalRm(null)}
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
          Could not load Products master. SKUs from this raw material are still listed below.
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
         onClick={() => setLinkedSkusModalRm(null)}
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

// Helper components
const InputField: React.FC<{
 label: string;
 id: string;
 value: any;
 onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
 type?: string;
 placeholder?: string;
 error?: string;
 requiredMark?: boolean;
 readOnly?: boolean;
 disabled?: boolean;
}> = ({ label, id, value, onChange, type = 'text', placeholder, error, requiredMark, readOnly, disabled }) => (
 <div>
  <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
   {label}
   {requiredMark ? <span className="text-red-600 ml-0.5" aria-hidden>*</span> : null}
  </label>
  <input
   type={type}
   id={id}
   value={value || ''}
   onChange={onChange}
   readOnly={readOnly}
   disabled={disabled}
   placeholder={placeholder}
   aria-invalid={error ? true : undefined}
   className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    error ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
   } ${readOnly || disabled ? 'bg-slate-100 text-slate-800 cursor-not-allowed' : ''}`}
  />
  {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
 </div>
);

type SelectOption = string | { value: string; label: string };

const SelectField: React.FC<{
 label: string;
 id: string;
 value: any;
 onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
 options: SelectOption[];
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
   value={value || ''}
   onChange={onChange}
   disabled={disabled}
   aria-invalid={error ? true : undefined}
   className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    error ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
   } ${disabled ? 'bg-slate-100' : ''}`}
  >
   <option value="">Select...</option>
   {options.map((opt) => {
    const v = typeof opt === 'string' ? opt : opt.value;
    const l = typeof opt === 'string' ? opt : opt.label;
    return <option key={v} value={v}>{l}</option>;
   })}
  </select>
  {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
 </div>
);

const TextareaField: React.FC<{
 label: string;
 id: string;
 value: any;
 onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
 rows?: number;
 placeholder?: string;
}> = ({ label, id, value, onChange, rows = 3, placeholder }) => (
 <div>
  <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
  <textarea
   id={id}
   value={value || ''}
   onChange={onChange}
   rows={rows}
   placeholder={placeholder}
   className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
 </div>
);

const CheckboxField: React.FC<{
 label: string;
 id: string;
 checked: boolean;
 onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, id, checked, onChange }) => (
 <div className="flex items-center text-sm">
  <input
   type="checkbox"
   id={id}
   checked={checked}
   onChange={onChange}
   className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
  />
  <label htmlFor={id} className="ml-2 text-gray-700">{label}</label>
 </div>
);

export default RawMaterialRefactored;
