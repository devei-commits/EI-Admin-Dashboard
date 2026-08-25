/**
 * Merge issued PO records with standalone draft POs for the unified Purchase Orders view (spec View 2).
 */
import type { DraftPO, ProcurementRequest, RequestType } from '../types/procurement.types';
import type { IssuedPOViewRecord } from '../components/procurement/issuedPoRecord.types';
import type { PoStatus } from '../constants/procurement';

function normPoKey(n: string): string {
  return String(n ?? '').trim().replace(/^PO-?/i, '').replace(/^DPO-?/i, '');
}

function mapLegacyToWorkflowStatus(record: IssuedPOViewRecord): PoStatus {
  if (record.poWorkflowStatus) return record.poWorkflowStatus;
  if (record.status === 'Draft') return 'draft';
  if (record.status === 'In Transit') return 'issued';
  return 'issued';
}

function normItemKey(s: string): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Connecting-date map for a standalone draft PO row (one not yet folded into computeIssuedPoEtaFromLeadTimes's
 * pipeline). Draft/Accepted-status POs built here never got a connectingDateByItem at all — the
 * "Connecting" column reads only that field, not etaDateDisplay, so every Draft/Accepted PO showed
 * "—" regardless of anything already known about when it's actually needed.
 *
 * Priority matches the issued-PO fix: the PR's own required-by date (per line, falling back to the
 * PR header) wins over dpo.expectedDelivery, since that field can itself have been computed from
 * "today + lead days" for POs created before that was fixed.
 */
function connectingDateByItemForDraft(dpo: DraftPO, request: ProcurementRequest): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const line of dpo.lineItems ?? []) {
    const itemDetail = request.itemDetails?.find(
      (d) => normItemKey(d.itemCode) === normItemKey(line.itemCode) || normItemKey(d.itemName) === normItemKey(line.item),
    );
    const date = itemDetail?.expectedDate || request.dueDate || dpo.expectedDelivery || null;
    if (date) out[normItemKey(line.itemCode || line.item)] = date;
  }
  return Object.keys(out).length ? out : null;
}

/** Placeholder PR for imported / planning draft POs that are not linked to a procurement request. */
function placeholderRequestForDraft(dpo: DraftPO): ProcurementRequest {
  const type: RequestType = dpo.type === 'PM' ? 'PM' : 'RM';
  return {
    id: String(dpo.requestId || ''),
    code: String(dpo.requestCode || dpo.dpoNumber || 'Imported'),
    type,
    priority: 'Medium',
    status: 'PO Draft',
    items: (dpo.lineItems ?? []).map((l) => l.item).filter(Boolean),
    dueDate: dpo.expectedDelivery || '',
    createdDate: dpo.createdDate || '',
    source: 'Excel Import',
    preferredVendor: dpo.vendor || undefined,
  };
}

/** Add draft PO rows not already represented in issued records. */
export function mergePurchaseOrderRecords(
  issuedRecords: IssuedPOViewRecord[],
  draftPOs: DraftPO[],
  requests: ProcurementRequest[],
): IssuedPOViewRecord[] {
  const existingPoKeys = new Set(issuedRecords.map((r) => normPoKey(r.poNumber)));
  const merged = issuedRecords.map((r) => ({
    ...r,
    poWorkflowStatus: mapLegacyToWorkflowStatus(r),
  }));

  for (const dpo of draftPOs) {
    const key = normPoKey(dpo.dpoNumber);
    if (existingPoKeys.has(key)) continue;
    const request =
      requests.find((r) => String(r.id) === String(dpo.requestId)) ||
      requests.find(
        (r) =>
          !!dpo.requestCode &&
          String(r.code).toUpperCase() === String(dpo.requestCode).toUpperCase(),
      ) ||
      placeholderRequestForDraft(dpo);
    existingPoKeys.add(key);
    merged.push({
      request,
      poNumber: dpo.dpoNumber.replace(/^DPO/i, 'PO'),
      vendor: dpo.vendor,
      status: 'Draft',
      // An approved draft PO surfaces as "Accepted" (still not released — see isShippable guard);
      // otherwise it stays "Draft" (incl. "Pending Approval").
      poWorkflowStatus: dpo.status === 'Approved' ? 'accepted' : 'draft',
      etaDays: 0,
      etaDateDisplay: dpo.expectedDelivery,
      lineItems: dpo.lineItems,
      grandTotal: dpo.grandTotal,
      requestCode: dpo.requestCode || request.code,
      createdDate: dpo.createdDate,
      paymentTerms: dpo.paymentTerms,
      backendPoId: dpo.backendPoId,
      approvalStatus: dpo.approvalStatus ?? null,
      connectingDateByItem: connectingDateByItemForDraft(dpo, request),
    });
  }

  merged.sort((a, b) => (b.createdDate || '').localeCompare(a.createdDate || ''));
  return merged;
}

export function derivePoWorkflowStatusFromBackend(
  backendStatus: string | null | undefined,
  legacyStatus: IssuedPOViewRecord['status'],
): PoStatus {
  const s = String(backendStatus ?? '').toLowerCase();
  if (s.includes('draft')) return 'draft';
  if (s.includes('await') && s.includes('pay')) return 'awaiting_payment';
  if (s.includes('accept')) return 'accepted';
  if (s.includes('hold')) return 'on_hold';
  if (s.includes('termin')) return 'terminated';
  if (s.includes('complet')) return 'completed';
  if (s.includes('issued') || s.includes('released')) return 'issued';
  if (legacyStatus === 'Draft') return 'draft';
  if (legacyStatus === 'In Transit') return 'issued';
  return 'issued';
}
