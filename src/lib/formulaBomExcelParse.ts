/**
 * Client-side parse for Formula BOM workbook: Summary + RM BOM + PM BOM worksheets.
 * Used for chunked uploads with progress; avoids sending the whole workbook repeatedly.
 */

import * as XLSX from 'xlsx';

export interface FormulaBomParsedRow {
  row_number: number;
  composite_sku: string;
  composite_name: string;
  component_sku: string;
  component_name: string;
  qty: number;
  uom_raw: string;
  limit_qty_vol_kg_ltr: number | null;
  limit_qty_volume: number | null;
  sg: number;
  /** RM BOM block format: Formula % column → % w/w on formula BOM. */
  pct_w_w?: number | null;
}

export interface FormulaSummaryParsedRow {
  row_number: number;
  sku: string;
  product_name: string;
  category: string;
  pr_sub_category: string;
  pack_size: number | null;
  unit: string;
  rm_count: number | null;
  pm_count: number | null;
  total_rm_gm: number | null;
}

function normalizeHeader(raw: unknown): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[\s_\-.]+/g, ' ')
    .replace(/[()/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSheetLabel(s: string): string {
  return normalizeHeader(s);
}

function cellToText(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v).trim();
  if (typeof v === 'boolean') return String(v).trim();
  return String(v).trim();
}

function cellToNumber(v: unknown): number {
  const raw = cellToText(v);
  if (!raw) return NaN;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  if (!cleaned) return NaN;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Formula % column → pct_w_w stored on 0–100 scale (1 = 1%, 100 = 100%).
 * Excel often shows "1.0000%" while the parsed number is 1, not 0.01 — do not multiply those.
 */
function cellToFormulaPercent(v: unknown): number {
  const text = cellToText(v);
  if (!text) return NaN;
  const n = cellToNumber(v);
  if (!Number.isFinite(n)) return NaN;
  if (/%/.test(text)) {
    return n;
  }
  if (n > 0 && n <= 1) {
    return n * 100;
  }
  return n;
}

/** Internal RM code for filler "AQUA (q.s. to 100%)" when Component SKU is blank. */
export const AQUA_RM_MASTER_CODE = '1000612';

/** Excel label for filler water — map to {@link AQUA_RM_ZOHO_SKU}, not the display name. */
export function isAquaQsFillerName(value: unknown): boolean {
  const norm = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[()/\\]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!norm.includes('aqua')) return false;
  return (
    norm.includes('q s') ||
    norm.includes('q.s') ||
    norm.includes('qs to') ||
    (norm.includes('100') && norm.includes('%'))
  );
}

export function applyAquaSkuFromQsName(componentSku: unknown, componentName: unknown): string {
  if (!isAquaQsFillerName(componentName)) {
    return cellToText(componentSku);
  }
  const sku = cellToText(componentSku);
  if (sku && !isAquaQsFillerName(sku)) {
    return sku;
  }
  return AQUA_RM_MASTER_CODE;
}

/** 0-based column indices from Summary header row cells. */
function detectSummaryHeaders(headerRow: unknown[]): {
  map: Record<string, number>;
  headers: string[];
} {
  const map: Record<string, number> = {};
  const flat = headerRow.map((h) => String(h ?? '').trim()).filter(Boolean);
  headerRow.forEach((h, idx) => {
    if (h === '' || h == null) return;
    const norm = normalizeHeader(h);
    if (norm === 'sub sub category' && map.pr_sub_category == null) {
      map.pr_sub_category = idx;
    } else if (
      (norm === 'sub category' || norm === 'subcategory') &&
      map.category == null &&
      !norm.includes('sub sub')
    ) {
      map.category = idx;
    } else if (
      (norm === 'product name' || norm === 'product') &&
      map.product_name == null
    ) {
      map.product_name = idx;
    } else if (
      (norm === 'sku' || norm === 'sku code' || norm === 'product sku') &&
      map.sku == null
    ) {
      map.sku = idx;
    } else if (
      (norm === 'pack size' || norm === 'packsize') &&
      map.pack_size == null
    ) {
      map.pack_size = idx;
    } else if (
      (norm === 'unit' || norm === 'uom' || norm === 'unit of measure') &&
      map.unit == null
    ) {
      map.unit = idx;
    } else if ((norm === 'rm count' || norm === 'rmcount') && map.rm_count == null) {
      map.rm_count = idx;
    } else if ((norm === 'pm count' || norm === 'pmcount') && map.pm_count == null) {
      map.pm_count = idx;
    } else if (
      (norm === 'total rm gm' ||
        norm === 'total rm g' ||
        norm === 'total rm gm gm' ||
        norm.startsWith('total rm')) &&
      map.total_rm_gm == null
    ) {
      map.total_rm_gm = idx;
    }
  });
  return { map, headers: flat };
}

function parseSummaryRowsFromMatrix(
  data: unknown[][],
  m: Record<string, number>
): FormulaSummaryParsedRow[] {
  const rows: FormulaSummaryParsedRow[] = [];
  for (let i = 1; i < data.length; i += 1) {
    const line = data[i] as unknown[];
    const rowNum = i + 1;
    const get = (key: string) => {
      const idx = m[key];
      return idx == null ? '' : line[idx];
    };

    const sku = cellToText(get('sku'));
    const productName = cellToText(get('product_name'));
    const category = cellToText(get('category'));
    const prSubCategory = cellToText(get('pr_sub_category'));
    const packSizeRaw = cellToNumber(get('pack_size'));
    const unit = cellToText(get('unit'));
    const rmCountRaw = cellToNumber(get('rm_count'));
    const pmCountRaw = cellToNumber(get('pm_count'));
    const totalRmGmRaw = cellToNumber(get('total_rm_gm'));

    if (!sku && !productName) continue;

    rows.push({
      row_number: rowNum,
      sku,
      product_name: productName,
      category,
      pr_sub_category: prSubCategory,
      pack_size: Number.isFinite(packSizeRaw) ? packSizeRaw : null,
      unit,
      rm_count: Number.isFinite(rmCountRaw) ? Math.max(0, Math.round(rmCountRaw)) : null,
      pm_count: Number.isFinite(pmCountRaw) ? Math.max(0, Math.round(pmCountRaw)) : null,
      total_rm_gm: Number.isFinite(totalRmGmRaw) ? totalRmGmRaw : null,
    });
  }
  return rows;
}

function parseSummarySheet(
  sheetName: string,
  ws: XLSX.WorkSheet
): { rows: FormulaSummaryParsedRow[]; error?: string } {
  const data = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];
  if (!data || data.length < 2) {
    return { rows: [], error: `Sheet "${sheetName}" has no data rows` };
  }
  const headerRow = data[0] as unknown[];
  const { map: m, headers } = detectSummaryHeaders(headerRow);
  const missing: string[] = [];
  if (m.sku == null) missing.push('SKU');
  if (m.product_name == null) missing.push('Product Name');
  if (m.pack_size == null) missing.push('Pack Size');
  if (m.unit == null) missing.push('Unit');
  if (missing.length > 0) {
    return {
      rows: [],
      error: `Sheet "${sheetName}" missing column(s): ${missing.join(', ')}. Found: ${headers.join(', ')}`,
    };
  }
  return { rows: parseSummaryRowsFromMatrix(data, m) };
}

