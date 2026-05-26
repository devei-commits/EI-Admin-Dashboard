import { describe, expect, it } from 'vitest';
import type { ProcurementRequestItem } from '../../services/procurement.service';
import type { PriceListItemPage } from '../../services/itemsList.service';
import type { DraftPO } from '../../types/procurement.types';
import {
  applyDraftPoLinePrices,
  findItemsListPageRow,
  pickTierForLine,
  resolveVendorId,
} from './syncEditRequestSideEffects';

describe('syncEditRequestSideEffects', () => {
  it('resolveVendorId matches vendor name case-insensitively', () => {
    expect(resolveVendorId('Acme Ltd', [{ id: '12', name: 'ACME LTD' }])).toBe(12);
  });

  it('findItemsListPageRow matches by raw_material_id', () => {
    const rmPage: PriceListItemPage[] = [
      {
        code: 'RM1',
        name: 'Resin',
        type: 'RM',
        pricePerUnit: 0,
        itemsListId: 99,
        vendorRates: [],
      },
    ];
    rmPage[0].raw_material_id = 5;
    const line: ProcurementRequestItem = {
      type: 'RM',
      code: 'RM1',
      name: 'Resin',
      required: 10,
      sih: 0,
      shortage: 10,
      quantity_requested: 10,
      unit: 'KG',
      raw_material_id: 5,
    };
    expect(findItemsListPageRow(line, rmPage, [])?.itemsListId).toBe(99);
  });

  it('pickTierForLine prefers MOQ match', () => {
    const tiers = [
      { id: 1, moq_min: 100, price_per_unit: 90 },
      { id: 2, moq_min: 500, price_per_unit: 85 },
    ];
    expect(pickTierForLine(tiers, 500, 500)?.id).toBe(2);
  });

  it('applyDraftPoLinePrices updates draft line rate from PR planned price', () => {
    const prItems: ProcurementRequestItem[] = [
      {
        type: 'RM',
        code: 'RM1',
        name: 'Resin',
        required: 10,
        sih: 0,
        shortage: 10,
        quantity_requested: 10,
        unit: 'KG',
        raw_material_id: 5,
        planned_unit_price: 125.5,
      },
    ];
    const draft: DraftPO = {
      id: 'PO-1',
      dpoNumber: 'PO-1',
      requestId: '1',
      requestCode: 'PR-REQ-001',
      type: 'RM',
      vendor: 'Acme',
      vendorId: '12',
      status: 'Draft',
      createdDate: '',
      createdBy: '',
      paymentTerms: '',
      expectedDelivery: '',
      deliveryAddress: '',
      vendorRating: 0,
      alertMessage: '',
      alertType: '',
      lineItems: [
        {
          item: 'Resin',
          itemCode: 'RM1',
          type: 'RM',
          qty: '10',
          pricePerUnit: 100,
          gstPercent: 18,
          gstAmount: 180,
          lineTotal: 1180,
          raw_material_id: 5,
        },
      ],
      subtotal: 1000,
      gstTotal: 180,
      grandTotal: 1180,
      backendPoId: '42',
    };
    const { lines, changed } = applyDraftPoLinePrices(draft, prItems);
    expect(changed).toBe(true);
    expect(lines[0].pricePerUnit).toBe(125.5);
  });
});
