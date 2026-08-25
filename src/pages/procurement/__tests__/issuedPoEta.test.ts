import { describe, it, expect } from 'vitest';
import { computeIssuedPoEtaFromLeadTimes, connectingDateByItemFromLineDates } from '../procurementDataMappers';
import type { ProcurementRequest } from '../../../types/procurement.types';

describe('computeIssuedPoEtaFromLeadTimes', () => {
  const baseRequest = (over: Partial<ProcurementRequest> = {}): ProcurementRequest => ({
    id: '1',
    code: 'PR-REQ-001',
    type: 'RM',
    priority: 'Medium',
    status: 'PO Released',
    items: ['A'],
    dueDate: '2026-06-01',
    createdDate: '2026-01-01',
    ...over,
  });

  it('uses max line lead from raw PO + PO date', () => {
    const today = new Date(2026, 3, 1, 12, 0, 0, 0);
    const r = computeIssuedPoEtaFromLeadTimes({
      today,
      poReleaseDateStr: '2026-04-01',
      request: baseRequest({ itemDetails: [{ itemCode: 'X', itemName: 'A', reqQty: 1, unit: 'kg', moq: '', packSize: '', plannedPrice: 0, estValue: 0, leadTimeDays: 99 }] }),
      linkedQuote: undefined,
      linkedPO: {
        id: '1',
        vendorId: '',
        vendorName: 'V',
        poNumber: 'PO-1',
        itemCount: 1,
        value: 100,
        date: '2026-04-01',
        status: 'Released',
        etaDays: 0,
        rawItems: [{ quantity: 1, rate: 1, lead_time_days: 5, itemName: 'A' }],
      },
      draftOverlay: undefined,
      lineItems: [{ item: 'A', itemCode: 'X' }],
    });
    expect(r.maxLeadDays).toBe(5);
    expect(r.etaDateDisplay).not.toBe('—');
  });

  it('falls back to PR due date when no lead data', () => {
    const today = new Date(2026, 3, 1, 12, 0, 0, 0);
    const r = computeIssuedPoEtaFromLeadTimes({
      today,
      poReleaseDateStr: '2026-04-01',
      request: baseRequest({ dueDate: '2026-05-15' }),
      linkedQuote: undefined,
      linkedPO: {
        id: '1',
        vendorId: '',
        vendorName: 'V',
        poNumber: 'PO-1',
        itemCount: 1,
        value: 100,
        date: '2026-04-01',
        status: 'Released',
        etaDays: 0,
        rawItems: [{ quantity: 1, rate: 1, itemName: 'A' }],
      },
      draftOverlay: undefined,
      lineItems: [{ item: 'A', itemCode: 'X' }],
    });
    expect(r.etaDateDisplay).toMatch(/15/);
  });
});

