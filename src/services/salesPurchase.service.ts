/**
 * Sales Orders & Purchase Orders API.
 * Backend: /api/v1/sales-orders, /api/v1/purchase-orders (CRUD).
 */

import type { ServiceResult } from '../types/api.types';
import type { Order } from '../types/salesPurchase.types';
import { api } from '../lib/apiClient';

function pickFirst(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function toOrder(row: Record<string, unknown>, type: 'SO' | 'PO'): Order {
  const orderId = pickFirst(row.order_id, row.orderId);
  const customerName = pickFirst(row.customer_name, row.customerName);
  const vendorName = pickFirst(row.vendor_name, row.vendorName);
  const orderDate = pickFirst(row.order_date, row.orderDate);
  const expectedShipmentDate = pickFirst(
    row.expected_shipment_date,
    row.expectedShipmentDate,
    (row.form_data as Record<string, unknown> | undefined)?.expected_shipment_date,
    (row.formData as Record<string, unknown> | undefined)?.expectedShipmentDate
  );
  const reference = pickFirst(row.reference);
  const paymentTerms = pickFirst(row.payment_terms, row.paymentTerms);
  const status = pickFirst(row.status) || 'Draft';
  const formData =
    row.form_data && typeof row.form_data === 'object'
      ? (row.form_data as Record<string, unknown>)
      : row.formData && typeof row.formData === 'object'
        ? (row.formData as Record<string, unknown>)
        : {};
  const orderStatus =
    row.order_status && typeof row.order_status === 'object'
      ? (row.order_status as Record<string, unknown>)
      : row.orderStatus && typeof row.orderStatus === 'object'
        ? (row.orderStatus as Record<string, unknown>)
        : { orderStatus: '', invoiced: '', payment: '', packed: '', shipped: '', deliveryMethod: '' };

  return {
    id: `${type}-${row.id ?? ''}`,
    type,
    orderId,
    customerName,
    vendorName,
    orderDate,
    expectedShipmentDate,
    reference,
    paymentTerms,
    status,
    items: Array.isArray(row.items) ? row.items : [],
    formData,
    orderStatus,
    zohoPurchaseOrderId: row.zoho_purchase_order_id ?? row.zohoPurchaseOrderId ?? null,
    zohoBillId: row.zoho_bill_id ?? row.zohoBillId ?? null,
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

/** Import sales orders from workbook sheet "Sales Order" (Zoho export) or legacy "Open SO Headers" + "Open SO Lines". */
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

export interface PrRowsExcelImportResponse {
  ok: boolean;
  error?: string;
  rows_total?: number;
  po_groups_total?: number;
  sheet?: string;
  header_row?: number;
  parse_stats?: {
    scanned_through_row?: number;
    skipped_no_identity?: number;
  } | null;
  quotation_sheet?: string | null;
  quotation_header_row?: number | null;
  quotation_rows_total?: number;
  quotation_parse_stats?: Record<string, unknown> | null;
  raw_detail_sheet?: string | null;
  raw_detail_header_row?: number | null;
  raw_detail_rows_total?: number;
  raw_detail_parse_stats?: Record<string, unknown> | null;
  summary?: {
    purchase_orders_created: number;
    purchase_orders_updated: number;
    skipped: number;
    errors: number;
  };
  row_log?: Array<{
    po_key?: string;
    excel_rows?: number[];
    action: string;
    reason?: string;
    order_id?: string;
  }>;
}

/** Import PO workbook from "PurchaseOrder" sheet (Zoho export) or legacy PR rows sheets. */
export async function importPrRowsExcel(
  file: File,
  options?: { details?: boolean },
): Promise<PrRowsExcelImportResponse> {
  const fd = new FormData();
  fd.append('file', file);
  const suffix = options?.details ? '?details=true' : '';
  return api.post<PrRowsExcelImportResponse>(
    `/api/v1/purchase-orders/import-excel${suffix}`,
    fd,
  );
}
