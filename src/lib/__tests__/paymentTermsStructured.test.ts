import { describe, expect, it } from 'vitest';
import {
  formatPaymentTermsString,
  parsePaymentTermsString,
  validateAdvancePercentForType,
} from '../paymentTermsStructured';

describe('paymentTermsStructured', () => {
  it('formats advance splits', () => {
    expect(formatPaymentTermsString('advance_on_delivery', 50)).toBe('50% Advance, 50% on delivery');
    expect(formatPaymentTermsString('advance_before_dispatch', 30)).toBe('30% Advance, 70% before dispatch');
  });

  it('round-trips planning-style strings', () => {
    const s = '30% Advance, 70% before dispatch';
    const p = parsePaymentTermsString(s);
    expect(p.type).toBe('advance_before_dispatch');
    expect(p.advancePercent).toBe(30);
    expect(formatPaymentTermsString(p.type, p.advancePercent)).toBe(s);
  });

  it('parses legacy SO terms', () => {
    expect(parsePaymentTermsString('Net 30').type).toBe('net_30');
    expect(parsePaymentTermsString('COD').type).toBe('cod');
  });

  it('validates advance %', () => {
    expect(validateAdvancePercentForType('advance_on_delivery', 0)).toBeTruthy();
    expect(validateAdvancePercentForType('advance_on_delivery', 50)).toBeNull();
    expect(validateAdvancePercentForType('net_30', 0)).toBeNull();
  });
});
