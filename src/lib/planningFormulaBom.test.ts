import { describe, expect, it } from 'vitest';
import {
  clampPlanningFormulaLinePercent,
  planningFormulaPercentExceedsMax,
  sumPlanningFormulaPercentages,
} from './planningFormulaBom';

describe('planningFormulaBom', () => {
  it('sums line percentages', () => {
    expect(sumPlanningFormulaPercentages([{ percentage: 40 }, { percentage: 60 }])).toBe(100);
  });

  it('clamps a line so total does not exceed 100%', () => {
    const lines = [{ percentage: 70 }, { percentage: 20 }];
    expect(clampPlanningFormulaLinePercent(lines, 1, '50')).toBe(30);
  });

  it('flags totals above 100%', () => {
    expect(planningFormulaPercentExceedsMax(100.002)).toBe(true);
    expect(planningFormulaPercentExceedsMax(100)).toBe(false);
  });
});
