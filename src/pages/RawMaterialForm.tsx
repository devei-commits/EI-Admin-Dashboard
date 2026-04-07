import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import MasterFormBase from '../components/MasterFormBase';
import ArrayItemManager from '../components/ArrayItemManager';
import VendorCommercialEditor, {
  defaultTempVendorTiers,
  type RmCommercialVendor,
  type VendorTierDraft,
} from '../components/VendorCommercialEditor';
import { syncMasterVendorsToPriceList } from '../utils/syncVendorMasterToPriceList';
import { fetchPriceListRowForMaterial, mergeRmVendorsWithPriceList } from '../utils/mergeVendorsFromItemsList';
import { getPrimaryFields, validatePrimaryFields, validateMasterTaxDetails } from '../utils/masterFormUtils';
import { validateStagedPercents } from '../lib/stagedPaymentTerms';
import { fetchRawMaterialsPage, createRawMaterial, updateRawMaterial, deleteRawMaterial, fetchRawMaterialById, fetchReservedStock, fetchNextRawMaterialCode, type RawMaterialRecord, type ReservedStockResponse } from '../services/rawMaterials.service';
import { fetchVendorClients, type VendorClientRecord } from '../services/vendorClient.service';

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
    rmTaxPreference: 'Taxable',
    rmReturnable: false,
    rmAssociateItems: '',
    rmCategoryKey: '',
    rmCategory: '',
    qcInspectionGroup: '',
    subCategory: '',
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
    conversionFactor: '',
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

