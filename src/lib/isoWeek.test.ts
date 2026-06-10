import { describe, expect, it } from 'vitest';
import { formatIsoWeekLabel, getIsoWeekAndYear, isoWeekFromDateString } from './isoWeek';

describe('isoWeek', () => {
  it('returns ISO week 40 for 2025-10-01', () => {
    expect(isoWeekFromDateString('2025-10-01')).toEqual({ week: 40, year: 2025 });
    expect(formatIsoWeekLabel(isoWeekFromDateString('2025-10-01'))).toBe('Week 40, 2025');
  });

  it('returns ISO week 35 for 2025-08-27', () => {
    expect(isoWeekFromDateString('2025-08-27')).toEqual({ week: 35, year: 2025 });
  });

  it('handles year boundary (Jan dates in prior ISO week-year)', () => {
    const parts = isoWeekFromDateString('2026-01-01');
    expect(parts).not.toBeNull();
    if (parts) {
      expect(parts.year).toBe(2026);
      expect(parts.week).toBeGreaterThan(0);
    }
  });

  it('getIsoWeekAndYear matches string parser', () => {
    const d = new Date(2025, 9, 1, 12, 0, 0, 0);
    expect(getIsoWeekAndYear(d)).toEqual(isoWeekFromDateString('2025-10-01'));
  });
});