/** 0-based column indices from header row cells. */
function detectFormulaHeaders(headerRow: unknown[]): {
  map: Record<string, number>;
  headers: string[];
} {
  const map: Record<string, number> = {};
  let qtyPerKgLtrIdx: number | null = null;
  let fallbackQtyIdx: number | null = null;
  const flat = headerRow.map((h) => String(h ?? '').trim()).filter(Boolean);
  headerRow.forEach((h, idx) => {
    if (h === '' || h == null) return;
    const norm = normalizeHeader(h);
    if (
      (norm === 'composite sku' ||
        norm === 'sku code' ||
        norm === 'product sku' ||
        norm === 'product sku code' ||
        norm === 'fg sku') &&
      map.composite_sku == null
    ) {
      map.composite_sku = idx;
    } else if (norm === 'composite name' && map.composite_name == null) map.composite_name = idx;
    else if (
      (norm === 'volume in kg ltr' || norm === 'volume in kg litre' || norm === 'volume in kg liter') &&
      map.volume_kg_ltr == null
    ) {
      map.volume_kg_ltr = idx;
    } else if (norm === 'volume' && map.volume == null) {
      map.volume = idx;
    } else if ((norm === 'uom' || norm === 'unit' || norm === 'unit of measure') && map.uom == null) {
      map.uom = idx;
    } else if ((norm === 'sg' || norm === 'specific gravity') && map.sg == null) {
      map.sg = idx;
    } else if (
      (norm === 'component sku' ||
        norm === 'component sku code' ||
        norm === 'item sku' ||
        norm === 'material sku') &&
      map.component_sku == null
    ) {
      map.component_sku = idx;
    } else if (norm === 'component name' && map.component_name == null) map.component_name = idx;
    else if (
      (norm === 'qty kg ltr' ||
        norm === 'qty in kg ltr' ||
        norm === 'qty kg litre' ||
        norm === 'qty kg liter' ||
        norm === 'qty per kg ltr' ||
        norm === 'qty per kg litre' ||
        norm === 'qty per kg liter') &&
      qtyPerKgLtrIdx == null
    ) {
      qtyPerKgLtrIdx = idx;
    } else if (
      (norm === 'qty per unit' || norm === 'qty per sku kg nos' || norm === 'qty per sku' || norm === 'quantity per unit') &&
      fallbackQtyIdx == null
    ) {
      fallbackQtyIdx = idx;
    }
  });
  map.qty = qtyPerKgLtrIdx ?? fallbackQtyIdx ?? map.qty;
  return { map, headers: flat };
}

