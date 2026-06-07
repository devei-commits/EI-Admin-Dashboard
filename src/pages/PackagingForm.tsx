import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MasterSubmitPreviewModal } from '../components/masters/MasterSubmitPreviewModal';
import { MasterSaveSuccessModal, type MasterSaveSuccessRow } from '../components/masters/MasterSaveSuccessModal';
import { PM_PREVIEW_SECTIONS } from '../constants/masterSubmitPreviewFields';
import { buildMasterPreviewSections } from '../utils/masterSubmitPreview';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useItems } from '../context/ItemsContext';
import { useToast } from '../context/ToastContext';
import ArrayItemManager from '../components/ArrayItemManager';
import VendorClientNameTypeahead from '../components/VendorClientNameTypeahead';
import VendorCommercialEditor, {
  defaultTempVendorTiers,
  findVendorClientByName,
  type PmCommercialVendor,
  type VendorTierDraft,
} from '../components/VendorCommercialEditor';
import { syncMasterVendorsToPriceList } from '../utils/syncVendorMasterToPriceList';
import { validateStagedPercents } from '../lib/stagedPaymentTerms';
import { fetchPackMaterialsList, fetchPackMaterialById, createPackMaterial, updatePackMaterial, deletePackMaterial, postPackMaterialsMasterExcel, resetAllPackMaterialsMaster, type PackMaterialRecord, type CreatePackMaterialPayload } from '../services/packMaterials.service';
import { fetchPRProducts, type PRProductListItem } from '../services/productsMaster.service';
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
} from '../constants/materialMasterSkuRules';
import { resolvePmEditCategories } from '../utils/masterImportCategoryResolve';
import { getPmConditionalVisibility } from '../lib/pmConditionalFields';
import PmConditionalFieldBlocks from '../components/packaging/PmConditionalFieldBlocks';
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
  { value: 'Single use', label: 'Single use' },
  { value: 'Reusable', label: 'Reusable' },
  { value: 'Refillable', label: 'Refillable' },
] as const;

const PM_DECORATION_OPTIONS = [
  'None',
  'Printed',
  'Hot foil',
  'Cold foil',
  'Metalised',
  'Frosted',
  'Etched',
  'Sticker',
] as const;

const PM_DECORATION_METHOD_OPTIONS = [
  'Silk screen',
  'Pad print',
  'UV print',
  'Offset',
  'Flexo',
  'Gravure',
  'Hot stamp',
] as const;

const PM_SURFACE_FINISH_OPTIONS = ['Gloss', 'Matte', 'Velvet', 'Satin', 'Soft-touch'] as const;

const PM_SURFACE_TEXTURE_OPTIONS = ['Smooth', 'Embossed', 'Debossed', 'Textured'] as const;

const PM_TRANSPARENCY_LEVEL_OPTIONS = ['Transparent', 'Translucent', 'Opaque'] as const;

const PM_VARIANT_STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Discontinued', label: 'Discontinued' },
  { value: 'Sample only', label: 'Sample only' },
] as const;

const PM_TOOLING_OWNERSHIP_OPTIONS = ['EI', 'Vendor', 'Shared'] as const;

const PM_APPLICATION_METHOD_OPTIONS = ['Manual', 'Automatic', 'Both'] as const;

const PM_PRODUCT_ENVIRONMENT_OPTIONS = ['Oil', 'Water', 'Chemical', 'Mixed', 'Dry'] as const;

const PM_COA_REQUIRED_OPTIONS = ['Yes', 'No'] as const;

const PM_DROP_LEAK_TEST_OPTIONS = ['Pass', 'Fail', 'NA'] as const;

const PM_LISTED_IN_CATALOGUE_OPTIONS = ['Yes', 'No', 'Internal Only'] as const;

const PM_CATALOGUE_VISIBILITY_OPTIONS = ['Public', 'Client-locked', 'Internal'] as const;

const PM_MIGRATION_TEST_STATUS_OPTIONS = ['Pass', 'Fail', 'NA'] as const;

const PM_BPA_PHTHALATE_OPTIONS = ['Declared', 'NA'] as const;

const PM_LIFECYCLE_STATUS_OPTIONS = [
  'Active',
  'Preferred',
  'Conditional',
  'Phase-Out',
  'Discontinued',
] as const;

const PM_CLIENT_SCOPE_OPTIONS = ['Generic', 'Client-locked'] as const;

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

type PmVariantRow = {
  id: string;
  name: string;
  moq: number;
  status: string;
  leadTimeDays: number;
  notes: string;
};

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
  { id: 'intendedUse', label: 'Intended use', section: 0, toastMessage: 'Step 1 — Intended use is required' },
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

/** Fresh PM form state when opening a new item or after closing the onboarding overlay. */
function createEmptyPackagingFormData() {
  return {
    itemCode: '',
    status: 'Active',
    version: 'v1.0',
    pmLifecycleStatus: 'Active',
    pmClientScope: '',
    pmOwner: '',
    pmCategory: '',
    pmSkuCategory: '',
    optionalPmSubCategory: '',
    optionalPmSubSubCategory: '',
    qcGroup: 'Packaging QC only',
    subCategory: '',
    storeLoc: '',
    pkgUnitsPerShipperRoll: '',
    zohoId: '',
    pkgSku: '',
    pkgUnit: 'PCS',
    pkgHsn: '',
    pkgGst: '',
    pkgTaxPreference: '',
    pkgReturnable: '' as '' | 'Yes' | 'No',
    pkgAssociateItems: '',
    products: [] as string[],
    inciName: '',
    tradeCommercialName: '',
    name: '',
    level: '',
    itemCategory: '',
    intendedUse: '',
    reusability: '',
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
    decorationMethod: '',
    surfaceEffects: '',
    surfaceTexture: '',
    printCoverage: '',
    numberOfColours: '',
    printColours: '',
    transparencyLevel: '',
    foilColour: '',
    uvFinishing: '',
    embossingDebossing: '',
    premiumLookFeel: '',
    images: '',
    cusApprovedVendorCustom: '',
    cusCustomisedMoq: '',
    cusCustomisationLeadTimeDays: '',
    cusCustomUnitCost: '',
    cusSampleLeadTimeDays: '',
    cusPrintingCylinderCost: '',
    cusPrintingPlateDieCost: '',
    cusToolingCost: '',
    cusToolingOwnership: '',
    cusPaymentTermsCustom: '',
    cusSupplyLocationCustom: '',
    compApplicationMethod: '',
    compProductEnvironment: '',
    compCompatibilityPmSkus: '',
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
    qaArNumber: '',
    qaQcTestPlanRef: '',
    qaCoaRequired: '' as '' | 'Yes' | 'No',
    qaDimensionalChecks: '',
    qaFunctionalChecks: '',
    qaPrintDecorationChecks: '',
    qaDropLeakTest: '',
    qaCoaDocumentRef: '',
    qaInspectionReportRef: '',
    qaSpecFile: '',
    qaSampleImageMock: '',
    apprPack: false,
    apprRd: false,
    apprFin: false,
    apprLock: false,
    catListedInCatalogue: '',
    catCataloguePhoto: '',
    catCatalogueCustomNotes: '',
    catCatalogueVisibility: '',
    regMigrationTestStatus: '',
    regBpaPhthalateFree: '',
    regRecyclabilityCode: '',
    regEprRegistration: '',
    regFoodCosmeticCompliance: '',
    pmAssemblyCode: '',
    pmComponentBreakdown: '',
    pmSkuVolume: '',
    pmShoulderHeightMm: '',
    pmOverallHeightMm: '',
    pmOuterDiameterMm: '',
    pmInnerDiameterNeckMm: '',
    pmCircumferenceMm: '',
    pmOrificeMm: '',
    pmClosureType: '',
    pmPumpCcDosage: '',
    pmPipetteLengthMm: '',
    pmSleeveHeightMm: '',
    pmFillVolumeMl: '',
    pmPackWidthMm: '',
    pmPackHeightMm: '',
    pmOpenClosedSizeMm: '',
    pmSealLaminateWidthMm: '',
    pmCartonLengthMm: '',
    pmCartonWidthMm: '',
    pmCartonHeightMm: '',
    pmBoardPaperType: '',
    pmGsm: '',
    pmMaterialThicknessMicron: '',
    pmLamination: '',
    pmStickerType: '',
    pmPrintingCmykPantones: '',
    pmShoulderColour: '',
    pmCapOvercapColour: '',
    pmActuatorColourStyle: '',
    pmCollarFinish: '',
    pmTeatColour: '',
    pmSuitableContainerType: '',
    pmContainerSurface: '',
    pmAdhesiveCompatibility: '',
    variants: [] as PmVariantRow[],
    preferredVendor: '',
    preferredVendorClientId: '',
    alternateVendor: '',
    alternateVendorClientId: '',
    pmSupplyLocation: '',
    vendors: [] as PmCommercialVendor[],
    tests: [] as Array<{ name: string; result: string; date: string; by: string; remarks: string }>,
  };
}

