import type { PrFacilityLicenceRecord } from '../types/prFacilityLicence';

export const PR_FACILITY_LICENCE_TYPE_OPTIONS = [
  'Cosmetics Mfg Licence (Form COS-1)',
  'Cosmetics Mfg Licence (Form COS-2)',
  'Drug Manufacturing Licence',
  'Ayurvedic Manufacturing Licence',
  'Other',
] as const;

export const PR_FACILITY_LICENCE_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pending', label: 'Pending renewal' },
] as const;

/** Default ML slots — labels are editable per PR in the Licensing step. */
export const PR_FACILITY_LICENCE_SLOT_DEFAULTS: readonly Omit<
  PrFacilityLicenceRecord,
  'applicable' | 'licenceStatus' | 'licenceType' | 'licenceNumber' | 'issuedOn' | 'validTill' | 'remarks'
>[] = [
  {
    facilityCode: 'ML1',
    facilityLabel: 'Hyderabad ML1 · Plot 24',
  },
  {
    facilityCode: 'ML2',
    facilityLabel: 'Hyderabad ML2 · Plot 18',
  },
];
