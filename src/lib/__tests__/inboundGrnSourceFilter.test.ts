import { describe, expect, it } from 'vitest';
import {
  matchesInboundGrnSourceTab,
  resolveGrnReceiptSource,
} from '../inboundGrnSourceFilter';

describe('inboundGrnSourceFilter', () => {
  it('defaults legacy PO GRNs to po tab', () => {
    expect(resolveGrnReceiptSource({ poNo: 'PO-2026-001' })).toBe('po');
    expect(resolveGrnReceiptSource({ purchaseOrderId: 12 })).toBe('po');
    expect(resolveGrnReceiptSource({})).toBe('po');
  });

  it('reads explicit receipt source', () => {
    expect(resolveGrnReceiptSource({ receiptSource: 'transfer' })).toBe('transfer');
    expect(resolveGrnReceiptSource({ receiptSource: 'return' })).toBe('return');
    expect(resolveGrnReceiptSource({ receiptSource: 'po' })).toBe('po');
  });

  it('infers transfer from mrn id', () => {
    expect(resolveGrnReceiptSource({ mrnId: 7 })).toBe('transfer');
  });

  it('filters by source tab', () => {
    expect(matchesInboundGrnSourceTab({ poNo: 'PO-1' }, 'po')).toBe(true);
    expect(matchesInboundGrnSourceTab({ poNo: 'PO-1' }, 'transfer')).toBe(false);
    expect(matchesInboundGrnSourceTab({ receiptSource: 'return' }, 'return')).toBe(true);
  });
});
