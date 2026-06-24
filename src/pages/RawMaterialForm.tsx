import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import MasterFormBase from '../components/MasterFormBase';
import { MasterSubmitPreviewModal } from '../components/masters/MasterSubmitPreviewModal';
import { MasterApprovalStatusCell } from '../components/masters/MasterApprovalStatusCell';
import { MasterApprovalAssignCell } from '../components/masters/MasterApprovalAssignCell';
import { MasterApprovalLogsCell } from '../components/masters/MasterApprovalLogsCell';
import { MasterApprovalStatusTabs } from '../components/masters/MasterApprovalStatusTabs';
import { MasterSaveSuccessModal, type MasterSaveSuccessRow } from '../components/masters/MasterSaveSuccessModal';
import { RM_PREVIEW_SECTIONS } from '../constants/masterSubmitPreviewFields';
import { deriveRmSourcingFieldsFromVendors } from '../constants/masterVendorSectionRedundantFields';
import { buildMasterPreviewSections } from '../utils/masterSubmitPreview';
import VendorCommercialEditor, {
  defaultTempVendorTiers,
  type RmCommercialVendor,
  type VendorTierDraft,
} from '../components/VendorCommercialEditor';
import { syncMasterVendorsToPriceList } from '../utils/syncVendorMasterToPriceList';
import { fetchPriceListRowForMaterial, mergeRmVendorsWithPriceList } from '../utils/mergeVendorsFromItemsList';
import { getPrimaryFields, validatePrimaryFields, validateMasterTaxDetails } from '../utils/masterFormUtils';
import { validateStagedPercents } from '../lib/stagedPaymentTerms';
import { MasterLinkedPrProductsPanel } from '../components/masters/MasterLinkedPrProductsPanel';
import RmMasterSectionContent from '../components/rawMaterials/RmMasterSectionContent';
import { MasterDropdownOptionsProvider } from '../context/MasterDropdownOptionsContext';
import { MasterCustomFieldsProvider } from '../context/MasterCustomFieldsContext';
import {
  loadEntityCustomDropdownOptions,
  mergeEntityCustomDropdownOptions,
} from '../lib/masterDropdownCustomOptions';
import {
  buildMasterCustomFieldsTaxonomyKey,
  loadEntityCustomFields,
  mergeEntityCustomFields,
  type MasterCustomFieldDef,
} from '../lib/masterCustomFields';
import {
  loadEntitySharedQualitySpecs,
  mergeEntitySharedQualitySpecs,
} from '../lib/masterSharedQualitySpecs';
import {
  appendHiddenParameters,
  appendHiddenParametersForPath,
  collectNewlyHiddenSharedParameters,
} from '../lib/qualitySpecSharedMerge';
import { buildRmMasterFieldContext } from '../lib/rmMasterFieldVisibility';
import { RM_MASTER_MODULE_ORDER, emptyRmMasterScalarDefaults, RM_MASTER_FIELD_KEYS } from '../constants/rmMasterFieldSchema';
import { parseMasterLinkedProductCodes } from '../lib/masterLinkedPrProducts';
import {
  applyRmQualitySpecTaxonomyDisplay,
  flattenRmQualitySpecRowsForPayload,
  flattenRmQualitySubSpecRowsByPathForPayload,
  hydrateRmQualitySpecRows,
  hydrateRmQualitySubSpecRowsByPath,
  resolveRmQualitySpecContext,
  canEditRmQualityCategorySpecs,
  shouldShowRmQualitySpecTable,
  shouldShowRmQualitySubSpecTable,
} from '../lib/rmQualitySpecVisibility';
import type { QualitySpecTableRow } from '../types/qualitySpecTable';
import {
  buildMasterApprovalStatusCounts,
  emptyStageAssignees,
  matchesMasterApprovalStatusTab,
  normalizeMasterApprovalStatus,
  readSavedMasterApprovalStatus,
  type MasterApprovalStageAssignees,
  type MasterApprovalStatusTab,
} from '../constants/masterApprovalStatus';
import {
  advanceMasterApprovalAfterSave,
  getMasterApprovalRevertAction,
  getMasterApprovalSubmitAction,
  revertMasterApprovalStatus,
  withMasterDraftApprovalStatus,
} from '../utils/masterSaveSubmit';
import { useMasterApprovalPermission } from '../hooks/useMasterApprovalPermission';
import { fetchRawMaterialsList, createRawMaterial, updateRawMaterial, deleteRawMaterial, fetchRawMaterialById, fetchReservedStock, postRawMaterialsMasterExcel, resetAllRawMaterialsMaster, type RawMaterialRecord, type ReservedStockResponse } from '../services/rawMaterials.service';
import { fetchVendorClients, type VendorClientRecord } from '../services/vendorClient.service';
import {
  RM_SUB_CATEGORY_SKU_SELECT_OPTIONS,
  normalizeRmSubCategoryForSelect,
  normalizeRmDetailSubCategoryForSelect,
  normalizeRmSubSubCategoryForSelect,
  rmDetailSubCategoryHasSubSubCategory,
  rmDetailSubCategoryOptionsForSkuCategory,
  rmSkuCategoryRequiresDetailSubCategory,
  rmSubSubCategoryOptionsForDetailSubCategory,
} from '../constants/materialMasterSkuRules';
import { resolveRmEditCategories } from '../utils/masterImportCategoryResolve';
import { SortableTableTh, type SortDirection } from '../components/ui/SortableTableTh';
import {
  buildMasterStatBuckets,
  compareMasterTableSort,
  type MasterStatCardSort,
} from '../lib/masterTableSort';

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

/** Primary UoM choices when creating a new RM (backend/storage standard). */
const RM_NEW_PRIMARY_UOM_OPTIONS = ['KG', 'L'] as const;
const RM_EDIT_PRIMARY_UOM_OPTIONS = ['KG', 'GM', 'L', 'ML'] as const;

const RM_TECHNICAL_REQUIRED_FIELDS = [
  'rmState',
  'appearance',
  'specificGravity',
  'msdsSdsNotesLink',
  'storageCondition',
] as const;

const RM_QUALITY_REQUIRED_FIELDS = ['coaRequired'] as const;

/** Business lifecycle on the RM master — not DB `lifecycle_status` (soft-delete archive). */
const RM_MASTER_LIFECYCLE_OPTIONS = [
  'Active',
  'Preferred',
  'Conditional',
  'Phase-out',
  'Discontinued',
] as const;

type RmScalarFields = Record<(typeof RM_MASTER_FIELD_KEYS)[number], string>;

type RawMaterialFormData = RmScalarFields & {
  zohoId: string;
  sku: string;
  rmTaxPreference: string;
  rmReturnable: '' | 'Yes' | 'No';
  rmAssociateItems: string;
  products: string[];
  rmCategoryKey: string;
  rmCategory: string;
  qcInspectionGroup: string;
  subCategory: string;
  optionalRmSubCategory: string;
  optionalRmSubSubCategory: string;
  seriesPrefix: string;
  rmDefaultStorageType: string;
  preferredVendorClientId: string;
  alternateVendorClientId: string;
  sourcingCurrency: string;
  masterLifecycleStatus: string;
  masterApprovalStatus: string;
  rmQualitySpecRows: QualitySpecTableRow[];
  rmQualitySubSpecRowsByPath: Record<string, QualitySpecTableRow[]>;
  rmQualitySpecHiddenParameters: string[];
  rmQualitySubSpecHiddenByPath: Record<string, string[]>;
  vendors: RmCommercialVendor[];
  documents: Array<{ id: string; type: string; link: string; date: string }>;
  tests: Array<{
    id: string;
    name: string;
    result: string;
    date: string;
    approvedBy: string;
    remarks: string;
  }>;
};

function rmSubCategoryLeadingDigit(sub: string): '1' | '2' | '3' | null {
  const canon = normalizeRmSubCategoryForSelect(sub);
  if (canon === 'RAW MATERIALS') return '1';
  if (canon === 'FRAGRANCES / PERFUMES') return '2';
  if (canon === 'COLOURS') return '3';
  return null;
}

