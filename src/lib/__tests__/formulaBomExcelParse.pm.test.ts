import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parsePmBomBlockSheet, __testExports } from '../formulaBomExcelParse';
import type { FormulaSummaryParsedRow } from '../formulaBomExcelParse';

const { detectPmBomSubHeaders } = __testExports;

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
    pm_count: 2,
    total_rm_gm: 110,
  },
];

function buildPmBomSheet(): XLSX.WorkSheet {
  const aoa = [
    [
      'MAKEO ACNE AWAY PORE PERFECTING TONER 100ML  |  Face Care > Anti-acne  |  SKU: PR0006792  |  Pack: 100.0 ML',
      '',
      '',
      '',
    ],
    ['#', 'Component Name', 'SKU', 'Qty/Unit'],
    ['1', '150ml Clear PET Pump Bottle', 'EI-PM-BTL-001', '1'],
    ['2', 'Facewash 150ml Monocarton', 'EI-PM-BOX-002', '1'],
    ['', '', '', ''],
  ];
  return XLSX.utils.aoa_to_sheet(aoa);
}

describe('formulaBomExcelParse PM BOM block layout', () => {
  it('detectPmBomSubHeaders maps Qty/Unit column', () => {
    const map = detectPmBomSubHeaders(['#', 'Component Name', 'SKU', 'Qty/Unit']);
    expect(map.component_name).toBe(1);
    expect(map.component_sku).toBe(2);
    expect(map.qty_per_unit).toBe(3);
  });

  it('parsePmBomBlockSheet reads PM lines per Summary PM Count', () => {
    const ws = buildPmBomSheet();
    const { rows, error } = parsePmBomBlockSheet('PM BOM', ws, summaryRows);
    expect(error).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      composite_sku: 'PR0006792',
      component_name: '150ml Clear PET Pump Bottle',
      component_sku: 'EI-PM-BTL-001',
      qty: 1,
      uom_raw: 'PCS',
    });
    expect(rows[1]).toMatchObject({
      component_sku: 'EI-PM-BOX-002',
      qty: 1,
    });
  });
});
