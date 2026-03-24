/**
 * Maps backend API responses to procurement dashboard types.
 * Keeps the UI types stable while backend shapes may differ.
 */

import type { ProcurementRequest, VendorQuote, QuoteLine, Vendor, PurchaseOrder, RequestType, DraftPO, DraftPOLineItem } from '../../types/procurement.types';
import type { ProcurementRequest as BackendPR } from '../../services/procurement.service';
import type { ProcurementQuotation } from '../../services/procurementQuotations.service';
import type { VendorClientRecord } from '../../services/vendorClient.service';
import type { Order } from '../../types/salesPurchase.types';

const PR_STATUS_MAP: Record<string, ProcurementRequest['status']> = {
  Pending: 'New',
  New: 'New',
  Quoted: 'Quoted',
  'PO Draft': 'PO Draft',
  'PO Released': 'PO Released',
  'Delivery Pending': 'Delivery Pending',
};

const QUOTE_STATUS_MAP: Record<string, VendorQuote['status']> = {
  confirmed: 'Confirmed',
  not_selected: 'Not Selected',
  pending: 'Pending Review',
};

/** Backend procurement request (from /api/v1/procurement) -> ProcurementRequest */
export function mapBackendPrToRequest(pr: BackendPR & { preferredVendor?: string | null }): ProcurementRequest {
  const items = Array.isArray(pr.items) ? pr.items : [];
  const type: RequestType = (items[0]?.type === 'PM' ? 'PM' : 'RM');
  const code = `PR-REQ-${String(pr.id).padStart(3, '0')}`;
  return {
    id: String(pr.id),
    code,
    type,
    priority: (pr.priority as ProcurementRequest['priority']) ?? 'Medium',
    status: PR_STATUS_MAP[pr.status ?? ''] ?? 'New',
    items: items.map((i: { name?: string }) => i?.name ?? ''),
    dueDate: pr.requiredByDate ?? '',
    createdDate: pr.createdAt ?? '',
    requestedBy: pr.requestedBy ?? undefined,
    preferredVendor: pr.preferredVendor ?? undefined,
    batchId: pr.planningBatchId != null ? String(pr.planningBatchId) : undefined,
    itemDetails: items.map(
      (i: {
        code?: string;
        name?: string;
        quantity_requested?: number;
        unit?: string;
        raw_material_id?: number;
        pack_material_id?: number;
        type?: string;
      }) => ({
        itemCode: i?.code ?? '',
        itemName: i?.name ?? '',
        reqQty: i?.quantity_requested ?? 0,
        unit: i?.unit ?? '',
        moq: '',
        packSize: '',
        plannedPrice: 0,
        leadTimeDays: 0,
        estValue: 0,
        raw_material_id: i?.raw_material_id != null ? Number(i.raw_material_id) : undefined,
        pack_material_id: i?.pack_material_id != null ? Number(i.pack_material_id) : undefined,
        type: i?.type === 'PM' ? 'PM' : i?.type === 'FG' ? 'FG' : 'RM',
      })
    ),
    stockSummary: {
      stockInHand: 0,
      openPOQty: 0,
      inTransit: 0,
      openOrders: 0,
    },
    stockCheckAssignedTo: (pr as { stockCheckAssignedTo?: string | null }).stockCheckAssignedTo ?? undefined,
    stockCheckStatus: (pr as { stockCheckStatus?: string | null }).stockCheckStatus ?? undefined,
    stockCheckDueDate: (pr as { stockCheckDueDate?: string | null }).stockCheckDueDate ?? undefined,
    stockCheckNotes: (pr as { stockCheckNotes?: string | null }).stockCheckNotes ?? undefined,
  };
}

/** Backend procurement quotation -> VendorQuote */
export function mapBackendQuotationToQuote(
  q: ProcurementQuotation,
  requestCode?: string,
  requestType?: RequestType
): VendorQuote {
  const lines: QuoteLine[] = (q.items ?? []).map((item) => {
    const total = item.totalValue ?? item.orderQty * item.pricePerUnit;
    return {
      item: item.name,
      itemId: item.itemId,
      qty: `${item.orderQty} ${item.uom}`,
      pricePerUnit: item.pricePerUnit,
      totalValue: total,
      vsPlanned: '',
      raw_material_id: item.raw_material_id != null ? Number(item.raw_material_id) : undefined,
      pack_material_id: item.pack_material_id != null ? Number(item.pack_material_id) : undefined,
    };
  });
  const prId = q.procurementRequestId;
  return {
    id: String(q.id),
    requestId: prId != null ? String(prId) : '',
    requestCode: requestCode ?? (prId != null ? `PR-REQ-${String(prId).padStart(3, '0')}` : 'Standalone'),
    requestType: requestType ?? 'RM',
    vendor: q.vendorName ?? '',
    vendorId: String(q.vendorId),
    status: QUOTE_STATUS_MAP[q.status ?? ''] ?? 'Pending Review',
    quotedOn: q.quoteDate ?? '',
    leadTimeDays: q.leadTimeDays ?? 0,
    terms: q.paymentTerms ?? '',
    validTill: q.validTill ?? '',
    rating: 4,
    fileName: q.attachmentRef ?? '',
    note: q.notes ?? '',
    lines,
  };
}

