import { PR_CATEGORY_OPTIONS, prSubCategoryOptionsForCategory } from '../constants/prMasterCategoryOptions';
import { EI_TAX_RM, EI_TAX_PM } from '../constants/eiMastersUnifiedSchema';

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

/**
 * PM functional quality categories → the master item types each one covers.
 *
 * These item types are exactly what a PM master records (`optionalPmSubCategory`) and what the
 * backend resolves a PM row's sub-category to, so a rule scoped to one of them actually matches
 * items. Previously PM sub-categories were hard-coded to `[]` — a PM sub-category rule could not be
 * created at all — and the five category names appear nowhere in the master form, which made it
 * impossible to tell which rule scope would hit which item.
 */
const PM_CATEGORY_ITEM_TYPES: Record<string, string[]> = {
  'Primary Pack': ['TUBES', 'BOTTLES', 'JARS', 'SACHETS', 'DROPPERS', 'STICKS'],
  'Closures & Pumps': ['PUMPS', 'CAPS', 'LIDS'],
  'Secondary Pack': [
    'SHEET FORM', 'ROLL FORM', 'LOCK BOTTOM', 'REVERSE TUCK END', 'STRAIGHT TUCK END',
    'LEAFLETS', 'SLEEVES', 'FITMENTS', 'TAMPER STICKER', 'QR CARDS',
  ],
  'Tertiary Pack': ['SHIPPERS', 'PALLETS', 'STRETCH FILM', 'VOID FILL', 'TAPE', 'STRAPPING'],
  Ancillary: ['SPATULAS', 'BRUSHES', 'SPONGES', 'WANDS', 'PIPETTES', 'DESICCANTS'],
};

const PM_CATEGORIES: string[] = Object.keys(PM_CATEGORY_ITEM_TYPES);

/** The master item types a PM functional category covers — used to explain the category in the UI. */
export function pmCategoryItemTypes(category: string): string[] {
  const key = Object.keys(PM_CATEGORY_ITEM_TYPES).find(
    (c) => c.trim().toLowerCase() === String(category ?? '').trim().toLowerCase(),
  );
  return key ? [...PM_CATEGORY_ITEM_TYPES[key]] : [];
}

/** Normalize a rule entity type (quality PR_* all collapse to PR) to the taxonomy entity. */
export function taxonomyEntityFor(entityType: string): RuleTaxonomyEntity {
  const e = entityType.toUpperCase();
  if (e === 'RM') return 'RM';
  if (e === 'PM') return 'PM';
  return 'PR';
}

/**
 * Category options — the SAME vocabulary the item masters use.
 *
 * Rules were previously authored against a separate legacy vocabulary ("Surfactant",
 * "Primary Pack") that appears nowhere in the master forms, so there was no way to tell which scope
 * would reach which item. The master taxonomy is offered first; the legacy names remain available
 * (appended, and merged with saved rule scopes by the caller) so existing rules stay editable.
 */
export function ruleCategoryOptions(entity: RuleTaxonomyEntity): string[] {
  if (entity === 'RM') return [...Object.keys(EI_TAX_RM), ...Object.keys(RM_CATEGORY_SUBS)];
  if (entity === 'PM') return [...Object.keys(EI_TAX_PM), ...PM_CATEGORIES];
  return [...PR_CATEGORY_OPTIONS] as string[];
}

/** Case/space-insensitive lookup of a key in a taxonomy object. */
function taxKey(tax: Record<string, unknown>, raw: string): string | null {
  const want = String(raw ?? '').trim().toLowerCase();
  if (!want) return null;
  return Object.keys(tax).find((k) => k.trim().toLowerCase() === want) ?? null;
}

export function ruleSubCategoryOptions(entity: RuleTaxonomyEntity, category: string): string[] {
  const cat = category.trim();
  if (!cat) return [];
  if (entity === 'RM') {
    const key = taxKey(EI_TAX_RM as Record<string, unknown>, cat);
    if (key) return Object.keys((EI_TAX_RM as Record<string, Record<string, string[]>>)[key]);
    return RM_CATEGORY_SUBS[cat] ? [...RM_CATEGORY_SUBS[cat]] : [];
  }
  if (entity === 'PM') {
    const key = taxKey(EI_TAX_PM as Record<string, unknown>, cat);
    if (key) return Object.keys((EI_TAX_PM as Record<string, Record<string, string[]>>)[key]);
    return pmCategoryItemTypes(cat);
  }
  return prSubCategoryOptionsForCategory(cat).map((o) => o.label);
}

/**
 * Sub-sub options for a master-taxonomy scope (RM: 'ANIONIC', 'O/W'; PM: 'PET', 'Flip-top').
 * Empty for the legacy vocabulary, which has no third level.
 */
export function ruleSubSubCategoryOptions(
  entity: RuleTaxonomyEntity,
  category: string,
  subCategory: string,
): string[] {
  const cat = String(category ?? '').trim();
  const sub = String(subCategory ?? '').trim();
  if (!cat || !sub) return [];
  const tax = entity === 'RM' ? EI_TAX_RM : entity === 'PM' ? EI_TAX_PM : null;
  if (!tax) return [];
  const catKey = taxKey(tax as Record<string, unknown>, cat);
  if (!catKey) return [];
  const subs = (tax as Record<string, Record<string, readonly string[]>>)[catKey];
  const subKey = taxKey(subs as Record<string, unknown>, sub);
  if (!subKey) return [];
  // '—' is the schema's placeholder for "no third level", not a real option.
  return [...subs[subKey]].filter((v) => String(v).trim() !== '—');
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
