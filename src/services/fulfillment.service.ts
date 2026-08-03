import { api } from '../lib/apiClient';
import type {
  SaleOrder, PickData, InvoiceData, ShipData, DeliveryData, BatchSplit, BatchTimelineStep,
  SODashboardRow, BatchDashboardRow, CommentFeedItem, CommercialStatus, DashboardPageMeta,
} from '../types/orderFulfillment';

const BASE = '/api/v1/fulfillment';

const TIMELINE_FLOW: BatchTimelineStep['key'][] = [
  'planned',
  'in_production',
  'fg_ready',
  'picking',
  'invoiced',
  'shipped',
  'delivered',
];

function timelineCursorFromSplit(split: BatchSplit): BatchTimelineStep['key'] {
  const ff = String(split.ffStatus || '').toLowerCase();
  if (ff === 'delivered' || ff === 'closed') return 'delivered';
  if (ff === 'shipped') return 'shipped';
  if (ff === 'invoiced') return 'invoiced';
  if (ff === 'picking') return 'picking';
  if (ff === 'fg_ready') return 'fg_ready';
  return 'in_production';
}

export function buildBatchTimelineSteps(split: BatchSplit): BatchTimelineStep[] {
  const activeKey = timelineCursorFromSplit(split);
  const activeIdx = TIMELINE_FLOW.indexOf(activeKey);
  return TIMELINE_FLOW.map((key, idx) => ({
    key,
    label:
      key === 'planned' ? 'Planned'
        : key === 'in_production' ? 'In Production'
          : key === 'fg_ready' ? 'FG Ready'
            : key === 'picking' ? 'Picking'
              : key === 'invoiced' ? 'Invoiced'
                : key === 'shipped' ? 'Shipped'
                  : 'Delivered',
    status: idx < activeIdx ? 'done' : idx === activeIdx ? 'active' : 'pending',
  }));
}

/** Normalize GET payloads whether the API returns a raw array or a wrapped `{ data: [...] }`. */
function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object' && 'data' in res) {
    const d = (res as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

function compactSpaces(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickFirstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const normalized = compactSpaces(value);
    if (normalized) return normalized;
  }
  return '';
}

function normalizeSaleOrder(order: SaleOrder | Record<string, unknown>): SaleOrder {
  const raw = order as SaleOrder & {
    clientName?: string;
    customerName?: string;
    client?: string;
    client_name?: string;
    customer_name?: string;
    city?: string;
    customer_city?: string;
    so_no?: string;
    so_date?: string;
    order_date?: string;
    due_date?: string;
    so_status?: string;
    so_value?: number;
    ship_address?: string;
    payment_terms?: string;
    invoice_no?: string;
    invoice_date?: string;
    awb_no?: string;
    dispatch_date?: string;
    zoho_invoice_id?: string;
  };
  const customer = pickFirstNonEmpty(
    raw.customer,
    raw.clientName,
    raw.customerName,
    raw.client,
    raw.client_name,
    raw.customer_name
  );
  const customerCity = pickFirstNonEmpty(raw.customerCity, raw.city, raw.customer_city);
  return {
    ...raw,
    soNo: pickFirstNonEmpty(raw.soNo, raw.so_no),
    soDate: pickFirstNonEmpty(raw.soDate, raw.so_date, raw.orderDate, raw.order_date),
    orderDate: pickFirstNonEmpty(raw.orderDate, raw.order_date, raw.soDate, raw.so_date),
    dueDate: pickFirstNonEmpty(raw.dueDate, raw.due_date),
    soStatus: (pickFirstNonEmpty(raw.soStatus, raw.so_status) || 'planned') as SaleOrder['soStatus'],
    soValue: Number(raw.soValue ?? raw.so_value ?? 0) || 0,
    shipAddress: pickFirstNonEmpty(raw.shipAddress, raw.ship_address),
    paymentTerms: pickFirstNonEmpty(raw.paymentTerms, raw.payment_terms),
    invoiceNo: pickFirstNonEmpty(raw.invoiceNo, raw.invoice_no) || undefined,
    invoiceDate: pickFirstNonEmpty(raw.invoiceDate, raw.invoice_date) || undefined,
    awbNo: pickFirstNonEmpty(raw.awbNo, raw.awb_no) || undefined,
    dispatchDate: pickFirstNonEmpty(raw.dispatchDate, raw.dispatch_date) || undefined,
    zohoInvoiceId: pickFirstNonEmpty(
      (raw as Record<string, unknown>).zohoInvoiceId,
      raw.zoho_invoice_id
    ) || undefined,
    customer: customer || 'Unknown Client',
    customerCity: customerCity || '',
  } as SaleOrder;
}

