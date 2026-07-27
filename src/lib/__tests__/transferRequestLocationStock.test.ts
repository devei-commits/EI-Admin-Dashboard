import { describe, expect, it } from 'vitest';
import { buildTransferLocationOptions, sihAtZoneForInventoryRow } from '../transferRequestLocationStock';
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
  it('collapses zones into facility-level options (Warehouse / ML1 / ML2)', () => {
    const options = buildTransferLocationOptions(warehouseAreas, productionAreas);
    expect(options.map((o) => o.label)).toEqual(['Warehouse', 'ML1', 'ML2']);
    // Warehouse + ML1 use real zone codes; ML2 has no zone so falls back to canonical.
    expect(options[0]?.code).toBe('LOC-RM');
    expect(options[1]?.code).toBe('LOC-ML1');
    expect(options[2]?.code).toBe('ML2');
    // Representative codes still classify to the correct stock bucket.
    const row = { whStock: 5, ml1Stock: 7, ml2Stock: 9 };
    expect(sihAtZoneForInventoryRow(row, options[0]!.code)).toBe(5);
    expect(sihAtZoneForInventoryRow(row, options[1]!.code)).toBe(7);
    expect(sihAtZoneForInventoryRow(row, options[2]!.code)).toBe(9);
  });

  it('maps SIH buckets by zone code', () => {
    const row = { whStock: 412, ml1Stock: 0, ml2Stock: 18 };
    expect(sihAtZoneForInventoryRow(row, 'LOC-RM')).toBe(412);
    expect(sihAtZoneForInventoryRow(row, 'LOC-ML1')).toBe(0);
    expect(sihAtZoneForInventoryRow(row, 'LOC-ML2')).toBe(18);
  });
});
