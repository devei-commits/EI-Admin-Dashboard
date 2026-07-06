import { describe, expect, it } from 'vitest';
import { indianRupeesInWords } from '../indianRupeesInWords';

describe('indianRupeesInWords', () => {
  it('converts round rupee amounts', () => {
    expect(indianRupeesInWords(4536)).toBe('Indian Rupee Four Thousand Five Hundred Thirty Six Only');
    expect(indianRupeesInWords(3600)).toBe('Indian Rupee Three Thousand Six Hundred Only');
  });

  it('handles zero and paise', () => {
    expect(indianRupeesInWords(0)).toBe('Indian Rupee Zero Only');
    expect(indianRupeesInWords(1.5)).toBe('Indian Rupee One and Fifty Paise Only');
  });
});
