import { describe, expect, it } from 'vitest';
import type { DraftPOLineItem } from '../../types/procurement.types';
import type { ProcurementRequestItem } from '../../services/procurement.service';
import { recalcDraftPoLineItem, syncProcurementItemsAfterDraftPoLineQtyEdit, splitBackendPrItemsAfterPartialRelease, computeOpenProcurementLineQty, sumCommittedPoQtyForPrItem } from './procurementDataMappers';
import type { ReleaseLineEditRow } from './procurementDataMappers';

function rmLine(code: string, qty: number, rmId: number): ProcurementRequestItem {
  return {
    type: 'RM',
    code,
    name: `Item ${code}`,
    required: qty,
    sih: 0,
    shortage: qty,
    quantity_requested: qty,
    unit: 'KG',
    raw_material_id: rmId,
  };
}

function draftLine(item: string, code: string, qty: string, rmId: number): DraftPOLineItem {
  return {
    item,
    itemCode: code,
    type: 'RM',
    qty,
    pricePerUnit: 1,
    gstPercent: 18,
    gstAmount: 0,
    lineTotal: 0,
    raw_material_id: rmId,
  };
}

describe('syncProcurementItemsAfterDraftPoLineQtyEdit', () => {
  it('reduces linked PR line to new PO qty and emits remainder rows', () => {
    const backend: ProcurementRequestItem[] = [rmLine('RM-1', 100, 42)];
    const oldLines: DraftPOLineItem[] = [draftLine('Sugar', 'RM-1', '100', 42)];
    const newLines: DraftPOLineItem[] = [draftLine('Sugar', 'RM-1', '80', 42)];

    const { updatedItems, remainderItems } = syncProcurementItemsAfterDraftPoLineQtyEdit(backend, oldLines, newLines);

    expect(updatedItems).toHaveLength(1);
    expect(updatedItems[0].quantity_requested).toBe(80);
    expect(remainderItems).toHaveLength(1);
    expect(remainderItems[0].quantity_requested).toBe(20);
    expect(remainderItems[0].partial_release_remainder).toBe(true);
    expect(remainderItems[0].raw_material_id).toBe(42);
  });

  it('does not emit remainder when qty increases', () => {
    const backend: ProcurementRequestItem[] = [rmLine('RM-1', 100, 42)];
    const oldLines: DraftPOLineItem[] = [draftLine('Sugar', 'RM-1', '80', 42)];
    const newLines: DraftPOLineItem[] = [draftLine('Sugar', 'RM-1', '90', 42)];

    const { updatedItems, remainderItems } = syncProcurementItemsAfterDraftPoLineQtyEdit(backend, oldLines, newLines);

    expect(updatedItems[0].quantity_requested).toBe(90);
    expect(remainderItems).toHaveLength(0);
  });

  it('emits remainder when backend PR exceeds unchanged draft PO qty (consolidation gap)', () => {
    const backend: ProcurementRequestItem[] = [rmLine('RM-1', 140, 42)];
    const oldLines: DraftPOLineItem[] = [draftLine('Sugar', 'RM-1', '120', 42)];
    const newLines: DraftPOLineItem[] = [draftLine('Sugar', 'RM-1', '120', 42)];

    const { updatedItems, remainderItems } = syncProcurementItemsAfterDraftPoLineQtyEdit(backend, oldLines, newLines);

    expect(updatedItems[0].quantity_requested).toBe(120);
    expect(remainderItems).toHaveLength(1);
    expect(remainderItems[0].quantity_requested).toBe(20);
  });
});

function releaseLine(qty: number, originalQty: number, rmId: number): ReleaseLineEditRow {
  return {
    itemName: 'Sugar',
    itemCode: 'RM-1',
    type: 'RM',
    qty,
    originalQty,
    unit: 'KG',
    moq: 0,
    unitPrice: 1,
    leadDays: 0,
    raw_material_id: rmId,
  };
}

describe('splitBackendPrItemsAfterPartialRelease', () => {
  it('uses open qty cap so remainder is zero when releasing all open units after prior PO', () => {
    const backend: ProcurementRequestItem[] = [rmLine('RM-1', 140, 42)];
    const edits = [releaseLine(20, 20, 42)];

    const { releasedItems, remainingItems } = splitBackendPrItemsAfterPartialRelease(backend, edits, edits);

    expect(releasedItems).toHaveLength(1);
    expect(releasedItems[0].quantity_requested).toBe(20);
    expect(remainingItems).toHaveLength(0);
  });
});

describe('open procurement qty helpers', () => {
  it('computeOpenProcurementLineQty subtracts committed PO qty', () => {
    expect(computeOpenProcurementLineQty(140, 120)).toBe(20);
  });

  it('sumCommittedPoQtyForPrItem totals draft and released PO lines for the request', () => {
    const sum = sumCommittedPoQtyForPrItem(
      { itemCode: 'RM-1', raw_material_id: 42, type: 'RM' },
      {
        requestId: '7',
        purchaseOrders: [
          {
            status: 'Draft',
            poNumber: 'DPO-001',
            formData: { requestId: '7' },
            rawItems: [{ itemCode: 'RM-1', quantity: 120, raw_material_id: 42 }],
          },
        ],
      },
    );
    expect(sum).toBe(120);
  });
});

describe('recalcDraftPoLineItem', () => {
  it('updates line total when price per unit changes', () => {
    const line = draftLine('Sugar', 'RM-1', '10', 42);
    const next = recalcDraftPoLineItem(line, { pricePerUnit: 250 });
    expect(next.pricePerUnit).toBe(250);
    expect(next.gstAmount).toBe(450);
    expect(next.lineTotal).toBe(2950);
  });
});
