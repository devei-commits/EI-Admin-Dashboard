/**
 * Unified EI Masters taxonomy & conditional-field rules (from EI_Masters_Unified.html).
 * Single source of truth for RM / PM category → sub-category → sub-sub dropdowns and `cond` visibility.
 */

export type PmSkuCategoryOption =
  | 'ppm'
  | 'spm-labels'
  | 'spm-monocarton'
  | 'spm-other'
  | 'tpm-tertiary'
  | 'tpm-ancillary';

/** RM category → sub-category → sub-sub options. */
export const EI_TAX_RM = {
  'RAW MATERIALS': {
    EMULSIFIERS: ['O/W', 'W/O'],
    SURFACTANTS: ['ANIONIC', 'CATIONIC', 'NON-IONIC', 'AMPHOTERIC'],
    PRESERVATIVES: ['BROAD SPECTRUM', 'BELOW 4.5'],
    SOLVENTS: ['HYDROPHOBIC - LIGHT', 'HYDROPHOBIC - HEAVY', 'HYDROPHILIC'],
    'WAXES / BUTTERS': ['NATURAL', 'SYNTHETIC'],
    'UV FILTERS': ['UVA', 'UVB', 'BROAD SPECTRUM'],
    ACTIVES: ['HYDROPHILIC', 'HYDROPHOBIC'],
    BOTANICALS: ['PG/GLYCERIN BASE', 'OIL BASE', 'AQUA BASE'],
    'RHEOLOGY MODIFIERS': ['ET - LOW', 'ET - MEDIUM', 'ET - HIGH'],
  },
  'FRAGRANCES / PERFUMES': {
    'OIL SOLUBLE': ['—'],
    'WATER SOLUBLE': ['—'],
  },
  COLOURS: {
    'OIL SOLUBLE': ['—'],
    'WATER SOLUBLE': ['—'],
  },
} as const;

export type EiRmCategory = keyof typeof EI_TAX_RM;
export type EiRmSubCategory<C extends EiRmCategory = EiRmCategory> = keyof (typeof EI_TAX_RM)[C];

/** PM category label → sub-category → sub-sub options. */
export const EI_TAX_PM = {
  'PPM — Primary (4XXXXX)': {
    TUBES: ['Aluminium', 'Laminate / ABL', 'Plastic'],
    BOTTLES: ['PET', 'HDPE', 'Glass', 'Aluminium', 'Acrylic'],
    JARS: ['PET', 'Glass', 'Acrylic'],
    CAPS: ['Screw', 'Disc-top', 'Flip-top', 'Child-resistant'],
    LIDS: ['Twist-off', 'Snap-on', 'Friction-fit'],
    PUMPS: ['Lotion pump', 'Foaming pump', 'Mist spray', 'Treatment pump'],
    DROPPERS: ['Glass', 'Plastic', 'Calibrated'],
    STICKS: ['Stick', 'Roll-on'],
    SACHETS: ['Single-use', 'Refill', 'Stick-pack'],
  },
  'SPM — Labels (5LXXXXX)': {
    'SHEET FORM': ['Plain', 'Laminated', 'Foil-stamped'],
    'ROLL FORM': ['Plain', 'Laminated', 'Foil-stamped'],
  },
  'SPM — Monocartons (5MXXXXX)': {
    'LOCK BOTTOM': ['Standard', 'Premium'],
    'REVERSE TUCK END': ['Standard', 'Premium'],
    'STRAIGHT TUCK END': ['Standard', 'Premium'],
  },
  'SPM — Other Secondary (5OXXXXX)': {
    SLEEVES: ['Shrink', 'Stretch', 'Cardboard'],
    LEAFLETS: ['Single-fold', 'Multi-fold', 'Booklet'],
    FITMENTS: ['Plastic', 'Foam', 'Paper'],
    'TAMPER STICKER': ['Round', 'Square', 'Custom'],
    'QR CARDS': ['Standard', 'NFC-enabled'],
  },
  'TPM — Tertiary (6TXXXXX)': {
    SHIPPERS: ['Corrugated', 'Plastic', 'Wooden'],
    PALLETS: ['Wooden', 'Plastic', 'Metal'],
    'STRETCH FILM': ['Hand', 'Machine'],
    'VOID FILL': ['Bubble', 'Foam', 'Paper'],
    TAPE: ['Plastic', 'Paper', 'Reinforced'],
    STRAPPING: ['Plastic', 'Steel'],
  },
  'TPM — Ancillary (6AXXXXX)': {
    SPATULAS: ['Plastic', 'Wooden', 'Metal'],
    BRUSHES: ['Synthetic', 'Natural'],
    SPONGES: ['Synthetic', 'Natural'],
    WANDS: ['Plastic', 'Metal'],
    PIPETTES: ['Glass', 'Plastic', 'Disposable'],
    DESICCANTS: ['Silica gel', 'Clay', 'Molecular sieve'],
  },
} as const;