const SECTIONS = [
  'Primary info',
  'Units & Taxes',
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
  'Regulatory',
  'Lifecycle & Ownership',
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
  const [masterRefreshKey, setMasterRefreshKey] = useState(0);
  const [pmReloadToken, setPmReloadToken] = useState(0);
  const [editPmLoading, setEditPmLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [autoSaveOn, setAutoSaveOn] = useState(true);
  const [lastSaved, setLastSaved] = useState<string>('—');
  const [generatedCode, setGeneratedCode] = useState('');
  const [submitPreviewOpen, setSubmitPreviewOpen] = useState(false);
  const [pendingPmPayload, setPendingPmPayload] = useState<CreatePackMaterialPayload | null>(null);
  const [submitConfirming, setSubmitConfirming] = useState(false);
  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false);
  const [saveSuccessCode, setSaveSuccessCode] = useState('');
  const [saveSuccessRows, setSaveSuccessRows] = useState<MasterSaveSuccessRow[]>([]);
  const [saveSuccessZohoNote, setSaveSuccessZohoNote] = useState<string | null>(null);
  const [saveSuccessIsEdit, setSaveSuccessIsEdit] = useState(false);
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
  const pmSubSubCategoryRequired = pmDetailSubCategoryHasSubSubCategory(formData.optionalPmSubCategory);
  const pmConditionalVisibility = useMemo(
    () =>
      getPmConditionalVisibility({
        pmSkuCategory: formData.pmSkuCategory || formData.subCategory,
        subCategory: formData.subCategory,
        optionalPmSubCategory: formData.optionalPmSubCategory,
      }),
    [formData.pmSkuCategory, formData.subCategory, formData.optionalPmSubCategory]
  );

  const pmSubSubCategoryOptions = useMemo(() => {
    const base = pmSubSubCategoryOptionsForDetailSubCategory(formData.optionalPmSubCategory);
    const cur = String(formData.optionalPmSubSubCategory ?? '').trim();
    if (cur && !base.some((o) => o.value === cur)) {
      return [{ value: cur, label: cur }, ...base];
    }
    return base;
  }, [formData.optionalPmSubCategory, formData.optionalPmSubSubCategory]);
  const canAdvancePastPrimary =
    !isNewPm ||
    Boolean(
      isCanonicalPmSkuCategory(formData.pmSkuCategory || formData.subCategory) &&
        pmLevelForSubCategory(formData.pmSkuCategory || formData.subCategory) &&
        (formData.tradeCommercialName?.trim() || formData.name?.trim()) &&
        formData.intendedUse?.trim()
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

  const [tempVariant, setTempVariant] = useState({
    id: '',
    name: '',
    moq: '',
    status: 'Active',
    leadTimeDays: '',
    notes: '',
  });
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

  const preferredVendorSelectedId = useMemo(() => {
    if (formData.preferredVendorClientId) return formData.preferredVendorClientId;
    const row = findVendorClientByName(vendorClientList, formData.preferredVendor);
    return row?.id ?? '';
  }, [formData.preferredVendorClientId, formData.preferredVendor, vendorClientList]);

  const alternateVendorSelectedId = useMemo(() => {
    if (formData.alternateVendorClientId) return formData.alternateVendorClientId;
    const row = findVendorClientByName(vendorClientList, formData.alternateVendor);
    return row?.id ?? '';
  }, [formData.alternateVendorClientId, formData.alternateVendor, vendorClientList]);

  const alternateVendorDisabledIds = useMemo(() => {
    const ids = new Set<string>();
    if (preferredVendorSelectedId) ids.add(preferredVendorSelectedId);
    return ids;
  }, [preferredVendorSelectedId]);

  const resetPmFormToEmpty = useCallback(() => {
    setFormData(createEmptyPackagingFormData());
    setTempVariant({ id: '', name: '', moq: '', status: 'Active', leadTimeDays: '', notes: '' });
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
  }, []);

  const doSave = (silent = false) => {
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setLastSaved(now);
    if (!silent) addToast('success', 'Draft saved locally (session only)');
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
      setFormData((prev) => ({
        ...prev,
        pmSkuCategory: canon || prev.pmSkuCategory,
        subCategory: canon || prev.subCategory,
        optionalPmSubCategory: normalizePmDetailSubCategoryForSelect(canon, prev.optionalPmSubCategory),
        optionalPmSubSubCategory: '',
        ...(level ? { level } : {}),
      }));
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
      setFormData((prev) => ({
        ...prev,
        optionalPmSubCategory: detail,
        optionalPmSubSubCategory: normalizePmSubSubCategoryForSelect(detail, prev.optionalPmSubSubCategory),
      }));
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
      setErrors((prev) => {
        if (!prev.optionalPmSubSubCategory) return prev;
        const next = { ...prev };
        delete next.optionalPmSubSubCategory;
        return next;
      });
    }
    if (id === 'pmLifecycleStatus') {
      const normalized = normalizePmLifecycleStatus(value);
      setFormData((prev) => ({
        ...prev,
        pmLifecycleStatus: normalized,
        status: normalized,
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

  // Variant ops
  const handleAddVariant = () => {
    const nameTrim = tempVariant.name.trim();
    if (!nameTrim) {
      setErrors((prev) => ({ ...prev, varName: 'Variants Matrix — Variant name is required' }));
      addToast('error', 'Variants Matrix — Variant name is required');
      return;
    }
    const moqNum = tempVariant.moq.trim() ? Number(tempVariant.moq) : 0;
    const leadNum = tempVariant.leadTimeDays.trim() ? Number(tempVariant.leadTimeDays) : 0;
    if (tempVariant.moq.trim() && (Number.isNaN(moqNum) || moqNum < 0)) {
      addToast('error', 'Variants Matrix — Variant MOQ must be a valid number');
      return;
    }
    if (tempVariant.leadTimeDays.trim() && (Number.isNaN(leadNum) || leadNum < 0)) {
      addToast('error', 'Variants Matrix — Lead time must be a valid number of days');
      return;
    }
    const statusVal = PM_VARIANT_STATUS_OPTIONS.some((o) => o.value === tempVariant.status)
      ? tempVariant.status
      : 'Active';
    setFormData((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          id: tempVariant.id.trim() || `V${prev.variants.length + 1}`,
          name: nameTrim,
          moq: moqNum,
          status: statusVal,
          leadTimeDays: leadNum,
          notes: tempVariant.notes.trim(),
        },
      ],
    }));
    setTempVariant({ id: '', name: '', moq: '', status: 'Active', leadTimeDays: '', notes: '' });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.varName;
      return next;
    });
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

  const handlePmFileNameCapture = (
    fieldId: 'qaSpecFile' | 'qaSampleImageMock' | 'catCataloguePhoto',
    file: File | null
  ): void => {
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
      type: formData.itemCategory || undefined,
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
      print_status: formData.deco || undefined,
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
        const {
          pmCategory: _pmCat,
          excelCategory: _excelCat,
          excelSubCategory: _excelSub,
          matBody: _matBody,
          subCategory: _sub,
          pmSkuCategory: _pmSku,
          optionalPmSubCategory: _optSub,
          optionalPmSubSubCategory: _optSubSub,
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
                optionalPmSubSubCategory: formData.optionalPmSubSubCategory?.trim() || undefined,
              }
            : {}),
        };
      })(),
    };
  };

  const pmPreviewSections = useMemo(
    () =>
      buildMasterPreviewSections(formData as Record<string, unknown>, PM_PREVIEW_SECTIONS, {
        omitKeys: isNewPm ? ['itemCode', 'pkgSku'] : undefined,
      }),
    [formData, isNewPm]
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

  const handleSubmit = () => {
    const payload = validatePmForSubmit();
    if (!payload) return;
    setPendingPmPayload(payload);
    setSubmitPreviewOpen(true);
  };

  const closeSaveSuccessAndExit = () => {
    setSaveSuccessOpen(false);
    setSaveSuccessCode('');
    setSaveSuccessRows([]);
    setSaveSuccessZohoNote(null);
    setExistingPmId(null);
    resetPmFormToEmpty();
    setPageTab('bpr');
  };

  const handleConfirmSubmit = async () => {
    const payload = pendingPmPayload;
    if (!payload) return;
    setSubmitConfirming(true);
    try {
      if (existingPmId) {
        const pmIdForSync = parseInt(String(existingPmId), 10);
        const saved = await updatePackMaterial(existingPmId, payload);
        const syncCreated = Number.isNaN(pmIdForSync) ? 0 : await syncPmVendorsToItemsListAfterSave(pmIdForSync);
        setSaveSuccessIsEdit(true);
        setSaveSuccessCode(saved.code || formData.itemCode || '');
        setSaveSuccessRows([
          { label: 'Item name', value: saved.description || formData.name || '' },
          { label: 'Category', value: saved.group || formData.pmSkuCategory || '' },
          { label: 'Level', value: saved.level || formData.level || '' },
          ...(syncCreated > 0
            ? [{ label: 'Items List', value: `${syncCreated} vendor rate(s) synced` }]
            : []),
        ]);
        setSaveSuccessZohoNote(null);
      } else {
        const saved = await createPackMaterial({ ...payload });
        const newPmId = parseInt(String(saved.id), 10);
        const syncCreated = Number.isNaN(newPmId) ? 0 : await syncPmVendorsToItemsListAfterSave(newPmId);
        setSaveSuccessIsEdit(false);
        setSaveSuccessCode(saved.code || '');
        setSaveSuccessRows([
          { label: 'Item name', value: saved.description || formData.name || '' },
          { label: 'Category', value: saved.group || formData.pmSkuCategory || '' },
          { label: 'Level', value: saved.level || formData.level || '' },
          ...(syncCreated > 0
            ? [{ label: 'Items List', value: `${syncCreated} vendor rate(s) synced` }]
            : []),
        ]);
        setSaveSuccessZohoNote(null);
      }
      localStorage.removeItem('packaging_draft_new');
      queryClient.invalidateQueries({ queryKey: ['pack-materials-full-list'] });
      setMasterRefreshKey((k) => k + 1);
      if (existingPmId) {
        setPmReloadToken((t) => t + 1);
      }
      setSubmitPreviewOpen(false);
      setPendingPmPayload(null);
      setSaveSuccessOpen(true);
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
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Category, sub-category &amp; sub-sub category
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SelectField
                  label="Category"
                  id="pmSkuCategory"
                  value={formData.pmSkuCategory}
                  onChange={handleInputChange}
                  options={[...PM_SKU_CATEGORY_SELECT_OPTIONS]}
                  requiredMark
                  error={errors.pmSkuCategory}
                  disabled={false}
                />
                {formData.pmSkuCategory &&
                !PM_SKU_CATEGORY_OPTIONS.includes(formData.pmSkuCategory as (typeof PM_SKU_CATEGORY_OPTIONS)[number]) ? (
                  <p className="text-[10px] text-amber-800 mt-1 col-span-2">
                    Legacy category &quot;{formData.pmSkuCategory}&quot; — pick a PPM / SPM / TPM option to align level and SKU rules.
                  </p>
                ) : null}
                {pmDetailSubCategoryRequired ? (
                  <SelectField
                    label="Sub-category"
                    id="optionalPmSubCategory"
                    value={formData.optionalPmSubCategory}
                    onChange={handleInputChange}
                    options={pmDetailSubCategoryOptions}
                    error={errors.optionalPmSubCategory}
                    disabled={!formData.pmSkuCategory?.trim()}
                    emptyLabel="Select sub-category…"
                  />
                ) : (
                  <InputField
                    label="Sub-category"
                    id="optionalPmSubCategory"
                    value={formData.optionalPmSubCategory}
                    onChange={handleInputChange}
                    placeholder="Select a category first"
                    error={errors.optionalPmSubCategory}
                    readOnly={!formData.pmSkuCategory?.trim()}
                  />
                )}
                {pmSubSubCategoryRequired ? (
                  <SelectField
                    label="Sub-sub category"
                    id="optionalPmSubSubCategory"
                    value={formData.optionalPmSubSubCategory}
                    onChange={handleInputChange}
                    options={pmSubSubCategoryOptions}
                    error={errors.optionalPmSubSubCategory}
                    disabled={!formData.optionalPmSubCategory?.trim()}
                    emptyLabel="Select sub-sub category…"
                  />
                ) : (
                  <InputField
                    label="Sub-sub category"
                    id="optionalPmSubSubCategory"
                    value={formData.optionalPmSubSubCategory}
                    onChange={handleInputChange}
                    placeholder={
                      formData.optionalPmSubCategory?.trim()
                        ? 'No sub-sub options for this sub-category'
                        : 'Select sub-category first'
                    }
                    error={errors.optionalPmSubSubCategory}
                    readOnly
                  />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Category sets the SKU series: PPM <span className="font-mono">4XXXXX</span>, SPM Labels{' '}
                <span className="font-mono">5LXXXXX</span>, Monocartons <span className="font-mono">5MXXXXX</span>, Other Secondary{' '}
                <span className="font-mono">5OXXXXX</span>, TPM Tertiary <span className="font-mono">6TXXXXX</span>, Ancillary{' '}
                <span className="font-mono">6AXXXX</span>. Level is set automatically from category.
              </p>
            </div>

            {!isNewPm ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal PM code (SKU)</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-mono text-gray-800">
                  {formData.itemCode || '—'}
                </div>
              </div>
            ) : null}

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Identity</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="PM Name / description"
                  id="tradeCommercialName"
                  value={formData.tradeCommercialName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData((prev) => ({ ...prev, tradeCommercialName: v, name: v }));
                    setErrors((prev) => {
                      if (!prev.tradeCommercialName && !prev.name) return prev;
                      const next = { ...prev };
                      delete next.tradeCommercialName;
                      delete next.name;
                      return next;
                    });
                  }}
                  placeholder="Packaging item name and short description"
                  requiredMark
                  error={errors.tradeCommercialName ?? errors.name}
                  readOnly={false}
                />
                <InputField
                  label="Intended use"
                  id="intendedUse"
                  value={formData.intendedUse}
                  onChange={handleInputChange}
                  placeholder="e.g. Face serum bottle, outer shipper"
                  requiredMark
                  error={errors.intendedUse}
                />
                <SelectField
                  label="Reusability"
                  id="reusability"
                  value={formData.reusability}
                  onChange={handleInputChange}
                  options={[...PM_REUSABILITY_OPTIONS]}
                  emptyLabel="Select reusability…"
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
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-slate-800 cursor-default"
                    title="Set automatically from category (PPM / SPM / TPM)"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Auto: PPM → Primary, SPM → Secondary, TPM → Tertiary
                  </p>
                </div>
                {!isNewPm ? (
                  <InputField
                    label="Item type (optional)"
                    id="itemCategory"
                    value={formData.itemCategory}
                    onChange={handleInputChange}
                    placeholder="e.g. Bottle, Carton, Label, Shipper"
                    error={errors.itemCategory}
                  />
                ) : null}
              </div>
            </div>

            <PmConditionalFieldBlocks
              section="primary"
              visibility={pmConditionalVisibility}
              formData={formData}
              errors={errors}
              onChange={handleInputChange}
            />
          </div>
        );

      case 1: // Units & Taxes
        return (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Units</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <SelectField
                  label="Primary UoM"
                  id="pkgUnit"
                  value={formData.pkgUnit}
                  onChange={handleInputChange}
                  options={['PCS', 'GM', 'ML', 'L', 'KG']}
                  requiredMark
                  error={errors.pkgUnit}
                />
                <InputField
                  label="Units per shipper / roll"
                  id="pkgUnitsPerShipperRoll"
                  value={formData.pkgUnitsPerShipperRoll}
                  onChange={handleInputChange}
                  placeholder="e.g. 24, 48"
                />
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Tax classification</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  label="Returnable Item"
                  id="pkgReturnable"
                  value={formData.pkgReturnable}
                  onChange={handleInputChange}
                  options={['Yes', 'No']}
                  disabled={false}
                  requiredMark
                  error={errors.pkgReturnable}
                />
                <SelectField
                  label="Tax Preference"
                  id="pkgTaxPreference"
                  value={formData.pkgTaxPreference}
                  onChange={handleInputChange}
                  options={['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST']}
                  requiredMark
                  error={errors.pkgTaxPreference}
                />
                {taxIsTaxable ? (
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
                    <SelectField
                      label="GST %"
                      id="pkgGst"
                      value={formData.pkgGst}
                      onChange={handleInputChange}
                      options={GST_RATE_OPTIONS.map((v) => ({ value: v, label: `${v}%` }))}
                      requiredMark
                      error={errors.pkgGst}
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

      case 2: // Material & Specs
        return (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Zoho Books</h3>
              <p className="text-xs text-gray-500 mb-3">
                {isNewPm
                  ? 'Saved to Esthetic Insights and synced to Zoho Books with your tax preferences (or both roll back if Books fails). The internal code appears in the confirmation dialog after save.'
                  : 'Internal PM code is fixed; Zoho item ID is read-only.'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Zoho Item ID"
                  id="zohoId"
                  value={formData.zohoId ?? ''}
                  onChange={() => {}}
                  placeholder="Populated from the server after save (when Books sync is on)"
                  readOnly
                />
              </div>
              <div className="mt-3">
                <TextareaField
                  label="Associate Items"
                  id="pkgAssociateItems"
                  value={formData.pkgAssociateItems}
                  onChange={handleInputChange}
                  placeholder="Link related BOM / RM / packaging codes if any"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">Zoho Item ID is read-only — returned by the API after a successful save.</p>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">QC, storage & material</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  label="QC testing Group"
                  id="qcGroup"
                  value={formData.qcGroup}
                  onChange={handleInputChange}
                  options={[
                    ...PM_QC_TESTING_GROUP_OPTIONS,
                    ...(formData.qcGroup &&
                    !PM_QC_TESTING_GROUP_OPTIONS.some((o) => o === formData.qcGroup)
                      ? [{ value: formData.qcGroup, label: `${formData.qcGroup} (legacy)` }]
                      : []),
                  ]}
                  emptyLabel="Select QC testing group…"
                />
                <SelectField
                  label="Storage condition"
                  id="storeLoc"
                  value={formData.storeLoc}
                  onChange={handleInputChange}
                  options={STORAGE_TYPES}
                  error={errors.storeLoc}
                  emptyLabel="Select storage condition…"
                />
                <SelectField
                  label="Material"
                  id="matBody"
                  value={formData.matBody}
                  onChange={handleInputChange}
                  options={[
                    ...PM_MATERIAL_OPTIONS,
                    ...(formData.matBody &&
                    !PM_MATERIAL_OPTIONS.some((o) => o === formData.matBody)
                      ? [{ value: formData.matBody, label: `${formData.matBody} (legacy)` }]
                      : []),
                  ]}
                  error={errors.matBody}
                  emptyLabel="Select material…"
                />
              </div>
            </div>
            <PmConditionalFieldBlocks
              section="technical"
              visibility={pmConditionalVisibility}
              formData={formData}
              errors={errors}
              onChange={handleInputChange}
            />
          </div>
        );

      case 3: // Aesthetics
        return (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Color &amp; body</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Body / component color"
                  id="colorType"
                  value={formData.colorType}
                  onChange={handleInputChange}
                  placeholder="e.g. Natural, White, Amber"
                />
                <SelectField
                  label="Transparency level"
                  id="transparencyLevel"
                  value={formData.transparencyLevel}
                  onChange={handleInputChange}
                  options={[...PM_TRANSPARENCY_LEVEL_OPTIONS]}
                  emptyLabel="Select transparency…"
                />
                <InputField
                  label="Colour code (Pantone)"
                  id="colorCode"
                  value={formData.colorCode}
                  onChange={handleInputChange}
                  placeholder="e.g. Pantone 877 C, HEX #FFFFFF"
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Decoration &amp; print</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  label="Decoration"
                  id="deco"
                  value={formData.deco}
                  onChange={handleInputChange}
                  options={[
                    ...PM_DECORATION_OPTIONS,
                    ...(formData.deco && !PM_DECORATION_OPTIONS.some((o) => o === formData.deco)
                      ? [{ value: formData.deco, label: `${formData.deco} (legacy)` }]
                      : []),
                  ]}
                  emptyLabel="Select decoration…"
                />
                <SelectField
                  label="Decoration method"
                  id="decorationMethod"
                  value={formData.decorationMethod}
                  onChange={handleInputChange}
                  options={[
                    ...PM_DECORATION_METHOD_OPTIONS,
                    ...(formData.decorationMethod &&
                    !PM_DECORATION_METHOD_OPTIONS.some((o) => o === formData.decorationMethod)
                      ? [{ value: formData.decorationMethod, label: `${formData.decorationMethod} (legacy)` }]
                      : []),
                  ]}
                  emptyLabel="Select decoration method…"
                />
                <InputField
                  label="Print coverage"
                  id="printCoverage"
                  value={formData.printCoverage}
                  onChange={handleInputChange}
                  placeholder="e.g. 40% panel, full wrap"
                />
                <InputField
                  label="Number of colours"
                  id="numberOfColours"
                  value={formData.numberOfColours}
                  onChange={handleInputChange}
                  placeholder="e.g. 4"
                />
                <InputField
                  label="Print colours"
                  id="printColours"
                  value={formData.printColours}
                  onChange={handleInputChange}
                  placeholder="e.g. CMYK + white, Pantone 185 C"
                />
                <InputField
                  label="Foil colour"
                  id="foilColour"
                  value={formData.foilColour}
                  onChange={handleInputChange}
                  placeholder="e.g. Gold, Silver, Holographic"
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Surface &amp; finish</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  label="Surface finish"
                  id="finish"
                  value={formData.finish}
                  onChange={handleInputChange}
                  options={[
                    ...PM_SURFACE_FINISH_OPTIONS,
                    ...(formData.finish && !PM_SURFACE_FINISH_OPTIONS.some((o) => o === formData.finish)
                      ? [{ value: formData.finish, label: `${formData.finish} (legacy)` }]
                      : []),
                  ]}
                  emptyLabel="Select surface finish…"
                />
                <SelectField
                  label="Surface texture"
                  id="surfaceTexture"
                  value={formData.surfaceTexture}
                  onChange={handleInputChange}
                  options={[...PM_SURFACE_TEXTURE_OPTIONS]}
                  emptyLabel="Select surface texture…"
                />
                <InputField
                  label="Surface effects"
                  id="surfaceEffects"
                  value={formData.surfaceEffects}
                  onChange={handleInputChange}
                  placeholder="e.g. Pearlescent, Gradient, Spot UV"
                />
                <InputField
                  label="UV finishing"
                  id="uvFinishing"
                  value={formData.uvFinishing}
                  onChange={handleInputChange}
                  placeholder="e.g. Spot UV, Full UV coat"
                />
                <InputField
                  label="Embossing / debossing"
                  id="embossingDebossing"
                  value={formData.embossingDebossing}
                  onChange={handleInputChange}
                  placeholder="e.g. Logo emboss, panel deboss"
                />
                <InputField
                  label="Premium look &amp; feel"
                  id="premiumLookFeel"
                  value={formData.premiumLookFeel}
                  onChange={handleInputChange}
                  placeholder="e.g. Luxury matte, Tactile soft-touch"
                />
              </div>
            </div>

            <PmConditionalFieldBlocks
              section="aesthetics"
              visibility={pmConditionalVisibility}
              formData={formData}
              errors={errors}
              onChange={handleInputChange}
            />

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Reference</h3>
              <TextareaField
                label="Reference image / mockup"
                id="images"
                value={formData.images}
                onChange={handleInputChange}
                placeholder="Links or notes for reference artwork, mock-ups, or sample packs"
              />
            </div>
          </div>
        );

      case 4: // Variants Matrix
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
              { key: 'name', label: 'Variant name', required: true },
              { key: 'moq', label: 'Variant MOQ', type: 'number' },
              {
                key: 'status',
                label: 'Variant status',
                type: 'select',
                options: [...PM_VARIANT_STATUS_OPTIONS],
              },
              { key: 'leadTimeDays', label: 'Variant lead time (days)', type: 'number' },
              { key: 'notes', label: 'Variant notes' },
            ]}
          />
        );

      case 5: // Customization & Tooling
        return (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Vendor &amp; MOQ</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Approved vendor (custom)"
                  id="cusApprovedVendorCustom"
                  value={formData.cusApprovedVendorCustom}
                  onChange={handleInputChange}
                  placeholder="Vendor approved for custom runs"
                />
                <InputField
                  label="Customised MOQ"
                  id="cusCustomisedMoq"
                  value={formData.cusCustomisedMoq}
                  onChange={handleInputChange}
                  placeholder="e.g. 5000"
                />
                <InputField
                  label="Customisation lead time (days)"
                  id="cusCustomisationLeadTimeDays"
                  value={formData.cusCustomisationLeadTimeDays}
                  onChange={handleInputChange}
                  placeholder="e.g. 45"
                />
                <InputField
                  label="Custom unit cost"
                  id="cusCustomUnitCost"
                  value={formData.cusCustomUnitCost}
                  onChange={handleInputChange}
                  placeholder="e.g. INR per piece"
                />
                <InputField
                  label="Sample lead time (days)"
                  id="cusSampleLeadTimeDays"
                  value={formData.cusSampleLeadTimeDays}
                  onChange={handleInputChange}
                  placeholder="e.g. 14"
                />
                <InputField
                  label="Supply location (custom)"
                  id="cusSupplyLocationCustom"
                  value={formData.cusSupplyLocationCustom}
                  onChange={handleInputChange}
                  placeholder="e.g. Mumbai, Guangzhou"
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Printing &amp; tooling costs</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Printing cylinder cost"
                  id="cusPrintingCylinderCost"
                  value={formData.cusPrintingCylinderCost}
                  onChange={handleInputChange}
                  placeholder="e.g. INR lump sum"
                />
                <InputField
                  label="Printing plate / die cost"
                  id="cusPrintingPlateDieCost"
                  value={formData.cusPrintingPlateDieCost}
                  onChange={handleInputChange}
                  placeholder="e.g. INR per design"
                />
                <InputField
                  label="Tooling cost"
                  id="cusToolingCost"
                  value={formData.cusToolingCost}
                  onChange={handleInputChange}
                  placeholder="e.g. mould / die cost"
                />
                <SelectField
                  label="Tooling ownership"
                  id="cusToolingOwnership"
                  value={formData.cusToolingOwnership}
                  onChange={handleInputChange}
                  options={[
                    ...PM_TOOLING_OWNERSHIP_OPTIONS,
                    ...(formData.cusToolingOwnership &&
                    !PM_TOOLING_OWNERSHIP_OPTIONS.some((o) => o === formData.cusToolingOwnership)
                      ? [{ value: formData.cusToolingOwnership, label: `${formData.cusToolingOwnership} (legacy)` }]
                      : []),
                  ]}
                  emptyLabel="Select tooling ownership…"
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Commercial (custom)</h3>
              <InputField
                label="Payment terms (custom)"
                id="cusPaymentTermsCustom"
                value={formData.cusPaymentTermsCustom}
                onChange={handleInputChange}
                placeholder="e.g. 30% advance, balance on dispatch"
              />
            </div>
          </div>
        );

      case 6: // Compatibility (R&D / QA)
        return (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Application method"
                id="compApplicationMethod"
                value={formData.compApplicationMethod}
                onChange={handleInputChange}
                options={[
                  ...PM_APPLICATION_METHOD_OPTIONS,
                  ...(formData.compApplicationMethod &&
                  !PM_APPLICATION_METHOD_OPTIONS.some((o) => o === formData.compApplicationMethod)
                    ? [{ value: formData.compApplicationMethod, label: `${formData.compApplicationMethod} (legacy)` }]
                    : []),
                ]}
                emptyLabel="Select application method…"
              />
              <SelectField
                label="Product environment"
                id="compProductEnvironment"
                value={formData.compProductEnvironment}
                onChange={handleInputChange}
                options={[
                  ...PM_PRODUCT_ENVIRONMENT_OPTIONS,
                  ...(formData.compProductEnvironment &&
                  !PM_PRODUCT_ENVIRONMENT_OPTIONS.some((o) => o === formData.compProductEnvironment)
                    ? [{ value: formData.compProductEnvironment, label: `${formData.compProductEnvironment} (legacy)` }]
                    : []),
                ]}
                emptyLabel="Select product environment…"
              />
            </div>
            <InputField
              label="Compatibility PM SKUs"
              id="compCompatibilityPmSkus"
              value={formData.compCompatibilityPmSkus}
              onChange={handleInputChange}
              placeholder="Comma-separated PM codes this item is compatible with"
            />
            <p className="text-xs text-gray-500">
              List related packaging SKUs (e.g. closures, labels) that are validated for use with this PM.
            </p>
            <PmConditionalFieldBlocks
              section="compatibility"
              visibility={pmConditionalVisibility}
              formData={formData}
              errors={errors}
              onChange={handleInputChange}
            />
          </div>
        );

      case 7: // Vendors & Commercial
        return (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Sourcing</h3>
              <p className="text-xs text-gray-500 mb-3">
                Pick preferred and alternate suppliers from vendor master suggestions, then add commercial pricing rows below.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="preferredVendor" className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred vendor
                  </label>
                  <VendorClientNameTypeahead
                    inputId="preferredVendor"
                    parties={vendorClientList}
                    partyKind="vendor"
                    loading={vendorClientsLoading}
                    selectedId={preferredVendorSelectedId}
                    placeholder="Search vendor by name, code, city…"
                    allowFreeText
                    freeTextValue={formData.preferredVendor}
                    onFreeTextChange={(name) => {
                      setFormData((prev) => ({
                        ...prev,
                        preferredVendor: name,
                        preferredVendorClientId:
                          name.trim() === prev.preferredVendor.trim() ? prev.preferredVendorClientId : '',
                      }));
                      if (errors.preferredVendor) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.preferredVendor;
                          return next;
                        });
                      }
                    }}
                    onSelect={(party) => {
                      if (!party) {
                        setFormData((prev) => ({
                          ...prev,
                          preferredVendor: '',
                          preferredVendorClientId: '',
                        }));
                        return;
                      }
                      const loc = [party.city, party.country].filter(Boolean).join(', ').trim();
                      setFormData((prev) => ({
                        ...prev,
                        preferredVendor: party.name?.trim() ?? '',
                        preferredVendorClientId: party.id,
                        pmSupplyLocation: prev.pmSupplyLocation?.trim() || loc || prev.pmSupplyLocation,
                      }));
                      if (errors.preferredVendor) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.preferredVendor;
                          return next;
                        });
                      }
                    }}
                  />
                  {errors.preferredVendor ? (
                    <p className="mt-1 text-xs text-red-600" role="alert">
                      {errors.preferredVendor}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="alternateVendor" className="block text-sm font-medium text-gray-700 mb-1">
                    Alternate vendor
                  </label>
                  <VendorClientNameTypeahead
                    inputId="alternateVendor"
                    parties={vendorClientList}
                    partyKind="vendor"
                    loading={vendorClientsLoading}
                    selectedId={alternateVendorSelectedId}
                    disabledIds={alternateVendorDisabledIds}
                    placeholder="Search alternate vendor…"
                    allowFreeText
                    freeTextValue={formData.alternateVendor}
                    onFreeTextChange={(name) => {
                      setFormData((prev) => ({
                        ...prev,
                        alternateVendor: name,
                        alternateVendorClientId:
                          name.trim() === prev.alternateVendor.trim() ? prev.alternateVendorClientId : '',
                      }));
                    }}
                    onSelect={(party) => {
                      if (!party) {
                        setFormData((prev) => ({
                          ...prev,
                          alternateVendor: '',
                          alternateVendorClientId: '',
                        }));
                        return;
                      }
                      setFormData((prev) => ({
                        ...prev,
                        alternateVendor: party.name?.trim() ?? '',
                        alternateVendorClientId: party.id,
                      }));
                    }}
                  />
                </div>
                <InputField
                  label="Supply location"
                  id="pmSupplyLocation"
                  value={formData.pmSupplyLocation}
                  onChange={handleInputChange}
                  placeholder="e.g. Mumbai, Guangzhou"
                />
              </div>
            </div>

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
          </div>
        );

      case 8: // Secondary Packaging
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

      case 9: // Tertiary Packaging
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

      case 10: // QA Testing & Documents
        return (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">References</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="AR number"
                  id="qaArNumber"
                  value={formData.qaArNumber}
                  onChange={handleInputChange}
                  placeholder="e.g. AR-2026-PM-0042"
                  error={errors.qaArNumber}
                />
                <InputField
                  label="QC test plan reference"
                  id="qaQcTestPlanRef"
                  value={formData.qaQcTestPlanRef}
                  onChange={handleInputChange}
                  placeholder="Plan ID or document link"
                />
                <SelectField
                  label="COA required"
                  id="qaCoaRequired"
                  value={formData.qaCoaRequired}
                  onChange={handleInputChange}
                  options={[...PM_COA_REQUIRED_OPTIONS]}
                  error={errors.qaCoaRequired}
                  emptyLabel="Select…"
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Checks</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Dimensional checks (tolerance)"
                  id="qaDimensionalChecks"
                  value={formData.qaDimensionalChecks}
                  onChange={handleInputChange}
                  placeholder="e.g. Height ±0.5 mm, neck finish 24/410"
                />
                <InputField
                  label="Functional checks (drop / leak / torque / dose)"
                  id="qaFunctionalChecks"
                  value={formData.qaFunctionalChecks}
                  onChange={handleInputChange}
                  placeholder="e.g. Drop 1.2 m, torque 15–20 N·cm"
                />
                <InputField
                  label="Print / decoration checks (ΔE / barcode)"
                  id="qaPrintDecorationChecks"
                  value={formData.qaPrintDecorationChecks}
                  onChange={handleInputChange}
                  placeholder="e.g. ΔE under 2, barcode grade A"
                />
                <SelectField
                  label="Drop / leak test"
                  id="qaDropLeakTest"
                  value={formData.qaDropLeakTest}
                  onChange={handleInputChange}
                  options={[
                    ...PM_DROP_LEAK_TEST_OPTIONS,
                    ...(formData.qaDropLeakTest &&
                    !PM_DROP_LEAK_TEST_OPTIONS.some((o) => o === formData.qaDropLeakTest)
                      ? [{ value: formData.qaDropLeakTest, label: `${formData.qaDropLeakTest} (legacy)` }]
                      : []),
                  ]}
                  emptyLabel="Select result…"
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Documents</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="COA document reference"
                  id="qaCoaDocumentRef"
                  value={formData.qaCoaDocumentRef}
                  onChange={handleInputChange}
                  placeholder="Link or document ID"
                />
                <InputField
                  label="Inspection report reference"
                  id="qaInspectionReportRef"
                  value={formData.qaInspectionReportRef}
                  onChange={handleInputChange}
                  placeholder="Link or report number"
                />
                <PmFileNameCaptureField
                  label="Specification file"
                  id="qaSpecFile"
                  value={formData.qaSpecFile}
                  accept=".pdf,.doc,.docx,.xlsx,.xlsm,image/*"
                  onFileSelect={(file) => handlePmFileNameCapture('qaSpecFile', file)}
                />
                <PmFileNameCaptureField
                  label="Sample image / 3D mock"
                  id="qaSampleImageMock"
                  value={formData.qaSampleImageMock}
                  accept="image/*,.pdf,.glb,.gltf"
                  onFileSelect={(file) => handlePmFileNameCapture('qaSampleImageMock', file)}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                File fields store the selected file name in this draft; attach permanent links in the reference fields above when
                documents are hosted elsewhere.
              </p>
            </div>
          </div>
        );

      case 11: // Catalogue / Website
        return (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Catalogue</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  label="Listed in catalogue"
                  id="catListedInCatalogue"
                  value={formData.catListedInCatalogue}
                  onChange={handleInputChange}
                  options={[
                    ...PM_LISTED_IN_CATALOGUE_OPTIONS,
                    ...(formData.catListedInCatalogue &&
                    !PM_LISTED_IN_CATALOGUE_OPTIONS.some((o) => o === formData.catListedInCatalogue)
                      ? [{ value: formData.catListedInCatalogue, label: `${formData.catListedInCatalogue} (legacy)` }]
                      : []),
                  ]}
                  emptyLabel="Select…"
                />
                <SelectField
                  label="Catalogue visibility"
                  id="catCatalogueVisibility"
                  value={formData.catCatalogueVisibility}
                  onChange={handleInputChange}
                  options={[
                    ...PM_CATALOGUE_VISIBILITY_OPTIONS,
                    ...(formData.catCatalogueVisibility &&
                    !PM_CATALOGUE_VISIBILITY_OPTIONS.some((o) => o === formData.catCatalogueVisibility)
                      ? [{ value: formData.catCatalogueVisibility, label: `${formData.catCatalogueVisibility} (legacy)` }]
                      : []),
                  ]}
                  emptyLabel="Select visibility…"
                />
                <div className="sm:col-span-2">
                  <InputField
                    label="Catalogue photo"
                    id="catCataloguePhoto"
                    value={formData.catCataloguePhoto}
                    onChange={handleInputChange}
                    placeholder="Image URL, asset ID, or file name"
                  />
                  <div className="mt-2">
                    <PmFileNameCaptureField
                      label="Or pick image file"
                      id="catCataloguePhotoPick"
                      value={formData.catCataloguePhoto}
                      accept="image/*"
                      onFileSelect={(file) => handlePmFileNameCapture('catCataloguePhoto', file)}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <TextareaField
                  label="Catalogue custom notes"
                  id="catCatalogueCustomNotes"
                  value={formData.catCatalogueCustomNotes}
                  onChange={handleInputChange}
                  placeholder="Client-facing notes, listing restrictions, or merchandising guidance"
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Approvals</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CheckboxField label="Approved by Packaging" id="apprPack" checked={formData.apprPack} onChange={handleInputChange} />
                <CheckboxField label="Approved by R&D" id="apprRd" checked={formData.apprRd} onChange={handleInputChange} />
                <CheckboxField label="Approved by Finance" id="apprFin" checked={formData.apprFin} onChange={handleInputChange} />
                <CheckboxField label="Lock for Modification" id="apprLock" checked={formData.apprLock} onChange={handleInputChange} />
              </div>
            </div>
          </div>
        );

      case 12: // Regulatory
        return (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Migration test status"
                id="regMigrationTestStatus"
                value={formData.regMigrationTestStatus}
                onChange={handleInputChange}
                options={[
                  ...PM_MIGRATION_TEST_STATUS_OPTIONS,
                  ...(formData.regMigrationTestStatus &&
                  !PM_MIGRATION_TEST_STATUS_OPTIONS.some((o) => o === formData.regMigrationTestStatus)
                    ? [{ value: formData.regMigrationTestStatus, label: `${formData.regMigrationTestStatus} (legacy)` }]
                    : []),
                ]}
                emptyLabel="Select migration test status…"
              />
              <SelectField
                label="BPA free / phthalate free"
                id="regBpaPhthalateFree"
                value={formData.regBpaPhthalateFree}
                onChange={handleInputChange}
                options={[
                  ...PM_BPA_PHTHALATE_OPTIONS,
                  ...(formData.regBpaPhthalateFree &&
                  !PM_BPA_PHTHALATE_OPTIONS.some((o) => o === formData.regBpaPhthalateFree)
                    ? [{ value: formData.regBpaPhthalateFree, label: `${formData.regBpaPhthalateFree} (legacy)` }]
                    : []),
                ]}
                emptyLabel="Select declaration…"
              />
              <InputField
                label="Recyclability code"
                id="regRecyclabilityCode"
                value={formData.regRecyclabilityCode}
                onChange={handleInputChange}
                placeholder="e.g. SPI resin ID, MRF code"
              />
              <InputField
                label="EPR registration"
                id="regEprRegistration"
                value={formData.regEprRegistration}
                onChange={handleInputChange}
                placeholder="EPR / PRO registration number"
              />
            </div>
            <PmConditionalFieldBlocks
              section="regulatory"
              visibility={pmConditionalVisibility}
              formData={formData}
              errors={errors}
              onChange={handleInputChange}
            />
          </div>
        );

      case 13: // Lifecycle & Ownership
        return (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Lifecycle status"
                id="pmLifecycleStatus"
                value={formData.pmLifecycleStatus}
                onChange={handleInputChange}
                options={[
                  ...PM_LIFECYCLE_STATUS_OPTIONS,
                  ...(formData.pmLifecycleStatus &&
                  !PM_LIFECYCLE_STATUS_OPTIONS.some((o) => o === formData.pmLifecycleStatus)
                    ? [{ value: formData.pmLifecycleStatus, label: `${formData.pmLifecycleStatus} (legacy)` }]
                    : []),
                ]}
                emptyLabel="Select lifecycle status…"
              />
              <SelectField
                label="Client specific / generic"
                id="pmClientScope"
                value={formData.pmClientScope}
                onChange={handleInputChange}
                options={[
                  ...PM_CLIENT_SCOPE_OPTIONS,
                  ...(formData.pmClientScope &&
                  !PM_CLIENT_SCOPE_OPTIONS.some((o) => o === formData.pmClientScope)
                    ? [{ value: formData.pmClientScope, label: `${formData.pmClientScope} (legacy)` }]
                    : []),
                ]}
                emptyLabel="Select scope…"
              />
              <InputField
                label="Owner"
                id="pmOwner"
                value={formData.pmOwner}
                onChange={handleInputChange}
                placeholder="e.g. Packaging team, SKU owner name"
              />
              <InputField
                label="Version"
                id="version"
                value={formData.version}
                onChange={handleInputChange}
                placeholder="e.g. v1.0"
              />
            </div>
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

      const fdTrade = String(
        (fdObj as { tradeCommercialName?: string })?.tradeCommercialName ?? ''
      ).trim();
      const tradeName = fdTrade || String(pm.description ?? '').trim();
      const fdStatus = String((fdObj as { status?: string })?.status ?? '').trim();
      const baseFromRecord = {
        itemCode: pm.code,
        tradeCommercialName: tradeName,
        name: tradeName,
        status: fdStatus || 'Active',
        pmLifecycleStatus: normalizePmLifecycleStatus(
          String(
            (fdObj as { pmLifecycleStatus?: string }).pmLifecycleStatus ?? fdStatus ?? 'Active'
          )
        ),
        pmClientScope: String((fdObj as { pmClientScope?: string }).pmClientScope ?? '').trim(),
        pmOwner: String((fdObj as { pmOwner?: string }).pmOwner ?? '').trim(),
        intendedUse: String((fdObj as { intendedUse?: string }).intendedUse ?? '').trim(),
        reusability: String((fdObj as { reusability?: string }).reusability ?? '').trim(),
        itemCategory: pm.type || '',
        level: pmLevelForSubCategory(skuCatResolved) || pm.level || '',
        pmSkuCategory: skuCatResolved,
        subCategory: skuCatResolved || resolvedPmCats.subCategory,
        optionalPmSubCategory: resolvedPmCats.optionalPmSubCategory,
        optionalPmSubSubCategory: resolvedPmCats.optionalPmSubSubCategory,
        matBody: normalizePmMaterial(
          String((fdObj as { matBody?: string }).matBody ?? pm.material ?? '').trim()
        ),
        specNominal: pm.sizeSpec || '',
        deco: pm.printStatus || '',
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
        if (!String(merged.matBody ?? '').trim() && pm.material) {
          merged.matBody = normalizePmMaterial(pm.material);
        } else if (String(merged.matBody ?? '').trim()) {
          merged.matBody = normalizePmMaterial(merged.matBody);
        }
        if (!String(merged.qcGroup ?? '').trim()) {
          merged.qcGroup = 'Packaging QC only';
        }
        merged.optionalPmSubSubCategory =
          normalizePmSubSubCategoryForSelect(
            merged.optionalPmSubCategory,
            merged.optionalPmSubSubCategory ||
              (fdObj as { optionalPmSubSubCategory?: string }).optionalPmSubSubCategory ||
              ''
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
        return merged;
      });

      setGeneratedCode(pm.code);
    }).catch(() => {
      setEditPmLoading(false);
    });
    return () => { cancelled = true; };
  }, [pageTab, existingPmId, pmReloadToken]);

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
          refreshKey={masterRefreshKey}
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
      refreshKey={masterRefreshKey}
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
                      { label: 'Variants', value: formData.variants.length },
                      { label: 'Vendors', value: formData.vendors.length },
                      { label: 'AR #', value: formData.qaArNumber?.trim() || '—' },
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
                              ? 'Complete required primary fields (category, PM name, intended use).'
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
        zohoNote={saveSuccessZohoNote}
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

