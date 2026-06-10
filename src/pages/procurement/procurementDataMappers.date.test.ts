import { describe, expect, it } from 'vitest';
import {
  formatDateEnInSafe,
  formatDateWithIsoWeek,
  normalizeDateOnlyString,
  parseDateStringToLocalDate,
  mapBackendPrToRequest,
  mergePlannedRateIntoLineNotes,
  resolvePlannedUnitPrice,
  computeRequestDaysUntilDue,
  sortVendorQuotesLatestFirst,
  sortPlanningQuotationAsksLatestFirst,
} from './procurementDataMappers';
import type { VendorQuote } from '../../types/procurement.types';
import type { PlanningQuotationAsk } from '../../services/planningQuotationAsks.service';
import type { ProcurementRequest } from '../../types/procurement.types';

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

  it('computeRequestDaysUntilDue uses due date, then created+lead, then open age', () => {
    const today = new Date(2026, 4, 26, 12, 0, 0, 0);
    const withDue: Pick<ProcurementRequest, 'dueDate' | 'createdDate' | 'itemDetails'> = {
      dueDate: '2026-06-01',
      createdDate: '2026-05-01',
      itemDetails: [],
    };
    expect(computeRequestDaysUntilDue(withDue, today)).toBe(6);

    const withLead: Pick<ProcurementRequest, 'dueDate' | 'createdDate' | 'itemDetails'> = {
      dueDate: '',
      createdDate: '2026-05-20',
      itemDetails: [{ itemCode: 'A', itemName: 'X', reqQty: 1, unit: 'kg', moq: '', packSize: '', plannedPrice: 0, estValue: 0, leadTimeDays: 10 }],
    };
    expect(computeRequestDaysUntilDue(withLead, today)).toBe(4);

    const openOnly: Pick<ProcurementRequest, 'dueDate' | 'createdDate' | 'itemDetails'> = {
      dueDate: '',
      createdDate: '2026-05-20T10:00:00.000Z',
      itemDetails: [],
    };
    expect(computeRequestDaysUntilDue(openOnly, today)).toBe(6);
  });

  it('sortVendorQuotesLatestFirst orders by createdAt descending', () => {
    const mk = (id: string, createdAt: string): VendorQuote => ({
      id,
      requestId: '1',
      requestCode: 'PR-REQ-001',
      requestType: 'RM',
      vendor: 'V',
      status: 'Confirmed',
      createdAt,
      quotedOn: '',
      leadTimeDays: 0,
      terms: '',
      validTill: '',
      rating: 0,
      fileName: '',
      note: '',
      lines: [],
    });
    const sorted = sortVendorQuotesLatestFirst([
      mk('1', '2026-05-20T10:00:00Z'),
      mk('3', '2026-05-26T10:00:00Z'),
      mk('2', '2026-05-22T10:00:00Z'),
    ]);
    expect(sorted.map((q) => q.id)).toEqual(['3', '2', '1']);
  });

  it('sortPlanningQuotationAsksLatestFirst orders by createdAt descending', () => {
    const mk = (id: number, createdAt: string): PlanningQuotationAsk => ({
      id,
      planningExtractedId: 1,
      itemType: 'RM',
      rawMaterialId: 1,
      packMaterialId: null,
      itemCode: 'RM-1',
      itemName: 'A',
      quantityRequested: 1,
      unit: 'KG',
      vendorHint: null,
      moqHint: null,
      status: 'pending',
      notes: null,
      requestedBy: null,
      fulfilledAt: null,
      createdAt,
      updatedAt: createdAt,
    });
    const sorted = sortPlanningQuotationAsksLatestFirst([
      mk(1, '2026-05-20T10:00:00Z'),
      mk(3, '2026-05-26T10:00:00Z'),
      mk(2, '2026-05-22T10:00:00Z'),
    ]);
    expect(sorted.map((a) => a.id)).toEqual([3, 2, 1]);
  });

  it('sortPlanningQuotationAsksLatestFirst uses time within same calendar day and id tie-break', () => {
    const mk = (id: number, createdAt: string): PlanningQuotationAsk => ({
      id,
      planningExtractedId: 1,
      itemType: 'RM',
      rawMaterialId: 1,
      packMaterialId: null,
      itemCode: 'RM-1',
      itemName: 'A',
      quantityRequested: 1,
      unit: 'KG',
      vendorHint: null,
      moqHint: null,
      status: 'pending',
      notes: null,
      requestedBy: null,
      fulfilledAt: null,
      createdAt,
      updatedAt: createdAt,
    });
    const sorted = sortPlanningQuotationAsksLatestFirst([
      mk(2, '2026-05-26T08:00:00Z'),
      mk(4, '2026-05-26T18:00:00Z'),
      mk(3, '2026-05-26T12:00:00Z'),
    ]);
    expect(sorted.map((a) => a.id)).toEqual([4, 3, 2]);
  });

  it('formatDateWithIsoWeek appends ISO week label', () => {
    const formatted = formatDateWithIsoWeek('2025-10-01');
    expect(formatted).toContain('Week 40, 2025');
    expect(formatDateWithIsoWeek('')).toBe('—');
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