function parseRowsFromMatrix(
  sheetName: string,
  data: unknown[][],
  m: Record<string, number>
): FormulaBomParsedRow[] {
  const rows: FormulaBomParsedRow[] = [];
  for (let i = 1; i < data.length; i += 1) {
    const line = data[i] as unknown[];
    const rowNum = i + 1;
    const get = (key: keyof typeof m) => {
      const idx = m[key];
      return idx == null ? '' : line[idx];
    };

    const compositeSku = cellToText(get('composite_sku'));
    const componentSku = cellToText(get('component_sku'));
    const componentName = cellToText(get('component_name'));
    const qty = cellToNumber(get('qty'));
    const uomRaw = cellToText(get('uom'));
    const volKgCell = m.volume_kg_ltr != null ? line[m.volume_kg_ltr] : null;
    const volCell = m.volume != null ? line[m.volume] : null;
    const sgCell = m.sg != null ? line[m.sg] : null;
    const compositeName = m.composite_name != null ? cellToText(line[m.composite_name]) : '';

    const limitQtyPrimary = volKgCell != null ? cellToNumber(volKgCell) : NaN;
    const limitQtyFallback = volCell != null ? cellToNumber(volCell) : NaN;

    if (!compositeSku && !componentSku && !componentName && !Number.isFinite(qty)) continue;

    rows.push({
      row_number: rowNum,
      composite_sku: compositeSku,
      composite_name: compositeName,
      component_sku: componentSku,
      component_name: componentName,
      qty: Number.isFinite(qty) ? qty : 0,
      uom_raw: uomRaw,
      limit_qty_vol_kg_ltr: Number.isFinite(limitQtyPrimary) ? limitQtyPrimary : null,
      limit_qty_volume: Number.isFinite(limitQtyFallback) ? limitQtyFallback : null,
      sg: sgCell != null ? cellToNumber(sgCell) : NaN,
    });
  }
  return rows;
}

