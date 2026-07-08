/**
 * Merge issued PO records with standalone draft POs for the unified Purchase Orders view (spec View 2).
 */
import type { DraftPO, ProcurementRequest, RequestType } from '../types/procurement.types';
import type { IssuedPOViewRecord } from '../components/procurement/IssuedPOsView';
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
      poWorkflowStatus: 'draft',
      etaDays: 0,
      etaDateDisplay: dpo.expectedDelivery,
      lineItems: dpo.lineItems,
      grandTotal: dpo.grandTotal,
      requestCode: dpo.requestCode || request.code,
      createdDate: dpo.createdDate,
      paymentTerms: dpo.paymentTerms,
      backendPoId: dpo.backendPoId,
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
