/** PR master — manufacturing licence record per ML facility (ML1 / ML2). */

export type PrFacilityCode = 'ML1' | 'ML2';

export type PrFacilityLicenceApplicable = 'yes' | 'no' | '';

export type PrFacilityLicenceStatus = 'active' | 'expired' | 'suspended' | 'pending' | '';

export type PrFacilityLicenceRecord = {
  facilityCode: PrFacilityCode;
  /** Display label, e.g. "Hyderabad ML1 · Plot 24" */
  facilityLabel: string;
  applicable: PrFacilityLicenceApplicable;
  licenceStatus: PrFacilityLicenceStatus;
  licenceType: string;
  licenceNumber: string;
  /** ISO date string (yyyy-mm-dd) or empty */
  issuedOn: string;
  validTill: string;
  remarks: string;
};

export type PrFacilityLicenceClearance = {
  status: 'cleared' | 'blocked' | 'incomplete';
  message: string;
};
