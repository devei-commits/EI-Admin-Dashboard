import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseFormulaBomWorkbook,
  pickSummarySheetName,
  pickRmSheetName,
  pickPackSheetName,
  __testExports,
} from '../formulaBomExcelParse';

const { detectSummaryHeaders } = __testExports;

describe('formulaBomExcelParse Summary sheet', () => {
  it('detectSummaryHeaders maps expected columns', () => {
    const headerRow = [
      '#',
      'Sub-category',
      'Sub-Sub-Category',
      'Product Name',
      'SKU',
      'Pack Size',
      'Unit',
      'RM Count',
      'PM Count',
      'Batch Mult',
      'Total RM (GM)',
    ];
    const { map } = detectSummaryHeaders(headerRow);
    expect(map.category).toBe(1);
    expect(map.pr_sub_category).toBe(2);
    expect(map.product_name).toBe(3);
    expect(map.sku).toBe(4);
    expect(map.pack_size).toBe(5);
    expect(map.unit).toBe(6);
    expect(map.rm_count).toBe(7);
    expect(map.total_rm_gm).toBe(10);
  });

  it('pickSummarySheetName finds Summary tab', () => {
    expect(pickSummarySheetName(['RM BOM', 'Summary', 'PM BOM'])).toBe('Summary');
  });

  it('pickRmSheetName prefers RM BOM', () => {
    expect(pickRmSheetName(['Summary', 'RM BOM', 'PM BOM'])).toBe('RM BOM');
  });

  it('pickPackSheetName prefers PM BOM', () => {
    expect(pickPackSheetName(['Summary', 'RM BOM', 'PM BOM'])).toBe('PM BOM');
  });

  it('parseFormulaBomWorkbook fails when required sheets missing', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['SKU', 'Product Name', 'Pack Size', 'Unit'],
        ['SKU-1', 'Test', 30, 'ML'],
      ]),
      'Summary'
    );
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const parsed = parseFormulaBomWorkbook(buf);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors.some((e) => e.includes('RM BOM'))).toBe(true);
    expect(parsed.errors.some((e) => e.includes('PM BOM'))).toBe(true);
    expect(parsed.summary).toBeNull();
  });

  it('parseFormulaBomWorkbook parses Summary when all three tabs present', () => {
    const summarySheet = XLSX.utils.aoa_to_sheet([
      [
        '#',
        'Sub-category',
        'Sub-Sub-Category',
        'Product Name',
        'SKU',
        'Pack Size',
        'Unit',
        'RM Count',
        'PM Count',
        'Batch Mult',
        'Total RM (GM)',
      ],
      [1, 'Skincare', 'Serum', 'Test Serum', 'EI-TEST-001', 30, 'ML', 5, 3, 1, 33],
    ]);
    const rmSheet = XLSX.utils.aoa_to_sheet([['Placeholder']]);
    const pmSheet = XLSX.utils.aoa_to_sheet([['Placeholder']]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
    XLSX.utils.book_append_sheet(wb, rmSheet, 'RM BOM');
    XLSX.utils.book_append_sheet(wb, pmSheet, 'PM BOM');

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const parsed = parseFormulaBomWorkbook(buf);

    expect(parsed.errors).toEqual([]);
    expect(parsed.summary?.sheetName).toBe('Summary');
    expect(parsed.summary?.rows).toHaveLength(1);
    expect(parsed.summary?.rows[0]).toMatchObject({
      sku: 'EI-TEST-001',
      product_name: 'Test Serum',
      category: 'Skincare',
      pr_sub_category: 'Serum',
      pack_size: 30,
      unit: 'ML',
      rm_count: 5,
      pm_count: 3,
      total_rm_gm: 33,
    });
  });
});