function inferRmCategoryKeyFromCode(code: string): string {
  if (!code) return '';
  for (const [k, v] of Object.entries(RM_CATEGORIES)) {
    if (code.startsWith(`${v.prefix}-`) || code === v.prefix) return k;
  }
  return '';
}

function parseRmLinkedProductsFromForm(form: {
  products?: string[];
  rmAssociateItems?: string;
}): string[] {
  return parseMasterLinkedProductCodes({
    products: form.products,
    associateItems: form.rmAssociateItems,
  });
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
function createEmptyRmFormData(): RawMaterialFormData {
  return {
    ...(emptyRmMasterScalarDefaults() as RmScalarFields),
    zohoId: '',
    sku: '',
    rmTaxPreference: '',
    rmReturnable: '' as '' | 'Yes' | 'No',
    rmAssociateItems: '',
    products: [] as string[],
    rmCategoryKey: '',
    rmCategory: '',
    qcInspectionGroup: '',
    subCategory: '',
    optionalRmSubCategory: '',
    optionalRmSubSubCategory: '',
    seriesPrefix: '',
    rmDefaultStorageType: '',
    preferredVendorClientId: '',
    alternateVendorClientId: '',
    sourcingCurrency: 'INR',
    masterLifecycleStatus: 'Active',
    masterApprovalStatus: 'Draft',
    rmQualitySpecRows: [] as QualitySpecTableRow[],
    rmQualitySubSpecRowsByPath: {} as Record<string, QualitySpecTableRow[]>,
    rmQualitySpecHiddenParameters: [] as string[],
    rmQualitySubSpecHiddenByPath: {} as Record<string, string[]>,
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
 const [masterRefreshKey, setMasterRefreshKey] = useState(0);
 const [rmReloadToken, setRmReloadToken] = useState(0);
 const [editRmLoading, setEditRmLoading] = useState(false);
 const [formData, setFormData] = useState<RawMaterialFormData>(createEmptyRmFormData);

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
 const [revertPreviewOpen, setRevertPreviewOpen] = useState(false);
 const [pendingSavePayload, setPendingSavePayload] = useState<Record<string, unknown> | null>(null);
 const [pendingApprovalIntentStatus, setPendingApprovalIntentStatus] = useState<string | null>(null);
 const [submitConfirming, setSubmitConfirming] = useState(false);
 const [draftSaving, setDraftSaving] = useState(false);
 const [editApprovalStageAssignees, setEditApprovalStageAssignees] =
  useState<MasterApprovalStageAssignees>(emptyStageAssignees);
 const { canApproveAtStatus } = useMasterApprovalPermission('RM');
 const [saveSuccessOpen, setSaveSuccessOpen] = useState(false);
 const [saveSuccessCode, setSaveSuccessCode] = useState('');
 const [saveSuccessRows, setSaveSuccessRows] = useState<MasterSaveSuccessRow[]>([]);
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
  setEditApprovalStageAssignees(emptyStageAssignees());
 }, []);

 const handleReset = () => {
  if (!window.confirm('Reset all form data? This cannot be undone.')) return;
  setExistingRmId(null);
  resetRmFormToEmpty();
  addToast('info', 'Form reset');
 };

 const { data: vendorClientData, isLoading: vendorClientsLoading } = useQuery({
  queryKey: ['vendor-clients', 'vendor', 'raw-material-form'],
  queryFn: async () => {
   const res = await fetchVendorClients('vendor');
   if (!res.success) return [] as VendorClientRecord[];
   return (res.data ?? []).filter((v) => v.type === 'vendor' && v.status === 'active');
  },
  staleTime: 2 * 60 * 1000,
 });
 const vendorClientList = vendorClientData ?? [];

 const stages = RM_MASTER_MODULE_ORDER.map((m) => m.title);

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
 const rmSubSubCategoryRequired = rmDetailSubCategoryHasSubSubCategory(
  formData.optionalRmSubCategory,
  formData.subCategory
 );
 const rmSubSubCategoryOptions = useMemo(() => {
  const base = rmSubSubCategoryOptionsForDetailSubCategory(
   formData.optionalRmSubCategory,
   formData.subCategory
  );
  const cur = String(formData.optionalRmSubSubCategory ?? '').trim();
  if (cur && !base.some((o) => o.value === cur)) {
   return [{ value: cur, label: cur }, ...base];
  }
  return base;
 }, [formData.optionalRmSubCategory, formData.optionalRmSubSubCategory, formData.subCategory]);
 const rmFunctionalCategoryLabel = 'Sub-category';
 const rmFunctionalSubCategoryLabel = 'Sub-sub category';
 const canAdvancePastPrimary =
  !isNewRm ||
  Boolean(
    formData.subCategory?.trim() &&
    formData.inciName?.trim() &&
    formData.tradeCommercialName?.trim() &&
    formData.functionRole?.trim() &&
    (!rmDetailSubCategoryRequired || formData.optionalRmSubCategory?.trim())
  );
 const canAdvancePastUnitsTax =
  !isNewRm ||
  Boolean(
    formData.primaryUom?.trim() &&
    formData.rmTaxPreference?.trim() &&
    formData.rmReturnable?.trim() &&
    (!taxIsTaxable || (formData.hsnCode?.trim() && formData.gst?.toString().trim()))
  );
 const rmQualitySpecCtx = useMemo(
  () => ({
   subCategory: formData.subCategory,
   optionalRmSubCategory: formData.optionalRmSubCategory,
   optionalRmSubSubCategory: formData.optionalRmSubSubCategory,
  }),
  [formData.subCategory, formData.optionalRmSubCategory, formData.optionalRmSubSubCategory]
 );
 const rmQualitySpecResolved = useMemo(
  () => resolveRmQualitySpecContext(rmQualitySpecCtx),
  [rmQualitySpecCtx]
 );
 const showRmQualitySpecTable = useMemo(
  () => shouldShowRmQualitySpecTable(rmQualitySpecCtx),
  [rmQualitySpecCtx]
 );
 const showRmQualitySubSpecTable = useMemo(
  () => shouldShowRmQualitySubSpecTable(rmQualitySpecCtx),
  [rmQualitySpecCtx]
 );
 const canEditRmQualityCategory = useMemo(
  () => canEditRmQualityCategorySpecs(rmQualitySpecCtx),
  [rmQualitySpecCtx]
 );
 const currentSubSpecRows = useMemo(() => {
  const pathKey = rmQualitySpecResolved.subSpecPathKey;
  if (!pathKey) return [];
  return formData.rmQualitySubSpecRowsByPath[pathKey] ?? [];
 }, [formData.rmQualitySubSpecRowsByPath, rmQualitySpecResolved.subSpecPathKey]);

 const handleRmQualitySpecRowsChange = useCallback(
  (rows: QualitySpecTableRow[]) => {
   setFormData((prev) => {
    const categoryKey = rmQualitySpecResolved.functionalCategory;
    const prevRows = prev.rmQualitySpecRows ?? [];
    const addedHidden = categoryKey
     ? collectNewlyHiddenSharedParameters('RM', 'common', categoryKey, prevRows, rows)
     : [];
    return {
     ...prev,
     rmQualitySpecRows: rows,
     rmQualitySpecHiddenParameters: appendHiddenParameters(
      prev.rmQualitySpecHiddenParameters ?? [],
      addedHidden
     ),
    };
   });
  },
  [rmQualitySpecResolved.functionalCategory]
 );

 const handleRmQualitySubSpecRowsChange = useCallback(
  (rows: QualitySpecTableRow[]) => {
   const pathKey = rmQualitySpecResolved.subSpecPathKey;
   if (!pathKey) return;
   setFormData((prev) => {
    const prevRows = prev.rmQualitySubSpecRowsByPath[pathKey] ?? [];
    const addedHidden = collectNewlyHiddenSharedParameters('RM', 'sub', pathKey, prevRows, rows);
    return {
     ...prev,
     rmQualitySubSpecRowsByPath: {
      ...prev.rmQualitySubSpecRowsByPath,
      [pathKey]: rows,
     },
     rmQualitySubSpecHiddenByPath: appendHiddenParametersForPath(
      prev.rmQualitySubSpecHiddenByPath ?? {},
      pathKey,
      addedHidden
     ),
    };
   });
  },
  [rmQualitySpecResolved.subSpecPathKey]
 );
 /** On edit: internal SKU/code stays fixed; identity, UoM, returnable, and tax fields remain editable. */

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
  if (id === 'grade') {
   setErrors((prev) => {
    if (!prev.grade) return prev;
    const next = { ...prev };
    delete next.grade;
    return next;
   });
  }
  if ((RM_TECHNICAL_REQUIRED_FIELDS as readonly string[]).includes(id)) {
   setErrors((prev) => {
    if (!prev[id]) return prev;
    const next = { ...prev };
    delete next[id];
    return next;
   });
  }
  if ((RM_QUALITY_REQUIRED_FIELDS as readonly string[]).includes(id)) {
   setErrors((prev) => {
    if (!prev[id]) return prev;
    const next = { ...prev };
    delete next[id];
    return next;
   });
  }
  if (id === 'shelfLife') {
   setErrors((prev) => {
    if (!prev.shelfLife) return prev;
    const next = { ...prev };
    delete next.shelfLife;
    return next;
   });
  }
  if (id === 'masterLifecycleStatus') {
   setErrors((prev) => {
    if (!prev.masterLifecycleStatus) return prev;
    const next = { ...prev };
    delete next.masterLifecycleStatus;
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
   setFormData((prev) => {
    const optionalRmSubCategory = normalizeRmDetailSubCategoryForSelect(next, prev.optionalRmSubCategory);
    const nextCtx = {
     subCategory: next,
     optionalRmSubCategory,
     optionalRmSubSubCategory: '',
    };
    const stripped = {
     ...prev,
     ...nextCtx,
     rmQualitySpecRows: [],
     rmQualitySubSpecRowsByPath: {},
    };
    const display = applyRmQualitySpecTaxonomyDisplay(
     stripped as Record<string, unknown>,
     nextCtx
    );
    return { ...stripped, ...display };
   });
   setErrors((prev) => {
    const n = { ...prev };
    delete n.subCategory;
    delete n.optionalRmSubCategory;
    delete n.optionalRmSubSubCategory;
    return n;
   });
   return;
  }
  if (id === 'optionalRmSubCategory') {
   const detail =
    normalizeRmDetailSubCategoryForSelect(formData.subCategory, value) || value;
   setFormData((prev) => {
    const optionalRmSubSubCategory = normalizeRmSubSubCategoryForSelect(detail, prev.optionalRmSubSubCategory);
    const nextCtx = {
     subCategory: prev.subCategory,
     optionalRmSubCategory: detail,
     optionalRmSubSubCategory,
    };
    const stripped = {
     ...prev,
     optionalRmSubCategory: detail,
     optionalRmSubSubCategory,
     rmQualitySpecRows: [],
     rmQualitySubSpecRowsByPath: {},
    };
    const display = applyRmQualitySpecTaxonomyDisplay(
     stripped as Record<string, unknown>,
     nextCtx
    );
    return { ...stripped, ...display };
   });
   setErrors((prev) => {
    if (!prev.optionalRmSubCategory && !prev.optionalRmSubSubCategory) return prev;
    const n = { ...prev };
    delete n.optionalRmSubCategory;
    delete n.optionalRmSubSubCategory;
    return n;
   });
   return;
  }
  if (id === 'optionalRmSubSubCategory') {
   setFormData((prev) => {
    const nextCtx = {
     subCategory: prev.subCategory,
     optionalRmSubCategory: prev.optionalRmSubCategory,
     optionalRmSubSubCategory: value,
    };
    const stripped = {
     ...prev,
     optionalRmSubSubCategory: value,
     rmQualitySubSpecRowsByPath: {},
    };
    const display = applyRmQualitySpecTaxonomyDisplay(
     stripped as Record<string, unknown>,
     nextCtx
    );
    return {
     ...stripped,
     rmQualitySubSpecRowsByPath: display.rmQualitySubSpecRowsByPath,
    };
   });
   setErrors((prev) => {
    if (!prev.optionalRmSubSubCategory) return prev;
    const n = { ...prev };
    delete n.optionalRmSubSubCategory;
    return n;
   });
   return;
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
   delete next.vendors;
   return next;
  });
 };

 const handleRemoveVendor = (index: number) => {
  setFormData((prev) => ({
   ...prev,
   vendors: prev.vendors.filter((_, i) => i !== index),
  }));
  setErrors((prev) => {
   if (!prev.vendors) return prev;
   const next = { ...prev };
   delete next.vendors;
   return next;
  });
 };

 const handleVendorsChange = (vendors: RmCommercialVendor[]) => {
  setFormData((prev) => ({ ...prev, vendors }));
  setErrors((prev) => {
   if (!prev.vendors) return prev;
   const next = { ...prev };
   delete next.vendors;
   return next;
  });
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

 const buildRmSavePayload = (mode: 'draft' | 'submit' = 'submit'): Record<string, unknown> | null => {
  if (mode === 'draft') {
   if (!existingRmId && !formData.subCategory?.trim()) {
    addToast('error', 'Select a category before saving a draft');
    setCurrentStage(0);
    focusFieldById('subCategory');
    return null;
   }
  } else if (!existingRmId) {
   if (!formData.subCategory?.trim()) {
    addToast('error', 'Category is required (Primary info step)');
    setCurrentStage(0);
    focusFieldById('subCategory');
    return null;
   }
  }
  if (mode === 'submit') {
  if (!formData.rmReturnable?.trim()) {
   setErrors((prev) => ({
    ...prev,
    rmReturnable: 'Step 2 — Returnable Item is required (pick Yes or No)',
   }));
   addToast('error', 'Step 2 — Returnable Item is required (pick Yes or No)');
   setCurrentStage(1);
   focusFieldById('rmReturnable');
   return null;
  }
  if (!formData.primaryUom?.trim()) {
   const uomHint = isNewRm ? 'KG or L' : 'KG / GM / L / ML';
   setErrors((prev) => ({
    ...prev,
    primaryUom: `Step 2 — Primary UoM is required (pick ${uomHint})`,
   }));
   addToast('error', `Step 2 — Primary UoM is required (pick ${uomHint})`);
   setCurrentStage(1);
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
      functionRole: 0,
      primaryUom: 1,
      rmTaxPreference: 1,
      rmReturnable: 1,
      hsnCode: 1,
      gst: 1,
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
      : 'Select a Tax Preference and (for Taxable) fill a valid HSN/SAC and GST % (Step 2).'
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
   return null;
  }
  }
  const linkedProducts = parseRmLinkedProductsFromForm(formData);
  const qcSpecRows = flattenRmQualitySpecRowsForPayload(formData.rmQualitySpecRows ?? []);
  const qcSubSpecRowsByPath = flattenRmQualitySubSpecRowsByPathForPayload(
   formData.rmQualitySubSpecRowsByPath ?? {}
  );
  const payload: Record<string, unknown> = {
   ...(formData as Record<string, unknown>),
   rmCategory: formData.subCategory?.trim() || formData.rmCategory,
   category: formData.subCategory?.trim() || formData.rmCategory,
   rmQualitySpecRows: qcSpecRows,
   rmQualitySubSpecRowsByPath: qcSubSpecRowsByPath,
   rmQualitySpecHiddenParameters: formData.rmQualitySpecHiddenParameters ?? [],
   rmQualitySubSpecHiddenByPath: formData.rmQualitySubSpecHiddenByPath ?? {},
   masterCustomDropdownOptions: loadEntityCustomDropdownOptions('RM'),
   masterCustomFields: loadEntityCustomFields('RM'),
   masterSharedQualitySpecs: { RM: loadEntitySharedQualitySpecs('RM') },
   ...(linkedProducts.length > 0 ? { products: linkedProducts } : {}),
  };
  if (isNewRm) {
   delete payload.rmSku;
   delete payload.sku;
  } else {
   delete payload.rmSku;
   delete payload.sku;
   delete payload.code;
  }
  delete payload.specific_gravity;
  delete payload.rmType;
  Object.assign(
    payload,
    deriveRmSourcingFieldsFromVendors(formData.vendors, formData.primaryUom)
  );
  return withMasterDraftApprovalStatus(payload, formData.masterApprovalStatus);
 };

 const rmPreviewFormData = useMemo(
  () => formData as Record<string, unknown>,
  [formData]
 );
 const rmPreviewSections = useMemo(
  () =>
   buildMasterPreviewSections(rmPreviewFormData, RM_PREVIEW_SECTIONS, {
    omitKeys: isNewRm
     ? ['rmSku', 'sku', 'rmType', 'rm_type', 'rmQualitySpecRows', 'rmQualitySubSpecRowsByPath']
     : ['rmType', 'rm_type', 'rmQualitySpecRows', 'rmQualitySubSpecRowsByPath'],
   }),
  [rmPreviewFormData, isNewRm]
 );
 const rmLinkedProductCodes = useMemo(
  () =>
   parseMasterLinkedProductCodes({
    products: formData.products,
    associateItems: formData.rmAssociateItems,
   }),
  [formData.products, formData.rmAssociateItems]
 );

 const handleSubmit = async () => {
  const savePayload = buildRmSavePayload('submit');
  if (!savePayload) return;

  let intentStatus = readSavedMasterApprovalStatus({ status: formData.masterApprovalStatus });
  if (existingRmId) {
   const fresh = await fetchRawMaterialById(existingRmId);
   if (fresh) {
    intentStatus = readSavedMasterApprovalStatus({
     status: fresh.record.status,
     formData: fresh.form_data,
    });
    setFormData((prev) => ({ ...prev, masterApprovalStatus: intentStatus }));
    setEditApprovalStageAssignees(fresh.record.approvalStageAssignees ?? emptyStageAssignees());
   }
  }

  if (!getMasterApprovalSubmitAction(intentStatus)) {
   addToast('info', 'This record is already at the final approval status.');
   return;
  }

  setPendingApprovalIntentStatus(intentStatus);
  setPendingSavePayload(withMasterDraftApprovalStatus(savePayload, intentStatus));
  setSubmitPreviewOpen(true);
 };

 const handleRevert = () => {
  if (!existingRmId) {
   addToast('error', 'Save a draft first before sending the form back to a previous status.');
   return;
  }
  setRevertPreviewOpen(true);
 };

 const persistRmRecord = async (
  savePayload: Record<string, unknown>
 ): Promise<{
  id: string;
  code: string;
  isEdit: boolean;
  record: Awaited<ReturnType<typeof updateRawMaterial>>;
  syncCreated: number;
 } | null> => {
  if (existingRmId) {
   const rmIdForSync = parseInt(String(existingRmId), 10);
   const record = await updateRawMaterial(existingRmId, savePayload);
   const syncCreated = Number.isNaN(rmIdForSync) ? 0 : await syncRmVendorsToItemsListAfterSave(rmIdForSync);
   return {
    id: existingRmId,
    code: record.code || formData.rmSku || '',
    isEdit: true,
    record,
    syncCreated,
   };
  }
  const { record } = await createRawMaterial(savePayload);
  const newRmId = String(record.id);
  const parsedId = parseInt(newRmId, 10);
  const syncCreated = Number.isNaN(parsedId) ? 0 : await syncRmVendorsToItemsListAfterSave(parsedId);
  setExistingRmId(newRmId);
  setFormData((prev) => ({
   ...prev,
   rmSku: record.code || prev.rmSku,
   masterApprovalStatus: 'Draft',
  }));
  return { id: newRmId, code: record.code || '', isEdit: false, record, syncCreated };
 };

 const handleSave = async () => {
  const savePayload = buildRmSavePayload('draft');
  if (!savePayload) return;
  setDraftSaving(true);
  try {
   const saved = await persistRmRecord(savePayload);
   if (!saved) return;
   queryClient.invalidateQueries({ queryKey: ['raw-materials-full-list'] });
   setMasterRefreshKey((k) => k + 1);
   const freshAfterSave = await fetchRawMaterialById(saved.id);
   if (freshAfterSave) {
    setEditApprovalStageAssignees(
     freshAfterSave.record.approvalStageAssignees ?? emptyStageAssignees()
    );
   }
   addToast(
    'success',
    saved.isEdit
     ? 'Draft saved. Continue editing and submit for review when ready.'
     : `Draft saved (${saved.code || 'new RM'}). Continue editing and submit for review when ready.`
   );
  } catch (err) {
   console.error(err);
   addToast('error', err instanceof Error ? err.message : 'Failed to save draft');
  } finally {
   setDraftSaving(false);
  }
 };

 const closeSaveSuccessAndExit = () => {
  setSaveSuccessOpen(false);
  setSaveSuccessCode('');
  setSaveSuccessRows([]);
  setExistingRmId(null);
  resetRmFormToEmpty();
  setPageTab('dashboard');
 };

 const handleConfirmSubmit = async (comment: string) => {
  const savePayload = pendingSavePayload;
  if (!savePayload) return;
  setSubmitConfirming(true);
  try {
   const saved = await persistRmRecord(savePayload);
   if (!saved) return;

   const freshAfterSave = await fetchRawMaterialById(saved.id);
   if (freshAfterSave) {
    setEditApprovalStageAssignees(
     freshAfterSave.record.approvalStageAssignees ?? emptyStageAssignees()
    );
   }

   let approvalStatus = freshAfterSave
    ? readSavedMasterApprovalStatus({
       status: freshAfterSave.record.status,
       formData: freshAfterSave.form_data,
      })
    : readSavedMasterApprovalStatus({ status: formData.masterApprovalStatus });
   const assigneesForAdvance =
    freshAfterSave?.record.approvalStageAssignees ?? editApprovalStageAssignees;
   const intentStatus =
    pendingApprovalIntentStatus ??
    readSavedMasterApprovalStatus({ status: formData.masterApprovalStatus });
   const advancedResult = await advanceMasterApprovalAfterSave({
    kind: 'RM',
    itemId: saved.id,
    intentStatus,
    serverStatusAfterSave: approvalStatus,
    assignees: assigneesForAdvance as MasterApprovalStageAssignees,
    canApproveAtStatus,
    comment,
   });
   if (advancedResult.ok === false) {
    addToast('error', advancedResult.error);
    return;
   }
   approvalStatus = advancedResult.status;
   if (advancedResult.advanced) {
    setFormData((prev) => ({ ...prev, masterApprovalStatus: advancedResult.status }));
   } else if (getMasterApprovalSubmitAction(intentStatus)) {
    addToast('error', 'Approval status did not change. Please refresh and try again.');
    return;
   }

   setSaveSuccessIsEdit(saved.isEdit);
   setSaveSuccessCode(saved.code);
   setSaveSuccessRows([
    { label: 'INCI name', value: saved.record.inci || formData.inciName || '' },
    { label: 'Trade / commercial name', value: saved.record.name || formData.tradeCommercialName || '' },
    { label: 'Category', value: saved.record.category || formData.subCategory || '' },
    { label: 'Primary UoM', value: saved.record.uom || formData.primaryUom || '' },
    { label: 'Approval status', value: approvalStatus },
    ...(saved.syncCreated > 0
     ? [{ label: 'Items List', value: `${saved.syncCreated} vendor rate(s) synced` }]
     : []),
   ]);
   queryClient.invalidateQueries({ queryKey: ['raw-materials-full-list'] });
   setMasterRefreshKey((k) => k + 1);
   setSubmitPreviewOpen(false);
   setPendingSavePayload(null);
   setPendingApprovalIntentStatus(null);
   setSaveSuccessOpen(true);
  } catch (err) {
   console.error(err);
   addToast('error', err instanceof Error ? err.message : 'Failed to save raw material');
  } finally {
   setSubmitConfirming(false);
  }
 };


 const handleConfirmRevert = async (comment: string) => {
  if (!existingRmId) return;
  setSubmitConfirming(true);
  try {
   const savePayload = buildRmSavePayload('draft');
   if (!savePayload) return;
   const saved = await persistRmRecord(savePayload);
   if (!saved) return;

   const assigneesForRevert =
    (await fetchRawMaterialById(saved.id))?.record.approvalStageAssignees ?? editApprovalStageAssignees;
   if (!canApproveAtStatus(formData.masterApprovalStatus, assigneesForRevert)) {
    addToast(
     'error',
     'Only the person assigned to this approval stage can send the form back. Assign them in the list, then try again.'
    );
    return;
   }

   const reverted = await revertMasterApprovalStatus('RM', saved.id, comment);
   if (!reverted.ok) {
    addToast('error', reverted.error);
    return;
   }

   setFormData((prev) => ({ ...prev, masterApprovalStatus: reverted.status }));
   setRmReloadToken((t) => t + 1);
   queryClient.invalidateQueries({ queryKey: ['raw-materials-full-list'] });
   setMasterRefreshKey((k) => k + 1);
   setRevertPreviewOpen(false);
   addToast('success', `Status moved back to ${reverted.status}`);
  } catch (err) {
   console.error(err);
   addToast('error', err instanceof Error ? err.message : 'Failed to revert approval status');
  } finally {
   setSubmitConfirming(false);
  }
 };


 const rmFieldContext = useMemo(
  () => ({
   subCategory: formData.subCategory,
   optionalRmSubCategory: formData.optionalRmSubCategory,
   optionalRmSubSubCategory: formData.optionalRmSubSubCategory,
   rmState: formData.rmState,
  }),
  [
   formData.subCategory,
   formData.optionalRmSubCategory,
   formData.optionalRmSubSubCategory,
   formData.rmState,
  ]
 );
 const rmCondContext = useMemo(() => buildRmMasterFieldContext(rmFieldContext), [rmFieldContext]);
 const rmCustomFieldsTaxonomyKey = useMemo(
  () => buildMasterCustomFieldsTaxonomyKey(rmCondContext.cat, rmCondContext.sub, rmCondContext.subsub),
  [rmCondContext]
 );
 const rmCustomFieldsTaxonomyLabel = useMemo(() => {
  const parts = [rmCondContext.cat, rmCondContext.sub, rmCondContext.subsub].filter(Boolean);
  return parts.length > 0 ? parts.join(' → ') : 'RM master';
 }, [rmCondContext]);

 const handleRemoveCustomFieldValue = useCallback((formKey: string) => {
  setFormData((prev) => {
   const next = { ...prev } as Record<string, unknown>;
   delete next[formKey];
   return next as typeof prev;
  });
  setErrors((prev) => {
   if (!prev[formKey]) return prev;
   const next = { ...prev };
   delete next[formKey];
   return next;
  });
 }, []);

 const renderStageContent = () => (
  <RmMasterSectionContent
   sectionIndex={currentStage}
   moduleSlug={RM_MASTER_MODULE_ORDER[currentStage]?.slug ?? 'primary'}
   fieldContext={rmFieldContext}
   formData={formData}
   errors={errors}
   onChange={handleInputChange}
   isNewRm={isNewRm}
   rmDetailSubCategoryRequired={rmDetailSubCategoryRequired}
   rmSubSubCategoryRequired={rmSubSubCategoryRequired}
   rmFunctionalCategoryLabel={rmFunctionalCategoryLabel}
   rmFunctionalSubCategoryLabel={rmFunctionalSubCategoryLabel}
   rmDetailSubCategoryOptions={rmDetailSubCategoryOptions}
   rmSubSubCategoryOptions={rmSubSubCategoryOptions}
   rmSkuCategorySelectOptions={[...RM_SUB_CATEGORY_SKU_SELECT_OPTIONS]}
   rmLinkedProductCodes={rmLinkedProductCodes}
   taxIsTaxable={taxIsTaxable}
   showRmQualitySpecTable={showRmQualitySpecTable}
   canEditRmQualityCategory={canEditRmQualityCategory}
   showRmQualitySubSpecTable={showRmQualitySubSpecTable}
   rmQualitySpecResolved={rmQualitySpecResolved}
   currentSubSpecRows={currentSubSpecRows}
   onRmQualitySpecRowsChange={handleRmQualitySpecRowsChange}
   onRmQualitySubSpecRowsChange={handleRmQualitySubSpecRowsChange}
   primaryUomOptions={isNewRm ? [...RM_NEW_PRIMARY_UOM_OPTIONS] : [...RM_EDIT_PRIMARY_UOM_OPTIONS]}
   vendorClientList={vendorClientList}
   tempVendor={tempVendor}
   tempVendorTiers={tempVendorTiers}
   onVendorTempFieldChange={handleVendorTempFieldChange}
   onTempVendorTierChange={handleTempVendorTierChange}
   onAddTempVendorTierRow={handleAddTempVendorTierRow}
   onAddVendor={handleAddVendor}
   onRemoveVendor={handleRemoveVendor}
   onVendorsChange={handleVendorsChange}
   InputField={InputField}
   SelectField={SelectField}
   TextareaField={TextareaField}
   customFieldsTaxonomyLabel={rmCustomFieldsTaxonomyLabel}
   onRemoveCustomFieldValue={handleRemoveCustomFieldValue}
  />
 );

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
   mergeEntityCustomDropdownOptions(
    'RM',
    (fdObj as Record<string, unknown> | null)?.masterCustomDropdownOptions as
     | Record<string, string[]>
     | undefined
   );
   mergeEntityCustomFields(
    'RM',
    (fdObj as Record<string, unknown> | null)?.masterCustomFields as
     | Record<string, Partial<Record<'TECH' | 'QUAL' | 'ART', MasterCustomFieldDef[]>>>
     | undefined
   );
   const sharedRoot = (fdObj as Record<string, unknown> | null)?.masterSharedQualitySpecs as
    | { RM?: import('../lib/masterSharedQualitySpecs').MasterSharedQualitySpecsEntityStore }
    | undefined;
   if (sharedRoot?.RM) {
    mergeEntitySharedQualitySpecs('RM', sharedRoot.RM);
   }
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
   setEditApprovalStageAssignees(r.approvalStageAssignees ?? emptyStageAssignees());
   const recordCode = r.code ?? '';
   const resolvedCats = resolveRmEditCategories({
     code: recordCode,
     category: r.category,
     group: r.group,
     form_data: fdObj,
   });

   const fdDebug = {
     existingRmId,
     recordCode,
     recordInci: r.inci ?? null,
     recordName: r.name ?? null,
     recordCategory: r.category ?? null,
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
     optionalRmSubSubCategory: resolvedCats.optionalRmSubSubCategory,
     rmCategory: resolvedCats.rmCategory || (r.category ?? ''),
     rmCategoryKey: resolvedCats.rmCategoryKey || inferRmCategoryKeyFromCode(recordCode) || '',
     seriesPrefix: (() => {
       const inf = resolvedCats.rmCategoryKey || inferRmCategoryKeyFromCode(recordCode);
       return inf ? RM_CATEGORIES[inf]?.prefix ?? '' : '';
     })(),
     primaryUom: r.uom ?? '',
     gst: String(r.gst ?? ''),
     shelfLife: r.shelf ?? '',
     zohoId: r.zohoId ?? '',
     sku: r.zohoSkuCode ?? '',
     hsnCode: r.hsnCode ?? '',
     rmTaxPreference: r.taxPref ?? '',
     specificGravity:
      r.specificGravity != null && Number(r.specificGravity) > 0
        ? String(r.specificGravity)
        : '',
     /** Linked PR / product codes from list row when `form_data` is missing (legacy imports). */
     products: productsList,
     rmAssociateItems: productsList.length > 0 ? productsList.join('\n') : '',
     masterLifecycleStatus:
      r.masterLifecycleStatus &&
      (RM_MASTER_LIFECYCLE_OPTIONS as readonly string[]).includes(r.masterLifecycleStatus)
        ? r.masterLifecycleStatus
        : 'Active',
     masterApprovalStatus: normalizeMasterApprovalStatus(
      r.status ?? (fdObj as { masterApprovalStatus?: string } | null)?.masterApprovalStatus,
      'Draft'
     ),
     rmOwner: r.rmOwner ?? '',
     universalSwapEligibility:
      r.universalSwapEligibility === 'Yes' || r.universalSwapEligibility === 'No'
        ? r.universalSwapEligibility
        : '',
     functionalEquivalents: r.functionalEquivalents ?? '',
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
    const detailForSubSub = merged.optionalRmSubCategory;
    merged.optionalRmSubSubCategory =
      normalizeRmSubSubCategoryForSelect(detailForSubSub, resolvedCats.optionalRmSubSubCategory) ||
      normalizeRmSubSubCategoryForSelect(detailForSubSub, merged.optionalRmSubSubCategory) ||
      resolvedCats.optionalRmSubSubCategory ||
      merged.optionalRmSubSubCategory ||
      '';
    merged.rmCategory = resolvedCats.rmCategory || merged.rmCategory;
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

    const rawCoaRequired: unknown = (merged as { coaRequired?: unknown }).coaRequired;
    if (rawCoaRequired === true) (merged as { coaRequired: string }).coaRequired = 'Yes';
    else if (rawCoaRequired === false) (merged as { coaRequired: string }).coaRequired = 'No';
    else if (rawCoaRequired !== 'Yes' && rawCoaRequired !== 'No') {
      (merged as { coaRequired: string }).coaRequired = '';
    }

    const preservedProducts = parseRmLinkedProductsFromForm(merged);
    if (preservedProducts.length > 0) {
      merged.products = preservedProducts;
      if (!String(merged.rmAssociateItems ?? '').trim()) {
        merged.rmAssociateItems = preservedProducts.join('\n');
      }
    } else if (productsList.length > 0) {
      merged.products = productsList;
      merged.rmAssociateItems = productsList.join('\n');
    }

    const rawSwapElig: unknown = (merged as { universalSwapEligibility?: unknown }).universalSwapEligibility;
    if (rawSwapElig === true) (merged as { universalSwapEligibility: string }).universalSwapEligibility = 'Yes';
    else if (rawSwapElig === false) (merged as { universalSwapEligibility: string }).universalSwapEligibility = 'No';
    else if (rawSwapElig !== 'Yes' && rawSwapElig !== 'No') {
      (merged as { universalSwapEligibility: string }).universalSwapEligibility = '';
    }

    // Scalar key normalization for older persisted shapes.
    const anyFd: any = fdCleanOverlay ?? fdNormalized ?? fdObj ?? {};
    if (!merged.rmSku) merged.rmSku = String(anyFd?.sku ?? anyFd?.code ?? '');
     if (!merged.inciName) merged.inciName = String(anyFd?.inciName ?? anyFd?.inci ?? anyFd?.inci_name ?? '');
     if (!merged.tradeCommercialName) {
       merged.tradeCommercialName = String(anyFd?.tradeCommercialName ?? anyFd?.trade_commercial_name ?? anyFd?.name ?? merged.tradeCommercialName ?? '');
     }
     if (!merged.primaryUom) merged.primaryUom = String(anyFd?.primaryUom ?? anyFd?.uom ?? merged.primaryUom ?? '');
     const derivedSourcing = deriveRmSourcingFieldsFromVendors(
       Array.isArray((merged as { vendors?: RmCommercialVendor[] }).vendors)
         ? (merged as { vendors: RmCommercialVendor[] }).vendors
         : [],
       merged.primaryUom
     );
     for (const [key, value] of Object.entries(derivedSourcing)) {
       if (!String((merged as Record<string, unknown>)[key] ?? '').trim() && value.trim()) {
         (merged as unknown as Record<string, string>)[key] = value;
       }
     }
     if (!merged.sourcingCurrency?.trim() && String(anyFd?.preferredCurrency ?? '').trim()) {
       merged.sourcingCurrency = String(anyFd.preferredCurrency);
     }

     const sku = String(merged.rmSku || '').trim();
     if (!merged.rmCategoryKey && sku) {
       const inferred = inferRmCategoryKeyFromCode(sku);
       if (inferred) {
         merged.rmCategoryKey = inferred;
         merged.seriesPrefix = RM_CATEGORIES[inferred]?.prefix ?? merged.seriesPrefix;
       }
     }
     merged.rmQualitySpecRows = hydrateRmQualitySpecRows(merged as Record<string, unknown>);
     merged.rmQualitySubSpecRowsByPath = hydrateRmQualitySubSpecRowsByPath(
      merged as Record<string, unknown>
     );
     const rmQcCtx = {
      subCategory: String(merged.subCategory ?? ''),
      optionalRmSubCategory: String(merged.optionalRmSubCategory ?? ''),
      optionalRmSubSubCategory: String(merged.optionalRmSubSubCategory ?? ''),
     };
     const qcDisplay = applyRmQualitySpecTaxonomyDisplay(merged as Record<string, unknown>, rmQcCtx);
     merged.rmQualitySpecRows = qcDisplay.rmQualitySpecRows;
     merged.rmQualitySubSpecRowsByPath = qcDisplay.rmQualitySubSpecRowsByPath;
     return merged;
   });
  }).catch(() => {
   setEditRmLoading(false);
  });
  return () => { cancelled = true; };
 }, [pageTab, existingRmId, rmReloadToken]);

  const dashboardNode = (
    <RawMaterialDashboard
      refreshKey={masterRefreshKey}
      onSwitchToForm={() => {
        setExistingRmId(null);
        resetRmFormToEmpty();
        setPageTab('form');
      }}
      onEditRm={(rm) => {
        setEditApprovalStageAssignees(rm.approvalStageAssignees ?? emptyStageAssignees());
        setExistingRmId(rm.id);
        setPageTab('form');
        setCurrentStage(0);
      }}
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
 const approvalSubmitAction = getMasterApprovalSubmitAction(formData.masterApprovalStatus);
 const approvalRevertAction = getMasterApprovalRevertAction(formData.masterApprovalStatus);
 const canShowApprovalSubmit =
  approvalSubmitAction != null &&
  canApproveAtStatus(formData.masterApprovalStatus, editApprovalStageAssignees);
 const canShowApprovalRevert =
  !!existingRmId &&
  approvalRevertAction != null &&
  canApproveAtStatus(formData.masterApprovalStatus, editApprovalStageAssignees);
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
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-white">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800">
                  {isEditing ? 'Edit Raw Material' : 'New Raw Material'}
                </div>
                {isEditing && !isEditLoading ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className="font-mono font-semibold text-teal-700">
                      {formData.rmSku?.trim() || '—'}
                    </span>
                    {(formData.tradeCommercialName?.trim() || formData.inciName?.trim()) ? (
                      <>
                        <span className="text-gray-300" aria-hidden>
                          ·
                        </span>
                        <span className="truncate font-medium text-gray-900">
                          {formData.tradeCommercialName?.trim() || formData.inciName?.trim()}
                        </span>
                      </>
                    ) : null}
                  </div>
                ) : null}
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
                <MasterDropdownOptionsProvider entity="RM">
                <MasterCustomFieldsProvider entity="RM" taxonomyKey={rmCustomFieldsTaxonomyKey}>
                <MasterFormBase
                  title="Raw Material Master Data"
                  stages={stages}
                  currentStage={currentStage}
                  onStageChange={setCurrentStage}
                  errors={errors}
                  formData={formData}
                  onInputChange={handleInputChange}
                  primaryFields={getPrimaryFields('rawMaterial')}
                  onSave={() => void handleSave()}
                  onReset={handleReset}
                  onRevert={canShowApprovalRevert ? handleRevert : undefined}
                  revertLabel={approvalRevertAction?.revertLabel}
                  onSubmit={canShowApprovalSubmit ? handleSubmit : undefined}
                  submitLabel={approvalSubmitAction?.submitLabel ?? 'Submit'}
                  isNextDisabled={(idx) =>
                    isNewRm &&
                    ((idx === 0 && !canAdvancePastPrimary) || (idx === 1 && !canAdvancePastUnitsTax))
                  }
                  getNextDisabledTitle={(idx) => {
                    if (isNewRm && idx === 0 && !canAdvancePastPrimary) {
                      return 'Complete required primary fields (category, sub-category when applicable, INCI, trade/commercial name, and function in formula).';
                    }
                    if (isNewRm && idx === 1 && !canAdvancePastUnitsTax) {
                      return 'Complete Units & Taxes (primary UoM, returnable item, tax preference, and HSN/GST when taxable).';
                    }
                    return undefined;
                  }}
                  isStageDisabled={(idx) =>
                    isNewRm &&
                    ((idx > 0 && !canAdvancePastPrimary) || (idx > 1 && !canAdvancePastUnitsTax))
                  }
                >
                  {renderStageContent()}
                </MasterFormBase>
                </MasterCustomFieldsProvider>
                </MasterDropdownOptionsProvider>
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
          setPendingApprovalIntentStatus(null);
        }}
        onConfirm={handleConfirmSubmit}
        title={isEditing ? 'Preview — update raw material' : 'Preview — new raw material'}
        subtitle={
          approvalSubmitAction?.previewSubtitle ??
          'Review all values below. Confirm to save and advance approval status.'
        }
        sections={rmPreviewSections}
        confirmLabel={approvalSubmitAction?.confirmLabel ?? 'Confirm & submit'}
        confirming={submitConfirming}
        isEdit={isEditing}
      />
      <MasterSubmitPreviewModal
        isOpen={revertPreviewOpen}
        onClose={() => {
          if (submitConfirming) return;
          setRevertPreviewOpen(false);
        }}
        onConfirm={handleConfirmRevert}
        title={approvalRevertAction?.revertLabel ?? 'Send back to previous status'}
        subtitle={
          approvalRevertAction?.previewSubtitle ??
          'Optionally add a comment, then confirm to save and move this master to the previous status.'
        }
        sections={[]}
        confirmLabel={approvalRevertAction?.confirmLabel ?? 'Confirm & send back'}
        confirming={submitConfirming}
        isEdit
        commentPlaceholder="Why is this being sent back? (optional)"
      />
      <MasterSaveSuccessModal
        isOpen={saveSuccessOpen}
        onClose={closeSaveSuccessAndExit}
        title={saveSuccessIsEdit ? 'Raw material updated' : 'Raw material created'}
        subtitle={
         saveSuccessIsEdit
          ? 'Changes are saved. Internal code cannot be changed here.'
          : 'Your raw material is saved. Details and the generated internal code are below.'
        }
        generatedCode={saveSuccessCode}
        codeLabel={saveSuccessIsEdit ? 'Internal RM code (SKU)' : 'Generated internal code (SKU)'}
        rows={saveSuccessRows}
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

