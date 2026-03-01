/**
 * Universal Swap API — history and apply swap.
 * Backend: GET /api/v1/universal-swap/history, POST /api/v1/universal-swap/apply
 */

import type { ServiceResult } from '../types/api.types';
import { api } from '../lib/apiClient';

export interface SwapHistoryRecord {
  id: string;
  fromRawMaterialId: number;
  toRawMaterialId: number;
  fromIngredient: string;
  toIngredient: string;
  swapRatio: number;
  reason: string;
  approvedBy: string;
  date: string;
  affectedItemIds: number[];
  affectedItemCodes?: string[];
  createdAt?: string;
}

export interface ApplySwapPayload {
  fromRawMaterialId: number;
  toRawMaterialId: number;
  swapRatio?: number;
  reason: string;
  approvedBy: string;
  approvedByUserId?: number | null;
  selectedItemIds: (string | number)[];
}

export interface ApplySwapResponse extends SwapHistoryRecord {
  updatedItemsCount?: number;
}

export async function fetchSwapHistory(): Promise<ServiceResult<SwapHistoryRecord[]>> {
  try {
    const list = await api.get<SwapHistoryRecord[]>('/api/v1/universal-swap/history');
    return { data: list ?? [], error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load swap history';
    return { data: [], error: message, success: false };
  }
}

export async function applySwap(payload: ApplySwapPayload): Promise<ServiceResult<ApplySwapResponse>> {
  try {
    const body = {
      fromRawMaterialId: payload.fromRawMaterialId,
      toRawMaterialId: payload.toRawMaterialId,
      swapRatio: payload.swapRatio ?? 1,
      reason: payload.reason,
      approvedBy: payload.approvedBy,
      approvedByUserId: payload.approvedByUserId ?? null,
      selectedItemIds: payload.selectedItemIds.map((id) => (typeof id === 'string' ? parseInt(id, 10) : id)),
    };
    const row = await api.post<ApplySwapResponse>('/api/v1/universal-swap/apply', body);
    return { data: row ?? null, error: null, success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to apply swap';
    return { data: null, error: message, success: false };
  }
}
