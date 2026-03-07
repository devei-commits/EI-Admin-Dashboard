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
  vendorConfirmedAt: string | null;
  vendorConfirmedNote: string | null;
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
  vendorConfirmedAt: string | null;
  vendorConfirmedNote: string | null;
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
