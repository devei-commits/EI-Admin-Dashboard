/**
 * Batch rows in "Batches using <item>" were untinted, so a batch with no material behind it looked
 * identical to one fully covered by stock. These pin the colouring rule.
 */
import { describe, it, expect } from 'vitest';
import {
  allocateConsolidatedReqAcrossBatches,
  batchCoverageBadgeClass,
  batchCoverageLabel,
  batchCoverageRowClass,
  batchCoverageTier,
  batchCoverageDetailMap,
  batchCoverageTierMap,
  isItemFullyCovered,
  itemCoverageTierFromBatches,
  releaseBatchPickKey,
  type BatchCoverageTier,
  type ItemsInvolvedAllocationRow,
} from '../itemsInvolvedBatchCoverage';
import type { PlanningBatchAllRow } from '../../services/planningExtracted.service';

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

describe('batch-centric coverage (Batches tab)', () => {
  // Reproduces the real screenshot: 15 ML AMBER GLASS BOTTLE (PM) — SIH 0, PO 30,000, two 450 KG
  // batches each requiring 30,000 PCS. batchQty (30,000) <= sih+poQty (0+30,000) → yellow, matching
  // what "Batches using 4001234" showed for both PE-3669-B1 and PE-3507-B1.
  const item: ItemsInvolvedAllocationRow = {
    code: 'PM-4001234',
    name: '15 ML AMBER GLASS BOTTLE WITH WHITE DROPPER SET WITH PLUG',
    itemType: 'PM',
    pack_material_id: 4001234,
    sihNum: 0,
    poQtyNum: 30000,
  };
  const pmBatch = (id: number, batchCode: string): PlanningBatchAllRow => ({
    id,
    planningExtractedId: 204,
    sequence: id,
    batchCode,
    sizeKg: 450,
    rmLines: [],
    pmLines: [{ pack_material_id: 4001234, qty_per_unit: 1 }],
    sent: true,
    orderQty: '1000',
    totalKg: '15',
    productName: 'SK GLOW GETTER ARBUTIN BRIGHTENING SERUM 15ML',
    soNumber: 'SO-00204',
  });
  const batches = [pmBatch(1, 'PE-3669-B1'), pmBatch(2, 'PE-3507-B1')];

  it('allocateConsolidatedReqAcrossBatches gives each batch its own 30,000 pcs requirement', () => {
    const alloc = allocateConsolidatedReqAcrossBatches(item, batches);
    expect(alloc.get(releaseBatchPickKey(batches[0]))).toBe(30000);
    expect(alloc.get(releaseBatchPickKey(batches[1]))).toBe(30000);
  });

  it('batchCoverageTierMap tints both batches yellow, keyed by releaseBatchPickKey', () => {
    const tiers = batchCoverageTierMap([item], batches);
    expect(tiers.get(releaseBatchPickKey(batches[0]))).toBe('yellow');
    expect(tiers.get(releaseBatchPickKey(batches[1]))).toBe('yellow');
    expect(tiers.size).toBe(2);
  });

  it('omits unsent batches — the Batches tab only lists released batches', () => {
    // A third sent batch keeps total sent demand (60,000) above SIH+PO (30,000) so this isn't
    // also exercising the "excluding it makes the item fully covered" case below.
    const thirdSent = pmBatch(3, 'PE-0001-B1');
    const unsent = { ...batches[0], sent: false };
    const tiers = batchCoverageTierMap([item], [unsent, batches[1], thirdSent]);
    expect(tiers.has(releaseBatchPickKey(unsent))).toBe(false);
    expect(tiers.get(releaseBatchPickKey(batches[1]))).toBe('yellow');
    expect(tiers.get(releaseBatchPickKey(thirdSent))).toBe('yellow');
  });

  it('excluding an unsent batch can bring sent demand within supply — greens the rest', () => {
    // Only one 30,000 pcs batch is actually sent; SIH 0 + PO 30,000 exactly covers it, so — unlike
    // the item-level view, which would also count the unsent batch — this batch reads green here,
    // matching getItemsInvolvedCoverageTier's own "released batches only" total.
    const unsent = { ...batches[0], sent: false };
    const tiers = batchCoverageTierMap([item], [unsent, batches[1]]);
    expect(tiers.get(releaseBatchPickKey(batches[1]))).toBe('green');
  });

  it('a batch spanning a red item and a green item reads red — the worst tier wins', () => {
    const shortItem: ItemsInvolvedAllocationRow = { ...item, code: 'PM-SHORT', sihNum: 0, poQtyNum: 0 };
    const coveredItem: ItemsInvolvedAllocationRow = {
      ...item,
      code: 'PM-COVERED',
      pack_material_id: 4001235,
      sihNum: 100000,
      poQtyNum: 0,
    };
    const sharedBatch: PlanningBatchAllRow = {
      ...pmBatch(3, 'PE-9999-B1'),
      pmLines: [
        { pack_material_id: 4001234, qty_per_unit: 1 }, // matches shortItem (via item's own pack_material_id below)
        { pack_material_id: 4001235, qty_per_unit: 1 }, // matches coveredItem
      ],
    };
    const tiers = batchCoverageTierMap(
      [{ ...shortItem, pack_material_id: 4001234 }, coveredItem],
      [sharedBatch],
    );
    expect(tiers.get(releaseBatchPickKey(sharedBatch))).toBe('red');
  });

  it('a batch with no matching BOM line for any item gets no entry (stays untinted)', () => {
    const unrelatedBatch: PlanningBatchAllRow = { ...pmBatch(9, 'PE-0000-B1'), pmLines: [] };
    const tiers = batchCoverageTierMap([item], [unrelatedBatch]);
    expect(tiers.has(releaseBatchPickKey(unrelatedBatch))).toBe(false);
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

describe('why the two tabs disagree — item scope vs batch scope', () => {
  /**
   * The reported case. PE-3669-B1 reads NEEDS PO in "Batches using 4001234" but SHORT in the
   * Batches tab, which looks like a contradiction and is not: the modal grades ONE material on the
   * batch, the tab grades ALL of them.
   *
   * Confirmed against the database: the batch carries 15 materials. 4001234 has SIH 0 + PO 30,000,
   * so it is yellow. The label 5L01743 has SIH 0 and NO purchase order at all, so it is red — and
   * red is what the batch row must show, because the batch cannot run without the label.
   */
  const bottle: ItemsInvolvedAllocationRow = {
    code: '4001234',
    name: '15 ML AMBER GLASS BOTTLE WITH WHITE DROPPER SET WITH PLUG',
    itemType: 'PM',
    pack_material_id: 4001234,
    sihNum: 0,
    poQtyNum: 30000,
  };
  const label: ItemsInvolvedAllocationRow = {
    code: '5L01743',
    name: 'SK GLOW GETTER ARBUTIN BRIGHTENING SERUM 15ML LABEL ( new )',
    itemType: 'PM',
    pack_material_id: 5101743,
    sihNum: 0,
    poQtyNum: 0, // no PO exists for this one
  };
  // BOTH batches, as in the real SO — each needs 30,000, so the bottle's total requirement is
  // 60,000 against SIH 0 + PO 30,000 and it is NOT fully covered. Using a single batch here would
  // make the bottle green (0 + 30,000 covers 30,000) and quietly stop reproducing the report.
  const mkBatch = (id: number, batchCode: string): PlanningBatchAllRow => ({
    id,
    planningExtractedId: 3669,
    sequence: id,
    batchCode,
    sizeKg: 450,
    rmLines: [],
    pmLines: [
      { pack_material_id: 4001234, qty_per_unit: 1 },
      { pack_material_id: 5101743, qty_per_unit: 1 },
    ],
    sent: true,
    orderQty: '1000',
    totalKg: '15',
    productName: 'SK GLOW GETTER ARBUTIN BRIGHTENING SERUM 15ML',
    soNumber: 'SO-00204',
  });
  const twoBatches = [mkBatch(1, 'PE-3669-B1'), mkBatch(2, 'PE-3507-B1')];
  const batch = twoBatches[0];
  const key = releaseBatchPickKey(batch);

  it('grades the bottle yellow on its own — what the item modal shows', () => {
    const covered = isItemFullyCovered(60000, bottle.sihNum, bottle.poQtyNum);
    expect(tier(30000, bottle.sihNum, bottle.poQtyNum, covered)).toBe('yellow');
  });

  it('grades the label red on its own — no stock and no PO', () => {
    const covered = isItemFullyCovered(60000, label.sihNum, label.poQtyNum);
    expect(tier(30000, label.sihNum, label.poQtyNum, covered)).toBe('red');
  });

  it('the batch row takes the worst of the two, so it is red', () => {
    expect(batchCoverageTierMap([bottle, label], twoBatches).get(key)).toBe('red');
  });

  it('names the material responsible, so the red is explainable from the Batches tab', () => {
    const detail = batchCoverageDetailMap([bottle, label], twoBatches).get(key);
    expect(detail?.tier).toBe('red');
    expect(detail?.driverCode).toBe('5L01743');
    expect(detail?.itemCount).toBe(2);
  });

  it('the batch goes yellow once the label is covered — the bottle was never the constraint', () => {
    const orderedLabel = { ...label, poQtyNum: 30000 };
    const detail = batchCoverageDetailMap([bottle, orderedLabel], twoBatches).get(key);
    expect(detail?.tier).toBe('yellow');
  });

  it('detail and tier maps never disagree', () => {
    const tiers = batchCoverageTierMap([bottle, label], twoBatches);
    const detail = batchCoverageDetailMap([bottle, label], twoBatches);
    for (const [k, d] of detail) expect(tiers.get(k)).toBe(d.tier);
  });
});
