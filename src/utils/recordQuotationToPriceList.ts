/**
 * Write a recorded vendor quotation into the Items List (vendor price list).
 * Shared by the procurement "Record Quotation → Send Email" flow: the record
 * popup collects the quote, and this runs when the RFQ email is sent, so the
 * price list is updated at send time.
 *
 * Sequence mirrors utils/syncVendorMasterToPriceList.ts:
 *   1. find (or create) the items_list row for this RM/PM master
 *   2. find (or create) the vendor rate (default rate/MOQ/lead time/terms)
 *   3. append an MOQ→price tier
 *   4. mark the originating planning quotation-ask fulfilled (when present)
 */
import {
  fetchPriceListPage,
  fetchItemListRates,
  createItemList,
  createItemListRate,
  updateItemListRate,
  createItemListTier,
} from '../services/itemsList.service';
import { updatePlanningQuotationAsk } from '../services/planningQuotationAsks.service';

export interface RecordedQuoteInput {
  vendorId: string;
  vendorName: string;
  vendorEmail?: string | null;
  pricePerUnit: number;
  moq: number;
  moqMax: number | null;
  leadTimeDays: number | null;
  /** Serialized staged payment terms JSON, or null for "as per contract". */
  paymentTerms: string | null;
  validTill: string | null;
  note: string | null;
}

export interface RecordQuotationOpts {
  itemType: 'RM' | 'PM';
  materialId: number;
  /** Planning quotation-ask id — marked fulfilled on success. Null for procurement rows. */
  askId?: number | null;
  quote: RecordedQuoteInput;
}

export async function recordQuotationToPriceList(
  opts: RecordQuotationOpts,
): Promise<{ success: boolean; error?: string }> {
  const { itemType, materialId, askId, quote } = opts;
  try {
    // 1. Locate (or create) the items_list row for this master.
    const pageRes = await fetchPriceListPage(itemType);
    if (!pageRes.success) throw new Error(pageRes.error?.message ?? 'Failed to load price list');
    const match = (pageRes.data ?? []).find((row) =>
      itemType === 'RM'
        ? Number(row.raw_material_id) === Number(materialId)
        : Number(row.pack_material_id) === Number(materialId),
    );
    let itemsListId = match?.itemsListId != null ? String(match.itemsListId) : null;
    if (!itemsListId) {
      const createRes = await createItemList({
        type: itemType,
        raw_material_id: itemType === 'RM' ? Number(materialId) : null,
        pack_material_id: itemType === 'PM' ? Number(materialId) : null,
      });
      if (!createRes.success || !createRes.data?.id) {
        throw new Error(createRes.error?.message ?? 'Failed to create price-list item');
      }
      itemsListId = String(createRes.data.id);
    }

    // 2. Find (or create) the vendor rate.
    const ratesRes = await fetchItemListRates(itemsListId);
    const existingRate = (ratesRes.data ?? []).find((r) => Number(r.vendor_id) === Number(quote.vendorId));
    let rateId: number;
    if (existingRate) {
      rateId = existingRate.id;
      const upd = await updateItemListRate(itemsListId, rateId, {
        default_rate: quote.pricePerUnit,
        default_moq: quote.moq,
        lead_time_days: quote.leadTimeDays,
        payment_terms: quote.paymentTerms,
      });
      if (!upd.success) throw new Error(upd.error?.message ?? 'Failed to update vendor rate');
    } else {
      const cr = await createItemListRate(itemsListId, {
        vendor_id: Number(quote.vendorId),
        default_rate: quote.pricePerUnit,
        default_moq: quote.moq,
        lead_time_days: quote.leadTimeDays,
        payment_terms: quote.paymentTerms,
      });
      if (!cr.success || !cr.data?.id) throw new Error(cr.error?.message ?? 'Failed to create vendor rate');
      rateId = cr.data.id;
    }

    // 3. Append the MOQ→price tier.
    const tierRes = await createItemListTier(itemsListId, rateId, {
      moq_min: quote.moq,
      moq_max: quote.moqMax,
      price_per_unit: quote.pricePerUnit,
      valid_till: quote.validTill,
      note: quote.note,
    });
    if (!tierRes.success) throw new Error(tierRes.error?.message ?? 'Failed to save price tier');

    // 4. Mark the originating planning quotation-ask fulfilled.
    if (askId != null) {
      await updatePlanningQuotationAsk(askId, { status: 'fulfilled' });
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to record quotation' };
  }
}