describe('connectingDateByItemFromLineDates', () => {
  it('prefers the PR required-by date over a lead-time-derived date (PO-024: 0-day lead recorded)', () => {
    const today = new Date(2026, 3, 1, 12, 0, 0, 0);
    // PO-024's actual data: an explicit lead_time_days: 0 on the raw PO line resolves the "auto"
    // date to PO release date + 0 = today (2026-04-01) — that's a real, non-null effectiveIso, so
    // the earlier null-only backfill fix didn't help here. But Planning released this for
    // 2026-10-08, and the PO showed "today" instead of that — the required-by date must win over
    // a merely-technically-present lead time of zero.
    const request092: ProcurementRequest = {
      id: '92', code: 'PR-REQ-092', type: 'PM', priority: 'High', status: 'PO Released',
      items: ['A'], dueDate: '2026-10-08', createdDate: '2026-01-01',
      itemDetails: [{ itemCode: '12PT01', itemName: 'BBOLD tube', reqQty: 200, unit: 'PCS', moq: '0.5', packSize: '', plannedPrice: 2.96, estValue: 0, leadTimeDays: 0, expectedDate: '2026-10-08' }],
    };
    const r = computeIssuedPoEtaFromLeadTimes({
      today,
      poReleaseDateStr: '2026-04-01',
      request: request092,
      linkedQuote: undefined,
      linkedPO: {
        id: '1310', vendorId: '', vendorName: 'Adobe Systems Software Ireland Ltd', poNumber: 'PO-024', itemCount: 1, value: 699,
        date: '2026-04-01', status: 'Draft', etaDays: 0,
        rawItems: [{ quantity: 200, rate: 2.96, lead_time_days: 0, itemCode: '12PT01', itemName: '12PT01' }],
      },
      draftOverlay: undefined,
      lineItems: [{ item: '12PT01', itemCode: '12PT01' }],
    });
    // The lead-time "auto" date is real (today), not null — proving this needs the priority fix,
    // not just the earlier null-backfill.
    expect(r.lineDates[0]?.effectiveIso).toBe('2026-04-01');
    const map = connectingDateByItemFromLineDates(r.lineDates, request092);
    expect(map?.['12pt01']).toBe('2026-10-08');
  });

  it('falls back to the lead-time-derived date when the PR has no required-by date', () => {
    const today = new Date(2026, 3, 1, 12, 0, 0, 0);
    const requestNoDate: ProcurementRequest = {
      id: '1', code: 'PR-REQ-001', type: 'PM', priority: 'Medium', status: 'PO Released',
      items: ['A'], dueDate: '', createdDate: '2026-01-01',
    };
    const r = computeIssuedPoEtaFromLeadTimes({
      today,
      poReleaseDateStr: '2026-04-01',
      request: requestNoDate,
      linkedQuote: undefined,
      linkedPO: {
        id: '1', vendorId: '', vendorName: 'V', poNumber: 'PO-023', itemCount: 1, value: 349,
        date: '2026-04-01', status: 'Draft', etaDays: 0,
        rawItems: [{ quantity: 1, rate: 349, lead_time_days: 5, itemName: '12PT01' }],
      },
      draftOverlay: undefined,
      lineItems: [{ item: '12PT01', itemCode: '12PT01' }],
    });
    const map = connectingDateByItemFromLineDates(r.lineDates, requestNoDate);
    expect(map?.['12pt01']).toBe('2026-04-06');
  });

  it('returns null when no line has a resolvable date', () => {
    expect(connectingDateByItemFromLineDates([
      { itemCode: 'X', item: 'A', autoIso: null, overrideIso: null, effectiveIso: null },
    ])).toBeNull();
  });

  it('backfills the per-line date from the PR due-date fallback (draft PO, no lead time anywhere)', () => {
    const today = new Date(2026, 3, 1, 12, 0, 0, 0);
    // No lead_time_days on the line, no linkedPO, no quote — nothing for leadForLineIndex to find,
    // so the aggregate ETA falls back to request.dueDate. Before the fix, that fallback only set the
    // aggregate etaDate/etaDateDisplay and left every line's own effectiveIso null, so a draft PO's
    // Connecting column still showed "—" even though the PR's required-by date was known.
    const requestNoLead: ProcurementRequest = {
      id: '1', code: 'PR-REQ-092', type: 'PM', priority: 'Medium', status: 'PO Released',
      items: ['A'], dueDate: '2026-10-08', createdDate: '2026-04-01',
    };
    const r = computeIssuedPoEtaFromLeadTimes({
      today,
      poReleaseDateStr: '2026-04-01',
      request: requestNoLead,
      linkedQuote: undefined,
      linkedPO: undefined,
      draftOverlay: undefined,
      lineItems: [{ item: '12PT01', itemCode: '12PT01' }],
    });
    expect(r.lineDates[0]?.effectiveIso).toBe('2026-10-08');
    const map = connectingDateByItemFromLineDates(r.lineDates, requestNoLead);
    expect(map?.['12pt01']).toBe('2026-10-08');
  });
});
