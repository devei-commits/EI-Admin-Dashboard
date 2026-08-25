/**
 * The expected-shipment date a draft PO should carry.
 *
 * It was always computed as `today + lead days`, which threw away the required-by date the planner
 * set when releasing to planning. Release is consolidated per ISO week precisely so procurement can
 * see week-by-week demand — but every PO came out dated from the day it was raised, so that week
 * structure was invisible downstream.
 *
 * The PR's required-by date wins when present; the lead-time calculation stays as the fallback for
 * requests that never carried one.
 */

/** `YYYY-MM-DD` for a date-like value, or '' when it is not a usable date. */
function dateOnly(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  // Already date-only — accept without constructing a Date (avoids timezone shifting the day).
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function poExpectedDateFromPr(args: {
  /** required_by_date from the procurement request, if any. */
  requiredByDate?: string | null;
  /** Fallback: the date the PO is being raised. */
  today: Date;
  /** Fallback: max lead time across the PO's lines. */
  leadDays?: number;
}): string {
  const required = dateOnly(args.requiredByDate);
  if (required) return required;
  const fallback = new Date(args.today);
  fallback.setDate(fallback.getDate() + Math.max(0, Number(args.leadDays) || 0));
  return fallback.toISOString().slice(0, 10);
}
