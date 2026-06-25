import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Plus, Trash2, Pencil, Check, ArrowUpFromLine } from 'lucide-react';
import MasterFormBase from '../components/MasterFormBase';
import { MasterSubmitPreviewModal } from '../components/masters/MasterSubmitPreviewModal';
import { PR_PREVIEW_SECTIONS } from '../constants/masterSubmitPreviewFields';
import { buildMasterPreviewSections } from '../utils/masterSubmitPreview';
import {
  advanceMasterApprovalAfterSave,
  getMasterApprovalRevertAction,
  getMasterApprovalSubmitAction,
  revertMasterApprovalStatus,
  withMasterDraftApprovalStatus,
} from '../utils/masterSaveSubmit';
import {
  emptyStageAssignees,
  isMasterApprovalDraft,
  normalizeMasterApprovalStatus,
  normalizeStageAssignees,
  readSavedMasterApprovalStatus,
  type MasterApprovalStageAssignees,
} from '../constants/masterApprovalStatus';
import { useMasterApprovalPermission } from '../hooks/useMasterApprovalPermission';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';
import { normalizePrApprovalTeamPending } from '../lib/prMasterTeamApproval';
import {
  canEditPrFormSubsection,
  normalizePrProcessStepKind,
  prQualitySpecSectionEditable,
  resolvePrFormTeamRole,
  type PrFormTeamRole,
  type PrProcessStepKind,
} from '../lib/prFormTeamAccess';
import { PrTeamSectionGate } from '../components/masters/PrTeamSectionGate';
import RmMasterTypeahead from '../components/RmMasterTypeahead';
import PmMasterTypeahead from '../components/PmMasterTypeahead';
import { buildRmTypeaheadOptions, rmTypeaheadLabelForId } from '../lib/rmTypeahead';
import { buildPmTypeaheadOptions, pmTypeaheadLabelForId } from '../lib/pmTypeahead';
import { fetchRawMaterialsForPicker, type RawMaterialRecord } from '../services/rawMaterials.service';
import { fetchPackMaterialsForPicker, type PackMaterialRecord } from '../services/packMaterials.service';
import { fetchItemGroups, type ItemGroupRecord } from '../services/itemGroups.service';
import {
  createPRRegistration,
  fetchPRProductDetail,
  updatePRProduct,
  type PackBomRow,
  type PRProductDetail,
  type PrRecordTypeForm,
} from '../services/productsMaster.service';
import {
  validateSkuBomTotals,
  countMeaningfulFormulaRmLines,
  countMeaningfulPackLines,
  countMeaningfulSkuRmLines,
  getEffectiveSkuBomLimitFields,
  getEffectiveSkuBomLimitForPersist,
  formulaRowsToSkuBomLines,
} from '../lib/skuBomMath';
import { computeSkuBomQtyDisplay, formatSkuBomStdQtyWithUnit } from '../lib/skuBomDisplay';
import { formatQtyWithUnit } from '../utils/formatQty';
import {
  PR_CATEGORY_OPTIONS,
  inferPrCategoryFromLegacyCode,
  normalizePrCategoryForSelect,
  normalizePrSubCategoryForSelect,
  prSubCategoryOptionsForCategory,
  resolvePrCategoryAndSub,
} from '../constants/prMasterCategoryOptions';
import {
  PR_PRODUCT_FORM_OPTIONS,
  isCanonicalPrProductForm,
  normalizePrProductFormForSelect,
} from '../constants/prProductFormOptions';
import {
  PM_SKU_CATEGORY_SELECT_OPTIONS,
  normalizePmDetailSubCategoryForSelect,
  normalizePmSkuCategoryForSelect,
  normalizePmSubSubCategoryForSelect,
  pmDetailSubCategoryHasSubSubCategory,
  pmDetailSubCategoryOptionsForSkuCategory,
  pmLevelForSubCategory,
  pmSubSubCategoryOptionsForDetailSubCategory,
} from '../constants/materialMasterSkuRules';
import { resolvePmEditCategories } from '../utils/masterImportCategoryResolve';
import { PrQualitySpecTable } from '../components/masters/PrQualitySpecTable';
import { PrFacilityLicenceStep } from '../components/masters/PrFacilityLicenceStep';
import type { PrFacilityLicenceRecord } from '../types/prFacilityLicence';
import {
  flattenPrFacilityLicenceRecordsForPayload,
  hydratePrFacilityLicenceRecords,
  seedPrFacilityLicencesIfEmpty,
} from '../lib/prFacilityLicence';
import type { PrQualitySpecSectionKey } from '../constants/prQualitySpecSections';
import type { QualitySpecTableRow } from '../types/qualitySpecTable';
import {
  flattenPrQualityBulkSubSpecRowsByPathForPayload,
  flattenPrQualityDispatchSubSpecRowsByPathForPayload,
  flattenPrQualityFinalSubSpecRowsByPathForPayload,
  flattenPrQualitySpecRowsBySectionForPayload,
  hydrateAndReconcilePrQualitySpecs,
  hydratePrQualityBulkSubSpecRowsByPath,
  hydratePrQualityDispatchSubSpecRowsByPath,
  hydratePrQualityFinalSubSpecRowsByPath,
  hydratePrQualitySpecRowsBySection,
  resolvePrQualitySpecContext,
  seedPrQualitySpecsIfEmpty,
  shouldShowPrBulkSubSpecTable,
  shouldShowPrDispatchSubSpecTable,
  shouldShowPrFinalSubSpecTable,
} from '../lib/prQualitySpecVisibility';
import { MasterCustomFieldsProvider } from '../context/MasterCustomFieldsContext';
import { MasterCustomFieldsBlock } from '../components/masters/MasterCustomFieldsBlock';
import {
  buildMasterCustomFieldsPersistPayload,
  buildMasterCustomFieldsTaxonomyKey,
  mergeEntityCustomFields,
  mergeMasterCustomFieldValuesIntoForm,
  type MasterCustomFieldDef,
  type MasterCustomFieldModuleCode,
} from '../lib/masterCustomFields';

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
    /** Per-RM specific gravity (vs water) — used at Planning BOM confirmation for vessel volume. */
    specificGravity: string;
    /** When set, line is an item group (swap among members at Planning). */
    itemGroupId?: string;
    itemGroupName?: string;
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
    /** PM category slug (ppm, spm-labels, …) — drives sub-category options and pack type level. */
    pmSkuCategory: string;
    /** Finer sub-category (Tubes, Sheet form, …) — same as PM master optionalPmSubCategory. */
    optionalPmSubCategory: string;
    /** Material / construction (PET, Aluminium, …) — same as PM master optionalPmSubSubCategory. */
    optionalPmSubSubCategory: string;
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
    stepKind?: PrProcessStepKind;
  }>;

  // Specs & Regulatory Tab
  specificGravity: string;
  prQualitySpecRowsBySection: Record<PrQualitySpecSectionKey, QualitySpecTableRow[]>;
  prQualityBulkSubSpecRowsByPath: Record<string, QualitySpecTableRow[]>;
  prQualityFinalSubSpecRowsByPath: Record<string, QualitySpecTableRow[]>;
  prQualityDispatchSubSpecRowsByPath: Record<string, QualitySpecTableRow[]>;
  applicableRegulation: string;
  cosmosNaturalCertification: string;
  dermatologicallyTested: string;
  crueltyFreeVegan: string;
  approvedMarketingClaims: string;
  claimsSubstantiation: string;
  prFacilityLicences: PrFacilityLicenceRecord[];
  masterApprovalStatus: string;
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
    specificGravity: '',
    prQualitySpecRowsBySection: hydratePrQualitySpecRowsBySection({}),
    prQualityBulkSubSpecRowsByPath: hydratePrQualityBulkSubSpecRowsByPath({}),
    prQualityFinalSubSpecRowsByPath: hydratePrQualityFinalSubSpecRowsByPath({}),
    prQualityDispatchSubSpecRowsByPath: hydratePrQualityDispatchSubSpecRowsByPath({}),
    applicableRegulation: '',
    cosmosNaturalCertification: '',
    dermatologicallyTested: '',
    crueltyFreeVegan: '',
    approvedMarketingClaims: '',
    claimsSubstantiation: '',
    prFacilityLicences: hydratePrFacilityLicenceRecords([]),
    masterApprovalStatus: 'Draft',
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

function parseFormulaIngredientSg(raw: string): number | null {
  const n = parseFloat(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function bomFormToRmLines(fd: BOMFormState) {
  return fd.formulaIngredients.map((ing) => {
    const sg = parseFormulaIngredientSg(ing.specificGravity);
    const isGroup = ing.itemGroupId != null && String(ing.itemGroupId).trim() !== '';
    return {
      phase: ing.phase,
      inci_name: ing.inciName,
      rm_code: ing.rmCode || '',
      raw_material_id:
        !isGroup && ing.rawMaterialId ? parseInt(ing.rawMaterialId, 10) : undefined,
      pct_w_w: parseFloat(ing.percentWW) || 0,
      uom: 'KG',
      ...(sg != null ? { specific_gravity: sg } : {}),
      ...(isGroup
        ? {
            item_group_id: parseInt(String(ing.itemGroupId), 10),
            item_group_name: ing.itemGroupName ?? ing.inciName,
          }
        : {}),
    };
  });
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
    pm_sku_category: c.pmSkuCategory || undefined,
    pm_sub_category: c.optionalPmSubCategory || undefined,
    optional_pm_sub_category: c.optionalPmSubCategory || undefined,
    pm_sub_sub_category: c.optionalPmSubSubCategory || undefined,
    optional_pm_sub_sub_category: c.optionalPmSubSubCategory || undefined,
    qty_per_unit: parseFloat(c.qtyUnit) || 1,
    uom: c.uom || 'PCS',
  }));
}

function emptyPackComponentDraft(): {
  pmDescription: string;
  pmSkuCategory: string;
  optionalPmSubCategory: string;
  optionalPmSubSubCategory: string;
  type: string;
  qtyUnit: string;
  uom: string;
} {
  return {
    pmDescription: '',
    pmSkuCategory: '',
    optionalPmSubCategory: '',
    optionalPmSubSubCategory: '',
    type: '',
    qtyUnit: '',
    uom: '',
  };
}

function packCategoriesFromPmRecord(pm: PackMaterialRecord): {
  pmSkuCategory: string;
  optionalPmSubCategory: string;
  optionalPmSubSubCategory: string;
  type: string;
} {
  const cats = resolvePmEditCategories({
    code: pm.code,
    group: pm.group,
    material: pm.material,
    form_data: pm.form_data,
  });
  const pmSkuCategory = cats.subCategory;
  const optionalPmSubCategory = cats.optionalPmSubCategory;
  const optionalPmSubSubCategory = cats.optionalPmSubSubCategory;
  const type = pm.level || pmLevelForSubCategory(pmSkuCategory) || '';
  return { pmSkuCategory, optionalPmSubCategory, optionalPmSubSubCategory, type };
}

