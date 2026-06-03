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

/** Finer sub-category per PM category (stored in `optionalPmSubCategory` / `material`). */
export const PM_DETAIL_SUB_CATEGORIES: Record<PmSkuCategoryOption, readonly string[]> = {
  ppm: ['Tubes', 'Bottles', 'Jars', 'Caps', 'Lids', 'Pumps', 'Droppers', 'Sticks', 'Sachets'],
  'spm-labels': ['Sheet form', 'Roll form'],
  'spm-monocarton': ['Lock bottom', 'Reverse tuck end', 'Straight tuck end'],
  'spm-other': ['Sleeves', 'Leaflets', 'Fitments', 'Tamper sticker', 'QR cards'],
  'tpm-tertiary': ['Shippers', 'Pallets', 'Stretch film', 'Void film', 'Tape', 'Strapping'],
  'tpm-ancillary': ['Spatulas', 'Brushes', 'Sponges', 'Wands', 'Pipettes', 'Desiccants'],
};

/** Sub-sub options keyed by sub-category (Tubes, Sheet form, Sleeves, …) — stored in `optionalPmSubSubCategory`. */
export const PM_SUB_SUB_CATEGORIES: Record<string, readonly string[]> = {
  Tubes: ['Aluminium', 'Laminate / ABL', 'Plastic'],
  Bottles: ['PET', 'HDPE', 'Glass', 'Aluminium', 'Acrylic'],
  Jars: ['PET', 'Glass', 'Acrylic'],
  Caps: ['Screw', 'Disc-top', 'Flip-top', 'Child-resistant'],
  Lids: ['Twist-off', 'Snap-on', 'Friction Fit'],
  Pumps: ['Lotion Pump', 'Foaming pump', 'Mist spray', 'Treatment pump'],
  Droppers: ['Glass', 'Plastic', 'Calibrated'],
  Sticks: ['Stick', 'Roll-on'],
  Sachets: ['Single-Use', 'Refill', 'Stick-pack'],
  'Sheet form': ['Plain', 'Laminated', 'Foil-stamped'],
  'Roll form': ['Plain', 'Laminated', 'Foil-stamped'],
  'Lock bottom': ['Standard', 'Premium'],
  'Reverse tuck end': ['Standard', 'Premium'],
  'Straight tuck end': ['Standard', 'Premium'],
  Sleeves: ['Shrink', 'Stretch', 'Cardboard'],
  Leaflets: ['Single-fold', 'Multi-fold', 'Booklet'],
  Fitments: ['Plastic', 'Foam', 'Paper'],
  'Tamper sticker': ['Round', 'Square', 'Custom'],
  'QR cards': ['Standard', 'NFC - enabled'],
  Shippers: ['Corrugated', 'Plastic', 'Wooden'],
  Pallets: ['Wooden', 'Plastic', 'Metal'],
  'Stretch film': ['Hand', 'Machine'],
  'Void film': ['Bubble', 'Foam', 'Paper'],
  Tape: ['Plastic', 'Paper', 'Reinforced'],
  Strapping: ['Plastic', 'Steel'],
  Spatulas: ['Plastic', 'Wooden', 'Metal'],
  Brushes: ['Synthetic', 'Natural'],
  Sponges: ['Synthetic', 'Natural'],
  Wands: ['Plastic', 'Metal'],
  Pipettes: ['Glass', 'Plastic', 'Disposable'],
  Desiccants: ['Silica gel', 'Clay', 'Molecular Sieve'],
};

/** @deprecated Use PM_SKU_CATEGORY_OPTIONS — legacy title-case values still seen in older `group` / form_data. */
export const PM_SUB_CATEGORY_SKU_OPTIONS = ['Primary', 'Labels', 'Monocarton'] as const;

/** RM category dropdown (value = persisted on `group` / form `subCategory`; drives internal SKU). */
export const RM_SUB_CATEGORY_SKU_SELECT_OPTIONS = [
  { value: 'Bulk raw materials', label: 'Raw materials (SKU 1XXXXXX)' },
  { value: 'Fragrance', label: 'Fragrances / perfumes (SKU 2XXXXXX)' },
  { value: 'Colors & Pigments', label: 'Colours (SKU 3XXXXXX)' },
] as const;

/** Finer sub-category options per RM SKU category (stored in `optionalRmSubCategory` / form_data). */
export const RM_DETAIL_SUB_CATEGORIES: Record<RmSubCategorySkuOption, readonly string[]> = {
  'Bulk raw materials': [
    'Emulsifiers',
    'Surfactants',
    'Preservatives',
    'Solvents',
    'Waxes / butters',
    'UV filters',
    'Actives',
    'Botanicals',
    'Rheology modifiers',
  ],
  Fragrance: ['Oil soluble', 'Water soluble'],
  'Colors & Pigments': ['Oil soluble', 'Water soluble'],
};

