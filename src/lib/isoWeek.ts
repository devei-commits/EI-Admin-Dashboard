/** ISO-8601 week number and week-year for a local calendar date (Monday-based weeks). */
export type IsoWeekParts = {
  week: number;
  year: number;
};

/**
 * ISO week/year for a local Date. Uses local noon to reduce DST edge cases.
 * Week 1 is the week containing the first Thursday of the calendar year.
 */
export function getIsoWeekAndYear(date: Date): IsoWeekParts {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const isoYear = d.getFullYear();
  const yearStart = new Date(isoYear, 0, 1, 12, 0, 0, 0);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: isoYear };
}

/** Parse YYYY-MM-DD (or other date-only strings) into ISO week parts. */
export function isoWeekFromDateString(raw: string | null | undefined): IsoWeekParts | null {
  const s = raw != null ? String(raw).trim().slice(0, 10) : '';
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day, 12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return getIsoWeekAndYear(d);
}

export function formatIsoWeekLabel(parts: IsoWeekParts | null): string {
  if (!parts || !(parts.week > 0)) return '—';
  return `Week ${parts.week}, ${parts.year}`;
}

export function formatIsoWeekShort(parts: IsoWeekParts | null): string {
  if (!parts || !(parts.week > 0)) return '—';
  return `W${parts.week}`;
}
