/**
 * Nearest connecting date for an Items Involved row.
 *
 * The row already carries `connectingDates` from the Items Involved API — one entry per PO covering
 * the material, each with the date that PO connects on. They are listed individually under PO Qty
 * because the spread matters for scheduling, but the row also needs a single answer to "when does
 * the first of it land?", since that is what unblocks the earliest batch.
 *
 * So this picks the MINIMUM date, not the PO-level ETA and not the latest: an item on two POs
 * connecting on the 20th and the 30th has a connecting date of the 20th.
 *
 * Deliberately reads the same array the sub-lines render from rather than re-deriving anything from
 * the PO list — a second derivation would let the column and the lines under it disagree about the
 * same PO.
 */

export type ConnectingDateEntry = { poNo: string; date: string };

/** `YYYY-MM-DD`, or '' when the value is not a usable date. */
function dateOnly(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export type NearestConnectingDate = {
  /** Soonest date across the item's POs. */
  date: string;
  /** The PO that connects first. */
  poNo: string;
  /** How many POs carry a usable connecting date — >1 means the column is showing the earliest. */
  poCount: number;
};

/**
 * Soonest connecting date among the row's POs, or null when none carries a usable date.
 *
 * Entries without a parseable date are skipped rather than sorted as empty strings, which would
 * otherwise sort first and report "no date" as the nearest one.
 */
export function nearestConnectingDate(
  entries: ReadonlyArray<ConnectingDateEntry> | null | undefined,
): NearestConnectingDate | null {
  const usable: ConnectingDateEntry[] = [];
  for (const e of entries ?? []) {
    const date = dateOnly(e?.date);
    if (!date) continue;
    usable.push({ poNo: String(e?.poNo ?? '').trim() || '—', date });
  }
  if (usable.length === 0) return null;

  let best = usable[0]!;
  for (const e of usable) {
    if (e.date < best.date) best = e;
  }
  return { date: best.date, poNo: best.poNo, poCount: usable.length };
}
