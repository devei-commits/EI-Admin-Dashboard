import { fieldDefs, type MasterPreviewSectionDef } from '../utils/masterSubmitPreview';

export const RM_PREVIEW_SECTIONS: MasterPreviewSectionDef[] = [
  {
    title: 'Primary info (details, code & Books)',
    fields: fieldDefs(
      [
        'rmSku',
        'zohoId',
        'sku',
        'subCategory',
        'optionalRmSubCategory',
        'optionalRmSubSubCategory',
        'rmCategory',
        'rmCategoryKey',
        'inciName',
        'tradeCommercialName',
        'primaryUom',
        'casNo',
        'functionRole',
        'rmType',
        'rmAssociateItems',
        'qcInspectionGroup',
        'hazardHandlingClass',
      ],
      {
        rmSku: 'Internal RM code (SKU)',
        inciName: 'INCI name',
        tradeCommercialName: 'Trade / commercial name',
        subCategory: 'SKU series / category',
        optionalRmSubCategory: 'Category (bulk) / sub-category',
        optionalRmSubSubCategory: 'Sub-category (bulk) / sub-sub category',
      }
    ),
  },
  {
    title: 'Units, Tax & Procurement',
    fields: fieldDefs(
      [
        'issueUom',
        'standardPackSize',
        'rmTaxPreference',
        'rmReturnable',
        'hsnCode',
        'gst',
        'preferredCurrency',
      ],
      { hsnCode: 'HSN/SAC', gst: 'GST %' }
    ),
  },
  {
    title: 'Regulatory',
    fields: fieldDefs([
      'grade',
      'bisCompliance',
      'animalOrigin',
      'compliance',
      'functionRole',
      'rmType',
      'einecs',
      'countryOfOrigin',
      'manufacturer',
      'synonyms',
      'internalNotes',
      'allergenRequired',
      'gmoRequired',
      'sdsAvailable',
      'coaAvailable',
      'regulatoryNotes',
      'regMaxUseLevelPct',
      'regAllergenDeclarationEu26',
      'regIfraCategoryLimit',
      'regCiNumber',
      'regApprovedArea',
    ], {
      regMaxUseLevelPct: 'Regulatory max use level %',
      regAllergenDeclarationEu26: 'Allergen declaration (EU 26)',
      regIfraCategoryLimit: 'IFRA category & limit',
      regCiNumber: 'CI number',
      regApprovedArea: 'Approved area',
    }),
  },
  {
    title: 'Technical',
    fields: fieldDefs([
      'rmState',
      'physicalFormSolid',
      'physicalFormLiquid',
      'appearance',
      'odour',
      'activeContentPurityPct',
      'solubility',
      'viscosityP',
      'meltingPointC',
      'boilingPointC',
      'flashPointC',
      'specificGravity',
      'refractiveIndex',
      'chargeType',
      'activeMatterPct',
      'hlbValue',
      'residualSolventsPpm',
      'pathogen',
      'moistureContentPct',
      'doseUseLevel',
      'ph',
      'vocPct',
      'opticalSpectroscopy',
      'colourImpartToFormulation',
      'msdsSdsNotesLink',
      'storageCondition',
      'dispensingDirection',
    ]),
  },
  {
    title: 'Quality Specifications',
    fields: fieldDefs(
      [
        'coaRequired',
        'acceptanceSpecMin',
        'acceptanceSpecMax',
        'rmQualitySpecRows',
        'rmQualitySubSpecRowsByPath',
      ],
      {
        coaRequired: 'COA Required',
        acceptanceSpecMin: 'Acceptance Spec (MIN)',
        acceptanceSpecMax: 'Acceptance Spec (MAX)',
        rmQualitySpecRows: 'Common quality specs (tabular)',
        rmQualitySubSpecRowsByPath: 'Sub-category quality specs (tabular)',
      }
    ),
  },
  {
    title: 'Sourcing & Cost',
    fields: [
      ...fieldDefs(
        [
          'preferredVendor',
          'alternateVendors',
          'sourcingCountryOfOrigin',
          'sourcingStandardUom',
          'sourcingMoq',
          'sourcingLeadTimeDays',
          'sourcingCurrency',
        ],
        {
          preferredVendor: 'Preferred vendor',
          alternateVendors: 'Alternate vendor',
          sourcingCountryOfOrigin: 'Country of origin',
          sourcingStandardUom: 'UoM',
          sourcingMoq: 'MOQ',
          sourcingLeadTimeDays: 'Lead time (Days)',
          sourcingCurrency: 'Currency',
        }
      ),
      { key: 'vendors', label: 'Vendors & commercial' },
    ],
  },
  {
    title: 'Inventory & Logistics',
    fields: fieldDefs([
      'shelfLife',
      'retestPeriod',
      'reorderLevel',
      'dispensingBatchNo',
    ], {
      shelfLife: 'Shelf Life (Months)',
      retestPeriod: 'Re-test period (Months)',
      reorderLevel: 'Reorder Level',
      dispensingBatchNo: 'Dispensing Batch No',
    }),
  },
  {
    title: 'Lifecycle & Ownership',
    fields: fieldDefs(['masterLifecycleStatus', 'rmOwner'], {
      masterLifecycleStatus: 'Lifecycle Status',
      rmOwner: 'Owner',
    }),
  },
  {
    title: 'Similar & Group',
    fields: fieldDefs(['universalSwapEligibility', 'functionalEquivalents'], {
      universalSwapEligibility: 'Universal Swap Eligibility',
      functionalEquivalents: 'Functional Equivalents',
    }),
  },
];

