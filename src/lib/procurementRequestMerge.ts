import type {
  ProcurementRequest,
  ProcurementRequestItem,
} from '../services/procurement.service';
import type { Order } from '../types/salesPurchase.types';
import type { RequestStatus } from '../types/procurement.types';

/** Statuses where Planning vendor consolidation may merge into an existing PR. */
export const PROCUREMENT_PRE_DRAFT_STATUSES: readonly RequestStatus[] = ['New', 'Quoted'] as const;

const NON_MERGEABLE_STATUSES: readonly RequestStatus[] = [
  'PO Released',
  'Delivery Pending',
  'Under GRN',
] as const;

function normalizeRequestId(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '').trim();
}

function poFormRequestId(po: Order): string {
  const fd = po.formData ?? {};
  return normalizeRequestId(fd.requestId ?? fd.request_id);
}

/** True when a draft purchase order is linked to this procurement request id. */
export function procurementRequestHasLinkedDraftPo(
  requestId: string,
  purchaseOrders: Order[]
): boolean {
  const want = normalizeRequestId(requestId);
  if (!want) return false;

  for (const po of purchaseOrders) {
    if (String(po.status ?? '').trim() !== 'Draft') continue;
    if (poFormRequestId(po) === want) return true;
  }
  return false;
}

/** Whether Planning → Procurement may add qty to this PR instead of creating a new one. */
export function isProcurementRequestMergeable(
  pr: Pick<ProcurementRequest, 'id' | 'status'>,
  purchaseOrders: Order[]
): boolean {
  const status = String(pr.status ?? '').trim() as RequestStatus;

  if (NON_MERGEABLE_STATUSES.includes(status)) {
    return false;
  }

  if (PROCUREMENT_PRE_DRAFT_STATUSES.includes(status)) {
    return true;
  }

  if (status === 'PO Draft') {
    return !procurementRequestHasLinkedDraftPo(pr.id, purchaseOrders);
  }

  return false;
}

export function isProcurementRequestPreDraftPipelineStatus(status: RequestStatus): boolean {
  return PROCUREMENT_PRE_DRAFT_STATUSES.includes(status);
}

/** Stable key for merging procurement lines (Planning consolidation + draft PO delete revert). */
export function procurementItemMergeKey(item: ProcurementRequestItem): string {
  if (item.type === 'RM' && item.raw_material_id != null && Number(item.raw_material_id) > 0) {
    return `rm:${Number(item.raw_material_id)}`;
  }
  if (item.type === 'PM' && item.pack_material_id != null && Number(item.pack_material_id) > 0) {
    return `pm:${Number(item.pack_material_id)}`;
  }
  return `${item.type}:${String(item.code || item.name || '').trim().toLowerCase()}`;
}

export function isRemainderProcurementRequest(
  pr: Pick<ProcurementRequest, 'id' | 'notes' | 'items'>,
  parentRequestId: string
): boolean {
  if (String(pr.id) === String(parentRequestId)) return false;
  const items = Array.isArray(pr.items) ? pr.items : [];
  if (items.some((line) => line.partial_release_remainder === true)) return true;
  const notes = String(pr.notes ?? '');
  return /remainder/i.test(notes);
}

export function findSiblingRemainderProcurementRequests(
  parent: Pick<ProcurementRequest, 'id' | 'planningExtractedId'>,
  allPrs: ProcurementRequest[]
): ProcurementRequest[] {
  const parentId = String(parent.id);
  const peId = Number(parent.planningExtractedId);
  if (!Number.isFinite(peId) || peId <= 0) return [];

  return allPrs.filter((pr) => {
    if (String(pr.id) === parentId) return false;
    if (Number(pr.planningExtractedId) !== peId) return false;
    return isRemainderProcurementRequest(pr, parentId);
  });
}