export type EiPmCategoryLabel = keyof typeof EI_TAX_PM;

export const PM_SLUG_TO_CATEGORY_LABEL: Record<PmSkuCategoryOption, EiPmCategoryLabel> = {
  ppm: 'PPM — Primary (4XXXXX)',
  'spm-labels': 'SPM — Labels (5LXXXXX)',
  'spm-monocarton': 'SPM — Monocartons (5MXXXXX)',
  'spm-other': 'SPM — Other Secondary (5OXXXXX)',
  'tpm-tertiary': 'TPM — Tertiary (6TXXXXX)',
  'tpm-ancillary': 'TPM — Ancillary (6AXXXXX)',
};

export const PM_CATEGORY_LABEL_TO_SLUG: Record<EiPmCategoryLabel, PmSkuCategoryOption> = {
  'PPM — Primary (4XXXXX)': 'ppm',
  'SPM — Labels (5LXXXXX)': 'spm-labels',
  'SPM — Monocartons (5MXXXXX)': 'spm-monocarton',
  'SPM — Other Secondary (5OXXXXX)': 'spm-other',
  'TPM — Tertiary (6TXXXXX)': 'tpm-tertiary',
  'TPM — Ancillary (6AXXXXX)': 'tpm-ancillary',
};

export const RM_CATEGORY_OPTIONS = Object.keys(EI_TAX_RM) as EiRmCategory[];

export type EiCondTrigger = '__cat' | '__sub' | '__subsub' | string;

export type EiFieldCond = {
  on: EiCondTrigger;
  vals: readonly string[];
};

export type EiCondContext = {
  cat: string;
  sub: string;
  subsub?: string;
  vals?: Record<string, string | undefined>;
};

function normKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/‑/g, '-');
}

/** Evaluate unified `cond` rule (same logic as EI_Masters_Unified.html). */
export function condOK(cond: EiFieldCond | undefined, ctx: EiCondContext): boolean {
  if (!cond) return true;
  let v: string;
  if (cond.on === '__cat') v = ctx.cat;
  else if (cond.on === '__sub') v = ctx.sub;
  else if (cond.on === '__subsub') v = ctx.subsub ?? '';
  else v = String(ctx.vals?.[cond.on] ?? '');
  const target = normKey(v);
  return cond.vals.some((x) => normKey(x) === target);
}

/** Map legacy RM SKU-series labels → unified category. */
export function normalizeUnifiedRmCategory(raw: string): EiRmCategory | '' {
  const k = normKey(raw);
  if (!k) return '';
  if (k === 'raw materials' || k.includes('bulk raw') || k === 'raw material') return 'RAW MATERIALS';
  if (k === 'fragrance' || k === 'fragrances' || k.includes('fragrances / perfumes')) {
    return 'FRAGRANCES / PERFUMES';
  }
  if (k === 'colours' || k === 'colors' || k.includes('colors & pigments') || k === 'colour') {
    return 'COLOURS';
  }
  const exact = RM_CATEGORY_OPTIONS.find((o) => normKey(o) === k);
  return exact ?? '';
}

/** Map legacy RM detail sub → unified sub-category label. */
export function normalizeUnifiedRmSubCategory(category: string, raw: string): string {
  const detail = String(raw ?? '').trim();
  if (!detail) return '';
  const cat = normalizeUnifiedRmCategory(category);
  if (!cat) return '';
  const options = Object.keys(EI_TAX_RM[cat]);
  const lower = normKey(detail);
  const exact = options.find((o) => normKey(o) === lower);
  if (exact) return exact;
  const mapped = RM_SUB_CATEGORY_ALIASES[lower];
  if (mapped && options.includes(mapped)) return mapped;
  return '';
}

