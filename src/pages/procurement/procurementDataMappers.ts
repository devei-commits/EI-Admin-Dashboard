/**
 * Maps backend API responses to procurement dashboard types.
 * Keeps the UI types stable while backend shapes may differ.
 */

import type {
  ProcurementRequest,
  VendorQuote,
  QuoteLine,
  Vendor,
  PurchaseOrder,
  RequestType,
  DraftPO,
  DraftPOLineItem,
  ItemDetail,
} from '../../types/procurement.types';
import type { ProcurementRequest as BackendPR, ProcurementRequestItem } from '../../services/procurement.service';
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

/** Qty from API: numbers, strings, comma-separated (en-IN). */
export function parseQuantityRequested(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).replace(/,/g, '').replace(/\s/g, '').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parsePlannedLineNotes(lineNotes: string | undefined): { plannedPrice: number; leadTimeDays: number } {
  const raw = String(lineNotes ?? '');
  let plannedPrice = 0;
  let leadTimeDays = 0;
  const rateMatch =
    raw.match(/Planned rate\s*[₹]?\s*([\d.,]+)/i) || raw.match(/[₹]\s*([\d.,]+)/);
  if (rateMatch) {
    const n = parseFloat(String(rateMatch[1]).replace(/,/g, ''));
    if (Number.isFinite(n)) plannedPrice = n;
  }
  const leadMatch = raw.match(/Lead:\s*(\d+)\s*d/i);
  if (leadMatch) leadTimeDays = Number(leadMatch[1]) || 0;
  return { plannedPrice, leadTimeDays };
}

