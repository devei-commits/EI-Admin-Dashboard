import { describe, expect, it } from 'vitest';
import {
  areMasterPreviewValuesEqual,
  buildMasterPreviewSections,
  fieldDefs,
} from '../../utils/masterSubmitPreview';

describe('buildMasterPreviewSections baseline diff', () => {
  const sectionDefs = [
    {
      title: 'Primary',
      fields: fieldDefs(['tradeCommercialName', 'subCategory'], {
        tradeCommercialName: 'Name',
        subCategory: 'Category',
      }),
    },
  ];

  it('marks changed fields with previous value', () => {
    const sections = buildMasterPreviewSections(
      { tradeCommercialName: 'xyz', subCategory: '123' },
      sectionDefs,
      { baselineFormData: { tradeCommercialName: 'abc', subCategory: '123' } }
    );
    const rows = sections[0]?.rows ?? [];
    const nameRow = rows.find((r) => r.label === 'Name');
    const catRow = rows.find((r) => r.label === 'Category');
    expect(nameRow?.value).toBe('xyz');
    expect(nameRow?.changed).toBe(true);
    expect(nameRow?.previousValue).toBe('abc');
    expect(catRow?.changed).toBeUndefined();
  });

  it('areMasterPreviewValuesEqual compares formatted values', () => {
    expect(areMasterPreviewValuesEqual(true, 'Yes')).toBe(true);
    expect(areMasterPreviewValuesEqual('abc', 'xyz')).toBe(false);
  });
});
