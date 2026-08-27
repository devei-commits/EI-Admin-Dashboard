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
