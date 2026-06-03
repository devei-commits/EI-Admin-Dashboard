import { MATERIAL_QTY_MAX_DECIMALS, roundMaterialQty } from './formatQty';

/** Display value for stock/qty inputs — blank when zero so edit fields are not stuck on "0". */
export function formatQtyInputDisplay(value: unknown): string {
  const n = roundMaterialQty(value, 'kg');
  if (!Number.isFinite(n) || n === 0) return '';
  const fixed = n.toFixed(MATERIAL_QTY_MAX_DECIMALS);
  return fixed.replace(/\.?0+$/, '');
}

/** Strip leading zeros while typing; preserves empty, "-", and partial decimals (e.g. "0.", ".5"). */
export function sanitizeQtyInputString(raw: string): string {
  const s = raw.trim();
  if (s === '' || s === '-') return s;

  const negative = s.startsWith('-');
  const body = (negative ? s.slice(1) : s).replace(/[^\d.]/g, '');
  if (body === '') return negative ? '-' : '';

  const dotIdx = body.indexOf('.');
  if (dotIdx >= 0) {
    const intPart = body.slice(0, dotIdx);
    const frac = body
      .slice(dotIdx + 1)
      .replace(/\./g, '')
      .slice(0, MATERIAL_QTY_MAX_DECIMALS);
    const intNorm = intPart === '' ? '' : String(Number(intPart));
    const prefix = negative ? '-' : '';
    if (intPart === '' && frac !== '') return `${prefix}.${frac}`;
    return `${prefix}${intNorm}.${frac}`;
  }

  return `${negative ? '-' : ''}${String(Number(body))}`;
}

/** Parse controlled qty input for state/API; empty or lone minus → 0. */
export function parseQtyInputString(raw: string): number {
  const s = raw.trim();
  if (s === '' || s === '-') return 0;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : roundMaterialQty(n, 'kg');
}
