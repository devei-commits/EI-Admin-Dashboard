/**
 * RM / PM master dropdowns aligned with internal SKU rules + multi-sheet Excel import
 * (see ei-website-backend/src/masterBulk/rmMasterExcelUpload.js and pmMasterExcelUpload.js).
 */

/** RM workbook tabs / canonical sub-categories — Bulk/Fragrance/Colors: leading digit 1/2/3 + 6 digits (7 total). */
export const RM_SUB_CATEGORY_SKU_OPTIONS = [
  'Bulk raw materials',
  'Fragrance',
  'Colors & Pigments',
] as const;

export type RmSubCategorySkuOption = (typeof RM_SUB_CATEGORY_SKU_OPTIONS)[number];

/** Map DB / Excel / legacy `group` strings to a canonical dropdown value. */
export function normalizeRmSubCategoryForSelect(raw: string): RmSubCategorySkuOption | '' {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!k) return '';
  if (
    k === 'fragrance' ||
    k === 'fragrances' ||
    k === 'fragrances / perfumes' ||
    k === 'fragrances/perfumes'
  ) {
    return 'Fragrance';
  }
  if (
    k === 'colors & pigments' ||
    k === 'color & pigments' ||
    k === 'colours' ||
    k === 'colors' ||
    k === 'colour'
  ) {
    return 'Colors & Pigments';
  }
  if (
    k === 'raw material' ||
    k === 'raw materials' ||
    k.includes('bulk raw') ||
    k === 'solvents & carriers' ||
    k === 'pre-mixed bases' ||
    k === 'pre-mixed based'
  ) {
    return 'Bulk raw materials';
  }
  const exact = RM_SUB_CATEGORY_SKU_OPTIONS.find((o) => o.toLowerCase() === k);
  return exact ?? '';
}

/** PM category slugs — drives internal SKU series (4 / 5L / 5M / 5O / 6T / 6A). */
export const PM_SKU_CATEGORY_OPTIONS = [
  'ppm',
  'spm-labels',
  'spm-monocarton',
  'spm-other',
  'tpm-tertiary',
  'tpm-ancillary',
] as const;

export type PmSkuCategoryOption = (typeof PM_SKU_CATEGORY_OPTIONS)[number];

export type PmSkuCodePrefix = '4' | '5M' | '5L' | '5O' | '6T' | '6A';

export const PM_SKU_CATEGORY_SELECT_OPTIONS = [
  { value: 'ppm', label: 'PPM — Primary (4XXXXX)' },
  { value: 'spm-labels', label: 'SPM — Labels (5LXXXXX)' },
  { value: 'spm-monocarton', label: 'SPM — Monocartons (5MXXXXX)' },
  { value: 'spm-other', label: 'SPM — Other Secondary (5OXXXXX)' },
  { value: 'tpm-tertiary', label: 'TPM — Tertiary (6TXXXXX)' },
  { value: 'tpm-ancillary', label: 'TPM — Ancillary (6AXXXX)' },
] as const;

/**
 * PM functional taxonomy (master form: category → sub-category).
 * Stored in `optionalPmSubCategory` / `optionalPmSubSubCategory`.
 */
export const PM_FUNCTIONAL_SUB_CATEGORIES: Record<string, readonly string[]> = {
  'Primary Pack': ['Bottle', 'Tube', 'Jar', 'Sachet', 'Dropper', 'Spray (Mist)'],
  'Closures & Pumps': ['Pump', 'Cap', 'Sprayer', 'Dropper Cap', 'Inner Plug'],
  'Secondary Pack': ['Monocarton', 'Front Label', 'Back Label', 'Tamper Sticker', 'Leaflet'],
  'Tertiary Pack': ['Master Carton', 'Pallet Material', 'Stretch Film', 'Strapping'],
  Ancillary: ['Spatula', 'Brush', 'Sponge', 'QR Card / Insert'],
};

