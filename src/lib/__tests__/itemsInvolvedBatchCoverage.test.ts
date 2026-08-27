/**
 * Batch rows in "Batches using <item>" were untinted, so a batch with no material behind it looked
 * identical to one fully covered by stock. These pin the colouring rule.
 */
import { describe, it, expect } from 'vitest';
import {
  batchCoverageBadgeClass,
  batchCoverageLabel,
  batchCoverageRowClass,
  batchCoverageTier,
  isItemFullyCovered,
  itemCoverageTierFromBatches,
  type BatchCoverageTier,
} from '../itemsInvolvedBatchCoverage';

const tier = (batchQty: number, sih: number, poQty: number, itemFullyCovered = false) =>
  batchCoverageTier({ batchQty, sih, poQty, itemFullyCovered });

describe('isItemFullyCovered', () => {
  it('is covered when stock plus open POs meet the whole requirement', () => {
    expect(isItemFullyCovered(5000, 4000, 2000)).toBe(true);
    expect(isItemFullyCovered(5000, 5000, 0)).toBe(true);
  });

  it('is not covered when the requirement exceeds them — the 13-batch case', () => {
    expect(isItemFullyCovered(120271, 30000, 40000)).toBe(false);
  });

  it('treats the exact boundary as covered', () => {
    expect(isItemFullyCovered(70000, 30000, 40000)).toBe(true);
  });

  it('treats a zero requirement as trivially covered', () => {
    expect(isItemFullyCovered(0, 0, 0)).toBe(true);
  });

  it('does not let negative or NaN supply inflate coverage', () => {
    expect(isItemFullyCovered(100, -500, 0)).toBe(false);
    expect(isItemFullyCovered(100, Number.NaN, Number.NaN)).toBe(false);
  });
});

describe('batchCoverageTier', () => {
  it('greens every row when the item is fully covered', () => {
    // Coverage is an item-level state: if the whole requirement is met, each batch is satisfiable.
    expect(tier(1000, 4000, 2000, true)).toBe('green');
    expect(tier(3500, 4000, 2000, true)).toBe('green');
  });

  it('grades pink / yellow / red when the item is short', () => {
    expect(tier(500, 30000, 40000)).toBe('pink');
    expect(tier(35000, 30000, 40000)).toBe('yellow');
    expect(tier(80000, 30000, 40000)).toBe('red');
  });

  it('treats both boundaries as inclusive', () => {
    expect(tier(30000, 30000, 40000)).toBe('pink');
    expect(tier(70000, 30000, 40000)).toBe('yellow');
    expect(tier(70001, 30000, 40000)).toBe('red');
  });

  it('leaves a batch with no requirement untinted rather than reporting it covered', () => {
    expect(tier(0, 30000, 40000)).toBe('none');
    expect(tier(-5, 30000, 40000)).toBe('none');
    expect(batchCoverageTier({ batchQty: Number.NaN, sih: 1, poQty: 1, itemFullyCovered: false }))
      .toBe('none');
  });

  it('reds everything when there is no supply at all', () => {
    expect(tier(500, 0, 0)).toBe('red');
  });

  it('clamps negative supply instead of letting it change the tier', () => {
    expect(tier(500, -1000, -1000)).toBe('red');
  });

  it('judges batches INDEPENDENTLY — the same stock backs several rows', () => {
    // Recorded deliberately: with SIH 30,000 each of these is pink on its own, so more quantity is
    // coloured as covered than exists. The item gate is what reports the overall shortfall.
    expect(tier(23000, 30000, 40000)).toBe('pink');
    expect(tier(21000, 30000, 40000)).toBe('pink');
    expect(tier(25000, 30000, 40000)).toBe('pink');
  });

  it('reproduces the real 13-batch list exactly', () => {
    // Item 5000002 — SHRINK SLEEVE 70 x 155 MM. SIH 30,000 · PO 40,000 · required 1,20,271.
    const sih = 30000;
    const po = 40000;
    const covered = isItemFullyCovered(120271, sih, po);
    expect(covered).toBe(false);

    const batches = [500, 23000, 21000, 25000, 35000, 3000];
    expect(batches.map((q) => tier(q, sih, po, covered))).toEqual([
      'pink', // 500
      'pink', // 23,000
      'pink', // 21,000
      'pink', // 25,000
      'yellow', // 35,000 — over stock, within stock + PO
      'pink', // 3,000
    ]);
  });
});

