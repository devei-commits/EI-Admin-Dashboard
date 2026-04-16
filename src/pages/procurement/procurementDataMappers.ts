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
import type { PriceListItemPage } from '../../services/itemsList.service';
import {
  serializeStagedPaymentTerms,
  resolveStagedPaymentTermsFromVendorRecord,
} from '../../lib/stagedPaymentTerms';

/** Same resolution as Items List / VendorCommercialEditor: payables in `data`, three-way line, then fallbacks. */
function buildVendorPaymentTermsForProcurement(v: VendorClientRecord): string {
  const data = v.data && typeof v.data === 'object' ? (v.data as Record<string, unknown>) : {};
  const staged = resolveStagedPaymentTermsFromVendorRecord(v.paymentTerms, data);
  const hasSplit =
    staged.advance_pct > 0 ||
    staged.pre_shipment_pct > 0 ||
    staged.post_shipment_pct > 0 ||
    staged.credit_days > 0;
  if (hasSplit) return serializeStagedPaymentTerms(staged);
  const plain = String(v.paymentTerms ?? (data as { paymentTerms?: unknown }).paymentTerms ?? '').trim();
  if (plain) return plain;
  return 'As per contract';
}

const PR_STATUS_MAP: Record<string, ProcurementRequest['status']> = {
  Pending: 'New',
  New: 'New',
  Quoted: 'Quoted',
  'PO Draft': 'PO Draft',
  'PO Released': 'PO Released',
  'Delivery Pending': 'Delivery Pending',
  /** Persisted when a PO is marked delivered → GRN from Procurement; must round-trip for Issued POs list. */
  'Under GRN': 'Under GRN',
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

/** Non-negative integer lead days from API/UI; undefined if missing or invalid. */
export function normalizeLeadTimeDays(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/,/g, ''), 10);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

