import { describe, expect, it } from 'vitest';
import {
  buildMaterialTypeaheadOptions,
  filterMaterialTypeaheadOptions,
} from '../materialTypeahead';

const rawMaterials = [
  {
    id: '1',
    code: '1000098',
    name: 'SLES 70%',
    inci: 'SLES 70%',
    category: 'Surfactant',
    zohoSkuCode: '',
    status: 'Active',
  },
] as const;

const packMaterials = [
  {
    id: '2',
    code: '1000123',
    description: 'CAPB',
    level: 'Primary',
    group: null,
    material: '',
    sizeSpec: '',
    pricePerPc: 0,
    moq: 0,
    leadTimeDays: 0,
    printStatus: '',
    products: [],
  },
] as const;

describe('materialTypeahead', () => {
  it('builds combined RM and PM options with name · code labels', () => {
    const options = buildMaterialTypeaheadOptions(
      rawMaterials as unknown as import('../../services/rawMaterials.service').RawMaterialRecord[],
      packMaterials as unknown as import('../../services/packMaterials.service').PackMaterialRecord[],
    );
    expect(options).toHaveLength(2);
    expect(options[0]?.label).toContain('CAPB');
    expect(options[1]?.label).toContain('SLES 70%');
    expect(options[1]?.label).toContain('1000098');
  });

  it('filters options by search query', () => {
    const options = buildMaterialTypeaheadOptions(
      rawMaterials as unknown as import('../../services/rawMaterials.service').RawMaterialRecord[],
      packMaterials as unknown as import('../../services/packMaterials.service').PackMaterialRecord[],
    );
    const filtered = filterMaterialTypeaheadOptions(options, '1000098');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.code).toBe('1000098');
  });
});
