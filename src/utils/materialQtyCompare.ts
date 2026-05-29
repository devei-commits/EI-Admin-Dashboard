/** Exact material qty compare (up to 16 dp) — transfers/MTR use DB precision. */
export const MATERIAL_QTY_SCALE = 16;
const SCALE_POW = 10n ** BigInt(MATERIAL_QTY_SCALE);
/** Snap JS number inputs at 10 dp to kill BOM float noise. */
const FLOAT_SNAP_SCALE = 10;
const FLOAT_SNAP_POW = 10 ** FLOAT_SNAP_SCALE;

function fromScaledBigInt(bi: bigint): string {
  const neg = bi < 0n;
  const abs = neg ? -bi : bi;
  const intPart = abs / SCALE_POW;
  const frac = abs % SCALE_POW;
  if (frac === 0n) return `${neg ? '-' : ''}${intPart}`;
  const fracStr = frac.toString().padStart(MATERIAL_QTY_SCALE, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${intPart}.${fracStr}`;
}

function snapJsFloatNumber(n: number): number {
  return Math.round(n * FLOAT_SNAP_POW + Number.EPSILON) / FLOAT_SNAP_POW;
}

function parseDecimalStringToScaledBigInt(s: string): bigint {
  let str = s.trim();
  if (str === '' || str === '-') return 0n;
  const neg = str.startsWith('-');
  if (neg) str = str.slice(1);
  const dot = str.indexOf('.');
  let intPart = (dot >= 0 ? str.slice(0, dot) : str).replace(/[^\d]/g, '') || '0';
  let fracPart = (dot >= 0 ? str.slice(dot + 1) : '').replace(/[^\d]/g, '');

  if (fracPart.length > MATERIAL_QTY_SCALE) {
    const roundDigit = parseInt(fracPart[MATERIAL_QTY_SCALE] || '0', 10);
    fracPart = fracPart.slice(0, MATERIAL_QTY_SCALE);
    if (roundDigit >= 5) {
      let fracBi = BigInt(fracPart || '0') + 1n;
      let intBi = BigInt(intPart);
      if (fracBi >= SCALE_POW) {
        fracBi = 0n;
        intBi += 1n;
      }
      intPart = String(intBi);
      fracPart = fracBi.toString().padStart(MATERIAL_QTY_SCALE, '0');
    }
  } else {
    fracPart = fracPart.padEnd(MATERIAL_QTY_SCALE, '0');
  }

  const combined = BigInt(intPart) * SCALE_POW + BigInt(fracPart || '0');
  return neg ? -combined : combined;
}

/** All inputs (DB strings, JSON numbers, BOM floats) → same canonical decimal string. */
function canonicalQtyNumericString(value: unknown): string {
  if (value == null || value === '') return '0';
  const s = typeof value === 'string' ? value.trim() : String(value);
  if (s === '' || s === '-') return '0';
  const n = Number(s);
  if (!Number.isFinite(n)) return '0';
  return String(snapJsFloatNumber(n));
}

/** Canonical qty string at SCALE dp. */
export function toQtyString(value: unknown): string {
  return fromScaledBigInt(parseDecimalStringToScaledBigInt(canonicalQtyNumericString(value)));
}

function toScaledBigInt(value: unknown): bigint {
  return parseDecimalStringToScaledBigInt(canonicalQtyNumericString(value));
}

export function compareMaterialQty(a: unknown, b: unknown): number {
  const ai = toScaledBigInt(a);
  const bi = toScaledBigInt(b);
  if (ai < bi) return -1;
  if (ai > bi) return 1;
  return 0;
}

export function materialQtyGte(a: unknown, b: unknown): boolean {
  return compareMaterialQty(a, b) >= 0;
}

export function materialQtyLte(a: unknown, b: unknown): boolean {
  return compareMaterialQty(a, b) <= 0;
}

export function materialQtyGt(a: unknown, b: unknown): boolean {
  return compareMaterialQty(a, b) > 0;
}

export function materialQtyLt(a: unknown, b: unknown): boolean {
  return compareMaterialQty(a, b) < 0;
}

export function materialQtyAdd(a: unknown, b: unknown): string {
  return fromScaledBigInt(toScaledBigInt(a) + toScaledBigInt(b));
}

export function materialQtyMin(a: unknown, b: unknown): string {
  return materialQtyLte(a, b) ? toQtyString(a) : toQtyString(b);
}

export function materialQtySubNonNeg(a: unknown, b: unknown): string {
  const diff = toScaledBigInt(a) - toScaledBigInt(b);
  return fromScaledBigInt(diff < 0n ? 0n : diff);
}

export function materialQtyToNum(value: unknown): number {
  const n = Number(toQtyString(value));
  return Number.isFinite(n) ? n : 0;
}

export function sanitizeMrnLineItemQuantity(value: unknown): string {
  return toQtyString(value);
}

/** Packaging (pcs) dispensing/MU checks at 2 dp — BOM 2.496 vs ML1 2.5 must not false-short. */
const PCS_DISPENSING_POW = 100;

function snapPackagingQtyString(value: unknown): string {
  const s = toQtyString(value);
  const n = Number(s);
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * PCS_DISPENSING_POW + Number.EPSILON) / PCS_DISPENSING_POW);
}

export function qtyForDispensingCompare(value: unknown, kind: 'kg' | 'pcs'): string {
  return kind === 'pcs' ? snapPackagingQtyString(value) : toQtyString(value);
}

export function materialQtyGteForDispensing(a: unknown, b: unknown, kind: 'kg' | 'pcs'): boolean {
  return compareMaterialQty(qtyForDispensingCompare(a, kind), qtyForDispensingCompare(b, kind)) >= 0;
}

export function materialQtyLteForDispensing(a: unknown, b: unknown, kind: 'kg' | 'pcs'): boolean {
  return compareMaterialQty(qtyForDispensingCompare(a, kind), qtyForDispensingCompare(b, kind)) <= 0;
}

/** PM consume at most physical at-MU qty (no round-up): 2.5 request vs 2.496 on hand → 2.496. */
export function capPmDispenseConsumption(requested: unknown, atMu: unknown): number {
  const req = materialQtyToNum(qtyForDispensingCompare(requested, 'pcs'));
  const at = materialQtyToNum(toQtyString(atMu));
  return req <= at ? req : at;
}