/** Parse YYYY-MM-DD or ISO strings to a local calendar Date (noon) to reduce TZ drift vs UTC parsing. */
export function parseDateStringToLocalDate(raw: string | undefined | null): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const dm = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dm) {
    const y = Number(dm[1]);
    const m = Number(dm[2]) - 1;
    const d = Number(dm[3]);
    const dt = new Date(y, m, d, 12, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t;
}

export function formatDateEnInSafe(raw: string | Date | null | undefined): string {
  const d = raw instanceof Date ? raw : parseDateStringToLocalDate(String(raw ?? ''));
  if (!d) return '—';
  return d.toLocaleDateString('en-IN');
}

function normItemKeyForLead(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Issued PO ETA: PO release date + max(per-line lead days from raw PO lines, draft, quote, PR item details).
 * When no lead exists anywhere, falls back to PR due date / PO expected shipment date.
 */
export function computeIssuedPoEtaFromLeadTimes(opts: {
  today: Date;
  poReleaseDateStr: string | undefined;
  request: ProcurementRequest;
  linkedQuote: VendorQuote | undefined;
  linkedPO?: PurchaseOrder;
  draftOverlay?: DraftPO;
  lineItems: { item: string; itemCode: string }[];
}): { etaDays: number; etaDateDisplay: string; maxLeadDays: number } {
  const { today, poReleaseDateStr, request, linkedQuote, linkedPO, draftOverlay, lineItems } = opts;

  const rawArr = Array.isArray(linkedPO?.rawItems) ? (linkedPO!.rawItems as Record<string, unknown>[]) : [];
  const details = request.itemDetails ?? [];
  const quoteLines = linkedQuote?.lines ?? [];

  const leadForLineIndex = (idx: number): number | undefined => {
    const line = lineItems[idx];
    if (!line) return undefined;

    const raw = rawArr[idx] as Record<string, unknown> | undefined;
    const fromRaw = normalizeLeadTimeDays(raw?.lead_time_days ?? raw?.leadTimeDays);
    if (fromRaw !== undefined) return fromRaw;

    const dLine = draftOverlay?.lineItems?.find(
      (l) =>
        normItemKeyForLead(l.itemCode) === normItemKeyForLead(line.itemCode) ||
        (!!line.item && normItemKeyForLead(l.item) === normItemKeyForLead(line.item)),
    );
    const fromDraft = normalizeLeadTimeDays(dLine?.leadTimeDays);
    if (fromDraft !== undefined) return fromDraft;

    const qLine =
      quoteLines[idx] ??
      quoteLines.find(
        (l) =>
          normItemKeyForLead(l.item ?? '') === normItemKeyForLead(line.item) ||
          (!!l.itemId && normItemKeyForLead(String(l.itemId)) === normItemKeyForLead(line.itemCode)),
      );
    const fromQuoteLine = normalizeLeadTimeDays(qLine?.leadTimeDays);
    if (fromQuoteLine !== undefined) return fromQuoteLine;

    const fromQuoteHeader = normalizeLeadTimeDays(linkedQuote?.leadTimeDays);
    if (fromQuoteHeader !== undefined) return fromQuoteHeader;

    const det = details.find(
      (d) =>
        normItemKeyForLead(d.itemCode) === normItemKeyForLead(line.itemCode) ||
        (!!line.item && normItemKeyForLead(d.itemName) === normItemKeyForLead(line.item)),
    );
    return normalizeLeadTimeDays(det?.leadTimeDays);
  };

  let maxLead = 0;
  let anyLead = false;
  for (let i = 0; i < lineItems.length; i++) {
    const ld = leadForLineIndex(i);
    if (ld !== undefined) {
      anyLead = true;
      if (ld > maxLead) maxLead = ld;
    }
  }

  const anchor =
    parseDateStringToLocalDate(poReleaseDateStr) ??
    parseDateStringToLocalDate(request.createdDate) ??
    parseDateStringToLocalDate(linkedPO?.date) ??
    today;

  let etaDate: Date | null = null;
  if (anyLead && lineItems.length > 0) {
    etaDate = new Date(anchor.getTime());
    etaDate.setDate(etaDate.getDate() + maxLead);
  } else {
    etaDate =
      parseDateStringToLocalDate(request.dueDate) ??
      parseDateStringToLocalDate(linkedPO?.expectedShipmentDate) ??
      parseDateStringToLocalDate(linkedPO?.date);
  }

  if (!etaDate) {
    return { etaDays: 0, etaDateDisplay: '—', maxLeadDays: maxLead };
  }

  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
  const startEta = new Date(etaDate.getFullYear(), etaDate.getMonth(), etaDate.getDate(), 12, 0, 0, 0);
  const etaDays = Math.ceil((startEta.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));

  return {
    etaDays,
    etaDateDisplay: formatDateEnInSafe(etaDate),
    maxLeadDays: maxLead,
  };
}

/**
 * Single resolution order for draft PO line lead (days):
 * PR line → matched quote line → Items List vendor rate (quote-line-defaults) → quote header → 0.
 */
export function resolveDraftLineLeadTimeDays(opts: {
  prLine?: Pick<ProcurementRequestItem, 'lead_time_days'> | null;
  quoteLineLead?: number | null;
  itemsListLead?: number | null;
  quoteHeaderLead?: number | null;
}): number {
  const fromPr = normalizeLeadTimeDays(opts.prLine?.lead_time_days);
  if (fromPr !== undefined) return fromPr;
  const fromQuoteLine = normalizeLeadTimeDays(opts.quoteLineLead);
  if (fromQuoteLine !== undefined) return fromQuoteLine;
  const fromItemsList = normalizeLeadTimeDays(opts.itemsListLead);
  if (fromItemsList !== undefined) return fromItemsList;
  const fromHeader = normalizeLeadTimeDays(opts.quoteHeaderLead);
  if (fromHeader !== undefined) return fromHeader;
  return 0;
}

function parsePlannedLineNotes(lineNotes: string | undefined): { plannedPrice: number; leadTimeDays: number | null } {
  const raw = String(lineNotes ?? '');
  let plannedPrice = 0;
  let leadTimeDays: number | null = null;
  const rateMatch =
    raw.match(/Planned rate\s*[₹]?\s*([\d.,]+)/i) || raw.match(/[₹]\s*([\d.,]+)/);
  if (rateMatch) {
    const n = parseFloat(String(rateMatch[1]).replace(/,/g, ''));
    if (Number.isFinite(n)) plannedPrice = n;
  }
  const leadMatch = raw.match(/Lead:\s*(\d+)\s*d/i);
  if (leadMatch) {
    const n = Number(leadMatch[1]);
    leadTimeDays = Number.isFinite(n) && n >= 0 ? n : null;
  }
  return { plannedPrice, leadTimeDays };
}

function normVendorKey(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * When API line has no lead, resolve from Items List price-list page (same source as Planning vendor slabs).
 * Uses preferred vendor, then quote vendor as fallback (card often shows quote vendor when PR pref is empty).
 */
export function fillItemLeadFromPriceListPages(
  req: ProcurementRequest,
  itemsListRm: PriceListItemPage[],
  itemsListPm: PriceListItemPage[],
  quoteVendorFallback?: string | null
): ProcurementRequest {
  const prefRaw =
    String(req.preferredVendor ?? '').trim() || String(quoteVendorFallback ?? '').trim();
  const prefN = prefRaw ? normVendorKey(prefRaw) : '';

  const leadFromRate = (rate: { lead_time_days?: number | null }): number | undefined => {
    const lead = rate.lead_time_days;
    if (lead == null || lead === '') return undefined;
    const n = Number(lead);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const resolveFromList = (d: ItemDetail): number | undefined => {
    const lineType = d.type ?? (d.pack_material_id != null ? 'PM' : 'RM');
    const source = lineType === 'PM' ? itemsListPm : itemsListRm;
    const matched = source.find((row) => {
      if (lineType === 'PM' && d.pack_material_id != null && Number(d.pack_material_id) > 0) {
        return Number(row.pack_material_id) === Number(d.pack_material_id);
      }
      if (lineType === 'RM' && d.raw_material_id != null && Number(d.raw_material_id) > 0) {
        return Number(row.raw_material_id) === Number(d.raw_material_id);
      }
      return false;
    });
    if (!matched?.vendorRates?.length) return undefined;
    if (prefN) {
      for (const rate of matched.vendorRates) {
        const vn = normVendorKey(String(rate.vendor_name ?? ''));
        if (!vn) continue;
        if (vn === prefN || vn.includes(prefN) || prefN.includes(vn)) {
          const ld = leadFromRate(rate);
          if (ld !== undefined) return ld;
        }
      }
    }
    for (const rate of matched.vendorRates) {
      const ld = leadFromRate(rate);
      if (ld !== undefined) return ld;
    }
    return undefined;
  };

  const itemDetails = (req.itemDetails ?? []).map((d) => {
    if (d.leadTimeDays !== undefined) return d;
    const filled = resolveFromList(d);
    if (filled === undefined) return d;
    return { ...d, leadTimeDays: filled };
  });

  return { ...req, itemDetails };
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
    preferredVendor:
      (pr as { preferred_vendor?: string | null }).preferred_vendor ?? pr.preferredVendor ?? undefined,
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
        const notes = i?.line_notes ?? (i as { lineNotes?: string }).lineNotes;
        const parsed = parsePlannedLineNotes(notes);
        const fieldRate = Number(i?.planned_unit_price);
        const plannedPrice =
          Number.isFinite(fieldRate) && fieldRate > 0 ? fieldRate : parsed.plannedPrice;
        const rawLead = i?.lead_time_days;
        const fieldLead =
          rawLead !== null && rawLead !== undefined && rawLead !== ''
            ? Number(rawLead)
            : NaN;
        const leadTimeDays: number | undefined = Number.isFinite(fieldLead) && fieldLead >= 0
          ? fieldLead
          : parsed.leadTimeDays !== null && parsed.leadTimeDays !== undefined
            ? parsed.leadTimeDays
            : undefined;
        const moqMin = i?.moq_min != null ? Number(i.moq_min) : NaN;
        const moqStr = Number.isFinite(moqMin) && moqMin > 0 ? String(moqMin) : '';
        const reqQty = parseQuantityRequested(i?.quantity_requested);
        const pmIdForType = i?.pack_material_id != null ? Number(i.pack_material_id) : NaN;
        const lineType: ItemDetail['type'] =
          i?.type === 'PM' || (Number.isFinite(pmIdForType) && pmIdForType > 0)
            ? 'PM'
            : i?.type === 'FG'
              ? 'FG'
              : 'RM';
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
      leadTimeDays:
        Number.isFinite(leadTimeDays) && (leadTimeDays as number) >= 0
          ? (leadTimeDays as number)
          : undefined,
      raw_material_id: item.raw_material_id != null ? Number(item.raw_material_id) : undefined,
      pack_material_id: item.pack_material_id != null ? Number(item.pack_material_id) : undefined,
      priceHistory: Array.isArray((item as { priceHistory?: unknown[] }).priceHistory)
        ? ((item as { priceHistory?: unknown[] }).priceHistory as QuoteLine['priceHistory'])
        : undefined,
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
    paymentTerms: buildVendorPaymentTermsForProcurement(v),
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
        const leadParsed = normalizeLeadTimeDays(i.lead_time_days ?? i.leadTimeDays);
        return {
          item: i.itemName || i.name || String(items[idx] ?? ''),
          itemCode: codeFromApi || `EI-${type}-${String(idx + 1).padStart(3, '0')}`,
          type,
          qty: String(i.quantity ?? qty),
          ...(leadParsed !== undefined ? { leadTimeDays: leadParsed } : {}),
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
    // Exact name only: substring match linked "new rm mat" to "new rm mat22" and wrong split-PO master ids.
    return (
      (!!inName && !!nameNorm && inName === nameNorm) ||
      (!!inCode && !!codeNorm && (inCode === codeNorm || codeNorm.includes(inCode) || inCode.includes(codeNorm)))
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
          (!!inName && !!nameNorm && inName === nameNorm) ||
          (!!inCode && !!codeNorm && (inCode === codeNorm || codeNorm.includes(inCode) || inCode.includes(codeNorm)))
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

/** Map UI itemDetails → API-shaped PR lines so release/split can attach raw_material_id / pack_material_id to PO rows. */
export function itemDetailsToProcurementRequestItems(details: ItemDetail[]): ProcurementRequestItem[] {
  return details.map((d) => {
    const pmId = d.pack_material_id != null ? Number(d.pack_material_id) : NaN;
    const lineType: 'RM' | 'PM' =
      d.type === 'PM' || (Number.isFinite(pmId) && pmId > 0) ? 'PM' : 'RM';
    const req = Number(d.reqQty) || 0;
    return {
      type: lineType,
      code: d.itemCode ?? '',
      name: d.itemName ?? '',
      required: req,
      sih: 0,
      shortage: 0,
      quantity_requested: req,
      unit: d.unit ?? '',
      raw_material_id: d.raw_material_id != null ? Number(d.raw_material_id) : undefined,
      pack_material_id: d.pack_material_id != null ? Number(d.pack_material_id) : undefined,
    };
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
    const ld = normalizeLeadTimeDays(l.leadTimeDays);
    const rmId = src?.raw_material_id ?? l.raw_material_id;
    const pmId = src?.pack_material_id ?? l.pack_material_id;
    const unitFromLine = String(l.unit ?? '').trim();
    const unitFromPr = String(src?.unit ?? '').trim();
    const defaultUnit = src?.type === 'PM' || (pmId != null && Number(pmId) > 0) ? 'PCS' : 'KG';
    const unit = unitFromLine || unitFromPr || defaultUnit;
    return {
      itemName: l.item,
      itemCode: l.itemCode,
      quantity: l.qty,
      unit,
      rate: String(l.pricePerUnit),
      tax: String(l.gstPercent || 18),
      ...(ld !== undefined ? { lead_time_days: ld } : {}),
      ...(rmId != null && Number(rmId) > 0 ? { raw_material_id: Number(rmId) } : {}),
      ...(pmId != null && Number(pmId) > 0 ? { pack_material_id: Number(pmId) } : {}),
    };
  });
}

/** Match a release line edit row to a backend procurement item line. */
export function releaseEditMatchesBackendPrItem(
  ed: {
    itemName?: string;
    itemCode?: string;
    raw_material_id?: number;
    pack_material_id?: number;
    type?: string;
  },
  bi: ProcurementRequestItem
): boolean {
  const rmB = bi.raw_material_id != null ? Number(bi.raw_material_id) : NaN;
  const pmB = bi.pack_material_id != null ? Number(bi.pack_material_id) : NaN;
  const rmE = ed.raw_material_id != null ? Number(ed.raw_material_id) : NaN;
  const pmE = ed.pack_material_id != null ? Number(ed.pack_material_id) : NaN;
  if (Number.isFinite(rmB) && rmB > 0 && Number.isFinite(rmE) && rmE > 0) return rmB === rmE;
  if (Number.isFinite(pmB) && pmB > 0 && Number.isFinite(pmE) && pmE > 0) return pmB === pmE;
  const cB = String(bi.code ?? '').trim().toLowerCase();
  const nB = String(bi.name ?? '').trim().toLowerCase();
  const cE = String(ed.itemCode ?? '').trim().toLowerCase();
  const nE = String(ed.itemName ?? '').trim().toLowerCase();
  if (cE.length > 0 && cB.length > 0 && cE === cB) return true;
  if (nE.length > 0 && nB.length > 0 && (nE === nB || nE.includes(nB) || nB.includes(nE))) return true;
  return false;
}

export type ReleaseLineEditRow = {
  itemName: string;
  itemCode: string;
  type: RequestType;
  qty: number;
  originalQty: number;
  unit: string;
  moq: number;
  unitPrice: number;
  leadDays: number;
  raw_material_id?: number;
  pack_material_id?: number;
};

/**
 * After creating a draft PO for a subset of qty, reduce open quantities on the procurement request.
 * Lines not included in `linesForCreate` keep their previous open qty.
 */
export function mergeBackendPrItemsAfterPartialRelease(
  backendItems: ProcurementRequestItem[],
  lineEdits: ReleaseLineEditRow[],
  linesForCreate: ReleaseLineEditRow[]
): ProcurementRequestItem[] {
  const out: ProcurementRequestItem[] = [];
  for (const bi of backendItems) {
    const edit = lineEdits.find((e) => releaseEditMatchesBackendPrItem(e, bi));
    const orig = parseQuantityRequested(bi.quantity_requested);
    if (!edit) {
      out.push({ ...bi });
      continue;
    }
    const onThisPo = linesForCreate.some((c) => releaseEditMatchesBackendPrItem(c, bi));
    const releaseQty = onThisPo ? Math.min(Math.max(0, edit.qty), orig) : 0;
    const remaining = Math.max(0, orig - releaseQty);
    if (remaining <= 0) {
      continue;
    }
    const slabMoq = Number(edit.moq) > 0 ? Number(edit.moq) : 0;
    const lineMoq = Number(bi.moq_min) > 0 ? Number(bi.moq_min) : slabMoq;
    out.push({
      ...bi,
      quantity_requested: remaining,
    });
  }
  return out;
}

/**
 * Split a backend PR's items into:
 * - releasedItems: only the qty included in the draft PO (linesForCreate), with quantity_requested set to released qty
 * - remainingItems: all untouched items + remaining qty for included lines (backlog).
 *
 * This enables creating a new procurement request row for the remainder, instead of mutating the same PR id.
 */
export function splitBackendPrItemsAfterPartialRelease(
  backendItems: ProcurementRequestItem[],
  lineEdits: ReleaseLineEditRow[],
  linesForCreate: ReleaseLineEditRow[]
): { releasedItems: ProcurementRequestItem[]; remainingItems: ProcurementRequestItem[] } {
  const releasedItems: ProcurementRequestItem[] = [];
  const remainingItems: ProcurementRequestItem[] = [];

  for (const bi of backendItems) {
    const edit = lineEdits.find((e) => releaseEditMatchesBackendPrItem(e, bi));
    const orig = parseQuantityRequested(bi.quantity_requested);

    if (!edit) {
      // Lines not part of the modal edits: keep them untouched only in remaining.
      remainingItems.push({ ...bi });
      continue;
    }

    const onThisPo = linesForCreate.some((c) => releaseEditMatchesBackendPrItem(c, bi));
    if (!onThisPo) {
      // Edited in UI but not selected for this draft PO: still part of the remaining.
      remainingItems.push({ ...bi });
      continue;
    }

    const releaseQty = Math.min(Math.max(0, edit.qty), orig);
    const remaining = Math.max(0, orig - releaseQty);

    if (releaseQty > 0) {
      releasedItems.push({
        ...bi,
        quantity_requested: releaseQty,
        // For released portion we should not tag as backlog remainder.
        partial_release_remainder: undefined,
      } as ProcurementRequestItem);
    }

    if (remaining <= 0) {
      continue;
    }

    const slabMoq = Number(edit.moq) > 0 ? Number(edit.moq) : 0;
    const lineMoq = Number(bi.moq_min) > 0 ? Number(bi.moq_min) : slabMoq;
    remainingItems.push({
      ...bi,
      quantity_requested: remaining,
    });
  }

  return { releasedItems, remainingItems };
}
