/**
 * PO Approval workflow API (Flowchart Sub-flow E).
 * Backend: /api/v1/purchase-orders/:id/approval[/submit|/action]
 */
import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';
import type { PoApproverRole } from '../constants/procurement';

export type PoApprovalAction = 'forward' | 'approve' | 'request_changes' | 'reject';

export interface PoApprovalRouteInfo {
  finalApprover: PoApproverRole;
  finalApproverLabel: string;
  reviewers: string[];
  requiresCfo: boolean;
  twoStep: boolean;
  deviationFlag: boolean;
  note: string;
}

export interface PoApprovalTrailEntry {
  id: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  requiredRole: string | null;
  actorName: string | null;
  actorRole: string | null;
  amount: number | null;
  note: string | null;
  at: string | null;
}

export interface PoApprovalState {
  id: string;
  orderId: string;
  poType: string;
  approvalStatus: string | null;
  approvalRequiredRole: string | null;
  approvalAmount: number | null;
  submittedForReviewAt: string | null;
  approvedAt: string | null;
  route: PoApprovalRouteInfo;
  trail?: PoApprovalTrailEntry[];
}

/** Numeric backend id from a PO row id like "PO-42" or "42". */
export function poBackendId(id: string): string {
  return String(id ?? '').replace(/^PO-/i, '').trim();
}

function apiErrorMessage(e: unknown, fallback: string): string {
  const err = e as Error & { body?: { error?: string; message?: string; code?: string } };
  const bodyMsg = err?.body?.error || err?.body?.message;
  if (typeof bodyMsg === 'string' && bodyMsg.trim()) return bodyMsg;
  return e instanceof Error && e.message ? e.message : fallback;
}

export async function fetchPoApprovalTrail(id: string): Promise<ServiceResult<PoApprovalState>> {
  try {
    const data = await api.get<PoApprovalState>(`/api/v1/purchase-orders/${poBackendId(id)}/approval`);
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to load approval trail'), success: false };
  }
}

export async function submitPoForReview(id: string, note?: string): Promise<ServiceResult<PoApprovalState>> {
  try {
    const data = await api.post<PoApprovalState>(
      `/api/v1/purchase-orders/${poBackendId(id)}/approval/submit`,
      { note: note ?? undefined },
    );
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to submit PO for review'), success: false };
  }
}

export async function actOnPoApproval(
  id: string,
  action: PoApprovalAction,
  note?: string,
): Promise<ServiceResult<PoApprovalState>> {
  try {
    const data = await api.post<PoApprovalState>(
      `/api/v1/purchase-orders/${poBackendId(id)}/approval/action`,
      { action, note: note ?? undefined },
    );
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to record approval decision'), success: false };
  }
}
