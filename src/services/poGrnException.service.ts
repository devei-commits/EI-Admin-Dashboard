/**
 * GRN-stage PO exceptions API (Flowchart: Short-supply · QC-fail RTV).
 * Backend: /api/v1/purchase-orders/:id/grn-exception[/short-close|/rtv|/rtv-resolve]
 * Reads GRN read-only; PO-side records only.
 */
import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';
import { poBackendId } from './poApproval.service';

export interface PoGrnPartialLine {
  code: string;
  name: string;
  unit: string;
  orderedQty: number;
  receivedQty: number;
  balanceQty: number;
}

export interface PoGrnExceptionState {
  id: string;
  orderId: string;
  grnComplete: boolean;
  partialReceipt: boolean;
  partialLines: PoGrnPartialLine[];
  qcFailed: boolean;
  shortClosed: boolean;
  shortCloseNote: string | null;
  shortClosedAt: string | null;
  rtvStatus: 'raised' | 'resolved' | null;
  rtvRaised: boolean;
  rtvReason: string | null;
  rtvDebitNoteRef: string | null;
  rtvAt: string | null;
  canShortClose: boolean;
  canRaiseRtv: boolean;
  canResolveRtv: boolean;
}

function apiErrorMessage(e: unknown, fallback: string): string {
  const err = e as Error & { body?: { error?: string; message?: string; code?: string } };
  const bodyMsg = err?.body?.error || err?.body?.message;
  if (typeof bodyMsg === 'string' && bodyMsg.trim()) return bodyMsg;
  return e instanceof Error && e.message ? e.message : fallback;
}

function base(id: string): string {
  return `/api/v1/purchase-orders/${poBackendId(id)}/grn-exception`;
}

export async function fetchPoGrnException(id: string): Promise<ServiceResult<PoGrnExceptionState>> {
  try {
    const data = await api.get<PoGrnExceptionState>(base(id));
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to load GRN exception state'), success: false };
  }
}

export async function shortClosePo(id: string, note?: string): Promise<ServiceResult<PoGrnExceptionState>> {
  try {
    const data = await api.post<PoGrnExceptionState>(`${base(id)}/short-close`, { note: note ?? undefined });
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to short-close PO'), success: false };
  }
}

export async function raiseRtv(id: string, reason: string, debitNoteRef?: string): Promise<ServiceResult<PoGrnExceptionState>> {
  try {
    const data = await api.post<PoGrnExceptionState>(`${base(id)}/rtv`, { reason, debitNoteRef: debitNoteRef ?? undefined });
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to raise RTV'), success: false };
  }
}

export async function resolveRtv(id: string, note?: string): Promise<ServiceResult<PoGrnExceptionState>> {
  try {
    const data = await api.post<PoGrnExceptionState>(`${base(id)}/rtv-resolve`, { note: note ?? undefined });
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to resolve RTV'), success: false };
  }
}
