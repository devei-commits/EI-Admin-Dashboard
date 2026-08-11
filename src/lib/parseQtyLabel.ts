/**
 * Parse a quantity out of a display label ("154.4 units", "1,536 KG", "500").
 *
 * These values arrive as pre-formatted strings, and the code used to read them with
 * `parseInt(s.replace(/\D/g, ''), 10)`. Stripping every non-digit also strips the decimal point, so
 * "154.3999999999996 units" became 1543999999999996 — a 154-unit order rendered as 1.5 quadrillion.
 * Thousands separators were silently swallowed the same way ("1,536" → 1536 by luck, "1,536.5" → 15365).
 *
 * This keeps the decimal point and the sign, and ignores separators and trailing unit text.
 */

/** First numeric value in the label, or 0 when there is none. */
export function parseQtyLabel(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const s = String(raw ?? '').replace(/,/g, '');
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return 0;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Same, rounded to a whole number — for quantities counted in discrete units (bottles, packs).
 * Rounds rather than truncates so 154.3999999999996 reads as 154, not 154 by luck / 153 by drift.
 */
export function parseQtyLabelInt(raw: unknown): number {
  const n = parseQtyLabel(raw);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
