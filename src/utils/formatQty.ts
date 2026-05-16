/** Max decimals for RM / KG quantities (BOM % and small batch lines). */
export const QTY_KG_MAX_DECIMALS = 6;

/** Max decimals for PM / piece counts when fractional. */
export const QTY_PCS_MAX_DECIMALS = 4;

export type QtyKind = 'kg' | 'pcs' | 'raw';

function maxDecimalsFor(kind: QtyKind): number {
  return kind === 'kg' ? QTY_KG_MAX_DECIMALS : kind === 'pcs' ? QTY_PCS_MAX_DECIMALS : QTY_KG_MAX_DECIMALS;
}

/**
 * Normalize for comparisons only — avoids 63.0000000001 vs 63 false "short".
 * Does not change stored values; use before isQtyShort / reserve checks.
 */
export function normalizeQtyForCompare(value: unknown, kind: QtyKind = 'kg'): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const decimals = maxDecimalsFor(kind);
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
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

/** Free stock at warehouse for reserve / MTR (no rounding). */
export function qtyAvailable(sih: number, reserved: number): number {
  const s = Number(sih) || 0;
  const r = Number(reserved) || 0;
  return Math.max(0, s - r);
}

/** Compare at full decimal precision (6 dp KG) so float noise does not false-trigger Short. */
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

/** Scale line qty when batch size changes — no rounding. */
export function scaleQty(value: number, scale: number): number {
  return (Number(value) || 0) * (Number(scale) || 1);
}
