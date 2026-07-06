/** Esthetic Insights letterhead — matches Zoho Books tax invoice layout. */
export const EI_COMPANY_LETTERHEAD = {
  legalName: 'ESTHETIC INSIGHTS PRIVATE LIMITED',
  addressLines: [
    'Plot No.45/A Survey, Road No.55, off Medak Road',
    'Phase IV, IDA Jeedimetla, Quthbullapur Mandal',
    'Hyderabad Telangana 500055',
    'India',
  ],
  phone: '9703022266',
  gstin: '36AAECE7642R2ZX',
  placeOfSupply: 'Telangana (36)',
  qualityEmail: 'qc@estheticinsights.com',
} as const;

/** SAC for testing & analysis services (lab / QC). */
export const THIRD_PARTY_LAB_TEST_SAC = '998346';

/** Default GST rate for lab testing services (intra-state: CGST + SGST). */
export const THIRD_PARTY_LAB_GST_RATE = 18;
