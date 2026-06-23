// Generated from EI_FG_Clearance_Specs.html (PR bulk / FG / dispatch clearance sub-category templates).
// Regenerate: node scripts/generate-ei-fg-clearance-specs.mjs
import type { QualitySpecTableRow } from '../types/qualitySpecTable';

export type QualitySpecTemplate = Omit<QualitySpecTableRow, 'id'>;

/** Product types shown in EI_FG_Clearance_Specs.html (incl. empty Toner / Masque / Bath Bar). */
export const FG_CLEARANCE_PRODUCT_TYPES = [
  "Cream",
  "Lotion",
  "Serum",
  "Shampoo",
  "Sunscreen",
  "Toner",
  "Masque",
  "Bath Bar"
] as const;

/** HTML product type → PR `Category::SubCategory` path. */
export const FG_CLEARANCE_PRODUCT_TYPE_TO_PR_PATH: Record<string, string> = {
  "Cream": "Skin Care::Cream",
  "Lotion": "Skin Care::Lotion",
  "Serum": "Skin Care::Serum",
  "Shampoo": "Hair Care::Shampoo",
  "Sunscreen": "Skin Care::Sunscreen",
  "Toner": "Skin Care::Toner",
  "Masque": "Skin Care::Face Mask",
  "Bath Bar": "Cleansing::Bar Soap"
};

