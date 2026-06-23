// Generated from EI_Masters_QualityCheck.html (RM/PM GRN QC templates).
// Regenerate: node scripts/generate-ei-masters-quality-check-specs.mjs
import type { QualitySpecTableRow } from '../types/qualitySpecTable';

export type QualitySpecTemplate = Omit<QualitySpecTableRow, 'id'>;

export const RM_QC_COMMON_BY_CATEGORY: Record<string, readonly QualitySpecTemplate[]> = {
  "Surfactant": [
    {
      "parameter": "COA from Vendor",
      "specLimit": "Original / digitally signed",
      "method": "Document review",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "1 doc",
      "acceptance": "Signed, batch+mfg+exp present",
      "attachments": []
    },
    {
      "parameter": "INCI Name Match",
      "specLimit": "Matches PR + Master",
      "method": "Label vs Master",
      "mandatory": true,
      "tolerance": "Exact",
      "frequency": "Per lot",
      "sample": "Label",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Lot Traceability",
      "specLimit": "Unique lot No.",
      "method": "Visual on container + COA",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per container",
      "sample": "All",
      "acceptance": "Lot linked to COA",
      "attachments": []
    },
    {
      "parameter": "Mfg / Expiry Date",
      "specLimit": "≥ 12 months residual shelf life",
      "method": "COA + container print",
      "mandatory": true,
      "tolerance": "≥ 12 mo",
      "frequency": "Per lot",
      "sample": "All",
      "acceptance": "Exp ≥ today + 12 mo",
      "attachments": []
    },
    {
      "parameter": "Appearance",
      "specLimit": "Per Master",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "1 retain",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "pH (1% aq.)",
      "specLimit": "Per Master",
      "method": "pH meter @25°C",
      "mandatory": true,
      "tolerance": "±0.5",
      "frequency": "Per lot",
      "sample": "10g",
      "acceptance": "Within ±0.5",
      "attachments": []
    },
    {
      "parameter": "TAMC",
      "specLimit": "≤ 1000 CFU/g",
      "method": "USP <61>",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "TYMC",
      "specLimit": "≤ 100 CFU/g",
      "method": "USP <61>",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "E. coli / Salmonella",
      "specLimit": "Absent",
      "method": "USP <62>",
      "mandatory": true,
      "tolerance": "Absent",
      "frequency": "Per lot",
      "sample": "1g/10g",
      "acceptance": "Absent",
      "attachments": []
    },
    {
      "parameter": "Heavy Metals (Pb/As/Cd/Hg)",
      "specLimit": "Per IS 4707",
      "method": "ICP-MS / AAS",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per vendor / yearly",
      "sample": "2g",
      "acceptance": "≤ Limit",
      "attachments": []
    }
  ],
  "Aqua / Solvent": [
    {
      "parameter": "COA",
      "specLimit": "Per vendor",
      "method": "Doc review",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "1",
      "acceptance": "Signed",
      "attachments": []
    },
    {
      "parameter": "Appearance",
      "specLimit": "Clear, colorless",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "No turbidity",
      "frequency": "Per lot",
      "sample": "10mL",
      "acceptance": "Clear",
      "attachments": []
    },
    {
      "parameter": "pH",
      "specLimit": "Per Master",
      "method": "pH meter",
      "mandatory": true,
      "tolerance": "±0.3",
      "frequency": "Per lot",
      "sample": "10mL",
      "acceptance": "Within ±0.3",
      "attachments": []
    },
    {
      "parameter": "Conductivity",
      "specLimit": "Per Master",
      "method": "Conductivity meter",
      "mandatory": true,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "10mL",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "TAMC / TYMC",
      "specLimit": "≤ 10 / 1 CFU/mL",
      "method": "USP <61>",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "1mL",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Endotoxin (if pharma grade)",
      "specLimit": "≤ 0.25 EU/mL",
      "method": "LAL",
      "mandatory": false,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "1mL",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Active": [
    {
      "parameter": "COA + Vendor TDS",
      "specLimit": "Per Master",
      "method": "Doc review",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "1",
      "acceptance": "Signed",
      "attachments": []
    },
    {
      "parameter": "Appearance",
      "specLimit": "Per Master",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Assay / Purity",
      "specLimit": "Per Master",
      "method": "HPLC / Titration",
      "mandatory": true,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Loss on Drying",
      "specLimit": "Per Master (≤ 5% typical)",
      "method": "Oven @105°C",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "≤ Limit",
      "attachments": []
    },
    {
      "parameter": "Heavy Metals",
      "specLimit": "Per IS",
      "method": "ICP-MS",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "≤ Limit",
      "attachments": []
    },
    {
      "parameter": "Microbial (TAMC/TYMC/Pathogens)",
      "specLimit": "Per spec",
      "method": "USP <61>/<62>",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Polymer": [
    {
      "parameter": "COA",
      "specLimit": "Per vendor",
      "method": "Doc review",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "1",
      "acceptance": "Signed",
      "attachments": []
    },
    {
      "parameter": "Appearance",
      "specLimit": "White / off-white powder (typical)",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Bulk Density",
      "specLimit": "Per Master",
      "method": "Tapped density apparatus",
      "mandatory": false,
      "tolerance": "±10%",
      "frequency": "Per lot",
      "sample": "10g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Moisture / LOD",
      "specLimit": "≤ 6% (typical)",
      "method": "Karl Fischer / Oven",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "≤ Limit",
      "attachments": []
    },
    {
      "parameter": "Microbial",
      "specLimit": "Per Master",
      "method": "USP <61>/<62>",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Preservative": [
    {
      "parameter": "COA",
      "specLimit": "Per vendor",
      "method": "Doc review",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "1",
      "acceptance": "Signed",
      "attachments": []
    },
    {
      "parameter": "Assay",
      "specLimit": "≥ 99%",
      "method": "HPLC / GC",
      "mandatory": true,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "≥ 99%",
      "attachments": []
    },
    {
      "parameter": "Appearance",
      "specLimit": "Per Master",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Identity (FTIR / UV)",
      "specLimit": "Match reference",
      "method": "FTIR / UV scan",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Match",
      "attachments": []
    }
  ],
  "Excipient": [
    {
      "parameter": "COA",
      "specLimit": "Per vendor",
      "method": "Doc review",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "1",
      "acceptance": "Signed",
      "attachments": []
    },
    {
      "parameter": "Appearance",
      "specLimit": "Per Master",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Assay / Purity",
      "specLimit": "≥ Master",
      "method": "Titration / HPLC",
      "mandatory": true,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "≥ Spec",
      "attachments": []
    }
  ],
  "Fragrance": [
    {
      "parameter": "COA + IFRA Certificate",
      "specLimit": "IFRA-compliant for use category",
      "method": "Doc review",
      "mandatory": true,
      "tolerance": "IFRA OK",
      "frequency": "Per lot",
      "sample": "1 doc",
      "acceptance": "IFRA-compliant",
      "attachments": []
    },
    {
      "parameter": "Allergen Declaration (EU 26+)",
      "specLimit": "Per ingredient list",
      "method": "COA disclosure",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "1 doc",
      "acceptance": "Disclosed",
      "attachments": []
    },
    {
      "parameter": "Olfactory Match",
      "specLimit": "Matches reference standard",
      "method": "Panel evaluation",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "1mL",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Color",
      "specLimit": "Per Master",
      "method": "Visual / Gardner",
      "mandatory": false,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "5mL",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Specific Gravity",
      "specLimit": "Per Master",
      "method": "Pycnometer",
      "mandatory": false,
      "tolerance": "±0.02",
      "frequency": "Per lot",
      "sample": "5mL",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Refractive Index",
      "specLimit": "Per Master",
      "method": "Refractometer",
      "mandatory": false,
      "tolerance": "±0.002",
      "frequency": "Per lot",
      "sample": "5mL",
      "acceptance": "Within range",
      "attachments": []
    }
  ]
};

export const RM_QC_SUB_BY_PATH: Record<string, readonly QualitySpecTemplate[]> = {
  "Surfactant::Anionic": [
    {
      "parameter": "Active Matter (sulfate %)",
      "specLimit": "27–29% (SLES) / 28–32% (SLS)",
      "method": "Two-phase titration",
      "mandatory": true,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Free Oil",
      "specLimit": "≤ 0.5%",
      "method": "Solvent extraction",
      "mandatory": true,
      "tolerance": "≤ Spec",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "≤ 0.5%",
      "attachments": []
    },
    {
      "parameter": "1,4-Dioxane",
      "specLimit": "≤ 10 ppm (FDA / EU)",
      "method": "GC-MS",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per vendor / yearly",
      "sample": "5g",
      "acceptance": "≤ 10 ppm",
      "attachments": []
    },
    {
      "parameter": "Sulfate Content (inorganic)",
      "specLimit": "≤ 2.5%",
      "method": "BaCl2 titration",
      "mandatory": false,
      "tolerance": "≤ Spec",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "≤ 2.5%",
      "attachments": []
    },
    {
      "parameter": "Color (Hazen / APHA)",
      "specLimit": "≤ 50",
      "method": "Colorimeter",
      "mandatory": false,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "10mL",
      "acceptance": "≤ 50",
      "attachments": []
    }
  ],
  "Surfactant::Non-ionic": [
    {
      "parameter": "HLB Value",
      "specLimit": "Per Master",
      "method": "Calc from saponification",
      "mandatory": true,
      "tolerance": "±1",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "Within ±1",
      "attachments": []
    },
    {
      "parameter": "Cloud Point",
      "specLimit": "Per Master °C",
      "method": "Visual heating bath",
      "mandatory": false,
      "tolerance": "±2°C",
      "frequency": "Per lot",
      "sample": "10g",
      "acceptance": "Within ±2°C",
      "attachments": []
    },
    {
      "parameter": "Hydroxyl Value",
      "specLimit": "Per Master",
      "method": "Phthalic anhydride",
      "mandatory": false,
      "tolerance": "±5",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "Within ±5",
      "attachments": []
    },
    {
      "parameter": "Ethylene Oxide / 1,4-Dioxane",
      "specLimit": "≤ 10 ppm",
      "method": "GC-MS",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per vendor / yearly",
      "sample": "5g",
      "acceptance": "≤ 10 ppm",
      "attachments": []
    }
  ],
  "Surfactant::Amphoteric": [
    {
      "parameter": "Active Matter",
      "specLimit": "Per Master (30–35% for CAPB)",
      "method": "Two-phase titration",
      "mandatory": true,
      "tolerance": "±2%",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Free Amine (DMAPA)",
      "specLimit": "≤ 0.5 ppm",
      "method": "HPLC",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per vendor",
      "sample": "5g",
      "acceptance": "≤ Limit",
      "attachments": []
    },
    {
      "parameter": "NaCl",
      "specLimit": "≤ 7%",
      "method": "Titration",
      "mandatory": false,
      "tolerance": "≤ Spec",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "≤ 7%",
      "attachments": []
    }
  ],
  "Surfactant::Cationic": [
    {
      "parameter": "Active Matter (quaternary N)",
      "specLimit": "Per Master",
      "method": "Two-phase / Volhard",
      "mandatory": true,
      "tolerance": "±2%",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Free Amine",
      "specLimit": "≤ 0.1%",
      "method": "Titration",
      "mandatory": false,
      "tolerance": "≤ Spec",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "≤ 0.1%",
      "attachments": []
    },
    {
      "parameter": "Charge Density",
      "specLimit": "Per Master",
      "method": "Colloid titration",
      "mandatory": false,
      "tolerance": "±10%",
      "frequency": "Per vendor",
      "sample": "1g",
      "acceptance": "Within ±10%",
      "attachments": []
    }
  ],
  "Aqua / Solvent::Aqua": [
    {
      "parameter": "Total Organic Carbon (TOC)",
      "specLimit": "≤ 500 ppb",
      "method": "TOC analyzer",
      "mandatory": true,
      "tolerance": "≤ Spec",
      "frequency": "Per lot",
      "sample": "50mL",
      "acceptance": "≤ 500 ppb",
      "attachments": []
    },
    {
      "parameter": "Resistivity",
      "specLimit": "≥ 1 MΩ-cm",
      "method": "Resistivity meter",
      "mandatory": true,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "10mL",
      "acceptance": "≥ 1 MΩ",
      "attachments": []
    },
    {
      "parameter": "Heavy Metals",
      "specLimit": "≤ 0.1 ppm",
      "method": "ICP-MS",
      "mandatory": true,
      "tolerance": "≤ Spec",
      "frequency": "Per lot",
      "sample": "5mL",
      "acceptance": "≤ Limit",
      "attachments": []
    }
  ],
  "Aqua / Solvent::Glycerin": [
    {
      "parameter": "Assay (purity)",
      "specLimit": "≥ 99.5%",
      "method": "GC / Refractometric",
      "mandatory": true,
      "tolerance": "≥ 99.5%",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "≥ 99.5%",
      "attachments": []
    },
    {
      "parameter": "Diethylene Glycol / EG",
      "specLimit": "≤ 0.1%",
      "method": "GC-MS",
      "mandatory": true,
      "tolerance": "≤ 0.1%",
      "frequency": "Per vendor / yearly",
      "sample": "5g",
      "acceptance": "≤ 0.1%",
      "attachments": []
    },
    {
      "parameter": "Water Content",
      "specLimit": "≤ 0.5%",
      "method": "Karl Fischer",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "≤ 0.5%",
      "attachments": []
    }
  ],
  "Aqua / Solvent::Alcohol": [
    {
      "parameter": "Assay (Ethanol/IPA %)",
      "specLimit": "Per Master",
      "method": "GC",
      "mandatory": true,
      "tolerance": "±0.5%",
      "frequency": "Per lot",
      "sample": "2mL",
      "acceptance": "Within ±0.5%",
      "attachments": []
    },
    {
      "parameter": "Methanol",
      "specLimit": "≤ 200 ppm",
      "method": "GC-headspace",
      "mandatory": true,
      "tolerance": "≤ Spec",
      "frequency": "Per lot",
      "sample": "2mL",
      "acceptance": "≤ 200 ppm",
      "attachments": []
    },
    {
      "parameter": "Denaturant verification (if denatured)",
      "specLimit": "Per Master",
      "method": "GC / spectroscopy",
      "mandatory": false,
      "tolerance": "Match",
      "frequency": "Per vendor",
      "sample": "2mL",
      "acceptance": "Match",
      "attachments": []
    }
  ],
  "Aqua / Solvent::Glycol": [
    {
      "parameter": "Assay",
      "specLimit": "≥ 99%",
      "method": "GC",
      "mandatory": true,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Refractive Index",
      "specLimit": "Per Master",
      "method": "Refractometer @25°C",
      "mandatory": true,
      "tolerance": "±0.002",
      "frequency": "Per lot",
      "sample": "5mL",
      "acceptance": "Within range",
      "attachments": []
    }
  ],
  "Active::Vitamin": [
    {
      "parameter": "Potency (IU or %)",
      "specLimit": "≥ Label claim",
      "method": "HPLC",
      "mandatory": true,
      "tolerance": "90–110%",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Oxidative Stability",
      "specLimit": "≥ Spec",
      "method": "Rancimat / Peroxide value",
      "mandatory": false,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Tocopherol / Stabilizer Check",
      "specLimit": "Per Master",
      "method": "HPLC",
      "mandatory": false,
      "tolerance": "Per spec",
      "frequency": "Per vendor",
      "sample": "2g",
      "acceptance": "Present",
      "attachments": []
    }
  ],
  "Active::Botanical Extract": [
    {
      "parameter": "Botanical Identity",
      "specLimit": "Per Genus species",
      "method": "HPTLC / DNA barcoding",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "Verified species",
      "attachments": []
    },
    {
      "parameter": "Marker Compound",
      "specLimit": "Per Master (e.g. % aloin in aloe)",
      "method": "HPLC",
      "mandatory": true,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Pesticide Residues",
      "specLimit": "Per MRL",
      "method": "GC-MS / LC-MS",
      "mandatory": true,
      "tolerance": "≤ MRL",
      "frequency": "Per vendor / lot",
      "sample": "5g",
      "acceptance": "≤ MRL",
      "attachments": []
    },
    {
      "parameter": "Aflatoxin (B1+B2+G1+G2)",
      "specLimit": "≤ 20 ppb total",
      "method": "HPLC-FLD",
      "mandatory": false,
      "tolerance": "≤ Limit",
      "frequency": "Per vendor / yearly",
      "sample": "5g",
      "acceptance": "≤ Limit",
      "attachments": []
    },
    {
      "parameter": "Solvent (extraction)",
      "specLimit": "Per Master",
      "method": "GC-headspace",
      "mandatory": false,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "Within ICH Q3C",
      "attachments": []
    }
  ],
  "Active::Synthetic Active": [
    {
      "parameter": "Related Substances",
      "specLimit": "Per ICH / USP",
      "method": "HPLC",
      "mandatory": true,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within limits",
      "attachments": []
    },
    {
      "parameter": "Residual Solvents",
      "specLimit": "Per ICH Q3C",
      "method": "GC-headspace",
      "mandatory": true,
      "tolerance": "Per class",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within ICH",
      "attachments": []
    },
    {
      "parameter": "Crystal Form / Polymorph",
      "specLimit": "Per Master",
      "method": "XRD / DSC",
      "mandatory": false,
      "tolerance": "Match",
      "frequency": "Per vendor",
      "sample": "1g",
      "acceptance": "Match",
      "attachments": []
    }
  ],
  "Active::Peptide": [
    {
      "parameter": "Peptide Sequence",
      "specLimit": "Per Master",
      "method": "LC-MS",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "2mg",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Peptide Content (%)",
      "specLimit": "Per Master",
      "method": "Amino-acid analysis",
      "mandatory": true,
      "tolerance": "90–110%",
      "frequency": "Per lot",
      "sample": "2mg",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Trifluoroacetate (if SPPS)",
      "specLimit": "≤ 1.5%",
      "method": "Ion chromatography",
      "mandatory": false,
      "tolerance": "≤ Spec",
      "frequency": "Per lot",
      "sample": "2mg",
      "acceptance": "≤ 1.5%",
      "attachments": []
    }
  ],
  "Active::UV Filter": [
    {
      "parameter": "Assay",
      "specLimit": "≥ 98% (organic) / Per Master (inorganic)",
      "method": "HPLC / spectroscopy",
      "mandatory": true,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "UV Absorbance Spectrum",
      "specLimit": "λmax + ε per Master",
      "method": "UV-Vis spectrophotometer",
      "mandatory": true,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "10mg",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Particle Size (if mineral)",
      "specLimit": "Per Master (nm-µm)",
      "method": "Laser diffraction / DLS",
      "mandatory": true,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Coating Verification (TiO2/ZnO)",
      "specLimit": "Per Master",
      "method": "Elemental analysis",
      "mandatory": false,
      "tolerance": "Match",
      "frequency": "Per vendor",
      "sample": "2g",
      "acceptance": "Match",
      "attachments": []
    }
  ],
  "Polymer::Carbomer": [
    {
      "parameter": "Viscosity (0.5% neutralized)",
      "specLimit": "Per Master (cps)",
      "method": "Brookfield @25°C",
      "mandatory": true,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "500mL prep",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Residual Solvent (Benzene/EtAc)",
      "specLimit": "≤ 2 ppm (Benzene)",
      "method": "GC-headspace",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per vendor",
      "sample": "2g",
      "acceptance": "≤ Limit",
      "attachments": []
    },
    {
      "parameter": "pH (1% aq.)",
      "specLimit": "2.7–3.5",
      "method": "pH meter",
      "mandatory": true,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    }
  ],
  "Polymer::Cellulose Derivative": [
    {
      "parameter": "Viscosity (2% aq.)",
      "specLimit": "Per Master",
      "method": "Brookfield @25°C",
      "mandatory": true,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "250mL prep",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Methoxyl / Hydroxypropyl Content",
      "specLimit": "Per Master",
      "method": "GC / titration",
      "mandatory": false,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "pH (1% sol.)",
      "specLimit": "5.0–8.0",
      "method": "pH meter",
      "mandatory": true,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    }
  ],
  "Polymer::Xanthan / Gum": [
    {
      "parameter": "Viscosity (1% in 1% KCl)",
      "specLimit": "Per Master",
      "method": "Brookfield",
      "mandatory": true,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "250mL prep",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Pyruvic Acid (xanthan)",
      "specLimit": "≥ 1.5%",
      "method": "Titration",
      "mandatory": false,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "≥ 1.5%",
      "attachments": []
    },
    {
      "parameter": "Particle Size (mesh)",
      "specLimit": "Per Master",
      "method": "Sieve analysis",
      "mandatory": false,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "50g",
      "acceptance": "Within mesh",
      "attachments": []
    }
  ],
  "Preservative::Phenoxyethanol-type": [
    {
      "parameter": "Phenol Content",
      "specLimit": "≤ 0.05%",
      "method": "GC",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "≤ Limit",
      "attachments": []
    },
    {
      "parameter": "Water Content",
      "specLimit": "≤ 0.5%",
      "method": "Karl Fischer",
      "mandatory": false,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "≤ Limit",
      "attachments": []
    }
  ],
  "Preservative::Paraben-type": [
    {
      "parameter": "Related Esters",
      "specLimit": "Per USP/EP",
      "method": "HPLC",
      "mandatory": true,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within limits",
      "attachments": []
    },
    {
      "parameter": "Free Acid (PHB Acid)",
      "specLimit": "≤ 0.5%",
      "method": "HPLC / titration",
      "mandatory": false,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "≤ Limit",
      "attachments": []
    }
  ],
  "Preservative::Natural / Organic": [
    {
      "parameter": "Botanical/Source Identity",
      "specLimit": "Per Master",
      "method": "COA + HPTLC",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "Verified",
      "attachments": []
    },
    {
      "parameter": "Active Marker (e.g. ferulic / sorbic)",
      "specLimit": "Per Master %",
      "method": "HPLC",
      "mandatory": true,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "2g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "COSMOS / Ecocert (if claimed)",
      "specLimit": "Valid certificate",
      "method": "Doc review",
      "mandatory": false,
      "tolerance": "Valid",
      "frequency": "Per lot",
      "sample": "1 doc",
      "acceptance": "Valid",
      "attachments": []
    }
  ],
  "Excipient::pH Modifier": [
    {
      "parameter": "Active Content (NaOH/Citric%)",
      "specLimit": "Per Master",
      "method": "Acid-base titration",
      "mandatory": true,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Carbonate Content",
      "specLimit": "≤ Master",
      "method": "Titration",
      "mandatory": false,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "≤ Limit",
      "attachments": []
    }
  ],
  "Excipient::Chelator": [
    {
      "parameter": "EDTA / EDDS Content",
      "specLimit": "Per Master",
      "method": "Titration",
      "mandatory": true,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Iron Sequestration",
      "specLimit": "Per Master",
      "method": "Standard test",
      "mandatory": false,
      "tolerance": "Per spec",
      "frequency": "Per vendor",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    }
  ],
  "Excipient::Antioxidant": [
    {
      "parameter": "Active Content (e.g. BHT / Tocopherol)",
      "specLimit": "Per Master",
      "method": "HPLC / GC",
      "mandatory": true,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "1g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Peroxide Value",
      "specLimit": "Per Master",
      "method": "Iodometric",
      "mandatory": false,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "≤ Limit",
      "attachments": []
    }
  ],
  "Excipient::Emollient": [
    {
      "parameter": "Saponification Value",
      "specLimit": "Per Master",
      "method": "Titration",
      "mandatory": true,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Iodine Value",
      "specLimit": "Per Master",
      "method": "Wijs method",
      "mandatory": true,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Acid Value",
      "specLimit": "≤ Master",
      "method": "Titration",
      "mandatory": true,
      "tolerance": "≤ Limit",
      "frequency": "Per lot",
      "sample": "5g",
      "acceptance": "≤ Limit",
      "attachments": []
    },
    {
      "parameter": "Refractive Index",
      "specLimit": "Per Master",
      "method": "Refractometer",
      "mandatory": false,
      "tolerance": "±0.002",
      "frequency": "Per lot",
      "sample": "5mL",
      "acceptance": "Within range",
      "attachments": []
    }
  ],
  "Fragrance::Synthetic": [
    {
      "parameter": "GC-MS Fingerprint",
      "specLimit": "Match reference",
      "method": "GC-MS",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "1mL",
      "acceptance": "Match",
      "attachments": []
    }
  ],
  "Fragrance::Essential Oil": [
    {
      "parameter": "GC-MS Profile",
      "specLimit": "Marker peaks per Master",
      "method": "GC-MS",
      "mandatory": true,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "1mL",
      "acceptance": "Within profile",
      "attachments": []
    },
    {
      "parameter": "Optical Rotation",
      "specLimit": "Per Master",
      "method": "Polarimeter",
      "mandatory": false,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "5mL",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Geographical Origin",
      "specLimit": "Per Master",
      "method": "COA declaration",
      "mandatory": false,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "1 doc",
      "acceptance": "Declared",
      "attachments": []
    }
  ],
  "Fragrance::Masking": [
    {
      "parameter": "Functional Test (cover off-note)",
      "specLimit": "Pass panel evaluation",
      "method": "Sensory panel",
      "mandatory": true,
      "tolerance": "Pass",
      "frequency": "Per lot",
      "sample": "10mL",
      "acceptance": "Pass",
      "attachments": []
    }
  ]
};

export const PM_QC_COMMON_BY_CATEGORY: Record<string, readonly QualitySpecTemplate[]> = {
  "Primary Pack": [
    {
      "parameter": "COA from Vendor",
      "specLimit": "Signed",
      "method": "Doc review",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "1",
      "acceptance": "Signed",
      "attachments": []
    },
    {
      "parameter": "Visual Damage / Defect",
      "specLimit": "No cracks / dents / scratches",
      "method": "Visual @AQL 1.0 critical",
      "mandatory": true,
      "tolerance": "0 critical",
      "frequency": "Per lot",
      "sample": "AQL",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Cleanliness",
      "specLimit": "No particles / foreign matter",
      "method": "Visual + Air-blast",
      "mandatory": true,
      "tolerance": "0 contaminants",
      "frequency": "Per lot",
      "sample": "AQL",
      "acceptance": "Clean",
      "attachments": []
    },
    {
      "parameter": "Material Identity (HDPE/PET/PP/Glass)",
      "specLimit": "Per Master",
      "method": "COA + FTIR (random)",
      "mandatory": true,
      "tolerance": "Exact",
      "frequency": "Per vendor / quarterly",
      "sample": "1",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Color / Opacity Match",
      "specLimit": "Per artwork master",
      "method": "Visual + Spectrophotometer",
      "mandatory": true,
      "tolerance": "ΔE ≤ 3",
      "frequency": "Per lot",
      "sample": "5/lot",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Weight per Unit",
      "specLimit": "Per Master",
      "method": "Balance ±0.01g",
      "mandatory": true,
      "tolerance": "±5%",
      "frequency": "Per lot",
      "sample": "10/lot",
      "acceptance": "Within ±5%",
      "attachments": []
    },
    {
      "parameter": "Lot Marking Visible",
      "specLimit": "Vendor lot No. on carton",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "All cartons",
      "acceptance": "Visible",
      "attachments": []
    },
    {
      "parameter": "Leak Test (general)",
      "specLimit": "No leak under standard test for that pack format",
      "method": "Water inversion / Pressure decay / Vacuum / Dye penetration — per sub-cat method below",
      "mandatory": true,
      "tolerance": "0 leaks",
      "frequency": "Per lot",
      "sample": "AQL 1.0 (critical) / 2.5 (major)",
      "acceptance": "0 leaks",
      "attachments": []
    },
    {
      "parameter": "Closure Integrity Test (capped/sealed pack)",
      "specLimit": "No leak when capped + inverted 5 min",
      "method": "Capped + inversion @25°C",
      "mandatory": true,
      "tolerance": "0 leaks",
      "frequency": "Per lot",
      "sample": "10/lot",
      "acceptance": "0 leaks",
      "attachments": []
    }
  ],
  "Closures & Pumps": [
    {
      "parameter": "COA from Vendor",
      "specLimit": "Signed",
      "method": "Doc review",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "1",
      "acceptance": "Signed",
      "attachments": []
    },
    {
      "parameter": "Visual Defects",
      "specLimit": "No flash / short-shot / contamination",
      "method": "Visual @AQL",
      "mandatory": true,
      "tolerance": "0 critical",
      "frequency": "Per lot",
      "sample": "AQL",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Material Identity",
      "specLimit": "Per Master",
      "method": "COA + FTIR",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per vendor",
      "sample": "1",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Color Match",
      "specLimit": "Per Master ΔE ≤ 3",
      "method": "Visual + Spectro",
      "mandatory": true,
      "tolerance": "ΔE ≤ 3",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Compatibility with Bottle / Tube",
      "specLimit": "Snug fit, leak-proof",
      "method": "Manual fit + leak",
      "mandatory": true,
      "tolerance": "No leak",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "No leak",
      "attachments": []
    }
  ],
  "Secondary Pack": [
    {
      "parameter": "COA",
      "specLimit": "Per vendor",
      "method": "Doc review",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "1",
      "acceptance": "Signed",
      "attachments": []
    },
    {
      "parameter": "Artwork Match",
      "specLimit": "Matches approved artwork",
      "method": "Visual vs proof",
      "mandatory": true,
      "tolerance": "Exact",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Pantone / Color Accuracy",
      "specLimit": "ΔE ≤ 3",
      "method": "Spectrophotometer",
      "mandatory": true,
      "tolerance": "ΔE ≤ 3",
      "frequency": "Per lot",
      "sample": "3",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Text Legibility",
      "specLimit": "No missing letters / smudge",
      "method": "Visual + Magnifier",
      "mandatory": true,
      "tolerance": "100% legible",
      "frequency": "Per lot",
      "sample": "AQL",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Barcode Scan",
      "specLimit": "First-attempt scan",
      "method": "Barcode reader",
      "mandatory": true,
      "tolerance": "100%",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Tertiary Pack": [
    {
      "parameter": "COA",
      "specLimit": "Per vendor",
      "method": "Doc review",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "1",
      "acceptance": "Signed",
      "attachments": []
    },
    {
      "parameter": "Visual Inspection",
      "specLimit": "No damage",
      "method": "Visual @AQL",
      "mandatory": true,
      "tolerance": "0 critical",
      "frequency": "Per lot",
      "sample": "AQL",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Ancillary": [
    {
      "parameter": "COA",
      "specLimit": "Per vendor",
      "method": "Doc review",
      "mandatory": true,
      "tolerance": "—",
      "frequency": "Per lot",
      "sample": "1",
      "acceptance": "Signed",
      "attachments": []
    },
    {
      "parameter": "Visual",
      "specLimit": "No defects",
      "method": "Visual @AQL",
      "mandatory": true,
      "tolerance": "0 critical",
      "frequency": "Per lot",
      "sample": "AQL",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Food / Cosmetic Grade Cert",
      "specLimit": "If contacts product",
      "method": "Doc review",
      "mandatory": false,
      "tolerance": "Valid",
      "frequency": "Per vendor",
      "sample": "1 doc",
      "acceptance": "Valid",
      "attachments": []
    }
  ]
};

export const PM_QC_SUB_BY_PATH: Record<string, readonly QualitySpecTemplate[]> = {
  "Primary Pack::Bottle (PET/HDPE)": [
    {
      "parameter": "Height",
      "specLimit": "Per Master mm",
      "method": "Vernier caliper",
      "mandatory": true,
      "tolerance": "±0.5 mm",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Within tolerance",
      "attachments": []
    },
    {
      "parameter": "Body Diameter",
      "specLimit": "Per Master mm",
      "method": "Vernier caliper",
      "mandatory": true,
      "tolerance": "±0.3 mm",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Within tolerance",
      "attachments": []
    },
    {
      "parameter": "Neck Finish",
      "specLimit": "Per Master std (24/410, 28/415)",
      "method": "Plug gauge",
      "mandatory": true,
      "tolerance": "Std",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Match std",
      "attachments": []
    },
    {
      "parameter": "Wall Thickness",
      "specLimit": "Per Master mm",
      "method": "Magna-mike",
      "mandatory": true,
      "tolerance": "±0.05 mm",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Leak Test (water inversion)",
      "specLimit": "No leak after fill + cap + invert 5 min",
      "method": "Fill water to nominal capacity, seal with cap, invert 5 min @25°C",
      "mandatory": true,
      "tolerance": "0 leaks",
      "frequency": "Per lot",
      "sample": "10/lot",
      "acceptance": "0 leaks",
      "attachments": []
    },
    {
      "parameter": "Leak Test (pressure decay)",
      "specLimit": "≤ Master pressure drop in 10 sec",
      "method": "Cap + pressurize to 0.5 bar, monitor decay",
      "mandatory": false,
      "tolerance": "≤ Spec drop",
      "frequency": "Per vendor / quarter",
      "sample": "5/lot",
      "acceptance": "Within tolerance",
      "attachments": []
    },
    {
      "parameter": "Pin-hole / Micro-leak (vacuum)",
      "specLimit": "No leak under 200 mbar vacuum × 30 sec",
      "method": "Vacuum chamber + dye / bubble test",
      "mandatory": false,
      "tolerance": "0 leaks",
      "frequency": "Per vendor / quarter",
      "sample": "5/lot",
      "acceptance": "No bubbles",
      "attachments": []
    },
    {
      "parameter": "Drop Test",
      "specLimit": "Survives 75 cm × 3 axes",
      "method": "Drop test",
      "mandatory": false,
      "tolerance": "No break",
      "frequency": "Per vendor / quarter",
      "sample": "5",
      "acceptance": "No break",
      "attachments": []
    },
    {
      "parameter": "Top-load Compression",
      "specLimit": "Per Master (kgf)",
      "method": "Compression tester",
      "mandatory": false,
      "tolerance": "≥ Spec",
      "frequency": "Per vendor",
      "sample": "3",
      "acceptance": "≥ Spec",
      "attachments": []
    },
    {
      "parameter": "Stress-Crack Resistance (ESCR)",
      "specLimit": "≥ Master (hr)",
      "method": "ASTM D1693",
      "mandatory": false,
      "tolerance": "≥ Spec",
      "frequency": "Per vendor",
      "sample": "5",
      "acceptance": "≥ Spec",
      "attachments": []
    }
  ],
  "Primary Pack::Tube (Laminated)": [
    {
      "parameter": "Layer Structure",
      "specLimit": "Per Master (e.g. PE/EVOH/PE 5-ply)",
      "method": "Microtome + microscope",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per vendor",
      "sample": "3",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Ovality",
      "specLimit": "≤ 5%",
      "method": "Diameter X+Y axis",
      "mandatory": true,
      "tolerance": "≤ 5%",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "≤ 5%",
      "attachments": []
    },
    {
      "parameter": "Crimp Strength",
      "specLimit": "Per Master (kgf)",
      "method": "Pull test",
      "mandatory": true,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "≥ Spec",
      "attachments": []
    },
    {
      "parameter": "Leak Test (dye penetration)",
      "specLimit": "No dye ingress at crimp / seam",
      "method": "Fill water + dye → squeeze + invert 5 min",
      "mandatory": true,
      "tolerance": "0 leaks",
      "frequency": "Per lot",
      "sample": "10/lot",
      "acceptance": "No dye ingress",
      "attachments": []
    },
    {
      "parameter": "Leak Test (vacuum chamber)",
      "specLimit": "No leak under 200 mbar × 30 sec",
      "method": "Vacuum chamber → bubble check",
      "mandatory": true,
      "tolerance": "0 leaks",
      "frequency": "Per lot",
      "sample": "10/lot",
      "acceptance": "No bubbles",
      "attachments": []
    },
    {
      "parameter": "Heat-Seal Strength",
      "specLimit": "Per Master",
      "method": "ASTM F88",
      "mandatory": false,
      "tolerance": "≥ Spec",
      "frequency": "Per vendor",
      "sample": "5",
      "acceptance": "≥ Spec",
      "attachments": []
    },
    {
      "parameter": "Tube Capacity",
      "specLimit": "Per Master (mL/g)",
      "method": "Water fill weight",
      "mandatory": true,
      "tolerance": "±2%",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Within ±2%",
      "attachments": []
    }
  ],
  "Primary Pack::Jar (PP/PET)": [
    {
      "parameter": "Height + Diameter",
      "specLimit": "Per Master",
      "method": "Caliper",
      "mandatory": true,
      "tolerance": "±0.5 mm",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Within tolerance",
      "attachments": []
    },
    {
      "parameter": "Lid Fit Test",
      "specLimit": "Snug, no rocking",
      "method": "Manual + torque",
      "mandatory": true,
      "tolerance": "Snug",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Fits cleanly",
      "attachments": []
    },
    {
      "parameter": "Leak Test (water immersion)",
      "specLimit": "No water ingress when capped + submerged 1 hr",
      "method": "Cap → submerge 5 cm depth × 1 hr → wipe + visual",
      "mandatory": true,
      "tolerance": "0 leaks",
      "frequency": "Per lot",
      "sample": "10/lot",
      "acceptance": "No water ingress",
      "attachments": []
    },
    {
      "parameter": "Leak Test (vacuum)",
      "specLimit": "No air ingress under 200 mbar × 1 min",
      "method": "Vacuum chamber",
      "mandatory": false,
      "tolerance": "0 leaks",
      "frequency": "Per vendor / quarter",
      "sample": "5/lot",
      "acceptance": "No leak",
      "attachments": []
    },
    {
      "parameter": "Wall Thickness (uniformity)",
      "specLimit": "± 10% across jar",
      "method": "Magna-mike",
      "mandatory": false,
      "tolerance": "± 10%",
      "frequency": "Per vendor",
      "sample": "5",
      "acceptance": "Within range",
      "attachments": []
    }
  ],
  "Primary Pack::Sachet": [
    {
      "parameter": "Seal Strength",
      "specLimit": "≥ Master (N/15mm)",
      "method": "Peel test",
      "mandatory": true,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "≥ Spec",
      "attachments": []
    },
    {
      "parameter": "Leak Test (squeeze + dye)",
      "specLimit": "No leak post-squeeze test",
      "method": "Pressure / Dye test on filled sachet",
      "mandatory": true,
      "tolerance": "0 leaks",
      "frequency": "Per lot",
      "sample": "AQL 1.0",
      "acceptance": "0 leaks",
      "attachments": []
    },
    {
      "parameter": "Leak Test (vacuum)",
      "specLimit": "No bubble release under 200 mbar",
      "method": "Vacuum chamber + visual",
      "mandatory": false,
      "tolerance": "0 leaks",
      "frequency": "Per vendor",
      "sample": "5/lot",
      "acceptance": "No bubbles",
      "attachments": []
    },
    {
      "parameter": "Tear Resistance",
      "specLimit": "Per Master",
      "method": "Elmendorf tear",
      "mandatory": false,
      "tolerance": "≥ Spec",
      "frequency": "Per vendor",
      "sample": "5",
      "acceptance": "≥ Spec",
      "attachments": []
    }
  ],
  "Primary Pack::Dropper": [
    {
      "parameter": "Drop Volume",
      "specLimit": "Per Master (mL/drop)",
      "method": "Weight-per-drop x10",
      "mandatory": true,
      "tolerance": "±10%",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Within ±10%",
      "attachments": []
    },
    {
      "parameter": "Bulb Integrity",
      "specLimit": "No tears / pin-holes",
      "method": "Visual + squeeze",
      "mandatory": true,
      "tolerance": "0 defects",
      "frequency": "Per lot",
      "sample": "AQL",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Leak Test (assembled dropper + bottle)",
      "specLimit": "No leak when capped + inverted 5 min",
      "method": "Fill water + cap + invert",
      "mandatory": true,
      "tolerance": "0 leaks",
      "frequency": "Per lot",
      "sample": "10/lot",
      "acceptance": "No leak",
      "attachments": []
    },
    {
      "parameter": "Leak Test (bulb seal)",
      "specLimit": "No drip when held inverted 1 min uncapped",
      "method": "Manual visual",
      "mandatory": false,
      "tolerance": "No drip",
      "frequency": "Per lot",
      "sample": "5/lot",
      "acceptance": "No drip",
      "attachments": []
    },
    {
      "parameter": "Compatibility with formula",
      "specLimit": "No bulb degradation @45°C/7d",
      "method": "Accelerated stability",
      "mandatory": false,
      "tolerance": "No change",
      "frequency": "Per new SKU",
      "sample": "3",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Primary Pack::Spray (Mist)": [
    {
      "parameter": "Output per Stroke",
      "specLimit": "Per Master (mL)",
      "method": "10 sprays weighed",
      "mandatory": true,
      "tolerance": "±10%",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Within ±10%",
      "attachments": []
    },
    {
      "parameter": "Spray Pattern",
      "specLimit": "Uniform fine mist",
      "method": "Visual against paper",
      "mandatory": true,
      "tolerance": "Even",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Even",
      "attachments": []
    },
    {
      "parameter": "Leak Test (assembled pack + actuator)",
      "specLimit": "No leak through actuator / dip tube when inverted 5 min",
      "method": "Fill water + cap + invert",
      "mandatory": true,
      "tolerance": "0 leaks",
      "frequency": "Per lot",
      "sample": "10/lot",
      "acceptance": "No leak",
      "attachments": []
    },
    {
      "parameter": "Leak Test (pressure decay on aerosol/airless)",
      "specLimit": "≤ Master pressure drop in 1 min",
      "method": "Pressurize + monitor",
      "mandatory": false,
      "tolerance": "≤ Spec drop",
      "frequency": "Per vendor",
      "sample": "5/lot",
      "acceptance": "Within tolerance",
      "attachments": []
    },
    {
      "parameter": "Priming Strokes",
      "specLimit": "≤ Master (typical 3–5)",
      "method": "Count to first stream",
      "mandatory": false,
      "tolerance": "≤ Spec",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Closures & Pumps::Pump (Lotion/Foam)": [
    {
      "parameter": "Output Volume per Stroke",
      "specLimit": "Per Master mL",
      "method": "10 strokes weighed",
      "mandatory": true,
      "tolerance": "±10%",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Within ±10%",
      "attachments": []
    },
    {
      "parameter": "Priming Strokes",
      "specLimit": "≤ Master",
      "method": "Count",
      "mandatory": true,
      "tolerance": "≤ Spec",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Within spec",
      "attachments": []
    },
    {
      "parameter": "Cycle Life",
      "specLimit": "≥ Master (typical 500 strokes)",
      "method": "Cycling rig",
      "mandatory": false,
      "tolerance": "≥ Spec",
      "frequency": "Per vendor",
      "sample": "3",
      "acceptance": "≥ Spec",
      "attachments": []
    },
    {
      "parameter": "Cap Closure Lock",
      "specLimit": "Locks/unlocks cleanly",
      "method": "Manual",
      "mandatory": true,
      "tolerance": "Functional",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Functional",
      "attachments": []
    }
  ],
  "Closures & Pumps::Cap (Flip-top/Disc-top)": [
    {
      "parameter": "Hinge Life",
      "specLimit": "≥ 100 flips no fracture",
      "method": "Cycling",
      "mandatory": false,
      "tolerance": "≥ 100",
      "frequency": "Per vendor",
      "sample": "5",
      "acceptance": "≥ 100 cycles",
      "attachments": []
    },
    {
      "parameter": "Application Torque",
      "specLimit": "Per Master (kgf-cm)",
      "method": "Torque meter",
      "mandatory": true,
      "tolerance": "±10%",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Removal Torque (after seal)",
      "specLimit": "Per Master",
      "method": "Torque meter",
      "mandatory": false,
      "tolerance": "Per spec",
      "frequency": "Per vendor",
      "sample": "10",
      "acceptance": "Within range",
      "attachments": []
    }
  ],
  "Closures & Pumps::Sprayer": [
    {
      "parameter": "Stream Pattern",
      "specLimit": "Per Master",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Tube Length (dip-tube)",
      "specLimit": "Per Master mm",
      "method": "Measure",
      "mandatory": true,
      "tolerance": "±2 mm",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Within range",
      "attachments": []
    }
  ],
  "Closures & Pumps::Dropper Cap": [
    {
      "parameter": "Drop Volume Consistency",
      "specLimit": "CV ≤ 10%",
      "method": "10 drops weighed",
      "mandatory": true,
      "tolerance": "CV ≤ 10%",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "CV ≤ 10%",
      "attachments": []
    }
  ],
  "Closures & Pumps::Inner Plug": [
    {
      "parameter": "Seal Fit",
      "specLimit": "Snug, no leak",
      "method": "Manual + leak",
      "mandatory": true,
      "tolerance": "No leak",
      "frequency": "Per lot",
      "sample": "AQL",
      "acceptance": "No leak",
      "attachments": []
    },
    {
      "parameter": "Removal Force",
      "specLimit": "Per Master (N)",
      "method": "Force gauge",
      "mandatory": false,
      "tolerance": "Per spec",
      "frequency": "Per vendor",
      "sample": "10",
      "acceptance": "Within range",
      "attachments": []
    }
  ],
  "Secondary Pack::Monocarton": [
    {
      "parameter": "GSM",
      "specLimit": "Per Master (g/m²)",
      "method": "Square + Balance",
      "mandatory": true,
      "tolerance": "±5%",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Within ±5%",
      "attachments": []
    },
    {
      "parameter": "Compression Strength",
      "specLimit": "Per Master (kgf)",
      "method": "BCT machine",
      "mandatory": false,
      "tolerance": "≥ Spec",
      "frequency": "Per vendor",
      "sample": "3",
      "acceptance": "≥ Spec",
      "attachments": []
    },
    {
      "parameter": "Glue Joint Strength",
      "specLimit": "No fail under load",
      "method": "Manual pull / drop",
      "mandatory": true,
      "tolerance": "No fail",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Holds",
      "attachments": []
    },
    {
      "parameter": "Folding Quality (creases)",
      "specLimit": "No cracking at folds",
      "method": "Visual after fold",
      "mandatory": true,
      "tolerance": "No crack",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Clean folds",
      "attachments": []
    },
    {
      "parameter": "Print Adhesion (rub)",
      "specLimit": "No transfer after 10 rubs",
      "method": "Crockmeter dry",
      "mandatory": false,
      "tolerance": "No transfer",
      "frequency": "Per vendor",
      "sample": "3",
      "acceptance": "No smudge",
      "attachments": []
    }
  ],
  "Secondary Pack::Front Label": [
    {
      "parameter": "Adhesive Strength",
      "specLimit": "≥ Master (peel @180°)",
      "method": "Peel tester",
      "mandatory": true,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "≥ Spec",
      "attachments": []
    },
    {
      "parameter": "Substrate Thickness",
      "specLimit": "Per Master µm",
      "method": "Micrometer",
      "mandatory": false,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Print Resolution / Dot Gain",
      "specLimit": "Per Master",
      "method": "Densitometer",
      "mandatory": false,
      "tolerance": "Per spec",
      "frequency": "Per vendor",
      "sample": "3",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Water / Chemical Resistance",
      "specLimit": "No bleed after 24h soak",
      "method": "Soak test",
      "mandatory": false,
      "tolerance": "No bleed",
      "frequency": "Per new SKU",
      "sample": "3",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Secondary Pack::Back Label": [
    {
      "parameter": "Ingredient List Accuracy",
      "specLimit": "Matches approved formula",
      "method": "Doc review",
      "mandatory": true,
      "tolerance": "Exact",
      "frequency": "Per lot",
      "sample": "1 proof",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Regulatory Text Compliance",
      "specLimit": "Per region (FDA / FSSAI / BIS)",
      "method": "Compliance review",
      "mandatory": true,
      "tolerance": "Compliant",
      "frequency": "Per new SKU",
      "sample": "1",
      "acceptance": "Approved",
      "attachments": []
    },
    {
      "parameter": "Adhesive Strength",
      "specLimit": "≥ Master",
      "method": "Peel test",
      "mandatory": true,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "≥ Spec",
      "attachments": []
    }
  ],
  "Secondary Pack::Tamper Sticker": [
    {
      "parameter": "Tear-on-removal",
      "specLimit": "Tears irreversibly",
      "method": "Manual peel",
      "mandatory": true,
      "tolerance": "Tears",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Tears",
      "attachments": []
    },
    {
      "parameter": "Adhesion",
      "specLimit": "≥ Master",
      "method": "Peel test",
      "mandatory": true,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "≥ Spec",
      "attachments": []
    }
  ],
  "Secondary Pack::Leaflet": [
    {
      "parameter": "Content Accuracy",
      "specLimit": "Per approved master",
      "method": "Doc proof check",
      "mandatory": true,
      "tolerance": "Exact",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Fold Quality",
      "specLimit": "Per Master template",
      "method": "Visual",
      "mandatory": false,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "GSM (paper)",
      "specLimit": "Per Master",
      "method": "Square + Balance",
      "mandatory": false,
      "tolerance": "±5%",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Within range",
      "attachments": []
    }
  ],
  "Tertiary Pack::Master Carton": [
    {
      "parameter": "Burst Strength",
      "specLimit": "Per Master (kgf/cm²)",
      "method": "Mullen burst tester",
      "mandatory": true,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "3",
      "acceptance": "≥ Spec",
      "attachments": []
    },
    {
      "parameter": "Compression Strength",
      "specLimit": "Per Master",
      "method": "BCT",
      "mandatory": true,
      "tolerance": "≥ Spec",
      "frequency": "Per vendor",
      "sample": "3",
      "acceptance": "≥ Spec",
      "attachments": []
    },
    {
      "parameter": "GSM",
      "specLimit": "Per Master",
      "method": "Square + Balance",
      "mandatory": false,
      "tolerance": "±5%",
      "frequency": "Per lot",
      "sample": "3",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Dimensions (L×W×H)",
      "specLimit": "Per Master",
      "method": "Measuring tape",
      "mandatory": true,
      "tolerance": "±5 mm",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Within tolerance",
      "attachments": []
    },
    {
      "parameter": "Plies / Flute",
      "specLimit": "Per Master (e.g. 5-ply BC)",
      "method": "Cross-section",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per vendor",
      "sample": "3",
      "acceptance": "Match",
      "attachments": []
    }
  ],
  "Tertiary Pack::Pallet Material": [
    {
      "parameter": "Pallet Type",
      "specLimit": "Per Master (CHEP/wooden/plastic)",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "All",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "Damage Inspection",
      "specLimit": "No broken planks",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "0 damage",
      "frequency": "Per pallet",
      "sample": "All",
      "acceptance": "Sound",
      "attachments": []
    },
    {
      "parameter": "Fumigation Cert (wooden, ISPM-15)",
      "specLimit": "Heat-treated stamp",
      "method": "Doc + Visual",
      "mandatory": false,
      "tolerance": "Valid",
      "frequency": "Per shipment",
      "sample": "1",
      "acceptance": "Valid",
      "attachments": []
    }
  ],
  "Tertiary Pack::Stretch Film": [
    {
      "parameter": "Stretchability",
      "specLimit": "≥ 250%",
      "method": "Manual stretch",
      "mandatory": false,
      "tolerance": "≥ Spec",
      "frequency": "Per vendor",
      "sample": "1 roll",
      "acceptance": "≥ Spec",
      "attachments": []
    },
    {
      "parameter": "Cling",
      "specLimit": "Self-adheres",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "Adhesive",
      "frequency": "Per lot",
      "sample": "1 roll",
      "acceptance": "Cling",
      "attachments": []
    },
    {
      "parameter": "Thickness (µm)",
      "specLimit": "Per Master",
      "method": "Micrometer",
      "mandatory": false,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Within range",
      "attachments": []
    }
  ],
  "Tertiary Pack::Strapping": [
    {
      "parameter": "Tensile Strength",
      "specLimit": "Per Master (N)",
      "method": "Tensile tester",
      "mandatory": false,
      "tolerance": "≥ Spec",
      "frequency": "Per vendor",
      "sample": "5",
      "acceptance": "≥ Spec",
      "attachments": []
    },
    {
      "parameter": "Material",
      "specLimit": "Per Master (PP / Steel)",
      "method": "Visual / COA",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per lot",
      "sample": "1",
      "acceptance": "Match",
      "attachments": []
    }
  ],
  "Ancillary::Spatula": [
    {
      "parameter": "Length",
      "specLimit": "Per Master",
      "method": "Measure",
      "mandatory": true,
      "tolerance": "±2 mm",
      "frequency": "Per lot",
      "sample": "10",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Material (PP/Wood)",
      "specLimit": "Per Master",
      "method": "COA + Visual",
      "mandatory": true,
      "tolerance": "Match",
      "frequency": "Per vendor",
      "sample": "1",
      "acceptance": "Match",
      "attachments": []
    },
    {
      "parameter": "No Splinters / Sharp Edges",
      "specLimit": "Smooth",
      "method": "Tactile + Visual",
      "mandatory": true,
      "tolerance": "No splinters",
      "frequency": "Per lot",
      "sample": "AQL",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Ancillary::Brush": [
    {
      "parameter": "Bristle Density",
      "specLimit": "Per Master",
      "method": "Visual / Count",
      "mandatory": false,
      "tolerance": "Per spec",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Within spec",
      "attachments": []
    },
    {
      "parameter": "Pull-out Test",
      "specLimit": "< Master (force)",
      "method": "Pull test",
      "mandatory": false,
      "tolerance": "Per spec",
      "frequency": "Per vendor",
      "sample": "5",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Ancillary::Sponge": [
    {
      "parameter": "Density",
      "specLimit": "Per Master",
      "method": "Weight per volume",
      "mandatory": false,
      "tolerance": "± Per spec",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Within range",
      "attachments": []
    },
    {
      "parameter": "Tear Resistance",
      "specLimit": "Per Master",
      "method": "Manual stretch test",
      "mandatory": false,
      "tolerance": "≥ Spec",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Pass",
      "attachments": []
    }
  ],
  "Ancillary::QR Card / Insert": [
    {
      "parameter": "QR Scan Test",
      "specLimit": "Scans first attempt",
      "method": "QR reader",
      "mandatory": true,
      "tolerance": "100%",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Pass",
      "attachments": []
    },
    {
      "parameter": "Print Match",
      "specLimit": "Matches artwork",
      "method": "Visual",
      "mandatory": true,
      "tolerance": "Exact",
      "frequency": "Per lot",
      "sample": "5",
      "acceptance": "Match",
      "attachments": []
    }
  ]
};
