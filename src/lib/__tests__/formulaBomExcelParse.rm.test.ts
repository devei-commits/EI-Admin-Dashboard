import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseRmBomBlockSheet,
  isPrBlockHeaderCell,
  extractSkuFromPrBlockHeader,
  extractProductNameFromPrBlockHeader,
  __testExports,
} from '../formulaBomExcelParse';
import type { FormulaSummaryParsedRow } from '../formulaBomExcelParse';

const {
  detectRmBomSubHeaders,
  cellToFormulaPercent,
  applyAquaSkuFromQsName,
} = __testExports;

const summaryRows: FormulaSummaryParsedRow[] = [
  {
    row_number: 2,
    sku: 'PR0006792',
    product_name: 'MAKEO ACNE AWAY PORE PERFECTING TONER 100ML',
    category: 'Face Care',
    pr_sub_category: 'Anti-acne',
    pack_size: 100,
    unit: 'ML',
    rm_count: 2,
    pm_count: 3,
    total_rm_gm: 110,
  },
  {
    row_number: 3,
    sku: 'PR0006791',
    product_name: 'MAKEO ACNE AWAY POTENT SERUM 30ML',
    category: 'Face Care',
    pr_sub_category: 'Anti-acne',
    pack_size: 30,
    unit: 'ML',
    rm_count: 1,
    pm_count: 2,
    total_rm_gm: 33,
  },
];

function buildRmBomSheet(): XLSX.WorkSheet {
  const aoa = [
    [
      'MAKEO ACNE AWAY PORE PERFECTING TONER 100ML  |  Face Care > Anti-acne  |  SKU: PR0006792  |  Pack: 100.0 ML',
      '',
      '',
      '',
      '',
      '',
    ],
    ['#', 'Component Name', 'SKU', 'Qty/Unit (KG)', 'Qty (GM)', 'Formula %'],
    ['1', 'Aqua', 'RM-WATER-001', '', '', '85'],
    ['2', 'Niacinamide', 'RM-NIA-001', '', '', '15'],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    [
      'MAKEO ACNE AWAY POTENT SERUM 30ML  |  Face Care > Anti-acne  |  SKU: PR0006791  |  Pack: 30.0 ML',
      '',
      '',
      '',
      '',
      '',
    ],
    ['#', 'Component Name', 'SKU', 'Qty/Unit (KG)', 'Qty (GM)', 'Formula %'],
    ['1', 'Glycerin', 'RM-GLY-001', '', '', '100'],
  ];
  return XLSX.utils.aoa_to_sheet(aoa);
}

describe('formulaBomExcelParse RM BOM block layout', () => {
  it('detects PR block header and extracts SKU / name', () => {
    const header =
      'MAKEO ACNE AWAY PORE PERFECTING TONER 100ML  |  Face Care > Anti-acne  |  SKU: PR0006792  |  Pack: 100.0 ML';
    expect(isPrBlockHeaderCell(header)).toBe(true);
    expect(extractSkuFromPrBlockHeader(header)).toBe('PR0006792');
    expect(extractProductNameFromPrBlockHeader(header)).toBe(
      'MAKEO ACNE AWAY PORE PERFECTING TONER 100ML'
    );
  });

  it('applyAquaSkuFromQsName maps AQUA (q.s. to 100%) to master code 1000612', () => {
    expect(applyAquaSkuFromQsName('', 'AQUA (q.s. to 100%)')).toBe('1000612');
    expect(applyAquaSkuFromQsName('RM-WATER-001', 'Aqua')).toBe('RM-WATER-001');
  });

  it('parseRmBomBlockSheet assigns aqua SKU for q.s. filler row', () => {
    const summaryOneRm: FormulaSummaryParsedRow[] = [{ ...summaryRows[0], rm_count: 1 }];
    const aoa = [
      ['TEST  |  SKU: PR0006792  |  Pack: 100 ML', '', '', '', '', ''],
      ['#', 'Component Name', 'SKU', 'Qty/Unit (KG)', 'Qty (GM)', 'Formula %'],
      ['1', 'AQUA (q.s. to 100%)', '', '', '', '97'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const { rows, error } = parseRmBomBlockSheet('RM BOM', ws, summaryOneRm);
    expect(error).toBeUndefined();
    expect(rows[0]?.component_sku).toBe('1000612');
    expect(rows[0]?.component_name).toBe('AQUA (q.s. to 100%)');
  });

  it('cellToFormulaPercent keeps display % values (does not multiply 1% into 100)', () => {
    expect(cellToFormulaPercent('1.0000%')).toBe(1);
    expect(cellToFormulaPercent('0.5000%')).toBe(0.5);
    expect(cellToFormulaPercent('0.40000%')).toBe(0.4);
    expect(cellToFormulaPercent('100%')).toBe(100);
    expect(cellToFormulaPercent('85')).toBe(85);
    expect(cellToFormulaPercent(0.01)).toBe(1);
    expect(cellToFormulaPercent(0.005)).toBe(0.5);
  });

  it('parseRmBomBlockSheet preserves sub-1% formula values from percent-formatted cells', () => {
    const summaryThreeRm: FormulaSummaryParsedRow[] = [
      { ...summaryRows[0], rm_count: 3 },
    ];
    const aoa = [
      [
        'TEST PRODUCT  |  SKU: PR0006792  |  Pack: 100.0 ML',
        '',
        '',
        '',
        '',
        '',
      ],
      ['#', 'Component Name', 'SKU', 'Qty/Unit (KG)', 'Qty (GM)', 'Formula %'],
      ['1', 'Active A', 'RM-A', '', '', '1.0000%'],
      ['2', 'Active B', 'RM-B', '', '', '0.5000%'],
      ['3', 'Active C', 'RM-C', '', '', '0.40000%'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const { rows, error } = parseRmBomBlockSheet('RM BOM', ws, summaryThreeRm);
    expect(error).toBeUndefined();
    const toner = rows.filter((r) => r.composite_sku === 'PR0006792');
    expect(toner[0]?.pct_w_w).toBe(1);
    expect(toner[1]?.pct_w_w).toBe(0.5);
    expect(toner[2]?.pct_w_w).toBe(0.4);
  });

  it('detectRmBomSubHeaders maps formula columns', () => {
    const map = detectRmBomSubHeaders([
      '#',
      'Component Name',
      'SKU',
      'Qty/Unit (KG)',
      'Qty (GM)',
      'Formula %',
    ]);
    expect(map.component_name).toBe(1);
    expect(map.component_sku).toBe(2);
    expect(map.formula_pct).toBe(5);
  });

  it('parseRmBomBlockSheet reads RM lines per Summary RM Count', () => {
    const ws = buildRmBomSheet();
    const { rows, error } = parseRmBomBlockSheet('RM BOM', ws, summaryRows);
    expect(error).toBeUndefined();
    expect(rows).toHaveLength(3);

    const toner = rows.filter((r) => r.composite_sku === 'PR0006792');
    expect(toner).toHaveLength(2);
    expect(toner[0]).toMatchObject({
      component_name: 'Aqua',
      component_sku: 'RM-WATER-001',
      pct_w_w: 85,
    });
    expect(toner[1]).toMatchObject({
      component_name: 'Niacinamide',
      pct_w_w: 15,
    });

    const serum = rows.filter((r) => r.composite_sku === 'PR0006791');
    expect(serum).toHaveLength(1);
    expect(serum[0]).toMatchObject({
      component_name: 'Glycerin',
      pct_w_w: 100,
    });
  });
});