/** Backend procurement request (from /api/v1/procurement) -> ProcurementRequest */
export function mapBackendPrToRequest(pr: BackendPR & { preferredVendor?: string | null }): ProcurementRequest {
  const items = Array.isArray(pr.items) ? pr.items : [];
  const hasRm = items.some(
    (i: { type?: string; raw_material_id?: number }) =>
      i?.type === 'RM' || (i?.raw_material_id != null && Number(i.raw_material_id) > 0)
  );
  const hasPm = items.some(
    (i: { type?: string; pack_material_id?: number }) =>
      i?.type === 'PM' || (i?.pack_material_id != null && Number(i.pack_material_id) > 0)
  );
  const type: RequestType = hasPm && !hasRm ? 'PM' : 'RM';
  const code = `PR-REQ-${String(pr.id).padStart(3, '0')}`;
  const itemLabels = items.map((i: { name?: string; code?: string }) => {
    const n = i?.name != null ? String(i.name).trim() : '';
    const c = i?.code != null ? String(i.code).trim() : '';
    if (n) return n;
    if (c) return c;
    return 'Item';
  });
  return {
    id: String(pr.id),
    code,
    type,
    priority: (pr.priority as ProcurementRequest['priority']) ?? 'Medium',
    status: PR_STATUS_MAP[pr.status ?? ''] ?? 'New',
    items: itemLabels,
    dueDate: pr.requiredByDate ?? '',
    createdDate: pr.createdAt ?? '',
    requestedBy: pr.requestedBy ?? undefined,
    preferredVendor: pr.preferredVendor ?? undefined,
    batchId: pr.planningBatchId != null ? String(pr.planningBatchId) : undefined,
    notes: pr.notes ?? null,
    planningSoNumber: pr.planningSoNumber ?? null,
    planningCustomerName: pr.planningCustomerName ?? null,
    planningProductName: pr.planningProductName ?? null,
    planningProductCode: pr.planningProductCode ?? null,
    itemDetails: items.map(
      (i: {
        code?: string;
        name?: string;
        quantity_requested?: number | string;
        unit?: string;
        line_notes?: string;
        moq_min?: number;
        planned_unit_price?: number;
        lead_time_days?: number;
        raw_material_id?: number;
        pack_material_id?: number;
        type?: string;
      }) => {
        const parsed = parsePlannedLineNotes(i?.line_notes);
        const fieldRate = Number(i?.planned_unit_price);
        const plannedPrice =
          Number.isFinite(fieldRate) && fieldRate > 0 ? fieldRate : parsed.plannedPrice;
        const fieldLead = Number(i?.lead_time_days);
        const leadTimeDays =
          Number.isFinite(fieldLead) && fieldLead > 0 ? fieldLead : parsed.leadTimeDays;
        const moqMin = i?.moq_min != null ? Number(i.moq_min) : NaN;
        const moqStr = Number.isFinite(moqMin) && moqMin > 0 ? String(moqMin) : '';
        const reqQty = parseQuantityRequested(i?.quantity_requested);
        const lineType: ItemDetail['type'] =
          i?.type === 'PM' ? 'PM' : i?.type === 'FG' ? 'FG' : 'RM';
        return {
          itemCode: i?.code ?? '',
          itemName: i?.name ?? '',
          reqQty,
          unit: i?.unit ?? '',
          moq: moqStr,
          packSize: '',
          plannedPrice,
          leadTimeDays,
          estValue: reqQty * plannedPrice,
          raw_material_id: i?.raw_material_id != null ? Number(i.raw_material_id) : undefined,
          pack_material_id: i?.pack_material_id != null ? Number(i.pack_material_id) : undefined,
          type: lineType,
        };
      }
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
    const ld = item.leadTimeDays ?? (item as { lead_time_days?: number }).lead_time_days;
    const leadTimeDays = ld != null && ld !== '' ? Number(ld) : undefined;
    return {
      item: item.name,
      itemId: item.itemId,
      qty: `${item.orderQty} ${item.uom}`,
      pricePerUnit: item.pricePerUnit,
      totalValue: total,
      vsPlanned: '',
      leadTimeDays: Number.isFinite(leadTimeDays) && (leadTimeDays as number) > 0 ? (leadTimeDays as number) : undefined,
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

function parseLeadDaysFromString(s: string | undefined | null): number {
  if (s == null || !String(s).trim()) return 0;
  const m = String(s).match(/(\d+)\s*[-–]?\s*(\d+)?/);
  if (!m) return 0;
  const a = parseInt(m[1], 10);
  const b = m[2] != null ? parseInt(m[2], 10) : a;
  if (!Number.isFinite(a)) return 0;
  if (!Number.isFinite(b)) return a;
  return Math.round((a + b) / 2);
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
    avgLeadTime: parseLeadDaysFromString(v.leadTime),
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
  const formData = (po.formData || {}) as {
    requestId?: string;
    requestCode?: string;
    procurementApprovalStatus?: string;
    procurementApprovedAt?: string;
  };
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
        const codeFromApi = String(i.itemCode ?? i.code ?? '').trim();
        return {
          item: i.itemName || i.name || String(items[idx] ?? ''),
          itemCode: codeFromApi || `EI-${type}-${String(idx + 1).padStart(3, '0')}`,
          type,
          qty: String(i.quantity ?? qty),
          pricePerUnit: rate,
          gstPercent: gstPct,
          gstAmount,
          lineTotal,
          ...(i.raw_material_id != null ? { raw_material_id: Number(i.raw_material_id) } : {}),
          ...(i.pack_material_id != null ? { pack_material_id: Number(i.pack_material_id) } : {}),
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

  const isSplitChildPo = /-S\d+$/i.test(String(po.poNumber ?? '').trim());
  let approvalApproved = String(formData.procurementApprovalStatus ?? '').toLowerCase() === 'approved';
  // Split POs reset approval in form_data; stale "Approved" without a timestamp should not block re-approval in the UI.
  if (isSplitChildPo && approvalApproved && (formData.procurementApprovedAt == null || formData.procurementApprovedAt === '')) {
    approvalApproved = false;
  }
  const approvedAtIso = formData.procurementApprovedAt;
  let approvedLabel = '';
  if (approvalApproved && approvedAtIso) {
    const d = new Date(approvedAtIso);
    if (!Number.isNaN(d.getTime())) {
      approvedLabel = d.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
  }

  return {
    id: po.poNumber,
    dpoNumber: po.poNumber,
    requestId: formData.requestId ?? request?.id ?? '',
    requestCode: formData.requestCode ?? request?.code ?? po.poNumber,
    type,
    vendor: po.vendorName ?? '',
    vendorId: '',
    status: approvalApproved ? 'Approved' : 'Pending Approval',
    createdDate: po.date ?? '',
    createdBy: 'Procurement',
    paymentTerms: po.paymentTerms ?? '',
    expectedDelivery: po.expectedShipmentDate ?? po.date ?? '',
    deliveryAddress: 'EI Plant 1, IDA Jeedimetla, Hyderabad - 500 055',
    vendorRating: 0,
    alertMessage: approvalApproved
      ? `Approved on ${approvedLabel || '—'}. Ready for release.`
      : 'Loaded from backend.',
    alertType: approvalApproved ? 'ok' : 'warning',
    lineItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    gstTotal: parseFloat(gstTotal.toFixed(2)),
    grandTotal: parseFloat(grandTotal.toFixed(2)),
    backendPoId,
  };
}

/**
 * Match a backend PR line to a draft PO line (name/code fuzzy match, same as quote/PR pairing in UI).
 */
export function matchBackendPrItemForDraftLine(
  line: DraftPOLineItem,
  prItems: ProcurementRequestItem[]
): ProcurementRequestItem | undefined {
  if (!prItems.length) return undefined;
  const nameNorm = (line.item ?? '').trim().toLowerCase();
  const codeNorm = (line.itemCode ?? '').trim().toLowerCase();
  const rm = line.raw_material_id != null ? Number(line.raw_material_id) : null;
  const pm = line.pack_material_id != null ? Number(line.pack_material_id) : null;
  if (rm != null && Number.isFinite(rm)) {
    const byRm = prItems.find((it) => it.raw_material_id != null && Number(it.raw_material_id) === rm);
    if (byRm) return byRm;
  }
  if (pm != null && Number.isFinite(pm)) {
    const byPm = prItems.find((it) => it.pack_material_id != null && Number(it.pack_material_id) === pm);
    if (byPm) return byPm;
  }
  return prItems.find((it) => {
    const inName = String(it.name ?? '').trim().toLowerCase();
    const inCode = String(it.code ?? '').trim().toLowerCase();
    if (!inName && !inCode) return false;
    return (
      (inName && (inName === nameNorm || (!!nameNorm && (nameNorm.includes(inName) || inName.includes(nameNorm))))) ||
      (!!inCode && (!!codeNorm && (inCode === codeNorm || codeNorm.includes(inCode) || inCode.includes(codeNorm))))
    );
  });
}

/**
 * One-to-one assignment of PR lines to draft PO lines (greedy, unique indices).
 * Prevents split PO halves from attaching the same PR row / master id to multiple lines.
 */
export function assignPrItemToDraftLines(
  lines: DraftPOLineItem[],
  prItems: ProcurementRequestItem[]
): (ProcurementRequestItem | undefined)[] {
  if (!prItems.length) return lines.map(() => undefined);
  const used = new Set<number>();
  const pick = (pred: (it: ProcurementRequestItem, j: number) => boolean): number | undefined => {
    for (let j = 0; j < prItems.length; j++) {
      if (used.has(j)) continue;
      if (pred(prItems[j], j)) return j;
    }
    return undefined;
  };

  return lines.map((line) => {
    const nameNorm = (line.item ?? '').trim().toLowerCase();
    const codeNorm = (line.itemCode ?? '').trim().toLowerCase();
    const rm = line.raw_material_id != null ? Number(line.raw_material_id) : null;
    const pm = line.pack_material_id != null ? Number(line.pack_material_id) : null;

    let j: number | undefined;
    if (rm != null && Number.isFinite(rm)) {
      j = pick((it) => it.raw_material_id != null && Number(it.raw_material_id) === rm);
    }
    if (j === undefined && pm != null && Number.isFinite(pm)) {
      j = pick((it) => it.pack_material_id != null && Number(it.pack_material_id) === pm);
    }
    if (j === undefined && codeNorm) {
      j = pick((it) => {
        const inCode = String(it.code ?? '').trim().toLowerCase();
        return !!inCode && (inCode === codeNorm || codeNorm.includes(inCode) || inCode.includes(codeNorm));
      });
    }
    if (j === undefined) {
      j = pick((it) => {
        const inName = String(it.name ?? '').trim().toLowerCase();
        const inCode = String(it.code ?? '').trim().toLowerCase();
        if (!inName && !inCode) return false;
        return (
          (inName && (inName === nameNorm || (!!nameNorm && (nameNorm.includes(inName) || inName.includes(nameNorm))))) ||
          (!!inCode && (!!codeNorm && (inCode === codeNorm || codeNorm.includes(inCode) || inCode.includes(codeNorm))))
        );
      });
    }
    if (j !== undefined) {
      used.add(j);
      return prItems[j];
    }
    return undefined;
  });
}

/** Build purchase_orders.items payload from draft lines (optionally enrich ids from PR). */
export function draftLineItemsToPurchaseOrderItems(
  lines: DraftPOLineItem[],
  prItems?: ProcurementRequestItem[],
  preAssigned?: (ProcurementRequestItem | undefined)[]
): Record<string, unknown>[] {
  const assigned: (ProcurementRequestItem | undefined)[] =
    preAssigned && preAssigned.length === lines.length
      ? preAssigned
      : prItems?.length && lines.length
        ? assignPrItemToDraftLines(lines, prItems)
        : [];
  return lines.map((l, idx) => {
    const src = assigned[idx];
    return {
      itemName: l.item,
      itemCode: l.itemCode,
      quantity: l.qty,
      rate: String(l.pricePerUnit),
      tax: String(l.gstPercent || 18),
      ...(src?.raw_material_id != null ? { raw_material_id: Number(src.raw_material_id) } : {}),
      ...(src?.pack_material_id != null ? { pack_material_id: Number(src.pack_material_id) } : {}),
    };
  });
}
