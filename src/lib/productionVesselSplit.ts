/**
 * Split an oversized production batch to fit vessel capacity (kg / liters).
 */

export interface VesselSplitProposal {
  /** Total batch mass (kg). */
  totalKg: number;
  /** Mass for the first vessel run (kg). */
  firstRunKg: number;
  /** Remainder for a follow-up split batch (kg). */
  remainderKg: number;
  /** True when remainder is large enough to warrant a second batch. */
  needsSplit: boolean;
}

/** Minimum remainder (kg) to create a split batch — avoids trivial 1 kg tails. */
export const MIN_VESSEL_SPLIT_REMAINDER_KG = 1;

/**
 * Propose first-run vs remainder sizes from total batch kg and vessel capacity (liters).
 * Uses volume ratio when batch volume differs from kg (requiredVolumeLiters).
 */
export function proposeVesselSplitSizes(
  totalKg: number,
  batchVolumeLiters: number | null | undefined,
  vesselCapacityLiters: number,
): VesselSplitProposal | null {
  const total = Number(totalKg);
  const vesselCap = Number(vesselCapacityLiters);
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(vesselCap) || vesselCap <= 0) return null;

  const volL = Number(batchVolumeLiters);
  const effectiveVol = Number.isFinite(volL) && volL > 0 ? volL : total;
  if (effectiveVol <= vesselCap) {
    return { totalKg: total, firstRunKg: total, remainderKg: 0, needsSplit: false };
  }

  const ratio = vesselCap / effectiveVol;
  const firstRunRaw = total * ratio;
  const firstRunKg = Math.max(1, Math.min(total - MIN_VESSEL_SPLIT_REMAINDER_KG, Math.round(firstRunRaw)));
  const remainderKg = Math.max(0, Math.round((total - firstRunKg) * 1000) / 1000);
  const needsSplit = remainderKg >= MIN_VESSEL_SPLIT_REMAINDER_KG;
  return { totalKg: total, firstRunKg, remainderKg, needsSplit };
}

/** BMR statuses that allow vessel split (before RM connect / dispensing). */
export const VESSEL_SPLITTABLE_BMR_STATUSES = new Set([
  'draft',
  'batch_confirmed',
  'rm_reserved',
  'scheduled',
]);

export function batchEligibleForVesselSplit(bmrStatus: string, bprStatus: string): boolean {
  if (String(bprStatus || '').toLowerCase() !== 'draft') return false;
  return VESSEL_SPLITTABLE_BMR_STATUSES.has(String(bmrStatus || '').toLowerCase());
}
