import { describe, expect, it } from 'vitest';
import { flattenTransferZoneOptions, sihAtZoneForInventoryRow } from '../transferRequestLocationStock';
import type { FacilityAreaDTO } from '../../services/facilityAreas.service';

const warehouseAreas: FacilityAreaDTO[] = [
  {
    id: 1,
    code: 'WH-MAIN',
    name: 'Main Warehouse',
    areaType: 'warehouse',
    icon: null,
    description: null,
    zones: [
      {
        id: 10,
        code: 'LOC-RM',
        name: 'Raw Material',
        locationType: 'warehouse',
        zoneLabel: 'MW',
        icon: null,
        areaSqm: null,
        description: null,
        utilisationPct: 0,
      },
    ],
  },
];

const productionAreas: FacilityAreaDTO[] = [
  {
    id: 2,
    code: 'PROD',
    name: 'Manufacturing',
    areaType: 'production',
    icon: null,
    description: null,
    zones: [
      {
        id: 20,
        code: 'LOC-ML1',
        name: 'Manufacturing Line 1',
        locationType: 'production',
        zoneLabel: 'ML1',
        icon: null,
        areaSqm: null,
        description: null,
        utilisationPct: 0,
      },
    ],
  },
];

describe('transferRequestLocationStock', () => {
  it('flattens warehouse and production zones with short labels', () => {
    const options = flattenTransferZoneOptions(warehouseAreas, productionAreas);
    expect(options).toHaveLength(2);
    expect(options[0]?.shortLabel).toBe('MW');
    expect(options[1]?.shortLabel).toBe('ML1');
  });

  it('maps SIH buckets by zone code', () => {
    const row = { whStock: 412, ml1Stock: 0, ml2Stock: 18 };
    expect(sihAtZoneForInventoryRow(row, 'LOC-RM')).toBe(412);
    expect(sihAtZoneForInventoryRow(row, 'LOC-ML1')).toBe(0);
    expect(sihAtZoneForInventoryRow(row, 'LOC-ML2')).toBe(18);
  });
});
