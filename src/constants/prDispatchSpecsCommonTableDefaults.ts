import {
  normalizePrCategoryForSelect,
  PR_CATEGORY_OPTIONS,
} from './prMasterCategoryOptions';
import { createEmptyQualitySpecRow, type QualitySpecTableRow } from '../types/qualitySpecTable';

type CommonTemplate = Omit<QualitySpecTableRow, 'id'>;

/** Standard dispatch / logistics QC — shared across PR categories unless overridden. */
export const PR_SHARED_DISPATCH_COMMON: readonly CommonTemplate[] = [
  {
    parameter: 'SO + Picking Match',
    specLimit: 'Exact',
    method: 'Manual + system',
    mandatory: true,
    tolerance: 'Exact',
    frequency: 'Per dispatch',
    sample: 'All',
    acceptance: 'Match',
    attachments: [],
  },
  {
    parameter: 'FIFO Compliance',
    specLimit: 'Oldest batch first',
    method: 'Batch No. check',
    mandatory: true,
    tolerance: 'FIFO',
    frequency: 'Per dispatch',
    sample: 'All',
    acceptance: 'FIFO',
    attachments: [],
  },
  {
    parameter: 'Shelf Life Compliance',
    specLimit: '≥ Client min (80% residual)',
    method: 'Exp date calc',
    mandatory: true,
    tolerance: '≥ Client min',
    frequency: 'Per dispatch',
    sample: 'All',
    acceptance: 'Pass',
    attachments: [],
  },
  {
    parameter: 'Pallet Stack & Wrap',
    specLimit: 'Per Master',
    method: 'Visual',
    mandatory: true,
    tolerance: 'Tight wrap',
    frequency: 'Per pallet',
    sample: 'All',
    acceptance: 'Pass',
    attachments: [],
  },
  {
    parameter: 'Vehicle Cleanliness',
    specLimit: 'Clean, dry, no odor',
    method: 'Visual + Olfactory',
    mandatory: true,
    tolerance: 'Clean',
    frequency: 'Per vehicle',
    sample: '1',
    acceptance: 'Pass',
    attachments: [],
  },
  {
    parameter: 'Tax Invoice + E-way Bill + Packing List + COA',
    specLimit: 'Generated',
    method: 'Doc generation',
    mandatory: true,
    tolerance: 'Complete',
    frequency: 'Per dispatch',
    sample: '1 set',
    acceptance: 'Complete',
    attachments: [],
  },
];

/** Category-specific dispatch overrides (optional). Unlisted categories use shared dispatch common. */
const COMMON_BY_CATEGORY: Record<string, readonly CommonTemplate[]> = Object.fromEntries(
  PR_CATEGORY_OPTIONS.map((category) => [category, PR_SHARED_DISPATCH_COMMON])
);

export function hasPrDispatchSpecsCommonDefaults(category: string): boolean {
  const key = normalizePrCategoryForSelect(category) || category.trim();
  return Boolean(key && (COMMON_BY_CATEGORY[key]?.length || PR_SHARED_DISPATCH_COMMON.length));
}

export function clonePrDispatchSpecsCommonDefaults(category: string): QualitySpecTableRow[] {
  const key = normalizePrCategoryForSelect(category) || category.trim();
  const templates = (key && COMMON_BY_CATEGORY[key]) || PR_SHARED_DISPATCH_COMMON;
  return templates.map((row) => createEmptyQualitySpecRow(row));
}