/** Sub-sub options keyed by RM detail sub-category — stored in `optionalRmSubSubCategory`. */
export const RM_SUB_SUB_CATEGORIES: Record<string, readonly string[]> = {
  Emulsifiers: ['O/W', 'W/O'],
  Surfactants: ['Anionic', 'Cationic', 'Non-ionic', 'Amphoteric'],
  Preservatives: ['Broad spectrum', 'Below 4.5'],
  Solvents: ['Hydrophobic - light', 'Hydrophobic - heavy', 'Hydrophilic'],
  'Waxes / butters': ['Natural', 'Synthetic'],
  'UV filters': ['UVA', 'UVB', 'Broad spectrum'],
  Actives: ['Hydrophilic', 'Hydrophobic'],
  Botanicals: ['PG/glycerin base', 'Oil base', 'Aqua base'],
  'Rheology modifiers': ['ET - low', 'ET - medium', 'ET - high'],
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
  solvent: 'Solvents',
  solvents: 'Solvents',
  emulsifier: 'Emulsifiers',
  emulsifiers: 'Emulsifiers',
  surfactant: 'Surfactants',
  surfactants: 'Surfactants',
  active: 'Actives',
  actives: 'Actives',
  preservative: 'Preservatives',
  preservatives: 'Preservatives',
  'uv filter': 'UV filters',
  'uv filters': 'UV filters',
  'wax / butter': 'Waxes / butters',
  'waxes / butters': 'Waxes / butters',
  'waxes/butters': 'Waxes / butters',
  wax: 'Waxes / butters',
  waxes: 'Waxes / butters',
  butter: 'Waxes / butters',
  butters: 'Waxes / butters',
  botanical: 'Botanicals',
  botanicals: 'Botanicals',
  'rheology modifier': 'Rheology modifiers',
  'rheology modifiers': 'Rheology modifiers',
  'oil soluble': 'Oil soluble',
  'oil-soluble': 'Oil soluble',
  'water soluble': 'Water soluble',
  'water-soluble': 'Water soluble',
  vitamin: 'Actives',
  vitamins: 'Actives',
  'fine fragrance': 'Oil soluble',
  'fine fragrance compounds': 'Oil soluble',
  'essential oil': 'Oil soluble',
  'essential oils': 'Oil soluble',
  'aroma chemical': 'Oil soluble',
  'aroma chemicals': 'Oil soluble',
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
    'o/w': 'O/W',
    'w/o': 'W/O',
    anionic: 'Anionic',
    cationic: 'Cationic',
    'non-ionic': 'Non-ionic',
    'non ionic': 'Non-ionic',
    amphoteric: 'Amphoteric',
    'broad spectrum': 'Broad spectrum',
    'below 4.5': 'Below 4.5',
    'below 4.5 ph': 'Below 4.5',
    'hydrophobic - light': 'Hydrophobic - light',
    'hydrophobic light': 'Hydrophobic - light',
    'hydrophobic - heavy': 'Hydrophobic - heavy',
    'hydrophobic heavy': 'Hydrophobic - heavy',
    hydrophilic: 'Hydrophilic',
    natural: 'Natural',
    synthetic: 'Synthetic',
    uva: 'UVA',
    uvb: 'UVB',
    hydrophobic: 'Hydrophobic',
    'pg/glycerin base': 'PG/glycerin base',
    'pg glycerin base': 'PG/glycerin base',
    'oil base': 'Oil base',
    'aqua base': 'Aqua base',
    'et - low': 'ET - low',
    'et - medium': 'ET - medium',
    'et - high': 'ET - high',
    'et low': 'ET - low',
    'et medium': 'ET - medium',
    'et high': 'ET - high',
    paraben: 'Broad spectrum',
    parabens: 'Broad spectrum',
    phenoxyethanol: 'Broad spectrum',
    'organic acid': 'Below 4.5',
    isothiazolinone: 'Broad spectrum',
    organic: 'UVA',
    inorganic: 'UVB',
    hybrid: 'Broad spectrum',
    aqueous: 'Hydrophilic',
    alcohol: 'Hydrophilic',
    glycol: 'Hydrophilic',
    hydrocarbon: 'Hydrophobic - heavy',
    ester: 'Hydrophobic - light',
    silicone: 'Hydrophobic - light',
    peptide: 'Hydrophilic',
    botanical: 'Oil base',
    vitamin: 'Hydrophilic',
    mineral: 'Hydrophobic',
    'synthetic api': 'Hydrophobic',
    'oil-soluble': 'Oil base',
    'water-soluble': 'Aqua base',
    extract: 'PG/glycerin base',
    oil: 'Oil base',
    powder: 'Hydrophobic',
    hydrosol: 'Aqua base',
    blend: 'Broad spectrum',
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

export function normalizePmDetailSubCategoryForSelect(parent: string, raw: string): string {
  const detail = String(raw || '').trim();
  if (!detail) return '';
  const canon = normalizePmSkuCategoryForSelect(parent);
  const options = PM_DETAIL_SUB_CATEGORIES[canon] ?? [];
  const lower = detail.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  const aliases: Record<string, string> = {
    tube: 'Tubes',
    tubes: 'Tubes',
    bottle: 'Bottles',
    bottles: 'Bottles',
    jar: 'Jars',
    jars: 'Jars',
    cap: 'Caps',
    caps: 'Caps',
    lid: 'Lids',
    lids: 'Lids',
    pump: 'Pumps',
    pumps: 'Pumps',
    dropper: 'Droppers',
    droppers: 'Droppers',
    stick: 'Sticks',
    sticks: 'Sticks',
    sachet: 'Sachets',
    sachets: 'Sachets',
    airless: 'Pumps',
    'sheet form': 'Sheet form',
    'roll form': 'Roll form',
    'self-adhesive': 'Roll form',
    'in-mould': 'Sheet form',
    'shrink sleeve': 'Roll form',
    'wrap-around': 'Roll form',
    'lock bottom': 'Lock bottom',
    'reverse tuck end': 'Reverse tuck end',
    'straight tuck end': 'Straight tuck end',
    'standard duplex / sbs': 'Straight tuck end',
    'rigid set-up': 'Lock bottom',
    'window cartons': 'Straight tuck end',
    sleeve: 'Sleeves',
    sleeves: 'Sleeves',
    leaflet: 'Leaflets',
    leaflets: 'Leaflets',
    pil: 'Leaflets',
    fitment: 'Fitments',
    fitments: 'Fitments',
    inlay: 'Fitments',
    inlays: 'Fitments',
    tray: 'Fitments',
    trays: 'Fitments',
    'tamper band': 'Tamper sticker',
    'tamper bands': 'Tamper sticker',
    'tamper sticker': 'Tamper sticker',
    'qr card': 'QR cards',
    'qr cards': 'QR cards',
    shipper: 'Shippers',
    shippers: 'Shippers',
    'corrugated shippers': 'Shippers',
    pallet: 'Pallets',
    pallets: 'Pallets',
    'stretch film': 'Stretch film',
    'void film': 'Void film',
    tape: 'Tape',
    strapping: 'Strapping',
    spatula: 'Spatulas',
    spatulas: 'Spatulas',
    brush: 'Brushes',
    brushes: 'Brushes',
    sponge: 'Sponges',
    sponges: 'Sponges',
    wand: 'Wands',
    wands: 'Wands',
    pipette: 'Pipettes',
    pipettes: 'Pipettes',
    desiccant: 'Desiccants',
    desiccants: 'Desiccants',
  };
  const mapped = aliases[lower];
  if (mapped && options.includes(mapped)) return mapped;
  return '';
}

/** Canonical sub-category label (Tubes, Bottles, …) for sub-sub lookups. */
export function normalizePmDetailSubCategoryKey(raw: string): string {
  const detail = String(raw || '').trim();
  if (!detail) return '';
  const lower = detail.toLowerCase();
  for (const list of Object.values(PM_DETAIL_SUB_CATEGORIES)) {
    const exact = list.find((o) => o.toLowerCase() === lower);
    if (exact) return exact;
  }
  const aliases: Record<string, string> = {
    tube: 'Tubes',
    bottle: 'Bottles',
    jar: 'Jars',
    cap: 'Caps',
    lid: 'Lids',
    pump: 'Pumps',
    dropper: 'Droppers',
    stick: 'Sticks',
    sachet: 'Sachets',
    'sheet form': 'Sheet form',
    'roll form': 'Roll form',
    'lock bottom': 'Lock bottom',
    'reverse tuck end': 'Reverse tuck end',
    'straight tuck end': 'Straight tuck end',
    sleeve: 'Sleeves',
    sleeves: 'Sleeves',
    leaflet: 'Leaflets',
    leaflets: 'Leaflets',
    fitment: 'Fitments',
    fitments: 'Fitments',
    'tamper sticker': 'Tamper sticker',
    'tamper stickers': 'Tamper sticker',
    'qr card': 'QR cards',
    'qr cards': 'QR cards',
    shipper: 'Shippers',
    shippers: 'Shippers',
    pallet: 'Pallets',
    pallets: 'Pallets',
    'stretch film': 'Stretch film',
    'void film': 'Void film',
    'void fill': 'Void film',
    tape: 'Tape',
    strapping: 'Strapping',
    spatula: 'Spatulas',
    spatulas: 'Spatulas',
    brush: 'Brushes',
    brushes: 'Brushes',
    sponge: 'Sponges',
    sponges: 'Sponges',
    wand: 'Wands',
    wands: 'Wands',
    pipette: 'Pipettes',
    pipettes: 'Pipettes',
    desiccant: 'Desiccants',
    desiccants: 'Desiccants',
  };
  return aliases[lower] ?? '';
}

export function pmDetailSubCategoryHasSubSubCategory(detailSub: string): boolean {
  const key = normalizePmDetailSubCategoryKey(detailSub);
  return key !== '' && (PM_SUB_SUB_CATEGORIES[key]?.length ?? 0) > 0;
}

export function pmSubSubCategoryOptionsForDetailSubCategory(
  detailSub: string
): { value: string; label: string }[] {
  const key = normalizePmDetailSubCategoryKey(detailSub);
  if (!key) return [];
  return (PM_SUB_SUB_CATEGORIES[key] ?? []).map((label) => ({ value: label, label }));
}

export function normalizePmSubSubCategoryForSelect(detailSub: string, raw: string): string {
  const detail = String(raw || '').trim();
  if (!detail) return '';
  const key = normalizePmDetailSubCategoryKey(detailSub);
  const options = PM_SUB_SUB_CATEGORIES[key] ?? [];
  const lower = detail.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  const aliases: Record<string, string> = {
    aluminum: 'Aluminium',
    aluminium: 'Aluminium',
    'laminate / abl': 'Laminate / ABL',
    'laminate/ abl': 'Laminate / ABL',
    'laminate abl': 'Laminate / ABL',
    plastic: 'Plastic',
    pet: 'PET',
    hdpe: 'HDPE',
    glass: 'Glass',
    acrylic: 'Acrylic',
    screw: 'Screw',
    'disc-top': 'Disc-top',
    'flip-top': 'Flip-top',
    'child resistant': 'Child-resistant',
    'child-resistant': 'Child-resistant',
    'twist-off': 'Twist-off',
    'twist off': 'Twist-off',
    'snap-on': 'Snap-on',
    'snap on': 'Snap-on',
    'friction fit': 'Friction Fit',
    'lotion pump': 'Lotion Pump',
    'foaming pump': 'Foaming pump',
    'mist spray': 'Mist spray',
    'treatment pump': 'Treatment pump',
    calibrated: 'Calibrated',
    'roll-on': 'Roll-on',
    'roll on': 'Roll-on',
    'single-use': 'Single-Use',
    'single use': 'Single-Use',
    refill: 'Refill',
    'stick-pack': 'Stick-pack',
    'stick pack': 'Stick-pack',
    plain: 'Plain',
    laminated: 'Laminated',
    'foil-stamped': 'Foil-stamped',
    'foil stamped': 'Foil-stamped',
    standard: 'Standard',
    premium: 'Premium',
    shrink: 'Shrink',
    stretch: 'Stretch',
    cardboard: 'Cardboard',
    'single-fold': 'Single-fold',
    'single fold': 'Single-fold',
    'multi-fold': 'Multi-fold',
    'multi fold': 'Multi-fold',
    booklet: 'Booklet',
    foam: 'Foam',
    paper: 'Paper',
    round: 'Round',
    square: 'Square',
    custom: 'Custom',
    'nfc - enabled': 'NFC - enabled',
    'nfc-enabled': 'NFC - enabled',
    'nfc enabled': 'NFC - enabled',
    corrugated: 'Corrugated',
    corrogated: 'Corrugated',
    wooden: 'Wooden',
    metal: 'Metal',
    hand: 'Hand',
    machine: 'Machine',
    bubble: 'Bubble',
    reinforced: 'Reinforced',
    steel: 'Steel',
    synthetic: 'Synthetic',
    natural: 'Natural',
    disposable: 'Disposable',
    'silica gel': 'Silica gel',
    clay: 'Clay',
    'molecular sieve': 'Molecular Sieve',
  };
  const mapped = aliases[lower];
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