type RmListSortColumn = 'code' | 'name' | 'subCategory' | 'uom' | 'category' | 'status' | 'products';

function rmListCategoryLabel(rm: RawMaterialRecord): string {
  const cats = resolveRmEditCategories(rm);
  return cats.subCategory.trim() || String(rm.category ?? '').trim();
}

function rmListSubCategoryLabel(rm: RawMaterialRecord): string {
  return resolveRmEditCategories(rm).optionalRmSubCategory.trim();
}

const RawMaterialDashboard: React.FC<RawMaterialDashboardProps> = ({ refreshKey = 0, onSwitchToForm, onEditRm, onDeleteRm }) => {
 const { canAssignApprover } = useMasterApprovalPermission('RM');
 const [search, setSearch] = useState('');
 const [pageSize, setPageSize] = useState(25);
 const [currentPage, setCurrentPage] = useState(1);
 const [sortColumn, setSortColumn] = useState<RmListSortColumn | null>('code');
 const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
 /** Stat card filter: null = all, else RM category label. */
 const [statFilter, setStatFilter] = useState<string | null>(null);
 const [statusTab, setStatusTab] = useState<MasterApprovalStatusTab>('all');
 const [statCardSort, setStatCardSort] = useState<MasterStatCardSort>('count-desc');
 const [linkedSkusModalRm, setLinkedSkusModalRm] = useState<RawMaterialRecord | null>(null);
 const queryClient = useQueryClient();
 const { addToast } = useToast();
 const itemRefFileInputRef = useRef<HTMLInputElement>(null);
 const [bulkUploadRunning, setBulkUploadRunning] = useState(false);
 const [resetAllRunning, setResetAllRunning] = useState(false);

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
       const label =
         res.format === 'raw_materials_worksheet'
           ? 'Raw materials (Raw Materials sheet)'
           : res.format === 'multi_sheet'
             ? 'Raw materials (multi-sheet)'
             : 'Raw materials (Item Reference)';
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

  const statusCounts = useMemo(
    () => buildMasterApprovalStatusCounts(allRows, (r) => r.status),
    [allRows]
  );

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (statusTab !== 'all') {
      rows = rows.filter((r) => matchesMasterApprovalStatusTab(r.status, statusTab));
    }
    if (statFilter) {
      rows = rows.filter((r) => rmListCategoryLabel(r) === statFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.code, r.name, r.inci, r.category, r.zohoSkuCode].some((s) => (s ?? '').toLowerCase().includes(q))
    );
  }, [allRows, search, statFilter, statusTab]);

  const toggleRmSort = useCallback((column: RmListSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  }, [sortColumn]);

  const sortedFilteredRows = useMemo(() => {
    if (!sortColumn) return filteredRows;
    const dir = sortDirection;
    const cmp = (a: RawMaterialRecord, b: RawMaterialRecord): number => {
      switch (sortColumn) {
        case 'code':
          return compareMasterTableSort(a.code ?? '', b.code ?? '', dir);
        case 'name':
          return compareMasterTableSort(
            `${a.name ?? ''} ${a.inci ?? ''}`.trim(),
            `${b.name ?? ''} ${b.inci ?? ''}`.trim(),
            dir
          );
        case 'category':
          return compareMasterTableSort(rmListCategoryLabel(a), rmListCategoryLabel(b), dir);
        case 'subCategory':
          return compareMasterTableSort(rmListSubCategoryLabel(a), rmListSubCategoryLabel(b), dir);
        case 'uom':
          return compareMasterTableSort(a.uom ?? '', b.uom ?? '', dir);
        case 'status':
          return compareMasterTableSort(a.status ?? '', b.status ?? '', dir);
        case 'products':
          return compareMasterTableSort(a.products?.length ?? 0, b.products?.length ?? 0, dir);
        default:
          return 0;
      }
    };
    return [...filteredRows].sort(cmp);
  }, [filteredRows, sortColumn, sortDirection]);

  const totalFiltered = sortedFilteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const rows = sortedFilteredRows.slice(startIndex, startIndex + pageSize);

  // Reset to page 1 when search or page size changes (same pattern as Products PR page).
  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, refreshKey, sortColumn, sortDirection, statFilter, statusTab]);

  const categoryBuckets = useMemo(
    () => buildMasterStatBuckets(allRows, (r) => rmListCategoryLabel(r), statCardSort),
    [allRows, statCardSort]
  );

  const toggleStatFilter = useCallback((id: string | null) => {
    setStatFilter((prev) => (prev === id ? null : id));
    setCurrentPage(1);
  }, []);

  type RmStatCard = {
    id: string | null;
    label: string;
    value: number;
    sub: string;
    accent: string;
    num: string;
    badge?: { bg: string; text: string; border: string };
  };

  const statCards = useMemo((): RmStatCard[] => {
    const fixed: RmStatCard[] = [
      {
        id: null,
        label: 'TOTAL RMS',
        value: allRows.length,
        sub: 'All raw materials',
        accent: 'border-l-teal-500',
        num: 'text-teal-600',
      },
    ];
    const dynamic: RmStatCard[] = categoryBuckets.map((b) => {
      const style = getCategoryStyle(b.label);
      return {
        id: b.label,
        label: b.label,
        value: b.count,
        sub: b.count === 1 ? '1 material in category' : `${b.count} materials`,
        accent: 'border-l-teal-400',
        num: 'text-slate-800',
        badge: style,
      };
    });
    return [...fixed, ...dynamic];
  }, [allRows.length, categoryBuckets]);

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
    {/* ── Stat Cards (dynamic categories — click to filter table) ── */}
    <div className="space-y-2">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] text-gray-500">
       Click a card to filter the list
       {statFilter != null ? (
        <button
         type="button"
         onClick={() => toggleStatFilter(null)}
         className="ml-2 text-teal-700 font-semibold hover:underline"
        >
         Clear filter
        </button>
       ) : null}
      </p>
      <label className="flex items-center gap-2 text-[11px] text-gray-600">
       <span className="font-semibold uppercase tracking-wide text-gray-500">Sort cards</span>
       <select
        value={statCardSort}
        onChange={(e) => setStatCardSort(e.target.value as MasterStatCardSort)}
        className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
       >
        <option value="count-desc">Count (high → low)</option>
        <option value="count-asc">Count (low → high)</option>
        <option value="name-asc">Name (A → Z)</option>
        <option value="name-desc">Name (Z → A)</option>
       </select>
      </label>
     </div>
     <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
      {statCards.map((card) => {
       const isActive = statFilter === card.id;
       return (
        <button
         key={card.id ?? '__all__'}
         type="button"
         onClick={() => toggleStatFilter(card.id)}
         aria-pressed={isActive}
         className={`group text-left bg-white rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
          isActive ? 'border-teal-400 ring-2 ring-teal-200' : 'border-gray-100'
         }`}
        >
         <div className={`h-1 bg-linear-to-r from-teal-400 to-teal-600 ${card.accent}`} />
         <div className="px-4 py-4">
          {card.badge ? (
           <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border mb-1.5 max-w-full truncate ${card.badge.bg} ${card.badge.text} ${card.badge.border}`}
           >
            {card.label}
           </span>
          ) : (
           <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors truncate">
            {card.label}
           </p>
          )}
          <p className={`text-3xl font-extrabold mt-1 ${card.num} group-hover:scale-105 transition-transform origin-left`}>
           {card.value}
          </p>
          <p className="text-[11px] text-gray-400 mt-2 group-hover:text-gray-500 transition-colors line-clamp-2">
           {card.sub}
          </p>
         </div>
        </button>
       );
      })}
     </div>
    </div>

    <MasterApprovalStatusTabs
     value={statusTab}
     onChange={(tab) => {
      setStatusTab(tab as MasterApprovalStatusTab);
      setCurrentPage(1);
     }}
     counts={statusCounts}
     accent="teal"
    />

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
        title="Multi-tab RM workbook: tabs Raw Materials, Fragrances, Colors & Pigments — row 4 headers (A–M), data from row 5. Legacy: sheet Item Reference (cols A–C, row 2+)."
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
         <SortableTableTh
          label="Code"
          column="code"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={toggleRmSort}
          accent="teal"
          thClassName="py-4"
         />
         <SortableTableTh
          label="Name / INCI"
          column="name"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={toggleRmSort}
          accent="teal"
          thClassName="py-4"
         />
         <SortableTableTh
          label="Category"
          column="category"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={toggleRmSort}
          accent="teal"
          thClassName="py-4"
         />
         <SortableTableTh
          label="Sub-category"
          column="subCategory"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={toggleRmSort}
          accent="teal"
          thClassName="py-4"
         />
         <SortableTableTh
          label="UOM"
          column="uom"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={toggleRmSort}
          accent="teal"
          thClassName="py-4"
         />
         <SortableTableTh
          label="Status"
          column="status"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={toggleRmSort}
          accent="teal"
          thClassName="py-4"
         />
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Assign</th>
         <SortableTableTh
          label="Products"
          column="products"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={toggleRmSort}
          accent="teal"
          thClassName="py-4"
         />
         <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Logs</th>
         <th className="px-4 py-4 text-right font-semibold uppercase tracking-wider text-gray-600">Actions</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-gray-50">
        {totalFiltered === 0 ? (
         <tr>
          <td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">
           <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            No raw materials match your search.
           </div>
          </td>
         </tr>
       ) : rows.map((rm, _idx) => {
         const categoryLabel = rmListCategoryLabel(rm);
         const subCategoryLabel = rmListSubCategoryLabel(rm);
         const catStyle = getCategoryStyle(categoryLabel);
         return (
          <tr key={rm.code} className="hover:bg-linear-to-r hover:from-teal-50/50 hover:to-transparent transition-colors group border-b border-gray-50 last:border-0">
           {/* code */}
           <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-teal-700 whitespace-nowrap group-hover:text-teal-900">{rm.code}</td>
           {/* name / inci */}
           <td className="px-4 py-3.5 whitespace-nowrap">
            <p className="font-semibold text-gray-900 group-hover:text-teal-700 transition-colors">{rm.name}</p>
            <p className="text-gray-400 text-[10px] mt-0.5 italic">{rm.inci}</p>
           </td>
           {/* category */}
           <td className="px-4 py-3.5">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all group-hover:shadow-sm ${catStyle.bg} ${catStyle.text} ${catStyle.border} whitespace-nowrap`}>
             {categoryLabel || '—'}
            </span>
           </td>
           {/* sub-category */}
           <td className="px-4 py-3.5 text-gray-700 font-medium">{subCategoryLabel || '—'}</td>
           {/* uom */}
           <td className="px-4 py-3.5 text-gray-700 font-semibold">{rm.uom}</td>
           {/* status */}
           <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
            <MasterApprovalStatusCell
             kind="RM"
             itemId={rm.id}
             status={rm.status}
            />
           </td>
           <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
            <MasterApprovalAssignCell
             kind="RM"
             itemId={rm.id}
             itemCode={rm.code}
             stageAssignees={rm.approvalStageAssignees}
             canAssign={canAssignApprover}
             onSaved={(assignees) => {
              void queryClient.invalidateQueries({ queryKey: ['raw-materials-full-list'] });
              void queryClient.setQueryData<RawMaterialRecord[]>(
                ['raw-materials-full-list', refreshKey],
                (prev) =>
                  prev?.map((row) =>
                    row.id === rm.id ? { ...row, approvalStageAssignees: assignees } : row
                  ) ?? prev
              );
             }}
            />
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
           <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
            <MasterApprovalLogsCell
             kind="RM"
             itemId={rm.id}
             itemCode={rm.code}
             itemLabel={rm.name}
             currentStatus={rm.status}
            />
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
        <p className="mb-3 text-xs text-gray-500">
         When a linked code matches a product in the master list, use Open PR master to view or edit that product.
        </p>
        <MasterLinkedPrProductsPanel
         codes={linkedSkusModalRm.products}
         accent="teal"
         variant="table"
        />
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
 value: string;
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
 value: string;
 onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
 options: readonly SelectOption[];
 disabled?: boolean;
 requiredMark?: boolean;
 error?: string;
 emptyLabel?: string;
}> = ({ label, id, value, onChange, options, disabled, requiredMark, error, emptyLabel }) => (
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
   <option value="">{emptyLabel ?? 'Select...'}</option>
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
 requiredMark?: boolean;
 error?: string;
}> = ({ label, id, value, onChange, rows = 3, placeholder, requiredMark, error }) => (
 <div>
  <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
   {label}
   {requiredMark ? <span className="text-red-600 ml-0.5" aria-hidden>*</span> : null}
  </label>
  <textarea
   id={id}
   value={value || ''}
   onChange={onChange}
   aria-invalid={error ? true : undefined}
   rows={rows}
   placeholder={placeholder}
   className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    error ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
   }`}
  />
  {error ? <p className="mt-1 text-xs text-red-600" role="alert">{error}</p> : null}
 </div>
);

export default RawMaterialRefactored;
