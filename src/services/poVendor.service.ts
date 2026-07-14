/**
 * PO → Vendor loop API (Flowchart Sub-flow F · SENT / ACK / reject).
 * Backend: /api/v1/purchase-orders/:id/vendor[/send|/acknowledge|/reject]
 */
import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';
import { poBackendId } from './poApproval.service';

export type PoVendorStatus = 'not_sent' | 'sent' | 'acknowledged' | 'rejected';
export type PoSendChannel = 'portal' | 'email' | 'whatsapp';
export type VendorSlaLevel = 'ok' | 'warn' | 'bad';

export interface PoVendorState {
  id: string;
  orderId: string;
  approvalStatus: string | null;
  poStatus: string | null;
  vendorStatus: PoVendorStatus;
  sentAt: string | null;
  sentChannel: PoSendChannel | null;
  ackSlaDueAt: string | null;
  slaLevel: VendorSlaLevel | null;
  acknowledgedAt: string | null;
  ackNote: string | null;
  rejectedAt: string | null;
  rejectNote: string | null;
  canResend: boolean;
  canReopen: boolean;
}

function apiErrorMessage(e: unknown, fallback: string): string {
  const err = e as Error & { body?: { error?: string; message?: string; code?: string } };
  const bodyMsg = err?.body?.error || err?.body?.message;
  if (typeof bodyMsg === 'string' && bodyMsg.trim()) return bodyMsg;
  return e instanceof Error && e.message ? e.message : fallback;
}

export async function fetchPoVendorState(id: string): Promise<ServiceResult<PoVendorState>> {
  try {
    const data = await api.get<PoVendorState>(`/api/v1/purchase-orders/${poBackendId(id)}/vendor`);
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to load vendor state'), success: false };
  }
}

export async function sendPoToVendor(
  id: string,
  channel: PoSendChannel,
  note?: string,
): Promise<ServiceResult<PoVendorState>> {
  try {
    const data = await api.post<PoVendorState>(
      `/api/v1/purchase-orders/${poBackendId(id)}/vendor/send`,
      { channel, note: note ?? undefined },
    );
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to send PO to vendor'), success: false };
  }
}

export async function acknowledgePo(id: string, note?: string): Promise<ServiceResult<PoVendorState>> {
  try {
    const data = await api.post<PoVendorState>(
      `/api/v1/purchase-orders/${poBackendId(id)}/vendor/acknowledge`,
      { note: note ?? undefined },
    );
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to record acknowledgement'), success: false };
  }
}

export async function rejectPoByVendor(id: string, note?: string): Promise<ServiceResult<PoVendorState>> {
  try {
    const data = await api.post<PoVendorState>(
      `/api/v1/purchase-orders/${poBackendId(id)}/vendor/reject`,
      { note: note ?? undefined },
    );
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to record rejection'), success: false };
  }
}

/** Re-send an unchanged PO after a rejection + renegotiation (restarts the ack-SLA). */
export async function resendToVendor(id: string, channel?: PoSendChannel, note?: string): Promise<ServiceResult<PoVendorState>> {
  try {
    const data = await api.post<PoVendorState>(
      `/api/v1/purchase-orders/${poBackendId(id)}/vendor/resend`,
      { channel: channel ?? undefined, note: note ?? undefined },
    );
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to re-send PO'), success: false };
  }
}

/** Vendor won't fulfil: cancel this PO and reopen the linked PR for an alternate vendor. */
export async function reopenAfterReject(id: string, note?: string): Promise<ServiceResult<PoVendorState>> {
  try {
    const data = await api.post<PoVendorState>(
      `/api/v1/purchase-orders/${poBackendId(id)}/vendor/reopen`,
      { note: note ?? undefined },
    );
    return { data: data ?? null, error: null, success: true };
  } catch (e) {
    return { data: null, error: apiErrorMessage(e, 'Failed to reopen PR'), success: false };
  }
}
