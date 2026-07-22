/**
 * PO Tracking API — status timeline for issued purchase orders.
 * Backend: /api/v1/po-tracking/purchase-order/:purchaseOrderId
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface PoTrackingRecord {
  id: string;
  purchaseOrderId: string;
  poReleasedAt: string | null;
  poReleasedNote: string | null;
  advancePaidAt: string | null;
  advancePaidNote: string | null;
  paymentTransactionNo: string | null;
  paymentMode: string | null;
  paymentTransactionDate: string | null;
  vendorConfirmedAt: string | null;
  vendorConfirmedNote: string | null;
  sentChannel: string | null;
  ackSlaDueAt: string | null;
  vendorRejectedAt: string | null;
  vendorRejectedNote: string | null;
  shippedAt: string | null;
  shippedNote: string | null;
  orderTrackingRef: string | null;
  deliveredAt: string | null;
  deliveredNote: string | null;
  underGrnAt: string | null;
  underGrnNote: string | null;
  grnCompleteAt: string | null;
  grnCompleteNote: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type PoTrackingPayload = Partial<{
  poReleasedAt: string | null;
  poReleasedNote: string | null;
  advancePaidAt: string | null;
  advancePaidNote: string | null;
  paymentTransactionNo: string | null;
  paymentMode: string | null;
  paymentTransactionDate: string | null;
  vendorConfirmedAt: string | null;
  vendorConfirmedNote: string | null;
  sentChannel: string | null;
  ackSlaDueAt: string | null;
  vendorRejectedAt: string | null;
  vendorRejectedNote: string | null;
  shippedAt: string | null;
  shippedNote: string | null;
  orderTrackingRef: string | null;
  deliveredAt: string | null;
  deliveredNote: string | null;
  underGrnAt: string | null;
  underGrnNote: string | null;
  grnCompleteAt: string | null;
  grnCompleteNote: string | null;
}>;

export async function fetchPoTracking(purchaseOrderId: string): Promise<ServiceResult<PoTrackingRecord>> {
  try {
    const data = await api.get<PoTrackingRecord>(`/api/v1/po-tracking/purchase-order/${purchaseOrderId}`);
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load PO tracking';
    return { data: null, error: message, success: false };
  }
}

/** Max ids per request — mirrors TRACKING_BATCH_MAX_IDS on the backend. */
const TRACKING_BATCH_MAX_IDS = 500;

/**
 * Batch form of {@link fetchPoTracking} — one request for many POs instead of N.
 * Ids with no tracking row yet are absent from the returned map (the batch route is
 * read-only and does not create empty rows, unlike the single-PO route).
 */
export async function fetchPoTrackingBatch(
  purchaseOrderIds: string[]
): Promise<ServiceResult<Record<string, PoTrackingRecord>>> {
  const ids = [...new Set(purchaseOrderIds.map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) return { data: {}, error: null, success: true };
  try {
    const out: Record<string, PoTrackingRecord> = {};
    for (let i = 0; i < ids.length; i += TRACKING_BATCH_MAX_IDS) {
      const chunk = ids.slice(i, i + TRACKING_BATCH_MAX_IDS);
      const res = await api.get<{ tracking: Record<string, PoTrackingRecord> }>(
        `/api/v1/po-tracking/purchase-orders?ids=${encodeURIComponent(chunk.join(','))}`
      );
      Object.assign(out, res?.tracking ?? {});
    }
    return { data: out, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load PO tracking';
    return { data: null, error: message, success: false };
  }
}

export async function updatePoTracking(
  purchaseOrderId: string,
  payload: PoTrackingPayload
): Promise<ServiceResult<PoTrackingRecord>> {
  try {
    const data = await api.put<PoTrackingRecord>(`/api/v1/po-tracking/purchase-order/${purchaseOrderId}`, payload);
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update PO tracking';
    return { data: null, error: message, success: false };
  }
}
