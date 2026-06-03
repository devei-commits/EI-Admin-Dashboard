import { describe, expect, it } from 'vitest';
import type { PlanningQuotationAsk } from '../services/planningQuotationAsks.service';
import {
  getPlanningQuotationAskUiStatus,
  planningQuotationActionButtonClass,
  planningQuotationAskMatchesItem,
  resolvePlanningQuotationAskUiStatus,
} from './planningQuotationAskDisplay';

const baseItem = {
  itemType: 'RM' as const,
  code: 'EI-RM-101',
  name: 'Glycerin',
  raw_material_id: 42,
  pack_material_id: undefined,
  planningExtractedIds: [10, 11],
  planningExtractedId: 10,
};

function mkAsk(partial: Partial<PlanningQuotationAsk>): PlanningQuotationAsk {
  return {
    id: 1,
    planningExtractedId: 10,
    itemType: 'RM',
    rawMaterialId: 42,
    packMaterialId: null,
    itemCode: 'EI-RM-101',
    itemName: 'Glycerin',
    quantityRequested: 100,
    unit: 'KG',
    vendorHint: null,
    moqHint: null,
    status: 'pending',
    notes: null,
    requestedBy: null,
    fulfilledAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('planningQuotationAskDisplay', () => {
  it('matches item by material id and planning extracted scope', () => {
    expect(planningQuotationAskMatchesItem(mkAsk({}), baseItem)).toBe(true);
    expect(planningQuotationAskMatchesItem(mkAsk({ planningExtractedId: 99 }), baseItem)).toBe(false);
    expect(planningQuotationAskMatchesItem(mkAsk({ rawMaterialId: 99 }), baseItem)).toBe(false);
  });

  it('prefers pending when a new ask exists alongside an older fulfilled ask', () => {
    const asks = [
      mkAsk({ id: 1, status: 'pending' }),
      mkAsk({
        id: 2,
        status: 'fulfilled',
        fulfilledAt: '2026-02-01T00:00:00Z',
      }),
    ];
    const { status, askId } = getPlanningQuotationAskUiStatus(asks, baseItem, new Set());
    expect(status).toBe('pending');
    expect(askId).toBe(1);
  });

  it('surfaces fulfilled_unread when quotation was recorded', () => {
    const asks = [
      mkAsk({
        id: 2,
        status: 'fulfilled',
        fulfilledAt: '2026-02-01T00:00:00Z',
      }),
    ];
    const { status } = getPlanningQuotationAskUiStatus(asks, baseItem, new Set());
    expect(status).toBe('fulfilled_unread');
  });

  it('returns pending when no unread fulfilled ask', () => {
    const asks = [mkAsk({ id: 3, status: 'pending' })];
    const { status } = getPlanningQuotationAskUiStatus(asks, baseItem, new Set());
    expect(status).toBe('pending');
  });

  it('uses solid yellow button class when quotation is pending', () => {
    expect(planningQuotationActionButtonClass('pending')).toContain('bg-yellow-400');
    expect(planningQuotationActionButtonClass('none')).toContain('bg-yellow-50');
  });

  it('treats open procurement quotation PR as pending when no ask row', () => {
    const { status } = resolvePlanningQuotationAskUiStatus([], baseItem, new Set(), true);
    expect(status).toBe('pending');
  });

  it('returns fulfilled_read when ask was seen', () => {
    const asks = [
      mkAsk({
        id: 4,
        status: 'fulfilled',
        fulfilledAt: '2026-02-01T00:00:00Z',
      }),
    ];
    const { status } = getPlanningQuotationAskUiStatus(asks, baseItem, new Set([4]));
    expect(status).toBe('fulfilled_read');
  });
});
