/**
 * RM master field schema — generated from EI_Masters_PM_v4g.html (source of truth).
 * Do not edit field definitions manually; re-run scripts/generate-rm-master-field-schema.cjs
 */
import type { EiFieldCond } from './eiMastersUnifiedSchema';

export type RmMasterFieldType = 'text' | 'textarea' | 'select';

export type RmMasterFieldDef = {
  key: string;
  label: string;
  module: string;
  moduleCode: string;
  type: RmMasterFieldType;
  required?: boolean;
  options?: string[];
  cond?: EiFieldCond;
};

export const RM_MASTER_MODULE_ORDER = [
  {
    "title": "PRIMARY INFO",
    "slug": "primary"
  },
  {
    "title": "UNITS & TAXES",
    "slug": "units"
  },
  {
    "title": "REGULATORY",
    "slug": "regulatory"
  },
  {
    "title": "TECHNICAL",
    "slug": "technical"
  },
  {
    "title": "QUALITY",
    "slug": "quality"
  },
  {
    "title": "SOURCING & COST",
    "slug": "sourcing"
  }
] as const;

/** Schema-only modules — hidden from the RM master stepper UI. */
export type RmMasterHiddenModuleSlug = 'inventory' | 'lifecycle' | 'similar';

export type RmMasterModuleSlug =
  | (typeof RM_MASTER_MODULE_ORDER)[number]['slug']
  | RmMasterHiddenModuleSlug;

