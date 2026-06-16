/** Formula BOM % w/w must not exceed 100% in Planning batch BOM editor. */
export const PLANNING_FORMULA_PCT_MAX = 100;
export const PLANNING_FORMULA_PCT_TOLERANCE = 0.001;

export function sumPlanningFormulaPercentages(
  lines: ReadonlyArray<{ percentage?: number | null }>
): number {
  return lines.reduce((sum, line) => {
    const n = Number(line.percentage);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** Clamp a line's % w/w so the formula total does not exceed 100%. */
export function clampPlanningFormulaLinePercent(
  lines: ReadonlyArray<{ percentage?: number | null }>,
  lineIndex: number,
  rawPct: string
): number {
  const parsed = rawPct === '' ? 0 : parseFloat(rawPct);
  const safePct = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  const otherTotal = lines.reduce((sum, line, idx) => {
    if (idx === lineIndex) return sum;
    const n = Number(line.percentage);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const maxAllowed = Math.max(0, PLANNING_FORMULA_PCT_MAX - otherTotal);
  return Math.round(Math.min(safePct, maxAllowed) * 1000) / 1000;
}

export function planningFormulaPercentExceedsMax(total: number): boolean {
  return total > PLANNING_FORMULA_PCT_MAX + PLANNING_FORMULA_PCT_TOLERANCE;
}