/** Functional categories shown per PM SKU series. */
export const PM_SKU_FUNCTIONAL_CATEGORIES: Record<PmSkuCategoryOption, readonly string[]> = {
  ppm: ['Primary Pack', 'Closures & Pumps'],
  'spm-labels': ['Secondary Pack'],
  'spm-monocarton': ['Secondary Pack'],
  'spm-other': ['Secondary Pack'],
  'tpm-tertiary': ['Tertiary Pack'],
  'tpm-ancillary': ['Ancillary'],
};

/** Secondary-pack sub-categories allowed per SPM SKU series. */
export const PM_SECONDARY_SUBS_BY_SKU: Partial<Record<PmSkuCategoryOption, readonly string[]>> = {
  'spm-labels': ['Front Label', 'Back Label'],
  'spm-monocarton': ['Monocarton'],
  'spm-other': ['Tamper Sticker', 'Leaflet'],
};

/** Functional categories per PM SKU series (stored in `optionalPmSubCategory`). */
export const PM_DETAIL_SUB_CATEGORIES: Record<PmSkuCategoryOption, readonly string[]> = {
  ppm: PM_SKU_FUNCTIONAL_CATEGORIES.ppm,
  'spm-labels': PM_SKU_FUNCTIONAL_CATEGORIES['spm-labels'],
  'spm-monocarton': PM_SKU_FUNCTIONAL_CATEGORIES['spm-monocarton'],
  'spm-other': PM_SKU_FUNCTIONAL_CATEGORIES['spm-other'],
  'tpm-tertiary': PM_SKU_FUNCTIONAL_CATEGORIES['tpm-tertiary'],
  'tpm-ancillary': PM_SKU_FUNCTIONAL_CATEGORIES['tpm-ancillary'],
};

/** Sub-category options keyed by functional category — stored in `optionalPmSubSubCategory`. */
export const PM_SUB_SUB_CATEGORIES: Record<string, readonly string[]> = {
  ...PM_FUNCTIONAL_SUB_CATEGORIES,
};

/** @deprecated Use PM_SKU_CATEGORY_OPTIONS — legacy title-case values still seen in older `group` / form_data. */
export const PM_SUB_CATEGORY_SKU_OPTIONS = ['Primary', 'Labels', 'Monocarton'] as const;

/** RM category dropdown (value = persisted on `group` / form `subCategory`; drives internal SKU). */
export const RM_SUB_CATEGORY_SKU_SELECT_OPTIONS = [
  { value: 'Bulk raw materials', label: 'Raw materials (SKU 1XXXXXX)' },
  { value: 'Fragrance', label: 'Fragrances / perfumes (SKU 2XXXXXX)' },
  { value: 'Colors & Pigments', label: 'Colours (SKU 3XXXXXX)' },
] as const;

/**
 * Bulk RM functional taxonomy (RM master form: category → sub-category).
 * Stored in `optionalRmSubCategory` / `optionalRmSubSubCategory` when SKU series is Bulk raw materials.
 */
export const RM_BULK_FUNCTIONAL_SUB_CATEGORIES: Record<string, readonly string[]> = {
  Surfactant: ['Anionic', 'Non-ionic', 'Amphoteric', 'Cationic'],
  'Aqua / Solvent': ['Aqua', 'Glycerin', 'Alcohol', 'Glycol'],
  Active: ['Vitamin', 'Botanical Extract', 'Synthetic Active', 'Peptide', 'UV Filter'],
  Polymer: ['Carbomer', 'Cellulose Derivative', 'Xanthan / Gum'],
  Preservative: ['Phenoxyethanol-type', 'Paraben-type', 'Natural / Organic'],
  Excipient: ['pH Modifier', 'Chelator', 'Antioxidant', 'Emollient'],
  Fragrance: ['Synthetic', 'Essential Oil', 'Masking'],
};

