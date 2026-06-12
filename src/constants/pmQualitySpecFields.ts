/**
 * PM quality-spec fields by functional category and sub-category.
 */

export type PmFunctionalCategory =
  | 'Primary Pack'
  | 'Closures & Pumps'
  | 'Secondary Pack'
  | 'Tertiary Pack'
  | 'Ancillary';

export type PmQualitySpecInputType = 'text' | 'yesNo';

export type PmQualitySpecFieldDef = {
  id: string;
  label: string;
  mandatory: boolean;
  category: PmFunctionalCategory;
  subCategory?: string;
  inputType: PmQualitySpecInputType;
  placeholder?: string;
};

function common(
  category: PmFunctionalCategory,
  fields: Omit<PmQualitySpecFieldDef, 'category' | 'subCategory'>[]
): PmQualitySpecFieldDef[] {
  return fields.map((f) => ({ ...f, category }));
}

function sub(
  category: PmFunctionalCategory,
  subCategory: string,
  fields: Omit<PmQualitySpecFieldDef, 'category' | 'subCategory'>[]
): PmQualitySpecFieldDef[] {
  return fields.map((f) => ({ ...f, category, subCategory }));
}

export const PM_QUALITY_SPEC_FIELD_DEFS: readonly PmQualitySpecFieldDef[] = [
  ...common('Primary Pack', [
    { id: 'qcPmPriCoa', label: 'COA', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriVisualDamageDefect', label: 'Visual Damage/Defect', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriCleanliness', label: 'Cleanliness', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriMaterialIdentity', label: 'Material Identity', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriColorOpacityMatch', label: 'Color/Opacity Match', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriWeightPerUnit', label: 'Weight per Unit', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriLotMarking', label: 'Lot Marking', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriLeakTestGeneral', label: 'Leak Test (general)', mandatory: false, inputType: 'text' },
    { id: 'qcPmPriClosureIntegrity', label: 'Closure Integrity', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Primary Pack', 'Bottle (PET/HDPE)', [
    { id: 'qcPmPriBottleHeight', label: 'Height', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriBottleBodyDiameter', label: 'Body Diameter', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriBottleNeckFinish', label: 'Neck Finish', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriBottleWallThickness', label: 'Wall Thickness', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriBottleLeakWaterInversion', label: 'Leak (water inversion)', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriBottleLeakPressureDecay', label: 'Leak (pressure decay)', mandatory: false, inputType: 'text' },
    { id: 'qcPmPriBottlePinholeMicroLeak', label: 'Pin-hole/Micro-leak', mandatory: false, inputType: 'text' },
    { id: 'qcPmPriBottleDropTest', label: 'Drop Test', mandatory: false, inputType: 'text' },
    { id: 'qcPmPriBottleTopLoadCompression', label: 'Top-load Compression', mandatory: false, inputType: 'text' },
    { id: 'qcPmPriBottleEscr', label: 'ESCR', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Primary Pack', 'Tube (Laminated)', [
    { id: 'qcPmPriTubeLayerStructure', label: 'Layer Structure', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriTubeOvality', label: 'Ovality', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriTubeCrimpStrength', label: 'Crimp Strength', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriTubeLeakDyePenetration', label: 'Leak (dye penetration)', mandatory: false, inputType: 'text' },
    { id: 'qcPmPriTubeLeakVacuumChamber', label: 'Leak (vacuum chamber)', mandatory: false, inputType: 'text' },
    { id: 'qcPmPriTubeHeatSealStrength', label: 'Heat-Seal Strength', mandatory: false, inputType: 'text' },
    { id: 'qcPmPriTubeCapacity', label: 'Tube Capacity', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Primary Pack', 'Jar (PP/PET)', [
    { id: 'qcPmPriJarHeightDiameter', label: 'Height+Diameter', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriJarLidFit', label: 'Lid Fit', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriJarLeakWaterImmersion', label: 'Leak (water immersion)', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriJarLeakVacuum', label: 'Leak (vacuum)', mandatory: false, inputType: 'text' },
    { id: 'qcPmPriJarWallThickness', label: 'Wall Thickness', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Primary Pack', 'Sachet', [
    { id: 'qcPmPriSachetSealStrength', label: 'Seal Strength', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriSachetLeakSqueezeDye', label: 'Leak (squeeze+dye)', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriSachetLeakVacuum', label: 'Leak (vacuum)', mandatory: false, inputType: 'text' },
    { id: 'qcPmPriSachetTearResistance', label: 'Tear Resistance', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Primary Pack', 'Dropper', [
    { id: 'qcPmPriDropperDropVolume', label: 'Drop Volume', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriDropperBulbIntegrity', label: 'Bulb Integrity', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriDropperLeakAssembled', label: 'Leak (assembled)', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriDropperLeakBulbSeal', label: 'Leak (bulb seal)', mandatory: false, inputType: 'text' },
    { id: 'qcPmPriDropperFormulaCompatibility', label: 'Compatibility with formula', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Primary Pack', 'Spray (Mist)', [
    { id: 'qcPmPriSprayOutputPerStroke', label: 'Output per Stroke', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriSprayPattern', label: 'Spray Pattern', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriSprayLeakAssembled', label: 'Leak (assembled)', mandatory: true, inputType: 'text' },
    { id: 'qcPmPriSprayLeakPressureDecay', label: 'Leak (pressure decay aerosol/airless)', mandatory: false, inputType: 'text' },
    { id: 'qcPmPriSprayPrimingStrokes', label: 'Priming Strokes', mandatory: false, inputType: 'text' },
  ]),

  ...common('Closures & Pumps', [
    { id: 'qcPmClsCoa', label: 'COA', mandatory: true, inputType: 'text' },
    { id: 'qcPmClsVisualDefects', label: 'Visual Defects', mandatory: true, inputType: 'text' },
    { id: 'qcPmClsMaterialIdentity', label: 'Material Identity', mandatory: true, inputType: 'text' },
    { id: 'qcPmClsColorMatch', label: 'Color Match', mandatory: true, inputType: 'text' },
    { id: 'qcPmClsBottleTubeCompatibility', label: 'Compatibility with Bottle/Tube', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Closures & Pumps', 'Pump (Lotion/Foam)', [
    { id: 'qcPmClsPumpOutputVolumePerStroke', label: 'Output Volume per Stroke', mandatory: true, inputType: 'text' },
    { id: 'qcPmClsPumpPrimingStrokes', label: 'Priming Strokes', mandatory: true, inputType: 'text' },
    { id: 'qcPmClsPumpCycleLife', label: 'Cycle Life', mandatory: false, inputType: 'text' },
    { id: 'qcPmClsPumpCapClosureLock', label: 'Cap Closure Lock', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Closures & Pumps', 'Cap (Flip-top/Disc-top)', [
    { id: 'qcPmClsCapHingeLife', label: 'Hinge Life', mandatory: false, inputType: 'text' },
    { id: 'qcPmClsCapApplicationTorque', label: 'Application Torque', mandatory: true, inputType: 'text' },
    { id: 'qcPmClsCapRemovalTorque', label: 'Removal Torque', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Closures & Pumps', 'Sprayer', [
    { id: 'qcPmClsSprayerStreamPattern', label: 'Stream Pattern', mandatory: true, inputType: 'text' },
    { id: 'qcPmClsSprayerTubeLengthDipTube', label: 'Tube Length (dip-tube)', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Closures & Pumps', 'Dropper Cap', [
    { id: 'qcPmClsDropperCapDropVolumeConsistency', label: 'Drop Volume Consistency', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Closures & Pumps', 'Inner Plug', [
    { id: 'qcPmClsInnerPlugSealFit', label: 'Seal Fit', mandatory: true, inputType: 'text' },
    { id: 'qcPmClsInnerPlugRemovalForce', label: 'Removal Force', mandatory: false, inputType: 'text' },
  ]),

  ...common('Secondary Pack', [
    { id: 'qcPmSecCoa', label: 'COA', mandatory: true, inputType: 'text' },
    { id: 'qcPmSecArtworkMatch', label: 'Artwork Match', mandatory: true, inputType: 'text' },
    { id: 'qcPmSecPantoneColorAccuracy', label: 'Pantone/Color Accuracy', mandatory: true, inputType: 'text' },
    { id: 'qcPmSecTextLegibility', label: 'Text Legibility', mandatory: true, inputType: 'text' },
    { id: 'qcPmSecBarcodeScan', label: 'Barcode Scan', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Secondary Pack', 'Monocarton', [
    { id: 'qcPmSecMonoGsm', label: 'GSM', mandatory: true, inputType: 'text' },
    { id: 'qcPmSecMonoCompressionStrength', label: 'Compression Strength', mandatory: false, inputType: 'text' },
    { id: 'qcPmSecMonoGlueJointStrength', label: 'Glue Joint Strength', mandatory: true, inputType: 'text' },
    { id: 'qcPmSecMonoFoldingQuality', label: 'Folding Quality', mandatory: true, inputType: 'text' },
    { id: 'qcPmSecMonoPrintAdhesion', label: 'Print Adhesion', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Secondary Pack', 'Front Label', [
    { id: 'qcPmSecFrontAdhesiveStrength', label: 'Adhesive Strength', mandatory: true, inputType: 'text' },
    { id: 'qcPmSecFrontSubstrateThickness', label: 'Substrate Thickness', mandatory: false, inputType: 'text' },
    { id: 'qcPmSecFrontPrintResolution', label: 'Print Resolution', mandatory: false, inputType: 'text' },
    { id: 'qcPmSecFrontWaterChemicalResistance', label: 'Water/Chemical Resistance', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Secondary Pack', 'Back Label', [
    { id: 'qcPmSecBackIngredientListAccuracy', label: 'Ingredient List Accuracy', mandatory: true, inputType: 'text' },
    { id: 'qcPmSecBackRegulatoryTextCompliance', label: 'Regulatory Text Compliance', mandatory: true, inputType: 'text' },
    { id: 'qcPmSecBackAdhesiveStrength', label: 'Adhesive Strength', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Secondary Pack', 'Tamper Sticker', [
    { id: 'qcPmSecTamperTearOnRemoval', label: 'Tear-on-removal', mandatory: true, inputType: 'text' },
    { id: 'qcPmSecTamperAdhesion', label: 'Adhesion', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Secondary Pack', 'Leaflet', [
    { id: 'qcPmSecLeafletContentAccuracy', label: 'Content Accuracy', mandatory: true, inputType: 'text' },
    { id: 'qcPmSecLeafletFoldQuality', label: 'Fold Quality', mandatory: false, inputType: 'text' },
    { id: 'qcPmSecLeafletGsmPaper', label: 'GSM (paper)', mandatory: false, inputType: 'text' },
  ]),

  ...common('Tertiary Pack', [
    { id: 'qcPmTerCoa', label: 'COA', mandatory: true, inputType: 'text' },
    { id: 'qcPmTerVisualInspection', label: 'Visual Inspection', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Tertiary Pack', 'Master Carton', [
    { id: 'qcPmTerCartonBurstStrength', label: 'Burst Strength', mandatory: true, inputType: 'text' },
    { id: 'qcPmTerCartonCompressionStrength', label: 'Compression Strength', mandatory: true, inputType: 'text' },
    { id: 'qcPmTerCartonGsm', label: 'GSM', mandatory: false, inputType: 'text' },
    { id: 'qcPmTerCartonDimensions', label: 'Dimensions', mandatory: true, inputType: 'text' },
    { id: 'qcPmTerCartonPliesFlute', label: 'Plies/Flute', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Tertiary Pack', 'Pallet Material', [
    { id: 'qcPmTerPalletType', label: 'Pallet Type', mandatory: true, inputType: 'text' },
    { id: 'qcPmTerPalletDamageInspection', label: 'Damage Inspection', mandatory: true, inputType: 'text' },
    {
      id: 'qcPmTerPalletFumigationCert',
      label: 'Fumigation Cert (wooden, ISPM-15)',
      mandatory: false,
      inputType: 'text',
    },
  ]),
  ...sub('Tertiary Pack', 'Stretch Film', [
    { id: 'qcPmTerStretchStretchability', label: 'Stretchability', mandatory: false, inputType: 'text' },
    { id: 'qcPmTerStretchCling', label: 'Cling', mandatory: true, inputType: 'text' },
    { id: 'qcPmTerStretchThickness', label: 'Thickness', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Tertiary Pack', 'Strapping', [
    { id: 'qcPmTerStrapTensileStrength', label: 'Tensile Strength', mandatory: false, inputType: 'text' },
    { id: 'qcPmTerStrapMaterial', label: 'Material', mandatory: true, inputType: 'text' },
  ]),

  ...common('Ancillary', [
    { id: 'qcPmAncCoa', label: 'COA', mandatory: true, inputType: 'text' },
    { id: 'qcPmAncVisual', label: 'Visual', mandatory: true, inputType: 'text' },
    {
      id: 'qcPmAncFoodCosmeticGradeCert',
      label: 'Food/Cosmetic Grade Cert (if contacts product)',
      mandatory: false,
      inputType: 'text',
    },
  ]),
  ...sub('Ancillary', 'Spatula', [
    { id: 'qcPmAncSpatulaLength', label: 'Length', mandatory: true, inputType: 'text' },
    { id: 'qcPmAncSpatulaMaterial', label: 'Material', mandatory: true, inputType: 'text' },
    { id: 'qcPmAncSpatulaNoSplintersSharpEdges', label: 'No Splinters/Sharp Edges', mandatory: true, inputType: 'text' },
  ]),
  ...sub('Ancillary', 'Brush', [
    { id: 'qcPmAncBrushBristleDensity', label: 'Bristle Density', mandatory: false, inputType: 'text' },
    { id: 'qcPmAncBrushPullOutTest', label: 'Pull-out Test', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Ancillary', 'Sponge', [
    { id: 'qcPmAncSpongeDensity', label: 'Density', mandatory: false, inputType: 'text' },
    { id: 'qcPmAncSpongeTearResistance', label: 'Tear Resistance', mandatory: false, inputType: 'text' },
  ]),
  ...sub('Ancillary', 'QR Card / Insert', [
    { id: 'qcPmAncQrScanTest', label: 'QR Scan Test', mandatory: true, inputType: 'text' },
    { id: 'qcPmAncQrPrintMatch', label: 'Print Match', mandatory: true, inputType: 'text' },
  ]),
];

export const PM_QUALITY_SPEC_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  PM_QUALITY_SPEC_FIELD_DEFS.map((f) => [f.id, f.label])
);

export const PM_QUALITY_SPEC_FIELD_IDS: readonly string[] = PM_QUALITY_SPEC_FIELD_DEFS.map((f) => f.id);
