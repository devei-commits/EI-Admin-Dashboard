import { describe, expect, it } from 'vitest';
import {
  formatStagedPaymentTermsObject,
  formatStagedPaymentTermsSummary,
  parseStagedPaymentTerms,
  parseStagedOneLineDotFormat,
  resolveStagedPaymentTermsForForm,
  resolveStagedPaymentTermsFromVendorRecord,
  stagedPaymentTermsFromStructured,
  validateStagedPercents,
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

  it('parseStagedOneLineDotFormat reads legacy Adv · Pre · Post line', () => {
    const p = parseStagedOneLineDotFormat('Adv 0% · Pre 100% · Post 0% · Net 45d');
    expect(p).toEqual({ advance_pct: 0, pre_shipment_pct: 100, post_shipment_pct: 0, credit_days: 45 });
  });

  it('validateStagedPercents allows 0+0+0 and requires sum 100 when any stage is set', () => {
    expect(validateStagedPercents(0, 0, 0)).toBeNull();
    expect(validateStagedPercents(90, 0, 0)).toMatch(/exactly 100%/i);
    expect(validateStagedPercents(90, 10, 0)).toBeNull();
    expect(validateStagedPercents(30, 40, 35)).toMatch(/at most 100%/i);
  });

  it('resolveStagedPaymentTermsFromVendorRecord prefers JSON payment_terms', () => {
    const json = JSON.stringify({
      advance_pct: 0,
      pre_shipment_pct: 100,
      post_shipment_pct: 0,
      credit_days: 30,
    });
    const r = resolveStagedPaymentTermsFromVendorRecord(json, {});
    expect(r.credit_days).toBe(30);
    expect(r.pre_shipment_pct).toBe(100);
  });

  it('resolveStagedPaymentTermsFromVendorRecord parses Vendor Master three-way line', () => {
    const line =
      'Advanced 10% + Before dispatch 20% + After dispatch/On delivery 70%';
    const r = resolveStagedPaymentTermsFromVendorRecord(line, {});
    expect(r.advance_pct).toBe(10);
    expect(r.pre_shipment_pct).toBe(20);
    expect(r.post_shipment_pct).toBe(70);
  });

  it('resolveStagedPaymentTermsFromVendorRecord uses data.paymentTerms when top-level empty', () => {
    const line =
      'Advanced 20% + Before dispatch 60% + After dispatch/On delivery 20%';
    const r = resolveStagedPaymentTermsFromVendorRecord('', { paymentTerms: line });
    expect(r.advance_pct).toBe(20);
    expect(r.pre_shipment_pct).toBe(60);
    expect(r.post_shipment_pct).toBe(20);
  });
});
