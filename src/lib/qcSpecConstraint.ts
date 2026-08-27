/**
 * Read the acceptance rule out of a master spec STRING.
 *
 * QC pass/fail was keyed on each test's `outputType`, but master-seeded specs mostly carry no
 * output type at all — so `≥ 99.5%`, `1100 - 1500` and `38 - 43` all fell through to
 * "any non-empty text passes". A viscosity of -1 against 1100-1500, and the literal text "fafa",
 * both reported PASS.
 *
 * The spec text itself states the rule, so it is parsed directly: ranges, lower bounds, upper
 * bounds and exact targets. Specs that are genuinely descriptive ("CLEAR", "MILD CHARACTERISTIC")
 * have no numeric constraint and are left to the existing text handling.
 */

export type QcConstraint =
  | { kind: 'range'; min: number; max: number }
  | { kind: 'min'; value: number }
  | { kind: 'max'; value: number }
  | { kind: 'exact'; value: number };

/** First number in a string, tolerating %, units and thousands separators. */
function firstNumber(raw: string): number | null {
  const m = String(raw).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function allNumbers(raw: string): number[] {
  const out = String(raw).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g) ?? [];
  return out.map(Number).filter((n) => Number.isFinite(n));
}

/**
 * Parse a spec string into a numeric constraint, or null when it does not express one.
 *
 * Handles the forms present in the masters:
 *   "≥ 99.5%" / ">= 99.5" / "NLT 99.5" / "min 99.5"        -> min
 *   "≤ 0.1%"  / "<= 0.1"  / "NMT 0.1"  / "max 0.1"         -> max
 *   "1100 - 1500" / "4.0-5.0" / "1.258 to 1.268 g/mL"      -> range
 *   "23"                                                    -> exact
 */
export function parseQcSpecConstraint(spec: string | null | undefined): QcConstraint | null {
  const raw = String(spec ?? '').trim();
  if (!raw) return null;

  // A spec that is mostly words ("MISCIBLE WITH WATER…") may still contain digits; only treat it as
  // numeric when the numbers carry a comparator or a range, or the spec is essentially just a number.
  const lower = raw.toLowerCase();

  if (/(≥|>=|not\s*less\s*than|nlt|min(?:imum)?\b)/.test(lower)) {
    const n = firstNumber(raw);
    return n == null ? null : { kind: 'min', value: n };
  }
  if (/(≤|<=|not\s*more\s*than|nmt|max(?:imum)?\b)/.test(lower)) {
    const n = firstNumber(raw);
    return n == null ? null : { kind: 'max', value: n };
  }
  if (/^\s*>\s*-?\d/.test(raw)) {
    const n = firstNumber(raw);
    return n == null ? null : { kind: 'min', value: n };
  }
  if (/^\s*<\s*-?\d/.test(raw)) {
    const n = firstNumber(raw);
    return n == null ? null : { kind: 'max', value: n };
  }

  // Range: "a - b", "a to b", "a – b". Require the separator to sit BETWEEN two numbers so a
  // negative lower bound ("-5 to 5") is not mistaken for a separator.
  const rangeMatch = raw
    .replace(/,/g, '')
    .match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to|~)\s*(-?\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { kind: 'range', min: Math.min(a, b), max: Math.max(a, b) };
    }
  }

  // Bare number (optionally with a unit/%): an exact target.
  const nums = allNumbers(raw);
  if (nums.length === 1 && /^[^a-z]*-?\d+(?:\.\d+)?\s*[%a-z/°µ.]*$/i.test(raw)) {
    return { kind: 'exact', value: nums[0] };
  }
  return null;
}

/** Does a measured number satisfy the constraint? */
export function measurementSatisfies(constraint: QcConstraint, measured: number, tolerance = 0): boolean {
  const tol = Math.abs(Number(tolerance) || 0);
  switch (constraint.kind) {
    case 'range':
      return measured >= constraint.min - tol && measured <= constraint.max + tol;
    case 'min':
      return measured >= constraint.value - tol;
    case 'max':
      return measured <= constraint.value + tol;
    case 'exact':
      return Math.abs(measured - constraint.value) <= tol;
    default:
      return false;
  }
}

/** Numeric value of an entered result, or null when it is not a number. */
export function parseMeasuredValue(result: string | null | undefined): number | null {
  const raw = String(result ?? '').trim();
  if (!raw) return null;
  // Must be a number on its own (a unit suffix is fine) — "fafa" and "Pass" are not measurements.
  if (!/^-?\d+(?:\.\d+)?\s*[%a-z/°µ.]*$/i.test(raw.replace(/,/g, ''))) return null;
  const n = Number(raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Verdict for a numeric spec: true/false when it can be judged, null when the entry is not a
 * measurement at all. Null keeps the test "awaiting" rather than passing garbage, which is what
 * blocks QC completion.
 */
export function evaluateAgainstSpec(
  spec: string | null | undefined,
  result: string | null | undefined,
  tolerance?: string | number | null,
): boolean | null | undefined {
  const constraint = parseQcSpecConstraint(spec);
  // undefined = "this spec is not numeric, use the existing text handling".
  if (!constraint) return undefined;
  const measured = parseMeasuredValue(result);
  if (measured == null) return null;
  const tol = typeof tolerance === 'number' ? tolerance : parseMeasuredValue(String(tolerance ?? '')) ?? 0;
  return measurementSatisfies(constraint, measured, tol);
}