export function normalizeUnifiedRmSubSubCategory(
  category: string,
  subCategory: string,
  raw: string
): string {
  const detail = String(raw ?? '').trim();
  if (!detail) return '';
  const cat = normalizeUnifiedRmCategory(category);
  const sub = normalizeUnifiedRmSubCategory(category, subCategory) || subCategory;
  if (!cat || !sub) return '';
  const subs = EI_TAX_RM[cat] as Record<string, readonly string[]>;
  const options = subs[sub] ?? [];
  if (!options.length || (options.length === 1 && options[0] === '—')) return '';
  const lower = normKey(detail);
  const exact = options.find((o) => normKey(o) === lower);
  if (exact) return exact;
  const mapped = RM_SUB_SUB_ALIASES[lower];
  if (mapped && options.includes(mapped)) return mapped;
  return '';
}

export function rmSubCategoryOptionsForCategory(
  category: string
): { value: string; label: string }[] {
  const cat = normalizeUnifiedRmCategory(category);
  if (!cat) return [];
  return Object.keys(EI_TAX_RM[cat]).map((label) => ({ value: label, label }));
}

export function rmSubSubCategoryOptionsForSubCategory(
  category: string,
  subCategory: string
): { value: string; label: string }[] {
  const cat = normalizeUnifiedRmCategory(category);
  const sub = normalizeUnifiedRmSubCategory(category, subCategory) || subCategory;
  if (!cat || !sub) return [];
  const options = (EI_TAX_RM[cat] as Record<string, readonly string[]>)[sub] ?? [];
  if (options.length === 1 && options[0] === '—') return [];
  return options.map((label) => ({ value: label, label }));
}

export function rmSubCategoryHasSubSub(category: string, subCategory: string): boolean {
  return rmSubSubCategoryOptionsForSubCategory(category, subCategory).length > 0;
}

export function pmSubCategoryOptionsForSlug(
  skuSlug: string
): { value: string; label: string }[] {
  const slug = skuSlug as PmSkuCategoryOption;
  const label = PM_SLUG_TO_CATEGORY_LABEL[slug];
  if (!label) return [];
  return Object.keys(EI_TAX_PM[label]).map((s) => ({ value: s, label: s }));
}

export function normalizeUnifiedPmSubCategory(skuSlug: string, raw: string): string {
  const detail = String(raw ?? '').trim();
  if (!detail) return '';
  const slug = skuSlug as PmSkuCategoryOption;
  const catLabel = PM_SLUG_TO_CATEGORY_LABEL[slug];
  if (!catLabel) return '';
  const options = Object.keys(EI_TAX_PM[catLabel]);
  const lower = normKey(detail);
  const exact = options.find((o) => normKey(o) === lower);
  if (exact) return exact;
  const mapped = PM_SUB_CATEGORY_ALIASES[lower];
  if (mapped && options.includes(mapped)) return mapped;
  return '';
}

export function normalizeUnifiedPmSubSubCategory(
  skuSlug: string,
  subCategory: string,
  raw: string
): string {
  const detail = String(raw ?? '').trim();
  if (!detail) return '';
  const slug = skuSlug as PmSkuCategoryOption;
  const catLabel = PM_SLUG_TO_CATEGORY_LABEL[slug];
  const sub = normalizeUnifiedPmSubCategory(skuSlug, subCategory) || subCategory;
  if (!catLabel || !sub) return '';
  const options = (EI_TAX_PM[catLabel] as Record<string, readonly string[]>)[sub] ?? [];
  const lower = normKey(detail);
  const exact = options.find((o) => normKey(o) === lower);
  if (exact) return exact;
  const mapped = PM_SUB_SUB_ALIASES[lower];
  if (mapped && options.includes(mapped)) return mapped;
  return '';
}

export function pmSubCategoryHasSubSub(skuSlug: string, subCategory: string): boolean {
  const slug = skuSlug as PmSkuCategoryOption;
  const catLabel = PM_SLUG_TO_CATEGORY_LABEL[slug];
  const sub = normalizeUnifiedPmSubCategory(skuSlug, subCategory) || subCategory;
  if (!catLabel || !sub) return false;
  const options = (EI_TAX_PM[catLabel] as Record<string, readonly string[]>)[sub] ?? [];
  return options.length > 0;
}

