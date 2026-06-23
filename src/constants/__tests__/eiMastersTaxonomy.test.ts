import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { EI_TAX_PM, EI_TAX_RM } from '../eiMastersUnifiedSchema';

const HTML_PATH = path.join(
  process.env.HOME || '',
  'Downloads',
  'EI_Masters_PM_v4g.html'
);

function loadHtmlTax(): { RM: Record<string, Record<string, readonly string[]>>; PM: Record<string, Record<string, readonly string[]>> } | null {
  if (!fs.existsSync(HTML_PATH)) return null;
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const start = html.indexOf('const TAX=');
  const end = html.indexOf('};\nconst MM', start);
  if (start < 0 || end < 0) return null;
  const expr = html.slice(start + 'const TAX='.length, end + 1);
  return vm.runInNewContext(`(${expr})`);
}

describe('EI masters taxonomy vs HTML TAX', () => {
  const htmlTax = loadHtmlTax();

  it.skipIf(!htmlTax)('RM taxonomy matches HTML', () => {
    expect(EI_TAX_RM).toEqual(htmlTax!.RM);
  });

  it.skipIf(!htmlTax)('PM taxonomy matches HTML', () => {
    expect(EI_TAX_PM).toEqual(htmlTax!.PM);
  });

  it('RM has three top-level categories', () => {
    expect(Object.keys(EI_TAX_RM).sort()).toEqual([
      'COLOURS',
      'FRAGRANCES / PERFUMES',
      'RAW MATERIALS',
    ]);
  });

  it('PM has six top-level categories', () => {
    expect(Object.keys(EI_TAX_PM).length).toBe(6);
  });
});