/** PR block header in column A: `NAME | category | SKU: PR0006792 | Pack: 100 ML` */
export function isPrBlockHeaderCell(colA: string): boolean {
  const t = String(colA || '').trim();
  return t.length > 0 && /SKU\s*:/i.test(t);
}

export function extractSkuFromPrBlockHeader(colA: string): string {
  const m = String(colA || '').match(/SKU\s*:\s*([^\s|]+)/i);
  return m ? String(m[1]).trim() : '';
}

export function extractProductNameFromPrBlockHeader(colA: string): string {
  const t = String(colA || '').trim();
  const first = t.split('|')[0];
  return first ? first.trim() : t;
}

function detectRmBomSubHeaders(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    if (h === '' || h == null) return;
    const norm = normalizeHeader(h);
    if (norm === 'component name' && map.component_name == null) {
      map.component_name = idx;
    } else if (
      (norm === 'sku' ||
        norm === 'component sku' ||
        norm === 'component sku code' ||
        norm === 'material sku') &&
      map.component_sku == null
    ) {
      map.component_sku = idx;
    } else if (
      (norm === 'formula %' ||
        norm === 'formula pct' ||
        norm === 'formula percent' ||
        norm === 'formula % w w' ||
        norm === 'formula % w/w') &&
      map.formula_pct == null
    ) {
      map.formula_pct = idx;
    }
  });
  return map;
}

type SummaryLineCountKey = 'rm_count' | 'pm_count';

function resolveSummaryForBlock(
  headerCell: string,
  summaryRows: FormulaSummaryParsedRow[],
  countKey: SummaryLineCountKey
): { sku: string; product_name: string; line_count: number } | null {
  const headerSku = extractSkuFromPrBlockHeader(headerCell);
  const headerName = extractProductNameFromPrBlockHeader(headerCell).toLowerCase();

  const lineCountFromRow = (row: FormulaSummaryParsedRow): number => {
    const n = Number(row[countKey]);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  };

  if (headerSku) {
    const bySku = summaryRows.find(
      (r) => String(r.sku || '').trim().toLowerCase() === headerSku.toLowerCase()
    );
    if (bySku) {
      return {
        sku: String(bySku.sku).trim(),
        product_name: bySku.product_name,
        line_count: lineCountFromRow(bySku),
      };
    }
  }

  if (headerName) {
    const byName = summaryRows.find((r) => {
      const pn = String(r.product_name || '').trim().toLowerCase();
      if (!pn) return false;
      return headerName.startsWith(pn) || pn.startsWith(headerName);
    });
    if (byName) {
      return {
        sku: String(byName.sku).trim(),
        product_name: byName.product_name,
        line_count: lineCountFromRow(byName),
      };
    }
  }

  if (headerSku) {
    return {
      sku: headerSku,
      product_name: extractProductNameFromPrBlockHeader(headerCell),
      line_count: 0,
    };
  }
  return null;
}

function detectPmBomSubHeaders(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    if (h === '' || h == null) return;
    const norm = normalizeHeader(h);
    if (norm === 'component name' && map.component_name == null) {
      map.component_name = idx;
    } else if (
      (norm === 'sku' ||
        norm === 'component sku' ||
        norm === 'component sku code' ||
        norm === 'material sku') &&
      map.component_sku == null
    ) {
      map.component_sku = idx;
    } else if (
      (norm === 'qty unit' ||
        norm === 'qty per unit' ||
        norm === 'quantity per unit' ||
        norm === 'qty per sku' ||
        norm === 'qty per sku nos') &&
      map.qty_per_unit == null
    ) {
      map.qty_per_unit = idx;
    }
  });
  return map;
}

function isPmLineEmpty(line: unknown[], subMap: Record<string, number>): boolean {
  const name =
    subMap.component_name != null ? cellToText(line[subMap.component_name]) : '';
  const sku = subMap.component_sku != null ? cellToText(line[subMap.component_sku]) : '';
  const qty =
    subMap.qty_per_unit != null ? cellToNumber(line[subMap.qty_per_unit]) : NaN;
  return !name && !sku && !Number.isFinite(qty);
}