function bomFormToProcessSteps(fd: BOMFormState) {
  return fd.processSteps.map((s, i) => {
    const stepNum = parseInt(String(s.stepNumber).replace(/\D/g, ''), 10);
    const durNum = parseInt(String(s.duration).replace(/\D/g, ''), 10);
    const stepKind = normalizePrProcessStepKind(s.stepKind);
    return {
      step_number: Number.isNaN(stepNum) ? i + 1 : stepNum,
      description: s.instruction,
      duration_minutes: Number.isNaN(durNum) ? 0 : durNum,
      step_kind: stepKind,
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

function buildPrRegistrationBody(fd: BOMFormState): Record<string, unknown> {
  const prQualitySpecRowsBySection = flattenPrQualitySpecRowsBySectionForPayload(
    fd.prQualitySpecRowsBySection ?? hydratePrQualitySpecRowsBySection({})
  );
  const prQualityBulkSubSpecRowsByPath = flattenPrQualityBulkSubSpecRowsByPathForPayload(
    fd.prQualityBulkSubSpecRowsByPath ?? hydratePrQualityBulkSubSpecRowsByPath({})
  );
  const prQualityFinalSubSpecRowsByPath = flattenPrQualityFinalSubSpecRowsByPathForPayload(
    fd.prQualityFinalSubSpecRowsByPath ?? hydratePrQualityFinalSubSpecRowsByPath({})
  );
  const prQualityDispatchSubSpecRowsByPath = flattenPrQualityDispatchSubSpecRowsByPathForPayload(
    fd.prQualityDispatchSubSpecRowsByPath ?? hydratePrQualityDispatchSubSpecRowsByPath({})
  );
  const pr_facility_licences = flattenPrFacilityLicenceRecordsForPayload(
    fd.prFacilityLicences ?? hydratePrFacilityLicenceRecords([])
  );
  const internalCode = fd.skuCode.trim();
  return {
    product_name: fd.productName.trim(),
    name: fd.productName.trim(),
    pr_record_type: fd.prRecordType === 'temporary' ? 'temporary' : 'permanent',
    ...(internalCode ? { product_code: internalCode, bomCode: internalCode } : {}),
    category: fd.category || null,
    form: fd.productForm || null,
    type: fd.productForm || null,
    client: fd.brandClient || null,
    bom_tax_preference: fd.bomTaxPreference || null,
    bom_returnable: fd.bomReturnable,
    bom_associate_items: fd.bomAssociateItems?.trim() || null,
    bom_composite_item: fd.bomCompositeItem === 'Yes',
    status: fd.masterApprovalStatus || 'Draft',
    lifecycle_status: fd.masterApprovalStatus || 'Draft',
    pr_qc_group: fd.prQcGroup || null,
    pr_sub_category: fd.prSubCategory || null,
    pack_configuration: fd.packConfiguration || null,
    pr_quality_spec_rows_by_section: prQualitySpecRowsBySection,
    pr_quality_bulk_sub_spec_rows_by_path: prQualityBulkSubSpecRowsByPath,
    pr_quality_final_sub_spec_rows_by_path: prQualityFinalSubSpecRowsByPath,
    pr_quality_dispatch_sub_spec_rows_by_path: prQualityDispatchSubSpecRowsByPath,
    pr_facility_licences,
    cosmos_natural_certification: fd.cosmosNaturalCertification || null,
    dermatologically_tested: fd.dermatologicallyTested || null,
    cruelty_free_vegan: fd.crueltyFreeVegan || null,
    storage_conditions: fd.prDefaultStorageType || null,
    mrp: fd.mrp?.trim() || null,
    ...(isValidMrpForPr(fd.mrp) ? { mrp_price: parseMrpNumber(fd.mrp) } : {}),
    rm_lines: bomFormToRmLines(fd),
    sku_rm_lines: bomFormToSkuRmLines(fd),
    ...getEffectiveSkuBomLimitForPersist({
      skuBomLimitQty: fd.skuBomLimitQty,
      skuBomLimitUom: fd.skuBomLimitUom,
    }),
    pm_lines: bomFormToPmLines(fd),
    process_steps: bomFormToProcessSteps(fd),
    specific_gravity: fd.specificGravity.trim() || null,
    approved_claims: fd.approvedMarketingClaims || null,
    regulatory: fd.applicableRegulation || null,
    desc: fd.claimsSubstantiation || null,
    form_data: buildMasterCustomFieldsPersistPayload('PR', fd as unknown as Record<string, unknown>),
  };
}

function buildPrUpdateBody(fd: BOMFormState): Record<string, unknown> {
  const prQualitySpecRowsBySection = flattenPrQualitySpecRowsBySectionForPayload(
    fd.prQualitySpecRowsBySection ?? hydratePrQualitySpecRowsBySection({})
  );
  const prQualityBulkSubSpecRowsByPath = flattenPrQualityBulkSubSpecRowsByPathForPayload(
    fd.prQualityBulkSubSpecRowsByPath ?? hydratePrQualityBulkSubSpecRowsByPath({})
  );
  const prQualityFinalSubSpecRowsByPath = flattenPrQualityFinalSubSpecRowsByPathForPayload(
    fd.prQualityFinalSubSpecRowsByPath ?? hydratePrQualityFinalSubSpecRowsByPath({})
  );
  const prQualityDispatchSubSpecRowsByPath = flattenPrQualityDispatchSubSpecRowsByPathForPayload(
    fd.prQualityDispatchSubSpecRowsByPath ?? hydratePrQualityDispatchSubSpecRowsByPath({})
  );
  const pr_facility_licences = flattenPrFacilityLicenceRecordsForPayload(
    fd.prFacilityLicences ?? hydratePrFacilityLicenceRecords([])
  );
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
    storage_conditions: fd.prDefaultStorageType || null,
    pr_sub_category: fd.prSubCategory || null,
    pr_qc_group: fd.prQcGroup || null,
    brand_client: fd.brandClient || null,
    applicable_regulation: fd.applicableRegulation || null,
    claims_substantiation: fd.claimsSubstantiation || null,
    pack_configuration: fd.packConfiguration || null,
    pr_quality_spec_rows_by_section: prQualitySpecRowsBySection,
    pr_quality_bulk_sub_spec_rows_by_path: prQualityBulkSubSpecRowsByPath,
    pr_quality_final_sub_spec_rows_by_path: prQualityFinalSubSpecRowsByPath,
    pr_quality_dispatch_sub_spec_rows_by_path: prQualityDispatchSubSpecRowsByPath,
    pr_facility_licences,
    cosmos_natural_certification: fd.cosmosNaturalCertification || null,
    dermatologically_tested: fd.dermatologicallyTested || null,
    cruelty_free_vegan: fd.crueltyFreeVegan || null,
    approved_claims: fd.approvedMarketingClaims || null,
    ...(mrp !== undefined ? { mrp_price: mrp } : {}),
    bom: {
      rm_lines: bomFormToRmLines(fd),
      sku_rm_lines: bomFormToSkuRmLines(fd),
      ...getEffectiveSkuBomLimitForPersist({
        skuBomLimitQty: fd.skuBomLimitQty,
        skuBomLimitUom: fd.skuBomLimitUom,
      }),
      pm_lines: bomFormToPmLines(fd),
      process_steps: bomFormToProcessSteps(fd),
      specific_gravity: fd.specificGravity.trim() || null,
      pack_configuration: fd.packConfiguration || null,
      pr_sub_category: fd.prSubCategory || null,
      pr_qc_group: fd.prQcGroup || null,
      pr_quality_spec_rows_by_section: prQualitySpecRowsBySection,
      pr_quality_bulk_sub_spec_rows_by_path: prQualityBulkSubSpecRowsByPath,
      pr_quality_final_sub_spec_rows_by_path: prQualityFinalSubSpecRowsByPath,
      pr_quality_dispatch_sub_spec_rows_by_path: prQualityDispatchSubSpecRowsByPath,
      pr_facility_licences,
      cosmos_natural_certification: fd.cosmosNaturalCertification || null,
      dermatologically_tested: fd.dermatologicallyTested || null,
      cruelty_free_vegan: fd.crueltyFreeVegan || null,
      bom_composite_item: fd.bomCompositeItem === 'Yes',
    },
    form_data: buildMasterCustomFieldsPersistPayload('PR', fd as unknown as Record<string, unknown>),
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
        uom: 'KG',
        specificGravity:
          ing.specific_gravity != null && Number(ing.specific_gravity) > 0
            ? String(ing.specific_gravity)
            : '1',
        ...(ing.item_group_id != null && Number(ing.item_group_id) > 0
          ? {
              itemGroupId: String(ing.item_group_id),
              itemGroupName: ing.item_group_name ?? ing.inci_name,
              rawMaterialId: undefined,
            }
          : {}),
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
  const skuBomLimitQtyStr =
    p.skuBomLimitQty != null && !Number.isNaN(Number(p.skuBomLimitQty))
      ? String(p.skuBomLimitQty)
      : '';
  const skuBomLimitUomStr = p.skuBomLimitUom?.trim() ? String(p.skuBomLimitUom) : 'GM';
  const packingComponents: BOMFormState['packingComponents'] = (p.packBom || []).map((row, i) => {
    const rowExtra = row as PackBomRow & {
      pm_sku_category?: string;
      pm_sub_category?: string;
      /** @deprecated legacy key */
      pm_sub_sub_category?: string;
      optional_pm_sub_category?: string;
      pmSkuCategory?: string;
      optionalPmSubCategory?: string;
    };
    const pmSkuCategory =
      normalizePmSkuCategoryForSelect(
        rowExtra.pm_sku_category || rowExtra.pmSkuCategory || ''
      ) || '';
    const optionalPmSubCategory =
      normalizePmDetailSubCategoryForSelect(
        pmSkuCategory,
        rowExtra.pm_sub_category ||
          rowExtra.pm_sub_sub_category ||
          rowExtra.optional_pm_sub_category ||
          rowExtra.optionalPmSubCategory ||
          ''
      ) ||
      String(
        rowExtra.pm_sub_category ||
          rowExtra.pm_sub_sub_category ||
          rowExtra.optional_pm_sub_category ||
          rowExtra.optionalPmSubCategory ||
          ''
      ).trim();
    const type =
      row.pack_type ||
      (pmSkuCategory ? pmLevelForSubCategory(pmSkuCategory) : '') ||
      '';
    return {
      id: `pc-${i}`,
      packMaterialId:
        rowExtra.pack_material_id != null
          ? String(rowExtra.pack_material_id)
          : row.pm_id != null
            ? String(row.pm_id)
            : undefined,
      pmCode: (row.pm_code as string) || '',
      pmDescription: row.pm_description || '',
      pmSkuCategory,
      optionalPmSubCategory,
      optionalPmSubSubCategory:
        normalizePmSubSubCategoryForSelect(
          optionalPmSubCategory,
          rowExtra.pm_sub_sub_category ||
            rowExtra.optional_pm_sub_sub_category ||
            (rowExtra as { optionalPmSubSubCategory?: string }).optionalPmSubSubCategory ||
            '',
          pmSkuCategory
        ) ||
        String(
          rowExtra.pm_sub_sub_category ||
            rowExtra.optional_pm_sub_sub_category ||
            (rowExtra as { optionalPmSubSubCategory?: string }).optionalPmSubSubCategory ||
            ''
        ).trim(),
      type,
      qtyUnit: String(row.qty_per_unit ?? ''),
      uom: row.uom || 'PCS',
    };
  });
  const processSteps: BOMFormState['processSteps'] = (p.processSteps || []).map((step, i) => ({
    id: `ps-${i}`,
    stepNumber: String(step.step_number ?? ''),
    instruction: step.description || '',
    duration: String(step.duration_minutes ?? ''),
    stepKind: normalizePrProcessStepKind(
      (step as { step_kind?: unknown; stepKind?: unknown }).step_kind ??
        (step as { stepKind?: unknown }).stepKind
    ),
  }));
  const skuCode = p.product_code || '';
  const categoryFromCode = inferPrCategoryFromLegacyCode(skuCode);
  const prSubRaw = (p as unknown as { pr_sub_category?: string | null }).pr_sub_category || '';
  const resolvedCats = resolvePrCategoryAndSub(p.category || categoryFromCode || '', prSubRaw);
  const category =
    resolvedCats.category ||
    normalizePrCategoryForSelect(p.category || '') ||
    categoryFromCode ||
    p.category ||
    '';
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
  const prSubCategory =
    resolvedCats.prSubCategory ||
    normalizePrSubCategoryForSelect(category, prSubRaw) ||
    prSubRaw;
  const base: BOMFormState = {
    ...emptyBomForm(),
    bomCompositeItem,
    productName: p.product_name || '',
    category,
    productForm:
      normalizePrProductFormForSelect(p.form || '') ||
      String(p.form || '').trim(),
    brandClient: p.brand_client || p.brand_name || '',
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
    specificGravity: (p as unknown as { specific_gravity?: string | null }).specific_gravity || '',
    ...(() => {
      const reconciled = hydrateAndReconcilePrQualitySpecs(p as unknown as Record<string, unknown>);
      return {
        prQualitySpecRowsBySection: reconciled.bySection,
        prQualityBulkSubSpecRowsByPath: reconciled.bulkSubByPath,
        prQualityFinalSubSpecRowsByPath: reconciled.finalSubByPath,
        prQualityDispatchSubSpecRowsByPath: reconciled.dispatchSubByPath,
      };
    })(),
    packConfiguration: (p as unknown as { pack_configuration?: string | null }).pack_configuration || '',
    prSubCategory,
    applicableRegulation: (p as unknown as { applicable_regulation?: string | null }).applicable_regulation || '',
    claimsSubstantiation: (p as unknown as { claims_substantiation?: string | null }).claims_substantiation || '',
    cosmosNaturalCertification: (p as unknown as { cosmos_natural_certification?: string | null }).cosmos_natural_certification || '',
    dermatologicallyTested: (p as unknown as { dermatologically_tested?: string | null }).dermatologically_tested || '',
    crueltyFreeVegan: (p as unknown as { cruelty_free_vegan?: string | null }).cruelty_free_vegan || '',
    approvedMarketingClaims: p.approved_claims || '',
    prFacilityLicences: hydratePrFacilityLicenceRecords(
      (p as unknown as { pr_facility_licences?: unknown }).pr_facility_licences
    ),
    masterApprovalStatus: normalizeMasterApprovalStatus(
      (p as unknown as { status?: string; lifecycle_status?: string }).status ??
        (p as unknown as { lifecycle_status?: string }).lifecycle_status,
      'Draft'
    ),
  };
  return mergeMasterCustomFieldValuesIntoForm(
    base,
    (p as { form_data?: Record<string, unknown> | null }).form_data ?? undefined
  );
}

const BOMForm: React.FC<BOMFormProps> = ({ productId: productIdProp, onClose, onSaved }) => {
  const navigate = useNavigate();
  const { id: productIdFromParams } = useParams<{ id: string }>();
  const productIdFromRoute = productIdProp ?? productIdFromParams;
  const [localProductId, setLocalProductId] = useState<string | null>(null);
  const [skipEditProductId, setSkipEditProductId] = useState(false);
  const baseProductId = productIdFromRoute ?? localProductId ?? undefined;
  const effectiveProductId = skipEditProductId ? undefined : baseProductId;
  const { addToast } = useToast();
  const [currentStage, setCurrentStage] = useState(0);
  const [formData, setFormData] = useState<BOMFormState>(emptyBomForm());
  const [editLoading, setEditLoading] = useState(!!effectiveProductId);
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
  const [tempIngredient, setTempIngredient] = useState({
    inciName: '',
    phase: '',
    percentWW: '',
    uom: 'KG',
    specificGravity: '1',
  });
  const [tempSkuLine, setTempSkuLine] = useState({ inciName: '', qtyPerUnit: '', uom: 'GM' });
  const [editingSkuLineId, setEditingSkuLineId] = useState<string | null>(null);
  const [selectedSkuRmId, setSelectedSkuRmId] = useState<string>('');
  const [skuRmQuery, setSkuRmQuery] = useState('');
  const [tempComponent, setTempComponent] = useState(emptyPackComponentDraft);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [tempProductionStep, setTempProductionStep] = useState({ stepNumber: '', instruction: '', duration: '' });
  const [tempPackagingStep, setTempPackagingStep] = useState({ stepNumber: '', instruction: '', duration: '' });
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRecord[]>([]);
  const [packMaterials, setPackMaterials] = useState<PackMaterialRecord[]>([]);
  const [itemGroupsRm, setItemGroupsRm] = useState<ItemGroupRecord[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);
  const [selectedRmId, setSelectedRmId] = useState<string>('');
  const [selectedItemGroupId, setSelectedItemGroupId] = useState<string>('');
  const [formulaLineKind, setFormulaLineKind] = useState<'rm' | 'item_group'>('rm');
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
  const [submitPreviewBaseline, setSubmitPreviewBaseline] = useState<Record<string, unknown> | null>(null);
  const [revertPreviewOpen, setRevertPreviewOpen] = useState(false);
  const [pendingPrSubmit, setPendingPrSubmit] = useState<
    { mode: 'create' | 'update'; body: Record<string, unknown> } | null
  >(null);
  const [pendingApprovalIntentStatus, setPendingApprovalIntentStatus] = useState<string | null>(null);
  const [submitConfirming, setSubmitConfirming] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [editApprovalStageAssignees, setEditApprovalStageAssignees] =
    useState<MasterApprovalStageAssignees>(emptyStageAssignees);
  const [editApprovalTeamPending, setEditApprovalTeamPending] =
    useState<import('../lib/prMasterTeamApproval').PrApprovalTeamPending | null>(null);
  const { canApproveAtStatus } = useMasterApprovalPermission('PR');
  const { isAdmin } = usePermissions();
  const { user } = useAuth();

  const resetPrFormToEmpty = useCallback(() => {
    setFormData(emptyBomForm());
    setTempIngredient({
      inciName: '',
      phase: '',
      percentWW: '',
      uom: 'KG',
      specificGravity: '1',
    });
    setTempSkuLine({ inciName: '', qtyPerUnit: '', uom: 'GM' });
    setEditingSkuLineId(null);
    setSelectedSkuRmId('');
    setSkuRmQuery('');
    setTempComponent(emptyPackComponentDraft());
    setEditingIngredientId(null);
    setEditingComponentId(null);
    setTempProductionStep({ stepNumber: '', instruction: '', duration: '' });
    setTempPackagingStep({ stepNumber: '', instruction: '', duration: '' });
    setSelectedRmId('');
    setSelectedItemGroupId('');
    setFormulaLineKind('rm');
    setSelectedPmId('');
    setIngredientRmQuery('');
    setPackPmQuery('');
    setZohoCompositeFetchId('');
    setErrors({});
    setCurrentStage(0);
    setEditApprovalStageAssignees(emptyStageAssignees());
    setEditApprovalTeamPending(null);
  }, []);

  const handleReset = () => {
    if (!window.confirm('Reset all form data? This cannot be undone.')) return;
    setSkipEditProductId(true);
    setLocalProductId(null);
    resetPrFormToEmpty();
    if (productIdFromParams && !productIdProp) {
      navigate('/bom/new');
    }
    addToast('info', 'Form reset');
  };

  const stages = [
    'Primary info (details)',
    'Formula BOM',
    'SKU BOM (per unit)',
    'Pack BOM',
    'Process Steps',
    'Specs & Regulatory',
    'Quality specifications',
    'Licensing',
  ];

  useEffect(() => {
    setSkipEditProductId(false);
  }, [productIdFromRoute]);

  const isNewProduct = !effectiveProductId;
  const approvalSubmitAction = getMasterApprovalSubmitAction(formData.masterApprovalStatus);
  const approvalRevertAction = getMasterApprovalRevertAction(formData.masterApprovalStatus);
  const canShowApprovalSubmit =
    approvalSubmitAction != null &&
    canApproveAtStatus(formData.masterApprovalStatus, editApprovalStageAssignees, editApprovalTeamPending);
  const canShowApprovalRevert =
    !!effectiveProductId &&
    approvalRevertAction != null &&
    canApproveAtStatus(formData.masterApprovalStatus, editApprovalStageAssignees, editApprovalTeamPending);
  const canShowResetForm = isMasterApprovalDraft(formData.masterApprovalStatus);
  const canAdvancePastPrimary =
    !isNewProduct ||
    Boolean(
      formData.category.trim() &&
        formData.bomCompositeItem &&
        formData.productName.trim()
    );
  const prFormTeamRole: PrFormTeamRole = useMemo(() => {
    const role = resolvePrFormTeamRole(isAdmin, user?.id, editApprovalStageAssignees);
    if (isNewProduct && role === 'unassigned') {
      return isAdmin ? 'admin' : 'both_teams';
    }
    return role;
  }, [isAdmin, user?.id, editApprovalStageAssignees, isNewProduct]);

  const prCanEdit = useCallback(
    (subsection: import('../lib/prFormTeamAccess').PrFormSubsection) =>
      canEditPrFormSubsection(prFormTeamRole, subsection),
    [prFormTeamRole]
  );

  const prSubCategoryOptions = useMemo(() => {
    const base = prSubCategoryOptionsForCategory(formData.category);
    const cur = String(formData.prSubCategory ?? '').trim();
    if (cur && !base.some((o) => o.value === cur)) {
      return [{ value: cur, label: cur }, ...base];
    }
    return base;
  }, [formData.category, formData.prSubCategory]);
  // Existing products normally keep identity/code fields locked.
  // Exception: legacy rows that have no BOM payload loaded (all edit arrays empty)
  // need a bootstrap edit pass to set missing composite/returnable/code metadata.
  const isBomBootstrapEdit =
    !!effectiveProductId &&
    formData.formulaIngredients.length === 0 &&
    formData.skuBomLines.length === 0 &&
    formData.packingComponents.length === 0 &&
    formData.processSteps.length === 0;
  const lockPrimaryFields = !!effectiveProductId && !isBomBootstrapEdit;

  // Load RM/PM masters once so the BOM lines can reference actual items (ids/codes/prices).
  useEffect(() => {
    let cancelled = false;
    setMasterLoading(true);
    Promise.all([fetchRawMaterialsForPicker(), fetchPackMaterialsForPicker(), fetchItemGroups('RM')])
      .then(([rms, pms, groupsRes]) => {
        if (cancelled) return;
        setRawMaterials(rms || []);
        setPackMaterials(pms || []);
        setItemGroupsRm(groupsRes.success && groupsRes.data ? groupsRes.data : []);
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
  const rawMaterialByCode = useMemo(() => {
    const m = new Map<string, RawMaterialRecord>();
    rawMaterials.forEach((r) => {
      const key = String(r.code ?? '').trim().toLowerCase();
      if (key) m.set(key, r);
    });
    return m;
  }, [rawMaterials]);
  const packMaterialById = useMemo(() => {
    const m = new Map<string, PackMaterialRecord>();
    packMaterials.forEach((p) => m.set(String(p.id), p));
    return m;
  }, [packMaterials]);
  const packMaterialByCode = useMemo(() => {
    const m = new Map<string, PackMaterialRecord>();
    packMaterials.forEach((p) => {
      const key = String(p.code ?? '').trim().toLowerCase();
      if (key) m.set(key, p);
    });
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
  const packDraftSubCategoryOptions = useMemo(
    () => pmDetailSubCategoryOptionsForSkuCategory(tempComponent.pmSkuCategory),
    [tempComponent.pmSkuCategory]
  );
  const packDraftSubSubCategoryOptions = useMemo(() => {
    const base = pmSubSubCategoryOptionsForDetailSubCategory(
      tempComponent.optionalPmSubCategory,
      tempComponent.pmSkuCategory
    );
    const cur = String(tempComponent.optionalPmSubSubCategory ?? '').trim();
    if (cur && !base.some((o) => o.value === cur)) {
      return [{ value: cur, label: cur }, ...base];
    }
    return base;
  }, [tempComponent.pmSkuCategory, tempComponent.optionalPmSubCategory, tempComponent.optionalPmSubSubCategory]);

  const ingredientDraftRef = useRef<HTMLDivElement>(null);
  const packDraftRef = useRef<HTMLDivElement>(null);
  const productionStepDraftRef = useRef<HTMLDivElement>(null);
  const packagingStepDraftRef = useRef<HTMLDivElement>(null);

  const getFormulaIngredientSku = useCallback(
    (ing: BOMFormState['formulaIngredients'][number]): string => {
      if (ing.itemGroupId) return ing.rmCode || '';
      const byId = ing.rawMaterialId ? rawMaterialById.get(String(ing.rawMaterialId)) : undefined;
      if (byId?.zohoSkuCode) return String(byId.zohoSkuCode).trim();
      const byCode = ing.rmCode ? rawMaterialByCode.get(String(ing.rmCode).trim().toLowerCase()) : undefined;
      return byCode?.zohoSkuCode ? String(byCode.zohoSkuCode).trim() : ing.rmCode || '';
    },
    [rawMaterialByCode, rawMaterialById]
  );
  const getPackComponentSku = useCallback(
    (comp: BOMFormState['packingComponents'][number]): string => {
      const byId = comp.packMaterialId ? packMaterialById.get(String(comp.packMaterialId)) : undefined;
      if (byId?.zohoSkuCode) return String(byId.zohoSkuCode).trim();
      const byCode = comp.pmCode ? packMaterialByCode.get(String(comp.pmCode).trim().toLowerCase()) : undefined;
      return byCode?.zohoSkuCode ? String(byCode.zohoSkuCode).trim() : '';
    },
    [packMaterialByCode, packMaterialById]
  );

  const formulaPercentTotal = useMemo(() => {
    return formData.formulaIngredients.reduce((sum, ing) => {
      const n = parseFloat(String(ing.percentWW).replace(/[^\d.-]/g, ''));
      return sum + (Number.isNaN(n) ? 0 : n);
    }, 0);
  }, [formData.formulaIngredients]);

  const skuBomValidation = useMemo(() => {
    const { limitQty, limitUom } = getEffectiveSkuBomLimitFields({
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
  }, [formData.skuBomLines, formData.skuBomLimitQty, formData.skuBomLimitUom]);

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

  useEffect(() => {
    if (!effectiveProductId) {
      setEditApprovalStageAssignees(emptyStageAssignees());
    setEditApprovalTeamPending(null);
    }
  }, [effectiveProductId]);

  // When route has :id, fetch product and fill form for edit
  useEffect(() => {
    if (!effectiveProductId) return;
    setCurrentStage(0);
    let cancelled = false;
    setEditLoading(true);
    fetchPRProductDetail(effectiveProductId).then((res) => {
      if (cancelled) return;
      setEditLoading(false);
      if (res.success && res.data) {
        const d = res.data;
        const dbg = {
          effectiveProductId,
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
          window.alert(`PR edit populate looks empty for id=${effectiveProductId}. See console log [PR Edit Populate Debug].`);
        }
        const next = productDetailToBomForm(d);
        mergeEntityCustomFields(
          'PR',
          (d.form_data as { masterCustomFields?: Record<string, Partial<Record<MasterCustomFieldModuleCode, MasterCustomFieldDef[]>>> } | null)
            ?.masterCustomFields
        );
        setFormData(next);
        setEditApprovalStageAssignees(normalizeStageAssignees(d.approval_stage_assignees));
        setEditApprovalTeamPending(normalizePrApprovalTeamPending(d.approval_team_pending));
      }
    }).catch(() => {
      if (!cancelled) setEditLoading(false);
    });
    return () => { cancelled = true; };
  }, [effectiveProductId]);

  const prQualitySpecCtx = useMemo(
    () => ({
      category: formData.category,
      prSubCategory: formData.prSubCategory,
    }),
    [formData.category, formData.prSubCategory]
  );
  const prCustomFieldsTaxonomyKey = useMemo(
    () => buildMasterCustomFieldsTaxonomyKey(formData.category, formData.prSubCategory, ''),
    [formData.category, formData.prSubCategory]
  );
  const prCustomFieldsTaxonomyLabel = useMemo(() => {
    const parts = [formData.category, formData.prSubCategory].map((v) => String(v ?? '').trim()).filter(Boolean);
    return parts.length > 0 ? parts.join(' → ') : 'PR master';
  }, [formData.category, formData.prSubCategory]);
  const prCustomFieldFormData = useMemo(
    () => formData as unknown as Record<string, string | undefined>,
    [formData]
  );
  const prQualitySpecResolved = useMemo(
    () => resolvePrQualitySpecContext(prQualitySpecCtx),
    [prQualitySpecCtx]
  );
  const showPrBulkSubSpecTable = useMemo(
    () => shouldShowPrBulkSubSpecTable(prQualitySpecCtx),
    [prQualitySpecCtx]
  );
  const showPrFinalSubSpecTable = useMemo(
    () => shouldShowPrFinalSubSpecTable(prQualitySpecCtx),
    [prQualitySpecCtx]
  );
  const showPrDispatchSubSpecTable = useMemo(
    () => shouldShowPrDispatchSubSpecTable(prQualitySpecCtx),
    [prQualitySpecCtx]
  );
  const currentPrBulkSubSpecRows = useMemo(() => {
    const pathKey = prQualitySpecResolved.bulkSubSpecPathKey;
    if (!pathKey) return [];
    return formData.prQualityBulkSubSpecRowsByPath[pathKey] ?? [];
  }, [formData.prQualityBulkSubSpecRowsByPath, prQualitySpecResolved.bulkSubSpecPathKey]);
  const currentPrFinalSubSpecRows = useMemo(() => {
    const pathKey = prQualitySpecResolved.bulkSubSpecPathKey;
    if (!pathKey) return [];
    return formData.prQualityFinalSubSpecRowsByPath[pathKey] ?? [];
  }, [formData.prQualityFinalSubSpecRowsByPath, prQualitySpecResolved.bulkSubSpecPathKey]);
  const currentPrDispatchSubSpecRows = useMemo(() => {
    const pathKey = prQualitySpecResolved.bulkSubSpecPathKey;
    if (!pathKey) return [];
    return formData.prQualityDispatchSubSpecRowsByPath[pathKey] ?? [];
  }, [formData.prQualityDispatchSubSpecRowsByPath, prQualitySpecResolved.bulkSubSpecPathKey]);

  const handlePrQualitySpecSectionChange = useCallback(
    (section: PrQualitySpecSectionKey, rows: QualitySpecTableRow[]) => {
      setFormData((prev) => ({
        ...prev,
        prQualitySpecRowsBySection: {
          ...prev.prQualitySpecRowsBySection,
          [section]: rows,
        },
      }));
    },
    []
  );

  const handlePrBulkSubSpecRowsChange = useCallback((rows: QualitySpecTableRow[]) => {
    setFormData((prev) => {
      const pathKey = resolvePrQualitySpecContext({
        category: prev.category,
        prSubCategory: prev.prSubCategory,
      }).bulkSubSpecPathKey;
      if (!pathKey) return prev;
      return {
        ...prev,
        prQualityBulkSubSpecRowsByPath: {
          ...prev.prQualityBulkSubSpecRowsByPath,
          [pathKey]: rows,
        },
      };
    });
  }, []);

  const handlePrFinalSubSpecRowsChange = useCallback((rows: QualitySpecTableRow[]) => {
    setFormData((prev) => {
      const pathKey = resolvePrQualitySpecContext({
        category: prev.category,
        prSubCategory: prev.prSubCategory,
      }).bulkSubSpecPathKey;
      if (!pathKey) return prev;
      return {
        ...prev,
        prQualityFinalSubSpecRowsByPath: {
          ...prev.prQualityFinalSubSpecRowsByPath,
          [pathKey]: rows,
        },
      };
    });
  }, []);

  const handlePrDispatchSubSpecRowsChange = useCallback((rows: QualitySpecTableRow[]) => {
    setFormData((prev) => {
      const pathKey = resolvePrQualitySpecContext({
        category: prev.category,
        prSubCategory: prev.prSubCategory,
      }).bulkSubSpecPathKey;
      if (!pathKey) return prev;
      return {
        ...prev,
        prQualityDispatchSubSpecRowsByPath: {
          ...prev.prQualityDispatchSubSpecRowsByPath,
          [pathKey]: rows,
        },
      };
    });
  }, []);

  useEffect(() => {
    if (currentStage !== 6) return;
    setFormData((prev) => {
      const seeded = seedPrQualitySpecsIfEmpty(
        { category: prev.category, prSubCategory: prev.prSubCategory },
        prev.prQualitySpecRowsBySection,
        prev.prQualityBulkSubSpecRowsByPath,
        prev.prQualityFinalSubSpecRowsByPath,
        prev.prQualityDispatchSubSpecRowsByPath
      );
      if (
        seeded.bySection === prev.prQualitySpecRowsBySection &&
        seeded.bulkSubByPath === prev.prQualityBulkSubSpecRowsByPath &&
        seeded.finalSubByPath === prev.prQualityFinalSubSpecRowsByPath &&
        seeded.dispatchSubByPath === prev.prQualityDispatchSubSpecRowsByPath
      ) {
        return prev;
      }
      return {
        ...prev,
        prQualitySpecRowsBySection: seeded.bySection,
        prQualityBulkSubSpecRowsByPath: seeded.bulkSubByPath,
        prQualityFinalSubSpecRowsByPath: seeded.finalSubByPath,
        prQualityDispatchSubSpecRowsByPath: seeded.dispatchSubByPath,
      };
    });
  }, [currentStage, formData.category, formData.prSubCategory]);

  useEffect(() => {
    if (currentStage !== 7) return;
    setFormData((prev) => {
      const seeded = seedPrFacilityLicencesIfEmpty(prev.prFacilityLicences);
      if (seeded === prev.prFacilityLicences) return prev;
      return { ...prev, prFacilityLicences: seeded };
    });
  }, [currentStage]);

  const handleInputChange = (field: keyof BOMFormState, value: unknown) => {
    if (field === 'zohoId') return;
    if (field === 'category') {
      const nextCategory = normalizePrCategoryForSelect(String(value)) || String(value);
      setFormData((prev) => ({
        ...prev,
        category: nextCategory,
        prSubCategory: normalizePrSubCategoryForSelect(nextCategory, prev.prSubCategory),
      }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.category;
        delete next.prSubCategory;
        return next;
      });
      return;
    }
    if (field === 'prSubCategory') {
      const detail =
        normalizePrSubCategoryForSelect(formData.category, String(value)) || String(value);
      setFormData((prev) => ({ ...prev, prSubCategory: detail }));
      setErrors((prev) => {
        if (!prev.prSubCategory) return prev;
        const next = { ...prev };
        delete next.prSubCategory;
        return next;
      });
      return;
    }
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

  const handleCustomFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ): void => {
    const { id, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleRemoveCustomFieldValue = useCallback((formKey: string) => {
    setFormData((prev) => {
      const next = { ...(prev as unknown as Record<string, unknown>) };
      delete next[formKey];
      return next as BOMFormState;
    });
    setErrors((prev) => {
      if (!prev[formKey]) return prev;
      const next = { ...prev };
      delete next[formKey];
      return next;
    });
  }, []);

  const beginEditIngredient = (id: string) => {
    if (editingIngredientId && editingIngredientId !== id) {
      cancelIngredientEdit();
    }
    const ing = formData.formulaIngredients.find((i) => i.id === id);
    if (!ing) return;
    const isGroup = Boolean(ing.itemGroupId);
    setEditingIngredientId(id);
    setFormulaLineKind(isGroup ? 'item_group' : 'rm');
    setTempIngredient({
      inciName: ing.inciName,
      phase: ing.phase,
      percentWW: ing.percentWW,
      uom: ing.uom || 'KG',
      specificGravity: ing.specificGravity || '1',
    });
    if (isGroup) {
      setSelectedItemGroupId(ing.itemGroupId || '');
      setSelectedRmId('');
      setIngredientRmQuery('');
    } else {
      setSelectedItemGroupId('');
      setSelectedRmId(ing.rawMaterialId || '');
      setIngredientRmQuery(
        ing.rawMaterialId
          ? rmTypeaheadLabelForId(rawMaterials, ing.rawMaterialId)
          : ing.inciName
      );
    }
  };

  const saveIngredientEdit = () => {
    flushIngredientDraft();
  };

  const cancelIngredientEdit = () => {
    setEditingIngredientId(null);
    setSelectedRmId('');
    setSelectedItemGroupId('');
    setFormulaLineKind('rm');
    setIngredientRmQuery('');
    setTempIngredient({ inciName: '', phase: '', percentWW: '', uom: 'KG', specificGravity: '1' });
  };

  const buildIngredientFromDraft = (): BOMFormState['formulaIngredients'][number] | null => {
    if (formulaLineKind === 'item_group') {
      const grp = itemGroupsRm.find((g) => String(g.id) === selectedItemGroupId);
      if (!grp) {
        addToast('error', 'Select an item group');
        return null;
      }
      if (!tempIngredient.percentWW.trim()) {
        addToast('error', 'Enter % w/w for the item group line');
        return null;
      }
      return {
        id: editingIngredientId ?? Date.now().toString(),
        itemGroupId: String(grp.id),
        itemGroupName: grp.name,
        inciName: grp.name,
        rmCode: grp.code,
        phase: tempIngredient.phase,
        percentWW: tempIngredient.percentWW,
        uom: 'KG',
        specificGravity: tempIngredient.specificGravity || '1',
      };
    }

    const rm = selectedRmId ? rawMaterialById.get(String(selectedRmId)) : undefined;
    const manualInci = tempIngredient.inciName.trim() || ingredientRmQuery.trim();
    if (!rm && !manualInci) return null;
    if (!tempIngredient.percentWW.trim()) {
      addToast('error', 'Enter % w/w before adding this ingredient');
      return null;
    }
    const pct = parseFloat(String(tempIngredient.percentWW).replace(/[^\d.-]/g, ''));
    if (Number.isNaN(pct) || pct <= 0) {
      addToast('error', 'Enter a positive % w/w before adding this ingredient');
      return null;
    }
    return {
      id: editingIngredientId ?? Date.now().toString(),
      rawMaterialId: rm ? String(rm.id) : undefined,
      rmCode: rm ? rm.code : '',
      inciName: rm ? (rm.inci || rm.name || manualInci) : manualInci,
      phase: tempIngredient.phase,
      percentWW: tempIngredient.percentWW,
      uom: 'KG',
      specificGravity: tempIngredient.specificGravity || '1',
    };
  };

  const flushIngredientDraft = (): boolean => {
    const draft = buildIngredientFromDraft();
    if (!draft) {
      if (formulaLineKind === 'rm') return false;
      return false;
    }

    if (editingIngredientId) {
      if (draft.itemGroupId) {
        const conflict = formData.formulaIngredients.some(
          (ing) => ing.id !== editingIngredientId && String(ing.itemGroupId) === String(draft.itemGroupId)
        );
        if (conflict) {
          addToast('error', 'This item group is already added in Formula BOM');
          return false;
        }
      } else if (draft.rawMaterialId) {
        const conflict = formData.formulaIngredients.some(
          (ing) => ing.id !== editingIngredientId && String(ing.rawMaterialId) === String(draft.rawMaterialId)
        );
        if (conflict) {
          addToast('error', 'This raw material is already added in Formula BOM');
          return false;
        }
      }
      setFormData((prev) => ({
        ...prev,
        formulaIngredients: prev.formulaIngredients.map((item) =>
          item.id === editingIngredientId ? draft : item
        ),
      }));
      cancelIngredientEdit();
      return true;
    }

    if (draft.itemGroupId) {
      const conflict = formData.formulaIngredients.some(
        (ing) => String(ing.itemGroupId) === String(draft.itemGroupId)
      );
      if (conflict) {
        addToast('error', 'This item group is already added in Formula BOM');
        return false;
      }
    } else if (draft.rawMaterialId && selectedRmIds.has(String(draft.rawMaterialId))) {
      addToast('error', 'This raw material is already added in Formula BOM');
      return false;
    }

    setFormData((prev) => ({
      ...prev,
      formulaIngredients: [...prev.formulaIngredients, draft],
    }));
    cancelIngredientEdit();
    return true;
  };

  const addIngredient = () => {
    flushIngredientDraft();
  };

  const removeIngredient = (id: string) => {
    setEditingIngredientId((cur) => {
      if (cur === id) {
        setSelectedRmId('');
        setSelectedItemGroupId('');
        setFormulaLineKind('rm');
        setIngredientRmQuery('');
        setTempIngredient({ inciName: '', phase: '', percentWW: '', uom: 'KG', specificGravity: '1' });
        return null;
      }
      return cur;
    });
    setFormData((prev) => ({
      ...prev,
      formulaIngredients: prev.formulaIngredients.filter((item) => item.id !== id),
    }));
  };

  const importSkuBomFromFormulaBom = useCallback(() => {
    const { limitQty, limitUom } = getEffectiveSkuBomLimitFields({
      skuBomLimitQty: formData.skuBomLimitQty,
      skuBomLimitUom: formData.skuBomLimitUom,
    });
    if (!limitQty || !limitUom) {
      addToast('error', 'Set net per-unit quantity and UOM on the SKU BOM step before importing from Formula BOM.');
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
    formData.skuBomLimitQty,
    formData.skuBomLimitUom,
    formData.formulaIngredients,
    formData.skuBomLines.length,
    addToast,
  ]);

  const beginEditComponent = (id: string) => {
    if (editingComponentId && editingComponentId !== id) {
      cancelComponentEdit();
    }
    const c = formData.packingComponents.find((x) => x.id === id);
    if (!c) return;
    setEditingComponentId(id);
    setTempComponent({
      pmDescription: c.pmDescription,
      pmSkuCategory: c.pmSkuCategory || '',
      optionalPmSubCategory: c.optionalPmSubCategory || '',
      optionalPmSubSubCategory: c.optionalPmSubSubCategory || '',
      type: c.type,
      qtyUnit: c.qtyUnit,
      uom: c.uom || '',
    });
    setSelectedPmId(c.packMaterialId || '');
    setPackPmQuery(
      c.packMaterialId ? pmTypeaheadLabelForId(packMaterials, c.packMaterialId) : c.pmDescription
    );
  };

  const saveComponentEdit = (): void => {
    flushComponentDraft();
  };

  const cancelComponentEdit = () => {
    setEditingComponentId(null);
    setSelectedPmId('');
    setPackPmQuery('');
    setTempComponent(emptyPackComponentDraft());
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
      const editPmCats = pm ? packCategoriesFromPmRecord(pm) : null;
      setFormData((prev) => ({
        ...prev,
        packingComponents: prev.packingComponents.map((item) =>
          item.id === editingComponentId
            ? {
                ...item,
                packMaterialId: pm ? String(pm.id) : undefined,
                pmCode: pm ? pm.code : '',
                pmDescription: pm ? (pm.description || manualDesc) : manualDesc,
                pmSkuCategory: tempComponent.pmSkuCategory || editPmCats?.pmSkuCategory || '',
                optionalPmSubCategory:
                  tempComponent.optionalPmSubCategory || editPmCats?.optionalPmSubCategory || '',
                optionalPmSubSubCategory:
                  tempComponent.optionalPmSubSubCategory || editPmCats?.optionalPmSubSubCategory || '',
                type:
                  tempComponent.type ||
                  editPmCats?.type ||
                  (tempComponent.pmSkuCategory
                    ? pmLevelForSubCategory(tempComponent.pmSkuCategory)
                    : ''),
                qtyUnit: tempComponent.qtyUnit,
                uom: tempComponent.uom || pm?.unit || 'PCS',
              }
            : item
        ),
      }));
      setEditingComponentId(null);
      setSelectedPmId('');
      setPackPmQuery('');
      setTempComponent(emptyPackComponentDraft());
      return true;
    }

    if (pm && selectedPmIds.has(String(pm.id))) {
      addToast('error', 'This pack material is already added in Pack BOM');
      return false;
    }
    const pmCats = pm ? packCategoriesFromPmRecord(pm) : null;
    setFormData((prev) => ({
      ...prev,
      packingComponents: [
        ...prev.packingComponents,
        {
          id: Date.now().toString(),
          packMaterialId: pm ? String(pm.id) : undefined,
          pmCode: pm ? pm.code : '',
          pmDescription: pm ? (pm.description || manualDesc) : manualDesc,
          pmSkuCategory: tempComponent.pmSkuCategory || pmCats?.pmSkuCategory || '',
          optionalPmSubCategory:
            tempComponent.optionalPmSubCategory || pmCats?.optionalPmSubCategory || '',
          optionalPmSubSubCategory:
            tempComponent.optionalPmSubSubCategory || pmCats?.optionalPmSubSubCategory || '',
          type:
            tempComponent.type ||
            pmCats?.type ||
            (tempComponent.pmSkuCategory ? pmLevelForSubCategory(tempComponent.pmSkuCategory) : ''),
          qtyUnit: tempComponent.qtyUnit,
          uom: tempComponent.uom || pm?.unit || 'PCS',
        },
      ],
    }));
    setSelectedPmId('');
    setPackPmQuery('');
    setTempComponent(emptyPackComponentDraft());
    return true;
  };

  const addComponent = () => {
    flushComponentDraft();
  };

  const removeComponent = (id: string) => {
    setEditingComponentId((cur) => {
      if (cur === id) {
        setSelectedPmId('');
        setPackPmQuery('');
        setTempComponent(emptyPackComponentDraft());
        return null;
      }
      return cur;
    });
    setFormData((prev) => ({
      ...prev,
      packingComponents: prev.packingComponents.filter((item) => item.id !== id),
    }));
  };

  const flushStepDraft = (stepKind: PrProcessStepKind): boolean => {
    const draft = stepKind === 'packaging' ? tempPackagingStep : tempProductionStep;
    const setDraft = stepKind === 'packaging' ? setTempPackagingStep : setTempProductionStep;
    if (!draft.instruction.trim()) return false;
    setFormData((prev) => ({
      ...prev,
      processSteps: [
        ...prev.processSteps,
        {
          id: Date.now().toString(),
          ...draft,
          stepKind,
        },
      ],
    }));
    setDraft({ stepNumber: '', instruction: '', duration: '' });
    return true;
  };

  const addStep = (stepKind: PrProcessStepKind) => {
    flushStepDraft(stepKind);
  };

  const removeStep = (id: string) => {
    setFormData(prev => ({
      ...prev,
      processSteps: prev.processSteps.filter(item => item.id !== id)
    }));
  };

  const prPreviewSections = useMemo(
    () =>
      buildMasterPreviewSections(formData as unknown as Record<string, unknown>, PR_PREVIEW_SECTIONS, {
        baselineFormData: submitPreviewBaseline ?? undefined,
        omitKeys: isNewProduct ? ['skuCode', 'skuForZoho'] : undefined,
      }),
    [formData, isNewProduct, submitPreviewBaseline]
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

    if (effectiveProductId) {
      return {
        mode: 'update' as const,
        body: withMasterDraftApprovalStatus(buildPrUpdateBody(formData), formData.masterApprovalStatus),
      };
    }
    return {
      mode: 'create' as const,
      body: withMasterDraftApprovalStatus(buildPrRegistrationBody(formData), formData.masterApprovalStatus),
    };
  };

  const validatePrForDraft = (): { mode: 'update' | 'create'; body: Record<string, unknown> } | null => {
    if (!formData.productName.trim()) {
      addToast('error', 'Product name is required to save a draft');
      setCurrentStage(0);
      focusPrField('productName');
      return null;
    }
    if (effectiveProductId) {
      return {
        mode: 'update',
        body: withMasterDraftApprovalStatus(buildPrUpdateBody(formData), formData.masterApprovalStatus),
      };
    }
    return {
      mode: 'create',
      body: withMasterDraftApprovalStatus(buildPrRegistrationBody(formData), formData.masterApprovalStatus),
    };
  };

  const handleSave = async () => {
    const pending = validatePrForDraft();
    if (!pending) return;
    setDraftSaving(true);
    try {
      if (pending.mode === 'update' && effectiveProductId) {
        const res = await updatePRProduct(effectiveProductId, pending.body);
        if (!res.success || !res.data) {
          addToast('error', typeof res.error === 'string' ? res.error : 'Failed to save draft');
          return;
        }
        setFormData(productDetailToBomForm(res.data));
        setEditApprovalStageAssignees(normalizeStageAssignees(res.data.approval_stage_assignees));
        setEditApprovalTeamPending(normalizePrApprovalTeamPending(res.data.approval_team_pending));
        addToast('success', 'Draft saved. Continue editing and submit for review when ready.');
        onSaved?.();
      } else {
        const res = await createPRRegistration(pending.body);
        if (!res.success || !res.data) {
          addToast('error', typeof res.error === 'string' ? res.error : 'Failed to save draft');
          return;
        }
        const product = res.data.product as Record<string, unknown>;
        const code = String(product.product_code ?? product.productCode ?? '').trim();
        addToast('success', code ? `Draft saved (${code}).` : 'Draft saved.');
        exitPrForm();
      }
    } catch (err) {
      console.error(err);
      addToast('error', err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setDraftSaving(false);
    }
  };

  const handleSubmit = async () => {
    const pending = validatePrForSubmit();
    if (!pending) return;

    let intentStatus = readSavedMasterApprovalStatus({ status: formData.masterApprovalStatus });
    if (effectiveProductId) {
      const fresh = await fetchPRProductDetail(effectiveProductId);
      if (fresh?.success && fresh.data) {
        intentStatus = readSavedMasterApprovalStatus({
          status: fresh.data.status,
          lifecycleStatus: fresh.data.lifecycle_status,
        });
        setFormData((prev) => ({ ...prev, masterApprovalStatus: intentStatus }));
        setEditApprovalStageAssignees(normalizeStageAssignees(fresh.data.approval_stage_assignees));
        setEditApprovalTeamPending(normalizePrApprovalTeamPending(fresh.data.approval_team_pending));
        setSubmitPreviewBaseline(productDetailToBomForm(fresh.data) as unknown as Record<string, unknown>);
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
    setPendingPrSubmit({
      mode: pending.mode,
      body: withMasterDraftApprovalStatus(pending.body, intentStatus),
    });
    setSubmitPreviewOpen(true);
  };

  const handleRevert = () => {
    if (!effectiveProductId) {
      addToast('error', 'Save a draft first before sending the form back to a previous status.');
      return;
    }
    setRevertPreviewOpen(true);
  };

  const exitPrForm = useCallback(() => {
    onSaved?.();
    if (onClose) onClose();
    else navigate('/bom');
  }, [onSaved, onClose, navigate]);

  const handleConfirmSubmit = async (comment: string) => {
    const pending = pendingPrSubmit;
    if (!pending) return;
    setSubmitConfirming(true);
    try {
      let recordId = effectiveProductId;
      let approvalStatus = formData.masterApprovalStatus;

      let savedProductCode = formData.skuCode.trim();

      if (pending.mode === 'update' && effectiveProductId) {
        const res = await updatePRProduct(effectiveProductId, pending.body);
        if (!res.success || !res.data) {
          addToast('error', typeof res.error === 'string' ? res.error : 'Failed to update product');
          return;
        }
        setFormData(productDetailToBomForm(res.data));
        setEditApprovalStageAssignees(normalizeStageAssignees(res.data.approval_stage_assignees));
        setEditApprovalTeamPending(normalizePrApprovalTeamPending(res.data.approval_team_pending));
        savedProductCode = formData.skuCode.trim() || savedProductCode;
      } else {
        const res = await createPRRegistration(pending.body);
        if (!res.success || !res.data) {
          addToast('error', typeof res.error === 'string' ? res.error : 'Failed to register product');
          return;
        }
        const product = res.data.product as Record<string, unknown>;
        recordId = String(product.product_id ?? product.productId ?? '');
        if (recordId) setLocalProductId(recordId);
        savedProductCode = String(product.product_code ?? product.productCode ?? '').trim();
      }

      const freshAfterSave = recordId ? await fetchPRProductDetail(recordId) : null;
      if (freshAfterSave?.success && freshAfterSave.data) {
        setEditApprovalStageAssignees(normalizeStageAssignees(freshAfterSave.data.approval_stage_assignees));
        setEditApprovalTeamPending(normalizePrApprovalTeamPending(freshAfterSave.data.approval_team_pending));
      }

      if (recordId) {
        approvalStatus = freshAfterSave?.success && freshAfterSave.data
          ? readSavedMasterApprovalStatus({
              status: freshAfterSave.data.status,
              lifecycleStatus: freshAfterSave.data.lifecycle_status,
            })
          : readSavedMasterApprovalStatus({ status: formData.masterApprovalStatus });
        const assigneesForAdvance =
          freshAfterSave?.success && freshAfterSave.data
            ? normalizeStageAssignees(freshAfterSave.data.approval_stage_assignees)
            : editApprovalStageAssignees;
        const pendingForAdvance =
          freshAfterSave?.success && freshAfterSave.data
            ? normalizePrApprovalTeamPending(freshAfterSave.data.approval_team_pending)
            : editApprovalTeamPending;
        const intentStatus =
          pendingApprovalIntentStatus ??
          readSavedMasterApprovalStatus({ status: formData.masterApprovalStatus });
        const advancedResult = await advanceMasterApprovalAfterSave({
          kind: 'PR',
          itemId: recordId,
          intentStatus,
          serverStatusAfterSave: approvalStatus,
          assignees: assigneesForAdvance as MasterApprovalStageAssignees,
          canApproveAtStatus,
          comment,
          approvalTeamPending: pendingForAdvance,
        });
        if (!advancedResult.ok) {
          addToast('error', advancedResult.error);
          return;
        }
        approvalStatus = advancedResult.status;
        if (advancedResult.advanced) {
          setFormData((prev) => ({ ...prev, masterApprovalStatus: advancedResult.status }));
          setEditApprovalTeamPending(null);
        } else if (advancedResult.awaitingOtherTeam) {
          const pendingRefresh = await fetchPRProductDetail(recordId);
          if (pendingRefresh?.success && pendingRefresh.data) {
            setEditApprovalTeamPending(normalizePrApprovalTeamPending(pendingRefresh.data.approval_team_pending));
          }
          addToast(
            'info',
            'Your team sign-off was recorded. Waiting for the other team (RM or Pack) before status advances.'
          );
        } else if (getMasterApprovalSubmitAction(intentStatus)) {
          addToast('error', 'Approval status did not change. Please refresh and try again.');
          return;
        }
      }

      setSubmitPreviewOpen(false);
      setSubmitPreviewBaseline(null);
      setPendingPrSubmit(null);
      setPendingApprovalIntentStatus(null);

      const isCreate = pending.mode === 'create';
      if (isCreate) {
        addToast(
          'success',
          savedProductCode
            ? `Product registered (${savedProductCode}). Status: ${approvalStatus}`
            : `Product registered. Status: ${approvalStatus}`
        );
      } else {
        addToast('success', `Product updated. Status: ${approvalStatus}`);
      }
      exitPrForm();
    } catch (err) {
      console.error(err);
      addToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitConfirming(false);
    }
  };

  const handleConfirmRevert = async (comment: string) => {
    if (!effectiveProductId) return;
    setSubmitConfirming(true);
    try {
      const pending = validatePrForDraft();
      if (!pending) return;

      if (pending.mode === 'update') {
        const res = await updatePRProduct(effectiveProductId, pending.body);
        if (!res.success || !res.data) {
          addToast('error', typeof res.error === 'string' ? res.error : 'Failed to save draft');
          return;
        }
      } else {
        addToast('error', 'Save a draft first before sending the form back to a previous status.');
        return;
      }

      const freshAfterSave = await fetchPRProductDetail(effectiveProductId);
      const assigneesForRevert =
        freshAfterSave?.success && freshAfterSave.data
          ? normalizeStageAssignees(freshAfterSave.data.approval_stage_assignees)
          : editApprovalStageAssignees;
      const pendingForRevert =
        freshAfterSave?.success && freshAfterSave.data
          ? normalizePrApprovalTeamPending(freshAfterSave.data.approval_team_pending)
          : editApprovalTeamPending;
      if (!canApproveAtStatus(formData.masterApprovalStatus, assigneesForRevert, pendingForRevert)) {
        addToast(
          'error',
          'Only the assigned RM team or Pack team member may send the form back. Assign them in the list, then try again.'
        );
        return;
      }

      const reverted = await revertMasterApprovalStatus('PR', effectiveProductId, comment);
      if (!reverted.ok) {
        addToast('error', reverted.error);
        return;
      }

      if (freshAfterSave?.success && freshAfterSave.data) {
        const next = productDetailToBomForm({
          ...freshAfterSave.data,
          status: reverted.status,
          lifecycle_status: reverted.status,
        });
        setFormData(next);
        setEditApprovalTeamPending(null);
      } else {
        setFormData((prev) => ({ ...prev, masterApprovalStatus: reverted.status }));
      }
      addToast('success', `Status moved back to ${reverted.status}`);
      setRevertPreviewOpen(false);
      onSaved?.();
    } catch (err) {
      console.error(err);
      addToast('error', err instanceof Error ? err.message : 'Failed to revert approval status');
    } finally {
      setSubmitConfirming(false);
    }
  };

  const renderProcessStepsBlock = (
    stepKind: PrProcessStepKind,
    title: string,
    description: string,
    draftRef: React.RefObject<HTMLDivElement | null>,
    temp: { stepNumber: string; instruction: string; duration: string },
    setTemp: React.Dispatch<
      React.SetStateAction<{ stepNumber: string; instruction: string; duration: string }>
    >,
    accessKey: 'processProduction' | 'processPackaging'
  ): JSX.Element => {
    const steps = formData.processSteps.filter(
      (step) => normalizePrProcessStepKind(step.stepKind) === stepKind
    );
    return (
      <PrTeamSectionGate
        canEdit={prCanEdit(accessKey)}
        viewOnlyLabel={`View only — ${stepKind === 'packaging' ? 'packaging' : 'product (RM)'} team maintains these process steps.`}
        className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-white"
      >
        <label className="block text-sm font-semibold text-blue-700 mb-3">{title}</label>
        <p className="text-xs text-slate-600 mb-3">{description}</p>
        <div className="space-y-2 mb-4">
          <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-600 uppercase">
            <div>Step</div>
            <div className="col-span-2">Step Description / Instruction</div>
          </div>
          <div className="space-y-2">
            {steps.map((step) => (
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
          ref={draftRef}
          className="border border-slate-200 rounded-lg p-3 bg-white space-y-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && (e.target as HTMLElement).tagName === 'TEXTAREA') {
              e.preventDefault();
              addStep(stepKind);
            }
          }}
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">New step</p>
          <input
            type="text"
            placeholder="Step #"
            value={temp.stepNumber}
            onChange={(e) => setTemp((prev) => ({ ...prev, stepNumber: e.target.value }))}
            onBlur={() => runOnDraftLeave(draftRef, () => flushStepDraft(stepKind))}
            className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
          />
          <textarea
            placeholder="Step Description / Instruction (Ctrl+Enter to add)"
            value={temp.instruction}
            onChange={(e) => setTemp((prev) => ({ ...prev, instruction: e.target.value }))}
            onBlur={() => runOnDraftLeave(draftRef, () => flushStepDraft(stepKind))}
            rows={2}
            className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
          />
          <input
            type="text"
            placeholder="Duration (e.g., 15 mins)"
            value={temp.duration}
            onChange={(e) => setTemp((prev) => ({ ...prev, duration: e.target.value }))}
            onBlur={() => runOnDraftLeave(draftRef, () => flushStepDraft(stepKind))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addStep(stepKind);
              }
            }}
            className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
          />
        </div>
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={() => addStep(stepKind)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50"
          >
            <Plus className="w-4 h-4" /> Add step to list
          </button>
        </div>
      </PrTeamSectionGate>
    );
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

            <PrTeamSectionGate canEdit={prCanEdit('primary')}>
            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Category &amp; sub-category
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-600">*</span></label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub-category</label>
                  <select
                    id="prSubCategory"
                    value={formData.prSubCategory}
                    onChange={(e) => handleInputChange('prSubCategory', e.target.value)}
                    disabled={!formData.category.trim()}
                    aria-invalid={errors.prSubCategory ? true : undefined}
                    className={`w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 ${
                      errors.prSubCategory ? 'border-red-500 bg-red-50/40' : 'border-gray-300'
                    }`}
                  >
                    <option value="">
                      {formData.category.trim() ? 'Select sub-category…' : 'Select category first'}
                    </option>
                    {prSubCategoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {errors.prSubCategory ? <p className="mt-1 text-xs text-red-600">{errors.prSubCategory}</p> : null}
                </div>
                <p className="text-xs text-gray-500 sm:col-span-2">
                  Pick a product category (Skin Care, Hair Care, Cleansing, …) then the format sub-category (Cream,
                  Shampoo, Facewash, …).
                </p>
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
                    {isNewProduct
                      ? 'Internal code is generated on save for the series you select and shown in the confirmation dialog.'
                      : 'Record type applies to how this product was registered.'}
                  </p>
                </div>

                {!isNewProduct ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Internal PR code (SKU)</label>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono text-slate-800">
                      {formData.skuCode || '—'}
                    </div>
                  </div>
                ) : null}

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
            </PrTeamSectionGate>

          </div>
        );
      case 1:
        return (
            <PrTeamSectionGate canEdit={prCanEdit('formulaBom')}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">FORMULA BOM - RAW MATERIALS</label>
                <div className="mb-4 max-w-md rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label htmlFor="formula-bom-bulk-sg" className="mb-1 block text-xs font-semibold text-slate-700">
                    Specific Gravity (vs water)
                  </label>
                  <input
                    id="formula-bom-bulk-sg"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 1.02 or 0.95–1.02"
                    value={formData.specificGravity}
                    onChange={(e) => handleInputChange('specificGravity', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    title="Bulk finished-product SG — pre-fills Planning BOM confirmation default SG"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Default SG for the whole blend when confirming BOM in Planning (litre stock → kg). Set per-RM SG on each line below.
                  </p>
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  Add ingredients in phase order with <strong>SG (specific gravity vs water)</strong> on each line. Choose <strong>RM</strong> for a fixed raw material, or <strong>Item group</strong> to reference a group name (e.g. Glycerine Group) — at Planning BOM confirm you pick which group member to use. Formula amounts are always <strong>% w/w on a kg batch</strong>. Total % w/w should equal 100%.
                </p>

                <div className="mb-4 space-y-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
                  <div className="grid min-w-[860px] grid-cols-12 gap-2 text-xs font-semibold text-slate-600 uppercase sm:min-w-0">
                    <div className="col-span-3 min-w-0">INCI / Group name</div>
                    <div className="col-span-2 min-w-0">SKU / Group code</div>
                    <div className="col-span-2 min-w-0">Phase</div>
                    <div className="col-span-2 min-w-0">% W/W</div>
                    <div className="col-span-1 min-w-0">SG</div>
                    <div className="col-span-2 min-w-0">UOM</div>
                  </div>
                  <div className="space-y-2">
                    {formData.formulaIngredients.map((ing) => {
                      const isEditing = ing.id === editingIngredientId;
                      const inlineSku =
                        selectedRmId && isEditing
                          ? rawMaterialById.get(String(selectedRmId))?.code || getFormulaIngredientSku(ing)
                          : getFormulaIngredientSku(ing);

                      if (isEditing) {
                        return (
                          <div
                            key={ing.id}
                            className="grid min-w-[860px] grid-cols-12 gap-2 text-sm items-start p-2 rounded bg-blue-50 ring-2 ring-blue-200 sm:min-w-0"
                          >
                            <div className="col-span-3 min-w-0 space-y-1">
                              <select
                                value={formulaLineKind}
                                onChange={(e) => {
                                  const kind = e.target.value === 'item_group' ? 'item_group' : 'rm';
                                  setFormulaLineKind(kind);
                                  setSelectedRmId('');
                                  setSelectedItemGroupId('');
                                  setIngredientRmQuery('');
                                  setTempIngredient((prev) => ({ ...prev, inciName: '' }));
                                }}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-white"
                              >
                                <option value="rm">RM</option>
                                <option value="item_group">Item group</option>
                              </select>
                              {formulaLineKind === 'item_group' ? (
                                <select
                                  value={selectedItemGroupId}
                                  onChange={(e) => setSelectedItemGroupId(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm bg-white"
                                >
                                  <option value="">— Select item group —</option>
                                  {itemGroupsRm.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.name} ({g.code})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <RmMasterTypeahead
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
                                      uom: prev.uom || rm?.uom || 'KG',
                                    }));
                                  }}
                                  onClearSelection={() => setSelectedRmId('')}
                                  placeholder="RM code or INCI"
                                />
                              )}
                            </div>
                            <div className="col-span-2 min-w-0 pt-1.5 text-slate-600 font-mono text-xs break-all">
                              {inlineSku || '—'}
                            </div>
                            <div className="col-span-2 min-w-0">
                              <input
                                type="text"
                                placeholder="Phase"
                                value={tempIngredient.phase}
                                onChange={(e) => setTempIngredient((prev) => ({ ...prev, phase: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm bg-white"
                              />
                            </div>
                            <div className="col-span-2 min-w-0">
                              <input
                                type="number"
                                placeholder="% W/W"
                                value={tempIngredient.percentWW}
                                onChange={(e) => setTempIngredient((prev) => ({ ...prev, percentWW: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-mono bg-white"
                              />
                            </div>
                            <div className="col-span-1 min-w-0">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="SG"
                                title="Specific gravity for this RM in this PR formula — used at Planning BOM confirmation"
                                value={tempIngredient.specificGravity}
                                onChange={(e) =>
                                  setTempIngredient((prev) => ({ ...prev, specificGravity: e.target.value }))
                                }
                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-mono bg-white"
                              />
                            </div>
                            <div className="col-span-2 min-w-0 flex justify-end items-center gap-1 pt-0.5">
                              <span className="text-slate-600 mr-auto text-xs font-semibold">KG</span>
                              <button
                                type="button"
                                onClick={saveIngredientEdit}
                                className="text-emerald-700 hover:text-emerald-900 p-1 rounded"
                                title="Save line"
                                aria-label="Save line"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelIngredientEdit}
                                className="text-slate-600 hover:text-slate-900 p-1 rounded text-xs font-medium px-1"
                                title="Cancel edit"
                                aria-label="Cancel edit"
                              >
                                Cancel
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
                        );
                      }

                      return (
                        <div
                          key={ing.id}
                          className="grid min-w-[860px] grid-cols-12 gap-2 text-sm items-center p-2 rounded bg-slate-50 sm:min-w-0"
                        >
                          <div className="col-span-3 min-w-0 text-slate-900 break-words">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{ing.inciName}</span>
                              {ing.itemGroupId ? (
                                <span className="text-[9px] font-bold uppercase text-violet-700 bg-violet-100 px-1 py-0.5 rounded">
                                  Group
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="col-span-2 min-w-0 text-slate-600 font-mono text-xs break-all">
                            {getFormulaIngredientSku(ing) || '—'}
                          </div>
                          <div className="col-span-2 min-w-0 text-slate-600 break-words">{ing.phase}</div>
                          <div
                            className="col-span-2 min-w-0 text-slate-600 font-mono text-xs tabular-nums break-all leading-tight"
                            title={ing.percentWW}
                          >
                            {ing.percentWW}
                          </div>
                          <div className="col-span-1 min-w-0 text-slate-600 font-mono tabular-nums">
                            {ing.specificGravity || '1'}
                          </div>
                          <div className="col-span-2 min-w-0 flex justify-end items-center gap-1">
                            <span className="text-slate-600 mr-auto">KG</span>
                            <button
                              type="button"
                              onClick={() => beginEditIngredient(ing.id)}
                              disabled={Boolean(editingIngredientId)}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded disabled:opacity-40 disabled:pointer-events-none"
                              title="Edit line"
                              aria-label="Edit line"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeIngredient(ing.id)}
                              disabled={Boolean(editingIngredientId)}
                              className="text-red-600 hover:text-red-800 p-1 rounded disabled:opacity-40 disabled:pointer-events-none"
                              title="Remove line"
                              aria-label="Remove line"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!editingIngredientId ? (
                  <div
                    ref={ingredientDraftRef}
                    className="border border-slate-200 rounded-lg p-3 bg-white space-y-2"
                  >
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">New line</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs font-semibold text-slate-600">Line type</label>
                      <select
                        value={formulaLineKind}
                        onChange={(e) => {
                          const kind = e.target.value === 'item_group' ? 'item_group' : 'rm';
                          setFormulaLineKind(kind);
                          setSelectedRmId('');
                          setSelectedItemGroupId('');
                          setIngredientRmQuery('');
                          setTempIngredient((prev) => ({ ...prev, inciName: '' }));
                        }}
                        className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-white"
                      >
                        <option value="rm">Raw material (RM)</option>
                        <option value="item_group">Item group</option>
                      </select>
                    </div>
                    {formulaLineKind === 'item_group' ? (
                      <select
                        value={selectedItemGroupId}
                        onChange={(e) => setSelectedItemGroupId(e.target.value)}
                        className="w-full px-2 py-2 border border-violet-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                      >
                        <option value="">— Select item group (e.g. Glycerine Group) —</option>
                        {itemGroupsRm.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} · {g.code} · {(g.approvedMembers ?? []).length} member(s)
                          </option>
                        ))}
                      </select>
                    ) : (
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
                            uom: prev.uom || rm?.uom || 'KG',
                          }));
                        }}
                        onClearSelection={() => setSelectedRmId('')}
                        placeholder="Search RM by code or INCI — pick from list or type manual name"
                      />
                    )}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <input
                        type="text"
                        placeholder="Phase"
                        value={tempIngredient.phase}
                        onChange={(e) => setTempIngredient((prev) => ({ ...prev, phase: e.target.value }))}
                        className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                      />
                      <input
                        type="number"
                        placeholder="% W/W"
                        value={tempIngredient.percentWW}
                        onChange={(e) => setTempIngredient((prev) => ({ ...prev, percentWW: e.target.value }))}
                        className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="SG (vs water)"
                        title="Specific gravity for this RM in this PR formula — used at Planning BOM confirmation"
                        value={tempIngredient.specificGravity}
                        onChange={(e) =>
                          setTempIngredient((prev) => ({ ...prev, specificGravity: e.target.value }))
                        }
                        className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                      />
                      <span
                        className="px-2 py-1.5 text-sm font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded"
                        title="Formula BOM % w/w is always on a kg batch basis"
                      >
                        KG
                      </span>
                    </div>
                  </div>
                ) : null}

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
                    {editingIngredientId ? (
                      <p className="mt-1 text-xs text-blue-700">Editing in place — save with ✓ on the row or Cancel.</p>
                    ) : null}
                  </div>
                  {!editingIngredientId ? (
                    <button
                      type="button"
                      onClick={addIngredient}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50"
                    >
                      <Plus className="w-4 h-4" />
                      Add ingredient to list
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            </PrTeamSectionGate>
        );
      case 2: {
        return (
            <PrTeamSectionGate
              canEdit={prCanEdit('skuBom')}
              viewOnlyLabel="Automatic — SKU BOM is derived from Formula BOM. Edit formula lines to change per-unit quantities."
            >
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-violet-800 mb-2">
                SKU BOM — RAW MATERIALS (PER UNIT){' '}
                <span className="font-normal text-violet-600">(optional — derived from Formula BOM)</span>
              </label>
              <p className="text-xs text-slate-600 mb-3">
                Per-unit RM required for <strong>one</strong> finished unit. First qty column is always <strong>kg</strong> (planning/BOM basis); second column is the same amount in each RM&apos;s{' '}
                <strong>standard UoM</strong> from Raw Materials master (L, KG, etc.). Lines are populated via <strong>Import from Formula BOM</strong> (Formula % w/w must total 100%).
                When present, stored qtys must match net per unit (±0.001). Pack size on sale orders uses this net per unit.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3 rounded-lg bg-violet-50/80 border border-violet-100">
                <div>
                  <label className="block text-xs font-semibold text-violet-900 mb-1">Net per 1 product unit — quantity</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="e.g. 50"
                    value={formData.skuBomLimitQty}
                    onChange={(e) => handleInputChange('skuBomLimitQty', e.target.value)}
                    className="w-full px-2 py-1.5 border border-violet-200 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-violet-900 mb-1">UOM</label>
                  <select
                    value={formData.skuBomLimitUom}
                    onChange={(e) => handleInputChange('skuBomLimitUom', e.target.value)}
                    className="w-full px-2 py-1.5 border border-violet-200 rounded text-sm"
                  >
                    <option value="GM">G / GM (grams)</option>
                    <option value="KG">KG (kilograms)</option>
                    <option value="ML">ML (millilitres)</option>
                    <option value="L">L (litres)</option>
                  </select>
                </div>
                <p className="sm:col-span-2 text-xs text-violet-800">
                  Defines pack size for sale orders (e.g. <span className="font-mono">50 G</span>, <span className="font-mono">30 ML</span>).
                </p>
              </div>

              <div className="mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50/80 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                      Import from Formula BOM
                    </p>
                    <p className="text-[11px] text-blue-900/80 mt-0.5">
                      Derives per-unit RM quantities from Formula BOM <strong>% w/w</strong> on the previous step (must total 100%). Uses net per unit above.
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
              ) : formData.skuBomLines.length === 0 ? (
                <p className="text-xs text-slate-500 mb-3">
                  No SKU lines yet. Complete Formula BOM, then click <strong>Import from Formula BOM</strong>.
                </p>
              ) : null}

              <div className="mb-4 overflow-x-auto [-webkit-overflow-scrolling:touch] border border-slate-200 rounded-lg">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                      <th className="text-left p-2">INCI / Raw Material</th>
                      <th className="text-right p-2">Required / unit (kg)</th>
                      <th className="text-right p-2">Required / unit (Std UoM)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.skuBomLines.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-sm text-slate-500">
                          Import from Formula BOM to populate this list.
                        </td>
                      </tr>
                    ) : (
                      formData.skuBomLines.map((row) => {
                        const rmMaster = row.rawMaterialId
                          ? rawMaterialById.get(String(row.rawMaterialId))
                          : row.rmCode
                            ? rawMaterialByCode.get(row.rmCode.trim().toLowerCase())
                            : undefined;
                        const display = computeSkuBomQtyDisplay({
                          row,
                          formulaIngredients: formData.formulaIngredients,
                          rmMaster,
                        });
                        return (
                          <tr key={row.id} className="border-t border-slate-100">
                            <td className="p-2 text-slate-900">
                              {row.inciName}
                              {row.rmCode ? (
                                <span className="block text-[10px] font-mono text-violet-700">{row.rmCode}</span>
                              ) : null}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-violet-700">
                              {formatQtyWithUnit(display.kgQty, 'kg')}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-indigo-700">
                              {formatSkuBomStdQtyWithUnit(display.stdQty, display.stdUom)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </PrTeamSectionGate>
        );
      }
      case 3:
        return (
            <PrTeamSectionGate canEdit={prCanEdit('packBom')}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-blue-700 mb-3">PACKAGING BOM</label>
                <p className="text-xs text-slate-600 mb-3">
                  List primary, secondary, and label components. Click the pencil on a row to edit in place (like Formula BOM), or add a new line below.
                </p>

                <div className="mb-4 space-y-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
                  <div className="grid min-w-[980px] grid-cols-8 gap-2 text-xs font-semibold text-slate-600 uppercase sm:min-w-0">
                    <div className="col-span-2">PM Description</div>
                    <div>SKU</div>
                    <div>Category</div>
                    <div>Sub-category</div>
                    <div>Sub-sub</div>
                    <div>Type</div>
                    <div>Qty / Unit</div>
                  </div>
                  <div className="space-y-2">
                    {formData.packingComponents.map((comp) => {
                      const isEditing = comp.id === editingComponentId;
                      const inlineSku =
                        selectedPmId && isEditing
                          ? packMaterialById.get(String(selectedPmId))?.code || getPackComponentSku(comp)
                          : getPackComponentSku(comp);

                      if (isEditing) {
                        return (
                          <div
                            key={comp.id}
                            className="min-w-[980px] rounded-lg border border-blue-200 bg-blue-50 p-3 ring-2 ring-blue-200 space-y-2 sm:min-w-0"
                          >
                            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto] lg:items-start">
                              <PmMasterTypeahead
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
                                  const pmCats = pm ? packCategoriesFromPmRecord(pm) : null;
                                  setTempComponent((prev) => ({
                                    ...prev,
                                    pmDescription: pm ? (pm.description || opt.label) : opt.label,
                                    pmSkuCategory: pmCats?.pmSkuCategory || prev.pmSkuCategory,
                                    optionalPmSubCategory: pmCats?.optionalPmSubCategory || prev.optionalPmSubCategory,
                                    optionalPmSubSubCategory: pmCats?.optionalPmSubSubCategory || prev.optionalPmSubSubCategory,
                                    type: prev.type || pmCats?.type || pm?.level || '',
                                    uom: prev.uom || pm?.unit || 'PCS',
                                  }));
                                }}
                                onClearSelection={() => setSelectedPmId('')}
                                placeholder="Search PM by code or description"
                              />
                              <div className="flex items-center justify-end gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={saveComponentEdit}
                                  className="text-emerald-700 hover:text-emerald-900 p-1.5 rounded"
                                  title="Save line"
                                  aria-label="Save line"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelComponentEdit}
                                  className="text-slate-600 hover:text-slate-900 p-1.5 rounded text-xs font-medium"
                                  title="Cancel edit"
                                  aria-label="Cancel edit"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeComponent(comp.id)}
                                  className="text-red-600 hover:text-red-800 p-1.5 rounded"
                                  title="Remove line"
                                  aria-label="Remove line"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs font-mono text-slate-600">SKU: {inlineSku || '—'}</p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                                <select
                                  value={tempComponent.pmSkuCategory}
                                  onChange={(e) => {
                                    const canon = normalizePmSkuCategoryForSelect(e.target.value) || '';
                                    const level = pmLevelForSubCategory(canon);
                                    setTempComponent((prev) => ({
                                      ...prev,
                                      pmSkuCategory: canon,
                                      optionalPmSubCategory: normalizePmDetailSubCategoryForSelect(
                                        canon,
                                        prev.optionalPmSubCategory
                                      ),
                                      optionalPmSubSubCategory: '',
                                      type: level || prev.type,
                                    }));
                                  }}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm bg-white"
                                >
                                  <option value="">Select category…</option>
                                  {PM_SKU_CATEGORY_SELECT_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Sub-category</label>
                                <select
                                  value={tempComponent.optionalPmSubCategory}
                                  disabled={!tempComponent.pmSkuCategory.trim()}
                                  onChange={(e) => {
                                    const detail =
                                      normalizePmDetailSubCategoryForSelect(
                                        tempComponent.pmSkuCategory,
                                        e.target.value
                                      ) || e.target.value;
                                    setTempComponent((prev) => ({
                                      ...prev,
                                      optionalPmSubCategory: detail,
                                      optionalPmSubSubCategory: normalizePmSubSubCategoryForSelect(
                                        detail,
                                        prev.optionalPmSubSubCategory,
                                        prev.pmSkuCategory
                                      ),
                                    }));
                                  }}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm bg-white disabled:bg-slate-50"
                                >
                                  <option value="">Select sub-category…</option>
                                  {packDraftSubCategoryOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Sub-sub category</label>
                                <select
                                  value={tempComponent.optionalPmSubSubCategory}
                                  disabled={
                                    !tempComponent.optionalPmSubCategory.trim() ||
                                    !pmDetailSubCategoryHasSubSubCategory(tempComponent.optionalPmSubCategory)
                                  }
                                  onChange={(e) =>
                                    setTempComponent((prev) => ({
                                      ...prev,
                                      optionalPmSubSubCategory: e.target.value,
                                    }))
                                  }
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm bg-white disabled:bg-slate-50"
                                >
                                  <option value="">Select sub-sub category…</option>
                                  {packDraftSubSubCategoryOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <input
                                type="text"
                                placeholder="Type (Primary / Secondary / Tertiary)"
                                value={tempComponent.type}
                                onChange={(e) => setTempComponent((prev) => ({ ...prev, type: e.target.value }))}
                                className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-white"
                              />
                              <input
                                type="text"
                                placeholder="Qty / Unit"
                                value={tempComponent.qtyUnit}
                                onChange={(e) => setTempComponent((prev) => ({ ...prev, qtyUnit: e.target.value }))}
                                className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-white"
                              />
                              <input
                                type="text"
                                placeholder="UOM"
                                value={tempComponent.uom}
                                onChange={(e) => setTempComponent((prev) => ({ ...prev, uom: e.target.value }))}
                                className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-white"
                              />
                            </div>
                          </div>
                        );
                      }

                      return (
                      <div
                        key={comp.id}
                        className="grid min-w-[980px] grid-cols-8 gap-2 text-sm items-center p-2 rounded bg-slate-50 sm:min-w-0"
                      >
                        <div className="col-span-2 text-slate-900">{comp.pmDescription}</div>
                        <div className="text-slate-600 font-mono text-xs break-all">
                          {getPackComponentSku(comp) || '—'}
                        </div>
                        <div className="text-slate-600 text-xs">
                          {PM_SKU_CATEGORY_SELECT_OPTIONS.find((o) => o.value === comp.pmSkuCategory)?.label ||
                            comp.pmSkuCategory ||
                            '—'}
                        </div>
                        <div className="text-slate-600 text-xs">{comp.optionalPmSubCategory || '—'}</div>
                        <div className="text-slate-600 text-xs">{comp.optionalPmSubSubCategory || '—'}</div>
                        <div className="text-slate-600">{comp.type}</div>
                        <div className="flex justify-end items-center gap-1">
                          <span className="text-slate-600 mr-auto">{comp.qtyUnit}</span>
                          <button
                            type="button"
                            onClick={() => beginEditComponent(comp.id)}
                            disabled={Boolean(editingComponentId)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded disabled:opacity-40 disabled:pointer-events-none"
                            title="Edit line"
                            aria-label="Edit line"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeComponent(comp.id)}
                            disabled={Boolean(editingComponentId)}
                            className="text-red-600 hover:text-red-800 p-1 rounded disabled:opacity-40 disabled:pointer-events-none"
                            title="Remove line"
                            aria-label="Remove line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>

                {!editingComponentId ? (
                <div
                  ref={packDraftRef}
                  className="border border-slate-200 rounded-lg p-3 bg-white space-y-2"
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">New line</p>
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
                      const pmCats = pm ? packCategoriesFromPmRecord(pm) : null;
                      setTempComponent((prev) => ({
                        ...prev,
                        pmDescription: pm ? (pm.description || opt.label) : opt.label,
                        pmSkuCategory: pmCats?.pmSkuCategory || prev.pmSkuCategory,
                        optionalPmSubCategory: pmCats?.optionalPmSubCategory || prev.optionalPmSubCategory,
                        optionalPmSubSubCategory: pmCats?.optionalPmSubSubCategory || prev.optionalPmSubSubCategory,
                        type: prev.type || pmCats?.type || pm?.level || '',
                        uom: prev.uom || pm?.unit || 'PCS',
                      }));
                    }}
                    onClearSelection={() => setSelectedPmId('')}
                    placeholder="Search PM by code or description — pick from list or type manual name"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label htmlFor="packPmSkuCategory" className="block text-xs font-medium text-slate-600 mb-1">
                        Category
                      </label>
                      <select
                        id="packPmSkuCategory"
                        value={tempComponent.pmSkuCategory}
                        onChange={(e) => {
                          const canon = normalizePmSkuCategoryForSelect(e.target.value) || '';
                          const level = pmLevelForSubCategory(canon);
                          setTempComponent((prev) => ({
                            ...prev,
                            pmSkuCategory: canon,
                            optionalPmSubCategory: normalizePmDetailSubCategoryForSelect(
                              canon,
                              prev.optionalPmSubCategory
                            ),
                            optionalPmSubSubCategory: '',
                            type: level || prev.type,
                          }));
                        }}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                      >
                        <option value="">Select category…</option>
                        {PM_SKU_CATEGORY_SELECT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="packPmSubCategoryDetail" className="block text-xs font-medium text-slate-600 mb-1">
                        Sub-category
                      </label>
                      <select
                        id="packPmSubCategoryDetail"
                        value={tempComponent.optionalPmSubCategory}
                        disabled={!tempComponent.pmSkuCategory.trim()}
                        onChange={(e) => {
                          const detail =
                            normalizePmDetailSubCategoryForSelect(
                              tempComponent.pmSkuCategory,
                              e.target.value
                            ) || e.target.value;
                          setTempComponent((prev) => ({
                            ...prev,
                            optionalPmSubCategory: detail,
                            optionalPmSubSubCategory: normalizePmSubSubCategoryForSelect(
                              detail,
                              prev.optionalPmSubSubCategory,
                              prev.pmSkuCategory
                            ),
                          }));
                        }}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">Select sub-category…</option>
                        {packDraftSubCategoryOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                        {tempComponent.optionalPmSubCategory &&
                        !packDraftSubCategoryOptions.some((o) => o.value === tempComponent.optionalPmSubCategory) ? (
                          <option value={tempComponent.optionalPmSubCategory}>
                            {tempComponent.optionalPmSubCategory} (legacy)
                          </option>
                        ) : null}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="packPmSubSubCategoryDetail" className="block text-xs font-medium text-slate-600 mb-1">
                        Sub-sub category
                      </label>
                      <select
                        id="packPmSubSubCategoryDetail"
                        value={tempComponent.optionalPmSubSubCategory}
                        disabled={
                          !tempComponent.optionalPmSubCategory.trim() ||
                          !pmDetailSubCategoryHasSubSubCategory(tempComponent.optionalPmSubCategory)
                        }
                        onChange={(e) =>
                          setTempComponent((prev) => ({
                            ...prev,
                            optionalPmSubSubCategory: e.target.value,
                          }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">Select sub-sub category…</option>
                        {packDraftSubSubCategoryOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                        {tempComponent.optionalPmSubSubCategory &&
                        !packDraftSubSubCategoryOptions.some(
                          (o) => o.value === tempComponent.optionalPmSubSubCategory
                        ) ? (
                          <option value={tempComponent.optionalPmSubSubCategory}>
                            {tempComponent.optionalPmSubSubCategory} (legacy)
                          </option>
                        ) : null}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Type (Primary / Secondary / Tertiary)"
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
                ) : (
                  <p className="text-xs text-blue-700">Editing in place — save with ✓ on the row or Cancel.</p>
                )}

                <div className="flex justify-end mt-3">
                  {!editingComponentId ? (
                  <button
                    type="button"
                    onClick={addComponent}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add component to list
                  </button>
                  ) : null}
                </div>
              </div>
            </div>
            </PrTeamSectionGate>
        );
      case 4:
        return (
            <div className="space-y-6">
              {renderProcessStepsBlock(
                'production',
                'PRODUCTION PROCESS STEPS',
                'Manufacturing / bulk production steps. Product (RM) team maintains this list.',
                productionStepDraftRef,
                tempProductionStep,
                setTempProductionStep,
                'processProduction'
              )}
              {renderProcessStepsBlock(
                'packaging',
                'PACKAGING PROCESS STEPS',
                'Filling, labelling, and dispatch preparation steps. Packaging team maintains this list.',
                packagingStepDraftRef,
                tempPackagingStep,
                setTempPackagingStep,
                'processPackaging'
              )}
            </div>
        );
      case 5:
        return (
            <div className="space-y-6">
              <PrTeamSectionGate
                canEdit={prCanEdit('specsProduct')}
                viewOnlyLabel="View only — product specs & regulatory claims are maintained by the product (RM) team."
                className="space-y-4 border border-slate-200 rounded-lg p-3 sm:p-4 bg-white"
              >
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Product — business, storage &amp; specs</h3>
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
                <MasterCustomFieldsBlock
                  moduleCode="SPEC"
                  taxonomyLabel={prCustomFieldsTaxonomyLabel}
                  formData={prCustomFieldFormData}
                  errors={errors}
                  onChange={handleCustomFieldChange}
                  onRemoveFieldValue={handleRemoveCustomFieldValue}
                />
                <label className="block text-sm font-semibold text-blue-700 mb-3 mt-4">REGULATORY &amp; CLAIMS (product)</label>
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
              </PrTeamSectionGate>

              <PrTeamSectionGate
                canEdit={prCanEdit('specsPackaging')}
                viewOnlyLabel="View only — packaging specs are maintained by the packaging team."
                className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-white space-y-4"
              >
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Packaging — configuration &amp; specs</h3>
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
                <MasterCustomFieldsBlock
                  moduleCode="REG"
                  taxonomyLabel={prCustomFieldsTaxonomyLabel}
                  formData={prCustomFieldFormData}
                  errors={errors}
                  onChange={handleCustomFieldChange}
                  onRemoveFieldValue={handleRemoveCustomFieldValue}
                />
              </PrTeamSectionGate>
            </div>
        );
      case 6:
        return (
          <div className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-white min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Quality specifications</h3>
            <p className="text-xs text-slate-500 mb-4">
              Choose Bulk Clearance, Final Clearance, or Dispatch Specs above the table — use Add when no template exists for that section.
            </p>
            <PrQualitySpecTable
              categoryLabel={prQualitySpecResolved.categoryDisplayLabel}
              subCategoryLabel={prQualitySpecResolved.subCategory || '—'}
              rowsBySection={formData.prQualitySpecRowsBySection}
              bulkSubRows={currentPrBulkSubSpecRows}
              finalSubRows={currentPrFinalSubSpecRows}
              dispatchSubRows={currentPrDispatchSubSpecRows}
              onSectionChange={handlePrQualitySpecSectionChange}
              onBulkSubChange={handlePrBulkSubSpecRowsChange}
              onFinalSubChange={handlePrFinalSubSpecRowsChange}
              onDispatchSubChange={handlePrDispatchSubSpecRowsChange}
              showBulkSubTable={showPrBulkSubSpecTable}
              showFinalSubTable={showPrFinalSubSpecTable}
              showDispatchSubTable={showPrDispatchSubSpecTable}
              bulkSubDisabledHint={
                showPrBulkSubSpecTable
                  ? undefined
                  : 'Select PR category and sub-category in Primary info to add bulk sub-category specs.'
              }
              finalSubDisabledHint={
                showPrFinalSubSpecTable
                  ? undefined
                  : 'Select PR category and sub-category in Primary info to add final sub-category specs.'
              }
              dispatchSubDisabledHint={
                showPrDispatchSubSpecTable
                  ? undefined
                  : 'Select PR category and sub-category in Primary info to add dispatch sub-category specs.'
              }
              sectionEditable={(section) => prQualitySpecSectionEditable(prFormTeamRole, section)}
            />
          </div>
        );
      case 7:
        return (
          <PrTeamSectionGate
            canEdit={prCanEdit('licensing')}
            viewOnlyLabel="Licensing is restricted — only administrators may edit facility licences."
            className="min-w-0 border border-slate-200 rounded-lg p-3 sm:p-4 bg-white"
          >
            <PrFacilityLicenceStep
              records={formData.prFacilityLicences}
              onChange={(records) => setFormData((prev) => ({ ...prev, prFacilityLicences: records }))}
              productLabel={formData.productName.trim() || formData.skuCode.trim() || undefined}
            />
          </PrTeamSectionGate>
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
      <MasterCustomFieldsProvider entity="PR" taxonomyKey={prCustomFieldsTaxonomyKey}>
      <MasterFormBase
        title={effectiveProductId ? 'Edit Product Registration (PR Master)' : 'New Product Registration (PR Master)'}
        stages={stages}
        currentStage={currentStage}
        onStageChange={setCurrentStage}
        errors={errors}
        formData={formData as unknown as Record<string, unknown>}
        onInputChange={() => {}}
        onSave={() => void handleSave()}
        onReset={canShowResetForm ? handleReset : undefined}
        onRevert={canShowApprovalRevert ? handleRevert : undefined}
        revertLabel={approvalRevertAction?.revertLabel}
        onSubmit={canShowApprovalSubmit ? handleSubmit : undefined}
        submitLabel={approvalSubmitAction?.submitLabel ?? 'Submit'}
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
          setSubmitPreviewBaseline(null);
          setPendingPrSubmit(null);
          setPendingApprovalIntentStatus(null);
        }}
        onConfirm={handleConfirmSubmit}
        title={
          effectiveProductId ? 'Preview — update product (PR)' : 'Preview — new product registration (PR)'
        }
        subtitle={
          effectiveProductId
            ? `${approvalSubmitAction?.previewSubtitle ?? 'Review all values below.'} Both RM team and Pack team assignees must sign off before status advances.`
            : approvalSubmitAction?.previewSubtitle ??
              'Review all values below. Confirm to save and advance approval status.'
        }
        sections={prPreviewSections}
        confirmLabel={approvalSubmitAction?.confirmLabel ?? 'Confirm & submit'}
        confirming={submitConfirming}
        isEdit={!!effectiveProductId}
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
      </MasterCustomFieldsProvider>
    </>
  );
};

export default BOMForm;
