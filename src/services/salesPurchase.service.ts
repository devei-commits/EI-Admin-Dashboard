/**
 * Sales Orders & Purchase Orders API.
 * Backend: /api/v1/sales-orders, /api/v1/purchase-orders (CRUD).
 */

import type { ServiceResult } from '../types/api.types';
import type { Order } from '../types/salesPurchase.types';
import { api } from '../lib/apiClient';

function toOrder(row: any, type: 'SO' | 'PO'): Order {
  return {
    id: `${type}-${row.id}`,
    type,
    orderId: row.orderId,
    customerName: row.customerName ?? '',
    vendorName: row.vendorName ?? '',
    orderDate: row.orderDate ?? '',
    expectedShipmentDate: row.expectedShipmentDate ?? (row.formData && row.formData.expectedShipmentDate) ?? '',
    reference: row.reference ?? '',
    paymentTerms: row.paymentTerms ?? '',
    status: row.status ?? 'Draft',
    items: Array.isArray(row.items) ? row.items : [],
    formData: row.formData && typeof row.formData === 'object' ? row.formData : {},
    orderStatus: row.orderStatus && typeof row.orderStatus === 'object'
      ? row.orderStatus
      : { orderStatus: '', invoiced: '', payment: '', packed: '', shipped: '', deliveryMethod: '' },
    zohoPurchaseOrderId: row.zohoPurchaseOrderId ?? null,
    zohoBillId: row.zohoBillId ?? null,
  };
}

export async function fetchSalesOrders(): Promise<ServiceResult<Order[]>> {
  try {
    const list = await api.get<any[]>(`/api/v1/sales-orders`);
    const data = (list ?? []).map((row) => toOrder(row, 'SO'));
    return { data, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load sales orders';
    return { data: [], error: message, success: false };
  }
}

export async function fetchPurchaseOrders(): Promise<ServiceResult<Order[]>> {
  try {
    const list = await api.get<any[]>(`/api/v1/purchase-orders`);
    const data = (list ?? []).map((row) => toOrder(row, 'PO'));
    return { data, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load purchase orders';
    return { data: [], error: message, success: false };
  }
}

export async function createSalesOrder(payload: {
  orderId: string;
  customerName?: string;
  branch?: string;
  orderDate?: string;
  expectedShipmentDate?: string;
  reference?: string;
  paymentTerms?: string;
  status?: string;
  formData?: Record<string, unknown>;
  items?: unknown[];
  orderStatus?: Record<string, string>;
}): Promise<ServiceResult<Order>> {
  try {
    const row = await api.post<any>('/api/v1/sales-orders', payload);
    return { data: row ? toOrder(row, 'SO') : null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create sales order';
    return { data: null, error: message, success: false };
  }
}

export async function createPurchaseOrder(payload: {
  orderId: string;
  vendorName?: string;
  branch?: string;
  orderDate?: string;
  expectedShipmentDate?: string;
  reference?: string;
  paymentTerms?: string;
  status?: string;
  formData?: Record<string, unknown>;
  items?: unknown[];
  orderStatus?: Record<string, string>;
}): Promise<ServiceResult<Order>> {
  try {
    const row = await api.post<any>('/api/v1/purchase-orders', payload);
    return { data: row ? toOrder(row, 'PO') : null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create purchase order';
    return { data: null, error: message, success: false };
  }
}

export async function updateSalesOrder(id: string, payload: Partial<{
  orderId: string;
  customerName: string;
  branch: string;
  orderDate: string;
  expectedShipmentDate: string;
  reference: string;
  paymentTerms: string;
  status: string;
  formData: Record<string, unknown>;
  items: unknown[];
  orderStatus: Record<string, string>;
}>): Promise<ServiceResult<Order>> {
  try {
    const row = await api.put<any>(`/api/v1/sales-orders/${id}`, payload);
    return { data: row ? toOrder(row, 'SO') : null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update sales order';
    return { data: null, error: message, success: false };
  }
}

export async function updatePurchaseOrder(id: string, payload: Partial<{
  orderId: string;
  vendorName: string;
  branch: string;
  orderDate: string;
  expectedShipmentDate: string;
  reference: string;
  paymentTerms: string;
  status: string;
  formData: Record<string, unknown>;
  items: unknown[];
  orderStatus: Record<string, string>;
}>): Promise<ServiceResult<Order>> {
  try {
    const row = await api.put<any>(`/api/v1/purchase-orders/${id}`, payload);
    return { data: row ? toOrder(row, 'PO') : null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update purchase order';
    return { data: null, error: message, success: false };
  }
}

export async function deleteSalesOrder(id: string): Promise<ServiceResult<null>> {
  try {
    await api.delete(`/api/v1/sales-orders/${id}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete sales order';
    return { data: null, error: message, success: false };
  }
}

export async function deletePurchaseOrder(id: string): Promise<ServiceResult<null>> {
  try {
    await api.delete(`/api/v1/purchase-orders/${id}`);
    return { data: null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete purchase order';
    return { data: null, error: message, success: false };
  }
}

export interface OpenSoHeadersExcelImportResponse {
  ok: boolean;
  error?: string;
  rows_total?: number;
  rows_imported?: number;
  sheet?: string;
  header_row?: number;
  parse_stats?: {
    scanned_through_row?: number;
    skipped_no_identity?: number;
    zoho_overlay_unreliable?: number;
  } | null;
  summary?: {
    sales_orders_created: number;
    sales_orders_updated: number;
    skipped: number;
    errors: number;
  };
  row_log?: Array<{
    excel_row: number;
    sheet?: string;
    action: string;
    reason?: string;
    order_id?: string;
    zoho_salesorder_id?: string;
  }>;
}

/** Import sales order headers from workbook sheet "Open SO Headers". */
export async function importOpenSoHeadersExcel(
  file: File,
  options?: { details?: boolean },
): Promise<OpenSoHeadersExcelImportResponse> {
  const fd = new FormData();
  fd.append('file', file);
  const suffix = options?.details ? '?details=true' : '';
  return api.post<OpenSoHeadersExcelImportResponse>(
    `/api/v1/sales-orders/import-excel${suffix}`,
    fd,
  );
}