function isRmLineEmpty(line: unknown[], subMap: Record<string, number>): boolean {
  const name =
    subMap.component_name != null ? cellToText(line[subMap.component_name]) : '';
  const sku = subMap.component_sku != null ? cellToText(line[subMap.component_sku]) : '';
  const pct =
    subMap.formula_pct != null ? cellToFormulaPercent(line[subMap.formula_pct]) : NaN;
  return !name && !sku && !Number.isFinite(pct);
}

/**
 * RM BOM sheet: merged column A blocks per PR; line count from Summary RM Count.
 */
export function parseRmBomBlockSheet(
  sheetName: string,
  ws: XLSX.WorkSheet,
  summaryRows: FormulaSummaryParsedRow[]
): { rows: FormulaBomParsedRow[]; warnings: string[]; error?: string } {
  const warnings: string[] = [];
  const data = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  if (!data || data.length < 2) {
    return { rows: [], warnings, error: `Sheet "${sheetName}" has no data rows` };
  }

  const hasBlockFormat = data.some((line) => isPrBlockHeaderCell(cellToText(line?.[0])));
  if (!hasBlockFormat) {
    return {
      rows: [],
      warnings,
      error: `Sheet "${sheetName}" has no PR block headers (expected "SKU:" in column A).`,
    };
  }

  const rows: FormulaBomParsedRow[] = [];
  let i = 0;

  while (i < data.length) {
    const headerCell = cellToText(data[i]?.[0]);
    if (!isPrBlockHeaderCell(headerCell)) {
      i += 1;
      continue;
    }

    const resolved = resolveSummaryForBlock(headerCell, summaryRows, 'rm_count');
    if (!resolved) {
      warnings.push(`RM BOM row ${i + 1}: could not match PR block to Summary (${headerCell.slice(0, 60)}…)`);
      i += 1;
      continue;
    }

    const { sku: compositeSku, product_name: compositeName, line_count: rmCount } = resolved;
    i += 1;

    if (i >= data.length) break;
    const subMap = detectRmBomSubHeaders(data[i] as unknown[]);
    if (subMap.component_name == null || subMap.formula_pct == null) {
      warnings.push(
        `RM BOM block for ${compositeSku}: missing Component Name or Formula % sub-header at row ${i + 1}.`
      );
      i += 1;
      continue;
    }
    i += 1;

    let linesRead = 0;
    let blankAStreak = 0;
    const maxLines = rmCount > 0 ? rmCount : 500;

    while (i < data.length && linesRead < maxLines) {
      const line = data[i] as unknown[];
      const colA = cellToText(line?.[0]);

      if (isPrBlockHeaderCell(colA)) break;

      if (!colA) {
        blankAStreak += 1;
        if (rmCount > 0 && linesRead >= rmCount) break;
        if (rmCount <= 0 && blankAStreak >= 2) break;
        i += 1;
        if (isRmLineEmpty(line, subMap)) continue;
      } else {
        blankAStreak = 0;
      }

      if (isRmLineEmpty(line, subMap)) {
        if (linesRead > 0 && rmCount > 0 && linesRead >= rmCount) break;
        i += 1;
        continue;
      }

      const componentName = cellToText(line[subMap.component_name]);
      const componentSkuRaw =
        subMap.component_sku != null ? cellToText(line[subMap.component_sku]) : '';
      const componentSku = applyAquaSkuFromQsName(componentSkuRaw, componentName);
      const pct = cellToFormulaPercent(line[subMap.formula_pct]);

      rows.push({
        row_number: i + 1,
        composite_sku: compositeSku,
        composite_name: compositeName,
        component_sku: componentSku,
        component_name: componentName,
        qty: 0,
        uom_raw: 'KG',
        limit_qty_vol_kg_ltr: null,
        limit_qty_volume: null,
        sg: NaN,
        pct_w_w: Number.isFinite(pct) ? pct : null,
      });

      linesRead += 1;
      i += 1;
    }

    while (i < data.length && !cellToText(data[i]?.[0])) {
      i += 1;
    }
  }

  if (rows.length === 0) {
    return {
      rows: [],
      warnings,
      error: `Sheet "${sheetName}" parsed no RM formula lines from block layout.`,
    };
  }

  return { rows, warnings };
}