/* ── List / Get ── */

export async function fetchFulfillmentOrders(): Promise<SaleOrder[]> {
  const res = await api.get<unknown>(BASE);
  return unwrapList<SaleOrder>(res).map((order) => normalizeSaleOrder(order));
}

export async function fetchFulfillmentOrderById(id: number): Promise<SaleOrder | null> {
  try {
    const res = await api.get<SaleOrder>(`${BASE}/${id}`);
    const payload = ((res as { data?: SaleOrder })?.data ?? res) ?? null;
    return payload ? normalizeSaleOrder(payload) : null;
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
  return normalizeSaleOrder((res as { data?: SaleOrder })?.data ?? res);
}

export async function updateFulfillmentOrder(
  id: number,
  payload: Record<string, unknown>
): Promise<SaleOrder & { warning?: string }> {
  const res = await api.patch<SaleOrder>(`${BASE}/${id}`, payload);
  const raw = (res as { data?: SaleOrder })?.data ?? res;
  const normalized = normalizeSaleOrder(raw);
  // Backend attaches `warning` (e.g. cancelling an SO whose batches were already sent to production).
  const warning = (raw as { warning?: string })?.warning;
  return warning ? { ...normalized, warning } : normalized;
}

export async function deleteFulfillmentOrder(id: number) {
  const res = await api.delete(`${BASE}/${id}`);
  return (res as any)?.data ?? res;
}

/* ── Lookup endpoints for AddSOModal ── */

export interface NextSoNoResponse { soNo: string; }
export interface CustomerOption {
  id: number;
  code: string;
  name: string;
  city: string;
  /** State / region (from master `location`, `data.state`, or linked `addresses`). */
  state?: string;
  location?: string;
  country?: string;
  email?: string;
  phone?: string;
  category?: string;
  notes?: string;
  priority?: string;
  segment?: string;
  contacts?: { name?: string; role?: string }[];
  contactLine?: string;
  paymentTerms: string;
  shippingAddress: string;
  billingAddress?: string;
  creditLimit?: string;
  /** Subset of vendor_clients.data for ClientForm payables + receivables credit days. */
  clientData?: Record<string, unknown>;
}
export interface ProductOption {
  id: string;
  type: string;
  name: string;
  sku: string;
  pack: string;
  category: string;
  /** MRP price from products.mrp_price — used as reference ceiling, not sale price */
  price: number;
  /** Master approval workflow status — all stages visible in SO picker */
  approvalStatus?: string;
}

export async function fetchNextSoNo(): Promise<string> {
  const res = await api.get<NextSoNoResponse>(`${BASE}/next-so-no`);
  const data = (res as any)?.data ?? res;
  return data?.soNo ?? '';
}

const VENDOR_ENTITY_CODE_PREFIX = /^EI-VEN-/i;

export async function fetchCustomers(): Promise<CustomerOption[]> {
  const res = await api.get<CustomerOption[]>(`${BASE}/customers`);
  const data = (res as any)?.data ?? res;
  if (!Array.isArray(data)) return [];
  return data.filter((row) => !VENDOR_ENTITY_CODE_PREFIX.test(String(row.code || '').trim()));
}

export async function fetchProducts(): Promise<ProductOption[]> {
  const res = await api.get<ProductOption[]>(`${BASE}/products`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

export interface StagedPaymentTermsPayload {
  advance_pct: number;
  pre_shipment_pct: number;
  post_shipment_pct: number;
  credit_days: number;
}

export interface ClientProductPriceResult {
  product_id: number;
  client_id: number;
  quantity: number;
  price_per_unit: number | null;
  currency: string;
  payment_terms: string | null;
  staged_payment_terms: StagedPaymentTermsPayload | null;
  source: string;
  items_list_id?: number | null;
  rate_id?: number | null;
  tier_id?: number | null;
  moq_min?: number | null;
  moq_max?: number | null;
  lowest_moq?: number | null;
  message?: string;
}

/** PR unit price from Items List client rate + MOQ tier (sale orders, not PO). */
export async function fetchClientProductPrice(params: {
  clientId: number;
  productId: number;
  quantity?: number;
}): Promise<ClientProductPriceResult> {
  const qs = new URLSearchParams({
    client_id: String(params.clientId),
    product_id: String(params.productId),
    quantity: String(params.quantity ?? 1),
  });
  const res = await api.get<ClientProductPriceResult>(`${BASE}/client-product-price?${qs}`);
  return ((res as { data?: ClientProductPriceResult })?.data ?? res) as ClientProductPriceResult;
}

/* ── Transporters ── */

export interface TransporterOption { id: number; name: string; code: string; phone: string; email: string; trackingUrl: string; }

export async function fetchTransporters(): Promise<TransporterOption[]> {
  const res = await api.get<TransporterOption[]>(`${BASE}/transporters`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

/* ── Invoices ── */

/** POST /fulfillment/invoices — matches backend `createInvoice` JSON body. */
export interface FulfillmentInvoiceCreateResult {
  id: number;
  invoiceNo: string;
  fulfillmentOrderId?: number;
  invoiceDate?: string;
  dueDate?: string | null;
  zoho_invoice_id?: string | null;
  zoho_sync?: { synced: boolean; error?: string };
}

export async function createInvoice(
  payload: Record<string, unknown>
): Promise<FulfillmentInvoiceCreateResult> {
  const res = await api.post<FulfillmentInvoiceCreateResult>(`${BASE}/invoices`, payload);
  return (res as { data?: FulfillmentInvoiceCreateResult })?.data ?? (res as FulfillmentInvoiceCreateResult);
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
  return normalizeSaleOrder((res as { data?: SaleOrder })?.data ?? res);
}

export async function invoiceFulfillmentSplits(id: number, data: Partial<InvoiceData>): Promise<SaleOrder> {
  const res = await api.patch<SaleOrder>(`${BASE}/${id}/invoice`, data);
  return normalizeSaleOrder((res as { data?: SaleOrder })?.data ?? res);
}

export async function shipFulfillmentSplits(id: number, data: Partial<ShipData>): Promise<SaleOrder> {
  const res = await api.patch<SaleOrder>(`${BASE}/${id}/ship`, data);
  return normalizeSaleOrder((res as { data?: SaleOrder })?.data ?? res);
}

export async function deliverFulfillmentSplits(id: number, data: Partial<DeliveryData>): Promise<SaleOrder> {
  const res = await api.patch<SaleOrder>(`${BASE}/${id}/deliver`, data);
  return normalizeSaleOrder((res as { data?: SaleOrder })?.data ?? res);
}

/* ── Planning availability for SO ── */

export interface SoPlanningBatchAvailabilityRow {
  sequence: number;
  sent: boolean;
  rmNeededTotalKg: number;
  rmRequestedTotalKg: number;
  rmRemainingTotalKg: number;
  pmNeededTotalUnits: number;
  pmRequestedTotalUnits: number;
  pmRemainingTotalUnits: number;
  rmStartable: boolean;
  pmStartable: boolean;
}

export interface SoPlanningAvailabilityItem {
  productName: string;
  sku: string;
  totalBatches: number;
  sentCount: number;
  rmStartableCount: number;
  rmStartedCount: number;
  pmStartableCount: number;
  pmStartedCount: number;
  rmLineAvailableCount?: number;
  rmLineTotalCount?: number;
  pmLineAvailableCount?: number;
  pmLineTotalCount?: number;
  batches: SoPlanningBatchAvailabilityRow[];
}

export interface SoPlanningAvailabilityResponse {
  success: boolean;
  soNo: string;
  items: SoPlanningAvailabilityItem[];
}

const soPlanningAvailabilityCache = new Map<string, SoPlanningAvailabilityResponse>();
const soPlanningAvailabilityInFlight = new Map<string, Promise<SoPlanningAvailabilityResponse>>();

/* ── Dashboard views ── */

export interface SODashboardParams {
  client_id?: string;
  status?: string[];
  date_from?: string;
  date_to?: string;
  search?: string;
  flagged_only?: boolean;
  page?: number;
  page_size?: number;
}

export interface SODashboardResponse extends DashboardPageMeta {
  rows: SODashboardRow[];
}

export async function fetchSalesOrdersDashboard(params: SODashboardParams = {}): Promise<SODashboardResponse> {
  const qs = new URLSearchParams();
  if (params.client_id) qs.set('client_id', params.client_id);
  if (params.status?.length) params.status.forEach((s) => qs.append('status', s));
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.search) qs.set('search', params.search);
  if (params.flagged_only) qs.set('flagged_only', 'true');
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  const res = await api.get<SODashboardResponse>(`${BASE}/sales-orders-dashboard?${qs}`);
  const data = (res as any)?.data ?? res;
  return { total: data.total ?? 0, page: data.page ?? 1, pageSize: data.pageSize ?? 100, rows: Array.isArray(data.rows) ? data.rows : [] };
}

/**
 * Resolve a fulfillment order id from its SO number without loading the whole order book.
 * Used for `?so=` deep links, where the target SO may not be on the currently loaded page.
 */
export async function resolveSoIdByNo(soNo: string): Promise<number | null> {
  const trimmed = soNo.trim();
  if (!trimmed) return null;
  const res = await fetchSalesOrdersDashboard({ search: trimmed, page_size: 25 });
  const exact = res.rows.find((r) => r.soNo.toLowerCase() === trimmed.toLowerCase());
  return exact?.id ?? null;
}

export interface BatchDashboardParams {
  stage?: string[];
  due_before?: string;
  due_after?: string;
  client_id?: string;
  product_id?: string;
  search?: string;
  flagged_only?: boolean;
  page?: number;
  page_size?: number;
}

export interface BatchDashboardResponse extends DashboardPageMeta {
  rows: BatchDashboardRow[];
}

export async function fetchBatchesDashboard(params: BatchDashboardParams = {}): Promise<BatchDashboardResponse> {
  const qs = new URLSearchParams();
  if (params.stage?.length) params.stage.forEach((s) => qs.append('stage', s));
  if (params.due_before) qs.set('due_before', params.due_before);
  if (params.due_after) qs.set('due_after', params.due_after);
  if (params.client_id) qs.set('client_id', params.client_id);
  if (params.product_id) qs.set('product_id', params.product_id);
  if (params.search) qs.set('search', params.search);
  if (params.flagged_only) qs.set('flagged_only', 'true');
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  const res = await api.get<BatchDashboardResponse>(`${BASE}/batches-dashboard?${qs}`);
  const data = (res as any)?.data ?? res;
  return { total: data.total ?? 0, page: data.page ?? 1, pageSize: data.pageSize ?? 200, rows: Array.isArray(data.rows) ? data.rows : [] };
}

/* ── Comments ── */

export async function fetchComments(entityType: 'so' | 'batch', entityId: number): Promise<CommentFeedItem[]> {
  const res = await api.get(`${BASE}/comments/${entityType}/${entityId}`);
  const data = (res as any)?.data ?? res;
  return Array.isArray(data) ? data : [];
}

export async function addComment(entityType: 'so' | 'batch', entityId: number, text: string): Promise<void> {
  await api.post(`${BASE}/comments/${entityType}/${entityId}`, { text });
}

export async function resolveComment(commentId: number): Promise<void> {
  await api.patch(`${BASE}/comments/${commentId}/resolve`, {});
}

/* ── Commercial status ── */

export async function updateCommercialStatus(id: number, status: CommercialStatus, reason?: string): Promise<void> {
  await api.patch(`${BASE}/${id}/commercial-status`, { status, reason });
}

/* ── Cancel / Manual Fulfill ── */

export async function cancelFulfillmentOrder(id: number): Promise<void> {
  await api.patch(`${BASE}/${id}/cancel`, {});
}

export async function manualFulfillFulfillmentOrder(id: number): Promise<void> {
  await api.patch(`${BASE}/${id}/manual-fulfill`, {});
}

export async function fetchSoPlanningAvailability(soNo: string): Promise<SoPlanningAvailabilityResponse> {
  const cacheKey = String(soNo || '').trim().toUpperCase();
  const cached = soPlanningAvailabilityCache.get(cacheKey);
  if (cached) return cached;

  const existing = soPlanningAvailabilityInFlight.get(cacheKey);
  if (existing) return existing;

  const request = api
    .get<SoPlanningAvailabilityResponse>(`${BASE}/so-planning-availability?so_no=${encodeURIComponent(soNo)}`)
    .then((res) => {
      const raw = (res as any)?.data ?? res;
      // Be defensive about response shape. Some endpoints in this codebase return wrapped payloads.
      const payload =
        (raw as any)?.items
          ? raw
          : ((raw as any)?.data?.items ? (raw as any).data : raw);

      const normalized: SoPlanningAvailabilityResponse = {
        success: Boolean((payload as any)?.success ?? true),
        soNo: String((payload as any)?.soNo ?? soNo),
        items: Array.isArray((payload as any)?.items) ? (payload as any).items : [],
      };

      soPlanningAvailabilityCache.set(cacheKey, normalized);
      return normalized;
    })
    .finally(() => {
      soPlanningAvailabilityInFlight.delete(cacheKey);
    });

  soPlanningAvailabilityInFlight.set(cacheKey, request);
  return request;
}
