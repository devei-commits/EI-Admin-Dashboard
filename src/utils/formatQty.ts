/** Max decimals for RM/PM material qty through SO lifecycle (planning → production reserve). */
export const MATERIAL_QTY_MAX_DECIMALS = 16;

/** @deprecated Use MATERIAL_QTY_MAX_DECIMALS — kept for imports. */
export const QTY_KG_MAX_DECIMALS = MATERIAL_QTY_MAX_DECIMALS;

/** @deprecated Use MATERIAL_QTY_MAX_DECIMALS — kept for imports. */
export const QTY_PCS_MAX_DECIMALS = MATERIAL_QTY_MAX_DECIMALS;

export type QtyKind = 'kg' | 'pcs' | 'raw';

function maxDecimalsFor(kind: QtyKind): number {
  return MATERIAL_QTY_MAX_DECIMALS;
}

/** Persist/compare at lifecycle precision (16 dp). */
export function roundMaterialQty(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(MATERIAL_QTY_MAX_DECIMALS));
}

/**
 * Normalize for comparisons only — avoids 63.0000000001 vs 63 false "short".
 * Does not change stored values; use before isQtyShort / reserve checks.
 */
export function normalizeQtyForCompare(value: unknown, kind: QtyKind = 'kg'): number {
  return roundMaterialQty(value);
}

/**
 * Display quantity with all meaningful decimals (up to max), never rounding 0.0004 → 0.
 */
export function formatQtyExact(value: unknown, kind: QtyKind = 'raw'): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
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
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '0';
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
  const s = Number(sih) || 0;
  const r = Number(reserved) || 0;
  return Math.max(0, s - r);
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
  return Math.max(0, Math.min(alloc, wh));
}

/** Compare at full decimal precision so float noise does not false-trigger Short. */
export function isQtyShort(available: number, required: number, kind: QtyKind = 'kg'): boolean {
  return normalizeQtyForCompare(available, kind) < normalizeQtyForCompare(required, kind);
}

export function calcShortageQty(available: number, required: number): number {
  const a = normalizeQtyForCompare(available, 'kg');
  const req = normalizeQtyForCompare(required, 'kg');
  return Math.max(0, req - a);
}

/** PM shortage uses pcs precision. */
export function calcShortageQtyForKind(available: number, required: number, kind: QtyKind): number {
  const a = normalizeQtyForCompare(available, kind);
  const req = normalizeQtyForCompare(required, kind);
  return Math.max(0, req - a);
}

/** Scale line qty when batch size changes — round to lifecycle precision. */
export function scaleQty(value: number, scale: number): number {
  return roundMaterialQty((Number(value) || 0) * (Number(scale) || 1));
}
