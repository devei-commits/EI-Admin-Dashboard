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

import { roundMaterialQty } from '../utils/formatQty';
import { parseQtyLabelInt } from './parseQtyLabel';
import type { PlanningBatchAllRow } from '../services/planningExtracted.service';

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
 * Severity order used to roll a set of batch tiers up to the item row: red > yellow > pink > green.
 * `none` is absent on purpose — an untinted batch carries no verdict and must not outrank one.
 */
const TIER_SEVERITY: Record<Exclude<BatchCoverageTier, 'none'>, number> = {
  red: 4,
  yellow: 3,
  pink: 2,
  green: 1,
};

/**
 * The Items Involved row's own tier — the worst tier among its batches.
 *
 * One red batch reds the item; failing that one yellow makes it yellow, then pink, and only an
 * all-green set stays green. The item row therefore always shows the most urgent thing inside it,
 * so a problem batch cannot hide behind a mostly-covered item.
 *
 * Untinted batches (`none` — no requirement to judge) are skipped rather than treated as satisfied.
 * An item with no batches at all, or none carrying a requirement, returns `none` and stays untinted.
 */
export function itemCoverageTierFromBatches(tiers: BatchCoverageTier[]): BatchCoverageTier {
  let worst: BatchCoverageTier = 'none';
  let worstRank = 0;
  for (const tier of tiers) {
    if (tier === 'none') continue;
    const rank = TIER_SEVERITY[tier];
    if (rank > worstRank) {
      worstRank = rank;
      worst = tier;
    }
  }
  return worst;
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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Batch-centric coverage — powers the same red/pink/yellow/green tint on the Batches tab
// (`/planning/batches`) that "Batches using <item>" already shows per item, so a batch reads the
// same colour wherever it appears.
//
// This is a deliberate, self-contained duplicate of the per-item allocation math that lives as
// closures inside Planning.tsx's `Planning` component (`allocateConsolidatedReqAcrossBatches`,
// `releaseBatchPickKey`, `getUsedInBatchesForItem`) — those close over component state and are not
// reachable from the separately-defined `PlanningBatchesTab`. Keep the two in sync if the
// allocation rule ever changes: RM per batch = batchKg × %w/w; PM per batch = batchUnits ×
// qty_per_unit, batchUnits = batchKg ÷ (PI.totalKg / PI.orderQty). Mirrors the backend
// `accumulatePlannedBatchIntoQtyMaps`.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Minimal shape needed from an Items Involved row — duck-typed so this lib doesn't need to import
 *  Planning.tsx's page-local `ItemsInvolvedDisplayRow` type. */
export interface ItemsInvolvedAllocationRow {
  code: string;
  name: string;
  itemType: 'RM' | 'PM';
  raw_material_id?: number;
  pack_material_id?: number;
  sihNum: number;
  poQtyNum: number;
  planningExtractedIds?: number[];
  usedInProducts?: string[];
}

type BatchBomLine = {
  raw_material_id?: number; pack_material_id?: number;
  rm_code?: string; pm_code?: string; code?: string;
  inci_name?: string; name?: string; description?: string;
  pct_w_w?: number; pct?: number; qty_per_unit?: number; qty?: number;
};

/**
 * Effective PM BOM lines for a batch: the batch's OWN pm_lines when it has any (per-batch BOM
 * confirmed), else the PI-level packaging_materials snapshot converted to the same per-unit shape.
 *
 * Mirrors the backend's countPlanningBatchesTouchingPm fallback (items-involved batchCount) — a
 * batch not yet BOM-confirmed at the per-batch level (the common case; most batches never get an
 * individual Swap) is still counted server-side against its PI's whole-BOM packaging list. Without
 * this fallback here, that same batch silently drops out of every client-side "uses this item"
 * computation — the "Batches using <item>" modal, the Batches-tab coverage tint — even though the
 * server-side badge on the Items Involved row still counts it. That's what made the modal's count
 * read lower than the badge above it for a widely-used PM like a shipping sticker: nearly every
 * batch touching it still had empty pm_lines.
 */
export function effectivePmLinesForBatch(batch: PlanningBatchAllRow): BatchBomLine[] {
  if (Array.isArray(batch.pmLines) && batch.pmLines.length > 0) return batch.pmLines as BatchBomLine[];
  const pkg = batch.piPackagingMaterials ?? [];
  if (pkg.length === 0) return [];
  const orderQty = parseQtyLabelInt(batch.orderQty);
  return pkg.map((p) => {
    const totalPcs = Number(p.quantity) || 0;
    const qty_per_unit = orderQty > 0 ? totalPcs / orderQty : totalPcs;
    return {
      pack_material_id: p.pack_material_id,
      pm_code: p.code,
      code: p.code,
      description: p.name,
      name: p.name,
      qty_per_unit,
      qty: qty_per_unit,
    };
  });
}

/** Stable key for one batch, unique across all planning-extracted rows. */
export const releaseBatchPickKey = (batch: PlanningBatchAllRow): string =>
  `${batch.planningExtractedId}-${batch.id ?? batch.sequence ?? batch.batchCode ?? 'batch'}`;

/** The batches (from `allBatches`) whose own BOM copy actually contains this item. */
function batchesForItem(
  item: ItemsInvolvedAllocationRow,
  allBatches: PlanningBatchAllRow[],
): PlanningBatchAllRow[] {
  const itemCode = String(item.code ?? '').trim().toLowerCase();
  const itemName = String(item.name ?? '').trim().toLowerCase();
  const itemId = item.itemType === 'RM' ? Number(item.raw_material_id) : Number(item.pack_material_id);
  const peIds = new Set(
    (item.planningExtractedIds ?? [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0),
  );
  const allowedProductNames = (item.usedInProducts ?? [])
    .map((p) => String(p ?? '').trim().toLowerCase())
    .filter(Boolean);

  return allBatches
    .filter((b) => (peIds.size === 0 ? true : peIds.has(Number(b.planningExtractedId))))
    .filter((b) =>
      allowedProductNames.length === 0
        ? true
        : allowedProductNames.includes(String(b.productName ?? '').trim().toLowerCase()),
    )
    .filter((b) => {
      const lines = item.itemType === 'RM' ? (b.rmLines ?? []) : effectivePmLinesForBatch(b);
      return (lines as BatchBomLine[]).some((line) => {
        const lineId = item.itemType === 'RM' ? Number(line.raw_material_id) : Number(line.pack_material_id);
        const lineCode = String(line.rm_code ?? line.pm_code ?? line.code ?? '').trim().toLowerCase();
        const lineLabel = String(line.inci_name ?? line.name ?? line.description ?? '').trim().toLowerCase();
        const byId = Number.isFinite(itemId) && itemId > 0 && Number.isFinite(lineId) && lineId === itemId;
        const byCode = itemCode.length > 0 && lineCode === itemCode;
        const byName = itemName.length > 0 && lineLabel === itemName;
        return byId || byCode || byName;
      });
    });
}

/**
 * Per-batch requirement for an item, computed from each batch's OWN BOM — not by distributing the
 * item's consolidated total across batches by kg (packaging is per finished unit, not per kg, and
 * units-per-kg varies by fill size).
 */
export function allocateConsolidatedReqAcrossBatches(
  item: ItemsInvolvedAllocationRow,
  batches: PlanningBatchAllRow[],
): Map<string, number> {
  const out = new Map<string, number>();
  const itemCode = String(item.code ?? '').trim().toLowerCase();
  const itemName = String(item.name ?? '').trim().toLowerCase();
  const itemId = item.itemType === 'RM' ? Number(item.raw_material_id) : Number(item.pack_material_id);

  const lineMatchesItem = (line: BatchBomLine): boolean => {
    const lineId = item.itemType === 'RM' ? Number(line.raw_material_id) : Number(line.pack_material_id);
    const lineCode = String(line.rm_code ?? line.pm_code ?? line.code ?? '').trim().toLowerCase();
    const lineLabel = String(line.inci_name ?? line.name ?? line.description ?? '').trim().toLowerCase();
    const byId = Number.isFinite(itemId) && itemId > 0 && Number.isFinite(lineId) && lineId === itemId;
    const byCode = itemCode.length > 0 && lineCode === itemCode;
    const byName = itemName.length > 0 && lineLabel === itemName;
    return byId || byCode || byName;
  };

  for (const batch of batches) {
    const key = releaseBatchPickKey(batch);
    const sizeKg = Number(batch.sizeKg) || 0;
    const lines = (item.itemType === 'RM' ? (batch.rmLines ?? []) : effectivePmLinesForBatch(batch)) as BatchBomLine[];
    const line = lines.find(lineMatchesItem);
    if (!line || !(sizeKg > 0)) { out.set(key, 0); continue; }

    if (item.itemType === 'RM') {
      const pct = Number(line.pct_w_w ?? line.pct ?? 0) || 0;
      out.set(key, roundMaterialQty((sizeKg * pct) / 100));
    } else {
      const orderQty = parseQtyLabelInt(batch.orderQty);
      const totalKg = parseFloat(String(batch.totalKg ?? '').replace(/[^\d.]/g, '')) || 0;
      const kgPerUnit = orderQty > 0 && totalKg > 0 ? totalKg / orderQty : 0;
      const unitsForBatch = kgPerUnit > 0 ? sizeKg / kgPerUnit : 0;
      const qtyPerUnit = Number(line.qty_per_unit ?? line.qty ?? 1) || 1;
      out.set(key, Math.round(unitsForBatch * qtyPerUnit));
    }
  }
  return out;
}

/**
 * Coverage tier for every released (sent) batch, keyed by `releaseBatchPickKey` — the batch-centric
 * mirror of `itemCoverageTierFromBatches` (item-centric: worst tier across its batches). Here it's
 * the worst tier, across every item that batch consumes, for that one batch — so a batch involving
 * both a covered RM and a short PM reads red, same as it would if you opened each item's modal.
 */
export function batchCoverageTierMap(
  itemsInvolved: ItemsInvolvedAllocationRow[],
  allBatches: PlanningBatchAllRow[],
): Map<string, BatchCoverageTier> {
  const detail = batchCoverageDetailMap(itemsInvolved, allBatches);
  const out = new Map<string, BatchCoverageTier>();
  for (const [key, d] of detail) out.set(key, d.tier);
  return out;
}

export type BatchCoverageDetail = {
  /** Worst tier across every material this batch consumes. */
  tier: BatchCoverageTier;
  /** The material that forces that tier — the answer to "why is this batch red?". */
  driverCode: string;
  /** How many of the batch's materials carry a tier at all. */
  itemCount: number;
};

/**
 * Same rollup as `batchCoverageTierMap`, but it also names the material responsible.
 *
 * Worth the extra bookkeeping because the batch badge is otherwise unexplainable from the screen it
 * is on. A batch reads SHORT while the item modal you just came from reads NEEDS PO, and nothing
 * says the two are answering different questions — the modal grades ONE material on this batch,
 * this grades ALL of them. Naming the driver turns an apparent contradiction into an obvious fact:
 * PE-3669-B1 is red because its label 5L01743 has neither stock nor a PO, not because of the bottle
 * you were looking at.
 */
export function batchCoverageDetailMap(
  itemsInvolved: ItemsInvolvedAllocationRow[],
  allBatches: PlanningBatchAllRow[],
): Map<string, BatchCoverageDetail> {
  const perBatch = new Map<string, { tier: BatchCoverageTier; code: string }[]>();
  for (const item of itemsInvolved) {
    const itemBatches = batchesForItem(item, allBatches);
    const sentBatches = itemBatches.filter((b) => b.sent === true);
    if (sentBatches.length === 0) continue;

    const alloc = allocateConsolidatedReqAcrossBatches(item, itemBatches);
    const batchQtys = sentBatches.map((b) => Number(alloc.get(releaseBatchPickKey(b))) || 0);
    const sih = Number(item.sihNum) || 0;
    const poQty = Number(item.poQtyNum) || 0;
    const totalRequired = batchQtys.reduce((sum, qty) => sum + qty, 0);
    const itemFullyCovered = isItemFullyCovered(totalRequired, sih, poQty);

    sentBatches.forEach((batch, i) => {
      const tier = batchCoverageTier({ batchQty: batchQtys[i], sih, poQty, itemFullyCovered });
      if (tier === 'none') return;
      const key = releaseBatchPickKey(batch);
      const arr = perBatch.get(key) ?? [];
      arr.push({ tier, code: String(item.code ?? '').trim() });
      perBatch.set(key, arr);
    });
  }

  const result = new Map<string, BatchCoverageDetail>();
  for (const [key, entries] of perBatch) {
    const tier = itemCoverageTierFromBatches(entries.map((e) => e.tier));
    const driver = entries.find((e) => e.tier === tier);
    result.set(key, {
      tier,
      driverCode: driver?.code ?? '',
      itemCount: entries.length,
    });
  }
  return result;
}