/** Finer sub-category options per RM SKU category (stored in `optionalRmSubCategory` / form_data). */
export const RM_DETAIL_SUB_CATEGORIES: Record<RmSubCategorySkuOption, readonly string[]> = {
  'Bulk raw materials': Object.keys(RM_BULK_FUNCTIONAL_SUB_CATEGORIES),
  Fragrance: ['Oil soluble', 'Water soluble'],
  'Colors & Pigments': ['Oil soluble', 'Water soluble'],
};

/** Sub-sub options keyed by RM detail sub-category — stored in `optionalRmSubSubCategory`. */
export const RM_SUB_SUB_CATEGORIES: Record<string, readonly string[]> = {
  ...RM_BULK_FUNCTIONAL_SUB_CATEGORIES,
};

export function rmSkuCategoryRequiresDetailSubCategory(parent: string): boolean {
  const canon = normalizeRmSubCategoryForSelect(parent);
  return (
    canon === 'Bulk raw materials' || canon === 'Fragrance' || canon === 'Colors & Pigments'
  );
}

export function rmDetailSubCategoryOptionsForSkuCategory(
  parent: string
): { value: string; label: string }[] {
  const canon = normalizeRmSubCategoryForSelect(parent);
  if (!canon) return [];
  return (RM_DETAIL_SUB_CATEGORIES[canon] ?? []).map((label) => ({ value: label, label }));
}

/** Match saved / Excel sub-category text to a canonical option for the parent category. */
export function normalizeRmDetailSubCategoryForSelect(parent: string, raw: string): string {
  const detail = String(raw || '').trim();
  if (!detail) return '';
  const canon = normalizeRmSubCategoryForSelect(parent);
  const options = RM_DETAIL_SUB_CATEGORIES[canon] ?? [];
  const lower = detail.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  const aliases = RM_DETAIL_SUB_CATEGORY_ALIASES;
  const mapped = aliases[lower];
  if (mapped && options.includes(mapped)) return mapped;
  return '';
}

/** Legacy / import aliases → canonical RM detail sub-category. */
const RM_DETAIL_SUB_CATEGORY_ALIASES: Record<string, string> = {
  surfactant: 'Surfactant',
  surfactants: 'Surfactant',
  'surfactants / cleansing': 'Surfactant',
  'aqua / solvent': 'Aqua / Solvent',
  'aqua solvent': 'Aqua / Solvent',
  aqua: 'Aqua / Solvent',
  solvent: 'Aqua / Solvent',
  solvents: 'Aqua / Solvent',
  'solvents & carriers': 'Aqua / Solvent',
  active: 'Active',
  actives: 'Active',
  'actives / api': 'Active',
  polymer: 'Polymer',
  polymers: 'Polymer',
  'thickeners / polymers / gums': 'Polymer',
  'rheology modifier': 'Polymer',
  'rheology modifiers': 'Polymer',
  preservative: 'Preservative',
  preservatives: 'Preservative',
  'preservatives / chelators': 'Preservative',
  excipient: 'Excipient',
  excipients: 'Excipient',
  emulsifier: 'Excipient',
  emulsifiers: 'Excipient',
  'buffers / ph adjusters': 'Excipient',
  fragrance: 'Fragrance',
  fragrances: 'Fragrance',
  'fragrances / perfumes': 'Fragrance',
  'wax / butter': 'Excipient',
  'waxes / butters': 'Excipient',
  'waxes/butters': 'Excipient',
  wax: 'Excipient',
  waxes: 'Excipient',
  butter: 'Excipient',
  butters: 'Excipient',
  botanical: 'Active',
  botanicals: 'Active',
  'uv filter': 'Active',
  'uv filters': 'Active',
  'oil soluble': 'Oil soluble',
  'oil-soluble': 'Oil soluble',
  'water soluble': 'Water soluble',
  'water-soluble': 'Water soluble',
  vitamin: 'Active',
  vitamins: 'Active',
  'fine fragrance': 'Fragrance',
  'fine fragrance compounds': 'Fragrance',
  'essential oil': 'Fragrance',
  'essential oils': 'Fragrance',
  'aroma chemical': 'Fragrance',
  'aroma chemicals': 'Fragrance',
  'iron oxide': 'Oil soluble',
  'iron oxides': 'Oil soluble',
  tio2: 'Oil soluble',
  'titanium dioxide': 'Oil soluble',
  zno: 'Oil soluble',
  'zinc oxide': 'Oil soluble',
  'organic dye': 'Oil soluble',
  'organic dyes': 'Water soluble',
  lake: 'Oil soluble',
  lakes: 'Water soluble',
  'pearlescent pigment': 'Oil soluble',
  'pearlescent pigments': 'Oil soluble',
};

