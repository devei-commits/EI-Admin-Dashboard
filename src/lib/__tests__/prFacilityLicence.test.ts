import { describe, expect, it } from 'vitest';
import {
  evaluatePrFacilityLicenceClearance,
  evaluatePrFacilityLicenceForMuZone,
  flattenPrFacilityLicenceRecordsForPayload,
  hydratePrFacilityLicenceRecords,
} from '../prFacilityLicence';

describe('prFacilityLicence', () => {
  const activeMl1 = {
    facilityCode: 'ML1' as const,
    facilityLabel: 'Hyderabad ML1 · Plot 24',
    applicable: 'yes' as const,
    licenceStatus: 'active' as const,
    licenceType: 'Cosmetics Mfg Licence (Form COS-1)',
    licenceNumber: 'TS-COS-2023-00214',
    issuedOn: '2023-04-10',
    validTill: '2028-04-09',
    remarks: 'Notes for production / regulatory',
  };

  it('hydrates ML1 / ML2 slots from API payload', () => {
    const rows = hydratePrFacilityLicenceRecords([activeMl1]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.facilityCode).toBe('ML1');
    expect(rows[0]?.licenceNumber).toBe('TS-COS-2023-00214');
    expect(rows[1]?.facilityCode).toBe('ML2');
  });

  it('reports cleared when applicable facility licence is active and in date', () => {
    const clearance = evaluatePrFacilityLicenceClearance([activeMl1, { ...activeMl1, facilityCode: 'ML2', applicable: 'no' }]);
    expect(clearance.status).toBe('cleared');
  });

  it('blocks production at ML1 when licence is expired', () => {
    const verdict = evaluatePrFacilityLicenceForMuZone(
      [{ ...activeMl1, licenceStatus: 'expired' }],
      'LOC-ML1'
    );
    expect(verdict.ok).toBe(false);
  });

  it('allows production at ML1 when licence is valid', () => {
    const verdict = evaluatePrFacilityLicenceForMuZone([activeMl1], 'LOC-ML1');
    expect(verdict.ok).toBe(true);
  });

  it('flattens empty facility rows out of save payload', () => {
    const out = flattenPrFacilityLicenceRecordsForPayload([
      activeMl1,
      {
        facilityCode: 'ML2',
        facilityLabel: 'Hyderabad ML2 · Plot 18',
        applicable: '',
        licenceStatus: '',
        licenceType: '',
        licenceNumber: '',
        issuedOn: '',
        validTill: '',
        remarks: '',
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.facilityCode).toBe('ML1');
  });
});
