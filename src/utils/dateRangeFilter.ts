/**
 * Client-side date range filter for master list views.
 *
 * - From only: records on or after that calendar day
 * - From + To: inclusive range (either order of inputs)
 * - To only: records on or before that day
 */

export type DateRangeFilterInputs = {
  from: string;
  to: string;
};

export function parseCalendarDateInput(value: string): Date | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseRecordCalendarDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayStartMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** True when no date filter is active. */
export function isDateRangeFilterEmpty(from: string, to: string): boolean {
  return !String(from ?? '').trim() && !String(to ?? '').trim();
}

/**
 * @param recordDate - ISO or display date from API
 * @param from - first date input (YYYY-MM-DD)
 * @param to - second date input (YYYY-MM-DD)
 */
export function matchesDateRangeFilter(recordDate: unknown, from: string, to: string): boolean {
  if (isDateRangeFilterEmpty(from, to)) return true;

  const rec = parseRecordCalendarDate(recordDate);
  if (!rec) return false;

  const recMs = dayStartMs(rec);
  const fromD = parseCalendarDateInput(from);
  const toD = parseCalendarDateInput(to);

  if (fromD && !toD) {
    return recMs >= dayStartMs(fromD);
  }
  if (!fromD && toD) {
    return recMs <= dayStartMs(toD);
  }
  if (fromD && toD) {
    const lo = Math.min(dayStartMs(fromD), dayStartMs(toD));
    const hi = Math.max(dayStartMs(fromD), dayStartMs(toD));
    return recMs >= lo && recMs <= hi;
  }
  return true;
}

export function dateRangeFilterSummary(from: string, to: string): string | null {
  if (isDateRangeFilterEmpty(from, to)) return null;
  const fromD = parseCalendarDateInput(from);
  const toD = parseCalendarDateInput(to);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (fromD && !toD) return `From ${fmt(fromD)}`;
  if (!fromD && toD) return `Until ${fmt(toD)}`;
  if (fromD && toD) {
    const lo = dayStartMs(fromD) <= dayStartMs(toD) ? fromD : toD;
    const hi = dayStartMs(fromD) <= dayStartMs(toD) ? toD : fromD;
    return `${fmt(lo)} – ${fmt(hi)}`;
  }
  return null;
}
