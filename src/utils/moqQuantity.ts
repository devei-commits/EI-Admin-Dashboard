/** Parse MOQ from form input (supports decimals). */
export function parseMoqInput(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10000) / 10000;
}

export function moqValuesEqual(
  a: string | number | null | undefined,
  b: string | number | null | undefined
): boolean {
  const na = parseMoqInput(a);
  const nb = parseMoqInput(b);
  if (na == null || nb == null) return false;
  return Math.abs(na - nb) < 1e-6;
}

/** Display MOQ without trailing zeros (1.5 stays 1.5; 25 stays 25). */
export function formatMoqDisplay(value: string | number | null | undefined): string {
  const v = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
  return String(parseFloat(v.toFixed(4)));
}
