import { describe, expect, it } from 'vitest';
import {
  batchEligibleForVesselSplit,
  proposeVesselSplitSizes,
} from '../productionVesselSplit';

describe('productionVesselSplit', () => {
  it('proposes split when batch volume exceeds vessel capacity', () => {
    const proposal = proposeVesselSplitSizes(800, 800, 500);
    expect(proposal).not.toBeNull();
    expect(proposal!.needsSplit).toBe(true);
    expect(proposal!.firstRunKg).toBe(500);
    expect(proposal!.remainderKg).toBe(300);
  });

  it('uses requiredVolumeLiters when set', () => {
    const proposal = proposeVesselSplitSizes(800, 960, 500);
    expect(proposal!.firstRunKg).toBe(417);
    expect(proposal!.remainderKg).toBe(383);
  });

  it('returns no split when batch fits vessel', () => {
    const proposal = proposeVesselSplitSizes(400, 400, 500);
    expect(proposal!.needsSplit).toBe(false);
    expect(proposal!.firstRunKg).toBe(400);
    expect(proposal!.remainderKg).toBe(0);
  });

  it('gates split eligibility by BMR/BPR status', () => {
    expect(batchEligibleForVesselSplit('scheduled', 'draft')).toBe(true);
    expect(batchEligibleForVesselSplit('dispensing', 'draft')).toBe(false);
    expect(batchEligibleForVesselSplit('scheduled', 'pm_reserved')).toBe(false);
  });
});
