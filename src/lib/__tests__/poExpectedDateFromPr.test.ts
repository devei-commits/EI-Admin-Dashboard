/**
 * Release to Planning consolidates demand per ISO week and stores a required-by date on each
 * procurement request — but the draft PO ignored it and used `today + lead days`, so procurement
 * could not see week-wise PO release at all.
 */
import { describe, it, expect } from 'vitest';
import { poExpectedDateFromPr } from '../poExpectedDateFromPr';

const today = new Date('2026-08-25T00:00:00Z');

describe('poExpectedDateFromPr', () => {
  it("uses the request's required-by date — the week the planner released for", () => {
    expect(poExpectedDateFromPr({ requiredByDate: '2026-10-09', today, leadDays: 10 })).toBe('2026-10-09');
    expect(poExpectedDateFromPr({ requiredByDate: '2026-10-14', today, leadDays: 10 })).toBe('2026-10-14');
  });

  it('falls back to today + lead days when the request carries no date', () => {
    expect(poExpectedDateFromPr({ requiredByDate: null, today, leadDays: 10 })).toBe('2026-09-04');
    expect(poExpectedDateFromPr({ today, leadDays: 0 })).toBe('2026-08-25');
  });

  it('treats a blank or unparseable date as absent rather than producing Invalid Date', () => {
    expect(poExpectedDateFromPr({ requiredByDate: '   ', today, leadDays: 1 })).toBe('2026-08-26');
    expect(poExpectedDateFromPr({ requiredByDate: 'not a date', today, leadDays: 1 })).toBe('2026-08-26');
  });

  it('keeps a date-only string exactly, without timezone shifting the day', () => {
    expect(poExpectedDateFromPr({ requiredByDate: '2026-01-01', today })).toBe('2026-01-01');
  });

  it('normalises a full timestamp down to the date', () => {
    expect(poExpectedDateFromPr({ requiredByDate: '2026-10-09T18:30:00.000Z', today })).toBe('2026-10-09');
  });

  it('never goes backwards from a negative lead time', () => {
    expect(poExpectedDateFromPr({ today, leadDays: -5 })).toBe('2026-08-25');
  });
});
