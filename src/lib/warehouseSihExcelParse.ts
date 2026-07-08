/**
 * Client-side parse for the main warehouse SIH workbook (worksheet "CONSOLIDATED SIH": sku,
 * item_name, SIH). Used to drive a chunked upload (see warehouseInventory.service.ts's
 * postWarehouseSihExcelChunk) so large files don't produce one long-running request that can
 * time out — mirrors src/warehouseInventory/warehouseSihBucketExcelImport.js's server-side
 * detectSihHeaderColumns/parseSihBucketWorkbook exactly (keep the two in sync).
 */
import * as XLSX from 'xlsx';

export interface WarehouseSihParsedRow {
  excel_row: number;
  sku: string;
  item_name: string;
  sih: number | null;
}

const HEADER_ALIASES = {
  sku: ['sku', 'item sku', 'sku code', 'item code', 'zoho sku'],
  itemName: ['item_name', 'item name', 'name', 'description', 'item description'],
  sih: [
    'sih',
    'stock in hand',
    'stock_in_hand',
    'stock in hand qty',
    'qty',
    'quantity',
    'on hand',
    'on_hand',
    'available',
    'available qty',
  ],
};

function normHeader(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function matchHeaderAlias(cellText: unknown, aliases: readonly string[]): boolean {
  const h = normHeader(cellText);
  if (!h) return false;
  return aliases.some((a) => h === a || h.replace(/_/g, ' ') === a.replace(/_/g, ' '));
}

function cellToText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function parseQuantity(raw: unknown): number | null {
  const text = cellToText(raw);
  if (!text) return null;
  const n = Number(text.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function pickConsolidatedSihSheetName(names: string[]): string {
  const exact = names.find((n) => {
    const lower = n.trim().toLowerCase();
    return lower === 'consolidated sih' || lower === 'consolidated_sih';
  });
  if (exact) return exact;
  const partial = names.find((n) => {
    const lower = n.trim().toLowerCase();
    return lower.includes('consolidated sih') || lower.includes('consolidated_sih');
  });
  if (partial) return partial;
  return names[0];
}

function detectHeaderColumns(matrix: unknown[][]): {
  headerRowIdx: number;
  cols: { sku?: number; itemName?: number; sih?: number };
} | null {
  const maxHeaderRow = Math.min(matrix.length, 8);
  for (let r = 0; r < maxHeaderRow; r += 1) {
    const row = matrix[r] || [];
    const cols: { sku?: number; itemName?: number; sih?: number } = {};
    for (let c = 0; c < row.length; c += 1) {
      const text = row[c];
      if (text == null || text === '') continue;
      if (cols.sku == null && matchHeaderAlias(text, HEADER_ALIASES.sku)) cols.sku = c;
      else if (cols.itemName == null && matchHeaderAlias(text, HEADER_ALIASES.itemName)) cols.itemName = c;
      else if (cols.sih == null && matchHeaderAlias(text, HEADER_ALIASES.sih)) cols.sih = c;
    }
    if (cols.sih != null && (cols.sku != null || cols.itemName != null)) {
      return { headerRowIdx: r, cols };
    }
  }
  return null;
}

export function parseWarehouseSihWorkbook(
  buffer: ArrayBuffer
): { sheetName: string; rows: WarehouseSihParsedRow[] } | { error: string } {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch {
    return { error: 'Could not read the Excel file — is it a valid .xlsx/.xlsm workbook?' };
  }
  const names = wb.SheetNames || [];
  if (!names.length) return { error: 'Workbook has no worksheets' };

  const sheetName = pickConsolidatedSihSheetName(names);
  const ws = wb.Sheets[sheetName];
  if (!ws) return { error: `Could not read worksheet "${sheetName}"` };

  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][];
  const layout = detectHeaderColumns(matrix);
  if (!layout) {
    return {
      error: `Could not find headers on "${sheetName}". Expected columns: sku (or item_name) and SIH / stock in hand.`,
    };
  }

  const rows: WarehouseSihParsedRow[] = [];
  for (let r = layout.headerRowIdx + 1; r < matrix.length; r += 1) {
    const row = matrix[r] || [];
    const sku = layout.cols.sku != null ? cellToText(row[layout.cols.sku]) : '';
    const itemName = layout.cols.itemName != null ? cellToText(row[layout.cols.itemName]) : '';
    const sihRaw = layout.cols.sih != null ? row[layout.cols.sih] : '';
    const sih = parseQuantity(sihRaw);
    if (!sku && !itemName && sih == null) continue;
    rows.push({ excel_row: r + 1, sku, item_name: itemName, sih });
  }

  return { sheetName, rows };
}

/** Split parsed rows into chunks of at most `chunkSize` rows per request. */
export function chunkWarehouseSihRows(
  rows: WarehouseSihParsedRow[],
  chunkSize: number
): WarehouseSihParsedRow[][] {
  const chunks: WarehouseSihParsedRow[][] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }
  return chunks;
}
