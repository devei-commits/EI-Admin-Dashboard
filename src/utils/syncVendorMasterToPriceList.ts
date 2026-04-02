/**
 * Push vendor rows from RM/PM master form_data to Items List API (same as Items List → Add Price Tier).
 */

import {
  createItemList,
  createItemListRate,
  createItemListTier,
  fetchPriceListPage,
} from '../services/itemsList.service';
import type { VendorClientRecord } from '../services/vendorClient.service';
import type { RmCommercialVendor, PmCommercialVendor, VendorTierDraft } from '../components/VendorCommercialEditor';
import { serializeStagedPaymentTerms, validateStagedPercents } from '../lib/stagedPaymentTerms';

function tiersFromVendor(
  v: RmCommercialVendor | PmCommercialVendor,
  variant: 'rm' | 'pm'
): VendorTierDraft[] {
  const raw = v.tiers && v.tiers.length > 0 ? v.tiers : [];
  const filled = raw.filter((t) => String(t.moq).trim() && String(t.price).trim());
  if (filled.length > 0) return filled;
  const moq = String(v.moq ?? '');
  const price =
    variant === 'rm'
      ? String((v as RmCommercialVendor).unitPrice ?? '')
      : String((v as PmCommercialVendor).price ?? (v as PmCommercialVendor).unitPrice ?? '');
  if (moq.trim() && price.trim()) {
    return [{ moq, price, validTill: '', note: '' }];
  }
  return [];
}

export async function syncMasterVendorsToPriceList(opts: {
  variant: 'rm' | 'pm';
  materialId: number;
  vendors: (RmCommercialVendor | PmCommercialVendor)[];
  vendorClientList: VendorClientRecord[];
}): Promise<{ created: number; skipped: string[]; errors: string[] }> {
  const { variant, materialId, vendors, vendorClientList } = opts;
  const type = variant === 'rm' ? 'RM' : 'PM';
  const skipped: string[] = [];
  const errors: string[] = [];
  let created = 0;

  const pageRes = await fetchPriceListPage(type);
  if (!pageRes.success || !pageRes.data) {
    errors.push(pageRes.error?.message ?? 'Failed to load price list');
    return { created: 0, skipped, errors };
  }
  const match = pageRes.data.find((row) =>
    variant === 'rm'
      ? Number(row.raw_material_id) === Number(materialId)
      : Number(row.pack_material_id) === Number(materialId)
  );
  let itemsListId =
    match?.itemsListId != null ? String(match.itemsListId) : null;

  if (!itemsListId) {
    const createRes = await createItemList(
      variant === 'rm'
        ? { type: 'RM', raw_material_id: materialId, pack_material_id: null, product_id: null }
        : { type: 'PM', raw_material_id: null, pack_material_id: materialId, product_id: null }
    );
    if (createRes.success && createRes.data?.id) {
      itemsListId = createRes.data.id;
    } else {
      const msg = String(createRes.error?.message ?? '');
      const lowered = msg.toLowerCase();
      const conflict =
        lowered.includes('already') || lowered.includes('conflict') || lowered.includes('409');
      if (conflict) {
        const pageRes2 = await fetchPriceListPage(type);
        if (pageRes2.success && pageRes2.data) {
          const match2 = pageRes2.data.find((row) =>
            variant === 'rm'
              ? Number(row.raw_material_id) === Number(materialId)
              : Number(row.pack_material_id) === Number(materialId)
          );
          if (match2?.itemsListId != null) itemsListId = String(match2.itemsListId);
        }
      }
      if (!itemsListId) {
        errors.push(msg || 'Failed to create items list row');
        return { created: 0, skipped, errors };
      }
    }
  }

  for (const v of vendors) {
    const vn = v.name.trim();
    const vc =
      vendorClientList.find((x) => x.name.trim() === vn) ||
      vendorClientList.find((x) => x.name.trim().toLowerCase() === vn.toLowerCase());
    if (!vc) {
      skipped.push(`${v.name}: vendor not found in Vendor master`);
      continue;
    }
    const vendorId = parseInt(vc.id, 10);
    if (Number.isNaN(vendorId)) {
      skipped.push(`${v.name}: invalid vendor id`);
      continue;
    }
    const tierRows = tiersFromVendor(v, variant);
    if (tierRows.length === 0) {
      skipped.push(`${v.name}: no MOQ/price tiers`);
      continue;
    }
    const adv = Number(v.advancePct);
    const pre = Number(v.preShipmentPct);
    const post = Number(v.postShipmentPct);
    const pctErr = validateStagedPercents(adv, pre, post);
    if (pctErr) {
      skipped.push(`${v.name}: ${pctErr}`);
      continue;
    }
    const payment_terms = serializeStagedPaymentTerms({
      advance_pct: adv,
      pre_shipment_pct: pre,
      post_shipment_pct: post,
      credit_days: v.creditDays ? Math.max(0, parseInt(String(v.creditDays), 10) || 0) : 0,
    });
    const rateRes = await createItemListRate(String(itemsListId), {
      vendor_id: vendorId,
      currency: v.currency || 'INR',
      payment_terms,
      lead_time_days: v.leadTime != null && Number.isFinite(Number(v.leadTime)) ? Number(v.leadTime) : null,
    });
    if (!rateRes.success || !rateRes.data) {
      const msg = rateRes.error?.message ?? 'create rate failed';
      if (msg.toLowerCase().includes('already exists')) {
        skipped.push(`${v.name}: rate already exists in Items List (edit or remove there first)`);
      } else {
        errors.push(`${v.name}: ${msg}`);
      }
      continue;
    }
    const rateId = rateRes.data.id;
    for (const t of tierRows) {
      const moqMin = parseInt(String(t.moq), 10) || 1;
      const price = parseFloat(String(t.price));
      if (Number.isNaN(price)) continue;
      const tierRes = await createItemListTier(String(itemsListId!), rateId, {
        moq_min: moqMin,
        price_per_unit: price,
        valid_till: t.validTill?.trim() || null,
        note: t.note?.trim() || null,
      });
      if (!tierRes.success) {
        errors.push(`${v.name} tier MOQ ${moqMin}: ${tierRes.error?.message ?? 'tier failed'}`);
      }
    }
    created += 1;
  }

  return { created, skipped, errors };
}
