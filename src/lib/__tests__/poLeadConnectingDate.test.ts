import { describe, expect, it } from 'vitest';
import {
  leadConnectingDateForLine,
  leadConnectingSummaryForPo,
  normalizeLeadDays,
} from '../poLeadConnectingDate';

describe('normalizeLeadDays', () => {
  it('keeps zero distinct from unknown', () => {
    // The whole column depends on this: 0 means "connects the day the PO is raised", while a
    // missing value means nobody has quoted a lead time and no date can be shown at all.
    expect(normalizeLeadDays(0)).toBe(0);
    expect(normalizeLeadDays(undefined)).toBeNull();
    expect(normalizeLeadDays(null)).toBeNull();
    expect(normalizeLeadDays('')).toBeNull();
    expect(normalizeLeadDays('abc')).toBeNull();
  });

  it('accepts numeric strings', () => {
    expect(normalizeLeadDays('14')).toBe(14);
  });

  it('clamps a negative lead to same-day rather than dating a line before its own PO', () => {
    expect(normalizeLeadDays(-5)).toBe(0);
  });
});

describe('leadConnectingDateForLine', () => {
  it('adds the lead days to the PO date', () => {
    expect(leadConnectingDateForLine('2026-08-01', 14)).toBe('2026-08-15');
    expect(leadConnectingDateForLine('2026-08-01', 0)).toBe('2026-08-01');
  });

  it('rolls over month and year boundaries', () => {
    expect(leadConnectingDateForLine('2026-08-25', 10)).toBe('2026-09-04');
    expect(leadConnectingDateForLine('2026-12-20', 30)).toBe('2027-01-19');
  });

  it('handles a leap day', () => {
    expect(leadConnectingDateForLine('2028-02-27', 3)).toBe('2028-03-01');
  });

  it('accepts a full ISO timestamp for the PO date', () => {
    expect(leadConnectingDateForLine('2026-08-01T10:30:00.000Z', 7)).toBe('2026-08-08');
  });

  it('does not shift the day for a date-only string', () => {
    // Parsed as calendar parts, not through the local timezone — otherwise a viewer west of UTC
    // sees every connecting date land a day early.
    expect(leadConnectingDateForLine('2026-01-01', 0)).toBe('2026-01-01');
    expect(leadConnectingDateForLine('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('returns null when either side is unknown', () => {
    expect(leadConnectingDateForLine('2026-08-01', undefined)).toBeNull();
    expect(leadConnectingDateForLine('', 14)).toBeNull();
    expect(leadConnectingDateForLine(null, 14)).toBeNull();
    expect(leadConnectingDateForLine('not a date', 14)).toBeNull();
  });
});

describe('leadConnectingSummaryForPo', () => {
  const lines = [
    { itemCode: 'RM-1', leadTimeDays: 7 },
    { itemCode: 'RM-2', leadTimeDays: 30 },
    { itemCode: 'RM-3', leadTimeDays: 14 },
  ];

  it('spans earliest to latest across the PO lines', () => {
    const s = leadConnectingSummaryForPo('2026-08-01', lines);
    expect(s?.earliest).toBe('2026-08-08');
    expect(s?.latest).toBe('2026-08-31');
  });

  it('collapses to a single date when every line shares a lead time', () => {
    const s = leadConnectingSummaryForPo('2026-08-01', [
      { itemCode: 'A', leadTimeDays: 10 },
      { itemCode: 'B', leadTimeDays: 10 },
    ]);
    expect(s?.earliest).toBe(s?.latest);
    expect(s?.latest).toBe('2026-08-11');
  });

  it('lists each dated line for the tooltip, soonest first', () => {
    const s = leadConnectingSummaryForPo('2026-08-01', lines);
    expect(s?.items).toEqual(['RM-1: 2026-08-08', 'RM-3: 2026-08-15', 'RM-2: 2026-08-31']);
  });

  it('counts undated lines instead of hiding them', () => {
    // A PO showing a confident date that covers 1 of its 3 items has to say so.
    const s = leadConnectingSummaryForPo('2026-08-01', [
      { itemCode: 'A', leadTimeDays: 7 },
      { itemCode: 'B' },
      { itemCode: 'C', leadTimeDays: undefined },
    ]);
    expect(s?.unknownCount).toBe(2);
    expect(s?.items).toHaveLength(1);
  });

  it('is null when no line can be dated', () => {
    expect(leadConnectingSummaryForPo('2026-08-01', [{ itemCode: 'A' }])).toBeNull();
    expect(leadConnectingSummaryForPo('2026-08-01', [])).toBeNull();
    expect(leadConnectingSummaryForPo('2026-08-01', null)).toBeNull();
    expect(leadConnectingSummaryForPo('', lines)).toBeNull();
  });

  it('falls back to the item name when there is no code', () => {
    const s = leadConnectingSummaryForPo('2026-08-01', [{ item: 'Sodium Hydroxide', leadTimeDays: 5 }]);
    expect(s?.items).toEqual(['Sodium Hydroxide: 2026-08-06']);
  });
});
