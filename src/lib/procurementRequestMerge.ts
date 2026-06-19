import type {
  ProcurementRequest,
  ProcurementRequestItem,
} from '../services/procurement.service';
import type { Order } from '../types/salesPurchase.types';
import type { RequestStatus } from '../types/procurement.types';
import { datesMatchForProcurementMerge } from './plannedReleaseTargets';

/** Statuses where Planning vendor consolidation may merge into an existing PR. */
export const PROCUREMENT_PRE_DRAFT_STATUSES: readonly RequestStatus[] = ['New', 'Quoted'] as const;

/** Backend PR status before draft PO — API returns `Pending`, UI maps to `New`. */
const BACKEND_PRE_DRAFT_STATUSES = ['Pending', 'pending'] as const;

/** Normalize API/UI status for merge eligibility. */
export function normalizeMergeableRequestStatus(status: string | null | undefined): RequestStatus | string {
  const s = String(status ?? '').trim();
  if (BACKEND_PRE_DRAFT_STATUSES.includes(s as (typeof BACKEND_PRE_DRAFT_STATUSES)[number])) {
    return 'New';
  }
  return s;
}

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
  const status = normalizeMergeableRequestStatus(pr.status) as RequestStatus;

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

export function isProcurementRequestPreDraftPipelineStatus(status: RequestStatus | string): boolean {
  const normalized = normalizeMergeableRequestStatus(status) as RequestStatus;
  return PROCUREMENT_PRE_DRAFT_STATUSES.includes(normalized);
}

/**
 * Find an open PR to append another Planning release line (same vendor + ISO week).
 * Scoped to requests for one planning_extracted_id; prefers PRs with more lines already.
 */
export function findVendorWeekMergeTarget(
  requests: ProcurementRequest[],
  opts: {
    vendorName: string;
    requiredByDate: string;
    purchaseOrders: Order[];
  }
): ProcurementRequest | undefined {
  const vendorKey = String(opts.vendorName ?? '').trim().toLowerCase();
  if (!vendorKey) return undefined;

  const candidates = requests.filter((r) => {
    const rv = String(r.preferredVendor ?? '').trim().toLowerCase();
    if (!rv || rv !== vendorKey) return false;
    const prDue = String(r.requiredByDate ?? '').trim().slice(0, 10);
    if (!datesMatchForProcurementMerge(prDue, opts.requiredByDate)) return false;
    return isProcurementRequestMergeable(r, opts.purchaseOrders);
  });

  if (candidates.length === 0) return undefined;

  return [...candidates].sort((a, b) => {
    const aLines = Array.isArray(a.items) ? a.items.length : 0;
    const bLines = Array.isArray(b.items) ? b.items.length : 0;
    if (bLines !== aLines) return bLines - aLines;
    return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));
  })[0];
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
