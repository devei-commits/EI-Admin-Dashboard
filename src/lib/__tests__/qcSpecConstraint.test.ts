/**
 * QC pass/fail was keyed on each test's `outputType`, but master-seeded specs carry none — so
 * "≥ 99.5%", "1100 - 1500" and "38 - 43" fell through to "any non-empty text passes". A viscosity
 * of -1 against 1100-1500, a solid content of -50 against 38-43, and the literal text "fafa" all
 * reported PASS. The spec string itself states the rule, so it is parsed directly.
 */
import { describe, it, expect } from 'vitest';
import { parseQcSpecConstraint, evaluateAgainstSpec, parseMeasuredValue } from '../qcSpecConstraint';
import { deriveAutoPassedFromResult } from '../grnQcAutoPass';

const auto = (specLimit: string, result: string, over: Record<string, unknown> = {}) =>
  deriveAutoPassedFromResult({ specLimit, result, ...over } as never);

describe('parseQcSpecConstraint', () => {
  it('reads lower bounds', () => {
    expect(parseQcSpecConstraint('≥ 99.5%')).toEqual({ kind: 'min', value: 99.5 });
    expect(parseQcSpecConstraint('>= 99.5')).toEqual({ kind: 'min', value: 99.5 });
    expect(parseQcSpecConstraint('NLT 98')).toEqual({ kind: 'min', value: 98 });
    expect(parseQcSpecConstraint('min 5')).toEqual({ kind: 'min', value: 5 });
  });

  it('reads upper bounds', () => {
    expect(parseQcSpecConstraint('≤ 0.1%')).toEqual({ kind: 'max', value: 0.1 });
    expect(parseQcSpecConstraint('NMT 0.5')).toEqual({ kind: 'max', value: 0.5 });
    expect(parseQcSpecConstraint('max 10')).toEqual({ kind: 'max', value: 10 });
  });

  it('reads ranges in every form the masters use', () => {
    expect(parseQcSpecConstraint('1100 - 1500')).toEqual({ kind: 'range', min: 1100, max: 1500 });
    expect(parseQcSpecConstraint('4.0-5.0')).toEqual({ kind: 'range', min: 4, max: 5 });
    expect(parseQcSpecConstraint('38 - 43')).toEqual({ kind: 'range', min: 38, max: 43 });
    expect(parseQcSpecConstraint('1.258 to 1.268 g/mL ( 20°C).')).toEqual({ kind: 'range', min: 1.258, max: 1.268 });
  });

  it('normalises a reversed range rather than never matching', () => {
    expect(parseQcSpecConstraint('43 - 38')).toEqual({ kind: 'range', min: 38, max: 43 });
  });

  it('reads a bare number as an exact target', () => {
    expect(parseQcSpecConstraint('23')).toEqual({ kind: 'exact', value: 23 });
    expect(parseQcSpecConstraint('7.4 pH')).toEqual({ kind: 'exact', value: 7.4 });
  });

  it('returns null for a descriptive spec, so text handling still applies', () => {
    expect(parseQcSpecConstraint('CLEAR')).toBeNull();
    expect(parseQcSpecConstraint('MILD CHARACTERISTIC')).toBeNull();
    expect(parseQcSpecConstraint('COLORLESS TO NEAR COLORLESS')).toBeNull();
    expect(parseQcSpecConstraint('')).toBeNull();
    expect(parseQcSpecConstraint(null)).toBeNull();
  });

  it('does not mistake a number buried in prose for a constraint', () => {
    expect(parseQcSpecConstraint('MIX 50 GM OF GLYCERINE WITH WATER')).toBeNull();
  });
});

describe('parseMeasuredValue', () => {
  it('accepts a number, with or without a unit', () => {
    expect(parseMeasuredValue('1200')).toBe(1200);
    expect(parseMeasuredValue('5.8')).toBe(5.8);
    expect(parseMeasuredValue('99.7%')).toBe(99.7);
    expect(parseMeasuredValue('-1')).toBe(-1);
  });

  it('rejects text that is not a measurement', () => {
    expect(parseMeasuredValue('fafa')).toBeNull();
    expect(parseMeasuredValue('Pass')).toBeNull();
    expect(parseMeasuredValue('')).toBeNull();
  });
});