export function pmSubSubCategoryOptionsForSubCategory(
  skuSlug: string,
  subCategory: string
): { value: string; label: string }[] {
  const slug = skuSlug as PmSkuCategoryOption;
  const catLabel = PM_SLUG_TO_CATEGORY_LABEL[slug];
  const sub = normalizeUnifiedPmSubCategory(skuSlug, subCategory) || subCategory;
  if (!catLabel || !sub) return [];
  const options = (EI_TAX_PM[catLabel] as Record<string, readonly string[]>)[sub] ?? [];
  return options.map((label) => ({ value: label, label }));
}

/** Map unified RM sub → legacy quality-spec category key (rmQualitySpecFields). */
export function rmUnifiedToLegacyQualityCategory(unifiedSub: string): string {
  const k = normKey(unifiedSub);
  return RM_UNIFIED_TO_LEGACY_QUALITY_CATEGORY[k] ?? unifiedSub;
}

/** Map unified RM sub-sub → legacy quality-spec sub key. */
export function rmUnifiedToLegacyQualitySub(unifiedSub: string, unifiedSubSub: string): string {
  const subK = normKey(unifiedSub);
  const subSubK = normKey(unifiedSubSub);
  const bySub = RM_UNIFIED_TO_LEGACY_QUALITY_SUB[subK];
  if (bySub?.[subSubK]) return bySub[subSubK];
  return unifiedSubSub;
}

/** Map unified PM item-type sub → legacy functional quality category. */
export function pmUnifiedToLegacyQualityCategory(skuSlug: string, unifiedSub: string): string {
  const slug = skuSlug as PmSkuCategoryOption;
  const sub = normalizeUnifiedPmSubCategory(slug, unifiedSub) || unifiedSub;
  const k = normKey(sub);
  return PM_UNIFIED_TO_LEGACY_QUALITY_CATEGORY[k] ?? unifiedSub;
}

const RM_SUB_CATEGORY_ALIASES: Record<string, string> = {
  surfactant: 'SURFACTANTS',
  surfactants: 'SURFACTANTS',
  emulsifier: 'EMULSIFIERS',
  emulsifiers: 'EMULSIFIERS',
  preservative: 'PRESERVATIVES',
  preservatives: 'PRESERVATIVES',
  solvent: 'SOLVENTS',
  solvents: 'SOLVENTS',
  'aqua / solvent': 'SOLVENTS',
  'solvents & carriers': 'SOLVENTS',
  active: 'ACTIVES',
  actives: 'ACTIVES',
  polymer: 'RHEOLOGY MODIFIERS',
  polymers: 'RHEOLOGY MODIFIERS',
  'rheology modifier': 'RHEOLOGY MODIFIERS',
  'rheology modifiers': 'RHEOLOGY MODIFIERS',
  botanical: 'BOTANICALS',
  botanicals: 'BOTANICALS',
  'uv filter': 'UV FILTERS',
  'uv filters': 'UV FILTERS',
  'waxes / butters': 'WAXES / BUTTERS',
  'wax / butter': 'WAXES / BUTTERS',
  excipient: 'SOLVENTS',
  excipients: 'SOLVENTS',
  fragrance: 'OIL SOLUBLE',
  'oil soluble': 'OIL SOLUBLE',
  'oil-soluble': 'OIL SOLUBLE',
  'water soluble': 'WATER SOLUBLE',
  'water-soluble': 'WATER SOLUBLE',
};

const RM_SUB_SUB_ALIASES: Record<string, string> = {
  anionic: 'ANIONIC',
  cationic: 'CATIONIC',
  'non-ionic': 'NON-IONIC',
  'non ionic': 'NON-IONIC',
  amphoteric: 'AMPHOTERIC',
  'uv filter': 'UVA',
  uva: 'UVA',
  uvb: 'UVB',
  'broad spectrum': 'BROAD SPECTRUM',
  'below 4.5': 'BELOW 4.5',
  hydrophilic: 'HYDROPHILIC',
  hydrophobic: 'HYDROPHOBIC',
  'hydrophobic - light': 'HYDROPHOBIC - LIGHT',
  'hydrophobic - heavy': 'HYDROPHOBIC - HEAVY',
  natural: 'NATURAL',
  synthetic: 'SYNTHETIC',
  'o/w': 'O/W',
  'w/o': 'W/O',
  'et - low': 'ET - LOW',
  'et - medium': 'ET - MEDIUM',
  'et - high': 'ET - HIGH',
  'pg/glycerin base': 'PG/GLYCERIN BASE',
  'oil base': 'OIL BASE',
  'aqua base': 'AQUA BASE',
  phenoxyethanol: 'BROAD SPECTRUM',
  'phenoxyethanol-type': 'BROAD SPECTRUM',
  paraben: 'BELOW 4.5',
  'paraben-type': 'BELOW 4.5',
  vitamin: 'HYDROPHILIC',
  'botanical extract': 'HYDROPHILIC',
  glycerin: 'HYDROPHILIC',
  alcohol: 'HYDROPHOBIC - LIGHT',
  glycol: 'HYDROPHOBIC - HEAVY',
  aqua: 'HYDROPHILIC',
  carbomer: 'ET - LOW',
  'cellulose derivative': 'ET - MEDIUM',
  'xanthan / gum': 'ET - HIGH',
};