/** Canonical RM detail sub-category label for sub-sub lookups. */
export function normalizeRmDetailSubCategoryKey(raw: string): string {
  const detail = String(raw || '').trim();
  if (!detail) return '';
  const lower = detail.toLowerCase();
  for (const list of Object.values(RM_DETAIL_SUB_CATEGORIES)) {
    const exact = list.find((o) => o.toLowerCase() === lower);
    if (exact) return exact;
  }
  return RM_DETAIL_SUB_CATEGORY_ALIASES[lower] ?? '';
}

export function rmDetailSubCategoryHasSubSubCategory(detailSub: string): boolean {
  const key = normalizeRmDetailSubCategoryKey(detailSub);
  return key !== '' && (RM_SUB_SUB_CATEGORIES[key]?.length ?? 0) > 0;
}

export function rmBulkUsesFunctionalCategoryTaxonomy(parentSkuCategory: string): boolean {
  return normalizeRmSubCategoryForSelect(parentSkuCategory) === 'Bulk raw materials';
}

export function rmSubSubCategoryOptionsForDetailSubCategory(
  detailSub: string
): { value: string; label: string }[] {
  const key = normalizeRmDetailSubCategoryKey(detailSub);
  if (!key) return [];
  return (RM_SUB_SUB_CATEGORIES[key] ?? []).map((label) => ({ value: label, label }));
}

