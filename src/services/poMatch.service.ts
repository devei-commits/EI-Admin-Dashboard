/**
 * 3-way match + Payment → Closed API (Flowchart Sub-flow I).
 * Backend: /api/v1/purchase-orders/:id/match[/invoice|/override|/pay|/close]
 */
import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';
import { poBackendId } from './poApproval.service';

export type MatchLineVerdict =
  | 'matched' | 'short_received' | 'over_received' | 'over_billed' | 'unexpected';
export type MatchVerdict = 'awaiting_invoice' | 'pass' | 'variance';

export interface MatchLine {
  code: string;
  name: string;
  unit: string;
  rate: number;
  taxPct: number;
  orderedQty: number;
  receivedQty: number;
  billedQty: number;
  orderedValue: number;
  receivedValue: number;
  verdict: MatchLineVerdict;
  matched: boolean;
}

export interface MatchTotals {
  poTotal: number;
  receivedPayable: number;
  invoiceAmount: number | null;
  amountVariancePct: number;
  amountOk: boolean;
  qtyLinesOk: boolean;
}

export interface PoMatchState {
  id: string;
  orderId: string;
  poStatus: string | null;
  grnComplete: boolean;
  match: { lines: MatchLine[]; totals: MatchTotals; verdict: MatchVerdict };
  matchStatus: string | null;
  matchNote: string | null;
  invoice: { invoiceNo: string | null; invoiceDate: string | null; invoiceAmount: number | null };
  payment: {
    advancePaidAt: string | null;
    finalPaidAt: string | null;
    finalPaidAmount: number | null;
    transactionNo: string | null;
    mode: string | null;
    transactionDate: string | null;
    isPaid: boolean;
  };
  treasury: {
    outwardId: number;
    outwardCode: string;
    status: string;
    netAmount: number | null;
    utr: string | null;
    paidAt: string | null;
  } | null;
  sentToTreasury: boolean;
  closure: { closedAt: string | null; closedNote: string | null; isClosed: boolean };
  hasInvoice: boolean;
  canPay: boolean;
  canClose: boolean;
  canSendToTreasury: boolean;
  matchCleared: boolean;
  treasuryJustCreated?: boolean;
}

export type PoPaymentMode = 'neft' | 'rtgs' | 'imps' | 'upi' | 'cheque' | 'cash' | 'other';

function apiErrorMessage(e: unknown, fallback: string): string {
  const err = e as Error & { body?: { error?: string; message?: string; code?: string } };
  const bodyMsg = err?.body?.error || err?.body?.message;
  if (typeof bodyMsg === 'string' && bodyMsg.trim()) return bodyMsg;
  return e instanceof Error && e.message ? e.message : fallback;
}

function base(id: string): string {
  return `/api/v1/purchase-orders/${poBackendId(id)}/match`;
}

export async function fetchPoMatch(id: string): Promise<ServiceResult<PoMatchState>> {
  try {
    const data = await api.get<PoMatchState>(base(id));
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to load 3-way match'), success: false };
  }
}

export async function captureInvoice(
  id: string,
  payload: { invoiceNo?: string; invoiceDate?: string; invoiceAmount: number },
): Promise<ServiceResult<PoMatchState>> {
  try {
    const data = await api.post<PoMatchState>(`${base(id)}/invoice`, payload);
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to capture invoice'), success: false };
  }
}

export async function overrideMatch(id: string, note: string): Promise<ServiceResult<PoMatchState>> {
  try {
    const data = await api.post<PoMatchState>(`${base(id)}/override`, { note });
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to override match'), success: false };
  }
}

export async function recordFinalPayment(
  id: string,
  payload: { mode: PoPaymentMode; transactionNo?: string; amount?: number; date?: string },
): Promise<ServiceResult<PoMatchState>> {
  try {
    const data = await api.post<PoMatchState>(`${base(id)}/pay`, payload);
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to record payment'), success: false };
  }
}

export async function sendPoToTreasury(id: string): Promise<ServiceResult<PoMatchState>> {
  try {
    const data = await api.post<PoMatchState>(`${base(id)}/treasury`, {});
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to send payable to Treasury'), success: false };
  }
}

export async function closePo(id: string, note?: string): Promise<ServiceResult<PoMatchState>> {
  try {
    const data = await api.post<PoMatchState>(`${base(id)}/close`, { note: note ?? undefined });
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to close PO'), success: false };
  }
}
