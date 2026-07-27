import { PR_CATEGORY_OPTIONS, prSubCategoryOptionsForCategory } from '../constants/prMasterCategoryOptions';

/**
 * Category → sub-category options for the Spec Rules dashboard (Quality & Technical).
 *
 * Spec rules are keyed by the same **functional / legacy** category vocabulary that item
 * resolution uses — NOT the raw unified taxonomy the master forms show. For RM/PM this is the
 * legacy quality-category set (mirrors RM_UNIFIED_TO_LEGACY_QUALITY_* in eiMastersUnifiedSchema.ts,
 * which are private consts there); for PR it is the PR industry taxonomy. Keeping these lists here
 * lets admins pick a scope that will actually match items. The dashboard combines these with the
 * distinct scopes already present in saved rules, and the fields stay editable (combobox) so any
 * legacy/edge value still works.
 */
export type RuleTaxonomyEntity = 'RM' | 'PM' | 'PR';

/** RM functional quality categories → their legacy sub-category labels. */
const RM_CATEGORY_SUBS: Record<string, string[]> = {
  Active: ['UV Filter', 'Vitamin', 'Synthetic Active'],
  'Aqua / Solvent': ['Aqua', 'Glycerin', 'Alcohol', 'Glycol'],
  Excipient: [],
  Fragrance: [],
  Polymer: ['Carbomer', 'Cellulose Derivative', 'Xanthan / Gum'],
  Preservative: ['Phenoxyethanol-type', 'Paraben-type'],
  Surfactant: ['Anionic', 'Cationic', 'Non-ionic', 'Amphoteric'],
};

/** PM functional quality categories (category-level rules only — no fixed sub-categories). */
const PM_CATEGORIES: string[] = [
  'Primary Pack',
  'Closures & Pumps',
  'Secondary Pack',
  'Tertiary Pack',
  'Ancillary',
];

/** Normalize a rule entity type (quality PR_* all collapse to PR) to the taxonomy entity. */
export function taxonomyEntityFor(entityType: string): RuleTaxonomyEntity {
  const e = entityType.toUpperCase();
  if (e === 'RM') return 'RM';
  if (e === 'PM') return 'PM';
  return 'PR';
}

export function ruleCategoryOptions(entity: RuleTaxonomyEntity): string[] {
  if (entity === 'RM') return Object.keys(RM_CATEGORY_SUBS);
  if (entity === 'PM') return [...PM_CATEGORIES];
  return [...PR_CATEGORY_OPTIONS] as string[];
}

export function ruleSubCategoryOptions(entity: RuleTaxonomyEntity, category: string): string[] {
  const cat = category.trim();
  if (!cat) return [];
  if (entity === 'RM') return RM_CATEGORY_SUBS[cat] ? [...RM_CATEGORY_SUBS[cat]] : [];
  if (entity === 'PM') return []; // PM rules are category-level only
  return prSubCategoryOptionsForCategory(cat).map((o) => o.label);
}

/** Merge taxonomy options with any extra values (e.g. scopes already saved), de-duped + sorted. */
export function mergeOptions(base: string[], extra: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [...base, ...extra]) {
    const t = String(v ?? '').trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.sort((a, b) => a.localeCompare(b));
}
