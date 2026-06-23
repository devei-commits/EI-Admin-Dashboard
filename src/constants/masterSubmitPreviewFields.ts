import { fieldDefs, type MasterPreviewSectionDef } from '../utils/masterSubmitPreview';
import {
  PM_VENDOR_SECTION_REDUNDANT_KEY_SET,
  RM_VENDOR_SECTION_REDUNDANT_KEY_SET,
} from './masterVendorSectionRedundantFields';
import { PM_MASTER_FIELDS, PM_MASTER_MODULE_ORDER } from './pmMasterFieldSchema';
import { RM_MASTER_FIELDS, RM_MASTER_MODULE_ORDER } from './rmMasterFieldSchema';

export const RM_PREVIEW_SECTIONS: MasterPreviewSectionDef[] = [
  {
    title: 'Category & taxonomy',
    fields: fieldDefs(
      ['subCategory', 'optionalRmSubCategory', 'optionalRmSubSubCategory'],
      {
        subCategory: 'Category',
        optionalRmSubCategory: 'Sub-category',
        optionalRmSubSubCategory: 'Sub-sub category',
      }
    ),
  },
  ...RM_MASTER_MODULE_ORDER.map((mod) => ({
    title: mod.title,
    fields: fieldDefs(
      RM_MASTER_FIELDS.filter(
        (f) => f.module === mod.slug && !RM_VENDOR_SECTION_REDUNDANT_KEY_SET.has(f.key)
      ).map((f) => f.key),
      Object.fromEntries(
        RM_MASTER_FIELDS.filter(
          (f) => f.module === mod.slug && !RM_VENDOR_SECTION_REDUNDANT_KEY_SET.has(f.key)
        ).map((f) => [f.key, f.label])
      )
    ),
  })),
  {
    title: 'Quality specs (tabular)',
    fields: fieldDefs(['rmQualitySpecRows', 'rmQualitySubSpecRowsByPath'], {
      rmQualitySpecRows: 'Common quality specs (tabular)',
      rmQualitySubSpecRowsByPath: 'Sub-category quality specs (tabular)',
    }),
  },
  {
    title: 'Zoho integration',
    fields: fieldDefs(['rmTaxPreference', 'rmReturnable', 'rmAssociateItems'], {
      rmTaxPreference: 'Tax preference',
      rmReturnable: 'Returnable item',
      rmAssociateItems: 'Associate items',
    }),
  },
  {
    title: 'Commercial vendor rows',
    fields: [{ key: 'vendors', label: 'Commercial vendor rows' }],
  },
];

const PM_MODULE_PREVIEW_TITLES: Record<string, string> = {
  primary: 'PRIMARY INFO',
  units: 'UNITS & TAXES',
  dimensions: 'DIMENSIONS',
  material: 'MATERIAL SPECIFICATIONS',
  aesthetics: 'AESTHETICS',
  quality: 'GRN QUALITY CHECKS',
  vendors: 'VENDORS & COMMERCIALS',
};

export const PM_PREVIEW_SECTIONS: MasterPreviewSectionDef[] = [
  ...PM_MASTER_MODULE_ORDER.map((mod) => ({
    title: PM_MODULE_PREVIEW_TITLES[mod.slug] ?? mod.title,
    fields: fieldDefs(
      PM_MASTER_FIELDS.filter(
        (f) => f.module === mod.slug && !PM_VENDOR_SECTION_REDUNDANT_KEY_SET.has(f.key)
      ).map((f) => f.key),
      Object.fromEntries(
        PM_MASTER_FIELDS.filter(
          (f) => f.module === mod.slug && !PM_VENDOR_SECTION_REDUNDANT_KEY_SET.has(f.key)
        ).map((f) => [f.key, f.label])
      )
    ),
  })),
  {
    title: 'GRN quality specs (tabular)',
    fields: fieldDefs(['pmQualitySpecRows', 'pmQualitySubSpecRowsByPath'], {
      pmQualitySpecRows: 'Common quality specs (tabular)',
      pmQualitySubSpecRowsByPath: 'Sub-category quality specs (tabular)',
    }),
  },
  {
    title: 'Commercial vendor rows',
    fields: [{ key: 'vendors', label: 'Commercial vendor rows' }],
  },
];

export const PR_PREVIEW_SECTIONS: MasterPreviewSectionDef[] = [
  {
    title: 'Primary info (details)',
    fields: fieldDefs(
      [
        'productName',
        'category',
        'prSubCategory',
        'productForm',
        'brandClient',
        'packConfiguration',
        'skuCode',
        'prRecordType',
        'mrp',
        'skuForZoho',
        'bomTaxPreference',
        'bomReturnable',
        'bomAssociateItems',
        'bomCompositeItem',
        'prQcGroup',
        'prDefaultStorageType',
      ],
      {
        skuCode: 'Internal PR code',
        prRecordType: 'Record type',
        bomCompositeItem: 'Composite item',
        category: 'Category',
        prSubCategory: 'Sub-category',
      }
    ),
  },
  {
    title: 'Formula BOM',
    fields: fieldDefs(['specificGravity'], {
      specificGravity: 'Specific gravity (vs water)',
    }).concat([{ key: 'formulaIngredients', label: 'Formula BOM lines' }]),
  },
  {
    title: 'SKU BOM (per unit)',
    fields: fieldDefs(['skuBomLimitQty', 'skuBomLimitUom'], {
      skuBomLimitQty: 'Net content per unit',
      skuBomLimitUom: 'Net content UoM',
    }).concat([{ key: 'skuBomLines', label: 'SKU BOM lines' }]),
  },
  {
    title: 'Pack BOM',
    fields: [{ key: 'packingComponents', label: 'Pack BOM lines' }],
  },
  {
    title: 'Process Steps',
    fields: [{ key: 'processSteps', label: 'Process steps' }],
  },
  {
    title: 'Specs & Regulatory',
    fields: fieldDefs(
      [
        'applicableRegulation',
        'cosmosNaturalCertification',
        'dermatologicallyTested',
        'crueltyFreeVegan',
        'approvedMarketingClaims',
        'claimsSubstantiation',
      ]
    ),
  },
  {
    title: 'Quality specifications',
    fields: fieldDefs(
      [
        'prQualitySpecRowsBySection',
        'prQualityBulkSubSpecRowsByPath',
        'prQualityFinalSubSpecRowsByPath',
        'prQualityDispatchSubSpecRowsByPath',
      ],
      {
        prQualitySpecRowsBySection: 'Quality specifications (Bulk / Final / Dispatch tabular)',
        prQualityBulkSubSpecRowsByPath: 'Bulk clearance sub-category specs (tabular)',
        prQualityFinalSubSpecRowsByPath: 'Final clearance sub-category specs (tabular)',
        prQualityDispatchSubSpecRowsByPath: 'Dispatch specs sub-category specs (tabular)',
      }
    ),
  },
  {
    title: 'Licensing',
    fields: fieldDefs(['prFacilityLicences'], {
      prFacilityLicences: 'ML1 / ML2 facility licence records',
    }),
  },
];
