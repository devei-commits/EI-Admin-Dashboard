/**
 * PM master field schema — generated from EI_Masters_PM_v4g.html (source of truth).
 * Do not edit field definitions manually; re-run scripts/generate-pm-master-field-schema.cjs
 */
import type { EiFieldCond } from './eiMastersUnifiedSchema';

export type PmMasterFieldType = 'text' | 'textarea' | 'select';

export type PmMasterFieldDef = {
  key: string;
  label: string;
  module: string;
  moduleCode: string;
  type: PmMasterFieldType;
  required?: boolean;
  options?: string[];
  cond?: EiFieldCond;
};

export const PM_MASTER_MODULE_ORDER = [
  {
    "title": "PRIMARY INFO",
    "slug": "primary"
  },
  {
    "title": "UNITS & TAXES",
    "slug": "units"
  },
  {
    "title": "DIMENSIONS",
    "slug": "dimensions"
  },
  {
    "title": "MATERIAL SPECIFICATIONS",
    "slug": "material"
  },
  {
    "title": "AESTHETICS",
    "slug": "aesthetics"
  },
  {
    "title": "GRN QUALITY CHECKS",
    "slug": "quality"
  },
  {
    "title": "VENDORS & COMMERCIALS",
    "slug": "vendors"
  }
] as const;

export type PmMasterModuleSlug = (typeof PM_MASTER_MODULE_ORDER)[number]['slug'];

