/**
 * Build server-side form snapshots for submit preview diff highlighting (edit mode).
 */

import type { RawMaterialRecord } from '../services/rawMaterials.service';
import type { PackMaterialRecord } from '../services/packMaterials.service';
import type { PriceListItemPage } from '../services/itemsList.service';
import type { PmCommercialVendor, RmCommercialVendor } from '../components/VendorCommercialEditor';
import {
  normalizeRmSubCategoryForSelect,
  normalizeRmDetailSubCategoryForSelect,
  normalizeRmSubSubCategoryForSelect,
  normalizePmSkuCategoryForSelect,
  normalizePmDetailSubCategoryForSelect,
  normalizePmSubSubCategoryForSelect,
  pmLevelForSubCategory,
} from '../constants/materialMasterSkuRules';
import {
  resolveRmEditCategories,
  resolvePmEditCategories,
  inferRmCategoryKeyFromCode,
} from '../utils/masterImportCategoryResolve';
import { deriveRmSourcingFieldsFromVendors } from '../constants/masterVendorSectionRedundantFields';
import { mergeRmVendorsWithPriceList, mergePmVendorsWithPriceList } from '../utils/mergeVendorsFromItemsList';
import { normalizeMasterApprovalStatus } from '../constants/masterApprovalStatus';

function safeParseMaybeJsonObject(input: unknown): Record<string, unknown> | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    try {
      const parsed: unknown = JSON.parse(s);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
    return null;
  }
  if (typeof input === 'object' && !Array.isArray(input)) return input as Record<string, unknown>;
  return null;
}

function normalizePmLifecycleStatus(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return 'Active';
  if (/^phase[\s-]?out$/i.test(s)) return 'Phase-Out';
  if (/^prefer/i.test(s)) return 'Preferred';
  if (/^condition/i.test(s)) return 'Conditional';
  if (/^discontinu/i.test(s)) return 'Discontinued';
  if (/^inactive$/i.test(s)) return 'Conditional';
  if (/^active$/i.test(s)) return 'Active';
  return s;
}

function normalizePmMaterial(raw: unknown): string {
  return String(raw ?? '').trim();
}

function normalizeRmVendorsFromFormData(vendorsVal: unknown): RmCommercialVendor[] {
  if (!Array.isArray(vendorsVal)) return [];
  return vendorsVal.map((v, idx) => {
    const row = v as Record<string, unknown>;
    const tiersRaw = row.tiers;
    const tiers =
      Array.isArray(tiersRaw) && tiersRaw.length > 0
        ? tiersRaw.map((t) => {
            const tier = t as Record<string, unknown>;
            return {
              moq: String(tier.moq ?? ''),
              price: String(tier.price ?? ''),
              validTill: String(tier.validTill ?? tier.valid_till ?? ''),
              note: String(tier.note ?? ''),
            };
          })
        : undefined;
    return {
      id: String(row.id ?? row.vendorId ?? idx),
      name: String(row.name ?? row.venName ?? row.vendorName ?? ''),
      location: String(row.location ?? row.venLocation ?? row.vendorLocation ?? ''),
      moq: Number(row.moq ?? row.venMoq ?? row.vendorMoq ?? 0),
      unitPrice: Number(row.unitPrice ?? row.venPrice ?? row.venUnitPrice ?? row.vendorUnitPrice ?? 0),
      leadTime: Number(row.leadTime ?? row.venLT ?? row.leadTimeDays ?? 0),
      approved: String(row.approved ?? row.venApproved ?? ''),
      priceValidTill: String(row.priceValidTill ?? row.venValid ?? row.validTill ?? ''),
      currency: row.currency != null ? String(row.currency) : 'INR',
      advancePct: row.advancePct != null ? String(row.advancePct) : '',
      preShipmentPct: row.preShipmentPct != null ? String(row.preShipmentPct) : '',
      postShipmentPct: row.postShipmentPct != null ? String(row.postShipmentPct) : '',
      creditDays: row.creditDays != null ? String(row.creditDays) : '',
      tiers,
    };
  });
}