export const RM_MASTER_FIELDS: RmMasterFieldDef[] = [
  {
    "key": "rmSku",
    "label": "Material Code (SKU)",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "text",
    "required": false
  },
  {
    "key": "inciName",
    "label": "INCI Name",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "text",
    "required": true
  },
  {
    "key": "tradeCommercialName",
    "label": "Trade / Commercial Name",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "text",
    "required": true
  },
  {
    "key": "casNo",
    "label": "CAS Number",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "text",
    "required": false
  },
  {
    "key": "functionRole",
    "label": "Function in Formula",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "select",
    "required": true,
    "options": [
      "Solvent",
      "Emulsifier",
      "Surfactant",
      "Active",
      "Preservative",
      "UV Filter",
      "Wax/Butter",
      "Botanical",
      "Rheology",
      "Fragrance",
      "Colour"
    ]
  },
  {
    "key": "primaryUom",
    "label": "Primary UOM",
    "module": "units",
    "moduleCode": "UNITS",
    "type": "select",
    "required": true,
    "options": [
      "KG",
      "GM",
      "L",
      "ML"
    ]
  },
  {
    "key": "hsnCode",
    "label": "HSN / SAC",
    "module": "units",
    "moduleCode": "UNITS",
    "type": "text",
    "required": true
  },
  {
    "key": "gst",
    "label": "GST Rate %",
    "module": "units",
    "moduleCode": "UNITS",
    "type": "select",
    "required": true,
    "options": [
      "0",
      "5",
      "12",
      "18",
      "28"
    ]
  },
  {
    "key": "grade",
    "label": "Grade",
    "module": "regulatory",
    "moduleCode": "REG",
    "type": "select",
    "required": true,
    "options": [
      "Cosmetic",
      "IP",
      "BP",
      "USP",
      "EP",
      "FCC",
      "Pharma"
    ]
  },
  {
    "key": "compliance",
    "label": "Compliance / Certificate",
    "module": "regulatory",
    "moduleCode": "REG",
    "type": "text",
    "required": false
  },
  {
    "key": "bisCompliance",
    "label": "BIS Compliance",
    "module": "regulatory",
    "moduleCode": "REG",
    "type": "select",
    "required": false,
    "options": [
      "Leave on",
      "Rinse off"
    ]
  },
  {
    "key": "regMaxUseLevelPct",
    "label": "Regulatory Max Use Level %",
    "module": "regulatory",
    "moduleCode": "REG",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "PRESERVATIVES",
        "UV FILTERS"
      ]
    }
  },
  {
    "key": "regAllergenDeclarationEu26",
    "label": "Allergen Declaration (EU 26)",
    "module": "regulatory",
    "moduleCode": "REG",
    "type": "textarea",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "FRAGRANCES / PERFUMES"
      ]
    }
  },
  {
    "key": "regIfraCategoryLimit",
    "label": "IFRA Category & Limit",
    "module": "regulatory",
    "moduleCode": "REG",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "FRAGRANCES / PERFUMES"
      ]
    }
  },
  {
    "key": "regCiNumber",
    "label": "CI Number",
    "module": "regulatory",
    "moduleCode": "REG",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "COLOURS"
      ]
    }
  },
  {
    "key": "regApprovedArea",
    "label": "Approved Area",
    "module": "regulatory",
    "moduleCode": "REG",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "COLOURS"
      ]
    }
  },
  {
    "key": "animalOrigin",
    "label": "Animal Origin",
    "module": "regulatory",
    "moduleCode": "REG",
    "type": "select",
    "required": false,
    "options": [
      "No",
      "Yes"
    ]
  },
  {
    "key": "rmState",
    "label": "State",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "select",
    "required": true,
    "options": [
      "Solid",
      "Liquid",
      "Semi-solid"
    ]
  },
  {
    "key": "appearance",
    "label": "Appearance",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": true
  },
  {
    "key": "odour",
    "label": "Odour",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "activeContentPurityPct",
    "label": "Active Content / Purity %",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "solubility",
    "label": "Solubility",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "viscosityP",
    "label": "Viscosity (cP)",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "meltingPointC",
    "label": "Melting Point (°C)",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "boilingPointC",
    "label": "Boiling Point (°C)",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "flashPointC",
    "label": "Flash Point (°C)",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "specificGravity",
    "label": "Specific Gravity",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": true
  },
  {
    "key": "refractiveIndex",
    "label": "Refractive Index",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "chargeType",
    "label": "Charge Type",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Anionic",
      "Cationic",
      "Non-ionic",
      "Amphoteric"
    ]
  },
  {
    "key": "activeMatterPct",
    "label": "Active Matter %",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "hlbValue",
    "label": "HLB Value",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "residualSolventsPpm",
    "label": "Residual / Residual Solvents (ppm)",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "pathogen",
    "label": "Pathogen",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "moistureContentPct",
    "label": "Moisture Content %",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "doseUseLevel",
    "label": "Dose / Use Level",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "ph",
    "label": "pH",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "vocPct",
    "label": "% VOC",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "opticalSpectroscopy",
    "label": "Optical / Spectroscopy (λmax/RI/IR)",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "colourImpartToFormulation",
    "label": "Colour Impart to Formulation",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "msdsSdsNotesLink",
    "label": "MSDS / SDS Notes & Link",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "textarea",
    "required": true
  },
  {
    "key": "storageCondition",
    "label": "Storage Condition",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "select",
    "required": true,
    "options": [
      "Ambient",
      "Cool & Dry",
      "Refrigerated 2-8°C",
      "Flammable store"
    ]
  },
  {
    "key": "dispensingDirection",
    "label": "Dispensing Direction",
    "module": "technical",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "physicalFormSolid",
    "label": "Physical Form — Solid",
    "module": "quality",
    "moduleCode": "QUAL",
    "type": "select",
    "required": false,
    "options": [
      "Pellets",
      "Crystals",
      "Powders",
      "Flakes",
      "Waxes",
      "Butters"
    ],
    "cond": {
      "on": "State",
      "vals": [
        "Solid"
      ]
    }
  },
  {
    "key": "physicalFormLiquid",
    "label": "Physical Form — Liquid",
    "module": "quality",
    "moduleCode": "QUAL",
    "type": "select",
    "required": false,
    "options": [
      "Transparent",
      "Translucent",
      "Opaque"
    ],
    "cond": {
      "on": "State",
      "vals": [
        "Liquid"
      ]
    }
  },
  {
    "key": "preferredVendor",
    "label": "Preferred Vendor",
    "module": "sourcing",
    "moduleCode": "SRC",
    "type": "text",
    "required": true
  },
  {
    "key": "alternateVendors",
    "label": "Alternate Vendors",
    "module": "sourcing",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  },
  {
    "key": "sourcingCountryOfOrigin",
    "label": "Country of Origin",
    "module": "sourcing",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  },
  {
    "key": "sourcingMoq",
    "label": "MOQ",
    "module": "sourcing",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  },
  {
    "key": "sourcingLeadTimeDays",
    "label": "Lead Time (days)",
    "module": "sourcing",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  },
  {
    "key": "sourcingStandardUom",
    "label": "Standard Cost / UOM",
    "module": "sourcing",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  },
  {
    "key": "sourcingCurrency",
    "label": "Currency",
    "module": "sourcing",
    "moduleCode": "SRC",
    "type": "select",
    "required": false,
    "options": [
      "INR",
      "USD",
      "EUR"
    ]
  },
  {
    "key": "shelfLife",
    "label": "Shelf Life (months)",
    "module": "inventory",
    "moduleCode": "INV",
    "type": "text",
    "required": true
  },
  {
    "key": "retestPeriod",
    "label": "Re-test Period (months)",
    "module": "inventory",
    "moduleCode": "INV",
    "type": "text",
    "required": false
  },
  {
    "key": "reorderLevel",
    "label": "Reorder Level",
    "module": "inventory",
    "moduleCode": "INV",
    "type": "text",
    "required": false
  },
  {
    "key": "dispensingBatchNo",
    "label": "Dispensing Batch No",
    "module": "inventory",
    "moduleCode": "INV",
    "type": "text",
    "required": false
  },
  {
    "key": "masterLifecycleStatus",
    "label": "Lifecycle Status",
    "module": "lifecycle",
    "moduleCode": "LIFE",
    "type": "select",
    "required": true,
    "options": [
      "Active",
      "Preferred",
      "Conditional",
      "Phase-out",
      "Discontinued"
    ]
  },
  {
    "key": "rmOwner",
    "label": "Owner",
    "module": "lifecycle",
    "moduleCode": "LIFE",
    "type": "text",
    "required": false
  },
  {
    "key": "universalSwapEligibility",
    "label": "Universal-swap eligibility",
    "module": "similar",
    "moduleCode": "SIM",
    "type": "select",
    "required": false,
    "options": [
      "Yes",
      "No"
    ]
  },
  {
    "key": "functionalEquivalents",
    "label": "Functional equivalents",
    "module": "similar",
    "moduleCode": "SIM",
    "type": "text",
    "required": false
  }
];