export const PM_MASTER_FIELDS: PmMasterFieldDef[] = [
  {
    "key": "itemCode",
    "label": "Material Code (SKU)",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "text",
    "required": false
  },
  {
    "key": "tradeCommercialName",
    "label": "PM Name / Description",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "text",
    "required": true
  },
  {
    "key": "pmAssemblyCode",
    "label": "Assembly / Component-set Code",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "PPM — Primary (4XXXXX)"
      ]
    }
  },
  {
    "key": "pmComponentBreakdown",
    "label": "Component breakdown",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "textarea",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "PPM — Primary (4XXXXX)"
      ]
    }
  },
  {
    "key": "pmSkuVolume",
    "label": "SKU Volume (ml/g)",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "PPM — Primary (4XXXXX)"
      ]
    }
  },
  {
    "key": "intendedUse",
    "label": "Intended Use",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "text",
    "required": true
  },
  {
    "key": "reusability",
    "label": "Reusability",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "select",
    "required": false,
    "options": [
      "Single-use",
      "Reusable",
      "Refillable"
    ]
  },
  {
    "key": "pmLifecycleStatus",
    "label": "Status",
    "module": "primary",
    "moduleCode": "PRIMARY",
    "type": "select",
    "required": true,
    "options": [
      "Active",
      "Inactive",
      "Discontinued",
      "Phase-out"
    ]
  },
  {
    "key": "pkgUnit",
    "label": "Primary UOM",
    "module": "units",
    "moduleCode": "UNITS",
    "type": "select",
    "required": true,
    "options": [
      "NOS",
      "PCS",
      "ROLL",
      "KG",
      "MTR",
      "SQM"
    ]
  },
  {
    "key": "pkgUnitsPerShipperRoll",
    "label": "Units per Shipper / Roll",
    "module": "units",
    "moduleCode": "UNITS",
    "type": "text",
    "required": false
  },
  {
    "key": "pkgHsn",
    "label": "HSN / SAC",
    "module": "units",
    "moduleCode": "UNITS",
    "type": "text",
    "required": true
  },
  {
    "key": "pkgGst",
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
    "key": "specNominal",
    "label": "Nominal Volume (ml)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS",
        "TUBES",
        "STICKS",
        "SACHETS"
      ]
    }
  },
  {
    "key": "specBrimful",
    "label": "Brimful Capacity (ml)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS"
      ]
    }
  },
  {
    "key": "overflowCapacityOfcMl",
    "label": "Overflow Capacity OFC (ml)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "STICKS"
      ]
    }
  },
  {
    "key": "pmOverallHeightMm",
    "label": "Total / Overall Height (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS",
        "TUBES",
        "STICKS",
        "PUMPS",
        "DROPPERS",
        "CAPS",
        "LIDS"
      ]
    }
  },
  {
    "key": "pmShoulderHeightMm",
    "label": "Body / Shoulder Height (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS"
      ]
    }
  },
  {
    "key": "pmOuterDiameterMm",
    "label": "Outer Body Diameter (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS",
        "TUBES",
        "STICKS",
        "CAPS",
        "LIDS",
        "PUMPS",
        "DROPPERS"
      ]
    }
  },
  {
    "key": "pmInnerDiameterNeckMm",
    "label": "Inner / Neck Diameter (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS",
        "TUBES",
        "PUMPS",
        "DROPPERS",
        "CAPS",
        "LIDS"
      ]
    }
  },
  {
    "key": "pmCircumferenceMm",
    "label": "Body Circumference (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS",
        "STICKS"
      ]
    }
  },
  {
    "key": "neckFinishStandard",
    "label": "Neck Finish Standard",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": true,
    "options": [
      "18/410",
      "20/410",
      "20/415",
      "22/400",
      "24/410",
      "24/415",
      "28/400",
      "28/410",
      "33/400",
      "33/410",
      "38/400",
      "43/400",
      "58/400",
      "custom"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS",
        "PUMPS",
        "DROPPERS",
        "CAPS",
        "LIDS"
      ]
    }
  },
  {
    "key": "neckHeightHMmTEHSpec",
    "label": "Neck Height H (mm) — T/E/H spec",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS",
        "CAPS",
        "LIDS"
      ]
    }
  },
  {
    "key": "threadMajorDiaTMm",
    "label": "Thread Major Dia T (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS",
        "CAPS",
        "LIDS"
      ]
    }
  },
  {
    "key": "insideBoreDiaIMm",
    "label": "Inside Bore Dia I (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS",
        "CAPS",
        "LIDS"
      ]
    }
  },
  {
    "key": "specWeight",
    "label": "Empty / Component Weight (g)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS",
        "TUBES",
        "STICKS",
        "CAPS",
        "LIDS"
      ]
    }
  },
  {
    "key": "wallThicknessSidewallMm",
    "label": "Wall Thickness — Sidewall (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS",
        "TUBES"
      ]
    }
  },
  {
    "key": "wallThicknessBaseMm",
    "label": "Wall Thickness — Base (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS"
      ]
    }
  },
  {
    "key": "baseType",
    "label": "Base Type",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Champagne",
      "Petaloid",
      "Flat",
      "Hemispherical",
      "Footed"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES"
      ]
    }
  },
  {
    "key": "headspaceAtFillMmMl",
    "label": "Headspace at fill (mm/ml)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS"
      ]
    }
  },
  {
    "key": "tubeLengthMm",
    "label": "Tube Length (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__sub",
      "vals": [
        "TUBES"
      ]
    }
  },
  {
    "key": "pmOrificeMm",
    "label": "Orifice Diameter (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__sub",
      "vals": [
        "TUBES",
        "DROPPERS",
        "PUMPS"
      ]
    }
  },
  {
    "key": "shoulderStyle",
    "label": "Shoulder Style",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Standard",
      "Slim",
      "Wide",
      "Custom"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "TUBES"
      ]
    }
  },
  {
    "key": "crimpEndWidthMm",
    "label": "Crimp / End Width (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "TUBES"
      ]
    }
  },
  {
    "key": "pmClosureType",
    "label": "Closure Type",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Screw",
      "Disc-top",
      "Flip-top",
      "Snap-on",
      "Friction-fit",
      "CR (push-turn)",
      "Press-on",
      "Heat seal",
      "NA"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "CAPS",
        "LIDS",
        "TUBES"
      ]
    }
  },
  {
    "key": "pmPumpCcDosage",
    "label": "Pump / Dropper Output per Stroke (ml)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "PUMPS",
        "DROPPERS"
      ]
    }
  },
  {
    "key": "primingStrokesCount",
    "label": "Priming Strokes (count)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "PUMPS"
      ]
    }
  },
  {
    "key": "dipTubeLengthMm",
    "label": "Dip Tube Length (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "PUMPS"
      ]
    }
  },
  {
    "key": "springMaterial",
    "label": "Spring Material",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Stainless Steel 304",
      "Stainless Steel 316",
      "PP Spring-less",
      "Other"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "PUMPS"
      ]
    }
  },
  {
    "key": "pmPipetteLengthMm",
    "label": "Pipette Length (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__sub",
      "vals": [
        "DROPPERS"
      ]
    }
  },
  {
    "key": "pipetteTipDiameterMm",
    "label": "Pipette Tip Diameter (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "DROPPERS"
      ]
    }
  },
  {
    "key": "teatMaterial",
    "label": "Teat Material",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Rubber",
      "Silicone",
      "TPE",
      "Latex-free"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "DROPPERS"
      ]
    }
  },
  {
    "key": "calibrationMarks",
    "label": "Calibration Marks",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Calibrated"
      ]
    }
  },
  {
    "key": "ballMaterial",
    "label": "Ball Material",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "PE",
      "PP",
      "Stainless Steel",
      "Glass",
      "Ceramic"
    ],
    "cond": {
      "on": "__subsub",
      "vals": [
        "Roll-on"
      ]
    }
  },
  {
    "key": "ballDiameterMm",
    "label": "Ball Diameter (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Roll-on"
      ]
    }
  },
  {
    "key": "pushUpMechanism",
    "label": "Push-up Mechanism",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Twist-up",
      "Slide-up",
      "Click-up",
      "Magnetic"
    ],
    "cond": {
      "on": "__subsub",
      "vals": [
        "Stick"
      ]
    }
  },
  {
    "key": "fillingHeightMm",
    "label": "Filling Height (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "STICKS"
      ]
    }
  },
  {
    "key": "sachetWidthMm",
    "label": "Sachet Width (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SACHETS"
      ]
    }
  },
  {
    "key": "sachetHeightMm",
    "label": "Sachet Height (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SACHETS"
      ]
    }
  },
  {
    "key": "pmFillVolumeMl",
    "label": "Fill Volume (ml/g)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SACHETS"
      ]
    }
  },
  {
    "key": "pmSealLaminateWidthMm",
    "label": "Seal / Laminate Width (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SACHETS"
      ]
    }
  },
  {
    "key": "tearNotch",
    "label": "Tear Notch",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Yes (V-notch)",
      "Yes (I-notch)",
      "Yes (laser)",
      "None"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "SACHETS"
      ]
    }
  },
  {
    "key": "labelWidthMm",
    "label": "Label Width (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Labels (5LXXXXX)"
      ]
    }
  },
  {
    "key": "labelHeightMm",
    "label": "Label Height (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Labels (5LXXXXX)"
      ]
    }
  },
  {
    "key": "sheetRollFormat",
    "label": "Sheet / Roll Format",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Sheet",
      "Roll"
    ],
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Labels (5LXXXXX)"
      ]
    }
  },
  {
    "key": "labelsPerSheet",
    "label": "Labels per Sheet",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SHEET FORM"
      ]
    }
  },
  {
    "key": "sheetSizeMm",
    "label": "Sheet Size (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SHEET FORM"
      ]
    }
  },
  {
    "key": "rollCoreInnerDiameterMm",
    "label": "Roll Core Inner Diameter (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "ROLL FORM"
      ]
    }
  },
  {
    "key": "rollOuterDiameterMm",
    "label": "Roll Outer Diameter (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "ROLL FORM"
      ]
    }
  },
  {
    "key": "labelsPerRoll",
    "label": "Labels per Roll",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "ROLL FORM"
      ]
    }
  },
  {
    "key": "rollDirection",
    "label": "Roll Direction",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Inward",
      "Outward",
      "Top-out",
      "Bottom-out"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "ROLL FORM"
      ]
    }
  },
  {
    "key": "pmCartonLengthMm",
    "label": "Carton Length L (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Monocartons (5MXXXXX)"
      ]
    }
  },
  {
    "key": "pmCartonWidthMm",
    "label": "Carton Width W (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Monocartons (5MXXXXX)"
      ]
    }
  },
  {
    "key": "pmCartonHeightMm",
    "label": "Carton Height H (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Monocartons (5MXXXXX)"
      ]
    }
  },
  {
    "key": "glueFlapWidthMm",
    "label": "Glue Flap Width (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Monocartons (5MXXXXX)"
      ]
    }
  },
  {
    "key": "tuckLengthMm",
    "label": "Tuck Length (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "REVERSE TUCK END",
        "STRAIGHT TUCK END"
      ]
    }
  },
  {
    "key": "dustFlapLengthMm",
    "label": "Dust-flap Length (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "REVERSE TUCK END",
        "STRAIGHT TUCK END"
      ]
    }
  },
  {
    "key": "bottomLockType",
    "label": "Bottom Lock Type",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "1-2-3 Lock",
      "Crash Lock",
      "Auto Lock",
      "Glued"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "LOCK BOTTOM"
      ]
    }
  },
  {
    "key": "sleeveLayflatWidthMm",
    "label": "Sleeve Layflat Width (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SLEEVES"
      ]
    }
  },
  {
    "key": "sleeveCutLengthMm",
    "label": "Sleeve Cut Length (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SLEEVES"
      ]
    }
  },
  {
    "key": "shrinkRatioTdMd",
    "label": "Shrink Ratio % (TD/MD)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Shrink"
      ]
    }
  },
  {
    "key": "openLeafletSizeMm",
    "label": "Open Leaflet Size (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "LEAFLETS"
      ]
    }
  },
  {
    "key": "closedLeafletSizeMm",
    "label": "Closed Leaflet Size (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "LEAFLETS"
      ]
    }
  },
  {
    "key": "pageCount",
    "label": "Page Count",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Booklet",
        "Multi-fold"
      ]
    }
  },
  {
    "key": "foldPattern",
    "label": "Fold Pattern",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Z-fold",
      "Roll-fold",
      "Gate-fold",
      "Accordion",
      "French-fold"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "LEAFLETS"
      ]
    }
  },
  {
    "key": "fitmentOuterDiameterMm",
    "label": "Fitment Outer Diameter (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "FITMENTS"
      ]
    }
  },
  {
    "key": "fitmentInsertDepthMm",
    "label": "Fitment Insert Depth (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "FITMENTS"
      ]
    }
  },
  {
    "key": "stickerDiameterMm",
    "label": "Sticker Diameter (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Round"
      ]
    }
  },
  {
    "key": "stickerLengthWidthMm",
    "label": "Sticker Length × Width (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Square",
        "Custom"
      ]
    }
  },
  {
    "key": "qrCardSizeMm",
    "label": "QR Card Size (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "QR CARDS"
      ]
    }
  },
  {
    "key": "qrModuleResolutionDpi",
    "label": "QR Module Resolution (dpi)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "QR CARDS"
      ]
    }
  },
  {
    "key": "shipperLengthWidthHeightMm",
    "label": "Shipper Length × Width × Height (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__sub",
      "vals": [
        "SHIPPERS"
      ]
    }
  },
  {
    "key": "unitsPerShipper",
    "label": "Units per Shipper",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__sub",
      "vals": [
        "SHIPPERS"
      ]
    }
  },
  {
    "key": "palletSizeMm",
    "label": "Pallet Size (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__sub",
      "vals": [
        "PALLETS"
      ]
    }
  },
  {
    "key": "palletLoadCapacityKg",
    "label": "Pallet Load Capacity (kg)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "PALLETS"
      ]
    }
  },
  {
    "key": "filmRollWidthMm",
    "label": "Film Roll Width (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "STRETCH FILM",
        "VOID FILL"
      ]
    }
  },
  {
    "key": "filmRollLengthM",
    "label": "Film Roll Length (m)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "STRETCH FILM",
        "VOID FILL"
      ]
    }
  },
  {
    "key": "tapeWidthMm",
    "label": "Tape Width (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "TAPE"
      ]
    }
  },
  {
    "key": "tapeLengthPerRollM",
    "label": "Tape Length per Roll (m)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "TAPE"
      ]
    }
  },
  {
    "key": "strapWidthMm",
    "label": "Strap Width (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "STRAPPING"
      ]
    }
  },
  {
    "key": "strapThicknessMm",
    "label": "Strap Thickness (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "STRAPPING"
      ]
    }
  },
  {
    "key": "lengthMm",
    "label": "Length (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "TPM — Ancillary (6AXXXXX)"
      ]
    }
  },
  {
    "key": "diameterWidthMm",
    "label": "Diameter / Width (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "TPM — Ancillary (6AXXXXX)"
      ]
    }
  },
  {
    "key": "bristleLengthMm",
    "label": "Bristle Length (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BRUSHES"
      ]
    }
  },
  {
    "key": "bristleDensity",
    "label": "Bristle Density",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BRUSHES"
      ]
    }
  },
  {
    "key": "spongeCellDensityPpi",
    "label": "Sponge Cell Density (PPI)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SPONGES"
      ]
    }
  },
  {
    "key": "desiccantSachetSizeMm",
    "label": "Desiccant Sachet Size (mm)",
    "module": "dimensions",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "DESICCANTS"
      ]
    }
  },
  {
    "key": "matBody",
    "label": "Material",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": true
  },
  {
    "key": "materialGradeStandard",
    "label": "Material Grade / Standard",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "polymerType",
    "label": "Polymer Type",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "PET",
      "rPET",
      "HDPE",
      "LDPE",
      "LLDPE",
      "PP",
      "PVC",
      "PETG",
      "ABS",
      "PMMA (Acrylic)",
      "SAN",
      "PS",
      "Bio-PE",
      "Bio-PET",
      "NA"
    ],
    "cond": {
      "on": "__cat",
      "vals": [
        "PPM — Primary (4XXXXX)"
      ]
    }
  },
  {
    "key": "resinSource",
    "label": "Resin Source",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Virgin",
      "PCR (Post-consumer recycled)",
      "PIR (Post-industrial)",
      "Bio-based",
      "Hybrid"
    ],
    "cond": {
      "on": "__cat",
      "vals": [
        "PPM — Primary (4XXXXX)"
      ]
    }
  },
  {
    "key": "pcrContent",
    "label": "PCR % Content",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "PPM — Primary (4XXXXX)"
      ]
    }
  },
  {
    "key": "densityGCm",
    "label": "Density (g/cm³)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "PPM — Primary (4XXXXX)"
      ]
    }
  },
  {
    "key": "mfiMfrG10min",
    "label": "MFI / MFR (g/10min)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "PPM — Primary (4XXXXX)"
      ]
    }
  },
  {
    "key": "ivIntrinsicViscosity",
    "label": "IV (Intrinsic Viscosity)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "PET",
        "rPET"
      ]
    }
  },
  {
    "key": "shoreHardness",
    "label": "Shore Hardness",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "PPM — Primary (4XXXXX)"
      ]
    }
  },
  {
    "key": "topLoadResistanceKg",
    "label": "Top Load Resistance (kg)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "JARS"
      ]
    }
  },
  {
    "key": "burstPressureResistanceKpa",
    "label": "Burst Pressure Resistance (kPa)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "PET",
        "HDPE",
        "rPET"
      ]
    }
  },
  {
    "key": "escrHours",
    "label": "ESCR Hours",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "HDPE",
        "LDPE",
        "LLDPE"
      ]
    }
  },
  {
    "key": "glassType",
    "label": "Glass Type",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Type I (Borosilicate)",
      "Type II (Treated soda lime)",
      "Type III (Soda lime)",
      "NA"
    ],
    "cond": {
      "on": "__subsub",
      "vals": [
        "Glass"
      ]
    }
  },
  {
    "key": "annealingClass",
    "label": "Annealing Class",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Glass"
      ]
    }
  },
  {
    "key": "hydrolyticResistanceClass",
    "label": "Hydrolytic Resistance Class",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Glass"
      ]
    }
  },
  {
    "key": "thermalShockResistanceTC",
    "label": "Thermal Shock Resistance (ΔT °C)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Glass"
      ]
    }
  },
  {
    "key": "aluminiumAlloy",
    "label": "Aluminium Alloy",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "1050",
      "1070",
      "3003",
      "5052",
      "Pure 99.5%",
      "Other"
    ],
    "cond": {
      "on": "__subsub",
      "vals": [
        "Aluminium"
      ]
    }
  },
  {
    "key": "internalCoatingType",
    "label": "Internal Coating Type",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Epoxy phenolic",
      "Polyester",
      "BPA-NI epoxy",
      "Polyamide",
      "None"
    ],
    "cond": {
      "on": "__subsub",
      "vals": [
        "Aluminium"
      ]
    }
  },
  {
    "key": "externalLacquer",
    "label": "External Lacquer",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Clear lacquer",
      "Coloured lacquer",
      "Anodised",
      "Painted",
      "None"
    ],
    "cond": {
      "on": "__subsub",
      "vals": [
        "Aluminium"
      ]
    }
  },
  {
    "key": "laminationStructure",
    "label": "Lamination Structure",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Laminate / ABL"
      ]
    }
  },
  {
    "key": "barrierLayerEvohFoilMet",
    "label": "Barrier Layer (EVOH/Foil/Met)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Laminate / ABL"
      ]
    }
  },
  {
    "key": "otrCcMDay",
    "label": "OTR cc/m²/day",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Laminate / ABL"
      ]
    }
  },
  {
    "key": "wvtrGMDay",
    "label": "WVTR g/m²/day",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Laminate / ABL"
      ]
    }
  },
  {
    "key": "pmmaOpticalClarity",
    "label": "PMMA Optical Clarity %",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__subsub",
      "vals": [
        "Acrylic"
      ]
    }
  },
  {
    "key": "substrate",
    "label": "Substrate",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "BOPP",
      "PET",
      "PVC",
      "PE",
      "Paper coated",
      "Paper uncoated",
      "Foil-paper",
      "Aluminium foil",
      "Synthetic"
    ],
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Labels (5LXXXXX)",
        "SPM — Other Secondary (5OXXXXX)"
      ]
    }
  },
  {
    "key": "substrateGsm",
    "label": "Substrate GSM",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Labels (5LXXXXX)",
        "SPM — Monocartons (5MXXXXX)",
        "SPM — Other Secondary (5OXXXXX)"
      ]
    }
  },
  {
    "key": "pmMaterialThicknessMicron",
    "label": "Substrate Thickness (microns)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Labels (5LXXXXX)",
        "SPM — Other Secondary (5OXXXXX)"
      ]
    }
  },
  {
    "key": "adhesiveType",
    "label": "Adhesive Type",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Permanent acrylic",
      "Removable",
      "Cold-glue",
      "Wet-glue",
      "Heat-activated",
      "UV cure"
    ],
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Labels (5LXXXXX)"
      ]
    }
  },
  {
    "key": "adhesiveTackG25mm",
    "label": "Adhesive Tack (g/25mm)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Labels (5LXXXXX)"
      ]
    }
  },
  {
    "key": "releaseLiner",
    "label": "Release Liner",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Glassine 60",
      "Glassine 80",
      "Kraft",
      "PET"
    ],
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Labels (5LXXXXX)"
      ]
    }
  },
  {
    "key": "pmBoardPaperType",
    "label": "Board Type",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": true,
    "options": [
      "FBB (Folding Box Board)",
      "SBS (Solid Bleached Sulphate)",
      "Duplex",
      "Triplex",
      "Kraft",
      "Art Card",
      "Recycled"
    ],
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Monocartons (5MXXXXX)"
      ]
    }
  },
  {
    "key": "pmGsm",
    "label": "Board GSM",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": true,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Monocartons (5MXXXXX)"
      ]
    }
  },
  {
    "key": "boardCaliperMm",
    "label": "Board Caliper (mm)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Monocartons (5MXXXXX)"
      ]
    }
  },
  {
    "key": "boardBurstingFactor",
    "label": "Board Bursting Factor",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Monocartons (5MXXXXX)"
      ]
    }
  },
  {
    "key": "coating",
    "label": "Coating",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "1-sided",
      "2-sided",
      "Aqueous",
      "UV",
      "None"
    ],
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Monocartons (5MXXXXX)"
      ]
    }
  },
  {
    "key": "sachetLaminateStructure",
    "label": "Sachet Laminate Structure",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SACHETS"
      ]
    }
  },
  {
    "key": "sachetFoilThicknessMicrons",
    "label": "Sachet Foil Thickness (microns)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SACHETS"
      ]
    }
  },
  {
    "key": "fluteType",
    "label": "Flute Type",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "A-flute",
      "B-flute",
      "C-flute",
      "E-flute",
      "BC-flute (double)",
      "EB-flute"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "SHIPPERS"
      ]
    }
  },
  {
    "key": "plies3Ply5Ply7Ply",
    "label": "Plies (3-ply/5-ply/7-ply)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "3-ply",
      "5-ply",
      "7-ply"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "SHIPPERS"
      ]
    }
  },
  {
    "key": "gsmPerLinerOutMidIn",
    "label": "GSM per Liner (out/mid/in)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SHIPPERS"
      ]
    }
  },
  {
    "key": "ectEdgeCrushTestKnM",
    "label": "ECT (Edge Crush Test) kN/m",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SHIPPERS"
      ]
    }
  },
  {
    "key": "bctBoxCompressionTestKg",
    "label": "BCT (Box Compression Test) kg",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SHIPPERS"
      ]
    }
  },
  {
    "key": "burstStrengthKpa",
    "label": "Burst Strength (kPa)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "SHIPPERS"
      ]
    }
  },
  {
    "key": "woodType",
    "label": "Wood Type",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Pine",
      "Hardwood",
      "Plywood",
      "HT (Heat Treated)",
      "ISPM-15"
    ],
    "cond": {
      "on": "__subsub",
      "vals": [
        "Wooden"
      ]
    }
  },
  {
    "key": "ispm15Stamp",
    "label": "ISPM-15 Stamp",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Yes",
      "No",
      "NA"
    ],
    "cond": {
      "on": "__subsub",
      "vals": [
        "Wooden"
      ]
    }
  },
  {
    "key": "palletMaterialType",
    "label": "Pallet Material Type",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "HDPE",
      "PP",
      "Recycled plastic",
      "Hybrid"
    ],
    "cond": {
      "on": "__subsub",
      "vals": [
        "Plastic"
      ]
    }
  },
  {
    "key": "filmThicknessMicrons",
    "label": "Film Thickness (microns)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "STRETCH FILM",
        "VOID FILL"
      ]
    }
  },
  {
    "key": "preStretch",
    "label": "Pre-stretch %",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "STRETCH FILM"
      ]
    }
  },
  {
    "key": "clingType",
    "label": "Cling Type",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "1-side",
      "2-sides",
      "None"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "STRETCH FILM"
      ]
    }
  },
  {
    "key": "tensileStrengthMpa",
    "label": "Tensile Strength (MPa)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "STRETCH FILM",
        "STRAPPING",
        "TAPE"
      ]
    }
  },
  {
    "key": "elongationBreak",
    "label": "Elongation @ Break %",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "STRETCH FILM",
        "STRAPPING"
      ]
    }
  },
  {
    "key": "backingMaterial",
    "label": "Backing Material",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "TAPE"
      ]
    }
  },
  {
    "key": "tapeAdhesion180PeelN25mm",
    "label": "Tape Adhesion 180° Peel (N/25mm)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "TAPE"
      ]
    }
  },
  {
    "key": "bristleMaterial",
    "label": "Bristle Material",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Nylon",
      "PBT",
      "PET",
      "Goat hair",
      "Boar bristle",
      "Synthetic taklon"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "BRUSHES"
      ]
    }
  },
  {
    "key": "spongeMaterial",
    "label": "Sponge Material",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Polyurethane",
      "Latex-free PU",
      "Konjac",
      "Cellulose",
      "Natural sea sponge"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "SPONGES"
      ]
    }
  },
  {
    "key": "wandTipStyle",
    "label": "Wand Tip Style",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Standard fibre",
      "Silicone",
      "Comb",
      "Custom"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "WANDS"
      ]
    }
  },
  {
    "key": "desiccantActivityWWAdsorption",
    "label": "Desiccant Activity (% w/w adsorption)",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "DESICCANTS"
      ]
    }
  },
  {
    "key": "desiccantIndicator",
    "label": "Desiccant Indicator",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "None",
      "Cobalt-free colour",
      "Humidity card"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "DESICCANTS"
      ]
    }
  },
  {
    "key": "storeLoc",
    "label": "Storage Condition",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": true,
    "options": [
      "Ambient - Dry",
      "Ambient - Cool",
      "Refrigerated",
      "Controlled (RH<60%)"
    ]
  },
  {
    "key": "regRecyclabilityCode",
    "label": "Recyclability Code",
    "module": "material",
    "moduleCode": "TECH",
    "type": "text",
    "required": false
  },
  {
    "key": "regFoodCosmeticCompliance",
    "label": "Food / Cosmetic-contact Safe",
    "module": "material",
    "moduleCode": "TECH",
    "type": "select",
    "required": false,
    "options": [
      "Yes",
      "No",
      "NA"
    ]
  },
  {
    "key": "colorType",
    "label": "Body / Component Colour",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false
  },
  {
    "key": "colorCode",
    "label": "Colour Code (Pantone / RAL)",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false
  },
  {
    "key": "transparencyLevel",
    "label": "Transparency Level",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "select",
    "required": false,
    "options": [
      "Transparent",
      "Translucent",
      "Semi-opaque",
      "Opaque",
      "Frosted"
    ],
    "cond": {
      "on": "__cat",
      "vals": [
        "PPM — Primary (4XXXXX)"
      ]
    }
  },
  {
    "key": "finish",
    "label": "Surface Finish",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "select",
    "required": false,
    "options": [
      "Gloss",
      "Matte",
      "Velvet",
      "Satin",
      "Soft-touch",
      "Mirror",
      "Sandblast"
    ]
  },
  {
    "key": "surfaceTexture",
    "label": "Surface Texture",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "select",
    "required": false,
    "options": [
      "Smooth",
      "Embossed",
      "Debossed",
      "Ribbed",
      "Knurled",
      "Textured"
    ]
  },
  {
    "key": "pmShoulderColour",
    "label": "Shoulder Colour",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "TUBES"
      ]
    }
  },
  {
    "key": "pmCapOvercapColour",
    "label": "Cap / Overcap Colour",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "BOTTLES",
        "TUBES",
        "JARS",
        "CAPS",
        "LIDS",
        "PUMPS",
        "DROPPERS"
      ]
    }
  },
  {
    "key": "pmActuatorColourStyle",
    "label": "Actuator Colour & Style",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "PUMPS",
        "DROPPERS"
      ]
    }
  },
  {
    "key": "pmCollarFinish",
    "label": "Collar Finish",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "select",
    "required": false,
    "options": [
      "Plastic",
      "Aluminium",
      "Matte",
      "Brushed"
    ],
    "cond": {
      "on": "__sub",
      "vals": [
        "PUMPS",
        "DROPPERS"
      ]
    }
  },
  {
    "key": "pmTeatColour",
    "label": "Teat Colour",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__sub",
      "vals": [
        "DROPPERS"
      ]
    }
  },
  {
    "key": "frostingType",
    "label": "Frosting Type",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "select",
    "required": false,
    "options": [
      "Outer frost",
      "Inner frost",
      "Acid-etched",
      "Sandblasted",
      "None"
    ],
    "cond": {
      "on": "__subsub",
      "vals": [
        "Glass",
        "Acrylic"
      ]
    }
  },
  {
    "key": "decorationMethod",
    "label": "Decoration Method",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "select",
    "required": false,
    "options": [
      "None",
      "Silk-screen",
      "Pad printing",
      "UV digital",
      "Offset",
      "Flexo",
      "Gravure",
      "Hot stamp",
      "Cold foil",
      "Sleeve",
      "Decal",
      "In-mould labelling"
    ]
  },
  {
    "key": "numberOfColours",
    "label": "Number of Print Colours",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false
  },
  {
    "key": "printColours",
    "label": "Print Colours (CMYK / Pantone)",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false
  },
  {
    "key": "printCoverage",
    "label": "Print Coverage (%)",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false
  },
  {
    "key": "foilColour",
    "label": "Foil Colour",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false
  },
  {
    "key": "spotUvSpecialEffects",
    "label": "Spot UV / Special Effects",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false
  },
  {
    "key": "embossingDebossing",
    "label": "Embossing / Debossing Areas",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false
  },
  {
    "key": "pmLamination",
    "label": "Lamination",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "select",
    "required": false,
    "options": [
      "None",
      "Matte",
      "Gloss",
      "Soft-touch",
      "Spot UV",
      "Velvet"
    ],
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Labels (5LXXXXX)",
        "SPM — Monocartons (5MXXXXX)",
        "SPM — Other Secondary (5OXXXXX)"
      ]
    }
  },
  {
    "key": "metallisedEffect",
    "label": "Metallised Effect",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "select",
    "required": false,
    "options": [
      "None",
      "Hot foil",
      "Cold foil",
      "Metallised film",
      "Coated metal"
    ]
  },
  {
    "key": "premiumLookFeel",
    "label": "Premium Look & Feel",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "select",
    "required": false,
    "options": [
      "Standard",
      "Premium",
      "Super-premium",
      "Luxury"
    ]
  },
  {
    "key": "sustainabilityLookEcoClaim",
    "label": "Sustainability Look (eco-claim)",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "select",
    "required": false,
    "options": [
      "None",
      "Recycled look",
      "Natural / Kraft look",
      "Refillable indicator",
      "Carbon-neutral logo"
    ]
  },
  {
    "key": "artworkReferenceAwVersion",
    "label": "Artwork Reference / AW Version",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false
  },
  {
    "key": "dielineReference",
    "label": "Dieline Reference",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Monocartons (5MXXXXX)",
        "SPM — Other Secondary (5OXXXXX)"
      ]
    }
  },
  {
    "key": "images",
    "label": "Reference Image / Mockup",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false
  },
  {
    "key": "codingTemplateBatchMfgExpMrp",
    "label": "Coding Template (Batch/MFG/EXP/MRP)",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "text",
    "required": false,
    "cond": {
      "on": "__cat",
      "vals": [
        "PPM — Primary (4XXXXX)",
        "SPM — Labels (5LXXXXX)",
        "SPM — Monocartons (5MXXXXX)"
      ]
    }
  },
  {
    "key": "barcodeType",
    "label": "Barcode Type",
    "module": "aesthetics",
    "moduleCode": "ART",
    "type": "select",
    "required": false,
    "options": [
      "EAN-13",
      "UPC-A",
      "Code 128",
      "Code 39",
      "Data Matrix",
      "QR",
      "ITF-14"
    ],
    "cond": {
      "on": "__cat",
      "vals": [
        "SPM — Labels (5LXXXXX)",
        "SPM — Monocartons (5MXXXXX)"
      ]
    }
  },
  {
    "key": "arNumber",
    "label": "AR Number",
    "module": "quality",
    "moduleCode": "QUAL",
    "type": "text",
    "required": true
  },
  {
    "key": "qaQcTestPlanRef",
    "label": "QC Test Plan Reference",
    "module": "quality",
    "moduleCode": "QUAL",
    "type": "text",
    "required": false
  },
  {
    "key": "aqlSamplingPlan",
    "label": "AQL Sampling Plan",
    "module": "quality",
    "moduleCode": "QUAL",
    "type": "select",
    "required": true,
    "options": [
      "Level I",
      "Level II (Normal)",
      "Level III",
      "Tightened",
      "Reduced"
    ]
  },
  {
    "key": "qaCoaRequired",
    "label": "CoA from Vendor Required",
    "module": "quality",
    "moduleCode": "QUAL",
    "type": "select",
    "required": true,
    "options": [
      "Yes",
      "No"
    ]
  },
  {
    "key": "qcDecisionAuthority",
    "label": "QC Decision Authority",
    "module": "quality",
    "moduleCode": "QUAL",
    "type": "select",
    "required": true,
    "options": [
      "WH QC",
      "Plant QA",
      "Vendor Cert",
      "R&D"
    ]
  },
  {
    "key": "preferredVendor",
    "label": "Preferred Vendor",
    "module": "vendors",
    "moduleCode": "SRC",
    "type": "text",
    "required": true
  },
  {
    "key": "alternateVendor",
    "label": "Alternate Vendors",
    "module": "vendors",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  },
  {
    "key": "moqStandard",
    "label": "MOQ (Standard)",
    "module": "vendors",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  },
  {
    "key": "leadTimeDays",
    "label": "Lead Time (days)",
    "module": "vendors",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  },
  {
    "key": "standardUnitCost",
    "label": "Standard Unit Cost",
    "module": "vendors",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  },
  {
    "key": "currency",
    "label": "Currency",
    "module": "vendors",
    "moduleCode": "SRC",
    "type": "select",
    "required": false,
    "options": [
      "INR",
      "USD",
      "EUR",
      "GBP"
    ]
  },
  {
    "key": "printingPlateCostColourDevelopment",
    "label": "Printing Plate Cost / Colour Development",
    "module": "vendors",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  },
  {
    "key": "paymentTerms",
    "label": "Payment Terms",
    "module": "vendors",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  },
  {
    "key": "pmSupplyLocation",
    "label": "Supply Location",
    "module": "vendors",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  },
  {
    "key": "priceTiers",
    "label": "Price Tiers",
    "module": "vendors",
    "moduleCode": "SRC",
    "type": "textarea",
    "required": false
  },
  {
    "key": "priceValidityUntil",
    "label": "Price Validity (until)",
    "module": "vendors",
    "moduleCode": "SRC",
    "type": "text",
    "required": false
  }
];

