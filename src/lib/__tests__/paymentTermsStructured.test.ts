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

  it('parses Items List JSON payment_terms', () => {
    const net30 = JSON.stringify({
      advance_pct: 0,
      pre_shipment_pct: 100,
      post_shipment_pct: 0,
      credit_days: 30,
    });
    expect(parsePaymentTermsString(net30).type).toBe('net_30');
    expect(parsePaymentTermsString(net30).advancePercent).toBe(0);

    const net45 = JSON.stringify({
      advance_pct: 0,
      pre_shipment_pct: 100,
      post_shipment_pct: 0,
      credit_days: 45,
    });
    expect(parsePaymentTermsString(net45).type).toBe('net_45');

    const advBefore = JSON.stringify({
      advance_pct: 30,
      pre_shipment_pct: 70,
      post_shipment_pct: 0,
      credit_days: 0,
    });
    const p = parsePaymentTermsString(advBefore);
    expect(p.type).toBe('advance_before_dispatch');
    expect(p.advancePercent).toBe(30);

    const advDel = JSON.stringify({
      advance_pct: 40,
      pre_shipment_pct: 0,
      post_shipment_pct: 60,
      credit_days: 0,
    });
    const p2 = parsePaymentTermsString(advDel);
    expect(p2.type).toBe('advance_on_delivery');
    expect(p2.advancePercent).toBe(40);
  });

  it('validates advance %', () => {
    expect(validateAdvancePercentForType('advance_on_delivery', 0)).toBeTruthy();
    expect(validateAdvancePercentForType('advance_on_delivery', 50)).toBeNull();
    expect(validateAdvancePercentForType('net_30', 0)).toBeNull();
  });
});
