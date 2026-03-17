import { api } from '../lib/apiClient';
import type { SaleOrder, PickData, InvoiceData, ShipData, DeliveryData } from '../types/orderFulfillment';

const BASE = '/api/v1/fulfillment';

/* ── List / Get ── */

export async function fetchFulfillmentOrders(): Promise<SaleOrder[]> {
  const res = await api.get<SaleOrder[]>(BASE);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

export async function fetchFulfillmentOrderById(id: number): Promise<SaleOrder | null> {
  try {
    const res = await api.get<SaleOrder>(`${BASE}/${id}`);
    return ((res as any)?.data ?? res) ?? null;
  } catch {
    return null;
  }
}

export async function fetchBatchSplits(): Promise<unknown[]> {
  const res = await api.get(`${BASE}/batch-splits`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

/* ── Create / Update / Delete ── */

export async function createFulfillmentOrder(payload: Record<string, unknown>): Promise<SaleOrder> {
  const res = await api.post<SaleOrder>(BASE, payload);
  return (res as any)?.data ?? res;
}

export async function updateFulfillmentOrder(id: number, payload: Record<string, unknown>): Promise<SaleOrder> {
  const res = await api.patch<SaleOrder>(`${BASE}/${id}`, payload);
  return (res as any)?.data ?? res;
}

export async function deleteFulfillmentOrder(id: number) {
  const res = await api.delete(`${BASE}/${id}`);
  return (res as any)?.data ?? res;
}

/* ── Lookup endpoints for AddSOModal ── */

export interface NextSoNoResponse { soNo: string; }
export interface CustomerOption { id: number; code: string; name: string; city: string; paymentTerms: string; shippingAddress: string; }
export interface ProductOption { id: string; type: string; name: string; sku: string; pack: string; category: string; price: number; }

export async function fetchNextSoNo(): Promise<string> {
  const res = await api.get<NextSoNoResponse>(`${BASE}/next-so-no`);
  const data = (res as any)?.data ?? res;
  return data?.soNo ?? '';
}

export async function fetchCustomers(): Promise<CustomerOption[]> {
  const res = await api.get<CustomerOption[]>(`${BASE}/customers`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

export async function fetchProducts(): Promise<ProductOption[]> {
  const res = await api.get<ProductOption[]>(`${BASE}/products`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

/* ── Transporters ── */

export interface TransporterOption { id: number; name: string; code: string; phone: string; email: string; trackingUrl: string; }

export async function fetchTransporters(): Promise<TransporterOption[]> {
  const res = await api.get<TransporterOption[]>(`${BASE}/transporters`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

/* ── Invoices ── */

export async function fetchNextInvoiceNo(): Promise<string> {
  const res = await api.get<{ invoiceNo: string }>(`${BASE}/next-invoice-no`);
  const data = (res as any)?.data ?? res;
  return data?.invoiceNo ?? '';
}

export async function createInvoice(payload: Record<string, unknown>) {
  const res = await api.post(`${BASE}/invoices`, payload);
  return (res as any)?.data ?? res;
}

export async function fetchInvoices(fulfillmentOrderId?: number) {
  const qs = fulfillmentOrderId ? `?fulfillment_order_id=${fulfillmentOrderId}` : '';
  const res = await api.get(`${BASE}/invoices${qs}`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

/* ── Workflow Actions ── */

export async function pickFulfillmentSplits(id: number, data: PickData): Promise<SaleOrder> {
  const res = await api.patch<SaleOrder>(`${BASE}/${id}/pick`, data);
  return (res as any)?.data ?? res;
}

export async function invoiceFulfillmentSplits(id: number, data: Partial<InvoiceData>): Promise<SaleOrder> {
  const res = await api.patch<SaleOrder>(`${BASE}/${id}/invoice`, data);
  return (res as any)?.data ?? res;
}

export async function shipFulfillmentSplits(id: number, data: Partial<ShipData>): Promise<SaleOrder> {
  const res = await api.patch<SaleOrder>(`${BASE}/${id}/ship`, data);
  return (res as any)?.data ?? res;
}

export async function deliverFulfillmentSplits(id: number, data: Partial<DeliveryData>): Promise<SaleOrder> {
  const res = await api.patch<SaleOrder>(`${BASE}/${id}/deliver`, data);
  return (res as any)?.data ?? res;
}
