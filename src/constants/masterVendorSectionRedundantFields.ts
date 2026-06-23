/**
 * Scalar master fields duplicated by VendorCommercialEditor (vendor rows below).
 * Hidden from schema UI and submit preview; values are derived from `vendors[]` on save when needed.
 */
export const RM_VENDOR_SECTION_REDUNDANT_FIELD_KEYS = [
  'preferredVendor',
  'alternateVendors',
  'sourcingCountryOfOrigin',
  'sourcingMoq',
  'sourcingLeadTimeDays',
  'sourcingStandardUom',
  'sourcingCurrency',
] as const;

export const PM_VENDOR_SECTION_REDUNDANT_FIELD_KEYS = [
  'preferredVendor',
  'alternateVendor',
  'moqStandard',
  'leadTimeDays',
  'standardUnitCost',
  'currency',
  'paymentTerms',
] as const;

export const RM_VENDOR_SECTION_REDUNDANT_KEY_SET = new Set<string>(RM_VENDOR_SECTION_REDUNDANT_FIELD_KEYS);
export const PM_VENDOR_SECTION_REDUNDANT_KEY_SET = new Set<string>(PM_VENDOR_SECTION_REDUNDANT_FIELD_KEYS);

type RmVendorRow = {
  name: string;
  location?: string;
  moq?: number;
  leadTime?: number;
  currency?: string;
};

type PmVendorRow = RmVendorRow;

/** Back-fill legacy scalar sourcing keys from commercial vendor rows on save. */
export function deriveRmSourcingFieldsFromVendors(
  vendors: RmVendorRow[],
  primaryUom?: string
): Record<string, string> {
  const first = vendors[0];
  if (!first?.name?.trim()) return {};
  const alternates = vendors
    .slice(1)
    .map((v) => v.name.trim())
    .filter(Boolean);
  return {
    preferredVendor: first.name.trim(),
    alternateVendors: alternates.join(', '),
    sourcingMoq: first.moq != null && first.moq > 0 ? String(first.moq) : '',
    sourcingLeadTimeDays: first.leadTime != null && first.leadTime > 0 ? String(first.leadTime) : '',
    sourcingStandardUom: String(primaryUom ?? '').trim(),
    sourcingCurrency: first.currency?.trim() || 'INR',
    sourcingCountryOfOrigin: String(first.location ?? '').trim(),
  };
}

/** Back-fill legacy scalar vendor-module keys from commercial vendor rows on save. */
export function derivePmVendorFieldsFromVendors(
  vendors: PmVendorRow[],
  paymentTerms?: string
): Record<string, string> {
  const first = vendors[0];
  if (!first?.name?.trim()) return {};
  const alternates = vendors
    .slice(1)
    .map((v) => v.name.trim())
    .filter(Boolean);
  const out: Record<string, string> = {
    preferredVendor: first.name.trim(),
    alternateVendor: alternates.join(', '),
    moqStandard: first.moq != null && first.moq > 0 ? String(first.moq) : '',
    leadTimeDays: first.leadTime != null && first.leadTime > 0 ? String(first.leadTime) : '',
    currency: first.currency?.trim() || 'INR',
  };
  if (paymentTerms?.trim()) out.paymentTerms = paymentTerms.trim();
  return out;
}
