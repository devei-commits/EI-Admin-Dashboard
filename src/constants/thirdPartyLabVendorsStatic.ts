import type { ThirdPartyLabVendorOption } from '../lib/thirdPartyLabTest';

/** Fallback lab vendors when Masters API has no Lab / Testing vendors yet. */
export const STATIC_THIRD_PARTY_LAB_VENDORS: ThirdPartyLabVendorOption[] = [
  {
    id: 'static-eurofins',
    name: 'Eurofins Analytical Services',
    vendorCode: 'V-061',
    accreditation: 'NABL accredited',
    tier: '1–5 samples',
    pricePerSample: 1800,
    leadTimeDays: 5,
    lastUsed: '2026-06-12',
    city: 'Bangalore',
    paymentTerms: 'Net 30',
  },
  {
    id: 'static-sgs',
    name: 'SGS India',
    vendorCode: 'V-068',
    accreditation: 'NABL',
    tier: '1–5 samples',
    pricePerSample: 2100,
    leadTimeDays: 7,
    lastUsed: '2026-05-04',
    city: 'Hyderabad',
    paymentTerms: 'Net 30',
  },
  {
    id: 'static-spectro',
    name: 'Spectro Analytical Labs',
    vendorCode: 'V-072',
    accreditation: 'NABL',
    tier: '1–10 samples',
    pricePerSample: 1650,
    leadTimeDays: 8,
    lastUsed: '2026-03-18',
    city: 'Mumbai',
    paymentTerms: 'Net 30',
  },
];
