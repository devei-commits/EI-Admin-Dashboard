import {
  normalizePmFunctionalSubCategoryKey,
  normalizePmSkuCategoryForSelect,
  type PmSkuCategoryOption,
} from '../constants/materialMasterSkuRules';

export type PmCategoryContext = {
  pmSkuCategory: string;
  subCategory?: string;
  optionalPmSubCategory: string;
  optionalPmSubSubCategory?: string;
};

function normSub(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function pmCanonCategory(ctx: PmCategoryContext): PmSkuCategoryOption | '' {
  return normalizePmSkuCategoryForSelect(ctx.pmSkuCategory || ctx.subCategory || '') || '';
}

/** Packaging item type from functional sub-category, with legacy detail-sub fallback. */
function pmItemType(ctx: PmCategoryContext): string {
  const fromSubSub = normalizePmFunctionalSubCategoryKey(ctx.optionalPmSubSubCategory ?? '');
  if (fromSubSub) return normSub(fromSubSub);
  const legacy = String(ctx.optionalPmSubCategory ?? '').trim();
  if (!legacy) return '';
  const mapped = normalizePmFunctionalSubCategoryKey(legacy);
  if (mapped) return normSub(mapped);
  return normSub(legacy);
}

function pmSubIs(ctx: PmCategoryContext, ...labels: string[]): boolean {
  const item = pmItemType(ctx);
  if (!item) return false;
  return labels.some((l) => normSub(l) === item);
}

function pmCatIs(ctx: PmCategoryContext, ...cats: PmSkuCategoryOption[]): boolean {
  const c = pmCanonCategory(ctx);
  return Boolean(c && cats.includes(c));
}

export type PmConditionalVisibility = {
  primaryAssemblyCode: boolean;
  primaryComponentBreakdown: boolean;
  primarySkuVolume: boolean;
  technicalNominalVolume: boolean;
  technicalShoulderHeight: boolean;
  technicalOverallHeight: boolean;
  technicalOuterDiameter: boolean;
  technicalInnerDiameterNeck: boolean;
  technicalCircumference: boolean;
  technicalBrimfulVolume: boolean;
  technicalEmptyWeight: boolean;
  technicalOrifice: boolean;
  technicalClosureType: boolean;
  technicalPumpCcDosage: boolean;
  technicalPipetteLength: boolean;
  technicalSleeveHeight: boolean;
  technicalFillVolume: boolean;
  technicalPackWidth: boolean;
  technicalPackHeight: boolean;
  technicalOpenClosedSize: boolean;
  technicalSealLaminateWidth: boolean;
  technicalCartonLength: boolean;
  technicalCartonWidth: boolean;
  technicalCartonHeight: boolean;
  technicalBoardPaperType: boolean;
  technicalGsm: boolean;
  technicalMaterialThickness: boolean;
  technicalLamination: boolean;
  technicalStickerType: boolean;
  technicalPrinting: boolean;
  aestheticsShoulderColour: boolean;
  aestheticsCapOvercapColour: boolean;
  aestheticsActuatorColourStyle: boolean;
  aestheticsCollarFinish: boolean;
  aestheticsTeatColour: boolean;
  compatSuitableContainerType: boolean;
  compatContainerSurface: boolean;
  compatAdhesiveCompatibility: boolean;
  regulatoryFoodCosmeticCompliance: boolean;
  showPrimaryConditional: boolean;
  showTechnicalConditional: boolean;
  showAestheticsConditional: boolean;
  showCompatibilityConditional: boolean;
  showRegulatoryConditional: boolean;
};

export function getPmConditionalVisibility(ctx: PmCategoryContext): PmConditionalVisibility {
  const cat = pmCanonCategory(ctx);
  const isPpm = cat === 'ppm';
  const isLabels = cat === 'spm-labels';
  const isMonocarton = cat === 'spm-monocarton';
  const isOtherSecondary = cat === 'spm-other';
  const isSpm = isLabels || isMonocarton || isOtherSecondary;

  const primaryAssemblyCode = isPpm;
  const primaryComponentBreakdown = isPpm;
  const primarySkuVolume = isPpm;

  const technicalNominalVolume = pmSubIs(
    ctx,
    'Tube',
    'Bottle',
    'Jar',
    'Sachet',
    'Dropper',
    'Spray (Mist)',
    'Pump'
  );
  const technicalShoulderHeight = pmSubIs(ctx, 'Bottle', 'Jar');
  const technicalOverallHeight = isPpm || isSpm;
  const technicalOuterDiameter = pmSubIs(
    ctx,
    'Tube',
    'Bottle',
    'Jar',
    'Cap',
    'Pump',
    'Dropper',
    'Dropper Cap',
    'Sprayer'
  );
  const technicalInnerDiameterNeck = technicalOuterDiameter;
  const technicalCircumference = pmSubIs(ctx, 'Bottle', 'Jar');
  const technicalBrimfulVolume = pmSubIs(ctx, 'Bottle', 'Jar');
  const technicalEmptyWeight = isPpm;
  const technicalOrifice = pmSubIs(ctx, 'Tube', 'Dropper', 'Pump', 'Dropper Cap', 'Sprayer');
  const technicalClosureType = pmSubIs(ctx, 'Tube');
  const technicalPumpCcDosage = pmSubIs(ctx, 'Pump', 'Dropper', 'Dropper Cap', 'Sprayer');
  const technicalPipetteLength = pmSubIs(ctx, 'Dropper', 'Dropper Cap');
  const technicalSleeveHeight = pmSubIs(ctx, 'Tube');
  const technicalFillVolume = pmSubIs(ctx, 'Sachet');
  const technicalPackWidth = pmSubIs(
    ctx,
    'Sachet',
    'Front Label',
    'Back Label',
    'Tamper Sticker',
    'Leaflet'
  );
  const technicalPackHeight = technicalPackWidth;
  const technicalOpenClosedSize = pmSubIs(ctx, 'Leaflet');
  const technicalSealLaminateWidth = pmSubIs(ctx, 'Sachet');
  const technicalCartonLength = isMonocarton || pmSubIs(ctx, 'Monocarton');
  const technicalCartonWidth = technicalCartonLength;
  const technicalCartonHeight = technicalCartonLength;
  const technicalBoardPaperType = isMonocarton || isOtherSecondary || pmSubIs(ctx, 'Monocarton');
  const technicalGsm = isMonocarton || isLabels || isOtherSecondary || pmSubIs(ctx, 'Monocarton');
  const technicalMaterialThickness = isLabels || isOtherSecondary;
  const technicalLamination = isLabels || isMonocarton || pmSubIs(ctx, 'Monocarton');
  const technicalStickerType = pmSubIs(ctx, 'Tamper Sticker', 'Front Label', 'Back Label');
  const technicalPrinting = isLabels || isMonocarton || pmSubIs(ctx, 'Monocarton', 'Front Label', 'Back Label');

  const aestheticsShoulderColour = pmSubIs(ctx, 'Tube');
  const aestheticsCapOvercapColour = pmSubIs(
    ctx,
    'Pump',
    'Dropper',
    'Dropper Cap',
    'Bottle',
    'Cap',
    'Sprayer'
  );
  const aestheticsActuatorColourStyle = pmSubIs(ctx, 'Pump', 'Dropper', 'Dropper Cap', 'Sprayer');
  const aestheticsCollarFinish = pmSubIs(ctx, 'Pump', 'Dropper', 'Dropper Cap', 'Sprayer');
  const aestheticsTeatColour = pmSubIs(ctx, 'Dropper', 'Dropper Cap');

  const compatSuitableContainerType = isSpm;
  const compatContainerSurface = isLabels || isOtherSecondary;
  const compatAdhesiveCompatibility = isLabels || isOtherSecondary;

  const regulatoryFoodCosmeticCompliance = isPpm;

  const technicalFlags = [
    technicalNominalVolume,
    technicalShoulderHeight,
    technicalOverallHeight,
    technicalOuterDiameter,
    technicalInnerDiameterNeck,
    technicalCircumference,
    technicalBrimfulVolume,
    technicalEmptyWeight,
    technicalOrifice,
    technicalClosureType,
    technicalPumpCcDosage,
    technicalPipetteLength,
    technicalSleeveHeight,
    technicalFillVolume,
    technicalPackWidth,
    technicalPackHeight,
    technicalOpenClosedSize,
    technicalSealLaminateWidth,
    technicalCartonLength,
    technicalCartonWidth,
    technicalCartonHeight,
    technicalBoardPaperType,
    technicalGsm,
    technicalMaterialThickness,
    technicalLamination,
    technicalStickerType,
    technicalPrinting,
  ];

  const aestheticsFlags = [
    aestheticsShoulderColour,
    aestheticsCapOvercapColour,
    aestheticsActuatorColourStyle,
    aestheticsCollarFinish,
    aestheticsTeatColour,
  ];

  return {
    primaryAssemblyCode,
    primaryComponentBreakdown,
    primarySkuVolume,
    technicalNominalVolume,
    technicalShoulderHeight,
    technicalOverallHeight,
    technicalOuterDiameter,
    technicalInnerDiameterNeck,
    technicalCircumference,
    technicalBrimfulVolume,
    technicalEmptyWeight,
    technicalOrifice,
    technicalClosureType,
    technicalPumpCcDosage,
    technicalPipetteLength,
    technicalSleeveHeight,
    technicalFillVolume,
    technicalPackWidth,
    technicalPackHeight,
    technicalOpenClosedSize,
    technicalSealLaminateWidth,
    technicalCartonLength,
    technicalCartonWidth,
    technicalCartonHeight,
    technicalBoardPaperType,
    technicalGsm,
    technicalMaterialThickness,
    technicalLamination,
    technicalStickerType,
    technicalPrinting,
    aestheticsShoulderColour,
    aestheticsCapOvercapColour,
    aestheticsActuatorColourStyle,
    aestheticsCollarFinish,
    aestheticsTeatColour,
    compatSuitableContainerType,
    compatContainerSurface,
    compatAdhesiveCompatibility,
    regulatoryFoodCosmeticCompliance,
    showPrimaryConditional: primaryAssemblyCode || primaryComponentBreakdown || primarySkuVolume,
    showTechnicalConditional: technicalFlags.some(Boolean),
    showAestheticsConditional: aestheticsFlags.some(Boolean),
    showCompatibilityConditional:
      compatSuitableContainerType || compatContainerSurface || compatAdhesiveCompatibility,
    showRegulatoryConditional: regulatoryFoodCosmeticCompliance,
  };
}