/** New RM registrations require at least one vendor rate (parallel to PR MRP). */
function rmVendorsHavePositiveUnitPrice(vendors: RmCommercialVendor[]): boolean {
  return vendors.some((v) => {
    if (Number(v.unitPrice) > 0) return true;
    return (v.tiers ?? []).some((t) => parseVendorTierPrice(t.price) > 0);
  });
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
 const [generatedRmCode, setGeneratedRmCode] = useState('');
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
  setGeneratedRmCode('');
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
 const canAdvancePastPrimary =
  !isNewRm ||
  Boolean(
   formData.rmCategoryKey?.trim() &&
    formData.rmSku?.trim() &&
    formData.inciName?.trim() &&
    formData.tradeCommercialName?.trim()
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
    return next;
   });
  }
  if (id === 'rmCategoryKey') {
   const cat = value ? RM_CATEGORIES[value] : null;
   setFormData(prev => ({
    ...prev,
    rmCategoryKey: value,
    rmCategory: cat ? cat.label : prev.rmCategory,
    seriesPrefix: cat ? cat.prefix : prev.seriesPrefix,
   }));
   return;
  }
  setFormData(prev => ({
   ...prev,
   [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
  }));
 };

 const getRmCodePreview = () => {
  const cat = formData.rmCategoryKey ? RM_CATEGORIES[formData.rmCategoryKey] : null;
  if (!cat) return { prefix: '—', next: '—' };
  if (generatedRmCode && generatedRmCode.startsWith(cat.prefix)) {
   const suffix = generatedRmCode.slice(cat.prefix.length).replace(/^-+/, '') || '—';
   return { prefix: cat.prefix, next: suffix };
  }
  return { prefix: cat.prefix, next: '…' };
 };

 const generateRmCode = async (confirm = false) => {
  if (lockPrimaryFields) {
   addToast('error', 'RM code cannot be changed while editing an existing record.');
   return;
  }
  if (!formData.rmCategoryKey) {
   addToast('error', 'Select an RM Category first');
   return;
  }
  if (generatedRmCode && !confirm) {
   const ok = window.confirm('A code is already generated. Regenerate? This must be controlled after approvals.');
   if (!ok) return;
  }
  const cat = RM_CATEGORIES[formData.rmCategoryKey];
  try {
   const code = await fetchNextRawMaterialCode(cat.prefix);
   setGeneratedRmCode(code);
   setFormData(prev => ({ ...prev, rmSku: code }));
   addToast('success', `Code generated: ${code}`);
  } catch (err) {
   console.error(err);
   addToast('error', err instanceof Error ? err.message : 'Failed to generate code');
  }
 };

 // Vendor operations
 const handleAddVendor = () => {
  if (!tempVendor.name.trim()) {
   setErrors(prev => ({ ...prev, venName: 'Step 5 — Vendor name is required' }));
   addToast('error', 'Step 5 — Vendor name is required');
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
  setErrors((prev) => ({ ...prev, venName: '' }));
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
   setErrors(prev => ({ ...prev, documentType: 'Step 6 — Document type and link are required' }));
   addToast('error', 'Step 6 — Document type and link are required');
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
  setErrors(prev => ({ ...prev, documentType: '' }));
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
   setErrors(prev => ({ ...prev, testName: 'Step 6 — Test name and result are required' }));
   addToast('error', 'Step 6 — Test name and result are required');
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
  setErrors(prev => ({ ...prev, testName: '' }));
 };

 const handleRemoveTest = (id: string) => {
  setFormData(prev => ({
   ...prev,
   tests: prev.tests.filter(t => t.id !== id)
  }));
 };

 const handleSubmit = async () => {
  if (!existingRmId) {
   if (!formData.rmCategoryKey?.trim()) {
    addToast('error', 'Select an RM Category (Primary info step)');
    setCurrentStage(0);
    focusFieldById('rmCategoryKey');
    return;
   }
   if (!formData.rmSku?.trim()) {
    addToast('error', 'Generate or enter SKU / RM code before submitting');
    setCurrentStage(0);
    focusFieldById('rmSku');
    return;
   }
  }
  const validation = validatePrimaryFields(formData, 'rawMaterial');
  const taxValidation = validateMasterTaxDetails(formData as Record<string, unknown>, 'rawMaterial');
  if (!validation.valid || !taxValidation.valid) {
   setErrors({ ...validation.errors, ...taxValidation.errors });
    const stageByField: Record<string, number> = {
      rmSku: 0,
      inciName: 0,
      tradeCommercialName: 0,
      grade: 2,
      compliance: 2,
      hsnCode: 1,
      gst: 1,
    };
    const firstPrimaryMissing = getPrimaryFields('rawMaterial').find((f) => Boolean(validation.errors[f]));
    const firstTaxMissing = ['hsnCode', 'gst'].find((f) => Boolean(taxValidation.errors[f]));
    const firstField = firstTaxMissing || firstPrimaryMissing;
    if (firstField) {
      setCurrentStage(stageByField[firstField] ?? 0);
      focusFieldById(firstField);
    }
   if (!taxValidation.valid) {
    const firstTax = ['hsnCode', 'gst'].find((f) => Boolean(taxValidation.errors[f]));
    addToast(
     'error',
     firstTax
      ? taxValidation.errors[firstTax]
      : 'When Tax Preference is Taxable, enter a valid HSN code and GST % (Step 1). Exempt / NonGST can leave them blank.'
    );
    setCurrentStage(1);
   } else {
    const firstPrimary = getPrimaryFields('rawMaterial').find((f) => Boolean(validation.errors[f]));
    const firstMsg =
     (firstPrimary && validation.errors[firstPrimary]) ||
     Object.values(validation.errors)[0] ||
     Object.values(taxValidation.errors)[0];
    addToast('error', firstMsg || 'Please fill all required fields');
   }
   return;
  }
  if (!existingRmId && !rmVendorsHavePositiveUnitPrice(formData.vendors)) {
   setErrors({ vendorCommercial: 'Vendors & Commercial — At least one vendor with a positive unit price is required' });
   addToast('error', 'Add at least one vendor with a positive unit price (MOQ + price tiers or unit price).');
   setCurrentStage(5);
   return;
  }
  try {
   if (existingRmId) {
    const rmIdForSync = parseInt(String(existingRmId), 10);
    await updateRawMaterial(existingRmId, formData as Record<string, unknown>);
    const syncCreated = Number.isNaN(rmIdForSync) ? 0 : await syncRmVendorsToItemsListAfterSave(rmIdForSync);
    addToast(
     'success',
     syncCreated > 0
      ? `Raw Material updated successfully! ${syncCreated} vendor rate(s) synced to Items List.`
      : 'Raw Material updated successfully!'
    );
    setExistingRmId(null);
   } else {
    const { record, zohoSync } = await createRawMaterial({
     ...(formData as Record<string, unknown>),
    });
    const newRmId = parseInt(String(record.id), 10);
    const syncCreated = Number.isNaN(newRmId) ? 0 : await syncRmVendorsToItemsListAfterSave(newRmId);
    if (zohoSync?.synced === false && zohoSync.error) {
     addToast(
      'error',
      `Saved in Esthetic Insights, but Zoho Books sync failed: ${zohoSync.error}`
     );
    } else {
     const base =
      zohoSync?.synced && zohoSync.item_id
       ? `Raw Material saved and linked to Zoho (item ${zohoSync.item_id}).`
       : 'Raw Material saved successfully!';
     addToast('success', syncCreated > 0 ? `${base} ${syncCreated} vendor rate(s) synced to Items List.` : base);
    }
   }
   queryClient.invalidateQueries({ queryKey: ['raw-materials-page'] });
   resetRmFormToEmpty();
   setPageTab('dashboard');
  } catch (err) {
   console.error(err);
   addToast('error', err instanceof Error ? err.message : 'Failed to save raw material');
  }
 };

 // Stage content rendering
 const renderStageContent = () => {
  switch (currentStage) {
  case 0: // Primary info — category, code, identity, Zoho
  {
   const { prefix, next } = getRmCodePreview();
   return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
     <div className="min-w-0">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">RM Category (Industry Buckets)</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
       <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">RM Category <span className="text-red-600">*</span></label>
        <select
         id="rmCategoryKey"
         value={formData.rmCategoryKey}
         onChange={handleInputChange}
         className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
         <option value="">Select</option>
         {Object.entries(RM_CATEGORIES).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
         ))}
        </select>
       </div>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Sub‑Category <span className="text-gray-400 font-normal">(optional)</span></label>
        <input
         type="text"
         id="subCategory"
         value={formData.subCategory}
         onChange={handleInputChange}
         placeholder="e.g. Silicone emollient / Glycolic acid / Paraben blend"
         className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
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
      </div>
     </div>

     <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Code Series Preview</h3>
      <div className="border border-dashed border-gray-300 rounded-lg p-3 sm:p-4 bg-gray-50">
       <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
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
         onClick={() => generateRmCode()}
         disabled={lockPrimaryFields}
         className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
         Generate Code Now
        </button>
        {generatedRmCode && (
         <button
          type="button"
          onClick={() => generateRmCode(true)}
          disabled={lockPrimaryFields}
          className="px-4 py-1.5 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
         >
          Regenerate (change category)
         </button>
        )}
       </div>
      <p className="text-xs text-gray-500 mt-3">Generated code is applied to SKU below. You can still edit SKU if needed.</p>
      </div>
     </div>

     <InputField
      label="SKU"
      id="rmSku"
      value={formData.rmSku}
      onChange={handleInputChange}
      placeholder="Internal raw material code (e.g. RM-000123)"
      requiredMark
      readOnly={lockPrimaryFields}
     />

     <div className="space-y-4">
      <InputField
       label="Category label (derived)"
       id="rmCategory"
       value={formData.rmCategory}
       onChange={handleInputChange}
       placeholder="Updates when you pick RM Category above"
       readOnly={lockPrimaryFields}
      />
      <InputField
       label="Hazard Handling Class"
       id="hazardHandlingClass"
       value={formData.hazardHandlingClass}
       onChange={handleInputChange}
       placeholder="e.g. Flammable, Corrosive, General"
      />
      <InputField
       label="Series Prefix (derived)"
       id="seriesPrefix"
       value={formData.seriesPrefix}
       onChange={handleInputChange}
       placeholder="From RM Category; editable if needed"
      />
     </div>

     <div className="space-y-4 border-t border-gray-200 pt-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Identity</h3>
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
     </div>

     <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Zoho Books</h3>
      <p className="text-xs text-gray-500">
       {isNewRm
        ? 'SKU and tax preferences are sent with your save. The server creates the Esthetic Insights row and Zoho Books item together (or rolls back both if Books fails).'
        : 'Zoho item ID is read-only.'}
      </p>
      <InputField
       label="SKU (for Zoho)"
       id="sku"
       value={formData.sku}
       onChange={handleInputChange}
       placeholder="Optional; defaults to RM SKU"
       disabled={lockPrimaryFields}
      />
      <SelectField
       label="Tax Preference"
       id="rmTaxPreference"
       value={formData.rmTaxPreference}
       onChange={handleInputChange}
       options={['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST']}
       disabled={lockPrimaryFields}
      />
      <p className="text-xs text-gray-500 -mt-2">
       Taxable: HSN and GST % are required in the next step. Exempted / NonGST: optional.
      </p>
      <CheckboxField
       label="Returnable Item"
       id="rmReturnable"
       checked={formData.rmReturnable}
       onChange={handleInputChange}
      />
      <TextareaField
       label="Associate Items"
       id="rmAssociateItems"
       value={formData.rmAssociateItems}
       onChange={handleInputChange}
       placeholder="Link related RM / PM / packaging codes if any"
      />
      <InputField
       label="Zoho Item ID"
       id="zohoId"
       value={formData.zohoId}
       onChange={() => {}}
       placeholder="Populated from the server after save (when Books sync is on)"
       readOnly
      />
      <p className="text-xs text-gray-500 -mt-1">Read-only — returned by the API after a successful save.</p>
     </div>
    </div>
   );
  }

   case 1: // Units, Tax & Procurement
    return (
     <div className="space-y-4">
    <InputField
     label="Primary UoM"
     id="primaryUom"
     value={formData.primaryUom}
     onChange={handleInputChange}
     placeholder="e.g. KG, GM, L"
    />
    <InputField
     label="Issue UoM"
     id="issueUom"
     value={formData.issueUom}
     onChange={handleInputChange}
     placeholder="Unit in which material is issued"
    />
    <InputField
     label="Conversion Factor"
     id="conversionFactor"
     value={formData.conversionFactor}
     onChange={handleInputChange}
     placeholder="e.g. 1 KG = 1000 GM → 1000"
    />
    <InputField
     label="Standard Pack Size"
     id="standardPackSize"
     value={formData.standardPackSize}
     onChange={handleInputChange}
     placeholder="e.g. 25 KG bag, 200 KG drum"
    />
    <InputField
     label="HSN Code"
     id="hsnCode"
     value={formData.hsnCode}
     onChange={handleInputChange}
     placeholder="Tax classification code"
     error={errors.hsnCode}
     requiredMark={formData.rmTaxPreference === 'Taxable'}
    />
    <InputField
     label="GST %"
     id="gst"
     value={formData.gst}
     onChange={handleInputChange}
     placeholder="e.g. 18"
     error={errors.gst}
     requiredMark={formData.rmTaxPreference === 'Taxable'}
    />
    <InputField
     label="Accounting Category"
     id="accountingCategory"
     value={formData.accountingCategory}
     onChange={handleInputChange}
     placeholder="ERP / finance category mapping"
    />
      <SelectField label="Preferred Currency" id="preferredCurrency" value={formData.preferredCurrency} onChange={handleInputChange}
       options={['INR', 'USD', 'EUR', 'GBP']} />
     </div>
    );

   case 2: // Technical & Regulatory
    return (
     <div className="space-y-4">
    <InputField
     label="Grade"
     id="grade"
     value={formData.grade}
     onChange={handleInputChange}
     placeholder="e.g. Cosmetic Grade, Pharma Grade"
     requiredMark
    />
    <InputField
     label="Compliance/Certificate"
     id="compliance"
     value={formData.compliance}
     onChange={handleInputChange}
     placeholder="e.g. COSMOS, ECOCERT, RSPO"
     requiredMark
    />
      <CheckboxField label="Allergen Declaration Required" id="allergenRequired" checked={formData.allergenRequired} onChange={handleInputChange} />
      <CheckboxField label="GMO Test Required" id="gmoRequired" checked={formData.gmoRequired} onChange={handleInputChange} />
      <CheckboxField label="SDS Available" id="sdsAvailable" checked={formData.sdsAvailable} onChange={handleInputChange} />
      <CheckboxField label="CoA Available" id="coaAvailable" checked={formData.coaAvailable} onChange={handleInputChange} />
    <TextareaField
     label="Regulatory Notes"
     id="regulatoryNotes"
     value={formData.regulatoryNotes}
     onChange={handleInputChange}
     placeholder="Any specific restrictions, region notes, or regulatory info"
    />
     </div>
    );

   case 3: // Quality Specifications
    return (
     <div className="space-y-4">
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
    <TextareaField
     label="Other Specifications"
     id="otherSpecs"
     value={formData.otherSpecs}
     onChange={handleInputChange}
     placeholder="Any additional quality criteria"
    />
     </div>
    );

   case 4: // Usage in Formulation
    return (
     <div className="space-y-4">
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
         { key: 'name', label: 'Test Name' },
         { key: 'result', label: 'Result' },
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
     <div className="space-y-4">
    <TextareaField
     label="Storage Conditions"
     id="storageConditions"
     value={formData.storageConditions}
     onChange={handleInputChange}
     placeholder="e.g. Store below 25°C, protect from light"
    />
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
    <TextareaField
     label="Handling Notes"
     id="handlingNotes"
     value={formData.handlingNotes}
     onChange={handleInputChange}
     placeholder="Special handling instructions for stores / production"
    />
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

   if (fdObj && Object.keys(fdObj).length > 0) {
     const arraysOk = Array.isArray(vendorsVal) || Array.isArray(docsVal) || Array.isArray(testsVal);
     if (!arraysOk) {
       window.alert(
         `RM form_data for id=${existingRmId} did not include vendors/documents/tests arrays.\n` +
           `See console log [RM Edit Populate Debug] for fd keys.`
       );
     }
   }

   // Always seed from the list-view record, because partial/empty `form_data` can override defaults.
   const recordMapped = {
     rmSku: recordCode || '',
     inciName: r.inci ?? '',
     tradeCommercialName: r.name ?? '',
     rmCategory: r.category ?? '',
     rmCategoryKey: inferRmCategoryKeyFromCode(recordCode) || '',
     seriesPrefix: (() => {
       const inf = inferRmCategoryKeyFromCode(recordCode);
       return inf ? RM_CATEGORIES[inf]?.prefix ?? '' : '';
     })(),
     rmType: r.rmType ?? '',
     primaryUom: r.uom ?? '',
     gst: String(r.gst ?? ''),
     shelfLife: r.shelf ?? '',
     zohoId: r.zohoId ?? '',
     sku: r.sku ?? '',
     hsnCode: r.hsnCode ?? '',
     rmTaxPreference: r.taxPref ?? 'Taxable',
     accountingCategory: r.salesPurchaseAccount ?? '',
   };

   // Overlay only non-nullish `form_data` keys.
   const fdToOverlay = (fdNormalized ?? fdObj) as Record<string, unknown> | null;
   const fdCleanOverlay =
     fdToOverlay && typeof fdToOverlay === 'object'
       ? Object.fromEntries(Object.entries(fdToOverlay).filter(([, v]) => v !== null && v !== undefined))
       : null;

   const skuFromFd = fdCleanOverlay ? String((fdCleanOverlay as any).rmSku ?? (fdCleanOverlay as any).sku ?? '') : '';
   const finalSku = skuFromFd?.trim() ? skuFromFd.trim() : recordCode;
   if (finalSku) setGeneratedRmCode(finalSku);

   setFormData((prev) => {
     const merged = { ...prev, ...recordMapped, ...(fdCleanOverlay ?? {}) } as typeof prev;

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
          queryClient.invalidateQueries({ queryKey: ['raw-materials-page'] });
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
                  nextDisabledTitle="Fill RM category, generated code, INCI name, and trade/commercial name on this step before continuing. On submit, at least one vendor with a positive unit price is required."
                  isStageDisabled={(idx) => isNewRm && idx > 0 && !canAdvancePastPrimary}
                >
                  {renderStageContent()}
                </MasterFormBase>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

type RawMaterialDashboardProps = {
 refreshKey?: number;
 onSwitchToForm: () => void;
 onEditRm: (rm: RawMaterialRecord) => void;
 onDeleteRm: (rm: RawMaterialRecord) => void | Promise<void>;
};

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

function GroupChip({ group }: { group: string }) {
 const isPrimary = group.startsWith('Primary');
 const isAlt     = group.startsWith('Alt');
 const dotColor  = isPrimary ? 'bg-blue-500' : isAlt ? 'bg-emerald-500' : 'bg-gray-400';
 const label     = group.replace(' +1','').replace(' +2','');
 const extra     = group.includes('+1') ? '+1' : group.includes('+2') ? '+2' : '';
 return (
  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
   <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
   {label}
   {extra && <span className="ml-0.5 px-1 py-0.5 text-[10px] font-semibold bg-gray-100 rounded">{extra}</span>}
  </span>
 );
}

const RawMaterialDashboard: React.FC<RawMaterialDashboardProps> = ({ refreshKey = 0, onSwitchToForm, onEditRm, onDeleteRm }) => {
 const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const offset = (currentPage - 1) * pageSize;
  const searchTrim = search.trim();

  const {
    data: pageData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['raw-materials-page', searchTrim, pageSize, offset, refreshKey],
    queryFn: () => fetchRawMaterialsPage({ search: searchTrim || undefined, limit: pageSize, offset }),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const rows = pageData?.rows ?? [];
  const totalFiltered = pageData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;

  // Reset to page 1 whenever search/page size changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, refreshKey]);

  const stats = {
    total: totalFiltered,
    // Best-effort stats based on the current page.
    active: rows.filter((r) => String(r.status).toLowerCase() === 'active').length,
    uvFilters: rows.filter((r) => (r.category || '') === 'UV FILTER').length,
    surfactants: rows.filter((r) => (r.category || '') === 'SURFACTANT').length,
    categories: new Set(rows.map((r) => r.category).filter(Boolean)).size,
  };

 const statCards = [
  { label: 'TOTAL RMS',   value: stats.total,       sub: 'Unique raw materials',  accent: 'border-l-teal-500',   num: 'text-teal-600' },
  { label: 'ACTIVE',      value: stats.active,      sub: 'Approved status',        accent: 'border-l-orange-400', num: 'text-orange-500' },
  { label: 'UV FILTERS',  value: stats.uvFilters,   sub: 'Sunscreen actives',      accent: 'border-l-blue-500',   num: 'text-blue-600' },
  { label: 'SURFACTANTS', value: stats.surfactants, sub: 'Facewash actives',       accent: 'border-l-violet-500', num: 'text-violet-600' },
  { label: 'CATEGORIES',  value: stats.categories,  sub: 'Distinct types',         accent: 'border-l-rose-500',   num: 'text-rose-600' },
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

     {/* table */}
     <div className="overflow-x-auto">
      <table className="w-full text-xs">
       <thead>
        <tr className="border-b border-gray-100 bg-linear-to-r from-slate-50/70 to-transparent">
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600 select-none whitespace-nowrap hover:text-gray-900 hover:bg-slate-100/50 transition-colors">
          CODE <span className="text-teal-500">Asc</span>
         </th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">Name / INCI</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Category</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Group</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Type</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">UOM</th>
         <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider text-gray-600">GST</th>
         <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider text-gray-600">Shelf</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Status</th>
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Products</th>
         <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider text-gray-600">Actions</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-gray-50">
        {totalFiltered === 0 ? (
         <tr>
          <td colSpan={11} className="px-4 py-12 text-center text-gray-400 text-sm">
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
           {/* group */}
           <td className="px-4 py-3.5">
            {rm.group ? <GroupChip group={rm.group} /> : <span className="text-gray-300 text-xs">—</span>}
           </td>
           {/* type */}
           <td className="px-4 py-3.5 text-gray-700 font-medium">{rm.rmType}</td>
           {/* uom */}
           <td className="px-4 py-3.5 text-gray-700 font-semibold">{rm.uom}</td>
           {/* gst */}
           <td className="px-4 py-3.5 text-right text-gray-600 font-medium">{rm.gst}%</td>
           {/* shelf */}
           <td className="px-4 py-3.5 text-right text-gray-600">{rm.shelf}</td>
           {/* status */}
           <td className="px-4 py-3.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             {rm.status}
            </span>
           </td>
           {/* products */}
           <td className="px-4 py-3.5">
            <div className="flex flex-wrap gap-1">
             {rm.products.map(p => (
              <span key={p} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 group-hover:bg-teal-100 transition-colors">{p}</span>
             ))}
            </div>
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

const SelectField: React.FC<{
 label: string;
 id: string;
 value: any;
 onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
 options: string[];
 disabled?: boolean;
}> = ({ label, id, value, onChange, options, disabled }) => (
 <div>
  <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
  <select
   id={id}
   value={value || ''}
   onChange={onChange}
   disabled={disabled}
   className={`w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-slate-100' : ''}`}
  >
   <option value="">Select...</option>
   {options.map(opt => (
    <option key={opt} value={opt}>{opt}</option>
   ))}
  </select>
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