function normalizePmVendorsFromFormData(input: unknown): PmCommercialVendor[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => {
    const row = v as Record<string, unknown>;
    const tiersRaw = row.tiers;
    const tiers =
      Array.isArray(tiersRaw) && tiersRaw.length > 0
        ? tiersRaw.map((t) => {
            const tier = t as Record<string, unknown>;
            return {
              moq: String(tier.moq ?? ''),
              price: String(tier.price ?? ''),
              validTill: String(tier.validTill ?? tier.valid_till ?? ''),
              note: String(tier.note ?? ''),
            };
          })
        : undefined;
    return {
      id: row.id != null ? String(row.id) : undefined,
      name: String(row.name ?? row.venName ?? row.vendorName ?? ''),
      location: String(row.location ?? row.venLocation ?? row.vendorLocation ?? ''),
      moq: Number(row.moq ?? row.venMoq ?? row.vendorMoq ?? 0),
      price: Number(row.price ?? row.unitPrice ?? row.venPrice ?? row.venUnitPrice ?? row.vendorUnitPrice ?? 0),
      leadTime: Number(row.leadTime ?? row.lead_time_days ?? row.venLT ?? row.leadTimeDays ?? 0),
      approved: String(row.approved ?? row.venApproved ?? ''),
      priceType: String(row.priceType ?? row.venPriceType ?? ''),
      validTill: String(row.validTill ?? row.venValid ?? ''),
      sampleCost: Number(row.sampleCost ?? row.venSampleCost ?? 0),
      currency: row.currency != null ? String(row.currency) : 'INR',
      advancePct: row.advancePct != null ? String(row.advancePct) : '',
      preShipmentPct: row.preShipmentPct != null ? String(row.preShipmentPct) : '',
      postShipmentPct: row.postShipmentPct != null ? String(row.postShipmentPct) : '',
      creditDays: row.creditDays != null ? String(row.creditDays) : '',
      tiers,
    };
  });
}

function coerceYesNo(value: unknown): '' | 'Yes' | 'No' {
  if (value === true || value === 'Yes') return 'Yes';
  if (value === false || value === 'No') return 'No';
  return '';
}

const RM_FD_OVERLAY_SKIP_KEYS = new Set([
  'subCategory',
  'rmCategoryKey',
  'rmCategory',
  'excelCategory',
  'excelSubCategory',
  'rmType',
  'rm_type',
  'sub_category',
  'rm_category_key',
]);

const PM_FD_OVERLAY_SKIP_KEYS = new Set([
  'subCategory',
  'pmSkuCategory',
  'optionalPmSubCategory',
  'pmCategory',
  'excelCategory',
  'excelSubCategory',
  'matBody',
]);

function cleanFormDataOverlay(
  fd: Record<string, unknown> | null,
  skipKeys: Set<string>
): Record<string, unknown> | null {
  if (!fd) return null;
  return Object.fromEntries(
    Object.entries(fd).filter(([k, v]) => v !== null && v !== undefined && !skipKeys.has(k))
  );
}

