import { describe, expect, it } from 'vitest';
import { buildPmTypeaheadOptions, filterPmTypeaheadOptions } from '../pmTypeahead';
import type { PackMaterialRecord } from '../../services/packMaterials.service';

const sample: PackMaterialRecord[] = [
  {
    id: '1',
    code: 'PM-001',
    description: 'Bottle 50ml',
    type: 'Primary',
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
  {
    id: '2',
    code: 'PM-002',
    description: 'Cap screw',
    type: 'Secondary',
    level: 'Secondary',
    group: null,
    material: '',
    sizeSpec: '',
    pricePerPc: 0,
    moq: 0,
    leadTimeDays: 0,
    printStatus: '',
    products: [],
  },
];

describe('pmTypeahead', () => {
  it('builds sorted options and marks excluded ids disabled', () => {
    const opts = buildPmTypeaheadOptions(sample, { excludeIds: new Set(['1']) });
    expect(opts).toHaveLength(2);
    expect(opts.find((o) => o.id === '1')?.disabled).toBe(true);
    expect(opts.find((o) => o.id === '2')?.disabled).toBe(false);
  });

  it('filters by code or description', () => {
    const opts = buildPmTypeaheadOptions(sample);
    const hits = filterPmTypeaheadOptions(opts, 'bottle');
    expect(hits).toHaveLength(1);
    expect(hits[0].code).toBe('PM-001');
  });
});