export function normalizeRmSubSubCategoryForSelect(detailSub: string, raw: string): string {
  const detail = String(raw || '').trim();
  if (!detail) return '';
  const key = normalizeRmDetailSubCategoryKey(detailSub);
  const options = RM_SUB_SUB_CATEGORIES[key] ?? [];
  const lower = detail.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  const aliases: Record<string, string> = {
    anionic: 'Anionic',
    cationic: 'Cationic',
    'non-ionic': 'Non-ionic',
    'non ionic': 'Non-ionic',
    amphoteric: 'Amphoteric',
    glycerin: 'Glycerin',
    alcohol: 'Alcohol',
    glycol: 'Glycol',
    vitamin: 'Vitamin',
    vitamins: 'Vitamin',
    'botanical extract': 'Botanical Extract',
    botanical: 'Botanical Extract',
    botanicals: 'Botanical Extract',
    extract: 'Botanical Extract',
    'synthetic active': 'Synthetic Active',
    'synthetic api': 'Synthetic Active',
    peptide: 'Peptide',
    peptides: 'Peptide',
    'uv filter': 'UV Filter',
    'uv filters': 'UV Filter',
    carbomer: 'Carbomer',
    'cellulose derivative': 'Cellulose Derivative',
    'xanthan / gum': 'Xanthan / Gum',
    xanthan: 'Xanthan / Gum',
    gum: 'Xanthan / Gum',
    'phenoxyethanol-type': 'Phenoxyethanol-type',
    phenoxyethanol: 'Phenoxyethanol-type',
    'paraben-type': 'Paraben-type',
    paraben: 'Paraben-type',
    parabens: 'Paraben-type',
    'natural / organic': 'Natural / Organic',
    natural: 'Natural / Organic',
    organic: 'Natural / Organic',
    'ph modifier': 'pH Modifier',
    'ph adjusters': 'pH Modifier',
    chelator: 'Chelator',
    chelators: 'Chelator',
    antioxidant: 'Antioxidant',
    antioxidants: 'Antioxidant',
    emollient: 'Emollient',
    emollients: 'Emollient',
    synthetic: 'Synthetic',
    'essential oil': 'Essential Oil',
    'essential oils': 'Essential Oil',
    masking: 'Masking',
    'broad spectrum': 'Phenoxyethanol-type',
    'below 4.5': 'Paraben-type',
    'below 4.5 ph': 'Paraben-type',
    'hydrophobic - light': 'Alcohol',
    'hydrophobic light': 'Alcohol',
    'hydrophobic - heavy': 'Glycol',
    'hydrophobic heavy': 'Glycol',
    hydrophilic: 'Glycerin',
    aqueous: 'Aqua',
    'o/w': 'Anionic',
    'w/o': 'Cationic',
    uva: 'UV Filter',
    uvb: 'UV Filter',
    hydrophobic: 'Alcohol',
    'pg/glycerin base': 'Glycerin',
    'pg glycerin base': 'Glycerin',
    'oil base': 'Alcohol',
    'aqua base': 'Aqua',
    'et - low': 'Carbomer',
    'et - medium': 'Cellulose Derivative',
    'et - high': 'Xanthan / Gum',
    'et low': 'Carbomer',
    'et medium': 'Cellulose Derivative',
    'et high': 'Xanthan / Gum',
    'organic acid': 'Paraben-type',
    isothiazolinone: 'Phenoxyethanol-type',
    inorganic: 'UV Filter',
    hybrid: 'UV Filter',
    hydrocarbon: 'Glycol',
    ester: 'Emollient',
    silicone: 'Emollient',
    mineral: 'Synthetic Active',
    'oil-soluble': 'Alcohol',
    'water-soluble': 'Aqua',
    oil: 'Alcohol',
    powder: 'Synthetic Active',
    hydrosol: 'Aqua',
    blend: 'Synthetic',
  };
  const mapped = aliases[lower];
  if (mapped && options.includes(mapped)) return mapped;
  return '';
}

/** @deprecated Use PM_SKU_CATEGORY_SELECT_OPTIONS — kept for imports that still reference the old name. */
export const PM_SUB_CATEGORY_SKU_SELECT_OPTIONS = PM_SKU_CATEGORY_SELECT_OPTIONS;

const RM_CAT_GENERAL = ['ACT', 'EMOL', 'SURF', 'PRES', 'THIC', 'BUF', 'SOLV', 'MISC'] as const;

/** RM Category keys (EI-RM-*) allowed per sub-category tab. */
export function rmCategoryKeysForSubCategory(sub: string): readonly string[] {
  const k = String(sub || '')
    .trim()
    .toLowerCase();
  if (k === 'fragrance' || k === 'fragrances') return ['FRAG'];
  if (k === 'colors & pigments') return ['COL'];
  if (
    k === 'bulk raw materials' ||
    k === 'raw material' ||
    k === 'raw materials' ||
    k.includes('bulk raw')
  ) {
    return [...RM_CAT_GENERAL];
  }
  return [];
}

const PM_CAT_PRIMARY = ['PRI', 'CLSR', 'SACH', 'FIOL', 'ALUM', 'AIRLS', 'TAPE', 'GIFT', 'MISC'] as const;

/** PM Category keys (EI-PM-*) allowed per PM category (SKU prefix series). */
export function pmCategoryKeysForSubCategory(sub: string): readonly string[] {
  const canon = normalizePmSkuCategoryForSelect(sub);
  if (canon === 'ppm') return [...PM_CAT_PRIMARY];
  if (canon === 'spm-labels') return ['SLBL'];
  if (canon === 'spm-monocarton') return ['MONO'];
  if (canon === 'spm-other') return ['SACH', 'TAPE', 'GIFT', 'MISC'];
  if (canon === 'tpm-tertiary') return ['SHIP'];
  if (canon === 'tpm-ancillary') return ['MISC'];
  return [];
}