export const PM_MASTER_FIELDS_BY_MODULE: Record<PmMasterModuleSlug, PmMasterFieldDef[]> = {
  "primary": [
    {
      "key": "itemCode",
      "label": "Material Code (SKU)",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "text",
      "required": false
    },
    {
      "key": "tradeCommercialName",
      "label": "PM Name / Description",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "text",
      "required": true
    },
    {
      "key": "pmAssemblyCode",
      "label": "Assembly / Component-set Code",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "PPM — Primary (4XXXXX)"
        ]
      }
    },
    {
      "key": "pmComponentBreakdown",
      "label": "Component breakdown",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "textarea",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "PPM — Primary (4XXXXX)"
        ]
      }
    },
    {
      "key": "pmSkuVolume",
      "label": "SKU Volume (ml/g)",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "PPM — Primary (4XXXXX)"
        ]
      }
    },
    {
      "key": "intendedUse",
      "label": "Intended Use",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "text",
      "required": true
    },
    {
      "key": "reusability",
      "label": "Reusability",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "select",
      "required": false,
      "options": [
        "Single-use",
        "Reusable",
        "Refillable"
      ]
    },
    {
      "key": "pmLifecycleStatus",
      "label": "Status",
      "module": "primary",
      "moduleCode": "PRIMARY",
      "type": "select",
      "required": true,
      "options": [
        "Active",
        "Inactive",
        "Discontinued",
        "Phase-out"
      ]
    }
  ],
  "units": [
    {
      "key": "pkgUnit",
      "label": "Primary UOM",
      "module": "units",
      "moduleCode": "UNITS",
      "type": "select",
      "required": true,
      "options": [
        "NOS",
        "PCS",
        "ROLL",
        "KG",
        "MTR",
        "SQM"
      ]
    },
    {
      "key": "pkgUnitsPerShipperRoll",
      "label": "Units per Shipper / Roll",
      "module": "units",
      "moduleCode": "UNITS",
      "type": "text",
      "required": false
    },
    {
      "key": "pkgHsn",
      "label": "HSN / SAC",
      "module": "units",
      "moduleCode": "UNITS",
      "type": "text",
      "required": true
    },
    {
      "key": "pkgGst",
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
  "dimensions": [
    {
      "key": "specNominal",
      "label": "Nominal Volume (ml)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS",
          "TUBES",
          "STICKS",
          "SACHETS"
        ]
      }
    },
    {
      "key": "specBrimful",
      "label": "Brimful Capacity (ml)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS"
        ]
      }
    },
    {
      "key": "overflowCapacityOfcMl",
      "label": "Overflow Capacity OFC (ml)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "STICKS"
        ]
      }
    },
    {
      "key": "pmOverallHeightMm",
      "label": "Total / Overall Height (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS",
          "TUBES",
          "STICKS",
          "PUMPS",
          "DROPPERS",
          "CAPS",
          "LIDS"
        ]
      }
    },
    {
      "key": "pmShoulderHeightMm",
      "label": "Body / Shoulder Height (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS"
        ]
      }
    },
    {
      "key": "pmOuterDiameterMm",
      "label": "Outer Body Diameter (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS",
          "TUBES",
          "STICKS",
          "CAPS",
          "LIDS",
          "PUMPS",
          "DROPPERS"
        ]
      }
    },
    {
      "key": "pmInnerDiameterNeckMm",
      "label": "Inner / Neck Diameter (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS",
          "TUBES",
          "PUMPS",
          "DROPPERS",
          "CAPS",
          "LIDS"
        ]
      }
    },
    {
      "key": "pmCircumferenceMm",
      "label": "Body Circumference (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS",
          "STICKS"
        ]
      }
    },
    {
      "key": "neckFinishStandard",
      "label": "Neck Finish Standard",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": true,
      "options": [
        "18/410",
        "20/410",
        "20/415",
        "22/400",
        "24/410",
        "24/415",
        "28/400",
        "28/410",
        "33/400",
        "33/410",
        "38/400",
        "43/400",
        "58/400",
        "custom"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS",
          "PUMPS",
          "DROPPERS",
          "CAPS",
          "LIDS"
        ]
      }
    },
    {
      "key": "neckHeightHMmTEHSpec",
      "label": "Neck Height H (mm) — T/E/H spec",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS",
          "CAPS",
          "LIDS"
        ]
      }
    },
    {
      "key": "threadMajorDiaTMm",
      "label": "Thread Major Dia T (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS",
          "CAPS",
          "LIDS"
        ]
      }
    },
    {
      "key": "insideBoreDiaIMm",
      "label": "Inside Bore Dia I (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS",
          "CAPS",
          "LIDS"
        ]
      }
    },
    {
      "key": "specWeight",
      "label": "Empty / Component Weight (g)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS",
          "TUBES",
          "STICKS",
          "CAPS",
          "LIDS"
        ]
      }
    },
    {
      "key": "wallThicknessSidewallMm",
      "label": "Wall Thickness — Sidewall (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS",
          "TUBES"
        ]
      }
    },
    {
      "key": "wallThicknessBaseMm",
      "label": "Wall Thickness — Base (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS"
        ]
      }
    },
    {
      "key": "baseType",
      "label": "Base Type",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Champagne",
        "Petaloid",
        "Flat",
        "Hemispherical",
        "Footed"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES"
        ]
      }
    },
    {
      "key": "headspaceAtFillMmMl",
      "label": "Headspace at fill (mm/ml)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS"
        ]
      }
    },
    {
      "key": "tubeLengthMm",
      "label": "Tube Length (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__sub",
        "vals": [
          "TUBES"
        ]
      }
    },
    {
      "key": "pmOrificeMm",
      "label": "Orifice Diameter (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__sub",
        "vals": [
          "TUBES",
          "DROPPERS",
          "PUMPS"
        ]
      }
    },
    {
      "key": "shoulderStyle",
      "label": "Shoulder Style",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Standard",
        "Slim",
        "Wide",
        "Custom"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "TUBES"
        ]
      }
    },
    {
      "key": "crimpEndWidthMm",
      "label": "Crimp / End Width (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "TUBES"
        ]
      }
    },
    {
      "key": "pmClosureType",
      "label": "Closure Type",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Screw",
        "Disc-top",
        "Flip-top",
        "Snap-on",
        "Friction-fit",
        "CR (push-turn)",
        "Press-on",
        "Heat seal",
        "NA"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "CAPS",
          "LIDS",
          "TUBES"
        ]
      }
    },
    {
      "key": "pmPumpCcDosage",
      "label": "Pump / Dropper Output per Stroke (ml)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "PUMPS",
          "DROPPERS"
        ]
      }
    },
    {
      "key": "primingStrokesCount",
      "label": "Priming Strokes (count)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "PUMPS"
        ]
      }
    },
    {
      "key": "dipTubeLengthMm",
      "label": "Dip Tube Length (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "PUMPS"
        ]
      }
    },
    {
      "key": "springMaterial",
      "label": "Spring Material",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Stainless Steel 304",
        "Stainless Steel 316",
        "PP Spring-less",
        "Other"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "PUMPS"
        ]
      }
    },
    {
      "key": "pmPipetteLengthMm",
      "label": "Pipette Length (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__sub",
        "vals": [
          "DROPPERS"
        ]
      }
    },
    {
      "key": "pipetteTipDiameterMm",
      "label": "Pipette Tip Diameter (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "DROPPERS"
        ]
      }
    },
    {
      "key": "teatMaterial",
      "label": "Teat Material",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Rubber",
        "Silicone",
        "TPE",
        "Latex-free"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "DROPPERS"
        ]
      }
    },
    {
      "key": "calibrationMarks",
      "label": "Calibration Marks",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Calibrated"
        ]
      }
    },
    {
      "key": "ballMaterial",
      "label": "Ball Material",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "PE",
        "PP",
        "Stainless Steel",
        "Glass",
        "Ceramic"
      ],
      "cond": {
        "on": "__subsub",
        "vals": [
          "Roll-on"
        ]
      }
    },
    {
      "key": "ballDiameterMm",
      "label": "Ball Diameter (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Roll-on"
        ]
      }
    },
    {
      "key": "pushUpMechanism",
      "label": "Push-up Mechanism",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Twist-up",
        "Slide-up",
        "Click-up",
        "Magnetic"
      ],
      "cond": {
        "on": "__subsub",
        "vals": [
          "Stick"
        ]
      }
    },
    {
      "key": "fillingHeightMm",
      "label": "Filling Height (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "STICKS"
        ]
      }
    },
    {
      "key": "sachetWidthMm",
      "label": "Sachet Width (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SACHETS"
        ]
      }
    },
    {
      "key": "sachetHeightMm",
      "label": "Sachet Height (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SACHETS"
        ]
      }
    },
    {
      "key": "pmFillVolumeMl",
      "label": "Fill Volume (ml/g)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SACHETS"
        ]
      }
    },
    {
      "key": "pmSealLaminateWidthMm",
      "label": "Seal / Laminate Width (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SACHETS"
        ]
      }
    },
    {
      "key": "tearNotch",
      "label": "Tear Notch",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Yes (V-notch)",
        "Yes (I-notch)",
        "Yes (laser)",
        "None"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "SACHETS"
        ]
      }
    },
    {
      "key": "labelWidthMm",
      "label": "Label Width (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Labels (5LXXXXX)"
        ]
      }
    },
    {
      "key": "labelHeightMm",
      "label": "Label Height (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Labels (5LXXXXX)"
        ]
      }
    },
    {
      "key": "sheetRollFormat",
      "label": "Sheet / Roll Format",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Sheet",
        "Roll"
      ],
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Labels (5LXXXXX)"
        ]
      }
    },
    {
      "key": "labelsPerSheet",
      "label": "Labels per Sheet",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SHEET FORM"
        ]
      }
    },
    {
      "key": "sheetSizeMm",
      "label": "Sheet Size (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SHEET FORM"
        ]
      }
    },
    {
      "key": "rollCoreInnerDiameterMm",
      "label": "Roll Core Inner Diameter (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "ROLL FORM"
        ]
      }
    },
    {
      "key": "rollOuterDiameterMm",
      "label": "Roll Outer Diameter (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "ROLL FORM"
        ]
      }
    },
    {
      "key": "labelsPerRoll",
      "label": "Labels per Roll",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "ROLL FORM"
        ]
      }
    },
    {
      "key": "rollDirection",
      "label": "Roll Direction",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Inward",
        "Outward",
        "Top-out",
        "Bottom-out"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "ROLL FORM"
        ]
      }
    },
    {
      "key": "pmCartonLengthMm",
      "label": "Carton Length L (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Monocartons (5MXXXXX)"
        ]
      }
    },
    {
      "key": "pmCartonWidthMm",
      "label": "Carton Width W (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Monocartons (5MXXXXX)"
        ]
      }
    },
    {
      "key": "pmCartonHeightMm",
      "label": "Carton Height H (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Monocartons (5MXXXXX)"
        ]
      }
    },
    {
      "key": "glueFlapWidthMm",
      "label": "Glue Flap Width (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Monocartons (5MXXXXX)"
        ]
      }
    },
    {
      "key": "tuckLengthMm",
      "label": "Tuck Length (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "REVERSE TUCK END",
          "STRAIGHT TUCK END"
        ]
      }
    },
    {
      "key": "dustFlapLengthMm",
      "label": "Dust-flap Length (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "REVERSE TUCK END",
          "STRAIGHT TUCK END"
        ]
      }
    },
    {
      "key": "bottomLockType",
      "label": "Bottom Lock Type",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "1-2-3 Lock",
        "Crash Lock",
        "Auto Lock",
        "Glued"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "LOCK BOTTOM"
        ]
      }
    },
    {
      "key": "sleeveLayflatWidthMm",
      "label": "Sleeve Layflat Width (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SLEEVES"
        ]
      }
    },
    {
      "key": "sleeveCutLengthMm",
      "label": "Sleeve Cut Length (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SLEEVES"
        ]
      }
    },
    {
      "key": "shrinkRatioTdMd",
      "label": "Shrink Ratio % (TD/MD)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Shrink"
        ]
      }
    },
    {
      "key": "openLeafletSizeMm",
      "label": "Open Leaflet Size (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "LEAFLETS"
        ]
      }
    },
    {
      "key": "closedLeafletSizeMm",
      "label": "Closed Leaflet Size (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "LEAFLETS"
        ]
      }
    },
    {
      "key": "pageCount",
      "label": "Page Count",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Booklet",
          "Multi-fold"
        ]
      }
    },
    {
      "key": "foldPattern",
      "label": "Fold Pattern",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Z-fold",
        "Roll-fold",
        "Gate-fold",
        "Accordion",
        "French-fold"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "LEAFLETS"
        ]
      }
    },
    {
      "key": "fitmentOuterDiameterMm",
      "label": "Fitment Outer Diameter (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "FITMENTS"
        ]
      }
    },
    {
      "key": "fitmentInsertDepthMm",
      "label": "Fitment Insert Depth (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "FITMENTS"
        ]
      }
    },
    {
      "key": "stickerDiameterMm",
      "label": "Sticker Diameter (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Round"
        ]
      }
    },
    {
      "key": "stickerLengthWidthMm",
      "label": "Sticker Length × Width (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Square",
          "Custom"
        ]
      }
    },
    {
      "key": "qrCardSizeMm",
      "label": "QR Card Size (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "QR CARDS"
        ]
      }
    },
    {
      "key": "qrModuleResolutionDpi",
      "label": "QR Module Resolution (dpi)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "QR CARDS"
        ]
      }
    },
    {
      "key": "shipperLengthWidthHeightMm",
      "label": "Shipper Length × Width × Height (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__sub",
        "vals": [
          "SHIPPERS"
        ]
      }
    },
    {
      "key": "unitsPerShipper",
      "label": "Units per Shipper",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__sub",
        "vals": [
          "SHIPPERS"
        ]
      }
    },
    {
      "key": "palletSizeMm",
      "label": "Pallet Size (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__sub",
        "vals": [
          "PALLETS"
        ]
      }
    },
    {
      "key": "palletLoadCapacityKg",
      "label": "Pallet Load Capacity (kg)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "PALLETS"
        ]
      }
    },
    {
      "key": "filmRollWidthMm",
      "label": "Film Roll Width (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "STRETCH FILM",
          "VOID FILL"
        ]
      }
    },
    {
      "key": "filmRollLengthM",
      "label": "Film Roll Length (m)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "STRETCH FILM",
          "VOID FILL"
        ]
      }
    },
    {
      "key": "tapeWidthMm",
      "label": "Tape Width (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "TAPE"
        ]
      }
    },
    {
      "key": "tapeLengthPerRollM",
      "label": "Tape Length per Roll (m)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "TAPE"
        ]
      }
    },
    {
      "key": "strapWidthMm",
      "label": "Strap Width (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "STRAPPING"
        ]
      }
    },
    {
      "key": "strapThicknessMm",
      "label": "Strap Thickness (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "STRAPPING"
        ]
      }
    },
    {
      "key": "lengthMm",
      "label": "Length (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "TPM — Ancillary (6AXXXXX)"
        ]
      }
    },
    {
      "key": "diameterWidthMm",
      "label": "Diameter / Width (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "TPM — Ancillary (6AXXXXX)"
        ]
      }
    },
    {
      "key": "bristleLengthMm",
      "label": "Bristle Length (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BRUSHES"
        ]
      }
    },
    {
      "key": "bristleDensity",
      "label": "Bristle Density",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BRUSHES"
        ]
      }
    },
    {
      "key": "spongeCellDensityPpi",
      "label": "Sponge Cell Density (PPI)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SPONGES"
        ]
      }
    },
    {
      "key": "desiccantSachetSizeMm",
      "label": "Desiccant Sachet Size (mm)",
      "module": "dimensions",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "DESICCANTS"
        ]
      }
    }
  ],
  "material": [
    {
      "key": "matBody",
      "label": "Material",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": true
    },
    {
      "key": "materialGradeStandard",
      "label": "Material Grade / Standard",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "polymerType",
      "label": "Polymer Type",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "PET",
        "rPET",
        "HDPE",
        "LDPE",
        "LLDPE",
        "PP",
        "PVC",
        "PETG",
        "ABS",
        "PMMA (Acrylic)",
        "SAN",
        "PS",
        "Bio-PE",
        "Bio-PET",
        "NA"
      ],
      "cond": {
        "on": "__cat",
        "vals": [
          "PPM — Primary (4XXXXX)"
        ]
      }
    },
    {
      "key": "resinSource",
      "label": "Resin Source",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Virgin",
        "PCR (Post-consumer recycled)",
        "PIR (Post-industrial)",
        "Bio-based",
        "Hybrid"
      ],
      "cond": {
        "on": "__cat",
        "vals": [
          "PPM — Primary (4XXXXX)"
        ]
      }
    },
    {
      "key": "pcrContent",
      "label": "PCR % Content",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "PPM — Primary (4XXXXX)"
        ]
      }
    },
    {
      "key": "densityGCm",
      "label": "Density (g/cm³)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "PPM — Primary (4XXXXX)"
        ]
      }
    },
    {
      "key": "mfiMfrG10min",
      "label": "MFI / MFR (g/10min)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "PPM — Primary (4XXXXX)"
        ]
      }
    },
    {
      "key": "ivIntrinsicViscosity",
      "label": "IV (Intrinsic Viscosity)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "PET",
          "rPET"
        ]
      }
    },
    {
      "key": "shoreHardness",
      "label": "Shore Hardness",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "PPM — Primary (4XXXXX)"
        ]
      }
    },
    {
      "key": "topLoadResistanceKg",
      "label": "Top Load Resistance (kg)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "JARS"
        ]
      }
    },
    {
      "key": "burstPressureResistanceKpa",
      "label": "Burst Pressure Resistance (kPa)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "PET",
          "HDPE",
          "rPET"
        ]
      }
    },
    {
      "key": "escrHours",
      "label": "ESCR Hours",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "HDPE",
          "LDPE",
          "LLDPE"
        ]
      }
    },
    {
      "key": "glassType",
      "label": "Glass Type",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Type I (Borosilicate)",
        "Type II (Treated soda lime)",
        "Type III (Soda lime)",
        "NA"
      ],
      "cond": {
        "on": "__subsub",
        "vals": [
          "Glass"
        ]
      }
    },
    {
      "key": "annealingClass",
      "label": "Annealing Class",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Glass"
        ]
      }
    },
    {
      "key": "hydrolyticResistanceClass",
      "label": "Hydrolytic Resistance Class",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Glass"
        ]
      }
    },
    {
      "key": "thermalShockResistanceTC",
      "label": "Thermal Shock Resistance (ΔT °C)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Glass"
        ]
      }
    },
    {
      "key": "aluminiumAlloy",
      "label": "Aluminium Alloy",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "1050",
        "1070",
        "3003",
        "5052",
        "Pure 99.5%",
        "Other"
      ],
      "cond": {
        "on": "__subsub",
        "vals": [
          "Aluminium"
        ]
      }
    },
    {
      "key": "internalCoatingType",
      "label": "Internal Coating Type",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Epoxy phenolic",
        "Polyester",
        "BPA-NI epoxy",
        "Polyamide",
        "None"
      ],
      "cond": {
        "on": "__subsub",
        "vals": [
          "Aluminium"
        ]
      }
    },
    {
      "key": "externalLacquer",
      "label": "External Lacquer",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Clear lacquer",
        "Coloured lacquer",
        "Anodised",
        "Painted",
        "None"
      ],
      "cond": {
        "on": "__subsub",
        "vals": [
          "Aluminium"
        ]
      }
    },
    {
      "key": "laminationStructure",
      "label": "Lamination Structure",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Laminate / ABL"
        ]
      }
    },
    {
      "key": "barrierLayerEvohFoilMet",
      "label": "Barrier Layer (EVOH/Foil/Met)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Laminate / ABL"
        ]
      }
    },
    {
      "key": "otrCcMDay",
      "label": "OTR cc/m²/day",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Laminate / ABL"
        ]
      }
    },
    {
      "key": "wvtrGMDay",
      "label": "WVTR g/m²/day",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Laminate / ABL"
        ]
      }
    },
    {
      "key": "pmmaOpticalClarity",
      "label": "PMMA Optical Clarity %",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__subsub",
        "vals": [
          "Acrylic"
        ]
      }
    },
    {
      "key": "substrate",
      "label": "Substrate",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "BOPP",
        "PET",
        "PVC",
        "PE",
        "Paper coated",
        "Paper uncoated",
        "Foil-paper",
        "Aluminium foil",
        "Synthetic"
      ],
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Labels (5LXXXXX)",
          "SPM — Other Secondary (5OXXXXX)"
        ]
      }
    },
    {
      "key": "substrateGsm",
      "label": "Substrate GSM",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Labels (5LXXXXX)",
          "SPM — Monocartons (5MXXXXX)",
          "SPM — Other Secondary (5OXXXXX)"
        ]
      }
    },
    {
      "key": "pmMaterialThicknessMicron",
      "label": "Substrate Thickness (microns)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Labels (5LXXXXX)",
          "SPM — Other Secondary (5OXXXXX)"
        ]
      }
    },
    {
      "key": "adhesiveType",
      "label": "Adhesive Type",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Permanent acrylic",
        "Removable",
        "Cold-glue",
        "Wet-glue",
        "Heat-activated",
        "UV cure"
      ],
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Labels (5LXXXXX)"
        ]
      }
    },
    {
      "key": "adhesiveTackG25mm",
      "label": "Adhesive Tack (g/25mm)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Labels (5LXXXXX)"
        ]
      }
    },
    {
      "key": "releaseLiner",
      "label": "Release Liner",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Glassine 60",
        "Glassine 80",
        "Kraft",
        "PET"
      ],
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Labels (5LXXXXX)"
        ]
      }
    },
    {
      "key": "pmBoardPaperType",
      "label": "Board Type",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": true,
      "options": [
        "FBB (Folding Box Board)",
        "SBS (Solid Bleached Sulphate)",
        "Duplex",
        "Triplex",
        "Kraft",
        "Art Card",
        "Recycled"
      ],
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Monocartons (5MXXXXX)"
        ]
      }
    },
    {
      "key": "pmGsm",
      "label": "Board GSM",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": true,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Monocartons (5MXXXXX)"
        ]
      }
    },
    {
      "key": "boardCaliperMm",
      "label": "Board Caliper (mm)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Monocartons (5MXXXXX)"
        ]
      }
    },
    {
      "key": "boardBurstingFactor",
      "label": "Board Bursting Factor",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Monocartons (5MXXXXX)"
        ]
      }
    },
    {
      "key": "coating",
      "label": "Coating",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "1-sided",
        "2-sided",
        "Aqueous",
        "UV",
        "None"
      ],
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Monocartons (5MXXXXX)"
        ]
      }
    },
    {
      "key": "sachetLaminateStructure",
      "label": "Sachet Laminate Structure",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SACHETS"
        ]
      }
    },
    {
      "key": "sachetFoilThicknessMicrons",
      "label": "Sachet Foil Thickness (microns)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SACHETS"
        ]
      }
    },
    {
      "key": "fluteType",
      "label": "Flute Type",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "A-flute",
        "B-flute",
        "C-flute",
        "E-flute",
        "BC-flute (double)",
        "EB-flute"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "SHIPPERS"
        ]
      }
    },
    {
      "key": "plies3Ply5Ply7Ply",
      "label": "Plies (3-ply/5-ply/7-ply)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "3-ply",
        "5-ply",
        "7-ply"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "SHIPPERS"
        ]
      }
    },
    {
      "key": "gsmPerLinerOutMidIn",
      "label": "GSM per Liner (out/mid/in)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SHIPPERS"
        ]
      }
    },
    {
      "key": "ectEdgeCrushTestKnM",
      "label": "ECT (Edge Crush Test) kN/m",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SHIPPERS"
        ]
      }
    },
    {
      "key": "bctBoxCompressionTestKg",
      "label": "BCT (Box Compression Test) kg",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SHIPPERS"
        ]
      }
    },
    {
      "key": "burstStrengthKpa",
      "label": "Burst Strength (kPa)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "SHIPPERS"
        ]
      }
    },
    {
      "key": "woodType",
      "label": "Wood Type",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Pine",
        "Hardwood",
        "Plywood",
        "HT (Heat Treated)",
        "ISPM-15"
      ],
      "cond": {
        "on": "__subsub",
        "vals": [
          "Wooden"
        ]
      }
    },
    {
      "key": "ispm15Stamp",
      "label": "ISPM-15 Stamp",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Yes",
        "No",
        "NA"
      ],
      "cond": {
        "on": "__subsub",
        "vals": [
          "Wooden"
        ]
      }
    },
    {
      "key": "palletMaterialType",
      "label": "Pallet Material Type",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "HDPE",
        "PP",
        "Recycled plastic",
        "Hybrid"
      ],
      "cond": {
        "on": "__subsub",
        "vals": [
          "Plastic"
        ]
      }
    },
    {
      "key": "filmThicknessMicrons",
      "label": "Film Thickness (microns)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "STRETCH FILM",
          "VOID FILL"
        ]
      }
    },
    {
      "key": "preStretch",
      "label": "Pre-stretch %",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "STRETCH FILM"
        ]
      }
    },
    {
      "key": "clingType",
      "label": "Cling Type",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "1-side",
        "2-sides",
        "None"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "STRETCH FILM"
        ]
      }
    },
    {
      "key": "tensileStrengthMpa",
      "label": "Tensile Strength (MPa)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "STRETCH FILM",
          "STRAPPING",
          "TAPE"
        ]
      }
    },
    {
      "key": "elongationBreak",
      "label": "Elongation @ Break %",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "STRETCH FILM",
          "STRAPPING"
        ]
      }
    },
    {
      "key": "backingMaterial",
      "label": "Backing Material",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "TAPE"
        ]
      }
    },
    {
      "key": "tapeAdhesion180PeelN25mm",
      "label": "Tape Adhesion 180° Peel (N/25mm)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "TAPE"
        ]
      }
    },
    {
      "key": "bristleMaterial",
      "label": "Bristle Material",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Nylon",
        "PBT",
        "PET",
        "Goat hair",
        "Boar bristle",
        "Synthetic taklon"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "BRUSHES"
        ]
      }
    },
    {
      "key": "spongeMaterial",
      "label": "Sponge Material",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Polyurethane",
        "Latex-free PU",
        "Konjac",
        "Cellulose",
        "Natural sea sponge"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "SPONGES"
        ]
      }
    },
    {
      "key": "wandTipStyle",
      "label": "Wand Tip Style",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Standard fibre",
        "Silicone",
        "Comb",
        "Custom"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "WANDS"
        ]
      }
    },
    {
      "key": "desiccantActivityWWAdsorption",
      "label": "Desiccant Activity (% w/w adsorption)",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "DESICCANTS"
        ]
      }
    },
    {
      "key": "desiccantIndicator",
      "label": "Desiccant Indicator",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "None",
        "Cobalt-free colour",
        "Humidity card"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "DESICCANTS"
        ]
      }
    },
    {
      "key": "storeLoc",
      "label": "Storage Condition",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": true,
      "options": [
        "Ambient - Dry",
        "Ambient - Cool",
        "Refrigerated",
        "Controlled (RH<60%)"
      ]
    },
    {
      "key": "regRecyclabilityCode",
      "label": "Recyclability Code",
      "module": "material",
      "moduleCode": "TECH",
      "type": "text",
      "required": false
    },
    {
      "key": "regFoodCosmeticCompliance",
      "label": "Food / Cosmetic-contact Safe",
      "module": "material",
      "moduleCode": "TECH",
      "type": "select",
      "required": false,
      "options": [
        "Yes",
        "No",
        "NA"
      ]
    }
  ],
  "aesthetics": [
    {
      "key": "colorType",
      "label": "Body / Component Colour",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false
    },
    {
      "key": "colorCode",
      "label": "Colour Code (Pantone / RAL)",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false
    },
    {
      "key": "transparencyLevel",
      "label": "Transparency Level",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "select",
      "required": false,
      "options": [
        "Transparent",
        "Translucent",
        "Semi-opaque",
        "Opaque",
        "Frosted"
      ],
      "cond": {
        "on": "__cat",
        "vals": [
          "PPM — Primary (4XXXXX)"
        ]
      }
    },
    {
      "key": "finish",
      "label": "Surface Finish",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "select",
      "required": false,
      "options": [
        "Gloss",
        "Matte",
        "Velvet",
        "Satin",
        "Soft-touch",
        "Mirror",
        "Sandblast"
      ]
    },
    {
      "key": "surfaceTexture",
      "label": "Surface Texture",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "select",
      "required": false,
      "options": [
        "Smooth",
        "Embossed",
        "Debossed",
        "Ribbed",
        "Knurled",
        "Textured"
      ]
    },
    {
      "key": "pmShoulderColour",
      "label": "Shoulder Colour",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "TUBES"
        ]
      }
    },
    {
      "key": "pmCapOvercapColour",
      "label": "Cap / Overcap Colour",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "BOTTLES",
          "TUBES",
          "JARS",
          "CAPS",
          "LIDS",
          "PUMPS",
          "DROPPERS"
        ]
      }
    },
    {
      "key": "pmActuatorColourStyle",
      "label": "Actuator Colour & Style",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "PUMPS",
          "DROPPERS"
        ]
      }
    },
    {
      "key": "pmCollarFinish",
      "label": "Collar Finish",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "select",
      "required": false,
      "options": [
        "Plastic",
        "Aluminium",
        "Matte",
        "Brushed"
      ],
      "cond": {
        "on": "__sub",
        "vals": [
          "PUMPS",
          "DROPPERS"
        ]
      }
    },
    {
      "key": "pmTeatColour",
      "label": "Teat Colour",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__sub",
        "vals": [
          "DROPPERS"
        ]
      }
    },
    {
      "key": "frostingType",
      "label": "Frosting Type",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "select",
      "required": false,
      "options": [
        "Outer frost",
        "Inner frost",
        "Acid-etched",
        "Sandblasted",
        "None"
      ],
      "cond": {
        "on": "__subsub",
        "vals": [
          "Glass",
          "Acrylic"
        ]
      }
    },
    {
      "key": "decorationMethod",
      "label": "Decoration Method",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "select",
      "required": false,
      "options": [
        "None",
        "Silk-screen",
        "Pad printing",
        "UV digital",
        "Offset",
        "Flexo",
        "Gravure",
        "Hot stamp",
        "Cold foil",
        "Sleeve",
        "Decal",
        "In-mould labelling"
      ]
    },
    {
      "key": "numberOfColours",
      "label": "Number of Print Colours",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false
    },
    {
      "key": "printColours",
      "label": "Print Colours (CMYK / Pantone)",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false
    },
    {
      "key": "printCoverage",
      "label": "Print Coverage (%)",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false
    },
    {
      "key": "foilColour",
      "label": "Foil Colour",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false
    },
    {
      "key": "spotUvSpecialEffects",
      "label": "Spot UV / Special Effects",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false
    },
    {
      "key": "embossingDebossing",
      "label": "Embossing / Debossing Areas",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false
    },
    {
      "key": "pmLamination",
      "label": "Lamination",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "select",
      "required": false,
      "options": [
        "None",
        "Matte",
        "Gloss",
        "Soft-touch",
        "Spot UV",
        "Velvet"
      ],
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Labels (5LXXXXX)",
          "SPM — Monocartons (5MXXXXX)",
          "SPM — Other Secondary (5OXXXXX)"
        ]
      }
    },
    {
      "key": "metallisedEffect",
      "label": "Metallised Effect",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "select",
      "required": false,
      "options": [
        "None",
        "Hot foil",
        "Cold foil",
        "Metallised film",
        "Coated metal"
      ]
    },
    {
      "key": "premiumLookFeel",
      "label": "Premium Look & Feel",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "select",
      "required": false,
      "options": [
        "Standard",
        "Premium",
        "Super-premium",
        "Luxury"
      ]
    },
    {
      "key": "sustainabilityLookEcoClaim",
      "label": "Sustainability Look (eco-claim)",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "select",
      "required": false,
      "options": [
        "None",
        "Recycled look",
        "Natural / Kraft look",
        "Refillable indicator",
        "Carbon-neutral logo"
      ]
    },
    {
      "key": "artworkReferenceAwVersion",
      "label": "Artwork Reference / AW Version",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false
    },
    {
      "key": "dielineReference",
      "label": "Dieline Reference",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Monocartons (5MXXXXX)",
          "SPM — Other Secondary (5OXXXXX)"
        ]
      }
    },
    {
      "key": "images",
      "label": "Reference Image / Mockup",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false
    },
    {
      "key": "codingTemplateBatchMfgExpMrp",
      "label": "Coding Template (Batch/MFG/EXP/MRP)",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "text",
      "required": false,
      "cond": {
        "on": "__cat",
        "vals": [
          "PPM — Primary (4XXXXX)",
          "SPM — Labels (5LXXXXX)",
          "SPM — Monocartons (5MXXXXX)"
        ]
      }
    },
    {
      "key": "barcodeType",
      "label": "Barcode Type",
      "module": "aesthetics",
      "moduleCode": "ART",
      "type": "select",
      "required": false,
      "options": [
        "EAN-13",
        "UPC-A",
        "Code 128",
        "Code 39",
        "Data Matrix",
        "QR",
        "ITF-14"
      ],
      "cond": {
        "on": "__cat",
        "vals": [
          "SPM — Labels (5LXXXXX)",
          "SPM — Monocartons (5MXXXXX)"
        ]
      }
    }
  ],
  "quality": [
    {
      "key": "arNumber",
      "label": "AR Number",
      "module": "quality",
      "moduleCode": "QUAL",
      "type": "text",
      "required": true
    },
    {
      "key": "qaQcTestPlanRef",
      "label": "QC Test Plan Reference",
      "module": "quality",
      "moduleCode": "QUAL",
      "type": "text",
      "required": false
    },
    {
      "key": "aqlSamplingPlan",
      "label": "AQL Sampling Plan",
      "module": "quality",
      "moduleCode": "QUAL",
      "type": "select",
      "required": true,
      "options": [
        "Level I",
        "Level II (Normal)",
        "Level III",
        "Tightened",
        "Reduced"
      ]
    },
    {
      "key": "qaCoaRequired",
      "label": "CoA from Vendor Required",
      "module": "quality",
      "moduleCode": "QUAL",
      "type": "select",
      "required": true,
      "options": [
        "Yes",
        "No"
      ]
    },
    {
      "key": "qcDecisionAuthority",
      "label": "QC Decision Authority",
      "module": "quality",
      "moduleCode": "QUAL",
      "type": "select",
      "required": true,
      "options": [
        "WH QC",
        "Plant QA",
        "Vendor Cert",
        "R&D"
      ]
    }
  ],
  "vendors": [
    {
      "key": "preferredVendor",
      "label": "Preferred Vendor",
      "module": "vendors",
      "moduleCode": "SRC",
      "type": "text",
      "required": true
    },
    {
      "key": "alternateVendor",
      "label": "Alternate Vendors",
      "module": "vendors",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    },
    {
      "key": "moqStandard",
      "label": "MOQ (Standard)",
      "module": "vendors",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    },
    {
      "key": "leadTimeDays",
      "label": "Lead Time (days)",
      "module": "vendors",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    },
    {
      "key": "standardUnitCost",
      "label": "Standard Unit Cost",
      "module": "vendors",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    },
    {
      "key": "currency",
      "label": "Currency",
      "module": "vendors",
      "moduleCode": "SRC",
      "type": "select",
      "required": false,
      "options": [
        "INR",
        "USD",
        "EUR",
        "GBP"
      ]
    },
    {
      "key": "printingPlateCostColourDevelopment",
      "label": "Printing Plate Cost / Colour Development",
      "module": "vendors",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    },
    {
      "key": "paymentTerms",
      "label": "Payment Terms",
      "module": "vendors",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    },
    {
      "key": "pmSupplyLocation",
      "label": "Supply Location",
      "module": "vendors",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    },
    {
      "key": "priceTiers",
      "label": "Price Tiers",
      "module": "vendors",
      "moduleCode": "SRC",
      "type": "textarea",
      "required": false
    },
    {
      "key": "priceValidityUntil",
      "label": "Price Validity (until)",
      "module": "vendors",
      "moduleCode": "SRC",
      "type": "text",
      "required": false
    }
  ]
} as Record<PmMasterModuleSlug, PmMasterFieldDef[]>;