export const RM_MASTER_FIELDS_BY_MODULE: Record<RmMasterModuleSlug, RmMasterFieldDef[]> = {
  "primary": [
    {
      "key": "rmSku",
      "label": "Material Code (SKU)",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "text",
      "required": false
    },
    {
      "key": "inciName",
      "label": "INCI Name",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "text",
      "required": true
    },
    {
      "key": "tradeCommercialName",
      "label": "Trade / Commercial Name",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "text",
      "required": true
    },
    {
      "key": "casNo",
      "label": "CAS Number",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "text",
      "required": false
    },
    {
      "key": "functionRole",
      "label": "Function in Formula",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "select",
      "required": true,
      "options": [
        "Solvent",
        "Emulsifier",
        "Surfactant",
        "Active",
        "Preservative",
        "UV Filter",
        "Wax/Butter",
        "Botanical",
        "Rheology",
        "Fragrance",
        "Colour"
      ]
    }
  ],
  "units": [
    {
      "key": "primaryUom",
      "label": "Primary UOM",
      "module": "units",
      "moduleCode": "UNITS",
      "type": "select",
      "required": true,
      "options": [
        "KG",
        "GM",
        "L",
        "ML"
      ]
    },
    {
      "key": "hsnCode",
      "label": "HSN / SAC",
      "module": "units",
      "moduleCode": "UNITS",
      "type": "text",
      "required": true
    },
    {
      "key": "gst",
      "label": "GST Rate %",
      "module": "units",
      "moduleCode": "UNITS",
      "type": "select",
      "required": true,
      "options": [
        "0",
        "5",
        "12",
        "18",
        "28"
      ]
    }
  ],
  "regulatory": [
    {
      "key": "grade",
      "label": "Grade",
      "module": "regulatory",
      "moduleCode": "REG",
      "type": "select",
      "required": true,
      "options": [
        "Cosmetic",
        "IP",
        "BP",
        "USP",
        "EP",
        "FCC",
        "Pharma"
      ]
    },
    {
      "key": "compliance",
      "label": "Compliance / Certificate",
      "module": "regulatory",
      "moduleCode": "REG",
      "type": "text",
      "required": false
    },
    {
      "key": "bisCompliance",
      "label": "BIS Compliance",
      "module": "regulatory",
      "moduleCode": "REG",
      "type": "select",
      "required": false,
      "options": [
        "Leave on",
        "Rinse off"
      ]
    },
    {
      "key": "regMaxUseLevelPct",
      "label": "Regulatory Max Use Level %",
      "module": "regulatory",
      "moduleCode": "REG",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "PRESERVATIVES",
          "UV FILTERS"
        ]
      }
    },
    {
      "key": "regAllergenDeclarationEu26",
      "label": "Allergen Declaration (EU 26)",
      "module": "regulatory",
      "moduleCode": "REG",
      "type": "textarea",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "FRAGRANCES / PERFUMES"
        ]
      }
    },
    {
      "key": "regIfraCategoryLimit",
      "label": "IFRA Category & Limit",
      "module": "regulatory",
      "moduleCode": "REG",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "FRAGRANCES / PERFUMES"
        ]
      }
    },
    {
      "key": "regCiNumber",
      "label": "CI Number",
      "module": "regulatory",
      "moduleCode": "REG",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "COLOURS"
        ]
      }
    },
    {
      "key": "regApprovedArea",
      "label": "Approved Area",
      "module": "regulatory",
      "moduleCode": "REG",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "COLOURS"
        ]
      }
    },
    {
      "key": "animalOrigin",
      "label": "Animal Origin",
      "module": "regulatory",
      "moduleCode": "REG",
      "type": "select",
      "required": false,
      "options": [
        "No",
        "Yes"
      ]
    }
  ],
  "technical": [
    {
      "key": "rmState",
      "label": "State",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "select",
      "required": true,
      "options": [
        "Solid",
        "Liquid",
        "Semi-solid"
      ]
    },
    {
      "key": "appearance",
      "label": "Appearance",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": true
    },
    {
      "key": "odour",
      "label": "Odour",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "activeContentPurityPct",
      "label": "Active Content / Purity %",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "solubility",
      "label": "Solubility",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "viscosityP",
      "label": "Viscosity (cP)",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "meltingPointC",
      "label": "Melting Point (°C)",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "boilingPointC",
      "label": "Boiling Point (°C)",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "flashPointC",
      "label": "Flash Point (°C)",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "specificGravity",
      "label": "Specific Gravity",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": true
    },
    {
      "key": "refractiveIndex",
      "label": "Refractive Index",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "chargeType",
      "label": "Charge Type",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Anionic",
        "Cationic",
        "Non-ionic",
        "Amphoteric"
      ]
    },
    {
      "key": "activeMatterPct",
      "label": "Active Matter %",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "hlbValue",
      "label": "HLB Value",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "residualSolventsPpm",
      "label": "Residual / Residual Solvents (ppm)",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "pathogen",
      "label": "Pathogen",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "moistureContentPct",
      "label": "Moisture Content %",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "doseUseLevel",
      "label": "Dose / Use Level",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "ph",
      "label": "pH",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "vocPct",
      "label": "% VOC",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "opticalSpectroscopy",
      "label": "Optical / Spectroscopy (λmax/RI/IR)",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "colourImpartToFormulation",
      "label": "Colour Impart to Formulation",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "msdsSdsNotesLink",
      "label": "MSDS / SDS Notes & Link",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "textarea",
      "required": true
    },
    {
      "key": "storageCondition",
      "label": "Storage Condition",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "select",
      "required": true,
      "options": [
        "Ambient",
        "Cool & Dry",
        "Refrigerated 2-8°C",
        "Flammable store"
      ]
    },
    {
      "key": "dispensingDirection",
      "label": "Dispensing Direction",
      "module": "technical",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    }
  ],
  "quality": [
    {
      "key": "physicalFormSolid",
      "label": "Physical Form — Solid",
      "module": "quality",
      "moduleCode": "QUAL",
      "type": "select",
      "required": false,
      "options": [
        "Pellets",
        "Crystals",
        "Powders",
        "Flakes",
        "Waxes",
        "Butters"
      ],
      "cond": {
        "on": "State",
        "vals": [
          "Solid"
        ]
      }
    },
    {
      "key": "physicalFormLiquid",
      "label": "Physical Form — Liquid",
      "module": "quality",
      "moduleCode": "QUAL",
      "type": "select",
      "required": false,
      "options": [
        "Transparent",
        "Translucent",
        "Opaque"
      ],
      "cond": {
        "on": "State",
        "vals": [
          "Liquid"
        ]
      }
    }
  ],
  "sourcing": [
    {
      "key": "preferredVendor",
      "label": "Preferred Vendor",
      "module": "sourcing",
      "moduleCode": "SRC",
      "type": "text",
      "required": true
    },
    {
      "key": "alternateVendors",
      "label": "Alternate Vendors",
      "module": "sourcing",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    },
    {
      "key": "sourcingCountryOfOrigin",
      "label": "Country of Origin",
      "module": "sourcing",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    },
    {
      "key": "sourcingMoq",
      "label": "MOQ",
      "module": "sourcing",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    },
    {
      "key": "sourcingLeadTimeDays",
      "label": "Lead Time (days)",
      "module": "sourcing",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    },
    {
      "key": "sourcingStandardUom",
      "label": "Standard Cost / UOM",
      "module": "sourcing",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    },
    {
      "key": "sourcingCurrency",
      "label": "Currency",
      "module": "sourcing",
      "moduleCode": "SRC",
      "type": "select",
      "required": false,
      "options": [
        "INR",
        "USD",
        "EUR"
      ]
    }
  ],
  "inventory": [
    {
      "key": "shelfLife",
      "label": "Shelf Life (months)",
      "module": "inventory",
      "moduleCode": "INV",
      "type": "text",
      "required": true
    },
    {
      "key": "retestPeriod",
      "label": "Re-test Period (months)",
      "module": "inventory",
      "moduleCode": "INV",
      "type": "text",
      "required": false
    },
    {
      "key": "reorderLevel",
      "label": "Reorder Level",
      "module": "inventory",
      "moduleCode": "INV",
      "type": "text",
      "required": false
    },
    {
      "key": "dispensingBatchNo",
      "label": "Dispensing Batch No",
      "module": "inventory",
      "moduleCode": "INV",
      "type": "text",
      "required": false
    }
  ],
  "lifecycle": [
    {
      "key": "masterLifecycleStatus",
      "label": "Lifecycle Status",
      "module": "lifecycle",
      "moduleCode": "LIFE",
      "type": "select",
      "required": true,
      "options": [
        "Active",
        "Preferred",
        "Conditional",
        "Phase-out",
        "Discontinued"
      ]
    },
    {
      "key": "rmOwner",
      "label": "Owner",
      "module": "lifecycle",
      "moduleCode": "LIFE",
      "type": "text",
      "required": false
    }
  ],
  "similar": [
    {
      "key": "universalSwapEligibility",
      "label": "Universal-swap eligibility",
      "module": "similar",
      "moduleCode": "SIM",
      "type": "select",
      "required": false,
      "options": [
        "Yes",
        "No"
      ]
    },
    {
      "key": "functionalEquivalents",
      "label": "Functional equivalents",
      "module": "similar",
      "moduleCode": "SIM",
      "type": "text",
      "required": false
    }
  ]
} as Record<RmMasterModuleSlug, RmMasterFieldDef[]>;