export const PR_BULK_CLEARANCE_SUB_BY_PATH: Record<string, readonly QualitySpecTemplate[]> = {
  "Skin Care::Cream": [
    {
      "parameter": "Appearance",
      "specLimit": "White homogeneous cream",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "White homogeneous cream",
      "frequency": "",
      "sample": "",
      "acceptance": "White homogeneous cream",
      "attachments": []
    },
    {
      "parameter": "Color (ΔE vs std)",
      "specLimit": "ΔE ≤ 2",
      "method": "Spectro",
      "mandatory": true,
      "tolerance": "≤ 2 ΔE",
      "frequency": "",
      "sample": "",
      "acceptance": "ΔE ≤ 2",
      "attachments": []
    },
    {
      "parameter": "pH (25°C)",
      "specLimit": "5.5–6.5",
      "method": "pH meter",
      "mandatory": true,
      "tolerance": "5.5–6.5 pH",
      "frequency": "",
      "sample": "",
      "acceptance": "5.5–6.5",
      "attachments": []
    },
    {
      "parameter": "Viscosity (Brookfield)",
      "specLimit": "35000–50000 cP",
      "method": "RVT spindle 4 @ 20rpm",
      "mandatory": true,
      "tolerance": "35000–50000 cP",
      "frequency": "",
      "sample": "",
      "acceptance": "35000–50000 cP",
      "attachments": []
    },
    {
      "parameter": "Specific Gravity",
      "specLimit": "0.98–1.02",
      "method": "Densitometer 25°C",
      "mandatory": true,
      "tolerance": "0.98–1.02 g/cm³",
      "frequency": "",
      "sample": "",
      "acceptance": "0.98–1.02",
      "attachments": []
    },
    {
      "parameter": "Active Assay (HPLC)",
      "specLimit": "≥ 95% of label claim",
      "method": "HPLC",
      "mandatory": true,
      "tolerance": "≥ 95 %",
      "frequency": "",
      "sample": "",
      "acceptance": "≥ 95% of label claim",
      "attachments": []
    },
    {
      "parameter": "TAMC",
      "specLimit": "≤ 100 CFU/g",
      "method": "USP <61>",
      "mandatory": true,
      "tolerance": "≤ 100 CFU/g",
      "frequency": "",
      "sample": "",
      "acceptance": "≤ 100 CFU/g",
      "attachments": []
    },
    {
      "parameter": "TYMC",
      "specLimit": "≤ 10 CFU/g",
      "method": "USP <61>",
      "mandatory": true,
      "tolerance": "≤ 10 CFU/g",
      "frequency": "",
      "sample": "",
      "acceptance": "≤ 10 CFU/g",
      "attachments": []
    },
    {
      "parameter": "Pathogens (Stap/Pseudo/E.coli/Candida)",
      "specLimit": "Absent",
      "method": "USP <62>",
      "mandatory": true,
      "tolerance": "Absent",
      "frequency": "",
      "sample": "",
      "acceptance": "Absent",
      "attachments": []
    },
    {
      "parameter": "Heavy Metals",
      "specLimit": "≤ 10 ppm (total)",
      "method": "ICP-MS",
      "mandatory": true,
      "tolerance": "≤ 10 ppm",
      "frequency": "",
      "sample": "",
      "acceptance": "≤ 10 ppm (total)",
      "attachments": []
    },
    {
      "parameter": "COA bulk batch",
      "specLimit": "COA prepared + signed",
      "method": "Doc",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    },
    {
      "parameter": "Retain sample drawn",
      "specLimit": "3 × 50g sealed + labeled",
      "method": "Sampling",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Stability sample drawn",
      "specLimit": "40°C/75%RH + 25°C set drawn",
      "method": "Sampling",
      "mandatory": false,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Bulk weight reconciliation",
      "specLimit": "≥ 98% of theoretical",
      "method": "Weigh + theoretical",
      "mandatory": true,
      "tolerance": "≥ 98 %",
      "frequency": "",
      "sample": "",
      "acceptance": "≥ 98% of theoretical",
      "attachments": []
    }
  ],
  "Skin Care::Lotion": [
    {
      "parameter": "Appearance",
      "specLimit": "Milky homogeneous lotion",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "Milky homogeneous lotion",
      "frequency": "",
      "sample": "",
      "acceptance": "Milky homogeneous lotion",
      "attachments": []
    },
    {
      "parameter": "pH",
      "specLimit": "5.5–6.5",
      "method": "pH meter",
      "mandatory": true,
      "tolerance": "5.5–6.5 pH",
      "frequency": "",
      "sample": "",
      "acceptance": "5.5–6.5",
      "attachments": []
    },
    {
      "parameter": "Viscosity",
      "specLimit": "8000–18000 cP",
      "method": "RVT spindle 3",
      "mandatory": true,
      "tolerance": "8000–18000 cP",
      "frequency": "",
      "sample": "",
      "acceptance": "8000–18000 cP",
      "attachments": []
    },
    {
      "parameter": "Active Assay",
      "specLimit": "≥ 95% of label claim",
      "method": "HPLC",
      "mandatory": true,
      "tolerance": "≥ 95 %",
      "frequency": "",
      "sample": "",
      "acceptance": "≥ 95% of label claim",
      "attachments": []
    },
    {
      "parameter": "TAMC",
      "specLimit": "≤ 100 CFU/g",
      "method": "USP <61>",
      "mandatory": true,
      "tolerance": "≤ 100 CFU/g",
      "frequency": "",
      "sample": "",
      "acceptance": "≤ 100 CFU/g",
      "attachments": []
    },
    {
      "parameter": "Pathogens",
      "specLimit": "Absent",
      "method": "USP <62>",
      "mandatory": true,
      "tolerance": "Absent",
      "frequency": "",
      "sample": "",
      "acceptance": "Absent",
      "attachments": []
    },
    {
      "parameter": "COA + Retain sample",
      "specLimit": "COA signed + 3 retains drawn",
      "method": "Doc + Sampling",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    }
  ],
  "Skin Care::Serum": [
    {
      "parameter": "Appearance",
      "specLimit": "Clear pale yellow viscous",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "Clear pale yellow viscous",
      "frequency": "",
      "sample": "",
      "acceptance": "Clear pale yellow viscous",
      "attachments": []
    },
    {
      "parameter": "pH",
      "specLimit": "5.0–6.0",
      "method": "pH meter",
      "mandatory": true,
      "tolerance": "5–6 pH",
      "frequency": "",
      "sample": "",
      "acceptance": "5.0–6.0",
      "attachments": []
    },
    {
      "parameter": "Viscosity",
      "specLimit": "3000–8000 cP",
      "method": "RVT spindle 2",
      "mandatory": true,
      "tolerance": "3000–8000 cP",
      "frequency": "",
      "sample": "",
      "acceptance": "3000–8000 cP",
      "attachments": []
    },
    {
      "parameter": "Active Assay (HPLC)",
      "specLimit": "≥ 95% of label claim",
      "method": "HPLC",
      "mandatory": true,
      "tolerance": "≥ 95 %",
      "frequency": "",
      "sample": "",
      "acceptance": "≥ 95% of label claim",
      "attachments": []
    },
    {
      "parameter": "Visual Particulate",
      "specLimit": "No particulates",
      "method": "Light box",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "PET (Microbial Challenge)",
      "specLimit": "Pass criteria A",
      "method": "ISO 11930",
      "mandatory": true,
      "tolerance": "Pass criteria A",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass criteria A",
      "attachments": []
    },
    {
      "parameter": "COA + Retain",
      "specLimit": "COA + 3 retains",
      "method": "Doc + Sampling",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    }
  ],
  "Hair Care::Shampoo": [
    {
      "parameter": "Appearance",
      "specLimit": "Clear / pearl viscous liquid",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "Clear / pearl viscous liquid",
      "frequency": "",
      "sample": "",
      "acceptance": "Clear / pearl viscous liquid",
      "attachments": []
    },
    {
      "parameter": "pH",
      "specLimit": "5.0–6.5",
      "method": "pH meter",
      "mandatory": true,
      "tolerance": "5–6.5 pH",
      "frequency": "",
      "sample": "",
      "acceptance": "5.0–6.5",
      "attachments": []
    },
    {
      "parameter": "Viscosity",
      "specLimit": "3500–6500 cP",
      "method": "RVT spindle 4",
      "mandatory": true,
      "tolerance": "3500–6500 cP",
      "frequency": "",
      "sample": "",
      "acceptance": "3500–6500 cP",
      "attachments": []
    },
    {
      "parameter": "Foam Volume (Ross-Miles)",
      "specLimit": "≥ 150 mm",
      "method": "Ross-Miles",
      "mandatory": false,
      "tolerance": "≥ 150 mm",
      "frequency": "",
      "sample": "",
      "acceptance": "≥ 150 mm",
      "attachments": []
    },
    {
      "parameter": "TAMC",
      "specLimit": "≤ 100 CFU/g",
      "method": "USP <61>",
      "mandatory": true,
      "tolerance": "≤ 100 CFU/g",
      "frequency": "",
      "sample": "",
      "acceptance": "≤ 100 CFU/g",
      "attachments": []
    },
    {
      "parameter": "COA + Retain",
      "specLimit": "COA + 3 retains",
      "method": "Doc + Sampling",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    }
  ],
  "Skin Care::Sunscreen": [
    {
      "parameter": "Appearance",
      "specLimit": "White homogeneous (mineral)",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "White homogeneous (mineral)",
      "frequency": "",
      "sample": "",
      "acceptance": "White homogeneous (mineral)",
      "attachments": []
    },
    {
      "parameter": "pH",
      "specLimit": "6.0–7.5",
      "method": "pH meter",
      "mandatory": true,
      "tolerance": "6–7.5 pH",
      "frequency": "",
      "sample": "",
      "acceptance": "6.0–7.5",
      "attachments": []
    },
    {
      "parameter": "Viscosity",
      "specLimit": "15000–25000 cP",
      "method": "RVT spindle 4",
      "mandatory": true,
      "tolerance": "15000–25000 cP",
      "frequency": "",
      "sample": "",
      "acceptance": "15000–25000 cP",
      "attachments": []
    },
    {
      "parameter": "In-vitro SPF (test patch)",
      "specLimit": "≥ 48 (labels SPF 50)",
      "method": "ISO 24443",
      "mandatory": true,
      "tolerance": "≥ 48 SPF",
      "frequency": "",
      "sample": "",
      "acceptance": "≥ 48 (labels SPF 50)",
      "attachments": []
    },
    {
      "parameter": "UV Filter Assay",
      "specLimit": "≥ 95% of label claim",
      "method": "HPLC",
      "mandatory": true,
      "tolerance": "≥ 95 %",
      "frequency": "",
      "sample": "",
      "acceptance": "≥ 95% of label claim",
      "attachments": []
    },
    {
      "parameter": "TAMC",
      "specLimit": "≤ 100 CFU/g",
      "method": "USP <61>",
      "mandatory": true,
      "tolerance": "≤ 100 CFU/g",
      "frequency": "",
      "sample": "",
      "acceptance": "≤ 100 CFU/g",
      "attachments": []
    },
    {
      "parameter": "Photo-stability sample",
      "specLimit": "Drawn for ICH Q1B",
      "method": "Sampling",
      "mandatory": false,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "COA + Retain",
      "specLimit": "COA + 3 retains",
      "method": "Doc + Sampling",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    }
  ]
};

