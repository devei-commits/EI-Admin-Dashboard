import { describe, expect, it } from 'vitest';
import { parseQtyLabel, parseQtyLabelInt } from '../parseQtyLabel';

describe('parseQtyLabel', () => {
  it('keeps the decimal point — the bug that inflated orders by 10^13', () => {
    // Old behaviour: "154.3999999999996".replace(/\D/g,'') === "1543999999999996"
    expect(parseQtyLabel('154.3999999999996 units')).toBeCloseTo(154.3999999999996, 10);
    expect(parseQtyLabel('154.3999999999996 units')).toBeLessThan(155);
  });

  it('reads plain integers and unit suffixes', () => {
    expect(parseQtyLabel('500')).toBe(500);
    expect(parseQtyLabel('500 units')).toBe(500);
    expect(parseQtyLabel('1.544 KG')).toBe(1.544);
    expect(parseQtyLabel('25 kg')).toBe(25);
  });

  it('ignores thousands separators instead of concatenating them', () => {
    expect(parseQtyLabel('1,536')).toBe(1536);
    expect(parseQtyLabel('1,536.5 units')).toBe(1536.5);
    expect(parseQtyLabel('1,543,999 units')).toBe(1543999);
  });

  it('handles negatives, blanks and rubbish safely', () => {
    expect(parseQtyLabel('-12.5 kg')).toBe(-12.5);
    expect(parseQtyLabel('')).toBe(0);
    expect(parseQtyLabel(null)).toBe(0);
    expect(parseQtyLabel(undefined)).toBe(0);
    expect(parseQtyLabel('units')).toBe(0);
    expect(parseQtyLabel(NaN)).toBe(0);
  });

  it('passes numbers straight through', () => {
    expect(parseQtyLabel(154.4)).toBe(154.4);
    expect(parseQtyLabel(0)).toBe(0);
  });

  it('rounds for discrete-unit callers', () => {
    expect(parseQtyLabelInt('154.3999999999996 units')).toBe(154);
    expect(parseQtyLabelInt('154.6 units')).toBe(155);
    expect(parseQtyLabelInt('500')).toBe(500);
    expect(parseQtyLabelInt('')).toBe(0);
  });

  it('never produces the runaway value the old parser did', () => {
    const labels = ['154.3999999999996 units', '1.544 KG', '1,543.99 units', '0.5 kg'];
    for (const l of labels) expect(parseQtyLabel(l)).toBeLessThan(1e6);
  });
});