const RM_UNIFIED_TO_LEGACY_QUALITY_CATEGORY: Record<string, string> = {
  emulsifiers: 'Excipient',
  surfactants: 'Surfactant',
  preservatives: 'Preservative',
  solvents: 'Aqua / Solvent',
  'waxes / butters': 'Excipient',
  'uv filters': 'Active',
  actives: 'Active',
  botanicals: 'Active',
  'rheology modifiers': 'Polymer',
  'oil soluble': 'Fragrance',
  'water soluble': 'Fragrance',
};

const RM_UNIFIED_TO_LEGACY_QUALITY_SUB: Record<string, Record<string, string>> = {
  surfactants: {
    anionic: 'Anionic',
    cationic: 'Cationic',
    'non-ionic': 'Non-ionic',
    amphoteric: 'Amphoteric',
  },
  preservatives: {
    'broad spectrum': 'Phenoxyethanol-type',
    'below 4.5': 'Paraben-type',
  },
  'uv filters': {
    uva: 'UV Filter',
    uvb: 'UV Filter',
    'broad spectrum': 'UV Filter',
  },
  actives: {
    hydrophilic: 'Vitamin',
    hydrophobic: 'Synthetic Active',
  },
  solvents: {
    aqua: 'Aqua',
    glycerin: 'Glycerin',
    alcohol: 'Alcohol',
    glycol: 'Glycol',
    hydrophilic: 'Glycerin',
    'hydrophobic - light': 'Alcohol',
    'hydrophobic - heavy': 'Glycol',
  },
  'rheology modifiers': {
    'et - low': 'Carbomer',
    'et - medium': 'Cellulose Derivative',
    'et - high': 'Xanthan / Gum',
  },
};

const PM_SUB_CATEGORY_ALIASES: Record<string, string> = {
  tube: 'TUBES',
  tubes: 'TUBES',
  'tube (laminated)': 'TUBES',
  bottle: 'BOTTLES',
  bottles: 'BOTTLES',
  'bottle (pet/hdpe)': 'BOTTLES',
  jar: 'JARS',
  jars: 'JARS',
  'jar (pp/pet)': 'JARS',
  cap: 'CAPS',
  caps: 'CAPS',
  'cap (flip-top/disc-top)': 'CAPS',
  lid: 'LIDS',
  lids: 'LIDS',
  pump: 'PUMPS',
  pumps: 'PUMPS',
  'pump (lotion/foam)': 'PUMPS',
  dropper: 'DROPPERS',
  droppers: 'DROPPERS',
  'dropper cap': 'DROPPERS',
  stick: 'STICKS',
  sticks: 'STICKS',
  'roll-on': 'STICKS',
  sachet: 'SACHETS',
  sachets: 'SACHETS',
  'sheet form': 'SHEET FORM',
  'roll form': 'ROLL FORM',
  'front label': 'SHEET FORM',
  'back label': 'ROLL FORM',
  monocarton: 'LOCK BOTTOM',
  monocartons: 'LOCK BOTTOM',
  leaflet: 'LEAFLETS',
  leaflets: 'LEAFLETS',
  sleeves: 'SLEEVES',
  sleeve: 'SLEEVES',
  fitments: 'FITMENTS',
  fitment: 'FITMENTS',
  'tamper sticker': 'TAMPER STICKER',
  'qr cards': 'QR CARDS',
  'qr card / insert': 'QR CARDS',
  shippers: 'SHIPPERS',
  shipper: 'SHIPPERS',
  pallets: 'PALLETS',
  pallet: 'PALLETS',
  'stretch film': 'STRETCH FILM',
  strapping: 'STRAPPING',
  spatulas: 'SPATULAS',
  spatula: 'SPATULAS',
  brushes: 'BRUSHES',
  brush: 'BRUSHES',
  sponges: 'SPONGES',
  sponge: 'SPONGES',
  wands: 'WANDS',
  wand: 'WANDS',
  pipettes: 'PIPETTES',
  pipette: 'PIPETTES',
  desiccants: 'DESICCANTS',
  'primary pack': 'BOTTLES',
  'closures & pumps': 'PUMPS',
  'secondary pack': 'SHEET FORM',
  'tertiary pack': 'SHIPPERS',
  ancillary: 'SPATULAS',
  sprayer: 'PUMPS',
  'mist spray': 'PUMPS',
};

