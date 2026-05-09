/**
 * Client-side parse for Formula RM + Packaging BOM worksheets (matches backend column detection).
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

/** 0-based column indices from header row cells. */
function detectFormulaHeaders(headerRow: unknown[]): {
  map: Record<string, number>;
  headers: string[];
} {
  const map: Record<string, number> = {};
  const flat = headerRow.map((h) => String(h ?? '').trim()).filter(Boolean);
  headerRow.forEach((h, idx) => {
    if (h === '' || h == null) return;
    const norm = normalizeHeader(h);
    if (norm === 'composite sku' && map.composite_sku == null) map.composite_sku = idx;
    else if (norm === 'composite name' && map.composite_name == null) map.composite_name = idx;
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
    } else if (norm === 'component sku' && map.component_sku == null) map.component_sku = idx;
    else if (norm === 'component name' && map.component_name == null) map.component_name = idx;
    else if (
      (norm === 'qty per unit' ||
        norm === 'qty per sku kg nos' ||
        norm === 'qty per sku' ||
        norm === 'quantity per unit' ||
        norm === 'qty kg ltr' ||
        norm === 'qty in kg ltr' ||
        norm === 'qty kg litre' ||
        norm === 'qty kg liter') &&
      map.qty == null
    ) {
      map.qty = idx;
    }
  });
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
  if (m.composite_sku == null) missing.push('Composite SKU');
  if (m.component_sku == null) missing.push('Component SKU');
  if (m.component_name == null) missing.push('Component Name');
  if (m.qty == null) missing.push('Qty per Unit');
  if (m.uom == null) missing.push('UoM');
  if (missing.length > 0) {
    return {
      rows: [],
      error: `Sheet "${sheetName}" missing column(s): ${missing.join(', ')}. Found: ${headers.join(', ')}`,
    };
  }
  return { rows: parseRowsFromMatrix(sheetName, data, m) };
}

function pickRmSheetName(names: string[]): string | null {
  const exact = names.find((n) => n.trim() === 'Formula BOM - RM per KG-LTR');
  if (exact) return exact;
  const target = normalizeSheetLabel('Formula BOM - RM per KG-LTR');
  const byNorm = names.find((n) => normalizeSheetLabel(n) === target);
  if (byNorm) return byNorm;
  return (
    names.find((n) => {
      const x = normalizeSheetLabel(n);
      return x.includes('formula') && x.includes('bom');
    }) ?? null
  );
}

function pickPackSheetName(names: string[]): string | null {
  const exact = names.find((n) => n.trim() === 'Packaging BOM');
  if (exact) return exact;
  const target = normalizeSheetLabel('Packaging BOM');
  const byNorm = names.find((n) => normalizeSheetLabel(n) === target);
  if (byNorm) return byNorm;
  return (
    names.find((n) => {
      const x = normalizeSheetLabel(n);
      return x.includes('packaging') && x.includes('bom');
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

export function parseFormulaBomWorkbook(buffer: ArrayBuffer): {
  rm: { sheetName: string; rows: FormulaBomParsedRow[] } | null;
  pack: { sheetName: string; rows: FormulaBomParsedRow[] } | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const names = wb.SheetNames || [];

  let rm: { sheetName: string; rows: FormulaBomParsedRow[] } | null = null;
  const rmName = pickRmSheetName(names);
  if (rmName) {
    const ws = wb.Sheets[rmName];
    if (ws) {
      const pr = parseSheet(rmName, ws);
      if (pr.error) warnings.push(pr.error);
      else rm = { sheetName: rmName, rows: pr.rows };
    }
  } else {
    warnings.push('No "Formula BOM - RM per KG-LTR" (or similar) worksheet found — RM import skipped.');
  }

  let pack: { sheetName: string; rows: FormulaBomParsedRow[] } | null = null;
  const packName = pickPackSheetName(names);
  if (packName) {
    const ws = wb.Sheets[packName];
    if (ws) {
      const pr = parseSheet(packName, ws);
      if (pr.error) warnings.push(pr.error);
      else pack = { sheetName: packName, rows: pr.rows };
    }
  } else {
    warnings.push('No "Packaging BOM" worksheet found — packaging import skipped.');
  }

  return { rm, pack, warnings };
}
