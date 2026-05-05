/** Keep in sync with ei-website-backend/src/bom/skuBomMath.js */

export function normUom(u: string | undefined | null): string {
  const x = String(u ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (['G', 'GM', 'GRAM', 'GRAMS'].includes(x)) return 'G';
  if (['KG', 'KILO', 'KILOS', 'KILOGRAM', 'KILOGRAMS'].includes(x)) return 'KG';
  if (['ML', 'MILLILITER', 'MILLILITRE', 'MILLILITERS', 'MILLILITRES'].includes(x)) return 'ML';
  if (['L', 'LITER', 'LITRE', 'LITERS', 'LITRES'].includes(x)) return 'L';
  if (['PCS', 'PC', 'EA', 'EACH', 'UNIT', 'UNITS', 'PIECE', 'PIECES'].includes(x)) return 'PCS';
  return x || 'G';
}

function dimensionOfLimitUom(uom: string): 'mass' | 'volume' | null {
  const u = normUom(uom);
  if (['G', 'KG'].includes(u)) return 'mass';
  if (['ML', 'L'].includes(u)) return 'volume';
  return null;
}

function dimensionOfLineUom(uom: string): 'mass' | 'volume' | 'count' | null {
  const u = normUom(uom);
  if (['G', 'KG'].includes(u)) return 'mass';
  if (['ML', 'L'].includes(u)) return 'volume';
  if (u === 'PCS') return 'count';
  return null;
}

function toMg(qty: unknown, uom: string): number {
  const u = normUom(uom);
  const q = parseFloat(String(qty).replace(/[^\d.-]/g, ''));
  if (Number.isNaN(q) || q < 0) throw new Error(`Invalid SKU BOM quantity: ${qty}`);
  if (u === 'G') return q * 1000;
  if (u === 'KG') return q * 1_000_000;
  throw new Error(`UOM "${uom}" is not a mass unit (use G, GM, or KG)`);
}

function toMicroL(qty: unknown, uom: string): number {
  const u = normUom(uom);
  const q = parseFloat(String(qty).replace(/[^\d.-]/g, ''));
  if (Number.isNaN(q) || q < 0) throw new Error(`Invalid SKU BOM quantity: ${qty}`);
  if (u === 'ML') return q * 1000;
  if (u === 'L') return q * 1_000_000;
  throw new Error(`UOM "${uom}" is not a volume unit (use ML or L)`);
}

function formatMassFromMg(mg: number, displayUom: string): number {
  const u = normUom(displayUom);
  if (u === 'KG') return mg / 1_000_000;
  return mg / 1000;
}

function formatVolumeFromMicroL(microL: number, displayUom: string): number {
  const u = normUom(displayUom);
  if (u === 'L') return microL / 1_000_000;
  return microL / 1000;
}

export type SkuBomLineInput = {
  inci_name?: string;
  inciName?: string;
  rm_code?: string;
  rmCode?: string;
  raw_material_id?: number | string | null;
  rawMaterialId?: string;
  qty_per_unit?: number | string;
  qtyPerUnit?: number | string;
  uom?: string;
};

export function countMeaningfulSkuRmLines(lines: unknown[] | undefined | null): number {
  if (!Array.isArray(lines)) return 0;
  return lines.filter((line) => {
    const L = line as SkuBomLineInput;
    const qtyRaw = L?.qty_per_unit ?? L?.qtyPerUnit;
    const qty = parseFloat(String(qtyRaw ?? '').replace(/[^\d.-]/g, ''));
    const hasQty = !Number.isNaN(qty) && qty > 0;
    const name = String(L?.inci_name ?? L?.inciName ?? '').trim();
    const code = String(L?.rm_code ?? L?.rmCode ?? '').trim();
    return hasQty && (name || code);
  }).length;
}

export function parseLimitQty(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = parseFloat(String(raw).replace(/[^\d.-]/g, ''));
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

export type SkuBomValidateResult =
  | { ok: true; sumInDisplay?: number; limitInDisplay?: number; displayUom?: string }
  | { ok: false; code: string; error: string; sumInDisplay?: number; limitInDisplay?: number; displayUom?: string };

export function validateSkuBomTotals(args: {
  lines: unknown[] | undefined | null;
  limitQty: unknown;
  limitUom: unknown;
}): SkuBomValidateResult {
  const { lines, limitQty, limitUom } = args;
  const meaningful = countMeaningfulSkuRmLines(lines ?? []);
  const limQ = parseLimitQty(limitQty);
  const limU = limitUom != null && String(limitUom).trim() !== '' ? String(limitUom).trim() : null;
  const dim = limU ? dimensionOfLimitUom(limU) : null;

  if (meaningful === 0 && !limQ && !limU) {
    return { ok: true };
  }
  if (meaningful > 0 && (!limQ || !limU || !dim)) {
    return {
      ok: false,
      code: 'SKU_BOM_LIMIT_REQUIRED',
      error:
        'SKU BOM lines are present: set net per-unit limit quantity and UOM (e.g. 50 GM or 50 ML) so the sum of lines can match exactly.',
    };
  }
  if ((limQ || limU) && meaningful === 0) {
    return {
      ok: false,
      code: 'SKU_BOM_LINES_REQUIRED',
      error: 'SKU BOM net per-unit limit is set: add RM lines whose quantities sum to that limit exactly.',
    };
  }
  if (!dim) {
    return {
      ok: false,
      code: 'SKU_BOM_LIMIT_UOM',
      error: 'Limit UOM must be G, GM, KG, ML, or L.',
    };
  }

  let limitBase: number;
  try {
    limitBase = dim === 'mass' ? toMg(limQ, limU!) : toMicroL(limQ, limU!);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid limit UOM';
    return { ok: false, code: 'SKU_BOM_LIMIT_UOM', error: msg };
  }

  const arr = Array.isArray(lines) ? lines : [];
  let sumBase = 0;
  for (let i = 0; i < arr.length; i += 1) {
    const line = (arr[i] || {}) as SkuBomLineInput;
    const qtyRaw = line.qty_per_unit ?? line.qtyPerUnit;
    const qty = parseFloat(String(qtyRaw ?? '').replace(/[^\d.-]/g, ''));
    const name = String(line.inci_name ?? line.inciName ?? '').trim();
    const code = String(line.rm_code ?? line.rmCode ?? '').trim();
    if (!Number.isNaN(qty) && qty > 0 && (name || code)) {
      const lu = line.uom || 'G';
      const lineDim = dimensionOfLineUom(lu);
      if (lineDim === 'count') {
        return {
          ok: false,
          code: 'SKU_BOM_LINE_UOM',
          error: `SKU BOM line ${i + 1}: PCS/count units cannot be mixed with a weight/volume limit. Use G, KG, or ML.`,
        };
      }
      if (lineDim !== dim) {
        return {
          ok: false,
          code: 'SKU_BOM_LINE_UOM',
          error: `SKU BOM line ${i + 1}: UOM "${lu}" does not match limit kind (${dim === 'mass' ? 'mass (G/KG)' : 'volume (ML/L)'}).`,
        };
      }
      try {
        sumBase += dim === 'mass' ? toMg(qty, lu) : toMicroL(qty, lu);
      } catch (e) {
        const msg = e instanceof Error ? e.message : `Invalid quantity on SKU BOM line ${i + 1}`;
        return {
          ok: false,
          code: 'SKU_BOM_LINE_QTY',
          error: msg,
        };
      }
    }
  }

  const sumInDisplay = dim === 'mass' ? formatMassFromMg(sumBase, limU!) : formatVolumeFromMicroL(sumBase, limU!);
  const limitInDisplay = limQ!;
  if (Math.abs(sumInDisplay - limitInDisplay) > 0.001) {
    return {
      ok: false,
      code: 'SKU_BOM_SUM_MISMATCH',
      error: `SKU BOM quantities must equal the net per-unit limit exactly (tolerance 0.001 ${normUom(limU!)}). Current total ${sumInDisplay.toFixed(6)} ${normUom(limU!)} vs limit ${limitInDisplay} ${normUom(limU!)}.`,
      sumInDisplay,
      limitInDisplay,
      displayUom: normUom(limU!),
    };
  }

  return {
    ok: true,
    sumInDisplay,
    limitInDisplay,
    displayUom: normUom(limU!),
  };
}

/**
 * Product fill size (`50g`, `50ml`, `50 g`) → SKU BOM net limit (same as PR registration fill_size rules).
 */
export function parseFillSizeToSkuNet(raw: string | undefined | null): { qty: string; uom: string } | null {
  const m = String(raw ?? '')
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*(g|ml)$/i);
  if (!m) return null;
  const qty = m[1];
  const unit = m[2].toLowerCase();
  if (unit === 'g') return { qty, uom: 'GM' };
  return { qty, uom: 'ML' };
}

/** Net limit for validation: fill size wins when parseable, else manual SKU fields. */
export function getEffectiveSkuBomLimitFields(args: {
  fillSize: string;
  skuBomLimitQty: string;
  skuBomLimitUom: string;
}): { limitQty: string; limitUom: string } {
  const fromFill = parseFillSizeToSkuNet(args.fillSize);
  if (fromFill) return { limitQty: fromFill.qty, limitUom: fromFill.uom };
  return { limitQty: args.skuBomLimitQty, limitUom: args.skuBomLimitUom?.trim() || 'GM' };
}

/** Values persisted on BOM — align with product fill_size when set. */
export function getEffectiveSkuBomLimitForPersist(args: {
  fillSize: string;
  skuBomLimitQty: string;
  skuBomLimitUom: string;
}): { sku_bom_limit_qty: number | null; sku_bom_limit_uom: string | null } {
  const fromFill = parseFillSizeToSkuNet(args.fillSize);
  if (fromFill) {
    const n = parseFloat(String(fromFill.qty).replace(/[^\d.-]/g, ''));
    return {
      sku_bom_limit_qty: Number.isNaN(n) ? null : n,
      sku_bom_limit_uom: fromFill.uom,
    };
  }
  const qRaw = args.skuBomLimitQty.trim();
  const n = qRaw ? parseFloat(qRaw.replace(/[^\d.-]/g, '')) : NaN;
  return {
    sku_bom_limit_qty: !qRaw || Number.isNaN(n) ? null : n,
    sku_bom_limit_uom: args.skuBomLimitUom?.trim() || null,
  };
}

/** One formula row derived from SKU BOM per-unit quantities (percent = line share of net). */
export type SkuBomToFormulaRow = {
  inciName: string;
  rmCode: string;
  rawMaterialId?: string;
  percentWW: string;
  uom: string;
  phase: string;
};

type MeaningfulSkuLine = {
  inciName: string;
  rmCode: string;
  rawMaterialId?: string;
  lineBase: number;
};

function collectMeaningfulSkuLinesForFormula(
  lines: unknown[] | null | undefined,
  dim: 'mass' | 'volume'
): MeaningfulSkuLine[] | { error: string } {
  const arr = Array.isArray(lines) ? lines : [];
  const out: MeaningfulSkuLine[] = [];
  for (let i = 0; i < arr.length; i += 1) {
    const line = (arr[i] || {}) as SkuBomLineInput;
    const qtyRaw = line.qty_per_unit ?? line.qtyPerUnit;
    const qty = parseFloat(String(qtyRaw ?? '').replace(/[^\d.-]/g, ''));
    const name = String(line.inci_name ?? line.inciName ?? '').trim();
    const code = String(line.rm_code ?? line.rmCode ?? '').trim();
    if (!Number.isNaN(qty) && qty > 0 && (name || code)) {
      const lu = line.uom || 'G';
      const lineDim = dimensionOfLineUom(lu);
      if (lineDim === 'count') {
        return { error: `SKU BOM line ${i + 1}: PCS/count units cannot be converted to formula % w/w.` };
      }
      if (lineDim !== dim) {
        return {
          error: `SKU BOM line ${i + 1}: UOM "${lu}" does not match net kind (${dim === 'mass' ? 'mass (G/KG)' : 'volume (ML/L)'}).`,
        };
      }
      let lineBase: number;
      try {
        lineBase = dim === 'mass' ? toMg(qty, lu) : toMicroL(qty, lu);
      } catch (e) {
        const msg = e instanceof Error ? e.message : `Invalid quantity on SKU BOM line ${i + 1}`;
        return { error: msg };
      }
      const rid = line.raw_material_id ?? line.rawMaterialId;
      out.push({
        inciName: name,
        rmCode: code,
        rawMaterialId: rid != null && String(rid).trim() !== '' ? String(rid) : undefined,
        lineBase,
      });
    }
  }
  return out;
}

/**
 * Convert validated SKU BOM (per-unit RM qtys summing to net) into formula % w/w rows for batch / Planning.
 * Denominator is the sum of line amounts in base units so percentages total 100% after rounding fix on the last line.
 */
export function skuBomLinesToFormulaRows(args: {
  lines: unknown[] | null | undefined;
  limitQty: string;
  limitUom: string;
  /** Phase assigned to every imported line (default: "Bulk"). */
  defaultPhase?: string;
}): { ok: true; rows: SkuBomToFormulaRow[] } | { ok: false; error: string } {
  const v = validateSkuBomTotals({
    lines: args.lines,
    limitQty: args.limitQty,
    limitUom: args.limitUom,
  });
  if (!v.ok) return { ok: false, error: v.error };

  const limU = String(args.limitUom ?? '').trim();
  const dim = dimensionOfLimitUom(limU);
  if (!dim) return { ok: false, error: 'Limit UOM must be G, GM, KG, ML, or L.' };

  const collected = collectMeaningfulSkuLinesForFormula(args.lines, dim);
  if ('error' in collected) return { ok: false, error: collected.error };
  if (collected.length === 0) return { ok: false, error: 'No SKU BOM lines with quantity and INCI/RM code to import.' };

  const sumBase = collected.reduce((s, x) => s + x.lineBase, 0);
  if (sumBase <= 0) return { ok: false, error: 'SKU BOM line totals are invalid for import.' };

  const formulaUom = dim === 'mass' ? 'GM' : 'ML';
  const phase = (args.defaultPhase ?? 'Bulk').trim() || 'Bulk';

  const rawPcts = collected.map((row) => (row.lineBase / sumBase) * 100);
  const ROUND = 1e6;
  const rounded = rawPcts.map((p) => Math.round(p * ROUND) / ROUND);
  let drift = 100 - rounded.reduce((a, b) => a + b, 0);
  rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + drift) * ROUND) / ROUND;

  const rows: SkuBomToFormulaRow[] = collected.map((row, i) => ({
    inciName: row.inciName,
    rmCode: row.rmCode,
    rawMaterialId: row.rawMaterialId,
    percentWW: String(rounded[i]),
    uom: formulaUom,
    phase,
  }));

  return { ok: true, rows };
}
