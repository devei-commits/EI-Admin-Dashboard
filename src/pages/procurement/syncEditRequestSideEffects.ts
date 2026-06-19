/**
 * After Edit Request save: push planned prices to linked Draft POs and Items List tiers.
 */

import type { ProcurementRequestItem } from '../../services/procurement.service';
import type { PriceListItemPage } from '../../services/itemsList.service';
import {
  createItemListTier,
  updateItemListRate,
  updateItemListTier,
} from '../../services/itemsList.service';
import { updatePurchaseOrder } from '../../services/salesPurchase.service';
import type { DraftPO } from '../../types/procurement.types';
import { moqValuesEqual } from '../../utils/moqQuantity';
import {
  assignPrItemToDraftLines,
  draftLineItemsToPurchaseOrderItems,
  parseQuantityRequested,
  recalcDraftPoLineItem,
  resolvePlannedUnitPrice,
} from './procurementDataMappers';

export interface EditRequestSyncResult {
  draftPosUpdated: number;
  itemsListTiersUpdated: number;
  warnings: string[];
}

type VendorRef = { id: string; name: string };

type TierRow = { id: number; moq_min: number; moq_max?: number | null; price_per_unit?: number };

export function findItemsListPageRow(
  line: ProcurementRequestItem,
  rmPage: PriceListItemPage[],
  pmPage: PriceListItemPage[]
): PriceListItemPage | undefined {
  const isRm =
    line.type === 'RM' ||
    (line.raw_material_id != null && Number(line.raw_material_id) > 0);
  const idToMatch = isRm ? Number(line.raw_material_id) : Number(line.pack_material_id);
  if (!Number.isFinite(idToMatch) || idToMatch <= 0) return undefined;
  const page = isRm ? rmPage : pmPage;
  return isRm
    ? page.find((p) => Number(p.raw_material_id) === idToMatch)
    : page.find((p) => Number(p.pack_material_id) === idToMatch);
}