/** Map legacy / Excel strings to PM category slug (persisted on `group`). */
export function normalizePmSkuCategoryForSelect(raw: string): PmSkuCategoryOption | '' {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!k) return '';
  if (k === 'ppm' || k.includes('primary packaging')) return 'ppm';
  if (k.includes('spm') && k.includes('label')) return 'spm-labels';
  if (k === 'labels' || k === 'label') return 'spm-labels';
  if (k.includes('spm') && (k.includes('monocarton') || k.includes('mono carton'))) return 'spm-monocarton';
  if (k === 'monocarton' || k === 'monocartons') return 'spm-monocarton';
  if (
    k.includes('other secondary') ||
    k === 'spm-other' ||
    (k.includes('spm') && k.includes('other'))
  ) {
    return 'spm-other';
  }
  if (
    k.includes('fitment') ||
    k === 'fitness & misc' ||
    k === 'fitments & misc' ||
    (k.includes('fitness') && k.includes('misc')) ||
    (k.includes('fitments') && k.includes('misc'))
  ) {
    return 'tpm-ancillary';
  }
  if (k.includes('ancillary')) return 'tpm-ancillary';
  if (k === 'tpm' || k.includes('tertiary') || k.includes('other component')) {
    return 'tpm-tertiary';
  }
  const exact = PM_SKU_CATEGORY_OPTIONS.find((o) => o === k);
  return exact ?? '';
}

export function pmSkuCategoryRequiresDetailSubCategory(parent: string): boolean {
  return normalizePmSkuCategoryForSelect(parent) !== '';
}

export function pmDetailSubCategoryOptionsForSkuCategory(
  parent: string
): { value: string; label: string }[] {
  const canon = normalizePmSkuCategoryForSelect(parent);
  if (!canon) return [];
  return (PM_DETAIL_SUB_CATEGORIES[canon] ?? []).map((label) => ({ value: label, label }));
}

const PM_FUNCTIONAL_CATEGORY_ALIASES: Record<string, string> = {
  'primary pack': 'Primary Pack',
  'primary packaging': 'Primary Pack',
  ppm: 'Primary Pack',
  'closures & pumps': 'Closures & Pumps',
  'closures and pumps': 'Closures & Pumps',
  closures: 'Closures & Pumps',
  'secondary pack': 'Secondary Pack',
  'secondary packaging': 'Secondary Pack',
  spm: 'Secondary Pack',
  'tertiary pack': 'Tertiary Pack',
  'tertiary packaging': 'Tertiary Pack',
  tpm: 'Tertiary Pack',
  ancillary: 'Ancillary',
  'fitments & misc': 'Ancillary',
  tubes: 'Primary Pack',
  bottles: 'Primary Pack',
  jars: 'Primary Pack',
  sachets: 'Primary Pack',
  droppers: 'Primary Pack',
  pumps: 'Closures & Pumps',
  caps: 'Closures & Pumps',
  lids: 'Closures & Pumps',
  'sheet form': 'Secondary Pack',
  'roll form': 'Secondary Pack',
  monocarton: 'Secondary Pack',
  monocartons: 'Secondary Pack',
  leaflets: 'Secondary Pack',
  shippers: 'Tertiary Pack',
  pallets: 'Tertiary Pack',
  spatulas: 'Ancillary',
  brushes: 'Ancillary',
  sponges: 'Ancillary',
  'qr cards': 'Ancillary',
};