const PM_SUB_SUB_ALIASES: Record<string, string> = {
  pet: 'PET',
  hdpe: 'HDPE',
  glass: 'Glass',
  aluminium: 'Aluminium',
  aluminum: 'Aluminium',
  acrylic: 'Acrylic',
  plastic: 'Plastic',
  laminated: 'Laminated',
  plain: 'Plain',
  'foil-stamped': 'Foil-stamped',
  standard: 'Standard',
  premium: 'Premium',
  shrink: 'Shrink',
  stretch: 'Stretch',
  cardboard: 'Cardboard',
  corrugated: 'Corrugated',
  wooden: 'Wooden',
  metal: 'Metal',
  synthetic: 'Synthetic',
  natural: 'Natural',
  disposable: 'Disposable',
  'lotion pump': 'Lotion pump',
  'foaming pump': 'Foaming pump',
  'mist spray': 'Mist spray',
  'treatment pump': 'Treatment pump',
  screw: 'Screw',
  'disc-top': 'Disc-top',
  'flip-top': 'Flip-top',
  'child-resistant': 'Child-resistant',
};

const PM_UNIFIED_TO_LEGACY_QUALITY_CATEGORY: Record<string, string> = {
  tubes: 'Primary Pack',
  bottles: 'Primary Pack',
  jars: 'Primary Pack',
  sachets: 'Primary Pack',
  droppers: 'Primary Pack',
  sticks: 'Primary Pack',
  pumps: 'Closures & Pumps',
  caps: 'Closures & Pumps',
  lids: 'Closures & Pumps',
  'sheet form': 'Secondary Pack',
  'roll form': 'Secondary Pack',
  'lock bottom': 'Secondary Pack',
  'reverse tuck end': 'Secondary Pack',
  'straight tuck end': 'Secondary Pack',
  leaflets: 'Secondary Pack',
  sleeves: 'Secondary Pack',
  fitments: 'Secondary Pack',
  'tamper sticker': 'Secondary Pack',
  'qr cards': 'Secondary Pack',
  shippers: 'Tertiary Pack',
  pallets: 'Tertiary Pack',
  'stretch film': 'Tertiary Pack',
  'void fill': 'Tertiary Pack',
  tape: 'Tertiary Pack',
  strapping: 'Tertiary Pack',
  spatulas: 'Ancillary',
  brushes: 'Ancillary',
  sponges: 'Ancillary',
  wands: 'Ancillary',
  pipettes: 'Ancillary',
  desiccants: 'Ancillary',
};

/** RM conditional field rules (__cat / __sub / State). */
export const RM_FIELD_CONDITIONS = {
  regMaxUseLevelPct: { on: '__sub', vals: ['PRESERVATIVES', 'UV FILTERS'] },
  regAllergenDeclarationEu26: { on: '__cat', vals: ['FRAGRANCES / PERFUMES'] },
  regIfraCategoryLimit: { on: '__cat', vals: ['FRAGRANCES / PERFUMES'] },
  regCiNumber: { on: '__cat', vals: ['COLOURS'] },
  regApprovedArea: { on: '__cat', vals: ['COLOURS'] },
  rmPhysicalFormSolid: { on: 'State', vals: ['Solid'] },
  rmPhysicalFormLiquid: { on: 'State', vals: ['Liquid'] },
} as const satisfies Record<string, EiFieldCond>;

