/**
 * PO exception paths API (Flowchart Hold · Cancel · Amend · Revert to Draft).
 * Backend: /api/v1/purchase-orders/:id/exception[/hold|/resume|/cancel|/amend|/revert-draft]
 */
import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';
import { poBackendId } from './poApproval.service';

export interface PoExceptionState {
  id: string;
  orderId: string;
  poStatus: string | null;
  approvalStatus: string | null;
  exceptionStatus: 'on_hold' | 'cancelled' | null;
  exceptionReason: string | null;
  exceptionAt: string | null;
  exceptionBy: string | null;
  amendmentCount: number;
  amount: number;
  grnComplete: boolean;
  shipped: boolean;
  onHold: boolean;
  cancelled: boolean;
  canHold: boolean;
  canResume: boolean;
  canCancel: boolean;
  requiresCfoToCancel: boolean;
  canAmend: boolean;
  /** Lighter sibling of canAmend — a PO already in the approval workflow but short of approval
   *  (under review / under approval / rejected / changes requested) can be sent back to Draft
   *  without a reason or amendment bump. False once it's not_submitted (already there) or approved/
   *  sent/released (use Amend instead). */
  canRevertToDraft: boolean;
}

function apiErrorMessage(e: unknown, fallback: string): string {
  const err = e as Error & { body?: { error?: string; message?: string; code?: string } };
  const bodyMsg = err?.body?.error || err?.body?.message;
  if (typeof bodyMsg === 'string' && bodyMsg.trim()) return bodyMsg;
  return e instanceof Error && e.message ? e.message : fallback;
}

function base(id: string): string {
  return `/api/v1/purchase-orders/${poBackendId(id)}/exception`;
}

export async function fetchPoExceptionState(id: string): Promise<ServiceResult<PoExceptionState>> {
  try {
    const data = await api.get<PoExceptionState>(base(id));
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to load PO exception state'), success: false };
  }
}

export async function holdPo(id: string, reason: string): Promise<ServiceResult<PoExceptionState>> {
  try {
    const data = await api.post<PoExceptionState>(`${base(id)}/hold`, { reason });
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to hold PO'), success: false };
  }
}

export async function resumePo(id: string, note?: string): Promise<ServiceResult<PoExceptionState>> {
  try {
    const data = await api.post<PoExceptionState>(`${base(id)}/resume`, { note: note ?? undefined });
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to resume PO'), success: false };
  }
}

export async function cancelPo(id: string, reason: string): Promise<ServiceResult<PoExceptionState>> {
  try {
    const data = await api.post<PoExceptionState>(`${base(id)}/cancel`, { reason });
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to cancel PO'), success: false };
  }
}

export async function amendPo(id: string, reason: string): Promise<ServiceResult<PoExceptionState>> {
  try {
    const data = await api.post<PoExceptionState>(`${base(id)}/amend`, { reason });
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to amend PO'), success: false };
  }
}

export async function revertPoToDraft(id: string, note?: string): Promise<ServiceResult<PoExceptionState>> {
  try {
    const data = await api.post<PoExceptionState>(`${base(id)}/revert-draft`, { reason: note ?? undefined });
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to revert PO to Draft'), success: false };
  }
}
