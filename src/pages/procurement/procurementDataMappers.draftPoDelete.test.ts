import { describe, expect, it } from 'vitest';
import type { DraftPOLineItem } from '../../types/procurement.types';
import type { ProcurementRequestItem } from '../../services/procurement.service';
import {
  mergeRemainderPrsIntoParentItems,
  planDraftPoDeleteProcurementCleanup,
  subtractDraftPoLineQtyFromProcurementItems,
  resolveRequestStatusAfterDraftPoRemoved,
} from './procurementDataMappers';

function rmLine(code: string, qty: number, rmId: number, remainder = false) {
  return {
    type: 'RM' as const,
    code,
    name: code,
    required: qty,
    sih: 0,
    shortage: qty,
    quantity_requested: qty,
    unit: 'KG',
    raw_material_id: rmId,
    ...(remainder ? { partial_release_remainder: true as const } : {}),
  };
}

function draftRmLine(code: string, qty: string, rmId: number): DraftPOLineItem {
  return {
    item: code,
    itemCode: code,
    type: 'RM',
    qty,
    pricePerUnit: 9,
    gstPercent: 0,
    gstAmount: 0,
    lineTotal: 0,
    raw_material_id: rmId,
    unit: 'KG',
  };
}

describe('mergeRemainderPrsIntoParentItems', () => {
  it('adds remainder line qty back onto parent line', () => {
    const parent = [rmLine('A', 100, 1)];
    const remainder = [{ items: [rmLine('A', 20, 1, true)] }];
    const merged = mergeRemainderPrsIntoParentItems(parent, remainder);
    expect(merged[0].quantity_requested).toBe(120);
    expect(merged[0].partial_release_remainder).toBeUndefined();
  });
});

describe('planDraftPoDeleteProcurementCleanup', () => {
  it('deletes parent PR when no other draft PO on request', () => {
    const plan = planDraftPoDeleteProcurementCleanup(
      { lineItems: [draftRmLine('A', '2', 42)] },
      { items: [rmLine('A', 2, 42)] },
      false,
      false
    );
    expect(plan.kind).toBe('delete-parent');
  });

  it('keeps remainder PRs — only deletes draft-linked parent (no merge)', () => {
    const plan = planDraftPoDeleteProcurementCleanup(
      { lineItems: [draftRmLine('A', '20', 42)] },
      { items: [rmLine('A', 20, 42)] },
      false,
      true
    );
    expect(plan.kind).toBe('delete-parent');
  });

  it('subtracts draft lines when another draft PO shares the request', () => {
    const plan = planDraftPoDeleteProcurementCleanup(
      { lineItems: [draftRmLine('A', '20', 42)] },
      { items: [rmLine('A', 50, 42)] },
      true,
      true
    );
    expect(plan.kind).toBe('update-parent');
    if (plan.kind === 'update-parent') {
      expect(plan.items[0].quantity_requested).toBe(30);
      expect(plan.status).toBe('Quoted');
    }
  });
});

describe('subtractDraftPoLineQtyFromProcurementItems', () => {
  it('removes draft line qty per material key', () => {
    const out = subtractDraftPoLineQtyFromProcurementItems(
      [rmLine('A', 2, 42)],
      [draftRmLine('A', '2', 42)]
    );
    expect(out).toHaveLength(0);
  });
});

describe('resolveRequestStatusAfterDraftPoRemoved', () => {
  it('returns Quoted when no other draft PO and quotes exist', () => {
    expect(resolveRequestStatusAfterDraftPoRemoved(false, true)).toBe('Quoted');
  });

  it('stays PO Draft when another draft PO exists', () => {
    expect(resolveRequestStatusAfterDraftPoRemoved(true, true)).toBe('PO Draft');
  });
});