export function resolveVendorId(vendorName: string, vendors: VendorRef[]): number | null {
  const norm = vendorName.trim().toLowerCase();
  if (!norm) return null;
  const hit = vendors.find((v) => v.name.trim().toLowerCase() === norm);
  const id = hit ? Number(hit.id) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Pick vendor tier slab for PR line qty / MOQ. */
export function pickTierForLine(
  tiers: TierRow[],
  qty: number,
  lineMoqMin?: number
): TierRow | null {
  if (!tiers.length) return null;
  const moq = lineMoqMin != null && lineMoqMin > 0 ? lineMoqMin : qty;
  if (moq > 0) {
    const byMoq = tiers.find((t) => moqValuesEqual(t.moq_min, moq));
    if (byMoq) return byMoq;
  }
  if (qty > 0) {
    const byQty = tiers.find((t) => moqValuesEqual(t.moq_min, qty));
    if (byQty) return byQty;
  }
  return tiers.slice().sort((a, b) => Number(a.moq_min) - Number(b.moq_min))[0];
}

export function applyDraftPoLinePrices(
  draft: DraftPO,
  prItems: ProcurementRequestItem[]
): { lines: DraftPO['lineItems']; changed: boolean } {
  const assigned = assignPrItemToDraftLines(draft.lineItems, prItems);
  let changed = false;
  const lines = draft.lineItems.map((line, idx) => {
    const pr = assigned[idx];
    const newPrice = pr ? resolvePlannedUnitPrice(pr) : 0;
    if (newPrice <= 0 || Math.abs(newPrice - (Number(line.pricePerUnit) || 0)) < 1e-9) return line;
    changed = true;
    return recalcDraftPoLineItem(line, { pricePerUnit: newPrice });
  });
  return { lines, changed };
}

export async function applyEditRequestSideEffects(opts: {
  requestId: string;
  prItems: ProcurementRequestItem[];
  preferredVendor: string;
  validTill: string | null;
  draftPOs: DraftPO[];
  itemsListRm: PriceListItemPage[];
  itemsListPm: PriceListItemPage[];
  vendors: VendorRef[];
}): Promise<EditRequestSyncResult> {
  const result: EditRequestSyncResult = {
    draftPosUpdated: 0,
    itemsListTiersUpdated: 0,
    warnings: [],
  };

  const prItems = opts.prItems ?? [];
  if (!prItems.length) return result;

  const vendorName = String(opts.preferredVendor ?? '').trim();
  const vendorId = resolveVendorId(vendorName, opts.vendors);
  const validTill = opts.validTill?.trim() ? opts.validTill.trim() : null;

  // —— Draft POs linked to this PR ——
  const linkedDrafts = opts.draftPOs.filter(
    (d) => String(d.requestId) === String(opts.requestId) && d.backendPoId
  );
  for (const draft of linkedDrafts) {
    const { lines, changed } = applyDraftPoLinePrices(draft, prItems);
    if (!changed) continue;
    const assigned = assignPrItemToDraftLines(lines, prItems);
    const poItems = draftLineItemsToPurchaseOrderItems(lines, prItems, assigned);
    const res = await updatePurchaseOrder(draft.backendPoId!, { items: poItems });
    if (!res.success) {
      result.warnings.push(
        `Draft PO ${draft.dpoNumber}: ${typeof res.error === 'string' ? res.error : 'failed to update rates'}`
      );
      continue;
    }
    result.draftPosUpdated += 1;
  }

  // —— Items List (preferred vendor tiers) ——
  if (!vendorId) {
    if (vendorName) {
      result.warnings.push(`Vendor "${vendorName}" not found in master — price list not updated.`);
    }
    return result;
  }

  for (const line of prItems) {
    const price = resolvePlannedUnitPrice(line);
    if (price <= 0) continue;

    const pageRow = findItemsListPageRow(line, opts.itemsListRm, opts.itemsListPm);
    const itemsListId = Number(pageRow?.itemsListId ?? 0) || 0;
    if (itemsListId <= 0) {
      result.warnings.push(
        `No Items List row for ${line.code ?? line.name ?? 'line'} — price list not updated.`
      );
      continue;
    }

    const rate =
      (pageRow?.vendorRates ?? []).find((r) => Number(r.vendor_id) === vendorId) ?? null;
    const rateId = Number(rate?.id ?? 0) || 0;
    if (rateId <= 0) {
      result.warnings.push(
        `No ${vendorName} rate on Items List for ${line.code ?? line.name ?? 'line'}.`
      );
      continue;
    }

    const qty = parseQuantityRequested(line.quantity_requested);
    const lineMoq = line.moq_min != null ? Number(line.moq_min) : undefined;
    const tiers = (rate.tiers ?? []) as TierRow[];
    let tier = pickTierForLine(tiers, qty, lineMoq);

    if (!tier) {
      const moqMin = lineMoq && lineMoq > 0 ? lineMoq : qty > 0 ? qty : 1;
      const created = await createItemListTier(String(itemsListId), rateId, {
        moq_min: moqMin,
        moq_max: null,
        price_per_unit: price,
        valid_till: validTill,
        note: 'Updated from Procurement → Edit Request',
      });
      if (!created.success) {
        result.warnings.push(`Failed to create tier for ${line.code ?? line.name ?? 'line'}.`);
        continue;
      }
      result.itemsListTiersUpdated += 1;
    } else {
      const resTier = await updateItemListTier(String(itemsListId), rateId, tier.id, {
        price_per_unit: price,
        ...(validTill ? { valid_till: validTill } : {}),
        note: 'Updated from Procurement → Edit Request',
      });
      if (!resTier.success) {
        result.warnings.push(`Failed to update tier for ${line.code ?? line.name ?? 'line'}.`);
        continue;
      }
      result.itemsListTiersUpdated += 1;
    }

    await updateItemListRate(String(itemsListId), rateId, { default_rate: price });
  }

  return result;
}
