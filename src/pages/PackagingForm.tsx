import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MasterSubmitPreviewModal } from '../components/masters/MasterSubmitPreviewModal';
import { MasterApprovalStatusCell } from '../components/masters/MasterApprovalStatusCell';
import { MasterApprovalAssignCell } from '../components/masters/MasterApprovalAssignCell';
import { MasterApprovalLogsCell } from '../components/masters/MasterApprovalLogsCell';
import { MasterApprovalStatusTabs } from '../components/masters/MasterApprovalStatusTabs';
import { MasterSaveSuccessModal, type MasterSaveSuccessRow } from '../components/masters/MasterSaveSuccessModal';
import { PM_PREVIEW_SECTIONS } from '../constants/masterSubmitPreviewFields';
import { derivePmVendorFieldsFromVendors } from '../constants/masterVendorSectionRedundantFields';
import { buildMasterPreviewSections } from '../utils/masterSubmitPreview';
import { buildPmPreviewBaselineFromFetch } from '../lib/masterPreviewBaseline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { resolveMasterQualityStageIndex } from '../lib/qualityTableNavigation';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import ArrayItemManager from '../components/ArrayItemManager';
import VendorCommercialEditor, {
  defaultTempVendorTiers,
  findVendorClientByName,
  type PmCommercialVendor,
  type VendorTierDraft,
} from '../components/VendorCommercialEditor';
import { syncMasterVendorsToPriceList } from '../utils/syncVendorMasterToPriceList';
import { validateStagedPercents, serializeStagedPaymentTerms } from '../lib/stagedPaymentTerms';
import {
  buildMasterApprovalStatusCounts,
  emptyStageAssignees,
  isMasterApprovalDraft,
  matchesMasterApprovalStatusTab,
  normalizeMasterApprovalStatus,
  normalizeStageAssignees,
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
import { fetchPackMaterialsList, fetchPackMaterialById, createPackMaterial, updatePackMaterial, deletePackMaterial, postPackMaterialsMasterExcel, resetAllPackMaterialsMaster, type PackMaterialRecord, type CreatePackMaterialPayload } from '../services/packMaterials.service';
import { SortableTableTh, type SortDirection } from '../components/ui/SortableTableTh';
import {
  buildMasterStatBuckets,
  compareMasterTableSort,
  type MasterStatCardSort,
} from '../lib/masterTableSort';
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
  pmDetailSubCategoryHasSubSubCategory,
  pmLevelForSubCategory,
  pmSkuCategoryRequiresDetailSubCategory,
  pmSubCategorySkuPrefix,
  pmSubSubCategoryOptionsForDetailSubCategory,
  normalizePmSubSubCategoryForSelect,
  pmUsesFunctionalCategoryTaxonomy,
} from '../constants/materialMasterSkuRules';
import { resolvePmEditCategories } from '../utils/masterImportCategoryResolve';
import { getPmConditionalVisibility } from '../lib/pmConditionalFields';
import { MasterLinkedPrProductsPanel } from '../components/masters/MasterLinkedPrProductsPanel';
import { parseMasterLinkedProductCodes } from '../lib/masterLinkedPrProducts';
import type { QualitySpecTableRow } from '../types/qualitySpecTable';
import {
  applyPmQualitySpecTaxonomyDisplay,
  flattenPmQualitySpecRowsForPayload,
  flattenPmQualitySubSpecRowsByPathForPayload,
  hydratePmQualitySpecRows,
  hydratePmQualitySubSpecRowsByPath,
  resolvePmQualitySpecContext,
  canEditPmQualityCategorySpecs,
  shouldShowPmQualitySpecTable,
  shouldShowPmQualitySubSpecTable,
} from '../lib/pmQualitySpecVisibility';
import PmMasterSectionContent from '../components/packaging/PmMasterSectionContent';
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
import { PM_MASTER_FIELD_KEYS, PM_MASTER_MODULE_ORDER, emptyPmMasterScalarDefaults } from '../constants/pmMasterFieldSchema';
import { buildPmMasterFieldContext, type PmMasterFieldContext } from '../lib/pmMasterFieldVisibility';
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

const PM_QC_TESTING_GROUP_OPTIONS = ['Packaging QC only'] as const;
const STORAGE_TYPES = ['Ambient – Dry', 'Ambient – Cool', 'Refrigerated (2–8°C)', 'Frozen', 'Flammable Store'];

const PM_REUSABILITY_OPTIONS = [
  { value: 'Single-use', label: 'Single-use' },
  { value: 'Reusable', label: 'Reusable' },
  { value: 'Refillable', label: 'Refillable' },
] as const;

const PM_COA_REQUIRED_OPTIONS = ['Yes', 'No'] as const;

const PM_LIFECYCLE_STATUS_OPTIONS = [
  'Active',
  'Preferred',
  'Conditional',
  'Phase-Out',
  'Discontinued',
] as const;

const PM_MATERIAL_OPTIONS = [
  'PET',
  'HDPE',
  'LDPE',
  'PP',
  'PVC',
  'PETG',
  'Glass',
  'Aluminium',
  'ABL',
  'Acrylic',
  'Duplex/SBS',
  'FBB',
  'Kraft',
  'BOPP',
  'BOPET',
  'Corrugated',
  'Wood',
  'Metal',
  'Silica gel',
] as const;

