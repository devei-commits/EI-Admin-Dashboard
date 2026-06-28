import { describe, expect, it } from 'vitest';
import {
  buildStockCheckWarehouseDispatchPayload,
  isOpenStockCheckStatus,
  resolveStockCheckTargetDate,
} from '../stockCheckWarehouseDispatch';

describe('stockCheckWarehouseDispatch', () => {
  it('buildStockCheckWarehouseDispatchPayload sets pending status and target date', () => {
    const payload = buildStockCheckWarehouseDispatchPayload({
      stockCheckAssignedTo: null,
      stockCheckNotes: null,
      requestedBy: 'buyer@example.com',
      dueDate: '2026-06-30',
      stockCheckDueDate: null,
    });
    expect(payload.stockCheckStatus).toBe('Pending');
    expect(payload.stockCheckDueDate).toBe('2026-06-30');
    expect(payload.stockCheckNotes).toContain('requestedAt');
  });

  it('resolveStockCheckTargetDate prefers stockCheckDueDate', () => {
    expect(
      resolveStockCheckTargetDate({ stockCheckDueDate: '2026-06-25', dueDate: '2026-06-30' }),
    ).toBe('2026-06-25');
  });

  it('isOpenStockCheckStatus matches pending states', () => {
    expect(isOpenStockCheckStatus('Pending')).toBe(true);
    expect(isOpenStockCheckStatus('Completed')).toBe(false);
  });
});