/**
 * PM BOM sheet: same column-A PR blocks as RM BOM; line count from Summary PM Count.
 * Sub-header: # | Component Name | SKU | Qty/Unit → qty_per_unit on pack BOM.
 */
export function parsePmBomBlockSheet(
  sheetName: string,
  ws: XLSX.WorkSheet,
  summaryRows: FormulaSummaryParsedRow[]
): { rows: FormulaBomParsedRow[]; warnings: string[]; error?: string } {
  const warnings: string[] = [];
  const data = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  if (!data || data.length < 2) {
    return { rows: [], warnings, error: `Sheet "${sheetName}" has no data rows` };
  }

  const hasBlockFormat = data.some((line) => isPrBlockHeaderCell(cellToText(line?.[0])));
  if (!hasBlockFormat) {
    return {
      rows: [],
      warnings,
      error: `Sheet "${sheetName}" has no PR block headers (expected "SKU:" in column A).`,
    };
  }

  const rows: FormulaBomParsedRow[] = [];
  let i = 0;

  while (i < data.length) {
    const headerCell = cellToText(data[i]?.[0]);
    if (!isPrBlockHeaderCell(headerCell)) {
      i += 1;
      continue;
    }

    const resolved = resolveSummaryForBlock(headerCell, summaryRows, 'pm_count');
    if (!resolved) {
      warnings.push(`PM BOM row ${i + 1}: could not match PR block to Summary (${headerCell.slice(0, 60)}…)`);
      i += 1;
      continue;
    }

    const { sku: compositeSku, product_name: compositeName, line_count: pmCount } = resolved;
    i += 1;

    if (i >= data.length) break;
    const subMap = detectPmBomSubHeaders(data[i] as unknown[]);
    if (subMap.component_name == null || subMap.qty_per_unit == null) {
      warnings.push(
        `PM BOM block for ${compositeSku}: missing Component Name or Qty/Unit sub-header at row ${i + 1}.`
      );
      i += 1;
      continue;
    }
    i += 1;

    let linesRead = 0;
    let blankAStreak = 0;
    const maxLines = pmCount > 0 ? pmCount : 500;
    const blankStreakLimit = pmCount > 0 ? 1 : 2;

    while (i < data.length && linesRead < maxLines) {
      const line = data[i] as unknown[];
      const colA = cellToText(line?.[0]);

      if (isPrBlockHeaderCell(colA)) break;

      if (!colA) {
        blankAStreak += 1;
        if (pmCount > 0 && linesRead >= pmCount) break;
        if (blankAStreak >= blankStreakLimit) break;
        i += 1;
        if (isPmLineEmpty(line, subMap)) continue;
      } else {
        blankAStreak = 0;
      }

      if (isPmLineEmpty(line, subMap)) {
        if (linesRead > 0 && pmCount > 0 && linesRead >= pmCount) break;
        i += 1;
        continue;
      }

      const componentName = cellToText(line[subMap.component_name]);
      const componentSku =
        subMap.component_sku != null ? cellToText(line[subMap.component_sku]) : '';
      const qty = cellToNumber(line[subMap.qty_per_unit]);

      rows.push({
        row_number: i + 1,
        composite_sku: compositeSku,
        composite_name: compositeName,
        component_sku: componentSku,
        component_name: componentName,
        qty: Number.isFinite(qty) && qty >= 0 ? qty : 0,
        uom_raw: 'PCS',
        limit_qty_vol_kg_ltr: null,
        limit_qty_volume: null,
        sg: NaN,
      });

      linesRead += 1;
      i += 1;
    }

    while (i < data.length && !cellToText(data[i]?.[0])) {
      i += 1;
    }
  }

  if (rows.length === 0) {
    return {
      rows: [],
      warnings,
      error: `Sheet "${sheetName}" parsed no PM packaging lines from block layout.`,
    };
  }

  return { rows, warnings };
}