const PM_REQUIRED_FIELDS: Array<{
  id: string;
  label: string;
  section: number;
  toastMessage: string;
}> = [
  { id: 'pmSkuCategory', label: 'Category', section: 0, toastMessage: 'Step 1 — Category is required' },
  {
    id: 'tradeCommercialName',
    label: 'PM Name / description',
    section: 0,
    toastMessage: 'Step 1 — PM Name / description is required',
  },
  { id: 'pkgUnit', label: 'Primary UoM', section: 1, toastMessage: 'Step 2 — Primary UoM is required' },
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

type PackagingFormData = {
  status: string;
  masterApprovalStatus: string;
  version: string;
  pmLifecycleStatus: string;
  pmSkuCategory: string;
  optionalPmSubCategory: string;
  optionalPmSubSubCategory: string;
  subCategory: string;
  level: string;
  itemCode: string;
  tradeCommercialName: string;
  name: string;
  pkgUnit: string;
  pkgHsn: string;
  pkgGst: string;
  pkgTaxPreference: string;
  pkgReturnable: string;
  pkgUnitsPerShipperRoll: string;
  pkgAssociateItems: string;
  preferredVendor: string;
  alternateVendor: string;
  preferredVendorClientId: string;
  alternateVendorClientId: string;
  pmSupplyLocation: string;
  zohoId: string;
  pkgSku: string;
  matBody: string;
  specNominal: string;
  pmOverallHeightMm: string;
  decorationMethod: string;
  vendors: PmCommercialVendor[];
  pmQualitySpecRows: QualitySpecTableRow[];
  pmQualitySubSpecRowsByPath: Record<string, QualitySpecTableRow[]>;
  pmQualitySpecHiddenParameters: string[];
  pmQualitySubSpecHiddenByPath: Record<string, string[]>;
  products: string[];
  tests: Array<{ name: string; result: string; date: string; by: string; remarks: string }>;
  [key: string]:
    | string
    | boolean
    | PmCommercialVendor[]
    | QualitySpecTableRow[]
    | Record<string, QualitySpecTableRow[]>
    | string[]
    | Array<{ name: string; result: string; date: string; by: string; remarks: string }>
    | undefined;
};

/** Fresh PM form state when opening a new item or after closing the onboarding overlay. */
function createEmptyPackagingFormData(): PackagingFormData {
  const base: PackagingFormData = {
    ...emptyPmMasterScalarDefaults(),
    status: 'Draft',
    masterApprovalStatus: 'Draft',
    version: 'v1.0',
    pmLifecycleStatus: 'Active',
    pmSkuCategory: '',
    optionalPmSubCategory: '',
    optionalPmSubSubCategory: '',
    subCategory: '',
    level: '',
    itemCode: '',
    zohoId: '',
    pkgSku: '',
    pkgUnit: 'PCS',
    pkgHsn: '',
    pkgGst: '',
    pkgTaxPreference: '',
    pkgReturnable: '',
    pkgUnitsPerShipperRoll: '',
    pkgAssociateItems: '',
    products: [],
    name: '',
    tradeCommercialName: '',
    preferredVendor: '',
    alternateVendor: '',
    preferredVendorClientId: '',
    alternateVendorClientId: '',
    pmSupplyLocation: '',
    matBody: '',
    specNominal: '',
    pmOverallHeightMm: '',
    decorationMethod: '',
    pmQualitySpecRows: [],
    pmQualitySubSpecRowsByPath: {},
    pmQualitySpecHiddenParameters: [],
    pmQualitySubSpecHiddenByPath: {},
    vendors: [],
    tests: [],
  };
  for (const key of PM_MASTER_FIELD_KEYS) {
    if (base[key] === undefined) base[key] = '';
  }
  return base;
}

const SECTIONS = PM_MASTER_MODULE_ORDER.map((m) => m.title);

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
  const [masterRefreshKey, setMasterRefreshKey] = useState(0);
  const [pmReloadToken, setPmReloadToken] = useState(0);
  const [editPmLoading, setEditPmLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [autoSaveOn, setAutoSaveOn] = useState(true);
  const [lastSaved, setLastSaved] = useState<string>('—');
  const [generatedCode, setGeneratedCode] = useState('');
  const [submitPreviewOpen, setSubmitPreviewOpen] = useState(false);
  const [submitPreviewBaseline, setSubmitPreviewBaseline] = useState<Record<string, unknown> | null>(null);
  const [revertPreviewOpen, setRevertPreviewOpen] = useState(false);
  const [pendingPmPayload, setPendingPmPayload] = useState<CreatePackMaterialPayload | null>(null);
  const [pendingApprovalIntentStatus, setPendingApprovalIntentStatus] = useState<string | null>(null);
  const [submitConfirming, setSubmitConfirming] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [editApprovalStageAssignees, setEditApprovalStageAssignees] =
    useState<MasterApprovalStageAssignees>(emptyStageAssignees);
  const { canApproveAtStatus } = useMasterApprovalPermission('PM');
  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false);
  const [saveSuccessCode, setSaveSuccessCode] = useState('');
  const [saveSuccessRows, setSaveSuccessRows] = useState<MasterSaveSuccessRow[]>([]);
  const [saveSuccessIsEdit, setSaveSuccessIsEdit] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const masterDeepLinkAppliedRef = useRef(false);
  const pendingQualityStageRef = useRef(false);
  const pmDeepLinkCode = searchParams.get('pm')?.trim() ?? '';
  const stepDeepLink = searchParams.get('step')?.trim().toLowerCase() ?? '';
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
  const pmSubSubCategoryRequired = pmDetailSubCategoryHasSubSubCategory(
    formData.optionalPmSubCategory,
    formData.pmSkuCategory || formData.subCategory
  );
  const pmUsesFunctionalTaxonomy = pmUsesFunctionalCategoryTaxonomy(
    formData.pmSkuCategory || formData.subCategory
  );
  const pmFunctionalCategoryLabel = pmUsesFunctionalTaxonomy ? 'Sub-category' : 'Sub-category';
  const pmFunctionalSubCategoryLabel = pmUsesFunctionalTaxonomy ? 'Sub-sub category' : 'Sub-sub category';
  const pmConditionalVisibility = useMemo(
    () =>
      getPmConditionalVisibility({
        pmSkuCategory: formData.pmSkuCategory || formData.subCategory,
        subCategory: formData.subCategory,
        optionalPmSubCategory: formData.optionalPmSubCategory,
        optionalPmSubSubCategory: formData.optionalPmSubSubCategory,
      }),
    [
      formData.pmSkuCategory,
      formData.subCategory,
      formData.optionalPmSubCategory,
      formData.optionalPmSubSubCategory,
    ]
  );
  const pmQualitySpecCtx = useMemo(
    () => ({
      pmSkuCategory: formData.pmSkuCategory || formData.subCategory,
      subCategory: formData.subCategory,
      optionalPmSubCategory: formData.optionalPmSubCategory,
      optionalPmSubSubCategory: formData.optionalPmSubSubCategory,
    }),
    [
      formData.pmSkuCategory,
      formData.subCategory,
      formData.optionalPmSubCategory,
      formData.optionalPmSubSubCategory,
    ]
  );
  const pmQualitySpecResolved = useMemo(
    () => resolvePmQualitySpecContext(pmQualitySpecCtx),
    [pmQualitySpecCtx]
  );
  const showPmQualitySpecTable = useMemo(
    () => shouldShowPmQualitySpecTable(pmQualitySpecCtx),
    [pmQualitySpecCtx]
  );
  const showPmQualitySubSpecTable = useMemo(
    () => shouldShowPmQualitySubSpecTable(pmQualitySpecCtx),
    [pmQualitySpecCtx]
  );
  const canEditPmQualityCategory = useMemo(
    () => canEditPmQualityCategorySpecs(pmQualitySpecCtx),
    [pmQualitySpecCtx]
  );
  const currentPmSubSpecRows = useMemo(() => {
    const pathKey = pmQualitySpecResolved.subSpecPathKey;
    if (!pathKey) return [];
    return formData.pmQualitySubSpecRowsByPath[pathKey] ?? [];
  }, [formData.pmQualitySubSpecRowsByPath, pmQualitySpecResolved.subSpecPathKey]);

  const handlePmQualitySpecRowsChange = useCallback(
    (rows: QualitySpecTableRow[]) => {
      setFormData((prev) => {
        const categoryKey = pmQualitySpecResolved.functionalCategory;
        const prevRows = prev.pmQualitySpecRows ?? [];
        const addedHidden = categoryKey
          ? collectNewlyHiddenSharedParameters('PM', 'common', categoryKey, prevRows, rows)
          : [];
        return {
          ...prev,
          pmQualitySpecRows: rows,
          pmQualitySpecHiddenParameters: appendHiddenParameters(
            prev.pmQualitySpecHiddenParameters ?? [],
            addedHidden
          ),
        };
      });
    },
    [pmQualitySpecResolved.functionalCategory]
  );

  const handlePmQualitySubSpecRowsChange = useCallback(
    (rows: QualitySpecTableRow[]) => {
      const pathKey = pmQualitySpecResolved.subSpecPathKey;
      if (!pathKey) return;
      setFormData((prev) => {
        const prevRows = prev.pmQualitySubSpecRowsByPath[pathKey] ?? [];
        const addedHidden = collectNewlyHiddenSharedParameters('PM', 'sub', pathKey, prevRows, rows);
        return {
          ...prev,
          pmQualitySubSpecRowsByPath: {
            ...prev.pmQualitySubSpecRowsByPath,
            [pathKey]: rows,
          },
          pmQualitySubSpecHiddenByPath: appendHiddenParametersForPath(
            prev.pmQualitySubSpecHiddenByPath ?? {},
            pathKey,
            addedHidden
          ),
        };
      });
    },
    [pmQualitySpecResolved.subSpecPathKey]
  );

  const pmSubSubCategoryOptions = useMemo(() => {
    const base = pmSubSubCategoryOptionsForDetailSubCategory(
      formData.optionalPmSubCategory,
      formData.pmSkuCategory || formData.subCategory
    );
    const cur = String(formData.optionalPmSubSubCategory ?? '').trim();
    if (cur && !base.some((o) => o.value === cur)) {
      return [{ value: cur, label: cur }, ...base];
    }
    return base;
  }, [
    formData.pmSkuCategory,
    formData.subCategory,
    formData.optionalPmSubCategory,
    formData.optionalPmSubSubCategory,
  ]);
  const canAdvancePastPrimary =
    !isNewPm ||
    Boolean(
      isCanonicalPmSkuCategory(formData.pmSkuCategory || formData.subCategory) &&
        pmLevelForSubCategory(formData.pmSkuCategory || formData.subCategory) &&
        (formData.tradeCommercialName?.trim() || formData.name?.trim())
    );
  const canAdvancePastUnitsTaxes =
    !isNewPm ||
    Boolean(
      formData.pkgUnit?.trim() &&
        formData.pkgReturnable?.trim() &&
        formData.pkgTaxPreference?.trim() &&
        (!taxIsTaxable || (formData.pkgHsn?.trim() && formData.pkgGst?.toString().trim()))
    );
  const isPmSectionNavLocked = (idx: number): boolean => {
    if (!isNewPm) return false;
    if (idx > 0 && !canAdvancePastPrimary) return true;
    if (idx > 1 && !canAdvancePastUnitsTaxes) return true;
    return false;
  };
  /** On edit: internal code and level stay fixed; identity, UoM, returnable, and tax remain editable. */

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
  const { data: vendorClientData, isFetching: vendorClientsLoading } = useQuery({
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
    setGeneratedCode('');
    setErrors({});
    setCurrentSection(0);
    setExistingPmId(null);
    setEditApprovalStageAssignees(emptyStageAssignees());
  }, []);

  const buildPmPayloadWithApproval = (): CreatePackMaterialPayload =>
    withMasterDraftApprovalStatus(
      buildPayload() as Record<string, unknown>,
      formData.masterApprovalStatus
    ) as CreatePackMaterialPayload;

  const validatePmForDraft = (): CreatePackMaterialPayload | null => {
    if (!existingPmId) {
      const hasCategory = Boolean(
        normalizePmSkuCategoryForSelect(formData.pmSkuCategory || formData.subCategory)
      );
      const hasName = Boolean(formData.tradeCommercialName?.trim() || formData.name?.trim());
      if (!hasCategory && !hasName) {
        addToast('error', 'Enter a PM category or item name before saving a draft');
        setCurrentSection(0);
        return null;
      }
    }
    return buildPmPayloadWithApproval();
  };

  const handleSave = async () => {
    const payload = validatePmForDraft();
    if (!payload) return;
    setDraftSaving(true);
    try {
      let savedPmId = existingPmId;
      if (existingPmId) {
        const pmIdForSync = parseInt(String(existingPmId), 10);
        await updatePackMaterial(existingPmId, payload);
        if (!Number.isNaN(pmIdForSync)) await syncPmVendorsToItemsListAfterSave(pmIdForSync);
      } else {
        const saved = await createPackMaterial({ ...payload });
        savedPmId = String(saved.id);
        setExistingPmId(savedPmId);
        setFormData((prev) => ({
          ...prev,
          itemCode: saved.code || prev.itemCode,
          masterApprovalStatus: 'Draft',
          status: 'Draft',
        }));
        const newPmId = parseInt(String(saved.id), 10);
        if (!Number.isNaN(newPmId)) await syncPmVendorsToItemsListAfterSave(newPmId);
      }
      if (savedPmId) {
        const fresh = await fetchPackMaterialById(savedPmId);
        if (fresh) {
          setEditApprovalStageAssignees(normalizeStageAssignees(fresh.approvalStageAssignees));
        }
      }
      localStorage.removeItem('packaging_draft_new');
      queryClient.invalidateQueries({ queryKey: ['pack-materials-full-list'] });
      setMasterRefreshKey((k) => k + 1);
      addToast('success', 'Draft saved. Continue editing and submit for review when ready.');
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save draft');
    } finally {
      setDraftSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    if (id === 'zohoId') return;
    if (
      id === 'pkgHsn' ||
      id === 'pkgGst' ||
      id === 'pkgTaxPreference' ||
      id === 'pkgReturnable' ||
      id === 'pkgUnit' ||
      id in errors
    ) {
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
      setFormData((prev) => {
        const optionalPmSubCategory = normalizePmDetailSubCategoryForSelect(canon, prev.optionalPmSubCategory);
        const nextCtx = {
          optionalPmSubCategory,
          optionalPmSubSubCategory: '',
          pmSkuCategory: canon || prev.pmSkuCategory,
          subCategory: canon || prev.subCategory,
        };
        const stripped = {
          ...prev,
          pmSkuCategory: canon || prev.pmSkuCategory,
          subCategory: canon || prev.subCategory,
          optionalPmSubCategory,
          optionalPmSubSubCategory: '',
          pmQualitySpecRows: [],
          pmQualitySubSpecRowsByPath: {},
          ...(level ? { level } : {}),
        };
        const display = applyPmQualitySpecTaxonomyDisplay(
          stripped as Record<string, unknown>,
          nextCtx
        );
        return { ...stripped, ...display };
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next.pmSkuCategory;
        delete next.optionalPmSubCategory;
        delete next.optionalPmSubSubCategory;
        return next;
      });
      return;
    }
    if (id === 'optionalPmSubCategory') {
      const detail = normalizePmDetailSubCategoryForSelect(
        formData.pmSkuCategory || formData.subCategory,
        value
      ) || value;
      setFormData((prev) => {
        const optionalPmSubSubCategory = normalizePmSubSubCategoryForSelect(
          detail,
          prev.optionalPmSubSubCategory,
          formData.pmSkuCategory || formData.subCategory
        );
        const nextCtx = {
          optionalPmSubCategory: detail,
          optionalPmSubSubCategory,
          pmSkuCategory: prev.pmSkuCategory || prev.subCategory,
          subCategory: prev.subCategory,
        };
        const stripped = {
          ...prev,
          optionalPmSubCategory: detail,
          optionalPmSubSubCategory,
          pmQualitySpecRows: [],
          pmQualitySubSpecRowsByPath: {},
        };
        const display = applyPmQualitySpecTaxonomyDisplay(
          stripped as Record<string, unknown>,
          nextCtx
        );
        return { ...stripped, ...display };
      });
      setErrors((prev) => {
        if (!prev.optionalPmSubCategory && !prev.optionalPmSubSubCategory) return prev;
        const next = { ...prev };
        delete next.optionalPmSubCategory;
        delete next.optionalPmSubSubCategory;
        return next;
      });
      return;
    }
    if (id === 'optionalPmSubSubCategory') {
      setFormData((prev) => {
        const nextCtx = {
          optionalPmSubCategory: prev.optionalPmSubCategory,
          optionalPmSubSubCategory: value,
          pmSkuCategory: prev.pmSkuCategory || prev.subCategory,
          subCategory: prev.subCategory,
        };
        const stripped = {
          ...prev,
          optionalPmSubSubCategory: value,
          pmQualitySubSpecRowsByPath: {},
        };
        const display = applyPmQualitySpecTaxonomyDisplay(
          stripped as Record<string, unknown>,
          nextCtx
        );
        return {
          ...stripped,
          pmQualitySubSpecRowsByPath: display.pmQualitySubSpecRowsByPath,
        };
      });
      setErrors((prev) => {
        if (!prev.optionalPmSubSubCategory) return prev;
        const next = { ...prev };
        delete next.optionalPmSubSubCategory;
        return next;
      });
      return;
    }
    if (id === 'pmLifecycleStatus') {
      const normalized = normalizePmLifecycleStatus(value);
      setFormData((prev) => ({
        ...prev,
        pmLifecycleStatus: normalized,
      }));
      return;
    }
    if (id === 'version') {
      setFormData((prev) => ({ ...prev, version: value }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

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
    const paymentTerms = serializeStagedPaymentTerms({
      advance_pct: Number(tempVendor.advancePct) || 0,
      pre_shipment_pct: Number(tempVendor.preShipmentPct) || 0,
      post_shipment_pct: Number(tempVendor.postShipmentPct) || 0,
      credit_days: Number(tempVendor.creditDays) || 0,
    });
    const newVendor = {
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
    };
    setFormData((prev) => {
      const vendors = [...prev.vendors, newVendor];
      return {
        ...prev,
        vendors,
        ...derivePmVendorFieldsFromVendors(vendors, paymentTerms),
        pmSupplyLocation: prev.pmSupplyLocation?.trim() || newVendor.location?.trim() || prev.pmSupplyLocation,
      };
    });
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
  const handleVendorsChange = (vendors: PmCommercialVendor[]) => {
    setFormData((prev) => ({ ...prev, vendors }));
  };

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

  const handlePmFileNameCapture = (fieldId: 'catCataloguePhoto', file: File | null): void => {
    setFormData((prev) => ({ ...prev, [fieldId]: file?.name ?? '' }));
  };

  const handleReset = () => {
    if (window.confirm('Reset all form data? This cannot be undone.')) {
      resetPmFormToEmpty();
      addToast('info', 'Form reset');
    }
  };

  const buildPayload = () => {
    const firstVendor = formData.vendors[0];
    const skuForZoho = undefined;
    const codeTrim = String(formData.itemCode ?? formData.pkgSku ?? '').trim();
    const descBase =
      formData.tradeCommercialName?.trim() || formData.name?.trim() || 'New pack material';
    const skuCat =
      normalizePmSkuCategoryForSelect(formData.pmSkuCategory || formData.subCategory) ||
      String(formData.pmSkuCategory || formData.subCategory || '')
        .trim()
        .toLowerCase();
    return {
      description: descBase,
      level: formData.level || undefined,
      group: skuCat || undefined,
      material: formData.matBody?.trim() || undefined,
      size_spec:
        formData.specNominal?.trim() ||
        formData.pmOverallHeightMm?.trim() ||
        undefined,
      price_per_pc: firstVendor?.price != null ? Number(firstVendor.price) : undefined,
      moq: firstVendor?.moq != null ? Number(firstVendor.moq) : undefined,
      lead_time_days: firstVendor?.leadTime != null ? Number(firstVendor.leadTime) : undefined,
      print_status: formData.decorationMethod || undefined,
      zohoId: formData.zohoId?.trim() ? formData.zohoId.trim() : undefined,
      zoho_sku_code: skuForZoho,
      hsnCode: formData.pkgHsn?.trim() ? formData.pkgHsn.trim() : undefined,
      unit: formData.pkgUnit?.trim() ? formData.pkgUnit.trim() : undefined,
      taxPref: formData.pkgTaxPreference ?? undefined,
      pkgReturnable: formData.pkgReturnable === 'Yes' ? true : formData.pkgReturnable === 'No' ? false : null,
      pkgAssociateItems: formData.pkgAssociateItems?.trim() ? formData.pkgAssociateItems.trim() : undefined,
      ...(Array.isArray(formData.products) && formData.products.length > 0
        ? { products: formData.products }
        : {}),
      form_data: (() => {
        const qcSpecRows = flattenPmQualitySpecRowsForPayload(formData.pmQualitySpecRows ?? []);
        const qcSubSpecRowsByPath = flattenPmQualitySubSpecRowsByPathForPayload(
          formData.pmQualitySubSpecRowsByPath ?? {}
        );
        const {
          pmCategory: _pmCat,
          excelCategory: _excelCat,
          excelSubCategory: _excelSub,
          matBody: _matBody,
          subCategory: _sub,
          pmSkuCategory: _pmSku,
          optionalPmSubCategory: _optSub,
          optionalPmSubSubCategory: _optSubSub,
          itemCategory: _itemCategory,
          ...formRest
        } = formData as Record<string, unknown>;
        return {
          ...formRest,
          ...derivePmVendorFieldsFromVendors(
            formData.vendors,
            serializeStagedPaymentTerms({
              advance_pct: Number(firstVendor?.advancePct) || 0,
              pre_shipment_pct: Number(firstVendor?.preShipmentPct) || 0,
              post_shipment_pct: Number(firstVendor?.postShipmentPct) || 0,
              credit_days: Number(firstVendor?.creditDays) || 0,
            })
          ),
          pmQualitySpecRows: qcSpecRows,
          pmQualitySubSpecRowsByPath: qcSubSpecRowsByPath,
          pmQualitySpecHiddenParameters: formData.pmQualitySpecHiddenParameters ?? [],
          pmQualitySubSpecHiddenByPath: formData.pmQualitySubSpecHiddenByPath ?? {},
          masterCustomDropdownOptions: loadEntityCustomDropdownOptions('PM'),
          masterCustomFields: loadEntityCustomFields('PM'),
          masterSharedQualitySpecs: { PM: loadEntitySharedQualitySpecs('PM') },
          ...(codeTrim ? { itemCode: codeTrim } : {}),
          ...(skuCat
            ? {
                subCategory: skuCat,
                pmSkuCategory: skuCat,
                optionalPmSubCategory: formData.optionalPmSubCategory?.trim() || undefined,
                optionalPmSubSubCategory: formData.optionalPmSubSubCategory?.trim() || undefined,
              }
            : {}),
        };
      })(),
    };
  };

  const pmPreviewFormData = useMemo(
    () => formData as Record<string, unknown>,
    [formData]
  );
  const pmPreviewSections = useMemo(
    () =>
      buildMasterPreviewSections(pmPreviewFormData, PM_PREVIEW_SECTIONS, {
        baselineFormData: submitPreviewBaseline ?? undefined,
        omitKeys: isNewPm
          ? ['itemCode', 'pkgSku', 'itemCategory', 'pmQualitySpecRows', 'pmQualitySubSpecRowsByPath']
          : ['itemCategory', 'pmQualitySpecRows', 'pmQualitySubSpecRowsByPath'],
      }),
    [pmPreviewFormData, isNewPm, submitPreviewBaseline]
  );
  const pmLinkedProductCodes = useMemo(
    () =>
      parseMasterLinkedProductCodes({
        products: formData.products,
        associateItems: formData.pkgAssociateItems,
      }),
    [formData.products, formData.pkgAssociateItems]
  );

  const validatePmForSubmit = (): CreatePackMaterialPayload | null => {
    for (const field of PM_REQUIRED_FIELDS) {
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
      if (field.id === 'tradeCommercialName') {
        const trade = String(formData.tradeCommercialName ?? formData.name ?? '').trim();
        if (!trade) {
          const stepNo = field.section + 1;
          setErrors((prev) => ({
            ...prev,
            tradeCommercialName: `Step ${stepNo} — ${field.label} is required`,
            name: `Step ${stepNo} — ${field.label} is required`,
          }));
          addToast('error', field.toastMessage);
          setCurrentSection(field.section);
          focusPmField('tradeCommercialName');
          return null;
        }
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
    if (!String(formData.pkgReturnable ?? '').trim()) {
      setErrors((prev) => ({
        ...prev,
        pkgReturnable: 'Step 2 — Returnable Item is required (pick Yes or No)',
      }));
      addToast('error', 'Step 2 — Returnable Item is required (pick Yes or No)');
      setCurrentSection(1);
      focusPmField('pkgReturnable');
      return null;
    }
    const taxValidation = validateMasterTaxDetails(formData as Record<string, unknown>, 'packaging');
    if (!taxValidation.valid) {
      setErrors((prev) => ({ ...prev, ...taxValidation.errors }));
      const firstTaxKey = ['pkgTaxPreference', 'pkgHsn', 'pkgGst'].find((k) => Boolean(taxValidation.errors[k]));
      addToast(
        'error',
        (firstTaxKey && taxValidation.errors[firstTaxKey]) ||
          'Select a Tax Preference and (for Taxable) fill a valid HSN code and GST % (Step 2 — Units & Taxes).'
      );
      setCurrentSection(1);
      if (firstTaxKey) focusPmField(firstTaxKey);
      return null;
    }
    return buildPayload();
  };

  const handleSubmit = async () => {
    const payload = validatePmForSubmit();
    if (!payload) return;

    let intentStatus = readSavedMasterApprovalStatus({ status: formData.masterApprovalStatus });
    if (existingPmId) {
      const fresh = await fetchPackMaterialById(existingPmId);
      if (fresh) {
        intentStatus = readSavedMasterApprovalStatus({
          status: fresh.status,
          formData:
            fresh.form_data && typeof fresh.form_data === 'object'
              ? (fresh.form_data as Record<string, unknown>)
              : null,
        });
        setFormData((prev) => ({
          ...prev,
          masterApprovalStatus: intentStatus,
          status: intentStatus,
        }));
        setEditApprovalStageAssignees(normalizeStageAssignees(fresh.approvalStageAssignees));
        const priceRow = await fetchPriceListRowForMaterial('PM', parseInt(String(existingPmId), 10));
        setSubmitPreviewBaseline(buildPmPreviewBaselineFromFetch(fresh, priceRow));
      } else {
        setSubmitPreviewBaseline(null);
      }
    } else {
      setSubmitPreviewBaseline(null);
    }

    if (!getMasterApprovalSubmitAction(intentStatus)) {
      addToast('info', 'This record is already at the final approval status.');
      return;
    }

    setPendingApprovalIntentStatus(intentStatus);
    setPendingPmPayload(
      withMasterDraftApprovalStatus(
        payload as Record<string, unknown>,
        intentStatus
      ) as CreatePackMaterialPayload
    );
    setSubmitPreviewOpen(true);
  };

  const handleRevert = () => {
    if (!existingPmId) {
      addToast('error', 'Save a draft first before sending the form back to a previous status.');
      return;
    }
    setRevertPreviewOpen(true);
  };

  const closeSaveSuccessAndExit = () => {
    setSaveSuccessOpen(false);
    setSaveSuccessCode('');
    setSaveSuccessRows([]);
    setExistingPmId(null);
    resetPmFormToEmpty();
    setPageTab('bpr');
  };

  const handleConfirmSubmit = async (comment: string) => {
    const payload = pendingPmPayload;
    if (!payload) return;
    setSubmitConfirming(true);
    try {
      let recordId = existingPmId;
      let savedCode = '';
      let savedDescription = '';
      let savedGroup = '';
      let savedLevel = '';
      let syncCreated = 0;
      let isEdit = false;

      if (existingPmId) {
        const pmIdForSync = parseInt(String(existingPmId), 10);
        const saved = await updatePackMaterial(existingPmId, payload);
        syncCreated = Number.isNaN(pmIdForSync) ? 0 : await syncPmVendorsToItemsListAfterSave(pmIdForSync);
        isEdit = true;
        savedCode = saved.code || formData.itemCode || '';
        savedDescription = saved.description || formData.name || '';
        savedGroup = saved.group || formData.pmSkuCategory || '';
        savedLevel = saved.level || formData.level || '';
      } else {
        const saved = await createPackMaterial({ ...payload });
        recordId = String(saved.id);
        setExistingPmId(recordId);
        const newPmId = parseInt(String(saved.id), 10);
        syncCreated = Number.isNaN(newPmId) ? 0 : await syncPmVendorsToItemsListAfterSave(newPmId);
        savedCode = saved.code || '';
        savedDescription = saved.description || formData.name || '';
        savedGroup = saved.group || formData.pmSkuCategory || '';
        savedLevel = saved.level || formData.level || '';
      }

      const freshAfterSave = recordId ? await fetchPackMaterialById(recordId) : null;
      if (freshAfterSave) {
        setEditApprovalStageAssignees(normalizeStageAssignees(freshAfterSave.approvalStageAssignees));
      }

      let approvalStatus: string = freshAfterSave
        ? readSavedMasterApprovalStatus({
            status: freshAfterSave.status,
            formData:
              freshAfterSave.form_data && typeof freshAfterSave.form_data === 'object'
                ? (freshAfterSave.form_data as Record<string, unknown>)
                : null,
          })
        : readSavedMasterApprovalStatus({ status: formData.masterApprovalStatus });
      const assigneesForAdvance =
        freshAfterSave?.approvalStageAssignees != null
          ? normalizeStageAssignees(freshAfterSave.approvalStageAssignees)
          : editApprovalStageAssignees;
      const intentStatus =
        pendingApprovalIntentStatus ??
        readSavedMasterApprovalStatus({ status: formData.masterApprovalStatus });
      const advancedResult = await advanceMasterApprovalAfterSave({
        kind: 'PM',
        itemId: recordId!,
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
        setFormData((prev) => ({
          ...prev,
          masterApprovalStatus: advancedResult.status,
          status: advancedResult.status,
        }));
      } else if (getMasterApprovalSubmitAction(intentStatus)) {
        addToast('error', 'Approval status did not change. Please refresh and try again.');
        return;
      }

      setSaveSuccessIsEdit(isEdit);
      setSaveSuccessCode(savedCode);
      setSaveSuccessRows([
        { label: 'Item name', value: savedDescription },
        { label: 'Category', value: savedGroup },
        { label: 'Level', value: savedLevel },
        { label: 'Approval status', value: approvalStatus },
        ...(syncCreated > 0
          ? [{ label: 'Items List', value: `${syncCreated} vendor rate(s) synced` }]
          : []),
      ]);
      localStorage.removeItem('packaging_draft_new');
      queryClient.invalidateQueries({ queryKey: ['pack-materials-full-list'] });
      setMasterRefreshKey((k) => k + 1);
      setSubmitPreviewOpen(false);
      setPendingPmPayload(null);
      setPendingApprovalIntentStatus(null);
      setSaveSuccessOpen(true);
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to save pack material');
    } finally {
      setSubmitConfirming(false);
    }
  };

  const handleConfirmRevert = async (comment: string) => {
    if (!existingPmId) return;
    setSubmitConfirming(true);
    try {
      const payload = validatePmForDraft();
      if (!payload) return;
      const savePayload = withMasterDraftApprovalStatus(
        payload as Record<string, unknown>,
        formData.masterApprovalStatus
      ) as CreatePackMaterialPayload;
      await updatePackMaterial(existingPmId, savePayload);
      const freshAfterSave = await fetchPackMaterialById(existingPmId);
      const assigneesForRevert = freshAfterSave?.approvalStageAssignees != null
        ? normalizeStageAssignees(freshAfterSave.approvalStageAssignees)
        : editApprovalStageAssignees;
      if (!canApproveAtStatus(formData.masterApprovalStatus, assigneesForRevert)) {
        addToast(
          'error',
          'Only the person assigned to this approval stage can send the form back. Assign them in the list, then try again.'
        );
        return;
      }

      const reverted = await revertMasterApprovalStatus('PM', existingPmId, comment);
      if (reverted.ok === false) {
        addToast('error', reverted.error);
        return;
      }

      setFormData((prev) => ({
        ...prev,
        masterApprovalStatus: reverted.status,
        status: reverted.status,
      }));
      setPmReloadToken((t) => t + 1);
      queryClient.invalidateQueries({ queryKey: ['pack-materials-full-list'] });
      setMasterRefreshKey((k) => k + 1);
      setRevertPreviewOpen(false);
      addToast('success', `Status moved back to ${reverted.status}`);
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Failed to revert approval status');
    } finally {
      setSubmitConfirming(false);
    }
  };

  const pmFieldContext = useMemo<PmMasterFieldContext>(
    () => ({
      pmSkuCategory: formData.pmSkuCategory || formData.subCategory,
      optionalPmSubCategory: formData.optionalPmSubCategory,
      optionalPmSubSubCategory: formData.optionalPmSubSubCategory,
    }),
    [
      formData.pmSkuCategory,
      formData.subCategory,
      formData.optionalPmSubCategory,
      formData.optionalPmSubSubCategory,
    ]
  );
  const pmCondContext = useMemo(() => buildPmMasterFieldContext(pmFieldContext), [pmFieldContext]);
  const pmCustomFieldsTaxonomyKey = useMemo(
    () => buildMasterCustomFieldsTaxonomyKey(pmCondContext.cat, pmCondContext.sub, pmCondContext.subsub),
    [pmCondContext]
  );
  const pmCustomFieldsTaxonomyLabel = useMemo(() => {
    const parts = [pmCondContext.cat, pmCondContext.sub, pmCondContext.subsub].filter(Boolean);
    return parts.length > 0 ? parts.join(' → ') : 'PM master';
  }, [pmCondContext]);

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

  // ── Section Content ──────────────────────────────────────────────────────────
  const renderSection = () => (
    <PmMasterSectionContent
      sectionIndex={currentSection}
      moduleSlug={PM_MASTER_MODULE_ORDER[currentSection]?.slug ?? 'primary'}
      fieldContext={pmFieldContext}
      formData={formData}
      errors={errors}
      onChange={handleInputChange}
      isNewPm={isNewPm}
      pmUsesFunctionalTaxonomy={pmUsesFunctionalTaxonomy}
      pmDetailSubCategoryRequired={pmDetailSubCategoryRequired}
      pmSubSubCategoryRequired={pmSubSubCategoryRequired}
      pmFunctionalCategoryLabel={pmFunctionalCategoryLabel}
      pmFunctionalSubCategoryLabel={pmFunctionalSubCategoryLabel}
      pmDetailSubCategoryOptions={pmDetailSubCategoryOptions}
      pmSubSubCategoryOptions={pmSubSubCategoryOptions}
      pmSkuCategorySelectOptions={[...PM_SKU_CATEGORY_SELECT_OPTIONS]}
      pmSkuCategoryOptions={PM_SKU_CATEGORY_OPTIONS}
      pmLinkedProductCodes={pmLinkedProductCodes}
      taxIsTaxable={taxIsTaxable}
      showPmQualitySpecTable={showPmQualitySpecTable}
      canEditPmQualityCategory={canEditPmQualityCategory}
      showPmQualitySubSpecTable={showPmQualitySubSpecTable}
      pmQualitySpecResolved={pmQualitySpecResolved}
      currentPmSubSpecRows={currentPmSubSpecRows}
      onPmQualitySpecRowsChange={handlePmQualitySpecRowsChange}
      onPmQualitySubSpecRowsChange={handlePmQualitySubSpecRowsChange}
      customFieldsTaxonomyLabel={pmCustomFieldsTaxonomyLabel}
      onTradeCommercialNameChange={(value) => {
        setFormData((prev) => ({ ...prev, tradeCommercialName: value, name: value }));
        setErrors((prev) => {
          if (!prev.tradeCommercialName && !prev.name) return prev;
          const next = { ...prev };
          delete next.tradeCommercialName;
          delete next.name;
          return next;
        });
      }}
      vendorClientList={vendorClientList}
      tempVendor={tempVendor}
      tempVendorTiers={tempVendorTiers}
      onPmVendorTempFieldChange={handlePmVendorTempFieldChange}
      onTempVendorTierChange={handleTempVendorTierChange}
      onAddTempVendorTierRow={handleAddTempVendorTierRow}
      onAddVendor={handleAddVendor}
      onRemoveVendor={handleRemoveVendor}
      onVendorsChange={handleVendorsChange}
      InputField={InputField}
      SelectField={SelectField}
      TextareaField={TextareaField}
      onRemoveCustomFieldValue={handleRemoveCustomFieldValue}
    />
  );

  // Load existing PM when editing — show loading until data is in, then fill form
  useEffect(() => {
    if (masterDeepLinkAppliedRef.current || !pmDeepLinkCode) return;
    masterDeepLinkAppliedRef.current = true;
    void (async () => {
      try {
        const list = await fetchPackMaterialsList(pmDeepLinkCode);
        const match = list.find((p) => String(p.code).trim() === pmDeepLinkCode);
        if (!match) return;
        if (stepDeepLink === 'quality') pendingQualityStageRef.current = true;
        setEditApprovalStageAssignees(normalizeStageAssignees(match.approvalStageAssignees));
        setExistingPmId(match.id);
        setPageTab('form');
        setSearchParams((prev) => {
          const p = new URLSearchParams(prev);
          p.delete('pm');
          p.delete('step');
          return p;
        }, { replace: true });
      } catch {
        // ignore deep-link lookup failures
      }
    })();
  }, [pmDeepLinkCode, stepDeepLink, setSearchParams]);

  useEffect(() => {
    if (pageTab !== 'form' || !existingPmId) return;
    if (pendingQualityStageRef.current) {
      pendingQualityStageRef.current = false;
      setCurrentSection(resolveMasterQualityStageIndex('PM'));
    } else {
      setCurrentSection(0);
    }
    let cancelled = false;
    setEditPmLoading(true);
    fetchPackMaterialById(existingPmId).then(async (pm) => {
      if (cancelled) return;
      if (!pm) {
        setEditPmLoading(false);
        return;
      }
      setEditApprovalStageAssignees(normalizeStageAssignees(pm.approvalStageAssignees));
      const priceRow = await fetchPriceListRowForMaterial('PM', parseInt(String(existingPmId), 10));
      if (cancelled) return;
      setEditPmLoading(false);
      const fdObj = safeParseMaybeJsonObject(pm.form_data);
      mergeEntityCustomDropdownOptions(
        'PM',
        (fdObj as Record<string, unknown> | null)?.masterCustomDropdownOptions as
          | Record<string, string[]>
          | undefined
      );
      mergeEntityCustomFields(
        'PM',
        (fdObj as Record<string, unknown> | null)?.masterCustomFields as
          | Record<string, Partial<Record<'TECH' | 'QUAL' | 'ART', MasterCustomFieldDef[]>>>
          | undefined
      );
      const sharedRoot = (fdObj as Record<string, unknown> | null)?.masterSharedQualitySpecs as
        | { PM?: import('../lib/masterSharedQualitySpecs').MasterSharedQualitySpecsEntityStore }
        | undefined;
      if (sharedRoot?.PM) {
        mergeEntitySharedQualitySpecs('PM', sharedRoot.PM);
      }
      const fdNormalizedRaw: any = fdObj ?? null;
      const resolvedPmCats = resolvePmEditCategories({
        code: pm.code,
        group: pm.group,
        material: pm.material,
        form_data: fdObj,
      });

      const skuCatResolved =
        normalizePmSkuCategoryForSelect(String((fdObj as any)?.pmSkuCategory || '')) ||
        normalizePmSkuCategoryForSelect(resolvedPmCats.subCategory) ||
        normalizePmSkuCategoryForSelect(pm.group || '') ||
        normalizePmSkuCategoryForSelect(pm.material || '') ||
        '';

      const fdTrade = String(
        (fdObj as { tradeCommercialName?: string })?.tradeCommercialName ?? ''
      ).trim();
      const tradeName = fdTrade || String(pm.description ?? '').trim();
      const fdStatus = String((fdObj as { masterApprovalStatus?: string; status?: string })?.masterApprovalStatus
        ?? (fdObj as { status?: string })?.status
        ?? pm.status
        ?? '').trim();
      const fdLifecycle = String((fdObj as { pmLifecycleStatus?: string }).pmLifecycleStatus ?? '').trim();
      const baseFromRecord = {
        itemCode: pm.code,
        tradeCommercialName: tradeName,
        name: tradeName,
        masterApprovalStatus: normalizeMasterApprovalStatus(fdStatus || undefined, 'Draft'),
        status: normalizeMasterApprovalStatus(fdStatus || undefined, 'Draft'),
        pmLifecycleStatus: normalizePmLifecycleStatus(fdLifecycle || 'Active'),
        pmClientScope: String((fdObj as { pmClientScope?: string }).pmClientScope ?? '').trim(),
        pmOwner: String((fdObj as { pmOwner?: string }).pmOwner ?? '').trim(),
        intendedUse: String((fdObj as { intendedUse?: string }).intendedUse ?? '').trim(),
        reusability: String((fdObj as { reusability?: string }).reusability ?? '').trim(),
        level: pmLevelForSubCategory(skuCatResolved) || pm.level || '',
        pmSkuCategory: skuCatResolved,
        subCategory: skuCatResolved || resolvedPmCats.subCategory,
        optionalPmSubCategory: resolvedPmCats.optionalPmSubCategory,
        optionalPmSubSubCategory: resolvedPmCats.optionalPmSubSubCategory,
        matBody: normalizePmMaterial(
          String((fdObj as { matBody?: string }).matBody ?? pm.material ?? '').trim()
        ),
        specNominal: pm.sizeSpec || '',
        decorationMethod: pm.printStatus || '',
        zohoId: pm.zohoId ?? '',
        pkgSku: pm.zohoSkuCode ?? '',
        pkgHsn: pm.hsnCode ?? '',
        pkgUnit: pm.unit ?? 'PCS',
        pkgTaxPreference: pm.taxPref ?? '',
        pkgGst: (pm as any).gst != null ? String((pm as any).gst) : '',
        pkgReturnable:
          pm.pkgReturnable === true ? 'Yes' : pm.pkgReturnable === false ? 'No' : ('' as '' | 'Yes' | 'No'),
        pkgAssociateItems: pm.pkgAssociateItems ?? '',
        products: Array.isArray(pm.products) ? pm.products : [],
      };

      const vendorsVal = fdNormalizedRaw ? (fdNormalizedRaw as any).vendors : undefined;
      const testsVal = fdNormalizedRaw ? (fdNormalizedRaw as any).tests : undefined;

      const vendorsNormalized = normalizePmVendors(vendorsVal);
      const vendorsMerged = mergePmVendorsWithPriceList(vendorsNormalized, priceRow);

      const fdNormalized = fdNormalizedRaw
        ? {
          ...(fdNormalizedRaw as typeof formData),
          vendors: vendorsMerged,
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
        if (!String(merged.matBody ?? '').trim() && pm.material) {
          merged.matBody = normalizePmMaterial(pm.material);
        } else if (String(merged.matBody ?? '').trim()) {
          merged.matBody = normalizePmMaterial(merged.matBody);
        }
        merged.optionalPmSubSubCategory =
          normalizePmSubSubCategoryForSelect(
            merged.optionalPmSubCategory,
            merged.optionalPmSubSubCategory ||
              (fdObj as { optionalPmSubSubCategory?: string }).optionalPmSubSubCategory ||
              '',
            merged.pmSkuCategory || merged.subCategory
          ) ||
          merged.optionalPmSubSubCategory ||
          '';
        const pmProducts = Array.isArray(pm.products) ? pm.products : [];
        if (
          (!Array.isArray(merged.products) || merged.products.length === 0) &&
          pmProducts.length > 0
        ) {
          merged.products = pmProducts;
        }

        const rawReturnable: unknown = merged.pkgReturnable;
        if (rawReturnable === true) merged.pkgReturnable = 'Yes';
        else if (rawReturnable === false) merged.pkgReturnable = 'No';
        else if (rawReturnable !== 'Yes' && rawReturnable !== 'No') merged.pkgReturnable = '';
        applyPmCustomizationLegacyFields(merged as Record<string, unknown>);
        applyPmVendorSourcingLegacyFields(merged as Record<string, unknown>);
        applyPmCatalogueLegacyFields(merged as Record<string, unknown>);
        applyPmRegulatoryLegacyFields(merged as Record<string, unknown>);
        applyPmLifecycleLegacyFields(merged as Record<string, unknown>);
        applyPmConditionalLegacyFields(merged as Record<string, unknown>);
        merged.pmQualitySpecRows = hydratePmQualitySpecRows(merged as Record<string, unknown>);
        merged.pmQualitySubSpecRowsByPath = hydratePmQualitySubSpecRowsByPath(
          merged as Record<string, unknown>
        );
        const pmQcCtx = {
          optionalPmSubCategory: String(merged.optionalPmSubCategory ?? ''),
          optionalPmSubSubCategory: String(merged.optionalPmSubSubCategory ?? ''),
          pmSkuCategory: String(merged.pmSkuCategory ?? merged.subCategory ?? ''),
          subCategory: String(merged.subCategory ?? ''),
        };
        const qcDisplay = applyPmQualitySpecTaxonomyDisplay(merged as Record<string, unknown>, pmQcCtx);
        merged.pmQualitySpecRows = qcDisplay.pmQualitySpecRows;
        merged.pmQualitySubSpecRowsByPath = qcDisplay.pmQualitySubSpecRowsByPath;
        return merged;
      });

      setGeneratedCode(pm.code);
    }).catch(() => {
      setEditPmLoading(false);
    });
    return () => { cancelled = true; };
  }, [pageTab, existingPmId, pmReloadToken]);

  const isEditingPm = !!existingPmId;
  const approvalSubmitAction = getMasterApprovalSubmitAction(formData.masterApprovalStatus);
  const approvalRevertAction = getMasterApprovalRevertAction(formData.masterApprovalStatus);
  const canShowApprovalSubmit =
    approvalSubmitAction != null &&
    canApproveAtStatus(formData.masterApprovalStatus, editApprovalStageAssignees);
  const canShowApprovalRevert =
    !!existingPmId &&
    approvalRevertAction != null &&
    canApproveAtStatus(formData.masterApprovalStatus, editApprovalStageAssignees);
  const canShowResetForm = isMasterApprovalDraft(formData.masterApprovalStatus);
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
          refreshKey={masterRefreshKey}
          onSwitchToForm={() => { resetPmFormToEmpty(); setPageTab('form'); }}
          onEditPm={(pm) => {
            setEditApprovalStageAssignees(normalizeStageAssignees(pm.approvalStageAssignees));
            setExistingPmId(pm.id);
            setPageTab('form');
            setCurrentSection(0);
          }}
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
      refreshKey={masterRefreshKey}
      onSwitchToForm={() => { resetPmFormToEmpty(); setPageTab('form'); }}
      onEditPm={(pm) => {
        setEditApprovalStageAssignees(normalizeStageAssignees(pm.approvalStageAssignees));
        setExistingPmId(pm.id);
        setPageTab('form');
        setCurrentSection(0);
      }}
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

          <MasterDropdownOptionsProvider entity="PM">
          <MasterCustomFieldsProvider entity="PM" taxonomyKey={pmCustomFieldsTaxonomyKey}>
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
                    onClick={() => void handleSave()}
                    disabled={draftSaving}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    {draftSaving ? 'Saving…' : 'Save draft'}
                  </button>
                  {canShowResetForm ? (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                    >
                      Reset Form
                    </button>
                  ) : null}
                  {canShowApprovalRevert ? (
                    <button
                      type="button"
                      onClick={handleRevert}
                      className="px-3 py-1.5 border border-amber-200 text-amber-800 text-sm font-medium rounded-lg hover:bg-amber-50 transition"
                    >
                      {approvalRevertAction?.revertLabel ?? 'Send back'}
                    </button>
                  ) : null}
                  {canShowApprovalSubmit ? (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 shadow-sm transition"
                    >
                      {approvalSubmitAction?.submitLabel ?? 'Submit'}
                    </button>
                  ) : null}
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

                  <nav className="flex-1 px-2 py-2 min-h-0 overflow-y-auto pt-2">
                    {SECTIONS.map((section, idx) => {
                      const navLocked = isPmSectionNavLocked(idx);
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
                      { label: 'Vendors', value: formData.vendors.length },
                      { label: 'QC Specs', value: formData.pmQualitySpecRows?.length ?? 0 },
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
                            (isNewPm && currentSection === 0 && !canAdvancePastPrimary) ||
                            (isNewPm && currentSection === 1 && !canAdvancePastUnitsTaxes)
                          }
                          title={
                            isNewPm && currentSection === 0 && !canAdvancePastPrimary
                              ? 'Complete required primary fields (category and PM name).'
                              : isNewPm && currentSection === 1 && !canAdvancePastUnitsTaxes
                                ? 'Complete Units & Taxes (UoM, returnable item, tax preference, and HSN/GST when taxable).'
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
          </MasterCustomFieldsProvider>
          </MasterDropdownOptionsProvider>
        </div>
      </div>
      <MasterSubmitPreviewModal
        isOpen={submitPreviewOpen}
        onClose={() => {
          if (submitConfirming) return;
          setSubmitPreviewOpen(false);
          setSubmitPreviewBaseline(null);
          setPendingPmPayload(null);
          setPendingApprovalIntentStatus(null);
        }}
        onConfirm={handleConfirmSubmit}
        title={isEditingPm ? 'Preview — update packaging material' : 'Preview — new packaging material'}
        subtitle={
          approvalSubmitAction?.previewSubtitle ??
          'Review all values below. Confirm to save and advance approval status.'
        }
        sections={pmPreviewSections}
        confirmLabel={approvalSubmitAction?.confirmLabel ?? 'Confirm & submit'}
        confirming={submitConfirming}
        isEdit={isEditingPm}
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
        title={saveSuccessIsEdit ? 'Packaging material updated' : 'Packaging material created'}
        subtitle={
          saveSuccessIsEdit
            ? 'Changes are saved. Internal code cannot be changed here.'
            : 'Your pack material is saved. Details and the generated internal code are below.'
        }
        generatedCode={saveSuccessCode}
        codeLabel={saveSuccessIsEdit ? 'Internal PM code (SKU)' : 'Generated internal code (SKU)'}
        rows={saveSuccessRows}
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


function getCategoryStyle(category: string): { bg: string; text: string; border: string } {
  if (!category) return CATEGORY_STYLE_PALETTE[CATEGORY_STYLE_PALETTE.length - 1];
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash << 5) - hash + category.charCodeAt(i);
  const index = Math.abs(hash) % CATEGORY_STYLE_PALETTE.length;
  return CATEGORY_STYLE_PALETTE[index];
}

function normalizePmMaterial(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (PM_MATERIAL_OPTIONS.some((o) => o === s)) return s;
  const lower = s.toLowerCase();
  const aliases: Record<string, (typeof PM_MATERIAL_OPTIONS)[number]> = {
    pet: 'PET',
    hdpe: 'HDPE',
    ldpe: 'LDPE',
    pp: 'PP',
    pvc: 'PVC',
    petg: 'PETG',
    glass: 'Glass',
    aluminium: 'Aluminium',
    aluminum: 'Aluminium',
    alluminium: 'Aluminium',
    abl: 'ABL',
    acrylic: 'Acrylic',
    'duplex/sbs': 'Duplex/SBS',
    duplex: 'Duplex/SBS',
    sbs: 'Duplex/SBS',
    fbb: 'FBB',
    kraft: 'Kraft',
    bopp: 'BOPP',
    bopet: 'BOPET',
    corrugated: 'Corrugated',
    wood: 'Wood',
    metal: 'Metal',
    'silica gel': 'Silica gel',
    silica: 'Silica gel',
  };
  return aliases[lower] ?? s;
}

function normalizePmLifecycleStatus(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return 'Active';
  if (PM_LIFECYCLE_STATUS_OPTIONS.some((o) => o === s)) return s;
  if (/^phase[\s-]?out$/i.test(s)) return 'Phase-Out';
  if (/^prefer/i.test(s)) return 'Preferred';
  if (/^condition/i.test(s)) return 'Conditional';
  if (/^discontinu/i.test(s)) return 'Discontinued';
  if (/^inactive$/i.test(s)) return 'Conditional';
  if (/^active$/i.test(s)) return 'Active';
  return s;
}

function pmApprovalStatusLabel(pm: PackMaterialRecord): string {
  if (pm.status?.trim()) {
    return normalizeMasterApprovalStatus(pm.status);
  }
  const fd =
    pm.form_data && typeof pm.form_data === 'object'
      ? (pm.form_data as { masterApprovalStatus?: string; status?: string })
      : null;
  return normalizeMasterApprovalStatus(fd?.masterApprovalStatus ?? fd?.status);
}

function pmSubtitleLine(pm: PackMaterialRecord): string {
  const parts = [pm.material, pm.sizeSpec].map((s) => String(s ?? '').trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(' · ');
  const z = String(pm.zohoSkuCode ?? '').trim();
  return z || '—';
}

/** Category label (PPM / SPM / TPM / …) for masters list table. */
function pmListCategoryLabel(pm: PackMaterialRecord): string {
  return resolvePmEditCategories(pm).subCategory.trim();
}

/** Sub-category label for list stat cards / table (Tubes, Bottles, …). */
function pmListSubCategoryLabel(pm: PackMaterialRecord): string {
  const cats = resolvePmEditCategories(pm);
  const fromForm = cats.optionalPmSubCategory.trim();
  if (fromForm) return fromForm;
  return '';
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

/** Map removed spec fields into new conditional field ids when present in saved form_data. */
function applyPmConditionalLegacyFields(merged: Record<string, unknown>): void {
  const row = merged as Record<string, string | undefined>;
  const copyIfEmpty = (target: string, source: string | undefined): void => {
    if (!String(row[target] ?? '').trim() && source?.trim()) row[target] = source.trim();
  };
  copyIfEmpty('pmOverallHeightMm', row.specHeight);
  copyIfEmpty('pmOuterDiameterMm', row.specDia);
  copyIfEmpty('pmInnerDiameterNeckMm', row.specNeck);
  copyIfEmpty('pmSuitableContainerType', row.secLabelType);
  copyIfEmpty('pmAdhesiveCompatibility', row.secLabelCompat);
  copyIfEmpty('pmGsm', row.secGsm);
  copyIfEmpty('pmLamination', row.secCartonFinish);
  copyIfEmpty('pmPrintingCmykPantones', row.secArtLink);
}

/** Map legacy catalogue visibility into lifecycle & ownership fields (approval status is separate). */
function applyPmLifecycleLegacyFields(merged: Record<string, unknown>): void {
  const row = merged as Record<string, unknown>;
  const legacyStatus = String(row.status ?? '').trim();
  const legacyIsLifecycle = PM_LIFECYCLE_STATUS_OPTIONS.some(
    (o) => o.toLowerCase() === legacyStatus.toLowerCase() || normalizePmLifecycleStatus(legacyStatus) === o
  );
  const lifecycleRaw = row.pmLifecycleStatus ?? (legacyIsLifecycle ? legacyStatus : undefined);
  row.pmLifecycleStatus = normalizePmLifecycleStatus(lifecycleRaw);
  if (!String(row.masterApprovalStatus ?? '').trim()) {
    row.masterApprovalStatus = legacyIsLifecycle
      ? 'Active'
      : normalizeMasterApprovalStatus(row.status, 'Draft');
  }
  row.status = row.masterApprovalStatus;
  if (!String(row.pmClientScope ?? '').trim()) {
    const vis = String(row.catCatalogueVisibility ?? '').trim();
    if (vis === 'Client-locked') row.pmClientScope = 'Client-locked';
    else if (vis === 'Public' || vis === 'Internal') row.pmClientScope = 'Generic';
  }
  if (!String(row.version ?? '').trim()) {
    row.version = 'v1.0';
  }
}

/** Map legacy material flags / regulatory text into the regulatory step fields. */
function applyPmRegulatoryLegacyFields(merged: Record<string, unknown>): void {
  const row = merged as Record<string, unknown>;
  if (!String(row.regBpaPhthalateFree ?? '').trim() && row.matBpa === true) {
    row.regBpaPhthalateFree = 'Declared';
  }
  if (!String(row.regRecyclabilityCode ?? '').trim() && row.matRecycle === true) {
    row.regRecyclabilityCode = 'Recyclable (legacy flag)';
  }
  const regNotes = String(row.regulatory ?? '').trim();
  if (regNotes && !String(row.regEprRegistration ?? '').trim() && /epr/i.test(regNotes)) {
    row.regEprRegistration = regNotes;
  }
}

/** Map legacy catalogue checkboxes / web fields into the current catalogue shape. */
function applyPmCatalogueLegacyFields(merged: Record<string, unknown>): void {
  const row = merged as Record<string, unknown>;
  if (!String(row.catListedInCatalogue ?? '').trim()) {
    if (row.catVisible === true) row.catListedInCatalogue = 'Yes';
    else if (row.catVisible === false) row.catListedInCatalogue = 'No';
  }
  if (!String(row.catCataloguePhoto ?? '').trim()) {
    const webImg = String(row.catWebImages ?? '').trim();
    const webName = String(row.catWebName ?? '').trim();
    if (webImg) row.catCataloguePhoto = webImg;
    else if (webName) row.catCataloguePhoto = webName;
  }
  if (!String(row.catCatalogueCustomNotes ?? '').trim()) {
    const tags = String(row.catTags ?? '').trim();
    const reco = String(row.catRecoTypes ?? '').trim();
    const parts = [tags && `Tags: ${tags}`, reco && `Recommended types: ${reco}`].filter(Boolean);
    if (parts.length) row.catCatalogueCustomNotes = parts.join('\n');
  }
  if (!String(row.catCatalogueVisibility ?? '').trim()) {
    if (row.catShare === true) row.catCatalogueVisibility = 'Client-locked';
    else if (row.catVisible === true) row.catCatalogueVisibility = 'Public';
    else if (row.catVisible === false) row.catCatalogueVisibility = 'Internal';
  }
}

/** Map legacy vendor rows into preferred vendor / supply location when missing. */
function applyPmVendorSourcingLegacyFields(merged: Record<string, unknown>): void {
  const row = merged as Record<string, string | PmCommercialVendor[] | undefined>;
  const vendors = Array.isArray(row.vendors) ? row.vendors : [];
  const first = vendors[0];
  const paymentTerms = first
    ? serializeStagedPaymentTerms({
        advance_pct: Number(first.advancePct) || 0,
        pre_shipment_pct: Number(first.preShipmentPct) || 0,
        post_shipment_pct: Number(first.postShipmentPct) || 0,
        credit_days: Number(first.creditDays) || 0,
      })
    : '';
  const derived = derivePmVendorFieldsFromVendors(vendors, paymentTerms);
  for (const [key, value] of Object.entries(derived)) {
    if (!String(row[key] ?? '').trim() && value.trim()) {
      row[key] = value;
    }
  }
  if (!String(row.pmSupplyLocation ?? '').trim() && first?.location) {
    row.pmSupplyLocation = String(first.location).trim();
  }
  const alt = row.alternateVendor ?? row.alternateVendors;
  if (typeof alt === 'string' && alt.trim() && !String(row.alternateVendor ?? '').trim()) {
    row.alternateVendor = alt.trim();
  }
}

/** Map pre-2026 customization field keys into the current PM form shape. */
function applyPmCustomizationLegacyFields(merged: Record<string, unknown>): void {
  const row = merged as Record<string, string | undefined>;
  if (!String(row.cusCustomisedMoq ?? '').trim() && row.cusCustomMoq) {
    row.cusCustomisedMoq = String(row.cusCustomMoq);
  }
  if (!String(row.cusCustomisationLeadTimeDays ?? '').trim() && row.cusBulkLTCustom) {
    row.cusCustomisationLeadTimeDays = String(row.cusBulkLTCustom);
  }
  if (!String(row.cusSampleLeadTimeDays ?? '').trim() && row.cusSamplingLT) {
    row.cusSampleLeadTimeDays = String(row.cusSamplingLT);
  }
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

type PmListSortColumn = 'code' | 'name' | 'subCategory' | 'uom' | 'category' | 'status' | 'products';

const BprDashboard: React.FC<{
  refreshKey?: number;
  onSwitchToForm: () => void;
  onEditPm: (pm: PackMaterialRecord) => void;
  onDeletePm: (pm: PackMaterialRecord) => void | Promise<void>;
}> = ({ refreshKey = 0, onSwitchToForm, onEditPm, onDeletePm }) => {
  const { canAssignApprover } = useMasterApprovalPermission('PM');
  const [searchParams] = useSearchParams();
  const pmFromQuery = searchParams.get('pm') ?? '';
  const [search, setSearch] = useState(pmFromQuery);
  const [linkedSkusModalPm, setLinkedSkusModalPm] = useState<PackMaterialRecord | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<PmListSortColumn | null>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  /** Stat card filter: null = all, else PM detail sub-category label (Tubes, Bottles, …). */
  const [statFilter, setStatFilter] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<MasterApprovalStatusTab>('all');
  const [statCardSort, setStatCardSort] = useState<MasterStatCardSort>('count-desc');
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const itemRefFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkUploadRunning, setBulkUploadRunning] = useState(false);
  const [resetAllRunning, setResetAllRunning] = useState(false);

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
        const label =
          res.format === 'pm_fill_worksheet'
            ? 'Pack materials (fill workbook)'
            : res.format === 'multi_sheet'
              ? 'Pack materials (multi-sheet)'
              : 'Pack materials (Item Reference)';
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

  const statusCounts = useMemo(
    () => buildMasterApprovalStatusCounts(allRows, (p) => pmApprovalStatusLabel(p)),
    [allRows]
  );

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (statusTab !== 'all') {
      rows = rows.filter((p) => matchesMasterApprovalStatusTab(pmApprovalStatusLabel(p), statusTab));
    }
    if (statFilter) {
      rows = rows.filter((p) => {
        const sub = pmListSubCategoryLabel(p) || 'Unset';
        return sub === statFilter;
      });
    }
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) =>
      [p.code, p.description, p.level, p.group, p.material, p.sizeSpec, p.printStatus, p.zohoSkuCode, p.unit].some((s) =>
        (s ?? '').toLowerCase().includes(q)
      )
    );
  }, [allRows, search, statFilter, statusTab]);

  const togglePmSort = useCallback((column: PmListSortColumn) => {
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
    const cmp = (a: PackMaterialRecord, b: PackMaterialRecord): number => {
      switch (sortColumn) {
        case 'code':
          return compareMasterTableSort(a.code ?? '', b.code ?? '', dir);
        case 'name':
          return compareMasterTableSort(a.description ?? '', b.description ?? '', dir);
        case 'category':
          return compareMasterTableSort(pmListCategoryLabel(a), pmListCategoryLabel(b), dir);
        case 'subCategory':
          return compareMasterTableSort(pmListSubCategoryLabel(a), pmListSubCategoryLabel(b), dir);
        case 'uom':
          return compareMasterTableSort(a.unit ?? 'PCS', b.unit ?? 'PCS', dir);
        case 'status':
          return compareMasterTableSort(pmApprovalStatusLabel(a), pmApprovalStatusLabel(b), dir);
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
    () => buildMasterStatBuckets(allRows, (p) => pmListSubCategoryLabel(p as PackMaterialRecord), statCardSort),
    [allRows, statCardSort]
  );

  const toggleStatFilter = useCallback((id: string | null) => {
    setStatFilter((prev) => (prev === id ? null : id));
    setCurrentPage(1);
  }, []);

  type PmStatCard = {
    id: string | null;
    label: string;
    value: number;
    sub: string;
    accent: string;
    num: string;
    badge?: { bg: string; text: string; border: string };
  };

  const statCards = useMemo((): PmStatCard[] => {
    const fixed: PmStatCard[] = [
      {
        id: null,
        label: 'TOTAL PMS',
        value: allRows.length,
        sub: 'All pack materials',
        accent: 'border-l-violet-500',
        num: 'text-violet-600',
      },
    ];
    const dynamic: PmStatCard[] = categoryBuckets.map((b) => {
      const style = getCategoryStyle(b.label);
      return {
        id: b.label,
        label: b.label,
        value: b.count,
        sub: b.count === 1 ? '1 material in sub-category' : `${b.count} materials`,
        accent: 'border-l-violet-400',
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
          <div className="absolute inset-0 bg-linear-to-r from-violet-500/10 via-transparent to-transparent rounded-2xl blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="text-3xl"></span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">PM Masters</span>
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
            <button type="button" onClick={() => refetch()} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">Retry</button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* ── Stat Cards (dynamic sub-categories — click to filter table) ── */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-gray-500">
                  Click a card to filter the list
                  {statFilter != null ? (
                    <button
                      type="button"
                      onClick={() => toggleStatFilter(null)}
                      className="ml-2 text-violet-700 font-semibold hover:underline"
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
                    className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
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
                      className={`group text-left bg-white rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                        isActive ? 'border-violet-400 ring-2 ring-violet-200' : 'border-gray-100'
                      }`}
                    >
                      <div className={`h-1 bg-linear-to-r from-violet-400 to-violet-600 ${card.accent}`} />
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
              accent="violet"
            />

            {/* ── Table Card (columns aligned with Raw Material masters list) ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">

              {/* toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 bg-linear-to-r from-slate-50/50 to-transparent">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-gray-900">Packaging Material Masters</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200/50">{rows.length} / {totalFiltered}</span>
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
                    title="Multi-tab PM workbook: Primary Packaging, Labels, Monocartons, Shrink Sleeves, Shippers %CFB, Fitments & Misc — row 4 headers, data from row 5 (SKU, Item Name = INCI and trade name, Sub-Category, UOM, HSN, GST%). BOM Name column is ignored. Legacy: sheet Item Reference (cols A–C, row 2+)."
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-200 bg-white text-violet-700 text-xs font-semibold hover:bg-violet-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    {bulkUploadRunning ? 'Uploading…' : 'Item Reference Excel'}
                  </button>
                  <div className="relative group">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-violet-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search PM name, code…"
                      className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all w-52"
                    />
                  </div>
                  <button
                    onClick={onSwitchToForm}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-linear-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white text-xs font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-md"
                  >
                    <span className="text-base leading-none">+</span> New PM
                  </button>
                </div>
              </div>

              {bulkUploadRunning && (
                <div className="px-6 py-3 border-b border-gray-100 bg-violet-50/40">
                  <div className="text-xs text-gray-700 mb-1.5 font-medium">Uploading workbook — server is parsing and importing in chunks…</div>
                  <div className="h-2.5 rounded-full bg-violet-100 overflow-hidden shadow-inner">
                    <div className="h-full w-full rounded-full bg-linear-to-r from-violet-500 to-violet-600 animate-pulse" />
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-linear-to-r from-slate-50/70 to-transparent">
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Sr No</th>
                      <SortableTableTh
                        label="Code"
                        column="code"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={togglePmSort}
                        accent="violet"
                        thClassName="py-4"
                      />
                      <SortableTableTh
                        label="PM Name"
                        column="name"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={togglePmSort}
                        accent="violet"
                        thClassName="py-4"
                      />
                      <SortableTableTh
                        label="Category"
                        column="category"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={togglePmSort}
                        accent="violet"
                        thClassName="py-4"
                      />
                      <SortableTableTh
                        label="Sub-category"
                        column="subCategory"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={togglePmSort}
                        accent="violet"
                        thClassName="py-4"
                      />
                      <SortableTableTh
                        label="UOM"
                        column="uom"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={togglePmSort}
                        accent="violet"
                        thClassName="py-4"
                      />
                      <SortableTableTh
                        label="Status"
                        column="status"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={togglePmSort}
                        accent="violet"
                        thClassName="py-4"
                      />
                      <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Assign</th>
                      <SortableTableTh
                        label="Products"
                        column="products"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={togglePmSort}
                        accent="violet"
                        thClassName="py-4"
                      />
                      <th className="px-4 py-4 text-left font-semibold uppercase tracking-wider text-gray-600">Logs</th>
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
                            No packaging materials match your search.
                          </div>
                        </td>
                      </tr>
                    ) : rows.map((pm, idx) => {
                      const categoryLabel = pmListCategoryLabel(pm);
                      const subCategoryLabel = pmListSubCategoryLabel(pm);
                      const catStyle = getCategoryStyle(categoryLabel || subCategoryLabel);
                      const uom = (pm.unit || 'PCS').trim() || 'PCS';
                      const statusLabel = pmApprovalStatusLabel(pm);
                      return (
                        <tr key={pm.code} className="hover:bg-linear-to-r hover:from-violet-50/50 hover:to-transparent transition-colors group border-b border-gray-50 last:border-0">
                          <td className="px-4 py-3.5 text-[11px] text-gray-500 whitespace-nowrap">{startIndex + idx + 1}</td>
                          <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-violet-700 whitespace-nowrap group-hover:text-violet-900">{pm.code}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <p className="font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">{pm.description}</p>
                            <p className="text-gray-400 text-[10px] mt-0.5 italic">{pmSubtitleLine(pm)}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all group-hover:shadow-sm ${catStyle.bg} ${catStyle.text} ${catStyle.border} whitespace-nowrap`}>
                              {categoryLabel || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-700 font-medium">{subCategoryLabel || '—'}</td>
                          <td className="px-4 py-3.5 text-gray-700 font-semibold">{uom}</td>
                          <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <MasterApprovalStatusCell
                              kind="PM"
                              itemId={pm.id}
                              status={statusLabel}
                            />
                          </td>
                          <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <MasterApprovalAssignCell
                              kind="PM"
                              itemId={pm.id}
                              itemCode={pm.code}
                              stageAssignees={pm.approvalStageAssignees}
                              canAssign={canAssignApprover}
                              onSaved={() => void queryClient.invalidateQueries({ queryKey: ['pack-materials-full-list'] })}
                            />
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
                                className="text-xs font-semibold text-violet-600 hover:text-violet-800 hover:underline focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 rounded"
                              >
                                View SKU ({pm.products.length})
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <MasterApprovalLogsCell
                              kind="PM"
                              itemId={pm.id}
                              itemCode={pm.code}
                              itemLabel={pm.description}
                              currentStatus={statusLabel}
                            />
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onEditPm(pm); }}
                              className="text-[10px] font-semibold text-violet-600 hover:text-violet-800 hover:underline mr-2"
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
                      className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
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
                  className="my-auto w-full max-w-6xl max-h-[calc(100svh-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
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
                    <p className="mb-3 text-xs text-gray-500">
                      When a linked code matches a product in the master list, use Open PR master to view or edit that product.
                    </p>
                    <MasterLinkedPrProductsPanel
                      codes={linkedSkusModalPm.products}
                      accent="violet"
                      variant="table"
                    />
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
const PmFileNameCaptureField: React.FC<{
  label: string;
  id: string;
  value: string;
  accept?: string;
  onFileSelect: (file: File | null) => void;
}> = ({ label, id, value, accept, onFileSelect }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      type="file"
      id={id}
      accept={accept}
      onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
      className="w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
    />
    {value ? <p className="mt-1 text-xs text-gray-600 font-mono break-all">Selected: {value}</p> : null}
  </div>
);

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
  emptyLabel?: string;
}> = ({ label, id, value, onChange, options, disabled, requiredMark, error, emptyLabel = 'Select...' }) => (
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
      <option value="">{emptyLabel}</option>
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
