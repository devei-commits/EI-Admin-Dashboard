/** Keep in sync with ei-website-backend/src/bom/skuBomMath.js */

/** First positive number in a bulk SG field (e.g. "0.95-1.02" → 0.95). Default 1. */
export function parseBulkSpecificGravity(raw: string | undefined | null): number {
  const s = String(raw ?? '').trim();
  if (!s) return 1;
  const m = s.match(/[\d.]+/);
  if (!m) return 1;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

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

/** Line amount in limit-dimension base (mg if limit mass, µL if limit volume). Uses bulk SG when dimensions differ (same as planning fill → kg). */
function lineQtyToLimitBase(
  qty: number,
  lu: string,
  lineDim: 'mass' | 'volume',
  limitDim: 'mass' | 'volume',
  sg: number
): number {
  const safeSg = Number.isFinite(sg) && sg > 0 ? sg : 1;
  if (lineDim === limitDim) {
    return limitDim === 'mass' ? toMg(qty, lu) : toMicroL(qty, lu);
  }
  if (limitDim === 'volume' && lineDim === 'mass') {
    const mg = toMg(qty, lu);
    const kg = mg / 1_000_000;
    const L = kg / safeSg;
    return L * 1_000_000;
  }
  if (limitDim === 'mass' && lineDim === 'volume') {
    const microL = toMicroL(qty, lu);
    const L = microL / 1_000_000;
    const kg = L * safeSg;
    return kg * 1_000_000;
  }
  throw new Error('Invalid line vs limit dimensions');
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

/** Formula BOM (% w/w) — at least one line with INCI/code/% before PR register/save. */
export function countMeaningfulFormulaRmLines(lines: unknown[] | undefined | null): number {
  if (!Array.isArray(lines)) return 0;
  return lines.filter((line) => {
    const L = line as Record<string, unknown>;
    const inci = String(L?.inci_name ?? L?.inciName ?? '').trim();
    const code = String(L?.rm_code ?? L?.rmCode ?? '').trim();
    const groupId = L?.item_group_id ?? L?.itemGroupId;
    const hasGroup = groupId != null && String(groupId).trim() !== '' && !Number.isNaN(Number(groupId));
    const pctRaw = L?.pct_w_w ?? L?.pctWw ?? L?.pct;
    const pct =
      pctRaw != null && pctRaw !== ''
        ? parseFloat(String(pctRaw).replace(/[^\d.-]/g, ''))
        : NaN;
    const hasPct = !Number.isNaN(pct) && pct > 0;
    return Boolean(inci || code || hasGroup || hasPct);
  }).length;
}

/** Pack BOM — at least one line with description or PM code. */
export function countMeaningfulPackLines(lines: unknown[] | undefined | null): number {
  if (!Array.isArray(lines)) return 0;
  return lines.filter((line) => {
    const L = line as Record<string, unknown>;
    const desc = String(L?.description ?? L?.pm_description ?? L?.pmDescription ?? '').trim();
    const code = String(L?.pm_code ?? L?.pmCode ?? '').trim();
    return Boolean(desc || code);
  }).length;
}

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

  // SKU BOM is optional: no per-unit RM lines → skip limit/sum checks (fill size alone must not force SKU lines).
  if (meaningful === 0) {
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
  if (!dim) {
    return {
      ok: false,
      code: 'SKU_BOM_LIMIT_UOM',
      error: 'Limit UOM must be G, GM, KG, ML, or L.',
    };
  }

  try {
    if (dim === 'mass') toMg(limQ, limU!);
    else toMicroL(limQ, limU!);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid limit UOM';
    return { ok: false, code: 'SKU_BOM_LIMIT_UOM', error: msg };
  }

  const arr = Array.isArray(lines) ? lines : [];
  let sumBase = 0;
  let hasCrossDimensionLine = false;
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
      if (lineDim !== 'mass' && lineDim !== 'volume') {
        return {
          ok: false,
          code: 'SKU_BOM_LINE_UOM',
          error: `SKU BOM line ${i + 1}: UOM "${lu}" must be G, GM, KG, ML, or L.`,
        };
      }
      if (lineDim !== dim) {
        hasCrossDimensionLine = true;
        try {
          if (lineDim === 'mass') toMg(qty, lu);
          else toMicroL(qty, lu);
        } catch (e) {
          const msg = e instanceof Error ? e.message : `Invalid quantity on SKU BOM line ${i + 1}`;
          return { ok: false, code: 'SKU_BOM_LINE_QTY', error: msg };
        }
        continue;
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

  if (!hasCrossDimensionLine) {
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

  return {
    ok: true,
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

/** Net limit for validation from SKU BOM fields on the PR form. */
export function getEffectiveSkuBomLimitFields(args: {
  skuBomLimitQty: string;
  skuBomLimitUom: string;
}): { limitQty: string; limitUom: string } {
  return { limitQty: args.skuBomLimitQty, limitUom: args.skuBomLimitUom?.trim() || 'GM' };
}

/** Values persisted on BOM `sku_bom_limit_*`. */
export function getEffectiveSkuBomLimitForPersist(args: {
  skuBomLimitQty: string;
  skuBomLimitUom: string;
}): { sku_bom_limit_qty: number | null; sku_bom_limit_uom: string | null } {
  const qRaw = args.skuBomLimitQty.trim();
  const n = qRaw ? parseFloat(qRaw.replace(/[^\d.-]/g, '')) : NaN;
  return {
    sku_bom_limit_qty: !qRaw || Number.isNaN(n) ? null : n,
    sku_bom_limit_uom: args.skuBomLimitUom?.trim() || null,
  };
}

/** Display pack size for sale orders from SKU BOM net per unit (`50 G`, `30 ML`, or `0`). */
export function formatSkuBomLimitAsPack(qtyRaw: unknown, uomRaw: unknown): string {
  const q = Number(qtyRaw);
  if (!Number.isFinite(q) || q <= 0) return '0';
  const u = String(uomRaw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!u) return '0';
  const qtyStr = q % 1 === 0 ? String(Math.trunc(q)) : String(q);
  if (u === 'GM' || u === 'G' || u === 'GRAM' || u === 'GRAMS') return `${qtyStr} G`;
  if (u === 'KG' || u === 'KGS' || u === 'KILO' || u === 'KILOGRAM' || u === 'KILOGRAMS') return `${qtyStr} KG`;
  if (u === 'ML' || u === 'MILLILITRE' || u === 'MILLILITER' || u === 'MILLILITRES' || u === 'MILLILITERS') {
    return `${qtyStr} ML`;
  }
  if (u === 'L' || u === 'LT' || u === 'LTR' || u === 'LITRE' || u === 'LITER' || u === 'LITRES' || u === 'LITERS') {
    return `${qtyStr} L`;
  }
  return `${qtyStr} ${u}`;
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
  dim: 'mass' | 'volume',
  specificGravity: number
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
      if (lineDim !== 'mass' && lineDim !== 'volume') {
        return { error: `SKU BOM line ${i + 1}: UOM "${lu}" must be G, GM, KG, ML, or L for formula import.` };
      }
      let lineBase: number;
      try {
        lineBase = lineQtyToLimitBase(qty, lu, lineDim, dim, specificGravity);
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
  /** Bulk specific gravity when converting mass ↔ volume for % split (default 1). */
  specificGravity?: number;
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

  const sg = args.specificGravity != null && Number.isFinite(args.specificGravity) ? args.specificGravity : 1;
  const collected = collectMeaningfulSkuLinesForFormula(args.lines, dim, sg > 0 ? sg : 1);
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

/** Flat formula line for import (phased or flat rm_lines). */
export type FormulaLineInput = {
  phase?: string;
  inci_name?: string;
  inciName?: string;
  rm_code?: string;
  rmCode?: string;
  raw_material_id?: number | string | null;
  rawMaterialId?: string;
  item_group_id?: number | string | null;
  item_group_name?: string | null;
  pct_w_w?: number | string;
  pctWw?: number | string;
  pct?: number | string;
  uom?: string;
};

/** One SKU BOM row derived from Formula BOM % w/w. */
export type SkuBomFromFormulaRow = {
  inciName: string;
  rmCode: string;
  rawMaterialId?: string;
  qtyPerUnit: number;
  uom: string;
};

type MeaningfulFormulaLine = {
  inciName: string;
  rmCode: string;
  rawMaterialId?: string;
  pct: number;
};

/** Display UOM for SKU lines matching the net limit dimension. */
function skuLineUomForLimit(limitUom: string): string {
  const u = normUom(limitUom);
  if (u === 'KG') return 'KG';
  if (u === 'L') return 'L';
  if (u === 'ML') return 'ML';
  return 'GM';
}

function displayLimitUom(limitUom: string): string {
  const u = normUom(limitUom);
  if (u === 'G') return 'GM';
  if (u === 'KG') return 'KG';
  if (u === 'ML') return 'ML';
  if (u === 'L') return 'L';
  return String(limitUom ?? '').trim().toUpperCase() || 'GM';
}

function collectMeaningfulFormulaLines(
  formulaLines: unknown[] | null | undefined
): MeaningfulFormulaLine[] {
  const arr = Array.isArray(formulaLines) ? formulaLines : [];
  const out: MeaningfulFormulaLine[] = [];
  for (let i = 0; i < arr.length; i += 1) {
    const line = (arr[i] || {}) as FormulaLineInput;
    const inci = String(line.inci_name ?? line.inciName ?? '').trim();
    const code = String(line.rm_code ?? line.rmCode ?? '').trim();
    const groupId = line.item_group_id ?? (line as { itemGroupId?: unknown }).itemGroupId;
    const groupName = String(line.item_group_name ?? '').trim();
    const hasGroup =
      (groupId != null && String(groupId).trim() !== '' && !Number.isNaN(Number(groupId))) ||
      groupName.length > 0;
    const pctRaw = line.pct_w_w ?? line.pctWw ?? line.pct;
    const pct =
      pctRaw != null && pctRaw !== ''
        ? parseFloat(String(pctRaw).replace(/[^\d.-]/g, ''))
        : NaN;
    if (!Number.isNaN(pct) && pct > 0 && (inci || code || hasGroup)) {
      const rid = line.raw_material_id ?? line.rawMaterialId;
      out.push({
        inciName: inci,
        rmCode: code,
        rawMaterialId: rid != null && String(rid).trim() !== '' ? String(rid) : undefined,
        pct,
      });
    }
  }
  return out;
}

/** Flatten phased Formula BOM (dashboard/API) into flat rm_lines for import. */
export function flattenFormulaBomPhases(
  phases: { phase?: string; ingredients?: FormulaLineInput[] }[] | null | undefined
): FormulaLineInput[] {
  if (!Array.isArray(phases)) return [];
  const out: FormulaLineInput[] = [];
  for (const ph of phases) {
    const phaseName = String(ph?.phase ?? '').trim();
    const ings = Array.isArray(ph?.ingredients) ? ph.ingredients : [];
    for (const ing of ings) {
      out.push({
        ...ing,
        phase: (ing.phase != null && String(ing.phase).trim() !== '' ? ing.phase : phaseName) || undefined,
      });
    }
  }
  return out;
}

/**
 * Convert Formula BOM (% w/w, total must be 100%) into SKU BOM per-unit quantities for a given net limit.
 * Inverse of skuBomLinesToFormulaRows when formula % totals 100%.
 */
export function formulaRowsToSkuBomLines(args: {
  formulaLines: unknown[] | null | undefined;
  limitQty: string | number;
  limitUom: string;
}): { ok: true; rows: SkuBomFromFormulaRow[]; limitQty: number; limitUom: string } | { ok: false; error: string } {
  const arr = Array.isArray(args.formulaLines) ? args.formulaLines : [];
  for (const raw of arr) {
    const line = (raw || {}) as FormulaLineInput;
    const groupId = line.item_group_id ?? (line as { itemGroupId?: unknown }).itemGroupId;
    const hasGroup = groupId != null && String(groupId).trim() !== '' && !Number.isNaN(Number(groupId));
    const rid = line.raw_material_id ?? line.rawMaterialId;
    if (hasGroup && (rid == null || String(rid).trim() === '')) {
      const label = String(line.item_group_name ?? line.inci_name ?? line.rm_code ?? 'Item group').trim();
      return {
        ok: false,
        error: `Formula BOM line "${label}" is an item group — resolve to a specific RM in Planning (or assign raw_material_id) before importing to SKU BOM.`,
      };
    }
  }
  const collected = collectMeaningfulFormulaLines(args.formulaLines);
  if (collected.length === 0) {
    return { ok: false, error: 'No Formula BOM lines with % w/w and INCI/RM code to import.' };
  }

  const pctTotal = collected.reduce((s, x) => s + x.pct, 0);
  if (Math.abs(pctTotal - 100) > 0.001) {
    return {
      ok: false,
      error: `Formula BOM must total 100% w/w before import (current total ${pctTotal.toFixed(4)}%).`,
    };
  }

  const limQ = parseLimitQty(args.limitQty);
  const limU = args.limitUom != null && String(args.limitUom).trim() !== '' ? String(args.limitUom).trim() : null;
  const dim = limU ? dimensionOfLimitUom(limU) : null;
  if (!limQ || !limU || !dim) {
    return {
      ok: false,
      error: 'Set net per-unit quantity and UOM (e.g. 50 GM or 50 ML) before importing from Formula BOM.',
    };
  }

  try {
    if (dim === 'mass') toMg(limQ, limU);
    else toMicroL(limQ, limU);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid limit UOM';
    return { ok: false, error: msg };
  }

  const lineUom = skuLineUomForLimit(limU);
  const limitInDisplay = limQ;
  const rawQtys = collected.map((row) => (row.pct / 100) * limitInDisplay);
  const ROUND = 1e6;
  const rounded = rawQtys.map((q) => Math.round(q * ROUND) / ROUND);
  const drift = limitInDisplay - rounded.reduce((a, b) => a + b, 0);
  rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + drift) * ROUND) / ROUND;

  const rows: SkuBomFromFormulaRow[] = collected.map((row, i) => ({
    inciName: row.inciName,
    rmCode: row.rmCode,
    rawMaterialId: row.rawMaterialId,
    qtyPerUnit: rounded[i],
    uom: lineUom,
  }));

  return { ok: true, rows, limitQty: limitInDisplay, limitUom: displayLimitUom(limU) };
}
