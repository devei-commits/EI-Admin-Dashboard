/**
 * Bulk RM quality-spec fields by functional category and sub-category.
 * Visible on Quality Specifications step when SKU series is Bulk raw materials.
 */

export type RmBulkFunctionalCategory =
  | 'Surfactant'
  | 'Aqua / Solvent'
  | 'Active'
  | 'Polymer'
  | 'Preservative'
  | 'Excipient'
  | 'Fragrance';

export type RmQualitySpecInputType = 'text' | 'yesNo';

export type RmQualitySpecFieldDef = {
  id: string;
  label: string;
  mandatory: boolean;
  category: RmBulkFunctionalCategory;
  /** Omit for common (all subs in category). */
  subCategory?: string;
  inputType: RmQualitySpecInputType;
  placeholder?: string;
};

function common(
  category: RmBulkFunctionalCategory,
  fields: Omit<RmQualitySpecFieldDef, 'category' | 'subCategory'>[]
): RmQualitySpecFieldDef[] {
  return fields.map((f) => ({ ...f, category }));
}

function sub(
  category: RmBulkFunctionalCategory,
  subCategory: string,
  fields: Omit<RmQualitySpecFieldDef, 'category' | 'subCategory'>[]
): RmQualitySpecFieldDef[] {
  return fields.map((f) => ({ ...f, category, subCategory }));
}

