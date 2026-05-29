import { materialQtyLt, materialQtyMin, materialQtySubNonNeg, materialQtyToNum, toQtyString } from './materialQtyCompare';

/** Max decimals for RM (kg) through SO lifecycle — full facility precision. */
export const MATERIAL_QTY_MAX_DECIMALS = 16;

/** Packaging (pcs) — short UI: whole numbers when possible, max 2 fractional digits. */
export const PCS_DISPLAY_MAX_DECIMALS = 2;

/** @deprecated Use MATERIAL_QTY_MAX_DECIMALS — kept for imports. */
export const QTY_KG_MAX_DECIMALS = MATERIAL_QTY_MAX_DECIMALS;

/** @deprecated Use PCS_DISPLAY_MAX_DECIMALS for packaging display. */
export const QTY_PCS_MAX_DECIMALS = PCS_DISPLAY_MAX_DECIMALS;

export type QtyKind = 'kg' | 'pcs' | 'raw';

function maxDecimalsFor(kind: QtyKind): number {
  if (kind === 'pcs') return PCS_DISPLAY_MAX_DECIMALS;
  return MATERIAL_QTY_MAX_DECIMALS;
}

/** Persist/compare; packaging rounded to display precision (max 2 dp). */
export function roundMaterialQty(value: unknown, kind: QtyKind = 'kg'): number {
  const n = materialQtyToNum(value);
  if (kind === 'pcs') {
    const factor = 10 ** PCS_DISPLAY_MAX_DECIMALS;
    return Math.round(n * factor) / factor;
  }
  return n;
}

/**
 * Normalize for comparisons — kg at full precision; pcs at packaging display precision.
 */
export function normalizeQtyForCompare(value: unknown, kind: QtyKind = 'kg'): number {
  return roundMaterialQty(value, kind);
}

/** Display pcs as compact whole numbers when possible; kg keeps meaningful decimals. */
function formatPackagingQtyDisplay(n: number): string {
  const snapped = Math.round(n * 100) / 100;
  if (Math.abs(snapped - Math.round(snapped)) < 1e-9) {
    return Math.round(snapped).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  return snapped.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: PCS_DISPLAY_MAX_DECIMALS,
  });
}

/**
 * Display quantity with all meaningful decimals (up to max), never rounding 0.0004 → 0.
 */
export function formatQtyExact(value: unknown, kind: QtyKind = 'raw'): string {
  const n = Number(toQtyString(value));
  if (!Number.isFinite(n)) return '0';
  if (kind === 'pcs') return formatPackagingQtyDisplay(n);

  const maxDecimals = maxDecimalsFor(kind);
  const fixed = n.toFixed(maxDecimals);
  const trimmed = fixed.replace(/\.?0+$/, '');
  if (!trimmed.includes('.')) {
    return Number(trimmed).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  const [intPart, fracPart] = trimmed.split('.');
  const intFormatted = Number(intPart).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return `${intFormatted}.${fracPart}`;
}

/** Shortage line — never show "0" when there is a positive gap (even sub-gram). */
export function formatQtyShortage(value: unknown, kind: QtyKind = 'kg'): string {
  const n = Number(toQtyString(value));
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (kind === 'pcs') return formatPackagingQtyDisplay(n);

  const maxDecimals = maxDecimalsFor(kind);
  let decimals = maxDecimals;
  for (let d = 0; d <= maxDecimals; d += 1) {
    if (Number(n.toFixed(d)) > 0) {
      decimals = d;
      break;
    }
  }
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: maxDecimals,
  });
}

export function formatQtyWithUnit(value: unknown, kind: 'kg' | 'pcs'): string {
  return `${formatQtyExact(value, kind)} ${kind === 'kg' ? 'KG' : 'pcs'}`;
}

/** Free stock at warehouse for reserve (SIH − reserved). */
export function qtyAvailable(sih: number, reserved: number): number {
  return materialQtyToNum(materialQtySubNonNeg(sih, reserved));
}

/**
 * Outbound MTR (WH → MU): transferable qty from WH = min(physical WH stock, batch reserved).
 * When batchReserved is provided (reserved_batch_items for this BMR/BPR), use it; else warehouse reserved.
 */
export function qtyMtrFromReserved(whStock: number, reservedGlobal: number, batchReserved?: number): number {
  const wh = Number(whStock) || 0;
  const alloc =
    batchReserved !== undefined && batchReserved !== null
      ? Number(batchReserved) || 0
      : Number(reservedGlobal) || 0;
  return materialQtyToNum(materialQtyMin(alloc, wh));
}

/** Compare at full decimal precision so float noise does not false-trigger Short. */
export function isQtyShort(available: number, required: number, _kind: QtyKind = 'kg'): boolean {
  return materialQtyLt(available, required);
}

export function calcShortageQty(available: number, required: number): number {
  const a = materialQtyToNum(available);
  const req = materialQtyToNum(required);
  return Math.max(0, req - a);
}

/** PM shortage uses pcs precision. */
export function calcShortageQtyForKind(available: number, required: number, _kind: QtyKind): number {
  const a = materialQtyToNum(available);
  const req = materialQtyToNum(required);
  return Math.max(0, req - a);
}

/** Scale line qty when batch size changes — round to lifecycle precision. */
export function scaleQty(value: number, scale: number): number {
  return roundMaterialQty((Number(value) || 0) * (Number(scale) || 1));
}