/** VendorClientRecord (vendor only) -> Vendor (procurement) */
export function mapVendorClientToVendor(v: VendorClientRecord): Vendor {
  const category = (v.category ?? '').toUpperCase();
  const type: RequestType = category.includes('PACKAGING') || category.includes('PM') ? 'PM' : 'RM';
  const data = v.data && typeof v.data === 'object' ? v.data : {};
  const entityCode = (data as { entityCode?: string }).entityCode;
  return {
    id: String(v.id),
    vendorCode: entityCode ?? String(v.id),
    name: v.name ?? '',
    type,
    status: v.status ?? 'active',
    rating: v.rating ?? 0,
    confirmedQuotes: 0,
    posIssued: 0,
    avgLeadTime: 0,
    paymentTerms: v.paymentTerms ?? '',
    contact: '',
    email: v.email ?? '',
    phone: v.phone ?? '',
    city: v.city ?? '',
  };
}

/** Order (PO from sales-purchase API) -> PurchaseOrder */
export function mapOrderToPurchaseOrder(po: Order): PurchaseOrder {
  const items = Array.isArray(po.items) ? po.items : [];
  const totalValue = items.reduce((sum, i: any) => sum + (Number(i.rate ?? i.price ?? 0) * Number(i.quantity ?? 0)), 0);
  const expected = po.expectedShipmentDate ?? '';
  const etaDays = expected ? Math.max(0, Math.ceil((new Date(expected).getTime() - Date.now()) / 86400000)) : 0;
  const formData = po.formData && typeof po.formData === 'object' ? po.formData : {};
  return {
    id: po.id,
    vendorId: '',
    vendorName: po.vendorName ?? '',
    poNumber: po.orderId ?? po.id,
    reference: po.reference,
    itemCount: items.length,
    value: totalValue,
    date: po.orderDate ?? '',
    status: po.status ?? 'Draft',
    etaDays,
    items: items.map((i: any) => (typeof i.itemName === 'string' ? i.itemName : (typeof i.name === 'string' ? i.name : String(i.quantity ?? '')))),
    formData,
    paymentTerms: po.paymentTerms ?? (formData as any).paymentTerms,
    rawItems: items,
    expectedShipmentDate: po.expectedShipmentDate ?? '',
  };
}

/** PurchaseOrder (from API, status Draft) + requests -> DraftPO for sidebar/list */
export function mapPurchaseOrderToDraftPO(po: PurchaseOrder, requests: ProcurementRequest[]): DraftPO {
  const formData = (po.formData || {}) as { requestId?: string; requestCode?: string };
  const request = requests.find(
    (r) => r.id === formData.requestId || r.code === formData.requestCode
  );
  const type: RequestType = request?.type ?? 'RM';
  const items = Array.isArray(po.items) ? po.items : [];
  const rawItems: any[] = Array.isArray((po as any).rawItems) ? (po as any).rawItems : [];
  const lineItems: DraftPOLineItem[] = rawItems.length
    ? rawItems.map((i: any, idx: number) => {
        const qty = Number(i.quantity) || 0;
        const rate = Number(i.rate ?? i.price) || 0;
        const gstPct = Number(i.tax) || 18;
        const subtotal = qty * rate;
        const gstAmount = parseFloat((subtotal * (gstPct / 100)).toFixed(2));
        const lineTotal = parseFloat((subtotal + gstAmount).toFixed(2));
        return {
          item: i.itemName || i.name || String(items[idx] ?? ''),
          itemCode: `EI-${type}-${String(idx + 1).padStart(3, '0')}`,
          type,
          qty: String(i.quantity ?? qty),
          pricePerUnit: rate,
          gstPercent: gstPct,
          gstAmount,
          lineTotal,
        };
      })
    : items.map((name, idx) => ({
        item: typeof name === 'string' ? name : String(name),
        itemCode: `EI-${type}-${String(idx + 1).padStart(3, '0')}`,
        type,
        qty: '0',
        pricePerUnit: 0,
        gstPercent: 18,
        gstAmount: 0,
        lineTotal: 0,
      } as DraftPOLineItem));

  const subtotal = lineItems.reduce((s, l) => s + (l.lineTotal - l.gstAmount), 0);
  const gstTotal = lineItems.reduce((s, l) => s + l.gstAmount, 0);
  const grandTotal = subtotal + gstTotal;
  const backendPoId = String(po.id ?? '').replace(/^PO-/, '') || undefined;

  return {
    id: po.poNumber,
    dpoNumber: po.poNumber,
    requestId: formData.requestId ?? request?.id ?? '',
    requestCode: formData.requestCode ?? request?.code ?? po.poNumber,
    type,
    vendor: po.vendorName ?? '',
    vendorId: '',
    status: 'Pending Approval',
    createdDate: po.date ?? '',
    createdBy: 'Procurement',
    paymentTerms: po.paymentTerms ?? '',
    expectedDelivery: po.expectedShipmentDate ?? po.date ?? '',
    deliveryAddress: 'EI Plant 1, IDA Jeedimetla, Hyderabad - 500 055',
    vendorRating: 0,
    alertMessage: 'Loaded from backend.',
    alertType: 'warning',
    lineItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    gstTotal: parseFloat(gstTotal.toFixed(2)),
    grandTotal: parseFloat(grandTotal.toFixed(2)),
    backendPoId,
  };
}
