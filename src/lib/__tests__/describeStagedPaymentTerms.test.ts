/**
 * The PO popup rendered payment terms as a bare four-number grid ("0 · 100 · 0 · 60"), giving a 0%
 * stage the same weight as the one carrying the entire payment. This helper backs the replacement.
 */
import { describe, it, expect } from 'vitest';
import { describeStagedPaymentTerms } from '../stagedPaymentTerms';

const terms = (a: number, pre: number, post: number, credit = 0) => ({
  advance_pct: a, pre_shipment_pct: pre, post_shipment_pct: post, credit_days: credit,
});

describe('describeStagedPaymentTerms', () => {
  it('keeps only the stages that carry money — the DPO-008 case', () => {
    const d = describeStagedPaymentTerms(terms(0, 100, 0, 60), 11800);
    expect(d.stages).toHaveLength(1);
    expect(d.stages[0]).toMatchObject({ key: 'pre_shipment', label: 'Pre-shipment', pct: 100, amount: 11800 });
    expect(d.creditDays).toBe(60);
    expect(d.pctWarning).toBeNull();
  });

  it('splits a known order value across every paying stage', () => {
    const d = describeStagedPaymentTerms(terms(30, 50, 20), 10000);
    expect(d.stages.map((s) => [s.label, s.pct, s.amount])).toEqual([
      ['Advance', 30, 3000],
      ['Pre-shipment', 50, 5000],
      ['Post-shipment', 20, 2000],
    ]);
  });

  it('says when each stage falls due', () => {
    const d = describeStagedPaymentTerms(terms(30, 50, 20));
    expect(d.stages.map((s) => s.when)).toEqual(['on PO release', 'before dispatch', 'after delivery']);
  });

  it('reports no amounts when the order value is unknown', () => {
    for (const amt of [undefined, null, 0, -5, Number.NaN]) {
      expect(describeStagedPaymentTerms(terms(0, 100, 0), amt).stages[0].amount).toBeNull();
    }
  });

  it('flags a split that does not add up to 100%', () => {
    expect(describeStagedPaymentTerms(terms(30, 30, 30)).pctWarning).toBe('Stages total 90%, not 100%');
    expect(describeStagedPaymentTerms(terms(60, 60, 0)).pctWarning).toBe('Stages total 120%, not 100%');
  });

  it('treats credit-only terms as complete, not as a broken split', () => {
    const d = describeStagedPaymentTerms(terms(0, 0, 0, 45));
    expect(d.stages).toEqual([]);
    expect(d.creditDays).toBe(45);
    expect(d.pctWarning).toBeNull();
  });

  it('clamps out-of-range percentages and negative credit days', () => {
    const d = describeStagedPaymentTerms(terms(-10, 150, 0, -5));
    expect(d.stages.map((s) => s.pct)).toEqual([100]);
    expect(d.creditDays).toBe(0);
  });

  it('does not raise a spurious warning on repeating decimals', () => {
    const d = describeStagedPaymentTerms(terms(33.33, 33.33, 33.34));
    expect(d.totalPct).toBe(100);
    expect(d.pctWarning).toBeNull();
  });
});