function pmLifecycleStatusLabel(pm: PackMaterialRecord): string {
  const fd =
    pm.form_data && typeof pm.form_data === 'object'
      ? (pm.form_data as { pmLifecycleStatus?: string; status?: string })
      : null;
  const s = normalizePmLifecycleStatus(fd?.pmLifecycleStatus ?? fd?.status);
  return s || '—';
}

function pmSubtitleLine(pm: PackMaterialRecord): string {
  const parts = [pm.material, pm.sizeSpec].map((s) => String(s ?? '').trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(' · ');
  const z = String(pm.zohoSkuCode ?? '').trim();
  return z || '—';
}

/** Sub-category label for list stat cards / table badge (aligned with RM masters `category`). */
function pmListSubCategoryLabel(pm: PackMaterialRecord): string {
  const cats = resolvePmEditCategories(pm);
  const fromForm = cats.optionalPmSubCategory.trim();
  if (fromForm) return fromForm;
  const fromType = String(pm.type ?? '').trim();
  if (fromType) {
    return normalizePmDetailSubCategoryForSelect(cats.subCategory, fromType) || fromType;
  }
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

/** Map legacy `status` and catalogue visibility into lifecycle & ownership fields. */
function applyPmLifecycleLegacyFields(merged: Record<string, unknown>): void {
  const row = merged as Record<string, unknown>;
  const statusRaw = row.pmLifecycleStatus ?? row.status;
  row.pmLifecycleStatus = normalizePmLifecycleStatus(statusRaw);
  row.status = row.pmLifecycleStatus;
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
  if (!String(row.preferredVendor ?? '').trim() && first?.name) {
    row.preferredVendor = String(first.name).trim();
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

function normalizePmVariantStatus(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (PM_VARIANT_STATUS_OPTIONS.some((o) => o.value === s)) return s;
  if (/^discontinued$/i.test(s)) return 'Discontinued';
  if (/^sample/i.test(s)) return 'Sample only';
  return s || 'Active';
}

function normalizePmVariants(input: unknown): PmVariantRow[] {
  if (!Array.isArray(input)) return [];
  return input.map((row: unknown, idx: number) => {
    const r = row as Record<string, unknown>;
    const legacyVolume = r?.volume ?? r?.varVolume;
    const legacyMold = r?.sameMold ?? r?.varSameMold;
    let name = String(r?.name ?? r?.variantName ?? r?.varName ?? '').trim();
    if (!name && legacyVolume != null && String(legacyVolume).trim() !== '') {
      const vol = String(legacyVolume).trim();
      const mold = String(legacyMold ?? '').trim();
      name = mold ? `Vol ${vol} ml (${mold})` : `Vol ${vol} ml`;
    }
    return {
      id: String(r?.id ?? r?.varId ?? `V${idx + 1}`),
      name,
      moq: Number(r?.moq ?? r?.varMoq ?? 0),
      status: normalizePmVariantStatus(r?.status ?? r?.varStatus),
      leadTimeDays: Number(r?.leadTimeDays ?? r?.leadTime ?? r?.varLeadTime ?? 0),
      notes: String(r?.notes ?? r?.variantNotes ?? r?.varNotes ?? ''),
    };
  });
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

type PmListSortColumn = 'code' | 'name' | 'subCategory' | 'type' | 'uom' | 'category' | 'status' | 'products';

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
  const [sortColumn, setSortColumn] = useState<PmListSortColumn | null>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  /** Stat card filter: null = all, else PM detail sub-category label (Tubes, Bottles, …). */
  const [statFilter, setStatFilter] = useState<string | null>(null);
  const [statCardSort, setStatCardSort] = useState<MasterStatCardSort>('count-desc');
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

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (statFilter) {
      rows = rows.filter((p) => {
        const sub = pmListSubCategoryLabel(p) || 'Unset';
        return sub === statFilter;
      });
    }
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) =>
      [p.code, p.description, p.type, p.level, p.group, p.material, p.sizeSpec, p.printStatus, p.zohoSkuCode, p.unit].some((s) =>
        (s ?? '').toLowerCase().includes(q)
      )
    );
  }, [allRows, search, statFilter]);

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
        case 'subCategory':
        case 'category':
          return compareMasterTableSort(a.type ?? '', b.type ?? '', dir);
        case 'type':
          return compareMasterTableSort(a.level ?? '', b.level ?? '', dir);
        case 'uom':
          return compareMasterTableSort(a.unit ?? 'PCS', b.unit ?? 'PCS', dir);
        case 'status':
          return compareMasterTableSort(pmLifecycleStatusLabel(a), pmLifecycleStatusLabel(b), dir);
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
  }, [search, pageSize, refreshKey, sortColumn, sortDirection, statFilter]);

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
                        label="Sub-category"
                        column="subCategory"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={togglePmSort}
                        accent="violet"
                        thClassName="py-4"
                      />
                      <SortableTableTh
                        label="Type"
                        column="type"
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
                        label="Category"
                        column="category"
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
                      <SortableTableTh
                        label="Products"
                        column="products"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={togglePmSort}
                        accent="violet"
                        thClassName="py-4"
                      />
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
                      const subCategoryLabel = pmListSubCategoryLabel(pm);
                      const catStyle = getCategoryStyle(subCategoryLabel);
                      const uom = (pm.unit || 'PCS').trim() || 'PCS';
                      const statusLabel = pmLifecycleStatusLabel(pm);
                      return (
                        <tr key={pm.code} className="hover:bg-linear-to-r hover:from-violet-50/50 hover:to-transparent transition-colors group border-b border-gray-50 last:border-0">
                          <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-violet-700 whitespace-nowrap group-hover:text-violet-900">{pm.code}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <p className="font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">{pm.description}</p>
                            <p className="text-gray-400 text-[10px] mt-0.5 italic">{pmSubtitleLine(pm)}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all group-hover:shadow-sm ${catStyle.bg} ${catStyle.text} ${catStyle.border} whitespace-nowrap`}>
                              {subCategoryLabel || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-700 font-medium">{pm.level || '—'}</td>
                          <td className="px-4 py-3.5 text-gray-700 font-semibold">{uom}</td>
                          <td className="px-4 py-3.5 text-gray-700 font-medium">{subCategoryLabel || '—'}</td>
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
                                className="text-xs font-semibold text-violet-600 hover:text-violet-800 hover:underline focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 rounded"
                              >
                                View SKU ({pm.products.length})
                              </button>
                            )}
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
                            <tr key={`${sku}-${i}`} className="bg-white hover:bg-violet-50/40">
                              <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                              <td className="px-3 py-2 font-mono font-semibold text-violet-800 break-all">{sku}</td>
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