export function normalizePmDetailSubCategoryForSelect(parent: string, raw: string): string {
  const detail = String(raw || '').trim();
  if (!detail) return '';
  const canon = normalizePmSkuCategoryForSelect(parent);
  const options = PM_DETAIL_SUB_CATEGORIES[canon] ?? [];
  const lower = detail.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  const mapped = PM_FUNCTIONAL_CATEGORY_ALIASES[lower];
  if (mapped && options.includes(mapped)) return mapped;
  return '';
}

/** Canonical functional category label for sub-category lookups. */
export function normalizePmDetailSubCategoryKey(raw: string): string {
  const detail = String(raw || '').trim();
  if (!detail) return '';
  const lower = detail.toLowerCase();
  for (const list of Object.values(PM_DETAIL_SUB_CATEGORIES)) {
    const exact = list.find((o) => o.toLowerCase() === lower);
    if (exact) return exact;
  }
  for (const key of Object.keys(PM_FUNCTIONAL_SUB_CATEGORIES)) {
    if (key.toLowerCase() === lower) return key;
  }
  return PM_FUNCTIONAL_CATEGORY_ALIASES[lower] ?? '';
}

export function pmDetailSubCategoryHasSubSubCategory(detailSub: string): boolean {
  const key = normalizePmDetailSubCategoryKey(detailSub);
  return key !== '' && (PM_SUB_SUB_CATEGORIES[key]?.length ?? 0) > 0;
}

export function pmFunctionalSubCategoryOptionsForSkuCategory(
  skuCategory: string,
  functionalCategory: string
): { value: string; label: string }[] {
  const sku = normalizePmSkuCategoryForSelect(skuCategory);
  const key = normalizePmDetailSubCategoryKey(functionalCategory);
  if (!key) return [];
  let options = PM_FUNCTIONAL_SUB_CATEGORIES[key] ?? PM_SUB_SUB_CATEGORIES[key] ?? [];
  if (key === 'Secondary Pack' && sku && PM_SECONDARY_SUBS_BY_SKU[sku]) {
    options = PM_SECONDARY_SUBS_BY_SKU[sku] ?? options;
  }
  return options.map((label) => ({ value: label, label }));
}

export function pmSubSubCategoryOptionsForDetailSubCategory(
  detailSub: string,
  skuCategory?: string
): { value: string; label: string }[] {
  return pmFunctionalSubCategoryOptionsForSkuCategory(skuCategory ?? '', detailSub);
}

export function pmUsesFunctionalCategoryTaxonomy(parentSkuCategory: string): boolean {
  return normalizePmSkuCategoryForSelect(parentSkuCategory) !== '';
}

export function normalizePmFunctionalSubCategoryKey(raw: string): string {
  const detail = String(raw || '').trim();
  if (!detail) return '';
  const lower = detail.toLowerCase();
  for (const list of Object.values(PM_FUNCTIONAL_SUB_CATEGORIES)) {
    const exact = list.find((o) => o.toLowerCase() === lower);
    if (exact) return exact;
  }
  return PM_FUNCTIONAL_SUB_CATEGORY_ALIASES[lower] ?? '';
}

