import { PR_DISPATCH_SUB_BY_PATH } from './eiMastersFgClearanceSpecs';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

/** Renamed PR taxonomy paths → legacy template keys. */
const PATH_ALIASES: Record<string, string> = {
  'Skin Care::Sunscreens': 'Skin Care::Sunscreen',
  'Hair Care::Shampoos': 'Hair Care::Shampoo',
  'Skin Care::Cleansers': 'Cleansing::Facewash',
};

export function prDispatchSubSpecPathKey(category: string, subCategory: string): string {
  return `${category.trim()}::${subCategory.trim()}`;
}

function resolveSubSpecPathKey(category: string, subCategory: string): string {
  const key = prDispatchSubSpecPathKey(category, subCategory);
  return PATH_ALIASES[key] ?? key;
}

export function hasPrDispatchSpecsSubSpecDefaults(category: string, subCategory: string): boolean {
  const key = resolveSubSpecPathKey(category, subCategory);
  return Boolean(PR_DISPATCH_SUB_BY_PATH[key]?.length);
}

export function clonePrDispatchSpecsSubSpecTableDefaults(
  category: string,
  subCategory: string
): QualitySpecTableRow[] {
  const key = resolveSubSpecPathKey(category, subCategory);
  const templates = PR_DISPATCH_SUB_BY_PATH[key] ?? [];
  return templates.map((row) => createEmptyQualitySpecRow(row));
}
