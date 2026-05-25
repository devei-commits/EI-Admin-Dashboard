import { describe, expect, it } from 'vitest';
import type { DraftPOLineItem } from '../../types/procurement.types';
import type { ProcurementRequestItem } from '../../services/procurement.service';
import { recalcDraftPoLineItem, syncProcurementItemsAfterDraftPoLineQtyEdit } from './procurementDataMappers';

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
