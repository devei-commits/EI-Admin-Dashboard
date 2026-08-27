/**
 * Production kept asking for a reserve that Planning had already made.
 *
 * Reserving in Planning → Batches → RM items panel writes the same `reserved_batch_items` rows
 * Production reads (once the batch is sent, Planning delegates straight to the production batch).
 * But `fullyReserved` is STOCK-BACKED only, so a batch whose material is still on order came back
 * as "not reserved" and Production told the user to reserve all RM again — a click that changes
 * nothing, since the claim is already recorded and the shortfall is waiting on a GRN.
 *
 * These pin the three-state gate that replaced the reserved/not-reserved boolean.
 */
import { describe, expect, it } from 'vitest';
import {
  coverageFullyClaimed,
  reserveGateLabel,
  reserveGateState,
  type BatchMaterialCoverage,
  type BatchMaterialCoverageLine,
} from '../productionBatchReserve';

const line = (over: Partial<BatchMaterialCoverageLine> = {}): BatchMaterialCoverageLine => ({
  code: 'RM-1',
  materialId: 1,
  required: 10,
  reserved: 10,
  claimed: 10,
  pending: 0,
  unit: 'KG',
  fullyReserved: true,
  fullyClaimed: true,
  ...over,
});

/** Claimed in full, none of it in the building yet — the case Planning creates on a short item. */
const awaiting = (over: Partial<BatchMaterialCoverageLine> = {}) =>
  line({ reserved: 0, claimed: 10, pending: 10, fullyReserved: false, fullyClaimed: true, ...over });

const cov = (lines: BatchMaterialCoverageLine[]): BatchMaterialCoverage => ({
  lines,
  fullyReserved: lines.every((l) => l.fullyReserved),
  fullyClaimed: lines.every((l) => l.fullyClaimed),
  anyReserved: lines.some((l) => l.reserved > 0),
  anyPending: lines.some((l) => (l.pending ?? 0) > 0),
});

describe('reserveGateState', () => {
  it('is reserved when every line is stock-backed', () => {
    expect(reserveGateState(cov([line(), line({ code: 'RM-2', materialId: 2 })]))).toBe('reserved');
  });

  it('is awaiting-stock when every line is claimed but the stock has not arrived', () => {
    // The PE-3348-B1 shape: reserved from Planning, most lines with zero free stock.
    expect(reserveGateState(cov([awaiting(), awaiting({ code: 'RM-2', materialId: 2 })]))).toBe(
      'awaiting-stock',
    );
  });

  it('is awaiting-stock on a mix of backed and claimed lines', () => {
    expect(reserveGateState(cov([line(), awaiting({ code: 'RM-2', materialId: 2 })]))).toBe(
      'awaiting-stock',
    );
  });

  it('is unreserved when a line carries no claim at all', () => {
    const none = line({ reserved: 0, claimed: 0, pending: 0, fullyReserved: false, fullyClaimed: false });
    expect(reserveGateState(cov([line(), none]))).toBe('unreserved');
    expect(reserveGateState(cov([none]))).toBe('unreserved');
  });

  it('is unreserved when there is no coverage yet, so the button is never hidden by a slow fetch', () => {
    // The footer hides "Reserve RM" on anything but 'unreserved' — defaulting the other way would
    // make the action disappear while coverage loads, or forever if the request failed.
    expect(reserveGateState(null)).toBe('unreserved');
    expect(reserveGateState(undefined)).toBe('unreserved');
    expect(reserveGateState(cov([]))).toBe('unreserved');
  });
});

describe('coverageFullyClaimed', () => {
  it('trusts the envelope flag when the backend sends one', () => {
    expect(coverageFullyClaimed(cov([awaiting()]))).toBe(true);
  });

  it('falls back to per-line claimed vs required on payloads without the flag', () => {
    const legacy: BatchMaterialCoverage = {
      lines: [
        { code: 'A', materialId: 1, required: 10, reserved: 0, claimed: 10, unit: 'KG', fullyReserved: false },
        { code: 'B', materialId: 2, required: 5, reserved: 5, claimed: 5, unit: 'KG', fullyReserved: true },
      ],
      fullyReserved: false,
      anyReserved: true,
    };
    expect(coverageFullyClaimed(legacy)).toBe(true);
  });

  it('is false when a line is claimed for less than it needs', () => {
    const partial: BatchMaterialCoverage = {
      lines: [
        { code: 'A', materialId: 1, required: 10, reserved: 0, claimed: 4, unit: 'KG', fullyReserved: false },
      ],
      fullyReserved: false,
      anyReserved: false,
    };
    expect(coverageFullyClaimed(partial)).toBe(false);
  });
});

describe('reserveGateLabel', () => {
  it('never asks for a reserve once the batch is fully claimed', () => {
    const label = reserveGateLabel(cov([awaiting(), awaiting({ code: 'RM-2', materialId: 2 })]), 'RM');
    expect(label).not.toMatch(/reserve all/i);
    expect(label).toContain('2 awaiting stock');
    expect(label).toContain('allocated automatically on receipt');
  });

  it('still asks when nothing has been claimed', () => {
    const none = line({ reserved: 0, claimed: 0, pending: 0, fullyReserved: false, fullyClaimed: false });
    expect(reserveGateLabel(cov([none]), 'RM')).toBe('Reserve all RM to proceed');
    expect(reserveGateLabel(cov([none]), 'PM')).toBe('Reserve all PM to proceed');
  });

  it('reports all-green when every line is stock-backed', () => {
    expect(reserveGateLabel(cov([line()]), 'RM')).toBe('1/1 lines reserved · all green to proceed');
  });
});