export const RM_QUALITY_SPEC_FIELD_DEFS: readonly RmQualitySpecFieldDef[] = [
  ...common('Surfactant', [
    { id: 'qcSurfCoaFromVendor', label: 'COA from Vendor', mandatory: true, inputType: 'text' },
    { id: 'qcSurfInciNameMatch', label: 'INCI Name Match', mandatory: true, inputType: 'text' },
    { id: 'qcSurfLotTraceability', label: 'Lot Traceability', mandatory: true, inputType: 'text' },
    { id: 'qcSurfMfgExpiryDate', label: 'Mfg/Expiry Date', mandatory: true, inputType: 'text' },
    { id: 'qcSurfAppearance', label: 'Appearance', mandatory: true, inputType: 'text' },
    { id: 'qcSurfPh1PctAq', label: 'pH (1% aq.)', mandatory: false, inputType: 'text' },
    { id: 'qcSurfTamc', label: 'TAMC', mandatory: false, inputType: 'text' },
    { id: 'qcSurfTymc', label: 'TYMC', mandatory: true, inputType: 'text' },
    { id: 'qcSurfEcoliSalmonella', label: 'E. coli/Salmonella', mandatory: true, inputType: 'text' },
    { id: 'qcSurfHeavyMetals', label: 'Heavy Metals', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Surfactant', 'Anionic', [
    { id: 'qcSurfAnionicActiveMatterSulfatePct', label: 'Active Matter (sulfate%)', mandatory: false, inputType: 'text' },
    { id: 'qcSurfAnionicFreeOil', label: 'Free Oil', mandatory: false, inputType: 'text' },
    { id: 'qcSurfAnionic14Dioxane', label: '1,4-Dioxane', mandatory: true, inputType: 'text' },
    { id: 'qcSurfAnionicSulfateContentInorganic', label: 'Sulfate Content (inorganic)', mandatory: false, inputType: 'text' },
    { id: 'qcSurfAnionicColorHazenApha', label: 'Color (Hazen/APHA)', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Surfactant', 'Non-ionic', [
    { id: 'qcSurfNonionicHlbValue', label: 'HLB Value', mandatory: true, inputType: 'text' },
    { id: 'qcSurfNonionicCloudPoint', label: 'Cloud Point', mandatory: false, inputType: 'text' },
    { id: 'qcSurfNonionicHydroxylValue', label: 'Hydroxyl Value', mandatory: false, inputType: 'text' },
    { id: 'qcSurfNonionicEo14Dioxane', label: 'Ethylene Oxide/1,4-Dioxane', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Surfactant', 'Amphoteric', [
    { id: 'qcSurfAmphoActiveMatter', label: 'Active Matter', mandatory: true, inputType: 'text' },
    { id: 'qcSurfAmphoFreeAmineDmapa', label: 'Free Amine (DMAPA)', mandatory: true, inputType: 'text' },
    { id: 'qcSurfAmphoNacl', label: 'NaCl', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Surfactant', 'Cationic', [
    { id: 'qcSurfCationicActiveMatterQuatN', label: 'Active Matter (quaternary N)', mandatory: true, inputType: 'text' },
    { id: 'qcSurfCationicFreeAmine', label: 'Free Amine', mandatory: false, inputType: 'text' },
    { id: 'qcSurfCationicChargeDensity', label: 'Charge Density', mandatory: false, inputType: 'text' },
  ]),

  ...common('Aqua / Solvent', [
    { id: 'qcAquaCoa', label: 'COA', mandatory: true, inputType: 'text' },
    { id: 'qcAquaAppearance', label: 'Appearance', mandatory: true, inputType: 'text' },
    { id: 'qcAquaPh', label: 'pH', mandatory: true, inputType: 'text' },
    { id: 'qcAquaConductivity', label: 'Conductivity', mandatory: true, inputType: 'text' },
    { id: 'qcAquaTamcTymc', label: 'TAMC/TYMC', mandatory: true, inputType: 'text' },
    {
      id: 'qcEndotoxinPharmaGrade',
      label: 'Endotoxin (if pharma grade)',
      mandatory: false,
      inputType: 'text',
      placeholder: 'e.g. EU/mg — pharma-grade aqua/solvent',
    },
  ]),
  ...sub('Aqua / Solvent', 'Aqua', [
    { id: 'qcAquaToc', label: 'TOC', mandatory: true, inputType: 'text' },
    { id: 'qcAquaResistivity', label: 'Resistivity', mandatory: true, inputType: 'text' },
    { id: 'qcAquaHeavyMetals', label: 'Heavy Metals', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Aqua / Solvent', 'Glycerin', [
    { id: 'qcAquaGlycerinAssayPurity', label: 'Assay (purity)', mandatory: false, inputType: 'text' },
    { id: 'qcAquaGlycerinDegEg', label: 'Diethylene Glycol/EG', mandatory: false, inputType: 'text' },
    { id: 'qcAquaGlycerinWaterContent', label: 'Water Content', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Aqua / Solvent', 'Alcohol', [
    { id: 'qcAquaAlcoholAssayEthanolIpa', label: 'Assay (Ethanol/IPA%)', mandatory: false, inputType: 'text' },
    { id: 'qcAquaAlcoholMethanol', label: 'Methanol', mandatory: false, inputType: 'text' },
    {
      id: 'qcDenaturantVerification',
      label: 'Denaturant verification (if denatured)',
      mandatory: false,
      inputType: 'yesNo',
    },
  ]),
  ...sub('Aqua / Solvent', 'Glycol', [
    { id: 'qcAquaGlycolAssay', label: 'Assay', mandatory: true, inputType: 'text' },
    { id: 'qcAquaGlycolRefractiveIndex', label: 'Refractive Index', mandatory: true, inputType: 'text' },
  ]),

  ...common('Active', [
    { id: 'qcActiveCoaVendorTds', label: 'COA + Vendor TDS', mandatory: true, inputType: 'text' },
    { id: 'qcActiveAppearance', label: 'Appearance', mandatory: true, inputType: 'text' },
    { id: 'qcActiveAssayPurity', label: 'Assay/Purity', mandatory: true, inputType: 'text' },
    { id: 'qcActiveLossOnDrying', label: 'Loss on Drying', mandatory: true, inputType: 'text' },
    { id: 'qcActiveHeavyMetals', label: 'Heavy Metals', mandatory: true, inputType: 'text' },
    { id: 'qcActiveMicrobial', label: 'Microbial', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Active', 'Vitamin', [
    { id: 'qcActiveVitaminPotency', label: 'Potency (IU or%)', mandatory: true, inputType: 'text' },
    { id: 'qcActiveVitaminOxidativeStability', label: 'Oxidative Stability', mandatory: false, inputType: 'text' },
    { id: 'qcActiveVitaminTocopherolStabilizer', label: 'Tocopherol/Stabilizer Check', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Active', 'Botanical Extract', [
    { id: 'qcActiveBotanicalIdentity', label: 'Botanical Identity', mandatory: true, inputType: 'text' },
    { id: 'qcActiveBotanicalMarkerCompound', label: 'Marker Compound', mandatory: true, inputType: 'text' },
    { id: 'qcActiveBotanicalPesticideResidues', label: 'Pesticide Residues', mandatory: true, inputType: 'text' },
    { id: 'qcActiveBotanicalAflatoxin', label: 'Aflatoxin', mandatory: false, inputType: 'text' },
    { id: 'qcActiveBotanicalSolventExtraction', label: 'Solvent (extraction)', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Active', 'Synthetic Active', [
    { id: 'qcActiveSyntheticRelatedSubstances', label: 'Related Substances', mandatory: true, inputType: 'text' },
    { id: 'qcActiveSyntheticResidualSolvents', label: 'Residual Solvents', mandatory: true, inputType: 'text' },
    { id: 'qcActiveSyntheticCrystalFormPolymorph', label: 'Crystal Form/Polymorph', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Active', 'Peptide', [
    { id: 'qcActivePeptideSequence', label: 'Peptide Sequence', mandatory: true, inputType: 'text' },
    { id: 'qcActivePeptideContentPct', label: 'Peptide Content (%)', mandatory: true, inputType: 'text' },
    {
      id: 'qcTrifluoroacetateSpps',
      label: 'Trifluoroacetate (if SPPS)',
      mandatory: false,
      inputType: 'text',
      placeholder: 'SPPS-synthesized peptide',
    },
  ]),
  ...sub('Active', 'UV Filter', [
    { id: 'qcActiveUvAssay', label: 'Assay', mandatory: true, inputType: 'text' },
    { id: 'qcActiveUvAbsorbanceSpectrum', label: 'UV Absorbance Spectrum', mandatory: true, inputType: 'text' },
    {
      id: 'qcParticleSizeMineral',
      label: 'Particle Size (if mineral)',
      mandatory: true,
      inputType: 'text',
      placeholder: 'Required for mineral UV filters',
    },
    {
      id: 'qcCoatingVerificationTio2Zno',
      label: 'Coating Verification (TiO₂/ZnO)',
      mandatory: false,
      inputType: 'yesNo',
    },
  ]),

  ...common('Polymer', [
    { id: 'qcPolymerCoa', label: 'COA', mandatory: true, inputType: 'text' },
    { id: 'qcPolymerAppearance', label: 'Appearance', mandatory: true, inputType: 'text' },
    { id: 'qcPolymerBulkDensity', label: 'Bulk Density', mandatory: false, inputType: 'text' },
    { id: 'qcPolymerMoistureLod', label: 'Moisture/LOD', mandatory: true, inputType: 'text' },
    { id: 'qcPolymerMicrobial', label: 'Microbial', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Polymer', 'Carbomer', [
    { id: 'qcPolymerCarbomerViscosity05Neutralized', label: 'Viscosity (0.5% neutralized)', mandatory: false, inputType: 'text' },
    { id: 'qcPolymerCarbomerResidualSolvent', label: 'Residual Solvent', mandatory: false, inputType: 'text' },
    { id: 'qcPolymerCarbomerPh1PctAq', label: 'pH (1% aq.)', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Polymer', 'Cellulose Derivative', [
    { id: 'qcPolymerCelluloseViscosity2PctAq', label: 'Viscosity (2% aq.)', mandatory: false, inputType: 'text' },
    { id: 'qcPolymerCelluloseMethoxylHydroxypropyl', label: 'Methoxyl/Hydroxypropyl Content', mandatory: false, inputType: 'text' },
    { id: 'qcPolymerCellulosePh1PctSol', label: 'pH (1% sol.)', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Polymer', 'Xanthan / Gum', [
    { id: 'qcPolymerXanthanViscosity1PctKcl', label: 'Viscosity (1% in 1% KCl)', mandatory: true, inputType: 'text' },
    { id: 'qcPolymerXanthanPyruvicAcid', label: 'Pyruvic Acid (xanthan)', mandatory: false, inputType: 'text' },
    { id: 'qcPolymerXanthanParticleSizeMesh', label: 'Particle Size (mesh)', mandatory: false, inputType: 'text' },
  ]),

  ...common('Preservative', [
    { id: 'qcPresCoa', label: 'COA', mandatory: true, inputType: 'text' },
    { id: 'qcPresAssay', label: 'Assay', mandatory: true, inputType: 'text' },
    { id: 'qcPresAppearance', label: 'Appearance', mandatory: true, inputType: 'text' },
    { id: 'qcPresIdentityFtirUv', label: 'Identity (FTIR/UV)', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Preservative', 'Phenoxyethanol-type', [
    { id: 'qcPresPhenoxyPhenolContent', label: 'Phenol Content', mandatory: true, inputType: 'text' },
    { id: 'qcPresPhenoxyWaterContent', label: 'Water Content', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Preservative', 'Paraben-type', [
    { id: 'qcPresParabenRelatedEsters', label: 'Related Esters', mandatory: true, inputType: 'text' },
    { id: 'qcPresParabenFreeAcidPhb', label: 'Free Acid (PHB Acid)', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Preservative', 'Natural / Organic', [
    { id: 'qcPresNaturalBotanicalSourceIdentity', label: 'Botanical/Source Identity', mandatory: true, inputType: 'text' },
    { id: 'qcPresNaturalActiveMarker', label: 'Active Marker', mandatory: true, inputType: 'text' },
    {
      id: 'qcCosmosEcocertClaimed',
      label: 'COSMOS/Ecocert (if claimed)',
      mandatory: false,
      inputType: 'text',
      placeholder: 'Certificate / claim reference',
    },
  ]),

  ...common('Excipient', [
    { id: 'qcExcCoa', label: 'COA', mandatory: true, inputType: 'text' },
    { id: 'qcExcAppearance', label: 'Appearance', mandatory: true, inputType: 'text' },
    { id: 'qcExcAssayPurity', label: 'Assay/Purity', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Excipient', 'pH Modifier', [
    { id: 'qcExcPhModActiveContentNaohCitric', label: 'Active Content (NaOH/Citric%)', mandatory: true, inputType: 'text' },
    { id: 'qcExcPhModCarbonateContent', label: 'Carbonate Content', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Excipient', 'Chelator', [
    { id: 'qcExcChelatorEdtaEddsContent', label: 'EDTA/EDDS Content', mandatory: true, inputType: 'text' },
    { id: 'qcExcChelatorIronSequestration', label: 'Iron Sequestration', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Excipient', 'Antioxidant', [
    { id: 'qcExcAntioxActiveContentBhtTocopherol', label: 'Active Content (BHT/Tocopherol)', mandatory: true, inputType: 'text' },
    { id: 'qcExcAntioxPeroxideValue', label: 'Peroxide Value', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Excipient', 'Emollient', [
    { id: 'qcExcEmollientSaponificationValue', label: 'Saponification Value', mandatory: true, inputType: 'text' },
    { id: 'qcExcEmollientIodineValue', label: 'Iodine Value', mandatory: true, inputType: 'text' },
    { id: 'qcExcEmollientAcidValue', label: 'Acid Value', mandatory: true, inputType: 'text' },
    { id: 'qcExcEmollientRefractiveIndex', label: 'Refractive Index', mandatory: false, inputType: 'text' },
  ]),

  ...common('Fragrance', [
    { id: 'qcFragCoaIfraCert', label: 'COA + IFRA Certificate', mandatory: true, inputType: 'text' },
    { id: 'qcFragAllergenDeclaration', label: 'Allergen Declaration', mandatory: true, inputType: 'text' },
    { id: 'qcFragOlfactoryMatch', label: 'Olfactory Match', mandatory: true, inputType: 'text' },
    { id: 'qcFragColor', label: 'Color', mandatory: false, inputType: 'text' },
    { id: 'qcFragSpecificGravity', label: 'Specific Gravity', mandatory: false, inputType: 'text' },
    { id: 'qcFragRefractiveIndex', label: 'Refractive Index', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Fragrance', 'Synthetic', [
    { id: 'qcFragSyntheticGcMsFingerprint', label: 'GC-MS Fingerprint', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Fragrance', 'Essential Oil', [
    { id: 'qcFragEssentialGcMsProfile', label: 'GC-MS Profile', mandatory: true, inputType: 'text' },
    { id: 'qcFragEssentialOpticalRotation', label: 'Optical Rotation', mandatory: false, inputType: 'text' },
    { id: 'qcFragEssentialGeographicalOrigin', label: 'Geographical Origin', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Fragrance', 'Masking', [
    { id: 'qcFragMaskingFunctionalTestOffNote', label: 'Functional Test (cover off-note)', mandatory: true, inputType: 'text' },
  ]),
];

/** Legacy flat keys persisted before rmQualitySpecs map — kept for load migration. */
export const RM_QUALITY_SPEC_LEGACY_FLAT_IDS = [
  'qcEndotoxinPharmaGrade',
  'qcDenaturantVerification',
  'qcTrifluoroacetateSpps',
  'qcParticleSizeMineral',
  'qcCoatingVerificationTio2Zno',
  'qcCosmosEcocertClaimed',
] as const;

export const RM_QUALITY_SPEC_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  RM_QUALITY_SPEC_FIELD_DEFS.map((f) => [f.id, f.label])
);

export const RM_QUALITY_SPEC_FIELD_IDS: readonly string[] = RM_QUALITY_SPEC_FIELD_DEFS.map((f) => f.id);
