/**
 * When RM/PM master is saved, vendors + tiers are synced to Items List (price list).
 * `form_data` may not always mirror full tier rows — on edit, merge Items List rates
 * so Vendor Manager shows the same MOQ/price tiers as Items List.
 */

import type { PmCommercialVendor, RmCommercialVendor, VendorTierDraft } from '../components/VendorCommercialEditor';
import { parseStagedPaymentTerms } from '../lib/stagedPaymentTerms';
import type { PriceListItemPage } from '../services/itemsList.service';
import { fetchPriceListPage } from '../services/itemsList.service';

export async function fetchPriceListRowForMaterial(
  type: 'RM' | 'PM',
  materialId: number
): Promise<PriceListItemPage | null> {
  const mid = Number(materialId);
  if (!Number.isFinite(mid)) return null;
  const res = await fetchPriceListPage(type);
  if (!res.success || !res.data?.length) return null;
  return (
    res.data.find((row) =>
      type === 'RM'
        ? Number(row.raw_material_id) === mid
        : Number(row.pack_material_id) === mid
    ) ?? null
  );
}

type VendorRateRow = PriceListItemPage['vendorRates'][number];

function tiersFromRate(rate: VendorRateRow): VendorTierDraft[] {
  return (rate.tiers || []).map((t) => ({
    moq: String(t.moq_min ?? ''),
    price: String(t.price_per_unit ?? ''),
    validTill: t.valid_till ? String(t.valid_till).slice(0, 10) : '',
    note: t.note != null ? String(t.note) : '',
  }));
}

function stagedFromRate(rate: VendorRateRow, existingAdv?: string) {
  const pt = parseStagedPaymentTerms(rate.payment_terms ?? null);
  return {
    advancePct: pt ? String(pt.advance_pct) : existingAdv ?? '',
    preShipmentPct: pt ? String(pt.pre_shipment_pct) : '',
    postShipmentPct: pt ? String(pt.post_shipment_pct) : '',
    creditDays: pt ? String(pt.credit_days) : '',
  };
}

function pmFromRate(rate: VendorRateRow, existing?: PmCommercialVendor): PmCommercialVendor {
  const tiers = tiersFromRate(rate);
  const st = stagedFromRate(rate, existing?.advancePct);
  const p0 = tiers[0] ? parseFloat(String(tiers[0].price)) : NaN;
  const m0 = tiers[0] ? parseInt(String(tiers[0].moq), 10) : NaN;
  return {
    id: existing?.id ?? `ilr-${rate.id}`,
    name: rate.vendor_name ?? existing?.name ?? '',
    location: existing?.location ?? '',
    moq: Number.isFinite(m0) ? m0 : Number(rate.default_moq ?? existing?.moq ?? 0),
    price: Number.isFinite(p0) ? p0 : Number(rate.default_rate ?? existing?.price ?? existing?.unitPrice ?? 0),
    leadTime: rate.lead_time_days ?? existing?.leadTime ?? 0,
    approved: existing?.approved ?? '',
    priceType: existing?.priceType ?? '',
    validTill: existing?.validTill ?? '',
    sampleCost: existing?.sampleCost ?? 0,
    currency: rate.currency ?? existing?.currency ?? 'INR',
    advancePct: st.advancePct,
    preShipmentPct: st.preShipmentPct,
    postShipmentPct: st.postShipmentPct,
    creditDays: st.creditDays,
    tiers: tiers.length > 0 ? tiers : undefined,
  };
}

function rmFromRate(rate: VendorRateRow, existing?: RmCommercialVendor): RmCommercialVendor {
  const tiers = tiersFromRate(rate);
  const st = stagedFromRate(rate, existing?.advancePct);
  const p0 = tiers[0] ? parseFloat(String(tiers[0].price)) : NaN;
  const m0 = tiers[0] ? parseInt(String(tiers[0].moq), 10) : NaN;
  return {
    id: existing?.id ?? `ilr-${rate.id}`,
    name: rate.vendor_name ?? existing?.name ?? '',
    location: existing?.location ?? '',
    moq: Number.isFinite(m0) ? m0 : Number(rate.default_moq ?? existing?.moq ?? 0),
    unitPrice: Number.isFinite(p0) ? p0 : Number(rate.default_rate ?? existing?.unitPrice ?? 0),
    leadTime: rate.lead_time_days ?? existing?.leadTime ?? 0,
    approved: existing?.approved ?? '',
    priceValidTill: existing?.priceValidTill ?? '',
    currency: rate.currency ?? existing?.currency ?? 'INR',
    advancePct: st.advancePct,
    preShipmentPct: st.preShipmentPct,
    postShipmentPct: st.postShipmentPct,
    creditDays: st.creditDays,
    tiers: tiers.length > 0 ? tiers : undefined,
  };
}

function nameKey(name: string): string {
  return String(name ?? '').trim().toLowerCase();
}

/** Prefer Items List vendor rates + tiers; keep form-only vendors not present on Items List. */
export function mergePmVendorsWithPriceList(
  formVendors: PmCommercialVendor[],
  priceRow: PriceListItemPage | null
): PmCommercialVendor[] {
  if (!priceRow?.vendorRates?.length) return formVendors;
  const formByName = new Map(formVendors.map((v) => [nameKey(v.name), v]));
  const used = new Set<string>();
  const fromList = priceRow.vendorRates.map((rate) => {
    const k = nameKey(rate.vendor_name ?? '');
    if (k) used.add(k);
    return pmFromRate(rate, k ? formByName.get(k) : undefined);
  });
  const extras = formVendors.filter((v) => !used.has(nameKey(v.name)));
  return [...fromList, ...extras];
}

export function mergeRmVendorsWithPriceList(
  formVendors: RmCommercialVendor[],
  priceRow: PriceListItemPage | null
): RmCommercialVendor[] {
  if (!priceRow?.vendorRates?.length) return formVendors;
  const formByName = new Map(formVendors.map((v) => [nameKey(v.name), v]));
  const used = new Set<string>();
  const fromList = priceRow.vendorRates.map((rate) => {
    const k = nameKey(rate.vendor_name ?? '');
    if (k) used.add(k);
    return rmFromRate(rate, k ? formByName.get(k) : undefined);
  });
  const extras = formVendors.filter((v) => !used.has(nameKey(v.name)));
  return [...fromList, ...extras];
}
