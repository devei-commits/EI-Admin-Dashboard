import { buildPmConditionalVisibility } from '../constants/eiMastersUnifiedSchema';

export type PmCategoryContext = {
  pmSkuCategory: string;
  subCategory?: string;
  optionalPmSubCategory: string;
  optionalPmSubSubCategory?: string;
};

export type PmConditionalVisibility = ReturnType<typeof buildPmConditionalVisibility> & {
  showPrimaryConditional: boolean;
  showTechnicalConditional: boolean;
  showAestheticsConditional: boolean;
  showCompatibilityConditional: boolean;
  showRegulatoryConditional: boolean;
};

const PM_TECHNICAL_KEYS = [
  'technicalNominalVolume',
  'technicalShoulderHeight',
  'technicalOverallHeight',
  'technicalOuterDiameter',
  'technicalInnerDiameterNeck',
  'technicalCircumference',
  'technicalBrimfulVolume',
  'technicalEmptyWeight',
  'technicalOrifice',
  'technicalClosureType',
  'technicalPumpCcDosage',
  'technicalPipetteLength',
  'technicalSleeveHeight',
  'technicalFillVolume',
  'technicalPackWidth',
  'technicalPackHeight',
  'technicalOpenClosedSize',
  'technicalSealLaminateWidth',
  'technicalCartonLength',
  'technicalCartonWidth',
  'technicalCartonHeight',
  'technicalBoardPaperType',
  'technicalGsm',
  'technicalMaterialThickness',
  'technicalLamination',
  'technicalStickerType',
  'technicalPrinting',
] as const;

const PM_AESTHETICS_KEYS = [
  'aestheticsShoulderColour',
  'aestheticsCapOvercapColour',
  'aestheticsActuatorColourStyle',
  'aestheticsCollarFinish',
  'aestheticsTeatColour',
] as const;

export function getPmConditionalVisibility(ctx: PmCategoryContext): PmConditionalVisibility {
  const flags = buildPmConditionalVisibility(ctx);

  return {
    ...flags,
    showPrimaryConditional:
      flags.primaryAssemblyCode || flags.primaryComponentBreakdown || flags.primarySkuVolume,
    showTechnicalConditional: PM_TECHNICAL_KEYS.some((k) => flags[k]),
    showAestheticsConditional: PM_AESTHETICS_KEYS.some((k) => flags[k]),
    showCompatibilityConditional:
      flags.compatSuitableContainerType ||
      flags.compatContainerSurface ||
      flags.compatAdhesiveCompatibility,
    showRegulatoryConditional: flags.regulatoryFoodCosmeticCompliance,
  };
}
