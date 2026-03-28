import { describe, expect, it } from 'vitest';
import {
  formatStagedPaymentTermsObject,
  formatStagedPaymentTermsSummary,
  parseStagedPaymentTerms,
  resolveStagedPaymentTermsForForm,
  stagedPaymentTermsFromStructured,
} from '../stagedPaymentTerms';

describe('stagedPaymentTerms', () => {
  it('formats JSON rate as three-stage summary', () => {
    const raw = JSON.stringify({
      advance_pct: 0,
      pre_shipment_pct: 100,
      post_shipment_pct: 0,
      credit_days: 30,
    });
    expect(formatStagedPaymentTermsSummary(raw)).toBe('Adv 0% · Pre 100% · Post 0% · Net 30d');
  });

  it('maps structured net type to staged percents', () => {
    const s = stagedPaymentTermsFromStructured('net_45', 0);
    expect(s).toEqual({ advance_pct: 0, pre_shipment_pct: 100, post_shipment_pct: 0, credit_days: 45 });
  });

  it('resolve prefers raw JSON over dropdown', () => {
    const raw = JSON.stringify({
      advance_pct: 30,
      pre_shipment_pct: 70,
      post_shipment_pct: 0,
      credit_days: 0,
    });
    const r = resolveStagedPaymentTermsForForm(raw, 'net_30', 0);
    expect(r.advance_pct).toBe(30);
    expect(r.pre_shipment_pct).toBe(70);
  });

  it('resolve falls back to structured when raw not JSON', () => {
    const r = resolveStagedPaymentTermsForForm('NET 30', 'net_30', 0);
    expect(r.credit_days).toBe(30);
    expect(r.pre_shipment_pct).toBe(100);
  });

  it('formatStagedPaymentTermsObject omits Net when credit 0', () => {
    expect(formatStagedPaymentTermsObject({ advance_pct: 40, pre_shipment_pct: 0, post_shipment_pct: 60, credit_days: 0 })).toBe(
      'Adv 40% · Pre 0% · Post 60%'
    );
  });

  it('parseStagedPaymentTerms reads object', () => {
    const p = parseStagedPaymentTerms(
      JSON.stringify({ advance_pct: 10, pre_shipment_pct: 45, post_shipment_pct: 45, credit_days: 0 })
    );
    expect(p?.advance_pct).toBe(10);
  });
});
