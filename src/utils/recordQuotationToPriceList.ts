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
  updateItemListTier,
} from '../services/itemsList.service';
import { updatePlanningQuotationAsk } from '../services/planningQuotationAsks.service';

/** One MOQ→price band (Masters-style price-list tier). */
export interface QuoteBand {
  moqMin: number;
  moqMax: number | null;
  price: number;
}

export interface RecordedQuoteInput {
  vendorId: string;
  vendorName: string;
  vendorEmail?: string | null;
  /** One or more MOQ→price bands for this vendor. Must contain at least one. */
  bands: QuoteBand[];
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
  const bands = [...(quote.bands ?? [])]
    .filter((b) => Number.isFinite(b.moqMin) && b.moqMin > 0 && Number.isFinite(b.price) && b.price > 0)
    .sort((a, b) => a.moqMin - b.moqMin);
  if (bands.length === 0) {
    return { success: false, error: 'Add at least one MOQ band with a valid quantity and price.' };
  }
  const base = bands[0]; // lowest-MOQ band drives the rate default rate/MOQ
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

    // 2. Find (or create) the vendor rate. Rate-level default rate/MOQ come from the lowest band.
    const ratesRes = await fetchItemListRates(itemsListId);
    const existingRate = (ratesRes.data ?? []).find((r) => Number(r.vendor_id) === Number(quote.vendorId));
    let rateId: number;
    const existingTiers = existingRate?.tiers ?? [];
    if (existingRate) {
      rateId = existingRate.id;
      const upd = await updateItemListRate(itemsListId, rateId, {
        default_rate: base.price,
        default_moq: base.moqMin,
        lead_time_days: quote.leadTimeDays,
        payment_terms: quote.paymentTerms,
      });
      if (!upd.success) throw new Error(upd.error?.message ?? 'Failed to update vendor rate');
    } else {
      const cr = await createItemListRate(itemsListId, {
        vendor_id: Number(quote.vendorId),
        default_rate: base.price,
        default_moq: base.moqMin,
        lead_time_days: quote.leadTimeDays,
        payment_terms: quote.paymentTerms,
      });
      if (!cr.success || !cr.data?.id) throw new Error(cr.error?.message ?? 'Failed to create vendor rate');
      rateId = cr.data.id;
    }

    // 3. Upsert each MOQ→price band as a tier (update the band with a matching MOQ-min, else add it).
    for (const band of bands) {
      const existingTier = existingTiers.find((t) => Number(t.moq_min) === Number(band.moqMin)) ?? null;
      if (existingTier) {
        const upd = await updateItemListTier(itemsListId, rateId, existingTier.id, {
          moq_max: band.moqMax,
          price_per_unit: band.price,
          valid_till: quote.validTill,
          note: quote.note,
          // Whichever ask most recently (re)recorded this band now owns it for reopen-cleanup.
          source_ask_id: askId ?? null,
        });
        if (!upd.success) throw new Error(upd.error?.message ?? 'Failed to update price band');
      } else {
        const tierRes = await createItemListTier(itemsListId, rateId, {
          moq_min: band.moqMin,
          moq_max: band.moqMax,
          price_per_unit: band.price,
          valid_till: quote.validTill,
          note: quote.note,
          source_ask_id: askId ?? null,
        });
        if (!tierRes.success) throw new Error(tierRes.error?.message ?? 'Failed to save price band');
      }
    }

    // 4. Mark the originating planning quotation-ask fulfilled.
    if (askId != null) {
      await updatePlanningQuotationAsk(askId, { status: 'fulfilled' });
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to record quotation' };
  }
}
