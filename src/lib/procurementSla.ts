/**
 * Shared SLA evaluation for Procurement module (spec §8).
 * Thresholds are configurable via SLA_THRESHOLDS; defaults match the spec.
 */
import type { GrnStage, SlaLevel } from '../constants/procurement';
import { SLA_DEFAULTS } from '../constants/procurement';

export const SLA_THRESHOLDS = {
  procurementDays: SLA_DEFAULTS.procurementDays,
  quoteDays: SLA_DEFAULTS.quoteDays,
  quoteWarnDays: 4,
  auditDays: SLA_DEFAULTS.auditDays,
  auditWarnDays: 2,
  auditBadDays: 3,
  grnInTransitLeadDays: 0, // uses per-row lead time
  grnLandedToVerifiedHours: { target: 4, warn: 3, bad: 6 },
  grnVerifiedToQuarantinedHours: { target: 6, warn: 5, bad: 8 },
  grnQuarantinedToQcHours: { target: 24, warn: 20, bad: 36 },
  grnQcToCompletedHours: { target: 48, warn: 40, bad: 72 },
  receivedToBilledDays: { target: 3, warn: 2, bad: 5 },
  billedToPaidDaysBeforeTerm: 5,
} as const;

export function slaLevelFromDaysOpen(daysOpen: number, committed: number): SlaLevel {
  if (daysOpen > committed) return 'bad';
  if (daysOpen >= committed) return 'warn';
  return 'ok';
}

/** Quote SLA: amber at 4d, red past 5d (default). */
export function quoteSlaLevel(daysSinceSent: number, committed = SLA_THRESHOLDS.quoteDays): SlaLevel {
  if (daysSinceSent > committed) return 'bad';
  if (daysSinceSent >= SLA_THRESHOLDS.quoteWarnDays) return 'warn';
  return 'ok';
}

/** Audit SLA: amber at 2d, red past 3d. */
export function auditSlaLevel(daysOpen: number): SlaLevel {
  if (daysOpen > SLA_THRESHOLDS.auditBadDays) return 'bad';
  if (daysOpen >= SLA_THRESHOLDS.auditWarnDays) return 'warn';
  return 'ok';
}

export function hoursSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (Date.now() - t) / 3_600_000);
}

export function daysSinceDate(iso: string | null | undefined): number {
  if (!iso) return 0;
  const dt = new Date(iso);
  dt.setHours(0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return 0;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((t.getTime() - dt.getTime()) / 86_400_000));
}

/** GRN in-transit: red if today > shipped_date + lead_time. */
export function grnInTransitSlaLevel(shippedDate: string | null | undefined, leadDays: number): SlaLevel {
  if (!shippedDate || leadDays <= 0) return 'ok';
  const days = daysSinceDate(shippedDate);
  if (days > leadDays) return 'bad';
  if (days >= leadDays) return 'warn';
  return 'ok';
}

/** Per-stage SLA for post-transit GRN stages. */
export function grnStageSlaLevel(stage: GrnStage, stageEnteredAt: string | null | undefined): SlaLevel {
  if (!stageEnteredAt || stage === 'grn_completed' || stage === 'in_transit') return 'ok';
  const hrs = hoursSince(stageEnteredAt);
  const cfg =
    stage === 'landed'
      ? SLA_THRESHOLDS.grnLandedToVerifiedHours
      : stage === 'verified'
        ? SLA_THRESHOLDS.grnVerifiedToQuarantinedHours
        : stage === 'quarantined'
          ? SLA_THRESHOLDS.grnQuarantinedToQcHours
          : stage === 'qc_tested'
            ? SLA_THRESHOLDS.grnQcToCompletedHours
            : null;
  if (!cfg) return 'ok';
  if (hrs > cfg.bad) return 'bad';
  if (hrs >= cfg.warn) return 'warn';
  return 'ok';
}

/** Purchase Status RECEIVED → BILLED SLA. */
export function receivedToBilledSlaLevel(daysSinceReceived: number): SlaLevel {
  const { target, warn, bad } = SLA_THRESHOLDS.receivedToBilledDays;
  if (daysSinceReceived > bad) return 'bad';
  if (daysSinceReceived >= warn) return 'warn';
  if (daysSinceReceived > target) return 'warn';
  return 'ok';
}

/** BILLED → PAID SLA based on payment terms (e.g. Net 30). */
export function billedToPaidSlaLevel(daysSinceBilled: number, paymentTermDays: number): SlaLevel {
  if (paymentTermDays <= 0) return 'ok';
  if (daysSinceBilled > paymentTermDays) return 'bad';
  if (daysSinceBilled >= paymentTermDays - SLA_THRESHOLDS.billedToPaidDaysBeforeTerm) return 'warn';
  return 'ok';
}

/** Expected connecting date vs need-by: red if expected after need-by. */
export function expectedVsNeedByLevel(
  expected: string | null | undefined,
  needBy: string | null | undefined,
): SlaLevel {
  if (!expected || !needBy) return 'ok';
  const e = new Date(expected);
  e.setHours(0, 0, 0, 0);
  const n = new Date(needBy);
  n.setHours(0, 0, 0, 0);
  if (Number.isNaN(e.getTime()) || Number.isNaN(n.getTime())) return 'ok';
  const diffDays = Math.round((e.getTime() - n.getTime()) / 86_400_000);
  if (diffDays > 0) return 'bad';
  if (diffDays >= -2) return 'warn';
  return 'ok';
}
