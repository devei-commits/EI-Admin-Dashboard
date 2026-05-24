/**
 * RM / PM master dropdowns aligned with internal SKU rules + multi-sheet Excel import
 * (see ei-website-backend/src/masterBulk/rmMasterExcelUpload.js and pmMasterExcelUpload.js).
 */

/** RM workbook tabs / canonical sub-categories — Bulk/Fragrance/Colors: leading digit 1/2/3 + 6 digits (7 total); Club: CLUB + 5 digits. */
export const RM_SUB_CATEGORY_SKU_OPTIONS = [
  'Bulk raw materials',
  'Fragrance',
  'Colors & Pigments',
  'Club Items',
] as const;

export type RmSubCategorySkuOption = (typeof RM_SUB_CATEGORY_SKU_OPTIONS)[number];

/** Map DB / Excel / legacy `group` strings to a canonical dropdown value. */
export function normalizeRmSubCategoryForSelect(raw: string): RmSubCategorySkuOption | '' {
  const k = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!k) return '';
  if (k === 'fragrance' || k === 'fragrances') return 'Fragrance';
  if (k === 'colors & pigments' || k === 'color & pigments') return 'Colors & Pigments';
  if (k === 'club items' || k === 'club item') return 'Club Items';
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
  { value: 'ppm', label: 'PPM — Primary (SKU 4…)' },
  { value: 'spm-labels', label: 'SPM — Labels (SKU 5L…)' },
  { value: 'spm-monocarton', label: 'SPM — Monocartons (SKU 5M…)' },
  { value: 'spm-other', label: 'SPM — Other Secondary (SKU 5O…)' },
  { value: 'tpm-tertiary', label: 'TPM — Tertiary (SKU 6T…)' },
  { value: 'tpm-ancillary', label: 'TPM — Ancillary (SKU 6A…)' },
] as const;

/** Finer sub-category per PM category (stored in `optionalPmSubCategory` / `material`). */
export const PM_DETAIL_SUB_CATEGORIES: Record<PmSkuCategoryOption, readonly string[]> = {
  ppm: ['Tubes', 'Bottles', 'Jars', 'Caps', 'Pumps', 'Droppers', 'Sticks', 'Sachets', 'Airless'],
  'spm-labels': ['Self-adhesive', 'In-mould', 'Shrink sleeve', 'Wrap-around'],
  'spm-monocarton': ['Standard duplex / SBS', 'Rigid set-up', 'Window cartons'],
  'spm-other': ['Sleeves', 'Inlays', 'Trays', 'Tamper bands', 'Leaflets', 'PIL', 'QR cards'],
  'tpm-tertiary': ['Corrugated shippers', 'Pallets', 'Stretch film', 'Strapping'],
  'tpm-ancillary': ['Spatulas', 'Brushes', 'Sponges', 'Wands', 'Pipettes', 'Desiccants'],
};

/** @deprecated Use PM_SKU_CATEGORY_OPTIONS — legacy title-case values still seen in older `group` / form_data. */
export const PM_SUB_CATEGORY_SKU_OPTIONS = ['Primary', 'Labels', 'Monocarton'] as const;

/** RM category dropdown (value = persisted on `group` / form `subCategory`; drives internal SKU). */
export const RM_SUB_CATEGORY_SKU_SELECT_OPTIONS = [
  { value: 'Bulk raw materials', label: 'Bulk raw materials (SKU starts with 1)' },
  { value: 'Fragrance', label: 'Fragrance (SKU starts with 2)' },
  { value: 'Colors & Pigments', label: 'Colors & pigments (SKU starts with 3)' },
  { value: 'Club Items', label: 'Club items (SKU starts with CLUB)' },
] as const;

/** Finer sub-category options per RM SKU category (stored in `optionalRmSubCategory` / form_data). */
export const RM_DETAIL_SUB_CATEGORIES: Record<RmSubCategorySkuOption, readonly string[]> = {
  'Bulk raw materials': [
    'Solvents',
    'Emulsifiers',
    'Surfactants',
    'Actives',
    'Preservatives',
    'UV filters',
    'Vitamins',
    'Botanicals',
  ],
  Fragrance: ['Fine fragrance compounds', 'Essential oils', 'Aroma chemicals'],
  'Colors & Pigments': [
    'Iron oxides',
    'TiO₂',
    'ZnO',
    'Organic dyes',
    'Lakes',
    'Pearlescent pigments',
  ],
  'Club Items': [],
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
  const aliases: Record<string, string> = {
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
    vitamin: 'Vitamins',
    vitamins: 'Vitamins',
    botanical: 'Botanicals',
    botanicals: 'Botanicals',
    'fine fragrance': 'Fine fragrance compounds',
    'fine fragrance compounds': 'Fine fragrance compounds',
    'essential oil': 'Essential oils',
    'essential oils': 'Essential oils',
    'aroma chemical': 'Aroma chemicals',
    'aroma chemicals': 'Aroma chemicals',
    'iron oxide': 'Iron oxides',
    'iron oxides': 'Iron oxides',
    tio2: 'TiO₂',
    'titanium dioxide': 'TiO₂',
    zno: 'ZnO',
    'zinc oxide': 'ZnO',
    'organic dye': 'Organic dyes',
    'organic dyes': 'Organic dyes',
    lake: 'Lakes',
    lakes: 'Lakes',
    'pearlescent pigment': 'Pearlescent pigments',
    'pearlescent pigments': 'Pearlescent pigments',
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
    k.includes('bulk raw') ||
    k === 'club items'
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
