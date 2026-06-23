import { PR_DISPATCH_SUB_BY_PATH } from './eiMastersFgClearanceSpecs';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

export function prDispatchSubSpecPathKey(category: string, subCategory: string): string {
  return `${category.trim()}::${subCategory.trim()}`;
}

export function hasPrDispatchSpecsSubSpecDefaults(category: string, subCategory: string): boolean {
  const key = prDispatchSubSpecPathKey(category, subCategory);
  return Boolean(PR_DISPATCH_SUB_BY_PATH[key]?.length);
}

export function clonePrDispatchSpecsSubSpecTableDefaults(
  category: string,
  subCategory: string
): QualitySpecTableRow[] {
  const key = prDispatchSubSpecPathKey(category, subCategory);
  const templates = PR_DISPATCH_SUB_BY_PATH[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}
