/**
 * Lead connecting date — when a PO line is expected to connect, counted from the PO itself.
 *
 * `PO creation date + that item's lead days`. This is deliberately NOT the "Connecting" column
 * already on the Items tab: that one shows the required-by date carried over from Planning (what the
 * plan WANTS), whereas this shows what the vendor's quoted lead time actually delivers from the day
 * the PO was raised (what procurement should EXPECT). Seeing both side by side is the point — the
 * gap between them is the slip.
 *
 * Lead days are per line, so a PO carries as many lead connecting dates as it has items; the PO-wise
 * row summarises them as a range and is not "connected" until the longest-lead item lands.
 */

/** `YYYY-MM-DD` for a date-like value, or '' when it is not a usable date. */
function dateOnly(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  // Already date-only — accept without constructing a Date, which would re-interpret it in the
  // local timezone and can shift the day either side of UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Lead days as a usable number, or null when the value was never resolved.
 *
 * `null` and `0` are different answers and must stay so: a line whose lead time is genuinely zero
 * connects on the PO date, while a line with no lead time on record cannot be dated at all. Folding
 * the second into the first (`Number(x) || 0`, as the SLA column does) would invent a connecting
 * date equal to the PO date for every item nobody has quoted a lead time for.
 */
export function normalizeLeadDays(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  // A negative lead time is not meaningful; treat it as same-day rather than dating the line
  // before the PO that ordered it.
  return n > 0 ? n : 0;
}

/** Add whole days in UTC, so the result never depends on the viewer's timezone. */
function addDaysUtc(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const ms = Date.UTC(y, (m ?? 1) - 1, d ?? 1) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Lead connecting date for one PO line, or null when the PO date or lead time is unknown. */
export function leadConnectingDateForLine(
  createdDate: unknown,
  leadDays: unknown,
): string | null {
  const start = dateOnly(createdDate);
  if (!start) return null;
  const days = normalizeLeadDays(leadDays);
  if (days === null) return null;
  return addDaysUtc(start, days);
}

export type PoLeadConnectingSummary = {
  /** Soonest line to connect. */
  earliest: string;
  /** Last line to connect — the PO is only fully in once this lands. */
  latest: string;
  /** `CODE: YYYY-MM-DD` per dated line, for the cell's tooltip. */
  items: string[];
  /** Lines whose lead time is not on record, so they could not be dated. */
  unknownCount: number;
};

/**
 * Roll a PO's lines up to one lead connecting figure.
 *
 * Returns null when no line could be dated at all. Lines missing a lead time are counted in
 * `unknownCount` rather than dropped silently — a PO showing a confident date that covers only 2 of
 * its 9 items is worse than one that says so.
 */
export function leadConnectingSummaryForPo(
  createdDate: unknown,
  lineItems: ReadonlyArray<{ itemCode?: string; item?: string; leadTimeDays?: number }> | null | undefined,
): PoLeadConnectingSummary | null {
  const lines = Array.isArray(lineItems) ? lineItems : [];
  const dated: { label: string; date: string }[] = [];
  let unknownCount = 0;

  for (const line of lines) {
    const date = leadConnectingDateForLine(createdDate, line?.leadTimeDays);
    if (!date) {
      unknownCount += 1;
      continue;
    }
    const label = String(line?.itemCode ?? line?.item ?? '').trim() || 'item';
    dated.push({ label, date });
  }

  if (dated.length === 0) return null;
  dated.sort((a, b) => a.date.localeCompare(b.date));
  return {
    earliest: dated[0]!.date,
    latest: dated[dated.length - 1]!.date,
    items: dated.map((d) => `${d.label}: ${d.date}`),
    unknownCount,
  };
}
