import { normalizePmSkuCategoryForSelect, type PmSkuCategoryOption } from '../constants/materialMasterSkuRules';

export type PmCategoryContext = {
  pmSkuCategory: string;
  subCategory?: string;
  optionalPmSubCategory: string;
};

function normSub(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function pmCanonCategory(ctx: PmCategoryContext): PmSkuCategoryOption | '' {
  return (
    normalizePmSkuCategoryForSelect(ctx.pmSkuCategory || ctx.subCategory || '') || ''
  );
}

function pmSubIs(ctx: PmCategoryContext, ...labels: string[]): boolean {
  const sub = normSub(ctx.optionalPmSubCategory);
  if (!sub) return false;
  return labels.some((l) => normSub(l) === sub);
}

function pmCatIs(ctx: PmCategoryContext, ...cats: PmSkuCategoryOption[]): boolean {
  const c = pmCanonCategory(ctx);
  return Boolean(c && cats.includes(c));
}

const SUB_TUBES_BOTTLES_JARS_SACHETS_STICKS_PUMPS_DROPPERS = [
  'Tubes',
  'Bottles',
  'Jars',
  'Sachets',
  'Sticks',
  'Pumps',
  'Droppers',
] as const;

const SUB_OUTER_DIAM = ['Tubes', 'Bottles', 'Jars', 'Sticks', 'Caps', 'Lids', 'Pumps', 'Droppers'] as const;

const SUB_PACK_WIDTH_HEIGHT = [
  'Sachets',
  'Sheet form',
  'Roll form',
  'Sleeves',
  'Leaflets',
  'Fitments',
  'Tamper sticker',
] as const;

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

  const technicalNominalVolume = pmSubIs(ctx, ...SUB_TUBES_BOTTLES_JARS_SACHETS_STICKS_PUMPS_DROPPERS);
  const technicalShoulderHeight = pmSubIs(ctx, 'Bottles', 'Jars', 'Sticks');
  const technicalOverallHeight = isPpm || isSpm;
  const technicalOuterDiameter = pmSubIs(ctx, ...SUB_OUTER_DIAM);
  const technicalInnerDiameterNeck = technicalOuterDiameter;
  const technicalCircumference = pmSubIs(ctx, 'Bottles', 'Jars', 'Sticks');
  const technicalBrimfulVolume = pmSubIs(ctx, 'Bottles', 'Jars');
  const technicalEmptyWeight = isPpm;
  const technicalOrifice = pmSubIs(ctx, 'Tubes', 'Droppers', 'Pumps');
  const technicalClosureType = pmSubIs(ctx, 'Tubes');
  const technicalPumpCcDosage = pmSubIs(ctx, 'Pumps', 'Droppers');
  const technicalPipetteLength = pmSubIs(ctx, 'Droppers');
  const technicalSleeveHeight = pmSubIs(ctx, 'Tubes', 'Sleeves');
  const technicalFillVolume = pmSubIs(ctx, 'Sachets');
  const technicalPackWidth = pmSubIs(ctx, ...SUB_PACK_WIDTH_HEIGHT);
  const technicalPackHeight = technicalPackWidth;
  const technicalOpenClosedSize = pmSubIs(ctx, 'Leaflets');
  const technicalSealLaminateWidth = pmSubIs(ctx, 'Sachets');
  const technicalCartonLength = isMonocarton;
  const technicalCartonWidth = isMonocarton;
  const technicalCartonHeight = isMonocarton;
  const technicalBoardPaperType = isMonocarton || isOtherSecondary;
  const technicalGsm = isMonocarton || isLabels || isOtherSecondary;
  const technicalMaterialThickness = isLabels || isOtherSecondary;
  const technicalLamination = isLabels || isMonocarton;
  const technicalStickerType = pmSubIs(ctx, 'Tamper sticker', 'Sheet form', 'Roll form');
  const technicalPrinting = isLabels || isMonocarton;

  const aestheticsShoulderColour = pmSubIs(ctx, 'Tubes');
  const aestheticsCapOvercapColour = pmSubIs(ctx, 'Pumps', 'Droppers', 'Bottles', 'Caps', 'Lids');
  const aestheticsActuatorColourStyle = pmSubIs(ctx, 'Pumps', 'Droppers');
  const aestheticsCollarFinish = pmSubIs(ctx, 'Pumps', 'Droppers');
  const aestheticsTeatColour = pmSubIs(ctx, 'Droppers');

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
