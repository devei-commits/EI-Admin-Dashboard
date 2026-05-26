import { describe, expect, it } from 'vitest';
import {
  formatDateEnInSafe,
  normalizeDateOnlyString,
  parseDateStringToLocalDate,
  mapBackendPrToRequest,
  mergePlannedRateIntoLineNotes,
  resolvePlannedUnitPrice,
} from './procurementDataMappers';

describe('procurement date helpers', () => {
  it('parseDateStringToLocalDate handles YYYY-MM-DD and DD-MM-YYYY', () => {
    expect(parseDateStringToLocalDate('2026-05-30')?.getDate()).toBe(30);
    expect(parseDateStringToLocalDate('30-05-2026')?.getMonth()).toBe(4);
  });

  it('formatDateEnInSafe returns em dash for empty or invalid', () => {
    expect(formatDateEnInSafe('')).toBe('—');
    expect(formatDateEnInSafe(null)).toBe('—');
    expect(formatDateEnInSafe('not-a-date')).toBe('—');
  });

  it('mapBackendPrToRequest normalizes null requiredByDate', () => {
    const req = mapBackendPrToRequest({
      id: '1',
      planningExtractedId: 1,
      planningBatchId: null,
      priority: 'High',
      requiredByDate: null,
      notes: null,
      items: [],
      status: 'Pending',
      preferredVendor: null,
      requestedBy: null,
      createdAt: '2026-05-25T17:39:45.190Z',
      updatedAt: '2026-05-25T17:39:45.190Z',
    });
    expect(req.dueDate).toBe('');
    expect(formatDateEnInSafe(req.dueDate)).toBe('—');
  });

  it('normalizeDateOnlyString outputs YYYY-MM-DD', () => {
    expect(normalizeDateOnlyString('2026-03-15')).toBe('2026-03-15');
    expect(normalizeDateOnlyString('15-03-2026')).toBe('2026-03-15');
  });

  it('resolvePlannedUnitPrice and mergePlannedRateIntoLineNotes round-trip', () => {
    const notes = 'Planned rate ₹100.00 | Terms: Net 30 | Lead: 7d';
    expect(resolvePlannedUnitPrice({ line_notes: notes })).toBe(100);
    expect(mergePlannedRateIntoLineNotes(notes, 125.5)).toContain('Planned rate ₹125.50');
    expect(mergePlannedRateIntoLineNotes(notes, 125.5)).toContain('Terms: Net 30');
  });
});
