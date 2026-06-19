import { clonePrBulkClearanceCommonDefaults } from './prBulkClearanceCommonTableDefaults';
import { clonePrDispatchSpecsCommonDefaults } from './prDispatchSpecsCommonTableDefaults';
import { clonePrFinalClearanceCommonDefaults } from './prFinalClearanceCommonTableDefaults';
import type { PrQualitySpecSectionKey } from './prQualitySpecSections';
import type { QualitySpecTableRow } from '../types/qualitySpecTable';

export { clonePrBulkClearanceCommonDefaults } from './prBulkClearanceCommonTableDefaults';
export { clonePrFinalClearanceCommonDefaults } from './prFinalClearanceCommonTableDefaults';
export { clonePrDispatchSpecsCommonDefaults } from './prDispatchSpecsCommonTableDefaults';

export function clonePrQualitySpecTableDefaults(section: PrQualitySpecSectionKey): QualitySpecTableRow[] {
  if (section === 'bulkClearance') return clonePrBulkClearanceCommonDefaults('Skin Care');
  if (section === 'finalClearance') return clonePrFinalClearanceCommonDefaults('Skin Care');
  return clonePrDispatchSpecsCommonDefaults('Skin Care');
}

export function getDefaultPrQualitySpecRowsBySection(
  category = 'Skin Care'
): Record<PrQualitySpecSectionKey, QualitySpecTableRow[]> {
  return {
    bulkClearance: clonePrBulkClearanceCommonDefaults(category),
    finalClearance: clonePrFinalClearanceCommonDefaults(category),
    dispatchSpecs: clonePrDispatchSpecsCommonDefaults(category),
  };
}