export const RM_SCALAR_FIELD_CONDITIONS = Object.fromEntries(
  RM_MASTER_FIELDS.filter((f): f is RmMasterFieldDef & { cond: EiFieldCond } => Boolean(f.cond)).map(
    (f) => [f.key, f.cond]
  )
) as Record<string, EiFieldCond>;

export const RM_MASTER_FIELD_KEYS = [
  "rmSku",
  "inciName",
  "tradeCommercialName",
  "casNo",
  "functionRole",
  "primaryUom",
  "hsnCode",
  "gst",
  "grade",
  "compliance",
  "bisCompliance",
  "regMaxUseLevelPct",
  "regAllergenDeclarationEu26",
  "regIfraCategoryLimit",
  "regCiNumber",
  "regApprovedArea",
  "animalOrigin",
  "rmState",
  "appearance",
  "odour",
  "activeContentPurityPct",
  "solubility",
  "viscosityP",
  "meltingPointC",
  "boilingPointC",
  "flashPointC",
  "specificGravity",
  "refractiveIndex",
  "chargeType",
  "activeMatterPct",
  "hlbValue",
  "residualSolventsPpm",
  "pathogen",
  "moistureContentPct",
  "doseUseLevel",
  "ph",
  "vocPct",
  "opticalSpectroscopy",
  "colourImpartToFormulation",
  "msdsSdsNotesLink",
  "storageCondition",
  "dispensingDirection",
  "physicalFormSolid",
  "physicalFormLiquid",
  "preferredVendor",
  "alternateVendors",
  "sourcingCountryOfOrigin",
  "sourcingMoq",
  "sourcingLeadTimeDays",
  "sourcingStandardUom",
  "sourcingCurrency",
  "shelfLife",
  "retestPeriod",
  "reorderLevel",
  "dispensingBatchNo",
  "masterLifecycleStatus",
  "rmOwner",
  "universalSwapEligibility",
  "functionalEquivalents"
] as const;

export function rmFieldsForModule(slug: RmMasterModuleSlug): RmMasterFieldDef[] {
  return RM_MASTER_FIELDS_BY_MODULE[slug] ?? [];
}

export function emptyRmMasterScalarDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of RM_MASTER_FIELDS) out[f.key] = '';
  return out;
}
