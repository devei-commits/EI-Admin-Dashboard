import { describe, expect, it } from 'vitest';
import { getStockCheckGapForItem, resolveInventoryStockAfterGapApproval } from './stockCheckGapDisplay';

describe('stockCheckGapDisplay', () => {
  it('returns gap info when stock check completed with positive gap', () => {
    const notes = JSON.stringify({
      outcome: 'not_ok',
      lines: [
        {
          itemCode: '1000153',
          itemName: 'DISODIUM EDTA',
          systemQtyAtRequest: 10,
          physicalQty: 4,
          consumptionQty: 1.8,
          gapQty: 4.2,
        },
      ],
    });
    const info = getStockCheckGapForItem('Completed', notes, '1000153', 'DISODIUM EDTA');
    expect(info?.gapQty).toBe(4.2);
    expect(info?.canApprove).toBe(true);
  });

  it('resolves inventory stock from physical qty on approval', () => {
    const stock = resolveInventoryStockAfterGapApproval({
      itemCode: 'RM-1',
      physicalQty: 625,
      updatedStockQty: 625,
    });
    expect(stock).toBe(625);
  });
});