export function buildRmPreviewBaselineFromFetch(
  result: { record: RawMaterialRecord; form_data: Record<string, unknown> | null },
  priceRow?: PriceListItemPage | null
): Record<string, unknown> {
  const fdObj = safeParseMaybeJsonObject(result.form_data);
  let fdNormalized = fdObj ? { ...fdObj } : null;
  if (fdNormalized && Array.isArray(fdNormalized.vendors)) {
    fdNormalized = {
      ...fdNormalized,
      vendors: normalizeRmVendorsFromFormData(fdNormalized.vendors),
    };
  }

  const vendorsMerged = mergeRmVendorsWithPriceList(
    fdNormalized && Array.isArray(fdNormalized.vendors)
      ? (fdNormalized.vendors as RmCommercialVendor[])
      : [],
    priceRow ?? null
  );
  if (fdNormalized) {
    fdNormalized.vendors = vendorsMerged;
  } else if (vendorsMerged.length > 0) {
    fdNormalized = { vendors: vendorsMerged };
  }

  const r = result.record;
  const recordCode = r.code ?? '';
  const resolvedCats = resolveRmEditCategories({
    code: recordCode,
    category: r.category,
    group: r.group,
    form_data: fdObj,
  });
  const productsList = Array.isArray(r.products) ? r.products : [];

  const recordMapped: Record<string, unknown> = {
    rmSku: recordCode || '',
    inciName: r.inci ?? '',
    tradeCommercialName: r.name ?? '',
    subCategory: resolvedCats.subCategory,
    optionalRmSubCategory: resolvedCats.optionalRmSubCategory,
    optionalRmSubSubCategory: resolvedCats.optionalRmSubSubCategory,
    rmCategory: resolvedCats.rmCategory || (r.category ?? ''),
    rmCategoryKey: resolvedCats.rmCategoryKey || inferRmCategoryKeyFromCode(recordCode) || '',
    seriesPrefix: '',
    primaryUom: r.uom ?? '',
    gst: String(r.gst ?? ''),
    shelfLife: r.shelf ?? '',
    zohoId: r.zohoId ?? '',
    sku: r.zohoSkuCode ?? '',
    hsnCode: r.hsnCode ?? '',
    rmTaxPreference: r.taxPref ?? '',
    specificGravity:
      r.specificGravity != null && Number(r.specificGravity) > 0 ? String(r.specificGravity) : '',
    products: productsList,
    rmAssociateItems: productsList.length > 0 ? productsList.join('\n') : '',
    masterLifecycleStatus: r.masterLifecycleStatus?.trim() ? r.masterLifecycleStatus : 'Active',
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

  const fdCleanOverlay = cleanFormDataOverlay(fdNormalized ?? fdObj, RM_FD_OVERLAY_SKIP_KEYS);
  const merged: Record<string, unknown> = { ...recordMapped, ...(fdCleanOverlay ?? {}) };

  merged.subCategory =
    normalizeRmSubCategoryForSelect(resolvedCats.subCategory) ||
    normalizeRmSubCategoryForSelect(r.category ?? '') ||
    normalizeRmSubCategoryForSelect(r.group ?? '') ||
    resolvedCats.subCategory;
  const parentForDetail = String(merged.subCategory ?? '');
  merged.optionalRmSubCategory =
    normalizeRmDetailSubCategoryForSelect(parentForDetail, resolvedCats.optionalRmSubCategory) ||
    normalizeRmDetailSubCategoryForSelect(parentForDetail, String(merged.optionalRmSubCategory ?? '')) ||
    resolvedCats.optionalRmSubCategory ||
    merged.optionalRmSubCategory ||
    '';
  const detailForSubSub = String(merged.optionalRmSubCategory ?? '');
  merged.optionalRmSubSubCategory =
    normalizeRmSubSubCategoryForSelect(detailForSubSub, resolvedCats.optionalRmSubSubCategory) ||
    normalizeRmSubSubCategoryForSelect(detailForSubSub, String(merged.optionalRmSubSubCategory ?? '')) ||
    resolvedCats.optionalRmSubSubCategory ||
    merged.optionalRmSubSubCategory ||
    '';

  if (!Array.isArray(merged.vendors)) {
    merged.vendors = vendorsMerged;
  }
  merged.rmReturnable = coerceYesNo(merged.rmReturnable);
  merged.universalSwapEligibility = coerceYesNo(merged.universalSwapEligibility);

  const derivedSourcing = deriveRmSourcingFieldsFromVendors(
    Array.isArray(merged.vendors) ? (merged.vendors as RmCommercialVendor[]) : [],
    String(merged.primaryUom ?? '')
  );
  for (const [key, value] of Object.entries(derivedSourcing)) {
    if (!String(merged[key] ?? '').trim() && value.trim()) {
      merged[key] = value;
    }
  }

  return merged;
}

export function buildPmPreviewBaselineFromFetch(
  pm: PackMaterialRecord,
  priceRow?: PriceListItemPage | null
): Record<string, unknown> {
  const fdObj = safeParseMaybeJsonObject(pm.form_data);
  const resolvedPmCats = resolvePmEditCategories({
    code: pm.code,
    group: pm.group,
    material: pm.material,
    form_data: fdObj,
  });

  const skuCatResolved =
    normalizePmSkuCategoryForSelect(String(fdObj?.pmSkuCategory ?? '')) ||
    normalizePmSkuCategoryForSelect(resolvedPmCats.subCategory) ||
    normalizePmSkuCategoryForSelect(pm.group || '') ||
    normalizePmSkuCategoryForSelect(pm.material || '') ||
    '';

  const fdTrade = String(fdObj?.tradeCommercialName ?? '').trim();
  const tradeName = fdTrade || String(pm.description ?? '').trim();
  const fdStatus = String(
    fdObj?.masterApprovalStatus ?? fdObj?.status ?? pm.status ?? ''
  ).trim();
  const fdLifecycle = String(fdObj?.pmLifecycleStatus ?? '').trim();

  const baseFromRecord: Record<string, unknown> = {
    itemCode: pm.code,
    tradeCommercialName: tradeName,
    name: tradeName,
    masterApprovalStatus: normalizeMasterApprovalStatus(fdStatus || undefined, 'Draft'),
    status: normalizeMasterApprovalStatus(fdStatus || undefined, 'Draft'),
    pmLifecycleStatus: normalizePmLifecycleStatus(fdLifecycle || 'Active'),
    pmClientScope: String(fdObj?.pmClientScope ?? '').trim(),
    pmOwner: String(fdObj?.pmOwner ?? '').trim(),
    intendedUse: String(fdObj?.intendedUse ?? '').trim(),
    reusability: String(fdObj?.reusability ?? '').trim(),
    level: pmLevelForSubCategory(skuCatResolved) || pm.level || '',
    pmSkuCategory: skuCatResolved,
    subCategory: skuCatResolved || resolvedPmCats.subCategory,
    optionalPmSubCategory: resolvedPmCats.optionalPmSubCategory,
    optionalPmSubSubCategory: resolvedPmCats.optionalPmSubSubCategory,
    matBody: normalizePmMaterial(String(fdObj?.matBody ?? pm.material ?? '').trim()),
    specNominal: pm.sizeSpec || '',
    decorationMethod: pm.printStatus || '',
    zohoId: pm.zohoId ?? '',
    pkgSku: pm.zohoSkuCode ?? '',
    pkgHsn: pm.hsnCode ?? '',
    pkgUnit: pm.unit ?? 'PCS',
    pkgTaxPreference: pm.taxPref ?? '',
    pkgGst: (pm as { gst?: unknown }).gst != null ? String((pm as { gst?: unknown }).gst) : '',
    pkgReturnable:
      pm.pkgReturnable === true ? 'Yes' : pm.pkgReturnable === false ? 'No' : ('' as '' | 'Yes' | 'No'),
    pkgAssociateItems: pm.pkgAssociateItems ?? '',
    products: Array.isArray(pm.products) ? pm.products : [],
  };

  const vendorsNormalized = normalizePmVendorsFromFormData(fdObj?.vendors);
  const vendorsMerged = mergePmVendorsWithPriceList(vendorsNormalized, priceRow ?? null);
  const fdNormalized = fdObj
    ? { ...fdObj, vendors: vendorsMerged }
    : vendorsMerged.length > 0
      ? { vendors: vendorsMerged }
      : null;

  const fdCleanOverlay = cleanFormDataOverlay(fdNormalized, PM_FD_OVERLAY_SKIP_KEYS);
  const merged: Record<string, unknown> = { ...baseFromRecord, ...(fdCleanOverlay ?? {}) };

  merged.subCategory = merged.pmSkuCategory || merged.subCategory;
  merged.pmSkuCategory =
    normalizePmSkuCategoryForSelect(String(merged.pmSkuCategory ?? merged.subCategory ?? '')) ||
    merged.pmSkuCategory;
  merged.subCategory = merged.pmSkuCategory;
  const lvl = pmLevelForSubCategory(String(merged.pmSkuCategory ?? ''));
  if (lvl) merged.level = lvl;
  merged.optionalPmSubCategory =
    normalizePmDetailSubCategoryForSelect(
      String(merged.pmSkuCategory ?? ''),
      String(merged.optionalPmSubCategory ?? '')
    ) ||
    merged.optionalPmSubCategory ||
    '';
  merged.optionalPmSubSubCategory =
    normalizePmSubSubCategoryForSelect(
      String(merged.optionalPmSubCategory ?? ''),
      String(merged.optionalPmSubSubCategory ?? fdObj?.optionalPmSubSubCategory ?? ''),
      String(merged.pmSkuCategory ?? merged.subCategory ?? '')
    ) ||
    merged.optionalPmSubSubCategory ||
    '';

  if (vendorsMerged.length > 0 && !Array.isArray(merged.vendors)) {
    merged.vendors = vendorsMerged;
  }

  const rawReturnable = merged.pkgReturnable;
  if (rawReturnable === true) merged.pkgReturnable = 'Yes';
  else if (rawReturnable === false) merged.pkgReturnable = 'No';
  else if (rawReturnable !== 'Yes' && rawReturnable !== 'No') merged.pkgReturnable = '';

  const pmProducts = Array.isArray(pm.products) ? pm.products : [];
  if ((!Array.isArray(merged.products) || merged.products.length === 0) && pmProducts.length > 0) {
    merged.products = pmProducts;
  }

  return merged;
}
