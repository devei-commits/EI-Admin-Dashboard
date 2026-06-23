import { describe, expect, it } from 'vitest';
import { PR_BULK_CLEARANCE_SUB_BY_PATH } from '../../constants/eiMastersFgClearanceSpecs';
import {
  clonePrBulkClearanceSubSpecTableDefaults,
  hasPrBulkClearanceSubSpecDefaults,
} from '../../constants/prBulkClearanceSubSpecTableDefaults';

describe('fgClearanceSpecsImport', () => {
  it('loads generated bulk clearance specs for Cream', () => {
    expect(Object.keys(PR_BULK_CLEARANCE_SUB_BY_PATH)).toContain('Skin Care::Cream');
    expect(hasPrBulkClearanceSubSpecDefaults('Skin Care', 'Cream')).toBe(true);
    const rows = clonePrBulkClearanceSubSpecTableDefaults('Skin Care', 'Cream');
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.some((r) => r.parameter === 'Appearance')).toBe(true);
  });
});
