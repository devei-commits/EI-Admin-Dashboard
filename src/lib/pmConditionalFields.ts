import { buildPmConditionalVisibility } from '../constants/eiMastersUnifiedSchema';
import { buildPmMasterFieldVisibility, visiblePmFieldsForModule, type PmMasterFieldContext } from './pmMasterFieldVisibility';

export type PmCategoryContext = PmMasterFieldContext & {
  subCategory?: string;
};

export type PmConditionalVisibility = ReturnType<typeof buildPmMasterFieldVisibility> & {
  showPrimaryConditional: boolean;
  showTechnicalConditional: boolean;
  showAestheticsConditional: boolean;
  showCompatibilityConditional: boolean;
  showRegulatoryConditional: boolean;
};

const PM_TECHNICAL_MODULE_SLUGS = ['dimensions', 'material'] as const;
const PM_AESTHETICS_MODULE_SLUG = 'aesthetics' as const;
const PM_PRIMARY_SKIP = new Set(['itemCode', 'tradeCommercialName']);

export function getPmConditionalVisibility(ctx: PmCategoryContext): PmConditionalVisibility {
  const fieldVis = buildPmMasterFieldVisibility(ctx);
  const legacy = buildPmConditionalVisibility(ctx);

  const technicalKeys = Object.keys(fieldVis).filter((k) =>
    ['specNominal', 'pmOverallHeightMm', 'matBody', 'storeLoc'].includes(k)
  );

  return {
    ...fieldVis,
    ...legacy,
    showPrimaryConditional: ['pmAssemblyCode', 'pmComponentBreakdown', 'pmSkuVolume'].some(
      (k) => fieldVis[k]
    ),
    showTechnicalConditional: technicalKeys.some((k) => fieldVis[k]),
    showAestheticsConditional: fieldVis.pmShoulderColour || fieldVis.pmCapOvercapColour || false,
    showCompatibilityConditional:
      legacy.compatSuitableContainerType ||
      legacy.compatContainerSurface ||
      legacy.compatAdhesiveCompatibility,
    showRegulatoryConditional: Boolean(fieldVis.regFoodCosmeticCompliance),
  };
}

export { visiblePmFieldsForModule, PM_TECHNICAL_MODULE_SLUGS, PM_AESTHETICS_MODULE_SLUG, PM_PRIMARY_SKIP };
