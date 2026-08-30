import { describe, expect, it } from 'vitest';
import { nearestConnectingDate } from '../itemsInvolvedConnectingDate';

describe('nearestConnectingDate', () => {
  it('picks the earliest when an item sits on two POs', () => {
    // The stated rule: 20th and 30th → show the 20th.
    const n = nearestConnectingDate([
      { poNo: 'PO-030', date: '2026-09-30' },
      { poNo: 'PO-020', date: '2026-09-20' },
    ]);
    expect(n?.date).toBe('2026-09-20');
    expect(n?.poNo).toBe('PO-020');
    expect(n?.poCount).toBe(2);
  });

  it('does not depend on the order the POs arrive in', () => {
    const asc = nearestConnectingDate([
      { poNo: 'A', date: '2026-09-20' },
      { poNo: 'B', date: '2026-09-30' },
    ]);
    expect(asc?.date).toBe('2026-09-20');
    expect(asc?.poNo).toBe('A');
  });

  it('reports a single PO without a "+n more" count', () => {
    const n = nearestConnectingDate([{ poNo: 'PO-001', date: '2026-10-05' }]);
    expect(n?.poCount).toBe(1);
    expect(n?.date).toBe('2026-10-05');
  });

  it('crosses year boundaries by date, not by string luck', () => {
    const n = nearestConnectingDate([
      { poNo: 'NEXT-YEAR', date: '2027-01-02' },
      { poNo: 'THIS-YEAR', date: '2026-12-28' },
    ]);
    expect(n?.poNo).toBe('THIS-YEAR');
  });

  it('skips undated POs instead of letting them win the sort', () => {
    // An empty string sorts before every real date — treating it as the nearest would report
    // "no date" as the answer while a real PO date was sitting right there.
    const n = nearestConnectingDate([
      { poNo: 'NO-DATE', date: '' },
      { poNo: 'REAL', date: '2026-09-20' },
    ]);
    expect(n?.poNo).toBe('REAL');
    expect(n?.poCount).toBe(1);
  });

  it('is null when nothing is dated', () => {
    expect(nearestConnectingDate([])).toBeNull();
    expect(nearestConnectingDate(null)).toBeNull();
    expect(nearestConnectingDate(undefined)).toBeNull();
    expect(nearestConnectingDate([{ poNo: 'X', date: '' }])).toBeNull();
    expect(nearestConnectingDate([{ poNo: 'X', date: 'not a date' }])).toBeNull();
  });

  it('normalises a full timestamp down to the calendar date', () => {
    const n = nearestConnectingDate([{ poNo: 'PO-1', date: '2026-09-20T00:00:00.000Z' }]);
    expect(n?.date).toBe('2026-09-20');
  });

  it('falls back to a dash when a PO has no number', () => {
    const n = nearestConnectingDate([{ poNo: '', date: '2026-09-20' }]);
    expect(n?.poNo).toBe('—');
  });
});
