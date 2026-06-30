import { describe, expect, it } from 'vitest';
import {
  findGrnLineItemByIdOrCode,
  normalizeGrnLineItemIds,
  resolveGrnLineItemId,
} from '../grnLineItemIds';

describe('grnLineItemIds', () => {
  it('assigns stable id from itemCode when line.id is missing', () => {
    const id = resolveGrnLineItemId({ item: 'ALPHA CB', itemCode: '1000020' }, 0);
    expect(id).toBe('grn-line-code-1000020');
  });

  it('normalizes all lines with ids', () => {
    const lines = normalizeGrnLineItemIds([
      { item: 'ALPHA CB', itemCode: '1000020', poQty: 36, rcvdQty: 36 },
    ]);
    expect(lines[0].id).toBe('grn-line-code-1000020');
  });

  it('finds line by itemCode when focus row has no id', () => {
    const lines = normalizeGrnLineItemIds([
      { item: 'ALPHA CB', itemCode: '1000020', poQty: 36, rcvdQty: 36 },
    ]);
    const match = findGrnLineItemByIdOrCode(lines, { item: 'ALPHA CB', itemCode: '1000020' });
    expect(match?.id).toBe('grn-line-code-1000020');
  });
});