/** Conditional visibility keys for PM scalar fields (from HTML cond rules). */
export const PM_SCALAR_FIELD_CONDITIONS = Object.fromEntries(
  PM_MASTER_FIELDS.filter((f): f is PmMasterFieldDef & { cond: EiFieldCond } => Boolean(f.cond)).map(
    (f) => [f.key, f.cond]
  )
) as Record<string, EiFieldCond>;

export const PM_MASTER_FIELD_KEYS = [
  "itemCode",
  "tradeCommercialName",
  "pmAssemblyCode",
  "pmComponentBreakdown",
  "pmSkuVolume",
  "intendedUse",
  "reusability",
  "pmLifecycleStatus",
  "pkgUnit",
  "pkgUnitsPerShipperRoll",
  "pkgHsn",
  "pkgGst",
  "specNominal",
  "specBrimful",
  "overflowCapacityOfcMl",
  "pmOverallHeightMm",
  "pmShoulderHeightMm",
  "pmOuterDiameterMm",
  "pmInnerDiameterNeckMm",
  "pmCircumferenceMm",
  "neckFinishStandard",
  "neckHeightHMmTEHSpec",
  "threadMajorDiaTMm",
  "insideBoreDiaIMm",
  "specWeight",
  "wallThicknessSidewallMm",
  "wallThicknessBaseMm",
  "baseType",
  "headspaceAtFillMmMl",
  "tubeLengthMm",
  "pmOrificeMm",
  "shoulderStyle",
  "crimpEndWidthMm",
  "pmClosureType",
  "pmPumpCcDosage",
  "primingStrokesCount",
  "dipTubeLengthMm",
  "springMaterial",
  "pmPipetteLengthMm",
  "pipetteTipDiameterMm",
  "teatMaterial",
  "calibrationMarks",
  "ballMaterial",
  "ballDiameterMm",
  "pushUpMechanism",
  "fillingHeightMm",
  "sachetWidthMm",
  "sachetHeightMm",
  "pmFillVolumeMl",
  "pmSealLaminateWidthMm",
  "tearNotch",
  "labelWidthMm",
  "labelHeightMm",
  "sheetRollFormat",
  "labelsPerSheet",
  "sheetSizeMm",
  "rollCoreInnerDiameterMm",
  "rollOuterDiameterMm",
  "labelsPerRoll",
  "rollDirection",
  "pmCartonLengthMm",
  "pmCartonWidthMm",
  "pmCartonHeightMm",
  "glueFlapWidthMm",
  "tuckLengthMm",
  "dustFlapLengthMm",
  "bottomLockType",
  "sleeveLayflatWidthMm",
  "sleeveCutLengthMm",
  "shrinkRatioTdMd",
  "openLeafletSizeMm",
  "closedLeafletSizeMm",
  "pageCount",
  "foldPattern",
  "fitmentOuterDiameterMm",
  "fitmentInsertDepthMm",
  "stickerDiameterMm",
  "stickerLengthWidthMm",
  "qrCardSizeMm",
  "qrModuleResolutionDpi",
  "shipperLengthWidthHeightMm",
  "unitsPerShipper",
  "palletSizeMm",
  "palletLoadCapacityKg",
  "filmRollWidthMm",
  "filmRollLengthM",
  "tapeWidthMm",
  "tapeLengthPerRollM",
  "strapWidthMm",
  "strapThicknessMm",
  "lengthMm",
  "diameterWidthMm",
  "bristleLengthMm",
  "bristleDensity",
  "spongeCellDensityPpi",
  "desiccantSachetSizeMm",
  "matBody",
  "materialGradeStandard",
  "polymerType",
  "resinSource",
  "pcrContent",
  "densityGCm",
  "mfiMfrG10min",
  "ivIntrinsicViscosity",
  "shoreHardness",
  "topLoadResistanceKg",
  "burstPressureResistanceKpa",
  "escrHours",
  "glassType",
  "annealingClass",
  "hydrolyticResistanceClass",
  "thermalShockResistanceTC",
  "aluminiumAlloy",
  "internalCoatingType",
  "externalLacquer",
  "laminationStructure",
  "barrierLayerEvohFoilMet",
  "otrCcMDay",
  "wvtrGMDay",
  "pmmaOpticalClarity",
  "substrate",
  "substrateGsm",
  "pmMaterialThicknessMicron",
  "adhesiveType",
  "adhesiveTackG25mm",
  "releaseLiner",
  "pmBoardPaperType",
  "pmGsm",
  "boardCaliperMm",
  "boardBurstingFactor",
  "coating",
  "sachetLaminateStructure",
  "sachetFoilThicknessMicrons",
  "fluteType",
  "plies3Ply5Ply7Ply",
  "gsmPerLinerOutMidIn",
  "ectEdgeCrushTestKnM",
  "bctBoxCompressionTestKg",
  "burstStrengthKpa",
  "woodType",
  "ispm15Stamp",
  "palletMaterialType",
  "filmThicknessMicrons",
  "preStretch",
  "clingType",
  "tensileStrengthMpa",
  "elongationBreak",
  "backingMaterial",
  "tapeAdhesion180PeelN25mm",
  "bristleMaterial",
  "spongeMaterial",
  "wandTipStyle",
  "desiccantActivityWWAdsorption",
  "desiccantIndicator",
  "storeLoc",
  "regRecyclabilityCode",
  "regFoodCosmeticCompliance",
  "colorType",
  "colorCode",
  "transparencyLevel",
  "finish",
  "surfaceTexture",
  "pmShoulderColour",
  "pmCapOvercapColour",
  "pmActuatorColourStyle",
  "pmCollarFinish",
  "pmTeatColour",
  "frostingType",
  "decorationMethod",
  "numberOfColours",
  "printColours",
  "printCoverage",
  "foilColour",
  "spotUvSpecialEffects",
  "embossingDebossing",
  "pmLamination",
  "metallisedEffect",
  "premiumLookFeel",
  "sustainabilityLookEcoClaim",
  "artworkReferenceAwVersion",
  "dielineReference",
  "images",
  "codingTemplateBatchMfgExpMrp",
  "barcodeType",
  "arNumber",
  "qaQcTestPlanRef",
  "aqlSamplingPlan",
  "qaCoaRequired",
  "qcDecisionAuthority",
  "preferredVendor",
  "alternateVendor",
  "moqStandard",
  "leadTimeDays",
  "standardUnitCost",
  "currency",
  "printingPlateCostColourDevelopment",
  "paymentTerms",
  "pmSupplyLocation",
  "priceTiers",
  "priceValidityUntil"
] as const;

export function pmFieldsForModule(slug: PmMasterModuleSlug): PmMasterFieldDef[] {
  return PM_MASTER_FIELDS_BY_MODULE[slug] ?? [];
}

export function emptyPmMasterScalarDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of PM_MASTER_FIELDS) out[f.key] = '';
  return out;
}