describe('itemCoverageTierFromBatches', () => {
  it('reds the item when ANY batch is red, whatever else is there', () => {
    expect(itemCoverageTierFromBatches(['green', 'pink', 'yellow', 'red'])).toBe('red');
    expect(itemCoverageTierFromBatches(['red', 'green'])).toBe('red');
  });

  it('falls to yellow only when no batch is red', () => {
    expect(itemCoverageTierFromBatches(['green', 'pink', 'yellow'])).toBe('yellow');
    expect(itemCoverageTierFromBatches(['yellow', 'green'])).toBe('yellow');
  });

  it('falls to pink only when no batch is red or yellow', () => {
    expect(itemCoverageTierFromBatches(['green', 'pink', 'green'])).toBe('pink');
  });

  it('stays green only when every batch is green', () => {
    expect(itemCoverageTierFromBatches(['green', 'green', 'green'])).toBe('green');
  });

  it('holds the full priority order red > yellow > pink > green', () => {
    const all: BatchCoverageTier[] = ['green', 'pink', 'yellow', 'red'];
    // Drop the worst each time; the next one down must take over.
    expect(itemCoverageTierFromBatches(all)).toBe('red');
    expect(itemCoverageTierFromBatches(all.slice(0, 3))).toBe('yellow');
    expect(itemCoverageTierFromBatches(all.slice(0, 2))).toBe('pink');
    expect(itemCoverageTierFromBatches(all.slice(0, 1))).toBe('green');
  });

  it('skips untinted batches instead of letting them outrank a real verdict', () => {
    // A batch with no requirement carries no verdict — it must not dilute a red sibling, nor
    // count as satisfied and hold an otherwise-green item back.
    expect(itemCoverageTierFromBatches(['none', 'red'])).toBe('red');
    expect(itemCoverageTierFromBatches(['none', 'green'])).toBe('green');
  });

  it('leaves an item with no judgeable batches untinted', () => {
    expect(itemCoverageTierFromBatches([])).toBe('none');
    expect(itemCoverageTierFromBatches(['none', 'none'])).toBe('none');
  });

  it('rolls the real 13-batch item up to yellow', () => {
    // Item 5000002 — five pink batches and one yellow, no red: the yellow wins.
    const sih = 30000;
    const po = 40000;
    const covered = isItemFullyCovered(120271, sih, po);
    const tiers = [500, 23000, 21000, 25000, 35000, 3000].map((q) => tier(q, sih, po, covered));
    expect(itemCoverageTierFromBatches(tiers)).toBe('yellow');
  });

  it('rolls a fully covered item up to green', () => {
    const covered = isItemFullyCovered(5000, 4000, 2000);
    expect(covered).toBe(true);
    const tiers = [1000, 3500, 500].map((q) => tier(q, 4000, 2000, covered));
    expect(itemCoverageTierFromBatches(tiers)).toBe('green');
  });

  it('rolls an item with one oversized batch up to red', () => {
    const covered = isItemFullyCovered(200000, 30000, 40000);
    expect(covered).toBe(false);
    const tiers = [500, 80000, 3000].map((q) => tier(q, 30000, 40000, covered));
    expect(tiers).toEqual(['pink', 'red', 'pink']);
    expect(itemCoverageTierFromBatches(tiers)).toBe('red');
  });
});

describe('batchCoverageRowClass', () => {
  it('returns a distinct background per tier', () => {
    const classes = (['green', 'pink', 'yellow', 'red'] as BatchCoverageTier[]).map(
      batchCoverageRowClass,
    );
    expect(new Set(classes).size).toBe(4);
    for (const c of classes) expect(c).toContain('border-l-[6px]');
  });

  it('uses its own accent colour per tier, not the shared badge tokens', () => {
    // The row accents are --cov-*-fg. Binding them to the app-wide --st-* tokens would mean any
    // restyle of a status pill silently changed these rows too.
    expect(batchCoverageRowClass('red')).toContain('--cov-red-fg');
    expect(batchCoverageRowClass('pink')).toContain('--cov-pink-fg');
  });

  it('returns nothing for an untinted row so the caller keeps its zebra striping', () => {
    expect(batchCoverageRowClass('none')).toBe('');
  });
});

describe('batchCoverageLabel', () => {
  it('names every tier in words, so the meaning never rests on colour alone', () => {
    expect(batchCoverageLabel('green')).toBe('COVERED');
    expect(batchCoverageLabel('pink')).toBe('IN STOCK');
    expect(batchCoverageLabel('yellow')).toBe('NEEDS PO');
    expect(batchCoverageLabel('red')).toBe('SHORT');
  });

  it('gives an untinted row no label', () => {
    expect(batchCoverageLabel('none')).toBe('');
    expect(batchCoverageBadgeClass('none')).toBe('');
  });

  it('uses a distinct solid pill per tier', () => {
    const pills = (['green', 'pink', 'yellow', 'red'] as BatchCoverageTier[]).map(
      batchCoverageBadgeClass,
    );
    expect(new Set(pills).size).toBe(4);
    // White text on a solid fill, so the pill stays readable over any row tint.
    for (const p of pills) expect(p).toContain('text-white');
  });
});