describe('deriveAutoPassedFromResult — the reported rows', () => {
  it('fails a value outside the range', () => {
    expect(auto('1100 - 1500', '-1')).toBe(false);
    expect(auto('38 - 43', '-50')).toBe(false);
    expect(auto('1.258 to 1.268 g/mL ( 20°C).', '1.9')).toBe(false);
  });

  it('passes a value inside the range', () => {
    expect(auto('1100 - 1500', '1200')).toBe(true);
    expect(auto('38 - 43', '40')).toBe(true);
    expect(auto('5.5 - 7.5', '5.8')).toBe(true);
  });

  it('honours the bound direction', () => {
    expect(auto('≥ 99.5%', '99.7')).toBe(true);
    expect(auto('≥ 99.5%', '98')).toBe(false);
    expect(auto('≤ 0.1%', '0.05')).toBe(true);
    expect(auto('≤ 0.1%', '0.9')).toBe(false);
  });

  it('treats boundary values as passing', () => {
    expect(auto('≥ 99.5%', '99.5')).toBe(true);
    expect(auto('≤ 0.1%', '0.1')).toBe(true);
    expect(auto('38 - 43', '38')).toBe(true);
    expect(auto('38 - 43', '43')).toBe(true);
  });

  it('leaves a numeric spec AWAITING when the entry is not a measurement', () => {
    // Not a pass: garbage against a numeric spec is an invalid entry, and awaiting blocks completion.
    expect(auto('≥ 99.5%', 'fa')).toBeNull();
    expect(auto('1100 - 1500', 'fafa')).toBeNull();
  });

  it('still passes a descriptive spec with a text answer', () => {
    expect(auto('COLORLESS TO NEAR COLORLESS', 'colourless', { outputType: 'textarea' })).toBe(true);
  });

  it('leaves explicit pass/fail entries alone', () => {
    expect(auto('23', 'Pass', { outputType: 'pass-fail' })).toBe(true);
    expect(auto('23', 'Fail', { outputType: 'pass-fail' })).toBe(false);
  });

  it('applies tolerance to an exact target', () => {
    expect(auto('100', '102', { tolerance: '5' })).toBe(true);
    expect(auto('100', '110', { tolerance: '5' })).toBe(false);
  });
});

/* ── A mandatory failure must block acceptance ───────────────────────────── */
import { grnQcCompletionBlockers, mandatoryQcFailures } from '../grnQcSpecs';

const specs = (tests: unknown[]) => ({ lines: [{ lineItemId: 'L1', tests }] }) as never;
const t = (over: Record<string, unknown>) => ({
  specId: 's', parameter: 'p', specLimit: '38 - 43', result: '40', passed: true, mandatory: true, ...over,
});

describe('mandatory QC failures', () => {
  it('blocks acceptance and names the failing parameters', () => {
    const payload = specs([t({ parameter: 'VISCOSITY', result: '-1', passed: false })]);
    expect(mandatoryQcFailures(payload)).toHaveLength(1);
    const blockers = grnQcCompletionBlockers(payload);
    expect(blockers.join(' ')).toContain('mandatory QC test(s) failed');
    expect(blockers.join(' ')).toContain('VISCOSITY');
    expect(blockers.join(' ')).toContain('cannot be accepted');
  });

  it('separates an optional failure from a mandatory one', () => {
    const payload = specs([t({ parameter: 'ODOUR', passed: false, mandatory: false })]);
    expect(mandatoryQcFailures(payload)).toHaveLength(0);
    expect(grnQcCompletionBlockers(payload).join(' ')).toContain('1 QC test(s) failed');
  });

  it('does not block when every mandatory test passes', () => {
    expect(mandatoryQcFailures(specs([t({})]))).toHaveLength(0);
    expect(grnQcCompletionBlockers(specs([t({})]))).toEqual([]);
  });
});