/** PM conditional field rules (__cat slug labels / __sub item types). */
export const PM_FIELD_CONDITIONS = {
  primaryAssemblyCode: { on: '__cat', vals: ['PPM — Primary (4XXXXX)'] },
  primaryComponentBreakdown: { on: '__cat', vals: ['PPM — Primary (4XXXXX)'] },
  primarySkuVolume: { on: '__cat', vals: ['PPM — Primary (4XXXXX)'] },
  technicalNominalVolume: {
    on: '__sub',
    vals: ['TUBES', 'BOTTLES', 'JARS', 'SACHETS', 'STICKS', 'PUMPS', 'DROPPERS'],
  },
  technicalShoulderHeight: { on: '__sub', vals: ['BOTTLES', 'JARS', 'STICKS'] },
  technicalOverallHeight: {
    on: '__cat',
    vals: [
      'PPM — Primary (4XXXXX)',
      'SPM — Labels (5LXXXXX)',
      'SPM — Monocartons (5MXXXXX)',
      'SPM — Other Secondary (5OXXXXX)',
    ],
  },
  technicalOuterDiameter: {
    on: '__sub',
    vals: ['TUBES', 'BOTTLES', 'JARS', 'STICKS', 'CAPS', 'LIDS', 'PUMPS', 'DROPPERS'],
  },
  technicalInnerDiameterNeck: {
    on: '__sub',
    vals: ['TUBES', 'BOTTLES', 'JARS', 'STICKS', 'CAPS', 'LIDS', 'PUMPS', 'DROPPERS'],
  },
  technicalCircumference: { on: '__sub', vals: ['BOTTLES', 'JARS', 'STICKS'] },
  technicalBrimfulVolume: { on: '__sub', vals: ['BOTTLES', 'JARS'] },
  technicalEmptyWeight: { on: '__cat', vals: ['PPM — Primary (4XXXXX)'] },
  technicalOrifice: { on: '__sub', vals: ['TUBES', 'DROPPERS', 'PUMPS'] },
  technicalClosureType: { on: '__sub', vals: ['TUBES'] },
  technicalPumpCcDosage: { on: '__sub', vals: ['PUMPS', 'DROPPERS'] },
  technicalPipetteLength: { on: '__sub', vals: ['DROPPERS'] },
  technicalSleeveHeight: { on: '__sub', vals: ['TUBES', 'SLEEVES'] },
  technicalFillVolume: { on: '__sub', vals: ['SACHETS'] },
  technicalPackWidth: {
    on: '__sub',
    vals: [
      'SACHETS',
      'SHEET FORM',
      'ROLL FORM',
      'SLEEVES',
      'LEAFLETS',
      'FITMENTS',
      'TAMPER STICKER',
    ],
  },
  technicalPackHeight: {
    on: '__sub',
    vals: [
      'SACHETS',
      'SHEET FORM',
      'ROLL FORM',
      'SLEEVES',
      'LEAFLETS',
      'FITMENTS',
      'TAMPER STICKER',
    ],
  },
  technicalOpenClosedSize: { on: '__sub', vals: ['LEAFLETS'] },
  technicalSealLaminateWidth: { on: '__sub', vals: ['SACHETS'] },
  technicalCartonLength: { on: '__cat', vals: ['SPM — Monocartons (5MXXXXX)'] },
  technicalCartonWidth: { on: '__cat', vals: ['SPM — Monocartons (5MXXXXX)'] },
  technicalCartonHeight: { on: '__cat', vals: ['SPM — Monocartons (5MXXXXX)'] },
  technicalBoardPaperType: {
    on: '__cat',
    vals: ['SPM — Monocartons (5MXXXXX)', 'SPM — Other Secondary (5OXXXXX)'],
  },
  technicalGsm: {
    on: '__cat',
    vals: [
      'SPM — Monocartons (5MXXXXX)',
      'SPM — Labels (5LXXXXX)',
      'SPM — Other Secondary (5OXXXXX)',
    ],
  },
  technicalMaterialThickness: {
    on: '__cat',
    vals: ['SPM — Labels (5LXXXXX)', 'SPM — Other Secondary (5OXXXXX)'],
  },
  technicalLamination: {
    on: '__cat',
    vals: ['SPM — Labels (5LXXXXX)', 'SPM — Monocartons (5MXXXXX)'],
  },
  technicalStickerType: { on: '__sub', vals: ['TAMPER STICKER', 'SHEET FORM', 'ROLL FORM'] },
  technicalPrinting: {
    on: '__cat',
    vals: ['SPM — Labels (5LXXXXX)', 'SPM — Monocartons (5MXXXXX)'],
  },
  aestheticsShoulderColour: { on: '__sub', vals: ['TUBES'] },
  aestheticsCapOvercapColour: {
    on: '__sub',
    vals: ['PUMPS', 'DROPPERS', 'BOTTLES', 'CAPS', 'LIDS'],
  },
  aestheticsActuatorColourStyle: { on: '__sub', vals: ['PUMPS', 'DROPPERS'] },
  aestheticsCollarFinish: { on: '__sub', vals: ['PUMPS', 'DROPPERS'] },
  aestheticsTeatColour: { on: '__sub', vals: ['DROPPERS'] },
  compatSuitableContainerType: {
    on: '__cat',
    vals: [
      'SPM — Labels (5LXXXXX)',
      'SPM — Monocartons (5MXXXXX)',
      'SPM — Other Secondary (5OXXXXX)',
    ],
  },
  compatContainerSurface: {
    on: '__cat',
    vals: ['SPM — Labels (5LXXXXX)', 'SPM — Other Secondary (5OXXXXX)'],
  },
  compatAdhesiveCompatibility: {
    on: '__cat',
    vals: ['SPM — Labels (5LXXXXX)', 'SPM — Other Secondary (5OXXXXX)'],
  },
  regulatoryFoodCosmeticCompliance: { on: '__cat', vals: ['PPM — Primary (4XXXXX)'] },
} as const satisfies Record<string, EiFieldCond>;

