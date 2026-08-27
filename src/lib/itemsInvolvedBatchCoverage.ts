/**
 * Coverage colour for each batch row in the "Batches using <item>" modal.
 *
 * The modal lists every released batch consuming an item, but every row looked identical — a batch
 * with no material behind it read the same as one fully covered by stock. With thirteen batches
 * against one item there was no way to see which were at risk without doing the arithmetic by hand.
 *
 * Supply is the item's free stock plus its net-open PO balance. Two properties of those figures are
 * worth stating because they shape what the colours can mean:
 *
 *   - SIH is FREE stock (the backend sends `max(0, stock_in_hand − reserved)`), not gross.
 *   - The PO figure is the NET OPEN balance, so anything already shipped has left it. In-transit
 *     stock is therefore counted nowhere here, and a batch arriving tomorrow will read red. That is
 *     a deliberate choice; widening supply is a one-line change in `batchCoverageTier`.
 *
 * Batches are judged INDEPENDENTLY: each is compared against the whole SIH/PO rather than consuming
 * a running pool, so the same stock legitimately backs several rows at once. The colours rank each
 * batch's size against available supply — they do not claim the set is collectively satisfiable.
 * The item-level gate below is what signals an overall shortfall.
 */

export type BatchCoverageTier = 'green' | 'pink' | 'yellow' | 'red' | 'none';

/** Non-negative finite number, so a negative or NaN input cannot inflate available supply. */
function clampQty(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Is the item's whole requirement covered by stock plus open POs?
 * When true every batch is satisfiable, so green is available; when false green is off the table
 * and rows are graded pink / yellow / red.
 */
export function isItemFullyCovered(totalRequired: unknown, sih: unknown, poQty: unknown): boolean {
  const required = clampQty(totalRequired);
  // Nothing required is trivially covered.
  if (required <= 0) return true;
  return required <= clampQty(sih) + clampQty(poQty);
}

/**
 * Colour tier for one batch row.
 *
 * Comparisons are inclusive (`<=`) at both boundaries: a batch exactly equal to SIH is covered by
 * stock, and one exactly equal to SIH + PO is covered by the pipeline.
 */
export function batchCoverageTier(args: {
  batchQty: unknown;
  sih: unknown;
  poQty: unknown;
  itemFullyCovered: boolean;
}): BatchCoverageTier {
  const batchQty = clampQty(args.batchQty);
  // No requirement to judge — leave the row untinted rather than reporting it as covered by stock.
  if (batchQty <= 0) return 'none';
  if (args.itemFullyCovered) return 'green';

  const sih = clampQty(args.sih);
  const poQty = clampQty(args.poQty);
  if (batchQty <= sih) return 'pink';
  if (batchQty <= sih + poQty) return 'yellow';
  return 'red';
}

/**
 * Row classes for a tier: soft background plus a left accent bar.
 *
 * Mirrors the tinting convention already used by the PIs Extracted rows (`pisRowClass`) so the two
 * tables read the same way. `none` returns '' and the caller keeps its zebra striping.
 */
export function batchCoverageRowClass(tier: BatchCoverageTier): string {
  // --cov-*-bg are the row-strength tints, distinct from the lighter --st-*-bg badge tones: a full
  // table row needs more saturation than a pill to read as colour-coded.
  //
  // `[&_td]:text-ink` darkens the cell text, which would otherwise sit at mid-grey (`text-ink-2`)
  // on a saturated background and lose contrast. It applies to the cells only — the batch-code
  // link keeps its own `text-brand` colour, since a direct rule beats inherited.
  const text = '[&_td]:text-ink';
  switch (tier) {
    case 'green':
      return `bg-[color:var(--cov-green-bg)] border-l-[6px] border-l-[color:var(--cov-green-fg)] ${text}`;
    case 'pink':
      return `bg-[color:var(--cov-pink-bg)] border-l-[6px] border-l-[color:var(--cov-pink-fg)] ${text}`;
    case 'yellow':
      return `bg-[color:var(--cov-amber-bg)] border-l-[6px] border-l-[color:var(--cov-amber-fg)] ${text}`;
    case 'red':
      return `bg-[color:var(--cov-red-bg)] border-l-[6px] border-l-[color:var(--cov-red-fg)] ${text}`;
    default:
      return '';
  }
}

/**
 * Short tier name shown as a pill on the row.
 *
 * The tier must not depend on colour alone: four tints in one table are hard to tell apart at a
 * glance (and impossible for a colour-blind reader), so the row states which one it is in words.
 */
export function batchCoverageLabel(tier: BatchCoverageTier): string {
  switch (tier) {
    case 'green':
      return 'COVERED';
    case 'pink':
      return 'IN STOCK';
    case 'yellow':
      return 'NEEDS PO';
    case 'red':
      return 'SHORT';
    default:
      return '';
  }
}

/** Solid pill classes for the tier label — readable against the row tint behind it. */
export function batchCoverageBadgeClass(tier: BatchCoverageTier): string {
  const base =
    'inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-white';
  switch (tier) {
    case 'green':
      return `${base} bg-[color:var(--cov-green-fg)]`;
    case 'pink':
      return `${base} bg-[color:var(--cov-pink-fg)]`;
    case 'yellow':
      return `${base} bg-[color:var(--cov-amber-fg)]`;
    case 'red':
      return `${base} bg-[color:var(--cov-red-fg)]`;
    default:
      return '';
  }
}

/** Legend entries, in the severity order the rule is written in. */
export const BATCH_COVERAGE_LEGEND: { tier: Exclude<BatchCoverageTier, 'none'>; label: string }[] = [
  { tier: 'green', label: 'Item fully covered' },
  { tier: 'pink', label: 'Batch within stock' },
  { tier: 'yellow', label: 'Batch needs the PO' },
  { tier: 'red', label: 'Batch exceeds stock + PO' },
];