export const PR_FINAL_CLEARANCE_SUB_BY_PATH: Record<string, readonly QualitySpecTemplate[]> = {
  "Skin Care::Cream": [
    {
      "parameter": "Net Weight",
      "specLimit": "50 g ± 1.5 g (±3%)",
      "method": "Calibrated scale (n=10)",
      "mandatory": true,
      "tolerance": "48.5–51.5 g",
      "frequency": "",
      "sample": "",
      "acceptance": "50 g ± 1.5 g (±3%)",
      "attachments": []
    },
    {
      "parameter": "Gross Weight (incl. jar+cap)",
      "specLimit": "78–82 g",
      "method": "Calibrated scale",
      "mandatory": true,
      "tolerance": "78–82 g",
      "frequency": "",
      "sample": "",
      "acceptance": "78–82 g",
      "attachments": []
    },
    {
      "parameter": "Tare Weight (empty pack)",
      "specLimit": "28 ± 1 g",
      "method": "Scale",
      "mandatory": false,
      "tolerance": "27–29 g",
      "frequency": "",
      "sample": "",
      "acceptance": "28 ± 1 g",
      "attachments": []
    },
    {
      "parameter": "Cap Torque",
      "specLimit": "8–12 in-lbs",
      "method": "Torque meter",
      "mandatory": true,
      "tolerance": "8–12 in-lbs",
      "frequency": "",
      "sample": "",
      "acceptance": "8–12 in-lbs",
      "attachments": []
    },
    {
      "parameter": "Components Present (jar+cap+wad+monocarton+leaflet)",
      "specLimit": "All 5 present",
      "method": "Visual check",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Label Print Quality",
      "specLimit": "Sharp, no smudge, all text legible",
      "method": "Visual + reference",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "MRP printed",
      "specLimit": "₹ matches commercial spec",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "₹",
      "frequency": "",
      "sample": "",
      "acceptance": "Contains ₹",
      "attachments": []
    },
    {
      "parameter": "Batch Number printed",
      "specLimit": "Matches BMR batch #",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "(BMR batch #)",
      "frequency": "",
      "sample": "",
      "acceptance": "(BMR batch #)",
      "attachments": []
    },
    {
      "parameter": "Manufacturing Date printed",
      "specLimit": "MFG: MM/YYYY format",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "MFG",
      "frequency": "",
      "sample": "",
      "acceptance": "Contains MFG",
      "attachments": []
    },
    {
      "parameter": "Expiry Date printed",
      "specLimit": "EXP: MM/YYYY (24 months from MFG)",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "EXP",
      "frequency": "",
      "sample": "",
      "acceptance": "Contains EXP",
      "attachments": []
    },
    {
      "parameter": "Barcode (1D/2D) scan",
      "specLimit": "First-scan pass",
      "method": "Scanner",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Hologram present",
      "specLimit": "Present + intact",
      "method": "Visual",
      "mandatory": false,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Leak Test (inverted 30 min)",
      "specLimit": "No leakage in 10 units",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "≤ 0 leaks",
      "frequency": "",
      "sample": "",
      "acceptance": "No leakage in 10 units",
      "attachments": []
    },
    {
      "parameter": "Visual cosmetic defects",
      "specLimit": "≤ 0 critical defects",
      "method": "AQL 1.0 critical",
      "mandatory": true,
      "tolerance": "≤ 0 defects",
      "frequency": "",
      "sample": "",
      "acceptance": "≤ 0 critical defects",
      "attachments": []
    },
    {
      "parameter": "Pack-level photo",
      "specLimit": "4 angles + label close-up",
      "method": "Camera",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    },
    {
      "parameter": "Retain sample (3 units)",
      "specLimit": "3 retained units sealed",
      "method": "Sampling",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Skin Care::Lotion": [
    {
      "parameter": "Net Volume",
      "specLimit": "250 ml ± 3% (242.5–257.5)",
      "method": "Scale (1g≈1ml for lotion)",
      "mandatory": true,
      "tolerance": "242.5–257.5 ml",
      "frequency": "",
      "sample": "",
      "acceptance": "250 ml ± 3% (242.5–257.5)",
      "attachments": []
    },
    {
      "parameter": "Gross Weight",
      "specLimit": "285–305 g",
      "method": "Scale",
      "mandatory": true,
      "tolerance": "285–305 g",
      "frequency": "",
      "sample": "",
      "acceptance": "285–305 g",
      "attachments": []
    },
    {
      "parameter": "Cap/Pump Torque",
      "specLimit": "10–15 in-lbs",
      "method": "Torque meter",
      "mandatory": true,
      "tolerance": "10–15 in-lbs",
      "frequency": "",
      "sample": "",
      "acceptance": "10–15 in-lbs",
      "attachments": []
    },
    {
      "parameter": "Pump Dispenses Liquid (5 strokes)",
      "specLimit": "Liquid out, no air",
      "method": "Trial",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Components Present",
      "specLimit": "Bottle + pump + cap + label + monocarton",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Label / MRP / Batch / MFG / EXP",
      "specLimit": "All 5 printed clearly",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Barcode scan",
      "specLimit": "First-scan pass",
      "method": "Scanner",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Leak Test",
      "specLimit": "No leak (10 units)",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "≤ 0 leaks",
      "frequency": "",
      "sample": "",
      "acceptance": "No leak (10 units)",
      "attachments": []
    },
    {
      "parameter": "Pack photo",
      "specLimit": "4 angles + label",
      "method": "Camera",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    },
    {
      "parameter": "Retain sample",
      "specLimit": "3 retained units",
      "method": "Sampling",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Skin Care::Serum": [
    {
      "parameter": "Net Volume",
      "specLimit": "30 ml ± 3% (29.1–30.9)",
      "method": "Scale + SG conversion",
      "mandatory": true,
      "tolerance": "29.1–30.9 ml",
      "frequency": "",
      "sample": "",
      "acceptance": "30 ml ± 3% (29.1–30.9)",
      "attachments": []
    },
    {
      "parameter": "Gross Weight",
      "specLimit": "48–52 g",
      "method": "Scale",
      "mandatory": true,
      "tolerance": "48–52 g",
      "frequency": "",
      "sample": "",
      "acceptance": "48–52 g",
      "attachments": []
    },
    {
      "parameter": "Dropper / Pump Function",
      "specLimit": "Smooth dispense",
      "method": "Trial 3 strokes",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Components Present",
      "specLimit": "Bottle + dropper/pump + label + monocarton",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Label / MRP / Batch / MFG / EXP",
      "specLimit": "All printed correctly",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Barcode",
      "specLimit": "Pass first scan",
      "method": "Scanner",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Leak / Drip",
      "specLimit": "0 leaks",
      "method": "Visual 30min inverted",
      "mandatory": true,
      "tolerance": "≤ 0 leaks",
      "frequency": "",
      "sample": "",
      "acceptance": "0 leaks",
      "attachments": []
    },
    {
      "parameter": "Pack photo",
      "specLimit": "4 angles + label close-up",
      "method": "Camera",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    },
    {
      "parameter": "Retain sample",
      "specLimit": "3 retained units",
      "method": "Sampling",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Hair Care::Shampoo": [
    {
      "parameter": "Net Volume",
      "specLimit": "200 ml ± 3%",
      "method": "Scale",
      "mandatory": true,
      "tolerance": "194–206 ml",
      "frequency": "",
      "sample": "",
      "acceptance": "200 ml ± 3%",
      "attachments": []
    },
    {
      "parameter": "Gross Weight",
      "specLimit": "232–250 g",
      "method": "Scale",
      "mandatory": true,
      "tolerance": "232–250 g",
      "frequency": "",
      "sample": "",
      "acceptance": "232–250 g",
      "attachments": []
    },
    {
      "parameter": "Cap Torque + leak",
      "specLimit": "Torque 10-15 in-lbs · 0 leaks",
      "method": "Torque + invert",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Components",
      "specLimit": "Bottle + cap + label + shrink + monocarton",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Label / MRP / Batch / MFG / EXP",
      "specLimit": "Per print spec",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Barcode",
      "specLimit": "Pass",
      "method": "Scanner",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Pack photo",
      "specLimit": "4 angles",
      "method": "Camera",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    }
  ],
  "Skin Care::Sunscreen": [
    {
      "parameter": "Net Weight",
      "specLimit": "50 g ± 1.5 g",
      "method": "Scale",
      "mandatory": true,
      "tolerance": "48.5–51.5 g",
      "frequency": "",
      "sample": "",
      "acceptance": "50 g ± 1.5 g",
      "attachments": []
    },
    {
      "parameter": "Gross Weight",
      "specLimit": "72–78 g",
      "method": "Scale",
      "mandatory": true,
      "tolerance": "72–78 g",
      "frequency": "",
      "sample": "",
      "acceptance": "72–78 g",
      "attachments": []
    },
    {
      "parameter": "SPF Claim on Label",
      "specLimit": "SPF 50 + PA+++ printed",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "SPF 50",
      "frequency": "",
      "sample": "",
      "acceptance": "Contains SPF 50",
      "attachments": []
    },
    {
      "parameter": "Components",
      "specLimit": "Tube + cap + label + monocarton",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "MRP / Batch / MFG / EXP",
      "specLimit": "All printed",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Barcode",
      "specLimit": "Pass",
      "method": "Scanner",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Pack photo",
      "specLimit": "4 angles + label",
      "method": "Camera",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    }
  ]
};

export const PR_DISPATCH_SUB_BY_PATH: Record<string, readonly QualitySpecTemplate[]> = {
  "Skin Care::Cream": [
    {
      "parameter": "Packs per Shipper",
      "specLimit": "48 units per shipper (5-ply)",
      "method": "Count",
      "mandatory": true,
      "tolerance": "= 48 units",
      "frequency": "",
      "sample": "",
      "acceptance": "48 units per shipper (5-ply)",
      "attachments": []
    },
    {
      "parameter": "Total Shippers in Dispatch",
      "specLimit": "Matches dispatch note qty",
      "method": "Count",
      "mandatory": true,
      "tolerance": "≥ 1 shippers",
      "frequency": "",
      "sample": "",
      "acceptance": "Matches dispatch note qty",
      "attachments": []
    },
    {
      "parameter": "Shipper Quality (5-ply CFB)",
      "specLimit": "No crush, no damp, glue intact",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Shipper Marking",
      "specLimit": "Brand + product + batch + qty + MFG + EXP + invoice ref",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Address Label / Consignee",
      "specLimit": "Correct + scannable barcode",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Stretch Wrap",
      "specLimit": "Tight + 3-cycle minimum",
      "method": "Visual",
      "mandatory": false,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Pallet Configuration",
      "specLimit": "48 shippers / pallet (4×4×3)",
      "method": "Count",
      "mandatory": false,
      "tolerance": "= 48 shippers/pallet",
      "frequency": "",
      "sample": "",
      "acceptance": "48 shippers / pallet (4×4×3)",
      "attachments": []
    },
    {
      "parameter": "Pallet Stability",
      "specLimit": "No tipping/slipping",
      "method": "Push test",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Loading Photos",
      "specLimit": "Loaded vehicle + pallet shots",
      "method": "Camera",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    },
    {
      "parameter": "Dispatch Note",
      "specLimit": "Signed by WH + Logistics",
      "method": "Doc",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    },
    {
      "parameter": "Vehicle / LR No",
      "specLimit": "Captured + photographed",
      "method": "Form",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    }
  ],
  "Skin Care::Lotion": [
    {
      "parameter": "Packs per Shipper",
      "specLimit": "24 units / shipper",
      "method": "Count",
      "mandatory": true,
      "tolerance": "= 24 units",
      "frequency": "",
      "sample": "",
      "acceptance": "24 units / shipper",
      "attachments": []
    },
    {
      "parameter": "Total Shippers",
      "specLimit": "Match dispatch qty",
      "method": "Count",
      "mandatory": true,
      "tolerance": "≥ 1 shippers",
      "frequency": "",
      "sample": "",
      "acceptance": "Match dispatch qty",
      "attachments": []
    },
    {
      "parameter": "Shipper Marking",
      "specLimit": "Brand + batch + qty + invoice",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Address Label",
      "specLimit": "Correct + barcoded",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Pallet stability",
      "specLimit": "No tipping",
      "method": "Push test",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Loading Photo",
      "specLimit": "Vehicle + pallets",
      "method": "Camera",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    },
    {
      "parameter": "Dispatch Note signed",
      "specLimit": "WH Head + Logistics",
      "method": "Doc",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    }
  ],
  "Skin Care::Serum": [
    {
      "parameter": "Packs per Shipper",
      "specLimit": "72 units / shipper (small SKU)",
      "method": "Count",
      "mandatory": true,
      "tolerance": "= 72 units",
      "frequency": "",
      "sample": "",
      "acceptance": "72 units / shipper (small SKU)",
      "attachments": []
    },
    {
      "parameter": "Total Shippers",
      "specLimit": "Match dispatch qty",
      "method": "Count",
      "mandatory": true,
      "tolerance": "≥ 1 shippers",
      "frequency": "",
      "sample": "",
      "acceptance": "Match dispatch qty",
      "attachments": []
    },
    {
      "parameter": "Shipper Marking",
      "specLimit": "Full marking present",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Fragile / Glass Marking",
      "specLimit": "⚠ \"FRAGILE\" + arrows printed",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Address Label",
      "specLimit": "Correct + barcoded",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Loading Photo",
      "specLimit": "4 angles",
      "method": "Camera",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    },
    {
      "parameter": "Dispatch Note",
      "specLimit": "Signed",
      "method": "Doc",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    }
  ],
  "Hair Care::Shampoo": [
    {
      "parameter": "Packs per Shipper",
      "specLimit": "12 units / shipper",
      "method": "Count",
      "mandatory": true,
      "tolerance": "= 12 units",
      "frequency": "",
      "sample": "",
      "acceptance": "12 units / shipper",
      "attachments": []
    },
    {
      "parameter": "Total Shippers",
      "specLimit": "Match dispatch qty",
      "method": "Count",
      "mandatory": true,
      "tolerance": "≥ 1 shippers",
      "frequency": "",
      "sample": "",
      "acceptance": "Match dispatch qty",
      "attachments": []
    },
    {
      "parameter": "Shipper Marking",
      "specLimit": "Brand + batch + qty + invoice",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Address + Barcode",
      "specLimit": "Pass first scan",
      "method": "Visual + Scanner",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Loading Photo",
      "specLimit": "2 angles",
      "method": "Camera",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    },
    {
      "parameter": "Dispatch Note",
      "specLimit": "Signed",
      "method": "Doc",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    }
  ],
  "Skin Care::Sunscreen": [
    {
      "parameter": "Packs per Shipper",
      "specLimit": "48 units / shipper",
      "method": "Count",
      "mandatory": true,
      "tolerance": "= 48 units",
      "frequency": "",
      "sample": "",
      "acceptance": "48 units / shipper",
      "attachments": []
    },
    {
      "parameter": "Total Shippers",
      "specLimit": "Match dispatch qty",
      "method": "Count",
      "mandatory": true,
      "tolerance": "≥ 1 shippers",
      "frequency": "",
      "sample": "",
      "acceptance": "Match dispatch qty",
      "attachments": []
    },
    {
      "parameter": "Temp-sensitive Marking",
      "specLimit": "\"STORE BELOW 30°C\" printed",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Shipper Marking",
      "specLimit": "Full marking present",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Address + Barcode",
      "specLimit": "Pass",
      "method": "Visual + Scanner",
      "mandatory": true,
      "tolerance": "true",
      "frequency": "",
      "sample": "",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Loading Photo",
      "specLimit": "4 angles + temp logger",
      "method": "Camera",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    },
    {
      "parameter": "Dispatch Note",
      "specLimit": "Signed",
      "method": "Doc",
      "mandatory": true,
      "tolerance": "",
      "frequency": "",
      "sample": "",
      "acceptance": "Attached",
      "attachments": []
    }
  ]
};