function parseSheet(
  sheetName: string,
  ws: XLSX.WorkSheet
): { rows: FormulaBomParsedRow[]; error?: string } {
  const data = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];
  if (!data || data.length < 2) {
    return { rows: [], error: `Sheet "${sheetName}" has no data rows` };
  }
  const headerRow = data[0] as unknown[];
  const { map: m, headers } = detectFormulaHeaders(headerRow);
  const missing: string[] = [];
  if (m.composite_sku == null) missing.push('Composite SKU (or SKU Code)');
  if (m.component_sku == null) missing.push('Component SKU');
  if (m.component_name == null) missing.push('Component Name');
  if (m.qty == null) missing.push('Qty per KG/LTR');
  if (m.uom == null) missing.push('UoM');
  if (missing.length > 0) {
    return {
      rows: [],
      error: `Sheet "${sheetName}" missing column(s): ${missing.join(', ')}. Found: ${headers.join(', ')}`,
    };
  }
  return { rows: parseRowsFromMatrix(sheetName, data, m) };
}

function pickSheetByNames(names: string[], candidates: string[]): string | null {
  for (const candidate of candidates) {
    const exact = names.find((n) => n.trim() === candidate);
    if (exact) return exact;
    const target = normalizeSheetLabel(candidate);
    const byNorm = names.find((n) => normalizeSheetLabel(n) === target);
    if (byNorm) return byNorm;
  }
  return null;
}

export function pickSummarySheetName(names: string[]): string | null {
  return pickSheetByNames(names, ['Summary']);
}

export function pickRmSheetName(names: string[]): string | null {
  const picked = pickSheetByNames(names, ['RM BOM', 'Formula BOM - RM per KG-LTR']);
  if (picked) return picked;
  return (
    names.find((n) => {
      const x = normalizeSheetLabel(n);
      return x.includes('formula') && x.includes('bom') && !x.includes('pack');
    }) ?? null
  );
}

export function pickPackSheetName(names: string[]): string | null {
  const picked = pickSheetByNames(names, ['PM BOM', 'Packaging BOM']);
  if (picked) return picked;
  return (
    names.find((n) => {
      const x = normalizeSheetLabel(n);
      return (x.includes('packaging') || x === 'pm bom') && x.includes('bom');
    }) ?? null
  );
}

export function groupRowsByCompositeSku(rows: FormulaBomParsedRow[]): Map<string, FormulaBomParsedRow[]> {
  const map = new Map<string, FormulaBomParsedRow[]>();
  for (const r of rows) {
    const key = String(r.composite_sku || '').trim();
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

/** Split composite SKU groups into chunks of at most `chunkSize` groups per request. */
export function chunkCompositeGroups(
  grouped: Map<string, FormulaBomParsedRow[]>,
  chunkSize: number
): { composite_sku: string; rows: FormulaBomParsedRow[] }[][] {
  const entries = [...grouped.entries()];
  const chunks: { composite_sku: string; rows: FormulaBomParsedRow[] }[][] = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    const slice = entries.slice(i, i + chunkSize);
    chunks.push(slice.map(([composite_sku, rows]) => ({ composite_sku, rows })));
  }
  return chunks;
}

/** Split summary rows into chunks of at most `chunkSize` rows per request. */
export function chunkSummaryRows(
  rows: FormulaSummaryParsedRow[],
  chunkSize: number
): FormulaSummaryParsedRow[][] {
  const chunks: FormulaSummaryParsedRow[][] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }
  return chunks;
}