/** PR master taxonomy (industry category → product form). No scalar field conditionals in unified HTML. */
export {
  PR_CATEGORY_OPTIONS,
  PR_FUNCTIONAL_SUB_CATEGORIES,
  PR_SUB_CATEGORY_OPTIONS,
  normalizePrCategoryForSelect,
  normalizePrSubCategoryForSelect,
  prSubCategoryOptionsForCategory,
  resolvePrCategoryAndSub,
} from './prMasterCategoryOptions';

export function buildRmConditionalVisibility(ctx: {
  subCategory: string;
  optionalRmSubCategory: string;
  optionalRmSubSubCategory?: string;
  rmState: string;
}): Record<keyof typeof RM_FIELD_CONDITIONS, boolean> {
  const cat = normalizeUnifiedRmCategory(ctx.subCategory) || ctx.subCategory;
  const sub =
    normalizeUnifiedRmSubCategory(ctx.subCategory, ctx.optionalRmSubCategory) ||
    ctx.optionalRmSubCategory;
  const condCtx: EiCondContext = {
    cat,
    sub,
    subsub: ctx.optionalRmSubSubCategory,
    vals: { State: ctx.rmState },
  };
  const out = {} as Record<keyof typeof RM_FIELD_CONDITIONS, boolean>;
  for (const [key, cond] of Object.entries(RM_FIELD_CONDITIONS)) {
    out[key as keyof typeof RM_FIELD_CONDITIONS] = condOK(cond, condCtx);
  }
  return out;
}

export function buildPmConditionalVisibility(ctx: {
  pmSkuCategory: string;
  subCategory?: string;
  optionalPmSubCategory: string;
  optionalPmSubSubCategory?: string;
}): Record<keyof typeof PM_FIELD_CONDITIONS, boolean> {
  const slug = (ctx.pmSkuCategory || ctx.subCategory || '') as PmSkuCategoryOption;
  const catLabel = PM_SLUG_TO_CATEGORY_LABEL[slug] ?? '';
  const sub =
    normalizeUnifiedPmSubCategory(slug, ctx.optionalPmSubCategory) || ctx.optionalPmSubCategory;
  const condCtx: EiCondContext = {
    cat: catLabel,
    sub,
    subsub: ctx.optionalPmSubSubCategory,
  };
  const out = {} as Record<keyof typeof PM_FIELD_CONDITIONS, boolean>;
  for (const [key, cond] of Object.entries(PM_FIELD_CONDITIONS)) {
    out[key as keyof typeof PM_FIELD_CONDITIONS] = condOK(cond, condCtx);
  }
  return out;
}