const PM_FUNCTIONAL_SUB_CATEGORY_ALIASES: Record<string, string> = {
  bottle: 'Bottle',
  bottles: 'Bottle',
  tube: 'Tube',
  tubes: 'Tube',
  jar: 'Jar',
  jars: 'Jar',
  sachet: 'Sachet',
  sachets: 'Sachet',
  dropper: 'Dropper',
  droppers: 'Dropper',
  'spray (mist)': 'Spray (Mist)',
  'mist spray': 'Spray (Mist)',
  spray: 'Spray (Mist)',
  pump: 'Pump',
  pumps: 'Pump',
  cap: 'Cap',
  caps: 'Cap',
  lid: 'Cap',
  lids: 'Cap',
  sprayer: 'Sprayer',
  sprayers: 'Sprayer',
  'dropper cap': 'Dropper Cap',
  'inner plug': 'Inner Plug',
  monocarton: 'Monocarton',
  monocartons: 'Monocarton',
  'front label': 'Front Label',
  'back label': 'Back Label',
  'sheet form': 'Front Label',
  'roll form': 'Back Label',
  label: 'Front Label',
  labels: 'Front Label',
  'tamper sticker': 'Tamper Sticker',
  'tamper band': 'Tamper Sticker',
  leaflet: 'Leaflet',
  leaflets: 'Leaflet',
  pil: 'Leaflet',
  'master carton': 'Master Carton',
  shipper: 'Master Carton',
  shippers: 'Master Carton',
  'pallet material': 'Pallet Material',
  pallet: 'Pallet Material',
  pallets: 'Pallet Material',
  'stretch film': 'Stretch Film',
  strapping: 'Strapping',
  spatula: 'Spatula',
  spatulas: 'Spatula',
  brush: 'Brush',
  brushes: 'Brush',
  sponge: 'Sponge',
  sponges: 'Sponge',
  'qr card / insert': 'QR Card / Insert',
  'qr card': 'QR Card / Insert',
  'qr cards': 'QR Card / Insert',
  insert: 'QR Card / Insert',
};

export function normalizePmSubSubCategoryForSelect(
  detailSub: string,
  raw: string,
  skuCategory?: string
): string {
  const detail = String(raw || '').trim();
  if (!detail) return '';
  const key = normalizePmDetailSubCategoryKey(detailSub);
  const sku = normalizePmSkuCategoryForSelect(skuCategory ?? '');
  let options = PM_FUNCTIONAL_SUB_CATEGORIES[key] ?? PM_SUB_SUB_CATEGORIES[key] ?? [];
  if (key === 'Secondary Pack' && sku && PM_SECONDARY_SUBS_BY_SKU[sku]) {
    options = PM_SECONDARY_SUBS_BY_SKU[sku] ?? options;
  }
  const lower = detail.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  const mapped = PM_FUNCTIONAL_SUB_CATEGORY_ALIASES[lower];
  if (mapped && options.includes(mapped)) return mapped;
  return '';
}

/** Level auto-derived from category: PPM → Primary, SPM → Secondary, TPM → Tertiary. */
export function pmLevelForSubCategory(sub: string): 'Primary' | 'Secondary' | 'Tertiary' | '' {
  const canon = normalizePmSkuCategoryForSelect(sub);
  if (canon === 'ppm') return 'Primary';
  if (canon === 'spm-monocarton' || canon === 'spm-labels' || canon === 'spm-other') return 'Secondary';
  if (canon === 'tpm-tertiary' || canon === 'tpm-ancillary') return 'Tertiary';
  return '';
}

/** Internal SKU leading prefix for PM code validation / allocation. */
export function pmSubCategorySkuPrefix(sub: string): PmSkuCodePrefix | null {
  const canon = normalizePmSkuCategoryForSelect(sub);
  if (canon === 'ppm') return '4';
  if (canon === 'spm-monocarton') return '5M';
  if (canon === 'spm-labels') return '5L';
  if (canon === 'spm-other') return '5O';
  if (canon === 'tpm-tertiary') return '6T';
  if (canon === 'tpm-ancillary') return '6A';
  return null;
}

export function pmSkuMatchesCodePrefix(sku: string, prefix: PmSkuCodePrefix): boolean {
  const s = String(sku || '').trim();
  if (!s) return false;
  if (prefix === '5L') return /^5[Ll]/.test(s);
  if (prefix === '5M') return /^5M/i.test(s);
  if (prefix === '5O') return /^5O/i.test(s);
  if (prefix === '6T') return /^6T/i.test(s);
  if (prefix === '6A') return /^6A/i.test(s);
  return s.startsWith(prefix);
}

export function isCanonicalPmSkuCategory(raw: string): boolean {
  return normalizePmSkuCategoryForSelect(raw) !== '';
}