export const PM_PREVIEW_SECTIONS: MasterPreviewSectionDef[] = [
  {
    title: 'Primary info',
    fields: fieldDefs(
      [
        'itemCode',
        'tradeCommercialName',
        'name',
        'intendedUse',
        'reusability',
        'pmSkuCategory',
        'subCategory',
        'optionalPmSubCategory',
        'optionalPmSubSubCategory',
        'pmCategory',
        'itemCategory',
        'level',
        'zohoId',
        'pkgSku',
        'pkgAssociateItems',
        'pmAssemblyCode',
        'pmComponentBreakdown',
        'pmSkuVolume',
      ],
      {
        itemCode: 'Internal PM code (SKU)',
        tradeCommercialName: 'PM Name / description',
        intendedUse: 'Intended use',
        reusability: 'Reusability',
        pmSkuCategory: 'Category',
        optionalPmSubCategory: 'Category (functional) / sub-category',
        optionalPmSubSubCategory: 'Sub-category (functional) / sub-sub category',
      }
    ),
  },
  {
    title: 'Units & Taxes',
    fields: fieldDefs(
      ['pkgUnit', 'pkgUnitsPerShipperRoll', 'pkgHsn', 'pkgGst', 'pkgTaxPreference', 'pkgReturnable'],
      {
        pkgUnit: 'Primary UoM',
        pkgUnitsPerShipperRoll: 'Units per shipper / roll',
        pkgHsn: 'HSN / SAC',
        pkgGst: 'GST %',
        pkgTaxPreference: 'Tax preference',
        pkgReturnable: 'Returnable item',
      }
    ),
  },
  {
    title: 'Technical, material & procurement',
    fields: fieldDefs(
      [
        'qcGroup',
        'storeLoc',
        'matBody',
        'specNominal',
        'specBrimful',
        'specWeight',
        'pmShoulderHeightMm',
        'pmOverallHeightMm',
        'pmOuterDiameterMm',
        'pmInnerDiameterNeckMm',
        'pmCircumferenceMm',
        'pmOrificeMm',
        'pmClosureType',
        'pmPumpCcDosage',
        'pmPipetteLengthMm',
        'pmSleeveHeightMm',
        'pmFillVolumeMl',
        'pmPackWidthMm',
        'pmPackHeightMm',
        'pmOpenClosedSizeMm',
        'pmSealLaminateWidthMm',
        'pmCartonLengthMm',
        'pmCartonWidthMm',
        'pmCartonHeightMm',
        'pmBoardPaperType',
        'pmGsm',
        'pmMaterialThicknessMicron',
        'pmLamination',
        'pmStickerType',
        'pmPrintingCmykPantones',
      ],
      {
        qcGroup: 'QC testing Group',
        storeLoc: 'Storage condition',
        matBody: 'Material',
        specNominal: 'Nominal volume (ml/g)',
        specBrimful: 'Brimful volume (ml)',
        specWeight: 'Empty weight (g)',
      }
    ),
  },
  {
    title: 'Aesthetics',
    fields: fieldDefs(
      [
        'colorType',
        'transparencyLevel',
        'colorCode',
        'deco',
        'decorationMethod',
        'printCoverage',
        'numberOfColours',
        'printColours',
        'foilColour',
        'finish',
        'surfaceTexture',
        'surfaceEffects',
        'uvFinishing',
        'embossingDebossing',
        'premiumLookFeel',
        'images',
        'pmShoulderColour',
        'pmCapOvercapColour',
        'pmActuatorColourStyle',
        'pmCollarFinish',
        'pmTeatColour',
      ],
      {
        colorType: 'Body / component color',
        colorCode: 'Colour code (Pantone)',
        deco: 'Decoration',
        finish: 'Surface finish',
        images: 'Reference image / mockup',
      }
    ),
  },
  {
    title: 'Variants Matrix',
    fields: [{ key: 'variants', label: 'Variants' }],
  },
  {
    title: 'Customization & Tooling',
    fields: fieldDefs(
      [
        'cusApprovedVendorCustom',
        'cusCustomisedMoq',
        'cusCustomisationLeadTimeDays',
        'cusCustomUnitCost',
        'cusSampleLeadTimeDays',
        'cusPrintingCylinderCost',
        'cusPrintingPlateDieCost',
        'cusToolingCost',
        'cusToolingOwnership',
        'cusPaymentTermsCustom',
        'cusSupplyLocationCustom',
      ],
      {
        cusApprovedVendorCustom: 'Approved vendor (custom)',
        cusCustomisedMoq: 'Customised MOQ',
        cusCustomisationLeadTimeDays: 'Customisation lead time (days)',
        cusCustomUnitCost: 'Custom unit cost',
        cusSampleLeadTimeDays: 'Sample lead time (days)',
        cusPrintingCylinderCost: 'Printing cylinder cost',
        cusPrintingPlateDieCost: 'Printing plate / die cost',
        cusToolingOwnership: 'Tooling ownership',
        cusPaymentTermsCustom: 'Payment terms (custom)',
        cusSupplyLocationCustom: 'Supply location (custom)',
      }
    ),
  },
  {
    title: 'Compatibility (R&D / QA)',
    fields: fieldDefs(
      [
        'compApplicationMethod',
        'compProductEnvironment',
        'compCompatibilityPmSkus',
        'pmSuitableContainerType',
        'pmContainerSurface',
        'pmAdhesiveCompatibility',
      ],
      {
        compApplicationMethod: 'Application method',
        compProductEnvironment: 'Product environment',
        compCompatibilityPmSkus: 'Compatibility PM SKUs',
        pmSuitableContainerType: 'Suitable container type',
        pmContainerSurface: 'Container surface',
        pmAdhesiveCompatibility: 'Adhesive compatibility',
      }
    ),
  },
  {
    title: 'Vendors & Commercial',
    fields: fieldDefs(
      ['preferredVendor', 'alternateVendor', 'pmSupplyLocation'],
      {
        preferredVendor: 'Preferred vendor',
        alternateVendor: 'Alternate vendor',
        pmSupplyLocation: 'Supply location',
      }
    ).concat([{ key: 'vendors', label: 'Commercial vendor rows' }]),
  },
  {
    title: 'Secondary Packaging',
    fields: fieldDefs([
      'secLabelType',
      'secLabelSize',
      'secAdhesive',
      'secLabelCompat',
      'secGsm',
      'secCartonFinish',
      'secFit',
      'secArtLink',
      'secNotes',
    ]),
  },
  {
    title: 'Tertiary Packaging',
    fields: fieldDefs(['terShipType', 'terUnits', 'terDrop', 'terStack', 'terNotes']),
  },
  {
    title: 'QA Testing & Documents',
    fields: fieldDefs(
      ['qaQcTestPlanRef', 'qaCoaRequired', 'pmQualitySpecRows', 'pmQualitySubSpecRowsByPath'],
      {
        qaQcTestPlanRef: 'QC test plan reference',
        qaCoaRequired: 'COA required',
        pmQualitySpecRows: 'Common quality specs (tabular)',
        pmQualitySubSpecRowsByPath: 'Sub-category quality specs (tabular)',
      }
    ),
  },
  {
    title: 'Catalogue',
    fields: fieldDefs(
      ['catListedInCatalogue', 'catCataloguePhoto', 'catCatalogueCustomNotes', 'catCatalogueVisibility'],
      {
        catListedInCatalogue: 'Listed in catalogue',
        catCataloguePhoto: 'Catalogue photo',
        catCatalogueCustomNotes: 'Catalogue custom notes',
        catCatalogueVisibility: 'Catalogue visibility',
      }
    ),
  },
  {
    title: 'Regulatory',
    fields: fieldDefs(
      [
        'regMigrationTestStatus',
        'regBpaPhthalateFree',
        'regRecyclabilityCode',
        'regEprRegistration',
        'regFoodCosmeticCompliance',
      ],
      {
        regMigrationTestStatus: 'Migration test status',
        regBpaPhthalateFree: 'BPA free / phthalate free',
        regRecyclabilityCode: 'Recyclability code',
        regEprRegistration: 'EPR registration',
        regFoodCosmeticCompliance: 'Food / cosmetic-contact compliance',
      }
    ),
  },
  {
    title: 'Lifecycle & Ownership',
    fields: fieldDefs(
      ['pmLifecycleStatus', 'pmClientScope', 'pmOwner', 'version'],
      {
        pmLifecycleStatus: 'Lifecycle status',
        pmClientScope: 'Client specific / generic',
        pmOwner: 'Owner',
      }
    ),
  },
  {
    title: 'Approvals',
    fields: fieldDefs(['apprPack', 'apprRd', 'apprFin', 'apprLock']),
  },
];

export const PR_PREVIEW_SECTIONS: MasterPreviewSectionDef[] = [
  {
    title: 'Primary info (details & Books)',
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
        'zohoId',
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
        'prQualitySpecRowsBySection',
        'prQualityBulkSubSpecRowsByPath',
        'prQualityFinalSubSpecRowsByPath',
        'prQualityDispatchSubSpecRowsByPath',
        'applicableRegulation',
        'cosmosNaturalCertification',
        'dermatologicallyTested',
        'crueltyFreeVegan',
        'approvedMarketingClaims',
        'claimsSubstantiation',
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
