import { describe, expect, it } from 'vitest';
import { normalizeLeadTimeDays, resolveDraftLineLeadTimeDays } from '../procurementDataMappers';

describe('normalizeLeadTimeDays', () => {
  it('parses valid non-negative integers', () => {
    expect(normalizeLeadTimeDays(7)).toBe(7);
    expect(normalizeLeadTimeDays('14')).toBe(14);
    expect(normalizeLeadTimeDays(0)).toBe(0);
  });

  it('returns undefined for invalid or missing', () => {
    expect(normalizeLeadTimeDays(undefined)).toBeUndefined();
    expect(normalizeLeadTimeDays(null)).toBeUndefined();
    expect(normalizeLeadTimeDays('')).toBeUndefined();
    expect(normalizeLeadTimeDays(-1)).toBeUndefined();
    expect(normalizeLeadTimeDays(NaN)).toBeUndefined();
  });
});

describe('resolveDraftLineLeadTimeDays', () => {
  it('prefers PR line, then quote line, then Items List, then header', () => {
    expect(
      resolveDraftLineLeadTimeDays({
        prLine: { lead_time_days: 5 },
        quoteLineLead: 10,
        itemsListLead: 15,
        quoteHeaderLead: 20,
      })
    ).toBe(5);

    expect(
      resolveDraftLineLeadTimeDays({
        prLine: {},
        quoteLineLead: 10,
        itemsListLead: 15,
        quoteHeaderLead: 20,
      })
    ).toBe(10);

    expect(
      resolveDraftLineLeadTimeDays({
        prLine: {},
        quoteLineLead: null,
        itemsListLead: 15,
        quoteHeaderLead: 20,
      })
    ).toBe(15);

    expect(
      resolveDraftLineLeadTimeDays({
        prLine: {},
        quoteLineLead: null,
        itemsListLead: undefined,
        quoteHeaderLead: 20,
      })
    ).toBe(20);

    expect(resolveDraftLineLeadTimeDays({ prLine: {}, quoteLineLead: null, itemsListLead: undefined, quoteHeaderLead: null })).toBe(0);
  });
});