export function parseFormulaBomWorkbook(buffer: ArrayBuffer): {
  summary: { sheetName: string; rows: FormulaSummaryParsedRow[] } | null;
  rm: { sheetName: string; rows: FormulaBomParsedRow[] } | null;
  pack: { sheetName: string; rows: FormulaBomParsedRow[] } | null;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const names = wb.SheetNames || [];

  const summaryName = pickSummarySheetName(names);
  const rmName = pickRmSheetName(names);
  const packName = pickPackSheetName(names);

  if (!summaryName) {
    errors.push('Required worksheet "Summary" not found.');
  }
  if (!rmName) {
    errors.push('Required worksheet "RM BOM" not found.');
  }
  if (!packName) {
    errors.push('Required worksheet "PM BOM" not found.');
  }

  if (errors.length > 0) {
    return { summary: null, rm: null, pack: null, warnings, errors };
  }

  let summary: { sheetName: string; rows: FormulaSummaryParsedRow[] } | null = null;
  const summaryWs = wb.Sheets[summaryName!];
  if (summaryWs) {
    const pr = parseSummarySheet(summaryName!, summaryWs);
    if (pr.error) errors.push(pr.error);
    else summary = { sheetName: summaryName!, rows: pr.rows };
  }

  let rm: { sheetName: string; rows: FormulaBomParsedRow[] } | null = null;
  const rmWs = wb.Sheets[rmName!];
  const summaryRowsForRm = summary?.rows ?? [];
  if (rmWs) {
    const blockPr = parseRmBomBlockSheet(rmName!, rmWs, summaryRowsForRm);
    for (const w of blockPr.warnings) warnings.push(w);
    if (!blockPr.error && blockPr.rows.length > 0) {
      rm = { sheetName: rmName!, rows: blockPr.rows };
    } else {
      const legacy = parseSheet(rmName!, rmWs);
      if (!legacy.error && legacy.rows.length > 0) {
        rm = { sheetName: rmName!, rows: legacy.rows };
        warnings.push(
          `RM BOM "${rmName}" imported using legacy flat layout (no PR block headers in column A).`
        );
      } else if (blockPr.error) {
        warnings.push(`RM BOM sheet "${rmName}" — ${blockPr.error}`);
      } else if (legacy.error) {
        warnings.push(`RM BOM sheet "${rmName}" — ${legacy.error}`);
      }
    }
  }

  let pack: { sheetName: string; rows: FormulaBomParsedRow[] } | null = null;
  const packWs = wb.Sheets[packName!];
  const summaryRowsForPack = summary?.rows ?? [];
  if (packWs) {
    const blockPr = parsePmBomBlockSheet(packName!, packWs, summaryRowsForPack);
    for (const w of blockPr.warnings) warnings.push(w);
    if (!blockPr.error && blockPr.rows.length > 0) {
      pack = { sheetName: packName!, rows: blockPr.rows };
    } else {
      const legacy = parseSheet(packName!, packWs);
      if (!legacy.error && legacy.rows.length > 0) {
        pack = { sheetName: packName!, rows: legacy.rows };
        warnings.push(
          `PM BOM "${packName}" imported using legacy flat layout (no PR block headers in column A).`
        );
      } else if (blockPr.error) {
        warnings.push(`PM BOM sheet "${packName}" — ${blockPr.error}`);
      } else if (legacy.error) {
        warnings.push(`PM BOM sheet "${packName}" — ${legacy.error}`);
      }
    }
  }

  return { summary, rm, pack, warnings, errors };
}

/** Exported for unit tests. */
export const __testExports = {
  detectSummaryHeaders,
  detectRmBomSubHeaders,
  detectPmBomSubHeaders,
  normalizeHeader,
  pickSummarySheetName,
  pickRmSheetName,
  pickPackSheetName,
  parseRmBomBlockSheet,
  parsePmBomBlockSheet,
  cellToFormulaPercent,
  isAquaQsFillerName,
  applyAquaSkuFromQsName,
  AQUA_RM_MASTER_CODE,
};
