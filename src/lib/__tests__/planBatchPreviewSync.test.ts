/**
 * Plan Batches syncs the "Preview qty" box into a batch row. With the box empty it computed 0 units
 * and wrote that through, wiping a planned batch's size in the working state — PE-3685 showed
 * "700 units to be made / 300 pending" and B-01 as 0, while the DB correctly held 5+10+25 kg
 * (800 units, 200 pending).
 */
import { describe, it, expect } from 'vitest';

/** The guarded decision from the preview-sync effect. */
function previewSyncUnits(previewQty: number | null | undefined): number | null {
  const nextUnits = Math.max(0, Math.floor(Number(previewQty) || 0));
  if (nextUnits <= 0) return null; // "not specified" — leave the batch alone
  return nextUnits;
}

/** Units implied by a set of batch sizes, given the order's kg-per-unit. */
const unitsFor = (sizesKg: number[], kgPerUnit: number) =>
  Math.round(sizesKg.reduce((s, k) => s + k, 0) / kgPerUnit);

describe('preview-qty sync', () => {
  it('does not write when the preview box is empty — the reported bug', () => {
    expect(previewSyncUnits(null)).toBeNull();
    expect(previewSyncUnits(undefined)).toBeNull();
    expect(previewSyncUnits(0)).toBeNull();
    expect(previewSyncUnits(NaN)).toBeNull();
  });

  it('does not write a negative preview qty', () => {
    expect(previewSyncUnits(-50)).toBeNull();
  });

  it('still writes a real preview qty', () => {
    expect(previewSyncUnits(500)).toBe(500);
    expect(previewSyncUnits(100.9)).toBe(100);
  });

  it('keeps PE-3685 totals correct once B-01 is no longer zeroed', () => {
    const kgPerUnit = 50 / 1000; // 50 KG order of 1,000 units
    const correct = [5, 10, 25];
    const corrupted = [0, 10, 25]; // what the empty-preview write produced

    expect(unitsFor(correct, kgPerUnit)).toBe(800);
    expect(1000 - unitsFor(correct, kgPerUnit)).toBe(200);

    expect(unitsFor(corrupted, kgPerUnit)).toBe(700);   // the wrong figure shown
    expect(1000 - unitsFor(corrupted, kgPerUnit)).toBe(300);
  });
});
