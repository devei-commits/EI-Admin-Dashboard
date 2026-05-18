/**
 * Treasury API — PO releases with payment transaction details.
 * Backend: GET /api/v1/treasury/purchase-orders
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface TreasuryPoTracking {
  poReleasedAt: string | null;
  poReleasedNote: string | null;
  advancePaidAt: string | null;
  advancePaidNote: string | null;
  paymentTransactionNo: string | null;
  paymentMode: string | null;
  paymentTransactionDate: string | null;
  vendorConfirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  grnCompleteAt: string | null;
  updatedAt: string | null;
}

export interface TreasuryPurchaseOrderRow {
  purchaseOrderId: string;
  poNumber: string;
  vendorName: string;
  paymentTerms: string;
  status: string;
  orderDate: string;
  grandTotal: number;
  items: { description: string; quantity: number; rate: number; unit: string }[];
  formData: Record<string, unknown>;
  tracking: TreasuryPoTracking | null;
  updatedAt: string | null;
}

export async function fetchTreasuryPurchaseOrders(): Promise<ServiceResult<TreasuryPurchaseOrderRow[]>> {
  try {
    const data = await api.get<TreasuryPurchaseOrderRow[]>('/api/v1/treasury/purchase-orders');
    return { data: Array.isArray(data) ? data : [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load treasury purchase orders';
    return { data: [], error: message, success: false };
  }
}
