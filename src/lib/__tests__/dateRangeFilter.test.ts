import { describe, expect, it } from 'vitest';
import { matchesDateRangeFilter } from '../../utils/dateRangeFilter';

describe('matchesDateRangeFilter', () => {
  const rec = '2026-05-15T10:30:00.000Z';

  it('passes when no filter', () => {
    expect(matchesDateRangeFilter(rec, '', '')).toBe(true);
  });

  it('matches on or after from when from only', () => {
    expect(matchesDateRangeFilter(rec, '2026-05-15', '')).toBe(true);
    expect(matchesDateRangeFilter(rec, '2026-05-10', '')).toBe(true);
    expect(matchesDateRangeFilter(rec, '2026-05-16', '')).toBe(false);
  });

  it('matches inclusive range when both provided', () => {
    expect(matchesDateRangeFilter(rec, '2026-05-10', '2026-05-20')).toBe(true);
    expect(matchesDateRangeFilter(rec, '2026-05-20', '2026-05-10')).toBe(true);
    expect(matchesDateRangeFilter(rec, '2026-05-16', '2026-05-20')).toBe(false);
  });

  it('matches until to when to only', () => {
    expect(matchesDateRangeFilter(rec, '', '2026-05-15')).toBe(true);
    expect(matchesDateRangeFilter(rec, '', '2026-05-14')).toBe(false);
    expect(matchesDateRangeFilter(rec, '', '2026-05-20')).toBe(true);
  });

  it('excludes rows without date when filter active', () => {
    expect(matchesDateRangeFilter('', '2026-05-15', '')).toBe(false);
  });
});
